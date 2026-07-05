> **Phase 0 outcome (2026-07-05):** Bug 2 ("More" menu / plus trap) **FALSIFIED**
> against current source — the dismiss paths (visible 44px X close, backdrop tap,
> Escape + focus trap + focus return via `useFocusTrap`) shipped in the nav-redesign
> PRs #726 / #727 / #731 (`b7aa3724`, `98d8aed2`, `fa8f06de`), after the operator's
> report. `MobileNavDrawer` is a bottom sheet, not a fullscreen overlay; integration
> tests (`MobileNavDrawer.test.jsx`) already pin backdrop + Escape dismiss.
> **Re-scoped to PTR-only by orchestrator ruling** (branch
> `fix/mobile-nav-ptr-overscroll`): PULL_THRESHOLD 72 → 110 in
> `src/hooks/usePullToRefresh.js` + `overscroll-behavior-y: contain` on
> `.shell-content`. The touch-must-START-at-scrollTop-0 arming guard already
> existed (`onTouchStart` early-return). The one residual Bug-2 finding —
> `QuickAddMenu` (＋ sheet) lacks a *visible* close button (backdrop + Escape work)
> — is banked as a LOW FU in `docs/FOLLOW_UPS.md`. More-drawer + ＋-sheet dismissal
> re-verified live in `scripts/verification/smoke-mobile-ptr-nav.mjs`.

# FU Mobile Nav — Pull-to-refresh over-trigger + "More" menu trap

## Symptoms (operator-reported; source NOT yet located — Phase 0 must find it)
1. PULL-TO-REFRESH OVER-TRIGGERS: scrolling down on mobile fires the pull-to-
   refresh gesture far too easily and often, interrupting normal scrolling.
2. "MORE" MENU IS A TRAP: on mobile, pressing "More" in the navigation expands
   the other tabs to fill the ENTIRE screen with no visible way to go back,
   cancel, or dismiss — and the same trap involves the "plus" button shortcut.
   The user gets stuck in the overlay.

Both are functional defects (not design preferences). A separate CD pass will
later redesign nav IA; this brief fixes only the broken behavior.

## Phase 0 — Recon & falsification gate (REQUIRED — do this before any fix)
1. Locate the pull-to-refresh implementation: grep for pull-to-refresh /
   refresh handlers / touchmove / touchstart / overscroll / any PTR library.
   Report: is it custom, a library, or browser-native overscroll? What is the
   current trigger threshold and where is it set? file:line.
2. Locate the mobile navigation "More" menu and the "plus" button shortcut:
   grep for the bottom-nav / more-menu / the plus/FAB component. Report the
   component path(s), how the More overlay opens, and CONFIRM whether it has
   any dismiss affordance (close button, backdrop tap, Escape, back handling).
   Note: the prior audit found wizard + Daily Capture modals also lack focus
   trap/Escape/return — check whether this overlay shares that gap.
3. Report all findings and the proposed fix for EACH bug BEFORE editing. If
   either mechanism is materially different from the symptom description, STOP
   and surface rather than guessing.

## Build (only after Phase 0 confirms the mechanisms)
4. Pull-to-refresh: raise the activation threshold / correct the gesture
   conflict so it fires only on a deliberate over-scroll from the TOP of the
   list, not during normal downward scrolling. If it's browser-native
   overscroll, constrain it (e.g. overscroll-behavior) on the affected
   scroll containers. Do not remove refresh entirely unless Phase 0 shows it's
   the only sane fix — if so, surface that decision first.
5. "More" menu / plus trap: give the overlay a real dismiss path — a visible
   close/back affordance AND backdrop-tap-to-close AND Escape, with focus return
   to the trigger on close (mirror the pattern Meeting Mode already implements
   correctly, per the prior audit). The user must always be able to exit the
   overlay and reach the plus shortcut without being trapped.
6. Honor Nexus: 44px touch targets on any new/changed controls; no gradient
   buttons; both themes.

## Phase 4 — Docs
7. Update CONTEXT.md + FOLLOW_UPS.md (size-capped). Record both fixes and the
   confirmed file locations for audit trail.

## Phase 5 — Commit / push / PR
8. Single branch, one PR. git fetch origin before branching off main.
   Branch: fix/mobile-nav-ptr-and-more-menu
   Commit: "fix: pull-to-refresh threshold + dismissable More menu (mobile nav)"
   Push, open PR, poll CodeRabbit + Gemini, disposition all comments before
   PR-ready. Do NOT merge or deploy.

## Smoke (non-waivable, subject signed in, 380px mobile)
- Scroll down a long list (e.g. history / a manager table): confirm normal
  scrolling does NOT trigger pull-to-refresh; confirm a deliberate over-scroll
  from the top still can (if PTR is retained).
- Open "More": confirm you can dismiss it via close affordance, backdrop tap,
  AND Escape, and that focus returns to the trigger; confirm the plus shortcut
  is reachable and not trapped.
- Both themes. Re-verify no regression to normal tab navigation.

## Scope guard
Two mobile-nav BUGS only. Do NOT redesign nav IA, reorder tabs, regroup manager
surfaces, or touch the trophy — those are the separate CD design pass. Strike
count 0/2.
