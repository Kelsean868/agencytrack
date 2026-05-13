# doCreateUser emailQueued Truthfulness Fix — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1–2 hours, single PR.
**Two-strike counter:** Project carry-in **0/2** (clean — post PR-F + memory refresh). Standard 2-strike loop applies.
**Main HEAD at brief drafting:** `ca1f543` — `docs(claude-md): refresh Build Phase History + Current Phase for post-Track-E state`.
**Source:** FOLLOW_UPS.md MEDIUM entry banked in PR #134.

---

## Context

PR-D (#133) shipped server-side email infrastructure via the Firebase Trigger Email Extension. The `doCreateUser` Cloud Function writes a doc to the `mail/` collection (step E-2), which the extension picks up and dispatches via SendGrid. Production smoke verified the happy path 19/19.

PR #134 banked a silent-error-swallow gap: step E-2 returns `emailQueued: true` even when the `mail/` write actually fails. Real-world consequence: admin creates a user, sees "Email sent" feedback, the user never receives a reset link, and no signal of failure reaches the UI.

This brief fixes that.

---

## Decisions locked (do not re-litigate)

### Return shape

`doCreateUser` returns:
- Success: `{ ...existingFields, emailQueued: true }`
- Failure: `{ ...existingFields, emailQueued: false, emailError: '<message>' }`

The boolean stays authoritative — any existing caller checking `result.emailQueued === true` continues to work correctly. The `emailError` field is additive and optional.

### User creation continues even on email failure

Auth user + Firestore doc are already written before step E-2. Email is a notification step, not transactional. User stays created; admin uses the existing Retry path (from HIGH#1 single-user flow) to resend.

### UI affordance

Existing Retry button is the recovery path — no new UI components. The "Create User" toast differentiates based on `emailQueued`:
- `true` → existing success toast
- `false` → warning toast: "User created. Reset email failed — click Retry to resend."

### Test approach

Extend `scripts/verification/pr-d-email-smoke.mjs` with a new test case covering the failure path. CC's Phase 1 determines the exact mechanism (mock-based vs. injection of an invalid mail/ doc) based on the existing smoke's structure. If extending isn't clean, CC surfaces and we discuss.

### Backwards compatibility

No breaking changes to the Callable signature. `emailError` is additive. Existing call sites without the new toast handling continue to work — they'll show the existing toast on both success and failure (which is today's broken behavior, but no worse than today).

---

## Scope

Ships in this single PR:

- `doCreateUser` step E-2 fix — accurate `emailQueued` return
- UI call sites (UserManagementPanel "Create user" plus any other consumer Phase 1 surfaces) updated to surface the failure toast
- `scripts/verification/pr-d-email-smoke.mjs` extended with failure-path test case
- `docs/CONTEXT.md` "Recently shipped" row append (5-row sliding window, drop oldest)
- `docs/FOLLOW_UPS.md` — mark the banked "doCreateUser emailQueued" entry resolved with closing PR # placeholder

---

## File inventory

**Files to touch:**

| Path | Change |
|---|---|
| `functions/index.js` | Fix `doCreateUser` step E-2 to capture mail/ write success/failure and return accurate `emailQueued` + optional `emailError` |
| `src/components/admin/UserManagementPanel.jsx` (or wherever the create-user handler lives — Phase 1 confirms) | Differentiate toast on `result.emailQueued === false` |
| Any other consumers of `doCreateUser` result | Update if affected (Phase 1 surfaces via grep) |
| `scripts/verification/pr-d-email-smoke.mjs` | Add failure-path test case |
| `docs/CONTEXT.md` | Append "Recently shipped" row (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | Mark banked entry resolved with closing PR # placeholder |

**No new files expected.** If Phase 1 surfaces a reason to add one (e.g., a shared helper for email-failure handling), STOP and surface.

---

## Phases

### Phase 1 — Discovery (gates Phase 2)

**Output:** brief surface in chat — no committed discovery doc (fix is small enough that a separate notes file is overkill):

1. `doCreateUser` step E-2 current code — the exact `try`/`catch` block (or lack thereof) handling the mail/ write
2. All call sites consuming `result.emailQueued` (search via grep/findstr across `src/`)
3. Existing smoke structure — how the mail/ write is verified today, where to insert the failure-path test
4. Confirmation that the proposed return-shape change doesn't break any other code paths

Surface to Kyron, wait for acknowledgement before Phase 2.

### Phase 2 — Implementation

- Apply fix to `doCreateUser` step E-2
- Update UI call sites
- Extend smoke with failure-path test case
- Run smoke against preview/production to confirm both success and failure paths assert correctly

### Phase 3 — Lint, build, commit, push, PR

- `npm run lint` → 0 errors
- `npm run build` → success
- Conventional commit(s) — single combined or split by file group, CC's call
- Push, open PR
- **PR title:** `fix(functions): doCreateUser emailQueued truthfulness (#134 follow-up)`
- **PR description must include:** summary, the fix in 2–3 sentences, smoke output showing both paths assert correctly, verification matrix

### Phase 4 — STOP

DO NOT MERGE. Kyron reviews and merges manually after independent verification.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Existing test suite starts failing → STOP and surface
- `doCreateUser` code shape differs materially from this brief's assumptions (e.g., no clear "step E-2" — the mail/ write is structured differently) → STOP and surface
- Existing smoke can't be cleanly extended with the failure-path test → STOP and surface, discuss approach
- Any UI call site has unusual coupling that makes toast differentiation invasive → STOP and surface
- More than 2 UI call sites need touching → STOP and surface (suggests scope mismatch)
- First unexpected behavior of any kind — standard 2-strike loop applies, but lean toward surfacing early

---

## NOT in scope

- Other Cloud Function refactors
- New retry UI — existing Retry path is canonical
- Mail/ collection schema changes
- SendGrid configuration changes
- Email template changes
- Bulk user import path — already handles email failures correctly via `dispatchResetEmails`
- Single-user manual retry flow — already shipped in HIGH#1
- Server-side email queueing infrastructure (PR-D's scope)

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test` | 100% pass, no new failures |
| Build succeeds | `npm run build` | success, no warnings |
| Smoke pass (both paths) | `node scripts/verification/pr-d-email-smoke.mjs` | Both success and failure paths assert correctly |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | "Recently shipped" row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | Banked emailQueued entry marked resolved |
| Call-site coverage | (grep output in PR description) | All consumers of `result.emailQueued` accounted for |

---

## CC kickoff prompt (one-liner)

> Execute the doCreateUser emailQueued fix per the brief in `docs/briefs/docreateuser-emailqueued-fix-kickoff.md`. Project strike count 0/2 (clean). Standard 2-strike loop. Read the brief in full, then begin Phase 1 (Discovery). Surface findings in chat before any code changes. Do NOT merge — open PR and stop.
