# Kickoff AMENDMENT v2 — Track J overnight queue: auto-merge protocol + screenshot mandate + items 11–13

**Amends:** `track-j-night-queue-kickoff.md` + its addendum. Where this conflicts with the
base briefs, THIS FILE WINS. Dispatcher-authorized invocation of the established Track J
auto-merge green channel for unattended operation.

---

## §1 — AUTO-MERGE PROTOCOL (supersedes night-rule 2's "no merges" for eligible items)

**Eligible:** items 0–8, 10 (as upgraded in §3), 11–13. **NOT eligible:** item 9
(deletions + shared primitives → ends at open PR, human-merged in the morning). Parked items
are never merged.

**Per eligible item, the full loop is:**
1. Build + verify per the item's brief. ALL green-channel gates must self-pass:
   Phase-0 diff-lock (TRUE RESTYLE confirmed, where applicable) · hex-grep empty · `git diff
   --stat` == scope-locked files only · lint 0 errors · full suite green (known-flake
   baseline if item 0 parked) · build clean · axe NO-NEW serious/critical vs main baseline ·
   both-themes preview smoke PASS **with §2 screenshot review clean**.
2. ANY gate fails and can't be fixed within the item's own scope → NO merge → open PR
   (ready-for-review) or `[PARKED-STOP]` draft per the base rules. Continue to next item.
3. All gates pass → `gh pr merge --squash --delete-branch`. If branch protection blocks the
   merge, park as ready-for-review and continue — do not fight protection.
4. Wait for the production deployment of main to complete, then **prod-smoke** the merged
   surface (same assertions + screenshots, against production).
5. Prod-smoke PASS → run the item's **post-merge fill direct to main** (CONTEXT.md
   Recently-shipped row, port-ledger row flip, FU lines, Rule-15 SHA verification) — the
   normal per-cycle fill, now per item. Then cut the next item's branch off the NEW main.
6. Prod-smoke FAIL → **AUTO-REVERT**: `git revert <squash-sha> --no-edit` direct to main,
   push, wait for redeploy, prod-smoke that the surface recovered, mark the item
   `PARKED-REVERTED` with full evidence (failing screenshots + logs) in the PR thread.
   Recovery confirmed → continue to next item.

**Circuit breaker:** two consecutive auto-reverts → HALT the auto-merge channel entirely;
all remaining items end at open PRs (no further merges); say so prominently in the
end-of-night report. A clean auto-revert is the system working — not a strike. Breaking
production without recovering it is strike territory; the revert path exists so that never
happens.

**Unchanged hard lines:** no firestore.rules, no functions deploys, no schema, no Firestore
writes of any kind (item 13 is read-only), no token-definition changes, no scope
improvisation to rescue a failing gate.

## §2 — SCREENSHOT MANDATE (applies to every item, every smoke, permanent)

- Every smoke captures screenshots: both themes, every key state the item touches, saved as
  artifacts and attached/linked in the PR.
- CC must VISUALLY REVIEW each screenshot — layout, spacing, contrast, truncation, broken
  states — not merely confirm the script exited 0. Selector-green with a visually broken
  screenshot is a FAIL.
- A visual defect in the item's OWN work → fix in-branch, re-smoke, before any merge.
- A PRE-EXISTING visual defect spotted on an adjacent surface → do NOT fix (scope
  discipline); log it with its screenshot in the end-of-night findings list as FU input.
  (Exception: item 10, whose scope IS cross-surface contrast fixes.)
- Prod-smokes after auto-merge capture production screenshots, same review standard.

## §3 — ITEM 10 UPGRADE (gold-contrast: audit → fix → merge)

Item 10 becomes a fix item: after the screenshot-driven contrast sweep, apply USAGE-LEVEL
fixes only (class swaps on the flagged elements using documented patterns, e.g. the
`dark:bg-primary-dark` convention) on a branch `fix/gold-contrast-pass`, scope-locked to the
flagged files. Full green-channel gates + §1 loop apply. Any fix requiring a token
DEFINITION change → exclude it, park that finding for daytime (design-system surgery is not
a night job). The findings table still appears in the end-of-night report, with fixed vs
parked status per row.

## §4 — NEW ITEMS (run after item 10)

**ITEM 11 — CLAUDE.md hygiene codification.** Branch `docs/claude-md-hygiene`. Scope:
`CLAUDE.md` only. Add the two banked rule lines: (a) the deploy-hygiene rule per its
FOLLOW_UPS.md entry (functions/email-template changes take effect only after an explicit
`firebase deploy`; never assume deployed); (b) "Housekeeping/docs-only merges take no
post-merge fill commit; `Current main HEAD` tracks work squashes only." Resolve the
corresponding FUs in the same PR (sequential flow makes docs edits safe again). Auto-merge
eligible; prod-smoke N/A → substitute: re-read the committed file renders correctly on main.

**ITEM 12 — CLUSTER_3 label misnomer.** Branch `fix/cluster-3-label`. Scope per its
FOLLOW_UPS.md entry: the misnamed label + its references, nothing else. Phase-0: source-verify
the FU's claim before editing. Tests green; auto-merge eligible if the diff stays trivial
(rename-class); anything structural → park.

**ITEM 13 — branchId/unitId integrity probe (READ-ONLY).** Branch
`scripts/audit-branch-unit-integrity` → adds one read-only Admin-SDK script under
`scripts/audit/` that verifies every user doc's `branchId`/`unitId` resolves to an existing
branch/unit doc in `tatillife_south`, reporting orphans/mismatches. ZERO writes — read-only
SDK usage, same safety pattern as the #443 probe. Findings table in the end-of-night report
+ PR body. The script PR is auto-merge eligible (scripts-only); any DATA fixes the findings
suggest are daytime work — do not touch data.

## §5 — END-OF-NIGHT REPORT (final form)

Every item 0–13 → status: MERGED-TO-PROD (squash SHA + prod-smoke evidence) /
READY-FOR-REVIEW (item 9 or protection-blocked) / PARKED-STOP / PARKED-REVERTED /
NOT-STARTED. Plus: the item-10 contrast table, the item-13 integrity findings, all FU-input
visual findings with screenshots, per-item wall-time, and final `origin/main` HEAD with
Rule-15 verification. If everything closes early: STOP — no unqueued work.
