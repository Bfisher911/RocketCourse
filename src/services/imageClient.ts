import type { CourseImageAsset, CourseImagePlacement } from "../types";
import type { ImageGenerationSet, ImageGenerationTarget, ImageQuality } from "./courseImagery";
import { callFunction } from "./platformClient";

export interface ImageBalance {
  planName: string;
  included: number;
  granted: number;
  used: number;
  reserved: number;
  remaining: number;
  renewsAt: string | null;
  premium: boolean;
  creditPackCredits: number;
  creditPackCents: number;
}

export interface GenerateCourseImagesInput {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseContext?: string;
  set: ImageGenerationSet;
  placements: CourseImagePlacement[];
  targets?: ImageGenerationTarget[];
  quality: ImageQuality;
  visualDirection: string;
  idempotencyKey: string;
}

export const loadImageBalance = (): Promise<ImageBalance> =>
  callFunction<ImageBalance>("image-generate", { action: "balance" });

export const loadCourseImageAssets = (courseId: string): Promise<{ assets: CourseImageAsset[] }> =>
  callFunction("image-assets", { action: "list", courseId });

export const generateCourseImages = (
  input: GenerateCourseImagesInput
): Promise<{ assets: CourseImageAsset[]; balance: ImageBalance; requestId: string }> =>
  callFunction("image-generate", { action: "generate", ...input });

export const requestImageUpload = (
  courseId: string,
  placement: CourseImagePlacement,
  fileName: string,
  mimeType: string,
  byteSize: number,
  target?: Pick<ImageGenerationTarget, "contentObjectId" | "contentObjectType" | "contentObjectTitle">
): Promise<{ bucket: string; path: string; token: string }> =>
  callFunction("image-assets", { action: "create-upload", courseId, placement, fileName, mimeType, byteSize, ...target });

export const finalizeImageUpload = (input: {
  courseId: string;
  placement: CourseImagePlacement;
  originalPath: string;
  crop: CourseImageAsset["crop"];
  altText: string;
  decorative: boolean;
  contentObjectId?: string;
  contentObjectType?: ImageGenerationTarget["contentObjectType"];
  contentObjectTitle?: string;
  rightsAcknowledged?: boolean;
}): Promise<{ asset: CourseImageAsset }> => callFunction("image-assets", { action: "process-upload", ...input });

export const updateImageAsset = (assetId: string, patch: Pick<CourseImageAsset, "altText" | "decorative">): Promise<{ asset: CourseImageAsset }> =>
  callFunction("image-assets", { action: "update", assetId, ...patch });

export const archiveImageTarget = (courseId: string, placement: CourseImagePlacement, contentObjectId?: string): Promise<{ ok: boolean }> =>
  callFunction("image-assets", { action: "archive-target", courseId, placement, contentObjectId });

export const restoreImageAsset = (assetId: string): Promise<{ asset: CourseImageAsset }> =>
  callFunction("image-assets", { action: "restore", assetId });

export const requestImageDownloadUrl = (assetId: string): Promise<{ url: string; expiresIn: number }> =>
  callFunction("image-assets", { action: "download", assetId });
