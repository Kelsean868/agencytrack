# Brief: Migrate app host to `portal.agencytrack.app` (single-source)

**Target file in repo:** `docs/briefs/app-host-portal-migration.md`
**Size:** S
**Type:** frontend + `functions/` — auth-adjacent (invite / reset / email-change / compliance / kiosk URLs)
**Merge:** HUMAN-MERGE required (auth/email flow)
**Deploy:** Frontend auto-deploys on merge (Vercel). Functions deploy is dispatcher-run: `firebase deploy --only functions` (Rule 19).
**⚠️ Sequencing gate — MERGE-gated, not just deploy-gated:** `portal.agencytrack.app` must be live, serving the app, and in Firebase Authorized domains (runbook Phase A complete) **before this PR is merged** — because merging ships the portal URLs to the frontend immediately via Vercel. Order: portal live → merge (frontend deploys) → `firebase deploy --only functions` right after (keep the gap small so frontend and backend agree).

---

## Why

The app's canonical domain is now `https://portal.agencytrack.app` (apex/www become the marketing site). Every app-host reference — invite/reset/email-change continueUrls, compliance-nudge links, kiosk URLs — must point to the portal. Phase 0 of the prior brief proved the old host is hardcoded across 6 backend + 3 frontend sites, so this migrates them coherently and collapses them to two canonical constants to prevent recurrence.

## Source-verified facts (CC-verified at prior Phase 0 — RE-VERIFY, main may have moved)

**Backend — `functions/lib/config.js` `APP_URL` read at 6 sites across 3 files:**
- `functions/index.js:399` (invite continueUrl), `:592` (resend reset url)
- `functions/index.js:1188`, `:1226`, `functions/compliance/sendComplianceNudge.js:227` (compliance-nudge appUrl)
- `functions/kiosk/createToken.js:13` (`APP_URL: BASE_URL`, kiosk token base)
> All 6 legitimately want the portal host. One constant change repoints all of them — intended.

**Frontend — three literal hardcodes of `https://agencytrack.vercel.app`:**
- `src/constants/brand.js:5` — `export const APP_URL = 'https://agencytrack.vercel.app'` (currently a dead export; carries the comment "Keep canonical values in sync with functions/lib/config.js")
- `src/services/authService.js:48` — `verifyBeforeUpdateEmail(user, newEmail, { url: 'https://agencytrack.vercel.app' })` (email-change continueUrl)
- `src/components/kiosk/KioskModeTab.jsx:9` — `const KIOSK_BASE = 'https://agencytrack.vercel.app/kiosk'`

**Re-verify before editing:** `git grep -n "APP_URL"`, `git grep -n "agencytrack.vercel.app"`, `git grep -n "www.agencytrack.app"`. If a functional-source app-host literal exists outside the sites above, STOP and wait for dispatcher.

## Scope (B-clean — single source of truth)

**In:**
1. `src/constants/brand.js:5` → `export const APP_URL = 'https://portal.agencytrack.app'`. Keep the sync comment (now honored). This becomes the **live frontend canonical** (no longer dead).
2. `src/services/authService.js` → remove the literal; import `APP_URL` from `constants/brand` (resolve the correct relative path) and pass `{ url: APP_URL }`.
3. `src/components/kiosk/KioskModeTab.jsx` → remove the literal; import `APP_URL` from `constants/brand` and set `` const KIOSK_BASE = `${APP_URL}/kiosk` ``.
4. `functions/lib/config.js` → `APP_URL = 'https://portal.agencytrack.app'` (backend canonical).
5. `CLAUDE.md` → hosted line → `App: portal.agencytrack.app | Marketing: agencytrack.app`.

**Out (do NOT touch):**
- Firebase authorized domains (Console; runbook Phase A).
- `authDomain` / any `VITE_*` env var.
- Dated `agencytrack.vercel.app` / `www.agencytrack.app` references in `FOLLOW_UPS.md` / runbook docs / tests / mocks / `scripts/` (historical).

## End-state invariant

After this PR, exactly **two** functional-source constants hold the app host: `src/constants/brand.js` (frontend) and `functions/lib/config.js` (backend). No other functional file may contain a literal app host.

## Phases

- **Phase 0 — Re-verify:** the three greps above. Confirm the 9 sites, confirm no additional functional-source app-host literal. Halt on any new hardcode.
- **Phase 1 — Edit:** the 5 in-scope changes. Wire the two frontend imports to `brand.APP_URL`.
- **Phase 2 — Static verify:** `git grep -n "agencytrack.vercel.app"` returns only dated/doc/test/script hits (zero functional source); `git grep -n "portal.agencytrack.app"` shows the two canonical constants; both frontend imports resolve; build compiles.
- **Phase 3 — Smoke:** **frontend Vercel preview smoke (required — auth service touched):** build clean; real login write-read-verify on the preview (log in → write a Firestore doc → reload → assert persisted); open Kiosk Mode tab and confirm the rendered kiosk URL uses the `portal` host; no console errors. **Functions smoke WAIVED** (config constant, deploy-gated, no preview surface) — note waiver in PR. Email-change/compliance/invite links are functions-side and verified post-deploy by dispatcher.
- **Phase 4 — Docs-with-placeholders:** CONTEXT.md / FOLLOW_UPS note the migration + the new two-constant invariant; placeholders for post-merge/post-deploy verification (invite + reset + email-change continueUrl + compliance-nudge + kiosk all resolve to portal).
- **Phase 5 — Commit/push/PR:** branch `fix/app-host-portal-migration`; commit `fix(app): migrate app host to portal.agencytrack.app (single-source)`; push; open PR; STOP and wait for dispatcher.
- **Phase 6 — Gemini disposition:** poll + disposition per Rule 21 before the PR-ready report.

## Self-critique gate (Rule 22 — known gaps)

- **Gap 1 (load-bearing):** The gate is MERGE-gated and human-enforced. If merged before `portal` is live, the frontend immediately ships dead portal URLs (kiosk, email-change). Dispatcher must confirm portal Phase-A liveness before clicking merge, not just before the functions deploy.
- **Gap 2:** The functions-side flows (invite, reset, compliance-nudge, kiosk token) cannot be smoked pre-deploy; their only real verification is post-deploy with portal live — tracked as Phase 4 placeholders, not closed by this PR.

## Falsification-before-banking (Rule 23)

- The end-state invariant ("only `brand.js` + `config.js` hold the app host") is overturned if Phase 2 grep finds any other functional-source app-host literal. If found → halt, do not bank, surface to dispatcher.

---

## Dispatch prompt (paste to CC)

```
/dispatch docs/briefs/app-host-portal-migration.md

B-clean app-host migration to portal.agencytrack.app. S, frontend + functions, HUMAN-MERGE, MERGE-gated on portal-live (frontend auto-deploys on merge; do NOT merge until portal is live + Firebase-authorized, runbook Phase A).

Phase 0: git grep -n "APP_URL", "agencytrack.vercel.app", "www.agencytrack.app". Confirm the 9 sites in the brief; if any OTHER functional-source app-host literal exists, STOP and wait for dispatcher.

Edits (single source of truth):
- src/constants/brand.js -> APP_URL = 'https://portal.agencytrack.app' (keep sync comment; this is now the live frontend canonical)
- src/services/authService.js -> import APP_URL from constants/brand; pass { url: APP_URL } to verifyBeforeUpdateEmail
- src/components/kiosk/KioskModeTab.jsx -> import APP_URL from constants/brand; KIOSK_BASE = `${APP_URL}/kiosk`
- functions/lib/config.js -> APP_URL = 'https://portal.agencytrack.app'
- CLAUDE.md -> hosted line "App: portal.agencytrack.app | Marketing: agencytrack.app"
Do NOT touch Firebase authorized domains, authDomain, env vars, or dated host refs in docs/tests/scripts.

Phase 2: grep proves zero functional-source vercel.app/www literals remain; only the two canonical constants hold the portal host; build compiles.
Phase 3: frontend Vercel-preview smoke REQUIRED (auth service touched) — real login write-read-verify + Kiosk tab renders portal-host URL + clean console. Functions smoke WAIVED (note in PR).
Phase 4: docs note + post-deploy verification placeholders. Phase 5: branch fix/app-host-portal-migration, open PR, STOP. Phase 6: Gemini disposition per Rule 21.
```
