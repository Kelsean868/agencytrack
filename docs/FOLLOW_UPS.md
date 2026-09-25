# AgencyTrack — Follow-Up Items

> **2026-07-11 audit note:** This file was audited end-to-end against `main`
> HEAD (commit `942ab252`) to remove drift — entries describing work that had
> already shipped were verified via grep/git log and moved to
> [`docs/FOLLOW_UPS-archive.md`](FOLLOW_UPS-archive.md) rather than left here
> stale. Every entry below is either confirmed still-open, or could not be
> confidently verified either way (marked *"verification uncertain — needs
> owner check"* inline). Nothing was deleted, reworded, or re-scoped — only
> resolved/superseded entries were moved out. See the audit PR for the full
> resolved/superseded list with evidence.
>
> **Size caps (per CLAUDE.md Rule 16):** if this file's `Recently shipped`-style
> sections start ballooning again, move old resolved rows to the archive in
> the same fill commit that adds new ones — don't let drift re-accumulate.

## Open-items index (sorted: dated deadlines → HIGH → MEDIUM → LOW → unlisted)

| Item | Severity | Track/Area | Deadline | Line |
|---|---|---|---|---|
| **PR #936 preview smoke WAIVED (Rule 13)** — `*.vercel.app` is TLS-intercepted by a FortiGate on the operator's machine, so `VERCEL_BYPASS_TOKEN` cannot reach a preview host without disabling certificate verification; refused as a workaround, not attempted. Low-risk for #936 specifically — `dist/assets` grep confirms the whole module is tree-shaken out of the bundle, zero bytes reach a browser — but the interception is a standing blocker for every future preview smoke, and if longstanding, the token has already crossed it repeatedly and may want rotating. Re-run instructions + falsification in the body (banked 2026-09-03, post-merge fill) | HIGH | Verification / env | — | see § PR #936 preview smoke — waived |
| ~~**RESOLVED 2026-08-27 (PR #924).**~~ Deploy done AND smoke run: **12 PASS / 0 FAIL** against staging, including `concurrent-idempotent-live` — two simultaneous deliveries of one `sourceId` moved `dials` once. Firestore, not a transaction fake, has now adjudicated the idempotency guard. Deployed to BOTH projects (prod `updateTime` 12:29:06.928Z, staging 02:25:27.031Z), both ACTIVE, prod re-probed 401-on-bad-token after the change. **The smoke was blocked until `TENANT_ID` stopped being hardcoded** — the sibling MEDIUM below rated that "a second tenant would 401", but the real consequence was that the endpoint could only be exercised in PRODUCTION, making a staging-only smoke impossible by construction. Kept (struck, not deleted) because that mis-rating is the lesson. Slice C now has something to POST to. Original deploy-withholding rationale retained in the section body because it is the standing rule for the next slice of this shape: **CC deliberately did not self-deploy:** the PR is not purely additive (it also changes `dailyToWeekly.js`, whose existing cron caller exercises the new behaviour), which is exactly what the pre-merge additive carve-out excludes; `firebase use` reports the active project as PRODUCTION `agencytrack-2a610`. **The staging smoke is separately owed and is staging-only** — it mints a real token and moves a real agent's daily numbers (banked 2026-08-26, slice B / PR #923) | HIGH | Linked call sources | — | see § ~~`ingestCallActivity` deploy + staging smoke~~ RESOLVED |
| The #899 flake fix (`src/test-utils/flushPendingEffects.js`) is on `staging` ONLY — `git ls-tree origin/main` returns EMPTY, so `main`'s unit-test gate still produces false reds. Every command-file / dispatcher-tooling PR is structurally forced onto `main`, and **#906 proved the cost on a one-markdown-file diff** (red on `DailyCaptureV2` streak test, 5000ms timeout, 1 failed / 5842 passed; re-run green). **Fix is staging→main PROMOTION — do NOT cherry-pick** (duplicate commit, conflicts at promotion across the fix + 30 `await` call sites). Compounds with the promotion-deletes-staging FU below: that one makes promotion risky, this one makes deferring it costly (banked 2026-08-16, PR #906 session) | HIGH | CI / process | — | 6013 |
| Promotion deletes `staging`, silently auto-retargeting every open PR onto `main` — put #872 + #873 into main ungated. **CONFIRMED RECURRING** — deleted again on #877 (#860/#874/#877). **Primary fix upgraded to a runbook step (`git push origin main:staging` after every promotion merge)**; CI guard still recommended as enforcement. **Also corrects the record: `main` DOES have branch protection** (2 required checks, admin-bypassable) — the FU's original "unavailable" premise was wrong, and CLAUDE.md § Workflow carried the same false claim. **That half is now CLOSED** — the CLAUDE.md claim was corrected in the promotion-prep governance PR (2026-08-16); the `staging`-deletion half remains open and still needs a dispatcher decision (banked 2026-07-26, PR #871 session; corrected 2026-07-27) | HIGH | — | — | 430 |
| `enforce_admins: false` on `main` — every direct push bypasses both required status checks, so `main`'s CI gate is advisory for the only person who pushes there. Observed, not inferred: a brief-landing push returned `remote: Bypassed rule violations for refs/heads/main: 2 of 2 required status checks are expected.` **Dispatcher decision required — do NOT change the setting.** Turning it on costs ~5 min of CI per dispatch (brief landings, CONTEXT fills, command-file changes all become PR-gated); leaving it off means the checks are decorative on the direct-push path (banked 2026-08-16, promotion-prep governance PR) | HIGH | Repo governance / CI | — | 5975 |
| The flake family is ~10 named members and #899 fixed **TWO** (`MeetingMode`, `AgentPlannerPanel`) — the rest were deliberately left unruled. `staging` is better by two files, **not fixed**; corrects the framing in `main`'s § *The #899 flake fix lives on `staging` ONLY*, which arrives at the next promotion. Evidence: #907 is cut from `staging`, docs-only, and still went red on `BranchesPanel` (roster member 7). The promotion acceptance check proves the fix ARRIVED, not that the gate is clean (banked 2026-08-16, PR #907) | HIGH | CI / process | — | 6013 |
| Firestore cache crash `INTERNAL ASSERTION FAILED (ID: b815)` from `src/firebase.js`'s `persistentMultipleTabManager`. Out of scope for the hero-ledger brief by its own terms; banked here on its instruction. Severity is a placeholder until someone reproduces it (banked 2026-09-23, hero-ledger H1) | MEDIUM | Firestore / offline cache | — | see § Firestore cache crash b815 |
| Live Storage rules DENY ALL, but the app uploads profile photos to Storage from the browser (`userService.js` → `avatars/{tenantId}/{uid}.jpg`) — so photo upload is likely broken in production today. SEC-12 copied the rules verbatim and did NOT change behaviour (banked 2026-09-25, security S1) | MEDIUM | Security / Storage | — | see § Storage rules deny avatar uploads |
| `revokeKioskToken` checks tenant only — any branch_manager can revoke another branch's kiosk (old A4:SEC-003). S1 fixed create + client writes (SEC-03), not revoke (banked 2026-09-25, security S1) | MEDIUM | Security / Kiosk | — | see § Kiosk token revoke and read scope |
| ~~**RESOLVED 2026-09-23 (PR #970, hero-ledger H3).**~~ `AwardCard`'s state pill now reads IN PROGRESS for 0 < progress < contention, keeping NOT STARTED for exactly 0 — fixes the "NOT STARTED · 17%" (MDRT) / "NOT STARTED · 7%" (Q3 apps) contradiction. `HeroAwardCard` and `AwardDrillDrawer` were checked for the same fall-through and carry no literal "NOT STARTED" text (banked 2026-09-23, hero-ledger H2 / PR #969) | LOW | Awards UI copy | — | see § Award card NOT STARTED above 0% |
| **PARTLY RESOLVED 2026-08-27 (PR #924) — and the original MEDIUM rating was WRONG, which is the part worth keeping.** `ingestCallActivity` no longer hardcodes the tenant: it reads `process.env.AGENCYTRACK_TENANT_ID` and falls back to `'tatillife_south'`, a default chosen to be byte-identical so production cannot drift (verified post-deploy: `functions/` holds no `.env.agencytrack-2a610`). `functions/.env.agencytrack-staging` supplies `staging_test` and is TRACKED via a `.gitignore` negation placed AFTER the `.env.*` rule — last match wins, and the same line placed earlier is inert, which is a mistake that was actually made and caught. **Why the rating was wrong:** this was filed as "a second tenant's tokens would 401 — failing closed, but silently", which reads as a multi-tenancy nicety. The real consequence was that a staging-minted token resolved against a tenant absent from the staging project, so **the endpoint could not be exercised anywhere except PRODUCTION** — making slice B's own named deliverable, a staging-only smoke, impossible by construction. A constant that makes a feature untestable outside production is not a deferred nicety, and "fails closed silently" hid that. **STILL OPEN:** `functions/index.js:62` and `aggregators/sundayDailyToWeekly.js:30` remain hardcoded — deliberately untouched, since they are scheduled functions that simply find no data under the production tenant in staging and do nothing (banked 2026-08-26, slice B / PR #923; part-closed 2026-08-27, PR #924) | MEDIUM | SEC-9c / multi-tenancy | — | see § `ingestCallActivity` resolves tokens against a HARDCODED tenant |
| The `referralsObtained` half of the PR #909 omit-when-zero guard is still open — slice B retired ONLY the `serviceCalls` half, because B gives that field a daily writer and does not write `referralsObtained` (KQM referral outcomes map to `newNamesAdded`). **Corrects the sequencing recorded in CONTEXT.md**, which put the whole retirement after slice C: the trigger is a daily writer, not a slice letter. Retires in BOTH aggregator twins when one appears (banked 2026-08-26, slice B / PR #923) | MEDIUM | Daily Capture / aggregator | — | see § The `referralsObtained` half |
| Company Config has no generic plain-value surface — `mode: 'plain'` is hardcoded to manager activity standards at every layer (`baseValue` ignores `storage.docId`; `saveAll` passes a literal docId; only `type: 'standards'` renders editable; `HYDRATED_DOC_IDS` is a fixed array). A boolean or scalar setting cannot be rendered or edited, and resolves to `{}` rather than its default. Persistency P5 hit this and was redirected by dispatcher amendment to store on the already-hydrated `companyMinimums` doc with NO registry entry and NO UI row — so its setting is runtime-real but changeable only by direct Firestore write (banked 2026-09-08, Persistency P5) | MEDIUM | Company Config / admin surface | — | see § Company Config has no generic plain-value surface |
| ~~**"On pace" has no derivation"**~~ **RULED 2026-09-09 by the operator** - the branch scene gets TWO counts, not one: (A) above the tenure Company Floor and (B) on the agent's own Game Plan target, both always year-to-date and both pro-rated from the later of 1 January and `contractStartDate`. Agents with no `yearPlan` leave B's numerator AND denominator, with the excluded count stated on the surface. Full rule in `docs/briefs/track-j-report-scopes-kickoff.md` section 3.1; R2 is unblocked. Kept, struck rather than deleted, because the reasoning for declining to invent the threshold is the standing pattern (banked 2026-09-09, ruled same day) | - | Track J / report scopes | - | see � "On pace" has no derivation |
| **Agent-selectable pace benchmark** - the operator also wants an agent to pin a third yardstick of her own (MDRT/COT/TOT, an award, a campaign) beside the Company Floor and her Game Plan target. **Cut from R2 on 2026-09-09 and needs its own brief:** it is per-agent stored state (user-doc field + `firestore.rules` guard, so manual-deploy, not Vercel-rebuild), it needs one enumerated source of truth across three separate config areas, and a branch-level count cannot aggregate targets each agent chose for herself - it belongs on the AGENT surface. Four open questions in the body (banked 2026-09-09, Track J R2 ruling) | MEDIUM | Track J / agent surface | - | see � Agent-selectable pace benchmark |
| Restore the VIOLET calls hue — `plannerTone.js`'s stated reason for diverging ("repo ships no violet token") is FALSE; token ships at exact DS parity with zero consumers (banked 2026-07-27, planner activity-types PR) | MEDIUM | Track J conformance | — | see § Planner activity types |
| ~~**RESOLVED 2026-09-25 (security S1).**~~ Own-worksheet ALLOW cases added for `unit_manager` and `branch_manager` in `tests/rules/moneyNeeds.rules.test.mjs`, mutation-checked (dropping `isProducingManager()` fails the UM case). Was: No rules test asserts the ALLOW for a `unit_manager` creating their OWN `moneyNeeds` worksheet (`firestore.rules:1948`, `isProducingManager()` arm). PR #972 retargeted the old "UM create at agent path → DENY" case, which had been pointed at the UM's own uid, onto a real agent path; the DENY stays covered, the own-doc ALLOW now has no test. Add it in security S1 (banked 2026-09-25, PR #972 review) | LOW | Rules tests | — | see § UM own-worksheet ALLOW untested |
| `outcomeMap.WRITABLE_FIELDS` is a TEST-ONLY drift guard, not the runtime write allow-list its slice-B comment claimed — `ingestCallActivity.js` never imported it. The comment is corrected in C2; wiring it into the transaction as a real assertion (every emitted increment key must be in the list, else throw) was left out because it is a behaviour change outside C2's scope (banked 2026-08-27, slice C2 / PR #926) | LOW | Linked call sources | — | see § `WRITABLE_FIELDS` is a drift guard, not an allow-list |
| Planner duration reporting — `durationMin` is captured on every appointment but NOTHING sums it anywhere; "time recorded" needs only a reporting surface (banked 2026-07-27) | LOW | Planner | — | see § Planner activity types |
| Planner type-taxonomy collisions deferred by hardcoding — `MTG` vs manager `UNIT`, and `PERS` vs `FREE`+Personal (banked 2026-07-27) | LOW | Planner | — | see § Planner activity types |
| `SALE` absent from the design authority's agent picker but shipping in the app — pre-existing divergence, NOT introduced by the activity-types work (banked 2026-07-27) | LOW | Planner | — | see § Planner activity types |
| SEM/TRADE count for the manager headline but NOT the agent's kept-count — same kept seminar reads differently to the two roles; settle when types become tenant-configurable (reviewer pass on #878, banked 2026-07-27) | LOW | Planner | — | see § Planner activity types |
| `assertLegHygiene` never asserts on `networkFailures` — a failed network call is printed but cannot fail any smoke, suite-wide; "hygiene PASS" is not evidence calls succeeded (found diagnosing the first post-deploy planner run, banked 2026-07-27) | MEDIUM | Verification | — | see § Planner activity types |
| Mutating planner smokes leave residue by design — no self-teardown; needs a shared Admin-SDK helper across all 7 (raised by CodeRabbit on #878, banked 2026-07-27) | LOW | Verification | — | see § Planner activity types |
| Two divergent planner design-authority trees (`proposals/planner-scheduler-v2/` vs `screens-v2/agencytrack-planner-handoff/`) — never diffed file-by-file (banked 2026-07-27) | LOW | Design system | — | see § Planner activity types |
| External code reviewer — Gemini sunset PASSED; secondary-reviewer decision NOW OPEN (PROMOTED to HIGH 2026-07-21 — settle before the next backend-touching track). **PATTERN CONFIRMED 2026-07-31: rate-limited on #882, #883 AND #884 (3 of 5 HEADs, incl. the merged one)** | HIGH | — | overdue (was 2026-07-17) | see § External code reviewer |
| **⚑ THE FLAKE IS A RACE, NOT CONTENTION — corrected characterisation.** Measured: p50 130ms / max 703ms vs failures at the 5000ms timeout; run wall-clock normal while one test hangs. The `5006…5027` cluster means only that the timeout FIRED — do not reason from it. #888 was three n=1 samples, not a controlled experiment. Superseded: `asyncUtilTimeout`, per-test widening, sharding, `maxForks` capping (#889 closed unmerged), `isolate:false` (banked 2026-08-02, v3 P0-E) | HIGH | test-infra | — | see § THE FLAKE IS A RACE |
| **⚑ Flake register — 3 provenance corrections + a measured baseline.** `MeetingMode.test.jsx` fails **IN ISOLATION**, overturning both "passes in isolation" and "rotation ⇒ shared contention" (it rotates across 4 named members with nothing else running). **⚠ RATE CORRECTED 2026-08-11 — the 16.7% previously recorded here is superseded and must not be quoted.** Two windows: **5/30 (16.7%)** on `staging` `2ef1abc5`, **2/90 (2.2%)** on `fix/flake-awaiting-pattern`; pooled **7/120 = 5.8%, Wilson 95% ≈ 2.9–11.6%**. The two windows are **significantly inconsistent** (z ≈ 2.9, p ≈ 0.003), so the pooled figure summarises two disagreeing samples rather than estimating a stable rate — the discrepancy is **unexplained**. **The rate is NOT the acceptance test** — see § Flake race — MECHANISM PROVEN. `delay: null` is ZERO not one. #543 is an unmerged duplicate of merged #563. `CHIP_WAIT` RULED left alone — it is the control. Harness ported to `scripts/flake/` (banked 2026-08-02, rate corrected 2026-08-11) | HIGH | race brief | — | see § Flake register — three provenance corrections |
| Flip `a11y-contrast` from REPORTING to BLOCKING once the one enumerated pre-existing failure is cleared (`topbar-search-placeholder` 4.13:1 light — the Topbar failure the P0-D brief lists as out of scope). Drop `continue-on-error`, pass `--blocking`, rename the job in the same commit (banked 2026-08-02, v3 P0-D) | MEDIUM | v3 P0-D | — | see § Flip a11y-contrast |
| `a11y-contrast` sweep covers 2 routes (login + dashboard); `:disabled` measured 0 because the swept routes have only transient disabled states — the path is proven via the planted failure. Widen the route list (banked 2026-08-02, v3 P0-D) | LOW | v3 P0-D | — | see § a11y-contrast sweep covers two routes |
| `a11y-contrast` runs with only the auth + firestore emulators, so CF-gated UI (`resolveSalesManagerUid` is CORS-blocked) never renders into the swept DOM — element counts are a floor. Surfaced by the console/network capture added in the #893 review (banked 2026-08-02, v3 P0-D review) | LOW | v3 P0-D | — | see § a11y-contrast sweep runs without the functions emulator |
| `SyncIndicator` shows connectivity, not pending writes — `waitForPendingWrites` / `onSnapshotsInSync` are the candidate APIs; wire it with the first real `commit()` caller (P0-F), not before, because `onSnapshotsInSync` is listener-relative and there is no caller to attach to yet (banked 2026-08-02, v3 P0-C ruling 13b) | LOW | v3 P0-F | — | see § SyncIndicator shows connectivity |
| v3 boundary rule matches import PATHS not bindings — a re-export of a restricted v3 service would evade `no-restricted-imports`. **No such re-export exists today**; recorded so a future one is caught by review rather than by nothing (banked 2026-08-02, v3 P0-C) | LOW | v3 P0-C | — | see § boundary rule matches import PATHS |
| Race investigation — why does the awaited condition never arrive? Successor track to the above; **requires test-file access**, needs its own brief, NOT started (banked 2026-08-02, ruling 11c) | MEDIUM | test-infra | — | see § Race investigation |
| `pcBreakdown` filters the day's evidenced events twice (4 passes/day via `weekTotals`) — CodeRabbit's remedy DECLINED as it would re-shape a dispatcher-ruled interface; shape-preserving fix recorded (banked 2026-07-31, PR #884) | LOW | v3 P0-B | — | see § `activityLedger` two LOW residuals |
| `evidencedPct` uses `Math.round`, so a COLUMN of per-code percentages will not sum to 100 — harmless for today's single-figure design, scope check for Phase 2.1 (banked 2026-07-31, PR #884) | LOW | v3 Phase 2.1 | — | see § `activityLedger` two LOW residuals |
| Track K Phase 2 — narrative `branchPlans` (new collection, HUMAN-MERGE) + PPTX + manpower setter + per-branch `branchGoals` keying (banked 2026-07-21, #864 close) | HIGH | Track K | — | ~288 |
| Track K Phase 3 — classification quotas + real monthly quota model (banked 2026-07-21, #864 close) | MEDIUM | Track K | — | ~288 |
| Track K — seeded Net-vs-Gross integration assertion (unit-only today; needs seeded foil branch) (banked 2026-07-21, #864 close) | MEDIUM | Track K | — | ~288 |
| ~~BIG ONE — the real planner-completion track (E1–E5) is UNBUILT~~ — RESOLVED, Run A Tier 2 #866, promoted #874 `219cf324`, 2026-07-26 (E1-E5 verified live in `src/components/planner/` against source) | — | — | — | 511 |
| Register the six Run-9 standing smokes in SMOKES.md (banked 2026-07-17, promotion session, MEDIUM... | MEDIUM | — | — | 439 |
| Appointment template count cap is client-side only — hardening candidate (banked 2026-07-17, prom... | LOW | — | — | 461 |
| Panel keydown stale-closure exposure under rapid state churn (banked 2026-07-17, promotion sessio... | LOW | — | — | 469 |
| Run 9 operator rulings — recorded as settled (banked 2026-07-17, promotion session) | — | — | — | 447 |
| Process lesson — design authority is the repo file, not a stale in-chat snippet (banked 2026-07-1... | — | — | — | 493 |
| HARD DEADLINE — Node 20 gen-1 Cloud Functions runtime decommission 2026-10-30 (banked 2026-07-09,... | HIGH | — | 2026-10-30 | 556 |
| Functions runtime + SDK upgrade — Node.js 20 EOL + `firebase-functions` 4.x → 5.x (MEDIUM with ha... | MEDIUM | — | 2026-10-30 | 2331 |
| Company Config v2 — next major track: every business-policy constant tenant-configurable (banked ... | HIGH | — | — | 413 |
| Design-conformance backlog — 14 NEEDS-RULING operator decisions block sequencing (banked 2026-07-... | HIGH | — | — | 620 |
| Prod-verification tooling must hard-pin `portal.agencytrack.app` — reject `*.vercel.app` aliases ... | HIGH | — | — | 282 |
| Investigate stray `agencytrack.vercel.app` deployment (banked 2026-07-15, Runs 5-7 promotion sess... | MEDIUM | — | — | 290 |
| R-11 login-stamp + All Users LAST-activity — REQUIRES firestore.rules edit (hasOnly allowlist or manager-readable location); bundle with the E4 index FU as a "rules + indexes attended window" | HIGH | — | — | 4282 |
| Master Sheet STATUS — a failed/denied persistency read is indistinguishable from "no data on file"; the abstention copy tells managers to enter data that may already exist (banked 2026-07-27, reviewer pass on PR #871) | MEDIUM | — | — | ~530 |
| Persistency threshold sites left un-consolidated — 3 deliberate exclusions PLUS 6 still-hand-rolled 0.80/0.90/90 literals that the "one home" sweep missed (correct scale, no live defect) (banked 2026-07-26, extended 2026-07-27, PR #871) | LOW | — | — | 495 |
| Money smoke — A3 is VACUOUS (passes on the broken build too; the fixture agents can never carry a persistency flag) and A2 is an unscoped `.some()`. Needs a fixture agent, not just an assertion fix (banked 2026-07-27, reviewer pass on PR #871, found by executing the negative control) | MEDIUM | — | — | ~560 |
| Tier 3c mechanical conformance — carried from Run A (hero-card worklist · motion pop-in wiring · handoff-vs-screens-v2 · gold-contrast usages) | LOW | — | — | 4348 |
| Master Sheet STATUS filter chips — scoped NOT built (3 new reads + 6-band taxonomy); LEVEL stays blocked (banked Run A Tier 3b) | MEDIUM | — | — | 4329 |
| Tier 3c mechanical conformance — carried from Run A (hero-card worklist · motion pop-in wiring · ~~handoff-vs-screens-v2 RESOLVED 2026-07-25~~ · gold-contrast usages) | LOW | — | — | 4402 |
| ⚠ **PRE-MERGE ON #871** — Persistency threshold: three surfaces, three literals; reconcile to one canonical constant before #871 merges (money-adjacent) | MEDIUM | — | — | 4460 |
| Manager report on-screen views — v2 port never happened (rows 24–27 PARTIAL); **Wave-3 M-item**, REDESIGN-class, diff-lock at Phase 0 | MEDIUM | Track J | — | 4415 |
| Design-conformance 2026-07-25 — F1 MasterSheet error card has no Retry (**Wave 2 candidate**) · F2 Sidebar inline style · F3 bare transition-all ×3 · F4 RunningLateSheet target ratio | MEDIUM | Track J | — | 4493 |
| Rule 21 DETERMINISTIC-SKIP class — path_filters stays untouched; docs-only reviewer skips satisfied by dispatcher full-diff review. **Check Greptile .md coverage at onboarding** | LOW | — | — | 4535 |
| CONTEXT.md `Current main HEAD` drift (`d0e74c12` recorded vs `60dbf1c2` actual; #864 took no Rule 16 fill) — **post-promotion fill item** | LOW | — | — | 4568 |
| Commission layout — unverified two-column claim; needs a REAL mockup into screens-v2 first (banked Run A Tier 3b) | LOW | — | — | 4312 |
| E4 cross-time prospect notes history — `(agentId, prospectId)` composite index + deploy (rules-permitted per D3); this-week scope shipped Run A Tier 2 E4 | MEDIUM | — | — | 4246 |
| `featureFlags` allowlist is a deliberate triple-copy — consolidate when flags become config-drive... | LOW | — | — | 298 |
| Desktop planner board — shift-click range select keys off mobile view state (banked 2026-07-24, Run A Tier 2 E1) | LOW | — | — | 4220 |
| Desktop planner board — Arrow ←/→ view-cycling inert on the board (banked 2026-07-24, Run A Tier 2 E1) | LOW | — | — | 4232 |
| Staging smoke run-isolation — per-run unique IDs + finally-cleanup (banked 2026-07-24, Run A Tier 2, CodeRabbit #866) | LOW | — | — | 4263 |
| Run-7 ranked next-list — PARTIALLY CLOSED by Run 8 (campaign export, Team Dashboard #6, All Users... | — | — | — | 314 |
| Run-7 DECISIONS-NEEDED — none banked this run (informational, 2026-07-15) | — | — | — | 329 |
| Design-conformance 2026-07-13 revalidation — 11 NEEDS-RULING items ruled by operator; backlog upd... | HIGH | — | — | 337 |
| Run 8 banked follow-ups — carried forward, not yet dispatched (banked 2026-07-16, from `docs/fabl... | — | — | — | 351 |
| ~~**SUPERSEDED (Persistency 24-Month Model brief, Slices P1/P2).**~~ Persistency v2 (NEW calc methodology, R-07) — Tatil ratified a DIFFERENT formula (the memo's aggregate 24-month model, not this entry's rolling time-weighted debit proposal). Phase 1 (aggregate formula) DONE by P1 (#937/#938); phase 2 (manager surface, the `persistency-v2-*.jsx` mockups) superseded — not to be ported, they draw the rejected arithmetic; phase 3 (calc-model switch) closed, will not build (P-D3 — the model is chosen by month, not a tenant switch) | HIGH | — | — | see § Persistency v2 |
| The per-policy 24-month lapse-inclusion-window engine (Persistency 24-Month Model brief, Slice P3) is DESIGN-ONLY — gated on Tatil's promised process document. The policy ledger has no `paidToDate` or premium count today; an open question for Tatil is recorded verbatim in the body | MEDIUM | Persistency | — | see § Persistency — the per-policy 24-month lapse window |
| CI-vs-local test-timing gap — Tier-0 error-state tests can pass locally 5x, fail in CI (banked 20... | MEDIUM | — | — | 384 |
| Flake family scope — **PR #872's fix set is provably INCOMPLETE**; ≥3 further members named (MeetingMode ArrowRight, BranchesPanel Retry, the A2 `e` SERIES sibling) + 1 unnamed. DO NOT widen #872 — audit continues after it lands (banked 2026-07-26, PR #875 session) | MEDIUM | — | — | 384 |
| Flake family — `AgentPlannerPanel.weeknav.test.jsx` carries `flushPendingEffects` 0x where its #899-remediated sibling carries it 4x; fix was applied per-FILE not per-COMPONENT (banked 2026-08-26, PR #909) | MEDIUM | — | — | end |
| Node 20 → Node 24 — CI deprecation now firing directly (checkout@v4/setup-node@v4), not only in f... | HIGH | — | 2026-10-30 | 397 |
| Reconcile `design_handoff_v2_app/mockups/` (Downloads, Track J bundle) against `docs/design-syste... | MEDIUM | Track J | — | 405 |
| Functions runtime + firebase-functions SDK upgrade — Node 20 EOL + SDK 4.9.0 → ≥5.1.0 (banked 202... | HIGH | — | — | 1191 |
| Onboarding tenure — manager confirmation surface (banked PR #649, 2026-06-15, HIGH — near-term) | HIGH | — | — | 1459 |
| tatillife_smoke tenant — post-prod-run live verification (banked PR #674 `3730035`, HIGH until run) *(verification uncertain)* | HIGH | — | — | 1631 |
| H3 FLIP-GATE — `usesPolicyLedger:true` requires end-to-end parity validation before any agent is ... | HIGH | — | — | 2787 |
| MDRT naming collision — three different "MDRT" numbers, one label (banked 2026-07-10, promotion s... | MEDIUM | — | — | 423 |
| Master Sheet LEVEL filter — blocked on a populated career-level field (banked 2026-07-10, Run 4 I... | MEDIUM | — | — | 447 |
| Planner recurrence — `ENDS=Never` rolling-horizon materializer (banked 2026-07-10, Run 4 Item 5, ... | MEDIUM | — | — | 471 |
| Run 4 pre-promotion manual checks not done this cycle — carry to next Phase 0 (banked 2026-07-10,... | MEDIUM | — | — | 487 |
| 1-on-1 takeover — needs a real design pass (banked 2026-07-10, Run 4 Item 6 recon, MEDIUM — desig... | MEDIUM | — | — | 500 |
| Seeder env-file foot-gun — `seed-fixtures.mjs` silently resets staging/sales_manager passwords wi... | MEDIUM | — | — | 532 |
| Rebase `chore/tier0-smoke` onto main before it goes any staler (banked 2026-07-09, promotion sess... | MEDIUM | — | — | 564 |
| Run-3 candidate worklist — hero-card conformance gaps (banked 2026-07-09, PR #848 recon, MEDIUM —... | MEDIUM | — | — | 580 |
| React Query — DON'T-ADOPT (now); re-evaluate only on a real caching trigger (banked 2026-07-07, P... | MEDIUM | — | — | 598 |
| Motion pop-in rollout — skeleton kit built, not yet wired to any live panel (banked 2026-07-07, P... | MEDIUM | — | — | 610 |
| Data-architecture phase docs — net-new surfaces from #836 need dedicated design docs before dispa... | MEDIUM | — | — | 632 |
| Game Plan manager surface — Fork B: whole-plan suggest-back (banked 2026-07-03, PR #785 post-merg... | MEDIUM | — | — | 740 |
| EFF-002 Phase 2 — per-manager-tab code-splitting + Rollup `manualChunks` vendor/icon grouping (ba... | MEDIUM | — | — | 815 |
| `tatillife_south` null-unitId agent — data fix, live tenant (banked 2026-07-03, PR #785 Phase 0.4... | MEDIUM | — | — | 850 |
| Track K · K7 → server-side 24h-windowed cooldown enforcement in `notifyFinancingAdjustment` CF (b... | MEDIUM | Track K | — | 894 |
| Pre-pilot CodeRabbit codebase audit over money/legal/security surfaces (banked K7-cleanup, 2026-0... | MEDIUM | K7 | — | 945 |
| Track K · K6 → garnish incentive-payments component needs an incentives ledger source (banked K6,... | MEDIUM | Track K | — | 986 |
| Track K · K2 — RollForwardCheck reconciliation advisory (banked K2, 2026-06-25, MEDIUM — design c... | MEDIUM | Track K | — | 1034 |
| Money Needs merged allocator — general 6% premium-tax handling (banked merged-allocator PR, 2026-... | MEDIUM | — | — | 1060 |
| Nav redesign — producing-manager "MINE" surfaces have no own-producer route yet (banked PR-1 nav-... | MEDIUM | — | — | 1126 |
| MonthlyPlanModal — Gemini hardening pass (banked PR #671, 2026-06-17, LOW-MED) | MEDIUM | — | — | 1366 |
| GoalsPanel SelfTab unmount loses in-progress PolicyLedgerPanel entries (banked PR #653, 2026-06-1... | MEDIUM | — | — | 1426 |
| Onboarding identity — CF-based agentNumber uniqueness check (banked PR #646, 2026-06-15, MEDIUM) | MEDIUM | — | — | 1473 |
| Gamification — leaderboard reset-model decision (banked 2026-06-10, MEDIUM pre-scale) | MEDIUM | — | — | 1876 |
| Daily Capture anchor strip — RE-SCOPED 2026-07-25 into Half A (dials chip, SMALL) + Half B (per-agent manager-set targets, MEDIUM) | MEDIUM | — | — | 2237 |
| Daily Capture reporting-mode governance subsystem (MEDIUM, banked 2026-06-02 from Daily Capture v... | MEDIUM | — | — | 2178 |
| Social-channel inclusion in canonical aggregations — should `namesFromSocial` count toward app-wi... | MEDIUM | — | — | 2250 |
| Wizard v2 — Decision-A SUGGESTED-atom + goal-seeding (MEDIUM, banked 2026-06-01 from Wizard v2 PR... | MEDIUM | — | — | 2302 |
| SM access to ManagerAwardsPanel + BmAtRiskPanel — deliberate decision needed (MEDIUM, banked 2026... | MEDIUM | — | — | 2379 |
| Phase 9 — SM target: multi-territory branch-based resolution (MEDIUM, banked 2026-05-28) | MEDIUM | — | — | 2457 |
| Phase 9 — SM write-model inconsistency: SM can write unitGoals but not branchGoals (MEDIUM, banke... | MEDIUM | — | — | 2471 |
| Branch protection: require CI status checks before merge (MEDIUM, banked 2026-05-28) | MEDIUM | — | — | 2530 |
| Smoke script cleanup discipline — stray policies/notifications accumulate on test agent (MEDIUM, ... | MEDIUM | — | — | 2549 |
| Leaderboard ranking not filtered by `active` flag (MEDIUM, banked 2026-05-24) | MEDIUM | — | — | 2771 |
| Track J fast-follow — Tenant-Admin in-app editor for the tenure band table (MEDIUM, banked 2026-0... | MEDIUM | Track J | — | 2943 |
| Permanent test-data cleanup utility (MEDIUM, surfaced 2026-05-08 during C3) | MEDIUM | — | — | 3081 |
| Extract `CsvImportModalShell` (MEDIUM, surfaced 2026-05-08 during C3) | MEDIUM | — | — | 3111 |
| Kiosk team activity slideshow (MEDIUM, concept locked 2026-05-10) | MEDIUM | — | — | 3264 |
| SCOPE-1 — Tenant-wide persistency aggregate helper (MEDIUM, post-pilot) | MEDIUM | — | — | 3357 |
| SCOPE-2 — Tighten persistency `allow list` rule (MEDIUM, post-pilot) | MEDIUM | — | — | 3369 |
| TEST-N — Build Firebase rules-testing harness (MEDIUM, post-pilot) | MEDIUM | — | — | 3391 |
| Track J (V2 Redesign) — Game Plan v2 — remaining slices (MEDIUM, banked 2026-06-03, PR #438) | MEDIUM | Track J | — | 3726 |
| Track J (V2 Redesign) — Wire BranchManagerProductionView ranked table + standalone Leaderboard po... | MEDIUM | Track J | — | 3834 |
| Track J (V2 Redesign) — App-wide `text-gold` + adjacent contrast pass (MEDIUM/DESIGN, banked 2026... | MEDIUM | Track J | — | 3989 |
| Financing ruleset code comment overclaims configurability (banked 2026-07-10, promotion session, ... | LOW | — | — | 431 |
| Master Sheet — unit friendly names absent (banked 2026-07-10, Run 4 Item 2, LOW — display polish) | LOW | — | — | 455 |
| Company Config toggle — "count converted service calls as Tel Contacts" (banked 2026-07-10, Run 4... | LOW | — | — | 463 |
| Sunday aggregator zeroing agent-entered `serviceCalls` / `referralsObtained` — MITIGATED 2026-08-26 by resolution 2 (omit-when-zero); residual: a genuine correction-to-zero cannot propagate once a daily writer exists (banked 2026-08-26, daily-call-fields PR) | LOW | — | — | end |
| ⚠️ **Feature-branch Vercel previews are bound to PRODUCTION Firebase** — overturns the old "previews can't reach a live backend" claim (re-banked 2026-07-26, planner week-nav; remedy (a) = generalize the pre-write project guard, own small PR; remedy (b) = OPERATOR binds staging env to Vercel's Preview environment) | **HIGH** | — | — | 508 |
| Vitest on Windows — worker contention flakes under concurrent runs (banked 2026-07-10, Run 4, LOW... | LOW | — | — | 516 |
| Recon docs must carry a validity-SHA header — new standing rule (banked 2026-07-10, Run 4, LOW — ... | LOW | — | — | 524 |
| VH leg `t2-financing-k9-k7` flaky on first paint — no FAIL screenshot captured (banked 2026-07-09... | LOW | — | — | 540 |
| Stale prod IAM binding — expired conditional grant on `cloudbuild` service agent (banked 2026-07-... *(verification uncertain)* | LOW | — | — | 548 |
| Motion-verifier prod run — optional, needs `A11Y_<ROLE>_EMAIL`/`PASSWORD` env vars (banked 2026-0... | LOW | — | — | 572 |
| Post-redesign promotion review — no rules/functions changes accumulated during the reskin+conform... | LOW | — | — | 640 |
| EFF Phase-1 — two follow-ups banked from PR #802 bot review (2026-07-05, LOW) | LOW | — | — | 648 |
| QuickAddMenu (mobile ＋ bottom sheet) lacks a visible close affordance (LOW, a11y-parity) | LOW | — | — | 704 |
| Wizard draft-gate — two CodeRabbit nitpicks banked from PR #794 (LOW, deferred as out-of-scope) | LOW | — | — | 712 |
| PR-B3 housekeeping — stale pre-deploy comment in `smoke-plan-suggestions-b3.mjs` (banked 2026-07-... | LOW | — | — | 758 |
| PR #791 — `live-b3-post-deploy.mjs` hardening (banked 2026-07-04, LOW — Rule 21 out-of-scope carry) | LOW | — | — | 770 |
| PR-B3 fast-follow — notify-on-send ping for plan suggestions (banked 2026-07-04, LOW — K10b prece... | LOW | K10b | — | 838 |
| `onFinancingEscalationCreate` — filter inactive BM recipients + friendly reason labels (banked 20... | LOW | — | — | 864 |
| CI maintenance — workflows target deprecated Node 20 actions (banked 2026-07-03, LOW — CI hygiene) | LOW | — | — | 878 |
| Track K · K10a → roster does not surface the 24-month agreement-term clock for wind-down agents (... | LOW | Track K | — | 888 |
| Track K · K7 → `setFinancingConfig` merge-overwrite guard when a 2nd config field lands (banked K... | LOW | Track K | — | 904 |
| Track K · K7 → defensive `typeof`-string guard on the CF recipient read (banked K7, 2026-06-26, L... | LOW | Track K | — | 910 |
| Track K · K7 → reset `selectedAgent` on `tenantId` change in FinancingRiskPanel (banked K7, 2026-... | LOW | Track K | — | 916 |
| Track K · K7 → `mailErr?.message` optional chaining in CF mail catch (banked K7 post-merge, 2026-... | LOW | Track K | — | 922 |
| Track K · K7 → `monthLabel` client-supplied in CF notification body (banked K7 post-merge CR fina... | LOW | Track K | — | 928 |
| `verify-financing-notify-k7-live.mjs` hardening — config-mutation window + env read (banked K7-cl... | LOW | K7 | — | 934 |
| Escape unescaped table-cell pipes in CONTEXT docs (banked K6 fast-follow, 2026-06-26, LOW cosmetic) | LOW | K6 | — | 951 |
| Client-side `serviceMonths` integer validation in `reconcileFinancing()` (banked K6 fast-follow, ... | LOW | K6 | — | 959 |
| ~~**RESOLVED (Persistency 24-Month Model brief, Slice P2).**~~ CLAUDE.md persistency annotation — `0-100` annotation is stale (banked K4, 2026-06-25, LOW doc-fix). Corrected to `0–1 decimal fraction` with the `PERS_GATE`/`PERS_FLOOR` citation, in the same commit as the P2 vocabulary sweep | LOW | K4 | — | see § CLAUDE.md persistency annotation |
| Track K · K3 adapter — doc note correction: `isStaff` and `lapsedSurrenderedUnder2yrAPI` sourcing... | LOW | Track K | — | 975 |
| Track K · K3 — ruleset figures are 2026 placeholders pending confirmation (banked K3, 2026-06-25,... | LOW | Track K | — | 1016 |
| Track K · K4 — Q2+ adapter uses `dateSubmitted` bucketing; cross-quarter policies may be missed (... | LOW | Track K | — | 1022 |
| SettlementPanel — `loadData` weak overlapping-resolution race (banked FU-H1, 2026-06-25, LOW — no... | LOW | — | — | 1028 |
| Track K — lift agent-selection into FinancingTab (banked K2, 2026-06-25, LOW — UX) | LOW | Track K | — | 1042 |
| Track K · K5 — `getOwnPolicies` → shared `getPoliciesByAgent` rename (banked K5, 2026-06-25, LOW ... | LOW | Track K | — | 1048 |
| Track K · K3+K5 — `managerSettledAPI` precedence in financing/bonus Gross (banked K5, 2026-06-25,... | LOW | Track K | — | 1054 |
| Money Needs merged allocator — per-product avg-policy divisor (banked merged-allocator PR, 2026-0... | LOW | — | — | 1070 |
| yearPlanAllocation.js — orphaned 4-line allocation helper (banked PR-U2, 2026-06-25, LOW — dead-c... | LOW | — | — | 1078 |
| Review-coverage gap — PR #744 (U1) shipped on Gemini-only review (banked PR-U2, 2026-06-25, LOW —... | LOW | — | — | 1086 |
| GoalDecompositionTab — taxConnector label misleading when preTaxAlreadyApplied=true (banked PR #7... | LOW | — | — | 1092 |
| GoalDecompositionTab + MoneyNeedsPanel — shared localStorage key (banked PR #734, 2026-06-23, LOW) | LOW | — | — | 1102 |
| Nav redesign — PR-4 LOW follow-ups (banked PR #731, 2026-06-23) | LOW | — | — | 1118 |
| WeekConfirmView steppers — test the type-then-click-button race (banked Wizard v3 Phase 1, 2026-0... | LOW | — | — | 1140 |
| Producing-manager fast-path Confirm — deferred Sunday smoke leg (banked PR #724, 2026-06-22, LOW) | LOW | — | — | 1146 |
| Producing-manager fast-path — Gemini backstop nits (banked PR #724 post-merge Gemini, 2026-06-22,... | LOW | — | — | 1158 |
| PM-2 smoke — BM own-data write-seeding for value-level read (banked PR #719, 2026-06-21, LOW) | LOW | — | — | 1167 |
| MoneyNeedsPanel amount inputs — `=== 0 ? '' :` idiom vs `\|\| ''` for null safety (banked PR #718 G... | LOW | — | — | 1173 |
| Money Needs 1.7 — per-line renewal sub-chips need a data source (banked PR #706, 2026-06-21, LOW) | LOW | — | — | 1179 |
| MonthlyPlanModal:41 — `todayTT.split` lacks a null guard (banked PR #708 Gemini OUT-OF-SCOPE, 202... | LOW | — | — | 1185 |
| A11Y smoke agent — no unstarted-but-fillable week, so the walk's own write-read-verify never runs... | LOW | — | — | 1226 |
| Rules-test harness — `FIRESTORE_EMULATOR_HOST` parse is not IPv6-safe (banked PR #703 Gemini, 202... | LOW | — | — | 1240 |
| CONTRACT: remove `weeklyActivityFloors.contactsMade` from companyMinimums (LOW — after #685 merge... | LOW | — | — | 1254 |
| Daily Capture v2 Phase 2 — back-fill strip selected-state visual (banked PR #686, LOW) | LOW | — | — | 1270 |
| Daily Capture v2 Phase 2 — axe baseline re-sync vs fresh main (banked PR #686, LOW) | LOW | — | — | 1280 |
| Daily Capture v2 — wizard direct-entry default carries the Sunday edge (banked PR #688, LOW) | LOW | — | — | 1290 |
| Daily Capture v2 — aggregate-on-save could be non-blocking (Gemini #1, banked PR #688, LOW) | LOW | — | — | 1302 |
| ProfileScreen.todayLocalDate — catch-up entry dated browser-local, not TT (banked PR #688, LOW) | LOW | — | — | 1314 |
| getMostRecentSunday peripheral read/display selectors — browser-local week (banked PR #688, LOW) | LOW | — | — | 1326 |
| team-roster data layer (#682) — Gemini LOW robustness items (banked PR #683 post-merge, 2026-06-1... | LOW | — | — | 1338 |
| Update-button reload — event-driven hardening (banked PR #681 review, 2026-06-17, LOW) | LOW | — | — | 1352 |
| SW navigation strategy — NetworkFirst app shell (Option B) (banked PR #673 sw-version-update-prom... | LOW | — | — | 1410 |
| Policy ledger producing-manager write — UM Arm A + Arm B other-owner DENY emulator cases (banked ... | LOW | — | — | 1443 |
| Onboarding tenure — rule-level cross-field floor: `monthsInIndustry >= monthsAtTatil` (banked PR ... | LOW | — | — | 1487 |
| Plan-lens UM compliance — do UMs commit weekly plans? (banked PR #640, 2026-06-15, LOW) | LOW | — | — | 1503 |
| Awards reach pins — Firestore persistence for cross-device sync (banked PR #641, 2026-06-15, LOW) | LOW | — | — | 1519 |
| CommissionPlayground `submissions={[]}` in manager GoalsPanel — pure rate-calculator vs live data... | LOW | — | — | 1533 |
| Smoke hardening — confirm deployed SHA before asserting (banked PR #643, 2026-06-15, LOW) | LOW | — | — | 1547 |
| goalsService — blanket .catch(() => null) on agent-doc reads (banked 2026-06-13, LOW) | LOW | — | — | 1563 |
| `VITE_GAME_PLAN_LOOP_ENABLED` kill-switch — remove once planning loop is stable (banked 2026-06-1... | LOW | — | — | 1577 |
| Bulk pilot-roster provisioning + link export (banked 2026-06-12, LOW) | LOW | — | — | 1587 |
| Copy invite link — Create-time link affordance (banked 2026-06-11, LOW) | LOW | — | — | 1599 |
| Money Needs — per-tenant taxonomy via `config/budgetCategories` (banked 2026-06-11, LOW) | LOW | — | — | 1615 |
| #547 deferred-verify: branch dropdown verified live via provisioning (banked 2026-06-10, LOW) *(verification uncertain)* | LOW | — | — | 1651 |
| AgentReportDocument — add seminarsConducted + tradeshowsAttended to PDF (banked 2026-06-10, LOW) | LOW | — | — | 1670 |
| Dashboard background Firestore permission error — investigate listener (banked 2026-06-10, LOW) | LOW | — | — | 1684 |
| computePoints — structural bypass of extractFields (banked 2026-06-10, downgraded 2026-06-11, LOW) | LOW | — | — | 1700 |
| LoginPattern backdrop — extract to shared component (banked 2026-06-09, LOW) | LOW | — | — | 1718 |
| recoverEmail action mode unhandled — falls through to LoginScreen (banked 2026-06-10, LOW) | LOW | — | — | 1734 |
| BadgeGrid → gamificationConfig reconciliation (banked 2026-06-10, LOW) | LOW | — | — | 1764 |
| `managerWeeklyReports` — `validWarWrite()` hasAll-only, no hasOnly guard (banked 2026-06-15, LOW) | LOW | — | — | 1788 |
| Playwright best-practices sweep — verification scripts (banked 2026-06-08, LOW) | LOW | — | — | 1800 |
| setupBypassSession SPOF (LOW, informational) *(verification uncertain)* | LOW | — | — | 1864 |
| Gamification — API-vs-app-count weighting review (banked 2026-06-10, LOW) | LOW | — | — | 1894 |
| Gamification — optional dials-points cap (banked 2026-06-10, LOW) | LOW | — | — | 1908 |
| leaderboardAggregate: `loadInputs` year derivation — make TT-consistent (banked 2026-06-14, LOW) | LOW | — | — | 1980 |
| Weekly Planner S2 derived-state live walk (LOW, banked from Weekly Planner v2 Slice 3a, carried f... | LOW | — | — | 2091 |
| Over-goal MDRT marker treatment on the HeroCard (LOW, banked 2026-06-03 from HeroCard marker-labe... | LOW | — | — | 2105 |
| Daily Capture streak mechanics (LOW until prioritized, banked 2026-06-02 from Daily Capture v2 Sl... | LOW | — | — | 2200 |
| Trailing autosave permission error after submit — cosmetic console noise (LOW, banked 2026-06-01 ... *(verification uncertain)* | LOW | — | — | 2223 |
| Wizard v2 PR2 — mobile expand-to-sheet variant (LOW, banked 2026-06-01 from Wizard v2 PR2) | LOW | — | — | 2281 |
| Track J — Cyril agents have goals + policies but no seeded submissions (LOW, banked 2026-06-03 fr... | LOW | Track J | — | 2412 |
| Track J — SM picker default-to-populated-branch UX nicety (LOW, banked 2026-06-01 from PR #411 li... | LOW | Track J | — | 2430 |
| Track F — peer-BM branch-scoped exclusion (LOW, banked 2026-05-27) | LOW | Track F | — | 2483 |
| H3 Phase 2 real-data parity sweep — re-run when agent has ≥10 settled policies (LOW, banked 2026-... | LOW | — | — | 2502 |
| F2.2 unarchive — archive is one-way in UI; add field-flip path when needed (LOW, banked 2026-05-27) | LOW | — | — | 2516 |
| H4 — contributedPolicyIds array growth on long-lived pending entries (LOW, banked 2026-05-28) | LOW | — | — | 2577 |
| CF emulator integration tests for FieldValue writes (LOW, banked 2026-05-28) | LOW | — | — | 2591 |
| H3 existing-policy date migration (LOW, banked 2026-05-28) | LOW | — | — | 2607 |
| H3 — `validate()` raw `new Date()` date guards (LOW, banked 2026-05-28) | LOW | — | — | 2626 |
| H3 — `getTodayTT()` en-CA locale dependency note (LOW, banked 2026-05-28) | LOW | — | — | 2640 |
| Wizard `SOCIAL_PLATFORMS` TikTok expansion — consider adding for symmetric posts-vs-leads cross-t... | LOW | — | — | 2654 |
| moneyNeeds `shareWithSm` owner-update arm is UI-gated only — no rule enforcement (LOW, banked 202... | LOW | — | — | 2672 |
| Track I I2 — Monthly recruiting standards + accountability flag (LOW, banked 2026-05-23) | LOW | Track I | — | 2686 |
| Track I I2 — `recruitsInFirstWeeks` auto-derive from `contractStartDate` (LOW, banked 2026-05-23) | LOW | Track I | — | 2700 |
| Track I I2 — Head-of-sales definitional confirmation for `candidatesAssessed` + `agentsContracted... | LOW | Track I | — | 2714 |
| Track I I2 — Possible compliance edit-freeze for submitted monthly rollups (LOW, banked 2026-05-23) | LOW | Track I | — | 2733 |
| terminatedAt timestamp + D4 net-new refinement (LOW, banked 2026-05-24) | LOW | — | — | 2750 |
| `deactivateUser` CF — wrap naked awaits in try/catch for diagnostics (LOW, banked 2026-05-24) | LOW | — | — | 2809 |
| TOOLING — extract + unit-test the 16 inline CFs in `functions/index.js` (LOW, banked 2026-05-22) | LOW | — | — | 2836 |
| Track I I3b — `escalationLogic.js` ↔ `accountabilityFlag.js` sync (LOW, banked 2026-05-22) | LOW | Track I | — | 2854 |
| Track I I3 — 2-consecutive-week intensifier (LOW, banked 2026-05-22) | LOW | Track I | — | 2873 |
| Track I I3 — `ManagerDashboard` Overview accountability chip (LOW, banked 2026-05-22) | LOW | Track I | — | 2887 |
| I §6 — Default new agents to `licenseStatus: 'provisional'` at creation (LOW, banked 2026-05-24) | LOW | — | — | 2901 |
| BOA-teardown — remove `BOA` from `prospectingSource` once legacy docs are backfilled (LOW, banked... | LOW | — | — | 2919 |
| Track J3 → Track I — Manager levels 8–10 production model (LOW, banked 2026-05-20) | LOW | Track J3 | — | 2963 |
| Verify PR #166 shakedown harness fixes via runtime re-run (LOW, deferred 2026-05-15) | LOW | — | — | 2977 |
| Delete tenant_admin historical test submissions (LOW, backfill cleanup) | LOW | — | — | 3002 |
| Delete branch_manager historical test submissions (LOW, backfill cleanup) | LOW | — | — | 3008 |
| Migrate EditConfigModal + BranchEditorModal to useFocusTrap (LOW, filed during C2) | LOW | — | — | 3060 |
| Goal-doc audit-field naming inconsistency (LOW, surfaced 2026-05-08 during C3) | LOW | — | — | 3143 |
| Defaults-warn banner positive-render test (LOW, surfaced 2026-05-08 during C3 extended verification) | LOW | — | — | 3235 |
| `Bulk Import Goals` CTA label wraps at 390px (LOW, surfaced 2026-05-08 during C3 Q1 design review) | LOW | — | — | 3247 |
| Kiosk per-branch customization (LOW, deferred 2026-05-10) | LOW | — | — | 3294 |
| fieldHelpers / extractFields consolidation (LOW, banked 2026-05-10) | LOW | — | — | 3320 |
| PERF-1 — `getAvailableMonths` tenant-wide unfiltered query (LOW, post-pilot) | LOW | — | — | 3381 |
| WALK-2 — Agent self-write path coverage for persistency walks (LOW, post-pilot) | LOW | — | — | 3403 |
| FU-I — Parameterize hardcoded TENANT_ID constants in seed/cleanup/shakedown scripts (LOW) | LOW | FU-I | — | 3454 |
| Cross-branch test fixture: A11Y_BRANCH_MANAGER_2 (LOW, banked PR #266) | LOW | — | — | 3605 |
| `managerActivityStandardOverrides` update arm: pin managerId/tenantId immutable (LOW, banked PR #... | LOW | — | — | 3621 |
| Track H — isBdoDso / monthsInIndustry / monthsAtTatil — no UI write path (LOW, banked H1 PR #300) | LOW | Track H | — | 3635 |
| Track H — orphan `jointCalls` CG index reconciliation (LOW, banked H1 PR #300) *(verification uncertain)* | LOW | Track H | — | 3652 |
| Track J (V2 Redesign) — Shell brand subline requires new data-fetch (LOW, banked 2026-05-30, PR #... | LOW | Track J | — | 3666 |
| Track J (V2 Redesign) — `surfaceSoft` token revisit across V2 screens (LOW, banked 2026-05-30, PR... | LOW | Track J | — | 3684 |
| Track J (V2 Redesign) — Component test coverage for CareerPortal / HistoryTab / AgentAwardsPanel ... | LOW | Track J | — | 3700 |
| awardsEngine.js per-line filter gap (LOW, banked 2026-06-13, Slice 2b design) | LOW | — | — | 3751 |
| Pre-existing color-contrast failures outside the sidebar (LOW, banked 2026-05-30, PR #392) *(verification uncertain)* | LOW | — | — | 3773 |
| Track J (V2 Redesign) — HeroCard YoY-delta chip deferred (LOW, banked 2026-05-30, PR #393) | LOW | Track J | — | 3800 |
| Track J (V2 Redesign) — DeliveryStripCard stubbed to null; wire to Track H policies (LOW, banked ... | LOW | Track J | — | 3814 |
| Track J (V2 Redesign) — AgentProductionView floor bar uses hardcoded default tenure bands; does n... | LOW | Track J | — | 3851 |
| Track J (V2 Redesign) — Dual-consumable computations.js — eliminate the CJS twin entirely (LOW, b... | LOW | Track J | — | 3865 |
| Track J (V2 Redesign) — P1b leaderboard CF: multi-tenant iteration (LOW, banked 2026-05-31, PR #400) | LOW | Track J | — | 3884 |
| Track J (V2 Redesign) — P1b leaderboard CF: on-write trigger optimization (LOW, banked 2026-05-31... | LOW | Track J | — | 3898 |
| Track J (V2 Redesign) — P3 Production Leaderboard: converge the kiosk medal onto ui/MedalCoin (LO... | LOW | Track J | — | 3928 |
| `DailyEntryModal.test.jsx` timer flap — first strike, watch (LOW/TEST-STABILITY, banked 2026-06-05) | LOW | — | — | 3971 |
| Track J (V2 Redesign) — GamePlanV2 component test coverage: `PlanAnchorStrip` + `PlanCascade` (LO... | LOW | Track J | — | 4052 |
| Settlements manager reads — tenant-scope (no unitId/branchId on docs) (LOW, banked 2026-06-05) | LOW | — | — | 4064 |
| Gamification — badge eligibility thresholds machine-readable in config (banked 2026-06-10, LOW) | LOW | — | — | 4085 |
| yearPlan rules — field=path cross-checks + licenseProfile/status value constraints (LOW, banked 2... | LOW | — | — | 4112 |
| .mjs emulator rules tests — manual-only, not wired into CI (LOW, banked 2026-06-11, PR #571) | LOW | — | — | 4134 |
| SEC-012 kiosk branch-scoping — two follow-ups banked (2026-07-05, PR #801 `3d7c391e`) | — | SEC-012 | — | 660 |
| A11y sweep L1-5b — UX-001 designed empty state shipped; A11Y-002 + A11Y-003 verified NOT-actionab... | — | — | — | 672 |
| A11y sweep L1-5a — RESOLVED (2026-07-05, PR `fix/a11y-h1-topbar-skiplink`) + one banked wayfindin... | — | — | — | 684 |
| BUG-102 — Week number disagrees between dashboard topbar and Daily Capture — RESOLVED (2026-07-05... | — | — | — | 694 |
| Goals v3 closure sweep — two items resolved, two banked (2026-07-04, PR #792 `41935ef8` goals-v3-... | — | — | — | 724 |
| EFF-004 follow-ups — MDRT badge backfill · threshold reconcile · YTD year-attribution (banked 202... | — | — | — | 787 |
| L1-1/L1-2 follow-ups — badge semantics · test-mock consolidation · mdrt_pace hardening · mdrt_pac... | — | — | — | 801 |
| Track K · K1 — admin corrective / backward status transition (banked K1, 2026-06-25, deferred per... | — | Track K | — | 994 |
| Track K · A.4 Staff-policy credit-filter — staff `'exclude'` path needs a ledger flag (carry from... | — | Track K | — | 1002 |
| Track K · K3 — live-data wiring adapter for the bonus engine (banked K3, 2026-06-25, lands with K8) | — | Track K | — | 1010 |
| Nav redesign — mobile pin edit-mode (banked PR-2 nav-pr2-pinned, 2026-06-22, deferred this PR) | — | — | — | 1112 |
| Producing-manager fast-path — `mp-report` direct-nav stays full-path (scope note, banked PR #724,... | — | — | — | 1152 |
| seed-first-tenant-admin — service-account-key-archived.json as fallback key (banked 2026-06-09, X... | — | — | — | 1750 |
| Nexus Glass S3 sweep — hero census canon (banked 2026-06-07, PR #534) | — | — | — | 1817 |
| Nexus Glass recipe HTMLs — AA tables need regeneration from module outputs (banked 2026-06-06, PR... | — | — | — | 1922 |
| SettlementPanel — TT-year derivation and display (C-001 / C-002) (banked 2026-06-06, Gemini harvest) | — | — | — | 1948 |
| Functions day — leaderboardAggregate hardening + S3b nudge CF (banked 2026-06-06, Gemini harvest) | — | — | — | 1964 |
| GoalDecompositionTab — sort-stability + NaN guard (banked 2026-06-06, Gemini harvest) | — | — | — | 1992 |
| LoginScreen — responsive backdrop on narrow viewports (banked 2026-06-06, Gemini harvest) | — | — | — | 2006 |
| Persistency Mgr v2 — remaining slices (banked 2026-06-05 from Persistency Mgr v2 S1, PR #505) | — | — | — | 2018 |
| Manager-program backlog | — | — | — | 2048 |
| Weekly-activity planner — remaining slices (banked 2026-06-03 from Weekly Planner v2 Slice 1, PR ... | — | — | — | 2069 |
| Policy Ledger v2 — deferred slices (banked 2026-06-02 from Policy Ledger v2 Slice 1 PR #432) | — | — | — | 2119 |
| Policy Reconciliation v2 — Slice 2 (deferred, banked 2026-06-03 from Policy Reconciliation v2 Sli... | — | — | — | 2138 |
| HIGH#4 — Programmatic walkthroughs miss state-persistence interactions (surfaced 2026-05-08) | — | — | — | 3016 |
| A11Y dark-mode story — CLOSED in PR7 | — | — | — | 3169 |
| React Compiler adoption — already documented below; left in place for context | — | — | — | 3189 |
| React Compiler adoption (long-term, conditional) | — | — | — | 3193 |
| SEC-9b — Cross-tenant isolation audit | — | SEC-9b | — | 3207 |
| Login screen logo | — | — | — | 3221 |
| Add CI step for Firestore index deployment (POST-PILOT, banked 2026-05-12 during pilot-readiness ... | — | — | — | 3417 |
| Phase 7-8 Pre-Track Verifications | — | Track Verifications | — | 3475 |
| Workshop-Driven Roadmap Revision Items (2026-05-20) | — | — | — | 3495 |
| Track I I1.3a — Full-freshness jointCalls-write trigger (banked PR #258) | — | Track I | — | 3522 |
| Track F F1 — Coaching Notes deferred items (banked PR #242) | — | Track F | — | 3539 |
| Track F F2 — Joint-Call Log deferred items (banked PR #244) | — | Track F | — | 3559 |
| Track F F3 — Prospect-Info deferred items (banked PR #246) | — | Track F | — | 3581 |
| Track J (V2 Redesign) — P1b leaderboard CF: reconciled-production swap point (FU-2 reference, ban... | — | Track J | — | 3914 |
| `CompliancePanel.nudge.test.jsx` timing flap — stabilize with proper async waits (**RE-OPENED — s... | — | — | — | 3942 |
| DataSourceBadge "Estimated" — `bg-warning/15 text-warning` light-mode contrast (added PR #403) *(verification uncertain)* | — | — | — | 4001 |
| AgentProductionView hero avatar — `bg-primary text-white` dark-mode contrast (added PR #403) *(verification uncertain)* | — | — | — | 4011 |
| **Flake register — two NEW members enumerated (2026-09-16).** `WizardFormV2RetirementR2.test.jsx` and `AwardsRulesetPanel.test.jsx` both failed CI on diffs that cannot be causal, and both went green on re-run with zero code change. Neither was in the named roster, so the family is larger than the ~10 recorded. See the detail section at the end of this file | MEDIUM | test-infra | — | see the 2026-09-16 flake-member section at end of file |
| **P4 must not parse agent-picked files in the browser with `xlsx@0.18.5`** — pick a maintained parser or parse server-side. The package is a root devDependency for the P2 admin script only (operator-downloaded OIPA export, never in the web bundle); it carries known prototype-pollution and ReDoS CVEs that are triggered by parsing MALICIOUS files, which is exactly what P4 would do with a file an agent chooses. Chosen for P2 for continuity: every number in the P0/P1/P2 paste-backs was validated through this reader (banked 2026-09-16, P2b, dispatcher ruling 5) | HIGH | OIPA import / security | before P4 | see the P2b entry at end of file |
| **ACCEPTED GAP — "organic + imported policies in one tenant" is never tested together.** `excludeImported()` is proven to drop imported docs (production, 117 settled -> 0) and to keep an organically created one (`tatillife_smoke`, 1 -> 1), but never both in the same tenant, because no test agent exists inside `tatillife_south`. Operator ruling 16 Sep 2026: do NOT create one — a test agent would appear in manager rosters and leaderboards. **Revisit if P4 changes the filter** (banked 2026-09-16, P3) | MEDIUM | OIPA import | revisit at P4 | see the accepted-gap entry at end of file |
| ~~**`buildImportPlan`'s `substantive` filter contradicts its own comment**~~ **RESOLVED 2026-09-19 (P4d).** The rule is now ONE named list, `PROVENANCE_ONLY_FIELDS` = `exportDate`, `importedAt`, `importSource`, `lastImportRunId`, and the comment is the list rather than a second statement of it that could drift. Verified on the real 15 Sep export through the emulator: a re-import reports **0 created / 0 updated / 229 unchanged**, and **zero policy documents had their Firestore `updateTime` move** — unchanged now means NOT WRITTEN, not written-with-only-provenance. The coupling this entry warned about held: `findLastImportBatch` narrows candidates by `exportDate`, and a skipped policy keeping its older date is exactly what makes that correct. Kept, struck rather than deleted, because the failure shape is the lesson — a field was OWNED but UNCLASSIFIED, and the comment describing the rule was not the rule (banked 2026-09-18, P4b; resolved 2026-09-19, P4d) | ~~MEDIUM~~ | OIPA import / P2 | — | see § `substantive` filter contradicts its comment |
| **PARTLY RESOLVED 2026-09-19 (P4d).** Every policy an import writes now carries `lastImportRunId`, and one it CREATES also carries `firstImportRunId`, set once and never moved by a later update — undo deletes on that field, so an update moving it would remove a policy a later import merely touched. Undo reads the run record first and falls back to the history path only for imports that predate it, naming which one it used in every response and every refusal. **STILL OPEN: the backfill has not been run.** The 229 policies live in production still carry no run id, so they still take the history path. `functions/scripts/stamp-import-run.cjs` stamps them with a synthetic run, dry run by default — the operator runs it, or not (banked 2026-09-18, P4b ruling; part-closed 2026-09-19, P4d) | LOW | OIPA import / schema | — | see § No written policy records which import run wrote it |
| **`functions` runtime `nodejs20` is DECOMMISSIONED on 2026-10-30** — upgrade the runtime and the `firebase-functions` SDK (pinned at `^4.9.0`, a major version behind) before then. This is a dated deadline, not a nicety: after decommission a deploy is refused and the existing functions stop being patched. The SDK bump is the harder half — v5/v6 change the callable signature from `(data, context)` to a single `request` object, and every `functions.https.onCall` in `functions/` reads `context.auth` (banked 2026-09-18, P4b session) | **DEADLINE** | Functions / runtime | **2026-10-30** | see § `nodejs20` decommission + firebase-functions SDK |
| Lock `prefs/portfolioImport` to the Cloud Function — the per-agent import config (overrides, self/family, test-record skips) is currently AGENT-WRITABLE, so an agent can add an override that flips one of their own policies from `lapsed` to `settled` and move their own manager-facing persistency figure. Needs a `firestore.rules` change AND a rules deploy, which is why it was not done in P4a. Operator ruled: leave it editable, revisit when a second agent uses the importer (banked 2026-09-18, P4a ruling) | MEDIUM | OIPA import / rules | — | see § Lock `prefs/portfolioImport` to the Cloud Function |
| Partial import (a file where SOME rows are serviced by another agent) is UNIT-TESTED ONLY — Kyron's export is 100% his own servicing number, so the P4a emulator run could only produce the all-or-nothing refusal, never a partial `counts.skippedNotYours`. Prove it on the first export that actually contains another agent's rows (banked 2026-09-18, P4a Rule 22 gap) | MEDIUM | OIPA import / verification | — | see § Partial import is unit-tested only |
| `kioskTokens` read is still open to every manager role, `unit_manager` included — the doc ID is the token, so a UM can copy another branch's live kiosk URL. S1 kept reads for `KioskModeTab` (banked 2026-09-25, security S1) | LOW | Security / Kiosk | — | see § Kiosk token revoke and read scope |
| Persistency `get`/`list` UM and BM arms compare `users/{agent}.unitId`/`branchId` to the caller's — a caller whose own doc LACKS the field matches every agent that also lacks it (`null == null`). Pre-existing in `get`; S1's `list` inherits it (banked 2026-09-25, security S1) | LOW | Security / Rules | — | see § Persistency null-scope match |


---

## v3 prototypes (`design_handoff_agencytrack_v3/prototypes/*.jsx`, incl. `at-tally.jsx` / `at-dialer.jsx` / `at-store.jsx`) are design REFERENCE, not correct implementations — do not port their code (banked 2026-07-31, PR #884, MEDIUM — standing rule + defect register)

**Standing rule.** The v3 prototypes landed in-repo via PR #883 and are now greppable, citable, and dangerously easy to copy. They are **design reference only**. Port *behaviour* from the numbered docs (`01`–`08`) and the kickoff briefs; never by copying prototype code. The bundle's own `README.md:31` says it outright: *"They are **not production code to copy**."* They run as browser-transpiled JSX with no build step, no persistence and no network, and several patterns exist purely to make a single file demonstrable.

**Defect register — confirmed defects found while porting P0-B.** Each was found *because* the port went through the docs rather than the code:

| Site | Defect | Consequence if copied |
|---|---|---|
| `at-tally.jsx:90` | `weekTotals` returns `total: r.logged + r.declared` | Blends evidenced with declared — the exact thing `03-DATA-MODEL.md`'s central contract forbids. Destroys the provenance the trust surface is built on. |
| `at-tally.jsx:61` | Recomputes each block's `inside` set **without excluding already-claimed calls** | A call inside two overlapping blocks is counted twice. Silently inflates a manager-facing activity figure. Reproduced under mutation in PR #884 and shrunk to 2 evidenced `PC` blocks with identical windows + 1 call. |
| `at-tally.jsx:29-35` | Hardcoded `COUNTED` array carrying floor values | A twin of `ACTIVITY_METADATA` — the exact class v3 rule 1 exists to remove — **and its floor numbers are fictional**, not the company minimums. |
| `at-dialer.jsx:161` | Cancelling a ringing call never clears the pending `ring.current` timeout | The call connects ~1.6s later anyway: a Cancel control that does not cancel. (CodeRabbit, PR #883.) |
| `at-store.jsx:395` | Side effects and mutable counters run inside `setX` updaters throughout `useSyncStore` | React 19 StrictMode may double-invoke updaters, so these double-fire or desync two `useState` slices. Note the README says component boundaries and state *shape* are worth keeping — the updater *implementation* is not. (CodeRabbit, PR #883.) |

**Why this is banked rather than fixed:** editing the prototypes would defeat the point of a verbatim, citable design reference, and `03-DATA-MODEL.md` is corrected in place instead when the *design* is wrong (see the `SC` correction in PR #884). Add to this register whenever a port surfaces another one. **Phase 5.x reads `at-dialer.jsx` as design authority — read this entry first.**

---

## Track K Strategic Plan — banked follow-ups from Phase 1 close (banked 2026-07-21, PR #864 squash `ebb168f1`, dispatcher-ruled sweep)

Track K Phase 1 (Branch Manager Strategic Plan dashboard — client-only, single math path in `src/lib/strategicPlan/`, presentation mode, PDF export) shipped via [#864](https://github.com/Kelsean868/agencytrack/pull/864). Design authority: `docs/design-system/screens-v2/stratplan-handoff/`; execution record: the PR thread (§4 dispatcher ruling 2026-07-17 + %Obj/Pace label-split ruling are committed into `docs/briefs/track-K-strategic-plan-phase1-brief.md` §4 Amendment). Banked per the merge ruling:

- **Phase 2 (HIGH — next Track K slice, needs a kickoff brief per Rule 10):**
  - **Narrative `branchPlans` collection** — periodic branch plan docs (narrative sections, quotas snapshot, status). Recommended shape + rules approach in the 2026-07-21 recon report (`tenants/{tid}/branchPlans/{branchId}_{year}`; BM-write-own-branch via the SEC-4 `callerBranchId` pattern, SM/TA/PA read — mirror `recruitingCandidates.seniorInScope()` / `managerWeeklyReports.uplineCanRead()`). **New collection + rules = ALWAYS HUMAN-MERGE.**
  - **PPTX export** (deck-native handoff; PDF shipped in P1 via `BranchPlanDocument`).
  - **Manpower goal SETTER** — P1 reads the optional `branchGoals.manpower` field ("—"/"goal not set" when absent, per dispatcher ruling); the write surface (GoalsPanel or Company Config) is Phase 2.
  - **Per-branch `branchGoals` keying** — `branchGoals/{year}` is tenant-level today (fine for the single-branch pilot); multi-branch needs `{branchId}_{year}` keying + migration of the existing doc.
- **Phase 3 (MEDIUM):** classification quotas (actuals-by-class already derivable from policy `productLine`/`policyClass`; quota-side has no classification split anywhere) + a **real monthly quota model** (P1 prorates annual ÷ 12; no monthly quota exists at any goals tier).
- **Seeded Net-vs-Gross integration assertion (MEDIUM — verification):** the settled-then-lapsed → "in Gross, not Net" assertion is proven at unit level only (`src/lib/strategicPlan/__tests__/settledTwinRun.test.js`; the twin-run reuses `settlementShapeFromPolicies` per RULING 2). The live smoke (`scripts/verification/smoke-strategic-plan-k1.mjs`) renders net `TTD 0` because the A11Y foil branch has no seeded settled policies — seeding prod was correctly refused (Rule 3 STOP). When a seeded foil branch exists: seed one settled + one settled-then-lapsed policy for a foil agent, re-run the smoke, and assert the value-level split. Brief AC#4 accepted as unit-level by operator ruling 2026-07-21.
- **Secondary-reviewer decision (HIGH, PROMOTED):** see § External code reviewer above — promoted out of this sweep to "next decision up" with #864's CodeRabbit rate-limit evidence.

## Prod-verification tooling must hard-pin `portal.agencytrack.app` — reject `*.vercel.app` aliases (banked 2026-07-15, Runs 5-7 promotion session, HIGH — caused a rollback scare)

A prod-verification pass this promotion ran against `https://agencytrack.vercel.app` instead of the canonical `https://portal.agencytrack.app` (the locked App-host invariant, CONTEXT.md § App host). The wrong-URL run produced false crash reports and triggered a rollback scare before the mistake was caught. **Action:** any verification tooling/workflow doc (`scripts/exploration-walk.cjs`, the feature-branch-preview-verify rule, this promotion's manual walkthrough steps) must hard-pin `https://portal.agencytrack.app` for production checks and explicitly reject/flag any `*.vercel.app` URL as a non-canonical alias before proceeding. Cross-reference: CONTEXT.md § App host — single-source two-constant invariant (PR #672 `82314e3`) already locks the canonical host; this FU is about enforcing that invariant in the verification tooling itself, not re-litigating the host.

---

---

## Investigate stray `agencytrack.vercel.app` deployment (banked 2026-07-15, Runs 5-7 promotion session, MEDIUM — confirm + retire)

The wrong-URL verification above only produced a false crash/rollback scare because `agencytrack.vercel.app` resolves to *something* — confirm what: a live stale-bundle deployment reachable at a guessable URL (minor exposure/confusion risk), a Vercel default project alias that happens to also serve the current production build (in which case no action needed beyond documentation), or a dangling preview. **Action:** check the Vercel dashboard's deployment list for this alias, confirm which build it serves and whether it auto-updates with `main`, and decide whether to retire/unalias it or leave it as a documented secondary alias. Do not assume it is harmless without checking.

---

---

## `featureFlags` allowlist is a deliberate triple-copy — consolidate when flags become config-driven (banked 2026-07-15, Runs 5-7 promotion session, LOW — Tier-2 note)

Company Config slice 1's Feature Flags panel enforces its allowlist in **three** places by design: `firestore.rules` (the diff-scoped guard on `config/settings`, evaluating only changed flag keys so an empty diff passes), `configService`'s `ALLOWED_FLAG_KEYS`, and `flag-toggle.cjs`'s `ALLOWED_FLAGS`. A cross-check test guards the three from drifting apart today. **Note for Company Config v2 Tier 2** (see § Company Config v2 below): once flags become fully config-driven (a Firestore-read allowlist rather than three hardcoded copies), this triple-copy consolidates into one source — don't rebuild the cross-check test pattern for Tier 2 flags, replace it with the config-driven read.

**2026-09-07 — one key is now stranded in the triple-copy (Persistency Slice P2, PR #939).** P2 retired the `persistencyV2` preview shell under P-D6 and removed the flag from `featureFlagsService.FEATURE_FLAG_KEYS` and from `companyConfigRegistry.CONFIG_FLAGS`, so no UI offers it any more. It deliberately stayed in `configService.ALLOWED_FLAG_KEYS`, because dropping it from one copy alone would break `flagAllowlist.cross-check.test.js` — the other two copies live in `firestore.rules` (`ccfgFlagKeysAllowed()`) and `scripts/verification/vh/flag-toggle.cjs`, and P2 was scoped to touch no rules file. The result is an allowed-but-unreachable write path: harmless, since nothing in the app can call it, but it is drift.

Retiring it means editing all three copies in one change, which makes it a **human-merge PR with a manual `firebase deploy --only firestore:rules`, staging first, released ruleset read back and compared** (the #935 ritual). Not worth a PR of its own. Fold it into whichever slice next touches `firestore.rules` for another reason — or drop it entirely if Company Config v2 Tier 2 lands first, since the config-driven allowlist above removes the triple-copy and this item with it.

---

---

## VH leg `t1-compliance-scope` — RESOLVED (Run 8 Tier B, 2nd-`unit_manager` fixture; evidence `ef4e7c0d`)

**RESOLVED 2026-07-16.** `seed-staging.mjs` provisioned exactly one `unit_manager` per branch, so a multi-unit BM roster could never occur on staging and the `t1-compliance-scope` VH leg SKIPped indefinitely — its full assertion path (CBTT section compliance scoping across 2+ units under one BM) had only ever been proven RTL-side, never live. Run 8's Tier B block shipped a bare 2nd `unit_manager` doc (SHA `f8751c10` on `staging`) rather than the originally-sketched 2-fixture approach (2nd UM **+** 3rd agent) — the fuller sketch would have flipped `MeetingMode.deriveUnits()` and inflated `MasterSheet` exception counts on every week; a bare UM doc is invisible to every `role==='agent'` surface, so it closed the gap with a single ripple (the All-Users any-role count, 7→8), correctly found and fixed in the same change. `t1-compliance-scope` now runs its full path live for the first time: the VH suite is a genuine **44/44** (43 PASS / 1 login-timeout flake, PASS solo / **0 SKIP**), replacing the prior "43 PASS / 0 FAIL / 1 SKIP" no-regressions baseline. Shipped to production via the Run 8 promotion (PR #860, merge SHA `ef4e7c0d`, 2026-07-16). No further action.

---

---

## Run-7 ranked next-list — PARTIALLY CLOSED by Run 8 (banked 2026-07-15, from `docs/fable-run7-progress.md` § Ranked next-list, at-fable-staging repo; dispositions updated 2026-07-16 post Run-8-promotion)

Six items ranked for the next Fable/autonomous session. Dispositions after Run 8 (shipped to prod via PR #860, `ef4e7c0d`):

1. **Persistency KPI card** (Team Dashboard B-3 half) — **STILL OPEN.** Needs either a precomputed branch-persistency aggregate (leaderboards-style CF-written doc) or an accepted O(agents) fan-out on the overview. Ruled 2026-07-13 (R-02): DEFERRED, attended/`functions/` window, bundle with the Node-20 migration — see `docs/audits/design-conformance-2026-07-13.md` §4 item 2.
2. **Kiosk roster parity** (SEC-012 B-1 remainder) — **STILL OPEN.** Celebrations/compliance/photos panels still degrade on the kiosk when the users list is denied (same gap as § SEC-012 kiosk branch-scoping below — same root cause, do not double-track). Ruled 2026-07-13 (R-03): DEFERRED, attended/`functions/` window — a CF-written `leaderboards/{branchId}`-style branch-roster aggregate carrying name+photo+unit only (no email/phone), no rules widening.
3. **Campaign proof export** (Policy Ledger B-2 remainder) — **RESOLVED, Run 8 item A-4** (SHA `41885ff5` on staging, promoted `ef4e7c0d`). CSV export of `lens.contributions` (policy, plan, state, value), live-smoked (6 rows).
4. **Team Dashboard #6 remainder** — **RESOLVED, Run 8 items A-1/A-2** (SHA `fa0fe12e` on staging, promoted `ef4e7c0d`). ChampionsPanel + MyWeekPanel shipped, live-smoked — but only in their **empty states** (no fixtures push either into a populated view yet; ranked-podium *content* verification against live data is a separate, still-open item — see § Run 8 banked follow-ups below).
5. **Build-map next-window candidates** — **PARTIALLY RESOLVED.** All Users roster (Tier-4 #17) shipped as Run 8 item A-3 (SHA `1ac958f1`, promoted `ef4e7c0d`) — stat strip + search + role chips + BRANCH·UNIT, live-smoked. AgentDrillDrawer (Tier-1 #7) partially shipped as Run 8's read-only Joint-Work stretch (SHA `3fb99d94`) — the Notes tab + RecommendGoal write-path action remain STILL OPEN (needs a design call on note visibility, per `docs/audits/design-conformance-2026-07-13.md` §4 item 3 / §5 item 11). Commission scenarios (Tier-2 #10) — **STILL OPEN but now RULED** (R-06, 2026-07-13): agent-private slice buildable (profile-doc storage, own-write only); the manager suggest-a-goal-back cross-user write stays DEFERRED.
6. **ATTENDED-ONLY (do not autonomously start):** Policy Reconciliation 8-flag/8-way discrepancy taxonomy (already tracked, see § Policy Reconciliation v2 — Slice 2 below — do not duplicate), the Node 20 / `firebase-functions` SDK migration (already tracked, now escalated — see § Node 20 → Node 24 below), any payout-release write path (money-adjacent, human-gated by standing rule).

---

---

## Run-7 DECISIONS-NEEDED — none banked this run (informational, 2026-07-15)

Run 7's own DECISIONS-NEEDED section (`docs/fable-run7-progress.md`) is empty — Run 7's Tier A closed out all 5 of Run 6's outstanding operator rulings (A1 WizardForm draft-load failure surfacing, A2 WizardForm:342 absent→0 confirmed-as-designed, A3 kiosk quiet reconnecting indicator, A4 JointCallsTab prospect-prep failure surfacing, A5 CBTT ScopeSwitch honoring) and banked no new open decisions. Nothing to carry forward under this heading for this promotion — noted so a future sync doesn't assume an item was silently dropped.

---

---

## Design-conformance 2026-07-13 revalidation — 11 NEEDS-RULING items ruled by operator; backlog updated (banked 2026-07-16, HIGH — active build map)

`docs/audits/design-conformance-2026-07-13.md` §4/§5 carried 11 NEEDS-RULING items forward from Run 8's own DECISIONS-NEEDED log plus the 07-12 doc's residual list. The operator ruled all 11 on 2026-07-13 (recorded in-doc + `docs/design-system/proposals/persistency-v2-PROPOSAL/README.md`; landed PR #859, content SHA `bb6c8ce0`, merge SHA `7eebc60a` — confirmed still present on `main` post-Run-8-promotion at `ef4e7c0d`). Full ruling text lives in the audit doc; do not duplicate it here — this entry is the FOLLOW_UPS-side pointer plus the headline dispositions:

- **Newly buildable (STILL-VALID, unblocked):** R-08 ChampionsPanel ranked podium (ranked by API — was mis-bucketed as a cosmetic gap, corrected); R-06 Commission Playground saved-scenario chips, agent-private slice (profile-doc storage, own-write only — the manager suggest-a-goal-back cross-user write stays DEFERRED); R-11 All Users LAST-activity column (gated on a login-stamp write path — see the login-stamp prerequisite noted in R-11's ruling; write the stamp first, then the column is buildable).
- **Struck from the backlog:** R-01 DataSourceBadge SETTLED wiring ("Estimated" blessed as the permanent honest state, the `computations.js:267-273` read-light rule is deliberate); R-04 AgentModePicker (absorbed into the Company Config "Reporting Cadence" section, no longer tracked standalone).
- **Attended-only / ABSOLUTE STOP (not autonomous-eligible):** R-02 Persistency KPI card CF aggregate, R-03 kiosk roster-parity CF aggregate (both bundle with the `functions/` Node-20 migration window — see § Node 20 → Node 24 below), R-05 SM cross-branch views (bundle into the multi-tenancy track), R-09 Est-Commission wizard card (needs a commission-rate source), R-10 EditUserDrawer commission-rate + reset-password (split, both attended). **R-07 Persistency v2 calc methodology is SUPERSEDED** — Tatil ratified a different formula (the 24-Month Model memo), built in P1/P2; see its own entry above. Its successor, the per-policy 24-month lapse-window engine (Persistency 24-Month Model brief, Slice P3), remains attended-only/design-gated on Tatil's process document — see § Persistency — the per-policy 24-month lapse window.

**Action:** none required from this ruling pass itself — the buildable items (R-08/R-06/R-11) are candidates for the next Fable/autonomous dispatch; the attended items are gated as noted. Full ABSOLUTE STOP table at `docs/audits/design-conformance-2026-07-13.md` §8.

---

---

## Run 8 banked follow-ups — carried forward, not yet dispatched (banked 2026-07-16, from `docs/fable-run8-progress.md` § Banked follow-ups, at-fable-staging repo)

Verification/scope gaps Run 8 itself flagged (Rule 22), now live in prod via PR #860 (`ef4e7c0d`) — these are testing/verification gaps on shipped features, not unbuilt features:

1. **A-6 kiosk-side live verification is HALF-proven.** The manager toggle → Firestore doc → rotation-count change was live write-read-verified in prod post-merge, but the kiosk wall's own re-read of `kioskConfig/{branchId}` on its 5-min poll has NOT been observed across a real poll boundary (the smoke asserts the rotation build, not a 5-min wall-clock wait). Minimal next step: a long-poll leg, or shorten the poll interval behind a test flag.
2. **Awards-within-reach uses `DEFAULT_RULESET_2026`, not the tenant-merged ruleset.** Deliberate trade from the zero-new-reads scope gate: a tenant with custom award bands (via `getMergedAwardsRuleset`) would see the scene compute against defaults. Fix needs the ruleset threaded into MeetingMode's load effect (one extra read).
3. **Awards-within-reach live-render is unverified against a populated card grid.** Both staging fixture agents sit below every annual band, so live staging only exercises the SKIP-LOG path — the card grid is RTL-proven only. Needs a fixture nudged into a band's in-contention range (~60%+) to exercise it live; that fixture would ripple other value-level VH expectations (same class of ripple Tier B just traced for `t1-compliance-scope`, see above).
4. **Joint-Work tab log half is live-proven only in its empty state** — no `jointCalls` seed fixtures exist anywhere, so the tab's *log* half (vs. its prep half, covered by existing `prospectInfo` fixtures) only ever renders empty live. Testing-infrastructure gap, not a design-conformance finding.
5. **Est-Commission card skip-logged (A-5).** Shipped as apps + API + a TTD 0 commission read — honest, but decorative until a commission-rate source is wired into wizard context. Ruled 2026-07-13 (R-09): DEFERRED, attended-adjacent, low priority.
6. **LAST-activity column skip-logged (A-3).** No `lastActive`/`lastLogin` field exists on user docs. Ruled 2026-07-13 (R-11): APPROVED — a login-time stamp write path is the prerequisite; once it exists, the column is buildable.
7. **`t3-kiosk` podium sub-assertion remains bounded-poll deferred**, pre-existing (not Run-8-caused), now adjacent to A-6's rotation work — worth one look.
8. **Two network-transport flake classes observed** (`ERR_NO_BUFFER_SPACE`, `ERR_CONNECTION_CLOSED`), both PASS solo. If they recur, consider allowlisting transport-layer resource errors distinctly from app console errors — but do NOT blanket-allowlist (the A-9 autosave-race find came from exactly this gate staying tight).
9. **N4 mobile drag-reorder** still unbuilt — deliberate A-7 exclusion (fiddly pointer semantics, unattended risk). Tracked as `docs/audits/design-conformance-2026-07-13.md` §4 item 1, no STOP category.

---

---

## Persistency v2 (NEW calc methodology, R-07) — Tatil-gated PROPOSAL, ATTENDED-ONLY (banked 2026-07-13, HIGH — money-correctness-critical)

**SUPERSEDED — Persistency 24-Month Model brief (Slices P1/P2, PRs #937/#938/P2).** Tatil ratified a Tatil Life inter-departmental memo dated 29 Aug 2026 ("Introduction of the Updated 24-Month Persistency Model") that is a **different formula** from the one this entry describes below: the memo's model is the existing aggregate formula plus one new term (`decreases`) and a per-policy 24-month inclusion window, not the rolling time-weighted debit/credit ledger this entry's proposal-stage design described. The memo's aggregate formula is what got built.

**Phase-by-phase disposition:**
1. **Calc engine — DONE, but not this entry's design.** P1 (#937) built the memo's aggregate formula in `src/lib/persistency/model.js` / `calculations.js` (`calculateGrossSettled` gained `decreases`), not the rolling debit/credit ledger described below. P1b (#938) landed the September-month follow-up.
2. **Manager surface — SUPERSEDED, not ported.** The four `persistency-v2-*.jsx` mockups under `docs/design-system/proposals/persistency-v2-PROPOSAL/` draw the rejected rolling-debit arithmetic and must NOT be ported forward — porting them now would ship a formula Tatil did not adopt. The flag-gated preview shell that showed this arithmetic (`rollingModelV2.js` + `PersistencyV2Shell.jsx`, `persistencyV2` feature flag) was retired in Slice P2 (P-D6) for exactly this reason.
3. **Calc-model switch — CLOSED, will not build (P-D3).** The memo dates the model change (effective September 2026); the model is selected by report month (`persistencyModelFor(monthKey)`), never by a tenant-configurable `persistency.calcModel` switch. A switch would let a tenant admin report August on the new model or October on the old one — both wrong.

**Successor tracked separately:** the memo's per-policy 24-month lapse-inclusion-window mechanics are NOT the same problem as this entry's rolling debit ledger, and are themselves not ratified in enough detail to build (one ambiguous paragraph in the memo, process document promised but not yet delivered). See § Persistency — the per-policy 24-month lapse window (Slice P3, appended below) for that gated item.

---

<details><summary>Original entry (pre-memo, retained for record — do not act on this design)</summary>

**Do not confuse with "Persistency Mgr v2" below** (the already-shipped manager Persistency panel redesign, PR #505 — a UI surface over the *existing* persistency calc). This entry is a **new calculation methodology**: a rolling 24-month per-policy time-weighted debit/credit ledger (early lapses weighted heavier, reinstatements credit remaining months, self-expiring at 24mo) that Tatil is seeking approval on — **not ratified**, proposal-stage only. Design authority: `docs/design-system/proposals/persistency-v2-PROPOSAL/README.md` (states plainly it is proposal-stage, distinct from the canonical `docs/design-system/screens-v2/`), containing the four `persistency-v2-*.jsx` manager-surface mockups + `persistency-v2-calc-methodology-PROPOSAL.pdf` (the draft methodology). The existing `persistencyV2` feature flag gates the UI shell only, not the calc model.

**Phased, all gated on Tatil ratification:**
1. **Calc engine** — CF-based, money-correctness-critical, attended. The FIRST deliverable is a **locked formula spec from Tatil actuarial**, not code. Do not build the formula from the draft circular/PDF — it may change on approval.
2. **Manager surface** — port the mockups only after the engine feeds real v2 numbers.
3. **Calc-model switch** — Company Config setting `persistency.calcModel: current|v2`, default `current`, added when the engine lands.

**Action:** none until Tatil ratifies the methodology. Do not build any part autonomously. Cross-reference: `docs/audits/design-conformance-2026-07-13.md` §5 item 2 / §8 (ABSOLUTE STOP — money/payout + `functions/` categories).

</details>

---

---

## ⚑ THE FLAKE IS A RACE, NOT CONTENTION — corrected characterisation, and the layer everyone has been fixing is the wrong one (banked 2026-08-02, v3 P0-E, MEASURED)

**Read this before touching a timeout, a pool setting, or a runner config.** Four rounds of remediation have now targeted contention. The measurement says contention is not the mechanism.

### The measurement that settles it

Three verbose runs on one CI runner (PR #890 diagnostic, closed). Every test in the flake record, **when it passes**:

| Test | r1 | r2 | r3 |
|---|---|---|---|
| `aggregate-on-save > isolates aggregation failure` | 661 | 663 | 648 |
| `daily streak > does NOT re-fire` | 657 | 703 | 668 |
| `DailyCaptureV2 > stepper "+"` | 266 | 240 | 258 |
| `AgentPlannerPanel > navigation is unlimited` | 123 | 161 | 158 |
| `MeetingMode > skip-logs the awards scene` | 90 | 94 | 126 |
| `daily streak > fires the takeover` | 90 | 96 | 102 |
| `aggregate-on-save > recomputes the weekly draft` | 46 | 48 | 49 |
| `MeetingMode > ArrowRight advances` | 41 | 36 | 40 |

**p50 ≈ 130ms · max 703ms.** No test in the entire 378-file suite exceeded **1000ms**.

### Why that means RACE and not contention

- **An awaited condition that never arrives, not one that arrives late.** Healthy runs finish in ~0.1s. Failures sit at the 5000ms timeout. There is no population in between — the gap is 7–50×, not a distribution tail.
- **The whole run does not drag when one test hangs.** #889 run 1 took **322s**, squarely in the normal band, and the failing test's neighbours ran at normal speed. Starvation would slow everything; one test hung while everything around it was fine.
- **The A2 cluster says the same in a different shape.** `Unable to find an element…` at **151 / 167 / 181ms** — expected state absent, detected *fast*. Not slow, absent.

### ⚠ The `5006 · 5006 · 5007 · 5008 · 5015 · 5027` cluster means ONLY that the timeout fired

**A timeout always reports ≈budget + detection overhead.** Those numbers say the 5000ms limit was hit. They say **nothing** about how close the chain was to completing, and reading them as "6 to 27 milliseconds past the cliff" — as this document previously did, and as the dispatcher's own analysis did — leads directly to the wrong layer. It is what motivated a margin argument the data cannot support. **Do not reason from that cluster again.**

### ⚠ PR #888 was NOT a controlled experiment

It was presented as one, by both dispatcher and CC. It is **three n=1 samples of a stochastic outcome** (measured failure rate **37%** in the v3 window — see § Measured failure rate below). Controlling the inputs does nothing about variance in the *result*. Its three data points (default FAILED 272s / `maxForks:2` passed 304s / `maxForks:1` passed 521s) establish far less than they were treated as establishing.

**The falsification that proves it:** `maxForks: 2` was green in #888 at **00:15–00:34 UTC** and red in #889 run 1 at **01:15 UTC** — same setting, ~45 minutes apart. **We therefore have no reliable evidence that fork count affects the failure rate at all.**

### Measured failure rate — the baseline was never ~50%, and every inference from that number was drawn from a wrong one

**100 CI runs / 119 attempts, 2026-07-07 → 2026-08-02**, from the GitHub API rather than impression:

| Window | Attempts | Red | Rate | Runs reran |
|---|---|---|---|---|
| **Since 2026-07-29 (v3 window)** | 27 | 10 | **37.0%** | 5 of 22 |
| **Before 2026-07-29** | 92 | 18 | **19.6%** | 14 of 78 |

**Method:** `gh api actions/workflows/ci.yml/runs`, `per_page=100`. Red attempts = `sum(run_attempt) − count(runs concluding success)`, which is exact **given full re-runs**.

**⚠ Caveat, recorded:** any `gh run rerun --failed` in the history inflates `run_attempt` without being a full suite attempt, so the true rate may be **slightly below** these figures.

**Three corrections — this supersedes every "~50%" in the record:**

1. **The rate was never ~50%.** Every inference either party drew from that number came from a wrong baseline.
2. **Five consecutive greens is ~10% by luck at 37%, not the ~3% claimed at 50%** (`0.63⁵ = 9.9%` vs `0.5⁵ = 3.1%`). The five-run standard was **weaker than stated** when it was set.
3. **#887's four consecutive reds is 1.9% at 37%** (`0.37⁴`). Notable as one sequence, unremarkable across 119 attempts. An impression from a single PR was never going to establish a rate — including CC's own "suggests worse than 50%" read, which this measurement replaces.

**Two other artefacts still carry the superseded figure and are deliberately NOT edited:**
- `docs/briefs/v3-p0b-activity-ledger-kickoff.md:141` — *"flaking at roughly one episode in two runs"*. A landed brief is a **Rule 10 audit trail**; rewriting it would falsify the record of what was actually dispatched. Read it against this section.
- `src/lib/__tests__/activityLedger.test.js:17-18` — the same phrasing in the property-budget comment. **Ruled 2026-08-02: leave it, do not spend a PR on it.** The comment's **conclusion survives the correction** — capping `numRuns` because CI is flaky is still sound at 37% — and only the *cited rate* is stale. A one-line comment fix does not justify a CI cycle at a 37% red rate, and folding it into P0-C would widen an unrelated diff. **Tagged: fold into the next PR that touches `src/lib/__tests__/activityLedger.test.js`** — realistically Phase 2.1, which owns the `contacts` field on the `CALLS` row.

### ⚠ SUGGESTIVE, NOT ESTABLISHED — the rate roughly doubled in the v3 window

19.6% → 37.0%. Two-proportion **z ≈ 1.9, p ≈ 0.06 at n=27**. **Do not treat this as fact.** It does not clear conventional significance and the v3 sample is small.

**If it is real**, the likeliest mechanism is that the flake **scales with suite size** — P0-A and P0-B both added test files — which fits a per-assertion race exactly: more `waitFor`/`findBy` sites means more chances to lose it, so the per-*run* failure rate rises even though the per-*assertion* rate is unchanged. That prediction is testable and it is uncomfortable, because it implies **further worsening as Phase 1 lands**.

**Action for whoever lands P0-C and P0-D: recompute this same statistic afterwards, by the same method.** If the rate climbs again, the race investigation below should be **promoted ahead of Phase 1** rather than queued behind it.

### Superseded — do NOT retry, each with its reason

| Approach | Why it is dead |
|---|---|
| Raising `asyncUtilTimeout` | Pulled **twice** blind (1000 → 2000 → 5000). And now measured: chains run at ≤703ms against a 5000ms budget — **~7× headroom already**. There is no margin problem to fix. |
| Per-test `it(…, ms)` widening | #872's remedy. Raised a ceiling that is not binding; its own fixed tests re-fired afterwards. |
| Sharding across runners | Costed for a 2-vCPU runner. The runner is **4 vCPU / 16.8 GB** (public-repo class), so each shard would still need capping — an addition, not an alternative. |
| `maxForks` capping | Tried at 2 on PR #889 and **falsified within an hour**. Cap engagement was *proven* (max concurrent vitest procs: 6 uncapped vs 4 capped, same machine — a clean 2-worker delta), so the config worked and the failure happened anyway. Costs +32s/run forever for unproven benefit. **PR #889 closed unmerged.** |
| `isolate: false` | 378 files, shared mocks, a globally-configuring `test-setup.js`. Silent cross-file contamination is strictly worse than a flaky gate. |

### The open question — this is the next investigation, and it is NOT started

**Why does the awaited condition sometimes never arrive?** That is a race inside the component-under-test or its mocks, not a property of the runner.

Density correlates with *exposure* but is not sufficient: `AgentPlannerPanel.test.jsx` has **163** `waitFor`/`findBy` sites and 3 members, `DailyCaptureV2.test.jsx` has **63** and 5 members — but `MeetingMode.test.jsx` has only **9** and still contributes 2. More async assertions means more chances to lose the race; it does not explain the race.

Ruled out along the way, so nobody re-chases it: `DailyCaptureV2.test.jsx`'s partial fake timers (`vi.useFakeTimers({ toFake: ['Date'] })`, present in every one of its failing describes) are **safe**. `waitFor` uses real `setTimeout`/`setInterval`, and its fake-timer detection requires `typeof jest !== 'undefined'`, which is false under vitest without `globals` — so `waitFor` takes the real-timer branch. The file's own comment is correct.

**See § Race investigation below — it needs test-file access and its own brief.**

---

## Flip `a11y-contrast` from REPORTING to BLOCKING once the enumerated failures are cleared (banked 2026-08-02, v3 P0-D, MEDIUM)

The sweep landed **non-blocking on purpose** (brief §3): pre-existing failures predate it and are not its to fix, and a slice that lands a gate *and* a pile of unrelated fixes cannot be reviewed as either. **The job name says its mode** — `a11y-contrast (reporting)` — because a gate that is quietly non-blocking is worse than no gate.

**To flip it:** drop `continue-on-error` from the job, pass `--blocking` to the sweep, and **rename the job in the same commit** so the name never lies about the mode.

**Blocking on:** the one failure below. When it is cleared (or explicitly accepted), flip.

### Pre-existing failure enumerated by the first run — NOT this slice's to fix

| Element | Theme / state | Measured | Needs |
|---|---|---|---|
| `span.topbar-search-placeholder` — "Search…" | light / default | **4.13:1** | 4.5 |

This is the **Topbar light-mode failure the P0-D brief lists as explicitly out of scope** — *"deliberately left; it needs a design-system change, not an app-level override."* The sweep rediscovering it independently, with a measured ratio the brief did not supply, is a useful check that the measurement is real rather than self-confirming.

Two known failures from prior work were **not** reproduced by this run and should not be assumed fixed — they are on surfaces this sweep does not yet visit (`DataSourceBadge` "Estimated" in light, `AgentProductionView` hero avatar in dark). Widening the route list is the natural next increment.

---

## `a11y-contrast` sweep covers two routes — widen it (banked 2026-08-02, v3 P0-D, LOW)

The sweep visits **login** (unauthenticated) and **dashboard** (authenticated), in both themes, measuring default / `:focus-visible` / `:disabled`. First run: **117 elements** — 99 default, **18 `:focus-visible`**, 0 `:disabled`.

**Why `:disabled` measured zero, and why that is not a defect in the sweep.** The swept routes have no *persistently* disabled text control. `LoginScreen.jsx`'s disabled states are transient (`disabled={submitting}`, `disabled={resetLoading}`) and are true only mid-request. The disabled measurement path is **proven working** — the P0-D planted failure was a disabled control and was caught at `[dark/disabled] 2.5:1` — but on the current routes it has nothing real to measure.

**Next increment:** add routes with persistently-disabled controls and with the semantic-tint surfaces where this defect class concentrates (the wizard, manager surfaces, the money card). The existing `a11y-axe-scan.cjs` covers 8 agent pages and `-manager.cjs` covers 9; their page lists are the obvious source. Each added route costs wall-clock on a paths-filtered job, so add deliberately rather than wholesale.

**A second cause of the zero, from the CodeRabbit review on #893 — a better diagnosis than the one above, recorded verbatim because it is the part the P0-D author missed.** The collector keeps only elements with **own text**, and reads `disabled` from `el.matches(':disabled')` on that *same* element. A disabled control whose label sits in a child element therefore fails **both** tests at once: the control itself has no own text, and the text-bearing child does not match `:disabled`. So `<button disabled><span>Save</span></button>` — the ordinary React shape — is invisible to the disabled sweep regardless of which routes are added. Widening routes alone will NOT fix this.

Fix shape: propagate the disabled state from the nearest ancestor (`el.closest(':disabled') !== null`, plus the `aria-disabled` equivalent) rather than testing only the text-bearing node.

**Do NOT pair this with a zero-disabled hard-fail guard until after it lands.** The sweep already hard-fails on zero `:focus-visible`; the symmetrical guard for `:disabled` is deliberately absent because it would **red the job today**, which contradicts the reporting-first mode ruling 14b asked for. Sequence: propagate first, confirm a non-zero disabled count in CI, *then* add the guard.

## `a11y-contrast` sweep runs without the functions emulator — CF-dependent UI is unswept (banked 2026-08-02, v3 P0-D review, LOW)

The console/network capture added in `038478f0` immediately surfaced something the sweep had been hiding: the job runs `firebase emulators:exec --only auth,firestore`, so **`resolveSalesManagerUid` is CORS-blocked** and any UI behind a Cloud Function call never renders into the swept DOM.

```
[error] Access to fetch at 'https://us-central1-demo-agencytrack.cloudfunctions.net/resolveSalesManagerUid'
        from origin 'http://127.0.0.1:4173' has been blocked by CORS policy
```

Environmental, not an app defect — and note the blocked host is **`demo-agencytrack`, not `agencytrack-2a610`**, which is independent confirmation that the emulator-mode build has no production reach.

Two consequences worth separating:

1. **Coverage.** Whatever the CF gates is simply not measured. The sweep's element count is therefore a floor, not a ceiling.
2. **Legibility.** This was invisible before the capture landed — the sweep reported a clean run over a partially rendered DOM, which is exactly the failure mode the capture convention exists to prevent.

**Next increment:** add `functions` to the `--only` list and the functions build to the job, *or* explicitly stub the CF call in emulator mode. Adding the functions emulator costs a functions build in CI, so weigh it against the route-widening item above — they should probably land together.

**Also seen in the same capture, and benign:** `_vercel/insights/script.js` and `_vercel/speed-insights/script.js` 404 under `vite preview` (Vercel injects them only on Vercel), and `icons.svg` 404s. None affect measurement; recorded so the next reader does not re-diagnose them.
## `SyncIndicator` shows connectivity, not pending writes — wire it with the first real `commit()` caller (banked 2026-08-02, v3 P0-C ruling 13b, LOW)

[`src/components/ui/SyncIndicator.jsx`](src/components/ui/SyncIndicator.jsx) is a `navigator.onLine` badge and nothing more: it listens for `online`/`offline` window events and renders "Offline". **It cannot tell a user whether their write actually landed** — only whether the browser thinks it has a network.

`src/lib/commit.js` now exposes `isSyncing()`, and the Firestore SDK (firebase `^12.12.1`) exports two candidate APIs, both confirmed present:

- **`waitForPendingWrites(db)`** — resolves when all pending writes have been acknowledged by the backend. Promise-shaped, so it answers "are we settled *now*" rather than driving a live indicator.
- **`onSnapshotsInSync(db, cb)`** — fires when all snapshot listeners are in a consistent state.

**Why this was NOT built in P0-C** (brief §1 offered it as in-scope-if-simple; it isn't). `onSnapshotsInSync` is **listener-relative**, not a parameterless "is anything pending?" query — it reports consistency across *active listeners*, so wiring it correctly means attaching it where writes are actually issued. Right now that is **nowhere**: `commit()` exists but nothing calls it until P0-F. Building the indicator first would mean choosing an attachment point before there is a caller to attach it to, and guessing wrong is how a status light ends up lying — which is worse than the honest connectivity badge that exists today.

**Do this with the first real `commit()` caller (P0-F `scheduleTask`)**, when there is a concrete write path to observe. At that point decide whether the badge surfaces `isSyncing()` (in-process, immediate, misses SDK-queued writes from a previous session) or a real SDK signal (accurate, but needs a listener attachment point). A badge that reports "synced" while `persistentLocalCache` still holds an unacknowledged write is the failure mode to avoid.

---

## The v3 boundary rule matches import PATHS, not bindings — a re-export evades it (banked 2026-08-02, v3 P0-C, LOW)

`eslint.config.js`'s `no-restricted-imports` rule bans components from importing the named v3 services **by import path**. A component that reached `activityLogService` through a **re-export from some other module** — `export { log } from '../services/activityLogService'` in a barrel or helper, then imported from there — would **not** be caught. ESLint matches the specifier the component writes, not the binding it ultimately resolves to.

**No such re-export exists today** (verified at banking time), and nothing about the current code is wrong. This is recorded so that if one is ever introduced it gets caught **by review** rather than by nothing — the rule's silence would otherwise read as approval.

**If it needs closing later**, the options are an import/no-restricted-paths rule operating on resolved paths, or a lint plugin that follows re-export chains. Neither is worth adding while the answer is "zero occurrences"; the point of this entry is that a future occurrence has somewhere to be checked against.

Same family as the [enforcement-mirror](src/actions/README.md) note: the rule is the machine-checked half of a contract, and knowing precisely what it does *not* check is part of trusting what it does.

---

## Race investigation — why does the awaited condition never arrive? (banked 2026-08-02, v3 P0-E ruling 11c, MEDIUM — own track, NOT started)

**Do not start this without a brief.** It is the successor to the corrected characterisation above, and it is deliberately *not* part of any Phase 0 recon.

**Why it needs its own track:** every brief in the v3 sequence has forbidden touching test files. This investigation **requires** it — the race is inside the component-under-test or its mocks, and it cannot be characterised from the outside. Smuggling that into a config slice is how the last four rounds landed at the wrong layer.

**Starting evidence** is the entry above: p50 130ms / max 703ms; failures at the timeout with normal run wall-clock; the A2 element-not-found cluster at 151–181ms; density correlating with exposure but not sufficient.

**First questions for whoever picks it up:** which awaited condition is absent in each failing case (the DOM node, the mock resolution, or a state update that never commits)? Do the failures share a mock shape — e.g. an unresolved promise from a Firestore stub — rather than a component? Is there an unawaited state update that usually lands before the assertion and occasionally does not?

---

## CI-vs-local test-timing gap — Tier-0 error-state tests can pass locally 5x, fail in CI (banked 2026-07-16, MEDIUM — test-infra audit)

PR #861 fixed two CI-only failures in `AgentAwardsPanel.test.jsx` (from the Run-6 Tier-0 four-states sweep) that passed locally 5/5 runs before any fix. Two distinct mechanisms, both worth auditing for across the rest of the Tier-0 error-state test population:

1. **Latent `waitFor`-resolves-early bug:** `await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))` can resolve on its very first (synchronous) check when the mock was already called earlier in the same render pass (e.g. inside a mount effect) — this does NOT guarantee a subsequent async state-update → re-render chain has committed. A bare DOM query (`document.querySelector` / non-awaited assertion) immediately after such a `waitFor` races that chain. Fix: use `await screen.findByTestId(...)` (or wrap the assertion itself in `waitFor`) instead of trusting the call-count `waitFor` to have waited for anything beyond the call itself.
2. **Shared `asyncUtilTimeout` budget under CI parallel-load contention:** `src/test-setup.js` sets `configure({ asyncUtilTimeout: 5000 })` globally, tuned for CI resource contention under full-suite parallel runs. A test whose critical path chains multiple render cycles behind one `waitFor`/`findBy*` call can still occasionally exceed that shared budget under worst-case CI load even when it resolves in <50ms locally — this is not a test bug, but such tests may need their own wider per-test timeout (the `it(name, fn, timeoutMs)` third argument) rather than either ignoring the flake or raising the global budget for every other test in the suite.

**Action:** before Tier-0 error-state tests (four-states/swallow-disposition sweep, Run 6/7) are relied on to gate a future promotion, audit the other panels in that sweep for pattern 1 specifically (bare DOM query immediately after a call-count-only `waitFor`) — it is silent until CI scheduling happens to expose it, exactly as it did here. Pattern 2 is lower-risk (already has a documented, CI-tuned budget) but worth spot-checking for any test whose critical path is unusually long (2+ chained render cycles).

**Annotation (Run A Tier 2, 2026-07-24) — the `AgentPlannerPanel` A5 bulk cluster exhibits pattern 2.** During E1, two separate full `vitest run` invocations each failed exactly ONE `AgentPlannerPanel.test.jsx` **"bulk operations (Run 9 A5)"** test — a **different** test each run (first the R6 >200-cap-tick gate, then "pushes ONE undo entry per bulk op") — under heavy local parallel load (`environment` ~1400s). The same file passes **68/68 in isolation ×3** and the A5 bulk subset **15/15 ×3**. Non-deterministic, different-test-each-time = pattern 2 (shared `asyncUtilTimeout` budget exceeded under parallel-load contention), not a logic bug: the E1 changes are inert in the jsdom mobile path these tests exercise (`useIsDesktop` no-ops without `matchMedia`; the board never mounts). When this cluster is audited, the candidate fix is a **wider per-test timeout** (`it(name, fn, ms)`) on the multi-render-cycle A5 bulk tests, not a global budget raise. **Second observation (Run A Tier 3 fix branch, 2026-07-24):** adding 2 tests to `AgentPlannerPanel.test.jsx` tipped ONE file-level run into failing both an A5 bulk test AND the A2 `"e opens Edit for the focused … card"` test; both passed in isolation and the file then ran 73/73 twice. Note the A2 failure is a *different* mechanism from pattern 2 — it failed in 31ms (an assertion, not a timeout), i.e. the commit→effect-resubscribe race its own source comment documents (`AgentPlannerPanel.jsx`, the `selected`-prune effect note). Audit both together: A5 wants a wider timeout, A2 wants a deterministic wait on the keydown listener being re-subscribed.

**Third instance — and the first PROVEN in CI (2026-07-25, PR #868).** `DailyCaptureV2.test.jsx > daily streak celebration (integration) > "does NOT fire below the milestone (short streak)"` failed in CI with `AssertionError: expected "spy" to be called at least once` (361 files passed, 1 failed) on a **verification-only PR** that touched three `scripts/verification/*.mjs` smokes + two docs — i.e. nothing the unit suite loads, so the change cannot be causal. It passed locally in isolation AND as the full 48-test file, the identical file had passed CI on #867 an hour earlier, and **re-running the failed CI job with zero code change went green** — the cleanest flake proof available. So the family is now three tests across two files (`AgentPlannerPanel` A5-bulk + A2-`e`, `DailyCaptureV2` streak-celebration), all pattern 2.

**Why this now matters more than "just re-run it":** three flakes in one session means a red CI on this repo no longer reliably distinguishes a real regression from scheduling noise, which erodes the merge gate itself. When audited, prefer the per-test timeout (`it(name, fn, ms)`) on these specific multi-render-cycle integration tests over raising the global `asyncUtilTimeout` for all ~5600 tests, and consider recording each confirmed flake here so the pattern-2 population is enumerable rather than anecdotal. (Distinct from the Windows *concurrent-run* worker-contention flake below, which is about launching two `vitest run` processes at once; this is a single run's internal parallelism.)

---

### AUDIT PERFORMED 2026-07-25 — branch `chore/pattern2-flake-audit` (PR into `staging`)

The four named tests were characterized individually and fixed individually. **The audit found the family is not one mechanism but three**, and it **corrects the remedy this FU previously prescribed for one of them**.

**Fourth data point (and the correction).** `DailyCaptureV2 > "does NOT fire below the milestone (short streak)"` — the CI failure on #868 — is **not** governed by the shared global budget at all. Every `waitFor(() => expect(onClose).toHaveBeenCalled())` in that file passed **`{ timeout: 2000 }`**, which overrides the CI-tuned `asyncUtilTimeout: 5000` (`src/test-setup.js`) **DOWNWARD**. The close path is `DailyCaptureV2.jsx:822` — `if (!celebrating) setTimeout(() => onClose?.(), 600)` — so ~600ms of the 2000ms budget is a fixed timer before the assertion can ever pass; under parallel-load contention the render+save+timer chain overruns 2s while 3s of the intended budget goes unused. **This means the previously-prescribed remedy — a wider per-test `it(name, fn, ms)` timeout — would NOT have fixed this one**: the inner `waitFor` caps itself regardless of the test-level budget. Fix applied: drop the self-narrowing override at all 5 sites in that file so they inherit the global. That RAISES nothing; it stops those tests opting OUT of a budget already tuned for CI.

**Confirmed population of the self-narrowing family: at least TWO of the five DailyCaptureV2 sites have now fired in CI** — `"does NOT fire below the milestone (short streak)"` (#868) and `"does NOT re-fire when the 5-day milestone marker is already set"` (#871, at 2042ms — see the confirmation note below). All five are fixed together here precisely because they are the same one-line defect repeated.

**Suite-wide sweep for the same self-narrowing shape** (`waitFor` options below the 5000ms global): exactly **6 sites**, 5 of them the DailyCaptureV2 ones now fixed. The residue is **`CompliancePanel.nudge.test.jsx:59` — `const CHIP_WAIT = { timeout: 3000 }`**, same shape, same latent exposure, not yet a confirmed flake. Left unchanged (out of this branch's scope); flagged here so it is not re-discovered from scratch if it fires.

**A2 `e` shortcut — genuinely a different mechanism, now fixed at the mechanism.** Failure signature was an **assertion at ~31ms, not a timeout**, so no timeout change could have helped. The document keydown listener (`AgentPlannerPanel.jsx:1086-1161`) has a large dep array including `resolveAppt` / `moveCardFocus`, so it tears down and re-subscribes as appointment data lands. The test did `await waitFor(card in document)` — which resolves on the FIRST commit containing the card — then a bare `.focus()` and a **synchronous** `fireEvent.keyDown(document, …)`. Against a not-yet-re-subscribed (stale-closure) listener, `resolveAppt(id)` returns null and the handler bails silently. Fix: `await userEvent.keyboard('e')` — async and act-wrapped, so pending passive effects flush before dispatch. This is what makes the neighbouring `Enter` test immune, and it is a **determinism** fix, not a longer wait.

**A5 bulk pair — confirmed pattern 2, fixed per-test.** Both are single long multi-render chains inside **vitest's default 5000ms per-test timeout, which happens to equal the global `asyncUtilTimeout`** — so no individual `waitFor` needs to exceed its own budget for the TEST to time out. The cap-gate test renders 201 cards then shift-range-selects across them; the undo test chains **five** sequential `waitFor`s. Both widened to `it(…, 20000)`. Assertions byte-identical.

**Every fix was negative-controlled** — production behaviour was broken and each test confirmed to FAIL, proving no fix was made vacuous: `e` handler early-return → `e` test fails · `canConfirm` cap gate removed (`BulkCancelConfirmSheet.jsx:25`) → cap-gate test fails · bulk undo inverse writing `updates` instead of `priors` → undo test fails · `onClose` close-path disabled → streak test fails. All four breaks reverted; `git diff` clean after each.

**Pattern-1 re-audit (the FU's own Action item) — result: NO recurrence found.** Scanned every `.test.jsx` for the PR #861 shape (a bare DOM query immediately following a call-count-only `waitFor`). All ~30 hits are one of: an assertion on the **mock object** (`toHaveBeenCalledWith`, `.mock.calls[…]`) — structurally immune, no re-render dependency; or a **negative** DOM assertion (`.not.toBeInTheDocument()` / `.toBeNull()`) gated by a precondition that makes the wait meaningful (e.g. the streak tests' `onClose` only fires when `!celebrating`, so the wait itself proves the branch). **No positive "expect element present" DOM query racing a re-render was found outside the already-fixed #861 sites.** *Limits of this claim (falsification):* the scan was a 2-line-lookahead regex over `.test.jsx` only, so a bare DOM query 3+ lines after the `waitFor`, or one reached via a helper function, would not have been caught. Overturned by any future CI-only failure whose error is "unable to find element" immediately after a call-count `waitFor`.

**FIFTH data point — 2026-07-27, PR #878 CI — and it OVERTURNS the pattern-1 re-audit above.**

`DailyCaptureV2.test.jsx > 'stepper "+" increments the bound storage key and Save writes it'` failed **in CI only** (`lint-and-build`, run `30282874572`). Local: the same commit ran the full suite **5842/5842 green**. Error, verbatim:

> `→ Unable to find an accessible element with the role "button" and name /FFIs conducted increase/i`

The shape:

```js
render(<DailyCaptureV2 onClose={vi.fn()} />);
await screen.findByTestId('dcv2-save');                                    // resolves on the FIRST commit carrying Save
const inc = screen.getByRole('button', { name: /FFIs conducted increase/i }); // BARE query — the stepper rows commit later
```

**This is pattern 1** — a bare positive DOM query racing a re-render — and it is **outside the #861 fix set**, which the re-audit above concluded did not exist. That paragraph stated its own falsifier:

> *"Overturned by any future CI-only failure whose error is 'unable to find element' immediately after a call-count `waitFor`."*

Consider it overturned. **The reason the scan missed it is instructive and should shape the re-scan:** the audit's regex looked for a bare query following a **call-count `waitFor`**. Here the preceding await is a **`findByTestId`** — a *different* element's presence gate. That is the same defect (waiting on element A, then synchronously querying element B, which commits on a later paint) but it does not match the searched shape at all. `DailyCaptureV2` loads company minimums / weekly floors on a separate async path from the Save button, so Save can paint a frame before the stepper rows exist.

**Corrected scan shape for whoever closes this FU:** any bare `getBy*` / `queryBy*` for element **B** following an `await findBy*`/`waitFor` on element **A**, where A ≠ B. The mock-object carve-out in the re-audit ("structurally immune") still holds — the assertion that failed here is a DOM query, not a mock assertion — but the carve-out was doing more work than it should have, because it was applied to a scan that never looked at `findBy*` gates.

**Not fixed in #878** — out of that PR's scope (planner activity types; `DailyCaptureV2` shares no module with its diff, and its own second commit touched only the planner sheet, seeder, smoke and docs). Recorded here as the FU's own evidence. Fix when this FU is worked: gate on the element actually being queried (`await screen.findByRole('button', { name: /FFIs conducted increase/i })`), and re-scan under the corrected shape above.

**SIXTH data point — 2026-07-27, the #879 smoke-fix branch — #872's fixed tests re-fire LOCALLY but held in CI.**

⚠ **Read the CI result before acting on this entry.** An earlier draft of this note claimed "#872's own fixes are re-firing" full stop. That **overstated the evidence** and is corrected here: the identical tree then passed `lint-and-build` **green in CI** (run `30293147196`), i.e. the full suite ran clean on GitHub's runner. So the accurate claim is narrower — *these tests re-fire under contention heavier than CI's*, not *the fixes regressed*. The correction is left visible rather than rewritten away, because the overstatement is itself the lesson: a local-only failure streak is weak evidence until CI is checked, and it is easy to bank a confident-sounding conclusion from it.

What remains genuinely useful is that the observing branch **changed only `scripts/`** (a smoke file + `SMOKES.md`) — **zero `src/` files**. A test failure on such a diff is *definitionally* not caused by the change, which removes the usual attribution ambiguity even though the failures turned out to be environmental.

Across three consecutive local full-suite runs on one unchanged tree:

| Run | Result | Failing test |
|---|---|---|
| 1 | 5842/5843 | `MeetingMode > agenda rail is shown on the agent scene` |
| 2 | 5841/5843 | `MeetingMode > skip-logs the awards scene…` **+** `AgentPlannerPanel > A5 > undo after a bulk move writes back each doc's PRIOR date` |
| 3 | 5842/5843 | `AgentPlannerPanel > A2 > 'e' on a focused SERIES card raises the SeriesEditChoice…` |

Both failing files pass **85/85 in isolation** on the same tree.

**Two of these are tests #872 explicitly fixed and declared closed:**
- the **A2 `e` shortcut**, fixed at the mechanism (`await userEvent.keyboard('e')`, an act-wrapped async dispatch replacing a synchronous `fireEvent.keyDown` against a possibly-stale listener), and
- the **A5 bulk pair**, widened to `it(…, 20000)`.

Both fired again locally. Given CI held, the defensible reading is that the remedies **raised the threshold without removing the race** — sufficient for CI's contention level, not for a heavier one. Note the A5 undo test failing *despite* a 20 s per-test budget: that is not a budget problem at all, so the "widen the timeout" class of fix is the wrong tool for that one specifically, independent of how contended the machine is.

**No failure repeated across runs** — the population rotates, which is the signature of a shared environmental contention effect rather than four independent per-test bugs. Worth considering whether the real remedy is at the runner level (`maxConcurrency` / pool sizing / `fileParallelism`) rather than per-test, since chasing individual tests has now produced two rounds of fixes that did not hold.

*Environment note, offered as a confound rather than an excuse:* this machine was running three worktrees with installed `node_modules`, and an `npm install` had crashed with `STATUS_STACK_BUFFER_OVERRUN` (`0xC0000409`) shortly before. Contention was plausibly higher than CI's. That does not explain the A2/A5 recurrence away — CI is also contended — but it should be weighed before concluding the fixes regressed rather than were never sufficient.

**Not fixed here** — scripts-only branch. Recorded as the FU's own evidence, per note 3's instruction to capture the identity of any observed full-suite failure.

**Not done / weaknesses to carry forward:**

1. **None of the four was reproduced locally on demand.** They are load-dependent by nature; the fixes rest on mechanism analysis plus negative controls, not on a red-to-green reproduction. Real confirmation is the absence of recurrence across subsequent CI runs.
2. **✅ DIAGNOSIS CONFIRMED IN CI, INDEPENDENTLY, HOURS LATER — with a timing smoking gun.** While this branch was in review, a **sibling** PR (`post-run-a/master-sheet-status`, #871 — cut from the same `staging` tip and containing NONE of these fixes) went red in CI on `DailyCaptureV2.test.jsx > daily streak celebration (integration) > "does NOT re-fire when the 5-day milestone marker is already set"`, **failing at 2042ms**. That test is line ~721 — **one of the five `{ timeout: 2000 }` sites this branch fixes**, and 2042ms is the 2000ms cap plus one poll interval. Its PR changed only Master Sheet code the daily-capture suite never loads, so the change cannot be causal. This upgrades the self-narrowing-`waitFor` diagnosis from *reasoned* to *empirically confirmed*, identifies a **fifth** member of the family, and demonstrates the fix on this branch would have prevented it. It also strongly suggests the unidentified local failure in note 3 was this same test.
3. **⚠ A local full-suite failure was observed on this branch and its identity was lost.** The first post-fix full-suite run reported `1 failed | 5644 passed (5645)` — one failing test whose name was **not captured** (the run's output was filtered before the failure block was read; a procedural mistake, not a tooling limit). Two subsequent full runs of the identical tree were **364/364 files, 5645/5645 green, exit 0**. So the observed rate on this branch is 1 failure in 3 full runs, source unknown. It is NOT one of the four fixed tests' known signatures being re-observed — that cannot be asserted either way without the name. **Whoever next runs a full suite should capture stdout to a file** (`npx vitest run > run.log 2>&1`) so the next occurrence is identifiable and can be added to the enumeration this FU is trying to build. The pattern-2 population should therefore be treated as **≥4, not exactly 4**.

**Sixth data point — captured by name, per note 3's instruction (2026-07-30, v3 P0-A baseline run).** The pre-edit baseline for `feat/v3-activity-metadata` (at `origin/staging` `7e2c112b`, before a single edit) ran **371/372 files · 5842/5843 tests**, with one failure: **`MeetingMode.test.jsx > MeetingMode — run-of-show > "ArrowRight advances from opening to the branch scorecard"`** — `Test timed out in 5000ms` at `MeetingMode.test.jsx:124`. Output was captured to a file, so unlike note 3's lost failure this one has a name.

Classification: **pattern 2** (shared-budget exhaustion under parallel-load contention), and a **new file** for the population — `MeetingMode.test.jsx` was not previously enumerated. Evidence: the run's `environment` figure was **3112s** (vs ~2295s on a later, lighter run of the same machine), and the file **passes in isolation in 1.57s of test time**. It did **not** recur on the post-change full run of the same tree (376/376 files, 0 failed). It is a bare 5000ms per-test timeout — vitest's default — not a self-narrowing `waitFor`, so it is the A5-bulk shape rather than the DailyCaptureV2 shape.

**Not fixed, and deliberately not touched** — out of scope for P0-A (which does not load `MeetingMode.jsx`; its only activity-code reference is a display header list at `:296`), and NOT folded into PR #872 per the standing instruction not to widen that PR's scope. Recorded here solely to grow the enumeration. Population is now **≥5 tests across ≥3 files**. It is also a fresh instance of the note-below concern: the failure sat in a slice whose diff cannot touch it, which is precisely why a red CI on this repo still does not cleanly separate regression from noise.

**Seventh data point — ⚠ #872's remedy raised the threshold but did NOT remove the race, now proven in CI (2026-07-30, PR #882).** `DailyCaptureV2.test.jsx > daily streak celebration (integration) > "does NOT re-fire when the 5-day milestone marker is already set"` — the SAME test as note 2's smoking gun — failed CI again, this time at **5007ms**, i.e. against the **5000ms global** `asyncUtilTimeout`, not the old self-narrowed `{ timeout: 2000 }` cap it failed at on #871 (2042ms). The self-narrowing fix therefore landed and worked as designed, and the test still times out; it simply needs more than 5s of wall clock under CI contention.

This **confirms the hypothesis already recorded above** ("the remedies raised the threshold without removing the race — sufficient for CI's contention level, not for a heavier one") and upgrades it from a local-only observation to a CI-proven one, on the single test the FU has the most history for.

Causality is excluded cleanly: the failing run's diff versus the immediately preceding **green** CI run on the same branch was **+14 lines in `src/utils/__tests__/devAssertKnown.test.js`** — a file `DailyCaptureV2.test.jsx` does not import, directly or transitively. **Re-running the failed job with zero code change went green** (`lint-and-build pass 5m19s`), the same proof shape note 2 relies on.

**Eighth data point — adding a test FILE tips the run, and a new member with an assertion-shape failure (2026-07-30, PR #882).** Committing `activityMetadata.contract.test.js` (a new file importing only `activityMetadata`, which nothing below imports) turned CI red on **two unrelated tests**: `AgentPlannerPanel.test.jsx > bulk operations (Run 9 A5) > "undo after a bulk move writes back each doc's PRIOR date"` (timeout, 5027ms — a known A5-pair member, still failing *after* #872 widened it to `it(…, 20000)`, since the 5000ms cap that bites is the inner `waitFor`'s) and `DailyCaptureV2.test.jsx > "stepper \"+\" increments the bound storage key and Save writes it"` — **failing at 167ms with `Unable to find an accessible element with the role "button" and name /FFIs conducted increase/i`**.

That second one is **not** previously enumerated and is **not** pattern 2: an assertion at 167ms is the **A2 mechanism** (query runs before the render it depends on commits), now confirmed in a second file. The population is therefore **two mechanisms, not one**, in `DailyCaptureV2` alone.

This is the **second independent confirmation of the tipping effect** already recorded above ("adding 2 tests to `AgentPlannerPanel.test.jsx` tipped ONE file-level run into failing both an A5 bulk test AND the A2 test") — and it is stronger, because here the added file is *not in the same file, module graph, or feature area* as either failure. Adding **any** test file raises whole-run contention and tips whichever tests are closest to their budget. That is a scheduling property of the run, not a property of the added test, and it is the clearest argument yet for the runner-level remedy over per-test widening. Both failures went green on a re-run with zero code change.

**NINTH data point — a flake on a diff containing NO CODE AT ALL. This removes the last ambiguity about causation (2026-07-31, PR #886).** The `main → staging` sync PR is **docs-only** — `CLAUDE.md` + `docs/`, zero files under `src/`. Its first CI pass failed on `MeetingMode.test.jsx > MeetingMode — run-of-show > "skip-logs the awards scene when nobody is within reach — deck lands on close at index 7"`, **`Test timed out in 5000ms`, measured at 5015ms**. Green on re-run with **zero change**.

Every prior data point still had *some* code or test delta to argue about, however tenuously. This one has none: there is no possible causal path from a Markdown edit to a React-render timeout. **The failure is contention, full stop** — a property of how loaded the runner is, not of what was committed.

Two further details worth keeping:
- It is the **second distinct test in `MeetingMode.test.jsx`** to fail this way, after `"ArrowRight advances from opening to the branch scorecard"` in the sixth data point (v3 P0-A baseline). That file now has two named members. `"skip-logs the awards scene…"` also appears in the run-2 row of the multi-run table above, so it was already a suspected member — this is its first *named, CI, reproduced-and-cleared* observation.
- **5015ms against the 5000ms global** is the same signature as the seventh data point (5007ms) and the A5 member in the eighth (5027ms). Three separate tests now cluster within ~30ms of the cap, which is the shape of a budget that is simply too tight under contention rather than three unrelated races. **Reinforces that #872 raised the ceiling without removing the race** — and strengthens the case for the runner-level remedy (`poolOptions` / `maxThreads`, currently absent from `vite.config.js` entirely, so the runner self-sizes to the machine) over a fourth round of per-test widening.

**TENTH data point — ⚠ ESCALATION: a single re-run no longer reliably clears it (2026-07-31, PR #887 — the PR banking the ninth point above).** #887 is also **docs-only** — `CLAUDE.md` + `docs/FOLLOW_UPS.md`, zero files under `src/` — and it went red on CI **twice on the same commit**, failing **different tests each time**:

| Run | Failing test | Time |
|---|---|---|
| 1 | `DailyCaptureV2 > "stepper \"+\" increments the bound storage key and Save writes it"` | 181ms — *element not found* (A2 shape) |
| 1 | `aggregate-on-save (Phase 2.2) > "isolates aggregation failure — the daily log still succeeds"` | **5006ms** |
| 2 (re-run, zero change) | `aggregate-on-save (Phase 2.2) > "recomputes the weekly draft after a successful daily save"` | **5006ms** |

**A deterministic regression cannot fail different tests on successive runs of the same commit** — the non-determinism is proven by the runs themselves, not inferred. Confirmed locally: `DailyCaptureV2.test.jsx` passes **48/48 in 8.39s** of test time on this exact branch.

Three things this adds:

1. **`aggregate-on-save (Phase 2.2)` is a NEW describe block in the family** — two of its tests, not previously enumerated anywhere.
2. **The cap cluster is now five observations across four distinct tests:** 5006 · 5006 · 5007 · 5015 · 5027, all against the 5000ms global. Four unrelated races that all happen to land within 27ms of the same threshold is not a credible reading; one budget that is too tight under contention is.
3. **The mitigation is degrading.** Every prior episode cleared on one re-run. This one did not — which means "re-run and move on" is no longer a reliable workaround, and the cost is now landing on unrelated docs PRs.

The `DailyCaptureV2 > stepper "+"` recurrence (167ms on #882, 181ms here) also confirms the **A2 assertion-shape mechanism** is independent of the timeout mechanism and is *also* contention-driven — two mechanisms, one cause.

**Run 3 on #887 — six distinct tests, ZERO overlap across three runs, and the fact that breaks the workaround.** A third CI pass on the same docs-only PR (commit `8f29230a`) failed on **two more previously-unlisted tests**:

- `daily streak celebration (integration) > "does NOT re-fire when the 5-day milestone marker is already set"` — **5008ms**. This is the **same test as the seventh data point** (#882, 5007ms), recurring across PRs one millisecond apart.
- `AgentPlannerPanel — week navigation > "navigation is unlimited — three weeks forward keeps stepping"` — **151ms**, A2 element-not-found shape. New member.

**Full tally for #887 — three runs, six distinct tests, no test failing twice:**

| Run | Commit | Failures |
|---|---|---|
| 1 | `2fc8520d` | `DailyCaptureV2 > stepper "+"` (181ms, A2) · `aggregate-on-save > "isolates aggregation failure"` (5006ms) |
| 2 | `2fc8520d` *(re-run, zero change)* | `aggregate-on-save > "recomputes the weekly draft"` (5006ms) |
| 3 | `8f29230a` | `daily streak > "does NOT re-fire…"` (5008ms) · `AgentPlannerPanel week nav > "navigation is unlimited"` (151ms, A2) |

**THE STRONGEST SINGLE FACT IN THIS ENTRY: run 2 was a re-run of run 1's exact commit, and it failed DIFFERENTLY rather than passing.** Not "failed again" — *failed on a different test*. That is what a contention ceiling looks like when the whole suite sits near it: which test loses is a coin flip, so re-running relocates the failure instead of clearing it. It is also precisely what broke the "re-run and move on" workaround that had absorbed every prior episode.

Cap cluster is now **six observations across five tests** — 5006 · 5006 · 5007 · 5008 · 5015 · 5027 — all against the 5000ms `asyncUtilTimeout` global. The A2 assertion-shape mechanism has **three** — 151 · 167 · 181ms — across three different tests. Two mechanisms, one cause.

Verified locally on `8f29230a`: `DailyCaptureV2.test.jsx` **48/48**, `AgentPlannerPanel.test.jsx` **73/73 on two consecutive runs**. (A single local failure appeared mid-investigation — the `A2 'e' SERIES sibling` already named in this entry — while a full suite was running concurrently, then vanished. Local contention reproduces the same shape, so this is not CI-specific.)

**PR #887 is deliberately HELD as P0-E's acceptance test** (dispatcher ruling, 2026-08-01): docs-only, red three times in a row, sitting at the exact branch point where the problem was last observed. A **first-try green on #887 after the runner fix** is the acceptance evidence — worth more than any asserted number.

**Guard 1 scope note (banked 2026-07-30, PR #882, LOW — recorded, not chased).** The activity-code twin guard (`src/utils/__tests__/activity-code-twin-guard.test.js`) scans **production source only**; `__tests__` is excluded, matching `dark-ink-static-guard.test.js`. Deliberate: test files are full of mock appointment arrays (`[{type:'CI'},{type:'FFI'},{type:'PC'}]`) that are sample data, not classifiers, and are structurally indistinguishable from the real `WEEK_COUNTER_ROWS` twin — so allowlisting them would teach authors that the allowlist is where you go when the guard is annoying, which is how a guard gets tuned to uselessness. **Residual exposure:** a shared test helper or fixture module could host an unseen code twin, and if production ever imported such a helper the guard would not see it. Low risk (test-only blast radius today), recorded so it is not re-derived from scratch.

**Implication for the remedy.** Two rounds of per-test fixes have now each held only until contention rose. That is the third independent signal pointing at the runner-level suggestion already raised above (`maxConcurrency` / pool sizing / `fileParallelism`) rather than a third round of per-test budget widening — this test has now consumed two distinct per-test remedies and failed after both. Whoever picks this up should treat "widen it again to 20s" as the option to argue *against*.

---

## ~~The #899 flake fix lives on `staging` ONLY~~ — **RESOLVED 2026-08-16 by the promotion (`b4d9be7b`)** (banked 2026-08-16, PR #906 session, HIGH — CI/process)

> **RESOLVED — this FU's own falsification condition fired.** It said: *"Overturned if `git ls-tree origin/main -- src/test-utils/flushPendingEffects.js` returns a blob."* After the promotion it does:
>
> ```
> git ls-tree origin/main -- src/test-utils/flushPendingEffects.js
> 100644 blob b40922b9f9197359c6069b607a7b4a5a1ae7e952	src/test-utils/flushPendingEffects.js
> ```
>
> **Closed on the narrow claim only: the two fixes ARRIVED on `main`.** It is explicitly **not** closed as "the gate is clean" — see § *The flake family is ~10 members and #899 fixed TWO*, which remains **open** and is now the live entry for this subject. Nine-ish register members are untouched, and `BranchesPanel` failed on #907's own branch — a docs-only diff cut from `staging`, which already carried the fix. Expect intermittent reds on inert diffs against `main` and re-run to separate flake from regression.
>
> Body preserved below as the record of the pre-promotion state; the `git ls-tree` output in it is historical and no longer current.

**The claim, verified rather than inferred (AS OF 2026-08-16, PRE-PROMOTION — the first line is now stale):**

```
git ls-tree origin/main    -- src/test-utils/flushPendingEffects.js   → (empty — ABSENT)   ← no longer true
git ls-tree origin/staging -- src/test-utils/flushPendingEffects.js   → 100644 blob b40922b9…
```

PR #899 (`90a7718b`) closed the stale-keydown-closure defect — a defect class that had survived **six** remediation rounds — and it landed on `staging`. It has never been promoted. So **`main` still carries the bug**, and `CONTEXT.md` says so correctly ("FIXED on `staging` … NOT on `main`; this reaches production at the next promotion"). Nothing here contradicts the record; what is new is that the gap has stopped being theoretical.

### Why this is HIGH and not housekeeping

**Every dispatcher-tooling and command-file PR targets `main`, by definition.** `.claude/commands/`, `CLAUDE.md`, `docs/` process rules — none of that work can route through `staging`, because `staging` is where product work lives. So the class of PR that is *structurally forced onto `main`* is exactly the class that must clear `main`'s unit-test gate, and that gate is the unreliable one.

**#906 proved it on its own diff.** The PR changed **one markdown file** — `.claude/commands/post-merge.md`, +33/−10, no source, no test, no config the runner reads. Its first `lint-and-build` run went **red**:

```
FAIL src/components/daily/__tests__/DailyCaptureV2.test.jsx
  > daily streak celebration (integration)
  > does NOT fire below the milestone (short streak)
Error: Test timed out in 5000ms.
Tests  1 failed | 5842 passed (5843)
```

Re-run of the same job: **PASS** (4m1s). Intermittent, not deterministic — the signature of the defect #899 fixed.

**The cost, stated concretely.** A red on a `main`-targeted docs PR is now *uninformative*: it cannot be distinguished from a regression without a re-run plus a manual argument about why the diff could not possibly have caused it. That is precisely the condition #899 was celebrated for ending — "a red CI now means a regression rather than scheduling noise" — and it is still true on `staging` and still false on `main`. Every future command-file PR pays this tax, and each payment is an invitation to wave a red through on the assumption it is the known flake. **That habit is the actual risk, not the lost minutes.**

### The fix is promotion. It is NOT a cherry-pick.

**Do NOT cherry-pick `90a7718b` (or `27303333` / `5db36a12` / `c06fff0d`) onto `main`.** A cherry-pick creates a *duplicate commit* with a different SHA carrying identical content. At the next staging→main promotion, git sees both and the range conflicts — on `src/test-utils/flushPendingEffects.js` and on all 30 call sites that gained `await`. That converts a clean promotion into a manual conflict resolution across test files, which is a strictly worse position than the one this FU describes.

**The fix is a staging→main promotion**, which is already the standing mechanism and already carries this fix in its range. What this FU adds is a *reason to schedule one*, and a measurable one: the promotion is no longer only tidiness or feature delivery — it repairs `main`'s test gate, and every `main`-targeted PR before it runs against a gate known to produce false reds.

### Interaction with the other open promotion FU

This compounds with § *Promotion deletes `staging`* below — that FU makes promotions **risky to perform**, and this one makes them **costly to defer**. They should be settled together, in that order: fix the branch-deletion behaviour first, then promote. Settling only one leaves either an unreliable gate or a promotion that orphans open PRs.

### Falsification (Rule 23)

Overturned if `git ls-tree origin/main -- src/test-utils/flushPendingEffects.js` returns a blob (the fix reached `main`, by promotion or otherwise), **or** if a `main`-targeted PR with a provably inert diff runs the full suite green across a meaningful number of consecutive runs, which would mean the residual rate on `main` is low enough not to matter in practice. A single green run does **not** overturn it — the defect is intermittent, and that is the whole problem.

---

## Promotion deletes `staging`, silently orphaning every open PR onto `main` (banked 2026-07-26, PR #871 session, HIGH — process/CI, recurring)

> **UPDATE 2026-08-16 — the runbook WORKED, and the FU stays OPEN. Both halves matter.**
>
> The `b4d9be7b` promotion is the **first in four that did not delete `staging`**. Verified after the merge: `git ls-remote --heads origin staging` returns `b4d9be7b`, and `origin/main` / `origin/staging` are the same commit, 0 ahead either way.
>
> **Why it worked — the method, not luck.** The promotion was executed **on the CLI, not as a GitHub PR**, and `git push origin main:staging` ran immediately after the merge commit. The mechanism below requires a **promotion PR whose head branch is `staging`**; a CLI merge creates no PR, so there is no head branch for GitHub to delete. The four prior promotions — #860, #862, #874, #877/#881 — were all PRs with `head=staging`, which is exactly why they fired.
>
> **NOT marked resolved, and the reason is specific: the mechanism is still armed.** Verified the same day: `gh api repos/Kelsean868/agencytrack --jq .delete_branch_on_merge` → **`true`**, `default_branch` → `main`. The CLI method **avoids** the trap; it does not disarm it. The next promotion opened as a GitHub PR deletes `staging` again with no warning, and nothing in the repo configuration prevents that — the protection is entirely procedural and lives in an operator's memory of the runbook.
>
> **Downgraded HIGH → MEDIUM**, on the grounds that a working, evidenced avoidance now exists and the recurrence requires someone to choose the PR path. It is not closed, because "someone must remember" is the same class of guard this project has repeatedly banked rules against.
>
> **Resolution conditions — either one closes this:** (a) set `delete_branch_on_merge: false` at the repo level (costs the automatic head-branch cleanup that CLAUDE.md § Post-merge local cleanup currently depends on — that step would need rewording in the same change); or (b) make CLI promotion the binding standard in the runbook rather than a remembered practice, with the PR path explicitly forbidden for promotions. **(b) is the cheaper of the two and does not disturb ordinary PR cleanup.** Dispatcher's call; not actioned here.
>
> **Falsification of THIS update:** overturned if a promotion executed by CLI with the immediate re-push is nonetheless followed by `staging` disappearing, which would mean the mechanism is not the PR-head deletion described below.

**This is not hypothetical and it is not new. It has now fired twice, and on 2026-07-26 it put two PRs into `main` that had never passed the staging gate.**

### Mechanism

The repo has **"automatically delete head branches" enabled** (`deleteBranchOnMerge: true` — banked in CLAUDE.md § Post-merge local cleanup, where the documented `git branch -D` cleanup step *depends* on it). A staging→main promotion PR has `staging` as its **head** branch, so merging the promotion deletes `staging`.

GitHub's documented behaviour when a base branch is deleted is to **auto-retarget every open PR based on it to the repository's default branch** — here, `main`. No notification, no review request, no CI signal. The PR simply now says "into main".

### Confirmed blast radius (verified via the Timeline API, `automatic_base_change_succeeded` events)

| PR | Event timestamp | Outcome |
|---|---|---|
| #871 | 2026-07-26T19:13:32Z | Caught before merge. Retargeted back to `staging` + rebased in this session. |
| #872 | 2026-07-26T19:13:32Z | **MERGED INTO `main`** (`d3fe88e4`) — bypassed the staging gate. |
| #873 | 2026-07-26T19:13:33Z | **MERGED INTO `main`** (`0eb89f31`) — bypassed the staging gate. |

All three retargeted in the same second, on the #874 promotion merge. #872/#873 were docs+tests only, so the damage was procedural rather than functional — **that was luck, not a control.** The same event would have carried product code into production-tracking `main` just as silently.

Prior occurrence: `staging` was also deleted on the #860 promotion (recorded in CONTEXT.md — "the `staging` git branch no longer exists (deleted on PR #860 merge)"). It was treated as a one-off re-baseline chore rather than as this failure mode.

**CORRECTION 1 (2026-07-27) — it fired AGAIN, so this is confirmed recurring, not a coincidence.** `staging` was deleted a further time by `deleteBranchOnMerge` on the **#877** promotion merge. That is the second occurrence *of the deletion* since it was banked as a hazard (#874, #877), and the third counting #860. The pattern is now established beyond doubt: **every** staging→main promotion deletes `staging`, because the promotion PR's head branch *is* `staging` and auto-delete is unconditional. There is no version of this that does not recur.

`staging` has since been recreated and currently sits at `f51cf18b`, level with `origin/main` — verified this session. So the *branch* is healthy right now; what is missing is anything that makes it stay that way.

**The recommendation below is therefore upgraded: the promotion-runbook step is now a PRIMARY fix, not a "worth doing anyway" also-ran.** Immediately after any promotion merge, run:

```bash
git push origin main:staging
```

This recreates `staging` at the just-merged commit — which is exactly where a re-baselined `staging` should be — and closes the retarget window in one command, with no repo-settings change and no CI wait. It is the only mitigation that is available *today*, costs nothing, and needs no approval. The CI guard remains recommended as the enforcement layer (process alone has now failed three times), but the runbook step is what stops the bleeding between now and whenever the guard lands.

### The other 5 open PRs are NOT affected

Audited the same way — #825, #854, #621, #546, #543, #540, #398 carry **no** base-change event of any kind. They were cut against `main` originally and are simply stale (May 31 – July 11). They need triage, but not for this reason.

### Recommendation — CI guard (primary), and why not the alternatives

**RECOMMENDED: add a required CI job that fails any PR targeting `main` whose head branch is not `staging`** (plus an explicit escape hatch, e.g. a `promotion` or `hotfix` label, for dispatcher-authorised direct-to-main work).

**CORRECTION 2 (2026-07-27) — `main` DOES have branch protection. The premise below was wrong.** Verified live this session via `gh api repos/Kelsean868/agencytrack/branches/main/protection`:

| Setting | Actual value |
|---|---|
| `required_status_checks.contexts` | **`lint-and-build`, `functions-tests`** (2 checks, enforced) |
| `required_status_checks.strict` | `false` (branches need not be up to date with base) |
| `enforce_admins` | **`false` — admin-bypassable** |
| `allow_force_pushes` / `allow_deletions` | `false` / `false` |
| `required_signatures`, `required_linear_history`, `required_conversation_resolution` | all `false` |

Two things follow, and they pull in opposite directions:

- **The guard recommendation gets STRONGER, not weaker.** The original reasoning argued a CI job was the only enforceable mechanism *because* protection was unavailable. In fact a required-status-checks gate already exists and already works — so adding a third required context is a **proven mechanism on this repo**, not a hypothesis. That is a better argument than the one it replaces.
- **But protection does not solve this on its own.** Required status checks express "these checks must pass"; they cannot express "this base may only be targeted from this head." Branch protection has no base/head constraint, so it could never have caught the retarget. The guard is still needed — protection is the *delivery mechanism* for it, not a substitute.

`enforce_admins: false` also means the operator can bypass every check on `main`, so the guard is a seatbelt against mistakes, not a lock. That matches how CLAUDE.md already treats merge discipline (procedural, `--admin` forbidden by rule rather than by platform).

**Doctrine correction owed:** CLAUDE.md § Workflow states "Branch protection is not platform-enforced on this plan. Merge gates are procedural." The first sentence is false as written — the accurate statement is *"`main` has 2 required status checks but `enforce_admins` is off, so an admin can bypass them; treat merge gates as procedural."* Banked here rather than edited inline, because a CLAUDE.md doctrine change is a dispatcher call, not a side effect of this PR.

Reasoning — it satisfies all four constraints:
1. **It is enforceable here.** ~~Branch protection is not platform-enforced on this plan~~ — see CORRECTION 2 above: required status checks ARE enforced on `main` (admin-bypassable). A CI job registered as a required context is therefore a mechanism already proven to work on this repo.
2. **It guards the harm, not just one cause.** Auto-retarget is only one route to "wrong thing merges into main". The guard catches a hand-picked wrong base too.
3. **It would have caught #872 and #873.** Disabling auto-delete would have prevented the retarget, but nothing would have stopped a manually mis-based PR.
4. **It is version-controlled and reviewable** — it lives in `.github/workflows/`, is visible in diffs, and cannot be silently toggled off in a settings pane.

**Considered and NOT recommended:**

- **Disable "automatically delete head branches."** Directly prevents this trigger, but has wide blast radius for a narrow problem: the banked post-merge cleanup sequence explicitly relies on the auto-prune (`git branch -D` is documented as correct *because* the remote ref is already gone). Turning it off litters the remote with every merged feature branch and invalidates a documented rule. It also still permits a manually mis-based PR.
- ~~**Branch protection on `main`.** Unavailable — not platform-enforced on the current plan. This is already recorded doctrine.~~ **WRONG — corrected 2026-07-27 (CORRECTION 2 above).** Protection exists (`lint-and-build` + `functions-tests` required, `enforce_admins: false`). It is not a *substitute* here — required status checks cannot constrain which head branch targets `main` — but it is the mechanism through which the recommended guard would be enforced.
- **Change the repo default branch to `staging`.** Genuinely elegant: auto-retarget would then send orphans to `staging`, the correct destination, and new PRs would default correctly. Rejected as *primary* because it is a silent, wide-reaching setting change (clone defaults, new-PR defaults, and anything keying off the default branch) to fix a problem a guard addresses head-on. Worth revisiting as a **supplement** if the dispatcher wants belt-and-braces.
- ~~**Runbook step: recreate `staging` immediately post-promotion.**~~ **PROMOTED TO PRIMARY — 2026-07-27 (CORRECTION 1 above).** No longer filed under "considered and not recommended". `git push origin main:staging` immediately after every promotion merge is now the first-line fix: available today, zero cost, no settings change, no approval needed. It is still process rather than enforcement — pair it with the guard, do not rely on it alone — but with the deletion now confirmed on #860, #874 and #877, leaving the window open until a guard ships is the worse trade.

**Do not change repo settings from this session** — flagged for the dispatcher. The CI guard is the only item here that lands as a normal reviewable PR.

---

## Planner activity types — follow-ups banked 2026-07-27

Banked from the PR that added the nine hardcoded activity types (`PROP`, `PAPER`, `COLL`, `DEL`, `SEM`, `TRADE`, `MTG`, `TRAIN`, `ADMIN`). All five were surfaced during that work, ruled OUT of its scope by the dispatcher, and recorded here so the next author starts at build rather than at discovery.

### 1. MEDIUM — restore the VIOLET calls hue (Track J conformance)

The nine new types were assigned tone by **border style, not hue**: neutral SOLID = counts toward selling activity (`PC`, `SC`, `SEM`, `TRADE`), neutral DASHED = does not (`PROP`, `PAPER`, `COLL`, `DEL`, `MTG`, `TRAIN`, `ADMIN`, `FREE`). That extends the convention already shipping, and is deliberate — see the in-source comment in `plannerTone.js`.

It was *not* the first choice. The canonical mockups colour the calls family **violet**, and the app diverged with a reason recorded in `plannerTone.js`'s header comment:

> "The repo ships no violet token, so the handoff's violet 'call' hue maps to the neutral family (documented divergence)."

**That reason is now FALSE.** Everything needed to restore it is already in the repo:

- **The token ships, at exact DS parity, both themes.** `src/index.css:155-157` (light) and `:386-388` (dark) define `--ink-channels: 90 63 160` → `#5A3FA0` / `--color-ink-tint: #f0ecff`, and dark `169 149 224` → `#A995E0` / `rgba(169,149,224,0.14)`. Compare `docs/design-system/tokens/app.css:55` and `:124` — `--inkAccent:#5A3FA0; --inkAccentTint:#F0ECFF` and `--inkAccent:#A995E0; --inkAccentTint:rgba(169,149,224,0.14)`. Identical.
- **No Tailwind utility exposes it — a genuine name collision.** `tailwind.config.js:39-48` maps the `ink.*` scale to the TEXT tokens (`--text-channels` / `--text-muted-channels` / `--text-faint-channels` / `--ink-dim-channels`). `text-ink` is body text app-wide. The violet needs ONE new colour key; it cannot be reached today without inline styles, which the UI rules forbid.
- **Zero current consumers.** Grepping `src/` for `--color-ink` / `--color-ink-tint` / `ink-channels` returns only the definition lines. It is a dead token.
- **AA is NOT a blocker — already computed at chip size.** Violet on its own tint: **6.84:1** light; **4.88:1** dark (composited over `--color-surface` `#252019`). Both clear AA-normal.

**Scope when built:** `PC`, `SC`, `SEM`, `TRADE` change **together** (they are one family — that is the durable decision this PR locked; hue is the variable). Correct the now-false `plannerTone.js` header comment in the same change — it was deliberately left uncorrected here so the fix and the comment land together. **FIRST verify whether any test or smoke asserts `PC`/`SC` chip classes**, because that would break silently: `smoke-planner-activity-types.mjs` reads `borderStyle` per `data-type` (style-agnostic, safe), but the unit tests were not audited for class-level assertions.

Because the solid/dashed encoding is semantic and independent of hue, restoring violet **sharpens** the distinction rather than changing its meaning — SEM/TRADE inherit the calls hue automatically via `TYPE_TONE`.

### 2. LOW — planner duration reporting (the data is already there)

`durationMin` is a **required, rules-validated** contract field on every appointment (`plannerService.js` `clampDuration`, 1–720; `firestore.rules` `d.durationMin is int && d.durationMin > 0 && d.durationMin <= 720`, inside the `hasAll` floor, in BOTH `validApptWrite` and `validTemplateWrite`). Every one of the nine new types carries it like any other appointment.

**Nothing anywhere sums it.** There is no per-type, per-day, or per-week duration total on any surface. So "how much time did I spend on paperwork / collections / admin this week" — the question the nine types exist to answer — is **capturable today but not reportable**. This is a pure reporting build; no schema change, no rules change, no migration. That is the whole reason it is LOW rather than blocking.

### 3. LOW — type-taxonomy collisions deferred by hardcoding

Two name collisions are **accepted, not accidental** — consequences of hardcoding the agent tier now and unifying with the manager tier later:

- **`MTG` (agent, "Branch meeting") vs `UNIT` (manager, "Unit meeting").** Different concepts, similar names, and they will coexist in one enum when the manager codes land. Source for the manager side: `docs/design-system/screens-v2/agencytrack-planner-handoff/2-manager-planner/mockups/planner-manager-personal.jsx:27` (`RCODE.UNIT`).
- **`PERS` (manager block code) vs `FREE` + `freeBlockLabel: 'Personal'`.** The same concept reachable two ways. This PR deliberately left `FREE` and `FREE_BLOCK_LABELS` untouched for backward compatibility, so the duplication is created only when `PERS` arrives. Source: `planner-manager-personal.jsx:483`.

Resolve both when the manager recruiting/coaching codes (`RC`, `RI`, `RSEM`, `ONE`, `UNIT`, `JCI`) are built — not before, since the right answer depends on whether the two tiers share one enum.

### 4. LOW — `SALE` absent from the authority's agent picker

The design authority's agent booking sheet renders `['PC','SC','AI','FFI','CI']` under prospect mode — **`SALE` is not in it** (`docs/design-system/proposals/planner-scheduler-v2/mockups/planner-mobile-a.jsx:333`, `planner-desktop-screens.jsx:414`). The shipped app has always included `SALE` in its picker.

**Pre-existing divergence — NOT introduced by the activity-types work**, which preserved `SALE` in the Prospect group exactly as it shipped. Recorded so it is not later misattributed to that PR. Needs a product call (is booking a "Sale" as a future appointment meaningful, or is a sale only ever an outcome?) before any code change.

### 5. LOW — SEM/TRADE read differently to an agent and to their manager

Surfaced by the reviewer pass on #878. Two sets answer two genuinely different questions, and each is correct in isolation:

| Set | Question | Members |
|---|---|---|
| `SELLING_TYPE_KEYS` (`plannerService.js`) | "does it count as selling **activity**?" | `PC SC AI FFI CI SALE` **`SEM TRADE`** |
| `SEEDS_DAILY_CAPTURE` (`planner.helpers.js`) | "does it seed a Daily Capture **field**?" | `PC SC AI FFI CI SALE` |

The delta is `SEM`/`TRADE`. Consequence: **the same kept seminar counts toward the manager's "N selling booked this week" but not toward the agent's own "N kept appointments today."** Neither number is wrong for its own purpose — a seminar *is* prospecting activity, and it *does* carry nothing into Daily Capture — but the two roles get different signals about the same event, with no affordance explaining why.

Not a bug and deliberately not reconciled: collapsing the sets would break one of the two purposes. **Settle when types become tenant-configurable**, since that work has to decide whether "counts as activity" and "seeds a field" are one axis or two — at which point this asymmetry is either formalised (and surfaced in the UI) or removed. Verified during review that neither set is used where the other belongs: `isSellingType` has exactly one consumer (`TeamPlannerPanel:154`), `SEEDS_DAILY_CAPTURE` exactly one (`planner.helpers:480`).

### 6. MEDIUM — `assertLegHygiene` never asserts on `networkFailures` (every smoke, not just this one)

Found while diagnosing the first post-deploy run of `smoke-planner-activity-types.mjs`. `assertLegHygiene` (`scripts/verification/vh/vh-helpers.mjs`) checks exactly two things:

1. `prodRequests` — zero production traffic, and
2. unallowlisted **console errors**.

It does **not** look at `capture.networkFailures` at all. Those are collected by `captureConsoleAndNetwork` and *printed* by `formatCaptureReport`, but nothing ever fails on them. So **a failed network call is visible in the log and invisible to the gate** — across every smoke in the suite, not just this one.

Concretely, that run reported `hygiene: console-clean + zero prod requests` **PASS** while the capture showed two `net::ERR_ABORTED` entries. Both turned out benign (see below), but the point stands: hygiene passing is not evidence that network calls succeeded, and it is easy to read it as though it were.

**Calibration banked from the same run — `ERR_ABORTED` in this codebase is usually teardown, and that is now *proven*, not assumed.** The Firestore **Write** channel showed `ERR_ABORTED`, and an Admin-SDK read confirmed the document it was writing **persisted correctly**. So an aborted channel in these captures is demonstrably compatible with a fully successful operation. The second abort, on the `resolveSalesManagerUid` callable, is the same class: it is fired from a dashboard-mount effect and **every call site wraps it in `.catch(() => null)`** (`AgentDashboard.jsx:476`, `useMyProduction.js:67`, `GoalsPanel.jsx:469`/`1094`), so it degrades to `smUid = null` by design and the goal hierarchy still loads. `ERR_ABORTED` is a client-side cancellation status — a genuine Cloud Function failure returns an HTTP error with a body, not an abort.

**Why this is MEDIUM rather than LOW:** the `.catch(() => null)` that makes the callable non-fatal also makes a *real* failure of it silent — no console error, so hygiene stays green and the smoke cannot tell "aborted at teardown" from "failed every time". Today that is masked by the fact that `smUid` is optional.

**Scope when built:** decide deliberately what `networkFailures` should gate on — a blanket assert would fail every smoke on teardown aborts, so it needs an allowlist (navigation-time aborts on long-lived Firestore channels, `_vercel` insights off-platform) plus a hard failure for anything else, ideally with the request URL in the message. Do it once in `assertLegHygiene` so all smokes inherit it.

### 7. LOW — mutating planner smokes leave residue by design; no self-teardown

Raised by CodeRabbit on the activity-types PR (#878) against `smoke-planner-activity-types.mjs`: the ADMIN sentinel it books survives the run, because the sweeper is a **pre-run** prerequisite rather than a teardown.

**Not fixed there, deliberately** — it is a property of **all seven** planner smokes, not that one. The established repo pattern is: reserve a slot band, document the residue, and rely on the unconditional pre-run `sweep-nonfixture-appointments.mjs --apply` (see `smoke-planner-week-nav.mjs`, which leaves a 7:45 PM sentinel on exactly this contract). Two constraints make an in-smoke teardown a genuine design change rather than a quick fix:

1. **The planner UI exposes no delete affordance at all** — that is design-authority-mandated ("Cancelled & postponed stay on record — nothing is deleted"). A browser smoke therefore *cannot* clean up through the UI; cancelling only flips status, the doc remains.
2. Deleting would require **Admin SDK access from inside a browser smoke**, which none of the seven currently has. That is a new pattern, and it should be introduced once as a shared teardown helper, not bolted onto whichever smoke a reviewer happened to read.

**Scope when built:** add an Admin-SDK teardown helper (mirroring `sweep-nonfixture-appointments.mjs`'s query) callable from a smoke's `finally`, and adopt it across all seven planner smokes so the residue contract becomes "self-cleaning" uniformly rather than per-file. Low severity because the residue is non-selling and provably cannot move any counter this PR touches — but it does accumulate until the next sweep.

### 8. LOW — two divergent planner design-authority trees, never diffed

The repo carries **two** planner mockup trees that disagree:

| Tree | Status |
|---|---|
| `docs/design-system/proposals/planner-scheduler-v2/` | **Uncatalogued** — `DESIGN-FOLDER-CATALOG.md` contains zero references to `proposals/`. Used as authority by PR #875. |
| `docs/design-system/screens-v2/agencytrack-planner-handoff/{1-agent-planner,2-manager-planner}/` | Named as THE planner handoff — catalog `:92`, `:93`, `:44`. |

Known divergences (found while verifying, not exhaustive):

- **`ACT_CODE`.** `proposals/.../planner-shared.jsx:15-16` carries 13 codes (the 7 + `RC`, `RI`, `RS`, `O2O`, `TEAM`, `JOINT`). `screens-v2/.../1-agent-planner/.../planner-shared.jsx:15` carries **only the 7**. The manager tree puts the extras in a *different* map, `RCODE`, with *different* keys (`RC`, `RI`, `RSEM`, `ONE`, `UNIT`, `JCI`).
- **Stream hues.** `proposals/.../planner-shared.jsx:35-42` comments "recruiting = gold family, management/team = accent + neutral". The manager tree's `streamStyle` (`planner-manager-personal.jsx:15-17`) assigns **coach = gold, recruit = accent** — the opposite pairing.

**Dispatcher ruling 2026-07-27:** `screens-v2/agencytrack-planner-handoff/` wins for screen design, tone, taxonomy and picker structure; `proposals/planner-scheduler-v2/` is **not discredited** — it is the E1–E5 enhancement SPEC (feature behaviour), which is why #875 correctly used it. Different purpose, not different quality. **Record that distinction whenever either tree is cited; it will recur.**

A file-by-file diff of the two trees was explicitly ruled unnecessary for that PR and is banked here for whoever unifies them.

---

## `latestPersistency*` scale sweep — RESOLVED (banked + closed 2026-07-27, PR #871)

Dispatcher-ordered sweep of every same-named persistency accessor after the Meeting Mode decimal-vs-percent defect, on the principle that **their own tests are not evidence** (the Meeting Mode bug survived because its fixtures used percentages that production never produces).

| Site | Returns | Consumer expects | Verdict |
|---|---|---|---|
| `MeetingMode.helpers.latestPersistency` | *was* decimal | percent | **DEFECT — fixed in this PR** |
| `utils/funnelStatus.latestPersistency` | decimal | decimal (`PERS_FLOOR`) | ✅ correct, documented |
| `lib/strategicPlan.latestPersistencyPct` | percent (`* 100`) | percent | ✅ correct, documented |
| `utils/commissionAnchor.latestPersistency` | decimal in a field **named `pct`** | consumer does `* 100` at `CommissionAnchorStrip.jsx:234` | ✅ correct — **misleading field name only; RENAMED to `decimal` 2026-07-27 (reviewer pass)** |
| `profile/agentReportModel` + `agentReportPdfModel` `latestPersistencyPercent` | *was* `v <= 1 ? v * 100 : v` | percent | **DEFECT — fixed in this PR** |

**The residual defect.** Both `agentReport*` modules (documented mirrors of each other) coerce with the heuristic `v <= 1 ? v * 100 : v`. `calculations.js` **explicitly permits persistency > 1** ("can return > 1 when reinstatements outpace lapses (rare but valid)") and has a test pinning it. So a genuine `1.05` (=105%) fails the `<= 1` branch and renders as **"1%"** in the agent report and PDF — the same lie class this PR exists to remove, on a top performer.

**Why the heuristic is unnecessary, not just wrong:** every persistency read path filters to E3 docs — `getPersistencyMapForYear`, `getPersistencyForAgentIds`, and `getAgentHistory` all `.filter(isE3Doc)` — and E3 stores decimals only. A legacy 0–100 doc cannot reach these functions, so the dual-scale guess has nothing to guard.

**RESOLVED 2026-07-27 in PR #871** (dispatcher ruled FIX-NOW: trivial, provably unnecessary guard, same family, and it mis-renders money in a head-office PDF). Both mirrors now use an unconditional `v * 100`, each carrying the rationale inline so the heuristic is not "helpfully" restored. Value-level tests added at 0.88 / 0.7393 (the Tatil Ricardo Duke figure) / **1.05 → 105** / 1.2 → 120 / exactly 1.0 → 100, plus null-safety. Negative-controlled: restoring `v <= 1 ? v*100 : v` fails with `expected 1.05 to be close to 105`.

---

## Persistency threshold sites left un-consolidated, deliberately (banked 2026-07-26, PR #871 session, LOW — note, not a defect)

Recorded so a future "consolidate the persistency constants" sweep does not treat these as misses. PR #871 single-sourced the floor/gate pair into `src/lib/persistency/calculations.js` (decimal canonical, with derived `PERS_FLOOR_PCT` / `PERS_GATE_PCT`). These were examined and intentionally left alone:

- **`src/utils/campaignEngine.js` `PERSISTENCY_GATE_BANDS`** — a 4-band payout multiplier (`≥90` ×1.0, `≥85` ×0.5, `≥80` ×0.25, else DQ) on its own documented 0–100 scale, explicitly operator-tunable and self-described as "one source of truth" for its domain. Its 80/85/90 boundaries *coincide* with the floor/gate numbers but are a different concept (campaign payout scaling, not at-risk banding or award eligibility). Folding it into the floor/gate pair would couple campaign economics to award policy. **Leave separate.**
- **`src/config/companyConfigRegistry.js:348`** — the label string `'Persistency <80%'` is documentation *describing* `PERSISTENCY_GATE_BANDS[3]` in the Company Config surface, and it names its own source file inline. It follows whatever that engine does; interpolating a constant into a descriptive registry label adds coupling for no correctness gain.
- **`companyMinimums.persistency`** — its *default* now derives from `PERS_GATE_PCT`, but the value remains tenant-configurable and `stored.persistency` still wins. It is a floor on an agent's self-set annual **goal**, not a performance band. **Do not collapse it into `PERS_FLOOR`.**

An anti-collapse test in `calculations.test.js` ("floor and gate are NOT the same threshold — do not consolidate them") will fail loudly if a future refactor unifies the pair.

### Still hand-rolled — NOT deliberate, just out of scope (added 2026-07-27, reviewer pass on PR #871)

Distinct from the three *deliberate* exclusions above: these are the same two thresholds, re-typed as literals. **All are on the correct scale — no live defect** — but the "one home, one unit" property the PR claims is not actually enforced while they exist, so a future edit to `PERS_GATE` / `PERS_FLOOR` will silently fail to reach them.

| Site | Literal | Should be |
|---|---|---|
| `src/components/agent/PersistencyTab.jsx:71` | `>= 0.90` | `PERS_GATE` |
| `src/components/agent/PersistencyTab.jsx:152` | `>= 0.90` | `PERS_GATE` |
| `src/components/agent/PersistencyTab.jsx:216` | `<ReferenceLine y={90}>` | `PERS_GATE_PCT` |
| `src/components/manager/PersistencyEntryForm.jsx:200` | `>= 0.90` | `PERS_GATE` |
| `src/components/manager/PersistencyTab.jsx:177` | `< 0.80` | `PERS_FLOOR` |
| `src/components/goals/GapAnalysisPanel.jsx:220` | `persistencyFloor = 90` (prop default) | `PERS_GATE_PCT` |

Deliberately **not** fixed in PR #871: mechanical, zero-defect, and each one widens a money PR's blast radius for no correctness gain. Batch them into the next persistency-adjacent slice. `src/config/financingRuleset/2026.js` (`persistencyY1: 0.95`, `persistencyY2: 0.90`) is a **different concept** (financing agreement gates) and must stay separate.

---

## Master Sheet STATUS — a failed persistency read is indistinguishable from "no data on file" (banked 2026-07-27, reviewer pass on PR #871, MEDIUM — operator-legibility, money-adjacent surface)

**The abstention itself is correct.** `buildStatusMap`'s pass 3 refuses to assert `'ontrack'` for an agent with no usable persistency reading, banding them `STATUS_NODATA_KEY` instead. That logic is sound and was verified: no path asserts health without evidence.

**What is wrong is the reason the surface gives.** `MasterSheet.jsx` loads the map with `getPersistencyMapForYear(...).catch(() => null)`, and `getPersistencyMapForYear` *itself* swallows per-batch rules denials internally (`catch {}` → partial map). So three very different states collapse into one:

1. the agent genuinely has no persistency record on file;
2. the read was denied by rules for this caller's scope;
3. the read failed (network, transient).

All three land every otherwise-clean agent in `nodata`, and the inline note then reads: *"N agents have no persistency on file … enter their monthly persistency to band them."* In cases 2 and 3 that instruction is **false** — the manager is sent to enter data that may already exist, and the real fault (a scope/rules problem) stays invisible.

**Why not fixed in PR #871:** the honest fix needs `getPersistencyMapForYear` to distinguish "empty" from "denied" at the *service* layer — it currently cannot, by design (the silent-skip contract is load-bearing for cross-scope callers). That is a service-contract change with its own blast radius, not a copy tweak. The narrower `statusReadFailed` flag added in the reviewer pass covers the `ytdSubs` / `companyMins` arms only, because those two are genuinely observable at the call site.

**Falsification (Rule 23):** this is wrong if `getPersistencyMapForYear` can be shown to already surface denial distinctly to its caller, or if rules make case 2 unreachable for every role that can open the Master Sheet. Neither was established.

**Suggested shape:** have `getPersistencyMapForYear` return `{ map, deniedBatches, ok }` rather than a bare map; `nodata` copy then branches on `ok`.

---

## Money smoke — A3 cannot fail; A2 is fixture-dependent (banked 2026-07-27, reviewer pass on PR #871, MEDIUM — verification hygiene, found by executing the negative control)

### A3 is VACUOUS — the named guard for defect #2 does not guard it

**Found by running the negative control, not by reading it.** With both original fixes reverted, `smoke-persistency-scale-money.mjs` reports `RESULT: FAIL (10)` — confirming the PR body's figure exactly. Of the three assertions that still PASS, one is hygiene (correct) and **two are `A3`, whose entire job is to catch defect #2: "every agent falsely flagged Persistency ↓".**

Instrumented on the reverted build, the deck contains **no `classifyFlag` persistency reason at all**:

```
[diag] deck contains "below the 80% threshold": false
[diag] reason context: ABSENT
```

Two independent reasons, both fixture properties:

1. **`Staging Agent One` is pre-empted.** `classifyFlag` tests its arms in order — `report` → `floor` → `persistency`. The fixture agent has no submission for the week, so the `report` arm fires first (`"REPORT LATE · Week report not submitted."` on the Needs-attention and agent-run scenes) and the persistency arm is never reached, defect or no defect.
2. **`Staging Agent Two` never appears on a flag-bearing scene.** They surface in exactly ONE scene — the campaign standings — where no flag is rendered.

So A3 passes on the fixed build *and* on the broken build. It is not a weak assertion; it is a **non-assertion**, and the PR's "every fix is individually negative-controlled" claim does not hold for the `classifyFlag` half of defect #2 at the smoke layer.

**Not an unguarded defect.** `MeetingMode.helpers.test.jsx` covers `classifyFlag` at the unit layer directly (healthy 0.94 not flagged · 0.72 flagged · exact 0.80/0.799 boundary), and those tests DO fail on the revert. The gap is smoke coverage, not total coverage.

**Fix shape:** the fixture needs a third agent who (a) HAS filed the selected week, so the `report` arm cannot pre-empt, (b) clears ≥4 of the 8 activity floors, so the `floor` arm cannot pre-empt, and (c) carries a persistency record above 0.80. Then A3 becomes falsifiable. Requires a `seed-fixtures.mjs § A6` change, so it is a fixture PR, not a smoke-assertion PR.

### A2 is fixture-dependent, not scoped

`scripts/verification/smoke-persistency-scale-money.mjs` assertion **A2** scans *every* `\d{1,3}%` in the branch-scorecard scene and passes if **any** value lands in 85–95:

`scripts/verification/smoke-persistency-scale-money.mjs` assertion **A2** scans *every* `\d{1,3}%` in the branch-scorecard scene and passes if **any** value lands in 85–95:

```js
const branchPcts = [...branchScene.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1]));
const ok = branchPcts.some((n) => n >= 85 && n <= 95);
```

Every other money assertion in that file (B1–B4) is properly **row-scoped** — sliced from the advisor's name to the next advisor precisely so a neighbour's value cannot satisfy the check. A2 is the one that is not. It passes today because nothing else in that scene renders an 85–95% figure; that is a property of the current fixture and layout, not of the assertion. Add a goal-attainment or floor-progress percentage to the scorecard and A2 could go green over a `1%` persistency cell.

**Fix shape:** scope A2 to the PERSISTENCY column the way B1–B4 scope to the advisor row — anchor on the column header or a `data-testid` on the cell, then read the single value.

**Not fixed in PR #871 (either item):** touching the smoke's own assertions during the same pass that re-runs it as evidence is circular; the fix should land separately and be re-negative-controlled on its own. A3 additionally needs a fixture change, which is its own blast radius.

**Method note worth keeping.** A3's vacuity was invisible to a careful read of the assertion — it looks correctly written, and it is. It only surfaced by *executing* the negative control and asking why the count was 10 and not 12. Reading a negative control is not running one.

---

## Flake family scope — PR #872's fix set is provably INCOMPLETE (banked 2026-07-26, PR #875 session, MEDIUM — test-infra audit, follow-on to #872)

> **DO NOT WIDEN PR #872.** It is green and queued; re-opening it to chase these would stall a landed fix for an audit that is not finished. This entry is the *follow-on*: the audit continues **after** #872 lands, starting from the population below.

**Claim, stated plainly: the four tests PR #872 fixes are not the whole family.** At least three further members were observed in a single session (2026-07-26, the planner week-nav track), two of them in files that session's diff never touched. #872's characterisation work (three mechanisms, not one) remains correct and valuable — it is the *population* that was under-counted, not the analysis.

### Named population

**THREE NEW MEMBERS OBSERVED 2026-07-26/27 (PR #871 session) — and the shared mechanism is now visible: it is LOAD, not any individual test.**

All three are heavy component tests that time out at **exactly ~5000ms** (the default per-test timeout) under full-suite parallel execution, and all three pass comfortably in isolation. PR #871's diff touches **zero** files under `src/components/planner/` or `src/components/wizard/` — verified with `git diff --name-only origin/staging...HEAD`.

| Member | Where it failed | In isolation |
|---|---|---|
| `AgentPlannerPanel.weeknav.test.jsx > "navigation is unlimited — three weeks forward keeps stepping"` | CI run `30229429795`; **passed on a clean re-run of the same commit**, no code change | 20/20, ×1 |
| `WizardFormV2Characterization.test.jsx > G — draft-read failure guard` | local full suite (2 failures); passed later in the same file on a subsequent run | 20/20, ×3 |
| `AgentPlannerPanel.test.jsx > bulk operations (Run 9 A5) > "pushes ONE undo entry per bulk op"` | local full suite, 5046ms | 73/73, ×1 |

**The weeknav member arrived with PR #875 (`e963660e`), whose own `lint-and-build` passed** — flaky from birth, not broken by a later change.

**Mechanism: resource contention, not N independent test bugs.** Vitest's default **5000ms** per-test timeout is not generous enough for the heaviest jsdom component mounts when workers compete for CPU. Seven runs of the SAME commit (`6eefa98b`), ordered by machine load — the relationship is monotonic:

| Run | Machine conditions | Result |
|---|---|---|
| local 1 | `vite preview` server running | 2 failed — `WizardFormV2Characterization` G block |
| local 2 | `vite preview` server running | `WizardFormV2Characterization` G timeout, later passed in-run |
| local 3 | `vite preview` server running | 1 failed — `AgentPlannerPanel` A5 undo-entry |
| **local 4** | **server stopped, machine quiet** | **372/372 files · 5810/5810 tests · ZERO failures** |
| local 5 | concurrent with `npm run build` + another full suite | **5 failed across 4 files** |
| CI 1 | GitHub runner | 1 failed — `AgentPlannerPanel.weeknav` → clean re-run **PASS** |
| CI 2 | GitHub runner | 1 failed — `MeetingMode` agenda rail → clean re-run **PASS** |

**Five different tests** have now been the failing one, every one at exactly ~5000ms, every one passing in isolation (12/12, 20/20, 20/20, 73/73). Zero failures on a quiet machine; five under maximum contention. No individual test is broken.

Each candidate was checked for a real cause before being attributed to load: `MeetingMode.test.jsx`'s agenda rail runs in **583–925ms** in isolation across 3 runs — an order of magnitude under the limit — so it is not a mount-cost regression from the persistency work in the same file.

**Falsification (Rule 23):** overturned if a member fails deterministically in isolation, if a member is traced to a genuine product race, or if raising `testTimeout` leaves the family intact. Any of those would mean this is not one mechanism and the fix must be per-test.

**DISPATCHER RULING 2026-07-27 — the `testTimeout` experiment is APPROVED, as its own small PR AFTER #871 lands.** Deliberately NOT bundled into #871: that PR is money-correctness work and a global test-harness knob has a different blast radius and a different reviewer. Carry the falsification conditions above into that PR so the experiment either confirms the mechanism or kills the hypothesis.

**Suggested first move for the audit:** rather than stabilising members one at a time (#872's approach, which #876 already showed incomplete and which this evidence suggests can never terminate — the population is "whichever heavy test loses the CPU race"), test the mechanism directly: **raise `testTimeout` in `vite.config.js`** (and/or cap worker concurrency) and see whether the whole family goes quiet at once. One run confirms or falsifies it.

**Already fixed by #872 (four targets, each negative-controlled there):**

1. `DailyCaptureV2 > daily streak celebration (integration) > "does NOT fire below the milestone (short streak)"` — self-narrowing `waitFor({timeout: 2000})`
2. `AgentPlannerPanel > keyboard shortcuts (Run 9 A2) > "e opens Edit for the focused … card"` — commit→effect-resubscribe race
3. `AgentPlannerPanel > bulk operations (Run 9 A5) > "R6 cap gate: selecting >200 …"` — per-test budget, 201-card render
4. `AgentPlannerPanel > bulk operations (Run 9 A5) > "pushes ONE undo entry per bulk op — Ctrl+Z writes back each doc's PRIOR values"` — five chained `waitFor`s in one 5s budget

**NOT covered by #872 — observed 2026-07-26:**

5. `AgentPlannerPanel > keyboard shortcuts (Run 9 A2) > "e on a focused SERIES card raises the SeriesEditChoice scope sheet instead of editing directly"` — a **sibling of target 2, not the same test**. Both exercise the `e` shortcut; #872 fixes only the first. If target 2's mechanism is the resubscribe race, this one almost certainly shares it and wants the same `await userEvent.keyboard('e')` treatment. **Cheapest next step: check whether #872's fix generalises to it.**
6. `MeetingMode > run-of-show > "ArrowRight advances from opening to the branch scorecard"` — failed at **5021ms** (timeout). `src/components/manager/`, an entirely different subsystem from the planner.
7. `BranchesPanel > "the error alert has a wired Retry button that re-invokes the same load path"` (`src/components/admin/__tests__/BranchesPanel.test.jsx:121`, failing at `:133`) — failed **in CI**, with the DOM dump showing skeleton (`animate-pulse`) placeholders still mounted, i.e. the query ran before load resolved.
8. **One unnamed member.** An earlier full-suite run in the same session showed exactly one failure that cleared before its name was captured. Recorded as unnamed rather than silently dropped — and as a process lesson: capture the failing test name *before* re-running, because a passing re-run destroys the evidence.

### Shared signature

- **~5020ms timeouts.** Members 4, 6 and the session's other timeout failures all landed at 5021–5023ms — Vitest's default 5s per-test budget, exhausted. (Member 2 is the documented exception: it fails at ~31ms on an assertion, which is why #872 concluded three mechanisms rather than one.)
- **Non-deterministic, different test each run.** Three consecutive isolated runs of `AgentPlannerPanel.test.jsx` gave: 1 failure (member 4) → 73/73 → 73/73. Two consecutive full-suite runs gave: 2 failures (members 5 + 6) → 5746/5746.

### Key evidence — why this is not the diff's fault

**Members appear in files the triggering diff never touches.** This is the load-bearing observation:

- member 7 failed CI on a commit whose diff was **four `.md` files** — nothing the unit suite loads, so the change cannot be causal (the same proof standard already banked for the #868 instance, where a re-run with zero code change went green — which is exactly what happened here too);
- member 6 lives in `src/components/manager/`, which the planner week-nav diff does not touch at all.

Causality was checked, not assumed, for the one member that *was* plausibly related: member 5 sits in the keydown effect whose dependency array that session modified. Ruled out — `useIsDesktop` returns a plain `useState` boolean and `matchMedia` is unstubbed in that describe, so the added dep is a constant `false` and cannot change re-subscription count.

### Action

After #872 lands: (a) re-run the full suite N×10 on both CI and a local machine, collecting every failing test name; (b) classify each against #872's three mechanisms; (c) check whether #872's fix for target 2 generalises to member 5; (d) name the unnamed member 8 or retire it. Do **not** raise the global `asyncUtilTimeout` — that was explicitly off the table in #872 and stays off.

**Falsification (Rule 23):** overturned if, after #872 lands, a 10× full-suite run on both CI and local is clean — at which point members 5–8 were collateral of the four now-fixed tests rather than independent members, and this entry closes. Do not close it on a single green run; the family's defining property is that it passes most of the time.

---

---

## Node 20 → Node 24 — CI deprecation now firing directly, not only in functions deploy (banked 2026-07-16, HIGH, dated 2026-10-30)

Previously tracked as a `functions/` Cloud Functions runtime deprecation only (Node 20 gen-1 decommission 2026-10-30 — see the existing dated entry above). **Escalation:** the Node 20 deprecation is now also firing in CI itself — GitHub Actions is forcing Node 24 on actions still targeting Node 20 (`actions/checkout@v4`, `actions/setup-node@v4` in `.github/workflows/ci.yml`, which explicitly pins `node-version: 20` for the actual `npm test`/`npm run build` steps). This is a second, earlier-arriving surface of the same underlying deadline — CI tooling deprecation typically precedes the hard runtime decommission. **Action:** raise priority on the runtime/SDK migration window (`functions/` Node 22 + `firebase-functions` SDK ≥5.1.0, already tracked as separate entries above) — the 2026-10-30 hard deadline is no longer purely a `functions/` deploy concern, it now has a visible CI-side symptom that will only get noisier as GitHub continues sunsetting Node-20-targeted action runtimes. Cross-reference: this file's existing "HARD DEADLINE — Node 20 gen-1 Cloud Functions runtime decommission" and "Functions runtime + SDK upgrade" entries — do not duplicate the migration plan here, this entry only banks the CI-side escalation signal.

---

---

## Reconcile `design_handoff_v2_app/mockups/` (Downloads, Track J bundle) against `docs/design-system/screens-v2/` (banked 2026-07-16, MEDIUM — Track J, prevent stale-design-authority confusion)

Track J's original design-handoff bundle (`design_handoff_v2_app/mockups/`, 34 hi-fi references per its own README §4 token bridge) lives in the operator's Downloads, separate from the repo's canonical `docs/design-system/screens-v2/` mockups (the CLAUDE.md-locked design source of truth for the shipped app). These may already be substantially the same content that was ported into `screens-v2/` at Track J's outset, but that has not been explicitly reconciled — a future session could mistake the Downloads bundle for a still-pending, un-ported design source when it is in fact already-shipped or superseded. **Action:** identify which of the 34 mockups are (a) already ported/canonical (superseded by `screens-v2/` or by shipped app screens), (b) stale (predate a since-ruled design decision, e.g. anything the 2026-07-13 design-conformance rulings touched), or (c) genuinely still-pending and un-ported. Cross-reference `docs/design-system/DESIGN-FOLDER-CATALOG.md`'s existing generation map (canonical / historical / reference / unclear) — this reconciliation may simply be an update to that catalog rather than new analysis from scratch.

---

---

## Company Config v2 — next major track: every business-policy constant tenant-configurable (banked 2026-07-10, promotion session, HIGH — next major track)

Grounded in `docs/audits/tenant-config-audit-2026-07-10.md`. **Operator-locked principle:** every business-policy constant is tenant-configurable; the current Tatil Life values become defaults, not hardcoded floors. Three tiers, by write surface: **Tier 1** — src-only reads (frontend constants a tenant admin could safely override without touching the backend). **Tier 2** — CF-read constants (needs runtime config plumbing; also the moment to fix the existing ESM/CJS dual-copy drift in `functions/lib/gamificationConfig.js` / `src/lib/gamificationConfig.js`). **Tier 3** — rules-enforced values, case-by-case (each one is a `firestore.rules` change, human-merge-gated). **Never configurable, by design:** payout-release logic, `tenantId`/auth mechanics, date-storage format, schema-validation shapes. The four §4.3 audit corrections below (pace-warning constants, clawback/at-risk windows, career-level labels, activity-standards system) are the concrete Tier-1/Tier-2 candidate inventory this track works from; the MDRT naming collision is a Tier-2 case study. Sequence: audit → rule which items are Tier 1/2/3 → build Tier 1 first (cheapest, no deploy risk) → Tier 2 (needs the ESM/CJS drift fix as a prerequisite) → Tier 3 case-by-case with human-merge.

**Slice 1 SHIPPED 2026-07-15 (Runs 5-7 promotion, MERGE_SHA `10670bd7`) — track continues, NOT fully resolved.** Delivered: the 12-section registry-driven tenant-admin surface (`ConfigProvider`/`useConfig`, diff-only storage, `configAudit` trail), 3 sections live-wired for real writes (Targets & Minimums, Activity Standards, Awards & Clubs) plus the Feature Flags panel (fail-closed, prod-verified `NOT SET → OFF` on all 3 shells), and the Organization-section crash fix. The remaining 8 sections ship read-only ("Ships read-only for now — editing lands with its unlock tier") — this is Tier 1 scaffolding, not the Tier 1/2/3 rollout itself. **Still open:** the actual Tier 1 build-out for the read-only sections, Tier 2 (needs the ESM/CJS gamificationConfig drift fix first), Tier 3 case-by-case rules work, and the §4.3 audit corrections + MDRT naming collision below.

---

---

## MDRT naming collision — three different "MDRT" numbers, one label (banked 2026-07-10, promotion session, MEDIUM — Company Config v2 candidate)

`functions/lib/gamificationConfig.js` hardcodes `mdrt_qualified: ytdApi >= 688,800` and `mdrt_pace: ytdApi >= 344,400` (the T&T MDRT commission-method figures, half-year pace target) — both CF-side, both labeled "MDRT." Separately, the awards ruleset (`getMergedAwardsRuleset`/`DEFAULT_RULESET_2026`) carries its own **500,000** tenant-configurable awards threshold, also MDRT-adjacent. Three numbers, one name, no shared source. Cross-reference: this is an escalation of the already-tracked "third independent MDRT threshold source" finding (this file, § EFF-004 follow-ups area — `functions/lib/gamificationConfig.js` hardcoded badge stubs, independent of `MDRT_THRESHOLDS_2026`) — that finding flagged the collision; this entry frames the resolution path. **Resolve during Company Config v2 Tier 2** (gamificationConfig is exactly the CF-read-constant case that tier's ESM/CJS-drift fix targets): either reconcile the naming (distinct labels for the badge-gate figure vs. the awards-threshold figure) or reconcile the values (one config source, multiple derived gates) — an operator ruling, not a mechanical fix.

---

---

## Financing ruleset code comment overclaims configurability (banked 2026-07-10, promotion session, LOW — housekeeping, Company Config v2 adjacent)

A code comment in the financing ruleset config (`src/config/financingRuleset/2026.js`, per `docs/audits/tenant-config-audit-2026-07-10.md`) claims the ruleset is tenant-configurable, but there is zero override plumbing — no admin UI, no per-tenant Firestore doc read, nothing consuming a non-default value. Correct the comment to state the ruleset is a **source-code default only** (not yet wired for override) so it doesn't mislead a future reader into assuming a config surface exists. If/when Company Config v2 reaches financing, this becomes a real Tier-1 or Tier-2 candidate; until then, the comment should say so honestly.

---

---

## Register the six Run-9 standing smokes in SMOKES.md (banked 2026-07-17, promotion session, MEDIUM — verification hygiene)

> **RESOLVED / STALE — corrected 2026-07-26 (planner week-nav track).** All six ARE registered in `scripts/verification/SMOKES.md`, each with a full row (run mode, prereqs, residue, source anchors), plus a shared run-mode note covering the `900×800` viewport choice and `assertSingleColumnPlanner`. Verified by reading the catalogue during this track's smoke registration. The action below is already done — **no work remains**; the entry is kept struck through because it was cited as open as recently as this track's Phase 0. Same rot pattern as the § BIG ONE correction: an entry asserting a gap is not forced to change when the gap is closed.

~~Run 9 (promoted to prod PR #862, `d0e74c12`, 2026-07-13) shipped six new standing smokes — `scripts/verification/smoke-run9-{a1-undo,a2-shortcuts,a3-conflicts,a4-templates,a5-bulk,f3e-series}.mjs` — covering undo/redo, keyboard shortcuts, conflict detection, appointment templates, bulk operations, and series-edit propagation respectively. None are yet registered in `scripts/verification/SMOKES.md` (the descriptive, non-CI-enforced catalogue). **Action:** add one row per script to SMOKES.md following the existing catalogue format before they're relied on as a regression baseline for future planner work.~~

---

---

## Run 9 operator rulings — recorded as settled (banked 2026-07-17, promotion session)

Three rulings confirmed during Run 9 (promoted PR #862, `d0e74c12`, 2026-07-13):

1. **Postpone stays tombstone/rebook-style, distinct from reschedule-in-place.** Reschedule-in-place (F3b) replaces rebook only for churn "Reschedule" actions; "Postpone" keeps its existing tombstone-and-rebook behavior unchanged.
2. **Owner-scoped appointment delete arm kept.** The `firestore.rules` change from `allow delete: if false` to owner-scoped (`resource.data.agentId == uid`) is confirmed as intended — undo-create inverse only, no UI affordance to delete directly.
3. **Series-edit propagation extensions confirmed:** date never propagates across series edits; propagation targets `scheduled`/`confirmed` appointments only; diffs are changed-fields-only with value normalization (not a blanket overwrite).

No further action — these are settled design decisions, not open items.

---

---

## Appointment template count cap is client-side only — hardening candidate (banked 2026-07-17, promotion session, LOW — hardening)

Run 9's A4 (appointment templates) enforces a 20-template cap client-side, non-transactionally. There is no `firestore.rules`-level count enforcement, so a client bypassing the UI (or a race between concurrent writes) could exceed 20 templates per agent. Not a security issue (templates are owner-scoped, `hasOnly` 11-key locked) — a data-hygiene cap only. **Action:** bank as a hardening candidate; revisit if template sprawl becomes a real problem, or add a rules-level count check if/when Company Config v2-style rules tooling makes that cheap.

---

---

## Panel keydown stale-closure exposure under rapid state churn (banked 2026-07-17, promotion session, LOW — not observed live, watch)

Run 9's A2 (keyboard shortcuts) introduced panel-level keydown handlers. Under rapid state churn, a keydown handler closing over stale state is a known risk class for this pattern (handler captures a state snapshot at attach time rather than reading current state). Not observed live during Run 9's verification — banked as a watch item. **Action:** if this resurfaces (a shortcut acting on stale panel state), fix with ref-based latest-state reads rather than re-deriving the handler on every render.

---

---

## ~~BIG ONE — the real planner-completion track (E1–E5) is UNBUILT~~ → **E1–E5 ALL SHIPPED** (banked 2026-07-17; corrected 2026-07-26, planner week-nav track)

> **CORRECTION 2026-07-26 — the "entirely unbuilt" claim below was already stale when written into this entry's later revisions, and is now wholly wrong.** All five features exist in `src/components/planner/` on `main` (`219cf324`) and were verified file-by-file during the planner week-nav Phase 0 recon:
>
> | Item | Status | Evidence on `main` |
> |---|---|---|
> | **E1** desktop 3-day + week views | ✅ SHIPPED | `PlannerDesktopBoard.jsx` (Day/3-day/Week/Follow-ups toggle, `grid-cols-N` fluid columns) |
> | **E2** drag-drop reschedule | ✅ SHIPPED | `PlannerDesktopBoard.jsx` drag handlers → `AgentPlannerPanel.handleReschedule` → the existing `postponeWithRebook` |
> | **E3** running-late cascade | ✅ SHIPPED | `RunningLateSheet.jsx` + `planner.helpers.js` `findRunningLate`/`computeLateCascade` |
> | **E4** per-appointment notes thread | ✅ SHIPPED | `NotesThread.jsx` + `addAppointmentNote` + `readNoteThread`/`prospectNoteHistory` |
> | **E5** collapsed-rail space adaptation | ✅ SHIPPED | `AgentPlannerPanel.jsx` `max-w-none` on the `isDesktop` branch |
>
> Each also has standing acceptance smokes registered in `scripts/verification/SMOKES.md` (`smoke-e1-desktop-board.mjs`, `smoke-e2-drag-reschedule.mjs`, `smoke-e3-running-late.mjs`, `smoke-e4-notes-thread.mjs`). The work landed in the Run A Tier 2 window (2026-07-24) — two of this file's own Active-follow-up rows already say so ("Desktop planner board — shift-click range select…", "…Arrow ←/→ view-cycling inert on the board", both tagged *Run A Tier 2 E1*), so the file has been internally contradictory since then.
>
> **Why it went stale:** this entry was banked at the Run 9 promotion to flag a scope mismatch, and nothing re-audited it when the E-series actually shipped a week later. **Lesson (compounding the Rule 17 design-source lesson already banked below):** an entry that asserts *absence* is the kind most likely to rot silently — nothing about building the thing forces an edit here. A HIGH "X is unbuilt" follow-up should be re-verified against source at the start of any session that touches X, not trusted.
>
> **Remaining real gaps** (small, tracked separately in the Active follow-ups table — do NOT re-open this entry for them): desktop-board shift-click range selection keys off mobile view state; Arrow ←/→ view-cycling is inert on the board; E4's cross-time prospect-notes history still needs its `(agentId, prospectId)` composite index. Week navigation across the board and mobile views — never specified by the design authority — shipped in the planner week-nav track (2026-07-26).

_Original entry, preserved for the record:_

~~Run 9 built six features (A1–A5 undo/redo/shortcuts/conflicts/templates/bulk + F3 series propagation) that are real, live in prod (`d0e74c12`), and valuable — but they are **not** the "planner and scheduler v2" redesign named in `docs/design-system/proposals/planner-scheduler-v2/README.md`. That README's actual spec is **five different features**, all still unbuilt: E1 desktop 3-day + week views · E2 drag-drop reschedule · E3 running-late cascade · E4 per-appointment notes thread · E5 collapsed-rail space adaptation. This is the genuine planner-completion track, still ahead, and now sits on the `seriesId` + reschedule-in-place foundation Run 9 just laid.~~ **The scope-mismatch observation was correct at banking time; the "unbuilt" status is not — see the correction above.**

---

## Staging branch re-baseline — RESOLVED 2026-07-26 (five-cycle debt cleared)

The `staging` git branch was deleted by GitHub `deleteBranchOnMerge` on the Run 8 merge (PR #860) and never recreated, leaving five consecutive promotion cycles (Nexus v2/#849, Runs 3+4/#853, Runs 5-7/#858, Run 8/#860, Run 9/#862 — plus the Run A promotion/#874) that shipped without ever re-baselining staging. Tracked in `docs/CONTEXT.md` § Pending operational state.

**Resolved 2026-07-26** at the start of the planner week-nav track, on dispatcher ruling. Notable: the orphaned LOCAL `staging` branch (`a31d52d7`, still checked out in the `at-fable-staging` worktree) turned out to be a **direct ancestor of `origin/main`** (`git merge-base --is-ancestor` confirmed), so the "recreation" was a **pure fast-forward**, not a divergent reset — no commits were discarded and no history was rewritten. Sequence: fast-forwarded the local branch to `origin/main` (`219cf324`) in the `at-fable-staging` worktree, then `git push -u origin staging`. `origin/staging == origin/main == 219cf324`. The 5 untracked persistency-v2 proposal artifacts in that worktree were untouched (a fast-forward does not disturb untracked files).

**Note for the next dispatch:** the `at-fable-staging` worktree is now correctly pointed at a live, current `staging` — the "will need repointing before the next Fable dispatch" caveat in CONTEXT.md is discharged. **Falsification (Rule 23):** this is overturned if `git ls-remote --heads origin` stops listing `staging`, or if `origin/staging` diverges from `main` without a deliberate promotion in flight.

---

## Planner week-nav — external-review residue (banked 2026-07-26, PR #875 attended reviewer passes, MEDIUM ×1 · LOW ×5)

Findings from the external review of PR #875 that were dispositioned BANK rather than fix-before-merge, across two attended reviewer passes. F1–F4 and F9 were fixed in-PR; these are the remainder. None is a data-integrity or security issue.

- **F5 — desktop "Book" and the `n` shortcut prefill TODAY while another week is displayed. UPGRADED LOW → MEDIUM (reviewer pass #2).** `AgentPlannerPanel.jsx`, header Book button + the `n` branch: both use `openBook(view === 'today' ? today : weekStart)`. On desktop `view` is vestigial and permanently `'today'` (the mobile pills are never rendered), so the date is always today even when the board shows, say, Aug 2–8. The per-column `+` buttons are correct — they pass their own date. **Why the upgrade:** F2's fix (gating Arrow ←/→ on `!isDesktop`, since the keys drove the mobile-only `view` state and had no business touching the board) removed a side effect that had been accidentally masking this exact mismatch — pre-fix, an operator pressing an arrow key on the board would snap `anchorDate` home as a side effect, incidentally hiding how far Book/`n` could drift from the displayed week. With that masking gone, the prefill mismatch is now the FIRST thing an operator hits on any multi-day-navigated session, not a corner case. **Fix:** use `columnStart` (or `weekStart`) when `isDesktop`. Shares a root cause with the (now-fixed) F2: `view` is mobile-only state being read on the desktop path.
- **F6 — `today` is captured once at mount; week navigation gives that staleness new teeth.** `const today = useMemo(() => getTodayTT(), [])`. In a long-lived session crossing midnight — and especially a Saturday→Sunday week rollover — `currentWeekStart` goes stale, so `isCurrentWeek` can be TRUE for **last** week: the Today snap-back hides itself while a non-current week is displayed, and the today+2 load arm re-enables for the wrong week. The staleness pre-dates this track (`todayAppts`, `seed`, `lateCandidate` all read it); week navigation adds the new failure modes. **Fix:** recompute `today` on the existing 60-second `nowTime` tick, or re-derive on visibility-change.
- **F7 — "No appointments" and "+N postponed hidden" render together.** `PlannerDesktopBoard.jsx`: when every appointment in a day is postponed and the filter is on, the column shows both the empty state and the hidden-count note. Honest but self-contradictory. **Fix:** suppress the empty state when `hiddenCount > 0`, or reword to "No live appointments".
- **F8 — `weekRangeLabel` never emits a year, and returns `''` on malformed input.** `planner.helpers.js`. With unlimited navigation, "Jan 4 – 10" is ambiguous once you are months out; the empty-string fallback also leaves the nav's `aria-live` region announcing nothing. **Fix:** append the year when it differs from `today`'s, and fall back to the raw ISO range rather than `''`.
- **F10 — RESOLVED in-PR.** The dense-card "no status pill" assertion compared ancestor `textContent` (which includes the sr-only status line) and passed only because sr-only emits lowercase `scheduled` while the pill label is `Scheduled`. Tightened to leaf-node, case-insensitive comparison in the same commit as the F1–F4/F9 fixes. Recorded here because the *class* of defect — an assertion that passes for an accidental reason — is worth recognising elsewhere.
- **F1 residual (reviewer pass #2, LOW) — the follow-ups badge gate uses the anchor, not a loaded-vs-viewed sentinel, so a snap-home transient can flash the inflated count for one load round-trip.** `isCurrentWeek = weekStart === currentWeekStart` (`AgentPlannerPanel.jsx:443`) is derived synchronously from `anchorDate`/`today` via `useMemo`, so it flips to `true` the instant `goToday()` fires. But `appts` — and therefore `followups`, which the badge reads — only updates once the async `getAgentWeek` call inside `load()` resolves and commits via `setAppts` (`AgentPlannerPanel.jsx:557,565`). In the gap between those two moments, the gate (`isCurrentWeek && followups.length > 0`) evaluates true against the STILL-STALE (navigated-away week's) `appts`, so the wrong, inflated count can flash for one render before the real data lands — the exact F1 bug the in-PR fix targeted, reintroduced transiently rather than persistently. **Fix:** replace the `isCurrentWeek` gate on the badge specifically with a `loadedWeekStart === currentWeekStart` sentinel — i.e., compare against the week the LOADED `appts` actually correspond to (set inside `load()`'s `.then()`, alongside `setAppts`), not merely the navigation anchor. The other `isCurrentWeek` consumers (load-window sizing, running-late banner, `columnStart`) are not affected — they either drive the load itself or are fine to key off the anchor.
- **F4 test tightening (reviewer pass #2, LOW) — the a11y-marker test asserts differing `title` text, not differing glyphs.** `AppointmentCard.dense.test.jsx`'s `F4: cancelled and postponed are distinguishable WITHOUT colour` test asserts `getByTitle('Cancelled')` vs `getByTitle('Postponed — moved')` — it proves the `title` ATTRIBUTE string differs, not that the rendered marker itself differs, so a regression that kept both title strings but rendered the SAME icon for both statuses would pass undetected. **Fix:** assert on the rendered `<svg>`'s class instead. Verified against `node_modules/lucide-react/dist/esm/createLucideIcon.mjs`: every lucide-react icon's `Component` stamps its root `<svg>` with `lucide-${toKebabCase(iconName)}` via `mergeClasses`, so `<X>` renders `lucide-x` and `<ArrowRight>` renders `lucide-arrow-right` — asserting these two classes differ (e.g. `container.querySelector('svg').getAttribute('class')`) tests the actual visual distinction under test, not a proxy for it.

**Falsification (Rule 23):** F5/F6 are overturned if `view` stops being read on the desktop path and `today` becomes reactive, respectively — at which point re-verify with the desktop-stubbed panel tests added for F9 rather than assuming. F1-residual is overturned if the badge is re-verified live across a snap-home transition (real browser, not jsdom — the transient is timing-dependent) and no flash is observed even without the sentinel fix.

---

## Appointment created-in-error path — distinct from churn (banked 2026-07-26, planner week-nav track, LOW)

A general delete affordance for appointments was proposed during the planner week-nav track and **DROPPED at Phase 0 on design-authority grounds.** Retained churn is the deliberate product model, not an omission:

- `docs/design-system/proposals/planner-scheduler-v2/mockups/planner-mobile-b.jsx:108` — *"Cancelled & postponed stay on record — nothing is deleted."* (the caption of a dedicated artboard, "5b · Retained churn")
- `mockups/planner-shared.jsx:63` — *"timeline (dimmed/struck), never deleted."*
- `firestore.rules` (appointments block) — the owner-scoped `allow delete` arm carries the matching intent in code: *"exists solely as the undo-create inverse; UI exposes no delete affordance."*

Churn patterns are manager coaching signal, so erasing them destroys the data the surface exists to produce. **The mechanics already exist** if this is ever revisited — `plannerService.deleteAppointment` and the owner-scoped rules arm are both live, consumed today ONLY by Ctrl+Z undo-create and the bulk-create inverse — so no rules change would be needed; the question is purely product, not technical.

**Action:** none unless a genuine mis-keyed-entry need emerges from pilot use. If it does, scope it narrowly against that authority — e.g. creator-only, same-session, before any status change — rather than as a general delete. Do not treat the existing rules arm as licence to add one.
## ~~BIG ONE — the real planner-completion track (E1–E5) is UNBUILT~~ — RESOLVED (Run A Tier 2, PR #866 `f22c57f8`, promoted to prod via #874 `219cf324`, 2026-07-26)

**RESOLVED.** All five features this entry called unbuilt shipped in Run A Tier 2 and are now live in production, verified directly against source at `219cf324` (not asserted from memory — Rule 17):

- **E1** — desktop 3-day + week views → `PlannerDesktopBoard.jsx` (Day/3-day/Week + Follow-ups toggle, `useIsDesktop` matchMedia-branched)
- **E2** — drag-drop reschedule → `PlannerDesktopBoard.jsx` drag handlers, wired to the existing `postponeWithRebook` (no propagation reimplement, as this entry required)
- **E3** — running-late cascade → `RunningLateSheet.jsx` + gap-smart `computeLateCascade`, batches through the existing `bulkUpdateAppointments`
- **E4** — per-appointment notes thread → `NotesThread.jsx` + `addAppointmentNote` (`arrayUnion`); ships at this-week prospect-history scope, cross-time scope banked separately (see the E4 cross-time FU)
- **E5** — collapsed-rail space adaptation → desktop drops the `max-w-3xl` cap (`max-w-none`) so the board reclaims sidebar space

Six standing acceptance smokes are registered in `scripts/verification/SMOKES.md` (`smoke-e1-desktop-board.mjs`, `smoke-e2-drag-reschedule.mjs`, `smoke-e3-running-late.mjs`, `smoke-e4-notes-thread.mjs`, plus the six Run-9 smokes re-pinned to the mobile 900×800 layer with a single-column drift guard). Three small residuals from this build are separately banked (LOW/MEDIUM, listed just above this entry): desktop shift-click range-select keys off mobile view state, Arrow ←/→ view-cycling is inert on the board, and E4's cross-time (pre-this-week) prospect-notes history needs a composite index + deploy.

**Why this sat stale:** the entry asserts *absence*, and nothing about building the feature forces an edit to a doc that merely claims it doesn't exist yet. Banked as a process point, not a new FU: entries of the shape "X is unbuilt" should be re-verified against source at the start of any session that touches X, not trusted from a prior banking date.

_Original entry, preserved for the record:_

~~Run 9 built six features (A1–A5 undo/redo/shortcuts/conflicts/templates/bulk + F3 series propagation) that are real, live in prod (`d0e74c12`), and valuable — but they are **not** the "planner and scheduler v2" redesign named in `docs/design-system/proposals/planner-scheduler-v2/README.md`. That README's actual spec is **five different features**, all still unbuilt: E1 desktop 3-day + week views · E2 drag-drop reschedule (wires to the existing `postponeWithRebook`) · E3 running-late cascade (gap-smart, prospect-notify) · E4 per-appointment notes thread (travels with `prospectId`) · E5 collapsed-rail space adaptation. This is the genuine planner-completion track, still ahead, and now sits on the `seriesId` + reschedule-in-place foundation Run 9 just laid. **Action:** needs its own recon-then-build session sourced from `docs/design-system/proposals/planner-scheduler-v2/README.md` directly — do not reuse Run 9's brief or progress docs as the starting point, they describe different, already-shipped work.~~

---

---

## Process lesson — design authority is the repo file, not a stale in-chat snippet (banked 2026-07-17, promotion session, informational — Rule 17 application)

Run 9 was dispatched against an earlier/mismatched README pasted in-chat rather than the actual `docs/design-system/proposals/planner-scheduler-v2/README.md` in the repo handoff folder — the six features it built (A1–A5 + F3) are real and shipped, but they are not the five E1–E5 features the folder's README actually specifies (see the BIG ONE entry above). **Lesson:** design authority for any build brief is the file in the repo handoff folder, verified at brief-time, never a snippet pasted earlier in the conversation — apply the same Rule 17 ("source verification at authoring time") discipline already standing for code/rules/index claims to design-source claims as well. **Action:** none beyond banking the lesson; future briefs touching design proposals must open and quote the actual repo file before locking scope.

---

---

## Master Sheet STATUS filters — need a YTD + companyMinimums read path (banked 2026-07-10, Run 4 Item 2, MEDIUM — feature completeness)

The funnel Master Sheet's filters panel (`src/utils/funnelFilters.js`, `src/components/manager/MasterSheet.jsx`, PR #852-adjacent Run 4 work) deliberately omitted the mockup's STATUS chips (On track/Off pace/Gone quiet/Report late/Persistency↓/Below floor) — honestly, not silently: they require YTD API + `companyMinimums` tenure floors (+ persistency) loaded on a surface that currently only reads the single selected week. `deriveExceptions()` is called here with `companyMins: null` and single-week submissions only. Building this means adding a YTD/floor read path to Master Sheet — a real scope increase, not a small filter tweak. "Report late" is currently served by the existing reality-bar Exceptions count / Only-exceptions toggle as a partial substitute.

**RESOLVED 2026-07-25 (PR into `staging`, branch `post-run-a/master-sheet-status`).** Built per the Run A Tier 3b spec below. See that entry's RESOLVED note for the derivation contract, the one semantic judgement made, and the two residual items (LEVEL still blocked; unit friendly names are a data gap, not a code gap).

---

---

## Master Sheet LEVEL filter — blocked on a populated career-level field (banked 2026-07-10, Run 4 Item 2, MEDIUM — feature completeness, data-dependency)

The funnel Master Sheet's filters panel omitted the mockup's LEVEL (L1–L4) chips — `careerLevel` exists only as free-text CSV-import data on user docs (`BulkImportUsersModal.jsx`, `userImportService.js`), unpopulated for real users and with no defined level taxonomy behind it (see the related, already-tracked Track J2 trailing-2-year-average career-level qualification work). Building this filter needs the career-level field populated and a defined level taxonomy first — decide alongside Company Config v2's Tier-1 "labels catalog" candidate (§4.3(c) of the tenant-config audit) rather than inventing a second, disconnected level scheme.

---

---

## Master Sheet — unit friendly names absent (banked 2026-07-10, Run 4 Item 2, LOW — display polish)

The funnel Master Sheet's UNIT filter falls back to raw ids (`Unit <last4>`) because no unit-name lookup is loaded on this surface. Populate friendly unit names (there is presumably a `/tenants/{tid}/meta/branches`-style enumerated list or unit-name field elsewhere in the app — locate it) and thread it into `deriveUnitOptions` (`src/utils/funnelFilters.js`).

---

---

## Company Config toggle — "count converted service calls as Tel Contacts" (banked 2026-07-10, Run 4 Item 1, LOW — explicitly DO NOT BUILD until ruled)

The funnel Master Sheet's Contacts Made / Contact Attempts mapping deliberately excludes `serviceCalls` from every funnel sum (servicing ≠ new-business activity; `src/utils/funnelModel.js` — `serviceCalls` stays visible in the drill/detail view so nothing leaves the record). A possible future refinement: a Company Config toggle letting a tenant opt IN to counting converted service calls as Tel Contacts, default OFF. **Do not build this until the operator rules on it** — it's a product decision, not a mechanical gap.

**STILL OPEN after ruling D-SC (2026-08-26).** D-SC made the daily→weekly aggregator write `serviceCalls` from a real daily `serviceCalls` field (closing a points disagreement between the daily pace badge and the aggregated weekly draft). It **did NOT** answer this question. `serviceCalls` remains excluded from every funnel sum (`src/utils/funnelModel.js`) and from every plan/effort sum (`src/utils/planVariance.js` — `computeProspectingCallsActual` is the 4-sum). Do not infer an answer from D-SC: the ruling was about *where the number comes from*, not about *what the number counts toward*.

---

---

## Planner recurrence — `ENDS=Never` rolling-horizon materializer (banked 2026-07-10, Run 4 Item 5, MEDIUM — feature completeness)

Planner recurrence (`src/utils/plannerRecurrence.js`-adjacent, `firestore.rules` `validApptWrite()`, shipped via the Runs 3+4 promotion, PR #853/`0d5662ef`) materializes concrete instance docs (`seriesId`/`seriesPos`/`seriesTotal`, capped at 52) and requires a real end condition (On date / After # times) — the mockup's `ENDS=Never` chip ships disabled ("soon") rather than built, because concrete materialization and an infinite end condition are structurally in tension. Resolving this needs either (a) a rolling-horizon materializer (periodically extend the series N instances ahead, e.g. via a scheduled CF) or (b) a virtual-expansion read model instead of concrete docs (a bigger rearchitecture). **Shares composite-index work with the "edit this-and-all-future" item below** — both need a cross-week `(agentId, seriesId, date)` query shape, so scope them together rather than building the index twice.

---

---

## Planner recurrence — "edit this and all future" instances — RESOLVED (banked 2026-07-10, Run 4 Item 5; shipped as Run 9 F3, evidence `d0e74c12`)

**RESOLVED 2026-07-16, promoted to prod 2026-07-13/PR #862 `d0e74c12`.** The recurrence edit-scope choice sheet (mockup state 3) originally shipped only "Edit this appointment only" — Run 9's F3 landed series-wide edit propagation (this/this-and-future/all) via `045434ef` (F3c series composite index + F3d edit propagation), with the new composite index `(agentId, seriesId, date)` this entry called for, plus F3e live smoke (14/14) and F3a+F3b post-deploy verification. No further action; the `ENDS=Never` rolling-horizon item directly above remains open and unrelated to this closure (it's a different structural gap — infinite end condition vs. concrete materialization).

---

---

## Run 4 pre-promotion manual checks not done this cycle — carry to next Phase 0 (banked 2026-07-10, Run 4, MEDIUM — verification gap)

Three manual/visual checks were banked as gaps during Run 4's build (per-item Rule 22 self-critique in `docs/fable-run4-progress.md`) and were NOT closed before the Runs 3+4 promotion:
1. **Streak-celebration reskin** (`src/components/dashboard/HomeV2/FilingStreakCelebration.jsx`) — the `prefers-reduced-motion` static variant and dark-mode rendering were never live-verified (only default light/no-motion-preference was screenshot-proven).
2. **FunnelMeetingScene** — not axe-run specifically; weakest spot is the `Draft` tag (`text-warning` on `bg-warning/15`) over the projection-dark surface.
3. **Master Sheet filters popover** — not spot-checked for dark-mode contrast (the popover reuses already-theme-aware tokens, but no explicit check was run).

Carry all three to the next cycle's Phase 0 before further build work on these surfaces.

---

---

## 1-on-1 takeover — needs a real design pass (banked 2026-07-10, Run 4 Item 6 recon, MEDIUM — design/product, blocks any build)

`docs/audits/one-on-one-recon-2026-07-10.md` (validity-SHA header: staging @ `bf881e4f`) found the funnel mockup's scene 08 "1-on-1 mode" is read-only number display only — no talking points, no in-room note capture, no action/commitment logging — and that the premise of "one drill drawer" is wrong: today there are two **unwired** surfaces (`AgentDrillDrawer`, 3-tab, opened from Team Dashboard; `CoachingNotesModal`, 3-tab, opened from Master Sheet row hover). §4 of the recon doc lists 10 open one-line design questions (drawer unification, notes agent-visible vs. manager-private, commitment schema, full-screen vs. tabbed, role gating, real-time vs. snapshot data, cross-agent scope, session grouping, and whether the standard-strip floors should read from `weeklyActivityFloors.js` instead of the mockup's mismatched hardcoded numbers). Any commitment/action-item logging or cross-agent open-commitments query needs a `firestore.rules` change (human-merge-gated per CLAUDE.md). Needs a real design pass before any build — this is not build-ready today.

---

---

## ⚠️ Feature-branch Vercel previews are bound to PRODUCTION Firebase (banked 2026-07-10 as LOW; **OVERTURNED + re-banked HIGH 2026-07-26**, planner week-nav track)

> **THE PREVIOUS ENTRY WAS WRONG IN ITS MECHANISM, AND THE ERROR WAS SAFETY-RELEVANT.** It is preserved struck through at the bottom. Read the correction first.

**Corrected finding.** A feature-branch Vercel preview is **not** sandboxed from live data. Vercel's staging Firebase env vars are bound to the **`staging` branch specifically**, not to the Preview *environment* — so a branch cut off `staging` builds against **PRODUCTION Firebase (`agencytrack-2a610`)**.

**Evidence (same credentials, same minute, 2026-07-26).** Identical scripted login as the staging A11Y agent (`staging-agent-1@agencytrack-staging.test`), driven through `setupBypassSession`, against two deployments:

| Target | Result |
|---|---|
| `agencytrack-git-staging-kyron-marchan-s-projects.vercel.app` | **LOGIN-OK** |
| `agencytrack-git-feat-planner-week-nav-kyron-marchan-s-projects.vercel.app` | **AUTH-ERROR** ("Incorrect email or password") |

**DECISIVE EVIDENCE — added by the external reviewer (2026-07-26, F12).** The login differential above proves only *"not staging"*; it does **not** by itself prove *"production"*, which is what this entry asserts. The reviewer settled it directly and read-only, by fetching each deployed bundle and reading its baked-in Firebase config:

| Deployment | `authDomain` in the served bundle |
|---|---|
| `agencytrack-git-staging-…` | `agencytrack-staging` |
| `agencytrack-git-feat-planner-week-nav-…` | **`agencytrack-2a610`** ← PRODUCTION |

Cite **this** table, not the login differential, when the claim is questioned: it is a direct observation of the artifact rather than an inference from a failed credential, and it is reproducible without any account. Method: `setupBypassSession` → `GET /login` → fetch each `script[src]` / loaded `.js` chunk → match `/([a-z0-9-]*agencytrack[a-z0-9-]*)\.firebaseapp\.com/`. (A `projectId:"…"` match is unreliable — it did not appear in the emitted chunks; the `authDomain` host does.)

**Why the old entry misread this.** The observed symptom in PR #852 (a feature-branch preview failing to authenticate) is real — but the cause is **not** an authorized-domains allowlist protecting the backend. The staging account simply **does not exist in the production project**, so the credential is rejected. The old entry read "login failed" as "the preview cannot reach a live backend," which inverts the actual risk.

**The real risk this creates.** A preview driven with **production** credentials would authenticate normally and **read and write the live tenant**. Anyone smoke-testing a feature-branch preview with a real account — the exact thing CLAUDE.md § Workflow tells us to do before merging ("Always smoke-test the preview URL in incognito") — is operating against production. For a READ-only click-through that is merely surprising; for any **mutating** smoke it writes to live data. This is why the old "this is good, a public preview can't reach a live backend today" reassurance is actively misleading and has been struck.

**Falsification (Rule 23):** overturned if a feature-branch preview is shown to carry `agencytrack-staging` in its bundle (`grep agencytrack-staging dist/assets/*.js` on a preview-equivalent build) **and** a staging account logs into it — i.e. if remedy (b) below lands, or if Vercel env scoping changes. Re-verify with the same two-target login comparison; do not assume.

### Remedy (a) — CODE: generalize the pre-write project guard to every mutating smoke · **OWN SMALL PR, do not bundle**

`smoke-planner-week-nav.mjs` now carries a **pre-write project guard**: before the first write it decodes observed request URLs (Firestore URL-**encodes** `projects%2F<id>`, so a naive `/projects/([a-z0-9-]+)/` regex finds nothing), asserts the resolved project is `agencytrack-staging`, asserts zero `agencytrack-2a610` traffic, and **aborts before mutating** on either failure. This matters because `assertLegHygiene` only checks prod-cleanliness at the **END** of a run — i.e. after the write has already landed.

**SPEC CHANGED 2026-07-26 by the external review (F11) — this is NO LONGER a positional pre-write check.** The shipped version has two weaknesses that must not be generalized as-is:

1. **Positional, not enforcing.** It runs once, before the *single* known write. Add a second write leg later and it is silently uncovered — the guard does not intercept anything, it just happens to sit earlier in the script.
2. **It edits the evidence.** It mutates `ctx.capture.consoleMessages` to get past `assertLegHygiene`. Bounded and logged, but "adjust the capture until the gate passes" is a pattern that **will** be copied into smokes where it hides something real.

**Build it as a NETWORK INTERCEPTOR instead.** In the shared context factory (`newLegContext`), attach a route handler that inspects every request and **aborts outright** any Firestore/Firebase call whose resolved project is not the expected one — decode the URL first (Firestore URL-**encodes** `projects%2F<id>`) and match `authDomain`/`projects/` alike. Properties this buys that the positional check cannot:

- covers **every** write path, present and future, including ones added years later;
- fails at the **request** layer, so a stray prod write is impossible rather than merely unlikely;
- needs **no** capture mutation — nothing to sanitize after the fact, because the bad request never happens;
- applies to reads too, so a misconfigured target cannot even *read* live data.

Keep the fail-closed posture: abort the run when the expected project cannot be positively identified. Read-only smokes benefit as well, so wire it in the factory rather than per-smoke. Still **its own small PR**, not bundled into #875. When it lands, simplify `smoke-planner-week-nav.mjs` to drop both its positional guard and the `consoleMessages` mutation.

### Remedy (b) — CONFIG: **OPERATOR ACTION ITEM**

Bind the staging Firebase env vars to Vercel's **Preview environment**, not only to the `staging` branch, so every feature-branch preview builds against `agencytrack-staging`. Until then, treat every feature-branch preview as **production-bound** and never point a mutating smoke at one. Interim workaround, proven in the planner week-nav track: build with `npm run build -- --mode staging` (vite mode precedence makes `.env.staging` override `.env.local`), verify the bundle (`agencytrack-staging` present, **zero** `agencytrack-2a610`), and serve locally.

_Original entry, preserved struck through:_

~~**Vercel preview env scoping — confirm branch previews get no live backend (LOW).** Feature-branch Vercel previews are public. Firebase Auth's authorized-domains allowlist currently blocks them from authenticating (confirmed the hard way during the Run-4 polish PR #852 — a feature-branch preview's login failed with a CORS rejection from `identitytoolkit.googleapis.com`, isolating cleanly to Auth before any app code ran) — this is good, it means a public preview can't reach a live backend today.~~ **The symptom was real; the mechanism and the "this is good" conclusion were both wrong — see above.**

---

---

## Vitest on Windows — worker contention flakes under concurrent runs (banked 2026-07-10, Run 4, LOW — tooling hygiene)

Launching multiple concurrent full `npx vitest run` processes on this Windows dev environment produces `STACK_TRACE_ERROR` worker-contention flakes (observed repeatedly across Run 4's build agents) — not real test regressions, confirmed by re-running singly. Current workaround: **serialize test-suite runs, never launch two full-suite `vitest run` invocations concurrently.** Worth a `pool`/`poolOptions` config look (`vite.config.js`) to see if a `forks`/`singleFork` or reduced-concurrency setting fixes this at the tool level instead of relying on operator/agent discipline — one Run-4 agent's attempted `--pool=forks --singleFork` fix produced a DIFFERENT failure mode (66 spurious cross-file `matchMedia` teardown-pollution failures), so the fix isn't a one-line flag flip.

---

---

## Recon docs must carry a validity-SHA header — new standing rule (banked 2026-07-10, Run 4, LOW — process, candidate CLAUDE.md rule)

Adopted mid-Run-4 after two stale-anchor incidents (recon docs whose claims drifted from the codebase state they described, discovered only when a later session tried to act on them). New convention: every read-only recon/audit doc's first line states the exact HEAD SHA it describes (e.g. `> Validity: describes staging @ \`<sha>\` (DATE). Re-verify claims against HEAD before acting on this doc.`) — applied to `docs/audits/one-on-one-recon-2026-07-10.md` this run. **Candidate for codifying into `CLAUDE.md` § Methodology requirements** as a numbered rule (this file only tracks it as a follow-up per this sync's file-scope restriction — the actual rule addition is a separate, small docs PR).

---

---

## Seeder env-file foot-gun — `seed-fixtures.mjs` silently resets staging/sales_manager passwords without `--env-file` (banked 2026-07-09, promotion session, MEDIUM — operator safety)

`scripts/staging/seed-fixtures.mjs` syncs Auth passwords for `cro`/`sales_manager` fixture accounts at ~L272/L288 from an env var that is `undefined` when the script is run without `--env-file=.env.staging` — the fallback silently resets the account password to a falsy/default value instead of failing. Cost this promotion session: 3 false `LOGIN-AUTH-ERROR` legs before the missing flag was diagnosed. **Fix:** make the script fail loudly (throw) if the password env var is unset, or explicitly document "env-file required" in `SMOKES.md` next to this script's entry.

---

---

## VH leg `t2-financing-k9-k7` flaky on first paint — no FAIL screenshot captured (banked 2026-07-09, promotion session, LOW — verification hygiene)

During the Nexus v2 promotion's VH suite run, the K7 at-risk roster assertion in `t2-financing-k9-k7` fired on first paint once (`Got: ""`), then passed 3/3 on isolated re-runs — a render-timing race, not a real regression. Harden the wait condition to explicitly await the roster row (rather than a generic settle wait), and attach the page to the assertion's throw path so a future failure produces a FAIL screenshot (none was captured this time, making the first occurrence harder to diagnose than necessary).

---

---

## Stale prod IAM binding — expired conditional grant on `cloudbuild` service agent (banked 2026-07-09, promotion session, LOW — housekeeping)

An expired conditional IAM binding (`cloudbuild-connection-setup`, condition `request.time < 2026-05-26`) grants `roles/secretmanager.admin` to the Cloud Build service agent in the production project. The condition has already expired, so the binding is inert — clean it up during a future IAM-hygiene pass (no urgency, no active risk).

---

---

## HARD DEADLINE — Node 20 gen-1 Cloud Functions runtime decommission 2026-10-30 (banked 2026-07-09, promotion session, HIGH — infra deadline)

Google decommissions the Node 20 gen-1 Cloud Functions runtime on 2026-10-30 — functions deploys will start failing after this date without a runtime upgrade (Node 20 was already deprecated 2026-04-30; see § Pending operational state in CONTEXT.md). Additionally, the `firebase-functions` SDK is pinned at 4.9.0 (outdated; upgrading to ≥5.1.0 has breaking changes). **Schedule a dedicated runtime-upgrade window well before October** — this is not a routine housekeeping item, it is a hard external deadline that will break deploys if missed.

---

---

## Rebase `chore/tier0-smoke` onto main before it goes any staler (banked 2026-07-09, promotion session, MEDIUM — branch hygiene)

The `chore/tier0-smoke` branch holds 3 real, not-yet-on-main commits (`smoke-tier0-staging.mjs`, +1153 lines; role-filter fixes; a `SMOKES.md` row) but predates the Nexus v2 redesign — rebasing it surfaces ~264 phantom-conflict files and ~32k phantom deletions against redesign-touched files. **Resolution rule for the rebase:** every conflict on a redesign-touched file resolves to "keep main" — only the branch's genuine additions (the new smoke script, the role-filter fixes, the SMOKES.md row) should apply on top. Then open the PR and hold for review. **Do NOT merge the branch as-is** — a naive merge would revert large parts of the redesign.

---

---

## Motion-verifier prod run — optional, needs `A11Y_<ROLE>_EMAIL`/`PASSWORD` env vars (banked 2026-07-09, promotion session, LOW — optional verification)

The `motion-verifier.mjs` script (built in PR #824) was skipped during this promotion's Phase 3 verification in favor of eyeball acceptance — the promotion session's environment didn't have the `A11Y_<ROLE>_EMAIL`/`A11Y_<ROLE>_PASSWORD` credentials wired for a scripted run. If an objective (non-eyeball) motion baseline on the live prod redesign is wanted, wire the credentials and re-run the verifier against prod.

---

---

## Run-3 candidate worklist — hero-card conformance gaps (banked 2026-07-09, PR #848 recon, MEDIUM — design-conformance backlog)

PR #848's read-only hero-card conformance recon (`docs/audits/hero-card-conformance-2026-07-09.md`) cross-referenced canonical `screens-v2/*.html` mockups against every live screen across all roles and found **7 distinct MISSING build items** (grounding the "no blanket hero cards" ruling in evidence — the design itself is selective about heroes, not blanket). These are good candidates for the next build batch ("Run 3") once picked up from the design-conformance backlog (PR #836):

1. **Agent Daily Capture (modal) anchor hero** — `src/components/daily/DailyCaptureV2.jsx:686-742` collapsed to a slim sticky header (inline flame badge only); mockup calls for a headline sentence + week-to-date progress bar (`screens-v2/dailycap-shared.jsx:149-189`, `DailyAnchorStrip`).
2. **Agent Prospect Prep hero** — feature not built at all; `AgentDashboard.jsx:761` renders `<ComingSoonPanel label="Prospect Prep" />`. Mockup: `screens-v2/prospect-pages.jsx:5-86` (`NextCallHero`).
3. **Financing self-view hero** (shared component, 2 mounts — agent `financing` tab + producing-manager `mp-financing` tab) — `src/components/financing/FinancingSelfView.jsx:265-308` is a flat card; mockup (`design_handoff_track_k/Track K Financing Self-View - Build.html`) specifies a narrative headline + wind-down clock treatment.
4. **UM Team Reports hero-class gap** — `src/components/productionReport/UnitManagerProductionView.jsx:126` renders the same aggregate content as the BM view but as a plain `.card`, not a hero — likely an oversight, not a deliberate distinction.
5. **My WAR hero (UM/BM)** — `src/components/manager/ManagerWarTab.jsx` is a plain form; mockup (`screens-v2/war-v2-desktop.jsx:38-93`, `MyWarCard`) specifies a completion ring + production summary row.
6. **Money Needs hero — flag-flip only, not a build item.** The hero component (`TheSeam` in `MoneyNeedsPanel.jsx`/`MoneyNeedsAllocator.jsx`) already exists but is gated behind `VITE_MONEY_NEEDS_MERGED_ENABLED`, default OFF in production. Sizing: **S** — this is a rollout/regression-check item, not new build.
7. **Meeting Mode opening/summary slide hero (BM)** — `src/components/manager/MeetingMode.jsx:234-263` is a flat 2×2 equal-weight stat grid; mockup (`AgencyTrack Meeting Mode v2.html:154-155`) specifies one primary metric + cascade-bar chart + 3 secondary counts (anchor-first hierarchy).

**Data-architecture design docs for net-new #836 surfaces** (CRO/back-office delivery register, Policy Ledger campaign-proof lens, Awards provenance system, interactive Agent Report View, Settings v2) are tracked separately — see the existing "Data-architecture phase docs" item below; not duplicated here.

---

---

## React Query — DON'T-ADOPT (now); re-evaluate only on a real caching trigger (banked 2026-07-07, PR #830, MEDIUM — architecture)

Recon (`docs/audits/react-query-adoption-recon-2026-07-07.md`) mapped all server-data fetch patterns for the motion pop-in rollout and recommended **not** adopting React Query at this time: the pop-in is a loading-state defect (skeletons fix the visible symptom directly — see the `PanelSkeleton` kit, PR #832) not a caching defect, and adding a foundational dependency + cache-invalidation mental model to a solo non-dev's pre-pilot codebase is poor cost/benefit right now. On the fit axis it is a clean match (only 3 live `onSnapshot` surfaces in the whole non-test tree; ~95% of reads already route through a uniform `src/services/` layer, so it can slot in panel-by-panel later with zero rework).

**Re-evaluation trigger (Rule 23 falsifier — any one of):** a mutation→stale-read bug surfaces; shared data is measured refetching redundantly across panels; live-listener count crosses roughly a few dozen per session (today's curated prefetch-on-idle set from the popin-allroles sweep totals ~6 agent / ~4 UM-BM / ~1 SM / 0 TA). Strongest evidence to settle it either way: a `motion-verifier.mjs` sweep run again after the S1 skeleton rollout lands — if pop-in persists on panels that already have skeletons (per the `docs/audits/popin-allroles-sweep-2026-07-07.md` finding that `policy-ledger`'s existing skeleton did NOT fully fix its pop), that's evidence the defect is caching-shaped after all.

**Not blocking anything today.** No action required unless the trigger fires.

---

---

## Motion pop-in rollout — skeleton kit built, not yet wired to any live panel (banked 2026-07-07, PR #832 harvest + PR #833 worklist, MEDIUM — pre-pilot polish)

`src/components/ui/PanelSkeleton.jsx` (list/card-grid/metric-row/table variants, reduced-motion-safe) exists as a standalone kit but is deliberately not imported by any live component yet. The full panel-by-panel worklist (which panels get SKELETON vs PREFETCH vs BOTH, worst-first/shared-first rollout order) is in `docs/audits/popin-allroles-sweep-2026-07-07.md` — worst offenders are shared panels reused across roles (production-report 47% late-DOM, compliance 55%, leaderboard all 4 roles, policy-ledger 43% despite already having *a* skeleton — footprint-matched skeleton + S2 gentle reveal needed, not just any skeleton shape). Two design-system deltas are flagged in `docs/design-system/skeleton-kit.md` for the operator to settle at rollout time (fill = `bg-surface-muted`+pulse vs the addendum's `--skeleton` gradient token; variant vocabulary vs the addendum's `cards`/`table`/`timeline`/`detail` archetypes).

**Also open:** extend the #829 dashboard-idle prefetch pattern (agent Game Plan only today) to `mp-game-plan` for BM/UM — the manager producer surface was outside the #829 PR's scope and still fails the pop-in check (BM 218ms/30% late, UM 145ms/16% late).

---

---

## Design-conformance backlog — 14 NEEDS-RULING operator decisions block sequencing (banked 2026-07-07, PR #836, HIGH — blocks the active build map)

**SUPERSEDED pointer 2026-07-15:** `docs/audits/design-conformance-2026-07-07.md` (referenced below) was revalidated by `docs/audits/design-conformance-2026-07-12.md` (Rule-17 revalidation against staging HEAD `e65fe143`) — ~76% of the old ~92 MISSING findings had already shipped across Runs 1-5. **The 2026-07-12 doc is now the active build map**, not the 07-07 one; its §4 STILL-VALID backlog (~24 open + ~26 partial-residuals) is what remains. This entry's 14-item NEEDS-RULING list below is still open and unaffected by the revalidation (it was never part of the resolved-findings count) — do not lose it, just redirect any "active build map" reference to the 07-12 doc.

**Tier 0 systemic sweep SHIPPED 2026-07-15 (Runs 5-7 promotion, MERGE_SHA `10670bd7`).** The "§1 four-states/§2 motion/§4 focus-trap/§5 dense-table — Tier 0, no ruling needed" clause below is now DONE — the full Tier-0 systemic sweep shipped this promotion (four-states/swallow-disposition including the dead-error-card reconnect fix, focus-trap verify, dense-table, motion), prod-verified (Tier-0 "manager dashboard renders, error cards absent under success" check passed on `portal.agencytrack.app`). **What remains open: only the 14-item NEEDS-RULING list itself** (below) — nothing has been ruled on it this promotion; it still blocks sequencing past Tier 0 into the rest of the backlog.

`docs/audits/design-conformance-2026-07-07.md` was the active build map (see CONTEXT.md § Active track — now superseded per the note above) but ~30 findings are NEEDS-RULING — valid design elements with no live equivalent where building them is a product/scope call, not a bug fix. The 14 enumerated in the PR body (command palette adopt-or-not, Persistency v2 rolling/per-policy model — Tatil sign-off pending, Policy Ledger campaign-proof lens + Awards provenance system scope, interactive Agent Report View vs download-only PDF, Settings v2 consolidated surface scope, Monthly Recruiting kanban vs no-CRM guardrail confirmation, Campaigns money-adjacent mechanic scope, WARs reviewer workflow, Team Planner vs Money-Needs-reader track confirmation, agent Prospect Prep tab gating, onboarding-wizard unwired-steps dead-code-vs-flow-to-wire, SM cross-branch views timing, Kiosk theatrical surface adopt-or-not, admin exception-lead home rule) block sequencing past the systemic-contract-sweep tier (§1 four-states/§2 motion/§4 focus-trap/§5 dense-table — Tier 0, now SHIPPED, see above). **Action:** operator works through the 14-item list; each ruling unblocks its dependent slice of the backlog. Note the campaign-persistency-gate display rows shipped this promotion (Company Config Recognition section) do NOT close the "Campaigns money-adjacent mechanic scope" ruling — that item is about interactive campaign standings/payout mechanics, not the read-only config display; leave it open.

---

---

## Data-architecture phase docs — net-new surfaces from #836 need dedicated design docs before dispatch (banked 2026-07-07, MEDIUM — process)

Several #836 MISSING findings are **whole unbuilt surfaces with a real data-model shape** (CRO/back-office delivery register + 30-day clawback clock, Policy Ledger campaign-proof lens, Awards provenance system, interactive Agent Report View, Settings v2 consolidated surface) that don't yet have a Phase-7-8-PRD-style design doc the way Tracks D–H do (`docs/phase7-8-PRD.md` + `docs/phase7-8-implementation.md`). Dispatching straight from the conformance audit's one-line MISSING description risks under-specified Phase 1 audits (Methodology Rule 2/17) for anything that needs a new collection or write path. **Action:** before any of these five gets a kickoff brief, author a short design doc (collection shape, write surface, read surface, rules/index needs — the same checklist as CLAUDE.md's "Brief-completeness sub-bullet: enumerate the full architectural unit") rather than briefing directly from the audit line-item.

---

---

## Post-redesign promotion review — no rules/functions changes accumulated during the reskin+conformance-audit window (banked 2026-07-08, LOW — housekeeping/confirmation)

The #824–#839 batch (motion verifier, Game Plan pop-in fix, mobile nav v2, design-docs reconciliation, staging setup) is entirely frontend/docs — `git log` confirms none of the 15 PRs touch `functions/` or `firestore.rules`/`firestore.indexes.json`. This is a **standing confirmation checkpoint, not an open task**: the next session that dispatches a rules- or functions-touching PR out of the design-conformance backlog (e.g. any NEEDS-RULING item that gains a write path) should re-run this check to confirm the promotion-review gate (CLAUDE.md § Workflow — "`firebase deploy` pre-flight", "Additive Firestore rules / Cloud Functions" carve-out) is applied fresh rather than assumed clean from this window. Re-open only if a rules/functions diff is found that bypassed review.

---

---

## EFF Phase-1 — two follow-ups banked from PR #802 bot review (2026-07-05, LOW)

Both surfaced by Gemini + CodeRabbit on the EFF Phase-1 render/read-hygiene PR and dispositioned as bank-not-implement (the frozen-`now` one is a DISAGREE the dispatcher may re-rule at merge; the chunk-util one is OUT-OF-SCOPE per the brief).

1. **`now` memoized with `[]` freezes for the component's mounted lifetime (EFF-009 tradeoff).** `const now = useMemo(() => new Date(), [])` in `AgentDashboard.jsx`, `ManagerDashboard.jsx`, and `useBranchOverview.js` is created once at mount and never updates, so a dashboard left open across a day/week boundary (overnight) shows a stale "today" for the activity-feed cutoff (`buildActivityEvents`/`buildManagerActivityEvents`) and the awards-panel current period (`currentDate` prop). **Why banked, not fixed:** the brief LOCKED `useMemo(()=>new Date(),[])` as the EFF-009 fix, and the whole dashboard is already a mount-time snapshot (submissions/goals fetch once, no live refresh) — a frozen `now` is consistent with that, and any navigation/reload re-mounts and refreshes it. If day-boundary accuracy on a long-open dashboard ever matters, the fix is a day-stable key that updates when the calendar day changes (e.g. `getTodayTT()` recomputed via a low-frequency effect, or a `useState` refreshed on a `setInterval`/visibilitychange) — a design change beyond the brief's locked decision (Rule 1). Sites: `AgentDashboard.jsx` (~:300), `ManagerDashboard.jsx` (~:222), `useBranchOverview.js` (~:30).

2. **Extract a shared `chunk(array, size)` util for the ≤30-id batching loop.** The identical chunking loop now lives in `goalsService.getGoalsForAgents`, `persistencyService.getPersistencyMapForYear`, and `settlementService.getSettlementsForUnit` (three copies). CodeRabbit suggested a single `chunk()` helper so the batch-size constant + slice logic live in one place. **Why banked, not fixed:** consolidating touches `settlementService` (out of scope for the EFF PR) — a mechanical refactor best done as its own small PR with the three call sites updated together + their tests re-run.

---

---

## SEC-012 kiosk branch-scoping — two follow-ups banked (2026-07-05, PR #801 `3d7c391e`)

Banked from the SEC-012 fix (kiosk reads branch-scoped in `firestore.rules` + `getKioskYTDSubmissions` client filter). **SHIPPED + rules DEPLOYED 2026-07-05** (post-deploy prod kiosk ALLOW verified live; emulator 17/17 DENY). Of the two follow-ups banked then, #2 is **PARTIALLY RESOLVED** by the Runs 5-7 promotion (see below); #1 remains fully OPEN.

1. **🚨 BLOCKS SECOND-BRANCH ONBOARDING — AgentOfMonth is a shared per-month doc, not per-branch.** `functions/agentOfMonth/setAgentOfMonth.js:100` writes `tenants/{tid}/agentOfMonth/{monthKey}` (one doc per month per tenant, `{merge:true}`), stamped with a single `branchId` = the last writer's branch. The SEC-012 fix branch-scopes the kiosk AOM read by `resource.data.branchId == request.auth.token.branchId`, which is correct for the single-branch Tatil pilot but breaks once a tenant has 2+ branches: a Branch-A kiosk is denied the current month's AOM whenever Branch-B wrote it last (and vice-versa), and two branches' category winners collide in one doc. Clean fix = data-model change to per-branch AOM docs (e.g. `agentOfMonth/{monthKey}_{branchId}` or a `{branchId}` subcollection), touching the write CF (`setAgentOfMonth`), both read paths (`agentOfMonthService.getAgentOfMonth`, `kioskServices.getKioskAgentOfMonth`), `AgentOfMonthTab`, and the AOM rule. **Must ship before any second branch is onboarded.**

2. **~~Restore a branch-scoped kiosk users-list (real agent names/photos on the kiosk).~~ PARTIALLY RESOLVED 2026-07-15 — real agent NAMES fixed via a different approach than proposed here; roster-only panels (photos/celebrations/compliance) still degrade.** Runs 5-7 (commit `57567868`, Run 7 B-1) fixed the degraded-name problem WITHOUT widening the users-list rules surface this item originally proposed: `KioskShell`/`buildSubmissionNameMap` now sources agent names from the kiosk-already-readable `submissions` docs (which carry `agentName`), threaded into the 5 wired panels — zero new read surface, no rules change. **Prod-verified 2026-07-15** (MERGE_SHA `10670bd7`, `portal.agencytrack.app/kiosk/...`): "Last Week Recap" and "YTD Leaderboard" panels render real names (e.g. "Smoke Agent", "Smoke Roster One–Four", "Smoke Unit Manager"), not the generic "Agent" fallback. **What's still open (the actual remainder of this item):** roster-only panels that need real per-agent PHOTOS or a full roster list independent of a submission (celebrations, compliance, photos) remain deliberately degraded — this needs the CF-written `leaderboards/{branchId}`-style branch-roster aggregate (name+photo+unit only, no email/phone) noted in the original proposal and restated in § Run-7 ranked next-list item 2 above. The original "add a branch-scoped kiosk `list` arm to the `users` rule" approach was explicitly rejected in favor of the submission-sourced fix (avoids opening a new kiosk authorization surface) — do not re-propose it; build the roster-aggregate CF instead.

---

---

## A11y sweep L1-5b — UX-001 designed empty state shipped; A11Y-002 + A11Y-003 verified NOT-actionable (2026-07-05)

**RESOLVED — UX-001 (bare MasterSheet empty state → designed).** `MasterSheet.jsx`'s zero-row state is now a designed block (`mastersheet-empty`: icon in a soft circle + headline + guidance), with distinct copy for the search-filtered vs genuinely-empty-week cases, replacing the bare centered caption. Note: an explicit in-table message ("No submissions for this week yet.") had actually existed since `bf1f0c52` (2026-04-29) — the audit's "empty white box, no message" claim was stale; this PR delivers the *designed* upgrade the finding's recommendation aspired to. Smoke: `scripts/verification/smoke-mastersheet-empty-state.mjs` (search-empty path, both themes).

**NOT-A-BUG — A11Y-002 (login ignores dark preference).** Empirically falsified on production (2026-07-05): with `localStorage['agencytrack-dark']='1'` set before load, the login page renders dark (`documentElement.classList.contains('dark')===true`, body bg `rgb(26,22,18)`). It only stays light when the key is set to `'true'` (the wrong value) — exactly the Rule-10 trap the run brief warns about (`agencytrack-dark = '1'`, not `'true'`). `main.jsx:19-21` applies the class pre-mount for all non-kiosk paths, and `LoginScreen` has `dark:` variants. No code change; finding retired.

**ALREADY-COMPLIANT — A11Y-003 (Money Needs share toggle 16×16).** The interactive target is the `<label>` wrapping the checkbox, measured **606×44** on production (`min-h-[44px]`, full-width, click-through) — satisfying WCAG 2.5.8 (≥24px) and the Nexus 44px rule. The audit measured the 16×16 `<input>` node, not the actual click target. The `min-h-[44px]` label wrapper is precisely the audit's own recommended fix ("an enlarged label/tap wrapper"), landed via the money-needs UX rounds (#716/#738) before the audit. No code change.

**OPEN (banked, LOW) — screen-internal `<h1>` → `<h2>` demotion.** After L1-5a the topbar is the page `<h1>`; the ~3 screens that already had their own content `<h1>` (e.g. Game Plan) now render two h1s (valid HTML5, net-better than the prior zero-h1 state, but not ideal one-per-page). Demote those screen-internal h1s to h2 in a follow-up.

---

## A11y sweep L1-5a — RESOLVED (2026-07-05, PR `fix/a11y-h1-topbar-skiplink`) + one banked wayfinding item

**RESOLVED — A11Y-001 (no `<h1>`), UX-101 (static "Dashboard" topbar title), A11Y-103 (no skip link).** The topbar title element is now a semantic `<h1>` (`Topbar.jsx`), giving every screen exactly one heading app-wide (a central fix — no 33-screen sweep). The agent title is dynamic via `tabTitleFromItems(navItems, activeTab)` (`navConfig.js` + `AgentDashboard.jsx`), so it names the active surface ("Awards", "Game Plan", …) instead of a static "Dashboard". A visually-hidden "Skip to main content" link is the first focusable in `Shell.jsx`, targeting `#main-content`. Source: audit `docs/audits/webapp-ux/agencytrack-webapp-ux-followup-2026-07-04.md` (UX-101, A11Y-103) + `docs/audits/ux/agencytrack-ux-audit-2026-07-04.md` (A11Y-001).

**OPEN (banked, LOW) — Manager/Admin dynamic per-screen topbar title.** `ManagerDashboard.jsx` and `TenantAdminDashboard.jsx` still pass a static `topbarTitle={`Welcome back, ${displayName}`}` (now rendered as their `<h1>` — so A11Y-001 is satisfied, but the heading is identical on all 16 manager / 5 admin screens, poor wayfinding). Making it dynamic (active nav label, mirroring the agent fix) is a small change, but it removes/relocates the "Welcome back" greeting — a product decision (keep the greeting on the landing/overview tab only? move it to the crumb?). Deferred out of the auto-merge sweep for that reason. Resolve by threading the active-tab label through `tabTitleFromItems` for both dashboards once the greeting-placement call is made.

---

---

## ~~BUG-102 — Week number disagrees between dashboard topbar and Daily Capture~~ — RESOLVED (2026-07-05, PR `fix/bug102-week-number-unify`) + one banked functions item

**RESOLVED (display unification).** A shared floored, Sunday-anchored `weekNumber(dateOrStr)` helper now lives in `src/utils/dateHelpers.js`; the three display formulas unified onto it: `AgentDashboard.jsx` topbar crumb (was UNFLOORED — drifted intraday, the "Week 28" defect), `GamePlanV2/index.jsx` suggested-week label (same unfloored shape), and `DailyCaptureV2.jsx` (local `isoWeekNumber` deleted; behavior preserved — it was already floored/correct). Live-`Date` inputs normalize to the LOCAL calendar day first, so an evening Trinidad (UTC−4) time cannot roll to the next UTC day and diverge from Daily Capture's date-string path. Unit tests (`src/utils/__tests__/dateHelpers.test.js`) pin 2026-07-04→27, 2026-07-05→28, year boundaries, the TT-evening case, and Date-vs-string parity. `periodUtils.js`'s `isoWeekNum` (manager roster) was already floored/correct and is left untouched (minimal diff). Finding source: `docs/audits/webapp-ux/agencytrack-webapp-ux-followup-2026-07-04.md` § BUG-102.

**OPEN (banked, functions-surface — needs human merge + `firebase deploy --only functions`): `weekOfYear` in `functions/index.js` (~line 1500) is a THIRD week-number convention.** `Math.ceil((Date.now() - jan1)/(7·86400000))` — no day-of-week offset at all, unfloored — gates the `mdrt_pace` badge (`weekOfYear <= 26 && ytdAPI >= 250000`) persisted to `leaderboard/{uid}` in `onSubmissionWrite`. It is never rendered, so it does not visibly disagree with the unified frontend helper, but the "by mid-year" cutoff sits on a different calendar basis, and the offset difference can shift the computed week by ~1 near the boundary — for an awards/gamification gate that deserves a deliberate human decision (align to the shared floored logic, or leave and document the convention). Deliberately excluded from the BUG-102 frontend PR per the autonomous-run merge boundary (Rule 19 / run Rule 1). Related: the gamification MDRT thresholds third-source note in § Goals v3 closure sweep.

---

---

## QuickAddMenu (mobile ＋ bottom sheet) lacks a visible close affordance (LOW, a11y-parity)

Surfaced during the fu-mobile-nav Phase 0 recon (2026-07-05, PTR-fix PR). `src/components/shell/QuickAddMenu.jsx` — the Quick-Add bottom sheet opened by the center ＋ FAB on mobile — dismisses correctly via backdrop tap (`QuickAddMenu.jsx:136-140`), Escape (`:39`), and returns focus to the trigger on close (`:32`), but has **no visible close/back button**, unlike its sibling `MobileNavDrawer.jsx` which ships a 44px X button (`aria-label="Close menu"`, `MobileNavDrawer.jsx:90-97`). Touch-only users who don't know the backdrop convention have no *discoverable* exit. Fix shape: add the same X header button pattern (44px target, `focus-visible` ring, both themes) to the mobile sheet variant. LOW severity — two working dismiss paths already exist; this is discoverability parity, not a trap. Note: the operator-reported "More menu / plus trap" was falsified at Phase 0 against current source (dismiss paths shipped in #726/#727/#731); this residual gap is the only real finding from that recon.

---

---

## Wizard draft-gate — two CodeRabbit nitpicks banked from PR #794 (LOW, deferred as out-of-scope)

Both surfaced on the BUG-101 fix PR and dispositioned **OUT-OF-SCOPE** (valid, but expand the scope-locked bugfix). Neither is a data-integrity defect.

1. **Extract a shared `DraftLoadingSpinner` component.** The step-loading block and the pre-existing Confirm-loading block in `WizardForm.jsx` are near-identical (wrapper classes, `role="status"`/`aria-live`, `Loader2`, "Loading your week…" copy). Extracting a shared component would de-duplicate and prevent a11y/copy drift — but it rewrites the untouched Confirm block and adds an abstraction the BUG-101 brief explicitly said to avoid ("do not invent a new mechanism"). Deferred.

2. **Disable the footer Next while `!draftLoaded` on the step screen.** The step-body gate introduced a "footer visible, body still loading" window. Clicking Next during that window advances the (loading) step; in the extreme — a very slow mobile connection + ~11 rapid taps to reach step 12 — `handleSubmit` could fire before `draftStatus` resolves and submit an empty report. Remote, but real. The one-line fix is `disabled={submitting || !draftLoaded}` on `wizard-v2-next` (keep Back enabled as an escape hatch). Deferred here because it cascades into the `openWizard`/`next()` test helpers across `WizardFormV2RetirementR1/R2`, `WizardFormV2PayloadIdentity` (which click Next immediately after mount, before `getDraft` resolves) — each must first wait for the step body (`wizard-v2-step-1`) to render. A tidy standalone slice: add the disable + update those helpers to await the step body.

---

---

## Goals v3 closure sweep — two items resolved, two banked (2026-07-04, PR #792 `41935ef8` goals-v3-closure-sweep)

**RESOLVED — two unreconciled MDRT constants.** `src/constants/mdrt.js` (`MDRT_THRESHOLD = 500000`, legacy flat) and `src/config/mdrtThresholds/2026.js` (`MDRT_THRESHOLDS_2026`, three-tier premium method, landed via #643) coexisted with no shared source. All consumers (`AgentReportDocument.jsx`, `HeroCard.jsx`, `HeroCard.test.jsx`) migrated to `MDRT_THRESHOLDS_2026.mdrt` (688,800); `src/constants/mdrt.js` deleted; zero repo-wide references remain.

**RESOLVED — AwardsReachPanel silently used the engine's DEFAULT_RULESET_2026 fallback instead of the tenant's merged ruleset.** `AwardsReachPanel.jsx` never imported a ruleset at all — it called `computeAgentAwards(...)` without a 5th arg, which fell through to `awardsEngine.js`'s own `ruleset = DEFAULT_RULESET_2026` default parameter. Fixed by threading a `ruleset` prop through (mirroring `AgentAwardsPanel`'s existing prop-based pattern — no new fetch, no new loading/error state): `AgentDashboard.jsx` now passes its already-fetched `ruleset={awardsRuleset}` ([AgentDashboard.jsx:207](../src/components/dashboard/AgentDashboard.jsx) `getMergedAwardsRuleset` fetch) to the mount that was missing it.

**OPEN — GoalsPanel.jsx (manager self-view) AwardsReachPanel mount still has the same latent gap, left unfixed by design.** `GoalsPanel.jsx`'s own `AwardsReachPanel` mount (~line 618) also omits a `ruleset` prop — but unlike `AgentDashboard.jsx`, **`GoalsPanel.jsx` never fetches a merged ruleset at all** (zero "Ruleset" references in the file). Per dispatcher direction, no new fetch was added to avoid introducing a second independent ruleset-fetch pattern outside this PR's scope. Any future tenant that sets an `awardsRuleset_{year}` override will see it reflected in the agent Goals tab but NOT in the manager self-view's Awards Reach panel until this is addressed — resolve by giving `GoalsPanel.jsx` its own `getMergedAwardsRuleset` fetch (mirroring `AgentDashboard.jsx`'s pattern) and threading it to both `AwardsReachPanel` and `MdrtTracker`/`DerivedIncomePanel` consumers as applicable.

**OPEN — DerivedIncomePanel blended-rate math decision, gated on this PR's Phase 5 recon rider.** `DerivedIncomePanel.jsx` computes income as flat `committedAPI × (commissionRate / 100)` rather than reusing Commission Playground's `modeMix`-weighted `commissionMath.js` functions, as `docs/goals-v3-spec.md` originally intended. Recon verdict: **PARTIAL** — real per-policy `proposedFrequency` data exists (`policiesService.js` `VALID_FREQUENCIES = {'A','S','Q','M'}`) but only for agents on the Policy Ledger (`usesPolicyLedger` flag, Track H MVP — not universal); weekly submissions (`extractFields.js`) carry no mode/frequency field at all; and Commission Playground's `modeMix` is not persisted anywhere — its one production call site (`CommissionAnchorStrip.jsx:103`) always falls back to `DEFAULT_MODE_MIX` (100% annual) in `commissionAnchor.js`. A real blended-math migration would need to branch on `usesPolicyLedger` (real modeMix from policies) vs. the non-ledger majority (no better source than today's flat rate, or a new modeMix capture surface). Decision NOT made in this PR — CD + Kyron call per the original spec's "NOT to be guessed autonomously" gate.

**Adjacent discovery, not fixed here (out of scope) — a THIRD independent MDRT threshold source.** `functions/lib/gamificationConfig.js` / `src/lib/gamificationConfig.js` hardcode their own literal MDRT-adjacent thresholds for badge stubs (`mdrt_qualified`: `ytdApi >= 500000`; `mdrt_pace`: `ytdApi >= 250000 && weekNum <= 26`) — independent of both `MDRT_THRESHOLDS_2026` and the now-deleted `MDRT_THRESHOLD`. Not touched by this PR (gamificationConfig doesn't import either constant; a badge-threshold change is a distinct scope/risk profile — gamification config touches the shared CJS/ESM mirror pair and scoring). Worth a future reconciliation pass once/if MDRT badge thresholds are meant to track the same 2026 figures.

---

---

## Game Plan manager surface — Fork B: whole-plan suggest-back (banked 2026-07-03, PR #785 post-merge fill, MEDIUM — follow-on track)

**Origin:** PR-GPM1 (#785, `95529a75`) shipped Fork A only — the UM/BM read-only Team Plans reader on the G5 consent-share arms. The brief explicitly deferred Fork B as the follow-on track.

**Scope (from the GPM1 brief's NOT-in-this-PR list):**
1. **`yearPlan`/`monthlyPlan` manager read rules** — ~~consent-gated UM/BM reads (same shape as the G5 moneyNeeds arms)~~ **SUPERSEDED by dispatcher ruling (2026-07-03, Fork B recon @ `1e8e0d3e`): reads are UNCONDITIONAL-upline (UM same-unit / BM same-branch / SM / TA / PA), mirroring weeklyPlans — NO visibility gate; only moneyNeeds keeps the opt-in. RESOLVED by PR #787 (`f315babd`, 2026-07-03 — rules arms + honesty copy + emulator matrix 41/41 + 30/30); live-leg verification deferred post-deploy (see the PR-B1 deferred-verification FU below).**
2. **Suggest-back card** — manager proposes an adjustment back to the agent (suggestion store, agent accepts/dismisses; NO lock/approve — design-forbidden).
3. **Plan-health checklist cards** — derived plan-completeness/coherence signals on the roster/drawer.
4. **SM surface stays dormant** (`shareWithSm` has no live write path — see the corrected `shareWithSm` FU below).

**Reuse anchors:** `TeamPlansRoster`/`AgentPlanDrawer` (#785), `getSharedMoneyNeeds` denied→notShared mapping, the locked SHOWN/PRIVATE projection-contract test shape (`TeamPlansRoster.projection.test.jsx`).

**Falsification:** moot if the Game Plan loop store is redesigned before Fork B lands, or if the product decision changes to keep managers out of yearPlan/monthlyPlan entirely (reader-only forever).

---

---

## PR-B3 housekeeping — stale pre-deploy comment in `smoke-plan-suggestions-b3.mjs` (banked 2026-07-04, LOW)

**Origin:** the M3 quiet-empty assertion's inline comment/label ("agent-own read denies pre-deploy → renders nothing") no longer describes reality now that the planSuggestions rules are deployed — the leg still passes post-deploy, but because the agent has zero suggestions at that point in the run, not because of a permission denial. Cosmetic only; not a defect (confirmed via a fresh production run, 2026-07-04, 8/8 PASS).

**Scope:** reword the M3 assertion label/comment in `scripts/verification/smoke-plan-suggestions-b3.mjs` to describe the post-deploy "empty state" contract rather than the pre-deploy "denied" contract, so a future reader isn't misled about why the leg is green.

**Falsification:** moot if the script is retired in favor of a unified pre+post-deploy smoke (see the tooling follow-up above).

---

---

## PR #791 — `live-b3-post-deploy.mjs` hardening (banked 2026-07-04, LOW — Rule 21 out-of-scope carry)

**Origin:** PR #791 (landing `scripts/verification/live-b3-post-deploy.mjs` as standing tooling) locked "no logic changes" — the script's 9/9 evidence predates the PR and a logic fix would contradict that closure evidence. CodeRabbit (6 inline comments) and Gemini both surfaced real hardening gaps; all dispositioned OUT-OF-SCOPE for #791 and banked here as one follow-up.

**Scope:**
1. `restPatch` doesn't check HTTP status on the visibility-flip write or the cleanup-restore write — a failed patch is silently treated as success (2 sites: seed flip, final restore).
2. `firebase-admin` require + `admin.initializeApp` aren't wrapped in try/catch — a missing `functions/node_modules/firebase-admin` or `service-account-key.json` throws a cryptic error instead of an operator-actionable message.
3. No tenant guard on the UM token before it's used in a production mutation (only the agent token is guarded).
4. Fixture reads (`firestoreGet` for moneyNeeds/yearPlan) and the visibility-flip patch don't check `.ok` before use — a 403/404 silently becomes zero-valued Rule 22 inputs.
5. If a denial-test POST (L3a/L3b) unexpectedly succeeds (rules regression), the created doc isn't tracked for cleanup — only `createdSuggestionName` (the legitimate L1 doc) gets deleted.

**Falsification:** moot if the script is retired in favor of a unified/hardened smoke, or if a future rules change makes the denial legs structurally incapable of an unexpected-success outcome.

---

---

## EFF-004 follow-ups — MDRT badge backfill · threshold reconcile · YTD year-attribution (banked 2026-07-05)

**Origin:** EFF-004 (PR #805, `9dcae1a3`) fixed `onSubmissionWrite`'s YTD reducer to count v2 `newBusiness.api` via the canonical `extractTotalProductionCredit`. **Deploy state:** merged; `firebase deploy --only functions` pending as of banking (a live `tatillife_smoke` smoke confirmed the fix is not yet live). Three adjacent items banked (out of #805's scope per Rule 7):

1. **MDRT badge backfill (LOW — self-healing).** v2 agents who should already hold `mdrt_qualified`/`mdrt_pace` are missing them (the buggy reducer computed YTD=0). Badges are add-only and the YTD scan re-runs on every submission, so the fix **self-heals on each agent's next submission post-deploy**. Decision: accept self-heal (fine for pilot) vs a one-shot backfill (re-trigger `onSubmissionWrite`-equivalent for active v2 agents). No autonomous backfill was run. **Falsification:** overturned if an agent who won't submit again this year needs the badge before year-end.

2. **Server MDRT badge threshold vs client (MEDIUM — money/eligibility).** ~~The server badge thresholds are the legacy flat **500,000 / 250,000**~~ **→ ADDRESSED by HELD PR #807 (L1-1, mixed-run-2, 2026-07-05).** `mdrt_qualified` now gates on `MDRT_QUALIFIED_API = 688,800` (functions-side named constant mirroring the client `MDRT_THRESHOLDS_2026.mdrt`). The freed-up 500k became the new `tenure_floor_met` marker (API ≥ 500k AND ≥ 5yr from contract). `mdrt_pace` (250k) left as a separate half-year pace target — **surfaced open question:** should pace track to 344,400 (half of MDRT) rather than 250,000 (half of the old 500k)? Owner decision, not in L1-1 scope. Closes fully at #807 merge+deploy.

3. **YTD year-attribution (MEDIUM — money-math; from Gemini HIGH on #805).** ~~The YTD filter uses `thisYear = new Date().getFullYear()`~~ **→ ADDRESSED by HELD PR #808 (L1-2, mixed-run-2, 2026-07-05).** The attribution year now = `String(after.weekStarting).slice(0,4)` (leading-4-char, UTC-4-safe — not a Date parse), used for both the YTD filter and the `mdrt_pace` week-of-year base. A Dec-`weekStarting` submission entered in January counts toward the prior year; a straddle week attributes entirely to its `weekStarting` year. +4 tests. Closes fully at #808 merge+deploy.

---

---

## L1-1/L1-2 follow-ups — badge semantics · test-mock consolidation · mdrt_pace hardening · mdrt_pace target (banked 2026-07-05, mixed-run-2)

**Origin:** L1-1 (HELD PR #807, MDRT threshold + `tenure_floor_met`) + L1-2 (HELD PR #808, YTD year-attribution). Bot-review dispositions (Rule 21) surfaced out-of-scope items:

1. **Badge achievement-vs-status semantics (MEDIUM — product/gamification; from Gemini HIGH on #807).** Every gamification badge is written with sticky `addIfNew` — **none is ever deleted once earned**, including `mdrt_qualified` and the new `tenure_floor_met`. Gemini flagged that `tenure_floor_met` "remains indefinitely" if an agent later drops below the 500k floor (YTD resets each Jan 1). This is a **system-wide product decision**, not a defect in L1-1: badges are currently ACHIEVEMENTS (sticky), not STATUS indicators. **If** the owner wants status-semantics (badge clears when the current-year criteria lapse, re-earns mid-year), the change is a one-liner (`else { existingBadges.delete(key); }`) **but must be applied consistently to `mdrt_qualified` too** — deciding it for one badge and not the others is the inconsistency to avoid. Decision deferred to the owner (surfaced on #807). **Falsification:** overturned if the owner rules the floor marker is a per-year status, in which case implement the delete-arm across all YTD badges consistently. functions/ change → human-merge + deploy.

2. **`onSubmissionWrite.test.js` mock consolidation (LOW — test hygiene; from CodeRabbit + Gemini on #807).** `makeYtdAdminMock` (+ `mkDoc`/`badgesFrom`/`YEAR`) is duplicated per-`describe`-block (pre-existing at :186; L1-1 added two more copies; L1-2 a fourth). Both bots suggest hoisting to a single module-level helper (~100 lines saved). Deferred to avoid expanding the money PR into a pre-existing-code refactor across the stacked L1-1/L1-2 pair. Pure test-only cleanup; do in a standalone test-hygiene PR after L1-1/L1-2 land. **Falsification:** trivial — overturned only if the per-block copies diverge (they must not; they are identical today).

3. **`mdrt_pace` future-year guard (LOW — money-badge edge; from Gemini on #808).** ~~(b) target reconcile~~ **→ RESOLVED: owner decided 2026-07-05 that `mdrt_pace` uses 344,400** (the T&T MDRT commission-method requirement, half of the premium-method 688,800). Shipped in the **#807 amend** (`94b21d5e`, `MDRT_PACE_API = 344_400`, both config twins + 4 fake-timer tests; #808 rebased onto it → `d0c87620`). **Still open (a):** **future-year guard** — a future-dated `weekStarting` (data error) with YTD in [344,400, 688,800) yields a negative `weekOfYear` that passes `<= 26` → a spurious sticky `mdrt_pace`; guard `weekOfYear >= 1`. (`/^\d{4}$/` already zeroes `ytdAPI` for non-4-digit years, so the invalid-`Date.UTC`-arg case already short-circuits to no-pace.) Also (Gemini re-review) a trivial micro-opt: defer the `weekOfYear` compute until after `ytdAPI >= MDRT_PACE_API` — DISAGREED (negligible cost), noted here for completeness. functions/ change → human-merge + deploy. **Falsification:** the guard is overturned if `weekStarting` is already validated non-future upstream (then no guard needed).

---

---

## EFF-002 Phase 2 — per-manager-tab code-splitting + Rollup `manualChunks` vendor/icon grouping (banked 2026-07-05, MEDIUM)

> **UPDATE 2026-07-05 (mixed-run-2):** the **`manualChunks` vendor-grouping half SHIPPED as HELD PR #809** (`vite.config.js` — 5 named vendor chunks, 0 sprawl, `vendor-pdf`+`ManagerDashboard` stay lazy, adversarial smoke 66/66). **Remaining = the per-manager-tab lazy split** (scoped in #809's body): lazy the ~16 heavy tabs behind one Suspense + `ChunkLoadErrorBoundary`, keep Overview + full-screen early-returns eager, **update the 4-5 tests that mount `ManagerDashboard` to be Suspense-aware** (`ManagerDashboardFastPath`/`ManagerDashboardLeaderboardTab`/`ManagerDashboardMyProduction`/`AgentDashboardNav`/`AppResetGuard`), re-run the smoke both themes. `manualChunks` (now in #809) prevents the tiny-chunk sprawl that reverted the first attempt.


**Origin:** EFF-002 **Phase 1** (lazy the 3 role dashboards behind `<Suspense>`) SHIPPED via PR #804 (`2b13bdd4`, 2026-07-05) — entry chunk **644.85 → 221.80 kB gzip (−65.6%)**, agent never fetches the manager/tenant-admin chunks (adversarial smoke 66/66, incl. the chunk-load error boundary safety FU). **Phase 2** (lazy-splitting the heavy `ManagerDashboard` tab panels) was implemented + verified, then **reverted before ship** and banked here.

**Finding (Rule 23 — verified empirically at two granularities):** lazy-ing the manager tab panels slims the `ManagerDashboard` base chunk substantially — **96.59 → 14.68 kB gzip** at full 29-panel granularity, **→ 35.55 kB gzip** at a 16-heavy-panel granularity — deferring each heavy panel to its own tab chunk. BUT it fans shared leaf modules (lucide-react icons + small utils shared with the now-lazy `AgentDashboard` chunk) out into **dozens of tiny chunks** (~50 at 29 panels, ~36 at 16 panels; the Phase-1 baseline is **0** tiny chunks). That is the "dozens of tiny chunks" the code-split brief explicitly cautioned against. All tabs render correctly (smoke walked all 14, 0 chunk failures, no waterfall — the tiny chunks are parallel leaf loads), so it is a topology/best-practice concern, not a functional break. The benefit is **manager-only** (managers are few, on desktop) and marginal vs Phase 1's agent-path win.

**Root cause:** without a Rollup `build.rollupOptions.output.manualChunks` strategy grouping vendor libs into a few stable chunks, per-component `lazy()` extraction sprawls. The clean fix **pairs** the tab-splitting WITH a `manualChunks` vendor/icon grouping — a build-config architectural decision (Methodology Rule 1: surface before adding a new build-config pattern), which is why it was **not** done unilaterally in the autonomous run.

**Scope to resolve (do these together):**
1. **`vite.config.js` `manualChunks`** grouping `lucide-react` (or a curated icon set), `recharts`, and the firebase SDK into named vendor chunks — dispatcher-approved (build-config).
2. **Re-apply the ManagerDashboard tab lazy-splitting** (heavy panels: `UserManagementPanel`, `CommissionPlayground`, `FinancingTab`, `GamePlanV2`, `PolicyLedgerPanel`, `GoalsPanel`, `MoneyNeedsPanel`, `UnitFinancingRoster`, `TeamPlansRoster`, `CompliancePanel`, `ProductionLeaderboardSurface`, `TeamPerfRosterPage`, `ProductionReportTab`, `ProfileScreen`, `PersistencyTab`, `PolicyReconciliationPanel`) behind one content-area `<Suspense>` inside `<Shell>`; keep Overview (default), `Shell`, the `mp-goals` composite panels, and the full-screen early-return flows (`WizardForm`/`MeetingMode`/`DailyCaptureV2`) eager. The reverted diff shape is documented in `docs/audits/eff002-run/RUN-LOG.md`.
3. **Re-run the committed adversarial smoke** `scripts/verification/smoke-eff002-code-splitting.mjs` (already walks every manager tab + slow-network Suspense fallbacks in both themes).
4. Consider **EFF-013** (inline-SVG KPICard sparkline) in the same pass to remove Recharts from the agent path entirely — Phase 1 moved Recharts out of the *entry* chunk, but the agent still pulls it via the default-view KPICard sparkline.

**Falsification:** overturned if a `manualChunks` config + tab-splitting yields a clean topology (few chunks, no tiny-chunk sprawl) with the manager-base reduction preserved — then the pairing is validated and should ship. Also overturned if a measurement shows the tiny-chunk count is a non-issue on Vercel's HTTP/2 edge (caching benefit > request overhead), in which case Phase 2 ships as-is.

---

---

## PR-B3 fast-follow — notify-on-send ping for plan suggestions (banked 2026-07-04, LOW — K10b precedent)

**Origin:** PR-B3 deliberately shipped NO notification ping when a manager sends a plan suggestion (locked design, K10b precedent — the collection is the record; the agent sees unread emphasis on their next hub visit). A push/in-app notification on send would shorten the feedback loop.

**Scope:** on `createPlanSuggestion`, enqueue a notification to the agent (`notifications/{id}` or the existing notification service) — "Your manager suggested a change to your plan." Mirror the existing notification write paths; no new collection. Agent taps → Game Plan hub (the PlanSuggestionsCard already marks seen on view).

**Falsification:** moot if the product decision keeps suggestions strictly pull-only (agent checks their hub), or if a broader plan-activity digest supersedes per-suggestion pings.

---

---

## `tatillife_south` null-unitId agent — data fix, live tenant (banked 2026-07-03, PR #785 Phase 0.4 probe, MEDIUM — production data integrity)

**Finding:** the #785 Phase 0.4 read-only Admin-SDK population probe found exactly one agent with `unitId == null` in the live tenant: `tatillife_south` / uid `C94hjdd6GXfdim9EfgPYAAIbDOJ2` (12 agents probed, 0 null branchId; `tatillife_smoke` fully clean 6/6). A null unitId silently drops the agent from every UM roster surface (K10a Unit Financing roster, #785 Team Plans roster, and the `financingEscalations` create arm's unit check) — BM/branch surfaces are unaffected.

**Cross-reference:** this is the SAME uid as the known orphan user tracked in [issue #25](https://github.com/Kelsean868/agencytrack/issues/25) (Firestore doc with no Auth user; "do not auto-delete; investigate first"). The two findings are almost certainly one root cause: an abandoned/half-provisioned account. Resolve jointly — if the investigation concludes the doc should be deleted, the null unitId goes with it; if the account is to be kept, the fix is populating `unitId` (and creating the Auth user).

**Action:** operator/dispatcher investigation per issue #25 first; then either (a) delete the orphan doc (closes both), or (b) backfill `unitId` via an Admin-SDK script with the Rule 5/6 dry-run pattern. STOP-IMMEDIATELY territory for CC — live-tenant data mutation is a dispatched, operator-confirmed action only.

**Falsification:** moot if issue #25's investigation deletes the doc, or if a future user-doc integrity sweep (validation dashboard K8 territory) supersedes single-doc fixes.

---

---

## `onFinancingEscalationCreate` — filter inactive BM recipients + friendly reason labels (banked 2026-07-03, Rule 21 post-merge backstop, LOW — quality hardening)

**Origin:** Gemini's on-demand re-review of PR #783 (`f0c6d8cb`) landed at 10:58Z, **before** the 11:17Z merge, but was never dispositioned in-PR — the merge happened without incorporating it (the original close-out report recorded Gemini as ABSENT; the re-trigger's response arrived after that report but ahead of merge, and nobody re-checked before clicking merge). Caught by the `/post-merge` Rule 21 backstop poll. Not security-critical (the CF only writes internal notification docs; no data leak or permission gap) — banked as quality hardening rather than requiring a revert.

**Findings (`functions/financing/onFinancingEscalationCreate.js`):**
1. **Filter inactive BM recipients.** The same-branch recipient lookup (`role=='branch_manager' && branchId==X`) does not check `active`. A deactivated BM still gets a bell notification doc written — harmless (they can't act on it) but unnecessary write overhead and a stale-account artifact. Fix: `recipientsSnap.docs.filter((d) => d.data().active !== false)` before the `Promise.all` fan-out; log a distinct "no active recipients" message when the filtered set is empty.
2. **User-friendly reason labels.** The notification body interpolates the raw snake_case `reason` enum value (e.g. `draw_decision`) instead of a human-readable label. The client already has this mapping (`ESCALATION_REASONS` / `escalationReasonLabel` in `src/services/financingEscalationService.js`) — mirror it server-side (CF has no access to the client module; a small local `REASON_LABELS` dict in the CF file, kept in sync by comment cross-reference, is the pattern other CFs in this codebase use for enum→label duplication) so the bell text reads "Draw decision needed" instead of "draw_decision".

**Test update needed alongside:** `functions/__tests__/onFinancingEscalationCreate.test.js`'s `setupAdminMock` mocks recipient docs without a `.data()` returning `{ active: true }` by default — needs updating so the new in-memory filter has something to filter against without breaking existing green cases.

**Falsification:** moot if the CF is redesigned to use a different recipient-lookup or notification-body shape before this lands.

---

## CI maintenance — workflows target deprecated Node 20 actions (banked 2026-07-03, LOW — CI hygiene)

**Symptom:** the CI workflows use `actions/checkout@v4` and `actions/setup-node@v4`, which GitHub is deprecating in favour of the Node-24-based majors (GitHub Actions changelog, 2025-09-19). Runners are currently forcing these v4 actions onto Node 24 with a deprecation warning; the pinned actions will eventually stop working.

**Fix:** bump `actions/checkout` and `actions/setup-node` (and any other pinned Node-20 actions) to their current majors per the changelog; verify `.github/workflows/*.yml` (`ci.yml` and any siblings) and confirm `node-version` in `setup-node` targets a supported LTS. Do NOT bundle with a feature PR — a standalone `chore(ci):` PR. **Explicitly out of scope for every lane in the 2026-07-03 window** (workflow changes touch no lane's surface); banked for a dedicated pass.

**Falsification:** moot if the workflows are migrated to a different CI provider, or if GitHub extends the v4 support window such that no bump is needed before other CI work lands.

---

## Track K · K10a → roster does not surface the 24-month agreement-term clock for wind-down agents (banked K10a, 2026-07-01, LOW — display-completeness)

The K10a `UnitFinancingRoster` term chip shows the **financing DRAW window** — `Fin. month N / 12` (SPEC §5: `on_financing` = months 1–12; `FINANCING_DRAW_MONTHS = 12`). This is a **fixed contract clock**, correct for on-financing agents; a wind-down agent (`reconciling` / `post_financing_repayment`, service months 12–24) clamps to `12/12` = "draw complete" and is disambiguated by their `financingStatus` badge — it never reads as over-term. **Gap:** the roster does NOT surface the **24-month agreement-term** clock (SPEC §6; `financingReconciliation.AGREEMENT_TERM_MONTHS = 24`, exposed via `computeWindDownClocks` → `{ agreementTermMonths, serviceMonths, termMonthsRemaining }` and already rendered on the K9 self-view + `FinancingReconciliationPanel`). If product wants the roster to show agreement-term progress (`N / 24`) or term-remaining for wind-down agents, add a second clock cell driven by `computeWindDownClocks` (no schema change — 24 is a contract constant). **Note (no per-agent term field):** `financingTerms` carries no `termMonths`/extension field; both the 12-mo draw and 24-mo term are contract constants. Introducing genuinely **variable per-agent financing terms** (e.g. a negotiated extension) would be a separate **schema FU** (`financingTerms.termMonths` + backfill + `computeWindDownClocks` param) — not currently in the SPEC. **Falsification:** moot if product confirms the roster only ever needs the 12-month draw progress and the status badge for wind-down state.

---

## Track K · K7 → server-side 24h-windowed cooldown enforcement in `notifyFinancingAdjustment` CF (banked K7, 2026-06-26, MEDIUM — idempotency / defense-in-depth)

K7's `notifyFinancingAdjustment` CF (PR #762) **writes** the per-month cooldown record (`tenants/{tid}/nudges/{agentId}_financing.adjustment.notify_{month}`, `SET-MERGE`, `createdAt` refreshed each fire) but **does not read it before firing**. The client `FinancingRiskPanel` disables the Notify button when `onCooldown` (record `createdAt` within `FINANCING_NOTIFY_COOLDOWN_MS` = 24h), so the **primary guard is client-side**. The residual gap: two *different* managers firing for the same agent/month within the same instant — or a replay that bypasses the disabled button — would each fire, producing duplicate clause-5.3 emails + bell notifications + audit entries. Consequence is benign (the CRO gets two notices; the audit honestly records two fire attempts) and **never money- or status-affecting** (K7 writes no `financingStatus`).

**CodeRabbit (PR #762 post-fix review, run `78a79bcc`) suggested an existence-check** ("read cooldownRef; if it exists, return already-notified"). **That literal fix is WRONG for this design** — the cooldown doc is per-month and persists permanently via `SET-MERGE`, while the client intentionally re-enables 24h after `createdAt`. An existence-check would block re-notification *forever* after the first fire, breaking the locked 24h re-notify capability.

**To resolve (the correct fix):** make the CF cooldown guard **24h-windowed and atomic** — replace the plain `batch.set` with a Firestore **transaction** that (a) reads `cooldownRef`, (b) if `createdAt` is within `FINANCING_NOTIFY_COOLDOWN_MS`, returns `{ success: false, reason: 'already-notified' }` without firing, (c) otherwise performs the notification writes + refreshes `createdAt` inside the same transaction (so a concurrent second fire reads the just-written record and is rejected). Mirror the client's 24h window constant server-side. Add CF unit tests for: within-window → rejected; past-window → fires + refreshes; concurrent-fire → exactly one succeeds. **Client fail-safe (folded in from CodeRabbit PR #762 P2):** `getFinancingNotifyRecord` (`src/services/financingNotifyService.js`) currently `.catch(() => null)` on the cooldown read, so a *transient* Firestore failure collapses to "not notified" and re-enables the Notify button on UNKNOWN cooldown state. Fix as part of this work: on read-error, treat cooldown as ENGAGED (keep the button disabled), not cleared — same idempotency story, fail-safe direction. **Out-of-scope for K7** (locked: client-disabled button is the primary guard; server-side enforcement is a CF behavior change + new test surface not in the brief's locked decisions). **Falsification:** overturned if the realistic threat model never includes two managers viewing the same agent's risk panel within the same second AND no replay path exists — then the client guard is sufficient and this FU is cosmetic hardening only.

---

## Track K · K7 → `setFinancingConfig` merge-overwrite guard when a 2nd config field lands (banked K7, 2026-06-26, LOW — forward-compat)

`setFinancingConfig` (`src/services/financingConfigService.js`) always writes `notifyRecipientUid` into the `setDoc(..., { merge: true })` payload (defaulting to `null` when clearing). **Not a live bug today** — `notifyRecipientUid` is the document's only field, so the write is always intentional. The forward-compat risk (Gemini PR #762 N2): if a *second* `financingConfig` field is ever added and `setFinancingConfig` is called to update only that field, the always-present `notifyRecipientUid: null` default would silently null the configured recipient. **To resolve (when a 2nd field is added):** make the payload conditional — only include `notifyRecipientUid` when the key is explicitly present in `data` (`'notifyRecipientUid' in data`), so a partial config update preserves the recipient. **Falsification:** overturned if `financingConfig` never gains a second field (the doc stays single-purpose) — then the always-write is correct and this FU is moot.

---

## Track K · K7 → defensive `typeof`-string guard on the CF recipient read (banked K7, 2026-06-26, LOW — defense-in-depth)

`notifyFinancingAdjustment` reads `recipientUid = cfgSnap.data().notifyRecipientUid` and uses it directly in a Firestore path. The K7 #6 fix makes the **write** path (`setFinancingConfig`) trim and reject non-strings, so the stored value is a clean string-or-null — the read is safe by construction today. The defensive hardening (Gemini PR #762 N7): add an explicit `typeof recipientUid !== 'string' || recipientUid.trim() === ''` guard on the CF read so a value written *outside* `setFinancingConfig` (a manual console edit, a future writer) can't produce a malformed path. **To resolve:** replace the `if (!recipientUid)` falsy check with the typeof+trim guard (same `{ success: false, reason: 'no-recipient' }` return). **Falsification:** overturned if `financingConfig` only ever has one writer (`setFinancingConfig`, which the #6 trim already sanitizes) — then the read is provably safe and the guard is redundant.

---

## Track K · K7 → reset `selectedAgent` on `tenantId` change in FinancingRiskPanel (banked K7, 2026-06-26, LOW — defensive)

`FinancingRiskPanel` does not reset `selectedAgent`/`months`/`notifyRecord` when `tenantId` changes (Gemini PR #762 P3). If a manager switched tenants/accounts *without* a remount, the stale `selectedAgent` uid would query under the new tenant. **Not a live bug today** — the panel is tenant-scoped via `AuthContext`, which remounts the manager surface on a tenant/account switch, so `selectedAgent` resets naturally. **To resolve (if a no-remount tenant switch is ever introduced):** add a `useEffect(() => { setSelectedAgent(''); setMonths([]); setNotifyRecord(null); }, [tenantId])`. **Falsification:** overturned if AuthContext is ever changed to swap `tenantId` in place without remounting consumers — then this becomes live and the effect is required.

---

## Track K · K7 → `mailErr?.message` optional chaining in CF mail catch (banked K7 post-merge, 2026-06-26, LOW — defensive)

`notifyFinancingAdjustment` wraps the `mail/` write in a non-fatal catch block (`catch (mailErr) { console.error('mail queue failed:', mailErr.message, ...) }`). If `mailErr` is not a standard Error object (e.g. a plain string throw, a Firebase rejection without a `.message` property), accessing `.message` throws synchronously, converting the non-fatal path into a fatal CF crash and losing the already-written bell/audit/cooldown artifacts. (Gemini PR #762 final pass.) **To resolve:** replace `mailErr.message` with `mailErr?.message ?? mailErr` in the catch log. One-token fix. **Falsification:** overturned if the Firebase Admin SDK + Cloud Functions runtime guarantees `catch` always receives an Error-shaped object — not contractually guaranteed.

---

## Track K · K7 → `monthLabel` client-supplied in CF notification body (banked K7 post-merge CR final pass, 2026-06-26, LOW — cosmetic trust boundary)

`notifyFinancingAdjustment` uses `data.payload.monthLabel` (client-supplied display string) in the notification body, cooldown payload, and email. The canonical `month` key (`YYYY_MM`) is server-validated via the `financing/{agentId}_{month}` ledger fetch; `monthLabel` is a display-only derivative that the client formats from the same key. A malicious BM+ caller could supply an arbitrary `monthLabel` ("URGENT - Agent owes $50,000") to influence the notification wording while the server-recomputed `adjustmentPct` gate still fires. Consequence is cosmetic only — the audit records the canonical `month` + `serverPct`, so the legal paper trail is clean. (CodeRabbit PR #762 final pass, run `48202a3a`.) **To resolve:** derive `monthLabel` server-side from the canonical `month` string (e.g. `month.replace('_', '-')` or a proper date formatter) instead of accepting it from `data.payload`. **Falsification:** overturned if the display format is intentionally client-controllable (the manager formats dates in their locale) — then accept the payload string but sanitize length/characters.

---

## `verify-financing-notify-k7-live.mjs` hardening — config-mutation window + env read (banked K7-cleanup PR #764, 2026-06-26, LOW — operator-run live verify)

Two reviewer findings on the live-fire CF script (PR #764) deferred after the **CRITICAL** prod-config-deletion guard was fixed in-PR (`originalConfig` tri-state — `null` = pre-load failure → never touch the live config; restore failures now log loudly instead of being swallowed):

- **(a) Tenant-global config mutation window (CodeRabbit #2).** The script sets `tenants/{tid}/config/financingConfig.notifyRecipientUid` to the throw-away test recipient for the duration of the run, then restores it. For the seconds-long window, a *real* financing notify fired by another manager in that tenant would route to the test recipient (which has no email → no outbound, but the bell would mis-target). **Acceptable for an operator-run live verify** — the CF resolves the recipient from that singleton path by design, so there is no alternate fixture to override; mutate→save→restore is the only way to exercise the real CF. The fix would be to run against a dedicated **test tenant** (no live notify recipients) rather than the BM's real tenant.
- **(b) `.env.local` read crashes under ENOENT (Gemini #4).** `loadEnv()` calls `readFileSync('.env.local')`, which throws if the file is absent (CI / a non-main worktree where `.env.local` does not propagate). Wrap the read in `try-catch` and ignore `ENOENT` so injected-env environments don't crash on startup.

**To resolve:** (a) parameterize the target tenant and document running it against a test tenant; (b) wrap the `loadEnv()` read in try-catch (ignore `ENOENT`). **Falsification:** both matter only if the script is ever run **unattended / in CI** or **against a tenant with a live notify recipient mid-run**. Today it is operator-run from the main worktree against the configured tenant during a quiet window — so both are LOW. If the script is ever wired into CI or a scheduled job, (a) and (b) become required, not optional.

---

## Pre-pilot CodeRabbit codebase audit over money/legal/security surfaces (banked K7-cleanup, 2026-06-26, MEDIUM — pilot de-risk)

Before the Tatil go-live, run a **scoped whole-repo CodeRabbit audit**: open an audit PR whose diff spans the target tree, let CodeRabbit (and Gemini while it is still live) review it, triage findings to FUs, then **close the PR unmerged**. Target the money / legal / security surfaces: `src/lib/financing*`, `functions/financing/**`, `functions/compliance/**`, `firestore.rules`, the auth + custom-claims paths, and the services layer. **Rationale:** per-PR review on K7 (PR #762) caught a fabricable-audit MAJOR (a client-supplied `adjustmentPct` could mint a false clause-5.3 paper trail). A one-time **second-reviewer pass across *all* money-handling code** — rather than only the diff of whichever PR happens to touch it — de-risks the pilot by surfacing latent issues the incremental reviews never saw. **To resolve:** stage the audit PR, capture the triaged findings as individual FUs, close unmerged. **Falsification:** overturned if per-PR review already covers these surfaces exhaustively (every money/legal/security file shipped through a CodeRabbit-reviewed PR with no skipped diff) — then a whole-repo pass is redundant; verify by auditing PR history over the target tree before scheduling the pass.

---

## Escape unescaped table-cell pipes in CONTEXT docs (banked K6 fast-follow, 2026-06-26, LOW cosmetic)

Several `Recently shipped` / archived table rows contain **unescaped literal pipe characters** inside inline-code spans (e.g. `` `canAccessOwn||canManage` ``, `` `on_financing`|`post_financing_repayment` ``). GFM parses these as extra column separators, so the rows render as broken tables. Affected rows: **`docs/CONTEXT.md`** L167–169, L180; **`docs/CONTEXT-history.md`** L14, L108, L112, L200, L216, L221, L222, L231 — **12 rows**, several predating K6.

**To resolve:** escape each embedded pipe as `\|` (or rewrite the code span) so every row renders as a single description cell. **Cosmetic only — do NOT change any factual content, SHA, or row meaning.** Surfaced by CodeRabbit on PR #756 (findings #1/#3); deferred from the `serviceMonths` rules fast-follow to avoid diluting a live-rules fix with unrelated historical churn. **Falsification:** line numbers drift as docs grow — re-scan with an unescaped-pipe detector (table rows with >4 unescaped `|`) before applying, rather than trusting the L-numbers above.

---

## Client-side `serviceMonths` integer validation in `reconcileFinancing()` (banked K6 fast-follow, 2026-06-26, LOW defense-in-depth)

PR #760 tightened the **rules-layer** gate (`validReconciliation()` now requires `serviceMonths is int && >= 0`), so a malformed value is rejected at the Firestore boundary. The **client-side** writer `reconcileFinancing()` (`src/services/financingService.js`, parse at `:539`, validate at `:546`) still accepts any non-negative finite number — a `12.5` would be parsed, included in `core`, and rejected only by the deployed rule (a generic permission-denied, not a friendly message). CodeRabbit (PR #760 review on `289b9c3`) suggested the writer reject non-integers up front with a clear "`serviceMonths` must be a non-negative integer" error.

**To resolve:** add an integer check to the `reconcileFinancing()` input validation (alongside the existing `:546` guard) and surface a specific error message; add an RTL case for the `12.5`-rejected path. **Out-of-scope for #760** (locked rules-only — no app code); this is app-code + test + smoke surface. **Falsification:** overturned if `serviceMonths` can only ever reach the writer as an already-integer value (today it flows from `computeMonthsFromDate`, pure integer arithmetic) AND no other caller path can inject a fraction — re-trace the writer's inputs before deciding the friendly-error is worth the surface.

---

## CLAUDE.md persistency annotation — `0-100` annotation is stale (banked K4, 2026-06-25, LOW doc-fix)

**RESOLVED — Persistency 24-Month Model brief, Slice P2.** CLAUDE.md § Persistency Document Shape stated `persistency, // parseFloat, 0–100`. The stored value is a **0–1 fraction** — confirmed by `financingBonusEngine.js` gate comparisons (`PERS_GATE = 0.90`, `PERS_FLOOR = 0.80`), `src/lib/persistency/calculations.js` (`calculatePersistency = net ÷ gross`, no ×100 scaling anywhere in the write path), and the K4 adapter's no-normalization design. The `0-100` annotation misled future adapters. Corrected to `persistency, // parseFloat, 0–1 decimal fraction (PERS_GATE = 0.90, PERS_FLOOR = 0.80)` in the same commit as the P2 vocabulary sweep.

---

## Track K · K3 adapter — doc note correction: `isStaff` and `lapsedSurrenderedUnder2yrAPI` sourcing (banked K4, 2026-06-25, LOW doc-fix)

The K3 live-data adapter FU body (above) was updated in K4 to correct the persistency normalization claim. Two remaining sourcing notes need doc-only fixes when the K8 adapter lands:

1. **`isStaff`** — listed as "sourced from policy ledger" but no ledger field sets it today. The K4 adapter passes `undefined` (A.4 inert). The FU body should clarify this is gated on A.4 resolution, not a missing ledger read.
2. **`lapsedSurrenderedUnder2yrAPI`** — the FU says "lapsed/surrendered + reinstatement under-2yr figures" as separate sources; in the current ledger only `status === 'lapsed'` exists. The K8 adapter note should document the policy-ledger status values that map to each engine input.

**To resolve:** update the K3 live-data adapter FU body + the JSDoc in `financingProjectedBonus.js` sourcing notes when K8 lands and the full adapter shape is final. No code change needed today.

---

## Track K · K6 → garnish incentive-payments component needs an incentives ledger source (banked K6, 2026-06-26, MEDIUM — money-completeness)

The 6.2 post-financing garnish (contract / spec §5) is **10% of commissions + 50% of net bonuses + incentive payments**. K6's `computeGarnishProjection` (`src/lib/financingReconciliation.js`) projects only the first two arms — `garnishCommissionRate × netCommission` (from the K2 ledger) + the net-bonus offset (`bonusOffset`). The **incentive-payments arm is OMITTED** because no ledger field sources it today (Decision 6 / CD#8 — "incentive payments = awards-engine **cash** payouts"). The projection is **display-only**; the authoritative wind-down to `cleared` uses the statement `runningBalance`, so the incomplete projection never corrupts the actual close — but the months-to-cleared estimate runs slightly long (under-counts the monthly garnish).

**To resolve:** wire an incentives source into the projection — the awards-engine cash payouts per agent-month (CD#8). Likely an adapter that reads the awards-engine cash-award figures (the same source K3's incentive credits draw from) and adds `incentivePayments` as a third garnish arm. **Falsification:** overturned if a per-agent-month incentives/cash-payout figure already exists on the ledger or settlements — grep before building; today none feeds the garnish.

---

## Track K · K1 — admin corrective / backward status transition (banked K1, 2026-06-25, deferred per Addendum B.9)

The K1 `financingService.transitionFinancingStatus` enforces the **forward-only** machine (B.9): no backward moves. An **admin-level corrective transition** (e.g. `reconciling → on_financing` to undo a mis-set event), gated behind a required audit note + elevated role, is **deferred**. Scope when an operator needs to correct a wrongly-advanced status in production.

**To resolve:** add an admin-only `correctFinancingStatus(tenantId, agentId, toStatus, actor, note)` path (note REQUIRED) that bypasses the forward-only guard but still appends a `statusHistory` entry (flagged `corrective: true`); gate to `tenant_admin`/`platform_admin` in service + a rules arm if a separate write path is introduced. Keep the normal forward-only `transitionFinancingStatus` unchanged.

---

## Track K · A.4 Staff-policy credit-filter — staff `'exclude'` path needs a ledger flag (carry from locked-decisions A.4; K3 unblocked via config)

`docs/design/track-k-locked-decisions.md` **A.4 is OPEN**: the product owner says staff policies are **counted** toward the bonus credit; contract 1.2 says **excluded**. **K3 (PR #751) unblocked this via config** rather than waiting on the confirm: `financingRuleset.staffPolicyTreatment` defaults to **`'count'`** (the product-owner position — and the functional reality, since the policy ledger carries no staff flag, so staff are indistinguishable and naturally counted). The engine's `creditWeight` reads this value; flipping it is config, not code.

**Carry (the remaining work):** the `'exclude'` branch is **declared but INERT** — `creditWeight` only zeroes a line when `staffPolicyTreatment === 'exclude'` AND the line carries `isStaff === true`, and **no ledger field sets `isStaff` today**. To make `'exclude'` functional (if the contract's exclusion is later confirmed): (1) add an `isStaff` flag to the policy ledger (`policiesService.js` `VALID_*` + write path + the K8 normalization adapter), and (2) flip `staffPolicyTreatment` to `'exclude'` in the ruleset. **Falsification:** if A.4 is confirmed as **'count'** permanently, this carry closes with no code change (the default already implements it); if confirmed **'exclude'**, the ledger-flag work above is required. No engine-logic change either way — the `'exclude'` path is already wired and unit-tested.

---

## Track K · K3 — live-data wiring adapter for the bonus engine (banked K3, 2026-06-25, lands with K8)

K3 (PR #751) shipped `src/lib/financingBonusEngine.js` as a **pure module that fetches nothing** — callers pass in normalized per-agent per-period production. **To resolve:** build a thin adapter (lands with **K8** dashboard, or **K4** if take-home needs it first) that reads the real sources — the Track H policy ledger (`policies`: `newBusinessType`, `settledAPI`, `isSelfOrFamily`, settled/submitted dates), settlements + submissions fallback (`usesPolicyLedger: false`), the app-validated persistency figure (`persistencyService` — **pass as-is; the stored value IS already a 0–1 fraction** — PERS_GATE comparisons in `financingBonusEngine.js` use `0.90`/`0.95` to confirm this; CLAUDE.md's `0-100` annotation is stale, see doc-fix FU below), lapsed/surrendered + reinstatement under-2yr figures, and the agent's `yearInAgreement` / quarter / annual roll-up — and assembles the engine's `input` shape. The adapter owns the period bucketing (quarter aggregation, Q1 submitted-vs-settled basis selection per CD#3) and the annual roll-up (`grossAPI`/`netProductionAPI`/`netPoliciesSettled`/`priorBonusesPaidYTD`). **Falsification:** the engine's input contract is in its JSDoc; if K4/K8 need a different shape, re-scope the engine signature then (no consumer exists yet).

---

## Track K · K3 — ruleset figures are 2026 placeholders pending confirmation (banked K3, 2026-06-25, LOW)

`src/config/financingRuleset/2026.js` seeds the contract figures ($37,500/qtr gate, 95%/90% persistency, 15%/15%/20% bonus rates, 150K/200K rate tiers, 80-lives, credit-map weights) from the rev-2017 agreement, marked **confirmed current for 2026** per locked-decisions A.1. **To resolve:** re-confirm each figure against any current (2026) Tatil schedule before pilot — every value is a configurable ruleset field, never hardcoded in the engine, so confirmation is a data edit, not a code change. **Falsification:** overturned if any figure has a different 2026 counterpart; surface and edit the ruleset, do not touch the engine.

---

## Track K · K4 — Q2+ adapter uses `dateSubmitted` bucketing; cross-quarter policies may be missed (banked K4, 2026-06-25, LOW)

In `financingProjectedBonus.js`, Q2+ settled-basis filtering uses `dateSubmitted` to place a policy in a quarter range. A policy submitted in late Q2 but not yet settled when Q2 ends is excluded from Q2 (not settled) and excluded from Q3 (submitted date outside Q3 range). **To resolve with K8:** add a `datePlaced` (or `dateSettled`) field to the policy ledger and use that field for Q2+ quarter bucketing instead of `dateSubmitted`. Until then, the adapter documents this as a known limitation: cross-quarter settlement lag policies are under-counted in projected quarters. **Falsification:** overturned if `datePlaced` turns out to exist in the current ledger schema — grep `policiesService.js` `VALID_*` before landing the K8 adapter.

---

## SettlementPanel — `loadData` weak overlapping-resolution race (banked FU-H1, 2026-06-25, LOW — not a money hazard)

`SettlementPanel.loadData` (tenantId-keyed: unit agent list + settlement history) is re-invoked on mount and after each save/delete. Two overlapping `loadData()` calls could resolve out of order, briefly showing slightly stale **unit-wide** data. **This is NOT the agentId-keyed money-write hazard** the financing-panel `latestAgentReqRef` guard addresses — both resolutions load **identical unit-wide data**, so there is no wrong-agent figure exposure. **To resolve (only if it ever surfaces in practice):** add a generic request token (an incrementing ref compared on resolution) to drop stale `loadData` resolutions. LOW; cosmetic-staleness only. **Falsification:** overturned (rises to MEDIUM) if `loadData` is ever changed to load per-agent data into a save-target form — then it becomes the same hazard class as the financing panels.

---

## Track K · K2 — RollForwardCheck reconciliation advisory (banked K2, 2026-06-25, MEDIUM — design carefully, land with/after K4)

The K2 mockup draws a **RollForwardCheck** advisory panel (client roll-forward estimate vs the stored authoritative `runningBalance`, with the self-correcting delta). **Omitted from K2** (dispatcher lock): a naive flow model (`prev + financingPaid − netCommission − bonusOffset`) would **false-positive** against the statement balance, which legitimately includes interest / managing-director-discretion adjustments the model can't see. Building it before `bonusOffset` is a projected value (K4) risks surfacing a "drift" that is actually correct.

**To resolve:** design the roll-forward model carefully (account for interest + MD-discretion adjustments, or scope it as advisory-only with an explicit "estimate may differ from statement for known reasons" caveat); land with or after **K4** when `bonusOffset` projection exists. Advisory only — never blocks the authoritative stored balance.

---

## Track K — lift agent-selection into FinancingTab (banked K2, 2026-06-25, LOW — UX)

K2 mounted the financing surface as a `FinancingTab` container with a segmented control (Terms · Monthly Ledger). Each sub-view (`FinancingTermsSetup`, `MonthlyStatementEntry`) keeps its **own** internal agent dropdown — so switching sub-views re-selects the agent. **To resolve:** lift the agent selection into `FinancingTab` and pass `selectedAgent` as a prop to both sub-views (drop each one's internal dropdown), so the selected agent persists across the Terms/Ledger toggle. Touches the K1 `FinancingTermsSetup` (accept a prop). K5 adds a **third** sub-view (`FinancingProrationPanel`) with the same internal-dropdown pattern — the lift should cover all three. Pure UX; no behavior/security change.

---

## Track K · K5 — `getOwnPolicies` → shared `getPoliciesByAgent` rename (banked K5, 2026-06-25, LOW — clarity)

`FinancingProrationPanel` reads the selected agent's policy ledger via `policiesService.getOwnPolicies(tenantId, agentId)` — a pure `where('agentId','==',agentId)` fetch that a BM-and-up caller is permitted to run (the policies `list` manager arm; the `agentId+createdAt` composite index already exists). The function **name** ("Own") is misleading for a manager reading **another** agent's policies. **To resolve:** rename to a neutral `getPoliciesByAgent(tenantId, agentId)` (or add it as the canonical export and keep `getOwnPolicies` as a thin alias), shared by the agent-own view and the manager-proration read. Pure clarity; no behavior/rules/index change.

---

## Track K · K3+K5 — `managerSettledAPI` precedence in financing/bonus Gross (banked K5, 2026-06-25, LOW — cross-cutting decision)

`src/lib/policyLedgerDerivation.js` `policyValue` prefers `managerSettledAPI > settledAPI > proposedAPI` (the manager's settled override). Both K3 (`computeApiChain`) and K5 (`monthlyGross`, settled basis) deliberately read **raw `settledAPI`** so the financing proration Gross and the bonus Gross stay identical (lock c). **If** the manager-settled override is ever meant to flow into the financing/bonus Gross, that is a **deliberate cross-cutting decision for BOTH K3 and K5** (and any K8 consumer) — not a silent K5-only divergence. **To resolve (if needed):** decide whether `managerSettledAPI` supersedes `settledAPI` for credit-filtered Gross; if yes, apply it in `financingBonusEngine` (the single normalization point) so K3/K5/K8 all inherit it consistently.

---

## Money Needs merged allocator — general 6% premium-tax handling (banked merged-allocator PR, 2026-06-24, MEDIUM — money-correctness)

The merged allocator computes **general** line/product commission as `commission = API × rate` (a documented simplification). General insurance policies in T&T carry a 6% premium tax, so the *accurate* form bases commission on the **pretax** premium: `commission = (API ÷ 1.06) × rate` — but only if API is entered **gross** (tax-inclusive). If agents enter pretax API, no division is needed. The convention is **unconfirmed**.

**No pilot impact:** Tatil is Life-only, so the General line is rarely/never used in the pilot. Life and A&H carry no premium tax, so their `API × rate` is already correct.

**To resolve:** (1) confirm whether agents enter General API gross or pretax; (2) if gross, change `lineCommission` / per-product commission in `src/lib/moneyNeedsAllocation.js` to divide the General base by 1.06 before applying the rate; (3) add a small "incl. 6% premium tax" note on General lines. Keep Life/A&H unchanged. This intentionally differs from the legacy blended-rate model in the untouched `YearPlanModal`.

---

## Money Needs merged allocator — per-product avg-policy divisor (banked merged-allocator PR, 2026-06-24, LOW)

Apps for every line and product are derived with the single blended avg-policy divisor (`AVG_POLICY_API = DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI = 12000`), the same source the weekly planner / goal decomposition uses. A *per-product* average policy size (a Whole Life policy averages a very different API than a Motor policy) would make per-product apps more accurate.

**To resolve:** introduce a per-product avg-policy map (config or agent-entered), thread it through `allocApps` in `src/lib/moneyNeedsAllocation.js` and the drawer's per-product apps display. Until then the UI carries a "per-product avg-policy pending" understanding — keep the blended divisor as the one math source.

---

## yearPlanAllocation.js — orphaned 4-line allocation helper (banked PR-U2, 2026-06-25, LOW — dead-code)

`src/lib/yearPlanAllocation.js` (the legacy 4-line `['life','ah','property','motor']` pure allocation helpers) was consumed only by the retired `YearPlanModal`. Post-U1 its **only remaining importer is its own test** (`src/lib/__tests__/yearPlanAllocation.test.js`) — `YearPlanModal` is gone and no production code imports it. PR-U2 left it in place per the brief's §0.4 conservative rule ("remove only if **zero** importers; else note for a later FU") — a test importer counts, and removing it on a high-blast-radius security-rules PR was out of scope.

**To resolve (standalone dead-code PR):** confirm zero production importers (`git grep "yearPlanAllocation"` → only the test), then delete `src/lib/yearPlanAllocation.js` **and** `src/lib/__tests__/yearPlanAllocation.test.js` together. **Falsification:** if any non-test importer is found, it is NOT orphaned — keep it and re-scope. Behavior-neutral (the module is unreachable from any live surface).

---

## Review-coverage gap — PR #744 (U1) shipped on Gemini-only review (banked PR-U2, 2026-06-25, LOW — process)

PR #744 (Game Plan Unification Core, the parent of U2) merged with **GLM HTTP 429 throughout** (Rule 21 backstop noted at merge; never reviewed). U2 builds directly on #744's taxonomy + adapter. No defect surfaced in U2's Phase 0 source-verify, but #744's rules-relevant changes never got a second-reviewer pass. If GLM recovers, a retro read of #744's `allocationToYearPlan` adapter + `LINE_KEYS` reader changes would close the gap. Low priority — U2's own rules-unit-tests (34/34) exercise the constrained write paths.

---

## GoalDecompositionTab — taxConnector label misleading when preTaxAlreadyApplied=true (banked PR #734 Gemini G3 OUT-OF-SCOPE, 2026-06-23, LOW)

When the playground receives a `preTaxAlreadyApplied=true` value from Money Needs, the `taxConnector` in the DecompositionLadder still renders `− 25% tax` (or the configured rate). Since the flag path bypasses the gross-up step, no tax is actually applied between "Income goal" and "1st-year commissions required" — the label is misleading.

Partially mitigated by PR #734's G2 fix: editing the Tax Rate (%) field now clears the flag, making the connector accurate once the user touches the field. The misleading case is only the initial state (immediately after send-from-Money-Needs, before any edits).

**To resolve:** in the `taxConnector` display logic, check `preTaxAlreadyApplied` and render `(pre-tax goal)` or omit the rate when the flag is active.

---

## GoalDecompositionTab + MoneyNeedsPanel — shared localStorage key (banked PR #734, 2026-06-23, LOW)

`PLAYGROUND_INCOME_GOAL_KEY = 'agencytrack-playground-income-goal'` is hardcoded independently in both `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx` (reader) and `src/components/agent/MoneyNeedsPanel.jsx` (writer). A rename must be made in both files simultaneously — no cross-import contract enforces the match.

**To resolve:** extract to a single shared constant in `src/constants/` (e.g., `playgroundKeys.js`) and import in both files. Zero behavior change; prevents future key-drift bugs.

**Value-format note (backward-compat already handled):** PR #734 changed the stored value from a bare number to `{ value, preTaxAlreadyApplied: true }`. `GoalDecompositionTab` handles both: bare number → legacy gross-up path; object with flag → skip gross-up. Any future feature that reads this key must use the same dual-format reader pattern from `GoalDecompositionTab.jsx` lines ~180–190.

---

## Nav redesign — mobile pin edit-mode (banked PR-2 nav-pr2-pinned, 2026-06-22, deferred this PR)

PR-2 ships the ★ Pinned zone with pin/unpin on the **desktop Sidebar** only; `MobileNavDrawer` renders the pinned zone **read-only** (persisted/seeded pins at top, no star edit). A mobile pin edit-mode (long-press or an explicit edit toggle in the drawer to add/remove pins on a phone) is deferred. When built, reuse `usePinnedNav` (`pin`/`unpin` already mobile-safe) and add a touch affordance in `MobileNavDrawer.jsx`.

---

## Nav redesign — PR-4 LOW follow-ups (banked PR #731, 2026-06-23)

1. **Late-`uid` paint hardening for `useMenuLayout` + `usePinnedNav` (LOW).** Both hooks use a lazy `useState` initializer that reads the localStorage mirror with the `uid` available at first mount. If a consumer ever mounts these hooks **before** Firebase Auth resolves `uid`, the mirror-first paint would be defeated (the reconcile effect re-runs on `[uid]` change and Firestore wins, so it self-corrects — but the synchronous mirror paint would be missed for that first frame). Today's only consumers (`AgentDashboard`/`ManagerDashboard`) mount post-authentication so `uid` is present; this is purely defensive. If addressed, harden **both** hooks together (render-phase prev-`uid` compare, or an effect-driven mirror re-read) to keep the sibling hooks consistent. Surfaced by Gemini on PR #731 (dispositioned DISAGREE — not a live bug for current consumers).

2. **`ProfileScreen.jsx:305` bio-counter contrast (LOW).** The bio character counter `<span className="ml-2 text-[10px] text-ink-muted/60">` fails axe AA color-contrast (`text-ink-muted` at 60% opacity). Pre-existing on `main` (not introduced by PR-4); surfaced by the PR-4 axe-delta scan on the Settings surface. Fix: drop `/60` (→ `text-ink-muted`) or bump the size/weight. Part of the known faint-text contrast-debt class.

---

## Nav redesign — producing-manager "MINE" surfaces have no own-producer route yet (banked PR-1 nav-pr1-navconfig, 2026-06-22, MEDIUM)

The original PR-1 Target listed several producing-manager items the manager nav has no route for; the dispatcher dropped them from the route-faithful v2 mapping rather than stub them. They need real `mp-*` screens (or a decision to omit) before they can appear in nav:
- **My Production Dashboard** — no `mp-dashboard` tab (only the team `overview`).
- **Persistency MINE** — no `mp-persistency` (only the team `persistency` entry tab).
- **Production Report MINE** — no `mp-production-report` (only the team `production-report`).
- ~~**Manager Daily Log**~~ — **RESOLVED in PR-3** (PR #729 `48e5a89`, HUMAN-MERGE 2026-06-22). `log-today` key in the `producingManager` Quick-Add config dispatches `handleMgrAction('log-today')` → `setShowMpDailyModal(true)` (Decision #6 verdict from Phase 0). Both DailyFAB (desktop) and the ＋ fab (BOTTOM_NAV_PRODUCING) open QuickAddMenu; selecting "Log today" opens the existing `DailyCaptureV2` overlay. No new modal needed.
- **Manager Career Portal** — agents have a `career` tab; managers have no career route.
- **Awards MINE** — no `mp-awards` (the `awards` tab is the team/manager awards surface).

Each is a small own-producer surface (mirror the existing agent screen, scoped to `user.uid` like the other `mp-*` tabs) — or an explicit product decision to leave it out. Until then the producing-manager nav is route-faithful: every item points at a destination that exists today.

---

## WeekConfirmView steppers — test the type-then-click-button race (banked Wizard v3 Phase 1, 2026-06-21, LOW — test-coverage only)

FU-a gave `IntStepper`/`DecimalStepper` a focused-draft (raw string held while focused, committed on blur/Enter). The +/- buttons read the in-progress draft via `base()` and commit it before stepping, so typing a value then clicking +/- (without first blurring) commits the typed value ± the step. This path is covered by reasoning + the no-draft unit tests (Suite D), but **not by an explicit RTL/browser test** that types into the input then clicks a stepper button in one go. **To resolve:** add an RTL test — focus the Office-hours `DecimalStepper`, `fireEvent.change` to e.g. "2." (no blur), `fireEvent.click` the increase button, assert `onEditField('officeHours', 2.5)` (draft committed via `base()` then stepped), and that no stale/duplicate value is emitted. Mirror for `IntStepper`. Pure test-coverage; the implementation is already in place.

---

## Producing-manager fast-path Confirm — deferred Sunday smoke leg (banked PR #724, 2026-06-22, LOW)

The producing-manager daily-review → Confirm fast path is RTL-covered (6 tests, real `resolvePath`), but the **live** Confirm screen is reachable only on Sundays: `DailyCaptureV2`'s `SundayConfirmView` (with the "Review & submit" deep-link that fires `onReviewSubmit`) renders only when `isTodaySunday`. The branch-preview smoke run at PR time (a non-Sunday) verifies bundle-health (manager dashboard + `mp-*` FAB → `DailyCaptureV2` mounts → the edited `ManagerDashboard` bundle boots clean) and skips-not-fails the Confirm/fast-path assertions, exactly as the agent Phase-2 smoke does (#723). **To resolve (re-run on/after 2026-06-28, the next Sunday — rides with the agent wizard Phase-2 deferred smoke):** run `scripts/verification/smoke-mp-fastpath-confirm.mjs` against production (or a live preview) signed in as a hybrid/daily **producing manager** (UM or BM, A11Y_UNIT_MANAGER_* / A11Y_BRANCH_MANAGER_* in `tatillife_smoke`). Acceptance: navigate to an `mp-*` tab → tap the daily FAB → `DailyCaptureV2` Sunday view → "Review & submit" → assert the wizard mounts on the **Confirm** screen (`week-confirm-view`) at step 10, seeded from the manager's own daily aggregation, with 0 console errors. Env prerequisites: `VERCEL_BYPASS_TOKEN` + the UM/BM A11Y creds in `.env.local`; run from the main worktree (or a worktree with `.env.local` copied).

---

## Producing-manager fast-path — `mp-report` direct-nav stays full-path (scope note, banked PR #724, 2026-06-22, deliberate deferral)

The fast path is wired for the **daily-review → Confirm** flow only. The `mp-report` direct-nav entry (sidebar "Weekly Report") and the `showWizard` "Submit Report" entry deliberately stay full-path (date-picker / step 1), matching **agent parity** — the agent's equivalent direct entry is also full-path. Routing direct-nav to Confirm would require a Dashboard-side current-week draft read (a `currentWeekSub`-style field in `useMyProduction`, which today exposes no current-week draft — only `getAgentSubmissions` list + `currentWeek`), since there is no `draftHint` on a cold tab click. **Revisit only if product wants direct-nav to also fast-path:** add a `getDraft(tenantId, uid, currentWeek)` read to `useMyProduction`, expose it, and feed it through `resolvePath` on the `mp-report`/`showWizard` entry. Not needed for the daily-review flow this PR ships.

---

## Producing-manager fast-path — Gemini backstop nits (banked PR #724 post-merge Gemini, 2026-06-22, LOW)

PR #724's Gemini review landed after the pre-merge window (absent at merge time); four medium comments dispositioned at the Rule 21 backstop. None are correctness — all deferred:

- **`openMpWizardForWeek` `useCallback` (ManagerDashboard.jsx).** Gemini suggested wrapping the helper in `useCallback([mpLoggingMode])` for a stable ref passed to `DailyCaptureV2.onReviewSubmit`. **DISAGREED at backstop on agent-parity grounds:** the helper deliberately mirrors `AgentDashboard.openWizardForWeek`, which is also un-memoized, and `DailyCaptureV2` mounts via an early-return that re-mounts on each `showMpDailyModal` toggle (marginal stable-ref benefit). **To resolve (optional):** if pursued, memoize **both** `openWizardForWeek` (AgentDashboard) and `openMpWizardForWeek` (ManagerDashboard) together so the two stay identical — never just one.
- **`page.waitForTimeout(...)` in `smoke-mp-fastpath-confirm.mjs` (lines ~63/77/121) and `smoke-nav-pr2.mjs` (lines 95, 105, 117, 186, 211).** Gemini flagged hardcoded sleeps across both; replace with element-state waits (`waitFor({state:'attached'/'detached'})`) — more precise, faster, less flaky. `smoke-nav-pr2.mjs` line 186 in particular (`waitForSelector('.sidebar-section') + waitForTimeout(2500)` post-Firestore-reconcile reload) is better expressed as `waitForSelector('[data-testid="pinned-commission"]', {timeout:25000})` — waits for exactly the right condition. The 3500ms ACK settle at line 167 (post-write, pre-clear-mirror) is server-side and should stay as-is. **To resolve:** harden all three smokes together — `smoke-mp-fastpath-confirm.mjs`, `smoke-wizard-confirm-phase2.mjs`, and `smoke-nav-pr2.mjs` — in one pass, keeping patterns identical. Bundle with the 2026-06-28 deferred manager-Confirm smoke re-run.

---

## PM-2 smoke — BM own-data write-seeding for value-level read (banked PR #719, 2026-06-21, LOW)

The PM-2 hardened smoke (`scripts/verification/pm2-my-production-smoke.mjs`) proves UM own-scoping at the value level (UM submits $3,333 → surfaces under the UM's own uid in mp-history "3.3K" + SubmissionViewer "TTD 3,333"), and proves the no-leak property for BOTH UM and BM via the managed-foil sweep (foil $7,777 absent from all 7 tabs). What it does NOT yet do is a value-level own-data read for **BM** — BM's My Production screens are currently verified via the no-leak sweep + heading-render fallback only (no BM submission is seeded, so its screens render empty/heading). This was a deliberate dispatcher-accepted deferral: BM shares `useMyProduction`'s code path with UM, so the own-scoping logic is identical, and the higher-risk BM property (branch-wide `canManage` not leaking) IS decisively covered. **To resolve:** extend the smoke's write-read-verify phase to also submit a BM-owned report (distinct marker, e.g. $5,555) via the BM's own mp-report WizardForm, reload, and assert it surfaces in the BM's mp-history + SubmissionViewer — mirroring the UM phase. Keeps the managed-foil no-leak sweep unchanged.

---

## MoneyNeedsPanel amount inputs — `=== 0 ? '' :` idiom vs `|| ''` for null safety (banked PR #718 Gemini OUT-OF-SCOPE, 2026-06-21, LOW)

Gemini flagged the `value={item.amount === 0 ? '' : item.amount}` pattern in both `CalcFedLineRow` and `LineItemRow` (and it recurs across `MoneyNeedsPanel` — `CommissionTargetsPanel`, all three calc components): if `item.amount` were ever `undefined`/`null`, React would warn about a controlled→uncontrolled flip. **Theoretical only** in the current data model — `makeItemId()` seeds `amount: 0` and `moneyNeedsService` normalizes via `parseFloat(...) || 0` on every write, so amounts are always numeric. Left as-is in #718 (presentation-only repair; changing two of ~6 sites would make the file internally inconsistent). **To resolve:** sweep all `=== 0 ? '' :` amount-input idioms in `MoneyNeedsPanel.jsx` to `item.amount || ''` in one pass for consistency + defensive null-handling. Verify no test asserts the `=== 0` branch literally.

---

## Money Needs 1.7 — per-line renewal sub-chips need a data source (banked PR #706, 2026-06-21, LOW)

The conformance audit's 1.7 (renewal income shown as per-line Life/Health/Group sub-chips) was **dropped** in #706: `estimatedRenewalIncome` is read only via `.total` (`MoneyNeedsPanel.jsx:255,358`); the per-line fields (`life`/`ah`/`property`/`motor`) exist in the scaffold default (`moneyNeedsService.js:278`) but **have no input path and are never populated** (always 0). Rendering sub-chips would fabricate a breakdown the worksheet never captures. **To resolve:** add a per-line renewal-income input UI (Money Needs worksheet) that populates `estimatedRenewalIncome.{life,ah,property,motor}`, then render the sub-chips from real data. Until then, the single `− Renewal income` line is correct.

---

## MonthlyPlanModal:41 — `todayTT.split` lacks a null guard (banked PR #708 Gemini OUT-OF-SCOPE, 2026-06-21, LOW)

`const currentMonthIndex = parseInt(todayTT.split('-')[1], 10) - 1;` (`MonthlyPlanModal.jsx:41`) throws if `getTodayTT()` ever returns null/empty. Pre-existing (not in #708's edit set); `getTodayTT()` always returns a valid `YYYY-MM-DD` in practice, so the risk is theoretical. **To resolve:** guard `(todayTT || '').split('-')` and fall back gracefully (mirrors the MonthChart NOW-line guard added in #708 `bb1545d`).

---

## Functions runtime + firebase-functions SDK upgrade — Node 20 EOL + SDK 4.9.0 → ≥5.1.0 (banked 2026-06-19, HIGH)

**Tracking entry only — do NOT start the work without a dispatched brief.**

Two coupled platform deadlines on the Cloud Functions stack:

- **Node 20 runtime is decommissioned 2026-10-30** — after that date, function **deploys are blocked**. The current gen-1 functions run on Node 20.
- **`firebase-functions` SDK 4.9.0 must move to ≥5.1.0** — the jump carries **breaking changes** (flagged; not a drop-in bump).

**Scope these together, not separately** — the gen-1 runtime target and the SDK migration touch the same surface and should be planned + tested as one piece of work.

**Validation gates before shipping:**
- Run the full functions suite against the upgraded SDK in the **emulator**.
- Perform a **non-prod deploy test** (separate project or a controlled deploy) to prove deploys still succeed on the new runtime + SDK before touching production.

**Target: complete before end of September 2026** — buffer ahead of the 2026-10-30 deploy-blocking deadline. Past that, no function deploy is possible until the migration lands, so leaving it late risks an emergency migration under a hard wall.

**Severity:** HIGH — hard external deadline (2026-10-30) with a deploy-blocking consequence; the breaking SDK jump means it cannot be a last-minute change.

**Note:** CONTEXT.md § Pending operational state already carries the bare deprecation facts; this is the actionable, scoped tracking entry.

---

---

## Wizard v3 — "Target Dials" semantics: cold-calls-only vs total calls — RESOLVED (ruling D-TD, 2026-08-26)

**RESOLVED.** The operator ruled (D-TD, `docs/briefs/daily-call-fields-kickoff.md`): **"Target Dials" means the 4-sum** — `coldCalls + referralCalls + followUpCalls + seminarTradeshowCalls`. Not cold-calls-only. `serviceCalls` is NOT in the sum.

`useSeededTargets.js` now reads the fast path (`dials`, on the daily-aggregated draft) unchanged, and on the full path falls back to `extractFields(data).totalTelAttempts` — the existing 4-sum helper — rather than to `coldCalls` alone. Reading through the helper instead of re-summing inline is deliberate: it means a fifth call type can never create a third definition of the same total.

**Correction to the original body (Rule 11).** The banked text described the shipped behaviour as the `data?.dials ?? data?.coldCalls` fallback, which was accurate. What it did not say is that the same 4-sum already had **two** call sites — `extractFields.totalTelAttempts` and `planVariance.computeProspectingCallsActual` — so the fix was never "sum four fields here", it was "route to the existing definition".

**Severity at close:** LOW, as banked — the suggestion is display-only and the agent can adjust it. **Falsification:** overturned if the operator re-rules that "Dials" means the cold bucket, or if a fifth call type is introduced that should be excluded from the target seed.

---

---

## A11Y smoke agent — no unstarted-but-fillable week, so the walk's own write-read-verify never runs (banked PR #701, 2026-06-20, LOW)

The exploration walk's step 26b (agent wizard write→auto-save→reload→persist-verify) consistently SKIPs with "All tried weeks are submitted — cannot exercise write path": the smoke agent (`A11Y_AGENT_EMAIL`, `tatillife_smoke`) has submitted weeklies for the recent weeks the walk probes (most-recent 3), so the walk can never type into a fresh draft and prove persistence end-to-end. The walk still passes (0 console errors), but its one real write-read-verify leg is dark.

**Fix:** seed (or leave) one unstarted-but-fillable week for the smoke agent — a Sunday weekStarting with NO submission/draft doc — so step 26b can open it, type, auto-save, reload, and assert persistence. A `scripts/maintenance` seeder (or a deliberately-skipped week in `seed-smoke-data.cjs`) would do it. Keep it OUT of the most-recent-3 window only if the walk's week-probe order would otherwise pick a submitted one first; simplest is to ensure the current or a near week is left unstarted.

**Severity:** LOW — the write path is already covered by `scripts/verification/aggregate-fresh-week-blastradius-probe.mjs` (writes a daily → aggregation builds a fresh-week draft) and `getdraft-nonexistent-probe.mjs`; this only restores the walk's *own* end-to-end leg. **Falsification:** if the smoke agent ever has a current unsubmitted week, step 26b runs without any seeding.

**Source:** dispatcher follow-up after PR #701 post-deploy verification — CC self-critique surfaced the persistent step-26b skip.

---

---

## Rules-test harness — `FIRESTORE_EMULATOR_HOST` parse is not IPv6-safe (banked PR #703 Gemini, 2026-06-20, LOW)

All 21 `tests/rules/*.mjs` parse the emulator host with `const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')`. `.split(':')` mis-parses an IPv6 host (`[::1]:8080` / `::1:8080`) — the host/port split lands on the first colon, breaking the emulator connection in IPv6 / dual-stack environments.

**Fix:** a shared helper (e.g. `tests/rules/_emulatorHost.mjs`) using `lastIndexOf(':')`, imported by all rules tests — a **repo-wide** change so the 21 files stay consistent. Do NOT patch a single file (the inconsistency is worse than the latent bug).

**Severity:** LOW — the emulator host is always IPv4 `127.0.0.1:8080` in local + CI runs, so the bug never fires today. Gemini flagged it on the new `managerWeeklyReports.rules.test.mjs` (#703); dispositioned OUT-OF-SCOPE there to preserve harness consistency. **Falsification:** if CI or a contributor ever runs the Firestore emulator on an IPv6 host, rules tests fail to connect.

**Source:** Gemini review on PR #703 (Item 2 of night-queue 2026-06-20), dispositioned OUT-OF-SCOPE → FU.

---

---

## CONTRACT: remove `weeklyActivityFloors.contactsMade` from companyMinimums (LOW — after #685 merges + verified)

**Context:** PR #685 (Daily Capture v2 Phase 1b) EXPANDS `companyMinimums.weeklyActivityFloors` by adding `telContacts` alongside the existing `contactsMade` key (EXPAND-only migration script: `scripts/seed/migrate-floors-contactsMade-to-telContacts.mjs`). The expand-only pattern avoids breaking pre-merge reads of `contactsMade`. After #685 is merged and verified in production, `contactsMade` is dead weight in every tenant's floors doc.

**Action:** Run a targeted removal against `tatillife_south` and `tatillife_smoke`:
```js
ref.update({ 'weeklyActivityFloors.contactsMade': admin.firestore.FieldValue.delete() })
```
Verify the key is gone and `telContacts` is intact. Update (or delete) the migration script to reflect post-removal state.

**Priority:** LOW — no user-visible impact while `contactsMade` sits alongside `telContacts` (code ignores it after #685). Safe to close in any subsequent seed/migration cleanup PR. Do not bundle with new feature work.

---

---

## Daily Capture v2 Phase 2 — back-fill strip selected-state visual (banked PR #686, LOW)

The smoke leg 2b back-fill assertion falls to `skip` because no reliable `aria-selected` or `data-selected` attribute is set on the selected strip day button. Add `aria-selected={isSelected}` to the strip day `<button>` in `WeekStrip` (`DailyCaptureV2.jsx`) so the smoke and screen-reader both get a machine-readable signal. Cosmetic only — selection still works.

**Severity:** LOW — no user-visible regression; the selected ring (`ring-2`) is visible to sighted users. Smoke just can't assert it deterministically without the attribute.

---

---

## Daily Capture v2 Phase 2 — axe baseline re-sync vs fresh main (banked PR #686, LOW)

The NO-NEW axe gate in `daily-capture-v2-2-ui-smoke.mjs` diffs against a baseline captured on a prior main deployment. Re-run `scripts/verification/axe-baseline-capture.mjs` (or equivalent) against a fresh main deploy after PR #686 merges to update `scripts/verification/axe-baseline.json`. Keeps the delta gate calibrated as main accumulates new pages.

**Severity:** LOW — delta gate is still valid; stale baseline only risks false-positives (surfacing already-present violations as "new").

---

---

## Daily Capture v2 — wizard direct-entry default carries the Sunday edge (banked PR #688, LOW)

The **non-deep-link** wizard entry (AgentDashboard bottom-nav "submit" → `setShowWizard(true)` with no `wizardWeek`) opens `WizardForm` on the date-picker screen, defaulting `localWeekChoice` to `getLastNSundaysForDropdown(1)[0]` — the current (Sunday-starting, **empty**) week on a Sunday. Unlike the DCv2 deep-link (fixed in Phase 2.2 to target the completed week), this is **user-correctable** — the dropdown lists the last 6 Sundays incl. the completed one. Out of Phase 2.2 scope (Decision #5): it lives in a different module (`WizardForm` / `getLastNSundaysForDropdown`) and a default change affects **all** wizard entry incl. weekly-only agents.

**Action (if pursued):** make the wizard's default week Sunday-aware (default to the completed week on Sunday) OR confirm the picker default is acceptable since it's correctable. Decide before relying on the direct-entry path for the Sunday submit flow.

**Severity:** LOW — correctable via the picker; the primary Sunday flow (DCv2 → "Review & submit") is fixed in Phase 2.2.

---

---

## Daily Capture v2 — aggregate-on-save could be non-blocking (Gemini #1, banked PR #688, LOW)

Phase 2.2 wires `aggregateCurrentWeekDaily` into DCv2 `handleSave` **awaited** (after the daily doc persists, before the 600ms `onClose`). Per the brief self-critique ("confirm it's **awaited** and failure-isolated") this is deliberate — the await guarantees the completed-week draft is built before the modal closes, so the immediately-subsequent Sunday review / deep-link reads a current draft deterministically. Gemini (#688) flags that on a slow field connection the await adds the aggregation's read-7 + write latency to the modal-close delay.

**Action (if pursued):** make the aggregation fire-and-forget (`.catch`-guarded, not awaited) so the modal closes promptly; the draft builds in the background. Requires updating `daily-capture-v2-2-2-sunday-review-smoke.mjs` to **poll** `readDraft` (the draft is no longer guaranteed built at modal-detach) instead of reading once.

**Severity:** LOW — current behavior is correct (log persists first, failure-isolated); this is a field-UX latency optimization. Decide whether the determinism (awaited) or the snappier close (fire-and-forget) is preferred.

---

---

## ProfileScreen.todayLocalDate — catch-up entry dated browser-local, not TT (banked PR #688, LOW)

Phase 2.2 TT-anchored both `loggingModeService` write paths (`aggregateCurrentWeekDaily` + `catchUpWeeklyToDaily`) — their `weekStarting` keys are now `getSundayOf(getTodayTT())`. But `catchUpWeeklyToDaily(…, today)` still dates the carried-over catch-up daily entry by its `today` arg, which `ProfileScreen.todayLocalDate()` computes from **browser-local** `new Date()` (`getFullYear/getMonth/getDate`). For a TT agent (browser = AST = TT) `todayLocalDate()` == `getTodayTT()`, so the catch-up entry's own `weekStarting` (`getSundayOf(today)`) matches the converted draft's week. For an **off-TZ agent at a day boundary** the catch-up entry could be dated a day off → land in a different week than the draft it converted.

**Action (if pursued):** make `ProfileScreen.todayLocalDate()` return `getTodayTT()` (or pass `getTodayTT()` into `catchUpWeeklyToDaily`) so the catch-up entry date is TT-consistent with its week key. Check `todayLocalDate`'s other uses in ProfileScreen first.

**Severity:** LOW — mode-switch-only AND off-TZ AND day-boundary (triple-edge); a real Trinidad agent never hits it.

---

---

## getMostRecentSunday peripheral read/display selectors — browser-local week (banked PR #688, LOW)

After Phase 2.2, **no daily/draft-write path** uses browser-local `getMostRecentSunday()` (both `loggingModeService` writers are TT-anchored). The remaining call sites are **read/display week selectors** only: `AgentDashboard.jsx:141` (`currentWeek` — loads `currentWeekSub` + wizard-default week; the wizard direct-entry Sunday-edge is separately banked), `ManagerDashboard.jsx:99` (`selectedWeek` — team-view selector), `kiosk/panels/CompliancePanel.jsx:17` (compliance display week), `productionReport/UnitManagerProductionView.jsx:26` (`currentWeek` — report view). An off-TZ viewer could see/select a non-TT-canonical week, but none of these WRITE — they only choose what to display, and all are user-correctable via week pickers.

**Action (if pursued):** migrate these display selectors to a TT-anchored helper (`getSundayOf(getTodayTT())`) for cross-TZ consistency, or confirm the picker-correctable behavior is acceptable. Lowest priority — display-only, no data-integrity impact.

**Severity:** LOW — read/display only; no draft or daily write keys on these.

---

---

## team-roster data layer (#682) — Gemini LOW robustness items (banked PR #683 post-merge, 2026-06-18, LOW)

Gemini's review of the merged #682 (`1585373`) raised 4 items; `getSettlementsForUnit ?? []` is already in the hook (line ~63). Three LOW robustness items remain (PR merged — no in-PR fix):

1. **`sortRows` (`src/lib/teamRoster.js`)** — use `== null` instead of `=== null` so `undefined` values also float to the bottom. In practice `assembleRosterRow` only ever emits a number or explicit `null`, so this is defensive-only.
2. **`useTeamRoster(tenantId, period)` (`src/hooks/useTeamRoster.js`)** — `period = DEFAULT_PERIOD` default only applies for `undefined`; an explicit `null` would crash the `const { grain, value } = period` destructure. Use `period ?? DEFAULT_PERIOD`.
3. **`useTeamRoster`** — guard `auth.currentUser` before `.getIdTokenResult()` (currently caught by the try/catch → `setError`, but an explicit guard is cleaner).

**Severity:** LOW — all three are defensive hardening; no observed failure. Fold into the next roster touch.

---

---

## Update-button reload — event-driven hardening (banked PR #681 review, 2026-06-17, LOW)

Current `ReloadPrompt.jsx` `handleUpdate` uses a fixed 500ms `setTimeout` fallback after `updateSW(true)`. The root cause (no `clientsClaim` → `controllerchange` never fires) is known and documented. The fallback works but is timing-based.

**Hardening target:** replace the timeout with an event-driven reload — listen for the waiting SW's `statechange` event and reload when it hits `'activated'`, with a long fallback timeout (e.g. 5–10s) in case `statechange` never fires.

**Trigger:** pull forward only if users report "clicked Update twice" or "nothing happened after clicking Update." Until then the 500ms fallback is reliable and the risk is low.

**Severity:** LOW — current fallback works correctly in all tested conditions. This is belt-and-suspenders hardening.

---

---

## MonthlyPlanModal — Gemini hardening pass (banked PR #671, 2026-06-17, LOW-MED)

5 findings from the Gemini review of PR #671 (`24a6457`). PR already merged — bank as follow-up.

**1. HIGH — `currentMonthIndex` not year-aware (`MonthlyPlanModal.jsx`).**
`currentMonthIndex` is computed from `getTodayTT()` month only, ignoring the `year` prop. Opening the modal for a past year (e.g. 2025 when today is 2026) yields today's month index, allowing edits of "settled" months and producing wrong YTD/recovery-pace values. Fix:
```javascript
const currentMonthIndex =
  year < todayYear ? 12 :
  year > todayYear ? 0 :
  getTodayTT().getMonth(); // existing logic for current year
```

**2. HIGH — `actuals` not memoized (`MonthlyPlanModal.jsx`).**
`bucketActualsByMonth(submissions, year)` is called on every render; every keystroke in a target field triggers a re-render and reprocesses all submissions. Wrap in `useMemo`:
```javascript
const actuals = useMemo(() => bucketActualsByMonth(submissions, year), [submissions, year]);
```

**3. MEDIUM — Reuse `ytdDelta` for `isBehindOnSettled` (`MonthlyPlanModal.jsx`).**
`isBehindOnSettled` is computed via a manual loop over settled months. `ytdDelta(actuals, targets, currentMonthIndex)` already performs this calculation. Simplify:
```javascript
const isBehindOnSettled = targets && currentMonthIndex > 0 && ytdDelta(actuals, targets, currentMonthIndex) < -0.01;
```

**4. MEDIUM — Simplify `settledToDate` calculation (`monthlyPlanMath.js`).**
The intermediate `completed` array + reduce can be replaced with a single slice+reduce:
```javascript
const settledToDate = actuals.slice(0, currentMonthIndex).reduce((s, v) => s + (parseFloat(v) || 0), 0);
```

**5. MEDIUM — Conditional test assertions allow false positives (`monthlyPlanMath.test.js`).**
`if (result.pacePerMonth < threshold)` guards around `expect(result.isStretch).toBe(false)` mean the assertion is silently skipped when the condition is false. Assert unconditionally:
```javascript
expect(result1.pacePerMonth).toBeLessThan(threshold);
expect(result1.isStretch).toBe(false);
```

**Scope:** `src/lib/monthlyPlanMath.js` + `src/components/agent/MonthlyPlanModal.jsx` + `src/lib/__tests__/monthlyPlanMath.test.js`. Pure-frontend; no rules/CF/index changes.

---

---

## SW navigation strategy — NetworkFirst app shell (Option B) (banked PR #673 sw-version-update-prompt, 2026-06-17, LOW)

The prompt-to-reload work (PR #673) fixes the latent staleness by letting the user tap to update when a new deploy is detected. It does **not** eliminate the brief stale-then-tap window: on the first load after a deploy the service worker still serves the precached app shell (`index.html`) cache-first, so the agent sees the prior bundle until they tap **Update**.

**Option B (zero-lag):** switch navigations from the precache cache-first `NavigationRoute` to a **NetworkFirst** strategy — drop `html` from `workbox.globPatterns` and add a runtime `NetworkFirst` rule for navigation requests (fall back to cache when offline). An online login then always fetches fresh `index.html` from Vercel (whose default `must-revalidate` on HTML is already correct), so no stale beat and no forced reload.

**Why deferred:** requires offline-fallback validation (the precache shell currently guarantees offline boot; a NetworkFirst shell must prove the offline fallback path still serves a usable app). The prompt-to-reload fix is the lower-risk pilot-unblocker; Option B is the polish pass if zero-lag is ever wanted.

**Scope:** `vite.config.js` workbox block only (`globPatterns` + `runtimeCaching`). No component changes. Verify with the same two-version + offline protocol as PR #673.

**Severity:** LOW — prompt-to-reload already closes the "stale for hours" gap; this only removes the few-seconds stale-then-tap window.

---

---

## GoalsPanel SelfTab unmount loses in-progress PolicyLedgerPanel entries (banked PR #653, 2026-06-16, LOW-MED)

`PolicyLedgerPanel` is now the first SelfTab form. When a producing manager switches away from the Self sub-tab and back, `SelfTab` unmounts and remounts — any in-progress "New Policy" form entry is lost. The same is true for all future forms added to SelfTab.

**Fix shape:** Solve once at the `GoalsPanel` level rather than per-panel:
- **CSS visibility approach:** render all sub-tabs simultaneously, show/hide with `display: none` / `display: contents` based on `subTab === id`. No unmount/remount; state persists across switches.
- **Lifted state approach:** hoist policy-form draft state into GoalsPanel and pass down via props. More surgical but must be repeated for each new SelfTab form.
- CSS visibility is the simpler, more future-proof choice.

**Scope:** `src/components/manager/GoalsPanel.jsx` — the `TabPills` conditional rendering block (lines ~1159–1175). Zero rules / service changes.

**Why LOW-MED:** Agents using AgentDashboard's policy ledger do not face this (no sub-tabs in AgentDashboard). Producing managers switching sub-tabs mid-entry lose their draft — real UX friction once the pilot cohort uses the feature regularly. Not a data-loss issue (nothing is written until Save). LOW-MED until pilot feedback confirms frequency.

---

---

## Policy ledger producing-manager write — UM Arm A + Arm B other-owner DENY emulator cases (banked PR #652, 2026-06-16, LOW)

The emulator suite (`tests/rules/policies.rules.test.mjs`) includes self-only DENY cases for BM on Arm A (body-edit) and Arm B (status-transition), but no equivalent UM case for those two arms. The rule predicate is identical for both roles (`resource.data.agentId == request.auth.uid`), so the BM cases cover the same code path. This is a coverage gap, not a correctness gap.

**Fix shape:** Add to `tests/rules/policies.rules.test.mjs`:
- `producing-mgr Arm A DENY: UM body-edits another user policy (self-only)` — `umADb` context, targets `policy-b1` (`agentId: 'agent-b'`) → DENY.
- `producing-mgr Arm B DENY: UM transitions another user policy (self-only)` — `umADb` context, targets `policy-b1` → DENY.

Both use existing seed docs and the already-defined `umADb` context. Net new: 2 test cases, zero rule changes.

**Severity:** LOW (BM DENY already proves the same predicate; UM case is belt-and-suspenders coverage only).

---

---

## Onboarding tenure — manager confirmation surface (banked PR #649, 2026-06-15, HIGH — near-term)

Agents self-enter `contractStartDate`, `monthsAtTatil`, and `monthsInIndustry` during onboarding (Slice 1 rule + Slice 2 wizard fields). Both drive award eligibility gates (`rookieAward` ≤ 18 months in industry; `newBsAward` ≤ 18 months at Tatil) and career floors. A wrong self-entry shifts the agent's tenure band.

**Required surface:** Managers see the agent's self-entered `contractStartDate` / `monthsAtTatil` / `monthsInIndustry` and can confirm or correct each value. The manager arm already allows writes to these fields (added in Slice 1). The UI is the outstanding piece.

**Why near-term, not distant:** These fields gate award eligibility and career floors. If a pilot agent self-enters an incorrect contract date during onboarding, the error propagates to every award projection and career milestone until a manager corrects it. Prioritize before the pilot cohort reaches their first award evaluation period.

**Severity:** HIGH (data errors have direct downstream consequence on awards + career floors; self-entry + write-once with no immediate manager review creates a window).

---

---

## Onboarding identity — CF-based agentNumber uniqueness check (banked PR #646, 2026-06-15, MEDIUM)

The v1 onboarding write-once rule lets an agent self-enter `agentNumber` once (when null/absent), but does NOT verify uniqueness across the tenant roster. Collisions are reconciled by manager review.

**Upgrade path:** A callable Cloud Function that accepts `{tenantId, agentNumber}` and returns `{unique: bool}` after a tenant-scoped Admin SDK query (`where agentNumber == candidate`). Surface as a soft warning in the wizard identity step — not a hard block, consistent with the v1 "soft-validation" design decision. CF uses Admin SDK and bypasses rules; no rules change needed for the check itself.

**Why deferred:** Real-time uniqueness requires either a cross-roster read (permission-blocked for an agent reading peers' docs under current rules) or a callable CF. CF approach is clean but expands the gated surface. Tatil agent numbers are authoritative from the company system — collisions are rare; manager correction is the safe fallback for the pilot.

**Severity:** MEDIUM (collisions violate a data integrity assumption; low probability in the pilot cohort; manager correction is reliable).

---

---

## Onboarding tenure — rule-level cross-field floor: `monthsInIndustry >= monthsAtTatil` (banked PR #651, 2026-06-15, LOW)

The client enforces `parsedIndustryMonths >= monthsAtTatilComputed` in `WizardIdentity.jsx:52` before allowing Save. `saveOnboardingIdentity` passes only validated values. The Firestore rule arm validates each tenure field individually (`is int && >= 0`) but does **not** cross-check `monthsInIndustry >= monthsAtTatil` in the same write.

**Gap:** A future write path (or client bug) could write `{monthsAtTatil: 20, monthsInIndustry: 10}`. The rule accepts both (valid ints >= 0 individually); no cross-field rejection occurs. The manager-confirm surface (HIGH FU above) is the correction path, but the rules layer has no defense-in-depth guard.

**Fix shape:** Add to the owner write-once arm: `request.resource.data.monthsInIndustry >= request.resource.data.monthsAtTatil`, guarded by `hasAll(['monthsAtTatil','monthsInIndustry'])` so partial writes (contract date only, no months) are not blocked. Client floor stays primary gate; rule is defense-in-depth only. Bundle with the manager-confirm surface slice — both touch the same rule arm.

**Why deferred:** Client floor + manager-confirm covers the operational case. Cross-field Firestore rules constraints require careful `hasAll` guard to avoid blocking partial writes. Not a standalone PR — bundle with the manager-confirm surface slice.

**Severity:** LOW (client floor is the primary gate; no known write path bypasses it; manager-confirm is the correction fallback).

---

---

## Plan-lens UM compliance — do UMs commit weekly plans? (banked PR #640, 2026-06-15, LOW)

**CompliancePanel plan lens:** The current plan-lens exception list ("Haven't committed a plan") is agents-only. When UMs become mandatory filers at `UM_MANDATORY_FILING_CUTOFF = '2026-06-14'`, do they also commit weekly plans? If yes, the plan-lens roster and exception list must include UMs for post-cutoff weeks (mirroring the filing-lens cutoff guard). If no, the plan lens stays agents-only regardless of the selected week.

**Deferred from:** Producing-manager Phase 3 (PR #640) — Phase 3 scopes to the **filing lens only**. Plan lens unchanged.

**Decision needed:** Product call — does the UM role require a weekly plan commitment, or is their compliance obligation filing-only?

**Ties to:** Manager-cockpit arc (WAR v2, planner S4b). Resolve before that arc ships if plan-lens UM inclusion is desired.

**Severity:** LOW (plan lens is operational; the filing lens covers the Phase 3 deliverable in full).

---

---

## Awards reach pins — Firestore persistence for cross-device sync (banked PR #641, 2026-06-15, LOW)

`AwardsReachPanel` stores pinned aspirational awards in `localStorage` (key `agencytrack-award-pins`). This is per-device — pins set on a mobile phone are not visible on a desktop browser.

**Upgrade path:** Store pins in `tenants/{tid}/users/{uid}` as a `awardPins: string[]` field. Write on toggle via `userService.updateUserProfile` (already exists). Read on mount via `useAuth().userProfile`. Rules: `userSelf` write already allows profile updates; `awardPins` needs to be in the `hasOnly` allowlist.

**Why deferred:** localStorage is acceptable for v1 (pins are aspirational, low-stakes). Cross-device sync requires a `firestore.rules` change + `hasOnly` allowlist update → BUILD-AND-HOLD, not Tier-B. Not worth the overhead until pilot agents explicitly ask for it.

**Severity:** LOW (per-device pins are a minor inconvenience for agents who switch devices; no data loss, just re-pinning needed).

---

---

## CommissionPlayground `submissions={[]}` in manager GoalsPanel — pure rate-calculator vs live data (banked PR #645, 2026-06-15, LOW)

`GoalsPanel.jsx` passes `submissions={[]}` (empty array) to `CommissionPlayground` alongside `isManagerSelf={true}`. The component also receives an `isProducing` flag. The empty-array pass appears intentional (the `isManagerSelf` prop suggests the playground is treated as a pure blended-rate calculator for managers, not a live-data explorer), but it was never explicitly confirmed in the brief.

**Action:** Confirm whether `CommissionPlayground` for managers should receive the manager's own `allSubmissions` (same set fetched in this PR) — allowing real production figures to seed the calculator's baseline — or remain a blank-slate rate calculator. If the former, wire `submissions={allSubmissions}` in GoalsPanel; update tests. If the latter, add a comment to GoalsPanel clarifying the intent so it's not mistaken for a bug.

**Why deferred:** The `isManagerSelf={true}` prop is a strong signal the empty-array behavior is intentional; changing it is a product judgment call, not a Tier-B display fix. Scope was locked per dispatcher authorization during the manager goal-portfolio catch-up PR.

**Severity:** LOW (managers can still reach CommissionPlayground via the Self tab; only the seeded-from-real-data baseline is missing if the intentional interpretation is wrong).

---

---

## Smoke hardening — confirm deployed SHA before asserting (banked PR #643, 2026-06-15, LOW)

Prod/preview smokes must verify the target SHA is the live deployed build before running assertions. Without this, a Vercel propagation delay causes a false-fail: the smoke starts before deployment finishes, assertions fail, and the real pass only appears on a re-run.

**Seen:** PR #643 prod-smoke first run — `leg-light-render` FAIL while `leg-dark-render` PASS 10 seconds later (Vercel still deploying when the light leg ran). Clean 5/5 on re-run 55 seconds after merge.

**Upgrade path:** At smoke start, poll Vercel deployment status and wait until the deployed commit SHA matches the expected target SHA (feature branch HEAD SHA for preview smokes; squash SHA for prod smokes) before any assertion leg. Alternatively, stamp `index.html` with the git SHA at build time (`VITE_COMMIT_SHA`) and check `window.COMMIT_SHA` via `page.evaluate()` before the first leg.

**Why deferred:** Re-run is a reliable manual mitigation; fix requires Vercel API integration or a build-time env-var stamp — non-trivial. One occurrence in ~40 smokes. Revisit if false-fails become a pattern.

**Severity:** LOW (re-run resolves; no auto-revert was triggered; strike counter unchanged).

---

---

## goalsService — blanket .catch(() => null) on agent-doc reads (banked 2026-06-13, LOW)

Same pattern as the `commitPlanService` fix applied in PR #593: `goalsService.js` uses `.catch(() => null)` on `getDoc(users/{agentId})` in at least two places (line 131 inside one service function; line 266 inside `getGoalHierarchy`) plus several adjacent reads in the same `Promise.all` block (lines 261–266). A transient Firestore error silently degrades goal-hierarchy data to nulls rather than propagating.

**Fix shape:** Remove the blanket catches on reads that feed business-logic decisions. Reads that are purely additive (i.e., absence is acceptable) can retain a selective catch. Audit all `.catch(() => null)` sites in `goalsService.js` before fixing — some (e.g., optional SM goals fetch) are intentionally nullable.

**Why deferred:** Out of scope for the PR #593 agent-doc catch fix. `getGoalHierarchy` is a read-only path (no floor enforcement); risk of silent degradation is lower than `commitPlanService`'s floor bypass scenario.

**Severity:** LOW.

---

---

## `VITE_GAME_PLAN_LOOP_ENABLED` kill-switch — remove once planning loop is stable (banked 2026-06-13, LOW)

Flag defaulted to `true` (`!== 'false'`) in PR #601 (`0f7fa55`, `feat/ungate-planning-loop`). Once the planning loop is confirmed stable in production (~2 weeks post-Tatil pilot, no user-reported issues), remove the flag entirely: delete all `import.meta.env.VITE_GAME_PLAN_LOOP_ENABLED` reads in `GamePlanV2/index.jsx` and `EditUserDrawer.jsx`, remove the key from `.env.example` and `vite.config.js` test env.

**Severity:** LOW (cleanup chore; dead flags accumulate).

---

---

## Bulk pilot-roster provisioning + link export (banked 2026-06-12, LOW)

One-shot script (`functions/scripts/`) to provision a roster CSV in dependency order — ensure branches in `tenants/{tid}/meta/branches` → branch managers → unit managers (incl. a thin `unit_manager` anchor for any unit with agents but no manager, e.g. Phoenix) → agents with `unitId` resolved to the unit_manager's UID — reusing `doCreateUser` (no bespoke provisioning; avoids claim/tenant drift). Idempotent/skip-existing by email; repair half-provisioned (Auth-but-no-doc). Then generate a password-reset link per account and write a LOCAL links file for out-of-band distribution. PII (roster CSV + links) stays local/gitignored; committed code generic.

**Build-time question:** Does `bulkImportUsers` already resolve an agent's `unitId` from unit name to a same-batch `unit_manager` — if yes extend it, if no write the dedicated script.

**Severity:** LOW (pilot prep; unblocks Tatil demo provisioning).

---

---

## Copy invite link — Create-time link affordance (banked 2026-06-11, LOW)

**Source:** feat-copy-invite-link PR #573 (`80de845`) — brief Phase 1 scoping decision (deferred to FU).

During account creation (Add User drawer), the system could optionally generate and display the invite link immediately, so the manager never needs a separate "Invite ▾ → Copy link" step for freshly created accounts. The `resendInviteEmail` CF's `channel:'link'` path is the correct backend mechanism.

**Why deferred:** Create-time link generation changes the Add User success flow (modal expands to show a link + clipboard UI), which is a non-trivial UX decision beyond the copy-invite-link PR's scope.

**Action:** Add a "Copy invite link" step to the Add User success flow in `UserManagementPanel.jsx` (post-create state), or a toast with a "Copy invite link" action button on create success. Needs UX decision from dispatcher before implementation.

**Severity:** LOW (convenience enhancement; the existing Invite ▾ dropdown on the user row covers the same need with one extra click).

---

---

## Money Needs — per-tenant taxonomy via `config/budgetCategories` (banked 2026-06-11, LOW)

**Source:** money-needs-default-seed brief § 2 (dispatcher decision — deferred multi-tenant upgrade).

The canonical T&T expense taxonomy ships as a code constant (`DEFAULT_MONEY_NEEDS_CATEGORIES` in `moneyNeedsService.js`). Correct for the single-tenant pilot. The PRD originally planned a `config/budgetCategories` Firestore doc for per-tenant taxonomy customization (different carriers, different expense categories or industry events).

**Why deferred:** Single-tenant pilot — per-tenant customization adds a Firestore collection + rules block + admin UI not needed before the Tatil demo. `createMoneyNeeds` uses the code constant directly.

**Action:** Add `tenants/{tenantId}/config/budgetCategories` doc; update `createMoneyNeeds` to fetch and merge it (falling back to `DEFAULT_MONEY_NEEDS_CATEGORIES` if absent). Add tenant_admin UI to manage the taxonomy. Requires rules block + composite index for the new collection path.

**Severity:** LOW (pilot is single-tenant; deferred to multi-tenant expansion).

---

---

## tatillife_smoke tenant — post-prod-run live verification (banked PR #674 `3730035`, HIGH until run)

**Source:** PR #674 (`3730035`, `chore/seed-smoke-tenant`) Phase 4 placeholder — emulator gates pass; production run is operator-executed after merge.

**Action (operator — one-time, after PR merge):**
1. Add `A11Y_TENANT_ID=tatillife_smoke` to `.env.local` (if not present).
2. `node functions/scripts/seed-smoke-tenant.cjs --apply` (from repo root; `service-account-key.json` required in `functions/`).
3. Re-run `scripts/verification/app-host-portal-migration-smoke.mjs` against PR #672 preview — the BM account now resolves to `tatillife_smoke`; confirm the rejected-credential blocker clears and all legs pass.
4. Confirm claims route correctly: sign in as each A11Y role in the app, verify the tenant tab / dashboard resolves to "Smoke Test Tenant" (not `tatillife_south`).

**Isolation invariant:** `tatillife_smoke` accounts must never write to `leaderboards/` or `leaderboard/` in `tatillife_south` — the scheduled aggregation (`TENANT_ID='tatillife_south'` in `functions/index.js:42`) does not run for the smoke tenant. Use `recomputeLeaderboardOnDemand({tenantId:'tatillife_smoke'})` when leaderboard-dependent smokes are later retargeted (Brief 2 territory).

**Falsification anchor:** If step 4 shows the app still routing to `tatillife_south` (or an `auth/unauthorized-domain` error), the claim-propagation assumption is wrong — halt, do not bank, investigate.

**Severity:** HIGH until the live run completes; drops to CLOSED once steps 1–4 are verified.

---

---

## #547 deferred-verify: branch dropdown verified live via provisioning (banked 2026-06-10, LOW)

**Source:** PR #547 smoke waiver (Rule 13). Smoke blocked by deleted harness account (see above FU).

**Acceptance criteria (deferred):** After harness tenant-admin is restored, run:
```
SMOKE_BASE_URL=https://agencytrack.vercel.app \
  node scripts/verification/branch-dropdown-smoke.mjs
```
Expected: all 3 active branches (Cyril Murray Branch, Kendell Lowhar Branch, Tatil South) appear in both `unit_manager` and `branch_manager` role dropdowns, values are branch doc ids, no email/manager-name fallbacks.

Alternatively: live operator verification during first provisioning session confirms all 3 branches appear in the Add User drawer — close this FU at that point.

**Severity:** LOW — fix is a transparent DOM-rendering change; operator can verify in 30 seconds during provisioning.

---

---

## AgentReportDocument — add seminarsConducted + tradeshowsAttended to PDF (banked 2026-06-10, LOW)

**Source:** seminars-tradeshows-wirein PR (dispatcher out-of-scope ruling).

`AgentReportDocument.jsx` (react-pdf, hex-only) currently shows `f2fAttempts` individually but does not include the Seminars/Tradeshows section. After the 8→4 collapse, the two surviving counts are `seminarsConducted` and `tradeshowsAttended`. These are now members of `prospectingTouches` but not yet rendered in the agent PDF.

**Why deferred:** The dispatcher ruled the PDF surface out of scope for this PR — occasional event counts don't suit sparkline/average treatment, and adding a new PDF section needs its own layout decision. The data is available via `extractFields()` when this FU is actioned.

**Action:** Add a "Seminars & Tradeshows" row or mini-section to `AgentReportDocument.jsx` (lines ~470–510, the Prospecting/Activity section) showing `seminarsConducted` and `tradeshowsAttended`. Keep hex-only (no CSS vars — react-pdf cannot resolve them).

---

---

## Dashboard background Firestore permission error — investigate listener (banked 2026-06-10, LOW)

**Source:** seminars-tradeshows-wirein smoke (PR #554) — filtered from console-error leg.

During the smoke, `FirebaseError: Missing or insufficient permissions.` fires as a background console error while the agent dashboard is loaded. It is NOT emitted from wizard code — the wizard is running correctly. It originates from a Firestore listener on the AgentDashboard that the test agent's role cannot satisfy (candidate: `leaderboard/{uid}`, `notifications`, or `campaigns` collection read).

**Why filtered:** This PR makes zero changes to Firestore rules or dashboard reads — it is a wizard UI collapse + extractFields formula change. The error is pre-existing background noise. Filtering it by text match is the correct smoke-layer choice; the underlying listener issue is a separate concern.

**Action:** Identify which AgentDashboard Firestore subscription triggers the denied read for the test agent role. Check if the rules for that collection correctly allow `canAccessOwn` reads, or if the test agent's claims/data are missing a required field (e.g. `unitId`, `tenantId`). Fix the rule or the listener subscription as appropriate. Low priority — no user-visible impact (denied read is swallowed silently in the UI).

**Severity:** LOW (no user-visible regression; background-only).

---

---

## computePoints — structural bypass of extractFields (banked 2026-06-10, downgraded 2026-06-11, LOW)

**Source:** PR #558 (points-activity-scale) Phase 1 ruling — LOW FU authorized by dispatcher. Downgraded by PR #566 (computepoints-field-reading): the v2 flat-field divergence (apps/API scoring 0 on v2 submissions) is fixed.

`functions/lib/computePoints.js` reads raw `after.data()` fields directly, bypassing `extractFields()`. The **v2 divergence** — `newBusiness.{apps,api}` scoring 0 on all v2 submissions — **is fixed in PR #566**: `computePoints` now mirrors `extractFields.js:95-97` (version check + full v1 fallback chain). Four Jest regression tests + three sanitize-driven Vitest tests guard the fix.

The remaining structural gap: `computePoints` (both CJS `functions/lib/computePoints.js` and ESM `src/lib/computePoints.js` twin added in weekly-points-summary PR #567) still bypass `extractFields()`, reading raw flat fields directly. The legacy nested step schema arm (`step1.referralCalls`, etc.) would score 0 if ever exercised. No live wizard or import flow writes this shape today. **ESM twin stays flat-schema by design** (same shape as `after.data()` — the trust guarantee for the "+N pts" display).

**Why deferred:** The nested schema arm is a legacy/future-compatibility path; pre-existing and low-risk for the current pilot. Symptom fixed; structural routing is cleanup only.

**Action:** When the nested step schema arm of `extractFields` is ever exercised in production, update `computePoints` to route through `extractFields(after.data())`. Alternatively, if the nested schema arm is confirmed permanently dead, delete it from `extractFields` and close this FU.

**Severity:** LOW (v2 divergence fixed and guarded by tests; only remaining gap bites if a nested-step submission ever lands in Firestore).

---

---

## LoginPattern backdrop — extract to shared component (banked 2026-06-09, LOW)

**Source:** Branded reset handler dispatch (PR #545).

`LoginPattern` (animated insurance-iconography backdrop — 4 rows of drifting SVG glyphs, CSS keyframes, `animate-login-drift-l`/`r`) is currently duplicated across three files: `src/components/auth/LoginScreen.jsx`, `src/components/auth/ResetPasswordHandler.jsx`, and `src/components/auth/EmailVerificationHandler.jsx`. Extracting it to `src/components/auth/LoginPattern.jsx` + updating all three imports would eliminate the duplication.

**Why deferred:** Extraction requires modifying `LoginScreen.jsx`, which was outside the branded-reset-handler brief's file inventory. The duplication is cosmetic/maintainability only — no behavior impact.

**Action:** XS refactor. Create `LoginPattern.jsx`, import in all three consumers, delete the inline copy from each. No test changes required (the existing `LoginScreenV2.test.jsx` backdrop test will cover the extracted component; the handler tests do not test the pattern).

**Severity:** LOW (code quality, no user-visible impact).

---

---

## recoverEmail action mode unhandled — falls through to LoginScreen (banked 2026-06-10, LOW)

**Source:** Pre-merge audit for PR #545 (branded action handlers).

Firebase sends a `mode=recoverEmail` action link to the **old** email address automatically when `verifyBeforeUpdateEmail` is called (i.e., whenever a tenant_admin uses `EmailUpdateModal` to change their email). This link lets the user undo the change if they didn't initiate it. The current `App.jsx` guard handles `resetPassword` and `verifyEmail` but not `recoverEmail` — a clicked recovery link lands on LoginScreen with the oobCode ignored, silently failing to revert the email change.

**Why deferred:** Dormant during the pilot (no email changes expected before the Tatil demo). The `recoverEmail` flow requires `applyActionCode(auth, oobCode)` — same call as `EmailVerificationHandler`. An `EmailRecoveryHandler` component would be a near-copy (3 states: verifying → success | invalid).

**Action:** XS — add `EmailRecoveryHandler.jsx` (copy `EmailVerificationHandler`, update copy to "Email address restored to [old address]"), add `else if (mode === 'recoverEmail' && oobCode)` branch in `App.jsx`, 5–6 tests. Must ship before any tenant_admin email-change is tested in production.

**Severity:** LOW during pilot (no email changes planned), HIGH before any real email-change workflow is exercised.

---

---

## seed-first-tenant-admin — service-account-key-archived.json as fallback key (banked 2026-06-09, XS ops note)

**Source:** `kyronmarchan+tenant@gmail.com` provisioning fix (2026-06-09). `seed-first-tenant-admin.cjs` requires `functions/service-account-key.json`. ADC user credentials (`gcloud auth login`) cannot call `identitytoolkit.googleapis.com` — that API only accepts service account tokens.

**Operational note:** `functions/service-account-key-archived.json` (untracked, gitignored-adjacent) is a valid service account key for `agencytrack-2a610` (`firebase-adminsdk-fbsvc@agencytrack-2a610.iam.gserviceaccount.com`). When `service-account-key.json` is absent and an Admin SDK Auth operation is needed (seed script, claims repair), this file can be temporarily copied: `cp functions/service-account-key-archived.json functions/service-account-key.json`, run the script, then `rm functions/service-account-key.json`.

**Action:** No code change needed. Add this note to the runbook "Step 4 tenant_admin bootstrap" section before the Tatil demo.

**Severity:** LOW (ops knowledge, not a bug).

---

---

## BadgeGrid → gamificationConfig reconciliation (banked 2026-06-10, LOW)

**Source:** MyPointsCard Phase 1 audit (feat/agent-points-surface).

`BadgeGrid.jsx` maintains its own local `BADGES` constant (14 entries) that has drifted from `src/lib/gamificationConfig.js` `BADGE_DEFINITIONS` (9 entries) in two ways:

1. **Label drift on 4 shared keys** — gamificationConfig wins (single source of truth):
   - `streak_8`: BadgeGrid "Consistent" → should be "Committed"
   - `streak_13`: BadgeGrid "Unstoppable" → should be "Quarter Strong"
   - `top_apps_week`: BadgeGrid "App Machine" → should be "Closer"
   - `century_dials`: BadgeGrid "Dialler" → should be "Century"

2. **5 aspirational badges in BadgeGrid not in gamificationConfig** — client-computed stubs requiring server-side or cross-submission logic not yet in the CF pipeline: `dial_king` (highest dials in unit), `sharpshooter` (closing ratio > 80%), `mdrt_bound` (YTD API crosses 50% MDRT threshold), `untouchable` (52 consecutive weeks), `consistent` (12 months ≥ 90% persistency).

**Why deferred:** `MyPointsCard` already reads from `BADGE_DEFINITIONS` (the correct source). The drift only affects the CareerPortal / BadgeGrid surface.

**Action:** (1) Align the 4 drifted labels in `BadgeGrid.jsx` to gamificationConfig values. (2) Decide the 5 aspirational badges: implement CF scoring and add to `BADGE_DEFINITIONS`, or remove from BadgeGrid until the CF pipeline supports them. End state: gamificationConfig as the single badge source; BadgeGrid may keep a thin decorator layer for CareerPortal display metadata (Icon, gradient, tier) not carried by config.

**Severity:** LOW (label inconsistency, no broken functionality).

---

---

## `managerWeeklyReports` — `validWarWrite()` hasAll-only, no hasOnly guard (banked 2026-06-15, LOW)

**Source:** producing-mgr Slice 2.2 Phase 1 audit. `firestore.rules:963–988` `validWarWrite()` uses `d.keys().hasAll([...])` (required-fields list only) but has **no `hasOnly` restriction** — a manager can write arbitrary extra keys to their own WAR doc without rule rejection. The required-fields list does not include `personalApi`/`personalApps`, confirming those fields were never rule-enforced; they were client-side only.

**Action:** Add a `hasOnly([...all-canonical-fields...])` check alongside the existing `hasAll` in `validWarWrite()` to lock the WAR schema and prevent future field drift. The canonical field list is well-defined (activity + recruiting fields, `jfwCount`, metadata). Low risk during the pilot — the WAR form is the only write path for this collection and carries no security-sensitive fields. A holistic hasOnly lock is the correct long-term posture for any collection with a well-defined schema.

**Severity:** LOW (schema unenforced; WAR is manager-self-write only; no security fields at risk).

---

---

## Playwright best-practices sweep — verification scripts (banked 2026-06-08, LOW)

**Source:** Gemini review of PR #543, inline comments 1–6 on accumulated verification scripts.

**Findings (all in `scripts/verification/`):**

1. `persistency-mgr-v2-s2-smoke.mjs:592` — `localStorage.setItem('agencytrack-dark', '1')` should be `'true'` for consistency with `aa-stragglers-axe-walk.mjs:91`
2. `persistency-mgr-v2-s2-smoke.mjs:298` — `page.$` to find edit button; should use `page.locator` with auto-waiting
3. `persistency-mgr-v2-s3a-axe-detail.mjs:54` — hardcoded `waitForTimeout` after clicks
4. `persistency-mgr-v2-s3a-axe.mjs:159`, `:208`, `:216` — hardcoded `waitForTimeout` delays throughout

**Action:** One pass over `scripts/verification/` smoke files: replace `page.$` → `page.locator`, replace `waitForTimeout` chains → `waitFor({ state: 'visible' })` on the target element, normalise dark-mode localStorage value to `'true'`. Mechanical XS sweep — no src/ changes. Batch into one test-tooling PR.

---

---

## Nexus Glass S3 sweep — hero census canon (banked 2026-06-07, PR #534)

**Source:** Phase 0 census confirmed by dispatcher before any conversion (PR #534, `feat/nexus-glass-s3-sweep`). Three #517 cards (CommissionAnchorStrip, SuggestedWeekCard, PersRealityBar) are DONE — not repeated here.

### Census table (Phase 0 rulings — binding)

| Screen | Top-summary card | Component | Verdict |
|--------|-----------------|-----------|---------|
| Agent — Dashboard | YTD/settled API hero | `HomeV2/HeroCard.jsx` | HERO — converted PR #534 |
| Agent — History | "Your Year" anchor strip | `HistoryTab` (HistoryAnchorStrip) | HERO — converted PR #534 |
| Agent — Policy Ledger | Pipeline strip | `policyLedger/PipelineStrip.jsx` | HERO — converted PR #534 |
| Agent — Production Report | Name/rank/metrics card | `AgentProductionView.jsx` (top card only) | HERO — converted PR #534 |
| Agent — Persistency | Summary + value card | `PersistencyTab.jsx` (summary card) | HERO — converted PR #534 |
| Agent — Awards | Grid of medal/badge cards | `AgentAwardsPanel.jsx` | NO-GLASS — awards grid is a worklist of sibling equal-rank items; no single top card |
| Agent — Career Portal | Career level + progress | `CareerPortal.jsx` | NO-GLASS — dense data section + ladder; no dominant summary card |
| Agent — Leaderboard | Rank table | `Leaderboard.jsx` | NO-GLASS — rank table is the UI; no summary above it |
| Agent — Commission | (Done) | `CommissionAnchorStrip.jsx` | DONE — PR #517 |
| Agent — Goals | Gap analysis panel | `GapAnalysisPanel.jsx` | NO-GLASS — inline panel inside dashboard tab, not a top screen card |
| Agent — Profile | Profile photo/name | `ProfileScreen.jsx` | NO-GLASS — profile card is a form surface, not summary data |
| Mgr — Overview (Dashboard) | Team goal hero | `ManagerHeroSection.jsx` | HERO — converted PR #534 |
| Mgr — Production Report | Branch aggregate card | `BranchManagerProductionView.jsx` (top card) | HERO — converted PR #534 |
| Mgr — Awards | Monthly bonus hero | `ManagerAwardsPanel.jsx` (MonthlyBonusHero) | HERO — converted PR #534 |
| Mgr — Policy Reconciliation | Pending count hero | `PolicyReconciliationPanel.jsx` (pending hero) | HERO — converted PR #534; data-gated (renders only when pending > 0) |
| Mgr — Compliance | Reality bar + stats | `CompliancePanel.jsx` (reality bar) | HERO — converted PR #534 |
| Mgr — Persistency (Mgr) | PersRealityBar | `PersRealityBar.jsx` | DONE — PR #517 |
| Mgr — Game Plan | Suggested week | `SuggestedWeekCard.jsx` | DONE — PR #517 |
| Mgr — Master Sheet | Dense submission table | `MasterSheet.jsx` | NO-GLASS — dense data table; no top summary card |
| Mgr — Team (User Mgmt) | Member list | `UserManagementPanel.jsx` | NO-GLASS — worklist/table |
| Mgr — Goals | Goals panel hierarchy | `GoalsPanel.jsx` | NO-GLASS — hierarchy form, not a headline-data card |
| Mgr — Settlements | Settlement list | `SettlementPanel.jsx` | NO-GLASS — dense data table |
| Mgr — Campaigns | Campaign cards | `CampaignPanel.jsx` | NO-GLASS — sibling card grid |
| Mgr — Leaderboard | Rank table | Leaderboard surfaces | NO-GLASS — rank table is the UI |
| Kiosk / Meeting Mode | Opaque fallback governs | Various | NO-GLASS — opaque-fallback surfaces per recipe |

### Per-card notes (PR #534)
- **Mgr Awards MonthlyBonusHero:** `AwardDonut` gains `strokeOverride` prop (backward-compatible null-coalesce). Contention ring → `var(--hero-ink)`; qualified ring → `var(--hero-accent)`. Both certified ≥3:1 graphical via `heroPair` test matrix.
- **Mgr Overview ManagerHeroSection:** `role-hero` (cascades `color:white`) replaced by `glass hero teal`; all `.goal-*` elements given explicit `text-[--hero-ink]` / `text-[--hero-ink-muted-teal]`. GoalDonut / `.bar` / `.bar-fill` CSS classes use literal `white` — work unchanged on glass.
- **Multi-section files excluded from hero-ink guard:** HistoryTab, AgentProductionView, PersistencyTab, BranchManagerProductionView, ManagerAwardsPanel, PolicyReconciliationPanel, CompliancePanel have hero sections inside larger multi-section files. The whole-file scan would false-positive on non-hero buttons/pills/charts. Hero pane correctness for these is verified by Phase 3 smoke (both themes). Future: extract hero sub-sections into dedicated components to re-enable the guard.
- **Mgr Recon pending hero:** only rendered when `pendingCount > 0`; smoke reports data-gate skip — not a defect.

### Future: hero-ink guard extension path
When multi-section components are refactored to extract hero sub-sections into standalone components (e.g. `HistoryHeroCard.jsx`, `ComplianceHeroBar.jsx`), add them to `HERO_COMPONENTS` in `hero-pane-foreign-ink-guard.test.js`. The `@@card-context-start/end` marker mechanism (already used in `CommissionAnchorStrip`) is an alternative for dual-state components.

---

---

### setupBypassSession SPOF (LOW, informational)

**Context:** `graphify query "setupBypassSession"` surfaced it as the top god node (208 edges) — every smoke script under `scripts/verification/` (62+ files) calls it as the single Vercel bypass-cookie handshake. Error sanitization strips the token from any failure message, making root-cause diagnosis harder.

**Risk:** A rotated `VERCEL_BYPASS_TOKEN` silently kills all 62 smokes at once. Rotation is manual and rare; token propagation guidance is already in CLAUDE.md. No code defect — sanitization is intentional security behaviour.

**Action:** No PR required. If a smoke batch fails mysteriously, check token rotation first (`node -e "require('dotenv').config(); console.log({VERCEL_BYPASS_TOKEN: !!process.env.VERCEL_BYPASS_TOKEN})"`). Remove this entry once a token-rotation incident has been documented and the runbook is updated.

---

---

## Gamification — leaderboard reset-model decision (banked 2026-06-10, MEDIUM pre-scale)

**Source:** Points single-source-of-truth + f2fAttempts scoring (PR #556). Deferred per brief.

**Context:** Points accumulate cumulatively and never reset. `onSubmissionWrite` adds the week's computed delta to the agent's running total; `resolveLevel()` maps the cumulative total to a level tier. This is correct for the Tatil pilot but creates a flat leaderboard over time — once an agent reaches Legend (1,000 pts), weekly effort no longer moves their rank.

**Config state (as of this PR):** `f2fAttempts` now scores 1pt per attempt (new term — was 0 before). Badge set is 9 (first_submission · streak_4 · streak_8 · streak_13 · top_apps_week · big_week · century_dials · mdrt_qualified · mdrt_pace). All weights/levels/badges live in a single source: `functions/lib/gamificationConfig.js` (CJS) + `src/lib/gamificationConfig.js` (ESM mirror).

**Decision needed (post-pilot):** Rolling window (weekly or monthly) vs cumulative-with-decay vs cumulative-permanent. Product call for Kyron after pilot data shows engagement trends.

**Action (post-pilot):** If a rolling window is adopted, add a `windowPoints` field to `leaderboard/{uid}` alongside the cumulative `points` field. `functions/lib/computePoints.js` is already the single computation point. A window-reset cron would zero `windowPoints` each cycle without touching `points` (cumulative history preserved).

**Severity:** MEDIUM (pre-scale). Not urgent for the Tatil pilot; revisit after the first month of live data.

---

---

## Gamification — API-vs-app-count weighting review (banked 2026-06-10, LOW)

**Source:** Points single-source-of-truth + f2fAttempts scoring (PR #556). Deferred per brief.

**Context:** Current weights: `applicationsSold: 25` vs `apiPerThousand: 1` (1pt per TTD 1,000 API sold). A TTD 50,000 policy = 50pt from the API term alone — may over-reward large-ticket producers relative to high-volume low-API agents. Weights are inherited from the pre-extraction inline logic; the single-source extraction makes them easy to tune.

**Action (post-pilot):** Review with Kyron after the first month of pilot data. Weights live in `POINTS_WEIGHTS` in `functions/lib/gamificationConfig.js` — one-line change per term. Both CJS and ESM twins must be updated together; the cross-check test at `src/lib/__tests__/gamificationConfig.cross-check.test.js` will fail on drift if only one twin is updated.

**Severity:** LOW (no data integrity impact; aesthetic to the pilot leaderboard standing).

---

---

## Gamification — optional dials-points cap (banked 2026-06-10, LOW)

**Source:** Points single-source-of-truth + f2fAttempts scoring (PR #556). Deferred per brief.

**Context:** The four dial types are summed then floored before multiplying by 1pt/dial. There is no per-week ceiling. An agent logging 500 dials earns 500pt from dials alone — disproportionate relative to FFI (5pt) and CI (10pt).

**Action (post-pilot):** If pilot data shows dial-heavy agents dominating, add `dialsCapPerWeek` to `gamificationConfig.js` and enforce it in `computePoints.js` before the dial sum is multiplied. Cap value should be derived from observed top-decile dial counts. Both CJS/ESM twins must be updated; cross-check test guards drift.

**Severity:** LOW (assess after the first month of pilot data).

---

---

## Nexus Glass recipe HTMLs — AA tables need regeneration from module outputs (banked 2026-06-06, PRs #513 + #517)

**Doctrine (banked 2026-06-06, PR #517):** CD-stated contrast ratios are provisional. The authoritative source is the `glassPair()` / `heroPair()` module output. Recipe AA tables must regenerate from those function outputs, not be authored by hand. Applies to **both** the S1 recipe (`nexus-glass-recipe.html`) and the S2 hero recipe (currently in the CD build annotation for PR #517).

**S1 recipe divergences (banked 2026-06-06, PR #513):** The recipe doc's AA table states `#B45309` at 4.7:1. Two errors compound:

1. **Wrong color for text context.** The text token is `warning-ink` (`[162, 65, 0]`), not the raw base `#B45309`. `glassPair()` confirms warning-ink on light glass is **5.50:1 (teal) / 5.56:1 (gold)** — comfortably above AA 4.5. The raw base at 4.33/4.38:1 passes only the 3:1 graphical threshold.

2. **Wrong background.** The 4.7:1 figure was computed against `--color-bg` (#F7F6F2) directly, not the glass-composited effective background. `glassPair()` composites tint → base@62% alpha → darkest named surface, yielding a cooler effective bg.

**S2 hero recipe divergences (banked 2026-06-06, PR #517):** The CD build annotation had four provisional/incorrect values resolved by `heroPair()`:
- `--hero-ink-muted-teal`: CD claimed 4.6:1 → `heroPair()` yields **4.83:1** (pre-solve #CFE3E3 would have been 4.258:1 — fails)
- `--hero-ink-muted-gold`: CD claimed 4.8:1 → `heroPair()` yields **5.04:1**
- `--hero-accent`: CD claimed 4.9:1 → `heroPair()` yields **4.88:1** (still ≥4.7 floor — passes)
- Gold floor hex: CD had stale value; deepened pane shifts to [111,74,4]@0.93 (light) / [120,82,12]@0.88 (dark)

**Action at next design-doc touch:** Regenerate both recipe AA tables from module outputs:
- S1: `nexus-glass-recipe.html` — from `glassPair()`, `warning-ink` for text column, raw base for graphical-3:1 column
- S2: hero recipe annotation — from `heroPair()` / `heroPairDeep()`, hero-ink tokens for text column, hero-dot tokens for graphical-3:1 column

The `contrast.test.js` matrices are the corrected truth in the interim. **No production or rule changes — docs-only, no urgency.**

---

---

## SettlementPanel — TT-year derivation and display (C-001 / C-002) (banked 2026-06-06, Gemini harvest)

**Severity:** MEDIUM. Money-adjacent — affects which year's settlement data is shown and selected. Not money-math itself (no settlement amounts change; year display/selection is client-side only).

**C-001 — Year selector default uses UTC clock.** `SettlementPanel` derives the current year via `new Date().getFullYear()` (UTC). At TT year-end (Dec 31 TT time = Jan 1 UTC), the panel defaults to next year, showing an empty settlement list instead of current-year data. Fix: replace with `getTodayTT().getFullYear()` (same `dateHelpers` TT-safe pattern as R1-A / R1-C).

**C-002 — Settlement doc `year` field may use UTC date.** Settlement documents written by the manager entry path may derive `year` from `new Date()` rather than TT-safe date logic. A settlement entered on Dec 31 TT time (= Jan 1 UTC) would be stored under the wrong year. Fix: audit `settlementService.js` — wherever `year` is derived, use `getTodayTT().getFullYear()`.

**C-005 rides with this PR (same dateInputs family).** `EditUserDrawer.jsx` renders a date field (join date or similar) using `new Date(dateString)`, which parses an ISO date string as UTC midnight. On TT machines (UTC-4), UTC midnight resolves to the previous calendar day (e.g., `"2026-01-01"` → displayed as "Dec 31 2025"). Fix: use `parseDateOnlyTT()` from `src/utils/dateInputs.js`. XS one-liner.

**Action:** One XS PR — grep `new Date()` in `SettlementPanel.jsx`, `settlementService.js`, and `EditUserDrawer.jsx`. Each UTC-sourced year or date derivation → TT-safe equivalent. **Hard-line reminder:** if the C-002 fix would require back-correcting `year` on existing settlement docs, surface to dispatcher before proceeding — that is data-migration territory, not a client-side fix.

---

---

## Functions day — leaderboardAggregate hardening + S3b nudge CF (banked 2026-06-06, Gemini harvest)

**Context:** Three function-layer items identified during the Gemini harvest (2026-06-06). Per hard-line policy and Rule 19, `functions/**` items are report-only until a dispatcher-authorized functions deploy day. These should ship together in one deploy to minimize deploy count.

**Item 1 — S3b persistency nudge CF (MEDIUM, planned).** Extension of `sendComplianceNudge` for the persistency coaching nudge type. Architecture locked: mirrors the Compliance v2 S3 `compliance.plan.nudge` extension pattern (`NUDGE_CONFIG` map entry + new email template pair). Requires its own kickoff brief (S3b brief). Dispatch when brief is on `origin/main`.

**Item 2 — leaderboardAggregate: empty-WriteBatch crash (MEDIUM, hard-line report-only). ✅ MITIGATED by P5-prep.** P5-prep added an unconditional `batch.set(championsRef, ...)` that runs before `batch.commit()` — the batch always has ≥ 1 op even when branchCount = 0. Existing test at `leaderboardAggregate.test.js:371` pins this. No code change needed.

**Item 3 — leaderboardAggregate: early-January year boundary (downgraded to LOW). ✅ DOES NOT REPRODUCE.** Reproducing test written (`leaderboardAggregate.test.js` — "year-boundary: TT Dec-31 ref" case) and confirmed PASS against current unmodified code. P5-prep's 14-day `lowerBound` cushion ensures late-Dec submissions are within the Firestore query window even when `loadInputs` derives `year` from UTC (not TT). `rankingLogic.getPeriodBoundaries` correctly uses TT-local year via `toTriniDate()`, so the period-filter also handles the boundary. Theoretical inconsistency: `loadInputs` uses `referenceDate.getFullYear()` (timezone-local) while `rankingLogic` uses `getUTCFullYear()` after TT offset — these agree on UTC machines (CI / Cloud Functions) but diverge on non-UTC dev machines. **Banked as LOW FU below; no immediate action.**

**Dispatch sequence:** draft S3b brief → dispatcher authorizes functions day → deploy covers item 1 only (items 2 + 3 already mitigated).

---

---

## leaderboardAggregate: `loadInputs` year derivation — make TT-consistent (banked 2026-06-14, LOW)

**Source:** Year-boundary reproducing-test run (2026-06-14). `loadInputs` in `functions/leaderboard/leaderboardAggregate.js` derives `year` via `referenceDate.getFullYear()` (timezone-local). On UTC machines (CI, Cloud Functions) this equals `getUTCFullYear()`. On a non-UTC dev machine it returns the local year, which differs from TT year in the 4-hour UTC Jan 1 window when TT is still Dec 31. In production this is harmless (Cloud Functions = UTC), but it's inconsistent with `rankingLogic.getPeriodBoundaries` which correctly uses `toTriniDate(referenceDate).getUTCFullYear()`.

**Action (LOW, no urgency):** Replace `referenceDate.getFullYear()` in `loadInputs` with the TT-safe equivalent used by `rankingLogic`: `const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000; const year = new Date(referenceDate.getTime() - TRINI_OFFSET_MS).getUTCFullYear();`. One-line change. Bundle with the next `functions/**` deploy rather than a standalone PR.

**Severity:** LOW (production behavior correct on UTC infrastructure; inconsistency is a latent correctness debt for non-UTC dev environments only).

---

---

## GoalDecompositionTab — sort-stability + NaN guard (banked 2026-06-06, Gemini harvest)

**Severity:** MEDIUM-LOW. Money-math adjacent — the tab feeds the "Save as my goal" write path (Commission v2 S3). A NaN in a stage value would display as "NaN" in the TTD chip and could corrupt the CTA confirm dialog's displayed figure. Requires dispatcher authorization before touching (money-math engine adjacent).

**Sort-stability.** The 7-stage ladder is built from a stages array sorted by `stageIndex`. If two stages have equal sort keys (schema migration, future stage added without an explicit index), order is non-deterministic across JS engines. Fix: stable sort with a secondary tiebreak on a stable field (e.g., `stageId.localeCompare(stageId2)`).

**NaN guard.** Stage value computations divide by user-controlled inputs (`commissionRate`, `avgPolicyAPI`). If either denominator is 0 or missing, the division produces `NaN` or `Infinity`, which renders as `"NaN"` in the TTD-formatted chip and in the confirm dialog's "new API" display. Fix: guard each division — display `—` fallback label when denominator is zero.

**Action (when authorized):** Targeted edits in `GoalDecompositionTab.jsx` / `commissionAnchor.js`. No rules, no writes, no schema changes. Phase 1 must confirm the denominator guard does not alter the "Save as my goal" write behavior for valid (non-zero) inputs.

---

---

## LoginScreen — responsive backdrop on narrow viewports (banked 2026-06-06, Gemini harvest)

**Severity:** LOW. Cosmetic only — operator judgment required before any fix.

**Context:** The SVG pattern background in `LoginScreen.jsx` (`src/components/auth/LoginScreen.jsx`) is sized as a fixed-dimension SVG. On narrow-viewport phones (< 375px width), the decorative geometric pattern may clip or leave raw `bg-color` bands at screen edges rather than filling the full viewport.

**Action:** Operator reviews on 320px and 375px viewports (Chrome DevTools responsive mode, or physical device). If the gap is visually significant: clip or scale the SVG `viewBox` to `100vw × 100vh`. If negligible at pilot-target devices (iPhone SE upward, ~375px+), mark no-fix and close this FU. No urgency — login page is fully functional.

---

---

## Persistency Mgr v2 — remaining slices (banked 2026-06-05 from Persistency Mgr v2 S1, PR #505)

**Context:** S1 (PR #505) shipped the manager Persistency panel redesign — `PersRealityBar` (aggregate %, 6-month sparkline, stats), `PersAtRiskBook` (exception-first agents below 80%; celebration arm; Coach → existing `CoachingNotesModal`), and `PersRoster` (two-tick band track at 80%/90%, source badge, Edit + Play). Read/derive only — zero writes, rules changes, Cloud Functions, or index changes. `PersistencyAgentRow.jsx` deleted (replaced). `computeBarStats()` + `PERS_FLOOR` / `PERS_GATE` exported from `src/lib/persistency/calculations.js`.

**D3 degradation (banked):** The build annotation stated `lockedByManager` exists on persistency docs. Source inspection: **field is absent** from the schema. Source badge is derived from `enteredByRole` alone (manager-role values → "Manager · locked"; agent role → "Self-entry · date"). If the field is ever added to the write path, `SourceBadge` in `PersRoster.jsx` can upgrade cleanly — the derivation logic is isolated there.

**Remaining slices (each needs its own kickoff brief):**

- **S2 — Entry drawer restyle.** `CoachingNotesModal` + `PersistencyEntryForm` modals restyle to match the v2 visual language (currently reused as-is from the legacy surface). Entry form is the manager's write path for persistency data — S2 is the natural moment to revisit the form layout, field labeling, and inline validation UX.

- ~~**S3a — What-If Playground.**~~ **SHIPPED — PR #515 (`f3300f8`, HUMAN-MERGE, 2026-06-06).** Client-side-only UI over the existing `projectPersistency()` / `calculateShortfall()` engine. Two levers (New Business Planned + Reinstatements Planned). Two-tick band visualization (80% floor / 90% gate). Reset affordance. Shortfall cards for NB + NR targets. D4 lapsed-link for agent self-mode → navigates to Policy Ledger with 'lapsed' chip pre-selected. Play button unconditional on `PersRoster` (was guarded by `hasRecord`). `policyLedgerDerivation.js` gains 'lapsed' filter key (purely additive; lapsed-only, excludes NTU/denied). CLIENT-SIDE ONLY — zero writes, zero rules/CF/index changes. Suite 2505/2505; lint 0; build clean; smoke 22/22 PASS (both themes, BM + agent legs). Smoke locator fix: chip textContent includes count badge (e.g. "Lapsed0") — use `data-testid="ledger-filter-lapsed"` not text equality.

- **S3b — Nudge write.** `PersistencyPlayground` "coaching" mode already connected (S1 wired; S3a ships the playground UI). S3b adds: (a) the what-if nudge write path (manager-to-agent persistency coaching note or target via the `sendComplianceNudge`-style nudge primitive), (b) share/export from the playground. Each needs its own kickoff brief. Manager suggest-a-goal also in manager-program backlog (see § Manager-program backlog below).

**Deferred scope item (SM cross-branch):**

- **SM scope toggle.** The brief called for a SM cross-branch scope picker on `PersRealityBar`. The `SmLeaderboardView.jsx` branch-picker is tightly coupled to leaderboard context (`branchIdOverride`, `scopeRoleOverride`) and won't drop in cleanly without a dedicated architecture discussion. Deferred to a named slice or SM-scope standalone brief. In the interim, `sales_manager` falls through to `ROLE_DEFAULT_SCOPE['branch']` (their `branchId` scope), which is safe for the pilot. Revisit when SM cross-branch surfaces become a priority.

**Banked addenda (post-merge, 2026-06-05):**

- ~~**Coach-drawer deferred leg (n/a in preview env).**~~ **CLOSED — PR #509 (`aa5ad63`) sentinel window, 2026-06-06.** Smoke legs 3 (AT-RISK + ORDERING) and 4 (COACH) proved live: sentinel at ~70.0% below-floor appeared in `PersAtRiskBook` exception-first; Coach action opened `CoachingNotesModal` with the correct agent props. Restore PASS (both agents). No at-risk-data gap remaining.

- **n≥2 sum-vs-mean live proof — RECORDED, PR #509 sentinel window.** Two sentinel entries (agent A and agent B, distinct values: A→~70.0%, B→~65.0%) verified branch aggregate = `netSettled_sum / grossSettled_sum` → **DOM 67.1%** — diverges from the mean of (70.0%, 65.0%) = 67.5%. This live proof under production Firestore conditions validates the D1 unit anti-mean fixtures. The `computeBarStats()` formula is confirmed sum-not-mean both in unit tests and live.

- ~~**Micro-FU — promote bearer-token capture into `walk-helpers`.**~~ **CLOSED — PR #508 (`e729fec`), GREEN-CHANNEL, 2026-06-06.** `captureOrFetchBearerToken`, `captureConsoleAndNetwork`, `formatCaptureReport` promoted to `scripts/verification/lib/walk-helpers.mjs`. S1 smoke refactored to consume it (behavior-identical). Auto-merged per brief pre-authorization (scripts-only class).

---

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

---

## Weekly Planner S2 derived-state live walk (LOW, banked from Weekly Planner v2 Slice 3a, carried from #471 pre-review)

**Context.** The S2 and S3a E3 smokes exercise the **floor** resolution (the test agent has <8 submitted weeks of history, so `deriveRatiosFromHistory` returns `hasHistory: false`). The **derived** resolution path — where Dials/CIs/Apps pre-fill from the engine chain rather than the company floor, and the committed pace rows render against an engine-derived plan — has never been walked on a live preview because no agent account in the preview env has ≥8 submitted weekly reports.

**To close.** Seed (or use a real account with) **≥8 `status:'submitted'` weekly submissions** for the smoke agent, then re-run the S2 + S3a smokes and confirm: the card resolves to `suggested-week-derived`, the steppers pre-fill `derived` provenance for Dials/CIs/Apps, and the committed pace rows render correctly against the derived plan. Until then, the derived path is covered only by RTL component tests (`SuggestedWeekCard.test.jsx` / `.plan.test.jsx` / `.pace.test.jsx`), not a live walk.

**Companion gap — S3a daily-source (mid-week) live walk.** The same smoke agent has a **submitted weekly report for the current week** (confirmed `2026-06-04`: `weekStarting 2026-05-31`, v2), so the S3a committed pace rows resolve to the **`final · submitted`** source — the live walk verifies the *final* arm (calls resolves to the 5-component sum, no live pace marker), not the *daily/mid-week* arm (hatched calls + live pace marker fed by the Daily Capture aggregate). The S3a smoke is source-aware and PASSES on the final arm; the daily arm is covered by RTL (`SuggestedWeekCard.pace.test.jsx` mid-week cases) + unit tests (`planVariance.test.js`). To walk the daily arm live, use a smoke agent with a committed plan but **no** submitted report for the current week, then confirm the chip reads `mid-week · daily capture`, calls is hatched, the pace marker shows, and the four daily-sourced rows reflect entered Daily Capture values.

**Why LOW.** The derivation math is unit-tested (`goalDecomposition.test.js`, `weeklyPlanAssembly.test.js`, `planVariance.test.js`) and the component rendering is RTL-tested; only the live-Firebase end-to-end of the derived branch is unverified, and it shares all write/read/rules paths with the floor branch that the smokes DO walk.

---

---

## Over-goal MDRT marker treatment on the HeroCard (LOW, banked 2026-06-03 from HeroCard marker-label fix PR #436)

**Context.** The HeroCard marker-label fix (`src/components/dashboard/HomeV2/HeroCard.jsx`) now **hides** the MDRT marker when it's off-scale (`MDRT_THRESHOLDS_2026.mdrt > goal` — e.g. the default 200,000 goal vs the 688,800 MDRT threshold). This is correct for legibility (it was the clamp-onto-the-goal-label collision source), but it means an agent whose personal goal is below the MDRT threshold sees no MDRT reference on the hero bar at all.

**Possible treatment (if wanted).** Surface over-goal MDRT progress with its own affordance rather than omitting it — e.g. an "MDRT: TTD {ytd} / 688,800" caption below the bar, a secondary mini-bar scaled to MDRT, or a link to the Career/MDRT tracker where MDRT progress already lives. Purely additive; no change to the on-scale bar behavior shipped here.

**Why LOW.** The shipped fix is correct and complete for the bug (legible, non-overlapping labels). MDRT progress is already tracked in the Career/MDRT surface, so nothing is lost — this is an optional enhancement, not a gap. Decide alongside any broader hero/MDRT design pass.

**Cross-reference (updated PR #792 goals-v3-closure-sweep, 2026-07-04):** `src/components/dashboard/HomeV2/HeroCard.jsx` (`mdrtOnScale` gate); `src/config/mdrtThresholds/2026.js` (`MDRT_THRESHOLDS_2026.mdrt = 688800`) — supersedes the retired `src/constants/mdrt.js` (`MDRT_THRESHOLD = 500000`, deleted).

---

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

---

## Daily Capture anchor strip — targets + dials chip (MEDIUM, banked 2026-06-02 from Daily Capture v2 Slice 1 PR #426)

> **RE-SCOPED 2026-07-25** (Wave 1 item 2, dispatcher-approved). Verified against `origin/staging` @ `8a1a17e4`.
> The original body's premise that **`dials` is a new schema field is STALE** — `dials` has since shipped
> as a live daily field. What remains splits into **two narrow, independent halves**, sized very
> differently. Original body preserved below the split for the drift trail (Rule 11).

**Status:** both halves genuinely open, for narrower reasons than originally banked. The v2 anchor strip
partially shipped in `858be570` (2.10) — a `DailyAnchorStrip` and a pace state now exist — but neither
half of *this* FU was closed by it.

### Half A — Dials chip on the WTD count strip (SMALL, self-contained)

The strip is still the original four chips. `dials` data is already there; only the chip is missing.

| Evidence | Finding |
|---|---|
| `src/components/daily/DailyCaptureV2.helpers.js:40-48` | `deriveCountStripChips` returns **exactly** `{appr, ffi, ci, apps}` — four keys, no dials. This is the strip's sole data source. |
| `src/components/daily/DailyCaptureV2.jsx:969` | `<StepperRow label="Dials (total calls)" name="dials" …>` — **the field is live and captured.** |
| `src/components/daily/DailyCaptureV2.helpers.js:55` | `daily.dials` already maps to the `coldCalls` bucket and feeds `computePoints` — **already in the aggregate/points path.** |
| `src/components/daily/DailyCaptureV2.jsx:431` | A `Dials` row already renders — but only in `SundayConfirmView`, a **different surface** from the WTD strip. |

**Scope:** add a `dials` key to `deriveCountStripChips` (summing `dials` across `weekDocs`, same idiom as the
existing four), render the fifth chip, update `DailyCaptureV2.test.jsx` + the helpers test. **No schema
change, no aggregator change, no rules change, no new read** — the data is already loaded. Steps 2, 3, 5
and 6 of the original scope below are **obsolete**: the field, the aggregator roll-up and the write path
all already exist and are rules-accepted in production.

### Half B — Per-agent manager-set targets (MEDIUM, schema + write-path decision)

A target *is* rendered — but it is the tenant-wide company floor, never a per-agent manager-set value.
This is the actual head-of-sales ask and the substantive half.

| Evidence | Finding |
|---|---|
| `src/components/daily/DailyCaptureV2.jsx:695-697` | `weeklyApiTarget = Number(weeklyFloors?.api ?? DEFAULT_WEEKLY_ACTIVITY_FLOORS.api) \|\| 0`, with the in-source comment *"company floor, same source HistoryTab uses. Code default (4800) applies until floors load."* |
| `src/components/daily/DailyCaptureV2.jsx:299-330` | `DailyAnchorStrip` consumes it — renders `wtdApi / weeklyTarget`, `"{pct}% of weekly target"` / `"Weekly target cleared"`. |
| `src/components/daily/DailyCaptureV2.jsx:705-715` | `weeklyPointsFloor` → `weekToDateTarget` → `computePaceState` — the pace mechanic reads the **same** company floor. |
| — | **No per-agent target read exists anywhere in the component.** |

**Scope:** decide the target source in the existing goals hierarchy (agent commitment → unit → branch →
company floor) and thread it through as an override on `weeklyFloors`, so the company floor stays the
documented fallback rather than the only value. Original scope item 1 stands; the rest is now a read-path
+ provenance question (which layer won, and does the strip say so), not a schema-capture question.

**Why the split matters:** Half A is a few lines behind a pure helper with full test coverage; Half B is a
goals-hierarchy decision with provenance-display implications. Bundling them under one MEDIUM FU has
already caused the whole item to read as blocked on the head-of-sales decision when half of it is not.

<details><summary>Original body (2026-06-02) — preserved for the drift trail</summary>

**Status:** Slice 1 shipped the counts-only WTD strip (APPR/FFI/CI/APPS, no targets, no dials). Slice 2 evolves it into a manager-set-target experience and adds a new daily dials/calls field.

**Background.** The v2 mockup originally drew a richer anchor strip with target chips and a DIALS chip. Slice 1 deliberately deferred both because (a) `target*` writes belong to manager-set goals (`unitGoals` / `branchGoals`) and the dispatcher decision is head-of-sales; (b) the existing daily entry has no `dials`/`calls` field, so capturing daily dials is a *new schema field* — not a port. Slice 1's reduced strip ships the counts mechanic; Slice 2 layers governance + the new field.

**Scope when dispatched:**

1. Decide where target values come from for daily strip (likely the closest applicable layer in the existing goals hierarchy: agent commitment → unit → branch → company floor).
2. Add `dialsToday` (or equivalent) field to `dailyActivity.js` `createEmptyDailyEntry`; mirror the wizard/legacy field name if one exists (cross-check `extractFields.js` and existing weekly schema).
3. Extend the aggregator to roll the new field into the weekly draft (need a weekly key — TBD with head-of-sales).
4. Extend `DailyCaptureV2`'s count strip to (a) draw target ring/progress under each chip and (b) include the DIALS chip alongside APPR/FFI/CI/APPS.
5. New tests: target-derivation rules + dials field round-trip + aggregator regression with the new field.
6. Verify Firestore rules accept the new field on writes (additive — likely no rules change required, but confirm during Phase 0).

</details>

**Cross-reference:** `src/components/daily/DailyCaptureV2.jsx` `CountStrip` block; `src/components/daily/DailyCaptureV2.helpers.js`; `src/lib/schema/dailyActivity.js`; `src/lib/schema/dailyActivity.aggregator.js`; `docs/design/daily-capture-slice-1-build.html` annotations. Ledger row 6: `docs/track-j-port-ledger.md` § Row-6 verdict.

---

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

---

## Track J — Cyril agents have goals + policies but no seeded submissions (LOW, banked 2026-06-03 from demo-surfaces seed PR #443)

**Status:** OPTIONAL demo-prep polish (re-banked from the superseded "Cyril branch rich seed" FU above).

The demo-surfaces seed (`seed-demo-surfaces.cjs`) gives the **3 real Cyril agents** (`ljbBHP1g7lbZXvHlpcDn`: PR-D Smoke Agent 2/3/4) personal **goals + policies**, so their agent dashboards / Policy Ledgers look alive. But **submissions** for Cyril are still NOT seeded — `seed-leaderboard-test-data.cjs` only resolves the `tatil_south` agents (its Cyril path keys on the absent `@agencytrack.test` roster). So the SM cross-branch leaderboard comparison still shows Cyril empty.

**What this FU buys:** populate Cyril's leaderboard so the SM all-branches picker shows a real side-by-side comparison (vs. populated-vs-empty).

**Scope when dispatched:** extend `seed-leaderboard-test-data.cjs`'s roster resolution to cover Cyril's **real** agents by UID/name (the 3 PR-D smoke agents — NOT the absent `@agencytrack.test` roster), with a deliberately different ranking shape than `tatil_south`; dispatcher pre-reviews the dry-run; live `--execute --i-confirm-prod-write`; recompute; verify. This is the precise remainder of the superseded Cyril rich-seed FU.

**Why LOW:** honest empty-state is correct production behavior; this is demo polish, not a correctness gap.

**Cross-reference:** `functions/scripts/seed-demo-surfaces.cjs` (goals+policies, this PR); `functions/scripts/seed-leaderboard-test-data.cjs` (`CYRIL_RANKINGS` keys on `@agencytrack.test` emails — the gap); superseded FU above.

---

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

---

## Phase 9 — SM target: multi-territory branch-based resolution (MEDIUM, banked 2026-05-28)

Phase 9 resolves the agent→SM link via a query-by-role shortcut: `getSalesManagerUid` queries `users` where `role == 'sales_manager'`, valid only while exactly one SM exists. For multi-territory support, add `salesManagerId` to branch docs + an SM-assignment UI in GoalsPanel/UserManagementPanel, and replace the query-by-role shortcut with branch-based resolution (read `branches/{agentBranchId}.salesManagerId`).

**Action:** (1) Add `salesManagerId` to branch schema (`branchService.js` createBranch/updateBranch). (2) Update `getBranch` callers that expose branch-edit UI to include an SM-assignment field. (3) Replace `getSalesManagerUid` with a branch-lookup inside `getGoalHierarchy`. (4) Update rules if needed for the new field.

**Priority:** MEDIUM. Harmless under single-SM/single-territory. Implement before multi-territory pilot.

Banked: Phase 9 build PR #381 (`6829f9d`), 2026-05-28.

---

---

## Phase 9 — SM write-model inconsistency: SM can write unitGoals but not branchGoals (MEDIUM, banked 2026-05-28)

`firestore.rules` `unitGoals` write arm includes `sales_manager` (unscoped, tenant-wide — BUG-N2 line). `branchGoals` write arm excludes `sales_manager`. Harmless under single-SM (one SM = whole tenant = effectively their territory). When multi-SM territory scoping is built, resolve holistically: either scope SM's `unitGoals` write to their territory's units (mirror the UM `callerUnitId` pattern for their branch set) or remove the SM arm if SM-target-setting is the intended write surface.

**Priority:** MEDIUM. Harmless today; creates a write-surface inconsistency that matters when territory scoping is added.

Banked: Phase 9 build PR #381 (`6829f9d`), 2026-05-28.

---

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

---

## H3 Phase 2 real-data parity sweep — re-run when agent has ≥10 settled policies (LOW, banked 2026-05-27)

Phase A3 real-data sweep skipped: test agent `J0j4uBqzTPcfm1IlGCPyDzo27RP2` has < 10 settled policies in production (1 confirmed in previous session). No other agent found with ≥10 settled policies at time of sweep.

**Action:** Re-run Phase A3 sweep against production after (a) a richer test-agent dataset is seeded via the PR-F bulk-seed tooling, or (b) the pilot launches and real production activity accumulates. Sweep command: inline REST script in session — queries `tenants/tatillife_south/policies` grouped by agentId for status=settled count; if any agent ≥10, runs `settlementShapeFromPolicies` derivation vs `settlements` collection read-only diff.

**Priority:** LOW. H3 emulator parity is the primary gate; real-data sweep is validation-of-validation.

Banked: Phase A3 skip, 2026-05-27.

---

---

## F2.2 unarchive — archive is one-way in UI; add field-flip path when needed (LOW, banked 2026-05-27)

`archiveJointCall()` in `jointCallsService.js` sets `archived: true` with no inverse method. The Firestore rules `hasOnly` allowlist includes `archived` (accepts `false`), so the Firestore path is already open at the rules layer. No in-app recovery exists if a manager accidentally archives an observation.

**Action:** Add `unarchiveJointCall(tenantId, authorUid, callId)` to `jointCallsService.js` (`archived: false` patch). Wire to a UI action — either a toggle within the archive confirmation dialog, or an "Archived" secondary list with an Unarchive button. Match the same author-only rule gate as archive.

**Priority:** LOW. No observations archived in production yet. Implement at first reported accidental archive.

Banked: F2.2 PR #362 (`517e16d`), 2026-05-27.

---

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

---

## H4 — contributedPolicyIds array growth on long-lived pending entries (LOW, banked 2026-05-28)

`aggregatePendingPlan` (CF) stores `contributedPolicyIds[]` per `pendingReview` entry for idempotent deduplication — each source `policyId` that fires the CF is appended to the array, and duplicate fires for the same `policyId` are no-ops. If a single pending entry stays unprocessed for a long time and accumulates many contributing policies (rare — the intended flow is: admin reviews weekly, promotes or dismisses), the array grows unboundedly.

At expected volumes (tens to low hundreds of agents, each submitting a few policies per month), this is well under the 1 MB Firestore document limit. No action needed now.

**If observed in practice:** cap `contributedPolicyIds` at N (e.g. 500) by slicing before append, or migrate the sub-array to a subcollection. Either change is non-breaking — the idempotency check (`ids.includes(policyId)`) still works on a capped array, just stops deduplicating policyIds beyond the cap, which is fine at that volume.

**Priority:** LOW. Admin should review `pendingReview` periodically as part of normal plan-catalog hygiene. Banked 2026-05-28 (H4 PR #370 review prep).

---

---

## CF emulator integration tests for FieldValue writes (LOW, banked 2026-05-28)

CF unit tests mock `admin.firestore.FieldValue` so they pass write payloads that Firestore rejects at runtime. Caught in H4 post-deploy: `aggregatePendingPlan` used `FieldValue.serverTimestamp()` inside an array element; Jest mock returned a plain string (valid value), but real Firestore threw at `tx.update()` time. The bug was invisible until the post-deploy smoke ran.

**Action:** Consider lightweight emulator-based CF integration tests using `firebase emulators:start --only firestore,functions` for any CF that uses `FieldValue` methods or writes complex nested structures. These tests bypass the mock layer and exercise the real Firestore SDK validation. Acceptable safety net at current CF count (small); worth formalizing if CFs proliferate.

**In the interim:** For any CF that writes `FieldValue` sentinels inside array or map fields, add a smoke assertion that exercises a real write-read round-trip (as the H4 smoke does for legs c/d). The regression test pattern (assert `firstLoggedAt.toMillis` is a function) is a useful unit-test guard but not a substitute for real-write verification.

**Priority:** LOW. Current post-deploy smoke provides coverage. Emulator integration tests would shift the detection surface left (pre-deploy).

Banked: 2026-05-28, H4 CF hotfix PR #373 (`df161fe`).

---

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

---

## H3 — `validate()` raw `new Date()` date guards (LOW, banked 2026-05-28)

`policiesService.js:validate()` calls `new Date(dateWritten)` / `new Date(dateSubmitted)` / `new Date(dateIssued)` for the "not in future" guard check (e.g. `if (fields.dateIssued && new Date(fields.dateIssued) > new Date())`). These guards use the raw parser, not `parseDateOnlyTT`. The consequence: a policy saved with `dateIssued = '2026-06-01'` (June 1st, TT) would have its raw-parsed Date = UTC midnight = TT 20:00 May 31. The guard `> new Date()` passes correctly (the date is in the past by the time the policy is settled), but if a future-date validation check were to run at a TT midnight boundary, it could misclassify the date as "yesterday in TT" instead of "today".

**Action:** Replace the raw `new Date(dateStr)` calls inside `validate()` with `parseDateOnlyTT(dateStr)` for date-only string comparisons. Low mechanical risk — one import, three replacements.

**Priority:** LOW. No observable validation bug today (guards are only used for rough "not in future" checks, not for period-key derivation). Fix in the same PR as the next policiesService maintenance work.

Banked: 2026-05-28, H3 TZ fix close-out audit.

---

---

## H3 — `getTodayTT()` en-CA locale dependency note (LOW, banked 2026-05-28)

`getTodayTT()` in `src/utils/dateInputs.js` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date())`. The `en-CA` locale is used specifically because it reliably produces `YYYY-MM-DD` format — ISO date string — across all major browsers. If `en-CA` support were absent (exotic or old user-agent), the output might not be `YYYY-MM-DD`, and downstream callers that do `.substring(0, 7)` for periodKey derivation would silently produce garbage.

**Action:** Add a one-time runtime guard (or a unit test) that validates `getTodayTT()` returns a 10-char string matching `/^\d{4}-\d{2}-\d{2}$/`. This is a belt-and-suspenders check — `en-CA` is part of the ECMAScript Internationalization API (mandatory since ES2015) and should be universally supported. But the guard makes the contract explicit and catches any future polyfill or SSR environment gap.

**Priority:** LOW. Universal browser support for `en-CA` locale is well-established. The unit tests already validate the output format for specific dates via fake-timer clock. An explicit format-guard test is additive hardening only.

Banked: 2026-05-28, H3 TZ fix close-out audit.

---

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

---

## moneyNeeds `shareWithSm` owner-update arm is UI-gated only — no rule enforcement (LOW, banked 2026-05-27)

**Scope:** ~~`updateVisibility` in `moneyNeedsService.js` accepts a `shareWithSm` boolean and patches it onto the worksheet doc.~~ **Stale-premise correction (post-merge fill PR #785, 2026-07-03, Rule 11 trail):** `updateVisibility(tenantId, uid, year, visibility)` no longer takes or patches `shareWithSm` — it patches `visibility` + `updatedAt`/`updatedBy` only (verified `moneyNeedsService.js:570`). `shareWithSm` exists solely as a scaffold default (`:355`, `false`) with no live write path. The rule-side concern remains valid as written: the owner update arm (`firestore.rules` ~:1480) does not field-restrict, so an owner could still set `shareWithSm: true` via raw `updateDoc`. The UI no longer offers the toggle; the field is dormant pending any SM surface.

**Action:** When manager-owned worksheets ship (Track G extension or beyond), harden the update arm to enforce that only a BM can set `shareWithSm` — e.g., add `(!affectedKeys().hasAny(['shareWithSm']) || isRole('branch_manager'))` to the owner update predicate. Until manager-owned worksheets exist, the UI gate is sufficient: no BM-authored worksheet path exists, so the only actor who could self-set `shareWithSm` is the owning agent, and sharing their own data upstream has negligible privacy impact.

**Priority:** LOW. Owner-only update arm means no cross-user exploit. Harden when manager-owned worksheets ship.

Banked: G5 PR #354 (`f200bc6`), 2026-05-27.

---

---

## Track I I2 — Monthly recruiting standards + accountability flag (LOW, banked 2026-05-23)

**Scope:** I2 ships raw capture only — `candidatesAssessed` + `agentsContracted` with no targets or flags. Once data flows and definitions are confirmed (see FU below), add monthly recruiting numeric standards to `config/managerActivityStandards` (extend `NUMERIC_STANDARDS` keys: `candidatesAssessedTarget`, `agentsContractedTarget`). Wire accountability flag logic (`computeMissedActivities`) to the monthly rollup. Surface as an informational warning panel on `MonthlyRecruitingTab` analogous to `AccountabilityFlagPanel`.

**Action:** After definitional confirmation FU closes (head-of-sales confirms semantics), extend `ActivityStandardsModal`/`ActivityStandardsPanel` with a "Monthly Recruiting" section; extend override layer; extend flag display.

**Priority:** LOW. No targets set yet; flag meaningless until definitions confirmed and baseline data collected.

Banked: I2 PR #280.

---

---

## Track I I2 — `recruitsInFirstWeeks` auto-derive from `contractStartDate` (LOW, banked 2026-05-23)

**Scope:** Track I design spec §5 lists `recruitsInFirstWeeks` as a potential field — how many of the `agentsContracted` completed a milestone (e.g. first sale, first WAR submission) within N weeks of contracting. This requires `contractStartDate` on the agent user doc + a query or Cloud Function aggregation. Not built in I2 (capture only).

**Action:** When `contractStartDate` is available and the field definition is confirmed, auto-derive `recruitsInFirstWeeks` by querying the contracted agents' user docs + submission records. Consider a nightly CF aggregation.

**Priority:** LOW. Deferred until baseline `agentsContracted` data flows for a few months and the definition is validated with head-of-sales.

Banked: I2 PR #280.

---

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

---

## Leaderboard ranking not filtered by `active` flag (MEDIUM, banked 2026-05-24)

**Context:** Surfaced in the #296 Phase-5 smoke. After setting `active: false` on a test agent, the agent still appeared in the Leaderboard ranking. PR #296 guarded only the photo-map fetch in `Leaderboard.jsx` (line ~102, `if (data.active === false) return`). The ranking rows come from the `leaderboard` subcollection (`tenants/{tenantId}/leaderboard`) queried at `Leaderboard.jsx:74` — an independent `onSnapshot` that has no `active`-flag filter. The subcollection is populated by a cron/CF.

Phase-1 undercounting: the #296 Phase-1 enumeration audited the photo-map fetch but missed the ranking subcollection as a second leaderboard surface. Both are in `Leaderboard.jsx` but serve different data paths.

**Fix (CF/cron, not client filter):** The subcollection write path is the correct place to enforce this — either (a) the cron that populates `leaderboard/` should skip users where `active === false`, or (b) the subcollection write should delete existing entries when a user is deactivated. A client-side filter on the read is an option but less durable (cached data can outlast the client session). Group with the `terminatedAt` / deeper-termination family.

**Priority:** MEDIUM. Deactivated agents appearing in rankings is visible UX noise, not a security issue. No agents have been deactivated in production yet. Not blocking pilot.

Banked: #296 smoke (`27b1c8a`, 2026-05-24).

---

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

---

## Track I I3 — 2-consecutive-week intensifier (LOW, banked 2026-05-22)

**Scope:** Track I spec §4 — "two consecutive missed weeks can raise the flag's prominence on the upline dashboard. Still purely a flag."

**Action:** at render-time, fetch the previous week's WAR doc by predictable id (`{managerId}_{prevWeekStart}`); if the previous week's missed-activity set intersects the current week's, render the intersecting chips with stronger visual (red border + ⚠ icon, or escalate from warning to error tone). For Tier 2, the CF could optionally include "Nth consecutive" in the notification body via the same previous-week read.

**Priority:** LOW. Sharpens an already-visible signal; not blocking.

Banked: I3a PR [#271](https://github.com/Kelsean868/agencytrack/pull/271) (`032e38a`).

---

---

## Track I I3 — `ManagerDashboard` Overview accountability chip (LOW, banked 2026-05-22)

**Scope:** Track I spec §4 Tier 1 says "on the manager's own dashboard" — currently I3a surfaces the flag on the WAR tab only. Top-level `ManagerDashboard` Overview tab could surface a small "N standards under target this week" chip linking to the WAR tab.

**Action:** on `ManagerDashboard` mount (when viewer is a `unit_manager` / `branch_manager` / `sales_manager`), fetch the latest-week WAR doc + `getResolvedStandards` for the viewer; render a small warning chip with the missed count when > 0. Chip click → routes to "My WAR" tab.

**Priority:** LOW. WAR tab is the primary surface; this is a discoverability nudge.

Banked: I3a PR [#271](https://github.com/Kelsean868/agencytrack/pull/271) (`032e38a`).

---

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

---

## Track J3 → Track I — Manager levels 8–10 production model (LOW, banked 2026-05-20)

**Scope:** The head-of-sales slide carries a manager-tier production model (manager levels 8, 9, 10) with three components per level: personal API + per-advisor production + unit total, all tenure-scaled. This is **Track I (Manager Activity Reporting) territory**, not Track J — recording here because it surfaced in the same slide as the tenure-floor table.

**Where it lands:** Track I when that track is planned. Mention in the Track I scope brief that manager-level production targets carry forward from this slide (subject to the same provisional confirmation as tenure floors).

**Priority:** **LOW**. Track I has not been scoped yet; this is a forward-reference note so the manager-production-model question doesn't get lost.

Banked: PR #240 (`4134d2c`).

---

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

**Still current (re-confirmed 2026-07-02, FU-cat08-theme-guard PR):** `agent-001@agencytrack.test` login against production still returns "Incorrect email or password" — the credential gap has not closed in the intervening ~7 weeks. The 4th acceptance criterion above (`cat08-screenshot-dossier.mjs` T8.ALL ≥80 shots) remains unverifiable end-to-end until PR-F seeding runs; the Tenant Admin credential tier (`A11Y_TENANT_ADMIN_*`) is unaffected and was used as a substitute to verify the theme-guard fix's mechanics in isolation (11/11 shots for that role, zero guard throws) — see the FU-cat08-theme-guard resolved entry above for detail. This does not close this item; the ≥80 full-dossier count still needs the `*@agencytrack.test` roster.

---

---

### Delete tenant_admin historical test submissions (LOW, backfill cleanup)

5 test submissions exist in `tenants/tatillife_south/submissions/` for uid `4GeeZbhZBwdtGOLoJoggf4MQo142` (Kyron Marchan, tenant_admin — formerly super_admin). These are artifacts of early testing with Kyron's own account. Tenant admins don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

---

### Delete branch_manager historical test submissions (LOW, backfill cleanup)

4 test submissions exist in `tenants/tatillife_south/submissions/` for uid `x8Zfg2TI1yf8JOljqxCsJszxnx93` (Test Branch Manager, branch_manager). These are artifacts of testing BM role flows. BMs don't submit weekly reports in real usage. Cleanup can be done via a one-time delete script when next touching `scripts/backfill/`.

---

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

---

## React Compiler adoption — already documented below; left in place for context

---

## React Compiler adoption (long-term, conditional)

**Scope:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules disabled in
`eslint.config.js` (see Lint Policy in CLAUDE.md). If `@babel/plugin-react-compiler` is
ever adopted, re-enable those rules and refactor the ~19 data-fetch `useEffect` patterns
they flag.

- Not blocking anything; purely a note for when React Compiler reaches stable adoption
- No PR needed until the Compiler is intentionally added to the project

---

---

## SEC-9b — Cross-tenant isolation audit

**Scope:** Firestore rules were tightened in SEC-2/SEC-3/SEC-4 but a full cross-tenant
read audit has not been run. A malicious tenant_admin should not be able to read another
tenant's subcollections.

- Run `firebase emulators:start` + cross-tenant read probes for every subcollection
- Pay special attention to: campaigns, leaderboard, notifications, settlements
- Document results in `docs/SEC-9b-audit.md` and patch any failures

---

---

## Login screen logo

**Scope:** The LoginScreen (`src/components/auth/LoginScreen.jsx`) uses a text-based
"AgencyTrack" wordmark. A Tatil Life logo asset needs to be placed here before the pilot demo.

- Obtain the Tatil Life logo SVG/PNG from Kyron
- Place at `public/tatil-logo.svg` (or similar)
- Swap the text wordmark in LoginScreen with the `<img>` tag (or inline SVG)
- Test in both light and dark mode

---

---

## Defaults-warn banner positive-render test (LOW, surfaced 2026-05-08 during C3 extended verification)

**Scope:** `BulkImportGoalsModal.jsx` renders a yellow `<Info>` banner when `usingDefaultMinimums(preflight.minimums)` returns `true` — i.e. when the `companyMinimums` doc is missing `updatedBy`/`updatedAt` fields (heuristic: doc was never explicitly set by an admin, so defaults are in use). The extended C3 verification confirmed the banner does NOT render for the pilot tenant (tatillife_south's `companyMinimums` was set 2026-04-30 and has both fields). The positive-render path (banner shown when minimums are unset) was not exercised in production because the doc already exists.

**Fix:** Add a verification step or unit test (once Vitest lands from the Test Infrastructure MEDIUM item) that exercises `usingDefaultMinimums` with and without `updatedBy`/`updatedAt` fields, and optionally a smoke test that briefly deletes or replaces the `companyMinimums` doc to exercise the banner in staging. Until Vitest lands, the logic is simple enough to reason about directly from source.

Priority: **LOW**. The logic is a one-line helper (`!minimums?.updatedBy && !minimums?.updatedAt`); no known bug. This is a coverage gap, not a defect.

---

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

---

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

---

## SCOPE-1 — Tenant-wide persistency aggregate helper (MEDIUM, post-pilot)

**Scope:** `getPersistencyMapForYear` in `persistencyService.js` is branch-scoped (`opts.branchId` filter), which is correct for `branch_manager` Firestore rules. Future dashboard surfaces for `sales_manager` and `tenant_admin` roles need a separate tenant-wide helper (e.g. `getPersistencyMapForTenant`) that those roles' `allow get` conditions permit. Adding a new helper rather than extending `opts` keeps the access-control intent explicit.

Not pilot-blocking — those dashboards don't exist yet.

Priority: **MEDIUM**. Post-pilot. Bank for the `sales_manager` dashboard surface (P9).

---

---

## SCOPE-2 — Tighten persistency `allow list` rule (MEDIUM, post-pilot)

**Scope:** PR #83 added `allow list: if isSignedIn() && getTenantId() == tenantId` — intentionally permissive within tenant scope because Firestore cannot evaluate `resource.data` for list operations (per the inline rules comment). Future hardening: require client queries to include scope filters (`where('branchId','==',callerBranchId)` etc.) and validate via `request.query` in rules. Requires denormalizing `branchId` and `unitId` onto persistency docs (currently absent). Acceptable for the current single-branch pilot.

Coupled to PERF-1 (same denormalization needed).

Priority: **MEDIUM**. Post-pilot. Do not attempt without the doc-denormalization step.

---

---

## PERF-1 — `getAvailableMonths` tenant-wide unfiltered query (LOW, post-pilot)

**Scope:** `getAvailableMonths` in `persistencyService.js` for non-agent scopes issues an unfiltered `query(persistencyCollection())` against the full tenant collection. Fine for the pilot (one branch, hundreds of docs at most). As tenants grow into thousands of monthly docs, add a `where`-by-scope filter. Coupled to SCOPE-2 (requires `branchId`/`unitId` denormalized onto persistency docs before a scope filter is possible).

Priority: **LOW**. No urgency at pilot scale.

---

---

## TEST-N — Build Firebase rules-testing harness (MEDIUM, post-pilot)

**Scope:** `@firebase/rules-unit-testing` is in `devDependencies` but no test runner, environment setup, or emulator port config exists. PR #83's emulator-test step was skipped because of this gap. PR #85's `allow get` fix (non-existent-doc regression) would have been caught by automated rules tests before merging rather than discovered in production via the write-read-verify smoke. Future rules changes — especially to the persistency block, which has non-trivial role + null-resource combinations — should have coverage.

**Minimum viable harness:** configure `@firebase/rules-unit-testing` against a local emulator (port 8080), wire into a `test:rules` npm script separate from Vitest unit tests. First test suite: persistency `allow get` — covers null resource (non-existent doc) for agent / branch_manager / unit_manager; existing doc per role; cross-tenant denial.

Priority: **MEDIUM**. Ideally pre-pilot. Not blocking, but the next rules change without this is flying blind.

---

---

## WALK-2 — Agent self-write path coverage for persistency walks (LOW, post-pilot)

**Scope:** The persistency lock-by-manager mechanism (`PersistencyTab.jsx:77-79`, `lockedByManager` flag) makes the agent self-write path unreachable for the canonical test agent (`kelsean@gmail.com`) once a manager doc exists for the current month — which it does, persistently, after PR #94 and PR #95 smokes. The WALK-1 `e3-persistency-walk.mjs` cycle covers the manager-write + agent-read path (checks 09b/09c/11b), which exercises the full rules + claims + indexes chain. The agent self-write path is currently uncovered by automation.

**Future work:** Provision a dedicated smoke-only test agent (e.g. `smoke-agent-1@agencytrack-test.dev`) reserved for write-path verification, never written to via the manager path. Alternative: Admin-SDK-backed pre-cycle state reset.

Pilot-launch acceptable; real pilot agents exercise the agent self-write path daily, surfacing any regressions through actual use.

Priority: **LOW**. Post-pilot.

---

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

---

## Cross-branch test fixture: A11Y_BRANCH_MANAGER_2 (LOW, banked PR #266)

**Scope:** A second branch manager account in a DIFFERENT branch from `A11Y_BRANCH_MANAGER` (currently `tatil_south`), plus a unit manager seeded in that second branch. Needed so cross-branch / forgery rule negatives can be live-smoked against the Vercel preview.

**Why:** `managerActivityStandardOverrides` rule KEY FORGERY DENY (case 11: BM2 forging branchId for UM in another branch → DENY) and I1.3b cross-branch list DENY are currently only verified in the emulator. The live smoke uses `A11Y_BRANCH_MANAGER` + `A11Y_UNIT_MANAGER`, both in `tatil_south` — no cross-branch leg can run. A second fixture eliminates this gap.

**Also needed for:** I3 accountability flag (cross-branch denial), tenant-isolation smoke walks, future Track I PRs with cross-branch rules.

**Fix shape:** Provision `A11Y_BRANCH_MANAGER_2_EMAIL` / `A11Y_BRANCH_MANAGER_2_PASSWORD` accounts against a second branch in the `tatillife_south` Firebase project (create a second branch doc first if needed). Seed one UM account under that branch. Document both keys in `.env.example` (Rule 14). Update individual smoke scripts that need cross-branch legs to read the branch-2 credentials.

Priority: **LOW**. Not pilot-blocking; live cross-branch verification is nice-to-have on top of emulator coverage.

---

---

## `managerActivityStandardOverrides` update arm: pin managerId/tenantId immutable (LOW, banked PR #266)

**Scope:** The `allow update` arm in `firestore.rules` for `managerActivityStandardOverrides` does not currently assert that `request.resource.data.managerId` and `request.resource.data.tenantId` are unchanged from the existing doc. The `create` arm pins both fields explicitly (`request.resource.data.managerId == managerId` + `request.resource.data.tenantId == tenantId`). The document path `/{managerId}` is authoritative (document ID = managerId), so this is NOT a security hole — any forged managerId/tenantId in an update payload cannot affect rule scope or permission evaluation. But it is a hygiene gap: a client could silently overwrite those fields on update without the rule objecting.

**Fix shape:** Add `request.resource.data.managerId == resource.data.managerId && request.resource.data.tenantId == resource.data.tenantId` to the `allow update: if ...` predicate alongside `uplineInScope()`. One-line addition to `firestore.rules`.

**Why LOW and not a security hole:** The document ID (`managerId` in the path) is the authoritative scope key for all reads and permission checks. A forged `managerId` field value in the doc body cannot affect rule evaluation. The path is immutable by Firestore design. This is hygiene-only hardening.

Priority: **LOW**. Hygiene; no security impact. Bundle into the next PR that touches `firestore.rules` for any reason rather than opening a standalone PR.

---

---

## Track H — isBdoDso / monthsInIndustry / monthsAtTatil — no UI write path (LOW, banked H1 PR #300)

`isBdoDso: boolean`, `monthsInIndustry`, and `monthsAtTatil` fields on user docs are read by the awards engine (`awardsEngine.js`) and tenure-floor logic (`tenureFloors.js`) but are not settable via any UI screen. The only current write path is direct Firestore via Admin SDK.

- **`isBdoDso`** — read at `awardsEngine.js` (`profile.isBdoDso`). Must be `true` for BDO/DSO agents to receive the correct tier. Currently writable only via Firestore Console by a Tenant Admin.
- **`monthsInIndustry`** / **`monthsAtTatil`** — read by `resolveWeeklyAPIFloor` in `tenureFloors.js`. Populated at user creation only; no in-app edit path.

**Fix shape:** Wire all three fields into the PR-4b Edit User UI (`UserManagementPanel` edit form already handles role + branch + unit). Guard `monthsInIndustry`/`monthsAtTatil` to Tenant Admin + Platform Admin write only. `isBdoDso` may be managed by Branch Manager upward.

**Priority:** LOW. Awards engine reads correctly for agents whose profile has these set. Surfaced when closing PH7-8-Q5 during Track H H1 Phase 1 verify.

Banked from H1 PR #300 (Track H H1, 2026-05-24).

---

---

## Track H — orphan `jointCalls` CG index reconciliation (LOW, banked H1 PR #300)

**Scope:** `jointCalls` COLLECTION_GROUP index `authorUid + appointmentDate` (index ID `CICAgJiH2JAK`) is live in agencytrack-2a610 but NOT declared in `firestore.indexes.json`; superseded by the 3-field `authorUid + tenantId + appointmentDate` composite.

**Action:** Grep for any `jointCalls` collection-group query filtering `authorUid + appointmentDate` WITHOUT `tenantId` — if dead, delete deliberately via `firebase deploy --only firestore:indexes --force` (after confirming no other orphan would be swept in the same run); if still used, re-declare it in `firestore.indexes.json` to stop the drift.

**Priority:** LOW. No production query references the 2-field form today; the 3-field composite supersedes it. Resolve before any future `firestore:indexes` deploy to avoid deploying with undeclared live state.

Surfaced during H1 #300 Phase 6a deploy.

---

---

## Track J (V2 Redesign) — Shell brand subline requires new data-fetch (LOW, banked 2026-05-30, PR #388)

The `design_handoff_v2_app/mockups/app-shell.jsx` `Sidebar` shows a tenant/branch subline below the "AgencyTrack" brand name (e.g. "Tatil Life · South"). The brief allowed this only if sourced from existing `useAuth()` context without a new data-fetch path.

**What's available now:** `useAuth()` exposes `tenantId` (e.g. `"tatillife_south"`) and `userProfile` (name, role, unitId, photoURL). Neither exposes a human-readable `tenantName` or `branchName`.

**Blocked path:** `tenantName` lives in a potential `/tenants/{tenantId}/config/settings` doc or a separate tenant registry — there is no pre-loaded context for it in `AuthContext`. Adding it would require either: (a) extending `AuthContext` to load a tenant doc on login, or (b) a new one-shot Firestore read in Sidebar.

**Fix shape:** Add `tenantName` (and optionally `branchName`) to `AuthContext`'s resolved value, loaded from `config/settings` or a top-level `tenants/{tenantId}` doc immediately after the user profile resolves. Pass `tenantName` through Shell → Sidebar props. The brand subline renders as `{tenantName}` (or `{tenantName} · {branchName}` if branch available).

**Priority:** LOW. The subline is a polish detail; the Shell is fully functional without it. Revisit before the Track J smoke or when `AuthContext` is next touched.

Banked: Track J App Shell (redesign/shell PR #388 (`63cb0cf`)), 2026-05-30.

---

---

## Track J (V2 Redesign) — `surfaceSoft` token revisit across V2 screens (LOW, banked 2026-05-30, PR #388)

The mockup `app-tokens.jsx` defines `surfaceSoft: '#F4F2EC'` (light) / `'#1F1B17'` (dark) as a mid-level surface between `surface-raised` (#FAFAF8) and `surface-muted` (#F0EFE9). Used in the App Shell for the topbar search box background and the RoleSwitcher prototype scaffolding.

**Decision for this PR:** reuse `--color-surface-muted` as the closest existing token (brief §2 explicit decision — "no new token").

**When to revisit:** If `surfaceSoft` appears as a background in ≥3 distinct V2 screens (outside the prototype RoleSwitcher) and `surface-muted` reads visually wrong in context, introduce `--color-surface-soft` in both `:root` and `.dark` in `src/index.css` + a matching Tailwind utility in `tailwind.config.js`. Cap at one new token; do not mint per-screen values.

**Priority:** LOW. One token gap in one element (search box). Verify whether later V2 screens also use `surfaceSoft` widely before promoting.

Banked: Track J App Shell (redesign/shell PR #388 (`63cb0cf`)), 2026-05-30.

---

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

---

## Track J (V2 Redesign) — Game Plan v2 — remaining slices (MEDIUM, banked 2026-06-03, PR #438)

Game Plan v2 **Slice 1** (PR #438) shipped the shell + Money Needs re-home. The remaining slices each introduce **net-new data** (a new store, read, write, or user attribute) and were deliberately deferred — none is a port:

- **Year Plan (allocator):** product-line split, percent/direct mode, add-line, award-eligibility calc, license-profile tabs. **Slice 1 (data foundation) SHIPPED — PR #571:** `yearPlan/{year}` subcollection + `yearPlanService.js` (`createYearPlan` / `getYearPlan` / `resolveLicenseProfile` / `LICENSE_PROFILES`) + Firestore owner-only rules + `licenseProfile` user-allowlist edit; 19 unit tests + 23 emulator rules tests. Full scoping: [`docs/design/year-plan-scoping-notes.md`](../design/year-plan-scoping-notes.md). Manager-read arm + profile-to-line gating + first prod smoke → Slice 2 (see below).
- **License-profile user attribute:** Composite / Life-only / General-only. **SHIPPED in Year Plan data-foundation (PR #571):** `licenseProfile` appended to user self-update `hasOnly` allowlist in `firestore.rules`; `resolveLicenseProfile(userDoc)` in `yearPlanService.js` returns `'composite'` default for absent/invalid values; `LICENSE_PROFILES` const exported. Profile-to-line gating (tab visibility per license type) deferred to Slice 2.
- **Monthly Plan:** 12-month target-vs-actual chart, the monthly **target store** (plan) + **actual-by-month read** (production), variance + "to finish the month" suggestions. → new store + read.
- **Review & Commit → Goals write:** the loop-close — writes personal API/apps into the 3-tier Goals system. The status pill goes live (draft → committed) only here. → new write.
- **Manager review / suggest workflow:** the share-with-manager affordance (the NEW one — distinct from Money Needs' existing visibility toggle, which Slice 1 preserved), manager read of the shared plan, suggest-a-change + notify, plan-health banner. → new workflow.
- **Commission Playground fold:** folding the Playground ratio engine behind Year Plan cases / retiring the standalone tab. Untouched in Slice 1 — reconcile later.
- **Weekly/daily activity planner (Path B) — CONFIRMED derived + tracked, intended next slice:** surface the personal weekly activity derived from the plan (the Commission Playground decomposition: income → API → apps → CIs → dials → prospects, weekly/daily), **plus** set-plan / log-actual / variance / manager roll-up. Net-new store + write surface + manager roll-up. **High priority — likely the next slice after Slice 1** (possibly ahead of Year Plan; final ordering set when scoped). Distinct from the company-floor weekly minimums in `WeeklyStandardCard`.

**Priority:** MEDIUM. Slice 1 is functional and honest on its own. Slices ship one brief + PR each.

**Year Plan data foundation — deferred to Slice 2:**
- **Manager-override arm:** upline `canManage` read of an agent's `yearPlan/{year}` doc. Deferred — no manager-UI surface yet.
- **Profile → line gating + A&H license-domain confirm:** `life_only` → Life + A&H tabs only; `general_only` → Property + Motor + A&H tabs only. A&H license-domain (life vs. general) needs a product decision before encoding. Deferred to Slice 2.
- **First production write-read-verify smoke:** Slice 1 is headless (no UI path) — smoke runs when the agent-UI surface ships in Slice 2.

Banked: Game Plan v2 Slice 1 (PR #438), 2026-06-03. Year Plan data foundation Slice 1 of 3 (PR #571, `c3947ad`), 2026-06-11. Slice 2b design resolved 2026-06-13 (dispatcher ruling): award strip projects off `lines.life.targetAPI`; Part B = licenseProfile dropdown in EditUserDrawer.

---

---

## awardsEngine.js per-line filter gap (LOW, banked 2026-06-13, Slice 2b design)

**Context:** `awardsEngine.js` computes award eligibility from confirmed settlements using `totalEnabledAPI` — a sum across all product lines. It has no per-line filter.

**Gap:** In a multi-line world where only Life submissions count toward annual awards, the engine would over-count API (crediting A&H / Property / Motor alongside Life). This is moot for the Life-only Tatil pilot (only Life is submittable, so `totalEnabledAPI` equals Life API in practice).

**Year Plan strip alignment:** The `AwardProjectionStrip` (Slice 2b) uses `lines.life.targetAPI` (Life line only) as its projection input — this is honest for the pilot. The strip and engine are intentionally divergent; reconciling them requires a product decision on non-Life submittability.

**Action when non-Life becomes submittable:**
1. Add a `lineWeights` or `lineEligibility` map to the ruleset (e.g. `{ life: 1, health: 0, property: 0, motor: 0 }`)
2. Filter `subValues` in `awardsEngine.js` to sum only lines with `weight > 0`
3. Update `AwardProjectionStrip` to use the same filter (or pass the weighted sum directly)
4. Update existing engine tests

Do NOT modify `awardsEngine.js` in Slice 2b — the pilot is Life-only and the engine is correct for current data.

Banked: 2026-06-13, Slice 2b design resolution (dispatcher ruling).

---

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

---

## Track J (V2 Redesign) — HeroCard YoY-delta chip deferred (LOW, banked 2026-05-30, PR #393)

The v2 HeroCard mockup (`design_handoff_v2_app/mockups/app-dashboard-v2.jsx`) shows a "+18% vs LY" success chip next to the YTD API headline. The J-AD-home PR (PR #393) ships the HeroCard **without** this chip — current AgentDashboard state does not aggregate last-year submissions, and `getAgentSubmissions(tenantId, uid)` returns all submissions without a year filter, so any YoY computation today would walk the full result set in JS each render.

**Restore path:** Either (a) compute `lastYearTotals` in the same `useMemo` as `ytdTotals`, walking `allSubmissions` once and partitioning by year (cheapest — no new query); (b) add a dedicated `getLastYearSummary(tenantId, uid, year-1)` Cloud Function aggregator if performance becomes a concern. Render the chip with `text-success` and `↗` icon when YoY delta is positive, `text-danger` and `↘` when negative; hide when last-year data is empty.

**Priority:** LOW. The hero already shows YTD + progress + goal — the YoY chip is decorative motivation, not load-bearing. Address when polish bandwidth opens or alongside Phase 9 SM-target work.

Banked: Track J v2 Agent Dashboard home rework (PR #393), 2026-05-30.

---

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

---

## Track J (V2 Redesign) — Wire BranchManagerProductionView ranked table + standalone Leaderboard podium to the leaderboards aggregate (MEDIUM, banked 2026-05-31, carved out of PR #397 FU on P7 close)

P7 (PR #403) wired AgentProductionView's rank pill + around-me panel to the existing P1 `leaderboards/{branchId}` aggregate via `useLeaderboard`. Two adjacent surfaces still consume legacy data paths and should converge on the same source-of-truth:

1. **`BranchManagerProductionView` ranked table** — currently aggregates client-side via `getAllYTDSubmissions`-style logic. The aggregate already has the full per-branch ranking in rank order.
2. **Standalone Leaderboard podium / RankedLeaderboard surface** — PR #396 pre-claimed the file for an aggregate-driven rewrite, but the podium needs apps + %-of-leader bar shape that the aggregate doesn't yet carry.

**Shape:** Two sub-tasks. (a) Wire `BranchManagerProductionView` to `useLeaderboard` — pure consumer change, no aggregate field additions needed (the existing `name + unitName + periodApi + apps + rank + rankWithinUnit` shape covers the table). (b) For the Leaderboard podium / RankedLeaderboard, decide whether to extend the aggregate's entry shape (add `apps` if not already present, add `leaderApi` per period for the %-bar) or compute %-of-leader client-side from the entries' `periodApi`. The client-side option avoids touching the CF; only the aggregate read-shape contract changes.

**Priority:** MEDIUM. Resolves dual-source-of-truth between AgentProductionView (aggregate) and these two views (still legacy). Schedule when the V2 manager production view + leaderboard podium next come up.

Banked: 2026-05-31 (Track J P7 close, PR #403). Carved out from the resolved PR #397 around-me FU above.

---

---

## Track J (V2 Redesign) — AgentProductionView floor bar uses hardcoded default tenure bands; does not read tenant tenureApiFloors config (LOW, banked 2026-05-31, PR #397)

The YTD-vs-tenure-floor bar in `AgentProductionView` calls `resolveAnnualAPIFloor({ contractStartDate: userProfile?.contractStartDate })` with no `tenureApiFloors` argument. This uses `DEFAULT_TENURE_API_FLOORS` (150K/200K/250K/300K/400K/500K — board-confirmed, Tatil head-of-sales 2026-05-21). The tenant-admin can edit these bands via the `config/companyMinimums.tenureApiFloors` document (seeded via `seed-tenure-api-floors.mjs`), but `AgentProductionView` never reads that document, so any future tenant-admin edits are silently ignored.

**Fix shape:** Add a `getCompanyMinimums(tenantId)` call (already in `src/services/goalsService.js`) to fetch `tenureApiFloors` from Firestore; pass the result as the second argument to `resolveAnnualAPIFloor`. The call can be a one-shot `useEffect` independent of the submission fetch; the bar renders the default until resolved (no loading state needed — same pattern as the persistency effect).

**Priority:** LOW. The default bands are currently correct for Tatil; the risk materialises only if a tenant-admin updates the config. Address when the tenant-admin config editor or a band-change is actioned.

Banked: Track J AgentProductionView v2 port (PR #397), 2026-05-31.

---

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

---

## Track J (V2 Redesign) — P1b leaderboard CF: multi-tenant iteration (LOW, banked 2026-05-31, PR #400)

`functions/leaderboard/leaderboardAggregate.js` has `const TENANT_ID = 'tatillife_south'` hardcoded, mirroring the existing SEC-9c pattern (`sendSundayNudge`, `sendMondayNudge`, `flagMissedDeadlines`). The scheduled trigger recomputes leaderboards for that one tenant only.

**Fix shape:** When SEC-9c is addressed at the scheduled-CF layer (multi-tenant scheduled-function isolation), iterate all tenants in `tenants/` and call `computeAndWriteLeaderboards(tid)` per tenant. The on-demand callable already supports `data.tenantId` for `platform_admin`.

**Priority:** LOW. Single-tenant Tatil pilot is the only deployment.

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31.

---

---

## Track J (V2 Redesign) — P1b leaderboard CF: on-write trigger optimization (LOW, banked 2026-05-31, PR #400)

P1b uses a scheduled hourly recompute + admin-only on-demand callable. The doc is stale up to ~1 hour after a new submission. An onWrite trigger on `tenants/{tid}/submissions/{subId}` could recompute only the affected branch's leaderboard immediately (model `recomputeJfwCount`).

**Fix shape:** Add `onSubmissionWrite` trigger reading `change.after.data().agentId`, look up the agent's `branchId`, recompute that single branch's leaderboard. Loop-guard via comparing rank arrays or via a "skip if last write was self" sentinel.

**Trade-offs:** (a) freshness improves from 1h to seconds; (b) onWrite fires on every status update + draft save — needs gating on `before.status !== 'submitted' && after.status === 'submitted'` to avoid duplicate work (mirror the `onWarSubmitNotifyUpline` pattern); (c) cost increases linearly with submission volume (50 agents × 1 weekly submission ≈ 50 extra CF invocations/week — negligible).

**Priority:** LOW. The hourly scheduled trigger meets the "feels fresh" bar for an agent dashboard surface. Add when product needs sub-minute freshness (e.g. real-time leaderboard during a sales contest).

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31.

---

---

## Track J (V2 Redesign) — P1b leaderboard CF: reconciled-production swap point (FU-2 reference, banked 2026-05-31, PR #400)

The FU-2 reference (originally banked in PR #398 description): when `usesPolicyLedger` H3 flip-gate clears branch-wide and reconciled-production data is available for all agents, the leaderboard CF is the **single swap point** for the entire Leaderboard / Production Report family. Replace `loadInputs` in `functions/leaderboard/leaderboardAggregate.js` with a reconciled-source fetch; the rest of the pipeline (groupByBranch, rankForLeaderboard, agent-readable doc shape) is unchanged. All consumers (P3 podium, P4 around-me, P7 AgentProductionView, BM/UM ProductionViews, kiosk) inherit the switch via the aggregate doc.

**Prerequisite:** Branch-wide `usesPolicyLedger` (not per-agent opt-in).

**Priority:** MEDIUM (inherits from FU-2). Schedule when H3 flip-gate scope is confirmed.

Banked: Track J P1b leaderboard-aggregate CF (PR #400), 2026-05-31. Cross-reference: FU-2 (PR #398 description; re-anchored on P1a + P1b).

---

---

## Track J (V2 Redesign) — P3 Production Leaderboard: converge the kiosk medal onto ui/MedalCoin (LOW, banked 2026-05-31, PR #401)

P3 introduces `src/components/ui/MedalCoin.jsx` as a parameterized primitive (rank + size + glow) backed by the existing `--color-medal-{1,2,3}-*` CSS vars. The kiosk's existing medal renders use the `.medal-N` CSS classes (also from `--color-medal-*` vars), so the gradients are already in lockstep at the token level — but the **kiosk renders its own DOM** (in `kiosk/panels/TVRankedLeaderboard.jsx` and adjacent), not the shared primitive.

**Fix shape:** Refactor the kiosk's medal renders to import `ui/MedalCoin` with size tuned to the kiosk scale (e.g. `size={56}`). Visual parity is guaranteed (same CSS vars). No token change. Reduces duplication and means future medal-coin tweaks (e.g. extra-large hero variant, different glow recipe) propagate to both surfaces.

**Priority:** LOW. Both surfaces already use the same tokens so they cannot drift; convergence is a maintenance simplification, not a correctness fix. Schedule when next visiting the kiosk surfaces.

Banked: Track J P3 production leaderboard surface (PR #401), 2026-05-31.

---

---

## `CompliancePanel.nudge.test.jsx` timing flap — stabilize with proper async waits (**RE-OPENED — stabilization INCOMPLETE**)

**Scope:** `src/components/manager/__tests__/CompliancePanel.nudge.test.jsx` — 6 tests covering the S2 nudge-send + cooldown-chip interactions.

**History:**
- PR #502 (`d936c69`, 2026-06-05): wrapped all 7 `fireEvent.click()` sites in `await act(async () => { ... })`. 20× consecutive isolated green + 2426/2426 full suite ×2. Merged GREEN-CHANNEL as test-only stabilization.
- **4th occurrence — 2026-06-06 (CI run on PR #510 / run `27063421668`).** `Unable to find [data-testid="compliance-cooldown-chip"]`. Local 20× consecutive: clean. CI-environment timing differs — the `await act()` wrap is insufficient under constrained CI workers.

**Status: INCOMPLETE — RE-OPENED.** Local 20× green but CI-environment timing differs; next attempt must reproduce under CI conditions (`CI=true`, constrained workers) before fixing.

**Observed behavior (five occurrences):**
1. During the settlements security dispatch full-suite run — 1 failure, isolated re-run clean.
2. During the commission-v2-s2 dispatch full-suite run — 1 failure, isolated re-run clean.
3. During the commission-v2-s3 dispatch full-suite run — 1 failure (2425/2426), isolated re-run and second full-suite re-run both clean (2426/2426).
4. **CI run `27063421668` (post-#510 push, 2026-06-06).** First run fail; re-run (`gh run rerun --failed`) passed. Pattern: flapped on CI after PR #502 supposedly fixed it.
5. **CI run `27094401256` (PR #538, 2026-06-07).** Config-only diff (`.graphifyignore` + `graphify-out/` only — zero `src/` changes). Confirms the flake is fully environmental, not triggered by any source edit.

All five: fails in a parallel full-suite context (`npx vitest run` or CI constrained workers), passes in isolation. The `await act()` boundary is insufficient — test still races CI environment's higher contention.

**Fix shape (revised):** The previous fix (act-wrapping clicks) was insufficient. Next attempt must run the full suite under `CI=true` + constrained workers locally to reproduce the failure, then apply explicit `waitFor(() => expect(screen.getByTestId(...)).toBeInTheDocument())` assertions after every async state change. Reproducing under CI conditions first is mandatory — blind act-wrapping already failed once.

**Priority: MEDIUM.** Five occurrences; passes on re-run so it's an intermittent investigation cost, not a hard blocker. Dispatch when reproduction path under CI conditions is clear.

Banked: commission-v2-s2 dispatch, 2026-06-05. Re-opened: post-merge fill for PR #509 + PR #510, 2026-06-06 (4th CI occurrence). 5th occurrence: PR #538, 2026-06-07 (config-only diff, unrelated).

---

---

## `DailyEntryModal.test.jsx` timer flap — first strike, watch (LOW/TEST-STABILITY, banked 2026-06-05)

**Scope:** `src/components/dashboard/__tests__/DailyEntryModal.test.jsx` — `save calls onClose after 600ms` test.

**Observed behavior:** one-off CI timer failure during PR #498 `lint-and-build` run on 2026-06-05. Passed locally (14/14) and passed on `gh run rerun`; isolated re-run was clean. Pattern: likely timer-sensitive test relying on real 600ms delay that flaps under CI parallel contention.

**Status:** FIRST STRIKE. Per two-strike rule: FU at second flap; no action required now.

**Fix shape (if second strike):** add `vi.useFakeTimers()` + `vi.advanceTimersByTime(600)` to avoid real-timer dependency, or wrap assertion in explicit `waitFor`.

**Priority:** LOW. Watch only.

Banked: PR #498 post-merge fill, 2026-06-05.

---

---

## Track J (V2 Redesign) — App-wide `text-gold` + adjacent contrast pass (MEDIUM/DESIGN, banked 2026-05-31, PR #401; expanded 2026-05-31 on PR #403)

**✅ CLOSED 2026-06-04 (PR #487 `b10a380` — contrast-debt retirement, Option B).** The entire documented contrast-debt family is retired app-wide. Per-family resolution: **(1) StatusPill on-tint danger/warning/success + the exception count badge** → new `--color-{status}-ink` deep tokens (deterministic AA math in `src/utils/contrast.js`, **63 unit tests** ≥4.5 on every surface/tint, both themes); StatusPill primitive + all ad-hoc on-tint chips adopt `text-{status}-ink` (**288 conversions, 83 files**). **(2) text-ink-faint** (56 TEXT usages — regenerated, was ~49) → `text-ink-muted` en masse; non-text `bg-ink-faint` decorative ticks retained. **(3) primary-light text** (the #465 leftover, 2 GroupHeaders) → `--color-primary` (4.16→6.46 light). **(4) DataSourceBadge `text-warning` + AgentProductionView hero + every other on-tint chip** → swept by the same provable rule. The 3 compliance-smoke axe allowlists shrunk **5→1** (bell badge); all 3 PASS + targeted axe clean on Goals/Campaign/Persistency. **Sole residual:** the notification-bell badge (white-on-solid-danger, fails dark only) — a different white-on-solid family, kept as the lone allowlist entry. **Successor FU (NEW, was out-of-scope):** `NotificationDrawer` AA — `text-ink-muted/50` opacity-muted timestamps + a `text-primary`-on-bg button fail AA (pre-existing, verified on main) — a **muted-opacity / primary-contrast** family distinct from the now-retired status-ink/faint debt. (The button half of that successor note is now banked as its own DESIGN-DECISION FU above; the timestamp half is the Item-6b one-liner.) **Verification provenance (addendum):** the planned live BulkImport check was **substituted by the 63-test `src/utils/contrast.js` unit proof** as the AA evidence for the swept on-tint surfaces. Historical detail retained below.

**Status (2026-06-04): text-gold part RESOLVED (item 10 audit → item 20 fix, PR #465 squash `92d558f`); adjacent non-gold items REMAIN OPEN.** The light-mode `--color-gold` was darkened 176,125,26 (#B07D1A) → 138,96,17 (#8a6011) — AA-compliant on white (5.58), cream (5.16), gold-tint (5.06); dark gold unchanged. Token-level, so every `text-gold` consumer is fixed in one go. **axe-delta note (prod awards smoke, item 18 harness):** the awards-surface color-contrast node count was UNCHANGED post-fix (agent light 50 / dark 36 / BM light 22 / dark 18) — because axe never flagged the gold nodes (it applied the large-text 3:1 threshold, which even the old #B07D1A passed). The fix's value is the deterministic small-text AA improvement, not an axe-node reduction. The 50 light-theme nodes are 49× `#a8a39c` text-ink-faint + 1× `#018a91` primary-light — the SEPARATE faint→muted debt + the per-callsite teal items below, NOT gold. **Still open under this FU:** (a) DataSourceBadge `text-warning` on `bg-warning/15` light; (b) AgentProductionView hero avatar `bg-primary text-white` dark; (c) the `text-primary-light` eyebrow on cream (3.84). These are non-gold and untouched by item 20.

**Extension (2026-06-04, from Compliance v2 S1 PR #481): ALL THREE `StatusPill` text-on-tint variants.** Compliance v2 S1's surface-scoped axe surfaced the same shared-chrome family as #475's warning-on-tint chips: **`bg-*/15 text-*` pills fail AA — danger + warning in dark, and `StatusPill` danger marginal even in light (4.33 vs 4.5), AND `StatusPill` success fails in light too.** Concrete nodes observed: `StatusPill` **danger** `bg-danger/15 text-danger` (light 4.33 · dark 3.91); `StatusPill` **success** `bg-success/15 text-success` (light fail); `StatusPill` **warning** `bg-warning/15 text-warning` (dark, per #475); the exception-header count badge `bg-danger/10 text-danger` (dark 3.92); the dark `--color-danger` foreground (#d96b5d-class) on dark tints generally. Classified **existing-pattern (no S1 code change)** — `StatusPill` is shared chrome, NOT scope-forked per slice. **Fix at TOKEN level (accessible on-tint foreground pairings for danger + warning + success) in this dedicated contrast-debt slice, app-wide in one pass** — alongside the faint→muted (~49-node) + primary-light items above. Do not patch `StatusPill` per-callsite.

**Status (original):** Scoped as a dedicated future PR — dispatcher disposition 2026-05-31 on PR #401 pre-review was *"ACCEPTED as design-intent — do NOT darken gold in P3 (a one-off darkening would create a divergent second gold vs AgentAwardsPanel). The fix is an app-wide gold-contrast pass in its own PR."* Two adjacent pre-existing AA-fail nodes folded in on PR #403 pre-review (DataSourceBadge "Estimated" + AgentProductionView hero avatar) — same FU because they share the same "scheduled gold-contrast pass" cadence and benefit from the same token-level fix discipline.

---

### DataSourceBadge "Estimated" — `bg-warning/15 text-warning` light-mode contrast (added PR #403)

**Surface:** `src/components/productionReport/DataSourceBadge.jsx` — the small badge shown at the top of AgentProductionView ("Estimated" pill). Same pattern likely exists on any future "Estimated" / "Pending" tinted-badge usage; sweep `bg-warning/15` + `text-warning` callsites on pickup.

**Issue:** `text-warning` on `bg-warning/15` (15% warning tint over surface) in light theme fails AA. Pre-existing baseline before PR #403 (verified `git show main:src/components/productionReport/DataSourceBadge.jsx` matches the form that triggered the axe node on PR #403). Surfaced in PR #403 smoke; filtered as pre-existing with an explicit comment in `scripts/verification/agent-production-rank-smoke.mjs`.

**Recommended fix (when scheduled):** EITHER bump `--color-warning` darker on light, OR raise the tint opacity from `/15` to a value that yields ≥ 4.5:1, OR swap to a darker text-on-tint utility (`text-warning-dark` if added). Token-level preferred to keep all warning-tint badges consistent.

---

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

---

## `activityLedger` — two LOW residuals from v3 P0-B (banked 2026-07-31, PR #884 squash `ab9b3132`, on `staging`)

### 1. `pcBreakdown` filters the day's evidenced events twice — CodeRabbit's remedy was DECLINED, do not re-propose it

`pcBreakdown` calls `evidencedEventsOn(state, day)` to build its `blockById` map, and `attributeCalls` — which it calls one line earlier — already computed the same filter internally.

**CodeRabbit (PR #884, 14:09:20Z) proposed having `attributeCalls` return block *objects* instead of `blockId` strings. That remedy was DECLINED and should not be re-proposed in that form:** the `{ blocks: [{ blockId, insideIds }], adhocIds }` shape is explicitly dispatcher-ruled (ruling 6a), and per Rule 21 a recorded ruling outranks a bot suggestion. It was also declined on timing — re-shaping a module whose three property families had just been mutation-verified, minutes before merge, is the wrong trade.

**The observation is valid and in fact understated.** `weekTotals` calls `pcBreakdown` **twice per day** — once directly and once via `loggedFor` — so it is **4 day-filter passes per day, 28 per week**, not the 2 CodeRabbit counted.

**Shape-preserving fix if this is ever worth doing:** an internal (non-exported) helper that returns both the attribution and the matched block objects, with `attributeCalls` kept as a thin public projection to the ruled shape. Cost today is negligible (pure functions over in-memory arrays of tens of records); revisit only if Phase 2.1 renders the ledger on every keystroke.

### 2. `evidencedPct` rounds, so a COLUMN of percentages will not sum to 100 — scope check for Phase 2.1

`evidencedPct` uses `Math.round`, so per-row percentages are each individually correct but need not total 100 across rows. **Harmless for what the design authority actually shows** — a single "55% of this week is evidenced" figure. **Revisit only if Phase 2.1 renders a column of per-code percentages**, where the discrepancy becomes visible and reads as a bug. Options then: render one decimal, or largest-remainder apportionment. Do not change it pre-emptively — the current behaviour is correct for the current design.

---

## External code reviewer — Gemini sunset PASSED 2026-07-17; secondary-reviewer decision is NOW OPEN (PROMOTED MEDIUM → HIGH 2026-07-21, post-#864; originally banked 2026-06-04)

**PROMOTED to HIGH — next decision up, before the next backend-touching track (operator ruling 2026-07-21, PR #864 merge session).** The deadline passed: Gemini sunset 2026-07-17 and reviewer coverage is now genuinely thin. Evidence from Track K P1 (#864): CodeRabbit (free tier) **declined the final two commits with "Review rate limited"** — rate limits fire exactly when several commits land in one session, which is the normal working pattern. On #864 the unreviewed commits were harmless (label swap + banked a11y idiom); the same gap on a `firestore.rules` or Cloud Functions change is a different story. Settle this BEFORE the next rules/CF-touching track rather than after.

**Original body (context):** Gemini consumer code review (the external automated reviewer wired to PRs) sunset on 2026-07-17 per its own in-PR notice (surfaced on PR #465 review). Choose and wire a replacement external reviewer so the §6-style "external review triage" gate keeps a real second opinion:

**Candidates:**
- **GitHub Copilot code review** — native GitHub PR review, low setup.
- **CodeRabbit** — dedicated AI PR reviewer, richer inline comments.
- **Claude Code GitHub Action** — `@claude` PR review via the official action; keeps the reviewer in the same model family as the dispatcher.

**Action:** evaluate the three (setup cost, signal quality, cost), pick one, wire it to PRs against `main`, and update the §6 (amendment-v3) external-reviewer triage references from "Gemini" to the chosen reviewer. Note: external review was a NO-OP for most of the Track J overnight queue (Gemini posted on #465 but was silent on the other batch PRs) — whatever replaces it should be verified to actually post before relying on the §6 gate.

**Update (banked 2026-07-10, promotion session): CodeRabbit was chosen and is already wired** (`coderabbitai` app-login, no workflow file needed; confirmed posting both a reviews-channel and a summary-comment on PRs — see CLAUDE.md § Methodology Rule 21). **One week out from the 2026-07-17 sunset**, the remaining action is narrower than the original item: confirm CodeRabbit's coverage is solid on its own (not just as a Gemini backup) before Gemini goes fully silent, and do a final cleanup pass on any remaining "Gemini" references in briefs/CLAUDE.md once the sunset date passes.

**Update (2026-07-31, v3 P0-A/P0-B session): three consecutive PRs — this is a PATTERN, not incidents.** #882, #883 and #884 each hit "Review rate limited"; on **#884 it fired on 3 of 5 HEADs, including the final one**, so the merged SHA was never reviewed by either bot (Gemini is past sunset and posts a summary comment only). The rate limit fires precisely when several commits land in one session — i.e. the normal working pattern, and the pattern every dispatcher-ruling cycle produces. Interim mitigation, applied on all three PRs and to be applied on every PR until this is settled: **state the gap explicitly in the PR body — which HEADs were reviewed, which were not — and never let reviewer silence read as approval.** On #884 the unreviewed final delta was test + docs only (`activityLedger.js` byte-identical to the last reviewed HEAD), which is the mildest form; the same gap on a rules or Cloud Functions change is the scenario this entry was promoted to HIGH to prevent.

Banked: Track J morning task (2026-06-04), from the PR #465 Gemini sunset notice.

---

---

## Track J (V2 Redesign) — GamePlanV2 component test coverage: `PlanAnchorStrip` + `PlanCascade` (LOW, banked 2026-06-04 from item 23 coverage sweep)

**Status:** OPEN. Item 23 (coverage sweep) covered `HeroCard` (PR #461) — the dispatcher's "up to 3" budget reached one. The coverage proxy (no-test-file = zero coverage) flagged three uncovered shipped GamePlanV2/HomeV2 components: `HeroCard` (done #461), **`PlanAnchorStrip`** and **`PlanCascade`** (remain). Both are pure-ish presentational components in `src/components/dashboard/GamePlanV2/` with derivable display logic worth locking.

**Action (when scheduled):** one test-only PR per component (zero src changes; park any that prove untestable without src edits, per the item-23 pattern). `PlanAnchorStrip` — the income/commission anchor chips + the honest "— / Set in your plan" unset-state for `API Commitment` (never the company-floor fallback). `PlanCascade` — the live Money-Needs commission rung + the "Coming" rungs. Other uncovered GamePlanV2/HomeV2 components (`StepRail`, `CommitPreviewCard`, `DeliveryStripCard`, `MiniViz`, `NeedsActionBanner`, `PulseStrip`, `RecentCompact`, `StandardDetail`, `StandardRow`) are lower-value candidates for a broader sweep.

Banked: Track J item 23 (PR #461 / consolidated fill 2026-06-04).

---

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

---

---

## Gamification — badge eligibility thresholds machine-readable in config (banked 2026-06-10, LOW)

**Source:** Points single-source-of-truth + f2fAttempts scoring (PR #556). Out-of-scope finding.

**Problem:** Badge eligibility thresholds are inline magic numbers in `functions/index.js` (the `onSubmissionWrite` trigger), while the human-readable descriptions of those same thresholds live in `BADGE_DEFINITIONS` in `functions/lib/gamificationConfig.js`. The two can drift silently.

**Examples of current inline thresholds (rough locations):**
- `top_apps_week`: `apps >= 5` — description says "5+ applications in a single week"
- `big_week`: `api >= 20000` — description says "TTD 20,000+ API in a single week"
- `century_dials`: `dials >= 100` — description says "100+ dials in a single week"
- `mdrt_qualified`: `ytdApi >= 500000` — description says "YTD API ≥ TTD 500,000"
- `mdrt_pace`: `ytdApi >= 250000 && weekNum <= 26` — description says "YTD API ≥ TTD 250,000 by week 26"

**Desired end-state:** Move thresholds into `BADGE_DEFINITIONS` alongside `description`/`trigger`. Example shape:
```js
{ key: 'top_apps_week', ..., threshold: { field: 'appsSold', op: '>=', value: 5 } }
```
The awarding logic in `onSubmissionWrite` evaluates `threshold` at runtime; the panel (PR2) reads the same `threshold` to render the displayed trigger value. Drift becomes impossible.

**Action (before PR2 panel implementation):** Extend `BADGE_DEFINITIONS` with a `threshold` field. Update `onSubmissionWrite` badge section to evaluate `threshold` instead of inline comparisons. PR2's points panel then reads `threshold.value` directly from the config for display — no separate human label to maintain.

**Severity:** LOW (no user-visible bug today; relevant when PR2 builds the panel that displays badge trigger values).

---

---

## yearPlan rules — field=path cross-checks + licenseProfile/status value constraints (LOW, banked 2026-06-11, PR #571)

**Source:** Gemini review on PR #571 (year-plan data-foundation). Comments #1 + #2 from the disposition table — OUT-OF-SCOPE for Slice 1, deferred here.

**Problem:** The `yearPlan` Firestore rules (Slice 1) enforce path-level ownership (`request.auth.uid == uid`) but do not cross-check that the document's internal `uid` and `tenantId` *fields* match the path parameters. They also do not constrain `licenseProfile` or `status` to their valid value sets on create/update. Similarly, the general user self-update arm allows writing any string to `licenseProfile` without validating it against the three valid members.

**Desired end-state (fold into Slice 2 constraint maturation):**
- `yearPlan` create: add `request.resource.data.uid == uid && request.resource.data.tenantId == tenantId`
- `yearPlan` create: add `request.resource.data.licenseProfile in ['composite', 'life_only', 'general_only']`
- `yearPlan` update: add status-transition guard once `draft → committed` lifecycle is defined
- User self-update arm: add conditional `licenseProfile` value check (only when `licenseProfile` is in `affectedKeys()`)

**Action:** Address alongside the Slice-2 manager-read arm and `draft → committed` status lifecycle — the three are logically coupled (manager can only read committed plans; status transitions need validation). Do not patch piecemeal before Slice 2.

**Priority:** LOW. The service layer already clamps `licenseProfile` to valid values; a direct Rules bypass requires a crafted Firestore SDK call, not a UI exploit. Real risk surface is minimal until the UI ships in Slice 2.

Banked: yearPlan data-foundation PR #571, 2026-06-11.

---

---

## .mjs emulator rules tests — manual-only, not wired into CI (LOW, banked 2026-06-11, PR #571)

**Source:** PR #571 rules test authoring. `tests/rules/*.rules.test.mjs` files require a running Firebase emulator and are invoked manually (`node tests/rules/yearPlan.rules.test.mjs`). They are not part of `npm test` (Vitest) or the `functions-tests` CI job.

**Problem:** Any future `firestore.rules` change gets no automatic emulator-rules coverage from CI. A rules regression is only caught if the author remembers to run the emulator tests manually before pushing.

**Scope of gap:** Currently two rules test files exist — `moneyNeeds.rules.test.mjs` and `yearPlan.rules.test.mjs`. Both are manual-only. The `functions-tests` CI job runs Jest against Cloud Functions unit tests, not Firestore rules.

**Desired end-state:** Wire emulator rules tests into CI — either as a dedicated `rules-tests` job in `.github/workflows/ci.yml` (starts the emulator, runs all `tests/rules/*.mjs` files, tears down) or as a Vitest integration-test phase using `@firebase/rules-unit-testing` with emulator startup managed by a global setup file.

**Action:** Design and implement the CI job. Requires the emulator to be startable in a GitHub Actions runner (Firebase CLI is already a dev dependency; emulator start/stop can be scripted). Medium infra effort; LOW urgency while the rules test suite is small.

**Priority:** LOW. Manual coverage today is better than no coverage; risk grows as the rules surface expands.

Banked: yearPlan data-foundation PR #571, 2026-06-11.

---

## Desktop planner board — shift-click range select keys off mobile view state (banked 2026-07-24, Run A Tier 2 E1, LOW — UX polish)

The E1 desktop board (`PlannerDesktopBoard`, mounted at `lg`≥1024 by `AgentPlannerPanel`) reuses the existing Run-9 A5 selection model. `visibleSelectableIds` (the shift-click range order) is derived from the mobile `view` state (`today` / `week` / `followups`), which the desktop board does not drive — the board uses its own `desktopSpan`. Consequence at desktop: **per-card toggle select works**, but **shift-click *range* select** resolves against the mobile `view`'s order (default `today`), so a range across the board's multi-day columns won't select as expected. Single-select + bulk Move/Cancel are fully functional. Not a data-safety issue (no wrong writes — selection only). The A5 bulk smoke runs at 900×800 (mobile layer) where shift-range works.

**Fix shape:** derive `visibleSelectableIds` from the board's rendered columns when `isDesktop` (flatten the visible day columns' live appt ids in DOM order), mirroring the mobile derivation. Small, contained to `AgentPlannerPanel`.

**Priority:** LOW — power-user affordance, degrades gracefully to single-select.

Banked: Run A Tier 2 E1, 2026-07-24. Listed as a known limitation in the Tier 2 PR body.

---

## Desktop planner board — Arrow ←/→ view-cycling inert on the board (banked 2026-07-24, Run A Tier 2 E1, LOW — UX polish)

The Run-9 A2 keyboard shortcut `ArrowLeft` / `ArrowRight` cycles the mobile `view` (Today ↔ Week ↔ Follow-ups). At desktop the board renders from `desktopSpan` (Day / 3-day / Week / Follow-ups), not `view`, so ←/→ changes the (unrendered) `view` state and is **visually inert** on the board. The other A2 shortcuts work at desktop: `n` (book), `?` (shortcuts), `↑/↓` (rove board cards — the cards are inside `contentRef`), `e` (edit focused card), undo/redo.

**Fix shape:** when `isDesktop`, map ←/→ to cycle `desktopSpan` through `BOARD_SPANS` (+ Follow-ups) instead of `view`. Small, contained to the keydown handler in `AgentPlannerPanel`.

**Priority:** LOW — keyboard nicety; mouse/tap on the board toggle works, and ↑/↓/e/n all function.

Banked: Run A Tier 2 E1, 2026-07-24. Listed as a known limitation in the Tier 2 PR body.

---

## E4 cross-time prospect notes history (banked 2026-07-24, Run A Tier 2 E4, MEDIUM — feature completeness)

E4 shipped the notes thread + "notes travel with the prospect" at **THIS-WEEK scope** (Option-1 ruling, deploy-free): `prospectNoteHistory` (`src/components/planner/planner.helpers.js`) surfaces a prospect's prior notes from the **already-loaded** week's appointments. Notes from the prospect's **pre-this-week** appointments do not surface until this FU ships.

**To build:** a client query `where('agentId','==',uid) where('prospectId','==',pid)` over `tenants/{tid}/appointments`, aggregating `readNoteThread` across ALL of the agent's own appointments for that prospect (cross-time). Wire it into `AppointmentSheet`'s prospect-history section (merge with the this-week set, dedupe).

**Rules:** ALREADY PERMITTED — `allow list` arm #1 (`firestore.rules:1574-1576`, `resource.data.agentId == request.auth.uid`; owner field = `agentId`), recorded as D3 precondition evidence in `docs/audits/run-a-run-log.md`. **No rules edit needed.**

**Index (the gating cost):** requires a NEW composite index `(agentId ASC, prospectId ASC)` in `firestore.indexes.json` + a deploy (`firebase deploy --only firestore:indexes`) — a dispatcher/human action (Rule 19: CC never deploys). Build the client query to **graceful-degrade** (catch → empty, like `loadTemplates`) so the app never breaks if the index isn't live yet; the cross-time notes simply don't surface until the index deploys.

**Priority:** MEDIUM — the notes thread + this-week surfacing already deliver E4's core; cross-time is the completeness extension.

Banked: Run A Tier 2 E4, 2026-07-24.

---

## Staging smoke run-isolation — per-run unique IDs + finally-cleanup (banked 2026-07-24, Run A Tier 2, LOW — verification hygiene)

CodeRabbit (#866) flagged that the Run-A planner acceptance smokes (`smoke-e1-desktop-board.mjs`, `smoke-e3-running-late.mjs`, `smoke-e4-notes-thread.mjs`) create fixed-time sentinel appointments and rely on `seed-fixtures.mjs --apply` to reset residue, rather than generating a per-run unique identifier, scoping all write-read assertions to it, and removing mutations in a `finally` block even when verification fails.

**Current state (deliberate):** these follow the ESTABLISHED planner-smoke convention — the six Run-9 smokes (`smoke-run9-*.mjs`) all note "residue: … ; re-seed resets" and do not self-clean. Adopting run-isolation for only the three new smokes would make the planner-smoke suite inconsistent.

**To do (suite-wide, not per-smoke):** decide the convention for the mutating planner smokes — either (a) standardize on a per-run unique token + `finally` cleanup (the self-cleaning idiom the financing smokes already use), or (b) keep the re-seed-resets convention and document it as the standard. If (a), apply across all `smoke-run9-*` + the three Run-A smokes together.

**Priority:** LOW — the smokes are correct today (re-seed resets); this is consistency + fail-safe-cleanup hygiene.

Banked: Run A Tier 2, CodeRabbit #866, 2026-07-24.

---

## R-11 login-stamp + All Users LAST-activity — REQUIRES a firestore.rules edit (banked 2026-07-25, Run A Tier 3b, HIGH-ish / attended)

**STOPPED in Run A Tier 3b — not buildable client-side as ruled.** The R-11 ruling assumed a client-side own-doc write on auth; the rules surface forbids it.

**Evidence — the users self-write arm uses `hasOnly([...])`, an EXHAUSTIVE allowlist** (contrast the `appointments` block's coarse `hasAll` floor, which is why E4's `notes[]` needed no rules change):

| Self-write arm (`request.auth.uid == userId`) | Allowed keys |
|---|---|
| general | `hasSeenWelcome, photoURL, bio, phone, loggingMode, dailyNudgeTime, updatedAt, email, licenseProfile` |
| `unit_manager` | `unitName, hasSeenWelcome, photoURL, bio, phone, loggingMode, dailyNudgeTime, updatedAt` |

No login-stamp field appears in either arm, and no `lastLoginAt` / `lastActiveAt` / `lastSeen` field exists anywhere in `src/`, `functions/`, or `firestore.rules`. Any key outside `hasOnly` is REJECTED.

**The relocation escape hatch fails on the read half.** `users/{uid}/prefs/{prefId}` (`firestore.rules:2031-2033`) is `allow read, write: if isSignedIn() && getTenantId() == tenantId && request.auth.uid == uid` — the stamp WRITE would work there, but the "**All Users** LAST-activity **column**" needs a manager to read the stamp **across users**, and that block has **no manager read arm**.

**To build, one of these rules edits is required:**
1. add a login-stamp field (e.g. `lastLoginAt`) to the users self-write `hasOnly` allowlist — both arms — so the client can stamp its own doc, which managers already read via the existing `allow list`; **or**
2. add a manager read arm to a manager-readable location holding the stamp.

⇒ **Human-merge + manual deploy** (`firebase deploy --only firestore:rules`), per Rule 19 and the standing absolute stop on rules.

**Bundle this with the E4 cross-time prospect-notes index FU** (needs `(agentId, prospectId)` in `firestore.indexes.json` + `firebase deploy --only firestore:indexes`) as a single **"rules + indexes attended window"** item — one attended session covering both deploy-gated backend deltas.

**Explicitly rejected during the run (endorsed by the dispatcher):** repurposing an already-allowed field such as `updatedAt` as a pseudo-login-stamp. `updatedAt` moves on any profile edit, so the column would show "activity" that never happened — a **lying column** is worse than an absent one.

Banked: Run A Tier 3b, 2026-07-25.

---

## Commission layout — unverified two-column claim, needs a real mockup first (banked 2026-07-25, Run A Tier 3b, LOW)

An **in-chat visual pass** (2026-07, pre-Run-A; pasted at run kickoff, never banked to a repo document) claimed the Commission Playground drifts from a **two-column rail+ladder** layout. Run A Tier 3b STOPPED the item: **no in-repo design authority for it exists.**

Evidence gathered during the STOP:
- `docs/audits/design-conformance-2026-07-12.md:113-115` and `-2026-07-13.md:110-112` list **exactly three** Commission items (saved-scenario chips · manager suggest-a-goal-back · Daily cadence chip). **Neither audit contains a Commission layout/column finding.**
- The only "two-column" reference in `docs/audits/trackj-recon-2026-07-07.md` is **row 27 — Production Report** (`ProductionTable` + `RankedLeaderboard`), a different screen.
- The canonical mockup `docs/design-system/screens-v2/commission-v2-scenes.jsx` has **no grid/column layout classes** to port toward.

Corroborating that chat-sourced design claims need provenance-checking: the **same** visual pass's other Commission claim ("missing persistency stat in the hero") turned out to be **absent data, not absent code** — `CommissionAnchorStrip.jsx:231-236` already renders the chip.

**IF pursued:** run a Claude Design pass that produces a REAL mockup file into `docs/design-system/screens-v2/`, then build against **that file** as the design authority. **Do NOT build from this FU's text** — it records a claim, not a design.

**Priority:** LOW. Banked: Run A Tier 3b, 2026-07-25 (dispatcher ruling: item DROPPED from Tier 3).

---

## Master Sheet STATUS filter chips — scoped, NOT built (banked 2026-07-25, Run A Tier 3b, MEDIUM)

Ruled buildable in Run A Tier 3b but **carried, not built** — the run's remaining budget could not do it to standard, and per-item completion honesty was preferred over coverage (dispatcher guidance). This entry converts the item into a precise spec so the next session starts at build, not discovery.

**What exists.** `MasterSheet.jsx:118-121` carries an explicit, deliberate deferral: *"STATUS + LEVEL chips from the mockup are intentionally NOT built here … [no] YTD/tenure-floor data for STATUS nor any level field for LEVEL."* `funnelFilters.js:9-16` names the exact taxonomy: **On track · Off pace · Gone quiet · Report late · Pers. ↓ · Below floor**, and states STATUS "needs the pro-rata tenure floor".

**What must be built (the real scope — three new reads):**
1. **YTD submissions** — `MasterSheet` currently loads only the SELECTED WEEK (`submissions` state, `:97/:168`). STATUS is a YTD-performance taxonomy, so it needs a year-scoped read (or to consume one the manager surfaces already hold — check `useBranchOverview`'s `ytdSubs` before adding a fourth fetch).
2. **companyMinimums** — currently hard-passed as `null` (`:251`, `deriveExceptions({ …, companyMins: null })`). Needed for the floor bands.
3. **Persistency** — the "Pers. ↓" chip needs persistency history, which this component does not load at all.

Plus: pro-rata tenure floor via the existing `resolveAnnualAPIFloor` (`src/utils/tenureFloors.js`, already used by `useBranchOverview`) — reuse, do NOT reimplement; the six-band derivation as a pure tested helper (mirror `funnelFilters`' existing pure-function style); chip UI + `DEFAULT_FUNNEL_FILTERS` extension; role-scoping check on any new read (UM own-unit / BM own-branch) before it ships.

**LEVEL stays BLOCKED** — no populated career-level field (`MasterSheet.jsx:158` maps `levelTitle ?? careerLevel ?? null`, unpopulated). Unchanged by this FU.

**Priority:** MEDIUM. Money-adjacent (floors) — value-level tests required on the band boundaries.

---

**RESOLVED 2026-07-25 — built on branch `post-run-a/master-sheet-status`, PR into `staging` (HOLDS unmerged pending the staging→main promotion).**

**What shipped.** New pure module `src/utils/funnelStatus.js` (`FUNNEL_STATUS_OPTS` · `exceptionToStatusKey` · `latestPersistency` · `buildStatusMap`), a `statuses` condition threaded through `funnelFilters.js` (default / count / predicate / dismissible chip), and a second, week-independent read wave in `MasterSheet.jsx` feeding it.

**The three reads, all via existing service files — no new query written.**
1. `getAllYTDSubmissions(tenantId)` (managerService) — already role-scoped server-side (UM → own unit, BM → own branch, TA/PA → tenant).
2. `getCompanyMinimums(tenantId)` (goalsService) — supplies `tenureApiFloors`.
3. `getPersistencyMapForYear(tenantId, year, opts)` (persistencyService) — scoped explicitly (`{unitId}` for UM, `{branchId}` for BM) because its per-agent reads are otherwise silently dropped by rules.

The wave is keyed on `[tenantId, role, unitId, branchId]`, NOT `selectedWeek` — year-scoped data must not re-fetch on every week change. Each arm self-catches.

**Derivation contract — zero invented constants.** The bands reuse shipped engines rather than opening a second math path:
- `floor` / `pace` / `report` / `quiet` ← `deriveExceptions` (`utils/managerExceptions.js`), the existing single-source-of-truth for "needs attention". Its pace arms are already pro-rated against `resolveAnnualAPIFloor`, and it is already mutually exclusive per agent. Nothing was re-ranked or re-implemented.
- `persistency` ← `PERS_FLOOR` (0.80), the canonical exported threshold in `lib/persistency/calculations.js`. Persistency is a DECIMAL there, not a percentage. Only the latest single month's stored value is read — never an average across months (that module's explicit anti-average rule).
- `ontrack` ← the residue, assigned ONLY when the derivation actually ran.

**Priority order:** `floor > pace > quiet > report > persistency > ontrack`. Production bands keep `deriveExceptions`' own severity ordering verbatim; persistency is applied first and overwritten by any production band, so it lands only on an otherwise-clean agent.

**⚠ THE "GONE QUIET" BAND IS NOT OFFERED ON THIS SURFACE — five chips ship, not six. THIS NEEDS AN OPERATOR RULING.** Caught in review on the PR (CodeRabbit, functional-correctness): the Master Sheet is a **filers-only table** — a row exists only for an agent with a submission in the selected week — while `quiet` means *zero* submissions this year. A row-holding agent therefore essentially can never be `quiet`, so the chip would be a control that **always returns an empty table**. It is omitted for exactly the reason LEVEL and the report family's "Missing" are omitted: the row set cannot hold the value. `FUNNEL_STATUS_OPTS` keeps the full six-band mockup vocabulary and `exceptionToStatusKey`'s mapping is intact and correct — `ROW_REACHABLE_STATUS_OPTS` is what the surface offers. Two tests pin the reasoning (no agent who filed the selected week is ever banded quiet; the engine still bands a genuine non-filer quiet when scoped in). **To make it meaningful, someone must rule between:** (a) render non-filers as rows — a different table, not a filter change; or (b) redefine it as a recency signal ("filed, but not for N weeks"), which needs an N nobody has ruled on. Both are out of scope for read-path work.

**The underlying mapping judgement (still worth a ruling even if (a)/(b) is declined).** "Gone quiet" has no in-repo derivation — the mockup (`mastersheet-funnel-scenes.jsx` `FUNNEL_STATUS_OPTS`) supplies the vocabulary only, and `MeetingMode.helpers.js:97-101` glosses it as "daily-recency" while explicitly declining to derive it. Rather than invent a recency threshold, `quiet` is mapped to `deriveExceptions`' existing **"No reports"** kind (filed nothing all year while the branch filed). It invents no constant and preserves the engine's own ranking ("No reports" 60 > "Report late" 55). **If the operator wants `quiet` to mean daily-log recency instead, that is a threshold decision and a separate slice** — the mapping is isolated in `exceptionToStatusKey`, one function, four lines.

**Unavailable ≠ On track.** If the YTD or companyMinimums read fails, `statusMap` is `null`: the chips are replaced by an honest note, no row carries a band, and an active STATUS condition never matches an unbanded row. A fabricated "On track" was the failure mode being designed against.

**Verification.** 24 new value-level tests in `funnelStatus.test.js` (band boundaries probed on both sides of 0.50 / 0.85 / `PERS_FLOOR`; a same-money-different-tenure negative control proving the floor actually drives the band; negative controls for unmapped exception shapes, absent persistency, and no-branch-activity), 13 new in `funnelFilters.test.js` (including: an unbanded row is excluded by *every* band), 7 new component tests in `MasterSheet.test.jsx` (chips render / both read-failure paths hide them / filtering / persistency banding / branch-scoped read assertion / chip clearing). Full local suite **365 files, 5687 tests, all pass**; lint 0; build green. A fixture-sanity guard in the new test file caught a wrong production-credit field name during authoring — kept as a permanent non-vacuousness check.

**Residuals (NOT closed by this work):**
- **LEVEL stays BLOCKED** — unchanged, no populated career-level field.
- **Unit friendly names (the LOW FU below) is a DATA gap, not a code gap.** `unitLabel(id, name)` already prefers a real name, `deriveUnitOptions` already reads `row.unitName`, and `MasterSheet`'s `userMeta` already maps `u.unitName ?? u.unit`. The raw-id fallback appears because the user docs carry no unit name — nothing in the read path to fix. That FU's body should be re-scoped to "populate `unitName` on user docs" rather than "thread a lookup into `deriveUnitOptions`".
- ~~**Threshold divergence worth a ruling:**~~ **RESOLVED in this PR (2026-07-26)** — and the original framing was wrong, which matters. Rule 17 verification found this was **not** one constant fractured three ways: `PERS_FLOOR` (0.80, at-risk band) and `PERS_GATE` (0.90, award eligibility) are **two distinct money thresholds**, and `companyMinimums.persistency` (90) is a **third, unrelated concept** — a tenant-configurable minimum on an agent's self-set annual *goal*. Consolidating them to one constant, as originally suggested, would have changed agent-facing outcomes in both directions. What was genuinely wrong was the **unit** divergence and the duplication, now fixed: canonical home is `lib/persistency/calculations.js` (decimal), with derived `PERS_FLOOR_PCT` / `PERS_GATE_PCT` companions, and six sites re-pointed at them. An anti-collapse test guards the distinction. See the two commits on this branch, and the sibling LOW note "Persistency threshold sites left un-consolidated, deliberately" for what was examined and left alone.
- **Escalation from that verification — 3 live defects fixed in this PR (own commit):** `MeetingMode.helpers.js`'s `latestPersistency` returned the E3 **decimal** unchanged while all three of its consumers expect a **percentage**. Consequences on real data: (1) every agent holding a persistency record was falsely flagged "Persistency ↓" reading "1% persistency"; (2) the branch scorecard rendered ~0–1% for healthy branches; (3) Meeting Mode campaign standings dropped every advisor into the `DQ` band with a ×0 payout multiplier. The pre-existing tests fed **percentage** fixtures — values that never occur in production — which is why it survived. Fixtures corrected to decimals; 4-case regression block added, negative-controlled.
- **Read cost:** `getPersistencyMapForYear` internally re-reads the tenant roster, so the sheet now issues a second `getTenantUsers`. Acceptable (the wave is off the paint path) but a candidate for the same consolidation.

---

## Tier 3c mechanical conformance — carried from Run A (banked 2026-07-25, LOW–MEDIUM)

Four mechanical items ruled in-scope for Run A Tier 3c but **not started** — the run ended at the Tier 3 PR with budget spent on 3a/3b. Carried verbatim so nothing is lost. **Item 3 is now RESOLVED (2026-07-25); items 1, 2 and 4 remain open.**

1. **Run-3 hero-card conformance worklist** (MEDIUM) — the hero-card items from the Run-3 worklist. **OPEN.**
2. **Motion pop-in wiring to the first live panels** (LOW) — the motion kit already exists (`screen-enter` / `--dur-*` / `--ease-*` in `src/index.css`, plus `useCountUp`); this is **wiring only**, no new kit. **OPEN**, and now partly scoped: [`docs/audits/design-conformance-2026-07-25.md`](audits/design-conformance-2026-07-25.md) finding **F3** gives three concrete cited sites using bare `transition-all` with no duration token (`MasterSheet.jsx:565`, `MasterSheet.jsx:810`, `PlannerDesktopBoard.jsx:140`).
3. ~~**`design_handoff_v2_app/mockups/` vs `screens-v2/` reconciliation** (LOW, docs-level)~~ — **✅ RESOLVED 2026-07-25** by the ledger rebuild ([`docs/track-j-port-ledger.md`](track-j-port-ledger.md)). The two folders were diffed by byte-set: **34 files are common** (the canonical spine, intact), **11 exist only at `screens-v2/` top level** (handoffs, DS-audit plans, the logo/motion lab, the marketing site, spec docs — none are app screens), and **7 exist only in `design_handoff_v2_app/mockups/`**. Of those 7: **3 absorb as new spine rows 35–37** (Planner & Scheduler v2 · Planner — Manager Surfaces · Money Needs Merged), **2 consolidate into row 37** as companions rather than screens (`Money Needs - 3 Options.html` = options-compare ideation; `Money Needs Merged - Build Notes.html` = build companion), and **2 are not screens at all** (`AgencyTrack On-Track Engine.html` = absorbed cross-cutting logic in `utils/planVariance.js` / `lib/monthlyVarianceChips.js` / `SuggestedWeekCard` / `StandardDetail`; `AgencyTrack Loop Prototype.html` = ideation, backed by `loop-proto.jsx`). Spine is now **37 rows**, not 34 — and not the 39 the Wave-1 brief projected, because consolidating the Money-Needs family as instructed necessarily yields 37. `screens-v2` + `redesign-addendum` remain canonical for design intent; the ledger is canonical for port status.
4. **Gold-contrast usage fixes** (LOW) — fix **usages only**, NEVER token values (`--color-gold` / `--color-gold-ink` are canonical in `app.css` v2; see the gold-split rule in CLAUDE.md). **OPEN**, with scope narrowed: the 2026-07-25 conformance pass found **zero raw hex** across the entire Run A touch-set and confirmed the only gold usage there resolves through `--color-gold` (finding C1 + D2), so the remaining scope lies outside the planner / Commission / shell / ChampionsPanel / Master Sheet surfaces.

**Note for whoever picks these up:** verify each item's design authority IS in-repo before building — Run A STOPPED two items (Commission two-column layout; R-11 login stamp) precisely because the claimed authority did not exist in any tracked document or the rules surface permitted no path.

---

## Manager report on-screen views — v2 port never happened (MEDIUM, banked 2026-07-25, Wave-1 item 1 → **Wave-3 M-item**)

**Ruling:** ledger rows 24–27 confirmed **PARTIAL** (dispatcher, 2026-07-25). This FU is the remaining work.

**What was mis-recorded.** The prior ledger rated rows 24–27 PORTED on commit `9c08c40b`'s *subject line*
(*"2.5 refined Agent PDF + Branch/Unit PDFs + per-view Download + honest DataSourceBadge"*). Reading the
diff shows 2.5 gave the three **on-screen** views only four things (`BranchManagerProductionView` +88,
`UnitManagerProductionView` +77, `ProductionReportTab` +11):

1. a `Download report` button + busy state,
2. an inline `role="alert"` PDF-error card,
3. `DataSourceBadge source="estimated"` → derived via `deriveProductionDataSource`,
4. two pass-through props on `ProductionReportTab`.

The commit's bulk (`AgentReportDocument.jsx` ±1709, new `ManagerReportDocument.jsx` +398,
`managerReportModel.js` +72, `agentReportPdfModel.js` +282) is **react-pdf document work** — a HEX-only
surface explicitly exempt from the v2 token system. **No layout, IA, composition or visual restyle.**

**Corroborating history (Rule 17).** `git log origin/staging -- <view>` shows these two components have
**never** had a dedicated Track-J port:

| Commit | Nature |
|---|---|
| `783c07aa` (#72, 2026-05-09) | Original Track-E build — **pre-v2**; still the structural basis today |
| `b10a3801` · `e0ac355f` · `3601341f` · `0773af3a` | Systemic sweeps (contrast, axe, glass, gold) — app-wide |
| `2ab27cc0` · `d3178618` · `15f724ec` · `cd58da5e` | Systemic tier-0 sweeps (states, dense tables, motion) |
| `9c08c40b` | The above — PDF + download + badge |
| `c2d9516c` | UM Unit-Aggregate hero parity with BM (Run3 item D) |

These rows received the **token layer**, not the redesign — exactly the pattern
`docs/audits/trackj-recon-2026-07-07.md` predicted app-wide.

**Scope.** On-screen composition/IA port for `src/components/productionReport/BranchManagerProductionView.jsx`
and `UnitManagerProductionView.jsx` against `AgencyTrack Production Report v2.html` /
`AgencyTrack Manager Reports.html` / `AgencyTrack Branch Report.html`. Row 27's **agent** variant
(#397/#403, `AgentProductionView.jsx`) is genuinely ported and is **out of scope**.

**Before dispatching:** run the mockup-vs-component diff-lock at Phase 0. Per the 07-07 recon's
classification these are REDESIGN-class, not TRUE-RESTYLE — the brief must permit composition and
computation changes. Do not dispatch this as a green-channel restyle.

**Cross-reference:** `docs/track-j-port-ledger.md` § The 9c08c40b verdict.

---

## Persistency threshold — three surfaces, three literals (MEDIUM, banked 2026-07-25) — ⚠ **PRE-MERGE CONDITION ON PR #871**

> **Dispatcher ruling 2026-07-25 (Wave 1 item 3): reconcile to ONE canonical constant BEFORE PR #871 merges.**
> This is a **blocking pre-merge condition**, not a follow-on. #871's STATUS chips band agents on a
> persistency floor; merging it while three different literals exist would ship a fourth consumer of an
> already-ambiguous number on a **money-adjacent** surface.

**The divergence** (surfaced by PR #871's own residuals section):

| Surface | Literal | Units |
|---|---|---|
| `src/components/manager/MeetingMode.helpers.js` | `< 80` | percentage |
| `getCompanyMinimums` default (`goalsService`) | `persistency: 90` | percentage |
| `src/lib/persistency/calculations.js` | `PERS_FLOOR = 0.80` / `PERS_GATE = 0.90` | **decimal fraction** |

`calculations.js` is the canonical export (used by `financingBonusEngine.js` gate comparisons and the K4
adapter's no-normalization design) and **decimal is the stored shape** — see the related FU on the
CLAUDE.md `persistency, // parseFloat, 0–100` annotation being wrong, which is the same defect at
documentation level.

**To close:** pick `PERS_FLOOR` / `PERS_GATE` from `calculations.js` as the single source, repoint the
other two consumers, and add a drift-guard test (negative-control verified) that fails if a bare `80` /
`90` persistency literal reappears. Money-adjacent ⇒ **value-level tests required on both sides of each
boundary**, per the same standard #871 applied to its own band boundaries.

**Note:** PR #871 also edits `docs/FOLLOW_UPS.md` on its own branch. Expect a merge conflict in this file
between #871 and #873; resolve by keeping **both** — #871's derivation-contract notes and this pre-merge
condition are complementary, not duplicative.

**Cross-reference:** `docs/track-j-port-ledger.md` § Row-19 detail.

---

## Design-conformance findings — 2026-07-25 audit (F1 MEDIUM · F2–F4 LOW, banked 2026-07-25)

Source: [`docs/audits/design-conformance-2026-07-25.md`](audits/design-conformance-2026-07-25.md) §5.
Findings were RECORDED, not fixed, per the Wave-1 brief. Dispositions below are the dispatcher's
(2026-07-25).

### F1 — Master Sheet error card has no Retry (**MEDIUM · Wave 2 candidate**)

`src/components/manager/MasterSheet.jsx:657-658` renders the load-failure state as a plain
`bg-danger/10` card with the message and **no button, no `onRetry`**. Redesign-addendum §1 requires
*"a persistent inline card **with Retry**"*; a manager whose YTD read fails must currently reload the
page to recover. The other three states are correct: loading (`:754`), actionable empty (`:765-773`),
live footer count (`:836`).

**To close:** adopt the compliant idiom already shipped in `src/components/gamification/Leaderboard.jsx`
(`retryKey` + stable callback) — same pattern as the Run-6 four-states holdout sweep. Low-risk, and the
surface already has the state plumbing.

### F2 — `Sidebar.jsx` static inline style (LOW)

`src/components/shell/Sidebar.jsx:391` — a static inline `style` object
(`display: 'block', borderRadius: 7, flexShrink: 0`) on the brand `<img>`. Genuine CLAUDE.md
"NO inline styles" violation: this is **static styling**, so the dense-table-geometry carve-out
(audit §3 D1) does not apply. Replace with Tailwind utilities.

### F3 — Bare `transition-all`, no duration token (LOW)

Three sites inherit Tailwind's default 150ms instead of the Nexus `--dur-1/2/3` scale (addendum §2):
`MasterSheet.jsx:565` (filter toggle knob) · `MasterSheet.jsx:810` (row-action button) ·
`PlannerDesktopBoard.jsx:140`. Invisible today; a drift vector the moment the tokens are retuned.
**Folds naturally into Tier 3c item 2 (motion pop-in wiring)** — these are its first three cited sites.

### F4 — `RunningLateSheet` target-size ratio (LOW, **investigate before fixing**)

`src/components/planner/RunningLateSheet.jsx` (E3, net-new) has 7 buttons vs 4 target-class hits — the
lowest ratio in the Run A touch-set. Likely shortfall: the +10/+20/+30 push presets and the what-moves
radios. **The count is a proxy, not a proof** (audit §6 U3) — it cannot see targets sized via a shared
constant or a parent class. Read the render path or run an axe target-size pass **before** assuming a
defect exists.

---

## Rule 21 — DETERMINISTIC-SKIP disposition class (banked 2026-07-25, dispatcher ruling)

**Ruling (Wave 1 item 5):** `.coderabbit.yaml` `path_filters` **stays UNTOUCHED** — the standing
allowlist-flip lesson applies (widening a filter to buy coverage has bitten before; the cost lands on
every future PR, not just the one that motivated it).

**Rule 21 gains a third disposition class.** The rule as written contemplates a reviewer being *present*
(dispositions: IMPLEMENT / ALREADY-RESOLVED / OBSOLETE / DISAGREE / OUT-OF-SCOPE) or *absent* (noted
explicitly, never read as approval). A **config-deterministic skip** is neither:

> **DETERMINISTIC-SKIP.** When a configured reviewer returns a *deterministic, config-driven* skip on a
> docs-only diff (e.g. CodeRabbit's "Review skipped — path filters" with the excluded files enumerated),
> the Rule 21 gate is **satisfied by dispatcher full-diff review**, recorded in the PR body. This is
> distinct from "absent": absence is unexplained silence and must wait; a deterministic skip is a stated,
> reproducible outcome with a Run ID, and waiting on it can never change the result.
>
> Conditions: (a) the diff is docs-only, (b) the reviewer's skip message enumerates the excluded files and
> they match the diff exactly, (c) the PR body records the dispositions **and** that dispatcher review was
> performed. Anything touching `src/`, `functions/`, or `firestore.rules` is **never** eligible.

**Applied first on PR #873** (this ledger PR): CodeRabbit skipped all 4 files via its Markdown exclusion
(Run ID `577e6ebc-d5e5-4fe0-b822-d1ba33c0ea65`); Gemini OBSOLETE (consumer version sunset). Dispatcher
review satisfied on the report's evidence, 2026-07-25.

**Open onboarding action:** **check Greptile's Markdown coverage** when it is onboarded as a reviewer — if
Greptile reviews `.md`, docs-only PRs regain automated coverage and this class becomes a narrow fallback
rather than the standing path for every docs PR. Re-evaluate the ruling at that point.

**Candidate for codifying into `CLAUDE.md` § Methodology Rule 21** as a separate small docs PR (this file
tracks it as a follow-up only, per the same convention used for the validity-SHA convention).

---

## CONTEXT.md `Current main HEAD` drift (LOW, banked 2026-07-25) — **post-promotion fill item**

`docs/CONTEXT.md` records `Current main HEAD` as `d0e74c12` (PR #862, Run 9 promotion). Actual
`origin/main` at 2026-07-25 is **`60dbf1c2`** — two commits ahead: #864 (Track K Phase 1 Branch Manager
Strategic Plan dashboard, a *work* PR that should have taken a Rule 16 fill) and the Run A brief landing.

**Ruling (Wave 1 item 7): fold into the post-promotion fill, do not fix standalone.** The staging→main
promotion will move `Current main HEAD` again, so a fix now would be immediately stale. The fill commit
after promotion must reconcile **both** the promotion squash **and** the missed #864 fill, per Rule 16(c)
(a program is not complete until one consolidated fill covers every merged work PR).

**Watch item:** #864 merging without a fill is the same failure mode as the 2026-06-06 Gemini-harvest
9-PR drift that motivated Rule 16(c). Worth checking at promotion whether anything else landed on `main`
unfilled in the same window.

---

## Flake register — three provenance corrections + a measured baseline (banked 2026-08-02, PR for `chore/flake-burn-harness`)

Appended at end of file per CLAUDE.md Rule 7(b). Three corrections to claims recorded elsewhere in this file, and one new measurement that overturns a load-bearing inference.

### (a) `CHIP_WAIT` in `CompliancePanel.nudge.test.jsx` — RULED: leave it, deliberately

Two entries in this file both describe `CHIP_WAIT = { timeout: 3000 }` at `CompliancePanel.nudge.test.jsx:59`, and they look contradictory:

- **#563 (`063fff1e`)** raised the global `asyncUtilTimeout` to 5000 **and** pinned this file's chip assertion to 3000, in the same commit, as the flake fix.
- **The #872 pattern-2 audit** then named that exact line as the one surviving **self-narrowing** site — a `waitFor` capping itself *below* the CI-tuned global.

**Both are true, and they reconcile on one fact from #543's own burn log:** `CHIP_WAIT` was already in place during the 57% chip-missing failures, and the assertion waited its **full 3000 ms** while the chip never appeared. The failure was not a budget shortfall. `CHIP_WAIT` is therefore **inert with respect to the proven mechanism** — it is not a competing fix to it, and #872 naming the shape is correct without implying it caused anything here.

**Ruled: do not change it now.** This file is the only member of the family with a proven fix *and* a documented baseline (0/200 at #543/#563; independently re-confirmed **0/30** on `staging` `2ef1abc5` by `scripts/flake/burn-isolated.ps1`). It is the **control**, and changing its timeout before the experiment destroys the reference point everything else is measured against.

Revisit **after** the race investigation reports, as its own change with its own burn. The `// do not strip` tripwire comments at lines 9, 55 and 75 stay.

### (b) `delay: null` is ZERO on `staging`, not one

Any entry stating that one file still uses `delay: null` is **wrong**. `git grep` on `origin/staging` returns **zero** real occurrences. The mechanism is gone repo-wide.

**How the miscount happened, because it will recur:** the grep matched a *comment asserting the opposite* —

```
// do not strip (layer b): NO delay:null - lab burn confirmed 57% chip-missing solo rate under delay:null:
```

A pattern search for a banned construct will match the tripwire comment warning against it. This repo uses `// do not strip:` comments deliberately and they are dense around exactly the code most likely to be grepped for. **When grepping for a construct's absence, exclude comment lines or read every hit** — a raw count is not an occurrence count.

### (c) PR #543 is an unmerged duplicate of merged #563

`#543` (`fix/nudge-flake-stabilization`) is **unmerged and should not be worked**. Its code content is already on `staging` via **#563 (`063fff1e`, merged 2026-06-11)**, which carried the same `delay: null` removal plus the `asyncUtilTimeout` global.

Verified rather than assumed: `CompliancePanel.nudge.test.jsx` is **byte-identical** between `origin/staging` and `pr/543` (`git hash-object` = `072679d3` on both sides). **There is no fix to salvage and no burn to re-run.**

Related: `28968bbf` ("fix(gemini-batch-a): RTL anti-patterns in 13 test files") is likewise already on `staging` and sits in that file's own history — it does not need hunting.

**The one thing #543 did carry uniquely was the burn harness** (`tmp/burn-*.ps1`), which existed nowhere else — `git ls-tree` found nothing matching "burn" on `staging` or `main`. Now ported to `scripts/flake/`.

### (d) NEW MEASUREMENT — `MeetingMode.test.jsx` fails **in isolation**, and this overturns the contention inference

30-iteration isolated burn on `staging` `2ef1abc5`, one machine, nothing else running:

| file | result | shape |
|---|---|---|
| `CompliancePanel.nudge.test.jsx` (control) | **0/30** | — |
| `MeetingMode.test.jsx` | **5/30 (16.7%)** | all `timeout` |

> **⚠ RATE SUPERSEDED 2026-08-11 — do not quote 16.7%.** A second isolated burn on
> `fix/flake-awaiting-pattern` (`27303333` base, same harness, same machine class) measured
> **2/90 (2.2%)**. Pooled: **7/120 = 5.8%, Wilson 95% ≈ 2.9–11.6%**. The two windows are
> **significantly inconsistent** (two-proportion z ≈ 2.9, p ≈ 0.003), so the pooled figure
> is a summary of two disagreeing samples, **not** an estimate of a stable rate, and the
> discrepancy is **unexplained** — most likely machine-load sensitivity, which is what a
> timing-window mechanism would predict but which has not been measured.
>
> **The isolation *finding* is unaffected** — the file does fail solo, which is all this
> entry needed it to do. Only the number is corrected. And the rate is no longer the
> instrument of record: the mechanism is now directly observable per-iteration, so
> acceptance is by **trace**, not by rate. See § Flake race — MECHANISM PROVEN.

**Two entries in this file are contradicted by this.**

1. **"Both failing files pass 85/85 in isolation on the same tree"** and the general claim that family members pass solo. `MeetingMode` does **not**. The earlier clean checks — including a `12/12 x3` performed during the P0-D session — are fully consistent with a 16.7% rate: **P(0 failures in 3 runs) = 0.833³ = 0.58.** The isolation result was never evidence of stability; the sample was too small to detect the rate. Sample sizes must be chosen against the rate being detected.

2. **"No failure repeated across runs — the population rotates, which is the signature of a shared environmental contention effect rather than N independent per-test bugs."** The population rotates **inside a burn of one file with nothing else running**:

| failing test | times in 30 |
|---|---|
| `run-of-show > agenda rail is shown on the agent scene and jumps when clicked` | 2 |
| `awards within reach scene > renders an in-reach award card once an agent crosses the 60% floor` | 1 |
| `run-of-show > skip-logs the awards scene when nobody is within reach` | 1 |
| `run-of-show > ArrowRight advances from opening to the branch scorecard` | 1 |

Rotation therefore does **not** imply cross-file contention. Here it is **intra-file**, and no other test file participated.

**All four are already-named register members** — `agenda rail` and `skip-logs` from the sixth data point (observed locally, `agenda rail` later CI-confirmed on #894), `awards within reach` from CI on #893, and `ArrowRight` from the #875 "#872's fix set is provably INCOMPLETE" entry. Four members named across three independent sources reproduce in a single seven-minute burn.

**Consequences for the investigation:**

- `MeetingMode` has received **zero** remediation rounds (#861 hit `AgentAwardsPanel`; #872 hit `AgentPlannerPanel` + `DailyCaptureV2`) yet is the most active member on record.
- A cheap instrument reproduces it: ~7 minutes isolated, versus full-suite burns at minutes per iteration.
- Runner-level remedies (`pool` / `maxForks` / `fileParallelism`) cannot address an intra-file race. `vite.config.js` still has no `poolOptions` block, and that may still be worth doing — but it is **not** the fix for this file.
- Whether the rest of the family is also intra-file is **open**. Only `MeetingMode` and the control have been burned. This is one file, one machine, one 30-iteration sample; the 16.7% figure has a wide interval and is not a precise rate.

**Do not act on this yet.** Recorded as the harness PR's evidence. Scoping belongs to the race brief, which owns the register reconciliation as its Phase 0 question 0.

---

## ⚑ Flake race — MECHANISM PROVEN by direct observation (banked 2026-08-11, `fix/flake-awaiting-pattern`, HIGH — supersedes the hypothesis half of the race brief)

**Six rounds of remediation had produced six stories. This is the first one with a trace.**

### The mechanism

A **synchronous `fireEvent.keyDown`** dispatched at a document/window listener whose
subscription is torn down and re-created as async data lands can be served by the
**previous commit's handler closure**. That closure holds stale *bounds* — not a stale
index — so the dispatch is silently absorbed and the state transition the test awaits
**never happens**. The subsequent `waitFor` then runs its full budget. **Never, not late.**

`MeetingMode.jsx:929-949`: `go` is a `useCallback` over `[total]`, and the transport
listener re-subscribes on `[go, total]`. Before data lands `model` is `null` → `scenes` is
`[]` → **`total === 0`**, and `go` clamps to `Math.max(total - 1, 0)` = `0`.

**`setIndex` takes a FUNCTIONAL updater, so the index is never stale — only `total` is.**
A stale-served dispatch therefore contributes nothing rather than resetting anything, and
with `k` stale-served dispatches the deck rests at **`target − k`**. That is a quantitative
prediction, and it is what was measured.

### The evidence — 20+ failing traces, test and component UNCHANGED

Instrumented via `scripts/flake/instrument-keydown-setup.js` + `vitest.instrumented.config.js`
(a side config CI never loads). Every failing trace, without exception:

| Test | dispatches | target counter | final counter | stale-served `k` |
|---|---|---|---|---|
| `ArrowRight advances` | 1 | `02/08` | **`01/08`** | 1 (its only dispatch) |
| `agenda rail` | 5 | `06/08` | **`05/08`** | 1 |
| `skip-logs the awards scene` | 7 | `08/08` | **`07/08`** | 1 |
| `awards in-reach card` | 7 | `08/09` | **`07/09`** | 1 |

`final = target − k` in **every** trace. The healthy control trace (same test, passing) has
the fresh generation registered *before* dispatch 0, zero stale-served, counter advancing
monotonically to `08/08`.

**Two competing accounts refuted by the same trace:**

1. **CONTENT-NOT-LOADED** predicts final `08/08` with zero stale-served. Never observed.
2. **"the data had not loaded yet"** is refuted by the sharpest detail in the trace: at the
   stale-served dispatch the rendered counter **already reads `01/08`**. The render had
   committed with `total = 8` while the live handler closure still held `total = 0`.
   **Rendered state and handler closure disagreeing is the passive-effect flush gap made
   visible**, and it is the whole defect.

### ⚠ THE ACCEPTANCE TEST IS THE TRACE, NOT THE RATE

At a pooled ~5.8% (Wilson 2.9–11.6%) a rate-based proof needs hundreds of iterations and
still only yields "no red in N attempts" — an argument from absence, which is the currency
all five prior rounds traded in. **That is over.** Post-fix the claim is deterministic:

> every dispatch served by the fresh generation · **zero stale-served** · final counter
> reaches target.

**If even ONE iteration shows a stale-served dispatch the fix is incomplete — regardless of
whether the assertion passed.** A green assertion with `stale-served: 1` is a masked
failure, not a fixed one, and masking is precisely how #872's remedy came to be recorded as
closed while the race survived under it.

### The instrument AMPLIFIES the rate, and that is an asset

≈14% instrumented vs 2.2% uninstrumented on the same branch. **Amplification, not
contamination** — the traces carry the identical signature (same four tests, same timeout
shape, same `k = 1`, same `target − k`). Likely cause is that the wrapped handlers and the
`MutationObserver` widen the commit-to-flush window; **that is provisional and untested.**
Consequence: verify the fix **under instrumentation**, where the race is easiest to hit,
not under quiet conditions where it is hardest.

### Falsification (Rule 23)

Overturned by: any failing trace showing final `= target` with zero stale-served (a second
mechanism); the fix landing with stale-served dispatches still observed; or the same
instrument showing zero stale-served dispatches on `AgentPlannerPanel` while it still fails.

---

## Flake race — PRODUCTION DEFECT, and the test fix MASKS it (banked 2026-08-11, MEDIUM — own slice, NOT the test slice)

> **⚠ ESCALATED 2026-08-12 (flake Phase 1) — the masking is no longer hypothetical, it has
> HAPPENED.** Phase 0 recorded that the test fix *would* mask this window. Phase 1 landed
> that fix (`MeetingMode.test.jsx` ×4 → `userEvent.keyboard`; `AgentPlannerPanel.test.jsx`
> helpers → explicit flush). **The detector is now gone.** Nothing in the suite currently
> fails when this window is open, so the only remaining record that it exists is this entry
> and the traces attached to it. The regression-test obligation below is therefore no
> longer a nice-to-have — without it the defect is undetectable by any automated means.

**`MeetingMode.jsx:929-949` admits a window in which the committed render and the live
keydown handler closure disagree about `total`.**

This is a product defect independent of any test. A user pressing `ArrowRight` while the
deck is still loading has the keypress **silently swallowed** — the handler clamps against
`total = 0`. Nothing about that requires a test to be present.

### THE FIX — specifiable now that the mechanism is exact

**`go` must not close over `total`.** The defect is a captured value, so the remedy is to
stop capturing it:

```js
// MeetingMode.jsx:929-931 — current: `total` is captured in the closure, and the
// listener that holds it is only replaced on the next passive-effect flush.
const go = useCallback((dir) => {
  setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(total - 1, 0)));
}, [total]);

// Fix: hold the bound in a ref read INSIDE the updater, so the clamp uses the
// value as of dispatch rather than as of subscription.
const totalRef = useRef(total);
useEffect(() => { totalRef.current = total; }, [total]);
const go = useCallback((dir) => {
  setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(totalRef.current - 1, 0)));
}, []);           // no longer re-created per `total`, so the listener stops churning
```

Deriving the clamp from state inside the updater is equally acceptable. Either **closes**
the window rather than out-waiting it, and both also stop the keydown effect
re-subscribing on every `total` change — which removes the churn as well as the staleness.

**The regression test then becomes trivial:** assert the handler's view of `total` matches
the committed render — i.e. dispatch during the load gap and assert the index advances.
With the ref there is no gap to hit, so the test is deterministic rather than statistical.

### ⚠ The obligation, stated plainly so it is not lost

The Phase 1 test fix (`await userEvent.keyboard`) **masks this window; it does not close
it.** It works by flushing pending passive effects before dispatch, which means it removes
**the only thing currently detecting the defect.**

**The slice that owns the component fix MUST add a DELIBERATE regression test for the
stale-`total` window** — one that dispatches during the load gap on purpose and asserts the
handler sees the *current* `total`. That regression test is essentially the instrument
already written (`scripts/flake/instrument-keydown-setup.js`): assert the serving
generation is the fresh one.

Without it we will have deleted the detector and kept the bug.

**Do NOT bundle this with the test fix.** Changing both at once destroys attribution — if
the rate goes to zero nobody can say which did it. That is exactly the error that produced
#563's confounded `delay: null` + `CHIP_WAIT` bundle, which cost two later sessions to
untangle.

---

## Flake register — corrections from the Phase 0 investigation (banked 2026-08-11)

- **STRIKE `DailyEntryModal.test.jsx` — the file DOES NOT EXIST.** Deleted 2026-07-08 in
  `214ea26c` ("tier-0.6 delete unwired onboarding steps + DailyEntryModal ruling"). It is
  named as a live member by both `28968bbf` and the #543 50× burn. Nobody should hunt it
  again.
- **`aggregate-on-save (Phase 2.2)` is a describe block INSIDE `DailyCaptureV2.test.jsx`**
  (`:594`, `:607`), not a separate file. The tenth data point reads as though it were a
  fourth file.
- **⚠ The two-family claim is DOWNGRADED, not strengthened.** Only family B (the keydown
  race) is proven. `DailyCaptureV2`'s stepper — the bare-query PROXY member — burned
  **0/30**: its 167/181ms failures are **CI history, not local reproduction**, so that
  family has **no path to mutation verification by the method built here**. It remains a
  real observed failure of a different shape; it is **not** a confirmed second mechanism.
- **⚠ The nine 0/30 files are NOT clean.** Wilson 95% upper bound on 0/30 is **≈11.4%** —
  each could be flaking at up to one run in nine and this burn would look identical. Record
  them as **"no local reproduction at n=30"**, never as fixed, cleared or unaffected. No fix
  is proposed for any of them, because there is nothing to verify one against.

---

## Burn-freeze applies to EVERYTHING the runner re-reads per iteration, not just checkouts (banked 2026-08-11, generalises the #895 / #543 rule)

`scripts/flake/burn-isolated.ps1` carries a WORKTREE RULE from #543, whose first ~200
iteration attempt was discarded because a mid-burn checkout silently ran iterations against
a different tree. **The rule is stated in terms of checkouts. That is too narrow.**

The invariant is: **every input the test runner re-reads on each iteration must be frozen
for the duration of the burn.** `npx vitest run` re-reads the config, every setup file,
every test file and every source file on *every* iteration. So a burn is invalidated
identically by:

- a checkout / rebase / stash-pop / branch switch (the #543 case), **or**
- editing a **setup file** or **vitest config** the run loads — e.g.
  `scripts/flake/instrument-keydown-setup.js` or
  `scripts/flake/vitest.instrumented.config.js`, **or**
- editing the test file or any source module in its import graph.

**All of these fail the same way: silently.** Iterations before and after the edit are
pooled into one number, no error is raised, and the result looks exactly like a clean burn.
A config edit loses 200 iterations as thoroughly as a checkout does and is harder to notice
afterwards, because `git status` shows a modified file rather than a moved HEAD.

**Practical rule:** while a burn is running, edit **only** documentation. If an instrument
change is needed, let the burn finish or kill it — never edit under it and never reason that
"the change is small". Observed and honoured during the Phase 0 investigation: the
`AgentPlannerPanel` probe was written but held unapplied until the `MeetingMode` burn
completed, precisely to avoid pooling two instrument versions into one rate.

---

## ⚑ Flake register — a member found by the PREDICATE, not by a failure (banked 2026-08-12, `fix/flake-dispatch-await`, Phase 1)

**`MeetingMode.test.jsx` — "Tab from the last focusable element cycles back to the first
(focus trap)" is a member of the stale-keydown-closure family. It has never failed, and it
was never going to.**

**Provenance is what makes this entry different from every other one in the register.**
Every prior member arrived via an observed red — CI, a local run, or a burn. This one was
found by a *predicate* applied uniformly to a passing suite:

```
staleServed  <=>  servingGeneration.total  !=  counterBefore.total
```

**6 of 150 instrumented iterations, with `testFailures = 0`.** Trace, verbatim:

```
test: Tab from the last focusable element cycles back to the first (focus trap)
  #1 key=Tab counterBefore=01/08 servedBy=[gen1@document, gen1@window]
  STALE-SERVED dispatches: 1 of 1
    #1: win-gen1 captured total=0 vs committed 8
```

It `await renderLoaded()`s and then dispatches synchronously — the identical shape as the
four fixed members. It has never *flaked* only because the transport handler ignores `Tab`
(it branches on ArrowRight/ArrowLeft/Home/End/digits), so the stale dispatch is
inconsequential **to what this test asserts**. A latent member, not a benign one.

**Why this matters more than one extra fix:** a rate-based gate reported this tree
150/150 clean. The defect was invisible to every instrument the register has used for six
rounds, and visible immediately to one that measures the mechanism instead of the outcome.

**It was also a self-inflicted near-miss worth recording.** The first Phase 1 draft
*excluded* the Escape and Tab tests from the stale counter by name, on the correct
reasoning that they legitimately run before data loads. The reasoning was right and the
remedy was wrong: a hand-picked exclusion list is where the next member hides. Replacing
the proxy ("served by gen1") with the predicate above made Escape fall out on its own —
`counterBefore=00/00` agrees with a generation registered at `total=0` — while Tab, which
does await the load, was correctly flagged. **`Escape` is deliberately NOT fixed**: it
needs nothing, and if someone later makes it await the load the predicate will catch it,
which is the property the exclusion list would have destroyed.

**Remedy:** `await flushPendingEffects()` before the existing `fireEvent`, NOT
`userEvent.keyboard('{Tab}')` — userEvent performs real tab navigation and would move
focus itself, which would stop the test exercising the focus trap at all. See CLAUDE.md
§ Choosing between `userEvent` and `fireEvent`.

**Falsification:** overturned if the predicate flags a dispatch whose serving generation
demonstrably held the committed `total` (a false positive in the registration-counter
reading), or if a member is found whose serving generation agrees on `total` yet still
bails.

---

## Flake instrument — one dispatch served by TWO generations: artifact or defect? ONE measurement decides (banked 2026-08-14, PR #899, MEDIUM — test-infra)

**Do not restart this from "something odd in the traces". The discriminator is written down
below and it is a single measurement.**

`AgentPlannerPanel.test.jsx` traces show a single keydown dispatch served by **two**
document generations — e.g. `servedBy=[gen7@document, gen8@document]`, `serving=[8, 9]`. It
appears on the `ctrlZ` undo members and was still present after the FIFO wrapper fix in
#898, so it is **not** the single-entry `wrappedFor` bug that PR corrected.

**Two live handlers on one target means exactly one of:**

1. **A real leaked listener in the component** — an effect cleanup that did not run, so an
   old `document.addEventListener('keydown', …)` from a previous
   `AgentPlannerPanel.jsx:1330` subscription is still attached. That is a production defect
   with a memory and double-handling cost, independent of any test.
2. **Residual instrument bookkeeping** — the FIFO queue in
   `scripts/flake/instrument-keydown-setup.js` mis-pairing an add with a remove, so the
   instrument reports two live wrappers where the component has one.

**THE TEST — one measurement, no ambiguity:** count `document` keydown listeners on the
**UNWRAPPED** component, with the instrument disabled entirely (`FLAKE_INSTRUMENT` unset).
Use a plain counting shim around `document.addEventListener`/`removeEventListener`
installed by the test itself, render `AgentPlannerPanel`, let the appointment data land,
and assert the net count. **>1 ⇒ defect (1). Exactly 1 ⇒ artifact (2).** Nothing else needs
deciding first.

**Why it was not resolved in #899:** the two `undo` members are fixed by the same
`flushPendingEffects()` remedy as everything else, and the acceptance gate reads clean
(0 stale-served across 4350 trace rows), so nothing was blocked. But they were never
*independently characterised*, and this is the loose end. PR #899's counter fix now reports
stale **server-invocations** separately from stale **dispatches**, so the divergence between
those two numbers is the standing signal for this.

**Falsification:** overturned if the unwrapped count is 1 and the instrument still reports
two serving generations (⇒ artifact, fix the instrument), or if it is >1 and the extra
listener is traced to a mount that legitimately owns its own subscription.

---

## Rule 21 — a green tick that means "we did not look" (banked 2026-08-14, PR #899)

**Recorded because a rate-limited reviewer and a clean reviewer render identically in the
checks UI, and they are not the same thing.**

On PR #899, CodeRabbit reviewed the first HEAD (1 actionable finding, IMPLEMENT — the
per-server vs per-dispatch stale counter) but returned **rate limited** on the FINAL HEAD.
The fix for its own finding — **+11/−1 in
`scripts/flake/instrument-keydown-setup.js`** — therefore merged
**unreviewed-because-rate-limited**, not reviewed-and-clean. Gemini was absent throughout
(structural: sunset 2026-07-17).

**The check row read `CodeRabbit  pass  Review rate limited`.** A reviewer that declined to
look reports the same green as one that looked and found nothing.

**Practice:** when disposition-tabling a PR, state the reviewer's status **per HEAD**, not
per PR, and say explicitly when the final HEAD went unreviewed. This is the third
consecutive cycle CodeRabbit has rate-limited (see § External code reviewer, HIGH) — it is
the standing coverage gap, not an incident.

---

## `enforce_admins: false` on `main` — the required checks are advisory on the direct-push path (banked 2026-08-16, promotion-prep governance PR, HIGH — repo governance / CI)

**Observed, not inferred.** Landing a brief directly to `main` on 2026-08-16 produced:

``
remote: Bypassed rule violations for refs/heads/main:
remote: - 2 of 2 required status checks are expected.
   f36430db..93728513  main -> main
``

The push succeeded. Both required checks were pending and neither gated it.

**The actual protection state**, from `gh api repos/Kelsean868/agencytrack/branches/main/protection`:

| Setting | Value |
|---|---|
| `required_status_checks.contexts` | `lint-and-build`, `functions-tests` |
| `required_status_checks.strict` | `false` |
| `enforce_admins` | **`false`** |
| `required_pull_request_reviews` | absent (no review gate) |
| `allow_force_pushes` / `allow_deletions` | `false` / `false` |
| `staging` protection | **none** — the API returns 404 |

So `main` is protected in the sense that force-push and deletion are blocked, and unprotected in the sense that the checks it requires can be skipped by the one account that pushes to it. This is the mechanism behind the Track J observation that merges landed while CI was still in progress — the platform was never gating admins.

**Why it is worth a decision rather than a shrug.** The direct-push path is not rare here: brief landings (`/land-and-dispatch`), Rule 16 post-merge fills, and `.claude/commands/` changes all commit straight to `main` by design. Every one of those bypasses. Combined with § *The flake family is ~10 members and #899 fixed TWO*, `main`'s gate is currently both **bypassable** and **unreliable when it does run**.

**STRONGEST DATA POINT SO FAR — the promotion itself (2026-08-16, `b4d9be7b`).** Every earlier observation was a small docs push, which makes the bypass easy to read as harmless. The `staging`→`main` promotion was not small: **98 files**, the entire v3 Phase 0 code range, the flake fix, and the governance convergence. It went in by direct push and printed the same line:

```
remote: Bypassed rule violations for refs/heads/main:
remote: - 2 of 2 required status checks are expected.
```

**Zero CI checks ran on the largest change to `main` in three weeks.** Not "ran and passed" — *did not run*. The safety came entirely from #907's rehearsal and the operator's step-(d) checks, both of which are good practice and neither of which is a gate. This is what `enforce_admins: false` costs at full scale, and it is the case to weigh the ~5-minutes-per-dispatch price against.

Counted across this session alone the bypass line appeared **six times**: two brief landings, three brief revisions, and the promotion. **Setting NOT changed** (Rule 19 — dispatcher/operator action).

**The trade, stated plainly so it can be decided rather than drifted into:**

- **Turn it on** (`enforce_admins: true`): the bypass disappears for everyone including Kyron. Cost is roughly 5 minutes of CI per dispatch, because brief landings and fills would have to become PRs — which is exactly what the propagation-direction rule already predicts for `CLAUDE.md` edits, and arguably an improvement for governance files.
- **Leave it off**: the direct-push path stays fast, and the required checks remain honest only on the PR path. If this is the choice, it should be a recorded decision rather than an unexamined default, because CLAUDE.md now states the posture explicitly.

**Do NOT change the setting.** This is a repo-administration change and a dispatcher/operator action (Rule 19). CC banked the finding; the ruling is Kyron's.

**Falsification (Rule 23).** Overturned if `gh api .../branches/main/protection` returns `enforce_admins.enabled: true`, or if a direct push to `main` is rejected pending checks. Either would mean the bypass path is closed and this FU should be marked RESOLVED with the observed evidence replaced.

---

## The flake family is ~10 members and #899 fixed TWO — `staging`'s gate is better, not fixed (banked 2026-08-16, PR #907, HIGH — CI / process)

**This corrects a framing the dispatcher and I were both using, and which `main`'s own FU states outright.** `main` carries § *The #899 flake fix lives on `staging` ONLY* (banked 2026-08-16, PR #906 session), which reads as though promoting it repairs `main`'s unit-test gate. That FU is **not** on `staging` — it arrives here at the next promotion — so this entry is written to stand beside it rather than edit it, and to be read together with it.

**The corrected statement, verified rather than asserted:**

- **The flake register names ~10 distinct tests** across its three roster blocks (§ *Flake family scope*'s numbered roster of 7 named + 1 explicitly unnamed, plus 3 more in the table above it; the blocks overlap, so the exact dedup count is a judgement, not a fact). It is a large family.
- **#899 (`90a7718b`) changed exactly TWO test files** — `src/components/manager/__tests__/MeetingMode.test.jsx` and `src/components/planner/__tests__/AgentPlannerPanel.test.jsx` — plus the new `src/test-utils/flushPendingEffects.js` helper. Verified with `git show --stat 90a7718b`.
- **The remaining members were explicitly left unruled**, having no local reproduction. That was a deliberate, recorded decision, not an oversight.

**So `staging` is better by two files. It is not fixed.**

**Evidence, from the PR that banked this.** #907 is cut from `staging` — which *has* `flushPendingEffects.js` — and is a **docs-only diff, 13 files, zero `src/`**. Its first `lint-and-build` still went red:

``
TestingLibraryElementError: Unable to find an element with the text: South Branch
  at src/components/admin/__tests__/BranchesPanel.test.jsx:133:19
``

The dumped DOM still showed `animate-pulse` skeletons — the assertion ran against the loading commit. Re-run: **PASS (5m16s)**. Intermittent, not deterministic. `BranchesPanel` is member 7 of the numbered roster and one of the members #899 did not touch.

**Consequence for the promotion's acceptance check.** `git ls-tree origin/main -- src/test-utils/flushPendingEffects.js` returning a blob proves **the fix ARRIVED**. It does **not** prove `main`'s gate is clean. After promotion `main` inherits a gate that is better by two files and still intermittent — expect occasional reds on inert diffs, and re-run to separate flake from regression until the remaining members are ruled.

**Falsification (Rule 23).** Overturned if a member outside #899's two files is shown to have been fixed by it, or if the register's roster is shown to name substantially fewer than ten distinct tests after a proper dedup. **Not** overturned by an intermittent red after promotion — that is the untouched remainder, tracked in § *Flake family scope*, not a failure of the promotion.

---

## Sunday aggregator now ZEROES agent-entered `serviceCalls` / `referralsObtained` on an unsubmitted hybrid draft (banked 2026-08-26, daily-call-fields PR, MEDIUM)

**This is a real data-loss path, and it is a direct consequence of a locked decision — not an implementation slip.** Recording it because the brief stated the analogous consequence for the daily pace badge (ruling D-SC) but not this one for the weekly draft.

`aggregateDailyToWeekly` writes every field it sums unconditionally, so a `{ merge: true }` write overwrites whatever the agent typed. That is deliberate and long-standing for the call fields — the aggregator's own comment says the explicit zeros exist to stop double-counting. What changed on 2026-08-26 is that **two more fields joined the set**: decision 3 added `referralsObtained` and ruling D-SC added `serviceCalls`. Before that PR neither was written by the aggregator, so an agent-entered value survived the cron.

**The failure, concretely.** A `hybrid`-mode agent fills the weekly wizard mid-week — Step 2 `serviceCalls` (`StepCallsF2F.jsx:74`), Step 5 `referralsObtained` (`StepNewNamesAdded.jsx:78`) — and does **not** submit. Sunday 23:00 TT the cron runs (`sundayDailyToWeekly.js`), skips only drafts with `status === 'submitted'`, and merges the daily rollup over the draft. Neither field has a Daily Capture UI, so the daily sum is **0**, and the agent's typed values are replaced by 0. `referralsObtained` is a **3pt** field.

**Not yet live.** `aggregateDailyToWeekly` is in `functions/` and is deploy-gated — this reaches production only when `firebase deploy --only functions` runs, which is a separate dispatcher action.

**Three candidate resolutions, none taken here** (picking one is a product call, not a mechanical fix):
1. **Max, not replace** — write `max(dailySum, existingDraftValue)` for fields with no daily UI. Cheapest, but makes the aggregator non-idempotent against its own prior output.
2. **Skip zeros** — omit a field from the merge when its daily sum is 0. Simple, but then a genuine correction to zero can never propagate.
3. **Give both fields a Daily Capture stepper** — removes the asymmetry at its root and is the only option that makes the overwrite *correct*. Largest scope.

**Severity:** MEDIUM — silent, affects only unsubmitted hybrid drafts, and not live until the functions deploy. **Falsification:** overturned if the cron is shown to skip drafts an agent has edited (it does not — it skips only `status === 'submitted'`), or if a daily write path for these two fields lands first, which resolves it by making the sums real.

### MITIGATED 2026-08-26 — resolution 2 applied (omit-when-zero), downgraded MEDIUM → LOW

The operator ruled for **resolution 2** before the PR merged: both aggregator twins now omit
`serviceCalls` and `referralsObtained` from the returned object when their daily sum is 0, so a
`{ merge: true }` write leaves an agent-entered value untouched. The key returns the moment any
entry carries a non-zero, and derived still wins over typed at that point — the same rule the four
call fields follow. Covered by five tests per twin, including both merge directions.

**The residual is exactly the downside this entry named, and it is not fixed.** A genuine
correction to zero still cannot propagate: once the KQM Calls ingest endpoint writes daily rows, a
week with no referrals sums to 0, the key is omitted, and a stale agent-typed value survives
instead of being corrected. That is harmless today because **nothing writes either field daily** —
the trade is "cannot correct a value that cannot yet exist" against "silently destroys a 3pt value
that does exist".

**Revisit trigger — not a date, an event:** the first PR that gives either field a daily writer
(the ingest endpoint, or resolution 3's Daily Capture steppers). At that point the omit-when-zero
guard becomes wrong in the other direction and resolution 3 is the honest fix. Whoever lands that
endpoint owns this line.

---

## Flake family — `AgentPlannerPanel.weeknav.test.jsx` was never remediated by #899 (banked 2026-08-26, daily-call-fields PR #909, MEDIUM — test-infra)

**A named next target, with evidence rather than suspicion.**

`lint-and-build` went red on PR #909 at commit `19201d99` — a **docs-only** commit, `docs/FOLLOW_UPS.md`, 21 insertions, zero `src/`. The failure:

```
FAIL src/components/planner/__tests__/AgentPlannerPanel.weeknav.test.jsx
  > AgentPlannerPanel — week navigation > navigation is unlimited — three weeks forward keeps stepping
TestingLibraryElementError: Unable to find an element by: [data-testid="planner-week-label"]
Test Files  1 failed | 380 passed (381)
```

A docs-only diff cannot break the planner, and the same suite had already passed twice on earlier commits of the same branch (and 6053/6053 locally). Re-run: PASS. Flake, not regression.

**The useful part is WHICH file.** #899 fixed `AgentPlannerPanel.test.jsx`. This is its sibling `AgentPlannerPanel.weeknav.test.jsx` — same component, same mocked-`services/*`-promise-into-multi-commit-render shape, and it carries **`flushPendingEffects` 0 times** where the remediated sibling carries it **4 times**:

```
src/components/planner/__tests__/AgentPlannerPanel.weeknav.test.jsx:0
src/components/planner/__tests__/AgentPlannerPanel.test.jsx:4
```

So the remainder is not merely "unruled" — for this member it is precisely locatable: the fix was applied per-FILE, not per-COMPONENT, and the sibling was missed. That makes it the cheapest next remediation in the family, and it suggests an audit worth running once: **every test file whose sibling received `flushPendingEffects` but which did not itself.**

**Falsification (Rule 23):** overturned if `weeknav` is shown to fail for a reason unrelated to the awaiting-pattern shape (its own `getAgentWeek` mock resolving differently, say), or if `flushPendingEffects` is shown to be inapplicable to its gate. **Not** overturned by the re-run passing — intermittency is the claim, not the counter-argument.


---

## Linked call sources — decision 5 is an INFERENCE, not an operator ruling (MEDIUM, banked 2026-08-26, slice A / PR #915)

**The claim:** a role change does **not** revoke a call source. If an agent with a linked
assistant is promoted to unit manager, the link keeps crediting them; the manager UI shows a
warning when `creditUid`'s role is not `agent`, and a human decides.

**Why it is flagged rather than settled.** The brief states this plainly as an *inferred
extension* of the operator's ruling on deactivation, not something the operator said. The
deactivation ruling was explicit and one-way ("deactivating revokes; reactivating does not
restore"); nobody ruled on promotion. The inference is that auto-revoking on promotion would
**silently stop capture** — the agent's assistant keeps dialling, the KPIs quietly stop
moving, and nothing announces it. That failure is worse than a stale link, because a stale
link is visible in the list and a stopped capture is not.

**What is built:** the warning only (`cs-role-warning` in `CallSourcesTab`). No auto-revoke,
no role-change hook, no scheduled sweep.

**Falsification (Rule 23):** overturned if the operator rules that a promoted agent's inbound
links must auto-revoke — in which case the hook belongs next to the `deactivateUser` one and
the warning becomes redundant. Also overturned if Tatil's practice turns out to be that a
promoted agent's assistant is *reassigned* rather than retained, which would make the stale
link the common case rather than the rare one. **Not** overturned by the warning being
ignored in practice; that argues for a stronger affordance, not for auto-revoke.

## Linked call sources — no ingest, so nothing exercises `tokenHash` or `lastUsedAt` yet (LOW, banked 2026-08-26, slice A / PR #915)

Slice A mints and stores a SHA-256 `tokenHash` and initialises `lastUsedAt: null`, but **no
code reads either field** — the ingest endpoint is slice B. Two consequences worth recording
now, while the reason is fresh:

1. **The hash's correctness is asserted only in unit tests**, against `hashToken` from the
   same module that wrote it. That is a consistency check, not an interop check. The first
   real test of the scheme is slice B presenting a token and finding the right doc.
2. **`lastUsedAt` is dead until slice B writes it.** It is in the shape because the
   `kioskTokens` precedent has it and adding a field to a live collection later is more
   expensive than carrying an unused null. If slice B does not end up writing it, remove it
   rather than leaving it permanently null.

**Falsification:** overturned the moment slice B lands and exercises both fields end to end.

## Linked call sources — createCallSource TOCTOU on a deactivating user (LOW, banked 2026-08-26, slice A / PR #915)

`createCallSource` reads the credit user, checks `active !== false`, then writes the source as
two separate operations. If `deactivateUser` lands **between** them, the new link is created
*after* `revokeInboundLinks` has already swept — so it stays **active indefinitely**,
crediting KPIs to an offboarded agent. Decision 2 exists precisely to prevent that state.

**Why it was not fixed in slice A.** The window is roughly one Firestore round trip, and it
needs a manager creating a link at the same moment an admin offboards the same agent. The
`active` check that DID ship closes the ordinary case (linking someone offboarded earlier).
Making it airtight means doing the read and the write in one `runTransaction`, which is a
heavier change than the brief scopes. Raised by CodeRabbit on PR #915 and dispositioned
IMPLEMENT-in-part with this residual banked rather than left unstated.

**The residual does not self-heal.** Nothing re-sweeps; the link survives until someone
notices it in the list, or until the *next* deactivation of that user. Whoever builds slice B
(ingest) should consider whether the ingest path re-checks `creditUid`'s `active` at read
time, which would neutralise this without a transaction — a token that resolves to a
deactivated user simply fails closed.

**Falsification (Rule 23):** overturned if slice B's ingest checks `active` on the credited
user (making the stale link harmless), or if `runTransaction` is adopted here. **Not**
overturned by the race being rare — rarity is the reason it is LOW, not the reason it is closed.

## Call sources — a PRODUCING MANAGER has no way to attach their own (MEDIUM, banked 2026-08-26, slice A-prime / PR #919)

Self-service put the Call Sources tab on `AGENT_NAV` and removed it from `ManagerDashboard`
entirely, per the brief's explicit instruction ("move the tab off ManagerDashboard to the
agent's own surface" / "remove the manager nav entries added by #915"). That is right for the
*manager-viewing-an-agent* case the operator ruled out.

**But a unit manager and a branch manager are PRODUCING managers — they carry their own KPIs**
(the whole "My Production" nav section exists for exactly that), and the callable now permits
them: decision 3 removed the role gate, so any signed-in user with a tenant user doc may
create their **own** link. A UM/BM calling `createCallSource` today would succeed. They just
have no UI to do it from, because UM/BM route to `ManagerDashboard`, not `AgentDashboard`.

**This is the same shape as the defect CodeRabbit caught on #915** — permitted by the callable,
unreachable in the UI — only mirrored. It was not fixed here because fixing it means adding a
nav entry the brief explicitly told this slice to remove, and the operator's ruling ("each
agent attaches their own calling software") does not say whether a producing manager counts as
"an agent" for this purpose. That is a product question, not an implementation one.

**The fix, if the ruling goes that way,** is one entry in `PRODUCING_MANAGER_NAV`'s
"My Production" section plus the matching `activeTab === 'call-sources'` case in
`ManagerDashboard` — the component itself needs no change, since it already scopes everything
to `user.uid`.

**Falsification (Rule 23):** overturned if the operator rules that producing managers do not
attach calling software (in which case this is correct as shipped and the entry should be
closed, not built). **Not** overturned by nobody complaining — a UM who cannot find the screen
does not file a bug, they just never use the feature.

## Call sources — the owner-scoped list has no orderBy, deliberately (LOW, banked 2026-08-26, slice A-prime / PR #919)

`CallSourcesTab` queries `where('creditUid','==',uid)` with **no `orderBy`**, and sorts newest-first
in JavaScript. Firestore requires a **composite index** for an equality filter combined with an
`orderBy` on a different field, and `firestore.indexes.json` was outside this brief's scope-lock
and outside its named deploy (`--only functions,firestore:rules`). Adding one would have meant a
third deploy target for a collection where a single agent realistically holds 1–5 documents.

**When this stops being right:** if a single `creditUid` ever accumulates enough links that
fetching them all is wasteful, or if the list needs server-side pagination. Both are far away —
an agent attaches their calling software once and revokes it rarely.

**Falsification:** overturned by a real volume case, or by `firestore.indexes.json` gaining a
`(creditUid ASC, createdAt DESC)` index for another reason, at which point the `orderBy` should
be restored and the client-side sort deleted rather than left as dead belt-and-braces.

## ~~`ingestCallActivity` deploy + staging smoke~~ RESOLVED 2026-08-27 (was HIGH, banked 2026-08-26, slice B / PR #923; closed by PR #924)

**RESOLVED 2026-08-27 02:01 UTC — the deploy ran.** `firebase deploy --only functions` completed
exit 0 with `functions[ingestCallActivity(us-central1)] Successful create operation`, and the state
was confirmed against Google rather than the CLI summary (per step 3 below):

```
ingestCallActivity      updateTime 2026-08-27T02:01:05.698Z   ACTIVE
aggregateDailyToWeekly  updateTime 2026-08-27T02:01:06.374Z   ACTIVE
```

Both are post-squash (`0a6d8e9c`), so the guard retirement is live in the cron as well as the
endpoint. A live probe confirms the auth boundary in production: no token, a garbage bearer token
and a malformed `Basic` header all return **HTTP 401 with an identical empty body** — failing closed
and indistinguishably, so nothing leaks whether a token exists. Nothing was written; all three were
rejected before Firestore was touched.

**FULLY RESOLVED 2026-08-27 — the smoke has now run too (PR #924, squash `365252dc`).**
`scripts/verification/smoke-ingest-call-activity.mjs`: **12 PASS / 0 FAIL** against the staging
project. The two legs that close this entry:

```
idempotent-live             replay did not double-count (dials still 9)
concurrent-idempotent-live  two simultaneous deliveries moved dials once (9->10); 200/200
```

Firestore itself has now adjudicated the idempotency guard. Until that run it rested entirely on a
transaction fake — a fake that models optimistic concurrency well, but a model of Firestore rather
than Firestore. The concurrent leg is the one that reds a check-then-write implementation, and it
passed against the real thing. Also proven live: one call moves `dials`, the mapped bucket and
`telContacts` by exactly one; an unknown outcome is a loud 400 rather than a silent zero; and
`creditUid` in the payload is refused rather than ignored.

**The smoke could not run until a code change landed, and that is the finding worth keeping.**
`TENANT_ID` was hardcoded to `tatillife_south`, so a token minted in staging (tenant `staging_test`)
resolved against `tenants/tatillife_south/callSources/…` — absent in the staging project — and 401'd
indistinguishably from a forged token. This entry's sibling rated that MEDIUM as "a second tenant's
tokens would 401 — failing closed, but silently". **That rating was too generous:** the real
consequence was that the endpoint could not be exercised anywhere except PRODUCTION, which made a
staging-only smoke impossible by construction. A constant that makes a feature untestable outside
production is not a deferred nicety. Now `process.env.AGENCYTRACK_TENANT_ID || 'tatillife_south'`,
with the default deliberately byte-identical so production cannot drift; verified after the
production deploy that `functions/` holds no `.env.agencytrack-2a610`, so the default really is what
production runs.

**Deployed to BOTH projects** — production `updateTime` 2026-08-27T12:29:06.928Z ACTIVE, staging
02:25:27.031Z ACTIVE. Production re-probed after the change: still HTTP 401 on no-token and on a
garbage token.

⚠ **Residual, and it is NOT this entry:** ingest is idempotent but **not reversible** — there is no
undo for an increment. The synthetic staging agent's `dials` went 6 → 10 across smoke runs. Expected
on a synthetic tenant; it would not be acceptable against real agents, which is why this smoke is
guarded to refuse any host or project but staging.

The original entry follows, kept because its reasoning about WHY the deploy was withheld remains the
correct standing rule for the next slice of this shape.

---

**⚠ EVERYTHING BELOW THIS LINE IS THE PRE-DEPLOY TEXT, PRESERVED AS WRITTEN ON 2026-08-26.** Its
present-tense claims ("exists in no Firebase project", "until it does") were true when written and
are FALSE now — see the resolution above. Read it for the reasoning, not for the state.

`functions/callActivity/ingestCallActivity.js` ships as code with this PR. **Merging does not
deploy it** — Cloud Functions change production behaviour only when `firebase deploy --only
functions` actually runs, which is a dispatcher action under Rule 19. Until it does, the endpoint
exists in **no** Firebase project and the KQM Calls side (slice C) has nothing to POST to.

**Why CC did not run the deploy itself, beyond Rule 19.** The brief names `firebase deploy --only
functions` as a deliverable, and CLAUDE.md § Workflow does carve out pre-merge deploys for
*additive* Cloud Functions — a new export qualifies. But this PR is **not purely additive**: it also
changes `functions/aggregators/dailyToWeekly.js` (the `serviceCalls` omit-when-zero retirement), and
the Sunday cron is an **existing caller that exercises the changed behaviour**. That is exactly the
case the carve-out excludes ("modifications where existing callers exercise the new behavior →
post-merge only"). A blanket `--only functions` would ship the aggregator change to production
before the PR merged. `firebase use` reports the active project as **`agencytrack-2a610`, i.e.
PRODUCTION**, so there is no accidental-staging safety net either.

**The deploy sequence, when dispatched:**
1. Merge the PR, then `git fetch origin && git pull origin main` so the worktree HEAD matches
   `origin/main` (the standing `firebase deploy` pre-flight).
2. `firebase deploy --only functions`.
3. Verify the NEW function with `gcloud functions describe ingestCallActivity --region us-central1`
   rather than trusting the CLI summary — the deploy log emits `failed to update` warnings it never
   withdraws. Confirm `ACTIVE` and a post-squash `updateTime`.
4. Confirm `aggregateDailyToWeekly` also shows a post-squash `updateTime`: the guard retirement is
   inert until the cron itself is redeployed.

**The staging smoke is a SEPARATE owed item and must run against `agencytrack-staging`, never
production.** It mints a real token and writes real KPI numbers onto a real agent's daily doc, which
is precisely what must not be rehearsed on the live tenant. Sequence: `firebase use staging` →
deploy → mint a token through the staging UI → POST one call → confirm the agent's daily numbers
move → `node scripts/verification/cleanup-staging-call-sources.mjs`. This inherits the smoke debt
already recorded for slices A and A-prime, which have still never been exercised against any
Firebase project.

**What is NOT owed, and the distinction matters.** Only the ENDPOINT half of the PR is deploy-gated.
The aggregator half is not: `src/lib/schema/dailyActivity.aggregator.js` is imported by
`src/services/loggingModeService.js:80` and run by `DailyCaptureV2.jsx:788` on the Daily Capture SAVE
hot path, so the `serviceCalls` omit-when-zero retirement takes effect the moment Vercel redeploys,
with no `firebase deploy` involved. That half was smoked before merge —
`scripts/verification/smoke-service-calls-guard-retirement.mjs`, 20 PASS / 0 FAIL / 0 SKIP in both
themes, negative-controlled. Reading "deploy-gated" as "the whole PR is inert until deployed" would
be wrong, and is exactly the kind of half-true summary that gets a merge treated as lower-risk than
it is.

**Falsification (Rule 23):** overturned if a deploy record shows `ingestCallActivity` ACTIVE with a
post-squash `updateTime` AND a staging smoke log shows a daily doc moving. Not overturned by the PR
being merged, and not by CI being green — neither touches Firebase.

## The `referralsObtained` half of the omit-when-zero guard is still open (MEDIUM, banked 2026-08-26, slice B / PR #923)

Slice B retired **half** of the PR #909 omit-when-zero guard. `serviceCalls` is now always written
by both aggregator twins, because `ingestCallActivity` gives it a daily writer and the guard's own
stated exit condition was "the moment a daily source populates it".

`referralsObtained` keeps its guard, deliberately. Slice B does **not** write it: a KQM referral
outcome (`referred_to_board_pta`, `referred_to_person`, `not_decision_maker`) maps to
`newNamesAdded` — the new prospect the call produced — and not to a referral credited on the weekly
report. Those are different quantities and collapsing them would inflate a 3-point field. This is
asserted mechanically, not just in prose: `outcomeMap.test.js` fails if `WRITABLE_FIELDS` ever
contains `referralsObtained`.

**The trigger for retiring the other half** is the same as this one's: something must write
`referralsObtained` DAILY. Per `docs/CONTEXT.md` that is slice D (Daily Capture steppers for
`serviceCalls` / `referralsObtained`). Whoever lands D owns this retirement and should delete the
remaining `...(referralsObtainedTotal > 0 ? ... : {})` spread in **both** twins
(`functions/aggregators/dailyToWeekly.js` and `src/lib/schema/dailyActivity.aggregator.js`) plus the
guard tests in both suites.

**Note the corrected sequencing.** CONTEXT.md and the bridge design both sequenced the whole
retirement after slice C. That was wrong and slice B's brief corrected it: the trigger condition is
a daily writer, and B is the daily writer. The same reasoning now applies to the remaining half —
it retires when a writer appears, whichever slice that turns out to be, not on a slice letter.

**Falsification:** overturned if a daily writer for `referralsObtained` lands, or if the operator
rules that a KQM referral outcome SHOULD credit `referralsObtained` — in which case the mapping
changes and the guard retires with it, and this entry closes as superseded rather than done.

## `ingestCallActivity` resolves tokens against a HARDCODED tenant (MEDIUM, banked 2026-08-26, slice B / PR #923)

The request carries a bearer token and **no tenant**, so the natural resolution shape is
`collectionGroup('callSources').where('tokenHash','==',h)`. `functions/callActivity/resolveCallSource.js`
does **not** do that — it queries `tenants/{TENANT_ID}/callSources` with `TENANT_ID` hardcoded to
`tatillife_south`, matching `functions/index.js:57` and `functions/aggregators/sundayDailyToWeekly.js`,
both of which carry the same SEC-9c note.

**Two reasons, and the second is the load-bearing one.** First, a collection-group query needs a
**COLLECTION_GROUP-scoped single-field index**, which Firestore does not create automatically —
`firestore.indexes.json` currently has `"fieldOverrides": []` — and `firestore.indexes.json` was
outside slice B's scope-lock and outside its named deploy target. Second, the whole `functions/`
tree is single-tenant already; a query that *looked* tenant-agnostic while every neighbouring
function hardcodes the tenant would be misleading rather than future-proof.

**What this costs when multi-tenancy lands (SEC-9c):** a second tenant's tokens would resolve to
`unknown_token` and their calls would 401 — failing CLOSED, which is the right direction, but
silently from the caller's point of view. The fix is a package, not a line: add the collection-group
`fieldOverride` for `tokenHash`, deploy `--only firestore:indexes`, switch the query, and add a test
that a token from tenant A does not resolve under tenant B. There is already a test asserting the
current tenant-path scoping (`resolveCallSource.test.js`, "does not resolve a token belonging to a
different tenant path") which will need rewriting rather than deleting.

**Falsification:** overturned by SEC-9c landing, or by any second tenant being provisioned — at
which point this stops being a deferred generalisation and becomes a live defect.

## ~~The KQM outcome × campaign cross-product is unrestricted~~ RESOLVED 2026-08-27 (slice C2 / PR #926)

**RESOLVED BY DELETING THE CROSS-PRODUCT, not by restricting it.** This FU asked for a per-campaign
allowed-outcome set "once slice C's real vocabulary is known". The vocabulary became known on
27 August, and the answer it gave was that AgencyTrack must not hold KQM's vocabulary at all: about
a hundred outcome values across five campaigns, every campaign code carrying a `_2026` suffix, and a
database trigger that seeds a fresh vocabulary each time somebody creates a campaign. A per-campaign
allowed-outcome set would have been a table that goes stale the first time an agent adds a campaign.

C2 removed `CALL_OUTCOMES`, `CAMPAIGN_LANES` and `mapCall` entirely; KQM normalises to effects
(lane, bucket, four booleans) and AgencyTrack validates them. There is no pairing left to be odd,
because there are no outcomes and no campaigns in this repo to pair. `rawOutcome`/`rawCampaign` are
stored on the ingest record for tracing and are scored by nothing.

**The prediction this FU made was right and the remedy it proposed was wrong** — worth keeping,
because the FU reasoned correctly from the vocabulary being narrower than the cross-product and did
not consider it being much WIDER. Original body follows.

### Original body (LOW, banked 2026-08-26, slice B / PR #923)

`functions/callActivity/outcomeMap.js` keeps two orthogonal tables — the outcome says what happened,
the campaign says which lane it lands in — and `mapCall` accepts **any** legal pairing of the two.
That orthogonality is what makes operator decision 4 mechanical rather than a remembered special
case, and it is deliberate.

It does, however, admit semantically odd pairs. `portfolio_review_booked` in a `schools` campaign
would write `dials + telContacts + appointmentsSet + ffisScheduled`; a non-portfolio outcome in the
`portfolio` campaign writes the servicing lane. Neither is wrong arithmetically — every one still
satisfies the partition property — and no caller has a reason to send them, but nothing rejects them
either.

**Why it was left open rather than closed.** The operator's table names ONE portfolio row
("Portfolio - review booked"), while decision 4 states the portfolio rule generally ("writes
`serviceCalls` (attempted) and `serviceContacts` (reached)"). Restricting outcomes to campaigns
would mean a Portfolio call that simply got no answer had **nowhere to go** and would 400 — a
data-loss shape, and a worse failure than an odd-but-harmless pairing. Generalising was the reading
that lost no calls.

**When to close it:** if slice C's real campaign/outcome vocabulary turns out to be narrower than
the cross-product, add a per-campaign allowed-outcome set to `CAMPAIGN_LANES` and reject the rest —
but only once the true vocabulary is known, so the restriction is derived from the caller rather
than guessed ahead of it.

**Falsification:** overturned if a real KQM payload arrives with a pairing that maps to a number the
operator considers wrong. Not overturned by the pairings merely looking odd in the table.

## `WRITABLE_FIELDS` is a drift guard, not an allow-list (LOW, banked 2026-08-27, slice C2 / PR #926)

`functions/callActivity/outcomeMap.js` derives `WRITABLE_FIELDS` from the effect table and its
slice-B comment said the endpoint "uses it as a write allow-list". It does not, and it did not in
slice B either: `ingestCallActivity.js` has never imported it. What the constant actually buys is a
test in `outcomeMap.test.js` that fails if the mapping grows a field absent from
`src/lib/schema/dailyActivity.js`, or one outside the call surface. That is real value, and the
tests were kept.

C2 corrected the comment rather than making the claim true, because wiring it into the transaction
is a behaviour change and C2's scope-lock did not include one.

**The fix, when it is wanted:** in `applyCall`, after `mapEffects`, assert that every key of
`increments` appears in `WRITABLE_FIELDS` and throw otherwise. Three lines, and it converts a
test-time guarantee into a runtime one. The cost is a new throw path on the hot path of a public
endpoint, which is why it wants its own slice and its own smoke rather than a drive-by.

**Why it is LOW rather than nothing.** The increments come from a frozen table in the same module,
so today the assertion could not fire. It earns its keep only if a future edit makes the emitted
field set data-driven from something less trustworthy than a literal.

**Falsification:** overturned if `WRITABLE_FIELDS` acquires a runtime consumer, or if the effect
table stops being the only source of the increment keys — at which point this becomes a live gap
rather than a tidy-up.


## PR #936 preview smoke — waived, deferred verification owed; and the FortiGate finding behind it is its own item (banked 2026-09-03, post-merge fill)

**Rule 13 waiver.** PR #936 (medical limits move to the September 2026 schedule) merged with its
preview smoke **NOT RUN**, not merely skipped. The PR body and this entry together are the waiver
artifact:

> Verification waived because `*.vercel.app` is TLS-intercepted by a FortiGate appliance on the
> operator's machine, so `VERCEL_BYPASS_TOKEN` cannot be sent to a preview host without disabling
> certificate verification — which was refused as a workaround of a security control rather than
> attempted, per CLAUDE.md § Banked patterns ("if a tool mechanism forces a token into a string
> param: STOP and surface, never work around").

**Unverified criteria, copied verbatim from the PR body's smoke section:** boot · sign-in · both
themes render · no console errors · no failed network requests, against the live preview at
`https://agencytrack-p0x3pdi81-kyron-marchan-s-projects.vercel.app` (or the current preview alias
for the branch, since the per-deployment URL above may no longer resolve after further pushes).

**Why the waiver is low-risk for THIS PR specifically, not in general.** `dist/assets/*.js` was
grepped on the merged branch and returned zero hits for `determinedAtUnderwritingFrom`,
`assumesNoOtherCover`, `ageNextBirthday`, `Lipid Blood Profile` and `Non-Medical` — nothing in
`src/` imports `requirementsFor` / `headroomFor` / `bandFor` yet, so the whole module and both
medical-limits tables are tree-shaken out of the production bundle. A smoke against this exact
diff could only have re-proven that the app still boots, which the green `lint-and-build` CI check
(full build + full 6,224-test suite) already establishes independently of any browser.

**Re-run instructions, for whoever next needs a real preview smoke verified (this PR or the next
one that touches this module and DOES get a consumer):**

1. Confirm the TLS path first, before assuming the blocker is gone: open a `TcpClient` to the
   preview host on 443, wrap in `SslStream` with an always-true validation callback, authenticate,
   and print `RemoteCertificate.Issuer`. If it reads `O=Fortinet`, the blocker is still live — do
   not attempt `ignoreHTTPSErrors: true` as a way past it. (The full finding is banked in the
   dispatcher's cross-session memory as `env_fortinet_tls_vercel_previews` — not a file in this
   repo — so ask the dispatcher for current network state rather than searching `docs/` for it.)
2. If clear, run `node scripts/verification/smoke-medical-limits-september.mjs <preview-url>` —
   the script exists and is read-only by construction (asserts boot/login/theme/console/network
   only; a feature-branch preview runs against PRODUCTION Firebase per CLAUDE.md § Workflow, so it
   deliberately makes no writes). It was written for PR #936 but never committed, to keep that PR's
   `src/`-only scope lock — recreate it from the PR's description if it is not sitting in a
   scratchpad, or pull it from PR #936's conversation history.
3. If the FortiGate interception is confirmed STILL present on a future cycle, escalate rather than
   re-waiving indefinitely: **check whether `VERCEL_BYPASS_TOKEN` should be rotated**, since every
   past preview smoke from this machine has crossed the same intercepted connection, repeatedly,
   in plaintext, into the appliance's logs. That is a standing exposure this waiver does not close.

**Falsification:** overturned the moment a smoke runs clean from an uninspected network path, or
the token is confirmed rotated and a fresh smoke passes — either closes this entry. It is NOT
overturned by this module later gaining an importer without a smoke also running; that would be a
NEW, higher-stakes gap (an unverified change that DOES reach the bundle), not a resolution of this
one.

---

## Persistency — the per-policy 24-month lapse window (Slice P3, DESIGN ONLY, banked 2026-09-08, MEDIUM — gated on Tatil's process document)

Recorded by the Persistency 24-Month Model brief's Slice P2 (which is a docs-only append, not a build — P3 itself is explicitly not built). Source: Tatil Life inter-departmental memo "Introduction of the Updated 24-Month Persistency Model" (A. Rauseo, 29 Aug 2026). The memo's aggregate formula (Net Gross Settled / Net Settled / Persistency) shipped in Slice P1 (#937/#938). This entry is the one piece the memo describes but does not specify precisely enough to build: the per-policy 24-month lapse-inclusion window.

**What the memo says, verbatim in substance:** a policy that lapses before 24 months hurts persistency; how long it hurts depends on the number of premiums paid before lapse; it stops affecting persistency once it reaches the equivalent of 24 months of premiums paid **or** exceeds 24 months from the month of its Issue Date, whichever comes first; the 24-month check is reckoned from the month of the Paid-To-Date, not the Lapse Date.

**Why this is not built:** the paragraph is internally ambiguous and the memo itself promises a follow-up process document that does not exist yet. Building money-affecting arithmetic from an ambiguous paragraph is the exact mistake the original R-07 FOLLOW_UP (Persistency v2 calc methodology, see above) forbade, and this is a different instance of the same risk.

**What the app's data model has today, and what it's missing:**
- The policy ledger already carries `dateIssued` (stamped at settlement), `status: lapsed`, and `lapsePolicy`.
- It does **not** carry `paidToDate` or a premium count. Both are needed for the memo's lapse rule and neither is entered anywhere today.

**The rule to encode, once the process document arrives:** a lapsed policy stays in the Lapses term until `min(month it would have reached 24 premiums paid, issueMonth + 24)`, with the 24-month check reckoned from the Paid-To-Date month.

**Open question for Tatil, to be asked verbatim:** *"Is the 24-month cut-off `paidToDateMonth − issueMonth >= 24`, or `paidToDateMonth + (24 − premiumsPaid)`?"* — the two readings of the memo's last sentence give different answers for the same policy.

**Until then:** the app's persistency numbers are what managers and agents transcribe from Tatil's monthly report, exactly as today. The app does not compute persistency from the policy ledger, and no brief has changed that.

**Action:** none until Tatil delivers the process document. When it lands, requirements-gather against this entry's data-model gap (add `paidToDate` + premium count to the policy write path) before writing any lapse-window arithmetic. Attended-only, money-correctness-critical — same category as R-07 above.

**Falsification:** overturned if a consumer is found computing persistency from the policy ledger today (none was found — `grep`-verified during Slice P2's Phase 1) — that would mean this entry's "nothing branches on the ledger yet" premise is already wrong and the design needs revisiting before, not after, the process document arrives.

---

## Company Config has no generic plain-value surface — `mode: 'plain'` means activity standards only (banked 2026-09-08, Persistency P5, MEDIUM)

**The gap.** `companyConfigRegistry.js`'s `storage.mode: 'plain'` reads as a general "store this value in a config doc" mode. It is not. Every part of the read/render path is hardcoded to the ONE existing plain item family, manager activity standards:

- `useCompanyConfigState.js:111-116` — `baseValue()`'s `mode === 'plain'` branch calls `storedRoleMap(docs.managerActivityStandards, item.storage.keyPath)`. It **ignores `item.storage.docId` entirely** and always reads `managerActivityStandards`, treating `keyPath` as a role key. A boolean item at any other docId therefore resolves to `{}` — an empty object, not its default — because `storedRoleMap` always returns an object.
- `useCompanyConfigState.js:133-136` — `rowState()`'s plain branch has the same shape assumption (`Object.keys(baseValue(id)).length`), so a scalar can never read as `custom`.
- `useCompanyConfigState.js:222-227` — `saveAll()` passes the literal `'managerActivityStandards'` to `savePlainValues` / `resetPlainValues`. A draft on any other docId is silently written to the wrong document.
- `CompanyConfigSurface.jsx:297-327` — only `type: 'standards'` renders an editable control; the comment says so in as many words ("the one editable registry-control type this run"). Everything else renders read-only. The single existing `type: 'toggle'` item (`dat.export`, registry line 638) is `lock: 'soon'` with **no `storage` key at all** — decorative, never wired to a read or write path.
- `ConfigProvider.jsx:28` — `HYDRATED_DOC_IDS` is a fixed three-element array. A new config docId is not fetched at all, so a registry entry pointing at one would read `undefined` regardless of the above.

**Why it is banked and not fixed.** Persistency P5 needed exactly this: one tenant-settable boolean. The brief originally specified a new `persistencySettings` doc plus a registry entry, on the premise that the line-69 `mode: 'plain'` shape generalises. Phase 1 showed it does not. The dispatcher's amendment (7 Sept 2026) redirected P5 to store `orphanAdoptionEntersDenominator` on the **already-hydrated** `companyMinimums` doc and read it directly in `PersistencyPlayground.jsx`, with **no registry entry and no UI row** — deliberately routing around this gap rather than widening P5's blast radius into three shared admin-surface files.

**Consequence while open.** Any future tenant-settable scalar has the same three bad choices P5 had: bypass the Company Config surface entirely (what P5 did — the setting is real and read at runtime, but a tenant admin cannot see or change it in the UI, only a direct Firestore write can), add another bespoke item type, or do this generalisation first. The cost compounds quietly: each bypass is invisible in the surface that is supposed to be the single place a tenant admin looks.

**Shape of the fix.** Make `mode: 'plain'` mean what its name says — key the read off `item.storage.docId`, return the scalar-or-map the item declares, generalise `saveAll`'s docId, add a real editable boolean control, and make `HYDRATED_DOC_IDS` derive from the registry rather than being hand-maintained. Not started; no PR.

**Falsification.** Overturned if a live, editable, non-`standards` config item is found reading or writing correctly through this path today — that would mean the generic support already exists and only the P5 entry was mis-specified. None was found: `grep`-verified during P5's Phase 1 that `type: 'standards'` is the sole editable branch and `dat.export` is the sole `toggle`, locked and storage-less.

---

## "On pace" has no derivation - the branch-scene stat the mockup asks for - RULED (banked 2026-09-09, Track J report-scopes brief, MEDIUM - operator ruling needed, NOT started)

> **RULED 2026-09-09 by the operator.** Two counts, not one: (A) above the tenure Company Floor, (B) on the agent's own Game Plan target - both always year-to-date, both pro-rated from the later of 1 January and `contractStartDate`, with no-plan agents excluded from B's numerator and denominator and the excluded number stated on the surface. The full rule, including the "do not silently change the Agent progress bar" constraint, is in `docs/briefs/track-j-report-scopes-kickoff.md` section 3.1. The weekly activity floor was rejected as a candidate: it is an ACTIVITY floor and this is a PRODUCTION report. The agent-selectable third benchmark was cut to its own entry below. **The question text below is retained as the record of what was asked, not as an open item.**

**The ask.** The `branch` scene of `docs/design-system/screens-v2/AgencyTrack Production Report v2.html` (artboards 03 Light / 04 Dark, `role="branch" period="week"`) puts an **on-pace count** alongside the branch totals and the all-agent ranking - how many of the branch's ~28 agents are on pace.

**The gap.** There is no such derivation in the repo. `lib/productionReport/computations` exposes `filterSubmissionsByPeriod`, `computeAgentTotals`, `computeUnitAggregates`, `computeBranchAggregates`, `rankAgentsByApi`, `computeComplianceStats` and `deriveProductionDataSource` - none of them answers "is this agent on pace". `BranchManagerProductionView.jsx` does not compute it and does not render it. The mockup supplies a label, not a rule.

**Why this is banked rather than built.** Same shape as the Master Sheet STATUS work in #871, where the "Gone quiet" band had no in-repo derivation and `MeetingMode.helpers.js:97-101` explicitly declines to derive it. #871 did not invent a recency threshold; it omitted the chip and sent the question to the operator, and that omission is still awaiting a ruling against the banked six-band taxonomy. A pace figure on a production surface is money-adjacent and role-visible - a wrong threshold does not read as wrong, it reads as an agent who is fine when she is not.

**The question for the operator, verbatim, so requirements-gathering starts from it rather than from a guess:**

> An agent is "on pace" measured against WHICH target, and over WHICH window?
>
> 1. The tenure-based Company Floor (`tenureFloors.resolveAnnualAPIFloor`, what `AgentProductionView` already renders a progress bar against), pro-rated to the elapsed part of the year?
> 2. The tenant-wide weekly activity floor (`companyMinimums.weeklyActivityFloors`, the 4800 API default the Daily Capture strip uses)?
> 3. The agent's own Game Plan target for the period (`yearPlan`, the 3-line canonical from PR-U1)?
> 4. Something else the branch manager reads today outside AgencyTrack?
>
> And is the window the selected period on the toggle, or always year-to-date regardless of what the toggle says?

**Note that 1 and 3 can disagree for the same agent in the same week** - the floor is a company minimum, the game plan is her own commitment, and an agent can be above one and below the other. That disagreement is the reason this cannot be picked by the builder.

**Consequence while open.** Slice R2 of `docs/briefs/track-j-report-scopes-kickoff.md` builds the four-window period grid and the unit top-performers rail without the stat, and records it as a scoped-out mockup element in the ledger row - the same disposition Planner scenes 6 and 8 carry (`docs/track-j-port-ledger.md` § Absorbed rows). It is a decision to re-ratify, not a defect.

**Falsification.** Overturned if a pace or on-track derivation already exists under another name and only needs surfacing. Candidates deliberately checked and rejected as different things: `utils/planVariance.js` and `lib/monthlyVarianceChips.js` (plan-vs-actual variance for the agent's own game plan, not a branch-wide count), `GamePlanV2/SuggestedWeekCard.jsx` pace copy (per-agent, forward-looking suggestion), and `computeComplianceStats` (report-filing compliance, not production pace). If one of these is what the head of sales means by "on pace", the ruling is a pointer, not a new formula - which is itself a good outcome.

---

## Agent-selectable pace benchmark - the third yardstick (banked 2026-09-09, Track J R2 ruling, MEDIUM - needs its own brief, NOT started)

**What the operator wants.** Alongside the two objective pace yardsticks R2 builds (the tenure Company Floor and the agent's own Game Plan target), an agent should be able to **pick one more thing to keep pace with** - an MDRT/COT/TOT threshold, an award she is chasing, a live campaign - and have it surface constantly beside the other two, so all three read together on her own screen.

**Why it was cut from R2 rather than folded in.** Three reasons, all structural:

1. **It is stored state, not a derivation.** Which benchmark she picked has to persist - a field on the user doc plus a matching `firestore.rules` guard. That turns a Vercel-rebuild slice into a manual-deploy one (human-merge + `firebase deploy` by the operator), which is a different class of PR from R2's composition work.
2. **It needs a source of truth that does not exist yet in one place.** The selectable things live in three separate config areas today - MDRT/COT/TOT thresholds, the awards ruleset (`config/awardsRuleset/{year}`, and note render consumers must go through `getMergedAwardsRuleset`), and campaigns (`campaignEngine.js`). A picker needs one enumerated list with a stable id per option, and nothing enumerates them together.
3. **A branch-level count cannot aggregate it.** Counting "agents on pace" across targets each agent chose for herself sums different yardsticks - nine agents on pace against nine different things is not a number a branch manager can act on. So this belongs on the AGENT surface, not in the branch scene's counts. That is a scope boundary, not a deferral of the same feature.

**What the brief will need to settle** (do not pick these here):

- Does the manager's roster show each agent's chosen benchmark as a column, or is it agent-private? A column is readable but re-raises the apples-and-oranges problem one row at a time.
- What happens when the chosen benchmark expires or is retired - a campaign ends, an award year rolls over? A pinned target pointing at a dead id is a silent wrong number, the failure mode this repo keeps correcting.
- Is the pick one-at-a-time or a small set? The operator said "which one they want to surface", which reads as one, but that should be confirmed rather than assumed.
- Does a manager or unit manager get to set or suggest it for an agent, or is it hers alone?

**Precedent to follow.** `orphanAdoptionEntersDenominator` (Persistency P5) is the cautionary one: the setting is runtime-real but has no UI because Company Config has no generic plain-value surface - see that entry above. A per-agent pick is a different storage shape (user doc, not tenant config), so it does not hit that gap, but the lesson holds - do not ship a stored value with no way for its owner to change it.

**Falsification.** Overturned if a per-agent target-selection field already exists on the user doc and only needs surfacing. Not checked yet; that check is the brief's Phase 1, not an assumption to carry.

---

## Flake register — two NEW members enumerated (banked 2026-09-16, MEDIUM — test-infra)

Both were observed during the OIPA portfolio import track (PRs #943 / #945). Neither
appears in the named roster, so the "~10 named members" figure understates the family.
Recorded here because the register asks for confirmed flakes to be enumerable rather
than anecdotal.

### Member: `src/components/wizard/__tests__/WizardFormV2RetirementR2.test.jsx`

Test: `R2 retirement — value-level payload identity (real v2 steps 9/10/11) > fills
Reflection+Goals fields through the real v2 components -> submitReport gets exact values`

- **Signature:** `Test timed out in 5000ms`.
- **Nondeterministic across identical runs.** Two consecutive local full-suite runs on the
  same tree gave **2 failures, then 1**. The count moving with no change is the proof.
- **Passes in isolation in 1287ms** against the 5000ms budget — a ~4x margin.
- **Observed on PR #943**, whose diff was three NEW files under `src/lib/portfolioImport/`
  that nothing imported and that were absent from the production bundle. The diff could
  not reach the wizard suite.
- **Green in CI** on the same commit, so the local red and the CI green disagreed.

### Member: `src/components/admin/__tests__/AwardsRulesetPanel.test.jsx`

Test: `AwardsRulesetPanel — array row editors > editing a row field produces the correct
payload on save`

- **Signature:** `TestingLibraryElementError: Unable to find an accessible element with the
  role "button" and name /Activity Awards/i`.
- **The panel section rendered EMPTY** — the failure dump shows
  `<section aria-labelledby="awards-ruleset-heading" class="card mt-4" />` with no children,
  i.e. the query ran before the collapsible content mounted. This is pattern 2 (a
  multi-render-cycle integration test losing a race), not a missing-element regression.
- **Observed in CI on PR #945** (`lint-and-build`, 1 failed / 6414 passed). That diff was
  two NEW files under `src/lib/persistency/` that nothing imported; `grep` for
  `deriveFromLedger` in the component and its test returns nothing.
- **Green on `gh run rerun --failed` with zero code change** — the cleanest available proof.
- **Passes locally in 332ms.**

### Why this matters beyond bookkeeping

The existing register already notes that a red CI on this repo "no longer reliably
distinguishes a real regression from scheduling noise". These two add evidence that the
population is **under-enumerated**, which is worse than it being large: an unlisted member
gets re-diagnosed from scratch every time it fires, and the first instinct on a red is to
suspect the diff. In both cases here the diff was provably inert, and establishing that cost
real time.

**Both are pattern 2** by the register's own taxonomy, so neither needs a new mechanism —
they extend the known race, they do not contradict it.

### Falsification (Rule 23)

This entry would be overturned if either test can be made to fail **deterministically** on a
frozen tree, or if a diff is found that plausibly reaches it. For `AwardsRulesetPanel` the
stronger disconfirming evidence would be a failure that shows the section rendered WITH
children but under a different accessible name — that would be a real selector regression,
not a race. Neither was attempted here: no burn was run, and the rate for these two members
is **unmeasured**. They are recorded as observed instances, not as a rate.

### What was deliberately NOT done

No fix, no `flushPendingEffects`, no per-test timeout widening. The register's standing
position is that per-test timeout widening is superseded and the mechanism is a race; adding
a fix here would have been a scope expansion into test-infra from inside a parser/derivation
track. Enumeration only.
## P4 must not parse agent-picked files in the browser with `xlsx@0.18.5` (banked 2026-09-16, P2b, HIGH — OIPA import / security)

`xlsx@0.18.5` is a **root devDependency, added for the P2 admin script only**
(`scripts/ops/import-oipa-portfolio.mjs`). It never reaches the web bundle, and its
input there is an OIPA export the operator downloaded themselves.

It carries known **prototype-pollution and ReDoS** CVEs. Both are triggered by parsing
a **malicious** file — which is precisely what P4 would be doing, since P4's whole
premise is an agent choosing a file in a browser and the parse running client-side.

**Before P4 ships:** either pick a maintained parser (`exceljs` is the candidate) or
move the parse server-side into a callable. Do not carry `xlsx@0.18.5` into a browser
path.

**Why it was chosen for P2 anyway, deliberately:** continuity of verification. Every
number in the P0, P1 and P2 paste-backs — 283 rows, 229 docs, the 11-of-11 status
match, the five-row persistency table — was produced through this exact reader.
Swapping readers at P2 would have meant the validated numbers no longer covered the
actual read path. The tradeoff was made knowingly for an admin-only, trusted-input,
non-bundled script, and it does **not** transfer to P4.

**Falsification.** Overturned if `xlsx` ships a patched release covering both CVEs, or
if P4's design changes so the parse never runs on an agent-supplied file in a browser
(e.g. upload-then-parse-server-side), in which case the constraint is satisfied rather
than waived.

---

## ACCEPTED GAP — organic + imported policies are never tested together in one tenant (banked 2026-09-16, P3, MEDIUM — OIPA import)

**This is an accepted gap, not an open task.** It is recorded so nobody re-discovers it
from scratch, and so the decision behind it is visible if P4 changes the filter.

### What IS proven

Both halves of `excludeImported()` are verified live, separately:

- **Imported docs are dropped.** Production, `tatillife_south`: the CRO Delivery Register
  query (`where('status','==','settled')`, tenant-wide) returns **117** settled docs, all
  imported; after the filter, **0**. Zero imported docs survive.
- **An organic doc is kept.** `tatillife_smoke`: a policy created through the real app
  form as `A11Y_AGENT` — real auth, real rules, real `policiesService.validate()` —
  survives the filter, **1 raw settled -> 1 after the filter**.

### What is NOT proven

The two together **in the same tenant**: a CRO register query returning both organic and
imported docs, where the filter must remove one set and keep the other in a single pass.

### Why, and why it stays that way

The only tenant holding imported policies is `tatillife_south` (Kyron's). The only agent
account CC has credentials for, `A11Y_AGENT`, belongs to `tatillife_smoke` —
`A11Y_TENANT_ID` — and has **no user doc in `tatillife_south`** (21 users there, none
matching). So it cannot write a policy into the tenant that has the imported book.

Closing the gap would mean creating a test agent inside `tatillife_south`.
**Operator ruling, 16 Sep 2026: do not.** Such an agent would appear in manager rosters
and on leaderboards — a permanent cost on real operator-facing surfaces, paid to cover a
case whose two halves are each already proven and whose logic is a one-line predicate.

`isTestAccount: true` excludes an account from both leaderboard surfaces but NOT from
manager rosters, so the flag does not neutralise the objection.

### What would make this matter again

**Revisit if P4 changes the filter.** P4 puts an upload in front of agents and runs the
parse client-side, so it is the slice most likely to touch `importSource` tagging or the
exclusion path. Specifically, re-open this if any of the following happens:

- `excludeImported` stops being a simple equality on `importSource`
- a second importer introduces another `importSource` value, making "imported" a set
  rather than one tag
- the exclusion moves from client-side into a Firestore query (the inversion trap in
  `excludeImported.js` becomes live again)
- a tenant ends up holding imported policies for more than one agent

### Falsification

Overturned the moment a legitimate non-test account exists in `tatillife_south` that can
create a policy — a second real agent onboarded to the tenant closes this for free, with
no test data at all. That is the cheap path, and it arrives on its own at pilot.

### Coverage that stands in for it

`src/services/__tests__/policiesService.test.js` asserts the mixed case directly at the
service boundary: imported, organic and legacy (no `importSource` field) docs in one
array, through `getDeliverablePolicies` and all three `getPoliciesForManager` arms. The
gap is "never seen together in a live tenant", not "untested".


---

## `nodejs20` decommission + firebase-functions SDK

**Banked 2026-09-18 (P4b session). DEADLINE: 2026-10-30.**

`functions/package.json` pins `engines.node: "20"` and `firebase-functions: "^4.9.0"`.
Google decommissions the `nodejs20` Cloud Functions runtime on **2026-10-30**. This is a
dated deadline rather than a cleanup item because both halves bite:

- **After decommission a deploy is REFUSED.** Any urgent functions fix after that date is
  blocked behind an unplanned runtime migration, done under pressure.
- **Already-deployed functions stop receiving runtime patches.** They keep running; they
  stop being maintained.

### The two halves, and which one is harder

**Runtime bump (easy):** `engines.node` to `22`, redeploy, smoke.

**SDK bump (the real work):** `firebase-functions@4` is a major version behind. v5/v6
change the callable signature from `(data, context)` to a single `request` object, where
`context.auth` becomes `request.auth` and `data` becomes `request.data`. **Every**
`functions.https.onCall` in `functions/` reads `context.auth` — including the whole
user-management surface, the kiosk and call-source tokens, `setAgentOfMonth`,
`sendComplianceNudge` and both `portfolioImport` callables. It is a mechanical change,
but it is mechanical across every authenticated entry point in the product, and a missed
one fails as `permission-denied` for a real user rather than at build time.

Do the runtime bump and the SDK bump as SEPARATE PRs. Bundling them means a post-deploy
auth failure has two candidate causes.

### Deploy-time gotcha, observed 2026-09-18

The P4a functions deploy failed once with:

```
Cannot determine backend specification. Timeout after 10000
```

and succeeded on a retry with the discovery timeout raised:

```
FUNCTIONS_DISCOVERY_TIMEOUT=120 firebase deploy --only functions:<names>
```

This is firebase-tools loading `functions/index.js` to enumerate exports; the default
10 s budget is not enough for this codebase's require graph on a cold run. It is a
FLAKY failure, not a code fault — the same command succeeded unchanged apart from the
env var. Worth knowing before somebody debugs a deploy that was never broken. Whether
the 2026-09-18 additions (`exceljs`, the dynamic-`import()` bridge) moved the load time
enough to make this the common case rather than the rare one was **not** measured.

### Falsification

Overturned if Google extends the `nodejs20` decommission date — check
<https://cloud.google.com/functions/docs/runtime-support> rather than trusting this
entry's date. Also overturned, for the second half, if the repo moves to
`firebase-functions` v2 API (`onCall` from `firebase-functions/v2/https`) as part of
another track, which would make this a no-op.

---

## Lock `prefs/portfolioImport` to the Cloud Function

**Banked 2026-09-18 (P4a ruling). Operator decision: LEAVE IT for now.**

The per-agent OIPA import config lives at
`tenants/{tenantId}/users/{uid}/prefs/portfolioImport` and holds three lists: per-policy
`overrides`, the `selfOrFamily` flags and `testPolicyNumbers`.

It sits under the existing wildcard in `firestore.rules`:

```
match /users/{uid}/prefs/{prefId} {
  allow read, write: if isSignedIn() && getTenantId() == tenantId && request.auth.uid == uid;
}
```

which is **owner read AND write**. So the agent can edit their own import config from the
browser. An override such as `{ TRM2501670: { status: 'settled' } }` would, on the next
import, flip a lapsed policy to settled — moving that agent's own persistency figure,
which is a number a manager reads and which gates awards.

### Why it was not fixed in P4a

Because closing it is not additive. Firestore rules are **OR'd**, not resolved by
specificity — a narrower `match /users/{uid}/prefs/portfolioImport` with
`allow write: if false` does **not** deny, because the wildcard above still allows. The
only fix is to EDIT the existing wildcard to exclude this one doc id, e.g.

```
match /users/{uid}/prefs/{prefId} {
  allow read: if ...;
  allow write: if ... && prefId != 'portfolioImport';
}
```

That is a change to a rule other features already depend on (`prefs/app` carries
`pinnedNav`, `menuLayout`, `navOrder`, `settings`), plus a `firebase deploy --only
firestore:rules`. The P4a ruling was explicitly "no rules change expected; if one is
needed, stop and tell me", so it was surfaced and deferred rather than done.

### What stands in for it today

Nothing PREVENTS the edit, but nothing hides it either:

- `parseOipaExport` returns `report.importConfigApplied` — the sorted key lists of the
  overrides, self/family flags and test numbers that produced **that** plan. It travels
  with the stored plan, so a plan stays auditable even after the config doc is edited.
- `previewPortfolioImport` returns `overridesApplied` with the from/to status of every
  override, and the P4c review and result screens list them before anybody presses
  Import.

So a moved number is traceable after the fact. It is not blocked before the fact.

### Trigger to revisit

**A second agent using the importer.** Today the only holder of this doc is Kyron, who is
both the agent and the person the figure is reported to, so the abuse case has no
audience. That stops being true the moment an agent imports a book their manager reads.

### Falsification

Overturned if the `prefs` wildcard is narrowed for an unrelated reason (then fold this in
for free), or if the import config moves off `prefs/` entirely — e.g. to a CF-only
`importConfig` doc under a path with no rules block, which is how
`users/{uid}/importPlans/{planId}` already avoids the problem and would need no rules
change at all. That last option was not costed and may be cheaper than editing the
wildcard.

---

## Partial import is unit-tested only

**Banked 2026-09-18 (P4a Rule 22 gap).**

Ruling 2 of the P4 rulings: an agent may import only the policies whose **Servicing Agent
Number** equals their own; the rest are counted as "not yours" and skipped.
`partitionByServicingAgent` in `functions/portfolioImport/identity.js` implements it and
`previewPortfolioImport` returns the count as `counts.skippedNotYours`.

The **partial** case — a file where some rows are the caller's and some are not — has
never run against real data. Kyron's 15 Sep export is 100% his own servicing number
(`skippedNotYours: 0` on the real emulator run), so the only shape that could be produced
end-to-end was the all-or-nothing one: a deliberately wrong agent number made all 229
rows foreign, which `previewPortfolioImport` turns into a `failed-precondition` refusal
("None of the 229 policies in that file are serviced by agent 099Z00") rather than a
partial count.

So the branch that RETURNS a partial `skippedNotYours` alongside a non-empty plan is
reached only by unit tests.

### Coverage that stands in for it

`functions/__tests__/portfolioImportIdentity.test.js` exercises
`partitionByServicingAgent` directly on mixed input: the kept/skipped split, a row with a
null servicing number (skipped, never claimed), exact matching with no case-folding or
trimming, and the assertion that the skipped list carries policy numbers only and never
another agent's client names.

The gap is "never run end-to-end on a real mixed file", not "untested".

### Trigger

The first export that actually contains another agent's rows — which arrives on its own
when a producing manager imports a book holding policies they service but did not write,
or when an agent exports with a wider OIPA filter than Kyron used.

### Falsification

Overturned by one real run: any `previewPortfolioImport` call whose response carries
`counts.skippedNotYours` greater than zero AND `counts.yours` greater than zero closes
this. It can also be forced early with a synthetic workbook, which was offered and not
taken — worth doing before P4c if the review screen's "not yours" list needs a real
render.


---

## `substantive` filter contradicts its comment

**RESOLVED 2026-09-19 (P4d).** The filter is gone. The rule is now a single named
export, `PROVENANCE_ONLY_FIELDS`, in `buildImportPlan.js`:

```js
export const PROVENANCE_ONLY_FIELDS = Object.freeze([
  'exportDate', 'importedAt', 'importSource', 'lastImportRunId',
]);
```

and the code reads that list rather than restating it — which is what removes the
class of bug, not just this instance of it. `lastImportRunId` is listed although
`buildImportPlan` can never compute it (the run id does not exist until apply
time), precisely because the original failure was a field being owned but
unclassified. `firstImportRunId` is deliberately in NEITHER list: it is written
once, at create, and no update may touch it.

Measured on the real 15 Sep export, through the emulator, not inferred:

```
same file re-imported ->  created 0 | updated 0 | UNCHANGED 229
policy docs whose Firestore updateTime MOVED: 0
one API edited        ->  created 0 | updated 1 | unchanged 228
policy docs written this run: 1
```

The `updateTime` line is the part that matters. "Unchanged" now means the document
was NOT WRITTEN, not "written with only provenance" — and `updateTime` is set by
Firestore, so it is not a number this code could have talked itself into.

The coupling this entry warned about held rather than bit: `findLastImportBatch`
narrows candidates by `exportDate`, and a skipped policy keeping its OLDER export
date is exactly what makes that filter correct. The two moved together.


**Banked 2026-09-18 (P4b session). Measured, not inferred.**

`src/lib/portfolioImport/buildImportPlan.js` decides whether an existing policy counts
as changed:

```js
// `importedAt` and `exportDate` alone are not a real change: a re-run of the
// SAME export on a later day would otherwise report 229 updates that carry
// no new business fact.
const substantive = Object.keys(changed).filter(
  (k) => k !== 'importedAt' && k !== 'importSource',
);
```

The comment names `importedAt` and **`exportDate`**. The filter excludes `importedAt` and
**`importSource`**. `exportDate` is never excluded, and it is in `IMPORT_OWNED_FIELDS`, so
it changes on every policy whenever a newer export is imported.

### The measurement

Run against the real `buildImportPlan` on 2026-09-18, three existing policies, a newer
export in which **no** policy fact changed:

```
creates 0 | updates 3 | skips 0
changedKeys: [["exportDate","importedAt"],["exportDate","importedAt"],["exportDate","importedAt"]]
```

The same-file case the comment describes does work — the P4a emulator run reported
`0 creates / 0 updates / 229 unchanged` on a re-import of the identical file, because
`exportDate` was byte-identical. The defect only shows on a genuinely newer export, which
is the normal case and the one nobody has run yet.

### Why it matters twice

1. **P4c's review screen will lie by omission.** A 30 Sep export that changed nothing will
   read "229 policies updated", so the one number that tells the agent whether anything
   actually moved always reads as "everything did".
2. **P4b's undo refuses on every import after the first.** Undo removes what an import
   CREATED and refuses when it also updated, because an update overwrote values nothing
   stored. If every second import updates all 229, undo is available exactly once, ever.

### The fix, and the coupling that makes it not a one-liner

Adding `exportDate` to the `substantive` exclusion makes both behave. But then an
unchanged policy is SKIPPED, so no write happens, so its stored `exportDate` stays at the
older export — and `findLastImportBatch` in `functions/portfolioImport/rollback.js` uses
`exportDate` as its candidate filter precisely because "a policy the last import did not
touch keeps the export date it already had". That assumption is currently false and the
fix makes it true, so the two are consistent *after* the change and inconsistent *before*
— which is why they must move together and why this was not fixed inside P4b.

### Falsification

Overturned if the stale-`exportDate`-on-skip behaviour turns out to matter to a reader
nobody has enumerated yet — the field is written for provenance, and something may report
"as at" from it. `git grep exportDate` across `src/` before changing this.

---

## No written policy records which import run wrote it

**PARTLY RESOLVED 2026-09-19 (P4d).** The stamps and the run record exist:

- `tenants/{t}/users/{uid}/importRuns/{runId}` — one document per run, opened
  BEFORE any policy is touched so a crashed run is still discoverable and still
  undoable, closed afterwards with the counts its WRITER committed. The run
  document records `countsSource` so a reader never has to guess which numbers
  were measured and which came from the plan.
- `firstImportRunId` on every created policy, set once. `lastImportRunId` on
  every policy a run writes. An update moves the second and never the first.
- `undoLastPortfolioImport` reads the run record first and reconstructs from
  history only when the agent has no runs, naming the path in every response and
  every refusal.

**STILL OPEN — the backfill has not been run.** The 229 policies already live in
`tenants/tatillife_south/policies` were written before any of this existed, so
they carry no run id and still take the history path.
`functions/scripts/stamp-import-run.cjs` writes one synthetic run for a given
export date and stamps them; it is dry-run by default, refuses a date that
matches nothing, leaves already-stamped policies alone, and re-reads afterwards
to verify rather than trusting its own counter. Whether to run it is the
operator's call.

The synthetic run is marked `synthetic: true` with `counts: null`, because a run
reconstructed from the ledger after the fact is not the same claim as one
measured by its writer — some of those policies may have been edited by a human
since. Keeping the two kinds distinguishable is the point.


**Banked 2026-09-18 (P4b ruling). Operator decision: NOT in P4b.**

A preview plan gets a `planId` and is parked at
`tenants/{t}/users/{uid}/importPlans/{planId}`. Nothing stamps that id onto the policy
documents the plan then writes. So "which policies did the last import write" has no
stored answer and has to be reconstructed:

- `exportDate` narrows the candidates, and
- each candidate's `history` subcollection is read to see whether this export produced a
  `create` or an `update` for it.

That is exact, and it is what `findLastImportBatch` does. It costs one subcollection read
per candidate — 229 reads for Kyron's book, twice if the dry run and the confirmed delete
are separate calls.

### The durable fix

Stamp `importRunId` (the planId) on every document the import writes, creates **and**
updates, and record it on the history doc too. Undo then becomes one equality query
(`where importRunId == X`) instead of a per-policy history scan, and "the last import"
becomes a stored fact rather than a reconstruction.

### The catch that keeps the history path alive

It only helps FUTURE imports. The 229 documents already live in
`tenants/tatillife_south/policies` were written before `importRunId` existed, so undo
still needs the history path for them. Adding the stamp therefore means maintaining both
routes, not replacing one with the other — unless a backfill writes `importRunId` onto
the existing docs from their history, which is itself an import-shaped operation with its
own undo question.

### Falsification

Overturned if the per-policy history read turns out to be too slow in production — undo
runs with a 300 s budget and 229 sequential reads is well inside it, but a book an order
of magnitude larger would not be, and that would promote this from LOW to the blocking
fix. Measure before assuming: the emulator run completed the dry run and the delete
comfortably, but the emulator is not the network.


## Manager Lapse tab still offers imported policies (banked 2026-09-19, LOW - OIPA import)

**Banked while reviewing PR #957. Deliberately kept out of that PR to hold its scope.**

PR #957 taught the read side that a status from the OIPA head-office export needs no
manager confirmation. It changed two readers: the agent card hint in `PolicyCard.jsx`
and `toReconcile` in `PolicyReconciliationPanel.jsx`.

It did **not** change the third reader in the same panel:

```js
const lapseTabPolicies = allPoliciesRaw.filter((p) =>
  (p.status === 'settled' || p.status === 'lapsed') && inPeriod(p.dateIssued, selectedYear, selectedMonth),
);
```

So the Lapse tab still lists imported policies, and a manager can be offered a lapse
action on a policy head office has already lapsed.

### Why it was not fixed with the rest

Two reasons, and the second is the real one:

1. `inPeriod(p.dateIssued, ...)` bounds the blast radius. Kyron's imported book spans
   years, so only the handful issued in the selected month appear — not the 117 that
   flooded `toReconcile`.
2. The right answer is not obvious. `toReconcile` is a worklist: an imported policy in
   it is plainly wrong, because nobody is waiting on the manager. The Lapse tab is
   closer to a register, and there is a real case for a manager lapsing an imported
   policy that head office has not caught up with yet. Filtering it on
   `needsManagerConfirmation` would remove that ability silently.

### What would settle it

The operator's answer to one question: should a manager be able to lapse a policy whose
status came from the OIPA export? If yes, leave this alone and the entry closes as
WONTFIX. If no, the same `needsManagerConfirmation` helper applies and it is a one-line
filter.

### Falsification

Overturned if a second import source is added whose statuses are NOT authoritative for
lapses — then `needsManagerConfirmation` is too blunt for this reader regardless of the
answer above, and the Lapse tab needs its own predicate.


## Design mockups still say "Awaiting confirm" (banked 2026-09-20, LOW - policy ledger)

**Banked after #958 shipped. Raised by Claude Code during that build; kept out of it to hold scope.**

PR #958 renamed the `settled` pipeline stage from "Awaiting confirm" to "Settled", because a
status set by the OIPA head-office export has no manager step to wait on. The app now says
Settled. Eight files under `docs/design-system/screens-v2/` still say "Awaiting confirm":

```
app-policy-v2.jsx
recruiting-v2-shared.jsx
AgencyTrack-Specs/Policy-Ledger-Slice-1-Build.html
design_handoff_v2_app/Policy Ledger - Slice 1 Build.html
design_handoff_v2_app/Policy-Ledger-Slice-1-Build.html
design_handoff_v2_app/mockups/app-policy-v2.jsx
design_handoff_v2_app/mockups/recruiting-v2-shared.jsx
gameplan-loop-handoff/mockups/app-policy-v2.jsx
```

### Why this is LOW and not zero

Nothing renders from these files — they are a handoff record, not source. But they are what
a future build reads to learn what the ledger is supposed to look like, and a mockup that
disagrees with the app is how a correct label gets "fixed" back to the wrong one.

### What would settle it

A find-and-replace across those eight, in a docs-only PR, OR a decision that the v2 handoff
set is frozen as a historical record of that design round and is not maintained. Either
answer closes this; leaving it undecided is the only bad option.

### Falsification

Overturned if any of those files is actually imported or built. Checked on 2026-09-20: they
live under `docs/` and nothing in `src/` references them.

### Cloud Functions runtime — nodejs22 (1st gen)

- Cloud Functions moved to nodejs22 (1st gen). nodejs20 was decommissioned 2026-10-30. Next runtime review before nodejs22 EOL. gen-2 migration (needed for nodejs24) is still open.

## `replacedPolicyAPI` is required client-side only - the lens abstain branch is the backstop

**Banked 2026-09-20, campaign C3 / PR #960. Severity: LOW to hold, but the note is load-bearing.**

R4 made `replacedPolicyAPI` required at create when `newBusinessType === 'replacement'`, in `policiesService.validate` and the create form. **`firestore.rules` does not guard the field.** It appears there exactly once - in the policies update arm's `affectedKeys().hasOnly([...])` allow-list at line 397 - with no value guard anywhere, and the create arm at line 367 validates only `sourceOfProspect`, `dateWritten` and `proposedAPI`.

So the requirement is a client-side courtesy, not an invariant. A direct console write, the Admin SDK, a future import path, or any client path that bypasses `validate()` can still produce a settled replacement with no `replacedPolicyAPI`.

**The consequence, which is the reason this is written down:** `creditFor()`'s `replacement` branch returns `api: 0` with the reason `'Replaced API not recorded'` when the field is null. That branch is a **permanent backstop, not legacy-data handling**, and it must not be deleted on the reasoning that "the form requires it now". Deleting it would make an unguarded null credit the full new API as though nothing were replaced - which is Rule 4 inverted, and silently.

**What would change this:** adding a rules value-guard on `replacedPolicyAPI` for replacement creates. That is a rules change, so it is a human-merge plus an operator `firebase deploy --only firestore:rules`, and it should be weighed against the fact that historical replacement records legitimately carry `null` and must stay readable.

**Falsification (Rule 23):** overturned if a rules arm is added that makes a `replacement` create impossible without a positive `replacedPolicyAPI` AND existing null-carrying records are migrated or grandfathered. Until both are true, keep the abstain branch.

## Campaign lens reads the ladder ceiling, not the level in reach

**Banked 2026-09-20, campaign C3 / PR #960. Severity: LOW. Owner: slice C2, not a standalone fix.**

`derivePolicyLens` takes BOTH `apiTarget` and `appsTarget` from the campaign's **top** tier (Christmas 2026: Pioneer, 825,000 API / 35 apps). Pairing them is right - C3 fixed a real inconsistency where apps came from the entry tier while API came from the top - but the ceiling is the wrong denominator for an agent-facing progress figure.

Concretely, on live data today: the card reads **TTD 73,946 of 825,000**, about 9%, when the operator is **27% of the way to Champion** (275,000) - the lowest level, and the one that decides whether he travels at all. Every tier requires 35 apps, so the apps figure is unaffected; the API ceiling is the whole issue.

**Do not fix this in isolation.** Slice C2 adds the retreat readout and the distance-to-next-room line, which is exactly the surface that has to answer "which level am I on for, and what is the next one". The fix belongs there: show the level reached and the next level up, never the ladder's ceiling. Fixing it separately would mean touching the same component twice.

## The unfiltered-policies guard checks the FILE, not the array it hands downstream

**RESOLVED 2026-09-20 — option 1 built, not the option-2 speed bump.** The guard now
enumerates every JSX site that hands a policy ARRAY to a child component and pins the
inventory (8 sites today), classifying each `filtered-at-site` / `filtered-upstream` /
`unfiltered`, with every `unfiltered` entry carrying a stated reason. Two identifiers are
declared unfiltered BY CONSTRUCTION — `policiesAll` and `campaignPolicies` — and a prop
expression naming either must be declared `unfiltered`, which makes that half mechanical
rather than a hand claim.

**Demonstrated failing, not merely asserted.** The predicted regression —
`<AgentAwardsPanel policies={policiesAll}>` in `AgentDashboard.jsx` — was deliberately wired
and turns THREE assertions red independently: the inventory pin (naming the file and the
component), the classification check (`unclassified policy-array prop site`), and the
raw-carrier rule (`passes a raw carrier (policiesAll) but is not declared unfiltered`). The
FILE-level guard stayed fully green throughout the same run, which is exactly the gap this
entry described. Reverted; suite green at 30 tests.

**Option 2 was NOT also applied, and could not have been as written.** `ALLOW_UNFILTERED`
asserts its members do NOT reference `excludeImported(`; `AgentDashboard.jsx` does reference
it, so adding that file there would have failed the existing assertion. Option 1 supersedes it.

**Known limit, stated rather than papered over:** the guard reads text, not dataflow. It
cannot prove that a `policies` identifier in one file holds a value filtered in another —
`filtered-upstream` remains a human claim in the manifest. What it does guarantee is that no
policy array reaches a child component without a person having classified that site.

**Banked 2026-09-20, found reviewing campaign C2 / PR #962. Severity: MEDIUM. Do this before or with slice C4.**

**Nothing is wrong today.** This is about what the guard would fail to catch next.

`src/lib/portfolioImport/__tests__/excludeImported.test.js` carries the source-tree guard added by #948 - the one that caught `CampaignLensPanel` receiving an unfiltered ledger array and silently earning an imported historical book campaign credit. It enumerates the policy-handling files and asserts each one either references `excludeImported(` or sits in `ALLOW_UNFILTERED` (today: `PersistencyTab.jsx`, because imported docs are its entire input, and `PolicyLedgerPanel.jsx`, because C-D10 moved the campaign lens onto `dateIssued`).

**The gap.** C2 gave `AgentDashboard.jsx` one fetch and two derived arrays:

```
setPoliciesAll(own);                  // unfiltered -> campaignPolicies -> HomeV2 -> CampaignCard
setPolicies(excludeImported(own));    // filtered   -> everything else
```

That file **does** reference `excludeImported(`, so the guard passes it - while it is simultaneously handing an unfiltered array to a child component. **The assertion is per-file presence of the helper, not per-array provenance.** A file that filters one array and passes another raw satisfies it completely.

**What slips through, and it is the original defect one component over.** If a later change wires `policiesAll` (or a new `campaignPolicies`-style prop) into `AgentAwardsPanel`, `useMyProduction`, the financing surfaces, or any other aggregator, an imported book earns credit retroactively and **no test goes red**. The 229 imported docs in `tatillife_south` are the whole production book, so the wrong number would be large and plausible rather than obviously broken.

**Two ways to close it, in preference order:**

1. **Police the prop, not just the file.** Extend the guard to enumerate the props that carry policy arrays into child components (`policies`, `campaignPolicies`, `policiesAll`) and require each destination to be either filtered at the call site or allow-listed with a reason. This is the fix that matches the guard's original intent.
2. **Minimum viable.** Add `AgentDashboard.jsx`'s unfiltered path to `ALLOW_UNFILTERED` as an explicit entry naming `campaignPolicies` and its single legitimate consumer, so the next person wiring something to `policiesAll` at least has to edit the allow-list and state a reason.

Option 1 is the real fix; option 2 buys a speed bump. Do not do neither: the guard currently reads as though it covers this, and a guard believed to cover something it does not is worse than an absent one.

**Why before or with C4:** C4 touches `policyCampaignLens.js` and `awardsEngine.js` - the awards path is exactly where an unfiltered array would do the most damage, and it is the next slice to go near it.

**Falsification (Rule 23):** overturned if the guard is found to already trace prop flow between components rather than matching text per file - in which case `AgentDashboard`'s unfiltered path would have to be explicitly allow-listed for the suite to be green, and it is not. Checked on `origin/feat/campaign-c2-retreat-readout` at `f7134cb7`: the guard file is untouched by C2 (`git diff --stat origin/main...<branch> -- <guard>` is empty) and `ALLOW_UNFILTERED` still holds exactly two entries.

## Carry a real exit date through the OIPA export and importer

**Banked 2026-09-20 (ruling R7.4), found when C4 hard-stopped on live data. Severity: MEDIUM. Not part of C4.**

**The ledger has no exit date for any imported policy.** Queried live, `tatillife_south`: **109 exited docs (87 `lapsed`, 22 `ntu`). `dateLapsed` present on 0 of 87. `statusUpdatedAt` present on 0 of 109.** The only date every one of them carries is `statusAsOf`, and that is the **export date** - identical (`2026-09-15`) across all 109, and `buildImportPlan.js:77` states it moves on EVERY policy at EVERY import.

**Cause:** the importer writes status through the Admin SDK and never calls `lapsePolicy()`, which is the only code path that requires `dateLapsed`. Organic lapses recorded through the app going forward do carry it.

**Why it is only MEDIUM, and what keeps it safe meanwhile.** Rule 9 claws back a recalculation of campaign category, so only policies that EARNED campaign credit can be clawed back. Of the 109 exits, exactly **1** was issued inside 1 Jul - 31 Dec 2026, **3** policies counted, and **0** counted policies have exited. The counted-gate (R7.1) therefore keeps all 87 lapses out of the claw-back scan no matter what their dates say, and C4 additionally refuses `statusAsOf` outright (R7.2) and routes a counted-but-undated exit into `clawbackUnassessable[]` rather than guessing (R7.3).

**The residual risk this follow-up closes:** a policy that COUNTS during the campaign and later exits via a future OIPA import rather than through the app. It would reach the claw-back scan through the counted-gate and then have no exit date, so it can only ever be reported as "cannot assess". That is honest but not useful, and it is the case that matters most - a counted policy exiting inside the claw-back window is exactly what Rule 9 is about.

**What the work is:** carry a lapse/NTU date from the OIPA export through `parseOipaExport.js` and `buildImportPlan.js` into the policy doc, as a field distinct from `statusAsOf`. Parser + import-plan + field-inventory change.

**Blocked on a question only Tatil can answer:** does the OIPA/INGENIUM export carry an exit date column at all? If it does not, this follow-up cannot be built as scoped and the honest outcome is that imported exits stay permanently unassessable - which the C4 UI already states.

**Falsification (Rule 23):** overturned if a later export is found to carry an exit date that the importer is already storing under another name - re-run the live field presence check before building. The check that produced these counts is `verification/clawback-scope.mjs` (gitignored, re-runnable).

### Addendum, 2026-09-20 (C4 review): the same gap has a SECOND face, and it goes live on 1 January 2027

The entry above is about a missing exit DATE. Reviewing C4 surfaced the same root cause from another angle: the ledger stores a policy's **current** status, not its **status as at a date**, and the importer writes status with no transition history.

**Why that becomes a live defect in January.** Rule 9 claws back policies "lapsed, terminated **or not taken** within the 1st three months of the end of Campaign period". NTU after the close is the ordinary shape of a late-December application: issued in December, in force at the 31 Dec cut-off, counted - then NTU'd in February when the first premium never arrives. C4 ships the rule "an `ntu` policy never settled, so it never counted", which is **correct today and wrong from 1 January 2027**, because from then on a policy that is `ntu` when you look at it may have been settled and in force at the cut-off.

**What the correct test needs:** status AS AT `endDate`, not current status. The claw-back becomes assessable exactly when the on-track report lands (12 Jan 2027) and stays live to 31 Mar 2027.

**Why this is not just "read the history subcollection".** Every app-recorded transition does write a history doc with `changedFields.status`, atomically with the policy update, so an ORGANIC settled -> ntu flip is reconstructable. **An imported one is not**: the importer writes status through the Admin SDK, creating no history entry and carrying no event date. The operator's entire book arrives that way, so in practice a December-counted policy going NTU in February would reach the ledger as a bare status change with nothing to date it - the same wall as the missing exit date, which is why both live in this one entry.

**Disposition:** NOT a blocker for C4, which is display-only and cannot encounter the case before January. **Revisit trigger is dated, not conditional: before the 12 January 2027 on-track report.** If the OIPA export turns out to carry an exit date (the open question above), it answers both faces at once. If it does not, the honest outcome is that imported exits stay unassessable and the UI says so - which is what C4 already renders.

**Falsification (Rule 23):** overturned if a settled policy can be shown never to reach `ntu` in Tatil's operational practice, in which case Rule 9's "not taken" refers only to pre-issue applications and the C4 rule is right permanently. That is a question for Sales Administration, not for the ledger - and Rule 11 makes Executive Business Development the arbiter.

## A rate-limited CodeRabbit pass CANNOT be recovered on the Free plan - the re-poll ritual does not work

**Banked 2026-09-21, found dispositioning PR #966. Severity: MEDIUM - it is a hole in the review process, not in any one diff.**

**The finding.** CodeRabbit's automatic pass is rate-limited from time to time. The documented remedy - comment `@coderabbitai full review` - is a **Chat** feature, and Chat is not included in the Free plan. The bot refuses outright:

> "The author of this PR is on the CodeRabbit Free Plan. In order to use the Chat feature, please upgrade..."

**So a rate-limited commit gets no bot review at all, ever.** Not "later", not "on request". The dispatcher prescribed the re-poll on #962, #965 and #966 before checking it was available on this plan; it never worked. Observed on #966: pass 1 auto (summary only, 0 findings) on the opening range, pass 2 auto **rate-limited** on the range carrying the actual gate change, pass 3 chat **refused**.

**Why it matters more than it sounds.** The rate-limited pass is not random with respect to risk - it lands on the LAST push, which is where a fix made after review lives. On #966 that was `71c80071`, the commit that changed the claw-back gate itself. The reviewed commit was the superseded one.

**What currently compensates, and what does not.** Gemini is retired per documented policy, so there is no second automated reviewer. What stands in its place is the property-test discipline: a claim is only accepted when the guarding test has been SHOWN failing against a deliberately wired regression and then reverted. That is real coverage but it is self-review - it checks what the builder thought to check.

**Options, none of them free:**

1. **Accept and be explicit.** Stop prescribing the re-poll. When a pass is rate-limited, record "no bot review on this commit" in the Rule 21 disposition rather than implying one is pending. Cheapest, and honest.
2. **CodeRabbit Pro.** Already considered - see open PR [#928](https://github.com/Kelsean868/agencytrack/pull/928), which banks the Pro decision and the deferred purchase. This finding is new evidence for that decision rather than a new decision.
3. **Re-push to re-trigger the automatic pass.** An empty commit or a rebase gets a fresh automatic review, which is not rate-limited by the same counter. Untested. If it works it is the cheapest real fix, and it is worth one experiment before spending money.

**Recommendation:** do option 1 now, because it costs nothing and stops the workflow claiming a review that is not coming. Test option 3 on the next rate-limited PR. Treat option 2 as a decision for #928, informed by how often this actually bites.

**Falsification (Rule 23):** overturned if a rate-limited pass is later observed completing on its own, or if an empty-commit re-push produces a full review - which would make option 3 the answer and this entry a footnote.

## Firestore cache crash b815

**Banked 2026-09-23 on the instruction of `docs/briefs/hero-ledger-truth.md` (Out of scope, all three PRs). Severity: MEDIUM, provisional.**

**The report.** The brief records `INTERNAL ASSERTION FAILED (ID: b815)` from the Firestore SDK, traced to `src/firebase.js` and its `persistentMultipleTabManager` offline-cache setup. H1 did not reproduce it and did not touch `src/firebase.js`.

**What to do first.** Reproduce it before choosing a fix: which browser, how many tabs, and whether it follows a deploy (a stale IndexedDB cache from an older SDK build is a common trigger for this family of assertions). The fix shape depends on that answer, so none is proposed here.

**Falsification (Rule 23):** the MEDIUM rating is overturned upward if the assertion leaves the app unusable until the user clears site data, and downward if it is a one-off console error that recovers on reload.

## Award card NOT STARTED above 0%

**RESOLVED 2026-09-23 (PR #970, hero-ledger H3).** `stateText` in `AwardCard`
(`src/components/awards/awardPrimitives.jsx`) now has a fourth branch: IN
PROGRESS for `0 < award.progressPercent` when the award is neither qualified
nor in contention; exactly 0 still reads NOT STARTED, per "Fix shape" below.
`data-state` is unchanged (`locked` covers both) — only the pill copy moved.
`HeroAwardCard` renders no state pill at all, and `AwardDrillDrawer`'s eyebrow
is `isQualified ? '✓ Qualified' : '★ In contention'` — neither carries the
literal "NOT STARTED" string, so no fall-through existed there to fix.

**Banked 2026-09-23 from hero-ledger H2 (PR #969). Dispatcher ruling: fix it in H3.**

**The defect.** `AwardCard` in `src/components/awards/awardPrimitives.jsx` picks its state pill as `isQualified ? 'QUALIFIED' : isContention ? '<n>%' : 'NOT STARTED'`. "In contention" is a threshold the awards engine sets per award, well above zero, so any award with real progress below that threshold is labelled NOT STARTED. Seen live on Kyron's Awards tab, 23 Sep 2026: MDRT "NOT STARTED · 17%", Quarterly Apps "NOT STARTED · 7%", Persistency Silver/Gold "NOT STARTED · 35%".

**Why it matters.** It reads as "the app sees none of my business" — the exact complaint the hero-ledger brief exists to fix — while the number beside it says otherwise.

**Fix shape (H3 to confirm).** A third state for `0 < progressPercent` below contention (for example "IN PROGRESS"), keeping NOT STARTED for exactly 0. Copy is a product call; the brief's "copy is design" rule applies. Check the `HeroAwardCard` and drawer for the same fall-through.

**Falsification (Rule 23):** overturned if the engine's `inContention` is meant to be true from the first TTD of progress for every award, in which case the bug is in the engine thresholds, not the card.

## UM own-worksheet ALLOW untested

**RESOLVED 2026-09-25 (security S1, `fix(security): close the pre-pilot rules and functions holes`).** `tests/rules/moneyNeeds.rules.test.mjs` now has `unit_manager CREATE own worksheet → ALLOW` and `branch_manager CREATE own worksheet → ALLOW`. Mutation-checked: removing `isProducingManager()` from the `allow create` arm makes the UM case fail (31/32). Both cases also pass on the pre-S1 rules — they add coverage, they fix nothing.

**Banked 2026-09-25 from the PR #972 review (security S0). Severity: LOW. Dispatcher ruling: add the test in security S1 (`docs/briefs/security-phase-0-1.md`).**

**The gap.** `tests/rules/moneyNeeds.rules.test.mjs` used to assert "unit_manager CREATE at agent path → DENY" while writing to `moneyNeeds('um-1', …)` as `um-1` — the UM's own worksheet. `firestore.rules:1948` allows that on purpose (`allow create: if (isAgent() || isProducingManager()) && getTenantId() == tenantId && request.auth.uid == uid`). PR #972 retargeted the case to `moneyNeeds('agent-a', '2029')`, so the DENY is now tested for the reason its name gives. No expectation flipped. But nothing now asserts the own-doc ALLOW for a unit manager, so a rules change that dropped `isProducingManager()` from that arm would pass CI. `weeklyPlans` has the equivalent ALLOW test (`tests/rules/pm1-deny-matrix.test.mjs:472`); `moneyNeeds` does not.

**Fix.** One case: `unit_manager` (and `branch_manager`) CREATE at own `moneyNeeds/{uid}/{year}` → ALLOW.

**Falsification (Rule 23):** closed without work if a grep of `tests/rules/**` finds an existing own-doc ALLOW case for a producing manager on `moneyNeeds`.

## Storage rules deny avatar uploads

**Banked 2026-09-25 from security S1 (SEC-12). Severity: MEDIUM. Not fixed — SEC-12 was "no behaviour change" by the brief's own terms.**

**What we know.** The live Storage rules Kyron pasted from the Firebase Console on 24 Sep 2026 (`docs/briefs/storage-rules-live.txt`, now `storage.rules`) are `match /{allPaths=**} { allow read, write: if false; }`. The app's only Storage path is the profile photo upload, `src/services/userService.js:208` → `avatars/{tenantId}/{uid}.jpg`, done from the browser with `uploadBytesResumable`. Under those rules that upload is denied, and so is every `getDownloadURL` read. `tests/rules/storage.rules.test.mjs` pins exactly that.

**What we do not know.** Whether anyone has tried to upload a photo since the rules were set, and whether any `photoURL` in Firestore still points at a readable object (a token-bearing download URL minted before the lockdown would keep working).

**Fix shape (needs a ruling).** Owner-only write to `avatars/{tenantId}/{uid}.jpg` (`request.auth.uid == uid && request.auth.token.tenantId == tenantId`, `image/*`, size cap), tenant-scoped read. It is a rules behaviour change → human-merge, with `firebase deploy --only storage`.

**Falsification (Rule 23):** overturned if a production avatar upload succeeds — then the Console rules were not the ones serving the default bucket, and `storage.rules` must be re-pulled before anyone deploys it.

## Kiosk token revoke and read scope

**Banked 2026-09-25 from security S1 (SEC-03). Two gaps S1 left on purpose — the brief scoped SEC-03 to create + client writes.**

1. **Revoke is tenant-scoped (MEDIUM).** `functions/kiosk/revokeToken.js` checks only that the stored `tenantId` matches the caller's. Any `branch_manager` can revoke any branch's kiosk. Fix: the same `branchManagerOwns` check `createToken.js` now uses, against the token doc's `branchId`.
2. **Read is open to every manager (LOW).** `kioskTokens` keeps `allow read: if canManage(tenantId)` because `KioskModeTab` lists tokens client-side. The doc ID *is* the token, so a `unit_manager` (who cannot mint) can read another branch's live kiosk URL. Fix: scope reads to BM+ of the token's branch, or list tokens through a callable.

**Falsification (Rule 23):** closed without work if `KioskModeTab` stops reading `kioskTokens` from the client and revoke gains a branch check.

## Persistency null-scope match

**Banked 2026-09-25 from security S1 (SEC-07). Severity: LOW. Pre-existing in `allow get`; the new `allow list` mirrors `get`, so it inherits the gap.**

**The gap.** The UM arm is `existingAgentUnitId() == callerUnitId(tenantId)` and the BM arm is `existingAgentBranchId() == callerBranchId()` (`firestore.rules`, `match /persistency/{docId}`). Both sides are `get(...).data.<field>`. If the caller's user doc has no `unitId` (or `branchId`), the right side is null, and every agent whose doc also lacks the field matches. Not exploitable by an agent (agents have no such arm), and user docs are normally complete — but nothing enforces that.

**Fix.** Add `&& callerUnitId(tenantId) != null` (and the branch twin) to both arms in `get` and `list`, with a rules test for a UM whose doc has no `unitId`.

**Falsification (Rule 23):** overturned if a read of every `unit_manager` / `branch_manager` user doc shows the field always set AND `createUser` / `updateUser` refuse to write those roles without it.

