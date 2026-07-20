import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiImageProvider } from "./imageProvider";

describe("OpenAI image provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("keeps the API key server-side and returns request telemetry", async () => {
    process.env.OPENAI_API_KEY = "test-server-key";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-server-key", "X-Client-Request-Id": "request-1" });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe("gpt-image-2");
      expect(body.size).toBe("1536x512");
      expect(body.output_format).toBe("jpeg");
      return new Response(JSON.stringify({ data: [{ b64_json: "ZmFrZS1pbWFnZQ==" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-request-id": "openai-request-9" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiImageProvider().generate({
      courseTitle: "Biology",
      courseDescription: "Cells and systems",
      placement: "homepage-banner",
      visualDirection: "Natural light",
      quality: "medium",
      requestId: "request-1"
    });
    expect(result.providerRequestId).toBe("openai-request-9");
    expect(result.estimatedCostUsd).toBe(0.041);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry moderation blocks", async () => {
    process.env.OPENAI_API_KEY = "test-server-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: "moderation_blocked", message: "blocked" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new OpenAiImageProvider().generate({
      courseTitle: "Course",
      courseDescription: "",
      placement: "course-card",
      visualDirection: "",
      quality: "high",
      requestId: "request-2"
    })).rejects.toThrow(/blocked by provider safety checks/i);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
