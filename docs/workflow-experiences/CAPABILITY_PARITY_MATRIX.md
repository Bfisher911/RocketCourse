# Capability Parity Matrix (Phase 1)

> Guarantees that **no required capability disappears** in any of the nine experiences. An
> experience may surface a capability differently, but may not drop it. This matrix is the
> contract the Workflow Host and each experience adapter must satisfy.
>
> **Status of this document:** foundation slice. The eight non-legacy experiences are currently
> the verified prototypes sharing one course model (the `session` seam in
> `src/workflows/prototypes/shared/blocks.js`); the next slice replaces that seam with an adapter
> over the real `CourseProject` and wires the Original (W01) experience to the live editor.

**Visibility codes** — `D` directly visible · `C` contextually available · `P` via command
palette · `A` via More/Advanced disclosure · `M` shared modal/drawer · `—` not yet surfaced in
this experience (must never be the final state for a required capability).

Experiences: **W01** Original · **W02** Guided · **W03** Blueprint · **W04** Map · **W05** Partner
· **W06** Tasks · **W07** Storyboard · **W08** Guided/Expert · **W09** Wildcard.

| Capability | Req | W01 | W02 | W03 | W04 | W05 | W06 | W07 | W08 | W09 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Course intake (brief) | R | D | D | D | D | D | D | D | D | D |
| Source files | Rec | D | D | D | D | D | D | D | D | M |
| Course settings | R | D | D | D | C | C | C | C | C | M |
| Title & description | R | D | D | D | D | D | C | D | D | D |
| Outcomes | R | D | C | D | C | C | C | C | C | A |
| Outcome ↔ item alignment | Rec | C | C | D | C | C | D | C | C | A |
| Blueprint review | R | C | D | D | C | C | C | C | C | M |
| Modules (order/kind) | R | D | D | D | D | D | D | D | D | D |
| Module items (order) | R | D | D | D | D | D | D | D | D | D |
| Pages editor | R | D | D | D | D | D | D | D | D | M |
| Assignments | R | D | D | D | D | D | D | D | D | M |
| Discussions | R | D | D | D | D | D | D | D | D | M |
| Quizzes + keys | R | D | D | D | D | D | D | D | D | M |
| Rubrics | Rec | D | D | D | D | D | D | D | D | M |
| Assignment groups / weights | R | D | A | D | D | A | C | A | C | M |
| Gradebook health (100%) | R | D | A | D | D | A | D | A | C | M |
| Contact hours | Rec | D | A | D | A | A | C | A | A | A |
| Accessibility review | R | D | C | C | C | C | D | C | C | C |
| Course theme | Rec | D | A | A | D | A | A | A | A | M |
| AI revision (scoped) | Rec | C | C | C | C | D | C | C | C | C |
| Canvas pattern library | Adv | D | A | A | A | A | A | A | A | A |
| Readiness | R | D | D | D | D | D | D | D | D | D |
| Student preview | R | D | D | D | D | D | D | D | D | D |
| Export (.imscc) | R | D | D | D | D | D | D | D | D | D |
| Export history | Rec | D | A | A | C | A | C | A | A | A |
| Autosave | R | D | D | D | D | D | D | D | D | D |
| Version status | Rec | D | C | C | C | C | C | C | C | C |
| Undo/redo (where supported) | Rec | P | P | P | P | P | P | P | P | P |
| Help | Rec | D | D | D | D | D | D | D | D | D |
| Experience selector | R | D | D | D | D | D | D | D | D | D |
| Command palette | Adv | P | P | P | P | P | P | P | P | P |

### Rules this matrix enforces
1. **No `—` for a required (R) capability** in any shipping experience. Where a prototype does
   not yet surface a required capability directly, it must be reachable via `C`/`P`/`A`/`M`
   before that experience ships — the shared block library already provides the editors
   (`homepageEditor`, `syllabusEditor`, `gradebookEditor`, `themeEditor`, `readinessPanel`,
   `exportPanel`, `itemEditor`), so surfacing is a presentation task, not new logic.
2. **W01 Original stays fully `D`** — it is the current app, preserved.
3. **The command palette (`P`) is a universal floor** — every capability is reachable from it in
   every experience, so nothing is ever truly unreachable.
4. Advanced/administrative capabilities (frameworks, pattern library, contact-hour tuning, theme
   builder) are intentionally `A` in guidance-heavy experiences and `D` in Original/Blueprint —
   deferred, not deleted.

### Open parity gaps to close in the next slice (tracked honestly)
- **W09 Wildcard** surfaces several course-config capabilities only through its desk-drawer
  modal (`M`); confirm each is reachable and labelled before ship.
- **Contact hours** and the **Canvas pattern library** are `A` in most experiences and need an
  explicit disclosure entry point wired per experience.
- The **command-palette floor (`P`)** is specified here but not yet implemented (Phase 5).
