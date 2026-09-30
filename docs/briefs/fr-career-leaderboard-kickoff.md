# FR round 2 — Career and Leaderboard (kickoff brief, R2-10 / R2-11)

**Status:** ready for dispatch **after the R2-1…R2-9 queue is finished** · **Author:** Claude-web (architect) · **Date:** 29-09-2026
**Source:** Kyron approved the canvas designs on 29-09-2026 ("I like them"). The ruling R-d in `docs/briefs/fr-round2-program.md` § 0 said these two screens wait for designs. They now exist.
**Designs (canonical):** `docs/design-system/screens-fr/D3-Leaderboard.dc.html`, `M3-Leaderboard.dc.html`, `D3-Career.dc.html`, `M3-Career.dc.html` (exported from the "AgencyTrack — Free Redesign" canvas, version 39). They import `D3-Sidebar`, `D3-Trophy` and `M3-Nav`, which are already in that folder. Names and most figures in them are SAMPLE. Every rule, title, unlock line and function comes from the live app.
**Channel:** both slices are `human-merge`. One slice = one branch = one PR, each cut fresh from `origin/main` (`git fetch origin && git pull origin main`).
**Look:** FR only (`useLook() === 'fr'` in `AgentDashboard.jsx`). The Nexus look, `ManagerDashboard`, `SmLeaderboardView` and every manager surface stay unchanged.
**Delegation (CLAUDE.md):** the pinned model keeps design, derivations, the level verdict and review. Use Haiku 4.5 for searches, log reading and test-count runs. Use Sonnet 5 only for edits the main model has specified exactly.

## 0. Order and dependencies

| # | Slice | Model / effort | Starts when |
|---|---|---|---|
| R2-11 | Leaderboard FR port | Opus 5.5 / medium | the R2-1…R2-9 queue is finished |
| R2-10 | Career FR port | Opus 5.5 / high | R2-11 is open, and **R2-1 and R2-5 are merged** (Career uses the 2-dp helper and R2-5's Trophy room card) |

Phase 0 of R2-10: `git log origin/main --oneline | grep -E "R2-1|R2-5|2-dp|badge merge"`, or read the squash titles. If either one is missing: **STOP and wait for dispatcher**.

## 1. Phase 1 — verify before building (Rule 17)

Paste each command and its output in the PR body. If a claim below is wrong, correct it in the PR body (no strike). Stop only if the correction changes scope.

```
git grep -n "production-leaderboard\|FrArenaHeader\|activeTab === 'career'\|<CareerPortal" -- src/components/dashboard/AgentDashboard.jsx
git grep -n "export default function ProductionLeaderboardSurface\|useLeaderboard(\|useWeeklyChampions(\|useLeaderboardScope(\|applyScope(\|computeAroundMe(\|useAppSettings(" -- src/components/leaderboard/ProductionLeaderboardSurface.jsx
git grep -n "export function arenaStanding\|export function trophyRoom\|export const ARENA_PERIODS" -- src/lib/fr/competeModel.js
git grep -n "^const CAREER_LEVELS\|^const LEVEL_TAGLINES\|^const UNLOCK_COPY\|^function estimateWeeksToNextLevel\|^function computeQuarterlyAPI\|^function weeksSubmittedThisYear\|^function GoalsSection\|^function LevelDrillDrawer\|^export default function CareerPortal" -- src/components/profile/CareerPortal.jsx
git grep -n "export" -- src/components/fr/charts/index.js
git grep -n "initialTab\|startTab" -- src/components/fr/money/
```

What these should show (as of `258a7098`):
- In FR, Arena renders `<FrArenaHeader>` and then `<ProductionLeaderboardSurface key={ptrRevision}>` (`AgentDashboard.jsx` ~983 and ~1320). Career renders `<CareerPortal …>` (~1111) for both looks.
- `arenaStanding(byPeriod, uid)` already returns rank / of / api / apps / gapUp / aboveApi / moved for every period. It is the only per-period rank source, so do not write a second one.
- Weekly champions (`useWeeklyChampions`) are **tenant-wide** (`weeklyChampions/{prevWeekStarting}`, fields `topAPI`, `topApps`, `topActivity`). `topActivity.value` is a count (FFI + CI + apps), **not points**.
- `FrMoney` has no starting-tab prop.

## 2. R2-11 — Leaderboard FR port

**Build:** `src/components/fr/compete/FrLeaderboard.jsx` (container) + `FrLeaderboardView.jsx` (pure view, props only), plus harness scenes in `competeScenes.jsx`. In `AgentDashboard.jsx`, when `fr && activeTab === 'production-leaderboard'`, render `<FrLeaderboard key={ptrRevision} …/>` **instead of** both `FrArenaHeader` and `ProductionLeaderboardSurface`. The pull-to-refresh key still applies.

**Decisions locked:**
1. **One state source, no drift.** Commit 1 moves the surface's state and derivation into a hook, `src/hooks/useProductionLeaderboard.js`. That covers: the period state with the saved-default seeding (session change wins), `useLeaderboard(branchIdOverride)`, `useWeeklyChampions`, `unitOptionsFromRanking`, `useLeaderboardScope`, `applyScope`, podium/tail slices, both around-me computations, `reload`, and `computedAt`. `ProductionLeaderboardSurface` then consumes the hook. **All existing leaderboard tests pass unchanged**; any assertion edit means **STOP and wait for dispatcher**. The FR container uses the same hook plus `arenaStanding` for the per-period ranks.
2. **Every live function stays:** WK/MTD/QTD/YTD (radiogroup, arrow keys); the scope picker, rendered exactly when today's `LeaderboardScopeControl` renders; last week's champions; the top-3 podium; ranks 4–8 with a bar showing % of the leader (`leaderApi` of the displayed scope); the around-me cluster with its "+N agents" gap row. Also the loading, empty and error states, including the `permission-denied` copy and the Retry button that calls `reload`, and the "Updated DD-MM-YYYY HH:mm" footer. `isTestAccount` exclusion is untouched because it already happens upstream.
3. **New, all derived at read time from data already loaded (no new reads, no writes):**
   - **Rank per period:** four columns from `arenaStanding`. The selected period is highlighted. A missing rank shows "—" with the text "Not on the board yet".
   - **To pass:** `gapUp` and the name of the agent above, with a bar of `api / aboveApi`. At #1 it says "You lead".
   - **Share donut:** your `periodApi` ÷ the sum of `periodApi` over the **displayed** ranking (the chosen scope). The label says "of the branch" or "of the unit" to match the scope. If the sum is 0, hide the donut and show nothing in its place.
   - Around-me and "you" rows use the design's accent ring. The phone keeps the pinned "You" bar above `M3-Nav`.
4. **Champions strip copy:** "Week NN champions · whole company". Values come from the doc: `topAPI` → TTD amount, `topApps` → "N apps", `topActivity` → "N activities" (the design's "312 pts" is sample copy; do not invent points). A missing category shows "No winner this week". Trophy kinds are `aotm-api`, `aotm-apps` and `big-week` from `trophyKinds.js`.
5. **Not in FR:** the `MovementChip` stays only if the design space allows it; the per-row movement arrow may be dropped in FR. `moved` still feeds the "Up N since last update" line under your rank. If you drop the chip, say so in the PR body.
6. FR kit only (`src/components/fr/charts`: `Donut`, `Columns`, `Meter`) and FR tokens. No inline styles beyond the kit's existing pattern. 44 px targets.

**Tests:** hook parity (the Nexus surface and the FR view get identical podium/tail/around-me for one fixture, in both scopes); share = mine ÷ displayed sum, and it is hidden at 0; the rank-per-period values equal `arenaStanding`; the champions mapping, including a missing category; the error branch calls `reload`; the Nexus surface's existing tests are untouched.

## 3. R2-10 — Career FR port

**Build:** `src/components/fr/you/FrCareer.jsx` (container) + `FrCareerView.jsx` (pure view), plus harness scenes. In `AgentDashboard.jsx`, when `fr && activeTab === 'career'`, render `FrCareer`; the Nexus look keeps `CareerPortal` (as left by R2-5).

**Decisions locked:**
1. **Commit 1 — extract, pinned by tests first.** Write characterization tests against today's `CareerPortal` outputs for representative fixtures. Cover: current level at each boundary (level 1…7, persistency null, years null); `estimateWeeksToNextLevel` strings ("You qualify!", weeks ≤ 4, months, null); quarterly API for 8 quarters; the YTD stats. Then move the pure parts into `src/lib/career/careerModel.js`: `CAREER_LEVELS`, `LEVEL_TAGLINES`, `UNLOCK_COPY`, `getLevelState`, `computeQuarterlyAPI`, `weeksSubmittedThisYear`, `estimateWeeksToNextLevel`, a `careerStats(submissions, persistencyData, user, year)` function returning today's memo output, and `currentLevel(stats)`. `CareerPortal` imports them. The tests pass **unchanged**; any assertion edit means **STOP and wait for dispatcher**. Level thresholds, the verdict logic and the estimate maths do not change.
2. **Persistency source stays as it is today:** the average of this year's records (`aggregatePersistency`). That figure decides the level, so it is not switched to the outlook estimate (the design caption "Sep 2026 estimate" is sample text). Display and comparison use R2-1's `formatPersistencyPct` / `roundPersistencyPct`, so 89.996 passes a 90 level.
3. **Ladder:** 7 coins, done / you-are-here / locked. Desktop is horizontal; the phone is vertical. Each coin is a button (`aria-pressed` on desktop, `aria-expanded` on phone). Selecting a level shows its tagline, its criteria with your progress and its unlocks, **in the right-hand inspector on desktop** and **inline under the level on the phone**. This replaces `LevelDrillDrawer` in FR with the same content: the drawer's fields and copy, `UNLOCK_COPY` verbatim. Default selection: the next level, or the top level if you are there.
4. **Next level:** one ring per criterion that level has (Legend has only years), showing % complete, the value against the threshold, and "cleared" / "to go". At level 7 show "Top level reached" instead.
5. **Pace card:** "At your pace" shows `estimateWeeksToNextLevel(...)` verbatim, plus one line of what it is built from (weekly pace, API still needed). When it returns null: "Not enough weeks submitted yet to estimate". The second block is headed **"Biggest gap"**, not the design's "Fastest lever", because it names the unmet criterion **furthest behind**. That is the lowest % complete, excluding years of service, which cannot be sped up. For applications add "about N a week to 31-12" (remaining ÷ weeks left this year, rounded up). For API and persistency show only the amount to go. If every production criterion is cleared, hide the block. The button "Plan it in the Game plan" goes to the Money tab. **Pre-authorised (Rule 1):** you may add an `initialTab` prop to `FrMoney` if it is a pass-through to its existing tab state and nothing more; otherwise open Money and bank a follow-up (Rule 7b).
6. **Trajectory:** 8 quarterly columns from `computeQuarterlyAPI`. The current quarter is highlighted, with a text alternative listing the values.
7. **Annual commitment:** `GoalsSection`'s logic is reused as-is: `getGoals`, `setGoals`, `getCompanyMinimums`, `getMoneyNeeds`, the edit form (same three fields, same validation, same save), the Money-needs nudge ("Yes, continue" / "Cancel") and the tenure-resolved API floor. Move its data and handlers into a hook (`useCareerCommitment`) used by both looks, with the existing save behaviour pinned by a test first. FR shows each row as an FR `Bullet`:
   - the fill is **this year's actual** (YTD API, YTD apps, this year's persistency, all from `careerStats`);
   - there are markers for **your commitment**, the **manager target** (when set) and the **company floor**;
   - when your commitment is below the floor, one line says so. That keeps today's warning signal, in words instead of colour.
   The "Edit my goals" header button toggles the form.
8. **Trophy room card:** the card R2-5 adds, restyled. It shows earned ÷ total as a `Donut`, from the same `useMyLeaderboardEntry` + `trophyRoom()` read, and a button that opens the `trophies` tab.
9. FR kit and tokens only; 44 px targets; every section has loading, empty and error states (commitment read failed → Retry; no submissions → empty trajectory text).

**Tests:** the characterization suite (above); ring percentages and the cleared state at the exact threshold (including persistency 89.994 / 89.996 against 90); biggest-gap selection (ties go to the earlier criterion in level order: API, apps, persistency); the weekly apps rate across a year boundary; the commitment hook's save and nudge path making the same service calls with the same arguments as today; level selection updating the inspector (desktop) and expanding inline (phone); keyboard reachability of every coin.

## 4. Named rituals (both slices)
1. Phase 1 commands and their output in the PR body (Rule 17).
2. Local gates: `npm run lint` 0 · full `npm test` · `npm run build`.
3. FR harness walk (`scripts/verification/fr-harness-walk.mjs`), both themes, at desktop, tablet and phone. Review the screenshots side by side with the canvas design and list any deliberate differences in the PR body.
4. Mutation check on each new derivation test (share, biggest gap, ring cleared); paste the result.
5. CI green (one re-run allowed for a named known flake). Request `@coderabbitai review` once; Rule 21 table.
6. PR-ready report with the HEAD SHA (Rule 20) and gaps (Rule 22). Close or bank follow-ups in the same PR (Rule 7 / 7b).

## 5. Stops
- Any new Firestore read, collection, index or rules change: **STOP and wait for dispatcher**.
- Any change to level thresholds, the level verdict, the estimate maths, the leaderboard ranking or scope maths, or any money calculation: **STOP and wait for dispatcher**.
- Any characterization or parity test whose assertion needs to change: **STOP and wait for dispatcher**.
- Anything that would touch production data, deploy, or merge: **STOP IMMEDIATELY**. Preview smokes are read-only (feature previews run against production Firebase).
