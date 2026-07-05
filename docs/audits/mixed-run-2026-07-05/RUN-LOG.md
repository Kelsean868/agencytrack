# Mixed-Run Orchestrator — RUN-LOG (2026-07-05)

> **Brief:** `docs/briefs/orchestrator-10h-mixed-run.md`. Orchestrator + executor: **Opus** (Fable exhausted).
> **Window:** ~10h. **Three lanes:** L1 functions/ cluster (build to HELD PRs — human-merge + Kyron deploys) · L2 small frontend sweep (AUTO-MERGE + auto-revert, `src/`-only) · L3 recon (read-only, parallel).
> **Non-negotiable:** never merge functions/rules PRs; never run `firebase deploy`. Halt-item-not-lane on trouble.

---

## Step 0 — Ground truth (CONFIRMED)

- `git fetch/checkout main/pull` → **up to date**, HEAD `b585d8e6` (the mixed-run brief commit).
- Read IN FULL: `CONTEXT.md`, the efficiency audit `docs/audits/webapp-ux/agencytrack-efficiency-audit-2026-07-05.md`, relevant `FOLLOW_UPS.md` sections.
- **Already-resolved (do NOT redo), confirmed via `git log --all --grep`:** EFF-002 Phase 1 (#804 `2b13bdd4`), EFF-011/001/005/007/009/018 (#802 `eb20be1a`), FinancingRiskPanel flake (#803 `62d37e92`). No commit resolves EFF-004/006/015 → all three genuinely open.
- **Anchors re-verified (Rule 17):** the audit's `functions/index.js:1458-1495` line anchors for EFF-004 are still accurate on current main.

## Plan

**LANE 1 (serial, HELD — never merge/deploy):**
1. **EFF-004** — YTD reducer ignores v2 `newBusiness.api` (CORRECTNESS, PRIORITY). Phase-0 recon complete (below). Building.
2. **EFF-006** — leaderboard cron recomputes full tenant hourly regardless of activity. Recon → held PR if clean functions/ change.
3. **EFF-015** — no global region/memory/minInstances config. Recon → held PR if clean; region change on live money path is HOLD-and-surface (audit §EFF-015 change-risk).

Same-file serialization watch: EFF-004 touches `functions/index.js` (+ new require of `./utils/fieldHelpers`). EFF-006 touches `functions/leaderboard/leaderboardAggregate.js`. EFF-015 touches `functions/index.js` (global options) → **SERIALIZE EFF-015 after EFF-004** (same file) or bank.

**LANE 2 (auto-merge, `src/`-only, single-file merge lane, serialized on main):**
- Candidate pool (to firm up in first gap): small banked frontend FUs from the #794–#799 run (manager/admin dynamic topbar title; screen-internal h1→h2; QuickAddMenu visible close) + any frontend-only Low-risk efficiency item. **NOT** EFF-013 (Med risk, shared KPICard primitive, pair-with-manualChunks per FU) · **NOT** EFF-012/014 (virtualization, needs dep+arch) · **NOT** EFF-002 Phase 2 (needs manualChunks).
- If <~2 genuinely-safe items after scan → report "Lane 2 thin, N items" and weight the window on L1+L3. Empty L2 is acceptable; a risky fill is not.

**LANE 3 (recon, read-only, parallel from the start):** dispatched as a background agent. Targets: (1) EFF-002 Phase 2 `manualChunks` grouping strategy + tabs; (2) triage remaining EFF findings (003/008/010/012-014/016/017) into frontend-auto-mergeable / functions-held / needs-decision with re-verified anchors; (3) still-open 2026-07-04 UX + security-delta items (beyond SEC-012). → `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md`.

---

## LANE 1

### L1-1 — EFF-004 (YTD reducer v2 correctness) — Phase 0 recon COMPLETE; building

**The bug (confirmed at `functions/index.js:1487-1495`):** `onSubmissionWrite`'s YTD scan reduces with `sum + (parseFloat(d.data().apiSold) || 0)`. It reads only the flat v1 `apiSold` field.
- **v1/legacy submissions:** store flat `apiSold` → counted (though `.api`/`.annualPremium` aliases are missed).
- **v2 submissions (`version === 2`):** store `newBusiness.api` (+ `pppIncreases.apiIncrease`, `lumpsums.apiCredit`); their flat `apiSold` is **undefined** → `parseFloat(undefined) || 0 = 0`. **Every v2 submission contributes ZERO to the YTD sum.**

**Canonical shape decision (Rule L1-1.4 — resolved, NOT a guess):** the single codebase-canonical "YTD total production API" reader is **`extractTotalProductionCredit`** (`newBusiness.api + pppIncreases.apiIncrease + lumpsums.apiCredit`; v1 fallback `apiSold||api||annualPremium`). Evidence it is canonical for *this exact YTD-production concept*:
- `functions/leaderboard/rankingLogic.js:140` computes the leaderboard **ranking** `totalApi` via `extractTotalProductionCredit`. The MDRT badge is written onto that **same `leaderboard/{agentId}` doc** — so the badge MUST use the same reader to stay consistent with the ranking it sits beside.
- `src/hooks/useMyProduction.js:96` computes the agent's visible **YTD API** (HeroCard MDRT marker) via `extractTotalProductionCredit`.
- Shared helper exists both sides: `functions/utils/fieldHelpers.js:14` (server) mirrors `src/utils/extractFields.js:172` (client).
- `index.js:1459`'s `newBusiness.api`-**only** reader is the deliberately-narrower *per-submission "big new-business week"* (`big_week`) concept and is **left unchanged** (different metric, correctly).

**Concrete miscount example:** tenured v2 agent, 12 weekly v2 submissions this year, each `newBusiness.api = 30,000` → real YTD = 360,000. In H1 (weekOfYear ≤ 26) real YTD 360k ≥ 250k ⇒ should earn `mdrt_pace`. Reducer sees `apiSold = undefined` on all 12 ⇒ `ytdAPI = 0` ⇒ **no MDRT badge**. With PPP/lumpsums the undercount is larger still. Correct-vs-wrong: **360,000 vs 0.**

**Blast radius:** the `ytdAPI` local (`:1493`) is used ONLY for the two MDRT badges — `mdrt_qualified` (≥500,000, `:1497`) and `mdrt_pace` (≥250,000 in H1, `:1503`) — added to `leaderboard/{agentId}.badges`. It feeds **no persisted numeric aggregate** (the YTD number itself is transient); only the **badge set** is persisted. Branch podium / champions (`ProductionLeaderboardSurface` via `leaderboardAggregate.js`) already read correctly via `extractTotalProductionCredit` and are **unaffected**. So the blast radius is exactly the gamification `leaderboard/{uid}` MDRT badges (BadgeGrid / Leaderboard).

**Backfill question (bank as separate FU — do NOT backfill autonomously):** v2 agents who *should* have earned `mdrt_pace`/`mdrt_qualified` are missing those badges today. Badges are add-only (`addIfNew`), and the YTD scan re-runs on **every** submission — so the fix **self-heals on each agent's next submission** post-deploy. Agents who don't submit again this year stay missing the badge until they do. → FU: optional one-shot backfill vs accept self-heal. Owner decision.

**Out-of-scope finding (bank, do NOT fix — Rule 7):** the server MDRT badge thresholds are the legacy flat `500,000 / 250,000`, while the client MDRT surfaces migrated to `MDRT_THRESHOLDS_2026.mdrt = 688,800` (PR #792). After this shape fix, `mdrt_qualified` still fires at 500k while HeroCard shows the MDRT marker at 688,800 — a **threshold** (not shape) inconsistency, a separate money/eligibility judgment. Flag for dispatcher.

**Fix:** import `extractTotalProductionCredit` from `./utils/fieldHelpers`; replace the `:1495` reduce with `sum + extractTotalProductionCredit(d.data())`. parseFloat/Number discipline preserved (helper uses `Number()||0`); TTD; no rounding change.

**Verify:** add `functions/__tests__/onSubmissionWrite.test.js` case(s) proving a v2-shape submission's api now counts toward YTD (mdrt_pace/qualified fires) and legacy still works. `npm test` in functions/.

**Status:** ✅ **HELD PR [#805](https://github.com/Kelsean868/agencytrack/pull/805)** (`8f20102`). Gates: functions jest **350/350** (6 new EFF-004 cases), root lint clean, root vitest **4228/4228**, build clean. **NEVER merge/deploy** — operator: merge → `firebase deploy --only functions`.

**Bot disposition (Rule 21) — both reviewers polled, comment posted on #805:**
- **Gemini HIGH** — `new Date().getFullYear()` year-rollover/timezone (`index.js:1493/1503`) → **OUT-OF-SCOPE (valid, banked FU #3).** Pre-existing line; my diff changed only the reduce's API read, not the `thisYear` derivation. Real edge-case (CF UTC vs TT UTC−4 ~4h rollover window + late-Jan submissions for a Dec `weekStarting`), but fixing it is a separate **money-math attribution** decision (derive YTD year from `weekStarting`, not the server clock). Rule 9 — did NOT unilaterally extend the scope-locked held PR; dispatcher decides extend vs separate PR.
- **Gemini MEDIUM** — test rot (`BASE_SUBMISSION` hardcoded) → **ALREADY-RESOLVED** for assertions (new YTD tests derive `YEAR` dynamically; trigger-date folds into FU #3 if it lands).
- **CodeRabbit Trivial** — deploy reminder → **ALREADY-RESOLVED** (PR body has HELD + exact deploy cmd + banked backfill).

**Three FUs banked (operator lands in FOLLOW_UPS.md):** (1) MDRT badge **backfill** — self-heals on each agent's next submission post-deploy; operator decides one-shot vs accept. (2) server MDRT badge **threshold** 500k/250k vs client `MDRT_THRESHOLDS_2026.mdrt` 688,800 — shape→threshold inconsistency. (3) **YTD year-attribution** — derive the YTD filter year from `weekStarting` (or a TT-aware clock) instead of `new Date().getFullYear()` so year-rollover + late submissions attribute correctly (from Gemini HIGH; money-math decision).

### L1-2 — EFF-006 (leaderboard cron hourly full recompute) — **PARKED (surface)**
Anchor re-verified: `functions/leaderboard/leaderboardAggregate.js:438-441` (`.schedule('0 * * * *').timeZone('UTC')`), `loadInputs:56-79` (reads ALL submitted submissions YTD + ENTIRE users collection every run). Module header `:18-20` explicitly notes the on-write-trigger optimization was **deferred to FU**. Mechanism confirmed: 24 full-tenant recomputes/day regardless of activity.
**Why parked (not built to held PR):** no clean no-decision functions-only fix exists —
- **Event-driven debounce** (audit's "proper" fix) needs `onSubmissionWrite` to write a dirty flag + a new coordination/trigger pattern → **Rule 7 architecture**; the flag write also lands in `functions/index.js` (same file as EFF-004 → **Rule 4** same-file).
- **Dirty-flag / max-`updatedAt` gate** needs a new persisted meta doc (+ likely a new index) → Rule 7.
- **Cadence reduction** (`'0 * * * *'` → business-hours / every-N-hours) is a one-liner but the freshness tolerance is a **product judgment with no canonical answer** (Methodology Rule 1 — surface), and it interacts with the `weeklyChampions/{priorWeekStarting}` + `previousRank` timing computed in the same run.
**Recommendation:** brief the **event-driven debounced recompute** next window (near-zero cost at idle; the real win). If the operator wants the quick cadence win now, the one-line `.schedule(...)` change is trivially available on request — I did not guess the cadence value. → cross-ref NEXT-WINDOW-BACKLOG §2 (EFF-006, functions-held).

### L1-3 — EFF-015 (no global region/memory/minInstances) — **PARKED (surface)**
Anchor re-verified: `functions/index.js` has **no** `setGlobalOptions` / `.region()` / `minInstances`; only ONE `.runWith` at `:701` (bulk import, 256MB/540s). All other callables/triggers/crons inherit v1 defaults (`us-central1` / 256MB / cold starts).
**Why parked:** not a clean functions/ change —
- **Region** change affects already-deployed **live money-path** callables (`notifyFinancingAdjustment`, `setAgentOfMonth`) → the audit's own caveat: "do NOT change region on a live money path without a migration plan" (**data-safety / autonomous-mode money-path surface**).
- Requires **confirming the Firestore region first** (Console/operator — cannot read reliably here; must not deploy).
- `memory` / `minInstances` values are **cost/ops decisions** (minInstances=1 carries standing cost).
- Touches `functions/index.js` (same file as EFF-004 → **Rule 4** same-file coupling).
**Recommendation:** brief next window AFTER the operator confirms the Firestore region; then a `setGlobalOptions({region, memory})` + selective `minInstances` on 2-3 interactive callables, with a redeploy/migration plan for the money-path functions. → cross-ref NEXT-WINDOW-BACKLOG (functions-held).

## LANE 2 — frontend sweep (auto-merge) — **THIN: 0 auto-merges** (by design, per brief "empty Lane 2 is acceptable; a risky auto-merge to fill time is not")
Every survey-level candidate fails the "clean, Low-risk, no-judgment, safe-to-auto-merge-to-production" bar on inspection:
- **EFF-017** (batch campaign notifications) — NOT clean: batching requires replacing `createNotification` (its own `addDoc`) with inline `batch.set()` that **duplicates the canonical notification write-shape** (`src/services/campaignService.js:112-138` — drift risk vs `notificationService`), **changes error semantics** (current best-effort per-recipient `.catch(console.error)` → atomic all-or-nothing), and needs **≤500-op chunking** for correctness; its *proper* fix is server-side in a CF (functions-held). Scope-expanding refactor → **Rule 7 bank**.
- **A11Y-101/102** (modal focus mgmt) — M effort + touches agent-critical `WizardForm.jsx` / `DailyCaptureV2.jsx`; a focus-trap/Escape bug risks the wizard's data-entry path. Deserves a dedicated reviewed PR, not autonomous auto-merge → bank.
- **EFF-010 / EFF-016** — architectural (context cache / pagination behavior change) → bank.
- **Manager/admin dynamic topbar title / UX-103 zero-report celebration** — embed user-facing copy / product decisions (Methodology Rule 1 — surface) → bank.
All banked in `NEXT-WINDOW-BACKLOG.md`. Window weight correctly on Lane 1 (EFF-004 held + 2 substantive parks) + Lane 3 (full backlog).

## LANE 3 — recon — ✅ DONE
Background agent returned the full backlog → placed at `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md` (untracked; lands via docs-only PR / operator). Headline: **EFF-002 Phase 2 + Rollup `manualChunks` vendor-grouping** is the highest-value next item (concrete config designed; frontend-only; 1 dispatcher decision). Full triage of EFF-003/008/010/012-014/016/017 + the still-open security/PRIV backlog + UX items inside.

---

## WAKE-UP REPORT (final)

1. **Lane 1 (functions/ cluster, HELD).**
   - **EFF-004** (PRIORITY, correctness) → **HELD PR [#805](https://github.com/Kelsean868/agencytrack/pull/805)** (`8f20102`). YTD reducer now sums via the canonical `extractTotalProductionCredit` (v2 `newBusiness.api` + PPP + lumpsums; v1 fallback) instead of flat `apiSold`-only, so tenured v2 agents' MDRT badge YTD is correct and consistent with the leaderboard ranking + HeroCard. **Miscount example:** v2 agent, 12 × `newBusiness.api` 30k → real YTD 360k vs reducer's **0**. **Affected surfaces:** only the `mdrt_qualified`/`mdrt_pace` gamification badges on `leaderboard/{uid}`; branch podium/champions unaffected (already use the canonical reader). **Backfill question:** self-heals on next submission; one-shot backfill vs accept is an operator call. Gates green (functions 350/350, root 4228/4228, lint/build clean). Bots dispositioned (1 OUT-OF-SCOPE→FU, 2 ALREADY-RESOLVED; no code change). **Deploy cmd:** `firebase deploy --only functions`.
   - **EFF-006** (hourly leaderboard cron) → **PARKED (surface).** No clean no-decision functions-only fix: event-driven/dirty-flag = architecture (Rule 7) + touches `functions/index.js` (Rule 4 same-file as EFF-004); cadence = product freshness judgment (Rule 1). Recommend briefing the **event-driven debounced recompute** next window.
   - **EFF-015** (no region/memory/minInstances) → **PARKED (surface).** Region change on live money-path callables needs Firestore-region confirmation (operator/Console) + a migration plan (data-safety); memory/minInstances are cost calls; same file as EFF-004 (Rule 4). Brief after region confirmed.

2. **Lane 2 (frontend auto-merge) → THIN: 0 merged.** The one survey-level candidate (EFF-017) is not a clean auto-merge (duplicates the canonical notification write-shape, changes error semantics, needs chunking; proper fix is server-side). All other frontend items are architectural, agent-critical, or product/copy decisions. Per the brief, no risky padding — banked to `NEXT-WINDOW-BACKLOG.md`. No production auto-merge occurred → no auto-revert needed; main untouched by this run except (pending) the docs PR.

3. **Lane 3 (recon) → DONE** → `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md`. Headline ready-to-brief: **EFF-002 Phase 2 + a concrete Rollup `manualChunks` vendor-grouping** (config designed: `vendor-icons`/`vendor-charts`/`vendor-firebase`/`vendor-pdf`; ~16 manager tab panels to lazy-split; eager set enumerated) — frontend-only, needs one dispatcher decision. Plus full triage of EFF-003/008/010/012-014/016/017 and the still-open security/PRIV backlog + UX items.

4. **Self-critique (Rule 22) — known gaps:**
   - **No live production value-level smoke on EFF-004.** The fix is proven by unit tests (mocked YTD scan) + the canonical-reader argument, not by observing a real v2 agent's badge flip against real Firestore — that needs a deploy (operator-gated). The unit mock does not exercise real query semantics; the strongest remaining verification (a real v2 submission → real YTD scan) runs post-deploy.
   - **The Gemini HIGH (year-rollover) is real and adjacent.** I banked it rather than extend the scope-locked held PR (Rule 9). If the dispatcher wants EFF-004 to ship *fully* correct, they may prefer to fold the `weekStarting`-year fix into #805 before merge — one deploy instead of two.
   - **Lane 2 emptiness is a judgment call.** A more aggressive operator might have accepted EFF-017 (or the manager-title item) as auto-mergeable. I chose the conservative read because each carries a real (if small) production risk and the brief authorized an empty lane.
   - **EFF-006/015 fix shapes are recon, not built.** Their "proper" fixes are described, not implemented or emulator-verified; the next-window brief must re-verify anchors (they will drift once #805 merges into `functions/index.js`).

5. **Recommended next, ordered:**
   1. **Merge + deploy EFF-004 (#805) first.** `firebase deploy --only functions` after squash-merge (Rule 19). Decide the **backfill** (accept self-heal is fine for pilot). **Before merging, decide** whether to fold the banked **YTD year-attribution** fix (Gemini HIGH) into #805 — if so, I can extend the branch (Rule 9 authorization); else it's a fast-follow.
   2. **Brief EFF-006** (event-driven debounced leaderboard recompute) — highest functions-side efficiency win; needs a freshness-contract decision.
   3. **Brief EFF-015** — after confirming the Firestore region in Console; then `setGlobalOptions` + selective `minInstances`, with a money-path redeploy plan.
   4. **Brief EFF-002 Phase 2 + `manualChunks`** (Lane 3 headline) — highest frontend win; approve the `manualChunks` shape.
   5. Land the three EFF-004 FUs + the Lane-2-banked frontend items (A11Y-101/102 modal focus is the cleanest next frontend PR) into `FOLLOW_UPS.md`.
   - **Docs:** this RUN-LOG + `NEXT-WINDOW-BACKLOG.md` land via a held docs-only PR (see below) for operator merge.
