# Track K — New-Agent Financing & Bonus Tracker — Design Spec

**Status:** Design locked (this session), pending PR-breakdown approval.
**Scope mode:** New track, multi-PR. Not a single kickoff brief.
**Source of rules:** *New Salesperson's Bonus and Financing Agreement* — TATIL Life Assurance Ltd, rev. 26/07/2017 (clause references below are to that document).
**Currency:** TTD throughout. **Numerics:** `parseFloat()` enforced (project rule). **Schema pattern:** flat docs, matching `submissions/`, `settlements/`, `persistency/` (no nested subcollections).

---

## 1. Purpose

New agents and their managers struggle to monitor the financing-and-bonus qualifying criteria in the first 24 months. The largest recurring failure is **expectation management** — agents misread what a quarterly bonus actually pays once tax and financing repayment come out, and managers have no early-warning view of financing adjustments or termination triggers. This track makes the whole structure visible, traceable to the Policy Ledger, and forward-looking.

This is a **separate layer** from the 2026 incentive awards already modelled. It does not replace or conflict with them; it sits underneath, governing the new agent's financing draw and the quarterly bonuses that pay it down.

---

## 2. Decisions locked (do not re-litigate)

1. **Bonus take-home uses NET (after-tax) for the 50%.** Resolved to the contract wording (6.1, "50% of net bonuses"). Tax first, then 50% of the after-tax figure. No contract-vs-practice divergence to log.
2. **Proration is linear, manager-discretion final.** Financing scales with API against a per-agent validating amount; manager confirms/overrides. Caps at 100% (agreed amount is the ceiling).
3. **Proration basis: submitted for months 1–3, settled from month 4** (relative to each agent's `effectiveDate`). Mirrors the contract's own consistency-bonus treatment (3.2, 3.3).
4. **Real-time projections are provisional; determinations use the confirmed basis.** Adjustment/termination status reads "pending settlement" for month 4+ until the branch manager confirms settlement — never fired off the provisional projection.
5. **50% is taken unconditionally while on financing** (no monthly cap). Truing-up happens at a reconciliation event.
6. **Reconciliation event** at end of year 1, or earlier on election to come off (6.5b). Applies the first-3-months waiver (6.6, only once 12 months' continuous service is met — earlier exit makes those 3 months repayable), then settles: still owing → post-financing garnish; in credit → clear balance and pay surplus to agent as a lump sum.
7. **Post-financing garnish follows 6.2 as written:** 10% of commissions + 50% of net bonuses + incentive payments, monthly until repaid.
8. **Bonus base uses the contract's API definitions** (1.2–1.5), via a **financing-specific credit filter** off `newBusinessType` — NOT the awards engine's `creditableAPI`.
9. **Persistency stays the app's existing validated formula** (the official monthly figure managers enter, E3). Contract clause 1.6's literal formula is a *documented divergence*, not the operative calc. *(Flag for veto — see §10.)*
10. **Financing status is a manager-set state machine,** not an agent checkbox. Gates all financing modules.
11. **Bonus base is derived from the Policy Ledger** where the agent is on it (`usesPolicyLedger: true`); falls back to settlements + submissions otherwise (same pattern as the awards engine), without per-policy drill-down.
12. **Source-of-figure badges reused** from the awards engine: Confirmed / Estimated, extended with the submitted/settled/provisional states below.

---

## 3. The contract's API definitions (the calc spine)

Computed per agent, aggregated to **month** (financing proration) or **quarter** (bonus gate + amount).

- **Gross New Settled API** (1.2) — settled annualized premium on policies issued in the period, less not-takens, **+ 10% of Lump Sum Deposits + 10% of increased PPPs**, **excluding** Staff / Platinum Edge / Single-premium. → drives the **$37,500/quarter gate** and the **bonus-rate tier** (§4).
- **Net New Settled API for Persistency** (1.4) — Gross, less lapsed/surrendered policies with < 2 yrs premiums paid, plus reinstatements with < 2 yrs paid.
- **Net New Settled API for Production** (1.5) — Net-for-Persistency, **less** the 10% LSD + 10% increased-PPP that Gross added. → the **bonus base** (consistency, production, annual adjustment).
- **Persistency** — app's existing validated figure (official monthly entry). *Not* clause 1.6.

**Financing-specific credit filter (per-policy, from `newBusinessType`):**

| `newBusinessType` | Contract treatment | Note |
|---|---|---|
| `nb_ordinary` | 100% | Core recurring premium |
| `inc_ppp` | 10% to Gross | Per 1.2 |
| `lumpsum` | 10% to Gross | Per 1.2 / 1.3 (LSD ≥ $500) |
| `platinum_edge` | 0% (excluded) | Per 1.2 |
| `replacement` | **OPEN** — default difference-only (`replacedPolicyAPI`) | Not addressed in 1.2; confirm |
| `spia` | **OPEN** — default 0% as single-premium | Confirm SPIA = "Single premium" exclusion |
| Staff policies | Excluded | **No ledger field** — see §10 |
| `isSelfOrFamily = true` | Excluded | From standard practice / awards parity |

---

## 4. Bonus mechanics

- **Consistency bonus** = 15% of Net-for-Production per quarter. Gate: Gross ≥ $37,500/qtr + persistency ≥ 95%. Q1 exception: $37,500 *submitted*, no persistency test. Paid the month after the quarter.
- **Production bonus** = 15% (Yr 1) / 20% (Yr 2) of Net-for-Production per quarter. Gate: Gross ≥ $37,500/qtr + persistency ≥ 95% (Yr 1) / 90% (Yr 2).
- **Annual Bonus Adjustment** = Qualifying Bonus Amount (Net-for-Production × Total Bonus Rate) − bonuses already paid that year. Paid if the agent settled the min Gross for the year and didn't already max consistency + production.
- **Bonus Rate Schedule** (annual Gross, both years): $150K–$200K → 20% API + 5% lives = **25%**; > $200K → 25% + 5% = **30%**. Lives portion requires **80 net policies settled**.

> Working interpretation: quarterly consistency/production bonuses use **Net-for-Production** as the base. Confirm at K3 spec (3.3/3.4 say "Net New Settled API" without specifying which Net).

**Take-home (the expectation-management calc), $10,000 example:**

| | While owing (on financing OR post-financing repayment) | Not on financing / debt cleared |
|---|---|---|
| Gross | $10,000 | $10,000 |
| − 25% tax (configurable) | −$2,500 | −$2,500 |
| Net | $7,500 | $7,500 |
| − 50% of net → financing | −$3,750 | $0 |
| **Take-home** | **$3,750** (37.5%) | **$7,500** |

One-step form while owing: `takeHome = gross × (1 − taxRate − 0.50)`. The −$3,750 posts to the ledger as `bonusOffset`. Show **projected** take-home alongside gross while the agent is tracking toward a bonus — not just at payout.

---

## 5. Financing lifecycle (status state machine)

`not_on_financing` → `on_financing` → `reconciling` → `post_financing_repayment` → `cleared`

- **`not_on_financing`** — agent declined financing; straight commission. No draw, no debit, no 50% deduction. Take-home = net of tax only.
- **`on_financing`** (months 1–12) — receives draws; 50% of net bonuses + commissions offset; running balance may cross into credit (not an error state).
- **`reconciling`** — month-12 or exit event; waiver applied; debit-or-surplus computed.
- **`post_financing_repayment`** — 6.2 garnish (10% commissions + 50% net bonuses + incentives) until cleared.
- **`cleared`** — debt repaid (or surplus paid out).

Manager-set; surfaced to the agent as a status badge ("On Financing — month 7 of 12"). **Separate** from provisional-license / tenure tracking — a new agent who declines financing still gets those.

---

## 6. Data model (new)

**`financingTerms/{agentId}`** — the per-agent agreement (manager-set):
- `agreedMonthlyFinancing` (number) — full/max draw; drives the 6× ceiling
- `currentMonthlyFinancing` (number) — tracked separately; Clause 5 can adjust it down
- `validatingAPI` (number) — API for full financing; proration denominator
- `effectiveDate` (date) — anchors the 24-month term + 12-month-service + first-3-months-waiver clocks (same anchor as `contractDate`)
- `financingStatus` (enum, §5)
- audit fields

**`financing/{agentId}_{YYYY_MM}`** — monthly ledger (flat, one per month):
- `runningBalance` (number) — **stored from the agent's monthly statement** (authoritative; self-correcting; may be negative = owed back to agent)
- `financingPaid`, `netCommission`, `bonusOffset` (number, parseFloat)
- `validatingAPI` (number) — amount in effect that month (preserves schedule history)
- `actualAPI` (number) — basis for the month (submitted ≤ M3 / settled M4+)
- `suggestedFinancing`, `managerFinancing` (number) — computed proration + manager override
- `adjustmentPct` (number) — distance below full; drives the >10% flag
- `basisSource` (enum: `submitted-final` / `submitted-provisional` / `settled-confirmed`)
- `enteredBy`, `enteredByName`, `enteredAt`, `source`, `notes`

**`financingReconciliation/{agentId}_{year}`** — the reconciliation record:
- `totalFinancingDrawn`, `totalOffsets`, `waiverApplied`, `closingPosition` (number)
- `outcome` (enum: `owing` / `surplus`), `surplusPaid` / `garnishStarted`
- audit fields

Derived inputs from existing collections (no new schema there): `policies` (ledger — `dateSubmitted`, `dateIssued`, `proposedAPI`, `settledAPI`, `newBusinessType`, status), `submissions` (fallback submitted API), `settlements` (fallback settled API + persistency entry), `config` (tax rate + thresholds in the ruleset).

---

## 7. Policy Ledger tie-in

Carry-forward is **native** — no new mechanic. Each policy carries two independent dates:
- **Submitted basis (months 1–3):** sum `proposedAPI` where `dateSubmitted ∈ period`.
- **Settled basis (month 4+):** sum `settledAPI` where the policy reached Settled (`dateIssued ∈ period`) — automatically including ones submitted earlier.
- **Carried-forward:** policies in Submitted / Rated / Postponed (no `dateIssued`) — stay pipeline until they settle, then land in that later period's settled total.

A policy written in Q1 and settled in Q2 counts toward Q1 submitted and Q2 settled with zero extra logic.

The agent's "show / query my applications for the period" view is a **period-scoped slice of the ledger's filterable list**. Requires `usesPolicyLedger: true`; otherwise the basis falls back to settlements + submissions (no per-policy drill-down).

---

## 8. Surfaces

- **New-Agent Validation Dashboard** (agent + manager) — per quarter: Gross vs $37,500 gate, persistency vs 95/90 line, projected consistency + production bonus, On-track / At-risk / Qualified / Missed. Per month: financing projection, running balance vs 6× ceiling, projected year-end reconciliation ("$X surplus" / "$Y owed").
- **Bonus take-home breakdown** — the §4 waterfall, projected and actual.
- **Termination-risk monitor** — consecutive-miss counter (amber at 2, critical approaching 3, on the **confirmed** basis); >10% downward-adjustment flag surfacing the BM notification obligation (5.3), *not* a termination.
- **Financing status badge** — §5 state, manager-set.

---

## 9. Proposed PR breakdown

Sequence to refine; dependencies noted. Each ships with its own kickoff brief (full Phase 4/5 + discipline gates).

- **Phase 0 (source-verify, before K3/K8):** grep + `git ls-files` for the ledger list-view component and the awards-engine ledger integration. Scope reuse vs new from what's actually live. Audit-only — inline dispatch, no docs/briefs commit.
- **K1** — `financingTerms` config + status state machine + manager-set per-agent setup UI. Foundation; no ledger dependency.
- **K2** — Monthly `financing` ledger: statement entry, stored running balance (authoritative), commission/offset fields. Depends K1.
- **K3** — Bonus engine (pure module, awards-engine pattern): contract API chain (Gross / Net-for-Production), financing-specific credit filter, quarterly + persistency gates, consistency/production/annual-adjustment. Depends Phase 0.
- **K4** — Bonus take-home calc (tax → net → 50% → take-home); posts `bonusOffset` to ledger; projected + actual. Depends K2, K3.
- **K5** — Validation-schedule proration (monthly suggested + manager override; submitted/settled basis resolution). Depends K1, K2.
- **K6** — Reconciliation event (waiver, surplus lump-sum / continued garnish) + 6.2 post-financing garnish tracking. Depends K2–K5.
- **K7** — Termination-risk monitor (consecutive-miss on confirmed basis, >10% + BM-notify). Depends K5.
- **K8** — New-Agent Validation Dashboard (agent + manager) + policy-ledger drill-down tie-in. Reuses Track H list view (Phase 0). Depends most prior.

---

## 10. Open items to confirm at build

1. **Persistency formula** — confirm the bonus gate uses the app's validated formula, not clause 1.6 literal (decision §2.9 — flagged for veto).
2. **Quarterly bonus base** — Net-for-Production vs Net-for-Persistency (working interp: Production).
3. **Credit-filter edge mappings** — `replacement` (default difference-only), `spia` (default 0% as single-premium), and **Staff** policies (no ledger field — add a flag, or treat as out-of-scope for the pilot?).
4. **Track H live-surface state** — resolved by Phase 0.

---

## 11. Risks / divergences

- **Contract vintage.** Source is rev. 2017 (example dated 2022). The $37,500 gate, the 150K/200K tiers, the 12% interest, and the persistency thresholds may have a current (2026) counterpart. Treat every number as a configurable ruleset value — confirm current before seeding.
- **Documented divergences:** clause 1.6 persistency (app formula stands); credit-filter edge mappings (§10.3).
- **Per-agent Validation Schedule** is not global — financing terms are per-agent and can change (downward adjustment issues a new schedule); the monthly ledger preserves the amount in effect.
