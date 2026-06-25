import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildWaitlistCsv,
  buildWaitlistXlsx,
  columnLetter,
  exportFileBase,
  filterSegment,
  fullName,
  segmentCounts,
  WAITLIST_EXPORT_HEADERS,
  type WaitlistEntry
} from "./waitlistExport";

const entry = (over: Partial<WaitlistEntry>): WaitlistEntry => ({
  createdAt: "2026-06-25T10:00:00.000Z",
  status: "approved",
  email: "person@uni.edu",
  ...over
});

const SAMPLE: WaitlistEntry[] = [
  entry({
    firstName: "Pat",
    lastName: "Lee",
    email: "pat@uni.edu",
    role: "Instructor",
    consentToEmail: true,
    wantsWebinarSeat: true,
    painPoint: "No time to build Canvas shells",
    referralCodeUsed: "RC-ABCDEF"
  }),
  entry({
    firstName: "Dana",
    lastName: "Cruz",
    email: "dana@college.edu",
    role: "Instructional Designer",
    consentToEmail: false
  }),
  entry({ firstName: "Sam", lastName: "Ng", email: "sam@school.edu", role: "Department Chair" })
];

describe("fullName", () => {
  it("joins first + last, falling back to legacy name", () => {
    expect(fullName({ firstName: "Pat", lastName: "Lee" })).toBe("Pat Lee");
    expect(fullName({ firstName: "Pat", lastName: null })).toBe("Pat");
    expect(fullName({ name: "Legacy Person" })).toBe("Legacy Person");
    expect(fullName({})).toBe("");
  });
});

describe("buildWaitlistCsv", () => {
  it("emits a header row including email consent", () => {
    const csv = buildWaitlistCsv(SAMPLE, { bom: false });
    const [header] = csv.split("\r\n");
    expect(header).toBe(WAITLIST_EXPORT_HEADERS.join(","));
    expect(header).toContain("Email Consent");
  });

  it("writes one row per entry with Yes/No booleans", () => {
    const csv = buildWaitlistCsv(SAMPLE, { bom: false });
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(1 + SAMPLE.length);
    expect(rows[1]).toContain("pat@uni.edu");
    expect(rows[1]).toContain("Yes"); // consent + webinar seat
    expect(rows[2]).toContain("dana@college.edu");
  });

  it("RFC-4180 quotes cells containing commas, quotes, or newlines", () => {
    const csv = buildWaitlistCsv([entry({ painPoint: 'Hard to say "done", really\nyet' })], { bom: false });
    expect(csv).toContain('"Hard to say ""done"", really\nyet"');
  });

  it("prepends a UTF-8 BOM by default", () => {
    expect(buildWaitlistCsv(SAMPLE).charCodeAt(0)).toBe(0xfeff);
    expect(buildWaitlistCsv(SAMPLE, { bom: false }).charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe("columnLetter", () => {
  it("maps indices to spreadsheet columns", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
  });
});

describe("buildWaitlistXlsx", () => {
  it("produces a valid OOXML package readable by JSZip", async () => {
    const bytes = await buildWaitlistXlsx(SAMPLE);
    expect(bytes.byteLength).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("xl/workbook.xml")).toBeTruthy();
    expect(zip.file("xl/worksheets/sheet1.xml")).toBeTruthy();

    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain("Email Consent"); // header
    expect(sheet).toContain("pat@uni.edu"); // data
    // 1 header row + 3 data rows.
    expect((sheet.match(/<row /g) ?? [])).toHaveLength(4);
  });

  it("escapes XML-hostile characters in cell values", async () => {
    const bytes = await buildWaitlistXlsx([entry({ institution: "A & B <Co>" })]);
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain("A &amp; B &lt;Co&gt;");
    expect(sheet).not.toContain("A & B <Co>");
  });
});

describe("segments", () => {
  it("classifies instructors, designers, and buyers by role", () => {
    expect(filterSegment(SAMPLE, "instructors").map((e) => e.email)).toEqual(["pat@uni.edu"]);
    expect(filterSegment(SAMPLE, "designers").map((e) => e.email)).toEqual(["dana@college.edu"]);
    expect(filterSegment(SAMPLE, "buyers").map((e) => e.email)).toEqual(["sam@school.edu"]);
  });

  it("captures webinar RSVPs, referral signups, and high-intent", () => {
    expect(filterSegment(SAMPLE, "webinar").map((e) => e.email)).toEqual(["pat@uni.edu"]);
    expect(filterSegment(SAMPLE, "referral").map((e) => e.email)).toEqual(["pat@uni.edu"]);
    expect(filterSegment(SAMPLE, "high_intent").map((e) => e.email)).toEqual(["pat@uni.edu"]);
  });

  it("counts every segment, with all = total", () => {
    const counts = segmentCounts(SAMPLE);
    expect(counts.all).toBe(3);
    expect(counts.webinar).toBe(1);
    expect(counts.instructors).toBe(1);
  });
});

describe("exportFileBase", () => {
  it("builds a filename-safe base with slug, segment, and date", () => {
    expect(exportFileBase("founding-cohort", "webinar", "2026-06-25T10:00:00Z")).toBe(
      "founding-cohort_webinar_2026-06-25"
    );
    expect(exportFileBase(null, "all", "")).toBe("waitlist_all_export");
  });
});
