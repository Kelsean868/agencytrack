import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Compliance v2 Slice 2 — client wrapper for the sendComplianceNudge CF plus
// the deterministic-ID cooldown reads that power the manager cooldown chip.
//
// The CF writes the nudge record + the (existing-schema) bell notification +
// the email + the audit row. Reads here are deterministic-ID GETs on the
// nudges collection ONLY — never a list query, never an index (the D2 rules
// have no list arm by design).

export const NUDGE_TYPE = 'compliance.filing.nudge';
export const PLAN_NUDGE_TYPE = 'compliance.plan.nudge'; // S3 plan-adoption lens
/** Maximum audience size enforced by the sendComplianceNudge CF. */
export const MAX_NUDGE_AUDIENCE = 50;

/**
 * Fire a nudge at one or more agents for a given week.
 * @param {string[]} audienceUids  1..50 agent uids (the filtered exception set)
 * @param {string}   weekStart     YYYY-MM-DD Sunday
 * @param {string}   type          nudge type (filing | plan); defaults to filing
 * @returns CF result { success, type, weekStart, count, results }
 */
export async function sendComplianceNudge(audienceUids, weekStart, type = NUDGE_TYPE) {
  if (!Array.isArray(audienceUids) || audienceUids.length === 0) {
    throw new Error('audienceUids must be a non-empty array');
  }
  if (audienceUids.length > MAX_NUDGE_AUDIENCE) {
    throw new Error(`audienceUids exceeds limit of ${MAX_NUDGE_AUDIENCE} (got ${audienceUids.length})`);
  }
  const fn = httpsCallable(getFunctions(), 'sendComplianceNudge');
  const result = await fn({ audienceUids, type, weekStart });
  return result.data;
}

// Normalize a Firestore timestamp (or millis/seconds shape) to epoch millis.
function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Deterministic-ID GET fan-out for the cooldown chip. Reads
 * nudges/{uid}_{type}_{weekStart} for each uid in the (small) exception set.
 * A denied/absent GET resolves to null (treated as "not nudged"). No list query.
 * @param {string} type  nudge type (filing | plan); defaults to filing
 * @returns {Promise<Object>} map of uid -> createdAt epoch millis | null
 */
export async function getNudgeRecords(tenantId, audienceUids, weekStart, type = NUDGE_TYPE) {
  const out = {};
  await Promise.all((audienceUids ?? []).map(async (uid) => {
    const id = `${uid}_${type}_${weekStart}`;
    try {
      const snap = await getDoc(doc(db, `tenants/${tenantId}/nudges/${id}`));
      out[uid] = snap.exists() ? tsToMillis(snap.data().createdAt) : null;
    } catch {
      out[uid] = null;
    }
  }));
  return out;
}
