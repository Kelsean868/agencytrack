# FR round 2 — rulings on the R2 report and the follow-up slices (kickoff brief)

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 30-09-2026
**Source:** CC's round 2 final report (29-09-2026), with Kyron's rulings ("go with your picks", 29-09-2026 21:58 TT). #1014–#1021 are merged; see `docs/CONTEXT.md` once the fill lands.
**Channel:** every slice is `human-merge`. One slice = one branch = one PR, each cut fresh from `origin/main`.
**Delegation (CLAUDE.md):** the pinned model keeps design, money logic, rules and review. Haiku 4.5 for searches, logs and test counts; Sonnet 5.5 only for edits the main model has specified exactly. Never delegate `firestore.rules`, functions auth or money math.

## 0. Rulings (Kyron, 29-09-2026) — locked

| # | Question | Ruling |
|---|---|---|
| 1 | Does the 2-dp rule reach payouts? | **Yes.** The campaign gate reading, the award engine's persistency criteria and the stored `meetsAwardGate` all judge `roundPersistencyPct(x)`. Build as slice R2-1b below. The precision-only test edits in #1014 (e.g. `'86.6%'` → `'86.63%'`) are accepted under R-a. |
| 2 | Two month charts on the FR Persistency screen | Hide the Persistency **tab's** trend chart under the FR look; the Nexus look keeps it. Slice R2-2b. |
| 3 | Saved playground settings never load back | Load the saved settings when the screen opens. A scenario the agent loads replaces them on screen until the agent saves again. Saved scenarios keep loading as Annual. Slice R2-3b. |
| 4 | Campaign "Change status" | Keep the jump to the Policy ledger with that policy's drawer open. Locking head-office **Pending** policies is **not** built now — bank it as a follow-up (needs a ledger and rules change). |
| 5 | Nexus Career keeps the old badge grid | Confirmed. The Trophy room exists only in FR, so Nexus keeps `BadgeGrid`. This amends R-c. |
| 6 | Old reinstatement declaration returns after a new lapse | Option **C**: #1019 merged as is. The import-side fix is slice R2-6b. The one-line addition to the head-office guard test's allowlist and the 60-day "not confirmed" threshold are confirmed. |
| 8 | Canvas features left out of R2-8 / R2-9 | Agreed. They stay as banked follow-ups. |
| — | Preview smokes on #1014–#1021 | Waived under Rule 13 (preview env has no credentials; previews run against production). Claude-web runs one read-only production click-through after the merges. The fill banks the deferred-verification FU. |

## 1. Queue — run in this order

| # | Item | Model / effort |
|---|---|---|
| F-0 | Consolidated post-merge fill for #1014–#1021 (Rule 16(c)) | Sonnet 5.5 / low |
| R2-7 | Commission playground FR port (now unblocked: #1016 is merged) — spec unchanged in `fr-round2-program.md` | Opus 5.5 / medium |
| R2-11, R2-10 | Leaderboard, then Career — `docs/briefs/fr-career-leaderboard-kickoff.md` | per that brief |
| R2-1b | Payouts on the 2-dp rule | Opus 5.5 / high |
| R2-6b | Import side clears a stale reinstatement declaration | Opus 5.5 / high |
| R2-3b | Saved playground settings load back | Opus 5.5 / medium |
| R2-2b | Hide the tab trend chart under FR | Sonnet 5.5 / low |
| A-1 | Audit only: the client "lapse policy" write vs its rules arm | Opus 5.5 / medium |

### F-0 — consolidated fill
- One fill commit covering #1014, #1015, #1016, #1017, #1018, #1019, #1020, #1021, with the ledger (PR · squash SHA · Rule 16(b) class) in the commit body. `Current main HEAD` = the last work squash.
- Bank one Rule 13 deferred-verification FU (append at end, Rule 7b) listing each PR's read-only click-through steps verbatim from its PR body.
- Bank the R2-4 follow-up: "Head-office Pending policies can still be changed from the ledger" (needs ledger + rules change; not built).
- Record the rulings above in the FOLLOW_UPS entries they settle (RESOLVED notes, Rule 7).
- Rule 15 origin verification on the push.

### R2-1b — payouts on the 2-dp rule
- **Scope (from #1014's STOP list):** `campaignEngine.js` `persistencyPctForPeriod` / `persistencyPctAtFinalMonth` (today `Math.round(x * 100)`); `awardsEngine.js` persistency comparisons against `persistGate` (today raw); `persistencyService.js` stored `meetsAwardGate` (today raw); then every display that prints those readings (listed in #1014's body and the MEDIUM FU "Persistency verdicts still on whole-number or raw values in money logic") moves to `formatPersistencyPct`.
- **Commit 1:** characterization tests that pin today's outcomes at 89.49 / 89.50 / 89.60 / 89.994 / 89.995 / 89.996 / 90. **Commit 2** changes the code and updates exactly these expectations, in a table in the PR body: campaign gate — 89.50 and 89.60 now **fail** (were whole-number 90); award criteria — 89.995 and 89.996 now **pass** (were raw fails). Any other expectation change: **STOP and wait for dispatcher**.
- Parity test: the campaign card, the Campaign screen, the Persistency screen and Today print the same string and the same verdict for one fixture.
- No rules change. The stored-flag change is a write-semantics change only (no new field). Close the MEDIUM FU.

### R2-6b — stale declaration after a new lapse
- **Finding (CodeRabbit on #1019):** a declaration made on a lapsed policy can reappear as "declared" after head office reinstates and then lapses the policy again, because the import never clears `reinstatementDeclaredAt/By/Note`.
- **Fix shape:** on import, when a policy's head-office status moves **into** lapsed from any non-lapsed status, clear the three declaration fields in the same write. Only the declaration fields; no status, money or evidenced field changes.
- Phase 1: find the import write path (`functions/` and any client import), quote it, and confirm the fields are writable there under the current rules. If a rules change is needed: **STOP and wait for dispatcher**.
- Tests: functions test for lapsed → reinstated → lapsed clearing the fields; lapsed → lapsed keeps them; no other field touched.
- **Deploy:** Kyron runs `firebase deploy --only functions` after merge (Rule 19). The PR body states the exact step and the pre-flight (HEAD = `origin/main`, `functions/node_modules` installed, `firebase use agencytrack-2a610`).

### R2-3b — saved playground settings load back
- On open, `GoalDecompositionTab` (and the FR port, if R2-7 has merged) loads the saved playground settings — including `playgroundIncomeGoalPeriod` and `playgroundSettlementRate` — before first render of the inputs; missing keys fall back to today's defaults.
- Loading a saved scenario replaces the on-screen values until the agent saves again; it does not overwrite the saved settings.
- Tests: save → reload → values restored (period, settlement rate, each numeric key); scenario load overrides without writing; missing keys → defaults.

### R2-2b — hide the tab chart under FR
- `PersistencyTab` receives `fr`; under FR it does not render `PersistencyTrendChart`. Nexus unchanged. Test both looks.

### A-1 — audit only (inline, no brief PR needed afterwards)
- Question: does the client-side "lapse policy" write satisfy its own rules arm, given it omits `statusSource` / `statusSetBy`? Read the write and the arm, run the rules test for that write in the emulator, and report the answer with evidence. No code change in this task; if it fails, bank a HIGH FU with the fix shape.

## 2. Named rituals (every slice)
1. Phase 1 commands and output in the PR body (Rule 17).
2. `npm run lint` 0 · full `npm test` · `npm run build`.
3. FR harness walk where a screen changes, both themes, desktop / phone.
4. Mutation check on each new verdict test; paste the result.
5. CI green (one re-run for a named known flake). `@coderabbitai review`; Rule 21 table.
6. PR-ready report with HEAD SHA (Rule 20) and gaps (Rule 22).

## 3. Stops
- Any rules change, new collection or index: **STOP and wait for dispatcher**.
- R2-1b expectation changes outside its table: **STOP and wait for dispatcher**.
- Anything that would touch production data, deploy, or merge: **STOP IMMEDIATELY**.
