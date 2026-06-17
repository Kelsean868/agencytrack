# Brief: Fix the "Update" button on the new-version banner (does not reload)

## Context
The reload banner from #673 ("A new version is available." + Update button) shows correctly, but
clicking **Update does not reload the app** — users have to manually refresh to get the new version.
The manual refresh works (a navigation lets the new SW take control), which points at the
skip-waiting → reload handshake, not at the banner itself.

## Leading hypothesis (confirm or falsify in recon, per Rule 23)
The #673 SW build had `clientsClaim` absent (correct for prompt mode). With skipWaiting gated behind the
SKIP_WAITING message and no clientsClaim, when the user clicks Update the new SW activates but does not
claim the already-open page, so `controllerchange` never fires on that page → vite-plugin-pwa's
reload-on-controllerchange never triggers → no reload. Manual refresh navigates, the new SW takes over,
the new version loads — exactly the reported behaviour.
- Falsification: if recon shows a `controllerchange` → reload listener IS firing, or the Update button
  isn't calling `updateServiceWorker(true)` at all, the cause is different — report and adjust before building.

## Objective
Make the Update button reliably reload into the new version when clicked, **without changing prompt-mode
behaviour** (no silent auto-takeover; the SW still only skips waiting on the user's click).

## Scope
- The reload wiring: `src/components/ui/ReloadPrompt.jsx`, the `registerSW` / `updateServiceWorker`
  setup in `main.jsx`, and the SW config in `vite.config.js` (Phase 1 confirms exact files/wiring).
- A robust reload after the user clicks Update.

## Out of scope
- The banner UI / copy.
- Reverting to `autoUpdate` (keep prompt mode).
- The Firestore-runtimeCaching removal (#675) — untouched.

## Procedure note
Branch at **Phase 0, before any code**. PowerShell — no `&&`.
**SW infra → human review (Tier C); build-and-hold, do not auto-merge.**

## Phase 1 — recon (report before building)
1. Read `ReloadPrompt.jsx` + the `registerSW` wiring in `main.jsx`. Confirm exactly what the Update
   button's onClick calls, with what args — is `updateServiceWorker(true)` invoked?
2. Confirm whether any `navigator.serviceWorker` `controllerchange` → reload listener exists, and whether
   `clientsClaim` is present/absent in the generated `dist/sw.js`.
3. State which of these is the cause (confirm or falsify the hypothesis above). Report, then proceed.

## Phase 2 — build (shape depends on recon)
Implement a robust reload on Update. Preferred approach (adjust to what recon finds):
- On Update click: call `updateServiceWorker(true)` to post SKIP_WAITING, AND ensure a one-time
  `controllerchange` listener reloads the page. If `controllerchange` can't be relied on (clientsClaim
  absent and not being added), add an explicit `window.location.reload()` fallback shortly after the
  skip-waiting message so the user always lands on the new version.
- Do **not** enable clientsClaim/skipWaiting globally — that would break prompt mode by auto-taking-over.

## Verification
- Build-level: confirm the Update handler posts SKIP_WAITING and a reload path exists (controllerchange
  listener and/or explicit reload fallback). `dist/sw.js` still prompt-mode (skipWaiting gated behind the
  message; no global clientsClaim auto-takeover).
- Tests green; CI green; Gemini polled + dispositioned.
- **Manual production proof (the real test — operator runs it):** a true two-version update can't be
  smoked in CI, so after merge + deploy — open the live app in an already-open session, wait for / trigger
  the "new version available" banner, click **Update once**, confirm the page reloads to the new version
  with no manual refresh. Report PASS.

## Phase 4-5
- Docs placeholders (CONTEXT.md, FOLLOW_UPS.md). Commit on the feature branch, push, open PR.
  **HOLD for human review (Tier C).**

## Acceptance
- Clicking Update reloads into the new version, no manual refresh.
- Prompt mode preserved (no silent auto-takeover; SW only skips waiting on the click).

## Risks
- Touching SW reload logic can regress the whole update path → human review required, and the operator's
  manual two-version test is the gate before trusting it.
