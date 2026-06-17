# Brief: Team Performance Roster — UI build (from confirmed mockup, against a mock data interface)

## Context
The Direction-1 roster (#4). CD's mockup is locked at
`design_handoff_v2_app/Team_Performance_Roster_-_Build.html` — **read it as the design source of truth**
(exact columns, group bands, persistency/goal cells, states, mobile card). The data-layer hook
(`useTeamRoster`) is being built in parallel; **this brief builds the UI independently**, against a
defined `RosterRow[]` interface + a **mock provider**, so it's reviewable standalone and does not depend
on the still-in-flight, unreviewed data layer. Wiring the mock → the real hook is a trivial later step.

## Locked decisions
- **BM rows = individual rows** (each UM a row with their personal production + a `UM` role chip), not
  unit roll-up subtotals.
- **% goal pace marker = straight-line time-elapsed**; the % number itself is YTD ÷ target regardless.
- 8 columns: Name (pinned), Tenure, API submitted, Apps submitted, API issued, Apps issued, Persistency,
  % of annual goal. Submitted vs Issued shown under subtle group bands.
- Period filter: Year / Month / Week + period picker; default current year; **scopes the four production
  columns only**. Persistency = month of the period; % goal = annual (neither flows with the period).
- Persistency: reuse the shipped two-tick band (PERS_FLOOR 80 / PERS_GATE 90) + color-by-band; "—" when
  no settled book.
- % of annual goal: AA-legible heat (color is a cue, the number is always legible) + straight-line pace
  marker; "—" when no committed target.
- Tenure: "Ny Mm" + contract date as secondary text; sorts by the underlying date.
- Sort: click header → sort; click again → toggle asc/desc; active column + direction arrow; default
  Name A→Z; numeric columns right-aligned.
- Mobile: stacked card per member (2×2 production grid + persistency/goal footer); a "Sort by" control
  replaces clickable headers; the period filter stays accessible.
- States: skeleton; empty (no members — controls visible but inert); empty-period (per-cell "—" across
  the four production columns, persistency & % goal still populated, "jump to last active period"
  banner); per-cell "—".

## The data interface (the contract the UI is built against)
A `RosterRow`:
```
{
  id: string,
  name: string,
  role: 'UM' | null,
  unit: string,                  // e.g. "S·02"
  contractDate: number,          // ms epoch → tenure
  submittedAPI: number | null,   // period-scoped
  submittedApps: number | null,
  issuedAPI: number | null,
  issuedApps: number | null,
  persistency: number | null,    // month-of-period, 0–100
  pctOfAnnualGoal: number | null // annual; null = no committed target
}
```
Controlled state alongside the rows: `period {grain:'year'|'month'|'week', value}` and
`sort {column, direction:'asc'|'desc'}`. The in-flight `useTeamRoster` hook returns exactly this shape,
so swapping mock → hook is one line.

## Procedure note
Branch at **Phase 0, before any code**, off **main** (independent of the data-layer branch). PowerShell —
no `&&`. Tier B (frontend, build-and-hold, human merge).

## Phase 1 — recon (report, then proceed)
1. Read the mockup file end-to-end for exact structure/CSS.
2. Confirm the **shipped Nexus CSS-var tokens** to use — do NOT copy the mockup's inline `:root`; wire to
   the app's real tokens. Confirm the existing persistency band util / thresholds (`PERS_FLOOR` /
   `PERS_GATE`) to reuse.
3. Confirm the MasterSheet sticky-header / pinned-column pattern to follow.
4. Report, then proceed.

## Phase 2 — build (components per the mockup's component list)
- `TeamPerfRoster` — sticky-header, pinned-Name table; 8 columns; group bands; click-to-sort (asc/desc +
  arrow); consumes `RosterRow[]` + sort state; horizontal scroll with pinned name.
- `PeriodFilter` — controlled grain (Year/Month/Week) + period picker; emits period state.
- `TenureCell`, `GoalHeatCell` (heat + straight-line pace + "—"); reuse the persistency band cell.
- A **mock provider / fixture** with sample rows incl. edge cases: a no-target member (% goal "—"), a
  no-book member (persistency "—"), and a zero-production member (empty-period "—"s).
- All four states + the mobile stacked-card.
- Make it viewable on the preview — a temporary preview route or the dev/storybook harness (CC's call) —
  so it renders for review and smoke.

## Phase 3 — tests + smoke
- Render/interaction tests: each column sorts asc/desc; period grain switch; the "—" fallbacks; both
  themes render; mobile card renders.
- Preview smoke: roster renders from mock data, a sort click reorders, the period grain toggles, both
  themes pass axe (no NEW serious/critical vs main baseline).

## Phase 4-5
- Docs placeholders (CONTEXT.md, FOLLOW_UPS.md). Branch, push, open PR. **HOLD for human review.**

## Out of scope (the follow-up wiring step)
- Replacing the mock provider with the real `useTeamRoster` hook.
- Final nav placement (which manager tab/route this lives on).
Both land in a small wiring brief once the data layer's reviewed/merged.

## Acceptance
- Full roster UI renders from mock `RosterRow[]`: 8 columns, group bands, click-to-sort, period filter
  (production-only scope), reused persistency band, AA-legible goal heat + straight-line pace, all "—"
  fallbacks, four states, mobile card. Both themes clean. Wired to the app's **real** Nexus tokens (not
  the mockup's inline copy). Zero data fetching (mock provider). Build-and-hold.

## Risks
- Largest UI build so far — but fully specified by the locked mockup with no open decisions, so it suits
  an unsupervised run. The one thing to get right: use the app's real CSS-var tokens and the shipped
  persistency util, not the mockup's standalone copies (Phase 1 confirms both).
