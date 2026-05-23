# D1 — Awards Ruleset Config Migration (kickoff brief)

**Track:** D (Awards Expansion + Ruleset Config Migration), first PR.
**Type:** Refactor + config. **Size:** M. **Risk:** Medium — touches `awardsEngine.js` (award eligibility math), but the migration must be **behavior-preserving** (ruleset defaults == today's hardcoded values), and `awardsEngine` test coverage is the safety net.

**Goal (per `docs/phase7-8-implementation.md` §3.1):** move the hardcoded 2026 Tatil award constants out of `awardsEngine.js` into a ruleset object stored at `/tenants/{tid}/config/awardsRuleset/{year}`, and make the engine consume a `ruleset` parameter — `awardsEngine` becomes a pure `(submissions, settlements, persistency, ruleset) -> awardProgress[]` with NO hardcoded rules. This is the foundation Track D parity expansion + the BM at-risk view + (later) Track H's awards soft-migration all build on.

**This is a PHASE-1-FIRST brief.** Run Phase 1 source-verify, report, and STOP — do NOT write code. The dispatcher reviews the findings and locks the Phase 2-5 scope (especially the scope boundary in item 6) before you resume.

---

## Phase 0 — clean main

git checkout main && git fetch origin && git pull --ff-only origin main && git status
Untracked files under scripts/verification/ and scripts/seed/ are expected — ignore them.
Single new branch off fresh main: `feat/d1-awards-ruleset-config`. Never reuse.

**Hard stops (Rule 12):** not on main after sync, dirty tree beyond the known untracked scripts, or a pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report each item with file:line and short quotes. Pair `grep` with `git ls-files` for tracked status (Rule 17). Then emit `STOP and wait for dispatcher` and write no code.

1. **Constant inventory.** Enumerate EVERY hardcoded award rule in `src/utils/awardsEngine.js`: API/apps thresholds, prize amounts, persistency-gate minimums, club-tier API bounds, `excludeAgentTypes` (bdo/dso), Centurion `maxIncPpps`, Rookie/New B's month caps, `defaultPersistencyGate`, and any `productionCreditRules` percentages. Group by award (agent-side AND manager-side). Give line numbers and quote each.

2. **Engine signatures.** Quote the current exported signatures — `computeAgentAwards`, `computeManagerAwards`, and any other exported compute function. Note exactly which arguments they take today.

3. **Consumers / call sites.** Find every place in `src/` that imports `awardsEngine` and calls `computeAgentAwards` / `computeManagerAwards` (and what args each passes). This is the set that must thread the new `ruleset`. List file:line for each.

4. **Existing config pattern to mirror.** How is an existing `/tenants/{tid}/config/*` doc stored and read today — e.g. `companyMinimums`? Quote the Firestore path shape and the loader/service that reads it (and any JS-default fallback). Confirm whether ANY `awardsRuleset` artifact already exists: `grep -rn "awardsRuleset" src` and `git ls-files | grep -i ruleset`.

5. **Test safety net.** Identify the test files that pin `awardsEngine` outputs (e.g. `src/utils/__tests__/awardsEngine.test.js`). Note whether the tests hardcode expected award values/thresholds (those will need to pass the ruleset, or read the default ruleset, to stay green). Report current suite green baseline for these files.

6. **Recommended scope boundary for D1 (propose; dispatcher locks).** Classify each piece as IN or DEFER for THIS PR:
   - (a) a default ruleset module (the 2026 values as data) + thread `ruleset` through the engine + update consumers + update tests — *expected IN*;
   - (b) Firestore doc at `/tenants/{tid}/config/awardsRuleset/2026` + a loader service (read-with-JS-default-fallback) — *IN or DEFER to D1b?*;
   - (c) Tenant-Admin editor UI for the ruleset — *expected DEFER (later D PR)*;
   - (d) awards parity expansion / BM at-risk view (§3.2, §3.3) — *DEFER (separate D PRs)*.
   Recommend the smallest behavior-preserving slice that still lands the engine signature change cleanly.

**Then: `STOP and wait for dispatcher`.**

---

## Provisional Phase 2-5 (DISPATCHER LOCKS THESE AFTER PHASE 1 — do not execute yet)

- **Phase 2 — build.** Create the default 2026 ruleset as data (location/shape per the pattern verified in 1.4). Refactor `awardsEngine` to read all rules from the passed `ruleset` (zero hardcoded rule literals left). Thread `ruleset` through every consumer from 1.3 (loading it where the engine is invoked). Update the tests from 1.5 to supply/derive the ruleset.
- **Phase 3 — gates + PARITY.** Full Vitest suite green; lint 0; build clean. **Behavior-preserving check is non-negotiable:** award outputs with the default ruleset must equal the pre-refactor outputs (the defaults == the old hardcoded values, exactly). Call out any award whose result changes — that is a regression, not progress.
- **Phase 4 — docs with placeholders.** CONTEXT.md recently-shipped row + Where-we-left-off; FOLLOW_UPS.md (mark the D1 entry / Track D progress). Use `#TBD` / `{TBD}` for PR number + squash SHA.
- **Phase 5 — PR.** Branch `feat/d1-awards-ruleset-config`. Commit, push, `gh pr create`. Rule 15: report `git log origin/<branch> --oneline -1` full SHA. End at PR-open. Do NOT merge.
- **Smoke — locked after Phase 1.** If D1 includes the Firestore loader (1.6b IN), add a smoke leg (seed the ruleset doc, compute awards for a known agent, assert parity). If JS-default-only, the green parity suite is the verification (waiver justified: pure-logic refactor, no new user-visible surface). Dispatcher confirms at lock.

---

## Report (Phase 1 deliverable)

- Items 1-6 above, each with file:line + quotes.
- Your recommended D1 scope boundary (the IN/DEFER split) with a one-line rationale.
- End with `STOP and wait for dispatcher`.
