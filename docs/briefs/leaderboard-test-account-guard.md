# Brief: Leaderboard Test-Account Exclusion Guard (closes FU #2)

**Type:** Cloud Function change + maintenance script + tests · **Merge:** human (gated; no auto-merge) · **Deploy:** functions, now (pilot-blocking)

## Problem
Pilot users see a test account ("Kelsean Agent") on the tenant-wide leaderboard. CC's live trace established why:
- The UI (`src/components/gamification/Leaderboard.jsx`) queries `tenants/{tenantId}/leaderboard` live, `orderBy('points','desc')`.
- Those user-scoped docs are written by `onSubmissionWrite` (onWrite on `tenants/{tenantId}/submissions/{subId}`), which does an unconditional `.set({...},{merge:true})` to `leaderboard/{agentId}`. Its only guard is `if (!agentId) return`.
- No test-account filter exists anywhere — confirmed: `isTestAccount` / `excludeFromLeaderboard` have **zero** matches in `src/` and `functions/`.
- Therefore manual deletes of `leaderboard/{uid}` are **not durable**: the next submission write for that agent recreates the doc. The smoke agent (`kelsean@gmail.com`) writes submissions by design, so it keeps reappearing.

## Goal
Test accounts never appear on the tenant-wide leaderboard, durably and smoke-safely. Close FU #2 at the source.

## Approach (approved — option b: write-layer guard)
1. Flag the 5 preserved test accounts `isTestAccount: true`.
2. In `onSubmissionWrite`: when the agent is flagged, skip the leaderboard `.set()` **and** delete any existing `leaderboard/{agentId}` doc (self-healing). Absent/false → behavior unchanged.
3. One-time cleanup of the current test entries (durable once the guard is live).
4. Functions deploy + a post-deploy write-read-verify smoke.

## Verified facts / integration points
- `isTestAccount` is a **new** field (0 prior matches). Treat absent as `false`.
- The committed `repomix-output.xml` is **stale** (it shows `onSubmissionWrite` at 725–878 and lacks `recomputeLeaderboardScheduled`). **Do not trust any cached line numbers** — Phase 1 reconfirms against live code.
- From CC's live trace (Phase 1 reconfirms exact current lines):
  - Write trigger: `functions/index.js` → `onSubmissionWrite`; leaderboard `.set` ~L1383–1396; `agentId` guard ~L1280–1281.
  - Display: `src/components/gamification/Leaderboard.jsx`, the `tenants/{tenantId}/leaderboard` query.
  - Separate, **unused-by-UI** cron: `recomputeLeaderboardScheduled` → `tenants/{tid}/leaderboards/{branchId}` (different collection). **Out of scope — do not touch.**

## Prerequisites (verify on main before building)
- `origin/main` clean at the post-#548 fill commit (`dc823bb`).
- `functions/service-account-key.json` present (operator regenerated it) — needed for the flag script run, post-merge.

---

## Phase 1 — Recon (HARD STOP; report, then wait)
Confirm against **live** code, not repomix:
1. Current line numbers + the exact code block for `onSubmissionWrite`'s leaderboard `.set()` and the `agentId` guard.
2. Whether the CF already reads the agent's **user doc** (for `agentName`/`level`/etc.). If yes → the `isTestAccount` check piggybacks on that read (no extra read). If no → identify exactly where to add a single user-doc read.
3. The exact leaderboard doc path + id (expected user-scoped: `tenants/{tid}/leaderboard/{agentId}`).
4. Resolve and confirm the **5 test-account UIDs** by email, cross-checked against the preserved-accounts list:
   - `kelsean@gmail.com`, `kyronmarchan@gmail.com`, `testagent@tatillife.com`, `branch.manager@tatillife.com`, `unit.manager@tatillife.com`
   - **HARD EXCLUDE from flagging:** `kyronmarchan+tenant@gmail.com` (real tenant admin) and every real pilot `@tatil.co.tt` account.
**STOP and report. Operator approves the resolved 5 before any flagging.**

## Phase 2 — CF guard (`onSubmissionWrite`)
- Before the leaderboard `.set()`: obtain the agent's `isTestAccount` (piggyback on the existing user-doc read if present; otherwise one read).
- If `isTestAccount === true`: **skip** the `.set()` **and** delete `tenants/{tid}/leaderboard/{agentId}` if it exists (self-heal). Return from the leaderboard path.
- If absent/false: **unchanged** behavior.
- Keep the diff minimal and localized. Do not alter the branch-scoped cron, the `leaderboards/{branchId}` collection, or the display component.

## Phase 3 — Flag/cleanup script + tests
- `scripts/maintenance/flag-test-accounts.mjs` (reuse the `set-producing-manager.mjs` pattern):
  - Args: `--tenant`, `--emails "a@,b@,..."`, `--apply` (omitted = dry-run).
  - Phase-1 dry-run: list the resolved users with name/email/uid/role/`isTestAccount`.
  - Apply: resolve each email → uid → assert the user doc **exists** (hard-error + skip if not) → assert email ≠ `kyronmarchan+tenant@gmail.com` (reject) → `set({isTestAccount:true},{merge:true})`. Idempotent; print before→after; read-back.
  - One-time cleanup (also gated by `--apply`): for each flagged uid, delete `tenants/{tid}/leaderboard/{uid}` if present; print the deletion list.
- Functions/emulator test for `onSubmissionWrite` (uses fake uids — no prod data):
  - flagged uid submission → **no** `leaderboard` doc written, and a pre-existing one is deleted;
  - non-flagged uid submission → `leaderboard` doc written (existing behavior preserved).
- Existing `functions-tests` must stay green.

## Phase 4 — Docs (commit with placeholders)
- `docs/FOLLOW_UPS.md`: FU #2 → **RESOLVED** (write-layer `isTestAccount` guard); PR/SHA placeholders.
- `CONTEXT.md` (Rule 16 fields): Current main HEAD, Active track, where-we-left-off, Last updated — SHA placeholders.
- Record the convention durably (e.g., `CLAUDE.md` or a docs note): *"`isTestAccount: true` on a user doc excludes it from the tenant-wide leaderboard, enforced in `onSubmissionWrite`."*

## Phase 5 — Commit / push / PR
- Branch, commit (CF + script + tests + docs), push, open PR.
- Report the feature-branch HEAD SHA (Rule 20).
- Poll for and disposition every Gemini bot comment (Rule 21).
- **Do not auto-merge** (gated change) — human squash-merge.

---

## Post-merge (operator + CC), in this order
1. Human squash-merge the PR.
2. **Deploy the CF guard:** `firebase deploy --only functions`. (Guard is inert until accounts are flagged — safe to deploy first.)
3. **Run the flag script:** dry-run → operator reviews the resolved 5 → `--apply` (sets `isTestAccount` **and** clears existing leaderboard entries). Flagging activates the guard; the cleanup is now durable.
4. **Post-deploy production smoke** (CF-dependent → always post-deploy, never pre-merge): log in as `kelsean@gmail.com` (now flagged) → write a submission → reload → assert **no** `leaderboard/{uid}` entry appears. The smoke deletes its own submission write afterward. (Non-flagged "doc is written" behavior is covered by the emulator test — do **not** write test submissions as a real pilot agent.)
5. Verify `git log origin/main` (Rule 15), then `/post-merge` (graphify + CONTEXT fill).

## Guardrails / non-goals
- Do not touch `recomputeLeaderboardScheduled` or the `leaderboards/{branchId}` collection.
- `isTestAccount` absent/false must preserve exact current behavior.
- The flag script must hard-reject `kyronmarchan+tenant@gmail.com`.
- Not in scope (banked separately): moving smokes off the live pilot tenant / a dedicated test tenant; the producing-manager `personalApi` aggregation wire.
