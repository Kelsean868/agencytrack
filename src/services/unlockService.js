import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createNotification } from './notificationService';

const MANAGER_ROLES = ['unit_manager', 'branch_manager', 'sales_manager', 'super_admin'];

export async function unlockSubmission(tenantId, submissionId, managerUid, managerName) {
  const userRef = doc(db, `tenants/${tenantId}/users/${managerUid}`);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Manager user doc not found');
  if (!MANAGER_ROLES.includes(userSnap.data().role)) {
    throw new Error('Only managers can unlock submissions');
  }

  const subRef = doc(db, `tenants/${tenantId}/submissions/${submissionId}`);
  const subSnap = await getDoc(subRef);
  if (!subSnap.exists()) throw new Error('Submission not found');
  const subData = subSnap.data();

  await updateDoc(subRef, {
    status: 'draft',
    unlockedBy: managerUid,
    unlockedByName: managerName,
    unlockedAt: serverTimestamp(),
  });

  const agentId = subData.agentId ?? subData.userId;
  if (agentId) {
    await createNotification(tenantId, agentId, {
      type: 'report_unlocked',
      title: 'Report Unlocked',
      body: `${managerName} has unlocked your report for editing. Please resubmit by end of week.`,
    });
  }
}
