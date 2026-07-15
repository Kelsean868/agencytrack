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
| Tier A items | 🚧 | A-4 ✅ `41885ff5` (live-smoked: 6-row CSV, meta rows, filename) · A-7 ✅ `2b16e760` (live-smoked: ⋮ glyph + adaptive "Persistency" label + revert) · A-8 ✅ `843af4e4` (unit-covered; first-run-only surface — live smoke waived) · A-3 ✅ `1ac958f1` (live-smoked: stat strip 7/7/0+agents 2, search→2, chip-compose→honest empty, clear→7) · A-1/A-2 ✅ `fa0fe12e` (live-smoked: honest W0 empty states + Not-started pill) · A-6 ✅ `58ff208b` + rules deployed via `deploy-staging.ps1 -Only rules` (live-smoked WRITE-READ-VERIFY: compliance OFF → kiosk rotation 13→12 → restore → 13) · A-5 ✅ `b84d5e60` build + **A-9 fix in flight** (see below) |
| **A-9 (in-run addition): post-submit trailing-autosave race** | 🚧 | REAL finding surfaced by the a5 live smoke's console-clean gate: handleSubmit never canceled the pending 1500ms autosave timer → trailing saveDraft fires during the submitReport await → rules (correctly) deny the write to the submitted doc → console error + sticky "save failed" indicator under the celebration. PRE-EXISTING (not an A-5 regression — the A-5 submissionData block is not in the autosave effect deps). Fix: clearTimeout in handleSubmit + `submitting` in doSave guard. Regression test dispatched. |
| Tier B seed hardening (optional fill) | ⏳ | |
| E1 re-seed + full suite (no-regressions gate) | ⏳ | |
| E2 final doc + push | ⏳ | |
| E3 HOLD | ⏳ | |

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
| A-5 live smoke → **A-9 finding** | Fable (orchestrator) | ~09:10 | 🚧 | walk completed but console-clean gate caught the REAL pre-existing post-submit autosave race (§ checklist A-9); 2-line fix applied, test dispatched | — |

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

(none yet)

## DECISIONS-NEEDED

(none yet)

## Ranked next-list (for the following session)

(at E2)

## Morning handoff

(at E2)
