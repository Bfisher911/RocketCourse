import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import { defaultImageCrop, packagePathForImage } from "./courseImagery";
import type { CourseImageAsset, CourseProject } from "../types";

const TINY_JPEG = "data:image/jpeg;base64,/9j/2Q==";
const makeAsset = (patch: Partial<CourseImageAsset> = {}): CourseImageAsset => ({
  id: "abcd1234-aaaa-bbbb-cccc-123456789abc",
  placement: "homepage-banner",
  source: "upload",
  status: "ready",
  version: 1,
  fileName: "homepage.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 400,
  byteSize: 4,
  altText: "Abstract course banner in blue and violet.",
  decorative: false,
  crop: defaultImageCrop(),
  dataUrl: TINY_JPEG,
  createdAt: "2026-07-20T12:00:00.000Z",
  ...patch
});

describe("IMSCC course imagery", () => {
  it("embeds the selected derivative, declares it in the manifest, and rewrites the homepage file token", async () => {
    const banner = makeAsset();
    const course: CourseProject = { ...sampleProject, imageAssets: [banner] };
    const zip = await buildImsccZip(course);
    const path = packagePathForImage(banner);
    expect(zip.file(path)).toBeTruthy();
    expect(await zip.file("imsmanifest.xml")?.async("text")).toContain(path);
    const homepage = course.pages.find((page) => page.frontPage);
    expect(homepage).toBeTruthy();
    const exported = await zip.file(`wiki_content/${homepage?.slug}.html`)?.async("text");
    expect(exported).toContain(`$IMS-CC-FILEBASE$/${path.replace("web_resources/", "")}`);
  });

  it("blocks export when the active image has no alt text or decorative decision", async () => {
    const course: CourseProject = { ...sampleProject, imageAssets: [makeAsset({ altText: "" })] };
    const zip = await buildImsccZip(course);
    const report = await validateImsccZip(course, zip);
    expect(report.issues.some((issue) => issue.id.includes("missing-course-image-alt"))).toBe(true);
  });

  it("exports only the latest ready version for a placement", async () => {
    const old = makeAsset({ id: "old00000-aaaa-bbbb-cccc-123456789abc", version: 1 });
    const current = makeAsset({ id: "new00000-aaaa-bbbb-cccc-123456789abc", version: 2 });
    const course: CourseProject = { ...sampleProject, imageAssets: [old, current] };
    const zip = await buildImsccZip(course);
    expect(zip.file(packagePathForImage(old))).toBeNull();
    expect(zip.file(packagePathForImage(current))).toBeTruthy();
  });

  it("keeps legacy courses with no imagery exportable using generated SVG fallbacks", async () => {
    const course: CourseProject = { ...sampleProject, imageAssets: undefined };
    const zip = await buildImsccZip(course);
    expect(zip.file("web_resources/course-banner.svg")).toBeTruthy();
    expect(zip.file("web_resources/course-tile.svg")).toBeTruthy();
  });
});
