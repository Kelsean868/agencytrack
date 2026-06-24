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

// Line commission.
//  • Drilled  → Σ(product.api × product.rate)  (products define the line).
//  • Collapsed→ lineAPI × line.rate.
// (general = API × rate this PR; 6% premium-tax deferred — see LINE_DEFAULT_RATES.)
export function lineCommission(line) {
  if (isDrilled(line)) {
    return line.products.reduce((s, p) => s + num(p.api) * num(p.rate), 0);
  }
  return num(line?.api) * num(line?.rate);
}

// Effective (weighted-average) commission rate.
//  • Drilled  → lineCommission ÷ lineAPI  (read-only — products define it).
//  • Collapsed→ the editable line rate.
export function effectiveLineRate(line) {
  if (isDrilled(line)) {
    const api = num(line?.api);
    return api > 0 ? lineCommission(line) / api : 0;
  }
  return num(line?.rate);
}

// Σ commission across the visible lines.
export function totalAllocatedCommission(lines, visibleKeys) {
  return (visibleKeys ?? ALLOC_LINE_KEYS).reduce((s, k) => s + lineCommission(lines?.[k] ?? {}), 0);
}

// Σ API across the visible lines.
export function totalAllocatedAPI(lines, visibleKeys) {
  return (visibleKeys ?? ALLOC_LINE_KEYS).reduce((s, k) => s + num(lines?.[k]?.api), 0);
}

// Seed a fresh allocation for a worksheet. Each line carries its default rate and
// (for drillable lines) the seeded product list (drilled:false until the agent
// expands it). Line API is seeded from the worksheet's per-line commission targets
// where present (api = target ÷ rate); absent → 0 (honest-data, no zeros-as-data).
export function seedAllocation(worksheet, licenseProfile) {
  const targets = worksheet?.firstYearCommissionsTargets ?? {};
  // General subsumes property + motor from the legacy 4-line target shape.
  const generalTarget = num(targets.property) + num(targets.motor);
  const seedAPI = (commissionTarget, rate) => (rate > 0 ? num(commissionTarget) / rate : 0);

  const mkProducts = (key) => (PRODUCT_SEEDS[key] ?? []).map((p) => ({ name: p.name, api: 0, rate: p.rate }));

  return {
    licenseClass: ALLOC_LINE_GATING[licenseProfile] ? licenseProfile : 'composite',
    lines: {
      life: {
        api: Math.round(seedAPI(targets.life, LINE_DEFAULT_RATES.life)),
        rate: LINE_DEFAULT_RATES.life,
        drilled: false,
        products: mkProducts('life'),
      },
      ah: {
        api: Math.round(seedAPI(targets.ah, LINE_DEFAULT_RATES.ah)),
        rate: LINE_DEFAULT_RATES.ah,
      },
      general: {
        api: Math.round(seedAPI(generalTarget, LINE_DEFAULT_RATES.general)),
        rate: LINE_DEFAULT_RATES.general,
        drilled: false,
        products: mkProducts('general'),
      },
    },
  };
}

// Merge a stored allocation onto a fresh seed so a sparse/legacy doc never leaves
// a line or product list undefined (defensive, mirrors normalizeWorksheet's intent).
export function normalizeAllocation(stored, worksheet, licenseProfile) {
  const base = seedAllocation(worksheet, licenseProfile);
  if (!stored || typeof stored !== 'object' || !stored.lines) return base;
  const out = { licenseClass: stored.licenseClass ?? base.licenseClass, lines: {} };
  for (const key of ALLOC_LINE_KEYS) {
    const s = stored.lines[key];
    const b = base.lines[key];
    if (!s) { out.lines[key] = b; continue; }
    out.lines[key] = {
      ...b,
      ...s,
      api: num(s.api),
      rate: s.rate === undefined ? b.rate : num(s.rate),
    };
    if (b.products) {
      out.lines[key].products = Array.isArray(s.products) && s.products.length > 0
        ? s.products.slice(0, MAX_PRODUCTS).map((p) => ({ name: p.name ?? '', api: num(p.api), rate: num(p.rate) }))
        : b.products;
      out.lines[key].drilled = !!s.drilled;
    }
  }
  return out;
}

// Distribute a line total evenly across its products (auto-balance), preserving
// names + rates. Used when the agent edits the line total while drilled, or hits
// "balance". Rounding remainder lands on the last product so Σ products === total.
export function autoBalanceProducts(products, lineTotal) {
  const list = (products ?? []).slice(0, MAX_PRODUCTS);
  const n = list.length;
  if (n === 0) return list;
  const total = Math.max(0, Math.round(num(lineTotal)));
  const even = Math.floor(total / n);
  return list.map((p, i) => ({
    ...p,
    api: i === n - 1 ? total - even * (n - 1) : even,
  }));
}

// Σ product API (used to keep the line total in sync when drilled).
export function sumProductAPI(products) {
  return (products ?? []).reduce((s, p) => s + num(p.api), 0);
}
