// Live "AI spend" chip for the editor header. Reads the per-course running total from the
// client-side meter (fed by the server-priced `cost` each AI response returns) and renders only
// once at least one AI call has been billed to this course. Stays out of the way otherwise.

import { type ReactElement, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { formatUsd, getCourseAiSpend, subscribeCourseAiSpend } from "../services/aiSpendMeter";

export function AiSpendBadge({ courseId }: { courseId: string }): ReactElement | null {
  const spend = useSyncExternalStore(
    subscribeCourseAiSpend,
    () => getCourseAiSpend(courseId),
    () => getCourseAiSpend(courseId)
  );

  if (!spend.calls) return null;

  const calls = `${spend.calls} AI call${spend.calls === 1 ? "" : "s"}`;
  const model = spend.lastModel ? ` · ${spend.lastModel}` : "";
  return (
    <span className="save-chip ai-spend" title={`${calls}${model} · real OpenAI cost this session (server-priced)`}>
      <Sparkles size={12} /> {formatUsd(spend.totalMicroUsd)} AI
    </span>
  );
}
