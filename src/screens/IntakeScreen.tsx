// Course intake / brief screen — extracted from App.tsx. The heaviest consumer
// of the shared form primitives.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileText, ListChecks, Loader2, Lock, Plus, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { CourseBlueprintPreview } from "../components/CourseBlueprintPreview";
import { BrandBadge } from "../components/brand";
import { CollapsibleSection, Input, ListTextArea, NumberInput, Select, SourceStatusBadge, TextArea, Toggle } from "../components/form";
import { defaultSettings } from "../data/defaultSettings";
import { themes } from "../data/themes";
import { inferSettingsFromPrompt } from "../services/promptInference";
import { augmentPromptWithSources } from "../services/sourceParsing";
import type { CourseSettings } from "../types";

import { weekdayLabels, weekdayOptions } from "./appModel";

export function Intake({
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
  // Guided mode (the default) walks through one step at a time — a calm wizard for most users.
  // Quick build stays available for experienced users who want every setting on one page. Both
  // expose the full settings — just at different paces.
  const [intakeMode, setIntakeMode] = useState<"quick" | "guided">("guided");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [guidedStep, setGuidedStep] = useState(0);
  // Assumptions inferred from the course description when leaving step 1, shown as an
  // editable-banner on later steps. Only fields still at their defaults are pre-filled.
  const [inferredNotes, setInferredNotes] = useState<string[]>([]);

  const applyPromptInference = (): void => {
    const intakeContext = augmentPromptWithSources(prompt, settings.sourceFiles);
    if (!intakeContext.trim()) return;
    const { updates, notes } = inferSettingsFromPrompt(intakeContext);
    const applied: string[] = [];
    (Object.entries(updates) as Array<[keyof typeof updates, never]>).forEach(([key, value]) => {
      if (settings[key] === defaultSettings[key]) {
        onSettingsChange(key, value);
        applied.push(key);
      }
    });
    setInferredNotes(applied.length > 0 ? notes : []);
  };

  // Quick build has no "Continue" moment, so inference runs as the user types (debounced).
  // It still only fills fields the user hasn't touched, exactly like the guided path.
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  useEffect(() => {
    const hasSourceText = settings.sourceFiles.some((source) => Boolean(source.text?.trim()));
    if (intakeMode !== "quick" || (!prompt.trim() && !hasSourceText)) return;
    const timer = window.setTimeout(() => {
      if (promptRef.current === prompt) applyPromptInference();
    }, 700);
    return () => window.clearTimeout(timer);
    // applyPromptInference reads current props/state; re-running on prompt/mode change is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, intakeMode, settings.sourceFiles]);
  const toggleSection = (key: string): void => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const updateSchedule = <K extends keyof CourseSettings["schedule"]>(key: K, value: CourseSettings["schedule"][K]) => {
    onSettingsChange("schedule", { ...settings.schedule, [key]: value });
  };
  const submitPaste = (): void => {
    onPasteSource(pasteText);
    setPasteText("");
  };

  // Generation needs a course brief, explicit title, or source text. A source-only workflow is
  // valid (for example, starting from a syllabus), but an entirely empty intake is not.
  const hasReadableSource = settings.sourceFiles.some(
    (source) => (source.status === "parsed" || source.status === "needs-review") && Boolean(source.text?.trim())
  );
  const hasIntake = Boolean(prompt.trim() || settings.title.trim() || hasReadableSource);
  const emptyIntakeHint = !hasIntake ? (
    <p className="prompt-hint" role="status">
      Describe your course, set a title, or add a readable source to continue.
    </p>
  ) : null;

  const generateButton = canUseAi ? (
    <>
      <button className="primary" onClick={onGenerateBlueprint} disabled={aiBusy || !hasIntake}>
        {aiBusy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
        {aiBusy ? "Generating blueprint…" : "Generate Blueprint with AI"}
      </button>
      {/* The instant deterministic draft stays available so an unreachable AI service is
          never a dead end — the user always has a way to get their course. */}
      <button
        className="secondary"
        onClick={onGenerate}
        disabled={aiBusy || !hasIntake}
        title="Build a structured draft instantly from your settings — no AI credits used. You can fill it with AI content later from the Export tab."
      >
        <Wand2 size={17} /> Build instant draft (no AI)
      </button>
      {emptyIntakeHint}
    </>
  ) : isAuthed ? (
    <button className="primary" onClick={onUpgrade}>
      <Lock size={18} /> Upgrade to generate with AI
    </button>
  ) : (
    <>
      <button className="primary" onClick={onGenerate} disabled={!hasIntake}>
        <Sparkles size={18} /> Generate sample course (no AI)
      </button>
      {emptyIntakeHint}
    </>
  );

  const promptPanel = (
    <div className="prompt-panel">
          <span className="panel-label">
            <Wand2 size={14} /> Course brief
          </span>
          <div className="rc-trail prompt-trail" aria-hidden="true" />
          <label htmlFor="prompt">Describe your course</label>
          <p className="prompt-hint">Plain language is fine — topic, audience, goals, tone, and anything you want emphasized.</p>
          <textarea id="prompt" className="prompt-textarea" value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="e.g. An 8-week undergraduate course on AI and Modern Society for non-majors. Emphasize ethics, real-world cases, and weekly discussion. Friendly, practical tone." />
          {!prompt.trim() && (
            <div className="prompt-examples" aria-label="Example course briefs">
              <span className="prompt-examples-label">Try an example:</span>
              {[
                "An 8-week undergraduate course on AI and Modern Society for non-majors. Emphasize ethics, real-world cases, and weekly discussion. Friendly, practical tone.",
                "A 16-week graduate research methods course for nursing students. Include APA writing support, a scaffolded literature-review project, and biweekly quizzes.",
                "A 6-week professional development course on workplace safety for new EMS supervisors. Scenario-based, practical, with a final case-study presentation."
              ].map((example) => (
                <button key={example} type="button" className="prompt-example-chip" onClick={() => onPromptChange(example)}>
                  {example.split(".")[0]}
                </button>
              ))}
            </div>
          )}
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
            <Lock size={13} /> When you choose an AI blueprint, your prompt and extracted source text are sent to the AI provider only to generate your draft.
            Generated content is a first draft and must be reviewed for accuracy, accessibility, grading, and policy before use.
          </p>
        </div>
  );

  const basicsFields = (
    <>
            <Select
              label="Course content"
              value={settings.contentDepth ?? "complete-course"}
              options={["complete-course", "generic-template"]}
              labels={{ "complete-course": "Fully generated course", "generic-template": "Generic editable template" }}
              hint="Fully generated writes subject-specific drafts for every page and activity. Generic template builds the same structure with neutral placeholder text you fill in yourself."
              onChange={(value) => onSettingsChange("contentDepth", value as CourseSettings["contentDepth"])}
            />
            <Input label="Course title" value={settings.title} placeholder="Leave blank to derive from your course brief" onChange={(value) => onSettingsChange("title", value)} />
            <TextArea label="Course description" value={settings.description} placeholder="Optional — a catalog-style description. Leave blank and we'll write one from your brief." onChange={(value) => onSettingsChange("description", value)} compact />
            <div className="field-grid">
              <Select label="Level" value={settings.level} options={["Undergraduate", "Graduate", "Professional", "High school", "Continuing education"]} onChange={(value) => onSettingsChange("level", value)} />
              <Select label="Modality" value={settings.modality} options={["Online asynchronous", "Online synchronous", "Hybrid", "Face-to-face", "Accelerated"]} onChange={(value) => onSettingsChange("modality", value)} />
              <NumberInput label="Credit hours" value={settings.creditHours} min={1} max={6} onChange={(value) => onSettingsChange("creditHours", value)} />
              <Select label="Tone" value={settings.tone} options={["Friendly academic", "Formal", "Practical", "Technical", "Clinical"]} hint="The writing voice used across generated pages, assignments, and announcements." onChange={(value) => onSettingsChange("tone", value)} />
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
              <NumberInput label="Teaching modules" value={settings.moduleCount} min={3} max={18} onChange={(value) => onSettingsChange("moduleCount", value)} />
              <Select
                label="Organize by"
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
                hint="How learning outcomes are worded and leveled. Bloom's is the safe default."
                onChange={(value) => onSettingsChange("outcomeFramework", value as CourseSettings["outcomeFramework"])}
              />
              <Select
                label="Course structure"
                value={settings.structureFramework}
                options={["linear", "backward", "spiral", "thematic", "competency"]}
                labels={{ linear: "Subject-centred (linear)", backward: "Backward design (UbD)", spiral: "Spiral", thematic: "Thematic", competency: "Competency-based" }}
                hint="The overall teaching approach — e.g. backward design drafts assessments first, then content to match."
                onChange={(value) => onSettingsChange("structureFramework", value as CourseSettings["structureFramework"])}
              />
              <Select
                label="Module pattern"
                value={settings.modulePattern}
                options={["standard", "addie", "gagne", "inquiry", "conceptual"]}
                labels={{ standard: "Standard learning path", addie: "ADDIE", gagne: "Gagné's Nine Events", inquiry: "Inquiry-based", conceptual: "Conceptual framework" }}
                hint="How each module's items are ordered inside — overview, content, practice, assessment."
                onChange={(value) => onSettingsChange("modulePattern", value as CourseSettings["modulePattern"])}
              />
            </div>
  );

  const assessmentsFields = (
            <div className="field-grid">
              <Select label="Quizzes" value={settings.quizFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("quizFrequency", value as CourseSettings["quizFrequency"])} />
              {settings.quizFrequency !== "none" && (
                <>
                  <NumberInput label="Questions per quiz" value={settings.quizQuestionsPerQuiz} min={1} max={10} onChange={(value) => onSettingsChange("quizQuestionsPerQuiz", value)} />
                  <Select label="Quiz difficulty" value={settings.quizDifficulty} options={["introductory", "balanced", "challenging"]} onChange={(value) => onSettingsChange("quizDifficulty", value as CourseSettings["quizDifficulty"])} />
                  <Select label="Quiz purpose" value={settings.quizPurpose} options={["knowledge-check", "pre-assessment", "application", "scenario", "socratic", "review"]} labels={{ "knowledge-check": "Knowledge check", "pre-assessment": "Pre-assessment", application: "Application", scenario: "Scenario-based", socratic: "Socratic", review: "Review & reinforce" }} hint="What quizzes are for — quick recall checks, applying ideas to scenarios, or end-of-module review." onChange={(value) => onSettingsChange("quizPurpose", value as CourseSettings["quizPurpose"])} />
                </>
              )}
              <Select label="Discussions" value={settings.discussionFrequency} options={["weekly", "biweekly", "module", "none"]} onChange={(value) => onSettingsChange("discussionFrequency", value as CourseSettings["discussionFrequency"])} />
              {settings.discussionFrequency !== "none" && <Select label="Discussion style" value={settings.discussionStyle} options={["reflective", "case-based", "debate", "peer-review", "application"]} hint="The kind of prompt students respond to — personal reflection, analyzing a case, structured debate, reviewing peer work, or applying ideas to new situations." onChange={(value) => onSettingsChange("discussionStyle", value as CourseSettings["discussionStyle"])} />}
              <Select label="Assignments" value={settings.assignmentCadence} options={["every-module", "every-other-module", "major-milestones", "custom"]} labels={{ "every-module": "Every module", "every-other-module": "Every other module", "major-milestones": "Major milestones", custom: "Custom" }} onChange={(value) => onSettingsChange("assignmentCadence", value as CourseSettings["assignmentCadence"])} />
              {settings.finalProject && <Select label="Final project type" value={settings.finalProjectType} options={["project", "presentation", "paper", "portfolio", "exam", "case-study", "simulation", "other"]} onChange={(value) => onSettingsChange("finalProjectType", value as CourseSettings["finalProjectType"])} />}
              {settings.finalProject && settings.scaffoldFinalProject && <Select label="Scaffold pattern" value={settings.scaffoldPattern} options={["every-other-module", "key-milestones", "custom"]} labels={{ "every-other-module": "Every other module", "key-milestones": "Key milestones", custom: "Custom" }} hint="How often students submit final-project check-ins along the way, so the big project isn't one giant deadline." onChange={(value) => onSettingsChange("scaffoldPattern", value as CourseSettings["scaffoldPattern"])} />}
            </div>
  );

  const optionsFields = (
            <div className="toggle-grid">
              <Toggle label="Final project" hint="Adds a culminating final project with its own module, rubric, and gradebook weight." checked={settings.finalProject} onChange={(value) => { onSettingsChange("finalProject", value); if (!value) onSettingsChange("scaffoldFinalProject", false); }} />
              {settings.finalProject && <Toggle label="Scaffold final project" hint="Spreads the final project across smaller graded check-ins during the term instead of one big deadline." checked={settings.scaffoldFinalProject} onChange={(value) => onSettingsChange("scaffoldFinalProject", value)} />}
              <Toggle label="Rubrics" hint="Generates a Canvas rubric for every graded assignment and discussion, aligned to the course outcomes." checked={settings.includeRubrics} onChange={(value) => onSettingsChange("includeRubrics", value)} />
              <Toggle label="AAA contrast" hint="Uses the strictest WCAG AAA color-contrast tier for themed content (larger text, stronger contrast). Default is AA, the common institutional standard." checked={settings.accessibilityTier === "AAA"} onChange={(value) => onSettingsChange("accessibilityTier", value ? "AAA" : "AA")} />
              <Select
                label="Course card image"
                value={settings.imageSettings.courseTileMode}
                options={["generated-svg", "upload", "future-ai", "url"]}
                labels={{ "generated-svg": "Start with theme artwork", upload: "Upload after build", "future-ai": "Generate with Premium", url: "Keep saved image URL" }}
                hint="Canvas dashboard cards use a wide crop. Uploading your own image never uses AI credits."
                onChange={(value) => onSettingsChange("imageSettings", { ...settings.imageSettings, courseTileMode: value as CourseSettings["imageSettings"]["courseTileMode"] })}
              />
              <Select
                label="Homepage banner"
                value={settings.imageSettings.homepageBannerMode}
                options={["generated-svg", "upload", "future-ai", "url"]}
                labels={{ "generated-svg": "Start with theme artwork", upload: "Upload after build", "future-ai": "Generate with Premium", url: "Keep saved image URL" }}
                hint="After the course is built, the Imagery step handles crop, focal point, alt text, versions, and export."
                onChange={(value) => onSettingsChange("imageSettings", { ...settings.imageSettings, homepageBannerMode: value as CourseSettings["imageSettings"]["homepageBannerMode"] })}
              />
              <Toggle label="Module image hooks" hint="Adds a decorative SVG header image to each module overview page (no external image services)." checked={settings.imageSettings.moduleHeaderImages} onChange={(value) => onSettingsChange("imageSettings", { ...settings.imageSettings, moduleHeaderImages: value })} />
            </div>
  );

  const scheduleFields = (
    <>
            <Toggle label="Generate due dates" checked={settings.schedule.enableDueDates} onChange={(value) => updateSchedule("enableDueDates", value)} />
            {settings.schedule.enableDueDates ? (
              <>
                <div className="field-grid">
                  <Input label="Term start" type="date" value={settings.schedule.termStartDate ?? ""} onChange={(value) => updateSchedule("termStartDate", value || undefined)} />
                  <Input label="Term end" type="date" value={settings.schedule.termEndDate ?? ""} onChange={(value) => updateSchedule("termEndDate", value || undefined)} />
                  <Select label="Module release day" value={String(settings.schedule.moduleReleaseDay)} options={weekdayOptions} labels={weekdayLabels} onChange={(value) => updateSchedule("moduleReleaseDay", Number(value))} />
                  <Select label="Preferred due day" value={String(settings.schedule.preferredDueDay)} options={weekdayOptions} labels={weekdayLabels} onChange={(value) => updateSchedule("preferredDueDay", Number(value))} />
                  <Input label="Preferred due time" type="time" value={settings.schedule.preferredDueTime} onChange={(value) => updateSchedule("preferredDueTime", value)} />
                </div>
                <ListTextArea label="Holidays" helper="One per line or comma-separated. Press Enter for a new line — e.g. Thanksgiving Break, Spring Break." value={settings.schedule.holidays} onChange={(value) => updateSchedule("holidays", value)} />
                <ListTextArea label="Blackout dates" helper="Dates to keep clear of due dates. One per line or comma-separated — paste freely." value={settings.schedule.blackoutDates} onChange={(value) => updateSchedule("blackoutDates", value)} />
                <TextArea label="Paste your school academic calendar (optional)" value={settings.schedule.academicCalendar ?? ""} onChange={(value) => updateSchedule("academicCalendar", value)} rows={5} />
                <p className="field-hint">Paste a term calendar here and RocketCourse uses it as context to avoid holidays, breaks, exam periods, and blackout dates when scheduling. Multi-line text, spacing, and line breaks are preserved.</p>
                <Toggle label="Allow dates outside term" checked={settings.schedule.allowDueDatesOutsideTerm} onChange={(value) => updateSchedule("allowDueDatesOutsideTerm", value)} />
              </>
            ) : (
              <p className="field-hint">Turn this on to set term dates, release timing, holidays, and blackout dates.</p>
            )}
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
    <main id="main-content" tabIndex={-1} className="intake page-shell">
      <section className="page-heading intake-heading">
        <div>
          <BrandBadge className="dashboard-badge" />
          <h1>Create a Course</h1>
          <p>
            {intakeMode === "quick"
              ? "Describe your course and generate. Open Advanced options only if you want to fine-tune."
              : "Walk through each part of your course design, one step at a time."}
          </p>
          <p className="intake-brand-hint">Launch a course draft from your syllabus, notes, or idea.</p>
        </div>
        <div className="intake-controls">
          <div className="intake-mode-toggle" role="tablist" aria-label="Create mode">
            <button role="tab" aria-selected={intakeMode === "guided"} className={intakeMode === "guided" ? "active" : ""} onClick={() => { setIntakeMode("guided"); setGuidedStep(0); }}>
              <ListChecks size={15} /> Guided steps
            </button>
            <button role="tab" aria-selected={intakeMode === "quick"} className={intakeMode === "quick" ? "active" : ""} onClick={() => setIntakeMode("quick")}>
              <Wand2 size={15} /> Quick build
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
          {/* Step 1 is a single focused question — the stepper appears once there's a journey to show. */}
          {guidedStep > 0 && (
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
          )}
          <div className={`guided-step-body${guidedStep === 0 ? " solo" : ""}`}>
            <div className="guided-progress" aria-hidden="true">
              <i style={{ width: `${((guidedStep + 1) / guidedSteps.length) * 100}%` }} />
            </div>
            {guidedStep === 0 ? (
              <>
                <h2 className="guided-step-title">What do you teach?</h2>
                <p className="guided-step-sub">
                  One or two sentences is enough — we'll set up the rest from your description, and you can adjust
                  everything before generating.
                </p>
              </>
            ) : (
              <h2 className="guided-step-title">
                Step {guidedStep + 1} of {guidedSteps.length}: {guidedSteps[guidedStep].title}
              </h2>
            )}
            {guidedStep > 0 && inferredNotes.length > 0 && (
              <p className="inferred-note" role="note">
                <Sparkles size={14} /> Pre-filled from your description: <strong>{inferredNotes.join(" · ")}</strong> —
                adjust anything below.
              </p>
            )}
            <div className={`guided-step-content ${guidedStep > 0 ? "with-blueprint" : ""}`}>
              <div className="guided-step-fields">{guidedSteps[guidedStep].node}</div>
              {guidedStep > 0 && <CourseBlueprintPreview settings={settings} />}
            </div>
            <div className="guided-nav">
              <button className="secondary" onClick={() => setGuidedStep((value) => Math.max(0, value - 1))} disabled={guidedStep === 0}>
                <ArrowLeft size={15} /> Back
              </button>
              {guidedStep < lastStep ? (
                <button
                  className="primary"
                  disabled={guidedStep === 0 && !hasIntake}
                  onClick={() => {
                    if (guidedStep === 0) applyPromptInference();
                    setGuidedStep((value) => Math.min(lastStep, value + 1));
                  }}
                >
                  {guidedStep === 0 ? "Continue" : "Next"} <ArrowRight size={15} />
                </button>
              ) : (
                generateButton
              )}
            </div>
            {guidedStep === 0 && emptyIntakeHint}
          </div>
        </section>
      )}
    </main>
  );
}
