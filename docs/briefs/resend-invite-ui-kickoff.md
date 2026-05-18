# Kickoff brief — Resend invite UI (M)

## Header

| Field | Value |
|---|---|
| **Type** | Feature work — add per-row "Resend invite" action to user management |
| **Shape** | New icon button + ConfirmDialog + handler + audit log entry. Estimated 3-4 source files + 1-2 test files + 2 docs updates. |
| **Size** | **M** (~90-120 min execution) |
| **Banking source** | FOLLOW_UPS.md ~L821-847 "Resend invite UI" (MEDIUM priority) + CONTEXT.md Active follow-ups table |
| **All dispatcher questions resolved** | Q1: client-side short-term `sendPasswordReset()`. Q2: `canAct && !isInactive` visibility gate. Q3: yes, audit log entry mirroring `auditAdminEmailUpdates`. Q4: 3 buttons always for MVP (kebab pattern deferred to future dedicated mobile-manager pass). |
| **Smoke walk** | **RUN per Rule 27 default** — user-visible behavior change (new button, new confirm dialog, new toast). Documented smoke checklist in Phase 3 step 5. |
| **Strike count** | 0/2 — clean. |

---

## Architectural decisions (locked at brief authoring)

1. **Backend path: client-side `sendPasswordReset()` for MVP.** Use the existing `sendPasswordReset()` function from `src/services/authService.js`. This bypasses the server-side `mail/` template path that PR-D (#133) and PR #136 established for create-user — the resent email uses Firebase Auth's default reset template rather than the branded mail/ template. **Trade-off acknowledged:** this is the FU body's explicit short-term recommendation; long-term consistency would require a new CF `resendInviteEmail(uid)` that writes a mail/ doc. The long-term swap is filed as a follow-up to bank in Phase 4a. MVP ships now; consistency comes later.

2. **Integration point: action cell at `UserManagementPanel.jsx` ~L528-553** (per CC's audit). Add the Resend button alongside existing Edit (Pencil) and Deactivate/Reactivate buttons. Phase 1 step 2 confirms current action cell structure.

3. **Visibility gate: `canAct && !isInactive`** (mirrors Edit-row pattern). Active users only; inactive users don't receive resend affordance. Do NOT add `lastSignInTimestamp` gate — that's its own separate scope requiring an `onUserSignIn` Auth trigger.

4. **ConfirmDialog: reuse the already-imported component at `UserManagementPanel.jsx:15`.** Body text: "Previous reset email link will stop working." (matches FU body wording). Title: "Resend invite email?". Confirm button: "Resend". Cancel button: "Cancel".

5. **Audit log entry: mirror `auditAdminEmailUpdates` pattern.** Add a new function (or extend existing audit module) that writes an audit doc when a resend is triggered. Captures: actor uid, target uid, target email, timestamp, tenantId. Phase 1 step 4 confirms audit service module location + pattern.

6. **aria-label on the new button.** Lucide icon will be `<MailPlus />` or `<Send />` — Phase 1 step 6 picks the visually-clearest option based on existing icon language in the actions cell. aria-label: "Resend invite email to {user name}". This pre-empts a future aria-label sweep finding by adding the label from the start.

7. **3 buttons always (no kebab/responsive split).** Per operator confirmation 2026-05-19. Banking note for the future dedicated mobile-manager pass: when that pass happens, ALL row action buttons (Edit, Resend, Deactivate) collapse into a kebab dropdown on mobile. Filed in Phase 4a closure paragraph as a forward-looking note.

8. **Tests: at minimum, 2 new test cases for UserManagementPanel** (button visibility per role gate; confirm-then-send flow). Audit service test if the audit module already has a test file; otherwise defer audit-write coverage to integration testing.

9. **Toast feedback: use existing `useToast()` hook.** Success: "Invite email resent to {user email}". Failure: surface the Firebase error message in the toast. Match the existing handler pattern at `UserManagementPanel.jsx:379-396`.

10. **No changes to `createUser` flow.** This PR is recovery affordance only; the original create-user invite path stays unchanged.

---

## Source-verified state at brief authoring

### FU body (from CC's audit, verbatim quote — Rule 11 preserve as-is)

> **Resend invite UI** — Add a per-row "Resend invite" button on the user-management list. When the create-user flow's email dispatch fails (or when an admin realises a user never got the original email — lost-in-spam case), the admin currently has no recourse short of recreating the user.
>
> **Wiring:** `UserManagementPanel.jsx` — per-row dropdown / overflow menu next to the existing Deactivate button. "Resend invite email" entry visible for any active user (or any user without a `lastSignInTimestamp`). Handler calls the same primitive (`sendPasswordResetEmail(auth, email)`), surfaces success/failure in the existing toast. Once HIGH#5 (server-side email) lands, swap to a `mail/` doc write triggered through a callable wrapper.
>
> **Edge case:** Firebase Auth invalidates each prior reset link when a new one is generated for the same user — the UI should clarify "Previous reset email link will stop working." in a confirm dialog.

### Current invite flow (from CC's audit)

1. Admin opens `CreateUserDrawer` from `UserManagementPanel.jsx:140`.
2. Submit → `createUser(payload)` → CF `functions/index.js:443` (`doCreateUser`) → writes a `mail/` doc that triggers Firebase Trigger Email Extension to send password reset email (server-side per PR-D #133 / PR #136).
3. CF returns `{ success, uid, emailQueued, emailError? }`.
4. `handleCreated` at `UserManagementPanel.jsx:379-396` shows success or warning toast based on `emailQueued`.
5. Once toast dismisses → no recovery affordance → admin must recreate user. **This is the gap this PR closes.**

### Key integration points (Phase 1 verifies each)

- **`src/components/manager/UserManagementPanel.jsx`:**
  - L15: `ConfirmDialog` import (reuse)
  - L140: CreateUserDrawer button (out of scope)
  - L379-396: `handleCreated` (reference pattern for new `handleResend`)
  - L528-553: action cell (insertion point for new button)
- **`src/services/authService.js`:**
  - L20-22 (approximate): `sendPasswordReset` function (handler invokes this)
- **Audit service module:**
  - Pattern: `auditAdminEmailUpdates` (location TBD — Phase 1 step 4 locates the audit service file)
- **`lucide-react`:**
  - `MailPlus` or `Send` icon — Phase 1 step 6 decides which based on existing iconography in the action cell

### Active follow-up entry in CONTEXT.md

The "Resend invite UI" row in CONTEXT.md Active follow-ups table currently flags this as MEDIUM. Phase 4b removes this row from the Active table (shipped → no longer pending) and adds the Recently-shipped row.

---

## Phase 0 — Pre-flight gate

```powershell
# From C:\Projects\AgencyTrack
git status                              # working tree should show 6 untracked scripts only
git fetch origin
git pull --ff-only origin main
git log origin/main --oneline -1        # capture current main HEAD
git branch --show-current               # confirm on main
```

**Expected state:**
- Working tree clean (apart from 6 untracked scripts)
- Current main HEAD = `e179a90` (or whatever the latest is — capture from `git log`)
- On main branch

**Hard-stop if:**
- Tracked file modifications in working tree → surface
- `git pull` not fast-forward → surface

Create worktree:

```powershell
git worktree add ../agencytrack-worktrees/resend-invite-ui chore/resend-invite-ui
cd ../agencytrack-worktrees/resend-invite-ui
```

---

## Phase 1 — Source-verify all integration points (Rule 17 thorough)

This is M-sized work; Phase 1 is correspondingly thorough. Skip any step at execution risk.

### Step 1 — Read `UserManagementPanel.jsx` action cell (the insertion point)

Read `src/components/manager/UserManagementPanel.jsx` lines 520-560 (covers the action cell with surrounding context).

**Capture:**
- Exact JSX structure of the row's action cell
- Existing buttons: Edit (Pencil), Deactivate/Reactivate
- aria-label patterns on existing buttons (for consistency)
- The `canAct` and `isInactive` variable definitions/derivations
- The user object shape (`user.uid`, `user.email`, `user.name`, `user.role`, `user.deactivatedAt`?, etc.)
- Whether the action cell is its own component or inline in the row

### Step 2 — Read `UserManagementPanel.jsx` handleCreated pattern (the handler template)

Read lines 375-400 (covers `handleCreated`).

**Capture:**
- The function signature and async pattern
- How it calls services
- How it surfaces success vs failure to toast
- Any error-handling patterns (try/catch, error toast)

This is the template for the new `handleResend` function.

### Step 3 — Read `src/services/authService.js`

Read the entire file (likely small).

**Capture:**
- `sendPasswordReset` function signature: arguments + return type + thrown errors
- Whether it's `async` and returns a Promise
- Any existing audit-write side effects
- Other exports (we may need them for context)

**Hard-stop if:** `sendPasswordReset` doesn't exist or has a different signature than CC's audit assumed. Surface for dispatcher resolution.

### Step 4 — Locate the audit service module

```powershell
git grep -l "auditAdminEmailUpdates\|auditAdmin\|audit.*Email" -- 'src/**/*.js' 'src/**/*.jsx'
```

**Capture:**
- Module path (likely `src/services/auditService.js` or `src/services/audit/`)
- `auditAdminEmailUpdates` signature
- Pattern: takes what args? Writes where in Firestore? Returns what?
- Any existing audit functions (we may want to consolidate or follow pattern)

**Hard-stop if:** No audit module exists. Audit logging would need to be built from scratch, expanding scope significantly. Surface for dispatcher resolution before Phase 2.

### Step 5 — Read `ConfirmDialog` component

```powershell
git grep -l "export.*ConfirmDialog" -- 'src/components/**/*.jsx'
```

Read the file at the located path.

**Capture:**
- Component prop signature: title, body, confirmLabel, cancelLabel, onConfirm, onCancel, isOpen, etc.
- Any required vs optional props
- Existing usage examples in `UserManagementPanel.jsx` or elsewhere (search: `<ConfirmDialog`)

### Step 6 — Decide between `<MailPlus />` and `<Send />` for the icon

```powershell
git grep -n "MailPlus\|<Send" -- 'src/components/**/*.jsx'
```

If `MailPlus` is already used in this surface (for invite-related affordances) → use it for consistency.
If `Send` is more common → use it.
If neither is used → pick `MailPlus` (more semantically tied to "email").

Also check existing icons in the action cell at L528-553 (from step 1) to choose visually consistent size + styling.

### Step 7 — Confirm Resend invite UI FU body location in FOLLOW_UPS.md

```powershell
Select-String -Path docs/FOLLOW_UPS.md -Pattern "Resend invite UI" -Context 0,5
```

**Capture:** line number for Phase 4a banking. CC's audit estimated ~L821-847; Phase 1 confirms actual.

### Step 8 — Confirm Active-follow-ups entry in CONTEXT.md

```powershell
Select-String -Path docs/CONTEXT.md -Pattern "Resend invite" -Context 0,2
```

**Capture:** line number for Phase 4b removal.

### Step 9 — Check for existing test file for UserManagementPanel

```powershell
ls src/components/manager/__tests__/UserManagementPanel.test.jsx -ErrorAction SilentlyContinue
```

**Report:** exists or not. If exists, capture test patterns used (vitest? jest? what does the role-gating test look like? what does the confirm-flow test look like?). Phase 2 step 4 follows the same patterns.

### Phase 1 report (paste-back to dispatcher)

Comprehensive summary covering all 9 steps:
- Action cell JSX structure + existing button patterns
- `handleCreated` function signature + error handling pattern
- `sendPasswordReset` signature + async behavior
- Audit module location + `auditAdminEmailUpdates` pattern
- ConfirmDialog prop signature
- Icon decision (MailPlus vs Send) with rationale
- Resend invite UI FU line number
- CONTEXT.md Active follow-up row line
- Test file existence + patterns used
- **Divergences from CC's audit assumptions** (if any — these inform brief adjustments)

Wait for dispatcher clearance before Phase 2.

---

## Phase 2 — Execute

### Step 1 — Implement `handleResend` handler in `UserManagementPanel.jsx`

Add a new async handler function modeled on `handleCreated`. Inside the component but at the same nesting level as other handlers.

```jsx
const handleResend = async (user) => {
  // Confirm dialog opens first via state; this fn runs after user confirms
  try {
    await sendPasswordReset(user.email);
    await auditResendInvite({
      actorUid: callerProfile.uid,
      targetUid: user.uid,
      targetEmail: user.email,
      tenantId,
      timestamp: serverTimestamp(),
    });
    toast.success(`Invite email resent to ${user.email}`);
  } catch (err) {
    console.error('[UserManagementPanel] resend invite failed:', err);
    toast.error(err.message || 'Failed to resend invite. Try again.');
  }
};
```

**Adjust signature/args based on Phase 1 findings:**
- If `callerProfile.uid` isn't the actor reference → use whatever is (audit pattern from `auditAdminEmailUpdates`).
- If audit function takes different args → match its signature.
- If `toast.success` / `toast.error` aren't the methods → use what `useToast()` actually exports.

### Step 2 — Wire ConfirmDialog state

Add state for the resend confirm dialog (mirror the deactivate pattern if one exists):

```jsx
const [pendingResend, setPendingResend] = useState(null); // holds user object when dialog open, null when closed
```

ConfirmDialog wiring (placement: near other dialogs in the JSX tree, typically at the end of the component return):

```jsx
{pendingResend && (
  <ConfirmDialog
    title="Resend invite email?"
    body="Previous reset email link will stop working."
    confirmLabel="Resend"
    cancelLabel="Cancel"
    onConfirm={async () => {
      await handleResend(pendingResend);
      setPendingResend(null);
    }}
    onCancel={() => setPendingResend(null)}
    isOpen={!!pendingResend}
  />
)}
```

**Adjust props based on Phase 1 step 5 findings** — ConfirmDialog's actual API determines exact prop names.

### Step 3 — Add the icon button to the action cell

In the action cell JSX (located at ~L528-553), insert the new button between Edit and Deactivate (so the row order is: Edit | Resend | Deactivate):

```jsx
{canAct && !isInactive && (
  <button
    onClick={() => setPendingResend(user)}
    className="..." /* match existing action-button class */
    aria-label={`Resend invite email to ${user.name}`}
  >
    <MailPlus size={16} /> {/* or Send, per Phase 1 step 6 */}
  </button>
)}
```

**Match the className pattern** from the existing Edit/Deactivate buttons in the same cell (likely h-9 or h-10, hover style, focus ring, etc.).

### Step 4 — Add audit-service function (if not already present)

Locate the audit service file from Phase 1 step 4. Add `auditResendInvite` function mirroring `auditAdminEmailUpdates`:

```js
export async function auditResendInvite({ actorUid, targetUid, targetEmail, tenantId, timestamp }) {
  // mirror auditAdminEmailUpdates implementation
  // typically: addDoc(collection(db, 'tenants', tenantId, 'auditLogs'), {
  //   type: 'invite.resend',
  //   actorUid,
  //   targetUid,
  //   targetEmail,
  //   createdAt: timestamp ?? serverTimestamp(),
  // })
}
```

**Match the existing audit pattern exactly** — Phase 1 step 4 captured the signature. Don't invent new patterns.

### Step 5 — Add tests (vitest)

Add 2 new test cases to `src/components/manager/__tests__/UserManagementPanel.test.jsx` (or wherever Phase 1 step 9 located the test file). Follow the existing test patterns there.

**Test 1 — Resend button visibility:**
```js
it('shows Resend invite button for active users when caller canAct', async () => {
  // ... render with canAct=true, !isInactive
  expect(screen.getByRole('button', { name: /Resend invite email/i })).toBeInTheDocument();
});

it('hides Resend invite button when target is inactive', async () => {
  // ... render with isInactive=true
  expect(screen.queryByRole('button', { name: /Resend invite email/i })).not.toBeInTheDocument();
});
```

**Test 2 — Confirm-then-send flow:**
```js
it('Resend invite: click → confirm → calls sendPasswordReset and auditResendInvite', async () => {
  // ... mock sendPasswordReset to resolve
  // ... mock auditResendInvite to resolve
  // ... click Resend button
  await waitFor(() => expect(screen.getByText(/Resend invite email\?/i)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^Resend$/i }));
  await waitFor(() => expect(hoisted.sendPasswordReset).toHaveBeenCalledTimes(1));
  expect(hoisted.sendPasswordReset).toHaveBeenCalledWith('test@example.com');
  await waitFor(() => expect(hoisted.auditResendInvite).toHaveBeenCalledTimes(1));
});
```

**Critical:** apply the CI-race lesson from PR #210 — use `await waitFor(...)` between any `fireEvent.click` that triggers async state and the subsequent assertion. Don't reintroduce the same React-state-flush race.

---

## Phase 3 — Verify

### Step 1 — Diff stat

```powershell
git diff main..HEAD --stat
```

**Expected pattern (varies by Phase 1 findings):**
- `src/components/manager/UserManagementPanel.jsx` | many+ (most edits here)
- `src/services/authService.js` | (likely unchanged — sendPasswordReset already exists)
- `src/services/auditService.js` or equivalent | many+ (new auditResendInvite function)
- `src/components/manager/__tests__/UserManagementPanel.test.jsx` | many+ (2 new tests)
- `docs/FOLLOW_UPS.md` | M
- `docs/CONTEXT.md` | M (Active row removed + Recently row added)

Total: 4-6 M entries.

### Step 2 — `.env.example` carve-out check (Rule 14)

```powershell
git diff main..HEAD -- .env.example
```

Empty.

### Step 3 — Run new tests

```powershell
npm test -- UserManagementPanel
```

**Expected:** all existing tests still pass + 2 new tests pass. Total count > previous count by exactly 2.

### Step 4 — Lint + build

```powershell
npm run lint
npm run build
```

Both pass.

### Step 5 — Smoke walk (per Rule 27 default — RUN, not waived)

Using Vercel preview URL (after push):

1. Login as `kelsean+tenantadmin@gmail.com` (tenant admin role, can edit users)
2. Navigate to user management surface
3. Locate any active user in the list
4. **Verify:** Resend button appears in action cell between Edit and Deactivate
5. **Verify:** button has visible icon + tooltip/aria-label on hover/focus
6. Click Resend button
7. **Verify:** ConfirmDialog opens with title "Resend invite email?" and body "Previous reset email link will stop working."
8. Click Cancel → **Verify:** dialog closes, no email sent
9. Click Resend again → confirm
10. **Verify:** success toast appears ("Invite email resent to {email}")
11. **Verify in Firebase Console:** audit log entry created in `tenants/{tenantId}/auditLogs` with type `invite.resend`
12. **Verify:** the affected user receives a real Firebase password reset email (check inbox)

Document smoke walk results in Phase 5 report.

---

## Phase 4 — Banks

### Phase 4a — FOLLOW_UPS.md: mark Resend invite UI FU resolved

Locate the FU section (Phase 1 step 7 captures actual line). Standard treatment:

- Heading: append `[RESOLVED PR #{TBD}, {TBD}]`
- Append closure paragraph at end of section:

```
**Closure (PR #{TBD}, squash `{TBD}`):** Per-row Resend invite button shipped on UserManagementPanel.jsx action cell, between Edit and Deactivate. Client-side path via `sendPasswordReset()` (short-term per FU body); long-term swap to server-side `mail/` doc write deferred as separate follow-up. ConfirmDialog uses banked copy "Previous reset email link will stop working." Visibility gated on `canAct && !isInactive`. Audit log entry written mirroring `auditAdminEmailUpdates` pattern (new `auditResendInvite` in `src/services/auditService.js`). 3 buttons always on row — kebab/responsive pattern deferred to future dedicated mobile-manager pass (when MasterSheet, SettlementPanel, and these action rows all need it together). aria-label="Resend invite email to {user.name}" applied from the start, no follow-up sweep needed. 2 new tests added to UserManagementPanel.test.jsx covering visibility gate + confirm-then-send flow with appropriate `waitFor` discipline (avoids CI-race pattern from PR #210).
```

**Bank a new LOW follow-up immediately below the closure paragraph:**

```
## Resend invite: swap to server-side mail/ doc write (LOW, banked 2026-05-19)

Resend invite shipped MVP with client-side `sendPasswordReset()` (Firebase Auth default reset template). Long-term consistency with the server-side `mail/` template path that create-user uses (PR-D #133 / PR #136) requires a new Cloud Function `resendInviteEmail(uid)` that writes a `mail/` doc using the same template `createUser` emits. Trade-off: shipped MVP uses Firebase Auth's default reset template; users see different visual styling for resent vs original invite emails. Defer to dedicated email-template-consistency PR. Estimated size: M (CF function + callable wrapper + rule update + swap UI handler to call CF instead of authService.sendPasswordReset).
```

Phase 6 fills the `#{TBD}` placeholders.

### Phase 4b — CONTEXT.md: remove Active follow-up row + add Recently-shipped row

**Edit 1:** Remove the "Resend invite UI" entry from the Active follow-ups table (Phase 1 step 8 captures actual line).

**Edit 2:** Add Recently-shipped row at top:

```
| #{TBD} | `{TBD}` | Feature: per-row Resend invite button on UserManagementPanel (client-side `sendPasswordReset`, ConfirmDialog with edge-case copy, audit log entry mirroring `auditAdminEmailUpdates`, aria-label from the start, `canAct && !isInactive` gate, 3 buttons always for MVP). Closes FU "Resend invite UI" (MEDIUM). New LOW follow-up banked for long-term server-side mail/ doc consistency swap. |
```

Drop the oldest row.

---

## Phase 5 — Commit + push + PR

### Commit message

```
feat(user-mgmt): per-row Resend invite UI on UserManagementPanel

Closes FU "Resend invite UI" (MEDIUM) — admin recovery affordance for
failed create-user invite emails (or lost-in-spam cases). Previously the
only recourse was to recreate the user.

Implementation:
- New icon button on UserManagementPanel.jsx action cell, between Edit
  and Deactivate. Lucide icon: [MailPlus or Send per Phase 1 decision].
  aria-label="Resend invite email to {user.name}".
- Visibility gated on canAct && !isInactive (mirrors Edit-row pattern).
- ConfirmDialog opens with edge-case clarification: "Previous reset email
  link will stop working." (per FU body banked copy).
- Handler calls existing src/services/authService.js sendPasswordReset()
  (client-side short-term path per dispatcher Q1).
- Audit log entry written via new auditResendInvite mirroring existing
  auditAdminEmailUpdates pattern.
- Toast feedback via existing useToast() hook.

Tests: 2 new cases in UserManagementPanel.test.jsx covering visibility
gate + confirm-then-send flow. Apply waitFor discipline from PR #210 to
avoid CI-race pattern.

Dispatcher Q&A locked decisions (2026-05-19):
- Q1: client-side short-term sendPasswordReset
- Q2: canAct && !isInactive visibility gate
- Q3: audit log entry yes (auditResendInvite)
- Q4: 3 buttons always for MVP (kebab/responsive deferred)

Banks new LOW follow-up for server-side mail/ doc consistency swap.
```

### PR title

```
feat(user-mgmt): per-row Resend invite UI on UserManagementPanel
```

### Push + PR open

```powershell
git push -u origin chore/resend-invite-ui
gh pr create --title "feat(user-mgmt): per-row Resend invite UI on UserManagementPanel" --body-file ...
```

### End-of-Phase-5 report (paste to dispatcher)

- PR URL
- Branch HEAD SHA
- `git log chore/resend-invite-ui --oneline -1` verbatim
- `git diff main..HEAD --stat` verbatim
- `.env.example` diff (empty expected)
- Phase 1 source-verification capture summary (key findings + any divergence from CC's audit)
- Phase 2 implementation details:
  - Icon chosen (MailPlus / Send) + rationale
  - Audit module location + auditResendInvite signature
  - ConfirmDialog API used
  - Test count: previous N → new N+2
- Lint + build + test results
- Smoke walk results — 12-step checklist with pass/fail per step (or any deviation observed)
- Smoke walk: RUN (not waived)

Wait for dispatcher merge confirmation before Phase 6.

---

## Phase 6 — Fifteenth Rule 16 application (post-merge fill)

After dispatcher confirms merge:

Fill scope (2 files):

1. **`docs/CONTEXT.md`** top-table fields + recently-shipped row:
   - Current main HEAD → work-PR squash SHA (NOT fill commit)
   - Active track → "Resend invite UI shipped (PR #{this}, squash `{SHA}`). Per-row recovery affordance on UserManagementPanel.jsx for failed create-user invite emails. Client-side MVP per FU body short-term direction; long-term server-side mail/ doc swap banked as new LOW follow-up."
   - Next track → "Smaller follow-ups remaining: wizard R2-R5 residual, `bg-[var(--color-X)]` arbitrary-syntax sweep, 6 untracked verification scripts (deferred per FU body), Resend invite long-term server-side mail/ swap (LOW, banked PR #{this}). BEH-1 still blocked on slide copy; FU-I still deferred post-pilot."
   - Where we left off → 2-paragraph update covering: (1) Resend invite UI as second work PR of 2026-05-19 (after aria-label sweep PR #213). Closes last MEDIUM-priority item in Active follow-ups. M-sized feature work with audit log integration and CI-race-aware tests. (2) Fifteenth consecutive Rule 16 cycle, zero drift. Three-day arc closes with 13 work PRs / 15 Rule 16 cycles / 14+ Rule 17 in-the-wild signals / 0/2 strikes. Active follow-ups table narrowed: MEDIUM tier is now empty; only LOW items remain.
   - Last updated → 2026-05-19
   - Replace `#{TBD}` and `{TBD}` placeholders.

2. **`docs/FOLLOW_UPS.md`** TWO closure points:
   - Resend invite UI FU closure paragraph: `#{TBD}/{TBD}` → `#{N}/{SHA}` + heading flips to `[RESOLVED PR #{N}, {SHA}]`
   - New LOW follow-up section (banked in Phase 4a): no fills needed at Phase 6 (this is a NEW pending entry, not a resolution)

**Commit message:**
```
docs: fill PR #{TBD} placeholders (Resend invite UI closure) — fifteenth Rule 16 application
```

**Rule 15 verification (mandatory):**
- After push: `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
- `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
- Confirm local HEAD == origin/main.
- Report "pushed and verified" with all SHAs visible.
- Any mismatch → STOP. Hard-stop.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `sendPasswordReset` signature in authService.js doesn't match CC's audit assumption | Low-Medium | Phase 1 step 3 hard-stops if signature diverges; brief Phase 2 step 1 documents adjustment via Phase 1 findings |
| Audit module doesn't exist or `auditAdminEmailUpdates` is structured differently | Low-Medium | Phase 1 step 4 hard-stops if no audit module; scope may need reduction (defer audit log entry as separate sub-PR) |
| ConfirmDialog prop API differs from assumption | Low | Phase 1 step 5 captures actual API; Phase 2 step 2 uses verified props |
| Existing tests in UserManagementPanel.test.jsx use patterns that conflict with new tests | Low | Phase 1 step 9 captures patterns; Phase 2 step 5 follows same patterns |
| Race condition in new tests (CI passes locally, fails on CI — same pattern as PR #210) | Low-Medium | Phase 2 step 5 explicitly applies `await waitFor(...)` discipline learned from PR #210 |
| Lucide icon (`MailPlus` or `Send`) not exported in installed lucide-react version | Very Low | Both icons are core lucide-react exports; lint+build catches any missing icon |
| Smoke walk surfaces unexpected UI rendering issue (e.g., button visible but click does nothing) | Low | Phase 3 step 5 is 12-step smoke walk; any failure surfaces in Phase 5 report |
| Audit log entry writes successfully but Firestore rules block read for the actor | Low-Medium | Phase 1 step 4 captures audit pattern (which presumably already handles its own rule path); same pattern applies |
| Resend triggers BUT Firebase Auth doesn't actually send email (template issue) | Low | Existing `sendPasswordReset` already works for the password-reset flow elsewhere; same primitive |

---

## Strike count

**0/2** — clean entering this PR.

Three-day arc summary at brief authoring:
- 12 work PRs shipped (FU-J → FU-N methodology + 5 cleanup/hygiene PRs + this would be 13th)
- 14 Rule 16 cycles, zero drift (this would be 15th)
- 14 Rule 17 in-the-wild signals (Phase 1 may surface a 15th — predicted around audit module signature divergence)
- 7+ Rule 11 corrected-diagnosis preservations
- 3 Rule 9 in-PR scope extensions

Strike count holds 0/2 throughout. The discipline continues to catch what brief authoring rushes; Phase 1 source-verification is the key gate; smoke walk RUNS for user-visible behavior changes.

---

## End of brief.
