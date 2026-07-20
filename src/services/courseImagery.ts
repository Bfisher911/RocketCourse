import type {
  CourseImageAsset,
  CourseImageCrop,
  CourseImagePlacement,
  CourseProject
} from "../types";
import { escapeXml, slugify } from "../utils/text";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ImagePlacementSpec {
  placement: CourseImagePlacement;
  label: string;
  purpose: string;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  canvasDisplay?: string;
  acceptedTypes: CourseImageAsset["mimeType"][];
  packagePath: string;
}

export const IMAGE_PLACEMENT_SPECS: Record<CourseImagePlacement, ImagePlacementSpec> = {
  "course-card": {
    placement: "course-card",
    label: "Canvas course card",
    purpose: "The dashboard image students use to recognize the course.",
    aspectRatio: 1048 / 584,
    outputWidth: 1048,
    outputHeight: 584,
    recommendedWidth: 1048,
    recommendedHeight: 584,
    canvasDisplay: "Canvas commonly displays this around 262 × 146 px.",
    acceptedTypes: ["image/jpeg", "image/png", "image/gif"],
    packagePath: "web_resources/course-card.jpg"
  },
  "homepage-banner": {
    placement: "homepage-banner",
    label: "Homepage banner",
    purpose: "A responsive visual anchor at the top of the course homepage.",
    aspectRatio: 3,
    outputWidth: 1200,
    outputHeight: 400,
    recommendedWidth: 1200,
    recommendedHeight: 400,
    acceptedTypes: ["image/jpeg", "image/png"],
    packagePath: "web_resources/homepage-banner.jpg"
  },
  supporting: {
    placement: "supporting",
    label: "Supporting course image",
    purpose: "A reusable image for module pages and instructional content.",
    aspectRatio: 16 / 9,
    outputWidth: 1200,
    outputHeight: 675,
    recommendedWidth: 1200,
    recommendedHeight: 675,
    acceptedTypes: ["image/jpeg", "image/png"],
    packagePath: "web_resources/supporting-image.jpg"
  }
};

export type ImageQuality = "medium" | "high";
export type ImageGenerationSet = "essential" | "expanded" | "custom";

export const IMAGE_CREDIT_COST: Record<ImageQuality, number> = { medium: 1, high: 4 };
export const IMAGE_SET_PLACEMENTS: Record<ImageGenerationSet, CourseImagePlacement[]> = {
  essential: ["course-card", "homepage-banner"],
  expanded: ["course-card", "homepage-banner", "supporting"],
  custom: []
};

export const imageSetCreditCost = (
  set: ImageGenerationSet,
  quality: ImageQuality,
  customPlacements: CourseImagePlacement[] = []
): number => (set === "custom" ? customPlacements.length : IMAGE_SET_PLACEMENTS[set].length) * IMAGE_CREDIT_COST[quality];

export const defaultImageCrop = (): CourseImageCrop => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  zoom: 1,
  focalX: 50,
  focalY: 50
});

export interface ImageValidationInput {
  name: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  signature?: Uint8Array;
}

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detectedMimeType: CourseImageAsset["mimeType"] | null;
}

export const detectImageMimeType = (bytes?: Uint8Array): CourseImageAsset["mimeType"] | null => {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a" || String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a") return "image/gif";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
};

export const validateImageUpload = (
  input: ImageValidationInput,
  placement: CourseImagePlacement
): ImageValidationResult => {
  const spec = IMAGE_PLACEMENT_SPECS[placement];
  const errors: string[] = [];
  const warnings: string[] = [];
  const detected = detectImageMimeType(input.signature);
  if (input.byteSize <= 0) errors.push("Choose a non-empty image file.");
  if (input.byteSize > MAX_IMAGE_BYTES) errors.push("Image files must be 10 MB or smaller.");
  if (!spec.acceptedTypes.includes(input.mimeType as CourseImageAsset["mimeType"])) {
    errors.push(`${spec.label} accepts ${spec.acceptedTypes.map((type) => type.replace("image/", "").toUpperCase()).join(", ")}.`);
  }
  if (input.signature && !detected) errors.push("The file contents are not a supported image.");
  if (detected && detected !== input.mimeType) errors.push("The file contents do not match its declared image type.");
  if (input.width && input.height) {
    if (input.width < spec.recommendedWidth || input.height < spec.recommendedHeight) {
      warnings.push(`For a crisp result, use at least ${spec.recommendedWidth} × ${spec.recommendedHeight} px.`);
    }
    const ratio = input.width / input.height;
    if (Math.abs(ratio - spec.aspectRatio) / spec.aspectRatio > 0.08) {
      warnings.push(`This image will be cropped to ${spec.outputWidth}:${spec.outputHeight}. Keep important content near the center.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings, detectedMimeType: detected };
};

export const activeImageForPlacement = (
  course: Pick<CourseProject, "imageAssets">,
  placement: CourseImagePlacement
): CourseImageAsset | null =>
  [...(course.imageAssets ?? [])]
    .filter((asset) => asset.placement === placement && asset.status === "ready" && !asset.archivedAt)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0] ?? null;

export const nextImageVersion = (
  assets: CourseImageAsset[] | undefined,
  placement: CourseImagePlacement
): number => Math.max(0, ...(assets ?? []).filter((asset) => asset.placement === placement).map((asset) => asset.version)) + 1;

export const packagePathForImage = (asset: CourseImageAsset): string => {
  const base = IMAGE_PLACEMENT_SPECS[asset.placement].packagePath.replace(/\.[^.]+$/, "");
  const ext = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/gif" ? "gif" : "jpg";
  return `${base}-${asset.id.slice(0, 8)}.${ext}`;
};

export const safeImageDownloadName = (courseTitle: string, asset: CourseImageAsset): string => {
  const ext = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/gif" ? "gif" : "jpg";
  return `${slugify(courseTitle) || "course"}-${asset.placement}-v${asset.version}.${ext}`;
};

export const imageAltAttribute = (asset: CourseImageAsset): string =>
  asset.decorative ? 'alt="" role="presentation"' : `alt="${escapeXml(asset.altText.trim())}"`;

export const responsiveCourseImageHtml = (asset: CourseImageAsset, className = "rc-course-image"): string =>
  `<img src="../${packagePathForImage(asset)}" ${imageAltAttribute(asset)} class="${escapeXml(className)}" style="display:block;width:100%;height:auto;object-fit:cover;" loading="lazy" />`;

export interface ImageReadiness {
  score: number;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
}

export const imageReadiness = (course: Pick<CourseProject, "imageAssets">): ImageReadiness => {
  const card = activeImageForPlacement(course, "course-card");
  const banner = activeImageForPlacement(course, "homepage-banner");
  const active = [card, banner].filter(Boolean) as CourseImageAsset[];
  const accessible = active.every((asset) => asset.decorative || asset.altText.trim().length > 0);
  const checks = [
    { label: "Course card image", passed: Boolean(card), detail: card ? "Export-ready derivative selected." : "Add an image or keep the generated theme tile." },
    { label: "Homepage banner", passed: Boolean(banner), detail: banner ? "Responsive banner is ready." : "Add a banner or keep the generated theme banner." },
    { label: "Alternative text", passed: accessible, detail: accessible ? "Every active image has an accessibility decision." : "Add alt text or mark the image decorative." }
  ];
  return { score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100), checks };
};

export const buildImagePrompt = (
  course: Pick<CourseProject, "title" | "description">,
  placement: CourseImagePlacement,
  direction: string
): string => {
  const spec = IMAGE_PLACEMENT_SPECS[placement];
  return [
    `Create a polished, inclusive higher-education course image for “${course.title}”.`,
    course.description ? `Course context: ${course.description}` : "",
    `Placement: ${spec.label}; compose for ${spec.outputWidth}:${spec.outputHeight} (${spec.aspectRatio.toFixed(2)}:1).`,
    "Keep the focal subject inside the central safe area. Do not include words, letters, logos, UI, watermarks, or identifiable students.",
    "Use an editorial, credible, contemporary visual style with sufficient tonal separation for responsive crops.",
    direction.trim() ? `Visual direction: ${direction.trim()}` : "Visual direction: grounded, optimistic, and discipline-appropriate."
  ].filter(Boolean).join("\n");
};

export const decodeImageDataUrl = (value?: string): { mimeType: string; base64: string } | null => {
  if (!value) return null;
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([a-z0-9+/=\s]+)$/i.exec(value);
  return match ? { mimeType: match[1].toLowerCase(), base64: match[2].replace(/\s/g, "") } : null;
};
