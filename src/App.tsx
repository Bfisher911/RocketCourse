import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
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
  Layers,
  LayoutDashboard,
  Loader2,
  Lock,
  MessageSquareText,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { defaultSettings } from "./data/defaultSettings";
import { themes } from "./data/themes";
import { applyThemeToGeneratedContent, generateCourseProject, sampleProject } from "./services/courseGenerator";
import { buildCourseQualityReport } from "./services/courseQuality";
import { generateImsccBlob } from "./services/imsccExport";
import { importCanvasCourseFromImscc } from "./services/imsccImport";
import { reviseCourseObject, type RevisionMode } from "./services/objectRevision";
import { buildReadinessReport } from "./services/readiness";
import type {
  Assignment,
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
  Rubric,
  Screen,
  SourceFile
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

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

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
  const [screen, setScreen] = useState<Screen>("landing");
  const [projects, setProjects] = useState<CourseProject[]>([sampleProject]);
  const [course, setCourse] = useState<CourseProject>(sampleProject);
  const [settings, setSettings] = useState<CourseSettings>(defaultSettings);
  const [prompt, setPrompt] = useState(sampleProject.prompt);
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>("Overview");
  const [subscriptionActive, setSubscriptionActive] = useState(true);
  const [validationReport, setValidationReport] = useState<ExportValidationReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ moduleId: string; itemId: string } | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>(sampleProject.exportMode);

  const readiness = useMemo(() => buildReadinessReport(course), [course]);
  const quality = useMemo(() => buildCourseQualityReport(course), [course]);
  const homepage = course.pages.find((page) => page.frontPage) ?? course.pages[0];
  const syllabus = course.pages.find((page) => page.slug === "syllabus") ?? course.pages[1];

  useEffect(() => {
    if (screen !== "progress") return;
    if (progressIndex >= progressSteps.length) {
      const generated = generateCourseProject({ prompt, settings });
      setCourse(generated);
      setProjects((current) => [generated, ...current.filter((project) => project.id !== generated.id)]);
      setValidationReport(null);
      setImportNotes([]);
      setExportMode(generated.exportMode);
      setActiveTab("Overview");
      setScreen("editor");
      return;
    }
    const timer = window.setTimeout(() => setProgressIndex((index) => index + 1), 420);
    return () => window.clearTimeout(timer);
  }, [progressIndex, prompt, screen, settings]);

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
      setScreen("editor");
      return;
    }

    const sourceFiles: SourceFile[] = fileList.map((file, index) => ({
      id: `source_${Date.now()}_${index}`,
      name: file.name,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      status: "attached"
    }));
    updateSettings("sourceFiles", [...settings.sourceFiles, ...sourceFiles]);
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
    updateCourse((current) => {
      const modules = current.modules.map((module) => ({ ...module, items: [...module.items] }));
      const sourceModule = modules.find((module) => module.id === draggedItem.moduleId);
      const targetModule = modules.find((module) => module.id === targetModuleId);
      if (!sourceModule || !targetModule) return current;
      const sourceIndex = sourceModule.items.findIndex((item) => item.id === draggedItem.itemId);
      if (sourceIndex < 0) return current;
      const [item] = sourceModule.items.splice(sourceIndex, 1);
      const targetIndex = targetItemId ? targetModule.items.findIndex((target) => target.id === targetItemId) : targetModule.items.length;
      targetModule.items.splice(targetIndex < 0 ? targetModule.items.length : targetIndex, 0, { ...item, status: "edited" });
      return {
        ...current,
        modules: modules.map((module) => ({ ...module, items: renumberItems(module.items) })),
        pages: item.type === "page" || item.type === "syllabus" ? current.pages.map((page) => (page.id === item.refId ? { ...page, moduleId: targetModuleId, status: "edited" } : page)) : current.pages,
        assignments: item.type === "assignment" ? current.assignments.map((assignment) => (assignment.id === item.refId ? { ...assignment, moduleId: targetModuleId, status: "edited" } : assignment)) : current.assignments,
        discussions: item.type === "discussion" ? current.discussions.map((discussion) => (discussion.id === item.refId ? { ...discussion, moduleId: targetModuleId, status: "edited" } : discussion)) : current.discussions,
        quizzes: item.type === "quiz" ? current.quizzes.map((quiz) => (quiz.id === item.refId ? { ...quiz, moduleId: targetModuleId, status: "edited" } : quiz)) : current.quizzes
      };
    });
    setDraggedItem(null);
  };

  const duplicateModule = (moduleId: string): void => {
    updateCourse((current) => {
      const original = current.modules.find((module) => module.id === moduleId);
      if (!original) return current;
      const stamp = Date.now();
      const copiedModuleId = `${original.id}_copy_${stamp}`;
      const copiedPages: CoursePage[] = [];
      const copiedAssignments: Assignment[] = [];
      const copiedDiscussions: Discussion[] = [];
      const copiedQuizzes: Quiz[] = [];
      const copiedRubrics: Rubric[] = [];
      const copiedItems = original.items.map((item, index) => {
        const copiedItem = { ...item, id: `${item.id}_copy_${stamp}_${index}`, order: index + 1, status: "edited" as const, metadata: editMetadata() };

        if (item.type === "page" || item.type === "syllabus") {
          const page = current.pages.find((entry) => entry.id === item.refId);
          if (!page) return copiedItem;
          const copiedPageId = `${page.id}_copy_${stamp}_${index}`;
          copiedPages.push({
            ...page,
            id: copiedPageId,
            title: `${page.title} Copy`,
            slug: `${page.slug}-copy-${stamp}`,
            moduleId: copiedModuleId,
            frontPage: false,
            status: "edited",
            metadata: editMetadata()
          });
          return { ...copiedItem, refId: copiedPageId };
        }

        if (item.type === "assignment") {
          const assignment = current.assignments.find((entry) => entry.id === item.refId);
          if (!assignment) return copiedItem;
          const copiedAssignmentId = `${assignment.id}_copy_${stamp}_${index}`;
          let rubricId = assignment.rubricId;
          if (assignment.rubricId) {
            const rubric = current.rubrics.find((entry) => entry.id === assignment.rubricId);
            if (rubric) {
              rubricId = `${rubric.id}_copy_${stamp}_${index}`;
              copiedRubrics.push({ ...rubric, id: rubricId, title: `${rubric.title} Copy`, status: "edited", metadata: editMetadata() });
            }
          }
          copiedAssignments.push({
            ...assignment,
            id: copiedAssignmentId,
            title: `${assignment.title} Copy`,
            moduleId: copiedModuleId,
            rubricId,
            status: "edited",
            metadata: editMetadata()
          });
          return { ...copiedItem, refId: copiedAssignmentId };
        }

        if (item.type === "discussion") {
          const discussion = current.discussions.find((entry) => entry.id === item.refId);
          if (!discussion) return copiedItem;
          const copiedDiscussionId = `${discussion.id}_copy_${stamp}_${index}`;
          let rubricId = discussion.rubricId;
          if (discussion.rubricId) {
            const rubric = current.rubrics.find((entry) => entry.id === discussion.rubricId);
            if (rubric) {
              rubricId = `${rubric.id}_copy_${stamp}_${index}`;
              copiedRubrics.push({ ...rubric, id: rubricId, title: `${rubric.title} Copy`, status: "edited", metadata: editMetadata() });
            }
          }
          copiedDiscussions.push({
            ...discussion,
            id: copiedDiscussionId,
            title: `${discussion.title} Copy`,
            moduleId: copiedModuleId,
            rubricId,
            status: "edited",
            metadata: editMetadata()
          });
          return { ...copiedItem, refId: copiedDiscussionId };
        }

        if (item.type === "quiz") {
          const quiz = current.quizzes.find((entry) => entry.id === item.refId);
          if (!quiz) return copiedItem;
          const copiedQuizId = `${quiz.id}_copy_${stamp}_${index}`;
          copiedQuizzes.push({
            ...quiz,
            id: copiedQuizId,
            title: `${quiz.title} Copy`,
            moduleId: copiedModuleId,
            questions: quiz.questions.map((question, questionIndex) => ({ ...question, id: `${question.id}_copy_${stamp}_${questionIndex}` })),
            status: "edited",
            metadata: editMetadata()
          });
          return { ...copiedItem, refId: copiedQuizId };
        }

        return copiedItem;
      });
      const copy: CourseModule = {
        ...original,
        id: copiedModuleId,
        title: `${original.title} Copy`,
        order: original.order + 1,
        status: "edited",
        expanded: true,
        metadata: editMetadata(),
        items: copiedItems
      };
      const modules = [...current.modules];
      modules.splice(original.order + 1, 0, copy);
      return {
        ...current,
        modules: renumberModules(modules),
        pages: [...current.pages, ...copiedPages],
        assignments: [...current.assignments, ...copiedAssignments],
        discussions: [...current.discussions, ...copiedDiscussions],
        quizzes: [...current.quizzes, ...copiedQuizzes],
        rubrics: [...current.rubrics, ...copiedRubrics]
      };
    });
  };

  const addBlankModule = (): void => {
    updateCourse((current) => ({
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
    }));
  };

  const reviseActiveContent = (mode: RevisionMode): void => {
    updateCourse((current) => {
      if (mode === "rubric") {
        const assignment = current.assignments[0];
        if (!assignment) return current;
        const result = reviseCourseObject({
          courseTitle: current.title,
          objectType: "assignment",
          title: assignment.title,
          html: assignment.descriptionHtml,
          mode,
          context: {
            outcomeCodes: assignment.alignedOutcomeIds.map((outcomeId) => current.outcomes.find((outcome) => outcome.id === outcomeId)?.code ?? outcomeId),
            moduleTitle: current.modules.find((module) => module.id === assignment.moduleId)?.title,
            futureProvider: "server-side-ai"
          }
        });
        return {
          ...current,
          assignments: current.assignments.map((item) =>
            item.id === assignment.id ? { ...item, descriptionHtml: result.html, status: "edited", metadata: editMetadata() } : item
          )
        };
      }

      const targetPage = activeTab === "Syllabus" ? syllabus : homepage;
      const result = reviseCourseObject({
        courseTitle: current.title,
        objectType: "page",
        title: targetPage.title,
        html: targetPage.bodyHtml,
        mode,
        context: {
          outcomeCodes: current.outcomes.slice(0, 3).map((outcome) => outcome.code),
          moduleTitle: current.modules.find((module) => module.id === targetPage.moduleId)?.title,
          futureProvider: "server-side-ai"
        }
      });

      return {
        ...current,
        pages: current.pages.map((page) => (page.id === targetPage.id ? { ...page, bodyHtml: result.html, status: "edited", metadata: editMetadata() } : page))
      };
    });
  };

  const exportCourse = async (): Promise<void> => {
    if (!subscriptionActive) return;
    setIsExporting(true);
    try {
      const { blob, report, fileName } = await generateImsccBlob({ ...course, exportMode }, exportMode);
      if (report.valid) {
        downloadBlob(blob, fileName);
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
      }
      setValidationReport(report);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app">
      <TopBar
        screen={screen}
        onNavigate={setScreen}
        subscriptionActive={subscriptionActive}
        onToggleSubscription={() => setSubscriptionActive((value) => !value)}
      />

      {screen === "landing" && <Landing onStart={() => setScreen("intake")} onDashboard={() => setScreen("dashboard")} />}
      {screen === "dashboard" && (
        <Dashboard
          projects={projects}
          subscriptionActive={subscriptionActive}
          onCreate={() => setScreen("intake")}
          onOpen={(project) => {
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
          onGenerate={startGeneration}
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
          subscriptionActive={subscriptionActive}
          validationReport={validationReport}
          isExporting={isExporting}
          draggedModuleId={draggedModuleId}
          onDragModule={setDraggedModuleId}
          onDropModule={reorderModule}
          onDragItem={setDraggedItem}
          onDropItem={reorderModuleItem}
          onUpdateCourse={updateCourse}
          onExport={exportCourse}
          onAddBlankModule={addBlankModule}
          onDuplicateModule={duplicateModule}
          onRevise={reviseActiveContent}
          exportMode={exportMode}
          onExportModeChange={setExportMode}
          importNotes={importNotes}
        />
      )}
    </div>
  );
}

function TopBar({
  screen,
  onNavigate,
  subscriptionActive,
  onToggleSubscription
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  subscriptionActive: boolean;
  onToggleSubscription: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNavigate("landing")} aria-label="Open CourseForge landing page">
        <span className="brand-mark">CF</span>
        <span>
          <strong>CourseForge</strong>
          <small>Canvas Builder</small>
        </span>
      </button>
      <nav className="topnav" aria-label="Primary">
        <button className={screen === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}>
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button className={screen === "intake" ? "active" : ""} onClick={() => onNavigate("intake")}>
          <Wand2 size={16} /> Create
        </button>
        <button className={screen === "editor" ? "active" : ""} onClick={() => onNavigate("editor")}>
          <PanelLeft size={16} /> Editor
        </button>
      </nav>
      <button className={`subscription ${subscriptionActive ? "paid" : "locked"}`} onClick={onToggleSubscription}>
        {subscriptionActive ? <CheckCircle2 size={16} /> : <Lock size={16} />}
        {subscriptionActive ? "Individual active" : "Export locked"}
      </button>
    </header>
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
    body: "CourseForge builds modules, pages, assignments, discussions, quizzes, and rubrics as native Canvas objects you can edit, reorder, and refine."
  },
  {
    icon: FileArchive,
    title: "Validate & export",
    body: "Check readiness and instructional quality, then download a validated .imscc package ready to import straight into Canvas."
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

function Landing({ onStart, onDashboard }: { onStart: () => void; onDashboard: () => void }) {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="hero-badge">
            <Sparkles size={15} /> Cosmic course builder for Canvas LMS
          </span>
          <h1>
            Generate a full <span className="gradient-text">Canvas course</span> in minutes.
          </h1>
          <p>
            CourseForge turns a course prompt and a few guided settings into a structured, editable Canvas shell — then
            validates and exports a Canvas-ready <strong>.imscc</strong> package. Built for instructors and instructional
            designers.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onStart}>
              <Sparkles size={18} /> Build a course
            </button>
            <button className="secondary" onClick={onDashboard}>
              <LayoutDashboard size={17} /> View dashboard
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
        <section className="product-preview" aria-label="CourseForge workflow preview">
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

      <section className="landing-cta">
        <h2>Ready to build your next Canvas course?</h2>
        <p>Start from a prompt or an existing export, edit everything, and ship a validated package.</p>
        <div className="hero-actions">
          <button className="primary" onClick={onStart}>
            <Sparkles size={18} /> Build a course <ArrowRight size={17} />
          </button>
          <button className="secondary" onClick={onDashboard}>
            View dashboard
          </button>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  projects,
  subscriptionActive,
  onCreate,
  onOpen
}: {
  projects: CourseProject[];
  subscriptionActive: boolean;
  onCreate: () => void;
  onOpen: (project: CourseProject) => void;
}) {
  return (
    <main className="dashboard page-shell">
      <section className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Your drafts, generated courses, export history, and demo subscription status.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          <Plus size={18} /> Create new course
        </button>
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
            <CreditCard size={20} />
          </span>
          <span>{subscriptionActive ? "Active" : "Locked"}</span>
          <p>{subscriptionActive ? "Export enabled (demo plan)" : "Export disabled (demo)"}</p>
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
  onGenerate
}: {
  prompt: string;
  settings: CourseSettings;
  onPromptChange: (value: string) => void;
  onSettingsChange: <K extends keyof CourseSettings>(key: K, value: CourseSettings[K]) => void;
  onFiles: (files: FileList | null) => void;
  onGenerate: () => void;
}) {
  const updateSchedule = <K extends keyof CourseSettings["schedule"]>(key: K, value: CourseSettings["schedule"][K]) => {
    onSettingsChange("schedule", { ...settings.schedule, [key]: value });
  };

  return (
    <main className="intake page-shell">
      <section className="page-heading">
        <div>
          <h1>Create a Course</h1>
          <p>Mix a natural prompt with a few settings. Advanced design details stay behind the curtain.</p>
        </div>
        <button className="primary" onClick={onGenerate}>
          <Sparkles size={18} /> Generate Course
        </button>
      </section>
      <section className="intake-layout">
        <div className="prompt-panel">
          <span className="panel-label">
            <Wand2 size={14} /> Course brief
          </span>
          <label htmlFor="prompt">Describe your course</label>
          <p className="prompt-hint">Plain language is fine — topic, audience, goals, tone, and anything you want emphasized.</p>
          <textarea id="prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} />
          <label className="upload-zone">
            <Upload size={22} />
            <span>Attach a syllabus, notes, reading list, or an existing Canvas .imscc export</span>
            <input type="file" multiple accept=".imscc,.txt,.md,.doc,.docx,.pdf,.html" onChange={(event) => onFiles(event.target.files)} />
          </label>
          <p className="upload-note">
            Uploading an <strong>.imscc</strong> imports its structure right away. Other files are listed as sources for your
            reference — this build records their names, but does not yet parse their contents.
          </p>
          {settings.sourceFiles.length > 0 && (
            <div className="source-list">
              {settings.sourceFiles.map((file) => (
                <span key={file.id}>
                  <FileText size={14} /> {file.name} <small>{file.sizeLabel}</small>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="settings-panel">
          <span className="panel-label">
            <Sparkles size={14} /> Course settings
          </span>
          <div className="settings-section">
            <div className="subsection-heading">
              <h2>Course basics</h2>
            </div>
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
          </div>
          <div className="settings-section">
            <div className="subsection-heading">
              <h2>Structure &amp; cadence</h2>
            </div>
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
            </div>
          </div>
          <div className="settings-section">
            <div className="subsection-heading">
              <h2>Assessments</h2>
            </div>
            <div className="field-grid">
              <Select label="Quizzes" value={settings.quizFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("quizFrequency", value as CourseSettings["quizFrequency"])} />
              <NumberInput label="Questions per quiz" value={settings.quizQuestionsPerQuiz} min={1} max={10} onChange={(value) => onSettingsChange("quizQuestionsPerQuiz", value)} />
              <Select label="Quiz difficulty" value={settings.quizDifficulty} options={["introductory", "balanced", "challenging"]} onChange={(value) => onSettingsChange("quizDifficulty", value as CourseSettings["quizDifficulty"])} />
              <Select label="Discussions" value={settings.discussionFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("discussionFrequency", value as CourseSettings["discussionFrequency"])} />
              <Select label="Discussion style" value={settings.discussionStyle} options={["reflective", "case-based", "debate", "peer-review", "application"]} onChange={(value) => onSettingsChange("discussionStyle", value as CourseSettings["discussionStyle"])} />
              <Select label="Assignments" value={settings.assignmentCadence} options={["every-module", "every-other-module", "major-milestones", "custom"]} labels={{ "every-module": "Every module", "every-other-module": "Every other module", "major-milestones": "Major milestones", custom: "Custom" }} onChange={(value) => onSettingsChange("assignmentCadence", value as CourseSettings["assignmentCadence"])} />
              <Select label="Final project type" value={settings.finalProjectType} options={["project", "presentation", "paper", "portfolio", "exam", "case-study", "simulation", "other"]} onChange={(value) => onSettingsChange("finalProjectType", value as CourseSettings["finalProjectType"])} />
              <Select label="Scaffold pattern" value={settings.scaffoldPattern} options={["every-other-module", "key-milestones", "custom"]} labels={{ "every-other-module": "Every other module", "key-milestones": "Key milestones", custom: "Custom" }} onChange={(value) => onSettingsChange("scaffoldPattern", value as CourseSettings["scaffoldPattern"])} />
            </div>
          </div>
          <div className="settings-section">
            <div className="subsection-heading">
              <h2>Options</h2>
            </div>
            <div className="toggle-grid">
              <Toggle label="Final project" checked={settings.finalProject} onChange={(value) => onSettingsChange("finalProject", value)} />
              <Toggle label="Scaffold final project" checked={settings.scaffoldFinalProject} onChange={(value) => onSettingsChange("scaffoldFinalProject", value)} />
              <Toggle label="Rubrics" checked={settings.includeRubrics} onChange={(value) => onSettingsChange("includeRubrics", value)} />
              <Toggle label="Bloom alignment" checked={settings.includeBloom} onChange={(value) => onSettingsChange("includeBloom", value)} />
              <Toggle label="Workload/contact hours" checked={settings.includeContactHours} onChange={(value) => onSettingsChange("includeContactHours", value)} />
              <Toggle label="Accessibility emphasis" checked={settings.accessibilityFocus} onChange={(value) => onSettingsChange("accessibilityFocus", value)} />
              <Toggle label="Module image hooks" checked={settings.imageSettings.moduleHeaderImages} onChange={(value) => onSettingsChange("imageSettings", { ...settings.imageSettings, moduleHeaderImages: value })} />
            </div>
          </div>
          <div className="schedule-settings">
            <div className="subsection-heading">
              <h2>Course schedule</h2>
            </div>
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
          </div>
        </div>
      </section>
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
  onExport,
  onAddBlankModule,
  onDuplicateModule,
  onRevise,
  exportMode,
  onExportModeChange,
  importNotes
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
  onExport: () => void;
  onAddBlankModule: () => void;
  onDuplicateModule: (moduleId: string) => void;
  onRevise: (mode: RevisionMode) => void;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  importNotes: string[];
}) {
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
        <div className="editor-header">
          <div>
            <h1>{course.title}</h1>
            <p>Structured Canvas course preview and editor</p>
          </div>
          <div className="ai-toolbar" aria-label="AI revise actions">
            <button onClick={() => onRevise("concise")}>
              <PenLine size={15} /> Concise
            </button>
            <button onClick={() => onRevise("examples")}>
              <Sparkles size={15} /> Add examples
            </button>
            <button onClick={() => onRevise("accessibility")}>
              <CheckCircle2 size={15} /> Accessibility
            </button>
            <button onClick={() => onRevise("rubric")}>
              <RotateCcw size={15} /> Rubric note
            </button>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Course editor sections">
          {editorTabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {activeTab === "Overview" && <OverviewTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Homepage" && <PageTab title="Homepage" course={course} page={course.pages.find((page) => page.frontPage) ?? course.pages[0]} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Syllabus" && <PageTab title="Syllabus" course={course} page={course.pages.find((page) => page.slug === "syllabus") ?? course.pages[1]} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Modules" && (
            <ModulesTab
              course={course}
              draggedModuleId={draggedModuleId}
              onDragModule={onDragModule}
              onDropModule={onDropModule}
              onDragItem={onDragItem}
              onDropItem={onDropItem}
              onUpdateCourse={onUpdateCourse}
              onAddBlankModule={onAddBlankModule}
              onDuplicateModule={onDuplicateModule}
            />
          )}
          {activeTab === "Pages" && <CollectionTab<CoursePage> title="Pages" objectType="page" course={course} items={course.pages} getBody={(item) => item.bodyHtml} setBody={(item, body) => ({ ...item, bodyHtml: body })} onReplace={(pages) => onUpdateCourse((current) => ({ ...current, pages }))} />}
          {activeTab === "Assignments" && <CollectionTab<Assignment> title="Assignments" objectType="assignment" course={course} items={course.assignments} getBody={(item) => item.descriptionHtml} setBody={(item, body) => ({ ...item, descriptionHtml: body })} onReplace={(assignments) => onUpdateCourse((current) => ({ ...current, assignments }))} />}
          {activeTab === "Discussions" && <CollectionTab<Discussion> title="Discussions" objectType="discussion" course={course} items={course.discussions} getBody={(item) => item.promptHtml} setBody={(item, body) => ({ ...item, promptHtml: body })} onReplace={(discussions) => onUpdateCourse((current) => ({ ...current, discussions }))} />}
          {activeTab === "Quizzes" && <QuizzesTab quizzes={course.quizzes} onUpdate={(quizzes) => onUpdateCourse((current) => ({ ...current, quizzes }))} />}
          {activeTab === "Rubrics" && <RubricsTab rubrics={course.rubrics} onUpdate={(rubrics) => onUpdateCourse((current) => ({ ...current, rubrics }))} />}
          {activeTab === "Gradebook Setup" && <GradebookTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Contact Hours" && <ContactHoursTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Theme" && <ThemeTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Export" && (
            <ExportTab
              course={course}
              readiness={readiness}
              quality={quality}
              subscriptionActive={subscriptionActive}
              validationReport={validationReport}
              isExporting={isExporting}
              exportMode={exportMode}
              onExportModeChange={onExportModeChange}
              importNotes={importNotes}
              onExport={onExport}
            />
          )}
        </div>
      </section>

      <aside className="readiness-panel">
        <ReadinessPanel readiness={readiness} quality={quality} validationReport={validationReport} subscriptionActive={subscriptionActive} />
      </aside>
    </main>
  );
}

function OverviewTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void }) {
  return (
    <div className="stack">
      <Input label="Course title" value={course.title} onChange={(value) => onUpdateCourse((current) => ({ ...current, title: value, settings: { ...current.settings, title: value } }))} />
      <TextArea label="Description" value={course.description} onChange={(value) => onUpdateCourse((current) => ({ ...current, description: value }))} />
      <div className="object-grid">
        {course.outcomes.map((outcome, index) => (
          <div className="object-card" key={outcome.id}>
            <label>{outcome.code}</label>
            <textarea
              value={outcome.text}
              onChange={(event) =>
                onUpdateCourse((current) => ({
                  ...current,
                  outcomes: current.outcomes.map((item) => (item.id === outcome.id ? { ...item, text: event.target.value } : item))
                }))
              }
            />
            <small>{outcome.bloomLevel} • aligned to {course.outcomes[index].alignedModuleIds.length} modules</small>
          </div>
        ))}
      </div>
    </div>
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
  onAddBlankModule,
  onDuplicateModule
}: {
  course: CourseProject;
  draggedModuleId: string | null;
  onDragModule: (moduleId: string | null) => void;
  onDropModule: (moduleId: string) => void;
  onDragItem: (item: { moduleId: string; itemId: string } | null) => void;
  onDropItem: (moduleId: string, itemId?: string) => void;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onAddBlankModule: () => void;
  onDuplicateModule: (moduleId: string) => void;
}) {
  return (
    <div className="stack">
      <div className="section-actions">
        <button className="secondary" onClick={onAddBlankModule}>
          <Plus size={16} /> Add blank module
        </button>
      </div>
      {course.modules.map((module) => (
        <article
          key={module.id}
          className={`module-editor ${draggedModuleId === module.id ? "dragging" : ""}`}
          draggable
          onDragStart={() => onDragModule(module.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => onDropModule(module.id)}
        >
          <header>
            <GripVertical size={18} />
            <button
              className="icon-button"
              onClick={() =>
                onUpdateCourse((current) => ({
                  ...current,
                  modules: current.modules.map((item) => (item.id === module.id ? { ...item, expanded: !item.expanded } : item))
                }))
              }
              aria-label={`${module.expanded ? "Collapse" : "Expand"} ${module.title}`}
            >
              {module.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            <input
              value={module.title}
              onChange={(event) =>
                onUpdateCourse((current) => ({
                  ...current,
                  modules: current.modules.map((item) => (item.id === module.id ? { ...item, title: event.target.value, status: "edited" } : item))
                }))
              }
            />
            <select
              value={module.publishState}
              aria-label={`${module.title} publish state`}
              onChange={(event) =>
                onUpdateCourse((current) => ({
                  ...current,
                  modules: current.modules.map((item) => (item.id === module.id ? { ...item, publishState: event.target.value as CourseModule["publishState"], status: "edited" } : item))
                }))
              }
            >
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
            <button className="small-button" onClick={() => onDuplicateModule(module.id)}>
              Duplicate
            </button>
          </header>
          {module.expanded && (
            <div className="module-body" onDragOver={(event) => event.preventDefault()} onDrop={() => onDropItem(module.id)}>
              <textarea
                value={module.description}
                onChange={(event) =>
                  onUpdateCourse((current) => ({
                    ...current,
                    modules: current.modules.map((item) => (item.id === module.id ? { ...item, description: event.target.value, status: "edited" } : item))
                  }))
                }
              />
              <div className="module-items">
                {module.items.map((item) => (
                  <div
                    key={item.id}
                    className="module-item"
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
                    <span className={`item-type ${item.type}`}>{item.type}</span>
                    <input
                      value={item.title}
                      onChange={(event) =>
                        onUpdateCourse((current) => ({
                          ...current,
                          modules: current.modules.map((mod) =>
                            mod.id === module.id
                              ? {
                                  ...mod,
                                  items: mod.items.map((moduleItem) => (moduleItem.id === item.id ? { ...moduleItem, title: event.target.value, status: "edited" } : moduleItem))
                                }
                              : mod
                          )
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}
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

function QuizzesTab({ quizzes, onUpdate }: { quizzes: Quiz[]; onUpdate: (quizzes: Quiz[]) => void }) {
  return (
    <div className="stack">
      <h2>Quizzes</h2>
      {quizzes.map((quiz) => (
        <details className="detail-editor" key={quiz.id}>
          <summary>
            {quiz.title} <span>{quiz.questions.length} questions</span>
          </summary>
          <Input label="Title" value={quiz.title} onChange={(value) => onUpdate(quizzes.map((item) => (item.id === quiz.id ? { ...item, title: value } : item)))} />
          <TextArea label="Purpose" value={quiz.purpose} onChange={(value) => onUpdate(quizzes.map((item) => (item.id === quiz.id ? { ...item, purpose: value } : item)))} compact />
          <div className="question-list">
            {quiz.questions.map((question) => (
              <div className="question-row" key={question.id}>
                <span>{question.type.replace("_", " ")}</span>
                <textarea
                  value={question.stem}
                  onChange={(event) =>
                    onUpdate(quizzes.map((item) => (item.id === quiz.id ? { ...item, questions: item.questions.map((q) => (q.id === question.id ? { ...q, stem: event.target.value } : q)) } : item)))
                  }
                />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function RubricsTab({ rubrics, onUpdate }: { rubrics: Rubric[]; onUpdate: (rubrics: Rubric[]) => void }) {
  return (
    <div className="stack">
      <h2>Rubrics</h2>
      <div className="object-grid">
        {rubrics.map((rubric) => (
          <div className="object-card" key={rubric.id}>
            <Input label="Rubric title" value={rubric.title} onChange={(value) => onUpdate(rubrics.map((item) => (item.id === rubric.id ? { ...item, title: value } : item)))} />
            <strong>{rubric.points} points</strong>
            <small>{rubric.criteria.length} criteria</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradebookTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void }) {
  const total = course.assignmentGroups.reduce((sum, group) => sum + group.weight, 0);
  return (
    <div className="stack">
      <h2>Gradebook Setup</h2>
      <p className={Math.round(total) === 100 ? "good-note" : "warn-note"}>Weights total {total}%.</p>
      {course.assignmentGroups.map((group) => (
        <div className="grade-row" key={group.id}>
          <Input
            label="Group"
            value={group.name}
            onChange={(value) =>
              onUpdateCourse((current) => ({ ...current, assignmentGroups: current.assignmentGroups.map((item) => (item.id === group.id ? { ...item, name: value } : item)) }))
            }
          />
          <NumberInput
            label="Weight"
            value={group.weight}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) =>
              onUpdateCourse((current) => ({ ...current, assignmentGroups: current.assignmentGroups.map((item) => (item.id === group.id ? { ...item, weight: value } : item)) }))
            }
          />
        </div>
      ))}
    </div>
  );
}

function ContactHoursTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void }) {
  const fields: Array<[keyof typeof course.contactHours, string]> = [
    ["instructionalTime", "Instructional time"],
    ["readingMediaTime", "Reading/media"],
    ["assignmentTime", "Assignments"],
    ["discussionTime", "Discussions"],
    ["quizStudyTime", "Quiz/study"],
    ["finalProjectTime", "Final project"]
  ];
  return (
    <div className="stack">
      <h2>Contact Hours</h2>
      <div className="field-grid">
        {fields.map(([key, label]) => (
          <NumberInput
            key={key}
            label={label}
            value={Number(course.contactHours[key])}
            min={0}
            max={300}
            suffix="hours"
            onChange={(value) =>
              onUpdateCourse((current) => ({
                ...current,
                contactHours: {
                  ...current.contactHours,
                  [key]: value,
                  totalHours:
                    key === "totalHours"
                      ? value
                      : ["instructionalTime", "readingMediaTime", "assignmentTime", "discussionTime", "quizStudyTime", "finalProjectTime"].reduce(
                          (sum, itemKey) => sum + Number(itemKey === key ? value : current.contactHours[itemKey as keyof typeof current.contactHours]),
                          0
                        )
                }
              }))
            }
          />
        ))}
      </div>
      <TextArea
        label="Justification"
        value={course.contactHours.justification}
        onChange={(value) => onUpdateCourse((current) => ({ ...current, contactHours: { ...current.contactHours, justification: value } }))}
      />
    </div>
  );
}

function ThemeTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void }) {
  return (
    <div className="stack">
      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`theme-choice ${course.theme.id === theme.id ? "active" : ""}`}
            onClick={() => onUpdateCourse((current) => ({ ...current, theme, settings: { ...current.settings, themeId: theme.id } }))}
          >
            <span style={{ background: theme.accent }} />
            <strong>{theme.name}</strong>
            <small>{theme.bannerLabel}</small>
          </button>
        ))}
      </div>
      <section className="export-card">
        <h2>Apply Theme to Generated Content</h2>
        <p>
          Rebuilds generated homepage, syllabus, guide, module, assignment, and discussion HTML with the selected theme. Objects marked edited are preserved so faculty changes are not overwritten.
        </p>
        <button className="primary" onClick={() => onUpdateCourse((current) => applyThemeToGeneratedContent(current, current.theme))}>
          <Sparkles size={18} /> Apply theme to generated content
        </button>
      </section>
      <section className="export-card">
        <h2>Image Hooks</h2>
        <p>
          Current MVP packages deterministic SVG banner and tile assets. Future image generation should run server-side with usage tracking, plan limits, per-course credits, and super-admin controls.
        </p>
        <ul className="compact-list">
          <li>Homepage banner: {course.settings.imageSettings.homepageBannerMode}</li>
          <li>Course tile: {course.settings.imageSettings.courseTileMode}</li>
          <li>Future image credit limit: {course.settings.imageSettings.futureImageCreditLimit}</li>
        </ul>
      </section>
    </div>
  );
}

function ExportTab({
  course,
  readiness,
  quality,
  subscriptionActive,
  validationReport,
  isExporting,
  exportMode,
  onExportModeChange,
  importNotes,
  onExport
}: {
  course: CourseProject;
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  subscriptionActive: boolean;
  validationReport: ExportValidationReport | null;
  isExporting: boolean;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  importNotes: string[];
  onExport: () => void;
}) {
  return (
    <div className="export-layout">
      <section className="export-card">
        <FileArchive size={28} />
        <h2>Canvas IMSCC Export</h2>
        <p>
          Package includes manifest, module metadata, Canvas navigation defaults, pages, assignments, discussions, quizzes, rubrics, outcomes, assignment groups, guide PDFs, and generated image assets.
        </p>
        <div className="mode-grid" role="radiogroup" aria-label="Export mode">
          {(["full", "selected", "new", "changed"] as ExportMode[]).map((mode) => (
            <label key={mode} className={exportMode === mode ? "mode-choice active" : "mode-choice"}>
              <input type="radio" name="export-mode" value={mode} checked={exportMode === mode} onChange={() => onExportModeChange(mode)} />
              <span>{mode === "full" ? "Full course" : mode === "selected" ? "Selected content" : mode === "new" ? "New since export" : "Changed since export"}</span>
            </label>
          ))}
        </div>
        {exportMode !== "full" && (
          <p className="warn-note">
            MVP note: dependency validation runs for this mode, but the browser-only package still includes supporting course metadata, outcomes, rubrics, files, assignment groups, and module references so Canvas has context.
          </p>
        )}
        <button className="primary" disabled={!subscriptionActive || isExporting} onClick={onExport}>
          {subscriptionActive ? <ArrowDownToLine size={18} /> : <Lock size={18} />}
          {isExporting ? "Preparing package" : subscriptionActive ? "Validate and Download .imscc" : "Subscription required"}
        </button>
        <small className="block-note">
          Canvas sandbox import status: <strong>{validationReport?.sandboxImportStatus ?? "not_tested"}</strong>
        </small>
      </section>
      <section className="export-card">
        <h2>Current package contents</h2>
        <ul className="compact-list">
          <li>{course.pages.length} pages</li>
          <li>{course.modules.length} modules</li>
          <li>{course.assignments.length} assignments</li>
          <li>{course.discussions.length} discussions</li>
          <li>{course.quizzes.length} quizzes</li>
          <li>{course.rubrics.length} rubrics</li>
        </ul>
        <h3>Validation</h3>
        {validationReport ? (
          <>
            <p className={validationReport.valid ? "good-note" : "warn-note"}>{validationReport.valid ? "Local package validation passed." : "Local validation found blockers."}</p>
            <small>
              {validationReport.files.length} package files • score {validationReport.score}
            </small>
            {validationReport.issues.length > 0 && (
              <ul className="issue-list">
                {validationReport.issues.map((issue) => (
                  <li key={issue.id} className={issue.severity}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>Run export to generate the validation report.</p>
        )}
        <h3>Readiness score</h3>
        <p>{readiness.score}% before export validation.</p>
        <h3>Course quality</h3>
        <p>{quality.score}% instructional quality score.</p>
        <ul className="compact-list">
          {quality.categories.map((category) => (
            <li key={category.category}>
              {category.label}: {category.score}%{category.issues.length ? ` - ${category.issues[0]}` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section className="export-card">
        <h2>Canvas Import Starter Guide</h2>
        <ol className="compact-list">
          <li>Open the target Canvas course.</li>
          <li>Go to Settings.</li>
          <li>Click Import Course Content.</li>
          <li>Choose Canvas Course Export Package or the IMSCC/Common Cartridge option your Canvas instance provides.</li>
          <li>Choose the CourseForge .imscc file.</li>
          <li>Select all content or selected content.</li>
          <li>Adjust due dates if needed.</li>
          <li>Start the import.</li>
          <li>Review modules, navigation, gradebook groups, rubrics, syllabus, publish states, and guide files.</li>
        </ol>
        <p className="warn-note">Reimporting edited objects into an existing Canvas course can create duplicates instead of replacing earlier content.</p>
      </section>
      <section className="export-card">
        <h2>Existing Canvas Course Import</h2>
        <p>
          To iterate from a current Canvas course, export it from Canvas Settings, choose course export, download the .imscc, then upload it in CourseForge's Create screen. The current parser recovers pages and partial shells for assignments, discussions, and quizzes.
        </p>
        {importNotes.length > 0 && (
          <ul className="issue-list">
            {importNotes.map((note) => (
              <li key={note} className="warning">
                {note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReadinessPanel({
  readiness,
  quality,
  validationReport,
  subscriptionActive
}: {
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  validationReport: ExportValidationReport | null;
  subscriptionActive: boolean;
}) {
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
      <ul>
        {readiness.checks.map((item) => (
          <li key={item.id} className={item.passed ? "passed" : item.severity}>
            <CheckCircle2 size={15} /> <span>{item.label}</span>
          </li>
        ))}
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

export default App;
