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

/**
 * Fire a nudge at one or more agents for a given week.
 * @param {string[]} audienceUids  1..50 agent uids (the filtered exception set)
 * @param {string}   weekStart     YYYY-MM-DD Sunday
 * @returns CF result { success, type, weekStart, count, results }
 */
export async function sendComplianceNudge(audienceUids, weekStart) {
  const fn = httpsCallable(getFunctions(), 'sendComplianceNudge');
  const result = await fn({ audienceUids, type: NUDGE_TYPE, weekStart });
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
 * nudges/{uid}_{NUDGE_TYPE}_{weekStart} for each uid in the (small) not-in set.
 * A denied/absent GET resolves to null (treated as "not nudged"). No list query.
 * @returns {Promise<Object>} map of uid -> createdAt epoch millis | null
 */
export async function getNudgeRecords(tenantId, audienceUids, weekStart) {
  const out = {};
  await Promise.all((audienceUids ?? []).map(async (uid) => {
    const id = `${uid}_${NUDGE_TYPE}_${weekStart}`;
    try {
      const snap = await getDoc(doc(db, `tenants/${tenantId}/nudges/${id}`));
      out[uid] = snap.exists() ? tsToMillis(snap.data().createdAt) : null;
    } catch {
      out[uid] = null;
    }
  }));
  return out;
}
