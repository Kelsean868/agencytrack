# PR-D — Server-side email infrastructure — kickoff brief

**Status:** Pilot-prep PR. Closes HIGH#5 from pilot-readiness audit. Independent of PR-F (test data tooling) and PR-E (golden-path walk).
**Estimated CC effort:** 0.5-1 day (assuming SMTP procurement done by Kelsean as a pre-flight step).
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 1/2.

---

## Context

The current email infrastructure has two known weaknesses:

1. **Client-side `sendPasswordResetEmail` dispatch** — both `agentManagementService.createUser` (single-user) and `BulkImportUsersModal`'s `dispatchResetEmails` (CSV import) fire the email from the client after the Cloud Function provisions the user. The Admin SDK has no `sendPasswordResetEmail` equivalent (`generatePasswordResetLink` only returns a string), so the email is necessarily client-dispatched today. Failure modes: network flakiness, browser closed before dispatch, client-clock skew rejecting Auth tokens. When the email fails, the user is stranded — no way to sign in. UI surfaces a Retry button but if the admin doesn't notice, the new user calls the help desk.

2. **Sunday-nudge email stub** — a scheduled CF stub exists for the weekly Sunday nudge but doesn't actually dispatch emails (mail/ collection writes are absent everywhere in the codebase).

The Firebase Trigger Email Extension (`firebase/firestore-send-email`) solves both. It watches a Firestore collection (default `mail`); when a doc is written with `to:` and `template:` or `message:` fields, the extension dispatches via configured SMTP. The CF saga writes to `mail/` after success — fully server-side, durable, retry-able, audit-friendly.

**What this PR DOES:**
- Install + configure Firebase Trigger Email Extension
- Migrate single-user password-reset dispatch from client `sendPasswordResetEmail` to server-side `mail/` collection write
- Migrate bulk-import password-reset dispatch (same migration pattern)
- Wire up the Sunday-nudge email stub to write to `mail/`
- Firestore rules for `mail/` collection — restrict writes to admin SDK only (locked-down)
- UI changes: remove client-side email retry surfaces (no longer needed); keep simpler success/failure feedback

**What this PR does NOT do:**
- Build a full templating system (extension supports basic templates; that's enough for pilot)
- Implement email analytics, click tracking, or open-rate reporting
- Build an in-app "email log" surface (post-pilot)
- Handle bounce / unsubscribe flows (post-pilot, requires more thought)
- Switch transactional emails to a marketing-email service (e.g., SendGrid Marketing, Customer.io)
- Notify users via in-app channels other than email (push notifications stay out of scope)

**Closures expected in PR description:**
- Resolves HIGH#5 from pilot-readiness audit
- Closes the "Sunday-nudge actual email send" follow-up bundled in this PR
- Improves pilot SLA: network-flake recovery, server-side audit trail of every email dispatched

---

## ⚠️ Pre-flight — Kelsean's procurement task

**This MUST happen before CC starts Phase 1.** Without SMTP credentials, the extension can be installed but won't deliver email.

### Step 1 — Choose SMTP provider

Recommended options for pilot:

| Provider | Free Tier | Setup Effort | Pros | Cons |
|----------|-----------|--------------|------|------|
| **SendGrid** | 100/day | Medium | Industry standard, good deliverability, decent free tier | Account verification can take a day |
| **Mailgun** | 100/day for 30 days then pay | Medium | Reliable, good API | Free tier expires |
| **AWS SES** | 200/day from EC2/Lambda; pay otherwise | Higher | Cheap at scale, AWS infrastructure | More setup, separate AWS account |
| **Gmail SMTP** | 500/day per Gmail account | Low | Already have account | Low limit, branded with sender email, can be flagged |

**Recommendation: SendGrid for pilot launch.** Free tier (100/day) covers ~50-agent pilot. Single-sender verification is acceptable for pilot (vs full domain verification which takes a day). Post-pilot, upgrade or migrate.

### Step 2 — SendGrid account setup

1. Sign up at sendgrid.com (free)
2. Verify the sender email — use an email you control (e.g., a Tatil-owned alias or `noreply@<your-domain>` if you own a domain)
3. In SendGrid → Settings → API Keys → Create API Key → "Restricted Access" → enable "Mail Send" only
4. Copy the API key (32-char hex) — you'll need it for the extension config
5. Save the API key somewhere safe (1Password, etc.)

### Step 3 — Confirm before CC starts

Verify you have:
- [ ] SendGrid (or alternative) account active
- [ ] Sender email verified
- [ ] API key generated and saved
- [ ] Confirmed sender email (e.g., `agencytrack@tatillife.com` or `noreply@agencytrack.com`)
- [ ] Confirmed display name (e.g., "AgencyTrack")
- [ ] Decided on reply-to address (likely same as sender for pilot)

Once those are all checked, send the PR-D directive to CC.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm HEAD includes PR #132 (FU#3 channel-split) at top.
4. Confirm clean state: `git worktree list`
5. Create worktree at `.claude/worktrees/feat-pr-d-server-side-email` on branch `feat/pr-d-server-side-email`.

---

## Phase 2 — Discovery

### 2a — Trigger Email Extension research

1. Read https://firebase.google.com/docs/extensions/official/firestore-send-email (via web search if needed)
2. Capture:
   - Default collection name and configurability
   - Doc shape: required fields (`to`, `message`, `template`, etc.) and optional fields
   - Template system: how templates are stored, parameter substitution, HTML/text bodies
   - Status field: how the extension writes back delivery status (success/failure/bounce)
   - Retry behavior: does it retry on transient SMTP failures? How many times?
   - Required IAM roles + service accounts
   - Cost model: per-document, per-mail dispatch, Cloud Function invocation costs

### 2b — Existing email infrastructure inventory

1. **Single-user createUser path:**
   - Read `src/services/agentManagementService.js` `createUser` function in full
   - Note: returns `{ success, uid, emailSent, emailError? }` for client to distinguish provisioned-with-email-success from provisioned-but-email-failed
   - Read `functions/index.js` `createUser` Cloud Function — confirm it does NOT currently write to mail/

2. **Bulk import path:**
   - Read `src/services/bulkImportUsersService.js` `dispatchResetEmails` function in full
   - Confirm it uses client-side `sendPasswordResetEmail` per row
   - Confirm `functions/index.js` `bulkImportUsers` Callable does NOT currently write to mail/

3. **UI surfaces that handle email retry:**
   - `src/components/manager/UserManagementPanel.jsx` — read the toast/retry pattern for warning state ("warning" kind, no auto-dismiss, with Retry button)
   - `src/components/admin/BulkImportUsersModal.jsx` — read the per-row email status surfacing

4. **Sunday-nudge stub:**
   - `grep -r "sunday" functions/` and `grep -r "nudge" functions/` to find the scheduled CF
   - Read it in full — what does it currently do? Does it iterate over users? Compute "missing-Sunday-submission" logic? Is the stub just `console.log("would send nudge")` or further along?
   - Find where it's scheduled (`onSchedule(...)` or pubsub trigger in functions/index.js)

5. **Mail/ collection:**
   - `git grep "mail/"` to confirm no existing writes anywhere
   - Verify Firestore rules at `firestore.rules` — no `mail/` rules exist yet

### 2c — Email template requirements

Determine what templates need to exist for pilot:
- **Password reset email** — when a new user is created or admin clicks retry. Should include link, branded header, plain support copy.
- **Sunday nudge email** — sent Sundays to agents who haven't submitted their weekly report yet. Should include a CTA link to the wizard.

For each template, capture:
- Sender (FROM)
- Display name
- Subject line
- Plain-text body
- HTML body (optional but better for deliverability)
- Variable substitutions needed (user's name, reset link, dashboard link, etc.)

---

## Phase 3 — Design surface (STOP HERE — design gate)

Output a structured proposal:

```
PR-D DESIGN SURFACE

EXTENSION CONFIG:
- Extension: firebase/firestore-send-email v0.X
- Collection name: mail (default — or custom?)
- SMTP provider: SendGrid (Kelsean-supplied API key)
- SMTP host: smtp.sendgrid.net
- SMTP port: 587 (TLS)
- SMTP username: apikey (SendGrid convention)
- SMTP password: <Kelsean's API key — placeholder during install, real value injected at deploy>
- Default FROM: <Kelsean's verified sender>
- Default Reply-To: <same or specified>
- Templates collection: <default 'templates' or custom?>

CF SAGA EXTENSIONS:

1. createUser CF (functions/index.js):
   - After successful Auth + Firestore + claims provision, write to mail/ with:
     - to: targetEmail
     - template: { name: 'password-reset', data: { userName, resetLink } }
   - resetLink: generated via admin.auth().generatePasswordResetLink(targetEmail, actionCodeSettings)
   - On mail write failure: log warning, return success anyway (account is provisioned; admin can retry)
   - Return shape changes: { success, uid, emailQueued: true } (replacing emailSent / emailError fields)

2. bulkImportUsers CF (functions/index.js):
   - After each successful row's Auth + Firestore + claims, write to mail/ for that user
   - Same pattern as createUser
   - Per-row mail/ write failure surfaces in the row result for the modal to display

3. sundayNudge scheduled CF:
   - For each agent without a current Sunday submission, write to mail/ with template 'sunday-nudge'
   - Run weekly, Sunday morning local time per tenant

UI MIGRATIONS:

1. UserManagementPanel.jsx:
   - Remove the 'warning' toast kind + Retry button (client-side email retry is gone)
   - Show simpler success toast: "Account created for {email}. Password reset email queued."
   - Behind the scenes: the mail/ doc status field will eventually update to 'success' or 'error'. Future enhancement could poll this, but for pilot, the simplification is acceptable.

2. BulkImportUsersModal.jsx:
   - Remove the dispatchResetEmails step entirely (CF handles it server-side)
   - Per-row status no longer includes email-sent/failed — just "queued" implicit in success
   - Summary copy update

3. agentManagementService.createUser:
   - Remove sendPasswordResetEmail call after CF returns
   - Return shape: { success, uid, emailQueued: boolean }

4. bulkImportUsersService.dispatchResetEmails:
   - Function deleted entirely (no longer used; CF handles it)
   - Update callers in BulkImportUsersModal

FIRESTORE RULES (mail/ collection):
- Default-deny all client reads/writes
- Extension uses admin SDK which bypasses rules
- Allow admin-SDK CF code to write via service account
- No client-side reads (mail/ doc status updates aren't surfaced in UI for pilot)

TEMPLATE DEFINITIONS:
1. password-reset:
   - Subject: "Welcome to AgencyTrack — set your password"
   - Plain: "Hi {{userName}}, ... reset link: {{resetLink}}"
   - HTML: <similar with branded header>
2. sunday-nudge:
   - Subject: "Your weekly check-in for {{weekStarting}} is ready"
   - Plain: "Hi {{userName}}, take 5 min to submit your weekly numbers..."
   - HTML: <similar>

TEMPLATES STORAGE:
- Store template definitions in functions/email-templates/ as plain files (committed to repo)
- CF saga reads template at runtime, substitutes variables, writes plain mail/ doc with rendered message
- OR use extension's built-in template collection — simpler but harder to version-control
- RECOMMENDATION: in-repo templates; surface tradeoff below

NEW / MODIFIED FILES:
| File | Change | LOC est |
|------|--------|---------|
| functions/index.js | Add mail/ writes to createUser + bulkImportUsers; rewrite sundayNudge stub | ~80 |
| functions/email-templates/password-reset.html | NEW | ~30 |
| functions/email-templates/password-reset.txt | NEW | ~15 |
| functions/email-templates/sunday-nudge.html | NEW | ~30 |
| functions/email-templates/sunday-nudge.txt | NEW | ~15 |
| functions/utils/email.js | NEW — template rendering helper | ~50 |
| firestore.rules | Add mail/ collection rules | ~10 |
| firestore.indexes.json | (No new indexes expected) | 0 |
| src/services/agentManagementService.js | Simplify createUser return shape | -10 |
| src/services/bulkImportUsersService.js | Delete dispatchResetEmails function + callers | -40 |
| src/components/manager/UserManagementPanel.jsx | Simplify toast logic, remove retry surface | -30 |
| src/components/admin/BulkImportUsersModal.jsx | Simplify per-row results, remove email status | -20 |
| docs/runbooks/email-troubleshooting.md | NEW — debug guide for failed emails | ~100 |

Total: ~7 new files, 5 modified files, net ~+100 LOC.

SCOPE / SPLIT DECISION:
Recommendation: single PR. The CF + UI changes are tightly coupled (CF write shape determines UI behavior). Splitting risks shipping with mismatched code paths. The full migration is ~1 day with template authoring being the most time-consuming piece.

OPEN QUESTIONS FOR KELSEAN:
1. Extension config: confirm collection name = 'mail' (default), or custom?
2. SMTP provider: SendGrid as recommended, or alternative? If SendGrid, confirm API key has been generated.
3. Sender email: what's the verified address? (e.g., agencytrack@tatillife.com)
4. Display name: "AgencyTrack" or branded with Tatil Life?
5. Templates storage: in-repo files (recommended) vs extension's template collection. In-repo means template changes need a PR; collection means runtime editing but no version control. RECOMMENDATION: in-repo for pilot, can migrate to collection later if Tatil wants self-service template editing.
6. Sunday-nudge timing: what time/day? Sunday morning local time (Trinidad UTC-4)? Sunday evening? Specific hour?
7. Sunday-nudge filtering: should nudge skip deactivated users? Should it skip agents who haven't logged any activity in N days (truly disengaged) vs agents who normally submit (just missed this week)?
8. Email branding: any constraints from Tatil Life on sender domain, branding style, footer copy, legal disclaimer?
9. Bounce/unsubscribe handling: post-pilot OK to defer, or does Tatil have compliance concerns?
10. Cost: extension uses Cloud Functions which has per-invocation costs. For 50-agent pilot, ~50 password-reset emails (mostly at onboarding) + 50/week Sunday nudges = ~250/month dispatches. Well within free tier. Confirm acceptable?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock template content + sender details
- Confirm SMTP provider + extension config
- Answer the 10 open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **Install Firebase Trigger Email Extension** — `firebase ext:install firebase/firestore-send-email --project agencytrack-2a610`
2. Configure with SMTP credentials provided in Phase 3
3. Add `mail/` Firestore rules — admin-SDK-only access
4. Create email template files in `functions/email-templates/`
5. Create `functions/utils/email.js` — template rendering helper (load file, substitute `{{variable}}` markers, return rendered subject/text/html)
6. Modify `createUser` CF to write to mail/ after success
7. Modify `bulkImportUsers` CF to write to mail/ per row after success
8. Implement `sundayNudge` CF — schedule + nudge logic + mail/ writes
9. Simplify `agentManagementService.createUser` — remove client-side `sendPasswordResetEmail`
10. Delete `bulkImportUsersService.dispatchResetEmails` + update callers
11. Simplify `UserManagementPanel.jsx` toast surface
12. Simplify `BulkImportUsersModal.jsx` per-row results
13. Write `docs/runbooks/email-troubleshooting.md` — debug guide

**Pre-merge CF deploy (per CLAUDE.md additive-CF rule):**

The CF changes are additive (new mail/ writes in existing saga; new sundayNudge CF). Per CLAUDE.md, CC can deploy from feature worktree before PR merges so production smoke can exercise the real CF + extension flow. Capture deploy output in PR description.

```
firebase deploy --only functions --project agencytrack-2a610
```

The extension install itself happens once (in Phase 4 step 1-2) and persists across deploys.

---

## Phase 5 — Tests

Required coverage:

- **CF unit tests (if functions/__tests__/ infra exists)** — verify createUser writes to mail/, bulkImportUsers writes per row, sundayNudge filters correctly
- **UI tests** — UserManagementPanel + BulkImportUsersModal updated assertions
- **Template rendering test** — email.js helper verifies substitution + missing-variable handling
- **Rule tests (if rules-unit-testing infra exists)** — verify client cannot read or write mail/

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable)

**Critical: this smoke involves real email dispatches to a test email address.** Plan accordingly.

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession. Direct buildBypassUrl forbidden per CLAUDE.md cookie-after-handshake rule.

### Smoke scope

**Pre-flight:**
- Sign into a test email account that you (CC) can read via SMTP/IMAP or manual web inbox check
- Configure that as TEST_EMAIL_RECIPIENT in the smoke script env

**Smoke 1 — Single-user createUser with email dispatch:**
1. Sign in as tenant_admin via Playwright bypass
2. Open CreateUserDrawer
3. Fill in: name "PR-D Smoke User", email = TEST_EMAIL_RECIPIENT
4. Submit
5. Verify success toast appears
6. Wait 30-60 seconds for mail/ doc to be written and extension to dispatch
7. Query Firestore for the mail/ doc created in this run (via admin SDK or REST):
   - Verify `to` field matches TEST_EMAIL_RECIPIENT
   - Verify `delivery.state === 'SUCCESS'` (or whatever extension's terminal state is)
   - Capture the doc as evidence
8. Optionally: poll TEST_EMAIL_RECIPIENT's inbox (if API access available) and verify email arrived
9. Capture screenshot of resulting state

**Smoke 2 — bulk import with email dispatch:**
1. Generate a small test CSV (3 users) with all email addresses = TEST_EMAIL_RECIPIENT + variations (e.g., test+1@..., test+2@..., test+3@...)
2. Open BulkImportUsersModal as tenant_admin
3. Upload CSV → preview → confirm import
4. Verify all 3 rows show successful provisioning
5. Wait 60-90 seconds
6. Query mail/ for 3 docs corresponding to this batch
7. Verify all 3 dispatched successfully
8. Capture evidence

**Smoke 3 — Sunday nudge (manual trigger):**
1. Find or temporarily create an agent who hasn't submitted this week's Sunday report
2. Manually trigger the sundayNudge CF via firebase functions:shell or HTTP trigger if exposed
3. Verify a mail/ doc is written with the nudge template
4. Verify the email dispatches

**Smoke 4 — Cleanup:**
1. Deactivate the smoke test users (PR-D Smoke User + 3 bulk-import users)
2. Don't delete the mail/ docs — keep them as evidence in the PR

### Smoke gates

- All 3+ smoke flows complete without errors
- mail/ docs have `delivery.state === 'SUCCESS'` (or extension's success indicator)
- Test inbox receives the emails (manual verification acceptable for pilot)
- No regression on PR-4b user creation (test agent created via this flow can actually sign in)
- No console errors anywhere

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization (logical chunks):
   - `chore(extensions): install firebase/firestore-send-email`
   - `feat(functions): mail/ collection writes for password reset (createUser + bulkImportUsers)`
   - `feat(functions): wire sundayNudge CF to dispatch via mail/`
   - `feat(theme): remove client-side sendPasswordResetEmail dispatch surfaces`
   - `chore(rules): add mail/ collection rules`
   - `docs: add email troubleshooting runbook`
5. Push, open PR titled: `feat(email): PR-D — server-side email infrastructure (HIGH#5)`
6. PR description MUST include:
   - **Summary:** Replaces client-side `sendPasswordResetEmail` dispatch with Firebase Trigger Email Extension + server-side mail/ writes. Network-flake recovery + retry handled by extension. Wires Sunday-nudge to actually send.
   - **Architecture diagram or description** of the new email flow: CF saga → mail/ write → extension → SMTP → recipient
   - **SMTP provider config note:** "SendGrid free tier active for pilot; pilot scale ~250 dispatches/month within free quota."
   - **Pre-merge deploy:** `firebase deploy --only functions` output captured (per CLAUDE.md additive-CF rule)
   - **Smoke results:** 3+ smoke flows passed with mail/ delivery confirmation
   - **Closes:** HIGH#5 from pilot-readiness audit + Sunday-nudge follow-up
   - **Pilot SLA improvement note:** mail/ docs provide a server-side audit trail of every email dispatched, retry visibility, and recovery story for network failures.
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals extension version incompatibility with current Firebase project setup → SURFACE
- SMTP credentials don't work in Phase 4 install (auth failure) → STOP, surface
- Phase 6 smoke shows mail/ docs being written but extension not dispatching → SURFACE (likely SMTP config issue)
- Phase 6 smoke shows extension dispatching but emails landing in spam → SURFACE, may need DKIM/SPF setup discussion
- Any commit that includes API keys or SMTP credentials → IMMEDIATE STOP (must use env vars or extension config, never committed)
- Token leak (any kind) → IMMEDIATE STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Email analytics, click tracking, open rates
- Bounce / unsubscribe flows (post-pilot)
- Marketing email campaigns
- In-app email log surface (post-pilot)
- Other notification channels (push, SMS)
- Branches Mgmt UI further changes
- Audit log infrastructure for emails (mail/ docs serve as audit for pilot)
- Migration from SendGrid to another provider (decision deferred until post-pilot scale)

---

## What success looks like

After this PR merges + extension is live in production:

1. New user creation triggers an email reliably via server-side dispatch
2. Bulk imports dispatch emails per row reliably
3. Sunday nudge actually sends weekly
4. mail/ docs provide audit trail of every email dispatched
5. Network failures during email send are recoverable (retry visibility, not silent loss)
6. Pilot users get the right emails at the right time
7. HIGH#5 from audit is closed
8. Pilot SLA on email-dependent flows significantly improved

After PR-D, the next pilot-prep PR is **PR-F (bulk test data + cleanup tooling)** — letting Kelsean fully exercise the system with synthetic data, then sweep clean before Tatil roster import.

---

## Notes on followups for after this ships

- Post-pilot: build the in-app email log surface for tenant_admin to see dispatch history
- Post-pilot: implement bounce/unsubscribe flows when scale warrants
- Post-pilot: consider migrating to transactional email service (Postmark, Resend) for better deliverability if SendGrid limits hit
- Post-pilot: add template versioning / A-B testing if needed
- Post-pilot: real-time delivery status polling for UI feedback ("Email sent ✓" vs "Sending..." vs "Failed — retry")
