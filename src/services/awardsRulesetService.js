import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';

export async function getAwardsRuleset(tenantId, year = 2026) {
  const ref = doc(db, `tenants/${tenantId}/config/awardsRuleset_${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : DEFAULT_RULESET_2026;
}

const REQUIRED_GROUPS = Object.keys(DEFAULT_RULESET_2026);

// Recursively validates all numeric scalar fields are finite and non-negative.
// Skips arrays (P-b scope), booleans, and known string-only fields.
function validateNumericFields(obj, path) {
  if (Array.isArray(obj) || obj === null || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (['prize', 'id', 'name'].includes(k)) continue;
    if (typeof v === 'boolean') continue;
    if (Array.isArray(v)) continue;
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
