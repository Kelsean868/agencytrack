/**
 * yearPlanAllocation.js — pure, framework-free allocation helpers for the
 * Year Plan allocator modal (Slice 2a).
 *
 * All functions are stateless and side-effect-free so the full allocation
 * mechanic is unit-testable in isolation without React or Firebase.
 *
 * Key invariants (asserted by tests):
 *   - %↔direct mode switch preserves targetAPI (never overwrites the money)
 *   - sum-to-100 rounding absorbs the remainder in the last-edited line
 */

import { DEFAULT_DECOMPOSITION_INPUTS } from '../utils/goalDecomposition';

// ── License gating ────────────────────────────────────────────────────────────

export const LICENSE_LINE_GATING = {
  composite:    { life: true,  ah: true, property: true,  motor: true  },
  life_only:    { life: true,  ah: true, property: false, motor: false },
  general_only: { life: false, ah: true, property: true,  motor: true  },
};

const LINE_KEYS = ['life', 'ah', 'property', 'motor'];

/**
 * applyGating — mark each line enabled/disabled per license profile.
 * A&H is always enabled in every profile.
 */
export function applyGating(lines, licenseProfile) {
  const gating = LICENSE_LINE_GATING[licenseProfile] ?? LICENSE_LINE_GATING.composite;
  const result = {};
  for (const key of LINE_KEYS) {
    result[key] = { ...lines[key], enabled: gating[key] ?? false };
  }
  return result;
}

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * seedFromTargets — convert Money Needs commission targets to API per line.
 *
 * Seeded when target > 0: targetAPI = commissionTarget ÷ (commissionRate / 100).
 * commissionRate is a percent integer (e.g. 35 = 35%). Default 35.
 */
export function seedFromTargets(targets, commissionRate) {
  const rate = parseFloat(commissionRate) || DEFAULT_DECOMPOSITION_INPUTS.commissionRate;
  const rateFraction = rate / 100;

  const result = {};
  for (const key of LINE_KEYS) {
    const target = parseFloat(targets?.[key]) || 0;
    if (target > 0) {
      result[key] = {
        targetAPI:    target / rateFraction,
        seeded:       true,
        seedSource:   target,
      };
    } else {
      result[key] = {
        targetAPI:  0,
        seeded:     false,
        seedSource: 0,
      };
    }
  }
  return result;
}

// ── Derived display values ────────────────────────────────────────────────────

const DEFAULT_AVG_POLICY = DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI; // 12 000

/** derivedApps — targetAPI ÷ avgPolicyAPI (matches goalDecomposition single source). */
export function derivedApps(targetAPI, avgPolicyAPI) {
  const avg = parseFloat(avgPolicyAPI) || DEFAULT_AVG_POLICY;
  const api = parseFloat(targetAPI) || 0;
  return avg > 0 ? api / avg : 0;
}

/** derivedCommission — targetAPI × (commissionRate / 100). */
export function derivedCommission(targetAPI, commissionRate) {
  const rate = parseFloat(commissionRate) || DEFAULT_DECOMPOSITION_INPUTS.commissionRate;
  return (parseFloat(targetAPI) || 0) * (rate / 100);
}

// ── Percent / Direct recompute ────────────────────────────────────────────────

/**
 * totalEnabledAPI — sum of targetAPI for enabled lines only.
 */
export function totalEnabledAPI(lines) {
  return LINE_KEYS.reduce(
    (sum, k) => sum + (lines[k]?.enabled ? (parseFloat(lines[k]?.targetAPI) || 0) : 0),
    0,
  );
}

/**
 * recomputePct — given a set of lines with targetAPI, recompute each line's
 * pct share (enabled lines only). Uses last-line rounding absorption so pcts
 * sum to exactly 100.
 *
 * @param {object} lines  — map of line objects { targetAPI, enabled, ... }
 * @returns {object}      — same shape with pct filled in
 */
export function recomputePct(lines) {
  const total = totalEnabledAPI(lines);
  const enabledKeys = LINE_KEYS.filter((k) => lines[k]?.enabled);
  const result = { ...lines };

  if (total === 0 || enabledKeys.length === 0) {
    for (const k of LINE_KEYS) {
      result[k] = { ...lines[k], pct: lines[k]?.enabled ? 0 : 0 };
    }
    return result;
  }

  // Raw pcts (2 decimal places), then absorb rounding in last enabled line.
  const rawPcts = {};
  let sumRounded = 0;
  for (let i = 0; i < enabledKeys.length; i++) {
    const k = enabledKeys[i];
    const api = parseFloat(lines[k]?.targetAPI) || 0;
    if (i < enabledKeys.length - 1) {
      const p = Math.round((api / total) * 10000) / 100; // 2 dp
      rawPcts[k] = p;
      sumRounded += p;
    } else {
      rawPcts[k] = Math.round((100 - sumRounded) * 100) / 100;
    }
  }

  for (const k of LINE_KEYS) {
    result[k] = { ...lines[k], pct: lines[k]?.enabled ? (rawPcts[k] ?? 0) : 0 };
  }
  return result;
}

/**
 * applyPctToLines — given a totalAPI and per-line pcts, set each line's
 * targetAPI = totalAPI × (pct / 100). Does NOT touch disabled lines.
 */
export function applyPctToLines(lines, totalAPI) {
  const total = parseFloat(totalAPI) || 0;
  const result = { ...lines };
  for (const k of LINE_KEYS) {
    if (!lines[k]?.enabled) {
      result[k] = { ...lines[k], targetAPI: 0 };
      continue;
    }
    const pct = parseFloat(lines[k]?.pct) || 0;
    result[k] = { ...lines[k], targetAPI: (total * pct) / 100 };
  }
  return result;
}

/**
 * switchToDirectMode — convert from % mode to Direct.
 * Preserves targetAPI exactly (only drops the total-field concept).
 * Recomputes pct as read-soft labels from the current targetAPI values.
 */
export function switchToDirectMode(lines) {
  return recomputePct(lines);
}

/**
 * switchToPercentMode — convert from Direct to % mode.
 * Sets totalAPI = Σ enabled targetAPI, then recomputes pct.
 * Preserves targetAPI (no money changes).
 */
export function switchToPercentMode(lines) {
  return recomputePct(lines);
}

// ── Sum-to-100 last-edited absorption ────────────────────────────────────────

/**
 * absorbRounding — given a pct input on `editedKey`, redistribute the remainder
 * (100 − editedPct) proportionally among other enabled lines, or if only two
 * enabled lines, assign remainder to the other one.
 *
 * Returns a new pcts object (key → number).
 */
export function absorbRounding(currentPcts, editedKey, newEditedPct, enabledKeys) {
  const clampedPct = Math.min(100, Math.max(0, parseFloat(newEditedPct) || 0));
  const otherKeys = enabledKeys.filter((k) => k !== editedKey);

  if (otherKeys.length === 0) {
    // Only one enabled line — it gets 100.
    return { ...currentPcts, [editedKey]: 100 };
  }

  const remainder = 100 - clampedPct;
  const prevOtherSum = otherKeys.reduce((s, k) => s + (parseFloat(currentPcts[k]) || 0), 0);

  const newPcts = { ...currentPcts, [editedKey]: clampedPct };

  if (prevOtherSum === 0) {
    // Split remainder equally among others.
    const share = remainder / otherKeys.length;
    for (const k of otherKeys) newPcts[k] = Math.round(share * 100) / 100;
  } else {
    // Proportional redistribution among others.
    for (let i = 0; i < otherKeys.length; i++) {
      const k = otherKeys[i];
      const prop = (parseFloat(currentPcts[k]) || 0) / prevOtherSum;
      if (i < otherKeys.length - 1) {
        newPcts[k] = Math.round(prop * remainder * 100) / 100;
      } else {
        // Last-line absorbs rounding.
        const assigned = otherKeys.slice(0, -1).reduce((s, kk) => s + newPcts[kk], 0);
        newPcts[k] = Math.round((100 - clampedPct - assigned) * 100) / 100;
      }
    }
  }

  return newPcts;
}

// ── Scaffold ──────────────────────────────────────────────────────────────────

/** blankLines — scaffolded line objects (all zeroed, all enabled). */
export function blankLines() {
  return Object.fromEntries(
    LINE_KEYS.map((k) => [k, { targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true }]),
  );
}

/**
 * enrichLines — attach derivedApps + derivedCommission to each line.
 * Call after any targetAPI change before rendering.
 */
export function enrichLines(lines, commissionRate, avgPolicyAPI) {
  const result = {};
  for (const k of LINE_KEYS) {
    const api = parseFloat(lines[k]?.targetAPI) || 0;
    result[k] = {
      ...lines[k],
      derivedApps:       derivedApps(api, avgPolicyAPI),
      derivedCommission: derivedCommission(api, commissionRate),
    };
  }
  return result;
}
