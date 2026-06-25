import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

// Direction 1.5 (PR-U1): the canonical loop line taxonomy is the allocator's
// product-blessed 3-line model. `general` subsumes the legacy property+motor
// lines (award-neutral, total-preserving). Every yearPlan reader adopts this
// shared constant — see GamePlanV2/index.jsx (hub total) and ReviewCommitModal.
export const LINE_KEYS = ['life', 'ah', 'general'];

export const LICENSE_PROFILES = ['composite', 'life_only', 'general_only'];

// Lines that can carry per-product detail (mirrors the allocator's drillable set).
const PRODUCT_LINE_KEYS = ['life', 'general'];
const MAX_LINE_PRODUCTS = 4;

export function resolveLicenseProfile(userDoc) {
  const p = userDoc?.licenseProfile;
  return LICENSE_PROFILES.includes(p) ? p : 'composite';
}

// Sanitize a products array onto the additive { name, api, rate } shape (≤4).
// Numeric fields parseFloat-enforced; non-arrays / empty → [].
function sanitizeProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.slice(0, MAX_LINE_PRODUCTS).map((p) => ({
    name: typeof p?.name === 'string' ? p.name : '',
    api:  parseFloat(p?.api)  || 0,
    rate: parseFloat(p?.rate) || 0,
  }));
}

const LINE_SCAFFOLD = () => ({
  targetAPI: 0,
  pct: 0,
  derivedApps: 0,
  derivedCommission: 0,
  enabled: true,
  // Additive (Direction 1.5) — per-line commission rate + ≤4 named products.
  rate: 0,
  products: [],
});

const BLANK_SCAFFOLD = (tenantId, uid, year, licenseProfile) => ({
  year,
  tenantId,
  uid,
  licenseProfile,
  status: 'draft',
  lines: {
    life:    LINE_SCAFFOLD(),
    ah:      LINE_SCAFFOLD(),
    general: LINE_SCAFFOLD(),
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
 * Each line: { targetAPI, pct, derivedApps, derivedCommission, enabled,
 * rate, products: [{ name, api, rate }] }. `rate`/`products` are additive
 * (Direction 1.5) and only meaningful on the product lines (life/general).
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
      rate:              parseFloat(line.rate)              || 0,
      products:          PRODUCT_LINE_KEYS.includes(k) ? sanitizeProducts(line.products) : [],
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
  return { id: String(parsedYear) };
}
