// Track K — Strategic Plan · Gross/Net twin-run over policy docs (pure).
//
// Dispatcher RULING 2 (2026-07-17): run the SAME settlementShapeFromPolicies
// coercion / date-grouping logic twice, both filtered to the plan period by
// settlement date (dateIssued), so Gross and Net cannot drift:
//   • Net   = status === 'settled' (lapsed excluded)  → % Objective Achieved denom.
//   • Gross = ever-settled: status in ['settled','lapsed'], lapsed re-labeled
//             'settled' so settlementShapeFromPolicies' settled-filter admits it.
//
// Viability (verified firestore.rules:465-472): the settled→lapsed transition
// diff is hasOnly(['status','statusUpdatedAt','dateLapsed','lapseReason']), so a
// lapsed policy PRESERVES settledAPI + dateIssued — the fields both arms read.

import { settlementShapeFromPolicies } from '../policiesDerivation';
import { ymdUTC } from '../../utils/dateInputs';

// dateIssued (Firestore Timestamp | Date | string) → "YYYY-MM-DD", or null.
// Mirrors settlementShapeFromPolicies' own date coercion so the period pre-filter
// and the grouping inside it agree.
function issuedYMD(policy) {
  const di = policy?.dateIssued;
  if (!di) return null;
  const d = di.toDate ? di.toDate() : new Date(di);
  if (Number.isNaN(d.getTime())) return null;
  return ymdUTC(d);
}

function inPeriod(policy, startYMD, endYMD) {
  const ymd = issuedYMD(policy);
  return ymd !== null && ymd >= startYMD && ymd <= endYMD;
}

// Sum a settlementShapeFromPolicies result ([{ settledAPI, settledApps }]) to
// { api, apps } totals across its monthly buckets.
function sumShape(shape) {
  return shape.reduce(
    (acc, m) => ({ api: acc.api + (m.settledAPI || 0), apps: acc.apps + (m.settledApps || 0) }),
    { api: 0, apps: 0 },
  );
}

// Net arm — settled-only, in period.
function netInPeriod(policies, startYMD, endYMD) {
  return (policies || []).filter((p) => p.status === 'settled' && inPeriod(p, startYMD, endYMD));
}

// Gross arm — ever-settled (settled + lapsed) in period, lapsed re-labeled
// 'settled' so the downstream settled-filter admits it.
function grossInPeriod(policies, startYMD, endYMD) {
  return (policies || [])
    .filter((p) => (p.status === 'settled' || p.status === 'lapsed') && inPeriod(p, startYMD, endYMD))
    .map((p) => (p.status === 'lapsed' ? { ...p, status: 'settled' } : p));
}

// Branch-wide period settlement: { net: {api,apps}, gross: {api,apps} }.
export function periodSettlement(policies, window) {
  const { startYMD, endYMD } = window;
  return {
    net: sumShape(settlementShapeFromPolicies(netInPeriod(policies, startYMD, endYMD))),
    gross: sumShape(settlementShapeFromPolicies(grossInPeriod(policies, startYMD, endYMD))),
  };
}

// Per-agent period settlement: { [agentId]: { net, gross } }. Groups by agentId
// then re-runs the identical twin-run per group (same guards, no drift).
export function periodSettlementByAgent(policies, window) {
  const byAgent = {};
  for (const p of policies || []) {
    const id = p.agentId;
    if (!id) continue;
    (byAgent[id] = byAgent[id] || []).push(p);
  }
  const out = {};
  for (const [id, list] of Object.entries(byAgent)) {
    out[id] = periodSettlement(list, window);
  }
  return out;
}
