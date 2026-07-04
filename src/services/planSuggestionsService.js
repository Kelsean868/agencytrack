// PR-B3 — planSuggestions: the manager→agent suggest-back loop (Fork B slice 3).
//
// A manager reading an agent's plan (through the Fork B1 upline arms) raises a
// plan-level suggestion; the agent sees it on their Game Plan hub and marks it
// seen. Suggestions are advice — the agent still commits their own plan.
//
// Collection: /tenants/{tid}/users/{agentId}/planSuggestions/{suggestionId}
//   (auto-id, addDoc). Sibling of yearPlan/monthlyPlan/prospectInfo.
//
// Reads follow the moneyNeeds/planReview posture: a permission-denied read maps
// to a NEUTRAL { unavailable: true } (never an error alarm). Non-permission
// failures rethrow so a real error surfaces.
import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';

const NOTE_CAP = 2000; // coachingNotes precedent

function suggestionsRef(tenantId, agentId) {
  return collection(db, `tenants/${tenantId}/users/${agentId}/planSuggestions`);
}

/**
 * createPlanSuggestion — manager-side. Writes the locked ten-field doc: the
 * caller (raisedBy*) is the manager; agentId/tenantId are path-bound; status
 * starts 'open' and seenAt null (the agent flips both on ack). The note is
 * trimmed and capped at 2000 chars (coachingNotes precedent). year is coerced
 * to an integer to satisfy the rules `year is int` guard.
 */
export async function createPlanSuggestion({
  tenantId,
  agentId,
  year,
  note,
  raisedByUid,
  raisedByName,
  raisedByRole,
}) {
  const trimmedNote = (note ?? '').trim().slice(0, NOTE_CAP);
  await addDoc(suggestionsRef(tenantId, agentId), {
    tenantId,
    agentId,
    year: parseInt(year, 10),
    note: trimmedNote,
    raisedByUid,
    raisedByName,
    raisedByRole,
    status: 'open',
    createdAt: serverTimestamp(),
    seenAt: null,
  });
}

/**
 * listPlanSuggestions — reads an agent's suggestions newest-first (the agent's
 * hub card and, symmetrically, an upline manager). Path-scoped orderBy(createdAt
 * desc) — single-field, index-free. Denied → { unavailable: true, items: [] }
 * (neutral); other failures rethrow.
 */
export async function listPlanSuggestions({ tenantId, agentId }) {
  if (!tenantId || !agentId) return { items: [] };
  try {
    const q = query(suggestionsRef(tenantId, agentId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  } catch (e) {
    if (e?.code === 'permission-denied') return { unavailable: true, items: [] };
    throw e;
  }
}

/**
 * markSuggestionSeen — agent ack (open→seen). Best-effort: a permission-denied
 * write (e.g. already seen, or not the owner) is swallowed and reported false so
 * the hub card never alarms; other failures rethrow. seenAt is a server
 * timestamp — the rules require `seenAt is timestamp`.
 */
export async function markSuggestionSeen({ tenantId, agentId, suggestionId }) {
  try {
    await updateDoc(
      doc(db, `tenants/${tenantId}/users/${agentId}/planSuggestions/${suggestionId}`),
      { status: 'seen', seenAt: serverTimestamp() },
    );
    return true;
  } catch (e) {
    if (e?.code === 'permission-denied') return false;
    throw e;
  }
}
