import { describe, it, expect } from "vitest";
import { ROUTES, pathToScreen, screenToPath, routeForPath } from "./seo";

describe("seo routing", () => {
  it("maps marketing paths to screens and back", () => {
    expect(pathToScreen("/")).toBe("landing");
    expect(pathToScreen("/about")).toBe("about");
    expect(pathToScreen("/pricing/")).toBe("pricing");
    expect(screenToPath("about")).toBe("/about");
    expect(screenToPath("landing")).toBe("/");
  });

  it("routes the whole /integration family to the integration screen", () => {
    expect(pathToScreen("/integration")).toBe("integration");
    expect(pathToScreen("/integration/canvas")).toBe("integration");
    expect(pathToScreen("/integration/unknown-lms")).toBe("integration"); // graceful
    expect(screenToPath("integration")).toBe("/integration");
  });

  it("resolves per-page meta by path for integration sub-pages", () => {
    const canvas = routeForPath("/integration/canvas");
    expect(canvas?.title).toMatch(/Canvas Course Builder/);
    expect(canvas?.index).toBe(true);

    const integrationRoutes = ROUTES.filter((route) => route.screen === "integration");
    expect(integrationRoutes.length).toBeGreaterThanOrEqual(9);
    // every integration route is indexable with a unique title
    expect(new Set(integrationRoutes.map((route) => route.title)).size).toBe(integrationRoutes.length);
    integrationRoutes.forEach((route) => expect(route.index).toBe(true));
  });

  it("falls back safely for app/unknown paths", () => {
    expect(pathToScreen("/app")).toBe("landing");
    expect(pathToScreen("/nonsense")).toBe("landing");
  });
});
