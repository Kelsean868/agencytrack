# PR brief — Resend invite: server-side + audit log

**Sized:** M
**Branch:** `feat/resend-invite-server-side`
**Type:** Server-side feature + new audit collection. Additive CF + rules.

## Outcome

Replace client-side `sendPasswordReset()` in UserManagementPanel's Resend invite flow with a new server-side Cloud Function `resendInviteEmail(uid)` that:

1. Reuses the `mail/` template path (`password-reset.txt` / `password-reset.html`) that `createUser` uses, ensuring visual styling consistency between original and resent invite emails
2. Writes an audit log doc to a new top-level `auditInviteResends` collection mirroring the `auditAdminCreations` CF-written pattern

Closes both #215 FUs in a single PR (Path B per audit recommendation):
- Resend invite: swap to server-side mail/ doc write (PR #215, `3690bf6`)
- Resend invite: add audit log entry (PR #215, `3690bf6`)

## Decisions locked

1. **Path B** — audit via CF using Admin SDK; mirror `auditAdminCreations` rules (`allow write: if false`; reads scoped to tenantId for tenant_admin / branch_manager / sales_manager, unrestricted for platform_admin).
2. **Template reuse** — `password-reset.txt` / `password-reset.html` verbatim. No new template variant.
3. **Audit doc shape** — mirror `auditAdminCreations` with actor/target naming:
   - `tenantId`
   - `actorUid`, `actorEmail`, `actorRole`
   - `targetUid`, `targetEmail`
   - `ip`, `userAgent`, `timestamp` (server timestamp)
4. **Actor set** — `{platform_admin, tenant_admin, sales_manager, branch_manager}`. Matches UserManagementPanel Resend button visibility. CF role gate enforces.
5. **Wrapper** — `src/services/userService.js` gets new `resendInvite(uid)` wrapper invoking `httpsCallable(functions, 'resendInviteEmail')({ uid })`. Mirrors existing `createUser` pattern.
6. **FU 1's "rule update" claim is superseded** — `mail/` rule already `allow write: if false`. Only new rules block is `auditInviteResends`.

## Out of scope

- Introducing a new `resend-invite.{txt,html}` template variant (decisions locked: reuse)
- Broader audit-infrastructure pass (consolidating `auditAdminCreations` + `auditAdminEmailUpdates` + new `auditInviteResends` under a `services/auditService.js` module) — separate architectural decision, not in scope
- Removing `sendPasswordReset` from `authService.js` (still used by `LoginScreen.jsx` end-user "forgot password")
- End-user password reset flow changes
- Any modification to existing `auditAdminCreations` or `auditAdminEmailUpdates` patterns

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify sub-bullet — heavy application)

This PR has many source-derived assertions. Each MUST be paired with a verification command per the Rule 17 sub-bullet banked at `d40fa85`.

1. Both FU sections exist in `docs/FOLLOW_UPS.md` referencing `3690bf6`:
Select-String -Path docs/FOLLOW_UPS.md -Pattern "Resend invite" -Context 0,2

2. UserManagementPanel.jsx currently uses sendPasswordReset:
git grep -n "sendPasswordReset" src/components/manager/UserManagementPanel.jsx
   Expected: ~2 matches.

3. createUser CF emits mail/ doc with password-reset templates:
git grep -n "password-reset" functions/index.js

4. buildMailDoc helper exists:
git ls-files functions/utils/email.js
git grep -n "buildMailDoc" functions/index.js

5. auditAdminCreations pattern (the pattern to mirror):
git grep -n "auditAdminCreations" functions/index.js firestore.rules

6. mail/ rule confirms CF-only writes:
git grep -n "match /mail" firestore.rules
   Expected: `allow read, write: if false`.

7. UserManagementPanel.jsx Resend button visibility includes platform_admin:
git grep -nE "CREATABLE_ROLES|canAct|platform_admin|tenant_admin" src/components/manager/UserManagementPanel.jsx

8. userService.js createUser wrapper pattern:
git grep -nE "createUser|httpsCallable" src/services/userService.js

9. No existing auditInviteResends collection / rules / references:
git grep -n "auditInviteResends" .
   Expected: 0 matches.

10. No existing resendInviteEmail CF export:
git grep -nE "exports\.resendInviteEmail|resendInviteEmail" functions/index.js
    Expected: 0 matches.

11. Existing rules helpers (`isPlatformAdmin`, `isTenantAdmin`, `getTenantId`, etc.) — confirm names for use in the new audit rules block:
git grep -nE "function (isPlatformAdmin|isTenantAdmin|isBranchManager|isSalesManager|getTenantId)" firestore.rules

12. CLAUDE.md additive-CF deploy carve-out still extant (the deploy gate this PR depends on):
Select-String -Path CLAUDE.md -Pattern "additive.*CF deploy|additive.*Cloud Function" -Context 0,2

If any premise shifts: STOP and wait for dispatcher.

## Phase 2 — edits

### Edit 1 — Add `resendInviteEmail` CF in `functions/index.js`

Append a new HTTPS callable `exports.resendInviteEmail`. Mirror the existing `doCreateUser` step E-2 (email emit) and `auditAdminCreations` write block.

Required behaviors:
- Auth required (`context.auth` else `HttpsError("unauthenticated")`)
- Resolve caller's role from Firestore user doc. Role gate: must be in `{platform_admin, tenant_admin, sales_manager, branch_manager}`. Else `HttpsError("permission-denied")`.
- Resolve target user by `data.uid` (Auth + Firestore). 404 → `HttpsError("not-found")`.
- Tenant scoping: actor's `tenantId` must equal target's `tenantId` UNLESS actor is `platform_admin`.
- Generate password reset link via `admin.auth().generatePasswordResetLink(target.email)`.
- Write `mail/` doc using `buildMailDoc(target.email, 'password-reset.txt', 'password-reset.html', { resetLink, ... })` — match the exact field shape `createUser` uses.
- Write `auditInviteResends` doc with the locked shape (tenantId, actorUid, actorEmail, actorRole, targetUid, targetEmail, ip from `context.rawRequest?.ip` if available, userAgent from `context.rawRequest?.headers?.['user-agent']` if available, timestamp via `admin.firestore.FieldValue.serverTimestamp()`).
- Return `{ success: true, targetUid, targetEmail }` on success.

### Edit 2 — Add `auditInviteResends` rules block in `firestore.rules`

Insert near the existing `auditAdminCreations` block. Use the exact helper function names verified in Phase 1 step 11. Structural shape:
match /auditInviteResends/{docId} {
allow read: if isPlatformAdmin() ||
((isTenantAdmin() || isBranchManager() || isSalesManager()) && resource.data.tenantId == getTenantId());
allow write: if false;
}

(Adapt to actual helper names from Phase 1.)

### Edit 3 — Add `userService.resendInvite` wrapper

Add to `src/services/userService.js`, mirroring the existing `createUser` wrapper structure:

```javascript
export async function resendInvite(uid) {
  const callable = httpsCallable(functions, 'resendInviteEmail');
  const result = await callable({ uid });
  return result.data;
}
```

Match the file's existing import / export conventions exactly.

### Edit 4 — Update `src/components/manager/UserManagementPanel.jsx`

- Add `import { resendInvite } from '../../services/userService';`
- Replace the `sendPasswordReset(target.email)` call site (around line 418 per audit) with `await resendInvite(target.uid)`
- Remove the `sendPasswordReset` import if NO OTHER call sites remain in the file (verify via re-grep after the edit)
- Adjust success-toast / error-handling if the callable response shape differs from `sendPasswordReset`'s

### Edit 5 — Update `src/components/manager/__tests__/UserManagementPanel.test.jsx`

- Replace `sendPasswordReset` mock with `userService.resendInvite` mock
- Update assertion payload from `{ email }` to `{ uid }`
- Tests for the CF role gate / tenant scoping / audit-doc shape live in `functions/__tests__` if that test surface exists — surface to dispatcher if it doesn't and CF logic is currently uncovered

### Edit 6 — Close both FUs in `docs/FOLLOW_UPS.md`

For each of the two #215 FUs (locations from Phase 1 step 1):
- Prefix heading with ✅ and suffix with `— CLOSED {YYYY-MM-DD} (PR #TBD, {TBD})`
- Prepend body: `**RESOLVED {YYYY-MM-DD}**`
- Append closing note pointing at this PR and the chosen path

### Edit 7 — Update `docs/CONTEXT.md`

Standard top-table + Recently-shipped + Where-we-left-off updates with `#TBD` / `{TBD}` placeholders. Description for the Recently-shipped row: "Resend invite server-side + audit log — new resendInviteEmail CF reuses createUser's mail/ template path; new auditInviteResends collection mirrors auditAdminCreations pattern. Closes both #215 FUs in single PR (Path B). Additive CF + rules deploy."

## Phase 3 — verification

1. `npm run lint` → clean.
2. `npm run build` → clean.
3. Functions tests (if present): `npm test --prefix functions -- --run`. If the `functions/__tests__` surface is absent, surface in summary — adding test coverage for the new CF may warrant a follow-on FU but is not gating for this PR (smoke is).
4. Frontend tests: `npm test -- --run src/components/manager/__tests__/UserManagementPanel.test.jsx`. Expect pass.
5. Firestore rules emulator tests (if firestore-rules test harness exists): `cd functions && npm run test:rules` or equivalent. If the rules harness isn't set up, surface in summary — rules verification via smoke (Phase 4) becomes load-bearing.

If lint / build / tests fail on a file outside the edit set: STOP for dispatcher.

## Phase 4 — smoke — NON-WAIVABLE

This PR touches production CF + production Firestore rules + user-visible UI behavior. Smoke is gating.

**Pre-merge deploy sequence (operator-side):**

1. CC opens PR → Vercel auto-deploys feature branch to preview URL.

2. Operator deploys CF from feature worktree (additive — new export only):
firebase deploy --only functions:resendInviteEmail --project agencytrack

3. Operator deploys rules from feature worktree (additive — new auditInviteResends block only):
firebase deploy --only firestore:rules --project agencytrack

4. Operator runs existing UI smoke against preview with PREVIEW_HOST override:
$env:PREVIEW_HOST = "feat-resend-invite-server-side"; node scripts/verification/resend-invite-ui-smoke.mjs

5. CC adds new server-side assertions. Either:
   - Extend existing `resend-invite-ui-smoke.mjs` with post-click Firestore queries for the `mail/` doc and `auditInviteResends` doc (using the `setupBypassSession` pattern), OR
   - Write a small supplementary smoke `scripts/verification/resend-invite-server-side-smoke.mjs`

   Required assertions after Resend click + success toast:
   - `mail/` doc exists with target user's email + password-reset template fields
   - `auditInviteResends` doc exists with locked shape (tenantId, actorUid, actorEmail, actorRole, targetUid, targetEmail, timestamp present)

6. Operator runs the smoke, captures output, confirms clean.

7. Operator confirms BOTH smoke clean AND deploys successful before squash merge.

If smoke fails: STOP for dispatcher.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b feat/resend-invite-server-side` (Rule 1).
2. Stage all changes (CF, rules, services, UI, tests, FOLLOW_UPS.md, CONTEXT.md, any new smoke script).
3. Commit message:
feat(user-mgmt): server-side Resend invite + auditInviteResends
Replaces client-side sendPasswordReset() in UserManagementPanel Resend
flow with new server-side Cloud Function resendInviteEmail(uid) that
reuses the mail/ template path createUser uses (password-reset.txt/html)
and writes an audit log doc to a new top-level auditInviteResends
collection.
Architecture: Path B per audit recommendation. CF Admin SDK writes both
the mail/ doc and the audit doc. Rules mirror existing
auditAdminCreations pattern (allow write: if false; reads scoped to
tenantId for tenant/branch/sales managers, unrestricted for
platform_admin).
Actor set: platform_admin, tenant_admin, sales_manager, branch_manager
(matches UserManagementPanel Resend button visibility).
Audit doc shape mirrors auditAdminCreations with actor/target naming:
tenantId, actorUid, actorEmail, actorRole, targetUid, targetEmail,
ip, userAgent, timestamp.
Wrapper: userService.resendInvite(uid) mirrors existing createUser
wrapper pattern.
Closes both #215 FUs in a single PR.
Deploy gate: additive CF (new export) + additive rules (new collection)
deployed from feature worktree pre-merge per CLAUDE.md additive carve-
out. Smoke against preview verifies mail/ doc + audit doc emit
correctly.

4. Push: `git push -u origin feat/resend-invite-server-side`.
5. Open PR via `gh pr create` or GitHub UI. Title: `feat(user-mgmt): server-side Resend invite + auditInviteResends`.
6. PR description must explicitly enumerate the operator deploy sequence (CF + rules deploy + smoke) before merge.
7. Surface PR URL.

## Phase 6 — held

Standard. Operator confirms smoke + deploys clean, then squash merges, then invokes `/post-merge <pr-number>`. Per documented dual-surface gap at `cb18914`: ignore CLI "unrecognized" display for slash commands.
