import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

// Role → rank map mirrors the Firestore rules cnRoleRank() function.
// Rank determines which notes a caller can see (callerRank >= note.authorRoleRank).
const ROLE_RANKS = {
  unit_manager:   1,
  branch_manager: 2,
  sales_manager:  3,
  tenant_admin:   4,
  platform_admin: 5,
};

export const COACHING_CATEGORIES = [
  { value: 'observation', label: 'Observation' },
  { value: 'goal',        label: 'Goal' },
  { value: 'concern',     label: 'Concern' },
  { value: 'win',         label: 'Win' },
  { value: 'action_item', label: 'Action Item' },
];

export function getRoleRank(role) {
  return ROLE_RANKS[role] ?? 0;
}

function notesRef(tenantId, agentId) {
  return collection(db, `tenants/${tenantId}/users/${agentId}/coachingNotes`);
}

/**
 * Add a coaching note for an agent. authorRoleRank is derived server-side from
 * the caller's role and denormalized for rule-enforced rank-based visibility.
 */
export async function addCoachingNote({
  tenantId,
  agentId,
  agentUnitId,
  authorUid,
  authorName,
  authorRole,
  category,
  body,
}) {
  const trimmedBody = body.trim().slice(0, 2000);
  await addDoc(notesRef(tenantId, agentId), {
    agentId,
    tenantId,
    agentUnitId,
    authorUid,
    authorName,
    authorRole,
    authorRoleRank: getRoleRank(authorRole),
    category,
    body: trimmedBody,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * List coaching notes visible to the caller for a specific agent.
 * unit_manager: restricted to notes where agentUnitId == callerUid, rank <= callerRank.
 * branch_manager and above: all notes with authorRoleRank <= callerRank.
 * Results are ordered newest-first.
 */
export async function getCoachingNotes({ tenantId, agentId, callerRole, callerUid }) {
  const callerRank = getRoleRank(callerRole);
  const ref = notesRef(tenantId, agentId);

  let q;
  if (callerRole === 'unit_manager') {
    q = query(
      ref,
      where('agentUnitId', '==', callerUid),
      where('authorRoleRank', '<=', callerRank),
      orderBy('authorRoleRank', 'asc'),
      orderBy('createdAt', 'desc'),
    );
  } else {
    q = query(
      ref,
      where('authorRoleRank', '<=', callerRank),
      orderBy('authorRoleRank', 'asc'),
      orderBy('createdAt', 'desc'),
    );
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Update the body and/or category of a note the caller authored.
 * The Firestore rule enforces authorUid == caller; this is an additional
 * client-side guard so callers never accidentally submit edits on notes they don't own.
 */
export async function updateCoachingNote({ tenantId, agentId, noteId, body, category }) {
  const trimmedBody = body.trim().slice(0, 2000);
  await updateDoc(
    doc(db, `tenants/${tenantId}/users/${agentId}/coachingNotes/${noteId}`),
    { body: trimmedBody, category, updatedAt: serverTimestamp() },
  );
}
