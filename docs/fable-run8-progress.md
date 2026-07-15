# Fable Run 8 — Progress Log

Run start (TT): 2026-07-15, unattended ~18h window (LONG). Start HEAD: `b1f2e2e3` (origin/staging tip == origin/main; Runs 5–7 promoted to prod at `10670bd7`).
Brief: [`docs/briefs/fable-run8-kickoff.md`](briefs/fable-run8-kickoff.md).
Active build map: [`docs/audits/design-conformance-2026-07-12.md`](audits/design-conformance-2026-07-12.md) (validity `e65fe143` + correction `23e6c67e`) + Run 7 ranked next-list.

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | 🚧 | this commit |
| 0.2 Baseline re-seed + full VH suite (~44 legs, 1 expected SKIP) | ⏳ | |
| Phase 0 selection written before building | ⏳ | |
| Tier A items | ⏳ | |
| Tier B seed hardening (optional fill) | ⏳ | |
| E1 re-seed + full suite (no-regressions gate) | ⏳ | |
| E2 final doc + push | ⏳ | |
| E3 HOLD | ⏳ | |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 run docs | Fable (orchestrator) | | | | |

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
