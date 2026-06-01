# Track J — Kiosk Mode v2 (animation/visual restyle)

**Sized:** S–M
**Branch:** `redesign/kiosk-v2` (off main — first in the stack)
**Type:** Client-only UI. **Visual/animation restyle** of the kiosk surface on the `--color-presentation-*` token family. Kiosk infrastructure preserved. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

The kiosk display adopts the v2 mockup's warmer dark treatment, gold/hot accent layering, and animation keyframes, with zero change to the kiosk infrastructure (shell, route, token validation, panel rotation).

## Decisions baked in (do not re-litigate)

- **VISUAL/ANIMATION ONLY.** `KioskShell`, `KioskModeTab`, `KioskRoute`, token validation, and panel rotation (E5 #73/#74, E5.1 #75) are preserved untouched. If the restyle appears to need an infra/logic change, **STOP and surface**.
- **Tokens:** the kiosk is an always-dark surface using the **`--color-presentation-*`** family (theme-independent, `:root` only — per PR5). All new accent layering uses these tokens. **No raw hex.**
- The mockup adds animation keyframes (pulse-dot, breathe, halo-gold/teal/hot, drift, tick, confetti, sparkle, balloon-float) + warmer dark + gold/hot accent layering — all on the presentation tokens.
- **Visual source** = the Kiosk Mode mockup in `design_handoff_v2_app/mockups/` (locate in Phase 1).

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-kiosk-v2-kickoff.md`; branch `redesign/kiosk-v2` off main; commit as commit 1.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Locate the Kiosk mockup; source-verify the keyframes + the `--color-presentation-*` accent usage.
3. Map onto `KioskShell.jsx`, `KioskModeTab.jsx`, `kiosk/panels/*`.
4. Pin the preserve-list: kiosk infra, token validation, panel rotation, `KioskRoute`.
5. Confirm how the kiosk renders for the smoke (the kiosk route + its access token).
6. **If the mockup turns out to add features beyond animation/visual (new panels, new data, new rotation logic) → surprise-stop and surface — do NOT assume restyle.**

## Phase 2 — build

- Add the keyframes + warmer-dark + gold/hot accent layering on `--color-presentation-*`. Restyle the panels. Preserve infra/rotation/validation. No raw hex.

## Phase 3 — gates

- **3a hex-grep** empty (presentation tokens, not raw hex).
- **3b scope (terminal):** `kiosk/*` + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no `KioskRoute`/validation logic change, no unrelated `src/`.
- **3c lint / test / build** green.
- **3d axe** on the kiosk surface (presentation-token contrast).
- **3e component tests:** panels render restyled; rotation still cycles; token validation intact.
- **3f LIVE smoke:** load the kiosk route (valid token) → panels render restyled + rotate + 0 console errors. (Kiosk is theme-independent via presentation tokens — one render.)

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the Kiosk row in the Track J ledger.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + smoke. STOP. I pre-review presentational-only (no infra change), hex-clean (presentation tokens), rotation/validation preserved.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (kiosk renders + rotates) verbatim. Frontend-only.

## Acceptance criteria

- Kiosk adopts the v2 warmer-dark + accents + keyframes on presentation tokens; infra/rotation/validation preserved; component-tested; smoked; no raw hex; gates green.

## Out of scope

Kiosk infra/route/validation/rotation logic. Other Wave screens. Any `functions/` change.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.
