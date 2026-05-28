# Runbook — `usesPolicyLedger` per-agent flag flip

**Last updated:** 2026-05-28  
**Relates to:** H3 parity track, PR #375 (`3d31183`) + PR #377 (`32a22ce`)

---

## What this flag does

`usesPolicyLedger` is a boolean field on the Firestore agent user doc (`/tenants/{tid}/users/{uid}`). When `true`, `AgentAwardsPanel` derives settlement data from the `policies` collection (via `settlementShapeFromPolicies`) instead of the `settlements` collection.

- **`false` (default / absent):** Awards engine reads from `settlements` docs (the old path, manually entered by managers via `SettlementPanel`).
- **`true`:** Awards engine reads from `policies` docs (the new path, sourced from `PolicyLedgerPanel`). Persistency is still merged from `settlements` (the manager-entered value).

This is a **per-agent opt-in**. It is not a tenant-wide toggle. Flipping one agent does not affect others.

---

## Pre-flip checklist

Before flipping `usesPolicyLedger: true` for an agent:

- [ ] Agent has ≥1 settled policy in `policies` collection (check Firebase Console → `tenants/{tid}/policies` → filter `agentId == uid && status == 'settled'`)
- [ ] The most recent `policies` data covers the same period as the latest `settlements` doc for that agent — expect to see the same `periodKey`s (otherwise the awards panel will show a gap)
- [ ] Agent is aware: their awards numbers may shift slightly if `policies.settledAPI` was entered differently from `settlements.settledAPI`
- [ ] Manager has reviewed and confirmed the `policies` data is accurate for the current award period
- [ ] `usesPolicyLedger` migration FU checked: if any existing policy docs have `dateIssued` at `T00:00:00Z` (pre-PR-#375 data), they may show wrong period attribution. See FOLLOW_UPS.md § "H3 existing-policy date migration".

---

## How to flip (Admin SDK path — no UI yet)

**No toggle UI exists as of 2026-05-28.** The flip requires a direct Firestore write via Admin SDK or Firebase Console.

### Option A — Admin SDK script (recommended for bulk / scripted flip)

```bash
# From repo root
node -e "
const { createRequire } = require('module');
const require2 = createRequire(process.cwd() + '/index.js');
const admin = require('./functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./functions/service-account-key.json')) });
const db = admin.firestore();
db.doc('tenants/tatillife_south/users/<AGENT_UID>').update({ usesPolicyLedger: true })
  .then(() => { console.log('done'); process.exit(0); })
  .catch(err => { console.error(err.message); process.exit(1); });
"
```

Replace `<AGENT_UID>` with the target agent's Firebase UID (found in Firebase Console → Authentication, or in Firestore user doc).

Alternatively: use `scripts/verification/h3-flip-capstone.mjs` as a reference (it seeds + flips + reverts + cleans in one pass as a verification script).

### Option B — Firebase Console (one-off manual)

1. Firebase Console → Firestore → `tenants` → `tatillife_south` → `users` → `<uid>`
2. Click the `usesPolicyLedger` field (or "Add field" if absent)
3. Set to `boolean: true`
4. Click Update

### Option C — Future UI toggle (FU banked)

A TA/BM-accessible toggle on the agent profile or `UserManagementPanel` would allow in-app flipping without Admin SDK. This is not yet built. See FOLLOW_UPS.md for the FU.

---

## Post-flip verification

1. Navigate to `agencytrack.vercel.app` as the agent (or as a manager viewing their awards panel)
2. Open **Awards** tab → verify production data displays (not the "No confirmed data" empty state)
3. Confirm the period attribution matches expected — specifically any policies dated on the **1st of a month** should appear in that month (not the prior month), confirming the TZ fix is in effect
4. Check console (DevTools) for 0 errors

For scripted verification, adapt `scripts/verification/h3-flip-capstone.mjs` to read back the agent's actual settled policies (skip the seed phase) and compare the `settlementShapeFromPolicies` output against the `settlements` collection.

---

## Reverting

If the flip causes unexpected behavior, revert via the same Admin SDK or Console path:

```js
db.doc('tenants/tatillife_south/users/<AGENT_UID>').update({ usesPolicyLedger: false })
```

Or delete the field entirely — `false` is functionally equivalent to absent (both take the `confirmedSettlements ?? []` path in `AgentAwardsPanel.jsx:234`).

---

## Notes

- `displayName` is `undefined` on the test agent doc (`J0j4uBqzTPcfm1IlGCPyDzo27RP2`) — this is a test account. Real agent docs have `displayName` set.
- The flip is **non-breaking**: if policies collection is empty or has no settled policies, `settlementShapeFromPolicies` returns `[]`, and `computeAgentAwards` with empty data returns an empty awards object (same as no-data awards state today).
- No Firestore rules change is needed. `usesPolicyLedger` is a user-doc field. The existing `canManage` write rule allows managers to update user fields. The read rule is agent-own / manager-in-scope.
