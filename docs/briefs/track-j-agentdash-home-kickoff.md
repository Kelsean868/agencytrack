# Track J — V2 Redesign · Agent Dashboard, PR 2 of 2: Home-Body Rework (J-AD-home)

**Branch:** `redesign/agentdash-home`
**Base:** `main` @ `eed95b5`
**Channel:** GATED — human merge + dispatcher pre-review. **Auto-merge does NOT apply.**
**Smoke:** REQUIRED (major user-visible change).
**References:** `design_handoff_v2_app/mockups/AgencyTrack Agent Dashboard v2.html`, `app-dashboard-v2.jsx`. Operating contract: `docs/briefs/track-j-shell-kickoff.md`.

PR 2 of 2 for the Agent Dashboard. PR 1 (#392) shipped the nav IA. **This PR reworks only the home tab (`activeTab === 'dashboard'`) body + the AgentDashboard Shell invocation (greeting→subtitle). It does NOT touch the nav.** All data the new surfaces need is already computed in AgentDashboard — this is a composition + visual refactor, **no service/rule/index/CF/collection changes**.

---

## Confirmed (earlier decision round)
Accept the v2 home: the 7-KPI grid and the always-visible WeeklyStandardCard become on-demand; the home is the Hero + PulseStrip + Recent layout.

## Dispatcher-level decisions (no further input)
- **MDRT threshold:** extract the existing `MDRT_THRESHOLD = 500000` from `CareerPortal.jsx` to a shared constant module; import in both CareerPortal and HeroCard.
- **YoY delta chip:** DROP from HeroCard (no last-year aggregation exists); bank a LOW FU.
- **Greeting → topbar subtitle:** AgentDashboard's Shell invocation → `topbarTitle="Dashboard"`, subtitle/crumb = `"{displayName} · {weekday} {date} · Week {N}"`; delete the duplicate body greeting `<h2>`. Per-dashboard prop change only — do NOT modify the shared TopBar component.
- **Streak / awards derivations:** reuse existing engines (`computeAgentAwards`, `aggregatePersistency`); extract HistoryTab's streak computation to a shared util and import it — do not duplicate.
- **DeliveryStripCard:** STUB (it self-guards to `null` when its data module is absent — render nothing); bank a LOW FU to wire it to the existing Track H `policies` data (`policyDeliveryDate`) later.
- **Tokens:** `surfaceSoft` → `var(--color-surface-muted)`; `inkDim` → `var(--color-border-strong)`; `#fff` CTA text → `text-white`; scrims → `bg-black/20`; drawer shadows → `var(--shadow-lg)`. **No new tokens.**

---

## Scope — home tab body

### BUILD (new presentational components; data already on hand)
- **HeroCard** (`dashboard/AgentDashboard/HeroCard.jsx` or similar): big YTD API number (`ytdTotals.api`), progress bar to `personalAnnualAPI` with an MDRT marker at the shared constant, "NEXT STEP" eyebrow + "Submit weekly report" CTA → `setShowWizard(true)`. Replaces GoalCarousel. (No YoY chip.)
- **PulseStrip** + sub-pieces (`PulseChip`, `PulseIcon`, `MiniSparkline`, `MiniDonut`, `MiniBars`, `PulseBadge`): 6 chips — Activity (6-wk sparkline from `kpiData` history), Standard ("N of 10 met" donut from `resolvedMinimums` + current-week floor status), Awards (closest in-contention donut via `computeAgentAwards`), Persistency (% + trend sparkline from `persistency`), Streak (bars from the extracted streak util), Action (count from existing daily/weekly flags). **Each chip is a `<button>`** — 44px min, `aria-label` — that opens the relevant detail (Standard → the StandardDetail drawer; others may open their existing tab or a small detail). Mini-vizzes are SVG, tokens only, `aria-hidden` (decorative; the chip's text carries the meaning).
- **StandardDetail drawer**: the 10-row Expected-vs-Actual (same `resolvedMinimums.weeklyActivityFloors` + `extractFields(currentWeekSub)` data as WeeklyStandardCard). Drawer shell mirrors the existing `AwardDrillDrawer`/`LevelDrillDrawer` pattern — `role="dialog"`, `aria-modal`, focus-trap, ESC-to-close, `focus-visible` rings. Refactor the WeeklyStandardCard row into a shared `<StandardRow>` rather than duplicate.
- **Recent panel** (2-col): left = compact 4-item Recent list (top 4 of existing `activityEvents`); right column = DeliveryStripCard (STUB → null) + active campaign card (reuse existing `CampaignCard`).
- **Needs-action banner**: restyle the existing E6 daily-nudge banner to the v2 warning/amber treatment and position it above the Hero. Reuse the existing nudge conditions — not a new data path.

### REMOVE from the home tab
GoalCarousel (→ HeroCard), the 7-KPICard grid + WoW strip (→ Activity chip + History), the always-visible WeeklyStandardCard (→ StandardDetail drawer), the inline Goals section, the full ActivityFeed (→ compact Recent), BadgeGrid, and **GapAnalysisPanel** (now lives in the Goals tab from #392 — this removes the temporary double-render). Keep the four computed inputs (`hierarchy`, `ytdTotals`, `hierarchyLoading`, `hierarchyError`) in state — the Goals tab still consumes them.

### OUT of scope
DeliveryStripCard real data; HeroCard YoY; the CRO/Delivery surface; Game Plan; any nav change; any service/rule/index/CF change (if one seems required → **STOP and wait for dispatcher**).

---

## Phase 0 — clean-base gate
```
git checkout main && git fetch origin && git pull --ff-only origin main && git rev-parse HEAD
```
Expect `eed95b5…`. Branch `redesign/agentdash-home` off fresh main; this brief is commit 1.

## Phase 1 — source-verify (read-only; STOP on any miss)
Confirm: the home-tab data sources from the audit (`ytdTotals`, `personalAnnualAPI`, `kpiData`, `resolvedMinimums`, `persistency`, `computeAgentAwards` inputs, `activityEvents`) are all in AgentDashboard state; HistoryTab's streak helper to extract; the `AwardDrillDrawer` pattern to mirror for StandardDetail; `CampaignCard` reuse. If any required datum is NOT already computed (would need a new service/query) → **STOP and wait for dispatcher**.

## Phase 2 — implement
Build the components above; rewrite the home-tab JSX to the Hero + PulseStrip + Recent layout; restyle+reposition the needs-action banner; move the greeting to the Shell subtitle and delete the body greeting; extract the MDRT constant + streak util. Tokens only. No nav, service, rule, index, or CF changes.

## Phase 3 — verify
`npm run lint` (0) · `npm test` (green) · `npm run build` (clean). **axe: NO-NEW serious/critical vs the `origin/main` baseline** — use the build-and-serve baseline-comparison method from #392 (`axe-nav-check.mjs` style); report both node lists and confirm the home rework adds zero new failing nodes. Verify light AND dark. Confirm: every Pulse chip is a 44px labelled button; the StandardDetail drawer traps focus + closes on ESC; removed blocks are gone; the Goals tab still renders GapAnalysisPanel.

## Phase 4 — docs (placeholders)
- `docs/CONTEXT.md`: Recently-shipped row (`#TBD`/`{TBD}`); note the Agent Dashboard pair is now complete.
- `docs/FOLLOW_UPS.md`: bank LOW FUs — (1) HeroCard YoY-delta chip (needs last-year aggregation); (2) DeliveryStripCard wire to Track H `policies`/`policyDeliveryDate` data.

## Phase 5 — commit, push, open PR — then STOP
Commit; push `redesign/agentdash-home`; open the PR into `main` (smoke box unchecked). **Do NOT merge. Do NOT deploy.** Report verbatim: `gh pr diff <n> --name-only`, lint/test/build results, the axe baseline-delta node lists, both-themes notes. Then **STOP and wait for dispatcher.**

## Phase 6 — post-merge smoke (separate dispatch, after dispatcher merges)
Prod smoke via `setupBypassSession`, light + dark: HeroCard renders with YTD + progress + MDRT marker; the Submit CTA → wizard; all 6 Pulse chips render with mini-vizzes; the Standard chip opens the StandardDetail drawer (focus-trap + ESC); Recent shows ≤4 items; DeliveryStripCard renders nothing (stub) with no console error; the needs-action banner shows when appropriate; greeting is in the topbar subtitle. No rules/indexes/CF — no live-rule check. Fill `#TBD`/`{TBD}` with the squash SHA, push direct to main, verify Rule 15 (BOTH full 40-char SHAs, HEAD == origin/main). Report verbatim and STOP.

## STOP conditions (Rule 12)
- Phase 0 HEAD mismatch.
- Any new surface would need data not already computed (new service/query/collection).
- A new token / rule / index / CF / route would be required.
- axe would add ANY new serious/critical node vs the main baseline, or a chip/control would drop below 44px.
- The work would touch the nav, the shared TopBar component, or any non-home tab.
Any of these → **STOP and wait for dispatcher.**
