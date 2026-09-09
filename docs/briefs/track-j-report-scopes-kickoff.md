# Track J closeout - the UM and BM production report surfaces get their v2 port

**Written 9 September 2026.** Resumes Track J after a six-week pause (last Track-J commit `0eb89f31`, 2026-07-26). Sequenced after the 2026-09-09 ledger refresh, which re-confirmed rows 24-27 as the largest remaining port gap.

**Two slices, two PRs, sequenced. R1 must merge before R2 branches.**

> **THIS DISPATCH BUILDS R1 ONLY (section 2).** Do not open R2's branch, do not touch section 3's files, and do not fold the two into one PR. R2 is a separate dispatch, after R1 merges **and** after the blocking question in section 3.1 has an operator ruling. If R1 finishes early, stop and report - do not continue into R2.

- **R1 - Model: Sonnet 5, medium effort.** Presentational conformance only. Class swaps and one block move; no new derivation, no service call, no schema.
- **R2 - Model: Fable 5.1, high effort.** Composition change against the mockup: the four-window period grid for two roles, and the unit top-performers rail. New derived data, and one open question that must be answered before the branch is cut.

**Target repo:** this one only (`C:\Projects\AgencyTrack`). PowerShell, no `&&` chaining.

---

## 1. Why these two screens, and what "PARTIAL" actually means here

Rows 24-27 of `docs/track-j-port-ledger.md` were rated PORTED off a commit subject line and corrected to PARTIAL on 2026-07-25 after the `9c08c40b` diff was read. What that commit gave the two manager on-screen views was a Download button, a PDF-error card, an honest `DataSourceBadge`, and two pass-through props. **No layout, IA, composition or visual restyle.** The bulk of it was react-pdf document work, which is HEX-only by design and exempt from the v2 token system.

The token layer produced the cosmetic v2 look app-wide. These two screens received the token layer. They did not receive the redesign.

`AgentProductionView.jsx` (357 lines) is the same family's screen that DID get ported, in #397/#403. It is the reference pattern for both slices. Do not invent a treatment that Agent already solves.

**Canonical design intent:** `docs/design-system/screens-v2/AgencyTrack Production Report v2.html` (the in-app tab; scenes `agent` / `unit` / `branch` / `sm` / `mobile`), plus `docs/design-system/guidelines/redesign-addendum.md`, which wins over `readme.md` for app surfaces.

**Out of scope for both slices, stated so it is not rediscovered mid-build:** `AgencyTrack Manager Reports.html`, `AgencyTrack Branch Report.html` and `AgencyTrack Reports.html` are **PDF-export** mockups, not the in-app tab. The Unit "Coaching focus" page, the Branch CSV-to-4-page-PDF refinement and the Agent refined cover all live in `services/exportService` and are a separate brief. The `sm` scene (Sales Manager, all branches) is marked Phase 9 / post-pilot in the mockup's own ladder card - not this brief.

---

## 2. Slice R1 - presentational conformance (Sonnet 5, medium)

Branch: `feat/track-j-report-scopes-r1`. Two files.

### 2.1 Label typography

`AgentProductionView` renders every section and stat label as `text-[9px] font-bold font-mono uppercase tracking-widest`. Both manager views still carry the pre-port `text-xs font-semibold uppercase tracking-wide` - no mono, and no `font-display` on the numerals.

Bring these to the Agent treatment:

| File | Lines |
|---|---|
| `src/components/productionReport/UnitManagerProductionView.jsx` | hero block `249-269`, then labels at `268`, `274`, `295` |
| `src/components/productionReport/BranchManagerProductionView.jsx` | hero block `251-271`, then labels at `275`, `293`, `307` |

Reference: `AgentProductionView.jsx:253-278`.

### 2.2 The identity chip in the hero

Agent's hero opens with an initials avatar chip and the person's name and unit (`AgentProductionView.jsx:236-278`). Neither manager view has one. The data is already in hand - `userProfile` from `useAuth`, the same source Agent reads at `:143-146`. This is wiring, not derivation.

### 2.3 Unit rank moves into the hero

`UnitManagerProductionView.jsx:297-304` renders "Unit rank in branch" as its own card at the bottom of the screen. The mockup and Agent both put rank inline in the hero as a pill (`AgentProductionView.jsx` "Branch rank"). The value is already computed at `UnitManagerProductionView.jsx:119-131` - move the render, delete the card, change no maths.

BM has no rank pill and gets none in R1 - a branch has no rank inside itself, and the cross-branch comparison is the `sm` scene, which is out of scope.

### 2.4 What R1 must not touch

`ProductionTable.jsx` is already v2-token-styled and shared. `ProductionReportTab.jsx` is a 21-line role router - leave it alone. Loading, error, empty and partial-failure handling is already identical across all three views (`PanelSkeleton`, the `AlertTriangle` error card with Retry, the partial-failure banner); it is not a delta and needs no change.

---

## 3. Slice R2 - composition (Fable 5.1, high)

Branch: `feat/track-j-report-scopes-r2`, cut from `main` after R1 merges.

### 3.1 BLOCKING - answer this before cutting the branch

The `branch` scene of the mockup shows an **on-pace count** as a branch stat. **No such derivation exists in the repo** - it is not in `lib/productionReport/computations`, and the mockup supplies the vocabulary only.

This is the same shape as the Master Sheet "Gone quiet" chip in #871, where inventing a recency threshold was correctly declined and the question went to the operator. Do the same here: **stop and ask the dispatcher what "on pace" means** - against the tenure floor, against the company floor, against the agent's own game plan target, and measured over which window. Do not pick one. If the answer does not arrive, build R2 without the stat and record it as a scoped-out row, not as a defect.

### 3.2 The four-window period grid, for both roles

Agent renders all four periods at once - week, MTD, quarter, YTD - with the active one highlighted (`AgentProductionView.jsx:281-303`), fed by `periodTotals` at `:112-117`. Both manager views compute an aggregate for the **selected period only**: `UnitManagerProductionView.jsx:87-90` via `computeUnitAggregates`, `BranchManagerProductionView.jsx:85-87` via `computeBranchAggregates`.

Both need the all-four-periods derivation, then the grid. The existing `TimePeriodToggle` stays - the grid shows the shape of the year, the toggle still drives the roster below it.

Filter once and reuse: `filterSubmissionsByPeriod` is already imported in both files, and the submissions array is already in memory. Four filtered passes over one in-memory array, not four service calls.

### 3.3 The unit top-performers rail

The `unit` scene shows a top-performers rail above the roster. UM already computes `rankedAgents` (`UnitManagerProductionView.jsx:104-115`); BM already renders exactly this pattern as its Top-N card with a show-all toggle (`BranchManagerProductionView.jsx:287-304`). Take that pattern across rather than writing a second one. The derivation is a slice and a format.

### 3.4 Where the money rules already live

Every figure on these screens is API in TTD. `parseFloat` is enforced on numeric writes; dates are stored `YYYY-MM-DD` and displayed `DD-MM-YYYY`; weeks start Sunday. All the arithmetic these screens need already exists in `lib/productionReport/computations` - if a new figure seems to need a new formula, that is the signal to stop and check §3.1's rule, not to write one.

---

## 4. Deliverables - paste in the PR body

Both slices:

1. **The smoke walk.** A read-only walk of the changed surface on the Vercel preview, **both themes**, at desktop and at the 768-1023px rail breakpoint, with the pass count and any console errors stated. If the branch-name alias exceeds the 63-char DNS limit, use the immutable per-deployment URL and say so.
2. **Evidence paste-back.** Every claim in the PR body carries its file and line, or its command and output. A status asserted without evidence is the failure mode this repo has corrected twice.
3. **Contrast CI green.** Both slices move type and color classes; the a11y-contrast job is the gate that catches an AA regression, and it must be green on the final commit, not on an earlier one.
4. **The post-merge fill**, resolved from the PR's base branch, not from the string "main".
5. **The ledger row.** R2's fill updates rows 24-27 of `docs/track-j-port-ledger.md` with what actually shipped - including anything scoped out under §3.1. The ledger's own Rule-22 gap table gets the new state of gap 10.

R2 additionally: state which of the mockup's `branch`-scene stats shipped and which were held, and why.

---

## 5. Merging and deploying

Claude Code does not merge and does not deploy. Kyron merges. Neither slice touches `functions/`, `firestore.rules` or `firestore.indexes.json` - if either one starts to, stop and say so before writing the change, because that turns a Vercel-rebuild slice into a manual-deploy slice.
