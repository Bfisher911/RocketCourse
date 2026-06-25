// Live, per-course AI spend tally (client-side). The server is the authoritative cross-device record
// (usage_events, priced in netlify/functions/_shared/aiPricing.ts); this is a lightweight in-session
// running total so the editor can show real $ spent as AI calls happen. Costs are NOT estimated here —
// they come straight from the server-priced `cost` field every AI response now returns.

import type { ChatCompletionCost } from "./openaiClient";

export interface CourseAiSpend {
  /** Number of priced AI calls attributed to this course this session. */
  calls: number;
  /** Running total in micro-USD (USD * 1e6) for drift-free integer accumulation. */
  totalMicroUsd: number;
  lastModel?: string;
}

const STORAGE_KEY = "rc_ai_spend_v1";
const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const EMPTY: CourseAiSpend = { calls: 0, totalMicroUsd: 0 };

const load = (): Record<string, CourseAiSpend> => {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CourseAiSpend>) : {};
  } catch {
    return {};
  }
};

let store: Record<string, CourseAiSpend> = load();
const listeners = new Set<() => void>();

const persist = (): void => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage disabled/full — the in-memory tally still drives the live badge this session.
  }
};

/** Stable snapshot for the given course (referentially stable until it actually changes). */
export const getCourseAiSpend = (courseId: string | undefined): CourseAiSpend =>
  (courseId ? store[courseId] : undefined) ?? EMPTY;

/** Add one server-priced AI call to a course's running total and notify subscribers. No-op on $0/null. */
export const recordCourseAiSpend = (
  courseId: string | undefined,
  cost: Pick<ChatCompletionCost, "costMicroUsd" | "model"> | null | undefined
): void => {
  if (!courseId || !cost) return;
  const micro = Math.max(0, Math.round(cost.costMicroUsd ?? 0));
  const prev = store[courseId] ?? EMPTY;
  store = {
    ...store,
    [courseId]: {
      calls: prev.calls + 1,
      totalMicroUsd: prev.totalMicroUsd + micro,
      lastModel: cost.model ?? prev.lastModel
    }
  };
  persist();
  listeners.forEach((cb) => cb());
};

/** Subscribe to spend changes (for useSyncExternalStore). Returns an unsubscribe fn. */
export const subscribeCourseAiSpend = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Compact money formatting that never collapses a real sub-cent cost to "$0.00". */
export const formatUsd = (microUsd: number): string => {
  const usd = microUsd / 1_000_000;
  if (usd <= 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`; // e.g. $0.0008
  if (usd < 1) return `$${usd.toFixed(3)}`; // e.g. $0.062
  return `$${usd.toFixed(2)}`;
};
