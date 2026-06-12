import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

export const LINE_KEYS = ['life', 'ah', 'property', 'motor'];

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

/**
 * saveYearPlan — write the allocator's line data + licenseProfile snapshot at
 * status:'draft'. Creates the doc if it doesn't exist yet, otherwise updates
 * the lines/licenseProfile in-place (preserving any Slice-3+ fields already
 * on the doc).
 *
 * Each line: { targetAPI, pct, derivedApps, derivedCommission, enabled }.
 * All numeric fields are parseFloat-enforced before write.
 */
export async function saveYearPlan(tenantId, uid, year, lines, licenseProfile) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const profile = LICENSE_PROFILES.includes(licenseProfile) ? licenseProfile : 'composite';
  const docRef  = doc(db, 'tenants', tenantId, 'users', uid, 'yearPlan', String(parsedYear));

  const sanitizedLines = {};
  for (const k of LINE_KEYS) {
    const line = lines[k] ?? {};
    sanitizedLines[k] = {
      targetAPI:         parseFloat(line.targetAPI)         || 0,
      pct:               parseFloat(line.pct)               || 0,
      derivedApps:       parseFloat(line.derivedApps)       || 0,
      derivedCommission: parseFloat(line.derivedCommission) || 0,
      enabled:           line.enabled !== false,
    };
  }

  const existing = await getDoc(docRef);
  if (!existing.exists()) {
    const payload = {
      year: parsedYear,
      tenantId,
      uid,
      licenseProfile: profile,
      status: 'draft',
      lines: sanitizedLines,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
    return { id: String(parsedYear), ...payload };
  }

  await updateDoc(docRef, {
    lines:          sanitizedLines,
    licenseProfile: profile,
    status:         'draft',
    updatedAt:      serverTimestamp(),
    updatedBy:      uid,
  });

  const updated = await getDoc(docRef);
  return { id: updated.id, ...updated.data() };
}
