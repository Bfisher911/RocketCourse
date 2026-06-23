import type { Theme } from "../types";
import { visualTemplateThemes } from "./visualTemplates";

export const themes: Theme[] = [
  {
    id: "clean-canvas",
    name: "Clean Canvas",
    accent: "#276ef1",
    accentDark: "#174ea6",
    soft: "#eaf1ff",
    contrastText: "#0f172a",
    bannerLabel: "Structured clarity",
    contrastStatus: "pass"
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    accent: "#0f766e",
    accentDark: "#115e59",
    soft: "#e6fffb",
    contrastText: "#111827",
    bannerLabel: "Quiet precision",
    contrastStatus: "pass"
  },
  {
    id: "bold-university",
    name: "Bold University",
    accent: "#9f1239",
    accentDark: "#7f1d1d",
    soft: "#fff1f2",
    contrastText: "#111827",
    bannerLabel: "Academic energy",
    contrastStatus: "pass"
  },
  {
    id: "warm-seminar",
    name: "Warm Seminar",
    accent: "#b45309",
    accentDark: "#92400e",
    soft: "#fff7ed",
    contrastText: "#111827",
    bannerLabel: "Discussion warmth",
    contrastStatus: "pass"
  },
  {
    id: "calm-blue",
    name: "Calm Blue",
    accent: "#2563eb",
    accentDark: "#1e40af",
    soft: "#eff6ff",
    contrastText: "#0f172a",
    bannerLabel: "Steady guidance",
    contrastStatus: "pass"
  },
  {
    id: "purple-innovation",
    name: "Purple Innovation",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    soft: "#f3e8ff",
    contrastText: "#111827",
    bannerLabel: "Creative inquiry",
    contrastStatus: "pass"
  },
  {
    id: "green-growth",
    name: "Green Growth",
    accent: "#15803d",
    accentDark: "#166534",
    soft: "#ecfdf3",
    contrastText: "#0f172a",
    bannerLabel: "Applied progress",
    contrastStatus: "pass"
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    accent: "#111827",
    accentDark: "#000000",
    soft: "#f3f4f6",
    contrastText: "#020617",
    bannerLabel: "Accessible focus",
    contrastStatus: "pass"
  },
  {
    id: "stem-lab",
    name: "STEM Lab",
    accent: "#0369a1",
    accentDark: "#075985",
    soft: "#e0f2fe",
    contrastText: "#0f172a",
    bannerLabel: "Evidence and inquiry",
    contrastStatus: "pass"
  },
  {
    id: "healthcare-professional",
    name: "Healthcare Professional",
    accent: "#047857",
    accentDark: "#065f46",
    soft: "#ecfdf5",
    contrastText: "#10231d",
    bannerLabel: "Clinical clarity",
    contrastStatus: "pass"
  },
  {
    id: "humanities-studio",
    name: "Humanities Studio",
    accent: "#6d28d9",
    accentDark: "#4c1d95",
    soft: "#f5f3ff",
    contrastText: "#111827",
    bannerLabel: "Interpretive craft",
    contrastStatus: "pass"
  },
  {
    id: "executive-program",
    name: "Executive Program",
    accent: "#334155",
    accentDark: "#1e293b",
    soft: "#f1f5f9",
    contrastText: "#0f172a",
    bannerLabel: "Strategic focus",
    contrastStatus: "pass"
  },
  // Gradient + pattern themes. The vivid colors live in `accent` (buttons); the gradient stops stay
  // dark enough that white hero text clears WCAG large-text contrast at both ends.
  {
    id: "aurora",
    name: "Aurora",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    soft: "#f3e8ff",
    contrastText: "#2e1065",
    bannerLabel: "Aurora gradient",
    contrastStatus: "pass",
    gradientFrom: "#6d28d9",
    gradientTo: "#4338ca",
    pattern: "dots"
  },
  {
    id: "sunrise-scholar",
    name: "Sunrise Scholar",
    accent: "#ea580c",
    accentDark: "#9a3412",
    soft: "#fff7ed",
    contrastText: "#7c2d12",
    bannerLabel: "Warm momentum",
    contrastStatus: "pass",
    gradientFrom: "#c2410c",
    gradientTo: "#9a3412",
    pattern: "diagonal"
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    accent: "#0891b2",
    accentDark: "#155e75",
    soft: "#ecfeff",
    contrastText: "#083344",
    bannerLabel: "Calm depth",
    contrastStatus: "pass",
    gradientFrom: "#0f172a",
    gradientTo: "#0e7490",
    pattern: "grid"
  },
  {
    id: "forest-path",
    name: "Forest Path",
    accent: "#15803d",
    accentDark: "#14532d",
    soft: "#f0fdf4",
    contrastText: "#14532d",
    bannerLabel: "Grounded growth",
    contrastStatus: "pass",
    gradientFrom: "#166534",
    gradientTo: "#15803d",
    pattern: "crosshatch"
  },
  {
    id: "royal-press",
    name: "Royal Press",
    accent: "#9333ea",
    accentDark: "#6b21a8",
    soft: "#faf5ff",
    contrastText: "#3b0764",
    bannerLabel: "Editorial depth",
    contrastStatus: "pass",
    gradientFrom: "#6b21a8",
    gradientTo: "#a21caf",
    pattern: "diagonal"
  },
  {
    id: "graphite-pro",
    name: "Graphite Pro",
    accent: "#0ea5e9",
    accentDark: "#0369a1",
    soft: "#f1f5f9",
    contrastText: "#0f172a",
    bannerLabel: "Minimal precision",
    contrastStatus: "pass",
    gradientFrom: "#1e293b",
    gradientTo: "#334155",
    pattern: "grid"
  },
  // Motif themes — visual identity beyond color. Colors mirror an existing contrast-validated theme
  // so every check still passes; the `motif` adds a recognizable illustrated banner (stars, circuits,
  // lab glassware, leaves, blueprint lines, waves).
  {
    id: "cosmic",
    name: "Cosmic",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    soft: "#f3e8ff",
    contrastText: "#2e1065",
    bannerLabel: "Cosmic explorer",
    contrastStatus: "pass",
    gradientFrom: "#1e1b4b",
    gradientTo: "#4c1d95",
    pattern: "dots",
    motif: "cosmic"
  },
  {
    id: "circuit",
    name: "Circuit Board",
    accent: "#0891b2",
    accentDark: "#155e75",
    soft: "#ecfeff",
    contrastText: "#083344",
    bannerLabel: "Systems & signals",
    contrastStatus: "pass",
    gradientFrom: "#0b1220",
    gradientTo: "#0e7490",
    pattern: "grid",
    motif: "circuit"
  },
  {
    id: "science-lab",
    name: "Science Lab",
    accent: "#047857",
    accentDark: "#065f46",
    soft: "#ecfdf5",
    contrastText: "#10231d",
    bannerLabel: "Lab & inquiry",
    contrastStatus: "pass",
    gradientFrom: "#064e3b",
    gradientTo: "#047857",
    pattern: "dots",
    motif: "lab"
  },
  {
    id: "botanical",
    name: "Botanical",
    accent: "#15803d",
    accentDark: "#14532d",
    soft: "#f0fdf4",
    contrastText: "#14532d",
    bannerLabel: "Roots & growth",
    contrastStatus: "pass",
    gradientFrom: "#14532d",
    gradientTo: "#3f6212",
    pattern: "crosshatch",
    motif: "botanical"
  },
  {
    id: "blueprint",
    name: "Blueprint",
    accent: "#0ea5e9",
    accentDark: "#0369a1",
    soft: "#f0f9ff",
    contrastText: "#0f172a",
    bannerLabel: "Design & structure",
    contrastStatus: "pass",
    gradientFrom: "#0c1f3a",
    gradientTo: "#14406b",
    pattern: "grid",
    motif: "blueprint"
  },
  {
    id: "deep-current",
    name: "Deep Current",
    accent: "#2563eb",
    accentDark: "#1e40af",
    soft: "#eff6ff",
    contrastText: "#0f172a",
    bannerLabel: "Currents & depth",
    contrastStatus: "pass",
    gradientFrom: "#0c2a52",
    gradientTo: "#1e40af",
    pattern: "diagonal",
    motif: "wave"
  }
];

// Resolve any theme id — the displayed color themes OR a visual-template's curated theme — so
// generated content always renders with the right palette. Falls back to the default theme.
export const getTheme = (themeId: string): Theme =>
  themes.find((theme) => theme.id === themeId) ?? visualTemplateThemes.find((theme) => theme.id === themeId) ?? themes[0];
