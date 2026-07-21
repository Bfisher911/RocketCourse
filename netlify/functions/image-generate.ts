import sharp from "sharp";
import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { checkUserEntitlement } from "./_shared/userEntitlement";
import { resolveEffectiveSubscription } from "./_shared/workspaceEntitlement";
import { getImageProvider } from "./_shared/imageProvider";
import { getPlan } from "../../src/data/plans";
import {
  IMAGE_PLACEMENT_SPECS,
  defaultImageCrop,
  type ImageGenerationTarget,
  type ImageQuality
} from "../../src/services/courseImagery";
import type { CourseImageAsset, CourseImageContentType, CourseImagePlacement } from "../../src/types";

const BUCKET = "course-images";
const isPlacement = (value: unknown): value is CourseImagePlacement =>
  value === "course-card" || value === "homepage-banner" || value === "supporting";
const isContentType = (value: unknown): value is CourseImageContentType =>
  value === "module" || value === "page" || value === "assignment" || value === "discussion" || value === "quiz";
const safeSegment = (value: string): string => value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "course";

interface EconomicsConfig {
  premiumPlanName?: string;
  includedCredits?: number;
  mediumCredits?: number;
  highCredits?: number;
  maxBatchImages?: number;
  maxImagesPerCourse?: number;
  perUserDailyLimit?: number;
  monthlyHardSpendUsd?: number;
  mediumLandscapeCostUsd?: number;
  highLandscapeCostUsd?: number;
  creditPackCredits?: number;
  creditPackCents?: number;
}

const economicsConfig = async (): Promise<EconomicsConfig> => {
  const { data } = await getSupabaseAdmin().from("image_economics_config").select("config").eq("key", "default").maybeSingle();
  return (data?.config as EconomicsConfig | null) ?? {};
};

const balanceFor = async (userId: string): Promise<Record<string, unknown>> => {
  const admin = getSupabaseAdmin();
  const effective = await resolveEffectiveSubscription(userId);
  const plan = getPlan(effective.subscription.planKey);
  const config = await economicsConfig();
  if (!effective.rowId) {
    return { planName: String(config.premiumPlanName ?? plan.name), included: 0, granted: 0, used: 0, reserved: 0, remaining: 0, renewsAt: null, premium: false, creditPackCredits: Number(config.creditPackCredits ?? 25), creditPackCents: Number(config.creditPackCents ?? 500) };
  }
  const [{ data: row }, grantedResult, pendingResult] = await Promise.all([
    admin.from("subscriptions").select("image_credits_limit,image_credits_used,current_period_end").eq("id", effective.rowId).single(),
    admin.rpc("active_credit_balance", { p_user_id: userId, p_kind: "image_credit" }),
    admin.from("image_generation_requests").select("credits").eq("subscription_id", effective.rowId).in("status", ["reserved", "processing"])
  ]);
  const included = Math.max(0, Number(row?.image_credits_limit ?? plan.imageCreditsLimit ?? (plan.capabilities.imageGeneration ? (config.includedCredits ?? 0) : 0)));
  const granted = Math.max(0, Number(grantedResult.data ?? 0));
  const used = Math.max(0, Number(row?.image_credits_used ?? 0));
  const reserved = (pendingResult.data ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.credits ?? 0)), 0);
  return {
    planName: String(config.premiumPlanName ?? plan.name),
    included,
    granted,
    used,
    reserved,
    remaining: Math.max(0, included + granted - used - reserved),
    renewsAt: row?.current_period_end ?? null,
    premium: Boolean(plan.capabilities.imageGeneration),
    creditPackCredits: Number(config.creditPackCredits ?? 25),
    creditPackCents: Number(config.creditPackCents ?? 500)
  };
};

const mapAsset = (row: Record<string, unknown>, signedPreviewUrl: string | undefined): CourseImageAsset => ({
  id: String(row.id),
  placement: row.placement as CourseImagePlacement,
  contentObjectId: row.content_object_id ? String(row.content_object_id) : undefined,
  contentObjectType: isContentType(row.content_object_type) ? row.content_object_type : undefined,
  contentObjectTitle: row.content_object_title ? String(row.content_object_title) : undefined,
  source: "ai",
  status: "ready",
  version: Number(row.version),
  fileName: String(row.file_name),
  mimeType: "image/jpeg",
  width: Number(row.width),
  height: Number(row.height),
  byteSize: Number(row.byte_size),
  altText: String(row.alt_text ?? ""),
  decorative: Boolean(row.decorative),
  crop: (row.crop_json as CourseImageAsset["crop"]) ?? defaultImageCrop(),
  storagePath: String(row.storage_path),
  signedPreviewUrl,
  prompt: row.prompt_snapshot ? String(row.prompt_snapshot) : undefined,
  visualDirection: row.visual_direction ? String(row.visual_direction) : undefined,
  provider: row.provider ? String(row.provider) : undefined,
  providerModel: row.provider_model ? String(row.provider_model) : undefined,
  providerRequestId: row.provider_request_id ? String(row.provider_request_id) : undefined,
  idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
  creditCost: Number(row.credit_cost ?? 0),
  estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
  createdAt: String(row.created_at)
});

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });
  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to use Premium imagery." });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json(400, { error: "Body must be JSON." }); }
  const admin = getSupabaseAdmin();
  // A provider/platform crash can strand a reservation. Reconcile it on the user's next image
  // request so credits recover without an operator rewriting history.
  await admin.rpc("reconcile_stale_image_reservations", { p_user_id: user.id });
  if (body.action === "balance") return json(200, await balanceFor(user.id));
  if (body.action !== "generate") return json(400, { error: "Unknown image generation action." });

  const entitlement = await checkUserEntitlement(user.token, "generate_image", user.id);
  if (!entitlement.decision.allowed) return json(403, { error: entitlement.decision.reason, code: entitlement.decision.code });

  const courseId = String(body.courseId ?? "");
  const courseTitle = String(body.courseTitle ?? "").trim().slice(0, 200);
  const courseDescription = String(body.courseDescription ?? "").trim().slice(0, 2000);
  const visualDirection = String(body.visualDirection ?? "").trim().slice(0, 1000);
  const courseContext = String(body.courseContext ?? "").trim().slice(0, 6000);
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  const quality: ImageQuality = body.quality === "high" ? "high" : "medium";
  const legacyTargets: ImageGenerationTarget[] = Array.from(new Set(Array.isArray(body.placements) ? body.placements.filter(isPlacement) : []))
    .map((placement) => ({ placement }));
  const rawTargets = Array.isArray(body.targets) ? body.targets : [];
  const targets = (rawTargets.length ? rawTargets : legacyTargets)
    .map((value): ImageGenerationTarget | null => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      if (!isPlacement(row.placement)) return null;
      if (row.placement !== "supporting") return { placement: row.placement };
      if (!String(row.contentObjectId ?? "") || !isContentType(row.contentObjectType)) return null;
      return {
        placement: "supporting",
        contentObjectId: String(row.contentObjectId).slice(0, 200),
        contentObjectType: row.contentObjectType,
        contentObjectTitle: String(row.contentObjectTitle ?? "").trim().slice(0, 300)
      };
    })
    .filter((value): value is ImageGenerationTarget => Boolean(value));
  const uniqueTargets = Array.from(new Map(targets.map((target) => [`${target.placement}:${target.contentObjectId ?? "course"}`, target])).values());
  const config = await economicsConfig();
  const maxBatchImages = Math.max(1, Math.min(30, Number(config.maxBatchImages ?? 12)));
  if (!courseId || !courseTitle || idempotencyKey.length < 8 || uniqueTargets.length < 1 || uniqueTargets.length > maxBatchImages) {
    return json(400, { error: `courseId, course title, one to ${maxBatchImages} valid image targets, and an idempotency key are required.` });
  }
  const { data: course } = await admin.from("course_projects").select("id").eq("owner_id", user.id).eq("app_project_id", courseId).maybeSingle();
  if (!course) return json(403, { error: "Save this course project before generating private imagery." });

  const { count: courseImageCount } = await admin.from("image_assets").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id).eq("course_app_id", courseId).eq("source", "ai").neq("status", "archived");
  const maxImagesPerCourse = Math.max(maxBatchImages, Number(config.maxImagesPerCourse ?? 100));
  if ((courseImageCount ?? 0) + uniqueTargets.length > maxImagesPerCourse) {
    return json(409, { error: `This course has reached its ${maxImagesPerCourse}-image generation limit.` });
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("image_generation_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= 5) return json(429, { error: "Too many image requests. Wait a minute and try again." });
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: dailyCount } = await admin.from("image_assets").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id).eq("source", "ai").gte("created_at", oneDayAgo);
  const dailyLimit = Math.max(maxBatchImages, Number(config.perUserDailyLimit ?? 50));
  if ((dailyCount ?? 0) + uniqueTargets.length > dailyLimit) return json(429, { error: `Daily image limit reached (${dailyLimit}). Try again tomorrow.` });

  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { data: monthlyRows } = await admin.from("image_generation_requests").select("estimated_cost_usd")
    .eq("status", "completed").gte("created_at", monthStart.toISOString());
  const monthlySpend = (monthlyRows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  const estimatedUnitCost = quality === "high" ? Number(config.highLandscapeCostUsd ?? 0.165) : Number(config.mediumLandscapeCostUsd ?? 0.041);
  const monthlyHardSpend = Math.max(0, Number(config.monthlyHardSpendUsd ?? 2000));
  if (monthlyHardSpend > 0 && monthlySpend + estimatedUnitCost * uniqueTargets.length > monthlyHardSpend) {
    return json(503, { error: "Image generation is temporarily paused by the platform spend guardrail. No credits were used." });
  }

  const creditsPerImage = quality === "high" ? Math.max(1, Number(config.highCredits ?? 4)) : Math.max(1, Number(config.mediumCredits ?? 1));
  const totalCredits = creditsPerImage * uniqueTargets.length;
  const requestId = crypto.randomUUID();
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_image_generation", {
    p_user_id: user.id,
    p_idempotency_key: idempotencyKey,
    p_request_id: requestId,
    p_course_app_id: courseId,
    p_credits: totalCredits,
    p_request_json: { targets: uniqueTargets, quality, set: body.set ?? "custom" }
  });
  if (reserveError || !reservation) {
    const creditError = /credit limit/i.test(reserveError?.message ?? "");
    return json(creditError ? 402 : 500, { error: creditError ? "Not enough image credits for this set." : (reserveError?.message ?? "Credits could not be reserved.") });
  }
  const reservationRow = reservation as Record<string, unknown>;
  const generationId = String(reservationRow.id);

  if (reservationRow.status === "completed") {
    const { data: prior } = await admin.from("image_assets").select("*").eq("owner_id", user.id).eq("idempotency_key", idempotencyKey).order("created_at");
    const assets = await Promise.all((prior ?? []).map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 3600);
      return mapAsset(row as Record<string, unknown>, signed?.signedUrl);
    }));
    return json(200, { assets, balance: await balanceFor(user.id), requestId: reservationRow.request_id ?? requestId });
  }

  await admin.from("image_generation_requests").update({ status: "processing" }).eq("id", generationId).eq("status", "reserved");
  const provider = getImageProvider();
  const createdRows: Array<Record<string, unknown>> = [];
  const createdPaths: string[] = [];
  const providerRequestIds: string[] = [];
  let totalCost = 0;
  try {
    for (const target of uniqueTargets) {
      const placement = target.placement;
      const generated = await provider.generate({ courseTitle, courseDescription, courseContext, placement, target, visualDirection, quality, requestId });
      const spec = IMAGE_PLACEMENT_SPECS[placement];
      const derivative = await sharp(Buffer.from(generated.base64, "base64"), { failOn: "error" })
        .rotate()
        .resize(spec.outputWidth, spec.outputHeight, { fit: "cover", position: "centre" })
        .jpeg({ quality: 88, progressive: true, mozjpeg: true })
        .toBuffer();
      let versionQuery = admin.from("image_assets").select("version").eq("owner_id", user.id).eq("course_app_id", courseId).eq("placement", placement);
      versionQuery = target.contentObjectId ? versionQuery.eq("content_object_id", target.contentObjectId) : versionQuery.is("content_object_id", null);
      const { data: versionRows } = await versionQuery.order("version", { ascending: false }).limit(1);
      const version = Number(versionRows?.[0]?.version ?? 0) + 1;
      const assetId = crypto.randomUUID();
      const storagePath = `${user.id}/${safeSegment(courseId)}/${assetId}/${placement}-v${version}.jpg`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, derivative, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      createdPaths.push(storagePath);
      totalCost += estimatedUnitCost;
      if (generated.providerRequestId) providerRequestIds.push(generated.providerRequestId);
      const row = {
        id: assetId,
        owner_id: user.id,
        course_app_id: courseId,
        placement,
        content_object_id: target.contentObjectId ?? null,
        content_object_type: target.contentObjectType ?? null,
        content_object_title: target.contentObjectTitle ?? null,
        source: "ai",
        status: "ready",
        version,
        file_name: `${safeSegment(courseId)}-${placement}-v${version}.jpg`,
        mime_type: "image/jpeg",
        width: spec.outputWidth,
        height: spec.outputHeight,
        byte_size: derivative.byteLength,
        storage_path: storagePath,
        crop_json: defaultImageCrop(),
        alt_text: target.contentObjectTitle
          ? `Course illustration for ${target.contentObjectTitle}. Review this suggested description for accuracy.`
          : `Course identity artwork for ${courseTitle}. Review this suggested description for accuracy.`,
        decorative: false,
        prompt_snapshot: generated.prompt.slice(0, 4000),
        visual_direction: visualDirection,
        provider: generated.provider,
        provider_model: generated.model,
        provider_request_id: generated.providerRequestId,
        idempotency_key: idempotencyKey,
        credit_cost: creditsPerImage,
        estimated_cost_usd: estimatedUnitCost,
        usage_metadata: generated.usage ?? null
      };
      const { data, error } = await admin.from("image_assets").insert(row).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "Generated image metadata could not be saved.");
      createdRows.push(data as Record<string, unknown>);
    }
    const { error: finalizeError } = await admin.rpc("finalize_image_generation", {
      p_user_id: user.id,
      p_generation_request_id: generationId,
      p_succeeded: true,
      p_provider_request_ids: providerRequestIds,
      p_estimated_cost_usd: totalCost,
      p_error_message: null
    });
    if (finalizeError) throw new Error(finalizeError.message);
    const assets = await Promise.all(createdRows.map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 3600);
      return mapAsset(row, signed?.signedUrl);
    }));
    return json(200, { assets, balance: await balanceFor(user.id), requestId });
  } catch (cause) {
    if (createdPaths.length) await admin.storage.from(BUCKET).remove(createdPaths);
    if (createdRows.length) await admin.from("image_assets").delete().in("id", createdRows.map((row) => String(row.id)));
    const message = cause instanceof Error ? cause.message : "Image generation failed.";
    await admin.rpc("finalize_image_generation", {
      p_user_id: user.id,
      p_generation_request_id: generationId,
      p_succeeded: false,
      p_provider_request_ids: providerRequestIds,
      p_estimated_cost_usd: totalCost || null,
      p_error_message: message
    });
    return json(502, { error: message.includes("blocked") ? message : `${message} Reserved credits were returned.`, requestId });
  }
};
