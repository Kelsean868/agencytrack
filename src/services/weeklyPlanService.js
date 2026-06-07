import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { validateSundayDate } from '../utils/validators';
import { parseDateOnlyTT } from '../utils/dateInputs';
import { PLAN_METRIC_KEYS, PROVENANCE_VALUES } from '../utils/weeklyPlanAssembly';

/**
 * weeklyPlanService — Weekly Planner v2 Slice 2 persistence.
 *
 * One doc per agent-week at /tenants/{tid}/weeklyPlans/{agentId}_{weekStart},
 * weekStart = a Sunday in YYYY-MM-DD form (the ID segment) stored TT-safe as a
 * Timestamp in the doc (parseDateOnlyTT → 04:00 UTC = TT midnight). Deterministic
 * composite ID mirroring the managerWeeklyReports house pattern; re-commit
 * overwrites; the agent may delete their own doc.
 *
 * Defense-in-depth: the stepper clamp blocks below-floor commits in the UI, and
 * this service re-validates against the resolved floor on write. Tenure-resolved
 * floor values are JS-side (the firestore.rules layer enforces shape/ownership/
 * int/enum only — it cannot compute tenure).
 */

export function weeklyPlanDocId(agentId, weekStart) {
  return `${agentId}_${weekStart}`;
}

function planRef(tenantId, agentId, weekStart) {
  return doc(db, `tenants/${tenantId}/weeklyPlans/${weeklyPlanDocId(agentId, weekStart)}`);
}

// Number()-enforced non-negative integer (never store numeric values as strings).
function toInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Fetch the agent's committed plan for a week, or null if none exists.
 * @returns {Promise<object|null>}
 */
export async function getWeeklyPlan(tenantId, agentId, weekStart) {
  const snap = await getDoc(planRef(tenantId, agentId, weekStart));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Commit (create or overwrite) the agent's weekly plan.
 *
 * @param {string} tenantId
 * @param {string} agentId  — must be the signed-in agent's uid (rules enforce).
 * @param {string} weekStart — YYYY-MM-DD Sunday.
 * @param {{ targets:object, provenance:object, anchorAPIAtCommit:(number|null) }} plan
 * @param {object|null} floors — resolved weeklyActivityFloors for floor re-validation.
 */
export async function commitWeeklyPlan(tenantId, agentId, weekStart, plan, floors = null) {
  if (!validateSundayDate(weekStart)) throw new Error('weekStart must be a Sunday');
  if (!plan || typeof plan !== 'object' || !plan.targets || !plan.provenance) {
    throw new Error('weeklyPlan: missing plan payload (targets/provenance required)');
  }

  const targets = {};
  const provenance = {};
  for (const key of PLAN_METRIC_KEYS) {
    const value = toInt(plan?.targets?.[key]);
    const floorMin = floors?.[key];
    // Floor re-validation (defense-in-depth behind the UI clamp).
    if (typeof floorMin === 'number' && Number.isFinite(floorMin) && value < floorMin) {
      throw new Error(`weeklyPlan: ${key} (${value}) is below the resolved floor (${floorMin})`);
    }
    targets[key] = value;

    const prov = plan?.provenance?.[key];
    if (!PROVENANCE_VALUES.includes(prov)) {
      throw new Error(`weeklyPlan: invalid provenance "${prov}" for ${key}`);
    }
    provenance[key] = prov;
  }

  const rawAnchor = plan?.anchorAPIAtCommit;
  const anchorAPIAtCommit =
    typeof rawAnchor === 'number' && Number.isFinite(rawAnchor) ? rawAnchor : null;

  await setDoc(planRef(tenantId, agentId, weekStart), {
    agentId,
    tenantId,
    weekStart: Timestamp.fromDate(parseDateOnlyTT(weekStart)),
    targets,
    provenance,
    anchorAPIAtCommit,
    committedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete the agent's own weekly plan doc (own-delete path; delete, not zero).
 */
export async function deleteWeeklyPlan(tenantId, agentId, weekStart) {
  await deleteDoc(planRef(tenantId, agentId, weekStart));
}
