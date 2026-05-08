# AgencyTrack Session Kickoff — Track C PR C2 (Bulk User Provisioning via CSV Import)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR C2. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> **C2 is the second PR of Track C.** C1 (PR #60) shipped branches as a real Firestore subcollection, the tenant-admin BranchesPanel + BranchEditorModal, and the rules block. C2 unblocks immediately on top: bulk user import via CSV, referencing the branchIds C1 created. Smaller per-line surface than C1 in the rules layer, but introduces a new Cloud Function (`bulkImportUsers`) and a multi-step modal — so write-path discipline still matters per line.
>
> When C2 ships, C3 (2026 personal annual API goals seeding) unblocks. Track C closes after C3.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Track C PR C2 (Bulk User Provisioning via CSV Import)

## Step 0 — Read these in order, do not skip

1. `CLAUDE.md` — static project rules. Pay special attention to: post-merge protocol (steps 9 and 9.5); the `git branch -D` rule; the docs-only-PR untracked-doc collision pattern; the single-branch PR rule; and the (banked from C1 close) `.env.local` use-vs-echo clarification + additive-rules-deploy timing rule.
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. CONTEXT.md overrides CLAUDE.md where they differ — it's newer.
3. `docs/track-c-implementation.md` § PR C2 — canonical scope hypotheses for this PR. Read fully. Treat the file listing as starting hypotheses, not directives. If anything in § PR C2 contradicts this kickoff brief's Decisions-locked section, the kickoff brief wins; cascade-correct § PR C2 in a separate docs commit.
4. `docs/track-c-C1-kickoff.md` — for the patterns and discipline gates that apply (modal scaffolding, write-path discipline, audit-trail conventions). C2 follows the precedent set in C1.
5. `firestore.rules` — current state. Specifically read existing `match /users/{userId}` rules (B5 + post-PR-2 user-mgmt patterns) and the `match /branches/{branchId}` block (C1-shipped, mirror pattern for any new rules).
6. `functions/index.js` — current single-user `createUser` Cloud Function (post HIGH#1 PR #57 — single-user creation now sends a password reset email). Identify the function name, signature, error model. C2's `bulkImportUsers` Callable must reuse this path so imported users get the same reset-email behavior.
7. `src/services/userService.js` and `src/services/agentManagementService.js` — existing client-side helpers. C2 reuses `getAllUsers()` for the duplicate-email check and `getBranchManagers()` if needed for any role-specific UI.
8. `src/services/branchService.js` — C1-shipped. C2 calls `listBranches()` for branch name → auto-ID resolution. Confirm shape and `isActive` filtering (the helper does NOT filter by isActive; the caller applies the filter).
9. `src/components/manager/UserManagementPanel.jsx` — existing tenant_admin user list (lives under `manager/`, not `admin/`). C2 adds a "Bulk Import" CTA in its header.
10. `package.json` — verify Papaparse version. Find existing Papaparse usage in the codebase (search `papaparse` or `Papa.parse`). Reuse the canonical pattern. (Audit pre-locked: Papaparse 5.5.3 is installed but never imported — C2 establishes the pattern.)
11. C-series retrospectives + the latest entries in `docs/CONTEXT.md` § Where we left off. Lessons from C1 apply directly:
    - Speculative file listings are starting hypotheses, not directives.
    - Mock-vs-code surface-gap audit before any code.
    - Honest data-availability check.
    - Reusability assumptions break: surface, don't absorb.
    - `.env.local` use-vs-echo: programmatic read OK, transcript echo banned.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match `docs/CONTEXT.md` § Current main HEAD with at most one PR of drift (C1, expected). If either fails: STOP, surface in chat, do not absorb.

## Session scope

**In scope (PR C2 only):**

- `functions/index.js` — MODIFY. Add `bulkImportUsers` Callable Function with `runWith({ timeoutSeconds: 540 })`. Wraps the existing single-user `doCreateUser` saga in a row-by-row loop with per-row error capture. Single pre-flight Firestore read of `tenants/{tid}/branches` for branchId Set validation (defense-in-depth). Reuses single-user createUser's password-reset-email path (HIGH#1) so each successfully-imported user gets a reset email — dispatched client-side from `userImportService.js` after the Callable returns. Returns per-row success/failure summary.
- `functions/index.js` — also MODIFY `doCreateUser` to honor optional `data.branchId` (only when caller has `ownedBranchIds === ['*']`), `data.csvImportBatchId`, `data.importedFromCsv`. Extend `buildDocFields` for `phone`, `bio`, `careerLevel`, `csvImportBatchId`, `importedFromCsv`. Single-user flow never sets these fields, so its behavior is unchanged.
- `src/services/userImportService.js` — NEW. CSV parse (Papaparse), per-row validation (format checks, branch-name lookup, email-format, role validity, duplicate-email), batch invocation of the `bulkImportUsers` Callable, post-success client-side `sendPasswordResetEmail` dispatch per row, error CSV generation via `Papa.unparse`. Pure service layer.
- `src/components/admin/BulkImportUsersModal.jsx` — NEW. Multi-step wizard within a single modal shell: file picker → preview table → progress → summary. Lives under `admin/` (consistent with C1's tenant_admin+ surfaces); cross-folder import from `manager/UserManagementPanel.jsx` is fine.
- `src/components/manager/UserManagementPanel.jsx` — MODIFY. Add "Bulk Import" CTA in the panel header gated on `role in ['tenant_admin', 'platform_admin']`. Replace inline `EMAIL_RE` with import from `src/utils/validators.js`.
- `src/utils/validators.js` — MODIFY (additive). Add `EMAIL_RE` and `isValidEmail` exports. The file already contains date helpers (`validateSundayDate`, `getRecentSundays`, `formatDateLabel`) — additive, no conflict.
- `functions/utils/validators.js` — NEW. Tiny module exporting the same `EMAIL_RE` regex. Both copies (client + Cloud Function) carry a header comment: `// MUST stay in sync with the matching file at src/utils/validators.js`.
- `src/hooks/useFocusTrap.js` — NEW. Extracted hook honoring the SS-2 commitment from C1 audit. Used by `BulkImportUsersModal` only in C2; `EditConfigModal` and `BranchEditorModal` stay on inline duplication (a follow-up is filed for migrating them when next touched).
- CSV format spec. Required columns: `email`, `name`, `role`, `branchName`, `agentNumber`. Optional: `unitId` (agents only), `contractStartDate` (ISO YYYY-MM-DD), `phone`, `bio`, `careerLevel`. Headers case-insensitive (parser normalizes via `transformHeader`). UTF-8 with optional BOM. CRLF tolerated. `personalApiTarget` is NOT in the C2 CSV — handled by the Goals UI (P6A/P8C path), not by user creation.
- Tenant scope: all imported users land in the calling tenant_admin's tenant (from auth claims). No cross-tenant import in C2.
- Permissions. `bulkImportUsers` Callable enforces caller role in `['tenant_admin', 'platform_admin']` in the function body; tenant-scope guard reads tenantId from claims, not input. No firestore.rules changes (Admin SDK bypasses rules; Callable is the security floor).
- Audit trail per imported user: `createdBy: <caller_uid>` (already set by `doCreateUser`), `createdAt: serverTimestamp()` (already set), `importedFromCsv: true`, `csvImportBatchId: <UUID v4>` generated client-side via `crypto.randomUUID()`.
- Backwards compatibility. Existing single-user "Create User" flow in UserManagementPanel must remain unchanged. `doCreateUser` extensions are additive: new optional params honored only when present; default behavior identical to today.

**Out of scope (do not expand into):**

- Existing `user.branchId` migration to new collection's auto-IDs (separate post-pilot ticket — explicitly deferred per C1 close).
- Goals seeding (C3 scope).
- Hard delete of imported users (use existing deactivate flow).
- Update via CSV (C2 is import-only; re-importing same email = skip with warning).
- Photo upload via CSV.
- Bulk role changes for existing users.
- Bulk reactivation of deactivated users.
- CSV export of existing users (separate ticket).
- Cross-tenant import for platform_admin (Callable enforces caller's tenant only in C2).
- Importing `tenant_admin` or `platform_admin` roles via CSV (security: those must be provisioned manually).
- Phase 9 Sales Manager Target layer.
- Any chrome layout changes.
- Any new Firestore collections.
- `personalApiTarget` per-row import (handled by Goals UI).
- Migrating `EditConfigModal` / `BranchEditorModal` to the new `useFocusTrap` hook (filed as follow-up; battle-tested code, refactor risk not worth bundling into pilot-blocking ship).

## Decisions ratified during plan-phase

These were locked via Kyron's Q1–Q11 review of the C2 plan. Source of truth: the plan-approval message (2026-05-08).

### Q1 — Cloud Function timeout (a)
`runWith({ timeoutSeconds: 540 })` on `bulkImportUsers`. v1 max. Pilot won't hit the ceiling but the extension is one-line defensive coding for the worst-case ~10-minute 500-row import.

### Q2 — `branchId` widening (approved with server-side validation)
`doCreateUser` honors `data.branchId` only when `callerOwnedBranchIds === ['*']` (tenant_admin / platform_admin / sales_manager). The `bulkImportUsers` Callable performs a single pre-flight Firestore read of `tenants/{tid}/branches`, builds a Set of active branchIds, and validates each row's `branchId` against the Set before invoking `doCreateUser`. Rejection happens server-side even when client pre-validated — defense-in-depth. Single-user flow never passes `branchId`, so its behavior is unchanged.

If the tenant has zero active branches at Callable invocation, fail fast with `functions.https.HttpsError('failed-precondition', 'No active branches in tenant.')`. Q10's empty-state guard prevents this on the client; server fail-fast covers a bypassed client.

### Q3 — Optional fields (partial b)
Extend `buildDocFields` for `phone`, `bio`, `careerLevel`. **Skip `personalApiTarget`** (handled by the Goals UI per P6A/P8C path, not by user creation). Side benefit: PR-4 Edit User unblocks partially on the same fields.

### Q4 — Progress UI (a)
Indeterminate spinner with row count during Step 3 of the modal. Pilot CSV size (≈ 50–80 rows) doesn't justify chunking complexity.

### Q5 — `useFocusTrap` extraction (refined)
Extract the hook AND consume it in `BulkImportUsersModal` only. Do NOT migrate `EditConfigModal` or `BranchEditorModal` in this PR — both are battle-tested; touching them risks regression on a pilot-blocking ship. File a small follow-up: "Migrate EditConfigModal and BranchEditorModal to useFocusTrap when next touched." Honors the SS-2 abstraction commitment without bundling refactor risk into C2.

### Q6 — Email regex two-copy (approved with sync comment)
`src/utils/validators.js` exports `EMAIL_RE` + `isValidEmail` for client. `functions/utils/validators.js` exports the same regex for the Callable's defense-in-depth re-validation. Both files carry a header comment: `// MUST stay in sync with the matching file at <other path>`. Email-format spec is locked across client + server.

### Q7 — CSV template download CTA (approved)
Step 1 of the modal includes a "Download template" button that emits a CSV via `Papa.unparse` with the header row + one example row.

### Q8 — Error report download (a)
Step 4 of the modal offers a downloadable CSV: original input rows + one appended `error` column. Re-importable workflow — admin fixes errors and re-uploads.

### Q9 — `csvImportBatchId` (approved)
Full UUID v4 (36 chars) generated client-side via `crypto.randomUUID()`. Stored on each created user doc as `csvImportBatchId`. Pass through `data.csvImportBatchId` in `doCreateUser`; extend `buildDocFields` to honor it.

### Q10 — Zero active branches (a)
Block the modal at Step 1 with empty-state copy: "No active branches in this tenant. Create at least one branch first." Include a link to the Branches panel. Surfaces as the modal's empty-state, not a toast. Server fail-fast (Q2) is the defense-in-depth backstop.

### Q11 — Phone format (length-only)
Trim, ≤ 20 chars. No format regex. Trinidad-format validation can land in a follow-up if pilot reports inconsistencies.

### Additional clarifications (locked in approval message)

- **Modal location:** `src/components/admin/BulkImportUsersModal.jsx` (consistent with C1's tenant_admin+ surfaces). Cross-folder import from `manager/UserManagementPanel.jsx` is fine.
- **Duplicate-email behavior:** applies to both active and deactivated users. Same warning copy ("Email already in tenant"). Reactivation belongs to PR-4 Edit User.
- **`importedFromCsv: true`** extension to `buildDocFields` confirmed. Single-user flow never sets the flag, so its behavior is unchanged.
- **§ PR C2 cascade-correct in `docs/track-c-implementation.md`** (changes `branchId` → `branchName` plus any other locked-decision drift): separate commit per the plan.

## Locked policy (recap from CLAUDE.md / CONTEXT.md)

- All new tokens use `--color-*` prefix; update both `:root` and `.dark` blocks together
- Lucide React icons. No emojis as structural icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`)
- Both light + dark mode tested before opening PR
- Verification artifacts stay local — never commit
- All numeric fields — `parseFloat` enforced
- `serverTimestamp()` for `createdAt` / `updatedAt`
- `.env.local` use-vs-echo: programmatic read OK, transcript echo banned (banked from C1 close)

## A11y — bake in from the start

- Form labels: file picker has a `<label>` (not just placeholder text)
- Validation errors: `aria-invalid="true"` + `role="alert"` + `aria-live="polite"` for preview-table per-row errors
- Modal a11y: focus trap (via the new `useFocusTrap` hook) + Escape (with mid-flight confirmation) + return focus + `role="dialog"` + `aria-modal` + `aria-labelledby`
- Reduced-motion guards on transitions and modal animations
- Keyboard: preview table rows reachable in DOM order; filter toggles keyboard-operable; file picker invokable via keyboard
- Color contrast: error rows, warning rows, success rows — all ≥ 4.5:1 in both modes
- Heading hierarchy: modal `<h2>` → step section `<h3>`
- Step indicator at top of modal as semantic `<ol aria-current="step">`
- Progress bar (Step 3): `role="progressbar"` if determinate; `role="status"` with text-only "Importing…" if indeterminate (we ship indeterminate per Q4)
- Error report download CTA: `<a download="...">` with `href` from `URL.createObjectURL(blob)`

## Banked items landing in C2's first commits

C2's first commits bundle banked items from C1's close as separate concerns — one purpose per commit:

1. `chore(docs): bump CONTEXT.md to 1d0d9c3 + close FOLLOW_UPS § Branches Management UI` — CONTEXT.md SHA bump, recently-shipped list refreshed, Where-we-left-off note for C1 close, FOLLOW_UPS § "Branches Management UI" marked "RESOLVED in PR #60".
2. `docs(claude-md): clarify .env.local use-vs-echo + additive-rules-deploy timing` — two CLAUDE.md additions banked from C1's chrome-devtools surface-stop and pre-merge rules-deploy precedent.
3. `docs(track-c): add C2 kickoff brief` — write `docs/track-c-C2-kickoff.md`.
4. (if HIGH#6 not knocked out manually) `docs(follow-ups): add HIGH#6 YTD composite index` — entry: "TenantAdminDashboard YTD composite index — pre-existing from B5, surfaced in C1 walkthrough. Fix: open auto-generated index URL from production console error, click Create."
5. `docs(track-c): align implementation plan with C2 kickoff brief` — cascade-correct § PR C2 (CSV column header `branchId` → `branchName`, plus any locked-decision drift).

Then code commits begin.

## Write-path discipline gate (C2-specific)

C2 introduces a new Cloud Function and a multi-step UI that performs user creation. The discipline below is non-negotiable; any deviation is a surprise-stop.

### Pre-write validation (defense-in-depth)
The Callable re-validates every row even though the client pre-validates. Client validation is for UX (surface errors in preview); server validation is for security (defense against bypassed client). Both layers run.

### Optimistic UI is forbidden
Modal stays open until the Callable returns. No "user list updated" UI changes until the summary screen confirms per-row success.

### Per-row atomicity
Each row's outcome is captured atomically. A failure in row N does not affect row N+1. The summary surfaces all failures; no silent drops, no aggregate-error messages that hide per-row detail.

### Rollback is NOT supported
Successfully-imported users are not reverted on partial-failure or user-cancel mid-flight. The "Cancel import" mid-flight prompt explicitly says so. Recovery path is the existing deactivate flow.

### Audit trail per imported user
- `createdBy: <caller_uid>` (already set by `doCreateUser`)
- `createdAt: serverTimestamp()` (already set)
- `importedFromCsv: true`
- `csvImportBatchId: <UUID v4>`

## What to do first — Plan first (Option A)

> Do not write code yet. Produce a work plan in chat covering:
>
> 1. Audit current state. Confirm: existing `doCreateUser` reuse boundary; existing single-user createUser email-dispatch path (client-side per HIGH#1 fix); `getAllUsers()` shape and pagination; `branchService.listBranches()` shape (no `isActive` filter — caller applies); existing Papaparse usage (none — clean slate); existing email-validation helper (single inline regex in UserManagementPanel.jsx); modal scaffolding precedent (BranchEditorModal); UserManagementPanel header CTA pattern; whether `firestore.rules` need any changes (no — Admin SDK bypass).
> 2. CSV-spec-vs-existing-schema verification. Identify mismatches between CSV spec fields and what `doCreateUser`/`buildDocFields` currently accepts (branchId, phone, bio, careerLevel — all addressed by Q2/Q3 ratifications).
> 3. Cloud Function design. Pre-flight branchId Set load (Q2), per-row try/catch loop, server-side re-validation (incl. role rejection for tenant_admin/platform_admin), tenant-scope from claims.
> 4. UX wireframe. Four-step modal (file picker → preview → progress → summary). Reusable scaffolding from BranchEditorModal vs new pieces. Preview table is the largest new surface.
> 5. File-by-file change map with risk per file.
> 6. Tenant-admin preview matrix plan. 8 cells: tenant_admin × {1440, 1024, 768, 390} × {light, dark}. Per cell exercise the 4 modal steps. Plus drive-by other-role checks confirming "Bulk Import" CTA absent.
> 7. A11y verification plan.
> 8. Open questions for Kyron to answer before code starts.
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main`.
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against CONTEXT.md).
> 3. Copy `.env.local` from main worktree into the C2 worktree.
> 4. First commits — banked items from C1 close (separate commits per concern):
>    a. `chore(docs): bump CONTEXT.md to <sha> + close FOLLOW_UPS § Branches Management UI`
>    b. `docs(claude-md): clarify .env.local use-vs-echo + additive-rules-deploy timing`
>    c. `docs(track-c): add C2 kickoff brief`
>    d. (if HIGH#6 not knocked out) `docs(follow-ups): add HIGH#6 YTD composite index`
>    e. (if § PR C2 in implementation plan differs) `docs(track-c): align implementation plan with C2 kickoff brief`
> 5. Implement changes per the approved plan.
> 6. `npm run lint && npm run build` — must both pass.
> 7. Commit (conventional commits). Suggested code-phase sequence: token/CSS additions (if any) → `useFocusTrap` hook → email validators (client + Function) → `bulkImportUsers` Cloud Function in `functions/index.js` → `userImportService.js` → `BulkImportUsersModal.jsx` → `UserManagementPanel.jsx` CTA wire-up + EMAIL_RE migration.
> 8. Push to feature branch.
> 9. Deploy the Cloud Function pre-merge (per the C1-banked additive-deploy rule — the new function is additive, no modification of existing functions): `firebase deploy --only functions:bulkImportUsers` from feature worktree (with `.env.local` copied for credentials). Capture deploy output. STOP if deploy fails.
> 10. Open PR titled `feat(track-c-c2): bulk user provisioning via CSV import` with description covering: scope, file count breakdown, tenant-admin preview matrix verification (8 cells), drive-by verification, Cloud Function deploy notes (deployed pre-merge — quote the deploy output), write-path failure-mode demonstrations (invalid CSV / partial failure / cancel mid-flight / duplicate emails / forbidden roles), audit-trail (createdBy + createdAt + importedFromCsv + csvImportBatchId), backwards-compat (single-user create flow unchanged), dark-mode verification, a11y verification, open follow-ups.
> 11. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh`.
> 12. Run preview walkthroughs for tenant_admin (4 breakpoints × 2 themes = 8 cells), plus drive-by per-other-role test account confirming the Bulk Import CTA is absent.
> 13. Post the verification summary in PR comments.
> 14. STOP at preview-verified. No merge. Kyron merges manually.

## Hard rules — non-negotiable, applies every session

- Worktree branch only. Never push directly to `main`. Branch off `origin/main` HEAD.
- Always pull main before branching: `git fetch origin && git pull origin main`.
- Docs drafts live inside the feature worktree.
- No auto-merge. Push → deploy function → PR → preview Ready → tenant-admin matrix walkthrough + drive-by other-roles → STOP.
- Post-merge verification: `git fetch origin --prune && git pull origin main && git log origin/main --oneline -5` to confirm squash SHA. Then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=track-c-c2_production`. Note: because this PR ships a Cloud Function deployed pre-merge, the post-merge production walkthrough exercises the live function — no separate deploy step required.
- Worktree teardown after merge: `git worktree remove <path>` then `git worktree prune`. Local branch deletion uses `git branch -D <feature-branch>`.
- Never echo `.env.local` values to chat output, PR comments, logs, or screenshots. Reference by env var name only. Reading `.env.local` programmatically (scripts, `$VAR` substitution) is fine — banked from C1 close.
- Verification artifacts stay local. Logs, screenshots, one-off verification scripts — never commit.
- No emojis as structural icons. Lucide React only.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- All new tokens use `--color-*` prefix.
- Both light + dark mode tested before opening PR.
- A11y is not a follow-up. Form labels, modal focus trap, Escape (with mid-flight confirmation), return focus, ARIA invalid + live region, reduced-motion guards — all ship.
- Optimistic UI is forbidden.
- No new routing library.
- No new Firestore collections. C2 writes to existing `users` only.
- Hard delete remains unsupported.
- `tenant_admin` and `platform_admin` roles are NOT importable via CSV. Server-side enforcement.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** Same as C1. Two ambiguous mock-vs-code disagreements, two retries on the same step, two unsafe-rules surfaces, two scope-creep temptations → STOP.

### C2-specific surprise-stop triggers

- The `branchId` widening server-side validation introduces unexpected failure modes (e.g., a branch deactivated mid-import causes inconsistent state across the batch).
- Promoting `EMAIL_RE` to `src/utils/validators.js` reveals existing validators.js content that conflicts (audit-phase: file exists, contains date helpers only — no conflict).
- Papa.parse on a 500-row CSV blocks the main thread visibly during preview validation (consider Papa's worker mode if so).
- The phone / bio / careerLevel extension to `buildDocFields` reveals existing fields with conflicting semantics.
- Existing single-user createUser Function is no longer reusable (audit-phase: confirmed reusable — `doCreateUser` is already an extracted helper).
- `getAllUsers()` performance for 500-user tenants — paginated or slow at scale.
- Cloud Function timeout insufficient for 500 rows even at 540s — benchmark suggests longer.
- `branchService.listBranches()` shape changed from C1.
- Existing Papaparse usage pattern emerges that's unsuitable.
- Email-format regex inconsistency.
- CSV import volume mismatch — Tatil's actual import sizes (e.g., always ~50, never ~500).
- Cloud Function role-check fails in dev — auth claims not present in emulator vs production.
- Single-user createUser path doesn't currently send password reset email after HIGH#1 (audit-phase: confirmed it does, dispatched client-side from `agentManagementService.createUser`).
- Two-strike trigger — two ambiguous service-reuse disagreements or two scope-creep temptations → STOP.

C2's most likely surprises cluster around: `branchId` widening edge cases, Papaparse main-thread blocking on large CSVs, and CSV-spec-vs-existing-user-schema field mismatches.

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting C2. Known carry-overs as of C1 close:

- Untracked legacy doc at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked. Not C2 scope.
- GitHub "Automatically delete head branches" is ON.
- Open follow-ups in `docs/FOLLOW_UPS.md`:
  - "Branches Management UI" — closed by PR #60; mark in commit #1.
  - PR-4 Edit-user flows — out of C2 scope.
  - HIGH#5 Server-side email infrastructure — out of C2 scope.
  - HIGH#6 YTD composite index — pre-existing from B5, surfaced in C1 walkthrough. If not knocked out manually before C2 starts, add to FOLLOW_UPS.md in commit #1.
  - Wizard UX hardening, Mobile FU#1-4, etc. — out of C2 scope.

## Final stop condition

End the session when:

- PR is open with Vercel preview verified for tenant_admin at 1440px / 1024px / 768px / 390px in both light and dark mode (8 cells)
- Cloud Function `bulkImportUsers` deployed pre-merge from feature worktree; deploy output captured in PR description; preview exercises the live function end-to-end
- Drive-by verification confirms the Bulk Import CTA is unreachable for the other 4 roles
- File picker accepts CSV; rejects non-CSV with clear error
- Preview table renders with valid / warning / error rows correctly distinguished
- "Confirm import" CTA disabled when 0 valid rows
- Successful import: per-row password reset emails sent; users land in Firestore with correct fields including `importedFromCsv: true` + `csvImportBatchId`; appear in UserManagementPanel after refresh
- Partial failure: summary surfaces correct success / failure / skipped counts + per-row error details; no silent drops
- Cancel mid-flight: confirmation dialog shown; users imported pre-cancel are NOT reverted
- Duplicate email: warning shown in preview; row skipped on import; summary reports under "skipped"
- Invalid branch name: row rejected with specific error; summary reports rejection
- Modal focus trap, Escape (with mid-flight confirmation), return focus all manually verified
- Theme toggle still works in B4's TopBar; dark-mode persistence still works on the new surface
- Existing single-`<main>` invariant holds
- Reduced-motion behavior verified
- A11y: form labels / `aria-invalid` / live-region / `role="alert"` all verified at light + dark
- `tenant_admin` and `platform_admin` roles in CSV are rejected server-side (verify by attempting import; row should fail with specific error)
- Test account login verified for tenant_admin
- All open questions for Kyron are listed in plan / PR description
- `npm run lint` and `npm run build` both green
- Two-strike counter at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (Function + service + modal + UserManagementPanel CTA + first-commit doc bumps), Cloud Function deploy result, what's blocked on Kyron, two-strike counter status, and the closing line: "C2 ready for review. Next is C3 — 2026 goals seeding."

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **Second PR of Track C.** C1 (PR #60) shipped the branches schema; C2 unblocks immediately on top. C3 (2026 personal annual API goals seeding) follows.
- **C2 introduces a new Cloud Function** (`bulkImportUsers`) and a multi-step modal (`BulkImportUsersModal`). Schema, permissions, validation rules, and write-path discipline are locked via Q1–Q11 ratifications.
- **Reusability is high.** Audit confirmed `doCreateUser` is already an extracted helper; `sendPasswordResetEmail` is already client-side; `branchService.listBranches` is already in place. No new Firestore paths, no new rules block, no helper-extraction needed for the saga.
- **Three additive extensions** to `doCreateUser`: optional `data.branchId` (gated on caller cross-branch authority), `data.csvImportBatchId`, `data.importedFromCsv`. Single-user flow never sets these, so its behavior is unchanged.
- **First commits bundle five banked items** before code starts: CONTEXT.md SHA bump + FOLLOW_UPS close, CLAUDE.md additions, this kickoff doc, HIGH#6 YTD index follow-up, and the implementation-plan cascade-correct.
- **`useFocusTrap` extracted but only consumed once.** SS-2 commitment honored without bundling battle-tested-modal refactor risk into a pilot-blocking ship. EditConfigModal and BranchEditorModal migration filed as a follow-up.
- **CSV `personalApiTarget` deferred to C3.** Goals UI is the right home for per-agent target writes; user creation isn't.
- **Server fail-fast on zero active branches.** Q10's client-side empty-state is the friendly path; Q2's server `failed-precondition` is the defense-in-depth backstop.
- **Cloud Function deployed pre-merge.** The new `bulkImportUsers` is purely additive — no edits to existing functions — so it deploys safely from the feature worktree before merge per the new CLAUDE.md rule. Capture deploy output in PR description.
- **"Tenant_admin matrix verified before merge" is a hard floor.** 8 render-state cells for the new surface (4 breakpoints × 2 themes) plus 4 drive-by other-role sanity checks. If any cell can't be verified, the PR doesn't ship.
- **C3 unblocks immediately after C2 merges.** C3 seeds 2026 personal annual API goals against users that exist in Firestore — they need to exist before goals can be set against them.
