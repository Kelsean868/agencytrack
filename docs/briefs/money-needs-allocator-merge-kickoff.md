# Kickoff Brief — Money Needs + Allocator (merged surface), flag-gated

**Authored:** 2026-06-23 · dispatcher
**Baseline:** origin/main `40673ae` (Phase 0 re-verifies)
**run_model:** `claude-opus-4-8` (replaces a live surface + new persistence + award-ruleset shape-match + unattended)
**Mode:** Autonomous, ONE PR, build to PR-open, then HOLD. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — agent-facing, money-adjacent.
**Flag:** entire merged experience behind `VITE_MONEY_NEEDS_MERGED_ENABLED` (default **OFF** = today's behavior). Merging changes nothing live.

---

## Why

CD handoff (`money-needs-allocator-handoff/`) merges the Money Needs worksheet and the Year-Plan allocator onto ONE surface, ending in the Send→Playground hop. Dispatcher decisions are locked below; build to them, do not reinterpret. The mock is the design source of truth; recreate in repo React/Tailwind with Nexus tokens (CSS vars only, no new hex).

## Locked dispatcher decisions (do NOT deviate; do NOT self-expand scope)

1. **Flag-gated.** Entire merged surface behind `VITE_MONEY_NEEDS_MERGED_ENABLED` (`=== 'true'` to enable; **default OFF**). Flag-OFF renders **today's `MoneyNeedsPanel` unchanged** (worksheet rev 4-5 + the existing `CommissionTargetsPanel`). Flag-ON renders the merged surface.
2. **Additive — do NOT touch:** `yearPlanService`, `YearPlanModal`, `MonthlyPlanModal`, `ReviewCommitModal`, `commitPlan*`, `StepRail`, the GamePlan loop, `AwardsRulesetPanel`, or raw `getAwardsRuleset`. Step-2 removal / loop restructure is a separate supervised PR.
3. **Commission rates — editable, per-line and per-product (weighted).**
   - Line defaults `LINE_DEFAULT_RATES = { life: 0.35, ah: 0.25, general: 0.10 }`, each **user-editable** (rate input per line), persisted.
   - **Collapsed line:** commission = lineAPI × line rate.
   - **Drilled line:** each named product carries its **own editable rate** (Life products seed 0.35; General products seed Motor 0.10 / Property 0.125 / Group 0.10 / Commercial 0.10 / any other 0.10). Line commission = **Σ(product.api × product.rate)**; the line's **effective rate = lineCommission ÷ lineAPI** (derived weighted average, shown **read-only** when drilled — products define it).
   - **DEFERRED to fast-follow — general 6% premium-tax.** For general lines/products the commission base is the *pretax* premium and general policies carry 6% tax. The accurate form (commission = (API ÷ 1.06) × rate) hinges on whether API is entered gross vs pretax — unconfirmed. **For this PR, general commission = API × rate** (documented simplification; Tatil is Life-only so no pilot impact). Bank the FU per Phase 4. This intentionally differs from the legacy blended-rate model in the untouched YearPlanModal.
4. **Persistence additive + decoupled.** Persist the allocation to **`moneyNeeds/{year}.allocation`** (or a clean sibling doc — pick in Phase 0): `{ licenseClass, lines: { life: { api, rate, products: [{ name, api, rate }] }, ah: { api, rate }, general: { api, rate, products: [{ name, api, rate }] } } }`. Rates are persisted user data (seeded from defaults). **Do NOT write `yearPlan/{year}`** — that is Step 2's writer; decoupling avoids a two-writer conflict. One new service fn (e.g. `saveAllocation`/`getAllocation`).
5. **Award strip reads the real ruleset** via `getMergedAwardsRuleset(tenantId, year)` (from #709) → club tiers. Life API only. No hardcoded clubs.
6. **Apps = API ÷ blended avg-policy** (the `goalDecomposition` / weekly-planner divisor — one math source), line and product level, with a visible "per-product avg-policy pending" note. Do not hard-assert a per-product divisor.
7. **License** from `user.licenseProfile`; first-run picker when absent; map to life/general/composite.
8. **Send matches #738.** Confirm sheet → write the (extended) `PLAYGROUND_INCOME_GOAL_KEY` payload → "Target sent" ack → `onOpenTab('game-plan')`. No router, no breadcrumb/back. Reuse the existing handoff; extend its payload for per-line/product API.

## Reuse (do NOT rebuild — `moneyNeedsService` owns these)

`expenseGroups`, the 3 `subCalculators` (`insuranceIndustry`, `carExpenses` with `annualTotalPersonal`/`annualTotalBusiness` 33/67, `loansDebt`), `calcKey` calc-fed lines, `totalAnnualAfterTax`/`totalAnnualPreTax` (PAYE gross-up), `estimatedRenewalIncome`, `firstYearCommissionsTargets`, `annualizeAmount`, `computeGroupTotal`, `countFilledLineItems`, `CAR_PERSONAL_PCT/BUSINESS_PCT`. The mock re-implements these only to run standalone — in-repo, **import from the service**.

---

## Phase 0 — source-verify (STOP on any miss — Rule 17)

Confirm against current main, cite path:line:
1. `moneyNeedsService` exports above exist with the named fields; `firstYearCommissionsTargets` shape; the after-tax→PAYE→pre-tax→−renewals chain.
2. In `MoneyNeedsPanel.jsx`: the `CommissionTargetsPanel` swap point, the `onOpenTab` prop (from #738), `PLAYGROUND_INCOME_GOAL_KEY` + its current write payload, `handleSendToPlayground`.
3. `user.licenseProfile` field + its actual values (map to life/general/composite); where it's read.
4. `getMergedAwardsRuleset(tenantId, year)` signature + the `clubAward.tiers` shape it returns (name + apiThreshold per tier) so the award strip reads real tiers.
5. The blended avg-policy / `goalDecomposition` divisor source the weekly planner uses.
6. Confirm the cleanest additive persistence path for `.allocation` (extend the `moneyNeeds/{year}` doc vs a sibling) and that it needs **no `firestore.rules` change** (it's under the agent's own `moneyNeeds` tree). If it WOULD need a rules change, FLAG and HOLD.
7. Confirm the feature-flag pattern (mirror `GAME_PLAN_LOOP_ENABLED`, but default OFF).

## Phase 1 — build (order matters; core-first so a window cutoff still leaves a coherent PR)

1. **Flag scaffold + swap point.** `VITE_MONEY_NEEDS_MERGED_ENABLED` (default OFF). In `MoneyNeedsPanel`, flag-OFF = current render unchanged; flag-ON = the merged surface. Everything below is ON-only.
2. **Option-C worksheet disclosure.** Three-level: total → 5 group-subtotal rows (compact default) → full line items (one tap). Live composition bar + total; sticky required-commission recap. **Adaptive:** first-run (worksheet empty per `countFilledLineItems`) opens guided/expanded; returning lands compact. Reuse the existing worksheet line/calc components + the 3 sub-calculators (Done footer from #738) — do not rebuild them.
3. **PAYE build-up** cascade (after-tax → +PAYE → income required → −renewals → 1st-year commissions required) from the service totals. This figure feeds the seam.
4. **★ The Seam.** One full-width `--primary` band (the only saturated element) restating required commission as the headline + "Now, here's how you'll write it →", vertical rule joining worksheet above to allocation below. Get this right — it's the merge.
5. **Allocation.** `LINE_DEFAULT_RATES` (per decision 3). License-aware lines (visible per `licenseProfile`; **A&H its own always-present line**; **omit** unavailable lines, never grey out). Per line: slider + TTD field two-way bound (ceiling = required ÷ line-rate × 1.5), an **editable rate field** (seeded from default), derived commission (API × rate when collapsed) + derived apps (blended avg-policy). Allocated-vs-required % meter (Σ line commissions ÷ required).
6. **Award strip** via `getMergedAwardsRuleset` → club tiers; Life API only; highest reached / next-gap / top-tier-reached (no invented higher award). **Positive-only eligibility:** gold tag on Life; **no badge** on A&H/General (the strip's "Life production only" line carries the meaning); non-eligible slider thumbs in `--ink-muted`.
7. **Per-product drill (Life + General).** Expandable line → up to 4 **user-named** products `{name, api, rate}` (slider + API field + **editable rate field** each), rename affordance, balance indicator + auto-balance (products sum to line total; mirror the monthly-plan balance pattern). Defaults seed names + rates: Life = Whole Life/Annuities/Critical Illness/Term (all 0.35); General = Motor (0.10)/Property (0.125)/Group (0.10)/Commercial (0.10). **Motor & Property live under General, never Life.** When drilled, line commission = **Σ(product.api × product.rate)** and the line shows its **derived weighted-average rate read-only**. Per-product apps = product.api ÷ blended avg-policy. Persist per decision 4.
8. **Send → confirm → ack → tab.** Confirm sheet names exactly which line + named-product API figures hand over; write the extended `PLAYGROUND_INCOME_GOAL_KEY` payload; "Target sent" ack → `onOpenTab('game-plan')`. One-directional (Money Needs is source).
9. **States (honest-data):** license-unset picker · first-run guided · no-commission-need · loading skeleton · error+retry. Never zeros-as-data.

Conventions: Nexus tokens (CSS vars only, **no new hex**; remember `bg-surface-muted` trailing-d), Satoshi/Cabinet Grotesk/JetBrains Mono, **lucide-react**, ≥44px targets, focus-visible rings, TTD, Trinidad time, no gradient buttons, light + dark for everything. Meet the CI axe gate (0 new serious/critical vs baseline).

## Phase 2 — tests

New unit/RTL coverage: license→visible-lines mapping (all 3 classes + A&H always present); slider↔field two-way bind + ceiling clamp; **editable line rate → commission = API × rate (collapsed)**; **drilled line commission = Σ(product.api × product.rate) and derived weighted-average rate**; product drill balance/auto-balance + ≤4 + rename; rate persistence round-trip; award strip reads ruleset tiers (Life-only) incl. top-tier; Send writes the extended payload + `onOpenTab('game-plan')`; flag-OFF renders the legacy panel unchanged. Keep the full suite green.

## Phase 3 — smoke

Both-theme smoke (flag ON via the preview env): worksheet Option-C disclosure, the seam, allocate (slider + type), expand+rename a product, award strip renders, Send→ack→tab. axe 0 new. **Coverage boundaries (Rule 22):** name anything data-dependent on the test account (license value, avg-policy, ruleset tiers, PAYE figure) that the live smoke can't fully exercise — assert what's reachable, cover the rest by unit tests.

## Phase 4 / 5 / 6

- **Phase 4:** CONTEXT.md fill; FOLLOW_UPS — bank the deferred items: **general 6% premium-tax handling** (commission on pretax base; needs the gross-vs-pretax API-entry convention confirmed — if gross, commission = (API ÷ 1.06) × rate), Step-2 removal / yearPlan unification, per-product avg-policy divisor, and (if incomplete) whatever drill/state remains.
- **Phase 5:** commit `feat(money-needs): merged allocator surface (flag-gated, off by default)`; push; open ONE PR.
- **Phase 6:** Gemini poll 15 min + disposition (Rule 21); hex-grep new visual code; ≥1 named gap (Rule 22); **HOLD for human merge**.

## Window guidance (unattended)

If the 6h window closes before completion: **HOLD at a coherent stopping point** (the build order is core-first, so worksheet+seam+allocator land before the drill). The flag stays OFF, so main is unaffected regardless. Report exactly what's done vs deferred; move the deferred parts to FOLLOW_UPS. **Never merge, never deploy, never leave the build broken** (it's a feature branch). A partial flag-off PR held for review is a fine outcome.

---

## Report back

PR + URL; Phase-0 verdicts (esp. licenseProfile values, ruleset tier shape, persistence path + no-rules-change); per-section done/deferred; the rates constant + its "confirm" note; test + both-theme smoke results; ≥1 named gap; confirmation flag defaults OFF and it's **HELD for human merge**.
