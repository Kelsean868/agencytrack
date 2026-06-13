# Game Plan Planning Loop — Un-gate Release

## Context
The full agent planning loop is built and dormant behind `VITE_YEAR_PLAN_ENABLED`:
Money Needs → Year Plan → Monthly → Review & Commit, each gated and verified in isolation.
This is the **single release PR that takes it live** — the accumulated un-gate prep
bundled with the flag flip. It is the highest-stakes merge in the track: merging it makes
the loop visible and writable for real agents in production. Treat it as a go-live, not a
slice.

Because the pilot is postponed indefinitely, there is **no schedule pressure** — the gate
on this PR is the end-to-end smoke passing and the prep being clean, not a date.

## What this PR bundles (the un-gate checklist)
1. Rename the loop flag to a loop-level name.
2. Focus traps + Escape on every planning-loop modal (the banked a11y item).
3. The end-to-end loop smoke — the full round-trip in one run.
4. The flag flip — default the loop on.

## Decisions locked (confirm the two flagged seams before merge, not before build)

**Flag rename.** `VITE_YEAR_PLAN_ENABLED` → **`VITE_GAME_PLAN_LOOP_ENABLED`** (it gates the
whole loop, not just Year Plan). Mechanical rename across every reference — components,
`vite.config` test env, `.env.example`, any docs. *(Flag for Kyron: confirm the name.)*

**Flip mechanism — default ON, keep the flag as a kill-switch.** Flip the flag's **code
default to `true`** so the loop is on everywhere via the normal merge → Vercel auto-deploy
(no invisible Vercel-env change). Keep the (renamed) flag in place as a kill-switch for the
initial go-live; **removing the flag entirely is a later cleanup** once the loop's proven
stable in production. *(Flag for Kyron: confirm keep-as-kill-switch vs remove-now.)*

**Focus traps.** Every planning-loop **modal** gets a focus trap + Escape-to-close, applied
consistently (a shared hook/utility is cleaner than three copies). Phase 1 enumerates which
surfaces are modals — at minimum `YearPlanModal` (lacks both today), `MonthlyPlanModal`
(has Escape, no trap), `ReviewCommitModal`. Money Needs is a worksheet page, not a modal —
confirm and treat accordingly.

**No rules deploy.** All Firestore rules the loop needs are already live (the yearPlan +
monthlyPlan owner arms were deployed at their foundations; the commit's status flip uses
the already-unconstrained update arm; the goals self-write is already permitted). So the
go-live is **frontend-only** — merge → Vercel auto-deploys → live. Confirm in Phase 1 that
nothing rules-related is outstanding.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
1. **Every `VITE_YEAR_PLAN_ENABLED` reference** — grep the full set (components, vite.config,
   .env.example, docs) so the rename is complete and nothing is missed.
2. **The planning-loop modals** — which surfaces are modals needing focus traps; the current
   focus/Escape state of each; whether a shared focus-trap hook already exists in the repo to
   reuse.
3. **The existing smoke scripts** — Money Needs, Monthly, and commit smokes
   (`scripts/verification/*`) — to chain into one end-to-end round-trip rather than writing
   from scratch.
4. **Rules** — confirm no outstanding rules change is needed for any loop write at scale
   (owner arms live; commit status flip permitted; goals self-write permitted).

## Phase 2 — flag rename (mechanical)
- Rename `VITE_YEAR_PLAN_ENABLED` → `VITE_GAME_PLAN_LOOP_ENABLED` everywhere, including the
  `vite.config` test env (which forces it on for the suite) and `.env.example`. No behaviour
  change yet — still defaulting OFF in this phase.

## Phase 3 — focus traps + Escape
- Add a focus trap + Escape-to-close to each planning-loop modal, via a shared utility/hook.
  Initial focus on the modal, focus cycles within, Escape closes, focus returns to the opener.
- RTL: tab cycles within each modal; Escape closes each; focus returns to the trigger.

## Phase 4 — end-to-end loop smoke (`scripts/verification/`)
- Chain the round-trip in one run, flag forced on locally (the temp-`.env.local` +
  dev-server pattern the panel smokes used): seed a clean agent → Money Needs → Year Plan
  (clears API + apps floors at the agent's average) → Monthly (balanced split) → Commit
  (sets average if prompted) → assert at the Firestore level (Admin SDK): the moneyNeeds /
  yearPlan / monthlyPlan docs, `goals.personalAnnualAPI`, both plan statuses `committed`,
  `committedAt` → reload → loop reads 4/4 · 100%. Both themes + a mobile leg. **Run it; it
  must be green before the flip.** Revert the temp flag after.

## Phase 5 — the flip (go-live)
- Flip the loop flag's code default to `true`. This is the last commit; merging the PR is
  the go-live. Keep it isolated and obvious in the diff.

## Phase 6 — docs + commit/PR
- PR row; note this completes + un-gates the planning loop.
- FOLLOW_UPS: close the un-gate-prep items (focus traps, rename, end-to-end smoke); bank the
  later "remove the kill-switch flag once stable" cleanup; note any per-modal a11y residue.
- CONTEXT.md: this **does** advance Current main HEAD (the loop is now live, not gated) and
  flips the track to shipped/live — update accordingly (Rule 16(b): no longer gated).
- Branch `feat/ungate-planning-loop`; `feat(game-plan): un-gate the planning loop (rename flag, focus traps, e2e smoke, flip on)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
The Phase-4 end-to-end loop smoke **is** the gate — the full Money Needs → Commit round-trip,
green, flag-on, Firestore-asserted, before the flip. This is the comprehensive proof the
whole loop holds together that each gated slice deferred.

## Merge posture
**Human-merge — this is the go-live.** Hold for review; the end-to-end smoke must be green;
eyeball the whole loop flag-on locally one last time (every step, both themes, mobile). On
merge, Vercel auto-deploys and the loop is live — **no rules deploy** (all already live). If
anything looks off in production after deploy, the kept kill-switch flag (default flipped
back to off, or the Vercel env override) is the instant rollback.
