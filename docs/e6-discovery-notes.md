# E6 — Discovery notes

> Phase 2 of the E6 brief. Source-of-truth for design decisions in Phases 3–10.

## 1. Draft path & shape

**Drafts and submissions share a single Firestore path:**
```
tenants/{tenantId}/submissions/{userId}_{weekStarting}
```
The status is differentiated by `status: 'draft' | 'submitted'`. There is **no** separate `drafts/` collection.

- **Doc id format:** `${uid}_${weekStarting}` (e.g. `J0j4uBqzTPcfm1IlGCPyDzo27RP2_2026-05-10`).
- **Doc shape:** V2 schema (post-PR #69). `version: 2`, sub-objects `newBusiness: { apps, api }`, `pppIncreases: { apps, apiIncrease }`, `lumpsums: { grossAmount, apiCredit, commission }`, plus computed `totalProductionCredit` and `totalCommission`. All non-V2 numeric fields stored at root.
- **Service:** `src/services/submissionService.js` — `saveDraft`, `submitReport`, `getDraft`, `sanitize`. `sanitize(data, commissionRate)` builds the V2 shape and is the single transform from formData → Firestore doc.
- **Submission update rule:** agents can only update their own draft (`canAccessOwn` AND `resource.data.status == 'draft'`). Aggregator runs via Admin SDK and bypasses rules.

**Implication for the aggregator:** it must write to `submissions/{uid}_{weekStarting}` with `status: 'draft'` and `merge: true`, but **must skip if the existing doc has `status === 'submitted'`** to avoid silently overwriting a submitted report. This deviates from the brief's `drafts/` collection assumption — same semantics, single path.

## 2. User profile field-add pattern

- **Service:** `src/services/userService.js` exports `updateUserProfile(uid, fields)` → `updateDoc(docRef, { ...fields, updatedAt: serverTimestamp() })`.
- **Doc path:** `tenants/{tenantId}/users/{userId}`.
- **Existing fields used by features:** `name`, `email`, `role`, `tenantId`, `branchId`, `unitId`, `agentNumber`, `contractStartDate`, `phone`, `bio`, `careerLevel`, `photoURL`, `hasSeenWelcome`, `commissionRate`, `active`, `provisioning`.
- **`commissionRate` shape:** percentage as a number (e.g. `40` not `0.40`). Confirmed via `WizardForm.jsx:208,510` — divides by 100 before computing commission.

**New fields for E6:**
- `loggingMode: 'weekly' | 'daily' | 'hybrid'` — agent's preferred cadence.
- `dailyNudgeTime: string` — `'HH:MM'` 24h, default `'17:00'`.

Defaults applied at read time (`userProfile?.loggingMode ?? 'hybrid'`) — no migration script. Field gets persisted next time the agent saves their profile.

**Push-related fields (Phase 7, deferred):** `pushNotificationsEnabled`, `pushSubscription` — NOT shipped this PR.

## 3. Firestore rules — required changes

**3a. User self-update affectedKeys allowlist (`firestore.rules:60-79`)** is currently fixed at:
```
['hasSeenWelcome', 'photoURL', 'bio', 'phone']  (+ 'unitName' for unit_manager)
```
**Required addition:** `'loggingMode'`, `'dailyNudgeTime'` so agents can save their own profile setting.

**3b. New match block for the dailyActivity subcollection.** Brief specifies the collection lives **per agent**. Matching the existing `users/{userId}/...` convention (no separate `agents/` collection), the path is:
```
tenants/{tenantId}/users/{userId}/dailyActivity/{date}
```
Rules: agent reads + writes their own; managers do NOT read (per brief: "agent-private"). Aggregator bypasses rules via Admin SDK.

```firestore-rules
match /tenants/{tenantId}/users/{userId}/dailyActivity/{date} {
  allow read, write: if isSignedIn()
    && getTenantId() == tenantId
    && request.auth.uid == userId;
}
```

**Both 3a and 3b are purely additive** — per CLAUDE.md "Additive Firestore rules / Cloud Functions" rule, safe to deploy from the feature worktree pre-merge so the Vercel preview can exercise them.

## 4. Cloud Functions

- **Runtime:** firebase-functions v1, Node 20, locked at v4.9.0 (upgrade to v5+ is its own ticket per CONTEXT.md).
- **Existing scheduled functions:** `sendSundayNudge` (`'0 22 * * 0'`), `sendMondayNudge` (`'0 11 * * 1'`), `flagMissedDeadlines` (`'1 13 * * 1'`). All use **standard cron syntax**, NOT the `'every sunday 23:00'` AppEngine-style syntax in the brief. Cron values are UTC; `getTriniSundayString` helper handles UTC→TT conversion in code.
- **Tenant scoping:** hardcoded `TENANT_ID = 'tatillife_south'` (SEC-9c — cross-tenant scheduled functions deferred). E6 aggregator follows the same pattern: single-tenant for now, tracked under SEC-9c for future generalization.
- **Region:** default (`us-central1`); no per-function override in existing functions.

**E6 aggregator schedule:** Sunday 23:00 TT = Monday 03:00 UTC = `'0 3 * * 1'`. Aggregates the week that just ended (weekStarting = the Sunday 7 days back from today's Sunday).

**Already-have helpers in `functions/index.js`:** `getTriniSundayString(date)`, `createAdminNotification(tenantId, userId, ...)`, `getAllAgents()`. Aggregator reuses them.

## 5. PWA + Service Worker state

- **vite-plugin-pwa** v1.2.0 with `registerType: 'autoUpdate'`. Workbox auto-generates the service worker — there is **no custom `public/sw.js`**. `vite.config.js:8-35`.
- **Manifest:** configured inline in vite config (no separate `manifest.webmanifest` file).
- **Workbox runtime caching:** Firestore network-first only. No push handler.
- **No `firebase/messaging` dependency.** No FCM imports, no VAPID keys in env, no push subscription code anywhere.
- **No `web-push` library** in `functions/package.json`.

## 6. Push notification approach decision

**Decision: DEFER Phase 7.** Per the brief's explicit defer permission, building push from scratch is beyond this PR's scope. Required to ship push v1:
- Eject the Workbox auto-generated SW into a custom SW (or use vite-plugin-pwa's `injectManifest` strategy).
- Add a `push` event handler to the SW.
- Generate VAPID keys, store private key in functions config, ship public key to client.
- Add `web-push` to functions deps; write a new scheduled function to dispatch nudges at agent's local time.
- Add user doc fields `pushSubscription` (Web Push subscription object) + `pushNotificationsEnabled`.

This is a substantial PWA sub-project. The core E6 feature (daily entry + aggregator + mode switching) ships without it. **In-app dashboard banner ("You haven't logged today")** is the v1 fallback nudge — handled in Phase 5 within the AgentDashboard CTA logic.

Push will ship as a follow-up PR after E6 merges. PR description will mark Phase 7 as deferred.

## 7. Subcollection path — `dailyActivity`

**Decision:** `tenants/{tenantId}/users/{userId}/dailyActivity/{date}` (subcollection under the user doc, matches existing `users/{userId}/...` convention; no separate `agents/` collection in this codebase).

Brief used `tenants/{tenantId}/agents/{agentId}/dailyActivity/{today}` — an `agents/` collection does not exist in the codebase. Adopting `users/{userId}/dailyActivity/{date}` keeps the schema consistent with how the rest of the app addresses agents (via the user doc).

Doc id is the date string (`YYYY-MM-DD`) — guarantees one entry per agent per day. Re-saving the same date upserts (per brief).

## 8. Schedule decision summary

| Item | Decision |
|---|---|
| Aggregator schedule | `'0 3 * * 1'` (Mon 03:00 UTC = Sun 23:00 TT) |
| `weekStarting` resolved | `getTriniSundayString(now - 7 days)` — last Sunday |
| Daily entry path | `tenants/{tid}/users/{uid}/dailyActivity/{YYYY-MM-DD}` |
| Draft write target | `tenants/{tid}/submissions/{uid}_{weekStarting}` with `status:'draft'`, `merge:true` |
| Skip-write condition | existing doc has `status === 'submitted'` |
| Tenant scope | `tatillife_south` only (SEC-9c, follows `sendSundayNudge` precedent) |
| Phase 7 (push) | **DEFERRED** to follow-up PR — explicit brief permission |

## 9. STOP conditions — none triggered

| Brief STOP condition | Result |
|---|---|
| Wizard draft state in localStorage | ✅ Not triggered — drafts in Firestore (`submissions/` collection with `status:'draft'`). |
| No service worker exists | ⚠️ Auto-generated Workbox SW exists, but no push handler. **Phase 7 deferred** per brief permission, not blocking core feature. |
| Existing scheduled functions HTTP-only | ✅ Not triggered — pubsub.schedule pattern in use. |
| Firestore rules conflict | ⚠️ Two additive rules changes needed (allowlist widening + new dailyActivity match block). Both safe per CLAUDE.md additive-rules policy. |

Discovery green-lights Phases 3–6 + 8–10. Phase 7 explicitly deferred.
