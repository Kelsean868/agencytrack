/**
 * campaignPolicyGroups.js — the Campaign screen's "Policies in this campaign"
 * list (FR round 2, R2-4, docs/briefs/fr-round2-program.md § R2-4).
 *
 * PURE. It classifies NOTHING itself: every policy's group, credit and reason
 * is read off the SAME `derivePolicyLens` result the screen's progress figures
 * come from (`lens.contributions`, keyed by policy id). The list therefore
 * cannot disagree with the figures above it, and the group totals are summed
 * exactly the way `derivePolicyLens` sums them — same policies, same order,
 * same fallbacks — so they equal the lens figures by construction:
 *
 *   Counting      api  === lens.api.current     apps === lens.apps.current
 *   Waiting       api  === lens.pending.api     apps === lens.pending.apps
 *
 * `canChangeStatus` is read off LEGAL_AGENT_TRANSITIONS — the table the Policy
 * ledger's drawer builds its transition footer from — so a row offers a status
 * change exactly when the ledger's drawer would. Head-office statuses the
 * ledger shows as final (settled / lapsed / ntu / denied) offer none.
 */
import { policyValue } from './policyLedgerDerivation';
import { policyDate, toDateStr } from './policyCampaignLens';
import { isFromHeadOffice } from './settledProvenance';
import { LEGAL_AGENT_TRANSITIONS, POLICY_STATUS_LABELS } from '../constants/policyLifecycle';

// Same rounding `derivePolicyLens` applies to its pending total.
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The date the lens tested, and what it is. */
function rowDate(policy, creditTableApplied) {
  if (creditTableApplied) {
    // Settlement-window path: the lens tests `dateIssued`.
    return { basis: 'Issued', date: toDateStr(policy?.dateIssued) };
  }
  // Legacy submission-window path: dateSubmitted ?? dateWritten.
  return {
    basis: toDateStr(policy?.dateSubmitted) ? 'Submitted' : 'Written',
    date: policyDate(policy),
  };
}

/**
 * buildCampaignPolicyGroups(lens, policies) → { counting, waiting, notCounting }
 *
 * `policies` must be the SAME array the lens was derived from. Each group is
 * `{ rows, api, apps }` (notCounting carries no totals — nothing in it counts).
 * Returns null without a lens.
 */
export function buildCampaignPolicyGroups(lens, policies) {
  if (!lens) return null;
  const contributions = lens.contributions ?? {};
  const creditTableApplied = Boolean(lens.creditTableApplied);

  const counting = { rows: [], api: 0, apps: 0 };
  const waiting = { rows: [], api: 0, apps: 0 };
  const notCounting = { rows: [] };

  for (const p of Array.isArray(policies) ? policies : []) {
    const c = p ? contributions[p.id] : null;
    if (!c) continue;
    const { basis, date } = rowDate(p, creditTableApplied);
    const row = {
      id: p.id,
      client: p.ownerName || p.insuredName || null,
      policyNumber: p.policyNumber ? String(p.policyNumber) : null,
      status: p.status ?? null,
      statusLabel: POLICY_STATUS_LABELS[p.status] ?? p.status ?? '—',
      policyApi: policyValue(p),
      dateBasis: basis,
      date,
      reason: c.reason ?? null,
      headOffice: isFromHeadOffice(p),
      canChangeStatus: (LEGAL_AGENT_TRANSITIONS[p.status] ?? []).length > 0,
      creditApi: 0,
      creditApps: 0,
    };
    if (c.state === 'counts') {
      // Mirrors derivePolicyLens: apiCurrent += c.value; appsCurrent += c.apps ?? 1.
      row.creditApi = c.value;
      row.creditApps = c.apps ?? 1;
      counting.api += row.creditApi;
      counting.apps += row.creditApps;
      counting.rows.push(row);
    } else if (c.state === 'pending') {
      // Mirrors derivePolicyLens: pendingApi += c.pendingValue ?? 0; pendingApps += c.pendingApps ?? 0.
      row.creditApi = c.pendingValue ?? 0;
      row.creditApps = c.pendingApps ?? 0;
      waiting.api += row.creditApi;
      waiting.apps += row.creditApps;
      waiting.rows.push(row);
    } else {
      notCounting.rows.push(row);
    }
  }
  waiting.api = cents(waiting.api);

  return { counting, waiting, notCounting };
}
