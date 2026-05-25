# Build Lock — Track G · G2: PAYE Engine

**Branch:** `feat/track-g-g2-paye-engine` (git fetch origin before branching off main).
Pure math, no UI / rules / Firestore. Mergeable on its own via the rubric (money-math class — the unit-test vectors below ARE the proof, since there's no external answer key). Build → vectors pass → merge per rubric. Not a foundation or a flip.

---

## Why
The worksheet's core calculation: an agent's **after-tax annual need → the gross income they must earn** (which then drives their first-year-commission target). Pure functions now; G3 wires them into the panel.

## The model — legally-correct T&T chargeable-income (confirmed by Kyron)
- Personal allowance: first **$90,000** of gross is tax-free.
- **25%** on **chargeable** income (gross − allowance) up to **$1,000,000** chargeable → i.e. gross from $90,000 to **$1,090,000**.
- **30%** on chargeable income above $1,000,000 → i.e. gross above **$1,090,000**.
- Net pivot into 30% = **$840,000**.
- **Allowance-only simplification** (v1): ignore NIS/annuity deductions. Documented assumption — keeps the worksheet a clean, slightly-conservative planning estimate.

Source: T&T IRD / PwC — 25% on chargeable < TTD 1M, 30% on chargeable > TTD 1M; personal allowance TTD 90,000.

## Scope — declared file set (scope-check must match exactly)
- `src/utils/payeEngine.js` (new)
- `src/utils/__tests__/payeEngine.test.js` (new)
- `docs/phase7-8-PRD.md` (correct the §6 PAYE model + config schema)
- `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`

## API
```js
export const DEFAULT_PAYE_CONFIG = {
  method: 'reverse-progressive-chargeable',
  currency: 'TTD',
  personalAllowance: 90000,
  chargeableBrackets: [
    { upToChargeable: 1000000, rate: 0.25 },
    { upToChargeable: null,    rate: 0.30 },
  ],
};

// gross income → annual PAYE tax
export function computePAYE(grossIncome, config = DEFAULT_PAYE_CONFIG) { ... }

// after-tax (net) income → required gross income
export function grossFromNet(netIncome, config = DEFAULT_PAYE_CONFIG) { ... }
```

**Implementation requirements**
- Implement as a **config-driven band walk** (allowance + `chargeableBrackets`), NOT hardcoded constants — so it stays correct if a tenant later configures different brackets. `DEFAULT_PAYE_CONFIG` carries the T&T 2026 values.
- `computePAYE`: `chargeable = max(0, gross − allowance)`; tax each chargeable slice at its bracket rate; return annual tax (full precision).
- `grossFromNet`: walk the same brackets to find the band the target net falls in, then invert linearly: `gross = grossAtBandFloor + (net − netAtBandFloor) / (1 − rate)`. For `net ≤ allowance` → `gross = net`.
- `parseFloat` all inputs; guard `NaN`/negative/≤0 → return 0.
- Return full-precision numbers; callers round for display (do not round inside the engine).
- Pure functions — no Firestore, no fetch, no React.

## Test vectors (derived + verified — implement to these exactly)

**`computePAYE(gross)` — forward:**
| gross | chargeable | expected tax |
|---|---|---|
| 50,000 | 0 | 0 |
| 90,000 | 0 | 0 |
| 370,000 | 280,000 | 70,000 |
| 1,090,000 | 1,000,000 | 250,000 |
| 1,318,571.43 | 1,228,571.43 | 318,571.43 |
| 1,500,000 | 1,410,000 | 373,000 |

(1.5M check: 250,000 + 0.30 × 410,000 = 250,000 + 123,000 = 373,000.)

**`grossFromNet(net)` — reverse (the function the worksheet uses):**
| net | expected gross | verification |
|---|---|---|
| 60,000 | 60,000 | tax 0 → net 60,000 ✓ |
| 90,000 | 90,000 | tax 0 → net 90,000 ✓ |
| 300,000 | 370,000 | tax 70,000 → net 300,000 ✓ |
| 500,000 | 636,666.67 | tax 136,666.67 → net 500,000 ✓ |
| 840,000 | 1,090,000 | tax 250,000 → net 840,000 ✓ (pivot) |
| 1,000,000 | 1,318,571.43 | tax 318,571.43 → net 1,000,000 ✓ |

Band formulas these reduce to (assert these hold): 25% band `gross = (net − 22,500)/0.75`; 30% band `gross = (net − 77,000)/0.70`.

**Edge cases:**
- `net = 0` → `gross = 0`; `gross = 0` → `tax = 0`.
- Negative or non-numeric input → 0 (guarded).
- Continuity at the pivot: `grossFromNet(840,000) === 1,090,000` and `computePAYE(1,090,000) === 250,000`.
- Round-trip property: for a spread of gross values, `grossFromNet(gross − computePAYE(gross))` ≈ original gross (assert with `toBeCloseTo(_, 2)`).
- Use `toBeCloseTo(_, 2)` for the non-integer expectations (636,666.67, 1,318,571.43, 318,571.43).

## Docs
- `phase7-8-PRD.md` §6: correct the PAYE model to the chargeable-income version (30% above $1,090,000 gross / $1M chargeable, pivot net $840,000, allowance-only), and update the `payeFormula` config schema example to `{ personalAllowance, chargeableBrackets: [{upToChargeable, rate}] }`.
- `CONTEXT.md` recently-shipped row (`#TBD`/`{TBD}`).
- `FOLLOW_UPS.md`: mark G2 done in the Track G slice plan. Note the **tenant `/config/payeFormula` doc + `payeBracketsSnapshot` versioning + refresh-banner** are a later concern (wired in G3 or a dedicated config slice); G2 ships the pure engine + `DEFAULT_PAYE_CONFIG` only.

## Gates
- Unit tests (all vectors above) green, lint clean, build clean. No smoke (no UI/rules/Firestore/deploy).
- Scope-check: `gh pr diff <n> --name-only` equals the declared set exactly.
- Money-math class + pure + dormant (nothing calls it until G3) → merges per the rubric once vectors pass and CI is green.
- In the PR report, paste verbatim `payeEngine.js` and the vector test results, so the math is on the record and auditable.
