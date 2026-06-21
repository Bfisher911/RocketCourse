import type { Theme } from "../types";

export const themes: Theme[] = [
  {
    id: "clean-academic",
    name: "Clean Academic",
    accent: "#276ef1",
    accentDark: "#174ea6",
    soft: "#eaf1ff",
    contrastText: "#0f172a",
    bannerLabel: "Structured clarity"
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    accent: "#0f766e",
    accentDark: "#115e59",
    soft: "#e6fffb",
    contrastText: "#111827",
    bannerLabel: "Quiet precision"
  },
  {
    id: "bold-university",
    name: "Bold University",
    accent: "#a5402d",
    accentDark: "#7f1d1d",
    soft: "#fff1ed",
    contrastText: "#111827",
    bannerLabel: "Academic energy"
  },
  {
    id: "calm-blue",
    name: "Calm Blue",
    accent: "#2563eb",
    accentDark: "#1e40af",
    soft: "#eff6ff",
    contrastText: "#0f172a",
    bannerLabel: "Steady guidance"
  },
  {
    id: "purple-innovation",
    name: "Purple Innovation",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    soft: "#f3e8ff",
    contrastText: "#111827",
    bannerLabel: "Creative inquiry"
  },
  {
    id: "green-growth",
    name: "Green Growth",
    accent: "#15803d",
    accentDark: "#166534",
    soft: "#ecfdf3",
    contrastText: "#0f172a",
    bannerLabel: "Applied progress"
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    accent: "#111827",
    accentDark: "#000000",
    soft: "#f3f4f6",
    contrastText: "#020617",
    bannerLabel: "Accessible focus"
  }
];

export const getTheme = (themeId: string): Theme =>
  themes.find((theme) => theme.id === themeId) ?? themes[0];
