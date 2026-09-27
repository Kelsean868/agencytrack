# Brief — Audit Phase 2d + 2e: numbers you can trust, then kiosk + App Check

**Model:** Opus 5.5 · **Effort:** high · **Runs as:** one Claude Code cloud session, **two PRs**
**Type:** src + rules + functions → human-merge. Kyron merges; deploys run on Kyron's PC. Claude Code never merges, deploys or writes production data.
**Source:** `docs/audits/agencytrack-audit-2026-09-24.md` § BUG-01, BUG-02, BUG-04, BUG-05, SEC-04, SEC-11. Read each. Line numbers are from 24 Sep; P2b (#987) and P2c (#988) moved code — find it by name.
**Keep:** every branch/unit scope from P2b and every financing check from P2c. Do not widen any rule.

## Order of work

1. Build **PR 1 = P2d** (below) off `main`. Open it, post its Phase 0 table first, finish its gates.
2. Then, without waiting for PR 1 to merge, build **PR 2 = P2e** off `main` on its own branch.
3. If PR 2 must touch a file PR 1 changed, branch PR 2 from PR 1's branch instead, and say "stacked on PR 1" at the top of PR 2.
4. Each PR gets its own Phase 0 table, tests, deploy section and smoke walk.

---

# PR 1 — P2d: numbers you can trust

## Part 1 — BUG-01 ruling (Kyron, 26 Sep 2026): option B
Agent-declared settled policies **keep counting** toward heroes, campaigns and awards. Agents own confirming settled status, policy details and persistency (the branch manager has no assistant).
1. Show provenance wherever a settled production total appears (Home hero, Campaign, Policy Ledger award card, Awards tab): `[n] from head office · [n] self-confirmed`. "From head office" = came from the OIPA import; "self-confirmed" = the agent declared it. Use one shared helper so every surface counts the same way.
2. Agent self-confirm write path: an agent can confirm their own policy's settled status and details from the Policy Ledger. Stamp `confirmedBy` / `confirmedAt` / `enteredBy` provenance on the doc. Rules: the agent arm may only set these on their own policy; the manager confirm arm (P2b/P2c scope) is unchanged.
3. BUG-05 is **intended** (agents write their own persistency inputs). Keep the agent arm. Add `enteredBy` (uid) + `enteredAt` stamping on persistency writes; rules require `enteredBy == request.auth.uid` on agent writes.

## Part 2 — BUG-02: one "today" for Trinidad
1. One helper `todayTT()` (UTC−4, no DST) returning `YYYY-MM-DD`. If an equivalent helper already exists (see `ledgerProduction.js`, `CompliancePanel.jsx`, `setAgentOfMonth.js`), promote that one — do not create a second.
2. Replace every client "today" built from `toISOString().slice(0, 10)` or `new Date()` UTC parts. List every site changed in the PR.
3. Add a lint rule (ESLint `no-restricted-syntax` or equivalent) that bans `toISOString().slice(0, 10)` outside the helper file.
4. Tests: at 21:00 TT (01:00 UTC next day) `todayTT()` returns the TT date; the contract-start "not in the future" check refuses tomorrow at 21:00 TT.

## Part 3 — BUG-04: one YTD production loop
The hero (`deriveYearProduction`) and the awards rows (`awardRowsFromLedger`, `policyCampaignLens.js`) accumulate separately. Derive award rows from the same per-policy credit list the hero uses. Add a test: for the same agent, year and rules, hero YTD settled == awards YTD settled (self + family treatment included).

## Part 4 — small fixes carried from P2c
1. Policy history **writes**: a BM may add a history entry only under a policy in their own branch; UM own unit; SM/TA/PA tenant; agent own policies. (P2c scoped reads only.)
2. Policy Reconciliation for a sales manager without `canConfirmSettlements`: hide the Confirm button (today it shows next to "View only").

## PR 1 Phase 0 (PR comment before code)
Table: part · files / rule blocks · today · change. Plus the full list of UTC "today" sites found.
STOP and report if: the OIPA import does not mark imported policies in a way that tells "head office" from "self-confirmed" apart; or the hero and awards rules differ on purpose (a documented reason in code or docs).

## PR 1 tests
Rules (emulator): agent self-confirms own policy → allowed; another agent's → denied; agent persistency write without `enteredBy` → denied; BM history write in other branch → denied. Unit: `todayTT` boundaries; hero == awards property test; provenance helper counts. Component: SM without the flag sees no Confirm button. Paste counts: lint, root tests, functions tests (if touched), rules tests, build. Show the new deny tests fail against `main`'s rules.

## PR 1 deploy + smoke
Deploy section: exact `firebase deploy --only …` for what changed. Smoke walk (read-only): agent Home, Campaign, Policy Ledger and Awards show the provenance line and the same YTD settled figure; BM Policy Ledger and a policy history load; SM Policy Reconciliation shows no Confirm button.

---

# PR 2 — P2e: kiosk + App Check

## Part 1 — SEC-04: kiosk link
Files: `functions/kiosk/createToken.js`, `functions/kiosk/validateToken.js`, the kiosk client.
1. Token life: 90 days, renewed on use (rolling). Existing kiosk links keep working until their current expiry, then need re-pairing. Say how many live kiosk tokens the code path can have, and give Kyron a read-only script to count them.
2. Device binding: on first use, the kiosk stores a device secret; later calls must present it. A link opened on a second device is refused.
3. CORS: only the app origins (`https://portal.agencytrack.app`, the Vercel production domain, `http://localhost:5173` for dev). Read them from config, not hard-coded in two places.
4. Rate limit per token, same pattern as `functions/callActivity/ingestCallActivity.js`.
5. A manager can revoke a kiosk link from the existing kiosk settings screen (add a button if none exists).

## Part 2 — SEC-11: App Check in MONITOR mode only
1. Client: initialise App Check with reCAPTCHA Enterprise in `src/firebase.js`. The site key comes from `VITE_APPCHECK_SITE_KEY`; if it is empty, App Check is skipped (the app must still work).
2. Functions: add App Check verification in **monitor mode** (log, do not reject) on callable functions. Exempt `ingestCallActivity` (server-to-server) and the kiosk validator.
3. Do **not** enforce on Firestore, Storage or Functions in this PR. Enforcement is a later step Kyron turns on in the Console after watching the metrics.
4. Write `docs/runbooks/app-check.md`: the Console steps Kyron does (register the web app, create the reCAPTCHA Enterprise key, add the key to Vercel env, add a debug token for local dev), how to read the metrics, and when to switch each service to enforce.

## PR 2 Phase 0 (PR comment before code)
Table: part · files · today · change. Plus: every callable function and whether it gets monitor-mode App Check or is exempt.
STOP and report if: the kiosk client cannot store a device secret (for example no persistent storage on the kiosk device), or enabling App Check in monitor mode would still block any request.

## PR 2 tests
Functions: token older than 90 days refused; renewed token accepted; second device refused; wrong origin gets no CORS header; rate limit trips. Client: app loads with `VITE_APPCHECK_SITE_KEY` empty and set. Paste counts as in PR 1.

## PR 2 deploy + smoke
Deploy section: exact commands (functions; hosting env var in Vercel is a Kyron step — list it). Warn if the deploy deletes or renames any function. Smoke walk: the existing kiosk TV link still loads; a new kiosk link pairs on one device and is refused on a second; App Check metrics in the Console show requests arriving (after Kyron adds the key); no new errors in Functions logs in the first hour.

---

## Out of scope (both PRs)
App Check enforcement, the 40-applications company minimum, LX restyle, compliance docs (P2f), any UI redesign.
