# PR brief — Copy invite link (out-of-band onboarding)

**Sized:** M
**Branch:** `feat/copy-invite-link`
**Type:** Additive — extends an existing CF + a UI affordance + one audit field. Security-sensitive (auth-link exposure) → human-merge + pre-review; **not** auto-merge eligible.

## Outcome
Give managers a way to **copy a user's set-password link** and relay it privately (Teams/WhatsApp), because the customer's M365 tenant silently filters the invite emails. Reuses the existing `resendInviteEmail` link generation + authz + audit; adds a delivery channel that returns the link to the caller instead of only emailing it, plus a "Copy invite link" control on the user-management row.

Covers both never-logged-in users (set-password) and existing users (reset) — `generatePasswordResetLink` handles both.

## Why this is small
`resendInviteEmail` already gates to an actor set, generates the reset link server-side (`generatePasswordResetLink` → `buildMailDoc`), and audits to `auditInviteResends`. We add one delivery channel (`'link'` → return it) and one UI control. No new authz model, no new link mechanism, no new continue-URL decision (reuse the existing ActionCodeSettings).

## Decisions locked
1. **Extend `resendInviteEmail`; don't add a sibling.** New param `channel: 'email' | 'link'` (default `'email'` — preserves current behavior and existing callers). `channel: 'link'` → run the same authz gate + email resolution, generate the link, write an audit entry, **return `{ link }`**, and **skip** the `mail/` doc. Phase 1 confirms this beats a sibling CF after reading the function.
2. **Reuse existing ActionCodeSettings / continue URL** (whatever `createUser` / `resendInviteEmail` use today). Not re-litigated here; if it's wrong, that's a separate fix affecting create too.
3. **Reuse `auditInviteResends`** + add a `method: 'email' | 'link'` field so copy-link events are distinguishable. Rules unchanged — existing read-scope is correct.
4. **Returning the link to the client is a deliberate, audited exposure.** Same actor gate; link is short-lived + single-use; never `console.log` the link; UI pushes immediate copy + private send.
5. **UI: consolidate invite actions into one control.** The row is already at its 3-button limit (Edit | Resend | Deactivate; kebab deferred). Replace the standalone "Resend invite email" button with an **"Invite ▾"** control: **Copy link** (primary — email is filtered) and **Resend email** (secondary). Row stays at 3 controls. Fallback if the dropdown balloons scope: add "Copy invite link" as a 4th button and leave Resend as-is.
6. **Copy-link caveats — surface in the modal/popover:** "Link expires in ~1h"; "Generating this invalidates any previous invite link for this user" (same Firebase single-active-link caveat the Resend ConfirmDialog already uses); "Send it privately — anyone with the link can set the password."

## DECISION NEEDED — actor set (unit_manager)
`RESEND_INVITE_ACTOR_ROLES = {platform_admin, tenant_admin, sales_manager, branch_manager}` — **excludes unit_manager.** But unit_managers create agents (creation matrix) and are the front-line onboarders. With email filtered, excluding them bottlenecks agent onboarding at branch_manager+.

- **Option A (parity / safe default):** copy-link reuses the existing actor set; unit_managers can't copy links. Zero security-surface change.
- **Option B (recommended):** widen the actor set to include `unit_manager`, **unit-scoped** via the existing can-manage matrix (they can only link their own-unit agents). One-line gate change; audit-read rules need not change.

Brief builds **Option A** unless told otherwise. Flip to B on one word.

## Out of scope
- Kebab/overflow responsive refactor for action rows (banked mobile-manager pass).
- The emailed template, and the end-user forgot-password flow (`authService.sendPasswordReset` used by `LoginScreen` — untouched).
- Showing the link at create-time in `CreateUserDrawer` (nice future enhancement; separate FU).
- Broader audit-infra consolidation.
- Any change to `createUser` E-2 behavior.
- **Bulk-creating the 15 pilot users** — out of scope for this feature (handled via the existing create-user / CSV-import flow). This feature only adds the copy-link affordance.

## Phase 0 — gate
Standard sync + worktree. Confirm `main` clean (apart from known untracked residue), capture `git log origin/main --oneline -1`. Create worktree `../agencytrack-worktrees/copy-invite-link` on `feat/copy-invite-link`. STOP on divergence.

## Phase 1 — source-verify (Rule 17 — thorough; pair each claim with a command). HARD STOP, report before building.
1. `resendInviteEmail` signature, return shape, and how it generates the link:
   `git grep -n "resendInviteEmail\|RESEND_INVITE_ACTOR_ROLES\|generatePasswordResetLink" functions/index.js`
2. `buildMailDoc` + ActionCodeSettings/continue-URL location:
   `git ls-files functions/utils/email.js` ; `git grep -n "buildMailDoc\|actionCodeSettings\|continueUrl\|url:" functions/index.js functions/utils/email.js`
3. Exact actor-set membership:
   `git grep -n "RESEND_INVITE_ACTOR_ROLES" functions/index.js`
4. `auditInviteResends` write shape (fields to mirror + where `method` slots in):
   `git grep -n "auditInviteResends" functions/index.js firestore.rules`
5. UserManagementPanel action cell + existing Resend button + gate + dialog/toast primitives:
   `git grep -n "Resend\|handleResend\|canAct\|isInactive\|ConfirmDialog\|useToast" src/components/manager/UserManagementPanel.jsx`
6. userService wrapper pattern:
   `git grep -nE "resendInvite|httpsCallable|createUser" src/services/userService.js`
7. Existing CF tests for `resendInviteEmail` (mirror them):
   `git grep -rn "resendInviteEmail" functions/`
8. Lucide icons already in the action cell (icon choice — `Link` / `Send` / `Copy`):
   `git grep -n "lucide-react" src/components/manager/UserManagementPanel.jsx`

**Report:** cleanest extension shape (param + return), exact audit fields, chosen UI pattern (Invite dropdown vs 4th button) + the action-cell class to match, the link TTL, and confirmation the continue URL is already configured.

## Phase 2 — CF: channel param + return link + audit method
- Add + validate `channel` (default `'email'`).
- `channel: 'link'`: after the existing authz gate + email resolution, call the same generator (`generatePasswordResetLink` w/ existing ActionCodeSettings), write an `auditInviteResends` doc with `method: 'link'`, return `{ success: true, link, ... }`. Do **not** write a `mail/` doc. Never log the link.
- `channel: 'email'`: unchanged path; stamp `method: 'email'` on its audit doc.
- Refuse `active: false` targets (don't hand a working link to a deactivated account). Mirror any self-target block the CF already has.
- If Option B: widen the actor gate to include `unit_manager` with the existing unit-scope check; else leave unchanged.

## Phase 3 — UI: Invite control + copy modal
- `src/services/userService.js`: add `getInviteLink(uid)` → `httpsCallable(functions,'resendInviteEmail')({ uid, channel:'link' })`, returns `data.link`. Leave `resendInvite(uid)` as-is.
- `UserManagementPanel.jsx`: build the Invite control (per Phase 1 decision). "Copy link" → call `getInviteLink`, open a modal/popover with the link in a read-only field + a Copy button (clipboard write + `aria-live` "Copied") + the three caveats from Decision 6. Loading state on the control; error states (permission-denied / user-not-found / inactive / network) via the existing toast.
- Accessibility + design: `aria-label` from the start ("Invite options for {name}"); modal focus-trap + Esc; 44px targets; Lucide icon; Nexus tokens (no hardcoded hex); dark-mode correct. **Read `frontend-design` SKILL.md before writing the component.**
- Visibility gate mirrors the actor set (A or B) and `!isInactive`.

## Phase 4 — docs (with placeholders)
- `docs/FOLLOW_UPS.md`: bank any deferral (create-time link affordance; kebab pass). Add a Recently-shipped note with `#{TBD}` PR placeholders.
- `CONTEXT.md`: add a Recently-shipped row (Copy invite link); drop the oldest; `#{TBD}` placeholders filled in Phase 6.
- Keep CLAUDE.md lean (one-line pointer only if a runbook/feature index already exists).

## Phase 5 — commit / push / PR
- Conventional commit: `feat(user-mgmt): copy invite link for out-of-band onboarding`.
- PR body: outcome, the channel-param design, the actor-set decision taken (A/B), the deliberate-link-exposure rationale + audit.
- Poll Gemini bot review; disposition each comment (Rule 21).
- Report feature-branch HEAD SHA (Rule 20); no silent post-report pushes.
- **Tests in-PR:** CF emulator (actor gate incl. the excluded/added role, tenant isolation, inactive refusal, link returned for `'link'`, mail/ doc written + no link for `'email'`, audit `method` stamped); `UserManagementPanel.test.jsx` (control visibility per role, copy flow, error states) with `userEvent delay:0` + explicit `waitFor` (avoid the banked CI-race patterns).
- **Smoke = post-merge-and-deploy** (CF + rules-adjacent): login as an authorized manager → `getInviteLink` for a canary user → assert a link returns and an `auditInviteResends` doc with `method:'link'` appears. One negative check (an unauthorized role is rejected). Not pre-merge.

## Phase 6 — post-merge
Do not auto-run. After human squash-merge: `firebase deploy --only functions` (+ rules if touched) → post-deploy smoke → `/post-merge <pr>` to fill `#{TBD}` placeholders.

## Dispatch
1. Save to `docs/briefs/feat-copy-invite-link-kickoff.md`.
2. (Want Option B? Say so and I'll set the actor-set decision before you land it.)
3. `/land-brief` → squash-merge the docs PR.
4. `/dispatch docs/briefs/feat-copy-invite-link-kickoff.md` → CC hard-stops at Phase 1; paste findings back.
