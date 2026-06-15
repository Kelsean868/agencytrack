# Producing-manager Slice 2.2 — retire WAR personal production + `isProducingManager`

**Sized:** S–M
**Branch:** `feat/producing-mgr-2-2-retire-war-personal` (off freshly-fetched main)
**Type:** Feature-retirement (dead-path removal) + `firestore.rules` field-validation change.
**Channel:** **BUILD-AND-HOLD + dispatcher pre-review + human squash-merge.** Touches `firestore.rules` → rules deploy + the rules-dependent smoke are **post-merge-and-deploy**, never pre-merge.

## Why

Manager personal production now flows through the agent wizard (Slices 2.1a/2.1b — deployed and smoke-verified: BM write persists, sums into branch `teamYTDAPI`, no named phantom unit, SM/TA gated). The WAR's `personalApi`/`personalApps` sub-panel is the *old* capture path: written to `managerWeeklyReports` but read by no CF, hook, or rollup (orphaned), and gated behind `isProducingManager`, which has **no UI to set it** — so the panel was never shown in practice. This slice removes that dead path and the flag.

**Every WAR activity and recruiting KPI stays** — JFW (`jfwCount`), one-on-ones (`oneOnOnesConducted`), the weekly recruiting funnel (`namesSourced` / `interviewsConducted` / `recruitsInFirstWeeks`), training (`trainingSessions` / `trainingTopic`), unit/branch meeting (`unitMeetingHeld` / `attendanceCount`), planning review (`dashboardReviewDone`). The monthly recruiting roll-up (`candidatesAssessed` / `agentsContracted`, separate `managerMonthlyRollups` collection + MonthlyRecruitingTab) is **untouched**.

## Phase 1 — source-verify · **HARD-STOP, report back, await dispatcher authorization**

Pair every grep with `git ls-files` (tracked-status). Report findings; do **not** start Phase 2 until I authorize.

1. **`ManagerWarTab.jsx`** — locate the personal-production sub-panel and the `isProducingManager` gating branch. Quote the exact conditional and the fields it renders.
2. **`managerWarService.js`** — where `personalApi`/`personalApps` are written/stripped, and where `isProducingManager` is read. Quote.
3. **`ManagerWarDetail.jsx`** — does the read-only detail render `personalApi`/`personalApps`? (It renders the recruiting fields ~L79–81; check for a personal-production block.) Report yes/no + lines.
4. **`firestore.rules` → `managerWeeklyReports`** — report both arms verbatim:
   - **create** key-validation: are `personalApi`/`personalApps` in a `keys().hasOnly([...])` and/or required by `hasAll([...])`?
   - **update**: confirm it uses `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` (codebase-standard). If so, dropping the two keys from the allow-list is **safe for existing docs** (a form that no longer sends them won't change them → they won't appear in `affectedKeys()` → `hasOnly` never evaluates them).
   - **STOP and flag** if (i) the update arm uses a full `keys().hasOnly` rather than `affectedKeys`, or (ii) either arm REQUIRES the fields via `hasAll` — in those cases the safe move is to leave the keys *tolerated* in the rules and remove only the UI + service.
5. **`isProducingManager` — full consumer sweep** across `src/`, `functions/`, `scripts/`. Confirm the ONLY consumer is the WAR panel gating. **STOP and report** if any other reader exists (a CF, a rollup, a report, a default-profile seed, a type that makes it required).
6. **`scripts/maintenance/set-producing-manager.mjs`** — confirm it exists and its sole purpose is setting the flag (safe to delete).
7. **Production data scan (read-only, Admin SDK):** any `managerWeeklyReports` doc with non-zero `personalApi`/`personalApps`? Expected: none. **STOP** if any non-zero personal production is attributable to a *real* (non-smoke) manager — that would mean discarding live data that should instead be carried to the wizard path. Smoke/test-account residue → note and proceed (discardable).
8. **Tests** referencing `personalApi` / `personalApps` / `isProducingManager` — enumerate (`ManagerWarTab.test.jsx`, `managerWarService` tests, the `managerWeeklyReports` rules emulator test, `ManagerWarDetail.test.jsx`) for Phase 3.

## Phase 2 — build (after authorization)

1. `ManagerWarTab.jsx` — remove the personal-production sub-panel + the `isProducingManager` gating branch.
2. `managerWarService.js` — remove `personalApi`/`personalApps` from write/strip; remove the `isProducingManager` read.
3. `ManagerWarDetail.jsx` — remove the personal-production block if Phase 1.3 found one.
4. `firestore.rules` — remove `personalApi`/`personalApps` from the `managerWeeklyReports` allow-list per Phase 1.4 (conservative fallback: leave tolerated if 1.4 flagged a `hasAll`/full-keys dependency).
5. Delete `scripts/maintenance/set-producing-manager.mjs`.
6. Remove the remaining `isProducingManager` references confirmed in Phase 1.5 (type/interface, any default-profile shape that seeds it).

## Phase 3 — tests

- `ManagerWarTab.test.jsx` — drop personal-production panel tests; assert the panel is gone AND the activity + recruiting fields still render.
- `managerWarService` tests — drop `personalApi`/`personalApps` write assertions.
- `managerWeeklyReports` rules emulator test — drop the `personalApi`/`personalApps` allow cases; IF the keys were removed from the allow-list, add a deny case that an update *changing* `personalApi` is rejected (write a **differing** value so the key appears in `affectedKeys()` — per the banked `diff().affectedKeys()` caveat; otherwise the deny-test silently passes).
- `ManagerWarDetail.test.jsx` — update if it asserted personal production.
- Full Vitest green; lint 0; build clean; hex-grep clean.

## Phase 4 — docs (with placeholders)

- `CONTEXT.md` — ledger entry for this PR; mark the producing-manager WAR-retirement step done.
- `FOLLOW_UPS.md` — mark resolved, citing the superseding PRs:
  - 2026-06-09 "personalApi/personalApps orphaned" FU → retired by this slice.
  - 2026-06-09 "ManagerDashboard Submit Report → WizardForm pollutes leaderboard" FU **and** its paired "leaderboardAggregate non-agent filter" FU → superseded by the arc (Phase 1 leaderboard-visibility + Slice 2.0 CF participant gate already gate non-participants off the board).

## Phase 5 — commit / push / PR / smoke

1. Open PR (BUILD-AND-HOLD; human squash-merge). Report feature-branch HEAD SHA (Rule 20).
2. Poll Gemini; disposition each comment (Rule 21).
3. **Post-merge (operator):** squash-merge → `firebase deploy --only firestore:rules` → then the rules-dependent smoke (never pre-merge).
4. **Smoke (post-merge-and-deploy, write-read-verify, both themes):** a UM (and a BM) files a WAR → it saves with the activity + recruiting fields intact and **no** personal-production fields; the WAR detail renders activity/recruiting with no personal-production section; IF the rules dropped the keys, a write attempting to include `personalApi` is rejected. **Clean up the throwaway WAR doc(s) via Admin SDK** — client deletion is blocked on these collections, so apply the 2.1b smoke's lesson and delete through the Admin SDK; do NOT leave orphaned docs in production.
5. Rule 16 post-merge fill (consolidated).

## Risk notes

- Rules change → human-merge + post-deploy rules smoke; the rules smoke is never pre-merge.
- No data migration expected (Phase 1.7 confirms); if real personal-production data surfaces, STOP — carry it to the wizard path first.
- The `affectedKeys()` pattern (if confirmed in 1.4) makes the rules removal non-breaking for existing docs that still carry the fields.
