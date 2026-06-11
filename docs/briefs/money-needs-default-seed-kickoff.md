# Brief — Money Needs: pre-seed the default expense line items

**Type:** frontend + service. **Merge:** human-merge. **Deploy:** none (Vercel auto on merge).
**Rules / Functions / Indexes:** NONE (line items live in the existing `moneyNeeds` doc, already covered by G5 rules).

---

## 1. Premise (source-verified at authoring; reconfirm in Phase 1)

The Money Needs worksheet is **fully built and live**:

- G1 skeleton (#343) · G2 PAYE engine (#344) · **G3 expense-group entry (#346)** — line-item add/edit/delete per group, frequency selector (A/S/Q/M) + auto-annualize, saves patch `expenseGroups.{groupKey}` · **G4 sub-calculators (#348)** — Insurance Industry → rolls into Business, Car Expenses ⅓-personal/⅔-business split + with/without-loan, Loans/Debt separate total · G5 privacy (#354) · G6 commission targets + send-to-playground (#350) · G7 soft-validation + PAYE refresh banner (#352).
- Re-homed + checklist-restyled under Game Plan v2 Slice 1 (#438): group dots, "N of M filled" count, summary cascade, ≥44px inputs, visibility toggle preserved.

**The one gap:** `createMoneyNeeds` scaffolds a **blank** doc (empty `lineItems` arrays). The PRD's planned `budgetCategories` seed was never shipped, so every group and sub-calculator opens empty and the agent must add each line from memory.

**Goal:** scaffold a new worksheet **pre-filled** with the canonical T&T expense taxonomy (from the operator's "Organize your money needs" Looking Ahead sheet) — each seeded row at `amount: 0`, a sensible default frequency, `isCustom: false`. Per CD's Money-Needs-Slice-1 annotation: *"We pre-filled the items most agents have — just edit the amounts. Clear anything that doesn't apply, or add your own."*

**No math change.** G3 entry, G4 sub-calc rollup, and G2 PAYE all operate on whatever line items exist — seeding only changes the *starting* contents.

---

## 2. Mechanism (locked)

- Add a default-taxonomy **code constant** (e.g. `DEFAULT_MONEY_NEEDS_CATEGORIES`) in / beside `moneyNeedsService`. **Not** a `config/budgetCategories` Firestore doc — single-tenant pilot; the config-doc is a deferred multi-tenant upgrade (bank as FU).
- `createMoneyNeeds` scaffolds each `expenseGroups.{key}.lineItems` and each `subCalculators.{key}.lineItems` from the constant instead of empty arrays. Preserve idempotency and `visibility: 'private'`.
- Each seeded line item: `{ id, label, amount: 0, frequency: <default>, annualizedAmount: 0, isCustom: false }`. Use the existing line-item shape and id-generation; the existing annualize helper yields 0 for amount 0.
- Seeded rows are ordinary line items — fully editable, clearable, and deletable via the shipped G3 affordances. "Add your own" continues to create `isCustom: true` rows.
- **No backfill.** The scaffold change affects new worksheets only. Pre-pilot there should be zero production `moneyNeeds` docs (confirm in Phase 1).

---

## 3. Canonical taxonomy to seed (verbatim from the Excel)

Frequencies use the service's existing keys (Phase 1 confirms the set; map each item below). `[M]` Monthly · `[Q]` Quarterly · `[A]` Annual · `[S]` Semiannual.

**Fixed Expenses (7):** Rent or mortgage payments `[A]` · Utilities – gas, heat, light, telephone, water `[M]` · Disability income insurance `[M]` · Homeowners insurance `[M]` · Car insurance `[A]` · Property taxes `[A]` · Other `[M]`

**Living Expenses (8):** Food `[M]` · Clothing `[M]` · Laundry, tailoring `[M]` · Entertainment `[M]` · Car expenses, nonbusiness `[M]` · Medical – doctor, dentist, drugs `[M]` · Household `[M]` · Other `[M]`

**Business Expenses (7):** Sales promotion, advertising, direct mail, tuition `[M]` · Trade association dues, services, events `[M]` · Telephone, computer, stationery, postage, supplies `[M]` · Secretarial and banking services `[M]` · Business travel, car expense `[M]` · Business entertainment `[M]` · Other `[M]`

**Savings & Accumulation (6):** Life insurance `[M]` · Savings account `[M]` · Debt reduction (other than mortgage) `[M]` · Investments `[M]` · Slush fund `[M]` · Other `[M]`

**Miscellaneous (6):** Donations – religious, charitable, etc. `[M]` · Recreation `[M]` · Club dues `[M]` · Gifts and services `[M]` · Vacation `[M]` · Other `[M]`

> Five groups = **34** line items. (Matches the annotation and PRD §6.1 exactly.)

**Sub-calc — Insurance Industry Expenses (11) → rolls into Business:** Life License Renewal `[A]` · General License Renewal `[A]` · TTAIFA fees `[A]` · TTII Portal Fee `[A]` · CPD classes `[A]` · TTAIFA Courses (FSCP/etc) `[A]` · TTAIFA Congress `[A]` · MDRT membership fee `[A]` · MDRT Convention `[A]` · Branch Retreats `[A]` · Other Industry Events `[A]`

**Sub-calc — Car Expenses (8) → ⅓ personal / ⅔ business, with/without-loan:** Gas/Petrol/Electric `[M]` · Mechanical Servicing `[Q]` · Insurance `[A]` · Parking fees `[M]` · Tickets `[A]` · Car wash and maintenance `[M]` · Miscellaneous `[A]` · Vehicle Loan `[M]`
> Seed the split fields per G4's representation (Phase 1 confirms): `personalSharePct ≈ 33.33`, `businessSharePct ≈ 66.67`, `withLoan` default per G4.

**Sub-calc — Loans/Debt (10, full canonical) → separate total:** Credit Card #1 `[M]` · Credit Card #2 `[M]` · Car Loan #1 `[M]` · Car Loan #2 `[M]` · Personal Loan #1 `[M]` · Personal Loan #2 `[M]` · Sou-sou #1 `[M]` · Sou-sou #2 `[M]` · Hire-Purchase `[M]` · Other `[M]`

> 🔶 **OPEN DECISION (operator, on review):** the numbered duplicates above are a spreadsheet artifact. **Recommended:** collapse to six unique categories — Credit Card · Car Loan · Personal Loan · Sou-sou · Hire-Purchase · Other — and let "Add your own" handle a second card/loan. As written this brief seeds all ten; flip to six if approved.

---

## 4. Phase 0 / 1 — recon (HARD STOP for dispatcher ruling)

Confirm against live code, then stop and report:

1. **Scaffold site + shape.** Exact `createMoneyNeeds` location in `moneyNeedsService`; the line-item object shape (expected `{ id, label, amount, frequency, annualizedAmount, isCustom }`); the id-generation used.
2. **Keys.** `expenseGroups` keys (`fixedExpenses`, `livingExpenses`, `businessExpenses`, `savingsAccumulation`, `miscellaneous`) and `subCalculators` keys (`insuranceIndustry`, `carExpenses`, `loansDebt`) match the schema.
3. **Frequencies.** The supported `FREQUENCY_MULTIPLIERS` keys (G3 used A/S/Q/M). Map every `[…]` above to a supported key. The Excel's "Bi-Annual" is ambiguous (semiannual vs every-two-years) — **flag** if any needed frequency isn't supported; do not invent a multiplier.
4. **Car split fields.** How G4 represents `carExpenses` (`personalSharePct` / `businessSharePct` / `withLoan`) so the seed sets sensible defaults.
5. **Zero existing docs.** Confirm there are no production `moneyNeeds` docs (no backfill). If any exist, flag — seeding affects new docs only.
6. **Render path.** How the panel renders a scaffolded worksheet and computes "N of M filled," so seeded rows display correctly and the count is honest at amount 0.

**HARD STOP → report findings.** Resolve the Loans 10-vs-6 decision and any frequency flags before Phase 2.

---

## 5. Phase 2 / 3 — build + test

- Add the default-taxonomy constant (labels + default frequencies, grouped by the confirmed keys).
- Modify `createMoneyNeeds` to scaffold `lineItems` from it; preserve idempotency + `visibility: 'private'`.
- Seed sub-calculator line items + the Car split defaults per Phase-1 findings.
- **Unit tests:** `createMoneyNeeds` produces the full seeded scaffold — per-group/per-sub-calc counts match the taxonomy; every seeded item `isCustom: false`, `amount: 0`, frequency valid against `FREQUENCY_MULTIPLIERS`; idempotency preserved; the existing-doc path untouched.
- Keep any panel change minimal — the G3 entry loop should already render `lineItems`; only touch render if the "N of M filled" count needs seeded rows reflected.

**Phase 3 smoke (frontend, write-read-verify, both themes):** open a fresh worksheet on the preview → assert the 5 groups + 3 sub-calculators render the seeded canonical rows (spot-check counts + several labels) → edit an amount + change a frequency on a seeded row → save → hard-reload → assert persisted → clear a seeded row → assert handled → own-cleanup. ≥44px inputs intact; axe NO-NEW serious/critical; 0 console errors.

---

## 6. Phase 4 / 5 — docs + PR

**Phase 4 (docs with placeholders):**
- `CONTEXT.md` — advance Current main HEAD on merge (feature change).
- `FOLLOW_UPS.md` — bank: (a) `config/budgetCategories` Firestore-doc upgrade for per-tenant taxonomy customization (multi-carrier); (b) the Loans 10-vs-6 decision outcome.
- `CLAUDE.md` — only if a one-liner is warranted (likely not).

**Phase 5 (commit / push / PR):** feature branch → PR. Rule 20 (name feature-branch HEAD SHA; no silent post-report pushes). Rule 21 (poll Gemini, disposition each comment).

**Merge:** human-merge, frontend+service only — **no deploy** (Vercel auto). Pre-merge preview smoke per Phase 3.
