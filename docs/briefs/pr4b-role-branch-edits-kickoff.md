# PR-4b — Role + branchId edits via updateUser Cloud Function — kickoff brief

**Status:** Second MEDIUM post-M-series PR. Path (A) MEDIUM queue, 2 of 4. Implicit follow-up from PR-4.
**Estimated CC effort:** 1-2 days. Single PR (may split based on Phase 3 audit trail decision).
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

PR-4 (PR #122) shipped edit-user flows for non-claim-keyed fields (name, phone, bio, unitId, etc.) plus the critical security fix tightening Firestore rules to enforce field-level write permissions. Role + branchId edits were deferred to PR-4b because they require:

- **Claim-refresh atomicity** — Firestore doc fields AND Firebase Auth custom claims must update together (otherwise UI shows new role but server enforcement uses old role, or vice versa)
- **Token revocation policy** — when a user's role changes, their existing session has the old role in its JWT until token refresh (default 1 hour); the user retains old permissions until then. Decide: revoke immediately (force re-login) or wait for natural refresh?
- **Permission matrix for role transitions** — who can promote/demote whom? (e.g., can a branch_manager demote a unit_manager to agent? can they promote an agent to unit_manager?)
- **Cross-branch implications** — changing branchId reassigns a user across the org structure; their submissions, goals, persistency records stay tied to old branchId or migrate?

This brief closes the user-edit chapter completely. After PR-4b, managers can fix all aspects of user data within the app — no Firebase Console workarounds remain for routine ops.

**What this PR DOES:**
- Build a new `updateUser` Cloud Function with admin-SDK privileges
- CF atomically updates Firestore doc + Firebase Auth custom claim for role/branchId changes
- CF enforces a server-side permission matrix mirroring PR-4's UI-level matrix
- Extend EditUserDrawer to show role + branchId fields (role-gated visibility)
- Wire reassignment ConfirmDialog with appropriate copy for role changes (more weight than unitId reassignment)
- Token revocation policy implemented per Phase 3 decision
- Toast feedback on success (using Polish-1 primitive) + error states

**What this PR does NOT do:**
- Build audit trail infrastructure (separate scope; Audit Log nav was removed in TA cleanup, will be re-added when feature is built)
- Cross-tenant user reassignment (platform_admin scope, separate concern)
- User notification flows (email to user when their role changes — post-pilot consideration)
- Bulk role changes (single-user only for v1)
- Email field changes (still deferred — auth-keyed)

**Closures expected in PR description** (not in FOLLOW_UPS.md):
- Resolves PR-4b deferral from PR-4 (role + branchId via updateUser CF)
- Implements server-side permission matrix complement to PR-4's UI-level matrix

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the Polish-2 squash commit at top.
4. Confirm clean state: `git worktree list` shows only main + the stale TA-cleanup filesystem residue (leave alone).
5. Create worktree at `.claude/worktrees/feat-pr4b-role-branch-edits` on branch `feat/pr4b-role-branch-edits`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

Discovery is design-heavy. The Cloud Function design + token revocation policy are the main calls.

### 2a — Existing Cloud Functions patterns

1. `functions/index.js` — read in full. Capture:
   - createUser CF pattern (signature, validation, error handling, claim setting, response shape)
   - deactivateUser CF pattern (signature, side effects including revokeRefreshTokens)
   - setUserClaims CF pattern (tenant_admin/platform_admin scoped)
   - Common error patterns + response shapes
   - admin SDK imports and how they're used
2. **The updateUser CF should mirror createUser's shape** (validation, auth gating, error handling, audit fields).

### 2b — Firebase Auth claim mechanics

1. Find how custom claims are currently set (likely in createUser via `admin.auth().setCustomUserClaims(uid, { tenantId, role, branchId, ownedBranchIds })`)
2. Capture the claim shape — confirm fields stored as claims (likely: tenantId, role, branchId, ownedBranchIds)
3. Find where claims are read on the client (likely useAuth or AuthContext) — confirm the refresh mechanism on the client side (forceRefresh: true after server claim change)

### 2c — Existing edit-user infrastructure

1. `src/components/manager/EditUserDrawer.jsx` (from PR-4) — read in full. Identify:
   - How the drawer renders currently
   - Where role + branchId would slot in
   - PR-4 currently renders them as read-only labels with "Contact tenant_admin" footnote — this needs to become editable per the permission matrix
2. `src/services/userService.js` updateUserFields wrapper from PR-4 — confirm it currently handles non-claim fields only. The CF call for claim fields will be a separate code path.

### 2d — Permission matrix for role/branch transitions

Build the matrix from PR-4's general permission model. Role transitions are conceptually about hierarchy — generally:
- Editor can only promote/demote within or below their own level
- Editor cannot promote anyone to a level equal-to or above their own
- branchId changes typically require editor to be at branch_manager level or above with cross-branch access (tenant_admin)

Surface a complete proposed matrix in Phase 3.

### 2e — Token revocation options

Three approaches:
1. **Immediate revocation** — call `admin.auth().revokeRefreshTokens(uid)` after claim update. Forces user to re-login on next page interaction. Cleanest but disruptive.
2. **Force client refresh** — let the existing client-side code refresh the token (`user.getIdToken(true)`) but don't revoke server-side. User keeps current session but UI updates immediately. Server enforcement uses stale claim until next natural refresh (up to 1hr).
3. **Hybrid** — revoke only on role demotion (when permissions DECREASE); force-refresh-only on role promotion (when permissions INCREASE). Reduces user friction for harmless promotions while ensuring security-critical demotions revoke immediately.

Phase 3 should surface a recommendation with security tradeoffs explained.

### 2f — Race conditions to consider

- Two managers simultaneously editing the same user (Firestore optimistic concurrency via `updatedAt` check?)
- Editor edits while target user is actively using the app (token revocation handling)
- Editor edits across browser tabs (claim refresh propagation)

Surface mitigation patterns in Phase 3.

---

## Phase 3 — Design + scope surface (STOP HERE — critical design + security gate)

Output a structured surface:

```
DISCOVERY — PR-4b role + branchId edits

CURRENT CF PATTERNS:
- createUser: <signature, validation, claim-set, response>
- deactivateUser: <signature, includes revokeRefreshTokens>
- setUserClaims: <admin-only, low-level claim setter>

PROPOSED updateUser CF DESIGN:

Signature:
  updateUser({
    uid: string,
    updates: {
      role?: string,
      branchId?: string,
      // Future-extensible for other claim-keyed fields if any
    }
  })

Server-side validation:
- Caller authenticated + has appropriate role
- Target user exists in same tenant
- Permission matrix check (caller role × target role × update fields)
- Role transition validity (within hierarchy)
- branchId valid for tenant
- ownedBranchIds recomputed if role changes (e.g., promoting agent to branch_manager populates ownedBranchIds with single branchId)

Atomicity:
- Firestore doc update + Auth claim update in same try/catch
- If claim update fails after doc update, roll back doc OR retry claim (Phase 3 decide)
- audit fields stamped: updatedAt, updatedBy

Response shape: { success: true, updatedFields: [...] } | { success: false, error: '...' }

PROPOSED PERMISSION MATRIX (server-side):

| Editor Role | Target Role | Can change role to | Can change branchId |
|-------------|-------------|---------------------|---------------------|
| unit_manager | (any) | NONE | NO |
| branch_manager | agent (in their branch) | unit_manager | NO (same branch only) |
| branch_manager | unit_manager (in their branch) | agent | NO |
| sales_manager | agent | unit_manager | YES (within tenant) |
| sales_manager | unit_manager | agent, branch_manager | YES |
| sales_manager | branch_manager | unit_manager, sales_manager | YES |
| tenant_admin | (any in tenant) | any role except platform_admin | YES |
| platform_admin | (cross-tenant) | OUT OF SCOPE (separate CF) | — |

CONSTRAINTS:
- Can never promote target to platform_admin (cross-tenant role)
- Can never demote user to inactive (use deactivateUser instead)
- Role + branchId changes happen atomically — if both specified, both succeed or both rollback

TOKEN REVOCATION POLICY (Phase 3 lock):
Options:
- (a) Immediate revocation on all role/branch changes
- (b) Force-refresh-only on all changes
- (c) Hybrid: immediate on demotion, force-refresh on promotion
Recommendation: <pick one with rationale>

CONCURRENCY PROTECTION:
- Use updatedAt timestamp check (optimistic concurrency) — caller passes lastSeenUpdatedAt; CF rejects if Firestore has been updated since
- Returns conflict error with current updatedAt for client to resync

UI INTEGRATION (EditUserDrawer extension):
- Role dropdown: show only allowed transitions per editor's permission matrix
- branchId dropdown: show only branches editor has access to
- ConfirmDialog copy for role changes: "Change {Name}'s role from {oldRole} to {newRole}? They will lose their current session and need to sign in again with the new permissions." (or per token revocation policy)
- Toast on success: "{Name}'s role updated to {newRole}"
- Toast on conflict (optimistic concurrency rejection): "User was updated by someone else. Refreshing." + auto-reload

CLIENT-SIDE FLOW:
1. User clicks edit, drawer opens with current values
2. User changes role or branchId
3. SaveButton → if claim-keyed fields changed, call updateUser CF (separate code path from PR-4's direct Firestore write)
4. On success: Toast + close drawer + refresh list
5. On error: inline error + leave drawer open + preserve user input
6. On conflict: Toast + close drawer + refresh list

ERROR HANDLING:
- Permission denied (caller can't make this change): "You don't have permission to change this user's role"
- Validation error (invalid transition): "Cannot promote agent to tenant_admin directly. Promote to unit_manager first."
- Conflict (optimistic concurrency): "User was updated by someone else. Refreshing."
- Auth error: "Session expired. Please sign in again."
- Unknown: "Update failed. Please try again or contact support."

NEW / MODIFIED COMPONENTS:
- functions/index.js: NEW updateUser CF (~150-200 lines including validation + matrix + claim atomicity)
- src/services/userService.js: NEW callUpdateUser function — thin wrapper invoking the CF
- src/components/manager/EditUserDrawer.jsx: extend with role + branchId fields, permission gating, ConfirmDialog wiring
- src/components/manager/UserManagementPanel.jsx: pass lastSeenUpdatedAt for optimistic concurrency
- Firestore rules: NO CHANGES (CF uses admin SDK, bypasses rules entirely)
- Test files: RTL coverage for EditUserDrawer role/branchId flows + CF unit tests if test infrastructure exists for functions/
- Smoke script: PR-4b smoke walk

SCOPE ESTIMATE:
- Files modified: <count>
- New files: <count, including CF code may be one file or extension of index.js>
- CF LOC: ~150-200
- UI changes LOC: ~80-120
- Total file count: <under 30 ceiling>

SHOULD PR-4B BE SPLIT?
- PR-4b-a (CF + UI for role only, branchId deferred): smaller, security-sensitive review focus
- PR-4b-b (branchId edit added): expands matrix
- Recommendation: <single or split based on Phase 3 findings; default to single>

OPEN QUESTIONS FOR KELSEAN:
- Token revocation policy: (a), (b), or (c)?
- Permission matrix cells: confirm proposed cells, especially sales_manager and tenant_admin combinations
- Optimistic concurrency: include updatedAt-based conflict check, or accept last-write-wins for v1?
- Atomicity on partial failure (claim succeeds, doc fails or vice versa): retry, rollback, or accept partial state with error toast?
- Audit trail for role changes: log to a temporary collection now, defer to future audit log infrastructure, or skip entirely?
- ConfirmDialog copy for role demotion: emphasize the permission decrease specifically?
- Should the editor be prevented from editing themselves (no self-role-change)? Recommend YES — managers can't demote/promote themselves.
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the permission matrix (server-side complement to PR-4 UI matrix)
- Decide token revocation policy
- Approve atomicity strategy
- Confirm audit trail decision
- Lock ConfirmDialog copy
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **updateUser CF in functions/index.js** — server-side validation, permission matrix, atomicity, claim setting, audit fields
2. **callUpdateUser client wrapper** in userService.js — thin invocation of CF
3. **EditUserDrawer extension** — role + branchId fields, permission gating, ConfirmDialog wiring
4. **Toast integration** — success + error + conflict
5. **UserManagementPanel** — pass lastSeenUpdatedAt for optimistic concurrency
6. **Tests** — RTL coverage for new fields + CF unit tests if applicable

**Constraints:**
- Cloud Function changes require `firebase deploy --only functions` post-merge (similar to PR-4's rules deploy)
- Use Polish-1 Toast primitive for save feedback
- Use M1 ConfirmDialog for role change confirmation
- Use existing Nexus tokens
- 44px touch targets
- Dark mode parity
- A11y baseline: dropdown labels, ARIA on ConfirmDialog
- Functional components, hooks

**Critical security constraints:**
- Server-side validation is the source of truth — never trust client-side checks
- Permission matrix enforced in CF, not just UI
- Claim updates always go through admin SDK
- Optimistic concurrency check (if Phase 3 approves) prevents lost-update race
- ALL error paths logged server-side for security audit

---

## Phase 5 — Tests

Required coverage:

**CF unit tests (if test infrastructure for functions/ exists):**
- Permission matrix enforcement (each cell tested)
- Validation rejects invalid role transitions
- Atomicity: simulate claim failure after doc update, verify rollback behavior
- Optimistic concurrency: simulate stale updatedAt, verify conflict response

**UI tests:**
- EditUserDrawer role dropdown shows only allowed transitions per editor role
- branchId dropdown shows only accessible branches
- ConfirmDialog fires before role change is committed
- Toast appears on success/error/conflict
- Conflict response triggers list refresh

**Integration:**
- Edit modal opens with role/branchId prepopulated
- Save round-trip with role change works end-to-end (CF call + claim refresh + UI update)
- Save with no role/branchId change uses PR-4's direct path (verifies the split-path logic)

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

⚠️ **Token revocation testing is destructive.** If Phase 3 approves immediate revocation, real role-change smoke will sign out the smoke account. Plan accordingly:
- Use dedicated test accounts (NOT the smoke session's signed-in account)
- Or, simulate role change without committing (test the UI path, intercept the CF call)

1. **Permission matrix verification:**
   - Sign in as different role accounts (branch_manager, sales_manager, tenant_admin from A11Y_* env vars)
   - For each editor role, open EditUserDrawer on various target users
   - Verify role dropdown shows only allowed transitions per matrix

2. **Role change round-trip (with safe test account):**
   - Use a dedicated test user (NOT the smoke session's signed-in user)
   - Change role agent → unit_manager
   - Verify CF call succeeds
   - Verify Firestore doc shows new role
   - Verify (post-deploy) Firebase Auth claim updated for the user
   - If immediate revocation policy: verify user has been signed out (would need a second browser context to verify)
   - Reset role back to original

3. **branchId reassignment (with safe test account):**
   - Same pattern as role change
   - Verify Firestore + claim both updated

4. **Permission denial verification:**
   - Sign in as unit_manager
   - Verify role dropdown is NOT visible / disabled
   - Or attempt CF call directly via DevTools (should reject)

5. **Optimistic concurrency (if Phase 3 approves):**
   - Open EditUserDrawer for a user
   - In another tab, edit the same user (change name via PR-4 path)
   - Try to save the first tab's role change
   - Verify conflict toast appears + list refreshes

6. **Regression sweep:**
   - PR-4 non-claim edits still work (name, phone, bio, unitId)
   - UserManagementPanel deactivate/reactivate still works
   - Other dashboards still render normally

### Smoke gates

- Permission matrix enforced
- Role change round-trip works (doc + claim atomic)
- Token revocation policy works per Phase 3 lock
- Conflict handling works (if optimistic concurrency approved)
- No console errors
- No regression on PR-4 surfaces

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization (logical chunks):
   - `feat(functions): updateUser CF — claim-atomic role/branch updates with server-side permission matrix`
   - `feat(users): callUpdateUser client wrapper`
   - `feat(users): EditUserDrawer role + branchId fields with permission-gated dropdowns`
   - `feat(users): ConfirmDialog wiring for role + branchId changes`
   - `feat(users): Toast integration for role/branch update success/error/conflict`
   - `test(users): RTL + CF unit coverage for role/branchId edit flows`
5. Push, open PR titled: `feat(users): PR-4b — role + branchId edits via updateUser Cloud Function`
6. PR description MUST include:
   - **Summary:** completes PR-4's deferred role/branchId edit capability; closes the user-edit chapter
   - **Closes:** PR-4b deferral from PR-4 post-M-series MEDIUM backlog
   - **Permission matrix** (server-side, verbatim from Phase 3 approval)
   - **Token revocation policy** locked decision + rationale
   - **REQUIRED POST-MERGE ACTIONS** (prominent):
     - `firebase deploy --only functions` — deploys new updateUser CF
     - Verify CF is live in Firebase Console
     - Production spot-check: change a test user's role end-to-end
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Path (A) MEDIUM progress: 2/4 closed**
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals CF deployment infrastructure significantly differs from expected → SURFACE
- Phase 3 permission matrix has gaps or contradictions with PR-4's UI matrix → SURFACE
- Phase 4 atomicity implementation requires database transactions across services that aren't supported → SURFACE; may need design revision
- Phase 6 token revocation test signs out a critical account → STOP and recover
- ANY token appearance in any artifact → IMMEDIATE STOP
- Any source code changes outside Users domain + functions/ → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Audit trail infrastructure (separate scope; will be added when feature is built)
- Cross-tenant role/branch reassignment (platform_admin scope)
- User notification flows (email when role changes)
- Bulk role changes
- Email field changes (still deferred)
- Other manager portal screens
- Branches Mgmt UI (separate MEDIUM PR)
- Updating `docs/FOLLOW_UPS.md`

---

## What success looks like

After this PR merges + CF deploys:

1. Managers can change user roles + branches within the app via permission-gated UI
2. Server-side enforcement matches UI-level matrix from PR-4
3. Firestore doc + Firebase Auth claim update atomically
4. Token revocation policy implemented per Phase 3 lock
5. Optimistic concurrency prevents lost-update races (if approved)
6. The user-edit chapter is complete — Firebase Console no longer needed for any routine user operation
7. Path (A) MEDIUM progress: 2/4 closed; Branches Mgmt UI next

This PR + PR-4 together close the user-management gap entirely. Pilot launch confidence increases significantly with full user-CRUD capability inside the app.
