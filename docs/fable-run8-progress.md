# Fable Run 8 — Progress Log

Run start (TT): 2026-07-15, unattended ~18h window (LONG). Start HEAD: `b1f2e2e3` (origin/staging tip == origin/main; Runs 5–7 promoted to prod at `10670bd7`).
Brief: [`docs/briefs/fable-run8-kickoff.md`](briefs/fable-run8-kickoff.md).
Active build map: [`docs/audits/design-conformance-2026-07-12.md`](audits/design-conformance-2026-07-12.md) (validity `e65fe143` + correction `23e6c67e`) + Run 7 ranked next-list.

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | ✅ | `7e2c22f5` |
| 0.2 Baseline re-seed + full VH suite (~44 legs, 1 expected SKIP) | ✅ | re-seed 91 docs (0 stale — Run-7 residue sweep confirmed active) → **44 legs: 42 PASS / 1 FAIL / 1 SKIP**; the 1 FAIL (`t2-pdf-download-ctas`, LOGIN-TIMEOUT) re-run solo → PASS (flake: agent1 logged in cleanly on adjacent legs same run). Effective **43/44 + expected SKIP = CLEAN**, full scope authorized. Log: out/run8-baseline-vh.log |
| Phase 0 selection written before building | ✅ | `1b9a4d54` — 8 items + 2 stretch; § Phase 0 selection below |
| Tier A items | 🚧 | A-4 ✅ `41885ff5` (live-smoked: 6-row CSV, meta rows, filename) · A-7 ✅ `2b16e760` (live-smoked: ⋮ glyph + adaptive "Persistency" label + revert) · A-8 ✅ `843af4e4` (unit-covered; first-run-only surface — live smoke waived) · A-3 ✅ `1ac958f1` (live-smoked: stat strip 7/7/0+agents 2, search→2, chip-compose→honest empty, clear→7) · A-1/A-2 ✅ `fa0fe12e` (live-smoked: honest W0 empty states + Not-started pill) · A-6 ✅ `58ff208b` + rules deployed via `deploy-staging.ps1 -Only rules` (live-smoked WRITE-READ-VERIFY: compliance OFF → kiosk rotation 13→12 → restore → 13) · A-5 ✅ `b84d5e60` build (a5 live-smoke re-run pending post-A-9) · **stretch Joint-Work tab ✅ `3fb99d94`** (read-only mockup port; Notes/RecommendGoal write paths stay banked) · **stretch Awards-within-reach scene ✅ `e04f6978`** (zero new reads; DEFAULT_RULESET_2026 limitation banked) |
| **A-9 (in-run addition): post-submit trailing-autosave race** | ✅ | REAL finding surfaced by the a5 live smoke's console-clean gate: handleSubmit never canceled the pending 1500ms autosave timer → trailing saveDraft fires during the submitReport await → rules (correctly) deny the write to the submitted doc → console error + sticky "save failed" indicator under the celebration. PRE-EXISTING (not an A-5 regression — the A-5 submissionData block is not in the autosave effect deps). Fix: clearTimeout in handleSubmit + `submitting` in doSave guard — `e41baffc`, both regression tests FAIL with the fix reverted (revert-check proven), 152/152 wizard dir green. |
| Tier B seed hardening (optional fill) | 🚧 | doc-only `vhfix-um2` 2nd-UM fixture (seed-fixtures § A14) — builder's minimal-ripple deviation: NO 3rd agent (an agent fixture would flip Meeting-deck deriveUnits + MasterSheet exception counts across many legs; a bare unit_manager doc is invisible to every role==='agent' surface). Only ripple = All-Users any-role count (a3 leg 7→8, same change). t1-compliance-scope full path activates. Builder's verification suite was killed by a session restart → orchestrator re-ran: re-seed 92 docs + full suite (out/run8-tierb-vh.log) |
| E1 re-seed + full suite (no-regressions gate) | ✅ | re-seed → **44 legs: 43 PASS / 1 FAIL / 0 SKIP**. The 1 FAIL (`t2-war-review-roundtrip`, LOGIN-TIMEOUT) re-ran solo → PASS — same flake class as the baseline's `t2-pdf-download-ctas` (BM logged in cleanly on adjacent legs in the same run). **NO-REGRESSIONS GATE SATISFIED: every pre-existing leg green, zero reverts — and the run ends with 0 SKIP for the first time** (Tier B retired the documented `t1-compliance-scope` seed gap). Other gates: **unit suite 5455/5455 across 352 files, zero flakes** · lint 0 (`src/` + `scripts/`) · build clean 11.4s. Log: out/run8-e1-final-vh.log |
| E2 final doc + push | ✅ | this commit; verbatim origin line in the run-close report |
| E3 HOLD | ✅ | no merges to main, zero prod contact all run, nothing further |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 run docs | Fable (orchestrator) | ~06:55 | ~07:05 | ✅ | `7e2c22f5` |
| 0.2 baseline seed + suite + flake re-run | Fable (orchestrator) | ~07:05 | ~07:20 | ✅ 42/1/1 → flake re-run PASS | — |
| Phase 0 verification + selection | Fable (orchestrator, Opus floor) | ~07:06 | ~07:15 | ✅ (parallel with 0.2) | `1b9a4d54` |
| A-7+A-8 nav polish + onboarding icons | **Sonnet** | ~07:17 | +4.9 min | ✅ 39/39, lint 0 | `2b16e760` `843af4e4` |
| A-4 campaign proof CSV | **Sonnet** | ~07:17 | +8.0 min | ✅ 65 tests, lint 0 | `41885ff5` |
| A-7/A-4 live smokes | Fable (orchestrator) | ~07:35 | ~07:50 | ✅ 2/2 PASS (two smoke-side bugs fixed: CSV blank-line arithmetic; unsafe first-drawer-item pick → shell-preserving tab list) | `ca70b7a0` |
| A-3 All Users roster v2 | **Sonnet** | ~07:17 | +22.3 min | ✅ 32/32, lint 0 (1 justified deviation: read-only listBranches — brief anchor stale) | `1ac958f1` |
| A-5 celebration polish | **Sonnet** | ~07:35 | +22.4 min | ✅ 247/248 (1 known flake green solo), lint 0, build ok | `b84d5e60` |
| A-1/A-2 Team Dashboard panels | **Sonnet** | ~07:17 | +25.1 min | ✅ 355/355, lint 0, build ok | `fa0fe12e` |
| A-6 kiosk toggles + rules (investigate: orchestrator; build: Opus) | **Opus 4.8** | ~07:40 | +17.8 min | ✅ 130 unit + 14 emulator rules + 17 regression rules, lint 0 | `58ff208b` |
| A-6 rules deploy (staging only) | Fable (orchestrator) | ~08:20 | ~08:25 | ✅ dry-run guards → rules released; `-Only` scope param added to deploy-staging.ps1 (guards unchanged) to avoid re-shipping functions (ABSOLUTE STOP) | in `58ff208b` |
| A-3/A-12/A-6 live smokes | Fable (orchestrator) | ~08:30 | ~09:10 | ✅ 3/3 PASS after smoke-side fixes (copy expectation; BM My-Team workspace toggle; aria-state polling vs fixed waits) | — |
| A-5 live smoke → **A-9 finding** | Fable (orchestrator) | ~09:10 | ~09:40 | walk completed but console-clean gate caught the REAL pre-existing post-submit autosave race (§ checklist A-9); 2-line fix applied by orchestrator, regression test dispatched | fix in `e41baffc` |
| A-9 regression test (+ revert-check proof) | **Sonnet** | ~09:45 | +13.6 min | ✅ 2 new tests (both fail with fix reverted), 152/152 wizard dir | `e41baffc` |
| Stretch: AgentDrill Joint-Work tab (read-only) | **Sonnet** | ~09:50 | +12.7 min | ✅ 12 tests (42/42 subset), lint 0 | `3fb99d94` |
| Stretch: Meeting Awards-within-reach scene | **Sonnet** | ~09:50 | +17.9 min | ✅ 42/42 MeetingMode tests, lint 0, zero new reads | `e04f6978` |
| Tier B seed hardening (fixture + leg expectations) | **Sonnet** | ~09:55 | +34 min (killed mid-verify) | 🚧 fixture + a3/t1 leg updates delivered with strong Rule-17 ripple trace; verification suite killed by session restart | uncommitted |
| — session restart — | — | ~10:40 | ~12:45 | Claude Code process exited mid-wait (~2h gap); all background agents/commands stopped. Recovery: state re-derived from git + logs; Tier B verification re-run by orchestrator | — |
| Tier B verification re-run (orchestrator) | Fable (orchestrator) | ~12:45 | ~13:05 | ✅ re-seed 92 docs (1 stale WAR doc swept) + full suite **42 PASS / 2 network flakes (both PASS solo) / 0 SKIP**; t1-compliance-scope full path GREEN first time | `f8751c10` |
| a5 live-smoke re-run (post-A-9) | Fable (orchestrator) | ~13:10 | ~13:15 | ✅ PASS — medal WK 29 == weekNumber(W0), apps=1, View-submission opens viewer, **console-clean gate now green** (the gate that found A-9) | — |
| E1 re-seed + full suite + unit/lint/build gates | Fable (orchestrator) | ~14:15 | ~14:50 | ✅ 43/1(flake, PASS solo)/**0 SKIP**; unit 5455/5455; lint 0; build 11.4s | — |
| E2 close-out | Fable (orchestrator) | ~14:50 | ~15:00 | ✅ | this commit |

## Phase 0 selection (written before building; selector: Fable orchestrator, satisfies the Opus floor)

**Rule-17 re-verification finding (material):** the build map's validity SHA `e65fe143` is MID-Run-6 — Run 6's later commits (`d4e5220d` four-states holdouts, `72daabf8` per-block stagger, `3d42125f` CompliancePanel ScopeSwitch, `9beb2aa7` Awards §1 + Settlements §5) plus Run 7's B-items already resolved the map's entire Tier-0 and several Tier 2–4 rows. Every candidate below was grep-confirmed STILL-VALID at Run-8 HEAD `7e2c22f5` before selection. File moves noted: `Celebration.jsx` → `src/components/wizard/v2chrome/`, `CampaignLensPanel.jsx` → `src/components/agent/policyLedger/`, `KioskModeTab.jsx` → `src/components/kiosk/`.

Criteria: no operator ruling needed · not on ABSOLUTE STOPS · no money/payout path · confidently boundable + live-smokable unattended with the 75-min reserve intact · reliability/correctness > user-visible capability > cosmetic.

**SELECTED (priority order — drop from the bottom):**
1. **A-1 ChampionsPanel** (map Tier-1 #6 remainder, M-): ranked weekly champions on the Team Dashboard, derived read-only from the existing leaderboards aggregate + `utils/weeklyChampions.js`. Sonnet.
2. **A-2 MyWeekPanel** (#6 remainder, S-M): player-coach own-week panel on the Team Dashboard, read-only from the manager's own submissions. Sonnet.
3. **A-3 All Users roster v2** (Tier-4 #17, M): stat strip + search + role-filter chips + RoleChip pills + BRANCH·UNIT column on `UserManagementPanel.jsx`. **LAST-activity column skip-logged** — no `lastActive`/`lastLogin` field exists on user docs (grep-confirmed); building it would need a write-path change (out of bounds tonight). Sonnet.
4. **A-4 Campaign proof export** (Run-7 next-list #3, S): CSV export of `lens.contributions` (policy, plan, state, value) wiring the honestly-disabled button at `CampaignLensPanel.jsx:97-101`. Sonnet.
5. **A-5 Wizard Celebration polish** (Tier-2 #11, M): gold WEEK-N medal + Apps stat card + secondary "View submission" CTA on `wizard/v2chrome/Celebration.jsx`. **Est-Commission card only if an existing util yields the agent's rate unambiguously** (reverse-commission calc E2 shipped one) — else skip-log. Sonnet.
6. **A-6 Kiosk per-slide enable/disable** (Tier-3 #15 slice, M): manager write path for the read-only rotation config (`KioskModeTab.jsx:208`) + kiosk-side read. SCOPE GATE: if the kiosk token context needs a NEW rules arm → emulator-first + `deploy-staging.ps1` (autonomous, Opus); if it needs kiosk-auth redesign → STOP and bank. Opus 4.8.
7. **A-7 Nav polish N5+N6** (Tier-0 #4 slice, S cosmetic): ⋮ affordance + adaptive More label on `shell/MobileBottomNav.jsx`. N4 mobile drag-reorder NOT selected (fiddly pointer semantics, unattended risk). Sonnet.
8. **A-8 Onboarding per-slide themed icons** (Tier-4 #20, S cosmetic): `WelcomeScreen.jsx` single brand mark → per-slide icons. Sonnet.

**STRETCH (only if window holds after A-1…A-8 + Tier B):** AgentDrillDrawer Joint-Work **read-only** tab slice (#7; Notes/RecommendGoal write paths banked) · Meeting "Awards-within-reach" scene (#14).

**REJECTED (with reasons):**
- **DataSourceBadge SETTLED wiring** (#9 sub-item): NOT drift — `computations.js:267-273` documents a deliberate read-light rule ("these views never fetch settlements… intentionally deferred"). Overturning a documented design decision = operator ruling → DECISIONS-NEEDED.
- **Persistency KPI card**: aggregate design ruling still open (CF-written aggregate = functions/ STOP; O(agents) fan-out = perf acceptance call) — carried in DECISIONS-NEEDED since Run 7.
- **Kiosk roster parity** (Run-7 #2): clean fix is a CF-written branch-roster aggregate → functions/ ABSOLUTE STOP.
- **Commission scenarios** (#10): storage location (profile doc vs localStorage) + manager suggest-a-goal-back cross-user write = two unresolved design calls → banked.
- **Kiosk Noticeboard** (#15 other half): new collection + entry UI + rules — weaker bound, M-L.
- **EditUserDrawer** (#18): commission-rate is money-adjacent; Reset-password is auth-sensitive.
- **Production roster table rebuild** (#9 main): L-sized rebuild across three role views with live value-level VH legs on them — regression surface too broad for unattended.
- **Policy Recon 8-flag · payout paths · functions/ runtime**: ABSOLUTE STOPS.
- **AgentModePicker · SM cross-branch · Persistency v2 calc-model · Company Config v2 inheritance · RecTargetCard · campaign close/release**: NEEDS-RULING per the map.

**Tier B (seed hardening)** is PLANNED, not just fill: taken mid-run (after A-4 ships), as its own gated block — 2nd-UM fixture + every affected leg expectation in the SAME change + immediate full-suite re-run; abort cleanly to bank if any leg cannot be made value-exact.

## Banked follow-ups (Run 8)

- **A-6 kiosk-side live verification is HALF-proven.** The manager toggle → Firestore doc → rotation-count change was live write-read-verified, but the kiosk wall's own re-read of `kioskConfig/{branchId}` on its 5-min poll was NOT observed across a real poll boundary (the smoke asserts the rotation build, not a 5-min wall-clock wait). Minimal next step: a long-poll leg, or shorten the poll interval behind a test flag.
- **A-6 rules are deployed to STAGING ONLY.** `kioskConfig` read/write arms are live on `agencytrack-staging` (15/15 emulator + 17 regression legs green). **Production rules do NOT carry this block** — promoting Run 8 to prod REQUIRES `firebase deploy --only firestore:rules` against prod, or the manager toggle write will be denied in production. This is the one hard promotion prerequisite from this run.
- **Awards-within-reach uses `DEFAULT_RULESET_2026`, not the tenant-merged ruleset.** Direct consequence of the zero-new-reads scope gate: a tenant with custom award bands (via `getMergedAwardsRuleset`) would see the scene compute against defaults. Fix needs the ruleset threaded into MeetingMode's load effect (one extra read) — a deliberate trade, not an oversight.
- **Awards-within-reach live-render is unverified.** Both fixture agents sit below every annual band (A1 YTD 122,000 vs the 125,000 in-contention floor — short by TTD 3,000), so live staging exercises the SKIP-LOG path, not the card grid. The card grid is RTL-proven only. A fixture nudging A1 over ~60% of a band would exercise it (careful: A1's YTD is asserted value-level by several other legs — this is exactly the kind of ripple Tier B just traced).
- **Est-Commission card skip-logged (A-5).** Shipped as apps + API + a TTD 0 commission read; the agent's commission rate is not unambiguously available in wizard context without a new fetch. Smoke reads `commission TTD 0` — honest, but the card is decorative until a rate source is wired.
- **LAST-activity column skip-logged (A-3).** No `lastActive`/`lastLogin` field exists on user docs. Needs a write path (login-time stamp) before the column can be honest.
- **N4 mobile drag-reorder** still unbuilt (the deliberate A-7 exclusion — fiddly pointer semantics, unattended risk).
- **`t3-kiosk` podium sub-assertion is bounded-poll deferred**, unchanged from prior runs: "leaderboard panel not reached in bounded poll (rotation timing)". Pre-existing, not Run-8 caused, but now adjacent to A-6's rotation work — worth one look.
- **Two network-transport flake classes observed** (`ERR_NO_BUFFER_SPACE`, `ERR_CONNECTION_CLOSED`) failing legs on console-clean. Both PASS solo. If they recur, consider allowlisting transport-layer resource errors distinctly from app console errors — but do NOT blanket-allowlist (the A-9 find came from exactly this gate).

## DECISIONS-NEEDED

1. **DataSourceBadge SETTLED wiring** — the three production views always render "Estimated" because `computations.js:267-273` documents a deliberate read-light rule (never fetch settlements). The build map lists the SETTLED upgrade as backlog #9, but shipping it means overturning a documented design decision and adding a per-period settlements fetch to all three views. **Ruling needed:** accept the read cost and wire it, or bless "Estimated" as the permanent honest state and strike it from the map?
2. **Persistency KPI card** (carried from Run 7, unchanged) — needs either a CF-written branch-persistency aggregate (functions/ = attended window) or acceptance of an O(agents) fan-out on the manager overview. Design wants the 5-card strip.
3. **Kiosk roster parity** (carried from Run 7) — celebrations/compliance/photos still degrade when the kiosk users-list read is denied. The clean fix is a CF-written branch-roster aggregate (name+photo+unit only, no email/phone) → functions/ = attended window.
4. **A-6 prod-rules deploy** — see banked FU above. Not a design question, but it is an explicit human action gating Run 8's promotion.

## Ranked next-list (for the following session)

1. **Promote Run 8 → prod** — and remember the **`firestore.rules` deploy is a hard prerequisite** (A-6's `kioskConfig` block; staging-only today). Without it the kiosk panel toggles silently fail in production.
2. **Build-map REVALIDATION is now due.** The map's validity SHA (`e65fe143`) is mid-Run-6; Runs 6/7/8 have closed its entire Tier-0, all of Tier-3 #14, most of Tier-1 #6–#7, Tier-2 #12, Tier-4 #17/#19/#20, and nav N5/N6. Phase 0 spent real time re-verifying stale rows. A fresh revalidation pass (same method as `design-conformance-2026-07-12.md`) would pay for itself next run.
3. **Remaining STILL-VALID map rows, ranked:** Team #6 last slice (ranked ChampionsPanel *content* — the panel now ships with honest empty states but has never rendered a populated podium against live data) · AgentDrill #7 remainder (Notes tab + RecommendGoal — both WRITE paths, need a design call on note visibility) · Commission scenarios #10 (needs the storage ruling) · Production roster table #9 (L, broad regression surface — wants an attended window) · All Users LAST-activity (needs a login-stamp write path).
4. **Fixture gap worth closing:** no `jointCalls` fixtures exist anywhere in the seed, so the new Joint-Work tab's *log* half only ever renders empty live (the prep half is covered by A1's 4 prospectInfo docs). Same shape as the Awards-within-reach gap — both new surfaces are live-proven only in their empty states.
5. **ATTENDED-ONLY (do not autonomously start):** Policy Reconciliation 8-flag taxonomy · functions/ Node-20 migration · any payout-release write path · SEC-9b cross-tenant isolation audit.

## Morning handoff

**Eleven items shipped: all 8 selected + both stretches + one real bug the smokes caught. Tier B closed the last SKIP — the VH suite now runs a genuine 44/44 for the first time.**

**The run's most valuable output was not a planned item.** The A-5 celebration smoke's console-clean gate caught a **pre-existing** post-submit race (`A-9`, `e41baffc`): `handleSubmit` never cancelled the pending 1500ms autosave, so a trailing `saveDraft` fired during the `submitReport` await and was correctly denied by the rules — surfacing a console error and a sticky "save failed" indicator underneath the celebration. It is not an A-5 regression; A-5 merely put a walk through that window for the first time. The fix is two lines; both regression tests fail with it reverted (revert-check proven).

**Shipped:**

| SHA | Item |
|---|---|
| `2b16e760` | A-7 nav: ⋮ glyph + adaptive More label (live-smoked) |
| `843af4e4` | A-8 onboarding: per-slide themed icons |
| `41885ff5` | A-4 policy ledger: campaign proof CSV export (live-smoked, 6 rows) |
| `1ac958f1` | A-3 All Users roster v2: stat strip + search + role chips + BRANCH·UNIT (live-smoked) |
| `fa0fe12e` | A-1/A-2 Team Dashboard: ChampionsPanel + MyWeekPanel (live-smoked, empty states) |
| `58ff208b` | A-6 kiosk per-slide toggles + **staging rules deploy** (live write-read-verify: 13→12→13) |
| `b84d5e60` | A-5 wizard celebration: WK-N medal + stat cards + View-submission CTA (live-smoked post-A-9) |
| **`e41baffc`** | **A-9 (unplanned): post-submit trailing-autosave race** |
| `3fb99d94` | stretch: AgentDrill read-only Joint Work tab |
| `e04f6978` | stretch: Meeting Awards-within-reach scene |
| `f8751c10` | **Tier B: 2nd-UM fixture — t1-compliance-scope SKIP → full live PASS** |

**Tier B was taken as a planned block, not filler, and it landed clean.** The builder's Rule-17 ripple trace is the part worth reading: the original 2-fixture sketch (2nd UM **+** 3rd agent) would have flipped `MeetingMode.deriveUnits()` — adding a Units scene that two deck legs hard-assert absent — and inflated MasterSheet exception counts on every week. It shipped a **bare unit_manager doc** instead, which is invisible to every `role==='agent'` surface. One ripple, correctly found and fixed in the same change: the All-Users any-role count (7→8).

**Gates:** lint 0 across `src/` + `scripts/` · build clean (11.4s) · **unit suite 5455/5455 across 352 files, zero flakes** · **E1: 44 legs = 43 PASS / 1 login-timeout flake (PASS solo) / 0 SKIP — no-regressions gate satisfied, zero reverts** · zero prod contact all run (every leg's tripwire green).

**Routing note:** Opus floor honored — Phase-0 selection (orchestrator) and A-6 (rules change) both Opus; Sonnet for A-1/A-2/A-3/A-4/A-5/A-7/A-8, the A-9 regression test, both stretches, and Tier B. No Haiku. Zero two-strike escalations — every down-routed part passed its gates. One orchestrator-side correction worth noting: the A-6 deploy needed a `-Only` scope param added to `deploy-staging.ps1` so the rules release could not drag functions along with it (functions/ = ABSOLUTE STOP); the script's three safety guards were left untouched.

**Known gaps (Rule 22, stated plainly):** A-6's kiosk-side 5-min poll re-read was never observed across a real poll boundary — the manager half is fully proven, the wall half is proven at the rotation-build level. Awards-within-reach and the Joint-Work log half are live-proven only in their **empty/skip** states (no fixtures push either into its populated branch). Est-Commission and LAST-activity shipped skip-logged. All are banked above.

**E3:** HOLD — nothing merged to main, zero prod contact, nothing further.
