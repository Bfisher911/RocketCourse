import {
  AlertCircle,
  Check,
  Coins,
  Download,
  Image as ImageIcon,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseImageAsset, CourseImagePlacement, CourseProject } from "../types";
import {
  IMAGE_CREDIT_COST,
  IMAGE_PLACEMENT_SPECS,
  IMAGE_SET_PLACEMENTS,
  activeImageForPlacement,
  defaultImageCrop,
  imageReadiness,
  imageSetCreditCost,
  nextImageVersion,
  safeImageDownloadName,
  validateImageUpload,
  type ImageGenerationSet,
  type ImageQuality
} from "../services/courseImagery";
import {
  finalizeImageUpload,
  generateCourseImages,
  loadImageBalance,
  requestImageDownloadUrl,
  requestImageUpload,
  type ImageBalance
} from "../services/imageClient";
import { getSupabaseClient, supabaseConfig } from "../services/supabaseClient";
import { ReadinessRing } from "./ReadinessRing";

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
  subscriptionActive
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  subscriptionActive: boolean;
}) {
  const [placement, setPlacement] = useState<CourseImagePlacement>("course-card");
  const [setType, setSetType] = useState<ImageGenerationSet>("essential");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [direction, setDirection] = useState("");
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<ImageBalance | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readiness = useMemo(() => imageReadiness(course), [course]);
  const active = activeImageForPlacement(course, placement);
  const versions = useMemo(
    () => [...(course.imageAssets ?? [])].filter((asset) => asset.placement === placement).sort((a, b) => b.version - a.version),
    [course.imageAssets, placement]
  );
  const generationPlacements = setType === "custom" ? [placement] : IMAGE_SET_PLACEMENTS[setType];
  const generationCost = imageSetCreditCost(setType, quality, generationPlacements);

  useEffect(() => {
    if (!subscriptionActive || !supabaseConfig.isConfigured) return;
    loadImageBalance().then(setBalance).catch(() => undefined);
  }, [subscriptionActive]);

  const addAssets = (assets: CourseImageAsset[]): void => {
    onUpdateCourse((current) => ({ ...current, imageAssets: [...(current.imageAssets ?? []), ...assets] }));
  };

  const processFile = async (file: File): Promise<void> => {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const sourceUrl = await fileAsDataUrl(file);
      const decoded = await loadImage(sourceUrl);
      const validation = validateImageUpload(
        { name: file.name, mimeType: file.type, byteSize: file.size, width: decoded.naturalWidth, height: decoded.naturalHeight, signature: bytes },
        placement
      );
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const crop = { ...defaultImageCrop(), focalX, focalY, zoom };

      if (supabaseConfig.isConfigured) {
        const signed = await requestImageUpload(course.id, placement, file.name, file.type, file.size);
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
          decorative: false
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
          version: nextImageVersion(course.imageAssets, placement),
          fileName: file.name,
          mimeType: derivative.mimeType,
          width: derivative.width,
          height: derivative.height,
          byteSize: Math.round((derivative.dataUrl.length * 3) / 4),
          altText: "",
          decorative: false,
          crop,
          dataUrl: derivative.dataUrl,
          createdAt: new Date().toISOString()
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
    addAssets([{ ...asset, id: newId(), version: nextImageVersion(course.imageAssets, placement), createdAt: new Date().toISOString(), archivedAt: undefined }]);
    setMessage(`Restored version ${asset.version} as the new active image.`);
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
        set: setType,
        placements: generationPlacements,
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

  return (
    <div className="imagery-tab">
      <section className="imagery-hero">
        <div>
          <span className="hp-eyebrow"><ImageIcon size={14} /> Course imagery</span>
          <h2>One visual system, ready for Canvas</h2>
          <p>Upload your own images at no AI charge, or use Premium credits to generate a coordinated set. Every image stays private until you export it.</p>
        </div>
        <ReadinessRing score={readiness.score} size={72} caption="images" ariaLabel={`Image readiness ${readiness.score} out of 100`} />
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

          <div className="imagery-canvas-card">
            <div className="imagery-canvas-head">
              <div>
                <strong>{IMAGE_PLACEMENT_SPECS[placement].label}</strong>
                <span>{IMAGE_PLACEMENT_SPECS[placement].recommendedWidth} × {IMAGE_PLACEMENT_SPECS[placement].recommendedHeight} px recommended · 10 MB max</span>
              </div>
              {active && <button className="ghost-button" type="button" onClick={() => void download()}><Download size={14} /> Download</button>}
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

            <div className="imagery-upload-row">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept={IMAGE_PLACEMENT_SPECS[placement].acceptedTypes.join(",")}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }}
              />
              <button className="primary-button" type="button" disabled={working} onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> {working ? "Processing…" : active ? "Upload a new version" : "Upload image"}
              </button>
              <span>Uploads never use AI credits.</span>
            </div>
          </div>

          {active && (
            <section className="imagery-accessibility">
              <div>
                <strong>Accessibility</strong>
                <p>Describe the image’s instructional purpose, or mark it decorative when it adds no information.</p>
              </div>
              <label className="imagery-alt"><span>Alternative text</span><input value={active.altText} disabled={active.decorative} onChange={(event) => updateActive({ altText: event.target.value })} placeholder="Describe what a student needs to understand…" /></label>
              <label className="toggle-row"><input type="checkbox" checked={active.decorative} onChange={(event) => updateActive({ decorative: event.target.checked, altText: event.target.checked ? "" : active.altText })} /><span><strong>Decorative image</strong><small>Exports with empty alt text and presentation semantics.</small></span></label>
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
            <div className="imagery-credit-meter"><div><strong>{balance.remaining}</strong><span>credits remaining</span></div><div className="credit-track"><span style={{ width: `${Math.min(100, (balance.remaining / Math.max(1, balance.included + balance.granted)) * 100)}%` }} /></div><small>{balance.used} used · {balance.included} included{balance.renewsAt ? ` · renews ${new Date(balance.renewsAt).toLocaleDateString()}` : ""}</small></div>
          ) : (
            <div className="imagery-locked"><LockKeyhole size={20} /><strong>Generate a coordinated image set</strong><p>Premium adds 50 monthly credits for course-safe AI imagery. Your own uploads remain available on every paid plan.</p><button className="secondary-button" type="button" onClick={() => { window.location.assign("/pricing"); }}>Compare plans</button></div>
          )}

          <fieldset disabled={!balance?.premium || working}>
            <legend>Image set</legend>
            {(["essential", "expanded", "custom"] as ImageGenerationSet[]).map((item) => <label key={item} className="imagery-radio"><input type="radio" name="image-set" checked={setType === item} onChange={() => setSetType(item)} /><span><strong>{item[0].toUpperCase() + item.slice(1)}</strong><small>{item === "essential" ? "Course card + homepage banner" : item === "expanded" ? "Essential + supporting image" : `Current ${IMAGE_PLACEMENT_SPECS[placement].label.toLowerCase()}`}</small></span></label>)}
          </fieldset>

          <fieldset disabled={!balance?.premium || working}>
            <legend>Quality</legend>
            {(["medium", "high"] as ImageQuality[]).map((item) => <label key={item} className="imagery-radio"><input type="radio" name="image-quality" checked={quality === item} onChange={() => setQuality(item)} /><span><strong>{item[0].toUpperCase() + item.slice(1)}</strong><small>{IMAGE_CREDIT_COST[item]} credit{IMAGE_CREDIT_COST[item] === 1 ? "" : "s"} per image</small></span></label>)}
          </fieldset>

          <label className="imagery-direction"><span>Visual direction</span><textarea rows={4} value={direction} disabled={!balance?.premium || working} onChange={(event) => setDirection(event.target.value)} placeholder="Warm documentary photography, hands-on science, natural light…" /></label>
          <button className="primary-button imagery-generate" type="button" disabled={!balance?.premium || working || (balance.remaining < generationCost)} onClick={() => void generate()}><Sparkles size={15} /> {working ? "Generating…" : `Generate set · ${generationCost} credits`}</button>
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
