# Units Reference Translation

How the reference site (units.gr) informed the RocketCourse design language — and where the line
was drawn between **inspiration** and **copying**.

## Ideas taken as inspiration (translated, not copied)
| Reference quality | RocketCourse translation |
|---|---|
| Visible square grid as a brand device | `.rc-grid-bg` (32px grid, 1px low-opacity ink) used **outside** dense text — selector, empty states, host backdrops; reduced/greyed on mobile. |
| Saturated energy palette | An original semantic palette (`--rc-blue/yellow/orange/green/lilac/raspberry`) mapped to *meaning* (action, attention, generate, success, AI, alternate), never used as decoration alone. |
| Bold editorial display type | Archivo Black display + Inter UI; large confident titles, compact metadata, mono step-codes. |
| Numbered navigation | W01–W09 workflow codes and a numbered shared-context strip — used for orientation, not as decorative noise, and never exposing DB ids. |
| Rounded modular panels, hard labels, crisp dividers | Radius scale + 2px ink borders + accent top-rules on experience cards; "collection of work surfaces," not a pile of dashboard cards. |
| Soft depth, asymmetric composition | Ambient shadows (no glass/neon); asymmetric selector and shell layouts. |
| Motion as identity | Tokenized motion (fast/standard/emphasis) on entrances, hovers, selection — with `prefers-reduced-motion` honored. |

## Reference behaviors intentionally excluded
- No plant/eye/smile/housing imagery, photography, illustrations, logos, brand name, or written
  content from the reference.
- No exact page compositions reproduced.
- No custom cursor **required** for operation; no infinite auto-scrolling that impairs selection;
  no WebGL/heavy effects in editors, forms, readiness, or export flows.
- No proprietary reference font.

## Copied reference assets
**None.** This system is original and shares only design *language* (grid, saturated color energy,
editorial type, numbered navigation, modularity, interaction quality) with the reference.

## Confirmation
- The result is **inspired by** the reference, not a clone.
- Application design remains **separate** from generated Canvas course themes.
- Tokens are semantic and centralized; no literal colors are scattered through components in the
  new shell.
