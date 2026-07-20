import sharp, { type Metadata, type Sharp } from "sharp";
import { extname } from "node:path";
import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import {
  IMAGE_PLACEMENT_SPECS,
  MAX_IMAGE_BYTES,
  defaultImageCrop,
  type ImagePlacementSpec
} from "../../src/services/courseImagery";
import type { CourseImageAsset, CourseImageCrop, CourseImagePlacement } from "../../src/types";

const BUCKET = "course-images";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const isPlacement = (value: unknown): value is CourseImagePlacement =>
  value === "course-card" || value === "homepage-banner" || value === "supporting";

const safeSegment = (value: string): string => value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";

const ownsCourse = async (userId: string, courseId: string): Promise<boolean> => {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("course_projects")
    .select("id")
    .eq("owner_id", userId)
    .eq("app_project_id", courseId)
    .maybeSingle();
  return Boolean(data?.id);
};

const normalizedCrop = (value: unknown): CourseImageCrop => {
  const raw = typeof value === "object" && value ? value as Partial<CourseImageCrop> : {};
  const clamp = (n: unknown, min: number, max: number, fallback: number): number => {
    const parsed = Number(n);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  return {
    ...defaultImageCrop(),
    x: clamp(raw.x, 0, 100, 0),
    y: clamp(raw.y, 0, 100, 0),
    width: clamp(raw.width, 1, 100, 100),
    height: clamp(raw.height, 1, 100, 100),
    zoom: clamp(raw.zoom, 1, 3, 1),
    focalX: clamp(raw.focalX, 0, 100, 50),
    focalY: clamp(raw.focalY, 0, 100, 50)
  };
};

const cropGeometry = (
  width: number,
  height: number,
  spec: ImagePlacementSpec,
  crop: CourseImageCrop
): { left: number; top: number; width: number; height: number } => {
  const targetRatio = spec.outputWidth / spec.outputHeight;
  let cropWidth = Math.min(width, height * targetRatio) / crop.zoom;
  let cropHeight = cropWidth / targetRatio;
  if (cropHeight > height) {
    cropHeight = height / crop.zoom;
    cropWidth = cropHeight * targetRatio;
  }
  cropWidth = Math.max(1, Math.min(width, Math.round(cropWidth)));
  cropHeight = Math.max(1, Math.min(height, Math.round(cropHeight)));
  const centerX = (crop.focalX / 100) * width;
  const centerY = (crop.focalY / 100) * height;
  return {
    left: Math.round(Math.max(0, Math.min(width - cropWidth, centerX - cropWidth / 2))),
    top: Math.round(Math.max(0, Math.min(height - cropHeight, centerY - cropHeight / 2))),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
};

const asClientAsset = (row: Record<string, unknown>, signedPreviewUrl?: string): CourseImageAsset => ({
  id: String(row.id),
  placement: row.placement as CourseImagePlacement,
  source: row.source as "upload" | "ai",
  status: row.status as CourseImageAsset["status"],
  version: Number(row.version),
  fileName: String(row.file_name),
  mimeType: row.mime_type as CourseImageAsset["mimeType"],
  width: Number(row.width),
  height: Number(row.height),
  byteSize: Number(row.byte_size),
  altText: String(row.alt_text ?? ""),
  decorative: Boolean(row.decorative),
  crop: (row.crop_json as CourseImageCrop) ?? defaultImageCrop(),
  storagePath: String(row.storage_path),
  originalStoragePath: row.original_storage_path ? String(row.original_storage_path) : undefined,
  signedPreviewUrl,
  prompt: row.prompt_snapshot ? String(row.prompt_snapshot) : undefined,
  visualDirection: row.visual_direction ? String(row.visual_direction) : undefined,
  provider: row.provider ? String(row.provider) : undefined,
  providerModel: row.provider_model ? String(row.provider_model) : undefined,
  providerRequestId: row.provider_request_id ? String(row.provider_request_id) : undefined,
  idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
  creditCost: row.credit_cost === null || row.credit_cost === undefined ? undefined : Number(row.credit_cost),
  estimatedCostUsd: row.estimated_cost_usd === null || row.estimated_cost_usd === undefined ? undefined : Number(row.estimated_cost_usd),
  createdAt: String(row.created_at),
  archivedAt: row.archived_at ? String(row.archived_at) : undefined
});

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });
  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to manage course images." });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json(400, { error: "Body must be JSON." }); }
  const admin = getSupabaseAdmin();
  const action = String(body.action ?? "");

  if (action === "create-upload") {
    const courseId = String(body.courseId ?? "");
    const fileName = String(body.fileName ?? "");
    const mimeType = String(body.mimeType ?? "");
    const byteSize = Number(body.byteSize);
    if (!courseId || !isPlacement(body.placement)) return json(400, { error: "courseId and a valid placement are required." });
    if (!await ownsCourse(user.id, courseId)) return json(403, { error: "You do not own this course project." });
    if (!ALLOWED.has(mimeType) || !Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
      return json(400, { error: "Use a supported JPG, PNG, GIF, or WebP image no larger than 10 MB." });
    }
    const extension = extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 6) || ".bin";
    const path = `${user.id}/${safeSegment(courseId)}/${crypto.randomUUID()}/original${extension}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return json(500, { error: error?.message ?? "A secure upload could not be created." });
    return json(200, { bucket: BUCKET, path, token: data.token });
  }

  if (action === "process-upload") {
    const courseId = String(body.courseId ?? "");
    const originalPath = String(body.originalPath ?? "");
    if (!courseId || !isPlacement(body.placement) || !originalPath.startsWith(`${user.id}/`)) {
      return json(400, { error: "A valid owned upload is required." });
    }
    if (!await ownsCourse(user.id, courseId)) return json(403, { error: "You do not own this course project." });
    const placement = body.placement;
    const spec = IMAGE_PLACEMENT_SPECS[placement];
    const crop = normalizedCrop(body.crop);
    const { data: original, error: downloadError } = await admin.storage.from(BUCKET).download(originalPath);
    if (downloadError || !original) return json(400, { error: "The uploaded image could not be retrieved." });
    if (original.size > MAX_IMAGE_BYTES) {
      await admin.storage.from(BUCKET).remove([originalPath]);
      return json(400, { error: "Image files must be 10 MB or smaller." });
    }
    const bytes = Buffer.from(await original.arrayBuffer());
    let image: Sharp;
    let metadata: Metadata;
    try {
      image = sharp(bytes, { animated: false, failOn: "error" }).rotate();
      metadata = await image.metadata();
    } catch {
      await admin.storage.from(BUCKET).remove([originalPath]);
      return json(400, { error: "The uploaded file is not a decodable image." });
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height || !["jpeg", "png", "gif", "webp"].includes(metadata.format ?? "")) {
      await admin.storage.from(BUCKET).remove([originalPath]);
      return json(400, { error: "The uploaded file is not a decodable image." });
    }
    const geometry = cropGeometry(width, height, spec, crop);
    const derivative = await image
      .extract(geometry)
      .resize(spec.outputWidth, spec.outputHeight, { fit: "fill" })
      .jpeg({ quality: 88, progressive: true, mozjpeg: true })
      .toBuffer();
    const { data: versionRows } = await admin.from("image_assets").select("version").eq("owner_id", user.id).eq("course_app_id", courseId).eq("placement", placement).order("version", { ascending: false }).limit(1);
    const version = Number(versionRows?.[0]?.version ?? 0) + 1;
    const assetId = crypto.randomUUID();
    const derivativePath = `${user.id}/${safeSegment(courseId)}/${assetId}/${placement}-v${version}.jpg`;
    const { error: storageError } = await admin.storage.from(BUCKET).upload(derivativePath, derivative, { contentType: "image/jpeg", upsert: false });
    if (storageError) return json(500, { error: storageError.message });
    const row = {
      id: assetId,
      owner_id: user.id,
      course_app_id: courseId,
      placement,
      source: "upload",
      status: "ready",
      version,
      file_name: `${safeSegment(courseId)}-${placement}-v${version}.jpg`,
      mime_type: "image/jpeg",
      width: spec.outputWidth,
      height: spec.outputHeight,
      byte_size: derivative.byteLength,
      storage_path: derivativePath,
      original_storage_path: originalPath,
      crop_json: crop,
      alt_text: String(body.altText ?? "").slice(0, 500),
      decorative: Boolean(body.decorative)
    };
    const { data, error } = await admin.from("image_assets").insert(row).select("*").single();
    if (error || !data) {
      await admin.storage.from(BUCKET).remove([derivativePath]);
      return json(500, { error: error?.message ?? "Image metadata could not be saved." });
    }
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(derivativePath, 3600);
    return json(200, { asset: asClientAsset(data as Record<string, unknown>, signed?.signedUrl) });
  }

  if (action === "download") {
    const assetId = String(body.assetId ?? "");
    const { data: asset } = await admin.from("image_assets").select("storage_path,file_name").eq("id", assetId).eq("owner_id", user.id).maybeSingle();
    if (!asset) return json(404, { error: "Image not found." });
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(String(asset.storage_path), 60, { download: String(asset.file_name) });
    if (error || !data) return json(500, { error: error?.message ?? "A download link could not be created." });
    return json(200, { url: data.signedUrl, expiresIn: 60 });
  }

  return json(400, { error: "Unknown image-assets action." });
};
