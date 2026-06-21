import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';

export async function getAwardsRuleset(tenantId, year = 2026) {
  const ref = doc(db, `tenants/${tenantId}/config/awardsRuleset_${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : DEFAULT_RULESET_2026;
}

/**
 * deepMergeRuleset — merge a loaded (possibly partial / schema-drifted) ruleset
 * onto a complete fallback so render consumers never destructure a missing
 * nested field and crash. Loaded values win; the fallback backfills any absent
 * key; nested award/tier objects merge recursively; arrays and primitives are
 * taken wholesale from `loaded` when present. Behavior ported from the local
 * helper added to YearPlanModal in #707 (b67032c).
 *
 * @param {object|null|undefined} loaded - the stored ruleset (may be partial)
 * @param {object} fallback              - the complete default ruleset
 * @returns {object} a complete ruleset
 */
export function deepMergeRuleset(loaded, fallback) {
  if (!loaded || typeof loaded !== 'object') return fallback;
  const out = Array.isArray(fallback) ? [...fallback] : { ...fallback };
  for (const key of Object.keys(loaded)) {
    const lv = loaded[key];
    const fv = fallback?.[key];
    out[key] =
      lv && typeof lv === 'object' && !Array.isArray(lv) &&
      fv && typeof fv === 'object' && !Array.isArray(fv)
        ? deepMergeRuleset(lv, fv)
        : lv;
  }
  return out;
}

/**
 * getMergedAwardsRuleset — render-only accessor. Returns a COMPLETE ruleset:
 * the stored doc deep-merged onto DEFAULT_RULESET_2026 (missing doc → DEFAULT
 * unchanged; partial doc → gaps backfilled). Render/compute consumers (Year
 * Plan, AgentDashboard, ManagerAwardsPanel and everything they feed) use this
 * so a partial Firestore doc can't crash them. The raw `getAwardsRuleset` above
 * is intentionally left unchanged for the admin editor (AwardsRulesetPanel),
 * which must see and round-trip the stored doc faithfully (Option A ruling).
 */
export async function getMergedAwardsRuleset(tenantId, year = 2026) {
  const ruleset = await getAwardsRuleset(tenantId, year);
  return deepMergeRuleset(ruleset, DEFAULT_RULESET_2026);
}

const REQUIRED_GROUPS = Object.keys(DEFAULT_RULESET_2026);

// Recursively validates all numeric fields are finite and non-negative.
// Top-level array groups (recruitingAwards, activityAwards) are called directly
// with an array obj — the entry guard handles the empty-array check and recurses
// into each element. Nested arrays (clubAward.tiers, managerMonthlyBonus.tiers)
// are caught by the inner Array.isArray(v) branch.
function validateNumericFields(obj, path) {
  if (Array.isArray(obj)) {
    if (obj.length === 0) throw new Error(`"${path}" must not be empty.`);
    obj.forEach((el, i) => validateNumericFields(el, `${path}[${i}]`));
    return;
  }
  if (obj === null || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (['prize', 'id', 'name'].includes(k)) continue;
    if (typeof v === 'boolean') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) throw new Error(`"${path}.${k}" must not be empty.`);
      v.forEach((el, i) => validateNumericFields(el, `${path}.${k}[${i}]`));
      continue;
    }
    if (v !== null && v !== undefined && typeof v === 'object') {
      validateNumericFields(v, `${path}.${k}`);
    } else if (v !== null && v !== undefined) {
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid value for "${path}.${k}": must be a non-negative number.`);
      }
    }
  }
}

// Writes the COMPLETE ruleset to tenants/{tenantId}/config/awardsRuleset_{year}.
// Uses plain setDoc (no merge) — monolithic replacement. A partial ruleset
// (missing any top-level group) is rejected to prevent silently breaking awards.
export async function setAwardsRuleset(tenantId, year = 2026, ruleset, updatedBy) {
  for (const key of REQUIRED_GROUPS) {
    if (!(key in ruleset)) {
      throw new Error(`Ruleset missing required group: "${key}". Partial writes are not allowed.`);
    }
  }
  for (const key of REQUIRED_GROUPS) {
    validateNumericFields(ruleset[key], key);
  }
  const ref = doc(db, `tenants/${tenantId}/config/awardsRuleset_${year}`);
  await setDoc(ref, {
    ...ruleset,
    updatedBy: updatedBy ?? null,
    updatedAt: serverTimestamp(),
  });
}
