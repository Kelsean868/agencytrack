# K3 — bonus engine (pure module) — kickoff brief

**Authored:** post-#749 · dispatcher.
**Baseline:** origin/main `26b6f55` (K2 fill; K2 squash `6cabcc6`) — **Phase 0 re-verifies exact HEAD.**
**run_model:** `claude-opus-4-8` (money math — judgment-dense).
**Mode:** Autonomous, ONE PR, **build straight through to PR-open, then HOLD**. Unattended-eligible. No merge, no deploy, no green-channel.
**Merge class:** **Human-merge (Rule 19)** — money math. (No rules, no deploy — pure module.)

## Header

| Field | Value |
|---|---|
| **Type** | Implementation PR — Track K · **pure bonus-engine module** (no collection, no rules, no UI, no Firestore writes) |
| **Shape** | `src/lib/financingBonusEngine.js` (pure functions, awards-engine pattern) + exhaustive `financingBonusEngine.test.js` + a `config/financingRuleset` default-values module/section + docs |
| **Size** | M |
| **Branch** | `feat/k3-bonus-engine` |
| **Sources** | `docs/track-k-financing-new-agent-design.md` §3/§4 · `docs/design/track-k-locked-decisions.md` **A.2/A.3/A.5** (these supersede §3/§4 working-interps) · `src/lib/awardsEngine.js` (pattern mirror) |
| **Risky classification** | **NO mandatory hard-stop** — pure module, no rules/collection/agent surface. **BUT** Phase 1 hard-stops-and-HOLDS on any contract-math discrepancy or unlocked decision (don't build contested money math unattended). |
| **Smoke walk** | **WAIVED — justified:** pure module, zero Firestore/rules/runtime/agent surface. Verification is exhaustive unit tests through the real functions. |
| **Strike count** | 0/2 |

---

## Context

K1 + K2 shipped the foundation (terms, status machine, ledger, running balance). K3 is the **bonus engine** — a pure, deterministic module that takes normalized per-agent per-period production data + a ruleset and returns the contract's API chain, the quarterly gates, and the consistency / production / annual-adjustment bonus figures. It writes nothing and renders nothing; it is consumed by K4 (take-home) and K8 (dashboard). Building it as a pure module makes it fully unit-testable and unattended-safe: nothing ships without human merge (money), and any contract-math surprise holds for morning review.

The contract definitions resolved across the planning sessions — **the addendum (A.2/A.3/A.5) is authoritative where it supersedes the design spec's working interpretations.**

---

## Architectural decisions (locked at brief authoring)

1. **API chain** (spec §3, addendum A.2 — the bases):
   - **Gross New Settled API** (1.2) = credit-filtered (map in Decision 2) settled annualized premium, less not-takens, **+ 10% Lump-Sum Deposits + 10% increased PPPs**, excluding platinum_edge / single-premium(spia). → drives the **$37,500/qtr gate** and the **annual rate tier**.
   - **Net New Settled API for Persistency** (1.4) = Gross − lapsed/surrendered(<2yr) + reinstatements(<2yr). **← this is the QUARTERLY BONUS BASE** (addendum A.2 supersedes the spec's Net-for-Production working-interp).
   - **Net New Settled API for Production** (1.5) = Net-for-Persistency − 10% LSD − 10% inc-PPP. **← the ANNUAL BONUS ADJUSTMENT qualifying base only** (1.8, explicit).
   - **Persistency** = the app's validated figure, **passed in** (never recomputed from clause 1.6 — addendum A.5).
2. **Credit map** (addendum A.3 — per `newBusinessType`, applied building Gross):
   | type | weight | | type | weight |
   |---|---|---|---|---|
   | `nb_ordinary` | 100% | | `platinum_edge` | 0% |
   | `inc_ppp` | 10% | | `replacement` | **0%** |
   | `lumpsum` | 10% | | `spia` | **0%** |
   | `isSelfOrFamily = true` → excluded (0%) | | | **Staff** | see §3 |
3. **Staff treatment — `staffPolicyTreatment` ruleset value, default `'count'`** (product owner, twice-stated; **documented divergence** from contract 1.2 which excludes Staff). Since the ledger carries **no staff flag**, `'count'` = staff policies counted per their own `newBusinessType` (the functional default, no identification needed). `'exclude'` is a **declared but inert** option — it cannot function until a ledger staff-flag exists (banked FU in Phase 4). The engine reads this from the ruleset; flipping it is config, not code.
4. **Gates** (all ruleset-configurable): Gross ≥ **$37,500/quarter**; persistency ≥ **95%** (year 1) / **90%** (year 2). **Q1 exception:** $37,500 *submitted* (not settled), no persistency test (contract 3.3).
5. **Bonus formulas** (gated by Decision 4):
   - **Consistency** = **15% × Net-for-Persistency** per quarter.
   - **Production** = **15%** (yr 1) / **20%** (yr 2) **× Net-for-Persistency** per quarter.
   - **Annual Bonus Adjustment** = (**Net-for-Production × Total Bonus Rate**) − consistency/production already paid that year (gated; paid only if min annual Gross settled and the agent didn't max consistency+production).
6. **Bonus-rate tiers** (annual Gross, both years, ruleset-configurable): **$150K–$200K → 25%** (20% API + 5% lives); **> $200K → 30%** (25% + 5%). Lives portion requires **80 net policies settled**.
7. **Pure module, awards-engine pattern** — mirror `src/lib/awardsEngine.js`: pure functions, no Firestore, no `import.meta.env`, no side effects, deterministic. Signature shape (final names per the awards-engine mirror): `computeFinancingBonus(input, ruleset) → { gross, netPersistency, netProduction, gates, consistencyBonus, productionBonus, annualAdjustment, rateTier, livesQualified, ... }`. `input` is normalized per-agent per-period production (policy lines with `newBusinessType`/amount/flags, lapses/reinstatements, persistency value, year-in-agreement, submitted-vs-settled flag for Q1). **The engine does not fetch data** — callers (K4/K8) pass it in.
8. **Ruleset home** — a `config/financingRuleset` default-values module carrying: `quarterlyGrossMin` (37500), `persistencyY1`/`persistencyY2` (0.95/0.90), `consistencyRate` (0.15), `productionRateY1`/`Y2` (0.15/0.20), `creditMap`, `staffPolicyTreatment` ('count'), rate-tier table, `livesPolicyMin` (80). **All TTD/percent values are placeholders confirmed current for 2026 — configurable, never hardcoded in the engine.** Phase 1 confirms whether to extend `config/awardsRuleset` or stand up a sibling `financingRuleset` (recommend sibling — keeps financing rules decoupled).

## Out of scope

- **Live data wiring** (feeding real ledger/settlement/persistency data into the engine) → K8 / a thin adapter. K3 is the engine + tests only.
- Take-home (tax → net → 50%) → **K4** · proration → **K5** · reconciliation → **K6** · termination monitor → **K7** · dashboard/drill-down → **K8**
- Any UI, any Firestore collection, any rules, any write path
- The `'exclude'` staff path's ledger staff-flag (banked FU)

## Phase 0 — gate

Standard. Fresh branch `feat/k3-bonus-engine` off synced `origin/main` (`26b6f55`). Clean tree. STOP on divergence.

## Phase 1 — source-verify (verify-and-continue; hard-stop-and-HOLD only on a surprise)

1. `git ls-files docs/track-k-financing-new-agent-design.md docs/design/track-k-locked-decisions.md src/lib/awardsEngine.js` → all tracked. Missing → **STOP and wait for dispatcher**.
2. Greenfield grep: `git grep -rn "financingBonusEngine\|computeFinancingBonus\|financingRuleset" -- src config` → 0 hits.
3. **Contract-math verification (the load-bearing check).** Read addendum **A.2/A.3/A.5** and spec §3/§4, and confirm this brief's Decisions 1–6 match them — specifically: quarterly base = **Net-for-Persistency** (A.2, not the spec's old Net-for-Production), annual adjustment base = Net-for-Production, credit map = A.3 (replacement/spia 0%), persistency passed-in (A.5). **If the brief's math contradicts the authoritative addendum → STOP and wait for dispatcher** (do not build contested money math).
4. Read `awardsEngine.js` — confirm the pure-function input/output convention to mirror (no side effects, ruleset passed in). If the awards engine already exposes a reusable credit-weighting helper, note it (reuse vs re-implement — recommend, hard-stop only if it forces an unlocked decision).
5. Confirm the `newBusinessType` enum values + `isSelfOrFamily` on the policy ledger (K2/Track H) so the credit map keys are real.
6. Ruleset home recommendation (sibling `financingRuleset` vs extend `awardsRuleset`).

**If 1–6 verify clean, CONTINUE to Phase 2 (no stop).** Hard-stop-and-HOLD only on a contract-math discrepancy (#3) or a decision not pre-locked here.

## Phase 2 — build

1. `config/financingRuleset` defaults (Decision 8).
2. `src/lib/financingBonusEngine.js` — the pure engine (Decisions 1–7).
3. `financingBonusEngine.test.js` — **exhaustive**: every credit-map type incl. staff `'count'` vs `'exclude'` and `isSelfOrFamily`; gate boundaries (just-below/at/above $37,500); Q1 submitted-basis exception; persistency Y1 95% vs Y2 90% boundaries; consistency + production formulas (Y1/Y2); annual adjustment (with/without prior bonuses, the max-out condition); rate-tier boundaries (150K/200K, lives ≥/< 80); zero/negative/empty-input edges. Worked numeric example matching the spec's $10K-bonus / $37,500-gate figures.

## Phase 3 — verification

- Lint 0 · build green · full suite green (the new engine tests are the core).
- No smoke (pure module — waiver justified above). No hex/axe (no UI).

## Phase 4 — docs (placeholders)

- `docs/CONTEXT.md` — recently-shipped row (`#TBD`), top table → K3 shipped, Where-we-left-off. (Size cap.)
- `docs/FOLLOW_UPS.md` — bank: (a) **K3 live-data wiring** (adapter feeding ledger/settlement/persistency into the engine — lands with K8); (b) **staff `'exclude'` path** needs a ledger staff-flag before it can function (gated on the A.4 contract-vs-owner decision if ever flipped); (c) note the engine's figures are placeholders pending any 2026 ruleset confirmation.

## Phase 5 — commit / push / PR

Conventional commits on `feat/k3-bonus-engine`. Lint + build + suite green. Push; PR via `gh`: title `feat(k3): financing bonus engine (pure module) + ruleset (Track K)`; description = outcome + the worked numeric example + the Phase 1 contract-math verification result + explicit note that staff defaults to `'count'` (documented divergence). **Rule 15** paste-back. **Rule 20** — name HEAD SHA. Do NOT merge. Surface the PR URL, then **STOP and wait for dispatcher**.

## Phase 6 — held (post-merge)

Human-merge (money math — Kyron reviews the engine + the worked example). No deploy (no rules). `/post-merge <pr#>` (Sonnet) for the docs fill. **Rule 21** poll; **Rule 22** name ≥1 gap (seed: the unit tests share the author's mental model, so the human math review at merge is the real second check).

## Strike rules

Session opens 0/2. Hard stops (Rule 12 phrasing only):
- Phase 1 #3 contract-math discrepancy, or any decision not pre-locked → **STOP and wait for dispatcher** (unattended → holds for morning)
- Phase 2 scope expansion beyond the engine + ruleset + tests (any UI / collection / rules / write path / live data fetch) → **STOP and wait for dispatcher**
- Phase 3 lint/build/suite failure after one fix attempt → **STOP and wait for dispatcher**
