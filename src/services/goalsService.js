import {
  doc, getDoc, getDocs, setDoc, serverTimestamp,
  collection, query, where, documentId,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../utils/weeklyActivityFloors';
import {
  DEFAULT_TENURE_API_FLOORS,
  FLAT_ANNUAL_API_FALLBACK,
  resolveAnnualAPIFloor,
} from '../utils/tenureFloors';
import { PERS_GATE_PCT } from '../lib/persistency/calculations';

export async function getGoals(tenantId, agentId) {
  const ref = doc(db, `tenants/${tenantId}/goals/${agentId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// EFF-007: batched analog of getGoals for roster views. Fetches many agents'
// goal docs in ≤30-id chunks via `documentId() in` (goal doc IDs are the agent
// UIDs — deterministic), replacing the one-get-per-agent N+1 in useTeamRoster.
// Returns `{ [agentId]: goalData }` for agents that HAVE a goal doc; a missing
// key means "no goal set" (callers default to null, matching getGoals). A
// documentId() `in` query needs no composite index.
export async function getGoalsForAgents(tenantId, agentIds) {
  if (!agentIds || agentIds.length === 0) return {};
  const col = collection(db, `tenants/${tenantId}/goals`);
  const batches = [];
  for (let i = 0; i < agentIds.length; i += 30) {
    batches.push(agentIds.slice(i, i + 30));
  }
  const map = {};
  await Promise.all(batches.map(async (batch) => {
    try {
      const snap = await getDocs(query(col, where(documentId(), 'in', batch)));
      snap.docs.forEach((d) => { map[d.id] = d.data(); });
    } catch {
      // Read denied/failed for this batch — skip silently and keep the other
      // batches (mirrors getPersistencyMapForYear's per-batch resilience so one
      // bad ≤30 chunk can't wipe out every agent's goals).
    }
  }));
  return map;
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
    annualApps:  stored.annualApps  ?? 40,
    // DEFAULT ONLY — `stored.persistency` (the tenant's Company Config value)
    // still wins whenever it is set, and the `...stored` spread below preserves
    // that. Defaulting to the award gate is deliberate: absent an explicit
    // tenant policy, the minimum an agent may commit to is the threshold that
    // makes them award-eligible. This is a DIFFERENT concept from the at-risk
    // PERS_FLOOR — do not swap one for the other. Percent scale (the validator
    // below renders `${floor}%` and compares against a 0–100 input).
    persistency: stored.persistency ?? PERS_GATE_PCT,
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

  // Optional workingDaysPerWeek — must be 5 or 6 when provided.
  if (data.workingDaysPerWeek !== undefined) {
    const wd = Number(data.workingDaysPerWeek);
    if (![5, 6].includes(wd)) {
      throw new Error('Working days per week must be 5 or 6.');
    }
    payload.workingDaysPerWeek = wd;
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

  // Manager target fields — write all if any target* key is present.
  // targetLocked: true  → binding floor; agent's personal commitment must be ≥ this target.
  // targetLocked: false → recommended only; does not constrain the agent's personal commitment.
  if ('targetAnnualAPI' in data || 'targetWeeklyAPI' in data) {
    if ('targetLocked' in data) payload.targetLocked = data.targetLocked === true;
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
    const [mins, agentSnap, existingSnap] = await Promise.all([
      getCompanyMinimums(tenantId),
      getDoc(doc(db, `tenants/${tenantId}/users/${agentId}`)),
      getDoc(ref),
    ]);
    const contractStartDate = agentSnap?.exists() ? agentSnap.data().contractStartDate : null;
    const annualFloor = resolveAnnualAPIFloor({
      contractStartDate,
      tenureApiFloors: mins.tenureApiFloors,
      fallback: FLAT_ANNUAL_API_FALLBACK,
    });

    // If the manager set a locked target, it raises the agent's effective floor
    // (max of company floor and locked target). A recommended target (targetLocked: false)
    // is advisory only and does not constrain the personal commitment.
    const existing = existingSnap.exists() ? existingSnap.data() : {};
    const locked = existing.targetLocked === true;

    if ('personalAnnualAPI' in data) {
      const mgr = locked ? (parseFloat(existing.targetAnnualAPI) || 0) : 0;
      const floor = Math.max(annualFloor, mgr);
      if (p(data.personalAnnualAPI) < floor) {
        const src = mgr > annualFloor ? 'manager locked target' : 'company minimum';
        throw new Error(`Annual API must be at least TTD ${floor.toLocaleString()} (${src}).`);
      }
    }
    if ('personalAnnualApps' in data) {
      const mgr = locked ? (parseFloat(existing.targetAnnualApps) || 0) : 0;
      const floor = Math.max(mins.annualApps, mgr);
      if (p(data.personalAnnualApps) < floor) {
        const src = mgr > mins.annualApps ? 'manager locked target' : 'company minimum';
        throw new Error(`Annual Apps must be at least ${floor} (${src}).`);
      }
    }
    if ('personalAnnualPersistency' in data) {
      const mgr = locked ? (parseFloat(existing.targetAnnualPersistency) || 0) : 0;
      const floor = Math.max(mins.persistency, mgr);
      if (p(data.personalAnnualPersistency) < floor) {
        const src = mgr > mins.persistency ? 'manager locked target' : 'company minimum';
        throw new Error(`Persistency must be at least ${floor}% (${src}).`);
      }
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
    locked:    meta?.locked === true,
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
    locked:    meta?.locked === true,
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
    locked:    meta?.locked === true,
    setBy:     meta.setBy,
    setByName: meta.setByName,
    setAt:     serverTimestamp(),
  };
  if (p(targets.ffiConducted) > 0) payload.ffiConducted = p(targets.ffiConducted);
  if (p(targets.ciConducted)  > 0) payload.ciConducted  = p(targets.ciConducted);
  if (p(targets.dials)        > 0) payload.dials         = p(targets.dials);

  await setDoc(doc(db, `tenants/${tenantId}/salesManagerGoals/${smUid}_${year}`), payload);
}

// Resolves SM uid via the resolveSalesManagerUid CF (Admin SDK — bypasses client-side
// rules so agents can call this without a denied users-list query).
export async function getSalesManagerUid(_tenantId) {
  const fn = httpsCallable(functions, 'resolveSalesManagerUid');
  const result = await fn({});
  return result.data?.smUid ?? null;
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
