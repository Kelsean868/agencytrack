# Kickoff — Nexus Glass S1: glass tokens + flagship hero-card adoption

**Version: v1 (2026-06-06).**
**Size:** M · **Type:** TOKEN-DEFINITION slice + 3-card adoption · **Merge:**
HUMAN-MERGE + dispatcher pre-review (token definitions are never autonomous).
**Branch:** `feat/nexus-glass-s1`
**Layout authority:** `docs/design/nexus-glass-recipe.html` (lands with this brief). If
that file is absent from main at dispatch, STOP — do not proceed from memory of it.

## Locked decisions

### D1 — Tokens, exactly per the recipe
`--glass-l-*` / `--glass-d-*` sets + `.glass` / `.glass.teal` / `.glass.gold` classes.
Dark physics differ from light (base opacity 0.55 vs 0.62, lifted `#4ab5b8` tint, white
@12% hairline border). **Opacity floors are law:** light base ≥ 0.62 (effective bg
#EAF3F3), dark base ≥ 0.55 (effective #15201F). Recipe hexes may appear in token
DEFINITIONS only (index.css / tailwind.config token blocks) — nowhere else.
`prefers-reduced-transparency` flattens to the precomputed solid; Kiosk and MeetingMode
use the opaque variant (no backdrop-filter); in-app surfaces get full glass. Soft
gradient tints on card backgrounds are sanctioned by the recipe; the no-gradient-BUTTONS
rule stands untouched.

### D2 — Contrast module extension (the AA fortress holds)
Extend `src/utils/contrast.js` with `glassPair(tint, theme)`: effective background =
tint over base over the darkest named surface. Deterministic tests for every
(ink token × glass tint × theme) pair at the floor values — INCLUDING the guard test
asserting `text-ink-faint` FAILS on glass (the recipe designs it to fail; the test
makes putting faint on glass a red suite forever). If any computed verdict diverges
from the recipe's AA table (a pass the recipe says fails, or vice versa), STOP — that
is a dispatcher question, never a tint tweak.

### D3 — Adoption: the flagship three ONLY
Commission AnchorStrip · Persistency reality bar · Game Plan suggested-week card — the
recipe's annotated set. No other surface in this slice. The recipe's no-glass census is
BINDING: tables, kiosk rows, policy worklists, entry forms, small/faint-text cards, and
error/empty states never get glass.

## Phase 0 — source-verify (Rule 17)
Parse the recipe's token tables (values, floors, fallback stance) · current token-block
structure in index.css/tailwind.config (where the glass sets slot) · the three flagship
components' current container classes (the adoption diff per card) · which standing
smokes cover each card (commission S1/S2, persistency S1, the planner card smoke) ·
backdrop-filter support posture in the existing build targets.

## Gates + evidence
Lint 0 · full suite (glass-pair tests + ALL standing suites green; conscious evolutions
enumerated if card-class assertions move) · build · hex-grep (definitions-only
exception per D1, enumerated) · re-run the standing smokes covering the three cards
against the preview · axe NO-NEW vs the bell-badge baseline both themes · both-theme
screenshots of all three cards over REAL app backdrops (the glass must be seen to be
judged) · `prefers-reduced-transparency` spot-proof (one card, emulated, renders the
solid).

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: the adoption-sweep follow-up queued (remaining
hero-card candidates pending the census — the R2 inventory item rides the next
review/visual pass) · any recipe divergences recorded.

## Out of scope
Any surface beyond the flagship three · the hero-card census itself · component
behavior, data, or layout changes (glass is a container treatment) · rules/functions/
schema.

## Acceptance
Tokens byte-faithful to the recipe with floors enforced · glassPair tests green
including the faint-FAIL guard · the three cards glassed in both themes with screenshot
evidence over live backdrops · all standing smokes for those cards green · kiosk/
meeting/reduced-transparency fallbacks proven in code (kiosk opaque variant present
even though no kiosk surface adopts glass) · Rules 12/15/17/18/19/20.
