import { describe, expect, it } from "vitest";
import { validateRevisionCandidate } from "./revisionGuard";

describe("validateRevisionCandidate", () => {
  it("accepts a normal HTML revision", () => {
    expect(validateRevisionCandidate("<p>This is a clear, complete revision of the page.</p>").ok).toBe(true);
  });

  it("rejects empty or whitespace-only output", () => {
    expect(validateRevisionCandidate("").ok).toBe(false);
    expect(validateRevisionCandidate("   \n  ").ok).toBe(false);
    expect(validateRevisionCandidate("<p></p>").ok).toBe(false);
  });

  it("rejects output with almost no readable text", () => {
    expect(validateRevisionCandidate("<div><span> </span></div>").ok).toBe(false);
  });

  it("rejects Canvas-unsafe HTML (e.g. a script tag) and explains why", () => {
    const r = validateRevisionCandidate('<p>ok</p><script>alert(1)</script><p>more content here</p>');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unsafe/i);
  });

  it("keeps the previous-content promise in its messages", () => {
    expect(validateRevisionCandidate("").reason).toMatch(/previous content was kept/i);
  });
});
