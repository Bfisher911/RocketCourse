// Transaction guard for AI / deterministic content revisions. A revise action must never replace
// good content with empty or unsafe output. validateRevisionCandidate() inspects the candidate HTML
// BEFORE it is committed; if it fails, the caller keeps the previous content and shows a recoverable
// message. Pure + unit-testable.

import { unsafeHtmlReasons } from "./htmlSafety";
import { stripHtml } from "../utils/text";

export interface RevisionCheck {
  ok: boolean;
  reason?: string;
}

/** Minimum readable text length for a revision to be considered non-empty. */
const MIN_TEXT_LENGTH = 10;

export const validateRevisionCandidate = (candidate: string): RevisionCheck => {
  if (!candidate || !candidate.trim()) {
    return { ok: false, reason: "The revision came back empty — your previous content was kept." };
  }
  if (stripHtml(candidate).trim().length < MIN_TEXT_LENGTH) {
    return { ok: false, reason: "The revision had almost no content — your previous content was kept." };
  }
  const unsafe = unsafeHtmlReasons(candidate);
  if (unsafe.length) {
    return { ok: false, reason: `The revision contained unsafe HTML (${unsafe[0]}) — your previous content was kept.` };
  }
  return { ok: true };
};
