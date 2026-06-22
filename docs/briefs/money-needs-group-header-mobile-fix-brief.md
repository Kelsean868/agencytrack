# Money Needs — mobile group-header truncation fix (ExpenseGroupAccordion)

## Scope & channel
- **This is the README rev-3 ADDENDUM only.** Rev 1 (expense-row cards) shipped in **#718**; rev 2 (calc-modal rows) in **#720**. Do **not** re-touch `CalcFedLineRow`, `LineItemRow`, `SubCalcLineItems`, or the modal — they're done. This fixes one remaining mobile defect in the **accordion group header**.
- **Type:** presentation-only. No data-model, service, prop, contract, or flag change.
- **Channel:** build → PR-open → **HOLD** (human merge). Agent-facing UX on the LIVE Money Needs surface. No auto-merge.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys.

## Defect
On **mobile**, `ExpenseGroupAccordion`'s header `<button>` truncates the group name to ~3 chars ("Fix…", "Livi…", "Bus…", "Sav…", "Mis…") because the `{filled} of {total} filled` count + `TTD …/yr` total + chevron consume the single row, leaving the label almost no width. Desktop is fine.

## Phase 0 — source-verify (report before building; Rule 17)
1. Confirm `ExpenseGroupAccordion`'s header `<button>` structure in `src/components/agent/MoneyNeedsPanel.jsx`: the single `justify-between` row carrying [colored dot + group label] · `{filled} of {total} filled` count · `TTD …/yr` total · chevron. Identify the `truncate` (or fixed width) on the label that causes the cutoff.
2. Confirm the toggle/open handler on the button (must stay unchanged) and that the whole header is the tap target.

## Fix (from CD rev-3)
Make the header **stack on mobile**, single-row on desktop — change the header from one `justify-between` row to `flex-col sm:flex-row sm:items-center`:
- **Mobile (`< sm`):** line 1 = colored dot + **full** group label (`flex-1 min-w-0`, **no `truncate`**, `text-wrap:pretty` so a long name can wrap to 2 lines) + chevron pinned right (`shrink-0`); line 2 = the `{filled} of {total} filled` count and the `TTD …/yr` total as a muted sub-row.
- **Desktop (`≥ sm`):** unchanged single-row (label · count · total · chevron).
- Keep the button ≥44px and the whole header tappable; the toggle behavior is unchanged.

## Do NOT change
The accordion toggle/open logic; the calc-fed/manual split inside the accordion; `CalcFedLineRow`, `LineItemRow`, `SubCalcLineItems`, `FloatingCalcModal` (all shipped in #718/#720); `moneyNeedsService`; tokens (`tailwind.config.js`/`index.css`). No new tokens/colours/flag.

## Tests & smoke
- Component test: at mobile width the header renders the **full** group label (no truncate) with count/total on a second line; at desktop width the single-row layout is preserved; the toggle still opens/closes.
- **Production smoke — re-run the #718 floating-calc and #720 calc-modal-label smokes as regression guards**, plus: at mobile viewport assert a long group name (e.g. "Savings & Accumulation", "Business Expenses") renders in **full** in the accordion header (not truncated to ~3 chars), and the desktop header is unchanged. Both viewports, both themes.
- Rule 22: note anything the smoke can't reach (e.g. a pixel-level wrap is a width/text assertion, not a visual review).

## Gates & close
lint/test/build · both-theme · **axe NO-NEW** · hex-grep empty (token-only). PR-open, **HOLD**. Rule 20/21/22/23.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch money-needs-group-header-mobile-fix-brief.md`
