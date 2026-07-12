# Fable Run 6 — Progress Log

Run start (TT): 2026-07-11, unattended 20h window. Start HEAD: `322d666f` (origin/staging tip, Run 5 close).
Brief: [`docs/briefs/fable-run6-kickoff.md`](briefs/fable-run6-kickoff.md).
Prior run: [`docs/fable-run5-progress.md`](fable-run5-progress.md) (Company Config slice 1; E1 41/41).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | ✅ | `6ec0f743` |
| 0.2 Baseline re-seed + full VH suite (41 legs) | ✅ | re-seed 94 docs → **41/41 PASS, 0 FAIL, 0 SKIP**. Full scope authorized. Log: out/run6-baseline-vh.log |
| PHASE 0 build-map revalidation (Opus; never dropped) | ✅ | `f93d5535` + orchestrator Rule-17 correction `23e6c67e`. ~117 findings re-verified at `e65fe143`: ~63 RESOLVED-SINCE / ~26 PARTIAL / ~24 STILL-VALID / 2 SUPERSEDED / 2 deliberate-divergence (~76% of old MISSING shipped). All 7 operator-flagged stale items confirmed shipped. CONTEXT.md Active-track updated; old audit preserved. New doc = active build map. |
| §1(a) Silent-swallow disposition sweep (Opus) | ✅ | Full table below; 5 SURFACE fixes shipped `3c4f9c5c` (dead error card reconnected in useBranchOverview; useMyProduction loadError + card; 2 action-failure toasts). 75/75 targeted tests. |
| §1(b–e) Error cards / PanelSkeleton / empty states / partial-failure banners | ✅ VERIFIED-SHIPPED | The §1a enumeration doubled as the (b–e) audit: ~52 ALREADY-SURFACED sites confirm error-card+Retry grammar is pervasive (production views carry per-source partial banners; TenantAdminDashboard has the 4-source partial banner; ExceptionLeadPanel/PanelSkeleton four-states baked in). No spinner/em-dash-stuck-tile instances found on primary panels during the sweep. |
| §1 live-smoke touched surfaces | ✅ | `e65fe143` — new legs t1-admin-exception-lead + t1-company-config-gate PASS live at `3c4f9c5c`; t1-exception-lead-drill re-run green (manager overview populated path through the §1-fixed useBranchOverview). Suite now 43 legs. error→Retry proven at RTL level (banked note). |
| §4 Focus-trap: 7 named dialogs | ✅ VERIFIED-SHIPPED | All 7 already use useFocusTrap (or the documented EditUserDrawer inline idiom) with 8–11 Escape/focus test assertions each — see recon section. Nothing built. |
| S1 DELETE DailyEntryModal (+test) | ✅ ALREADY-DELETED | File + importers = zero at HEAD. |
| S2 DELETE unwired onboarding steps | ✅ ALREADY-DELETED | onboarding/ = WelcomeScreen + tests only. |
| S3 TierGoalForm activity targets | ✅ VERIFIED-SHIPPED | Shared GoalLevelForm (GoalsPanel.jsx:194–205) renders optional FFIs/CIs/Dials across Unit/Branch/SM tier tabs. |
| S4 CompliancePanel ScopeSwitch | ✅ | `3d42125f` — BM multi-unit segmented Branch/per-unit switch (mockup grammar, MasterSheet segBtn visual, deriveUnitOptions reuse); filter threads through scopedRoster to counts/reality-bar/exceptions/nudge-all; hidden for UM/SM/single-unit; >5 units → select. 25/25 tests. CBTT license section left unscoped (judgment call, banked). |
| S5 Admin exception-lead block | ✅ | `07a24ffa` — ExceptionLeadPanel tenant-wide on TenantAdminDashboard via canonical deriveExceptions; 4th data source (companyMinimums) joins the loadX/retry/partial-banner contract; drill = AgentDrillDrawer (canManage includes tenant_admin — NO rules change). Tests 39/39. Live smoke pending. |
| §2 Motion (droppable) | ✅ | `72daabf8` — count-up already broad (audit); shipped the two true residuals: HomeV2 staggered assemble (shipped .stagger class, fixed overlays outside per containing-block rule) + production-podium per-card stagger + tail bar-grow-x (shipped tokens only). Reduced-motion gated in the same block xc-reduced-motion asserts. 8 new tests; 123/123 regression; keyframe verified in compiled bundle. |
| §5 Dense-table sticky (droppable) | ✅ VERIFIED-SHIPPED | ProductionTable (sticky header + rank/agent cols + footer, :27–116) AND productionReport/RankedLeaderboard (sticky header + §5 footer count, :46–94) both already implement the contract. Kiosk RankedLeaderboardPanel is a fixed top-8 broadcast podium — sticky N/A. |
| Campaigns persistency gate — DISPLAY ONLY (first to drop) | ✅ | Gate math + standings display + tier ladder were ALREADY SHIPPED (recon above). Remaining slice = registry rows: `f018931a` (4 SOON/read-only band rows + 4 parity assertions, 41/41). HARD STOP respected: zero write paths touched. |
| E1 re-seed + full suite vs deployed rules (no-regressions gate) | ✅ | re-seed 94 docs → **44 legs: 43 PASS / 0 FAIL / 1 SKIP**. All 41 pre-existing legs GREEN — no-regressions gate SATISFIED, zero reverts. The 1 SKIP is the new t1-compliance-scope leg's documented seed-gap guard (not a regression; activates when a 2nd unit_manager fixture lands). No rules changed this run (deployed rules = pre-run state). Log: out/run6-e1-final-vh.log |
| E2 final doc + push | ✅ | this commit; verbatim origin line in the run-close operator report (a doc cannot quote its own future SHA — Rule 17 chicken-and-egg, same as Run 5) |
| E3 HOLD | ✅ | no merges to main, zero prod contact all run, nothing further |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 run docs | Fable (orchestrator) | ~22:00 | ~22:05 | ✅ | `6ec0f743` |
| 0.2 baseline seed + 41 legs (bg) | orchestrator | ~22:05 | ~22:18 | ✅ 41/41 | — |
| Phase 0 build-map revalidation | **Opus 4.8** | ~22:06 | | | |
| §1a swallow disposition (analysis) | **Opus 4.8** | ~22:12 | ~22:19 | ✅ 5 SURFACE / 5 UNSURE / rest KEEP or ALREADY | — (analysis) |
| Brief-item recon (§4/S1/S2/S3/§5/campaigns verify) | Fable (orchestrator) | ~22:06 | ~22:25 | ✅ 6 items verified-shipped | — |
| Campaigns registry rows + parity | Fable (orchestrator) | ~22:20 | ~22:26 | ✅ 41/41 parity | `f018931a` |
| §1 SURFACE fixes build | **Sonnet** | ~22:20 | +11.3 min | ✅ 75/75 targeted; lint clean | `3c4f9c5c` |
| S5 admin exception-lead build | **Sonnet** | ~22:20 | +8.5 min | ✅ 39/39 targeted; no rules change | `07a24ffa` |
| VH legs author + live run | **Sonnet** | ~22:33 | +5.9 min | ✅ 3/3 legs PASS live first attempt | `e65fe143` |
| Phase 0 build-map revalidation (ended) | **Opus 4.8** | ~22:06 | +38.3 min | ✅ new build map; 1 stale row caught+fixed by orchestrator review | `f93d5535`, `23e6c67e` |
| §1(b) Retry holdouts build | **Sonnet** | ~22:52 | +6.9 min | ✅ 38/38 (3 panels, new onSnapshot retryKey idiom) | `d4e5220d` |
| S4 ScopeSwitch build | **Sonnet** | ~22:52 | +7.7 min | ✅ 25/25 (7 new scope tests) | `3d42125f` |
| §2 stagger motion build | **Sonnet** | ~23:10 | +13.7 min | ✅ 8 new tests; 123/123 regression; build clean | `72daabf8` |
| Awards §1 finish + Settlements §5 (audit Tier-0 residuals) | **Sonnet** | ~23:30 | +10.2 min | ✅ 18/18 (awards 13→15, settlements 0→3); orchestrator extended §5 to the UM twin table for same-file consistency | `9beb2aa7` |
| Gates: lint + build | Fable (orchestrator) | ~23:45 | ~23:50 | ✅ both clean | — |
| Gates: full unit suite | orchestrator (bg) | ~23:50 | +14 min | ✅ 5325/5325 (345 files) | — |
| UM settlement-table §5 extension | Fable (orchestrator) | ~00:00 | ~00:08 | ✅ folded into residuals commit | `9beb2aa7` |

**Routing notes:** no Haiku anywhere (per rails); zero two-strike escalations — every down-routed Sonnet part passed its gates first time. Opus floor honored for Phase 0, §1(a) disposition, and campaigns-gate judgment (orchestrator handled the display-only registry slice directly; no gate math was written — it already existed). One agent-produced stale claim (audit §5 row) caught by orchestrator Rule-17 review; one builder-flagged same-file inconsistency (UM settlements table) closed by orchestrator extension.
| VH leg t1-compliance-scope | **Sonnet** | ~23:12 | +7.2 min | ✅ authored; SKIPs live (seed gap, banked); master-sheet-filters regression green | `b03242c9` |

## Orchestrator recon (pre-build verification of brief items, Rule 17 grep-verified at `6ec0f743`)

Several brief items were authored from the stale 2026-07-07 audit and are ALREADY SHIPPED on staging HEAD:

- **§4 focus-trap: RESOLVED-SINCE, all 7 dialogs.** DeactivateBranchConfirmDialog (`useFocusTrap` :22), PlanCatalogModal (:49), WelcomeScreen (:56), PolicyDrillDrawer (:42), PersistencyPlayground (:64), EditUserDrawer (documented inline trap+Escape+focus-return idiom, :220–245), MeetingMode overlay (:682). Each has a test with 8–11 Escape/focus assertions. Nothing to build; no test authoring needed.
- **S1: RESOLVED-SINCE.** `src/components/daily/DailyEntryModal.jsx` does not exist; zero importers; daily/ contains only DailyCaptureV2*, DailyFAB.
- **S2: RESOLVED-SINCE.** `src/components/onboarding/` contains only WelcomeScreen.jsx + tests; no steps/ dir, no importers.
- **S3: RESOLVED-SINCE (pending final read).** Shared `GoalLevelForm` (GoalsPanel.jsx:194–205) already renders optional FFIs/CIs/Dials NumInputs; Unit/Branch/SM tier tabs all carry `ffiConducted/ciConducted/dials` form state.
- **§5 (half): ProductionTable already implements the §5 dense-table contract** (sticky header + sticky rank/agent columns + live footer count — ProductionTable.jsx:27–116). Remaining: kiosk `RankedLeaderboardPanel` has no sticky/footer — judgment needed whether the kiosk TV rotation surface wants it (banked to DECISIONS-NEEDED if unclear).
- **Campaigns gate math: ALREADY SHIPPED.** `PERSISTENCY_GATE_BANDS` (≥90/85–89/80–84/<80 with payout multipliers) + `gateBandFor` + standings integration live in `src/utils/campaignEngine.js:21–143`; CampaignPanel reads persistency read-light for gate DISPLAY (:163) with `persistencyGateEnabled` toggle. Tier editor (Bronze/Silver/Gold API+apps minimums) in CampaignPanel:705+. Remaining: Company Config **Recognition registry rows** for the band values (SOON/read-only) — `companyConfigRegistry.js` has no gate-band rows yet.
- **§1 partial: TenantAdminDashboard + CampaignPanel main loads already surfaced** (per-fetch error state + Retry + partial-failure banner, TenantAdminDashboard.jsx:155–215; CampaignPanel load/save/delete set error state per its §1 comment :861+). The brief's "3 fetches console.error-only" claim is stale. Full 102-site `.catch(() =>` disposition in flight (Opus).
- **S4 ScopeSwitch: STILL-VALID (real work).** No ScopeSwitch component anywhere in src/; CompliancePanel derives an implicit role-based scopeLabel only. Design source: `docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/mockups/manager-v2-shared.jsx:278` + compliance-v2-shared.jsx:55 mounting.
- **S5 admin exception-lead: STILL-VALID (real work).** ExceptionLeadPanel exists (`src/components/dashboard/ExceptionLeadPanel.jsx`), consumed by ManagerOverviewTab only; TenantAdminDashboard has no mount.

## Swallow-disposition table (§1a — every site, kept or surfaced, with reasoning)

Full enumeration at `6ec0f743` (Opus pass): 99 non-test `.catch(() => …)` sites + ~60 named-arg catch sites + 170 console.error/warn sites scanned. Counts: **SURFACE 5 · KEEP-SEMANTIC ~78 · ALREADY-SURFACED ~52 · BANKED-UNSURE 5 · N/A-TEST (class)**. The codebase was heavily pre-swept by prior runs — the verified standing contract is: *primary read throws to an outer catch that sets `error`; secondary name/avatar/plan/config enrichment self-catches to `[]`/`{}`/`null`*.

### SURFACED this run (fixes shipped)

| Site | Disposition | Reasoning / fix |
|---|---|---|
| `useBranchOverview.js:51` `getAllYTDSubmissions().catch(()=>[])` | **SURFACE** | Primary team dataset; per-arm catch made ManagerOverviewTab's BUILT error card (:56–73) unreachable — silent zero-team hero on failure. Fix: drop the per-arm catch; outer catch (:62) sets `error`. |
| `useBranchOverview.js:52` `getTenantUsers().catch(()=>[])` | **SURFACE** | Primary roster; same dead-error-card mechanism (silently zeroes compliance %, scope counts, exceptions). Same fix. |
| `useMyProduction.js:38` `getAgentSubmissions().catch(()=>[])` | **SURFACE** | Primary "My Production" dataset; outer catch set no state. Fix: `loadError` + retry, surfaced in ManagerDashboard via the existing policiesError card idiom. |
| `ManagerDashboard.jsx:408` handleStartMeeting catch→console.error | **SURFACE-LOW** | User action silently no-ops. Fix: failure toast. |
| `ManagerDashboard.jsx:425` handleExportBranchCSV catch→console.error | **SURFACE-LOW** | Silent export failure. Fix: failure toast. |

### KEPT (representative classes — every class verified against surrounding state machinery)

| Class (sites) | Disposition | Reasoning |
|---|---|---|
| `getYearPlan/getMonthlyPlan/getWeeklyPlan/getDraft/getGoals …catch(()=>null)` (GamePlanV2:127,130 · AgentDashboard:239,244,308 · useMyProduction:39 · CareerPortal:628 · GoalsPanel:864 · AgentDrillDrawer:179,181 · goalsService:328 · CompliancePanel:200) | KEEP-SEMANTIC | Absent doc = "not committed / not set" — the operator-locked absent-means-X design. |
| Config fallbacks (`getCompanyMinimums/getMergedAwardsRuleset →DEFAULT/FALLBACK`: AgentDashboard:247,248 · useMyProduction:42,43 · ManagerAwardsPanel:180 · MoneyNeedsAllocator:657 · GoalsPanel:852 · useBranchOverview:47,48,54 · CareerPortal:629 · goalsService:325–332 · ConfigProvider:50) | KEEP-SEMANTIC | Offline-tolerant reads of tunable config with documented fallback constants. |
| Secondary enrichment (`name/branch/avatar/prospect/campaign maps →[]/{}`: MasterSheet:136 · ManagerDashboard:394,417 · MeetingMode:699,703,704 · CompliancePanel:232 · planners · DeliveryRegisterPanel:83 · KioskShell:79,80,83 · Leaderboard:106,123 · WAR tabs badges/dots · AgentProductionView:104 · FinancingSelfView:338) | KEEP-SEMANTIC | Each surface's PRIMARY read throws to a real error state; enrichment degrades to labels/blanks by design. |
| History/settlements/daily side-arms (AgentDashboard:245,246,309,461,467,476 · AgentDrillDrawer:178,180 · useMyProduction:40,41) | KEEP-SEMANTIC | Secondary arms beside a surfaced primary (`submissionsError`). |
| Fire-and-forget mutations (usePinnedNav:75 · useNavOrder:90 · useMenuLayout:67 · useAppSettings:84 · PlanSuggestionsCard:64 · ReloadPrompt:47,52) | KEEP-SEMANTIC | Optimistic UI-pref/telemetry writes; no user-facing failure semantic. |
| UI-pref/flag mirror reads (useAppSettings:72 · useMenuLayout:58 · useNavOrder:72 · usePinnedNav:67 · useFeatureFlag:43) | KEEP-SEMANTIC | Absent = documented default (flag off/seed order); never blocks render. |
| Auth/PWA internals (AuthContext:116 · signOut catches · EmailVerificationHandler:87 / ResetPasswordHandler:112 → setPhase('invalid')) | KEEP-SEMANTIC / IS-THE-SURFACE | Handler catches set the user-visible invalid phase. |
| KioskShell:69 poll swallow | KEEP-SEMANTIC | Documented unattended-wall rule: stale data > error card on a lobby TV (last-good retained). Initial-load variant banked below. |
| MeetingMode:698 `getTenantUsers .catch(()=>{throw})` | KEEP (exemplary) | Deliberate promotion to the outer error card — names are essential in-room. |
| ~52 named-arg catches setting `setError/setLoadError/toast` (production views · GoalsPanel ×5 · financing panels · awards panels · modals) | ALREADY-SURFACED | Verified error-state machinery; production views carry per-source partial banners (reference impl). |

### BANKED-UNSURE (kept per operator rule; rulings requested in DECISIONS-NEEDED)

| Site | Why unsure |
|---|---|
| `WizardForm.jsx:301` draft-load catch → starts wizard fresh silently | Transient failure could hide an in-progress draft → silent-overwrite risk. Highest-value ruling. |
| `WizardForm.jsx:342` opaque `.catch(()=>{})` | Post-submit refresh guard? Needs identification before ruling. |
| `KioskShell.jsx:69` INITIAL load (no last-good yet) | Denied first fetch blanks the wall with no signal — acceptable for unattended TV? |
| `JointCallsTab.jsx:343` prospect-info enrichment, no state (sibling :332 sets state) | Align with panel surface or leave silent-secondary? |
| `DailyCaptureV2.jsx:644` refreshWeekDocs → silent blank week chips | Acceptable degradation beside the surfaced main entry? |

## DECISIONS-NEEDED

1. **WizardForm.jsx:301 draft-load swallow** — on a transient draft-read failure the wizard silently starts fresh, risking silent overwrite of an in-progress draft. Ruling: keep "start fresh silently," or show "couldn't load your saved draft — Retry"? (Kept unchanged this run per the unsure→KEEP rule.)
2. **WizardForm.jsx:342 / JointCallsTab.jsx:343 / DailyCaptureV2.jsx:644 / KioskShell.jsx:69-initial** — four lower-stakes BANKED-UNSURE swallows (table above). All kept unchanged this run.
3. **S4 scope boundary:** CompliancePanel's CBTT License Compliance section stays UNscoped by the new ScopeSwitch (it derives from full `users`) — builder judgment: it's a regulatory tracker, not filing compliance. Confirm or extend the scope filter to it.
4. **§5 "RankedLeaderboard" target disambiguation** — the brief named RankedLeaderboard as lacking the dense-table contract; the app-side `productionReport/RankedLeaderboard.jsx` ALREADY has it (:46–94), and the kiosk `RankedLeaderboardPanel` is a fixed top-8 broadcast podium where sticky/footer is inapplicable. Orchestrator ruling applied: §5 verified-shipped, nothing built. Overturn if the intended target was a different surface.

## Operator rulings in force (from brief — do not re-litigate)

Surface FAILURE swallows / keep absent-means-X swallows · empty-state CTA only where honest action exists · admin exception-lead exemption OVERRULED (S5 builds it) · Campaigns gate display-only, no payout writes · revert-over-debug in the E1 reserve.

## Banked follow-ups (non-blocking)

- **Seed gap: second unit_manager fixture.** seed-staging.mjs provisions one UM per branch, so a multi-unit BM roster can never occur on staging and `t1-compliance-scope` SKIPs indefinitely (its full assertion path auto-activates when the fixture lands). Deliberately NOT seeded tonight — a new UM + agents would ripple through the value-level expectations of many of the 44 legs; needs its own run with expectation updates. The leg's full-exercise branch has never run live (RTL-only proof) — treat its first live activation as a shakedown.

- Test parity nit: `handleExportBranchCSV` failure toast has no test (its twin `handleStartMeeting` does — model on ManagerDashboardMeetingFocus.test.jsx's hoisted toast spy). ~5 min.
- Live error→Retry forced-failure smoke: not run this cycle (forcing a terminal Firestore failure through real SDK backoff via route-abort is flake-prone); error grammar proven at RTL level (75/75). Candidate: a dedicated leg using an invalid-tenant context if ever needed.

## Morning handoff

**The run's headline is Phase 0:** the declared build map was ~76% stale. `docs/audits/design-conformance-2026-07-12.md` (validity SHA `e65fe143`, +1 orchestrator Rule-17 correction) is now the active build map; CONTEXT.md updated. Most of tonight's briefed build items turned out ALREADY SHIPPED by Runs 1–5 and were verify-closed with citations instead of rebuilt (§4 focus-trap 7/7, S1, S2, S3, §5 ProductionTable+RankedLeaderboard, campaigns gate math + tier ladder).

**Shipped (staging only, in order):**
| SHA | What |
|---|---|
| `6ec0f743` | Run docs (0.1) |
| `f018931a` | Campaigns: 4 gate-band registry rows (Recognition, SOON/read-only) + parity tests — the only remaining campaigns slice; HARD STOP respected (zero payout write paths) |
| `07a24ffa` | S5: tenant-wide ExceptionLeadPanel on TenantAdminDashboard (4th data source joins the partial-banner contract; AgentDrillDrawer drill; NO rules change) |
| `3c4f9c5c` | §1(a): 5 SURFACE fixes — dead error card reconnected (useBranchOverview), useMyProduction loadError + card, 2 action-failure toasts |
| `b8bd247a` | docs mid-run |
| `e65fe143` | VH legs: t1-admin-exception-lead + t1-company-config-gate (PASS live) |
| `f93d5535` + `23e6c67e` | Phase 0: new build map + CONTEXT.md + Rule-17 correction |
| `d4e5220d` | §1(b): Retry on the 3 audit-found holdouts (Leaderboard onSnapshot retryKey idiom, ManagerAwardsPanel, PersistencyTab) |
| `3d42125f` | S4: CompliancePanel ScopeSwitch (BM multi-unit; scopedRoster threads counts/reality-bar/exceptions/nudge-all) |
| `b03242c9` | VH leg t1-compliance-scope (SKIPs pending seed gap — see banked FUs) |
| `72daabf8` | §2: HomeV2 staggered assemble + podium per-card stagger + tail bar-grow (reduced-motion safe) |
| `9beb2aa7` | Awards §1 finish (skeleton + honest descriptive empty, no fabricated CTA) + Settlements §5 on BOTH tables |

**Banked / needs ruling:** DECISIONS-NEEDED 1–4 (WizardForm draft-load swallow is the highest-value ruling) · seed gap for t1-compliance-scope full path · CSV-export toast test parity · §2 motion visual review with human eyes (RTL+bundle-verified only) · new build map's Tier 1–4 backlog (Policy Reconciliation 8-flag taxonomy is the one big manager gap left).

**Dropped:** nothing — every briefed item either shipped or was verified already-shipped.

**Gates at close:** lint clean · full unit suite **5325/5325** (Run 5 baseline 5252; +73 new) · build clean · **E1: 44 legs = 43 PASS / 0 FAIL / 1 SKIP (expected, documented)** — every pre-existing leg green, zero reverts.

**E3:** HOLD — no merges to main, zero prod contact all run (hygiene tripwires green on every leg).
