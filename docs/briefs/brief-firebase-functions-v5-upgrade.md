# Brief — firebase-functions v4 → v5 (→ v6) upgrade

**Status:** recon complete, source-verified against allowed domains only (github.com). **Build target: September 2026** (pre-Node-20-EOL).
**Why now:** Node 20 Functions runtime is EOL **2026-10-30** (hard decommission); live `firebase deploy` already emits SDK deprecation warnings. Prep the map now; execute in Sept.
**Merge class:** this brief is docs → GREEN. The *upgrade itself* is HOLD-always (Cloud Functions code + deploy, Rule 19).

## Sourcing discipline (Rule 17 + night-queue rail)
All version facts below are sourced from **github.com** (the only allowed domain) — release tags, the master CHANGELOG, and maintainer issues. `firebase.google.com` is NOT in the network allowlist, so anything not confirmable on github.com is marked **UNVERIFIED** rather than asserted.

---

## Current state (verified against repo @ `main`)
- **Installed:** `firebase-functions ^4.9.0` (actual `4.9.0`), `firebase-admin ^12.0.0` — `functions/package.json`.
- **Node engine declared:** `"node": "20"` — `functions/package.json` `engines`. (Already at the v5/v6 minimum.)
- **API generation:** 100% **gen-1 (v1)**. All 12 function files import the root: `const functions = require('firebase-functions')` — none use `firebase-functions/v1` or `/v2`.
- **`functions.config()` usages: ZERO** (`grep` clean) → the config-API deprecation does NOT affect this codebase.

### v1 SDK surface in use (the migration inventory)
| Surface | Count | Sites (path:line) |
|---|---|---|
| `functions.https.onCall` | 12 | `index.js:429,449,484,502,834,932` · `agentOfMonth/getCandidates.js:12` · `agentOfMonth/setAgentOfMonth.js:39` · `compliance/sendComplianceNudge.js:100` · `kiosk/createToken.js:15` · `kiosk/revokeToken.js:11` · `leaderboard/leaderboardAggregate.js:452` |
| `functions.https.onRequest` | 1 | `kiosk/validateToken.js:21` |
| `functions.auth.user().onCreate` | 1 | `index.js:468` (`onUserCreated`) |
| `functions.firestore.document(...).onWrite/onCreate` | 4 | `index.js:1354` · `policyPlans/aggregatePendingPlan.js:22` · `war/onWarSubmitNotifyUpline.js:121` · `war/recomputeJfwCount.js:59` |
| `functions.pubsub.schedule(...).timeZone(...).onRun` | 5 | `aggregators/sundayDailyToWeekly.js:150` · `index.js:1189,1227,1265` · `leaderboard/leaderboardAggregate.js:440` |
| `.runWith({timeoutSeconds,memory})` | 1 | `index.js:693` |

**Root-import files to repoint for v6 (12):** `index.js` · `agentOfMonth/getCandidates.js` · `agentOfMonth/setAgentOfMonth.js` · `aggregators/sundayDailyToWeekly.js` · `compliance/sendComplianceNudge.js` · `kiosk/createToken.js` · `kiosk/revokeToken.js` · `kiosk/validateToken.js` · `leaderboard/leaderboardAggregate.js` · `policyPlans/aggregatePendingPlan.js` · `war/onWarSubmitNotifyUpline.js` · `war/recomputeJfwCount.js`.

---

## What actually changes, by version

### v4.9.0 → v5.x — LOW code churn (the safe Node-20-alignment step)
Sourced bullets:
- **v5.0.0** (`releases/tag/v5.0.0`): *"Add option to get named firestore instance for v2 firestore functions"* · *"Remove firebase-admin v10 dependency for Firestore triggers multi-DB support"*. **Neither touches the v1 root API** — our gen-1 code keeps working on `require('firebase-functions')`.
- **Node minimum** (master `CHANGELOG.md`): *"drop support for Node 18 and below (minimum supported version is now Node 20)"*. We already declare Node 20 → no engine change needed. *(Exact version that first required Node 20: **UNVERIFIED** — the CHANGELOG entry was not version-attributable in the fetched excerpt.)*
- **v5.1.0 deploy caveat** (issues #1596, #1598): v5.1.0 began requiring `firebaseextensions.googleapis.com` / could fail deploy on `firebaseextensions.instances.list` even when Extensions are unused. **Mitigation:** pin to a known-good v5 patch and verify a no-op deploy in a test window before adopting; or ensure the Extensions API is enabled on the project. *(Whether later v5 patches reverted this: **UNVERIFIED**.)*

**Net:** bumping to v5.x is dependency-only — no source edits to the 12 files. Risk is the v5.1.0 deploy caveat, not code.

### v5.x → v6.0.0 — the BREAKING step (root entrypoint flips to v2)
Sourced bullets (`releases/tag/v6.0.0`):
- ***"Change default entrypoint of the firebase-functions package to v2 instead of v1"*** → `require('firebase-functions')` no longer returns the gen-1 API. Confirmed symptom in issue #1622 (v4.3.1 → v6.0.1): gen-1 triggers become `undefined` (`"Cannot read properties of undefined (reading 'user')"` on `functions.auth.user()`).
- ***"Add @deprecated annotation on functions.config() API"*** → deprecation only; **N/A** to us (0 usages). *(Whether/when `config()` is fully removed: **UNVERIFIED** — v6.0.0 notes say deprecated, not removed.)*

**Required fix for v6:** change all **12** root-import files from
`const functions = require('firebase-functions')` → `const functions = require('firebase-functions/v1')`.
This is a pure import-path change; the v1 builder API (`functions.https.onCall`, `.auth.user()`, `.firestore.document()`, `.pubsub.schedule()`, `.runWith()`) is unchanged when imported from `/v1`. *(Confirm `/v1` re-exports the identical builder surface at the pinned v6 version before merging — emulator load-check, see strategy below.)*

### Node runtime
- Keep **Node 20** through this migration. Do **NOT** jump to Node 22 while on gen-1: issue #1653 — *"Disabled support for node 22 in first-generation functions"* (gen-1 deploy errors on Node 22).
- Node 20 runtime EOL 2026-10-30 is the real forcing function — but that is a **runtime** (`engines`/console) concern, separable from the SDK bump. *(Node 20 → 22 path for gen-1, and whether a gen-2 rewrite is required to reach Node 22: **UNVERIFIED** here; scope separately.)*

---

## Risks
1. **v6 root-export break (HIGH if skipped):** adopting v6 without the `/v1` import change silently breaks all 12 files → every trigger/callable undefined → failed deploy or dead functions. The import migration is mandatory and atomic with the v6 bump.
2. **v5.1.0 Extensions-API deploy caveat (MED):** could block a deploy unrelated to our code. Pin + dry-run.
3. **`firebase-admin` compatibility (MED):** v5.0.0 changed the admin-v10 dependency for Firestore multi-DB. We're on admin `^12` — likely fine, but verify the admin/functions pair at the pinned versions. *(Exact admin floor for v5/v6: **UNVERIFIED**.)*
4. **CF unit tests (`functions/` jest) mock `firebase-functions` (LOW):** the `functions/` suite runs **jest** (`functions/package.json` `test: jest --testEnvironment=node`, jest `^29`) — distinct from the root `vitest`. The `/v1` import change may require updating those mocks' module path. Audit `functions/**/__tests__` for `jest.mock('firebase-functions')` (e.g. `aggregatePendingPlan.test.js:8`, `leaderboardAggregate.test.js:59`, `onWarWrite.test.js:14`).

## Phased plan
- **Phase A — v4.9.0 → latest v5.x (dependency-only).** Bump `functions/package.json`; `npm install` in `functions/`; **no source edits**. Resolve the v5.1.0 Extensions caveat (enable API or pin). Verify locally, then **dispatcher-gated deploy** to prod with a smoke. LOW risk; clears Node-20-aligned SDK + deprecation warnings.
- **Phase B — v5.x → v6.x (the import migration).** One PR: repoint all 12 files to `firebase-functions/v1`; update any `functions/**/__tests__` mocks; bump the dep. Emulator load-check every entry resolves (no `undefined` exports). HOLD for human + dispatcher-gated deploy.
- **Phase C (separate scope, NOT this brief):** evaluate gen-1 → gen-2 rewrite (required only if Node >20 is needed on these functions). Large; own track.

## Test / deploy strategy
- **Per phase:** `functions/` unit suite green; **CF emulator load-check** — `firebase emulators:start --only functions` and confirm every export is defined (catches the v6 `undefined`-trigger class before deploy).
- **Deploy:** Rule 19 — dispatcher/human runs `firebase deploy --only functions`, never CC, never in an autonomous run. Post-deploy: incognito prod smoke of a callable (e.g. `resolveSalesManagerUid`) + a scheduled-trigger log check.
- **Rollback:** keep the prior `functions/package.json` + `package-lock.json`; `npm ci` + redeploy reverts.

## Falsification (Rule 23)
This brief's "v5 = dependency-only, v6 = import-migration" model is overturned if: (a) a v5.x release note (not yet read) changes the v1 root API; or (b) `firebase-functions/v1` at the pinned v6 version does NOT re-export the identical builder surface (emulator load-check would catch it). Re-verify both at build time against github.com release notes for the exact pinned versions.

## Sources (github.com only)
- [releases/tag/v6.0.0](https://github.com/firebase/firebase-functions/releases/tag/v6.0.0) — default-entrypoint→v2; `config()` @deprecated.
- [releases/tag/v5.0.0](https://github.com/firebase/firebase-functions/releases/tag/v5.0.0) — v2 named firestore; remove admin-v10 dep.
- [CHANGELOG.md](https://github.com/firebase/firebase-functions/blob/master/CHANGELOG.md) — Node 18 dropped, min Node 20.
- [issue #1622](https://github.com/firebase/firebase-functions/issues/1622) — v4→v6 gen-1 triggers undefined.
- [issue #1653](https://github.com/firebase/firebase-functions/issues/1653) — Node 22 disabled for gen-1.
- [issues #1596](https://github.com/firebase/firebase-functions/issues/1596) / [#1598](https://github.com/firebase/firebase-functions/issues/1598) — v5.1.0 Extensions-API deploy requirement.
