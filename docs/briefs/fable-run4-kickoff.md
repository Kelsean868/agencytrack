# Fable Run 4 — Semi-Attended Staging Run (2026-07-10)

Orchestrator: Fable 5. 8-hour window, **semi-attended**: operator reachable but in meetings.
Workspace: `C:\Projects\at-fable-staging` (branch `staging`, start HEAD `7ce74cf0`; Phase 0.1 relocation landed as `c0351e1e`).
Cadence: ONE-LINE status at each item completion. Product rulings: PING operator, wait max 30 min → no answer → bank to DECISIONS-NEEDED, continue. Subagents pinned per item. Depth-first.

## Hard constraints (unchanged from Run 3)

1. **NEVER touch prod** (`agencytrack-2a610`) — hygiene legs assert zero prod requests. Staging Firebase deploys ONLY via `scripts/staging/deploy-staging.ps1`.
2. **NEVER merge to main.**
3. **No payout-release logic.**
4. **Goals v3 out of scope.**
5. Seeder always `--env-file=.env.staging`.
6. Smokes: value-level, owning subject, write-read-verify for mutations, console-clean everywhere.
7. Ambiguity → ping operator (30-min timeout) → bank + continue. No guessing.

## Design authority

`docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/` (relocated in Phase 0.1; new CD handoff: funnel sheet, meeting scene, celebration, recurrence). **Mockup wins for looks; repo wins for schema.** For the Master Sheet surface this handoff supersedes `mastersheet-v2-*` (catalog updated).

## Phase 0

- **0.1** Relocate handoff into `docs/design-system/screens-v2/` per DESIGN-FOLDER-CATALOG.md convention; catalog updated (mastersheet-v2-* superseded for Master Sheet). ✅ `c0351e1e`
- **0.2** This brief + `docs/fable-run4-progress.md`. Commit.
- **0.3** Baseline: re-seed (env-file) + full VH suite (36 legs post-Run-3). Non-flake failure → 60-min investigate, else restrict run to Item 1 only.

## Items

### Item 1 — FUNNEL MASTER SHEET (Opus 4.8)
Rebuild `MasterSheet.jsx` per funnel mockup (`mastersheet-funnel-*.jsx` + `AgencyTrack Master Sheet Funnel.html`):
- 8 stages, funnel order: ①Prospecting Activities ②Contact Attempts ③Contacts Made ④Qualified Approaches ⑤FFIs (KPI=Conducted) ⑥CIs (KPI=Conducted) ⑦Results (API=terminal, teal, TTD tabular-nums) ⑧Referrals.
- **COLUMN MAPPING (operator-locked):** Prospecting Activities = lettersEmailsSent + seminarsConducted + coldCanvass + referralCalls. Contact Attempts = Tel Attempts + followUpCalls (operator ruling: follow-ups are attempts to reach a known person, NOT prospecting) + F2F Attempts. Contacts Made = telContacts + f2fContacts. **serviceCalls EXCLUDED from all funnel sums** (servicing ≠ new-business activity; converted outcomes already enter as FFI Scheduled / Qualified Approach where they land) — keep serviceCalls visible in drill/detail views so nothing leaves the record. Banked follow-up (do NOT build): Company Config toggle "count converted service calls as Tel Contacts", default off. **Verify every mapped field name against `extractFields.js` before writing code (Rule 17).**
- Collapsed-to-KPI default; VIEW toggle (TOTALS ↔ +DETAILS); per-stage +/− in group headers; two-tier sticky header + pinned Agent/Status through both scroll axes; tri-state column sorting (↓→↑→default YTD) + dismissible sort chip; pinned team-totals row; IK tag linking FFI+CI Conducted; teal reserved for terminal KPI; exceptions toggle, reality bar, API↔NEW NAMES preset carried over intact; narrow-viewport stage scrubber per mockup scene 11.
- Tests: unit coverage for every stage sum incl. followUpCalls placement and serviceCalls exclusion. Extend `t1-master-sheet` leg: ≥2 group KPIs equal the sum of their seeded sub-columns at value level; collapsed default renders; expand-one-stage works.

### Item 2 — FILTERS PANEL (Opus 4.8)
Status · level · weekly-report · no-log conditions, dismissible chips, stacked with UNIT control, per mockup scene 06. Leg: apply two filters, assert row count against seeded data, clear via chip ×.

### Item 3 — MEETING SCENE, sheet-in-the-room ONLY (Opus 4.8)
FunnelMeetingScene per mockup scenes 09–10 — projection-dark live table in Meeting Mode with VIEW/stage toggles, header sorting, agent search, exceptions cut. Full deck redesign explicitly OUT (future deliverable). Extend/add a meeting-mode leg assertion.

### Item 4 — STREAK CELEBRATION RESKIN (Sonnet 4.6)
Skin-only per celebration mockup; thresholds 5/10/25/52 and fire-once mechanics UNTOUCHED; reduced-motion static variant; harness auto-dismiss in `login()` must keep working (update selector if markup changes). Re-run streak leg + one adjacent leg to prove the dismiss still works.

### Item 5 — PLANNER RECURRENCE (Opus 4.8)
The recurrence mockup is the design source Run 3 lacked. **OPERATOR-SETTLED semantics (not ambiguities):** past instances never change; postpone is single-instance only (series changes via Edit); postponed/cancelled instances retained + dimmed, never deleted. Resolve Run 3's banked recurrence questions (Run 3 DECISIONS-NEEDED #3: cadence, termination, materialization, edit scope, cancel-series semantics, what recurs) against the mockup; anything genuinely unanswered → ping operator (30-min timeout → bank + build only what's settled). Rules: extend `validApptWrite` for recurrence fields — emulator tests first, `deploy-staging.ps1`, live verify. New leg: create weekly series → verify instances → postpone ONE instance → verify series intact + postponed instance dimmed-retained (write-read-verify).

### Item 6 — RECON ONLY (Sonnet 4.6, no build)
1-on-1 takeover surface (mockup scene 08 is a first pass, not settled). Read-only recon doc: what the drill drawer has, what a real 1-on-1 surface needs (talking points, in-room note capture, action logging), open design questions. → `docs/audits/one-on-one-recon-2026-07-10.md`. Include a **validity-SHA header** (recon docs must state the HEAD they describe — new standing rule).

## Run end

- **E1** Re-seed + full suite (36 + new legs); regression → revert offending item (operator-locked).
- **E2** Progress doc: final table, telemetry, SHAs, DECISIONS-NEEDED, handoff; verbatim `git log origin/staging --oneline -1` in the doc.
- **E3** HOLD.

Depth-first: fewer items fully built + value-level smoked beats many items rough.
