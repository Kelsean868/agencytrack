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

### Goal
Tenant Admin uploads a CSV of users (`email,name,role,branchId`) and the app creates them in bulk via the existing `createUser` callable (post-HIGH#1 fix in PR #57, which now dispatches password-reset emails). Per-row validation, per-row error reporting, downloadable error CSV for re-import. Idempotent on email collisions.

### Dependency
**C1 must merge first.** CSV `branchId` values reference C1's collection. Validation rejects rows whose `branchId` doesn't match an active branch.

### Files (starting hypotheses — audit confirms during C2)

**Create:**
- `src/components/admin/BulkUserImportModal.jsx` — multi-step modal. Step 1: drop / upload CSV. Step 2: preview first 5 rows + row-count summary. Step 3: progress UI ("Created 7 of 50 — 1 failed: row 12 invalid email"). Step 4: result summary with download-error-CSV affordance.

**Modify:**
- `src/services/agentManagementService.js` — extend with a thin batch wrapper that re-uses the existing `createUser` callable per row. Sequential, not parallel — Firestore + Auth quotas are conservative, and per-row error reporting needs deterministic ordering. Returns `{ rowIndex, success, uid?, emailSent?, error? }` for each row.
- `src/components/admin/UserManagementPanel.jsx` — add "Import Users" button next to existing "Add User" button.

### CSV contract
- Required headers: `email`, `name`, `role`, `branchId`. Other columns ignored (forward-compatible).
- Row-level validation:
  - `email` — RFC-ish format check + Firebase Auth uniqueness check (handled by callable; collision = skip row, not error)
  - `name` — non-empty after trim
  - `role` — one of `agent`, `unit_manager`, `branch_manager`, `sales_manager`. **Tenant Admin and Platform Admin are NOT bulk-importable** (creation requires elevated checks; surface as inline guard)
  - `branchId` — must reference an active branch in `tenants/{tid}/branches` (via C1's collection). Inactive or unknown branchId = row error, not silent acceptance.

### Acceptance criteria
- [ ] CSV upload accepts the required headers (case-insensitive); other columns ignored
- [ ] Per-row validation runs before any write; rows with errors are NOT submitted to `createUser`
- [ ] Progress UI updates row-by-row during processing (sequential, with `aria-live="polite"` announcements)
- [ ] On any per-row failure, a downloadable error CSV is produced — same headers as input plus an `error` column with a specific message ("invalid email", "branchId not found", "createUser callable failed: ..."). Admin can fix and re-import.
- [ ] Successfully-created users get reset emails dispatched per the HIGH#1 path (PR #57)
- [ ] Idempotency — re-importing a CSV with existing emails skips them (the callable already throws on duplicate; bulk flow catches and labels the row as "skipped: email already exists" rather than "error")
- [ ] 8-cell preview matrix for `tenant_admin` (4 breakpoints × 2 themes) covering: empty state, file picked but not yet validated, preview state, mid-progress, all-success, partial-failure with downloadable error CSV, all-failure
- [ ] Modal a11y: focus trap, Escape cancels (only when not mid-write), live-region progress announcements, `role="dialog"` + `aria-modal` + `aria-labelledby`
- [ ] `npm run lint && npm run build` exits 0

### Out of scope (for C2)
- **User edit flows** (PR-4 Edit-user flows in `docs/FOLLOW_UPS.md`). Audit-phase decision: surface whether C2's scope can absorb these without bloating the PR; default is "keep separate."
- **Deactivate / reactivate flows.** Already exist in `UserManagementPanel.jsx` from earlier work; no changes in C2.
- **Bulk reset-email retry after import.** Single dispatch only per row; per-row Retry handled via the downloadable error CSV (admin fixes and re-imports).
- **CSV templating UI** (downloadable blank template). Defer to a UX hardening pass.
- **Real-time CSV format detection** (e.g., transparent semicolon-delimited support). MVP requires standard comma-separated UTF-8.
- **Tenant Admin / Platform Admin role bulk-import.** Out of scope for C2; explicitly rejected at the validation layer.

### Rollback
Revert the C2 commit. Remove the "Import Users" button. The existing single-user `createUser` flow is untouched.

---

## PR C3 — 2026 Personal Annual API Goals Seeding

### Goal
Tenant Admin sets per-agent personal annual API goals for 2026. Either single-user via UI or bulk via CSV (audit-phase decision — default recommendation: single-user UI in C3, bulk CSV deferred unless the pilot's user count makes single-user untenable).

### Dependency
Can ship in parallel with C2 if both are independently testable. Recommend sequencing **after C2** so the goals seed against users that already exist (avoids the awkward "set goals for users you haven't created yet" sequencing).

### Files (starting hypotheses — audit confirms during C3)

**Create:**
- `src/components/admin/GoalsSeederModal.jsx` — per-agent target editor. Search / select agent, enter `personalAnnualAPI` value for `2026`, save. Reuses B5's modal patterns end-to-end.

**Modify:**
- `src/services/goalsService.js` — extend with `setPersonalAnnualAPI(agentId, year, value)` if it doesn't already exist. Audit-phase deliverable: confirm the existing write helper signature in `goalsService.js` and either reuse or add the smallest possible new helper.

### Validation rules (mirror B5's `companyMinimums` discipline)
- Numeric. `parseFloat` enforced before write. Never stored as string.
- `> 0`. Zero or negative values rejected client-side and at the rules layer.
- `≤ TTD 10,000,000`. Mirrors B5's `companyMinimums.annualAPI` upper bound for consistency. Audit-phase: confirm the cap is at least 2× the highest observed `personalAnnualAPI` in the pilot tenant. Agent-of-the-Year achievement targets in TTD ~1M historically — 10M cap is comfortably higher.
- TTD currency display via existing `formatCurrency()` from `formatters.js`. Raw number written.
- Required field — empty submit blocked.
- **Firestore rules MUST also enforce these constraints.** If the existing `goals` write path in rules doesn't restrict `tenant_admin` (or branch_manager + above per the existing matrix), surface as a SECURITY surprise-stop during C3 audit.

### Confirmation copy (locked)
> "Setting personal annual API for **{agent name}** to **TTD {amount}** for 2026. This affects the agent's goal hierarchy floor — they can override upward with their own personal commitment, but can't go below this." Save / Cancel.

### Acceptance criteria
- [ ] Tenant Admin can set `personalAnnualAPI` for any agent in their tenant for `year: 2026`
- [ ] Stores under the existing `tenants/{tid}/users/{uid}/goals/{year}` document pattern (audit-phase confirms the exact path — `goalsService.js` arbitrates)
- [ ] Validation: numeric, `parseFloat`, `> 0`, `≤ 10000000`, required
- [ ] Confirmation modal shows agent name + amount in formatted TTD before write commits
- [ ] Save flow: pre-write read of current goal (if any), display delta in confirmation, write `updatedBy` + `updatedAt`, close modal on success only
- [ ] Save failure paths surface specific errors (permission denied, network failure, validation error) — modal stays open
- [ ] 8-cell preview matrix for `tenant_admin` (4 breakpoints × 2 themes)
- [ ] Modal a11y: focus trap, Escape, return focus, live-region for save errors
- [ ] `npm run lint && npm run build` exits 0

### Out of scope (for C3)
- **Phase 9 Sales Manager Target layer** (the 5-layer goals system completion per CLAUDE.md). Defer to post-pilot.
- **Quarterly goals.** Only annual `personalAnnualAPI` in C3.
- **Persistency goals editing.** Deferred from B5; remains deferred in C3.
- **Apps-count goal seeding.** B5's `companyMinimums` fallback already includes `annualApps` defaults; agent-level apps goals derive from elsewhere. Not seeded in C3.
- **Bulk CSV goals upload.** Audit-phase decision — default is "single-user UI only in C3, bulk deferred."
- **Goal editing UI for agents themselves.** Already exists via `CareerPortal.jsx` "Edit My Goals" — out of scope for C3.

### Rollback
Revert the C3 commit. Drop the new files. `goalsService.js` extension is additive; no read-path regression risk.

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
