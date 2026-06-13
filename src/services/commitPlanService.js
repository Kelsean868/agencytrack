import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FLAT_ANNUAL_API_FALLBACK, resolveAnnualAPIFloor } from '../utils/tenureFloors';
import { getCompanyMinimums } from './goalsService';
import { deriveAnnualApps } from '../lib/deriveApps';

export class BelowApiFloorError extends Error {
  constructor(floor, planTotal) {
    super(
      `Plan total (TTD ${planTotal.toLocaleString()}) is below the agent's annual API floor ` +
      `(TTD ${floor.toLocaleString()}). Raise your Year Plan target.`
    );
    this.name = 'BelowApiFloorError';
    this.floor = floor;
    this.planTotal = planTotal;
  }
}

export class BelowAppsFloorError extends Error {
  constructor(floor, actual, avgPolicyAPI) {
    super(
      `Derived apps (${actual.toFixed(1)}) are below the company apps floor ` +
      `(${floor}). Raise your Year Plan target or adjust your average policy size ` +
      `(current: TTD ${avgPolicyAPI?.toLocaleString() ?? 'unset'}).`
    );
    this.name = 'BelowAppsFloorError';
    this.floor = floor;
    this.actual = actual;
    this.avgPolicyAPI = avgPolicyAPI;
  }
}

export class AvgPolicyMissingError extends Error {
  constructor() {
    super(
      'Cannot check the apps floor — no average policy size saved. ' +
      'Set your average policy size in the Commission Playground first.'
    );
    this.name = 'AvgPolicyMissingError';
  }
}

/**
 * Atomic, floor-enforced commit transaction for Game Plan Step 4.
 *
 * Writes personalAnnualAPI + personalAnnualApps to goals/{uid} (merge: true),
 * flips yearPlan/{year} and monthlyPlan/{year} (if it exists) to committed,
 * and sets committedAt on the plan docs — all in one transaction.
 *
 * @throws {BelowApiFloorError}    when annualAPI is below the agent's tenure floor.
 * @throws {AvgPolicyMissingError} when no average policy size is saved in goals.
 * @throws {BelowAppsFloorError}   when derived apps are below the company apps floor.
 */
export async function commitPlan(tenantId, uid, year, { annualAPI, annualApps }) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const api  = parseFloat(annualAPI) || 0;
  const apps = parseFloat(annualApps) || 0;

  // goalsRef hoisted above Promise.all — reused for both the pre-flight
  // avgPolicyAPI read and the transactional goals write below.
  const goalsRef = doc(db, 'tenants', tenantId, 'goals', uid);

  // Resolve both floors outside the transaction — reads are non-mutating.
  const [mins, agentSnap, goalsSnap] = await Promise.all([
    getCompanyMinimums(tenantId),
    getDoc(doc(db, 'tenants', tenantId, 'users', uid)),
    getDoc(goalsRef),
  ]);

  const contractStartDate = agentSnap.exists() ? (agentSnap.data().contractStartDate ?? null) : null;
  const avgPolicyAPI = goalsSnap.exists() ? (goalsSnap.data().playgroundAvgPolicyAPI ?? null) : null;

  const floor = resolveAnnualAPIFloor({
    contractStartDate,
    tenureApiFloors: mins.tenureApiFloors,
    fallback: FLAT_ANNUAL_API_FALLBACK,
  });

  if (api < floor) {
    throw new BelowApiFloorError(floor, api);
  }

  if (avgPolicyAPI === null) {
    throw new AvgPolicyMissingError();
  }

  const appsFloor  = mins.annualApps ?? 42;
  const appsCount  = deriveAnnualApps(api, avgPolicyAPI);
  if (appsCount < appsFloor) {
    throw new BelowAppsFloorError(appsFloor, appsCount, avgPolicyAPI);
  }

  const yearPlanRef    = doc(db, 'tenants', tenantId, 'users', uid, 'yearPlan', String(parsedYear));
  const monthlyPlanRef = doc(db, 'tenants', tenantId, 'users', uid, 'monthlyPlan', String(parsedYear));

  await runTransaction(db, async (tx) => {
    const [yearSnap, monthlySnap] = await Promise.all([
      tx.get(yearPlanRef),
      tx.get(monthlyPlanRef),
    ]);

    if (!yearSnap.exists()) {
      throw new Error('Year plan not found — cannot commit without a Year Plan.');
    }

    const now = serverTimestamp();

    tx.set(goalsRef, { personalAnnualAPI: api, personalAnnualApps: apps }, { merge: true });
    tx.update(yearPlanRef, { status: 'committed', committedAt: now });

    if (monthlySnap.exists()) {
      tx.update(monthlyPlanRef, { status: 'committed', committedAt: now });
    }
  });
}
