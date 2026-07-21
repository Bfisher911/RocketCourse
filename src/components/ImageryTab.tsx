import {
  AlertCircle,
  Check,
  Coins,
  Download,
  Image as ImageIcon,
  LockKeyhole,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseImageAsset, CourseImagePlacement, CourseProject } from "../types";
import {
  IMAGE_CREDIT_COST,
  IMAGE_PLACEMENT_SPECS,
  activeImageForPlacement,
  defaultImageCrop,
  imageReadiness,
  nextImageVersion,
  safeImageDownloadName,
  validateImageUpload,
  type ImageGenerationSet,
  type ImageGenerationTarget,
  type ImageQuality
} from "../services/courseImagery";
import {
  archiveImageTarget,
  finalizeImageUpload,
  generateCourseImages,
  loadCourseImageAssets,
  loadImageBalance,
  requestImageDownloadUrl,
  requestImageUpload,
  restoreImageAsset,
  updateImageAsset,
  type ImageBalance
} from "../services/imageClient";
import { getSupabaseClient, supabaseConfig } from "../services/supabaseClient";
import { ReadinessRing } from "./ReadinessRing";
import { startImageCreditPackCheckout } from "../billing/checkout";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

const placements = Object.keys(IMAGE_PLACEMENT_SPECS) as CourseImagePlacement[];
const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const fileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = src;
  });

const makeDerivative = async (
  file: File,
  placement: CourseImagePlacement,
  focalX: number,
  focalY: number,
  zoom: number
): Promise<{ dataUrl: string; width: number; height: number; mimeType: CourseImageAsset["mimeType"] }> => {
  const sourceUrl = await fileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const spec = IMAGE_PLACEMENT_SPECS[placement];
  const canvas = document.createElement("canvas");
  canvas.width = spec.outputWidth;
  canvas.height = spec.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process the image.");
  const coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const maxX = Math.max(0, drawWidth - canvas.width);
  const maxY = Math.max(0, drawHeight - canvas.height);
  const drawX = -(maxX * (focalX / 100));
  const drawY = -(maxY * (focalY / 100));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  const mimeType: CourseImageAsset["mimeType"] = file.type === "image/png" ? "image/png" : "image/jpeg";
  return { dataUrl: canvas.toDataURL(mimeType, 0.88), width: canvas.width, height: canvas.height, mimeType };
};

const downloadUrl = (url: string, name: string): void => {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.click();
};

const previewUrlFor = (asset: CourseImageAsset | null): string | null =>
  asset?.dataUrl ?? asset?.signedPreviewUrl ?? null;

export function ImageryTab({
  course,
  onUpdateCourse,
  subscriptionActive,
  demoMode = false
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  subscriptionActive: boolean;
  demoMode?: boolean;
}) {
  const [placement, setPlacement] = useState<CourseImagePlacement>("course-card");
  const [setType, setSetType] = useState<ImageGenerationSet>("essential");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [direction, setDirection] = useState("");
  const [supportingTargetId, setSupportingTargetId] = useState("");
  const [customTargetKeys, setCustomTargetKeys] = useState<string[]>(["course-card:course", "homepage-banner:course"]);
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [rightsAcknowledged, setRightsAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<ImageBalance | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const serverPersistence = supabaseConfig.isConfigured && !demoMode;
  const readiness = useMemo(() => imageReadiness(course), [course]);
  const supportingTargets = useMemo<ImageGenerationTarget[]>(() => [
    ...course.modules.filter((module) => module.kind !== "instructor").map((module) => ({ placement: "supporting" as const, contentObjectId: module.id, contentObjectType: "module" as const, contentObjectTitle: module.title })),
    ...course.pages.filter((page) => !page.frontPage).map((page) => ({ placement: "supporting" as const, contentObjectId: page.id, contentObjectType: "page" as const, contentObjectTitle: page.title })),
    ...course.assignments.map((item) => ({ placement: "supporting" as const, contentObjectId: item.id, contentObjectType: "assignment" as const, contentObjectTitle: item.title })),
    ...course.discussions.map((item) => ({ placement: "supporting" as const, contentObjectId: item.id, contentObjectType: "discussion" as const, contentObjectTitle: item.title })),
    ...course.quizzes.map((item) => ({ placement: "supporting" as const, contentObjectId: item.id, contentObjectType: "quiz" as const, contentObjectTitle: item.title }))
  ], [course.modules, course.pages, course.assignments, course.discussions, course.quizzes]);
  useEffect(() => {
    if (!supportingTargetId && supportingTargets[0]?.contentObjectId) setSupportingTargetId(supportingTargets[0].contentObjectId);
  }, [supportingTargetId, supportingTargets]);
  const supportingTarget = supportingTargets.find((target) => target.contentObjectId === supportingTargetId);
  const selectedTarget = placement === "supporting" ? supportingTarget : undefined;
  const active = activeImageForPlacement(course, placement, placement === "supporting" ? supportingTargetId : undefined);
  const versions = useMemo(
    () => [...(course.imageAssets ?? [])].filter((asset) => asset.placement === placement && (placement !== "supporting" || asset.contentObjectId === supportingTargetId)).sort((a, b) => b.version - a.version),
    [course.imageAssets, placement, supportingTargetId]
  );
  const generationCatalog = useMemo<ImageGenerationTarget[]>(() => [
    { placement: "course-card" },
    { placement: "homepage-banner" },
    ...supportingTargets
  ], [supportingTargets]);
  const generationTargets = useMemo<ImageGenerationTarget[]>(() => {
    if (setType === "essential") return [{ placement: "course-card" }, { placement: "homepage-banner" }];
    if (setType === "expanded") return [{ placement: "course-card" }, { placement: "homepage-banner" }, ...supportingTargets.filter((target) => target.contentObjectType === "module").slice(0, 10)];
    return generationCatalog.filter((target) => customTargetKeys.includes(`${target.placement}:${target.contentObjectId ?? "course"}`));
  }, [setType, supportingTargets, generationCatalog, customTargetKeys]);
  const generationPlacements = generationTargets.map((target) => target.placement);
  const generationCost = generationTargets.length * IMAGE_CREDIT_COST[quality];

  useEffect(() => {
    setFocalX(active?.crop.focalX ?? 50);
    setFocalY(active?.crop.focalY ?? 50);
    setZoom(active?.crop.zoom ?? 1);
  }, [active?.id, active?.crop.focalX, active?.crop.focalY, active?.crop.zoom]);

  useEffect(() => {
    if (!subscriptionActive || !serverPersistence) return;
    loadImageBalance().then(setBalance).catch(() => undefined);
  }, [subscriptionActive, serverPersistence]);

  useEffect(() => {
    if (!subscriptionActive || !serverPersistence) return;
    loadCourseImageAssets(course.id)
      .then(({ assets }) => onUpdateCourse((current) => ({ ...current, imageAssets: assets })))
      .catch(() => undefined);
  }, [course.id, subscriptionActive, serverPersistence]);

  const addAssets = (assets: CourseImageAsset[]): void => {
    onUpdateCourse((current) => ({ ...current, imageAssets: [...(current.imageAssets ?? []), ...assets] }));
  };

  const processFile = async (file: File): Promise<void> => {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      if (!rightsAcknowledged) throw new Error("Confirm that you have permission to use this image.");
      if (placement === "supporting" && !supportingTarget) throw new Error("Choose where this supporting image should appear.");
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const sourceUrl = await fileAsDataUrl(file);
      const decoded = await loadImage(sourceUrl);
      const validation = validateImageUpload(
        { name: file.name, mimeType: file.type, byteSize: file.size, width: decoded.naturalWidth, height: decoded.naturalHeight, signature: bytes },
        placement
      );
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const crop = { ...defaultImageCrop(), focalX, focalY, zoom };

      if (serverPersistence) {
        const signed = await requestImageUpload(course.id, placement, file.name, file.type, file.size, selectedTarget);
        const client = await getSupabaseClient();
        if (!client) throw new Error("Secure storage is unavailable.");
        const { error: uploadError } = await client.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type
        });
        if (uploadError) throw uploadError;
        const result = await finalizeImageUpload({
          courseId: course.id,
          placement,
          originalPath: signed.path,
          crop,
          altText: "",
          decorative: false,
          rightsAcknowledged,
          ...selectedTarget
        });
        addAssets([result.asset]);
        setMessage("Uploaded, normalized, and saved privately. Add alt text before export.");
      } else {
        const derivative = await makeDerivative(file, placement, focalX, focalY, zoom);
        const asset: CourseImageAsset = {
          id: newId(),
          placement,
          source: "upload",
          status: "ready",
          version: nextImageVersion(course.imageAssets, placement, selectedTarget?.contentObjectId),
          fileName: file.name,
          mimeType: derivative.mimeType,
          width: derivative.width,
          height: derivative.height,
          byteSize: Math.round((derivative.dataUrl.length * 3) / 4),
          altText: "",
          decorative: false,
          crop,
          ...selectedTarget,
          dataUrl: derivative.dataUrl,
          createdAt: new Date().toISOString(),
          rightsAcknowledgedAt: new Date().toISOString()
        };
        addAssets([asset]);
        setMessage(`${validation.warnings[0] ?? "Image cropped to the export size."} Saved in this local preview.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be processed.");
    } finally {
      setWorking(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const updateActive = (patch: Partial<CourseImageAsset>): void => {
    if (!active) return;
    onUpdateCourse((current) => ({
      ...current,
      imageAssets: (current.imageAssets ?? []).map((asset) => asset.id === active.id ? { ...asset, ...patch } : asset)
    }));
  };

  const restore = (asset: CourseImageAsset): void => {
    setWorking(true);
    const localRestore = () => ({ ...asset, id: newId(), version: nextImageVersion(course.imageAssets, placement, asset.contentObjectId), createdAt: new Date().toISOString(), archivedAt: undefined });
    void (serverPersistence ? restoreImageAsset(asset.id).then((result) => result.asset) : Promise.resolve(localRestore()))
      .then((restored) => { addAssets([restored]); setMessage(`Restored version ${asset.version} as the new active image.`); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "The version could not be restored."))
      .finally(() => setWorking(false));
  };

  const saveAccessibility = async (): Promise<void> => {
    if (!active) return;
    setWorking(true);
    try {
      if (serverPersistence) {
        const result = await updateImageAsset(active.id, { altText: active.altText, decorative: active.decorative });
        updateActive(result.asset);
      }
      setMessage("Accessibility details saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Accessibility details could not be saved."); }
    finally { setWorking(false); }
  };

  const applyCrop = async (): Promise<void> => {
    if (!active || !serverPersistence || !(active.originalStoragePath || active.storagePath)) return;
    setWorking(true);
    try {
      const result = await finalizeImageUpload({
        courseId: course.id,
        placement,
        originalPath: active.originalStoragePath ?? active.storagePath!,
        crop: { ...active.crop, focalX, focalY, zoom },
        altText: active.altText,
        decorative: active.decorative,
        rightsAcknowledged: true,
        contentObjectId: active.contentObjectId,
        contentObjectType: active.contentObjectType,
        contentObjectTitle: active.contentObjectTitle
      });
      addAssets([result.asset]);
      setMessage("Crop saved as a new version.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The crop could not be applied."); }
    finally { setWorking(false); }
  };

  const archiveActive = async (): Promise<void> => {
    if (!active) return;
    setWorking(true);
    try {
      if (serverPersistence) await archiveImageTarget(course.id, placement, active.contentObjectId);
      onUpdateCourse((current) => ({ ...current, imageAssets: (current.imageAssets ?? []).map((asset) => asset.placement === placement && asset.contentObjectId === active.contentObjectId ? { ...asset, status: "archived", archivedAt: new Date().toISOString() } : asset) }));
      setMessage("Image removed from this placement. Previous versions remain available.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The image could not be removed."); }
    finally { setWorking(false); }
  };

  const generate = async (): Promise<void> => {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateCourseImages({
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        courseContext: [
          `Learning outcomes: ${course.outcomes.map((outcome) => outcome.text).join("; ")}`,
          `Modules: ${course.modules.map((module) => module.title).join("; ")}`,
          `Audience and theme: ${course.settings.level}; ${course.settings.modality}; ${course.settings.tone}; ${course.theme.name}`
        ].join("\n"),
        set: setType,
        placements: generationPlacements,
        targets: generationTargets,
        quality,
        visualDirection: direction,
        idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `generate_${Date.now()}`
      });
      addAssets(result.assets);
      setBalance(result.balance);
      setMessage(`${result.assets.length} image${result.assets.length === 1 ? "" : "s"} generated. Review crop and alt text before export.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image generation failed. No credits were used.");
    } finally {
      setWorking(false);
    }
  };

  const download = async (): Promise<void> => {
    if (!active) return;
    try {
      const url = active.dataUrl ?? active.signedPreviewUrl ?? (await requestImageDownloadUrl(active.id)).url;
      downloadUrl(url, safeImageDownloadName(course.title, active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A download link could not be created.");
    }
  };

  const toggleCustomTarget = (target: ImageGenerationTarget): void => {
    const key = `${target.placement}:${target.contentObjectId ?? "course"}`;
    setCustomTargetKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  return (
    <div className="imagery-tab">
      <section className="imagery-hero">
        <div>
          <span className="hp-eyebrow"><ImageIcon size={14} /> Course imagery</span>
          <h2>One visual system, ready for Canvas</h2>
          <p>Upload your own images at no AI charge, or use Premium credits to generate a coordinated set. Every image stays private until you export it.</p>
        </div>
        <ReadinessRing score={readiness.score} size={72} caption="readiness" ariaLabel={`Image readiness ${readiness.score} out of 100`} />
      </section>

      <div className="imagery-workspace">
        <section className="imagery-main" aria-label="Image placement editor">
          <div className="imagery-placement-tabs" role="tablist" aria-label="Image placements">
            {placements.map((item) => {
              const spec = IMAGE_PLACEMENT_SPECS[item];
              const itemActive = activeImageForPlacement(course, item);
              return (
                <button key={item} role="tab" aria-selected={placement === item} className={placement === item ? "active" : ""} onClick={() => setPlacement(item)}>
                  {itemActive ? <Check size={14} /> : <ImageIcon size={14} />} {spec.label}
                </button>
              );
            })}
          </div>

          {placement === "supporting" && (
            <label className="imagery-target-select"><span>Place image in</span><select value={supportingTargetId} onChange={(event) => setSupportingTargetId(event.target.value)}>{supportingTargets.map((target) => <option key={target.contentObjectId} value={target.contentObjectId}>{target.contentObjectType}: {target.contentObjectTitle}</option>)}</select></label>
          )}

          <div className="imagery-canvas-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void processFile(file); }}>
            <div className="imagery-canvas-head">
              <div>
                <strong>{IMAGE_PLACEMENT_SPECS[placement].label}</strong>
                <span>{IMAGE_PLACEMENT_SPECS[placement].recommendedWidth} × {IMAGE_PLACEMENT_SPECS[placement].recommendedHeight} px recommended · 10 MB max</span>
              </div>
              {active && <div className="imagery-head-actions"><button className="ghost-button" type="button" onClick={() => void download()}><Download size={14} /> Download</button><button className="ghost-button danger" type="button" onClick={() => void archiveActive()}><Trash2 size={14} /> Remove</button></div>}
            </div>

            <div className={`imagery-preview is-${placement}`} style={previewUrlFor(active) ? { backgroundImage: `url("${previewUrlFor(active)}")`, backgroundPosition: `${active?.crop.focalX ?? 50}% ${active?.crop.focalY ?? 50}%` } : undefined}>
              {!active && <div className="imagery-empty"><ImageIcon size={28} /><strong>No custom image yet</strong><span>The generated theme artwork remains the export fallback.</span></div>}
              {placement === "course-card" && <div className="canvas-card-overlay" aria-hidden="true"><span>{course.title}</span><small>Canvas dashboard preview</small></div>}
              <div className="imagery-safe-area" aria-hidden="true"><span>central safe area</span></div>
            </div>

            <div className="imagery-controls">
              <label><span>Horizontal focus</span><input type="range" min="0" max="100" value={focalX} onChange={(event) => setFocalX(Number(event.target.value))} /></label>
              <label><span>Vertical focus</span><input type="range" min="0" max="100" value={focalY} onChange={(event) => setFocalY(Number(event.target.value))} /></label>
              <label><span>Zoom</span><input type="range" min="1" max="2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            </div>
            {active && serverPersistence && <button className="ghost-button imagery-apply-crop" type="button" disabled={working} onClick={() => void applyCrop()}><Save size={14} /> Apply crop as new version</button>}

            <div className="imagery-upload-row">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                aria-label={`Choose a ${IMAGE_PLACEMENT_SPECS[placement].label.toLowerCase()} file`}
                tabIndex={-1}
                accept={IMAGE_PLACEMENT_SPECS[placement].acceptedTypes.join(",")}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }}
              />
              <button className="primary" type="button" disabled={working || !rightsAcknowledged} onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> {working ? "Processing…" : active ? "Upload a new version" : "Upload image"}
              </button>
              <span>
                {rightsAcknowledged
                  ? "Uploads never use AI credits. You can also drag and drop a file here."
                  : "Confirm image permission below to enable uploads — they never use AI credits."}
              </span>
            </div>
            <label className="toggle-row imagery-rights"><input type="checkbox" checked={rightsAcknowledged} onChange={(event) => setRightsAcknowledged(event.target.checked)} /><span><strong>I have permission to use this image</strong><small>Required for uploads; RocketCourse records the acknowledgment with the asset.</small></span></label>
          </div>

          {active && (
            <section className="imagery-accessibility">
              <div>
                <strong>Accessibility</strong>
                <p>Describe the image’s instructional purpose, or mark it decorative when it adds no information.</p>
              </div>
              <label className="imagery-alt"><span>Alternative text</span><input value={active.altText} disabled={active.decorative} onChange={(event) => updateActive({ altText: event.target.value })} placeholder="Describe what a student needs to understand…" /></label>
              <label className="toggle-row"><input type="checkbox" checked={active.decorative} onChange={(event) => updateActive({ decorative: event.target.checked, altText: event.target.checked ? "" : active.altText })} /><span><strong>Decorative image</strong><small>Exports with empty alt text and presentation semantics.</small></span></label>
              <button className="ghost-button" type="button" disabled={working || (!active.decorative && !active.altText.trim())} onClick={() => void saveAccessibility()}><Save size={14} /> Save accessibility details</button>
            </section>
          )}

          {versions.length > 1 && (
            <section className="imagery-versions">
              <div><strong>Version history</strong><p>Restore an earlier choice without deleting the original.</p></div>
              <div className="imagery-version-list">
                {versions.map((asset) => <button type="button" key={asset.id} className={asset.id === active?.id ? "active" : ""} onClick={() => asset.id !== active?.id && restore(asset)}><span>v{asset.version} · {asset.source}</span><small>{new Date(asset.createdAt).toLocaleString()}</small>{asset.id !== active?.id && <RotateCcw size={13} />}</button>)}
              </div>
            </section>
          )}
        </section>

        <aside className="imagery-premium" aria-label="Premium image generation">
          <div className="imagery-premium-head"><span><WandSparkles size={16} /> Premium imagery</span><strong>{balance?.premium ? balance.planName : balance ? `${balance.planName} · add-on` : "Add-on"}</strong></div>
          {balance?.premium ? (
            <div className="imagery-credit-meter"><div><strong>{balance.remaining}</strong><span>credits remaining</span></div><div className="credit-track"><span style={{ width: `${Math.min(100, (balance.remaining / Math.max(1, balance.included + balance.granted)) * 100)}%` }} /></div><small>{balance.used} used · {balance.included} included{balance.renewsAt ? ` · renews ${new Date(balance.renewsAt).toLocaleDateString()}` : ""}</small><button className="ghost-button" type="button" onClick={() => void startImageCreditPackCheckout().then((result) => { if (!result.ok) setError(result.error ?? "Credit-pack checkout could not start."); })}><Coins size={13} /> Buy {balance.creditPackCredits}-credit pack · ${(balance.creditPackCents / 100).toFixed(0)}</button></div>
          ) : (
            <div className="imagery-locked"><LockKeyhole size={20} /><strong>Generate a coordinated image set</strong><p>Premium adds 50 monthly credits for course-safe AI imagery. Your own uploads remain available on every paid plan.</p><button className="secondary" type="button" onClick={() => { window.location.assign("/pricing"); }}>Compare plans</button></div>
          )}

          <fieldset disabled={!balance?.premium || working}>
            <legend>Image set</legend>
            {(["essential", "expanded", "custom"] as ImageGenerationSet[]).map((item) => <label key={item} className="imagery-radio"><input type="radio" name="image-set" checked={setType === item} onChange={() => setSetType(item)} /><span><strong>{item[0].toUpperCase() + item.slice(1)}</strong><small>{item === "essential" ? "Course card + homepage banner" : item === "expanded" ? "Essential + up to 10 module images" : `Current ${IMAGE_PLACEMENT_SPECS[placement].label.toLowerCase()}`}</small></span></label>)}
          </fieldset>

          {setType === "custom" && (
            <fieldset className="imagery-custom-targets" disabled={!balance?.premium || working}>
              <legend>Exact placements ({generationTargets.length})</legend>
              <div>{generationCatalog.map((target) => { const key = `${target.placement}:${target.contentObjectId ?? "course"}`; return <label key={key}><input type="checkbox" checked={customTargetKeys.includes(key)} onChange={() => toggleCustomTarget(target)} /><span>{target.contentObjectTitle ?? IMAGE_PLACEMENT_SPECS[target.placement].label}<small>{target.contentObjectType ?? "course identity"}</small></span></label>; })}</div>
            </fieldset>
          )}

          <fieldset disabled={!balance?.premium || working}>
            <legend>Quality</legend>
            {(["medium", "high"] as ImageQuality[]).map((item) => <label key={item} className="imagery-radio"><input type="radio" name="image-quality" checked={quality === item} onChange={() => setQuality(item)} /><span><strong>{item[0].toUpperCase() + item.slice(1)}</strong><small>{IMAGE_CREDIT_COST[item]} credit{IMAGE_CREDIT_COST[item] === 1 ? "" : "s"} per image</small></span></label>)}
          </fieldset>

          <label className="imagery-direction"><span>Visual direction</span><textarea rows={4} value={direction} disabled={!balance?.premium || working} onChange={(event) => setDirection(event.target.value)} placeholder="Warm documentary photography, hands-on science, natural light…" /></label>
          <div className="imagery-generation-summary"><span>{generationTargets.length} image{generationTargets.length === 1 ? "" : "s"}</span><span>{generationCost} credits</span><span>{balance ? `${balance.remaining} → ${Math.max(0, balance.remaining - generationCost)} remaining` : "Balance shown after sign-in"}</span></div>
          <button className="primary imagery-generate" type="button" disabled={!balance?.premium || working || generationTargets.length === 0 || (balance.remaining < generationCost)} onClick={() => { if (generationTargets.length <= 4 || window.confirm(`Generate ${generationTargets.length} images for ${generationCost} credits?`)) void generate(); }}><Sparkles size={15} /> {working ? "Generating…" : `Generate set · ${generationCost} credits`}</button>
          <p className="imagery-provider-note"><Coins size={13} /> Credits reserve before generation and automatically return if the provider fails.</p>
        </aside>
      </div>

      {(message || error) && <div className={`imagery-notice ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{error ? <AlertCircle size={16} /> : <Check size={16} />}<span>{error ?? message}</span></div>}

      <section className="imagery-export-note">
        <strong>Canvas handoff</strong>
        <p>Homepage and supporting images are embedded in the IMSCC at stable package paths. Canvas course-card assignment is not portable in a standard IMSCC, so RocketCourse includes the ready-to-upload file and exact post-import steps; a future authorized Canvas API connection can set the course file automatically.</p>
      </section>
    </div>
  );
}
