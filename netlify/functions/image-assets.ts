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
import type { CourseImageAsset, CourseImageContentType, CourseImageCrop, CourseImagePlacement } from "../../src/types";

const BUCKET = "course-images";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const isPlacement = (value: unknown): value is CourseImagePlacement =>
  value === "course-card" || value === "homepage-banner" || value === "supporting";
const isContentType = (value: unknown): value is CourseImageContentType =>
  value === "module" || value === "page" || value === "assignment" || value === "discussion" || value === "quiz";

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
  contentObjectId: row.content_object_id ? String(row.content_object_id) : undefined,
  contentObjectType: isContentType(row.content_object_type) ? row.content_object_type : undefined,
  contentObjectTitle: row.content_object_title ? String(row.content_object_title) : undefined,
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
  rightsAcknowledgedAt: row.rights_acknowledged_at ? String(row.rights_acknowledged_at) : undefined,
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

  if (action === "list") {
    const courseId = String(body.courseId ?? "");
    if (!courseId || !await ownsCourse(user.id, courseId)) return json(403, { error: "Course images are unavailable." });
    const { data, error } = await admin.from("image_assets").select("*")
      .eq("owner_id", user.id).eq("course_app_id", courseId).order("created_at");
    if (error) return json(500, { error: error.message });
    const assets = await Promise.all((data ?? []).map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 3600);
      return asClientAsset(row as Record<string, unknown>, signed?.signedUrl);
    }));
    return json(200, { assets });
  }

  if (action === "create-upload") {
    const courseId = String(body.courseId ?? "");
    const fileName = String(body.fileName ?? "");
    const mimeType = String(body.mimeType ?? "");
    const byteSize = Number(body.byteSize);
    if (!courseId || !isPlacement(body.placement)) return json(400, { error: "courseId and a valid placement are required." });
    if (!await ownsCourse(user.id, courseId)) return json(403, { error: "You do not own this course project." });
    const spec = IMAGE_PLACEMENT_SPECS[body.placement];
    if (!ALLOWED.has(mimeType) || !spec.acceptedTypes.includes(mimeType as CourseImageAsset["mimeType"]) || !Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
      return json(400, { error: "Use a supported JPG, PNG, GIF, or WebP image no larger than 10 MB." });
    }
    if (body.placement === "supporting" && (!String(body.contentObjectId ?? "") || !isContentType(body.contentObjectType))) {
      return json(400, { error: "Choose the course item that should receive this supporting image." });
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
    if (!Boolean(body.rightsAcknowledged)) return json(400, { error: "Confirm that you have permission to use this image." });
    const contentObjectId = placement === "supporting" ? String(body.contentObjectId ?? "") : null;
    const contentObjectType = placement === "supporting" && isContentType(body.contentObjectType) ? body.contentObjectType : null;
    const contentObjectTitle = placement === "supporting" ? String(body.contentObjectTitle ?? "").trim().slice(0, 300) : null;
    if (placement === "supporting" && (!contentObjectId || !contentObjectType)) {
      return json(400, { error: "Choose the course item that should receive this supporting image." });
    }
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
    const detectedMime = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
    if (!spec.acceptedTypes.includes(detectedMime as CourseImageAsset["mimeType"])) {
      await admin.storage.from(BUCKET).remove([originalPath]);
      return json(400, { error: `${spec.label} does not support this image format.` });
    }
    if ((metadata.pages ?? 1) > 1) {
      await admin.storage.from(BUCKET).remove([originalPath]);
      return json(400, { error: "Animated images are not supported. Upload a still JPG, PNG, or GIF frame." });
    }
    const geometry = cropGeometry(width, height, spec, crop);
    const derivative = await image
      .extract(geometry)
      .resize(spec.outputWidth, spec.outputHeight, { fit: "fill" })
      .jpeg({ quality: 88, progressive: true, mozjpeg: true })
      .toBuffer();
    let versionQuery = admin.from("image_assets").select("version").eq("owner_id", user.id).eq("course_app_id", courseId).eq("placement", placement);
    versionQuery = contentObjectId ? versionQuery.eq("content_object_id", contentObjectId) : versionQuery.is("content_object_id", null);
    const { data: versionRows } = await versionQuery.order("version", { ascending: false }).limit(1);
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
      content_object_id: contentObjectId,
      content_object_type: contentObjectType,
      content_object_title: contentObjectTitle,
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
      decorative: Boolean(body.decorative),
      rights_acknowledged_at: new Date().toISOString()
    };
    const { data, error } = await admin.from("image_assets").insert(row).select("*").single();
    if (error || !data) {
      await admin.storage.from(BUCKET).remove([derivativePath]);
      return json(500, { error: error?.message ?? "Image metadata could not be saved." });
    }
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(derivativePath, 3600);
    return json(200, { asset: asClientAsset(data as Record<string, unknown>, signed?.signedUrl) });
  }

  if (action === "update") {
    const assetId = String(body.assetId ?? "");
    const decorative = Boolean(body.decorative);
    const altText = decorative ? "" : String(body.altText ?? "").trim().slice(0, 500);
    const { data, error } = await admin.from("image_assets")
      .update({ alt_text: altText, decorative })
      .eq("id", assetId).eq("owner_id", user.id).select("*").maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "Image not found." });
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(data.storage_path), 3600);
    return json(200, { asset: asClientAsset(data as Record<string, unknown>, signed?.signedUrl) });
  }

  if (action === "archive-target") {
    const courseId = String(body.courseId ?? "");
    if (!courseId || !isPlacement(body.placement) || !await ownsCourse(user.id, courseId)) return json(403, { error: "Course image target not found." });
    let archiveQuery = admin.from("image_assets")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("course_app_id", courseId).eq("placement", body.placement).eq("owner_id", user.id);
    archiveQuery = body.contentObjectId
      ? archiveQuery.eq("content_object_id", String(body.contentObjectId))
      : archiveQuery.is("content_object_id", null);
    const { data, error } = await archiveQuery.select("id");
    if (error) return json(500, { error: error.message });
    if (!data?.length) return json(404, { error: "Image not found." });
    return json(200, { ok: true });
  }

  if (action === "restore") {
    const assetId = String(body.assetId ?? "");
    const { data: source, error: sourceError } = await admin.from("image_assets").select("*")
      .eq("id", assetId).eq("owner_id", user.id).maybeSingle();
    if (sourceError) return json(500, { error: sourceError.message });
    if (!source) return json(404, { error: "Image not found." });
    let versionQuery = admin.from("image_assets").select("version")
      .eq("owner_id", user.id).eq("course_app_id", source.course_app_id).eq("placement", source.placement);
    versionQuery = source.content_object_id
      ? versionQuery.eq("content_object_id", source.content_object_id)
      : versionQuery.is("content_object_id", null);
    const { data: versionRows } = await versionQuery.order("version", { ascending: false }).limit(1);
    const restored = { ...source } as Record<string, unknown>;
    delete restored.created_at;
    delete restored.archived_at;
    restored.id = crypto.randomUUID();
    restored.version = Number(versionRows?.[0]?.version ?? 0) + 1;
    restored.status = "ready";
    restored.file_name = `${safeSegment(String(source.course_app_id))}-${source.placement}-v${restored.version}.jpg`;
    const { data, error } = await admin.from("image_assets").insert(restored).select("*").single();
    if (error || !data) return json(500, { error: error?.message ?? "The version could not be restored." });
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(data.storage_path), 3600);
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
