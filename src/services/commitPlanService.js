import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FLAT_ANNUAL_API_FALLBACK, resolveAnnualAPIFloor } from '../utils/tenureFloors';
import { getCompanyMinimums } from './goalsService';

export class BelowFloorError extends Error {
  constructor(floor, planTotal) {
    super(
      `Plan total (TTD ${planTotal.toLocaleString()}) is below the agent's annual API floor ` +
      `(TTD ${floor.toLocaleString()}). Raise your Year Plan target.`
    );
    this.name = 'BelowFloorError';
    this.floor = floor;
    this.planTotal = planTotal;
  }
}

/**
 * Atomic, floor-enforced commit transaction for Game Plan Step 4.
 *
 * Writes personalAnnualAPI + personalAnnualApps to goals/{uid} (merge: true),
 * flips yearPlan/{year} and monthlyPlan/{year} (if it exists) to committed,
 * and sets committedAt on the plan docs — all in one transaction.
 *
 * @throws {BelowFloorError} when annualAPI is below the agent's tenure floor.
 */
export async function commitPlan(tenantId, uid, year, { annualAPI, annualApps }) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear || parsedYear < 2020 || parsedYear > 2100) {
    throw new Error('year must be a valid integer between 2020 and 2100');
  }

  const api  = parseFloat(annualAPI) || 0;
  const apps = parseFloat(annualApps) || 0;

  // Resolve the tenure floor outside the transaction — getCompanyMinimums and
  // getDoc are read-only and don't need transactional consistency with the writes.
  const [mins, agentSnap] = await Promise.all([
    getCompanyMinimums(tenantId),
    getDoc(doc(db, 'tenants', tenantId, 'users', uid)).catch(() => null),
  ]);

  const contractStartDate = agentSnap?.exists?.() ? agentSnap.data().contractStartDate : null;
  const floor = resolveAnnualAPIFloor({
    contractStartDate,
    tenureApiFloors: mins.tenureApiFloors,
    fallback: FLAT_ANNUAL_API_FALLBACK,
  });

  if (api < floor) {
    throw new BelowFloorError(floor, api);
  }

  const goalsRef       = doc(db, 'tenants', tenantId, 'goals', uid);
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
