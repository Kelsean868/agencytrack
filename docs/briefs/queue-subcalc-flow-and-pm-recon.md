# Queue — Money Needs sub-calc flow + Producing-manager access recon

## Run model (two independent blocks)
- **Block A** — sub-calc flow (build → PR-open → HOLD). **Block B** — producing-manager access recon (read-only → report inline → STOP).
- File-disjoint: A touches `MoneyNeedsPanel`; B only **reads** role-gating / nav / personalApi code. No overlap.
- **Sequence:** Block A first (priority build, deserves fresh context). `/compact` at the A→B boundary so both fit, then Block B.
- **Skip rule:** if Block A's Phase 0 finds the work is materially larger than "relocate a trigger" (sub-calcs aren't responsive modals), report the scope and **proceed to Block B** instead of halting the session. Block B is read-only and independent.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys. Halt language "STOP and wait for dispatcher" reserved for true safety/scope breaches.

---

## Block A — Money Needs sub-calculator flow (contextual triggers)
**Lane:** build → PR-open → **HOLD** (human merge — agent-facing UX on the LIVE Money Needs surface). No auto-merge.

**Problem:** post-#5 the category lines prefill from the sub-calculators, but the calculators sit in a trailing section — a line is empty until the agent scrolls past it and back. This moves the answer to the point of the question.

### Phase 0 — source-verify (report before building; STOP→skip-rule if scope balloons)
1. **Current sub-calc rendering/trigger** — always-expanded trailing section, or already a modal/panel triggered by something? Report the trigger + container. Surface: `src/components/agent/MoneyNeedsPanel.jsx` and the sub-calcs within (confirm paths, Rule 17).
2. **Responsive behavior** — is the sub-calc already a responsive floating surface (centred modal desktop / full-screen sheet mobile)? **If not, that wrapper is the bulk of the work — report the real scope; if materially larger than "relocate a trigger," invoke the skip rule.**
3. **Calc-fed lines (post-#5)** — confirm the four lines + sources: "Car expenses, nonbusiness" (Living ← car personal), "Business car expenses" (Business ← car business), "Professional/industry expenses" (Business ← industry), "Debt reduction (non-mortgage)" (Savings ← loans). Confirm the car calc feeds **two** lines.
4. **Read-only loan reference** — confirm "Car loan (from Loans & Debt)" is display-only (gets no trigger).

### Design (locked)
Replace the trailing sub-calc section with **contextual triggers**:
- A **calculator-icon button** next to each calc-fed line opens that line's floating sub-calculator.
- **Car calc** → trigger next to **both** its lines ("Car expenses, nonbusiness" and "Business car expenses"); both open the same calc.
- **Industry calc** → next to "Professional/industry expenses". **Loans calc** → next to "Debt reduction (non-mortgage)".
- **Read-only car-loan reference** → no trigger.
- **Floating calc:** desktop = centred modal; mobile = full-screen bottom sheet. Reuse existing rendering; wrap as a responsive modal if it isn't already (per Phase 0).
- On fill/close, the calc prefills its line(s) — existing #5 prefill + override behavior **unchanged**.
- **Remove the trailing sub-calc section** — triggers replace it; don't keep both.
- Keep the #5 "From your calculators" grouping; an empty calc-fed line reads "Calculate", a filled one shows the value + the icon to reopen.

**Accessibility (must pass):** each trigger has a descriptive `aria-label`, meets 44px touch-target min, is keyboard-operable; the modal traps focus and returns focus to the trigger on close. Nexus tokens only (no new hex). Both themes.

### Tests & smoke
- Component test: a trigger renders next to each of the four calc-fed lines (car trigger on both); clicking opens the right calc; completing it prefills the line(s); the loan reference has no trigger; the trailing section is gone.
- **Production smoke** (setupBypassSession, agent credential from `.env.local`): open Money Needs, click the car-calc trigger by "Business car expenses", fill, confirm **both** car lines populate and the grand total still counts once (write → reload → assert), on **mobile viewport and desktop** — assert full-screen sheet on mobile, modal on desktop.
- Rule 22 gap: note anything the smoke can't reach.

Gates: lint/test/build · both-theme · **axe NO-NEW** (new buttons: labels, contrast, target) · hex-grep empty. PR-open, **HOLD**. Rule 20/21/22/23.

---

## Block B — Producing-manager access recon (READ-ONLY)
**Lane:** read-only. **No branch, no code, no writes, no PR.** Produces an assessment reported inline for dispatcher → operator review. The enabling build is a separate, supervised step after sign-off (it's a role-gating / access-control change).

**Goal:** assess what it takes to give **Unit Managers and Branch Managers** (the only producing-manager roles) the full agent production experience — Game Plan, Money Needs, weekly report, daily capture, goals, and any other agent-only screens — scoped to **their own** production. SM / TA / Platform are out of scope (not producing).

### Recon (read-only — report inline, then STOP)
1. **Screen gating.** Enumerate every agent-only production screen and how each is gated (role check / feature flag / claim / route guard). Report the gating mechanism per screen.
2. **UM/BM `personalApi` (the orphaned FU).** Where is a producing manager's own-production `personalApi` defined/stored? Is it wired into anything, or orphaned? What would the agent screens read from for a UM/BM's own production, and what wiring is missing?
3. **Navigation.** How does the sidebar/nav render per role? How would a UM/BM get their agent-self screens **alongside** their existing manager views — is there room in the current model, or does it need restructuring? Report.
4. **Data scoping (access-control correctness).** Do the agent screens' data queries assume `role === agent`, or scope generically to the logged-in user? If shown to a UM/BM, would they correctly scope to that manager's **own** `personalApi` — not their team's aggregate? Report any role-assumptions that would break or, worse, leak team data into a "my production" screen.
5. **Assessment.** Propose the build sequence to enable this (e.g. wire the orphaned `personalApi` → extend gating to UM/BM → nav accommodation → verify own-data scoping) and the risks/blockers — flagging access-control correctness as the load-bearing one.

Read-only. No writes. Report the five outputs inline and **STOP** — dispatcher turns this into a proposal, then a supervised build brief.

---

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch queue-subcalc-flow-and-pm-recon.md`

Block A holds at PR-open for your review; Block B's recon comes back inline as a proposal for you. Nothing in this run changes access control — Block B only reads.
