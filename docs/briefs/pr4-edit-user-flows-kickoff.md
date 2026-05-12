# PR-4 — Edit-user flows — kickoff brief

**Status:** Second post-M-series PR. Path (A) HIGH-priority sequence, 2 of 3.
**Estimated CC effort:** 1-2 days. Single PR (may split if rules scope expands significantly).
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

Managers can currently CREATE users via UserManagementPanel but cannot EDIT existing user data. Every data fix (typo in display name, wrong phone, role change, unit reassignment, etc.) requires Firebase Console intervention. This is brittle for daily pilot operations.

PR-4 builds the edit flows so managers can fix user data within the app, gated by role-appropriate permissions.

**What this PR DOES:**
- Add edit affordances to UserManagementPanel rows
- Build edit modal/form for user fields (display name, phone, role, unit, active status)
- Apply role-gated field-level permissions (who can edit which fields on whom)
- Validate fields (email format, phone format, role transition rules)
- Use Polish-1's Toast primitive for save success/error feedback
- Use M1's ConfirmDialog for destructive actions (deactivate, role demotion)
- Update Firestore rules if needed for field-level edit permissions

**What this PR does NOT do:**
- Build audit trail infrastructure (Audit Log was removed in TA cleanup; revisit when feature is built)
- Cross-tenant user editing (platform_admin scope, separate concern)
- Email field changes (auth-keying implications — surface in Phase 3 for explicit decision)
- Password resets (separate auth flow, not in scope here)
- Bulk user editing (single-user edit only for v1)
- User deletion (deactivate-only; deletion is post-pilot consideration)

**Closures expected in PR description** (not in FOLLOW_UPS.md):
- Resolves "PR-4 edit-user flows" from post-M-series HIGH backlog

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the TA-cleanup squash commit at top.
4. Confirm clean state: `git worktree list` shows only main; surface-before-act for any stale worktrees from TA-cleanup.
5. Create worktree at `.claude/worktrees/feat-pr4-edit-user-flows` on branch `feat/pr4-edit-user-flows`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

Design-heavy discovery. Permission model + rules implications are the most important findings.

### 2a — Current UserManagementPanel

1. `src/components/admin/UserManagementPanel.jsx` (or wherever it lives) — read in full. Capture:
   - File path
   - Current user list rendering
   - Existing row interactions (view? click-through?)
   - Whether any edit affordance exists today (probably none)
   - Inline toast pattern (audit found this; will migrate to Polish-1's primitive)
   - How users are loaded (service call, hook, etc.)

### 2b — User data model

1. `src/services/userService.js` — read in full. Capture:
   - User document shape (fields, types, optional vs required)
   - Existing CRUD functions (getUsers, createUser, etc.)
   - Whether updateUser or similar exists
   - Tenant scoping (how is `tenantId` enforced today)
2. Confirm field list — likely includes:
   - `displayName`, `email`, `phone`, `bio`
   - `role`, `unitId`, `branchId`
   - `active` (boolean)
   - `createdAt`, `updatedAt`
   - Auth-keyed fields (email is likely auth-keyed and shouldn't be edited via user doc — surface in Phase 3)

### 2c — Current Firestore rules for user docs

1. `firestore.rules` (or wherever rules live) — find the rules block for `users` collection. Capture:
   - Read permissions (who can read which user docs)
   - Write permissions (who can write which fields)
   - Current scope: probably allows manager roles to write within tenant
   - Field-level granularity: probably NOT enforced (full doc write or nothing)
2. **This is the critical security finding.** If rules currently allow any tenant manager to write any field on any user doc within tenant, that's a permission gap. PR-4 should either:
   - (a) Add field-level rules (e.g., agents' role can only be changed by branch_manager+)
   - (b) Enforce at application layer only (simpler but weaker — relies on UI not bypassing)
   - Surface the security gap and proposed approach in Phase 3

### 2d — Existing user-creation pattern

1. Find the user-creation flow (per memory, `createAgentAccount` wrapper was deleted; manager-created accounts only). Capture:
   - How the create form is structured (modal? inline? wizard?)
   - Which fields are required at creation
   - How role assignment works at creation
   - Existing validation patterns to mirror in edit
2. PR-4's edit form should match the create form's UI pattern for cohesion (modal vs inline).

### 2e — Existing patterns to reuse

- M1's SaveButton — already in use, expected for edit-save action
- M1's ConfirmDialog — required for destructive actions
- Polish-1's Toast — required for save feedback (success + error)
- M1's TabPills — possible if edit form has multiple sections
- M1's Avatar — already in use for user rows

---

## Phase 3 — Design + scope surface (STOP HERE — critical design + security gate)

Output a structured surface covering:

```
DISCOVERY — PR-4 edit-user flows

CURRENT STATE:
- UserManagementPanel: <path:line summary>
- User data model: <field list with types>
- Existing update function: <yes/no, signature>
- Inline toast pattern in panel: <yes/no — migration to Polish-1 Toast required>

CURRENT FIRESTORE RULES FOR USERS:
- Read: <who can read what>
- Write: <who can write what, with what field-level granularity>
- SECURITY GAP: <if any — be explicit>

PROPOSED PERMISSION MATRIX:

| Editor Role | Target Role | Editable Fields | Restricted Fields |
|-------------|-------------|-----------------|-------------------|
| unit_manager | agent (in their unit) | displayName, phone, bio | role, unitId, branchId, active, email |
| branch_manager | agent | displayName, phone, bio, unitId, active | role (above agent), branchId, email |
| branch_manager | unit_manager (in their branch) | displayName, phone, bio, unitId, active | role, branchId, email |
| sales_manager | (per current role recognition — likely same as branch_manager) | | |
| tenant_admin | any user in tenant | all fields except email | email |
| platform_admin | OUT OF SCOPE | | |

NOTE: "all fields except email" — email changes are auth-keyed and require auth flow, not user doc edit. Confirm with Kelsean whether PR-4 includes email editing (separate auth flow) or defers entirely.

UI PATTERN (proposed):
- Edit affordance: <icon button on user row / "Edit" action menu / row click opens edit modal>
- Edit form: <modal vs inline expanded row vs dedicated page>
- Field grouping: <if multiple sections, use TabPills>
- Recommendation: <one approach with rationale>

VALIDATION SPECS:
- displayName: required, min 2 chars
- email: required at create, NOT editable post-create (auth-keyed)
- phone: optional, format TT (+1 868 XXX XXXX) or local 868XXXXXXX
- role: dropdown of allowed transitions per editor role
- unitId: dropdown of branches/units the editor has access to
- active: boolean toggle, ConfirmDialog required for deactivation

DESTRUCTIVE ACTIONS:
- Deactivate user: ConfirmDialog "Deactivate {name}? They will lose access immediately."
- Role demotion (e.g., branch_manager → agent): ConfirmDialog "Demote {name} from {oldRole} to {newRole}? They will lose admin access immediately."
- Both fire Toast on success/error

TOAST WIRING:
- Save success: toast.show({ message: '{Name} updated', variant: 'success' })
- Save error: toast.show({ message: 'Update failed: {reason}', variant: 'error' })
- Validation error (client-side): inline error display in form, no toast

RULES UPDATES NEEDED:
- <list specific changes needed, OR confirm rules already enforce desired field-level permissions>
- If rules updates needed: surface as SECURITY-SENSITIVE in PR description; require explicit security review

NEW / MODIFIED COMPONENTS:
- UserManagementPanel.jsx — add edit affordance, integrate edit modal/form, migrate to Toast primitive
- NEW: EditUserModal.jsx (or similar) — edit form
- NEW: src/services/userEditService.js OR extend src/services/userService.js with updateUser function
- firestore.rules — field-level user write rules (if needed per Phase 2 finding)
- Test files: RTL coverage for edit form + permission matrix
- Smoke script: PR-4 smoke walk

SCOPE ESTIMATE:
- Files modified: <count>
- New files: <count>
- Rules updates: <yes/no, scope>
- Total file count: <under 30 ceiling>

SHOULD PR-4 BE SPLIT?
- PR-4a (non-role edits — displayName, phone, bio, active): smaller scope, lower security risk
- PR-4b (role + unitId edits — permission-sensitive): higher security risk, separate review
- Recommendation: <single PR or split based on Phase 2 findings>

OPEN QUESTIONS FOR KELSEAN:
- Email editing — included via separate auth flow, or deferred entirely?
- Permission matrix — confirm proposed cells or override
- UI pattern — modal vs inline vs page?
- Rules updates — confirm scope; security-sensitive changes require explicit approval
- Split PR-4a / PR-4b for risk staging — recommend yes/no?
- Existing inline toast in UserManagementPanel — migrate in this PR, or defer to Polish-2 sweep?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the permission matrix
- Approve UI pattern
- Decide on rules changes (security-sensitive — explicit review)
- Confirm email handling
- Decide on PR split
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **Rules updates first (if any)** — security-sensitive, validate carefully before any consumer code touches Firestore
2. **userEditService.js (or updateUser function)** — backend logic, validation, error handling
3. **EditUserModal.jsx** — the edit form component
4. **UserManagementPanel integration** — edit affordance + modal wiring
5. **Toast migration** — replace inline toast pattern with Polish-1 primitive (if Phase 3 approved)
6. **ConfirmDialog for destructive actions** — wire deactivate + role demotion confirmations
7. **Tests** — RTL coverage for edit form + permission matrix + validation

**Constraints (carry over):**
- Use M1 primitives (SaveButton, ConfirmDialog, Avatar, TabPills if needed)
- Use Polish-1 Toast for save feedback
- Use existing Nexus tokens — no new ones
- 44px touch targets
- Dark mode parity
- `prefers-reduced-motion` respected
- Functional components, useMemo/useCallback
- A11y baseline: form labels, error announcements via aria-live, focus management on modal open/close

**Rules constraints:**
- NEVER weaken existing rules
- Field-level rules require explicit testing (Firestore rules emulator if available; otherwise document the rules diff for security review)
- Each rule addition should have a clear justification mapped to the permission matrix

---

## Phase 5 — Tests

Required coverage:

**Permission matrix tests:**
- unit_manager cannot edit role or branchId on agents
- branch_manager cannot edit branchId on anyone
- tenant_admin can edit all fields except email

**Validation tests:**
- displayName: required, min 2 chars enforced
- phone: format validation
- role: dropdown shows only allowed transitions per editor role
- deactivation: ConfirmDialog fires

**Integration tests:**
- Edit modal opens with current user data prepopulated
- Save fires updateUser with correct payload
- Save success fires success toast + closes modal
- Save error fires error toast + leaves modal open + preserves user input

**Rules tests (if rules updated):**
- Use Firestore rules emulator if set up
- Otherwise document the rules diff explicitly in PR description for manual security review

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

1. **Edit affordance verification:**
   - Sign in as branch_manager (use A11Y_SALES_MANAGER_EMAIL or properly-roled account)
   - Navigate to user management
   - Edit affordance visible on each user row
   - Click edit on an agent → edit modal opens with prepopulated data
   - Capture screenshots at desktop + mobile, light + dark

2. **Edit save round-trip (write-read-verify):**
   - Change a non-critical field (e.g., displayName from "Test User" to "Test User Updated")
   - Click Save → success toast appears → modal closes
   - **Hard reload the page** → verify the change persisted
   - Edit again, reset to original value
   - This is the substantive functional gate — proves the save round-trip works end-to-end

3. **Permission matrix verification:**
   - As a unit_manager (use A11Y_AGENT_EMAIL or test account if available), verify edit affordance:
     - Visible on agents in their unit
     - NOT visible (or disabled) on managers above their level
     - Role dropdown does NOT show "branch_manager" as an option

4. **Destructive action verification:**
   - As tenant_admin (use A11Y_TENANT_ADMIN_EMAIL from TA-cleanup PR), attempt to deactivate a test user
   - ConfirmDialog appears with appropriate copy
   - Cancel → no change
   - Confirm → user deactivated → toast fires → user list updates
   - Reactivate to restore state

5. **Validation verification:**
   - Attempt to save with empty displayName → inline error displayed, save blocked
   - Attempt invalid phone format → inline error displayed

6. **Other dashboards regression sweep:**
   - Manager portal (Overview, Awards, Goals, Persistency) — all still render normally
   - TA Dashboard (post-cleanup state) — still renders normally
   - Agent portal — still renders normally

### Smoke gates

- Edit affordance renders for permitted roles only
- Save round-trip works (write + reload + verify)
- Permission matrix enforced at UI level (smoke covers UI; rules tests cover backend)
- ConfirmDialog fires for destructive actions
- Validation blocks invalid input
- No console errors
- No regression on other surfaces

If smoke fails:
- Save round-trip fails: STOP and surface (data layer or rules issue)
- Permission matrix violation: STOP and surface (security implication)
- Other issues: fix in scope or surface per severity

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization (logical chunks):
   - `feat(security): update users collection rules for field-level edit permissions` (if rules changed)
   - `feat(users): add updateUser service function with validation`
   - `feat(users): EditUserModal component with role-gated field permissions`
   - `feat(users): UserManagementPanel edit affordance + modal wiring`
   - `refactor(users): migrate inline toast to Polish-1 Toast primitive` (if Phase 3 approved)
   - `test(users): RTL coverage for edit flows + permission matrix + validation`
5. Push, open PR titled: `feat(users): PR-4 — edit-user flows + permission matrix`
6. PR description MUST include:
   - **Summary:** managers can now edit user data within the app instead of Firebase Console
   - **Closes:** PR-4 edit-user flows from post-M-series HIGH backlog
   - **Permission matrix** (verbatim from Phase 3 approval)
   - **Rules changes (if any):** explicit before/after diff with security-review-required label
   - **Email field decision** (whether included or deferred)
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Path (A) progress: 2/3 HIGH items closed**
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals user doc schema is significantly different from expected → SURFACE
- Phase 3 permission matrix requires rules changes that exceed simple field-level controls → SURFACE; may need rules-engineer review pattern
- Phase 4 rules updates fail Firestore rules tests → STOP; security-sensitive failures need explicit fix
- Phase 6 save round-trip fails → STOP and surface (data layer or rules)
- Phase 6 permission matrix violation found → STOP and surface (security implication)
- Email editing introduces auth-flow complexity → SURFACE; may defer email handling entirely
- Any source code changes outside Users domain → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- Audit trail infrastructure (Audit Log was removed in TA cleanup; revisit when feature is built)
- Cross-tenant user editing (platform_admin scope)
- Password resets (separate auth flow)
- Bulk user editing
- User deletion (deactivate-only)
- Branches Mgmt UI (separate HIGH PR)
- Wizard UX hardening (separate HIGH PR)
- Other manager portal screens
- Updating `docs/FOLLOW_UPS.md`

---

## What success looks like

After this PR merges:

1. Managers can edit user data within the app for daily ops fixes
2. Role-gated permissions prevent privilege escalation via the UI (and via rules if updated)
3. Validation prevents invalid data from reaching Firestore
4. Save feedback uses Polish-1's Toast primitive — cohesive across app
5. Destructive actions (deactivate, role demotion) require explicit confirmation
6. Firebase Console intervention is no longer required for routine user data fixes
7. Path (A) progress: 2/3 HIGH items closed; Wizard UX + A11y hardening next

This PR closes the biggest operational gap remaining before pilot launch. Once shipped, managers can run daily user-management tasks within the app.
