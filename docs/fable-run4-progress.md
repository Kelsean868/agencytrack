# Fable Run 4 — Progress Log

Run start (TT): 2026-07-10 day (semi-attended). Start HEAD: `7ce74cf0` (staging).
Brief: [`docs/briefs/fable-run4-kickoff.md`](briefs/fable-run4-kickoff.md).
Design authority: [`docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/`](design-system/screens-v2/design_handoff_sheet_celebrations_planner/README.md).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Handoff relocation + catalog | ✅ | `c0351e1e` — moved to screens-v2/, funnel set supersedes mastersheet-v2-* for Master Sheet surface |
| 0.2 Run docs committed | ✅ | `bf881e4f` |
| 0.3 Baseline re-seed + full VH suite (36 legs) | ✅ | **Effective 36/36** — raw 35/36; the one FAIL (`t3-appt-churn-postpone`) was a date-math fixture bug (leg authored Thursday; fixed +2d fixture spills into next planner week on Fri/Sat runs). Seeder clamps d2a to min(+2d, Saturday) — `391c73fa`; leg re-run PASS. Log: out/run4-baseline-vh.log |
| Item 1 Funnel Master Sheet (Opus) | ✅ | `b626f03d` (funnelModel + unit tests) → `7148b0b1` (table rebuild) → `9c4d1250` + `c05d6e97` (VH leg). Lint clean, suite 5106 green, build clean; deploy success; live leg PASS value-level (Prospecting KPI 65 & Contact Attempts KPI 40 == sub-column sums), console-clean, zero prod requests. FLAGGED-A `funnelModel.js:99`, FLAGGED-B `funnelModel.js:132-134`. serviceCalls excluded from all sums (unit-tested), preserved in drill record |
| Item 2 Filters panel (Opus) | ✅ | `a003f85d` — new pure `funnelFilters.js` (16 tests) + UNIT segmented + FILTERS popover (report chips, no-log switch, dismissible chips, CLEAR ALL). Suite 5122 green, deploy success, legs `t1-master-sheet` + new `t1-master-sheet-filters` both PASS (2 filters → 1 BM row, totals API 8,500, reality bar unfiltered 26,200, chip-clear restores 3). Omitted-as-unbuildable: STATUS taxonomy (needs YTD+companyMinimums read path), LEVEL (no level field on user docs), unit friendly names — banked |
| Item 3 FunnelMeetingScene (Opus) | ✅ | `09cb1168` — scene-local projection renderer (presentation tokens) reusing funnelModel un-forked; shared `funnelRowIsException` lifted into model; deck 9→10 scenes ('funnel' after 'production', hasSubs-gated); no new read paths. Suite 5134 green; legs `t3-meeting-funnel-sheet` (new, value-level: Prospecting KPI 65 & CA 40 == sums, totals 26,200/195, exceptions cut 3→0) + `t3-meeting-mode-deck` (10 scenes) + both t1 master-sheet legs PASS |
| Item 4 Streak celebration reskin (Sonnet) | ✅ | `876ff6ca` — skin-only: gold poster-scale milestone hero, medal coin, STREAK/BEST/NEXT chips, teal CTA, ESC pill; 52-wk starred variant. Thresholds/fire-once mechanics untouched (celebrations.js:37, celebrationPrefs.js:70-78 unedited); `login()` dismiss selector preserved (single `aria-label="Dismiss celebration"` control). Suite 5138 green; `t2-filing-streak-milestone` + adjacent `t2-daily-anchor-strip` (auto-dismiss proof) both PASS w/ screenshots |
| Item 5 Planner recurrence (Opus) | ✅ | `ce3b9643` — schema `seriesId/repeatRule/daysOfWeek/seriesPos/seriesTotal` (all optional, backward-compat; `seriesEnd`+`postponedFrom` dropped — self-describing instances); concrete materialization via atomic writeBatch, cap 52; validApptWrite extended (optional-key pattern), emulator 28/28; Never chip disabled-dashed "soon"; edit-this-only shipped, edit-all-future BANKED (needs composite index + batch — disabled row); FREE blocks recur too. Suite 5157 green; legs `t3-appt-recurrence` (new) + churn-postpone + edit-own all PASS; seeder `vhleg-recur` cleanup proven (5 del → 0). Rules deployed to staging via deploy-staging.ps1 (orchestrator, per brief's explicit dispatch; agent held per Rule 19) |
| Item 6 1-on-1 recon doc (Sonnet) | ✅ | `20ac7cae` — docs/audits/one-on-one-recon-2026-07-10.md (validity-SHA header @ bf881e4f). Scene 08 is read-only display; today's surfaces are two UNWIRED components (AgentDrillDrawer 3-tab + CoachingNotesModal 3-tab); commitment logging needs human-gated rules; 10 one-line design questions banked in doc §4 |
| E1 re-seed + full suite | ✅ | re-seed 93 docs, then **39/39 PASS, 0 FAIL, 0 SKIP** (36 pre-existing + t1-master-sheet-filters + t3-meeting-funnel-sheet + t3-appt-recurrence; Items 1/4 extended existing legs). Run against DEPLOYED recurrence rules. No regressions, no reverts. Log: out/run4-e1-final-vh.log |
| E2 final doc + push | ✅ | this commit; verbatim origin line below |
| E3 HOLD | ✅ | no merges to main, no prod, nothing further |

## Dispatch / telemetry

| Item | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| 0.1 relocation | Fable (orchestrator) | ~13:05 | 13:12 | ✅ | `c0351e1e` |
| 0.2 run docs | Fable (orchestrator) | 13:15 | 13:20 | ✅ | `bf881e4f` |
| 0.3 baseline (36 legs, bg) | orchestrator | 13:25 | 13:35 | ✅ eff. 36/36 (+fixture fix `391c73fa`) | — |
| Item 6 recon | Sonnet | 13:26 | +5.1 min | ✅ doc | `20ac7cae` |
| Item 1 funnel sheet | Opus | 13:26 | +45.3 min | ✅ live leg PASS | `b626f03d` `7148b0b1` `9c4d1250` `c05d6e97` |
| Item 2 filters panel | Opus | 14:30 | +21.4 min | ✅ 2 legs PASS | `a003f85d` |
| Item 3 meeting scene | Opus | 14:55 | +23.8 min | ✅ 4 legs PASS | `09cb1168` |
| Item 4 streak reskin | Sonnet | 15:20 | +40.0 min | ✅ 2 legs PASS | `876ff6ca` |
| Item 5 recurrence | Opus | 16:02 | +47.5 min | ✅ 3 legs PASS, emulator 28/28 | `ce3b9643` |
| staging rules deploy | Fable (orchestrator) | ~16:30 | ~16:37 | ✅ rules+indexes+functions → agencytrack-staging only | — |
| E1 full suite (39 legs, bg) | orchestrator | 16:39 | ~17:00 | ✅ 39/39 | — |

## DECISIONS-NEEDED

1. **FLAGGED-A — Contact-Attempts "Tel" composition** (pinged 13:2x, 30-min window expired unanswered → built with default). Built as `followUpCalls + seminarTradeshowCalls` — the two tel channels not operator-assigned to Prospecting; fits the operator's own "known person" principle (seminar/tradeshow names are known persons). Flip = one line at `src/utils/funnelModel.js:99`.
2. **FLAGGED-B — Referrals group decomposition** (same ping/window). Canonical `totalNewNames` INCLUDES `referralsObtained`, so naive Referrals+NewNames=Total double-counts. Built as: group Total = canonical `computeTotalNewNames()`, Referrals = `referralsObtained`, New Names = the 4 non-referral channels. Flip = `src/utils/funnelModel.js:132-134`.
3. **Recurrence `ENDS=Never` materialization** (pinged 13:4x re Item 5). Mockup implies concrete instance docs ("4 of 12", "Books 12 appointments") but `Never` can't materialize infinitely. Recommendation: this slice requires an end condition (On date / After count); `Never` chip deferred pending a rolling-horizon ruling. Item 5 will build per recommendation unless answered before dispatch.
4. **Orphaned Settings control — "Default Master Sheet preset"** (pinged on Item-1 completion). Funnel RANK BY replaced the 5-column-preset mechanic; `SettingsScreen.jsx:155` dropdown now writes `masterSheetPreset` which nothing reads. Options: (a) remove control, (b) repurpose for RANK BY, (c) leave as no-op. Default if unanswered: (c) + this banked FU.
5. **(Carried from brief, do not build)** Company Config toggle "count converted service calls as Tel Contacts", default off — banked follow-up only.

## Operator pings

| # | Time (TT) | Topic | Window | Outcome |
|---|-----------|-------|--------|---------|
| 1 | ~13:25 | Item 1 FLAGGED-A/B mapping confirm | 30 min | expired unanswered → defaults built, DECISIONS #1/#2 |
| 2 | ~13:45 | Item 5 `Never` materialization | 30 min | pending at Item-5 dispatch → DECISIONS #3 |
| 3 | ~14:20 | Settings preset control disposition | 30 min | pending → DECISIONS #4 |

## Observations (non-blocking)

- Concurrent full `vitest run` processes cause `STACK_TRACE_ERROR` worker-contention flakes — run suites singly (Item-1 agent; also settles serialize-builds policy for this run).
- Seed anchors for funnel VH work (strong subBody): Prospecting 65, Contact Attempts 40, Contacts Made 60, QA 20, FFI 10, CI 10, Referrals 15.
- Item-1 intentional divergence: `#` rank stays production-credit standing under column sorts (mockup re-numbers); matches existing rank tests.
- Item-1 dense-table exception: per-stage +/− header toggles are full-cell-height (<44px) on the 32px header row; the 44px-compliant path is the VIEW Totals/+Details control.
- Compliance-era columns (daysWorked/weekend/weekendApi/policiesDelivered/serviceContacts/targets/closingRatio) are not funnel columns — remain in drill record + CompliancePanel.
- Item-6 recon premise correction: no drill drawer lives off MasterSheet.jsx today; drill surfaces are AgentDrillDrawer (Team Dashboard) + CoachingNotesModal (Master Sheet hover), unwired to each other.
- Item-2 filter banked follow-ups: STATUS filters need YTD+companyMinimums(+persistency) loaded on Master Sheet (deriveExceptions currently called with companyMins:null); LEVEL filter blocked on populating a career-level field on user docs; unit friendly-name lookup absent (labels fall back to `Unit <last4>`).
- Item-2 gap: filters popover not explicitly axe'd in dark theme (tokens are theme-aware; base surface covered by xc-dark-contrast at E1) — spot-check popover-open dark contrast in a future pass.
- Item-2 semantics: reality bar unfiltered (mockup), totals row follows filtered set, CSV stays search-scope; no-log = daysWorked absent (shipped NO-LOG badge semantic), not "no submission" (non-filers have no row).
- Item-3 gaps: funnel projection scene not axe'd specifically (weakest spot: Draft tag `text-warning` on `bg-warning/15` over dark); exceptions-cut "keeps draft row" direction unit-only live; narrow-viewport projection scroll unverified beyond default meeting frame.
- Item-4 gap: reduced-motion static variant + dark-mode of the reskinned takeover not live-verified (code mirrors shipped CelebrationTakeover pattern; xc-reduced-motion at E1 covers dashboard hero, not the takeover). Quick manual OS-level check recommended pre-promotion.
- Item-5 gaps: "other series instances unchanged" verified indirectly (future-week instances not UI-visible in current-week view — safe by construction, no positive assertion); custom-days + end-by-date series unit-tested only (weekly-by-count live-smoked); state-3 choice sheet has one live option until edit-all-future ships.
- Item-5 banked: edit-this-and-all-future needs cross-week `(agentId, seriesId, date)` query + composite index + multi-doc batch — deferred whole, no half-correct series edit. `Never` end condition deferred (DECISIONS #3).

## Handoff

### Shipped to staging (all live-verified against the staging deploy + deployed rules)
| What | Commits | Live proof |
|---|---|---|
| CD handoff relocation + catalog precedence | `c0351e1e` | n/a (docs) |
| VH fixture date-math fix (churn leg Fri/Sat trap) | `391c73fa` | leg re-run PASS; E1 PASS |
| Item 1 — Funnel Master Sheet (8 stages, funnelModel, RANK BY) | `b626f03d` `7148b0b1` `9c4d1250` `c05d6e97` | t1-master-sheet PASS (KPI==sums value-level) |
| Item 2 — Filters panel (UNIT + report/no-log, chips) | `a003f85d` | t1-master-sheet-filters PASS (2 filters → 1 row → chip-clear restore) |
| Item 3 — FunnelMeetingScene (deck scene 5 of 10) | `09cb1168` | t3-meeting-funnel-sheet + t3-meeting-mode-deck PASS |
| Item 4 — Streak celebration reskin (skin-only) | `876ff6ca` | t2-filing-streak-milestone + adjacent auto-dismiss PASS |
| Item 5 — Planner recurrence (series create/badge/scope-locked postpone) | `ce3b9643` + rules deploy | t3-appt-recurrence PASS (write-read-verify); emulator 28/28 |
| Item 6 — 1-on-1 recon doc | `20ac7cae` | n/a (read-only, validity-SHA header) |

### Operator attention queue (ordered)
1. **DECISIONS-NEEDED #1/#2** — FLAGGED-A/B funnel mappings built with defaults; flip points `funnelModel.js:99` / `:132-134`.
2. **DECISIONS-NEEDED #3** — recurrence `Never`: currently disabled-dashed "soon" chip; needs rolling-horizon ruling.
3. **DECISIONS-NEEDED #4** — Settings "Default Master Sheet preset" dropdown is now a no-op writer; choose remove/repurpose/leave.
4. **Item 6 doc §4** — 10 one-line 1-on-1 design questions.
5. Pre-promotion manual checks banked: celebration reskin reduced-motion + dark; funnel projection scene axe pass; filters popover dark contrast.
6. Banked build follow-ups: STATUS filters (needs YTD+companyMinimums read path), LEVEL filter (needs level field), unit friendly names, edit-this-and-all-future (needs composite index + batch), converted-service-calls config toggle (locked: do not build until ruled).

### Verbatim origin line (E2)
```
871625e8 docs(run4): E1 39/39 + final handoff (E2)
```
(Recorded post-E2-push per Run-3 housekeeping pattern; this recording commit follows it.)
