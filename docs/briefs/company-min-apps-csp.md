# Brief — Company minimum: 40 applications + CSP allows reCAPTCHA

**Model:** Sonnet 5 · **Effort:** medium · **Runs as:** Claude Code cloud session, one PR
**Type:** src + a config seed script + vercel.json → human-merge. Kyron (or Claude on his PC) runs the seed. Claude Code never merges, deploys or writes production data.

## Part 1 — 40-application company minimum (Kyron ruling, 27 Sep 2026)

Ruling: Tatil's company minimum is the 6 tenure API bands already in `src/utils/tenureFloors.js` (150K / 200K / 250K / 300K / 400K / 500K) — **confirmed, not provisional** — and **every band also requires 40 applications a year**.

Production today (read 27 Sep 2026): `tenants/tatillife_south/config/companyMinimums` has `annualApps: 42`, `annualAPI: 200000`, `tenureApiFloors`, `tenureApiFloorsProvisional`, `persistency`, `weeklyActivityFloors`. The 42 is the career-level L1 figure, not the company minimum.

1. **Seed script** `scripts/maintenance/set-company-minimum-apps.mjs`: dry run by default, `--apply` to write, `--tenant` required. Sets `annualApps: 40` and `tenureApiFloorsProvisional: false` on `config/companyMinimums`, stamps `updatedBy` / `updatedAt`. Prints before → after. Touches no other key.
2. **Code defaults:** wherever a default company apps floor is hard-coded (e.g. `RecommendLockDrawer.jsx` `minimums = { annualApps: 42 … }`, `CompanyConfigSurface` defaults, `goalsService` fallbacks), change to 40. Do NOT touch the career-level numbers (L1–L6 apps 42/42/48/48/52/52 in the Career Portal) — those are a different thing.
3. **Show it:** everywhere the tenure company minimum (API) is shown to an agent or manager, show the apps minimum beside it — e.g. "Company minimum (5+ yrs): TTD 500,000 · 40 apps". Find every surface that reads `resolveAnnualAPIFloor` / the "Company minimum" label (Goals, Awards company-floor row, Game Plan commit, manager Goals/branch views) and list them in the PR.
4. **Enforce:** the existing `BelowAppsFloorError` path in Game Plan commit must use the company value (40 after the seed). Confirm it reads config, not a literal.
5. Tests: seed script dry-run/apply on fixtures (only the two keys change); floor label renders "40 apps"; commit below 40 apps raises `BelowAppsFloorError`.

## Part 2 — CSP allows reCAPTCHA (App Check went live 27 Sep 2026)

`vercel.json` Report-Only CSP `connect-src` lacks `https://www.google.com`, so reCAPTCHA Enterprise `/recaptcha/enterprise/clr` calls log CSP violations. Add `https://www.google.com` to `connect-src`. Confirm `script-src` / `frame-src` already allow `https://www.google.com` and `https://www.gstatic.com` (the runbook says they do); add them if not. Keep the policy Report-Only. Also check `content-firebaseappcheck.googleapis.com` is covered by `https://*.googleapis.com` (it is — say so).

## Phase 0 (PR comment before code)
Table: surface / file · what it shows today · change. Plus every hard-coded 42 / apps default found, marked "company floor → 40" or "career level → leave".
STOP and report if a hard-coded 42 is ambiguous (you cannot tell company floor from career level).

## Deliverables
1. One PR. Paste counts: lint, tests, build.
2. PR body "For Kyron": the seed commands, dry run first:
   `node scripts/maintenance/set-company-minimum-apps.mjs --tenant tatillife_south` then the same with `--apply`.
   No `firebase deploy` needed (no rules or functions change) — Vercel ships on merge.
3. Smoke walk (read-only, after merge + seed): agent Goals and Awards show "40 apps" beside the company minimum; the browser console on portal.agencytrack.app shows no CSP report for `www.google.com/recaptcha`.

## Out of scope
Career-level numbers, the redesign, App Check enforcement, any rules or functions change.
