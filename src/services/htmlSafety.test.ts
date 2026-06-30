import { describe, expect, it } from "vitest";
import { headingOrderIssues, htmlSafetyIssues, imageTagsMissingAltCount, malformedLinksFromHtml, hasUnsafeHtml, sanitizeHtmlForPreview, unsafeHtmlDetail, unsafeHtmlReasons } from "./htmlSafety";

describe("html safety (shared Canvas HTML safety)", () => {
  it("treats clean instructional HTML as safe", () => {
    const html = '<h1>Module</h1><p>Read the <a href="syllabus.html">syllabus</a>.</p><img src="x.png" alt="diagram">';
    expect(hasUnsafeHtml(html)).toBe(false);
    expect(unsafeHtmlReasons(html)).toEqual([]);
    expect(unsafeHtmlDetail(html, "page")).toBeNull();
  });

  it("does not flag inline style= attributes (Canvas keeps them)", () => {
    expect(hasUnsafeHtml('<div style="border-left:6px solid #06c;padding:12px">Themed callout</div>')).toBe(false);
  });

  it("flags the full hardened set with specific, named reasons", () => {
    const cases: Array<[string, string]> = [
      ["<script>alert(1)</script>", "script tags"],
      ['<p onclick="x()">x</p>', "inline event handlers"],
      ['<a href="javascript:alert(1)">x</a>', "javascript:/vbscript: URLs"],
      ['<a href="vbscript:msgbox(1)">x</a>', "javascript:/vbscript: URLs"],
      ['<a href="data:text/html,<b>x</b>">x</a>', "data:text/html URLs"],
      ["<style>h1{color:red}</style>", "style blocks (Canvas strips these)"],
      ['<link rel="stylesheet" href="x.css">', "link elements (Canvas strips these)"],
      ['<meta http-equiv="refresh" content="0">', "meta elements"],
      ['<base href="https://x">', "base elements"],
      ['<iframe src="https://x"></iframe>', "frames"],
      ["<frameset><frame></frameset>", "frames"],
      ['<object data="x.swf"></object>', "embedded objects"],
      ["<form><input name='x'></form>", "form controls"],
      ["<select><option>x</option></select>", "form controls"],
      ["<marquee>scroll</marquee>", "marquee elements"]
    ];
    cases.forEach(([html, label]) => {
      expect(unsafeHtmlReasons(html), html).toContain(label);
      expect(hasUnsafeHtml(html), html).toBe(true);
    });
  });

  it("catches whitespace-padded tag evasions the simple detectors missed", () => {
    expect(hasUnsafeHtml("< script >alert(1)</script>")).toBe(true);
    expect(hasUnsafeHtml("<\tstyle >h1{}")).toBe(true);
  });

  it("builds a subject-specific detail string naming every construct found", () => {
    const detail = unsafeHtmlDetail("<script>x</script><style>y{}</style>", "assignment");
    expect(detail).toContain("script tags");
    expect(detail).toContain("style blocks");
    expect(detail).toContain("assignment");
  });

  it("sanitizes preview HTML to mirror what Canvas renders after import", () => {
    const dirty =
      '<h1>Hi</h1><style>h1{color:red}</style><iframe src="x"></iframe>' +
      '<a href="javascript:alert(1)">x</a><img src="data:text/html,<b>x</b>" alt="x">' +
      '<p onclick="x()">ok</p><form><input name="y"></form>';
    const clean = sanitizeHtmlForPreview(dirty);

    expect(clean).not.toMatch(/<style|<iframe|<form|<input|onclick=|javascript:|data:text\/html/i);
    expect(clean).toContain("Hi");
    expect(clean).toContain("ok");
  });

  it("flags malformed links without treating every relative Canvas link as bad", () => {
    const html = '<a href="www.example.com">bad</a><a href="http:/broken">bad</a><a href="module-1.html">ok</a><a href="$WIKI_REFERENCE$/pages/page_homepage">ok</a>';

    expect(malformedLinksFromHtml(html)).toEqual(["www.example.com", "http:/broken"]);
  });

  it("counts images missing useful alt text unless marked decorative", () => {
    const html = '<img src="x.svg"><img src="y.svg" alt=""><img src="z.svg" alt="" role="presentation"><img src="ok.svg" alt="Course badge">';

    expect(imageTagsMissingAltCount(html)).toBe(2);
  });

  it("reports practical heading order issues", () => {
    expect(headingOrderIssues("<h2>Starts too low</h2><h4>Jump</h4>")).toEqual(["First heading is h2, not h1.", "Heading jumps from h2 to h4."]);
  });

  it("summarizes practical HTML safety issues", () => {
    const issues = htmlSafetyIssues('<h1>Ok</h1><h3>Jump</h3><img src="x"><a href="www.example.com">bad</a>');

    expect(issues.map((issue) => issue.label)).toEqual(expect.arrayContaining(["Heading order issue", "Image alt text missing", "Malformed link"]));
  });
});
