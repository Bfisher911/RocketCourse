import type { CourseImagePlacement } from "../../../src/types";
import { buildImagePrompt, type ImageQuality } from "../../../src/services/courseImagery";

declare const process: { env: Record<string, string | undefined> };

export interface ImageProviderRequest {
  courseTitle: string;
  courseDescription: string;
  placement: CourseImagePlacement;
  visualDirection: string;
  quality: ImageQuality;
  requestId: string;
}

export interface ImageProviderResult {
  base64: string;
  mimeType: "image/jpeg";
  provider: "openai";
  model: string;
  providerRequestId: string | null;
  prompt: string;
  estimatedCostUsd: number;
}

export interface ImageProvider {
  generate(input: ImageProviderRequest): Promise<ImageProviderResult>;
}

const MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const PROVIDER_SIZE: Record<CourseImagePlacement, string> = {
  "course-card": "1200x672",
  "homepage-banner": "1536x512",
  supporting: "1200x672"
};
const LANDSCAPE_COST_USD: Record<ImageQuality, number> = { medium: 0.041, high: 0.165 };

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryableStatus = (status: number): boolean => status === 429 || status >= 500;

export class OpenAiImageProvider implements ImageProvider {
  async generate(input: ImageProviderRequest): Promise<ImageProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("Image generation is not configured (OPENAI_API_KEY missing).");
    const prompt = buildImagePrompt(
      { title: input.courseTitle, description: input.courseDescription },
      input.placement,
      input.visualDirection
    );

    let lastError = "OpenAI image generation failed.";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        const response = await fetch(OPENAI_IMAGE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Client-Request-Id": input.requestId
          },
          body: JSON.stringify({
            model: MODEL,
            prompt,
            n: 1,
            size: PROVIDER_SIZE[input.placement],
            quality: input.quality,
            output_format: "jpeg",
            output_compression: 88,
            moderation: "auto"
          }),
          signal: controller.signal
        });
        const payload = (await response.json()) as {
          data?: Array<{ b64_json?: string }>;
          error?: { message?: string; code?: string };
        };
        if (!response.ok) {
          lastError = payload.error?.code === "moderation_blocked"
            ? "The image request was blocked by provider safety checks. Adjust the visual direction; no credits were used."
            : (payload.error?.message ?? `OpenAI image request failed (${response.status}).`);
          if (payload.error?.code === "moderation_blocked" || !retryableStatus(response.status) || attempt === 2) {
            throw new Error(lastError);
          }
          await wait(500 * 2 ** attempt);
          continue;
        }
        const base64 = payload.data?.[0]?.b64_json;
        if (!base64) throw new Error("The image provider returned no image data.");
        return {
          base64,
          mimeType: "image/jpeg",
          provider: "openai",
          model: MODEL,
          providerRequestId: response.headers.get("x-request-id"),
          prompt,
          estimatedCostUsd: LANDSCAPE_COST_USD[input.quality]
        };
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") lastError = "Image generation timed out. No credits were used.";
        else if (cause instanceof Error) lastError = cause.message;
        if (attempt === 2 || /blocked|not configured|no image data/i.test(lastError)) throw new Error(lastError);
        await wait(500 * 2 ** attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(lastError);
  }
}

export const getImageProvider = (): ImageProvider => new OpenAiImageProvider();
