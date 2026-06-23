import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, Download, FileQuestion, FileText, Filter, GraduationCap, GripVertical, Key, Layers, Plus, RotateCcw, Search, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CourseProject, PublishState, Quiz, QuizDifficulty, QuizQuestion, QuizQuestionType } from "../types";
import { stripHtml } from "../utils/text";
import {
  QUIZ_REVISE_ACTIONS,
  QUIZ_TEMPLATES,
  buildQuizQuestionTemplate,
  changeQuizModule,
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  renameQuizEverywhere,
  restoreQuiz,
  reviseQuiz,
  validateQuizPlan,
  type QuizTemplateId
} from "../services/quizBuilder";
import { aiGenerateQuizQuestions } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";

interface QuizzesTabProps {
  course: CourseProject;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onJumpToTab: (tab: "Modules" | "Gradebook Setup") => void;
  onExportQti: (quiz: Quiz) => void;
  onExportStudentPdf: (quiz: Quiz) => void;
  onExportAnswerKeyPdf: (quiz: Quiz) => void;
}

interface QuizSnapshot {
  id: string;
  quiz: Quiz;
  reason: string;
  createdAt: string;
  score: number;
}

const nowLabel = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const questionTypeLabel = (type: QuizQuestionType): string => type.replace("_", " ");

const quizPoints = (quiz: Quiz): number => quiz.questions.reduce((sum, question) => sum + Number(question.points || 0), 0);

const questionTypeCounts = (quizzes: Quiz[]): string =>
  Object.entries(
    quizzes.flatMap((quiz) => quiz.questions).reduce<Record<string, number>>((counts, question) => {
      counts[question.type] = (counts[question.type] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([type, count]) => `${count} ${questionTypeLabel(type as QuizQuestionType)}`)
    .join(", ") || "No questions";

const issueLabel = (count: number): string => (count === 0 ? "Ready" : `${count} warning${count === 1 ? "" : "s"}`);

export function QuizzesTab({ course, onUpdateCourse, onJumpToTab, onExportQti, onExportStudentPdf, onExportAnswerKeyPdf }: QuizzesTabProps) {
  const validation = useMemo(() => validateQuizPlan(course), [course]);
  const [selectedQuizId, setSelectedQuizId] = useState(course.quizzes[0]?.id ?? "");
  const [selectedTemplate, setSelectedTemplate] = useState<QuizTemplateId>("concept-check");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warningFilter, setWarningFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [snapshots, setSnapshots] = useState<QuizSnapshot[]>([]);

  const selectedQuiz = course.quizzes.find((quiz) => quiz.id === selectedQuizId) ?? course.quizzes[0];
  const selectedIssues = selectedQuiz ? validation.issues.filter((issue) => issue.quizId === selectedQuiz.id) : [];
  const latestSnapshot = snapshots.find((snapshot) => snapshot.quiz.id === selectedQuiz?.id);

  const filteredQuizzes = course.quizzes.filter((quiz) => {
    const issues = validation.issues.filter((issue) => issue.quizId === quiz.id);
    const haystack = `${quiz.title} ${quiz.purpose} ${quiz.questions.map((question) => question.stem).join(" ")}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (moduleFilter !== "all" && quiz.moduleId !== moduleFilter) return false;
    if (typeFilter !== "all" && !quiz.questions.some((question) => question.type === typeFilter)) return false;
    if (warningFilter === "warnings" && issues.length === 0) return false;
    if (warningFilter === "ready" && issues.length > 0) return false;
    if (statusFilter !== "all" && quiz.publishState !== statusFilter) return false;
    return true;
  });

  const pushSnapshot = (quiz: Quiz, reason: string) => {
    const score = Math.max(0, 100 - validation.issues.filter((issue) => issue.quizId === quiz.id && issue.severity === "error").length * 8 - validation.issues.filter((issue) => issue.quizId === quiz.id && issue.severity === "warning").length * 2);
    setSnapshots((current) => [{ id: `${quiz.id}_${Date.now()}`, quiz: structuredClone(quiz), reason, createdAt: nowLabel(), score }, ...current].slice(0, 8));
  };

  const updateSelectedQuiz = (updater: (quiz: Quiz) => Quiz) => {
    if (!selectedQuiz) return;
    onUpdateCourse((current) => ({ ...current, quizzes: current.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? updater(quiz) : quiz)) }));
  };

  const updateQuestion = (questionId: string, updater: (question: QuizQuestion) => QuizQuestion) => {
    updateSelectedQuiz((quiz) => ({ ...quiz, status: "edited", questions: quiz.questions.map((question) => (question.id === questionId ? updater(question) : question)) }));
  };

  const addQuiz = () => {
    const quizId = `quiz_${Date.now().toString(36)}`;
    onUpdateCourse((current) => createQuiz(current, { quizId }));
    setSelectedQuizId(quizId);
  };

  const addQuestion = (templateId = selectedTemplate) => {
    if (!selectedQuiz) return;
    pushSnapshot(selectedQuiz, `Added ${QUIZ_TEMPLATES.find((template) => template.id === templateId)?.name ?? "question"} question`);
    const question = buildQuizQuestionTemplate(templateId, course, selectedQuiz);
    updateSelectedQuiz((quiz) => ({ ...quiz, questions: [...quiz.questions, question], points: quiz.points + question.points, status: "edited" }));
  };

  const ai = useAiAction();

  const generateQuestions = () => {
    if (!selectedQuiz) return;
    pushSnapshot(selectedQuiz, "Generate questions with AI");
    void ai.run(
      () => aiGenerateQuizQuestions(course, selectedQuiz),
      (questions) =>
        updateSelectedQuiz((quiz) => {
          const merged = [...quiz.questions, ...questions];
          return { ...quiz, questions: merged, points: quizPoints({ ...quiz, questions: merged }), status: "edited" };
        })
    );
  };

  const duplicateQuestion = (question: QuizQuestion) => {
    if (!selectedQuiz) return;
    pushSnapshot(selectedQuiz, `Duplicated question`);
    updateSelectedQuiz((quiz) => ({
      ...quiz,
      questions: [...quiz.questions, { ...question, id: `${question.id}_copy_${Date.now().toString(36)}`, stem: `${question.stem} (copy)` }],
      points: quiz.points + question.points,
      status: "edited"
    }));
  };

  const deleteQuestion = (questionId: string) => {
    if (!selectedQuiz) return;
    pushSnapshot(selectedQuiz, "Deleted question");
    updateSelectedQuiz((quiz) => {
      const questions = quiz.questions.filter((question) => question.id !== questionId);
      return { ...quiz, questions, points: quizPoints({ ...quiz, questions }), status: "edited" };
    });
  };

  const reorderQuestion = (questionId: string, direction: -1 | 1) => {
    if (!selectedQuiz) return;
    updateSelectedQuiz((quiz) => {
      const index = quiz.questions.findIndex((question) => question.id === questionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= quiz.questions.length) return quiz;
      const questions = [...quiz.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...quiz, questions, status: "edited" };
    });
  };

  if (!selectedQuiz) {
    return (
      <div className="quiz-builder">
        <section className="quiz-hero">
          <div>
            <span className="eyebrow">Canvas quiz builder</span>
            <h2>Quizzes</h2>
            <p>Create a first Canvas-ready quiz with editable questions, feedback, outcomes, and export checks.</p>
          </div>
          <button className="primary" onClick={addQuiz}>
            <Plus size={16} /> Add quiz
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="quiz-builder">
      <section className="quiz-hero">
        <div>
          <span className="eyebrow">Canvas quiz builder</span>
          <h2>Quizzes</h2>
          <p>Edit quiz purpose, module placement, outcomes, question types, choices, correct answers, feedback, points, and QTI readiness from one guided workspace.</p>
        </div>
        <div className={`quiz-readiness ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <div className="quiz-disclaimer" role="note">
        <AlertTriangle size={16} />
        <p>
          <strong>Review every quiz before publishing.</strong> AI- and template-generated questions and answer keys may
          contain errors. Verify correct answers, distractors, and feedback — and adjust items for your textbook edition,
          classroom context, policy, difficulty, and accessibility before students take the quiz.
        </p>
      </div>

      <section className="quiz-metric-grid" aria-label="Quiz summary">
        <div><strong>{course.quizzes.length}</strong><span>Total quizzes</span></div>
        <div><strong>{course.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0)}</strong><span>Total questions</span></div>
        <div><strong>{course.quizzes.reduce((sum, quiz) => sum + Number(quiz.points || 0), 0)}</strong><span>Total points</span></div>
        <div><strong>{questionTypeCounts(course.quizzes)}</strong><span>Question types</span></div>
        <div className={validation.issues.length ? "warn" : ""}><strong>{validation.issues.length}</strong><span>Warnings</span></div>
      </section>

      <section className="quiz-toolbar" aria-label="Search and filter quizzes">
        <label className="quiz-search"><Search size={15} /><input value={search} placeholder="Search quizzes or questions" onChange={(event) => setSearch(event.target.value)} /></label>
        <label><Layers size={14} /> Module<select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="all">All modules</option>{course.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
        <label><FileQuestion size={14} /> Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="multiple_choice">Multiple choice</option><option value="true_false">True/false</option><option value="short_answer">Short answer</option><option value="essay">Essay</option></select></label>
        <label><Filter size={14} /> Warnings<select value={warningFilter} onChange={(event) => setWarningFilter(event.target.value)}><option value="all">All states</option><option value="warnings">Needs review</option><option value="ready">Ready</option></select></label>
        <label><ClipboardCheck size={14} /> Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All publish states</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select></label>
        <button className="primary" onClick={addQuiz}><Plus size={16} /> Add quiz</button>
      </section>

      <div className="quiz-layout">
        <section className="quiz-list" aria-label="Quiz list">
          {filteredQuizzes.map((quiz) => {
            const issues = validation.issues.filter((issue) => issue.quizId === quiz.id);
            return (
              <button key={quiz.id} className={`quiz-list-card ${quiz.id === selectedQuiz.id ? "active" : ""} ${issues.some((issue) => issue.severity === "error") ? "has-errors" : ""}`} onClick={() => setSelectedQuizId(quiz.id)}>
                <span className={`quiz-status ${issues.length ? "review" : "ready"}`}>{issueLabel(issues.length)}</span>
                <strong>{quiz.title}</strong>
                <small>{quiz.purpose}</small>
                <div>
                  <span><Layers size={12} /> {course.modules.find((module) => module.id === quiz.moduleId)?.title ?? "Missing module"}</span>
                  <span><FileQuestion size={12} /> {quiz.questions.length} questions</span>
                  <span><ClipboardCheck size={12} /> {quiz.points} pts</span>
                  <span><GraduationCap size={12} /> {quiz.alignedOutcomeIds.length} outcomes</span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="quiz-editor-panel" aria-label="Selected quiz editor">
          <header className="quiz-editor-header">
            <div>
              <span className={`quiz-status ${selectedIssues.length ? "review" : "ready"}`}>{issueLabel(selectedIssues.length)}</span>
              <h3>{selectedQuiz.title}</h3>
              <p>{selectedQuiz.questions.length} questions • {quizPoints(selectedQuiz)} question points • QTI paths stay stable on export.</p>
            </div>
            <div className="quiz-editor-actions">
              <button onClick={() => onJumpToTab("Modules")}><Layers size={15} /> Modules</button>
              <button onClick={() => onJumpToTab("Gradebook Setup")}><ClipboardCheck size={15} /> Gradebook</button>
              <button onClick={() => onUpdateCourse((current) => duplicateQuiz(current, selectedQuiz.id))}><Copy size={15} /> Copy</button>
              <button onClick={() => onExportQti(selectedQuiz)} title="Download this quiz as a Canvas QTI .zip"><Download size={15} /> Export QTI</button>
              <button onClick={() => onExportStudentPdf(selectedQuiz)} title="Download a printable student copy (no answers)"><FileText size={15} /> Student PDF</button>
              <button onClick={() => onExportAnswerKeyPdf(selectedQuiz)} title="Download the instructor answer key PDF"><Key size={15} /> Answer key</button>
              <button className="danger" onClick={() => { pushSnapshot(selectedQuiz, "Deleted quiz"); onUpdateCourse((current) => deleteQuiz(current, selectedQuiz.id)); setSelectedQuizId(course.quizzes.find((quiz) => quiz.id !== selectedQuiz.id)?.id ?? ""); }}><Trash2 size={15} /> Delete</button>
            </div>
          </header>

          <div className="quiz-form-grid">
            <label>Title<input value={selectedQuiz.title} onChange={(event) => onUpdateCourse((current) => renameQuizEverywhere(current, selectedQuiz.id, event.target.value))} /></label>
            <label>Points<input type="number" min={1} value={selectedQuiz.points} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, points: Number(event.target.value), status: "edited" }))} /></label>
            <label>Module<select value={selectedQuiz.moduleId} onChange={(event) => onUpdateCourse((current) => changeQuizModule(current, selectedQuiz.id, event.target.value))}>{course.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
            <label>Assignment group<select value={selectedQuiz.assignmentGroupId} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, assignmentGroupId: event.target.value, status: "edited" }))}>{course.assignmentGroups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.weight}%)</option>)}</select></label>
            <label>Status<select value={selectedQuiz.publishState} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, publishState: event.target.value as PublishState, status: "edited" }))}><option value="published">Published</option><option value="unpublished">Unpublished</option></select></label>
            <label>Due date<input type="datetime-local" value={selectedQuiz.dueAt?.slice(0, 16) ?? ""} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined, status: "edited" }))} /></label>
            <label>Attempts<select value={String(selectedQuiz.allowedAttempts ?? 1)} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, allowedAttempts: Number(event.target.value), status: "edited" }))}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="-1">Unlimited</option></select></label>
            <label>Shuffle answers<select value={selectedQuiz.shuffleAnswers ? "yes" : "no"} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, shuffleAnswers: event.target.value === "yes", status: "edited" }))}><option value="no">No</option><option value="yes">Yes</option></select></label>
          </div>

          <label className="quiz-purpose-editor">Purpose<textarea value={selectedQuiz.purpose} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, purpose: event.target.value, status: "edited" }))} /></label>

          <section className="quiz-outcome-picker" aria-label="Aligned quiz outcomes">
            <header><h4>Outcome alignment</h4><p>Quiz-level outcomes also seed new question alignment.</p></header>
            <div>
              {course.outcomes.map((outcome) => {
                const selected = selectedQuiz.alignedOutcomeIds.includes(outcome.id);
                return (
                  <label key={outcome.id} className={selected ? "selected" : ""}>
                    <input type="checkbox" checked={selected} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, alignedOutcomeIds: event.target.checked ? [...quiz.alignedOutcomeIds, outcome.id] : quiz.alignedOutcomeIds.filter((id) => id !== outcome.id), status: "edited" }))} />
                    <span>{outcome.code}</span>
                    <small>{outcome.text}</small>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="quiz-template-panel" aria-label="Question templates and revise actions">
            <div className="quiz-template-bar">
              <label><Wand2 size={14} /> Template<select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value as QuizTemplateId)}>{QUIZ_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              <button className="primary" onClick={() => addQuestion()}><Plus size={15} /> Add question</button>
              <AiGenerateButton running={ai.running} onClick={generateQuestions} label="Generate questions with AI" />
              <button disabled={!latestSnapshot} onClick={() => { if (!latestSnapshot) return; onUpdateCourse((current) => restoreQuiz(current, latestSnapshot.quiz)); setSnapshots((current) => current.filter((snapshot) => snapshot.id !== latestSnapshot.id)); }}><RotateCcw size={15} /> Restore previous</button>
            </div>
            <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
            {latestSnapshot && <p className="quiz-snapshot-note">Latest snapshot: {latestSnapshot.reason}, {latestSnapshot.createdAt}. Score then: {latestSnapshot.score}%.</p>}
            <div className="quiz-template-grid">
              {QUIZ_TEMPLATES.map((template) => (
                <button key={template.id} className={selectedTemplate === template.id ? "active" : ""} onClick={() => { setSelectedTemplate(template.id); addQuestion(template.id); }}>
                  <strong>{template.name}</strong><span>{template.description}</span>
                </button>
              ))}
            </div>
            <div className="quiz-revise-grid">
              {QUIZ_REVISE_ACTIONS.map((action) => (
                <button key={action.id} onClick={() => { pushSnapshot(selectedQuiz, action.label); onUpdateCourse((current) => reviseQuiz(current, selectedQuiz.id, action.id)); }}>
                  <Wand2 size={14} /><strong>{action.label}</strong><span>{action.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="quiz-question-panel" aria-label="Question editor">
            <header><h4>Questions</h4><span>{selectedQuiz.questions.length} items</span></header>
            {selectedQuiz.questions.map((question, index) => (
              <article className="quiz-question-card" key={question.id}>
                <header>
                  <strong><GripVertical size={14} /> Question {index + 1}</strong>
                  <div>
                    <button disabled={index === 0} onClick={() => reorderQuestion(question.id, -1)}>Up</button>
                    <button disabled={index === selectedQuiz.questions.length - 1} onClick={() => reorderQuestion(question.id, 1)}>Down</button>
                    <button onClick={() => duplicateQuestion(question)}><Copy size={14} /> Copy</button>
                    <button className="danger" onClick={() => deleteQuestion(question.id)}><Trash2 size={14} /> Delete</button>
                  </div>
                </header>
                <div className="quiz-question-grid">
                  <label>Type<select value={question.type} onChange={(event) => updateQuestion(question.id, (current) => ({ ...buildQuizQuestionTemplate(event.target.value === "true_false" ? "true-false-explanation" : event.target.value === "short_answer" ? "short-answer-analysis" : event.target.value === "essay" ? "reflection-essay" : "concept-check", course, selectedQuiz, { questionId: current.id }), stem: current.stem || buildQuizQuestionTemplate("concept-check", course, selectedQuiz).stem }))}><option value="multiple_choice">Multiple choice</option><option value="true_false">True/false</option><option value="short_answer">Short answer</option><option value="essay">Essay</option></select></label>
                  <label>Points<input type="number" min={1} value={question.points} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, points: Number(event.target.value) }))} /></label>
                  <label>Difficulty<select value={question.difficulty} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, difficulty: event.target.value as QuizDifficulty }))}><option value="introductory">Introductory</option><option value="balanced">Balanced</option><option value="challenging">Challenging</option></select></label>
                </div>
                <label>Stem<textarea value={question.stem} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, stem: event.target.value }))} /></label>
                {(question.type === "multiple_choice" || question.type === "true_false") && (
                  <div className="quiz-choice-list">
                    {(question.choices ?? (question.type === "true_false" ? ["True", "False"] : ["", ""])).map((choice, choiceIndex) => (
                      <label key={`${question.id}_${choiceIndex}`}>
                        Choice {choiceIndex + 1}
                        <div>
                          <input value={choice} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, choices: (current.choices ?? []).map((item, index) => (index === choiceIndex ? event.target.value : item)), correctAnswer: current.correctAnswer === choice ? event.target.value : current.correctAnswer }))} />
                          <button className={question.correctAnswer === choice ? "primary" : ""} onClick={() => updateQuestion(question.id, (current) => ({ ...current, correctAnswer: choice }))}>Correct</button>
                        </div>
                      </label>
                    ))}
                    {question.type === "multiple_choice" && <button onClick={() => updateQuestion(question.id, (current) => ({ ...current, choices: [...(current.choices ?? []), "New choice"] }))}><Plus size={14} /> Add choice</button>}
                  </div>
                )}
                {question.type === "short_answer" && <label>Acceptable answers<input value={question.correctAnswer ?? ""} placeholder="Optional: answer one | answer two" onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, correctAnswer: event.target.value }))} /></label>}
                <div className="quiz-feedback-grid">
                  <label>General feedback<textarea value={question.feedback ?? ""} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, feedback: event.target.value }))} /></label>
                  <label>Correct feedback<textarea value={question.correctFeedback ?? ""} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, correctFeedback: event.target.value }))} /></label>
                  <label>Incorrect feedback<textarea value={question.incorrectFeedback ?? ""} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, incorrectFeedback: event.target.value }))} /></label>
                </div>
              </article>
            ))}
          </section>
        </section>

        <aside className="quiz-preview-panel" aria-label="Quiz validation and preview">
          <div className="quiz-preview-sticky">
            <header><span className="eyebrow">Canvas/QTI preview</span><h3>{selectedQuiz.title}</h3><p>{selectedQuiz.purpose}</p></header>
            <div className="quiz-export-map">
              <span><FileQuestion size={12} /> {selectedQuiz.id}/assessment_qti.xml</span>
              <span><FileQuestion size={12} /> non_cc_assessments/{selectedQuiz.id}.xml.qti</span>
              <span><ClipboardCheck size={12} /> {selectedQuiz.points} quiz pts</span>
            </div>
            <section className="quiz-checklist" aria-label="Quiz validation checks">
              <header><h4>Readiness checklist</h4><span className={selectedIssues.length ? "review" : "ready"}>{selectedIssues.length ? `${selectedIssues.length} to review` : "Ready"}</span></header>
              {selectedIssues.length === 0 ? <p>This quiz has clear questions, valid answer keys where needed, feedback, outcomes, module placement, and Canvas-safe QTI structure.</p> : selectedIssues.slice(0, 10).map((issue) => <p key={issue.id} className={issue.severity}><AlertTriangle size={14} /> {issue.title}: {issue.detail}</p>)}
            </section>
            <div className="quiz-canvas-preview">
              {selectedQuiz.questions.map((question, index) => (
                <article key={question.id}>
                  <strong>{index + 1}. {stripHtml(question.stem)}</strong>
                  <small>{questionTypeLabel(question.type)} • {question.points} pts • {question.difficulty}</small>
                  {question.choices?.length ? <ol>{question.choices.map((choice) => <li key={choice} className={choice === question.correctAnswer ? "correct" : ""}>{choice}</li>)}</ol> : <p>{question.feedback || "Manual grading guidance appears here."}</p>}
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
