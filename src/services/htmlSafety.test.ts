import { describe, expect, it } from "vitest";
import { headingOrderIssues, normalizeHeadingOrder, htmlSafetyIssues, imageTagsMissingAltCount, malformedLinksFromHtml, hasUnsafeHtml, prepareStudentFacingHtmlForCanvas, sanitizeAiHtml, sanitizeHtmlForPreview, stripStudentFacingAuthoringNotes, unsafeHtmlDetail, unsafeHtmlReasons } from "./htmlSafety";
import { hrefsFromHtml } from "./htmlSafety";

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

  it("removes authoring metadata from student content and demotes the duplicate Canvas H1", () => {
    const html = '<h1>Assignment title</h1><p>Student directions.</p><p><strong>Instructor Notes:</strong> Replace this example.</p><section><h2>Validation Warnings</h2><p>Internal model gap.</p></section>';

    expect(stripStudentFacingAuthoringNotes(html)).not.toMatch(/Instructor Notes|Validation Warnings|Internal model gap/i);
    expect(prepareStudentFacingHtmlForCanvas(html)).toContain("<h2>Assignment title</h2>");
    expect(prepareStudentFacingHtmlForCanvas(html)).toContain("Student directions");
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

  it("normalizeHeadingOrder clamps skipped heading levels", () => {
    expect(normalizeHeadingOrder("<h1>Title</h1><h3>Jump</h3><p>x</p><h3>Fine now</h3>"))
      .toBe("<h1>Title</h1><h2>Jump</h2><p>x</p><h3>Fine now</h3>");
    expect(normalizeHeadingOrder('<h1>Title</h1><h4 class="x">Deep</h4>'))
      .toBe('<h1>Title</h1><h2 class="x">Deep</h2>');
    // Already-clean sequences pass through untouched.
    const clean = "<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>";
    expect(normalizeHeadingOrder(clean)).toBe(clean);
  });

  it("sanitizeAiHtml output passes the heading-order validator", () => {
    const aiHtml = "<h1>Welcome</h1><h3>Getting started</h3><p>Body</p><h3>Support</h3>";
    expect(headingOrderIssues(sanitizeAiHtml(aiHtml))).toEqual([]);
  });

  it("summarizes practical HTML safety issues", () => {
    const issues = htmlSafetyIssues('<h1>Ok</h1><h3>Jump</h3><img src="x"><a href="www.example.com">bad</a>');

    expect(issues.map((issue) => issue.label)).toEqual(expect.arrayContaining(["Heading order issue", "Image alt text missing", "Malformed link"]));
  });

  it("strips hrefs Canvas cannot resolve after import, keeping the anchor text", () => {
    const dirty =
      "<a href='modules/module_start'>Start Here</a>" +
      "<a href='{{link_to_start_here}}'>Intro</a>" +
      "<a href='syllabus'>View Syllabus</a>" +
      '<a href="$CANVAS_OBJECT_REFERENCE$/discussion_topics/discussion_1">Discussion</a>' +
      '<a href="../web_resources/syllabus-printable.pdf">PDF</a>' +
      '<a href="wiki_content/week-1-overview.html">Week 1</a>' +
      '<a href="https://ok.org">External</a>' +
      '<a href="mailto:prof@example.edu">Email</a>';
    const clean = sanitizeAiHtml(dirty);

    const hrefs = hrefsFromHtml(clean);
    expect(hrefs).toEqual([
      "$CANVAS_OBJECT_REFERENCE$/discussion_topics/discussion_1",
      "../web_resources/syllabus-printable.pdf",
      "wiki_content/week-1-overview.html",
      "https://ok.org",
      "mailto:prof@example.edu"
    ]);
    // Words survive even when their dead links do not.
    expect(clean).toContain("Start Here");
    expect(clean).toContain("Intro");
    expect(clean).toContain("View Syllabus");
  });

  it("sanitizeAiHtml makes model HTML safe to store and export", () => {
    const dirty =
      '<p onclick="x()">Hi</p><script>bad()</script><iframe src="z"></iframe><a href="#">dead</a><a href="">empty</a><a href="https://ok.org">real</a><p style="color:red">keep</p>';
    const clean = sanitizeAiHtml(dirty);

    // No Canvas-hostile constructs, and no placeholder/empty links remain (export-blocking).
    expect(unsafeHtmlReasons(clean)).toEqual([]);
    expect(hrefsFromHtml(clean)).toEqual(["https://ok.org"]);
    // Anchor text and inline styles are preserved.
    expect(clean).toContain("dead");
    expect(clean).toContain('style="color:red"');
  });
});
