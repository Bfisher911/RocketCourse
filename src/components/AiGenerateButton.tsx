import { Loader2, Sparkles } from "lucide-react";
import type { AiActionStatus } from "../hooks/useAiAction";

interface AiGenerateButtonProps {
  onClick: () => void;
  running: boolean;
  label?: string;
  busyLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/** Generate button with a built-in spinner; the source note reports whether AI or the built-in generator produced the draft. */
export function AiGenerateButton({
  onClick,
  running,
  label = "Generate draft",
  busyLabel = "Generating…",
  className = "secondary",
  disabled = false,
  title
}: AiGenerateButtonProps) {
  return (
    <button type="button" className={`ai-generate ${className}`} onClick={onClick} disabled={disabled || running} title={title} aria-busy={running}>
      {running ? <Loader2 size={15} className="ai-spin" /> : <Sparkles size={15} />}
      {running ? busyLabel : label}
    </button>
  );
}

interface AiSourceNoteProps {
  running: boolean;
  error: string | null;
  status: AiActionStatus | null;
}

/**
 * Subtle line under an AI button: confirms a real AI result, or that the deterministic
 * fallback ran (e.g. proxy unreachable), or surfaces an unexpected error.
 */
export function AiSourceNote({ running, error, status }: AiSourceNoteProps) {
  if (running) return null;
  if (error) return <p className="ai-source-note ai-source-error" role="alert">{error}</p>;
  if (!status) return null;
  if (status.source === "ai") return <p className="ai-source-note ai-source-ok">Generated with AI.</p>;
  return <p className="ai-source-note ai-source-fallback" role="status">Used RocketCourse's built-in generator because AI was unavailable. Review the draft before publishing.</p>;
}
