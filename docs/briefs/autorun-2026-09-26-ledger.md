# Autonomous run — 26 Sep 2026 afternoon (Policy Ledger build)

> RUN ON: **Opus 5.5, effort high** as orchestrator. Executors pinned per item: L0 Sonnet 5 high · L1 Opus 5.5 high · L2 Sonnet 5 high · L3 Sonnet 5 medium.
> Kyron is away ~3 hours, reachable on his phone. **One-time merge authorisation from Kyron for L0–L3 only, for this run only**, bounded by the rules below. Build brief: `docs/briefs/ledger-lens-build.md`.

## GOVERNING RULES
1. **Frontend-only merges.** Squash-merge only if the diff touches exclusively `src/**`, `docs/**`, tests and test scripts. Anything touching `firestore.rules`, `storage.rules`, `functions/**`, `*.indexes.json`, `firebase.json`, `.github/**` or `package.json` dependencies → build and **HOLD** ("HELD — needs Kyron"), move on. (Using already-installed deps is fine.)
2. **Never run `firebase deploy`.** No production data writes. No deleting untracked files you did not create.
3. **Serial merge lane.** Each PR merged, post-merged and production-checked before the next starts.
4. **Merge gates on the exact HEAD SHA, re-checked right before merge:** CI green; tests/lint/build pass (counts in PR); CodeRabbit re-polled and every finding dispositioned (scope-expanding nitpicks → FOLLOW_UPS); design check ritual passed (brief § Deliverables 2).
5. **Production smoke after each merge** (read-only, test agent, 390 + 1440, light): Home, Campaign, Policy Ledger load, no console errors, no confident 0 where preview showed a value. Failure → `git revert` the squash SHA, push, confirm production recovered, label "AUTO-REVERTED", continue.
6. **Park the item, not the run.** Same failure twice, non-flake CI red, or an ambiguous point with no safe default → park with a note, continue to the next item.
7. **Questions.** Kyron can answer on his phone, but do not wait on him for anything with a safe default — decide, note the decision in the PR and the report. Only stop and ask for a decision that cannot be undone.
8. Trust `docs/CONTEXT.md` / `docs/FOLLOW_UPS.md` on `main` over this file; note deviations.
9. Time box: stop starting new items after ~3 h 30 min of run time; finish or park the current one.

## QUEUE
- **Step 0 — land:** commit + push to `main`: `docs/briefs/ledger-lens-build.md`, `docs/briefs/autorun-2026-09-26-ledger.md`, and `docs/design-system/proposals/ledger-2026-09/` (8 files). Rule 15 push check.
- **L0** → **L1** → **L2** → **L3**, each: build per brief → PR → gates → squash-merge → `/post-merge <PR>` → production smoke.

## REPORT (deliverable)
`docs/reports/autorun-2026-09-26-ledger.md`, committed with the last post-merge, and the same text as your final message. Plain words, short sentences. Per item: MERGED / HELD / PARKED / AUTO-REVERTED, PR link, merge SHA, design-check table, screenshot paths, decisions you made without Kyron, FOLLOW_UPS banked, and what Kyron must do next.
