import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flag,
  Gauge,
  ListChecks,
  MessageSquareText,
  PackageCheck,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

import { stripHtml } from "../utils/text";
import type { CourseProject, EditorTab } from "../types";
import { useModalFocus } from "../hooks/useModalFocus";

// Review mode flips the editing mental model: instead of "edit 14 sections", walk
// through every generated item once and approve it or flag it. Approving is the
// default path; editing is the exception. Verdicts persist per course in
// localStorage so a review can be finished across sessions.

type ReviewVerdict = "approved" | "flagged";
type ReviewState = Record<string, ReviewVerdict>;

interface ReviewItem {
  key: string;
  typeLabel: string;
  icon: typeof FileText;
  title: string;
  excerpt: string;
  meta: string[];
  tab: EditorTab;
}

const storageKey = (courseId: string): string => `rocketcourse.review.${courseId}`;

const readReviewState = (courseId: string): ReviewState => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(courseId)) ?? "{}") as ReviewState;
  } catch {
    return {};
  }
};

const writeReviewState = (courseId: string, state: ReviewState): void => {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(state));
  } catch {
    // Private mode — review progress just won't persist across sessions.
  }
};

const excerptOf = (html: string): string => {
  // Mark block boundaries before stripping tags — otherwise headings, nav
  // labels, and paragraphs run together into one unreadable line.
  const separated = html.replace(/<\/(?:h[1-6]|p|li|div|section|blockquote|tr)>|<br\s*\/?>/gi, "$& · ");
  const text = stripHtml(separated)
    .replace(/\s+/g, " ")
    .replace(/(?:\s*·\s*)+/g, " · ")
    .replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, "")
    .trim();
  return text.length > 360 ? `${text.slice(0, 357)}…` : text;
};

const buildQueue = (course: CourseProject): ReviewItem[] => {
  const moduleName = new Map(course.modules.map((module) => [module.id, module.title]));
  const items: ReviewItem[] = [];

  for (const page of course.pages) {
    const isSyllabus = page.slug === "syllabus";
    items.push({
      key: `page:${page.id}`,
      typeLabel: page.frontPage ? "Homepage" : isSyllabus ? "Syllabus" : "Page",
      icon: FileText,
      title: page.title,
      excerpt: excerptOf(page.bodyHtml),
      meta: [page.moduleId ? moduleName.get(page.moduleId) ?? "" : "", page.publishState].filter(Boolean),
      tab: page.frontPage ? "Homepage" : isSyllabus ? "Syllabus" : "Pages"
    });
  }
  for (const assignment of course.assignments) {
    items.push({
      key: `assignment:${assignment.id}`,
      typeLabel: "Assignment",
      icon: ClipboardCheck,
      title: assignment.title,
      excerpt: excerptOf(assignment.descriptionHtml),
      meta: [`${assignment.points} pts`, moduleName.get(assignment.moduleId) ?? ""].filter(Boolean),
      tab: "Assignments"
    });
  }
  for (const discussion of course.discussions) {
    items.push({
      key: `discussion:${discussion.id}`,
      typeLabel: "Discussion",
      icon: MessageSquareText,
      title: discussion.title,
      excerpt: excerptOf(discussion.promptHtml),
      meta: [`${discussion.points} pts`, moduleName.get(discussion.moduleId) ?? ""].filter(Boolean),
      tab: "Discussions"
    });
  }
  for (const quiz of course.quizzes) {
    items.push({
      key: `quiz:${quiz.id}`,
      typeLabel: "Quiz",
      icon: ListChecks,
      title: quiz.title,
      excerpt: quiz.questions[0] ? excerptOf(quiz.questions[0].stem) : quiz.purpose,
      meta: [
        `${quiz.questions.length} question${quiz.questions.length === 1 ? "" : "s"}`,
        `${quiz.points} pts`,
        moduleName.get(quiz.moduleId) ?? ""
      ].filter(Boolean),
      tab: "Quizzes"
    });
  }
  for (const rubric of course.rubrics) {
    items.push({
      key: `rubric:${rubric.id}`,
      typeLabel: "Rubric",
      icon: Gauge,
      title: rubric.title,
      excerpt: rubric.criteria.map((criterion) => criterion.title).join(" · "),
      meta: [`${rubric.criteria.length} criteria`, `${rubric.points} pts`],
      tab: "Rubrics"
    });
  }
  return items;
};

export function ReviewMode({
  course,
  onClose,
  onJumpToTab,
  onJumpToItem
}: {
  course: CourseProject;
  onClose: () => void;
  onJumpToTab: (tab: EditorTab) => void;
  /** Deep-link to a specific item (refId from the item key); falls back to onJumpToTab when absent. */
  onJumpToItem?: (refId: string, tab: EditorTab) => void;
}) {
  const items = useMemo(() => buildQueue(course), [course]);
  const [state, setState] = useState<ReviewState>(() => readReviewState(course.id));
  const [index, setIndex] = useState(() => {
    const firstUnreviewed = items.findIndex((item) => !readReviewState(course.id)[item.key]);
    return firstUnreviewed === -1 ? 0 : firstUnreviewed;
  });

  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);

  const reviewedCount = items.filter((item) => state[item.key]).length;
  const flagged = items.filter((item) => state[item.key] === "flagged");
  const allReviewed = items.length > 0 && reviewedCount >= items.length;

  const nextUnreviewed = (from: number, verdicts: ReviewState): number => {
    for (let offset = 1; offset <= items.length; offset += 1) {
      const candidate = (from + offset) % items.length;
      if (!verdicts[items[candidate].key]) return candidate;
    }
    return -1;
  };

  const mark = (verdict: ReviewVerdict): void => {
    const item = items[index];
    if (!item) return;
    const next = { ...state, [item.key]: verdict };
    setState(next);
    writeReviewState(course.id, next);
    const target = nextUnreviewed(index, next);
    if (target !== -1) setIndex(target);
  };

  const jumpToItem = (item: ReviewItem): void => {
    const refId = item.key.slice(item.key.indexOf(":") + 1);
    if (onJumpToItem && refId) onJumpToItem(refId, item.tab);
    else onJumpToTab(item.tab);
  };

  const fixNow = (): void => {
    const item = items[index];
    if (!item) return;
    const next: ReviewState = { ...state, [item.key]: "flagged" };
    setState(next);
    writeReviewState(course.id, next);
    jumpToItem(item);
    onClose();
  };

  const current = items[index];
  const showSummary = allReviewed || !current;

  return (
    <div ref={dialogRef} tabIndex={-1} className="review-overlay" role="dialog" aria-modal="true" aria-label="Review your course">
      <div className="review-card">
        <header className="review-head">
          <span className="hp-eyebrow">
            <ListChecks size={14} /> Review mode
          </span>
          <span className="review-count">
            {reviewedCount} of {items.length} reviewed
          </span>
          <button className="ghost-button" onClick={onClose}>
            <X size={15} /> Close
          </button>
        </header>
        <div className="guided-progress" aria-hidden="true">
          <span className="guided-progress-fill" style={{ width: `${items.length === 0 ? 100 : (reviewedCount / items.length) * 100}%` }} />
        </div>

        {showSummary ? (
          <div className="review-summary">
            <CheckCircle2 size={34} className="review-summary-icon" />
            <h2>Review complete</h2>
            <p>
              You approved {items.length - flagged.length} item{items.length - flagged.length === 1 ? "" : "s"}
              {flagged.length > 0
                ? ` and flagged ${flagged.length} for edits. Flagged items are listed below — jump straight to each one.`
                : ". Everything looked good — you're ready to validate and export."}
            </p>
            {flagged.length > 0 && (
              <ul className="review-flagged-list">
                {flagged.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => {
                        jumpToItem(item);
                        onClose();
                      }}
                    >
                      <Flag size={13} /> <span>{item.typeLabel}:</span> {item.title} <ArrowRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="review-actions">
              <button
                className="primary"
                onClick={() => {
                  onJumpToTab("Export");
                  onClose();
                }}
              >
                <PackageCheck size={16} /> Go to Export
              </button>
              <button className="ghost-button" onClick={onClose}>
                Back to the editor
              </button>
            </div>
          </div>
        ) : (
          <>
            <article className="review-item" key={current.key}>
              <div className="review-item-head">
                <span className="review-type">
                  <current.icon size={14} /> {current.typeLabel}
                </span>
                {state[current.key] && (
                  <span className={`review-verdict ${state[current.key]}`}>
                    {state[current.key] === "approved" ? <CheckCircle2 size={13} /> : <Flag size={13} />}
                    {state[current.key] === "approved" ? "Approved" : "Flagged"}
                  </span>
                )}
              </div>
              <h2>{current.title}</h2>
              <div className="review-meta">
                {current.meta.map((chip) => (
                  <span className="outcome-chip" key={chip}>
                    {chip}
                  </span>
                ))}
              </div>
              <p className="review-excerpt">{current.excerpt || "No content yet — this item is still an empty template."}</p>
            </article>
            <div className="review-actions">
              <button
                className="ghost-button"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                disabled={index === 0}
                aria-label="Previous item"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <button className="secondary" onClick={fixNow}>
                <Flag size={15} /> Fix now
              </button>
              <button className="review-approve" onClick={() => mark("approved")}>
                <CheckCircle2 size={16} /> Looks good
              </button>
              <button
                className="ghost-button"
                onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}
                disabled={index >= items.length - 1}
                aria-label="Skip to next item"
              >
                Skip <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
