# Test Infrastructure Follow-up — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1–1.5 hours, single PR.
**Two-strike counter:** Project carry-in **0/2** (clean — five prior arcs this week without strikes). Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#137 squash SHA (CC captures in Phase 1).
**Source:** Test Infrastructure follow-up entry in `docs/FOLLOW_UPS.md` — partial close. Test infra investigation surfaced two unwritten regression specs + missing CI integration.

---

## Context

Test infrastructure investigation found:
- Vitest v3.2.4 installed and working (48 files / 603 tests passing locally)
- All tests live in `src/`; clean single-framework setup
- CI runs lint + build only — `npm test` is NOT in CI
- Two named regression specs from the FOLLOW_UPS entry are unwritten:
  - `agentManagementService.createUser` regression suite (3 tests guarding HIGH#1 fix)
  - `doCreateUser emailQueued` return-shape tests (2 tests guarding PR #136 fix)

This brief closes both gaps: writes the named specs and plumbs `npm test` into CI.

---

## Decisions locked (do not re-litigate)

### Both spec sets live in `src/services/__tests__/agentManagementService.test.js`

Both named specs are wrapper-level tests — they exercise `agentManagementService.createUser` with mocked `httpsCallable` returning various CF response shapes. No `functions/`-side test infrastructure is added — that's separate scope, post-pilot if ever.

The "doCreateUser emailQueued return-shape" tests are testing the WRAPPER's preservation of the `emailQueued` + `emailError` fields, not the CF itself. The CF return shape is reviewed in code review; the wrapper layer is where silent regressions (lost destructuring, swallowed fields) actually happen.

### Mocking strategy: mock `httpsCallable` at the module level

Use `vi.mock('firebase/functions', ...)` with a factory returning `httpsCallable` as a `vi.fn()`. Per-test, configure the mock to return specific data shapes or throw specific errors.

This is the same pattern already used in `src/components/manager/__tests__/EditUserDrawer.test.jsx` (per Phase 1 investigation) — proven precedent in this codebase.

### Test specs (5 tests total)

In `agentManagementService.test.js`:

1. **`createUser` happy path** — mock CF returns `{ uid: 'test-uid', emailQueued: true }`; assert wrapper returns the same object unchanged.
2. **`createUser` email-dispatch failure** — mock CF returns `{ uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' }`; assert wrapper returns the same object unchanged. (This is the PR #136 regression guard.)
3. **`createUser` callable rejection** — mock CF throws an HttpsError; assert wrapper propagates the error.
4. **`createUser` preserves emailQueued: true on success** — assertion subset of test 1; explicit `emailQueued === true` check. (Redundant with test 1 by intent, kept for explicit named-spec coverage.)
5. **`createUser` preserves emailQueued: false + emailError on failure** — assertion subset of test 2; explicit `emailQueued === false && typeof emailError === 'string'`. (Redundant with test 2 by intent, kept for explicit named-spec coverage.)

Tests 4 and 5 can be implemented as `it.each(...)` cases within tests 1 and 2 if CC prefers a cleaner file structure, but the named-spec count must be 5 logical assertions.

### CI integration: single workflow file edit

Add a `test` step to `.github/workflows/ci.yml`, running after lint, before build:
```yaml
- name: Run tests
  run: npm test -- --run
```

The `--run` flag prevents vitest from entering watch mode in CI. Test failures must block the PR (default behavior — failure exit code halts the workflow).

### NO new test infrastructure additions

- No coverage tooling (`@vitest/coverage-v8`, c8, istanbul, etc.) — separate ticket
- No new test framework
- No `functions/`-side test infrastructure
- No playwright/axe wiring changes (already installed, used in standalone scripts only)
- No vitest config changes (config is fine as-is)

---

## Scope

Ships in this single PR:

- `src/services/__tests__/agentManagementService.test.js` — 5 tests covering both named regression specs
- `.github/workflows/ci.yml` — `npm test -- --run` step added after lint, before build
- `docs/CONTEXT.md` "Recently shipped" row append (5-row sliding window, drop oldest)
- `docs/FOLLOW_UPS.md` — Test Infrastructure entry fully resolved (struck or moved to a "Resolved" section per existing convention)

---

## File inventory

**Files to create:**

| Path | Purpose |
|---|---|
| `src/services/__tests__/agentManagementService.test.js` | 5 tests covering wrapper behavior against various CF return shapes + rejection |

**Files to touch:**

| Path | Change |
|---|---|
| `.github/workflows/ci.yml` | Add `npm test -- --run` step |
| `docs/CONTEXT.md` | Append "Recently shipped" row (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | Mark Test Infrastructure entry fully resolved |

**No other files expected to change.** If Phase 1 surfaces a reason to modify `agentManagementService.js` itself (e.g., it's not testable without refactor), STOP and surface.

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

Quick re-verification before writing tests:

1. Capture main HEAD SHA via `git log origin/main --oneline -1`.
2. Re-confirm `npm test` runs clean (48 files / 603 passing) — establishes the baseline.
3. Read `src/services/agentManagementService.js` to confirm the wrapper structure — what `createUser` actually does, how it calls `httpsCallable`, what error shape it propagates.
4. Read `src/components/manager/__tests__/EditUserDrawer.test.jsx` to confirm the `vi.mock('firebase/functions', ...)` precedent works the way the brief assumes.
5. Confirm `.github/workflows/ci.yml` has the expected lint + build job structure (per Phase 1 investigation) — no surprises.

Surface in chat: "Baseline confirmed: 48/603 pass, agentManagementService.createUser is X lines, EditUserDrawer mock pattern works as expected, ci.yml has Y job structure. Proceeding to Phase 2."

If anything diverges → STOP and surface.

### Phase 2 — Write tests + wire CI

- Write all 5 tests in `src/services/__tests__/agentManagementService.test.js`
- Add CI step to `.github/workflows/ci.yml`
- Confirm tests pass locally: `npm test` should now report 49 files / 608 tests
- Spot-check the CI workflow YAML is valid (no syntax errors) before commit — `gh workflow view ci.yml` or visual inspection

### Phase 3 — Docs, lint, build, commit, push, PR

- Update `docs/CONTEXT.md` with placeholder Recently-shipped row
- Update `docs/FOLLOW_UPS.md` to fully resolve the Test Infrastructure entry — strike all sub-items, note the closing PR # placeholder
- `npm run lint` → 0 errors (2 pre-existing warnings unchanged)
- `npm run build` → success
- Conventional commit(s)
- Push, open PR
- **PR title:** `test(infra): close test infra MEDIUM — agentManagementService specs + CI test step`
- **PR description must include:**
  - Summary
  - The 5 test specs listed with their assertion focus
  - Local test run output (49/608 pass)
  - CI workflow change summary
  - Verification matrix

### Phase 4 — STOP

DO NOT MERGE. Kyron reviews, confirms CI passes on the PR (now that test step is added — the PR itself becomes the first test of the new CI step), merges manually.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Baseline test count differs materially from 48/603 → STOP and surface (drift from Phase 1 investigation)
- `agentManagementService.createUser` is structured in a way that prevents clean mocking → STOP and surface, do not refactor the wrapper
- `httpsCallable` mock pattern doesn't work the way the brief assumes (different module path, different factory shape) → STOP and surface
- New tests fail when run → STOP and surface, do not skip or comment out
- CI workflow YAML has syntax issues → STOP and surface
- New CI step causes the PR's own CI run to fail in unexpected ways (other than the test step itself running successfully) → STOP and surface
- First unexpected behavior of any kind — standard 2-strike loop applies, but lean toward surfacing early

---

## NOT in scope

- Coverage tooling (`@vitest/coverage-v8`, c8, istanbul) — separate ticket
- `functions/`-side test infrastructure — would require new framework setup, post-pilot if ever
- Playwright/axe wiring into vitest — already installed, used in standalone scripts only
- Vitest config changes — config is fine as-is
- Refactoring `agentManagementService.createUser` to make testing cleaner — out of scope; if the wrapper isn't testable, STOP and surface for direction
- Additional tests beyond the 5 named specs
- Removing or modifying any existing tests
- Migration of standalone scripts (`scripts/verification/`) into vitest

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass locally | `npm test -- --run` | 49 files / 608 tests, 100% pass |
| Build succeeds | `npm run build` | success, no warnings |
| New test file present | `Test-Path src\services\__tests__\agentManagementService.test.js` | True |
| CI workflow updated | `git diff .github/workflows/ci.yml` | `npm test -- --run` step added |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | "Recently shipped" row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | Test Infrastructure entry marked fully resolved |
| Self-test (PR's own CI) | GitHub PR Checks tab | test step runs, all 608 tests pass in CI |

---

## CC kickoff prompt (one-liner)

> Execute the test infra follow-up per the brief in `docs/briefs/test-infra-cleanup-kickoff.md`. Project strike count 0/2 (clean). Standard 2-strike loop. Read the brief, begin Phase 1 (re-verification), surface baseline before writing any tests. Do NOT merge — open PR with all 5 tests + CI step, stop. The PR itself self-tests the new CI step on its first run.
