# Brief: Team Performance Roster — wire to real hook + real-data smoke

## Context
Finishes #4. PR #683 (branch `team-roster-ui`) holds the full roster UI running on a **mock provider**.
PR #682 (the `useTeamRoster` data layer) is now **merged to main**. This brief works **on the existing
`team-roster-ui` branch** — pulls main in, swaps the mock provider for the real hook and the local
`sortRows` copy for the merged `lib/teamRoster` export, wires the hook's loading/error/empty into the
existing states, and runs the **real-data smoke against the seeded smoke tenant** that the mock build
waived. On merge, the Team Performance tab goes live with real data.

## Procedure note
Work on the **existing `team-roster-ui` branch — do NOT cut a new branch.** PowerShell, no `&&`.
Tier B (frontend, read-only data via the claim-scoped hook; build-and-hold, human merge). The PR already
exists (#683); pushing updates it.

## Phase 0 — sync the branch
1. `git fetch origin`; checkout `team-roster-ui`; `git merge origin/main` (brings in `useTeamRoster` +
   `lib/teamRoster`).
2. Likely conflict: **CONTEXT.md** (both #682 and #683 touched the "Last updated"/"Active track" rows) —
   resolve by keeping the latest. Resolve any others minimally.
3. Confirm clean, full suite still green, then proceed.

## Phase 1 — recon (report, then wire to match — do not assume the signatures)
1. Read `src/hooks/useTeamRoster.js` + the `src/lib/teamRoster.js` exports. Confirm the hook's **exact
   signature**: does it take the period (`{grain, value}`) as a param? Its return shape — `RosterRow[]`
   directly, or `{rows, loading, error}`? Confirm the `sortRows` export signature.
2. Read `TeamPerfRosterPage.jsx` — locate the mock provider call and the local `sortRows` copy.
3. Confirm the hook returns `persistency` and `pctOfAnnualGoal` on a **0–100 scale** (the #682 check). If
   it returns 0–1, that boundary needs ×100 here — but flag it loudly rather than silently converting.
4. Report the real signatures, then wire to them.

## Phase 2 — the swaps
1. Replace the mock provider with `useTeamRoster`, feeding the page's **period state** to the hook per its
   real signature; render the returned rows.
2. Remove the local `sortRows` copy; `import { sortRows } from '...lib/teamRoster'`; keep the client-side
   sort applied to the hook's rows (sort stays UI-side; period scoping is the hook's job).
3. Map the hook's **loading → skeleton**, **error → error state**, **empty (no members) → empty**,
   **empty-period (rows present, production all null) → empty-period banner**. Per-cell "—" already handled.
4. Keep the period picker **bounded to the current year (2026)** per the locked v1 decision — past-year
   navigation stays disabled; Month/Week navigate within the current year.

## Phase 3 — tests + the real-data smoke (NOT waivable — this is the point of the brief)
1. Re-run the 49 roster component tests (they use fixtures → still pass) + full suite + lint + build.
2. **Real-data smoke against `tatillife_smoke`:**
   - Read `functions/scripts/seed-smoke-data.cjs` to derive the **expected** roster values (members,
     submitted/issued API + apps, persistency, committed target / "—").
   - Log in as the smoke **BM** (`kelsean+smokebm@gmail.com`). Open the **Team Performance** tab.
   - Assert the rendered roster matches the seeded members and their production for the **default period
     (year 2026)**; persistency bands render with **correct band colors** (high → green, mid-80s → amber,
     low → red — finally verifying the 0–100 scale end-to-end); **% of annual goal** shows a value for the
     member with a committed target and **"—"** for the one without.
   - Click a numeric column → roster re-sorts (asc/desc toggle). Switch period grain → **production
     columns update, persistency & % goal do not.** Both themes. Mobile viewport → stacked card.
   - Optional spot-check: log in as the smoke **UM** (`kelsean+smokeum@gmail.com`) → roster scopes to the
     unit only (fewer rows), confirming claim-scoping differs correctly.

## Phase 4-5
- Docs placeholders (CONTEXT.md — note this is a **src/ change that advances Current main HEAD** on merge,
  so the post-merge fill anchors here; FOLLOW_UPS if anything surfaces). Fix any stale brief path notes.
- Push (updates #683). Poll + disposition Gemini (Rule 21). **HOLD for human merge.**

## Out of scope (stays deferred)
- The branch **leaderboard aggregate** (the south-bound cron "Brief 2").
- The two documented #682 limitations: historical-year fetch (current-year-only) and TA-specific-unit
  persistency (full-tenant fetch). Both remain noted, not addressed here.

## Acceptance
- The Team Performance tab renders **real** roster data for the logged-in manager's scope (UM unit / BM
  branch): 8 columns, click-to-sort, period filter (production-only, current-year-bound), persistency band
  + goal heat with correct colors and "—" fallbacks, all four states wired to the hook, both themes,
  mobile card. **Real-data smoke passes against the seeded smoke tenant.** Build-and-hold → on merge the
  tab goes live with real data.

## Risks
- The mock→hook swap is the one real behavior change; the real-data smoke is exactly what catches a
  signature, scale, or scope mismatch — so it cannot be waived.
- CONTEXT.md merge conflict in Phase 0 is expected — resolve, don't panic.
- If persistency bands render all one color under **real** data, the hook is returning 0–1, not 0–100 —
  stop and surface it rather than patching at the UI boundary.
