# Kickoff — Nexus Glass S3: Hero adoption sweep (top summary card, every screen)

**Version: v1 (2026-06-06).**
**Size:** M–L (census-dependent) · **Type:** hero adoption sweep — visual conversion
only · **Merge:** HUMAN-MERGE + dispatcher pre-review (screenshots gallery is the
review).
**Branch:** `feat/nexus-glass-s3-sweep`
**Prereq:** #517 merged (teal hero verdict applied). ALL heroes are `.glass.hero.teal`
— gold is reserved, unused by operator verdict.

## The selection rule (operator-defined, 2026-06-06)
Every screen's TOP SUMMARY CARD — the one carrying that screen's headline/summary data —
becomes the hero. Named by the operator: Dashboard YTD card · History "Your Year" card ·
Policy Ledger "Your policy pipeline" card · Production Report top card · "you get the
idea." One hero per screen, never more. The recipe's no-glass census is BINDING:
tables, kiosk rows, worklists, entry forms, dense data grids, error/empty-only cards
never get hero treatment — a screen whose top card is one of those gets NO hero.

## Phase 0 — census + MANDATORY STOP
Walk every screen (agent + manager nav sets, the exploration-template route list).
Produce the census table: screen → top-card identification → component file:line →
verdict HERO / NO-GLASS (census reason) / AMBIGUOUS (why). Include the four
operator-named cards explicitly; flag any screen with two plausible "top" cards or
none. The three #517 cards are DONE rows. STOP and present the table — the dispatcher
confirms the conversion list before any code. This stop is cheap; glassing the wrong
card is not.

## Phase 1+ — per-card conversion (after list confirmation)
For each confirmed card, the #517 discipline exactly:
- Container → `.glass.hero.teal` (loaded state; skeletons keep their current class).
- Element-by-element ink swap map: on-pane text → hero-ink / hero-ink-muted-teal /
  hero-accent per role; STATUS content → the chip-island pattern (hue in the certified
  dot). Map enumerated per card in the PR body.
- Pace/tick primitives or shared sub-components rendered on a new hero pane: restyle
  LOCALLY (the PaceRow precedent) — shared primitives on non-hero surfaces stay
  byte-untouched, grep-proven per card.
- One hero per screen verified per route.
No data, layout, or behavior changes. No new tokens — the certified hero set only; if
any card's content cannot map onto the certified ink set (e.g., needs a new tier),
STOP for that card and list it rather than improvising.

## Gates + evidence
Lint 0 · full suite (per-card test evolutions enumerated; the 31-test hero matrix and
40 subtle tests untouched) · build · hex-grep · the standing smokes covering converted
surfaces re-run vs preview · a SWEEP AXE WALK: every converted screen, both themes,
NO-NEW vs the bell-badge baseline (the D6-census lesson: walking new rooms finds old
debt — enumerate any pre-existing finds for separate FUs, fix only in-family one-liners
per the established carve-outs) · the SCREENSHOT GALLERY: every converted card, both
themes, over real backdrops — the operator's review artifact.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: the hero census table recorded as canon (including
NO-GLASS verdicts — future screens consult it) · any per-card stops/parks · pre-existing
axe finds banked.

## Out of scope
Gold hero usage · new tokens/tiers · the #517 three (done) · kiosk/meeting surfaces
(opaque fallback governs) · any behavior/data change.

## Acceptance
Census table confirmed by dispatcher pre-conversion · every converted card on the
certified ink set with its swap map enumerated · one-hero-per-screen proven per route ·
sweep axe NO-NEW · gallery delivered both themes · shared primitives grep-proven
untouched · Rules 12/15/17/18/19/20.
