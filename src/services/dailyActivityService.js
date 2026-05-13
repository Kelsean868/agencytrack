/**
 * Daily activity service — CRUD for the per-agent dailyActivity subcollection.
 *
 * Path: tenants/{tenantId}/users/{userId}/dailyActivity/{date}
 *
 * Doc id is the date string (`YYYY-MM-DD`) so re-saving the same day is an
 * upsert. Aggregator (functions/aggregators/sundayDailyToWeekly.js) reads
 * this collection on Sunday 23:00 TT and writes a draft submission.
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getSundayOf } from '../lib/schema/dailyActivity';

function dailyDocPath(tenantId, uid, date) {
  return `tenants/${tenantId}/users/${uid}/dailyActivity/${date}`;
}

function dailyCollectionPath(tenantId, uid) {
  return `tenants/${tenantId}/users/${uid}/dailyActivity`;
}

export async function saveDailyEntry(tenantId, uid, agentName, date, entry) {
  const ref = doc(db, dailyDocPath(tenantId, uid, date));
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...entry,
      date,
      weekStarting: getSundayOf(date),
      agentId: uid,
      agentName,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function getDailyEntry(tenantId, uid, date) {
  const ref = doc(db, dailyDocPath(tenantId, uid, date));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getDailyEntriesForWeek(tenantId, uid, weekStarting) {
  const q = query(
    collection(db, dailyCollectionPath(tenantId, uid)),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteDailyEntry(tenantId, uid, date) {
  const ref = doc(db, dailyDocPath(tenantId, uid, date));
  await deleteDoc(ref);
}
