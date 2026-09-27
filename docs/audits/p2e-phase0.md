# P2e Phase 0 — kiosk link + App Check (audit 2026-09-24 SEC-04 · SEC-11)

Brief: `docs/briefs/p2d-p2e-numbers-kiosk-appcheck.md` § PR 2. Written 27 Sep 2026 against
`main` @ `490bffd`, before any code. Branched from `main`, **not stacked on PR 1**: no file
here is one P2d changes (P2d edits `src/lib/kiosk/kioskServices.js`; P2e does not).

## STOP checks

| STOP condition | Finding | Verdict |
|---|---|---|
| The kiosk client cannot store a device secret | The kiosk is the web app in a browser on the TV (`KioskRoute.jsx`). Its Firebase Auth is deliberately in-memory (`kioskFirebase.js:12`), but the page itself has `localStorage` like any browser page. The secret goes there. If a browser refuses storage (private window, storage blocked) the kiosk shows a clear "this browser cannot keep the pairing" message instead of failing silently. | **No STOP** |
| Enabling App Check in monitor mode would still block a request | `firebase-functions` 7.4.0 already verifies an App Check token on every v1 `onCall` and rejects only when `enforceAppCheck` is set (`lib/common/providers/https.js:483-490`: invalid → `warn("Allowing request with invalid AppCheck token because enforcement is disabled")`; missing → allowed). No function sets it, and this PR sets it nowhere. Firestore and Storage enforcement is a Console switch this PR does not touch. Client init is skipped when `VITE_APPCHECK_SITE_KEY` is empty and wrapped so a failed init (reCAPTCHA blocked) cannot stop the app from starting. | **No STOP** |

## Change table

| Part | Files | Today | Change |
|---|---|---|---|
| 1.1 Token life | `functions/kiosk/createToken.js`, `validateToken.js` | Fixed 90-day `expiresAt` from creation (SEC-03), never renewed. Tokens made before SEC-03 carry a 1-year expiry. | New tokens carry `rolling: true`; each successful validation moves `expiresAt` to now + 90 days. Tokens without `rolling` (every existing link) keep their current `expiresAt` and are **not** renewed — they work until it passes, then the TV needs a new link. |
| 1.1 Live-token count | new `scripts/maintenance/count-kiosk-tokens.mjs` (read-only, Admin SDK) | — | Prints live / expired / revoked, paired / unpaired, rolling / legacy per tenant and branch. **The code path has no cap:** `createKioskToken` mints a new token on every call, per branch, and nothing retires one except expiry or a manual revoke. With rolling renewal a link used at least once every 90 days never expires, so revoke is the backstop. |
| 1.2 Device binding | `validateToken.js`, `KioskRoute.jsx`, new `src/lib/kiosk/kioskDevice.js` | Anyone with the URL gets a kiosk session on any device | First successful use binds: the server makes a 32-byte secret, stores only its SHA-256 (`deviceSecretHash`, `deviceBoundAt`), returns it once; the kiosk keeps it in `localStorage`. Every later call must present it (constant-time compare) or gets `401 { reason: 'device' }`. Binding is inside a Firestore transaction, so two devices racing on a fresh link cannot both win. Existing links bind to whichever device uses them first after deploy — the TV that is already showing it. |
| 1.3 CORS | `functions/lib/config.js` (`ALLOWED_ORIGINS`), `validateToken.js` | `Access-Control-Allow-Origin: *` | One list in `functions/lib/config.js`: `APP_URL` (`https://portal.agencytrack.app`), `https://agencytrack.vercel.app`, `http://localhost:5173`. The validator echoes the origin only when it is on the list; any other origin gets no CORS header. |
| 1.4 Rate limit | `validateToken.js` | None | Per token, same pattern as `ingestCallActivity.js:428-434, 524-528`: `validateWindowStart` / `validateWindowCount` on the token doc, advanced inside the same transaction; 20 per 60 s, then `429`. |
| 1.5 Revoke | `revokeToken.js`, `KioskModeTab.jsx` | A revoke button already exists (trash icon) and sets `revokedAt`. An already-open kiosk stays signed in: its Firebase session outlives the link. | Revoke also calls `revokeRefreshTokens` for the kiosk's auth uid, so an open TV loses access when its ID token next refreshes (≤ 1 h). Tab shows "Paired {date}" / "Not paired yet" per link and warns that opening a link pairs the device you open it on. |
| 2.1 App Check client | `src/firebase.js`, new `src/lib/appCheck.js`, `src/lib/kiosk/kioskFirebase.js`, `.env.example` | No App Check | `initAppCheck(app)` with `ReCaptchaEnterpriseProvider(VITE_APPCHECK_SITE_KEY)`, auto-refresh on. Empty key → skipped, app unchanged. Also on the kiosk's secondary app, so kiosk traffic is measured too and enforcement later does not strand the TV. Local dev debug token via `VITE_APPCHECK_DEBUG_TOKEN` (dev builds only). Both keys documented in `.env.example` (Rule 14). |
| 2.2 App Check functions (monitor) | new `functions/lib/appCheckMonitor.js`; the 18 callables below | SDK verifies silently | Each callable handler is wrapped to log one structured line per call — `{ fn, appCheck: 'valid' \| 'missing' \| 'invalid' }` — and **never** rejects. `enforceAppCheck` stays unset. No trigger, name or runtime option changes, so the deploy creates, deletes and renames nothing. |
| 2.3 No enforcement | — | — | Nothing enforced on Firestore, Storage or Functions. |
| 2.4 Runbook | new `docs/runbooks/app-check.md` | — | Console steps, Vercel env, debug token, reading metrics, when to enforce each service. |
| CSP | `vercel.json` (Report-Only CSP) | reCAPTCHA hosts absent | Adds `https://www.google.com` / `https://www.gstatic.com` to `script-src` and `frame-src` so reCAPTCHA does not flood CSP reports (and is ready if CSP is ever enforced). Report-only — blocks nothing either way. |

## Every callable function and its App Check treatment

| Function | Where | Treatment |
|---|---|---|
| `createKioskToken` | `kiosk/createToken.js` | monitor |
| `revokeKioskToken` | `kiosk/revokeToken.js` | monitor |
| `createCallSource` | `callSources/createCallSource.js` | monitor |
| `revokeCallSource` | `callSources/revokeCallSource.js` | monitor |
| `setAgentOfMonth` | `agentOfMonth/setAgentOfMonth.js` | monitor |
| `getAgentOfMonthCandidates` | `agentOfMonth/getCandidates.js` | monitor |
| `recomputeLeaderboardOnDemand` | `leaderboard/leaderboardAggregate.js` | monitor |
| `sendComplianceNudge` | `compliance/sendComplianceNudge.js` | monitor |
| `notifyFinancingAdjustment` | `financing/notifyFinancingAdjustment.js` | monitor |
| `previewPortfolioImport` | `portfolioImport/previewImport.js` | monitor |
| `applyPortfolioImport` | `portfolioImport/applyImport.js` | monitor |
| `undoLastPortfolioImport` | `portfolioImport/undoImport.js` | monitor |
| `resolveSalesManagerUid` | `index.js` | monitor |
| `createUser` | `index.js` | monitor |
| `resendInviteEmail` | `index.js` | monitor |
| `bulkImportUsers` | `index.js` | monitor |
| `deactivateUser` | `index.js` | monitor |
| `updateUser` | `index.js` | monitor |
| `validateKioskToken` | `kiosk/validateToken.js` (`onRequest`) | **exempt** — kiosk validator (brief) |
| `ingestCallActivity` | `callActivity/ingestCallActivity.js` (`onRequest`) | **exempt** — server-to-server (brief) |

Not callables, so App Check does not apply: scheduled (`aggregateDailyToWeekly`, `recomputeLeaderboardScheduled`, `sendSundayNudge`, `sendMondayNudge`, `flagMissedDeadlines`), Firestore triggers (`onWarWrite`, `aggregatePendingPlan`, `onWarSubmitNotifyUpline`, `onFinancingEscalationCreate`, `onSubmissionWrite`), auth trigger (`onUserCreated`).

## Out of scope, noticed

- `revokeKioskToken` lets any branch manager revoke any branch's link in the tenant (old A4:SEC-003). Not in this brief; unchanged.
- SEC-22: the kiosk token is still the Firestore doc id (plaintext). Unchanged.
