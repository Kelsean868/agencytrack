# PR Kickoff — TOOLING: Cloud Function test harness (AUTONOMOUS-SAFE)

**Track:** banked FU (test infra), now directly relevant — I3b is a new CF, and today CFs are verified only by deploy + production smoke. **Type:** Test-infra · **Size:** M · **Risk:** Low — adds tests only; **must not touch CF runtime code**, so the worst case is "no tests added," never a broken Function.
**AUTONOMOUS RUN:** Kyron away ~5h; chat-Claude not reviewing mid-flight. Proceed through phases WITHOUT pausing for review, honor the STOP-conditions, end at PR-open, NEVER merge. When in doubt, STOP and note.

## Goal

Stand up `firebase-functions-test` (offline mode) in the `functions/` workspace and write trigger-level unit tests for the EXISTING Cloud Functions — so future CFs (I3b's escalation CF next) can be unit-tested rather than relying solely on deploy + production smoke.

## Hard guardrails (autonomous safety)
- **NO changes to any CF runtime code** — not `functions/index.js`, not `functions/war/*.js`, not any export's logic. The diff is: `functions/package.json` (add the dev dependency), a test setup file, and new test files ONLY.
- **NO deploy.** Test-infra only.
- **STOP-CONDITION A:** if `firebase-functions-test` won't initialize cleanly in offline mode after a reasonable attempt (gen-1 wrapping fails, Admin SDK init fights the test env, etc.), STOP. Deliver whatever tests DID work, mark the FU "partially done / harness blocked — reasons: …" in the report, and do NOT refactor CF code to force it. A no-op here is acceptable.
- **STOP-CONDITION B:** if testing a CF would require changing that CF's code to be testable, DO NOT change it — note it as "needs a testability refactor (separate attended PR)" and move on.
- **STOP-CONDITION C:** anything ambiguous → STOP, note, move to the next CF.

## Phase 1 — source-verify (report, then proceed)

1. Enumerate every CF export (`functions/index.js` + `functions/**`): name, trigger type (Firestore onWrite / onSchedule / etc.), gen (gen-1), region. Quote the registrations.
2. The existing `functions/` test setup, if any (package.json test script, any test runner/config). Report what's there.
3. For each CF, note whether its core logic is already extracted to a pure module (e.g. `jfwCountLogic.js`) — those are the easiest to assert against; triggers whose logic is inline are harder and may hit STOP-condition B.

## Build (after Phase 1, no stop needed unless a STOP-condition fires)

- Add `firebase-functions-test` as a `functions/` dev dependency; offline mode (no project credentials).
- A test setup that wraps the gen-1 triggers and mocks the Admin SDK Firestore as needed.
- Trigger tests for the existing CFs, prioritizing the ones with extracted pure logic first (e.g. `recomputeJfwCount` / `onWarWrite`: a write event with a known WAR → assert the `jfwCount` write-back behavior; the de-dup/loop-guard path). Add what's cleanly testable; skip (with a note) any that hit STOP-condition B.
- These tests live in `functions/` and run via the functions workspace test command (report how they're invoked).

## Phases

1. Source-verify (above). Report; proceed.
2. Harness setup + the first CF test (the easiest, e.g. the jfwCount trigger). Confirm it runs green before expanding.
3. Expand to the other cleanly-testable CFs. Note any skipped (STOP-condition B).
4. Docs WITH placeholders: CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark the CF-test-harness FU resolved (or "partial — N of M CFs covered, rest noted") depending on outcome.
5. Commit / push / PR. Branch off fresh main (`git fetch` first). Confirm the diff is package.json + test setup + test files ONLY — zero CF runtime changes. Lint + build. Full app suite (env-unset) + the new functions tests. Push, PR via `gh`, Rule 15. **Do NOT merge.**

## Acceptance
- `firebase-functions-test` set up; at least the highest-value CF (the jfwCount trigger) has a green trigger test — OR a clear STOP-condition-A report explaining why the harness wasn't feasible (benign).
- Diff contains NO CF runtime code changes — confirmed.
- App suite green (env-unset); new functions tests green; lint 0; build green.
- PR open, not merged. Rule 15 SHA reported.

## Smoke — WAIVED (justified)
Test-infra only; no runtime/user-visible change; no deploy. The new tests ARE the verification. (Confirm in the report: zero CF runtime changes.)

## Post-merge (when Kyron returns + reviews)
Standard docs fill, no deploy.
