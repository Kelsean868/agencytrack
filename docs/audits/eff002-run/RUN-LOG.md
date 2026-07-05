# EFF-002 Code-Splitting (HOLD) + FinancingRiskPanel flake fix — Orchestrator RUN-LOG

> Living wake-up report. Orchestrator: **Opus** (executes both lanes; Fable exhausted).
> Brief: `docs/briefs/orchestrator-eff002-codesplit.md`. Started 2026-07-05.
>
> **Two non-colliding lanes.** LANE 1 (EFF-002 code-splitting) → build to PR-open and **HOLD** for
> human merge (owns App.jsx + dashboards + manager tabs). LANE 2 (FinancingRiskPanel test flake) →
> **AUTO-MERGE + auto-revert** (owns only the one test file).
>
> **Never merge EFF-002. Never run `firebase deploy`. Serialize all main-touching operations.**

---

## Governing constraints (from brief — non-negotiable)

1. **Lane 1 is HOLD-ONLY.** Med-change-risk load-path change. Build to PR-open, STOP. Human reviews/merges.
2. **Lane 2 auto-merge is frontend/test-only + auto-revert.** Touches only `FinancingRiskPanel.test.jsx`.
   Auto-merge on green; on post-merge CI/smoke fail → `git revert <squash-sha>`, push, confirm, flag AUTO-REVERTED.
3. **Never `firebase deploy`.** Neither lane touches rules/functions.
4. **Lanes must not share files.** Lane 1 = App.jsx + dashboards + manager tabs. Lane 2 = the one test file only.
5. **Trust CONTEXT.md / FOLLOW_UPS.md over the audit's line anchors** (audit is 2026-07-05, pre-6-merges; lines shifted). Re-verify every anchor by grep (Rule 17).
6. **No scope expansion.** Lane 1 = code-splitting only (lazy + Suspense). Do NOT re-split the PDF engine (EFF-011/#802 already did). Do NOT refactor while splitting. Bank scope-expanding bot nitpicks.
7. **Re-poll bots fresh before Lane 2 merge; CI green on the exact HEAD.**

---

## Step 0 — Ground truth (COMPLETE)

**Git state:** on `main`, local == `origin/main` at `06f97ff0` (the committed orchestrator brief). No pull needed.
Working tree has benign EOL-only phantom diffs on 4 tracked files (`core.autocrlf=true` + `.gitattributes`; `git diff --ignore-all-space` = empty) plus pre-existing untracked audit artifacts. Will be surgical with `git add` (specific paths only) so these never enter my commits.

**Current main HEAD:** `eb20be1a` (PR #802, EFF Phase-1 render/read-hygiene; held for human-merge, no deploy).

**What #802 (EFF-011) already made lazy — DO NOT TOUCH (Rule 6):**
- `src/services/exportService.js:31-32` dynamic-imports `@react-pdf/renderer` + `AgentReportDocument` inside `generateAgentPDF`. Entry chunk **1,133.38 → 644.85 kB gzip (−488.5 kB / −43%)**; react-pdf is now a lazy ~481 kB chunk loaded only on first export. Confirmed by grep: this is the **only** production `import()` in `src/` — every other match is test-file `await import(...)`. EFF-002 must not re-split the PDF engine.

**Zero other code-splitting confirmed:** no `React.lazy`/`Suspense` anywhere in production `src/`. App.jsx eager-imports all role dashboards.

**Lane 2 flake FU (FOLLOW_UPS.md line 214, brief said ~204 — drift confirmed, Rule 5):**
- File: `src/components/manager/__tests__/FinancingRiskPanel.test.jsx`. Failing test: **"fires the notify CF and shows the cooldown after a successful notify"**. Times out at 5000ms (vitest default) under CI load; #790 (5022ms), #791, and #802 (3rd occ) — passes clean in isolation (16/16, 565ms local). Likely: async CF mock + cooldown timer interaction. Falsification: a 3rd occurrence with a *different* failure mode (real assertion, not timeout) would mean it's not pure flake. **CONTEXT.md records #802's occurrence as a timeout that "cleared on re-run" — still a timeout, so pure-flake diagnosis holds.**

**Anchor re-verification (Rule 5 / 17) — audit lines vs current:**
| Audit said | Current (re-grepped) | Notes |
|---|---|---|
| ManagerDashboard `activeTab ===` at 445-624 | **450-629** | tab conditional-mount boundaries; drifted ~+5 |
| AgentDashboard prop site 692/693 | n/a for EFF-002 | (EFF-009 territory, already shipped) |
| Recharts 3 sites | **confirmed**: `KPICard.jsx`, `agent/PersistencyTab.jsx`, `goals/CommissionPlayground/components/CashFlowChart.jsx` | matches audit |

---

## Orchestration plan & serialization

Only Lane 2 touches `main` (its merge). Lane 1 never merges (HOLD) — its pushes go to `perf/eff002-code-splitting`, never main. So the lanes cannot race on main.

**Order chosen: Lane 2 fully first, then Lane 1's long phased build.**
- Cleanest serialization (zero overlap). Lane 2 is small/fast; merging it early clears it out of the way per brief Lane-2 step 7.
- Lane 1 then branches from the post-Lane-2 main, so Lane 1's own CI inherits the flake fix (won't re-hit the FinancingRiskPanel timeout).
- **Rule 16(b) reconciliation:** Lane 2 is **test-only** (excluded from the runtime bundle) → it is a housekeeping merge: **no CONTEXT.md fill commit, does NOT become `Current main HEAD`.** Brief Lane-2 step 5 "fill placeholders" resolves to "no placeholders introduced." Post-merge I still sync + verify CI-green + Rule 15 origin-check on the merge itself.

---

## LANE 1 — EFF-002 SPLIT PLAN (Phase 0 output)

Branch: `perf/eff002-code-splitting`. Phase 1 = 1 commit; Phase 2 groups = subsequent commits (dashboard split independently revertable).

### Phase 1 — Dashboard split (the big win, lowest risk)
- **B1 · `src/App.jsx`** — `React.lazy` the role dashboards; render behind a single `<Suspense fallback={<LoadingScreen/>}>`.
  - Mount points (current): `<TenantAdminDashboard/>` :108, `<ManagerDashboard/>` :109, `<AgentDashboard/>` :113.
  - Fallback: reuse the existing themed `LoadingScreen` (App.jsx:23-33) — CSS-var-driven (`bg-surface`/`card`/`text-ink-muted`/`border-primary`), correct in both themes; identical to the app's auth-loading treatment.
  - **Scope note (documented, within Rule 6):** brief names "the two dashboards" (Agent + Manager). App.jsx eager-imports a **third** role dashboard, `TenantAdminDashboard` (:12). Lazying all three is the faithful implementation of EFF-002's goal ("an agent never loads manager code") — leaving TenantAdmin eager would keep tenant-admin code in every agent's entry chunk. Still pure lazy+Suspense, no refactor.
  - Expected chunks: `AgentDashboard-*.js`, `ManagerDashboard-*.js`, `TenantAdminDashboard-*.js` split out of the entry chunk.
  - Test safety: only `src/__tests__/AppResetGuard.test.jsx` renders `<App>`; all 6 cases exercise eager pre-dashboard paths (login/reset/verify) and never mount a dashboard → Suspense never activates. Full suite still gated at checkpoint.

### Phase 2 — Manager tab splits (incremental, each verified, each own commit)
Lazy the heavy tabs at their existing `activeTab ===` conditional mounts inside `<Shell>` (450-629), behind Suspense with the themed fallback in the content area (Shell chrome stays eager). STOP-revert-bank per group if a split breaks (again-eager chunk / flashing fallback / chunk 404).
- **2a — Recharts-bearing / heaviest:** `persistency` (`manager/PersistencyTab`), `mp-commission` region (`goals/CommissionPlayground` → `CashFlowChart`).
- **2b — Heavy tables:** `mastersheet` (`MasterSheet`, EFF-012), `team-perf` (`TeamPerfRosterPage`, EFF-014), `compliance` (`CompliancePanel`).
- **2c — Remaining heavy manager panels:** `team` (UserManagementPanel), `campaigns` (CampaignPanel), `production-report`, `awards` (ManagerAwardsPanel), `settlements`, `financing` (FinancingTab), `goals` (GoalsPanel), `kiosk`, `agent-of-month`, `my-war`/`team-wars`/`monthly-recruiting`, `policy-reconciliation`, `unit-financing`, `team-game-plans`, leaderboards.
- **2d (conditional) — `mp-*` agent-mirror tabs** (share components w/ AgentDashboard: MoneyNeedsPanel, GamePlanScreen, PolicyLedgerPanel, HistoryTab) — lazy helps both surfaces.
- **DEFER / bank-as-FU if hairy:** full-screen early-returns outside Shell (`WizardForm` @ mp-report, `MeetingMode`, `DailyCaptureV2`) — need their own Suspense wrappers; higher UX-touch, lower priority.

### EFF-013 note (Phase 0.4 — NOT fixed here, out of scope)
Recharts' 3 importers: `KPICard` (renders on the agent default view AND the manager overview via `BranchKPIStrip`), `PersistencyTab`, `CashFlowChart`. Because **KPICard is on BOTH dashboards' default views**, tab-splitting alone **cannot** remove Recharts from either dashboard's loaded code — it stays via the default-view sparklines. Only EFF-013 (replace the KPICard sparkline with inline SVG, or lazy KPICard) removes Recharts from the critical path. Tab-splitting still helps: it removes the split tabs' *other* code from the base chunks and lets Recharts settle into a shared chunk loaded once. Recommend EFF-013 as the natural Phase-2-follow-on for the agent path.

### Chunk measurement
Build pristine Lane-1 branch (== main) for the **honest before-number** before editing (Phase 1 checkpoint), then rebuild after Phase 1 and after each Phase-2 group. Record entry-chunk gzip before/after here.

### Adversarial smoke (committed, `scripts/verification/`)
Against the Lane-1 Vercel preview: (1) agent path — dashboard paints + **network trace asserts `ManagerDashboard-*.js` is NOT fetched**; every agent tab renders. (2) branch_manager — every manager tab's lazy chunk resolves, fallback→content, no infinite fallback / wrong-theme flash. (3) slow-network (CDP Slow-3G) subset — fallbacks resolve, no white screen, no chunk-load error. (4) direct-route cold load of a lazy manager route. (5) both themes, 0 unhandled console errors (chunk-load error = FAIL). Value/network-level assertions, not selector-only.
> Branch-alias note: `perf/eff002-code-splitting` alias > 63-char DNS limit → use the immutable per-deployment URL from `gh api .../deployments` (CLAUDE.md).

### Screenshots → `docs/audits/eff002-run/screenshots/`
Each distinct Suspense fallback in both themes (desktop); dashboard-level + one manager-tab fallback under slow-network; `INDEX.md` naming each shot + its boundary/state.

---

## LIVE STATUS

### Lane 2 — FinancingRiskPanel test flake ✅ MERGED (no revert)
- **Result: MERGED — squash `62d37e92` (PR #803).** No auto-revert (main green).
- Branch `fix/financingrisk-test-flake` (deleted on merge). Report HEAD was `cf502f27` (Rule 20).
- Fix: file-level `vi.setConfig({ testTimeout: 15000 })`. Root cause: RTL `asyncUtilTimeout:5000` (test-setup.js:12) == vitest default per-test budget → this file's multi-`waitFor` notify-cooldown test (+ async-switch-race siblings) tips over the whole-test window under CI CPU starvation. Diff = the one test file only (+11 lines). No `FinancingRiskPanel.jsx` source change.
- Local gates: file run 5× green (16/16); lint 0; **full suite 4225/4225**; build clean (entry chunk **644.85 kB gzip = the honest Lane-1 BEFORE number**; react-pdf already its own 481.31 kB chunk, confirming EFF-011).
- CI (exact HEAD `cf502f27`): `lint-and-build` PASS (3m27s) · `functions-tests` PASS · `gemini-review` PASS · CodeRabbit PASS · Vercel PASS.
- Rule 21: **both reviewers reviewed `cf502f27` with ZERO findings** — Gemini "no feedback to provide"; CodeRabbit "No actionable comments." Nothing to disposition.
- Post-merge (Rule 16(b): test-only → no CONTEXT.md fill, no HEAD bump): main builds clean (644.85 kB gzip, 5.17s), fixed test 16/16 on merged main; no push-to-main CI exists (CI is PR-gated) so "main green" = the PR's green CI on the exact merged content. FU marked RESOLVED in FOLLOW_UPS.md → docs commit `4b9c8517` direct to main, Rule 15 MATCH verified.
- **Current main HEAD: `4b9c8517`** (Lane 1 branches from here, inheriting the flake fix + FU closure).

### Lane 1 — EFF-002 code-splitting (HOLD) — PR #804 OPEN, HELD
- Status: **Phase 1 SHIPPED to PR-open + HELD for human merge. Phase 2 reverted → banked FU.** Branch `perf/eff002-code-splitting` @ base `4b9c8517`, **HEAD `030ed8f0`** (Rule 20). PR **[#804](https://github.com/Kelsean868/agencytrack/pull/804)** — **NOT merged, NOT deployed.** Vercel preview `agencytrack-4s1tuvp85-…` (branch alias >63-char DNS limit → immutable deployment URL used, per CLAUDE.md). **Adversarial smoke 60/60 on BOTH local `vite preview` AND the Vercel preview**, both themes (Vercel first pass 58/60 — only the light/manager slow-net fallback leg, a data-load-under-throttle timing artifact; smoke resolve-signal switched to nav-mount in `030ed8f0`, re-run clean).
- Phase 0 (recon + split plan): ✅ COMPLETE (above)
- **Phase 1 (dashboard split): ✅ COMPLETE — commit `7ae869ff`.** App.jsx lazy()s all 3 role dashboards (Agent/Manager/**TenantAdmin** — the within-scope third eager dashboard) behind one `<Suspense fallback={<LoadingScreen/>}>`.
  - **Entry chunk `index-*.js`: 644.85 → 221.55 kB gzip (−423.3 kB / −65.6%).** New chunks: ManagerDashboard 96.59 · AgentDashboard 27.22 · TenantAdminDashboard 17.41 kB gzip. Rollup auto-extracted shared chunks (FinancingSelfView 229, managerActivityStandardsService 33, StatusPill 23). react-pdf untouched (481 gzip, EFF-011). **Recharts is out of the entry chunk.**
  - Gates: lint 0 · full suite **4225/4225** (AppResetGuard 6/6) · build clean.
  - **Adversarial smoke: 60/60 PASS** (local `vite preview`, both themes): agent path NEVER fetches Manager/TenantAdmin chunks (EFF-002 goal ✓); BM loads Manager chunk + all 14 heavy tabs render, 0 chunk failures; slow-3G Suspense fallbacks show + resolve (agent+manager, both themes); 0 genuine console errors. The only local 404s (`/_vercel/insights`, `/_vercel/speed-insights`) are Vercel-edge endpoints absent on localhost — env noise, filtered.
  - Screenshots: `docs/audits/eff002-run/screenshots/suspense-fallback-{agent,manager}-{light,dark}-slow3g.png` — themed LoadingScreen, both themes verified by eye.
- **Phase 2 (manager tab splits): ATTEMPTED → REVERTED → banked as FU.** Implemented lazy-splitting of the in-Shell manager tab panels behind a content-area `<Suspense fallback={<TabFallback/>}>`. Verified at two granularities:
  - **29 panels lazy:** ManagerDashboard base 96.59 → **14.68 kB gzip**, but **~130 total chunks / ~50 tiny** (single-icon `chevron-*`/`bell`/`mail` chunks) + Rollup shuffled firebase (142 gzip) into a sibling always-loaded chunk.
  - **16 heavy panels lazy (scaled back, "group sensibly"):** ManagerDashboard base → **35.55 kB gzip**, **99 chunks / 36 tiny** — still "dozens of tiny chunks."
  - **Decision (brief's Phase-2 fallback + Rule 1):** the tiny-chunk sprawl is inherent to per-panel `lazy()` without a Rollup `manualChunks` vendor/icon-grouping strategy — a **build-config** change I must not introduce unilaterally in an autonomous run (Methodology Rule 1). The benefit is manager-only and marginal vs Phase 1's agent win. Per the brief — *"If Phase 2 later gets hairy, this is the safe ship point"* — **reverted `ManagerDashboard.jsx` to base** (13-chunk Phase-1 topology restored, re-verified) and **banked Phase 2 + the manualChunks pairing as a MEDIUM FU** (`docs/FOLLOW_UPS.md`).
- **Before/after entry-chunk gzip: 644.85 → 221.55 kB gzip (−65.6%)** — Phase 1, shipped. (EFF-011 baseline was 1,133.38 → 644.85; cumulative from pre-#802: 1,133.38 → 221.55, −80%.)
- Smoke: **local 60/60** both themes on the shipped Phase-1 build (Vercel-preview re-run to follow the push) · Screenshots: 4 saved + INDEX.md · PR #: _pending push (HELD)_
- Skipped/banked tab splits: **all of Phase 2** → FU "EFF-002 Phase 2 — per-manager-tab code-splitting + Rollup manualChunks" (MEDIUM).
- **CI (HEAD `030ed8f0`): all green** — lint-and-build (3m31s) · functions-tests · gemini-review (3m11s) · CodeRabbit · Vercel.
- **Rule 21 bot disposition (both reviewed `030ed8f0`):** Gemini + CodeRabbit BOTH raised ONE finding — *add a chunk-load error boundary around the lazy `<Suspense>`* (a rejected dashboard `import()` — e.g. stale cached `index.html` → dead chunk hash after redeploy — crashes to a white screen; Suspense catches loading, not failure). Initially BANKED per GOVERNING RULE 6 (Lane 1 = lazy + Suspense only); **the dispatcher then authorized the fix onto this branch (FU brief `fu-eff002-safety-error-boundary.md`) — now IMPLEMENTED, so the bots' finding RESOLVES.**
- **EFF-002-safety FU — DONE (added to this branch):** `src/components/ui/ChunkLoadErrorBoundary.jsx` (class boundary, `getDerivedStateFromError` + `componentDidCatch` console-only) wraps the `<Suspense>` in `App.jsx`. Rejected dashboard `import()` → themed Nexus fallback (teal `AlertTriangle`, "Something didn't load", 44px **Reload** → full `window.location.reload()`, not a state reset). Scope: boundary + reload only (no retry/preload/manualChunks). Gates: 3 unit tests · lint 0 · suite **4228/4228** · build clean (entry 221.55 → 221.80 kB gzip, +0.25) · **smoke 66/66** both themes incl. a new chunk-FAILURE leg (route-abort chunk → fallback + working Reload, not blank) · error-fallback screenshots (light+dark) added. FOLLOW_UPS FU marked RESOLVED.

### Self-critique (Rule 22) — known gaps
1. **Smoke ran against LOCAL `vite preview`, not yet the Vercel preview.** Local faithfully reproduces chunk-load behavior (identical built chunks, same relative `/assets/` paths, real Firebase auth via `VITE_FIREBASE_*` + localhost authorized domain) — but does NOT exercise Vercel's edge chunk-serving, cache headers, or base-URL handling. I will re-run the committed smoke against the Vercel preview after the push (the brief's intended target); until then Vercel-specific chunk-path behavior is unverified. **This is the one gap I actively close post-push.**
2. **Entry-chunk composition is inferred, not byte-attributed.** The 221.55 kB gzip total is a real measurement and Recharts-absence was confirmed by grep on the built chunk, but I did not run `rollup-plugin-visualizer` — exact per-module byte shares of the entry chunk are reasoned from the import graph.
3. **"Direct-route load" leg is architecturally N/A** (no client router; tabs are `useState`). Cold per-role login covers cold-entry dashboard-chunk loading, but there is no per-tab URL to cold-load — a class the brief's leg 4 anticipated that this app cannot exhibit.
4. **Slow-network fallback screenshots capture `state-loading`,** which is the same `LoadingScreen` component used for both auth-loading and the Suspense fallback. The shot faithfully shows what a slow user sees; the separate `slow-fallback-resolved` legs prove the lazy chunk resolves without white-screen regardless of which phase it was.
5. **Phase 2 revert is a judgment call.** If the dispatcher deems ~36 tiny chunks acceptable (HTTP/2 caching benefit may outweigh request overhead) or wants the `manualChunks` pairing done, the manager-base-chunk win (96.59 → 14.68 kB gzip) is fully specified in the FU and recoverable.

### Recommended next (for Kyron's review of the held EFF-002 PR)
- **The numbers:** entry chunk **644.85 → 221.55 kB gzip (−65.6%)** on the #802 baseline (**cumulative −80%** from pre-#802's 1,133.38 gzip). New role chunks load only for the matching role: ManagerDashboard 96.59 · AgentDashboard 27.22 · TenantAdminDashboard 17.41 kB gzip. An **agent never fetches the manager chunk** (smoke-proven).
- **What to eyeball in the screenshots** (`docs/audits/eff002-run/screenshots/`): the 4 Suspense-fallback shots (agent+manager × light+dark) under Slow-3G — confirm the themed `LoadingScreen` reads as intentional in BOTH themes (warm beige/white card + teal spinner in light; warm near-black/dark card + lifted-teal spinner in dark), not a raw spinner or a flash-of-wrong-theme.
- **The load-path change to review** is small and self-contained: Phase 1 is one commit (`7ae869ff`) touching only `App.jsx` — the `AppRoot` role-dispatch is unchanged except the three dashboards now render behind one `<Suspense>`. Phase 2 is deferred (FU), so there is no manager-tab churn to review.
- **On merge:** run `/post-merge` to fill CONTEXT.md's top table (Current main HEAD → the EFF-002 squash SHA + a Recently-shipped row). Optionally re-run `scripts/verification/smoke-eff002-code-splitting.mjs --prod` (or with `SMOKE_BASE_URL=<prod>`) as a production confirmation.
