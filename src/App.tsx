import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, FlaskConical, LogOut, Wallet, Clock, CreditCard, FileText, Gauge, Home, Info, Layers, LayoutDashboard, ListChecks, Lock, Mail, Menu, Newspaper, Palette, PanelLeft, PenLine, Rocket, ShieldAlert, ShieldCheck, Sparkles, User, Wand2, X } from "lucide-react";
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandHeader, BrandOrbitalAccent, LogoMark, LogoWordmark } from "./components/brand";
import { ReadinessRing } from "./components/ReadinessRing";
import { usePlatformAccess, type UsePlatformAccess } from "./services/usePlatformAccess";
// Public marketing/legal surfaces: leaf views reachable only by navigation, so
// they load on demand. `Landing` (and the widgets it renders) stay EAGER — that
// is the prerendered first paint for 19 SEO routes and must never wait on a chunk.
const PublicBlogIndex = lazy(() => import("./components/blog/PublicBlog").then(m => ({ default: m.PublicBlogIndex })));
const PublicBlogPost = lazy(() => import("./components/blog/PublicBlog").then(m => ({ default: m.PublicBlogPost })));
// Admin consoles are lazy: they sit behind an authenticated role check, are the
// largest single components in the tree, and SuperAdminScreen -> CampaignsManager
// -> waitlistExport pins JSZip into whatever chunk contains it.
const JoinScreen = lazy(() => import("./components/admin/JoinScreen").then(m => ({ default: m.JoinScreen })));
const WorkspaceAdminScreen = lazy(() => import("./components/admin/WorkspaceAdminScreen").then(m => ({ default: m.WorkspaceAdminScreen })));
const SuperAdminScreen = lazy(() => import("./components/admin/SuperAdminScreen").then(m => ({ default: m.SuperAdminScreen })));
// Editor tabs are lazy. Only one renders at a time, and reaching any of them
// requires opening a course — but statically they dragged the course-generation
// engine, every content builder and the export stack onto the landing page.
import { AuthScreen, type AuthScreenMode } from "./components/AuthScreen";
import { applySeo, pathToScreen, screenToPath } from "./seo";
const ExportTab = lazy(() => import("./components/ExportTab").then(m => ({ default: m.ExportTab })));
const PricingPage = lazy(() => import("./components/PricingPage").then(m => ({ default: m.PricingPage })));
const AboutPage = lazy(() => import("./components/AboutPage").then(m => ({ default: m.AboutPage })));
const GuidesPage = lazy(() => import("./components/GuidesPage").then(m => ({ default: m.GuidesPage })));
const ContactPage = lazy(() => import("./components/ContactPage").then(m => ({ default: m.ContactPage })));
const DemoIntro = lazy(() => import("./components/DemoIntro").then(m => ({ default: m.DemoIntro })));
import { DemoTour } from "./components/DemoTour";
const LegalPage = lazy(() => import("./components/LegalPage").then(m => ({ default: m.LegalPage })));
const IntegrationPage = lazy(() => import("./components/IntegrationPage").then(m => ({ default: m.IntegrationPage })));
const FoundingCohortPage = lazy(() => import("./components/FoundingCohortPage").then(m => ({ default: m.FoundingCohortPage })));
import { PublicFooter } from "./components/PublicFooter";
import { CampaignBanner } from "./components/CampaignBanner";
import { ProductWalkthrough } from "./components/ProductWalkthrough";
import { CourseBlueprintPreview } from "./components/CourseBlueprintPreview";
import { ReviewMode } from "./components/ReviewMode";
import { GuidedJourney, type WorkflowFocusHandle } from "./components/GuidedJourney";
import { ExperienceChrome } from "./components/ExperienceChrome";
import { progressSteps, type EditorTab } from "./screens/appModel";
import { ScreenSkeleton } from "./components/ScreenSkeleton";
// Screens extracted from App.tsx. Landing stays EAGER (prerendered first paint);
// everything reachable only by navigation is lazy.
const BlueprintReview = lazy(() => import("./screens/BlueprintReview").then(m => ({ default: m.BlueprintReview })));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen").then(m => ({ default: m.Dashboard })));
const Editor = lazy(() => import("./screens/EditorScreen").then(m => ({ default: m.Editor })));
const Intake = lazy(() => import("./screens/IntakeScreen").then(m => ({ default: m.Intake })));
const Progress = lazy(() => import("./screens/ProgressScreen").then(m => ({ default: m.Progress })));
const WelcomeSummary = lazy(() => import("./screens/WelcomeSummary").then(m => ({ default: m.WelcomeSummary })));
import { moveItem, renumberModules } from "./components/editor/shared";
// Extracted editor screens, loaded on demand. ThemeTab in particular is the only
// consumer of data/visualTemplates and the main consumer of data/themes, so
// deferring it is what lets those leave the first paint.
const ThemeTab = lazy(() => import("./components/editor/ThemeTab").then(m => ({ default: m.ThemeTab })));
import { isChunkLoadError } from "./components/ChunkErrorBoundary";
import { CommandPalette } from "./components/CommandPalette";
import { typeToTab, type CommandContext } from "./workflows/commandRegistry";
import { getExperience, resolveExperienceId } from "./workflows/experienceRegistry";
import { loadCoursePreferred, saveCoursePreferred } from "./workflows/workflowContext";
import { useAuthSession, type AuthSessionState } from "./auth/useAuthSession";
import type { CourseBlueprint } from "./ai/blueprint";
// aiGeneration and courseTransforms both reach services/courseGenerator, whose
// module body generates the demo course at evaluation time. Import them at the
// call site so neither pulls the generation engine onto the first paint.
import { recordCourseAiSpend } from "./services/aiSpendMeter";
import type { ChatCompletionCost } from "./services/openaiClient";
import { customThemesEnabled, listCustomThemes, saveCustomTheme, type CustomThemeInput } from "./services/customThemes";
import { openBillingPortal, startCheckout } from "./billing/checkout";
import { defaultSettings } from "./data/defaultSettings";
import type { Plan, PlanKey } from "./data/plans";
import { plans } from "./data/plans";
import { themes } from "./data/themes";
// courseGenerator is NEVER imported statically: it executes a full course
// generation at module scope (see services/sampleCourse.ts). Identity constants
// and the lazy materializer come from that tiny module instead; the generator
// itself is awaited at the call sites that actually generate.
import { getSampleProject, PLACEHOLDER_COURSE, SAMPLE_PROJECT_EXPORT_MODE, SAMPLE_PROJECT_ID } from "./services/sampleCourse";
import { visualTemplates } from "./data/visualTemplates";
import { buildCourseQualityReport } from "./services/courseQuality";
// The export / import / PDF cluster is deliberately NOT imported statically.
// It pulls JSZip (~96 kB) plus the IMSCC, QTI and PDF engines — none of which a
// visitor needs to render the landing page. Every entry point below is a click
// handler that already awaits, so each one `await import(...)`s its engine at
// the call site. See the `type` imports kept below for signatures only (erased
// at build time, so they cost nothing).
import type { FullFillProgress } from "./services/fullCourseContent";
import { augmentPromptWithSources, parseSourceFile } from "./services/sourceParsing";
import { duplicateModuleWithContent, moveModuleItem, removeModule } from "./services/modulePlanner";
import { listProjectSummaries, listProjects, persistenceEnabled, saveProject, type ProjectSummary } from "./services/projectStore";
import { buildReadinessReport } from "./services/readiness";
import { repairCourse } from "./services/courseRepair";

import { buildScheduleContext } from "./services/scheduleInput";
import { inferSettingsFromPrompt } from "./services/promptInference";
import type { CourseProject, CourseSettings, ExportMode, ExportValidationReport, Quiz, Screen, SourceFile, Theme } from "./types";


const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};







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
  const [screen, setScreenNow] = useState<Screen>(() => pathToScreen(window.location.pathname));
  // Every screen except Landing is React.lazy, so a screen change can suspend.
  // Doing that from a click handler is a SYNCHRONOUS update, which React refuses
  // to suspend on: it warns "A component suspended while responding to
  // synchronous input" and replaces the whole UI with the fallback. Marking the
  // navigation as a transition is the documented fix, and it is also the better
  // experience — React keeps the current screen on-screen until the next one's
  // chunk has arrived, instead of flashing a skeleton. Wrapping the setter keeps
  // all 41 call sites unchanged.
  const setScreen = useCallback((next: Screen | ((current: Screen) => Screen)) => {
    startTransition(() => setScreenNow(next));
  }, []);
  // Empty until the user's own courses load: a signed-in account must not be
  // pre-populated with the demo course. The dashboard's real "No course projects
  // yet" empty state handles this.
  const [projects, setProjects] = useState<CourseProject[]>([]);
  // Lightweight card data shown while the full project payloads are still downloading.
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  // Placeholder, never rendered: the editor is unreachable at boot (pathToScreen
  // cannot return "editor"), so a real course is always set before anything
  // reads this. Keeps `course` non-nullable across ~100 call sites.
  const [course, setCourse] = useState<CourseProject>(PLACEHOLDER_COURSE);
  const [settings, setSettings] = useState<CourseSettings>(defaultSettings);
  // Starts empty on purpose: seeding this with the sample prompt made every generation
  // that didn't overwrite it inherit the demo's "AI and Modern Society" topic.
  const [prompt, setPrompt] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>("Overview");
  // Which of the nine workflow experiences renders the editor screen.
  // Hierarchy: ?exp= deep link → course-specific preference → user preference
  // → the default (Guided Course Journey). Presentation only — switching an
  // experience never touches course content.
  const [experienceId, setExperienceId] = useState<string>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("exp");
    if (fromUrl && getExperience(fromUrl)?.enabled) return fromUrl;
    return resolveExperienceId(loadCoursePreferred(SAMPLE_PROJECT_ID));
  });
  const chooseExperience = (id: string): void => {
    if (!getExperience(id)?.enabled) return;
    // Experience workspaces are lazy-loaded; switching synchronously from an
    // event handler suspends mid-input and trips the error boundary. A
    // transition lets the current experience stay up while the next one loads.
    startTransition(() => setExperienceId(id));
    saveCoursePreferred(course.id, id);
    const url = new URL(window.location.href);
    url.searchParams.set("exp", id);
    window.history.replaceState(window.history.state, "", url.toString());
  };
  // Command palette (⌘K) — one shared command surface across every experience.
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Detailed-editor overlay for the guided journey: opening a full editor tab
  // never switches the experience — the journey stays mounted (and keeps its
  // place) underneath while the workspace opens on top with a way back.
  const [focusTab, setFocusTab] = useState<EditorTab | null>(null);
  // The Editor chunk is lazy; mounting it from a click must be a transition or
  // React refuses to suspend on the synchronous update and trips the boundary.
  const openFocusEditor = (tab: EditorTab): void => {
    setActiveTab(tab);
    startTransition(() => setFocusTab(tab));
  };
  const workflowFocusRef = useRef<WorkflowFocusHandle | null>(null);
  const auth = useAuthSession();
  const access = usePlatformAccess(auth.session);
  const adminWorkspaces = access.workspaces.filter((w) => w.myRole === "owner" || w.myRole === "admin");
  const workspaceForAdmin =
    (access.defaultWorkspaceId && adminWorkspaces.some((w) => w.id === access.defaultWorkspaceId)
      ? access.defaultWorkspaceId
      : adminWorkspaces[0]?.id ?? access.workspaces[0]?.id) ?? null;
  const blogSlug = screen === "blogPost" ? decodeURIComponent(window.location.pathname.replace(/^\/blog\//, "")) : "";
  const [authMode, setAuthMode] = useState<AuthScreenMode>("login");
  // Real export entitlement, derived from the trusted subscription snapshot — no fake toggle.
  const subscriptionActive = auth.entitlement.canExport;
  const [validationReport, setValidationReport] = useState<ExportValidationReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastDownloadName, setLastDownloadName] = useState<string | null>(null);
  // Whole-course "flesh it out" pass: runs every per-object AI builder so the export
  // packages a complete course rather than the templated scaffold.
  const [isFillingContent, setIsFillingContent] = useState(false);
  const [fillProgress, setFillProgress] = useState<FullFillProgress | null>(null);
  const [fillSummary, setFillSummary] = useState<string | null>(null);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ moduleId: string; itemId: string } | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>(SAMPLE_PROJECT_EXPORT_MODE);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  // Blueprint is priced before the course exists; stash its cost and attribute it on approval.
  const blueprintCostRef = useRef<ChatCompletionCost | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PlanKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Demo mode: the public, pre-populated sample course explored without AI/account. `demoActive`
  // turns on the demo chrome (banner + Back to Home) in the editor; `tourOpen` runs the walkthrough.
  const [demoActive, setDemoActive] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // Celebratory summary shown once right after a course finishes generating, framing the
  // editor as "review what we built" instead of dropping users into a cold workspace.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // Card-by-card review of every generated item: approve or flag each once.
  const [reviewOpen, setReviewOpen] = useState(false);
  // The public sample course is freely exportable inside the demo (the .imscc/QTI/PDF packages are
  // built entirely in the browser from in-browser data — no server secret is involved). Real
  // user-generated courses still require a paid plan; the costly server-side AI stays entitlement-gated.
  const exportAllowed = subscriptionActive || demoActive;

  // A course explicitly opened with its own preferred experience wins over the
  // session's current one (deep-linked ?exp= already seeded initial state).
  useEffect(() => {
    const fromCourse = loadCoursePreferred(course.id);
    if (fromCourse && getExperience(fromCourse)?.enabled) setExperienceId(fromCourse);
  }, [course.id]);

  // The detailed-editor layer belongs to one journey session — leaving the
  // editor or deliberately switching experiences closes it.
  useEffect(() => {
    setFocusTab(null);
  }, [screen, experienceId]);

  const readiness = useMemo(() => buildReadinessReport(course), [course]);
  const quality = useMemo(() => buildCourseQualityReport(course), [course]);
  const homepage = course.pages.find((page) => page.frontPage) ?? course.pages[0];
  const syllabus = course.pages.find((page) => page.slug === "syllabus") ?? course.pages[1];

  useEffect(() => {
    if (screen !== "progress") return;
    if (progressIndex >= progressSteps.length) {
      // Normally pre-generated by startGeneration (so Progress can show real module
      // titles); the fallback covers any path that reaches "progress" without it.
      void (async () => {
      const { generateCourseProject } = await import("./services/courseGenerator");
      const generated: CourseProject =
        pendingCourseRef.current ?? {
          ...generateCourseProject({
            prompt: augmentPromptWithSources(prompt, settings.sourceFiles) + buildScheduleContext(settings.schedule),
            settings
          }),
          id: `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
        };
      pendingCourseRef.current = null;
      setCourse(generated);
      setProjects((current) => [generated, ...current.filter((project) => project.id !== generated.id)]);
      setValidationReport(null);
      setImportNotes([]);
      setExportMode(generated.exportMode);
      setActiveTab("Overview");
      setDemoActive(false);
      setTourOpen(false);
      setWelcomeOpen(true);
      setScreen("editor");
      })();
      return;
    }
    const timer = window.setTimeout(() => setProgressIndex((index) => index + 1), 420);
    return () => window.clearTimeout(timer);
  }, [progressIndex, prompt, screen, settings]);

  // Route guard: the authenticated dashboard requires a session. Unauthenticated users are sent
  // to sign in. (Landing, pricing, and the public sample editor stay open.) Once a session exists,
  // leave the auth screens for the dashboard.
  const bootRedirectRef = useRef(false);
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session && (screen === "dashboard" || screen === "workspace" || screen === "admin")) {
      setAuthMode("login");
      setScreen("login");
    }
    if (auth.session && (screen === "login" || screen === "signup")) {
      setScreen("dashboard");
    }
    // On the FIRST resolved auth check only: a signed-in user loading "/" gets
    // their dashboard, not the marketing homepage. In-app navigation to the
    // homepage afterwards is left alone.
    if (!bootRedirectRef.current) {
      bootRedirectRef.current = true;
      if (auth.session && screen === "landing" && window.location.pathname === "/") {
        setScreen("dashboard");
      }
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
    const current = window.location.pathname.replace(/\/+$/, "") || "/";
    // Integration is a family of /integration/<lms> URLs reached by full navigation; keep the
    // current path rather than collapsing every one of them to the hub.
    const desired = screen === "integration" ? current : screenToPath(screen);
    if (current !== (desired.replace(/\/+$/, "") || "/")) {
      window.history.pushState({ screen }, "", desired);
    }
    // MUST run after pushState: applySeo resolves the route by
    // window.location.pathname first (so /integration/<lms> gets its own meta),
    // so calling it before the URL moves tags the page with the PREVIOUS
    // screen's title, canonical and OG data — one navigation behind, every time.
    applySeo(screen);
  }, [screen]);

  // Back/forward buttons: restore the screen from the URL.
  useEffect(() => {
    const onPopState = () => setScreen(pathToScreen(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Load the signed-in user's saved projects from Supabase (replacing the local sample list).
  // Two phases: a lightweight summary query paints the dashboard immediately, while the
  // full course_json batch (potentially many MB across all projects) hydrates behind it.
  useEffect(() => {
    if (!auth.session || !persistenceEnabled()) return;
    let active = true;
    void listProjectSummaries().then((summaries) => {
      if (active) setProjectSummaries(summaries);
    });
    void listProjects().then((loaded) => {
      // No `loaded.length` guard: it existed only to stop an empty result from
      // wiping the demo course that used to seed this list. The list now starts
      // empty, so an account with no saved courses correctly keeps showing the
      // real "No course projects yet" empty state.
      if (active) {
        setProjects(loaded);
        setProjectSummaries([]);
      }
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
    if (course.id === SAMPLE_PROJECT_ID) return;
    if (!auth.entitlement.canCreateProject) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void saveProject(course).then((result) => setSaveState(result.ok ? "saved" : "error"));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [course, auth.session, auth.entitlement.canCreateProject]);

  // Global undo/redo: every course mutation flows through updateCourse, and updates are
  // immutable, so a bounded stack of previous course states gives uniform undo across
  // every tab for the price of holding references.
  const UNDO_LIMIT = 50;
  const undoStackRef = useRef<CourseProject[]>([]);
  const redoStackRef = useRef<CourseProject[]>([]);
  // Bumped whenever the stacks change so the header buttons' disabled states re-render.
  const [, setHistoryVersion] = useState(0);

  // Switching to a different course invalidates its history.
  const historyCourseIdRef = useRef(course.id);
  useEffect(() => {
    if (historyCourseIdRef.current === course.id) return;
    historyCourseIdRef.current = course.id;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, [course.id]);

  const updateCourse = (updater: (current: CourseProject) => CourseProject): void => {
    setCourse((current) => {
      const updatedAt = new Date().toISOString();
      const updated = { ...updater(current), updatedAt, status: "edited" as const, metadata: { ...current.metadata, updatedAt, source: "edited" as const } };
      // Reference-compare so a double-invoked updater (StrictMode) can't push twice.
      if (undoStackRef.current[undoStackRef.current.length - 1] !== current) {
        undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_LIMIT - 1)), current];
        redoStackRef.current = [];
      }
      setProjects((projectList) => projectList.map((project) => (project.id === updated.id ? updated : project)));
      return updated;
    });
    setValidationReport(null);
    setHistoryVersion((version) => version + 1);
  };

  // AI-first repair: run the deterministic repair engine over the course, apply
  // the result, and return the list of what was fixed so the UI can celebrate
  // quietly ("✓ Fixed automatically") instead of handing the user a to-do list.
  // repairCourse is pure and idempotent, so this is always safe to call.
  const autoRepairCourse = (): string[] => {
    const { course: repaired, repairs } = repairCourse(course);
    if (repairs.length) updateCourse(() => repaired);
    return repairs;
  };

  const undoCourse = (): void => {
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setCourse((current) => {
      if (redoStackRef.current[redoStackRef.current.length - 1] !== current) {
        redoStackRef.current = [...redoStackRef.current, current];
      }
      setProjects((projectList) => projectList.map((project) => (project.id === previous.id ? previous : project)));
      return previous;
    });
    setValidationReport(null);
    setHistoryVersion((version) => version + 1);
  };

  const redoCourse = (): void => {
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    if (!next) return;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    setCourse((current) => {
      if (undoStackRef.current[undoStackRef.current.length - 1] !== current) {
        undoStackRef.current = [...undoStackRef.current, current];
      }
      setProjects((projectList) => projectList.map((project) => (project.id === next.id ? next : project)));
      return next;
    });
    setValidationReport(null);
    setHistoryVersion((version) => version + 1);
  };

  // Cmd/Ctrl+Z (redo: +Shift) in the editor — but never while typing in a field, where
  // the browser's native text undo must keep working.
  useEffect(() => {
    if (screen !== "editor") return;
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redoCourse();
      else undoCourse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // undoCourse/redoCourse only touch refs and stable setters, so the closure stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ⌘K / Ctrl+K — open the shared command palette in the editor (safe from any
  // field; it's a dedicated chord). Esc/selection close it from inside.
  useEffect(() => {
    if (screen !== "editor") return;
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const updateSettings = <K extends keyof CourseSettings>(key: K, value: CourseSettings[K]): void => {
    setSettings((current) => {
      if (key === "courseLengthPreset" && typeof value === "string" && value !== "custom") {
        const weeks = lengthPresetWeeks[value as CourseSettings["courseLengthPreset"]];
        return { ...current, [key]: value, lengthWeeks: weeks, moduleCount: Math.max(1, weeks) };
      }
      return { ...current, [key]: value };
    });
  };

  // Fresh intake: a new course must never inherit the previous course's settings,
  // attached sources, or prompt. A seeded prompt (landing teaser) survives the reset.
  const startNewIntake = (seedPrompt = ""): void => {
    setSettings(defaultSettings);
    setPrompt(seedPrompt);
    setBlueprint(null);
    setAiError(null);
    setScreen(auth.session ? "intake" : "signup");
  };

  // Generate the course up front so the progress screen can reveal the REAL module
  // titles as it advances — evidence the draft is substantive, not a generic spinner.
  const pendingCourseRef = useRef<CourseProject | null>(null);

  const startGeneration = async (): Promise<void> => {
    const { generateCourseProject } = await import("./services/courseGenerator");
    const base = generateCourseProject({
      prompt: augmentPromptWithSources(prompt, settings.sourceFiles) + buildScheduleContext(settings.schedule),
      settings
    });
    // The generator derives its id from the title slug; give every generated project a
    // unique id so it persists as its own row and never shadows the public sample.
    pendingCourseRef.current = { ...base, id: `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}` };
    setProgressIndex(0);
    setScreen("progress");
  };

  // Real AI: generate a blueprint server-side (auth + entitlement enforced there), then show it for
  // approval. Falls back with a friendly error if the AI route is unreachable or denied.
  const handleGenerateBlueprint = async (): Promise<void> => {
    setAiBusy(true);
    setAiError(null);
    try {
      const { generateBlueprint } = await import("./services/aiGeneration");
      const result = await generateBlueprint(
        augmentPromptWithSources(prompt, settings.sourceFiles) + buildScheduleContext(settings.schedule),
        settings
      );
      setBlueprint(result.blueprint);
      blueprintCostRef.current = result.cost;
      setScreen("blueprint");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Blueprint generation failed.");
    } finally {
      setAiBusy(false);
    }
  };

  // Approve the blueprint → build a full, export-valid course seeded by it, then open the editor.
  const approveBlueprint = async (): Promise<void> => {
    if (!blueprint) return;
    const { buildCourseFromBlueprint } = await import("./services/aiGeneration");
    const generated = buildCourseFromBlueprint(blueprint, settings, prompt);
    // Attribute the blueprint's real cost to the course now that it has an id.
    recordCourseAiSpend(generated.id, blueprintCostRef.current);
    blueprintCostRef.current = null;
    setCourse(generated);
    setProjects((current) => [generated, ...current.filter((project) => project.id !== generated.id)]);
    setValidationReport(null);
    setImportNotes([]);
    setExportMode(generated.exportMode);
    setActiveTab("Overview");
    setDemoActive(false);
    setTourOpen(false);
    setWelcomeOpen(true);
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
      const { importCanvasCourseFromImscc } = await import("./services/imsccImport").catch((error) => {
        setExportError("The Canvas import tools could not be loaded. Reload the page and try again.");
        throw error;
      });
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

  // Build + validate the package locally without downloading. Separating validation from download
  // keeps the workflow honest: the user can inspect the local report before committing to a file.
  const runValidation = async (): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    try {
      const { generateImsccBlob } = await import("./services/imsccExport");
      const { report } = await generateImsccBlob({ ...course, exportMode }, exportMode);
      setValidationReport(report);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Local validation failed unexpectedly.");
    } finally {
      setIsExporting(false);
    }
  };

  // Build + validate + download one specific course snapshot. Shared by the plain download and the
  // "generate full content, then download" flow so both go through the same validation gate.
  const exportCourseToFile = async (courseToExport: CourseProject): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    setLastDownloadName(null);
    try {
      const { generateImsccBlob } = await import("./services/imsccExport");
      const { blob, report, fileName } = await generateImsccBlob({ ...courseToExport, exportMode }, exportMode);
      setValidationReport(report);
      if (!report.valid) {
        // The export pipeline already ran the automatic repair engine, so what
        // remains genuinely needs the instructor's judgment (e.g. a quiz with no
        // questions). Say what was attempted and what's left — never send the
        // user hunting through other tabs.
        const blockerCount = report.issues.filter((issue) => issue.severity === "error").length;
        setExportError(
          `RocketCourse repaired everything that could be fixed automatically, but ${blockerCount} issue${blockerCount === 1 ? " still needs" : "s still need"} ` +
            `your judgment before the package would import cleanly into Canvas. Each one is listed below with exactly what to do.`
        );
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

  const downloadPackage = async (): Promise<void> => {
    if (!exportAllowed) return;
    await exportCourseToFile(course);
  };

  // Run every per-object AI builder across the course so the package is a complete course, not a
  // templated scaffold. Returns the filled course so a caller can export it without waiting on
  // React state to settle. Never throws past the proxy: each builder falls back to its template.
  const fillFullCourseContent = async (): Promise<CourseProject | null> => {
    if (!exportAllowed) return null;
    setIsFillingContent(true);
    setExportError(null);
    setFillSummary(null);
    try {
      // Inside the try: a failed chunk fetch must reach the catch below, or the
      // caller reports success for content that was never generated.
      const { fillEntireCourseContent, planFullCourseFill } = await import("./services/fullCourseContent");
      const plan = planFullCourseFill(course);
      if (plan.total === 0) {
        setFillSummary("Nothing to fill — this course has no lessons, assignments, discussions, or quizzes yet.");
        return course;
      }
      setFillProgress({ completed: 0, total: plan.total, label: "Starting" });
      const result = await fillEntireCourseContent(course, { onProgress: setFillProgress });
      updateCourse(() => result.course);
      const { pages, assignments, discussions, quizzes, announcements } = result.applied;
      const filledParts = [
        pages ? `${pages} page${pages === 1 ? "" : "s"}` : "",
        assignments ? `${assignments} assignment${assignments === 1 ? "" : "s"}` : "",
        discussions ? `${discussions} discussion${discussions === 1 ? "" : "s"}` : "",
        quizzes ? `${quizzes} quiz${quizzes === 1 ? "" : "zes"}` : "",
        announcements ? `${announcements} announcement${announcements === 1 ? "" : "s"}` : ""
      ].filter(Boolean);
      // Fresh AI drafts arrive flagged for human review, so the readiness score
      // usually DIPS right after a fill. Say so — otherwise "generate" reading
      // as "made my course worse" is the natural (wrong) conclusion.
      const scoreBefore = buildReadinessReport(course).score;
      const scoreAfter = buildReadinessReport(result.course).score;
      const scoreNote =
        result.aiCount > 0 && scoreAfter < scoreBefore
          ? ` Readiness moved ${scoreBefore} → ${scoreAfter} because new AI drafts start as “needs review” — approving them in Review course brings it back up.`
          : "";
      setFillSummary(
        result.aiCount === 0
          ? "AI was unreachable, so every object kept its structured template. Check that the AI proxy (netlify dev) is running, then try again."
          : `Generated full content for ${filledParts.join(", ") || "the course"}.${result.fallbackCount ? ` ${result.fallbackCount} object${result.fallbackCount === 1 ? "" : "s"} kept the template (AI unavailable).` : ""}${scoreNote}`
      );
      return result.course;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Generating full course content failed unexpectedly.");
      return null;
    } finally {
      setIsFillingContent(false);
      setFillProgress(null);
    }
  };

  // Every download engine below is code-split, so a click can now fail on a
  // chunk fetch (e.g. the tab was open across a deploy). Those rejections happen
  // outside React's render phase, so the error boundary cannot see them and the
  // `() => void` prop signatures discard the promise — without this the button
  // would silently do nothing, permanently. Report the same way the .imscc
  // export path already does, so ExportTab renders it.
  const withDownloadErrors = async (what: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      setExportError(
        isChunkLoadError(error)
          ? `RocketCourse updated while this tab was open, so the ${what} tools could not load. Reload the page and try again.`
          : error instanceof Error
            ? `Could not build the ${what}: ${error.message}`
            : `Could not build the ${what}.`
      );
    }
  };

  // Download a readable PDF copy of the whole course (no Canvas import needed).
  // These handlers are async only because the PDF/QTI engines are code-split —
  // `() => Promise<void>` is assignable to the `() => void` props they feed, so
  // no downstream signature changes.
  const downloadCoursePdf = async (): Promise<void> => {
    if (!exportAllowed) return;
    await withDownloadErrors("course PDF", async () => {
      const { coursePdfFileName, generateCoursePdfBlob } = await import("./services/coursePdf");
      downloadBlob(generateCoursePdfBlob(course), coursePdfFileName(course));
    });
  };

  // Download a clean PDF of the syllabus (aligned with the Canvas syllabus page).
  const downloadSyllabusPdf = async (): Promise<void> => {
    if (!exportAllowed) return;
    await withDownloadErrors("syllabus PDF", async () => {
      const { buildSyllabusPdfBlob, syllabusPdfFileName } = await import("./services/syllabusPdf");
      downloadBlob(buildSyllabusPdfBlob(course), syllabusPdfFileName(course));
    });
  };

  // Download every quiz as one bulk Canvas-importable QTI .zip.
  const downloadAllQuizzesQti = async (): Promise<void> => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    await withDownloadErrors("quiz QTI package", async () => {
      const { generateAllQuizzesQtiBlob } = await import("./services/imsccExport");
      const { blob, fileName } = await generateAllQuizzesQtiBlob(course);
      downloadBlob(blob, fileName);
    });
  };

  // Download a single quiz as a standalone QTI .zip.
  const downloadQuizQti = async (quiz: Quiz): Promise<void> => {
    if (!exportAllowed) return;
    await withDownloadErrors("quiz QTI package", async () => {
      const { generateQuizQtiBlob } = await import("./services/imsccExport");
      const { blob, fileName } = await generateQuizQtiBlob(quiz);
      downloadBlob(blob, fileName);
    });
  };

  // Printable quiz PDFs — student copy and instructor answer key (single + combined).
  const downloadQuizStudentPdf = async (quiz: Quiz): Promise<void> => {
    if (!exportAllowed) return;
    await withDownloadErrors("quiz PDF", async () => {
      const { buildQuizStudentPdfBlob, quizStudentPdfFileName } = await import("./services/quizPdf");
      downloadBlob(buildQuizStudentPdfBlob(course, quiz), quizStudentPdfFileName(course, quiz));
    });
  };
  const downloadQuizAnswerKeyPdf = async (quiz: Quiz): Promise<void> => {
    if (!exportAllowed) return;
    await withDownloadErrors("answer key PDF", async () => {
      const { buildQuizAnswerKeyPdfBlob, quizAnswerKeyPdfFileName } = await import("./services/quizPdf");
      downloadBlob(buildQuizAnswerKeyPdfBlob(course, quiz), quizAnswerKeyPdfFileName(course, quiz));
    });
  };
  const downloadAllQuizzesStudentPdf = async (): Promise<void> => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    await withDownloadErrors("quiz PDFs", async () => {
      const { buildAllQuizzesStudentPdfBlob, allQuizzesStudentPdfFileName } = await import("./services/quizPdf");
      downloadBlob(buildAllQuizzesStudentPdfBlob(course), allQuizzesStudentPdfFileName(course));
    });
  };
  const downloadAllQuizzesAnswerKeyPdf = async (): Promise<void> => {
    if (!exportAllowed || course.quizzes.length === 0) return;
    await withDownloadErrors("answer key PDFs", async () => {
      const { buildAllQuizzesAnswerKeyPdfBlob, allQuizzesAnswerKeyPdfFileName } = await import("./services/quizPdf");
      downloadBlob(buildAllQuizzesAnswerKeyPdfBlob(course), allQuizzesAnswerKeyPdfFileName(course));
    });
  };

  // Enter the public demo: load the static sample course, turn on demo chrome, optionally start the
  // guided tour. No AI, no account, nothing persisted.
  const enterDemo = async (withTour: boolean): Promise<void> => {
    // Generates the demo course on first entry (code-split), memoised after.
    const demo = await getSampleProject();
    setCourse(demo);
    setExportMode(demo.exportMode);
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
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopBar
        screen={screen}
        onNavigate={setScreen}
        auth={auth}
        access={access}
        onSignIn={() => {
          setAuthMode("login");
          setScreen("login");
        }}
        onDemo={() => setScreen("demo")}
        onManageBilling={handleOpenBillingPortal}
      />

      {screen === "landing" && (
        <>
          <Landing
            onStart={() => startNewIntake()}
            onStartWithPrompt={(teaserPrompt) => {
              // Carry the visitor's idea into the intake so they never retype it.
              startNewIntake(teaserPrompt);
            }}
            onDashboard={() => setScreen(auth.session ? "dashboard" : "login")}
            onPricing={() => setScreen("pricing")}
            onTryDemo={() => setScreen("demo")}
            onGuides={() => setScreen("guides")}
            onFoundingCohort={() => setScreen("foundingCohort")}
          />
          <PublicFooter onNavigate={setScreen} />
        </>
      )}
      {screen === "pricing" && (
        <Suspense fallback={<ScreenSkeleton label="Loading pricing" />}>
          <PricingPage
            onChoosePlan={handleChoosePlan}
            onTryDemo={() => setScreen("demo")}
            currentPlanKey={auth.entitlement.planKey}
            busyPlanKey={checkoutBusyPlan}
            error={checkoutError}
          />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "about" && (
        <Suspense fallback={<ScreenSkeleton label="Loading" />}>
          <AboutPage
            onStartBuilding={() => startNewIntake()}
            onTryDemo={() => setScreen("demo")}
            onContact={() => setScreen("contact")}
          />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "guides" && (
        <Suspense fallback={<ScreenSkeleton label="Loading guides" />}>
          <GuidesPage onTryDemo={() => setScreen("demo")} onStartBuilding={() => startNewIntake()} />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "contact" && (
        <Suspense fallback={<ScreenSkeleton label="Loading contact" />}>
          <ContactPage />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "demo" && (
        <Suspense fallback={<ScreenSkeleton label="Loading demo" />}>
          <DemoIntro onStartTour={() => enterDemo(true)} onExplore={() => enterDemo(false)} onBackHome={() => setScreen("landing")} />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {(screen === "terms" || screen === "privacy") && (
        <Suspense fallback={<ScreenSkeleton label="Loading" />}>
          <LegalPage kind={screen} onContact={() => setScreen("contact")} />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "integration" && (
        <Suspense fallback={<ScreenSkeleton label="Loading" />}>
          <IntegrationPage
            onStartBuilding={() => startNewIntake()}
            onTryDemo={() => setScreen("demo")}
          />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "foundingCohort" && (
        <Suspense fallback={<ScreenSkeleton label="Loading" />}>
          <FoundingCohortPage
            onStartBuilding={() => startNewIntake()}
            onTryDemo={() => setScreen("demo")}
          />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
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
        <DashboardScreen
          projects={projects}
          summaries={projectSummaries}
          entitlement={auth.entitlement}
          onCreate={() => startNewIntake()}
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
      {screen === "progress" && (
        <Progress progressIndex={progressIndex} moduleTitles={pendingCourseRef.current?.modules.map((module) => module.title) ?? []} />
      )}
      {screen === "editor" && (
        <ExperienceChrome
          courseTitle={course.title.trim() || "Untitled course"}
          experienceId={experienceId}
          readinessScore={readiness.score}
          readinessBlockers={readiness.blockers}
          saveState={auth.session && course.id !== SAMPLE_PROJECT_ID ? saveState : "idle"}
          onSwitch={chooseExperience}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}
      {screen === "editor" && experienceId !== "original" && (
        // hidden (not unmounted) while the detailed editor is open on top, so
        // the journey keeps its stage, module, and decision state.
        <div hidden={focusTab !== null}>
          <GuidedJourney
            ref={workflowFocusRef}
            course={course}
            onUpdateCourse={updateCourse}
            validationReport={validationReport}
            exportAllowed={exportAllowed}
            isFillingContent={isFillingContent}
            fillProgress={fillProgress}
            fillSummary={fillSummary}
            onRunValidation={runValidation}
            onDownload={downloadPackage}
            onFillFullContent={() => { void fillFullCourseContent(); }}
            onAutoRepair={autoRepairCourse}
            onStartBuild={() => startNewIntake()}
            onExit={() => setScreen("dashboard")}
            onOpenFullEditor={openFocusEditor}
          />
        </div>
      )}
      {screen === "editor" && paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          ctx={{
            course,
            experienceId,
            isOriginal: experienceId === "original",
            chooseExperience,
            focusModule: (id) => {
              if (experienceId === "original") setActiveTab("Modules");
              else if (workflowFocusRef.current?.focusModule(id)) setFocusTab(null);
            },
            focusRef: (refId, type) => {
              if (experienceId === "original") setActiveTab(typeToTab(type) as EditorTab);
              else if (workflowFocusRef.current?.focusRef(refId)) setFocusTab(null);
            },
            goDashboard: () => setScreen("dashboard"),
            runValidation,
            download: downloadPackage,
            canExport: exportAllowed,
            openReview: () => setReviewOpen(true),
            undo: undoCourse,
            redo: redoCourse,
            canUndo: undoStackRef.current.length > 0,
            canRedo: redoStackRef.current.length > 0,
            setTab: (tab) => setActiveTab(tab as EditorTab),
          } satisfies CommandContext}
        />
      )}
      {screen === "editor" && (experienceId === "original" || focusTab !== null) && (() => {
        const editorSurface = (
        <Editor
          course={course}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          readiness={readiness}
          quality={quality}
          subscriptionActive={exportAllowed}
          imageSubscriptionActive={subscriptionActive}
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
          onFillFullContent={fillFullCourseContent}
          isFillingContent={isFillingContent}
          fillProgress={fillProgress}
          fillSummary={fillSummary}
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
          exportMode={exportMode}
          onExportModeChange={setExportMode}
          importNotes={importNotes}
          saveState={auth.session && course.id !== SAMPLE_PROJECT_ID ? saveState : "idle"}
          customThemes={customThemes}
          canCreateCustomTheme={auth.entitlement.canCreateCustomTheme}
          onSaveCustomTheme={handleSaveCustomTheme}
          demoMode={demoActive}
          onExitDemo={exitDemo}
          onOpenReview={() => setReviewOpen(true)}
          canUndo={undoStackRef.current.length > 0}
          canRedo={redoStackRef.current.length > 0}
          onUndo={undoCourse}
          onRedo={redoCourse}
          focusMode={experienceId !== "original"}
        />
        );
        // In the Advanced Workspace the editor IS the experience. From the
        // guided journey it opens as a layer with an always-visible way back —
        // the journey never silently becomes a different app.
        if (experienceId === "original") return editorSurface;
        return (
          <div className="focus-editor" role="region" aria-label="Detailed editor, opened from your guided journey">
            <div className="focus-editor__bar">
              <button type="button" className="primary" onClick={() => setFocusTab(null)}>
                ← Back to your journey
              </button>
              <span className="focus-editor__note">
                Detailed editor · same course — everything you change here is kept when you go back.
              </span>
            </div>
            {editorSurface}
          </div>
        );
      })()}
      {screen === "editor" && demoActive && tourOpen && (
        <DemoTour onSetTab={setActiveTab} onClose={() => setTourOpen(false)} />
      )}
      {screen === "editor" && welcomeOpen && !demoActive && (
        <WelcomeSummary
          course={course}
          onStartReviewing={() => {
            setWelcomeOpen(false);
            // Hand off to the guided journey, which enters built courses at its
            // Review stage — the natural first stop after a fresh draft.
            chooseExperience("guided-journey");
          }}
          onDismiss={() => setWelcomeOpen(false)}
        />
      )}
      {screen === "editor" && reviewOpen && (
        <ReviewMode
          course={course}
          onClose={() => setReviewOpen(false)}
          onJumpToTab={setActiveTab}
          onJumpToItem={(refId, tab) => {
            // In the Advanced Workspace a tab switch is the right landing; in the
            // guided journey, deep-link straight to the item being fixed (closing
            // the detailed-editor layer if it was open), falling back to opening
            // that layer at the right tab — never switching experiences.
            if (experienceId === "original") {
              setActiveTab(tab);
              return;
            }
            if (workflowFocusRef.current?.focusRef(refId)) setFocusTab(null);
            else openFocusEditor(tab);
          }}
        />
      )}

      {screen === "blog" && (
        <Suspense fallback={<ScreenSkeleton label="Loading blog" />}>
          <PublicBlogIndex
            onOpenPost={(slug) => {
              window.history.pushState({}, "", `/blog/${slug}`);
              setScreen("blogPost");
            }}
          />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "blogPost" && (
        <Suspense fallback={<ScreenSkeleton label="Loading article" />}>
          <PublicBlogPost slug={blogSlug} onBack={() => setScreen("blog")} />
          <PublicFooter onNavigate={setScreen} />
        </Suspense>
      )}
      {screen === "join" && (
        <Suspense fallback={<ScreenSkeleton label="Loading invitation" />}>
          <JoinScreen
            isAuthed={Boolean(auth.session)}
            onSignIn={() => {
              setAuthMode("login");
              setScreen("login");
            }}
            onDone={() => setScreen(workspaceForAdmin ? "workspace" : "dashboard")}
          />
        </Suspense>
      )}
      {screen === "workspace" &&
        auth.session &&
        (workspaceForAdmin ? (
          <Suspense fallback={<ScreenSkeleton label="Loading workspace" />}>
            <WorkspaceAdminScreen workspaceId={workspaceForAdmin} onOpenBilling={handleOpenBillingPortal} />
          </Suspense>
        ) : (
          <main id="main-content" tabIndex={-1} className="page-shell">
            <div className="empty-state">
              <LogoMark size={48} decorative className="empty-state-mark" />
              <h2>No workspace yet</h2>
              <p>Purchase a Team plan to create a shared RocketCourse workspace with seats and members.</p>
            </div>
          </main>
        ))}
      {screen === "admin" &&
        (access.isSuperAdmin && auth.session ? (
          <Suspense fallback={<ScreenSkeleton label="Loading admin" />}>
            <SuperAdminScreen selfUserId={auth.session.user.id} />
          </Suspense>
        ) : (
          <main id="main-content" tabIndex={-1} className="page-shell">
            <div className="empty-state">
              <ShieldAlert size={40} />
              <h2>Not authorized</h2>
              <p>This area is restricted to RocketCourse super admins.</p>
            </div>
          </main>
        ))}
    </div>
  );
}

function TopBar({
  screen,
  onNavigate,
  auth,
  access,
  onSignIn,
  onDemo,
  onManageBilling
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  auth: AuthSessionState;
  access: UsePlatformAccess;
  onSignIn: () => void;
  onDemo: () => void;
  onManageBilling: () => void;
}) {
  const { session, entitlement } = auth;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Inside the workspace the marketing links (Pricing, Guides, About, Contact,
  // Blog) are five dead ends that lead OUT of a course mid-build, stacked above
  // the workspace chrome and the experience's own rail. Building a course gets
  // one navigation model: the workspace destinations, the logo, and the account.
  const workspaceOnly = screen === "editor";
  const workspaceNav = Boolean(session);
  const cls = (active: boolean): string => (active ? "active" : "");
  const navigate = (next: () => void): void => {
    setMobileNavOpen(false);
    next();
  };
  return (
    <header className="topbar">
      <BrandHeader onClick={() => onNavigate("landing")} />
      {!(workspaceOnly && !workspaceNav) && (
        <button
          type="button"
          className="topnav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          <span>{mobileNavOpen ? "Close" : "Menu"}</span>
        </button>
      )}
      <nav
        id="primary-navigation"
        className={`topnav ${mobileNavOpen ? "is-open" : ""}`}
        aria-label="Primary"
        // Signed out inside the workspace (the public demo) there are no
        // workspace destinations left — the logo and the demo banner are the
        // way out, so an empty nav would only add chrome.
        hidden={workspaceOnly && !workspaceNav}
      >
        {session && (
          <div className="topnav-product" role="group" aria-label="Your workspace">
            <button className={`nav-emph ${cls(screen === "dashboard")}`} onClick={() => navigate(() => onNavigate("dashboard"))}>
              <LayoutDashboard size={16} /> Dashboard
            </button>
            <button className={`nav-cta ${cls(screen === "intake")}`} onClick={() => navigate(() => onNavigate("intake"))}>
              <Wand2 size={16} /> Create
            </button>
            {access.workspaces.some((w) => w.myRole === "owner" || w.myRole === "admin") && (
              <button className={`nav-emph ${cls(screen === "workspace")}`} onClick={() => navigate(() => onNavigate("workspace"))}>
                <Rocket size={16} /> Launchpad
              </button>
            )}
          </div>
        )}
        {/* Signed-in users reach Home via the logo and are past needing the demo —
            trimming both keeps the workspace nav focused on the product. */}
        {!session && !workspaceOnly && (
          <button className={cls(screen === "landing")} onClick={() => navigate(() => onNavigate("landing"))}>
            <Home size={16} /> Home
          </button>
        )}
        {!session && !workspaceOnly && (
          <button className={cls(screen === "demo")} onClick={() => navigate(onDemo)}>
            <PanelLeft size={16} /> Demo
          </button>
        )}
        {!workspaceOnly && (
          <>
            <button className={cls(screen === "pricing")} onClick={() => navigate(() => onNavigate("pricing"))}>
              <CreditCard size={16} /> Pricing
            </button>
            <button className={cls(screen === "guides")} onClick={() => navigate(() => onNavigate("guides"))}>
              <BookOpen size={16} /> Guides
            </button>
            <button className={cls(screen === "about")} onClick={() => navigate(() => onNavigate("about"))}>
              <Info size={16} /> About
            </button>
            <button className={cls(screen === "contact")} onClick={() => navigate(() => onNavigate("contact"))}>
              <Mail size={16} /> Contact
            </button>
            <button className={cls(screen === "blog" || screen === "blogPost")} onClick={() => navigate(() => onNavigate("blog"))}>
              <Newspaper size={16} /> Blog
            </button>
          </>
        )}
        {access.isSuperAdmin && !workspaceOnly && (
          <button className={cls(screen === "admin")} onClick={() => navigate(() => onNavigate("admin"))}>
            <ShieldAlert size={16} /> Super Admin
          </button>
        )}
      </nav>
      <div className="topbar-account">
        {session ? (
          <ProfileMenu auth={auth} onNavigate={onNavigate} onManageBilling={onManageBilling} />
        ) : (
          <button className="signin-button" onClick={onSignIn}>
            <User size={15} /> Sign in
          </button>
        )}
      </div>
    </header>
  );
}

// Account/profile dropdown in the app shell. Surfaces plan status, billing, and plan changes. When
// real auth + Stripe are configured (authMode === "supabase"), "Manage billing" opens the REAL
// Stripe customer portal and "Change plan" goes to pricing/checkout. In local-dev mode there is no
// Stripe, so the panel honestly shows a clearly-labeled "simulated plan" dev control instead.
function ProfileMenu({
  auth,
  onNavigate,
  onManageBilling
}: {
  auth: AuthSessionState;
  onNavigate: (screen: Screen) => void;
  onManageBilling: () => void;
}) {
  const { session, entitlement } = auth;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const email = session?.user.email ?? "";
  const name = session?.user.fullName?.trim() || email;
  const initial = (name || "?").charAt(0).toUpperCase();
  const isLocal = auth.authMode === "local";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (action: () => void): void => {
    setOpen(false);
    action();
  };

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="profile-avatar" aria-hidden="true">{initial}</span>
        <span className="profile-trigger-meta">
          <strong>{name.length > 22 ? `${name.slice(0, 21)}…` : name}</strong>
          <em className={entitlement.active ? "ok" : ""}>{entitlement.planName}</em>
        </span>
        <ChevronDown size={15} className={`profile-chev ${open ? "up" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="profile-panel" role="menu" aria-label="Account">
          <div className="profile-head">
            <span className="profile-avatar lg" aria-hidden="true">{initial}</span>
            <div>
              <strong>{name}</strong>
              {email && name !== email && <small>{email}</small>}
            </div>
          </div>

          <div className="profile-plan">
            <div className="profile-plan-row">
              <span>Current plan</span>
              <span className={`plan-badge ${entitlement.active ? "active" : "free"}`}>
                {entitlement.active ? <CheckCircle2 size={13} /> : <Lock size={13} />} {entitlement.planName}
              </span>
            </div>
            <p className="profile-plan-note">
              {entitlement.active
                ? "Your plan is active. Manage billing, invoices, or change your plan below."
                : "You're on the free preview. Upgrade to unlock AI generation and private exports."}
            </p>
          </div>

          <div className="profile-actions">
            <button type="button" role="menuitem" onClick={() => go(() => onNavigate("dashboard"))}>
              <LayoutDashboard size={15} /> Dashboard
            </button>
            <button type="button" role="menuitem" onClick={() => go(() => onNavigate("pricing"))}>
              <CreditCard size={15} /> {entitlement.active ? "Change plan" : "Upgrade plan"}
            </button>
            {!isLocal && (
              <button type="button" role="menuitem" onClick={() => go(onManageBilling)}>
                <Wallet size={15} /> Manage billing &amp; invoices
              </button>
            )}
          </div>

          {isLocal && (
            <div className="profile-dev">
              <span className="profile-dev-label">
                <FlaskConical size={12} /> Demo / dev controls
              </span>
              <DevPlanSwitcher auth={auth} />
              <small>Local mode: plan is simulated. Real billing connects when Supabase + Stripe are configured.</small>
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            className="profile-signout"
            onClick={() => go(() => void auth.signOut().then(() => onNavigate("landing")))}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
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

const landingFeatures = [
  {
    icon: BookOpen,
    tone: "cyan",
    title: "Canvas-oriented structure",
    body: "Homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, outcomes, and gradebook groups — packaged for review and import into Canvas."
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
  onStartWithPrompt,
  onDashboard,
  onPricing,
  onTryDemo,
  onGuides,
  onFoundingCohort
}: {
  onStart: () => void;
  onStartWithPrompt: (prompt: string) => void;
  onDashboard: () => void;
  onPricing: () => void;
  onTryDemo: () => void;
  onGuides: () => void;
  onFoundingCohort: () => void;
}) {
  // Live blueprint teaser: visitors type a course idea and watch a blueprint form
  // before ever signing up. Entirely client-side (settings inference, no AI call).
  const [teaserPrompt, setTeaserPrompt] = useState("");
  const teaserSettings = useMemo<CourseSettings | null>(() => {
    const trimmed = teaserPrompt.trim();
    if (!trimmed) return null;
    const { updates } = inferSettingsFromPrompt(trimmed);
    const firstSentence = trimmed.split(/[.\n]/)[0].trim();
    const title = firstSentence.length > 64 ? `${firstSentence.slice(0, 61)}…` : firstSentence;
    return { ...defaultSettings, ...updates, title };
  }, [teaserPrompt]);
  // Scroll-reveal: fade + rise landing sections into view as the user scrolls. Progressive
  // enhancement (the .reveal-ready / .reveal classes are added by JS, so no-JS keeps content
  // visible), and fully disabled under prefers-reduced-motion.
  useEffect(() => {
    const root = document.querySelector(".landing");
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce || typeof IntersectionObserver === "undefined") return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".landing-section, .landing-cta"));
    els.forEach((el) => el.classList.add("reveal"));
    root.classList.add("reveal-ready");
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            obs.unobserve(entry.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add("reveal-in");
      else obs.observe(el);
    });
    return () => {
      obs.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="landing">
      <section className="landing-hero">
        <BrandOrbitalAccent />
        <div className="landing-copy">
          <button type="button" className="founding-ribbon" onClick={onFoundingCohort}>
            <span className="founding-ribbon__tag">
              <Rocket size={13} /> Founding Cohort
            </span>
            <span className="founding-ribbon__text">40% off your first 3 months + a live AI course-building workshop</span>
            <ArrowRight size={14} className="founding-ribbon__arrow" />
          </button>
          <LogoWordmark height={116} priority className="hero-logo" />
          <span className="hero-badge">
            <Sparkles size={15} /> Canvas-first course builder for instructors & designers
          </span>
          <h1>
            Turn a course idea into an editable <span className="accent-text">Canvas course</span>.
          </h1>
          <p>
            Turn a topic, syllabus, or existing Canvas export into a structured, fully editable course, then export a
            Canvas-oriented <strong>.imscc</strong> package.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onStart}>
              <Sparkles size={18} /> Build your first course
            </button>
            <button className="secondary" onClick={onFoundingCohort}>
              <Rocket size={17} /> Join the Founding Cohort
            </button>
            <button className="secondary" onClick={onTryDemo}>
              <PanelLeft size={17} /> Try the demo
            </button>
            <button className="secondary" onClick={onPricing}>
              <CreditCard size={17} /> View pricing
            </button>
          </div>
          <div className="rc-trail hero-trail" aria-hidden="true" />
          <div className="hero-meta">
            <span>
              <CheckCircle2 size={16} /> Canvas-oriented objects
            </span>
            <span>
              <CheckCircle2 size={16} /> Editable before export
            </span>
            <span>
              <CheckCircle2 size={16} /> Real .imscc download
            </span>
          </div>
        </div>
        <section className="product-preview cockpit" aria-label="Preview of a course being built in RocketCourse">
          <div className="cockpit-chrome" aria-hidden="true">
            <span className="cockpit-light" />
            <span className="cockpit-light" />
            <span className="cockpit-light" />
            <span className="cockpit-omni">
              <Lock size={11} /> rocketcourse.app/course/ai-and-modern-society
            </span>
          </div>

          <div className="cockpit-top">
            <div className="cockpit-course">
              <span className="cockpit-eyebrow">Course workspace</span>
              <strong>AI and Modern Society</strong>
              <span className="cockpit-sub">Editable · ready to export</span>
            </div>
            <ReadinessRing score={94} size={56} unit="%" ariaLabel="Course readiness score: 94 percent" />
          </div>

          <div className="cockpit-main">
            <nav className="cockpit-rail" aria-hidden="true">
              <span className="cockpit-tab is-active"><LayoutDashboard size={15} /> Overview</span>
              <span className="cockpit-tab"><FileText size={15} /> Syllabus</span>
              <span className="cockpit-tab"><Layers size={15} /> Modules</span>
              <span className="cockpit-tab"><PenLine size={15} /> Assignments</span>
              <span className="cockpit-tab"><ListChecks size={15} /> Quizzes</span>
              <span className="cockpit-tab"><ArrowDownToLine size={15} /> Export</span>
            </nav>

            <div className="cockpit-panel" aria-hidden="true">
              <div className="cockpit-row">
                <span className="cockpit-ix">01</span>
                <span className="cockpit-name">Foundations of AI</span>
                <span className="cockpit-pill ok"><Check size={11} /> Ready</span>
                <span className="cockpit-meter"><i style={{ width: "100%" }} /></span>
              </div>
              <div className="cockpit-row">
                <span className="cockpit-ix">02</span>
                <span className="cockpit-name">Data, Models &amp; Society</span>
                <span className="cockpit-pill ok"><Check size={11} /> Ready</span>
                <span className="cockpit-meter"><i style={{ width: "96%" }} /></span>
              </div>
              <div className="cockpit-row">
                <span className="cockpit-ix">03</span>
                <span className="cockpit-name">Bias, Fairness &amp; Ethics</span>
                <span className="cockpit-pill info">In review</span>
                <span className="cockpit-meter"><i style={{ width: "78%" }} /></span>
              </div>
              <div className="cockpit-row">
                <span className="cockpit-ix">04</span>
                <span className="cockpit-name">AI in the Wild</span>
                <span className="cockpit-pill draft">Draft</span>
                <span className="cockpit-meter"><i style={{ width: "54%" }} /></span>
              </div>
            </div>
          </div>

          <div className="cockpit-foot" aria-hidden="true">
            <span><Layers size={13} /> 12 modules</span>
            <span><FileText size={13} /> 34 pages</span>
            <span><ShieldCheck size={13} /> IMSCC locally validated</span>
          </div>
        </section>
      </section>

      <CampaignBanner placements={["homepage_hero", "homepage_banner"]} />

      <section className="landing-section landing-teaser" aria-labelledby="teaser-heading">
        <span className="hero-badge">
          <Wand2 size={14} /> Try it — no account needed
        </span>
        <h2 id="teaser-heading">See your course take shape</h2>
        <p>Describe a course in a sentence and watch the blueprint form. Building the full draft takes one click more.</p>
        <div className="landing-teaser-grid">
          <div className="landing-teaser-input">
            <label htmlFor="teaser-prompt">What do you teach?</label>
            <textarea
              id="teaser-prompt"
              rows={3}
              value={teaserPrompt}
              onChange={(event) => setTeaserPrompt(event.target.value)}
              placeholder="e.g. An 8-week undergraduate course on AI and Modern Society for non-majors, online asynchronous."
            />
            {!teaserPrompt.trim() && (
              <div className="prompt-examples" aria-label="Example course ideas">
                {[
                  "An 8-week undergraduate course on AI and Modern Society for non-majors, online asynchronous",
                  "A 16-week graduate research methods course for nursing students, hybrid format",
                  "A 6-week professional development course on workplace safety for new EMS supervisors"
                ].map((example) => (
                  <button key={example} type="button" className="prompt-example-chip" onClick={() => setTeaserPrompt(example)}>
                    {example.split(",")[0]}
                  </button>
                ))}
              </div>
            )}
            {teaserSettings && (
              <button className="primary landing-teaser-cta" onClick={() => onStartWithPrompt(teaserPrompt)}>
                <Rocket size={17} /> Build this course <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="landing-teaser-preview" aria-live="polite">
            {teaserSettings ? (
              <CourseBlueprintPreview settings={teaserSettings} />
            ) : (
              <div className="landing-teaser-empty">
                <Layers size={22} />
                <p>Your blueprint appears here as you type — modules, pacing, and assessment rhythm.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="problem-heading">
        <h2 id="problem-heading">The blank Canvas shell is where courses stall</h2>
        <p>
          A new Canvas course opens empty. Before any teaching happens, someone has to build the homepage, write the
          syllabus, lay out modules, draft pages, create assignments and discussions, write quizzes and rubrics, set up
          gradebook groups, and wire it all together, then copy and paste it into Canvas, piece by piece. That setup
          labor is repetitive, time-consuming, and easy to do inconsistently.
        </p>
        <p>
          RocketCourse removes the blank-shell burden. You start from your own topic, syllabus, readings, or prompt and
          get a structured first draft you can edit, so you spend your time on teaching, quality, accessibility, and the
          student experience instead of scaffolding.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="audience-heading">
        <h2 id="audience-heading">Built for everyone who shapes a Canvas course</h2>
        <p>RocketCourse is for any instructor building any course, and the people who help them do it well.</p>
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
        <h2 id="student-heading">A clearer course for students, a faster start for you</h2>
        <p>
          Consistent navigation, predictable module structure, understandable instructions, and professional-looking
          pages reduce course confusion, so students spend less energy figuring out where things are and more on
          learning. Designers and technologists get a clean baseline to improve, not a blank page to rescue.
        </p>
      </section>

      <ProductWalkthrough onTryDemo={onTryDemo} onGuides={onGuides} onStart={onStart} />

      <section className="landing-section" aria-labelledby="features-heading">
        <h2 id="features-heading">Everything a Canvas course needs, structured for you</h2>
        <p>Powerful where it counts, simple everywhere else. No fake AI claims, just a fast, honest build.</p>
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
        <h2 id="demo-invite-heading">Explore the AI and Modern Society demo</h2>
        <p>
          Poke around a fully built sample course (every tab, the readiness scoring, and the export flow) with no
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
        <h2 id="pricing-teaser-heading">Start free, upgrade when you're ready to build your own</h2>
        <p>
          The demo is free and uses no AI. Paid plans unlock AI course generation and private Canvas exports for
          instructors, designers, and whole departments. Export and AI limits are enforced on the server against your
          subscription, never the browser.
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

export default App;
