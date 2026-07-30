// ============================================================================
// Contact-hours model (Carnegie-style workload)
// ----------------------------------------------------------------------------
// A leaf module on purpose. These two values used to live in courseGenerator.ts,
// which meant anything needing the credit-hour constant — the Contact Hours tab,
// for instance — dragged in the whole course-generation engine AND triggered its
// module-scope demo-course generation. They depend on nothing but types, so they
// belong on their own.
// ============================================================================

import type { ContactHourPlan, CourseSettings } from "../types";

/** Total student workload hours per credit hour (Carnegie unit convention). */
export const HOURS_PER_CREDIT = 45;

/**
 * Split a course's total workload across the categories Canvas courses are
 * planned against. Proportions are fixed; the final-project bucket absorbs the
 * rounding remainder so the parts always sum to totalHours exactly.
 */
export const makeContactHours = (settings: CourseSettings): ContactHourPlan => {
  const totalHours = settings.creditHours * HOURS_PER_CREDIT;
  const instructionalTime = Math.round(totalHours * 0.22);
  const readingMediaTime = Math.round(totalHours * 0.25);
  const assignmentTime = Math.round(totalHours * 0.22);
  const discussionTime = Math.round(totalHours * 0.1);
  const quizStudyTime = Math.round(totalHours * 0.08);
  const finalProjectTime = Math.max(0, totalHours - instructionalTime - readingMediaTime - assignmentTime - discussionTime - quizStudyTime);

  return {
    instructionalTime,
    readingMediaTime,
    assignmentTime,
    discussionTime,
    quizStudyTime,
    finalProjectTime,
    totalHours,
    justification: `${settings.creditHours} credit hours over ${settings.lengthWeeks} weeks is planned as approximately ${totalHours} total student workload hours. The plan balances instructor-presented content, reading and media, discussion, quiz preparation, applied assignments, and final project development.`
  };
};
