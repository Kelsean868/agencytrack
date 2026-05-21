import { db } from '../firebase';
import {
  collection, doc, getDoc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

// Role → rank map mirrors F1's coachingNotesService.
// authorRoleRank governs which calls a caller can see (callerRank >= call.authorRoleRank).
const ROLE_RANKS = {
  unit_manager:   1,
  branch_manager: 2,
  sales_manager:  3,
  tenant_admin:   4,
  platform_admin: 5,
};

export const MEETING_TYPES = [
  { value: 'demonstration', label: 'Demonstration' },
  { value: 'observation',   label: 'Observation' },
  { value: 'collaboration', label: 'Collaboration' },
];

// Provisional taxonomy — Trinidad life insurance domain.
// Flagged in docs/FOLLOW_UPS.md for Track H/G design-time confirmation.
export const NEEDS_COVERED = [
  { value: 'income_protection',        label: 'Income Protection' },
  { value: 'mortgage_or_debt',         label: 'Mortgage / Debt' },
  { value: 'education_funding',        label: 'Education Funding' },
  { value: 'retirement_planning',      label: 'Retirement Planning' },
  { value: 'final_expenses',           label: 'Final Expenses' },
  { value: 'wealth_accumulation',      label: 'Wealth Accumulation' },
  { value: 'critical_illness_or_health', label: 'Critical Illness / Health' },
  { value: 'business_protection',      label: 'Business Protection' },
  { value: 'other',                    label: 'Other' },
];

const MEETING_TYPE_VALUES = MEETING_TYPES.map((m) => m.value);
const NEEDS_COVERED_VALUES = NEEDS_COVERED.map((n) => n.value);

export function getRoleRank(role) {
  return ROLE_RANKS[role] ?? 0;
}

function callsRef(tenantId, agentId) {
  return collection(db, `tenants/${tenantId}/users/${agentId}/jointCalls`);
}

async function resolveBmInfo(tenantId, agentId) {
  const agentSnap = await getDoc(doc(db, `tenants/${tenantId}/users/${agentId}`));
  if (!agentSnap.exists()) return { bmUid: null, agentName: null };
  const agentData = agentSnap.data();
  const agentName = agentData.name ?? agentData.email ?? 'the agent';
  if (!agentData.branchId) return { bmUid: null, agentName };
  const branchSnap = await getDoc(doc(db, `tenants/${tenantId}/branches/${agentData.branchId}`));
  if (!branchSnap.exists()) return { bmUid: null, agentName };
  return { bmUid: branchSnap.data().managerId ?? null, agentName };
}

function trim(str, max) {
  return String(str ?? '').trim().slice(0, max);
}

/**
 * Add a joint-call observation for an agent. authorRoleRank is derived from
 * the caller's role and denormalized for rule-enforced rank-based visibility.
 */
export async function addJointCall({
  tenantId,
  agentId,
  agentUnitId,
  authorUid,
  authorName,
  authorRole,
  appointmentDate,
  appointmentTime,
  appointmentKept,
  nextMeetingDate,
  meetingType,
  needCovered,
  comments,
  saleMade,
  coachingMinutes,
  trainingIdentified,
  prospectInfoId,
}) {
  await addDoc(callsRef(tenantId, agentId), {
    agentId,
    tenantId,
    agentUnitId,
    authorUid,
    authorName,
    authorRole,
    authorRoleRank: getRoleRank(authorRole),
    appointmentDate: trim(appointmentDate, 32),
    appointmentTime: trim(appointmentTime, 16),
    appointmentKept: !!appointmentKept,
    nextMeetingDate: appointmentKept ? '' : trim(nextMeetingDate, 32),
    meetingType,
    needCovered,
    comments: trim(comments, 2000),
    saleMade: !!saleMade,
    coachingMinutes: parseFloat(coachingMinutes) || 0,
    trainingIdentified: trim(trainingIdentified, 1000),
    prospectInfoId: trim(prospectInfoId ?? '', 128),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    const { bmUid, agentName } = await resolveBmInfo(tenantId, agentId);
    if (bmUid && bmUid !== authorUid) {
      await addDoc(collection(db, `tenants/${tenantId}/notifications`), {
        userId: bmUid,
        tenantId,
        type: 'manager_alert',
        title: `Joint call logged for ${agentName}`,
        body: `${authorName} logged a joint-call observation for ${agentName}.`,
        link: null,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('[addJointCall] BM notification failed (best-effort):', err.message);
  }
}

/**
 * List joint-call observations visible to the caller for a specific agent.
 * unit_manager: restricted to calls where agentUnitId == callerUid, rank <= callerRank.
 * branch_manager and above: all calls with authorRoleRank <= callerRank.
 *
 * CRITICAL: orderBy('authorRoleRank','asc') MUST come BEFORE orderBy('createdAt','desc')
 * because the inequality is on authorRoleRank. Otherwise Firestore returns
 * FAILED_PRECONDITION. F1 hit this in smoke — built right from the start here.
 */
export async function getJointCalls({ tenantId, agentId, callerRole, callerUid }) {
  const callerRank = getRoleRank(callerRole);
  const ref = callsRef(tenantId, agentId);

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
 * Update editable fields of a joint-call the caller authored. Rule enforces
 * authorUid == caller; this client-side guard prevents accidental cross-author
 * edits. Only the body-shape fields are updatable — never authorUid/rank/audit.
 */
export async function updateJointCall({
  tenantId,
  agentId,
  callId,
  appointmentDate,
  appointmentTime,
  appointmentKept,
  nextMeetingDate,
  meetingType,
  needCovered,
  comments,
  saleMade,
  coachingMinutes,
  trainingIdentified,
  prospectInfoId,
}) {
  await updateDoc(
    doc(db, `tenants/${tenantId}/users/${agentId}/jointCalls/${callId}`),
    {
      appointmentDate: trim(appointmentDate, 32),
      appointmentTime: trim(appointmentTime, 16),
      appointmentKept: !!appointmentKept,
      nextMeetingDate: appointmentKept ? '' : trim(nextMeetingDate, 32),
      meetingType,
      needCovered,
      comments: trim(comments, 2000),
      saleMade: !!saleMade,
      coachingMinutes: parseFloat(coachingMinutes) || 0,
      trainingIdentified: trim(trainingIdentified, 1000),
      prospectInfoId: trim(prospectInfoId ?? '', 128),
      updatedAt: serverTimestamp(),
    },
  );
}

export { MEETING_TYPE_VALUES, NEEDS_COVERED_VALUES };
