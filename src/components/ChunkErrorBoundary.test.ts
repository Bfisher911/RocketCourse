import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./ChunkErrorBoundary";

describe("isChunkLoadError", () => {
  it("detects the real browser messages for a failed dynamic import", () => {
    // Chrome / Edge
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://x/assets/a.js"))).toBe(true);
    // Safari
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    // Firefox
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    // webpack-style name
    const named = new Error("boom");
    named.name = "ChunkLoadError";
    expect(isChunkLoadError(named)).toBe(true);
  });

  it("detects the SPA-catch-all case where index.html is parsed as JS", () => {
    // netlify.toml serves /* -> /index.html 200, so a missing chunk returns HTML
    // with a 200 and the browser chokes on the leading '<'.
    expect(isChunkLoadError(new SyntaxError("Unexpected token '<'"))).toBe(true);
  });

  it("does not misclassify ordinary render errors", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(new Error("Rendered fewer hooks than expected"))).toBe(false);
  });

  it("handles non-Error throws without crashing", () => {
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
