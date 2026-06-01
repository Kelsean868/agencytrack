# Track J — System Screens v2 (visual restyle)

**Sized:** M
**Branch:** `redesign/system-screens-v2` — **stacked off `redesign/kiosk-v2`** (so the `CONTEXT.md` rows don't collide).
**Type:** Client-only UI. **Visual restyle** of login, app-state screens, onboarding, and the global dialogs. Auth flow, routing, and component logic preserved. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

`LoginScreen`, App.jsx's loading/provisioning/stub state screens, onboarding, and `Toast`/`ConfirmDialog`/`NotificationDrawer` adopt the v2 visual language, with zero change to the auth flow, role routing, or component logic.

## Decisions baked in (do not re-litigate)

- **VISUAL ONLY.** Preserve: the email+password auth flow, `useAuth` resolution, **role-based routing in App.jsx**, the `LoginScreen` form fields, the `WelcomeScreen` 4-slide structure, and `Toast`/`ConfirmDialog`/`NotificationDrawer` logic.
- **App.jsx is the danger zone:** restyle ONLY the presentational state *screens* (Loading / Provisioning / Stub) — do NOT touch the routing or auth-resolution logic. If the restyle appears to require an auth/routing change, **STOP and surface**.
- Mockup adds: cream-surface login with an animated insurance-iconography backdrop (drifting glyph grid — phone/handshake/doc/dollar/calendar/shield/target/chart), a liquid-glass card with backdrop-blur, and a password-field eye-toggle (show/hide — UI-only). All on existing auth.
- **Visual source** = the System Screens mockup in `design_handoff_v2_app/mockups/`. Nexus tokens, no raw hex, 44px targets, dark mode.

## Phase 0 — pre-flight

1. `git fetch origin`; confirm base is `redesign/kiosk-v2` (stacked); `git log --oneline -1` of the base verbatim.
2. Move brief → `docs/briefs/track-j-system-screens-v2-kickoff.md`; branch `redesign/system-screens-v2` off `redesign/kiosk-v2`; commit as commit 1.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Locate the System Screens mockup; source-verify the login restyle (cream surface, backdrop glyph grid, glass card, eye-toggle), the app-state screens, onboarding, and the dialogs.
3. Map onto `auth/LoginScreen.jsx`, `App.jsx` (state screens only), `onboarding/*`, `ui/Toast`, `ConfirmDialog`, `NotificationDrawer`.
4. **Pin the preserve-list, especially App.jsx routing + auth resolution + the form fields + dialog logic — leave untouched.**
5. **If the mockup turns out to add behavior beyond visual (new auth steps, new routing, new dialog logic) → surprise-stop and surface.**

## Phase 2 — build

- Restyle login + app-state screens + onboarding + dialogs. Preserve auth/routing/logic. The eye-toggle is UI-only. Nexus tokens, no raw hex, 44px, dark mode.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (terminal):** the listed files + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no auth/routing logic change, no unrelated `src/`.
- **3c lint / test / build** green.
- **3d axe baseline-delta** both themes; NO-NEW serious/critical; 44px targets.
- **3e REGRESSION tests:** auth flow intact (login → app loads); App.jsx routing unchanged; dialog/toast/drawer logic intact; eye-toggle toggles field type only.
- **3f LIVE smoke (both themes) — full auth flow:** logged-out → restyled login renders (cream surface, backdrop, glass card, eye-toggle works) → enter test-agent creds → login → loading/provisioning states render restyled → app loads. 0 errors. Preview; prod in Phase 6.

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the System Screens row in the Track J ledger.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + the auth-flow smoke. STOP. I pre-review that App.jsx routing/auth is UNTOUCHED (only state screens restyled), the login flow works end-to-end, and hex is clean.

## Phase 6 — post-merge (no deploy)

After Kiosk merges first and this rebases onto updated main: sync, fill, push direct to main, Rule 15 verbatim; prod smoke (auth flow, both themes) verbatim. Frontend-only.

## Acceptance criteria

- Login + app-state screens + onboarding + dialogs adopt v2 visuals; auth/routing/logic preserved (regression-tested); the login flow live-smoked both themes; 44px targets; gates green.

## Out of scope

Auth/routing/logic changes. Other Wave screens. Any `functions/` change.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
