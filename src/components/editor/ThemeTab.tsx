// Theme tab (+ its custom-theme builder and swatch) — extracted from App.tsx.
// This is the ONLY consumer of data/visualTemplates and the main consumer of
// data/themes, so moving it is what lets those leave the initial bundle.

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Lock, Palette, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Input } from "../../components/form";
import { themes } from "../../data/themes";
import { visualTemplateForThemeId, visualTemplates } from "../../data/visualTemplates";
import { colorblindSafetyReport } from "../../services/accessibility";
import type { CustomThemeInput } from "../../services/customThemes";
import { buildThemeFromCustom } from "../../services/customThemes";
import type { ThemePreviewKind } from "../../services/themeDesign";
import { buildThemePreviewHtml, getThemeStyles, validateTheme } from "../../services/themeDesign";
import type { CourseProject, Theme, VisualTemplateCategory } from "../../types";

import type { EditorTab } from "../../types";
import { themePreviewModes } from "./shared";

export function ThemeSwatch({ label, value }: { label: string; value: string }) {
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

export function CustomThemeBuilder({
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
  const [basePresetId, setBasePresetId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input: CustomThemeInput = { name, institutionName: institution, primaryColor, backgroundColor, textColor, logoDataUrl, basePresetId: basePresetId || undefined };
  const preview = useMemo(() => buildThemeFromCustom(input), [name, institution, primaryColor, backgroundColor, textColor, logoDataUrl, basePresetId]);
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
          <p>Match your institution's colors and logo — optionally co-branded onto any template's look (motif, hero, cards). Apply it now, or save it to your account to reuse and export.</p>
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
            <label className="color-field" style={{ display: "block" }}>
              <span>Base on a template (optional — applies your brand colors to its look)</span>
              <select value={basePresetId} onChange={(event) => setBasePresetId(event.target.value)} aria-label="Base template" style={{ width: "100%" }}>
                <option value="">None — plain brand palette</option>
                {visualTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
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

export function ThemeTab({
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
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateCategory, setTemplateCategory] = useState<VisualTemplateCategory | "All">("All");
  const libraryThemes = useMemo(() => [...customThemes, ...themes], [customThemes]);
  const validation = useMemo(() => validateTheme(course.theme), [course.theme]);
  const colorblind = useMemo(() => colorblindSafetyReport(course.theme), [course.theme]);
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
  const templateCategories: Array<VisualTemplateCategory | "All"> = ["All", "Core", "Genre", "Art style", "Era", "Mood"];
  const visibleTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return visualTemplates.filter((template) => {
      const category = template.category ?? "Core";
      const matchesCategory = templateCategory === "All" || category === templateCategory;
      const searchable = `${template.name} ${template.shortName} ${template.description} ${template.bestFor} ${category}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [templateCategory, templateQuery]);

  const chooseTheme = (theme: Theme): void => {
    setRefreshNotice(null);
    onUpdateCourse((current) => ({ ...current, theme, settings: { ...current.settings, themeId: theme.id, themeIntensity: theme.intensity ?? current.settings.themeIntensity }, status: "edited" }));
  };

  const refreshThemeStyling = async (): Promise<void> => {
    const { applyThemeToGeneratedContent } = await import("../../services/courseGenerator");
    onUpdateCourse((current) => applyThemeToGeneratedContent(current, current.theme));
    setRefreshNotice("Theme styling refreshed. Template-generated content was recolored, builder pages received snapshots, and manually edited objects were preserved where possible.");
  };

  const activeTemplateId = course.settings.visualTemplateId ?? visualTemplateForThemeId(course.theme.id)?.id;
  const applyTemplate = async (template: (typeof visualTemplates)[number]): Promise<void> => {
    // One move: swap the curated theme, point homepage/syllabus at the template layouts, and re-theme
    // all generated content so previews + export reflect the look immediately.
    const { applyVisualTemplate } = await import("../../services/courseGenerator");
    onUpdateCourse((current) => applyVisualTemplate(current, template));
    setRefreshNotice(`Applied the ${template.name} visual template. Homepage, syllabus, module cards, and the export banner were restyled. Manually edited objects were preserved where possible.`);
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
            <span title={colorblind.warnings.join(" ") || "Distinctions survive color blindness"}>
              {colorblind.safe ? "Colorblind-safe" : `${colorblind.warnings.length} colorblind note(s)`}
            </span>
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

      <section className="template-gallery-panel" aria-label="Visual template gallery">
        <header className="template-gallery-head">
          <div>
            <span className="hp-eyebrow"><Sparkles size={14} /> Visual template gallery</span>
            <h2>Pick a complete course look</h2>
            <p>Each template bundles a palette, gradient hero, decorative motif, typography, and section-card style, plus matching homepage and syllabus layouts. Apply any look to any course; you can still fine-tune colors below.</p>
          </div>
        </header>
        <div className="template-gallery-tools">
          <label className="template-search-field">
            <span>Find a course look</span>
            <input
              type="search"
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
              placeholder="Try cyberpunk, watercolor, 1980s…"
            />
          </label>
          <div className="template-category-filters" role="group" aria-label="Filter visual templates by category">
            {templateCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={templateCategory === category ? "active" : ""}
                aria-pressed={templateCategory === category}
                onClick={() => setTemplateCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <span className="template-result-count" aria-live="polite">{visibleTemplates.length} look{visibleTemplates.length === 1 ? "" : "s"}</span>
        </div>
        <div className="template-gallery-grid">
          {visibleTemplates.map((template) => {
            const ts = getThemeStyles(template.theme);
            const isActive = activeTemplateId === template.id;
            return (
              <article key={template.id} className={`template-card ${isActive ? "active" : ""}`}>
                <div
                  className="template-card-thumb"
                  style={{ background: `linear-gradient(135deg, ${ts.gradientFrom} 0%, ${ts.gradientTo} 100%)` }}
                  aria-hidden="true"
                >
                  <span className="template-card-chip" style={{ fontFamily: ts.font, color: ts.accentDark }}>{template.shortName}</span>
                  <span className="template-card-swatches">
                    <i style={{ background: template.theme.accent }} />
                    <i style={{ background: template.theme.soft }} />
                    <i style={{ background: ts.gradientTo }} />
                  </span>
                </div>
                <div className="template-card-body">
                  <span className="template-card-category">{template.category ?? "Core"}</span>
                  <strong style={{ fontFamily: ts.font }}>{template.name}</strong>
                  <p>{template.description}</p>
                  <span className="template-card-bestfor">Best for: {template.bestFor}</span>
                </div>
                <div className="template-card-actions">
                  <button
                    type="button"
                    className={isActive ? "secondary" : "primary"}
                    onClick={() => applyTemplate(template)}
                    aria-pressed={isActive}
                  >
                    {isActive ? <><CheckCircle2 size={15} /> Applied</> : <>Apply template</>}
                  </button>
                </div>
              </article>
            );
          })}
          {visibleTemplates.length === 0 && (
            <div className="template-gallery-empty" role="status">
              <strong>No matching course looks</strong>
              <span>Try a broader search or choose All.</span>
              <button type="button" className="secondary" onClick={() => { setTemplateQuery(""); setTemplateCategory("All"); }}>Clear filters</button>
            </div>
          )}
        </div>
      </section>

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
          <h2>Apply Theme to Course Content</h2>
          <p>
            Rebuilds generated homepage, syllabus, guide, module, assignment, discussion, and support page HTML with the selected theme. Manual edits are preserved where possible.
          </p>
          {builderThemeDrift.length > 0 && <p className="theme-refresh-hint">{builderThemeDrift.join(", ")} can be refreshed from structured builder data.</p>}
          <button className="primary" onClick={refreshThemeStyling}>
            <Sparkles size={18} /> Apply theme to course content
          </button>
          {refreshNotice && <p className="theme-refresh-success"><CheckCircle2 size={15} /> {refreshNotice}</p>}
        </section>

        <section className="theme-refresh-card">
          <h2>Export Assets</h2>
          <p>The exported banner, tile, module headers, badges, icons, and dividers use the selected theme's palette, motif, and intensity.</p>
          <ul className="compact-list">
            <li>Homepage banner: {course.settings.imageSettings.homepageBannerMode}</li>
            <li>Course tile: {course.settings.imageSettings.courseTileMode}</li>
            <li>Module headers: {course.settings.imageSettings.moduleHeaderImages ? "Included" : "Off"}</li>
            <li>Reusable SVG assets: {course.fileAssets.filter((asset) => /badge|icon|divider/i.test(asset.fileName)).length}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}


// Map a readiness check to the editor tab where the user can act on it, so each item is a shortcut.
