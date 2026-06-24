// Pure helpers for the intake Schedule step's free-text fields (Holidays, Blackout dates, and the
// pasted academic calendar). Extracted from App.tsx so the parsing is unit-testable and so the
// editable text can be decoupled from the parsed array in the UI — that decoupling is what fixes the
// long-standing bug where pressing Enter, typing a trailing space, or pasting multi-line text was
// stripped on every keystroke (the field re-derived its value from the parsed array each render).

/** Parse a free-text list of dates/notes (comma- or newline-separated) into trimmed entries. */
export const parseDateList = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

/** Seed the editable textarea from the stored array, one entry per line (easy to read + edit). */
export const seedDateList = (values: string[]): string => values.join("\n");

/**
 * Normalize pasted academic-calendar text for clean storage WITHOUT destroying the author's layout:
 * standardize line endings, drop trailing spaces per line, and collapse 3+ blank lines to one gap.
 * Spaces, single blank lines, and indentation are preserved so a pasted calendar stays readable.
 */
export const cleanCalendarText = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");

export interface ScheduleContextInput {
  academicCalendar?: string;
  holidays?: string[];
  blackoutDates?: string[];
}

/**
 * Build a scheduling-context block to append to the generation prompt so the pasted academic
 * calendar, holidays, and blackout dates actually inform date planning. Returns "" when empty.
 */
export const buildScheduleContext = (schedule: ScheduleContextInput): string => {
  const parts: string[] = [];
  const calendar = cleanCalendarText(schedule.academicCalendar ?? "").trim();
  if (calendar) {
    parts.push(`Academic calendar (avoid scheduling work on holidays, breaks, and exam periods):\n${calendar}`);
  }
  if (schedule.holidays?.length) parts.push(`Holidays to keep clear: ${schedule.holidays.join(", ")}`);
  if (schedule.blackoutDates?.length) parts.push(`Blackout dates to keep clear: ${schedule.blackoutDates.join(", ")}`);
  return parts.length ? `\n\nScheduling context:\n${parts.join("\n\n")}` : "";
};
