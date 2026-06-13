# Un-gate Goals (close the loop's commit-target dead-end)

## Context
The planning loop commits the agent's Personal Commitment into Goals, and the Game Plan
hub's CommitPreviewCard links to the Goals screen — but `goals` is still in the
coming-soon set (`COMING_SOON_TABS` in `src/config/comingSoonTabs.js`), so both the
commit target and the "Set Goals" link dead-end at the `ComingSoonPanel` placeholder. This
un-gates Goals so an agent can actually view/edit their committed goal.

This is the **same surgical pattern as the Money Needs un-gate (PR #605, `d4bec45`)**:
PR #605 found that removing the tab from the set alone wasn't enough — `AgentDashboard`
line ~659 hardcoded `ComingSoonPanel` for the gated tab, so CC also imported the real
panel and swapped the render. Expect the same shape here for `goals`.

It's **production-facing and not flag-guarded** — merging + deploying makes Goals live for
every agent. So it is **human-merge**: held for Kyron's eyeball in preview, because Goals
is a fuller screen than the Money Needs worksheet and should be confirmed display-ready
before it goes live.

## Decisions locked (surface ANY deviation before implementing)
- Remove **`goals`** from `COMING_SOON_TABS` (and `MANAGER_COMING_SOON_TABS` if it appears
  there — Phase 1 confirms; for Money Needs it was only in `COMING_SOON_TABS`).
- **Keep `prospect-info` gated** — it's the last coming-soon item; do not touch it.
- Import the real Goals component and swap the hardcoded `ComingSoonPanel` render for the
  `goals` tab, exactly as #605 did for `money-needs`.
- No flag, no new gating, no rules change (the goals doc rules are already live — the loop
  writes `goals.personalAnnualAPI`).

## Phase 1 — recon (report findings inline, then PROCEED through the build)
**Only stop if a finding contradicts a locked decision OR the Goals screen is not
display-ready** (see item 4 — that's a genuine stop condition for this one).
1. **`src/config/comingSoonTabs.js`** — confirm which set(s) contain `goals` and the exact
   tab-id string.
2. **`AgentDashboard.jsx` render block** — confirm whether `goals` is hardcoded to
   `ComingSoonPanel` (as `money-needs` was at ~line 659). Identify **which component the
   `goals` tab is meant to render for an agent** (the Track J v2 redesign added a Goals tab
   pointing to an existing component — confirm whether that's `GapAnalysisPanel`, a
   `GoalsPanel` agent view, or another surface) and the nav-disabled injection site.
3. **The gating test** (the one #605 updated for `money-needs`) — to flip `goals` to
   not-gated while keeping `prospect-info` gated.
4. **Display-readiness** — render the real Goals component for an agent and report whether
   it's clean (loads goals, shows the 5-layer cascade / personal commitment, honest empty
   states) or has rough edges. **If it's visibly broken or half-built, STOP and report** —
   don't ship a broken screen live; we'll decide whether to fix-then-ship or defer.

## Phase 2 — un-gate
- Remove `goals` from the set(s); import the real Goals component; swap the `goals` render
  off `ComingSoonPanel`. Verify the nav no longer marks it disabled.

## Phase 3 — tests
- Update the gating test: `goals` not gated (renders the real component / no disabled
  badge); `prospect-info` still gated. Keep the suite green.

## Phase 4 — docs + commit/PR
- PR row; note this closes the loop's commit-target + "Set Goals" dead-end (the #605
  Rule 22 gap).
- CONTEXT.md: live production-facing un-gate — advances Current main HEAD (like #605).
- Branch `feat/ungate-goals`; `feat(game-plan): un-gate Goals (loop commit target)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
**Production-facing — real smoke (mirror the #605 money-needs-ungate-smoke):** against the
preview, open the Goals screen via the nav AND via the Game Plan CommitPreviewCard
"Set Goals" link → assert the **real Goals screen renders** (not `ComingSoonPanel`) →
confirm it loads the agent's goal (the committed `personalAnnualAPI` should surface). Both
themes + a mobile leg (use the More-drawer routine #605 needed at mobile viewport).

## Merge posture
**Human-merge — held for Kyron's review.** Build to PR-open and STOP; do not merge, do not
deploy. Kyron eyeballs the un-gated Goals screen in the preview (fuller screen than the
worksheet) and merges when back. On merge, Vercel auto-deploys → Goals live. No rules
deploy.
