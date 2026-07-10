# Fable Run 3 — Progress Log

Run start (TT): 2026-07-09 night. Start HEAD: `ef5e97c3` (staging).
Brief: [`docs/briefs/fable-run3-kickoff.md`](briefs/fable-run3-kickoff.md).

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 0.1 Run docs committed | ✅ | `63dddd74` |
| 0.2 H1 seeder env-guard (Sonnet) | ✅ | `31f817b6` — guard before any init/mutation; red-verify exit 1 zero writes; green 92 docs |
| 0.3 Baseline re-seed + full VH suite | ✅ | **33/33 PASS, 0 FAIL, 0 SKIP** (t2-financing-k9-k7 passed this run too); log at out/run3-baseline-vh.log |
| H2 harden t2-financing-k9-k7 | 🔄 built | `61bbf11a` — awaits K7 roster row ("Staging Agent Two" scoped in risk panel, 20s) replacing fixed 800ms wait; FAIL screenshots via try/catch+shot both halves. Pending: 3× consecutive live pass post-deploy |
| H3 MasterSheet collapse → "Persons Reached" | 🔄 built | `6808121e` — 3 refs removed (col def, Recruiting preset, row builder); CSV auto-follows COLS; test asserts presence/absence/value; suite 5063/5063, lint+build clean. Pending: live master-sheet leg post-deploy |
| H4 jointCalls index reconcile | ✅ no-op | live query `managerWarService.js:203-209` (collectionGroup: authorUid ==, tenantId ==, appointmentDate range) served by existing COLLECTION_GROUP composite `(authorUid, tenantId, appointmentDate)` in firestore.indexes.json; staging has it live — proven by console-clean `t2-war-review-roundtrip` PASS tonight (ManagerWarTab.jsx:102 calls getOwnJfwCount on mount). No code change, no deploy. |
| H5 out/ gitignore | ✅ no-op | already covered — `.gitignore:147 out/` (verified via `git check-ignore -v out/` at run start) |
| R1 tier0-smoke rebase → PR-open-HOLD | ✅ | rebase path clean (0 conflicts — phantom-conflict prediction didn't materialize); gate diff = smoke file (+1153) + 1 SMOKES.md row ONLY; fresh branch `chore/tier0-smoke-r1` @ `6083c911`; PR #850 OPEN + HOLD, not merged. Caveat in PR body: smoke's Tier-0 assertions unverified against post-redesign main (operator review). |
| F1–F7 missing heroes | 🔄 re-scoped | Audit re-verified against staging HEAD: items A (Daily Capture anchor), B (Prospect Prep), C (Financing K9 hero), G (Meeting Mode deck) ALREADY BUILT by prior runs and VH-asserted tonight. Item F (Money Needs flag) → DECISIONS-NEEDED #1. Real remaining builds: **D** (UM production report hero parity) + **E** (My WAR hero conformance — ring/streak exist, hero treatment + metric row missing). |
| F8 pinned-tab de-emphasis | ⬜ | droppable |
| F9 WAR reviewStatus pill (C3) | ⬜ | protected |
| F10 streak milestones (C4) | ⬜ | protected |
| F11a planner recon | ✅ | `docs/audits/planner-spine-recon-2026-07-10.md` — planner fully shipped + un-gated; edit-in-place plumbed (service+sheet+rules) but NO UI entry point; recurrence has ZERO design source → 6 ambiguities banked below |
| F11b planner contract | 🔄 re-scoped | slice 1a = edit-in-place trigger only (contractible, no rules/index change); slice 1b recurrence BLOCKED → DECISIONS-NEEDED #3 |
| F11c planner slice 1a | ⬜ | edit-in-place trigger via churn action sheet (recon's precedent-following default) |
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
4. **Team Planner unitId assumption (from F11a recon, adjacent finding):** `AgentDashboard.jsx:824` passes `agentUnitId={userProfile?.unitId}` while the UM read-arm expects the UM's uid — correct only if `unitId` IS the UM uid. Data-shape check recommended before any Team-Planner slice. Not slice-1a-blocking.

## Morning handoff

(filled at E2)
