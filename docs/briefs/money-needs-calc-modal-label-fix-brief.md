# Money Needs — calc-modal label truncation fix (LineItemRow desktop)

## Scope & channel
- **This is the README-v2 ADDENDUM only.** The original card layout + responsive `LineItemRow` shipped in **#718** — do **not** re-do it. This brief fixes one remaining desktop defect **inside the calculator modal**.
- **Type:** presentation-only. No data-model, service, prop, contract, or flag change.
- **Channel:** build → PR-open → **HOLD** (human merge). Agent-facing UX on the LIVE Money Needs surface. No auto-merge.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys.

## Defect
In the sub-calculator modal (`FloatingCalcModal` → `SubCalcLineItems` → `LineItemRow`), on **desktop** the Description stays pinned narrow ("Life License", "TTAIFA Con…") while a large empty gap sits between the Frequency and Annual columns — the horizontal slack lands in the gap instead of the label. Mobile is already correct (it stacks). #718 fixed the main-panel manual rows; this row variant still truncates.

## Phase 0 — source-verify (report before building; Rule 17)
1. Confirm the render path: `SubCalcLineItems` renders `LineItemRow` (the #718 responsive version) — or a different row component. Confirm in `src/components/agent/MoneyNeedsPanel.jsx`.
2. **Find the actual cause of the desktop gap** (don't assume): is the description element `flex-1 min-w-0`, or is there an `ml-auto` / spacer / fixed-or-auto width on the label (or before Annual) pushing the numeric columns right? #718 specced the manual-row desktop label as `flex-1` — so if the modal still truncates, the cause is specific to this row variant (e.g. a read-only label not getting `flex-1`, or a spacer). Report what you find.
3. Confirm the trailing columns' current widths (amount, frequency, annual, delete) and whether `LineItemRow` is the **single shared** component used in both the main panel and the modal (so one fix covers both).

## Fix (from CD addendum)
In the desktop path of the shared row component:
- The Description element must be **`flex-1 min-w-0`** so it absorbs all horizontal slack; the numeric columns pack to the right against it.
- Trailing columns fixed and right: amount `w-24`, frequency `auto`, annual `w-28 text-right shrink-0`, delete `shrink-0`.
- **Remove any `ml-auto`/spacer before Annual** — a single `flex items-center gap-2` row with only the label growing is all that's needed.
- Apply to the **shared** `LineItemRow` (the one used in both places) so the modal inherits it. If Phase 0 finds the modal uses a different row variant, apply the same flex-grow-label there.
- **Mobile unchanged** (already stacks correctly). Do not touch the #718 `CalcFedLineRow` card.

## Do NOT change
Handlers, `onOpenCalc`/`onReset` contracts, the #718 `CalcFedLineRow` card layout, `FloatingCalcModal` shell, `moneyNeedsService`, tokens (`tailwind.config.js`/`index.css`). No new tokens/colours/flag.

## Tests & smoke
- Component test: the desktop row's Description element is `flex-1 min-w-0` and grows; a long-label row renders its full label; no `ml-auto`/spacer before Annual.
- **Production smoke — re-run the #718 Money Needs smoke as a regression guard**, plus: open a calc modal and assert a long-label row (e.g. "Life License Renewal", "TTAIFA Conference") renders its **full** label on desktop with **no gap** before Annual; and confirm the main-panel manual rows still render correctly (no regression from #718). Both viewports, both themes.
- Rule 22: note anything the smoke can't reach (e.g. a pixel-level gap read is a bounding-box assertion, not a visual review).

## Gates & close
lint/test/build · both-theme · **axe NO-NEW** · hex-grep empty (token-only). PR-open, **HOLD**. Rule 20/21/22/23.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch money-needs-calc-modal-label-fix-brief.md`
