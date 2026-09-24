> Three PRs, dispatched in order. **S0:** Sonnet 5, effort high. **S1:** Opus 5.5, effort high. **S2:** Sonnet 5, effort high.
> S1 starts after S0 merges. S2 starts after S1 merges.
> Source: `docs/audits/agencytrack-audit-2026-09-24.md` (commit `1c7a7cd8`), roadmap Phase 0 + Phase 1. Finding IDs below are that report's.

# Brief — Security Phase 0 and Phase 1 (pre-pilot blockers)

## Context the executor needs

- Live admin census (read-only, 24 Sep 2026): 36 Auth users. `tenant_admin` is held by 3 accounts, all Kyron's (1 in `tatillife_south`, 2 in `tatillife_smoke`). One real `branch_manager` exists in `tatillife_south`. So SEC-01/SEC-02 cannot be abused by anyone else today, but SEC-07 and SEC-03 become live the day agents onboard.
- Every rules change in this brief lands with a rules test that **fails on `main` and passes on the branch**. Paste both results.
- `firestore.rules`, `storage.rules` and `functions/` changes are human-merge only, and Kyron runs the deploy by hand after merge. Never deploy.
- Rule 17: re-verify every `file:line` from the audit before editing; the in-repo code wins.

---

## S0 — Rules tests run in CI (SEC-21)

PR title: `ci: run the Firestore rules test suite on every PR`

1. Find the existing rules suite (`tests/rules/**`) and why it is excluded from `npm test`. Run it locally against the emulator on `main` and report pass/fail counts as-is.
2. Add a CI job that starts the Firestore emulator and runs that suite (`firebase emulators:exec --only firestore "<rules test command>"`). Java setup as needed. Cache what can be cached.
3. If tests have rotted, fix the **tests** to match current intended behaviour. If a test exposes a real rules hole, do not fix the rule here: mark it `.skip` with a comment naming the audit ID, and list it in the PR body. S1 fixes rules.
4. The job must be a required-check candidate: stable, under ~5 minutes. Report its run time.

Deliverables: evidence paste-back (CI job log summary line + local run counts), list of any skipped tests with audit IDs, post-merge fill. Kyron makes the check "required" in GitHub branch protection himself.

---

## S1 — Rules and functions hardening (SEC-01, SEC-03, SEC-07, SEC-14, SEC-12)

PR title: `fix(security): close the pre-pilot rules and functions holes`

Each item: write the failing emulator test first, then the fix.

**SEC-01 — delete `setUserClaims`.** Confirm with `git grep` that nothing in `src/`, `functions/`, `scripts/` or tests calls it. Remove the export and its code. If anything does call it, STOP and report. Note for Kyron's deploy: removing a function makes `firebase deploy --only functions` ask to delete it; answer yes.

**SEC-03 — `kioskTokens` written only by Cloud Functions.** Rules: no client create/update/delete on `kioskTokens`. `createKioskToken` must (a) check the caller's role and that a `branch_manager` owns the `branchId` (unit managers may not mint), (b) always write `expiresAt` (default 90 days; one constant). Every validator treats a missing or past `expiresAt` as invalid. **Consequence to state in the PR:** any existing kiosk token without `expiresAt` stops working and must be re-minted.

**SEC-07 — scope `persistency` list.** First list every reader of the `persistency` collection (component, query, role). Then scope the rule: agent → own docs; unit manager → own unit; branch manager → own branch; sales manager / tenant admin → tenant. Add the matching `where()` to every client query so none is rejected. **If the kiosk reads persistency, STOP and report what it shows** — do not guess a kiosk rule. Run the audit's falsification check first: an agent-session `getDocs(collection(db,'tenants/T/persistency'))` must succeed on `main` (proving the hole) and fail on the branch.

**SEC-14 — escape HTML in email templates.** One pure `escapeHtml` used by `renderTemplate` for every interpolated user field. Tests with `<script>`, quotes and `&`.

**SEC-12 — `storage.rules` into the repo, no behaviour change.** Kyron will paste the live Storage rules from the Firebase Console into `docs/briefs/storage-rules-live.txt` before dispatch. Copy them **verbatim** into `storage.rules`, add the `storage` block to `firebase.json`, add one emulator test for the path the app actually uses. **If that file is absent, skip SEC-12 and say so** — never write Storage rules from guesswork, because deploying them replaces the live ones.

Out of scope: dependency upgrades (SEC-16), App Check (SEC-11), branch-scoping of policies/financing/users (SEC-05, SEC-08). Those are Phase 2.

Deliverables:
1. Evidence paste-back: `npm test` summary lines, and the rules-suite result showing each new test **failing on `main`** and **passing on the branch**.
2. A deploy checklist in the PR body, in order, for Kyron: `firebase deploy --only firestore:rules`, `--only storage` (if SEC-12 shipped), `--only functions` (confirm the `setUserClaims` delete), then re-mint any kiosk token.
3. Smoke after Kyron deploys, read-only on his account: Persistency tab, campaign card and pulse chip still load their figures (SEC-07 did not break the owner read).
4. Post-merge fill in `docs/CONTEXT.md` and `docs/FOLLOW_UPS.md`, marking each audit ID closed.

---

## S2 — Client hardening (SEC-10, SEC-13, SEC-15, PERF-01)

PR title: `fix(client): cache recovery, security headers, CSV safety, lazy financing`

**SEC-10 — cache on logout, and a way out of a corrupt cache.**
- On logout: `terminate(db)` then `clearIndexedDbPersistence(db)`, then reload. Order matters; test it.
- Recovery: catch the Firestore `INTERNAL ASSERTION FAILED` family (seen live 23 Sep 2026: `ID: b815`, app stuck on "Loading AgencyTrack…") at app start and in an error boundary. Show a plain screen: "The app's saved data is damaged. Repair app data" — the button clears the Firestore IndexedDB only (never the auth store), then reloads. Also time-box the loading screen: after 20 seconds, offer the same Repair button.
- Tests: logout calls clear in order; the boundary renders on an assertion error; Repair does not touch the auth DB.

**SEC-13 — security headers** in `vercel.json`: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (check the kiosk is not framed anywhere first), `Referrer-Policy`, and CSP as **`Content-Security-Policy-Report-Only`** built from what the app actually loads (Firebase, Fontshare, Clarity, Vercel). Enforcing CSP is a later PR.

**SEC-15 — CSV formula neutralization.** One pure helper applied to every CSV export: prefix cells starting with `=`, `+`, `-`, `@`, tab or CR with `'`. List every export site it covers.

**PERF-01 — lazy-load `FinancingSelfView`** with `React.lazy` + the existing skeleton. Quote the build chunk report before and after.

Deliverables:
1. Evidence paste-back: `npm test` summary, and build chunk sizes before/after.
2. Smoke, read-only, on Kyron's account, light and dark: log out → log in works; response headers present (paste them); financing tab loads; forced-corruption check done in a **local** browser profile only, never Kyron's real one — the Repair screen appears and recovers.
3. Post-merge fill, marking audit IDs closed.

## Not your call
- Whether CSP moves from report-only to enforced. Kyron decides after a week of reports.
- The kiosk token lifetime beyond the 90-day default.
