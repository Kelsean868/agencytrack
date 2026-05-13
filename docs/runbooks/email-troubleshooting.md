# Email Troubleshooting Runbook

AgencyTrack uses the **Firebase Trigger Email Extension** (`firestore-send-email`) to dispatch all transactional email. Cloud Functions write to the top-level `mail/` collection; the extension picks them up and delivers via SendGrid SMTP.

## How email delivery works

1. A Cloud Function writes a document to `mail/`:
   ```js
   admin.firestore().collection('mail').add({
     to: 'user@example.com',
     message: { subject: '...', text: '...', html: '...' },
   });
   ```
2. The extension processes the document and updates it with delivery state:
   - `delivery.state`: `PENDING` → `PROCESSING` → `SUCCESS` | `ERROR` | `RETRY`
   - `delivery.attempts`: integer (incremented per try)
   - `delivery.endTime`: Firestore Timestamp when terminal state reached
   - `delivery.error`: error string if failed

## Verifying a delivery in the Firebase console

1. Open [Firebase Console](https://console.firebase.google.com) → project `agencytrack-2a610`
2. Firestore → `mail` collection
3. Find the document (sorted by `delivery.startTime` descending)
4. Check `delivery.state` — `SUCCESS` means SendGrid accepted it

## Flows that send email

| Trigger | Cloud Function | Template | Subject |
|---------|---------------|----------|---------|
| Manager creates a user | `createUser` (doCreateUser, step E) | `password-reset.{txt,html}` | Welcome to AgencyTrack — set your password |
| Bulk CSV import | `bulkImportUsers` (calls doCreateUser) | same | same |
| Sunday cron (10 PM) | `sendSundayNudge` | `sunday-nudge.{txt,html}` | Your AgencyTrack report for `{{weekStarting}}` is due |
| Monday cron (7 AM) | `sendMondayNudge` | `monday-nudge.{txt,html}` | 2 hours left to submit your report |

## Common failure scenarios

### `delivery.state === 'ERROR'` — SendGrid rejected the message

Check `delivery.error` for the SendGrid error code:
- **401 Unauthorized** — `SENDGRID_API_KEY` environment variable is missing or wrong. Redeploy with the correct key.
- **403 Forbidden** — sender domain not verified in SendGrid. Verify the domain or From address in the extension config.
- **550 / Invalid recipient** — the `to` address doesn't exist. No retry needed.

### Email never appears in `mail/` collection

The Cloud Function write failed silently. Check Cloud Functions logs:

```
firebase functions:log --project agencytrack-2a610 | grep "\[createUser\]"
```

Look for `[createUser] mail/ write failed (non-fatal):` — the function logs the error but does not fail the user-creation saga (email is best-effort).

### Extension not processing documents (stuck at `PENDING`)

1. Confirm the extension is installed and enabled: Firebase Console → Extensions → Trigger Email.
2. Confirm `SMTP_CONNECTION_URI` is set correctly: `smtps://apikey:<KEY>@smtp.sendgrid.net:465`.
3. Check extension logs in Cloud Functions logs under the `ext-firestore-send-email-*` function name.

### Re-sending a failed password-reset email

The extension does **not** retry `ERROR` state documents. To re-send:
1. Open Firebase Console → Authentication → find the user by email.
2. Click "Send password reset email" (manual trigger from the console).

Or from a Cloud Shell / local script with Admin SDK:

```js
const admin = require('firebase-admin');
admin.initializeApp();
admin.auth().generatePasswordResetLink('user@example.com', { url: 'https://agencytrack.vercel.app' })
  .then((link) =>
    admin.firestore().collection('mail').add({
      to: 'user@example.com',
      message: {
        subject: 'Reset your AgencyTrack password',
        text: `Set your password: ${link}`,
        html: `<a href="${link}">Set my password</a>`,
      },
    })
  );
```

### Nudge emails sent to wrong agents

The `sendSundayNudge` / `sendMondayNudge` functions filter agents using a 4-week lookback:
- Agents who submitted at least once in the last 28 days are nudged.
- Brand-new agents (never submitted) are always nudged.
- Long-inactive agents (no submission in 28+ days and at least one historical submission) are skipped.
- Deactivated agents (`active: false`) are always skipped.

To debug which agents were selected for a nudge, check Cloud Functions logs for:
```
[sendSundayNudge] Nudged N agents (in-app + email) for week YYYY-MM-DD
```

## Extension config reference

| Config key | Value |
|-----------|-------|
| `SMTP_CONNECTION_URI` | `smtps://apikey:<SENDGRID_API_KEY>@smtp.sendgrid.net:465` |
| `DEFAULT_FROM` | `AgencyTrack <noreply@agencytrack.app>` (or verified sender) |
| Firestore collection | `mail` |
| Extension ID | `firestore-send-email` |
