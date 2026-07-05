# AgencyTrack — Whole-Webapp Runtime-Efficiency Audit

**Date:** 2026-07-05
**Scope:** Deep runtime-efficiency pass across `src/` (hooks, services, components) and `functions/`, plus a real production-build chunk analysis. Read-only; nothing modified, committed, or deployed.
**Method:** Direct source review + `npm run build` (real chunk report) + import-graph grep. Every finding cites `file:line`.
**Relationship to the 2026-07-04 audit:** That audit's §3.C/§3.D flagged PERF-001..008 / COST-001..003 at a survey level and explicitly deferred the deep runtime pass. This report is that deep pass. Where a finding overlaps a prior ID, it is noted and **quantified / corrected** rather than restated; several prior findings are confirmed with measured numbers, one bundle number is now real (not estimated), and new findings (EFF-001 context re-render, EFF-006 hourly-cron waste, EFF-010 Leaderboard whole-users read, EFF-013 KPICard puts Recharts on the critical path) are added.

> **Audit-only caveat:** No runtime profiler was attached (no Chrome DevTools/React Profiler trace against a live tenant). Re-render counts and ms figures are reasoned from code structure and the measured bundle, not captured from a running session. Items needing a live trace are marked **Needs-verification**.

---

## 1. Executive summary

The single most consequential efficiency fact in the app is the **bundle**: `npm run build` emits **one 3.95 MB JavaScript chunk (1.13 MB gzipped)** with **zero code-splitting** — there is not one `React.lazy` or dynamic `import()` anywhere in `src/`. Every field agent on a phone downloads and parses the entire manager portal, the PDF renderer, Recharts, and every panel before first paint. This dwarfs every other efficiency issue and is the top remediation target.

Behind it sit three clusters:

1. **Firestore read amplification** — a per-campaign submissions fan-out on the agent home screen, an N+1 persistency map, an N+1 per-member goals fetch in the team roster, and per-agent GET fan-outs in CompliancePanel that re-fire on every week/lens change. The good news: the codebase already contains the correct batched pattern (`settlementService.getSettlementsForUnit` uses `where('agentId','in', batch)` with 30-chunking) — most N+1 fixes are "copy that pattern."
2. **React re-render cost** — the app-wide `AuthContext` value object is rebuilt unmemoized on every provider render, so any auth-state change re-renders every consumer; unmemoized `new Date()` props on both dashboards defeat child memoization; and three large manager tables (MasterSheet, TeamPerfRoster, MasterSheet-style rosters) render full un-virtualized row sets.
3. **Cloud Functions cost/latency** — `onSubmissionWrite` does up to **52 sequential** Firestore round-trips (streak backfill) **plus** a full YTD scan on *every* submission write; the leaderboard cron recomputes the entire tenant **hourly regardless of whether anything changed** (24 full scans/day at zero-activity); and no function sets region or memory, so all run at default `us-central1`/256MB with cold starts on every idle gap.

**Counts by severity:** High 5 · Medium 9 · Low 4 (18 findings).
**Counts by dimension:** Reads/writes 7 · Re-render 4 · Bundle 3 · Functions 4.

**Top 5 by impact**

| Rank | ID | Finding | Severity |
|------|-----|---------|----------|
| 1 | EFF-002 | No code-splitting — single 3.95 MB / 1.13 MB-gzip entry chunk | High |
| 2 | EFF-004 | `onSubmissionWrite`: 52 serial round-trips + full YTD scan per write | High |
| 3 | EFF-003 | AgentDashboard campaign submissions fan-out (N tenant-window scans on home screen) | High |
| 4 | EFF-001 | Unmemoized AuthContext value → app-wide re-render on any auth change | High |
| 5 | EFF-006 | Leaderboard cron: full-tenant recompute hourly regardless of activity | High |

---

## 2. Findings

### A. Bundle & first load

---

**EFF-002 — No route/code-splitting: entire app ships as one 3.95 MB (1.13 MB gzip) chunk**
- **Status:** ✅ **ADDRESSED (Phase 1) — PR `perf/eff002-code-splitting` (HELD for human merge).** `App.jsx` now `React.lazy()`s all three role dashboards (Agent / Manager / TenantAdmin) behind a single `<Suspense>` with the app's existing themed `LoadingScreen` fallback. **Measured (`npm run build`): entry chunk `index-*.js` 644.85 → 221.55 kB gzip (−423.3 kB / −65.6%)** on top of the EFF-011 baseline; new per-role chunks (ManagerDashboard 96.59 · AgentDashboard 27.22 · TenantAdminDashboard 17.41 kB gzip) load only for the matching role. Recharts left the entry chunk. Adversarial smoke (`scripts/verification/smoke-eff002-code-splitting.mjs`, now **66/66** both themes) proves an **agent session never fetches the Manager/TenantAdmin chunks** — the core goal. **Load-path safety net added (EFF-002-safety FU):** a `ChunkLoadErrorBoundary` (`src/components/ui/`) wraps the `<Suspense>` so a *rejected* dashboard `import()` — the classic stale-cached-`index.html` → dead-chunk-hash-after-redeploy case that Suspense does NOT catch — renders a themed reload fallback instead of a white screen (verified by the smoke's `chunk-fail-*` legs: fallback + working 44px Reload, not blank, both themes). That closes the one load-path risk this split introduced. **Phase 2 (per-manager-tab splitting) DEFERRED:** naive per-panel `lazy()` fans shared leaf modules (lucide icons/utils) out into 36–50 tiny chunks without a Rollup `manualChunks` vendor-grouping strategy (a build-config decision), for a manager-only marginal gain — banked as an FU in `docs/FOLLOW_UPS.md` to be done together with the `manualChunks` work. The PDF engine (EFF-011) was already split in #802 and is untouched.
- **Severity:** High · **Confidence:** Confirmed (real build).
- **Location:** build output `dist/assets/index-*.js` = **3,947.43 kB / gzip 1,133.16 kB**; `src/App.jsx` eager-imports both dashboards; **grep for `React.lazy` / `lazy(` / dynamic `import(` across `src/` returns zero matches**.
- **Impact (bytes/ms):** A field agent on a 3G/4G phone downloads + parses ~1.13 MB gzip (≈3.95 MB parsed) before the dashboard paints. Manager-only surfaces (MasterSheet, CompliancePanel, all financing/awards/kiosk panels), the PDF renderer, and Recharts are all in the agent's first byte even though an agent never opens them. Build reporter itself warns "chunks larger than 500 kB."
- **Fix shape:** (1) `React.lazy` the two dashboards in `App.jsx` behind a `<Suspense>` so an agent never loads manager code. (2) `React.lazy` the heavy manager tabs (each `activeTab ===` branch in `ManagerDashboard.jsx:445-624` is already a clean conditional-mount boundary — ideal split points). (3) Dynamic-`import()` the PDF/export module at the download call site (see EFF-011). (4) Lazy-load Recharts-bearing tabs (see EFF-013). Expected: entry chunk down to a few hundred KB gzip; agent bundle excludes the entire manager tree.
- **Effort:** M · **Change-risk:** Low (lazy boundaries at existing conditional mounts) · **Priority:** P1.

---

**EFF-011 — `@react-pdf/renderer` is statically imported into the entry chunk**
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). Dynamic-imported `@react-pdf/renderer` + `AgentReportDocument` inside `generateAgentPDF`. **Measured:** entry chunk **1,133.38 → 644.85 kB gzip (−488.5 kB / −43%)**; react-pdf is now a lazy 481 kB-gzip chunk loaded only on first export.
- **Severity:** High (subset of EFF-002, called out because it is the single heaviest dependency) · **Confidence:** Confirmed.
- **Location:** `src/services/exportService.js:2` (`import { pdf } from '@react-pdf/renderer'`) and `src/components/profile/AgentReportDocument.jsx`; `exportService` is imported by the dashboards, so the PDF engine is eager.
- **Impact (bytes):** `@react-pdf/renderer` is one of the largest React libraries in the ecosystem (hundreds of KB). It is used only when a manager clicks "Download report" — a rare, interactive, non-first-paint action. Shipping it eagerly to every agent on every load is pure waste.
- **Fix shape:** Convert `exportService` to `const { pdf } = await import('@react-pdf/renderer')` inside the export function, and dynamic-`import()` `AgentReportDocument`. The download handler is already async, so no UX change beyond a one-time chunk fetch on first export.
- **Effort:** S · **Change-risk:** Low · **Priority:** P1.

---

**EFF-013 — Recharts sits on the agent first-paint path via `KPICard.jsx`**
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** Recharts is imported by exactly three files (`grep`): `src/components/dashboard/KPICard.jsx`, `src/components/agent/PersistencyTab.jsx`, `src/components/goals/CommissionPlayground/components/CashFlowChart.jsx`. **`KPICard` renders on the agent dashboard's default view** (sparklines), so Recharts is in the critical first-paint chunk, not just chart tabs.
- **Impact (bytes/ms):** Recharts + its D3 sub-deps are ~300-400 KB parsed. The KPICard sparkline is a tiny inline chart — using the full Recharts `ResponsiveContainer`/`LineChart` for it is expensive relative to what it draws.
- **Fix shape:** Either (a) lazy-load Recharts only for the chart-heavy tabs and replace the KPICard sparkline with a hand-rolled inline SVG polyline (a sparkline is ~15 lines of SVG and removes Recharts from first paint entirely), or (b) if keeping Recharts on the dashboard, at minimum ensure the manager-only chart tabs are lazy so the agent bundle can drop it. Option (a) is the higher-value move.
- **Effort:** M · **Change-risk:** Med (KPICard is a shared visual primitive; verify sparkline parity in both themes) · **Priority:** P2.

---

### B. Firestore read/write amplification

---

**EFF-003 — AgentDashboard fires one tenant-window submissions scan per active campaign** *(confirms prior BUG-001/PERF-002, quantified)*
- **Severity:** High · **Confidence:** Confirmed.
- **Location:** `src/components/dashboard/AgentDashboard.jsx:343-360`; query `src/services/campaignService.js:141-150` (`getCampaignSubmissions` — `where weekStarting >= start, <= end, status == submitted`, no `limit`).
- **Impact (reads):** On **every** agent dashboard mount, after resolving N active campaigns the code does `Promise.all(camps.map(c => getCampaignSubmissions(...)))` — **N parallel whole-tenant date-window scans**. Each returns every submitted submission from every agent in the tenant for that window. Read cost ≈ **N × (tenant agents × weeks-in-window)** submission docs, materialized client-side, per agent, per mount. With 3 active branch campaigns over a month and 50 agents, that is 3 × ~200 = ~600 doc reads on one agent's home screen — and overlapping campaign windows re-read the same docs N times.
- **Fix shape:** (a) Dedupe: compute the min-start/max-end across all campaigns, run **one** windowed query, filter per-campaign client-side. (b) Better: precompute campaign progress server-side (a CF writing a small `campaignProgress/{campaignId}` aggregate doc) so the agent reads O(N) tiny docs instead of O(tenant) submissions. (a) is the quick win; (b) is the scale answer.
- **Effort:** M · **Change-risk:** Med · **Priority:** P1.

---

**EFF-004 — `onSubmissionWrite`: up to 52 serial round-trips (streak) + full YTD scan, per submission write** *(confirms prior PERF-007, quantified + second scan detailed)*
- **Severity:** High · **Confidence:** Confirmed.
- **Location:** `functions/index.js:1438-1452` (streak loop), `1487-1495` (YTD scan).
- **Impact (reads/ms):** For every submission that transitions to `submitted`, the trigger:
  1. Loops **up to 52 times**, each iteration doing a **separate sequential `getDocs`** for the prior week (`:1442-1448`). A tenured agent with a long streak triggers dozens of serial round-trips — latency scales linearly with tenure and blocks the write handler.
  2. Then reads the agent's **entire submitted-submissions history** (`:1487-1491`, no date filter — the year filter is applied *client-side after* fetching all docs at `:1494`) and reduces for YTD API.
  Total: (streak length) serial reads + (full career submissions) on every single submission write.
- **Fix shape:** Maintain `weeklyStreak`, `lastSubmittedWeek`, and a running `ytdApi` incrementally on the `leaderboard/{agentId}` doc. On each write, read the one leaderboard doc, compare `lastSubmittedWeek` to decide streak increment/reset in O(1), and add the current submission's API to the running YTD total (resetting on year rollover). Eliminates both the loop and the scan. Note: the YTD reducer at `:1495` reads `d.data().apiSold` only — it ignores the v2 nested `newBusiness.api` shape that `:1459` correctly handles, so tenured v2 agents' YTD badge math is also *wrong*; the incremental rewrite fixes this as a side effect (flag to the remediation dispatch as a correctness rider).
- **Effort:** M · **Change-risk:** Med (touches gamification math; covered by `functions/__tests__/onSubmissionWrite.test.js`) · **Priority:** P1.

---

**EFF-005 — `getPersistencyMapForYear` is N+1: one query per agent** *(confirms prior PERF-005)*
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). Batched to `where('agentId','in', chunk≤30) + where('year','==', y)`, mirroring `getSettlementsForUnit`; equality-class filters so no composite index needed. Return shape + `isE3Doc` filter preserved; per-batch skip-on-denial.
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/services/persistencyService.js:176-189` (`await Promise.all(agents.map(... one getDocs per agent ...))`).
- **Impact (reads):** One `persistency` query per agent (roster size = query count) on every branch CSV export / year rollup. For a 50-agent branch that's 50 queries where 2 batched `in` queries would suffice.
- **Fix shape:** Mirror `settlementService.getSettlementsForUnit` (`settlementService.js:21-40`) exactly — chunk agentIds into ≤30 and issue `where('agentId','in', batch)` + `where('year','==', year)`. The batched pattern already exists in-repo; this is a copy.
- **Effort:** S · **Change-risk:** Low · **Priority:** P2.

---

**EFF-007 — `useTeamRoster` fetches goals with one `getDoc` per member** *(confirms prior PERF-005 roster arm)*
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). New `getGoalsForAgents` in `goalsService` (batched `where(documentId(),'in', chunk≤30)`) replaces the per-member fan-out in `useTeamRoster`; reader kept in the service layer per convention. `goalsByAgent` Map shape unchanged.
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/hooks/useTeamRoster.js:84` (`await Promise.all(agentIds.map((id) => getGoals(tenantId, id)...))`); `getGoals` is a single-doc get (`goalsService.js:11`).
- **Impact (reads):** N per-member doc-gets on every team-roster load (and on every period change, since the effect re-runs on `grain`/`value`). TA/PA see the whole tenant.
- **Fix shape:** Batch via `documentId() in` chunks (goals doc IDs are deterministic per agent) or a single `where(documentId(),'in', batch)` query in ≤30 chunks. Reduces N gets to ⌈N/30⌉ queries.
- **Effort:** S · **Change-risk:** Low · **Priority:** P2.

---

**EFF-008 — CompliancePanel per-agent plan GET fan-out re-fires on every week/lens change** *(confirms prior PERF-006)*
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/components/manager/CompliancePanel.jsx:199-204` (plan-adoption fan-out), `227-234` (nudge-record fan-out).
- **Impact (reads):** `Promise.all(rosterUids.map(uid => getWeeklyPlan(...)))` — one deterministic-ID GET per roster agent, re-triggered whenever `selectedWeek` changes (`:204` dep). Navigating four weeks back on a 50-agent full-company view = ~200 GETs. The nudge-record fan-out (`:230`) adds another per-exception fan-out on lens switch.
- **Note:** The prior audit correctly records that the deterministic-GET (vs collection-group list) was a *deliberate* index-avoidance tradeoff. The efficiency cost is real but the design choice is defensible at pilot scale.
- **Fix shape:** At larger rosters, replace the per-uid GET fan-out with a single collection-group `where('weekStarting','==', week)` scoped query + composite index (the standard `weekStarting`-indexed pattern already exists for submissions). Add a short-lived client cache keyed on `(week, rosterKey)` so week-nav back-and-forth doesn't re-fan-out.
- **Effort:** M · **Change-risk:** Med (collection-group rules per the banked collectionGroup gotcha) · **Priority:** P2.

---

**EFF-010 — Leaderboard reads the entire `users` collection just to build a photo map**
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/components/gamification/Leaderboard.jsx:93-107` (`getDocs(collection(db, 'tenants/${tenantId}/users'))` → keeps only `photoURL`).
- **Impact (reads):** A whole-tenant users read on every Leaderboard mount, discarding all fields except `photoURL`. This runs alongside the `onSnapshot` leaderboard listener and the champions query (`:110`), so a Leaderboard mount is 1 full users scan + 1 full-leaderboard listen + 1 windowed submissions scan. On the manager dashboard, the same `getTenantUsers` full read is also pulled by `useBranchOverview` / `useTeamRoster` (prior COST-003), so users can be read 2-3× across co-mounted surfaces.
- **Fix shape:** (a) The leaderboard aggregate CF already reads users server-side — denormalize `photoURL` onto the `leaderboards/{branchId}` doc (or `leaderboard/{uid}`) so the client needs zero extra reads. (b) Failing that, share one `getTenantUsers` result via a context/provider cache (addresses COST-003 too).
- **Effort:** M · **Change-risk:** Low · **Priority:** P2.

---

**EFF-016 — Unbounded whole-collection reads with no `limit`/pagination** *(confirms prior COST-002)*
- **Severity:** Low (pilot) / Medium (at data growth) · **Confidence:** Confirmed.
- **Location:** `managerService.getAllYTDSubmissions` (whole-tenant YTD, consumed by `useBranchOverview.js:42`, `useTeamRoster.js:55`, `useMyProduction` indirectly); `policiesService.js` TA path; `campaignService.getCampaigns:15-21`. None carries a `limit`.
- **Impact (reads):** Fine at single-branch pilot scale; grows linearly with tenant submission count with no ceiling. `getAllYTDSubmissions` is the workhorse behind the manager overview and roster and is re-fetched on each of those hooks' mounts.
- **Fix shape:** Track as a scale follow-up: add pagination / server-side aggregation before multi-year data accumulates. Combine with EFF-010's shared-cache idea to stop re-reading the same YTD set across co-mounted hooks.
- **Effort:** M · **Change-risk:** Low · **Priority:** P3.

---

### C. React re-render cost

---

**EFF-001 — AuthContext `value` object is unmemoized → every consumer re-renders on any auth-state change**
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). `value` wrapped in `useMemo`; `refreshProfile` moved to `useCallback` with deps `[user, tenantId]` (stable but never stale). Context-split option deliberately NOT taken (out of scope).
- **Severity:** High · **Confidence:** Confirmed (Needs-verification for exact render-count via Profiler).
- **Location:** `src/context/AuthContext.jsx:152` — `const value = { user, userProfile, role, tenantId, branchId, loading, isAuthenticated: !!user, refreshProfile };` built inline, no `useMemo`; provided at `:155`.
- **Impact (renders):** `AuthProvider` wraps the entire app and nearly every component calls `useAuth()`. Because `value` is a fresh object literal on every `AuthProvider` render, any state change in the provider (`setUserProfile` via `refreshProfile`, `setLoading`, the auth listener firing) propagates a new context reference and **re-renders every consumer in the tree** — including both full dashboards and all their children — even when the fields a given consumer reads are unchanged. `refreshProfile` is also a new function identity each render, so consumers that depend on it in effects/callbacks churn.
- **Fix shape:** Wrap `value` in `useMemo(() => ({...}), [user, userProfile, role, tenantId, branchId, loading])` and wrap `refreshProfile` in `useCallback`. For finer control, split rarely-changing identity (role/tenantId) from frequently-changing state into two contexts. The `useMemo`+`useCallback` fix is the low-risk first move.
- **Effort:** S · **Change-risk:** Low · **Priority:** P1.

---

**EFF-009 — `new Date()` created inline as a prop/arg on every dashboard render** *(confirms prior PERF-004, extended)*
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). Stable `const now = useMemo(() => new Date(), [])` in `ManagerDashboard`, `AgentDashboard`, and `useBranchOverview`. (Actual Agent prop site was `AgentDashboard.jsx:692`, not `:693`.)
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/components/dashboard/ManagerDashboard.jsx:469` and `src/components/dashboard/AgentDashboard.jsx:693` (inline `new Date()` props); also `AgentDashboard.jsx:308` and `useBranchOverview.js:171` pass `new Date()` into `buildActivityEvents`/`buildManagerActivityEvents` memo inputs.
- **Impact (renders):** A fresh `Date` reference each render defeats `React.memo` / `useMemo` on the receiving child or hook — award panels and activity-event builders recompute every parent render even when nothing changed.
- **Fix shape:** `const now = useMemo(() => new Date(), [])` (or a day-stable ISO key like `getTodayTT()` where only the date matters) and pass the stable reference. Where the memo only needs "today's date," pass the `YYYY-MM-DD` string, not a `Date`.
- **Effort:** S · **Change-risk:** Low · **Priority:** P2.

---

**EFF-012 — MasterSheet renders an unvirtualized N-row × 26-column table** *(confirms prior PERF-003)*
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/components/manager/MasterSheet.jsx:358-379` (`rows.map` → every row × `COLS.map` every column, sticky columns, per-cell class template).
- **Impact (renders/ms):** Full roster into the DOM with per-cell class computation and sticky positioning; TA/PA render every agent in the tenant. DOM node count = rows × 26; scroll/repaint cost grows linearly.
- **Fix shape:** Virtualize rows (`@tanstack/react-virtual`) beyond ~100, or paginate. Same shape applies to EFF-014.
- **Effort:** M · **Change-risk:** Med · **Priority:** P2.

---

**EFF-014 — TeamPerfRoster renders full row set unvirtualized (desktop table + mobile cards)**
- **Severity:** Medium · **Confidence:** Confirmed.
- **Location:** `src/components/manager/roster/TeamPerfRoster.jsx:359-363` (`rows.map` → `COLS.map`), `:394` (`rows.map` → `MobileCard`). No virtualization import anywhere.
- **Impact (renders):** Same class as MasterSheet — the full scoped roster renders twice in the component tree (desktop `<table>` + mobile card list are both in the JSX; CSS hides one). On a large tenant the manager pays DOM cost for both layouts.
- **Fix shape:** Virtualize or paginate beyond ~100 rows; ensure only the active-viewport layout renders (conditional on a viewport hook rather than CSS-hiding both). Shares a fix template with EFF-012.
- **Effort:** M · **Change-risk:** Med · **Priority:** P2.

---

### D. Cloud Functions

---

**EFF-006 — Leaderboard cron recomputes the full tenant hourly regardless of activity**
- **Severity:** High · **Confidence:** Confirmed.
- **Location:** `functions/leaderboard/leaderboardAggregate.js:438-439` (`.schedule('0 * * * *')`), `loadInputs:56-79` (reads all submitted submissions YTD + **entire users collection** every run).
- **Impact (reads/cost):** **24 full-tenant recomputes per day**, each reading (all YTD submitted submissions) + (all users), even on days with zero submission activity (nights, weekends outside submission windows). At pilot scale this is modest, but it is pure waste: the module's own header comment (`:18-20`) notes an on-write-trigger optimization was deferred to FU.
- **Fix shape:** (a) Short term: drop the cron to a business-hours cadence or every-few-hours; gate the expensive recompute behind a cheap "has anything changed since last run" check (max `updatedAt` probe, or a dirty flag set by `onSubmissionWrite`). (b) Proper: convert to an event-driven debounced recompute triggered by submission writes (the deferred FU), so zero-activity periods cost nothing.
- **Effort:** M · **Change-risk:** Med (touches the leaderboard freshness contract; covered by leaderboard tests + smoke) · **Priority:** P1.

---

**EFF-015 — No global region / memory / minInstances config: all functions default to us-central1 / 256MB with cold starts**
- **Severity:** Medium · **Confidence:** Confirmed (Needs-verification of deployed region in Console).
- **Location:** `functions/index.js` — no `setGlobalOptions`, no `functions.region(...)`; only one `.runWith` in the file (`:700`, bulk import at 256MB/540s). All other exports (callables + triggers + crons) inherit v1 defaults.
- **Impact (ms/cost):** (1) **Region:** default `us-central1` while the pilot's users and Firestore data are Trinidad-facing — every callable pays a US round-trip. If Firestore is a US multi-region this is at least consistent, but region is undocumented (prior PRIV-007). (2) **Cold starts:** no `minInstances` means the money-write callables (`notifyFinancingAdjustment`, `setAgentOfMonth`) and the kiosk validate endpoint cold-start after idle — first-call latency of seconds on an interactive path. (3) **Memory:** default 256MB on functions that load `firebase-admin` + do full-tenant scans (leaderboard cron) risks GC pressure / OOM as data grows.
- **Fix shape:** Add `setGlobalOptions({ region: '<chosen>', memory: ... })` (or per-function `.runWith`). Consider `minInstances: 1` on the 2-3 latency-sensitive interactive callables only (cost-bounded). Confirm the Firestore region first so functions are co-located.
- **Effort:** M · **Change-risk:** Med (region change on already-deployed functions requires redeploy discipline; do NOT change region on a live money path without a migration plan) · **Priority:** P2.

---

**EFF-017 — `notifyCampaignParticipants` fan-out sends one notification write per recipient (no batch)**
- **Severity:** Low · **Confidence:** Confirmed.
- **Location:** `src/services/campaignService.js:112-120, 130-138` — `Promise.all(recipients.map(uid => createNotification(...)))`, one `addDoc` per recipient.
- **Impact (writes):** A branch-scoped campaign launch to 50 agents = 50 individual notification writes from the client. Correct, but a `writeBatch` (up to 500 ops) would do it in one round-trip and is atomic.
- **Fix shape:** Batch the notification writes with `writeBatch`; or move campaign-launch notification fan-out server-side into a CF (also removes the client-side whole-`users` read at `:126`). Low priority at pilot volume.
- **Effort:** S · **Change-risk:** Low · **Priority:** P3.

---

**EFF-018 — `CashFlowChart` recomputes its dataset unmemoized** *(confirms prior PERF-008)*
- **Status:** ✅ **ADDRESSED — PR #802 (`eb20be1a`)** (Phase-1 render/read-hygiene). `buildStackedData` wrapped in `useMemo(..., [totalApi, modeMix, commissionRate])`.
- **Severity:** Low · **Confidence:** Confirmed.
- **Location:** `src/components/goals/CommissionPlayground/components/CashFlowChart.jsx:50` (`buildStackedData(...)` called in render body).
- **Impact:** Recompute each render inside the interactive playground; small dataset and `isAnimationActive={false}` bound the cost.
- **Fix shape:** `useMemo(() => buildStackedData(...), [inputs])`.
- **Effort:** S · **Change-risk:** Low · **Priority:** P3.

---

## 3. Top 10 by impact-per-effort

| Rank | ID | Finding | Sev | Effort | Impact/effort |
|------|-----|---------|-----|--------|---------------|
| 1 | EFF-001 | Memoize AuthContext value | High | S | App-wide re-render elimination for one `useMemo`/`useCallback` |
| 2 | EFF-011 | Dynamic-import the PDF engine | High | S | Removes the single heaviest dep from every agent's first byte |
| 3 | EFF-004 | Incremental streak/YTD on leaderboard doc | High | M | Kills 52 serial reads + full scan on the hottest trigger |
| 4 | EFF-006 | Gate/debounce hourly leaderboard cron | High | M | Cuts up to 24 full-tenant scans/day to near-zero at idle |
| 5 | EFF-005 | Batch persistency map with `in` | Med | S | N queries → ⌈N/30⌉ (pattern already in repo) |
| 6 | EFF-007 | Batch roster goals with `in` | Med | S | N gets → ⌈N/30⌉ per roster load |
| 7 | EFF-009 | Memoize inline `new Date()` props | Med | S | Restores child/hook memoization on both dashboards |
| 8 | EFF-002 | Route/tab code-splitting | High | M | Agent bundle drops the entire manager tree + PDF + charts |
| 9 | EFF-003 | Dedupe campaign window query | High | M | N tenant-window scans → 1 on the agent home screen |
| 10 | EFF-010 | Denormalize photoURL onto leaderboard doc | Med | M | Removes a whole-users read per Leaderboard mount |

## 4. Quick wins (S effort, high confidence)

1. **EFF-001** — `useMemo` the AuthContext value + `useCallback` `refreshProfile`. *(App-wide re-render fix, ~5 lines.)*
2. **EFF-011** — `await import('@react-pdf/renderer')` at the export call site. *(Heaviest dep off first paint.)*
3. **EFF-005 / EFF-007** — Batch persistency + roster goals with `where('agentId','in', chunk)` / `documentId() in`, copying `getSettlementsForUnit`. *(Pattern already exists.)*
4. **EFF-009** — Stabilize the inline `new Date()` props on both dashboards.
5. **EFF-018** — `useMemo` the CashFlowChart dataset.

## 5. Phased remediation plan

**Phase 1 — Zero-risk render/read hygiene (S, this week):** ✅ **SHIPPED — PR #802 (`eb20be1a`) (2026-07-05).** EFF-001, EFF-009, EFF-005, EFF-007, EFF-018, EFF-011 — all six landed in one frontend-only PR (EFF-001 isolated as the first commit for independent revert). All small, high-confidence, no architectural change. EFF-011 removed 481 kB gzip (@react-pdf) from the entry chunk (measured: 1,133.38 → 644.85 kB gzip entry).

**Phase 2 — Bundle split (M):** ✅ **Dashboard split SHIPPED (EFF-002 Phase 1)** — entry chunk 644.85 → 221.55 kB gzip (−65.6%), agent never loads the manager tree. **Deferred:** (a) per-manager-tab lazy-splitting — captured a real manager-base-chunk reduction (96.59 → 14.68 kB gzip at full granularity) but fans shared leaf modules out into 36–50 tiny chunks; must be paired with a Rollup `manualChunks` vendor/icon-grouping strategy (build-config) — FU banked. (b) EFF-013 (Recharts off the agent critical path via inline-SVG sparkline) — the natural next agent-path win, since Phase 1 moved Recharts out of the entry chunk but the agent still pulls it via the default-view KPICard sparkline. EFF-011 (PDF) already isolated in #802.

**Phase 3 — Read-amplification structural fixes (M):** EFF-003 (campaign dedupe, then server aggregate), EFF-010 (denormalize photoURL + shared users cache, also resolves prior COST-003), EFF-008 (CompliancePanel — only when roster size warrants).

**Phase 4 — Functions (M, human-merge — touches functions/crons):** EFF-004 (incremental streak/YTD + the `apiSold`-only YTD correctness rider), EFF-006 (cron gating/event-driven), EFF-015 (region/memory/minInstances — confirm Firestore region first). All are functions deploys → dispatcher/human per Rule 19; EFF-004/EFF-006 touch gamification/leaderboard contracts and need smoke + the existing CF test suites.

**Phase 5 — Scale ceilings (before second tenant / data growth):** EFF-012, EFF-014 (virtualize tables), EFF-016 (pagination/limits), EFF-017 (batch campaign notifications).

## 6. Self-critique (known gaps)

- **No live profiler trace.** Re-render findings (EFF-001, EFF-009) are structural — I did not attach the React Profiler against a running tenant to count actual re-renders or measure ms. The mechanism is certain (unmemoized context value is a well-known footgun); the *magnitude* in this app's specific tree is reasoned, not measured. A 10-minute Profiler session on the manager dashboard would quantify EFF-001's blast radius.
- **Bundle number is real but pre-split composition is inferred.** The 3.95 MB total is measured; the *attribution* to PDF/Recharts/manager-tree is from the import graph, not a per-module bundle-analyzer breakdown. A `rollup-plugin-visualizer` run would confirm exact byte shares and might surface a heavy dep I did not name (e.g. a date or icon lib pulled transitively).
- **Firestore region unconfirmed (read-only limit).** EFF-015's latency argument assumes US-default region vs T&T users; the actual deployed region needs Console verification (shared with prior PRIV-007). If Firestore is already co-located, the region half of EFF-015 weakens to "document it."
- **Campaign fan-out cost depends on live data shape.** EFF-003's read multiplier assumes multiple concurrent active campaigns with overlapping windows and a populated submissions collection; at true pilot volume (few campaigns, sparse submissions) the absolute cost is lower than the worst-case figure — the *pattern* is the finding, the numbers are illustrative.
- **Coverage is broad but not exhaustive.** I did not deep-read every one of the ~40 services; financing/coaching/jointCalls services were sampled, not fully traced, so an additional N+1 could exist there. `DailyCaptureV2`'s internal effects were confirmed to load per-day/per-week docs (bounded) but its full 1124-line render path was not line-audited for re-render cost.
- **Falsification for EFF-006:** if the cron were already gated by a dirty-flag or the schedule were business-hours-only, the finding would be overturned — I confirmed neither exists (schedule is literally `0 * * * *` and `loadInputs` is unconditional), so the finding holds.
