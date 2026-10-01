'use strict';

// CJS twin of the ledger's settled-production rule, for the leaderboard
// aggregate (FR Leaderboard L-1, brief D6). Mirrors, verbatim in behaviour:
//
//   src/utils/dateInputs.js           ymdUTC
//   src/lib/policyLedgerDerivation.js policyValue
//   src/lib/policyStatusTokens.js     isConfirmed
//   src/lib/policyCampaignLens.js     toDateStr, DEFAULT_INC_PPP_APP_THRESHOLD,
//                                     RULE_7_CREDIT_TABLE, creditFor
//   src/lib/ledgerProduction.js       GENERAL_CREDIT_TABLE, productionCredit,
//                                     isSettled, isLife, settledCreditList
//
// Drift guard: src/lib/__tests__/ledgerCredit.cross-check.test.js runs shared
// fixtures through both runtimes and asserts identical output. Edit both or
// neither — the cross-check fails CI on drift.

// ── src/utils/dateInputs.js ──────────────────────────────────────────────────

function ymdUTC(d) {
  return d.toISOString().slice(0, 10);
}

// ── src/lib/policyLedgerDerivation.js ────────────────────────────────────────

/** Numeric value used for Σ aggregations — the most-confirmed figure available. */
function policyValue(policy) {
  const v =
    policy?.managerSettledAPI ??
    policy?.settledAPI ??
    policy?.proposedAPI ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── src/lib/policyStatusTokens.js ────────────────────────────────────────────

function isConfirmed(policy) {
  return Boolean(policy?.confirmedAt);
}

// ── src/lib/policyCampaignLens.js ────────────────────────────────────────────

const DEFAULT_INC_PPP_APP_THRESHOLD = 2400;

const RULE_7_CREDIT_TABLE = Object.freeze({
  nb_ordinary:   { apps: 'full', api: 'full',       label: 'Net settled ordinary business' },
  inc_ppp:       { apps: 'threshold', api: 'full',  label: 'Increase PPP' },
  replacement:   { apps: 'none', api: 'difference', label: 'Replacement' },
  spia:          { apps: 'none', api: 'none',       label: 'S.P.I.A.' },
  lumpsum:       { apps: 'none', api: 'none',       label: 'Lump sum' },
  platinum_edge: { apps: 'full', api: 'none',       label: 'Platinum Edge' },
});

function creditConfig(campaign) {
  const c = campaign?.credit;
  if (!c) return null;
  const parsed = Number(c.incPppAppThreshold);
  return {
    table: c.table ?? RULE_7_CREDIT_TABLE,
    incPppAppThreshold: Number.isFinite(parsed) ? parsed : DEFAULT_INC_PPP_APP_THRESHOLD,
  };
}

function creditFor(policy, campaign) {
  const cfg = creditConfig(campaign);
  if (!cfg) return null;

  const type = policy?.newBusinessType;
  const row = type ? cfg.table[type] : null;
  if (!row) {
    return { apps: 0, api: 0, reason: 'Unclassified new-business type' };
  }

  const value = policyValue(policy);

  if (row.api === 'difference') {
    const base = policy?.replacedPolicyAPI;
    if (base == null || base === '') {
      return { apps: 0, api: 0, reason: 'Replaced API not recorded' };
    }
    const baseNum = Number(base);
    if (!Number.isFinite(baseNum)) {
      return { apps: 0, api: 0, reason: 'Replaced API not recorded' };
    }
    return {
      apps: 0,
      api: Math.max(0, value - baseNum),
      reason: 'Replacement — API difference only, no application credit',
    };
  }

  const fraction = typeof row.api === 'number' && Number.isFinite(row.api) ? row.api : null;

  let apps = 0;
  let reason;
  if (row.apps === 'full') {
    apps = 1;
    reason = row.api === 'none'
      ? `${row.label} — counts as an application, no API credit`
      : `${row.label} — full application and API credit`;
  } else if (row.apps === 'threshold') {
    const clears = value >= cfg.incPppAppThreshold;
    apps = clears ? 1 : 0;
    reason = clears
      ? `${row.label} at or above the application threshold — full credit`
      : `${row.label} below the application threshold — API credit only`;
  } else if (fraction !== null) {
    reason = `${row.label} — ${Math.round(fraction * 100)}% API credit, no application`;
  } else {
    reason = `${row.label} — no application or API credit`;
  }

  let api = 0;
  if (row.api === 'full') api = value;
  else if (fraction !== null) api = value * fraction;
  return { apps, api, reason };
}

/** Normalize a policy/campaign date (string or Firestore Timestamp) to YYYY-MM-DD. */
function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (typeof v.toDate === 'function') {
    try { return ymdUTC(v.toDate()); } catch { return null; }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : ymdUTC(d);
}

// ── src/lib/ledgerProduction.js ──────────────────────────────────────────────

const GENERAL_CREDIT_TABLE = Object.freeze({
  ...RULE_7_CREDIT_TABLE,
  lumpsum: Object.freeze({ apps: 'none', api: 0.1, label: 'Lump sum' }),
});

const GENERAL_CREDIT = Object.freeze({
  credit: Object.freeze({
    table: GENERAL_CREDIT_TABLE,
    incPppAppThreshold: DEFAULT_INC_PPP_APP_THRESHOLD,
  }),
});

/** Apps and API one policy earns under Tatil's general production rules. */
function productionCredit(policy) {
  return creditFor(policy, GENERAL_CREDIT);
}

const SETTLED_STATUSES = new Set(['settled', 'confirmed']);

function isSettled(policy) {
  return isConfirmed(policy) || SETTLED_STATUSES.has(policy?.status);
}

function isLife(policy) {
  return (policy?.productLine ?? 'life') === 'life';
}

/**
 * One entry per Life policy that is settled (or manager-confirmed) and has a
 * readable `dateIssued`: { policy, issued: 'YYYY-MM-DD', periodKey: 'YYYY-MM', credit }.
 * Self/family is NOT filtered here (each reader decides).
 */
function settledCreditList(policies) {
  const out = [];
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || !isLife(p) || !isSettled(p)) continue;
    const issued = toDateStr(p.dateIssued);
    if (!issued || !/^\d{4}-\d{2}-/.test(issued)) continue;
    out.push({ policy: p, issued, periodKey: issued.slice(0, 7), credit: productionCredit(p) });
  }
  return out;
}

module.exports = {
  ymdUTC,
  policyValue,
  isConfirmed,
  DEFAULT_INC_PPP_APP_THRESHOLD,
  RULE_7_CREDIT_TABLE,
  creditFor,
  toDateStr,
  GENERAL_CREDIT_TABLE,
  productionCredit,
  isSettled,
  isLife,
  settledCreditList,
};
