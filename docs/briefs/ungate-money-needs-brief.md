# Un-gate Money Needs (complete the live planning loop's Step 1)

## Context
The planning loop went live with PR #601 (`VITE_GAME_PLAN_LOOP_ENABLED` default on). But
**Money Needs — Step 1 of that loop — is still blocked** by the separate coming-soon
gating from PR #542 (`fde5a35`): `src/config/comingSoonTabs.js` lists `money-needs` in the
coming-soon set, the NAV_ITEMS `.map()` injects `disabled: true`, and the route renders
`ComingSoonPanel` instead of the real worksheet. So an agent opening the live Game Plan hub
clicks Step 1 and dead-ends at a placeholder — the loop is live but unusable through the UI.

This un-gates **Money Needs only**, which makes the live loop work end-to-end. It's a
surgical config change (remove one tab from the coming-soon set), but it's
**production-facing and not flag-guarded** — the coming-soon gating is always-on config, so
merging + deploying makes Money Needs immediately visible to every agent.

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)
- Remove **`money-needs`** from `COMING_SOON_TABS` (and `MANAGER_COMING_SOON_TABS` if it
  appears there) in `src/config/comingSoonTabs.js`. Nothing else.
- **Keep `goals` and `prospect-prep` gated** — Kyron asked for Money Needs only. Don't
  touch the other two entries.
- No flag, no new gating, no rules change. The real `MoneyNeedsPanel` (the re-homed Game
  Plan Step-1 worksheet) renders once `money-needs` leaves the set.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
**Only stop if a finding contradicts a locked decision** (e.g. `money-needs` isn't in the
set as described, or un-gating it surfaces a half-built panel state).
1. **`src/config/comingSoonTabs.js`** — confirm the exact set name(s) containing
   `money-needs` (agent `COMING_SOON_TABS` and/or `MANAGER_COMING_SOON_TABS`), the tab-id
   string, and the `.map()` injection point so the removal is complete.
2. **The PR #542 gating tests** (the 3 rewritten for gating behaviour) — which assert
   `money-needs` is gated; they need updating to assert it's NOT gated while `goals` +
   `prospect-prep` still are.
3. **The Money Needs panel render** — confirm the real `MoneyNeedsPanel` (re-homed under
   Game Plan) renders cleanly when the tab is un-gated, and that the StepRail Step-1 route
   reaches it (not the placeholder). Report any rough edge the gating was hiding.
4. **Goals link** — confirm whether the Game Plan hub still routes anywhere to the
   (still-gated) Goals screen post-Step-4 work; if a live link now dead-ends at the Goals
   placeholder, note it (don't fix — see the dispatcher note).

## Phase 2 — un-gate
- Remove `money-needs` from the coming-soon set(s). Verify the NAV_ITEMS map no longer
  marks it `disabled`, and the route renders `MoneyNeedsPanel`.

## Phase 3 — tests
- Update the gating tests: `money-needs` not gated (renders the real panel / no disabled
  badge); `goals` + `prospect-prep` still gated. Keep the suite green.

## Phase 4 — docs + commit/PR
- PR row; note this completes the live loop's Step-1 access (the #601 loop now works
  end-to-end through the UI).
- CONTEXT.md: this is a live, production-facing un-gate — advances Current main HEAD.
- Branch `feat/ungate-money-needs`; `feat(game-plan): un-gate Money Needs (loop Step 1)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
**Production-facing — real smoke required.** Against the preview (the loop flag is already
default-on, so no temp-flag dance): open the Game Plan hub → click Step 1 → assert the real
**Money Needs worksheet renders** (not `ComingSoonPanel`) → write-read-verify (enter a
Money Needs value → save → reload → persisted). If practical, continue the chain through
the now-reachable Step 1 into Year Plan to confirm the loop opens end-to-end through the UI.
Both themes + a mobile leg.

## Merge posture
Small change, but it makes a screen **live for every agent**, so **human-merge** — eyeball
the un-gated Money Needs in the preview first. On merge, Vercel auto-deploys and Money Needs
is live. **No rules deploy** (the `moneyNeeds` worksheet rules are already live — the loop
smoke has been writing to it).
