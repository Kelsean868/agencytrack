/**
 * awardLensView.js — the words and figures the Policy Ledger's award card
 * shows for one `deriveAwardLens` result (L1, docs/briefs/ledger-lens-build.md).
 *
 * Presentation only. Every DECISION it reports — which policies count, the
 * credit, the target, the family rule, the Rule 10 cash suppression, the
 * persistency gate — was already made by the engines
 * (src/lib/ledgerProduction.js, src/lib/policyCampaignLens.js,
 * src/utils/awardsEngine.js, src/utils/campaignEngine.js). This file turns
 * those results into strings, so a component never re-derives a rule.
 *
 * Copy rule for RANKED awards (month / quarter / annual): "your credit" and
 * "counts toward" — never "you qualify" / "you'll win". A ranked award is
 * decided against other advisors, so no figure here can promise it.
 *
 * Pure functions only. Nothing is stored.
 */
import { campaignPace, formatCompact } from './campaignPace';
import { awardWeeksLeft } from '../utils/awardsEngine';
import { normalizeGate } from '../utils/campaignEngine';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthIndex(iso) {
  return Number(String(iso).slice(5, 7)) - 1;
}

/** "1 Jul" from YYYY-MM-DD. */
export function dayMonth(iso) {
  if (!ISO_RE.test(String(iso))) return '';
  return `${Number(iso.slice(8, 10))} ${MONTH_SHORT[monthIndex(iso)]}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); null when either is missing. */
export function daysBetween(from, to) {
  if (!ISO_RE.test(String(from)) || !ISO_RE.test(String(to))) return null;
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86400000);
}

/** "73,946" — whole TTD with grouping, for a surface that states the currency beside it. */
export function formatWhole(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—';
}

export function pluralApps(n) {
  return `${n} app${n === 1 ? '' : 's'}`;
}

function daysChip(award, today) {
  if (award.closed) return 'Closed · final credit';
  const days = daysBetween(today, award.end);
  if (days == null) return null;
  if (days <= 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

function eyebrow(award) {
  switch (award.kind) {
    case 'campaign':
      return `Campaign · ${dayMonth(award.start)} – ${dayMonth(award.end)}`;
    case 'month':
      return `Advisor of the month · ${MONTH_LONG[monthIndex(award.start)]}`;
    case 'quarter':
      return `Quarterly award · ${MONTH_SHORT[monthIndex(award.start)]} – ${MONTH_SHORT[monthIndex(award.end)]}`;
    case 'annual':
      return `Annual awards · ${award.year}`;
    case 'mdrt':
      return `MDRT · ${award.year}`;
    default:
      throw new Error(`awardLensSummary: unknown award kind "${award.kind}"`);
  }
}

function title(award) {
  const final = award.closed ? ' (final)' : '';
  switch (award.kind) {
    case 'campaign':
      return award.campaign?.name ?? award.periodName;
    case 'month':
      return `Your ${MONTH_LONG[monthIndex(award.start)]} credit${final}`;
    case 'quarter':
      return `Your ${award.label.split(' ')[0]} credit${final}`;
    case 'annual':
      return `Your ${award.year} award credit`;
    case 'mdrt':
      return 'Million Dollar Round Table';
    default:
      throw new Error(`awardLensSummary: unknown award kind "${award.kind}"`);
  }
}

function suppressorRange(campaign) {
  const s = String(campaign?.startDate ?? '').slice(0, 10);
  const e = String(campaign?.endDate ?? '').slice(0, 10);
  if (!ISO_RE.test(s) || !ISO_RE.test(e)) return null;
  return `${MONTH_SHORT[monthIndex(s)]}–${MONTH_SHORT[monthIndex(e)]}`;
}

function gateSentence(campaign) {
  if (!campaign || campaign.persistencyGateEnabled === false) return null;
  const gate = normalizeGate(campaign);
  const end = String(campaign.endDate ?? '').slice(0, 10);
  const where = gate.basis === 'finalMonth' && ISO_RE.test(end)
    ? `in ${MONTH_LONG[monthIndex(end)]}`
    : 'across the campaign';
  return `Persistency gate: ${gate.threshold}% ${where}.`;
}

/** Weeks left to the award's end: campaign end date for a campaign, getPeriodCtx otherwise. */
function weeksLeftFor(award, today) {
  if (award.closed) return null;
  if (award.kind === 'campaign') {
    const days = daysBetween(today, award.end);
    return days != null && days > 0 ? days / 7 : null;
  }
  return awardWeeksLeft(award.category, new Date(`${today}T12:00:00`));
}

function paceFor(lens, today) {
  const { award, settled, target } = lens;
  if (target.api == null && target.apps == null) return null;
  const weeksLeft = weeksLeftFor(award, today);
  if (weeksLeft == null) return null;
  return campaignPace({
    apiCurrent: settled.api, apiTarget: target.api,
    appsCurrent: settled.apps, appsTarget: target.apps,
    daysLeft: weeksLeft * 7,
  });
}

function closedLines(lens) {
  const { award, settled } = lens;
  const line1 = settled.count > 0
    ? 'Closed period. Nothing more can count.'
    : `No settled policies were dated in ${award.kind === 'month' ? MONTH_LONG[monthIndex(award.start)] : award.label.split(' ')[0]}.`;
  const line2 = award.kind === 'month'
    ? `Use this to check against the head-office list for ${MONTH_LONG[monthIndex(award.start)]}.`
    : 'Closed period.';
  return { line1, line2 };
}

function targetLine(lens, pace) {
  const { award, target } = lens;
  if (award.kind === 'campaign') {
    const tierName = target.tier?.name ?? null;
    if (target.api == null || !tierName) return 'No target is set on this campaign yet.';
    if (!pace) return `${tierName}: the campaign has ended.`;
    if (pace.apiRemaining <= 0) return `${tierName} API target reached.`;
    return `TTD ${formatCompact(pace.apiPerWeek)} a week to reach ${tierName}.`;
  }
  // MDRT
  if (target.api == null) return `No MDRT line is configured for ${award.year}.`;
  if (!pace) return `MDRT ${award.year}: the year has ended.`;
  if (pace.apiRemaining <= 0) return 'MDRT target reached.';
  return `TTD ${formatCompact(pace.apiPerWeek)} a week to qualify by ${dayMonth(award.end)}.`;
}

function quarterLine1(lens) {
  const { award, pending, groups } = lens;
  const by = dayMonth(award.end);
  const quarter = award.label.split(' ')[0];
  if (pending.count === 1) {
    const number = groups.pending[0]?.policy?.policyNumber;
    return number
      ? `Settle ···${String(number).slice(-4)} by ${by} and it counts for ${quarter}.`
      : `Settle the submitted policy by ${by} and it counts for ${quarter}.`;
  }
  if (pending.count > 1) return `Settle the ${pending.count} submitted by ${by} and they count for ${quarter}.`;
  return `Counted by issue date, ${dayMonth(award.start)} – ${by} ${award.year}.`;
}

function openLines(lens, pace) {
  const { award } = lens;
  const sup = award.suppressor;
  switch (award.kind) {
    case 'campaign':
      return {
        line1: targetLine(lens, pace),
        line2: ['Family policies do not count.', gateSentence(award.campaign)].filter(Boolean).join(' '),
      };
    case 'month': {
      const range = sup ? suppressorRange(sup) : null;
      return {
        line1: 'Ranked award — your branch manager chooses the winner.',
        line2: sup
          ? `${range ? `${range}: ` : ''}recognition only, no cash, while the ${sup.name ?? 'active campaign'} runs.`
          : 'Family policies do not count.',
      };
    }
    case 'quarter':
      return {
        line1: quarterLine1(lens),
        line2: `Ranked award. Family policies do not count.${sup ? ` Recognition only — no cash while the ${sup.name ?? 'active campaign'} runs.` : ''}`,
      };
    case 'annual':
      return {
        line1: `Counted by issue date, ${dayMonth(award.start)} – ${dayMonth(award.end)} ${award.year}.`,
        line2: 'Family policies do not count for awards.',
      };
    case 'mdrt':
      return { line1: targetLine(lens, pace), line2: 'Family and self policies count here.' };
    default:
      throw new Error(`awardLensSummary: unknown award kind "${award.kind}"`);
  }
}

/**
 * awardLensSummary(lens, { today }) — everything the award card renders.
 *
 * @param {object} lens  a `deriveAwardLens` result
 * @param {{ today: string }} opts  YYYY-MM-DD
 */
export function awardLensSummary(lens, { today }) {
  if (!lens?.award) throw new Error('awardLensSummary: lens is required');
  const { award, settled, pending, target } = lens;
  const hasRing = !award.ranked && target.api != null && target.api > 0;
  const pace = award.closed ? null : paceFor(lens, today);
  const { line1, line2 } = award.closed ? closedLines(lens) : openLines(lens, pace);

  const ratio = hasRing ? settled.api / target.api : 0;
  const ratioWithPending = hasRing ? Math.min(1, (settled.api + pending.api) / target.api) : 0;
  const pct = Math.round(Math.min(ratio, 9.99) * 100);

  let appsLabel = pluralApps(settled.apps);
  if (award.kind === 'campaign' && target.apps != null) appsLabel = `${settled.apps} of ${target.apps} apps`;

  const targetLabel = !hasRing ? null
    : award.kind === 'campaign' && target.tier?.name
      ? `${formatWhole(target.api)} (${target.tier.name})`
      : formatWhole(target.api);

  return {
    eyebrow: eyebrow(award),
    chip: daysChip(award, today),
    title: title(award),
    hasRing,
    pct,
    ringAria: hasRing
      ? `Settled ${pct} percent, with submitted ${Math.round(ratioWithPending * 100)} percent`
      : null,
    settledLabel: formatWhole(settled.api),
    targetLabel,
    appsLabel,
    pendingLabel: formatWhole(pending.api),
    pendingAppsLabel: award.closed ? '—' : pluralApps(pending.apps),
    line1,
    line2,
    pace,
  };
}

/** "Champion: TTD 275,000 API + 35 apps · TTD 7,000 cash" — the tier picker's detail line (D1). */
export function tierDetailLine(tier) {
  if (!tier) return '';
  const parts = [`${tier.name}: TTD ${formatWhole(tier.api)} API`];
  if (Number.isFinite(Number(tier.apps)) && tier.apps != null) parts[0] += ` + ${tier.apps} apps`;
  if (Number.isFinite(Number(tier.cash)) && tier.cash != null) parts.push(`TTD ${formatWhole(tier.cash)} cash`);
  return parts.join(' · ');
}
