# Canvas export audit

Working record of the August 2026 audit of a live RocketCourse export in Canvas, plus the tooling
used to measure it.

- **`FINDINGS.md`** — the audit itself: what was wrong, what was fixed, what was refuted, and what
  is still open. Findings are tagged VERIFIED / REPORTED / REFUTED so nobody re-litigates a claim
  that was already checked and found untrue.
- **`a11y_audit.py`** — offline WCAG 2.1 AA audit of exported course HTML.

## Why an offline accessibility checker

Course HTML is styled entirely with inline `style=` attributes and carries no stylesheet, so an
ancestor-walking resolver reproduces the browser's computed values faithfully — text colour from the
nearest ancestor that sets `color`, background from the nearest that sets an opaque one. That is
what makes the offline check trustworthy here; it would not be on a page with a real stylesheet.

```sh
python3 docs/canvas-audit/a11y_audit.py <dump_dir> --json out.json
```

`<dump_dir>` is a Canvas course captured through the API into the layout the script expects
(`pages_index.json`, `pages/*.html`, `syllabus_body.html`, `assignments.json`, `discussions.json`,
`announcements.json`).

## What became product code

The contrast logic is no longer only a script. `contrastIssuesFromHtml` in
`src/services/htmlSafety.ts` is the same idea inside the product, wired in as the `content-contrast`
readiness check. It handles two things the first version got wrong, both caught by cross-checking
the TypeScript against the Python rather than trusting either alone:

- **CSS named colours.** `color: white` on a coloured button is the most common shape in
  model-authored HTML. Treating it as unparseable made the scanner inherit the ancestor's colour and
  *hide* the failures it existed to find.
- **Translucent layers.** `rgba(255,255,255,0.7)` on a dark panel renders as a real, measurable
  grey. Discarding the alpha produced a foreground/background pair that never appears on screen.

Several other checks from the original throwaway harness also became readiness checks:
`dead-anchors`, `announcement-distinctness`, `due-dates-decided`, and the blocking
`short-answer-key` validator in `quizBuilder.ts`.

## Related

`fixtures/canvas-export-reference/` holds structural XML from a real Canvas export, including the
`files_meta.xml` that settled how to lock instructor-only files.
