# D1b — Awards Ruleset Firestore Loader + Consumer Threading (kickoff brief)

**Track:** D (Awards Expansion + Ruleset Config Migration), second PR. Follows D1 (#283, ruleset extracted to `src/config/awardsRuleset/2026.js`; `awardsEngine` now takes an optional `ruleset` param defaulting to `DEFAULT_RULESET_2026`; consumers still call without it).
**Type:** Feature (loader service + consumer threading + rule). **Size:** M-L. **Risk:** Medium — touches the three award consumers (user-visible) and adds a Firestore read + rule. Behavior-preserving: with no per-tenant ruleset doc, the loader returns `DEFAULT_RULESET_2026`, so awards compute identically to D1.

**Goal:** add a loader that reads `/tenants/{tid}/config/awardsRuleset/{year}` (falling back to `DEFAULT_RULESET_2026` when absent), thread the loaded ruleset through the three consumers, and add the Firestore read rule. This is what lets a per-tenant ruleset actually take effect; the Tenant-Admin editor that WRITES it stays deferred (later Track D PR).

**PHASE-1-FIRST.** Run Phase 1 source-verify, report, and STOP — no code. The dispatcher locks the Phase 2-5 scope (merge strategy, consumer-wiring approach, smoke shape, and any split) before you resume.

---

## Phase 0 — clean main

git checkout main && git fetch origin && git pull --ff-only origin main && git status
Untracked files under scripts/verification/ and scripts/seed/ are expected — ignore them.
Single new branch off fresh main: `feat/d1b-awards-ruleset-loader`. Never reuse.

**Hard stops (Rule 12):** not on main after sync, dirty tree beyond known untracked scripts, or a pull conflict -> `STOP and wait for dispatcher`.

---

## Phase 1 — source-verify, then HARD-STOP

Report each with file:line + short quotes. Pair grep with `git ls-files` for tracked status (Rule 17). Then emit `STOP and wait for dispatcher`, no code.

1. **D1 landing state.** Quote: the `DEFAULT_RULESET_2026` export (file + top-level shape — agent awards, club tiers, manager awards, etc.); the `awardsEngine` signatures showing the `ruleset = DEFAULT_RULESET_2026` default; and the three consumer call sites confirming they currently pass NO ruleset (AgentAwardsPanel.jsx, ManagerAwardsPanel.jsx, AgentReportDocument.jsx).

2. **Loader pattern to mirror.** Quote `getCompanyMinimums` in full (`src/services/goalsService.js`) — the `getDoc -> exists ? data() : {}` shape and exactly how it merges defaults (the per-field `?? default` and the nested `{ ...DEFAULT_X, ...(stored.x ?? {}) }` spreads for weeklyActivityFloors / tenureApiFloors). This is the precedent for the awardsRuleset loader.

3. **Consumer data-loading + tenantId.** For each of the three consumers, how does it currently obtain `tenantId` and load its async data (a useEffect + useState? a context? props)? Specifically:
   - AgentAwardsPanel.jsx / ManagerAwardsPanel.jsx — where would an async ruleset load hook in next to the existing loads?
   - AgentReportDocument.jsx (the @react-pdf/renderer PDF) — is its data loaded before render and passed in, or fetched inside? Flag if the PDF's data path makes async ruleset loading disproportionately complex (possible split — see item 6).

4. **Firestore rules for config.** Quote the rule that currently governs reads of `tenants/{tid}/config/*` (companyMinimums is client-read, so a rule exists). Is it a wildcard `match /config/{doc}` that already covers a new `awardsRuleset/{year}` path, or doc-specific (needs an additive read rule)? Note the path depth — `config/awardsRuleset/{year}` is one segment deeper than `config/companyMinimums`; confirm whether that changes the rule match.

5. **Test + seed precedent.** The existing `getCompanyMinimums` test (the loader-test pattern to mirror), and how companyMinimums is seeded (a script? or pure fallback, no seed)? Report whether anything writes a config doc today.

6. **Recommend (dispatcher locks):**
   - **Merge strategy** — when a Firestore `awardsRuleset` doc exists, use it AS-IS (assume complete, simplest + safest, since no editor writes partials yet) vs deep-merge over `DEFAULT_RULESET_2026` (companyMinimums-style). Given the ruleset is deeply nested and no editor exists yet, *recommend the simpler safe option and say why.*
   - **Seed** — does D1b seed a 2026 doc, or rely purely on the fallback (no doc -> DEFAULT_RULESET_2026, behavior identical to D1)? Recommend.
   - **Loader location** — new `src/services/awardsRulesetService.js`, or add to an existing service?
   - **Split** — if AgentReportDocument's async wiring is heavy, recommend whether the PDF consumer splits to a follow-up (D1b-pdf) so the two panels land first.

**Then: `STOP and wait for dispatcher`.**

---

## Provisional Phase 2-5 (DISPATCHER LOCKS AFTER PHASE 1 — do not execute yet)

- **Phase 2 — build.** Loader `getAwardsRuleset(tenantId, year)` mirroring `getCompanyMinimums` (fallback to `DEFAULT_RULESET_2026` per locked merge strategy). Thread the loaded ruleset into each consumer's `computeAgentAwards` / `computeManagerAwards` call (async load alongside existing data). Add the Firestore read rule if item 4 shows one is needed.
- **Phase 3 — gates + parity.** Full Vitest suite green; lint 0; build clean; emulator rules test for the new read path if a rule was added. Behavior-preserving: with NO Firestore doc, awards output is identical to D1 (the loader returns the default). Add loader tests (fallback returns default; a present doc is honored) + consumer tests updated for the async ruleset.
- **Phase 4 — docs WITH the v2.1 placeholder convention.** Write all fillable values inline in final form using the four tokens — PR link `[#TBD](https://github.com/Kelsean868/agencytrack/pull/TBD)` (never bare `[{TBD}]`), squash SHA `` `{TBD}` ``, date `{DATE-TBD}`. Write the `Last updated` line as `| Last updated | {DATE-TBD} (<note>) |` and the `Current main HEAD` line as `` | Current main HEAD | `{TBD}` ([#TBD](https://github.com/Kelsean868/agencytrack/pull/TBD) — D1b loader) | `` so the post-merge fill advances them. CONTEXT.md recently-shipped row + Where-we-left-off; FOLLOW_UPS.md mark D1b shipped, note the editor + parity/at-risk still queued.
- **Phase 5 — PR.** Branch `feat/d1b-awards-ruleset-loader`. Commit, push, gh pr create --fill. Rule 15: report `git log origin/<branch> --oneline -1` full SHA. End at PR-open. Do NOT merge.
- **Smoke — NOT waived (locked after Phase 1).** D1b has user-visible surface (awards panels) + a new Firestore read + rule, so the suite is not sufficient alone. Expected legs: in production with no custom ruleset doc, the awards panels render with awards identical to today (fallback works); and a write-read-verify on a seeded test ruleset doc (seed an override, confirm an award threshold changes, delete the test doc). Dispatcher confirms the exact legs at lock.

---

## Report (Phase 1 deliverable)

- Items 1-6, each with file:line + quotes.
- Your recommended merge strategy / seed / loader location / split, with one-line rationale each.
- End with `STOP and wait for dispatcher`.
