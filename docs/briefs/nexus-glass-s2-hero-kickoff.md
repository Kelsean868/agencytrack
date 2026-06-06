# Kickoff — Nexus Glass S2: HERO variant (deep tinted glass + inverted ink world)

**Version: v1 (2026-06-06).**
**Size:** M · **Type:** TOKEN-DEFINITION slice + flagship swap · **Merge:** HUMAN-MERGE
+ dispatcher pre-review (tokens + the operator's aesthetic call — the screenshots ARE
the review).
**Branch:** `feat/nexus-glass-s2-hero`
**Prereq:** #513 merged (the subtle tier + glassPair machinery is the foundation).
**Layout authority:** `docs/design/nexus-glass-hero-recipe.html` (lands with this
brief). If absent from main at dispatch, STOP.

## Locked decisions

### D1 — Hero tokens per the recipe, faithfully
`--glass-hero-*` sets, light + dark physics separate (saturated teal/gold gradient
panes at 0.86–0.96 alpha; dark runs more translucent). `.glass.hero.teal` +
`.glass.hero.gold` classes. The HERO INK SET is the recipe's enumeration and nothing
else: `--hero-ink` #FFFFFF · per-pane muted tiers (#CFE3E3 teal / #F3E7CC gold) ·
`--hero-accent` #F0D89A · faint NOT PERMITTED on hero. Recipe hexes in token
definitions only. Fallback solids per the recipe: kiosk opaque (#0A5E62 / #7A560F),
meeting reduced (≤8px blur), `prefers-reduced-transparency` flattens to the same
solids. The subtle tier from #513 is RETAINED untouched as the non-hero tier; its
tokens, classes, and 40 tests do not move.

### D2 — Module extension: the inverted worst case
Light ink on a deep pane fails hardest against the LIGHTEST composite — the opposite of
glassPair's dark-ink direction. Extend src/utils/contrast.js (heroPair(tint, theme) or
a direction parameter — CC's structural call, cited) computing the lightest pane stop
over the lightest named surface, per the recipe's stated worst-case definition.
Deterministic tests: every enumerated hero ink × both panes × both themes at the
recipe's stated composite floors (teal #167275 L / #0C4A4D D · gold #8A6212 / #6E4E0E)
— the muted tiers are the CANARIES (recipe computes 4.6–4.8; if the module disagrees
with a stated PASS, STOP per the #513 precedent — module is authority, thresholds never
bend, saturation is what moves). Chip-island assertions: status dot hue at 3:1 against
the island tile (white@15% over the pane composite), per recipe. Plus the guard: the
faint token FAILS on hero (analog of the subtle tier's guard).

### D3 — Flagship swap + the chip-island status pattern
The three flagship cards swap subtle→hero: CommissionAnchorStrip → `.glass.hero.gold` ·
PersRealityBar → `.glass.hero.teal` (loaded state; skeleton unchanged) ·
SuggestedWeekCard → `.glass.hero.teal`. Their ON-PANE text moves to the hero ink set
(primary/muted/accent per the recipe's annotated mapping — Phase 0 parses it
element-by-element); STATUS content converts to the chip-island pattern (white@15%
inset tiles, hue in the certified dot, labels in hero ink) exactly as the recipe draws.
One hero per screen is the standing rule — these three already are. No other surface.
Existing -ink classes inside these cards that move onto islands or hero panes are
conscious evolutions, enumerated.

## Phase 0 — source-verify (Rule 17)
Parse the hero recipe's token tables, ink enumeration, floors, island spec, fallback
solids · #513's shipped token/class structure (the insertion points; confirm subtle
tier untouched by the diff) · the three cards' current element-level ink usage (the
swap map, element by element) · the #513 glass smoke's assertions (they evolve
subtle→hero — enumerate) · standing smokes covering the cards · testids.

## Gates + evidence
Lint 0 · full suite — the 40 subtle-tier tests UNTOUCHED-GREEN, the new hero matrix
green, all standing suites green, evolutions enumerated · build · hex-grep
(definitions-only, enumerated) · the glass smoke evolved to assert hero classes +
computed saturated backgrounds + island pattern, re-run vs preview · the three standing
card smokes re-run vs preview · axe NO-NEW vs the bell-badge baseline both themes ·
both-theme screenshots of all three cards over REAL app backdrops — the operator's
aesthetic gate, make them good · reduced-transparency spot-proof renders the hero
solid.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: the #513 recipe-table-regeneration FU extends to
both recipes · the hero adoption-sweep follow-up (remaining hero candidates pending the
census) queued · any recipe divergences recorded per the established pattern.

## Out of scope
Any surface beyond the flagship three · the subtle tier's tokens/tests · component
behavior/data/layout · rules/functions/schema · the hero census.

## Acceptance
Tokens byte-faithful with floors enforced via the inverted worst-case math · hero
matrix + canaries + island dots + faint guard green · subtle tier provably untouched ·
three cards visually transformed per the recipe with screenshot evidence both themes ·
all standing smokes green · fallback solids proven · Rules 12/15/17/18/19/20.
