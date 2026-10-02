import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { kioskDb } from './kioskFirebase';
import {
  getCurrentMonthKey, getPrevMonthKey, isWithinEditWindow,
} from '../../services/agentOfMonthService';
import { getTodayTT } from '../../utils/dateInputs';

// FU SEC-012: branchId filter is required — the branch-scoped kiosk submissions
// list rule denies any query that isn't constrained to the kiosk's own branch.
// Served by the existing (branchId, status, weekStarting) composite index.
export async function getKioskYTDSubmissions(tenantId, branchId) {
  // Defensive: a falsy branchId in where('branchId','==',…) throws a FirebaseError
  // that would reject the whole KioskShell load. branchId is always present from
  // the validated kiosk token, but degrade to [] rather than crash if it isn't.
  if (!tenantId || !branchId) return [];
  const year = new Date().getFullYear();
  const q = query(
    collection(kioskDb, `tenants/${tenantId}/submissions`),
    where('branchId', '==', branchId),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Tier-3 #15: per-branch panel enable/disable, read from the kiosk display side
// via kioskDb. The kiosk token carries `branchId`, and the rules `get` arm gates
// on doc-id == token.branchId. Returns the disabled-panel key list; degrades to
// [] (all panels enabled) on absent doc / missing context / malformed field so
// the wall falls back to current all-enabled behavior. The KioskShell caller
// additionally wraps this in `.catch(() => [])` for the denied/network path.
export async function getKioskDisabledPanels(tenantId, branchId) {
  if (!tenantId || !branchId) return [];
  const snap = await getDoc(doc(kioskDb, `tenants/${tenantId}/kioskConfig/${branchId}`));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data.disabledPanels) ? data.disabledPanels : [];
}

// FR Leaderboard L-3: the branch's leaderboard aggregate
// (`leaderboards/{branchId}`, written by the leaderboard-aggregate CF). Kiosk
// rules already allow `get` on the kiosk's own branch doc (kioskCanRead +
// doc-id == token.branchId), so there is no rules change. Returns the doc data,
// or null when the doc does not exist yet / context is missing — the panels
// then show their empty state, never fake data. A denied or failed read throws;
// the KioskShell caller keeps the last good copy.
export async function getKioskLeaderboardAggregate(tenantId, branchId) {
  if (!tenantId || !branchId) return null;
  const snap = await getDoc(doc(kioskDb, `tenants/${tenantId}/leaderboards/${branchId}`));
  return snap.exists() ? snap.data() : null;
}

export async function getKioskTenantUsers(tenantId) {
  const snap = await getDocs(collection(kioskDb, `tenants/${tenantId}/users`));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true && u.active !== false);
}

async function getKioskAgentOfMonthForKey(tenantId, monthKey) {
  const snap = await getDoc(doc(kioskDb, `tenants/${tenantId}/agentOfMonth/${monthKey}`));
  return snap.exists() ? snap.data() : null;
}

export async function getKioskAgentOfMonth(tenantId) {
  const current = getCurrentMonthKey();
  let data = await getKioskAgentOfMonthForKey(tenantId, current);
  if (!data && isWithinEditWindow()) {
    data = await getKioskAgentOfMonthForKey(tenantId, getPrevMonthKey());
  }
  return data;
}

// 3.6: kiosk-flagged campaign leaderboards. The campaigns read rule
// (firestore.rules ~L841) permits any tenant member — the kiosk token carries
// `tenantId`, so no rules change is needed. Single-field inequality on
// startDate → no composite index required; the active-window + kiosk-flag
// filter is applied in JS. Only campaigns explicitly opted onto the wall
// (`kiosk === true`, item 2.9's flag) and currently active are returned.
export async function getKioskCampaigns(tenantId) {
  if (!tenantId) return [];
  const today = getTodayTT();
  const q = query(
    collection(kioskDb, `tenants/${tenantId}/campaigns`),
    where('startDate', '<=', today),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) =>
      c.kiosk === true &&
      c.status !== 'draft' &&
      typeof c.endDate === 'string' &&
      c.endDate.slice(0, 10) >= today
    );
}
