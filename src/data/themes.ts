import type { Theme } from "../types";

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
  }
];

export const getTheme = (themeId: string): Theme =>
  themes.find((theme) => theme.id === themeId) ?? themes[0];
