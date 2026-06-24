# Kickoff Brief — Allocator summary card (lift `buildAllocationSummary`)

**Authored:** 2026-06-24 · dispatcher
**Baseline:** origin/main (post-#739 merge). New branch, new PR — #739 is merged/locked.
**run_model:** `claude-sonnet-4-6` (presentation + one pure derivation; no persistence/rules/auth; flag-off).
**Mode:** Build to PR-open, then HOLD. **Human-merge (Rule 19).** Flag-gated by the existing `VITE_MONEY_NEEDS_MERGED_ENABLED` (off in prod) — ships dark.

---

## Why

Add an always-visible summary card under the allocator that mirrors the ack modal but with **per-product subtotals** — so the agent sees the rolled-up decomposition *while allocating*, not only at Send. Recon verdict: **LIFT** — the ack's `ackSummary` is an inline, line-only `{label, commission}` const (`MoneyNeedsAllocator.jsx:587`); it can't carry the API/apps/rate/product data the card needs. All math primitives already exist in `moneyNeedsAllocation.js`; only an assembly function is missing. Lift one shared derivation, point both the card and the ack at it — guaranteed never to drift.

## Scope (one PR, two files + tests)

`src/.../moneyNeedsAllocation.js` (add `buildAllocationSummary`) · `MoneyNeedsAllocator.jsx` (render the card; repoint the ack) · their tests.

## Phase 0 — source-verify (confirm recon still holds)

1. `moneyNeedsAllocation.js` exports the primitives the recon listed: `lineCommission`, `lineAPI`, `productAPI`, `effectiveLineRate`, `sumProductCommission`, `sumProductAPI`, `totalAllocatedCommission`, `totalAllocatedAPI`, `allocApps`, `isDrilled`. Confirm signatures.
2. `MoneyNeedsAllocator.jsx`: the inline `ackSummary` (~:587), the `<AckModal>` consumer (~:675), the render order — lines block (~:616–644) → `<AllocatedMeter>` (~:646) → `<AwardProjectionStrip>` (~:649–657) → Send (~:659). Confirm the insertion point is **after the award strip, above Send**.
3. Confirm the drilled-line product shape (`{name, commission, rate}`) and how `isDrilled` gates it.

## Phase 1 — build

**A · Lift the assembly function** into `moneyNeedsAllocation.js` (pure, no JSX):
```
buildAllocationSummary(alloc, visibleKeys, required) → {
  lines: [{ key, label, commission, api, apps, effectiveRate,
            products: [{ name, commission, api, rate }] | null }],  // products only when isDrilled
  totalCommission, totalAPI, allocatedPct, required
}
```
- Per line: `commission = lineCommission`, `api = lineAPI`, `apps = allocApps(api)`, `effectiveRate = effectiveLineRate`. `products` populated (each with derived `api = productAPI`) only when `isDrilled(line)`, else `null`.
- Totals: `totalCommission = totalAllocatedCommission`, `totalAPI = totalAllocatedAPI`, `allocatedPct = totalCommission ÷ required` (guard required>0). No new math — compose existing primitives only.

**B · Render the summary card** in `MoneyNeedsAllocator.jsx`, **after `<AwardProjectionStrip>`, above the Send button** — its own card (matches the ack's visual language). For each line: a line row (commission · API · apps · effective rate %), and when drilled, **indented product rows** (name · commission · API · rate %) with the **line subtotal** beneath them. Then the **grand total** (commission · API) and the allocated-vs-required figure. Rate values shown as `%` (×100), currency TTD, API derived — consistent with the line controls. Honest-empty: if nothing allocated yet, the card shows a quiet "Allocate above to see your plan" rather than zeros.

**C · Repoint the ack** to consume `buildAllocationSummary` (it renders its existing line-level subset from the richer object — no visual change to the ack, just a single derivation source). Drop the inline `ackSummary` const.

Conventions: token-only (no new hex; `bg-surface-muted` trailing-d), ≥44px where interactive, light+dark, Lucide, no gradient buttons. Card is display-only (no inputs).

## Phase 2 — tests

`moneyNeedsAllocation` test: `buildAllocationSummary` — collapsed line (no products, correct api/apps/rate); drilled line (product rows + subtotal = Σ products, effective weighted rate); totals + allocatedPct (incl. required=0 guard); empty alloc → empty lines. `MoneyNeedsAllocator` test: card renders line + product-subtotal rows for a drilled fixture; ack still renders its subset from the shared object (no regression). Full suite green.

## Phase 3 — smoke

Flag-ON local smoke (existing harness), both themes: allocate a line → card shows it; drill into products with different commissions → card shows product rows + subtotal + correct effective rate; grand total + allocated-vs-required present. Name any data-dependent gap (Rule 22) — the test agent's small renewal/need may limit what's reachable; assert what is, RTL covers the rest.

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT note.
- **Phase 5:** new branch off main; commit `feat(money-needs): allocator summary card (shared buildAllocationSummary)`; push; open PR.
- **Phase 6:** Gemini + GLM poll/disposition (Rule 21); hex-grep; ≥1 named gap; **HOLD for human merge**.

---

## Report back

PR + URL; Phase-0 confirmation; that the ack and the new card consume the **same** `buildAllocationSummary` (no second derivation); test + both-theme smoke results; ≥1 named gap; confirmation flag stays OFF and it's **HELD for human merge**.
