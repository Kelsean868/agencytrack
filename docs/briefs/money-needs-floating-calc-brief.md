# Money Needs — sub-calculators as floating calculators (contextual triggers)

## Status & channel
- **Status:** READY pending Phase 0. Design locked (re-scoped from the relocation brief — this is the modal build the skip rule surfaced).
- **Channel:** build to PR-open, **HOLD** for human merge. Agent-facing UX on the **LIVE** Money Needs surface. No auto-merge.
- **Problem:** the three sub-calcs are inline accordions in a trailing section, so a calc-fed line is empty until the agent scrolls past it and back. This converts them to floating calculators opened by a trigger at the point of each line.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys.
- **Surface:** `src/components/agent/MoneyNeedsPanel.jsx` — the sub-calcs `InsuranceIndustryCalc` (~:571), `CarExpensesCalc` (~:637), `LoansDebtCalc` (~:726), and the trailing Sub-Calculators section (~:975). Confirm at Phase 0 (Rule 17).

## Phase 0 — source-verify (report before building)
1. **Reusable modal shell — check first.** The app already has `MonthlyPlanModal` and `YearPlanModal`. Confirm whether either is a reusable responsive dialog shell (`role="dialog"`, overlay, desktop-centred / mobile full-screen sheet, focus management). **If one is reusable, use it** (this is the bulk of the saving); if neither is, the build adds a responsive modal wrapper. Report which path.
2. **Current calc structure.** Confirm the three calcs are inline accordions with local `[open,setOpen]` + header button + `{open && …}` body — this state lifts to the panel (keyed per-calc) so a trigger anywhere opens the right calc.
3. **Calc-fed lines + loan reference** (already confirmed by recon, re-verify): car personal → Living "Car expenses, nonbusiness"; car business → Business "Business car expenses"; industry → Business "Professional/industry expenses"; loans → Savings "Debt reduction (non-mortgage)"; "Car loan (from Loans & Debt)" is a display-only `<p>` (no trigger).

## Design (locked)
Convert the three sub-calcs from inline accordions to **floating calculators**, opened by contextual triggers:
- **Floating calc:** desktop = centred modal; mobile = full-screen bottom sheet. Reuse the Phase 0 modal shell if available; else add a responsive wrapper with **focus-trap + focus-return**.
- **Lift open-state to the panel** (which calc is open), so triggers embedded in different group accordions open the correct calc.
- **Trigger buttons** (calculator icon) next to each calc-fed line:
  - Car calc → next to **both** "Car expenses, nonbusiness" and "Business car expenses"; both open the same car calc.
  - Industry calc → next to "Professional/industry expenses".
  - Loans calc → next to "Debt reduction (non-mortgage)".
  - Read-only car-loan reference → **no** trigger.
- On fill/close, the calc prefills its line(s) — existing #5 prefill + override behavior **unchanged**.
- **Remove the trailing Sub-Calculators section** — triggers replace it; don't keep both.
- Keep the #5 "From your calculators" grouping; an empty calc-fed line reads "Calculate", a filled one shows the value + the icon to reopen.

**Accessibility (must pass):** triggers have descriptive `aria-label`s, meet 44px touch-target min, keyboard-operable; the modal traps focus and returns focus to the originating trigger on close. Nexus tokens only (no new hex). Both themes.

## Tests & smoke
- Component test: a trigger renders next to each calc-fed line (car on both); clicking opens the right modal calc; completing it prefills the line(s); the loan reference has no trigger; the trailing section is gone; the modal traps + returns focus.
- **Production smoke** (setupBypassSession, agent credential from `.env.local`): open Money Needs, click the car-calc trigger by "Business car expenses", fill, confirm **both** car lines populate and the grand total still counts once (write → reload → assert), on **mobile viewport and desktop** — assert full-screen sheet on mobile, centred modal on desktop, focus returns to the trigger on close.
- Rule 22 gap: note anything the smoke can't reach.

## Gates & close
lint/test/build · both-theme · **axe NO-NEW** (triggers + modal: labels, contrast, target, focus order) · hex-grep empty. PR-open, **HOLD**. Rule 20/21/22/23.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch money-needs-floating-calc-brief.md`
