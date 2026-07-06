# Money Needs — Calc-Fed Row Fix (build prompt for CC)

**Surface:** Agent · Money Needs worksheet (Game Plan Step 1).
**Type:** Presentation-only repair. **No data-model, service, prop, or flag change.**

## The task
The shipped expense rows pack a flexible label against fixed amount / annual / action
columns in one non-wrapping flex row, so line **names truncate** (they vanish on mobile),
and the sub-calculator trigger is a faint ghost-text link that doesn't read as a call to
action. Fix the layout and make the calculator the primary action while a calc-fed line is
empty.

## The ONE file to edit
`src/components/agent/MoneyNeedsPanel.jsx` — rewrite the JSX of just two components:

- **`CalcFedLineRow`** → render as a `rounded-xl border` card.
  - Row 1 (always): label on its own full-width line — `flex-1 min-w-0`, **no `truncate`**,
    `text-wrap:pretty` — plus the `Calculator` / `Edited` chip (`shrink-0`).
  - Row 2 — **empty (`amount === 0`)**: one full-width `min-h-[48px]` primary button
    "Build with calculator →" calling `onOpenCalc(calcId)`. Nothing else to tap.
  - Row 2 — **filled**: editable amount + `/yr` first, then an outlined ≥44px "Recalculate"
    (`onOpenCalc(calcId)`); show "Reset" only when `isOverridden` (`onReset(item.id)`).
  - Empty card is teal-tinted (`border-primary bg-primary/5`); filled is plain
    (`border-border bg-surface`). Drop the "Prefilled… edit to override" helper `<p>` — the
    card shell now carries that meaning.

- **`LineItemRow`** → responsive. `≥ sm`: one row (label `flex-1 min-w-0` · amount `w-24` ·
  frequency · annual · delete). `< sm`: stack — label input full-width on its own line, then
  amount · frequency (`flex-1`) · annual · delete on a second row. Keep all inputs `h-11` (44px).

## Do NOT change
All handlers (`handleItemChange`, `handleResetCalcLine`, blur-save), the `onOpenCalc(calcId)`
contract, `calcKey.split('.')[0]` id resolution, `ExpenseGroupAccordion`'s calc-fed/manual
split, `SubCalcLineItems`, `FloatingCalcModal`, `moneyNeedsService`, and the token set
(`tailwind.config.js` / `index.css` — every class used already exists). No new tokens, colours,
or flag.

## Also touch
`src/components/agent/__tests__/MoneyNeedsPanel.test.jsx` — update assertions that match the old
markup (the ghost "Calculate" text → "Build with calculator"; truncated-label cases). Behaviour
tests stand.

## Full spec
- **`Money Needs - Calc Row Fix Build.html`** — the build-annotation sheet: before/after,
  annotated changes, component spec, files-required table, all states, responsive + a11y notes.
- **`Money Needs - Calc Row Fix.html`** — interactive mockup (toggle desktop/mobile + light/dark;
  tap a "Build with calculator" button to see the floating calculator open).

---

## ADDENDUM (rev 2) — desktop truncation inside the calculator MODAL

The expense-group rows are fixed. The remaining desktop truncation is in the **sub-calculator
modal** — `FloatingCalcModal` → `SubCalcLineItems` → `LineItemRow` — where the Description box
stays pinned narrow ("Life License", "TTAIFA Con…") with a **large empty gap between the
Frequency and Annual columns**. The slack is landing in the gap instead of the label.

**Cause:** in the modal's row, the description `<input>` is not the flex-growing element — a
fixed/auto width on the label (or an `ml-auto`/spacer pushing Annual right) is eating the space.

**Fix — in `LineItemRow` (the component `SubCalcLineItems` renders), desktop path:**
- Description `<input>` must be `flex-1 min-w-0` so it **absorbs all horizontal slack** and the
  numeric columns pack to the right against it — no gap.
- Keep the trailing columns fixed and right: amount `w-24`, frequency `auto`, annual
  `w-28 text-right shrink-0`, delete `shrink-0`. Remove any `ml-auto`/spacer before Annual; a
  single `flex items-center gap-2` row with only the label growing is all that's needed.
- Result: "Life License Renewal", "General License Renewal", "TTAIFA Conference" render in full.

This is the **same `LineItemRow`** as the main panel — apply the flex-grow label to the row used
in BOTH places so the modal inherits it. Mobile is already correct (it stacks). No other change.

---

## ADDENDUM (rev 3) — mobile expense-group HEADER truncation

On mobile the accordion **header** truncates the group name to ~3 chars ("Fix…", "Livi…", "Bus…",
"Sav…", "Mis…") because the `{filled} of {total} filled` count + `TTD …/yr` total + chevron
consume the row and the label is left with almost no width.

**Fix — in `ExpenseGroupAccordion`'s header `<button>`:**
- The header must **stack on mobile**. Below `sm`: line 1 = colored dot + full group label
  (`flex-1 min-w-0`, **no truncate**, `text-wrap:pretty` so a long name can wrap to 2 lines) +
  chevron pinned right (`shrink-0`); line 2 = the `{filled} of {total} filled` count and the
  `TTD …/yr` total as a muted sub-row.
- At `≥ sm` keep the current single-row layout (label · count · total · chevron).
- Equivalently: change the header from one `justify-between` row to
  `flex-col sm:flex-row sm:items-center`, with the label row always showing the full name and the
  count/total moving beneath it on narrow widths.
- Keep the button ≥44px and the whole header tappable (toggle unchanged).

Net: "Fixed Expenses", "Living Expenses", "Business Expenses", "Savings & Accumulation",
"Miscellaneous" all read in full on a phone; the filled-count and total sit on their own line.
Desktop unchanged.

---

## ADDENDUM (rev 4) — three usability fixes from real use

> Companion mockup: **`Money Needs - UX Round 2.html`** (toggle desktop/mobile + theme; open
> Business Expenses → tap "Build with calculator" to see the Done footer; open another section to
> watch the others collapse). All three are presentation/state changes — **no data-model change**.

### Fix 1 — the sub-calculators need a Done / Submit button
**Problem:** `FloatingCalcModal` has only an `X` in the header. Saving already happens
automatically (each calc saves on blur via `save()` → `handleSubCalcSaved`, which writes the
figure into the calc-fed line), but **the user has no signal that exiting saved** — so they don't
trust it.

**Fix — add a sticky footer to `FloatingCalcModal`** (one shared change, all three calcs inherit it):
- The modal already has a `flex flex-col` shell with a scrolling body. Add a third, `shrink-0`
  footer row after the body (sibling of the header), `border-t border-border bg-surface px-4 py-3`.
- Footer shows the **live annual total** (left, label + `font-display` value) and a primary
  **"Done — use this figure"** button (right, `min-h-12`, the `Check` Lucide icon) whose `onClick`
  is the existing `onClose`. Because Done is a button, clicking it blurs the focused input first,
  so the existing on-blur `save()` flushes the last edit before the modal closes — figure lands in
  the field automatically.
- Under it, a quiet reassurance line: `Check` icon + *"Saved automatically as you type · Done
  closes and fills the field."*
- Pass the calc's computed `annualTotal` (already in each calc component) up to the modal, OR
  render the footer **inside** each calc body (simpler — each calc already has `annualTotal`).
  Recommend: lift a `footer` slot/prop into `FloatingCalcModal` and have each calc pass
  `{ total, onDone }`. Keep `X` in the header as the secondary dismiss; both call `onClose`.

### Fix 2 — open one section at a time (others compact)
**Problem:** each `ExpenseGroupAccordion` owns its own `open` state (`useState(false)`), so opening
several leaves them all expanded and the worksheet becomes an endless scroll.

**Fix — lift open state to `MoneyNeedsPanel` (single-open accordion):**
- In `MoneyNeedsPanel` add `const [openGroup, setOpenGroup] = useState(null)` (or default to the
  first unfilled group's key).
- In the `EXPENSE_GROUPS.map(...)`, pass `open={openGroup === key}` and
  `onToggle={() => setOpenGroup(o => o === key ? null : key)}`.
- In `ExpenseGroupAccordion`, **remove the internal `open` `useState`**; consume `open` +
  `onToggle` props instead. The `aria-expanded` and chevron rotation already read `open`.
- Add a subtle lift on the open card (`shadow-sm` / `shadow-md` when `open`) so the active section
  is obvious. Smooth the chevron with the existing `transition-transform`.
- (Optional) keep a `allowMultiple` escape hatch as a prop defaulting to false, if CC wants it.

### Fix 3 — fields have no visual separation (looks overwhelming)
**Problem:** two layers blend together. (a) The group labels "From your calculators" / "Your
entries" are bare `text-[11px] uppercase` text; and (b) more importantly, the **individual field
names** (each manual `LineItemRow`, each calculator line item) run together as an undifferentiated
list — the name input sits flush with the amount/frequency row, so the calculator reads as a wall.

**Recommendation — separate at BOTH levels:**

*Level 1 — group header band (`FieldSection`).* Wrap each group (calc-fed, manual, calculator
line items) in a small component whose header is a **tinted strip**, not loose text: `flex
items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2.5`, `bg-primary/8` (teal) for the calculator
group, `bg-surface-mute` (neutral) for "Your entries", leading Lucide icon (`Sparkles` / `Pencil`)
+ label in the matching accent, optional right count/hint. `mt-3.5` between sections.

*Level 2 — every field becomes its own card (the part that was missing).* Each manual
`LineItemRow` and each calculator line item renders as a **bordered card** (`rounded-xl border
border-border bg-surface p-[10px_12px]`, `mb-2` gap between cards) — matching the calc-fed cards
that already ship. Inside the card the **name input is the heading**: full-width, `font-semibold`,
on a faint fill (`bg-surface-mute`, borderless until focus) so it reads as a title; the
amount · frequency · annual · delete sit on the row beneath it. Now calc-fed and manual fields
share one card language and each expense is a self-contained, scannable unit instead of a flat
list. This is the change that kills the "overwhelming" feel — the group bands alone weren't enough.

Pure presentation — no change to which items render or how they save. The existing
`calcFedItems` / `manualItems` split gets wrapped in `<FieldSection>`, and `LineItemRow` (both the
panel and `stacked` calc-modal paths) gets the card wrapper + heading-style label.

**Files touched (all in `src/components/agent/MoneyNeedsPanel.jsx`):** `FloatingCalcModal` (footer
slot), the three calc components (pass total + onDone), `MoneyNeedsPanel` (lifted `openGroup`),
`ExpenseGroupAccordion` (consume open props + wrap sections in `FieldSection`), plus a new small
`FieldSection` helper. No service, schema, token, or flag change.

---

## ADDENDUM (rev 5) — two more tweaks

> Mockup updated in the same file (`Money Needs - UX Round 2.html`): scroll to the bottom of the
> worksheet and tap **Send to Game Plan** to see the new acknowledgement → routing flow.

### Tweak A — reinforce per-field boxes (extends Fix 3)
Confirming the Fix-3 direction and making it stronger: **every** line item — calc-fed `CalcFedLineRow`
*and* manual `LineItemRow` — must render as its **own bordered card** (`rounded-xl border
border-border bg-surface`, a touch more border contrast + a hairline `shadow-sm`, `mb-2` gap), with
the name input styled as the card's **heading** (full-width, `font-semibold`, faint `bg-surface-mute`
fill, borderless until focus). No flush/`border-b`-only rows anywhere. Net: each expense reads as a
discrete box, not a list line — in the panel groups *and* inside the sub-calculators.

### Tweak B — Send to Playground: acknowledge, then route to Game Plan
**Today:** `CommissionTargetsPanel.handleSendToPlayground` writes `localStorage[PLAYGROUND_INCOME_GOAL_KEY]`
(read by the Commission Playground on the `commission` tab) and flips the button label to "Sent!" for
1.5s via `setSent` — the user gets no real confirmation and is left sitting on the worksheet.

**Accurate mechanism (verified against the live code):**
- Navigation in this app is **tab-state**, not a router. `AgentDashboard` holds `const [activeTab,
  setActiveTab] = useState(...)` and switches the rendered tab on its value. There is **no
  `navigate('/...')`** — moving to Game Plan = `setActiveTab('game-plan')` (the `game-plan` tab
  renders `GamePlanScreen`).
- The established convention: the dashboard already passes **`onOpenTab={setActiveTab}`** to
  `GamePlanScreen` and `AgentDashboardHomeV2`. **`MoneyNeedsPanel` is currently rendered with NO
  props** (`{activeTab === 'money-needs' && <MoneyNeedsPanel />}`). So the one integration change is:
  `<MoneyNeedsPanel onOpenTab={setActiveTab} />`, then thread `onOpenTab` down to
  `CommissionTargetsPanel`.

**Change the flow to:**
1. On click, keep the existing `localStorage` write unchanged (the Commission Playground handoff still
   happens — the figure is there if the agent later opens the `commission` tab).
2. Show a clear **acknowledgement** — a small modal/sheet (reuse the `FloatingCalcModal` shell or a
   lightweight confirm): success check + *"Target sent — saved to your Commission Playground"* + a
   primary **"Continue to Game Plan →"** button. (Keep the button label **"Send to Playground"** — that
   is the truthful action; the *acknowledgement* is what bridges the agent onward.)
3. On continue, **`onOpenTab('game-plan')`** — lands the agent on the Game Plan hub, which (with Money
   Needs now done) reads Step 2 · Year Plan as the live step. A brief "Opening Game Plan…" routing
   state is a nice touch but optional.

The mockup shows the full sequence: footer button → acknowledgement card → routing bar → an
*illustrative* Game Plan hub (the real `game-plan` tab renders `GamePlanScreen` — `StepRail` +
`PlanCascade`). **No data-model change** — this is a confirmation + tab-navigation affordance only.

**Files touched:** `MoneyNeedsPanel.jsx` — `CommissionTargetsPanel` (swap the silent `setSent` timeout
for the ack → `onOpenTab('game-plan')` flow; accept an `onOpenTab` prop), and thread `onOpenTab` from
the panel's props. Plus a **one-line `AgentDashboard.jsx` change**: `<MoneyNeedsPanel
onOpenTab={setActiveTab} />`. Everything else as in rev 4.

> **Repo note (23 Jun):** the Goals tab has since shipped `AwardsReachPanel` + `MdrtTracker` (both
> wired in `AgentDashboard`), and the `GamePlanV2/` hub (`StepRail`, `PlanCascade`,
> `ReviewCommitModal`) + `YearPlanModal` / `MonthlyPlanModal` all exist — so the loop's "gaps" from
> the earlier coverage audit are largely closed in code. This Money Needs rev is the remaining
> presentation work on Step 1.
