# Brief — Role-aware quick-action shortcut + remove mobile floating pencil (feedback #10 + #11)

**Tier:** B (frontend; role-aware navigation, no auth/rules/money). **Merge:** supervised — CC builds to PR-open, operator reviews + merges (live pilot, not autonomous).

## Objective
Replace the floating pencil with a role-aware quick-action shortcut that routes to **existing** flows. No new write paths, no new functionality — it's a navigation entry point.

- **Mobile:** remove the floating pencil. Make the **existing bottom-bar Submit button** fan out (speed-dial) into the role's actions on tap; collapse on select or outside-tap.
- **Desktop:** replace the pencil with the same shortcut (button → menu/fan) rendering the role's actions.
- Shared role→actions logic; the anchor differs per platform (mobile bottom-bar Submit; desktop shortcut).

## Role → action map (locked)
- **Agent:** New daily entry · New weekly report · New policy entry
- **Unit Manager / Branch Manager:** New daily entry · New weekly report (own production) · New policy entry · WAR entry · Recruiting activity
- **Sales Manager / Tenant Admin:** Add team member (create user) — single action
- **Platform Admin:** out of scope (no per-tenant producing role)

## Phase 0/1 — Recon (source-verify; hard-stop if a target flow is missing)
1. Locate the mobile bottom-bar Submit button, the floating pencil (mobile), and the desktop pencil. Confirm the files and how each renders per breakpoint.
2. Confirm the role/claim source the shortcut reads (the same one used elsewhere for role gating).
3. For **each** action, locate the existing flow it routes to and how it's opened:
   - new daily entry · new weekly report (include the BM branch-direct sentinel path) · new policy entry (policy ledger) · WAR entry · recruiting activity · add-team-member / create-user (provisioning).
   - **Recruiting activity** in particular may not have a dedicated flow — confirm. If any target flow does **not** exist for a role, STOP and report; do not invent it.
4. Report the recon (anchors + confirmed target flows) before building.

## Phase 2/3 — Build
- A shared `role → actions` config + a shortcut component that renders the role's actions and routes each to its existing flow.
- **Mobile:** remove the floating pencil; wire the existing bottom-bar Submit button to fan out into the role's actions; collapse on select/outside-tap. 44px targets, Nexus tokens, no gradients.
- **Desktop:** replace the pencil with the shortcut rendering the role's actions.
- Every action opens an existing flow — no new write paths.

## Phase 4/5 — Docs-with-placeholders, then commit / push / PR (standard).

## Verify (smoke)
- Navigation-only (no writes) → emulator/preview-safe, **zero production writes**.
- For each role (agent, UM, BM, SM, TA): open the shortcut on **mobile** (fan-out from the bottom-bar Submit) **and desktop** → assert the correct action list renders → assert each action opens the right flow.
- Assert the floating pencil is gone on mobile.
- Both-theme axe, no NEW serious/critical vs main.

## Self-critique gate (Rule 22)
Name ≥1 gap before the PR-ready report — e.g. a role whose action list resolves empty, or a non-producing UM edge where "own production" entries shouldn't appear.
