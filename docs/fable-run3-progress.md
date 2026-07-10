# Fable Run 3 — Progress Log

Run start (TT): 2026-07-09 night. Start HEAD: `ef5e97c3` (staging).
Brief: [`docs/briefs/fable-run3-kickoff.md`](briefs/fable-run3-kickoff.md).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | ✅ | `63dddd74` |
| 0.2 H1 seeder env-guard (Sonnet) | ✅ | `31f817b6` — guard before any init/mutation; red-verify exit 1 zero writes; green 92 docs |
| 0.3 Baseline re-seed + full VH suite | ✅ | **33/33 PASS, 0 FAIL, 0 SKIP** (t2-financing-k9-k7 passed this run too); log at out/run3-baseline-vh.log |
| H2 harden t2-financing-k9-k7 | ✅ | `61bbf11a` — awaits K7 roster row ("Staging Agent Two" scoped in risk panel, 20s) replacing fixed 800ms wait; FAIL screenshots via try/catch+shot both halves. **Live: 3× consecutive PASS** (01:40:05/01:40:48/01:41:38 vs deploy 9cc5d2a2). One unrelated LOGIN-TIMEOUT flake on a rapid back-to-back run — banked as observation below. |
| H3 MasterSheet collapse → "Persons Reached" | ✅ | `6808121e` — 3 refs removed (col def, Recruiting preset, row builder); CSV auto-follows COLS; suite 5063/5063, lint+build clean. Live-verified vs deploy 9cc5d2a2: t1-master-sheet PASS incl. new collapse assertions (`c2e66e08` — Persons Reached present / Contacts Made absent in Recruiting + All). |
| H4 jointCalls index reconcile | ✅ no-op | live query `managerWarService.js:203-209` (collectionGroup: authorUid ==, tenantId ==, appointmentDate range) served by existing COLLECTION_GROUP composite `(authorUid, tenantId, appointmentDate)` in firestore.indexes.json; staging has it live — proven by console-clean `t2-war-review-roundtrip` PASS tonight (ManagerWarTab.jsx:102 calls getOwnJfwCount on mount). No code change, no deploy. |
| H5 out/ gitignore | ✅ no-op | already covered — `.gitignore:147 out/` (verified via `git check-ignore -v out/` at run start) |
| R1 tier0-smoke rebase → PR-open-HOLD | ✅ | rebase path clean (0 conflicts — phantom-conflict prediction didn't materialize); gate diff = smoke file (+1153) + 1 SMOKES.md row ONLY; fresh branch `chore/tier0-smoke-r1` @ `6083c911`; PR #850 OPEN + HOLD, not merged. Caveat in PR body: smoke's Tier-0 assertions unverified against post-redesign main (operator review). |
| F1–F7 missing heroes | 🔄 re-scoped | Audit re-verified against staging HEAD: items A (Daily Capture anchor), B (Prospect Prep), C (Financing K9 hero), G (Meeting Mode deck) ALREADY BUILT by prior runs and VH-asserted tonight. Item F (Money Needs flag) → DECISIONS-NEEDED #1. **Item D ✅** `c2d9516c` — UM Unit Aggregate now glass.hero.teal + hero-ink tokens + Agents stat (exact BM parity); parity unit test added (9/9), lint+build clean; live-verified 02:50 via one-off check (hero + 4 stats, hygiene clean). **Item E ✅** `138fda81` → merge `e9043305` — completion card promoted to `.glass.hero.teal` MyWarCard (ring hero-variant tokens, MY API count-up w/ reduced-motion snap, apps, streak dots gold); own-week figures via existing `getAgentSubmissions` + `extractFields` (no new read path); suite 5071/5071; VH war leg extended w/ exact seeded values (TTD 5,200/1 · TTD 7,500/2). Live-verified 02:43-02:50 (item-legs round vs deploy 6dd81811). |
| F8 pinned-tab de-emphasis | ✅ built+merged | `cea9fabc` → merge `56ef636b` — pinned star 14→12px + `--color-primary`→`--color-text-muted` (AA both themes: ~5.7:1 light / ~7.4:1 dark, ≥3:1 icon floor; pinned state triple-redundant: Pinned zone + filled glyph + always-visible); 44px hit target unchanged (star is also the pin toggle); unpinned untouched. New `t1-pinned-tab-deemphasis` leg (pin→assert→unpin restore, MUTATES prefs). Suite 5066/5066. Live-verified 02:43-02:50 (item-legs round vs deploy 6dd81811). |
| F9 WAR reviewStatus pill (C3) | ✅ built+merged | `75717d6d` → merge `4e3853fa` — owner my-war shows StatusPill (approved/changes_requested) + "Reviewed by {name} · {date}" + 44px note disclosure; pure read of existing reviewStatus/reviewedByName/reviewNote fields (no rules change); review fields isolated from form state so they can't leak into auto-save. VH war leg finding flipped to hard assertions. Suite 5065/5065. Live-verified 02:43-02:50 (item-legs round vs deploy 6dd81811). |
| F10 streak milestones (C4) | ✅ built+merged | `f36f45a6` → merge `f0fd7d67` — `FILING_WEEKLY_STREAK_MILESTONES [5,10,25,52]` (operator defaults; no banked week-thresholds existed) via shared resolver; fires on HomeV2 load (goals-precedent fire-on-load, daily-precedent owner-surface); fire-once via per-year localStorage `filingStreakMax` marker (goals semantics); reduced-motion via shared CelebrationTakeover. New `t2-filing-streak-milestone` leg (fires at 5 w/ seeded 9-wk streak → dismiss → absent on reload). Suite 5074/5074 (sharded). **Cross-leg risk mitigated:** shared `login()` now auto-dismisses any on-load celebration takeover (2.5s probe) so fresh-context legs' first click can't be intercepted; the filing leg opts out (`dismissCelebration:false`). Live-verified 02:43-02:50 (item-legs round vs deploy 6dd81811). |
| F11a planner recon | ✅ | `docs/audits/planner-spine-recon-2026-07-10.md` — planner fully shipped + un-gated; edit-in-place plumbed (service+sheet+rules) but NO UI entry point; recurrence has ZERO design source → 6 ambiguities banked below |
| F11b planner contract | 🔄 re-scoped | slice 1a = edit-in-place trigger only (contractible, no rules/index change); slice 1b recurrence BLOCKED → DECISIONS-NEEDED #3 |
| F11c planner slice 1a | ✅ built+merged | `5b8f9bb2` → merge `5985fc03` — "Edit details" in ChurnDialog → AppointmentSheet mode:'edit' → existing updateAppointment; owner-scoped structurally + rules-enforced; NO rules/index/service changes. New `t3-appt-edit-own` leg (write-read-verify on vhfix-appt-t1, disjoint from postpone leg); team-planner leg asserts edit affordance ABSENT. Suite 5068 pass (3 known Tinypool timeout flakes re-run green). Live-verified 02:43-02:50 (item-legs round vs deploy 6dd81811). |
| E1 reserve: re-seed + full VH | ✅ | re-seed 92 docs, then **36/36 PASS, 0 FAIL, 0 SKIP** (33 pre-existing + t1-pinned-tab-deemphasis + t2-filing-streak-milestone + t3-appt-edit-own). No regressions, no reverts. Log: out/run3-e1-final-vh.log |
| E2 final doc update + push | ✅ | this commit; verbatim origin line below |

## Dispatch / telemetry

| Item | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| recon | Fable (orchestrator) | ~01:00 | 01:10 | env/layout verified; H4+H5 found no-op | — |
| H1 | Sonnet | 01:11 | +2.5 min | ✅ guard, red/green verified | `31f817b6` |
| R1 | Opus | 01:14 | +2.7 min | ✅ clean rebase, PR #850 HOLD | `6083c911` (branch) |
| baseline VH 33 legs | orchestrator (bg) | 01:14 | 01:33 | ✅ 33/33 | — |
| F11a recon | Opus | 01:16 | +5.8 min | ✅ recon doc | (docs) |
| H2+H3 | Sonnet | 01:22 | +10.9 min | ✅ both, suite 5063/5063 | `61bbf11a`, `6808121e` |
| F9 | Opus | 01:36 | +25.8 min | ✅ suite 5065/5065 | `75717d6d` |
| F10 | Opus | 01:40 | +54.1 min | ✅ suite 5074/5074 (sharded) | `f36f45a6` |
| F8 | Opus | 01:45 | +40.3 min | ✅ suite 5066/5066 (4 shards) | `cea9fabc` |
| item D | Fable (orchestrator, inline) | 01:38 | 01:44 | ✅ 9/9 + one-off live PASS | `c2d9516c` |
| F-E | Opus | 01:49 | +26.3 min | ✅ suite 5071/5071 | `138fda81` |
| F11c | Opus | 01:50 | +24.4 min | ✅ suite green (Tinypool flakes re-run) | `5b8f9bb2` |
| full gate (merged tree) | orchestrator (bg) | 02:37 | 02:41 | ✅ 5088/5088, lint+build clean | — |
| item legs live round | orchestrator (bg) | 02:43 | 02:50 | ✅ 5/5 legs + item-D one-off (after week-select fix `6dd81811`) | — |

## DECISIONS-NEEDED

1. **Money Needs merged hero (audit item F / "flag flip"):** `VITE_MONEY_NEEDS_MERGED_ENABLED` is a build-time Vite env var (`MoneyNeedsPanel.jsx:23`). Enabling it for the staging deploy requires either (a) setting the var in the Vercel project env scoped to the `staging` branch (operator action — Vercel auth not available to the run), or (b) changing the code default, which would flip production on next promotion. Both are rollout decisions → skipped, no guess. Recommendation: (a), then re-run `smoke-money-needs-merged-local.mjs` semantics against staging.
2. ~~Prospect Prep hero (audit item B)~~ — RETRACTED: already built on staging (VH `t3-prospect-prep` passes: hero card, countdown framing, objection chips). The hero audit (#848) predates the Runs 1+2 promotion and lists as MISSING several items prior runs already landed.
3. **Planner recurrence (F11b slice 1b):** zero design source anywhere in the canonical planner handoff (recon doc § ambiguities, line-cited). Six open product questions need one-line rulings each: (i) cadence — weekly-only or more? (ii) termination — end-date / count / rolling window? (iii) materialization — concrete N docs (fits `allow delete:false`) vs virtual expansion? (iv) edit scope — this / this-and-following / whole series? (v) cancel-series semantics vs the postpone/churn model? (vi) what recurs — FREE blocks only, or prospect appointments too? Slice 1a (edit-in-place trigger) proceeds; recurrence does not.
4. **Daily-streak milestone reachability (original C4 bank, still open):** F10 built the *filing*-streak milestones; the previously banked daily-streak issue (`computeStreak` week-scoped max 6 vs `DAILY_STREAK_MILESTONES [5,10,20]` — rungs 10/20 unreachable, 5 only Fri/Sat) remains an operator ruling: cross-week streak read vs milestone table change. Unchanged tonight.
5. **Team Planner unitId assumption (from F11a recon, adjacent finding):** `AgentDashboard.jsx:824` passes `agentUnitId={userProfile?.unitId}` while the UM read-arm expects the UM's uid — correct only if `unitId` IS the UM uid. Data-shape check recommended before any Team-Planner slice. Not slice-1a-blocking.

## Observations (non-blocking)

- **LOGIN-TIMEOUT flake:** one `t2-financing-k9-k7` run failed at login (`staging-branch-manager@…`) when legs ran back-to-back with no gap (01:36:13 run); 20s spacing between runs → 3/3 clean. Suggests the shared login helper could use a retry-once-on-timeout, or per-leg runs need modest spacing. Not related to the K7 first-paint race H2 fixed.

## Morning handoff

### Shipped to staging (all live-verified against the staging deploy)
| What | Commits | Live proof |
|---|---|---|
| H1 seeder env-guard | `31f817b6` | red-verify exit-1 zero-writes; green 92 docs |
| H2 financing-leg harden | `61bbf11a` | 3× consecutive PASS |
| H3 MasterSheet "Persons Reached" collapse | `6808121e` + leg assertions `c2e66e08` | t1-master-sheet PASS w/ absence assertions |
| Item D — UM Unit Aggregate hero parity | `c2d9516c` | one-off live check PASS (hero + 4 stats) |
| F9 (C3) — owner WAR review pill + note | `75717d6d` | t2-war-review-roundtrip PASS (pill + reviewer + note) |
| Item E — My WAR MyWarCard hero | `138fda81` | same leg: MY API/APPS/STREAK row w/ exact seeded values |
| F10 (C4) — filing-streak milestones 5/10/25/52wk | `f36f45a6` + login-dismiss mitigation `5c7dae8d` | t2-filing-streak-milestone PASS (fire→dismiss→absent-on-reload) |
| F8 — pinned-tab pin de-emphasis | `cea9fabc` | t1-pinned-tab-deemphasis PASS (12px muted vs 14px, restore clean) |
| F11a — planner spine recon | doc `docs/audits/planner-spine-recon-2026-07-10.md` | n/a (read-only) |
| F11c slice 1a — appointment edit-in-place | `5b8f9bb2` | t3-appt-edit-own PASS (write-read-verify); team-planner edit-absent PASS |
| Incidental fix — WAR week-selector navigation trap | `6dd81811` | exposed by extended leg; unit test + live leg PASS |

### Held at PR (do not merge without review)
- [PR #850](https://github.com/Kelsean868/agencytrack/pull/850) — Tier-0 staging smoke rebased onto main (R1). Gate diff = smoke file + 1 SMOKES.md row only. Caveat in body: Tier-0 assertions unverified against post-redesign main.

### Banked / dropped + why
- **Money Needs merged hero (audit F):** build-time Vercel env flag — rollout decision (DECISIONS-NEEDED #1).
- **Planner recurrence (F11b slice 1b):** zero design source; 6 product rulings needed (DECISIONS-NEEDED #3).
- **Audit items A/B/C/G:** discovered already built by prior runs (audit #848 predates Runs 1+2 promotion) — VH-asserted tonight, no work needed.
- **Goals v3:** out of scope per operator gate — untouched.
- **Campaigns payout-release:** hard stop — untouched.

### Notes for the eyeball pass
- UM **Team Reports** now leads with the teal Unit Aggregate hero (was a plain card).
- **My WAR** (UM/BM) now leads with the glass hero (ring + MY API count-up + streak dots) and shows the reviewer's verdict pill when reviewed.
- **Agent home** fires the filing-streak celebration once per device/year at 5/10/25/52 weeks (seeded A1 = 9 wks → milestone 5 on first fresh-profile load).
- Pinned-tab stars are smaller/quieter; pinned zone unchanged.
- Agent planner: appointment cards → churn sheet → **Edit details** now opens the prefilled edit sheet.

## E1 final smoke table (verbatim)

```
════════ VH SMOKE RESULTS ════════
TIER LEG                                         ROLE            STATUS  DETAIL
0    sanity-deploy-reachable                     anon            PASS    login form rendered; console clean; no prod requests
0    sanity-agent1-login-populated               agent1          PASS    agent-1 dashboard: YTD 122000 + 9-wk streak verified; hygiene clean
1    t1-palette-agent-desktop                    agent1          PASS    palette dialog contract OK (aria-modal, input focused); "history"→Enter navigated to History (title="History", nav active); hygiene clean
1    t1-palette-bm-desktop                       branch_manager  PASS    Actions group present; "master"→Enter navigated to Master Sheet (reality bar visible, WEEK API=TTD 0); hygiene clean
1    t1-palette-agent-mobile                     agent1          PASS    mobile trigger visible 44x44px (≥44); opened palette + Escape closed; hygiene clean
1    t1-agent-report-populated                   agent1          PASS    Report populated: hero YTD 122000 + apps 22; floor line 122000/250000 @ 49%; hygiene clean
1    t1-admin-quick-add                          tenant_admin    PASS    FAB→QuickAdd: "New user" opened CreateUserDrawer ("Add New User"); "New branch" opened Add-branch modal; both dismissed, no submit; hygiene clean
1    t1-nav-drag-reorder                         agent1          PASS    drag swapped Career↕Awards in Recognition; persisted to a FRESH context (agent-tab-leaderboard,agent-tab-awards,agent-tab-career) via Firestore round-trip (writer held open for ACK); original order restored (agent-tab-leaderboard,agent-tab-career,agent-tab-awards); hygiene clean
1    t1-exception-lead-drill                     branch_manager  PASS    ExceptionLeadPanel flags Staging Agent Two (danger, type=floor), not Agent One; drill Report tab shows A2 YTD 8500; hygiene clean
1    t1-master-sheet                             branch_manager  PASS    W0 reality bar 0/1·1/2·2·TTD 3,000; presets toggle API(TTD)↔NEW NAMES; Only-exceptions→1 A1 draft row; 2026-06-28 WEEK API TTD 26,200, exceptions 1 (A2 non-filer), row filter 3→0; hygiene clean
1    t1-pinned-tab-deemphasis                    agent1          PASS    pinned star de-emphasized (size 12, muted ink rgb(107, 101, 96), not primary rgb(1, 105, 111)); unpinned control unchanged (size 14, no on-class); pin state restored (P=false, U=false); hygiene clean
2    t2-war-review-roundtrip                     branch_manager+unit_managerPASS    BM approved UM 06-28 (+reviewer name) & requested-changes UM 06-21 — both pills re-read; UM my-war: self-review controls ABSENT (denied); owner review pill + reviewer name shown for the approved week; changes-requested note affordance reveals the note text; My WAR hero (item E) renders the MY API/APPLICATIONS/FILING STREAK metric row with the seed own-production values (W-1 5,200/1, W-2 7,500/2).
2    t2-recruiting-kanban                        branch_manager  PASS    Nadia STALLED (funnel=1) verified; Anil advanced sourced→contacted, persisted in Contacted column after reload.
2    t2-settings-roundtrip                       agent1          PASS    Theme Dark applied + persisted across reload; default-period Month persisted (aria-checked); both restored to Light/Week.
2    t2-pdf-download-ctas                        agent1          PASS    Agent Report Download PDF fired generation (busy/download). manager PDF: Team Reports download CTA not present/enabled.
2    t2-history-edit-path                        agent1          PASS    9 submitted weeks + best-week 2026-05-31 (TTD 22K) verified; draft row 2026-07-05 → viewer → Continue editing opened WizardForm on that week; exited without submitting.
2    t2-awards-pace-line                         agent1          PASS    Awards pace narrative: TTD 128,000 gap · avg TTD 4518.52/wk (band-checked vs 122,000÷elapsed) · YTD 122,000 of 250,000.
2    t2-financing-k9-k7                          agent1+branch_managerPASS    K9 agent balance TTD 11,000 + projection Sep 2026 verified; K7 BM roster: Staging Agent Two AT RISK (2 misses + −15% adj flag), at-risk count 1.
2    t2-campaign-standings                       branch_manager  PASS    Qualify: agent-1 API 122,000 / Gold / projected TTD 12,500 (10,000 cash + 2,500 voucher, ×1.0 gate); Placement: agent-2 TTD 375 (1,500 ×0.25 gate) — standings verified.
2    t2-daily-anchor-strip                       agent1          PASS    Daily anchor strip: floor TTD 4,800 + WTD 3000 (3 seeded daily docs); celebration correctly absent on open+reload (streak-if-logged-today=4, milestone 5 unreachable today).
2    t2-game-plan-hub                            agent1          PASS    Game Plan: AllocationBar 60/20/20 + API 250,000 + monthly 20,833; MiniMonthStrip heights May 100% > June 72.0733% > July 6% (seeded 70,900>51,100>0).
2    t2-d2-keyboard-reorder                      agent1          PASS    D2 keyboard reorder: agent-tab-career moved down in Recognition (aria-live announced, visual order flipped); persisted to a fresh-context re-login (Firestore navOrder, writer held open); pre-leg order restored.
2    t2-d1-manager-gameplan-prefetch             unit_manager    PASS    unit_manager Game Plan opened populated (anchor + TTD 150,000 yearPlan total) in 113ms (< 2500ms cap); console clean, zero prod requests. NOTE: prefetch path verified only against a deploy INCLUDING the D1 change.
2    t2-filing-streak-milestone                  agent1          PASS    Filing-streak milestone: 9-week streak fired the milestone-5 takeover on home load (FILING STREAK · 5 WEEKS); dismissed cleanly; stayed absent after reload (per-year celebratedMax fire-once). Device-local marker only, no Firestore mutation; console clean, zero prod requests.
3    t3-cro-delivery-register                    cro             PASS    CRO register: To deliver 4/At risk 2/Delivered 2; at-risk tab = Dexter+Sunita; marked Ricardo Lewis delivered → persisted (To deliver 3, Delivered 3, Ricardo in Delivered tab). hygiene clean
3    t3-appt-churn-postpone                      agent1          PASS    Postpone-with-rebook via UI: vhfix-appt-d2a flipped to Postponed + new 4:30 PM booking created (verified after reload). rescheduledToId is a data-only field, verified transitively. hygiene clean
3    t3-team-planner-readonly                    unit_manager+branch_managerPASS    Team Planner read-only verified for UM (A1 20 booked) + BM (A1 20 booked); trust marker present, no Book affordance, drill read-only. hygiene clean
3    t3-meeting-mode-deck                        branch_manager  PASS    Meeting deck = 9 scenes (Opening→Branch→Activity→Production→Needs-attention→Staging Agent One→Recognition→Campaign→Wrap-up); Units + Celebrations correctly dropped. hygiene clean
3    t3-flag-gated-shells                        agent1          PASS    Flags ON: persistency-v2-shell + pending banner, campaign-lens (Qualify counts5/pend1/excl0 of 6, incl. Run-1 smoke-cro-delivery-1), awards ledger-source-chip. Fail-closed: persistencyV2 OFF → shell absent → restored ON → present. hygiene clean
3    t3-prospect-prep                            agent1          PASS    Prospect Prep: hero=Marsha (TODAY, Prepped, 2 objection chips No Money+No Hurry); Later=Devon (TOMORROW), Alicia (IN 4 DAYS), Kern (3 DAYS AGO overdue). Readiness chip is hero-only (Later cards omit it). hygiene clean
3    t3-kiosk                                    kiosk           PASS    Kiosk: token valid; stage #0E0B07; rotation total=13 (campaign spliced); reduced-transparency fallback present; podium: leaderboard panel not reached in bounded poll (rotation timing) — deferred. Zero prod (agencytrack-2a610) requests. hygiene clean
3    t3-d3-sm-ta-team-planner                    sales_manager+tenant_adminPASS    D3 Team Planner read-only verified for SM (A1 20 booked) + TA (A1 20 booked); tenant-wide rank≥3 arm; trust marker present, no Book affordance, drill read-only. hygiene clean
3    t3-appt-edit-own                            agent1          PASS    Edit-in-place via churn→Edit details: vhfix-appt-t1 startTime→08:15 (8:15 AM) + note→sentinel, saved via updateAppointment and persisted after reload (value-level). hygiene clean
xc   xc-reduced-motion                           agent1          PASS    reduced-motion active; YTD hero snapped to TTD 122000; .screen-enter animation-name="none" (disabled). hygiene clean
xc   xc-dark-contrast                            agent1+branch_managerPASS    Dark theme: zero serious/critical color-contrast violations across Report hero, Prospect Prep hero, and BM Master Sheet. hygiene clean
xc   xc-console-isolation                        agent1+branch_manager+croPASS    Cross-role hygiene clean for agent1, branch_manager, cro: console-clean + zero requests to agencytrack-2a610.

TOTAL: 36 — PASS 36 / FAIL 0 / SKIP 0
screenshots: C:\Projects\at-fable-staging\out\vh-smoke\02-54-49
```

## Final origin line

(appended post-push)
