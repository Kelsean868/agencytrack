# Brief: Team Performance Roster — verify & finalize before merge

## Context
PR #683 (branch `team-roster-ui`) is wired to the real `useTeamRoster` hook and the wiring smoke passes —
but the green is passing a **downgraded** assertion set, and two design/contract gaps remain. This pass
closes all four on the same branch so the merge that follows is fully verified:
1. The hook doesn't output `role` or `unit` → no UM chip, no unit label (regression from the locked mockup).
2. The smoke seed lacks `branchId` on submissions → BM submitted production reads 0 → unverified.
3. The smoke seed lacks E3 fields on persistency docs → `isE3Doc()` filters them → persistency null →
   band colors unverified.
4. `pctOfAnnualGoal` is ×100'd at the page boundary → an internally inconsistent row contract.
   **CORRECTED at Phase-1 recon (the original wording below was wrong):** persistency is NOT
   "0–100 from the hook." Production E3 persistency docs store a **decimal 0–1**
   (`netSettled/grossSettled`; see `src/lib/persistency/calculations.js` — "never a percentage"),
   which `assembleRosterRow` passed through unchanged. `PersBandCell` expects 0–100, so with real
   data the persistency column rendered ~1% (danger) for every agent — a latent production bug that
   the old null-filtered smoke masked. The fix (approved Option A) moves the ×100 into the lib for
   **both** persistency and `pctOfAnnualGoal`, making the hook the single 0–100 scale boundary, and
   seeds persistency as a faithful decimal so the smoke verifies the real scale path.
   ~~`pctOfAnnualGoal` is ×100'd at the page boundary while persistency is 0–100 from the hook.~~

## Procedure note
Work on the **existing `team-roster-ui` branch — do NOT cut a new branch.** PowerShell, no `&&`.
Tier B (build-and-hold, human merge). The only writes are to the **isolated `tatillife_smoke` tenant**
via the existing guarded seed; **`tatillife_south` is never written** in this brief.

## Phase 0 — sync
1. `git fetch origin`; checkout `team-roster-ui`; if main moved since the wiring, `git merge origin/main`
   (resolve CONTEXT.md if it conflicts). Confirm clean, full suite green, then proceed.

## Phase 1 — recon (report, then build to match — don't assume)
1. The user doc's **`role`** field values and how to map the UM role → the UI's `'UM' | null` (only UMs
   get a chip; agents → null). And the **unit** value to surface — `unitId` vs a friendlier label if one's
   readily available.
2. The exact fields **`isE3Doc()`** requires for a persistency doc to pass its filter.
3. Where the page applies the **`pctOfAnnualGoal` ×100** (to move it into the lib).
4. The current smoke's assertion structure in `scripts/verification/team-roster-smoke.mjs` (to upgrade the
   downgraded checks back to real ones).
5. Report, then proceed.

## Phase 2 — build

### 2a. Hook output (lib/teamRoster.js + useTeamRoster.js)
- Add **`role`** (mapped to `'UM' | null`) and **`unit`** to `assembleRosterRow`'s output, matching the
  RosterRow interface the UI already renders (the UM chip + unit label light up automatically).
- Move the **`pctOfAnnualGoal` ×100 into the lib** so the hook returns it on a 0–100 scale (consistent
  with persistency). Remove the ×100 from the page; update any page tests that asserted the old boundary.

### 2b. Seed fixes (functions/scripts/seed-smoke-data.cjs — smoke tenant only)
- Stamp **`branchId: 'smoke_branch'`** on the submission docs (so the BM's `getAllYTDSubmissions` returns
  them).
- Add the **E3 fields** `isE3Doc()` requires to the persistency docs (so they pass the filter and the
  seeded persistency values flow).
- Leave **one** of the four roster members **without a committed goal doc**, so the % column exercises the
  **"—"** fallback end-to-end (the other three keep their goals).
- Keep the hard south-guard intact (abort if tenant === `tatillife_south`).

### 2c. Smoke assertion upgrade (team-roster-smoke.mjs)
Restore the real assertions the seed gaps had forced down:
- **Submitted** API/apps match the seeded values (no longer 0).
- **Issued** API/apps match the seeded values (800K/66, 450K/38, 180K/15, 60K/5).
- **Persistency band colors**: the seeded 95 → green/ok, 88 → amber/watch, 76 → red/below, 64 → red/below
  — this is the 0–100 scale verification that was deferred.
- **% of annual goal**: the three members with goals show the correct ×100 value; the no-goal member shows
  **"—"**.

### 2d. South branchId inspection (read-only — does NOT run against south here)
- Build a **read-only** inspection (count submissions **with** vs **without** `branchId` for a given
  tenant). Validate it against `tatillife_smoke`.
- **Do NOT run it against `tatillife_south` in this build.** Output the script + a one-line operator run
  instruction. (Read-only, but south stays operator-run.) This answers whether the live BM submitted
  column under-counts; the backfill, if needed, is a separate Tier-C task.

## Phase 3 — tests + real-green smoke
1. Full suite + lint + build green.
2. **Re-seed the smoke tenant** with the fixes: `seed-smoke-data --apply` against **`tatillife_smoke`
   only**, south-guard asserted; log the applied changes. (Dispatching this brief authorizes the isolated
   smoke-tenant seed; south is untouched.)
3. Run the **upgraded** smoke against the smoke tenant — it must now pass the **real** assertions
   (submitted + issued values, persistency band colors, % goal + "—"), not the downgraded ones.

## Phase 4-5
- Docs: CONTEXT.md (src/ change → advances Current main HEAD on merge). In FOLLOW_UPS.md, **close the two
  banked FUs** (E3 seed gap + branchId submission stamp — both fixed here); note the south-branchId
  inspection + the conditional backfill.
- Push (updates #683). Poll + disposition Gemini (Rule 21). **HOLD for human merge.**

## Out of scope (stays deferred / conditional)
- The **south `branchId` backfill** — only if the operator's read-only south check shows old submissions
  lack it; scoped as a separate Tier-C brief.
- The branch **leaderboard aggregate** (south-bound cron "Brief 2").
- The #682 **historical-year** and **TA-specific-unit persistency** limitations.

## Acceptance
- Hook returns `role` + `unit`; the roster shows **UM chips + unit labels**; `pctOfAnnualGoal` is 0–100
  from the lib with no page-boundary conversion.
- The upgraded smoke passes against the re-seeded smoke tenant with **real** assertions: submitted +
  issued values correct, **persistency band colors correct (scale verified)**, % goal correct including
  the **"—"** fallback.
- The south-branchId read-only inspection is built + validated on smoke, with an operator run-line.
- Build-and-hold. After this, the merge gate is: green real-smoke → merge, **unless** the operator's south
  check shows missing `branchId`, in which case we decide backfill-first vs merge-with-known-undercount.

## Risks
- 2a edits the now-merged lib + the page + tests together — keep them in one coherent change so the ×100
  move doesn't leave a page test asserting the old scale.
- If persistency bands still render one color after the E3 seed fix, the scale is wrong in the band logic
  (0–100 value vs 0.80/0.90 constants) — stop and surface it; that's the bug the real smoke exists to catch.
