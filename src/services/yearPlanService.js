import { db } from '../firebase';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';

export const LICENSE_PROFILES = ['composite', 'life_only', 'general_only'];

export function resolveLicenseProfile(userDoc) {
  const p = userDoc?.licenseProfile;
  return LICENSE_PROFILES.includes(p) ? p : 'composite';
}

const LINE_SCAFFOLD = () => ({
  targetAPI: 0,
  pct: 0,
  derivedApps: 0,
  derivedCommission: 0,
  enabled: true,
});

const BLANK_SCAFFOLD = (tenantId, uid, year, licenseProfile) => ({
  year,
  tenantId,
  uid,
  licenseProfile,
  status: 'draft',
  lines: {
    life:     LINE_SCAFFOLD(),
    ah:       LINE_SCAFFOLD(),
    property: LINE_SCAFFOLD(),
    motor:    LINE_SCAFFOLD(),
  },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export async function createYearPlan(tenantId, uid, year, licenseProfile = 'composite') {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const profile = LICENSE_PROFILES.includes(licenseProfile) ? licenseProfile : 'composite';

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'yearPlan', String(parsedYear));
  const existing = await getDoc(docRef);
  if (existing.exists()) return { id: existing.id, ...existing.data() };

  const payload = BLANK_SCAFFOLD(tenantId, uid, parsedYear, profile);
  await setDoc(docRef, payload);
  return { id: String(parsedYear), ...payload };
}

export async function getYearPlan(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) return null;

  const docRef = doc(db, 'tenants', tenantId, 'users', uid, 'yearPlan', String(parsedYear));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
