# Brief: Service-Worker Version-Update Prompt (prompt-to-reload)

## Context
Live-pilot feedback item #1 ("stale version on login") was diagnosed and **resolved as a
miscommunication**, not a caching bug. Agents were seeing the current empty-state dashboard
(zero submissions), poking around, starting a draft, and the populated v2 dashboard then
rendered — which read to them as "the app refreshed to the new version." No genuine bundle
staleness occurred in those reports.

However, CC's recon (HARD-STOP, no changes) surfaced a **real latent issue** independent of that
confusion: the service worker serves the precached app shell cache-first with no reload-on-update
wired, so when a genuine new version is deployed, an agent with the app open/cached stays a deploy
behind until a second manual reload. This brief fixes that latent issue with a **user-prompted**
reload.

**Urgency: low.** The reported symptom was a phantom. This is latent cleanup, worth doing because
during active pilot iteration agents lagging a deploy behind cause phantom "still broken" reports
and delay them seeing new fixes/features. Sequence it sensibly — not ahead of the higher-value real
feedback items.

## Root cause (from CC recon — source-verified at recon time)
- `vite.config.js` (~lines 36-63): VitePWA in Workbox `generateSW` mode, `registerType: 'autoUpdate'`,
  `globPatterns` includes `html` → `index.html` is precached.
- Generated `dist/sw.js`: `precacheAndRoute([... index.html ...])` + `NavigationRoute` →
  `createHandlerBoundToURL("index.html")` → every navigation served the precached shell **cache-first**.
- `src/main.jsx`: does NOT import `virtual:pwa-register` → no `controllerchange`→reload logic anywhere.
- Generated SW has `skipWaiting` + `clientsClaim` → new SW installs and claims silently, but the
  rendered page never reloads.
- Ruled out (not the cause): Vercel HTTP TTL (`vercel.json` has no Cache-Control; defaults correct),
  asset hashing (correct content hashes), version pin / Firestore-gated UI (`persistentLocalCache`
  in `src/firebase.js` is data-only).

## Objective
When a new version is deployed, show agents a clear, persistent, non-blocking banner
("A new version is available — tap to update") and reload to the fresh bundle on tap.
**Do NOT force-reload** (would lose unsaved input on explicit-save surfaces — Monthly Plan
"Save draft", daily-entry sticky "Save"). **Keep offline support** (precache stays).

## Out of scope (explicit)
- **NetworkFirst navigation strategy (Option B)** — banked as a separate follow-up if zero-lag is
  ever wanted; requires offline-fallback validation.
- **Force / automatic reload** — explicitly rejected (lost-work footgun on explicit-save forms).
- Any change to `globPatterns` / offline behavior / precache scope.
- Empty-state dashboard polish (separate candidate).

## Phase 1 — recon (report before building, do NOT change yet)
1. Confirm the current `vite.config.js` workbox block: exact `registerType`, `skipWaiting`,
   `clientsClaim`, `globPatterns`.
2. Locate the app bootstrap/init file (`src/main.jsx` or equivalent) and confirm where to wire
   `registerSW`.
3. Confirm whether a reusable toast/banner/notification component already exists (there is a
   notifications/bell surface in the header) — name it if so; otherwise note that a minimal banner
   will be added.
4. Report findings, then proceed.

## Phase 2-3 — build
1. `vite.config.js`: change `registerType` from `'autoUpdate'` to `'prompt'`. With `'prompt'`, the
   waiting SW must genuinely **wait** for the user tap — let vite-plugin-pwa manage `SKIP_WAITING`
   via the virtual module (driven by `updateSW`), do **not** force `skipWaiting` in the workbox
   config. Keep `globPatterns`/precache as-is (offline preserved).
2. App init (`src/main.jsx` or confirmed file): `import { registerSW } from 'virtual:pwa-register'`;
   call `const updateSW = registerSW({ onNeedRefresh, onRegisteredSW })`:
   - `onNeedRefresh` → surface the persistent update banner.
   - `onRegisteredSW(swUrl, r)` → set up a periodic poll `setInterval(() => r?.update(), <~60min>)`
     and also call `r?.update()` on `window` focus / `visibilitychange`, so long-open sessions
     detect deploys.
3. Update banner UI: reuse the existing toast/banner system if Phase 1 found one; otherwise add a
   minimal, accessible, theme-aware banner. On tap → call `updateSW(true)` (reload). Banner must be
   **persistent** (no auto-dismiss) and must **not block** interaction.

## Verification
Automated SW-update smoke is impractical — use a manual deploy-twice protocol:
- App builds; SW is generated; `registerSW` wiring is present.
- **Two-version test:** serve build A, load it; produce build B with a visible change; serve B;
  confirm the open client shows the update banner; tap → confirms reload to B.
- **Offline still works:** load, go offline, reload → app still serves from cache.
- Prod build still registers the SW (grep built output / load preview).
- **No force-reload** occurs without a tap (no `controllerchange`→reload).
- PASS/FAIL each leg in the PR description.

## Phase 4-5
- Docs with placeholders (CONTEXT.md, FOLLOW_UPS.md). Commit on a `feat/` branch (PowerShell — no
  `&&` chaining), push, open PR.
- **HOLD for human review.**

## Acceptance
- `registerType: 'prompt'`; waiting SW genuinely waits for the tap (no auto-skipWaiting).
- Update banner appears on a new deploy; tap reloads to fresh; persistent, accessible, theme-aware.
- Periodic update poll + focus/visibility update present.
- Offline still works (precache intact).
- No automatic/forced reload anywhere.
- All verification legs PASS.

## Risks
- Touches SW init every agent loads → **human review required; build-and-hold.** A misconfiguration
  could break SW registration entirely (no offline, runtime errors). The manual two-version test is
  the gate before merge.
- The `registerType` change alters `skipWaiting` semantics — must confirm the waiting SW genuinely
  waits, else it behaves like force-reload. Phase 1 verifies.
- Low urgency: reported symptom was a phantom; sequence sensibly, not ahead of higher-value real
  feedback items.
