// ============================================================================
// Source file parsing
// ----------------------------------------------------------------------------
// Extracts real text from instructor-uploaded sources in the browser so the
// content actually informs course generation (not just the file name).
//
//   • Plain text / Markdown / CSV / JSON  → read directly
//   • HTML / XML                          → tags stripped to readable text
//   • DOCX                                → unzipped (JSZip) and text extracted
//   • RTF                                 → control words stripped (best effort)
//   • PDF                                 → best-effort; many PDFs compress their
//                                           text streams, so when extraction is
//                                           unreliable we say so honestly rather
//                                           than pretend the content was read.
//
// The extracted text is capped per file and concatenated into a digest that is
// appended to the generation prompt.
// ============================================================================

import JSZip from "jszip";
import type { SourceFile, SourceParseStatus } from "../types";
import { decodeHtmlEntities, stripHtml } from "../utils/text";

const PREVIEW_LEN = 600;
/** Per-file cap on extracted text kept for prompt injection. */
const MAX_TEXT_PER_FILE = 20_000;
/** Total budget across all sources when building the prompt digest. */
const DEFAULT_DIGEST_BUDGET = 12_000;

export interface ParsedSource {
  status: SourceParseStatus;
  kind: string;
  text: string;
  chars: number;
  preview: string;
  note?: string;
}

const extOf = (name: string): string => {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
};

const tidy = (text: string): string =>
  decodeHtmlEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const previewOf = (text: string): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > PREVIEW_LEN ? `${clean.slice(0, PREVIEW_LEN)}…` : clean;
};

// Strip tags but preserve paragraph/line structure (unlike stripHtml, which collapses all space).
const htmlToText = (html: string): string =>
  tidy(
    html
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

const docxToText = async (file: File): Promise<string> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  return tidy(withBreaks.replace(/<[^>]+>/g, ""));
};

const rtfToText = (raw: string): string =>
  tidy(
    raw
      .replace(/\\par[d]?/g, "\n")
      .replace(/\\'[0-9a-fA-F]{2}/g, " ")
      .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
      .replace(/[{}]/g, "")
  );

// Best-effort PDF text: pull literal strings out of content streams. Works for uncompressed PDFs;
// many real-world PDFs FlateDecode their streams, so we measure how "word-like" the result is and
// downgrade to needs-review rather than emit garbage.
const pdfToText = (raw: string): { text: string; reliable: boolean } => {
  const strings: string[] = [];
  const re = /\(((?:\\.|[^()\\])*)\)\s*T[jJ]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    strings.push(match[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, " "));
  }
  const text = tidy(strings.join(" "));
  const words = text.split(/\s+/).filter((word) => /[A-Za-z]{3,}/.test(word));
  return { text, reliable: words.length >= 40 };
};

const TEXT_EXTS = new Set(["txt", "text", "md", "markdown", "csv", "tsv", "json", "log"]);
const HTML_EXTS = new Set(["html", "htm", "xml"]);

/** Parse a single uploaded file into extractable text + an honest status. */
export const parseSourceFile = async (file: File): Promise<ParsedSource> => {
  const kind = extOf(file.name) || (file.type.split("/")[1] ?? "file");
  try {
    // HTML/XML first — text/html also matches the generic text/* check below.
    if (HTML_EXTS.has(kind) || file.type === "text/html" || file.type === "application/xml") {
      const text = htmlToText(await file.text());
      return finalize("parsed", kind, text);
    }
    if (TEXT_EXTS.has(kind) || file.type.startsWith("text/")) {
      const text = tidy(await file.text());
      return finalize("parsed", kind, text);
    }
    if (kind === "docx") {
      const text = await docxToText(file);
      return text ? finalize("parsed", kind, text) : finalize("needs-review", kind, "", "This .docx had no readable document body. Paste key sections instead.");
    }
    if (kind === "rtf") {
      const text = rtfToText(await file.text());
      return finalize("parsed", kind, text);
    }
    if (kind === "pdf") {
      const raw = new TextDecoder("latin1").decode(await file.arrayBuffer());
      const { text, reliable } = pdfToText(raw);
      return reliable
        ? finalize("parsed", kind, text)
        : finalize(
            "needs-review",
            kind,
            text,
            "Couldn't reliably extract text from this PDF in the browser (its text is likely compressed). The file name is used as context — paste key passages for best results."
          );
    }
    if (kind === "doc") {
      return finalize("needs-review", kind, "", "Legacy .doc isn't parsed in the browser. Save as .docx or paste the text.");
    }
    // Last resort: try as text; if it looks binary, flag for review.
    const maybe = await file.text();
    const printableRatio = maybe ? maybe.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "").length / maybe.length : 0;
    if (maybe && printableRatio > 0.85) return finalize("parsed", kind, tidy(maybe));
    return finalize("needs-review", kind, "", "This file type isn't parsed in the browser. Paste the text to include it.");
  } catch (error) {
    return finalize("failed", kind, "", error instanceof Error ? error.message : "Could not read this file.");
  }
};

const finalize = (status: SourceParseStatus, kind: string, rawText: string, note?: string): ParsedSource => {
  const text = rawText.slice(0, MAX_TEXT_PER_FILE);
  return { status, kind, text, chars: text.length, preview: previewOf(text), note };
};

/** Concatenate parsed source text into a single, budgeted digest for prompt injection. */
export const buildSourcesDigest = (sources: SourceFile[], budget = DEFAULT_DIGEST_BUDGET): string => {
  const usable = sources.filter((source) => source.text && source.text.trim().length > 0);
  if (!usable.length) return "";
  let out = "";
  for (const source of usable) {
    const header = `\n\n--- Source: ${source.name} ---\n`;
    const remaining = budget - out.length - header.length;
    if (remaining <= 0) break;
    out += header + source.text!.slice(0, remaining);
  }
  return out.trim();
};

/** Append the source digest to a generation prompt so the content reflects the uploads. */
export const augmentPromptWithSources = (prompt: string, sources: SourceFile[]): string => {
  const digest = buildSourcesDigest(sources);
  if (!digest) return prompt;
  return `${prompt}\n\nThe instructor provided the following source materials. Use them to shape the course topics, terminology, structure, and emphasis where relevant:\n${digest}`;
};
