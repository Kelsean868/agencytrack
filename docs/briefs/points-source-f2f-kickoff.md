# Brief — Points single-source-of-truth + f2f scoring (PR1 of 2)

**Suggested branch:** `feat/points-source-f2f`
**Size:** M
**Type:** Cloud Function change + refactor. Human-merged (Rule 19). **Requires `firebase deploy --only functions`.**
**Sequence:** Foundation PR. PR2 (the transparency panel) builds on the source this PR creates; do not start PR2 until this is merged + deployed.

---

## Context

Recon (read-only) of the gamification points system (`leaderboard/{uid}` singular — NOT the API production leaderboard) found:

- Weights are **inline literals** inside `onSubmissionWrite` at `functions/index.js:1310–1315` — no config, no shared module, server-only. The frontend never sees them.
- Level thresholds (`functions/index.js:1326–1332`) and the 9 badge definitions are likewise inline, server-only.
- Points are computed in the trigger as a single expression; the calc is not a separately testable unit.
- Scored today: dials (4 call types @ 1pt), `ffiConducted` @ 5, `ciConducted` @ 10, `applicationsSold` @ 25, `apiSold` @ 1pt/$1k. **`f2fAttempts` scores zero** — a perverse incentive (telephone scores, face-to-face doesn't), and inconsistent with the activity model (f2f is part of `prospectingTouches`).

Decision: extract the constants to one source (prerequisite for the panel + kills drift + makes future tuning one-place), pull the points math into a testable function, and **score `f2fAttempts` at 1pt** (parity with dials). The all-time-cumulative leaderboard model and the API-vs-app weighting are deliberately **left as-is for the pilot and banked** for a pre-scale decision.

---

## Goal / target state

1. A single source of truth for: points weights, level thresholds, and badge definitions (each with a human-readable label + description).
2. The points computation extracted into a pure, unit-testable function that reads from that source.
3. `f2fAttempts` scored at 1pt via the source — existing weights otherwise **unchanged** (no scoring regression).

---

## Phase 1 — recon (HARD STOP — paste findings back before Phase 2)

Report each with `file:line`:

1. **Sharing mechanism (the key question).** Can `functions/` and `src/` import one shared constants module, given the build setup (is `functions/` bundled/deployed separately; can it import from a `src/` or a shared path)? If a single shared module is feasible, where should it live? If not, the fallback is **duplicate the constants in `src/` with a unit test asserting they match the CF source (drift guard)** — confirm which path applies. (This determines how PR2's panel will read the weights.)
2. **Extraction points.** Confirm the exact inline blocks: weights (`functions/index.js:1310–1315`), level thresholds (`1326–1332`), badge definitions block, and the `f2fAttempts` insertion point in the points expression.
3. **Existing tests.** Is there any existing unit test on the points/level/badge computation? (If none, Phase 2 adds one as the refactor's regression guard.)
4. **Sole-computation check.** Confirm `onSubmissionWrite` is the only place points are computed — no other path independently calculates them. The new source must be the single origin.
5. **Badge labels.** List the 9 badge keys so labels/descriptions are authored against the real set.

---

## Phase 2 — extract + f2f

1. Create the single source (location per Phase 1) with:
   - `pointsWeights`: `dials: 1`, `f2fAttempts: 1`, `ffiConducted: 5`, `ciConducted: 10`, `applicationsSold: 25`, `apiPerThousand: 1`.
   - `levelThresholds`: the 5 levels `{ level, threshold, title }` (Rookie 0 / Associate 100 / Pro 250 / Elite 500 / Legend 1000).
   - `badgeDefinitions`: the 9 badges `{ key, label, description, trigger }`. Suggested copy (Tatil can refine later):
     - `first_submission` — "First Steps" — submitted your first weekly report
     - `streak_4` — "On a Roll" — 4 weeks in a row
     - `streak_8` — "Committed" — 8 weeks in a row
     - `streak_13` — "Quarter Strong" — 13 weeks in a row
     - `top_apps_week` — "Closer" — 5+ applications in a single week
     - `big_week` — "Big Week" — TTD 20,000+ API in a single week
     - `century_dials` — "Century" — 100+ dials in a single week
     - `mdrt_qualified` — "MDRT Qualified" — YTD API reached TTD 500,000
     - `mdrt_pace` — "MDRT Pace" — on track for MDRT (TTD 250,000 YTD by mid-year)
2. Extract the points math from the inline trigger expression into a pure function (e.g. `computePoints(fields)` → points) that reads `pointsWeights`. The trigger calls it.
3. Add `f2fAttempts` to the formula via the source (1pt each, `Math.floor` consistent with the others).
4. **No change to existing weights** — the refactor must produce identical points for every currently-scored activity.

---

## Phase 3 — verify

1. Unit test the extracted `computePoints` (and level/badge resolution if also pulled into pure functions):
   - **Regression guard:** a fixture exercising every existing weight (dials, FFI, CI, apps, API) asserts the pre-refactor point total — proves the extraction changed nothing.
   - **f2f:** a fixture with `f2fAttempts = N` asserts the total rose by exactly `N` — proves f2f now scores and would catch a wrong key.
2. Lint + full suite + build green.

---

## Phase 4 — docs (with placeholders)

1. Bank in `FOLLOW_UPS.md`: (a) leaderboard reset-model decision — cumulative vs rolling weekly/monthly ranking (pre-scale, Tatil-facing); (b) API-vs-app-count weighting; (c) optional uncapped-dials-points cap.
2. Note: `f2fAttempts` now scores 1pt; the badge set is 9 (not 7); the points constants now live in the single source.
3. SHA placeholders to fill at Phase 5.

---

## Phase 5 — commit / push / PR

1. Commit on `feat/points-source-f2f`, push, open PR. Human-merge only (CF change, Rule 19).
2. Name the feature-branch HEAD SHA (Rule 20); no silent post-report pushes.
3. Poll + disposition every Gemini comment (Rule 21).

---

## Deploy + smoke (post-merge — CF-trigger-dependent)

- This is a Cloud Function change, so the smoke is **post-merge-and-deploy**, never pre-merge.
- Sequence: human-merge → `firebase deploy --only functions` (gate on "Deploy complete!" before smoking) → write-read-verify smoke.
- Smoke via `setupBypassSession`: submit a report with `f2fAttempts = N` plus known scored activities (e.g. some dials + 1 FFI) → wait for the trigger → read `leaderboard/{uid}` → assert `points` equals the expected total **including** `N` for f2f, and that the existing activities still contribute their established values (no regression on the live trigger).

---

## Out of scope (this PR)

- The transparency panel UI — that's PR2, built on this source.
- Reset-model change, API-weight change, dials cap — banked.
- Any change to the production leaderboard (`leaderboards/{branchId}`).

## Boundary

No change to the *existing* point values beyond adding f2f. If Phase 1 finds the points calc is entangled with other logic that can't be cleanly extracted without behavior change, STOP and report rather than refactoring through it.
