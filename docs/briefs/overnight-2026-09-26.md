# Overnight run — 26 Sep 2026 (Home/Campaign redesign + P2a)

> RUN ON: **Opus 5.5, effort high** as orchestrator. Spawn executors pinned per item: R1 Opus 5.5 high · R2 Sonnet 5 high · P2a Sonnet 5 high.
> Kyron is asleep. No one will answer questions. Decide within the rules below, record the decision, keep going.
> This is the owner's app and repo. **One-time merge authorisation from Kyron for this run only**, bounded by the rules below. It does not carry to any later session.

## GOVERNING RULES (override any instinct to do more)

1. **Merge autonomy is frontend-only.** You may squash-merge R1 and R2 only if the diff touches exclusively `src/**`, `docs/**`, tests and test scripts. Any diff touching `firestore.rules`, `storage.rules`, `functions/**`, `*.indexes.json`, `firebase.json` or `.github/**` → build and **HOLD**: leave the PR open, label it "HELD — needs Kyron", move on.
2. **Never run `firebase deploy`.** Never merge P2a. P2a stops at an open PR.
3. **Serial lane for merges.** R1 fully merged, post-merged and production-checked before R2 starts. P2a may run in parallel (own worktree) once R1 is merged.
4. **Merge gates — all must be true on the exact HEAD SHA, re-checked right before merging:**
   - CI green (`lint-and-build`, `functions-tests`).
   - `npm test`, lint, build pass locally; counts in the PR.
   - CodeRabbit re-polled on that SHA; every finding dispositioned (fixed, or banked in FOLLOW_UPS with a reason). Scope-expanding nitpicks → bank, don't build.
   - **Design check ritual** (below) passed, screenshots attached to the PR.
5. **Design check ritual (R1 and R2).** On the Vercel preview, read-only, logged in via the repo's `loginAs` harness as the A11Y test agent (never type a password into a tool parameter). Capture 4 screenshots: 390×844 and 1440×900, light and dark (dark = `localStorage agencytrack-dark = '1'`). Compare each against the matching mockup in `docs/design-system/proposals/home-campaign-2026-09/` and write a table in the PR: block · matches mockup (yes/no) · note. Pass = every block present in mockup order, no clipped or overlapping text at 390 px, no horizontal scroll, donuts render with correct values, no console errors, both themes readable. A "no" you cannot fix in two attempts = gate failed.
   No client names or policy numbers in committed screenshots — use the test account, or crop/blur.
6. **Production smoke after each merge.** Wait for the Vercel production deploy of the merge SHA, then repeat the design check on production (read-only, same account, 390 and 1440, light only). If Home or Campaign fails to load, shows console errors, or shows a confident 0 where the preview showed a value → **auto-revert**: `git revert` the squash SHA, push to `main`, confirm production is back, label the item "AUTO-REVERTED", do not retry. Continue to the next item.
7. **Park the item, not the run.** Same failure twice, CI red that is not a known flake, or an ambiguous brief point with no safe default → park the item with a clear note and continue.
8. **No production data writes. No deletes of untracked files you did not create.**
9. Trust `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md` on `main` over this file if they conflict; note the deviation.

## QUEUE

**Step 0 — land.** Commit and push to `main` together: `docs/briefs/home-campaign-redesign.md`, `docs/briefs/p2a-server-integrity.md`, `docs/briefs/phase2-plan.md`, `docs/briefs/overnight-2026-09-26.md`, and the folder `docs/design-system/proposals/home-campaign-2026-09/` (4 files). Rule 15 push verification.

**Item 1 — R1 Home.** Build per `docs/briefs/home-campaign-redesign.md` § R1 → PR → gates (rule 4) → squash-merge → `/post-merge <PR>` → production smoke (rule 6).

**Item 2 — P2a server integrity (starts after Item 1 merges; runs beside Item 3).** Build per `docs/briefs/p2a-server-integrity.md` → PR → CI green, tests, CodeRabbit dispositioned → **stop**. Label "HELD — needs Kyron merge + firebase deploy". No merge, no deploy.

**Item 3 — R2 Campaign (starts after Item 1 is merged and production-checked).** Build per § R2 → same gates → squash-merge → `/post-merge <PR>` → production smoke.

## MORNING REPORT (deliverable)
Write `docs/reports/overnight-2026-09-26.md` (commit it with the last post-merge) and end the run with the same text as your final message. Plain words, short sentences. For each item: status (MERGED / HELD / PARKED / AUTO-REVERTED), PR link, merge SHA, the design-check table, screenshot paths, anything banked in FOLLOW_UPS, and what Kyron must do next (for P2a: review, merge, `firebase deploy --only functions --project agencytrack-2a610`, then the smoke walk in the PR).
