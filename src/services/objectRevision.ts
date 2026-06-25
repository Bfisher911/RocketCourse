export type RevisionMode = "concise" | "examples" | "accessibility" | "rubric";

export interface ReviseCourseObjectInput {
  courseTitle: string;
  objectType: "page" | "assignment" | "discussion" | "quiz" | "rubric";
  title: string;
  html: string;
  mode: RevisionMode;
  context: {
    outcomeCodes: string[];
    moduleTitle?: string;
    futureProvider: "server-side-ai";
    /** Telemetry: course id so revise spend is grouped per course server-side. */
    courseId?: string;
  };
}

export interface ReviseCourseObjectResult {
  html: string;
  provider: "deterministic-local";
  note: string;
}

const additions: Record<RevisionMode, string> = {
  concise:
    "<div style=\"margin: 16px 0; padding: 14px 16px; border-left: 4px solid #0f766e; background: #ecfdf5;\"><h2 style=\"margin: 0 0 8px;\">Clarity Pass</h2><p>Key instructions were tightened so students can scan the purpose, task, deliverable, and next step.</p></div>",
  examples:
    "<div style=\"margin: 16px 0; padding: 14px 16px; border: 1px solid #dbe4f0; border-radius: 8px;\"><h2 style=\"margin: 0 0 8px;\">Examples To Consider</h2><ul><li>Connect the concept to a current event, case, or professional decision.</li><li>Explain one implication for students, institutions, communities, or future practice.</li><li>Name what evidence would make the analysis stronger.</li></ul></div>",
  accessibility:
    "<div style=\"margin: 16px 0; padding: 14px 16px; border-left: 4px solid #2563eb; background: #eff6ff;\"><h2 style=\"margin: 0 0 8px;\">Accessibility Check</h2><p>Use descriptive links, short paragraphs, meaningful headings, and clear file names. Avoid relying on color alone to communicate important information.</p></div>",
  rubric:
    "<div style=\"margin: 16px 0; padding: 14px 16px; border-left: 4px solid #a5402d; background: #fff1ed;\"><h2 style=\"margin: 0 0 8px;\">Rubric Reminder</h2><p>Before submitting, compare the work against the rubric criteria and confirm that each required outcome is represented.</p></div>"
};

export const reviseCourseObject = (input: ReviseCourseObjectInput): ReviseCourseObjectResult => {
  const contextNote = input.context.outcomeCodes.length
    ? `<p style="font-size: 13px; color: #475569;">Revision context: ${input.context.outcomeCodes.join(", ")}${input.context.moduleTitle ? ` in ${input.context.moduleTitle}` : ""}.</p>`
    : "";

  return {
    html: `${input.html}\n${additions[input.mode]}\n${contextNote}`,
    provider: "deterministic-local",
    note: `Prepared ${input.mode} revision for ${input.objectType} "${input.title}" in ${input.courseTitle}. Future real AI should run server-side through reviseCourseObject(...).`
  };
};
