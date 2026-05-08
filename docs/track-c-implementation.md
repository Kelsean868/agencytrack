# AgencyTrack — Track C Implementation Plan (Pilot Launch Readiness)

> **What this is:** Phased PR-by-PR technical plan for Track C — the data layer + onboarding tooling that bridges "code shipped" → "real Tatil pilot agents using real data."
>
> **What this is NOT:** A continuation of Track B. Track B (v2) is the design-system v2 redesign (visual + chrome). Track C is a sibling track, not an extension. Track B closes with B5 (no B6); Track C opens fresh.
>
> **Visual source of truth (where applicable):** [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html). The mock arbitrates surface design where one exists. Where the mock has only a stub link or an overview card (e.g. tenant-admin "Branches"), Track C designs the management surface from first principles, reusing B5's tenant-admin patterns.
>
> **Estimated total effort:** 1.5–2.5 weeks of focused work, sequenced as 3 small PRs.

---

## Sequencing principle

Three PRs (C1 through C3), shipped in dependency order. Track C is a chain, not a fan-out:

- **C1 must merge before C2.** C2's bulk-import CSV references `branchId` values that must exist in C1's collection.
- **C3 can ship in parallel with C2** if both are ready and independently testable. Otherwise, in sequence after C2 — it's safer to seed goals against users that already exist than to seed goals first and re-target users later.

| PR  | Scope                                                | Effort     | Risk    | Blocker for |
|-----|------------------------------------------------------|------------|---------|-------------|
| C1  | Branches schema + tenant admin management UI         | 2–3 days   | Medium  | C2 (CSV branchId references) |
| C2  | Bulk user provisioning (CSV import)                  | 2–3 days   | Medium  | C3 (goals seed against users) |
| C3  | 2026 personal annual API goals seeding (per-agent or bulk) | 1–2 days   | Low     | None |

**Why this order:**
1. C1 establishes branches as a real Firestore collection — every downstream operation (user creation, goal seeding) references `branchId` values that must exist somewhere addressable.
2. C2 reuses B5's `companyMinimums` write-path discipline + the HIGH#1 reset-email path, but adds bulk semantics (per-row error reporting, idempotency).
3. C3 is lowest risk — it writes against the existing `goals` document pattern that B2 already exercised on the read side.

---

## PR C1 — Branches Schema + Tenant Admin Management UI

### Goal
Make branches a real Firestore collection at `tenants/{tid}/branches/{branchId}` with a tenant-admin UI to create, edit, and deactivate. Replace the "branches derived from user docs" pattern with a proper collection while preserving backwards compatibility (if collection is empty for a tenant, fall back to user-doc derivation so existing dashboards keep working).

> **Path correction (C1 audit, SS-1):** the original draft locked the path as `tenants/{tid}/meta/branches/{branchId}` — 5 segments — which is not a valid Firestore document path (segments must alternate collection/doc with even count). Corrected to `tenants/{tid}/branches/{branchId}` — sibling subcollection under tenant, matching `users`, `submissions`, `goals`, `unitGoals`, `branchGoals`, `campaigns`. The existing `match /meta/{docId}` rule (`firestore.rules:54-56`, write-locked) stays untouched — reserved for any future singleton tenant-metadata docs.

### Files (starting hypotheses — audit confirms during C1)

**Create:**
- `src/services/branchService.js` — `listBranches`, `getBranch`, `createBranch`, `updateBranch`, `deactivateBranch`, `reactivateBranch`. Pure service layer, never reads from `users` collection.
- `src/components/admin/BranchesPanel.jsx` — list view with row actions (Edit, Deactivate / Reactivate). Sorted by `isActive` desc, then `createdAt` desc. Inactive rows visually de-emphasised.
- `src/components/admin/BranchEditorModal.jsx` — create + edit form. Lifts B5's `EditConfigModal` patterns (focus trap, Escape, return-focus, reduced-motion guards, `role="dialog"`, `aria-modal`, save-disabled-during-write).

**Modify:**
- `firestore.rules` — new `match /branches/{branchId}` block scoped under the existing `match /tenants/{tenantId}` parent (sibling to `users`, `submissions`, `config`, etc.). Read = any signed-in user in tenant. Write = `tenant_admin` or `platform_admin` (with platform_admin tenant-scope guard, per B5 lesson). The existing `match /meta/{docId}` block at `firestore.rules:54-56` is unrelated and stays untouched.
- `src/components/dashboard/TenantAdminDashboard.jsx` (if it exists post-B5) — wire the "Branches" sidebar item to render `<BranchesPanel />`. If routing post-B5 still goes through `ManagerDashboard.jsx`, audit confirms the right surface to plug into.
- `src/index.css` — additive only. New tokens / classes only if existing semantic tokens don't cover the surface (status pills for active / inactive, list-row hover treatments). Reuse `--color-*` tokens wherever they fit.

**Read-path fallback (no edits required, but verified during audit):**
- Existing branch-derivation read paths (currently sourced from `users` docs — see `docs/FOLLOW_UPS.md` "Branches Management UI" entry) MUST continue to work when the new collection is empty for a tenant. C1 adds the new collection but does not migrate or rewrite existing read paths. Once the collection is populated for the pilot tenant, downstream code can opt in to reading from the collection instead — that migration is a separate ticket, not C1.

**Visual source-of-truth gap (audit-phase decision):**
- The mock at `mocks/concept-4-complete.html` includes a tenant-admin sidebar item "Branches" (`mocks/concept-4-complete.html:1839`) but the only on-screen surface is a read-only "Branch overview" card showing health pills (around `mocks/concept-4-complete.html:2026-2047`). There is **no full management UI design in the mock.** C1 designs the management surface from first principles, reusing B5's tile-and-modal patterns. Surface this as a decision-point in the C1 audit before implementing — the management UI shape (table-style list vs card grid) is the primary design choice.

### Schema (locked)

Path: `tenants/{tenantId}/branches/{branchId}`

| Field        | Type            | Notes |
|--------------|-----------------|-------|
| `name`       | string          | Required, trimmed, non-empty, ≤ 100 chars (audit-phase confirms max). Tenant-unique recommended (audit decides whether to enforce in rules or in service layer). |
| `managerId`  | string \| null  | Optional. References a `branch_manager` user UID in the same tenant. `null` = "Unassigned." |
| `isActive`   | boolean         | Default `true` on create. Soft-delete sets to `false`; hard delete is out of scope. |
| `createdAt`  | Timestamp       | `serverTimestamp()` on create. Never updated. |
| `updatedAt`  | Timestamp       | `serverTimestamp()` on every write (including reactivation). |
| `updatedBy`  | string          | UID of the writer. Required on every write (audit trail, mirrors B5's `companyMinimums` pattern). |

`branchId` is auto-generated by Firestore's `add()` — opaque random string, not human-readable. The display field is always `name`.

### Acceptance criteria
- [ ] Tenant Admin can create a branch with `name` and optional `managerId`
- [ ] Tenant Admin can edit branch `name` and reassign `managerId`
- [ ] Tenant Admin can deactivate a branch (sets `isActive: false`); inactive branches display with reduced opacity + an "Inactive" pill, and can be reactivated
- [ ] Branch list renders for `tenant_admin` in the Branches sidebar destination, sorted active-first then `createdAt` desc
- [ ] `branch_manager` users continue to see only their own branch in dashboards (preserves existing behavior; falls back to `user.branchId` derivation if the collection is empty for the tenant)
- [ ] `sales_manager` users continue to see all active branches in their tenant
- [ ] Firestore rules: read = any signed-in user in tenant (`isSignedIn() && getTenantId() == tenantId`); write = `tenant_admin` OR `platform_admin` with tenant-scope guard absorbed (per B5 lesson)
- [ ] Firestore rules emulator regression test analogous to B5's `scripts/test-b5-config-rule.js` — proposed file: `scripts/test-c1-branches-rule.js` covering at minimum: cross-tenant read denied, agent write denied, unit_manager write denied, branch_manager write denied, sales_manager write denied, tenant_admin write allowed in own tenant, tenant_admin write denied in other tenant, platform_admin write allowed in any tenant
- [ ] 8-cell preview matrix for `tenant_admin` (4 breakpoints × 2 themes: 1440px / 1024px / 768px / 390px × light / dark) covering: empty state, populated list, modal open (create), modal open (edit), validation error, save success, deactivate confirm, reactivate
- [ ] Drive-by preview checks confirming the other 4 roles cannot reach the Branches management surface (sidebar item absent or `aria-disabled`, direct route 404 / redirect)
- [ ] Modal a11y: focus trap, Escape cancels, returns focus to trigger, `role="dialog"` + `aria-modal` + `aria-labelledby`, reduced-motion guards
- [ ] `npm run lint && npm run build` exits 0
- [ ] Production-equivalent walkthrough on Vercel preview before merge

### Out of scope (for C1)
- **Hard delete.** Only soft delete (`isActive: false`) ships in C1. Permanent removal of inactive branches is deferred — flagged as audit-phase decision if a real need surfaces.
- **Unit hierarchy.** C1 models branches only. Units remain tracked solely by `unitId` strings on user docs; modeling units as a real collection is deferred to post-pilot work.
- **Branch-manager assignment validation** (i.e., enforcing one branch per manager). Current data shape allows a branch_manager to be referenced by multiple branches; C1 doesn't add a uniqueness check. Audit-phase decision: surface whether the pilot needs this.
- **Migration of existing legacy `user.branchId` string values.** Current values stay as-is; downstream display code falls back to "branchId-as-string" rendering until the user opens an Edit User flow that re-targets a real `branchId`. Migration is a separate ticket, not C1.
- **Branch deletion UI for inactive branches.** Deactivated branches stay visible (with reduced emphasis) so reactivation is one click. Permanent deletion is deferred.
- **Bulk branch import.** Tenant admins create branches one at a time in C1.
- **Sidebar shell or chrome changes** beyond linking the existing "Branches" item to the new surface.

### Rollback
Revert the C1 commit. Drop the new files. The fallback derivation pattern was never removed, so dashboards keep working with no manual data migration. Rules revert is a single-block removal.

---

## PR C2 — Bulk User Provisioning (CSV import)

> **Cascade-corrected 2026-05-08** to align with `docs/track-c-C2-kickoff.md` and the Q1–Q11 ratifications. Original draft listed `branchId` as the CSV header (locked: `branchName`), proposed a client-side per-row loop calling `createUser` directly (locked: a new server-side `bulkImportUsers` Callable), proposed `BulkUserImportModal` (locked: `BulkImportUsersModal`), and modified `agentManagementService.js` (locked: a new `userImportService.js`). Locked decisions below supersede the original draft.

### Goal
Tenant Admin uploads a CSV of users (`email,name,role,branchName,agentNumber` required + optional `unitId,contractStartDate,phone,bio,careerLevel`) and the app creates them in bulk via a new server-side `bulkImportUsers` Callable that wraps the existing `doCreateUser` saga in a per-row loop. Per-row validation, per-row error reporting, downloadable error CSV for re-import, and per-row password-reset email dispatch (mirroring the HIGH#1 client-side path).

### Dependency
**C1 must merge first.** CSV `branchName` values resolve case-insensitively against `branchService.listBranches(tenantId).filter(b => b.isActive)` to obtain auto-ID branchIds. Validation rejects rows whose `branchName` doesn't match an active branch.

### Files (post-audit, locked via Q1–Q11 ratification)

**Create:**
- `src/components/admin/BulkImportUsersModal.jsx` — multi-step wizard within one modal shell. Step 1: file picker + "Download template" CTA + zero-active-branches empty state (Q10). Step 2: full preview table (not just first 5 rows) with valid / warning / error rows distinguished, filter toggles (All / Errors / Warnings / Valid), and "Confirm import" CTA disabled when 0 valid rows. Step 3: indeterminate progress spinner with row count (Q4). Step 4: summary (success / skipped / failed counts + per-row error details + "Download error report" CSV CTA).
- `src/services/userImportService.js` — pure service layer. CSV parse via Papaparse (`transformHeader: lowercase`, `skipEmptyLines: true`), per-row validation, branch-name → branchId resolution against active branches, duplicate-email check via `getAllUsers({ includeInactive: true })`, batch invocation of `bulkImportUsers` Callable, post-success client-side `sendPasswordResetEmail` dispatch per row, error CSV generation via `Papa.unparse`.
- `src/utils/validators.js` — additive: add `EMAIL_RE` + `isValidEmail` exports (file already contains date helpers).
- `functions/utils/validators.js` — new: same `EMAIL_RE` regex for the Callable's defense-in-depth re-validation. Header comment: `// MUST stay in sync with the matching file at src/utils/validators.js`. (Same comment in the client copy.)
- `src/hooks/useFocusTrap.js` — extracted from BranchEditorModal's inline scaffolding per the SS-2 commitment from C1 audit. Consumed by `BulkImportUsersModal` only in C2; existing modals stay on inline duplication (a follow-up is filed for migrating them when next touched).

**Modify:**
- `functions/index.js`:
  - Add `bulkImportUsers` Callable with `runWith({ timeoutSeconds: 540 })` (Q1). Auth + role check (`['tenant_admin', 'platform_admin']`). Single pre-flight Firestore read of `tenants/{tid}/branches`, build active-branch Set; fail fast with `failed-precondition` if the Set is empty (Q2 server backstop). Per-row try/catch loop calling `doCreateUser({...row, branchId, csvImportBatchId, importedFromCsv: true}, context)`. Returns `{ results: [{ rowIndex, email, success, uid?, error?, code? }] }`.
  - Extend `doCreateUser` to honor optional `data.branchId` (only when caller has `ownedBranchIds === ['*']`, i.e. cross-branch authority — Q2), `data.csvImportBatchId`, `data.importedFromCsv`. Single-user flow never sets these, so its behavior is unchanged.
  - Extend `buildDocFields` for `phone`, `bio`, `careerLevel`, `csvImportBatchId`, `importedFromCsv` (Q3 + Q9). `personalApiTarget` is NOT added — handled by Goals UI per the P6A/P8C path.
- `src/components/manager/UserManagementPanel.jsx` (note: lives in `manager/`, not `admin/`):
  - Add "Bulk Import" CTA in the panel header gated on `role in ['tenant_admin', 'platform_admin']`.
  - Replace inline `EMAIL_RE` regex with import from `src/utils/validators.js`.

**No changes:**
- `firestore.rules` — Admin SDK bypasses rules; the Callable is the security floor.
- `src/services/agentManagementService.js` — left unchanged; original draft proposed extending it but the kickoff locks a separate `userImportService.js` to keep concerns isolated.

### CSV contract (locked)
- **Required headers (case-insensitive):** `email`, `name`, `role`, `branchName`, `agentNumber`.
- **Optional headers:** `unitId`, `contractStartDate` (ISO YYYY-MM-DD), `phone`, `bio`, `careerLevel`.
- **Encoding:** UTF-8 with optional BOM. CRLF tolerated.
- **Empty rows:** skipped (`skipEmptyLines: true`).
- **`personalApiTarget` is NOT in the C2 CSV** — handled by C3 / Goals UI.
- **Hard limit:** 500 rows. Soft warn at 100 client-side.

### Per-row validation (locked)
- `email` — required, valid format (regex from `validators.js`). Tenant-unique check: `getAllUsers({ includeInactive: true })` snapshot loaded once before the loop. Duplicate (active OR deactivated) = warning, row skipped. Same warning copy: "Email already in tenant."
- `name` — required, trimmed, non-empty, ≤ 100 chars.
- `role` — required, must be one of: `agent`, `unit_manager`, `branch_manager`, `sales_manager`. **`tenant_admin` and `platform_admin` are forbidden via CSV (security, server-enforced).** Invalid role = row rejected.
- `branchName` — required, case-insensitive lookup against active branches (`isActive: true` filter applied by service layer). No match = row rejected.
- `agentNumber` — required for `agent` role; optional for managers (empty string if absent). Trimmed, ≤ 20 chars. No auto-uppercase (mirrors current single-user behavior).
- `unitId` — optional. If present for non-agent role: warning, field stripped. If agent without unitId: stored as `null`.
- `contractStartDate` — optional, ISO YYYY-MM-DD. If present and invalid: row rejected.
- `phone` — optional, ≤ 20 chars. No format enforcement (Q11).
- `bio`, `careerLevel` — optional, length-only (≤ 500 / ≤ 50 chars respectively).

### Acceptance criteria
- [ ] CSV upload accepts the required headers (case-insensitive); optional columns honored; unknown columns ignored
- [ ] Per-row validation runs client-side for fast preview feedback; server re-validates as defense-in-depth
- [ ] Server-side check: rows with `role: tenant_admin` or `role: platform_admin` are rejected even if client validation was bypassed
- [ ] Server-side branchId Set validation: row's resolved `branchId` must be in the active-branch Set; rejected with specific error if not
- [ ] Server fail-fast with `failed-precondition` if tenant has zero active branches (defense-in-depth backstop for Q10's client empty state)
- [ ] Step 3 progress UI is an indeterminate spinner with row count + `role="status"` (Q4)
- [ ] Successful imports trigger client-side `sendPasswordResetEmail` per row (mirrors HIGH#1 path)
- [ ] On any per-row failure, "Download error report" CTA in Step 4 emits a CSV with original input rows + appended `error` column. Re-importable workflow (Q8).
- [ ] Duplicate email (active OR deactivated): warning in preview, row skipped on import, summary reports under "skipped (duplicate)" — same copy "Email already in tenant"
- [ ] Modal blocked at Step 1 with empty-state copy when tenant has zero active branches; link to Branches panel (Q10)
- [ ] Each created user doc carries `csvImportBatchId: <UUID v4>` (Q9), `importedFromCsv: true`, `phone` / `bio` / `careerLevel` if provided
- [ ] 8-cell preview matrix for `tenant_admin` (4 breakpoints × 2 themes) covers: empty state, file picked, preview valid + mixed + all-error, mid-progress, summary success + partial-failure + all-failure
- [ ] Drive-by other-role checks confirm "Bulk Import" CTA is unreachable for `agent` / `unit_manager` / `branch_manager` / `sales_manager`
- [ ] Modal a11y: focus trap (via `useFocusTrap` hook), Escape cancels in Steps 1/2/4, Step 3 Escape shows confirmation dialog, `role="dialog"` + `aria-modal` + `aria-labelledby`, return focus on close
- [ ] Cloud Function deployed pre-merge from feature worktree; deploy output captured in PR description (per the additive-deploy rule banked into CLAUDE.md)
- [ ] `npm run lint && npm run build` exits 0

### Out of scope (for C2)
- **User edit flows** (PR-4 Edit-user flows in `docs/FOLLOW_UPS.md`). Separate ticket.
- **Deactivate / reactivate flows.** Already exist in `UserManagementPanel.jsx`; no changes in C2.
- **Bulk reset-email retry after import.** Per-row Retry is via the downloadable error CSV (admin fixes and re-imports). The single-user inline Retry button (UserManagementPanel post-PR #57) covers the single-user path.
- **`personalApiTarget` per-row import.** Handled by C3 / Goals UI.
- **Real-time CSV format detection** (e.g., transparent semicolon-delimited support). MVP requires standard comma-separated UTF-8.
- **`tenant_admin` / `platform_admin` role bulk-import.** Server-rejected.
- **Cross-tenant import for platform_admin.** C2 enforces caller's tenant only.
- **Migrating `EditConfigModal` / `BranchEditorModal` to consume `useFocusTrap`.** Both stay on inline duplication; follow-up filed.
- **Phone format validation beyond ≤ 20 chars.** Trinidad-format check is a follow-up if pilot reports inconsistencies.
- **Hard delete of imported users.** Use existing deactivate flow.
- **Update via CSV.** C2 is import-only; re-importing = skip with warning.
- **Photo upload via CSV.**

### Rollback
Revert the C2 commit. The new Cloud Function (`bulkImportUsers`) is purely additive — leaving it deployed has no effect (no production caller invokes it once the UI is reverted). Optional belt-and-suspenders: redeploy `functions/index.js` from `main` after revert merges to drop the function. The `doCreateUser` extensions are also additive — single-user flow never sets the new optional params, so no behavior change to roll back. The existing single-user `createUser` flow in `UserManagementPanel.jsx` is untouched apart from the `EMAIL_RE` import refactor (cosmetic).

---

## PR C3 — 2026 Personal Commitments CSV Import

> **Cascade-corrected 2026-05-08** to align with `docs/track-c-C3-kickoff.md` and the Q1–Q7 ratifications. Original draft proposed a single-user `GoalsSeederModal.jsx` UI with bulk CSV deferred; locked outcome flips that — bulk CSV import IS the C3 deliverable. Original draft locked the goal doc path as `tenants/{tid}/users/{uid}/goals/{year}` (5 segments — invalid Firestore document path); corrected to `tenants/{tid}/goals/{agentUid}` per audit finding 1a (matches `firestore.rules:96-100` and `goalsService.js:5,45`). Original draft proposed extending `goalsService.js` with a new `setPersonalAnnualAPI` helper; locked outcome reuses the existing `setGoals` (already enforces `companyMinimums` floors and writes audit fields). Apps-count seeding restored (locked Q4 — CSV columns are `agentEmail, annualApiTarget, annualAppsTarget`). Persistency commitment column deferred per Q4. Locked decisions below supersede the original draft.

### Goal
Tenant Admin uploads a CSV of per-agent 2026 personal commitments (`agentEmail, annualApiTarget, annualAppsTarget`) and the app writes to the existing `tenants/{tid}/goals/{agentUid}` doc per row via the existing `setGoals` service (which enforces `companyMinimums` floors). Per-row validation, per-row error reporting, downloadable error CSV for re-import, batch-id audit trail.

### Dependency
**C2 must merge first.** CSV `agentEmail` values resolve against `getAllUsers({ includeInactive: true })` filtered to `role === 'agent' && active !== false`. Test-importing goals before users exist would fail every row.

### Files (post-audit, locked via Q1–Q7 ratification)

**Create:**
- `src/services/goalsImportService.js` — pure service layer mirroring C2's `userImportService.js` structure verbatim. CSV parse via Papaparse (`transformHeader: lowercase`, `skipEmptyLines: true`), per-row validation (agent identifier lookup → `getAllUsers` filter to active agents, target-vs-`companyMinimums` floor check delegated to `setGoals`, duplicate-existing-goal check), batch invocation (per-row `setGoals` call inside try/catch), error CSV generation via `Papa.unparse`. Exports: `parseCSV`, `prepareImport`, `runImport`, `buildErrorCSV`, `buildTemplateCSV`, `downloadCSV`, `generateBatchId`, `LIMITS`.
- `src/components/admin/BulkImportGoalsModal.jsx` — multi-step wizard within one modal shell mirroring `BulkImportUsersModal.jsx` (copy-from-precedent — third-consumer threshold for extracting `CsvImportModalShell` not yet met; deferred follow-up filed per Q7). Step 1: file picker + "Download template" CTA + companyMinimums-defaults warn banner (Q3) + zero-eligible-agents empty state (Q5). Step 2: full preview table with valid / warning / error rows distinguished, filter toggles (All / Errors / Warnings / Valid), and "Confirm import" CTA disabled when 0 valid rows. Step 3: indeterminate spinner with row count. Step 4: summary (success / skipped / failed counts + per-row error details + "Download error report" CSV CTA).

**Modify:**
- `src/services/goalsService.js`:
  - Extend `setGoals(tenantId, agentId, data, setBy, setByName)` to accept passthrough audit-trail fields `data.csvImportBatchId` (UUID v4) and `data.importedFromCsv` (boolean). Single-user CareerPortal "Edit My Goals" flow never sets these → behavior unchanged. Floor validation logic untouched. Q6 ratified.
- `src/components/manager/UserManagementPanel.jsx`:
  - Rename C2-shipped "Bulk Import" CTA to "Bulk Import Users" for disambiguation. Add sibling "Bulk Import Goals" CTA. Both gated on `role in ['tenant_admin', 'platform_admin']`. Two-button pattern. Q1 ratified. **Surface-stop fallback:** if header can't fit two CTAs at 768px / 390px, STOP and convert to dropdown (chevron + menu of "Users" / "Personal Commitments").
- `src/components/admin/BulkImportUsersModal.jsx`:
  - Add `'internal'` to the friendly-message branch of the error-code map at line 244 (closes F3 MEDIUM). 1-line change. Q2 ratified — alongside-fix.

**No changes:**
- `firestore.rules` — `match /goals/{goalId}` already gates writes on `canManage(tenantId)` (`firestore.rules:96-100`); tenant_admin satisfies. No rules expansion needed.
- `functions/index.js` — no Cloud Function for C3. Goal writes are simple Firestore ops covered by existing rules; adding a Callable would split the floor-validation surface (client `setGoals` enforces; Callable would re-enforce) for no security gain.

### CSV contract (locked)
- **Required headers (case-insensitive):** `agentEmail`, `annualApiTarget`, `annualAppsTarget`.
- **Optional headers:** none in C3. `personalAnnualPersistency` deferred per Q4 — pilot follow-up if reports indicate need.
- **No `year` column.** The personal-commitment doc has no `year` field; "2026" is editorial framing only (template/CSV header copy says "2026 personal commitments" for human clarity). Audit finding 1b.
- **Encoding:** UTF-8 with optional BOM. CRLF tolerated.
- **Empty rows:** skipped (`skipEmptyLines: true`).
- **Hard limit:** 500 rows. Soft warn at 100 client-side (mirrors C2).

### Per-row validation (locked)
- `agentEmail` — required, valid email format (regex from `validators.js`). Lookup against `getAllUsers({ includeInactive: true })` snapshot loaded once before the loop. Match required:
  - User must exist in tenant
  - User must have `role === 'agent'` (managers don't have personal commitments via C3)
  - User must have `active !== false`
  - No match = row rejected with specific error.
- `annualApiTarget` — required. `parseFloat`. **Floor validation delegated to `setGoals`** — `runImport` calls `setGoals(...)` per row inside try/catch; the existing service throws `Error("Annual API must be at least TTD X (company minimum).")` which surfaces verbatim as the row's failure message. Single source of truth for floor logic.
- `annualAppsTarget` — required. `parseFloat`. Same delegation pattern — `setGoals` throws below-floor errors against `companyMinimums.annualApps` (default 42).
- Duplicate-existing-goal check: per-agent pre-flight `getDoc` of `tenants/{tid}/goals/{agentUid}` to detect existing `personalAnnualAPI`. If present and non-empty: warning, row skipped (mirrors C2 duplicate-email pattern). UI copy: "Agent already has 2026 commitment set."

### Confirmation copy (locked)
- companyMinimums-defaults warn banner (Q3) at Step 1 when `getCompanyMinimums` returns built-in defaults:
  > "Using default company minimums (TTD 200,000 API / 42 apps). Set explicit minimums in Company Config if your org's floors are different. Floors apply regardless."
- Zero-eligible-agents empty state (Q5) at Step 1 when every active agent already has 2026 personal commitments:
  > "All active agents already have 2026 personal commitments. Edit individuals via Career Portal."

### Acceptance criteria
- [ ] CSV upload accepts the required headers (case-insensitive); unknown columns ignored
- [ ] Per-row validation runs client-side for fast preview feedback
- [ ] Below-floor targets rejected — `setGoals` throws floor error at write time, surfaced as row failure
- [ ] Step 3 progress UI is an indeterminate spinner with row count + `role="status"`
- [ ] On any per-row failure, "Download error report" CTA in Step 4 emits a CSV with original input rows + appended `error` column. Re-importable workflow.
- [ ] Duplicate existing goal: warning in preview, row skipped on import, summary reports under "skipped" — same copy "Agent already has 2026 commitment set."
- [ ] Modal blocked at Step 1 with empty-state copy when zero eligible agents (Q5)
- [ ] companyMinimums-defaults warn banner renders when no explicit doc (Q3)
- [ ] Each written goal doc carries `csvImportBatchId: <UUID v4>` (Q6) and `importedFromCsv: true`, merged into the existing doc (preserves manager-set targets via `merge: true`)
- [ ] `setBy: <caller_uid>` + `setByName: <caller_name>` + `updatedAt: serverTimestamp()` set by existing `setGoals` (no change to those fields)
- [ ] 8-cell preview matrix for `tenant_admin` (4 breakpoints × 2 themes) covers: defaults-banner Step 1, file picked, preview valid + mixed + all-error, mid-progress, summary success + partial-failure
- [ ] Drive-by other-role checks confirm "Bulk Import Goals" CTA is unreachable for `agent` / `unit_manager` / `branch_manager` / `sales_manager`
- [ ] Modal a11y: focus trap (via `useFocusTrap` hook), Escape (with mid-flight confirmation in Step 3), `role="dialog"` + `aria-modal` + `aria-labelledby`, return focus on close
- [ ] `npm run lint && npm run build` exits 0
- [ ] Two-sibling-button CTA pattern verified at 1440 / 1024 / 768 / 390 (or surface-stop if cramped at 768/390 — fall back to dropdown)

### Out of scope (for C3)
- **Single-user goal-seeder UI for tenant_admin.** Existing CareerPortal "Edit My Goals" path is for agents to set their own; tenant_admin uses the bulk CSV in C3. Bulk-edit follows in a separate post-pilot ticket if needed.
- **Phase 9 Sales Manager Target layer.** Defer to post-pilot.
- **Quarterly goals.** Annual only.
- **Persistency commitment column** in CSV (Q4 lock). Pilot follow-up if needed.
- **Goal editing UI for agents themselves.** Already exists via `CareerPortal.jsx` "Edit My Goals" — unchanged.
- **Bulk personal-commitment EDIT.** C3 is import-only; re-importing same agent = skip with warning.
- **Year other than 2026.** Locked single-year. Future-year roll-over is a post-pilot ticket.
- **Hard delete of goal docs.**
- **New Cloud Function.** Writes are client-side under existing rules.
- **New Firestore collection.** Existing `goals` only.

### Rollback
Revert the C3 commit. Drop the new files. `setGoals` extension is additive — single-user CareerPortal flow never sets `csvImportBatchId` / `importedFromCsv`, so no behavior change to roll back. The C2 modal's `internal` error-code addition is purely additive (1 case in a switch). The UserManagementPanel CTA rename + sibling-button addition reverts cleanly via the commit.

---

## Cross-PR concerns

### Empty states (mandatory for every data-bound surface)

Every PR must include explicit empty-state copy with an actionable CTA where applicable:
- **C1 — Branches list empty:** "No branches yet. Click **Add Branch** to create your first branch."
- **C2 — Import preview empty:** "No file selected. Drop a CSV here or click to browse."
- **C2 — Import results all-failed:** "0 of N rows imported. Download the error report to fix and re-import."
- **C3 — No agents in tenant:** "No agents to seed goals for yet. Add agents via Team → Add User or Import Users first."

### Performance

- **C1 list rendering:** branches per tenant are typically < 20 — no virtualisation needed. Sort + filter happens client-side.
- **C2 bulk import:** sequential writes (one `createUser` callable per row) to respect Firebase Auth + Firestore quotas. If the pilot's CSV is large (> 200 rows), surface during audit and consider chunked progress UI (process 25 at a time, show running tally). Firestore batched writes (max 500 per batch) are NOT directly applicable here because each row goes through a callable that does its own multi-step atomic dance (Auth user create → custom claims → Firestore doc) — batching at the rows-level is wrong. Sequential is correct.
- **C3 goals seeding:** if bulk path absorbed (audit-phase), batch writes capped at 500 per batch.

### Accessibility checklist (per PR)

Every Track C PR must verify:
- All form inputs have `<label>` (not just `aria-label`)
- All interactive elements keyboard-reachable in DOM order, focus rings visible
- Modals: focus trap, Escape closes (when not mid-write), `role="dialog"` + `aria-modal` + `aria-labelledby`, return focus to trigger
- Live regions (`aria-live="polite"`) for: validation errors, bulk-import progress, save-success / save-error toasts
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large text + icons, in both light and dark
- Heading hierarchy preserved — `<h1>` → `<h2>` → `<h3>`, no skips
- Reduced-motion guards on modal animations
- ≥ 44×44 touch targets on all interactive elements (CLAUDE.md domain rule)

### Dark mode parity

Every Track C surface tested in both modes before the PR opens. Common failure modes from B-series retrospectives:
- Status pills (active / inactive / failed) using hardcoded hex instead of `--color-*` tokens
- Form-input borders disappearing on dark surface
- Modal backdrop not desaturating correctly (B4 lesson)

### Backwards compatibility

- **C1:** existing `user.branchId` strings continue to work as fallback display until the user is edited and re-targeted. **No migration required for pilot launch** — the new collection coexists with legacy values.
- **C2:** the existing single-user `createUser` flow (the post-HIGH#1 path in PR #57) is untouched. Bulk flow is purely additive.
- **C3:** existing per-agent `goals` write path from `CareerPortal.jsx` "Edit My Goals" is untouched. Tenant-admin seed is a parallel writer, not a replacement.

### Token naming

All new CSS variables use the `--color-*` prefix (B-series locked). Both `:root` and `.dark` blocks updated together.

### Write-path discipline (ALL Track C PRs)

Every Track C write inherits B5's discipline gate. Non-negotiable:
- Pre-write read for edits (forms seeded from current state, no blind writes)
- Optimistic UI forbidden (modals close only on write success)
- Specific error messages per failure mode (permission denied / network failure / validation error / write conflict). No silent failures.
- Firestore rules enforcement is the source of truth — client-side validation is for UX, not for security
- Audit trail: `updatedBy: uid` + `updatedAt: serverTimestamp()` on every doc write

---

## Definition of done (project-level)

- [ ] All three PRs (C1, C2, C3) merged to main
- [ ] Production walkthrough passes for `tenant_admin` × full Track C surface (Branches CRUD, bulk user import flow with success + partial-failure paths, goals seeding flow with success + failure paths)
- [ ] Tenant Admin can complete the pilot-onboarding sequence end-to-end without leaving the app: create branches → import users (via CSV) → seed annual goals → confirm via dashboard
- [ ] Real Tatil branch hierarchy modeled in Firestore (3 branches per current PRD assumption — Port of Spain, San Fernando, Tobago)
- [ ] Real agent + manager accounts seeded across the modeled branches
- [ ] 2026 personal annual API goals loaded for every active agent
- [ ] Lint + build green on main
- [ ] CONTEXT.md updated to reflect "Track C shipped — pilot launch unblocked"
- [ ] Pilot launch unblocked: when Kyron schedules the Tatil demo, the data layer is real, not seeded with fixtures

---

## Out of scope for entire Track C

Track C is **scoped to data-layer onboarding only.** The following are explicitly NOT in Track C:

- **Phase 9 Sales Manager Target layer** — fifth goal-hierarchy layer. Defer to post-pilot.
- **B5 deferred config items** — persistency floor editable, currency override, fiscal year, week-start day. Defer to post-pilot UX hardening.
- **Audit Log infrastructure** — already deferred to P11 per PRD. Track C does not introduce a separate audit-log collection; per-doc `updatedBy` / `updatedAt` is the audit trail.
- **Wizard UX hardening** — separate cluster (`docs/FOLLOW_UPS.md` § Wizard UX + A11y Hardening), not Track C.
- **User-management edit / deactivate flows** (PR-4 in `docs/FOLLOW_UPS.md`). C2 may absorb edit flows if the audit confirms scope fits; otherwise separate.
- **Server-side email infrastructure** (HIGH#5 in `docs/FOLLOW_UPS.md`) — Trigger Email extension or transport. Doesn't block Track C; the HIGH#1 client-side `sendPasswordResetEmail` path is the C2 dispatch primitive.
- **Branch-manager assignment uniqueness validation** (one branch per manager). Audit-phase decision in C1.
- **Hard delete of branches.** Soft delete only.
- **Unit hierarchy modeling.** Branches only.
- **Migration of legacy `user.branchId` strings to new collection IDs.** Tenant admins re-target via Edit User flows when those ship; no auto-migration.
- **CSV templating UI / downloadable blank template.** UX polish, post-Track-C.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing `user.branchId` strings reference legacy values not in new collection | High | Low | Fallback display continues to work; tenant admin manually re-assigns when Edit User flows ship; C1 explicitly does not block on migration |
| Branch-scoped reads (branch_manager sees own only) require either rule-level or query-level filtering | Medium | Medium | Audit confirms during C1. Likely resolved by query-level filter (existing pattern in dashboards) since rules already gate read by tenant scope |
| Bulk CSV import creates duplicate users on re-import | Low | Medium | Email uniqueness enforced at Firebase Auth (existing); bulk flow catches `auth/email-already-in-use` and labels row as "skipped" not "error" |
| Goal seeding ships before user provisioning (sequencing slip) | Medium | Low | Track C plan locks C3 after C2; audit gates the dependency check before code starts |
| Firestore path conflict with the existing `meta/{docId}` write-locked match | Low | Low | **Resolved during C1 audit (SS-1).** Original draft path `tenants/{tid}/meta/branches/{branchId}` was 5 segments — invalid Firestore document path. Corrected to `tenants/{tid}/branches/{branchId}` — sibling subcollection under tenant, no overlap with the unrelated `meta/{docId}` block. Verified via emulator regression test before C1 merges. |
| Tenant admin imports a CSV referencing branchIds from the legacy string-derived list (not the new collection) | High | Medium | C2 validation rejects rows with unknown `branchId`. Error CSV surfaces the offenders. Tenant admin fixes by either creating the missing branches in C1's UI or correcting the source CSV. |
| `personalAnnualAPI` cap (TTD 10M) too low for outlier agents | Low | Low | Audit-phase verification in C3; cap revised upward in plan if any existing personal goal exceeds 5M |
| Bulk import sequential write is too slow for large CSVs (> 200 rows) | Medium | Low | Surface during C2 audit; chunked progress UI absorbed if pilot CSV is large |
| Modal pattern from B5 doesn't transfer cleanly to C1's editor (different field set, validation shape) | Low | Low | Reuse B5's hooks (focus trap, Escape, return focus) at the primitive level; replicate the discipline, not the line-by-line markup |

---

## Reference

- Project rulebook: [`CLAUDE.md`](../CLAUDE.md) — domain rules (currency = TTD, week-start = Sunday, `parseFloat` enforced, no self-registration), workflow rules (worktree branches only, post-merge protocol, single-branch PR rule)
- Project state: [`docs/CONTEXT.md`](./CONTEXT.md) — locked decisions, active follow-ups
- Track B (v2) PRD: [`docs/design-v2-PRD.md`](./design-v2-PRD.md) — relevant for tenant-admin surfaces post-B5
- Track B (v2) implementation plan: [`docs/design-v2-implementation.md`](./design-v2-implementation.md) — structural template for this document; Track C lives as a sibling
- B5 kickoff (most recent template): [`docs/design-v2-B5-kickoff.md`](./design-v2-B5-kickoff.md) — write-path discipline gate, surprise-stop pattern
- Open follow-ups: [`docs/FOLLOW_UPS.md`](./FOLLOW_UPS.md) — Track C closes "Branches Management UI" entirely; may absorb portions of "PR-4 Edit-user flows"
- 2026 Tatil Life Agent of the Year ≈ TTD 1M — context for C3's `personalAnnualAPI` cap of TTD 10M
- HIGH#1 fix: PR #57 (`a141d9c`) — `createUser` now dispatches reset emails; C2's bulk flow inherits this primitive
- Visual mock: [`mocks/concept-4-complete.html`](../mocks/concept-4-complete.html) — tenant-admin "Branches" sidebar item exists at line 1839; the only on-screen surface is the read-only "Branch overview" card at lines 2026-2047. C1 designs the management UI from first principles using B5 patterns.
