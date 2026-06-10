# Brief: Custom Branded Password-Reset Handler

## Objective
Replace Firebase's default hosted reset page with an in-app, Nexus-styled
handler so pilot onboarding (invite → set password → login) stays branded.
Validated end-to-end via the operator's canary BEFORE bulk provisioning.

## Current state
- Invite {{resetLink}} → Firebase default action handler (generic UI) →
  redirect to agencytrack.vercel.app.
- App is ROUTERLESS (single-page, role-based render in App.jsx). No
  confirmPasswordReset/oobCode anywhere.
- Link gen: CF doCreateUser (~L395) + resendInviteEmail (~L543) via
  generatePasswordResetLink(email, { url: 'https://agencytrack.vercel.app' }).
- TIMING: no real pilot users exist yet — a regression affects only the
  operator's testing. This is the safe build window.

## Scope
- NEW ResetPasswordHandler component, styled to match LoginScreen.
- App.jsx: SURGICAL early guard — if URL has mode=resetPassword + oobCode,
  render the handler BEFORE auth/role logic; otherwise behavior UNCHANGED.
- Firebase action routing so the reset link lands on the in-app handler with
  the oobCode. CC chooses the mechanism (Console custom action URL vs
  actionCodeSettings), documents it, and ensures non-resetPassword modes
  don't break. Adjust + redeploy CF only if the mechanism requires it.

## Risk areas (handle explicitly)
1. App.jsx change is highest-risk — a bug breaks ALL app loads. Must be a
   clean early-return guard: no action params → renders exactly as today.
   Proven by regression smoke.
2. Auth correctness — handle EVERY state: verifying, invalid/expired oobCode
   (branded error + "request a new link"), weak password (match app/Firebase
   rules), success + redirect to login, network error.
3. The action URL is global — only password reset is used in the pilot;
   other modes must degrade gracefully.

## Execution
P1. Build ResetPasswordHandler: read mode+oobCode → verifyPasswordResetCode
    → invalid? branded error : Nexus set-password form → confirmPasswordReset
    → success + redirect to login. All states styled like LoginScreen.
P2. App.jsx early param-guard; no-params path behaviorally unchanged.
P3. Implement + document the Firebase routing mechanism (+ exact revert).
    Adjust/redeploy CF only if required.
P4. Smoke (preview): REGRESSION — normal load + login + a dashboard render
    with NO action params. Then reset-handler render/state check as far as
    testable on preview. PASS/FAIL each.
P5. CONTEXT.md + FOLLOW_UPS.md (#TBD), commit on feat branch, PR. NOT
    auto-merge eligible. HOLD for operator review.

## Revert (state in PR)
Fastest rollback if the canary fails: flip the Firebase action URL back to
default (new links route to Firebase's page immediately), then revert
App.jsx + CF and redeploy. Exact steps in the PR.

## Post-merge validation (the real gate)
After merge + production deploy + action URL pointed at production:
- CANARY (operator's own agent): invite → click link → BRANDED handler →
  set password → redirect → log in. End-to-end.
- REGRESSION: an existing preserve account still logs in normally.
- Both pass → cleared for bulk provisioning. Either fails → revert,
  bulk-provision on the default page.

## Acceptance
- Handler matches LoginScreen, handles all enumerated states.
- App.jsx no-params behavior provably unchanged.
- Reset link lands on the in-app handler; canary flow completes end-to-end.
- Revert documented. Bulk provisioning gated on canary PASS.
