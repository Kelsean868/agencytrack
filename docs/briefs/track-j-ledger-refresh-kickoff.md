# Kickoff — Track J port-ledger refresh (docs-only reconciliation)

**Size:** XS · **Type:** docs housekeeping · **Branch:** `docs/track-j-ledger-refresh`
**Scope lock:** `docs/track-j-port-ledger.md` ONLY. No src, no other docs, no code.

## Why
The 2026-06-03 read-only audit (origin/main @ `8ba044f`) found the port ledger — the
authoritative Track J tracker — stale and internally inconsistent in four ways. A stale
tracker is how briefs get authored against false premises (Rule 17 failure class). This PR
reconciles it. No status judgments are being re-litigated; the audit's findings are the spec.

## The four flags → fixes

1. **Row 7 (Game Plan v2) stale.** Still reads PENDING. Fix → **PARTIAL**, PRs **#438**
   (`33889a9`, hub shell + Money Needs re-home) + **#445** (`e94d747`, Weekly Planner
   suggested-week card + decomposition extraction). Location:
   `src/components/dashboard/GamePlanV2/` (6 components; smokes
   `game-plan-v2-slice-1-smoke.mjs`, `weekly-planner-slice-1-smoke.mjs`). Note deferred:
   Year Plan · Monthly targets · Commit→Goals · Weekly Planner S2–S4 · manager review.

2. **Headline + pending list contradict the table.** The pending list still names rows 5
   (Wizard), 6 (Daily Capture), 9 (Policy Ledger), 30 (Policy Reconciliation), all of which
   the table marks PORTED/PARTIAL. Fix → remove them from pending; rebuild the pending list
   strictly from the reconciled table.

3. **Count drift.** "Pending — 24 screens" header vs "19 pending" prose vs a 21-item list.
   Fix → one number, derived from the reconciled table. Recompute the headline ("N of 34")
   per the ledger's own existing convention (state the convention inline), and ADD a
   stricter dual tally line for clarity: **12 fully ported · 7 partial · 14 not started ·
   1 gated (CRO)** per the 2026-06-03 audit.

4. **Snapshot header stuck.** Still "main HEAD `8e82cca` post-#426". Fix → snapshot =
   `8ba044f` (post-#445), date 2026-06-03.

## One addition
In the methodology note: a one-line caveat that the referenced "STEP 2"
TRUE-RESTYLE-vs-REDESIGN reclassification is **not yet committed to the tree** — the
green-channel candidate list is provisional, and each candidate must be locked with a
mockup-vs-component diff at its brief's Phase 0 before a TRUE-RESTYLE dispatch (the Wizard
surprise-stop precedent).

## Phases
- **Phase 0:** gate as usual (fresh branch off origin/main; this brief on main).
- **Phase 1:** no hard-stop expected — docs-only, no data/rules/code risk. Source-verify the
  four flags still hold at your HEAD before editing (cheap re-greps).
- **Phase 2:** the edits above.
- **Phase 3:** self-check — the ledger must be internally consistent: headline = table =
  pending list = dual tally. Lint n/a.
- **Phase 4:** none beyond the ledger itself (no CONTEXT row, no FOLLOW_UPS change — docs
  housekeeping, same convention as brief-landing PRs).
- **Phase 5:** commit, push, PR. **Smoke: WAIVED — pure docs, no user-visible behavior**
  (Rule 18 box checked as waived with this justification in the PR body).

## Acceptance
- All four flags resolved; zero remaining self-contradictions in the ledger.
- Dual tally present and matching the table.
- STEP-2 caveat line present.
- `git diff --stat` shows exactly one file: `docs/track-j-port-ledger.md`.
- Rules 12/15/19/20 as always; report PR + HEAD SHA and stop.
