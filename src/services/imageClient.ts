import type { CourseImageAsset, CourseImagePlacement } from "../types";
import type { ImageGenerationSet, ImageQuality } from "./courseImagery";
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
}

export interface GenerateCourseImagesInput {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  set: ImageGenerationSet;
  placements: CourseImagePlacement[];
  quality: ImageQuality;
  visualDirection: string;
  idempotencyKey: string;
}

export const loadImageBalance = (): Promise<ImageBalance> =>
  callFunction<ImageBalance>("image-generate", { action: "balance" });

export const generateCourseImages = (
  input: GenerateCourseImagesInput
): Promise<{ assets: CourseImageAsset[]; balance: ImageBalance; requestId: string }> =>
  callFunction("image-generate", { action: "generate", ...input });

export const requestImageUpload = (
  courseId: string,
  placement: CourseImagePlacement,
  fileName: string,
  mimeType: string,
  byteSize: number
): Promise<{ bucket: string; path: string; token: string }> =>
  callFunction("image-assets", { action: "create-upload", courseId, placement, fileName, mimeType, byteSize });

export const finalizeImageUpload = (input: {
  courseId: string;
  placement: CourseImagePlacement;
  originalPath: string;
  crop: CourseImageAsset["crop"];
  altText: string;
  decorative: boolean;
}): Promise<{ asset: CourseImageAsset }> => callFunction("image-assets", { action: "process-upload", ...input });

export const requestImageDownloadUrl = (assetId: string): Promise<{ url: string; expiresIn: number }> =>
  callFunction("image-assets", { action: "download", assetId });
