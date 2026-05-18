# PR-3 Claude Code Brief — Role Model + User Management Matrix + Deactivate UI

**Branch:** `pr-3-role-model-and-user-mgmt`
**Estimated work:** ~2.25 days across 6 commits
**Cadence:** Kyron checks in every ~2 hours. Work autonomously between checkpoints. Ask only at the STOP gates listed below.

---

## 0. Read these files before starting

Required reading, in order:
1. `CLAUDE.md` — project standards, hard rules
2. `Project_Analysis.md` — architecture summary
3. `firestore.rules` — current rules state
4. `functions/index.js` — current Cloud Functions, especially the PR-2 `createUser` saga around line 1337–1400
5. `src/services/agentManagementService.js` — current call site for `createAgentAccount`
6. `src/components/manager/AgentManagementPanel.jsx` — current creation UI
7. `src/firebase.js` — runtime tenantId holder pattern (SEC-9)
8. `src/context/AuthContext.jsx` — claims handling
9. `scripts/exploration-template.md` — verification checklist

Then run `repomix` to confirm your view of the codebase matches what was planned in chat. If anything has shifted since the planning session, **STOP and report back to Kyron before writing code.**

---

## 1. Goal in one paragraph

Migrate UI from `createAgentAccount` to the polymorphic `createUser` Cloud Function. Rename `super_admin` → `tenant_admin` everywhere (this is the role currently in production use). Add a new `platform_admin` role for cross-tenant operations (Kyron's "owner" hat — sits dormant until SEC-9b ships). Replace `AgentManagementPanel` with a polymorphic `UserManagementPanel` that respects the creation matrix and supports deactivation. Add unit-alias display names ("Phoenix Unit") editable by unit_managers and their upper heads. Delete the `createAgentAccount` wrapper at the end. One PR, six commits.

---

## 2. Hard workflow rules — non-negotiable

1. **Worktree branch only.** Create branch `pr-3-role-model-and-user-mgmt` via `git worktree add`. Never work on the main checkout.
2. **Never push to main.** Push to feature branch only. Kyron merges manually via the GitHub UI after preview verification.
3. **Commit per planned step.** Six commits, in order, each independently passing `npm run build && npm run lint`. If a commit can't pass both, stop and ask.
4. **Conventional commit messages.** Format: `feat(scope): summary` or `refactor(scope): summary` or `chore(scope): summary`. First line ≤ 72 chars. Body explains the why.
5. **Vercel bypass token never echoed.** Reference as `$VERCEL_BYPASS_TOKEN` from `.env.local`. Never paste the actual token into chat, commit messages, or browser URLs that get logged.
6. **Domain rules untouched.** Currency TTD, parseFloat() on numerics, Sunday week-starting validation, no self-registration. If a planned change appears to violate any of these, stop.
7. **44px touch targets, no gradient buttons, CSS vars only.** Nexus design system rules apply to all new UI.

---

## 3. Role mapping reference

| Today | After PR-3 |
|---|---|
| `super_admin` (existing claim on Kyron's account) | `tenant_admin` for `tatillife_south` (in-place rename via migration script) |
| (none) | `platform_admin` (NEW role; new account seeded; sits dormant pending SEC-9b) |
| `sales_manager`, `branch_manager`, `unit_manager`, `agent` | unchanged |

After PR-3, `super_admin` must not appear anywhere in the codebase. Repo-wide grep for `super_admin` at the end of commit 6 must return zero matches except in retired-comments / migration-script references.

### Platform admin claim shape

`platform_admin` lives outside any tenant. Claim shape:
```
{ role: 'platform_admin', tenantId: null }
```

The runtime holder in `firebase.js` throws when `tenantId` is unpopulated. For `platform_admin` sessions, do NOT bypass that throw — instead, have `AuthContext` detect the no-tenant case and route to a stub screen (commit 4). This keeps the SEC-9b refactor surface clean for later.

---

## 4. Creation + deactivation matrix

Both creation and deactivation use this matrix. Self-deactivation is hard-blocked at the Cloud Function level for all roles.

| Caller \ Target | platform_admin | tenant_admin | sales_manager | branch_manager | unit_manager | agent |
|---|---|---|---|---|---|---|
| platform_admin | ✅ | ✅ any tenant | ✅ any tenant | ✅ any tenant | ✅ any tenant | ✅ any tenant |
| tenant_admin | ❌ | ✅ own tenant | ✅ own tenant | ✅ own tenant | ✅ own tenant | ✅ own tenant |
| sales_manager | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| branch_manager | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| unit_manager | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ own unit |
| agent | ❌ across the board | | | | | |

The matrix lives in `functions/index.js` — already structured around `canCreateMatrix` from PR-2. Extend it; do not reinvent it.

---

## 5. Commit-by-commit plan

### Commit 1 — Role refactor (server side)

**Files:** `firestore.rules`, `functions/index.js`

Tasks:
1. In `firestore.rules`:
   - Replace every `getRole() == 'super_admin'` with the appropriate new check. Most become `getRole() in ['platform_admin', 'tenant_admin']`. The audit collection rule and any genuinely cross-tenant rule become `getRole() == 'platform_admin'`.
   - Update `isManager()` helper: include `platform_admin` and `tenant_admin`, exclude `super_admin`.
   - Rename audit collection match block from `auditSuperAdminCreations` to `auditAdminCreations`. Reader rule: platform_admin can read all; tenant_admin can read where the doc's tenantId equals their own.
   - In the users self-update allowlist, gate `unitName` write to unit_managers only:
     ```
     (request.auth.token.role == 'unit_manager' && hasOnly(['unitName', 'hasSeenWelcome', 'photoURL', 'bio', 'phone']))
     ||
     hasOnly(['hasSeenWelcome', 'photoURL', 'bio', 'phone'])
     ```
2. In `functions/index.js`:
   - Update `canCreateMatrix` per section 4 above
   - Update `buildClaims(targetRole, ...)` to handle `platform_admin` (no tenantId in claim)
   - Update `buildDocFields(targetRole, ...)` for both new roles
   - Update `auditSuperAdminCreations` collection writes to `auditAdminCreations`. Add a `targetRole` field to each audit doc so it's clear what was created.
   - Rename any internal helper named after `super_admin`
3. Deploy rules + functions to **dev project only** if a dev project exists. If not, do not deploy yet — wait until commit 2's migration is ready, then deploy them together.

Commit message:
```
refactor(roles): split super_admin into platform_admin + tenant_admin

- firestore.rules: rename super_admin → tenant_admin in matchers,
  add platform_admin as cross-tenant role, generalize audit
  collection to auditAdminCreations with both reader paths.
- functions/index.js: extend canCreateMatrix to cover both new
  roles, update buildClaims for platform_admin (no tenantId),
  rename audit writes.
- Self-edit allowlist now permits unit_manager to write unitName
  on their own user doc.

This commit is paired with commit 2 (claim migration). Deploy them
together — order matters (rules first, then claim migration, then
functions).
```

✅ Acceptance: `npm run build` passes; `firebase deploy --only firestore:rules` would succeed (don't actually deploy yet); rules emulator tests still pass for the unchanged-behaviour cases.

### Commit 2 — Migration script + seed scripts

**Files:** `scripts/migrate-super-admin-to-tenant-admin.cjs` (new), `scripts/seed-platform-admin.cjs` (new), `scripts/seed-first-tenant-admin.cjs` (rename from `seed-first-super-admin.cjs`)

Tasks:
1. **Migration script** `scripts/migrate-super-admin-to-tenant-admin.cjs`:
   - Reads all users in `tatillife_south` where role == 'super_admin' (expect exactly 1: Kyron, UID `4GeeZbhZBwdtGOLoJoggf4MQo142`)
   - For each match: update Firestore user doc role field to `tenant_admin`; update Firebase Auth custom claim role to `tenant_admin` (preserve all other claims); log the change
   - Idempotent: re-running finds nothing and exits cleanly
   - Has a `--dry-run` flag that prints what would change without writing
   - Has a `--confirm-production` flag required when running against prod (otherwise refuses)
   - Migrate any docs in `auditSuperAdminCreations` to `auditAdminCreations` with a `migratedFrom: 'auditSuperAdminCreations'` audit field, then delete the originals (or leave them — flag for Kyron to decide; safer to leave)
2. **Platform admin seed script** `scripts/seed-platform-admin.cjs`:
   - Placeholder email: `kyron+platform@gmail.com` (string at top of file, clearly marked `// EDIT BEFORE RUNNING`)
   - Creates Firebase Auth user with that email + a temporary password (generates a 32-char random string, prints to stdout once, never logs after)
   - Sets custom claim `{ role: 'platform_admin', tenantId: null }`
   - Does NOT create a Firestore user doc under any tenant — platform_admin lives outside tenants
   - Writes an entry to `auditAdminCreations` with `targetRole: 'platform_admin'`, `tenantId: null`, `createdBy: 'seed-script'`
   - Idempotent: refuses to re-run if a platform_admin already exists with that email
3. **Rename** `seed-first-super-admin.cjs` → `seed-first-tenant-admin.cjs`. Update role string to `tenant_admin` and any comments referencing super_admin. This script is for seeding new tenants going forward.
4. **Sensitive files reminder:** these scripts use the Admin SDK and should never commit `service-account-key.json`. Confirm `.gitignore` still excludes it.

Commit message:
```
feat(scripts): role migration + platform admin seed

- migrate-super-admin-to-tenant-admin.cjs: idempotent in-place
  rename of existing super_admin claims/docs to tenant_admin.
  --dry-run + --confirm-production flags for safety.
- seed-platform-admin.cjs: provisions Kyron's owner hat. Email
  is a placeholder at the top of the file; edit before running.
  No Firestore user doc — platform_admin lives outside tenants.
- seed-first-super-admin.cjs renamed to
  seed-first-tenant-admin.cjs for new-tenant onboarding going
  forward.

Run order on production:
  1. firebase deploy --only firestore:rules,functions
     (deploys commit 1)
  2. node scripts/migrate-super-admin-to-tenant-admin.cjs
     --confirm-production
  3. (optional, when Kyron is ready) edit
     seed-platform-admin.cjs to set real email, then run.
```

🛑 **STOP GATE 1 — before running migration on production.** When commits 1 and 2 are pushed and Vercel preview is green, stop and report to Kyron. Do not run the migration script against production until Kyron explicitly approves. Run against preview Firestore first to verify behaviour. The risk: bad migration locks Kyron out of his own app.

### Commit 3 — Service-layer migration + UI label updates

**Files:** `src/services/agentManagementService.js`, `src/App.jsx`, `src/utils/formatters.js`, plus any component with hard-coded role strings

Tasks:
1. In `agentManagementService.js`:
   - `createAgent(agentData)` keeps its export signature but internally calls `createUser` with `{ ...agentData, role: 'agent' }` — behaviour identical for the existing call site
   - Add new export `createUser(userData)` — typed wrapper around `httpsCallable('createUser')`. Accepts `{ role, name, email, ...roleSpecificFields }`. No defaulting of role.
   - Add new export `deactivateUser(userId, active)` — wrapper around `httpsCallable('deactivateUser')`. `active: false` deactivates, `active: true` reactivates.
   - Add new export `getAllUsers({ includeInactive = false })` — replaces narrow `getAgentsForUnit` for the new panel. Filters by current tenantId via the runtime holder. Excludes provisioning. Optionally excludes inactive.
   - **Do not delete `createAgent` yet** — that's commit 6.
2. In `App.jsx`:
   - `MANAGER_ROLES` constant now includes `platform_admin`, `tenant_admin`, `sales_manager`, `branch_manager`, `unit_manager`. Excludes `super_admin`.
   - Any hard-coded `'super_admin'` string updated to either `'platform_admin'` or `'tenant_admin'` based on intent (most are `tenant_admin`)
3. In `formatters.js`:
   - `getRoleLabel('platform_admin')` → 'Platform Admin'
   - `getRoleLabel('tenant_admin')` → 'Tenant Admin'
   - Existing labels for the four internal roles unchanged
4. Repo-wide grep for `'super_admin'` and `super_admin` (with and without quotes). Each match: classify as either (a) user-facing role check that should become tenant_admin, (b) cross-tenant capability check that should become platform_admin, (c) historical comment that's fine to leave. Update (a) and (b). Document (c) in commit message.

Commit message:
```
refactor(ui): wire UI to new role names + polymorphic createUser

- agentManagementService: createAgent now calls createUser({
  ...data, role: 'agent' }) — behaviour preserved. New typed
  wrappers for createUser and deactivateUser. New getAllUsers
  helper for the upcoming polymorphic panel.
- App.jsx MANAGER_ROLES: platform_admin + tenant_admin replace
  super_admin.
- formatters.getRoleLabel: human-readable labels for both new
  roles.
- Repo-wide sweep of 'super_admin' string references —
  reclassified per intent.

Behaviour change: none for end users. The CreateAgentDrawer
flow is bit-for-bit identical from the user's perspective.
```

✅ Acceptance: existing test agent creation flow (kelsean@gmail.com path) still works on preview. `npm run build && npm run lint` clean. Repo grep for `'super_admin'` returns only pre-classified historical comments.

### Commit 4 — Polymorphic User Management UI

**Files:** rename `src/components/manager/AgentManagementPanel.jsx` → `src/components/manager/UserManagementPanel.jsx`. Update imports in `App.jsx`. Update nav label.

Tasks:
1. Rename the file. Inside, rename the default export `AgentManagementPanel` → `UserManagementPanel`. Rename internal `CreateAgentDrawer` → `CreateUserDrawer`.
2. **Role selector in `CreateUserDrawer`** — filter by caller's role per section 4 matrix. When the caller is unit_manager, selector is hidden and locked to `agent` (preserves existing UX exactly).
3. **Conditional fields per target role:**
   - agent: name, email, agentNumber, unitId (dropdown of unit_managers), contractStartDate
   - unit_manager: name, email, unitId (the unit_manager's own UID becomes the unitId after creation; field is the optional **Unit Name** input, e.g. "Phoenix Unit"), branchId (dropdown of branches; auto-locked if caller is branch_manager)
   - branch_manager: name, email, branchId (auto-locked if caller is branch_manager — they create within their own branch)
   - sales_manager: name, email — no scoping field
   - tenant_admin: name, email — no scoping field; warning banner: "Tenant admin has full power within this company. Assign carefully."
   - platform_admin: only platform_admin can create. Warning banner: "Platform admin has cross-tenant access. This role is rare — confirm intent." Same fields as tenant_admin but tenantId in claim is null.
4. **Validation rules per role** mirror what `validate()` enforces in the Cloud Function. Fail fast in UI before the CF call.
5. **Branch / unit dropdowns** — derive from existing user docs:
   - Unit dropdown: query users where role == 'unit_manager', exclude provisioning, exclude inactive. Display via `getUnitDisplayName()` (added in commit 5; for commit 4 use a temporary inline fallback to manager name + "'s Unit").
   - Branch dropdown: distinct branchId across users where role == 'branch_manager', exclude provisioning, exclude inactive. Display name = the branch_manager's name. (Single branch today.)
6. **Main panel list:** show all users in caller's scope via `getAllUsers()`. Columns: avatar, name, email, role, unit (or "—"), status (Active/Inactive), actions. Default filter: Active only. Toggle to show inactive (commit 6).
7. **AuthContext stub for platform_admin:** when authenticated user has `role == 'platform_admin'` and `tenantId == null`, do NOT call `setRuntimeTenantId` and do NOT load tenant-scoped data. Render a stub screen: "Platform Admin features ship in SEC-9b. Sign in as your tenant admin account to continue." Provide a sign-out button.
8. **Nav label:** change "Agent Management" to "User Management" in `App.jsx`.

Commit message:
```
feat(user-mgmt): polymorphic User Management panel + matrix UI

- AgentManagementPanel → UserManagementPanel; CreateAgentDrawer
  → CreateUserDrawer.
- Role selector filtered by caller per the creation matrix.
  unit_manager UX preserved (selector hidden, locked to agent).
- Conditional fields per target role: agent (existing 5
  fields), unit_manager (+ unit name + branch), branch_manager
  (branch only), sales_manager, tenant_admin, platform_admin.
- Branch / unit dropdowns derive from user docs — no
  dependency on tenants/{id}/meta (which may not be populated).
- AuthContext: graceful stub for platform_admin sessions
  (no tenantId in claim → renders "wait for SEC-9b" screen
  instead of crashing).
- Nav label: Agent Management → User Management.

No behaviour change for unit_manager creating agents. New
capability for branch_manager+ to create higher roles.
```

✅ Acceptance: a tenant_admin caller sees the full role selector. A unit_manager sees the same UX as before. Conditional fields appear/disappear correctly. Branch / unit dropdowns populate from real data. Platform_admin login does not crash.

### Commit 5 — Unit aliases

**Files:** `firestore.rules` (allowlist tweak), `src/utils/formatters.js`, `src/components/profile/ProfileScreen.jsx`, plus the nine display surfaces

Tasks:
1. **Add `getUnitDisplayName(unitManagerDoc)` to `formatters.js`:**
   ```javascript
   export const getUnitDisplayName = (unitManagerDoc) => {
     if (!unitManagerDoc) return 'Unknown Unit';
     if (unitManagerDoc.unitName?.trim()) return unitManagerDoc.unitName.trim();
     const name = unitManagerDoc.name || unitManagerDoc.displayName || 'Unit Manager';
     return `${name}'s Unit`;
   };
   ```
2. **ProfileScreen:** add an editable "Unit Name" input, visible only when logged-in user has `role == 'unit_manager'`. Optional, max 50 chars, trimmed before save. Empty string is valid (unsets the alias). Save through the existing self-update path (firestore rules allow it now after commit 1).
3. **Apply across nine display surfaces** — for each, replace any inline "unit" string composition with `getUnitDisplayName()`:
   - `src/components/dashboard/AgentDashboard.jsx`
   - `src/components/dashboard/ManagerDashboard.jsx` (and `CompliancePanel` if separate)
   - `src/components/manager/MasterSheet.jsx`
   - `src/components/manager/MeetingMode.jsx`
   - `src/components/manager/GoalsPanel.jsx` (UnitGoalsTab)
   - `src/components/gamification/Leaderboard.jsx`
   - `src/components/campaigns/CampaignPanel.jsx` (scope display)
   - `src/components/manager/UserManagementPanel.jsx` (the unit column + the unit dropdown)
   - The `CreateUserDrawer` "Unit" dropdown labels (replace the temporary fallback from commit 4)
4. **CreateUserDrawer enhancement:** when target role is `unit_manager`, the optional "Unit Name" field already added in commit 4 now persists to `unitName` on the new user's doc. Backend (`buildDocFields` in functions/index.js) already accepts arbitrary fields — confirm `unitName` flows through.
5. Repo-wide grep for inline strings matching patterns like ``${X}'s Unit``, `Unit ${X}`, `unitId` displayed as raw UID, etc. Catch leftover surfaces.

Commit message:
```
feat(unit-aliases): display names for units, editable by their
unit_managers and upper heads

- formatters.getUnitDisplayName(unitManagerDoc): canonical
  helper. Returns unitManagerDoc.unitName if set, else
  "{managerName}'s Unit" fallback.
- ProfileScreen: optional "Unit Name" input, visible only to
  unit_managers. Self-edit path (rules updated in commit 1).
- Applied across 9 display surfaces: AgentDashboard,
  ManagerDashboard, MasterSheet, MeetingMode, GoalsPanel
  (UnitGoalsTab), Leaderboard, CampaignPanel scope display,
  UserManagementPanel, CreateUserDrawer unit dropdown.
- CreateUserDrawer: optional unitName field for new
  unit_manager creation flows persists through createUser saga.

Edit-existing-unit-name flow for upper heads (branch_manager+)
deferred to PR-4 with the broader edit-user UI.
```

✅ Acceptance: unit_manager sets unit name from profile → agent dashboard for an agent in that unit reflects the change immediately. Empty/unset shows the fallback. Agents cannot write `unitName` on their own doc (firestore rules block it). All nine surfaces use the helper consistently.

### Commit 6 — Deactivate UI + cleanup

**Files:** `src/components/manager/UserManagementPanel.jsx`, new `src/components/manager/DeactivateConfirmDialog.jsx`, `functions/index.js`, `src/services/agentManagementService.js`

Tasks:
1. **DeactivateConfirmDialog** (new):
   - Modal with consequences: "This signs them out immediately, blocks login, preserves their submissions and settlements"
   - Two-step confirm: type the user's email to enable Confirm button (prevents fat-finger)
   - Reactivate variant: simpler, single confirm
   - 44px touch targets, CSS vars
2. **UserManagementPanel row actions:**
   - "Deactivate" button on active user rows
   - "Reactivate" button on inactive user rows
   - Hide the action when `user.id === currentUser.uid` (CF blocks self-deactivation; UI mirrors)
   - Hide when caller can't deactivate the target's role per matrix
   - "Show inactive users" toggle in panel header — defaults to off
   - When active === false rows are visible, render an "Inactive" badge
3. **Pre-grep before deletion:**
   ```bash
   grep -rn "createAgentAccount" . \
     --include="*.js" --include="*.jsx" --include="*.cjs" \
     --include="*.json" --include="*.md" --include="*.rules"
   ```
   Any hit blocks the delete. If the only hits are in already-planned files (this brief, retired comments, scripts/seed files for historical reasons), document and proceed.
4. **Delete `createAgentAccount` from `functions/index.js`** — keep `doCreateUser` (it's still used by `createUser`). Update any audit comments accordingly.
5. **Delete `createAgent` from `agentManagementService.js`** — caller (CreateUserDrawer post-commit-4) already uses `createUser`.

Commit message:
```
feat(deactivate): row-action UI + cleanup of legacy wrapper

- DeactivateConfirmDialog: two-step confirm modal (type email
  to enable). Reactivate variant for inactive users.
- UserManagementPanel: deactivate/reactivate row actions,
  matrix-aware visibility, self-action hidden, "Show inactive"
  toggle in header (defaults off), "Inactive" badge on rows.
- functions/index.js: removed createAgentAccount wrapper. CF
  surface is now createUser + deactivateUser only.
- agentManagementService.js: removed legacy createAgent
  wrapper. UI calls createUser directly.

Pre-grep for createAgentAccount references confirmed clean.
```

🛑 **STOP GATE 2 — before pushing the cleanup commit.** Confirm with Kyron that commits 1–5 are deployed to preview AND the smoke flows pass before pushing commit 6. Reason: once the wrapper is removed, rollback requires a Functions redeploy — cheaper to discover problems in 1–5 first.

✅ Acceptance: deactivate signs target out within seconds (refresh-token revocation already in CF from PR-2). Reactivate restores access. Self-deactivation never renders. `createAgentAccount` zero references in repo.

---

## 6. STOP gates summary

Three points where Claude Code stops and asks Kyron:

1. **Before running migration on production** (between commits 2 and 3). Migration must run on preview Firestore first.
2. **Before pushing commit 6** (the cleanup commit that deletes the wrapper). Verify commits 1–5 work on preview first.
3. **Anytime an unplanned operation comes up** that wasn't in this brief — a rules change beyond what's specified, a delete > 100 lines, a forced push, a Firebase project switch, a dependency added that wasn't pre-approved.

Outside these gates, work autonomously.

---

## 7. Acceptance criteria — full list

Verified by Claude Code after commit 6, reported back to Kyron:

1. Existing account logs in successfully after migration; role label reads "Tenant Admin"
2. Existing test agent creation flow (`kelsean@gmail.com`) succeeds unchanged
3. Tenant_admin creates all internal roles + other tenant_admins within Tatil
4. Tenant_admin cannot create or deactivate platform_admins (rules + UI both block)
5. Platform_admin account exists with correct claims; logging in shows the stub screen, no crash
6. unit_manager caller's UX is unchanged from today (selector hidden, only "Create Agent" form)
7. Deactivate signs target out within ~5 seconds; reactivate restores access; agent can log back in
8. No console errors on any page; `npm run lint` clean; `npm run build` clean
9. `auditAdminCreations` collection records both platform_admin and tenant_admin creation events; old `auditSuperAdminCreations` collection migrated or empty
10. Repo-wide grep for `'super_admin'` returns only pre-classified historical comments (zero in active code paths)
11. unit_manager sets unit name from profile → agent dashboard reflects the change immediately
12. Empty/unset unit name displays fallback `"{managerName}'s Unit"` consistently across all 9 surfaces
13. Agent attempting to write `unitName` on their own doc is rejected by firestore rules
14. tenant_admin creating a new unit_manager can optionally set the unit name at creation time

---

## 8. Pre-merge verification checklist

After the final commit, before opening the PR:

1. `npm run build` — clean
2. `npm run lint` — clean
3. Push branch to GitHub
4. Vercel preview URL deploys cleanly
5. Run exploration template (`scripts/exploration-template.md`) against preview URL using `$VERCEL_BYPASS_TOKEN` — full 28-action checklist
6. Smoke flows on preview, in incognito (use the bypass token via query param on first request, then cookie persists):
   - **a.** Existing tenant_admin account logs in, sees "Tenant Admin" label
   - **b.** tenant_admin creates a new tenant_admin → that account logs in successfully → can also create users
   - **c.** tenant_admin creates a branch_manager → branch_manager logs in → branch_manager creates an agent
   - **d.** tenant_admin deactivates the test agent → test agent's session terminates within seconds → cannot log back in → tenant_admin reactivates → agent logs in successfully
   - **e.** A unit_manager logs in, sets "Phoenix Unit" as unit name on their profile → agent in that unit refreshes dashboard → sees "Phoenix Unit"
   - **f.** Platform_admin attempts login → sees stub screen, no crash
7. Open PR with description listing acceptance criteria + smoke flow results
8. Hand back to Kyron for manual merge

After merge:
9. Verify with `git log origin/main --oneline -5` — merge commit present
10. Re-run exploration template against production URL

---

## 9. Recovery playbook — predictable failure modes

### Migration script fails midway
- Symptom: claim updated but Firestore doc not, or vice versa
- Mitigation: script is idempotent. Re-run with `--dry-run` first to see current state. Then re-run without dry-run to complete.
- If Kyron is locked out: he has the platform_admin account as the escape hatch (after commit 2) — but only after platform_admin's stub screen path is in place (commit 4). If lockout happens between commits 2 and 4, restore the previous claim manually via the Firebase Console (Authentication → user → Custom Claims).

### Vercel preview build fails after a commit
- Most likely cause: lint or import error introduced
- Action: run `npm run build` locally before any push. Don't push if it fails.
- If preview fails after a clean local build: check the Vercel build logs for environment differences (Node version, env var missing).

### Firestore rules deploy fails
- Most likely cause: syntax error in the rules file
- Action: validate locally with `firebase deploy --only firestore:rules --dry-run`
- If rules deploy succeeds but a query starts failing: it's almost certainly a missing tenantId check or a role string mismatch. Diff the rules carefully against commit 1's planned changes.

### A surface still says "Sarah's Unit" instead of "Phoenix Unit"
- Most likely cause: missed surface in commit 5
- Action: grep for `'s Unit` and `unitId` in JSX across `src/components`. Each match should use `getUnitDisplayName()`.

### Repo grep finds `super_admin` references after commit 6
- If in retired comments / migration scripts: fine, document
- If in active code paths: regression. Fix and amend commit 3 (or follow-up commit 6 with a small additional fix commit `chore: remove residual super_admin refs`).

### `npm install` introduces a dependency change
- Don't add new dependencies. If something seems to require a new lib, stop and ask.

---

## 10. Things to update or hand back at the end

After merge to main:

1. **CLAUDE.md** — update role hierarchy section to reflect platform_admin + tenant_admin; remove super_admin references
2. **Project_Analysis.md** — refresh role descriptions
3. **userMemories update** — recommend Kyron run a memory edit:
   - Old: "Roles: Agent → Unit Manager → Branch Manager → Sales Manager → Super Admin (Kyron)"
   - New: "Roles: Agent → Unit Manager → Branch Manager → Sales Manager → Tenant Admin (per company) → Platform Admin (Kyron only, cross-tenant)"
4. **Final PR description** template:
   ```markdown
   ## Summary
   PR-3: Role model rename (super_admin → tenant_admin + new
   platform_admin), polymorphic User Management UI replacing
   AgentManagementPanel, deactivate/reactivate flows, unit
   alias display names.

   ## Commits
   1. refactor(roles): rules + Cloud Functions
   2. feat(scripts): migration + seeds
   3. refactor(ui): wire UI to new role names + polymorphic createUser
   4. feat(user-mgmt): polymorphic panel + matrix UI
   5. feat(unit-aliases): editable unit names + display helper
   6. feat(deactivate): row action UI + cleanup of legacy wrapper

   ## Acceptance criteria
   [paste from section 7, with ✅ next to each verified item]

   ## Smoke flow results
   [paste from section 8.6 results]

   ## Verification
   - Vercel preview: [URL]
   - Exploration template run: [path to verification report]
   - Local: build clean, lint clean

   ## Follow-ups (not blocking)
   - SEC-9b: cross-tenant pivoting for platform_admin
   - PR-4: edit-user flows including upper-heads inline unit name edit
   - Cosmetic: update PRD docs for new role names
   ```

---

## 11. Final checks before opening the PR

- [ ] All six commits pushed to `pr-3-role-model-and-user-mgmt` branch
- [ ] Vercel preview URL deploys cleanly
- [ ] All 14 acceptance criteria verified ✅
- [ ] Six smoke flows passed
- [ ] Exploration template run completed; report saved to `verification/`
- [ ] No new dependencies in `package.json`
- [ ] No service account keys committed
- [ ] PR description filled in per section 10.4
- [ ] Hand back to Kyron for review + manual merge

Then stop. Kyron handles the merge and the post-merge production migration.
