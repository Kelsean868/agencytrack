import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { seedEvenSplit } from '../lib/monthlyPlanMath';

/**
 * createMonthlyPlan — idempotent scaffold for the agent's monthly plan.
 *
 * If a doc already exists for this year, returns it untouched (the allocator
 * modal's re-open path). Otherwise scaffolds an even split over anchorAPI.
 *
 * anchorAPI is the year-plan total resolved by the caller — the service does
 * not chain-read the yearPlan (caller responsibility per brief D1).
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {number|string} year
 * @param {number} anchorAPI — full TTD annual target from the loaded yearPlan
 * @returns {Promise<{ id:string, [key:string]: any }>}
 */
export async function createMonthlyPlan(tenantId, uid, year, anchorAPI) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }
  const anchor = parseFloat(anchorAPI) || 0;

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'monthlyPlan', String(parsedYear));
  const existing = await getDoc(docRef);
  if (existing.exists()) return { id: existing.id, ...existing.data() };

  const payload = {
    year: parsedYear,
    tenantId,
    uid,
    targets: seedEvenSplit(anchor),
    split: 'even',
    status: 'draft',
    anchorAPI: anchor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(docRef, payload);
  return { id: String(parsedYear), ...payload };
}

/**
 * getMonthlyPlan — fetch the monthly plan doc for a given year.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {number|string} year
 * @returns {Promise<{ id:string, [key:string]: any } | null>}
 */
export async function getMonthlyPlan(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) return null;

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'monthlyPlan', String(parsedYear));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * saveMonthlyPlan — write updated targets and split. Always status:'draft'.
 *
 * Caller guarantees Σ targets === anchorAPI via the balance helper.
 * The service re-validates length === 12 and all-numeric.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {number|string} year
 * @param {number[]} targets — 12 full-TTD numbers
 * @param {'even'|'custom'} split
 * @returns {Promise<void>}
 */
export async function saveMonthlyPlan(tenantId, uid, year, targets, split) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }
  if (!Array.isArray(targets) || targets.length !== 12) {
    throw new Error('targets must be an array of exactly 12 values');
  }
  const sanitized = targets.map((v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) throw new Error('each target must be a finite number');
    return n;
  });

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'monthlyPlan', String(parsedYear));
  await updateDoc(docRef, {
    targets: sanitized,
    split: split === 'even' ? 'even' : 'custom',
    status: 'draft',
    updatedAt: serverTimestamp(),
  });
}
