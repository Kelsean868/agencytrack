# Kickoff Brief — Money Needs rev 4–5 (UX Round 2)

**Authored:** 2026-06-23 · dispatcher
**Baseline:** origin/main `eaad83c` (recon baseline; all path:line anchors verified against it)
**run_model:** `claude-sonnet-4-6` (presentation/state wiring; no access-control, money-path, or rules)
**Mode:** Build to PR-open, then HOLD.
**Merge class:** **Human-merge (Rule 19)** — agent-facing surface. No green-channel.

---

## Why

CD handoff `02b`/`02c` (rev 5) specs five presentation-only fixes to the Money Needs worksheet — the round-2 UX pass that kills the "wall of inputs" feel and closes the Send→Game Plan loop. Rev 1–3 already shipped; rev 4–5 is the remaining work. **No data-model, service, schema, token, or flag change.** A read-only recon (this baseline) verified every rev-1–3 anchor the spec builds on; two spec corrections are folded in below.

**One file** (`src/components/agent/MoneyNeedsPanel.jsx`) plus a one-line `AgentDashboard.jsx` wiring change. `CommissionTargetsPanel` is **collocated inside `MoneyNeedsPanel.jsx`** (confirmed `:512–611`), not a separate file.

## Recon corrections baked in (do not deviate)

- **Car calc has no single `annualTotal`.** The Done footer (Fix 1) must branch per calc: Industry (`:687`) and Loans (`:822`) expose `.annualTotal`; **Car (`:744`) exposes `annualTotalPersonal` + `annualTotalBusiness`** (save payload `:766–769`) — show both, not one total.
- **`bg-surface-mute` is a typo.** The real utility is **`bg-surface-muted`** (trailing `d`; config key `surface.muted`). Use `bg-surface-muted` everywhere the spec says `bg-surface-mute` — the typo'd class renders no background.
- `Pencil` + `Check` Lucide icons are not yet imported — add them (`Sparkles` already imported `:3`).

---

## Phase 0 — source-verify (confirm baseline still current)

1. `git fetch origin`; confirm HEAD is at/after `eaad83c`. If `MoneyNeedsPanel.jsx` diverged from the recon anchors, **STOP and report** (Rule 17).
2. Re-confirm the five edit sites: `CalcFedLineRow` (`:108`), `FloatingCalcModal` (`:643`), `ExpenseGroupAccordion` (`:183`, internal `useState(open)` `:185`), `LineItemRow` (`:43`), `CommissionTargetsPanel` (`:512`, `handleSendToPlayground` `:547`). And the wiring site `AgentDashboard.jsx:728` (`<MoneyNeedsPanel />`, no props).

## Phase 1 — build (all in `MoneyNeedsPanel.jsx` unless noted)

**Fix 1 — Done footer on `FloatingCalcModal`** (`:643–677`)
- Add a third `shrink-0` footer row after the scrolling body (sibling of header/body): `border-t border-border bg-surface px-4 py-3`.
- Left: live **annual total** (label + `font-display` value). Right: primary **"Done — use this figure"** button (`min-h-12`, `Check` icon) whose `onClick` is the existing `onClose` (the blur flushes the existing on-blur `save()` — figure lands automatically).
- Under it, a quiet line (`Check` icon): "Saved automatically as you type · Done closes and fills the field."
- **Per-calc total source (recon correction):** lift a `footer`/`total` slot into `FloatingCalcModal` and have each calc pass its total. Industry/Loans → `annualTotal`; **Car → render both `annualTotalPersonal` + `annualTotalBusiness`** (e.g. "Personal … · Business …"), not a single figure. Keep header `X` as secondary dismiss (also `onClose`).

**Fix 2 — single-open accordion**
- Add `const [openGroup, setOpenGroup] = useState(null)` in `MoneyNeedsPanel` (default may seed to the first unfilled group's key).
- In the `EXPENSE_GROUPS.map(...)`, pass `open={openGroup === key}` and `onToggle={() => setOpenGroup(o => o === key ? null : key)}`.
- In `ExpenseGroupAccordion`, **remove the internal `useState(open)` (`:185`)**; consume `open` + `onToggle` props. `aria-expanded` (`:299`) and chevron rotation (`:306`/`:325`) already read `open`.
- Add a subtle lift on the open card (`shadow-sm`/`shadow-md` when `open`). Keep the header ≥44px and fully tappable.

**Fix 3 + rev-5 Tweak A — field separation (the core overhaul)**
- *Level 1 — group band:* add a small `FieldSection` helper whose header is a tinted strip (`flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2.5`): `bg-primary/8` + `Sparkles` for "From your calculators"; **`bg-surface-muted`** + `Pencil` for "Your entries". Wrap the `calcFedItems` (`:271`) and `manualItems` (`:272`) groups in `<FieldSection>`.
- *Level 2 — every row is a card:* each manual `LineItemRow` **and** each calc-fed/sub-calc line renders as a bordered card (`rounded-xl border border-border bg-surface`, hairline `shadow-sm`, `mb-2` gap), with the **name input as the heading** (full-width, `font-semibold`, **`bg-surface-muted`** fill, borderless until focus); amount · frequency · annual · delete on the row beneath. Apply to `LineItemRow` in **both** the panel path (`:369`) and the `SubCalcLineItems` stacked path (`:619`). No flush/`border-b`-only rows anywhere. `CalcFedLineRow` already cards (`:108`) — align its shell to match.
- Pure presentation: which items render and how they save is unchanged.

**Fix 5 / rev-5 Tweak B — Send → acknowledge → Game Plan**
- `CommissionTargetsPanel` (`:512`): accept an `onOpenTab` prop. Keep the existing `localStorage[PLAYGROUND_INCOME_GOAL_KEY]` write (`:547–551`) unchanged. Replace the silent `setSent`/1.5s timeout with an **acknowledgement** (small modal/sheet — reuse the `FloatingCalcModal` shell or a lightweight confirm): success `Check` + "Target sent — saved to your Commission Playground" + primary **"Continue to Game Plan →"** → `onOpenTab('game-plan')`. Keep the button label **"Send to Playground"** (truthful action; the ack bridges onward).
- Thread `onOpenTab` from `MoneyNeedsPanel`'s props down to `CommissionTargetsPanel`.
- **`AgentDashboard.jsx:728`** — the one-line wiring: `{activeTab === 'money-needs' && <MoneyNeedsPanel onOpenTab={setActiveTab} />}` (matches the established `onOpenTab={setActiveTab}` pattern used for `GamePlanScreen` at `:716`).

**Do NOT change:** handlers (`handleItemChange` `:245`, `handleResetCalcLine` `:257`, `handleSubCalcSaved` `:921`, blur-save `:267`), the `onOpenCalc(calcId)` contract + `calcKey.split('.')[0]` resolution (`:112`), `moneyNeedsService`, schema, tokens (`tailwind.config.js`/`index.css` — every class used already exists; no new tokens), or any flag. TTD + `parseFloat` preserved. ≥44px on every input/control. No gradient buttons. Trinidad time for any timestamp.

## Phase 2 — tests

`src/components/agent/__tests__/MoneyNeedsPanel.test.jsx`: update assertions matching old markup (the silent "Sent!" → ack flow; any flush-row structural assertions → card structure; single-open behavior — opening one group collapses another). Add: Done footer renders with a total and closes via `onClose`; `onOpenTab('game-plan')` fires from the ack's continue button. Behavior tests (save, reset, calc-open) stand. Keep the full suite green.

## Phase 3 — smoke

Both-theme preview smoke on the live Money Needs surface: worksheet renders as cards (no wall-of-inputs), single-open accordion collapses siblings, a sub-calc opens and shows the Done footer, the Send→ack→`game-plan` route lands on the hub. axe 0 new serious/critical vs baseline. **Coverage note (Rule 22):** the Car split-total footer branch and the empty-worksheet states may be data-dependent on the test account — assert what's reachable, name what isn't.

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT.md fill (placeholders); FOLLOW_UPS if anything surfaces.
- **Phase 5:** commit `feat(money-needs): rev 4–5 UX round 2 — done footer, single-open accordion, field cards, send→game-plan`; push; open PR.
- **Phase 6:** Gemini poll 15 min + disposition (Rule 21); hex-grep new visual code; **HOLD for human merge** (Rule 19). Report ≥1 named gap (Rule 22).

---

## Report back

PR + URL; Phase-0 confirmation the anchors still hold; per-fix done/deferred; the Car-split footer + `bg-surface-muted` corrections applied; test + both-theme smoke results; ≥1 named gap; confirmation it's **HELD for human merge**.
