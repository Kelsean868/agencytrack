/**
 * rollingModelV2.js — pure calc for the Persistency v2 rolling-model SHELL
 * (item 3.4, flag `persistencyV2`).
 *
 * This mirrors the worked model in `docs/design-system/screens-v2/
 * persistency-lab.jsx` (the design source of truth for the rolling engine):
 *
 *   v1 · Settled Ratio (timing-blind):
 *     net         = Σ API − Σ (open-lapsed API)
 *     persistency = net ÷ gross × 100
 *
 *   v2 · Rolling 24-month self-expiry (time-weighted):
 *     debit       = API × max(0, rem(lapse) − rem(reinstate)) ÷ 24
 *     persistency = (Σ API − Σ debit) ÷ Σ API × 100
 *     rem(m)      = 24 − m   (months remaining to the 24-month horizon)
 *
 * IMPORTANT — this operates ONLY on a documented FIXTURE-SHAPE preview book.
 * Live per-policy persistency data does NOT exist yet (the v2 engine is pending
 * Tatil sign-off), so the shell must NEVER present these numbers as an agent's
 * real persistency. `PREVIEW_BOOK` is illustrative and reproduces the worked
 * numbers from the spec (gross 13,000 · v1 ≈ 72.0% · v2 ≈ 85.8%).
 *
 * A `PersistencyBookPolicy` (the fixture-shape prop each row expects):
 *   { id, name, type, api, state: 'active'|'lapsed',
 *     lapseMonth?, age?, reinstateMonth?|null, note? }
 */

export const GATE = 90;   // award-eligibility gate (%)
export const FLOOR = 80;  // company floor (%)
export const HORIZON_MONTHS = 24;

/** Months remaining to the 24-month rolling horizon. */
export function rem(month) {
  return Math.max(0, HORIZON_MONTHS - (Number(month) || 0));
}

/** v2 time-weighted debit charged for one policy (0 for active/in-force). */
export function policyDebitV2(policy) {
  if (!policy || policy.state === 'active') return 0;
  const debitM = rem(policy.lapseMonth);
  const creditM = policy.reinstateMonth != null ? rem(policy.reinstateMonth) : 0;
  const api = Number(policy.api) || 0;
  return (api * Math.max(0, debitM - creditM)) / HORIZON_MONTHS;
}

/** Gross settled API across the book. */
export function grossOf(book) {
  return (Array.isArray(book) ? book : []).reduce((s, p) => s + (Number(p.api) || 0), 0);
}

/**
 * persistencyForModel(book, model) — whole-book persistency % under 'v1'|'v2'.
 * Returns 0 for an empty / zero-gross book.
 */
export function persistencyForModel(book, model) {
  const list = Array.isArray(book) ? book : [];
  const gross = grossOf(list);
  if (gross === 0) return 0;
  if (model === 'v1') {
    const lapsedOpen = list
      .filter((p) => p.state === 'lapsed' && p.reinstateMonth == null)
      .reduce((s, p) => s + (Number(p.api) || 0), 0);
    return ((gross - lapsedOpen) / gross) * 100;
  }
  const debit = list.reduce((s, p) => s + policyDebitV2(p), 0);
  return ((gross - debit) / gross) * 100;
}

/** Per-policy debit charged under the active model (0 for active/reinstated). */
export function policyChargeForModel(policy, model) {
  if (!policy || policy.state === 'active') return 0;
  if (model === 'v2') return policyDebitV2(policy);
  // v1: full API charged while the lapse is open; nothing once reinstated.
  return policy.reinstateMonth != null ? 0 : (Number(policy.api) || 0);
}

export function bandKey(pct) {
  if (pct >= GATE) return 'success';
  if (pct >= FLOOR) return 'warning';
  return 'danger';
}
export function bandLabel(pct) {
  if (pct >= GATE) return 'Award-eligible';
  if (pct >= FLOOR) return 'Watch';
  return 'Below floor';
}

/**
 * PREVIEW_BOOK — the documented illustrative fixture. NOT live agent data.
 * Reproduces the spec's worked book (Priya Naidu): v1 ≈ 72.0%, v2 ≈ 85.8%.
 */
export const PREVIEW_BOOK = Object.freeze([
  { id: 'active',   name: '5 active policies', type: 'In force',    api: 8700, state: 'active' },
  { id: 'gopaul',   name: 'A. Gopaul',   type: 'Whole Life', api: 1200, state: 'lapsed', lapseMonth: 6,  age: 8,  reinstateMonth: null, note: 'Grace ends 12 Dec' },
  { id: 'mohammed', name: 'R. Mohammed', type: 'Term',       api: 480,  state: 'lapsed', lapseMonth: 4,  age: 7,  reinstateMonth: null, note: 'Missed 2 payments' },
  { id: 'baksh',    name: 'K. Baksh',    type: 'Whole Life', api: 1960, state: 'lapsed', lapseMonth: 18, age: 21, reinstateMonth: null, note: 'NSF — retry pending' },
  { id: 'singh',    name: 'D. Singh',    type: 'Term',       api: 660,  state: 'lapsed', lapseMonth: 9,  age: 13, reinstateMonth: 11,   note: 'Reinstated month 11' },
]);

/**
 * deriveRollingModel(book, model) — everything the shell renders, as pure data.
 * Returns null for an empty book (the shell shows its empty state instead).
 */
export function deriveRollingModel(book, model = 'v2') {
  const list = Array.isArray(book) ? book : [];
  if (list.length === 0) return null;
  const activeModel = model === 'v1' ? 'v1' : 'v2';
  const v1pct = persistencyForModel(list, 'v1');
  const v2pct = persistencyForModel(list, 'v2');
  const current = activeModel === 'v1' ? v1pct : v2pct;
  const lapsed = list.filter((p) => p.state === 'lapsed');
  const weighting = lapsed.map((p) => {
    const charged = policyChargeForModel(p, activeModel);
    const api = Number(p.api) || 0;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      api,
      charged,
      pctCharged: api > 0 ? Math.min(100, (charged / api) * 100) : 0,
      creditMonths: activeModel === 'v2' ? rem(p.age) : null,
      note: p.note,
    };
  });
  return {
    model: activeModel,
    gross: grossOf(list),
    current,
    band: bandKey(current),
    bandLabel: bandLabel(current),
    v1pct,
    v2pct,
    weighting,
  };
}
