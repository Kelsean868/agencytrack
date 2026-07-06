# Orchestrator — 10h Mixed Run #2 (revised) — RUN-LOG

**Date:** 2026-07-05
**Brief:** `docs/briefs/orchestrator-10h-mixed-run-2-revised.md`
**Model:** Opus (orchestrator + executor; Fable exhausted)
**Prior backlog (authoritative for EFF-006 + EFF-002 Phase 2):** `docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md`

---

## Step 0 — Ground truth (COMPLETE)

- `git fetch origin --prune`; on `main`, in sync with `origin/main`. HEAD `c5ed1554` (the mixed-run-2 brief docs commit).
- Read in full: CONTEXT.md · efficiency audit (`docs/audits/webapp-ux/agencytrack-efficiency-audit-2026-07-05.md`) · prior NEXT-WINDOW-BACKLOG · FOLLOW_UPS.md relevant sections (EFF-004 FUs lines 226-234).

### HARD PRECONDITION — RESULT: ✅ PASSED

EFF-004 (PR #805) is merged AND its fix is present on `main`:
- Recent `main` log: `9dcae1a3 fix(eff-004): YTD reducer counts v2 newBusiness.api for MDRT badges (#805)`.
- Grep confirms the canonical reader at the YTD reducer site:
  - `functions/index.js:1503` — `.reduce((sum, d) => sum + extractTotalProductionCredit(d.data()), 0)`
  - `functions/index.js:5` — `const { extractTotalProductionCredit } = require('./utils/fieldHelpers');`

**→ Lane 1 is CLEARED to proceed.** Items 1 and 2 build on the post-EFF-004 reducer, not pre-EFF-004 code.

---

## Phase-0 recon captured (pre-execution)

**L1-1 / L1-2 shared reducer region (`onSubmissionWrite`, functions/index.js):**
- `:1493` — `const thisYear = new Date().getFullYear();`  ← **L1-2 bug** (year from entry date, not weekStarting)
- `:1502` — `.filter((d) => d.data().weekStarting?.startsWith(String(thisYear)))`
- `:1503` — `.reduce(... extractTotalProductionCredit ...)`  ← EFF-004 canonical (precondition anchor)
- `:1505` — `if (ytdAPI >= 500000) { addIfNew('mdrt_qualified'); }`  ← **L1-1 bug** (should be 688,800)
- `:1511` — `if (weekOfYear <= 26 && ytdAPI >= 250000) addIfNew('mdrt_pace');`  ← 250k pace target — brief says LEAVE + surface

**MDRT badge write-site enumeration (Rule 5/17 grep, authoritative over brief Phase 0.1):**
- `grep 'mdrt_qualified|mdrt_pace' functions/leaderboard/` → **ZERO matches.** The recompute path (`leaderboardAggregate.js` / `rankingLogic.js`) does NOT write MDRT badges — it uses `extractTotalProductionCredit` for ranking only.
- **→ MDRT badges are written ONLY in `onSubmissionWrite` (functions/index.js).** Diverges from the brief's "BOTH paths write these badges" assumption. Will double-confirm by reading the recompute path before finalizing L1-1. (If confirmed single-site, fewer edit sites — good.)

**Canonical constant:**
- Frontend: `src/config/mdrtThresholds/2026.js` `MDRT_THRESHOLDS_2026.mdrt = 688800` (PR #792). functions/ cannot import from src/ → will ADD a named functions-side constant = 688,800 and FLAG the duplication/drift risk.
- `gamificationConfig.js:55-56` badge definitions carry stale "TTD 500,000" description text → update alongside.

**Contract date field:** `contractStartDate` (YYYY-MM-DD string) — locked decision (Slice 1, PR #649), authoritative, 15+ read sites incl. `functions/.../tenureFloors.js`. Will confirm reachability inside `onSubmissionWrite` (agent doc load) during L1-1 Phase 0.

**Banked FUs these PRs close:** FOLLOW_UPS.md line 232 (threshold 500k-vs-688,800 = L1-1 Commit 1) and the YTD year-attribution FU (= L1-2). MDRT backfill FU stays banked (self-heals on next submission/recompute).

---

## PLAN (posted to chat)

- **Lane 3 (recon, read-only, parallel):** dispatched as a background subagent from the start → refreshes `docs/audits/mixed-run-2-2026-07-05/NEXT-WINDOW-BACKLOG.md`.
- **Lane 1 (serial, HELD, in order):** L1-1 MDRT+floor → L1-2 year-attribution → L1-3 EFF-006 → L1-4 EFF-002 Phase 2. Each built to PR-open, Gemini on-demand review, bots dispositioned, STOP. NEVER merge; NEVER `firebase deploy`. Items 1-3 (functions) carry the exact deploy command in the PR body.
- **Lane 2 (frontend-only auto-merge, in gaps):** only genuinely-safe frontend items not touching any Lane-1 file; full ritual + post-merge prod smoke + auto-revert. `<2 safe items` → "Lane 2 thin", no padding.

---

## Live status

| Item | Status | Detail |
|---|---|---|
| HARD PRECONDITION | ✅ PASSED | EFF-004 on main; Lane 1 cleared |
| Lane 3 recon | ✅ DONE | `docs/audits/mixed-run-2-2026-07-05/NEXT-WINDOW-BACKLOG.md` written; corrected 4 drifted anchors (ARCH-001 `:50`/`tatillife_south`, A11Y-101 `:526`, A11Y-102 `:689`, EFF-015 `:701`); Node-20 decommission **2026-10-30** hard wall confirmed |
| L1-1 MDRT+floor | ✅ HELD → **PR #807** | **HEAD `94b21d5e`** (was `db1c88a5`; +1 amend). Amend 2026-07-05: `mdrt_pace` 250k→**344,400** (owner decision) via `MDRT_PACE_API`, both config twins + 4 fake-timer pace tests. functions jest 373/373, cross-check 16/16, build clean. **All CI green.** Gemini re-review dispositioned (thisYear-UTC → addressed by #808; nowMs → DISAGREE). Deploy cmd in body. |
| L1-2 year-attribution | ✅ HELD → **PR #808** | **HEAD `d0c87620`** (was `a50ab9cf`; rebased onto new #807 `94b21d5e`). One test-file conflict resolved (pace+attribution tests → one combined describe block). functions jest 377/377. Stack intact: `d0c87620`→`0ecde99b`→`94b21d5e`. Gemini `Date.UTC` base still in; re-review weekOfYear-defer → DISAGREE (FU). Merge order: #807 then #808. |
| L1-3 EFF-006 | ⛔ PARKED (surfaced) | Correctness blocker: cron output is time-driven (weekly-champions rotation + previousRank), so a submission-only dirty flag is INCORRECT. Ready-to-brief surface below. |
| L1-4 EFF-002 Ph2 | ✅ built (PARTIAL — foundation) | branch `perf/eff002-phase2-manualchunks` (`cc4c1060`). Shipped the `manualChunks` vendor-grouping (backlog headline enabler); tab-splitting scoped as fast-follow. Build clean · 5 named vendor chunks, 0 sprawl · vendor-pdf + ManagerDashboard stay lazy · adversarial smoke **66/66** both themes · lint clean. Push held for local vitest (machine-load-slowed; test-neutral config change). |
| Lane 2 | ⏸ in gaps / likely thin | — |

## L1-4 (EFF-002 Phase 2) — PARTIAL: manualChunks foundation shipped, tab-split scoped

**Decision:** ship the low-risk, deterministically-verifiable half (the `manualChunks` vendor-grouping — the backlog's headlined "missing build-config decision") as a HELD PR; scope the per-tab lazy-split as the ready-to-brief fast-follow. Rationale: 4-5 tests mount `ManagerDashboard` → lazy-splitting needs Suspense-aware test updates (scope balloon), and the reverted-before history + full both-themes re-walk warrant a focused pass. Brief throughput note explicitly permits item 4 partial; "don't sacrifice correctness quality to reach item 4" honored (correctness fixes done well).

**Chunk topology (brief's sprawl gate):** `vendor-icons` 8.26 · `vendor-charts` 80.42 · `vendor-firebase` 141.12 · `vendor-pdf` 334.75 · `vendor` 240.19 kB gzip — **5 named vendor chunks, ZERO tiny-chunk sprawl** (vs the reverted attempt's 36-50). Entry `index` 17.94 kB gzip.
**Invariants preserved:** `dist/index.html` eager graph = `index + vendor + vendor-firebase + vendor-icons`; `vendor-pdf` + `ManagerDashboard` **NOT** eager (EFF-011 lazy PDF + EFF-002 P1 role-split intact).
**Adversarial smoke 66/66 both themes** (agent chunk isolation · manager path + all 14 tabs render · slow-3G Suspense fallback · chunk-fail boundary · 0 console errors) — confirms `manualChunks` didn't break firebase init or load-path isolation.
**Fast-follow (scoped in the PR body):** lazy the ~16 heavy manager tabs behind one Suspense + ChunkLoadErrorBoundary; keep Overview + full-screen early-returns eager; update the 4-5 mounting tests to be Suspense-aware; re-run the smoke both themes. `manualChunks` (this PR) prevents the sprawl.

**Env note (out of scope):** the machine has dozens of orphaned node / `vite preview` processes from prior sessions (2026-07-02+) holding ports 4173-4176 and slowing local test runs — worth an operator cleanup.

## L1-3 (EFF-006) — PARKED with ready-to-brief surface

**Decision: PARK, do not build autonomously** (brief L1-3 PARK clause + Rule 6 — needs an architecture/freshness-contract decision).

**Phase-0 anchors (re-verified):**
- Schedule `'0 * * * *'` hourly → `leaderboardAggregate.js:439` (audit said `:439`; ✓). `.timeZone('UTC')` `:440`.
- `loadInputs` reads ALL submissions (YTD+14d window) + the **entire users collection** every run → `:65-73`.
- `computeAndWriteLeaderboards(tenantId, referenceDate=new Date())` → `:374`.

**Why a naive submission-dirty-flag gate is INCORRECT (the blocker):**
1. **Time-driven output.** `weeklyChampions/{priorWeekStarting}` (`:395-396,417`) and per-agent `previousRank` (`:365`) are derived from `referenceDate = now()`, not just submission content. At a week rollover (Sunday) the prior-week and champions doc-id change even with **zero new submissions** — a submission-only dirty flag would freeze the champions rotation and stale `previousRank`.
2. **User-doc dependency.** `loadInputs` reads the users collection; `groupByBranch`/`computeWeeklyChampions` filter on `isTestAccount`, `branchId`, `role`, `appearOnLeaderboard`. A branchId correction, test-account toggle, or deactivation should recompute — but fires no submission write → dirty flag never set → stale leaderboard.

**A correct EFF-006 therefore needs a decision (not a mechanical gate):**
- **Option A (recommended first step — clean, low-risk):** reduce cadence only. `'0 * * * *'` → e.g. `'0 */3 * * *'` (every 3h) or business-hours `'0 6-21 * * *'`. Pure one-line schedule change in `leaderboardAggregate.js`, no data-model, no hot-path write, no index, fully reversible. Cuts 24 → ~8–16 recomputes/day. Tradeoff: leaderboard up to 3h stale (vs 1h) — mild, and the cadence value is a tuning decision (like the "provisional" LEVEL_THRESHOLDS precedent). **Does NOT touch onSubmissionWrite** → no stacking.
- **Option B (the "proper" event-driven, needs design):** dirty-flag doc (`meta/leaderboardState` with `dirtyAt`/`lastRecomputeAt`) set by `onSubmissionWrite` (Admin SDK, no rules) **PLUS** a guaranteed period-boundary/safety recompute (≥ daily, and at week rollover) to cover the time-driven + user-doc cases. This is the "debounce" the audit calls the proper fix. Touches the hot `onSubmissionWrite` path (would stack after L1-2) + a new marker doc + freshness-contract decision (acceptable staleness for non-submission changes). **This is what needs a dispatcher/owner decision** — do NOT ship a submission-only gate.

**Recommendation:** ship Option A now (safe cadence cut) as EFF-006-lite, and brief Option B separately with the freshness-contract question answered. Falsification: Option A is overturned if any surface needs sub-3h leaderboard freshness overnight (none identified — no one reads the leaderboard at 3am).

## L1-1 (#807) + L1-2 (#808) — HELD, bot-dispositioned

**Merge order: #807 (L1-1) → then #808 (L1-2).** Both functions-only, HELD for human-merge + `firebase deploy --only functions`.

- **#807 HEAD `db1c88a5`** — Commit 1 `54e536e9` (MDRT 500k→688,800 named const), Commit 2 `df2a4de4` (tenure_floor_met badge + `wholeYearsSince` UTC-4-safe), Commit 3 `db1c88a5` (Gemini: reject non-real calendar dates).
- **#808 HEAD `b3d5c596`** — year-attribution (weekStarting-year, not entry date) stacked on #807.
- **⚠ Owner decisions at merge:** (1) confirm floor-marker KEY **`tenure_floor_met`**; (2) badge sticky-vs-status semantics (Gemini HIGH — DISAGREED, surfaced: all 10 badges are sticky `addIfNew`, changing only this one is inconsistent; system-wide product call); (3) ~~`mdrt_pace` 250k vs 344,400~~ **RESOLVED → 344,400** (owner 2026-07-05; shipped in #807 amend `94b21d5e`).
- **FUs banked (stashed → docs deliverable):** badge achievement-vs-status product question; `makeYtdAdminMock` consolidation (CodeRabbit trivial); EFF-004 items 2/3 annotated ADDRESSED-by-#807/#808.
- **Backfill:** self-heals on next submission post-deploy; recompute path writes rankings not badges → a submission event or dedicated backfill needed. FU stands.

## L1-1 detail (built, HELD-pending)

- **Phase 0:** MDRT badges write at a SINGLE site (`onSubmissionWrite`) — the recompute path writes no badges (brief Phase 0.1 corrected via grep, Rule 5/17). `contractStartDate` reachable with NO new read (hoisted from the guard-block user-doc read). `mdrt_pace` (250k) left untouched + surfaced. Floor placed as a badge (`tenure_floor_met`) next to MDRT markers.
- **Commit 1** (`54e536e9`): `MDRT_QUALIFIED_API=688,800` named constant (functions/lib/badgeThresholds.js, duplication of frontend canonical flagged); `mdrt_qualified` gate + both config-twin descriptions updated.
- **Commit 2** (`df2a4de4`): `tenure_floor_met` badge; `functions/utils/tenure.js wholeYearsSince` (UTC-4-safe whole-years); reuses existing user-doc read.
- **⚠ Floor-marker KEY `tenure_floor_met` awaits owner confirmation before merge** (permanent leaderboard-doc data).
- **Backfill:** self-heals on next submission post-deploy; recompute path writes rankings not badges — dedicated backfill/submission event needed. FU banked.
- **Deploy cmd (operator, post-merge):** `firebase deploy --only functions`.

_(Updated as work progresses.)_

---

# WAKE-UP REPORT

### 1. HARD PRECONDITION
✅ **PASSED.** EFF-004 (PR #805, `9dcae1a3`) merged AND on `main`; `functions/index.js:1503` uses the canonical `extractTotalProductionCredit` at the YTD reducer. **Lane 1 cleared** — items 1-2 built on post-EFF-004 code, not pre-EFF-004.

### 2. Lane 1 (serial, HELD, in order)

**L1-1 — MDRT threshold + tenure floor → HELD PR #807 (HEAD `db1c88a5`).** Deploy: `firebase deploy --only functions` (post-merge, operator).
- **Threshold sites:** SINGLE — `onSubmissionWrite` (`functions/index.js`) only. Grep proved the leaderboardAggregate/rankingLogic recompute path writes NO MDRT badges (brief Phase 0.1 corrected, Rule 5/17). `mdrt_qualified` 500,000 → **688,800** (named `MDRT_QUALIFIED_API`). `mdrt_pace` (250k) left untouched + surfaced.
- **⚠ Floor-marker KEY `tenure_floor_met` awaits owner confirmation** (permanent leaderboard-doc data — renaming after agents earn it strands the old key).
- **Backfill note:** both markers self-heal on each agent's next submission post-deploy; the recompute path writes rankings not badges, so a submission event (or a dedicated backfill pass) is needed to refresh existing docs. FU banked; recompute-before-pilot recommended.
- Gemini: 2 MED IMPLEMENTED (calendar-date validation in `wholeYearsSince`); 1 HIGH (delete badge when criteria lapse) DISAGREED+surfaced (all badges sticky by design — owner decides sticky-vs-status). CodeRabbit trivial (mock hoist) → FU. functions jest 373/373, root vitest 4228/4228, build clean.

**L1-2 — Year-attribution → HELD PR #808 (HEAD `a50ab9cf`, STACKED on #807).** Deploy: same (one `firebase deploy --only functions` covers both after they merge).
- **Attribution:** year now = `String(after.weekStarting).slice(0,4)` (leading-4-char, UTC-4-safe — not a Date parse). A Dec-`weekStarting` sub entered in January counts to the Dec year.
- **Straddle:** `weekStarting 2025-12-29` attributes ENTIRELY to 2025. Same attribution year drives the `mdrt_pace` week-of-year base (`Date.UTC`, Gemini #808 fix) so a prior-year late entry yields week>26 → no false pace.
- functions jest 373/373 (+4 attribution tests). Gemini `Date.UTC` IMPLEMENTED.

**L1-3 — EFF-006 cron → ⛔ PARKED (ready-to-brief surface above).** A submission-only dirty-flag gate is INCORRECT: the cron output is time-driven (weekly-champions rotation + previousRank derive from `now()`) and user-doc-dependent — so it needs an architecture/freshness-contract decision (brief PARK clause + Rule 6). Recommended: Option A (cadence cut, one-line, clean) now; Option B (event-driven + safety recompute) briefed separately.

**L1-4 — EFF-002 Phase 2 → PARTIAL, built (branch `perf/eff002-phase2-manualchunks`, `cc4c1060`).** HELD (load-path-adjacent). Shipped the `manualChunks` vendor-grouping (backlog headline enabler); per-tab lazy-split scoped as fast-follow (4-5 tests mount ManagerDashboard → need Suspense-awareness).
- **Chunk count before/after — sprawl AVOIDED:** the reverted first attempt fanned shared leaves into **36-50 tiny chunks**; this ships **5 named vendor chunks, ZERO tiny-chunk sprawl** (`vendor-icons`/`-charts`/`-firebase`/`-pdf`/`vendor`). Entry `index` 17.94 kB gzip. Invariants preserved: `vendor-pdf` + `ManagerDashboard` stay lazy (EFF-011 + EFF-002 P1). **Adversarial smoke 66/66 both themes.**

### 3. Lane 2
**THIN — 0 merges.** No genuinely-safe trivial frontend items were queued; the frontend-auto backlog items (A11Y-101/102 modal focus, EFF-010/012/017) are build-tasks better done as their own briefed PRs, not end-of-window auto-merges to production. Did NOT pad with risky work (per brief). The window's frontend capacity went to L1-4 (held, not auto-merged — load-path change).

### 4. Lane 3
Refreshed backlog: `docs/audits/mixed-run-2-2026-07-05/NEXT-WINDOW-BACKLOG.md`. Corrected 4 drifted anchors (ARCH-001 `:50`/`tatillife_south`, A11Y-101 `:526`, A11Y-102 `:689`, EFF-015 `:701`). **Node.js 20 Functions runtime: deprecated 2026-04-30, DECOMMISSIONED 2026-10-30 (hard wall — `firebase deploy --only functions` blocked after).** Pins: `functions/package.json` `node: "20"`; scope the bump TOGETHER with `firebase-functions` 4.9.0→≥5.1.0. Lane counts: ~13 frontend-auto · ~13 functions-held · ~9 needs-decision.

### 5. Self-critique (Rule 22)
- **L1-4 local vitest flaked (4/4228) under extreme machine load** (91 stale node procs, environment 2923s). `manualChunks` is a Rollup `build`-output option vitest never reads (`test` config is fully separate; `functions/**` excluded) — so it cannot cause a test failure by any mechanism; earlier this session the full suite was green 4228/4228. Re-run in progress on the freed machine to confirm; CI's clean-runner vitest is the authoritative backstop. **Gap: I have not yet seen a clean local 4228 on the L1-4 tree at report time.**
- **L1-4 is a PARTIAL** — the per-tab lazy-split (the higher-effort half) is scoped, not shipped. The `manualChunks` value is primarily caching + enabler, not a first-load byte cut.
- **Floor-marker semantics unresolved** — I placed `tenure_floor_met` as a sticky badge per the brief; whether it should be a per-year status (Gemini's HIGH) is an owner call I surfaced but did not resolve.
- **EFF-006 Option A (cadence) not shipped** — I parked the whole item rather than ship the safe cadence cut, because even the cadence value is a (mild) freshness decision the brief tied to the dirty-flag shape; a dispatcher could reasonably say "just ship Option A."

### 6. Recommended merge + deploy order + owner decisions
1. **Merge #807 (L1-1) first** → **then #808 (L1-2)** (stacked; GitHub auto-retargets #808 to main on #807 merge). Both are correctness-first. **⚠ #808 stacked-CI caveat:** `.github/workflows/ci.yml` triggers `on: pull_request: branches: [main]`, so while #808's base is `fix/mdrt-tenure-floor` its `functions-tests` + `lint-and-build` checks **do not run** (only Gemini + Vercel did). After #807 merges and #808 auto-retargets to `main`, those checks fire — **poll them green on #808 before merging it** (its functions changes were locally verified: functions jest 373/373).
2. **One `firebase deploy --only functions`** after both merge (covers L1-1 + L1-2). Then re-run the `tatillife_smoke` MDRT smoke to confirm `mdrt_qualified` @ 688,800 + `tenure_floor_met` appear.
3. **Owner decisions:**
   - **Confirm the floor-marker KEY `tenure_floor_met`** (or rename before merge — permanent data).
   - **Badge sticky-vs-status** (Gemini HIGH): keep sticky (current), or make YTD badges clear when criteria lapse (apply to `mdrt_qualified` too, consistently)?
   - ~~**`mdrt_pace` target**: 250,000 vs 344,400?~~ **RESOLVED 2026-07-05 → 344,400** (owner). Shipped in the #807 amend (`94b21d5e`); #808 rebased (`d0c87620`). Only the `mdrt_pace` future-year guard remains as a LOW FU.
   - **EFF-006**: ship Option A cadence cut now, or brief Option B event-driven?
   - **L1-4**: merge the `manualChunks` foundation (#TBD PR) as-is, then brief the per-tab split?
4. **Post-merge:** land the docs deliverable (FOLLOW_UPS FU banking + this RUN-LOG + refreshed backlog) — staged separately from the money PRs.
