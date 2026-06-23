import type { Theme, VisualTemplate } from "../types";

// ============================================================================
// Visual template library
// ----------------------------------------------------------------------------
// Each entry is a cohesive, named look a user can apply to ANY course — not a
// subject lock-in. A template bundles a curated, export-safe Theme (palette +
// gradient + pattern + decorative motif + typography + hero/card personality)
// with matching homepage and syllabus layout templates. Applying one preset
// restyles the editor previews, homepage, syllabus, module/page cards, the
// export banner, and the exported Canvas HTML in one move.
//
// Theme ids are prefixed "vt-" so they never collide with the base color themes
// and are registered with getTheme() (data/themes.ts) so generated content
// resolves the right palette. Every theme here is tuned to pass validateTheme()
// (WCAG contrast) — locked by visualTemplates.test.ts.
// ============================================================================

const theme = (t: Theme): Theme => t;

export const visualTemplates: VisualTemplate[] = [
  {
    id: "cognitive-lab",
    name: "Cognitive Lab",
    shortName: "Cognitive Lab",
    description: "Calm violet study with lab glassware motif, airy spotlight hero, and soft-filled section cards.",
    bestFor: "Psychology, neuroscience, and behavioral science",
    homepageTemplateId: "clean-canvas",
    syllabusTemplateId: "standard-university",
    theme: theme({
      id: "vt-cognitive-lab",
      name: "Cognitive Lab",
      accent: "#6d28d9",
      accentDark: "#4c1d95",
      soft: "#f5f3ff",
      contrastText: "#2e1065",
      bannerLabel: "Cognitive Lab",
      contrastStatus: "pass",
      gradientFrom: "#5b21b6",
      gradientTo: "#4338ca",
      pattern: "dots",
      motif: "lab",
      fontFamily: "sans",
      heroStyle: "spotlight",
      cardStyle: "soft-fill"
    })
  },
  {
    id: "writers-studio",
    name: "Writer's Studio",
    shortName: "Writer's Studio",
    description: "Warm ink-and-paper serif with a split editorial hero and left-accent cards.",
    bestFor: "Creative writing, literature, and the humanities",
    homepageTemplateId: "warm-instructor",
    syllabusTemplateId: "standard-university",
    theme: theme({
      id: "vt-writers-studio",
      name: "Writer's Studio",
      accent: "#b45309",
      accentDark: "#7c2d12",
      soft: "#fdf6ec",
      contrastText: "#6b2710",
      bannerLabel: "Writer's Studio",
      contrastStatus: "pass",
      gradientFrom: "#9a3412",
      gradientTo: "#7c2d12",
      pattern: "none",
      motif: "none",
      fontFamily: "serif",
      heroStyle: "split",
      cardStyle: "accent-bar"
    })
  },
  {
    id: "ocean-field-station",
    name: "Ocean Field Station",
    shortName: "Ocean Station",
    description: "Deep teal-to-navy gradient with rolling wave motif and a dramatic stage hero.",
    bestFor: "Marine biology, oceanography, and earth science",
    homepageTemplateId: "bold-university",
    syllabusTemplateId: "hybrid-course",
    theme: theme({
      id: "vt-ocean-field-station",
      name: "Ocean Field Station",
      accent: "#0891b2",
      accentDark: "#155e75",
      soft: "#ecfeff",
      contrastText: "#083344",
      bannerLabel: "Ocean Field Station",
      contrastStatus: "pass",
      gradientFrom: "#0f172a",
      gradientTo: "#0e7490",
      pattern: "grid",
      motif: "wave",
      fontFamily: "sans",
      heroStyle: "stage",
      cardStyle: "elevated"
    })
  },
  {
    id: "climate-systems",
    name: "Climate Systems",
    shortName: "Climate Systems",
    description: "Living-green palette with botanical leaf motif, banner hero, and accent-bar cards.",
    bestFor: "Environmental science, sustainability, and ecology",
    homepageTemplateId: "project-based",
    syllabusTemplateId: "accreditation-friendly",
    theme: theme({
      id: "vt-climate-systems",
      name: "Climate Systems",
      accent: "#15803d",
      accentDark: "#14532d",
      soft: "#f0fdf4",
      contrastText: "#14532d",
      bannerLabel: "Climate Systems",
      contrastStatus: "pass",
      gradientFrom: "#166534",
      gradientTo: "#15803d",
      pattern: "crosshatch",
      motif: "botanical",
      fontFamily: "sans",
      heroStyle: "banner",
      cardStyle: "accent-bar"
    })
  },
  {
    id: "museum-gallery",
    name: "Museum Gallery",
    shortName: "Museum",
    description: "Refined charcoal-and-gold serif with a quiet minimal hero and crisp outline cards.",
    bestFor: "Art history, design, and curatorial studies",
    homepageTemplateId: "clean-canvas",
    syllabusTemplateId: "accreditation-friendly",
    theme: theme({
      id: "vt-museum-gallery",
      name: "Museum Gallery",
      accent: "#a16207",
      accentDark: "#713f12",
      soft: "#faf7f0",
      contrastText: "#422006",
      bannerLabel: "Museum Gallery",
      contrastStatus: "pass",
      gradientFrom: "#292524",
      gradientTo: "#44403c",
      pattern: "none",
      motif: "none",
      fontFamily: "serif",
      heroStyle: "minimal",
      cardStyle: "outline"
    })
  },
  {
    id: "ledger-strategy",
    name: "Ledger & Strategy",
    shortName: "Ledger",
    description: "Executive slate-and-blue with a structured grid, split hero, and elevated cards.",
    bestFor: "Accounting, finance, and business strategy",
    homepageTemplateId: "bold-university",
    syllabusTemplateId: "accreditation-friendly",
    theme: theme({
      id: "vt-ledger-strategy",
      name: "Ledger & Strategy",
      accent: "#0369a1",
      accentDark: "#075985",
      soft: "#f0f9ff",
      contrastText: "#082f49",
      bannerLabel: "Ledger & Strategy",
      contrastStatus: "pass",
      gradientFrom: "#1e293b",
      gradientTo: "#334155",
      pattern: "grid",
      motif: "none",
      fontFamily: "sans",
      heroStyle: "split",
      cardStyle: "elevated"
    })
  },
  {
    id: "space-mission-control",
    name: "Space Mission Control",
    shortName: "Mission Control",
    description: "RocketCourse's signature deep-space violet with cosmic motif, rounded type, and a bold stage hero.",
    bestFor: "Flagship courses and anything that wants the RocketCourse look",
    homepageTemplateId: "bold-university",
    syllabusTemplateId: "online-course",
    theme: theme({
      id: "vt-space-mission-control",
      name: "Space Mission Control",
      accent: "#7c3aed",
      accentDark: "#5b21b6",
      soft: "#f3e8ff",
      contrastText: "#2e1065",
      bannerLabel: "Mission Control",
      contrastStatus: "pass",
      gradientFrom: "#312e81",
      gradientTo: "#1e1b4b",
      pattern: "dots",
      motif: "cosmic",
      fontFamily: "rounded",
      heroStyle: "stage",
      cardStyle: "elevated"
    })
  },
  {
    id: "studio-workshop",
    name: "Studio Workshop",
    shortName: "Studio",
    description: "Energetic orange with architectural blueprint motif, a stage hero, and accent-bar cards.",
    bestFor: "Studio, capstone, maker, and project-based courses",
    homepageTemplateId: "project-based",
    syllabusTemplateId: "project-based",
    theme: theme({
      id: "vt-studio-workshop",
      name: "Studio Workshop",
      accent: "#ea580c",
      accentDark: "#9a3412",
      soft: "#fff7ed",
      contrastText: "#7c2d12",
      bannerLabel: "Studio Workshop",
      contrastStatus: "pass",
      gradientFrom: "#c2410c",
      gradientTo: "#7c2d12",
      pattern: "diagonal",
      motif: "blueprint",
      fontFamily: "sans",
      heroStyle: "stage",
      cardStyle: "accent-bar"
    })
  },
  {
    id: "data-observatory",
    name: "Data Observatory",
    shortName: "Data Obs.",
    description: "Cyan-to-indigo with circuit motif, a tight grid, split hero, and clean outline cards.",
    bestFor: "Data science, analytics, and quantitative STEM",
    homepageTemplateId: "high-contrast",
    syllabusTemplateId: "standard-university",
    theme: theme({
      id: "vt-data-observatory",
      name: "Data Observatory",
      accent: "#0891b2",
      accentDark: "#0e7490",
      soft: "#ecfeff",
      contrastText: "#083344",
      bannerLabel: "Data Observatory",
      contrastStatus: "pass",
      gradientFrom: "#0e7490",
      gradientTo: "#1e3a8a",
      pattern: "grid",
      motif: "circuit",
      fontFamily: "sans",
      heroStyle: "split",
      cardStyle: "outline"
    })
  },
  {
    id: "civic-forum",
    name: "Civic Forum",
    shortName: "Civic Forum",
    description: "Considered navy-and-indigo serif with a blueprint motif, banner hero, and accent-bar cards.",
    bestFor: "Political science, policy, law, and social sciences",
    homepageTemplateId: "clean-canvas",
    syllabusTemplateId: "accreditation-friendly",
    theme: theme({
      id: "vt-civic-forum",
      name: "Civic Forum",
      accent: "#1d4ed8",
      accentDark: "#1e3a8a",
      soft: "#eef2ff",
      contrastText: "#172554",
      bannerLabel: "Civic Forum",
      contrastStatus: "pass",
      gradientFrom: "#1e3a8a",
      gradientTo: "#3730a3",
      pattern: "none",
      motif: "blueprint",
      fontFamily: "serif",
      heroStyle: "banner",
      cardStyle: "accent-bar"
    })
  },
  {
    id: "clinical-casebook",
    name: "Clinical Casebook",
    shortName: "Clinical",
    description: "Reassuring clinical teal-green with lab motif, a spotlight hero, and soft-filled cards.",
    bestFor: "Nursing, public health, and the health sciences",
    homepageTemplateId: "warm-instructor",
    syllabusTemplateId: "hybrid-course",
    theme: theme({
      id: "vt-clinical-casebook",
      name: "Clinical Casebook",
      accent: "#047857",
      accentDark: "#065f46",
      soft: "#ecfdf5",
      contrastText: "#064e3b",
      bannerLabel: "Clinical Casebook",
      contrastStatus: "pass",
      gradientFrom: "#065f46",
      gradientTo: "#0f766e",
      pattern: "dots",
      motif: "lab",
      fontFamily: "sans",
      heroStyle: "spotlight",
      cardStyle: "soft-fill"
    })
  },
  {
    id: "expedition-map",
    name: "Expedition Map",
    shortName: "Expedition",
    description: "Earthy olive-and-forest serif with botanical motif, a stage hero, and accent-bar cards.",
    bestFor: "Fieldwork, geography, and experiential courses",
    homepageTemplateId: "project-based",
    syllabusTemplateId: "compressed-term",
    theme: theme({
      id: "vt-expedition-map",
      name: "Expedition Map",
      accent: "#4d7c0f",
      accentDark: "#3f6212",
      soft: "#f7fee7",
      contrastText: "#1a2e05",
      bannerLabel: "Expedition Map",
      contrastStatus: "pass",
      gradientFrom: "#3f6212",
      gradientTo: "#166534",
      pattern: "crosshatch",
      motif: "botanical",
      fontFamily: "serif",
      heroStyle: "stage",
      cardStyle: "accent-bar"
    })
  }
];

/** The curated themes behind the templates, registered with getTheme() so generated content resolves them. */
export const visualTemplateThemes: Theme[] = visualTemplates.map((template) => template.theme);

export const getVisualTemplate = (id: string | undefined): VisualTemplate | undefined =>
  id ? visualTemplates.find((template) => template.id === id) : undefined;

/** Match a course's current theme id back to its visual template (for highlighting the active card). */
export const visualTemplateForThemeId = (themeId: string | undefined): VisualTemplate | undefined =>
  themeId ? visualTemplates.find((template) => template.theme.id === themeId) : undefined;
