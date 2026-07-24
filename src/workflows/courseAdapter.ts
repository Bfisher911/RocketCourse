// ============================================================================
// CourseAdapter — binds the workflow-experience widgets to the REAL course.
//
// The eight experience renderers (src/workflows/prototypes) read and mutate a
// simple "session" facade (see prototypes/shared/blocks.js). In the lab that
// facade is seeded from deterministic mock data. Inside the app, this adapter
// makes the SAME facade a live view of the actual CourseProject:
//
//   refresh(course)  real → facade   (in place; object identities preserved,
//                                     derived surfaces recomputed)
//   commit()         facade → real   (ONE pure, change-detected updater passed
//                                     to updateCourse — so every workflow edit
//                                     gets undo, autosave, and project-list
//                                     sync exactly like the original editor)
//
// Guarantees the switching contract depends on:
//  - constructing/refreshing/deriving NEVER calls updateCourse;
//  - commit() with no facade changes calls updateCourse ZERO times;
//  - each real mutation is exactly one pure updater (StrictMode-safe);
//  - unknown real fields (interactionBlocks, publishState, metadata, …) are
//    preserved by merging onto existing objects, never rebuilt from scratch.
// ============================================================================

import type {
  Assignment,
  CourseModule,
  CourseProject,
  CoursePage,
  Discussion,
  ModuleItem,
  Quiz,
  Rubric,
  RubricCriterion,
} from "../types";
import { buildReadinessReport } from "../services/readiness";
import { buildCourseQualityReport } from "../services/courseQuality";
import { applyCourseInteractions, resolveInteractionDensity } from "../services/interactionSelection";
import { loadViewState, saveViewState, type WorkflowViewState } from "./adapterViewState";

// ---------------------------------------------------------------------------
// Facade shapes (the contract blocks.js widgets already consume — plain JS).
// ---------------------------------------------------------------------------
type Attn = "rubric-incomplete" | "ai-review" | "verify-key" | "alt-text" | null;

interface FacadeItem { id: string; type: string; refId: string; title: string; needsAttention?: Attn }
interface FacadeModule {
  id: string; order: number; kind: string; title: string; summary: string;
  workloadHours: number; status: "approved" | "needs-review" | "workload-high";
  items: FacadeItem[];
}
interface FacadeIssue { id: string; label: string; where: string; refId?: string; resolvable: boolean; help?: string }

export interface SessionTarget {
  // blocks.js exports these two mutable containers; the adapter writes INTO
  // them so every widget/concept closure keeps working untouched.
  session: Record<string, unknown> & {
    commit?: (reason?: string) => void;
    actions?: Record<string, unknown>;
  };
  D: Record<string, unknown>;
  emit: () => void;
}

export interface AdapterHooks {
  /** App-owned export actions, injected by the WorkflowHost. */
  runValidation?: () => void;
  download?: () => void;
  generateFullContent?: () => void;
}

export interface CourseAdapter {
  refresh(course: CourseProject): void;
  commit(): void;
  /** Advisory-severity acknowledge; required-severity checks clear via real fixes. */
  resolveIssue(id: string): void;
  dispose(): void;
  readonly viewState: WorkflowViewState;
}

export function createCourseAdapter(opts: {
  getCourse: () => CourseProject;
  updateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  target: SessionTarget;
  hooks?: AdapterHooks;
}): CourseAdapter {
  const { getCourse, updateCourse, target, hooks } = opts;
  const view = loadViewState(getCourse().id);
  let disposed = false;
  /** Ids present in reviewQueue at last refresh — removals become completions on commit. */
  let lastReviewIds = new Set<string>();

  // ---- facade plumbing ------------------------------------------------------
  const s = target.session as Record<string, any>;
  const d = target.D as Record<string, any>;

  function persistView() { saveViewState(getCourse().id, view); }

  // =====================================================================
  // refresh: real → facade (in place, identity-preserving)
  // =====================================================================
  function refresh(course: CourseProject): void {
    if (disposed) return;
    const readiness = buildReadinessReport(course);
    const quality = buildCourseQualityReport(course);

    // -- content maps (reuse per-id objects so widget closures stay live) ----
    syncMap(s, "pages", course.pages, (p: CoursePage, out) => {
      out.id = p.id; out.title = p.title; out.moduleId = p.moduleId ?? "";
      out.body = p.bodyHtml; out.updatedAt = p.metadata?.updatedAt ?? "";
      out.edited = p.status === "edited" || p.metadata?.source === "edited";
    });
    syncMap(s, "assignments", course.assignments, (a: Assignment, out) => {
      out.id = a.id; out.title = a.title; out.moduleId = a.moduleId;
      out.groupId = a.assignmentGroupId; out.points = a.points;
      out.estimatedHours = a.estimatedHours; out.rubricId = a.rubricId ?? "";
      out.alignedOutcomeIds = [...a.alignedOutcomeIds];
      out.dueAt = a.dueAt ?? "Not scheduled"; out.submissionType = a.submissionType;
      out.instructions = a.descriptionHtml;
      out.edited = a.status === "edited" || a.metadata?.source === "edited";
    });
    syncMap(s, "discussions", course.discussions, (di: Discussion, out) => {
      out.id = di.id; out.title = di.title; out.moduleId = di.moduleId;
      out.groupId = di.assignmentGroupId; out.points = di.points;
      out.alignedOutcomeIds = [...di.alignedOutcomeIds];
      out.prompt = di.promptHtml;
      out.edited = di.status === "edited" || di.metadata?.source === "edited";
      const review = openReviewFor(course, di.id);
      out.needsAttention = review ? "ai-review" : null;
      out.aiNote = review?.rationale ?? null;
    });
    syncMap(s, "quizzes", course.quizzes, (q: Quiz, out) => {
      out.id = q.id; out.title = q.title; out.moduleId = q.moduleId;
      out.groupId = q.assignmentGroupId; out.points = q.points;
      out.alignedOutcomeIds = [...q.alignedOutcomeIds];
      out.questions = q.questions.map(qq => ({
        id: qq.id, type: qq.type, stem: qq.stem,
        choices: qq.choices ? [...qq.choices] : null,
        correct: qq.choices && qq.correctAnswer != null
          ? Math.max(0, qq.choices.indexOf(qq.correctAnswer)) : null,
        verified: !qq.instructorReviewRequired,
        needsAttention: qq.instructorReviewRequired ? "verify-key" : null,
        aiNote: qq.instructorReviewRequired
          ? "AI generated this item and a suggested answer key. Verify before publishing." : null,
      }));
    });
    syncMap(s, "rubrics", course.rubrics, (r: Rubric, out) => {
      out.id = r.id; out.title = r.title; out.points = r.points;
      const incomplete = r.criteria.length === 0 || r.criteria.some(c => c.levels.length === 0);
      out.complete = !incomplete;
      out.incompleteReason = incomplete
        ? "A criterion has no performance levels yet." : undefined;
      out.criteria = r.criteria.map(c => ({
        id: c.id, title: c.title,
        points: c.levels.reduce((m, l) => Math.max(m, l.points), 0),
        levels: c.levels.map(l => ({ label: l.label, points: l.points, desc: l.description })),
      }));
    });

    // -- modules (identity-preserving array) --------------------------------
    const incompleteRubricIds = new Set(
      course.rubrics.filter(r => r.criteria.length === 0 || r.criteria.some(c => c.levels.length === 0)).map(r => r.id));
    const unverifiedQuizIds = new Set(
      course.quizzes.filter(q => q.questions.some(qq => qq.instructorReviewRequired)).map(q => q.id));
    const reviewIds = new Set(course.reviewChecklist.filter(rc => !rc.completed && !view.acknowledged.has(rc.id))
      .map(rc => rc.relatedObjectId).filter(Boolean) as string[]);

    syncArray<CourseModule, FacadeModule>(s, "modules", course.modules, (m, out) => {
      out.id = m.id; out.order = m.order; out.kind = m.kind; out.title = m.title;
      out.summary = m.description; out.workloadHours = m.workloadHours;
      const items: FacadeItem[] = m.items.map(it => ({
        id: it.id, type: it.type, refId: it.refId, title: it.title,
        needsAttention: attnFor(it, incompleteRubricIds, unverifiedQuizIds, reviewIds, course),
      }));
      out.items = mergeItems((out.items as FacadeItem[] | undefined) ?? [], items);
      out.status = m.workloadHours > 6 ? "workload-high"
        : items.some(it => it.needsAttention) ? "needs-review" : "approved";
    });

    // -- simple collections --------------------------------------------------
    s.outcomes = course.outcomes.map(o => ({
      id: o.id, code: o.code, text: o.text, bloom: o.bloomLevel,
      alignedModuleIds: [...o.alignedModuleIds],
    }));
    s.assignmentGroups = course.assignmentGroups.map(g => ({ id: g.id, name: g.name, weight: g.weight }));

    // -- theme ---------------------------------------------------------------
    s.theme = {
      id: course.theme.id, name: course.theme.name,
      palette: {
        bg: course.theme.accentDark, ink: course.theme.contrastText,
        accent: course.theme.accent, accent2: course.theme.soft,
      },
      contrastNote: course.theme.contrastStatus === "pass"
        ? "Theme colors meet the AA contrast target."
        : "One theme color pairing needs review against the AA contrast target.",
      contrastPass: course.theme.contrastStatus === "pass" ? "pass" : "partial",
    };

    // -- homepage / syllabus -------------------------------------------------
    const hp = course.homepage?.content;
    s.homepage = {
      mode: course.homepage?.mode ?? "builder",
      template: course.homepage?.templateId ?? "",
      hero: {
        eyebrow: hp?.heroEyebrow ?? course.title,
        title: hp?.heroHeading ?? course.title,
        tagline: hp?.purpose ?? "",
      },
      welcome: hp?.welcome ?? "",
      buttons: [hp?.primaryButton, hp?.secondaryButton].filter(Boolean),
      pathItems: (hp?.pathItems ?? []).map(t => ({ title: t, summary: "" })),
      edited: false,
    };
    const sy = course.syllabus?.content;
    s.syllabus = {
      mode: course.syllabus?.mode ?? "builder",
      sections: [
        sec("s-desc", "Course Description", sy?.courseDescription ?? "", false),
        sec("s-outcomes", "Learning Outcomes", (sy?.learningOutcomes ?? []).join("\n"), true),
        sec("s-grading", "Grading Breakdown", (sy?.gradingBreakdown ?? []).join("\n"), true),
        sec("s-late", "Late Work Policy", sy?.lateWorkPolicy ?? "", false),
        sec("s-integrity", "Academic Integrity", sy?.academicIntegrityPolicy ?? "", false,
          "Empty — confirm your academic-integrity language."),
        sec("s-ai", "AI Use Policy", sy?.aiUsePolicy ?? "", false,
          "Not set. Recommended for a writing-heavy course."),
        sec("s-access", "Accessibility & Accommodations", sy?.accessibilityAccommodations ?? "", false),
      ],
    };

    // -- settings ------------------------------------------------------------
    s.settings = {
      weeks: course.settings.lengthWeeks,
      modality: course.settings.modality,
      level: course.settings.level,
      creditHours: course.settings.creditHours,
      includeRubrics: course.settings.includeRubrics,
      aiPolicy: sy?.aiUsePolicy?.trim() ? sy.aiUsePolicy : "Not set",
      interactionDensity: resolveInteractionDensity(course),
    };

    // -- contact hours + sources --------------------------------------------
    const ch = course.contactHours;
    s.contactHours = {
      creditHours: course.settings.creditHours,
      requiredTotal: course.settings.creditHours * 45,
      plannedTotal: ch.totalHours,
      categories: [
        { label: "Direct instruction", hours: ch.instructionalTime },
        { label: "Reading & media", hours: ch.readingMediaTime },
        { label: "Assignments", hours: ch.assignmentTime },
        { label: "Discussion", hours: ch.discussionTime },
        { label: "Quiz study", hours: ch.quizStudyTime },
        { label: "Final project", hours: ch.finalProjectTime },
      ],
      note: ch.justification,
    };
    s.sourceFiles = course.settings.sourceFiles.map(f => ({
      id: f.id, name: f.name, kind: f.kind ?? "Source", size: f.sizeLabel, note: f.note ?? "",
    }));

    // -- readiness / quality / review queue / accessibility ------------------
    const failedReq = readiness.checks.filter(c => c.severity === "required" && !c.passed);
    const failedRec = readiness.checks.filter(c => c.severity === "recommended" && !c.passed
      && !view.acknowledged.has(c.id));
    s.readiness = {
      score: readiness.score,
      status: failedReq.length ? "Blocked" : failedRec.length ? "Review" : "Ready",
      blockers: failedReq.map(c => issueOf(c.id, c.label, c.detail, false)),
      warnings: failedRec.map(c => issueOf(c.id, c.label, c.detail, true)),
      quality: quality.categories.map(q => ({ label: q.label, score: q.score })),
    };
    s.reviewQueue = course.reviewChecklist
      .filter(rc => !rc.completed && !view.acknowledged.has(rc.id))
      .map(rc => ({
        id: rc.id, kind: rc.relatedObjectType ?? "course", refId: rc.relatedObjectId ?? "",
        moduleId: "", priority: rc.priority === "must" ? "must" : "recommended",
        title: rc.title, detail: rc.rationale, action: rc.action,
      }));
    lastReviewIds = new Set(s.reviewQueue.map((r: { id: string }) => r.id));

    const a11yChecks = readiness.checks.filter(c => /alt text|contrast|accessib|heading/i.test(c.label));
    s.accessibility = {
      tier: `WCAG 2.1 ${course.settings.accessibilityTier ?? "AA"}`,
      issues: a11yChecks.map(c => ({
        id: c.id, severity: c.passed ? "pass" : "warning",
        where: c.label, what: c.detail, fix: c.passed ? null : c.detail,
        resolvable: false, refKind: /alt text/i.test(c.label) ? "alt-text" : "contrast",
      })),
    };

    // -- export status -------------------------------------------------------
    s.exportStatus = {
      packageName: slugify(course.title) + ".imscc",
      format: "Canvas-oriented Common Cartridge (.imscc)",
      fullContentGenerated: view.fullContentGenerated,
      lastValidated: null,
      sandboxImportStatus: "not_tested",
      contents: [
        { label: "Modules", count: course.modules.length },
        { label: "Pages", count: course.pages.length },
        { label: "Assignments", count: course.assignments.length },
        { label: "Discussions", count: course.discussions.length },
        { label: "Quizzes", count: course.quizzes.length },
        { label: "Rubrics", count: course.rubrics.length },
        { label: "Outcomes", count: course.outcomes.length },
        { label: "Files", count: course.settings.sourceFiles.length },
      ],
      note: "Local validation checks structure and links. Canvas import is not verified until you test the package in a sandbox.",
    };
    s.fullContentGenerated = view.fullContentGenerated;
    s.validated = view.validated;
    s.resolved = view.acknowledged;

    // -- the D facade (course-level info some concepts read) -----------------
    d.course = {
      id: course.id, title: course.title, subtitle: course.settings.level,
      code: "", institution: "", term: "",
      level: course.settings.level, modality: course.settings.modality,
      creditHours: course.settings.creditHours, weeks: course.settings.lengthWeeks,
      description: course.description,
      status: course.status, updatedAt: course.updatedAt,
      aiGenerated: course.metadata?.source !== "edited", instructorConfirmed: false,
    };
    d.assignmentGroups = s.assignmentGroups;
    d.contactHours = s.contactHours;
    d.homepage = s.homepage;
    d.syllabus = s.syllabus;
    d.sourceFiles = s.sourceFiles;
    d.theme = s.theme;
    d.modules = s.modules;
    d.readiness = s.readiness;

    target.emit();
  }

  // =====================================================================
  // commit: facade → real (ONE pure, change-detected updater)
  // =====================================================================
  function commit(): void {
    if (disposed) return;
    // Snapshot facade values OUTSIDE the updater so it stays pure + idempotent.
    const snap = snapshotFacade();
    const before = getCourse();
    const after = applySnapshot(before, snap);
    if (after === before) return; // nothing changed → zero updateCourse calls
    updateCourse(current => applySnapshot(current, snap));
  }

  interface FacadeSnapshot {
    pages: Array<{ id: string; title: string; body: string }>;
    assignments: Array<{ id: string; title: string; instructions: string; points: number }>;
    discussions: Array<{ id: string; title: string; prompt: string }>;
    quizzes: Array<{ id: string; questions: Array<{ id: string; stem: string; verified: boolean; correct: number | null; choices: string[] | null }> }>;
    rubrics: Array<{ id: string; points: number; criteria: Array<{ id: string; levels: Array<{ label: string; points: number; desc: string }> }> }>;
    modules: Array<{ id: string; title: string; summary: string; workloadHours: number; itemOrder: string[] }>;
    outcomes: Array<{ id: string; alignedModuleIds: string[] }>;
    groups: Array<{ id: string; weight: number }>;
    homepage: { eyebrow: string; heading: string; welcome: string } | null;
    syllabus: Record<string, string>;
    settings: { weeks: number; includeRubrics: boolean; aiPolicy: string };
    theme: { bg: string; contrastPass: string };
    contactHours: number[] | null;
    openReviewIds: string[];
  }

  function snapshotFacade(): FacadeSnapshot {
    const pages = Object.values(s.pages ?? {}) as any[];
    const assignments = Object.values(s.assignments ?? {}) as any[];
    const discussions = Object.values(s.discussions ?? {}) as any[];
    const quizzes = Object.values(s.quizzes ?? {}) as any[];
    const rubrics = Object.values(s.rubrics ?? {}) as any[];
    return {
      pages: pages.map(p => ({ id: p.id, title: p.title, body: p.body })),
      assignments: assignments.map(a => ({ id: a.id, title: a.title, instructions: a.instructions, points: a.points })),
      discussions: discussions.map(di => ({ id: di.id, title: di.title, prompt: di.prompt })),
      quizzes: quizzes.map(q => ({
        id: q.id,
        questions: (q.questions ?? []).map((qq: any) => ({
          id: qq.id, stem: qq.stem, verified: Boolean(qq.verified),
          correct: qq.correct ?? null, choices: qq.choices ?? null,
        })),
      })),
      rubrics: rubrics.map(r => ({
        id: r.id, points: r.points,
        criteria: (r.criteria ?? []).map((c: any) => ({
          id: c.id,
          levels: (c.levels ?? []).map((l: any) => ({ label: l.label, points: l.points, desc: l.desc })),
        })),
      })),
      modules: ((s.modules ?? []) as any[]).map(m => ({
        id: m.id, title: m.title, summary: m.summary, workloadHours: m.workloadHours,
        itemOrder: (m.items ?? []).map((it: any) => it.id),
      })),
      outcomes: ((s.outcomes ?? []) as any[]).map(o => ({ id: o.id, alignedModuleIds: [...o.alignedModuleIds] })),
      groups: ((s.assignmentGroups ?? []) as any[]).map(g => ({ id: g.id, weight: g.weight })),
      homepage: s.homepage
        ? { eyebrow: s.homepage.hero?.eyebrow ?? "", heading: s.homepage.hero?.title ?? "", welcome: s.homepage.welcome ?? "" }
        : null,
      syllabus: Object.fromEntries(((s.syllabus?.sections ?? []) as any[])
        .filter(x => !x.derived).map(x => [x.id, x.body ?? ""])),
      settings: {
        weeks: Number(s.settings?.weeks ?? 0),
        includeRubrics: Boolean(s.settings?.includeRubrics),
        aiPolicy: String(s.settings?.aiPolicy ?? ""),
      },
      theme: { bg: s.theme?.palette?.bg ?? "", contrastPass: s.theme?.contrastPass ?? "" },
      contactHours: s.contactHours
        ? (s.contactHours.categories as any[]).map(c => Number(c.hours) || 0)
        : null,
      openReviewIds: ((s.reviewQueue ?? []) as any[]).map(r => r.id),
    };
  }

  function applySnapshot(course: CourseProject, snap: FacadeSnapshot): CourseProject {
    let changed = false;
    const touch = <T>(v: T): T => { changed = true; return v; };

    const pages = mapMerge(course.pages, snap.pages, (real, f) =>
      real.title !== f.title || real.bodyHtml !== f.body
        ? touch({ ...real, title: f.title, bodyHtml: f.body, status: "edited" as const })
        : real);
    const assignments = mapMerge(course.assignments, snap.assignments, (real, f) =>
      real.title !== f.title || real.descriptionHtml !== f.instructions || real.points !== f.points
        ? touch({ ...real, title: f.title, descriptionHtml: f.instructions, points: f.points, status: "edited" as const })
        : real);
    const discussions = mapMerge(course.discussions, snap.discussions, (real, f) =>
      real.title !== f.title || real.promptHtml !== f.prompt
        ? touch({ ...real, title: f.title, promptHtml: f.prompt, status: "edited" as const })
        : real);
    const quizzes = mapMerge(course.quizzes, snap.quizzes, (real, f) => {
      const fq = new Map(f.questions.map(q => [q.id, q]));
      let qChanged = false;
      const questions = real.questions.map(qq => {
        const fqq = fq.get(qq.id);
        if (!fqq) return qq;
        const wantReview = !fqq.verified;
        const wantAnswer = fqq.choices && fqq.correct != null ? fqq.choices[fqq.correct] : qq.correctAnswer;
        if (qq.stem !== fqq.stem || Boolean(qq.instructorReviewRequired) !== wantReview || qq.correctAnswer !== wantAnswer) {
          qChanged = true;
          return { ...qq, stem: fqq.stem, instructorReviewRequired: wantReview, correctAnswer: wantAnswer };
        }
        return qq;
      });
      return qChanged ? touch({ ...real, questions, status: "edited" as const }) : real;
    });
    const rubrics = mapMerge(course.rubrics, snap.rubrics, (real, f) => {
      const fc = new Map(f.criteria.map(c => [c.id, c]));
      let rChanged = false;
      const criteria: RubricCriterion[] = real.criteria.map(c => {
        const fcc = fc.get(c.id);
        if (!fcc) return c;
        const levels = fcc.levels.map(l => ({ label: l.label, points: l.points, description: l.desc }));
        if (JSON.stringify(levels) !== JSON.stringify(c.levels)) { rChanged = true; return { ...c, levels }; }
        return c;
      });
      const points = f.points !== real.points ? f.points : real.points;
      return rChanged || points !== real.points
        ? touch({ ...real, criteria, points, status: "edited" as const })
        : real;
    });
    const modules = mapMerge(course.modules, snap.modules, (real, f) => {
      const byId = new Map(real.items.map(it => [it.id, it]));
      const ordered = f.itemOrder.map(id => byId.get(id)).filter(Boolean) as ModuleItem[];
      // keep any real items the facade doesn't know about, in original order
      for (const it of real.items) if (!f.itemOrder.includes(it.id)) ordered.push(it);
      const reordered = ordered.some((it, i) => real.items[i]?.id !== it.id);
      const items = reordered ? ordered.map((it, i) => ({ ...it, order: i })) : real.items;
      if (real.title !== f.title || real.description !== f.summary
        || real.workloadHours !== f.workloadHours || reordered) {
        return touch({ ...real, title: f.title, description: f.summary, workloadHours: f.workloadHours, items });
      }
      return real;
    });
    const outcomes = mapMerge(course.outcomes, snap.outcomes, (real, f) =>
      JSON.stringify(real.alignedModuleIds) !== JSON.stringify(f.alignedModuleIds)
        ? touch({ ...real, alignedModuleIds: [...f.alignedModuleIds] })
        : real);
    const assignmentGroups = mapMerge(course.assignmentGroups, snap.groups, (real, f) =>
      real.weight !== f.weight ? touch({ ...real, weight: f.weight }) : real);

    let homepage = course.homepage;
    if (homepage && snap.homepage) {
      const c = homepage.content;
      if (c.heroEyebrow !== snap.homepage.eyebrow || c.heroHeading !== snap.homepage.heading
        || c.welcome !== snap.homepage.welcome) {
        homepage = touch({
          ...homepage,
          content: { ...c, heroEyebrow: snap.homepage.eyebrow, heroHeading: snap.homepage.heading, welcome: snap.homepage.welcome },
        });
      }
    }

    let syllabus = course.syllabus;
    if (syllabus) {
      const c = syllabus.content;
      const map: Array<[string, keyof typeof c]> = [
        ["s-desc", "courseDescription"], ["s-late", "lateWorkPolicy"],
        ["s-integrity", "academicIntegrityPolicy"], ["s-ai", "aiUsePolicy"],
        ["s-access", "accessibilityAccommodations"],
      ];
      let next = c;
      for (const [sid, field] of map) {
        const v = snap.syllabus[sid];
        if (v !== undefined && typeof next[field] === "string" && next[field] !== v) {
          next = { ...next, [field]: v };
        }
      }
      const aiFromSettings = snap.settings.aiPolicy && snap.settings.aiPolicy !== "Not set"
        ? snap.settings.aiPolicy : null;
      if (aiFromSettings && next.aiUsePolicy !== aiFromSettings) {
        next = { ...next, aiUsePolicy: aiFromSettings };
      }
      if (next !== c) syllabus = touch({ ...syllabus, content: next });
    }

    let settings = course.settings;
    if (settings.lengthWeeks !== snap.settings.weeks || settings.includeRubrics !== snap.settings.includeRubrics) {
      settings = touch({ ...settings, lengthWeeks: snap.settings.weeks, includeRubrics: snap.settings.includeRubrics });
    }

    let theme = course.theme;
    const wantPass = snap.theme.contrastPass === "pass" ? "pass" as const : theme.contrastStatus;
    if ((snap.theme.bg && theme.accentDark !== snap.theme.bg) || theme.contrastStatus !== wantPass) {
      theme = touch({ ...theme, accentDark: snap.theme.bg || theme.accentDark, contrastStatus: wantPass });
    }

    let contactHours = course.contactHours;
    if (snap.contactHours) {
      const [inst, read, asg, disc, quiz, fin] = snap.contactHours;
      const total = snap.contactHours.reduce((a, b) => a + b, 0);
      if (contactHours.instructionalTime !== inst || contactHours.readingMediaTime !== read
        || contactHours.assignmentTime !== asg || contactHours.discussionTime !== disc
        || contactHours.quizStudyTime !== quiz || contactHours.finalProjectTime !== fin) {
        contactHours = touch({
          ...contactHours, instructionalTime: inst, readingMediaTime: read, assignmentTime: asg,
          discussionTime: disc, quizStudyTime: quiz, finalProjectTime: fin, totalHours: total,
        });
      }
    }

    // review-queue removals → checklist completions
    const openNow = new Set(snap.openReviewIds);
    const reviewChecklist = course.reviewChecklist.map(rc =>
      lastReviewIds.has(rc.id) && !openNow.has(rc.id) && !rc.completed
        ? touch({ ...rc, completed: true })
        : rc);

    if (!changed) return course;
    return {
      ...course, pages, assignments, discussions, quizzes, rubrics, modules,
      outcomes, assignmentGroups, homepage, syllabus, settings, theme, contactHours,
      reviewChecklist,
    };
  }

  // =====================================================================
  // actions with special semantics
  // =====================================================================
  function resolveIssue(id: string): void {
    view.acknowledged.add(id);
    persistView();
    refresh(getCourse());
  }

  // Wire the facade's action hooks (blocks.js consults these when bound).
  s.commit = () => commit();
  s.actions = {
    resolveIssue,
    runValidation: hooks?.runValidation,
    download: hooks?.download,
    generateFullContent: () => {
      if (hooks?.generateFullContent) hooks.generateFullContent();
      view.fullContentGenerated = true; persistView(); refresh(getCourse());
    },
    markValidated: () => { view.validated = true; persistView(); refresh(getCourse()); },
    // Course-wide interaction density: set the setting AND re-apply interactions
    // at the new density, in one undoable/autosaved change.
    setInteractionDensity: (density: string) => {
      updateCourse(c => applyCourseInteractions({
        ...c,
        settings: { ...c.settings, interactionDensity: density as CourseProject["settings"]["interactionDensity"] },
      }));
    },
  };

  return {
    refresh,
    commit,
    resolveIssue,
    viewState: view,
    dispose() {
      disposed = true;
      delete s.commit; delete s.actions;
    },
  };

  // ---- local helpers --------------------------------------------------------
  function issueOf(id: string, label: string, detail: string, resolvable: boolean): FacadeIssue {
    return { id, label, where: detail, refId: undefined, resolvable, help: detail };
  }
  function openReviewFor(course: CourseProject, objectId: string) {
    return course.reviewChecklist.find(rc =>
      !rc.completed && !view.acknowledged.has(rc.id) && rc.relatedObjectId === objectId);
  }
  function attnFor(
    it: ModuleItem,
    incompleteRubricIds: Set<string>,
    unverifiedQuizIds: Set<string>,
    reviewIds: Set<string>,
    course: CourseProject,
  ): Attn {
    if (it.type === "quiz" && unverifiedQuizIds.has(it.refId)) return "verify-key";
    if (it.type === "assignment") {
      const a = course.assignments.find(x => x.id === it.refId);
      if (a?.rubricId && incompleteRubricIds.has(a.rubricId)) return "rubric-incomplete";
    }
    if (reviewIds.has(it.refId)) return "ai-review";
    return null;
  }
}

// ---------------------------------------------------------------------------
// generic identity-preserving sync helpers
// ---------------------------------------------------------------------------
function syncMap<T extends { id: string }>(
  s: Record<string, any>, key: string, source: T[],
  write: (item: T, out: Record<string, any>) => void,
): void {
  const map: Record<string, any> = (s[key] && typeof s[key] === "object") ? s[key] : {};
  const seen = new Set<string>();
  for (const item of source) {
    seen.add(item.id);
    const out = map[item.id] ?? (map[item.id] = {});
    write(item, out);
  }
  for (const id of Object.keys(map)) if (!seen.has(id)) delete map[id];
  s[key] = map;
}

function syncArray<T extends { id: string }, F extends { id: string }>(
  s: Record<string, any>, key: string, source: T[],
  write: (item: T, out: Record<string, any>) => void,
): void {
  const existing: F[] = Array.isArray(s[key]) ? s[key] : [];
  const byId = new Map(existing.map(e => [e.id, e]));
  const next = source.map(item => {
    const out = (byId.get(item.id) as Record<string, any>) ?? {};
    write(item, out);
    return out as F;
  });
  if (Array.isArray(s[key])) { s[key].length = 0; s[key].push(...next); }
  else s[key] = next;
}

function mergeItems(prev: FacadeItem[], next: FacadeItem[]): FacadeItem[] {
  const byId = new Map(prev.map(p => [p.id, p]));
  return next.map(n => {
    const existing = byId.get(n.id);
    if (existing) { Object.assign(existing, n); return existing; }
    return n;
  });
}

function mapMerge<T extends { id: string }, F extends { id: string }>(
  real: T[], facade: F[], merge: (real: T, f: F) => T,
): T[] {
  const byId = new Map(facade.map(f => [f.id, f]));
  let anyChanged = false;
  const next = real.map(r => {
    const f = byId.get(r.id);
    if (!f) return r;
    const merged = merge(r, f);
    if (merged !== r) anyChanged = true;
    return merged;
  });
  return anyChanged ? next : real;
}

function sec(id: string, title: string, body: string, derived: boolean, note?: string) {
  return { id, title, body, complete: body.trim().length > 0, derived, note };
}

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "course";
}
