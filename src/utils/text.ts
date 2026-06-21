export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "course-item";

// XML 1.0 (§2.2) permits Char ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] |
// [#x10000-#x10FFFF]. Everything else — C0 controls other than tab/LF/CR, the U+FFFE/U+FFFF
// noncharacters, and unpaired UTF-16 surrogates — is forbidden even when entity-escaped, and
// Canvas's libxml2-based importer rejects a package that contains it. We strip these before
// serialising (escapeXml) and flag them when validating generated XML.
const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;
const isForbiddenXmlScalar = (code: number): boolean =>
  code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0xfffe || code === 0xffff;

// Index of the first character XML 1.0 forbids, or -1 when the string is clean.
// charCodeAt past the end returns NaN, so an unpaired trailing high surrogate is caught here.
export const findInvalidXmlCharIndex = (value: string): number => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (isHighSurrogate(code)) {
      if (!isLowSurrogate(value.charCodeAt(i + 1))) return i;
      i += 1; // valid astral pair; skip its low half
      continue;
    }
    if (isLowSurrogate(code) || isForbiddenXmlScalar(code)) return i;
  }
  return -1;
};

// Remove every character XML 1.0 forbids so generated descriptors stay well-formed. Valid
// astral pairs (e.g. emoji) are preserved; only the unpaired surrogate halves are dropped.
export const stripInvalidXmlChars = (value: string): string => {
  if (findInvalidXmlCharIndex(value) === -1) return value;
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (isHighSurrogate(code)) {
      if (isLowSurrogate(value.charCodeAt(i + 1))) {
        out += value[i] + value[i + 1];
        i += 1;
      }
      continue; // drop an unpaired high surrogate
    }
    if (isLowSurrogate(code) || isForbiddenXmlScalar(code)) continue;
    out += value[i];
  }
  return out;
};

export const escapeXml = (value: string | number | undefined | null): string =>
  stripInvalidXmlChars(String(value ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export const stripHtml = (html: string): string =>
  decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const nowIso = (): string => new Date().toISOString();
