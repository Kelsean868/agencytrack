// PR-B2 — manager-side plan reads for the AgentPlanDrawer (Fork B slice 2).
//
// Path-addressed reads of ANOTHER agent's yearPlan/{year} + monthlyPlan/{year},
// exercising the Fork B1 unconditional-upline rules arms at runtime. Mirrors
// getSharedMoneyNeeds' posture (moneyNeedsService): a permission-denied read
// maps to `{ unavailable: true }` — a NEUTRAL state, never an error alarm.
// Pre-B1-deploy every read denies (unavailable IS the correct pre-deploy
// behavior); post-deploy a denial means the caller is out of scope.
// A missing doc maps to `{ empty: true }` (the agent hasn't built that step).
// Any non-permission failure rethrows so callers can show a real error state.
//
// Reads are lazy per-drawer-open (dispatcher-ruled fetch contract) — the
// roster row contract is untouched; no N×3 roster fan-out.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LINE_KEYS } from './yearPlanService';
import { getCompanyMinimums } from './goalsService';
import { resolveAnnualAPIFloor } from '../utils/tenureFloors';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

async function readPlanDoc(tenantId, agentId, collectionName, year) {
  const parsedYear = parseInt(year, 10);
  if (!parsedYear) return { empty: true };
  const ref = doc(db, 'tenants', tenantId, 'users', agentId, collectionName, String(parsedYear));
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return { empty: true };
    return { data: snap.data() };
  } catch (e) {
    if (e?.code === 'permission-denied') return { unavailable: true };
    throw e;
  }
}

/**
 * getAgentYearPlan — shape-normalized projection of an agent's yearPlan for
 * the review drawer: { year, status, updatedAt, lines } with parseFloat-guarded
 * numerics per line. Denied → { unavailable: true }; absent → { empty: true }.
 */
export async function getAgentYearPlan(tenantId, agentId, year) {
  const res = await readPlanDoc(tenantId, agentId, 'yearPlan', year);
  if (!res.data) return res;
  const src = res.data;
  const lines = LINE_KEYS.reduce((acc, k) => {
    const l = src.lines?.[k] ?? {};
    acc[k] = {
      targetAPI: num(l.targetAPI),
      pct: num(l.pct),
      derivedApps: num(l.derivedApps),
      derivedCommission: num(l.derivedCommission),
      enabled: l.enabled !== false,
    };
    return acc;
  }, {});
  return {
    plan: {
      year: src.year ?? null,
      status: src.status ?? 'draft',
      updatedAt: src.updatedAt ?? null,
      lines,
    },
  };
}

/**
 * getAgentMonthlyPlan — { year, status, split, anchorAPI, targets[12], updatedAt }.
 * Denied → { unavailable: true }; absent → { empty: true }.
 */
export async function getAgentMonthlyPlan(tenantId, agentId, year) {
  const res = await readPlanDoc(tenantId, agentId, 'monthlyPlan', year);
  if (!res.data) return res;
  const src = res.data;
  const targets = Array.isArray(src.targets) ? src.targets.map(num) : [];
  return {
    plan: {
      year: src.year ?? null,
      status: src.status ?? 'draft',
      split: src.split ?? 'even',
      anchorAPI: num(src.anchorAPI),
      targets,
      updatedAt: src.updatedAt ?? null,
    },
  };
}

/**
 * getAgentAnnualFloor — the agent's tenure-resolved annual Company Floor for
 * the plan-health "above floor" check. Reads the agent's user doc (for
 * contractStartDate) + config/companyMinimums (tenureApiFloors, defaults-
 * merged). Either read failing degrades to the resolver's flat fallback —
 * the floor check still renders, on the resolver's own fallback semantics.
 */
export async function getAgentAnnualFloor(tenantId, agentId) {
  let contractStartDate = null;
  let tenureApiFloors;
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'users', agentId));
    if (snap.exists()) contractStartDate = snap.data().contractStartDate ?? null;
  } catch {
    contractStartDate = null; // denied/failed → flat fallback below
  }
  try {
    const mins = await getCompanyMinimums(tenantId);
    tenureApiFloors = mins?.tenureApiFloors;
  } catch {
    tenureApiFloors = undefined; // resolver defaults-merges
  }
  return resolveAnnualAPIFloor({ contractStartDate, tenureApiFloors });
}
