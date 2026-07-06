# Handoff: Money Needs **+ Allocator** (merged surface)

> **Read this first.** This builds **one merged surface** that folds the Money Needs budget tool and the Year-Plan allocator into a single top-to-bottom flow. The interactive mockup in `mockups/` is the design source of truth; `Build Notes.html` is the annotated spec (every element → component · token · Lucide icon · state · data field); this README is the build brief; `CLAUDE_CODE_PROMPT.md` is a paste-ready kickoff.

---

## 1. What this is

A field agent answers **"how much do I need to earn?"** (life budget → required first-year commission) and immediately **"how will I write it?"** (allocate that commission across product lines as API targets), then **sends those targets to the Playground** to back-solve weekly activity. Today these are two separate tools; this merges the first two into one surface and wires the hop to the third.

**The bet:** Money Needs produces exactly **one number** (required first-year commission), so the handoff to allocation can be a single honest seam rather than a multi-step wizard. If the merged flow reads as one sentence — *your life → your number → your plan to hit it* — the old "Step 1 / Step 2" split is dropped.

---

## 2. The surface, top to bottom

1. **Money Needs (worksheet) — repo-faithful.** The full rev 1–5 worksheet: **5 expense groups** (Fixed · Living · Business · Savings & Accumulation · Miscellaneous), **per-line frequency** (M/Q/S/A → annualized "/ yr"), manual + **calculator-fed** lines (split into "From your calculators" / "Your entries"), and **3 sub-calculators** — Insurance Industry, **Car Expenses (33% personal → Living / 67% business → Business)**, Loans & Debt — each a modal with a "Done — use this figure" footer. Single-open accordion, add/delete items, "N of M filled" counts. Surfaced **Option-C style**: compact group-subtotal rows by default (three-level disclosure: total → groups → items), full worksheet one tap away, with a live composition bar + total and a sticky required-commission recap. Adaptive: first-run opens guided, returning lands compact.
2. **PAYE build-up.** The cascade to income-required: **After-tax take-home (= annual budget) → + PAYE → = Income you must earn → − Renewal income → 1st-year commissions required** (T&T brackets: 90k allowance, 25% to 1M taxable, 30% above). This figure feeds the seam.
3. **★ The seam.** One full-width primary band — the only saturated element — restates the required commission as a headline and points forward ("Now, here's how you'll write it →"). Worksheet + build-up above, allocation below, joined by a vertical rule. This is the whole merge; get it right.
4. **Allocation (production).** License-aware product lines, each with a **slider + direct TTD entry** (two-way bound, ceiling anchored to the need), derived first-year commission + derived apps, and a running **allocated-vs-required %** meter.
5. **Per-product drill (Phase 2).** Life **and** General each expand into **up to 4 user-named products** (slider+field each), with a **balance indicator + auto-balance** to keep products summing to the line total.
6. **Award strip.** Life production only — highest club reached / next-club gap / top-tier; never an invented higher award.
7. **★ Send to Playground (matches shipped #738).** A confirm sheet names exactly which line + product API figures hand over, then writes them to the Playground key and shows a **"Target sent" ack** → **Continue to Game Plan** / Stay here. The app has **no router** — "Continue" is **`onOpenTab('game-plan')`**, landing on the pre-filled Playground step (no breadcrumb/back; the app nav is the way back).

---

## 3. Locked product rules (enforce, don't reinterpret)

1. **Show only what the license grants — never grey out.** Life license → Life + A&H lines; General → General + A&H; Composite → all. **A&H shows for every class.** Unavailable lines are **omitted**, not disabled. (Keeps the UI clutter-free — this was an explicit decision.)
2. **Eligibility is positive-only.** Award-eligible lines/products carry a single gold tag; non-eligible ones carry **no badge** (the award strip's "Life production only" line carries the meaning). No lock/disabled chrome.
3. **Up to 4 products per drillable line, user-named.** Defaults: Life → Whole Life · Annuities · Critical Illness · Term; General → Motor · Property · Group · Commercial. Names are **user-editable** (not hard-coded enums). **Motor & Property are General-license lines** — they live under General, never Life.
4. **Only Life API drives awards.** A&H and General decompose into activity but are award-neutral.
5. **Send is one-directional + tab-routed.** Money Needs is the source of truth; the Playground reads the targets. Navigation is **tab-state, not a router** — mirror #738: write the targets to `PLAYGROUND_INCOME_GOAL_KEY` (extend its payload for the per-line/product API), then `onOpenTab('game-plan')`. There is **no breadcrumb/back chrome** — the app's bottom-nav/sidebar is the way back. One Send pattern across the app, not two.
6. **Honest data.** Every state is real: license-unset (first-run picker), no-commission-need, loading, error — never zeros-as-data.

---

## 4. Target stack & conventions

React 19 · Vite · Tailwind 3.4 (`darkMode:'class'`) with `@layer components` in `src/index.css` · **lucide-react** · Firebase (multi-tenant `tenants/{tenantId}/…`) · role switch in `src/App.jsx` · CI a11y gate (axe/Playwright).

- **Nexus tokens are CSS variables only** — the mockup's `:root` / `[data-theme="dark"]` block maps 1:1 to the repo's `src/index.css` tokens (`--primary`, `--ink`, `--surface-raised`, `--surface-muted`, `--border`, `--gold`, `--success`, `--warning`, `--danger`, `--accent`). **Never introduce a new hex.**
- **Type:** Satoshi body · Cabinet Grotesk (`font-display`) for values/headlines · JetBrains Mono for labels/numerics.
- **Lucide icons only** (the mockup inlines paths to stay dependency-free; in-repo use `lucide-react` — names listed in `Build Notes.html`).
- **≥44px** touch targets; `:focus-visible` rings via the primary token. Currency **TTD** throughout. No gradient buttons.
- Light + dark for everything (the mockup toolbar toggles both, plus desktop/mobile and the demo states).

---

## 5. Data model (the worksheet already exists — reuse `moneyNeedsService`)

**Money Needs is built.** `MoneyNeedsPanel.jsx` + `moneyNeedsService.js` already own the worksheet: `expenseGroups` (5 groups of line items with `{label, amount, frequency, annualizedAmount}`), the 3 `subCalculators` (`insuranceIndustry`, `carExpenses` with `annualTotalPersonal`/`annualTotalBusiness`, `loansDebt`), calc-fed lines via `calcKey`, `totalAnnualAfterTax` / `totalAnnualPreTax` (PAYE), `estimatedRenewalIncome`, and `firstYearCommissionsTargets`. **Do not rebuild it** — this surface MERGES that worksheet with the richer allocator. The mock reproduces its flow so the seam reads as one surface.

```
// EXISTING (moneyNeedsService) — reuse as-is:
moneyNeeds.expenseGroups[groupKey].lineItems[]  // {id,label,amount,frequency,annualizedAmount,calcKey?,isOverridden?}
moneyNeeds.subCalculators                        // insuranceIndustry | carExpenses(33/67 split) | loansDebt
moneyNeeds.totalAnnualAfterTax / totalAnnualPreTax / estimatedRenewalIncome
// → 1st-year commissions required = totalAnnualPreTax − renewals   (the seam figure)

// The merge REPLACES the repo's flat CommissionTargetsPanel (life/ah/property/motor)
// with the license-aware allocator:
profile.licenseClass: 'life' | 'general' | 'composite'      // drives which lines render
yearPlan.lines: {
  life:    { api, eligible:true,  products: [{ name, api }] },   // ≤4, names user-editable  ⚑ schema change
  ah:      { api, eligible:false },                              // own line, all classes
  general: { api, eligible:false, products: [{ name, api }] },   // ≤4, Motor/Property/Group/Commercial
}
// Playground reads line/product api → playground* ratios (already in goalsService) → weekly activity.
```

**Reuse, don't duplicate:** the car split (`CAR_PERSONAL_PCT=33` / `CAR_BUSINESS_PCT=67`), `annualizeAmount`, `computeGroupTotal`, PAYE gross-up, and `countFilledLineItems` all already live in `moneyNeedsService` — the mock re-implements them only to run standalone. Apps = API ÷ average policy size, the **same** divisor the weekly planner / `goalDecomposition` use — no second math path.

### ⚑ Design-around flags (resolve in PRD — mockup built as if supported)
- **A · Per-product schema.** `yearPlan` stores per-*line* today; named per-product targets `{name, api}` (≤4, Life + General) are a **schema change**. (The worksheet's per-line model is unchanged.)
- **B · Per-product apps divisor.** Blended avg-policy vs per-product avg-policy is open; the UI shows derived apps with a visible note and does **not** hard-assert the divisor.
- **C · A&H placement (`ahSide`).** Rendered as its own line to sidestep "which side does A&H sit on." If product confirms, drop `ahSide`.

### What the merge changes vs. the shipped worksheet
- **Adds** the Option-C disclosure (compact group rows → full worksheet), live composition bar, sticky recap — presentation only, no data change.
- **Replaces** the flat 4-field `CommissionTargetsPanel` with the **license-aware allocator** (lines + named-product drill + award strip). The existing "Send to Playground" stays, now navigating from the allocator.

---

## 6. Component map (build in-pattern; lift exact spacing/tone from the mockup)

| Mockup component | Builds to |
|---|---|
| `BudgetWorksheet` + `ManualLine` + `FreqSelect`/`AmtInput` | the repo-faithful worksheet: 5 groups · per-line frequency · manual rows |
| `CalcFedLine` + `SubCalcModal` | calculator-fed lines + the 3 sub-calculators (Insurance / Car 33-67 / Loans) with Done footer |
| `PayeBuildup` | the after-tax → +PAYE → income → −renewal → commissions-required cascade |
| `CompositionBar` | live 5-group composition under the total (Option-C disclosure) |
| `Seam` | the primary handoff band ★ |
| `Allocation` + `LicenseSwitch` | license-aware allocator header + %-of-need meter |
| `LineCard` + `SliderField` | per-line slider+field, derived commission/apps |
| `ProductDrill` | generic ≤4 named-product drill (Life **and** General) + balance/auto-balance |
| `AwardStrip` | Life-only award reading |
| `SendBar` → `PlaygroundConfirm` → `PlaygroundAck` → `onOpenTab('game-plan')` | confirm → write targets → "target sent" ack → **tab** to the Game Plan/Playground step (no router; `PlaygroundPage` is a mock preview of that step) |
| `LicensePicker` / `NoNeedState` / `LoadingState` / `ErrorState` | the states |

---

## 7. Bundle & how to view

```
money-needs-allocator-handoff/
├── README.md                  ← this brief
├── CLAUDE_CODE_PROMPT.md      ← paste-ready kickoff
├── Build Notes.html           ← annotated spec (element → component/token/icon/state/data)
└── mockups/
    ├── Money Needs Merged.html   ← interactive design source of truth (open this)
    ├── mn-merge-core.jsx         ← tokens-as-CSS-vars, Icon set, worksheet data (5 groups + 3 sub-calcs + PAYE), Seam, AwardStrip, domain consts
    └── mn-merge.jsx              ← BudgetWorksheet, sub-calc modal, PAYE build-up, LineCard, ProductDrill, license picker, states, Send→Playground, App
```

**To view:** open `mockups/Money Needs Merged.html` in a browser. The toolbar toggles **desktop/mobile**, **light/dark**, and a **State** selector (live · first-run guided · no-need · loading · error); first load shows the **license picker**, and "↺ License" returns to it. Walk: worksheet (expand a group → edit lines with frequency → open a calculator → Done) → PAYE build-up → seam → allocate (drag sliders / type / expand a line / rename products) → **Send to Playground** → confirm → navigated Playground page → back.

> The `.jsx` files are **design reference, not production code** — recreate in the repo's React/Tailwind, lifting exact tokens/spacing/tone. Start in `mn-merge-core.jsx` (the seam + domain constants live there).
