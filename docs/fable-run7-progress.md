# Fable Run 7 — Progress Log

Run start (TT): 2026-07-12, unattended ~5h window (SHORT). Start HEAD: `7b98bc65` (origin/staging tip, Run 6 close).
Brief: [`docs/briefs/fable-run7-kickoff.md`](briefs/fable-run7-kickoff.md).
Active build map: [`docs/audits/design-conformance-2026-07-12.md`](audits/design-conformance-2026-07-12.md) (validity `e65fe143` + correction `23e6c67e`).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | ✅ | `7e10226d` |
| 0.2 Baseline re-seed + full VH suite (44 legs, 1 expected SKIP) | ✅ (after investigation) | First run: **34 PASS / 9 FAIL / 1 SKIP**. All 9 fails root-caused inside the gate window to TESTWARE, not app regressions (Sunday week-rollover, first since suite authoring): (1) **seeder residue** — week-keyed `uid_<sunday>` doc IDs leak one stale doc per subject per collection when W0 advances; +11,500 YTD residue explained 6 fails exactly. Fixed: sweep in seed-fixtures (`109b4063`), 9 stale docs deleted live, all 6 legs re-run GREEN. (2) **date-anchored expectations** — 3 legs (history best-week anchor, game-plan hardcoded month buckets, daily-strip Sunday-empty) assert values only valid pre-rollover; Sonnet fixer making them derive from the positional W(k) model. Baseline judged CLEAN for Tier B (app code exonerated: Master Sheet/WAR/config legs all green on the same data). |
| A1 WizardForm:301 draft-load SURFACE (Opus; Rule-17 confirm first) | ✅ | `0dd3701f` — operator model confirmed (findings below); error card + Retry replaces form body; footer/steps unrendered + doSave guard (both overwrite vectors blocked). 20/20 + wizard dir 239/239. |
| A2 WizardForm:342 identify + disposition | ✅ | Identified: getLeaderboardPoints (Celebration prior-points). Absent→0 === failure-fallback 0 on secondary enrichment → **KEPT**, line unchanged (findings below). |
| A3 KioskShell initial-load reconnecting state | ✅ | `2066d366` — hasLoadedOnce ref splits initial/refresh; kiosk-glass "Reconnecting…" pill, no Retry (5-min poll already retries unconditionally); refresh behavior untouched. 93/93. |
| A4 JointCallsTab:343 align with :332 | ✅ | `bd474304` — prepsError state + identical danger-banner idiom as sibling. 13/13. |
| A5 CBTT scope honesty (extend filter OR explicit "(all units)") | ✅ | `233650b4` — option (a): cbttComplianceFlag reads only per-agent fields → CBTT derives from scopedRoster (findings below). 28/28. |
| B1/B2 Tier B selection written before building | ✅ | selection + rejections in § Tier B selection below |
| B3 Tier B items | ✅ | B-1 ✅ `57567786`+`03caee6c` (SEC-012, **live-verified**: real names on the wall via bypass-context rotation probe; my first probe hit the Vercel login wall — invalid, re-run through newLegContext). B-2 ✅ `38f1360a`. B-3 ✅ `9c7759a8`. B-4 ✅ `27db30cf`. All 4 selected items shipped. |
| E1 re-seed + full suite (no-regressions gate) | ✅ | re-seed 89 docs (0 stale — sweep confirmed) → **44 legs: 43 PASS / 0 FAIL / 1 SKIP**. No-regressions gate SATISFIED; the SKIP is the documented t1-compliance-scope seed gap (unchanged from Run 6). Zero reverts. Includes the 3 date-robustified legs + t3-kiosk (SEC-012 fix live). Log: out/run7-e1-final-vh.log |
| E2 final doc + push | ✅ | this commit; verbatim origin line in run-close report |
| E3 HOLD | ✅ | no merges to main, zero prod contact all run, nothing further |

## Dispatch / telemetry (per-part model routing)

| Item / part | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 run docs | Fable (orchestrator) | ~07:55 | ~08:02 | ✅ | `7e10226d` |
| 0.2 baseline + failure investigation (root cause + seeder sweep) | Fable (orchestrator) | ~08:03 | ~08:22 | ✅ 34/9/1 → root-caused; sweep fixed 6/9; well inside the 45-min gate | `109b4063` |
| A1+A2 WizardForm | **Opus 4.8** | ~08:05 | +9.6 min | ✅ 20/20 + dir 239/239 | `0dd3701f` |
| A3 KioskShell reconnecting | **Sonnet** | ~08:05 | +3.6 min | ✅ 93/93 | `2066d366` |
| A4 JointCallsTab | **Sonnet** | ~08:05 | +2.3 min | ✅ 13/13 | `bd474304` |
| A5 CBTT scope | **Sonnet** | ~08:05 | +2.3 min | ✅ 28/28 | `233650b4` |
| Date-robust VH leg fixes (3 legs) | **Sonnet** | ~08:23 | +12.3 min | ✅ 5/5 legs PASS (3 fixed + 2 neighbors re-proven); Sunday strip absence = app design (isTodaySunday gate) | `70a716ee` |
| B-1 kiosk names degrade (investigate+fix) | **Opus 4.8** | ~08:28 | +11.2 min | ✅ root-caused (users LIST arm manager-only, rules:160–164); privacy-preserving fix via submission-carried agentName — NO rules change (widening path explicitly rejected); 82 targeted tests | `57567786` + comment hunk `03caee6c` (orchestrator pathspec miss, caught at status check) |
| B-2 Policy Ledger finish | **Sonnet** | ~08:28 | +2.9 min | ✅ insured-name shipped (6 new tests); export-proof scope-gated + banked | `38f1360a` |
| B-3 Team KPI cards | **Sonnet** | ~08:28 | +5.8 min | ✅ Active Agents card (zero new reads, 14/14); Persistency banked (O(agents) fan-out, no aggregate) | `9c7759a8` |
| Gates: lint + build + full unit suite | orchestrator | ~08:45 | ~08:58 | ✅ lint/build clean; suite 5356/5357 with ONE MeetingMode timeout under 2-fork contention → 10/10 solo re-run (flake, untouched surface) | — |
| B-1 live verification (kiosk names) | orchestrator | ~08:50 | ~08:58 | ✅ NAME FOUND ON WALL: true (rotation probe, bypass context, zero prod requests) | — |
| B-4 login trust affordances (stretch) | **Sonnet** | ~09:00 | +5.3 min | ✅ caps-lock hint + trust footer + carded error; 12/12 (6 new) + 13/13 consumers | `27db30cf` |
| E1 re-seed + full 44-leg suite | orchestrator | ~09:25 | ~09:40 | ✅ 43 PASS / 0 FAIL / 1 SKIP | — |

**Routing notes:** Opus floor honored — A1 (data integrity) and B-1 (SEC-012 kiosk / potential rules change) both Opus; Tier B selection was orchestrator judgment (Opus floor). Sonnet for A3/A4/A5, all leg fixes, B-2/B-3/B-4. No Haiku. Zero two-strike escalations — every down-routed part passed its gates first attempt. One orchestrator pathspec miss (B-1 comment hunk) self-caught at the `git status` check and committed separately (`03caee6c`). One flaky unit test (MeetingMode timeout under fork contention) verified green solo, untouched surface — not a regression.

## A1/A2/A5 findings (code-vs-operator-model; populated as verified)

- **A1 — operator model CONFIRMED (Rule 17, orchestrator read).** `getDraft` (submissionService.js:150–154) is a bare `getDoc` → `snap.exists() ? snap.data() : null`. Absent draft = `null`, handled by the effect's `if (!draft)` fresh path (WizardForm.jsx:286). The `.catch((e) => { console.error(e); setDraftLoaded(true); })` (:301) can ONLY fire on genuine failure (permission/network) — no service wrapper converts throws to null. Worse than logged: it sets `draftLoaded(true)`, unblocking a fresh form whose 1500ms debounced auto-save (`doSave.current`, :307+) would then OVERWRITE the draft it failed to read. Silent-overwrite risk is real. Build proceeds. Test-coupling constraint noted for the builder: the effect's comments (:277–284) say autosave RTL tests drain the exact then→catch promise ticks — no `.finally` links.
- **A2 — identified.** WizardForm.jsx:342 guards `getLeaderboardPoints(tenantId, uid)` — the one-time prior-points read used by Celebration for level progress; the comment documents "non-existent doc → priorPoints stays 0". Failure degrades to the same value as absence (0) on a secondary gamification display beside an unaffected primary flow. Disposition per the operator rule: **KEEP** (failure-degrades-to-absent-equivalent on secondary enrichment) — builder confirmed submissionService.js:191–193 (`snap.exists() ? parseFloat(points)||0 : 0`; absent→0, throws only on real failure). No contradiction; line unchanged.
- **A5 — data supported option (a).** `cbttComplianceFlag` (src/utils/cbttCompliance.js:25–37) reads only per-agent fields (`licenseStatus`, `contractStartDate`, `cbttExtensionGranted`) — no cross-unit aggregation, no company-level obligation. CBTT deadlines attach to individual provisional agents, so a unit cut is regulatorily meaningful; the filter was extended (no "(all units)" label needed — the section now genuinely follows the scope). Builder flagged a polish nit: the CBTT header doesn't announce the active scope explicitly (matches the filing roster's precedent) — banked below.
- **A1 builder field-note (banked):** with Firestore offline persistence (`persistentLocalCache`), a draft read may resolve from cache rather than reject, so the new error card may fire less often in the field than unit tests imply — the RTL proof covers the state machine, not the SDK's cache fallback. A live induced-failure verification is impractical tonight (banked with the Run 6 error→Retry live-smoke note).

## Tier B selection (B2 — written before building; selector: Fable orchestrator, satisfies the Opus floor)

Criteria applied: no operator ruling needed · not on ABSOLUTE STOPS · no money/payout path · confidently boundable + live-smokable in a short window with the 45-min reserve intact · reliability > capability > cosmetic.

**SELECTED (priority order — drop from the bottom):**
1. **B-1 Kiosk `getKioskTenantUsers` degrade fix (build-map Tier-3 #15 slice, SEC-012).** The one functional/reliability bug in the backlog: agent names fall back to "Agent" tenant-wide on the kiosk. Reliability-first per the brief's preference order. Opus (likely touches the kiosk token read path; rules change if needed is emulator-first + deploy-staging.ps1, autonomous). SCOPE GATE: if the fix requires redesigning kiosk auth (not just a narrow rules arm / query fix), STOP and bank — not boundable in this window.
2. **B-2 Policy Ledger finish (Tier-2 #12, S).** Insured name shown when insured≠owner + wire the Export-proof button. User-visible capability, small. Sonnet. Scope gate: if Export-proof needs NEW document-generation machinery (not an existing export util), ship insured-name only, bank export.
3. **B-3 Team Dashboard KPI slice (Tier-1 #6 slice, S).** Add Active-Agents + Persistency KPI cards to `BranchKPIStrip` from already-loaded overview data. Sonnet. The ranked ChampionsPanel + MyWeekPanel halves of #6 are NOT selected (M-sized, weaker bound).
4. **B-4 (stretch) Login trust affordances (Tier-4 #19, S).** Caps-lock warning + help footer/trust line + carded error. Cosmetic-to-UX; public surface, trivially live-smokable. Sonnet. Built only if the window still holds after B-1..B-3 + Tier A integration.

**REJECTED (with reasons):** Nav mobile polish (drag-reorder semantics on mobile = fiddly bound, mostly cosmetic) · AgentDrillDrawer completion (M, multi-tab integration) · Commission scenarios (M, multi-part) · Wizard Celebration polish (M + collides with A1's WizardForm work this run) · Persistency coaching share (notification write path needs design care) · Meeting Awards-within-reach scene (M presentation) · Kiosk Noticeboard + per-slide toggles (new panel + write path, M) · All Users roster (M multi-part) · EditUserDrawer commission-rate/overrides (commission-rate is money-adjacent — excluded under the no-money-path criterion) · Company Config inheritance cascade (explicitly deferred to CC v2 by the audit).

## Banked follow-ups (Run 7)

- **Campaign proof export**: `CampaignLensPanel`'s export button stays honestly disabled — no existing export util covers the per-campaign contribution shape. Minimal next step: a small CSV export of `lens.contributions` (policy, plan, state, value). New doc-gen machinery → scope-gated out of this run.
- **CBTT header scope label polish**: CBTT now follows the ScopeSwitch (A5) but its heading doesn't announce the active scope (matches the filing-roster precedent). If every scoped section should self-announce, that's a small copy pass.
- **A1 field-behavior caveat**: with `persistentLocalCache`, a draft read may resolve from cache instead of rejecting — the new draft-load error card is proven at the state-machine level (RTL), not against a live induced Firestore failure.
- **Persistency KPI card (B-3 half)**: needs either a precomputed branch-persistency aggregate (leaderboards-style) or acceptance of the O(agents) fan-out on the overview. Design wants it (manager-v2-shared.jsx:497 KpiStrip 5-card spec); data model doesn't support it cheaply yet.
- **BranchKPIStrip 5-card wrap**: not visually verified at the sm breakpoint in a live browser (pattern matches PipelineStrip's identical grid) — one glance in the morning.

## DECISIONS-NEEDED

(none yet)

## Ruled no-work this run (from brief)

DailyCaptureV2.jsx:644 KEEP · §5 RankedLeaderboard ruling confirmed · Policy Reconciliation ABSOLUTE STOP · payout writes ABSOLUTE STOP · functions/ runtime ABSOLUTE STOP.

## Ranked next-list (for the following session)

1. **Persistency KPI card** (B-3 half) — needs a precomputed branch-persistency aggregate (leaderboards-style CF-written doc) OR an accepted O(agents) fan-out on the overview. Design wants it (manager-v2 KpiStrip 5-card spec).
2. **Kiosk roster parity** (B-1 remainder) — celebrations/compliance/photos still degrade on the kiosk when the users list is denied. Clean fix: a CF-written `leaderboards/{branchId}`-style branch-roster aggregate carrying name+photo+unit only (no email/phone) — no rules widening.
3. **Campaign proof export** (B-2 remainder) — a small CSV of `lens.contributions` (policy, plan, state, value); new util, no existing export covers the shape.
4. **Team Dashboard #6 remainder** — ranked ChampionsPanel (vs count grid) + MyWeekPanel player-coach own week.
5. **Build-map Tier-1 #7** AgentDrillDrawer completion (Notes/Joint-Work tabs + RecommendGoal), **Tier-2 #10** Commission scenarios, **Tier-4 #17** All Users roster — all M-sized, next-window candidates.
6. **ATTENDED-ONLY (do not autonomously start):** Policy Reconciliation 8-flag taxonomy · functions/ Node-20 migration · any payout-release write path.

## Morning handoff

**Two-part run: operator-ruling closeout (Tier A) + a fresh build-map slice (Tier B) — both fully shipped, plus a real testware bug caught and fixed at the baseline gate.**

**Baseline caught a genuine seeder bug (not app regression).** First Sunday since the VH suite was authored exposed that the week-keyed `uid_<sunday>` doc-id fixtures leak one stale doc per subject per collection on every week-rollover — `+11,500` YTD residue failed 9 legs. Root-caused and fixed inside the 45-min gate: seeder now sweeps week-keyed residue (`109b4063`); 3 additionally-fragile legs made date-robust (`70a716ee`). App code was exonerated (Master Sheet/WAR/config legs green on the same data).

**Tier A — all 5 operator rulings shipped:**
| SHA | Item |
|---|---|
| `0dd3701f` | A1: WizardForm draft-load failure now surfaces (error card + Retry) AND blocks both overwrite vectors (autosave guard + unrendered footer/steps). Operator's Firestore model confirmed. |
| — | A2: WizardForm:342 = getLeaderboardPoints; absent→0 === failure-fallback 0 → KEPT (confirmed). |
| `2066d366` | A3: kiosk quiet "Reconnecting…" on initial-load failure only; refresh stale-beats-error unchanged. |
| `bd474304` | A4: JointCallsTab prospect-prep failure now surfaces like its sibling (drift closed). |
| `233650b4` | A5: CBTT section now honors the ScopeSwitch (per-agent data → option (a), filter extended). |

**Tier B — new build-map slice, all 4 selected shipped:**
| SHA | Item |
|---|---|
| `57567786` `03caee6c` | B-1: **SEC-012** kiosk names — real names on the wall via submission-carried `agentName`; NO rules widening (rejected the email/phone-enumeration path). **Live-verified.** |
| `38f1360a` | B-2: Policy Ledger insured-name (insured≠owner); export-proof scope-gated + banked. |
| `9c7759a8` | B-3: Team Active-Agents KPI card (zero new reads); Persistency banked. |
| `27db30cf` | B-4: login caps-lock hint + trust footer + carded error. |

**Gates:** lint clean · build clean · full unit suite **5357** (one MeetingMode timeout under 2-fork contention → 10/10 solo, flake on an untouched surface) · **E1: 44 legs = 43 PASS / 0 FAIL / 1 expected SKIP, zero regressions, zero reverts.**

**Not shipped / banked:** see § Banked follow-ups + ranked next-list. Nothing from the brief was dropped — every Tier A ruling and every selected Tier B item shipped.

**E3:** HOLD — no merges to main, zero prod contact (every leg's tripwire green), nothing further.
