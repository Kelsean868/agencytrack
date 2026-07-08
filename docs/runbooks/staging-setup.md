# Staging Environment Setup Runbook

Stands up a **fully isolated staging environment** — a separate Firebase project
(`agencytrack-staging`) with its own Firestore, Auth, rules, indexes, and
functions — so autonomous work can run against staging **without any ability to
reach production** (`agencytrack-2a610`) or real Tatil Life data.

**Scope:** new Firebase project + `.firebaserc` staging alias + staging env
template + deploy/seed/verify scripts + `staging` git branch.
**Duration:** ~30–45 min of operator console work, one-time.
**Owner:** Operator (Kyron). Steps marked **[CONSOLE — operator only]** cannot be
done by Claude Code; the scripts in `scripts/staging/` are provided for the
repeatable parts.

---

> ## ⛔ SAFETY GATE — read first
>
> **No autonomous Firebase authority against staging until
> `scripts/staging/verify-isolation.mjs` PASSES (Part C).**
>
> Production is `agencytrack-2a610` with real Tatil data. Isolation is guaranteed
> **structurally**: Firebase service-account credentials are project-scoped, so a
> credential bound to `agencytrack-staging` **cannot authenticate against
> production by construction**. The verify script proves that binding plus that no
> production identifier leaks into the staging config. If it fails, STOP — do not
> grant staging authority.
>
> **Boundary of the guarantee (what a config check CANNOT catch).** The structural
> proof holds only while the staging service account is **not** granted any IAM
> role on the production project (`agencytrack-2a610`). A brand-new Firebase
> project's service account has **no** access to other projects by default, so
> this holds out of the box — but a *deliberate* cross-project IAM grant in Google
> Cloud IAM would defeat it and is outside what `verify-isolation.mjs` can detect.
> **Never grant the staging SA any role on the production project.** (Verify in
> GCP Console → prod project → IAM: the `…@agencytrack-staging.iam.gserviceaccount.com`
> member must be **absent**.)
>
> **This whole setup never deploys to production and never merges.** Deploys are an
> explicit operator action (CLAUDE.md Rule 19); this branch holds at PR-open.

---

## Part A — Firebase Console setup **[CONSOLE — operator only]**

### A1. Create the staging Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it **`agencytrack-staging`** (the project **ID** must be exactly this —
   the scripts and env template hardcode it). If the ID is taken, Firebase
   appends a suffix; if so, tell me the actual ID and I will update the constants.
3. **Billing:** attach the **same billing account** as production and select the
   **Blaze** plan (Cloud Functions require Blaze).
4. Google Analytics: optional; not required for staging.

### A2. Choose the Firestore region — ⚠️ FIXED AT CREATION

> The Firestore location **cannot be changed after the first database is created.**

1. In the **staging** project: **Build → Firestore Database → Create database**.
2. **Match production's region for parity.** I cannot read production's region from
   the repo — check it first: in the **production** project (`agencytrack-2a610`)
   → Firestore Database → the location is shown at the top (e.g. `nam5`, `us-central`).
   Pick the **same** location for staging.
3. Start in **production mode** (locked rules); this change set deploys the real
   rules in Part E.

### A3. Enable Authentication (email/password) — match prod

1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable.** (Leave Email link / passwordless
   **off** — production abandoned it; see CLAUDE.md Tech Stack.)

### A4. Enable Storage (optional, for profile-photo parity)

1. **Build → Storage → Get started** if you want avatar uploads to work on
   staging. Same region note applies. Skip if staging won't exercise photos.

### A5. Register a Web app and copy the config

1. **Project settings (gear) → General → Your apps → Add app → Web (`</>`)**.
2. Nickname: `agencytrack-staging-web`. **Do not** enable Firebase Hosting.
3. Copy the six `firebaseConfig` values — you'll paste them into `.env.staging`
   (Part B) and into Vercel (Part A6). They map 1:1 to the `VITE_FIREBASE_*` keys:

   | firebaseConfig field | env var |
   |----------------------|---------|
   | `apiKey`             | `VITE_FIREBASE_API_KEY` |
   | `authDomain`         | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId`          | `VITE_FIREBASE_PROJECT_ID` (**must be** `agencytrack-staging`) |
   | `storageBucket`      | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId`  | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`              | `VITE_FIREBASE_APP_ID` |

### A6. Create the Vercel staging environment **[CONSOLE — operator only]**

The app reads Firebase config **entirely** from `VITE_FIREBASE_*` env vars
(`src/firebase.js:13-18`) — there is no hardcoded project id in the app. So a
staging Vercel target simply carries the staging values. `vercel.json` holds no
env vars; all env config lives in the Vercel dashboard.

Recommended approach — **branch-scoped Preview env** (simplest, no new project):

1. Vercel → the AgencyTrack project → **Settings → Environment Variables**.
2. Add each `VITE_FIREBASE_*` value **scoped to the `staging` git branch**
   (Environment = **Preview**, and use the **branch** filter = `staging`).
3. **Also add** `VITE_VALIDATE_KIOSK_TOKEN_URL` =
   `https://us-central1-agencytrack-staging.cloudfunctions.net/validateKioskToken`
   (region-adjust if A2 differs). **This is mandatory** — see the leak note in
   Part B.
4. Do **not** set `VITE_CLARITY_PROJECT_ID` on staging (production-only).
5. Deployments of the `staging` branch now build against staging Firebase; the URL
   follows the standard preview pattern
   `agencytrack-git-staging-kyron-marchan-s-projects.vercel.app` (well under the
   63-char DNS limit).

> Alternative (heavier): a **separate Vercel project** linked to the same repo,
> set to auto-deploy only the `staging` branch, with the `VITE_*` vars in its
> **Production** env. Use this only if you want a stable non-preview staging URL.

---

## Part B — Repo config (shipped by this change set)

Already committed on `chore/staging-environment` (no console work needed):

| File | Change |
|------|--------|
| `.firebaserc` | Added `staging` → `agencytrack-staging` alias; `default` still `agencytrack-2a610`. |
| `.env.staging.example` | Committed template (no real keys) for the staging `VITE_*` vars. |
| `.gitignore` | Ignores the staging SA key (`*service-account-key.staging.json`); un-ignores `.env.staging.example` only (real `.env.staging` stays ignored). |
| `scripts/staging/deploy-staging.ps1` | Guarded deploy to staging only. |
| `scripts/staging/seed-staging.mjs` | Synthetic `staging_test` tenant seeder, guarded. |
| `scripts/staging/verify-isolation.mjs` | The isolation safety gate. |

**Create your local `.env.staging`** (gitignored — never committed):

```powershell
Copy-Item .env.staging.example .env.staging
# then edit .env.staging and paste the six VITE_FIREBASE_* values from A5
```

> **Kiosk leak note (important).** `src/lib/kiosk/kioskConfig.js:38-40` falls back
> to the **production** Cloud Function
> (`…-agencytrack-2a610.cloudfunctions.net/validateKioskToken`) when
> `VITE_VALIDATE_KIOSK_TOKEN_URL` is unset. A staging build that omits this
> override would call **production's** kiosk CF. The template sets it to the
> staging URL; keep it set both in `.env.staging` and in Vercel (A6). The verify
> script FAILS if it is missing.

---

## Part C — Isolation verification (THE GATE)

Run this **before** granting any autonomous staging authority, and again any time
the staging config or key changes.

### C1. Static checks (no key, no network) — always available

```powershell
node scripts/staging/verify-isolation.mjs
```

Proves: staging config points at `agencytrack-staging` (not prod), all six
`VITE_FIREBASE_*` present, no production id anywhere in the staging env, and the
kiosk override is a staging URL.

### C2. Full check with a staging service-account key

1. **[CONSOLE — operator only]** In the **staging** project: **Project settings →
   Service accounts → Generate new private key**. Save it as
   `functions/service-account-key.staging.json` (gitignored — never commit).
2. Run the live round trip:

   ```powershell
   node scripts/staging/verify-isolation.mjs --live
   ```

   Adds: the key's `project_id` is `agencytrack-staging` (structural isolation
   proof), and a real doc is written to → read from → deleted in **staging**
   Firestore, with the resolved Admin project confirmed as staging.

### C3. What PASS looks like

```
✅ [PASS] CHECK 1 config — projectId=agencytrack-staging, all 6 VITE_FIREBASE_* present, domain+bucket reference staging
✅ [PASS] CHECK 2 no-prod-leak — no prod id in staging env; kiosk endpoint references agencytrack-staging
✅ [PASS] CHECK 3 key-binding — key credential is project-bound to agencytrack-staging — Admin writes provably cannot reach agencytrack-2a610
✅ [PASS] CHECK 4 live-write — wrote+read+deleted tenants/staging_test/_isolation_probe/probe-… in agencytrack-staging; …
──────────────────────────────────────────────────────────────
✅ ISOLATION VERIFIED — staging config/credentials are bound to
   agencytrack-staging and carry no reference to agencytrack-2a610.
```

Exit code is `0` on PASS, `1` on any FAIL. **Any `❌ FAIL` = STOP; do not grant
staging authority.**

> **Honest gap (structural, not observational).** The script does **not** read
> production to confirm the probe doc is absent there — doing so would require
> production credentials inside the staging tooling, creating the very
> cross-project authority we're preventing. The "not in prod" guarantee comes from
> project-scoped credentials (CHECK 3 + 4). For extra assurance, the operator may
> open the **production** Console (`agencytrack-2a610`) → Firestore and confirm no
> `_isolation_probe` collection exists under `tenants/staging_test`.
>
> **Optional bundle grep.** After a staging build, you can also confirm the built
> assets carry no prod id:
> `Select-String -Path dist/assets/*.js -Pattern 'agencytrack-2a610'` should
> return nothing.

---

## Part D — Seed synthetic staging data

Only after Part C PASSES.

```powershell
# preview intent (no key, no writes):
node scripts/staging/seed-staging.mjs --dry-run

# execute (needs functions/service-account-key.staging.json + functions/node_modules):
npm install --prefix functions      # first time only
node scripts/staging/seed-staging.mjs --apply
```

Writes a synthetic tenant `staging_test` — **no real Tatil data**:

| Doc | Notes |
|-----|-------|
| 5 Auth users + claims | `staging-{role}@agencytrack-staging.test` (reserved `.test` TLD) |
| `tenants/staging_test/users/{uid}` | tenant_admin, branch_manager, unit_manager, 2 agents |
| `tenants/staging_test/branches/staging_branch` | isActive branch |
| `tenants/staging_test/config/settings` | currency `TTD` |

Password: `STAGING_SEED_PASSWORD` from `.env.staging`, else a documented default
(the script warns). For richer data (submissions, persistency, campaigns), point
the existing verified `scripts/seed/*.mjs` seeders at staging rather than
re-implementing their schemas here.

---

## Part E — Deploy rules / indexes / functions to staging **[operator action]**

Per CLAUDE.md Rule 19, deploys are an explicit human action. The script targets
staging only and aborts if the active project resolves to production.

```powershell
# dry run — runs the guards, prints the plan, deploys nothing:
pwsh scripts/staging/deploy-staging.ps1 -DryRun

# real deploy to staging:
pwsh scripts/staging/deploy-staging.ps1
```

Deploys `firestore:rules`, `firestore:indexes`, and `functions` to
`agencytrack-staging`. Pre-flight (firebase CLI, `functions/node_modules`) is
handled by the script. It NEVER targets `agencytrack-2a610`.

---

## Part F — Branch strategy & promotion path

| Branch | Deploys to | Purpose |
|--------|-----------|---------|
| `staging` | staging Vercel target + (manual) staging Firebase | Integration surface for autonomous work. |
| `main` | production (auto via Vercel on merge) | Real Tatil app. Unchanged. |

**Model:** feature branches → PR into **`staging`** for autonomous integration and
staging smokes. Once verified on staging, promote by opening a PR from the feature
branch (or a fast-forward of the change) into **`main`** through the normal review
+ merge gates. `main` remains the only branch that touches production.

**Create the `staging` branch** (operator, after this PR merges):

```powershell
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

> Firebase deploys are **not** wired to branch merges — Vercel auto-deploys the
> app, but rules/indexes/functions reach staging only via `deploy-staging.ps1`
> (Part E) and reach production only via the existing manual prod deploy flow.
> "Merged" ≠ "deployed" for those three surfaces (CLAUDE.md).

---

## Operator console checklist (recap of [CONSOLE — operator only] steps)

- [ ] A1 — Created Firebase project `agencytrack-staging` (Blaze, same billing).
- [ ] A2 — Created Firestore, region matched to production (note: fixed forever).
- [ ] A3 — Enabled Email/Password auth (email-link left off).
- [ ] A4 — (Optional) Enabled Storage.
- [ ] A5 — Registered web app, copied the six config values.
- [ ] A6 — Added `VITE_FIREBASE_*` + `VITE_VALIDATE_KIOSK_TOKEN_URL` to Vercel, scoped to `staging`.
- [ ] C2 — Generated staging SA key → `functions/service-account-key.staging.json`.
- [ ] **C — `verify-isolation.mjs --live` PASSES ✅ (the gate).**
- [ ] E — (When ready) deployed rules/indexes/functions to staging.
- [ ] F — Created and pushed the `staging` branch.

---

## Troubleshooting

**`CHECK 1 config … staging env not found`**
Copy `.env.staging.example` to `.env.staging` and fill the six values (Part B).

**`CHECK 2 … VITE_VALIDATE_KIOSK_TOKEN_URL is UNSET`**
Add the staging kiosk URL to `.env.staging` (and Vercel). Without it the kiosk
calls production's CF.

**`CHECK 3 … key's project_id is PRODUCTION`**
You saved the **prod** key at the staging path. Delete it and generate the key
from the **staging** project (A5/C2).

**`firebase use staging failed`**
The `staging` alias isn't resolving — confirm `.firebaserc` has it, you're logged
in (`firebase login`), and your account has access to `agencytrack-staging`.

**`functions/node_modules missing`**
Run `npm install --prefix functions` (the deploy script also auto-installs).
