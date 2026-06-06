# AgencyTrack — Follow-Up Items

Tracked here so they don't get lost between sessions. Items are deliberately scoped small
so each can ship as a standalone PR. Remove an item when its PR merges.

---

## Nexus Glass recipe HTML — AA table needs regeneration from glassPair() (banked 2026-06-06, PR #513)

**Context:** The Nexus Glass recipe doc (`docs/design/nexus-glass-recipe.html`) AA table states `#B45309` at 4.7:1 PASS on glass. `#B45309` is the raw warning **base** color (`[180, 83, 9]`), not the text ink. Two errors compound in that figure:

1. **Wrong color for text context.** The text-readable token on the flagship cards is `warning-ink` (`[162, 65, 0]`), not the raw base. `glassPair()` confirms warning-ink on light glass is **5.50:1 (teal tint) / 5.56:1 (gold tint)** — both comfortably above AA 4.5. The raw base used graphically (sparkline/PaceRow fills) at 4.33:1 (teal) / 4.38:1 (gold) passes only the 3:1 graphical threshold (SC 1.4.11), not text AA.

2. **Wrong background.** Even the raw base figure of 4.7:1 from the recipe was computed against `--color-bg` (#F7F6F2) directly, not the glass-composited effective background. `glassPair()` composites tint → base@62% alpha → darkest named surface, yielding a cooler effective bg that lowers contrast for warm colors. The correct raw-base-on-glass numbers are 4.33/4.38:1.

**Action at next design-doc touch:** Regenerate the AA table in `nexus-glass-recipe.html` from `glassPair()` outputs. Use warning-ink (`[162, 65, 0]`) for the text-AA column; raw warning base (`[180, 83, 9]`) for the graphical-3:1 column. The code's contrast.test.js matrix is the corrected truth in the interim.

**No production or rule changes — docs-only, no urgency.**

---

## Persistency Mgr v2 — remaining slices (banked 2026-06-05 from Persistency Mgr v2 S1, PR #505)

**Context:** S1 (PR #505) shipped the manager Persistency panel redesign — `PersRealityBar` (aggregate %, 6-month sparkline, stats), `PersAtRiskBook` (exception-first agents below 80%; celebration arm; Coach → existing `CoachingNotesModal`), and `PersRoster` (two-tick band track at 80%/90%, source badge, Edit + Play). Read/derive only — zero writes, rules changes, Cloud Functions, or index changes. `PersistencyAgentRow.jsx` deleted (replaced). `computeBarStats()` + `PERS_FLOOR` / `PERS_GATE` exported from `src/lib/persistency/calculations.js`.

**D3 degradation (banked):** The build annotation stated `lockedByManager` exists on persistency docs. Source inspection: **field is absent** from the schema. Source badge is derived from `enteredByRole` alone (manager-role values → "Manager · locked"; agent role → "Self-entry · date"). If the field is ever added to the write path, `SourceBadge` in `PersRoster.jsx` can upgrade cleanly — the derivation logic is isolated there.

**Remaining slices (each needs its own kickoff brief):**

- **S2 — Entry drawer restyle.** `CoachingNotesModal` + `PersistencyEntryForm` modals restyle to match the v2 visual language (currently reused as-is from the legacy surface). Entry form is the manager's write path for persistency data — S2 is the natural moment to revisit the form layout, field labeling, and inline validation UX.

- ~~**S3a — What-If Playground.**~~ **SHIPPED — PR #515 (`{TBD}`, HUMAN-MERGE, 2026-06-06).** Client-side-only UI over the existing `projectPersistency()` / `calculateShortfall()` engine. Two levers (New Business Planned + Reinstatements Planned). Two-tick band visualization (80% floor / 90% gate). Reset affordance. Shortfall cards for NB + NR targets. D4 lapsed-link for agent self-mode → navigates to Policy Ledger with 'lapsed' chip pre-selected. Play button unconditional on `PersRoster` (was guarded by `hasRecord`). `policyLedgerDerivation.js` gains 'lapsed' filter key (purely additive; lapsed-only, excludes NTU/denied). CLIENT-SIDE ONLY — zero writes, zero rules/CF/index changes. Suite 2505/2505; lint 0; build clean; smoke 22/22 PASS (both themes, BM + agent legs). Smoke locator fix: chip textContent includes count badge (e.g. "Lapsed0") — use `data-testid="ledger-filter-lapsed"` not text equality.

- **S3b — Nudge write.** `PersistencyPlayground` "coaching" mode already connected (S1 wired; S3a ships the playground UI). S3b adds: (a) the what-if nudge write path (manager-to-agent persistency coaching note or target via the `sendComplianceNudge`-style nudge primitive), (b) share/export from the playground. Each needs its own kickoff brief. Manager suggest-a-goal also in manager-program backlog (see § Manager-program backlog below).

**Deferred scope item (SM cross-branch):**

- **SM scope toggle.** The brief called for a SM cross-branch scope picker on `PersRealityBar`. The `SmLeaderboardView.jsx` branch-picker is tightly coupled to leaderboard context (`branchIdOverride`, `scopeRoleOverride`) and won't drop in cleanly without a dedicated architecture discussion. Deferred to a named slice or SM-scope standalone brief. In the interim, `sales_manager` falls through to `ROLE_DEFAULT_SCOPE['branch']` (their `branchId` scope), which is safe for the pilot. Revisit when SM cross-branch surfaces become a priority.

**Banked addenda (post-merge, 2026-06-05):**

- ~~**Coach-drawer deferred leg (n/a in preview env).**~~ **CLOSED — PR #509 (`aa5ad63`) sentinel window, 2026-06-06.** Smoke legs 3 (AT-RISK + ORDERING) and 4 (COACH) proved live: sentinel at ~70.0% below-floor appeared in `PersAtRiskBook` exception-first; Coach action opened `CoachingNotesModal` with the correct agent props. Restore PASS (both agents). No at-risk-data gap remaining.

- **n≥2 sum-vs-mean live proof — RECORDED, PR #509 sentinel window.** Two sentinel entries (agent A and agent B, distinct values: A→~70.0%, B→~65.0%) verified branch aggregate = `netSettled_sum / grossSettled_sum` → **DOM 67.1%** — diverges from the mean of (70.0%, 65.0%) = 67.5%. This live proof under production Firestore conditions validates the D1 unit anti-mean fixtures. The `computeBarStats()` formula is confirmed sum-not-mean both in unit tests and live.

- ~~**Micro-FU — promote bearer-token capture into `walk-helpers`.**~~ **CLOSED — PR #508 (`e729fec`), GREEN-CHANNEL, 2026-06-06.** `captureOrFetchBearerToken`, `captureConsoleAndNetwork`, `formatCaptureReport` promoted to `scripts/verification/lib/walk-helpers.mjs`. S1 smoke refactored to consume it (behavior-identical). Auto-merged per brief pre-authorization (scripts-only class).

---

## Commission v2 — remaining slices (banked 2026-06-05 from Commission v2 Slice 1, PR #496 `0b79a92`)

**Context:** Slice 1 (PR #496 `0b79a92`) shipped the real-earnings **AnchorStrip** data layer atop the Commission page: new pure utility `src/utils/commissionAnchor.js` (`ytdEarned` · `runRate` · `gapToGoal` · `latestPersistency`) + exhaustive unit tests + `CommissionAnchorStrip.jsx` (3 states: loading · no-goal/error · normal with YTD earned / run-rate window chip / gap-vs-committed-goal / latest-month persistency) + D4 page promotion (CommissionPlayground accordion removed, always-expanded with tab list). READ/DERIVE ONLY — no writes, no new collections, no rules changes. Data from existing own-read policy, goals, and persistency paths.

**Remaining slices:**

- **S2 — Ladder + Modal Targeting restyle — SHIPPED (PR #498 `381ed24`, HUMAN-MERGE).** D2: GoalDecompositionTab 7-stage decomposition ladder (Income goal → 1st-yr comm → API to write → Apps → CIs → Prospecting calls → Prospects; Nexus gold/teal token variants). D3: CashFlowChart stacked 12-month bar chart + cumulative line overlay (Recharts ComposedChart, Nexus tokens, both themes). D4: no-goal AnchorStrip now shows YTD earned + run-rate chips (gap suppressed, CTA kept). D5: React imports + 9 RTL baseline tests (4 GoalDecompositionTab + 5 CommissionAnchorStrip). REDESIGN/VISUAL-ONLY — no writes, no rules, no new data fetches. Suite 2422/2422; lint 0; build clean; smoke 30/30 PASS.
- **S3 — "Set as my goal" write — SHIPPED (PR #500 `8d7c5e6`, HUMAN-MERGE).** Agent-side write: `GoalDecompositionTab` "Save as My Goals" CTA now opens a CONFIRM affordance (current → new API formatted TTD) before writing; guard rails (zero/NaN blocks confirm); on confirm: `setGoals(personalAnnualAPI + personalAnnualApps)` via the existing goals cascade write path (D1 byte-compatible, same payload as CareerPortal); `onGoalSaved` callback refreshes `goals` state in AgentDashboard → AnchorStrip + GamePlan strip re-derive live. CommissionAnchorStrip no-goal CTA upgraded "Go to the ladder" → "Set as my goal →" (S1 no-goal CTA upgrade per annotation). ZERO rules/schema/engine changes. 4 new RTL tests (confirm-flow: open · current-vs-new · cancel · write payload) + 1 guard-rail test; Test 4 consciously evolved (confirm step now required before write). Suite 2426/2426; lint 0; build clean.

**Commission v2 agent arc COMPLETE (S1+S2+S3) — shipped (PR #500 `8d7c5e6`).** Manager suggest-a-goal routed to manager-program backlog (see § Manager-program backlog below).

**Banked addenda (post-merge, 2026-06-05):**

- **Deferred-verification FU (Rule 13): ✅ CLOSED 2026-06-05.** AnchorStrip data arm proven live in S2 smoke recompute leg (PR #498): Admin SDK read (policies + goal doc + commissionRate from userProfile) → `ytdEarned` / `runRate` / `gapToGoal` recompute → displayed YTD / run-rate / goal / gap matched SDK-recomputed values exactly (zero delta). Evidence: `light-recompute-ytd TTD9450 == 9450.00 · light-recompute-rate TTD21365.22 == 21365.22 · light-recompute-arm-chip: linear-YTD fallback arm · 1 week(s) · DOM chip confirmed · light-recompute-gap goal TTD84000 == 84000.00 / gap TTD-62634.78 == -62634.78`. Rate correct per D1 semantics: span-based arm (1 settled week, span=7 < 8 cal weeks → linear-YTD); divisor = elapsedTTYearWeeks (23), not weekCount. `commissionAnchor.runRate` fully corrected in PR #498 (`2639d65`): arm by history SPAN · trailing = 8-calendar-week zero-filled window · linear = ytdEarned ÷ elapsedTTYearWeeks × 52. 30/30 smoke PASS.
- **S2 design question:** ~~Empty (no-goal) AnchorStrip suppresses YTD earned + run-rate — consider showing them.~~ **RESOLVED by D4 in S2 (PR #498 `381ed24`)** — no-goal state now shows YTD Earned + On Pace For chips; gap figure suppressed; CTA kept.
- **Trio certification:** PASSED — Goals + Persistency + Commission all render real data under the agent (E3) credential. The operator's "fully working for agents" intent is now regression-protected by the S1 smoke (`scripts/verification/commission-v2-s1-smoke.mjs`).
- **Trio intent DELIVERED (S3, 2026-06-05).** Persistency (pre-existing agent-visible data), Goals (by design via CareerPortal/Game Plan; now also via the S3 "Set as my goal" CTA — agents can view AND write their `personalAnnualAPI` from the Commission surface), Commission (S1–S3: YTD earned · run-rate · gap-to-goal read + write goal via CTA). All three surfaces are agent-complete.
- **Product finding (banked, 2026-06-05, PR #500 smoke).** Test agent's committed goal (`personalAnnualAPI = 240K`, `personalAnnualApps = 20`) is below the 42-app company minimum. The `setGoals` write guard correctly blocked re-committing that value via the UI confirm flow (threw apps-minimum error). **Confirm with dispatcher:** is write-time floor enforcement at the confirm CTA the intended behavior, or should below-floor commitments from the legacy path (pre-floor era) be grandfathered? GapAnalysis banding may already surface the gap visually (the `gapToGoal` arm reads `personalAnnualAPI` directly). **Assess whether existing below-floor commitments need active surfacing** — a manager or admin console view of agents with `personalAnnualAPI < annualFloor` might be warranted, especially before the Tatil pilot.
- **Smoke deviation (recorded, PR #500).** S3 smoke restore leg used **Admin SDK** (`sdkRestoreGoal` helper) rather than the UI path. Rationale: test agent's original `personalAnnualAPI = 240K` / `avgPolicyAPI = 12000` yields `applications = 20 < 42 minimum` — any UI-driven restore attempt via the confirm CTA would itself throw the apps-minimum write guard. UI restore is structurally impossible for below-minimum originals. **Dispatcher-ratified** (Admin SDK restore authorized at dispatch).

**Cross-reference:** `docs/design/commission-v2-build.html` (layout authority for all three slices); § CommissionPlayground tabs lack default `React` import → blocks full RTL baseline (active FU, pre-auth required in S2 brief); `docs/briefs/commission-v2-s1-kickoff.md`.

---

## Manager-program backlog

### Manager suggest-a-goal (deferred from Commission v2 S3 brief, 2026-06-05)

**Context.** Commission v2 S3 ships the **agent-side** write path only. The complementary manager capability — a manager proposing a `personalAnnualAPI` target to an agent from the commission/goals view — was routed to this backlog at the S3 brief-dispatch decision (2026-06-05). This is distinct from the existing `unitGoals` / `branchGoals` manager tiers; it targets the agent's **personalAnnualAPI** (personal commitment layer) as a suggestion the agent confirms.

**Nudges-primitive note.** The `sendComplianceNudge` machinery (Compliance v2 S2, PR #483 `1a4f2d0`) is the ready primitive: deterministic-ID cooldown record + bell `notifications` doc + email + `auditNudges`. A `goals.suggest.api` type can extend the CF's `NUDGE_CONFIG` allowlist (exactly the same extension pattern as `compliance.plan.nudge` in Compliance v2 S3) and carry the suggested API value in the payload; the agent's S3 confirm CTA is already wired to write it.

**Scope when dispatched:**
1. Manager-surface entry point (e.g. Commission AnchorStrip manager view, or a GoalsPanel agent-row action).
2. Extend `sendComplianceNudge` CF's `NUDGE_CONFIG`: `goals.suggest.api` type, payload carries `suggestedAPI`, bell copy includes TTD-formatted figure, new email template pair (`goals-suggest-api.txt/.html`).
3. Agent-side: bell notification surfaces the suggested value; S3's confirm dialog can optionally pre-fill from the suggestion.
4. Standard nudge infra: deterministic dedupe + 24h cooldown + creator-delete + `auditNudges`.
5. Phase 3 gates: functions tests + emulator matrix + BM+E3 smoke.

**Cross-reference:** `functions/compliance/sendComplianceNudge.js` (`NUDGE_CONFIG` — the extension point); `src/services/nudgeService.js`; `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx` (agent confirm CTA — the receiving end).

---

## Compliance v2 — remaining slices (banked 2026-06-04 from Compliance v2 Slice 1, PR #481)

**Context:** S1 (PR #481) shipped the **read/derive-only filing surface** for the manager
Compliance panel per `docs/design/compliance-v2-s1.html`: a filing **reality bar**
(filed % · on-time · late · not-in), an **exception-first "Haven't filed" list**, an
**on-time roster** (status pill · submitted time · 8-week on-time streak) whose row-click
opens the shared coaching drawer (`CoachingNotesModal`, reused), and the **CBTT section
kept** as its own regulatory block. New pure util `src/utils/complianceDerive.js`
(`isOnTime`/`classifyWeek`/`onTimeStreak`, TT-safe; deadline = Sun 23:59:59 AST following
the covered week). Reads are the existing two-fetch pair × 8 weeks (N×`getWeeklySubmissions`
+ `getTenantUsers`) — **no new collection / rule / index**.

**Remaining slices (each needs its own kickoff brief):**

- **S2 — the WRITE: Nudge CF + notifications. ✅ SHIPPED (PR #483, `1a4f2d0`).**
  `sendComplianceNudge` callable CF (`functions/compliance/sendComplianceNudge.js`):
  UM/BM/SM/TA role gate, all-or-nothing scope validation (UM→unit · BM→branch · SM/TA→tenant),
  four-artifact per-target write — deterministic `nudges/{audienceUid}_{type}_{weekStart}`
  SET-MERGE cooldown record · standard-schema bell `notifications` doc · `mail/` email via
  `buildMailDoc` (+ new `compliance-nudge.txt/.html`) · tenant-scoped `auditNudges` — first
  three in one atomic batch, email NON-FATAL. **Premise correction (dispatcher Option A+):**
  the brief targeted `notifications` as the *new* collection, but it pre-existed (`userId`
  schema + 4 live client writers) — nudges live in a **new `nudges` collection**; the legacy
  `notifications` rules block is **UNTOUCHED** (additive diff 50 ins / 0 del); the CF still
  writes a standard bell `notifications` doc so the agent sees the nudge today. Rules:
  `nudges` (CF-only writes · creator-delete · audience-or-upline `get` via `uplineCanReadNudge`
  mirroring #471 · **NO list / no index**) + `auditNudges` (Admin-only) — **22-case emulator
  matrix** incl. legacy no-drift + absent-nudge clean-not-found. UI (`CompliancePanel`):
  not-in rows Nudge → cooldown chip (deterministic-ID GET reads, persists reload, re-enables
  24h); Nudge-all count+scope confirm; **unlock + view-report re-homed** as submitted-row
  actions (existing `unlockSubmission` re-mounted unchanged + `SubmissionViewer`). New
  `src/services/nudgeService.js`. **Open product decisions resolved at brief time:** transport
  = **both** (doc + email); dedupe = **deterministic ID + 24h UI cooldown**; Nudge-all =
  **filtered exception set + confirm-count**; **no auto-escalation**; on-time = S1's exact
  Sun 23:59:59 AST D2 (no grace). D6 UI rule banked (`bg-primary` + `dark:bg-primary-dark`).
  `readAt` dormant-by-design (`update:false`; bell carries read-state).
  - **Deferred prod-smoke (Rule 13) — ✅ CLOSED 2026-06-04.** Prod-smoke
    (`PREVIEW_HOST=agencytrack.vercel.app node scripts/verification/compliance-v2-s2-smoke.mjs`,
    BM credential, both themes) ran **12/12**: live CF fire + cooldown chip + reload-persist
    (upline GET) + cross-session chip + Nudge-all confirm (4 prod exceptions → the `bg-primary`
    button rendered) + View→viewer + creator-delete cleanup all PASS, and **dark-theme axe is
    0-new** on the Nudge-all `bg-primary dark:bg-primary-dark` button — the D6 fix confirmed
    live on production. One nudge + email sent to the test agent (by design); the `nudges`
    record self-cleaned (creator-delete); bell `notifications` + `auditNudges` retained as
    durable records.
  - **Future consumer.** The `nudges` collection (+ the `readAt` per-recipient marker, dormant
    in S2) is the primitive an **agent-side notification inbox** would later read.

- **S3 — second lens: plan-adoption. ✅ SHIPPED (PR #485, `f2515c7`) — Compliance v2 surface COMPLETE.**
  A segmented **Filing ⇄ Plan-adoption** toggle (`CompliancePanel`) swaps the reality bar
  metric set AND the exception list in lockstep (filing = S1/S2 unchanged; plan =
  committed%/committed/not-committed bar + "Haven't committed a plan" list + plan Nudge);
  streak roster + CBTT are filing-lens-only. Plan data via the **locked `getWeeklyPlan`
  get-fan-out** (no list/index; #471 `uplineCanReadPlan`-authorized; absent/denied = not
  committed). Plan nudge reuses S2's machinery with `type='compliance.plan.nudge'`
  (independent dedupe); the CF's only change is a `NUDGE_CONFIG` allowlist-of-two map
  (lens/copy/template per type) + new `compliance-plan-nudge.txt/.html` — **post-merge
  `firebase deploy --only functions:sendComplianceNudge`** (it EDITS an existing export).
  **ZERO rules changes.** Pre-merge smoke 14/14 (toggle lockstep + plan bar == independent
  web-SDK recompute + plan-Nudge renders-not-fired + axe 0-new both themes); active lens-tab
  chip AA fix mid-review (`bg-white/25→bg-black/20`). Smoke harness hardened (`finishSmoke`
  explicit-exit + global timeout + `--prod` resolver + flushed progress). Delivers **planner
  S4a** (manager-visibility); S4b pace roll-up rides WARs v2.
  - **Deferred live plan-nudge leg (/post-merge, Rule 13) — ✅ CLOSED 2026-06-04.** After the
    operator's `firebase deploy --only functions:sendComplianceNudge`, ran
    `scripts/verification/compliance-v2-s3-plannudge-prod-leg.mjs --prod` (BM, production): **2/2** —
    the LIVE plan CF fired (`compliance.plan.nudge` now accepted), cooldown chip rendered
    "Nudged just now", then the plan `nudges/{uid}_compliance.plan.nudge_2026-05-31` record was
    creator-deleted and getDoc-confirmed gone (cooldown reset). One plan email sent to the test
    agent (by design); bell `notifications` + `auditNudges` retained as durable records.
  - **Banked LOW FU (Phase-0).** The plan fan-out treats denied GETs as not-committed —
    correct for the single-branch pilot where the roster and branch coincide; revisit if
    multi-branch tenants arrive (a BM's tenant-wide roster includes out-of-branch rows whose
    plan GETs deny → would misreport as not-committed).

## ~~Compliance v2 S1 — derived-suggestion chip relabel~~ ✅ CLOSED (PR #491 `2c55d07`, Item 6, 2026-06-05)

**RESOLVED.** The Weekly-Planner derived-suggestion chip on `SuggestedWeekCard.jsx:463` was relabeled **"Dials" → "Prospecting calls"** (label constant + its two test assertions — visible-text + aria-label button query). Value unchanged (the decomposition engine's per-week dials target). Diff-locked one-liner; full cross-surface consistency with the #477 floor/plan relabel achieved. The `'dials / wk'` expansion-breakdown unit + the prose ratio reference are deliberately left (engine-derivation terms, not user-facing metric labels).

<sub>Original (for trail): the derived-suggestion chip still labeled its prospecting metric "Dials" (engine suggestion state) whereas every floor/plan render site was relabeled "Prospecting calls" in #477; out of #477's enumerated scope (suggestion, not floor/plan actual).</sub>

---

## Weekly-activity planner — remaining slices (banked 2026-06-03 from Weekly Planner v2 Slice 1, PR #445)

**Context:** Slice 1 (PR #445) shipped the read-only **"Suggested weekly plan"** card in the Game Plan hub + extracted the goal-decomposition engine to `src/utils/goalDecomposition.js` (a small cleanup-debt reduction — the income→activity chain is now a shared, tested, single-source pure module instead of inline-in-the-Playground-tab). The remaining Path-B slices turn the read-only suggestion into a tracked, committed, rolled-up plan.

**Remaining slices:**
- **Slice 2 — agent-set plan + store. ✅ SHIPPED (PR #471, 8807e5a).** Steppers on the weekly line, the `weeklyPlans/{agentId}_{weekStart}` collection (deterministic composite ID — **no index**, see Slice 4 note) + write + rules + emulator tests, commit + reset-to-suggested, floor-clamped at the resolved company minimum. Steppers cover all 5 floor metrics (Dials·Contacts·FFIs·CIs·Apps) with honest pre-fill provenance: **derived** for Dials/CIs/Apps (from the engine), **company floor** for Contacts/FFIs (until the contacts/FFI derivation below exists), flipping to **agent** on any change. Service: `src/services/weeklyPlanService.js`; pure assembly: `src/utils/weeklyPlanAssembly.js`; UI in the existing `SuggestedWeekCard.jsx`. Rules enforce shape/ownership/int/enum/tenant/weekStart-immutability; floor *minimum* is clamp + service re-validation (tenure resolution stays JS-side).
- **Slice 3 — plan vs actual vs variance.** Split into **3a (Game Plan committed card)** and **3b (WeeklyStandardCard evolution)**.
  - **Slice 3a — ✅ SHIPPED (PR #473, `9984821`).** The committed-plan view's 5 value rows became **pace rows**: floor tick (neutral baseline) + plan cap (teal) + variance-coloured actual fill + a live pace marker ("where you should be today"). Variance measured against **pace** (plan × elapsed ÷ 6), not the full-week number. New pure module `src/utils/planVariance.js` (card-agnostic — S3b reuses it): source switch (submitted report = `final · submitted`; else daily aggregate = `mid-week · daily capture`), per-metric actual assembly via `extractFields` (calls = the 5-component sum incl. `serviceCalls`, matching the wizard Step-2 total — **not** `extractFields.totalTelAttempts`, a 4-component sum), variance per D2 (Ahead ≥ plan · On-track ≥ 90% of pace · Behind < 90% · Day-1 suppression · Mon–Sat elapsed, Sunday excluded), TT-safe date math. Calls + Contacts have no clean daily source — calls is the hatched "weekly only · no daily pace" state mid-week (Daily Capture has no calls field); contacts resolves to `qualifiedApproaches`. Wiring in `GamePlanV2/index.jsx` reuses the already-loaded submissions (no refetch) + a new `getDailyEntriesForWeek` fetch (single-field `weekStarting==` query, **no index**). E3 smoke PASS both themes incl. own-delete cleanup of the plan + daily docs.
  - **Slice 3b — ✅ SHIPPED (PR #475, `1f11ae0`).** Re-targeted in Phase 0 (premise shift): `WeeklyStandardCard.jsx` was dead code with no production imports (#393 removed its mount); the live surface is `HomeV2/StandardDetail.jsx` (the "Standard" Pulse chip drawer). Evolved `StandardDetail` to 3 honest states per D4: (1) plan committed → the 5 plan-metric rows gain mini pace-track grammar (mini floor tick + plan cap + variance fill + optional pace marker) from `planVariance.js` AS-IS; all other 5 floor rows remain unchanged Expected-vs-Actual; (2) no plan → today's floor-only verbatim + quiet "Commit a plan in Game Plan →" nudge; (3) final (submitted) → plan-metric rows from the submission, "final · submitted" chip, calls resolves to the 5-sum. D1 single-source: exported `computeCallsActual` from `planVariance.js` and repointed `deriveWeeklyFloorActuals`'s `callsMade` to it — PulseStrip chip and drawer now share one 5-sum definition. Dead code deleted: `WeeklyStandardCard.jsx` + its test file. New tests: `StandardDetail.s3b.test.jsx` (16), `planVariance.computeCallsActual` (4), `weeklyActivityFloors` D1 evolution (updated). Suite 2245/2245. D5 CLAUDE.md one-liner added. In-session staleness fix: `AgentDashboard.loadWeekPlanData` callback + `onPlanChanged` thread to `GamePlanV2`; "Clear plan" delete button in the committed view. E3 smoke (PR #475) source-aware, both themes, no-reload commit+delete paths verified.
- **Slice 4 — manager roll-up.** Team aggregate: who set a plan, plan-vs-actual per metric, on-pace/behind/no-plan flags.
  - **S4 read architecture (locked in Slice 2 Phase 1).** The roll-up is a **deterministic-ID get-fan-out** over the manager's roster: for each member, get `weeklyPlans/{agentId}_{weekStart}`, each get authorized by the Slice-2 upline GET arm (UM same-unit, BM same-branch, SM/TA/PA tenant-wide). **No `list` arm and NO composite index — in Slice 2 or Slice 4.** This is viable because the upline arm scopes via a cross-doc lookup of the agent's user doc (`unitId`/`branchId`), which the 2026-06-04 roster integrity probe (#456) confirmed are clean — making the lookup fail-closed-safe without denormalizing those fields onto the plan. A `list`+index would only be needed if S4 wanted a single tenant-wide query instead of a per-member fan-out; the fan-out is the chosen design.

**Personal contacts/FFI weekly derivation (product decision, blocks the derived path showing 5 chips).** Slice 1's derived line shows only the **3 engine-derivable chips (Dials·CIs·Apps)** because the decomposition engine's chain (API → apps → CIs → dials → prospects) has **no contacts or FFI stage** (dispatcher Finding-A, 2026-06-03). Showing personal contacts/FFI targets needs a **deliberate ratio methodology** — wizard history could support a contacts-per-dial and an FFI-per-CI ratio (mirroring the existing `deriveRatiosFromHistory` 8-week auto-population), but which ratios, from which fields, with what fallback is a future product decision. Do **not** extend the decomposition engine ad-hoc (locked decision 1: don't change the chain math). Until then, contacts/FFIs appear only on the **floor fallback** (the company floor carries those columns) and in Slice 2's set-plan steppers (floor-provenance pre-fill).

**Annotation refresh (LOW).** `docs/design/Weekly-Planner-Slice-1-Build.html` draws 5 derived chips + an apps→CIs→FFIs→dials reveal chain; the shipped card draws 3 derived chips + the real engine chain (API→apps→CIs→dials→prospects). Refresh the annotation to match engine reality when convenient.

**Commission Playground tab absorption (RECONCILE LATER).** Slice 1 *reuses* the extracted engine; the standalone `CommissionPlayground/tabs/GoalDecompositionTab.jsx` tab still exists (re-pointed, zero behavior change). Retiring it once the planner owns the surface is a later decision.

---

## Weekly Planner S2 derived-state live walk (LOW, banked from Weekly Planner v2 Slice 3a, carried from #471 pre-review)

**Context.** The S2 and S3a E3 smokes exercise the **floor** resolution (the test agent has <8 submitted weeks of history, so `deriveRatiosFromHistory` returns `hasHistory: false`). The **derived** resolution path — where Dials/CIs/Apps pre-fill from the engine chain rather than the company floor, and the committed pace rows render against an engine-derived plan — has never been walked on a live preview because no agent account in the preview env has ≥8 submitted weekly reports.

**To close.** Seed (or use a real account with) **≥8 `status:'submitted'` weekly submissions** for the smoke agent, then re-run the S2 + S3a smokes and confirm: the card resolves to `suggested-week-derived`, the steppers pre-fill `derived` provenance for Dials/CIs/Apps, and the committed pace rows render correctly against the derived plan. Until then, the derived path is covered only by RTL component tests (`SuggestedWeekCard.test.jsx` / `.plan.test.jsx` / `.pace.test.jsx`), not a live walk.

**Companion gap — S3a daily-source (mid-week) live walk.** The same smoke agent has a **submitted weekly report for the current week** (confirmed `2026-06-04`: `weekStarting 2026-05-31`, v2), so the S3a committed pace rows resolve to the **`final · submitted`** source — the live walk verifies the *final* arm (calls resolves to the 5-component sum, no live pace marker), not the *daily/mid-week* arm (hatched calls + live pace marker fed by the Daily Capture aggregate). The S3a smoke is source-aware and PASSES on the final arm; the daily arm is covered by RTL (`SuggestedWeekCard.pace.test.jsx` mid-week cases) + unit tests (`planVariance.test.js`). To walk the daily arm live, use a smoke agent with a committed plan but **no** submitted report for the current week, then confirm the chip reads `mid-week · daily capture`, calls is hatched, the pace marker shows, and the four daily-sourced rows reflect entered Daily Capture values.

**Why LOW.** The derivation math is unit-tested (`goalDecomposition.test.js`, `weeklyPlanAssembly.test.js`, `planVariance.test.js`) and the component rendering is RTL-tested; only the live-Firebase end-to-end of the derived branch is unverified, and it shares all write/read/rules paths with the floor branch that the smokes DO walk.

---

## Daily Capture "dials / calls" field (MEDIUM, banked from Weekly Planner v2 Slice 3a)

**Context.** The S3a pace rows give every committed metric a mid-week actual **except calls** — Daily Capture (`src/components/daily/DailyCaptureV2.jsx`, `src/lib/schema/dailyActivity.js`) has **no dials/calls field**, so the calls row renders the honest hatched "weekly only · no daily pace" state until the weekly report is submitted (when the 5-component sum resolves). Contacts is fine (resolves to `qualifiedApproaches`, which Daily Capture does capture).

**Enhancement.** Add a single calls/dials field to the Daily Capture schema + form so the calls pace row gains a daily source and stops being the lone hatched row mid-week. This is a **Daily Capture schema change** (new field on `dailyActivity` docs + the aggregator's daily→weekly map + the form), so it carries the usual schema-change discipline (rules unaffected — own-write already covers it; the Sunday aggregator's `aggregateDailyToWeekly` must map the new field into the weekly draft's call components). Candidate to sequence **behind S3b** (the WeeklyStandardCard evolution), since both touch the same plan-vs-actual surface.

**Why MEDIUM, not LOW.** It removes a visible "no daily pace" gap on the single highest-volume activity metric (calls), which is the metric managers most want to pace mid-week. But it is genuinely additive and the hatched state is honest in the meantime, so it is not blocking.

**Cross-reference:** `src/utils/planVariance.js` (`PACE_METRIC_META.callsMade.hasDailySource = false`); `src/lib/schema/dailyActivity.js`; `src/lib/schema/dailyActivity.aggregator.js`.

---

## Dials display semantics — 5-sum vs 4-sum across non-floor/plan surfaces (CLOSED — RATIFIED, PR #477 `8e544ed`)

**RESOLVED 2026-06-04 (operator ratification, Prospecting Calls Flip PR #477).** The product decision is made: **service calls do NOT count toward effort/minimum/plan surfaces.** Rationale on record: service-originated production is already fully credited downstream (approaches, FFIs, CIs, apps are call-type-agnostic); counting raw service-call volume credits only the gameable, low-signal part and hides absent prospecting muscle in developing agents. Principle: **separate, not erase** — service calls stay captured and visible as their own line; they are no longer conflated into the prospecting metric.

**What changed (PR #477):** the floor/plan calls comparison surfaces (S3a Game Plan pace row, S3b StandardDetail drawer + PulseStrip chip, S2 stepper) flipped to the **4-sum prospecting calls** (`computeProspectingCallsActual` = referral + followUp + cold + seminarTradeshow; NO serviceCalls) and the metric was relabeled **"Prospecting calls"**. The S3b 5-sum `computeCallsActual` export was deleted (dead-code, zero consumers).

**Informational 4-sum surfaces — CONFIRMED CORRECT, no change.** YTD dials (`AgentDashboard.jsx`), kiosk `WeeklyActivityPanel`, century-dials milestone (`buildActivityEvents.js`), MasterSheet/MeetingMode/AgentReportDocument/exportService all read `extractFields.totalTelAttempts` (also a 4-sum excluding serviceCalls). Under the ratified decision these are **working as intended** — prospecting dials only — and are explicitly out of scope. The wizard Step-2 displayed total stays the 5-sum (data-entry sum; unchanged by design).

---

## Over-goal MDRT marker treatment on the HeroCard (LOW, banked 2026-06-03 from HeroCard marker-label fix PR #436)

**Context.** The HeroCard marker-label fix (`src/components/dashboard/HomeV2/HeroCard.jsx`) now **hides** the MDRT marker when it's off-scale (`MDRT_THRESHOLD > goal` — e.g. the default 200,000 goal vs the 500,000 MDRT threshold). This is correct for legibility (it was the clamp-onto-the-goal-label collision source), but it means an agent whose personal goal is below the MDRT threshold sees no MDRT reference on the hero bar at all.

**Possible treatment (if wanted).** Surface over-goal MDRT progress with its own affordance rather than omitting it — e.g. an "MDRT: TTD {ytd} / 500,000" caption below the bar, a secondary mini-bar scaled to MDRT, or a link to the Career/MDRT tracker where MDRT progress already lives. Purely additive; no change to the on-scale bar behavior shipped here.

**Why LOW.** The shipped fix is correct and complete for the bug (legible, non-overlapping labels). MDRT progress is already tracked in the Career/MDRT surface, so nothing is lost — this is an optional enhancement, not a gap. Decide alongside any broader hero/MDRT design pass.

**Cross-reference:** `src/components/dashboard/HomeV2/HeroCard.jsx` (`mdrtOnScale` gate); `src/constants/mdrt.js` (`MDRT_THRESHOLD = 500000`).

---

## Policy Ledger v2 — deferred slices (banked 2026-06-02 from Policy Ledger v2 Slice 1 PR #432)

**Status:** Slice 1 shipped the agent-surface presentational reorg (3 tiers + drill drawer, derived Confirmed, state-machine-filtered transitions, `statusToken()` token pass). The following were explicitly carved OUT of Slice 1 and remain to do.

1. **Campaign "Lens" mode + awards coupling (MEDIUM — gated on the `usesPolicyLedger` flip-gate).** The mockup's CampaignProgressStrip / ContributionBadges (COUNTS·PENDING·EXCLUDED per-policy) / FEEDS chips ("★ MDRT 2026 / Christmas Campaign") / "Export proof" were deferred **entirely** (not display-only) — each asserts the ledger feeds awards/campaigns, which is the dormant path gated OFF pending parity (see the H3 FLIP-GATE FU). Build only once `usesPolicyLedger` is cleared for the pilot agents AND a campaign-eligibility engine exists.
2. **Manager reconciliation rebuild (its own track).** The `PolicyReconciliationPanel` v2 restyle (port-ledger rows 29 CRO / 30 Policy Reconciliation) is a separate track — Slice 1 did not touch the manager surface.
3. **Lapse re-homing (manager track).** `settled → lapsed` stays a BM-only action on the manager surface; Slice 1 deliberately renders no Lapse affordance on the agent ledger. Any re-homing of the lapse UX lands with the manager reconciliation track.
4. **Pre-existing dark-mode contrast patterns (LOW — codebase-wide a11y).** The Slice 1 smoke's surface-scoped axe surfaces two **pre-existing** color-contrast nodes (NOT new to this PR — both verified against main):
   - **`bg-gold-tint text-gold`** small-text pill (Confirmed pill + drawer DERIVED tag) — the established gold-tint convention (e.g. `RankedLeaderboard.jsx:33` rank-1 gold). ~3.3:1 light; sub-AA for small text. Needs a darker gold-ink text token (`--color-gold-ink`-style, ~#8A6010) applied codebase-wide.
   - **`bg-primary text-white`** standard primary button in **dark** mode — lifted-teal `--primary` (#4AB5B8) + white ≈ 2.4:1. This is the app-wide primary-button pattern (the "New Policy" button is carried verbatim from the pre-PR `PolicyLedgerPanel`); it fails on every dark surface, not just here. Needs a primary-button foreground/treatment fix at the token/button level.

   Both are out of scope for a no-new-token presentational slice. Do as a dedicated a11y/token pass spanning RankedLeaderboard + WhereYouRankPanel + the shared primary button + the policy-ledger confirmed pill.

**Cross-reference:** `src/components/agent/policyLedger/*`; `src/lib/policyStatusTokens.js` (shared — the manager surface imports the same helper later); `docs/design/policy-ledger-v2-slice-1.html` (build annotation — "Deferred" + "DEFERRED awards path" sections); `docs/FOLLOW_UPS.md` § H3 FLIP-GATE.

---

## Policy Reconciliation v2 — Slice 2 (deferred, banked 2026-06-03 from Policy Reconciliation v2 Slice 1 PR #434)

**Status:** Slice 1 shipped the manager-surface restyle on the **existing manual model** (read Tatil's printed circular → key the figure per policy; at-risk hero + 3 tiles + worklist + in-row key-in; `statusToken()` reuse; `text-text*` token fix; Lapse kept as a BM-only secondary tab). The following **richer manual** reconciliation features were explicitly cut from Slice 1.

1. **8-way discrepancy taxonomy (MEDIUM).** Slice 1 uses only the existing boolean `hasDiscrepancy` + the keyed delta. Slice 2 sub-classifies a flagged row (amount / partial / status / period / duplicate / …) — still a **manual** classification (the manager picks the type), no file needed.
2. **`unmatched` / `missing` rows as manual manager actions (MEDIUM).** Policies with no ledger doc, or that the manager finds on the circular with no ledger entry, surfaced as **manual** add/flag actions — NOT a file-match (there is no ingestible file).
3. **Dispute / escalate resolution-state workflow (MEDIUM).** A resolution-state machine (disputed / escalated / resolved) over the existing confirm + flag + notify. Needs a new persisted state field — out of the no-schema-change Slice 1.
4. **Lapse-in-worklist (LOW).** Whether the BM Lapse flow merges into the reconciliation worklist (vs the kept secondary tab). Product decision.
5. **FEEDS / campaign chips + "Export proof" (gated).** Couple reconciliation to award/campaign rollups — behind the dormant `usesPolicyLedger` flip-gate (see the H3 FLIP-GATE FU).
6. **Bulk-confirm (MEDIUM — needs a verified-clean state first).** Slice 1 shipped per-policy confirm only. A "Confirm all clean" bulk was built then **dropped** during PR #434 review: with no persisted pre-confirm keyed figure, "clean" isn't knowable before the manager keys, so a bulk would rubber-stamp unconfirmed policies at the ledger value — recording the very discrepancies reconciliation exists to catch. Bulk-confirm returns in Slice 2 **only once a verified-clean state exists** (e.g. the manager has keyed-and-matched a set, or a structured source confirms equality), so the bulk acts on a genuinely-clean subset rather than silently agreeing with the ledger.

**Explicitly NOT planned:** file ingestion / PDF parsing / OCR / auto-matching — revisit only if Tatil ships a structured settlement export. The reconciliation model is manual by data reality.

**Cross-reference:** `src/components/manager/PolicyReconciliationPanel.jsx`; `src/lib/policyStatusTokens.js` (shared); `docs/design/policy-reconciliation-v2-slice-1.html` (build annotation — "Deferred" + "Data reality" sections); § Policy Ledger v2 — deferred slices; § H3 FLIP-GATE.

---

## Daily Capture anchor strip — targets + dials chip (MEDIUM, banked 2026-06-02 from Daily Capture v2 Slice 1 PR #426)

**Status:** Slice 1 shipped the counts-only WTD strip (APPR/FFI/CI/APPS, no targets, no dials). Slice 2 evolves it into a manager-set-target experience and adds a new daily dials/calls field.

**Background.** The v2 mockup originally drew a richer anchor strip with target chips and a DIALS chip. Slice 1 deliberately deferred both because (a) `target*` writes belong to manager-set goals (`unitGoals` / `branchGoals`) and the dispatcher decision is head-of-sales; (b) the existing daily entry has no `dials`/`calls` field, so capturing daily dials is a *new schema field* — not a port. Slice 1's reduced strip ships the counts mechanic; Slice 2 layers governance + the new field.

**Scope when dispatched:**

1. Decide where target values come from for daily strip (likely the closest applicable layer in the existing goals hierarchy: agent commitment → unit → branch → company floor).
2. Add `dialsToday` (or equivalent) field to `dailyActivity.js` `createEmptyDailyEntry`; mirror the wizard/legacy field name if one exists (cross-check `extractFields.js` and existing weekly schema).
3. Extend the aggregator to roll the new field into the weekly draft (need a weekly key — TBD with head-of-sales).
4. Extend `DailyCaptureV2`'s count strip to (a) draw target ring/progress under each chip and (b) include the DIALS chip alongside APPR/FFI/CI/APPS.
5. New tests: target-derivation rules + dials field round-trip + aggregator regression with the new field.
6. Verify Firestore rules accept the new field on writes (additive — likely no rules change required, but confirm during Phase 0).

**Cross-reference:** `src/components/daily/DailyCaptureV2.jsx` `CountStrip` block; `src/lib/schema/dailyActivity.js`; `src/lib/schema/dailyActivity.aggregator.js`; `docs/design/daily-capture-slice-1-build.html` annotations (the build annotation explicitly notes targets/dials were carved out of Slice 1).

---

## Daily Capture reporting-mode governance subsystem (MEDIUM, banked 2026-06-02 from Daily Capture v2 Slice 1 PR #426)

**Status:** deferred net-new product capability — head-of-sales scope.

**Background.** The full v2 vision included reporting-mode governance: tenant-default reporting mode, recommend-vs-lock per tier, resolution chain (agent override / unit / branch / tenant), manager panel to set policy. Some plumbing already exists in the daily/weekly transition path (`isCatchUp`, the Sunday cron, the aggregator mode-switch entry point), but no UI surface exposes governance and no resolution chain is wired. Slice 1 of Daily Capture v2 shipped the entry-surface restyle only; the mode badge / provenance chrome is intentionally absent until governance lands.

**Why MEDIUM.** Required for a multi-tenant or multi-branch rollout where reporting mode policy differs across the org. Not blocking for a single-tenant Tatil pilot where mode is implicitly "daily everywhere" or "weekly everywhere."

**Scope when dispatched:**

1. Design decision (head-of-sales): tenant-default → branch-override → unit-override → agent-override resolution; recommend vs lock at each tier; transition rules (mid-week mode switch behavior + the existing aggregator mode-switch entry point).
2. New `reportingMode` field at appropriate document layers (tenant config / branch / unit / user); claims propagation.
3. Manager panel UI to set policy at the appropriate tier; agent-side mode indicator (badge in topbar or Daily Capture header).
4. Rules updates: who can write `reportingMode` at which tier.
5. Tests for resolution-chain semantics across all permutations.

**Cross-reference:** `src/lib/schema/dailyActivity.js` (`isCatchUp` / `catchUpStartDate` / `catchUpEndDate` fields — partial mode plumbing); `functions/aggregators/sundayDailyToWeekly.js` (Sunday cron); `docs/briefs/track-j-daily-capture-v2-kickoff.md` § 0 (OUT scope list).

---

## Daily Capture streak mechanics (LOW until prioritized, banked 2026-06-02 from Daily Capture v2 Slice 1 PR #426)

**Status:** deferred — gamification / incentives owner; awards coupling required.

**Background.** A "streak" component (`current` / `best` / `loggedToday` / `milestone`) on the Daily Capture surface celebrates consecutive-day logging. Slice 1 intentionally excluded streaks because (a) awards coupling is non-trivial (does a streak earn a badge? does breaking a streak revoke recognition?), (b) milestone thresholds need design intent (5? 10? 30? quarterly?), (c) Firestore rules + schema for `streaks` collection need to be designed end-to-end.

**Why LOW.** Pure gamification — no impact on data capture or reporting accuracy. Pilot can ship without it.

**Scope when dispatched:**

1. Decision (incentives owner): streak granularity (daily-log vs daily-log-with-minimum-activity), milestone thresholds, reset rules, badge coupling.
2. New `streaks/{uid}` doc shape (`current`, `best`, `lastLoggedDate`, `milestonesAchieved`).
3. Update logic on every Daily Capture save (likely a Cloud Function trigger on `dailyActivity` write to avoid client-side trust); rules forbid client writes.
4. New `StreakChip` UI on `DailyCaptureV2` header (next to or replacing the count-strip's date sub-line).
5. Awards engine coupling (if streaks earn badges).
6. Tests for streak math + reset semantics + milestone-cross transitions.

**Cross-reference:** `src/components/daily/DailyCaptureV2.jsx` header block; `src/utils/awardsEngine.js` (potential coupling); `docs/briefs/track-j-daily-capture-v2-kickoff.md` § 0 (OUT scope list).

---

## Delete unconsumed `DailyEntryModal.jsx` (LOW, banked 2026-06-02 from Daily Capture v2 Slice 1 PR #426)

**Status:** `src/components/daily/DailyEntryModal.jsx` is unconsumed after Slice 1 shipped — `AgentDashboard` was switched to mount `DailyCaptureV2` and no other consumer references the old modal. Left in tree intentionally as a clean revert path during the Slice 1 bake-in window.

**Scope when dispatched:** confirm no consumer (`git grep DailyEntryModal` → only `__tests__/DailyEntryModal.test.jsx` should remain) → delete `DailyEntryModal.jsx` + `__tests__/DailyEntryModal.test.jsx` + verify the import in `DailyFAB.jsx` chain is unaffected. Build + test green. No FU body re-audit needed at dispatch time.

**Cross-reference:** `src/components/daily/DailyEntryModal.jsx`; `src/components/daily/__tests__/DailyEntryModal.test.jsx`; `src/components/dashboard/AgentDashboard.jsx` (canonical importer = `DailyCaptureV2` post-Slice 1).

---

## ~~Social-field write gap in `submissionService.sanitize()` — agents' social activity silently dropped~~ (RESOLVED — PR #417, `13df972`, 2026-06-01)

**Status:** RESOLVED in PR #417 (`13df972`). The 5 social/content fields are now enumerated in `submissionService.sanitize()` mirroring the existing nested-object pattern (`socialPlatformBreakdown` built inline with `int()` per platform key alongside `newBusiness` / `pppIncreases` / `lumpsums`). Forward-only fix — historical lost social data not recoverable. Rules verified PERMISSIVE in Phase 1 → no rules deploy needed. 7 new direct `sanitize()` unit tests + 2 end-to-end mocked-setDoc payload tests + live write-read-verify smoke both themes (`scripts/verification/social-sanitize-fix-smoke.mjs`). Original banking content retained below for the closure trail.

---

**Original banking content:**

**Status (at banking):** silent data loss in PROD. Pre-existing — not introduced by Wizard v2 PR1. Surfaced by path-A smoke field-binding verification.

**Bug:** `src/services/submissionService.js`'s `sanitize()` function enumerates the persisted shape field-by-field. The enumeration is missing ALL 5 social/content fields:

- `socialPostsTotal` (Posts Published)
- `socialEngagementTotal` (Engagement)
- `socialInboxEnquiries` (Inbox Enquiries)
- `namesFromSocial` (Names from Social)
- `socialPlatformBreakdown.{facebook, instagram, whatsapp, linkedin}` (Platform breakdown)

`StepSocialMedia.jsx` displays + accepts input for these fields and they flow into `formData` correctly, but `sanitize()` strips them before writing to Firestore. Result: every weekly report submitted has its social-activity section silently dropped. Agents think their social activity is logged; managers see zero social activity on every report.

**Impact:**

- HIGH for data integrity: weeks of agent self-reported social activity dropped without warning.
- HIGH for product trust: the "Social & content" wizard step looks like it works (renders, accepts input, autosaves draft, submits cleanly) — silent loss is worse than a visible error.
- Not a v2 regression: present in main BEFORE Wizard v2 PR1. The legacy v1 wizard had the same flow + same gap.

**Scope when dispatched:**

1. Audit `submissionService.sanitize()` against the wizard's `INITIAL_DATA` field set (in `WizardForm.jsx`). The audit must enumerate every persisted field name in the wizard, every field name in `sanitize()`, and emit a diff.
2. Add the 5 missing fields to `sanitize()` with appropriate coercion (all are `int()` except `socialPlatformBreakdown` which is a nested object — needs `{ facebook: int(...), instagram: int(...), whatsapp: int(...), linkedin: int(...) }`).
3. Regression test: a unit test that exercises every field in `INITIAL_DATA` and asserts every key survives `sanitize()` round-trip with the correct numeric type.
4. Live verification: after fix, re-run the path-A smoke with `expectPersist: true` on `socialPostsTotal`. Should pass.
5. Historical-data note: existing submissions in production have NO social fields. After fix, new submissions WILL have them. Manager-facing surfaces should handle BOTH shapes (use `?? 0` defensive reads, which most already do).

**Why HIGH:**

Silent data loss is the worst class of bug — agents and managers both believe the data is captured. Worth fixing before pilot.

**Cross-reference:** `src/services/submissionService.js:17-110` (sanitize body); `src/components/wizard/steps/StepSocialMedia.jsx` (the dead-write source); path-A smoke `STEP_FILLS[3]` (`socialPostsTotal` marked `expectPersist: false` with a comment pointing to this FU).

---

## Trailing autosave permission error after submit — cosmetic console noise (LOW, banked 2026-06-01 from Wizard v2 PR1 path-A smoke)

**Status:** cosmetic. Pre-existing in main; surfaced as 1 console error per submit on the path-A smoke.

**Symptom:** every successful submit emits ONE `FirebaseError: Missing or insufficient permissions` to the browser console. No user impact — the submit is already persisted, the wizard transitions to 'done' correctly, and the smoke's persistence assertion passes.

**Hypothesis (not confirmed):** the autosave scheduling `useEffect` re-runs after `setScreen('done')`. The cleanup-then-reschedule path may fire one trailing `saveDraft()` call against the doc which is now `status: 'submitted'`. The rule arm `allow update: ... && resource.data.status == 'draft'` denies the write. The `doSave.current` guard checks `draftStatus === 'submitted'` and returns early — but the React state-update timing may let one stale-closure call slip through.

**Scope when dispatched (small, low-risk):**

1. Reproduce locally with verbose logging in `doSave.current` to confirm which call path emits the error.
2. Two candidate fixes — pick one:
   - Make the autosave scheduling `useEffect` early-return when `screen === 'done' || screen === 'submitted'` (parallel to its existing `screen === 'date'` guard).
   - Move the `draftStatus === 'submitted'` guard from inside `doSave.current` up into the timer-scheduling step (so no timer is even scheduled once the draft flips to submitted).
3. Live re-run path-A smoke; assert `errors == 0` (instead of the current `unknownErrors == 0` carve-out).
4. Smoke's known-permissions-error carve-out can then be removed.

**Why LOW:**

No user impact, no data integrity issue. The error logs to console but doesn't surface to the user. Worth cleaning up but doesn't block pilot.

**Cross-reference:** `src/components/wizard/WizardForm.jsx` autosave `useEffect` + `doSave.current` guard; `scripts/verification/wizard-v2-pr1-pathA-smoke.mjs` `knownPermissionsError` carve-out.

---

## ~~Wizard v2 PR2 — live-compute layer~~ (RESOLVED — PR #418, `e301213`, 2026-06-01)

**Status:** RESOLVED in PR #418 (`e301213`). Additive overlay on the PR1 shell: `WeekSoFarPanel` (desktop right rail + mobile collapsed strip) + `MiniSparkline` + `computeWizardLive` pure-function lib + per-field last-week hints. Decisions A/C/D/E locked: NAMES = canonical `totalNewNames` (7-field, namesFromSocial-exclusion proven); ciConv = `NB.apps / ciConducted × 100` matching `closingRatio`; totalProductionAPI delegates to canonical `computeTotalProductionCredit` (10-case parity fuzz test); lumpsum rates from `wizardLive.config.js`. ONE Firestore read via new `getRecentSubmissions(tenantId, uid, 6)` serves both lastWeek + sparkline. Persisted shape + submit path UNCHANGED. 25 compute-lib + 15 panel component tests; 1987/1987 vitest. Mobile expand-to-sheet deferred — see "Wizard v2 PR2 — mobile expand-to-sheet" LOW FU below. Original banking content retained for closure trail.

---

**Original banking content:**

PR1 ports the structural shell only. PR2 adds the v2 mockup's live-compute layer:

- **`WeekSoFarPanel`** — persistent right-rail (desktop) / collapsing bottom-strip (mobile) showing the agent's production API + estimated commission + activity totals as they fill the wizard.
- **`MiniSparkline`** — 6-week API trend with the current week as a "now" bar.
- **2×2 mini-scorecards** — Apps · Conv % · Calls · Names with vs-last-week deltas.
- **Live derivations** — `computeWizardLive` (mockup's `wizard-v2-shared.jsx`) computes total production credit + commission + conversion% from the same formula path as `lib/schema/weeklyReport.computations.js` already uses. Pure read of in-progress formData; no schema additions.

**Scope:** new computation surface; no field schema changes; no submit-path change. Must run client-side as the agent types (debounced computation tick, NOT a Firestore round-trip).

**Why MEDIUM (not LOW):** the panel is the v2 mockup's most visible win for agents — instant feedback on weekly production. Worth doing soon after PR1 lands.

**Cross-reference:** `design_handoff_v2_app/mockups/wizard-v2-shared.jsx` (`WeekSoFarPanel`, `MiniSparkline`, `computeWizardLive` reference impl).

---

## Social-channel inclusion in canonical aggregations — should `namesFromSocial` count toward app-wide NAMES / activity totals? (MEDIUM, banked 2026-06-01 from Wizard v2 PR2)

**Status:** decision needed; touches awards-floor calibration.

**Background.** PR #417 closed the silent-data-loss gap on the 5 social/content fields — `namesFromSocial` now persists per submission. But it is INTENTIONALLY EXCLUDED from the canonical 7-field `computeTotalNewNames` formula (`src/utils/extractFields.js` — `totalNewNames` = `namesFromColdCanvass + referralsObtained + namesFromSeminarsConducted + namesFromSeminarsAttended + namesFromTradeshowsConducted + namesFromTradeshowsAttended + namesFromOther`). The exclusion isn't a bug — the canonical formula predates the social-fields schema addition, and the head-of-sales activity floors were confirmed against the 7-field basis on 2026-05-21. Wizard v2 PR2 (dispatcher option A) locked the wizard NAMES scorecard to the 7-field canonical so the wizard + kiosk + Master Sheet + awards floors + CF stay in lockstep.

**The question.** Should `namesFromSocial` start counting toward the app-wide aggregates? If yes:

- `extractFields.js` `computeTotalNewNames` → 8-field (adds `namesFromSocial`).
- `functions/utils/fieldHelpers.js` `activityTotal` → ticks up by the same delta (currently `totalNewNames + totalTelAttempts + ffiConducted + ciConducted`).
- `src/utils/weeklyActivityFloors.js` `referralsNewLeads` floor → consumes the higher number; thresholds may need re-tuning.
- `src/components/kiosk/panels/WeeklyActivityPanel.jsx` "names" row → ticks up.
- `src/components/manager/MasterSheet.jsx` "New Names" column → ticks up.
- AgentReportDocument funnel + ratios → unchanged (uses `applicationsSold` for the App row, not totalNewNames).
- Cross-surface ripple → awards re-calibration is the load-bearing piece.

**Why MEDIUM.** Touches awards calibration and head-of-sales-confirmed thresholds. Not a silent-data-loss bug like #417 (the data flows through `sanitize()` and persists correctly now). But it IS the second incomplete-social-integration found after #417 — a sweep audit of ALL canonical aggregations that touch `social*` fields is warranted, not just `totalNewNames`.

**Scope when dispatched:**

1. **Audit ALL social-field consumers** across `src/` + `functions/` — every aggregation, ratio, and floor that reads from extracted fields. Enumerate which ones currently include each `social*` field and which don't. List divergences.
2. **Head-of-sales decision** on whether to include `namesFromSocial` (and any other social fields) in `totalNewNames` / `activityTotal` / `referralsNewLeads` floor / kiosk display / Master Sheet.
3. If yes: update the canonical functions, re-tune the awards floor thresholds, and verify across the audit list.
4. Banked decision lives in the brief and propagates via `computeTotalNewNames` (single source of truth).

**Cross-reference:** `src/utils/extractFields.js:124` `f.totalNewNames = computeTotalNewNames(f)`; `src/utils/extractFields.js:140-160` exported `computeTotalNewNames`; `functions/utils/fieldHelpers.js:43-60` CF `activityTotal`; `src/utils/weeklyActivityFloors.js:55,76` `referralsNewLeads`. PR2 dispatcher decision A (option A) locks the wizard panel to the canonical 7-field formula until this FU resolves.

---

## ~~Step4ClosingSales — duplicate `id="apps"` on NB and PPP inputs — LIVE in v1 + v2~~ (RESOLVED — legacy-step retirement R1, PR #420, `22336e5`, 2026-06-02)

**Status:** RESOLVED in legacy-step retirement R1 (PR #420, `22336e5`). The Sales-phase v2 extraction replaced the legacy `Step4ClosingSales` with `v2steps/StepNewBusiness.jsx`, which gives the New-Business-apps + PPP-apps inputs unique `inputId`s (`newBusinessApps` / `pppApps`). The `name="apps"` (nested-object field key) is unchanged, so the persisted shape is byte-identical; only the DOM `id`/`htmlFor` collision is gone. Proven by a component-level no-duplicate-ids assertion (`StepNewBusiness.test.jsx`) + a live no-duplicate-ids check on step 7 in the R1 smoke. The legacy `Step4ClosingSales.jsx` is no longer mounted (deleted in R3). Original banking content retained below for the closure trail.

---

**Original banking content:**

**Status:** pre-existing HTML accessibility bug, LIVE IN PRODUCTION on both wizard tracks. Surfaced during Wizard v2 PR2 live-smoke debugging.

`src/components/wizard/steps/Step4ClosingSales.jsx` mounts two `NumericField`s with `name="apps"` (no `inputId` prop): one in the New Business Card ("Applications Written") and one in the PPP Increases Card ("Number of PPP increases"). `CardStack.NumericField` uses `fieldId = inputId ?? name`, producing `<input id="apps">` for both. The PPP card is collapse-by-default; once expanded, the DOM contains two inputs with the same id and two `<label htmlFor="apps">` elements pointing to different label texts.

**The bug ships in BOTH wizard versions today.** v1 (`WizardForm.jsx`'s legacy 9-step shape) renders `Step4ClosingSales` at step 4. v2 (PR1+PR2 shipped) renders the SAME `Step4ClosingSales` component at step 7 (the legacy step file is 1:1-reused per CLAUDE.md's "Step1-9 NEVER modified" rule, and per PR1's `STEPS` mapping). So this is NOT "defer until legacy retirement" — it's a LIVE production bug affecting every agent on every weekly submission.

**Symptom.** Per HTML spec, `htmlFor` resolves to the FIRST element matching the id. Both labels' accessible names ("Applications Written" + "Number of PPP increases") get associated with the FIRST input (NB.apps). The PPP.apps input gets NO accessible name from `htmlFor`. Screen readers announce the wrong label; `getByLabel(...)` queries in Playwright (and any test tooling that walks the accessibility tree) target the wrong input. PR2 smoke worked around via card-scoped `.nth()` locators; without that, fills land on the wrong input and silently corrupt the test baseline.

**Impact.**

- **a11y in PROD:** WCAG 2.1 SC 3.3.2 (Labels or Instructions) — the PPP.apps input has no programmatic label for assistive tech. Severity is bumped from initial LOW to **MEDIUM** because this is LIVE on every weekly submission for every agent, not theoretical.
- **Test reliability:** any future component or smoke tests targeting these inputs by label will hit the same trap.

**Two paths to fix — dispatcher's call:**

1. **Fix-legacy-now (CLAUDE.md "Step1-9 NEVER modified" rule exception).** Tiny mechanical edit to `Step4ClosingSales.jsx` adding explicit `inputId` props to disambiguate the duplicate ids:
   - NB.apps: `inputId="newBusinessApps"`
   - PPP.apps: `inputId="pppApps"`
   - Audit + fix any other `name=` collisions in the same file (`name="api"`, `name="apiIncrease"` across NB / PPP — same pattern may apply).
   Per the existing CLAUDE.md "Step1-9 NEVER modified" rule, this needs an explicit dispatcher carve-out. The rule was written to preserve the easy-revert property for the v2 shell — but the duplicate-id fix doesn't change the persisted shape, the field set, the layout, or any user-visible behavior; it only adds explicit per-instance ids. Carve-out is low-risk.
2. **Wait for step 7's v2 component.** A future PR that re-fans Step4ClosingSales into v2 atoms (similar to how PR1 re-fanned Step1+Step2 into the `v2steps/` directory) would naturally write fresh inputs with unique ids. Defers the fix until then; bug ships in PROD in the meantime.

**Why MEDIUM (not LOW):**

LIVE accessibility violation in PROD affecting every weekly submission. Was previously framed as LOW + "defer until legacy retirement" — that framing was wrong (the bug doesn't wait for legacy retirement to manifest; it ships TODAY). Re-framed.

**Cross-reference:** `src/components/wizard/steps/Step4ClosingSales.jsx:89-94, 138-144` (the two duplicate-name NumericFields); `src/components/wizard/CardStack.jsx:25-46` (NumericField's `fieldId = inputId ?? name` plumbing); `scripts/verification/wizard-v2-pr2-compute-smoke.mjs` `fillProductionStep` (card-scoped `.nth()` workaround).

---

## Wizard v2 PR2 — mobile expand-to-sheet variant (LOW, banked 2026-06-01 from Wizard v2 PR2)

**Status:** deferred; PR2 brief explicitly carved this out.

**Background.** PR2 ships the mobile collapsed strip — a compact 1-row hero with the live Production API + delta chip + 4-tile mini scorecard. The mockup ALSO shows an expand-to-sheet variant: tapping the strip slides up a full-height sheet (`role=dialog`, `aria-modal`) showing the same content as the desktop right rail panel (hero + 2×2 scorecards + sparkline + still-to-enter hint), full-bleed on mobile.

**Why LOW.** Collapsed strip already delivers the persistent-live-feedback value prop; expand-to-sheet is a "nice to have" depth gesture. PR2 brief deferred to keep scope focused on the canonical-formula reuse + decisions A/C/D/E. Not blocking.

**Scope when dispatched:**

1. New `WeekSoFarSheet.jsx` component that renders the same content as the desktop `WeekSoFarPanel` (factor shared `Hero` + `Scorecard` + sparkline render functions into a small `WeekSoFarContent.jsx` to share between panel variants).
2. Tap handler on the mobile strip opens the sheet; ESC + scrim + handle-drag-down close it. `focus-trap` while open. `motion-reduce:transition-none` guards.
3. Mobile strip stays present underneath; sheet just overlays.
4. Tests: open/close gesture + focus-trap + a11y attributes.

**Cross-reference:** `src/components/wizard/v2chrome/WeekSoFarPanel.jsx` `variant="mobile"` block; `design_handoff_v2_app/mockups/wizard-v2-shared.jsx` (sheet variant not drawn — match the desktop variant content).

---

## ~~WeekSoFarPanel per-scorecard value testid — orphaned 1-line from PR #418~~ (RESOLVED — folded into Wizard v2 PR3 #419, `5ee36d5`, 2026-06-01)

**Status:** RESOLVED in PR #419 (`5ee36d5`, Wizard v2 PR3 Review/celebration). The 1-line `data-testid={\`${testid}-value\`}` addition to the `Scorecard` value `<p>` in `src/components/wizard/v2chrome/WeekSoFarPanel.jsx` shipped as part of PR3 per the "fold into PR3" plan banked at PR #418 post-merge. Original banking content retained for the closure trail.

---

**Original banking content:**

**Status:** 1-line production source change orphaned by the PR #418 timing gap (the dispatcher merged before two follow-up smoke-debug commits reached origin — see CLAUDE.md Methodology Rule 20 banking note). Fold into Wizard v2 PR3 rather than a standalone PR.

**Origin.** Feature-branch commit `94a196d` on the now-deleted `redesign/wizard-v2-pr2-compute` branch added a `data-testid={\`${testid}-value\`}` attribute to the value `<p>` inside the `Scorecard` sub-component of `src/components/wizard/v2chrome/WeekSoFarPanel.jsx`. The edit lets smoke tools read JUST the numeric value from each scorecard (instead of falling back to `card.locator('p').first()`, which is the current workaround in `scripts/verification/wizard-v2-pr2-compute-smoke.mjs` post-merge).

**Why it didn't ship in #418.** Commit was pushed AFTER the dispatcher's squash-merge had already executed. Banked as a methodology-driver in CLAUDE.md Rule 20 to prevent the same race in future PRs.

**Why fold into PR3, not a standalone PR:** the change is 1 line, has no functional impact (purely a test-targeting affordance), and PR3 touches the same file (`WeekSoFarPanel.jsx` will likely gain Review-step + celebration affordances). Bundling it costs 0 incremental review surface area; a dedicated PR would cost a brief, a Vercel build, a smoke run, and a merge cycle for one line.

**Scope when PR3 ships:**

1. Add `data-testid={\`${testid}-value\`}` to the `<p>` containing `{value}` in the `Scorecard` sub-component inside `WeekSoFarPanel.jsx` (around line 261-266 at main HEAD `0fb0992`).
2. Once the testid ships, optionally simplify `readPanelLive` in `scripts/verification/wizard-v2-pr2-compute-smoke.mjs` from `card.locator('p').first()` back to the explicit `[data-testid="…-value"]` query (cleaner reading; not required).

**Cross-reference:** orphaned commit `94a196d` (visible only on the deleted feature branch's reflog); current workaround in `scripts/verification/wizard-v2-pr2-compute-smoke.mjs:262-281` (post-merge fill commit `0fb0992`); CLAUDE.md § Methodology Rule 20 "PR-ready report names the feature-branch HEAD SHA".

---

## ~~Wizard v2 PR3 — discrete Review step + Edit·Step-N jump-back + submit celebration~~ (RESOLVED — PR #419, `5ee36d5`, 2026-06-01)

**Status:** RESOLVED in PR #419 (`5ee36d5`). Final slice of the Wizard v2 arc. New `wizard/v2chrome/ReviewSubmit.jsx` (step 12 with hero + 4 sections + Edit·Step-N pills mapped per mockup: Production→7, Activity→3, Reflection→10, Goals→11) + `Celebration.jsx` (confetti/sparkles motion-reduce safe; leaderboard messaging honors the existing scheduled-CF hourly path). Submit moved from step 11 → step 12 with payload-identity preserved (PR1's `WizardFormV2PayloadIdentity` regression tests updated to walk through 12 steps + still pass byte-identical assertion). Compute reuse via PR2's `wizardLive.computations` lib (Review↔panel parity by construction). Folded in the orphaned PR2 value-testid (1-line, from #418 commit `94a196d`). 2025/2025 vitest. Original banking content retained for the closure trail. Post-PR3 legacy-step retirement is now actionable — see separate FU.

---

**Original banking content:**

**Status:** ready to dispatch AFTER PR2 lands (PR1 → PR2 → PR3 sequence).

PR1 ends step 11 with a direct submit. PR3 reintroduces the v2 mockup's discrete step 12 (Review & submit):

- **Step 12 = Review screen** — replaces step 11's "Submit" arm with a Next-to-Review button. The 12-dot rail's step 12 dot lights up as the current step.
- **Per-screen summary panels** — production credit + commission + activity totals laid out for visual scan before submit (current `ReviewSummary` + `ProductionSummaryPanel` adapted to v2 grammar).
- **Edit·Step-N jump-back** — every panel has an "Edit" affordance that returns the agent to that specific step. After editing, "Back to Review" returns to step 12.
- **Submit celebration** — after submit, a brief celebratory frame (confetti + figures + "Submitted ✓") before transitioning to the existing 'done' screen.

**Scope:** UI only. No schema, no compute, no submit-path change. PR3 restores the 'review' screen the legacy WizardForm had (with v2 visual treatment + jump-back), and adds the celebration as a transient state between submit and 'done'.

**Cross-reference:** `design_handoff_v2_app/mockups/wizard-v2-screens.jsx` (`ReviewSubmit`, `Celebration` reference impls).

---

## Wizard v2 — Decision-A SUGGESTED-atom + goal-seeding (MEDIUM, banked 2026-06-01 from Wizard v2 PR1 shell #416)

**Status:** product decision needed BEFORE the SUGGESTED atom is wired.

The v2 mockup adds a NEW per-field SUGGESTED hint atom + per-field last-week comparison chips. These are explicitly DEFERRED in PR1 because each field needs a per-field source decision: should the suggestion come from (a) the agent's last week's value, (b) the company's weekly activity floor, (c) the tenure-based floor, (d) the agent's personal next-week goal from a prior submission, or (e) some hybrid?

**Important distinction (preserve-list from PR1):** the v2 mockup's NEW per-field hints + new SUGGESTED atom visual are deferred here. The wizard's EXISTING last-week reads + suggested derivations are PRESERVED in PR1 (NOT this FU's scope):

- `Step5NewNames.jsx` reads `lastWeekData?.oldNamesPool` → derives a "suggested" pool value
- `Step6DeliveriesService.jsx` reads `lastWeekData?.policiesOutstanding` → derives a suggested outstanding count
- `Step4ClosingSales.jsx` derives a `suggestedCiConducted` from `newCIBooked + oldCIBooked` (pure local)

These existing reads use the existing `SuggestedField` atom + the `WizardForm`'s existing `getLastSubmission` data flow. They ride through unchanged across the re-fan.

**Scope when dispatched:**

1. **Per-field source mapping**: decide what each field's SUGGESTED value should be sourced from. Likely a table with rows per persisted field × columns (last-week / weekly floor / tenure floor / personal goal / none).
2. **`SUGGESTED` atom refresh**: update the existing `SuggestedField` atom in `CardStack.jsx` to match the v2 mockup's visual (small pill near the input, "Suggested · N" + hint phrase). Don't break existing consumers.
3. **`computeFieldSuggestion(field, agentContext)` helper** — pure function returning the suggested value + caption phrase per field. Pulls from existing data paths (`lastWeekData`, `weeklyActivityFloors`, `companyFloor`, `agentProfile`).
4. **Wire into each v2 step** that has a target field — typically Activity steps where last-week numbers are useful anchors.

**Why MEDIUM:** core UX hint that closes the v2 mockup's most-explicit deferred decision. Doesn't block PR2 or PR3.

**Cross-reference:** PR1 brief's Decision A (originally deferred); `design_handoff_v2_app/mockups/wizard-v2-shared.jsx` `NumField` SUGGESTED hint pattern.

---

## ~~Post-PR3 — legacy `wizard/steps/Step1–9.jsx` retirement + `v2steps/` markup dedupe~~ (RESOLVED — autonomous R1→R2→R3 retirement stack complete, 2026-06-02)

**Status:** RESOLVED across PRs #420 (R1), #421 (R2), #422 (R3) — autonomous stacked-rebase cadence. R1 (#420, `22336e5`): Sales-phase v2 extraction of steps 6/7/8 + Step4 duplicate-id fix. R2 (#421, `0cf90d7`): Reflection + Goals v2 extraction of steps 9/10/11. **R3 (#422, `f25c6d8`):** Activity-remainder extraction of steps 4/5 (`StepSocialMedia` → `v2steps/StepSocialContent.jsx`; `Step5NewNames` → `v2steps/StepNewNamesAdded.jsx`) + `socialMediaConstants.js` moved into `v2steps/` + **DELETE of all 10 legacy step files** (`Step1Prospecting`/`Step2Telephone`/`Step3Approaches`/`Step4ClosingSales`/`Step5NewNames`/`Step6DeliveriesService`/`Step7TimeManagement`/`Step8SelfEvaluation`/`Step9Goals`/`StepSocialMedia`) + `StepSocialMedia.test.jsx` + old `socialMediaConstants.js` + 6 wizard test files' dangling `vi.mock('../steps/…')` lines via sed. The `wizard/steps/` directory is gone. Wizard is now 100% v2 — all 12 wizard steps mount from `v2steps/`, the PR1 duplication is closed. Payload-identity held byte-for-byte across the entire R1→R2→R3 stack. Production smoke PASS both themes after each merge (R1 + R2 + R3); R3 smoke explicitly read-back steps 4/5 (socialPostsTotal=44/namesFromSocial=6/referralsObtained=8). Original banking content retained below for the closure trail.

**Now actionable.** PR3 (Wizard v2 Review/celebration) shipped, completing the 3-PR Wizard v2 arc. The v2 wizard is the complete flow today — agents go through 12 v2 steps and submit from the new Review screen. Legacy `wizard/steps/Step1–9.jsx` files were preserved through PR1/PR2/PR3 for the easy-revert property; that preservation is no longer load-bearing now that v2 is fully shipped + battle-tested in production. **Promoted from LOW to MEDIUM** because the retirement pass also lands the **Step4ClosingSales duplicate-id MEDIUM FU fix** (NB.apps + PPP.apps share `name="apps"` → screen readers + label-based test queries target the wrong input; LIVE accessibility violation in both v1 + v2 since v2 step 7 1:1-reuses Step4ClosingSales).

**Scope at retirement-pass dispatch:**

1. Audit which legacy step files are still consumed by `WizardForm.jsx` STEPS array post-PR3 (any 1:1-reused without a v2 re-fan).
2. Either rewrite the still-consumed legacy steps into proper `wizard/v2steps/*` files (matching the PR1 pattern) OR explicitly carve a CLAUDE.md rule exception to edit them in place with the `inputId` fix.
3. Delete orphaned legacy step files (no live consumers).
4. Fold in the Step4ClosingSales duplicate-id fix: add `inputId="newBusinessApps"` + `inputId="pppApps"` (and audit `api` / `apiIncrease` for the same pattern across NB / PPP / LMPS).
5. Optional: simplify smoke tools that worked around the duplicate-id via card-scoped `.nth()` locators (revert to `getByLabel` once IDs are unique).
6. Update CLAUDE.md "Step1-9 NEVER modified" rule — the easy-revert property is traded for the v2 wizard being canonical.

### Original LOW framing (retained for closure trail)



**Status:** dispatched ONLY after Wizard v2 PR3 lands AND the v2 wizard is the only live path. Until then, the legacy `wizard/steps/Step1–9.jsx` files remain on disk as the easy-revert escape hatch (canonical Wizard rule from CLAUDE.md: "Step1–Step9 files are NEVER modified. WizardForm.jsx groups them into 5 screens. Revert to 9 steps = one git revert on WizardForm.jsx only.")

PR1's structural shell drove a deliberate duplication that needs to be unwound once the v2 wizard is fully live:

- **`wizard/v2steps/StepLettersOutreach.jsx`** re-fans the "Letters & Outreach" Card markup that lives in `wizard/steps/Step1Prospecting.jsx`.
- **`wizard/v2steps/StepSeminarsTradeshows.jsx`** re-fans the Seminars + Tradeshows Cards from `Step1Prospecting.jsx`.
- **`wizard/v2steps/StepCallsF2F.jsx`** combines markup from `Step2Telephone.jsx` + Step1's F2F Card.
- Steps 5–11 use the legacy `Step5NewNames.jsx` / `Step6DeliveriesService.jsx` / etc. files 1:1; no v2 re-fan needed (they slot in unchanged).

After PR3 ships (v2 = live default + no live consumer for the legacy steps):

1. Verify nothing imports `wizard/steps/Step1Prospecting.jsx` or `Step2Telephone.jsx` (or any other legacy step file).
2. Delete the orphaned legacy step files (Step1–9 once confirmed all consumers migrated).
3. Audit `v2steps/` for any markup that could fold back into shared atoms in `CardStack.jsx` (the re-fans were screen-by-screen literal ports; some atoms may merge).
4. Update `tailwind.config.js` content globs if any path changes affect class extraction.
5. Update CLAUDE.md's wizard-rules section to retire the "Step1–9 NEVER modified" rule (the easy-revert property is then traded for the v2 dead-code elimination).
6. Bank a NEW easy-revert mechanism for the v2 wizard (likely: keep the v2 wizard's compose layer pure so the rewire IS the revert surface).

**Why LOW:** no user impact, no data integrity concern, no perf regression. Dead-code accumulation is the only cost. Worth doing for clarity but not urgent.

**Why deferred (not done as part of any sooner PR):** the easy-revert property is the dispatcher's primary safety net for the entire Wizard v2 series. Retiring it before PR3 ships removes the most surgical rollback path. Keep until PR3 + a stabilization window has passed.

**Cross-reference:** `src/components/wizard/v2steps/*.jsx` (new in PR1) · `src/components/wizard/steps/Step1Prospecting.jsx`, `Step2Telephone.jsx` (the duplicated source markup) · CLAUDE.md "Key Technical Decisions" Wizard rule.

---

## Functions runtime + SDK upgrade — Node.js 20 EOL + `firebase-functions` 4.x → 5.x (MEDIUM with hard deadline, banked 2026-06-01 from PR #415 functions deploy)

**Status:** MEDIUM now; **escalate to HIGH approaching October 2026.** Deploys will start failing 2026-10-30.

The `firebase deploy --only functions` run on 2026-06-01 (post-PR-#415) surfaced two deprecation warnings against the production functions deploy:

1. **Node.js 20 runtime is decommissioned 2026-10-30.** After that date, `firebase deploy --only functions` will break for any function pinned to Node 20. `functions/package.json` currently declares:
   ```
   "engines": { "node": "20" }
   ```
   Must bump to the next supported Node LTS (`22` or later — verify what Firebase Cloud Functions supports at upgrade time; LTS cadence may have moved).

2. **`firebase-functions` 4.9.0 → ≥5.1.0** (breaking-changes migration). `functions/package.json` currently declares:
   ```
   "firebase-functions": "^4.9.0"
   ```
   The 5.x line has breaking API changes (region declarations, runtime options shape, callable/trigger signatures all evolved). This is NOT a drop-in `npm update`; it requires deliberate per-function review.

**Why one coordinated pass, not two separate PRs:**

- Both upgrades affect the same `functions/` deploy bundle.
- The Node 22 (or whatever LTS lands) jump is partly motivated by `firebase-functions` 5.x dropping older Node compat.
- A two-pass migration (Node first, then SDK) wastes a full deploy cycle and doubles the smoke surface.
- Doing them together amortizes the deploy-risk window into one coordinated pass with one comprehensive smoke pass.

**Scope when dispatched:**

1. **Audit all `functions/` exports.** Inventory every exported function in `functions/index.js` and the modules it delegates to (kiosk, leaderboard, awards, etc.). Note: 22 functions per the 2026-06-01 deploy ("all 22 functions Successful update operation").
2. **Read the `firebase-functions` 5.x migration guide.** Specific watch points: region declaration (`functions.region()` → `setGlobalOptions`), runtime options (memory / timeout / concurrency shape changes), HTTPS callable signature changes, Firestore trigger signatures (Event Arc vs v1), Scheduled trigger signatures.
3. **Bump `functions/package.json`:** `engines.node` to current Firebase-supported LTS + `firebase-functions` to ≥5.1.0 + run `npm install` in `functions/` + re-pin lockfile.
4. **Migrate every export.** Per-function review; no blanket find-replace. Especially careful around `recomputeLeaderboardOnDemand` (callable), `validateKioskToken` / `createKioskToken` / `revokeKioskToken` (kiosk), the scheduled `recomputeLeaderboardScheduled`, and any Firestore-trigger functions.
5. **Run the full `functions/` test suite.** Add new integration coverage for any function whose signature changed.
6. **Smoke pass before deploy.** Each function's caller — leaderboard recompute (TA-callable), kiosk validate (anonymous HTTPS), emails (Sunday/Monday/PasswordReset triggers), and any Firestore-triggered functions — exercised once in a smoke harness against the emulator + preview.
7. **Dispatcher deploys** with the deploy-hygiene check + a careful post-deploy live smoke pass against `agencytrack-2a610`. Per Rule 19 CC does NOT deploy this; CC's role ends at the staged PR.
8. **Rollback plan**: capture pre-upgrade `firebase-functions` version + Node engine + deploy URL in the PR body so a quick rollback is available if a live function breaks post-deploy.

**Why MEDIUM now:**

- 5 months of runway before the Oct 2026 deadline (deadline → date of first BLOCKED deploy).
- Reducing to a HIGH item ~6 weeks before the deadline (mid-September 2026) prevents a scramble.
- Earlier-is-better: any breaking change uncovered in the SDK migration is easier to absorb when the deadline isn't biting.

**Cross-reference:** PR #415 (`aae5c35`) deploy warnings sourced this FU; `functions/package.json` engines.node + dependencies.firebase-functions are the upgrade targets.

---

## SM access to ManagerAwardsPanel + BmAtRiskPanel — deliberate decision needed (MEDIUM, banked 2026-06-01 from manager-side carve-out PR #412)

**Status:** product decision needed BEFORE any code change.

PR #412 (Manager Awards v2 carve-out) excluded `sales_manager` from the `isBmPlus` gate in `ManagerAwardsPanel.jsx` — the gate now reads `branch_manager || tenant_admin || platform_admin` (matching the pre-#412 behavior). The PR's initial commit had extended `isBmPlus` to include `sales_manager`; the dispatcher reverted that during pre-review because:

1. **Role-access behavior change is beyond a pure-restyle PR's scope.** The restyle should only touch presentation, not who-sees-what.
2. **The PR's smoke never exercised the SM path** — the SM credential was not in the smoke matrix, so the change shipped untested for SM.
3. **SM has no single branch** — same shape as the leaderboard problem P5b solved deliberately (PR #411 `SmLeaderboardView` with all-branches picker + per-UID persistence). Manager awards may need a parallel "SM all-branches awards view" with its own scoping decision, NOT a one-line gate extension.

**Open questions for the decision:**

1. **Should an SM see `ManagerAwardsPanel`?** It computes manager-awards across an `agentIds` list. For an SM with `ownedBranchIds: ['*']`, that list is either: every agent in the tenant (potentially hundreds), or empty until the SM picks a scope. Either default is awkward.
2. **Should an SM see `BmAtRiskPanel`?** Same question — the panel computes per-agent at-risk status across an `agentIds` list.
3. **All-branches scope pattern**: should SM follow the P5b leaderboard pattern (branch-picker → per-branch awards view) or a tenant-wide aggregation (composite across all branches)? Both have design rationale.
4. **Where does the SM's manager-awards view live?** Inside `ManagerAwardsPanel` (with an SM-mode prop) or a new `SmAwardsView` wrapper (mirroring `SmLeaderboardView`)?

**Scope when dispatched (after the decision):**

1. Decide on the SM all-branches awards-scope pattern (likely: mirror `SmLeaderboardView` with `SmAwardsView` for consistency).
2. Implement the SM view (separate PR — NOT a one-line gate extension).
3. Smoke must include the SM credential and verify the all-branches scope works as designed.

**Why MEDIUM (not LOW):**

The pattern decision (SmAwardsView vs SM-prop on ManagerAwardsPanel) affects every future manager-tier surface the SM eventually accesses — Master Sheet, Compliance, Goals, Persistency manager-side, etc. Worth a single design pass before shipping.

**Cross-reference:** PR #411 (`40296b6`) for the leaderboard precedent; `src/components/leaderboard/SmLeaderboardView.jsx` for the all-branches picker pattern.

---

## Awards primitives dedup — consume `awardPrimitives.jsx` from `AgentAwardsPanel.jsx` (LOW, banked 2026-06-01 from manager-side carve-out PR #412)

**Status: RESOLVED 2026-06-04 (Track J item 17, PR #462 `2df58e6`, prod-verified).** `AgentAwardsPanel.jsx` now imports `{ HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer }` from `awardPrimitives.jsx` (AwardDonut is internal-only); the inline copies were deleted (−224 net lines); `RatioMiniSpark`/`RatioTrendCard` kept inline (agent-only). Adopting canonical also removed standing design-system violations (hex→token, 36→44px touch target, responsive hero, %-unit, testids) — the intended deltas, authorized. The earlier orphan-sweep half (delete dead `AwardMedalCard`/`AwardMedal`/`awardIconMap`) shipped separately as PR #453. The duplicated `formatAwardPct` call sites have collapsed to the single shared one. Original FU text preserved below as drift-trail.

PR #412 (Manager Awards v2 carve-out) extracted the v2 primitives into a shared module `src/components/awards/awardPrimitives.jsx` (AwardDonut, HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer) + `src/components/awards/awardGrouping.js` (groupByProgress). `ManagerAwardsPanel.jsx` + `BmAtRiskPanel.jsx` consume from those modules.

`AgentAwardsPanel.jsx` (shipped earlier in #391) still carries inline-duplicated copies of those same primitives. The duplication was intentionally retained at carve-out time to keep the carve-out PR's scope terminal at `src/components/awards/Manager*` + tests (per the brief).

**Scope when dispatched:**

1. Delete the inline `AwardDonut`, `HeroAwardCard`, `GroupHeader`, `AwardCard`, `AwardDrillDrawer` definitions in `AgentAwardsPanel.jsx`. (`RatioMiniSpark` + `RatioTrendCard` are agent-only Activity-Ratio-Trends primitives — leave inline OR move to the shared module if a future manager surface wants them; dispatcher's pick.)
2. Import all of them from `./awardPrimitives` + `./awardGrouping`.
3. Replace the inline `useMemo({ heroAward, qualified, almostThere, makingProgress, justStarting })` block in `AgentAwardsPanel.jsx` with `useMemo(() => groupByProgress(filteredAwards), [filteredAwards])`.
4. Confirm `npm run lint && npm test && npm run build` stays green; the `AgentAwardsPanel.test.jsx` cases continue to pass without modification (the primitives' rendered DOM is unchanged because they're a verbatim extraction).

**Why LOW:**

Pure DRY cleanup. No user-facing change. Saves ~250 lines from `AgentAwardsPanel.jsx`. Safe to defer; not blocking any future work.

**Cross-reference:** `src/components/awards/awardPrimitives.jsx` module header JSDoc explicitly calls out the AgentAwardsPanel-still-inline state for future readers.

**Note (PR #440, `5d0cb71` — round displayed award %):** the progress-percentage rounding fix had to be applied to BOTH the shared `awardPrimitives.jsx` and the inline copies in `AgentAwardsPanel.jsx` precisely because of this duplication — a one-site fix would have left the agent panel showing raw floats. Both now route their displayed percent through `formatAwardPct` (`src/utils/formatters.js`). This dedup FU **remains open and untouched**; once consumed, the duplicated `formatAwardPct` call sites collapse to the single shared one.

---

## Awards orphan cleanup — delete `AwardMedalCard.jsx` + `AwardMedal.jsx` + `awardIconMap.js` (LOW, banked 2026-06-01 from manager-side carve-out PR #412)

**Status:** dead-code removal; no behavior change.

After PR #412 (Manager Awards v2 carve-out) replaced `AwardMedalCard` consumption in `ManagerAwardsPanel.jsx` with the new `AwardCard` primitive, these files have no remaining importers:

- `src/components/awards/AwardMedalCard.jsx` — was only imported by `ManagerAwardsPanel.jsx` (now removed)
- `src/components/awards/AwardMedal.jsx` — was only imported by `AwardMedalCard.jsx`
- `src/components/awards/awardIconMap.js` (if present) — was only imported by `AwardMedalCard.jsx`

**Scope when dispatched:**

1. `git grep -E "AwardMedal|awardIconMap" -- src/` to confirm zero importers.
2. Delete the orphaned files.
3. Confirm `npm run lint && npm test && npm run build` stays green.

**Why LOW:**

Dead code in the repo doesn't break anything but clutters the awards directory. Safe to defer; not blocking any future work. Combinable with the dedup FU above into a single small PR.

---

## Track J Wizard v2 — REDESIGN, not RESTYLE (banked 2026-06-01 from surprise-stop)

**Status:** brief rewrite needed BEFORE any code work begins.

The first Wizard v2 brief was scoped as a "chrome-only restyle" preserving the existing P7A 9→5 grouping. Source-verifying the v2 mockup (`design_handoff_v2_app/mockups/AgencyTrack Weekly Report Wizard v2.html` + `wizard-v2-shared.jsx` + `wizard-v2-screens.jsx`) surfaced three central design moves that cannot be honored under a presentational-only constraint:

1. **5 screens → 12 micro-steps grouped into 4 named phases** (Activity · Sales · Reflection · Goals). The mockup's `WIZARD_PHASES` + `WIZARD_STEPS` constants and the `PhaseProgress` 11-dot indicator are sized for the re-pagination. The brief explicitly forbade touching grouping/composition.
2. **`WeekSoFarPanel` — persistent live sidebar** (right rail desktop · collapsing strip mobile) showing real-time production API totals, estimated commission at the agent's commission rate, a 6-week API sparkline, 2×2 mini-scorecards (apps / conv. / calls / names) with vs-last-week deltas, and a "still to enter" hint. Required new computation surface (`computeWizardLive`) that runs as the agent types — not chrome.
3. **Per-field "SUGGESTED" hints + "LAST WK · N" comparison chips on every input** — required a suggestion engine + per-field last-week lookup at render time. New data plumbing, not styling.

Also notable: `AutosaveChip` replaces `SaveStatusIndicator` with a pill-style chip carrying a timestamp ("Saved · 12s ago"). That sub-piece IS presentational and could be ported standalone if the broader redesign defers.

**What needs to happen before this can be dispatched:**

- **Rewritten brief** that either (a) authorizes the full 12-step / 4-phase re-pagination + `WeekSoFarPanel` + suggestion engine as a REDESIGN PR family with explicit acceptance of composition/computation changes, or (b) enumerates the v2 mockup features to SKIP and re-scopes to a strict presentational subset (header chrome, AutosaveChip, StepTitle eyebrow, progress-bar visual upgrade adapted to 5 screens, field focus-glow). Either is internally consistent; the mis-scoped brief tried to do both.
- **Claude Design input** on the re-pagination question: does 12 micro-steps actually improve the agent's mobile UX vs the current 5-grouped screens with vertical scroll? P7A's original 9→5 collapse was a deliberate UX win (fewer next-clicks); a 5→12 fan-out reverses that. Worth a design-rationale pass before committing to the brief.
- **WeekSoFarPanel scope decision:** ships as part of the wizard PR family, or as a separate "live-totals during wizard entry" feature PR? The latter is cleaner from a single-responsibility standpoint.

**Worktree state:** the wizard worktree (`/c/Projects/AgencyTrack-wizard`) was discarded; `redesign/wizard-v2` branch deleted; brief commit `944103f` went with it. Daily Capture brief is HELD in Downloads pending the same audit (STEP 2 of the 2026-06-01 unsupervised window classified it as well — see `docs/track-j-port-ledger.md` and the audit table in the same session).

**Cross-reference:** `docs/track-j-port-ledger.md` row #5 is the source for this FU. Once a rewritten brief is in place, the row's status changes from "PENDING — REDESIGN, not RESTYLE" to whatever the dispatched scope ends up shipping.

---

## ~~Track J — Cyril branch rich seed~~ (SUPERSEDED — demo-surfaces seed PR #443, `cdc836e`, 2026-06-03)

**Status:** SUPERSEDED. The demo-surfaces seed (`functions/scripts/seed-demo-surfaces.cjs`, PR #443) now seeds **goals + policies** for the 3 real Cyril agents (and every other real agent) — partial Cyril enrichment shipped. The original FU's core remainder (Cyril **submissions** for the cross-branch leaderboard comparison) is **re-banked precisely** as "Track J — Cyril agents lack seeded submissions" below. Original banking content retained for the trail.

**Status (original):** OPTIONAL — current honest-empty is sufficient for the SM picker proof.

PR #411's live smoke proved the SM all-branches picker re-reads per branch by demonstrating the contrast between `tatil_south` (populated podium · 6 agents · the PR #410 seed) and `Cyril Murray Branch` (honest empty-state · 3 agents · no submissions). The empty-state demo is correct + honest, but it would be more useful for Tatil-demo prep to have BOTH branches populated so the SM picker shows a side-by-side production comparison.

**What this FU buys:**

- Cyril branch has 3 real agents already (no PR-F roster needed); seed two weeks of submissions across them with a deliberately different ranking shape than `tatil_south` (e.g., Cyril rank 1 ahead of `tatil_south` rank 4, so the SM picker shows a real "cross-branch leadership comparison" not a "populated vs empty" comparison).
- Re-uses the existing `functions/scripts/seed-leaderboard-test-data.cjs` machinery; the Cyril data design was preserved in the script for this future re-run (per PR #410 dispatcher Path A note).
- Re-uses the existing two-gate prod-write pattern: dry-run pre-review → `--execute --i-confirm-prod-write` after dispatcher authorization.

**Why it's LOW:**

The honest empty-state is the correct production behavior (no submissions ≠ no agents); the SM picker proves cross-branch re-read regardless of whether the second branch is populated. This FU is purely demo-prep polish, not a correctness gap.

**Scope when dispatched:**

1. Re-enable the Cyril resolution path in `seed-leaderboard-test-data.cjs` (the 3 agents are already resolvable by UID — no roster gap to close).
2. Dispatcher pre-reviews the Cyril dry-run output (movement shape, ranked-$0 inclusion, idempotency).
3. Live run via `--execute --i-confirm-prod-write`, then `recomputeLeaderboardOnDemand`, then verify via the existing `scripts/verification/seed-verify.mjs` harness extended for Cyril.

Cross-reference: PR #410 (`2b3c0cb`); seed script header comment block preserves the Cyril design.

---

## Track J — Cyril agents have goals + policies but no seeded submissions (LOW, banked 2026-06-03 from demo-surfaces seed PR #443)

**Status:** OPTIONAL demo-prep polish (re-banked from the superseded "Cyril branch rich seed" FU above).

The demo-surfaces seed (`seed-demo-surfaces.cjs`) gives the **3 real Cyril agents** (`ljbBHP1g7lbZXvHlpcDn`: PR-D Smoke Agent 2/3/4) personal **goals + policies**, so their agent dashboards / Policy Ledgers look alive. But **submissions** for Cyril are still NOT seeded — `seed-leaderboard-test-data.cjs` only resolves the `tatil_south` agents (its Cyril path keys on the absent `@agencytrack.test` roster). So the SM cross-branch leaderboard comparison still shows Cyril empty.

**What this FU buys:** populate Cyril's leaderboard so the SM all-branches picker shows a real side-by-side comparison (vs. populated-vs-empty).

**Scope when dispatched:** extend `seed-leaderboard-test-data.cjs`'s roster resolution to cover Cyril's **real** agents by UID/name (the 3 PR-D smoke agents — NOT the absent `@agencytrack.test` roster), with a deliberately different ranking shape than `tatil_south`; dispatcher pre-reviews the dry-run; live `--execute --i-confirm-prod-write`; recompute; verify. This is the precise remainder of the superseded Cyril rich-seed FU.

**Why LOW:** honest empty-state is correct production behavior; this is demo polish, not a correctness gap.

**Cross-reference:** `functions/scripts/seed-demo-surfaces.cjs` (goals+policies, this PR); `functions/scripts/seed-leaderboard-test-data.cjs` (`CYRIL_RANKINGS` keys on `@agencytrack.test` emails — the gap); superseded FU above.

---

## Track J — SM picker default-to-populated-branch UX nicety (LOW, banked 2026-06-01 from PR #411 live-smoke aftermath)

**Status:** UX polish, not a correctness gap.

PR #411 defaults the SM's first-use branch to the **first sorted active branch**. Branch sort is alphabetical, so the current tenant defaults to "Cyril Murray Branch" — which is intentionally empty per the seed Path A, producing an immediate empty-state on first use. Once an SM picks a populated branch, persistence kicks in and the empty-state never resurfaces; but the first-impression UX is "open the leaderboard → see empty-state → realize I need to switch branches → see real data."

**Possible UX improvements (each independent, dispatcher picks):**

1. **Default to the branch with the most current-week submissions** instead of alphabetical-first. The aggregate doc carries this signal (sum of WEEK array entries with `periodApi > 0` per branch). Defensible: SM cares about activity, not alphabetization.
2. **Default to the branch with the most recent `computedAt`** (proxy for most-recently-active). Cheaper read.
3. **Default-by-config-hint:** add an optional `defaultBranchId` field to `config/companyMinimums` (or a new `config/leaderboard`) that tenant_admin can set as the SM's home-branch on first use.
4. **Two-pane "you're here, here's the spread" treatment:** branch picker on the left, a tiny per-branch eyebrow stat (e.g., "South · 12 agents · $42k WK") so SM sees comparative shape without picking.

Each is small; the work IS in deciding which one fits.

**Why it's LOW:**

The current default is internally consistent (first sorted) and persistence covers steady-state usage. The first-impression awkwardness only fires on truly empty branches (which the Cyril rich-seed FU above would resolve from a different angle — if every branch has submissions, alphabetical-first lands on populated data anyway).

**Dependency:** ships AFTER Cyril rich-seed if option 1 or 2 is chosen, because the "most-active" signal requires populated branches to test against.

Cross-reference: PR #411 (`40296b6`); `SmLeaderboardView.jsx` default-pick logic at the `// Resolve initial selection` block.

---

## Deploy hygiene — banked for CLAUDE.md addition (banked 2026-06-01 for dispatcher review)

**Status: RESOLVED 2026-06-04 (Track J overnight queue, item 16).** The proposed worktree-pre-flight wording below was approved by the 2026-06-04 dispatcher re-scope/extension decision block (item 16 part a2) and added verbatim to `CLAUDE.md` § Workflow as the `firebase deploy` pre-flight bullet. The companion deploy-gating one-liner (item 16 part a1 — "Functions / email-template / index changes take effect only after an explicit `firebase deploy` … never assume deployed because merged") landed in the same bullet group. The dispatcher's explicit item-16 authorization is the review that satisfies the standing "CC must not edit CLAUDE.md unsupervised" directive cited below. The original wording + dispatcher review prompts are preserved unchanged as drift-trail.

Several recent deploy-related near-misses share a common shape: a worktree at the wrong commit, or with stale `node_modules`, runs `firebase deploy` and either ships old code or fails on missing deps mid-deploy. The standing protection ("Order matters when removing key-file workarounds" in CLAUDE.md) covers the credential-rotation case but not the more common everyday-deploy case. The rules-deploy discipline ("§ Workflow — IMPORTANT" bullets) covers the pre-merge-vs-post-merge gating but not the "what state must the worktree be in at deploy time" question.

**Proposed rule wording** (for dispatcher to copy verbatim into CLAUDE.md if approved):

> **`firebase deploy` pre-flight: worktree at `origin/main` HEAD + `node_modules` installed.**
>
> Before any `firebase deploy --only functions` / `--only firestore:rules` / `--only firestore:indexes` from a feature worktree:
>
> 1. **Confirm the worktree's HEAD matches `origin/main`** (unless this is a pre-merge additive-rule deploy per the existing "Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges" carve-out). Pattern: `git fetch origin && git rev-parse HEAD == git rev-parse origin/main`. Mismatch → STOP and surface.
> 2. **Confirm `node_modules` is installed and current** at the worktree's package root for whichever surface is being deployed: `functions/node_modules` for functions deploys, repo-root `node_modules` for any build-step that runs ahead of the deploy. Pattern: a quick `npm install --silent` in the relevant directory (idempotent if already installed). Missing → install before proceeding.
> 3. **Confirm authenticated against the correct Firebase project** via `firebase use` or the project flag.
>
> Why: stale-worktree deploys ship code that doesn't match what the PR proved; missing-`node_modules` deploys fail mid-flight with cryptic errors that look like Firebase issues. Both classes are silent until they bite.
>
> Carve-out for pre-merge additive rules / function exports: the existing § Workflow bullet ("Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges") authorizes a deploy from a worktree NOT at `origin/main` HEAD. Step 1 above is waived for that specific case. Steps 2 + 3 still apply.

**Dispatcher review prompts:**

- Is the carve-out for pre-merge additive deploys correctly stated? (The current CLAUDE.md text is in § Workflow under "Additive Firestore rules / Cloud Functions — deploy from the feature worktree before the PR merges".)
- Should the rule also gate `firebase deploy` based on `git status --short` being empty (no uncommitted changes in the deploy-relevant subtree)?
- Section placement: under § Workflow alongside the existing deploy bullets, or under a new "Deploy hygiene" subsection?

This FU exists to capture the proposed wording without modifying CLAUDE.md per the dispatcher's instruction. Bank-only; no code change required.

---

## Track G — G2–G7 slice plan (banked from G1 brief, 2026-05-25)

G1 (walking skeleton) is the current PR (FOUNDATION GATE). Remaining slices:

**G2 — PAYE Engine** — ✅ DONE PR #344 (`59d2291`). `src/utils/payeEngine.js` exports `DEFAULT_PAYE_CONFIG` (T&T 2026: allowance $90,000, chargeable brackets 25% ≤$1M / 30% above), `computePAYE(gross, config)`, `grossFromNet(net, config)`. Config-driven chargeable-bracket band walk; 43 unit tests covering all brief vectors, band formulas, pivot continuity, and round-trip property. Tenant `/config/payeFormula` doc + `payeBracketsSnapshot` versioning + refresh-banner deferred to G3 or a dedicated config slice.

**G3 — Expense Group Entry** (core data-entry loop)
- Line-item add/edit/delete per group.
- Frequency selector (A/S/Q/M) with auto-annualized display.
- Save patches `expenseGroups.{groupKey}` on each group save.
- PAYE section wired to `payeEngine.grossFromNet` live.
- Running `totalAnnualAfterTax` + `totalAnnualPreTax` shown.

**G4 — Sub-Calculators**
- Insurance Industry Expenses modal → rolls up into Business Expenses `subCalculatorRefs`.
- Car Expenses modal → personal/business split logic → Living + Business rollup.
- Loans/Debt panel → separate total shown.
- All three patch `subCalculators.*` + recalculate affected group totals.

**G5 — Privacy Model + Consent** — ✅ DONE PR #354 (`f200bc6`). true-ownership rules (owner get/list/update via match-level `agentId` var); BM branch-scoping via `users/{agentId}` branchId lookup; UM/BM `get` allowed when `visibility != 'private'` (two separate `allow get` declarations per I1.2 banked pattern); `updateVisibility` service method; visibility toggle footer; `shareWithSm` toggle; manager-read audit subcollection. 31/31 emulator rules tests; vitest green; lint 0; build clean.

**G6 — Commission Targets + Send to Playground** — ✅ DONE PR #350 (`2eac4c2`).

**G7 — Soft Validation + PAYE Refresh Banner** — ✅ DONE PR #352 (`a14e64a`).

**Track G build complete.** All slices G1 (#343) → G2 (#344) → G3 (#346) → G4 (#348) → G6 (#350) → G7 (#352) → G5 (#354) shipped. Manager-read live-smoke (aligned UM/BM credential in `tatillife_south`) pending — no aligned test credential found in `.env.local`; banked as LOW FU below.

---

## Phase 9 — SM target: multi-territory branch-based resolution (MEDIUM, banked 2026-05-28)

Phase 9 resolves the agent→SM link via a query-by-role shortcut: `getSalesManagerUid` queries `users` where `role == 'sales_manager'`, valid only while exactly one SM exists. For multi-territory support, add `salesManagerId` to branch docs + an SM-assignment UI in GoalsPanel/UserManagementPanel, and replace the query-by-role shortcut with branch-based resolution (read `branches/{agentBranchId}.salesManagerId`).

**Action:** (1) Add `salesManagerId` to branch schema (`branchService.js` createBranch/updateBranch). (2) Update `getBranch` callers that expose branch-edit UI to include an SM-assignment field. (3) Replace `getSalesManagerUid` with a branch-lookup inside `getGoalHierarchy`. (4) Update rules if needed for the new field.

**Priority:** MEDIUM. Harmless under single-SM/single-territory. Implement before multi-territory pilot.

Banked: Phase 9 build PR #381 (`6829f9d`), 2026-05-28.

---

## Phase 9 — SM write-model inconsistency: SM can write unitGoals but not branchGoals (MEDIUM, banked 2026-05-28)

`firestore.rules` `unitGoals` write arm includes `sales_manager` (unscoped, tenant-wide — BUG-N2 line). `branchGoals` write arm excludes `sales_manager`. Harmless under single-SM (one SM = whole tenant = effectively their territory). When multi-SM territory scoping is built, resolve holistically: either scope SM's `unitGoals` write to their territory's units (mirror the UM `callerUnitId` pattern for their branch set) or remove the SM arm if SM-target-setting is the intended write surface.

**Priority:** MEDIUM. Harmless today; creates a write-surface inconsistency that matters when territory scoping is added.

Banked: Phase 9 build PR #381 (`6829f9d`), 2026-05-28.

---

## ~~`goals/{goalId}` write rule — verify agent personal-commitment write path~~ (RESOLVED — PR #382, `0ae0afb`, 2026-05-28)

Confirmed live bug: `allow write: if canManage(tenantId)` excluded agents. `setGoals()` is pure client-side `setDoc` — no CF bypass exists. Fix: added agent self-write arm (`isAgent() && getTenantId() == tenantId && goalId == request.auth.uid`) mirroring the existing read arm. 10/10 emulator tests; preview smoke 4/4; production smoke 4/4. Rules deployed pre-merge (strictly additive). `agentId` body-field hygiene (same value as doc ID) deliberately deferred — low risk for pilot.

---

## Track F — peer-BM branch-scoped exclusion (LOW, banked 2026-05-27)

**Context:** Phase 2b of the 2026-05-27 run confirmed: MasterSheet Notes button has no role gate. BMs can already open coaching notes for any agent they can see in MasterSheet. The remaining gap = a BM seeing coaching notes for an agent in a **different branch** (peer-BM leak). Currently BMs can read all coaching notes in their tenant because the rule is not branch-scoped.

**Root cause:** No `agentBranchId` denormalized on `coachingNotes` docs. The UM scope is done via `agentUnitId` (denormalized); BM scope would require the same treatment for branchId.

**Fix shape:**
1. Denormalize `agentBranchId` onto every `coachingNotes` doc at write time (extend `addCoachingNote`).
2. Backfill existing coaching notes with `agentBranchId` (one-off Admin SDK script).
3. Update the BM arm of the `coachingNotes` rule to gate on `resource.data.agentBranchId == callerBranchId(tenantId)`.

**Priority:** LOW. No coaching notes exist in production yet; the leak is theoretical. The BM scope gap is only visible if two branches exist in the same tenant and share a coaching-notes surface — Tatil pilot is single-branch. Bank until multi-branch operation becomes real.

Banked: 2026-05-27 autonomous run Phase 2b.

---

## ~~F3.1 UX — "Log Policy" lands on policy-ledger tab without auto-opening create form~~ (RESOLVED — PR #367, `3d9d51b`, 2026-05-28)

`PolicyLedgerPanel` now initialises `view='create'` and `form=prefill` directly when `initialForm` is non-null; mount effect calls `onPrefillConsumed?.()` to clear parent state. Flow collapses to one click. 2 test updates; 1553/1553 vitest. Auto-merged per dispatcher rubric.

---

## F2.1 agent-readable joint-call summary — RESOLVED by design (Phase B, 2026-05-27)

**Finding (Phase B deep verify, 2026-05-27):** Agent visibility into joint-call observations was NEVER in scope for F2.1. By-design exclusion confirmed at three levels:

1. **Workshop roadmap §3.2(a) header** explicitly states: "manager-chain visibility, agent excluded — same rule as coachingNotes."
2. **Firestore rules** have no `canAccessOwn` arm for `jointCalls` — agents structurally cannot list or get their own observations. Rules confirmed by reading `firestore.rules` path `/tenants/{tenantId}/users/{agentId}/jointCalls/{callId}`.
3. **"Agent-mirror dashboard"** phrase in roadmap §3.2 refers to the manager-facing `/manager/agent/:agentId` per-agent drill-down route (Track F F3+), not an agent self-view. FOLLOW_UPS.md §Track F F3+ deferred item confirms this interpretation: "The PRD's intended entry point is a `/manager/agent/:agentId` route with an agent-mirror dashboard."

F2.1 shipped correctly as BM in-app notification (PR #250 `4fb54a7`). Track F arc is complete per original scope. No build needed.

**Closed:** Phase B audit, 2026-05-27. No action required.

---

## H3 Phase 2 real-data parity sweep — re-run when agent has ≥10 settled policies (LOW, banked 2026-05-27)

Phase A3 real-data sweep skipped: test agent `J0j4uBqzTPcfm1IlGCPyDzo27RP2` has < 10 settled policies in production (1 confirmed in previous session). No other agent found with ≥10 settled policies at time of sweep.

**Action:** Re-run Phase A3 sweep against production after (a) a richer test-agent dataset is seeded via the PR-F bulk-seed tooling, or (b) the pilot launches and real production activity accumulates. Sweep command: inline REST script in session — queries `tenants/tatillife_south/policies` grouped by agentId for status=settled count; if any agent ≥10, runs `settlementShapeFromPolicies` derivation vs `settlements` collection read-only diff.

**Priority:** LOW. H3 emulator parity is the primary gate; real-data sweep is validation-of-validation.

Banked: Phase A3 skip, 2026-05-27.

---

## F2.2 archive scope — confirm whether archived observations hide from agent's own view too (RESOLVED — confirmed by design, 2026-05-27)

**Finding (Phase 3c audit, 2026-05-27):** Agents have no joint-calls view. `JointCallsTab` lives exclusively inside `CoachingNotesModal` (manager-only UI). The `calls.filter((c) => !c.archived)` at `JointCallsTab.jsx:400,408` covers the only view where observations are surfaced. No agent-facing visibility gap exists — agents cannot see F2 joint-call observations at all. Archive scope is manager-working-list-only by design and confirmed matching intent.

Banked: F2.2 PR #362 (`517e16d`), 2026-05-27. Resolved: Phase 3c audit, 2026-05-27.

---

## F2.2 unarchive — archive is one-way in UI; add field-flip path when needed (LOW, banked 2026-05-27)

`archiveJointCall()` in `jointCallsService.js` sets `archived: true` with no inverse method. The Firestore rules `hasOnly` allowlist includes `archived` (accepts `false`), so the Firestore path is already open at the rules layer. No in-app recovery exists if a manager accidentally archives an observation.

**Action:** Add `unarchiveJointCall(tenantId, authorUid, callId)` to `jointCallsService.js` (`archived: false` patch). Wire to a UI action — either a toggle within the archive confirmation dialog, or an "Archived" secondary list with an Unarchive button. Match the same author-only rule gate as archive.

**Priority:** LOW. No observations archived in production yet. Implement at first reported accidental archive.

Banked: F2.2 PR #362 (`517e16d`), 2026-05-27.

---

## Branch protection: require CI status checks before merge (MEDIUM, banked 2026-05-28)

`ci.yml` is `pull_request`-only (no `push` trigger). GitHub branch protection on `main` has no required status checks configured, so `gh pr merge --auto --squash` merges immediately without waiting for CI. PRs #371 and #372 merged before lint-and-build + functions-tests ran against the PR branches.

**Fix:** In GitHub → Settings → Branches → Branch protection rules → `main`, add:
- `CI / lint-and-build` as a required status check
- `CI / functions-tests` as a required status check
- Enable "Require status checks to pass before merging"

This makes `--auto` merge truly gate on CI green, aligning the rubric ("Test/script + ≥2 CI green → auto-merge") with what GitHub enforces.

**Priority:** MEDIUM. Current session rubric is safe because both suites were verified locally before push. The gap is that GitHub doesn't enforce the rubric independently.

Banked: 2026-05-28 (autonomous H4 run observation).

---

## Smoke script cleanup discipline — stray policies/notifications accumulate on test agent (MEDIUM, banked 2026-05-28)

**Context:** 8 stray policy docs accumulated on test agent `J0j4uBqzTPcfm1IlGCPyDzo27RP2` across the H3 arc. Origins: H2c lapse smoke (`SMOKE-H2C-*`, 2 docs with history subcollections), H3 parity smoke (`H3Smoke-Today-*`), prod smoke Leg 1b (`H3ProdSmoke-*`), and 4 earlier smoke runs (`Smoke-B/C/CY-*`, `F365-carry-*`). None cleaned up after themselves. A `policy_lapsed` notification (`sfJD3y3kiPzNOcYnJPBo`, type `policy_lapsed`, unread) was also left in `tatillife_south/notifications` from the H2c lapse smoke — dispatcher confirmed to leave in place for now.

**Two problems this causes:**
1. **Assertion pollution.** Smokes that query "all policies for the agent" (e.g. `AgentAwardsPanel` derivation, `settlementShapeFromPolicies`) pick up prior-run docs and return inflated numbers. The H3 browser capstone saw TTD 27,000 instead of the seeded 22,000 because the prod smoke's Leg 1b policy was still present.
2. **Accumulation.** Without cleanup, each arc adds to the collection. At scale this degrades query performance and makes manual inspection harder.

**Fix — two-part:**
1. **Per-run cleanup (primary):** Any smoke script that creates policy (or notification, or settlement) docs must delete them in a `finally{}` block keyed on a per-run sentinel tag (e.g. `ownerName.startsWith(SENTINEL)`). Pattern established in `h3-flip-capstone.mjs` — extend it to all policy-creating smokes. Smokes that transition policy status must also delete history subcollection docs for each policy.
2. **Scoped assertions:** Smoke assertions on "agent's policies" must filter to the per-run sentinel, not rely on the collection being clean. E.g. `query.where('ownerName', '>=', SENTINEL).where('ownerName', '<=', SENTINEL + '')` or read-by-ID after seeding.

**Scripts to audit and retrofit:** `h3-prod-smoke.mjs` (Leg 1b creates a policy, no cleanup), any future smoke that calls `createPolicy` or `lapsePolicy`. Grep: `git grep -l "createPolicy\|lapsePolicy\|addPolicy" scripts/verification/`.

**Additional findings from 2026-05-28 notification sweep:**

3. **Stray smoke campaigns likely remain in `tenants/tatillife_south/campaigns`.** The 3 deleted `campaign_launched` notifications (titles: `__SMOKE TEST CAMPAIGN 1778603*`) referenced campaigns created during the 2026-05-12 campaign-module smoke arc. Those campaigns almost certainly still exist in the `campaigns` collection. Sweep `tatillife_south/campaigns` for docs whose `name` starts with `__SMOKE TEST` or `SMOKE` as part of the next test-tenant cruft cleanup.

4. **Inconsistent sentinel prefixes across smoke scripts.** The cleanup sweep caught `SMOKE-*`, `SMOKE-SWEEP-B-*`, `SMOKE-H2A/H2C-*`, `H3Smoke-*`, `H3ProdSmoke-*`, `Smoke-B/C/CY-*`, and `__SMOKE TEST CAMPAIGN` — seven distinct naming conventions. A single automated sweep can't reliably match all of them. Fix: standardize on one prefix (e.g. `SMOKE-`) across all smoke scripts, and/or tag every smoke-created doc with a common metadata field (e.g. `smokeRunId: SENTINEL`) so sweeps are exhaustive regardless of `ownerName`/`name` field values.

**Priority:** MEDIUM. Not blocking — accumulation is slow and manual cleanup is possible (as done 2026-05-28). But the assertion-pollution vector is real: the browser capstone almost failed a valid assertion because of a $5,000 stray policy.

Banked: 2026-05-28 (H3 close-out cleanup, 8 docs + 16 notifications deleted; findings 3–4 added from notification sweep).

---

## H4 — contributedPolicyIds array growth on long-lived pending entries (LOW, banked 2026-05-28)

`aggregatePendingPlan` (CF) stores `contributedPolicyIds[]` per `pendingReview` entry for idempotent deduplication — each source `policyId` that fires the CF is appended to the array, and duplicate fires for the same `policyId` are no-ops. If a single pending entry stays unprocessed for a long time and accumulates many contributing policies (rare — the intended flow is: admin reviews weekly, promotes or dismisses), the array grows unboundedly.

At expected volumes (tens to low hundreds of agents, each submitting a few policies per month), this is well under the 1 MB Firestore document limit. No action needed now.

**If observed in practice:** cap `contributedPolicyIds` at N (e.g. 500) by slicing before append, or migrate the sub-array to a subcollection. Either change is non-breaking — the idempotency check (`ids.includes(policyId)`) still works on a capped array, just stops deduplicating policyIds beyond the cap, which is fine at that volume.

**Priority:** LOW. Admin should review `pendingReview` periodically as part of normal plan-catalog hygiene. Banked 2026-05-28 (H4 PR #370 review prep).

---

## CF emulator integration tests for FieldValue writes (LOW, banked 2026-05-28)

CF unit tests mock `admin.firestore.FieldValue` so they pass write payloads that Firestore rejects at runtime. Caught in H4 post-deploy: `aggregatePendingPlan` used `FieldValue.serverTimestamp()` inside an array element; Jest mock returned a plain string (valid value), but real Firestore threw at `tx.update()` time. The bug was invisible until the post-deploy smoke ran.

**Action:** Consider lightweight emulator-based CF integration tests using `firebase emulators:start --only firestore,functions` for any CF that uses `FieldValue` methods or writes complex nested structures. These tests bypass the mock layer and exercise the real Firestore SDK validation. Acceptable safety net at current CF count (small); worth formalizing if CFs proliferate.

**In the interim:** For any CF that writes `FieldValue` sentinels inside array or map fields, add a smoke assertion that exercises a real write-read round-trip (as the H4 smoke does for legs c/d). The regression test pattern (assert `firstLoggedAt.toMillis` is a function) is a useful unit-test guard but not a substitute for real-write verification.

**Priority:** LOW. Current post-deploy smoke provides coverage. Emulator integration tests would shift the detection surface left (pre-deploy).

Banked: 2026-05-28, H4 CF hotfix PR #373 (`df161fe`).

---

## H3 existing-policy date migration (LOW, banked 2026-05-28)

Policies stored **before PR #375** have `dateIssued`, `dateWritten`, `dateSubmitted`, and `dateLapsed` at UTC midnight (the old `new Date('YYYY-MM-DD')` behavior). After PR #375 merges, new policies store at UTC 04:00 (TT-local midnight). The 4-hour drift has two effects on pre-fix docs:

1. **Cosmetic off-by-one on display:** `fmtDate()` renders the date as the prior calendar day in a TT browser (e.g., "Jan 1" stored shows as "Dec 31").
2. **Period-key attribution split for 1st-of-month docs:** `toISOString().substring(0,7)` and `getMonth()` disagree on period for dates stored at UTC midnight on the 1st of a month.

**Scope:** Pilot is postponed, no real production data exists yet. This is a pure dev-time artifact.

**Action when real data exists:** Write a one-shot migration script (Node + Admin SDK) to find all policy docs with date fields at `T00:00:00.000Z` and shift them to `T04:00:00.000Z`. Safe to run idempotently; a `T04:00:00.000Z` value is left unchanged. Scope to the tenant's policy collection only.

**Priority:** LOW — no real data exists at pilot start; revisit before first production tenant is onboarded.

Banked: 2026-05-28, H3 TZ fix PR #375.

---

## H3 — `validate()` raw `new Date()` date guards (LOW, banked 2026-05-28)

`policiesService.js:validate()` calls `new Date(dateWritten)` / `new Date(dateSubmitted)` / `new Date(dateIssued)` for the "not in future" guard check (e.g. `if (fields.dateIssued && new Date(fields.dateIssued) > new Date())`). These guards use the raw parser, not `parseDateOnlyTT`. The consequence: a policy saved with `dateIssued = '2026-06-01'` (June 1st, TT) would have its raw-parsed Date = UTC midnight = TT 20:00 May 31. The guard `> new Date()` passes correctly (the date is in the past by the time the policy is settled), but if a future-date validation check were to run at a TT midnight boundary, it could misclassify the date as "yesterday in TT" instead of "today".

**Action:** Replace the raw `new Date(dateStr)` calls inside `validate()` with `parseDateOnlyTT(dateStr)` for date-only string comparisons. Low mechanical risk — one import, three replacements.

**Priority:** LOW. No observable validation bug today (guards are only used for rough "not in future" checks, not for period-key derivation). Fix in the same PR as the next policiesService maintenance work.

Banked: 2026-05-28, H3 TZ fix close-out audit.

---

## H3 — `getTodayTT()` en-CA locale dependency note (LOW, banked 2026-05-28)

`getTodayTT()` in `src/utils/dateInputs.js` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date())`. The `en-CA` locale is used specifically because it reliably produces `YYYY-MM-DD` format — ISO date string — across all major browsers. If `en-CA` support were absent (exotic or old user-agent), the output might not be `YYYY-MM-DD`, and downstream callers that do `.substring(0, 7)` for periodKey derivation would silently produce garbage.

**Action:** Add a one-time runtime guard (or a unit test) that validates `getTodayTT()` returns a 10-char string matching `/^\d{4}-\d{2}-\d{2}$/`. This is a belt-and-suspenders check — `en-CA` is part of the ECMAScript Internationalization API (mandatory since ES2015) and should be universally supported. But the guard makes the contract explicit and catches any future polyfill or SSR environment gap.

**Priority:** LOW. Universal browser support for `en-CA` locale is well-established. The unit tests already validate the output format for specific dates via fake-timer clock. An explicit format-guard test is additive hardening only.

Banked: 2026-05-28, H3 TZ fix close-out audit.

---

## Weak-waitFor audit — FULLY RESOLVED (LOW, banked 2026-05-27)

PR #363 hardened `ProspectInfoPanel.test.jsx` and `PolicyReconciliationPanel.test.jsx`. Phase D2 sweep (2026-05-27) completed the project-wide enumeration. PR #371 (`7c91670`, 2026-05-28) resolved all HIGH instances (46 total).

**HIGH severity — RESOLVED in PR #371 (`7c91670`):**
- `BranchesPanel.test.jsx` (5), `ProspectInfoPanel.test.jsx` (14), `PolicyLedgerPanel.test.jsx` (17), `JointCallsTab.test.jsx` (6), `CoachingNotesModal.test.jsx` (4)

**MEDIUM severity — RESOLVED in PR #372 (`70e58e6`):** `act()` wrappers removed from `DailyEntryModal.test.jsx` (3 instances) and `GoalsPanel.test.jsx` (1 instance); `{ timeout: 3000 }` removed from `DailyEntryModal.test.jsx` (3 instances).

**Not found:** empty `waitFor(() => {})`, `waitFor({ timeout: 0 })`, `await new Promise(r => setTimeout(r, ...))` — these anti-patterns are absent.

**Status: FULLY RESOLVED.** HIGH closed PR #371 (`7c91670`). MEDIUM closed PR #372 (`70e58e6`). Suite is green.

Banked: Phase 3 PR #363 (`be69658`), Phase D2 sweep 2026-05-27. Fully closed: 2026-05-28.

---

## Wizard `SOCIAL_PLATFORMS` TikTok expansion — consider adding for symmetric posts-vs-leads cross-tab (LOW, banked 2026-05-27)

`StepSocialMedia.jsx` / `socialMediaConstants.js` `SOCIAL_PLATFORMS` = `['facebook', 'instagram', 'whatsapp', 'linkedin']` (4 values). The `socialPlatform` attribution field on prospect-info and policies (PR #319) uses a 6-value enum that includes `tiktok` and `other` as attribution-only options. This divergence means agents can attribute a lead to TikTok but their weekly wizard breakdown has no TikTok post-count row. When a future "leads by platform" surfacing slice crosses wizard breakdown data with `socialPlatform` attribution, TikTok and Other will have attribution counts but no posts/engagement context.

**Fix shape:**
1. Add `'tiktok'` to `SOCIAL_PLATFORMS` in `socialMediaConstants.js`.
2. Add `tiktok: 'TikTok'` to `PLATFORM_LABELS` in `StepSocialMedia.jsx`.
3. No wizard step changes needed — the collapsible breakdown loop already renders all `SOCIAL_PLATFORMS` entries.
4. No rules/service changes needed — `socialPlatformBreakdown` is stored as an object with optional keys.

**Priority:** LOW. Attribution capture works correctly without this. TikTok row in the wizard is a UX improvement for agents who actively post on TikTok; non-urgent until the surfacing slice (separate future PR) lands and cross-tab analysis is requested.

Banked: PR #319 dispatch Phase 1 alignment, 2026-05-27.

---

## moneyNeeds `shareWithSm` owner-update arm is UI-gated only — no rule enforcement (LOW, banked 2026-05-27)

**Scope:** `updateVisibility` in `moneyNeedsService.js` accepts a `shareWithSm` boolean and patches it onto the worksheet doc. The Firestore update rule for the owner arm (`request.auth.uid == agentId`) does not restrict which fields may be set — an owner could set `shareWithSm: true` via a raw `updateDoc` call without going through the UI toggle. The UI gate is the only enforcement today.

**Action:** When manager-owned worksheets ship (Track G extension or beyond), harden the update arm to enforce that only a BM can set `shareWithSm` — e.g., add `(!affectedKeys().hasAny(['shareWithSm']) || isRole('branch_manager'))` to the owner update predicate. Until manager-owned worksheets exist, the UI gate is sufficient: no BM-authored worksheet path exists, so the only actor who could self-set `shareWithSm` is the owning agent, and sharing their own data upstream has negligible privacy impact.

**Priority:** LOW. Owner-only update arm means no cross-user exploit. Harden when manager-owned worksheets ship.

Banked: G5 PR #354 (`f200bc6`), 2026-05-27.

---

## G5 — manager-read live-smoke — ✅ CLOSED (2026-05-27)

**Result:** B2 smoke passed 5/5. UM (uid=XQhG6awVgaYkCFX7gnd1OYTr9zt2, aligned: UM uid == agent's `unitId`) and BM (branchId=`tatil_south`, matching agent's `branchId`) both successfully read the shared worksheet via Firestore REST. Alignment check was correct; `A11Y_UNIT_MANAGER_*` and `A11Y_BRANCH_MANAGER_*` credentials were present in `.env.local` and aligned. Script: `scripts/verification/g5-privacy-smoke.mjs`. Run: 2026-05-27, prior session (Track G close-out).

---

## I1.2 methodology — Firestore collectionGroup rules require top-level recursive wildcard; emulator false-fails (CLOSED — learning banked in CLAUDE.md § Banked patterns, PR #256)

**What happened:** The `allow list` rule for `jointCalls` was written inside `match /tenants/{tenantId}/users/{agentId}/jointCalls/{callId}`. Production Firestore returned `PERMISSION_DENIED` for the `getOwnJfwCount` collectionGroup query despite the rule logic being correct. Two root causes identified:

1. **Combined OR with path-variable arm blocks collectionGroup static analysis.** A `allow list: if arm1 || arm2` rule where arm2 references a `{tenantId}` path wildcard causes Firestore to reject the ENTIRE OR expression for collectionGroup queries — it cannot short-circuit OR when any arm is statically unverifiable. Even splitting into two `allow list` declarations within the path-specific match did not resolve this.

2. **Path-specific match rules are NOT reliably evaluated for collectionGroup queries.** The `match /tenants/{tenantId}/...` rule block is not picked up by Firestore's collectionGroup security evaluator in the same way as a top-level recursive wildcard. The fix: add `match /{path=**}/jointCalls/{callId} { allow list: if ...; }` at the top level.

3. **Emulator false-fails.** The emulator also failed case 13 throughout the debugging cycle (16/17) for both combined-OR and split-rule forms. Only the recursive wildcard fixed both emulator and production.

**Fix shipped:** Added top-level `match /{path=**}/jointCalls/{callId} { allow list: if isManager() && resource.data.authorUid == request.auth.uid; }` in PR [#256](https://github.com/Kelsean868/agencytrack/pull/256).

**Learning banked:** See CLAUDE.md § Banked patterns — "Firestore collectionGroup rules require top-level recursive wildcard."

**Status: CLOSED** — learning banked, no further action needed.

---

## Track I I2 — Monthly Recruiting Roll-up (SHIPPED — PR #280)

**Shipped gates:** 21/21 emulator rule tests; 1066/1066 app tests env-unset; lint 0; build clean. Rules + index deployed pre-merge. **SHIPPED PR #280 (`5605312`).**

---

## Track I I2 — Monthly recruiting standards + accountability flag (LOW, banked 2026-05-23)

**Scope:** I2 ships raw capture only — `candidatesAssessed` + `agentsContracted` with no targets or flags. Once data flows and definitions are confirmed (see FU below), add monthly recruiting numeric standards to `config/managerActivityStandards` (extend `NUMERIC_STANDARDS` keys: `candidatesAssessedTarget`, `agentsContractedTarget`). Wire accountability flag logic (`computeMissedActivities`) to the monthly rollup. Surface as an informational warning panel on `MonthlyRecruitingTab` analogous to `AccountabilityFlagPanel`.

**Action:** After definitional confirmation FU closes (head-of-sales confirms semantics), extend `ActivityStandardsModal`/`ActivityStandardsPanel` with a "Monthly Recruiting" section; extend override layer; extend flag display.

**Priority:** LOW. No targets set yet; flag meaningless until definitions confirmed and baseline data collected.

Banked: I2 PR #280.

---

## Track I I2 — `recruitsInFirstWeeks` auto-derive from `contractStartDate` (LOW, banked 2026-05-23)

**Scope:** Track I design spec §5 lists `recruitsInFirstWeeks` as a potential field — how many of the `agentsContracted` completed a milestone (e.g. first sale, first WAR submission) within N weeks of contracting. This requires `contractStartDate` on the agent user doc + a query or Cloud Function aggregation. Not built in I2 (capture only).

**Action:** When `contractStartDate` is available and the field definition is confirmed, auto-derive `recruitsInFirstWeeks` by querying the contracted agents' user docs + submission records. Consider a nightly CF aggregation.

**Priority:** LOW. Deferred until baseline `agentsContracted` data flows for a few months and the definition is validated with head-of-sales.

Banked: I2 PR #280.

---

## Track I I2 — Head-of-sales definitional confirmation for `candidatesAssessed` + `agentsContracted` (LOW, banked 2026-05-23)

**Scope:** Both fields are labelled "Provisional — pending head-of-sales confirmation" in `MonthlyRecruitingTab.jsx`. Definitions used:
- `candidatesAssessed`: recruiting candidates who completed a formal assessment this month
- `agentsContracted`: new agents who signed a contract this month; logged under the month the contract is issued

**Action:** When Kyron has a head-of-sales conversation confirming or amending these definitions:
1. Update the `help` prop text on both `NumberField` instances in `MonthlyRecruitingTab.jsx` (remove "Provisional" / "pending head-of-sales confirmation" qualifiers).
2. Update any FU comments in service / test files that reference "provisional".
3. Close this FU.

**Priority:** LOW. Provisional labels are safe to leave in until confirmed; they don't block data collection.

Banked: I2 PR #280.

---

## Track I I2 — Possible compliance edit-freeze for submitted monthly rollups (LOW, banked 2026-05-23)

**Scope:** The I2 rule allows the owner to overwrite a submitted rollup (no status-transition lock). The brief locked "no time gate" as the I2 decision (mirrors WAR + persistency behaviour). A compliance freeze (status `submitted` → read-only at the rule layer) is a possible future hardening.

**Action:** If Kyron decides a compliance freeze is needed:
1. Add `resource.data.status != 'submitted'` guard to the `allow update` arm in the `managerMonthlyRollups` rule block.
2. Confirm UI already prevents edit when `isSubmitted` (it does — buttons are hidden and fields are disabled).
3. Deploy as a standalone additive rule edit; no service/UI changes needed.

**Priority:** LOW. No compliance requirement surfaced yet.

Banked: I2 PR #280.

---

## ~~Track D D1b — Firestore `awardsRuleset` doc + loader service + consumer threading~~ (SHIPPED [#285](https://github.com/Kelsean868/agencytrack/pull/285), `2f0364a`)

**RESOLVED.** `getAwardsRuleset(tenantId, year)` in `src/services/awardsRulesetService.js` reads `tenants/{tid}/config/awardsRuleset_${year}`, returns stored doc AS-IS if present, else `DEFAULT_RULESET_2026`. All three consumers threaded (AgentAwardsPanel prop, ManagerAwardsPanel self-load, AgentReportDocument via exportService). No rule/index change. Existing `match /config/{docId}` wildcard covers the path. Schema: flat doc ID `awardsRuleset_${year}` under existing `config` collection (not subcollection — FU-body path was malformed; flat doc is the correct shape). 81 files / 1109 tests; lint 0; build clean.

**Queued (Tenant-Admin ruleset editor, separate D PR):** see Track D — Tenant-Admin ruleset editor UI section below.
**Queued (parity expansion + BM at-risk view):** see Track D parity section below.

---

## ~~Track D — Tenant-Admin ruleset editor UI~~ (SHIPPED — scalar groups, PR [#287](https://github.com/Kelsean868/agencytrack/pull/287), `77814ed`)

**RESOLVED (scalar groups / P-a).** `AwardsRulesetPanel.jsx` mounted on the TenantAdminDashboard config tab. SCALAR_GROUPS config schema drives 12 accordion sections (all scalar-only award groups). `setAwardsRuleset` write function with completeness guard + recursive numeric validation + monolithic `setDoc`. 4 array groups (clubAward, managerMonthlyBonus, recruitingAwards, activityAwards) rendered read-only with "coming in follow-up" note. 82 files / 1122 tests; lint 0; build clean. No rule/index change.

**P-b (array/tier editors) queued:** see Track D P-b section below.

Banked: D1 PR [#283](https://github.com/Kelsean868/agencytrack/pull/283) (`759a1b9`). Resolved: PR [#287](https://github.com/Kelsean868/agencytrack/pull/287) (`77814ed`).

---

## Track D D2a P-b — Array/tier editors (LOW, banked 2026-05-23)

**Context:** D2a shipped scalar-only editing. Four array groups are rendered read-only in `AwardsRulesetPanel.jsx` with a "coming in follow-up" note: `clubAward.tiers` (5 tiers with `label`/`apiThreshold`/`inContention`/`prize`), `managerMonthlyBonus.tiers` (3 tiers), `recruitingAwards` (top-level array of 3 items), `activityAwards` (top-level array of 4 items).

**Scope (P-b, separate D PR after D2a):**

- Replace read-only summaries for the 4 ARRAY_GROUPS with inline editable table rows.
- Each tier/item row: per-field inputs matching the existing tier shape (label text, apiThreshold currency, prize text, inContention currency where applicable).
- Add/remove tier rows for `clubAward.tiers` and `managerMonthlyBonus.tiers` (user-controlled tier count, minimum 1).
- Save: same `setAwardsRuleset` path — arrays survive via the existing `buildPayload` deep-clone + overlay design (scalar pass remains unchanged; P-b adds an array overlay pass).
- Validation: tier apiThresholds must be increasing (ascending sort guard); no empty prize strings; non-negative numerics (already enforced by `validateNumericFields` since arrays are iterated by the recursive validator once tier objects are present — verify this in Phase 1).

**Priority:** LOW. No business ask yet — Tatil values match defaults. Implement when a tenant needs custom tier definitions.

Banked: D2a PR [#287](https://github.com/Kelsean868/agencytrack/pull/287) (`77814ed`).

**RESOLVED 2026-05-23 in PR [#289](https://github.com/Kelsean868/agencytrack/pull/289) (`fa5d050`) — D2b array/tier editors shipped. All 4 array groups editable; `arrayState` + `ARRAY_GROUP_SCHEMAS` + `buildPayload` array-injection; `validateNumericFields` extended with element recursion + empty-array rejection. Awards editor complete for all 16 groups.**

---

## ~~Track D — Awards parity expansion + BM at-risk view~~ (RESOLVED — D3 closed [#297](https://github.com/Kelsean868/agencytrack/pull/297), `0bb1337`)

**Context:** `docs/phase7-8-implementation.md` Track D section lists D3 (agent panel parity), D4 (manager panel parity), D5 (BM at-risk view). Section numbering §3.2/§3.3 in the brief refers to this Track D block — the doc's §3 is "Track Dependencies"; parity/at-risk content is in §2 "Build Tracks".

**RESOLVED: D4 — Manager awards `newAdvisors` hardcode** ([#291](https://github.com/Kelsean868/agencytrack/pull/291), `94ba440`). `ManagerAwardsPanel.jsx:95` was passing `{ newAdvisors: 0 }` to `computeManagerAwards`, making recruiting awards always 0. Fixed: `ManagerDashboard` now computes `newAdvisors` = count of agents in scope whose `contractStartDate` starts with the current calendar year, passes as prop to `ManagerAwardsPanel`, which forwards to `computeManagerAwards`. UM-view verified — no rendering gaps found. 4 new prop-threading tests.

**RESOLVED: D3 — Agent awards parity (`AgentAwardsPanel` enhancements)** ([#297](https://github.com/Kelsean868/agencytrack/pull/297), `0bb1337`). Three new pure engine exports in `awardsEngine.js`: `getPeriodCtx(category, date)` (lifted verbatim from `BmAtRiskPanel.jsx:17` inline helper), `nextTierDistance(annualApi, tiers)` (returns `{ nextTier, distance }` for the tier immediately above agent's current standing, or `null` at Gold), `isPersistencyOnlyBlock(award)` (confirmed data + persistency is sole unmet criterion). Panel augments each award in `useMemo`: `paceStatus` (via `computeAtRiskStatus`), `tierGap` (club only), `persistencyBlock`. `AwardCard` renders: (1) per-criterion "X to go" `GapBadge` (non-club), TTD-distance-to-next-tier badge (club); (2) `PacePill` (Achieved/On Track/At Risk/Far Off); (3) amber persistency-only-block banner (confirmed data only — silent on estimated). 25 new engine tests; 1178/1178; lint 0; build clean. No rule/index/ruleset/CF/Firestore change.

**RESOLVED: D5 — BM at-risk view** ([#293](https://github.com/Kelsean868/agencytrack/pull/293), `efc69e5`). New `computeAtRiskStatus(award, { weeksElapsed, periodWeeks })` pure function in `awardsEngine.js` — 4-state (achieved / on_track / at_risk / far_off). Uses `inContention` flag as the "gettable" boundary (no ruleset change, no atRiskPct). New `BmAtRiskPanel.jsx` with per-agent risk rows, danger pill list, All/At Risk filter; BM+ gated. `ManagerAwardsPanel` self-loads `ytdSubs` in existing `Promise.all`. `ManagerDashboard` threads new `agentProfiles` state. Agent termination filter deferred (see "Agent termination flag" FU below). 11 engine tests + 3 panel gating tests. 1151/1151; lint 0; build clean. No rule/index/ruleset/config/editor change.

**Track D arc complete:** D1 [#283](https://github.com/Kelsean868/agencytrack/pull/283) (`759a1b9`) → D1b [#285](https://github.com/Kelsean868/agencytrack/pull/285) (`2f0364a`) → D2a [#287](https://github.com/Kelsean868/agencytrack/pull/287) (`77814ed`) → D2b [#289](https://github.com/Kelsean868/agencytrack/pull/289) (`fa5d050`) → D4 [#291](https://github.com/Kelsean868/agencytrack/pull/291) (`94ba440`) → D5 [#293](https://github.com/Kelsean868/agencytrack/pull/293) (`efc69e5`) → D3 [#297](https://github.com/Kelsean868/agencytrack/pull/297) (`0bb1337`).

---

## ~~Agent termination flag — soft-delete model cross-cutting~~ RESOLVED, REFRAMED (banked 2026-05-24)

**RESOLVED:** Closed by PR [#296](https://github.com/Kelsean868/agencytrack/pull/296) (`27b1c8a`) — `getTenantUsers` in `managerService.js` now honors the existing `active: false` field (soft-delete already shipped in user-mgmt PR-2). No new field needed. Added `{ includeInactive = false }` option mirroring `agentManagementService.getAllUsers`; 14+ consumers get inactive filtering for free. Leaderboard photo-map fetch independently guards `active: false`. Deferred comment removed from `BmAtRiskPanel.jsx`.

**REFRAMED remaining work:** see "terminatedAt timestamp + D4 net-new refinement" FU below.

---

## ~~`submissions[].persistencyRate` — dead read in `awardsEngine.js`~~ (PARTIALLY RESOLVED — PR #341, 2026-05-25)

**Root cause:** `awardsEngine.js:141` read `s.persistencyRate` from submission docs when computing `annualPersist`. No wizard step or submission service ever writes this field — `subPersistVals` was always empty, so it had zero effect on computed persistency.

**Closure:** `awardsEngine.js` dead `subPersistVals` derivation removed in PR #341 (hygiene). `SubmissionViewer.jsx:158` Persistency Rate display row KEPT — it correctly renders the value if ever populated (e.g., future wizard step or manual migration), and currently shows "—" harmlessly. Track H (Policy Ledger) is the natural place to decide whether to wire the wizard field.

---

## ~~`getPeriodCtx` duplicated between `awardsEngine.js` and `BmAtRiskPanel.jsx`~~ (RESOLVED — PR [#327](https://github.com/Kelsean868/agencytrack/pull/327), `7529d3a`, 2026-05-25)

**Root cause:** D3 lifted `getPeriodCtx` to a named export in `awardsEngine.js`. The original inline copy at `BmAtRiskPanel.jsx:17–31` (14 lines) was intentionally left in place per the D3 brief scope boundary ("MUST NOT touch `BmAtRiskPanel.jsx`").

**Closure (PR #327, `7529d3a`):** `BmAtRiskPanel.jsx` updated to import `getPeriodCtx` from `'../../utils/awardsEngine'`; inline copy at lines 17–31 deleted. Zero behavior change.

---

## terminatedAt timestamp + D4 net-new refinement (LOW, banked 2026-05-24)

**Context:** PR [#296](https://github.com/Kelsean868/agencytrack/pull/296) closed the core roster-filtering gap by honoring `active: false` in `getTenantUsers`. Two net-new items remain if the pilot requires them:

1. **`terminatedAt: Timestamp | null`** — an explicit termination timestamp on user docs, set by `deactivateUser` CF when an optional `isTermination: true` flag is passed. Enables "terminated this year" counting, audit trails, and date-range reporting without scanning submission history.
2. **D4 net-new: contracted-this-year minus terminated-this-year** — the `MasterSheet`/manager overview "contracted this year" KPI could show a net figure. Requires `terminatedAt` to count terminations within the same period.

**Design questions (dispatcher must lock before build):**

1. Extend `deactivateUser` CF: accept optional `isTermination: boolean`; if true, also write `terminatedAt: admin.firestore.FieldValue.serverTimestamp()` alongside `active: false`.
2. `EditUserDrawer`: expose an "Mark as Terminated" action (distinct from simple deactivation) for `branch_manager` / `tenant_admin`.
3. Firestore rules: `terminatedAt` follows the same CF-only write path as `active` (client `updateDoc` blocked).

**Priority:** LOW. `active: false` filtering covers the immediate UX noise problem. `terminatedAt` and D4 net-new are pilot-data-dependent and non-urgent. Pilot is postponed.

Banked: roster-honors-active PR [#296](https://github.com/Kelsean868/agencytrack/pull/296) (`27b1c8a`).

---

## Leaderboard ranking not filtered by `active` flag (MEDIUM, banked 2026-05-24)

**Context:** Surfaced in the #296 Phase-5 smoke. After setting `active: false` on a test agent, the agent still appeared in the Leaderboard ranking. PR #296 guarded only the photo-map fetch in `Leaderboard.jsx` (line ~102, `if (data.active === false) return`). The ranking rows come from the `leaderboard` subcollection (`tenants/{tenantId}/leaderboard`) queried at `Leaderboard.jsx:74` — an independent `onSnapshot` that has no `active`-flag filter. The subcollection is populated by a cron/CF.

Phase-1 undercounting: the #296 Phase-1 enumeration audited the photo-map fetch but missed the ranking subcollection as a second leaderboard surface. Both are in `Leaderboard.jsx` but serve different data paths.

**Fix (CF/cron, not client filter):** The subcollection write path is the correct place to enforce this — either (a) the cron that populates `leaderboard/` should skip users where `active === false`, or (b) the subcollection write should delete existing entries when a user is deactivated. A client-side filter on the read is an option but less durable (cached data can outlast the client session). Group with the `terminatedAt` / deeper-termination family.

**Priority:** MEDIUM. Deactivated agents appearing in rankings is visible UX noise, not a security issue. No agents have been deactivated in production yet. Not blocking pilot.

Banked: #296 smoke (`27b1c8a`, 2026-05-24).

---

## ~~Silent query-error swallow in `AgentDashboard` masked submissions rules regression~~ (RESOLVED — PR #330, `e3f66ae`, 2026-05-25)

**Context:** Surfaced during the D3 smoke investigation (hotfix PR [#298](https://github.com/Kelsean868/agencytrack/pull/298)). `AgentDashboard` calls `getAgentSubmissions(tenantId, uid)` inside a `useEffect` and swallows any error with `.catch(() => [])`. When the submissions `allow list` rule regression denied the query, the component received an empty array silently — as if the agent had no submissions — instead of surfacing the `permission-denied`. The awards panel, history, and ratio trends rendered their empty states without any error indication, masking a production-breaking rules bug for ~10 days.

**Closure (PR #330, `e3f66ae`):** `submissionsError` state added; `getAgentSubmissions` now sets it on failure instead of swallowing; `role=alert` banner surfaced in AgentDashboard with `permission-denied`-specific copy. Smoke 4/4 pass.

---

## ~~Methodology — self-service list queries must be smoke-tested as the owning user~~ (SHIPPED — banked in CLAUDE.md § Banked patterns, PR #331)

**Context:** The submissions `allow list` regression (SHAKEDOWN-002B #144 → hotfix [#298](https://github.com/Kelsean868/agencytrack/pull/298)) is the second `list`-rule regression to slip past `get`-only coverage. Pattern: a `read` → `get`/`list` split drops the agent `canAccessOwn` arm from `list`; smoke verified by admin SDK (bypasses rules) or by manager login (has `canManage`); nobody signs in as the owning agent and queries the collection directly.

**Rule to bank in CLAUDE.md:** For any Firestore collection where an agent (or any `canAccessOwn` user) should be able to list their own docs, the smoke MUST include a write-then-list cycle signed in as that user: `signInAs(agentUid) → getDocs(query where ownerId == uid) → assert non-empty`. Admin SDK reads (bypass) and manager reads (canManage) do not prove agent list access.

**Action:** Incorporate into the CLAUDE.md § Banked patterns smoke-standard bullet when the next methodology batch lands.

**Priority:** LOW. Methodology documentation only; no code change required.

Banked: hotfix PR [#298](https://github.com/Kelsean868/agencytrack/pull/298), 2026-05-24.

---

## ~~`deactivateUser` CF returns `FirebaseError: internal` — investigate before pilot~~ (RESOLVED — empirical confirm 2026-05-24)

**Context:** Surfaced in the #296 Phase-5 smoke. Clicking Deactivate in UserManagementPanel → filling confirm modal → submitting produced `[UserManagementPanel] deactivate: FirebaseError: internal` in the browser console.

**RESOLVED — not a CF bug.** Empirically confirmed: a real deactivation (`active:false`, hitting `revokeRefreshTokens`) called as the BM test account succeeded at HTTP 200 with a clean CF log pair (`23:03:06Z` started → `[deactivateUser] Deactivated + revoked tokens` → `23:03:07Z` HTTP 200, 1094 ms). The #296 `internal` was transient/transport: no CF log entry for the failure = the call never reached the function (cold-start timeout or network blip). The CF code and CREATION_MATRIX are correct for the BM→agent path.

Banked: #296 smoke (`27b1c8a`, 2026-05-24). Resolved: empirical confirm 2026-05-24.

---

## H3 FLIP-GATE — `usesPolicyLedger:true` requires end-to-end parity validation before any agent is flipped (HIGH, banked 2026-05-25)

**Context:** H3 (PR [#323](https://github.com/Kelsean868/agencytrack/pull/323), `af07a34`) ships a dormant feature flag (`usesPolicyLedger: boolean` on agent user docs, default absent/false). `AgentAwardsPanel` branches on this flag: `false` → existing settlements path; `true` → new `settlementShapeFromPolicies()` ledger path. The flag is per-agent and must be set explicitly via user-doc update; merging H3 flips nothing for any real agent.

**Gate: DO NOT set `usesPolicyLedger:true` for any agent until ALL three of the following are confirmed on representative-volume data:**

1. **Ledger completeness vs settlements collection.** Verify that `policies` docs (filtered `status: 'settled'`, `agentId == uid`) return the same set of settled items as `settlements` docs for the same agent and period. Any missing policy doc (e.g., pre-H3 settlements entered via the old path) silently drops from awards computation.

2. **Period attribution alignment: `dateIssued`/Date-Placed bucketing vs settlement-period bucketing.** The ledger path uses `dateIssued` on the policy doc to bucket into YTD/period windows. The settlements path uses the `periodKey` field set at confirmation time. For agents with multi-quarter tenure, verify these two bucketing schemes produce the same period membership for every settled policy — a mismatch assigns policies to wrong periods and inflates/deflates annual API.

3. **Persistency `periodKey` alignment.** The ledger path calls `computePersistency(confPersistVals, ledgerSettlements)` where `confPersistVals` are keyed by `periodKey` (e.g., `"2026-Q1"`). `settlementShapeFromPolicies()` must produce objects with `periodKey` values that match the format `persistencyService` writes. A format mismatch (e.g., `"2026-01"` vs `"2026-Q1"`) causes persistency to default to 0, silently failing all 90%-gated awards.

**Validation approach:** Run `settlementShapeFromPolicies(agentUid, tenantId)` against the pilot agent's real data and diff the output against `getAgentSettlements(tenantId, agentUid, year)` field-by-field. Log both arrays and compare: doc count, API totals per period, periodKey values, persistency match. Only flip the flag when diffs are zero or explained.

**Priority:** HIGH. The flag is safe while unset; the risk is ONLY on the flip. No action needed until the first agent flip is proposed.

Banked: H3 PR [#323](https://github.com/Kelsean868/agencytrack/pull/323) (`af07a34`), dispatcher-cleared 2026-05-25.

---

## `deactivateUser` CF — wrap naked awaits in try/catch for diagnostics (LOW, banked 2026-05-24)

**Scope:** `functions/index.js` ~line 791 (`await targetRef.update(updatePayload)`) and ~line 796 (`await admin.auth().revokeRefreshTokens(targetUid)`) are bare unhandled awaits. If either throws (Firestore write error, Auth API failure, rate limit), the CF surfaces `FirebaseError: internal` to the client with no diagnostic message — identical to the transient that fired the #296 FU. Wrapping both in try/catch → typed `HttpsError('internal', <diagnostic message>)` makes future transients debuggable without requiring CF log access.

**Suggested fix (minutes):**
```js
try {
  await targetRef.update(updatePayload);
} catch (e) {
  throw new functions.https.HttpsError('internal', `Firestore update failed: ${e.message}`);
}
// and for revokeRefreshTokens:
try {
  await admin.auth().revokeRefreshTokens(targetUid);
} catch (e) {
  throw new functions.https.HttpsError('internal', `Token revocation failed: ${e.message}`);
}
```

**Priority:** LOW. The CF is functionally correct; this is observability hardening only. Fold into the `.catch` observability sweep or Track H's first CF-touching PR.

Banked: 2026-05-24 (deactivateUser diagnosis session).

---

## ~~D3 — Agent awards parity (`AgentAwardsPanel` enhancements)~~ (RESOLVED — [#297](https://github.com/Kelsean868/agencytrack/pull/297), `0bb1337`)

**Context:** D3 was scoped in the D5 Phase 1 session. Three gaps vs. the Phase 7-8 spec identified in `AgentAwardsPanel.jsx`:

1. **Distance-to-tier callout:** `criteria[i].target - criteria[i].current` is derivable but no "X to go" callout is displayed. `GapBadge` in `GapAnalysisPanel.jsx:17` is the reuse model.
2. **Per-award trend indicator:** `computeRatioTrends` in `awardsEngine.js` provides aggregate activity ratios (not per-award pacing). A trailing-4w vs trailing-12w pace indicator toward annual thresholds is not yet computed.
3. **Persistency gate prominence:** when persistency is the sole criterion blocking eligibility, it is shown inline in the criteria checklist but not called out as the blocking criterion with any visual emphasis.

Source badge is already present — no gap there.

**RESOLVED in PR [#297](https://github.com/Kelsean868/agencytrack/pull/297) (`0bb1337`).** All three legs shipped. Two new LOW FUs banked: `submissions[].persistencyRate` dead read + `getPeriodCtx` duplication in `BmAtRiskPanel.jsx`.

Banked: D5 PR [#293](https://github.com/Kelsean868/agencytrack/pull/293). Resolved: [#297](https://github.com/Kelsean868/agencytrack/pull/297) (`0bb1337`).

---

## I1.x — Hoist duplicated WAR/cn/jc role-rank helpers to shared top-level rules function (CLOSED — PR #268 `065a7d7`)

**Resolved 2026-05-22:** Single top-level `roleRank()` function added at the top of `match /databases/{database}/documents` (adjacent to `isManager()` / `isAgent()`). Phase 1 verified all four block-local copies byte-identical (the third `warRoleRank` in `managerActivityStandardOverrides` was added by PR #266 after this FU was banked — same body, included in the hoist). All four duplicates removed; all 14 call sites swapped to `roleRank()`. No `allow` predicate logic changed; emulator suite 38/38 unchanged before/after. No rules deploy required (behavior identical, proven by unchanged emulator pass-set). Closed in PR [#268](https://github.com/Kelsean868/agencytrack/pull/268) (`065a7d7`).

**Status: CLOSED.**

Banked: I1.1 PR [#254](https://github.com/Kelsean868/agencytrack/pull/254) (`a6fa6b5`). Resolved: PR [#268](https://github.com/Kelsean868/agencytrack/pull/268) (`065a7d7`).

---

## TOOLING — CF unit test harness (SHIPPED — PR #274 `751c65c`)

**Shipped 2026-05-22:** `firebase-functions-test` + `jest` in `functions/` devDependencies. 4 test files / 24 tests: `jfwCountLogic.test.js` (8 pure-logic), `onWarWrite.test.js` (4 trigger-level, firebase-admin mocked via jest.mock — write-back / loop-guard / delete-event / missing-fields), `dailyToWeekly.test.js` (6 aggregation), `sundayHelpers.test.js` (3 helpers). Vitest exclude + ESLint Jest-globals override added. Zero CF runtime changes. The 16 CFs with inline logic in `functions/index.js` are not trigger-tested (STOP-condition B); I3b's new `escalationLogic.js` module will use this harness.

**Status: SHIPPED.**

---

## TOOLING — extract + unit-test the 16 inline CFs in `functions/index.js` (LOW, banked 2026-05-22)

**Scope:** PR #274 (`751c65c`) wired the CF test harness and produced trigger-level tests for `onWarWrite` plus pure-logic tests for `jfwCountLogic`, `dailyToWeekly`, and `sundayHelpers`. The 16 remaining CF exports in `functions/index.js` (`createUser`, `setUserClaims`, `resendInviteEmail`, the 4 scheduled CFs, kiosk CFs, etc.) all have inline handler logic — extracting and testing them would require pulling handlers into sibling modules, which was declared STOP-condition B in the brief.

**Action (own PR when convenient):**

1. For each CF export in `functions/index.js`, extract the handler body to a named function in a sibling module (e.g. `functions/auth/createUserLogic.js`). Keep `exports.functionName = functions.XYZ.handler(extracted)` in `index.js`.
2. Write unit tests per the established pattern: pure-logic tests (no mocks) for transformations + trigger-level tests (firebase-admin mocked via `jest.mock`) for Firestore/Admin calls.
3. The harness is ready — `npm test` in `functions/` and CI's `functions-tests` job both run automatically after PR #274.

**Priority:** **LOW**. Coverage expansion only; no behavior change. I3b's new `escalationLogic.js` module uses the harness first.

Banked: PR #274 (`751c65c`).

---

## Track I I3a — Tier-1 accountability flag (visibility) (SHIPPED — PR #271 `032e38a`)

**Shipped 2026-05-22:** Client-side Tier-1 flag — pure `computeMissedActivities(war, resolvedStandards)` util drives a shared `AccountabilityFlagPanel` on `ManagerWarTab` + `ManagerWarDetail`, plus a per-row "N under" pill on `TeamWarsTab`. Nexus warning tokens (informational, not alarm). New `getResolvedStandardsForMany` bulk helper (1 org-default doc + N parallel by-id override gets; degrades to org-default-only on per-row override fetch failure). NO rule/CF/index/deploy.

**Status: SHIPPED.** Next: I3b (Tier 2 escalation).

---

## Track I I3b — Tier-2 escalation (CF + upline notification) (SHIPPED — PR #275 `49617e3`)

**Shipped 2026-05-22:** New `onWarSubmitNotifyUpline` gen-1 CF (`functions/war/onWarSubmitNotifyUpline.js`) + `functions/war/escalationLogic.js` pure CJS module (mirrors `src/utils/accountabilityFlag.js`). First-submit-transition gate (`before.status !== 'submitted' && after.status === 'submitted'`) de-dups jfwCount write-backs naturally. Upline topology locked: UM→all branch_managers same branchId (composite index `users role+branchId` deployed pre-merge); BM→all sales_managers tenant-wide (single-field, auto); SM→chain stops. Notifications: `manager_alert` type, title + body include manager name + week + count + activity list; best-effort `.catch` per recipient. No rule change; no frontend change. CF registered additively in `functions/index.js`. Tests: 18 escalationLogic unit + 6 handler tests. 48/48 functions tests + 1015/1015 app tests green env-unset. CF deployed post-merge (us-central1, Successful create operation); 6-leg production smoke passed.

**I3 COMPLETE** (Tier 1 accountability flag — PR [#271](https://github.com/Kelsean868/agencytrack/pull/271) `032e38a`; Tier 2 escalation — PR [#275](https://github.com/Kelsean868/agencytrack/pull/275) `49617e3`).

**Status: SHIPPED.**

---

## Track I I3b — `escalationLogic.js` ↔ `accountabilityFlag.js` sync (LOW, banked 2026-05-22)

**Scope:** `functions/war/escalationLogic.js` was introduced in PR #275 as a CJS copy-in of the ESM module `src/utils/accountabilityFlag.js`. The two files share `NUMERIC_STANDARDS`, `BOOLEAN_STANDARDS`, `STANDARD_LABELS`, `resolveStandards`, and `computeMissed` — any drift between them causes silent divergence between Tier 1 (client-side flags) and Tier 2 (upline notifications). A copy-in comment (`// Mirrors src/utils/accountabilityFlag.js — sync if either changes`) is the only guard.

**Action (no immediate urgency — guard works until the domain is stable):**

1. When either file is edited, grep the other for the same constant/function and apply the same change.
2. Longer-term: if this pattern recurs across multiple copy-in pairs, consider a `scripts/check-mirror-sync.mjs` that diffs the two files and CI-fails on divergence. Not worth the complexity for one pair.

**Priority:** LOW. Both files are currently in sync. The comment guard is sufficient while the domain is stable.

**Update 2026-05-31 (P1a PR #399):** Track J P1a now ships a second mirror pair (`functions/leaderboard/rankingLogic.js` ↔ `src/lib/productionReport/computations.js`) — but with a **CI-failing cross-check test** (`src/lib/productionReport/__tests__/cross-check-cjs.test.js`) that runs shared fixtures through both modules and asserts identical output for all four periods + ranking. This is the cross-check pattern that the original 2026-05-22 wish-list note hoped for. **Optional cleanup:** apply the same cross-check pattern to the `escalationLogic` ↔ `accountabilityFlag` pair — a 20-line vitest test importing both modules via `createRequire` and running a shared standards-fixture set. Upgrades the comment-guard to a CI guard for the older pair too. Still LOW priority; the pairs are currently in sync.

Banked: I3b PR #275. Cross-check pattern shipped: Track J P1a PR #399.

---

## Track I I3 — 2-consecutive-week intensifier (LOW, banked 2026-05-22)

**Scope:** Track I spec §4 — "two consecutive missed weeks can raise the flag's prominence on the upline dashboard. Still purely a flag."

**Action:** at render-time, fetch the previous week's WAR doc by predictable id (`{managerId}_{prevWeekStart}`); if the previous week's missed-activity set intersects the current week's, render the intersecting chips with stronger visual (red border + ⚠ icon, or escalate from warning to error tone). For Tier 2, the CF could optionally include "Nth consecutive" in the notification body via the same previous-week read.

**Priority:** LOW. Sharpens an already-visible signal; not blocking.

Banked: I3a PR [#271](https://github.com/Kelsean868/agencytrack/pull/271) (`032e38a`).

---

## Track I I3 — `ManagerDashboard` Overview accountability chip (LOW, banked 2026-05-22)

**Scope:** Track I spec §4 Tier 1 says "on the manager's own dashboard" — currently I3a surfaces the flag on the WAR tab only. Top-level `ManagerDashboard` Overview tab could surface a small "N standards under target this week" chip linking to the WAR tab.

**Action:** on `ManagerDashboard` mount (when viewer is a `unit_manager` / `branch_manager` / `sales_manager`), fetch the latest-week WAR doc + `getResolvedStandards` for the viewer; render a small warning chip with the missed count when > 0. Chip click → routes to "My WAR" tab.

**Priority:** LOW. WAR tab is the primary surface; this is a discoverability nudge.

Banked: I3a PR [#271](https://github.com/Kelsean868/agencytrack/pull/271) (`032e38a`).

---

## I1.x — `isProducingManager` setter (admin-set or self-service — policy TBD) (LOW, banked 2026-05-21)

**Scope:** `ManagerWarTab.jsx` reads `userProfile.isProducingManager` to gate the personal-production sub-panel (Personal API TTD + Personal Applications). The field does not exist on any user doc — the panel ships dormant. No setter is built in I1.1 (PR [#254](https://github.com/Kelsean868/agencytrack/pull/254)).

**Action (when policy is decided):**

1. **Policy decision (dispatcher):** who can set `isProducingManager`? Options: (A) admin-only — extend `EditUserDrawer` with a toggle, restricted to `tenant_admin`/`platform_admin`; (B) self-service — toggle on `ProfileScreen` or `ManagerWarTab` itself; (C) manager-set — branch_manager or sales_manager sets it for their reports.
2. **Implementation:** once policy is locked, implement the setter in `EditUserDrawer` or `ProfileScreen` per Option A/B/C and extend the users-collection rules to allow the write from the authorized role tier.
3. **Smoke leg:** verify that toggling the flag on a manager's user doc causes the personal-production sub-panel to appear/disappear on next `ManagerWarTab` render.

**Priority:** **LOW**. No user-visible impact until the field is set. The dormant panel means the feature is invisible, not broken.

Banked: I1.1 PR [#254](https://github.com/Kelsean868/agencytrack/pull/254) (`a6fa6b5`).

---

## I §6 — Default new agents to `licenseStatus: 'provisional'` at creation (LOW, banked 2026-05-24)

**Scope:** Currently `licenseStatus` is manager-set post-creation. New agents start with no `licenseStatus` field, meaning they are "untracked" and won't appear in the CBTT compliance list until a manager manually marks them provisional. The design intent for Tatil is that every new agent should be provisional from day one.

**Action (when ready):**

1. Extend `doCreateUser` Cloud Function in `functions/index.js` to include `licenseStatus: 'provisional'` in the user doc written at creation. This is the ONLY place user docs are created server-side — no client-path change needed.
2. Optionally backfill existing agent docs that have no `licenseStatus` set (one-off admin script).
3. No rule change required — `licenseStatus` is already in the manager-update allowlist (PR #299). Creation is CF-side (Admin SDK, bypasses rules).

**Priority:** **LOW**. Tracking works today via manual set; this makes it automatic.

Banked: Track I §6 PR #299 (`71717af`).

---

## BOA-teardown — remove `BOA` from `prospectingSource` once legacy docs are backfilled (LOW, banked 2026-05-21)

**Scope:** PR [#252](https://github.com/Kelsean868/agencytrack/pull/252) added `'bank-referral'` to the selectable taxonomy and the rule allowlist (per head-of-sales 2026-05-21), keeping `'BOA'` valid for transition. Form no longer offers `'BOA'`; the only place it still appears in code is the rule allowlist + the legacy display label entry in `PROSPECTING_SOURCE_LABELS`. Any live `prospectInfo` docs with `prospectingSource: 'BOA'` are not yet backfilled.

**Action (single follow-up PR when ready):**

1. **Count live docs.** Read-only dry-run query: enumerate `/tenants/{tid}/users/*/prospectInfo` across all tenants where `prospectingSource == 'BOA'`. Use an Admin SDK script (`firebase-admin` from `functions/node_modules/firebase-admin`); commit it under `scripts/` with `--execute` opt-in flag per the CLAUDE.md dry-run pattern.
2. **Backfill.** Re-run the same script with `--execute` to rewrite the matched docs as `prospectingSource: 'bank-referral'`. Pre-merge dry-run output captured in the PR body.
3. **Cleanup.** Same PR:
   - Remove `'BOA'` from `firestore.rules` allowlists (both create + update on `prospectInfo`).
   - Remove the `BOA: 'Bank Referral (BOA)'` entry from `PROSPECTING_SOURCE_LABELS` in `prospectInfoService.js`.
   - Remove the rules-test case 8b (legacy-BOA-allowed) and any component-test `BOA` fixtures.
4. **Deploy.** Rule modification (not additive) — deploy post-merge per CLAUDE.md staging discipline.

**Priority:** LOW. Both values render with the same human-facing label ("Bank Referral (BOA)"), so the transition window is invisible to users. The cleanup is purely about preventing the orphan-value drift trail from accumulating new writes (the rule still permits `'BOA'` writes today; that's the only behavior change at teardown).

**Verification at teardown:** an emulator rules test case must DENY `prospectingSource: 'BOA'` after the rule change; ALLOW for `'bank-referral'` continues.

Banked: PR [#252](https://github.com/Kelsean868/agencytrack/pull/252).

---

## ~~Smoke harness — stable helpers for controlled selects + overflow visibility + REST-vs-cache~~ (SHIPPED — helpers in walk-helpers.mjs + CLAUDE.md banked patterns, PR #332)

**Scope:** PR #248 smoke debugging surfaced three classes of repeatable thrash that future smokes will hit again unless we bank reusable patterns into `scripts/verification/lib/walk-helpers.mjs`:

1. **React 19 controlled-select automation.** Playwright's `selectOption()` works in real Chromium when used alone, but the smoke initially layered an `evaluate()` block that fired untrusted generic `Event('change')` after `selectOption()`. The extra dispatch wasn't needed (selectOption already fires a trusted Chromium change event React handles) and may interact badly with React 19's event handling. Need a banked helper `selectReactOption(page, locator, value)` that does the One Right Thing and is the canonical way smokes interact with controlled `<select>` elements.
2. **Scrollable-container visibility.** `Prep:` (and any card-level data in joint-calls, coaching notes, prospect-info) renders inside an `overflow-y-auto` modal. Playwright's `waitFor({ state: 'visible' })` treats scrolled-off-screen-within-overflow content as not visible, which is correct for human-visible smokes but wrong for "is this rendered with the right data" smokes. Need a banked helper `domTextCount(page, selector, text)` (returns count of matching elements regardless of viewport position) and a documented decision rule: viewport-visibility for layout/UX checks, DOM-presence for data-rendering checks.
3. **REST-write vs persistentLocalCache reads.** Smokes that write via Firestore REST in a fresh browser context can't always observe their own writes via the SDK in the same context — the SDK fetches from server on the first query (no cache), then caches; subsequent queries hit cache. This led PR #248 to chase a (wrong) `getDocsFromServer` theory in production code. Need either: (a) a banked pattern for "verify a REST-written doc landed" that uses REST-side verification (read it back via REST), not SDK queries, OR (b) a banked decision rule that says "smokes verify the UI path end-to-end (addDoc + SDK reload); REST writes are diagnostic only and don't gate on SDK-side observation."

**Action:**

1. Audit existing smokes (`prospect-link-smoke.mjs`, `joint-calls-smoke.mjs`, `prospect-info-smoke.mjs`, others) for the three patterns above and identify which use ad-hoc approaches.
2. Extend `walk-helpers.mjs` with the helpers + inline JSDoc explaining when to reach for each.
3. Refactor existing smokes to use the helpers; drop the ad-hoc evaluate blocks.
4. Add a short section to `CLAUDE.md` (under § Methodology requirements or banked patterns) documenting the three patterns and the decision rules.

**Priority:** **MEDIUM**. None of this is broken — PR #248 ships green. But the same thrash will recur on the next smoke that touches a controlled select inside an overflow modal (E5 kiosk fields, M1 modal forms, daily activity, weekly wizard step transitions). Banking now is cheaper than rediscovering each time.

**Why:** PR #248 spent ~90 min on smoke debugging that produced two correct-but-wrongly-motivated commits: the smoke's DOM-presence check (correct, banked) and a production code change to `getDocsFromServer` (wrong, reverted in `6b3c252`). The DOM-presence helper would have collapsed both decisions into one.

Banked: PR #248 revert commit (`6b3c252`).

---

## ~~CI doc drift — CLAUDE.md says "lint + build" but CI runs lint + test + build~~ (SHIPPED — see `docs/ci-doc-drift-lint-test-build` branch, closing PR)

**Scope:** CLAUDE.md § Lint Policy: "This is enforced by `.github/workflows/ci.yml` (lint + build on every PR to main)." and Session Protocol step 7: "Push branch, open PR — CI will run lint + build automatically on GitHub". Both are wrong as of PR #244 — `.github/workflows/ci.yml` runs three steps: **Lint** (`npm run lint`), **Run tests** (`npm test -- --run`), **Build** (`npm run build`). The doc drift caused a false-green local on PR #244: the local `npm test` ran with `.env.local` populated, hiding a transitive firebase-init throw in `CoachingNotesModal.test.jsx`; CI ran the same test with env unset and failed.

**Action:**

1. Edit `CLAUDE.md` § Lint Policy to read: "`npm run lint`, `npm test`, and `npm run build` must all pass before any push. Enforced by `.github/workflows/ci.yml` on every PR to main."
2. Edit Session Protocol step 7 (and any sibling references) to say "lint + tests + build" wherever it currently says "lint + build".

**Priority:** LOW (doc-only fix; no behavior change).

Banked: PR #244 fix commit (`cdb6aa7`).

---

## ✅ Vitest setup — global firebase stub to prevent transitive unmocked-firebase false-greens (LOW-MED, banked 2026-05-21) — RESOLVED in PR #264

**RESOLVED 2026-05-22 in PR [#264](https://github.com/Kelsean868/agencytrack/pull/264) (`b97e925`).**

`src/__mocks__/firebase.js` inert stub (auth/db/storage/functions = {}, default = {}). Custom Vite `resolveId` plugin (`firebaseTestStubPlugin`, `enforce: 'pre'`) gated on `process.env.VITEST` intercepts relative `/firebase` imports at the Rollup resolver level. `942/942` with env UNSET is now the default gate (not a separate parity run). Three #262 init-only band-aids removed as proof. CLAUDE.md § Test Policy documents the pattern.

**Banked:** PR #244 fix commit (`cdb6aa7`).

---

## ✅ Vitest — redundant-mock sweep (remove init-only `vi.mock` calls now obsolete with global stub) (LOW, banked 2026-05-22) — RESOLVED in PR #281

**RESOLVED 2026-05-23 in PR [#281](https://github.com/Kelsean868/agencytrack/pull/281) (`5581fd2`).**

11 init-only `vi.mock('../firebase'|'../../firebase'|'../../../firebase', () => ({ db: {} }))` calls removed from service/wizard test files. Grep-based classification (no full-file reads beyond 3 for ambiguous multi-line factories). LEAVE list (7 files, all with hoisted refs or non-bare sub-objects): AuthContext.test.jsx, authService.test.js, persistencyService.test.js, agentManagementService.test.js, managerService.test.js, userService.test.js, KioskModeTab.toast.test.jsx. Suite 1066/1066 unchanged; lint 0; build green.

Banked: PR #264 (`b97e925`).

---

## ~~Track J — Tenure floor numbers PROVISIONAL — confirm with head of sales~~ (RESOLVED — confirmed 2026-05-21)

**Scope:** The `tenureApiFloors` band table seeded into `tatillife_south` via PR #240 (`scripts/seed/seed-tenure-api-floors.mjs`) came from the head-of-sales slide of 2026-05-19.

**RESOLVED — bands confirmed by head of sales on 2026-05-21.** The seeded values (m<12 → 150K / 12–24 → 200K / 25–36 → 250K / 37–48 → 300K / 49–60 → 400K / m>60 → 500K) are correct. No re-seed needed. The `// PROVISIONAL` comment in `tenureFloors.js` and the `tenureApiFloorsProvisional: true` flag in `config/companyMinimums` are stale residue — see cleanup FU below.

Banked: PR #240 (`4134d2c`). Resolved: 2026-05-21 (head-of-sales confirmation).

---

## ~~Track J — Clear stale provisional signals for tenure bands~~ (SHIPPED — see PR #329 closing)

**Scope:** Following head-of-sales confirmation (2026-05-21), two stale provisional signals remain in the codebase:

1. `src/utils/tenureFloors.js:2-3` — comment reads `// PROVISIONAL: numbers below await head-of-sales confirmation. The board-signed Sales_Career.pdf governs...` Drop the provisional qualifier; leave the source-of-truth attribution (slide date, script reference).
2. `scripts/seed/seed-tenure-api-floors.mjs` — sets `tenureApiFloorsProvisional: true` on write. Change to `false` (or remove the field entirely since the app never reads it from Firestore).
3. *(Optional)* Clear the dormant `tenureApiFloorsProvisional` field on the live `config/companyMinimums` doc via a one-off Admin SDK update or re-run of the seed with the corrected flag.

**Priority:** LOW. Production behavior is unaffected (the flag is never read by `src/`). Fold into Track H's first CF/config-touching PR or a later housekeeping sweep.

Banked: 2026-05-24 (post-confirmation cleanup).

---

## Track J fast-follow — Tenant-Admin in-app editor for the tenure band table (MEDIUM, banked 2026-05-20)

**Scope:** PR #240 ships the `tenureApiFloors` block as tenant-admin-editable config (via the Admin SDK seed script), but no in-app editor exists yet for the 6 bands. The B5 `EditConfigModal` pattern (`src/components/admin/EditConfigModal.jsx` → `src/components/admin/CompanyConfigPanel.jsx`) is the canonical surface; this FU extends it.

**Suggested shape:**

- New tile on `CompanyConfigPanel.jsx` for "Tenure API Floors" (table preview with 6 rows). ~~Provisional badge if `tenureApiFloorsProvisional === true`~~ — moot; bands confirmed 2026-05-21, flag is stale residue (see cleanup FU above).
- New modal sibling to `EditConfigModal` that lets tenant_admin edit the 6 band values.
- Validation: each band ≥ 0, ≤ 10,000,000 (mirror `EditConfigModal` annualAPI bounds); bands monotonically non-decreasing across tenure (band0_lt12 ≤ band12_to_24 ≤ ... ≤ band_gt60) — surface a non-blocking warning if the manager violates this.
- Write path: extend `setCompanyMinimums()` (or a new `setTenureApiFloors()` peer) to take the 6 values; `merge: true` semantics preserve unrelated fields.
- Audit: `updatedBy` (uid) + `updatedAt` (server timestamp) on the doc, same as B5.

**Priority:** **MEDIUM**. Until this ships, corrections go through the seed script (Kyron-only). The in-app editor remains worthwhile for future adjustments independent of the provisional-badge concern.

Banked: PR #240 (`4134d2c`).

---

## ~~Track J2 — Career-level qualification on trailing 2-year average annual API~~ (SHIPPED — PR [#325](https://github.com/Kelsean868/agencytrack/pull/325), `77d2317`)

**Scope:** Per the board-signed `Sales_Career.pdf`, career-level qualification is based on a **trailing 2-year average of annual API**, not single-year point-in-time API. The Career Portal currently checks current-year API only (`CareerPortal.jsx` rows). This FU adds the 2-year trailing average computation feeding the Career Portal level-up criteria.

**Out of PR #240's scope** — PR #240 was the tenure Company Floor only; career-level API math stays as-is.

**Suggested shape:**

- New aggregation helper: `compute2YearAverageAPI(submissions, year)` — sums settled API across the trailing 24 months from a reference date, divides by 2.
- Wire into `CareerPortal.jsx` `CriterionRow` for the API criterion (label clarifies "2-year avg").
- Decide: does the average count partial early-tenure years (agent < 24mo)? Likely: use available months ÷ 12 as the denominator, but confirm with head of sales as part of the broader Track J reconciliation.
- Acceptance criteria: API criterion on the Career Portal reflects 2-year trailing average, not current-year API.

**Priority:** **MEDIUM**. Career Portal is a motivational surface; the gap is misleading agents about level eligibility. Not pilot-blocking (career-level surfacing is read-only motivational; tenure-floor enforcement on commitments is the binding piece — already shipped).

Banked: PR #240 (`4134d2c`).

---

## Track J3 → Track I — Manager levels 8–10 production model (LOW, banked 2026-05-20)

**Scope:** The head-of-sales slide carries a manager-tier production model (manager levels 8, 9, 10) with three components per level: personal API + per-advisor production + unit total, all tenure-scaled. This is **Track I (Manager Activity Reporting) territory**, not Track J — recording here because it surfaced in the same slide as the tenure-floor table.

**Where it lands:** Track I when that track is planned. Mention in the Track I scope brief that manager-level production targets carry forward from this slide (subject to the same provisional confirmation as tenure floors).

**Priority:** **LOW**. Track I has not been scoped yet; this is a forward-reference note so the manager-production-model question doesn't get lost.

Banked: PR #240 (`4134d2c`).

---

## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13) [RESOLVED PR #211, dff2847]

**Scope:** `git status` on `main` surfaces 11 untracked files left over
from shipped work. Cleanup deferred during the memory-refresh session.

**Stale kickoff briefs** (all features shipped — archive to
`docs/archive/briefs/`):

- `docs/PR-3-Claude-Code-Brief.md` — user-mgmt PR-3 (#28). Already noted
  in CONTEXT.md Pending Operational across PR #39 + #40; un-actioned since.
- `docs/briefs/e1-slice-2a-kickoff.md` — E1 schema split (#68).
- `docs/briefs/e1-slice-2b-kickoff.md` — E1 schema split (#69/#70).
- `docs/briefs/e4-phase-8-followup-kickoff.md` — E4 follow-up.
- `docs/briefs/e4-production-report-kickoff.md` — E4 (#72).
- `docs/briefs/e5-kiosk-mode-kickoff.md` — E5 (#73).
- `docs/briefs/e6-agent-of-month-kickoff.md` — E6 AOM (#76).
- `docs/briefs/e6-daily-input-kickoff.md` — E6 daily (#71).
- `docs/briefs/pr-d-server-side-email-kickoff.md` — PR-D (#133).

**Verification scripts** (possibly reusable — defer fate to next consumer):

- `scripts/mgr-mobile-audit.cjs` — used by Mobile FU#1 #90 mgr-mobile audit.
- `scripts/verification/pr-d-email-smoke.mjs` — used by PR-D #133 smoke.

**Cleanup approach:**

1. `mkdir -p docs/archive/briefs/` if not present.
2. `git mv` each stale brief into `docs/archive/briefs/`.
3. Surface the two verification scripts for decision: archive, delete, or
   leave as-is for the next manager-mobile / email-smoke iteration.
4. Single docs-only commit: `docs(archive): archive Track-E + PR-D kickoff briefs (shipped)`.

Priority: **LOW**. Not blocking. Bank for the next docs-hygiene session.

**Closure (PR #211, squash `dff2847`):** 9 stale kickoff briefs archived to `docs/archive/briefs/` via filesystem move + `git add` (untracked files; `git mv` requires tracked source). Single docs-only commit per FU body step 4.

**Rule 11 corrected-diagnosis:** FU body banked-time count of "11 untracked files" was stale at resolution. Actual count: 15 untracked files (9 briefs + 6 scripts). Four additional verification scripts joined the untracked pool between 2026-05-13 banking and 2026-05-18 resolution: `border-border-smoke.mjs` (border-border #156), `high6-ytd-smoke.mjs` (HIGH-6 YTD), `mobile-fu2-tap-targets-smoke.mjs` (Mobile FU#2 PR #153), `mobile-fu4-cosmetics-smoke.mjs` (Mobile FU#4 PR #154). All 6 scripts (original 2 + post-banking 4) intentionally left as deferred per FU body's "possibly reusable — defer fate to next consumer" direction. If/when a future PR re-runs any of these smoke scripts (Mobile FU#5, PR-D follow-up, etc.), the consuming PR can decide commit vs delete vs archive at that time.

**Additional Rule 17 capture at execution time:** brief Phase 0 prescribed `git worktree add` for the cleanup, which fails for untracked-file operations — worktrees share the tracked object store but start with an empty working directory, so the 15 untracked files never propagated. Phase 1 hard-stop surfaced this; resolution worked from the main working tree instead. Eleventh Rule 17 in-the-wild signal of the two-day arc. Banks a candidate CLAUDE.md rule: "When PR scope is moving/staging untracked files, work from the main working tree — worktree convention applies only to tracked-file operations."

**Deferred-scripts closure (PR #225, `975b0fc`):** The 6 verification scripts left deferred per the Rule 11 corrected-diagnosis paragraph above are now resolved. 6 TRACK (structural peers of the existing 19 tracked smokes under `scripts/verification/`) + 1 DELETE — `scripts/verification/pr-d-email-smoke.mjs` removed due to forbidden `functions/service-account-key.json` import pattern (banned post-PR #78) + hardcoded production identifiers + production-mutation surface; purpose discharged at PR #133 ship time. The new untracked script `resend-invite-ui-smoke.mjs` (PR #215, merged 2026-05-18) also tracked under the same pattern. 2 polish comments documenting the PREVIEW_HOST env override added to mobile-fu2 + mobile-fu4 smokes. This PR is the "next consumer" decision moment the deferred-scripts direction anticipated.

---

### ✅ Add PREVIEW_HOST env override to 2 verification smokes (LOW, refactor, banked 2026-05-19) — CLOSED 2026-05-19 (PR #227, `cf0373d`)

**RESOLVED 2026-05-19**

Banked from PR #225 (`975b0fc`) Phase 2 Edit 3 source-verify catch. Two tracked verification smokes have hardcoded preview URL defaults without env override support, blocking re-runs against future preview branches without code edits:

- [scripts/verification/border-border-smoke.mjs:34-35](scripts/verification/border-border-smoke.mjs:34)
- [scripts/verification/resend-invite-ui-smoke.mjs:43-44](scripts/verification/resend-invite-ui-smoke.mjs:43)

Pattern to apply (matches [mobile-fu2-tap-targets-smoke.mjs:61-62](scripts/verification/mobile-fu2-tap-targets-smoke.mjs:61) and [mobile-fu4-cosmetics-smoke.mjs:73-75](scripts/verification/mobile-fu4-cosmetics-smoke.mjs:73)):

```js
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '<stale-default-here>';
```

XS scope (2 line changes, 1 file each). Ship as standalone refactor PR when convenient — not blocking any active work since the smokes already discharged their PR purposes.

This is the sixth Rule 17 source-verify catch of the 2026-05-19 dispatcher arc and the first under the newly-banked Rule 17 sub-bullet (PR #223, `d40fa85`). The sub-bullet caught a brief premise gap on the next dispatched PR — exactly what it was designed for.

Banked: PR #225 (`975b0fc`).

**Closure (PR #227, `cf0373d`):** Shipped via PR #227 (`cf0373d`). Both files now honor PREVIEW_HOST env override. Existing stale defaults preserved as fallback.

---

## ~~Fold console/network capture into the canonical exploration-template smoke~~ (LOW, banked 2026-05-20)

**Scope:** The standard smoke script template (lib helpers in `scripts/verification/lib/walk-helpers.mjs` + the per-feature smokes that consume it) does not capture browser console errors/warnings or network failures. Each smoke today only asserts DOM/state expectations. For PR #238's pre- and post-merge smokes the dispatcher requested console + network capture; an ad-hoc supplemental script was written (`scripts/verification/weekly-activity-floors-console-capture.mjs`) to satisfy the request, but it was NOT banked into the canonical template — every future PR that wants this signal will either re-author the same capture pass or skip it.

**Suggested resolution:** add an optional `captureConsoleAndNetwork(page)` helper to `walk-helpers.mjs` that returns `{ consoleMessages, networkFailures }` and a `formatCaptureReport()` companion that prints the summary block. Per-feature smokes opt in by wiring the helper before login and dumping the report block before exit. Static-asset noise filter (`.map`/`.ico` regex) lives in the helper, not the per-feature smoke.

**Priority:** **LOW**. Not blocking any active work; the supplemental script can be deleted or kept as-is in the meantime. Resolve when next touching `walk-helpers.mjs` for any reason, or as standalone XS refactor.

Banked from PR #238 (`1b05eb7`) post-merge.

**Closure (PR #333, `3d76d9a`):** `captureConsoleAndNetwork(page)` + `formatCaptureReport(capture)` added to `walk-helpers.mjs`; LESSON 9 banked; CLAUDE.md updated.

---

## Verify PR #166 shakedown harness fixes via runtime re-run (LOW, deferred 2026-05-15)

**Background:** PR #166 fixed shakedown bugs 001/003/004/006 (cat02 navigator off-by-one, cat04 T4.02 hard assertion, cat08 navigator off-by-one). Phase 3 runtime re-run was attempted on 2026-05-15 but blocked: `agent-001@agencytrack.test` (and all `*@agencytrack.test` test accounts) returned "Incorrect email or password" against production. Test data seeding from PR-F was not active at time of verification. Phase 1 source inspection confirmed fix shape; runtime verification deferred to next seeding cycle.

**Acceptance criteria (from PR #166 brief):**
- `cat02-role-agent.mjs` T2A.03 passes (screen 5 body matches `/summary|review|submit|total/i`)
- `cat04-form-validation.mjs` T4.02 passes (hard fail when wizard advances past invalid date; or correctly blocks)
- `cat04-form-validation.mjs` T4.03 passes (unchanged from baseline)
- `cat08-screenshot-dossier.mjs` T8.ALL captures ≥80 screenshots (was 79 pre-fix)

**To execute:** Seed `*@agencytrack.test` test accounts via PR-F tooling, then run:
```
node scripts/verification/shakedown/cat02-role-agent.mjs
node scripts/verification/shakedown/cat04-form-validation.mjs
node scripts/verification/shakedown/cat08-screenshot-dossier.mjs
```

Priority: **LOW**. No app source affected by PR #166 — this is harness-only verification. Close by removing this item once all four acceptance criteria pass.

---

## Track D — cron portion status verification — RESOLVED in PR #137 (2026-05-13)

**Resolved 2026-05-13 in PR #137** (`bb08cc7`,
`fix(functions): chain .timeZone('UTC') to all 4 scheduled CFs (Track D)`).

Phase 1 Track D investigation surfaced that all 4 scheduled CFs were firing
in `America/Los_Angeles` (Firebase Functions v1 default) instead of UTC.
The cron strings were written for UTC interpretation but no `.timeZone()`
chain was present, causing 3–7 hour drift from intended AST fire times.

Fix: chained `.timeZone('UTC')` to `sendSundayNudge`, `sendMondayNudge`,
`flagMissedDeadlines` in `functions/index.js` and `aggregateDailyToWeeklyCron`
in `functions/aggregators/sundayDailyToWeekly.js`. Pre-merge deploy from
the feature worktree. Post-deploy `gcloud scheduler jobs describe` confirmed
`timeZone: UTC` on all 4 jobs and correct `scheduleTime` UTC instants:

| Function | scheduleTime | AST wall-clock |
|---|---|---|
| sendSundayNudge | 2026-05-17T22:00Z | Sun 18:00 AST ✓ |
| sendMondayNudge | 2026-05-18T11:00Z | Mon 07:00 AST ✓ |
| flagMissedDeadlines | 2026-05-18T13:01Z | Mon 09:01 AST ✓ |
| aggregateDailyToWeekly | 2026-05-18T03:00Z | Sun 23:00 AST ✓ |

SEC-9c (hardcoded `TENANT_ID = 'tatillife_south'` on scheduled functions)
remains open — separate ticket, deferred post-pilot.

---

## RESOLVED 2026-05-11 — Service-account-key cleanup (Cloud Functions)

E5 (kiosk) shipped with `functions/service-account-key.json` loaded via
`admin.credential.cert(...)` because the App Engine default SA lacked
`iam.serviceAccounts.signBlob` — `createCustomToken` would fail otherwise.
Cleanup blocked on local `gcloud` install. Resolved in `chore/security-remove-sa-key`:

1. Granted `roles/iam.serviceAccountTokenCreator` on
   `agencytrack-2a610@appspot.gserviceaccount.com` with the SA itself as
   member (self-impersonation).
2. Replaced the cert load in `functions/index.js` with plain `admin.initializeApp()`.
3. Redeployed `validateKioskToken`, `createKioskToken`, `revokeKioskToken`,
   `setAgentOfMonth`, `getAgentOfMonthCandidates`. Production kiosk smoke-test
   confirmed `signBlob` now works under ambient credentials.
4. Key file remains gitignored (`.gitignore:24-26`); was never committed
   and is not present in any feature worktree.

Local `.cjs` admin scripts in `functions/scripts/` (`seed-first-tenant-admin`,
`seed-platform-admin`, `migrate-*`, `restore-super-admin-claim`) and
`functions/set-agent-password.cjs` still `require('./service-account-key.json')`
directly. They run on Kelsean's workstation only, never in CI/CF, so the
local key file in the main worktree stays for now. Future cleanup: refactor
those scripts to ADC + impersonation. Not blocking.

---

## ✅ Worktree + branch audit (LOW, banked 2026-05-11; scope grew 2026-05-13) — CLOSED 2026-05-19

**RESOLVED 2026-05-19** via direct-to-main housekeeping commit. Single audit-and-execute dispatch executed the canonical runbook sequence ([`docs/runbooks/branch-cleanup.md`](runbooks/branch-cleanup.md) § "Worktree-attached branches"): 7 `git worktree remove` calls (all clean, no `--force` needed) + `node scripts/maintenance/prune-merged-branches.mjs --execute` (7 OK, 0 failed). Post-sweep verification: `git worktree list` reports only `C:/Projects/AgencyTrack [main]`; `git branch -vv | Select-String ": gone\]"` returns zero matches. Closure ledger appended below. The historical state captured in the 2026-05-13 update is preserved unchanged as drift-trail; the 7 branches actually swept on 2026-05-19 are a different (later-arriving) set documented in the closure ledger.

**Updated 2026-05-13:** scope is larger than the 2026-05-11 banking
suggested. Current state:

- **6 worktrees** in `.claude/worktrees/`, all attached to merged feature
  branches (post-squash, `git branch -v` shows `+` markers indicating the
  branches diverged from main post-merge):
  - `feat+pr-f-bulk-test-data` (PR #135)
  - `feat-polish-2-toast-sweep` (PR #127)
  - `feat-pr-d-server-side-email` (PR #133)
  - `feat-pr4-edit-user-flows` (PR #122)
  - `feat-pr4b-role-branch-edits` (PR #129)
  - `feat-wizard-ux-hardening` (PR #88 + R1 micro-fix #124)
- **~15 stale local branches** without remote tracking refs (most have
  `+` markers indicating squash-merged-but-locally-divergent state). The
  original two orphan branches from the 2026-05-11 audit
  (`chore-context-sync-and-verification-script-lift`,
  `chore/housekeeping-followups`) are still present.

**Cleanup approach** (extends the original audit pattern):
1. For each worktree-attached branch, run `git diff main..<branch> --stat`
   to verify no unmerged content (expected: empty diff for squash-merged
   PRs).
2. If empty diff: `git worktree remove --force <path>` then `git branch -D <branch>`.
3. For the orphan branches without worktrees: same diff check; if equivalent
   work landed under a different SHA via squash, `git branch -D`.
4. Surface any branch with unmerged content for decision (resume?
   abandon? reconcile?).
5. After cleanup, `git fetch origin --prune` to clear any stale remote
   tracking refs.

~45–60 min focused session now (was ~30–45 min before scope grew).

Audit approach (bank for whoever picks this up):
1. For each worktree-attached branch, run
   `git diff main..<branch> --stat` to see if there's unmerged content.
2. For each, check if the equivalent feature was merged under a
   different name (cross-reference against `gh pr list --state merged
   --search "<keyword>"`).
3. If equivalent work is on main: `git worktree remove --force <path>`
   then `git branch -D <branch>`.
4. If unmerged work exists: surface for decision (resume? abandon?
   reconcile?).
5. For the two orphan branches without worktrees: same diff check,
   same decision tree.

**Closure ledger (2026-05-19):**

| Branch | Worktree path | Tip SHA | Merged via | Squash SHA |
|---|---|---|---|---|
| `chore/aria-label-sweep` | `C:/Projects/agencytrack-worktrees/aria-label-sweep` | `9763934` | [PR #213](https://github.com/Kelsean868/agencytrack/pull/213) | `38be348` |
| `chore/dead-motivationalcarousel-deletion` | `C:/Projects/agencytrack-worktrees/dead-motivationalcarousel` | `30a674b` | [PR #208](https://github.com/Kelsean868/agencytrack/pull/208) | `44db563` |
| `chore/fu-f-2-cjs-parser-unification` | `C:/Projects/AgencyTrack-fu-f-2` | `adfca07` | [PR #204](https://github.com/Kelsean868/agencytrack/pull/204) | `a975706` |
| `chore/fu-m-delete-multi-role-smoke` | `C:/Projects/AgencyTrack-fu-m` | `6f0e27c` | [PR #202](https://github.com/Kelsean868/agencytrack/pull/202) | `a4fba56` |
| `chore/fu-n-rule17-tracked-status-bullet` | `C:/Projects/AgencyTrack-fu-n` | `052ca15` | [PR #206](https://github.com/Kelsean868/agencytrack/pull/206) | `1d36436` |
| `chore/resend-invite-ui` | `C:/Projects/agencytrack-worktrees/resend-invite-ui` | `84d409b` | [PR #215](https://github.com/Kelsean868/agencytrack/pull/215) | `3690bf6` |
| `fix/editusedrawer-test-unit-select-ci-race` | `C:/Projects/agencytrack-worktrees/fix-editusedrawer-ci-race` | `2dd4262` | [PR #210](https://github.com/Kelsean868/agencytrack/pull/210) | `f493a0c` |

All 7 branches were textbook DELETE-BOTH: clean `git status --short`, `[gone]` upstream with no `ahead N` annotation, tip subject matched the corresponding PR squash subject verbatim. No unpushed or uncommitted work surfaced during audit or execution. Two-strike counter held 0/2 throughout. Direct-to-main housekeeping commit; Rule 16 (post-merge fill scope) not applicable (no PR squash to record); Rule 15 (origin-verification) applied on push.

The two skipped local branches reported by the prune script (`docs/arbitrary-syntax-sweep-brief` with no upstream + `docs/mobile-fu4-cosmetics-brief` with `[ahead 3]` unpushed commits) were out-of-scope for this sweep — both have live or absent upstream rather than `[gone]`, and `docs/mobile-fu4-cosmetics-brief` carries unpushed commits that warrant separate dispatcher review before any cleanup.

---

## PILOT-BLOCKING — Shakedown findings (surfaced 2026-05-13, must fix before Tatil demo)

Two app bugs confirmed by the pre-pilot shakedown run. Full report: [`docs/shakedown-findings-2026-05-13.md`](shakedown-findings-2026-05-13.md).

### SHAKEDOWN-001 — Manager/UM see Agent Dashboard on first login — RESOLVED in PR #141

**Resolved in PR #141** (`162b8de`, `fix(auth): manager role resolution on first login (SHAKEDOWN-001)`).

**Root cause:** `AuthContext.jsx` early-exited when `claimTenantId` was null, blocking the Firestore doc fallback. On fresh accounts where `setCustomUserClaims()` hasn't yet propagated (60–120s delay), claims were empty, so `role` resolved to null and `App.jsx` fell through to `AgentDashboard`.

**Fix shape D:** Made the Firestore user doc the load-bearing fallback. Parallel fetch via `Promise.all([getIdTokenResult(true), getDoc(...)])` using a localStorage-cached tenantId. `resolvedRole = claims.role ?? doc.role ?? null`. `ProvisioningScreen` added to `App.jsx` for the true-null case (no claims AND no doc). Post-merge manual smoke: Kyron creates fresh BM via UserManagementPanel, signs in, confirms BM dashboard renders within seconds.

### SHAKEDOWN-002 — Unit Manager sees cross-unit agents — FULLY RESOLVED in PR #142 + PR #144

**User list scoping resolved in PR #142** (`1a7526c`, `fix(services): enforce UM unit scoping on user list (SHAKEDOWN-002)`).

**Submission scoping + aria-label resolved in PR #144** (`1db8a67`, `fix(services): enforce UM unit scoping on submissions + Master Sheet aria-label (SHAKEDOWN-002B)`).

**Root cause (confirmed across both PRs):** PR #142's Phase 1 audit scoped to user-list queries only. Three separate unscoped paths leaked cross-unit data to the UM:
1. `managerService.getTenantUsers` — Master Sheet name map. **Fixed in PR #142.**
2. `agentManagementService.getAllUsers` — Team tab agent list. **Fixed in PR #142.**
3. `managerService.getWeeklySubmissions` — Master Sheet row data. **Fixed in PR #144.**
4. `managerService.getAllYTDSubmissions` — Production Report + Manager Dashboard YTD data. **Fixed in PR #144.**

**Fix shape (submissions, PR #144):** Submissions don't carry `unitId`, so the `where('unitId','==',callerUid)` pattern from #142 couldn't be applied directly. Instead: service reads `auth.currentUser.getIdTokenResult()`, UM path fetches agent UIDs via `where('unitId','==',callerUid)` on users collection, then applies `where('agentId','in',agentUids)` on the submissions query. `getAllYTDSubmissions` UM path filters status client-side to avoid a 3-field compound index requirement. Firestore rules split submissions `allow read` into `allow get` (UM restricted via cross-doc unitId lookup) + `allow list` (partial defense-in-depth; list relies on client filter due to Firestore limitation). 10 new test cases.

**Post-merge manual smoke:** Sign in as UM, confirm Team tab + Master Sheet rows + Production Report show only own unit's agents. Sign in as BM, confirm full branch visibility preserved. Verify `aria-label="Select week"` on week picker via devtools.

---

## Bug 005 — Master Sheet week picker `select-name` CRITICAL a11y — RESOLVED in PR #144 (2026-05-14)

**Resolved 2026-05-14 in PR #144** (`1db8a67`, `fix(services): enforce UM unit scoping on submissions + Master Sheet aria-label (SHAKEDOWN-002B)`).

**Root cause:** `MasterSheet.jsx` week picker `<select>` had no accessible name — no `<label>`, `aria-label`, or `aria-labelledby`. Axe rule `select-name`. Surfaced as a CRITICAL violation in the 2026-05-14 shakedown's cat07-a11y run (T7.11), first run where cat07 reached the Master Sheet after the infrastructure errors in runs 1+2 were resolved.

**Fix:** `aria-label="Select week"` added directly to the `<select>` element at `MasterSheet.jsx:207`. XS effort — one token addition.

---

## ~~Shakedown harness — LOW opportunistic follow-ups (banked 2026-05-14)~~ (ALL RESOLVED — PR #165)

### ~~Bug 001 — Wizard screen 5 selector fragility~~ (RESOLVED — PR #165)

**Source:** Shakedown run 3 T2A.03 `cat02-role-agent`.

**Resolution:** Fixed via off-by-one navigator correction in `cat02-role-agent.mjs` T2A.03 — added pre-loop click to advance past date pre-screen before the 5-iteration loop. **Original FU hypothesis ("regex adjustment only") was incorrect**; the regex `/summary|review|submit|total/i` was fine all along. The loop entry state was wrong: T2A.02 left the wizard on the date pre-screen, so the 5-iteration loop traversed date→step1→step2→step3→step4, leaving the body check on step 4 (no "review" text). With the pre-loop click, the loop correctly traverses step1→step2→step3→step4→step5, where the "Review" button label matches the existing regex. Verified via Phase 1 code inspection (`WizardForm.jsx` line 326: `nextLabel = step === TOTAL_SCREENS ? 'Review' : 'Next'`).

### ~~Bugs 003/004 — Form validation tests~~ (RESOLVED — PR #165)

**Bug 003 (T4.02) — RESOLVED:** Fixed via navigation-blocking assertion in `cat04-form-validation.mjs` T4.02 — replaced the wrong-keyword body-text WARN (`/sunday|invalid.*date|must be sunday/i`, text that never appears because validation is silent) with a hard assertion that the wizard did NOT advance past the date input after a Next-click on an invalid (non-Sunday) date. Soft `_log('WARN...')` replaced with `throw new Error(...)` on navigation success; assertion now catches real behavior.

**Bug 004 (T4.03) — RESOLVED (stale/direct closure):** STALE. Current test already uses the correct `inputValue()` check — fills 'abc', reads back the field value, warns only if 'abc' appears (i.e., filtering didn't happen). This is exactly the "assert absence of invalid input" pattern the original FU called for. No code change required. Verified via audit on 2026-05-15.

### ~~Bug 006 — Screenshot dossier 79/80 captures~~ (RESOLVED — PR #165, auto-closed via Bug 001)

**Source:** Shakedown run 3 T8.ALL `cat08-screenshot-dossier`.

**Resolution:** Cat08's wizard walk (lines 86–100) had the same off-by-one navigator as `cat02` T2A.03 — the 5-iteration loop started immediately after `submitBtn.click()`, with the wizard on the date pre-screen. The loop traversed date→step1→step2→step3→step4, so the step5 screenshot was never taken (79 instead of ≥80). Fixed in the same PR via the matching pre-loop click. Screenshot count now reaches the ≥80 target.

---

## SHAKEDOWN follow-ups — future optimization items (LOW, banked 2026-05-14)

Two architecture improvements banked during SHAKEDOWN-002B Phase 1 ack.

### ~~Cache UM agent UIDs per session~~ (RESOLVED in PR #146)

**Resolved 2026-05-14** — module-scoped `Map<"${tenantId}:${callerUid}", string[]>` in `managerService.js`, populated by a new private `getCallerAgentUids` helper used by both `getWeeklySubmissions` and `getAllYTDSubmissions`. Invalidation via exported `clearAgentUidCache()`, called from `AuthContext` sign-out path (else branch of `onAuthStateChanged`). 6 new cache-coverage tests added (cache miss, cache hit, clear, per-user keying, provisioning filter, cross-function reuse). Existing #144 `beforeEach` hooks each gained one `clearAgentUidCache()` call for test isolation — no assertion or fixture changes.

~~**Scope:** The `unit_manager` path in `getWeeklySubmissions` and `getAllYTDSubmissions` each issue a `getDocs` call to fetch agent UIDs before querying submissions. On the Master Sheet surface, both functions are called in the same `useEffect` (or close together) — 2 round-trips per data load.~~

~~**Future optimization:** cache the UM's agent UID list in session state (e.g. React context or a module-level memo keyed by `[tenantId, callerUid]`) so the agent-lookup read is issued once per session rather than once per submission-fetch. Net: one fewer Firestore read per Master Sheet load and per Production Report load.~~

~~Not urgent — at pilot scale the extra read costs fractions of a cent. Revisit if unit sizes grow or Firestore billing becomes material.~~

### ~~Denormalize `unitId` onto submission docs~~ (RESOLVED in PR #147)

Shipped in PR #147: `unitId` denormalized onto all three submission write paths (`saveDraft`, `submitReport`, `aggregateCurrentWeekDaily`). Service layer simplified to direct `where('unitId', '==', callerUid)` queries. Rules tightened from partial to full defense-in-depth (`allow list` now enforces UM scoping). Agent-uid cache from #146 removed (Path A). Backfill script at `scripts/backfill/denormalize-submission-unitId.mjs`.

### Delete tenant_admin historical test submissions (LOW, backfill cleanup)

5 test submissions exist in `tenants/tatillife_south/submissions/` for uid `4GeeZbhZBwdtGOLoJoggf4MQo142` (Kyron Marchan, tenant_admin — formerly super_admin). These are artifacts of early testing with Kyron's own account. Tenant admins don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

### Delete branch_manager historical test submissions (LOW, backfill cleanup)

4 test submissions exist in `tenants/tatillife_south/submissions/` for uid `x8Zfg2TI1yf8JOljqxCsJszxnx93` (Test Branch Manager, branch_manager). These are artifacts of testing BM role flows. BMs don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

---

## HIGH-priority — sales_manager onboarding regressions (surfaced 2026-05-07)

Three production-affecting bugs discovered while provisioning the missing test
accounts for B4's all-roles preview matrix. All three are likely regressions from
the May 5 roles refactor and should land before the Tatil pilot demo.

### HIGH#1 — User-creation flow does not send password reset email — RESOLVED in PR #57 (2026-05-08)

**Resolved 2026-05-08 in PR #57.** Root cause confirmed: the `createUser`
Cloud Function called `admin.auth().generatePasswordResetLink(email, ...)`,
which only returns a link string and does **not** dispatch any email. The
Admin SDK has no equivalent of `sendPasswordResetEmail`, and no email
transport (nodemailer, SendGrid, Firebase Trigger Email Extension) was
wired up — so the link was generated and discarded. The companion
`functions/index.js:398` Sunday-nudge stub revealed the same gap in a
different code path.

**Fix shape:** dispatch the password-reset email client-side from
`src/services/agentManagementService.js` using `sendPasswordResetEmail`
from the Auth SDK — the same primitive the user-initiated forgot-password
flow already uses, which hits Firebase's hosted email-template service.
Server-side `generatePasswordResetLink` deleted. Return shape extended to
`{ success, uid, emailSent, emailError? }` so the caller distinguishes
"fully provisioned" from "provisioned but email failed" and offers Retry.

**UI:** `UserManagementPanel.jsx` toast refactored to typed object
(`{ kind: 'success' | 'warning', ... }`) with a dedicated warning state
that shows a Retry button when the email dispatch fails post-creation.

**Server-side hardening tracked separately as HIGH#5 below** (Trigger
Email Extension or transport) — closes the same gap for the Sunday-nudge
stub and removes the client-side dependency for create-user delivery.

**Test-infra restoration tracked as Test Infrastructure (MEDIUM)** below —
Vitest install + the regression spec described during the original HIGH#1
triage was deferred so the P0 fix could ship without expanding scope.

---

**Original triage notes (kept for reference):**

**Reproducer:** Tenant Admin → Team tab → Add User → fill the form → Save. The
Firebase Auth user is created (and the Firestore doc is written), but no
"Set your password" email is dispatched to the new user. The created user has
no way to set their initial password without intervention.

**Workaround that was in use:** Firebase Console → Authentication → click the
new user → three-dot menu → "Reset password" — this dispatched the email
manually.

Priority was **HIGH** (pilot-blocking — Tatil cannot onboard managers/agents at
scale without this). Surfaced during B4 provisioning.

### HIGH#2 — UI role-to-label map is missing `sales_manager` → "Unknown" displayed — RESOLVED in PR #55 (2026-05-08)

**Resolved 2026-05-08 in PR #55** (commit `7264cc2`, shipped as part of the
B5 tenant-admin company-config surface). Single-line addition to
`src/utils/formatters.js:13` — `sales_manager: 'Sales Manager'` now lives
in `ROLE_LABELS` and `getRoleLabel('sales_manager')` returns the correct
label across TopBar, User Roster, and any other consumer.

---

**Original triage notes (kept for reference):**

**Symptoms:** When logged in as a `sales_manager`, the dashboard header role
label and the User Roster (Tenant Admin → Team tab) both display "Unknown"
instead of "Sales Manager." Underlying Firestore data is correct
(`role: "sales_manager"` is stored properly). This is purely a UI lookup-table
gap.

**Verified site:** [`src/utils/formatters.js:8-16`](../src/utils/formatters.js).
The `ROLE_LABELS` dict maps `tenant_admin` / `platform_admin` /
`branch_manager` / `unit_manager` / `agent` — and **omits** `sales_manager`.
`getRoleLabel(role)` falls through to the `?? 'Unknown'` default for that
one role. Fix is a single-line addition:

```js
export const ROLE_LABELS = {
  tenant_admin:   'Tenant Admin',
  platform_admin: 'Platform Admin',
  branch_manager: 'Branch Manager',
  unit_manager:   'Unit Manager',
  sales_manager:  'Sales Manager',  // ← add this line
  agent:          'Agent',
};
```

**Scope verified narrow (per HIGH#3 verification — see below).** Only
`sales_manager` is missing from the map; no companion "audit other unhandled
roles" sub-task is needed.

Priority: **HIGH** (visible in TopBar to every sales_manager session).
Surfaced during B4 provisioning. Single-line fix; safe to ship as a
standalone micro-PR before the pilot demo.

### HIGH#3 — Verify whether the role-label map gap also affects `tenant_admin` and `platform_admin` — RESOLVED, scope narrow

**Verified during B4 production walkthrough (5 roles × commit `412a681`,
2026-05-08, `agencytrack.vercel.app`).** All five roles' TopBar role-label
crumbs were inspected via the captured `verification/walk/design-v2-b4_production_<role>_dashboard-light_*.png`
screenshots:

| Role            | TopBar role-label crumb | Status |
|-----------------|-------------------------|--------|
| `agent`         | (n/a — agent's crumb shows the week date, not the role label; sidebar foot would render `Agent` from the same map) | ✅ mapped |
| `unit_manager`  | "Unit Manager"          | ✅ correct |
| `branch_manager`| "Branch Manager"        | ✅ correct |
| `sales_manager` | "Unknown"               | ❌ HIGH#2 |
| `tenant_admin`  | "Tenant Admin"          | ✅ correct |

`platform_admin` was not exercised (no test account in the pilot tenant —
Kyron is the only platform_admin, his account holds the production claim).
The `ROLE_LABELS` source confirms `platform_admin: 'Platform Admin'` is
mapped, so it would render correctly when surfaced.

**Outcome: scope confirmed narrow to `sales_manager` only.** HIGH#2 fix
remains a single-line addition to `ROLE_LABELS`. This item closes; no
companion follow-up needed.

> **Anomaly observed (does not change HIGH#2's scope):** the agent
> production walkthrough screenshot shows the sidebar-foot role label as
> "Unknown" while the agent role IS in the `ROLE_LABELS` map. Likely a
> transient render where `useAuth().role` is briefly undefined before
> custom claims hydrate, so `getRoleLabel(undefined)` falls through to the
> default. Worth a separate small investigation if it persists post-pilot
> (e.g. add a render-gate on `userProfile?.role` before the sidebar foot
> renders, or change the default to a more graceful empty-string). Not
> tracked as a new HIGH item — file separately if it reproduces consistently.

---

## HIGH#4 — Programmatic walkthroughs miss state-persistence interactions (surfaced 2026-05-08)

**What surfaced:** the post-B4 P0 sidebar-collapse bug (PR #56) — collapse
toggle and sign-out both `display: none` in the collapsed state, with the
collapsed state itself persisted via `localStorage.agencytrack-sidebar-collapsed`.
B4's full preview matrix (5 roles × 4 breakpoints × 2 themes = 40 cells)
plus the agent walkthrough plus the post-merge production walkthrough all
PASSED — yet the bug was a one-click reproducer.

**Why every existing check missed it:** every walkthrough exercised
*default state only* — `localStorage` empty, `html.sidebar-collapsed` not
set, sidebar always expanded at desktop. The bug lives behind a state
transition that no automated check ever performed.

**Class of bugs this misses:** any UI failure mode that hides only after a
toggleable persistent state is set — collapsed sidebar, dark mode (the
toggle is a different actor; once persisted across reloads, no one had
verified the toggled-state surfaces don't break in unexpected ways), any
future `localStorage.agencytrack-*` flag, future tenant-admin "advanced"
toggles in Track C. Anything reachable only via interaction.

**Lesson and remediation:**
- The verification template for future Track C/D PRs should include a
  *persisted-state cycle* step: set the state, reload the page, verify
  the persisted state behaves correctly (interactive controls reachable,
  no contrast regressions, focus order intact).
- The fix for this bug already lands a sidebar-22a/b/c regression block
  in `scripts/exploration-walk.cjs`. That pattern (cycle + assertions)
  generalises — adopt it for any new persisted UI state.
- Consider extending `exploration-walk.cjs` with a `--persisted-state`
  flag that runs the regular walk twice: once with empty localStorage,
  once with a baseline of `agencytrack-dark=1` and
  `agencytrack-sidebar-collapsed=1` pre-seeded. Same role, two passes,
  surfaces this whole class.

Priority: **HIGH** (a P0 of this exact shape escaped a multi-PR-batch
verification gate; the next one is unbounded). Not pilot-blocking — PR
#56 closes the sidebar-specific instance — but the prevention step
(walkthrough template change) lands before the next big surface PR.

---

## HIGH#5 — Server-side email infrastructure — RESOLVED in PR #133 (2026-05-13)

**Resolved 2026-05-13 in PR #133** (`5ca6ea6`,
`feat(email): PR-D — server-side email infrastructure (HIGH#5)`). Shipped:

- Firebase Trigger Email Extension installed (`8f030d0 chore(extensions): install firestore-send-email + gitignore extension config`).
- `mail/` collection rules locked to Cloud Function writes only (`0cb6cfc feat(firestore): PR-D — lock mail/ collection to CF writes only`).
- Email templates + render helper (`3be983b feat(email): PR-D — email templates and render helper`).
- `doCreateUser` saga writes `mail/` doc post-claims-commit (`c23e624 feat(functions): PR-D — server-side email via Trigger Email Extension`). Companion Sunday-nudge stub replaced with `mail/` writes per missing agent.
- Client-side `sendPasswordResetEmail` removed from `agentManagementService.createUser` (`f167708 refactor(email): PR-D — remove all client-side email dispatch`). Return shape collapsed back to `{ success, uid }` once dispatch was reliably server-side.
- Troubleshooting runbook at `docs/runbooks/pr-d-email-troubleshooting.md` (`fb2a0be docs(runbooks): PR-D — email troubleshooting runbook`).

**R1 (domain authorization gap) surfaced and was resolved same day.** Pre-PR-D
mail dispatches sat in `mail/` with `error: "Email did not validate"` until
`sendgrid.net` / the configured sender domain were authorized. Documented
in the runbook; pilot tenant authorized before PR-F.

**Open follow-up tracked separately:** `doCreateUser` step E-2 `emailQueued`
truthfulness gap (PR #134 banking) — see entry below.

---

**Original triage notes (kept for reference):**

**Scope:** Wire up a single piece of server-side email infrastructure that
covers BOTH outstanding email gaps in the codebase:

1. **Create-user reset-email fallback.** HIGH#1 fix dispatches the
   password-reset email from the client (`agentManagementService.createUser`
   → `sendPasswordResetEmail`). That works, but it depends on the
   tenant-admin's browser staying online through the dispatch. A flaky
   network at the moment of submission means the auth user exists but no
   email lands; the UI's Retry button is the human-in-the-loop fallback.
   Server-side dispatch is more reliable.
2. **Sunday-nudge reminder email** (`functions/index.js:398-399`). Stub
   left by the original author — `// Email stub — wire up nodemailer or
   Firebase Extension here when ready` — currently the nudge writes only
   an in-app notification, no email goes out.

**Recommended approach:** install the **Firebase "Trigger Email" Extension**
(watches a `mail/{docId}` collection in Firestore; renders templates and
dispatches via Firebase's SMTP). One install + template config covers both
flows by writing a `mail/...` doc from each call site:

- `functions/index.js` — replace HIGH#1 fix's client-side dispatch with a
  `mail/` doc write inside the `createUser` saga (after auth user + claims
  + Firestore doc are committed). Once verified, remove
  `sendPasswordResetEmail` from `agentManagementService.createUser` and
  swap the UI toast back to a single success state.
- `functions/index.js:398-399` — replace the stub comment with a `mail/`
  doc write per missing-agent in the Sunday-nudge `Promise.all`.

**Alternatives considered:** nodemailer + SMTP creds (adds dependency +
secret rotation surface), SendGrid/Resend SDKs (adds vendor + API key).
The Firebase Extension has the lightest operational footprint for a single-
tenant SaaS at this scale.

**Acceptance:**
- `mail/` collection has Firestore rules locked to function writes only.
- Templates exist for both flows (reset, nudge) with light/dark-aware HTML
  + plain-text fallback.
- `agentManagementService.createUser` returns `{ success, uid }` again
  (no `emailSent` field needed once dispatch is server-side and reliable).
- `UserManagementPanel.jsx` toast collapses back to a single success state.
- Sunday-nudge logs include both in-app-notif count and email-dispatch count.

Priority: **HIGH** (post-pilot if pilot succeeds; pre-pilot if Sunday-nudge
adoption matters). Closes two gaps with one install. Do not bundle with
HIGH#2 or any other open HIGH item — separate PR.

---

## HIGH#7 — `aria-hidden="true"` on modal backdrop wrappers hides dialog from a11y tree — RESOLVED in PR #63 (2026-05-08)

**Resolved 2026-05-08 in PR #63** (commit `2932cfa`,
`fix(a11y): remove aria-hidden from modal backdrop wrappers`). Single-token
deletion at each site; `aria-modal="true"` on the inner `role="dialog"`
correctly carries modal semantics on its own.

---

**Original triage notes (kept for reference):**

**Scope:** Two bulk-import modals have `aria-hidden="true"` on their outermost backdrop `<div>`:

- `src/components/admin/BulkImportUsersModal.jsx:288`
- `src/components/admin/BulkImportGoalsModal.jsx:295`

The outer backdrop being `aria-hidden` hides the entire subtree — including the inner `role="dialog" aria-modal="true"` — from the accessibility tree. Screen reader users cannot navigate into or interact with the dialog at all. The `aria-hidden` attribute was copied from an earlier pattern and is incorrect here; `aria-modal="true"` on the inner dialog is the correct way to communicate modal semantics.

**Fix:** Delete the `aria-hidden="true"` token from both lines — a single-token deletion at each site. No structural changes needed; `aria-modal="true"` on the inner `role="dialog"` already handles the semantics correctly.

**Confirmed by:** extended C3 verification (2026-05-08) — `getByRole('dialog')` returned nothing on the default a11y traversal; only a CSS-selector fallback (`[role="dialog"][aria-labelledby="..."]`) could reach the dialog. Verified in both `BulkImportUsersModal.jsx:288` and `BulkImportGoalsModal.jsx:295`.

**Shipped as:** PR #63 — `fix/aria-hidden-modal-wrappers`. Regression script `verification/aria-modal-regression.cjs`: 10/10 assertions pass on preview. Before/after screenshots at `verification/aria-fix-shots/`.

Priority: **HIGH** (pre-pilot — modal is completely inaccessible to screen reader users as-is).

---

## HIGH#6 — TenantAdminDashboard YTD composite index missing — RESOLVED in PR #131 (2026-05-12)

**Resolved 2026-05-12.** Index created manually in Firebase Console per the
prescribed fix below (no code change). Verified live in PR #131 (`a3de48b`,
`chore(firestore): mirror production composite indexes in firestore.indexes.json`):
*"The index was created manually in Firebase Console and is verified live by the
YTD tile rendering correctly in production."* Phase 2 smoke (2026-05-15) confirms:
Total API · YTD tile renders **TTD 25,123**, console free of `failed-precondition`.
FU row closed in PR #160 (`1d4f194`).

---

**Original triage notes (kept for reference):**

**Scope:** `TenantAdminDashboard.jsx` aggregates Total API · YTD via
`getAllYTDSubmissions()` in `src/services/managerService.js`. The query
needs a Firestore composite index that has not been created yet —
production console logs a `failed-precondition` error with an
auto-generated index URL the first time tenant_admin loads the
Dashboard tab. The stat tile renders `—` instead of a value.

Pre-existing from B5 (PR #55), surfaced during C1's preview walkthrough
(PR #60). Not C1's regression — the surface that exposes the query
landed before C1.

**Fix:**
1. Tenant_admin loads `https://agencytrack.vercel.app` in production.
2. Open browser console, copy the auto-generated index URL from the
   `failed-precondition` error.
3. Open the URL in Firebase console; click **Create**.
4. Wait for index to finish building (~2–5 minutes for the current data
   volume).
5. Reload Dashboard; confirm Total API · YTD renders a real value.

No code change required. Acceptance is verified by Dashboard rendering
the YTD value end-to-end.

Priority: **HIGH** (UX gap on tenant_admin's primary surface; near-zero
effort fix). Knock out manually whenever convenient — does not require a
PR.

---

## (unitId, weekStarting) composite index — production deploy status verified — RESOLVED (docs-only, 2026-05-15)

**Resolved 2026-05-15 (docs-only, no source-change PR required).**
- **Outcome:** (a) — index deployed and matches repo entry.
- **Production verification:** Firebase Console → Firestore Database → Indexes → Composite.
  Index on submissions: `unitId ASC + weekStarting ASC`. Index ID `CICAgJj7z4EK`.
  Status: **Enabled**. Verified by Kelsean via Console on 2026-05-15.
- **Audit note (FU text correction):** original FU body was imprecise. It claimed both
  `getWeeklySubmissions` and `getAllYTDSubmissions` "use unitId + range on weekStarting
  for the UM path." Correction: only `getAllYTDSubmissions` uses a range filter on
  `weekStarting`. `getWeeklySubmissions` uses equality on both `unitId` and `weekStarting`,
  which Firestore serves via single-field auto-indexes without requiring this
  composite. The composite would serve `getWeeklySubmissions` but its absence would
  not produce a `failed-precondition` error.

---

**Original triage notes (kept for reference):**

**Scope:** `firestore.indexes.json:59-72` (PR #147, commit `5434afe`,
2026-05-13) adds a composite index `submissions: unitId ASC + weekStarting ASC`
to support the `unit_manager` path of `getAllYTDSubmissions()` in
`managerService.js`. This index was added to source but there is **no evidence
of a manual production deploy** following PR #147.

If undeployed, the first `unit_manager` who opens the Master Sheet or Production
Report will hit a `failed-precondition` console error on the `getAllYTDSubmissions`
and `getWeeklySubmissions` calls (both use `unitId` + range on `weekStarting` for
the UM path).

**Audit + fix (if needed):**
1. Confirm deploy state: Firebase Console → Firestore → Indexes → verify
   `submissions (unitId ASC, weekStarting ASC)` exists and is **Enabled**.
2. If missing: copy the auto-generated index URL from a live `unit_manager`
   console error (or create manually from Firebase Console). Click **Create**.
   Wait ~2–5 min. Confirm with a UM-credentialed smoke.
3. `firestore.indexes.json` already has the entry — no source change needed;
   this is a production-state-only deploy.

Surfaced adjacent to HIGH#6 during the HIGH#6 closure audit (2026-05-15).
Different surface (unit_manager role), different index — kept as a separate
FU per Rule 9 same-category gate.

Priority: **MEDIUM** (pilot postponed indefinitely, reducing immediate
exposure — but silent `failed-precondition` failure on first UM access is
real once pilot resumes). Does not require a PR.

---

## Migrate EditConfigModal + BranchEditorModal to useFocusTrap (LOW, filed during C2)

**Scope:** C2 introduces `src/hooks/useFocusTrap.js` (extracted per the
SS-2 commitment from C1's audit — third consumer triggers extraction).
C2 consumes the hook in `BulkImportUsersModal.jsx` only; `EditConfigModal.jsx`
(B5) and `BranchEditorModal.jsx` (C1) stay on inline-duplicated focus-trap
scaffolding to keep C2's blast radius narrow.

**Fix:** When EditConfigModal or BranchEditorModal is next touched for any
reason (bug fix, behavior change, etc.), migrate it to consume
`useFocusTrap` in the same PR. Each migration drops ~25 lines of inline
useEffect scaffolding and replaces with a one-line hook call.

Priority: **LOW**. Both modals are battle-tested; opportunistic refactor
only. Do not open a standalone PR — fold into the next PR that has a real
reason to touch the file.

---

## F3 — `BulkImportUsersModal.jsx:244` error-code map missing `internal` — RESOLVED in C3 (alongside-fix)

**Surfaced** during C2 production walkthrough. The error-code → friendly-
message map at `BulkImportUsersModal.jsx:244` handles `unavailable`,
`deadline-exceeded`, and `cancelled`, but not `internal`. Firebase
Functions returns `internal` on aborted / network-failed Callable requests
that don't hit a more-specific error code, so the user sees the raw
error string instead of the friendly "Couldn't reach the server" copy.

**Fix:** add `'internal'` to the same friendly-message branch alongside
`'unavailable'` / `'cancelled'` / `'deadline-exceeded'`. ~3 line change.

**Resolved 2026-05-08 in C3** as an alongside-fix — the new
`BulkImportGoalsModal.jsx` mirrors the same error-code map shape and
includes `'internal'` from the start; the C2 modal got the same line
added.

---

## Permanent test-data cleanup utility (MEDIUM, surfaced 2026-05-08 during C3)

**Scope:** C2's verification used a one-off cleanup script
(`scripts/cleanup-c2-test-users.cjs`, run by Kyron with `--dry-run` →
review → live). C3's verification embeds the same pattern directly in
`verification/c3-goals-shots.cjs` with a built-in batch-id-match guard
(`csvImportBatchId === TEST_BATCH_ID` check before each `deleteDoc`).

The pattern is reusable enough to formalize as a permanent utility:
`scripts/cleanup-test-records.cjs` with `--dry-run`, `--collection=<name>`,
`--batch-id=<uuid>`, and `--email-pattern=<regex>` flags. Defensive
batch-id-match guard always on. Replaces ad-hoc per-PR cleanup scripts
(C2 had its own; C3 embedded; future bulk-import PRs would otherwise
each grow their own).

**Fix shape:** scaffold the script at `scripts/cleanup-test-records.cjs`
modeled on the C3 verification script's cleanup phase. firebase-admin
require path follows the CLAUDE.md tooling note
(`require('../functions/node_modules/firebase-admin')` or run from
`functions/`). Document at the top of the script: NEVER run without
`--dry-run` first; NEVER bypass the batch-id-match guard.

Priority: **MEDIUM**. Only useful when the next bulk-import PR ships;
defer until then. Until then, copy the inline pattern from
`verification/c3-goals-shots.cjs`.

---

## Extract `CsvImportModalShell` (MEDIUM, surfaced 2026-05-08 during C3)

**Scope:** C3 is the second consumer of the four-step bulk-import wizard
pattern (Step indicator → file picker → preview table → progress →
summary). The SS-2 commitment from C1 says wait for the third consumer
before extracting a shared shell. C3 honors that — copies from
`BulkImportUsersModal.jsx` precedent — and files this for the third
consumer threshold.

**Pieces to extract** when the third consumer lands:
- `StepIndicator` component (4-step `<ol aria-label="Import progress">`
  with `aria-current="step"` semantics).
- `StatusPill` component (valid / warning / error pill with Lucide
  icon + tokenized colors).
- Four-step state machine wrapper (`step` state + `setStep`).
- `CancelConfirmDialog` mid-flight pattern (`role="alertdialog"` +
  Escape-handling delegated via `escapeDisabled` flag on parent's
  `useFocusTrap`).
- Template-CSV download CTA wiring (`Papa.unparse` + `downloadCSV`).
- Error-CSV download CTA wiring (filtered failures + `Papa.unparse`).

**Likely third consumers:** bulk persistency entry, bulk activity
entry, bulk campaign creation. Until then: copy-from-precedent is
acceptable.

Priority: **MEDIUM**. Only meaningful when the third consumer
materializes.

---

## Goal-doc audit-field naming inconsistency (LOW, surfaced 2026-05-08 during C3)

**Scope:** `unitGoals` and `branchGoals` write `setAt` as the audit
timestamp; the personal-commitment doc (under the same `goals`
collection) writes `updatedAt`. The inconsistency predates C3 — both
patterns ship via the existing `goalsService.js`. C3 deliberately keeps
`updatedAt` for personal commitments to stay consistent with the existing
`setGoals` write (the field that downstream readers — `getGoalHierarchy`,
`CareerPortal` — already consume).

**Fix shape (when undertaken):**
- Pick one canonical name. `updatedAt` is the more conventional Firestore
  audit field; `setAt` is project-specific.
- Migrate the `unitGoals` and `branchGoals` writers to write both fields
  during a transition window, then drop `setAt` after readers are
  migrated.
- Or: live with the inconsistency — neither field name is wrong, they
  just differ.

Priority: **LOW**. Cosmetic. No reader is broken; the inconsistency is
historical.

---

## Test Infrastructure (MEDIUM, surfaced 2026-05-08 during HIGH#1 fix) — FULLY RESOLVED in PR #138 (2026-05-13)

**Fully resolved 2026-05-13 in PR #138** (`261b9ec`,
`test(infra): close test infra MEDIUM — agentManagementService specs + CI test step`).

All outstanding pieces shipped:

- `src/services/__tests__/agentManagementService.test.js` — 5 regression tests covering the wrapper layer:
  1. Happy path — CF returns `{ uid, emailQueued: true }`; wrapper returns unchanged.
  2. Email-dispatch failure — CF returns `{ uid, emailQueued: false, emailError }` (PR #136 guard); wrapper returns unchanged.
  3. Callable rejection — CF throws; wrapper propagates the error.
  4. Explicit `emailQueued: true` assertion (named-spec coverage).
  5. Explicit `emailQueued: false + typeof emailError === 'string'` assertion (named-spec coverage).
- `.github/workflows/ci.yml` — `npm test -- --run` step added after lint, before build. Test failures now block PRs.
- Suite grows from 48 files / 603 tests → 49 files / 608 tests (verified locally).
- The PR itself is the first CI run with the new test step — serves as self-test.

---

**Original triage notes (kept for reference):**

**Scope:** Install Vitest + add the first regression test, restoring the
unit-test layer that was deferred from the HIGH#1 fix (PR #57) so the P0
could ship without expanding scope. The repo currently has zero unit-test
infrastructure — only emulator scripts (`functions/scripts/test-pr2-emulator.cjs`,
`scripts/test-b5-config-rule.js`, `scripts/test-sec10-rule.js`). CI runs
`lint + build` only.

**Install steps:**
- Add `vitest` to `devDependencies`.
- Add `vitest.config.js` at repo root with jsdom env (or node env if no DOM
  needed for service tests) and path aliases matching Vite config.
- Add `"test": "vitest"` to `package.json` scripts (and `"test:run": "vitest run"`
  for one-shot CI).
- Plumb into `.github/workflows/ci.yml` — add a `test` step running
  `npm run test:run` after `lint` and `build`.
- Place tests in `src/services/__tests__/` (or co-located `.test.js` next
  to source — pick one convention and document in CLAUDE.md).

**First regression spec — `agentManagementService.createUser`:**

Test cases (all mocking the Firebase callable + Auth SDK):

1. **Email-dispatch happy path** — mock `httpsCallable` to return
   `{ data: { success: true, uid: 'u1' } }`; mock `sendPasswordResetEmail`
   to resolve. Assert:
   - `sendPasswordResetEmail` called exactly once with `(auth, 'new@user.com')`.
   - Return value equals `{ success: true, uid: 'u1', emailSent: true, emailError: undefined }`.
2. **Email-dispatch failure path** — mock callable to resolve normally;
   mock `sendPasswordResetEmail` to reject with
   `Error('auth/network-request-failed')`. Assert:
   - `sendPasswordResetEmail` still called exactly once.
   - Return value equals `{ success: true, uid: 'u1', emailSent: false, emailError: 'auth/network-request-failed' }`.
   - No exception thrown to caller (the auth user IS created — throwing
     would mislead the UI).
3. **Callable-rejection path** — mock callable to reject. Assert the
   error propagates (so the inline drawer error keeps working). Email
   dispatch is NOT attempted.

**Why this test specifically:** guards the exact silent-failure mode HIGH#1
masked. If a future refactor removes the `sendPasswordResetEmail` call (or
swaps it for the dead `generatePasswordResetLink` again), test 1 fails
loudly. If a future refactor accidentally throws on email failure, test 2
fails. Cheap to write, high specificity.

Priority: **MEDIUM**. Not pilot-blocking. Cite "surfaced during HIGH#1 fix
(PR #57)" in the install PR description so future readers can trace the
scope decision.

---

## Resend invite UI (MEDIUM, surfaced 2026-05-08 during HIGH#1 fix) [RESOLVED PR #215, 3690bf6]

**Scope:** Add a per-row "Resend invite" button on the user-management
list. When the create-user flow's email dispatch fails (or when an admin
realises a user never got the original email — lost-in-spam case), the
admin currently has no recourse short of recreating the user. The
inline Retry button on the post-create toast (HIGH#1 fix, PR #57) only
covers the immediate post-creation moment; once the toast dismisses, the
fallback is gone.

**Wiring:**
- `UserManagementPanel.jsx` — per-row dropdown / overflow menu next to
  the existing Deactivate button. "Resend invite email" entry visible
  for any active user (or any user without a `lastSignInTimestamp`).
- Handler calls the same primitive (`sendPasswordResetEmail(auth, email)`),
  surfaces success/failure in the existing toast.
- Once HIGH#5 (server-side email) lands, swap to a `mail/` doc write
  triggered through a callable wrapper.

**Edge case:** confirm whether re-sending a reset email invalidates the
previous link. Firebase Auth invalidates each prior reset link when a new
one is generated for the same user — the UI should clarify "Previous
reset email link will stop working." in a confirm dialog.

Priority: **MEDIUM**. Not pilot-blocking. Closes the gap when individual
emails fail. Suggested wiring: same `sendPasswordResetEmail` primitive
short-term; HIGH#5 server-side path post-migration.

**Closure (PR #215, squash `3690bf6`):** Per-row Resend invite button shipped on `UserManagementPanel.jsx` action cell, between Edit and Deactivate. Client-side path via `sendPasswordReset()` from `authService.js` (short-term per FU body); long-term server-side `mail/` doc swap deferred as a separate follow-up below. ConfirmDialog uses banked edge-case copy "Previous reset email link will stop working." Visibility gated on `canAct && !isInactive` (mirrors Edit-row pattern). aria-label="Resend invite email to {u.name ?? u.email ?? 'user'}" applied from the start — pre-empts a future aria-label sweep finding. 3 buttons always on row — kebab/responsive pattern deferred to a future dedicated mobile-manager pass (when MasterSheet, SettlementPanel, and these action rows all need it together). 2 new tests added in `src/components/manager/__tests__/UserManagementPanel.test.jsx` covering visibility gate + confirm-then-send flow with appropriate `waitFor` discipline (avoids CI-race pattern from PR #210).

**Q3 revision banked in Phase 1 surface (Rule 11 corrected-diagnosis preservation):** Original dispatcher Q3 was "yes, audit log entry mirroring `auditAdminEmailUpdates`." Phase 1 source-verification surfaced that no audit service module exists — the only existing pattern is an **inline** `addDoc` in `authService.js:50-58` writing to a **top-level** `auditAdminEmailUpdates` collection in a **self-service shape** (`uid === initiatedByUid`). For a "different actor + different target" resend, a new sibling `auditInviteResends` collection would need a dedicated function, a two-actor document shape, and a Firestore rules entry permitting write from tenant_admin/branch_manager/sales_manager + read from platform_admin. That rules infrastructure work expands MVP scope significantly. **Dispatcher revised Q3 to: audit log DEFERRED** — banked as a separate LOW follow-up below alongside the server-side `mail/` doc consistency swap. Audit log entry is not in this PR. 15th in-the-wild Rule 17 signal of the arc (audit module pattern didn't match brief assumption captured at authoring time).

---

## ✅ Resend invite: swap to server-side mail/ doc write (LOW, banked 2026-05-19) — CLOSED 2026-05-19 (PR #229, 0fdebc0)

**RESOLVED 2026-05-18.** Resend invite shipped MVP (PR #215, squash `3690bf6`) with client-side `sendPasswordReset()` (Firebase Auth default reset template). Long-term consistency with the server-side `mail/` template path that create-user uses (PR-D #133 / PR #136) requires a new Cloud Function `resendInviteEmail(uid)` that writes a `mail/` doc using the same template `createUser` emits. Trade-off: shipped MVP uses Firebase Auth's default reset template; users see different visual styling for resent vs. original invite emails. Defer to a dedicated email-template-consistency PR. Estimated size: M (CF function + callable wrapper + rule update + swap UI handler to call CF instead of `authService.sendPasswordReset`).

Priority: **LOW**. Not pilot-blocking; visual consistency only.

**Closure (PR #229, squash `0fdebc0`):** Shipped via Path B per pre-PR audit recommendation — single PR closing both #215 LOW FUs together. New `exports.resendInviteEmail` Cloud Function in `functions/index.js` mirrors `doCreateUser` step E-2 (same `buildMailDoc(...)` signature with `'password-reset.txt'` / `'password-reset.html'` templates and `'Welcome to AgencyTrack — set your password'` subject), so original and resent invite emails share visual styling. New `userService.resendInvite(uid)` wrapper mirrors `userService.callUpdateUser` httpsCallable pattern. `UserManagementPanel.jsx:418` swapped from `sendPasswordReset(email)` to `resendInvite(uid)`; `sendPasswordReset` import removed (only consumer remaining is `LoginScreen.jsx` end-user "forgot password"). FU body's "rule update" claim superseded — `mail/` rule already `allow read, write: if false`. Brief authoring drift caught in Phase 1 (Rule 17): `buildMailDoc` signature is 5 args (subject required); `createUser` CF wrapper pattern lives in `agentManagementService.js` not `userService.js` (but `callUpdateUser` provides the same mirror in userService); rules file uses inline `getRole() == 'X'` not helper functions — all in-scope Rule 9 adaptations.

---

## ✅ Resend invite: add audit log entry (LOW, banked 2026-05-19) — CLOSED 2026-05-19 (PR #229, 0fdebc0)

**RESOLVED 2026-05-18.** Resend invite shipped MVP (PR #215, squash `3690bf6`) without audit log entry. Original dispatcher Q3 was "yes, audit log entry mirroring `auditAdminEmailUpdates`" but Phase 1 source-verification surfaced that no audit module exists — the current pattern is an **inline** `addDoc` in `authService.js` writing to a **top-level** `auditAdminEmailUpdates` collection in a self-service shape (`uid === initiatedByUid`). A new `auditInviteResends` sibling collection would need: (a) a dedicated function (inline or new module), (b) a document shape supporting two-actor (actor + target), (c) a Firestore rules entry permitting write from `tenant_admin`/`branch_manager`/`sales_manager` + read from `platform_admin`. The rules work specifically expands MVP scope significantly. Deferred to a future PR that can address the audit pattern architecturally (likely alongside the `mail/` swap above, or as part of a broader audit-infrastructure pass).

Priority: **LOW**. Not pilot-blocking; recovery flow itself works without audit trail. Adds compliance/forensics surface only.

**Closure (PR #229, squash `0fdebc0`):** Shipped via Path B alongside the server-side `mail/` swap above — single PR closes both #215 LOW FUs. New top-level `auditInviteResends` collection written exclusively by the `resendInviteEmail` Cloud Function via Admin SDK; rules `allow write: if false` (mirrors `auditAdminCreations` pattern, not the client-write `auditAdminEmailUpdates` pattern). Reads: `platform_admin` unrestricted, `tenant_admin`/`branch_manager`/`sales_manager` scoped to own tenant. Audit doc shape adapted from `auditAdminCreations` with actor/target naming: `tenantId`, `actorUid`, `actorEmail`, `actorRole`, `targetUid`, `targetEmail`, `ip`, `userAgent`, `emailQueued`, `timestamp`. The `emailQueued: boolean` field was added during execution as a Rule 9 in-scope extension — accepted by dispatcher as the load-bearing CF-success signal for Option 1 verification. Audit write failure is logged but does not fail the CF call — email side effect either happened or didn't (captured in `emailQueued`). FU body's role-list "tenant_admin/branch_manager/sales_manager" expanded to include `platform_admin` (the Resend button's CREATABLE_ROLES includes it). Composite index `(tenantId ASC, actorUid ASC, targetUid ASC, timestamp DESC)` added to `firestore.indexes.json` for the smoke verification query (post-deploy Rule 9 fix, commit `cd2ef7b`).

**Verification approach (Option 1, per dispatcher decision):** Smoke verifies the `auditInviteResends` doc only (extended `resend-invite-ui-smoke.mjs` with Step 10b — Node-side Firebase Web SDK client signed in as tenant_admin, polls for matching doc by actorUid + targetUid + recent timestamp window, asserts locked shape + `emailQueued === true`). The `mail/` doc itself is unreadable from any client-side smoke (rules `allow read, write: if false`); reintroducing Admin SDK service-account-key access for smoke purposes is hard-banned per PR #78 / PR #225 posture. The audit row's `emailQueued: true` is the load-bearing signal — it attests that both `generatePasswordResetLink` AND the `mail/` doc write succeeded in the CF. Real email arrival deferred to operator inbox check per existing Step 11 pattern.

---

## Sunday-nudge actual email send (LOW, surfaced 2026-05-08 during HIGH#1 fix)

**Scope:** When HIGH#5 (server-side email infrastructure) lands, wire the
existing stub at `functions/index.js:398-399`:

```js
// Email stub — wire up nodemailer or Firebase Extension here when ready
// missing.forEach(a => sendReminderEmail(a.email, 'Report Due Tomorrow').catch(console.error));
```

Replace the commented `forEach` with `mail/` collection writes (one per
missing agent) using the template installed under HIGH#5. Surface
dispatch counts in the existing
`console.log('[sendSundayNudge] Notified ${missing.length} agents ...')`
log so ops can verify both in-app + email channels delivered.

**Companion Monday-nudge** (`exports.sendMondayNudge` immediately below)
likely has the same stub structure — apply the same fix there in the
same PR if it does.

Priority: **LOW**. Sunday-nudge currently functions via in-app
notifications; email is additive. Strictly downstream of HIGH#5 — do not
attempt independently.

---

## `doCreateUser` step E-2 silently returns `emailQueued: true` on mail/ write failure — RESOLVED in PR #136 (2026-05-13)

**Resolved 2026-05-13 in PR #136** (`89182cd`,
`fix(functions): doCreateUser emailQueued truthfulness (#134 follow-up)`).
Step E-2 catch now sets `emailQueued = false` and includes an optional
`emailError` string; the return shape is `{ success, uid, emailQueued, emailError? }`.
`bulkImportUsers` propagates `emailQueued` (+ `emailError`) into each row's
result so the Step 4 SummaryStats card "Email failed" can distinguish
"created + email sent" from "created, email never queued".
`UserManagementPanel.jsx` `CreateUserDrawer` now captures the return value and
forwards `emailQueued` into `handleCreated`, which switches to a warning toast:
*"<Role> account created, but the password reset email may not have sent.
Contact support or recreate the user if they don't receive it."*

**Two brief premises corrected during Phase 1 discovery** (documented in the PR
description, banked here for the next reviewer to find):

1. Brief's locked decision *"Existing Retry button is the recovery path — no
   new UI components"* — the Retry button was deleted in PR-D commit `f167708`
   (`refactor(email): PR-D — remove all client-side email dispatch`) because
   client-side `sendPasswordResetEmail` was removed in the same change. The
   warning toast in this fix is informational with no action button. The
   genuine recovery path is the still-unshipped "Resend invite UI"
   follow-up below.
2. Brief's NOT-in-scope line *"Bulk user import path — already handles email
   failures correctly via `dispatchResetEmails`"* — `dispatchResetEmails` was
   also deleted in commit `f167708`. Post-PR-D, bulk import inherited the same
   `emailQueued: true` lie, so the bulk path WAS in scope per the original bank.

**Open follow-up:** the "Resend invite UI" item below remains the canonical
recovery path for an email failure detected after the post-create toast
dismisses. This fix surfaces the failure; "Resend invite" gives admins a way
to actually resend.

---

## Track E — Agent + Manager Tooling Enhancements

Source: planning session with Kyron + planning-Claude, May 8 2026.
Full specs in docs/Track-E-Specs.md.

Path B sequencing chosen: E1 + E6 coupled HIGH pre-pilot. Pilot launch
shifts back ~2 weeks for clean schema + agent cadence choice at launch.

### E1 — Weekly Report Schema Split [HIGH, pre-pilot]
Split weeklyReport doc into 3 production sources: newBusiness, pppIncreases,
lumpsums. Wizard step splits into 3 sub-sections. Migration of existing
reports + API-usage audit across app. ~5 days total. Spec: Track-E-Specs.md §E1.

### E6 — Daily Input Mode [HIGH, pre-pilot, depends on E1]
Optional opt-in daily activity log. Sunday Cloud Function aggregates to
weekly wizard pre-fill. New agent.loggingMode profile field (Weekly/Daily/
Hybrid). dailyActivity subcollection uses 3-source split from day 1.
~5-7 days total. Spec: Track-E-Specs.md §E6.

### E2 — Reverse Commission Calculator [SMALL, pre-pilot opportunistic]
New "Reverse Calc" tab in Commission Playground. "How much API to sell this
month to be paid $X this month?" — accounts for Tatil modal commission timing
(annual upfront, semi/quarterly/monthly per modal frequency). New business +
first-year commissions only in v1. ~1.5-2 days. Spec: Track-E-Specs.md §E2.

### E3 — Persistency Playground — RESOLVED in PR #82 (2026-05-11)

**Resolved 2026-05-11 in PR #82.** Shipped: 6-input manual entry form (businessPlaced / notTakens / incPPPs / lumpsums100 / lapses / reinstatements) with live-derived persistency, 12-month trend chart, award-gate banner, and what-if Playground (3 recovery levers: NB / NR / Orphans). Agent self-entry and manager entry share the same `PersistencyEntryForm`; Firestore rules scoped by role. CareerPortal and `exportService` average-of-percentages bugs fixed in the same PR. Tatil monthly-report manual-entry workflow fully supported.

Rules follow-ups: PR #83 fixed persistency `allow list` list-query denial. PR #85 fixed `allow get` on non-existent docs (blocked first-time agent saves). Open follow-ups from this arc: SCOPE-1, SCOPE-2, PERF-1, TEST-N, WALK-1, BUG-N2, UX-N (all added below, 2026-05-11).

### E4 — Digital Production Report / Branch Leaderboard [MEDIUM, post-pilot, depends on E1]
Three role-based views (Unit Mgr / Branch Mgr / Sales Mgr) replacing the
weekly Friday whiteboard PDF. Live updating + Friday 4pm snapshot toggle.
Print export. Cloud Function aggregator. ~4 days. Spec: §E4.

### E5 — TV Display Kiosk Mode [SMALL, post-pilot, depends on E4]
Kiosk route for office TVs. Auto-rotating slides (production report, top 10,
agent of week, goals, award watch). Branch-scoped revocable kiosk tokens.
Privacy controls per branch. ~3 days. Spec: §E5.

---

## Wizard UX + A11y Hardening (post-Track-A audit, 2026-05-06)

- ✅ **Wizard UX hardening — CLOSED** by PR #88 (2026-05-11): retry button, Saved✓ indicator, offline-vs-failed distinction, role=alert/aria-live, persistent-failure handling. PR #124 added R1 micro-fix (Saved-while-offline semantic copy).

### ✅ Wizard polish (post-pilot) — CLOSED by PR #151 (`8a8818c`)

- ✅ **R2** — CLOSED by PR #151 (`8a8818c`): Split nested `role="alert"` inside `role="status"` into sibling live regions. Polite region carries idle/saving/saved; assertive region carries failed/offline/escalated.
- ✅ **R3** — CLOSED by PR #151 (`8a8818c`): Added `motion-reduce:animate-none` guard to `animate-pulse` on the saving indicator.
- ✅ **R4** — CLOSED by PR #151 (`8a8818c`): 2s throttle on Retry button via `lastRetryAt` ref; silent no-op on rapid re-clicks; reset on each new failure.
- ✅ **R5** — CLOSED by PR #151 (`8a8818c`): Sticky failure window (8s). `stickyError` hoisted to WizardForm; `FAILURE_STICKY_MS = 8000` named const; `visibleError` derived during render from prop + `failedShownAt` ref.

---

## Mobile audit — deferred items (from `mobile-audit-2026-05-06`)

Pilot-critical agent-flow items shipped in PR `mobile-audit-pilot-pass-1`. The
remaining items below were intentionally deferred. Audit doc: `docs/mobile-audit-2026-05-06.md`.

### Mobile follow-up #1 — Manager surface mobile pass — RESOLVED in PR #90 (2026-05-11)

`MasterSheet.jsx` (23-column grid wrapped in `overflow-x-auto`),
`SettlementPanel.jsx` (three grids), `ManagerDashboard.jsx` TabBar (still h-9),
`ManagerAwardsPanel.jsx` TabBar, `GoalsPanel.jsx` mode-tabs,
`CampaignPanel.jsx` filter tabs, `MeetingMode.jsx` (mobile-presentation
behaviour), `UserManagementPanel.jsx` rows. None of these are pilot-blocking
because Tatil managers will use desktop/tablet, but each has the same
36px tab-button + horizontally-scrolling-grid pattern that needs the same
treatment as the agent side. Estimated 1–2 days of focused work.

### Mobile follow-up #2 — Non-core agent surface P1s — CLOSED by PR #153 (9571a28)

- ✅ **P1-1** — CLOSED by PR #153 (9571a28): CareerPortal Edit/Cancel/Save buttons bumped to `h-11 px-4 text-sm` (44px). All three editing-mode siblings fixed, not just "Edit My Goals".
- ✅ **P1-2** — CLOSED by PR #153 (9571a28): already-resolved structurally (entire `AgentDashboard.jsx:722-747` History row is the `<button>` with `card` class, resolving to `p-6` ≈ 78px hit area; Eye icon is decorative inside that hit area). Original audit measured icon size (15px) not button bounds.
- ✅ **P1-3** — CLOSED by PR #153 (9571a28): CommissionPlayground accordion toggle gets `min-h-[44px]`.

**New FU banked during P1-2 audit:**
- [x] **History row aria-label** — `AgentDashboard.jsx:722-747` History row button has only "Week of {date}" as visible text; Eye icon is decorative. Add `aria-label="Preview submission from week of {date}"` (or similar) for SR clarity. Surfaced during Mobile FU#2 P1-2 closure audit; defer to a comprehensive aria sweep rather than one-off fix. [RESOLVED PR #213, 38be348]

### Mobile follow-up #3 — `bg-primary/N` opacity utilities resolve to transparent — RESOLVED in PR #132 (2026-05-12)

**Resolved 2026-05-12 in PR #132** (`0573a2c`,
`fix(theme): FU#3 — channel-split token migration for working opacity modifiers`).
Option 1 implemented: CSS variables migrated to channel form (`19d3cf3 fix(theme): channel-split CSS color tokens with derived aliases`),
Tailwind config rewritten to functional notation (`595dce5 fix(theme): rewrite tailwind config to functional notation for opacity modifiers`).
All `bg-primary/N`, `text-primary/N`, `border-primary/N` modifiers now resolve
correctly app-wide. FU#3 smoke script lives at `scripts/verification/fu3-channel-split.cjs`.

Cosmetic hardcoded-hex sites (e.g. `bg-[#01696f]/8`) were intentionally
deferred — see "Hardcoded hex literals with opacity modifier" entry at the
end of this file. Those resolve correctly without channel-split (Tailwind
decomposes literal hex at build time) but bypass the design-token system.

---

**Original triage notes (kept for reference):**

The carousel inactive dot indicators show `bg-primary/30` but the computed
`background-color` is `rgba(0,0,0,0)` because the project's Tailwind config
exposes `--color-primary` as a hex string (`#01696f`), not as space-separated
RGB channels. Tailwind 3 `<color>/<opacity>` modifier silently fails when the
source color isn't channel-split.

Likely affects every `bg-primary/N`, `text-primary/N`, etc. usage in the
codebase — needs a one-pass audit. Two options:

1. Convert the CSS variables to channel form: `--color-primary: 1 105 111`
   and switch all consumers to `rgb(var(--color-primary))`.
2. Replace `/N` modifiers with explicit `rgba()` literals (loses theming).

Option 1 is the right fix but touches every theme variable + consumer.

### Mobile follow-up #4 — P2 cosmetic items — CLOSED in PR #154 (630bac1)

- ✅ **P2-1** — CLOSED by PR #154 (630bac1): WizardForm + CampaignPanel close buttons bumped to `w-11 h-11` (44×44px). Sibling sweep included.
- ✅ **P2-2** — CLOSED by PR #154 (630bac1): already-resolved structurally. LeaderRow is non-interactive (no onClick/role/href), row height ~60px via `py-3` + content, and avatar is 36px (`size="md"`) not 40px. Tap-target rules apply only to tap targets. FOLLOW_UPS text "40×40" was a doc-accuracy gap — actual size 36px. No code change required.
- ✅ **P2-3** — CLOSED by PR #154 (630bac1): closed as already-resolved-structurally. `MotivationalCarousel.jsx` has had zero live consumers since M2 (PR #107, `46eda67`) removed it from ManagerDashboard. The hex-literal defect does not manifest because the component never renders. Dead-code deletion banked as a new LOW FU (see below).

---

## `bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep (LOW, banked during Mobile FU#4)

- ✅ **`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep** — CLOSED by PR #155 (`70c764d`): 89 utility substitutions across 28 files. `bg-[var(--color-surface)]` → `bg-card` (83), `bg-[var(--color-surface-raised)]` → `bg-card-raised` (5), `text-[var(--color-text)]` → `text-ink` (1). Computed CSS identical at full opacity (named utilities resolve to `rgb(var(--surface-channels) / 1)` vs `rgb(var(--surface-channels))` — same color when alpha=1). `border-[var(--color-border)]` outliers in WizardForm.jsx held back pending separate `border-border` resolution audit (see banked FU below).

---

## `border-border` utility resolution audit (MEDIUM, banked from arbitrary-syntax sweep) — RESOLVED in PR #156 (2026-05-14)

- ✅ **`border-border` utility resolution audit** — CLOSED by PR #156 (`1e4bdf0`): mechanism untraced because no binding existed. Audit confirmed 201 usages across 49 files were rendering Tailwind's Preflight fallback (`#e5e7eb` gray-200) instead of the warm `--color-border` theme token. Fixed via 1-line addition to `tailwind.config.js`: `theme.extend.colors.border` → `rgb(var(--border-channels) / <alpha-value>)`. All 201 named-utility usages now resolve correctly. Pattern B sites (`border-border` without width utility) banked as separate audit (see below).

---

## Pattern B `border-border` sites audit (LOW, banked from border-border resolution fix)

- [x] **Pattern B `border-border` sites audit** — Some occurrences of `border-border` in the codebase don't pair with a `border` width utility, so Preflight's `border-width: 0` keeps them invisible even after the PR #156 color-binding fix. Audit task: enumerate Pattern B sites (grep for `border-border` NOT preceded/followed by a border width class on the same element), per-site judgment whether a visible border was intended. Surfaced during the `border-border` resolution audit (PR #155 follow-up). LOW because no visual regression — sites currently render no border and continue to render no border post-PR #156; this is intentionality verification, not defect remediation. **Closure (audit 2026-05-25):** Zero Pattern B sites found. Every `border-border` occurrence in `src/` is paired with a border-width utility — either `border` / `border-t` / `border-b` / `border-l` / `border-r` on the same element. The one case that appeared ambiguous (`BranchesPanel.jsx:226-227` conditional template string) has `border` in the static part of the same template literal (line 224). No code change required.

---

## KioskShell hex literals → presentation token family (LOW, banked from arbitrary-syntax sweep)

- [x] **KioskShell hex literals → `presentation` token family** — `src/components/kiosk/KioskShell.jsx:80` and `src/components/kiosk/KioskRoute.jsx:44` use hex literals (`bg-[#1a1612]`, `border-[#4ab5b8]`, `text-[#f0ebe0]`, `text-[#b8aea0]`) for the kiosk fullscreen presentation shell. The `bg-presentation`, `text-presentation`, `bg-presentation-accent`, `border-presentation-border` token family already defined in `tailwind.config.js` appears designed to encode exactly this intent — theme-independent dark presentation surface. Migration would unify kiosk styling with the theme system. Surfaced during arbitrary-syntax sweep audit as a sibling pattern. Different category from the CSS-var-syntax sweep itself (hex literal vs `var()`) so banked separately. **Closure (PR #336, `f0a5857`):** All 5 hex literal instances migrated to presentation tokens (`bg-presentation`, `border-presentation-accent`, `text-presentation-text`, `text-presentation-muted`).

---

## CampaignForm close button missing aria-label (LOW, banked during Mobile FU#4 smoke) [RESOLVED PR #213, 38be348]

- [x] **CampaignForm close button missing aria-label** — `src/components/campaigns/CampaignPanel.jsx:283` close button has no `aria-label`; contains only a decorative `<X />` icon (no visible text). Screen-reader users hear "button" with no description. Same defect pattern as the History row aria-label gap banked from FU#2 (`AgentDashboard.jsx:722-747`). Surfaced during Mobile FU#4 P2-1 smoke walk attempting `waitForSelector('[aria-label="Close"]')` as a form-open gate — selector never resolved, confirming the label is absent. Defer to a comprehensive aria sweep rather than a one-off fix.

**Closure (PR #213, squash `38be348`):** Resolved as part of comprehensive aria-label sweep — 10 sites total (this site + History row L722-746 + 8 net-new sites from 2026-05-19 audit). `aria-label="Close campaign form"` added to the CampaignPanel close button at `src/components/campaigns/CampaignPanel.jsx:283`. Sweep covered two defect classes: Class A icon-only buttons (8 sites via `aria-label` attribute) + Class B mobile-hidden-text pattern (2 sites in ManagerDashboard via `hidden md:inline` → `sr-only md:not-sr-only` swap so visible text stays in the a11y tree at all viewports). Rule 9 in-PR scope extension absorbed a 10th site: `KioskModeTab.jsx:178-186` is an icon-only `<a>` anchor (`<ExternalLink />` + `title="Open kiosk"`) — identical defect class to Class A, adjacent in a file already in scope. Class B fix path source-verified at Phase 1: `sr-only` is idiomatic in this codebase (2 existing hits at `ActivityFeed.jsx:77` + `ProfileScreen.jsx:370`); `md:not-sr-only` is a valid Tailwind responsive variant requiring no config change.

---

## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke) [RESOLVED PR #208, 44db563]

- [x] **Delete dead `MotivationalCarousel` component** — `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC) has had zero live consumers since M2 (PR #107, `46eda67`) removed it from `ManagerDashboard` and wired `ManagerOverviewTab`. Component remains in source. Verified dead via grep (no JSX usage anywhere in `src/` outside the test file) and git log of PR #107 commit message ("Removes MotivationalCarousel + Sparkles placeholder"). Surfaced during Mobile FU#4 P2-3 smoke walk when the component could not be located in any rendered dashboard. Removal is mechanical: delete the component file. No imports remain to clean up. Defer to a dead-code-removal sweep rather than a one-off.

**Closure (PR #208, squash `44db563`):** Component file deleted at `src/components/dashboard/MotivationalCarousel.jsx` (actual ~378 LOC at deletion time; FU body's "~150 LOC" estimate was stale — file grew between Mobile FU#4 banking and this closure). No test file existed. Re-verified at execution: zero external imports / JSX usage in tracked `src/` files (one historical comment reference in `AgentDashboard.jsx:414` updated to remove the dangling component name — Rule 9 in-PR scope extension). Sweep scope was limited to this one component per locked decision; broader dead-code sweeps deferred.

---

## A11Y dark-mode story — CLOSED in PR7

PR3/PR4/PR5/PR6/PR7 collectively brought the project to **0 axe color-contrast
violations in BOTH light and dark modes** across all 8 agent + 9 manager pages,
plus MeetingMode. Token system is documented in CLAUDE.md.

If new dark-mode contrast violations surface, run:

```
node scripts/a11y-axe-scan.cjs --dark
node scripts/a11y-axe-scan-manager.cjs --dark
```

and apply the established `dark:bg-primary-dark dark:hover:bg-primary` pattern
(or extend `.dark .btn-primary` for new shared utility classes).

---

## React Compiler adoption — already documented below; left in place for context

## react-hooks/exhaustive-deps × 3 (deferred from PR3)

**RESOLVED 2026-05-15 via PR #164 (`33e44e6`).**

- `src/components/awards/AgentAwardsPanel.jsx:155` — **RESOLVED** — wrapped `now` in `useMemo([currentDate])` to stabilize the memo key. The computation `useMemo` now correctly skips recomputation when `currentDate` is stable.
- `src/components/awards/AgentAwardsPanel.jsx:168` — **RESOLVED** — eslint-disable removed; lint no longer flags the deps array after item 1 fix. (The directive was already "unused" at baseline — the violation fired at :155, not :168, so the disable never actually suppressed anything.)
- `src/components/manager/GoalsPanel.jsx:361` — **STALE — direct closure.** `onGoalsLoaded` does not exist anywhere in `src/` (verified via grep on 2026-05-15). `GoalsPanel` is zero-props (`export default function GoalsPanel()`); the dependency was removed in a prior refactor. No code change required.

---

## React Compiler adoption (long-term, conditional)

**Scope:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules disabled in
`eslint.config.js` (see Lint Policy in CLAUDE.md). If `@babel/plugin-react-compiler` is
ever adopted, re-enable those rules and refactor the ~19 data-fetch `useEffect` patterns
they flag.

- Not blocking anything; purely a note for when React Compiler reaches stable adoption
- No PR needed until the Compiler is intentionally added to the project

---

## PR-4 — Edit-user flows (user-mgmt track) — RESOLVED in PR #122 + PR #129 (2026-05-12)

**Resolved 2026-05-12.** Shipped in two PRs:

- **PR #122 (`f62955e`, `feat(users): PR-4 — edit-user flows + permission matrix`)** —
  EditUserDrawer + permission matrix for non-claim-keyed fields (name, phone,
  bio, etc.). `updateUserFields` service + Firestore rule allowlist; UI
  affordance in `UserManagementPanel`; reassignment-confirm dialog scaffolding.
- **PR #129 (`5645100`, `feat(users): PR-4b — role + branchId edits via updateUser Cloud Function`)** —
  Role and branchId edits via the polymorphic `updateUser` Cloud Function
  (claim-atomic, server-side permission matrix). EditUserDrawer wired with
  role/branchId dropdowns + permission-gated UI; `callUpdateUser` client
  wrapper with unit tests; PR-4b smoke walk.

Email changes and unitId reassignment-for-agents were deliberately deferred —
they belong to the post-pilot scope.

---

**Original scope (kept for reference):**

UserManagementPanel currently supports create + deactivate/reactivate.
Missing: editing an existing user's fields (name, email, phone, unitId reassignment).

- Add an Edit button/drawer to each user row (branch_manager and above)
- Inline edit for name, phone; modal for role reassignment (rare, requires caution)
- Email changes must go through Firebase Auth `updateEmail` (not just Firestore)
- Unit reassignment for agents: update `unitId` in both the Firestore doc and claims

---

## Branches Management UI — RESOLVED in PR #60 (2026-05-08)

**Original scope:** Branches existed as data (branchId strings in user docs) but there
was no UI to list, create, or rename branches. A branch_manager or tenant_admin could
not add a new branch without direct Firestore access.

**Shipped in PR #60 (Track C — C1):**

- New Firestore subcollection `tenants/{tenantId}/branches/{branchId}` with auto-ID
  branchIds (opaque random strings; display name only).
- Service layer `src/services/branchService.js` — `listBranches`, `getBranch`,
  `createBranch`, `updateBranch`, `setBranchActive`. Active-only branch-name uniqueness.
- `BranchesPanel` (table-style list, tenant_admin only) + `BranchEditorModal`
  (create + edit; lifts B5 EditConfigModal a11y patterns) + `DeactivateBranchConfirmDialog`.
- New `firestore.rules match /branches/{branchId}` block: tenant-scoped read for any
  signed-in user, write for `tenant_admin` / `platform_admin` only (cross-tenant guard
  for tenant_admin per B5 lesson).
- Emulator regression test `scripts/test-c1-branches-rule.js` — covers cross-tenant
  read denial, role-write denial, tenant_admin self-tenant write, platform_admin
  cross-tenant write.

**Rename behavior** (originally proposed) was descoped. Renaming a branch updates only
the branch doc; legacy `user.branchId` strings remain unmigrated. Migration is a
separate post-pilot ticket — tenant_admins re-target users via Edit User flows once
those ship (PR-4).

---

## SEC-9b — Cross-tenant isolation audit

**Scope:** Firestore rules were tightened in SEC-2/SEC-3/SEC-4 but a full cross-tenant
read audit has not been run. A malicious tenant_admin should not be able to read another
tenant's subcollections.

- Run `firebase emulators:start` + cross-tenant read probes for every subcollection
- Pay special attention to: campaigns, leaderboard, notifications, settlements
- Document results in `docs/SEC-9b-audit.md` and patch any failures

---

## tenant_admin email update path — RESOLVED in PR #148 (2026-05-15)

**Resolved 2026-05-15 in PR #148** (`20b7c72`,
`feat(profile): tenant_admin email update with re-auth + audit`).

Self-service email update flow in `ProfileScreen.jsx` for `tenant_admin` role only.
`verifyBeforeUpdateEmail` (Firebase Auth) requires current-password re-auth before
sending a verification link to the new address; email in Auth/Firestore only changes
after the user clicks the link. Firestore user doc syncs lazily via `AuthContext`
email-mismatch detection on next sign-in. Audit entries written to the new top-level
`auditAdminEmailUpdates` collection. Phase 1 caught a stale `updateEmail()` call in
the brief — `verifyBeforeUpdateEmail` is the correct safer API.

---

## Login screen logo

**Scope:** The LoginScreen (`src/components/auth/LoginScreen.jsx`) uses a text-based
"AgencyTrack" wordmark. A Tatil Life logo asset needs to be placed here before the pilot demo.

- Obtain the Tatil Life logo SVG/PNG from Kyron
- Place at `public/tatil-logo.svg` (or similar)
- Swap the text wordmark in LoginScreen with the `<img>` tag (or inline SVG)
- Test in both light and dark mode

---

## ~~APP_MANUAL historical references cleanup~~

**Scope:** Several components contain `// APP_MANUAL` comments that were added during early
development to flag hand-maintained data (e.g. hardcoded branch lists, company minimums
duplicated in UI). Many of these are now served from Firestore (`config/settings`) but the
comments were never removed.

**Closure (audit 2026-05-25):** `git grep "APP_MANUAL" src/` → zero hits. All APP_MANUAL comments have already been removed in prior refactors. No code change required.

---

## ~~Dashboard heading-hierarchy harmonisation~~

**Scope:** AgentDashboard's existing dashboard-tab sections (KPI Activity grid,
Goals, Submit Weekly Report) use `<p class="text-xs uppercase">` as fake
headings instead of real `<h2>`/`<h3>` elements. B3 introduced real
`<h3>`s for "Recent Activity" and "Achievement Badges" — those two now
sit alongside `<p>`-styled section headers, which is internally
inconsistent.

- Convert KPI Activity grid header (`Activity Trend — Last N Weeks`) to `<h3>`
- Convert Goals card header to `<h3>` and wrap the surrounding `<div class="card">` in `<section aria-labelledby>`
- Audit the same pattern across `ManagerDashboard.jsx` and the other dashboard surfaces for parity
- Verify nothing skips heading levels (h1 → h2 → h3 only)

Priority: LOW. A11y-positive but cosmetic; B3 introduced no regressions. Surfaced during the B3 audit.

**Closure (PR #335, `f4b679b`):** KPI + Goals sections now use `<h3>` + `<section aria-labelledby>`. ManagerDashboard clean (no fake headings). No heading levels skipped.

---

## ~~Sidebar collapse toggle hit-target (32×32 → 40px+)~~

**Scope:** `.sidebar-collapse-btn` in `src/index.css:873-876` is a
32×32 click target. CLAUDE.md domain rules call for a 44×44 minimum,
primarily aimed at mobile field agents. The collapse toggle is desktop-
only (≥1024px expanded), so 32×32 is technically acceptable for mouse-
precision use. But the visual is also small enough that pointer-imprecise
users (large displays, pen tablets, touch-screen laptops) feel the
mistarget. Consider bumping to 40×40 or 44×44 to match the project's own
44px minimum, even though the cohort affected is narrow.

Adjacent to Mobile FU#4 cosmetic items. Not blocking — the surface is
reachable as of PR #56.

Priority: **LOW**. Surfaced as a Q2 deferral during the PR #56 triage.

**Closure (PR #334, `5ba57cd`):** Bumped to 44×44 in `src/index.css`.

---

## Defaults-warn banner positive-render test (LOW, surfaced 2026-05-08 during C3 extended verification)

**Scope:** `BulkImportGoalsModal.jsx` renders a yellow `<Info>` banner when `usingDefaultMinimums(preflight.minimums)` returns `true` — i.e. when the `companyMinimums` doc is missing `updatedBy`/`updatedAt` fields (heuristic: doc was never explicitly set by an admin, so defaults are in use). The extended C3 verification confirmed the banner does NOT render for the pilot tenant (tatillife_south's `companyMinimums` was set 2026-04-30 and has both fields). The positive-render path (banner shown when minimums are unset) was not exercised in production because the doc already exists.

**Fix:** Add a verification step or unit test (once Vitest lands from the Test Infrastructure MEDIUM item) that exercises `usingDefaultMinimums` with and without `updatedBy`/`updatedAt` fields, and optionally a smoke test that briefly deletes or replaces the `companyMinimums` doc to exercise the banner in staging. Until Vitest lands, the logic is simple enough to reason about directly from source.

Priority: **LOW**. The logic is a one-line helper (`!minimums?.updatedBy && !minimums?.updatedAt`); no known bug. This is a coverage gap, not a defect.

---

## `Bulk Import Goals` CTA label wraps at 390px (LOW, surfaced 2026-05-08 during C3 Q1 design review)

**Scope:** At 390px viewport width, the `UserManagementPanel` header has two sibling buttons — "Bulk Import Users" and "Bulk Import Goals". Both labels wrap onto two visual lines per button at 390px because the header row runs out of horizontal space. The buttons are accessible and legible (tap target exceeds 44px, labels are not truncated), but the two-line wrapping looks slightly unpolished at the smallest breakpoint.

**Options:**
1. Shorten labels to "Import Users" and "Import Goals" (saves ~35px each, probably enough to stay single-line).
2. Stack the buttons vertically at ≤640px (clean layout but takes more vertical space in the header).
3. Move them to an overflow/kebab menu at ≤640px.

**Recommendation:** Option 1 is the cheapest fix — `tenant_admin` context makes "Import" unambiguous. But since the current state is legible and accessible, defer until the manager surface mobile pass (Mobile FU#1) is scoped, so the header layout can be treated holistically.

Priority: **LOW**. Cosmetic at one breakpoint; no accessibility or usability failure.

---

## Kiosk team activity slideshow (MEDIUM, concept locked 2026-05-10)

**Scope:** Manager-uploaded photos from team events (training days, awards
ceremonies, branch outings, milestone celebrations) rotated as a dedicated
kiosk panel inside the existing E5 kiosk rotation. Branch-scoped — each
branch's kiosk shows only its own photos. Firebase Storage backed at
`team-photos/{tenantId}/{branchId}/{photoId}.jpg` with a Firestore index
collection for ordering / captions / upload metadata.

**Why this subsumes the earlier "branch hero photo" idea:** the original
proposal was a single static branch photo (one team shot, swapped manually
when staffing changed). That carried turnover-staleness risk — a departing
agent in the photo embarrasses the branch every time it renders. A
rotating slideshow of recent event photos sidesteps the risk: an outdated
photo simply ages out of rotation as newer events get uploaded, and the
staleness pressure becomes implicit (managers naturally swap in fresher
shots over time).

**Scope estimate:** ~2-3 day Claude Code session. Firebase Storage upload
UI in manager surface, Firestore index doc + rules, kiosk panel
component slotted into the existing rotation, branch-scoped query.

Priority: **MEDIUM**. Post-pilot — depends on E5 kiosk shipping first
(already shipped in PR #75). Genuine adoption signal needed (do branches
ask for this?) before scoping a PR.

---

## Kiosk per-branch customization (LOW, deferred 2026-05-10)

**Scope:** Allow each Branch Manager to pick which panels appear on their
kiosk, set the panel rotation order, and adjust KPI emphasis (e.g. show
unit comparisons vs. only individual leaderboards). Currently the kiosk
ships a single fixed 12-panel rotation tuned for the pilot branch.

**Why deferred:** premature at pilot scale. The pilot is a single branch
(tatillife_south); there is no divergent-needs signal yet. Customization
adds substantial scope (per-branch config schema, admin UI, migration of
the current fixed rotation into config-driven defaults) for zero current
benefit. Revisit when 3+ branches show divergent needs — at that point
the configuration surface justifies its weight.

**Scope estimate:** ~1-2 weeks when the time comes. New
`tenants/{tenantId}/branches/{branchId}/kioskConfig` doc, BranchEditorModal
extension or dedicated KioskConfigPanel, kiosk renderer reads config
instead of hardcoded rotation.

Priority: **LOW**. Concept reviewed 2026-05-10 and explicitly deferred —
do not pick up until a third branch is onboarded and asks for it.

---

## ~~e5-1-walk.mjs selector fixes~~ (SHIPPED — PR [#338](https://github.com/Kelsean868/agencytrack/pull/338), `e5d5aa1`)

All 4 failing checks fixed: check 02 `$()` → `waitForSelector()` with 10s timeout; check 05 duplicate goto removed + timeout increased 120s→220s; checks 10 + 12 restructured from live-rotation waits (320s/300s) to screenshot-based verification (confirm panel screenshot captured during 12-panel cycle). CI green, no smoke (harness-only). **CLOSED.**

## fieldHelpers / extractFields consolidation (LOW, banked 2026-05-10)

**Scope:** Two duplicate sources of truth for activity-total computation:

- `functions/utils/fieldHelpers.js` — CommonJS, consumed by Cloud
  Functions (Sunday aggregator, weekly recognition cron, etc.).
- `src/utils/extractFields.js` — ESM, consumed by the React app
  (dashboards, leaderboards, PDF report).

Both compute the same numeric fields (FFI count, CI count, API total,
PPP, lumpsums, new business) from the same submission documents, but
each maintains its own field-extraction logic. A bug fix or schema
migration in one easily drifts from the other — exactly the kind of
duplication that bit P8 when wizard-flat-schema rollout missed
extractFields and caused historical reports to render zeros.

**Long-term fix shape:**
- Option A: shared utility at `shared/fieldHelpers.js` compiled to both
  CJS and ESM via a build step (e.g. tsup or unbuild). Both consumers
  import from a single source.
- Option B: keep two files but generate one from the other via a
  pre-commit script. Source of truth in one location.
- Option C: migrate Cloud Functions to ESM (Node 20 supports it) and
  share the ESM file directly.

E1's schema split (Track E, pre-pilot HIGH) will exacerbate the
duplication — both files will need parallel updates for newBusiness /
pppIncreases / lumpsums extraction. Worth resolving before E1 lands, or
as part of E1 itself.

Priority: **LOW**. No active bug; structural risk only. Bank for E1
scoping conversation.

---

## SCOPE-1 — Tenant-wide persistency aggregate helper (MEDIUM, post-pilot)

**Scope:** `getPersistencyMapForYear` in `persistencyService.js` is branch-scoped (`opts.branchId` filter), which is correct for `branch_manager` Firestore rules. Future dashboard surfaces for `sales_manager` and `tenant_admin` roles need a separate tenant-wide helper (e.g. `getPersistencyMapForTenant`) that those roles' `allow get` conditions permit. Adding a new helper rather than extending `opts` keeps the access-control intent explicit.

Not pilot-blocking — those dashboards don't exist yet.

Priority: **MEDIUM**. Post-pilot. Bank for the `sales_manager` dashboard surface (P9).

---

## SCOPE-2 — Tighten persistency `allow list` rule (MEDIUM, post-pilot)

**Scope:** PR #83 added `allow list: if isSignedIn() && getTenantId() == tenantId` — intentionally permissive within tenant scope because Firestore cannot evaluate `resource.data` for list operations (per the inline rules comment). Future hardening: require client queries to include scope filters (`where('branchId','==',callerBranchId)` etc.) and validate via `request.query` in rules. Requires denormalizing `branchId` and `unitId` onto persistency docs (currently absent). Acceptable for the current single-branch pilot.

Coupled to PERF-1 (same denormalization needed).

Priority: **MEDIUM**. Post-pilot. Do not attempt without the doc-denormalization step.

---

## PERF-1 — `getAvailableMonths` tenant-wide unfiltered query (LOW, post-pilot)

**Scope:** `getAvailableMonths` in `persistencyService.js` for non-agent scopes issues an unfiltered `query(persistencyCollection())` against the full tenant collection. Fine for the pilot (one branch, hundreds of docs at most). As tenants grow into thousands of monthly docs, add a `where`-by-scope filter. Coupled to SCOPE-2 (requires `branchId`/`unitId` denormalized onto persistency docs before a scope filter is possible).

Priority: **LOW**. No urgency at pilot scale.

---

## TEST-N — Build Firebase rules-testing harness (MEDIUM, post-pilot)

**Scope:** `@firebase/rules-unit-testing` is in `devDependencies` but no test runner, environment setup, or emulator port config exists. PR #83's emulator-test step was skipped because of this gap. PR #85's `allow get` fix (non-existent-doc regression) would have been caught by automated rules tests before merging rather than discovered in production via the write-read-verify smoke. Future rules changes — especially to the persistency block, which has non-trivial role + null-resource combinations — should have coverage.

**Minimum viable harness:** configure `@firebase/rules-unit-testing` against a local emulator (port 8080), wire into a `test:rules` npm script separate from Vitest unit tests. First test suite: persistency `allow get` — covers null resource (non-existent doc) for agent / branch_manager / unit_manager; existing doc per role; cross-tenant denial.

Priority: **MEDIUM**. Ideally pre-pilot. Not blocking, but the next rules change without this is flying blind.

---

## WALK-1 — Harden walk scripts with real write-read-verify cycles (MEDIUM, ideally pre-pilot) — RESOLVED in PR #95 (2026-05-11)

**Scope:** The E3 walk (`scripts/verification/e3-persistency-walk.mjs`) reported 18/18 against both preview and production while PR #85's `allow get` regression was live in production. Walk check 9 (`entry_form_saves_to_firestore`) only verifies the Save button is enabled — it never fires the actual Firestore write. The regression was caught on the first application of the new write-read-verify smoke standard.

**New standard (memorialized in project memory):** every walk MUST include at least one real write-read-verify cycle with a hard reload between the write step and the verify step, using real auth and real Firestore. Walk pass rate alone is not sufficient verification.

**Apply to `e3-persistency-walk.mjs` first:** replace check 09 (`Save button enabled`) and check 10 (`nav-away/back state`) with a real agent self-entry write, hard reload, and read-back assertion. Same pattern for all future walk scripts.

Priority: **MEDIUM**. Ideally applied before the next rules-touching PR ships.

---

## WALK-2 — Agent self-write path coverage for persistency walks (LOW, post-pilot)

**Scope:** The persistency lock-by-manager mechanism (`PersistencyTab.jsx:77-79`, `lockedByManager` flag) makes the agent self-write path unreachable for the canonical test agent (`kelsean@gmail.com`) once a manager doc exists for the current month — which it does, persistently, after PR #94 and PR #95 smokes. The WALK-1 `e3-persistency-walk.mjs` cycle covers the manager-write + agent-read path (checks 09b/09c/11b), which exercises the full rules + claims + indexes chain. The agent self-write path is currently uncovered by automation.

**Future work:** Provision a dedicated smoke-only test agent (e.g. `smoke-agent-1@agencytrack-test.dev`) reserved for write-path verification, never written to via the manager path. Alternative: Admin-SDK-backed pre-cycle state reset.

Pilot-launch acceptable; real pilot agents exercise the agent self-write path daily, surfacing any regressions through actual use.

Priority: **LOW**. Post-pilot.

---

## BUG-N2 — `sales_manager` missing from unitGoals write rule — RESOLVED in PR #92 (2026-05-11)

**Scope:** `firestore.rules` `match /unitGoals/{docId}` write block allows `platform_admin`, `tenant_admin`, `branch_manager`, and `unit_manager` (post-BUG-N fix in PR #84). `sales_manager` is NOT in the list. Per the 5-tier hierarchy, `sales_manager` should logically have at least `branch_manager`-level write access to unit goals. Discovered during BUG-N diagnosis.

**Fix:** add `|| request.auth.token.role == 'sales_manager'` to the write condition alongside `branch_manager`.

Priority: **LOW** now; escalate to **HIGH** if sales managers need to set unit goals during the pilot.

---

## UX-N — Improve "no scope assigned" empty-state on Persistency tab — RESOLVED in PR #92 (2026-05-11)

**Scope:** When an account's profile has no `branchId`, `unitId`, or tenant-level role, the Persistency tab shows: "Persistency is scoped to a unit, branch, or tenant — your profile has none assigned." Accurate but not actionable. More useful copy: "Contact your branch manager to be assigned to a unit so you can view your unit's persistency data."

Not pilot-blocking — all pilot accounts will have scope assigned before login.

Priority: **LOW**. Post-pilot polish.

---

## BUG-N3 — Production Report shows raw Firestore UID instead of unit name (LOW, post-pilot) — RESOLVED in PR #97 (2026-05-11)

**Scope:** When a branch manager opens the Production Report screen, the unit identifier column displays the raw Firestore UID (e.g. `XQhG6awVgaYkCFX7gnd1...`) rather than the human-readable unit name. Functional but unpolished — managers can work around it but the display is confusing.

**Discovered:** During PR #90 mgr-mobile audit (visible in `verification/mgr-mobile-audit/production-report.png` reference).

**Root cause (likely):** Missing join between persistency docs and unit-name lookup, or a render-time fallback that is incorrectly using the ID field instead of the display name. Persistency docs store `unitId` as an opaque key; the Production Report likely needs to resolve it against the `units` or `users` collection to get the display name.

**Acceptance:** Unit identifier column shows the human-readable unit name (e.g. "Unit A") for all branch managers who have units in their scope.

Pilot-launch acceptable; fix in a dedicated PR before broader rollout. Not pilot-blocking — Tatil pilot is a single branch and the workaround is to recognise the UID prefix.

Priority: **LOW**. Post-pilot data-display fix.

---

## Add CI step for Firestore index deployment (POST-PILOT, banked 2026-05-12 during pilot-readiness audit)

**Scope:** No automation surrounds `firestore.indexes.json`. Today the
flow for a new composite index is: production query fails → developer
copies auto-generated URL from console error → opens it in Firebase
console → clicks Create → waits 2–5 min → reloads. HIGH#6 (the
`TenantAdminDashboard` YTD composite index) is the canonical example of
this pattern; future indexes will hit it again unless we automate.

**Fix:** Add a CI step that runs
`firebase deploy --only firestore:indexes` from `firestore.indexes.json`
on merges to main. Already partially in place for `firestore.rules` via
the pre-merge deploy pattern (CLAUDE.md). Closes two issues with one
step:

1. Removes the "find the URL in the console error" manual loop. A new
   index in source becomes a deployed index automatically.
2. Catches index-source drift — if production has indexes that aren't
   in `firestore.indexes.json`, the CI deploy reveals the divergence.

**Acceptance:**
- `.github/workflows/ci.yml` (or a separate workflow) runs
  `firebase deploy --only firestore:indexes` on push to `main`.
- Workflow has a `FIREBASE_TOKEN` (or service-account JSON) repo secret,
  scoped narrowly to the indexes resource.
- Document in CLAUDE.md alongside the existing rules-deploy convention.

Priority: **POST-PILOT**. Not blocking pilot launch; manual click is
acceptable for the small number of remaining indexes. Bank for the next
infrastructure-hygiene PR.

Banked during the 2026-05-12 pilot-readiness audit.

---

## Hardcoded hex literals with opacity modifier bypass the token system (POST-PILOT, LOW, banked 2026-05-12 during PR-C-FU3)

**Scope:** A handful of consumer sites use Tailwind arbitrary-value syntax
with a hardcoded hex literal AND an opacity modifier — e.g. `bg-[#01696f]/8`
at `src/components/dashboard/MotivationalCarousel.jsx:366`. Arbitrary hex +
opacity does render correctly (Tailwind decomposes the literal at build
time, so it does **not** hit the CSS-var opacity-resolution path that
PR-C-FU3 fixed). But it bypasses the design-token system entirely: a future
brand recolor or theme change leaves these sites stranded on the old hex,
and they don't react to light/dark switching.

**Known sites (approximate, ~5 total):**
- `MotivationalCarousel.jsx:366` — `bg-[#01696f]/8 border border-[#01696f]/15`
  (flagged in CLAUDE.md § Cosmetic Inconsistencies)
- A few additional `bg-[var(--color-surface)]` arbitrary-syntax sites
  (also flagged in CLAUDE.md). These resolve correctly but are inconsistent
  with the `bg-card` utility convention.

**Fix:** Migrate to the equivalent token-based utility:
- `bg-[#01696f]/8`        → `bg-primary/[0.08]` or `bg-primary/10`
- `border-[#01696f]/15`   → `border-primary/15`
- `bg-[var(--color-surface)]` → `bg-card`

PR-C-FU3 confirmed that token-based opacity modifiers (`bg-primary/N`) now
resolve correctly app-wide, so this migration is mechanical.

**Acceptance:**
- `grep -rn "bg-\[#" src/` returns no hits outside `AgentReportDocument.jsx`
  (react-pdf exempt — uses hex-only by design).
- `grep -rn "bg-\[var(--color-" src/` returns no hits — all converted to
  named utility equivalents.

Priority: **POST-PILOT, LOW**. Not pilot-blocking. The hardcoded hex paths
currently render correctly; this is design-system hygiene. Bank for the
next theme-system PR.

Banked during PR-C-FU3 (2026-05-12 pilot-readiness audit).

**Closure (PR #337, `ab2aa81`):** `bg-[var(--color-` → already clean (PR #155/#219). `MotivationalCarousel.jsx` deleted (PR #208). Remaining `bg-[#hex]` sites: `CampaignCard.jsx` medal badges (`bg-amber-500`/`bg-slate-400`/`bg-amber-700`) + `GapAnalysisPanel.jsx` unit-target bar (`bg-violet-600`). Both acceptance criteria verified: zero `bg-[#` hits outside `AgentReportDocument.jsx`; zero `bg-[var(--color-` hits. CLAUDE.md § Cosmetic Inconsistencies reference to `MotivationalCarousel.jsx:366` is stale (component deleted) — leave as historical artifact; the cosmetic inconsistency section itself can be pruned in a future housekeeping pass.

---

### SEC-9b residual: tenantId-in-deps exhaustive-deps warnings (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The tenantId-in-deps pattern was a known residual of SEC-9b (PR #139) — 16 react-hooks warnings remained at SEC-9b merge; PR #164 closed 3 (unrelated react-hooks shapes); the pattern was verbally surfaced during PR #164 closure but never formalized as a FOLLOW_UPS row. This PR formalizes the banking and closes it via mechanical dep additions across 11 files / 13 hooks.

**Audit trail:** PR #139 (SEC-9b migration) → PR #164 (3 react-hooks closures, 16→14 baseline) → PR #172 (`1ea423d` — 13 tenantId-in-deps fixes + 1 unrelated stale eslint-disable cleanup).

**Per-hook fix table:**

| # | File:line | Proposed deps |
|---|---|---|
| 1 | `agent/PersistencyTab.jsx:60` | `[user?.uid, tenantId]` |
| 2 | `daily/DailyEntryModal.jsx:77` | `[user?.uid, today, tenantId]` |
| 3 | `dashboard/AgentDashboard.jsx:251` | `[user?.uid, today, showDailyCTA, tenantId]` |
| 4 | `dashboard/ManagerDashboard.jsx:83` | `[tenantId]` |
| 5 | `kiosk/KioskShell.jsx:59` | `[tenantId]` |
| 6 | `manager/AgentOfMonthTab.jsx:66` | `[branchId, monthKey, tenantId]` |
| 7 | `manager/GoalsPanel.jsx:730` | `[tenantId]` |
| 8 | `manager/MasterSheet.jsx:99` | `[selectedWeek, tenantId]` |
| 9 | `manager/PersistencyTab.jsx:103` | `[scopeType, scopeId, tenantId]` |
| 10 | `manager/PersistencyTab.jsx:128` | `[monthKey, scopeId, scopeType, tenantId]` |
| 11 | `manager/UserManagementPanel.jsx:375` | `[showInactive, tenantId]` |
| 12 | `wizard/WizardForm.jsx:184` | `[user, tenantId]` |
| 13 | `wizard/WizardForm.jsx:206` | `[weekStarting, user, tenantId]` |

Post-PR lint baseline: 0 warnings (down from 14; +1 stale eslint-disable in `run-all.mjs:459` also removed in same PR).

---

### FU-B: Consolidate A11Y env var naming (RESOLVED 2026-05-17)

**Resolved in PR #182** (`19a8281`, 2026-05-17). A11Y env var naming consolidated: legacy `A11Y_MANAGER_*` renamed to `A11Y_BRANCH_MANAGER_*` across 2 consumer sites (`scripts/a11y-axe-scan-manager.cjs` primary + `scripts/verification/e1-slice-2b-walk.mjs` fallback chain — simplified, dual-name bridge removed). `.env.example` expanded from 2 documented A11Y_* role flavors (AGENT + legacy MANAGER) to 6 (AGENT, UNIT_MANAGER, BRANCH_MANAGER, SALES_MANAGER, TENANT_ADMIN, PLATFORM_ADMIN). CLAUDE.md Rule 14 banking note rewritten to pattern-based framing with the 2026-05-17 audit's frozen counts (7 role flavors actively read, 2 documented at banking time).

**Corrected diagnosis vs the originating FU body:** the 2026-05-16 audit's "5 role flavors actively read, only 2 documented" understated the count. Ground truth at the 2026-05-17 audit was 7 role flavors (the 5 referenced plus SALES_MANAGER and a second role flavor not enumerated in the original). FU-B body lines 1582 and 1589 both omitted SALES_MANAGER from the enumeration. Post-rename canonical count is 6 role flavors (no MANAGER-legacy).

**Surfaced from:** Section 3 Drift #1 of env-credentials propagation audit (2026-05-16). Corrected diagnosis surfaced by 2026-05-17 FU-B + Rule 14 re-baseline audit (Rule 11).

**Operator action (post-merge, required):** Rename `A11Y_MANAGER_EMAIL` / `A11Y_MANAGER_PASSWORD` keys in `.env.local` to `A11Y_BRANCH_MANAGER_*` — same logical credential, just the new canonical name. Optional: add credentials for the 4 newly-documented role flavors (`A11Y_UNIT_MANAGER_*`, `A11Y_SALES_MANAGER_*`, `A11Y_TENANT_ADMIN_*`, `A11Y_PLATFORM_ADMIN_*`) if running multi-role smoke walks locally.

---

### FU-C: Remove tracked historical super_admin scripts (MEDIUM, RESOLVED 2026-05-17)

**Resolved in PR #184** (`ddc6095`, 2026-05-17). Removed 2 vestigial dead-code
scripts from the pre-PR-3 super_admin era:
- functions/set-super-admin.cjs (22 lines, one-time claim setter)
- functions/seed-super-admin-user.cjs (45 lines, one-time user doc seeder
  containing hardcoded kyron@tatillife.com literal)

Companion cleanup landed in the same PR: .gitignore lines 27–28 entries
pruned, CLAUDE.md § Sensitive Files — Never Commit bullets for both files
removed, stale PR-1-era comment in scripts/a11y-axe-scan-manager.cjs:17
referencing super_admin credentials as a fallback (rendered obsolete by
PR-3 + FU-B PR #182) deleted.

Phase 1 sanity-check grep (2026-05-17 audit, satisfying the FU-C banking
requirement) confirmed: FUNCTIONAL_GATE bucket empty across firestore.rules
+ functions/index.js + src/. Role retirement is complete in production
code paths. Zero npm-script or CI references to the removed files. The
platform_admin successor role's scaffolding (PlatformAdminStubScreen in
App.jsx, Firestore rules cross-tenant grants, functions/scripts/
seed-platform-admin.cjs bootstrap) is untouched — its cross-tenant UI
build is deferred indefinitely per dispatcher decision 2026-05-17 (single-
tenant Tatil Life scope).

TEST_OR_SEED bucket (migration scripts, emulator harness, one test sentinel)
deliberately left in place — each has rational reasons to stay; out of
FU-C banked scope.

---

### FU-D: Remove VITE_TENANT_ID from .env.example (LOW, RESOLVED 2026-05-17)

**Surface:** `.env.example:5-9` carries a SEC-11 deprecation comment for `VITE_TENANT_ID`. SEC-11 closed in PR #26; no live `import.meta.env.VITE_TENANT_ID` reader exists in `src/`.

**Failure mode:** Var sits as bait — anyone copying the template populates a value nothing reads. Comment is factually wrong post-SEC-11.

**Fix shape:** Remove the var + comment block from `.env.example`. Trivial single-edit.

**Bundle candidate:** can ship with FU-E in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #2 of env-credentials propagation audit (2026-05-16).

**Resolved in PR #178** (`c930d97`, 2026-05-17). Removed the 5-line VITE_TENANT_ID
block (4-line comment header + var declaration) from .env.example. Audit
(2026-05-17) confirmed zero tracked source readers post-SEC-11/SEC-9b — all
remaining references are docs/history only. Section banner "Vite / Firebase
client config" preserved; next entry (VITE_FIREBASE_API_KEY) sits directly
below.

---

### FU-E: Document VITE_VALIDATE_KIOSK_TOKEN_URL in .env.example (LOW, RESOLVED 2026-05-17)

**Surface:** `src/lib/kiosk/kioskConfig.js:39` reads `VITE_VALIDATE_KIOSK_TOKEN_URL` with a hardcoded production fallback. Not documented in `.env.example`.

**Failure mode:** Knowledge silo — new contributors won't discover this knob exists.

**Fix shape:** Add `VITE_VALIDATE_KIOSK_TOKEN_URL` to `.env.example` with a comment explaining it's optional (defaults to deployed CF endpoint, only set for non-prod kiosk testing).

**Bundle candidate:** can ship with FU-D in one `.env.example` cleanup PR.

**Surfaced from:** Section 3 Drift #3 of env-credentials propagation audit (2026-05-16).

**Resolved in PR #178** (`c930d97`, 2026-05-17). Added VITE_VALIDATE_KIOSK_TOKEN_URL
to .env.example under a new "Kiosk overrides" section. Comment block explains
the prod-fallback default in src/lib/kiosk/kioskConfig.js and when an operator
should set the override. Fresh-clone onboarding now surfaces the option.

---

### FU-F: Unify .env.local parsing strategy (LOW, RESOLVED 2026-05-18)

**Surface:** Two separate `.env.local` parsers exist in the repo. `dotenv` (npm package) used by most scripts. Custom `loadEnv()` in `scripts/verification/shakedown/auth-helpers.mjs:75` — bespoke parser with defensive `[A-Z_][A-Z0-9_]*=` line filter (Rule 4 alignment).

**Risk:** Parser behavior divergence (quote handling, multi-line values, embedded-key detection). Custom parser is stricter; scripts using dotenv get less protection. Low-impact today (no observed mismatch) but a future contributor could write a script using dotenv that trips an edge case the shakedown parser would catch.

**Fix shape:** Extract `loadEnv()` from `shakedown/auth-helpers.mjs` into a shared helper at `scripts/lib/loadEnv.mjs`. Migrate all script readers from `dotenv` to the shared helper.

**Sequencing:** Ship after FU-B (which already touches most A11Y-reading scripts; FU-F can reuse that touch surface).

**Surfaced from:** Section 3 Drift #5 of env-credentials propagation audit (2026-05-16).

**Part 1 resolved in PR #198** (`316b86a`, 2026-05-18). Created `scripts/lib/loadEnv.mjs` (strict parser preserving TOOLING-N embedded-key detection, frozen dict return, module-scoped cache, optional path arg with cwd-default). Migrated 19 of 23 `.mjs` inline-parser sites (Pattern A ×16 + Pattern B ×2 + Pattern D ×1; 4 untracked sites excluded per existing 2026-05-13 banked untracked-cleanup FU). FU-B PR #182 sequencing constraint satisfied — all 19 migration targets within FU-B's touch surface. **Rule 11 corrected diagnosis:** FU-F body's "Two separate .env.local parsers" claim was operationally stale; actual landscape at audit time (2026-05-18, repo HEAD `40cd5d6`) was 8 distinct parser shapes consolidating to 5 semantic patterns across 30 inline-parser sites (23 `.mjs` + 7 `.cjs`). FU body's "dotenv (npm package) used by most scripts" claim was also stale; zero dotenv consumers in source (verified). Corrected diagnosis preserved here per Rule 11 drift-trail principle. **Part 2 (FU-F-2)** deferred — `.cjs` sibling helper at `scripts/lib/loadEnv.cjs` + 7 `.cjs` migrations (audit-locked at 2026-05-18; decisions retrievable via this PR's chat context). Second canonical Rule 17 in-the-wild application during brief authoring (after FU-K's `git branch --merged main` mechanism, FU-J PR #194).

**Part 2 resolved in PR #204** (`a975706`, 2026-05-18). Created `scripts/lib/loadEnv.cjs` (CommonJS sibling to `scripts/lib/loadEnv.mjs` shipped in FU-F-1 / PR #198) preserving identical strict parser semantics including TOOLING-N embedded-key detection. Migrated 5 tracked `.cjs` inline-parser sites: `a11y-axe-scan.cjs`, `a11y-axe-scan-manager.cjs`, `exploration-walk.cjs` (Pattern G — embedded-key detection preserved); `manager-audit-screenshots.cjs`, `manager-audit-screenshots-mobile.cjs` (Pattern H — gains embedded-key detection as safety upgrade). `Object.assign(process.env, loadEnv(...))` preserves caller-side mutation contract. **Rule 11 corrected diagnosis (knock-on from FU-M closure):** Dispatcher's FU-M closure paragraph (PR #202) claimed actual tracked `.cjs` count was 6; correct count is 5 (audit's 7 minus 1 untracked `mgr-mobile-audit.cjs` minus 1 excluded `multi-role-smoke.cjs`). Arithmetic miscount preserved here as drift trail per Rule 11. **FU-N banked in same Phase 4** (audit-methodology refinement: pair `grep` with `git ls-files` for future audit enumerations). Both Parts 1 + 2 of FU-F now complete; entire script parser unification effort closed end-to-end across two PRs.

---

### FU-A: Hardcoded test agent password scrub (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The `functions/set-agent-password.cjs` script contained a literal test agent password and Firebase Auth UID, tracked in git. Same value also appeared in 2 tracked brief files: `docs/briefs/walk-1-kickoff.md:92` and `docs/briefs/polish-series-housekeeping-kickoff.md:69`. A third brief file (`docs/briefs/e1-slice-2b-kickoff.md:366`) also contained the value but is untracked (confirmed via `git ls-files` — absent from index) — out of scope per brief carve-out; noted in PR body.

**Blast radius:** Test agent account only (`kelsean@gmail.com`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`). Bounded but real plaintext exposure.

**Fixes applied in this PR:**
- `functions/set-agent-password.cjs`: literal password replaced with `process.env.TEST_AGENT_PASSWORD` direct read (no parser, no new dependency); fail-fast on missing env var with PowerShell + Bash invocation hints. `dotenv` is not installed in this project; direct `process.env` read avoids the install and sidesteps FU-F's parser-unification concern.
- `.env.example`: `TEST_AGENT_PASSWORD` documented with purpose comment (Rule 14 compliance)
- 2 tracked brief files: literal password scrubbed, replaced with `<TEST_AGENT_PASSWORD>` placeholder (`walk-1-kickoff.md` and `polish-series-housekeeping-kickoff.md`)
- Grep verification (`git ls-files | xargs grep`) confirmed no tracked file retains the literal value

**Operator action (post-merge, required):** Rotate test agent password via Firebase Console → Authentication → Users → kelsean@gmail.com → Reset password. **The code change alone does not invalidate the leaked credential — only rotation does.** Update `.env.local` with the new value to keep the script functional.

**Surfaced from:** Section 4 Exposure #1 of env-credentials propagation audit (2026-05-16).

---

### FU-G — Document operational env vars in script-local READMEs (LOW, RESOLVED 2026-05-17)

**Banked from:** 2026-05-17 env-credentials propagation audit Layer 3 (originating PR #178 brief deferred this). 2026-05-17 methodology batch audit confirmed scope.

**Scope:** Two operational env vars are read in `scripts/verification/**` and `scripts/cleanup/**` but absent from `.env.example`. They are orchestration knobs (not credentials or Firebase client config), so they belong in script-local READMEs, not the canonical credential doc.

- **PREVIEW_HOST** — read in ~18 verification smoke/walk scripts in `scripts/verification/**`. Existing `scripts/verification/README.md` documents VERCEL_BYPASS_TOKEN + A11Y_AGENT_PASSWORD but not PREVIEW_HOST. Extend the existing Environment requirements section.
- **CLEANUP_ALLOWED_TENANTS** — read in `scripts/cleanup/wipe-test-data-sweep.mjs:90` + `scripts/cleanup/preview-test-data-sweep.mjs:71` + consumer/orchestrator sites in `scripts/verification/pr-f-bulk-test-data-smoke.mjs` and `scripts/verification/shakedown/**`. `scripts/cleanup/README.md` does NOT exist — FU-G creates it.

**Sub-finding (worth noting in FU-G's execution brief, not blocking):** PREVIEW_HOST consumption is inconsistent — some scripts hardcode the host string (e.g. `e1-slice-2b-walk.mjs:53`, `e2-walk.mjs:48`), others read `process.env.PREVIEW_HOST` with a fallback. Documentation alone won't unify the pattern. Consolidation is out of FU-G's scope; flag in the README that the env var is the preferred path and that the hardcoded sites are pre-existing drift.

**Closure criteria:**
- `scripts/verification/README.md` Environment requirements section gains PREVIEW_HOST entry with example value, fallback behavior, and a one-line note about the hardcoded-host drift.
- `scripts/cleanup/README.md` is created documenting CLEANUP_ALLOWED_TENANTS, abort-guard semantics, and a cross-reference to `docs/runbooks/test-data-lifecycle.md`.
- `.env.example` remains untouched (these are not credential-doc material per Rule 14).

**Severity:** LOW — operationally important but no security or correctness risk; current state works because either env vars are set in operator shells or fallbacks apply.

**Resolved in PR #186** (`bd238d2`, 2026-05-17). Extended `scripts/verification/README.md` with a `PREVIEW_HOST` operational-knob section (bare-host format, source-accurate fallback behavior, drift note preserving the `e1-slice-2b-walk.mjs` + `e2-walk.mjs` hardcoded-host call-out). Created `scripts/cleanup/README.md` documenting `CLEANUP_ALLOWED_TENANTS` allowlist semantics (env unset OR target tenant absent → `exit 1`), the consumer list (direct invocation plus orchestrator sites in `pr-f-bulk-test-data-smoke.mjs` and the shakedown harness), and a cross-reference to `docs/runbooks/test-data-lifecycle.md`. Phase 1 source audit caught three content-vs-source divergences in the brief's Phase 2a/2b spec and corrected each before commit (documented in the work PR body's Phase 1 findings section). `.env.example` was intentionally NOT modified per Rule 14 carve-out (these are operational knobs, not credentials).

---

### FU-I — Parameterize hardcoded TENANT_ID constants in seed/cleanup/shakedown scripts (LOW)

**Banked from:** 2026-05-17 methodology batch Phase 1 verification. Originally proposed as FU-G scope expansion in the methodology batch audit; Phase 1 grep revealed TENANT_ID is hardcoded JS constants (not `process.env` reads), so it does not share FU-G's "operational env var" shape. Carved out into its own FU at execution time.

**Scope:** Three scripts declare or export `const TENANT_ID = 'tatillife_south'` directly:
- `scripts/seed/test-roster.mjs:18` (exported, consumed elsewhere)
- `scripts/verification/shakedown/auth-helpers.mjs:42` (exported, consumed by shakedown harness)
- `scripts/backfill/assign-test-unit.mjs:42` (local const)

All other `scripts/cleanup/**` and `scripts/verification/shakedown/**` consumers import the constant from one of the three sites above. Zero `process.env.TENANT_ID` reads in `scripts/`.

**Concern:** Multi-tenant readiness, not security or correctness. Hardcoded value is fine while the pilot is single-tenant (`tatillife_south`), but blocks any future multi-tenant test scaffolding. No current operational impact.

**Resolution direction (deferred to FU-I's execution PR):** Parameterize via env var override (e.g. `TENANT_ID=acmelife node scripts/seed/test-roster.mjs`) with `tatillife_south` as the default. Consider centralizing the constant in one shared module if multiple modules need to reference it.

**Severity:** LOW (post-pilot multi-tenant readiness, no current operational impact).

---

### FU-H — Phase 4 fill scope methodology (LOW, methodology, RESOLVED 2026-05-17)

**Banked from:** 2026-05-17 methodology batch audit. Surfaced as the second failure mode adjacent to Rule 15.

**Scope:** The post-merge placeholder-fill sequence currently updates only `#246`/`cded72f` literal placeholders in CONTEXT.md and FOLLOW_UPS.md. Non-placeholder per-PR state in CONTEXT.md — `Current main HEAD`, `Active track`, `Next track`, and the "Where we left off" prose — does NOT get updated unless the work brief's Phase 4 explicitly mandates it. As a result these fields go stale within hours of any PR landing.

Evidence at banking time: even after PR #178's clean post-merge fill (`3e3afc0`), CONTEXT.md's top-table `Current main HEAD` was pinned to a pre-#178 SHA until this methodology PR's Phase 4 backfilled the state.

**Open design question (deferred to FU-H's execution PR):** Resolution options include —
- Amend § Post-merge local cleanup in CLAUDE.md to mandate top-table + "Where we left off" updates as part of every post-merge sequence, regardless of whether the work brief specified them.
- Add a canonical Phase 4 spec section to CLAUDE.md that all work briefs must inherit (so individual briefs don't need to re-specify the fill surface every time).
- Promote the post-merge placeholder-fill sequence to its own numbered canonical rule (resolves both this gap and the "Rule 4 shorthand" terminology drift simultaneously).

**Closure criteria:** Design judgment locked in a future methodology PR; canonical Phase 4 fill scope is unambiguous and enforceable; CONTEXT.md top-table state stays current automatically after every post-merge sequence.

**Severity:** LOW (methodology) — doesn't break shipping, but causes CONTEXT.md drift that erodes the doc's value as an at-a-glance state reference.

**Resolved in PR #188** (`a543c30`, 2026-05-17). Rule 16 added to `CLAUDE.md` mandating post-merge fill scope (Current main HEAD, Active track, Next track, "Where we left off", Last updated). Anchor tweak at `CLAUDE.md:344` cites Rule 16 alongside Rule 15. Retired "Rule 4 shorthand" terminology drift flagged by Rule 15:503. Top-table staleness fixed in same commit as Rule 16 demonstration case. Pass 3 amend corrected initial `fill commit` anchor wording to `work-PR squash` (the operationally-possible version) after the hotfix-Phase-4 self-application surfaced the chicken-and-egg condition. Rule 16 has self-validated across four consecutive post-merge cycles (PRs #188, #190, #192, #194) with zero drift recurrences. **Note on this footer:** PR #188's Phase 6 spec included this resolved-block conversion but execution missed it; the drift was caught during FU-J + FU-K Session A brief authoring (2026-05-18) and reconciled in this stale-row sweep PR.

---

### FU-J — Brief and rule authoring source-verification discipline (LOW, methodology, RESOLVED 2026-05-18)

**Surface:** Pattern observed 2026-05-17 across FU-G + FU-F + FU-H + Rule 16: briefs and rule additions describing source behavior (default behavior, example values, command syntax, file paths, line numbers, structural format) authored without source-level verification produced six errors. Phase 1 re-audit caught all six, but at cost of re-author cycles.

**Specific instances:**

1. FU-G brief Phase 2a default behavior — described `PREVIEW_HOST` fallback as "production preview URL"; source reality is per-feature-branch stale URLs across 9 fallback sites.
2. FU-G brief Phase 2a example — included `https://` scheme; source consumes bare host (`https://${PREVIEW_HOST}/`), prepending scheme internally. Operator copy-paste would have broken every walk.
3. FU-G brief Phase 2b Purpose — described `scripts/cleanup/**` as "operations are destructive"; source includes `preview-test-data-sweep.mjs` which is DRY-RUN only per its file header.
4. FU-F body claim — "dotenv used by most scripts"; source has zero dotenv consumers; actual landscape is 5 inline parser patterns across 30 files (23 .mjs + 7 .cjs).
5. FU-H brief Phase 2c — prescribed "one-line summary" for "Where we left off" without consulting actual format; CONTEXT.md had a 4-paragraph multi-section structure that was collapsed before CC surfaced it via Rule 1.
6. FU-H Rule 16 wording — "fill commit" anchor for Current main HEAD is operationally impossible (chicken-and-egg); surfaced by hotfix #189 Phase 4 as the de-facto first application.

Five of six are brief-authoring; one is rule-authoring. Root cause: dispatcher (chat Claude) authors briefs/rules from assumptions about source rather than reading source first.

**Proposed resolution:** A new methodology rule (candidate Rule 17) mandating source-verification at authoring time for behavioral/example/format/path claims. Concretely: grep or read source before writing behavior descriptions; trace example values through actual call sites; confirm file paths and line numbers; read existing structural format before prescribing changes. Phase 1 remains as safety net; the primary verification surface shifts to authoring time.

**Severity:** LOW (no production impact; methodology drag only).

**Sequencing:** Rule 17 canonization is a future methodology PR (separate session). This entry banks the pattern for that session.

**Resolved in PR #192** (`23bf15d`, 2026-05-18). Rule 17 added to `CLAUDE.md` mandating source-verification at brief- and rule-authoring time for behavioral/example/format/path claims. Five-bullet enumeration covers default behavior, example values, file paths, structural format, and operational possibility of proposed wording. Rule 11 explicitly carved out as the specific case for FU-body diagnoses. Meta-paragraph at `CLAUDE.md:359` extended in same commit to cover both Rule 16 (missed during PR #188) and Rule 17 entries.

---

### FU-K — Stale local docs/* and chore/* branch cleanup sweep (LOW, housekeeping, RESOLVED 2026-05-18)

**Surface:** Local branches from merged brief-docs PRs and feature PRs accumulate after upstream pruning via GitHub's `deleteBranchOnMerge`. Currently: ~11 stale local branches from pre-2026-05-17 docs PRs plus today's branches (`docs/fu-g-brief`, `docs/fu-h-brief`, `chore/fu-g-script-readmes`, `chore/fu-h-rule-16`, `fix/weekly-activity-panel-test-tz`, and the just-merged `chore/bank-fu-j-fu-k`).

**Action:** Single sweep dispatch. (1) `git branch --merged main` to enumerate merged-locally branches. (2) Filter to exclude `main`, current branch, any active worktree branches. (3) `git branch -D` each stale entry. (4) `git remote prune origin` to clear any leftover remote-tracking refs.

**Severity:** LOW (housekeeping; no production impact, no methodology surface).

**Sequencing:** Anytime; XS execution; deferrable indefinitely without consequence.

**Resolved in PR #194** (`b195782`, 2026-05-18). Created `scripts/maintenance/prune-merged-branches.mjs` (idempotent, DRY-RUN default, `--execute` to delete) and `docs/runbooks/branch-cleanup.md` (mechanism explanation + three-step runbook + troubleshooting). **Rule 11 corrected diagnosis:** FU-K body's prescribed enumeration mechanism (`git branch --merged main`) is operationally broken under AgencyTrack's squash-merge workflow — squash-merge creates a new commit on main with a different SHA from the source branch's tip, so the source branch is not in main's ancestor chain. Verified live at brief authoring time: `git branch --merged main` returned `* main` only despite 16 stale local branches present. Corrected mechanism: after `git fetch --prune origin`, local branches with `[origin/X: gone]` upstream-tracking marker are the safe sweep candidates. Live-upstream branches (open PRs, closed-unmerged, pre-deleteBranchOnMerge legacy) are skipped. Stale remote-tracking refs without local counterparts are out of scope (remote mutation). First canonical Rule 17 application in the wild during brief drafting — source-verification at authoring time caught the broken mechanism before script implementation.

---

### FU-L — `prune-merged-branches.mjs` skip worktree-attached branches (LOW, housekeeping, RESOLVED 2026-05-18)

**Surfaced:** dogfood `--execute` run 2026-05-18 (post-FU-K PR #194 + FU-H PR #196 close). Script reported `error: cannot delete branch 'chore/fu-h-stale-row-sweep' used by worktree at 'C:/Projects/AgencyTrack-fu-h-sweep'`. Failed-1 OK-1, exit reflected partial failure cleanly.

**Mechanism:** `git branch -D` refuses to delete branches checked out in ANY worktree (not just current). Script's hard exclusion list covers `main` + current branch only. Worktree attachments invisible to the script.

**Proposed fix:** before classifying `[gone]`-upstream branches into stale list, parse `git worktree list --porcelain` to identify worktree-attached branches; move into skipped list with marker `(attached to worktree at <path>)`. Print operator guidance: use `git worktree remove <path>` to detach before sweeping.

**Rule 17 dogfood signal:** brief authoring (PR #194) mentally simulated the script's first invocation but didn't query `git worktree list` at the simulation step. Second canonical Rule 17 in-the-wild surfacing (after FU-K body's `git branch --merged main` mechanism in PR #194 brief drafting). Source-verification at authoring time would have caught this gap.

**Severity:** LOW. Script reports failure cleanly, doesn't crash; operator can manually `git worktree remove <path>` then re-run.

**Sequencing:** XS work PR. Open opportunistically — could pair with FU-F-2 in same session.

**Resolved in PR #200** (`4dd9bbd`, 2026-05-18). Added `parseWorktreeBranches()` helper to `scripts/maintenance/prune-merged-branches.mjs` parsing `git worktree list --porcelain`. Integrated into classification loop: worktree-attached branches are routed to the "NOT swept" list with marker `(attached to worktree at <path>)` BEFORE the `[gone]` check, preserving operator visibility and providing actionable guidance (`git worktree remove <path>` to detach + re-run). Runbook at `docs/runbooks/branch-cleanup.md` gains a new "Worktree-attached branches" section between "Branches with live upstream" and "Branches with no upstream". Phase 3 integration test created a throwaway worktree to validate the new logic at runtime — output confirmed `(attached to worktree at <path>)` marker rendered correctly. Closes the dogfood-surfaced gap from morning 2026-05-18 (`chore/fu-h-stale-row-sweep` deletion failure).

---

### FU-M — `multi-role-smoke.cjs` likely defunct: triage + remove or update (LOW, housekeeping, RESOLVED 2026-05-18)

**Surfaced:** FU-F audit re-run 2026-05-18 Section 7 finding #1. The script at `scripts/multi-role-smoke.cjs` reads legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` env vars in non-canonical Title_Case naming, references the retired `super_admin` role (closed in user-mgmt PR-3, PR #28/#29). Not in `.env.example`.

**Failure mode (latent):** script would not execute correctly under current auth model (super_admin role retired post-May-5 refactor). Maintenance dead weight; risks confusion for future contributors.

**Proposed fix:** triage with Kyron — three options:
- (a) Update to canonical `A11Y_*` naming + use non-retired roles (Sales Manager / Branch Manager / Unit Manager / Agent / Tenant Admin).
- (b) Delete the script entirely (preferred if functionality is unused).
- (c) Confirm operational relevance with Kyron first; defer decision.

**Sequencing:** Triage XS, then either delete-PR or update-PR. Out of FU-F-2 scope (audit explicitly excluded). If decision is (b) delete, FU-F-2 `.cjs` migration target drops from 7 → 6.

**Severity:** LOW. Doesn't break shipping; just risks confusion + represents likely-dead code.

**Resolved in PR #202** (`a4fba56`, 2026-05-18). Phase 1 source-verification surfaced that `scripts/multi-role-smoke.cjs` was NOT tracked in git — file existed only in main worktree's local filesystem, excluded via `.git/info/exclude` line 8 (personal exclude file, not repo-shared `.gitignore`). Brief's "tracked" claim was incorrect — corrected diagnosis preserved here per Rule 11 drift-trail principle. Remedy: filesystem `rm` of the local file + cleaned up `.git/info/exclude` line 8 (both local-only operations, not in repo diff). Third canonical Rule 17 in-the-wild signal — caught at Phase 1 execution gate (safety net layer), not at brief authoring time (primary layer). Both layers of the discipline validated across the two-day arc. Audit miscounting (knock-on): FU-F audit (2026-05-17 + 2026-05-18 re-run) claimed 7 `.cjs` migration targets via `grep`; actual tracked `.cjs` count is 6 (multi-role-smoke.cjs was excluded-not-tracked all along). FU-F-2's brief should reflect 6 as migration target. Methodology refinement candidate: future audit enumerations should pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded — flagged for separate banking, not absorbed here.

---

### FU-N — Audit enumeration: pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded (LOW, methodology, RESOLVED 2026-05-18)

**Surfaced:** FU-M execution Phase 1 (PR #202, 2026-05-18). FU-F audit (2026-05-17 + 2026-05-18 re-run) enumerated `.cjs` parser sites via `grep -rn` alone, treating all matches as tracked migration targets. CC's Phase 1 source-verification caught `scripts/multi-role-smoke.cjs` was excluded-not-tracked via `.git/info/exclude` (personal exclude file, not repo-shared `.gitignore`). Additional dispatcher miscount in FU-M closure (claimed "6"; actual 5 — fixed in FU-F-2 Phase 4a closure paragraph per Rule 11).

**Mechanism:** `grep -rn` matches all files on filesystem regardless of git-tracked status. Audit consumers (brief authors) downstream assume tracked = migration target. Discrepancy creates phantom migration targets + dispatcher miscounts.

**Proposed fix:** future audit dispatches pair enumeration with `git ls-files` to filter to tracked-only files. Alternatively: use `git grep` which only searches index/tracked content. Update CLAUDE.md Rule 17 bullet list to add a "tracked-status verification" discipline OR bank as a Methodology Patterns note.

**Severity:** LOW (methodology refinement). Doesn't break shipping; causes audit downstream inefficiency + dispatcher miscounts. Phase 1 safety net catches the discrepancy (as proven in FU-M PR #202), but caught-at-authoring-time is preferred per Rule 17.

**Sequencing:** XS work PR — opportunistic. Could pair with future methodology batch (similar to PR #168) or stand alone.

**Resolved in PR #206** (`1d36436`, 2026-05-18). Added new sub-bullet to CLAUDE.md Rule 17 bullet list at position 4: "Enumeration tracked-status: when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs." Closes the methodology gap surfaced via FU-M Phase 1 discovery (PR #202) + FU-F-2 brief authoring miscount (preserved as Rule 11 drift trail in FU-F-2 RESOLVED block per PR #204). **Seventh canonical Rule 17 in-the-wild signal — and the meta-application:** this very PR's brief was authored AFTER Kyron pasted current CLAUDE.md Rule 17 content (per Rule 17 itself), making FU-N the canonical example of source-verification at brief-authoring time refining the discipline it itself implements.

---

## ✅ /post-merge slash command discovery failure (LOW, methodology — banked 2026-05-19, PR #217 cycle) — CLOSED 2026-05-19 (PR #219 cycle, second data point)

**RESOLVED 2026-05-19 (PR #219 cycle, second data point).** Both `/dispatch` and `/post-merge` displayed "unrecognized" on operator CLI but executed cleanly CC-side across PR #217 (d84a752) /post-merge cycle and PR #219 (0b3f058) /dispatch + /post-merge cycle. Pattern confirmed — cosmetic dual-surface gap, not execution failure.

/post-merge slash command discovery failure (LOW, methodology — banked 2026-05-19, PR #217 cycle). During the first deployment of /post-merge as part of PR #217's post-merge sequence, the operator-facing CLI surface displayed the command as unrecognized despite the slash command system successfully injecting the .claude/commands/post-merge.md body into CC's context (CC executed the canonical sequence end-to-end and produced commit 0e390e8). Investigate: does .claude/commands/ require additional registration step (settings.json, CC restart, plugin reload)? Is the operator-side recognition mechanism distinct from the CC-side execution mechanism? Same investigation may apply to /dispatch. Next action: verify on the next dispatched PR whether /dispatch displays as recognized; if both commands fail operator-side recognition while still executing CC-side, document the dual-surface gap in CLAUDE.md § Dispatcher tooling.

Documented in CLAUDE.md § Dispatcher tooling > Known behavior. Tooling works as designed; only the CLI display is misleading.

---

## ✅ `@apply bg-[color:var(--color-X)]` sweep in `src/index.css` (LOW, refactor — banked PR #219, 0b3f058) — CLOSED 2026-05-18 (PR #221, e074b50)

**RESOLVED 2026-05-18**

Banked from PR #219 (0b3f058) audit. 4 call-sites in `src/index.css` `@layer components` definitions (`.btn-secondary`, `.card`, `.input`, `.label`) use `@apply` with arbitrary-value CSS-var syntax — out of scope for the JSX sweep that PR #219 addressed.

`@apply` resolution semantics may differ between arbitrary-value (`@apply bg-[color:var(--color-card)]`) and named-utility (`@apply bg-card`) syntax inside `@layer` rules. Requires verification that the compiled output is byte-equivalent before sweeping.

**Next action:** scratch-build verification — change one of the 4 call-sites to named utility, run `npm run build`, compare compiled `dist/assets/index-*.css` for that class rule against baseline. If equivalent, ship the sweep. If divergent, document the cause and leave as-is.

**Banked:** PR #219 (0b3f058).

Shipped via PR #221 (e074b50). Audit confirmed runtime-equivalent at default opacity; capability-additive (opacity-modifier support gained on `.card` / `.input` / `.btn-secondary` / `.label`). Bundle grew ~400 bytes — accepted. Channel-split tokens per PR-C-FU3 design preserved.

---

## Phase 7-8 Pre-Track Verifications

Five items surfaced in the May 2026 design conversation; each is small enough to resolve in the design pass for its respective track. See `docs/phase7-8-implementation.md` § 9 for full context.

- **PH7-8-Q1 (Track D)** — At-risk threshold design: per-award configurable (Centurion at 80 apps differs from API at 80%) vs single percentage. Recommended: per-award configurable, settable in `config/awardsRuleset/{year}`. Resolve in Track D design pass before D5.

- **PH7-8-Q2 (Track E)** — Verify `dailyNudgeTime` is per-agent on the user doc (existing E6 ProfileScreen code suggests so). Quick code check in `src/components/profile/ProfileScreen.jsx` + `loggingModeService.js`. Resolve before Track E design pass starts.

- **PH7-8-Q3 (Track F)** — Decide whether "concern"-category coaching notes surface in any manager-overview dashboard, or strictly individual-agent context. Default proposal: individual-agent only. Resolve in Track F design pass.

- **PH7-8-Q4 (Track G)** — Confirm "Other" custom line items cap of 5 per group (proposed, not locked). Decide line-item naming ownership (Tenant Admin curated vs free-text agent-defined). Resolve in Track G design pass.

- **[RESOLVED — H1 PR #300] PH7-8-Q5 (Track H)** — `agentType` enum does NOT exist on user docs; pre-empted by `isBdoDso: boolean` (read at `awardsEngine.js:profile.isBdoDso`). No `agentType` field required in H1 schema. RESOLVED in Track H H1 PR #300.

Banked from PR #235 (`0b8d04d`) (Phase 7-8 docs integration). Each FU closes individually when its corresponding track design pass resolves the verification: PH7-8-Q1 in Track D design pass (before D5), PH7-8-Q2 before Track E design pass starts, PH7-8-Q3 in Track F design pass, PH7-8-Q4 in Track G design pass, PH7-8-Q5 before H1 schema PR.

---

## Workshop-Driven Roadmap Revision Items (2026-05-20)

Banked from the Tatil Life manager workshop of 2026-05-19. Canonical analysis: `docs/AgencyTrack_Workshop_Roadmap_Revision.md`. Each item resolves in its own design/implementation pass — these are scope registrations, not blockers.

- **[SHIPPED — I1/I2/I3/§6 ALL SHIPPED] Track I — Manager Activity Reporting.** Design spec at `docs/AgencyTrack_TrackI_ManagerWAR_DesignSpec.md`. I1 (Manager WAR + JFW + upline browse + activity standards + overrides) shipped PRs [#254](https://github.com/Kelsean868/agencytrack/pull/254)→[#266](https://github.com/Kelsean868/agencytrack/pull/266) + [#268](https://github.com/Kelsean868/agencytrack/pull/268). I2 (Monthly Recruiting Roll-up) shipped PR [#280](https://github.com/Kelsean868/agencytrack/pull/280). I3 (Accountability Flag tier-1/tier-2) shipped PRs [#271](https://github.com/Kelsean868/agencytrack/pull/271) + [#275](https://github.com/Kelsean868/agencytrack/pull/275). §6 (License-state + CBTT compliance signal) shipped PR [#299](https://github.com/Kelsean868/agencytrack/pull/299) (`71717af`). **Track I §9 (isProducingManager personal-production panel) and §6 doCreateUser default remain open — see LOW items below.**

- **[SHIPPED — F1 #242 + F2 #244 + F3 #246 + F3.1 #248 + F2.1 #250 — Track F arc COMPLETE] Track F extension — structured Joint-Call Observation Log + appointment-bound Prospect-Info form.** Joint-Call Log shipped: `jointCalls` subcollection, rank-based privacy mirroring F1, structured field set (meetingType/needCovered enums, appointment kept + conditional next-meeting-date, comments, saleMade, coachingMinutes, trainingIdentified), tabbed integration with F1 modal. Prospect-Info shipped: `prospectInfo` subcollection, **SUBMISSIONS-style privacy** (agent owns/reads/edits OWN; managers in scope READ; manager writes DENIED — opposite direction from F1/F2), appointment-bound (intendedAppointmentDate REQUIRED), agent-facing "Joint-Call Prep" NAV tab + third read-only "Prospect Info" tab in `CoachingNotesModal`. F3.1 observation↔prep link shipped (#248). F2.1 BM in-app notification shipped ([#250](https://github.com/Kelsean868/agencytrack/pull/250)). **Remaining open items**: F2.2 (email-to-BM), Track H/G needCovered + prospectingSource + policyType taxonomy confirmation — see § Track F F2 / F3 deferred items below. Roadmap §3.2.

- **[SHIPPED — H1 PR #300] Track H schema** — Source-of-Prospect / Cash-with-Application / Policy-Delivery-Date added to `policies` collection schema; demographics held out; Need-Covered → joint-call form. PRD §7.4 + §9 updated in H1 PR #300. Roadmap §3.3.

- **[PARTIAL — floors portion SHIPPED PR #238 `1b05eb7`] Quick win — weekly activity floors.** `config/companyMinimums.weeklyActivityFloors` schema extension shipped; `tatillife_south` seeded with Appendix A (60/40/20/15/10/10/1/1/4800/100); `WeeklyStandardCard` on AgentDashboard surfaces Expected vs Actual with per-row Met/Close/Below status. **Remaining fast-follows** (own PRs):
  - **[SHIPPED — Track E(b) PR #317 `364fbfc`] Tenant-Admin in-app editor for weekly floors** — `EditConfigModal` extended with scrollable 10-row floors section; `setCompanyMinimums` extended to validate and write `weeklyActivityFloors` block when provided; `CompanyConfigPanel` passes `currentFloors`; backward-compat preserved (calling without floors leaves existing block unchanged). 6 new unit tests in `goalsService.test.js`. 1319/1319 tests passing.
  - **[RESOLVED — 2026-05-25 source audit]** Expected/Actual relabel — investigated KPICard / MasterSheet / MeetingMode / AgentAwardsPanel. None use "Objective/Variance" jargon in activity-standard surfaces. WeeklyStandardCard (shipped PR #238) is the authoritative "Expected vs Actual" surface; all others show single-value metrics or award-domain labels ("Achieved/On Track/At Risk/Far Off") where the terminology is semantically correct. No code change required.
  - **[PLANNED] True telephone-contacts wizard field** — floor #2 currently uses `telContacts` which falls back to `qualifiedApproaches` via `extractFields`. A dedicated "Telephone Contacts" field on the wizard's Step2Telephone (count of dial attempts that resulted in a conversation) auto-improves floor #2 accuracy with no schema change downstream — the `telContacts` key is already wired throughout the codebase (`AgentDashboard.jsx:41`, `MasterSheet.jsx:106`, `SubmissionViewer.jsx:136`, etc.). Surfaces the proxy footnote on `WeeklyStandardCard` as redundant once shipped.
  - **[PLANNED] Manager-side roll-up of floor adherence** — Track F adjacency: surface "agents below weekly floor" as a manager-overview signal alongside drill-down. Resolve in Track F design pass.
Roadmap §3.5.

- **[SHIPPED — Track E(c) PR #319 `fc5ea10`] Social/content KPIs wizard step** — new `StepSocialMedia.jsx` wired into WizardForm Screen 1 ("Prospecting & Calls") as 3rd sub-component; fields: `socialPostsTotal`, `socialEngagementTotal`, `socialInboxEnquiries`, `namesFromSocial`, `socialPlatformBreakdown` (Facebook/Instagram/WhatsApp/LinkedIn); collapsible per-platform breakdown toggle (local state, not persisted); `namesFromSocial` standalone (Step5NewNames frozen); `extractFields.js` updated for both schema variants; 7 tests in `StepSocialMedia.test.jsx`; `NumericField`/`CurrencyField`/`SuggestedField` in `CardStack.jsx` gain `htmlFor`/`id` a11y wiring. Personal Growth/CPD log (Career Portal / Phase 8) still planned. Roadmap §3.4.

- **[RESOLVED] Workshop decisions** — Manager WAR = new Track I; prospect-info form lives in AgencyTrack (Tatil has no company CRM); Track H columns per §3.3; CRM stance = reporting/coaching side, behind §0 guardrail; future tightly-integrated CRM separately scoped.

Banked from PR #236 (`58ebb2c`) (workshop-driven roadmap revision). Each PLANNED item closes when its design/implementation pass ships; the DECISION LOGGED item closes when Track H design absorbs the column decision; the RESOLVED item is for audit trail only.

---

## Track I I1.3a — Full-freshness jointCalls-write trigger (banked PR #258)

Banked from I1.3a dispatcher decision (PR [#258](https://github.com/Kelsean868/agencytrack/pull/258), `fe494be`).

The `onWarWrite` CF recomputes `jfwCount` only when a WAR document is saved. A joint call logged *after* a save is not reflected until the manager saves again. For a weekly submission cadence this is acceptable, but a `jointCalls`-write trigger would provide full freshness (count updates immediately when a call is logged).

- **[PLANNED] Full-freshness trigger** — Add a second trigger on `tenants/{tenantId}/users/{agentId}/jointCalls/{callId}` writes (create + update) that resolves the manager's WAR doc for the corresponding week and recomputes `jfwCount`. Requires:
  - Reading the joint-call doc's `authorUid` + `appointmentDate` to resolve `weekStart` (Sunday of that week, using the UTC-noon `getTriniSundayString` pattern already in `functions/index.js`).
  - Looking up the WAR doc at `tenants/{tenantId}/managerWeeklyReports/{authorUid}_{weekStart}` (the doc may not exist if the manager hasn't opened the WAR for that week yet — handle gracefully with an early return).
  - Reusing `computeJfwCount` + `shouldWriteBack` from `functions/war/jfwCountLogic.js` — the query must re-run to get the current full count (can't just increment/decrement reliably under concurrent writes).
  - Loop-guard: the write-back sets only `jfwCount` via Admin SDK `.update()`; the `onWarWrite` trigger fires on that update but immediately short-circuits (count unchanged → `shouldWriteBack` returns false).
  - Performance note: the full collectionGroup re-query runs on every joint-call write for the manager's current week. Acceptable at pilot scale; at larger scale, an atomic counter (`FieldValue.increment`) would be safer but would drift on deletes.

---

## Track F F1 — Coaching Notes deferred items (banked PR #242)

Dispatcher decisions in F1 intentionally deferred the following for follow-up PRs:

- **[PLANNED] Delete/archive own notes** — F1 allows edit of own note body/category only; no hard-delete, no archive. Author must be able to withdraw a mistaken note. Scope: `allow delete: if isManager() && getTenantId() == tenantId && resource.data.authorUid == request.auth.uid` rule addition + soft-delete UI (archive flag) vs hard-delete (dispatcher decision at design time). Low risk to rules; no schema migration needed.

- **[PLANNED] `isPinned` field** — Omitted for F1 (store-forward compatible: notes written before the field is added will sort correctly once pinned notes sort to top). Scope: add `isPinned: boolean` default-false to `addCoachingNote`; add pin toggle to `NoteCard`; `updateCoachingNote` `hasOnly()` allowlist must include `isPinned`. Composite index update: add `isPinned DESC` before `createdAt DESC` in both indexes.

- **[PLANNED] Branch-scoped peer-BM exclusion** — Currently a BM can read coaching notes on agents in any branch (tenant-scoped). The correct model is: BM reads only notes on agents in their own branch. Unblocked when `branchId` is denormalized on every coaching note (mirrors `agentUnitId` for UM). Requires: `agentBranchId` field on each note; new Firestore composite index; rule update for `branch_manager` scope check. Low priority — no peer BMs currently exist in tatillife_south.

- **[PLANNED] Full per-agent drill-down route** — F1 uses the MasterSheet Notes icon button as interim entry point (per-agent, no submission required). The PRD's intended entry point is a `/manager/agent/:agentId` route with an agent-mirror dashboard (Track F F3+). `CoachingNotesModal` is designed as a modal for now; it can be embedded as a panel on the full route once that route exists.

- **[PLANNED] PH7-8-Q3 resolution** — Decide whether `concern`-category coaching notes surface in any manager-overview dashboard signal. F1 answer: individual-agent only. Design pass for Track F F3+ should revisit.

Banked from PR #242 (`d5102e5`) (Track F F1 coaching notes).

---

## Track F F2 — Joint-Call Log deferred items (banked PR #244)

Dispatcher decisions in F2 intentionally deferred the following for follow-up PRs:

- **[SHIPPED — PR [#250](https://github.com/Kelsean868/agencytrack/pull/250) `4fb54a7`] F2.1 — BM notification on joint-call submit.** Best-effort client-side in-app notification — no CF needed. The existing `allow create: if canManage(tenantId)` rule on `/tenants/{tid}/notifications` already permits the write. `resolveBmInfo(tenantId, agentId)` helper reads `users/{agentId}.branchId` → `branches/{branchId}.managerId`; if `bmUid && bmUid !== authorUid`, writes a `manager_alert` notification to `tenants/{tid}/notifications` after the joint-call save. Failure wrapped in try/catch — save never blocked. Notification body is alert-only ("Joint call logged for {agentName}") — no coaching/observation detail. **Track F arc COMPLETE** (F1 #242, F2 #244, F3 #246, F3.1 #248, F2.1 #250). **F2.2 (email-to-BM) still queued — see below.**

- **[PLANNED] F2.2 — Email-to-BM on joint-call submit** — deferred from F2.1. Actual email notification to the branch manager via the `mail/` Trigger-Email Firebase Extension queue + a new Cloud Function. F2.1 ships the in-app signal; F2.2 adds the out-of-band alert for BMs who are not actively logged in. Roadmap §3.2(a). CF needed because the email write goes through the `mail/` queue (not client-writable in the same way as notifications).

- **[SHIPPED PR #246 `cded72f`] F3 — Prospect-Info form.** Appointment-bound — captured for a specific joint call so the manager arrives informed. Fields shipped: client name/age/occupation, `prospectingSource` enum (11 values: seminar / booth-event / referral / cold-call / social-media / orphan / existing-client / family-friend / BOA / self / other), `appointmentType` enum (2nd-interview / closing-interview), `objections` enum multi-select (no-money / no-need / no-hurry / no-confidence), `policyType` (free text — no existing product taxonomy), `intendedAppointmentDate` (REQUIRED — appointment binding per §0 guardrail). **Distinct privacy direction from F1/F2**: SUBMISSIONS-style (agent owns/reads/edits OWN; managers in scope READ; manager writes DENIED). New agent NAV tab "Joint-Call Prep" + manager read-only "Prospect Info" tab in `CoachingNotesModal`. Track F is now **COMPLETE**.

- **[FLAGGED PROVISIONAL] `needCovered` enum taxonomy** — F2 ships with 9 provisional values: `income_protection`, `mortgage_or_debt`, `education_funding`, `retirement_planning`, `final_expenses`, `wealth_accumulation`, `critical_illness_or_health`, `business_protection`, `other`. No existing codebase taxonomy at F2 banking time (Track G Money Needs Worksheet is planned but unbuilt; roadmap §3.3 routes Need-Covered to the Joint-Call Log from Track H). Confirm/adjust the enum during Track H column-decision design or Track G Money-Needs design — whichever lands first. Replacement is a one-line enum update in `jointCallsService.js` + `firestore.rules` (two `in` predicates in create + update rules). No data migration if values are added; if values are renamed/removed, audit existing docs first. Confirmed values should be moved to a shared `config/` collection or constants module so both surfaces share one source.

- **[PLANNED] Cross-agent "manager joint-call summary" roll-up** — per-agent list is sufficient for F2 (mirrors F1 surface). A manager-overview roll-up (e.g., "joint calls logged this month across my unit/branch", "appointments-kept rate by agent") is a later enhancement. Could surface on a Manager Overview page or Track F F3+ drill-down route.

- **[PLANNED] Client delete/archive + `isPinned`** — deferred together with the F1 equivalents (low risk; same shape). Joint-call observations are higher-value historic records than free-text notes — delete/archive is even more sensitive here; design pass should consider whether managers should be allowed to delete observations they authored, or whether only an "amended" state with an audit trail is acceptable.

Banked from PR #244 (`6694f30`) (Track F F2 joint-call log).

---

## Track F F3 — Prospect-Info deferred items (banked PR #246)

Dispatcher decisions in F3 intentionally deferred the following for follow-up PRs:

- **[SHIPPED — PR [#248](https://github.com/Kelsean868/agencytrack/pull/248) `4281991`] F3.1 — Observation ↔ Prep link.** `prospectInfoId` optional field on the `jointCalls` doc; `affectedKeys().hasOnly([...])` update rule extended; `addJointCall`/`updateJointCall` accept `prospectInfoId`; "Link to prospect prep" selector in `JointCallsTab` add form + `CallCard` edit; linked-prep summary (name · date) on observation card in view mode. Agent prep view unchanged (link lives on the observation, not the prep — no leak). Emulator rules 13/13 (12a author sets prospectInfoId ALLOW; 12b agent read with new field DENY — F2 boundary re-confirmed).

- **[RESOLVED — PR [#252](https://github.com/Kelsean868/agencytrack/pull/252) `3478ef0`, 2026-05-21] `prospectingSource` enum taxonomy** — Head-of-sales confirmed the BOA → `bank-referral` rename per Track I spec §5 (intra-ANSA Bank Originated Account, distinct from generic `referral` because conversion rate and average policy size differ materially). Selectable form options now offer `'bank-referral'` (label "Bank Referral (BOA)"); rule additively accepts both `'bank-referral'` and `'BOA'` during transition. Display-label superset (`PROSPECTING_SOURCE_LABELS`) keeps a label for `'BOA'` so legacy docs render as "Bank Referral (BOA)". Track H §3.3 Source-of-Prospect import path unchanged.

- **[RESOLVED — PR [#252](https://github.com/Kelsean868/agencytrack/pull/252) `3478ef0`, 2026-05-21] `policyType` free-text** — Replaced with exported `POLICY_TYPES` enum per Track I spec §9 (8 Tatil product categories: Critical Illness / Final Expense / Term Life / Whole Life / Universal Life / Endowment / Pension-Annuity / Mortgage-Credit Life). Both `ProspectInfoPanel` add and edit forms swapped from `<input type="text">` to `<select>`. Existing free-text values in legacy docs display verbatim via `POLICY_TYPE_LABEL[v] ?? v` fallback (no rule enum check — `policyType` was only key-present-validated, so no rule update needed). Backfill optional; not done as part of this PR.

- **[RESOLVED — PR [#368](https://github.com/Kelsean868/agencytrack/pull/368) `1f66c27`, 2026-05-27] Refactor `SOCIAL_PLATFORMS_ATTRIBUTION` into a shared constants module** — moved to `src/utils/prospectingConstants.js`; all consumers (`prospectInfoService`, `policiesService`, `PolicyLedgerPanel`, `ProspectInfoPanel`) updated; cross-service import eliminated.

- **[PLANNED] Delete/archive own preps** — F3 prevents delete entirely (`allow delete: if false`). The agent should be able to retract a prep created for an appointment that no longer happens. Scope: rule update to allow agent-own delete OR soft-delete `archived: boolean` field. Mirror the dispatcher decision pattern from F1/F2 deferred-delete items.

- **[PLANNED] BM notification on F3 prep submit** — Symmetric to F2.1. When the agent saves prospect-info, queue a notification to their branch manager / unit manager so the chain knows a joint-call prep is ready. Same tenant-scoped CF dependency as F2.1.

- **[PLANNED] Cross-agent "manager prep summary" roll-up** — per-agent list is sufficient for F3. A manager-overview ("preps due this week across my unit/branch") is a later enhancement on the eventual Manager Overview / Track F drill-down route.

Banked from PR #246 (`cded72f`) (Track F F3 prospect-info).

---

## Cross-branch test fixture: A11Y_BRANCH_MANAGER_2 (LOW, banked PR #266)

**Scope:** A second branch manager account in a DIFFERENT branch from `A11Y_BRANCH_MANAGER` (currently `tatil_south`), plus a unit manager seeded in that second branch. Needed so cross-branch / forgery rule negatives can be live-smoked against the Vercel preview.

**Why:** `managerActivityStandardOverrides` rule KEY FORGERY DENY (case 11: BM2 forging branchId for UM in another branch → DENY) and I1.3b cross-branch list DENY are currently only verified in the emulator. The live smoke uses `A11Y_BRANCH_MANAGER` + `A11Y_UNIT_MANAGER`, both in `tatil_south` — no cross-branch leg can run. A second fixture eliminates this gap.

**Also needed for:** I3 accountability flag (cross-branch denial), tenant-isolation smoke walks, future Track I PRs with cross-branch rules.

**Fix shape:** Provision `A11Y_BRANCH_MANAGER_2_EMAIL` / `A11Y_BRANCH_MANAGER_2_PASSWORD` accounts against a second branch in the `tatillife_south` Firebase project (create a second branch doc first if needed). Seed one UM account under that branch. Document both keys in `.env.example` (Rule 14). Update individual smoke scripts that need cross-branch legs to read the branch-2 credentials.

Priority: **LOW**. Not pilot-blocking; live cross-branch verification is nice-to-have on top of emulator coverage.

---

## `managerActivityStandardOverrides` update arm: pin managerId/tenantId immutable (LOW, banked PR #266)

**Scope:** The `allow update` arm in `firestore.rules` for `managerActivityStandardOverrides` does not currently assert that `request.resource.data.managerId` and `request.resource.data.tenantId` are unchanged from the existing doc. The `create` arm pins both fields explicitly (`request.resource.data.managerId == managerId` + `request.resource.data.tenantId == tenantId`). The document path `/{managerId}` is authoritative (document ID = managerId), so this is NOT a security hole — any forged managerId/tenantId in an update payload cannot affect rule scope or permission evaluation. But it is a hygiene gap: a client could silently overwrite those fields on update without the rule objecting.

**Fix shape:** Add `request.resource.data.managerId == resource.data.managerId && request.resource.data.tenantId == resource.data.tenantId` to the `allow update: if ...` predicate alongside `uplineInScope()`. One-line addition to `firestore.rules`.

**Why LOW and not a security hole:** The document ID (`managerId` in the path) is the authoritative scope key for all reads and permission checks. A forged `managerId` field value in the doc body cannot affect rule evaluation. The path is immutable by Firestore design. This is hygiene-only hardening.

Priority: **LOW**. Hygiene; no security impact. Bundle into the next PR that touches `firestore.rules` for any reason rather than opening a standalone PR.

---

## Track H — isBdoDso / monthsInIndustry / monthsAtTatil — no UI write path (LOW, banked H1 PR #300)

`isBdoDso: boolean`, `monthsInIndustry`, and `monthsAtTatil` fields on user docs are read by the awards engine (`awardsEngine.js`) and tenure-floor logic (`tenureFloors.js`) but are not settable via any UI screen. The only current write path is direct Firestore via Admin SDK.

- **`isBdoDso`** — read at `awardsEngine.js` (`profile.isBdoDso`). Must be `true` for BDO/DSO agents to receive the correct tier. Currently writable only via Firestore Console by a Tenant Admin.
- **`monthsInIndustry`** / **`monthsAtTatil`** — read by `resolveWeeklyAPIFloor` in `tenureFloors.js`. Populated at user creation only; no in-app edit path.

**Fix shape:** Wire all three fields into the PR-4b Edit User UI (`UserManagementPanel` edit form already handles role + branch + unit). Guard `monthsInIndustry`/`monthsAtTatil` to Tenant Admin + Platform Admin write only. `isBdoDso` may be managed by Branch Manager upward.

**Priority:** LOW. Awards engine reads correctly for agents whose profile has these set. Surfaced when closing PH7-8-Q5 during Track H H1 Phase 1 verify.

Banked from H1 PR #300 (Track H H1, 2026-05-24).

---

## Track H — orphan `jointCalls` CG index reconciliation (LOW, banked H1 PR #300)

**Scope:** `jointCalls` COLLECTION_GROUP index `authorUid + appointmentDate` (index ID `CICAgJiH2JAK`) is live in agencytrack-2a610 but NOT declared in `firestore.indexes.json`; superseded by the 3-field `authorUid + tenantId + appointmentDate` composite.

**Action:** Grep for any `jointCalls` collection-group query filtering `authorUid + appointmentDate` WITHOUT `tenantId` — if dead, delete deliberately via `firebase deploy --only firestore:indexes --force` (after confirming no other orphan would be swept in the same run); if still used, re-declare it in `firestore.indexes.json` to stop the drift.

**Priority:** LOW. No production query references the 2-field form today; the 3-field composite supersedes it. Resolve before any future `firestore:indexes` deploy to avoid deploying with undeclared live state.

Surfaced during H1 #300 Phase 6a deploy.

---

## Track H H1.2 — policies `update` rule value-guards (RESOLVED — PR #302)

**Was:** The `policies` `allow update` rule in H1 enforced `hasOnly()` field-allowlist + own-agent + `status == 'submitted'` but did NOT mirror the create-time value-guards into the update path.

**Resolution:** Arm A (body-edit) in H1.2's `firestore.rules` now includes all three FU Entry 2 value-guards:
- `sourceOfProspect in ['seminar','booth-event','referral','cold-call','social-media','orphan','existing-client','family-friend','bank-referral','self','other']`
- `request.resource.data.dateWritten <= request.time`
- `request.resource.data.proposedAPI > 0`

Also added: `request.resource.data.status == 'submitted'` guard (status unchanged) to Arm A, preventing Arm A from being used as a backdoor to set bogus statuses.

**Shipped:** PR #302 (`6886ed1`). Emulator DENY case confirmed (body-edit with bogus `sourceOfProspect` → DENY).

---

## ~~Track H H1.2 — history timeline display UI~~ ✅ RESOLVED PR #306

~~**Scope:** The `history` subcollection (`/tenants/{tid}/policies/{policyId}/history/{historyId}`) is written atomically with every status transition and verified by emulator tests. No display surface exists — the audit trail is data-only.~~

**RESOLVED in PR #306 (`b5c07d5`):** `PolicyLedgerPanel.jsx` gains an expandable per-policy history timeline (toggle button, loading spinner, `fromStatus → toStatus` status-badge rows, formatted `at` timestamp, "No history yet" empty state). `getPolicyHistory` updated with optional `agentId` param (when provided, adds `where('agentId','==',uid)` filter to satisfy the list rule). Composite index `(agentId ASC, at DESC)` on `history` deployed pre-merge. `tests/rules/policies.rules.test.mjs`: +2 emulator cases (agent list own history ALLOW; agent list other-agent DENY). H1.2 loosening #3 RESOLVED. Banked: H1.2 PR #302 (`6886ed1`).

---

## ~~Track H H1.2 — policies Arm B per-target field tightening~~ ✅ RESOLVED H2a #304

~~**Issue:** Arm B's `allow update` uses `affectedKeys().hasOnly([union of all per-transition fields])` — the full union covers every field any transition could write. A transition to a status that uses none of the settled-specific fields (e.g. `ntu`, `postponed`) could carry `settledAPI`, `dateIssued`, etc. alongside the status update — data pollution on non-counting statuses.~~

**RESOLVED in H2a PR #304 (`86541fe`):** Arm B rewritten with per-target conditional `affectedKeys().hasOnly([...])` — each target status only allows `status + statusUpdatedAt + that status's own fields`. Two emulator DENY cases added (`ntu` transition with `settledAPI` field DENY; `settled` transition with `ratedPremium` field DENY). Banked: H1.2 PR #302 (`6886ed1`).

---

## ~~Track H H1.2 — policies history `create` ownership/shape tightening~~ ✅ RESOLVED H2a #304

~~**Issue:** The history `create` rule did NOT verify that the agent owns the parent policy. A crafted client could write an orphan history doc under another agent's policy path.~~

**RESOLVED in H2a PR #304 (`86541fe`):** Agent arm now includes `get(/databases/$(database)/documents/tenants/$(tenantId)/policies/$(policyId)).data.agentId == request.auth.uid`, confirming parent-policy ownership before allowing history create. One emulator DENY case added (`agent-b write history on agent-a policy → DENY`). Banked: H1.2 PR #302 (`6886ed1`).

---

## Track H — H11 agent-side discrepancy/lapse surfacing (RESOLVED — both halves shipped)

**Issue:** After H2a ships manager confirmation, the agent's own Policy Ledger shows no indication of confirmation state, and the `policy_discrepancy` notification renders with the generic Bell icon (fallback in `TYPE_META`).

**Discrepancy half: RESOLVED** in Track H agent confirmation-surfacing PR #305 (`97a8493`):
- `PolicyLedgerPanel.jsx`: three-way footer (confirmed / settled-unconfirmed / non-terminal) with emerald "Confirmed by {manager}" chip, amber "Discrepancy" chip, value comparison line, and manager note.
- `NotificationDrawer.jsx`: `policy_discrepancy` `TYPE_META` entry → `AlertTriangle`/warning palette.

**Lapse half: RESOLVED** in Track H H2c PR #321 (`900a473`):
- `PolicyLedgerPanel.jsx`: `lapsed` muted grey badge + lapse date chip in policy footer.
- `NotificationDrawer.jsx`: `policy_lapsed` `TYPE_META` entry → `AlertTriangle`/danger palette.

---

## Track J (V2 Redesign) — Shell brand subline requires new data-fetch (LOW, banked 2026-05-30, PR #388)

The `design_handoff_v2_app/mockups/app-shell.jsx` `Sidebar` shows a tenant/branch subline below the "AgencyTrack" brand name (e.g. "Tatil Life · South"). The brief allowed this only if sourced from existing `useAuth()` context without a new data-fetch path.

**What's available now:** `useAuth()` exposes `tenantId` (e.g. `"tatillife_south"`) and `userProfile` (name, role, unitId, photoURL). Neither exposes a human-readable `tenantName` or `branchName`.

**Blocked path:** `tenantName` lives in a potential `/tenants/{tenantId}/config/settings` doc or a separate tenant registry — there is no pre-loaded context for it in `AuthContext`. Adding it would require either: (a) extending `AuthContext` to load a tenant doc on login, or (b) a new one-shot Firestore read in Sidebar.

**Fix shape:** Add `tenantName` (and optionally `branchName`) to `AuthContext`'s resolved value, loaded from `config/settings` or a top-level `tenants/{tenantId}` doc immediately after the user profile resolves. Pass `tenantName` through Shell → Sidebar props. The brand subline renders as `{tenantName}` (or `{tenantName} · {branchName}` if branch available).

**Priority:** LOW. The subline is a polish detail; the Shell is fully functional without it. Revisit before the Track J smoke or when `AuthContext` is next touched.

Banked: Track J App Shell (redesign/shell PR #388 (`63cb0cf`)), 2026-05-30.

---

## Track J (V2 Redesign) — `surfaceSoft` token revisit across V2 screens (LOW, banked 2026-05-30, PR #388)

The mockup `app-tokens.jsx` defines `surfaceSoft: '#F4F2EC'` (light) / `'#1F1B17'` (dark) as a mid-level surface between `surface-raised` (#FAFAF8) and `surface-muted` (#F0EFE9). Used in the App Shell for the topbar search box background and the RoleSwitcher prototype scaffolding.

**Decision for this PR:** reuse `--color-surface-muted` as the closest existing token (brief §2 explicit decision — "no new token").

**When to revisit:** If `surfaceSoft` appears as a background in ≥3 distinct V2 screens (outside the prototype RoleSwitcher) and `surface-muted` reads visually wrong in context, introduce `--color-surface-soft` in both `:root` and `.dark` in `src/index.css` + a matching Tailwind utility in `tailwind.config.js`. Cap at one new token; do not mint per-screen values.

**Priority:** LOW. One token gap in one element (search box). Verify whether later V2 screens also use `surfaceSoft` widely before promoting.

Banked: Track J App Shell (redesign/shell PR #388 (`63cb0cf`)), 2026-05-30.

---

## Track J (V2 Redesign) — Component test coverage for CareerPortal / HistoryTab / AgentAwardsPanel / HomeV2 rewrites (LOW, banked 2026-05-30, PRs #389 + #390 + #391 + #393)

The Track J v2 batch (Career Portal, History, Agent Awards) and the J-AD-home PR replaced substantial visual and structural code without adding new unit tests for the rewritten components. Existing tests that existed before the rewrites still pass (1625/1625), but the new sub-components introduced in the rewrites have no dedicated coverage:

- **`CareerPortal.jsx`** — `LadderCoin`, `LadderNode`, `CareerLadder`, `TimeToNextCard`, `TrajectoryCard`, `CommitmentScorecard`, `LevelDrillDrawer`. The pre-existing `CareerPortal.tapTargets.test.jsx` (3 tests) still covers the edit-mode button tap targets.
- **`HistoryTab.jsx`** (new file) — `HistoryAnchorStrip`, `YearHeatmap`, `HistoryFilterRow`, `WeekCard`. Zero unit tests. (`computeSubmissionStreak` extracted to `src/utils/submissionStreak.js` by PR #393 — pure module, ideal first test target.)
- **`AgentAwardsPanel.jsx`** — `AwardDonut`, `HeroAwardCard`, `GroupHeader`, `AwardCard`, `RatioMiniSpark`, `RatioTrendCard`, `AwardDrillDrawer`. The pre-existing `AgentAwardsPanel.test.jsx` (7 tests, `usesPolicyLedger` path coverage) still passes but does not exercise any of the new v2 visual components.
- **`src/components/dashboard/HomeV2/` (added PR #393)** — `HeroCard`, `PulseStrip` (+ chip + viz primitives), `MiniViz` (`MiniSparkline`/`MiniDonut`/`MiniBars`/`MiniBadge`), `NeedsActionBanner`, `RecentCompact`, `StandardDetail`, `StandardRow`, `DeliveryStripCard` (stub), `index` (orchestrator). Zero unit tests. The orchestrator's Pulse-chip useMemo carries non-trivial derivation (streak / awards-engine top-contention / persistency aggregate / floor met-count) and is the most valuable single test target in this set.

**Why not added in the batch PRs:** The green-channel batch contract was "build each passing screen to PR-open and move on" — adding test suites per screen would have expanded scope. Production smoke (#393 → 22/22; nav IA → 34/34; awards/history → 14/14; career → 16/16) validated real-browser behavior; the existing tap-target and policy-ledger tests cover the critical functional paths.

**Fix shape:** Add `CareerPortal.v2.test.jsx`, `HistoryTab.test.jsx`, `AgentAwardsPanel.v2.test.jsx`, `HomeV2.test.jsx`, and `submissionStreak.test.js` covering at minimum:
- empty-state render, loading skeleton render, and one key interaction per visual component (e.g. clicking a locked LadderNode opens the drawer; clicking a WeekCard calls `onView`; clicking an AwardCard opens the drill drawer with ESC close; clicking the Standard PulseChip opens StandardDetail; ESC closes it).
- For `submissionStreak.js`: pure-function tests over crafted submission arrays (current = 1/0/N; gaps reset; year boundary; weekStarting 7-day diff).
- For `HomeV2/index.jsx`: mock services + `useAuth` and assert each Pulse chip's status text/tone given representative input shapes.

Mock `useAuth`, service calls, and `BadgeGrid` as in the existing tapTargets test.

**Priority:** LOW. Production is healthy; smoke verified real-DOM behavior in both themes. No data integrity or security impact. Bundle into the next PR that touches one of these files for any reason.

Banked: Track J v2 batch (PRs #389 `8371818`, #390 `f151183`, #391 `84abe6e`), 2026-05-30; extended to include HomeV2 (PR #393 `10b7e46`), 2026-05-31.

---

## ✅ Track J (V2 Redesign) — Agent CommissionPlayground removed from CareerPortal (LOW, banked 2026-05-30, PR #389) — RESOLVED 2026-05-30 (PR #392)

**RESOLVED:** The v2 Agent Dashboard nav IA PR (J-AD-nav, `redesign/agentdash-nav`, PR #392) adds a dedicated `commission` tab to `AgentDashboard` NAV_ITEMS, wired to the existing `CommissionPlayground` component. Agent access restored as a standalone Tools-group nav item. Manager access via `GoalsPanel` unaffected.

~~The v2 Career Portal redesign removed `CommissionPlayground` from `CareerPortal.jsx`. It was the only agent-facing surface for the Commission Playground; managers retain access via `GoalsPanel.jsx`.~~

Banked: Track J v2 Career Portal (PR #389 `8371818`), 2026-05-30. **RESOLVED: PR #392.**

Banked from Track H agent confirmation-surfacing PR #305 (`97a8493`).

---

## ✅ Track J (V2 Redesign) — Game Plan v2 screen deferred; Money Needs re-nesting pending (LOW, banked 2026-05-30, PR #392) — RESOLVED 2026-06-03 (PR #438)

**RESOLVED:** Game Plan v2 **Slice 1** (PR #438) ships the Game Plan hub shell and re-nests the nav exactly as the restore path prescribed:
- Added `{ id: 'game-plan', label: 'Game Plan', tabId: 'game-plan', Icon: BarChart2, sectionLabel: 'Planning', badgeNew: true }` before `money-needs`.
- Converted `money-needs` to `{ child: true }` (dropped `sectionLabel`) — still its own tabId/route, reachable as a nav child and from the hub's rail card.
- The `game-plan` tab renders a composition-only hub (PlanAnchorStrip / StepRail / PlanCascade / disabled CommitPreviewCard) reading the EXISTING `moneyNeeds` worksheet — no new collection, write, rule, or index.

**Corrected diagnosis (Rule 11):** the original restore-path note said "the `goals` tab (GapAnalysisPanel) also moves under Game Plan." That was superseded by the Slice-1 locked decision — **Goals stays a sibling under Planning**; only Money Needs nests. Game Plan will *feed* Goals on commit (a deferred slice), it does not nest it.

Banked: Track J v2 Agent Dashboard nav IA (PR #392), 2026-05-30. **RESOLVED: Game Plan v2 Slice 1 (PR #438).**

---

## Track J (V2 Redesign) — Game Plan v2 — remaining slices (MEDIUM, banked 2026-06-03, PR #438)

Game Plan v2 **Slice 1** (PR #438) shipped the shell + Money Needs re-home. The remaining slices each introduce **net-new data** (a new store, read, write, or user attribute) and were deliberately deferred — none is a port:

- **Year Plan (allocator):** product-line split, percent/direct mode, add-line, award-eligibility calc, license-profile tabs. Needs a stored per-line allocation. → new store.
- **License-profile user attribute:** Composite / Life-only / General-only — "not stored on the user yet." → new user field.
- **Monthly Plan:** 12-month target-vs-actual chart, the monthly **target store** (plan) + **actual-by-month read** (production), variance + "to finish the month" suggestions. → new store + read.
- **Review & Commit → Goals write:** the loop-close — writes personal API/apps into the 3-tier Goals system. The status pill goes live (draft → committed) only here. → new write.
- **Manager review / suggest workflow:** the share-with-manager affordance (the NEW one — distinct from Money Needs' existing visibility toggle, which Slice 1 preserved), manager read of the shared plan, suggest-a-change + notify, plan-health banner. → new workflow.
- **Commission Playground fold:** folding the Playground ratio engine behind Year Plan cases / retiring the standalone tab. Untouched in Slice 1 — reconcile later.
- **Weekly/daily activity planner (Path B) — CONFIRMED derived + tracked, intended next slice:** surface the personal weekly activity derived from the plan (the Commission Playground decomposition: income → API → apps → CIs → dials → prospects, weekly/daily), **plus** set-plan / log-actual / variance / manager roll-up. Net-new store + write surface + manager roll-up. **High priority — likely the next slice after Slice 1** (possibly ahead of Year Plan; final ordering set when scoped). Distinct from the company-floor weekly minimums in `WeeklyStandardCard`.

**Priority:** MEDIUM. Slice 1 is functional and honest on its own. Slices ship one brief + PR each.

Banked: Game Plan v2 Slice 1 (PR #438), 2026-06-03.

---

## Pre-existing color-contrast failures outside the sidebar (LOW, banked 2026-05-30, PR #392)

`axe` against the agent dashboard (local preview, post-`.sidebar-section` fix) still surfaces color-contrast violations that pre-date Track J and exist on main:

**Light mode (18 nodes remaining):**
- `.bg-success/10.border-success/20.gap-1` × 7 — WoW delta chips on the KPI Activity Trend strip (`AgentDashboard.jsx`). fg `#2d7a4f` on bg `#e3eae2` = **4.27:1** (needs 4.5:1).
- `.badge-sub` × 11 inside `.locked.badge-item[aria-label=" — locked"]` — locked-state badge subtitles in `BadgeGrid`. fg `#aeaaa8` on bg `#ffffff` = **2.3:1**.

**Dark mode (22 nodes remaining):**
- `.top-1\.5` × 1 — error-tint pill on a danger-bg surface. fg `#ffffff` on bg `#d96b5d` = **3.38:1**.
- `span[aria-label="<KPI>: Below"]` × 10 — below-floor status labels in `WeeklyStandardCard`. fg `#d96b5d` on bg `#372820` = **4.17:1**.
- `.badge-sub` × 11 — locked-badge subtitles (dark variant). fg `#766e63` on bg `#252019` = **3.21:1**.

**Root cause / fix shape:** Each cluster has a distinct cause and a different remediation:
- Success delta chips: bump `--color-success` darker in light mode (currently `rgb(45 122 79)`), OR remove the tint background, OR raise font-weight + size.
- Locked `.badge-sub`: bump the token (currently uses `--color-text-faint` muted further by 0.55 `opacity` on the `.locked` parent — root cause is the opacity stack, not the token).
- "Below" KPI spans: dark-mode `--color-danger` (`#d96b5d`) on `--color-danger-tint` background loses contrast; bump the dark `--color-danger` or darken the tint.
- `.top-1\.5` white-on-danger: that selector is the persistent-error pill — needs a darker red surface.

**Priority:** LOW. All pre-existing; none introduced by Track J PRs. Fix in a dedicated a11y-contrast cleanup PR scoped to these clusters — not piecemeal across feature PRs.

Banked: Track J v2 Agent Dashboard nav IA (PR #392), 2026-05-30.

---

## Track J (V2 Redesign) — HeroCard YoY-delta chip deferred (LOW, banked 2026-05-30, PR #393)

The v2 HeroCard mockup (`design_handoff_v2_app/mockups/app-dashboard-v2.jsx`) shows a "+18% vs LY" success chip next to the YTD API headline. The J-AD-home PR (PR #393) ships the HeroCard **without** this chip — current AgentDashboard state does not aggregate last-year submissions, and `getAgentSubmissions(tenantId, uid)` returns all submissions without a year filter, so any YoY computation today would walk the full result set in JS each render.

**Restore path:** Either (a) compute `lastYearTotals` in the same `useMemo` as `ytdTotals`, walking `allSubmissions` once and partitioning by year (cheapest — no new query); (b) add a dedicated `getLastYearSummary(tenantId, uid, year-1)` Cloud Function aggregator if performance becomes a concern. Render the chip with `text-success` and `↗` icon when YoY delta is positive, `text-danger` and `↘` when negative; hide when last-year data is empty.

**Priority:** LOW. The hero already shows YTD + progress + goal — the YoY chip is decorative motivation, not load-bearing. Address when polish bandwidth opens or alongside Phase 9 SM-target work.

Banked: Track J v2 Agent Dashboard home rework (PR #393), 2026-05-30.

---

## Track J (V2 Redesign) — DeliveryStripCard stubbed to null; wire to Track H policies (LOW, banked 2026-05-30, PR #393)

The v2 home mockup includes a `DeliveryStripCard` showing outstanding policies to deliver + a 30-day clawback clock. Its source data is `POLICIES` / `DELIVERY_STATES` from the mockup-only `cro-v2-shared.jsx` module — that exact data shape does not exist in Firestore. Track H's `policies` collection ships related lifecycle fields (`status`, `dateIssued`, eventually `policyDeliveryDate`) but with a different shape than the mockup's delivery state machine.

**Current state post-PR #393:** `src/components/dashboard/HomeV2/DeliveryStripCard.jsx` is a single-line component that returns `null`. The 2-col Recent panel right column wraps it cleanly — no console error, no layout gap visible.

**Restore path:**
1. Add a `policyDeliveryDate` field to the Track H `policies` schema (rules `hasOnly` allowlist + write surface) — or repurpose the existing `dateIssued` + a derived clawback window.
2. Wire `DeliveryStripCard` to read the agent's own outstanding-delivery policies via `getOwnPolicies(tenantId, agentId)` (already used by AgentAwardsPanel's `usesPolicyLedger` path).
3. Compute "days left in 30-day clawback" from `dateIssued + 30 days - today`; classify each policy as `delivered` / `at-risk` / `overdue`.
4. Apply red/amber/teal tone per state per the mockup. Match the column-header eyebrow + count pill pattern from the mockup.

**Priority:** LOW. The home is fully functional without the delivery surface; CRO/back-office is a separate planned surface (Track J §"CRO / back-office" in `design_handoff_v2_app/README.md §6`). Address when the CRO surface lands or Track H ships `policyDeliveryDate`.

Banked: Track J v2 Agent Dashboard home rework (PR #393), 2026-05-30.

---

## Track J (V2 Redesign) — AgentProductionView ranking uses self-only submissions → always rank 1, peers at 0 (BUG, banked 2026-05-31, PR #397 — **RESOLVED by PR #403**)

`AgentProductionView.jsx` fetched only the current agent's own submissions via `getAgentSubmissions(tenantId, agentId)`. The ranking loop iterated all users but filtered `allSubmissions` by each agent's ID — for all peers this yielded an empty array → `computeAgentTotals([])` = zero API. Result: the agent always appeared at rank 1; all peers tied at rank N with 0 API.

**RESOLVED in Track J P7 (PR #403):** the self-only ranking path is removed entirely. AgentProductionView now reads the P1 `leaderboards/{branchId}` aggregate via `useLeaderboard` — same source-of-truth as the standalone Leaderboard surface. Component test forces viewer at mock-rank-14 → pill renders "14" (proves the always-#1 bug is gone). Live smoke confirms `data-rank=1 data-total=6` on the test branch (vs old broken `1/1`).

Banked: Track J AgentProductionView v2 port (PR #397), 2026-05-31. **Resolved 2026-05-31 by Track J P7 (PR #403).**

---

## Track J (V2 Redesign) — Around-me panel + branch rank pill + shared production-ranking query (MEDIUM, banked 2026-05-31, PR #397; updated on pre-review — **RESOLVED for AgentProductionView by PR #403**)

Two surfaces omitted from PR #397 because both required accurate peer production data:

1. **"WHERE YOU RANK" around-me panel** — the v2 `prodreport-v2-scenes.jsx` right panel showing the 3 agents around the current agent in the branch ranking (one above, current, one below) with their API, initials, and unit.

2. **Branch rank pill in the hero** — "BRANCH RANK #N / M" badge top-right of the hero card. Removed on dispatcher pre-review: used the same self-submissions-only ranking (always rank 1) as the around-me panel, so displaying it as-is was misleading.

**RESOLVED for AgentProductionView in Track J P7 (PR #403):** rather than introduce a new shared `useBranchProduction` hook, both surfaces now consume the existing P1 `leaderboards/{branchId}` aggregate via `useLeaderboard` — the same source-of-truth the standalone Leaderboard surface uses. AgentProductionView's hero rank pill + new `WhereYouRankPanel` both render from the aggregate. Component test forces viewer at mock rank 14 → pill renders "14" (proves the always-#1 bug is gone). Live smoke confirms `data-rank=1 data-total=6` on the test branch (vs old broken `1/1`).

**Remaining out-of-scope (separate FU below):** `BranchManagerProductionView` ranked-leaderboard view-wiring + the standalone Leaderboard podium surface (PR #396 RankedLeaderboard pre-claimed the file). The aggregate doesn't yet carry the exact shape those surfaces want (e.g., apps column + %-of-leader bar in the leaderboard podium); a separate follow-up tracks wiring those views to the aggregate or extending it.

Banked: Track J AgentProductionView v2 port (PR #397), 2026-05-31. Updated on dispatcher pre-review. **Resolved 2026-05-31 for AgentProductionView by Track J P7 (PR #403); remaining manager/podium views deferred to a separate FU.**

---

## Track J (V2 Redesign) — Wire BranchManagerProductionView ranked table + standalone Leaderboard podium to the leaderboards aggregate (MEDIUM, banked 2026-05-31, carved out of PR #397 FU on P7 close)

P7 (PR #403) wired AgentProductionView's rank pill + around-me panel to the existing P1 `leaderboards/{branchId}` aggregate via `useLeaderboard`. Two adjacent surfaces still consume legacy data paths and should converge on the same source-of-truth:

1. **`BranchManagerProductionView` ranked table** — currently aggregates client-side via `getAllYTDSubmissions`-style logic. The aggregate already has the full per-branch ranking in rank order.
2. **Standalone Leaderboard podium / RankedLeaderboard surface** — PR #396 pre-claimed the file for an aggregate-driven rewrite, but the podium needs apps + %-of-leader bar shape that the aggregate doesn't yet carry.

**Shape:** Two sub-tasks. (a) Wire `BranchManagerProductionView` to `useLeaderboard` — pure consumer change, no aggregate field additions needed (the existing `name + unitName + periodApi + apps + rank + rankWithinUnit` shape covers the table). (b) For the Leaderboard podium / RankedLeaderboard, decide whether to extend the aggregate's entry shape (add `apps` if not already present, add `leaderApi` per period for the %-bar) or compute %-of-leader client-side from the entries' `periodApi`. The client-side option avoids touching the CF; only the aggregate read-shape contract changes.

**Priority:** MEDIUM. Resolves dual-source-of-truth between AgentProductionView (aggregate) and these two views (still legacy). Schedule when the V2 manager production view + leaderboard podium next come up.

Banked: 2026-05-31 (Track J P7 close, PR #403). Carved out from the resolved PR #397 around-me FU above.

---

## Track J (V2 Redesign) — AgentProductionView floor bar uses hardcoded default tenure bands; does not read tenant tenureApiFloors config (LOW, banked 2026-05-31, PR #397)

The YTD-vs-tenure-floor bar in `AgentProductionView` calls `resolveAnnualAPIFloor({ contractStartDate: userProfile?.contractStartDate })` with no `tenureApiFloors` argument. This uses `DEFAULT_TENURE_API_FLOORS` (150K/200K/250K/300K/400K/500K — board-confirmed, Tatil head-of-sales 2026-05-21). The tenant-admin can edit these bands via the `config/companyMinimums.tenureApiFloors` document (seeded via `seed-tenure-api-floors.mjs`), but `AgentProductionView` never reads that document, so any future tenant-admin edits are silently ignored.

**Fix shape:** Add a `getCompanyMinimums(tenantId)` call (already in `src/services/goalsService.js`) to fetch `tenureApiFloors` from Firestore; pass the result as the second argument to `resolveAnnualAPIFloor`. The call can be a one-shot `useEffect` independent of the submission fetch; the bar renders the default until resolved (no loading state needed — same pattern as the persistency effect).

**Priority:** LOW. The default bands are currently correct for Tatil; the risk materialises only if a tenant-admin updates the config. Address when the tenant-admin config editor or a band-change is actioned.

Banked: Track J AgentProductionView v2 port (PR #397), 2026-05-31.

---

## Track J (V2 Redesign) — Dual-consumable computations.js — eliminate the CJS twin entirely (LOW, banked 2026-05-31, P1a PR #399)

**Scope:** `src/lib/productionReport/computations.js` is ESM; gen-1 Cloud Functions are CJS. P1a (PR #399) ships a CJS twin (`functions/leaderboard/rankingLogic.js`) so the leaderboard CF can use the same period / totals / ranking logic. The twin is guarded by a CI-failing cross-check test, but two copies still exist and drift remains a maintenance cost.

**Fix shape (options, from cheapest to most invasive):**
1. **Move CFs to gen-2** (`firebase-functions/v2`) which supports `"type": "module"` in `functions/package.json` and native ESM `import`. Then `functions/leaderboard/rankingLogic.js` becomes `import { ... } from '../../src/lib/productionReport/computations.js'` — single source of truth. The blocker is auditing whether **all** existing gen-1 CFs (16 in `functions/index.js` plus the `war/` + `agentOfMonth/` sub-folders) migrate cleanly to gen-2; some use gen-1-only APIs (`functions.pubsub.schedule(...).timeZone()` is gen-1; gen-2 uses `onSchedule` from `firebase-functions/v2/scheduler` with a different shape).
2. **Make `computations.js` dual-consumable** by emitting both ESM + CJS via a small build step (rollup or esbuild) — adds a build dependency to the CF deploy.
3. **Extract `computations.js` to a shared subpackage** (`packages/production-report/`) with `"main"` (CJS) + `"module"` (ESM) entrypoints in its own `package.json`. Workspace-style. Invasive.

**Touches:** 11 existing consumers of `computations.js` (4 production-report views + 8 kiosk panels — confirmed in the routing audit). Migration would also affect the 7 functions Jest test files currently set up around CJS-only modules.

**Priority:** LOW. The cross-check test makes the twin safe; the maintenance cost of one mirror is small. Revisit when **either** (a) a third mirror pair is needed (would justify a real fix), or (b) gen-1 → gen-2 CF migration becomes work the team wants to do anyway.

Banked: Track J P1a CJS ranking mirror (PR #399), 2026-05-31.

---

## Track J (V2 Redesign) — P1b leaderboard CF: multi-tenant iteration (LOW, banked 2026-05-31, PR #400)

`functions/leaderboard/leaderboardAggregate.js` has `const TENANT_ID = 'tatillife_south'` hardcoded, mirroring the existing SEC-9c pattern (`sendSundayNudge`, `sendMondayNudge`, `flagMissedDeadlines`). The scheduled trigger recomputes leaderboards for that one tenant only.

**Fix shape:** When SEC-9c is addressed at the scheduled-CF layer (multi-tenant scheduled-function isolation), iterate all tenants in `tenants/` and call `computeAndWriteLeaderboards(tid)` per tenant. The on-demand callable already supports `data.tenantId` for `platform_admin`.

**Priority:** LOW. Single-tenant Tatil pilot is the only deployment.

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31.

---

## Track J (V2 Redesign) — P1b leaderboard CF: on-write trigger optimization (LOW, banked 2026-05-31, PR #400)

P1b uses a scheduled hourly recompute + admin-only on-demand callable. The doc is stale up to ~1 hour after a new submission. An onWrite trigger on `tenants/{tid}/submissions/{subId}` could recompute only the affected branch's leaderboard immediately (model `recomputeJfwCount`).

**Fix shape:** Add `onSubmissionWrite` trigger reading `change.after.data().agentId`, look up the agent's `branchId`, recompute that single branch's leaderboard. Loop-guard via comparing rank arrays or via a "skip if last write was self" sentinel.

**Trade-offs:** (a) freshness improves from 1h to seconds; (b) onWrite fires on every status update + draft save — needs gating on `before.status !== 'submitted' && after.status === 'submitted'` to avoid duplicate work (mirror the `onWarSubmitNotifyUpline` pattern); (c) cost increases linearly with submission volume (50 agents × 1 weekly submission ≈ 50 extra CF invocations/week — negligible).

**Priority:** LOW. The hourly scheduled trigger meets the "feels fresh" bar for an agent dashboard surface. Add when product needs sub-minute freshness (e.g. real-time leaderboard during a sales contest).

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31.

---

## Track J (V2 Redesign) — P1b leaderboard CF: reconciled-production swap point (FU-2 reference, banked 2026-05-31, PR #400)

The FU-2 reference (originally banked in PR #398 description): when `usesPolicyLedger` H3 flip-gate clears branch-wide and reconciled-production data is available for all agents, the leaderboard CF is the **single swap point** for the entire Leaderboard / Production Report family. Replace `loadInputs` in `functions/leaderboard/leaderboardAggregate.js` with a reconciled-source fetch; the rest of the pipeline (groupByBranch, rankForLeaderboard, agent-readable doc shape) is unchanged. All consumers (P3 podium, P4 around-me, P7 AgentProductionView, BM/UM ProductionViews, kiosk) inherit the switch via the aggregate doc.

**Prerequisite:** Branch-wide `usesPolicyLedger` (not per-agent opt-in).

**Priority:** MEDIUM (inherits from FU-2). Schedule when H3 flip-gate scope is confirmed.

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31. Cross-reference: FU-2 (PR #398 description; re-anchored on P1a + P1b).

---

## Track J (V2 Redesign) — P3 Production Leaderboard: converge the kiosk medal onto ui/MedalCoin (LOW, banked 2026-05-31, PR #401)

P3 introduces `src/components/ui/MedalCoin.jsx` as a parameterized primitive (rank + size + glow) backed by the existing `--color-medal-{1,2,3}-*` CSS vars. The kiosk's existing medal renders use the `.medal-N` CSS classes (also from `--color-medal-*` vars), so the gradients are already in lockstep at the token level — but the **kiosk renders its own DOM** (in `kiosk/panels/TVRankedLeaderboard.jsx` and adjacent), not the shared primitive.

**Fix shape:** Refactor the kiosk's medal renders to import `ui/MedalCoin` with size tuned to the kiosk scale (e.g. `size={56}`). Visual parity is guaranteed (same CSS vars). No token change. Reduces duplication and means future medal-coin tweaks (e.g. extra-large hero variant, different glow recipe) propagate to both surfaces.

**Priority:** LOW. Both surfaces already use the same tokens so they cannot drift; convergence is a maintenance simplification, not a correctness fix. Schedule when next visiting the kiosk surfaces.

Banked: Track J P3 production leaderboard surface (PR #401), 2026-05-31.

---

## ~~CommissionPlayground tabs lack default `React` import → blocks full RTL baseline~~ CLOSED

**CLOSED by D5 in Commission v2 S2 (PR #498 `381ed24`).** `import React from 'react'` added to `GoalDecompositionTab.jsx`, `ModalTargetingTab.jsx`, `ModeMixSlider.jsx`, `CommissionBreakdownTable.jsx`, and `InsightCard.jsx`. All 4 parked expand-dependent baseline tests now land (7-stage ladder render · localStorage persistence · tab-switch · `setGoals` write path) + 5 D4 AnchorStrip no-goal tests. Suite 2422/2422.

Banked closed: Item 5 (night queue, test-only), 2026-06-05. Resolved: Commission v2 S2, 2026-06-05.

---

## `CompliancePanel.nudge.test.jsx` timing flap — stabilize with proper async waits (**RE-OPENED — stabilization INCOMPLETE**)

**Scope:** `src/components/manager/__tests__/CompliancePanel.nudge.test.jsx` — 6 tests covering the S2 nudge-send + cooldown-chip interactions.

**History:**
- PR #502 (`d936c69`, 2026-06-05): wrapped all 7 `fireEvent.click()` sites in `await act(async () => { ... })`. 20× consecutive isolated green + 2426/2426 full suite ×2. Merged GREEN-CHANNEL as test-only stabilization.
- **4th occurrence — 2026-06-06 (CI run on PR #510 / run `27063421668`).** `Unable to find [data-testid="compliance-cooldown-chip"]`. Local 20× consecutive: clean. CI-environment timing differs — the `await act()` wrap is insufficient under constrained CI workers.

**Status: INCOMPLETE — RE-OPENED.** Local 20× green but CI-environment timing differs; next attempt must reproduce under CI conditions (`CI=true`, constrained workers) before fixing.

**Observed behavior (four occurrences):**
1. During the settlements security dispatch full-suite run — 1 failure, isolated re-run clean.
2. During the commission-v2-s2 dispatch full-suite run — 1 failure, isolated re-run clean.
3. During the commission-v2-s3 dispatch full-suite run — 1 failure (2425/2426), isolated re-run and second full-suite re-run both clean (2426/2426).
4. **CI run `27063421668` (post-#510 push, 2026-06-06).** First run fail; re-run (`gh run rerun --failed`) passed. Pattern: flapped on CI after PR #502 supposedly fixed it.

All four: fails in a parallel full-suite context (`npx vitest run` or CI constrained workers), passes in isolation. The `await act()` boundary is insufficient — test still races CI environment's higher contention.

**Fix shape (revised):** The previous fix (act-wrapping clicks) was insufficient. Next attempt must run the full suite under `CI=true` + constrained workers locally to reproduce the failure, then apply explicit `waitFor(() => expect(screen.getByTestId(...)).toBeInTheDocument())` assertions after every async state change. Reproducing under CI conditions first is mandatory — blind act-wrapping already failed once.

**Priority: MEDIUM.** Four occurrences; passes on re-run so it's an intermittent investigation cost, not a hard blocker. Dispatch when reproduction path under CI conditions is clear.

Banked: commission-v2-s2 dispatch, 2026-06-05. Re-opened: post-merge fill for PR #509 + PR #510, 2026-06-06 (4th CI occurrence).

---

## `DailyEntryModal.test.jsx` timer flap — first strike, watch (LOW/TEST-STABILITY, banked 2026-06-05)

**Scope:** `src/components/dashboard/__tests__/DailyEntryModal.test.jsx` — `save calls onClose after 600ms` test.

**Observed behavior:** one-off CI timer failure during PR #498 `lint-and-build` run on 2026-06-05. Passed locally (14/14) and passed on `gh run rerun`; isolated re-run was clean. Pattern: likely timer-sensitive test relying on real 600ms delay that flaps under CI parallel contention.

**Status:** FIRST STRIKE. Per two-strike rule: FU at second flap; no action required now.

**Fix shape (if second strike):** add `vi.useFakeTimers()` + `vi.advanceTimersByTime(600)` to avoid real-timer dependency, or wrap assertion in explicit `waitFor`.

**Priority:** LOW. Watch only.

Banked: PR #498 post-merge fill, 2026-06-05.

---

## NotificationDrawer — `text-primary` "Mark all read" button fails AA on bg (**CLOSED, PR #503 `8cfa5b5`**)

**CLOSED 2026-06-05 (PR #503 `8cfa5b5`):** Fix: added `dark:hover:text-primary-light` to `NotificationDrawer.jsx:61`. Measured matrix — default state already passed both themes (light 6.46:1 · dark 6.61:1); dark hover was `text-primary-dark` = `rgb(1,105,111)` on dark surface = **2.50:1 (FAIL)** → now `dark:hover:text-primary-light` = `rgb(109,200,203)` on dark surface = **8.29:1 (PASS)**. 3 deterministic contrast unit tests in `src/utils/__tests__/contrast.test.js` (describe `'NotificationDrawer Mark-all-read…'`). Targeted axe 4/4 PASS (preview light/dark + prod light/dark). Bell badge is now the **lone intended residual axe node app-wide** (white-on-solid-danger dark; kept as the lone allowlist entry).

**Scope (historical):** `src/components/ui/NotificationDrawer.jsx:61` — the "Mark all read" action renders as `text-xs font-medium text-primary hover:text-primary-dark` directly on the drawer surface `bg`. Per the PR #487 closure note (verified on `main`), this **primary-on-bg button fails AA in both themes** — a pre-existing failure *surfaced* (not introduced) by the contrast-debt retirement sweep.

**Why this is a separate FU (not folded into #487):** this is a **primary-contrast** family, distinct from the now-retired status-ink / `text-ink-faint` debt. It cannot be resolved by the mechanical token swap #487 used: the new `--color-{status}-ink` deep tokens and the neutral `text-ink-muted` are not applicable to a *brand-primary interactive* label. **It needs a primary-text-on-surface decision — outside the `-ink` set** (e.g. a new accessible on-surface primary pairing, or a button restyle to a filled / underlined affordance). That product/design call is why this is banked rather than auto-fixed.

**Related but separately tracked (mechanically fixable):** the same component's line 109 timestamp `text-ink-muted/50` — the `/50` halves an already-muted token below AA. That one IS a drop-the-opacity one-liner (handled as its own diff-locked fix, Item 6b), NOT part of this decision FU.

**Priority:** MEDIUM/DESIGN. Pre-existing; no regression vector. Schedule with the next design-token decision cadence.

Banked: PR #487 (contrast-debt retirement `b10a380`) successor, 2026-06-04.

---

## Track J (V2 Redesign) — App-wide `text-gold` + adjacent contrast pass (MEDIUM/DESIGN, banked 2026-05-31, PR #401; expanded 2026-05-31 on PR #403)

**✅ CLOSED 2026-06-04 (PR #487 `b10a380` — contrast-debt retirement, Option B).** The entire documented contrast-debt family is retired app-wide. Per-family resolution: **(1) StatusPill on-tint danger/warning/success + the exception count badge** → new `--color-{status}-ink` deep tokens (deterministic AA math in `src/utils/contrast.js`, **63 unit tests** ≥4.5 on every surface/tint, both themes); StatusPill primitive + all ad-hoc on-tint chips adopt `text-{status}-ink` (**288 conversions, 83 files**). **(2) text-ink-faint** (56 TEXT usages — regenerated, was ~49) → `text-ink-muted` en masse; non-text `bg-ink-faint` decorative ticks retained. **(3) primary-light text** (the #465 leftover, 2 GroupHeaders) → `--color-primary` (4.16→6.46 light). **(4) DataSourceBadge `text-warning` + AgentProductionView hero + every other on-tint chip** → swept by the same provable rule. The 3 compliance-smoke axe allowlists shrunk **5→1** (bell badge); all 3 PASS + targeted axe clean on Goals/Campaign/Persistency. **Sole residual:** the notification-bell badge (white-on-solid-danger, fails dark only) — a different white-on-solid family, kept as the lone allowlist entry. **Successor FU (NEW, was out-of-scope):** `NotificationDrawer` AA — `text-ink-muted/50` opacity-muted timestamps + a `text-primary`-on-bg button fail AA (pre-existing, verified on main) — a **muted-opacity / primary-contrast** family distinct from the now-retired status-ink/faint debt. (The button half of that successor note is now banked as its own DESIGN-DECISION FU above; the timestamp half is the Item-6b one-liner.) **Verification provenance (addendum):** the planned live BulkImport check was **substituted by the 63-test `src/utils/contrast.js` unit proof** as the AA evidence for the swept on-tint surfaces. Historical detail retained below.

**Status (2026-06-04): text-gold part RESOLVED (item 10 audit → item 20 fix, PR #465 squash `92d558f`); adjacent non-gold items REMAIN OPEN.** The light-mode `--color-gold` was darkened 176,125,26 (#B07D1A) → 138,96,17 (#8a6011) — AA-compliant on white (5.58), cream (5.16), gold-tint (5.06); dark gold unchanged. Token-level, so every `text-gold` consumer is fixed in one go. **axe-delta note (prod awards smoke, item 18 harness):** the awards-surface color-contrast node count was UNCHANGED post-fix (agent light 50 / dark 36 / BM light 22 / dark 18) — because axe never flagged the gold nodes (it applied the large-text 3:1 threshold, which even the old #B07D1A passed). The fix's value is the deterministic small-text AA improvement, not an axe-node reduction. The 50 light-theme nodes are 49× `#a8a39c` text-ink-faint + 1× `#018a91` primary-light — the SEPARATE faint→muted debt + the per-callsite teal items below, NOT gold. **Still open under this FU:** (a) DataSourceBadge `text-warning` on `bg-warning/15` light; (b) AgentProductionView hero avatar `bg-primary text-white` dark; (c) the `text-primary-light` eyebrow on cream (3.84). These are non-gold and untouched by item 20.

**Extension (2026-06-04, from Compliance v2 S1 PR #481): ALL THREE `StatusPill` text-on-tint variants.** Compliance v2 S1's surface-scoped axe surfaced the same shared-chrome family as #475's warning-on-tint chips: **`bg-*/15 text-*` pills fail AA — danger + warning in dark, and `StatusPill` danger marginal even in light (4.33 vs 4.5), AND `StatusPill` success fails in light too.** Concrete nodes observed: `StatusPill` **danger** `bg-danger/15 text-danger` (light 4.33 · dark 3.91); `StatusPill` **success** `bg-success/15 text-success` (light fail); `StatusPill` **warning** `bg-warning/15 text-warning` (dark, per #475); the exception-header count badge `bg-danger/10 text-danger` (dark 3.92); the dark `--color-danger` foreground (#d96b5d-class) on dark tints generally. Classified **existing-pattern (no S1 code change)** — `StatusPill` is shared chrome, NOT scope-forked per slice. **Fix at TOKEN level (accessible on-tint foreground pairings for danger + warning + success) in this dedicated contrast-debt slice, app-wide in one pass** — alongside the faint→muted (~49-node) + primary-light items above. Do not patch `StatusPill` per-callsite.

**Status (original):** Scoped as a dedicated future PR — dispatcher disposition 2026-05-31 on PR #401 pre-review was *"ACCEPTED as design-intent — do NOT darken gold in P3 (a one-off darkening would create a divergent second gold vs AgentAwardsPanel). The fix is an app-wide gold-contrast pass in its own PR."* Two adjacent pre-existing AA-fail nodes folded in on PR #403 pre-review (DataSourceBadge "Estimated" + AgentProductionView hero avatar) — same FU because they share the same "scheduled gold-contrast pass" cadence and benefit from the same token-level fix discipline.

### text-gold (PR #401 origin) — ✅ RESOLVED (item 20, PR #465 `92d558f`: light gold → #8a6011, AA-compliant; dark unchanged)

**Surfaces affected (initial inventory — expand on pickup):**
- `src/components/leaderboard/ProductionLeaderboardSurface.jsx` (PR #401) — header eyebrow `"★ Top of the board · {period}"` + champion-card label `"Champion"` + champion API value, all `text-gold` on `bg-surface` / `bg-card`.
- `src/components/awards/AgentAwardsPanel.jsx` — group-header eyebrows (`"✓ Qualified"`, `"★ Almost there"`), the `var(--color-gold)` accent across qualified-state awards. Multiple `text-gold` callsites.
- Any other `text-gold` consumer (`grep -rn "text-gold\|var(--color-gold)" src/`) — sweep on pickup.

**Token parity confirmed (PR #401 pre-review):**
- `text-gold` (Tailwind) resolves to `rgb(var(--gold-channels))`.
- Light: `--gold-channels: 176 125 26` → `#b07d1a`; ratio against `bg-surface #f7f6f2` = 3.35, against `bg-card #ffffff` = 3.62. Both fail WCAG AA at 4.5:1 small-text.
- Dark: `--gold-channels: 224 170 62` → `#e0aa3e`; passes AA against `bg-surface #1a1612`.

**Recommended fix (when scheduled):** Bump `--color-gold` darker on light theme only (e.g. `rgb(141, 99, 18)` or thereabouts — needs Claude Design eye for the exact shade). Token change — applies consistently to every existing `text-gold` consumer in one PR. Verify against AgentAwardsPanel + ProductionLeaderboardSurface (and any new consumers) with the axe baseline-delta. Do NOT one-off in any individual surface.

### DataSourceBadge "Estimated" — `bg-warning/15 text-warning` light-mode contrast (added PR #403)

**Surface:** `src/components/productionReport/DataSourceBadge.jsx` — the small badge shown at the top of AgentProductionView ("Estimated" pill). Same pattern likely exists on any future "Estimated" / "Pending" tinted-badge usage; sweep `bg-warning/15` + `text-warning` callsites on pickup.

**Issue:** `text-warning` on `bg-warning/15` (15% warning tint over surface) in light theme fails AA. Pre-existing baseline before PR #403 (verified `git show main:src/components/productionReport/DataSourceBadge.jsx` matches the form that triggered the axe node on PR #403). Surfaced in PR #403 smoke; filtered as pre-existing with an explicit comment in `scripts/verification/agent-production-rank-smoke.mjs`.

**Recommended fix (when scheduled):** EITHER bump `--color-warning` darker on light, OR raise the tint opacity from `/15` to a value that yields ≥ 4.5:1, OR swap to a darker text-on-tint utility (`text-warning-dark` if added). Token-level preferred to keep all warning-tint badges consistent.

### AgentProductionView hero avatar — `bg-primary text-white` dark-mode contrast (added PR #403)

**Surface:** `src/components/productionReport/AgentProductionView.jsx:155` — the 44×44 round initials avatar in the hero card (`className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base font-display shrink-0"`). Pre-existing baseline since PR #397; verified unchanged on main before PR #403.

**Issue:** In dark mode, `bg-primary` resolves to the lifted teal `--color-primary: #4ab5b8` (light enough for legibility against the warm-dark surface). White text on lifted teal fails AA contrast in dark mode.

**Pattern to use — same as the P3 chip fix:** PR #401 resolved the same shape on the production-leaderboard chip-active state by adopting `bg-primary dark:bg-primary-dark text-white`, where `bg-primary-dark` resolves to a darker teal (`#01696f` in the dark theme — the SAME hex as light-mode primary, which gives the dark variant its expected darker-on-dark contrast). The contrast pass should apply this convention to:
- `src/components/productionReport/AgentProductionView.jsx:155` (hero avatar)
- Any other dark-mode `bg-primary text-white` consumer (`grep -rn "bg-primary text-white" src/` sweep, exclude already-paired `dark:bg-primary-dark`).

This isn't a token-level fix (the token is correct — lifted teal IS the right surface accent in dark mode); it's a per-callsite Tailwind pair-up. Folded into this FU because it ships alongside the gold-contrast pass naturally and is part of the same dispatcher-accepted-as-pre-existing inventory.

### Priority + cadence

**Priority:** MEDIUM. Pre-pilot, all three patterns work visually; this is an AA-cleanup pass that should ride with the pre-pilot a11y audit if there is one, OR ship as its own contrast PR before the pilot lands. The three items (gold token bump, warning-tint legibility, dark-mode primary pair-up) form a coherent contrast-pass PR.

Banked: Track J P3 production leaderboard surface (PR #401), 2026-05-31. Expanded with DataSourceBadge "Estimated" + AgentProductionView hero avatar on PR #403 pre-review, 2026-05-31.

---

## External code reviewer — Gemini sunsets 2026-07-17; choose a replacement (MEDIUM, dated, banked 2026-06-04)

**Deadline: 2026-07-17.** Gemini consumer code review (the external automated reviewer wired to PRs) sunsets on 2026-07-17 per its own in-PR notice (surfaced on PR #465 review). Before that date, choose and wire a replacement external reviewer so the §6-style "external review triage" gate keeps a real second opinion:

**Candidates:**
- **GitHub Copilot code review** — native GitHub PR review, low setup.
- **CodeRabbit** — dedicated AI PR reviewer, richer inline comments.
- **Claude Code GitHub Action** — `@claude` PR review via the official action; keeps the reviewer in the same model family as the dispatcher.

**Action:** evaluate the three (setup cost, signal quality, cost), pick one, wire it to PRs against `main`, and update the §6 (amendment-v3) external-reviewer triage references from "Gemini" to the chosen reviewer. Note: external review was a NO-OP for most of the Track J overnight queue (Gemini posted on #465 but was silent on the other batch PRs) — whatever replaces it should be verified to actually post before relying on the §6 gate.

Banked: Track J morning task (2026-06-04), from the PR #465 Gemini sunset notice.

---

## Track J (V2 Redesign) — GamePlanV2 component test coverage: `PlanAnchorStrip` + `PlanCascade` (LOW, banked 2026-06-04 from item 23 coverage sweep)

**Status:** OPEN. Item 23 (coverage sweep) covered `HeroCard` (PR #461) — the dispatcher's "up to 3" budget reached one. The coverage proxy (no-test-file = zero coverage) flagged three uncovered shipped GamePlanV2/HomeV2 components: `HeroCard` (done #461), **`PlanAnchorStrip`** and **`PlanCascade`** (remain). Both are pure-ish presentational components in `src/components/dashboard/GamePlanV2/` with derivable display logic worth locking.

**Action (when scheduled):** one test-only PR per component (zero src changes; park any that prove untestable without src edits, per the item-23 pattern). `PlanAnchorStrip` — the income/commission anchor chips + the honest "— / Set in your plan" unset-state for `API Commitment` (never the company-floor fallback). `PlanCascade` — the live Money-Needs commission rung + the "Coming" rungs. Other uncovered GamePlanV2/HomeV2 components (`StepRail`, `CommitPreviewCard`, `DeliveryStripCard`, `MiniViz`, `NeedsActionBanner`, `PulseStrip`, `RecentCompact`, `StandardDetail`, `StandardRow`) are lower-value candidates for a broader sweep.

Banked: Track J item 23 (PR #461 / consolidated fill 2026-06-04).

---

## Track J (V2 Redesign) — `aroundMeLogic` state-label taxonomy: `CLUSTER_3` is mis-named for the 2-row first-place case (LOW, banked 2026-05-31, PR #403)

**Status: RESOLVED 2026-06-04 (Track J item 19, PR #460 `849b828`).** `computeAroundMe`'s state is now derived from `rows.length` (`state: rows.length >= 3 ? 'CLUSTER_3' : 'CLUSTER_2_LAST'`) so `CLUSTER_3` ⟺ exactly 3 rows. Only the `!prev && next` (rank-1-below-set, `visibleMax:0`) case changes — every other case is byte-identical, and no consumer/component edit was needed (the cluster component maps `rows`; the `ProductionLeaderboardSurface.jsx:593` OR-list already includes `CLUSTER_2_LAST`). +3 unit tests (corrected case + solo-row + a CLUSTER_3-⟺-3-rows regression guard); full suite 2141 green. Original FU text preserved below as drift-trail.

When called with `visibleMax: 0` (the `WhereYouRankPanel` always-on cluster pattern), a rank-1 viewer falls through `aroundMeLogic.computeAroundMe` with `prev = null` + `next = safe[1]` → `rows = [viewer, next]` (2 rows), but the ternary `state = next ? 'CLUSTER_3' : 'CLUSTER_2_LAST'` returns `'CLUSTER_3'`. The label implies 3 rows; only 2 are actually present.

**Why it's not a bug today:** `WhereYouRankPanel.jsx` renders `rows.map(...)`, not branching on `state`. The PR #403 strengthened rank-1 test pins the rendered structure (exactly 2 rows, viewer on rank 1, no phantom rank-0, no "behind" footer suffix). The mis-label is invisible to current consumers.

**Why it's a future-bug magnet:** any future consumer that branches on `state === 'CLUSTER_3'` expecting 3 rows would mis-render the first-place case (e.g. allocating a 3-column grid, expecting `rows[2]` to exist). Same shape on the symmetric side: there is no `CLUSTER_2_FIRST` to mirror `CLUSTER_2_LAST`, so any consumer looking to distinguish "no predecessor" from "no successor" must derive it from `prevRank === null` / `rows.length` rather than from `state`.

**Fix shape (when scheduled):** EITHER add a `CLUSTER_2_FIRST` state (and document `CLUSTER_3` as strictly 3 rows), OR drop the state label entirely and derive everything consumers need from `rows.length` + `prevRank` + nextRank. The second is simpler — `rows.length` is the ground truth and the label is redundant. Either approach touches `src/lib/leaderboard/aroundMeLogic.js` + its 32 unit tests + an additional unit-test assertion that the rank-1 case under `visibleMax: 0` returns the new state (or no state). The PR #403 component test already covers the rendered structure; the unit-test layer is where the taxonomy fix needs new coverage.

**Priority:** LOW. Cosmetic taxonomy debt; no live consumer is currently mis-led. Schedule alongside any future `aroundMeLogic` touch (e.g. the `previousRank` + movement chip FU below).

Banked: Track J P7 close (PR #403), 2026-05-31.

---

## Track J (V2 Redesign) — P5-prep aggregate-enrichment CF: `previousRank` + `unitId` + last-week champions + P5b SM all-branches picker (MEDIUM, banked 2026-05-31 from PR #402; expanded 2026-05-31 on PR #403/audit + PR #404 — **RESOLVED by PR #405; P5b SM picker RESOLVED by PR #411**)

> **RESOLVED 2026-05-31 by Track J P5-prep (PR #405).** All three additions landed in one CF change derived from ONE prior-week computation. Downstream UI consumer status:
> - (a) **banner re-home** — **SHIPPED in Track J banner-rehome PR #407** (`WeeklyChampionsBanner` reused unchanged; mounted at the top of `ProductionLeaderboardSurface` via new `useWeeklyChampions` hook + new `src/lib/leaderboard/prevWeekStarting.js` helper that mirrors the CF's `priorWeekStartingString` by construction; 11 parity tests cross-check the doc key against the CJS twin's `getPeriodBoundaries`).
> - (b) **movement chip** — **SHIPPED in Track J movement-chip PR #406** (`ui/MovementChip` consumed by AroundMeCluster YOU row + isViewer TailRow + isViewer PodiumCard + WhereYouRankPanel YOU row; viewer-only + WEEK-only; direction = `previousRank − rank`; ▲ climbed / ▼ dropped / – even / null no-chip).
> - (c) **P5a UM/BM unit-scope UI** — **SHIPPED in Track J P5a unit-scope PR #408** (role-aware scope control on `ProductionLeaderboardSurface`: agent → no control; UM → My Unit / My Branch; BM → My Branch + unit-picker. Scope filter `entries.filter(e.unitId === targetUnitId)` re-ranks via `rankWithinUnit` + rescales `%-of-leader` to unit max API. Persists per-user via `localStorage`. 22 logic tests + 14 surface tests). All three downstream consumers now SHIPPED.
>
> The sequencing constraint (must land BEFORE P5's ManagerDashboard nav swap) was satisfied through #405/#406/#407/#408 before the swap landed. **P5 manager-nav-swap SHIPPED in PR #409** (role-conditional: UM/BM → `ProductionLeaderboardSurface` scoped to their branch with P5a's scope control active; SM → unchanged points board; TA/PA → same default arm as SM; points board NOT orphaned). This also closes the **deferred P5a manager-scope live verification** (UM/BM live smoke on this PR's preview verifies My Unit + unit-picker re-scoping end-to-end).
>
> **P5b (SM scope picker) — RESOLVED in Track J P5b SM branch picker PR #411 (`40296b6`).** New `SmLeaderboardView` container enumerates every ACTIVE tenant branch via `branchService.listBranches` (sorted by name; inactive filtered), persists the SM's last-picked branch per UID under `agencytrack-sm-leaderboard-branch-{uid}` (mirrors the P5a localStorage pattern), defaults to the first sorted branch on first use, and wraps `ProductionLeaderboardSurface` with three new props (`branchIdOverride` → `useLeaderboard` reads the picked branch's `leaderboards/{branchId}`; `scopeRoleOverride='branch_manager'` → BM-style My Branch chip + the P5a unit-picker scoped within the picked branch; `overrideBranchName` → subtitle label). `ManagerDashboard`'s leaderboard arm is now three-way: UM/BM → bare `ProductionLeaderboardSurface`; sales_manager → `SmLeaderboardView`; PA (other) → `gamification/Leaderboard` (unchanged — keeps the points-board import consumed, NOT orphaned). Backend invariants relied on (NO RULES OR CF CHANGES): `branches/{branchId}` already allows tenant members to read (firestore.rules:605); `leaderboards/{branchId}` already allows managers-in-tenant (`canManage` covers `sales_manager`) to read any branch. Live SM smoke on the preview covers picker enumeration, default-first-use, cross-branch re-read (tatil_south populated vs Cyril honest-empty), reload-persistence, and BM-style unit-picker within the picked branch. Frontend-only — no `functions/`, no rules, no deploy. Original body preserved below for the design-decision trail.

**Cleanup FU banked:** full removal of `src/components/gamification/Leaderboard.jsx` (and its `WeeklyChampionsBanner` wrapping) once no role mounts it. After P5b, the only remaining consumer is the PA fallback in `ManagerDashboard`. A separate FU can route PA to either the production surface (if a sensible default branch can be derived) or to `SmLeaderboardView` (since PA is also tenant-wide), and remove the import in the same PR.

---

The leaderboard-aggregate Cloud Function (`functions/leaderboard/leaderboardAggregate.js`) needs to land three additions before P5 ships:

1. **`previousRank` per entry** — movement chip (▲ +2 / ▼ −1) on `AroundMeCluster.jsx` + `TailRow` + `PodiumCard` (P4 ships without this).
2. **`unitId` per entry** — "My Unit" scope toggle on UM scope toggle (P5 read-only audit found the aggregate carries `unitName` but NOT `unitId`; relying on display strings is brittle, see P5 read-only audit Q3).
3. **Last-week champions doc** — agent-readable champions snapshot (top API / Apps / Activity for the most-recently-completed week) so WeeklyChampionsBanner can re-home onto `ProductionLeaderboardSurface` for both agents AND managers. Surfaced on PR #404 P6 Phase 1 audit: today the banner's tenant-wide submissions query is agent-rules-denied; the .catch-swallowed result is silently empty for agents.

Why fold all three into one CF change: computing prior-period rankings (which `previousRank` needs anyway) also yields the top-3 by API/Apps/Activity for that period — same in-memory traversal serves both. `unitId` is a single line in `buildLeaderboardDoc` to add to the mapped entry shape — costs nothing alongside the other writes.

**Fix shape (when scheduled):**

1. **`functions/leaderboard/leaderboardAggregate.js`:**
   - Before writing the new doc, read the EXISTING `leaderboards/{branchId}` doc; for each period (`week`, `mtd`, `qtd`, `ytd`), build an `agentId → rank` map from the OLD period array; stamp `previousRank` onto each new-period entry. (Source: PR #402.)
   - In `buildLeaderboardDoc`'s entry map (lines 152–160 — the `unitName` resolution step), ALSO pass `entry.unitId` through. (Source: PR #403 P5 audit.)
   - Compute last-week champions during the WK period traversal: pick top-by-`periodApi`, top-by-`apps`, and top-by-activity (`ffiConducted + ciConducted + applicationsSold`) from the PRIOR week's submissions (`weekStarting == prevSunday`). Write to a NEW agent-readable doc — see step 2.

2. **New collection: `tenants/{tid}/weeklyChampions/{weekStarting}`** (or `weeklyChampions/{branchId}_{weekStarting}` if per-branch is preferred — branch-per-doc matches the leaderboards layout):
   ```
   {
     weekStarting: 'YYYY-MM-DD',
     branchId: 'xxx' (if per-branch),
     topAPI:      { agentId, agentName, value } | null,
     topApps:     { agentId, agentName, value } | null,
     topActivity: { agentId, agentName, value } | null,
     computedAt:  serverTimestamp,
   }
   ```
   - Agent-readable rules: `allow get, list: if isSignedIn() && getTenantId() == tenantId && (kioskCanRead || isAgent || canManage)`. (Mirrors leaderboards aggregate.)
   - Write: CF-only (`allow write: if false`).
   - **Semantic = last-week-completed** (NOT current-week-in-progress). Matches the existing `WeeklyChampionsBanner.jsx` UX (header "Last Week's Champions"). Does NOT duplicate the aggregate's WK podium (which IS current-week-in-progress).

3. **Doc shape additions** to `leaderboards/{branchId}`:
   - Each entry gains `previousRank: number | null` (null when agent wasn't in prior period — joined or zero production then). Forward-compat: existing consumers ignore the field.
   - Each entry gains `unitId: string | null`. Forward-compat: existing consumers ignore the field.

4. **Period semantics for `previousRank`** — `week.previousRank` compares against last week's `week`; `mtd` against last month's `mtd`; etc. The "prior" basis differs per period — call out in the doc so consumers don't conflate them.

5. **Client updates (all post-CF):**
   - **`ProductionLeaderboardSurface.jsx`** — at the top of the surface (above the period chips), mount `<WeeklyChampionsBanner champions={champions} loading={championsLoading} />` fed by a NEW `useWeeklyChampions(tenantId, branchId)` hook that reads the new doc. Period-independent (the banner is always last-week's champions; the period chips below switch the ranking only).
   - **`AroundMeCluster.jsx` / `TailRow` / `PodiumCard`** — render `▲ {delta}` (success-tint) / `▼ {delta}` (danger-tint) / `· same` (or "—") chip when `previousRank` is non-null. Per the design, the chip sits under the unit name on the You row. Edge cases: first-time-in-the-board (no previousRank) → "new" pill. Rank unchanged → dot or "·". Test agent at rank 1 stably → "—" (no movement).
   - **UM "My Unit" filter** (P5) — `entries.filter(e => e.unitId === callerUid)`.

6. **Sequencing constraint (banked from PR #404 P6 disposition):** the P5-prep CF MUST land BEFORE P5's `ManagerDashboard` nav swap retires the points board for managers. Reason: managers DO see real champions today (`canManage` permits the tenant-wide submissions list); retiring the points-board nav before the re-homed banner exists would regress manager-visible data. Agents have nothing to lose (banner already empty for them; PR #404 P6 retired the empty agent banner with the agent nav swap).

**Priority:** MEDIUM. Unblocks three things at once — movement chip on the around-me, UM unit-scope toggle in P5, and the agent-visible champions re-home that PR #404 P6 had to defer.

Banked: Track J P4 around-me cluster (PR #402), 2026-05-31. Expanded on PR #403 P5 read-only audit (unitId addition). Expanded on PR #404 dispatcher disposition (champions write + sequencing constraint), 2026-05-31. **Resolved 2026-05-31 by Track J P5-prep (PR #405); downstream UI consumers each ship as their own PR.**

---

## Track J (V2 Redesign) — P4: optional design reference HTML added to fold-in (banked 2026-05-31, PR #402)

`design_handoff_v2_app/mockups/app-leaderboard-around-me.html` was sitting locally untracked during P4 build (Claude Design produced it but it had not been committed). P4's Phase 0 step 3 (optional additive fold-in) included it in the PR scope so the design reference is durable in the repo — additive only, no existing mockup overwritten, no parallel folder. No README change since `app-leaderboard.jsx` is already the primary leaderboard mockup reference and the around-me HTML lives alongside it.

**Action:** none — already shipped with PR #402. Note retained for the audit trail.

Banked: Track J P4 around-me cluster (PR #402), 2026-05-31.

---

## Settlements manager reads — tenant-scope (no unitId/branchId on docs) (LOW, banked 2026-06-05)

**Context:** PR #494 (`fix/settlements-read-scope`) tightened the settlements `allow read` from "all tenant members" (the agent-reads-peers leak) to `canAccessOwn || canManage`. The original brief D1 target specified UM same-unit / BM same-branch granular scoping (mirroring the submissions pattern). This cannot be implemented because settlement docs carry no `unitId` or `branchId` field — the submissions pattern relies on `resource.data.unitId` denormalized at write time, which never happened for settlements.

**Result of PR #494:** Agents can only read their own settlements. All manager-tier roles (UM, BM, SM, TA, PA) can read all tenant settlements. UM cannot be restricted to same-unit; BM cannot be restricted to same-branch at the rules layer without schema changes.

**Dispatcher ruling (Option A, 2026-06-05):** Accept the simplified tightening. Manager tenant-scope is acceptable for trusted tiers whose surfaces already app-filter by agentId. Settlements are retirement-bound (Policy Ledger supersedes), so schema investment is waste.

**Fix shape (if needed):**
1. Add `unitId` + `branchId` to the `confirmSettlement()` write payload in `src/services/settlementService.js`.
2. Update the settlements rules `get` and `list` arms to mirror the submissions pattern: `resource.data.unitId == request.auth.uid` for UM; `resource.data.branchId == callerBranchId(tenantId)` for BM.
3. Backfill existing settlement docs with `unitId`/`branchId` values (one-off Admin SDK script from agent user docs).

**Priority:** LOW. MOOT if settlement retirement (Policy Ledger supersedes) proceeds before multi-branch expansion. Only revisit if multi-branch operation becomes real and granular settlement privacy is required before Policy Ledger fully replaces the settlements surface.

Banked: settlements-read-scope PR #494 (Phase 1 STOP, dispatcher Option A), 2026-06-05.
