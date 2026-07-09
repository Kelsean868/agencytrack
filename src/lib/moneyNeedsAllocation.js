// Money Needs — merged-surface allocation model (flag-gated behind
// VITE_MONEY_NEEDS_MERGED_ENABLED). Pure, Firebase-free helpers so the math is
// unit-testable in isolation, mirroring lib/yearPlanAllocation.js.
//
// This is INTENTIONALLY decoupled from the Year-Plan allocator (lib/
// yearPlanAllocation.js + yearPlanService): different line model (3 lines
// life/ah/general here vs 4 lines life/ah/property/motor there), per-line AND
// per-product editable rates (vs one blended commission rate), and a separate
// persistence target (moneyNeeds/{year}.allocation, never yearPlan/{year}).
import { DEFAULT_DECOMPOSITION_INPUTS } from '../utils/goalDecomposition';

// Blended avg-policy divisor — the SAME source the weekly planner / goal
// decomposition uses (one math source). Apps = API ÷ this. A per-product divisor
// is a deferred fast-follow; until then every line/product uses this blended avg.
export const AVG_POLICY_API = DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI; // 12000

// Per-line default commission rates — seeds for the editable rate field, persisted
// as user data once edited. NOTE (deferred fast-follow): general lines/products
// carry a 6% premium-tax; the accurate base is the pretax premium
// (commission = (API ÷ 1.06) × rate). Pending confirmation of the gross-vs-pretax
// API-entry convention, this PR computes general commission = API × rate (Tatil
// is Life-only, so no pilot impact). See docs/FOLLOW_UPS.md.
export const LINE_DEFAULT_RATES = Object.freeze({ life: 0.35, ah: 0.25, general: 0.10 });

// The 3 allocation lines. `drillable` lines expand into named products.
export const ALLOC_LINE_META = Object.freeze([
  { key: 'life',    label: 'Life',    drillable: true  },
  { key: 'ah',      label: 'A&H',     drillable: false },
  { key: 'general', label: 'General', drillable: true  },
]);

export const ALLOC_LINE_KEYS = ALLOC_LINE_META.map((m) => m.key);

// License profile → which allocation lines are visible. A&H is ALWAYS present.
// Unavailable lines are OMITTED (never greyed out). The three keys mirror the
// user.licenseProfile values (composite / life_only / general_only).
export const ALLOC_LINE_GATING = Object.freeze({
  composite:    { life: true,  ah: true, general: true  },
  life_only:    { life: true,  ah: true, general: false },
  general_only: { life: false, ah: true, general: true  },
});

// Per-product seed names + rates (user-renameable, rates editable & persisted).
// Life products seed 0.35; General seed Motor 0.10 / Property 0.125 / Group 0.10
// / Commercial 0.10. Motor & Property live under GENERAL, never Life.
export const PRODUCT_SEEDS = Object.freeze({
  life: [
    { name: 'Whole Life',       rate: 0.35 },
    { name: 'Annuities',        rate: 0.35 },
    { name: 'Critical Illness', rate: 0.35 },
    { name: 'Term',             rate: 0.35 },
  ],
  general: [
    { name: 'Motor',      rate: 0.10  },
    { name: 'Property',   rate: 0.125 },
    { name: 'Group',      rate: 0.10  },
    { name: 'Commercial', rate: 0.10  },
  ],
});

export const MAX_PRODUCTS = 4;

const num = (v) => parseFloat(v) || 0;

// Visible line keys for a license profile (composite fallback for unknown values).
export function visibleLineKeys(licenseProfile) {
  const gating = ALLOC_LINE_GATING[licenseProfile] ?? ALLOC_LINE_GATING.composite;
  return ALLOC_LINE_KEYS.filter((k) => gating[k]);
}

// Apps for an API figure (÷ blended avg-policy). One math source.
export function allocApps(api, avgPolicyAPI = AVG_POLICY_API) {
  const avg = num(avgPolicyAPI) || AVG_POLICY_API;
  return avg > 0 ? num(api) / avg : 0;
}

// Whether a line is currently drilled into per-product detail.
export function isDrilled(line) {
  return !!line?.drilled && Array.isArray(line?.products) && line.products.length > 0;
}

// COMMISSION-CANONICAL model: the agent types the commission they want; API is
// DERIVED everywhere from commission ÷ rate. Nothing stores `api`.

// Derived API for a single product (commission ÷ its rate).
export function productAPI(p) {
  const r = num(p?.rate);
  return r > 0 ? num(p?.commission) / r : 0;
}

// Line commission (the canonical figure).
//  • Drilled  → Σ product.commission  (products define the line).
//  • Collapsed→ the stored line.commission.
export function lineCommission(line) {
  if (isDrilled(line)) {
    return line.products.reduce((s, p) => s + num(p.commission), 0);
  }
  return num(line?.commission);
}

// Derived line API.
//  • Drilled  → Σ productAPI  (Σ commission ÷ rate per product).
//  • Collapsed→ line.commission ÷ line.rate.
export function lineAPI(line) {
  if (isDrilled(line)) {
    return line.products.reduce((s, p) => s + productAPI(p), 0);
  }
  const r = num(line?.rate);
  return r > 0 ? num(line?.commission) / r : 0;
}

// Effective (weighted-average) commission rate.
//  • Drilled  → lineCommission ÷ lineAPI  (read-only — products define it).
//  • Collapsed→ the editable line rate.
export function effectiveLineRate(line) {
  if (isDrilled(line)) {
    const api = lineAPI(line);
    return api > 0 ? lineCommission(line) / api : 0;
  }
  return num(line?.rate);
}

// Σ commission across the visible lines.
export function totalAllocatedCommission(lines, visibleKeys) {
  return (visibleKeys ?? ALLOC_LINE_KEYS).reduce((s, k) => s + lineCommission(lines?.[k] ?? {}), 0);
}

// Σ derived API across the visible lines.
export function totalAllocatedAPI(lines, visibleKeys) {
  return (visibleKeys ?? ALLOC_LINE_KEYS).reduce((s, k) => s + lineAPI(lines?.[k] ?? {}), 0);
}

// Seed a fresh allocation for a worksheet. COMMISSION-CANONICAL: each line's
// commission is seeded directly from the worksheet's per-line commission targets
// (the targets ARE commissions — no ÷ rate needed); absent → 0 (honest-data, no
// zeros-as-data). API is derived at read time. Products seed commission:0.
export function seedAllocation(worksheet, licenseProfile) {
  const targets = worksheet?.firstYearCommissionsTargets ?? {};
  // General subsumes property + motor from the legacy 4-line target shape.
  const generalTarget = num(targets.property) + num(targets.motor);

  const mkProducts = (key) => (PRODUCT_SEEDS[key] ?? []).map((p) => ({ name: p.name, commission: 0, rate: p.rate }));

  return {
    licenseClass: ALLOC_LINE_GATING[licenseProfile] ? licenseProfile : 'composite',
    lines: {
      life: {
        commission: Math.round(num(targets.life)),
        rate: LINE_DEFAULT_RATES.life,
        drilled: false,
        products: mkProducts('life'),
      },
      ah: {
        commission: Math.round(num(targets.ah)),
        rate: LINE_DEFAULT_RATES.ah,
      },
      general: {
        commission: Math.round(generalTarget),
        rate: LINE_DEFAULT_RATES.general,
        drilled: false,
        products: mkProducts('general'),
      },
    },
  };
}

// PR-U2: `normalizeAllocation` (merge a stored `.allocation` onto a fresh seed)
// was retired alongside the `.allocation` writer/reader. Nothing persists
// `.allocation` since PR-U1, so the allocator seeds directly from the worksheet's
// per-line commission targets via `seedAllocation`. See MoneyNeedsAllocator.jsx.

// Distribute a line COMMISSION total evenly across its products (auto-balance),
// preserving names + rates. Used when drilling, or on "Distribute evenly".
// Rounding remainder lands on the last product so Σ product.commission === total.
export function autoBalanceProducts(products, lineCommissionTotal) {
  const list = (products ?? []).slice(0, MAX_PRODUCTS);
  const n = list.length;
  if (n === 0) return list;
  const total = Math.max(0, Math.round(num(lineCommissionTotal)));
  const even = Math.floor(total / n);
  return list.map((p, i) => ({
    ...p,
    commission: i === n - 1 ? total - even * (n - 1) : even,
  }));
}

// Σ product commission (the drilled line's canonical total).
export function sumProductCommission(products) {
  return (products ?? []).reduce((s, p) => s + num(p.commission), 0);
}

// Balance epsilon (TTD) — Σ products within this of the line target reads BALANCED.
// Mirrors the mockup's `Math.abs(bal) < 2500` threshold (mn-merge.jsx ProductDrill).
export const PRODUCT_BALANCE_EPSILON = 2500;

// productBalance — the mockup's ProductDrill balance viz (BALANCED / OVER / UNDER
// pill + segmented sum-bar). Pure so the state boundaries are unit-testable.
//   sum      = Σ product.commission
//   delta    = sum − lineTarget  (>0 over-allocated, <0 under)
//   state    = 'balanced' (|delta| < EPSILON) | 'over' | 'under'
//   segments = per-product width fractions of max(target, sum, 1)
// NOTE: in this app's commission-canonical model a DRILLED line keeps
// line.commission === Σ products by construction, so the live pill reads
// BALANCED; the segmented sum-bar is the always-useful part (per-product split).
export function productBalance(products, lineTarget) {
  const list = products ?? [];
  const sum = sumProductCommission(list);
  const target = num(lineTarget);
  const delta = sum - target;
  const state = Math.abs(delta) < PRODUCT_BALANCE_EPSILON
    ? 'balanced'
    : delta > 0 ? 'over' : 'under';
  const denom = Math.max(target, sum, 1);
  const segments = list.map((p) => ({
    commission: num(p.commission),
    pct: (num(p.commission) / denom) * 100,
  }));
  return { sum, target, delta, state, segments };
}

// Σ derived product API (Σ commission ÷ rate).
export function sumProductAPI(products) {
  return (products ?? []).reduce((s, p) => s + productAPI(p), 0);
}

// Build a hierarchical summary object consumed by AllocationSummaryCard and AckModal.
// Pure: no JSX, no side effects. All math delegates to existing primitives.
//
// Returns:
//   { lines: [{ key, label, commission, api, apps, effectiveRate,
//               products: [{name, commission, api, rate}] | null }],
//     totalCommission, totalAPI, allocatedPct, required }
//
// `products` is an array when isDrilled(line), null otherwise.
// `allocatedPct` = totalCommission ÷ required, 0 when required ≤ 0.
export function buildAllocationSummary(alloc, visibleKeys, required) {
  const keys = visibleKeys ?? ALLOC_LINE_KEYS;
  const req = num(required);
  const lines = keys.map((key) => {
    const line = alloc?.lines?.[key] ?? {};
    const commission = lineCommission(line);
    const api = lineAPI(line);
    const apps = Math.round(allocApps(api));
    const effectiveRate = effectiveLineRate(line);
    const meta = ALLOC_LINE_META.find((m) => m.key === key);
    const products = isDrilled(line)
      ? (line.products ?? []).map((p) => ({
          name: p.name ?? '',
          commission: num(p.commission),
          api: productAPI(p),
          rate: num(p.rate),
        }))
      : null;
    return { key, label: meta?.label ?? key, commission, api, apps, effectiveRate, products };
  });
  const totalCommission = lines.reduce((s, l) => s + l.commission, 0);
  const totalAPI = lines.reduce((s, l) => s + l.api, 0);
  const allocatedPct = req > 0 ? totalCommission / req : 0;
  return { lines, totalCommission, totalAPI, allocatedPct, required: req };
}

// ── Adapter: 3-line commission allocation → yearPlan keyed object (Direction 1.5) ──
// Maps the allocator's commission-canonical 3-line model onto the canonical
// `yearPlan/{year}` line shape (targetAPI-canonical), over the SHARED 3 keys
// ['life','ah','general']. `general` is always carried, so its API never
// vanishes from the committed total (the money-undercount fix — PR-U1 §0).
//
// Per line:
//   • targetAPI         = lineAPI (commission ÷ rate; Σ productAPI when drilled)
//   • derivedCommission = lineCommission (the canonical commission)
//   • rate              = effectiveLineRate (weighted when drilled)
//   • enabled           = whether the line is visible for the license profile
//   • products          = [{ name, api, rate }] (≤4) for drilled life/general
//   • pct               = share of the total enabled targetAPI
//
// Round-trip invariant: Σ targetAPI over enabled keys === totalAllocatedAPI over
// the visible keys (targetAPI === lineAPI per line). One direction only — the
// allocator re-seeds from worksheet targets on reload (`.allocation` reader
// retired in PR-U2). Returns the `lines` object for saveYearPlan(...).
export function allocationToYearPlan(allocation) {
  const licenseClass = ALLOC_LINE_GATING[allocation?.licenseClass] ? allocation.licenseClass : 'composite';
  const visible = new Set(visibleLineKeys(licenseClass));

  const lines = {};
  for (const key of ALLOC_LINE_KEYS) {
    const line = allocation?.lines?.[key] ?? {};
    const enabled = visible.has(key);
    const api = enabled ? lineAPI(line) : 0;
    const commission = enabled ? lineCommission(line) : 0;
    const drilled = enabled && isDrilled(line);
    const products = drilled
      ? line.products.slice(0, MAX_PRODUCTS).map((p) => ({
          name: p.name ?? '',
          api: productAPI(p),
          rate: num(p.rate),
        }))
      : [];
    lines[key] = {
      targetAPI: api,
      pct: 0,
      derivedApps: Math.round(allocApps(api)),
      derivedCommission: commission,
      enabled,
      rate: effectiveLineRate(line),
      products,
    };
  }

  const totalAPI = ALLOC_LINE_KEYS.reduce((s, k) => s + (lines[k].enabled ? lines[k].targetAPI : 0), 0);
  if (totalAPI > 0) {
    for (const k of ALLOC_LINE_KEYS) {
      if (lines[k].enabled) lines[k].pct = parseFloat(((lines[k].targetAPI / totalAPI) * 100).toFixed(2));
    }
  }
  return lines;
}
