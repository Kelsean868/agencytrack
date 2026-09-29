/**
 * persistencyOutlook.js — one answer to "where is my 24-month persistency, and
 * where is it heading?", shared by every surface that shows it.
 *
 * PURE. No Firestore, no clock, no React. The caller supplies the policy docs,
 * the saved persistency records and today's TT date.
 *
 * It calls `deriveFromLedger` and `deriveAll`/`calculateShortfall`; it never
 * re-implements the formula. Its job is to decide WHICH ledger, WHICH month and
 * WHICH manual inputs each figure is derived from, and to say so on the figure.
 *
 * FIVE FIGURES, FIVE DIFFERENT CLAIMS — never blend them on a screen:
 *
 *   confirmed        a saved persistency record. A human stands behind it.
 *   derived          the last full month before the export date, from the
 *                    head-office export ONLY (imported docs). What HO's own
 *                    data says, before anyone has checked it against the report.
 *   estimateToday    the current month, from the export PLUS hand-keyed
 *                    policies. Moves as the agent keys business.
 *   ifPendingSettle  estimateToday with every pending policy treated as placed.
 *                    Only present when a pending policy exists (R2: a submitted
 *                    policy is not placed, so it never moves estimateToday).
 *   gateMonth        the campaign's gate month projected on today's ledger, with
 *                    the gap to the threshold. No new business assumed.
 *
 * Every figure carries its annuity rule and which manual inputs were taken from
 * a saved record versus assumed 0 (R3: never silently 0).
 */

import {
  deriveFromLedger,
  DEFAULT_ANNUITY_MISSED_PREMIUM_RULE,
  ANNUITY_MISSED_PREMIUM_RULE_LABELS,
  PERSISTENCY_LEDGER_WINDOW_MONTHS,
} from './deriveFromLedger';
import { aggregatePersistency, calculateShortfall, PERS_GATE } from './calculations';
import { applicableManualInputs } from './ledgerPrefill';
import { isTwentyFourMonthModel } from './model';
import { toDateStr } from '../policyCampaignLens';
import { normalizeGate } from '../../utils/campaignEngine';
import { parseDateOnlyTT } from '../../utils/dateInputs';

/** R4 — an export older than this many days makes the outlook stale. ONE constant. */
export const PERSISTENCY_OUTLOOK_STALE_DAYS = 45;

export const PERSISTENCY_OUTLOOK_STALE_MESSAGE = 'Estimate is getting stale; import a fresh export.';

/** Pipeline statuses: written or in underwriting, not yet placed. */
export const PENDING_POLICY_STATUSES = Object.freeze(['written', 'submitted', 'rated', 'postponed']);

/** Provenance tag written on a month confirmed against the HO report. */
export const HO_CONFIRMED_SOURCE = 'ho_confirmed';

/** Provenance tag on the derived figure. */
export const HO_EXPORT_SOURCE = 'ho_export';

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86400000;
const LEDGER_DATE_FIELDS = ['dateIssued', 'paidToDate', 'inforceDate'];
const PENDING = new Set(PENDING_POLICY_STATUSES);

const money2 = (n) => Math.round(n * 100) / 100;

/** Shifts a `YYYY-MM` key by whole months. */
function shiftMonth(monthKey, delta) {
  const ordinal = Number(monthKey.slice(0, 4)) * 12 + (Number(monthKey.slice(5, 7)) - 1) + delta;
  return `${String(Math.floor(ordinal / 12)).padStart(4, '0')}-${String((ordinal % 12) + 1).padStart(2, '0')}`;
}

/** Is the doc from the head-office export (vs keyed by hand in the app)? */
export function isImportedDoc(doc) {
  return Boolean(doc?.importSource);
}

/**
 * Puts a policy doc into the shape `deriveFromLedger` reads.
 *
 * Imported docs already carry `YYYY-MM-DD` strings and `isWritingAgent`.
 * Hand-keyed docs do not: their dates are Firestore Timestamps and they have no
 * `isWritingAgent`, so `deriveFromLedger` drops every one of them as "not the
 * writing agent" / "no issue date". A hand-keyed doc is the agent's own sale —
 * the agent created it under their own uid — so it is marked as the writing
 * agent's. An explicit value on the doc is never overwritten.
 *
 * Returns a NEW object; the input is not mutated.
 */
export function toLedgerDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  for (const f of LEDGER_DATE_FIELDS) {
    if (out[f] != null && typeof out[f] !== 'string') out[f] = toDateStr(out[f]);
  }
  if (!isImportedDoc(doc) && out.isWritingAgent === undefined) out.isWritingAgent = true;
  return out;
}

/** The newest export date carried by the ledger, or null. */
export function ledgerExportDateOf(docs) {
  const dates = (Array.isArray(docs) ? docs : [])
    .map((d) => d?.exportDate)
    .filter((d) => typeof d === 'string' && DATE_RE.test(d))
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/**
 * Is a saved record a 24-month figure? Either its month is on the 24-month
 * model, or its figures were derived on a 24-month window (`ledgerWindowMonths`,
 * written by the Confirm flow on a pre-September month).
 */
export function isTwentyFourMonthFigure(record) {
  if (!record || !MONTH_KEY_RE.test(String(record.monthKey))) return false;
  return isTwentyFourMonthModel(record.monthKey) || record.ledgerWindowMonths === PERSISTENCY_LEDGER_WINDOW_MONTHS;
}

/**
 * The annuity rule the outlook uses by default: the newest saved record's rule,
 * else the module default. A surface may override it (the Persistency tab's switch).
 */
export function resolveAnnuityRule(records) {
  const withRule = (Array.isArray(records) ? records : [])
    .filter((r) => r?.annuityMissedPremiumRule && MONTH_KEY_RE.test(String(r.monthKey)))
    .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));
  return withRule.length
    ? withRule[withRule.length - 1].annuityMissedPremiumRule
    : DEFAULT_ANNUITY_MISSED_PREMIUM_RULE;
}

/**
 * R3 — the manual inputs for one month. A saved record's values win; every
 * other applicable input is 0 AND named in `assumedZero`.
 */
export function manualInputsFor(monthKey, records) {
  const record = (Array.isArray(records) ? records : []).find((r) => r?.monthKey === monthKey) ?? null;
  const manual = {};
  const fromRecord = [];
  const assumedZero = [];
  for (const id of applicableManualInputs(monthKey)) {
    const v = record?.[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      manual[id] = v;
      fromRecord.push(id);
    } else {
      manual[id] = 0;
      assumedZero.push(id);
    }
  }
  return { manual, fromRecord, assumedZero };
}

function figureFrom(docs, { monthKey, exportDate, rule, records, source }) {
  const { manual, fromRecord, assumedZero } = manualInputsFor(monthKey, records);
  const ledger = deriveFromLedger(docs, {
    monthKey,
    exportDate,
    annuityMissedPremiumRule: rule,
    manual,
  });
  return {
    monthKey,
    source,
    persistency: ledger.derived.persistency,
    inputs: ledger.inputs,
    derived: ledger.derived,
    counted: ledger.counted,
    // The policy numbers behind each input (FR-3 reinstatement planner lists
    // the counted lapses from here, so it never re-derives which ones count).
    evidence: ledger.evidence,
    // FR-6 — declared reinstatements, BESIDE the evidenced figure (never in it).
    declared: ledger.declared,
    exportDate: exportDate ?? null,
    annuityMissedPremiumRule: rule,
    annuityRuleLabel: ANNUITY_MISSED_PREMIUM_RULE_LABELS[rule],
    assumptions: { fromRecord, assumedZero },
  };
}

/**
 * A saved record's own figure: its stored `persistency`, else net / gross
 * through `aggregatePersistency` (never a fabricated 0 when gross is 0).
 */
function recordPersistency(r) {
  if (typeof r?.persistency === 'number' && Number.isFinite(r.persistency)) return r.persistency;
  const { aggregatedPersistency, sumGrossSettled } = aggregatePersistency([r]);
  return sumGrossSettled > 0 ? aggregatedPersistency : null;
}

function newestConfirmed(records) {
  const eligible = (Array.isArray(records) ? records : [])
    .filter((r) => isTwentyFourMonthFigure(r) && recordPersistency(r) != null);
  if (!eligible.length) return null;
  const rec = eligible.reduce((a, b) => (b.monthKey > a.monthKey ? b : a));
  return {
    monthKey: rec.monthKey,
    source: rec.source ?? 'manual',
    persistency: recordPersistency(rec),
    annuityMissedPremiumRule: rec.annuityMissedPremiumRule ?? null,
    annuityRuleLabel: rec.annuityMissedPremiumRule
      ? ANNUITY_MISSED_PREMIUM_RULE_LABELS[rec.annuityMissedPremiumRule] ?? null
      : null,
    exportDate: rec.ledgerExportDate ?? null,
    record: rec,
  };
}

function daysBetween(fromDate, toDate) {
  return Math.round((parseDateOnlyTT(toDate).getTime() - parseDateOnlyTT(fromDate).getTime()) / MS_PER_DAY);
}

/**
 * @param {Object} params
 * @param {Array<Object>} params.policies  the agent's policy docs, UNFILTERED (imported + hand-keyed)
 * @param {Array<Object>} [params.records] saved persistency records
 * @param {string} params.today            TT calendar date, `YYYY-MM-DD`
 * @param {string} [params.annuityMissedPremiumRule]  override; defaults to resolveAnnuityRule(records)
 * @param {{monthKey: string, threshold: number}} [params.gate]  threshold on the 0–100 scale
 * @param {{tiers: Array<{name: string, api: number}>, current: number}} [params.productionTarget]
 *        the campaign's tier ladder and the API already credited to it; the gap
 *        sentence names the SMALLEST tier whose remaining API closes the gap
 */
export function buildPersistencyOutlook({
  policies,
  records = [],
  today,
  annuityMissedPremiumRule,
  gate = null,
  productionTarget = null,
} = {}) {
  if (typeof today !== 'string' || !DATE_RE.test(today)) {
    throw new Error(`buildPersistencyOutlook: today must be "YYYY-MM-DD" (got ${JSON.stringify(today)})`);
  }
  const rule = annuityMissedPremiumRule ?? resolveAnnuityRule(records);
  const docs = (Array.isArray(policies) ? policies : []).map(toLedgerDoc);
  const importedDocs = docs.filter(isImportedDoc);
  const exportDate = ledgerExportDateOf(importedDocs);
  const currentMonth = today.slice(0, 7);

  const confirmed = newestConfirmed(records);

  let derived = null;
  if (exportDate && importedDocs.length) {
    const fig = figureFrom(importedDocs, {
      monthKey: shiftMonth(exportDate.slice(0, 7), -1),
      exportDate,
      rule,
      records,
      source: HO_EXPORT_SOURCE,
    });
    // Confirmable only on a 24-month-model month (dispatcher ruling, 23 Sep
    // 2026). The derived figure is always a 24-month-window figure; a
    // pre-September HO report is on the 12-month model, so the two cannot be
    // checked against each other.
    derived = fig.counted > 0 ? { ...fig, confirmable: isTwentyFourMonthModel(fig.monthKey) } : null;
  }

  let estimateToday = null;
  if (docs.length) {
    const fig = figureFrom(docs, { monthKey: currentMonth, exportDate, rule, records, source: 'estimate' });
    estimateToday = fig.counted > 0 ? fig : null;
  }

  // R2 — pending business counts only on this separate line. Treated as placed
  // this month: a policy that has not been issued has no issue date of its own.
  const pendingDocs = docs.filter((d) => PENDING.has(d?.status) && !d?.replacedBy);
  let ifPendingSettle = null;
  if (estimateToday && pendingDocs.length) {
    const asPlaced = docs.map((d) => (pendingDocs.includes(d)
      ? { ...d, status: 'settled', dateIssued: d.dateIssued ?? today }
      : d));
    ifPendingSettle = {
      ...figureFrom(asPlaced, { monthKey: currentMonth, exportDate, rule, records, source: 'if_pending_settle' }),
      pendingCount: pendingDocs.length,
      pendingApi: money2(pendingDocs.reduce((s, d) => s + (Number(d.proposedAPI) || 0), 0)),
    };
  }

  let gateMonth = null;
  const gateThreshold = Number(gate?.threshold);
  if (docs.length && gate && MONTH_KEY_RE.test(String(gate.monthKey))
    && gate.monthKey >= currentMonth && Number.isFinite(gateThreshold)) {
    const fig = figureFrom(docs, { monthKey: gate.monthKey, exportDate, rule, records, source: 'projection' });
    if (fig.counted > 0) {
      const shortfall = calculateShortfall({
        targetPersistency: gateThreshold / 100,
        currentGrossSettled: fig.derived.grossSettled,
        currentLapses: fig.inputs.lapses,
        currentReinstatements: fig.inputs.reinstatements,
      });
      const settledApiNeeded = money2(shortfall.nbNeeded);
      const reinstateNeeded = money2(shortfall.nrNeeded);
      const current = Number(productionTarget?.current) || 0;
      const closer = settledApiNeeded > 0
        ? (Array.isArray(productionTarget?.tiers) ? productionTarget.tiers : [])
          .map((t) => ({ name: t?.name ?? null, api: Number(t?.api) }))
          .filter((t) => Number.isFinite(t.api) && t.api > 0)
          .map((t) => ({ ...t, remaining: money2(Math.max(0, t.api - current)) }))
          .filter((t) => t.remaining >= settledApiNeeded)
          .sort((a, b) => a.api - b.api)[0] ?? null
        : null;
      gateMonth = {
        ...fig,
        threshold: gateThreshold,
        meetsThreshold: fig.persistency * 100 >= gateThreshold,
        gap: {
          settledApiNeeded,
          reinstateNeeded,
          closedByTarget: closer,
        },
      };
    }
  }

  // R5 — the preview: the newest of confirmed / derived. On a tie the
  // confirmed month wins, because a human stands behind it.
  let headline = null;
  if (confirmed && (!derived || confirmed.monthKey >= derived.monthKey)) {
    headline = { kind: 'confirmed', monthKey: confirmed.monthKey, persistency: confirmed.persistency, source: confirmed.source };
  } else if (derived) {
    headline = { kind: 'derived', monthKey: derived.monthKey, persistency: derived.persistency, source: derived.source };
  }

  const daysSinceExport = exportDate ? daysBetween(exportDate, today) : null;

  return {
    today,
    annuityMissedPremiumRule: rule,
    annuityRuleLabel: ANNUITY_MISSED_PREMIUM_RULE_LABELS[rule],
    exportDate,
    daysSinceExport,
    stale: daysSinceExport != null && daysSinceExport > PERSISTENCY_OUTLOOK_STALE_DAYS,
    confirmed,
    derived,
    estimateToday,
    ifPendingSettle,
    gateMonth,
    headline,
    assumptions: {
      annuityMissedPremiumRule: rule,
      annuityRuleLabel: ANNUITY_MISSED_PREMIUM_RULE_LABELS[rule],
      exportDate,
      daysSinceExport,
      fromRecord: estimateToday?.assumptions.fromRecord ?? [],
      assumedZero: estimateToday?.assumptions.assumedZero ?? [],
    },
  };
}

/**
 * Tone for a persistency figure. Below the threshold is WARNING; only a
 * confirmed gate-month figure below the threshold may be DANGER.
 */
export function persistencyTone(decimal, { threshold = PERS_GATE * 100, confirmedGateMonth = false } = {}) {
  if (!Number.isFinite(decimal)) return 'neutral';
  if (decimal * 100 >= threshold) return 'success';
  return confirmedGateMonth ? 'danger' : 'warning';
}

/** `0.8958…` → `"89.6%"`. One decimal, so 89.6 is never displayed as a passing 90. */
export function formatOutlookPct(decimal) {
  return Number.isFinite(decimal) ? `${(decimal * 100).toFixed(1)}%` : '—';
}

/**
 * The gate month and threshold for a campaign, from its own gate config.
 * The gate is judged on the campaign's end month. Null when the campaign does
 * not gate on persistency or has no usable end date.
 */
export function outlookGateFor(campaign) {
  if (!campaign || campaign.persistencyGateEnabled === false) return null;
  const monthKey = toDateStr(campaign.endDate)?.slice(0, 7);
  if (!monthKey || !MONTH_KEY_RE.test(monthKey)) return null;
  const g = normalizeGate(campaign);
  return { monthKey, threshold: g.threshold, basis: g.basis };
}
