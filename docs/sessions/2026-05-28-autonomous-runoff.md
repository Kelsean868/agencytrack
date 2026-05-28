# Session Ledger — 2026-05-28 Autonomous Runoff

4-hour autonomous run. Tasks dispatched in order: TASK 1 (goals rule verification), TASK 2 (F3.1 log-policy auto-open), TASK 3 (Track E recon), TASK 4 (smoke cleanup discipline), TASK 5 (F2.2 email-to-BM recon).

---

## TASK 1 — `goals/{goalId}` agent-write rule verification

**Outcome: Bug confirmed → PR #382 opened (STOPPED for dispatcher review)**

### Findings
- `setGoals()` in `src/services/goalsService.js:92–163` is a direct client-side `setDoc(ref, payload, { merge: true })` — NOT a Cloud Function call.
- Document ID is the agent's own UID (`agentId`).
- The write predicate in `firestore.rules:489` was `allow write: if canManage(tenantId);` — `canManage` excludes `isAgent()`.
- Agent personal commitment saves (CareerPortal → `setGoals`) were silently DENIED in production. FU was correct.

### Fix drafted
Branch: `fix/goals-agent-write-rule`

New write arm added:
```
allow write: if canManage(tenantId) ||
  (isSignedIn() && isAgent() && getTenantId() == tenantId && goalId == request.auth.uid);
```

Mirrors the existing read arm exactly. New emulator test file: `tests/rules/goals.rules.test.mjs` (10 test cases: 4 read, 6 write).

### PR
[PR #382](https://github.com/Kelsean868/agencytrack/pull/382) — **STOPPED. Awaits dispatcher review before merge.** Rules change requires your confirmation; emulator tests need to pass before deploy.

### Banked finding
`workSchedule` field on the user doc (proposed for Track E PRD) will hit the same class of bug — the `users/{uid}` write rule does not include `workSchedule` in its allowlist. Flagged in Task 3 design questions (Q6).

---

## TASK 2 — F3.1 "Log Policy" auto-open create form

**Outcome: Already shipped → FU closed**

PR #367 (`3d9d51b`) had already implemented the `setPrefillPolicy` + `setActiveTab('policy-ledger')` + `openCreate()` behavior. Task 2 was converted into a FU-close operation folded into Task 3's docs PR.

---

## TASK 3 — Track E recon doc

**Outcome: Shipped → [PR #383](https://github.com/Kelsean868/agencytrack/pull/383) merged (docs-only, autonomous-merge OK)**

### Deliverables
- `docs/track-e-recon.md` — full audit of DailyEntryModal sections/fields, FAB, schema, aggregator field mapping, what's NOT built (skip-day, work-schedule, holiday calendar), PRD §4.5 field divergence table, proposed `workSchedule` schema, auto-skip logic
- `docs/track-e-design-questions.md` — 8 design questions (Q1–Q8) with CC recommendations; Q1 (field mapping rename vs schema change) flagged as the implementation-blocking question
- `docs/FOLLOW_UPS.md` — F3.1 UX FU closed (PR #367 shipped it)

---

## TASK 4 — Smoke cleanup discipline

**Outcome: Shipped → [PR #384](https://github.com/Kelsean868/agencytrack/pull/384) open (autonomous-merge OK)**

### Deliverables
- `docs/runbooks/smoke-discipline.md` — canonical Pattern A (emulator-based, `h3-parity-test.mjs` gold standard) and Pattern B (production Playwright UI smoke, snapshot-before + REST restore in `finally{}`); conformance table for all 7 smoke scripts in `scripts/verification/`
- `scripts/verification/p9-sm-target-smoke.mjs` — retrofitted to Pattern B:
  - `SMOKE_RUN_ID = \`p9smtarget_${Date.now()}\`` printed at startup
  - `firestoreGetDoc` / `firestoreDeleteDoc` REST helpers added
  - `smDocPath` / `otherDocPath` promoted to module scope
  - Pre-test snapshot via REST GET before first write
  - `cleanupSmoke()` in `finally{}`: REST PATCH with `updateMask` to restore original fields + purge `smokeTestPassed`/`smokeTest`; DELETE `otherDocPath` in case D2 unexpectedly allows; verify-after check
  - `process.exitCode = 1` on cleanup failure
  - UI-based cleanup block removed

### Commit: `8fc4ed8`

---

## TASK 5 — F2.2 email-to-BM recon doc

**Outcome: Shipped → [PR #385](https://github.com/Kelsean868/agencytrack/pull/385) open (autonomous-merge OK)**

### Deliverables
`docs/f2.2-email-to-bm-design-questions.md` — 5 sections:

1. Current surface: F2.1 in-app notification path, `mail/` queue pattern, joint-call schema, `resolveBmInfo` helper, BM email resolution via `admin.auth().getUser(bmUid).email`
2. F2.2 scope: new CF + 2 templates; no UI/rules/schema changes
3. 8 design questions with CC recommendations (Q1: `onCreate` trigger; Q2: 300-char comments excerpt; Q3: dynamic subject on saleMade; Q4: bare app URL CTA; Q5: BM-is-author skip; Q6: BM only, no SM cc; Q7: non-fatal failure = established pattern; Q8: no audit collection)
4. Proposed implementation shape: CF export, trigger path, template variable list
5. Open questions table — all 8 have defaults, none implementation-blocking

### Commit: `ac8e0fd`

---

## Summary table

| Task | Outcome | PR | Notes |
|---|---|---|---|
| T1 goals rule verification | Bug confirmed | [#382](https://github.com/Kelsean868/agencytrack/pull/382) | **STOPPED — awaits dispatcher review** |
| T2 F3.1 auto-open | Already shipped | — | FU closed in PR #383 |
| T3 Track E recon | Shipped | [#383](https://github.com/Kelsean868/agencytrack/pull/383) | Autonomous-merge OK |
| T4 smoke cleanup discipline | Shipped | [#384](https://github.com/Kelsean868/agencytrack/pull/384) | Autonomous-merge OK |
| T5 F2.2 recon | Shipped | [#385](https://github.com/Kelsean868/agencytrack/pull/385) | Autonomous-merge OK |

## Strike log
Zero strikes recorded.

## Banked findings
1. **`goals/{goalId}` write bug** — agent personal commitment saves silently denied in production. Fix in PR #382.
2. **`workSchedule` rules gap** — same class as goals bug. When Track E builds the work-schedule editor, the user-doc write rules must be extended. Flagged in T3 Q6.
3. **`h3-parity-test.mjs` is the Pattern A gold standard** — emulator scripts without a `RUN_ID` sentinel + `finally{}` zero-verify should be retrofitted on next touch.
4. **F2.2 BM email resolution** — BM email comes from `admin.auth().getUser(bmUid).email`, not the Firestore user doc. CF must use Admin SDK auth lookup, not a Firestore read.
5. **Context compaction mid-session** — session ran long enough to trigger context compaction between Task 3 and Task 4. Resumption from compaction summary was clean; no work was lost or duplicated.
