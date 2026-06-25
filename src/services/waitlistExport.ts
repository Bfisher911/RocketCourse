// Pure waitlist export + segmentation. Turns waitlist entries into a CSV string or a real .xlsx
// workbook (OOXML, built with the JSZip dependency we already ship for .imscc export) and derives
// the marketing segments the Super Admin filters/exports by. No DOM or network here so it is fully
// unit-testable; the UI wraps the output in a Blob and triggers the download.

import JSZip from "jszip";

export interface WaitlistEntry {
  createdAt: string;
  status: string;
  pipelineStage?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email: string;
  consentToEmail?: boolean | null;
  institution?: string | null;
  role?: string | null;
  courseArea?: string | null;
  primaryUseCase?: string | null;
  painPoint?: string | null;
  wantsWebinarSeat?: boolean | null;
  referralCodeUsed?: string | null;
  assignedReferralCode?: string | null;
  assignedStripePromoCode?: string | null;
  discountCode?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referralSource?: string | null;
  landingPagePath?: string | null;
  adminNotes?: string | null;
}

/** Best display name: "First Last", falling back to the legacy single `name`, else "". */
export const fullName = (e: Pick<WaitlistEntry, "firstName" | "lastName" | "name">): string => {
  const joined = [e.firstName, e.lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
  return joined || (e.name ?? "").trim();
};

const yesNo = (v: boolean | null | undefined): string => (v ? "Yes" : "No");

// One column definition drives BOTH exporters so CSV and XLSX never drift. `consent_to_email` is
// included by design — downstream email tools must respect it.
type Column = { header: string; get: (e: WaitlistEntry) => string };
const COLUMNS: Column[] = [
  { header: "Created At", get: (e) => e.createdAt ?? "" },
  { header: "Status", get: (e) => e.status ?? "" },
  { header: "Pipeline Stage", get: (e) => e.pipelineStage ?? "" },
  { header: "First Name", get: (e) => e.firstName ?? "" },
  { header: "Last Name", get: (e) => e.lastName ?? "" },
  { header: "Email", get: (e) => e.email ?? "" },
  { header: "Email Consent", get: (e) => yesNo(e.consentToEmail) },
  { header: "Institution", get: (e) => e.institution ?? "" },
  { header: "Role", get: (e) => e.role ?? "" },
  { header: "Course Area", get: (e) => e.courseArea ?? "" },
  { header: "Primary Use Case", get: (e) => e.primaryUseCase ?? "" },
  { header: "Pain Point", get: (e) => e.painPoint ?? "" },
  { header: "Wants Webinar Seat", get: (e) => yesNo(e.wantsWebinarSeat) },
  { header: "Referral Code Used", get: (e) => e.referralCodeUsed ?? "" },
  { header: "Assigned Referral Code", get: (e) => e.assignedReferralCode ?? "" },
  { header: "Assigned Stripe Promo", get: (e) => e.assignedStripePromoCode ?? "" },
  { header: "Discount Code", get: (e) => e.discountCode ?? "" },
  { header: "UTM Source", get: (e) => e.utmSource ?? "" },
  { header: "UTM Medium", get: (e) => e.utmMedium ?? "" },
  { header: "UTM Campaign", get: (e) => e.utmCampaign ?? "" },
  { header: "UTM Content", get: (e) => e.utmContent ?? "" },
  { header: "UTM Term", get: (e) => e.utmTerm ?? "" },
  { header: "Referral Source", get: (e) => e.referralSource ?? "" },
  { header: "Landing Page", get: (e) => e.landingPagePath ?? "" },
  { header: "Admin Notes", get: (e) => e.adminNotes ?? "" }
];

export const WAITLIST_EXPORT_HEADERS: string[] = COLUMNS.map((c) => c.header);

// ──────────────────────────────────────────────────────────────────────────
// CSV (RFC 4180)
// ──────────────────────────────────────────────────────────────────────────
const csvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Build an RFC-4180 CSV (CRLF rows). A leading BOM keeps Excel UTF-8-happy. */
export const buildWaitlistCsv = (entries: WaitlistEntry[], { bom = true }: { bom?: boolean } = {}): string => {
  const lines = [WAITLIST_EXPORT_HEADERS.map(csvCell).join(",")];
  for (const e of entries) lines.push(COLUMNS.map((c) => csvCell(c.get(e))).join(","));
  return (bom ? "﻿" : "") + lines.join("\r\n");
};

// ──────────────────────────────────────────────────────────────────────────
// XLSX (minimal valid OOXML SpreadsheetML; inline strings, no shared table)
// ──────────────────────────────────────────────────────────────────────────
const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Strip control chars XML forbids (Excel rejects the file otherwise).
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

/** 0-based column index → spreadsheet column letters (0→A, 25→Z, 26→AA). */
export const columnLetter = (index: number): string => {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

const cellXml = (col: number, row: number, value: string): string =>
  `<c r="${columnLetter(col)}${row}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;

const rowXml = (cells: string[], row: number): string =>
  `<row r="${row}">${cells.map((v, i) => cellXml(i, row, v)).join("")}</row>`;

const sheetXml = (entries: WaitlistEntry[]): string => {
  const rows = [rowXml(WAITLIST_EXPORT_HEADERS, 1)];
  entries.forEach((e, i) => rows.push(rowXml(COLUMNS.map((c) => c.get(e)), i + 2)));
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows.join("")}</sheetData></worksheet>`
  );
};

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Waitlist" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
  `</styleSheet>`;

/** Build a real .xlsx workbook as bytes. The UI wraps these in a Blob to download. */
export const buildWaitlistXlsx = (entries: WaitlistEntry[]): Promise<Uint8Array> => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", ROOT_RELS);
  const xl = zip.folder("xl")!;
  xl.file("workbook.xml", WORKBOOK);
  xl.file("styles.xml", STYLES);
  xl.folder("_rels")!.file("workbook.xml.rels", WORKBOOK_RELS);
  xl.folder("worksheets")!.file("sheet1.xml", sheetXml(entries));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};

// ──────────────────────────────────────────────────────────────────────────
// Segments — marketing audiences derived from the entry data
// ──────────────────────────────────────────────────────────────────────────
export type WaitlistSegment =
  | "all"
  | "webinar"
  | "instructors"
  | "designers"
  | "buyers"
  | "high_intent"
  | "referral";

const has = (v: string | null | undefined): boolean => Boolean((v ?? "").trim());
const roleText = (e: WaitlistEntry): string => `${e.role ?? ""} ${e.primaryUseCase ?? ""}`.toLowerCase();

const isInstructor = (e: WaitlistEntry): boolean => /instructor|faculty|professor|teacher|lecturer|adjunct/.test(roleText(e));
const isDesigner = (e: WaitlistEntry): boolean =>
  /instructional design|learning design|^id\b|\bid\b|designer|curriculum|learning experience|\blxd\b/.test(roleText(e));
const isBuyer = (e: WaitlistEntry): boolean =>
  /director|dean|chair|provost|department|admin|manager|coordinator|head of|vp|vice president|cio|principal/.test(roleText(e));
const isReferral = (e: WaitlistEntry): boolean => has(e.referralCodeUsed);
const isHighIntent = (e: WaitlistEntry): boolean =>
  Boolean(e.wantsWebinarSeat) ||
  has(e.painPoint) ||
  has(e.referralCodeUsed) ||
  e.pipelineStage === "invited" ||
  e.pipelineStage === "converted" ||
  e.status === "converted";

export const SEGMENTS: Record<WaitlistSegment, { label: string; match: (e: WaitlistEntry) => boolean }> = {
  all: { label: "All waitlist", match: () => true },
  webinar: { label: "Webinar RSVPs", match: (e) => Boolean(e.wantsWebinarSeat) },
  instructors: { label: "Instructors", match: isInstructor },
  designers: { label: "Instructional designers", match: isDesigner },
  buyers: { label: "Department / admin buyers", match: isBuyer },
  high_intent: { label: "High-intent", match: isHighIntent },
  referral: { label: "Referral signups", match: isReferral }
};

/** Entries belonging to a segment. Generic so callers keep their richer row type. */
export const filterSegment = <T extends WaitlistEntry>(entries: T[], segment: WaitlistSegment): T[] =>
  entries.filter(SEGMENTS[segment].match);

/** Count of entries in every segment — drives the Super Admin segment chips. */
export const segmentCounts = (entries: WaitlistEntry[]): Record<WaitlistSegment, number> => {
  const out = {} as Record<WaitlistSegment, number>;
  (Object.keys(SEGMENTS) as WaitlistSegment[]).forEach((seg) => {
    out[seg] = entries.reduce((n, e) => n + (SEGMENTS[seg].match(e) ? 1 : 0), 0);
  });
  return out;
};

/** A filename-safe stamp like "founding-cohort_webinar_2026-06-25". */
export const exportFileBase = (slug: string | null, segment: WaitlistSegment, isoDate: string): string => {
  const day = (isoDate || "").slice(0, 10) || "export";
  const safeSlug = (slug ?? "waitlist").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${safeSlug}_${segment}_${day}`;
};
