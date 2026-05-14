# Tenant Admin Email Update Path — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 2–4 hours (Phase 1-heavy; design may surface scope beyond initial assumptions).
**Two-strike counter:** Project carry-in **0/2**. Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-CLAUDE.md-rules-5+6 commit (CC captures actual HEAD in Phase 1).
**Source:** MEDIUM follow-up in `docs/FOLLOW_UPS.md` § "tenant_admin email update path". Closes the last Tier 1 item per Memory 17 working list.

---

## Methodology requirement (read first)

This brief explicitly requires CC to surface BEFORE making any decision not pre-listed in "Decisions locked":

- Scope expansion beyond the file inventory in this brief
- New architectural patterns not pre-decided
- Test file rewrite from scratch (vs. targeted edits)
- Inline fix of unexpected behavior (vs. STOP + surface)
- Any "how to solve" decision not explicitly pre-decided

"Solve rather than surface" is itself a strike condition even when the resulting fix is correct.

**Rule 5 applies (Phase 3 must actually invoke):** any Firebase Auth interaction CC writes must be exercised at least via emulator dry-run or a contained test setup, not just module-loaded.

**Rule 6 applies (Phase 1 must validate data quality):** Phase 1 must verify that existing tenant_admin user docs have the fields the new feature depends on (email field present and matching Auth, related profile fields populated, etc.).

---

## Context

Tenant admins (per-company top-level admins) currently have no UI path to update their own login email. The feature is tracked as a MEDIUM follow-up in `docs/FOLLOW_UPS.md` and listed as the last remaining Tier 1 item.

**What we know:**
- TAs sign in with email + password (Firebase Auth)
- Email is stored in BOTH Firebase Auth AND the Firestore user doc (`tenants/{tenantId}/users/{uid}.email`)
- Firebase Auth's `updateEmail()` requires recent sign-in (sensitive operation) — re-authentication needed before the update can fire
- Self-service profile editing exists in `src/components/profile/ProfileScreen.jsx` for non-email fields (photo, bio, phone, etc.)

**What we DON'T know (Phase 1 surfaces):**
- Does ProfileScreen already render the email field anywhere (read-only display)?
- Are there existing patterns for sensitive operations (password change, account delete) that include re-auth flows we should mirror?
- Where else is the user's email referenced in the app beyond Auth + user doc (notifications, audit log, denormalized references in submissions/settlements/etc.)?
- Are there any reusable re-auth modal components, or does this need a new one?
- Does the existing user doc schema include legacy email fields we'd need to keep in sync?

---

## Decisions locked (do not re-litigate; surface ANY deviation BEFORE implementing)

### Scope: TA SELF-SERVICE email update only

This brief covers the tenant_admin updating their OWN email via ProfileScreen. Not in scope:
- TAs changing OTHER users' emails (agent/UM/BM email edits) — that's a separate user-management feature, file its own follow-up if surfaced
- Email-update path for agent/UM/BM self-service (different role, different UX context)
- Bulk email updates (e.g., CSV import to change emails) — out of scope
- Platform admin email update — Kyron's account; different surface, defer

### Pattern: Firebase Auth `updateEmail()` + Firestore doc sync in single transactional path

- Client-side: call `reauthenticateWithCredential()` first, then `updateEmail()`, then update the Firestore user doc's `email` field
- If any step fails after Auth update succeeds, surface the partial state and provide a manual recovery path (Firestore doc out of sync with Auth)
- Phase 1 confirms whether a Cloud Function should orchestrate this (transactional, defensive) or client-side is sufficient (simpler)

### Re-auth required (Firebase API requirement, not optional)

- Modal prompts for current password before email-update fires
- Standard Firebase pattern: `EmailAuthProvider.credential(currentEmail, password)` → `reauthenticateWithCredential(user, credential)` → on success → `updateEmail(user, newEmail)`
- Re-auth failure surfaces a clear error (wrong password, network, etc.)
- Phase 1 confirms if there's an existing re-auth modal to reuse

### Email verification: default Firebase behavior

- Firebase sends a verification email to the new address by default. We do NOT disable this.
- UX should communicate: "Verification email sent. New email becomes active after you verify."
- Until verified, Firebase keeps the OLD email as the canonical login email. Don't fight this.
- Phase 1 confirms if the user doc's `email` field should be updated immediately (matches Auth's pre-verification state) or after verification (matches the verified email).

### Audit trail: log email changes

- TA email changes are high-stakes (login credential change). Should be logged.
- Phase 1 confirms the existing audit collection (likely `auditAdminCreations` per the rules file, but it may need renaming or a sibling collection like `auditAdminUpdates`)
- New audit entry shape (proposed): `{ type: 'email_update', uid, tenantId, oldEmail, newEmail, timestamp, initiatedByUid }`. Phase 1 finalizes shape.

### Concurrency / data integrity: client-side optimistic, with defensive read

- Standard pattern: client reads current state, fires re-auth + update, writes Firestore.
- No global lock needed — TA is updating their own doc, no contention.
- BUT: if the Auth `updateEmail()` succeeds but the Firestore write fails, the system is in inconsistent state. Mitigation: catch + retry the Firestore write, OR surface to user with "email changed in Auth but not in app — contact platform_admin" message.
- Phase 1 design call: decide whether retry-with-backoff or surface-to-user is the right error UX.

### Test coverage required

- ProfileScreen component test: email field renders, edit button triggers modal, re-auth modal renders, success path updates both Auth + Firestore
- Service-layer test (if a new service is created): each method tested independently
- Firebase emulator or mocked Auth: exercise the actual `updateEmail()` call path
- Phase 1 confirms test file locations and existing patterns to mirror

### Verification: manual smoke required pre-merge

After CC opens the PR, Kyron tests:
1. Sign in as tenant_admin → ProfileScreen → trigger email update flow
2. Re-auth modal appears, accepts current password
3. New email entered → success message + verification email sent
4. Check inbox for verification email at new address
5. Verify the new email (click link)
6. Sign out → sign in with NEW email → confirms verified change
7. Firestore: check user doc `email` field matches the new email
8. Check audit collection for the new log entry

---

## Scope (subject to Phase 1 expansion)

Initial file inventory (Phase 1 may add or remove):

| Path | Change |
|---|---|
| `src/components/profile/ProfileScreen.jsx` | Add email update UI section + button to trigger flow |
| `src/components/profile/EmailUpdateModal.jsx` (new) | Re-auth + new-email collection modal |
| `src/services/profileService.js` (or similar; Phase 1 confirms) | New service method for the update orchestration |
| `firestore.rules` | If audit collection schema changes, allow rule for write |
| `src/services/__tests__/profileService.test.js` (new or extend) | Service tests |
| `src/components/profile/__tests__/EmailUpdateModal.test.jsx` (new) | Component tests |
| `docs/CONTEXT.md` | Recently-shipped row (placeholders for this PR's SHA/PR#) |
| `docs/FOLLOW_UPS.md` | Mark "tenant_admin email update path" resolved with placeholder |

**No backfill expected** — feature applies to future email changes only. Existing tenant_admins keep their current emails until they choose to update.

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

Surface in chat (no committed discovery doc):

1. Capture main HEAD SHA via `git log origin/main --oneline -1`. Confirm clean state post-CLAUDE.md-rules-5+6 commit.
2. Read `src/components/profile/ProfileScreen.jsx` in full — current UI structure, what's editable, what's not, where email is rendered (if at all).
3. Find existing patterns for sensitive operations: grep for `reauthenticateWithCredential`, `EmailAuthProvider`, `updateEmail`, `updatePassword` across `src/`. Is there a re-auth modal already? Surface findings.
4. Identify where the user's email is referenced in the codebase (beyond Auth + user doc). Run: `grep -r "\.email" src/services/ src/components/` for relevant matches. Find any denormalized email storage (notifications, audit, settlements, etc.) that would need sync on update.
5. Read `firestore.rules` — locate audit collection rules (`auditAdminCreations` or similar). Determine if a new audit entry type can fit existing rules or requires schema/rule changes.
6. **Rule 6 audit:** sample-read 1-2 tenant_admin user docs from production (via service-account-key, read-only) and verify the `email` field is present and matches Auth. Surface any mismatches as a finding before designing the update flow.
7. Surface Phase 1 design in chat. Required surface includes:
   - Existing re-auth pattern (reuse vs. new modal)
   - Where ProfileScreen currently renders email (if anywhere)
   - All denormalized email locations + sync strategy
   - Audit collection design (new entry shape, existing collection or new)
   - Error UX for partial-failure (Auth updated, Firestore didn't): retry vs. surface-to-user
   - Test file locations + existing patterns

Kyron acks before Phase 2.

**Hard stops in Phase 1:**
- Email is denormalized in unexpected places (e.g., embedded in submission docs or audit logs without source-of-truth marker) → STOP, scope expansion
- Existing re-auth pattern uses a different Firebase API (e.g., custom token re-auth, not credential re-auth) → STOP, surface, may invalidate the locked decision
- TA user docs surface `email` field mismatches with Auth (Rule 6 audit) → STOP, surface, may require pre-fix cleanup
- Email is stored in Firebase Auth claims (not just at root level) → STOP, surface, may require Cloud Function involvement
- Phase 1 estimated implementation exceeds 4 hours total scope → STOP, propose split into multiple PRs

### Phase 2 — Apply implementation

Per the approved Phase 1 design:
- Build the EmailUpdateModal (or reuse existing re-auth pattern + add email-collection step)
- Add update button + flow to ProfileScreen
- Build the service-layer orchestration
- Wire audit logging
- Update rules if needed

### Phase 3 — Verification

**Rule 5 applies:** Phase 3 verification must include actual invocation of the Firebase Auth flow, not just module resolution. Options:
- Firebase Auth emulator (`firebase emulators:start --only auth`) with a fixture test user
- OR mocked Auth via vitest + manual trace through the code path with realistic data shapes
- The mocked path is acceptable for vitest unit tests; the emulator path is acceptable for integration verification. At least ONE actual invocation must occur.

Plus standard:
- `npm run lint` → 0 errors
- `npm test -- --run` → all pass (test count delta documented in PR)
- `npm run build` → success, no new warnings

### Phase 4 — Docs

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` — mark "tenant_admin email update path" resolved with placeholder

### Phase 5 — Commit, push, PR

- Conventional commit(s)
- Push, open PR
- **PR title:** `feat(profile): tenant_admin email update with re-auth + audit`
- **PR description must include:**
  - Summary
  - Phase 1 audit findings (denormalized email locations, existing patterns, audit collection design)
  - Design decisions: re-auth modal (new or reused), error UX for partial failure, audit entry shape
  - Test coverage (added counts)
  - **Manual pre-merge smoke checklist for Kyron** (8 steps above)
  - Verification matrix

### Phase 6 — STOP

DO NOT MERGE. Kyron runs manual smoke checklist + merges.

### Phase 7 — Post-merge cleanup (NEW STANDARD)

Execute ONLY after Kyron messages "PR #<N> merged":

1. `git checkout main && git fetch origin --prune && git pull origin main`
2. `git log origin/main --oneline -1` — capture squash SHA
3. Fill `docs/CONTEXT.md` SHA + PR# placeholders
4. Fill `docs/FOLLOW_UPS.md` PR# placeholder
5. Commit: `docs: fill #<N> squash SHA + PR# placeholders`
6. `git push origin main`
7. Remove worktree (if used): `git worktree remove <path>`
8. Delete branch: `git branch -D <branch>`
9. Surface in chat: "Phase 7 complete. #<N> placeholders filled at <sha>."

---

## Hard stops

- Lint fails → fix, don't commit broken state
- Existing tests start failing in unexpected ways → STOP, surface
- Build fails → STOP, surface
- Phase 1 finds the fix requires changes beyond the file inventory → STOP, scope expansion (likely will happen, anticipated)
- Email is referenced in unexpected places (denormalized in submissions, notifications, etc.) → STOP, surface
- Re-auth pattern doesn't exist in codebase AND Firebase Auth emulator isn't easily testable → STOP, propose fallback (mock-based verification + post-merge smoke as primary validation)
- Firestore rules need significant restructuring for the audit collection → STOP, scope expansion
- Phase 1 reveals tenant_admin email is stored in multiple places that don't match (Rule 6 finding) → STOP, propose pre-fix migration as a prerequisite
- ANY decision not pre-listed in "Decisions locked" — STOP and surface BEFORE acting

---

## NOT in scope

- Email update for agent / unit_manager / branch_manager roles (different UX, different surface, separate brief if needed)
- Platform_admin email update (Kyron's account, different concerns)
- TA changing OTHER users' emails (user management feature, not self-service)
- Bulk email updates (CSV import for emails)
- Email verification UX redesign (use Firebase default)
- Password change flow (separate feature)
- Account deletion flow (separate feature)
- Phone number / 2FA changes (separate features)
- Audit collection redesign beyond what this feature needs
- Migration of historical email data
- Backfill or one-time scripts (no historical state to clean)

---

## Verification matrix (CC must include in PR description)

| Item | Command / Verification | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test -- --run` | 100% pass |
| Build succeeds | `npm run build` | success, no new warnings |
| Firebase Auth flow exercised | Phase 3 invocation evidence | emulator log or vitest mock trace shows updateEmail() called with expected params |
| Re-auth pattern documented | PR description | decision: reused existing or built new, with rationale |
| Denormalized email locations addressed | PR description | Phase 1 enumeration result + sync strategy |
| Audit logging in place | PR description + test | new audit entry created on successful email update |
| Error UX documented | PR description | partial-failure path explained (Auth updated, Firestore didn't) |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | Recently-shipped row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | "tenant_admin email update path" marked resolved |
| Manual smoke checklist | PR description | 8-step checklist for Kyron, specific to this feature |

---

## CC kickoff prompt (one-liner)

> Execute the tenant_admin email update path per the brief in `docs/briefs/tenant-admin-email-update-kickoff.md`. Project strike count 0/2. Standard 2-strike loop. **Read the methodology requirement at the top first — surface BEFORE making ANY architectural decision not pre-listed in "Decisions locked"; this is itself a strike condition. Rule 5 applies (Phase 3 must actually invoke). Rule 6 applies (Phase 1 must validate data quality of existing tenant_admin docs).** This brief is Phase-1-heavy — most of the design surface is unknown until you read the existing codebase. Surface Phase 1 findings + design proposal before any code changes. Do NOT merge — open PR with verification matrix, stop. Phase 7 post-merge cleanup waits for Kyron's "PR merged" confirmation.
