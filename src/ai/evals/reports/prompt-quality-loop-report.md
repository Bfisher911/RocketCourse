# RocketCourse Prompt Quality Loop Report

## Scope

This report documents the first prompt-template quality loop for RocketCourse. The implementation creates versioned prompt templates, fixture inputs, a deterministic evaluation harness, and a rubric that can later compare saved server-side AI outputs.

## Passes Represented

1. Pass 1 baseline prompt system: structured contracts and required fields.
2. Pass 2 completeness improvement: full Canvas course component coverage.
3. Pass 3 specificity improvement: discipline-specific examples, scenarios, vocabulary, and anti-generic constraints.
4. Pass 4 alignment improvement: outcomes, modules, assessments, rubrics, gradebook, and workload alignment.
5. Pass 5 Canvas-readiness and editability improvement: Canvas-safe HTML, placeholders, accessibility, and human-review notes.
6. Pass 6 regression and rollback readiness: stable ids, comparison, rollback targets, and schema-drift controls.

## Fixtures

The fixture set covers humanities, STEM, health and emergency management, business, social science, professional skills, online asynchronous faculty development, and hybrid geospatial applications.

## Current Provider

The eval harness uses `deterministic-baseline` by default. It does not make AI calls in the browser. The future provider should call a server endpoint, persist outputs by prompt template id, and feed saved outputs back into the same rubric.

## Human Review Required

Human review is still required for policy language, verified resources, Canvas sandbox import compatibility, course-specific accuracy, accessibility details beyond static checks, and any claims tied to accreditation or local institutional requirements.
