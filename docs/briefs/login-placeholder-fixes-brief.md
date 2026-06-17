# Brief: Login screen — placeholder fixes (password dots + email)

## Context
Two placeholder issues on the sign-in screen, both from live-user feedback:
- The password field shows a placeholder of dots (••••••••). Because the dots are dark, users read them
  as an already-entered password and try to clear them.
- The email field placeholder is "you@tatillife.com" — domain-specific and misleading (agents log in
  with whatever email their manager registered, and the real domain is @tatil.co.tt anyway).

## Decisions (locked)
1. **Password field: remove the dot placeholder entirely** (empty placeholder). The "Password" label
   above the field is sufficient; an empty field is unambiguous. (Lightening the dots was the
   alternative — rejected because dots still read as entered text even when light.)
2. **Email field: placeholder "you@tatillife.com" → "you@youremail.com"** (generic, still shows the
   expected format).

## Scope
- The login / sign-in screen component only.
- Two single-attribute changes: password `placeholder` → empty; email `placeholder` → "you@youremail.com".

## Out of scope
- Any auth logic, validation, submit handling, or masking behaviour.
- The "Forgot password?" flow.

## Procedure note
Branch at **Phase 0, before any code**. PowerShell — no `&&`.

## Phase 1 — recon (report before building)
1. Locate the login/sign-in component (`git grep` for "you@tatillife.com" and the password input).
2. Confirm the password dots are a `placeholder` attribute (not a pre-filled value or a masking
   artifact). **If the dots are NOT a placeholder** (e.g., a default `value`), STOP and report — the fix
   differs.
3. Report, then proceed.

## Phase 2 — build
- Password input: remove the dot placeholder (set to empty / drop the attribute).
- Email input: `placeholder` → "you@youremail.com".

## Verification (smoke)
On the preview login screen:
- Password field renders **empty** (no dots) before any input; typing still masks normally.
- Email field placeholder reads "you@youremail.com".
- Both themes render cleanly.
- PASS/FAIL each leg.

## Phase 4-5
- Docs placeholders. Commit on the feature branch, push, open PR. HOLD for human review.

## Acceptance
- No dot placeholder on the password field; email placeholder genericized; no auth-behaviour change.

## Risks
- Minimal — placeholder-attribute changes only. The one thing recon must confirm: the dots are truly a
  placeholder, not a pre-filled / default value (a different fix if so).
