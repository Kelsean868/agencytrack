# Runbook — Firebase App Check (monitor first, enforce later)

Audit 2026-09-24 SEC-11 · shipped in monitor mode by P2e.
**Console steps below were checked on 27 Sep 2026** against Firebase's own pages
(["reCAPTCHA Enterprise provider (web)"](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider),
[".md.txt copy"](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider.md.txt)). Firebase renames
Console menus from time to time — if a label below does not match, the page linked is the authority.

## What P2e shipped, and what it did NOT

| Piece | State after P2e |
|---|---|
| Web client (`src/lib/appCheck.js`, called from `src/firebase.js` and the kiosk app in `src/lib/kiosk/kioskFirebase.js`) | Attaches an App Check token to Firestore, Storage, Auth and Functions calls **when `VITE_APPCHECK_SITE_KEY` is set**. Empty key → App Check skipped, app unchanged. |
| Callable Cloud Functions (18) | Wrapped by `functions/lib/appCheckMonitor.js`: one log line per call — `appcheck-monitor`, `{ fn, appCheck: 'valid' \| 'missing' \| 'invalid' }`. **Never rejects.** |
| `ingestCallActivity`, `validateKioskToken` | Exempt (server-to-server / the kiosk validator). Both are `onRequest`, where App Check does not apply. |
| Enforcement — Firestore, Storage, Functions | **OFF.** Nothing in this repo turns it on. You do, per service, in the Console, after reading the metrics. |

## 1 · One-time setup (Kyron)

1. **Create the reCAPTCHA Enterprise key.** Google Cloud console → project `agencytrack-2a610` →
   **reCAPTCHA Enterprise** (enable the API if asked) → **Create key**.
   - Type: **Website**.
   - Domains: `portal.agencytrack.app`, `agencytrack.vercel.app`, `localhost`.
     Add `vercel.app` too only if you want **preview** deployments measured (it allows every
     `*.vercel.app` site to use the key — acceptable for a site key, but only add it on purpose).
   - Leave "Use checkbox challenge" **off** (App Check uses the score-based key).
   - Copy the **site key** (the public ID, not a secret).
2. **Register the web app with App Check.** Firebase Console → **Security → App Check** →
   **Apps** tab → the AgencyTrack web app → **reCAPTCHA Enterprise** → paste the site key → **Save**.
   Leave the token TTL at the default unless the metrics give a reason to change it.
3. **Give the key to the app.** Vercel → project → **Settings → Environment Variables** →
   add `VITE_APPCHECK_SITE_KEY` = the site key, environment **Production** (add **Preview** only if
   you added the preview domain in step 1). **Redeploy** production — Vite reads the value at build
   time, so an existing deployment will not pick it up.
4. **Local development (optional).** App Check stays off locally unless you set a key in
   `.env.local`. To test with it on:
   - put the site key in `.env.local` as `VITE_APPCHECK_SITE_KEY`,
   - set `VITE_APPCHECK_DEBUG_TOKEN=true`, run `npm run dev`, open the app — the browser console
     prints an **App Check debug token**,
   - Firebase Console → **Security → App Check → Apps** → the web app's ⋮ menu →
     **Manage debug tokens** → add that token,
   - replace `true` with the token itself in `.env.local` so it stays the same.
   Debug tokens are read only in dev builds (`import.meta.env.DEV`). **Never put one in Vercel** — a
   debug token lets any browser pass App Check.

## 2 · Read the metrics (the week after the key is live)

**Firestore / Storage / Auth** — Firebase Console → **Security → App Check → APIs** tab → pick the
service → the request chart splits traffic into:

| Bucket | Meaning | What you want |
|---|---|---|
| Verified | Valid App Check token | ~100% of real traffic |
| Outdated client | No token, from an app version without App Check | Falls to ~0 once every open tab has reloaded the new build (PWA users: after they accept the update prompt) |
| Unknown origin | No token, not from the app | Scripts, scrapers — what enforcement will block |
| Invalid | A token that failed verification | Should be ~0; if not, find out why before enforcing |

**Callable Functions** — Google Cloud console → **Logging → Logs Explorer**, project
`agencytrack-2a610`, query:

```
jsonPayload.message="appcheck-monitor"
```

Group by `jsonPayload.fn` and `jsonPayload.appCheck`. Any function still showing `missing` from
real users after the rollout week means some caller is not sending tokens — find it before
enforcing that function.

**Kiosk TVs** also go through App Check (the kiosk's own Firebase app). A TV only picks it up
after its page reloads with the new build; until then its Firestore reads show as
"Outdated client".

## 3 · When to switch each service to enforce

Enforce **one service at a time**, and only when all of these hold for **at least 7 consecutive
days**:

1. Verified ≥ 99% of that service's requests, and every "Outdated client" source you can
   identify has reloaded.
2. Every kiosk TV has reloaded since the key went live (check each TV shows the new build).
3. For Functions: every `appcheck-monitor` line from real users says `valid`.

Suggested order (lowest blast radius first): **Storage → Firestore → Functions**.

- **Storage / Firestore:** Console → **Security → App Check → APIs** → service → **Enforce**.
  Takes effect within minutes. Keep the metrics page open for an hour afterwards; if Verified drops
  or users report errors, click **Unenforce** — it is reversible.
- **Functions:** enforcement is code, not a Console switch, for callables: add
  `enforceAppCheck: true` to the function's options (`functions.runWith({ enforceAppCheck: true })`)
  and deploy, one function at a time, starting with a low-traffic admin one. Do not enforce
  `ingestCallActivity` or `validateKioskToken` — they are server-to-server / the kiosk validator
  and carry no App Check token by design.

## 4 · If something breaks

- **Users see permission / "unauthenticated" errors after enforcing:** Unenforce that service in
  the Console (or revert the function's `enforceAppCheck`) first, then investigate.
- **App will not start after adding the key:** it should not — `initAppCheck` catches init errors
  and carries on without a token. Check the browser console for `[appCheck]` warnings. Removing
  `VITE_APPCHECK_SITE_KEY` in Vercel and redeploying turns App Check off entirely.
- **reCAPTCHA scripts blocked by CSP:** `vercel.json`'s Report-Only CSP already allows
  `www.google.com` / `www.gstatic.com` for scripts and frames. If CSP is ever switched from
  Report-Only to enforcing, keep those entries.
