import { XMLValidator } from "fast-xml-parser";
import type JSZip from "jszip";
import { findInvalidXmlCharIndex } from "../utils/text";

/**
 * A single XML well-formedness failure, scoped to the exact package entry that
 * produced it so the export report can point at the file and parse error.
 */
export interface XmlParseError {
  /** Exact path of the offending file inside the .imscc package. */
  path: string;
  /** Human-readable description of the parse failure. */
  message: string;
  /** Error code: a fast-xml-parser code, or "InvalidChar" from the character scan. */
  code: string;
  /** 1-based line of the failure, when the parser/scan can locate it. */
  line?: number;
  /** 1-based column of the failure, when known. */
  col?: number;
}

/**
 * A package entry carries XML when its path uses an XML-bearing extension:
 *   - `.xml`  generated descriptors (manifest, course settings, QTI, meta, ...)
 *   - `.svg`  generated vector art (banner, tile)
 *   - `.qti`  the Canvas-flavored QTI dependency (`non_cc_assessments/<id>.xml.qti`)
 * HTML pages are intentionally excluded: their bodies are author HTML, not XML.
 */
export const isXmlPath = (path: string): boolean => /\.(xml|svg|qti)$/i.test(path);

const lineColAt = (content: string, index: number): { line: number; col: number } => {
  let line = 1;
  let col = 1;
  const stop = Math.min(index, content.length);
  for (let i = 0; i < stop; i += 1) {
    if (content[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
};

/**
 * Validate one XML document for well-formedness.
 *
 * fast-xml-parser's XMLValidator catches structural problems (mismatched/unclosed
 * tags, unescaped `&`, bad attribute syntax, a missing root). It does NOT reject the
 * control/surrogate/noncharacter code points XML 1.0 forbids, so we scan for those
 * first — Canvas's libxml2 importer rejects them and they would otherwise pass.
 *
 * Returns null when the document is well-formed, or an {@link XmlParseError} pinned
 * to `path`.
 */
export const validateXmlString = (path: string, content: string): XmlParseError | null => {
  const badCharIndex = findInvalidXmlCharIndex(content);
  if (badCharIndex !== -1) {
    const code = content.charCodeAt(badCharIndex).toString(16).toUpperCase().padStart(4, "0");
    const { line, col } = lineColAt(content, badCharIndex);
    return {
      path,
      message: `Invalid XML character U+${code} is not permitted in an XML 1.0 document.`,
      code: "InvalidChar",
      line,
      col
    };
  }

  const result = XMLValidator.validate(content, { allowBooleanAttributes: false });
  if (result === true) return null;
  return { path, message: result.err.msg, code: result.err.code, line: result.err.line, col: result.err.col };
};

/**
 * Parse every XML-bearing file in the package and return one {@link XmlParseError}
 * per malformed file, sorted by path. An empty array means all XML is well-formed.
 */
export const collectXmlParseErrors = async (zip: JSZip): Promise<XmlParseError[]> => {
  const paths = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir && isXmlPath(path))
    .sort();
  const errors: XmlParseError[] = [];
  for (const path of paths) {
    const file = zip.file(path);
    if (!file) continue;
    const content = await file.async("text");
    const error = validateXmlString(path, content);
    if (error) errors.push(error);
  }
  return errors;
};

/** Render an {@link XmlParseError} as a single report line with path and location. */
export const formatXmlParseError = (error: XmlParseError): string => {
  const location = error.line != null ? ` (line ${error.line}${error.col != null ? `, col ${error.col}` : ""})` : "";
  return `Malformed XML in ${error.path}: ${error.message}${location}`;
};
