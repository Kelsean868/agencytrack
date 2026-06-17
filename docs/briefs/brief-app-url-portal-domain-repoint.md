# Brief: Repoint `APP_URL` to `portal.agencytrack.app`

**Target file in repo:** `docs/briefs/app-url-portal-domain-repoint.md`
**Size:** XS
**Type:** `functions/` config change — auth-adjacent (invite/reset email flow)
**Merge:** HUMAN-MERGE required (touches the auth/email flow)
**Deploy:** functions-deploy gated — dispatcher runs `firebase deploy --only functions` (Rule 19). CC does NOT deploy.
**Sequencing gate:** Do not deploy until `portal.agencytrack.app` is live, serving the app, and added to Firebase Authorized domains (runbook Phase A complete). Deploying earlier points invite emails at a domain that isn't ready.

---

## Why

The app's canonical domain is now `https://portal.agencytrack.app` (apex/www become the marketing site). Invite and password-reset emails must send users to the portal, not the old Vercel URL and not www. This actions the `portal.agencytrack.app` APP_URL sub-step already anticipated in FOLLOW_UPS.

## Source-verified facts (Rule 17 — re-verify at authoring time)

> Verified against the repomix snapshot; CC must re-confirm with `git grep` before editing.

1. `functions/lib/config.js` exports `APP_URL` (currently `'https://agencytrack.vercel.app'` in the snapshot; a prior brief may have moved it to `www` — CC must read the live value first). Confirm: `git grep -n "APP_URL" functions/`
2. Consumers: `doCreateUser` (`continueUrl`) and `resendInviteEmail` (`url`) in `functions/index.js`. These are the only two; re-confirm with the grep above.
3. Firebase **authorized domains** is a Console setting, NOT in the repo — handled in runbook Phase A, NOT by CC.
4. Frontend email-link sign-in uses `window.location.href` (`App.jsx`) — host-relative, no change.
5. `CLAUDE.md` header `Hosted:` line is stale — update to reflect the split.

## Scope

**In:**
- `functions/lib/config.js`: set `APP_URL = 'https://portal.agencytrack.app'`.
- `CLAUDE.md`: update the hosted line to `App: portal.agencytrack.app | Marketing: agencytrack.app`.

**Out (do NOT touch):**
- Firebase authorized domains (Console, manual).
- `authDomain` / any `VITE_*` env var.
- Dated `agencytrack.vercel.app` / `www.agencytrack.app` references inside `FOLLOW_UPS.md` / runbook docs (historical records).
- If `git grep` finds `agencytrack.vercel.app` OR `www.agencytrack.app` hardcoded in *functional source* outside `config.js`, STOP and wait for dispatcher — unexpected hardcode, scope decision.

## Phases

- **Phase 0 — Re-verify:** `git grep -n "APP_URL" functions/` (read current value), `git grep -n "agencytrack.vercel.app"`, `git grep -n "www.agencytrack.app"`. Surface any functional-source hardcode (→ halt if found).
- **Phase 1 — Edit:** set `APP_URL = 'https://portal.agencytrack.app'`; update the `CLAUDE.md` hosted line.
- **Phase 2 — Static verify:** `git grep` confirms `APP_URL` now reads the portal host and no other functional file hardcodes a different app host.
- **Phase 3 — Smoke:** WAIVED with justification — pure `functions/` config constant, effect only observable after `firebase deploy --only functions` (dispatcher-run). No preview-observable surface. Real verification = dispatcher invite-email inbox check post-deploy (link resolves to `portal.agencytrack.app`).
- **Phase 4 — Docs-with-placeholders:** CONTEXT.md / FOLLOW_UPS note that `APP_URL` repointed to `portal.agencytrack.app`; placeholder for post-deploy inbox-verification result.
- **Phase 5 — Commit/push/PR:** branch `fix/app-url-portal-domain`; commit `fix(email): repoint APP_URL to portal.agencytrack.app`; push; open PR; STOP and wait for dispatcher.
- **Phase 6 — Gemini disposition:** poll + disposition any bot review per Rule 21 before the PR-ready report.

## Self-critique gate (Rule 22 — ≥1 known gap)

- **Gap:** The deploy is gated on `portal.agencytrack.app` being live + Firebase-authorized. If the PR is merged and functions deployed before runbook Phase A completes, every new invite/reset link 404s or hits `auth/unauthorized-domain`. The sequencing gate above is load-bearing — dispatcher must confirm portal is live before deploy, not just before merge.

## Falsification-before-banking (Rule 23)

- "`APP_URL` is the sole source for invite/reset email destinations" is overturned if Phase 0 grep finds any other functional file constructing a `continueUrl`/`url` with a literal app host. If found → halt, surface to dispatcher.

---

## Dispatch prompt (paste to CC)

```
/dispatch docs/briefs/app-url-portal-domain-repoint.md

Repoint APP_URL to portal.agencytrack.app. XS, functions-config, HUMAN-MERGE, functions-deploy gated (dispatcher deploys, ONLY after portal.agencytrack.app is live + Firebase-authorized — runbook Phase A).

Phase 0 first: git grep -n "APP_URL" functions/ (read the current value — may be vercel.app or www), git grep -n "agencytrack.vercel.app", git grep -n "www.agencytrack.app". Confirm functions/lib/config.js holds APP_URL and doCreateUser + resendInviteEmail are its only consumers. If any OTHER functional source file hardcodes an app host, STOP and wait for dispatcher.

Then: set APP_URL = 'https://portal.agencytrack.app'; update the CLAUDE.md hosted line to "App: portal.agencytrack.app | Marketing: agencytrack.app". Do NOT touch Firebase authorized domains, authDomain, env vars, or dated host references in FOLLOW_UPS/runbook docs.

Smoke WAIVED (pure functions config, deploy-gated, no preview surface) — note the waiver in the PR. Phase 4 docs note + post-deploy inbox-verify placeholder. Phase 5: branch fix/app-url-portal-domain, open PR, STOP. Phase 6: Gemini disposition per Rule 21.
```
