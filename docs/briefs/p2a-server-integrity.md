# Brief — Audit Phase 2a: server integrity (SEC-06, BUG-08, BUG-09, SEC-16)

**Model:** Sonnet 5 · **Effort:** high
**Type:** functions change → human-merge; Kyron runs the deploy. Claude Code never merges or deploys.
**Source:** `docs/audits/agencytrack-audit-2026-09-24.md` § 4 (read each finding's section before you start). Line numbers in the audit are from 24 Sep; find the code by name if they moved.

Four fixes, all in `functions/`. One PR.

## 1. SEC-06 — Agent-of-month CFs trust the caller's `branchId`
Files: `functions/agentOfMonth/setAgentOfMonth.js`, `functions/agentOfMonth/getCandidates.js`.
- For a `branch_manager` caller: ignore `data.branchId`. Use the caller's own `branchId` (from the caller's user doc; `token.branchId` if present and equal). If the caller sent a different `branchId`, throw `permission-denied`.
- `sales_manager`, `tenant_admin`, `platform_admin` keep free choice of branch, as today.
- Tests: BM own branch → allowed; BM other branch → `permission-denied` for both CFs; SM any branch → allowed.

## 2. BUG-08 — Leaderboard points: lost updates and resubmit double-count
File: `functions/index.js`, the submission trigger that reads `tenants/{t}/leaderboard/{agentId}`, adds `points`, and writes back (`lbRef.get()` → `prevPoints + points` → `lbRef.set`).
- Do the read and write inside one `runTransaction`.
- Store the points last awarded for each submission (for example `leaderboard/{agentId}.awardedBySubmission.{submissionId}`, or a subcollection — your choice, state which in the PR). A resubmit applies only the **difference** from the last award for that submission. A resubmit with the same points adds 0.
- Keep level/`resolveLevel` behaviour the same, computed from the new total.
- Tests: (a) two different submissions processed together → both counted; (b) submit → revert to draft → resubmit with same points → total unchanged; (c) resubmit with higher points → only the difference added.

## 3. BUG-09 — Sunday cron can overwrite a just-submitted report
File: `functions/aggregators/sundayDailyToWeekly.js` (`draftRef.get()` → skip if submitted → later `set`).
- Move the status check and the write into one `runTransaction`. If the doc is `submitted` inside the transaction, skip it.
- Test: a report that becomes `submitted` between the read and the write is not overwritten.

## 4. SEC-16 — `functions/` dependency vulnerabilities
Measured 26 Sep 2026 in `functions/`: `npm audit --omit=dev` → **16 vulnerabilities (1 low, 9 moderate, 5 high, 1 critical)** (critical `websocket-driver`; high `@grpc/grpc-js`, `brace-expansion`, `fast-xml-builder`, `form-data`, `protobufjs`).
- Run `npm audit fix` (**no** `--force`) in `functions/`. If `firebase-admin` 12 → 13 clears the Google-library items, do it, and check its breaking changes against our usage. Record the before/after `npm audit --omit=dev` summary lines in the PR.
- Do **not** force the `uuid` → `exceljs@3.4.0` downgrade. List anything left and why in the PR body under "Remaining".
- CI: add a step to `.github/workflows/ci.yml` that runs `npm audit --omit=dev --audit-level=high` for root and `functions/`. If items remain at high/critical that cannot be fixed without `--force`, make the step `continue-on-error: true` for `functions/` only, and say so in the PR.

## Out of scope
Rules changes, branch scoping of users/policies/financing (SEC-05, SEC-08 — that is P2b), kiosk (SEC-04), App Check.

## Deliverables
1. One PR with the four fixes and their tests.
2. `npm test` (root), functions tests, and lint all pass. Paste the counts.
3. Before/after `npm audit --omit=dev` summary lines for `functions/`, pasted in the PR.
4. PR body ends with the deploy command for Kyron, exactly:
   `firebase deploy --only functions --project agencytrack-2a610`
   Name which functions changed. Warn if the deploy would delete or rename any function.
5. Post-deploy smoke walk for Kyron (written in the PR body, run by Kyron after deploy, read-only apart from normal use):
   1. As a branch manager, open Agent of the Month for your branch → candidates load.
   2. Firebase Console → Functions → Logs: no new errors from the changed functions in the first hour.
   3. Monday: open the leaderboard → last week's points look right; no agent shows double points.
