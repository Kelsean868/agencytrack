# Money Needs — calc-fed row layout fix (presentation)

## Status & channel
- **Status:** READY pending Phase 0 + one confirm (the empty-state interaction nuance — see Design note).
- **Channel:** build → PR-open → **HOLD** (human merge). Agent-facing UX on the **LIVE** Money Needs surface, layered on merged #716. No auto-merge.
- **Type:** presentation repair of `MoneyNeedsPanel.jsx` — rewrite the JSX of two row components only. No data-model, service, prop, contract, or flag change. **One intended interaction change:** empty calc-fed lines become calculator-only (no direct typing until filled) — flagged below, build only if the dispatcher note is confirmed.
- **Source:** CD handoff, captured in full below — **brief is self-contained**. The interactive mockup (`Money Needs - Calc Row Fix.html`) is visual reference only — do **not** add it to the worktree root (lint flood). If a visual reference is wanted in-repo, place it under `docs/**/mockups/**` (eslint-ignored per #713); not required.
- **Rules in force:** 10, 15, 16, 17, 19, 20, 21, 22, 23. No deploys.

## Problem (in the shipped #716 rows)
The calc-fed and manual expense rows pack a flexible label against fixed amount/annual/action columns in one non-wrapping flex row: (1) long labels truncate — "Professional / industry expenses", "Debt reduction (non-mortgage)" lose their tail and collapse to near-nothing on mobile; (2) the calc trigger is a faint ghost-text "Calculate" link stranded far-right that doesn't read as "generate my figure here."

## Phase 0 — source-verify (report before building; Rule 17)
1. Confirm the two target components' actual names + locations in `src/components/agent/MoneyNeedsPanel.jsx`: the calc-fed row (#716 named it `CalcFedLineRow`) and the manual-entry row (CD's sheet assumes `LineItemRow` — **verify the real name**).
2. Confirm the contracts the rewrite depends on (all kept verbatim): `onOpenCalc(calcId)`, `calcKey.split('.')[0]` id resolution, `onReset(item.id)`, the `isOverridden` flag, `handleItemChange` + blur-save, the calc-fed/manual split in `ExpenseGroupAccordion`, `SubCalcLineItems`, `FloatingCalcModal`.
3. Confirm the "Prefilled… edit to override" helper `<p>` exists (it gets removed — the card shell carries that meaning).
4. **Token check:** confirm `primary`, `primary/5`, `border`, `surface`, `ink-muted`, `gold`, `rounded-xl`, `min-h-12`/`min-h-[48px]`, `h-11`, `w-24`, and a `text-wrap:pretty` utility (`text-pretty`, or arbitrary `[text-wrap:pretty]`) all exist — no new tokens. If `text-pretty` isn't in the build, use the arbitrary value.

## Design (locked — CD handoff)
Rewrite only the JSX of the two row components.

**Calc-fed row → bordered card.**
- Outer `rounded-xl border p-[11px_13px]`; empty (`amount === 0`) → `border-primary bg-primary/5` (teal-tinted); filled → `border-border bg-surface` (plain).
- **Row 1 (always):** `flex items-start gap-2` → label `flex-1 min-w-0`, **no `truncate`**, `text-wrap:pretty`; + state chip (`Calculator`, or `Edited` when `isOverridden`), `shrink-0`, top-right.
- **Row 2 — empty:** a single `w-full min-h-12` **primary button "Build with calculator →"** → `onOpenCalc(calcId)`. No input, no ghost link. *(Intended interaction change — see dispatcher note.)*
- **Row 2 — filled:** `flex items-center gap-2 flex-wrap` → editable amount input + `/yr` first; then outlined **≥44px "Recalculate"** → `onOpenCalc(calcId)`; "Reset" (outlined ≥44px) **only when `isOverridden`** → `onReset(item.id)`.
- Remove the "Prefilled… edit to override" helper `<p>`.

**Manual row → responsive.**
- `≥ sm`: one row — label input `flex-1 min-w-0` · amount `w-24` · frequency select · annual `/yr` · delete (≥44px).
- `< sm`: stack — label input full-width on its own line, then a second `flex` row of amount · frequency (`flex-1`) · annual · delete.
- All inputs keep `h-11` (44px). Add-item button unchanged.

**States to cover:** empty (teal card, CTA only, no input/annual) · filled-synced (plain card, Calculator chip, value-first, outlined Recalculate, no Reset) · overridden (Edited gold chip, Reset beside Recalculate) · manual empty/typing (Description placeholder, stacks on mobile, save on blur).

**a11y:** CTA + Recalculate keep `aria-label="Open {label} calculator"`; all targets ≥44px; `FloatingCalcModal` focus-trap + focus-return unchanged (the trigger is now a real button in both states, so focus return is cleaner). Both themes inherit from CSS-var tokens — no per-theme work. Nexus tokens only, no new hex.

## Do NOT change
All handlers, the `onOpenCalc(calcId)` contract, `calcKey.split('.')[0]`, `ExpenseGroupAccordion`'s split, `SubCalcLineItems`, `FloatingCalcModal`, `moneyNeedsService`, `tailwind.config.js`/`index.css`. No new tokens/colours/flag. Like-for-like visual swap (plus the one intended empty-state interaction above).

## Tests & smoke
- Update `src/components/agent/__tests__/MoneyNeedsPanel.test.jsx`: the #716 assertions matching old markup (ghost "Calculate" text → "Build with calculator" button; any truncated-label assumptions). Behaviour tests (open-calc click → `onOpenCalc`; Reset visibility on override) stand.
- Add layout/state assertions: a long-label calc-fed line renders its **full** label text (not truncated); an empty calc-fed line renders the CTA and **no** amount input; a filled line renders value-first + "Recalculate"; an overridden line shows "Reset"; a manual row exposes the stacked structure at mobile width.
- **Production smoke — re-run the #716 floating-calc smoke as a REGRESSION GUARD** (setupBypassSession, agent credential from `.env.local`): the calc still opens from the new "Build with calculator" CTA; prefill still lands on **both** car lines from the one car calc; count-once still holds (write→reload→assert); mobile full-screen sheet + desktop modal; focus returns to the (now button) trigger. **Plus assert the new layout:** a long label renders in full (no truncation) on mobile viewport; an empty calc-fed line shows the CTA. Both viewports, both themes.
- Rule 22: note anything the smoke can't reach.

## Gates & close
lint/test/build · both-theme · **axe NO-NEW** (CTA + Recalculate + Reset: ≥44px targets, labels, contrast) · hex-grep empty (token-only). PR-open, **HOLD**. Rule 20/21/22/23.

## Dispatch
1. Download to `~/Downloads/`.
2. `/land-and-dispatch money-needs-calc-row-fix-brief.md`
