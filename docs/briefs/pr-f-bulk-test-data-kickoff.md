# PR-F — Bulk Test Data Tooling & Cleanup Sweep

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 4–6 hours, single PR.
**Two-strike counter:** Project carry-in **2/2 — AT CEILING**.
**Strike rule override (PR-F-specific):** STOP and surface on first unexpected behaviour. Do NOT invoke the usual 2-strike loop. Any deviation from locked decisions, any failing test, any unexpected file shape, any guard violation = surface immediately in chat and wait for direction.
**Main HEAD at brief drafting:** `5ca6ea6` — `feat(email): PR-D — server-side email infrastructure (HIGH#5) (#133)`.

---

## Context

AgencyTrack has shipped through 15+ PRs in the May 5–13 2026 window (A11Y arc PR1–7, Track A, Track C C1/C2/C3, Track D server-side email PR-D, PR-4/4b user edits, FU#3 channel-split, POLISH-2). Kyron needs to exercise the system end-to-end before the Tatil pilot roster arrives. The existing single-user creation flow is fine for spot tests but cannot quickly provision a representative role hierarchy (BM + UMs + agents with realistic submission / persistency / campaign data) for full-system shake-down.

PR-F adds the tooling to seed that hierarchy in minutes, exercise it, and wipe it cleanly before the real roster lands. Three pieces:

1. **CSV generators** that produce valid CSVs for the existing C2 (BulkImportUsersModal) and C3 (BulkImportGoalsModal) importers. No new in-app UI.
2. **Direct Admin SDK seeders** for submissions, persistency, and a throwaway "Test Campaign Q2" — collections with no CSV import path.
3. **Cleanup sweep scripts** (preview + wipe) that cascade-delete all seeded test data with strict safety controls.

All seeded data is marked twice: by email pattern (`*@agencytrack.test`) for Auth-side filtering, and by `testDataBatchId` UUID v4 stamped on every Firestore doc for defensive verification before deletion.

---

## Decisions locked (do not re-litigate)

### Test-data marker strategy

- **Email pattern:** every test user's email matches `*@agencytrack.test`.
- **Firestore field:** every seeded doc carries `testDataBatchId: <UUID v4>` — single batch ID per seeding session, shared across all docs in that session.
- **Cleanup matches both:** email pattern is the canonical filter (Auth has no field-level filter); `testDataBatchId` is the defensive second check before delete on Firestore docs.
- **Production code must continue to ignore both fields.** `testDataBatchId` is an additive optional field, no-op if absent. No production write path sets it. (`userImportService` and `goalsImportService` already pass through `csvImportBatchId` for real CSV imports — `testDataBatchId` is a parallel field introduced here for non-CSV-imported docs and for distinguishing test vs real CSV imports.)

### Test agent roster (10 users)

- 1 Branch Manager: `bm-001@agencytrack.test`
- 2 Unit Managers: `um-001@agencytrack.test`, `um-002@agencytrack.test`
- 7 Agents: `agent-001@agencytrack.test` through `agent-007@agencytrack.test`
- Agents distributed across the two UMs (4 + 3 or 3 + 4 — CC's call, document in discovery)
- All users belong to tenant `tatillife_south`, branch confirmed in Phase 1 from `/tenants/tatillife_south/meta/branches`
- Roles match existing schema: `branch_manager`, `unit_manager`, `agent` (no `tenant_admin`, no `platform_admin` — those are infrastructure tiers, not test scope)

### Data shape per agent

- **Submissions:** 4 weeks per agent (the four most-recent Sundays as of seed run) → 28 docs total
- **Persistency:** 3 months per agent (Jan / Feb / Mar 2026), entered by the test BM → 21 docs total
- **Goals:** 2026 personal commitment for each agent via CSV through BulkImportGoalsModal
- **Campaign:** single throwaway "Test Campaign Q2" doc with all 7 test agents enrolled (full-doc delete at cleanup — no participant-array surgery needed)

### Cleanup mechanics

- Two scripts: `preview-test-data-sweep.mjs` (dry-run only) and `wipe-test-data-sweep.mjs` (execution).
- Two modes per script: `--mode=batch` (by `testDataBatchId`, requires explicit ID arg) and `--mode=email-pattern` (sweeps all `*@agencytrack.test`).
- **Cascade order on wipe:**
  1. Revoke Auth refresh tokens (locks out any active sessions, does not delete yet).
  2. Firestore leaves-first deletion:
     submissions → persistency → daily entries → goals → notifications → settlements → leaderboard → campaign doc → user doc.
  3. `auditAdminCreations` rows (top-level collection) where `createdUid` matches.
  4. Auth users deleted last (Firestore wipe is retry-safe if Auth deletion fails mid-flight).

### Safety controls on wipe script

1. **Dry-run is implicit default.** No flag → preview-mode output, no deletion.
2. **`--execute` flag required to delete.** Prints the seeded count + an ISO timestamp.
3. **Typed confirmation required.** Operator must type `DELETE <N> USERS AT <ISO>` verbatim within 60 seconds — anti-paste-from-history.
4. **Email-pattern hard guard.** If ANY candidate user's email does not match `*@agencytrack.test`, abort with the offending email logged. No partial proceeds.
5. **Tenant allow-list env var.** `CLEANUP_ALLOWED_TENANTS` must be set and must include the target tenant ID. If unset or doesn't include target → abort.
6. **Full audit log.** Every doc path deleted, every UID deleted, written to `verification/cleanup-<timestamp>.log` (verification/ is gitignored — convention).

### Script paths and conventions

- All seeders live under `scripts/seed/` (singular — matches existing `scripts/seed/synthetic-weekly-reports.mjs`).
- All cleanup scripts under `scripts/cleanup/` (new directory).
- Verification smoke under `scripts/verification/pr-f-bulk-test-data-smoke.mjs`, reusing `scripts/verification/lib/walk-helpers.mjs` where applicable.
- Admin SDK require path: `require('../../functions/node_modules/firebase-admin')` from a 2-deep subfolder, or `require('../functions/node_modules/firebase-admin')` from `scripts/seed/` at 1-deep. NEVER add `firebase-admin` to repo-root `package.json` (banked from C2 close).
- All scripts use `.mjs` extension (ESM — matches existing seed/migrations/verification convention).
- Documentation at `docs/runbooks/test-data-lifecycle.md`.
- Verification artifacts (logs, screenshots) live under `verification/` — gitignored by design.

### Currency, tenancy, branch

- TTD only.
- Tenant: `tatillife_south` (single-tenant scope for PR-F).
- Branch: confirmed in Phase 1 discovery against `/tenants/tatillife_south/meta/branches`.

### What is preserved (NOT touched by cleanup)

- Existing test agent `kelsean@gmail.com` (UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`) — email pattern naturally excludes.
- Production super admin `kyron@tatillife.com` (UID `4GeeZbhZBwdtGOLoJoggf4MQo142`) — email pattern naturally excludes.
- Any real user with email not matching `*@agencytrack.test` — guard hard-aborts before any delete.

---

## Scope

Ships in this single PR:

- 2 CSV generators (users, goals)
- 3 Admin SDK seeders (submissions, persistency, campaign)
- 1 shared roster module
- 2 cleanup scripts (preview, wipe)
- 1 verification smoke script
- 1 runbook
- 1 discovery notes doc
- `docs/CONTEXT.md` "Recently shipped" row append (NOT a full refresh — staleness flagged as a separate follow-up)
- `docs/FOLLOW_UPS.md` new MEDIUM entry for CONTEXT.md refresh

---

## File inventory

**New files:**

| Path | Purpose |
|---|---|
| `scripts/seed/test-roster.mjs` | Single source of truth for the 10 test users — shared by all seeders + cleanup |
| `scripts/seed/generate-users-csv.mjs` | Emits CSV for BulkImportUsersModal |
| `scripts/seed/generate-goals-csv.mjs` | Emits CSV for BulkImportGoalsModal |
| `scripts/seed/seed-test-submissions.mjs` | Submissions seeder (wraps or extends `synthetic-weekly-reports.mjs` — Phase 1 decides) |
| `scripts/seed/seed-test-persistency.mjs` | Persistency seeder — 3 months × 7 agents, entered by test BM |
| `scripts/seed/seed-test-campaign.mjs` | Throwaway "Test Campaign Q2" + enrolment of 7 test agents |
| `scripts/cleanup/preview-test-data-sweep.mjs` | Dry-run cleanup enumeration |
| `scripts/cleanup/wipe-test-data-sweep.mjs` | Execution cleanup with all safety controls |
| `scripts/verification/pr-f-bulk-test-data-smoke.mjs` | End-to-end smoke — validates generators, seeders, preview, and a full wipe cycle |
| `docs/runbooks/test-data-lifecycle.md` | Seed → test → wipe → pilot handover runbook |
| `docs/pr-f-discovery-notes.md` | Phase 1 deliverable — wrap-vs-extend decision + doc shape confirmations |

**Files touched:**

| Path | Change |
|---|---|
| `docs/CONTEXT.md` | Append PR-F to "Recently shipped" table; drop oldest. No other edits. |
| `docs/FOLLOW_UPS.md` | Add MEDIUM entry: "CONTEXT.md broader refresh — stale by ~30 PRs as of 2026-05-13" |
| `scripts/seed/synthetic-weekly-reports.mjs` | **Possibly** — only if Phase 1 wrap-vs-extend decision lands on extend. If extend, only an additive optional `testDataBatchId` parameter, no behavioural changes to existing call sites. If wrap, file is untouched. |

---

## Phases

### Phase 1 — Discovery (gates Phase 2; the strike-avoidance phase)

**Output:** `docs/pr-f-discovery-notes.md` with these sections:

1. **`synthetic-weekly-reports.mjs` inventory**
   - Top-of-file docstring
   - argv handling and accepted parameters
   - Doc shape it writes (collection path, field set, `tenantId` handling)
   - **Decision: wrap or extend.** Default to wrap unless the script lacks a way to scope writes to a specific UID list. If extend, the only modification permitted is adding an optional `testDataBatchId` parameter — no other behavioural changes.
   - Rationale documented in 3–5 sentences.

2. **Doc shape confirmation** for each collection PR-F writes to (sample one real doc via Admin SDK; anonymise PII in notes):
   - `/tenants/{tid}/users/{uid}`
   - `/tenants/{tid}/submissions/{id}`
   - `/tenants/{tid}/persistency/{agentId}_YYYY_MM`
   - `/tenants/{tid}/goals/{goalId}`
   - `/tenants/{tid}/campaigns/{campaignId}`
   - `/tenants/{tid}/notifications/{id}`
   - `/tenants/{tid}/settlements/{id}`
   - `/tenants/{tid}/leaderboard/{uid}`
   - Daily entries path (confirm exact collection path — possibly per-agent subcollection)
   - `/auditAdminCreations/{id}` (top-level)

3. **Tenant + branch confirmation**
   - Tenant ID: `tatillife_south`
   - Branch ID: read from `/tenants/tatillife_south/meta/branches`. Document the canonical pilot branch ID.

4. **`bulkImportUsers` Callable input schema**
   - Required fields per row (from `functions/index.js`)
   - Optional fields including `csvImportBatchId`, `testDataBatchId`, `importedFromCsv` — confirm `testDataBatchId` will be accepted by the Callable or whether it needs to be added (additive change permitted per C2 close: existing callers fall through unchanged)

5. **Existing field on goals/users**
   - Confirm `setGoals()` passthrough fields include `testDataBatchId` or only `csvImportBatchId`. If only `csvImportBatchId`, document whether PR-F adds `testDataBatchId` to the passthrough list (additive, low risk).

**Gate:** Phase 1 complete ONLY when:
- `docs/pr-f-discovery-notes.md` is committed
- Wrap-vs-extend decision is surfaced to Kyron in chat
- Kyron acknowledges the decision

CC surfaces, waits. No Phase 2 work until acknowledgement.

### Phase 2 — CSV generators

- `generate-users-csv.mjs` produces CSV with header row matching `buildTemplateCSV()` output from `userImportService.js`; body rows are the 10 test users from `test-roster.mjs`.
- `generate-goals-csv.mjs` produces CSV matching `buildTemplateCSV()` output from `goalsImportService.js`; body rows are personal commitments for the 7 test agents.
- Both scripts:
  - Import roster from `scripts/seed/test-roster.mjs` (single source of truth)
  - Accept `--out <path>` for the output file (default: `verification/`)
  - Accept `--batch-id <uuid>` for the `testDataBatchId` to stamp (default: generate fresh UUID v4 via `crypto.randomUUID()`)
  - Print the batch ID to stdout so the operator can capture it for the seeder runs

**Gate:** generated CSVs parse cleanly through the respective `parseCSV()` service function (validated programmatically in the smoke script, Phase 5).

### Phase 3 — Direct Admin SDK seeders

All three seeders:
- Take `--batch-id <uuid>` (required — operator passes the same ID used for CSVs so the entire test session shares one ID)
- Take `--dry-run` flag for preview mode
- Stamp `testDataBatchId` on every doc
- Log every doc path written to stdout + `verification/seed-<timestamp>.log`
- Import roster from `scripts/seed/test-roster.mjs`

Specific:
- `seed-test-submissions.mjs`: 4 weeks × 7 agents = 28 submission docs. Realistic-ish values (varied dials, FFIs, CIs, API) — no need for statistical realism, just non-zero data the dashboard can render.
- `seed-test-persistency.mjs`: 3 months × 7 agents = 21 persistency docs. `enteredBy` = test BM's UID, `enteredAt` = server timestamp.
- `seed-test-campaign.mjs`: 1 campaign doc, status active, all 7 test agents in participants, realistic targets, end date ~30 days out.

**Gate:** each seeder runs cleanly; doc counts match expectation; every doc carries `testDataBatchId`. Verified by direct Firestore inspection or by Phase 5's smoke.

### Phase 4 — Cleanup scripts

- `preview-test-data-sweep.mjs`:
  - Modes: `--mode=batch --batch-id <uuid>` or `--mode=email-pattern`
  - Enumerates every doc path + Auth UID that would be deleted
  - Outputs to stdout + `verification/cleanup-preview-<timestamp>.log`
  - Never deletes — even if called with destructive flags

- `wipe-test-data-sweep.mjs`:
  - All safety controls per "Decisions locked" section above
  - Cascade order per "Decisions locked" section above
  - Outputs full audit log to `verification/cleanup-<timestamp>.log`
  - Returns non-zero exit code on any guard violation (for smoke script assertions)

**Gate:** preview against seeded data correctly enumerates exactly the seeded count. Wipe (run once with a known batch in the smoke) reduces seeded count to 0; second preview returns empty.

### Phase 5 — Verification smoke script

`scripts/verification/pr-f-bulk-test-data-smoke.mjs` executes:

1. Generate CSVs → parse through `userImportService.parseCSV()` and `goalsImportService.parseCSV()` → confirm valid + row count = roster size.
2. Seed users via Admin SDK directly (bypasses the manual modal step in the runbook — the smoke can't drive the modal). Reuses the user provisioning logic from `bulkImportUsers` but calls Admin SDK directly.
3. Seed goals, submissions, persistency, campaign via the Phase 3 scripts.
4. Preview cleanup → assert enumerated count matches seeded count.
5. Assert all guards work:
   - Run wipe with `CLEANUP_ALLOWED_TENANTS` unset → assert non-zero exit + abort message
   - Run wipe with a faked candidate matching `*@notagencytrack.test` → assert non-zero exit + offending email logged
   - Run wipe without typed confirmation → assert non-zero exit
6. Wipe with all controls satisfied → assert all docs gone, all Auth users gone.
7. Second preview → assert empty.

Smoke targets production tenant `tatillife_south` against the real Firebase project (NOT emulator). Reuses `scripts/verification/lib/walk-helpers.mjs` where applicable.

**Gate:** all assertions pass. Smoke output captured to `verification/pr-f-smoke-<timestamp>.log`.

### Phase 6 — Documentation

`docs/runbooks/test-data-lifecycle.md` covering:

- Pre-flight: env vars required (`CLEANUP_ALLOWED_TENANTS`, Admin SDK credentials), tenant allow-list setup
- Step 1: generate CSVs (capture batch ID printed to stdout)
- Step 2: import users via UserManagementPanel "Bulk import users" modal — manual, opens in browser
- Step 3: import goals via UserManagementPanel "Bulk import 2026 personal commitments" modal — manual
- Step 4: run direct seeders (submissions, persistency, campaign) with the captured batch ID
- Step 5: exercise the app end-to-end — log in as test agents, test BM, test UMs; verify dashboards, awards, campaigns, persistency display, gap analysis
- Step 6: preview cleanup → review log
- Step 7: wipe cleanup → confirm zero docs/users remain
- Step 8: pilot handover — real Tatil roster import begins

### Phase 7 — CONTEXT.md update + follow-ups

- Append PR-F row to `docs/CONTEXT.md` "Recently shipped" table. Drop the oldest entry. Use the squash SHA captured post-merge — placeholder in the diff if PR-F isn't merged yet; Kyron fills in on merge.
- Add new MEDIUM entry to `docs/FOLLOW_UPS.md`:

  > **CONTEXT.md broader refresh** — stale by ~30 PRs as of 2026-05-13. Last updated `2026-05-10` with `Current main HEAD: ed99ece` (PR #75 E5.1); actual current main HEAD is `5ca6ea6` (PR #133 PR-D). Active track, two-strike counter, hierarchy section, and "Where we left off" all out of date. Triage separately.

### Phase 8 — Lint, build, commit, push, PR

- `npm run lint` → 0 errors. Multiple commits OK (conventional commit style, one per phase or per logical chunk).
- `npm run build` → success.
- Push, open PR.
- **PR title:** `feat(tooling): PR-F — bulk test data seeders + cleanup sweep`
- **PR description must include:**
  - Summary
  - List of files added (file inventory)
  - Phase 1 wrap-vs-extend decision + rationale link to `docs/pr-f-discovery-notes.md`
  - Smoke script pass result (count of docs seeded, count cleaned, guards verified)
  - Verification matrix (commands + outputs)
  - Confirmation that `synthetic-weekly-reports.mjs` was either untouched (wrap) or modified additively only (extend) — with diff link if modified

### Phase 9 — STOP

DO NOT MERGE. Kyron reviews and merges manually after independent smoke test.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state.
- Existing test suite starts failing → STOP and surface (no test changes expected for CLI scripts — failure means regression).
- Phase 1 wrap-vs-extend decision can't be cleanly determined from the existing script → STOP and surface.
- Any doc shape from discovery differs materially from this brief's assumptions → STOP and surface, do not silently adjust the brief.
- Cleanup script guard violations during smoke (email pattern mismatch, tenant not allowed) — these MUST fail by design and the smoke MUST assert they do; if they don't fail correctly, STOP.
- **First unexpected behaviour of any kind** — given 2/2 strike ceiling, surface immediately. Examples: an existing script silently fails, a doc collection has an unexpected sub-collection, an env var isn't read correctly, the Admin SDK require path resolves to a different version than expected.
- Vercel / production state change mid-session (someone else merging to main) → STOP and reload context.
- ANY attempt to delete a user whose email doesn't match `*@agencytrack.test` → guard MUST abort; if it doesn't, STOP immediately.

---

## NOT in scope

- In-app test data generator UI (deferred indefinitely — CLI is sufficient for one-time pre-pilot testing).
- Test data lifecycle UI for tenant admins (deferred indefinitely).
- Modifying the C2 (BulkImportUsersModal) or C3 (BulkImportGoalsModal) modals — they already work; PR-F only feeds them CSVs.
- Modifying `bulkImportUsers` Callable behaviour for production callers — additive `testDataBatchId` passthrough only, no behavioural changes to existing fields.
- Modifying `setGoals()` behaviour for production callers — additive `testDataBatchId` passthrough only.
- Multi-tenant cleanup — single-tenant scope (`tatillife_south`) only.
- CONTEXT.md full refresh — separate ticket, MEDIUM follow-up.
- Real Tatil agent provisioning workflow — that's the runbook handover point, not part of this PR.
- Push notifications, scheduled cron, or any background workers triggered by seeded data.
- Persistency aggregation correctness tests against real Tatil data — that was E3's scope.
- Statistical realism in seeded values — non-zero plausible numbers are sufficient.

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test` | 100% pass, no new failures |
| Build succeeds | `npm run build` | success, no warnings |
| Smoke pass | `node scripts/verification/pr-f-bulk-test-data-smoke.mjs` | All assertions pass; seeded count = cleaned count |
| Discovery doc exists | `Test-Path docs\pr-f-discovery-notes.md` | True, contains wrap-vs-extend decision |
| Runbook exists | `Test-Path docs\runbooks\test-data-lifecycle.md` | True |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | "Recently shipped" row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | MEDIUM entry for CONTEXT.md refresh added |
| Email-pattern guard works | (smoke output) | Cleanup with `*@otherdomain.test` aborts with offending email logged |
| Tenant allow-list guard works | (smoke output) | Cleanup with unset `CLEANUP_ALLOWED_TENANTS` aborts |
| Typed-confirmation works | (smoke output) | Cleanup without typed phrase aborts |
| `synthetic-weekly-reports.mjs` unchanged (if wrap) | `git diff scripts/seed/synthetic-weekly-reports.mjs` | empty diff |
| `synthetic-weekly-reports.mjs` additive only (if extend) | `git diff scripts/seed/synthetic-weekly-reports.mjs` | one new optional parameter, no behavioural changes to existing call sites |

---

## CC kickoff prompt (one-liner)

> Execute PR-F — Bulk Test Data Tooling per the brief in `docs/briefs/pr-f-bulk-test-data-kickoff.md`. Two-strike counter at project ceiling (**2/2 carry-in**) — STOP and surface on first unexpected behaviour. Do NOT invoke the usual 2-strike loop. Read the brief in full, then begin Phase 1 (Discovery). Surface the wrap-vs-extend decision before any Phase 2 work. Do NOT merge — open PR and stop.
