import type { CourseProject, FileAsset, Theme } from "../types";
import { escapeXml } from "../utils/text";
import { getThemeStyles } from "./themeDesign";

export type VisualCourseAssetKind =
  | "week-badge"
  | "assignment-icon"
  | "discussion-icon"
  | "quiz-icon"
  | "project-milestone-badge"
  | "completion-badge"
  | "decorative-divider"
  | "course-identity-badge";

export interface VisualCourseAssetDefinition {
  kind: VisualCourseAssetKind;
  path: string;
  title: string;
  description: string;
  label: string;
  moduleNumber?: number;
}

export const visualCourseAssetDefinitions = (courseTitle: string, moduleCount: number): VisualCourseAssetDefinition[] => {
  const weeks = Array.from({ length: Math.max(1, moduleCount) }, (_, index) => {
    const moduleNumber = index + 1;
    return {
      kind: "week-badge" as const,
      path: `web_resources/week-${moduleNumber}-badge.svg`,
      title: `Week ${moduleNumber} badge`,
      description: `Themed visual badge for module or week ${moduleNumber}.`,
      label: `W${moduleNumber}`,
      moduleNumber
    };
  });

  return [
    {
      kind: "course-identity-badge",
      path: "web_resources/course-identity-badge.svg",
      title: "Course identity badge",
      description: `Small themed identity badge for ${courseTitle}.`,
      label: "COURSE"
    },
    ...weeks,
    {
      kind: "assignment-icon",
      path: "web_resources/assignment-type-icon.svg",
      title: "Assignment type icon",
      description: "Themed icon for assignment launch pads.",
      label: "TASK"
    },
    {
      kind: "discussion-icon",
      path: "web_resources/discussion-icon.svg",
      title: "Discussion icon",
      description: "Themed icon for discussion prompts.",
      label: "TALK"
    },
    {
      kind: "quiz-icon",
      path: "web_resources/quiz-icon.svg",
      title: "Quiz icon",
      description: "Themed icon for quiz support content.",
      label: "QUIZ"
    },
    {
      kind: "project-milestone-badge",
      path: "web_resources/project-milestone-badge.svg",
      title: "Project milestone badge",
      description: "Themed badge for project milestones and checkpoints.",
      label: "MILE"
    },
    {
      kind: "completion-badge",
      path: "web_resources/completion-badge.svg",
      title: "Completion badge",
      description: "Themed badge for course or module completion.",
      label: "DONE"
    },
    {
      kind: "decorative-divider",
      path: "web_resources/canvas-safe-divider.svg",
      title: "Canvas-safe divider",
      description: "Lightweight SVG divider for exported Canvas pages.",
      label: "DIVIDER"
    }
  ];
};

export const visualCourseFileAssets = (
  courseTitle: string,
  moduleCount: number,
  timestamp: string
): FileAsset[] =>
  visualCourseAssetDefinitions(courseTitle, moduleCount).map((asset) => ({
    id: `asset_${asset.path.replace(/^web_resources\//, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}`,
    path: asset.path,
    fileName: asset.path.split("/").pop() ?? asset.path,
    title: asset.title,
    mimeType: "image/svg+xml",
    description: asset.description,
    usage: "other",
    publishState: "published",
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      exportVersion: 0,
      source: "generated"
    }
  }));

const assetName = (path: string): string => path.replace(/^web_resources\//, "");

const resolveDefinition = (course: CourseProject, path: string): VisualCourseAssetDefinition | undefined =>
  visualCourseAssetDefinitions(course.title, course.settings.moduleCount).find((asset) => assetName(asset.path) === assetName(path));

const svgShell = (theme: Theme, title: string, desc: string, body: string, width = 320, height = 180): string => {
  const styles = getThemeStyles(theme);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(styles.gradientFrom)}"/>
      <stop offset="1" stop-color="${escapeXml(styles.gradientTo)}"/>
    </linearGradient>
  </defs>
  ${body}
</svg>`;
};

const badgeSvg = (theme: Theme, asset: VisualCourseAssetDefinition, courseTitle: string): string => {
  const styles = getThemeStyles(theme);
  const label = asset.kind === "week-badge" && asset.moduleNumber ? `W${asset.moduleNumber}` : asset.label;
  return svgShell(
    theme,
    asset.title,
    `${asset.title} for ${courseTitle}.`,
    `<rect x="8" y="8" width="304" height="164" rx="32" fill="url(#g)"/>
  <circle cx="260" cy="52" r="72" fill="#ffffff" opacity="0.12"/>
  <circle cx="60" cy="150" r="48" fill="#ffffff" opacity="0.10"/>
  <rect x="28" y="28" width="264" height="124" rx="24" fill="#ffffff" opacity="0.14" stroke="#ffffff" stroke-opacity="0.28"/>
  <text x="160" y="94" text-anchor="middle" font-family="${styles.font}" font-size="${label.length > 3 ? 42 : 54}" font-weight="900" fill="${styles.onGradient}">${escapeXml(label)}</text>
  <text x="160" y="124" text-anchor="middle" font-family="${styles.font}" font-size="16" font-weight="700" fill="${styles.onGradient}" opacity="0.88">${escapeXml(theme.bannerLabel)}</text>`,
    320,
    180
  );
};

const iconSvg = (theme: Theme, asset: VisualCourseAssetDefinition, courseTitle: string): string => {
  const styles = getThemeStyles(theme);
  const iconPath: Record<VisualCourseAssetKind, string> = {
    "assignment-icon": "M88 56h144v168H88z M116 94h88 M116 128h88 M116 162h56",
    "discussion-icon": "M70 82h180v96H130l-42 42v-42H70z M108 116h104 M108 146h74",
    "quiz-icon": "M98 58h124v164H98z M126 100h68 M126 132h68 M126 164h48 M210 72l38 38",
    "project-milestone-badge": "M160 50l34 69h76l-61 45 23 72-72-44-72 44 23-72-61-45h76z",
    "completion-badge": "M82 152l46 46 110-116",
    "course-identity-badge": "M160 50l90 42v72c0 54-38 90-90 110-52-20-90-56-90-110V92z",
    "decorative-divider": "M34 90h252 M86 90c28-38 120-38 148 0 M86 90c28 38 120 38 148 0",
    "week-badge": "M160 50l90 42v72c0 54-38 90-90 110-52-20-90-56-90-110V92z"
  };
  return svgShell(
    theme,
    asset.title,
    `${asset.title} for ${courseTitle}.`,
    `<rect width="320" height="240" rx="40" fill="${escapeXml(styles.soft)}"/>
  <circle cx="260" cy="56" r="86" fill="${escapeXml(styles.accent)}" opacity="0.12"/>
  <circle cx="48" cy="208" r="74" fill="${escapeXml(styles.accentDark)}" opacity="0.09"/>
  <path d="${iconPath[asset.kind]}" fill="none" stroke="${escapeXml(styles.accentDark)}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="160" y="220" text-anchor="middle" font-family="${styles.font}" font-size="24" font-weight="900" fill="${escapeXml(styles.accentDark)}">${escapeXml(asset.label)}</text>`,
    320,
    240
  );
};

const dividerSvg = (theme: Theme, courseTitle: string): string => {
  const styles = getThemeStyles(theme);
  return svgShell(
    theme,
    "Canvas-safe decorative divider",
    `Decorative divider for ${courseTitle}.`,
    `<rect width="960" height="96" fill="#ffffff"/>
  <path d="M40 48H920" stroke="${escapeXml(styles.accent)}" stroke-width="4" stroke-linecap="round" opacity="0.36"/>
  <circle cx="480" cy="48" r="18" fill="${escapeXml(styles.accentDark)}" opacity="0.92"/>
  <circle cx="430" cy="48" r="7" fill="${escapeXml(styles.accent)}" opacity="0.55"/>
  <circle cx="530" cy="48" r="7" fill="${escapeXml(styles.accent)}" opacity="0.55"/>
  <path d="M460 48h40" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`,
    960,
    96
  );
};

export const buildVisualCourseAssetSvg = (course: CourseProject, path: string): string | null => {
  const asset = resolveDefinition(course, path);
  if (!asset) return null;
  if (asset.kind === "decorative-divider") return dividerSvg(course.theme, course.title);
  if (asset.kind === "week-badge") return badgeSvg(course.theme, asset, course.title);
  return iconSvg(course.theme, asset, course.title);
};
