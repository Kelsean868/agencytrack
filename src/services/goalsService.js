import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../utils/weeklyActivityFloors';
import {
  DEFAULT_TENURE_API_FLOORS,
  FLAT_ANNUAL_API_FALLBACK,
  resolveAnnualAPIFloor,
} from '../utils/tenureFloors';

export async function getGoals(tenantId, agentId) {
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Returns the tenant's `config/companyMinimums` doc with built-in defaults
// filled in for any missing field. Two blocks are shallow-merged on top of
// the stored doc: `weeklyActivityFloors` (Tatil workshop 2026-05-19) and
// `tenureApiFloors` (head-of-sales slide 2026-05-19, provisional — see
// utils/tenureFloors.js). For both, present keys from Firestore override
// defaults; absent keys fall through.
// `usingDefaultMinimums()` heuristic remains intact — it keys off
// `updatedBy`/`updatedAt`, which the defaults never carry.
export async function getCompanyMinimums(tenantId) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  const snap = await getDoc(ref);
  const stored = snap.exists() ? snap.data() : {};
  return {
    annualAPI:   stored.annualAPI   ?? 200000,
    annualApps:  stored.annualApps  ?? 42,
    persistency: stored.persistency ?? 90,
    ...stored,
    weeklyActivityFloors: {
      ...DEFAULT_WEEKLY_ACTIVITY_FLOORS,
      ...(stored.weeklyActivityFloors ?? {}),
    },
    tenureApiFloors: {
      ...DEFAULT_TENURE_API_FLOORS,
      ...(stored.tenureApiFloors ?? {}),
    },
  };
}

// Write helper for the tenant_admin Company Config surface (Design System v2 — B5;
// extended Track E(b) to include weeklyActivityFloors).
//
// `data.annualAPI` — required; positive number ≤ 10,000,000.
// `data.weeklyActivityFloors` — optional object. When present, each key is validated:
//   - all keys: parseFloat, must be >= 0.
//   - non-`api` keys: must be a whole number (integer).
//   - `api` key: positive number (decimals OK).
//   Absent = floor block unchanged (merge: true preserves existing doc value).
//
// Audit trail (locked, see B5 plan §7): `updatedBy` (uid) and `updatedAt`
// (server timestamp) are written on the doc itself. No separate audit
// collection in B5 — audit log infrastructure is deferred to P11.
export async function setCompanyMinimums(tenantId, data, updatedBy) {
  const annualAPI = parseFloat(data.annualAPI);
  if (!Number.isFinite(annualAPI) || annualAPI <= 0) {
    throw new Error('Company minimum API must be a positive number.');
  }
  if (annualAPI > 10000000) {
    throw new Error('Company minimum API cannot exceed TTD 10,000,000.');
  }

  const payload = { annualAPI, updatedBy, updatedAt: serverTimestamp() };

  // Optional weeklyActivityFloors block — validate and include when provided.
  if (data.weeklyActivityFloors && typeof data.weeklyActivityFloors === 'object') {
    const validated = {};
    for (const [key, rawVal] of Object.entries(data.weeklyActivityFloors)) {
      const val = parseFloat(rawVal);
      if (!Number.isFinite(val) || val < 0) {
        throw new Error(`Weekly floor "${key}" must be a non-negative number.`);
      }
      if (key === 'api') {
        if (val <= 0) throw new Error('Weekly API floor must be a positive number.');
      } else {
        if (!Number.isInteger(val)) {
          throw new Error(`Weekly floor "${key}" must be a whole number.`);
        }
      }
      validated[key] = val;
    }
    payload.weeklyActivityFloors = validated;
  }

  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  await setDoc(ref, payload, { merge: true });
}

export async function setGoals(tenantId, agentId, data, setBy, setByName) {
  const p = (v) => parseFloat(v) || 0;
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);

  const payload = { agentId, tenantId, setBy, setByName, updatedAt: serverTimestamp() };

  // Track C C3: passthrough audit fields for bulk CSV import. The single-user
  // CareerPortal "Edit My Goals" flow never sets these — behavior unchanged.
  // merge: true semantics preserve manager-set targets on the same doc.
  if (typeof data.csvImportBatchId === 'string' && data.csvImportBatchId) {
    payload.csvImportBatchId = data.csvImportBatchId;
  }
  if (data.importedFromCsv === true) {
    payload.importedFromCsv = true;
  }

  // Manager target fields — write all if any target* key is present
  if ('targetAnnualAPI' in data || 'targetWeeklyAPI' in data) {
    payload.targetAnnualAPI         = p(data.targetAnnualAPI);
    payload.targetAnnualApps        = p(data.targetAnnualApps);
    payload.targetAnnualPersistency = p(data.targetAnnualPersistency);
    payload.targetWeeklyAPI         = p(data.targetWeeklyAPI);
    payload.targetWeeklyApps        = p(data.targetWeeklyApps);
    payload.targetWeeklyDials       = p(data.targetWeeklyDials);
    payload.targetWeeklyFFI         = p(data.targetWeeklyFFI);
    payload.notes                   = String(data.notes ?? '');
  }

  // Personal agent goals — enforce company floor before writing. Annual API
  // floor is resolved per-agent from contractStartDate via the tenure band
  // table (utils/tenureFloors.js); missing/invalid date falls back to flat
  // 200k via FLAT_ANNUAL_API_FALLBACK. Annual Apps + Persistency stay flat.
  const hasPersonal =
    'personalAnnualAPI' in data ||
    'personalAnnualApps' in data ||
    'personalAnnualPersistency' in data;

  if (hasPersonal) {
    const mins = await getCompanyMinimums(tenantId);
    const agentSnap = await getDoc(doc(db, `tenants/${tenantId}/users/${agentId}`)).catch(() => null);
    const contractStartDate = agentSnap?.exists() ? agentSnap.data().contractStartDate : null;
    const annualFloor = resolveAnnualAPIFloor({
      contractStartDate,
      tenureApiFloors: mins.tenureApiFloors,
      fallback: FLAT_ANNUAL_API_FALLBACK,
    });

    if ('personalAnnualAPI' in data && p(data.personalAnnualAPI) < annualFloor) {
      throw new Error(`Annual API must be at least TTD ${annualFloor.toLocaleString()} (company minimum).`);
    }
    if ('personalAnnualApps' in data && p(data.personalAnnualApps) < mins.annualApps) {
      throw new Error(`Annual Apps must be at least ${mins.annualApps} (company minimum).`);
    }
    if ('personalAnnualPersistency' in data && p(data.personalAnnualPersistency) < mins.persistency) {
      throw new Error(`Persistency must be at least ${mins.persistency}% (company minimum).`);
    }
    if ('personalAnnualAPI' in data)         payload.personalAnnualAPI         = p(data.personalAnnualAPI);
    if ('personalAnnualApps' in data)        payload.personalAnnualApps        = p(data.personalAnnualApps);
    if ('personalAnnualPersistency' in data) payload.personalAnnualPersistency = p(data.personalAnnualPersistency);
  }

  // Playground assumption fields
  const pgKeys = [
    'playgroundIncomeGoal', 'playgroundTaxRate', 'playgroundRenewalIncome',
    'playgroundCommissionRate', 'playgroundAvgPolicyAPI', 'playgroundPersistencyRate',
    'playgroundCiToSaleRatio', 'playgroundDialsToCIRatio', 'playgroundProspectRatio',
  ];
  pgKeys.forEach((key) => {
    if (key in data) payload[key] = p(data[key]);
  });

  await setDoc(ref, payload, { merge: true });
}

// ── Unit Goals ────────────────────────────────────────────────────────────────

export async function getUnitGoals(tenantId, unitId, year) {
  const ref = doc(db, `tenants/${tenantId}/unitGoals/${unitId}_${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setUnitGoals(tenantId, unitId, year, targets, meta) {
  const p = (v) => parseFloat(v) || 0;
  const payload = {
    unitId, year, tenantId,
    api:  p(targets.api),
    apps: p(targets.apps),
    setBy:     meta.setBy,
    setByName: meta.setByName,
    setByRole: meta.setByRole,
    setAt:     serverTimestamp(),
  };
  if (p(targets.ffiConducted) > 0) payload.ffiConducted = p(targets.ffiConducted);
  if (p(targets.ciConducted)  > 0) payload.ciConducted  = p(targets.ciConducted);
  if (p(targets.dials)        > 0) payload.dials         = p(targets.dials);

  await setDoc(doc(db, `tenants/${tenantId}/unitGoals/${unitId}_${year}`), payload);
}

// ── Branch Goals ──────────────────────────────────────────────────────────────

export async function getBranchGoals(tenantId, year) {
  const ref = doc(db, `tenants/${tenantId}/branchGoals/${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setBranchGoals(tenantId, year, targets, meta) {
  const p = (v) => parseFloat(v) || 0;
  const payload = {
    year, tenantId,
    api:  p(targets.api),
    apps: p(targets.apps),
    setBy:     meta.setBy,
    setByName: meta.setByName,
    setAt:     serverTimestamp(),
  };
  if (p(targets.ffiConducted) > 0) payload.ffiConducted = p(targets.ffiConducted);
  if (p(targets.ciConducted)  > 0) payload.ciConducted  = p(targets.ciConducted);
  if (p(targets.dials)        > 0) payload.dials         = p(targets.dials);

  await setDoc(doc(db, `tenants/${tenantId}/branchGoals/${year}`), payload);
}

// ── Sales Manager Goals ───────────────────────────────────────────────────────

export async function getSalesManagerGoals(tenantId, smUid, year) {
  const ref = doc(db, `tenants/${tenantId}/salesManagerGoals/${smUid}_${year}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setSalesManagerGoals(tenantId, smUid, year, targets, meta) {
  const p = (v) => parseFloat(v) || 0;
  const payload = {
    smUid, year, tenantId,
    api:  p(targets.api),
    apps: p(targets.apps),
    setBy:     meta.setBy,
    setByName: meta.setByName,
    setAt:     serverTimestamp(),
  };
  if (p(targets.ffiConducted) > 0) payload.ffiConducted = p(targets.ffiConducted);
  if (p(targets.ciConducted)  > 0) payload.ciConducted  = p(targets.ciConducted);
  if (p(targets.dials)        > 0) payload.dials         = p(targets.dials);

  await setDoc(doc(db, `tenants/${tenantId}/salesManagerGoals/${smUid}_${year}`), payload);
}

// Resolves SM uid for single-SM tenants by querying users where role == 'sales_manager'.
// Returns null when no SM exists; returns first uid + console.warn when >1 SM found.
export async function getSalesManagerUid(tenantId) {
  const q = query(
    collection(db, `tenants/${tenantId}/users`),
    where('role', '==', 'sales_manager'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  if (snap.size > 1) {
    console.warn(`getSalesManagerUid: ${snap.size} sales_manager docs found for tenant ${tenantId}; using first`);
  }
  return snap.docs[0].id;
}

// ── Goal Hierarchy ────────────────────────────────────────────────────────────

export async function getGoalHierarchy(tenantId, unitId, year, agentId, smUid = null) {
  const [mins, branchDoc, unitDoc, personalDoc, agentSnap, smDoc] = await Promise.all([
    getCompanyMinimums(tenantId).catch(() => null),
    getBranchGoals(tenantId, year).catch(() => null),
    unitId ? getUnitGoals(tenantId, unitId, year).catch(() => null) : Promise.resolve(null),
    agentId ? getGoals(tenantId, agentId).catch(() => null) : Promise.resolve(null),
    agentId
      ? getDoc(doc(db, `tenants/${tenantId}/users/${agentId}`)).catch(() => null)
      : Promise.resolve(null),
    smUid ? getSalesManagerGoals(tenantId, smUid, year).catch(() => null) : Promise.resolve(null),
  ]);

  const p = (v) => (parseFloat(v) > 0 ? parseFloat(v) : null);

  // Company Floor API is resolved per-agent from contractStartDate against
  // the tenure band table; missing/invalid date → flat 200k fallback.
  // Apps floor stays flat. When the agent doc can't be loaded, fall through
  // to the flat fallback so the hierarchy still renders something useful.
  const contractStartDate = agentSnap?.exists?.() ? agentSnap.data().contractStartDate : null;
  const resolvedAnnualFloor = mins
    ? resolveAnnualAPIFloor({
        contractStartDate,
        tenureApiFloors: mins.tenureApiFloors,
        fallback: FLAT_ANNUAL_API_FALLBACK,
      })
    : null;
  const companyFloor = mins ? { api: p(resolvedAnnualFloor), apps: p(mins.annualApps) } : null;

  const branchTarget = branchDoc ? {
    api:          p(branchDoc.api),
    apps:         p(branchDoc.apps),
    ffiConducted: p(branchDoc.ffiConducted),
    ciConducted:  p(branchDoc.ciConducted),
    dials:        p(branchDoc.dials),
  } : null;

  const unitTarget = unitDoc ? {
    api:          p(unitDoc.api),
    apps:         p(unitDoc.apps),
    ffiConducted: p(unitDoc.ffiConducted),
    ciConducted:  p(unitDoc.ciConducted),
    dials:        p(unitDoc.dials),
  } : null;

  const personal = personalDoc ? {
    api:          p(personalDoc.personalAnnualAPI),
    apps:         p(personalDoc.personalAnnualApps),
    ffiConducted: null,
    ciConducted:  null,
    dials:        null,
  } : null;

  const salesManagerTarget = smDoc ? {
    api:          p(smDoc.api),
    apps:         p(smDoc.apps),
    ffiConducted: p(smDoc.ffiConducted),
    ciConducted:  p(smDoc.ciConducted),
    dials:        p(smDoc.dials),
  } : null;

  return { companyFloor, branchTarget, salesManagerTarget, unitTarget, personal };
}
