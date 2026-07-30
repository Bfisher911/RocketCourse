// Adapter-local, per-course VIEW state for the workflow experiences.
// Holds presentation-only flags that must never live on the CourseProject:
//  - acknowledged advisory readiness checks ("resolve" on a recommendation)
//  - the mock-parity export-step flags (fullContentGenerated / validated)
// Persisted to localStorage per course id; falls back to memory (tests / SSR).

export interface WorkflowViewState {
  acknowledged: Set<string>;
  fullContentGenerated: boolean;
  validated: boolean;
}

const memoryStore = new Map<string, string>();
const KEY = (courseId: string) => `rc.workflow.viewstate.${courseId}`;

function readRaw(courseId: string): string | null {
  try {
    return window.localStorage.getItem(KEY(courseId));
  } catch {
    return memoryStore.get(KEY(courseId)) ?? null;
  }
}

function writeRaw(courseId: string, value: string): void {
  try {
    window.localStorage.setItem(KEY(courseId), value);
  } catch {
    memoryStore.set(KEY(courseId), value);
  }
}

export function loadViewState(courseId: string): WorkflowViewState {
  const raw = readRaw(courseId);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        acknowledged?: string[];
        fullContentGenerated?: boolean;
        validated?: boolean;
      };
      return {
        acknowledged: new Set(parsed.acknowledged ?? []),
        fullContentGenerated: Boolean(parsed.fullContentGenerated),
        validated: Boolean(parsed.validated),
      };
    } catch {
      // fall through to a fresh state on parse failure
    }
  }
  return { acknowledged: new Set(), fullContentGenerated: false, validated: false };
}

export function saveViewState(courseId: string, state: WorkflowViewState): void {
  writeRaw(
    courseId,
    JSON.stringify({
      acknowledged: [...state.acknowledged],
      fullContentGenerated: state.fullContentGenerated,
      validated: state.validated,
    }),
  );
}
