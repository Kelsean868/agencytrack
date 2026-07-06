# AgencyTrack App — surface conventions

The product portal system ("Nexus"). Light + dark modes, denser than marketing, role-based screens (agent, unit manager, branch manager, sales manager, CRO, back office). Desktop frame 1280×800; mobile is single-column stacks of the same cards.

## Modes
Both palettes live in `tokens.css`. Light is default (`:root`); dark applies under a `.dark` scope. The mode toggle is user-facing (sun/moon icons). Rules:
- Dark is a warm dark — #1A1612 ground, warm inks (#F0EBE0 → #8A8074) — never neutral gray/blue-black.
- Teal and gold BRIGHTEN in dark (#4AB5B8 / #E0AA3E) to hold contrast; tints become alpha washes (e.g. rgba(74,181,184,.14)).
- Rules/dividers in dark are light alpha hairlines (rgba(240,235,224,.08)), never dark lines.
- Everything must clear WCAG AA in both modes.

## Color semantics
- teal = primary/informational, brand emphasis, links, active nav
- gold = recognition, awards, campaigns — nothing else
- success #2D7A4F / warning #B45309 / danger #C0392B (+tints) for statuses: settled, at-risk/delivery clock, clawback/NTU
- inkAccent violet #5A3FA0 sparingly for list variety only

## Nexus Glass (hero tier) — see glass.css
Doctrine: **glass is a surface treatment, never a content style.** One glass card max per screen — the top-of-screen hero summary only. Light and dark have different physics (see tokens in glass.css). A glass tint that can't clear AA doesn't ship; kiosk and prefers-reduced-transparency get precomputed opaque fallbacks (#EAF3F3/#F6EEDD light, #15201F/#221C12 dark). Regular cards, tables, lists, nav: never glass.

## Density & type
- Body 13–14.5px, card headers ~15–16px 700, page titles ~31px display.
- Mono for: eyebrows, timestamps, currency figures in tables, policy numbers, KPI labels.
- Cards: 14–18px radius, 1px rule border, surface on bg; raised surface (#FAFAF8 / #302A23) for nested layers.

## Iconography
Inline SVG, 24px viewBox, stroke 1.8, round caps/joins — Lucide-style line icons (see `reference/app-tokens.jsx` for the full set: home, chart, target, wallet, medal, shield, trophy, clock, etc). Icons are functional (nav, actions, statuses) — never decorative grids.

## Currency
`ttd()` helper formats: ≥1M → `TTD 2.40M`, ≥1K → `TTD 24.5K`, else `TTD 950`. Always the TTD prefix.

## Kiosk / Meeting mode
Runs the dark palette at display scale (leaderboards, gold-on-dark). No glass (opaque fallbacks), larger type, auto-cycling content.
