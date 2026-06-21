import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import type { CourseProject, Quiz, QuizQuestion } from "../types";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { generateImsccBlob } from "./imsccExport";

// ---------------------------------------------------------------------------
// Minimal dependency-free QTI 1.2 parser. The vitest "node" environment has no
// DOMParser, so we extract the structured fields we care about from each <item>
// and assert the source QuizQuestion data round-trips through the package.
// ---------------------------------------------------------------------------

const unescapeXml = (value: string): string =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

interface ParsedItem {
  ident: string;
  questionType?: string;
  ccProfile?: string;
  points?: number;
  stem?: string;
  choices: Array<{ ident: string; text: string }>;
  varequalValues: string[];
  feedback: string[];
  hasResponseLid: boolean;
  hasResponseStr: boolean;
  hasRenderFib: boolean;
  awardsScore: boolean;
}

const parseQtiItems = (qti: string): Map<string, ParsedItem> => {
  const items = new Map<string, ParsedItem>();
  for (const match of qti.matchAll(/<item ident="([^"]+)"[\s\S]*?<\/item>/g)) {
    const block = match[0];
    const ident = match[1];
    const field = (label: string): string | undefined =>
      block.match(new RegExp(`<fieldlabel>${label}</fieldlabel><fieldentry>([^<]*)</fieldentry>`))?.[1];

    const choices: Array<{ ident: string; text: string }> = [];
    const renderChoice = block.match(/<render_choice>([\s\S]*?)<\/render_choice>/)?.[1] ?? "";
    for (const choice of renderChoice.matchAll(/<response_label ident="([^"]+)">[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>/g)) {
      choices.push({ ident: choice[1], text: unescapeXml(choice[2]) });
    }

    const varequalValues = Array.from(block.matchAll(/<varequal\b[^>]*>([\s\S]*?)<\/varequal>/g)).map((value) => unescapeXml(value[1]));
    const feedback = Array.from(block.matchAll(/<itemfeedback\b[\s\S]*?<mattext[^>]*>([\s\S]*?)<\/mattext>[\s\S]*?<\/itemfeedback>/g)).map((entry) =>
      unescapeXml(entry[1])
    );
    const pointsRaw = field("points_possible");

    items.set(ident, {
      ident,
      questionType: field("question_type"),
      ccProfile: field("cc_profile"),
      points: pointsRaw === undefined ? undefined : Number(pointsRaw),
      stem: unescapeXml(block.match(/<presentation>\s*<material><mattext[^>]*>([\s\S]*?)<\/mattext>/)?.[1] ?? ""),
      choices,
      varequalValues,
      feedback,
      hasResponseLid: /<response_lid\b/.test(block),
      hasResponseStr: /<response_str\b/.test(block),
      hasRenderFib: /<render_fib\b/.test(block),
      awardsScore: /<setvar action="Set" varname="SCORE">100<\/setvar>/.test(block)
    });
  }
  return items;
};

// Unzip a real .imscc blob the same way Canvas would, then return the parsed QTI for a quiz.
const exportAndParseQuiz = async (course: CourseProject, quiz: Quiz) => {
  const { blob } = await generateImsccBlob(course);
  const bytes = await blob.arrayBuffer();
  const reloaded = await JSZip.loadAsync(bytes);
  const canvasQti = await reloaded.file(`non_cc_assessments/${quiz.id}.xml.qti`)?.async("text");
  const ccQti = await reloaded.file(`${quiz.id}/assessment_qti.xml`)?.async("text");
  expect(canvasQti, `${quiz.id} canvas qti present`).toBeTruthy();
  expect(ccQti, `${quiz.id} cc qti present`).toBeTruthy();
  return { canvas: parseQtiItems(canvasQti as string), cc: parseQtiItems(ccQti as string) };
};

const expectedCanvasType = (question: QuizQuestion): string => {
  if (question.type === "multiple_choice") return "multiple_choice_question";
  if (question.type === "true_false") return "true_false_question";
  if (question.type === "short_answer" && question.correctAnswer) return "short_answer_question";
  return "essay_question";
};

// Assert that one source question fully survived into the parsed QTI item.
const expectQuestionSurvives = (parsed: ParsedItem | undefined, question: QuizQuestion): void => {
  expect(parsed, `item ${question.id} present`).toBeDefined();
  if (!parsed) return;

  expect(parsed.points, `${question.id} points`).toBe(question.points);
  expect(parsed.stem, `${question.id} stem`).toBe(question.stem);
  expect(parsed.questionType, `${question.id} type`).toBe(expectedCanvasType(question));

  const choiceBased =
    (question.type === "multiple_choice" || question.type === "true_false") &&
    (question.choices?.length ?? 0) > 0 &&
    Boolean(question.correctAnswer);

  if (choiceBased) {
    expect(parsed.hasResponseLid, `${question.id} renders choices`).toBe(true);
    // Every source choice survived as a rendered label.
    (question.choices ?? []).forEach((choice) => {
      expect(parsed.choices.map((parsedChoice) => parsedChoice.text), `${question.id} choice "${choice}"`).toContain(choice);
    });
    // The answer key points at the label whose text is the correct answer.
    const correctLabel = parsed.choices.find((choice) => choice.text === question.correctAnswer);
    expect(correctLabel, `${question.id} correct choice present`).toBeDefined();
    expect(parsed.varequalValues, `${question.id} answer key`).toContain(correctLabel?.ident);
    expect(parsed.awardsScore, `${question.id} scores the correct answer`).toBe(true);
  } else if (question.type === "short_answer" && question.correctAnswer) {
    expect(parsed.hasResponseStr && parsed.hasRenderFib, `${question.id} fill-in-blank input`).toBe(true);
    question.correctAnswer
      .split("|")
      .map((answer) => answer.trim())
      .forEach((answer) => expect(parsed.varequalValues, `${question.id} accepts "${answer}"`).toContain(answer));
    expect(parsed.awardsScore, `${question.id} scores the typed answer`).toBe(true);
  } else {
    // Open prompt -> manually graded essay: a text input, no auto-scored key.
    expect(parsed.hasResponseStr && parsed.hasRenderFib, `${question.id} essay input`).toBe(true);
    expect(parsed.varequalValues, `${question.id} has no answer key`).toHaveLength(0);
    expect(parsed.awardsScore, `${question.id} is not auto-scored`).toBe(false);
  }

  // Feedback the question carries must appear somewhere in the item.
  const expectedFeedback = [question.correctFeedback, question.incorrectFeedback, question.feedback].filter(Boolean) as string[];
  if (expectedFeedback.length > 0) {
    expect(parsed.feedback.length, `${question.id} carries feedback`).toBeGreaterThan(0);
    expect(parsed.feedback.some((text) => expectedFeedback.includes(text)), `${question.id} feedback text survives`).toBe(true);
  }
};

// Splice author-written questions (with answer keys) into a generated course's first quiz.
const withCuratedFirstQuiz = (course: CourseProject, questions: QuizQuestion[]): { course: CourseProject; quiz: Quiz } => {
  const quiz: Quiz = { ...course.quizzes[0], questions };
  return { course: { ...course, quizzes: course.quizzes.map((existing, index) => (index === 0 ? quiz : existing)) }, quiz };
};

describe("QTI export round-trip (unzip + parse)", () => {
  it("preserves every generated quiz question through a real .imscc unzip", async () => {
    const quiz = sampleProject.quizzes[0];
    const { canvas, cc } = await exportAndParseQuiz(sampleProject, quiz);

    expect(quiz.questions.length).toBeGreaterThan(0);
    quiz.questions.forEach((question) => {
      expectQuestionSurvives(canvas.get(question.id), question);
      expectQuestionSurvives(cc.get(question.id), question);
    });

    // The cc-flavored package additionally tags each item with a Common Cartridge profile.
    quiz.questions.forEach((question) => {
      expect(cc.get(question.id)?.ccProfile, `${question.id} cc profile`).toMatch(/^cc\./);
      expect(canvas.get(question.id)?.ccProfile, `${question.id} canvas has no cc profile`).toBeUndefined();
    });
  });

  it("round-trips multiple choice, true/false, short answer, and essay in one quiz", async () => {
    const base = sampleProject.quizzes[0];
    const shared = { moduleId: base.moduleId, alignedOutcomeIds: base.alignedOutcomeIds, difficulty: "balanced" as const };
    const curated: QuizQuestion[] = [
      {
        id: `${base.id}_mc`,
        type: "multiple_choice",
        stem: "Which layer of the OSI model routes packets between networks?",
        choices: ["Application", "Transport", "Network", "Physical"],
        correctAnswer: "Network",
        correctFeedback: "Right — the network layer handles routing.",
        incorrectFeedback: "Recall which layer assigns IP addresses.",
        points: 5,
        ...shared
      },
      {
        id: `${base.id}_tf`,
        type: "true_false",
        stem: "HTTP is a stateless protocol.",
        choices: ["True", "False"],
        correctAnswer: "True",
        correctFeedback: "Correct, each request is independent.",
        incorrectFeedback: "Review how cookies add state on top of HTTP.",
        points: 2,
        ...shared
      },
      {
        id: `${base.id}_sa`,
        type: "short_answer",
        stem: "What does the acronym CPU stand for?",
        correctAnswer: "Central Processing Unit|CPU",
        correctFeedback: "Exactly.",
        incorrectFeedback: "Think about the component that executes instructions.",
        points: 3,
        ...shared
      },
      {
        id: `${base.id}_essay`,
        type: "essay",
        stem: "Explain, in your own words, why layered network models aid debugging.",
        feedback: "Look for a clear link between abstraction layers and fault isolation.",
        instructorReviewRequired: true,
        points: 6,
        ...shared
      }
    ];
    const { course, quiz } = withCuratedFirstQuiz(sampleProject, curated);
    const { canvas, cc } = await exportAndParseQuiz(course, quiz);

    curated.forEach((question) => {
      expectQuestionSurvives(canvas.get(question.id), question);
      expectQuestionSurvives(cc.get(question.id), question);
    });

    // Spot-check the short-answer specifics that the model must not drop.
    const shortAnswer = canvas.get(`${base.id}_sa`);
    expect(shortAnswer?.questionType).toBe("short_answer_question");
    expect(shortAnswer?.varequalValues).toEqual(expect.arrayContaining(["Central Processing Unit", "CPU"]));
    expect(cc.get(`${base.id}_sa`)?.ccProfile).toBe("cc.fib.v0p1");
  });

  it("keeps quiz data intact across varied course settings", async () => {
    const courses = [
      generateCourseProject({
        prompt: "Build me a quiz-heavy 6-week course on Data Literacy.",
        settings: { ...defaultSettings, moduleCount: 6, lengthWeeks: 6, courseLengthPreset: "6-weeks", quizFrequency: "module", quizDifficulty: "challenging" }
      }),
      generateCourseProject({
        prompt: "Build me a 4-week course on Lab Safety with module quizzes.",
        settings: { ...defaultSettings, moduleCount: 4, lengthWeeks: 4, courseLengthPreset: "4-weeks", quizFrequency: "module", quizDifficulty: "introductory" }
      })
    ];

    for (const course of courses) {
      expect(course.quizzes.length).toBeGreaterThan(0);
      for (const quiz of course.quizzes) {
        const { canvas } = await exportAndParseQuiz(course, quiz);
        quiz.questions.forEach((question) => expectQuestionSurvives(canvas.get(question.id), question));
      }
    }
  });
});
