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
| F1–F7 missing heroes | 🔄 re-scoped | Audit re-verified against staging HEAD: items A (Daily Capture anchor), B (Prospect Prep), C (Financing K9 hero), G (Meeting Mode deck) ALREADY BUILT by prior runs and VH-asserted tonight. Item F (Money Needs flag) → DECISIONS-NEEDED #1. **Item D ✅** `c2d9516c` — UM Unit Aggregate now glass.hero.teal + hero-ink tokens + Agents stat (exact BM parity); parity unit test added (9/9), lint+build clean; live smoke rides next deploy. **Item E ✅** `138fda81` → merge `e9043305` — completion card promoted to `.glass.hero.teal` MyWarCard (ring hero-variant tokens, MY API count-up w/ reduced-motion snap, apps, streak dots gold); own-week figures via existing `getAgentSubmissions` + `extractFields` (no new read path); suite 5071/5071; VH war leg extended w/ exact seeded values (TTD 5,200/1 · TTD 7,500/2). Live leg pending deploy. |
| F8 pinned-tab de-emphasis | ✅ built+merged | `cea9fabc` → merge `56ef636b` — pinned star 14→12px + `--color-primary`→`--color-text-muted` (AA both themes: ~5.7:1 light / ~7.4:1 dark, ≥3:1 icon floor; pinned state triple-redundant: Pinned zone + filled glyph + always-visible); 44px hit target unchanged (star is also the pin toggle); unpinned untouched. New `t1-pinned-tab-deemphasis` leg (pin→assert→unpin restore, MUTATES prefs). Suite 5066/5066. Live leg pending deploy. |
| F9 WAR reviewStatus pill (C3) | ✅ built+merged | `75717d6d` → merge `4e3853fa` — owner my-war shows StatusPill (approved/changes_requested) + "Reviewed by {name} · {date}" + 44px note disclosure; pure read of existing reviewStatus/reviewedByName/reviewNote fields (no rules change); review fields isolated from form state so they can't leak into auto-save. VH war leg finding flipped to hard assertions. Suite 5065/5065. Live leg pending deploy. |
| F10 streak milestones (C4) | ✅ built+merged | `f36f45a6` → merge `f0fd7d67` — `FILING_WEEKLY_STREAK_MILESTONES [5,10,25,52]` (operator defaults; no banked week-thresholds existed) via shared resolver; fires on HomeV2 load (goals-precedent fire-on-load, daily-precedent owner-surface); fire-once via per-year localStorage `filingStreakMax` marker (goals semantics); reduced-motion via shared CelebrationTakeover. New `t2-filing-streak-milestone` leg (fires at 5 w/ seeded 9-wk streak → dismiss → absent on reload). Suite 5074/5074 (sharded). **Cross-leg risk mitigated:** shared `login()` now auto-dismisses any on-load celebration takeover (2.5s probe) so fresh-context legs' first click can't be intercepted; the filing leg opts out (`dismissCelebration:false`). Live leg pending deploy. |
| F11a planner recon | ✅ | `docs/audits/planner-spine-recon-2026-07-10.md` — planner fully shipped + un-gated; edit-in-place plumbed (service+sheet+rules) but NO UI entry point; recurrence has ZERO design source → 6 ambiguities banked below |
| F11b planner contract | 🔄 re-scoped | slice 1a = edit-in-place trigger only (contractible, no rules/index change); slice 1b recurrence BLOCKED → DECISIONS-NEEDED #3 |
| F11c planner slice 1a | ✅ built+merged | `5b8f9bb2` → merge `5985fc03` — "Edit details" in ChurnDialog → AppointmentSheet mode:'edit' → existing updateAppointment; owner-scoped structurally + rules-enforced; NO rules/index/service changes. New `t3-appt-edit-own` leg (write-read-verify on vhfix-appt-t1, disjoint from postpone leg); team-planner leg asserts edit affordance ABSENT. Suite 5068 pass (3 known Tinypool timeout flakes re-run green). Live leg pending deploy. |
| E1 reserve: re-seed + full VH | ⬜ | |
| E2 final doc update + push | ⬜ | |

## Dispatch / telemetry

| Item | Model | Started (TT) | Ended | Outcome | SHA(s) |
|------|-------|--------------|-------|---------|--------|
| recon | Fable (orchestrator) | 23:xx | 23:xx | env/layout verified; H5 found no-op | — |
| H1 | Sonnet | 23:xx | +2.5min | ✅ guard added, red/green verified, lint clean | `31f817b6` |
| R1 | Opus | 23:xx | — | 🔄 rebase in progress | — |
| baseline VH | orchestrator (bg) | 23:xx | — | 🔄 running | — |

## DECISIONS-NEEDED

1. **Money Needs merged hero (audit item F / "flag flip"):** `VITE_MONEY_NEEDS_MERGED_ENABLED` is a build-time Vite env var (`MoneyNeedsPanel.jsx:23`). Enabling it for the staging deploy requires either (a) setting the var in the Vercel project env scoped to the `staging` branch (operator action — Vercel auth not available to the run), or (b) changing the code default, which would flip production on next promotion. Both are rollout decisions → skipped, no guess. Recommendation: (a), then re-run `smoke-money-needs-merged-local.mjs` semantics against staging.
2. ~~Prospect Prep hero (audit item B)~~ — RETRACTED: already built on staging (VH `t3-prospect-prep` passes: hero card, countdown framing, objection chips). The hero audit (#848) predates the Runs 1+2 promotion and lists as MISSING several items prior runs already landed.
3. **Planner recurrence (F11b slice 1b):** zero design source anywhere in the canonical planner handoff (recon doc § ambiguities, line-cited). Six open product questions need one-line rulings each: (i) cadence — weekly-only or more? (ii) termination — end-date / count / rolling window? (iii) materialization — concrete N docs (fits `allow delete:false`) vs virtual expansion? (iv) edit scope — this / this-and-following / whole series? (v) cancel-series semantics vs the postpone/churn model? (vi) what recurs — FREE blocks only, or prospect appointments too? Slice 1a (edit-in-place trigger) proceeds; recurrence does not.
4. **Daily-streak milestone reachability (original C4 bank, still open):** F10 built the *filing*-streak milestones; the previously banked daily-streak issue (`computeStreak` week-scoped max 6 vs `DAILY_STREAK_MILESTONES [5,10,20]` — rungs 10/20 unreachable, 5 only Fri/Sat) remains an operator ruling: cross-week streak read vs milestone table change. Unchanged tonight.
5. **Team Planner unitId assumption (from F11a recon, adjacent finding):** `AgentDashboard.jsx:824` passes `agentUnitId={userProfile?.unitId}` while the UM read-arm expects the UM's uid — correct only if `unitId` IS the UM uid. Data-shape check recommended before any Team-Planner slice. Not slice-1a-blocking.

## Observations (non-blocking)

- **LOGIN-TIMEOUT flake:** one `t2-financing-k9-k7` run failed at login (`staging-branch-manager@…`) when legs ran back-to-back with no gap (01:36:13 run); 20s spacing between runs → 3/3 clean. Suggests the shared login helper could use a retry-once-on-timeout, or per-leg runs need modest spacing. Not related to the K7 first-paint race H2 fixed.

## Morning handoff

(filled at E2)
