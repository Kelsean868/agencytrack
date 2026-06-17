# Brief: Remove Firestore from Service-Worker runtimeCaching (fix broken realtime listeners)

## Context
Diagnosed via recon during the #673 SW work. The Workbox service worker has a `runtimeCaching`
rule that matches **all** of `firestore.googleapis.com` with a `NetworkFirst` +
`networkTimeoutSeconds: 5` strategy. Firestore's realtime listener uses a long-lived SSE/WebChannel
streaming endpoint (`…/Listen/channel?…`) that never "completes." Against a never-ending stream,
NetworkFirst:
- times out at 5s → cache fallback → cache miss → `no-response` → the channel fetch fails
  (`net::ERR_FAILED`);
- tries to `Cache.put()` the streaming response → throws (live streams aren't cacheable).

Net effect: **every Firestore realtime listener is dropped ~5s after it connects**, Firestore
retries, and the cycle repeats — flaky realtime updates, console error spam, and intermittent empty
states while listeners re-establish.

**Pre-existing, NOT from #673.** Confirmed via git: introduced in commit 4fde095 (Phase 7 PWA setup).
#673 changed only `registerType` and did not touch `runtimeCaching`. This has been live since Phase 7
and likely accounts for a share of the "app looked blank / had to poke around / data acting weird"
feedback. The app stayed usable because one-time reads complete under 5s and Firestore's own
`persistentLocalCache` (IndexedDB, configured in `src/firebase.js`) serves cached reads — degraded
but tolerable, not a blackout.

## Objective
Stop the SW from intercepting Firestore requests. Firestore manages its own offline persistence; the
SW has no business in its request path. Remove the Firestore `runtimeCaching` entry so Firestore
requests go straight to the network, as designed.

## Root cause (recon — source-verified)
`vite.config.js` workbox block:
```
runtimeCaching: [
  { urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
    handler: 'NetworkFirst',
    options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 5 } },
],
```
The catch-all `urlPattern` matches the `Listen/channel` SSE endpoint; NetworkFirst + 5s is wrong for a
stream.

## Scope
- `vite.config.js` — remove the `firestore.googleapis.com` entry from `runtimeCaching` (it is the only
  entry; empty or remove the array).
- No change to `globPatterns`/precache (offline shell preserved).
- No change to `registerType: 'prompt'` / the prompt SW (#673 stays).

## Out of scope
- Any change to `registerType` or the ReloadPrompt component.
- Any change to the shell precache / offline-shell behavior.

## Phase 1 — recon (report before building, no changes)
1. Confirm the Firestore entry is the ONLY `runtimeCaching` route. If there are others matching
   cross-origin Firebase APIs (`identitytoolkit`/auth, `cloudfunctions`, `firebasestorage`), report
   them — any streaming/long-poll endpoint matched by NetworkFirst has the same defect. Do not change
   those without flagging; the Firestore removal is the confirmed fix.
2. Confirm `persistentLocalCache` is configured in `src/firebase.js` (offline Firestore is handled
   there, not by the SW).
3. Report, then proceed.

## Phase 2-3 — build
- Remove the Firestore `runtimeCaching` entry. Leave `globPatterns`/precache and
  `registerType: 'prompt'` untouched.

## Verification (smoke — authenticated; tenant_admin is fine, behavior is role-agnostic)
On the preview:
1. Build; confirm the generated `dist/sw.js` no longer registers a route for
   `firestore.googleapis.com` (grep the built SW).
2. Authenticated load → confirm Firestore data loads AND the `Listen/channel` request is served from
   **network**, not the SW (DevTools Network → the request is NOT "from ServiceWorker"); the realtime
   listener stays connected past 5s; **no** `Cache.put()` / `no-response` errors for Firestore in the
   console.
3. Offline shell still renders (precache intact).
4. Firestore offline still works: load online → go offline → confirm previously-loaded data still
   shows (served by `persistentLocalCache`, not the SW).
- PASS/FAIL each leg in the PR.

## Phase 4-5
- Docs with placeholders (CONTEXT.md, FOLLOW_UPS.md). Commit on a `fix/` branch (PowerShell — no `&&`),
  push, open PR. **HOLD for human review.**

## Acceptance
- No `runtimeCaching` route matches `firestore.googleapis.com` in the built SW.
- Firestore realtime listener stays connected (no 5s SW-induced drop); no Firestore SW errors in
  console.
- Offline shell + Firestore local-cache reads both still work.
- #673 prompt SW unchanged.

## Risks
- Touches the SW config every agent loads → **human review; build-and-hold.** But the change *removes*
  a harmful rule — Firestore requests revert to going straight to network, which is the intended
  design — so the failure mode is "Firestore behaves as it does without a SW," i.e., normal. Low risk.
- The fix reaches each agent only as their SW updates (next close-reopen, or via the #673 update
  banner once it prompts a reload) — not instantly. Expected.
- Authenticated smoke uses tenant_admin (the agent test credential is currently broken on the
  preview — separate harness issue); acceptable, since Firestore listener behavior is role-agnostic.
