import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function getGoals(tenantId, agentId) {
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getCompanyMinimums(tenantId) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return { annualAPI: 200000, annualApps: 42, persistency: 90 };
}

// Write helper for the tenant_admin Company Config surface (Design System v2 — B5).
// Only `annualAPI` is editable in B5; other fields on the doc (`annualApps`,
// `persistency`) are preserved via merge. Validation: positive number, <=
// 10,000,000 (10x Agent of the Year aspirational individual goal — basis
// documented in B5 PR description).
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

  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  await setDoc(ref, {
    annualAPI,
    updatedBy,
    updatedAt: serverTimestamp(),
  }, { merge: true });
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

  // Personal agent goals — enforce company floor before writing
  const hasPersonal =
    'personalAnnualAPI' in data ||
    'personalAnnualApps' in data ||
    'personalAnnualPersistency' in data;

  if (hasPersonal) {
    const mins = await getCompanyMinimums(tenantId);
    if ('personalAnnualAPI' in data && p(data.personalAnnualAPI) < mins.annualAPI) {
      throw new Error(`Annual API must be at least TTD ${mins.annualAPI.toLocaleString()} (company minimum).`);
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

// ── Goal Hierarchy ────────────────────────────────────────────────────────────

export async function getGoalHierarchy(tenantId, unitId, year, agentId) {
  const [mins, branchDoc, unitDoc, personalDoc] = await Promise.all([
    getCompanyMinimums(tenantId).catch(() => null),
    getBranchGoals(tenantId, year).catch(() => null),
    unitId ? getUnitGoals(tenantId, unitId, year).catch(() => null) : Promise.resolve(null),
    agentId ? getGoals(tenantId, agentId).catch(() => null) : Promise.resolve(null),
  ]);

  const p = (v) => (parseFloat(v) > 0 ? parseFloat(v) : null);

  const companyFloor = mins ? { api: p(mins.annualAPI), apps: p(mins.annualApps) } : null;

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

  return { companyFloor, branchTarget, unitTarget, personal };
}
