// The CourseBlueprint is the AI's first deliverable: the instructional architecture the user
// approves (or revises) before the full Canvas course is built. Kept intentionally compact and
// strongly typed so it can be (a) generated as JSON by the model, (b) shown/edited in the approval
// UI, and (c) used to seed the full course. Shared by client and the server function.

export interface BlueprintModule {
  title: string;
  summary: string;
  objectives: string[];
}

export interface BlueprintOutcome {
  code: string;
  text: string;
}

export interface CourseBlueprint {
  title: string;
  description: string;
  audience: string;
  level: string;
  modality: string;
  creditHours: number;
  lengthWeeks: number;
  teachingApproach: string;
  outcomes: BlueprintOutcome[];
  modules: BlueprintModule[];
  majorAssessments: string[];
  finalProject: string;
  accessibilityNotes: string;
  validationWarnings: string[];
}

/** A compact JSON-schema description embedded in the prompt so the model returns the right shape. */
export const BLUEPRINT_JSON_SHAPE = `{
  "title": string,
  "description": string,
  "audience": string,
  "level": string,
  "modality": string,
  "creditHours": number,
  "lengthWeeks": number,
  "teachingApproach": string,
  "outcomes": [{ "code": string (e.g. "CO1"), "text": string }],
  "modules": [{ "title": string, "summary": string, "objectives": string[] }],
  "majorAssessments": string[],
  "finalProject": string,
  "accessibilityNotes": string,
  "validationWarnings": string[]
}`;

/** Validate + normalize an unknown value (parsed model JSON) into a CourseBlueprint. Throws on garbage. */
export const parseBlueprint = (value: unknown): CourseBlueprint => {
  if (typeof value !== "object" || value === null) throw new Error("Blueprint is not an object.");
  const v = value as Record<string, unknown>;
  const str = (x: unknown, fallback = ""): string => (typeof x === "string" ? x : fallback);
  const num = (x: unknown, fallback: number): number => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

  const modules = arr<Record<string, unknown>>(v.modules).map((m) => ({
    title: str(m.title, "Untitled module"),
    summary: str(m.summary),
    objectives: arr<unknown>(m.objectives).map((o) => str(o)).filter(Boolean)
  }));
  if (modules.length === 0) throw new Error("Blueprint has no modules.");

  const outcomes = arr<Record<string, unknown>>(v.outcomes).map((o, index) => ({
    code: str(o.code, `CO${index + 1}`),
    text: str(o.text)
  }));

  return {
    title: str(v.title, "Untitled Course"),
    description: str(v.description),
    audience: str(v.audience),
    level: str(v.level),
    modality: str(v.modality),
    creditHours: num(v.creditHours, 3),
    lengthWeeks: num(v.lengthWeeks, modules.length),
    teachingApproach: str(v.teachingApproach),
    outcomes,
    modules,
    majorAssessments: arr<unknown>(v.majorAssessments).map((a) => str(a)).filter(Boolean),
    finalProject: str(v.finalProject),
    accessibilityNotes: str(v.accessibilityNotes),
    validationWarnings: arr<unknown>(v.validationWarnings).map((w) => str(w)).filter(Boolean)
  };
};
