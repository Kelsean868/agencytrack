# Brief — Policy Ledger: award lens, two-layer rings, filter/sort/export

> Four PRs, serial. **L0** Sonnet 5 · high. **L1** Opus 5.5 · high. **L2** Sonnet 5 · high. **L3** Sonnet 5 · medium.
> Client-only (Vercel). If any part needs a `firestore.rules` change, build the rest and follow rule "Rules needed" below.

## Design source (approved by Kyron 26 Sep 2026)
`docs/design-system/proposals/ledger-2026-09/`:
- `C1-Home.dc.html`, `C2-Campaign.dc.html`, `C3-Home-Desktop.dc.html`, `C4-Campaign-Desktop.dc.html` — the live Home/Campaign screens **plus the two-layer rings**.
- `D1-Ledger-Campaign.dc.html` — ledger campaign view + "My target tier" picker (mobile).
- `D2-Filter-Sheet.dc.html` — filter & sort sheet (mobile).
- `D3-Ledger-Desktop.dc.html` — desktop table, filter rail, export menu.
- `D4-Ledger-Award-Lens.dc.html` — "Counts toward" award lens (mobile, interactive — read its script block for the per-award card behaviour).
Canvas files: read for layout, order, copy, hierarchy. Build with Tailwind + Nexus v2 tokens, Satoshi + Cabinet Grotesk, **no inline styles** (SVG geometry attrs ok), 44 px targets, loading / error / empty on every block, light + dark. Sample policies/numbers in the mockups are placeholders — every number in the build comes from real data or is hidden.

## Standing decisions
- BUG-01 option B: agent-declared settled counts; show provenance "[n] from head office · [n] self-confirmed" (`statusSource === 'oipa_import'` = head office).
- Family/self policies: excluded from awards and campaigns, included for MDRT and the hero.
- **One rules engine.** Every "counts / doesn't count / credit" decision comes from the existing engines (`src/utils/awardsEngine.js` incl. `getPeriodCtx`, `src/lib/ledgerProduction.js`, `src/lib/policyCampaignLens.js` `derivePolicyLens` / `creditFor`). Do not re-implement award rules in the ledger. If the engines don't expose per-policy results, add a pure exported helper inside them and test it (this is the BUG-04 lesson).
- Wording for ranked awards (monthly, quarterly, annual): "your credit" / "counts toward". Never "you qualify" / "you'll win".

## Rules needed (applies to every PR)
Per-agent persistence (target tier, saved views) goes through `src/services/userPrefsService.js`. Check the existing userPrefs rules + `tests/rules/userPrefs.rules.test.mjs`. If they already allow the agent to write these fields, use them. If a rules change is needed: do NOT change `firestore.rules` in these PRs. Keep the feature working with in-memory state for the session, add a FOLLOW_UPS entry "userPrefs rules for ledger views + target tier", and say so in the PR.

---

## L0 — Two-layer rings on the live donuts
- Extend the shared donut (`ProgressDonut` / `GoalDonut`) with an optional `pending` value: faint arc = settled + pending (behind), solid arc = settled (front). Faint colour from tokens (teal tint on light surfaces; white ~42% on the teal hero); must stay distinguishable in dark mode.
- Wire it: Home hero (settled vs submitted from `deriveYearProduction`), Home campaign card and Campaign screen API + Applications (submitted-not-settled inside the campaign window, via the lens). Persistency ring unchanged.
- Legend "Settled — counts" / "Submitted — waiting to settle" once per ring group; "+<x> submitted" sub-line.
- Tests: arc lengths with/without pending, clamp at 100%, aria-label names both values.

## L1 — Award lens in the Policy Ledger (the core)
Where: the agent Policy Ledger screen (`src/components/agent/policyLedger/*`, extend `CampaignLensPanel` or replace it).
1. **"Counts toward" selector** (D4): active campaign(s) pinned first (★), then this month, this quarter, this year's annual awards, MDRT <year>, then a "Past period…" picker (closed months/quarters of the current and previous year). Periods from `getPeriodCtx` / the ruleset — not hard-coded.
2. **Award card** swaps per selection:
   - Target awards (campaign, MDRT): two-layer ring vs target, "of <target> · <apps>", "+<x> submitted", weekly pace to target by the period end.
   - Campaign only: **"My target tier"** radio group (D1); ring + pace follow the chosen tier; default = next tier above current. Persist per agent per campaign (see Rules needed). Also show the same picker on the Campaign screen hero (R2) so they stay in sync.
   - Ranked awards (month / quarter / annual): two boxes "Settled — counts" and "Submitted — waiting" with apps; no ring.
   - One rule line from the engine: e.g. family excluded / counts for MDRT only; Jul–Dec monthly awards recognition-only during the campaign (cash suppression already in `awardsEngine`).
   - Closed period: "Closed · final credit".
3. **List grouped**: Counting (with credit) · Submitted, not settled ("counts when settled") · Not counting here (with reason from the engine: NTU, family, outside window, etc.). Each policy card keeps its existing tap-through.
4. Head-office flag on a card when a self-confirmed settled policy is not on the latest HO import ("Not on the head-office list yet — check with HO").
5. Desktop (D3 layout): award strip across the top (selector + rings/boxes + pace), list becomes the table in L2 — for L1, desktop may show the same grouped cards in a 2-column grid.
Tests: engine helper per award type (fixtures: campaign window, month, quarter, MDRT with a family policy, closed period, NTU); card variant per award type; target-tier switch changes target + pace; grouping counts; empty state per group.

## L2 — Filter & sort, saved views, export
1. Filter sheet (D2, mobile) / filter rail with counts (D3, desktop): Counts toward (+ Counting / Submitted / Not counting), Status, Source (HO / self-confirmed / not on HO list), Needs attention (awaiting my confirmation, differs from HO, lapse risk), Product, Premium frequency, Clients vs family, Date type (issue / submit / paid-to) + From/To (DD-MM-YYYY display, stored YYYY-MM-DD), API min/max.
2. Sorts: newest issued, newest submitted, API high→low, API low→high, client A–Z, next premium due. Desktop table: sortable headers, sticky header + first column, tabular numerals, footer count "N policies · N counting · N waiting · N not counting · Counting TTD x".
3. Active-filter chips row with Clear. "Save as a view" → named saved views shown as the view chips row (All policies, ★ campaign, Needs confirming · n, Lapse risk · n, + user views). Persist per Rules needed.
4. Export the **filtered** rows: Excel (.xlsx via existing `xlsx` dep, write-only), CSV (reuse the S2 formula-injection-safe CSV helper), PDF "head-office check sheet" (existing jspdf or @react-pdf). Lazy-load export libs. Dates DD-MM-YYYY, TTD money.
Tests: each filter predicate, sort comparators, saved-view round trip, export row mapping + CSV safety.

## L3 — "Counts toward" chips on every policy card (and the drill drawer)
Gold chips listing every award window the policy counts toward (from the same engine helper); pending policies show grey "Will count toward" chips. Tests for chip lists incl. family → MDRT only.

## Deliverables (each PR)
1. One PR. `npm test`, lint, build pass — paste counts.
2. **Design check ritual**: preview smoke, read-only, via the `loginAs` harness; screenshots at 390×844 and 1440×900, light + dark; table in the PR: mockup block · matches (yes/no) · note. Where the test agent lacks data (e.g. no campaign), render the component locally with the unit-test fixtures and attach those screenshots, clearly labelled. No client names / policy numbers in committed screenshots.
3. Block → component map in the PR body.
4. `/post-merge <PR>` after merge.

## Out of scope
Manager ledgers; any `firestore.rules`/functions change; agent self-confirm write path (P2d); new fonts.
