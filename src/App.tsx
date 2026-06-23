import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileArchive,
  FileText,
  Gauge,
  GripVertical,
  Home,
  Info,
  Layers,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  MoveRight,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wand2
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AssignmentsTab } from "./components/AssignmentsTab";
import { AuthScreen, type AuthScreenMode } from "./components/AuthScreen";
import { applySeo, pathToScreen, screenToPath } from "./seo";
import { ContactHoursTab } from "./components/ContactHoursTab";
import { DiscussionsTab } from "./components/DiscussionsTab";
import { ExportTab } from "./components/ExportTab";
import { GradebookTab } from "./components/GradebookTab";
import { HomepageTab } from "./components/HomepageTab";
import { OverviewTab } from "./components/OverviewTab";
import { PagesTab } from "./components/PagesTab";
import { PricingPage } from "./components/PricingPage";
import { QuizzesTab } from "./components/QuizzesTab";
import { RubricsTab } from "./components/RubricsTab";
import { SyllabusTab } from "./components/SyllabusTab";
import { AboutPage } from "./components/AboutPage";
import { GuidesPage } from "./components/GuidesPage";
import { ContactPage } from "./components/ContactPage";
import { DemoIntro } from "./components/DemoIntro";
import { DemoTour } from "./components/DemoTour";
import { LegalPage } from "./components/LegalPage";
import { IntegrationPage } from "./components/IntegrationPage";
import { TransformTab } from "./components/TransformTab";
import { PublicFooter } from "./components/PublicFooter";
import { useAuthSession, type AuthSessionState } from "./auth/useAuthSession";
import type { CourseBlueprint } from "./ai/blueprint";
import { buildCourseFromBlueprint, generateBlueprint, reviseHtmlWithAi } from "./services/aiGeneration";
import { buildThemeFromCustom, customThemesEnabled, listCustomThemes, saveCustomTheme, type CustomThemeInput } from "./services/customThemes";
import { openBillingPortal, startCheckout } from "./billing/checkout";
import { defaultSettings } from "./data/defaultSettings";
import type { Plan, PlanKey } from "./data/plans";
import { plans } from "./data/plans";
import { themes } from "./data/themes";
import { applyThemeToGeneratedContent, generateCourseProject, sampleProject } from "./services/courseGenerator";
import { buildCourseQualityReport } from "./services/courseQuality";
import { generateAllQuizzesQtiBlob, generateImsccBlob, generateQuizQtiBlob } from "./services/imsccExport";
import { coursePdfFileName, generateCoursePdfBlob } from "./services/coursePdf";
import {
  allQuizzesAnswerKeyPdfFileName,
  allQuizzesStudentPdfFileName,
  buildAllQuizzesAnswerKeyPdfBlob,
  buildAllQuizzesStudentPdfBlob,
  buildQuizAnswerKeyPdfBlob,
  buildQuizStudentPdfBlob,
  quizAnswerKeyPdfFileName,
  quizStudentPdfFileName
} from "./services/quizPdf";
import { buildSyllabusPdfBlob, syllabusPdfFileName } from "./services/syllabusPdf";
import { augmentPromptWithSources, parseSourceFile } from "./services/sourceParsing";
import { importCanvasCourseFromImscc } from "./services/imsccImport";
import {
  duplicateModuleWithContent,
  getModuleItemTarget,
  itemCountsForModule,
  moduleItemTypeLabel,
  moveModuleItem,
  removeModule,
  validateModulePlan,
  type ModulePreviewFilter
} from "./services/modulePlanner";
import { reviseCourseObject, type RevisionMode } from "./services/objectRevision";
import { listProjects, persistenceEnabled, saveProject } from "./services/projectStore";
import { buildReadinessReport } from "./services/readiness";
import { buildThemePreviewHtml, getThemeStyles, validateTheme, type ThemePreviewKind } from "./services/themeDesign";
import type {
  CourseModule,
  CoursePage,
  CourseProject,
  CourseSettings,
  Discussion,
  ExportMode,
  ExportValidationReport,
  ModuleItem,
  ObjectMetadata,
  Quiz,
  ReadinessCheck,
  Rubric,
  Screen,
  SourceFile,
  Theme
} from "./types";

const progressSteps = [
  "Reading course prompt and uploads",
  "Building course blueprint",
  "Creating learning objectives",
  "Designing modules",
  "Creating assignments and discussions",
  "Creating quizzes and rubrics",
  "Building homepage and syllabus",
  "Preparing Canvas export structure",
  "Validating course package"
];

const editorTabs = [
  "Overview",
  "Homepage",
  "Syllabus",
  "Modules",
  "Pages",
  "Assignments",
  "Discussions",
  "Quizzes",
  "Rubrics",
  "Gradebook Setup",
  "Contact Hours",
  "Theme",
  "Transform",
  "Export"
] as const;

type EditorTab = (typeof editorTabs)[number];

const weekdayOptions = ["0", "1", "2", "3", "4", "5", "6"];
const weekdayLabels: Record<string, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday"
};

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
};

const renumberModules = (modules: CourseModule[]): CourseModule[] =>
  modules.map((module, index) => ({ ...module, order: index, status: "edited" }));

const editMetadata = (): ObjectMetadata => ({
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  exportVersion: 0,
  source: "edited"
});

const lengthPresetWeeks: Record<CourseSettings["courseLengthPreset"], number> = {
  "4-weeks": 4,
  "6-weeks": 6,
  "8-weeks": 8,
  "12-weeks": 12,
  "15-weeks": 15,
  "16-weeks": 16,
  maymester: 3,
  custom: defaultSettings.lengthWeeks
};

function App() {
  const [screen, setScreen] = useState<Screen>(() => pathToScreen(window.location.pathname));
  const [projects, setProjects] = useState<CourseProject[]>([sampleProject]);
  const [course, setCourse] = useState<CourseProject>(sampleProject);
  const [settings, setSettings] = useState<CourseSettings>(defaultSettings);
  const [prompt, setPrompt] = useState(sampleProject.prompt);
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>("Overview");
  const auth = useAuthSession();
  const [authMode, setAuthMode] = useState<AuthScreenMode>("login");
  // Real export entitlement, derived from the trusted subscription snapshot — no fake toggle.
  const subscriptionActive = auth.entitlement.canExport;
  const [validationReport, setValidationReport] = useState<ExportValidationReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastDownloadName, setLastDownloadName] = useState<string | null>(null);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ moduleId: string; itemId: string } | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>(sampleProject.exportMode);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PlanKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Demo mode: the public, pre-populated sample course explored without AI/account. `demoActive`
  // turns on the demo chrome (banner + Back to Home) in the editor; `tourOpen` runs the walkthrough.
  const [demoActive, setDemoActive] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // The public sample course is freely exportable inside the demo (the .imscc/QTI/PDF packages are
  // built entirely in the browser from in-browser data — no server secret is involved). Real
  // user-generated courses still require a paid plan; the costly server-side AI stays entitlement-gated.
  const exportAllowed = subscriptionActive || demoActive;

  const readiness = useMemo(() => buildReadinessReport(course), [course]);
  const quality = useMemo(() => buildCourseQualityReport(course), [course]);
  const homepage = course.pages.find((page) => page.frontPage) ?? course.pages[0];
  const syllabus = course.pages.find((page) => page.slug === "syllabus") ?? course.pages[1];

  useEffect(() => {
    if (screen !== "progress") return;
    if (progressIndex >= progressSteps.length) {
      const base = generateCourseProject({ prompt: augmentPromptWithSources(prompt, settings.sourceFiles), settings });
      // The generator derives its id from the title slug, so two courses with the same title (or a
      // generation that falls back to the default title) collide with the public sample. Give every
      // generated project a unique id so it persists as its own row and never shadows the sample.
      const generated: CourseProject = { ...base, id: `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}` };
      setCourse(generated);
      setProjects((current) => [generated, ...current.filter((project) => project.id !== generated.id)]);
      setValidationReport(null);
      setImportNotes([]);
      setExportMode(generated.exportMode);
      setActiveTab("Overview");
      setDemoActive(false);
      setTourOpen(false);
      setScreen("editor");
      return;
    }
    const timer = window.setTimeout(() => setProgressIndex((index) => index + 1), 420);
    return () => window.clearTimeout(timer);
  }, [progressIndex, prompt, screen, settings]);

  // Route guard: the authenticated dashboard requires a session. Unauthenticated users are sent
  // to sign in. (Landing, pricing, and the public sample editor stay open.) Once a session exists,
  // leave the auth screens for the dashboard.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session && screen === "dashboard") {
      setAuthMode("login");
      setScreen("login");
    }
    if (auth.session && (screen === "login" || screen === "signup")) {
      setScreen("dashboard");
    }
  }, [auth.loading, auth.session, screen]);

  // Returning from Stripe Checkout (?checkout=success|cancel): refresh the subscription so the new
  // plan shows, land on the dashboard, and strip the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;
    if (checkout === "success" && auth.session) {
      void auth.refreshSubscription();
      setScreen("dashboard");
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [auth.session]);

  // Keep the URL + document head in sync with the active screen so marketing pages have real,
  // shareable, indexable URLs and correct per-page SEO. In-app screens collapse to /app.
  useEffect(() => {
    applySeo(screen);
    const current = window.location.pathname.replace(/\/+$/, "") || "/";
    // Integration is a family of /integration/<lms> URLs reached by full navigation; keep the
    // current path rather than collapsing every one of them to the hub.
    const desired = screen === "integration" ? current : screenToPath(screen);
    if (current !== (desired.replace(/\/+$/, "") || "/")) {
      window.history.pushState({ screen }, "", desired);
    }
  }, [screen]);

  // Back/forward buttons: restore the screen from the URL.
  useEffect(() => {
    const onPopState = () => setScreen(pathToScreen(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Load the signed-in user's saved projects from Supabase (replacing the local sample list).
  useEffect(() => {
    if (!auth.session || !persistenceEnabled()) return;
    let active = true;
    void listProjects().then((loaded) => {
      if (active && loaded.length) setProjects(loaded);
    });
    return () => {
      active = false;
    };
  }, [auth.session]);

  // Load the user's saved custom (school) themes so they appear in the theme library.
  useEffect(() => {
    if (!auth.session || !customThemesEnabled()) return;
    let active = true;
    void listCustomThemes().then((saved) => {
      if (active) setCustomThemes(saved.map((entry) => entry.theme));
    });
    return () => {
      active = false;
    };
  }, [auth.session]);

  const handleSaveCustomTheme = async (
    input: CustomThemeInput
  ): Promise<{ ok: boolean; theme?: Theme; error?: string }> => {
    const result = await saveCustomTheme(input);
    if (result.ok && result.theme) {
      const saved = result.theme;
      setCustomThemes((current) => [saved, ...current.filter((theme) => theme.id !== saved.id)]);
    }
    return result;
  };

  // Autosave the open course (debounced) for signed-in users who can create private projects.
  // The public sample course is never persisted to an account.
  useEffect(() => {
    if (!auth.session || !persistenceEnabled()) return;
    if (course.id === sampleProject.id) return;
    if (!auth.entitlement.canCreateProject) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void saveProject(course).then((result) => setSaveState(result.ok ? "saved" : "error"));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [course, auth.session, auth.entitlement.canCreateProject]);

  const updateCourse = (updater: (current: CourseProject) => CourseProject): void => {
    setCourse((current) => {
      const updatedAt = new Date().toISOString();
      const updated = { ...updater(current), updatedAt, status: "edited" as const, metadata: { ...current.metadata, updatedAt, source: "edited" as const } };
      setProjects((projectList) => projectList.map((project) => (project.id === updated.id ? updated : project)));
      return updated;
    });
    setValidationReport(null);
  };

  const updateSettings = <K extends keyof CourseSettings>(key: K, value: CourseSettings[K]): void => {
    setSettings((current) => {
      if (key === "courseLengthPreset" && typeof value === "string" && value !== "custom") {
        const weeks = lengthPresetWeeks[value as CourseSettings["courseLengthPreset"]];
        return { ...current, [key]: value, lengthWeeks: weeks, moduleCount: Math.max(1, weeks) };
      }
      return { ...current, [key]: value };
    });
  };

  const startGeneration = (): void => {
    setProgressIndex(0);
    setScreen("progress");
  };

  // Real AI: generate a blueprint server-side (auth + entitlement enforced there), then show it for
  // approval. Falls back with a friendly error if the AI route is unreachable or denied.
  const handleGenerateBlueprint = async (): Promise<void> => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await generateBlueprint(augmentPromptWithSources(prompt, settings.sourceFiles), settings);
      setBlueprint(result);
      setScreen("blueprint");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Blueprint generation failed.");
    } finally {
      setAiBusy(false);
    }
  };

  // Approve the blueprint → build a full, export-valid course seeded by it, then open the editor.
  const approveBlueprint = (): void => {
    if (!blueprint) return;
    const generated = buildCourseFromBlueprint(blueprint, settings, prompt);
    setCourse(generated);
    setProjects((current) => [generated, ...current.filter((project) => project.id !== generated.id)]);
    setValidationReport(null);
    setImportNotes([]);
    setExportMode(generated.exportMode);
    setActiveTab("Overview");
    setDemoActive(false);
    setTourOpen(false);
    setScreen("editor");
  };

  // Pricing CTA. Free routes to the public demo intro. Paid plans require an account —
  // an unauthenticated user is sent to sign up first. Authenticated users in real (Supabase) mode go
  // to Stripe Checkout; in local dev mode (no Supabase) choosing a plan simulates activation so the
  // offline demo still works. Contact-sales uses the mailto link in the card.
  const handleChoosePlan = (plan: Plan): void => {
    setCheckoutError(null);
    if (plan.checkoutMode === "free" || plan.checkoutMode === "contact") {
      if (plan.checkoutMode === "free") setScreen("demo");
      return;
    }
    if (!auth.session) {
      setAuthMode("signup");
      setScreen("signup");
      return;
    }
    if (auth.authMode === "local") {
      void auth.devSetPlan(plan.key).then(() => setScreen("dashboard"));
      return;
    }
    // Real Stripe Checkout — redirects the browser to the hosted Stripe page on success.
    setCheckoutBusyPlan(plan.key);
    void startCheckout(plan.key).then((result) => {
      if (!result.ok) {
        setCheckoutError(result.error ?? "Could not start checkout.");
        setCheckoutBusyPlan(null);
      }
      // On success the browser navigates away to Stripe; no further UI update needed.
    });
  };

  const handleOpenBillingPortal = (): void => {
    setCheckoutError(null);
    void openBillingPortal().then((result) => {
      if (!result.ok) setCheckoutError(result.error ?? "Could not open billing portal.");
    });
  };

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return;
    const fileList = Array.from(files);
    const imsccFile = fileList.find((file) => /\.imscc$/i.test(file.name));
    if (imsccFile) {
      const result = await importCanvasCourseFromImscc(imsccFile, settings);
      setCourse(result.course);
      setProjects((current) => [result.course, ...current.filter((project) => project.id !== result.course.id)]);
      setImportNotes(result.notes);
      setExportMode(result.course.exportMode);
      setValidationReport(null);
      setActiveTab("Overview");
      setDemoActive(false);
      setTourOpen(false);
      setScreen("editor");
      return;
    }

    // Show the files immediately as "parsing", then extract real text in the background and update
    // each one's status + extracted text so generation can actually use the content.
    const stamped = fileList.map((file, index) => ({
      file,
      id: `source_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`
    }));
    const pending: SourceFile[] = stamped.map(({ file, id, sizeLabel }) => ({
      id,
      name: file.name,
      sizeLabel,
      status: "parsing"
    }));
    setSettings((current) => ({ ...current, sourceFiles: [...current.sourceFiles, ...pending] }));

    await Promise.all(
      stamped.map(async ({ file, id, sizeLabel }) => {
        const parsed = await parseSourceFile(file);
        const updated: SourceFile = {
          id,
          name: file.name,
          sizeLabel,
          status: parsed.status,
          kind: parsed.kind,
          text: parsed.text,
          chars: parsed.chars,
          preview: parsed.preview,
          note: parsed.note
        };
        setSettings((current) => ({
          ...current,
          sourceFiles: current.sourceFiles.map((source) => (source.id === id ? updated : source))
        }));
      })
    );
  };

  // Add pasted source material (syllabus text, outcomes, readings, notes) as a parsed source.
  const handlePasteSource = (text: string): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const source: SourceFile = {
      id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Pasted notes (${new Date().toLocaleDateString()})`,
      sizeLabel: `${Math.max(1, Math.round(trimmed.length / 1024))} KB`,
      status: "parsed",
      kind: "paste",
      text: trimmed.slice(0, 20_000),
      chars: trimmed.length,
      preview: trimmed.replace(/\s+/g, " ").slice(0, 600)
    };
    setSettings((current) => ({ ...current, sourceFiles: [...current.sourceFiles, source] }));
  };

  const handleRemoveSource = (id: string): void => {
    setSettings((current) => ({ ...current, sourceFiles: current.sourceFiles.filter((source) => source.id !== id) }));
  };

  const reorderModule = (targetId: string): void => {
    if (!draggedModuleId || draggedModuleId === targetId) return;
    updateCourse((current) => {
      const fromIndex = current.modules.findIndex((module) => module.id === draggedModuleId);
      const toIndex = current.modules.findIndex((module) => module.id === targetId);
      return { ...current, modules: renumberModules(moveItem(current.modules, fromIndex, toIndex)) };
    });
    setDraggedModuleId(null);
  };

  const reorderModuleItem = (targetModuleId: string, targetItemId?: string): void => {
    if (!draggedItem) return;
    updateCourse((current) => moveModuleItem(current, draggedItem, targetModuleId, targetItemId));
    setDraggedItem(null);
  };

  const duplicateModule = (moduleId: string): void => {
    updateCourse((current) => duplicateModuleWithContent(current, moduleId));
  };

  const deleteModule = (moduleId: string, moveItemsToModuleId?: string): void => {
    updateCourse((current) => removeModule(current, moduleId, moveItemsToModuleId));
  };

  // AI revise (real, server-side). Tries the secured revise function (auth + entitlement enforced
  // there) and falls back to the deterministic reviser when the AI route is unreachable/denied.
  const reviseActiveContent = async (mode: RevisionMode): Promise<void> => {
    if (mode === "rubric") {
      const assignment = course.assignments[0];
      if (!assignment) return;
      const result = await reviseHtmlWithAi({
        courseTitle: course.title,
        objectType: "assignment",
        title: assignment.title,
        html: assignment.descriptionHtml,
        mode,
        context: {
          outcomeCodes: assignment.alignedOutcomeIds.map((outcomeId) => course.outcomes.find((outcome) => outcome.id === outcomeId)?.code ?? outcomeId),
          moduleTitle: course.modules.find((module) => module.id === assignment.moduleId)?.title,
          futureProvider: "server-side-ai"
        }
      });
      updateCourse((current) => ({
        ...current,
        assignments: current.assignments.map((item) =>
          item.id === assignment.id ? { ...item, descriptionHtml: result.value, status: "edited", metadata: editMetadata() } : item
        )
      }));
      return;
    }

    const targetPage = activeTab === "Syllabus" ? syllabus : homepage;
    const result = await reviseHtmlWithAi({
      courseTitle: course.title,
      objectType: "page",
      title: targetPage.title,
      html: targetPage.bodyHtml,
      mode,
      context: {
        outcomeCodes: course.outcomes.slice(0, 3).map((outcome) => outcome.code),
        moduleTitle: course.modules.find((module) => module.id === targetPage.moduleId)?.title,
        futureProvider: "server-side-ai"
      }
    });
    updateCourse((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === targetPage.id ? { ...page, bodyHtml: result.value, status: "edited", metadata: editMetadata() } : page))
    }));
  };

  // Build + validate the package locally without downloading. Separating validation from download
  // keeps the workflow honest: the user can inspect the local report before committing to a file.
  const runValidation = async (): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    try {
      const { report } = await generateImsccBlob({ ...course, exportMode }, exportMode);
      setValidationReport(report);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Local validation failed unexpectedly.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPackage = async (): Promise<void> => {
    if (!exportAllowed) return;
    setIsExporting(true);
    setExportError(null);
    setLastDownloadName(null);
    try {
      const { blob, report, fileName } = await generateImsccBlob({ ...course, exportMode }, exportMode);
      setValidationReport(report);
      if (!report.valid) {
        setExportError("Local validation found blocking issues. Resolve them before downloading.");
        return;
      }
      downloadBlob(blob, fileName);
      setLastDownloadName(fileName);
      const exportedAt = new Date().toISOString();
      updateCourse((current) => ({
        ...current,
        status: "exported",
        exportMode,
        exportHistory: [
          { id: `export_${Date.now()}`, exportedAt, fileName, mode: exportMode, validationScore: report.score },
          ...current.exportHistory
        ],
        pages: current.pages.map((page) => ({ ...page, metadata: { ...page.metadata, lastExportedAt: exportedAt, exportVersion: page.metadata.exportVersion + 1 } })),
        assignments: current.assignments.map((assignment) => ({ ...assignment, metadata: { ...assignment.metadata, lastExportedAt: exportedAt, exportVersion: assignment.metadata.exportVersion + 1 } })),
        discussions: current.discussions.map((discussion) => ({ ...discussion, metadata: { ...discussion.metadata, lastExportedAt: exportedAt, exportVersion: discussion.metadata.exportVersion + 1 } })),
        quizzes: current.quizzes.map((quiz) => ({ ...quiz, metadata: { ...quiz.metadata, lastExportedAt: exportedAt, exportVersion: quiz.metadata.exportVersion + 1 } }))
      }));
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed unexpectedly.");
    } finally {
      setIsExporting(false);
    }
  };

  // Download a readable PDF copy of the whole course (no Canvas import needed).
  const downloadCoursePdf = (): void => {
    if (!exportAllowed) return;
    downloadBlob(generateCoursePdfBlob(course), coursePdfFileName(course));
  };

  // Download a clean PDF of the syllabus (aligned with the Canvas syllabus page).
  const downloadSyllabusPdf = (): void => {
    if (!exportAllowed) return;
    downloadBlob(buildSyllabusPdfBlob(course), syllabusPdfFileName(course));
  };

  // Download every quiz as one bulk Canvas-importable QTI .zip.
  const downloadAllQuizzesQti = async (): Promise<void> => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    const { blob, fileName } = await generateAllQuizzesQtiBlob(course);
    downloadBlob(blob, fileName);
  };

  // Download a single quiz as a standalone QTI .zip.
  const downloadQuizQti = async (quiz: Quiz): Promise<void> => {
    if (!exportAllowed) return;
    const { blob, fileName } = await generateQuizQtiBlob(quiz);
    downloadBlob(blob, fileName);
  };

  // Printable quiz PDFs — student copy and instructor answer key (single + combined).
  const downloadQuizStudentPdf = (quiz: Quiz): void => {
    if (!exportAllowed) return;
    downloadBlob(buildQuizStudentPdfBlob(course, quiz), quizStudentPdfFileName(course, quiz));
  };
  const downloadQuizAnswerKeyPdf = (quiz: Quiz): void => {
    if (!exportAllowed) return;
    downloadBlob(buildQuizAnswerKeyPdfBlob(course, quiz), quizAnswerKeyPdfFileName(course, quiz));
  };
  const downloadAllQuizzesStudentPdf = (): void => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    downloadBlob(buildAllQuizzesStudentPdfBlob(course), allQuizzesStudentPdfFileName(course));
  };
  const downloadAllQuizzesAnswerKeyPdf = (): void => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    downloadBlob(buildAllQuizzesAnswerKeyPdfBlob(course), allQuizzesAnswerKeyPdfFileName(course));
  };

  // Enter the public demo: load the static sample course, turn on demo chrome, optionally start the
  // guided tour. No AI, no account, nothing persisted.
  const enterDemo = (withTour: boolean): void => {
    setCourse(sampleProject);
    setExportMode(sampleProject.exportMode);
    setValidationReport(null);
    setImportNotes([]);
    setActiveTab("Overview");
    setDemoActive(true);
    setTourOpen(withTour);
    setScreen("editor");
  };

  const exitDemo = (): void => {
    setDemoActive(false);
    setTourOpen(false);
    setScreen("landing");
  };

  return (
    <div className="app">
      <TopBar
        screen={screen}
        onNavigate={setScreen}
        auth={auth}
        onSignIn={() => {
          setAuthMode("login");
          setScreen("login");
        }}
        onDemo={() => setScreen("demo")}
      />

      {screen === "landing" && (
        <>
          <Landing
            onStart={() => (auth.session ? setScreen("intake") : setScreen("signup"))}
            onDashboard={() => setScreen(auth.session ? "dashboard" : "login")}
            onPricing={() => setScreen("pricing")}
            onTryDemo={() => setScreen("demo")}
            onGuides={() => setScreen("guides")}
          />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "pricing" && (
        <>
          <PricingPage
            onChoosePlan={handleChoosePlan}
            onTryDemo={() => setScreen("demo")}
            currentPlanKey={auth.entitlement.planKey}
            busyPlanKey={checkoutBusyPlan}
            error={checkoutError}
          />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "about" && (
        <>
          <AboutPage
            onStartBuilding={() => (auth.session ? setScreen("intake") : setScreen("signup"))}
            onTryDemo={() => setScreen("demo")}
            onContact={() => setScreen("contact")}
          />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "guides" && (
        <>
          <GuidesPage onTryDemo={() => setScreen("demo")} onStartBuilding={() => (auth.session ? setScreen("intake") : setScreen("signup"))} />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "contact" && (
        <>
          <ContactPage />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "demo" && (
        <>
          <DemoIntro onStartTour={() => enterDemo(true)} onExplore={() => enterDemo(false)} onBackHome={() => setScreen("landing")} />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {(screen === "terms" || screen === "privacy") && (
        <>
          <LegalPage kind={screen} onContact={() => setScreen("contact")} />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "integration" && (
        <>
          <IntegrationPage
            onStartBuilding={() => (auth.session ? setScreen("intake") : setScreen("signup"))}
            onTryDemo={() => setScreen("demo")}
          />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {(screen === "login" || screen === "signup") && (
        <AuthScreen
          mode={authMode}
          onModeChange={(mode) => {
            setAuthMode(mode);
            setScreen(mode);
          }}
          isLocalMode={auth.authMode === "local"}
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
          onCancel={() => setScreen("landing")}
        />
      )}
      {screen === "dashboard" && auth.session && (
        <Dashboard
          projects={projects}
          entitlement={auth.entitlement}
          onCreate={() => setScreen("intake")}
          onPricing={() => setScreen("pricing")}
          onRefreshStatus={auth.refreshSubscription}
          onBillingPortal={handleOpenBillingPortal}
          billingError={checkoutError}
          onOpen={(project) => {
            setDemoActive(false);
            setTourOpen(false);
            setCourse(project);
            setExportMode(project.exportMode);
            setImportNotes([]);
            setValidationReport(null);
            setScreen("editor");
          }}
        />
      )}
      {screen === "intake" && (
        <Intake
          prompt={prompt}
          settings={settings}
          onPromptChange={setPrompt}
          onSettingsChange={updateSettings}
          onFiles={handleFiles}
          onPasteSource={handlePasteSource}
          onRemoveSource={handleRemoveSource}
          onGenerate={startGeneration}
          canUseAi={auth.entitlement.canGenerate}
          isAuthed={Boolean(auth.session)}
          onGenerateBlueprint={() => void handleGenerateBlueprint()}
          aiBusy={aiBusy}
          aiError={aiError}
          onUpgrade={() => setScreen(auth.session ? "pricing" : "signup")}
        />
      )}
      {screen === "blueprint" && blueprint && (
        <BlueprintReview
          blueprint={blueprint}
          busy={aiBusy}
          error={aiError}
          onApprove={approveBlueprint}
          onRegenerate={() => void handleGenerateBlueprint()}
          onBack={() => setScreen("intake")}
        />
      )}
      {screen === "progress" && <Progress progressIndex={progressIndex} />}
      {screen === "editor" && (
        <Editor
          course={course}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          readiness={readiness}
          quality={quality}
          subscriptionActive={exportAllowed}
          validationReport={validationReport}
          isExporting={isExporting}
          draggedModuleId={draggedModuleId}
          onDragModule={setDraggedModuleId}
          onDropModule={reorderModule}
          onDragItem={setDraggedItem}
          onDropItem={reorderModuleItem}
          onUpdateCourse={updateCourse}
          onRunValidation={runValidation}
          onDownload={downloadPackage}
          onDownloadPdf={downloadCoursePdf}
          onDownloadSyllabusPdf={downloadSyllabusPdf}
          onDownloadAllQti={downloadAllQuizzesQti}
          onExportQuizQti={downloadQuizQti}
          onExportQuizStudentPdf={downloadQuizStudentPdf}
          onExportQuizAnswerKeyPdf={downloadQuizAnswerKeyPdf}
          onDownloadAllQuizzesStudentPdf={downloadAllQuizzesStudentPdf}
          onDownloadAllQuizzesAnswerKeyPdf={downloadAllQuizzesAnswerKeyPdf}
          exportError={exportError}
          lastDownloadName={lastDownloadName}
          onDuplicateModule={duplicateModule}
          onDeleteModule={deleteModule}
          onRevise={reviseActiveContent}
          exportMode={exportMode}
          onExportModeChange={setExportMode}
          importNotes={importNotes}
          saveState={auth.session && course.id !== sampleProject.id ? saveState : "idle"}
          customThemes={customThemes}
          canCreateCustomTheme={auth.entitlement.canCreateCustomTheme}
          onSaveCustomTheme={handleSaveCustomTheme}
          demoMode={demoActive}
          onExitDemo={exitDemo}
        />
      )}
      {screen === "editor" && demoActive && tourOpen && (
        <DemoTour onSetTab={setActiveTab} onClose={() => setTourOpen(false)} />
      )}
    </div>
  );
}

function TopBar({
  screen,
  onNavigate,
  auth,
  onSignIn,
  onDemo
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  auth: AuthSessionState;
  onSignIn: () => void;
  onDemo: () => void;
}) {
  const { session, entitlement } = auth;
  const cls = (active: boolean): string => (active ? "active" : "");
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNavigate("landing")} aria-label="Open RocketCourse home page">
        <span className="brand-mark">RC</span>
        <span>
          <strong>RocketCourse</strong>
          <small>Canvas Builder</small>
        </span>
      </button>
      <nav className="topnav" aria-label="Primary">
        <button className={cls(screen === "landing")} onClick={() => onNavigate("landing")}>
          <Home size={16} /> Home
        </button>
        <button className={cls(screen === "demo")} onClick={onDemo}>
          <PanelLeft size={16} /> Demo
        </button>
        <button className={cls(screen === "pricing")} onClick={() => onNavigate("pricing")}>
          <CreditCard size={16} /> Pricing
        </button>
        <button className={cls(screen === "guides")} onClick={() => onNavigate("guides")}>
          <BookOpen size={16} /> Guides
        </button>
        <button className={cls(screen === "about")} onClick={() => onNavigate("about")}>
          <Info size={16} /> About
        </button>
        <button className={cls(screen === "contact")} onClick={() => onNavigate("contact")}>
          <Mail size={16} /> Contact
        </button>
        {session && (
          <>
            <button className={cls(screen === "dashboard")} onClick={() => onNavigate("dashboard")}>
              <LayoutDashboard size={16} /> Dashboard
            </button>
            <button className={cls(screen === "intake")} onClick={() => onNavigate("intake")}>
              <Wand2 size={16} /> Create
            </button>
          </>
        )}
      </nav>
      <div className="topbar-account">
        {session ? (
          <>
            <span className={`plan-badge ${entitlement.active ? "active" : "free"}`} title={`Plan: ${entitlement.planName}`}>
              {entitlement.active ? <CheckCircle2 size={14} /> : <Lock size={14} />}
              {entitlement.planName}
            </span>
            {auth.authMode === "local" && <DevPlanSwitcher auth={auth} />}
            <div className="account-menu">
              <span className="account-email" title={session.user.email}>
                {session.user.email}
              </span>
              <button className="ghost-button" onClick={() => void auth.signOut().then(() => onNavigate("landing"))}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <button className="signin-button" onClick={onSignIn}>
            <User size={15} /> Sign in
          </button>
        )}
      </div>
    </header>
  );
}

// DEV ONLY (local mode): lets the operator simulate a plan so the demo flow works end-to-end
// without Stripe/Supabase. Hidden entirely once Supabase + Stripe are configured.
function DevPlanSwitcher({ auth }: { auth: AuthSessionState }) {
  return (
    <label className="dev-plan-switcher" title="Local dev only — simulate a subscription plan">
      <span>DEV plan</span>
      <select
        value={auth.entitlement.planKey}
        onChange={(event) => void auth.devSetPlan(event.target.value as PlanKey)}
      >
        {plans.map((plan) => (
          <option key={plan.key} value={plan.key}>
            {plan.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const howItWorks = [
  {
    icon: Wand2,
    title: "Prompt & configure",
    body: "Describe your course, then set level, length, modules, assessments, and schedule. Start fresh or upload a syllabus or an existing Canvas .imscc export."
  },
  {
    icon: Sparkles,
    title: "Generate & edit",
    body: "RocketCourse builds modules, pages, assignments, discussions, quizzes, and rubrics as native Canvas objects you can edit, reorder, and refine."
  },
  {
    icon: FileArchive,
    title: "Validate & export",
    body: "Check readiness and instructional quality, then download a locally validated, Canvas-oriented .imscc package to import and verify in a Canvas sandbox."
  }
] as const;

const landingFeatures = [
  {
    icon: BookOpen,
    tone: "cyan",
    title: "Canvas-native structure",
    body: "Homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, outcomes, and gradebook groups — generated as real Canvas objects."
  },
  {
    icon: PenLine,
    tone: "pink",
    title: "Editable before export",
    body: "Tighten a page, reorder a module, or adjust workload without rebuilding the whole course. Your edits are preserved."
  },
  {
    icon: Gauge,
    tone: "orange",
    title: "Readiness scoring",
    body: "A live readiness and instructional-quality score shows exactly what needs attention before you export."
  },
  {
    icon: ShieldCheck,
    tone: "success",
    title: "Local IMSCC validation",
    body: "Manifest, module metadata, references, and HTML are checked locally before you download the package."
  },
  {
    icon: Palette,
    tone: "orchid",
    title: "Cohesive themes",
    body: "Apply a visual theme across generated content while preserving anything you've edited by hand."
  },
  {
    icon: Clock,
    tone: "yellow",
    title: "Workload & accessibility",
    body: "Plan contact hours and keep accessibility-minded structure baked into the generated Canvas HTML."
  }
] as const;

function Landing({
  onStart,
  onDashboard,
  onPricing,
  onTryDemo,
  onGuides
}: {
  onStart: () => void;
  onDashboard: () => void;
  onPricing: () => void;
  onTryDemo: () => void;
  onGuides: () => void;
}) {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="hero-badge">
            <Sparkles size={15} /> Canvas-first course builder for instructors & designers
          </span>
          <h1>
            Turn a course idea into an editable <span className="gradient-text">Canvas course</span>.
          </h1>
          <p>
            RocketCourse turns a topic, syllabus, notes, readings, or an existing Canvas export into a structured,
            editable course shell — homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, and
            gradebook groups — then locally validates and exports a Canvas-oriented <strong>.imscc</strong> package.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onStart}>
              <Sparkles size={18} /> Build your first course
            </button>
            <button className="secondary" onClick={onTryDemo}>
              <PanelLeft size={17} /> Try the demo
            </button>
            <button className="secondary" onClick={onPricing}>
              <CreditCard size={17} /> View pricing
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <CheckCircle2 size={16} /> Canvas-native objects
            </span>
            <span>
              <CheckCircle2 size={16} /> Editable before export
            </span>
            <span>
              <CheckCircle2 size={16} /> Real .imscc download
            </span>
          </div>
        </div>
        <section className="product-preview" aria-label="RocketCourse workflow preview">
          <div className="preview-header">
            <span>AI and Modern Society</span>
            <strong>Readiness 94%</strong>
          </div>
          <div className="preview-grid">
            <div>
              <h2>Canvas-native structure</h2>
              <p>Homepage, syllabus, Start Here, modules, pages, assignments, discussions, quizzes, rubrics, and gradebook groups.</p>
            </div>
            <div>
              <h2>Editable before export</h2>
              <p>Revise a page, reorder a module, or adjust workload without rebuilding the whole course.</p>
            </div>
            <div>
              <h2>IMSCC package check</h2>
              <p>Manifest, module metadata, references, HTML, and package files are validated before download.</p>
            </div>
          </div>
        </section>
      </section>

      <section className="landing-section" aria-labelledby="problem-heading">
        <span className="section-eyebrow">The problem</span>
        <h2 id="problem-heading">The blank Canvas shell is where courses stall</h2>
        <p>
          A new Canvas course opens empty. Before any teaching happens, someone has to build the homepage, write the
          syllabus, lay out modules, draft pages, create assignments and discussions, write quizzes and rubrics, set up
          gradebook groups, and wire it all together — then copy and paste it into Canvas, piece by piece. That setup
          labor is repetitive, time-consuming, and easy to do inconsistently.
        </p>
        <p>
          RocketCourse removes the blank-shell burden. You start from your own topic, syllabus, readings, or prompt and
          get a structured first draft you can edit — so you spend your time on teaching, quality, accessibility, and the
          student experience instead of scaffolding.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="audience-heading">
        <span className="section-eyebrow">Who it's for</span>
        <h2 id="audience-heading">Built for everyone who shapes a Canvas course</h2>
        <p>RocketCourse is for any instructor building any course — and the people who help them do it well.</p>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon cyan"><User size={22} /></span>
            <h3>Instructors & faculty</h3>
            <p>Get a strong, consistent starting point for a new or redesigned course without rebuilding structure from scratch every term.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orchid"><Palette size={22} /></span>
            <h3>Instructional designers</h3>
            <p>Skip the repetitive shell-building and spend your expertise on alignment, quality, accessibility, and improvement.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon orange"><Layers size={22} /></span>
            <h3>Instructional technologists</h3>
            <p>Hand faculty a clean, Canvas-oriented package and a consistent baseline that's easy to support and review.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon success"><BookOpen size={22} /></span>
            <h3>Departments & institutions</h3>
            <p>Bring consistency to course structure across sections and programs, while keeping every course editable and owned by its instructor.</p>
          </article>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="student-heading">
        <span className="section-eyebrow">Why it matters</span>
        <h2 id="student-heading">A clearer course for students, a faster start for you</h2>
        <p>
          Consistent navigation, predictable module structure, understandable instructions, and professional-looking
          pages reduce course confusion — so students spend less energy figuring out where things are and more on
          learning. Designers and technologists get a clean baseline to improve, not a blank page to rescue.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="how-heading">
        <span className="section-eyebrow">How it works</span>
        <h2 id="how-heading">From prompt to Canvas package in three steps</h2>
        <p>A guided, calm flow that keeps you in control of every object before anything is exported.</p>
        <div className="how-grid">
          {howItWorks.map((step, index) => (
            <article className="step-card" key={step.title}>
              <span className="step-line" />
              <span className="step-index">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="features-heading">
        <span className="section-eyebrow">What you get</span>
        <h2 id="features-heading">Everything a Canvas course needs, structured for you</h2>
        <p>Powerful where it counts, simple everywhere else — no fake AI claims, just a fast, honest build.</p>
        <div className="feature-grid">
          {landingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="feature-card" key={feature.title}>
                <span className={`feature-icon ${feature.tone}`}>
                  <Icon size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-demo-invite" aria-labelledby="demo-invite-heading">
        <span className="section-eyebrow">See it in action</span>
        <h2 id="demo-invite-heading">Explore the AI and Modern Society demo</h2>
        <p>
          Poke around a fully built sample course — every tab, the readiness scoring, and the export flow — with no
          sign-in and no AI credits used. It's the fastest way to see how RocketCourse structures a Canvas course before
          you build your own.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={onTryDemo}>
            <PanelLeft size={18} /> Open the demo
          </button>
          <button className="secondary" onClick={onGuides}>
            <BookOpen size={17} /> Read the guides
          </button>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="pricing-teaser-heading">
        <span className="section-eyebrow">Pricing</span>
        <h2 id="pricing-teaser-heading">Start free, upgrade when you're ready to build your own</h2>
        <p>
          The demo is free and uses no AI. Paid plans unlock AI course generation and private Canvas exports for
          instructors, designers, and whole departments. Export and AI limits are enforced on the server against your
          subscription — never the browser.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={onPricing}>
            <CreditCard size={18} /> View pricing <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="landing-cta">
        <h2>Ready to build your next Canvas course?</h2>
        <p>Start from a prompt, a syllabus, or an existing export, edit everything, and ship a validated package.</p>
        <div className="hero-actions">
          <button className="primary" onClick={onStart}>
            <Sparkles size={18} /> Build your first course <ArrowRight size={17} />
          </button>
          <button className="secondary" onClick={onDashboard}>
            <LayoutDashboard size={17} /> Go to dashboard
          </button>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  projects,
  entitlement,
  onCreate,
  onPricing,
  onRefreshStatus,
  onBillingPortal,
  billingError,
  onOpen
}: {
  projects: CourseProject[];
  entitlement: AuthSessionState["entitlement"];
  onCreate: () => void;
  onPricing: () => void;
  onRefreshStatus: () => Promise<void>;
  onBillingPortal: () => void;
  billingError?: string | null;
  onOpen: (project: CourseProject) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const fmtLimit = (used: number, remaining: number | null): string =>
    remaining === null ? `${used} used · unlimited` : `${remaining} of ${used + remaining} left`;
  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <main className="dashboard page-shell">
      <section className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Your projects, exports, plan, and usage.</p>
        </div>
        <button className="primary" onClick={onCreate} disabled={!entitlement.canCreateProject} title={entitlement.canCreateProject ? "Create a new course" : "Upgrade to create private courses"}>
          <Plus size={18} /> Create new course
        </button>
      </section>

      {/* Plan + usage panel — driven by the trusted subscription snapshot */}
      <section className={`plan-panel ${entitlement.active ? "active" : "free"}`}>
        <div className="plan-panel-main">
          <span className="hp-eyebrow">
            <CreditCard size={14} /> {entitlement.active ? "Active plan" : "No active plan"}
          </span>
          <h2>{entitlement.planName}</h2>
          <p>
            {entitlement.active
              ? entitlement.currentPeriodEnd
                ? `Access through ${new Date(entitlement.currentPeriodEnd).toLocaleDateString()}`
                : "Active subscription"
              : "Choose a plan to generate and export private Canvas courses."}
          </p>
        </div>
        <div className="plan-usage">
          <div>
            <strong>{entitlement.aiGenerationsLimit === null ? "Unlimited" : fmtLimit(entitlement.aiGenerationsUsed, entitlement.aiGenerationsRemaining)}</strong>
            <span>AI generations</span>
          </div>
          <div>
            <strong>{entitlement.exportsLimit === null ? "Unlimited" : fmtLimit(entitlement.exportsUsed, entitlement.exportsRemaining)}</strong>
            <span>Exports</span>
          </div>
        </div>
        <div className="plan-panel-actions">
          <button className="secondary" onClick={onPricing}>
            {entitlement.active ? "Change plan" : "View pricing"}
          </button>
          {entitlement.active && (
            <button className="ghost-button" onClick={onBillingPortal} title="Manage payment method, invoices, cancellation">
              <CreditCard size={15} /> Billing portal
            </button>
          )}
          <button className="ghost-button" onClick={refresh} disabled={refreshing} title="Re-check subscription status (after checkout)">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh status
          </button>
        </div>
        {billingError && (
          <p className="intake-ai-error" role="alert" style={{ marginTop: 12 }}>
            <AlertTriangle size={15} /> {billingError}
          </p>
        )}
      </section>

      <section className="dashboard-grid">
        <div className="stat-panel">
          <span className="stat-icon">
            <BookOpen size={20} />
          </span>
          <span>{projects.length}</span>
          <p>Course projects</p>
        </div>
        <div className="stat-panel pink">
          <span className="stat-icon">
            <FileArchive size={20} />
          </span>
          <span>{projects.reduce((sum, project) => sum + project.exportHistory.length, 0)}</span>
          <p>Validated exports</p>
        </div>
        <div className="stat-panel orchid">
          <span className="stat-icon">
            <Gauge size={20} />
          </span>
          <span>{projects.length ? Math.round(projects.reduce((sum, project) => sum + buildReadinessReport(project).score, 0) / projects.length) : 0}%</span>
          <p>Avg readiness</p>
        </div>
      </section>
      {projects.length === 0 ? (
        <EmptyState title="No courses yet" body="Create your first course to see it appear here with readiness and export status." />
      ) : (
        <section className="project-list" aria-label="Course projects">
          {projects.map((project) => {
            const score = buildReadinessReport(project).score;
            return (
              <button key={project.id} className="project-row" onClick={() => onOpen(project)}>
                <span className="project-main">
                  <span className="project-glyph" aria-hidden="true">
                    <BookOpen size={20} />
                  </span>
                  <span>
                    <strong>{project.title}</strong>
                    <small>
                      {project.modules.length} modules • {project.assignments.length} assignments • updated {formatDate(project.updatedAt)}
                    </small>
                  </span>
                </span>
                <span className="project-meta">
                  <span className="readiness-mini" title={`Readiness ${score}%`}>
                    <span className="bar" aria-hidden="true">
                      <i style={{ width: `${score}%` }} />
                    </span>
                    {score}%
                  </span>
                  <span className={`status-pill ${project.status}`}>{project.status}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}

const joinDateList = (values: string[]): string => values.join(", ");

const parseDateList = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

function Intake({
  prompt,
  settings,
  onPromptChange,
  onSettingsChange,
  onFiles,
  onPasteSource,
  onRemoveSource,
  onGenerate,
  canUseAi,
  isAuthed,
  onGenerateBlueprint,
  aiBusy,
  aiError,
  onUpgrade
}: {
  prompt: string;
  settings: CourseSettings;
  onPromptChange: (value: string) => void;
  onSettingsChange: <K extends keyof CourseSettings>(key: K, value: CourseSettings[K]) => void;
  onFiles: (files: FileList | null) => void;
  onPasteSource: (text: string) => void;
  onRemoveSource: (id: string) => void;
  onGenerate: () => void;
  canUseAi: boolean;
  isAuthed: boolean;
  onGenerateBlueprint: () => void;
  aiBusy: boolean;
  aiError: string | null;
  onUpgrade: () => void;
}) {
  const [pasteText, setPasteText] = useState("");
  // Quick mode keeps the page calm (essentials visible, advanced settings collapsed); Guided mode
  // walks through one step at a time. Both expose the full settings — just at different paces.
  const [intakeMode, setIntakeMode] = useState<"quick" | "guided">("quick");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [guidedStep, setGuidedStep] = useState(0);
  const toggleSection = (key: string): void => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const updateSchedule = <K extends keyof CourseSettings["schedule"]>(key: K, value: CourseSettings["schedule"][K]) => {
    onSettingsChange("schedule", { ...settings.schedule, [key]: value });
  };
  const submitPaste = (): void => {
    onPasteSource(pasteText);
    setPasteText("");
  };

  const generateButton = canUseAi ? (
    <button className="primary" onClick={onGenerateBlueprint} disabled={aiBusy}>
      {aiBusy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
      {aiBusy ? "Generating blueprint…" : "Generate Blueprint with AI"}
    </button>
  ) : isAuthed ? (
    <button className="primary" onClick={onUpgrade}>
      <Lock size={18} /> Upgrade to generate with AI
    </button>
  ) : (
    <button className="primary" onClick={onGenerate}>
      <Sparkles size={18} /> Generate sample course (no AI)
    </button>
  );

  const promptPanel = (
    <div className="prompt-panel">
          <span className="panel-label">
            <Wand2 size={14} /> Course brief
          </span>
          <label htmlFor="prompt">Describe your course</label>
          <p className="prompt-hint">Plain language is fine — topic, audience, goals, tone, and anything you want emphasized.</p>
          <textarea id="prompt" className="prompt-textarea" value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="e.g. An 8-week undergraduate course on AI and Modern Society for non-majors. Emphasize ethics, real-world cases, and weekly discussion. Friendly, practical tone." />
          <label className="upload-zone">
            <Upload size={22} />
            <span>Attach a syllabus, notes, reading list, or an existing Canvas .imscc export</span>
            <input type="file" multiple accept=".imscc,.txt,.md,.markdown,.csv,.json,.rtf,.doc,.docx,.pdf,.html,.htm" onChange={(event) => onFiles(event.target.files)} />
          </label>
          <p className="upload-note">
            Uploading an <strong>.imscc</strong> imports its structure right away. Text, Markdown, HTML, and <strong>.docx</strong>{" "}
            files are parsed in your browser and their content informs generation. PDFs are best-effort — if the text can't be
            extracted, paste key sections below. Review all generated content before publishing.
          </p>
          {settings.sourceFiles.length > 0 && (
            <ul className="source-list" aria-label="Attached sources">
              {settings.sourceFiles.map((file) => (
                <li key={file.id} className={`source-item ${file.status}`}>
                  <div className="source-item-head">
                    <span className="source-item-name">
                      <FileText size={14} /> {file.name} <small>{file.sizeLabel}</small>
                    </span>
                    <span className="source-status-row">
                      <SourceStatusBadge status={file.status} />
                      <button type="button" className="source-remove" onClick={() => onRemoveSource(file.id)} aria-label={`Remove ${file.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                  {file.status === "parsed" && typeof file.chars === "number" && (
                    <p className="source-meta">{file.chars.toLocaleString()} characters extracted</p>
                  )}
                  {file.note && <p className="source-note">{file.note}</p>}
                  {file.preview && file.status !== "failed" && <p className="source-preview">{file.preview}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="paste-source">
            <label htmlFor="paste-source">Or paste source material</label>
            <p className="prompt-hint">
              Course/catalog description, outcomes, readings, assignment ideas, policies, or instructor notes — anything you
              want reflected in the draft.
            </p>
            <textarea
              id="paste-source"
              className="paste-textarea"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste a syllabus section, learning outcomes, a reading list, or notes…"
            />
            <button type="button" className="secondary" onClick={submitPaste} disabled={!pasteText.trim()}>
              <Plus size={15} /> Add as source
            </button>
          </div>
          <p className="upload-note privacy-note">
            <Lock size={13} /> Your prompt and extracted source text are sent to the AI provider only to generate your draft.
            Generated content is a first draft and must be reviewed for accuracy, accessibility, grading, and policy before use.
          </p>
        </div>
  );

  const basicsFields = (
    <>
            <Select
              label="Build mode"
              value={settings.buildMode}
              options={["vibe", "guided", "hybrid"]}
              labels={{ vibe: "Vibe Build", guided: "Guided Build", hybrid: "Hybrid" }}
              onChange={(value) => onSettingsChange("buildMode", value as CourseSettings["buildMode"])}
            />
            <Input label="Course title" value={settings.title} onChange={(value) => onSettingsChange("title", value)} />
            <TextArea label="Course description" value={settings.description} onChange={(value) => onSettingsChange("description", value)} compact />
            <div className="field-grid">
              <Select label="Level" value={settings.level} options={["Undergraduate", "Graduate", "Professional", "High school", "Continuing education"]} onChange={(value) => onSettingsChange("level", value)} />
              <Select label="Modality" value={settings.modality} options={["Online asynchronous", "Online synchronous", "Hybrid", "Face-to-face", "Accelerated"]} onChange={(value) => onSettingsChange("modality", value)} />
              <NumberInput label="Credit hours" value={settings.creditHours} min={1} max={6} onChange={(value) => onSettingsChange("creditHours", value)} />
              <Select label="Tone" value={settings.tone} options={["Friendly academic", "Formal", "Practical", "Technical", "Clinical"]} onChange={(value) => onSettingsChange("tone", value)} />
            </div>
    </>
  );

  const structureFields = (
            <div className="field-grid">
              <Select
                label="Length preset"
                value={settings.courseLengthPreset}
                options={["4-weeks", "6-weeks", "8-weeks", "12-weeks", "15-weeks", "16-weeks", "maymester", "custom"]}
                labels={{ "4-weeks": "4 weeks", "6-weeks": "6 weeks", "8-weeks": "8 weeks", "12-weeks": "12 weeks", "15-weeks": "15 weeks", "16-weeks": "16 weeks", maymester: "Maymester", custom: "Custom" }}
                onChange={(value) => onSettingsChange("courseLengthPreset", value as CourseSettings["courseLengthPreset"])}
              />
              <NumberInput label="Course length" value={settings.lengthWeeks} min={3} max={18} suffix="weeks" onChange={(value) => onSettingsChange("lengthWeeks", value)} />
              <NumberInput label="Modules" value={settings.moduleCount} min={3} max={18} onChange={(value) => onSettingsChange("moduleCount", value)} />
              <Select
                label="Organization"
                value={settings.organizationPattern}
                options={["weeks", "topics", "chapters", "units", "quarters", "custom"]}
                labels={{ weeks: "Weeks", topics: "Topics", chapters: "Chapters", units: "Units", quarters: "Quarters", custom: "Custom sections" }}
                onChange={(value) => onSettingsChange("organizationPattern", value as CourseSettings["organizationPattern"])}
              />
              <Select label="Theme" value={settings.themeId} options={themes.map((theme) => theme.id)} labels={themes.reduce<Record<string, string>>((map, theme) => ({ ...map, [theme.id]: theme.name }), {})} onChange={(value) => onSettingsChange("themeId", value)} />
              <Select
                label="Outcome framework"
                value={settings.outcomeFramework}
                options={["bloom", "solo", "knowledge", "kolb"]}
                labels={{ bloom: "Bloom's Taxonomy", solo: "SOLO Taxonomy", knowledge: "Dimensions of Knowledge", kolb: "Kolb's Cycle" }}
                onChange={(value) => onSettingsChange("outcomeFramework", value as CourseSettings["outcomeFramework"])}
              />
              <Select
                label="Course structure"
                value={settings.structureFramework}
                options={["linear", "backward", "spiral", "thematic", "competency"]}
                labels={{ linear: "Subject-centred (linear)", backward: "Backward design (UbD)", spiral: "Spiral", thematic: "Thematic", competency: "Competency-based" }}
                onChange={(value) => onSettingsChange("structureFramework", value as CourseSettings["structureFramework"])}
              />
              <Select
                label="Module pattern"
                value={settings.modulePattern}
                options={["standard", "addie", "gagne", "inquiry", "conceptual"]}
                labels={{ standard: "Standard learning path", addie: "ADDIE", gagne: "Gagné's Nine Events", inquiry: "Inquiry-based", conceptual: "Conceptual framework" }}
                onChange={(value) => onSettingsChange("modulePattern", value as CourseSettings["modulePattern"])}
              />
            </div>
  );

  const assessmentsFields = (
            <div className="field-grid">
              <Select label="Quizzes" value={settings.quizFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("quizFrequency", value as CourseSettings["quizFrequency"])} />
              <NumberInput label="Questions per quiz" value={settings.quizQuestionsPerQuiz} min={1} max={10} onChange={(value) => onSettingsChange("quizQuestionsPerQuiz", value)} />
              <Select label="Quiz difficulty" value={settings.quizDifficulty} options={["introductory", "balanced", "challenging"]} onChange={(value) => onSettingsChange("quizDifficulty", value as CourseSettings["quizDifficulty"])} />
              <Select label="Quiz purpose" value={settings.quizPurpose} options={["knowledge-check", "pre-assessment", "application", "scenario", "socratic", "review"]} labels={{ "knowledge-check": "Knowledge check", "pre-assessment": "Pre-assessment", application: "Application", scenario: "Scenario-based", socratic: "Socratic", review: "Review & reinforce" }} onChange={(value) => onSettingsChange("quizPurpose", value as CourseSettings["quizPurpose"])} />
              <Select label="Discussions" value={settings.discussionFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("discussionFrequency", value as CourseSettings["discussionFrequency"])} />
              <Select label="Discussion style" value={settings.discussionStyle} options={["reflective", "case-based", "debate", "peer-review", "application"]} onChange={(value) => onSettingsChange("discussionStyle", value as CourseSettings["discussionStyle"])} />
              <Select label="Assignments" value={settings.assignmentCadence} options={["every-module", "every-other-module", "major-milestones", "custom"]} labels={{ "every-module": "Every module", "every-other-module": "Every other module", "major-milestones": "Major milestones", custom: "Custom" }} onChange={(value) => onSettingsChange("assignmentCadence", value as CourseSettings["assignmentCadence"])} />
              <Select label="Final project type" value={settings.finalProjectType} options={["project", "presentation", "paper", "portfolio", "exam", "case-study", "simulation", "other"]} onChange={(value) => onSettingsChange("finalProjectType", value as CourseSettings["finalProjectType"])} />
              <Select label="Scaffold pattern" value={settings.scaffoldPattern} options={["every-other-module", "key-milestones", "custom"]} labels={{ "every-other-module": "Every other module", "key-milestones": "Key milestones", custom: "Custom" }} onChange={(value) => onSettingsChange("scaffoldPattern", value as CourseSettings["scaffoldPattern"])} />
            </div>
  );

  const optionsFields = (
            <div className="toggle-grid">
              <Toggle label="Final project" checked={settings.finalProject} onChange={(value) => onSettingsChange("finalProject", value)} />
              <Toggle label="Scaffold final project" checked={settings.scaffoldFinalProject} onChange={(value) => onSettingsChange("scaffoldFinalProject", value)} />
              <Toggle label="Rubrics" checked={settings.includeRubrics} onChange={(value) => onSettingsChange("includeRubrics", value)} />
              <Toggle label="Outcome level tags" checked={settings.includeBloom} onChange={(value) => onSettingsChange("includeBloom", value)} />
              <Toggle label="Workload/contact hours" checked={settings.includeContactHours} onChange={(value) => onSettingsChange("includeContactHours", value)} />
              <Toggle label="Accessibility emphasis" checked={settings.accessibilityFocus} onChange={(value) => onSettingsChange("accessibilityFocus", value)} />
              <Toggle label="Module image hooks" checked={settings.imageSettings.moduleHeaderImages} onChange={(value) => onSettingsChange("imageSettings", { ...settings.imageSettings, moduleHeaderImages: value })} />
            </div>
  );

  const scheduleFields = (
    <>
            <Toggle label="Generate due dates" checked={settings.schedule.enableDueDates} onChange={(value) => updateSchedule("enableDueDates", value)} />
            <div className="field-grid">
              <Input label="Term start" type="date" value={settings.schedule.termStartDate ?? ""} onChange={(value) => updateSchedule("termStartDate", value || undefined)} />
              <Input label="Term end" type="date" value={settings.schedule.termEndDate ?? ""} onChange={(value) => updateSchedule("termEndDate", value || undefined)} />
              <Select label="Module release day" value={String(settings.schedule.moduleReleaseDay)} options={weekdayOptions} labels={weekdayLabels} onChange={(value) => updateSchedule("moduleReleaseDay", Number(value))} />
              <Select label="Preferred due day" value={String(settings.schedule.preferredDueDay)} options={weekdayOptions} labels={weekdayLabels} onChange={(value) => updateSchedule("preferredDueDay", Number(value))} />
              <Input label="Preferred due time" type="time" value={settings.schedule.preferredDueTime} onChange={(value) => updateSchedule("preferredDueTime", value)} />
              <Select
                label="Meeting cadence"
                value={settings.schedule.meetingCadence}
                options={["weekly", "twice-weekly", "self-paced", "custom"]}
                labels={{ weekly: "Weekly", "twice-weekly": "Twice weekly", "self-paced": "Self paced", custom: "Custom" }}
                onChange={(value) => updateSchedule("meetingCadence", value as CourseSettings["schedule"]["meetingCadence"])}
              />
            </div>
            <TextArea label="Holidays" value={joinDateList(settings.schedule.holidays)} onChange={(value) => updateSchedule("holidays", parseDateList(value))} compact rows={2} />
            <TextArea label="Blackout dates" value={joinDateList(settings.schedule.blackoutDates)} onChange={(value) => updateSchedule("blackoutDates", parseDateList(value))} compact rows={2} />
            <Toggle label="Allow dates outside term" checked={settings.schedule.allowDueDatesOutsideTerm} onChange={(value) => updateSchedule("allowDueDatesOutsideTerm", value)} />
    </>
  );

  // Advanced sections are collapsed by default in Quick mode (calm first glance) and become the
  // steps of the Guided wizard. Both expose exactly the same controls.
  const advancedSections = [
    { key: "structure", title: "Structure & cadence", node: structureFields },
    { key: "assessments", title: "Assessments", node: assessmentsFields },
    { key: "options", title: "Options", node: optionsFields },
    { key: "schedule", title: "Course schedule", node: scheduleFields }
  ];
  const guidedSteps = [
    { key: "describe", title: "Describe your course", node: promptPanel },
    { key: "basics", title: "Course basics", node: <div className="settings-section">{basicsFields}</div> },
    { key: "structure", title: "Structure & cadence", node: <div className="settings-section">{structureFields}</div> },
    { key: "assessments", title: "Assessments", node: <div className="settings-section">{assessmentsFields}</div> },
    { key: "options", title: "Options", node: <div className="settings-section">{optionsFields}</div> },
    { key: "schedule", title: "Schedule", node: <div className="settings-section">{scheduleFields}</div> }
  ];
  const lastStep = guidedSteps.length - 1;

  return (
    <main className="intake page-shell">
      <section className="page-heading intake-heading">
        <div>
          <h1>Create a Course</h1>
          <p>
            {intakeMode === "quick"
              ? "Describe your course and generate. Open Advanced options only if you want to fine-tune."
              : "Walk through each part of your course design, one step at a time."}
          </p>
        </div>
        <div className="intake-controls">
          <div className="intake-mode-toggle" role="tablist" aria-label="Create mode">
            <button role="tab" aria-selected={intakeMode === "quick"} className={intakeMode === "quick" ? "active" : ""} onClick={() => setIntakeMode("quick")}>
              <Wand2 size={15} /> Quick build
            </button>
            <button role="tab" aria-selected={intakeMode === "guided"} className={intakeMode === "guided" ? "active" : ""} onClick={() => { setIntakeMode("guided"); setGuidedStep(0); }}>
              <ListChecks size={15} /> Guided steps
            </button>
          </div>
          {intakeMode === "quick" && generateButton}
        </div>
      </section>
      {aiError && (
        <p className="intake-ai-error">
          <AlertTriangle size={15} /> {aiError}
        </p>
      )}

      {intakeMode === "quick" ? (
        <section className="intake-layout">
          {promptPanel}
          <div className="settings-panel">
            <span className="panel-label">
              <Sparkles size={14} /> Course settings
            </span>
            <div className="settings-section">
              <div className="subsection-heading">
                <h2>Course basics</h2>
              </div>
              {basicsFields}
            </div>
            {advancedSections.map((section) => (
              <CollapsibleSection key={section.key} title={section.title} open={Boolean(openSections[section.key])} onToggle={() => toggleSection(section.key)}>
                {section.node}
              </CollapsibleSection>
            ))}
          </div>
        </section>
      ) : (
        <section className="intake-guided">
          <ol className="guided-stepper" aria-label="Course setup steps">
            {guidedSteps.map((step, index) => (
              <li key={step.key} className={index === guidedStep ? "active" : index < guidedStep ? "done" : ""}>
                <button type="button" onClick={() => setGuidedStep(index)}>
                  <span className="guided-step-num">{index < guidedStep ? <Check size={13} /> : index + 1}</span>
                  <span>{step.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="guided-step-body">
            <div className="guided-progress" aria-hidden="true">
              <i style={{ width: `${((guidedStep + 1) / guidedSteps.length) * 100}%` }} />
            </div>
            <h2 className="guided-step-title">
              Step {guidedStep + 1} of {guidedSteps.length}: {guidedSteps[guidedStep].title}
            </h2>
            <div className="guided-step-fields">{guidedSteps[guidedStep].node}</div>
            <div className="guided-nav">
              <button className="secondary" onClick={() => setGuidedStep((value) => Math.max(0, value - 1))} disabled={guidedStep === 0}>
                <ArrowLeft size={15} /> Back
              </button>
              {guidedStep < lastStep ? (
                <button className="primary" onClick={() => setGuidedStep((value) => Math.min(lastStep, value + 1))}>
                  Next <ArrowRight size={15} />
                </button>
              ) : (
                generateButton
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function BlueprintReview({
  blueprint,
  busy,
  error,
  onApprove,
  onRegenerate,
  onBack
}: {
  blueprint: CourseBlueprint;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  return (
    <main className="blueprint page-shell">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> AI Blueprint
          </span>
          <h1>{blueprint.title}</h1>
          <p>Review the AI's instructional plan. Approve to build the full Canvas course, or regenerate.</p>
        </div>
        <div className="blueprint-actions">
          <button className="secondary" onClick={onBack}>
            Back
          </button>
          <button className="secondary" onClick={onRegenerate} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Regenerate
          </button>
          <button className="primary" onClick={onApprove} disabled={busy}>
            <CheckCircle2 size={18} /> Approve &amp; Build Course
          </button>
        </div>
      </section>

      {error && (
        <p className="intake-ai-error">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      <section className="blueprint-meta">
        <span><strong>Audience</strong>{blueprint.audience || "—"}</span>
        <span><strong>Level</strong>{blueprint.level || "—"}</span>
        <span><strong>Modality</strong>{blueprint.modality || "—"}</span>
        <span><strong>Credit hours</strong>{blueprint.creditHours}</span>
        <span><strong>Length</strong>{blueprint.lengthWeeks} weeks</span>
        <span><strong>Modules</strong>{blueprint.modules.length}</span>
      </section>

      <p className="blueprint-description">{blueprint.description}</p>
      {blueprint.teachingApproach && (
        <p className="blueprint-approach"><strong>Teaching approach:</strong> {blueprint.teachingApproach}</p>
      )}

      <div className="blueprint-grid">
        <section className="blueprint-card">
          <h2>Learning outcomes</h2>
          <ul className="blueprint-outcomes">
            {blueprint.outcomes.length === 0 && <li>No outcomes returned.</li>}
            {blueprint.outcomes.map((outcome) => (
              <li key={outcome.code}>
                <span className="outcome-code">{outcome.code}</span> {outcome.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="blueprint-card">
          <h2>Assessment plan</h2>
          <ul className="blueprint-assessments">
            {blueprint.majorAssessments.map((item, index) => (
              <li key={index}>
                <ClipboardCheck size={14} /> {item}
              </li>
            ))}
          </ul>
          {blueprint.finalProject && (
            <p className="blueprint-final">
              <strong>Final project:</strong> {blueprint.finalProject}
            </p>
          )}
        </section>
      </div>

      <section className="blueprint-modules">
        <h2>Module map</h2>
        <div className="blueprint-module-list">
          {blueprint.modules.map((module, index) => (
            <article key={index} className="blueprint-module">
              <span className="blueprint-module-index">{index + 1}</span>
              <div>
                <strong>{module.title}</strong>
                <p>{module.summary}</p>
                {module.objectives.length > 0 && (
                  <ul>
                    {module.objectives.map((objective, objectiveIndex) => (
                      <li key={objectiveIndex}>{objective}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {blueprint.validationWarnings.length > 0 && (
        <section className="blueprint-warnings">
          <h2><AlertTriangle size={16} /> Things to verify</h2>
          <ul>
            {blueprint.validationWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Progress({ progressIndex }: { progressIndex: number }) {
  const percent = Math.min(100, Math.round(((progressIndex + 1) / progressSteps.length) * 100));
  return (
    <main className="progress page-shell">
      <section className="progress-card">
        <div className="progress-orb" aria-hidden="true">
          <span className="ring" />
          <span className="ring inner" />
          <span className="core">
            <Sparkles size={22} />
          </span>
        </div>
        <h1>Building your Canvas course</h1>
        <p>{progressSteps[Math.min(progressIndex, progressSteps.length - 1)]}</p>
        <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="progress-percent">{percent}% complete</span>
        <ol>
          {progressSteps.map((step, index) => (
            <li key={step} className={index < progressIndex ? "done" : index === progressIndex ? "current" : ""}>
              {index < progressIndex ? <CheckCircle2 size={16} /> : index === progressIndex ? <Loader2 size={16} className="spin" /> : <ChevronRight size={16} />}
              {step}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Editor({
  course,
  activeTab,
  setActiveTab,
  readiness,
  quality,
  subscriptionActive,
  validationReport,
  isExporting,
  draggedModuleId,
  onDragModule,
  onDropModule,
  onDragItem,
  onDropItem,
  onUpdateCourse,
  onRunValidation,
  onDownload,
  onDownloadPdf,
  onDownloadSyllabusPdf,
  onDownloadAllQti,
  onExportQuizQti,
  onExportQuizStudentPdf,
  onExportQuizAnswerKeyPdf,
  onDownloadAllQuizzesStudentPdf,
  onDownloadAllQuizzesAnswerKeyPdf,
  exportError,
  lastDownloadName,
  onDuplicateModule,
  onDeleteModule,
  onRevise,
  exportMode,
  onExportModeChange,
  importNotes,
  saveState,
  customThemes,
  canCreateCustomTheme,
  onSaveCustomTheme,
  demoMode = false,
  onExitDemo
}: {
  course: CourseProject;
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  subscriptionActive: boolean;
  validationReport: ExportValidationReport | null;
  isExporting: boolean;
  draggedModuleId: string | null;
  onDragModule: (moduleId: string | null) => void;
  onDropModule: (moduleId: string) => void;
  onDragItem: (item: { moduleId: string; itemId: string } | null) => void;
  onDropItem: (moduleId: string, itemId?: string) => void;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onRunValidation: () => void;
  onDownload: () => void;
  onDownloadPdf: () => void;
  onDownloadSyllabusPdf: () => void;
  onDownloadAllQti: () => void;
  onExportQuizQti: (quiz: Quiz) => void;
  onExportQuizStudentPdf: (quiz: Quiz) => void;
  onExportQuizAnswerKeyPdf: (quiz: Quiz) => void;
  onDownloadAllQuizzesStudentPdf: () => void;
  onDownloadAllQuizzesAnswerKeyPdf: () => void;
  exportError: string | null;
  lastDownloadName: string | null;
  onDuplicateModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string, moveItemsToModuleId?: string) => void;
  onRevise: (mode: RevisionMode) => Promise<void>;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  importNotes: string[];
  saveState: "idle" | "saving" | "saved" | "error";
  customThemes: Theme[];
  canCreateCustomTheme: boolean;
  onSaveCustomTheme: (input: CustomThemeInput) => Promise<{ ok: boolean; theme?: Theme; error?: string }>;
  demoMode?: boolean;
  onExitDemo?: () => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [revising, setRevising] = useState<RevisionMode | null>(null);

  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLButtonElement>("button.active");
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTab]);

  const runRevise = async (mode: RevisionMode): Promise<void> => {
    if (revising) return;
    setRevising(mode);
    try {
      await onRevise(mode);
    } finally {
      setRevising(null);
    }
  };

  return (
    <main className="editor-shell">
      <aside className="editor-rail" aria-label="Course navigation">
        <div className="rail-section">
          <strong>{course.title}</strong>
          <small>
            {course.modules.length} modules • {course.pages.length} pages
          </small>
        </div>
        <span className="rail-label">Quick nav</span>
        {[
          ["Overview", BookOpen],
          ["Modules", GripVertical],
          ["Assignments", ClipboardCheck],
          ["Discussions", MessageSquareText],
          ["Export", FileArchive]
        ].map(([label, Icon]) => (
          <button key={String(label)} className={activeTab === label ? "active" : ""} onClick={() => setActiveTab(label as EditorTab)}>
            <Icon size={17} /> {String(label)}
          </button>
        ))}
      </aside>

      <section className="editor-main">
        {demoMode && (
          <div className="demo-banner" role="note">
            <span className="demo-banner-text">
              <Sparkles size={15} /> You're exploring the <strong>RocketCourse demo</strong> — a pre-populated AI and
              Modern Society course. No AI credits are used and edits here aren't saved.
            </span>
            <button className="ghost-button" onClick={onExitDemo}>
              <Home size={15} /> Back to RocketCourse Home
            </button>
          </div>
        )}
        <div className="editor-header">
          <div>
            <h1>{course.title}</h1>
            <p>
              Structured Canvas course preview and editor
              {saveState === "saving" && <span className="save-chip saving"><Loader2 size={12} className="spin" /> Saving…</span>}
              {saveState === "saved" && <span className="save-chip saved"><CheckCircle2 size={12} /> Saved</span>}
              {saveState === "error" && <span className="save-chip error"><AlertTriangle size={12} /> Save failed</span>}
            </p>
          </div>
          {/* The Homepage tab has its own context-aware "Quick improvements" that edit the
              structured builder model, so the generic page-level revise toolbar is hidden there
              to avoid duplication and keep the builder and its HTML in sync. */}
          {activeTab !== "Homepage" && activeTab !== "Syllabus" && (
            <div className="ai-toolbar" aria-label="AI revise actions">
              {([
                ["concise", PenLine, "Concise"],
                ["examples", Sparkles, "Add examples"],
                ["accessibility", CheckCircle2, "Accessibility"],
                ["rubric", RotateCcw, "Rubric note"]
              ] as const).map(([mode, Icon, label]) => (
                <button key={mode} onClick={() => void runRevise(mode)} disabled={revising !== null} aria-busy={revising === mode}>
                  {revising === mode ? <Loader2 size={15} className="spin" /> : <Icon size={15} />} {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tabs" role="tablist" aria-label="Course editor sections" ref={tabsRef}>
          {editorTabs.map((tab) => (
            <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {activeTab === "Overview" && <OverviewTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Homepage" && <HomepageTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Syllabus" && <SyllabusTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Modules" && (
            <ModulesTab
              course={course}
              draggedModuleId={draggedModuleId}
              onDragModule={onDragModule}
              onDropModule={onDropModule}
              onDragItem={onDragItem}
              onDropItem={onDropItem}
              onUpdateCourse={onUpdateCourse}
              onDuplicateModule={onDuplicateModule}
              onDeleteModule={onDeleteModule}
              onJumpToTab={setActiveTab}
            />
          )}
          {activeTab === "Pages" && <PagesTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Assignments" && <AssignmentsTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Discussions" && <DiscussionsTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Quizzes" && (
            <QuizzesTab
              course={course}
              onUpdateCourse={onUpdateCourse}
              onJumpToTab={setActiveTab}
              onExportQti={onExportQuizQti}
              onExportStudentPdf={onExportQuizStudentPdf}
              onExportAnswerKeyPdf={onExportQuizAnswerKeyPdf}
            />
          )}
          {activeTab === "Rubrics" && <RubricsTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Gradebook Setup" && <GradebookTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Contact Hours" && <ContactHoursTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Theme" && (
            <ThemeTab
              course={course}
              onUpdateCourse={onUpdateCourse}
              customThemes={customThemes}
              canCreateCustomTheme={canCreateCustomTheme}
              onSaveCustomTheme={onSaveCustomTheme}
            />
          )}
          {activeTab === "Transform" && <TransformTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Export" && (
            <ExportTab
              course={course}
              readiness={readiness}
              validationReport={validationReport}
              isExporting={isExporting}
              exportMode={exportMode}
              onExportModeChange={onExportModeChange}
              importNotes={importNotes}
              subscriptionActive={subscriptionActive}
              exportError={exportError}
              lastDownloadName={lastDownloadName}
              onRunValidation={onRunValidation}
              onDownload={onDownload}
              onDownloadPdf={onDownloadPdf}
              onDownloadSyllabusPdf={onDownloadSyllabusPdf}
              onDownloadAllQti={onDownloadAllQti}
              onDownloadAllQuizzesStudentPdf={onDownloadAllQuizzesStudentPdf}
              onDownloadAllQuizzesAnswerKeyPdf={onDownloadAllQuizzesAnswerKeyPdf}
              onJumpToTab={setActiveTab}
            />
          )}
        </div>
      </section>

      <aside className="readiness-panel">
        <ReadinessPanel readiness={readiness} quality={quality} validationReport={validationReport} subscriptionActive={subscriptionActive} onJumpToTab={setActiveTab} />
      </aside>
    </main>
  );
}

function PageTab({
  title,
  course,
  page,
  onUpdateCourse
}: {
  title: string;
  course: CourseProject;
  page: CoursePage;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
}) {
  if (!page) return <EmptyState title={`${title} missing`} body="Generate or add this page before export." />;
  const revisePage = (mode: RevisionMode): void => {
    onUpdateCourse((current) => {
      const result = reviseCourseObject({
        courseTitle: current.title,
        objectType: "page",
        title: page.title,
        html: page.bodyHtml,
        mode,
        context: {
          outcomeCodes: current.outcomes.slice(0, 3).map((outcome) => outcome.code),
          moduleTitle: current.modules.find((module) => module.id === page.moduleId)?.title,
          futureProvider: "server-side-ai"
        }
      });
      return {
        ...current,
        pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml: result.html, status: "edited", metadata: editMetadata() } : item))
      };
    });
  };
  return (
    <div className="split-editor">
      <div className="stack">
        <ObjectReviseBar onRevise={revisePage} />
        <Input
          label="Page title"
          value={page.title}
          onChange={(value) => onUpdateCourse((current) => ({ ...current, pages: current.pages.map((item) => (item.id === page.id ? { ...item, title: value } : item)) }))}
        />
        <TextArea
          label="Canvas HTML"
          value={page.bodyHtml}
          rows={20}
          onChange={(value) => onUpdateCourse((current) => ({ ...current, pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml: value } : item)) }))}
        />
      </div>
      <div className="canvas-preview">
        <small className="block-note">Previewing {course.theme.name} themed Canvas HTML</small>
        <div dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      </div>
    </div>
  );
}

function ModulesTab({
  course,
  draggedModuleId,
  onDragModule,
  onDropModule,
  onDragItem,
  onDropItem,
  onUpdateCourse,
  onDuplicateModule,
  onDeleteModule,
  onJumpToTab
}: {
  course: CourseProject;
  draggedModuleId: string | null;
  onDragModule: (moduleId: string | null) => void;
  onDropModule: (moduleId: string) => void;
  onDragItem: (item: { moduleId: string; itemId: string } | null) => void;
  onDropItem: (moduleId: string, itemId?: string) => void;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onDuplicateModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string, moveItemsToModuleId?: string) => void;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const [selectedModuleId, setSelectedModuleId] = useState(course.modules[0]?.id ?? "");
  const [previewFilter, setPreviewFilter] = useState<ModulePreviewFilter>("all");
  const [pendingDeleteModuleId, setPendingDeleteModuleId] = useState<string | null>(null);
  const [moveTargetModuleId, setMoveTargetModuleId] = useState("");
  const validation = useMemo(() => validateModulePlan(course), [course]);
  const totalItems = course.modules.reduce((sum, module) => sum + module.items.length, 0);
  const emptyModules = course.modules.filter((module) => module.items.length === 0).length;
  const totalWorkload = course.modules.reduce((sum, module) => sum + Number(module.workloadHours || 0), 0);
  const selectedModule = course.modules.find((module) => module.id === selectedModuleId) ?? course.modules[0];

  useEffect(() => {
    if (!course.modules.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(course.modules[0]?.id ?? "");
    }
  }, [course.modules, selectedModuleId]);

  const tabForItem = (type: ModuleItem["type"]): EditorTab => {
    if (type === "assignment") return "Assignments";
    if (type === "discussion") return "Discussions";
    if (type === "quiz") return "Quizzes";
    if (type === "syllabus") return "Syllabus";
    return "Pages";
  };

  const iconForType = (type: ModuleItem["type"]) => {
    if (type === "assignment") return <ClipboardCheck size={14} />;
    if (type === "discussion") return <MessageSquareText size={14} />;
    if (type === "quiz") return <CheckCircle2 size={14} />;
    return <FileText size={14} />;
  };

  const updateModuleField = <K extends keyof CourseModule>(moduleId: string, key: K, value: CourseModule[K]): void => {
    onUpdateCourse((current) => ({
      ...current,
      modules: current.modules.map((module) => (module.id === moduleId ? { ...module, [key]: value, status: "edited" } : module))
    }));
  };

  const renameModuleItem = (moduleId: string, item: ModuleItem, title: string): void => {
    onUpdateCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: module.items.map((moduleItem) => (moduleItem.id === item.id ? { ...moduleItem, title, status: "edited" } : moduleItem))
            }
          : module
      ),
      pages: item.type === "page" || item.type === "syllabus" ? current.pages.map((page) => (page.id === item.refId ? { ...page, title, status: "edited" } : page)) : current.pages,
      assignments: item.type === "assignment" ? current.assignments.map((assignment) => (assignment.id === item.refId ? { ...assignment, title, status: "edited" } : assignment)) : current.assignments,
      discussions: item.type === "discussion" ? current.discussions.map((discussion) => (discussion.id === item.refId ? { ...discussion, title, status: "edited" } : discussion)) : current.discussions,
      quizzes: item.type === "quiz" ? current.quizzes.map((quiz) => (quiz.id === item.refId ? { ...quiz, title, status: "edited" } : quiz)) : current.quizzes
    }));
  };

  const moveModuleBy = (moduleId: string, offset: number): void => {
    const index = course.modules.findIndex((module) => module.id === moduleId);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= course.modules.length) return;
    onUpdateCourse((current) => ({ ...current, modules: renumberModules(moveItem(current.modules, index, targetIndex)) }));
  };

  const startDelete = (module: CourseModule): void => {
    setPendingDeleteModuleId(module.id);
    setMoveTargetModuleId(course.modules.find((candidate) => candidate.id !== module.id)?.id ?? "");
  };

  const moduleSummaryFor = (moduleId: string) => validation.moduleSummaries.find((summary) => summary.moduleId === moduleId);
  const itemIssues = (itemId: string) => validation.issues.filter((issue) => issue.itemId === itemId);
  const visiblePreviewItems =
    selectedModule?.items
      .map((item) => ({ item, target: getModuleItemTarget(course, item), issues: itemIssues(item.id) }))
      .filter(({ item, target, issues }) => {
        if (previewFilter === "pages") return item.type === "page" || item.type === "syllabus";
        if (previewFilter === "graded") return item.type === "assignment" || item.type === "quiz" || (target?.points ?? 0) > 0;
        if (previewFilter === "risky") return issues.length > 0 || !target;
        return true;
      }) ?? [];

  if (course.modules.length === 0) {
    return <EmptyState title="No modules yet" body="Add a module to begin building the Canvas course sequence." />;
  }

  return (
    <div className="module-planner">
      <section className="module-planner-hero">
        <div>
          <span className="hp-eyebrow"><Layers size={14} /> Canvas module planner</span>
          <h2>Course Sequence Builder</h2>
          <p>Plan the student path, edit module metadata, move content safely, and catch broken Canvas references before export.</p>
        </div>
        <div className={`module-readiness-badge ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <section className="module-metric-grid" aria-label="Module planner summary">
        <div>
          <strong>{course.modules.length}</strong>
          <span>Modules</span>
        </div>
        <div>
          <strong>{totalItems}</strong>
          <span>Items in sequence</span>
        </div>
        <div className={emptyModules ? "warn" : ""}>
          <strong>{emptyModules}</strong>
          <span>Empty modules</span>
        </div>
        <div>
          <strong>{totalWorkload}</strong>
          <span>Estimated hours</span>
        </div>
      </section>

      <section className="module-sequence" aria-label="Visual course sequence">
        {course.modules.map((module, index) => {
          const summary = moduleSummaryFor(module.id);
          return (
            <button key={module.id} className={selectedModule?.id === module.id ? "active" : ""} onClick={() => setSelectedModuleId(module.id)}>
              <span>{index + 1}</span>
              <strong>{module.title || "Untitled module"}</strong>
              <small>{summary?.status ?? "Ready"}</small>
            </button>
          );
        })}
      </section>

      <div className="module-planner-actions">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onUpdateCourse((current) => ({
              ...current,
              modules: renumberModules([
                ...current.modules,
                {
                  id: `module_custom_${Date.now()}`,
                  title: "New Module",
                  description: "Add a module description.",
                  objectives: ["Add a measurable module objective."],
                  workloadHours: 4,
                  order: current.modules.length,
                  kind: "content",
                  publishState: "published",
                  expanded: true,
                  items: [],
                  status: "draft",
                  metadata: editMetadata()
                }
              ])
            }))
          }
        >
          <Plus size={16} /> Add module
        </button>
      </div>

      <div className="module-planner-layout">
        <section className="module-board" aria-label="Editable module cards">
          {course.modules.map((module, moduleIndex) => {
            const counts = itemCountsForModule(module);
            const summary = moduleSummaryFor(module.id);
            const currentDelete = pendingDeleteModuleId === module.id;
            return (
              <article
                key={module.id}
                className={`module-editor ${draggedModuleId === module.id ? "dragging" : ""} ${summary?.status === "Needs review" ? "needs-review" : ""}`}
                draggable
                onDragStart={() => onDragModule(module.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropModule(module.id)}
              >
                <header>
                  <span className="module-drag-handle" aria-label={`Drag ${module.title}`} title="Drag to reorder">
                    <GripVertical size={16} /> Drag
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => updateModuleField(module.id, "expanded", !module.expanded)}
                    aria-label={`${module.expanded ? "Collapse" : "Expand"} ${module.title}`}
                  >
                    {module.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="module-title-block">
                    <input value={module.title} aria-label={`${module.title} title`} onChange={(event) => updateModuleField(module.id, "title", event.target.value)} />
                    <div className="module-card-meta">
                      <span>{module.objectives.filter(Boolean).length} objectives</span>
                      <span>{module.workloadHours} hours</span>
                      <span>{module.items.length} items</span>
                      <span className={summary?.status === "Needs review" ? "warn" : "ok"}>{summary?.status ?? "Ready"}</span>
                    </div>
                  </div>
                  <select value={module.publishState} aria-label={`${module.title} publish state`} onChange={(event) => updateModuleField(module.id, "publishState", event.target.value as CourseModule["publishState"])}>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                  <div className="module-card-actions">
                    <button className="small-button" onClick={() => moveModuleBy(module.id, -1)} disabled={moduleIndex === 0}>
                      Up
                    </button>
                    <button className="small-button" onClick={() => moveModuleBy(module.id, 1)} disabled={moduleIndex === course.modules.length - 1}>
                      Down
                    </button>
                    <button className="small-button" onClick={() => onDuplicateModule(module.id)}>
                      Duplicate
                    </button>
                  </div>
                </header>
                {module.expanded && (
                  <div className="module-body" onDragOver={(event) => event.preventDefault()} onDrop={() => onDropItem(module.id)}>
                    <div className="module-card-fields">
                      <label>
                        <span>Description</span>
                        <textarea value={module.description} onChange={(event) => updateModuleField(module.id, "description", event.target.value)} />
                      </label>
                      <label>
                        <span>Objectives</span>
                        <textarea value={module.objectives.join("\n")} onChange={(event) => updateModuleField(module.id, "objectives", event.target.value.split("\n").filter((value) => value.trim()))} />
                      </label>
                      <label>
                        <span>Workload hours</span>
                        <input type="number" min={0} step={0.5} value={module.workloadHours} onChange={(event) => updateModuleField(module.id, "workloadHours", Number(event.target.value))} />
                      </label>
                    </div>

                    <div className="module-count-row" aria-label={`${module.title} item counts`}>
                      {(Object.keys(counts) as ModuleItem["type"][]).map((type) =>
                        counts[type] > 0 ? (
                          <span key={type} className={`item-type ${type}`}>
                            {iconForType(type)} {counts[type]} {moduleItemTypeLabel(type)}
                          </span>
                        ) : null
                      )}
                      {module.items.length === 0 && <span className="module-empty-note">Drop items here or add content from another tab.</span>}
                    </div>

                    {summary && summary.issues.length > 0 && (
                      <div className="module-issue-list" aria-label={`${module.title} module checks`}>
                        {summary.issues.slice(0, 4).map((issue) => (
                          <p key={issue.id} className={issue.severity}>
                            {issue.severity === "error" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                            <strong>{issue.title}:</strong> {issue.detail}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="module-items">
                      {module.items.map((item) => {
                        const target = getModuleItemTarget(course, item);
                        const issues = itemIssues(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`module-item ${issues.length ? "risky" : ""}`}
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              onDragItem({ moduleId: module.id, itemId: item.id });
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.stopPropagation();
                              onDropItem(module.id, item.id);
                            }}
                          >
                            <GripVertical size={15} />
                            <span className={`item-type ${item.type}`}>{iconForType(item.type)} {moduleItemTypeLabel(item.type)}</span>
                            <input value={item.title} aria-label={`${item.title} module item title`} onChange={(event) => renameModuleItem(module.id, item, event.target.value)} />
                            <small>{target ? target.summary || "No preview text available yet." : "Missing referenced object."}</small>
                          </div>
                        );
                      })}
                    </div>

                    <div className="module-delete-zone">
                      {module.items.length === 0 ? (
                        <button className="small-button danger" onClick={() => onDeleteModule(module.id)}>
                          <Trash2 size={14} /> Delete empty module
                        </button>
                      ) : (
                        <>
                          <button className="small-button danger" onClick={() => startDelete(module)}>
                            <Trash2 size={14} /> Delete or move
                          </button>
                          {currentDelete && (
                            <div className="module-delete-panel">
                              <strong>Move items before deleting</strong>
                              <p>Non-empty modules cannot be deleted silently. Choose where the {module.items.length} item(s) should go.</p>
                              <select value={moveTargetModuleId} onChange={(event) => setMoveTargetModuleId(event.target.value)} aria-label="Move items to module">
                                {course.modules
                                  .filter((candidate) => candidate.id !== module.id)
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.title}
                                    </option>
                                  ))}
                              </select>
                              <div>
                                <button className="small-button" onClick={() => setPendingDeleteModuleId(null)}>
                                  Cancel
                                </button>
                                <button
                                  className="small-button"
                                  disabled={!moveTargetModuleId}
                                  onClick={() => {
                                    onDeleteModule(module.id, moveTargetModuleId);
                                    setPendingDeleteModuleId(null);
                                  }}
                                >
                                  <MoveRight size={14} /> Move items and delete
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <aside className="module-preview-panel" aria-label="Module path preview">
          <div className="module-preview-sticky">
            <header>
              <span className="hp-eyebrow"><BookOpen size={14} /> Preview module path</span>
              <h2>{selectedModule?.title ?? "Select a module"}</h2>
              <p>{selectedModule?.description || "Choose a module to preview what students will see in order."}</p>
            </header>
            <div className="module-preview-tabs" role="tablist" aria-label="Module preview filter">
              {[
                ["all", "All items"],
                ["pages", "Pages only"],
                ["graded", "Graded"],
                ["risky", "Missing or risky"]
              ].map(([id, label]) => (
                <button key={id} className={previewFilter === id ? "active" : ""} onClick={() => setPreviewFilter(id as ModulePreviewFilter)} aria-pressed={previewFilter === id}>
                  {label}
                </button>
              ))}
            </div>
            <div className="module-preview-list">
              {visiblePreviewItems.length === 0 && <p className="module-empty-note">No items match this preview filter.</p>}
              {visiblePreviewItems.map(({ item, target, issues }, index) => (
                <article key={item.id} className={issues.length ? "risky" : ""}>
                  <span className={`item-type ${item.type}`}>{iconForType(item.type)} {moduleItemTypeLabel(item.type)}</span>
                  <strong>{index + 1}. {item.title}</strong>
                  <p>{target?.summary || "No linked content preview is available."}</p>
                  {issues.map((issue) => (
                    <small key={issue.id} className={issue.severity}>{issue.title}: {issue.detail}</small>
                  ))}
                  <button className="small-button" onClick={() => onJumpToTab(tabForItem(item.type))}>
                    Open {tabForItem(item.type)}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CollectionTab<T extends { id: string; title: string; status: CourseProject["status"]; metadata: ObjectMetadata }>({
  title,
  objectType,
  course,
  items,
  getBody,
  setBody,
  onReplace
}: {
  title: string;
  objectType: "page" | "assignment" | "discussion";
  course: CourseProject;
  items: T[];
  getBody: (item: T) => string;
  setBody: (item: T, body: string) => T;
  onReplace: (items: T[]) => void;
}) {
  const reviseItem = (item: T, mode: RevisionMode): void => {
    const result = reviseCourseObject({
      courseTitle: course.title,
      objectType,
      title: item.title,
      html: getBody(item),
      mode,
      context: {
        outcomeCodes: course.outcomes.slice(0, 4).map((outcome) => outcome.code),
        futureProvider: "server-side-ai"
      }
    });
    onReplace(items.map((current) => (current.id === item.id ? { ...setBody(current, result.html), status: "edited", metadata: editMetadata() } : current)));
  };

  return (
    <div className="stack">
      <h2>{title}</h2>
      {items.map((item) => (
        <details key={item.id} className="detail-editor">
          <summary>{item.title}</summary>
          <ObjectReviseBar onRevise={(mode) => reviseItem(item, mode)} />
          <Input label="Title" value={item.title} onChange={(value) => onReplace(items.map((current) => (current.id === item.id ? { ...current, title: value } : current)))} />
          <TextArea label="Canvas HTML" value={getBody(item)} rows={10} onChange={(value) => onReplace(items.map((current) => (current.id === item.id ? setBody(current, value) : current)))} />
        </details>
      ))}
    </div>
  );
}

const themePreviewModes: Array<{ id: ThemePreviewKind; label: string }> = [
  { id: "homepage", label: "Homepage" },
  { id: "syllabus", label: "Syllabus" },
  { id: "assignment", label: "Assignment" },
  { id: "quiz", label: "Quiz" },
  { id: "rubric", label: "Rubric" }
];

function ThemeSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-swatch-row">
      <span className="theme-swatch" style={{ background: value }} />
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
    </div>
  );
}

function CustomThemeBuilder({
  canCreate,
  currentThemeId,
  onApply,
  onSave
}: {
  canCreate: boolean;
  currentThemeId: string;
  onApply: (theme: Theme) => void;
  onSave: (input: CustomThemeInput) => Promise<{ ok: boolean; theme?: Theme; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My School Theme");
  const [institution, setInstitution] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1d4ed8");
  const [backgroundColor, setBackgroundColor] = useState("#eef2ff");
  const [textColor, setTextColor] = useState("#0f172a");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input: CustomThemeInput = { name, institutionName: institution, primaryColor, backgroundColor, textColor, logoDataUrl };
  const preview = useMemo(() => buildThemeFromCustom(input), [name, institution, primaryColor, backgroundColor, textColor, logoDataUrl]);
  const check = useMemo(() => validateTheme(preview), [preview]);

  const handleLogo = (file: File | null): void => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image.");
      return;
    }
    if (file.size > 200 * 1024) {
      setError("Logo must be under 200 KB (use a small PNG/SVG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const applyOnly = (): void => {
    setNotice(`Applied "${preview.name}" to this course.`);
    onApply(preview);
  };

  const saveAndApply = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await onSave(input);
      if (!result.ok) {
        setError(result.error ?? "Could not save theme.");
        return;
      }
      onApply(result.theme ?? preview);
      setNotice(`Saved "${preview.name}" to your account and applied it.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="custom-theme-builder">
      <header>
        <div>
          <h2>Create a custom school theme</h2>
          <p>Match your institution's colors and logo. Apply it now, or save it to your account to reuse and export.</p>
        </div>
        <button className="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <Palette size={16} /> {open ? "Hide builder" : "New custom theme"}
        </button>
      </header>

      {open && (
        <div className="custom-theme-grid">
          <div className="custom-theme-fields">
            <Input label="Theme name" value={name} onChange={setName} />
            <Input label="Institution / program (optional)" value={institution} onChange={setInstitution} />
            <div className="custom-color-row">
              <label className="color-field">
                <span>Primary</span>
                <input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} aria-label="Primary color" />
              </label>
              <label className="color-field">
                <span>Background</span>
                <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} aria-label="Background color" />
              </label>
              <label className="color-field">
                <span>Text</span>
                <input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} aria-label="Text color" />
              </label>
            </div>
            <label className="logo-upload">
              <Upload size={16} /> {logoDataUrl ? "Replace logo" : "Upload logo (small PNG/SVG, optional)"}
              <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={(event) => handleLogo(event.target.files?.[0] ?? null)} />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {notice && <p className="auth-info">{notice}</p>}
            <div className="custom-theme-actions">
              <button className="secondary" onClick={applyOnly}>
                Apply to course
              </button>
              {canCreate ? (
                <button className="primary" onClick={() => void saveAndApply()} disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Save &amp; apply
                </button>
              ) : (
                <span className="custom-theme-lock">
                  <Lock size={14} /> Saving custom themes needs a paid plan
                </span>
              )}
            </div>
          </div>

          <div className="custom-theme-preview" style={{ background: preview.soft, color: preview.contrastText }}>
            <div className="custom-preview-banner" style={{ background: preview.accent, color: "#fff" }}>
              {logoDataUrl ? <img src={logoDataUrl} alt="Theme logo preview" /> : <Palette size={18} />}
              <strong>{preview.bannerLabel}</strong>
            </div>
            <h3 style={{ color: preview.contrastText }}>{name || "Theme name"}</h3>
            <p>Sample course content uses your soft background and text color.</p>
            <span className="custom-preview-button" style={{ background: preview.accentDark, color: "#fff" }}>
              Start Here
            </span>
            <em className={check.status === "pass" ? "ok" : "warn"}>
              {check.status === "pass" ? "Contrast pass" : "Low contrast — adjust text/background"}
            </em>
            {currentThemeId === preview.id && <span className="custom-preview-active">Currently applied</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function ThemeTab({
  course,
  onUpdateCourse,
  customThemes,
  canCreateCustomTheme,
  onSaveCustomTheme
}: {
  course: CourseProject;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  customThemes: Theme[];
  canCreateCustomTheme: boolean;
  onSaveCustomTheme: (input: CustomThemeInput) => Promise<{ ok: boolean; theme?: Theme; error?: string }>;
}) {
  const [previewKind, setPreviewKind] = useState<ThemePreviewKind>("homepage");
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const libraryThemes = useMemo(() => [...customThemes, ...themes], [customThemes]);
  const validation = useMemo(() => validateTheme(course.theme), [course.theme]);
  const styles = useMemo(() => getThemeStyles(course.theme), [course.theme]);
  const previewHtml = useMemo(() => buildThemePreviewHtml(course.theme, previewKind, course.title), [course.theme, previewKind, course.title]);
  const editedObjects = [
    ...course.pages,
    ...course.assignments,
    ...course.discussions,
    ...course.quizzes,
    ...course.rubrics,
    ...course.modules
  ].filter((item) => item.status === "edited").length;
  const builderThemeDrift = [
    course.homepage && course.homepage.mode === "builder" && course.homepage.themeId !== course.theme.id ? "Homepage" : null,
    course.syllabus && course.syllabus.mode === "builder" && course.syllabus.themeId !== course.theme.id ? "Syllabus" : null
  ].filter((value): value is string => Boolean(value));

  const chooseTheme = (theme: Theme): void => {
    setRefreshNotice(null);
    onUpdateCourse((current) => ({ ...current, theme, settings: { ...current.settings, themeId: theme.id }, status: "edited" }));
  };

  const refreshThemeStyling = (): void => {
    onUpdateCourse((current) => applyThemeToGeneratedContent(current, current.theme));
    setRefreshNotice("Theme styling refreshed. Template-generated content was recolored, builder pages received snapshots, and manually edited objects were preserved where possible.");
  };

  return (
    <div className="theme-system">
      <section className="theme-summary-card">
        <div>
          <span className="hp-eyebrow"><Palette size={14} /> Canvas visual design system</span>
          <h2>{course.theme.name}</h2>
          <p>
            Theme selection updates this preview immediately. Use refresh when you are ready to recolor generated Canvas HTML while preserving manually edited content.
          </p>
          <div className="theme-summary-meta">
            <span>{course.theme.bannerLabel}</span>
            <span>{validation.score}% contrast score</span>
            <span>{editedObjects} edited object(s) preserved on refresh</span>
          </div>
        </div>
        <div className={`theme-access-badge ${validation.status}`}>
          {validation.status === "pass" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
          <strong>{validation.status === "pass" ? "Accessible" : "Needs review"}</strong>
          <small>{validation.warnings ? `${validation.warnings} contrast warning(s)` : "All theme checks pass"}</small>
        </div>
      </section>

      <div className="theme-token-grid" aria-label="Theme color tokens">
        <ThemeSwatch label="Accent" value={styles.accent} />
        <ThemeSwatch label="Accent dark" value={styles.accentDark} />
        <ThemeSwatch label="Soft background" value={styles.soft} />
        <ThemeSwatch label="Contrast text" value={styles.contrastText} />
        <ThemeSwatch label="Button text" value={styles.onAccent} />
      </div>

      <div className="theme-workbench">
        <section className="theme-library-panel">
          <header>
            <div>
              <h2>Theme Library</h2>
              <p>Higher-ed palettes with Canvas-safe colors and readable button/link states.</p>
            </div>
          </header>
          <div className="theme-grid">
            {libraryThemes.map((theme) => {
              const themeCheck = validateTheme(theme);
              const isCustom = theme.id.startsWith("custom_");
              return (
                <button
                  key={theme.id}
                  className={`theme-choice ${course.theme.id === theme.id ? "active" : ""}`}
                  onClick={() => chooseTheme(theme)}
                  aria-pressed={course.theme.id === theme.id}
                >
                  {isCustom && <span className="theme-custom-tag">Custom</span>}
                  <span className="theme-choice-swatches" aria-hidden="true">
                    <i style={{ background: theme.accent }} />
                    <i style={{ background: theme.accentDark }} />
                    <i style={{ background: theme.soft }} />
                  </span>
                  <strong>{theme.name}</strong>
                  <small>{theme.bannerLabel}</small>
                  <em className={themeCheck.status}>{themeCheck.status === "pass" ? "Contrast pass" : "Review contrast"}</em>
                </button>
              );
            })}
          </div>
          <CustomThemeBuilder
            canCreate={canCreateCustomTheme}
            currentThemeId={course.theme.id}
            onApply={(theme) => chooseTheme(theme)}
            onSave={onSaveCustomTheme}
          />
        </section>

        <section className="theme-preview-panel">
          <header>
            <div>
              <h2>Live Canvas Preview</h2>
              <p>See how the selected theme treats common exported Canvas surfaces.</p>
            </div>
            <div className="theme-preview-tabs" role="tablist" aria-label="Theme preview type">
              {themePreviewModes.map((mode) => (
                <button key={mode.id} className={previewKind === mode.id ? "active" : ""} onClick={() => setPreviewKind(mode.id)} role="tab" aria-selected={previewKind === mode.id}>
                  {mode.label}
                </button>
              ))}
            </div>
          </header>
          <div className="theme-canvas-frame">
            <div className="theme-canvas-bar">
              <span>Canvas preview</span>
              <strong>{themePreviewModes.find((mode) => mode.id === previewKind)?.label}</strong>
            </div>
            <div className="theme-canvas-page" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </section>
      </div>

      <div className="theme-support-grid">
        <section className="theme-check-panel">
          <header>
            <h2>Theme Safety Checks</h2>
            <span className={`hp-badge ${validation.status === "pass" ? "ok" : "warn"}`}>{validation.status === "pass" ? "Pass" : "Review"}</span>
          </header>
          <ul>
            {validation.checks.map((check) => (
              <li key={check.id} className={check.passed ? "pass" : "warn"}>
                <span>{check.passed ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}</span>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="theme-refresh-card">
          <h2>Refresh Course Theme Styling</h2>
          <p>
            Rebuilds generated homepage, syllabus, guide, module, assignment, discussion, and support page HTML with the selected theme. Manual edits are preserved where possible.
          </p>
          {builderThemeDrift.length > 0 && <p className="theme-refresh-hint">{builderThemeDrift.join(", ")} can be refreshed from structured builder data.</p>}
          <button className="primary" onClick={refreshThemeStyling}>
            <Sparkles size={18} /> Refresh course theme styling
          </button>
          {refreshNotice && <p className="theme-refresh-success"><CheckCircle2 size={15} /> {refreshNotice}</p>}
        </section>

        <section className="theme-refresh-card">
          <h2>Export Assets</h2>
          <p>The exported banner and course tile use the selected theme's soft background, accent, and banner label.</p>
          <ul className="compact-list">
            <li>Homepage banner: {course.settings.imageSettings.homepageBannerMode}</li>
            <li>Course tile: {course.settings.imageSettings.courseTileMode}</li>
            <li>Future image credit limit: {course.settings.imageSettings.futureImageCreditLimit}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}


// Map a readiness check to the editor tab where the user can act on it, so each item is a shortcut.
const readinessTab = (id: string): EditorTab => {
  if (id.startsWith("homepage")) return "Homepage";
  if (id.startsWith("syllabus")) return "Syllabus";
  if (id.startsWith("discussion")) return "Discussions";
  if (id.startsWith("quiz")) return "Quizzes";
  if (id.startsWith("rubric")) return "Rubrics";
  if (id.startsWith("assignment-group") || /^(weight|weights|nonzero-weight)/.test(id)) return "Gradebook Setup";
  if (id.startsWith("assignment")) return "Assignments";
  if (/^(workload|contact|calendar|schedule|due-date|graded-due)/.test(id)) return "Contact Hours";
  if (/^(export|instructor-pdf|syllabus-pdf|human-review|reference-integrity)/.test(id)) return "Export";
  if (/^(module|required-modules|content-module|start-here|instructor-unpublished)/.test(id)) return "Modules";
  if (/^(page-quality|internal-links|placeholder-links|thin-content|empty-content)/.test(id)) return "Pages";
  return "Overview"; // outcomes, objectives, bloom, accessibility, navigation, alignment-map
};

function ReadinessPanel({
  readiness,
  quality,
  validationReport,
  subscriptionActive,
  onJumpToTab
}: {
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  validationReport: ExportValidationReport | null;
  subscriptionActive: boolean;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  // Surface what needs attention first (failed required, then recommended), then the passed checks.
  const ordered = [...readiness.checks].sort((a, b) => {
    const weight = (item: ReadinessCheck): number => (item.passed ? 2 : item.severity === "required" ? 0 : 1);
    return weight(a) - weight(b);
  });
  return (
    <div className="readiness-card">
      <div className="score-ring" style={{ "--score": readiness.score } as CSSProperties} role="img" aria-label={`Course readiness ${readiness.score} percent`}>
        <span>{readiness.score}</span>
      </div>
      <h2>Course Readiness</h2>
      <p>{readiness.blockers === 0 ? "Ready for local package validation." : `${readiness.blockers} required ${readiness.blockers === 1 ? "check needs" : "checks need"} attention.`}</p>
      <div className="export-status">
        <strong>Quality</strong>
        <span>{quality.score}% instructional</span>
      </div>
      <ul className="readiness-list">
        {ordered.map((item) => {
          const target = readinessTab(item.id);
          const Icon = item.passed ? CheckCircle2 : item.severity === "required" ? AlertTriangle : Info;
          return (
            <li key={item.id} className={item.passed ? "passed" : item.severity}>
              <button type="button" onClick={() => onJumpToTab(target)} title={`${item.detail} — go to ${target}`}>
                <Icon size={15} /> <span>{item.label}</span> <ChevronRight size={14} className="readiness-go" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="export-status">
        <strong>Export</strong>
        <span>{subscriptionActive ? "Enabled" : "Subscription required"}</span>
      </div>
      <div className="export-status">
        <strong>IMSCC validation</strong>
        <span>{validationReport ? `${validationReport.score}% local` : "Not run"}</span>
      </div>
    </div>
  );
}

function ObjectReviseBar({ onRevise }: { onRevise: (mode: RevisionMode) => void }) {
  return (
    <div className="object-revise" aria-label="Object revise controls">
      <button className="small-button" onClick={() => onRevise("concise")}>
        <PenLine size={14} /> Tighten
      </button>
      <button className="small-button" onClick={() => onRevise("examples")}>
        <Sparkles size={14} /> Examples
      </button>
      <button className="small-button" onClick={() => onRevise("accessibility")}>
        <CheckCircle2 size={14} /> Access
      </button>
      <button className="small-button" onClick={() => onRevise("rubric")}>
        <ClipboardCheck size={14} /> Rubric
      </button>
    </div>
  );
}

function Input({
  label,
  value,
  type = "text",
  onChange
}: {
  label: string;
  value: string;
  type?: "text" | "date" | "time";
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-input">
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  compact,
  rows = compact ? 4 : 8
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  labels,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// Accordion section used on the Create page so advanced settings stay tucked away until wanted.
function CollapsibleSection({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`collapsible-section ${open ? "open" : ""}`}>
      <button type="button" className="collapsible-head" onClick={onToggle} aria-expanded={open}>
        <ChevronRight size={16} className="collapsible-chevron" />
        <span>{title}</span>
        <small>{open ? "Hide" : "Edit"}</small>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

// Parse-status pill for an attached/pasted source on the Create page.
function SourceStatusBadge({ status }: { status: SourceFile["status"] }) {
  const map: Record<SourceFile["status"], { label: string; tone: string; icon: typeof CheckCircle2 }> = {
    attached: { label: "Attached", tone: "muted", icon: FileText },
    parsing: { label: "Parsing…", tone: "info", icon: Loader2 },
    parsed: { label: "Parsed", tone: "ok", icon: CheckCircle2 },
    "needs-review": { label: "Needs review", tone: "warn", icon: AlertTriangle },
    failed: { label: "Failed to parse", tone: "danger", icon: AlertTriangle }
  };
  const { label, tone, icon: Icon } = map[status];
  return (
    <span className={`source-badge ${tone}`}>
      <Icon size={12} className={status === "parsing" ? "spin" : ""} /> {label}
    </span>
  );
}

export default App;
