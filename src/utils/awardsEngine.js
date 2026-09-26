// Pure computation engine — zero Firebase imports, zero side effects
import { extractFields, extractTotalProductionCredit } from './extractFields';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';
import { MDRT_THRESHOLDS_2026 } from '../config/mdrtThresholds/2026';

const p = (v) => parseFloat(v) || 0;

function getQuarter(date) {
  const m = date.getMonth();
  if (m < 3) return 1;
  if (m < 6) return 2;
  if (m < 9) return 3;
  return 4;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getQuarterMonths(quarter, year) {
  const starts = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };
  return starts[quarter].map((m) => monthKey(year, m));
}

function avgPersistency(docs) {
  const vals = docs.map((d) => p(d.persistency)).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function makeAward({ id, name, category, eligible, inContention, criteria, prize, dataSource, progressPercent, note = null }) {
  return {
    id, name, category, eligible, inContention, criteria, prize, dataSource,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    note,
  };
}

function criterion(label, target, current, unit) {
  return { label, target, current, met: current >= target, unit };
}

// ──────────────────────────────────────────────────────
// computeAgentAwards
// confirmedData: array of settlement docs { periodKey, settledAPI, settledApps, persistency, ... }
// submittedData: array of submission docs
// agentProfile: user doc { monthsInIndustry, monthsAtTatil, isBdoDso, ... }
// currentDate: Date or date string
// ruleset: award rules data (defaults to DEFAULT_RULESET_2026)
// ──────────────────────────────────────────────────────
// ─── Rule 10 · a campaign may suppress award CASH (C4) ───────────────────────
//
// "This campaign overrides all other campaigns and incentives in progress - no
// cash for Agent of the Month or Agent/Manager of the Quarter. Recognition
// only." (page 4 of the signed document.)
//
// The awards are still WON. Only the cash is withheld, so `eligible`,
// `inContention` and every criterion are untouched — removing eligibility would
// erase the recognition the document explicitly keeps. This changes one string.
const RECOGNITION_ONLY = (campaignName) => `Recognition only — cash suspended by ${campaignName}`;

/** Days a campaign covers, as YYYY-MM-DD strings, for the month/quarter test. */
function campaignCoversMonth(campaign, year, monthNum) {
  const start = String(campaign?.startDate ?? '').slice(0, 7);
  const end = String(campaign?.endDate ?? '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return false;
  const key = `${year}-${String(monthNum).padStart(2, '0')}`;
  return key >= start && key <= end;
}

/**
 * The first flagged campaign covering ANY month in `months`, or null.
 *
 * A quarter is suppressed when the campaign covers any month of it: the
 * campaign overrides "incentives in progress", and a quarter that overlaps the
 * campaign at all is in progress during it.
 */
function suppressingCampaign(activeCampaigns, year, months) {
  for (const c of Array.isArray(activeCampaigns) ? activeCampaigns : []) {
    if (!c?.suppressesAwardCash) continue;
    if (months.some((m) => campaignCoversMonth(c, year, m))) return c;
  }
  return null;
}

export function computeAgentAwards(confirmedData, submittedData, agentProfile, currentDate, ruleset = DEFAULT_RULESET_2026, activeCampaigns = []) {
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = getQuarter(now);

  // Rule 10 — resolved once, applied to the four advisor-month / quarterly
  // prize strings below. Everything else about those awards is untouched.
  const monthSuppressor = suppressingCampaign(activeCampaigns, year, [month]);
  const quarterSuppressor = suppressingCampaign(activeCampaigns, year, getQuarterMonths(quarter, year).map((k) => Number(String(k).slice(5, 7))));
  const monthPrize = (p) => (monthSuppressor ? RECOGNITION_ONLY(monthSuppressor.name ?? 'the active campaign') : p);
  const quarterPrize = (p) => (quarterSuppressor ? RECOGNITION_ONLY(quarterSuppressor.name ?? 'the active campaign') : p);
  const suppressNote = (existing, s2) => (s2
    ? `Cash suspended by ${s2.name ?? 'the active campaign'} — the award is still won${existing ? `. ${existing}` : ''}`
    : existing);

  const curMonthKey = monthKey(year, month);
  const quarterMonths = getQuarterMonths(quarter, year);
  const yearKeys = Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));

  const confirmed = confirmedData ?? [];
  const submitted = submittedData ?? [];
  const profile = agentProfile ?? {};

  const monthsInIndustry = p(profile.monthsInIndustry);
  const monthsAtTatil = p(profile.monthsAtTatil);
  const isBdoDso = Boolean(profile.isBdoDso);

  // ── Monthly aggregation ──
  const monthlyConf = confirmed.filter((d) => d.periodKey === curMonthKey);
  let monthlyAPI, monthlyApps, monthlyPersist, monthlySource;

  if (monthlyConf.length > 0) {
    monthlyAPI = monthlyConf.reduce((s, d) => s + p(d.settledAPI), 0);
    monthlyApps = monthlyConf.reduce((s, d) => s + p(d.settledApps), 0);
    monthlyPersist = avgPersistency(monthlyConf);
    monthlySource = 'confirmed';
  } else {
    const mSubs = submitted.filter(
      (s) => s.status === 'submitted' && (s.weekStarting ?? '').startsWith(curMonthKey)
    );
    monthlyAPI = mSubs.reduce((s, sub) => s + extractTotalProductionCredit(sub), 0);
    monthlyApps = mSubs.reduce((s, sub) => s + p(extractFields(sub).applicationsSold), 0);
    monthlyPersist = 0;
    monthlySource = 'estimated';
  }

  // ── Quarterly aggregation ──
  const quarterlyConf = confirmed.filter((d) => quarterMonths.includes(d.periodKey));
  let quarterlyAPI, quarterlyApps, quarterlyPersist, quarterlySource;

  if (quarterlyConf.length > 0) {
    quarterlyAPI = quarterlyConf.reduce((s, d) => s + p(d.settledAPI), 0);
    quarterlyApps = quarterlyConf.reduce((s, d) => s + p(d.settledApps), 0);
    quarterlyPersist = avgPersistency(quarterlyConf);
    quarterlySource = 'confirmed';
  } else {
    const qSubs = submitted.filter((s) => {
      if (s.status !== 'submitted') return false;
      return quarterMonths.some((mk) => (s.weekStarting ?? '').startsWith(mk));
    });
    quarterlyAPI = qSubs.reduce((s, sub) => s + extractTotalProductionCredit(sub), 0);
    quarterlyApps = qSubs.reduce((s, sub) => s + p(extractFields(sub).applicationsSold), 0);
    quarterlyPersist = 0;
    quarterlySource = 'estimated';
  }

  // ── Annual aggregation ──
  const annualConf = confirmed.filter((d) => yearKeys.includes(d.periodKey));
  let annualAPI = annualConf.reduce((s, d) => s + p(d.settledAPI), 0);
  let annualApps = annualConf.reduce((s, d) => s + p(d.settledApps), 0);
  const confirmedMonthKeys = new Set(annualConf.map((d) => d.periodKey));

  // Supplement missing months from submitted data
  const yearSubs = submitted.filter(
    (s) => s.status === 'submitted' && (s.weekStarting ?? '').startsWith(String(year))
  );
  const subsByMonth = {};
  yearSubs.forEach((s) => {
    const mk = (s.weekStarting ?? '').substring(0, 7);
    if (!mk) return;
    if (!subsByMonth[mk]) subsByMonth[mk] = { api: 0, apps: 0, pppApps: 0 };
    subsByMonth[mk].api += extractTotalProductionCredit(s);
    subsByMonth[mk].apps += p(extractFields(s).applicationsSold);
    subsByMonth[mk].pppApps += parseInt(s.pppIncreases?.apps, 10) || 0;
  });

  let annualSource = 'confirmed';
  let estPppApps = 0;
  yearKeys.forEach((mk) => {
    if (!confirmedMonthKeys.has(mk) && subsByMonth[mk]) {
      annualAPI += subsByMonth[mk].api;
      annualApps += subsByMonth[mk].apps;
      estPppApps += subsByMonth[mk].pppApps;
      annualSource = 'estimated';
    }
  });
  // Centurion counts PPP increases as apps, capped per ruleset
  const centurionApps = annualApps + Math.min(estPppApps, ruleset.centurionAward.pppCap);

  const confPersistVals = annualConf.map((d) => p(d.persistency)).filter((v) => v > 0);
  const annualPersist = confPersistVals.length > 0
    ? confPersistVals.reduce((s, v) => s + v, 0) / confPersistVals.length
    : 0;

  // Self/family business is excluded from every award's API and apps, but
  // MDRT still counts it (Kyron, 23 Sep 2026). Only Policy Ledger rows carry
  // `selfFamilyAPI` (awardRowsFromLedger); settlement rows read 0.
  const mdrtAPI = annualAPI + annualConf.reduce((s, d) => s + p(d.selfFamilyAPI), 0);

  const annualNote = annualSource === 'estimated' ? 'Estimated — pending Tatil Life confirmation' : null;
  const monthlyNote = monthlySource === 'estimated' ? 'Estimated — pending Tatil Life confirmation' : null;
  const quarterlyNote = quarterlySource === 'estimated' ? 'Estimated — pending Tatil Life confirmation' : null;

  const awards = {};

  // ── MONTHLY ──
  if (!isBdoDso || !ruleset.advisorMonth.excludesBdoDso) {
    const mPersOk = monthlyPersist >= ruleset.advisorMonth.persistGate || monthlySource === 'estimated';

    awards.advisor_month_api = makeAward({
      id: 'advisor_month_api', name: 'Advisor of the Month — API', category: 'monthly',
      eligible: monthlyAPI >= ruleset.advisorMonth.api.threshold && mPersOk,
      inContention: monthlyAPI >= ruleset.advisorMonth.api.inContention && monthlyAPI < ruleset.advisorMonth.api.threshold,
      criteria: [
        criterion('Monthly API', ruleset.advisorMonth.api.threshold, monthlyAPI, 'TTD'),
        criterion('Persistency', ruleset.advisorMonth.persistGate, monthlyPersist, '%'),
      ],
      prize: monthPrize(ruleset.advisorMonth.api.prize),
      dataSource: monthlySource, progressPercent: (monthlyAPI / ruleset.advisorMonth.api.threshold) * 100, note: suppressNote(monthlyNote, monthSuppressor),
    });

    awards.advisor_month_apps = makeAward({
      id: 'advisor_month_apps', name: 'Advisor of the Month — Apps', category: 'monthly',
      eligible: monthlyApps >= ruleset.advisorMonth.apps.threshold && mPersOk,
      inContention: monthlyApps >= ruleset.advisorMonth.apps.inContention && monthlyApps < ruleset.advisorMonth.apps.threshold,
      criteria: [
        criterion('Monthly Apps', ruleset.advisorMonth.apps.threshold, monthlyApps, 'apps'),
        criterion('Persistency', ruleset.advisorMonth.persistGate, monthlyPersist, '%'),
      ],
      prize: monthPrize(ruleset.advisorMonth.apps.prize),
      dataSource: monthlySource, progressPercent: (monthlyApps / ruleset.advisorMonth.apps.threshold) * 100, note: suppressNote(monthlyNote, monthSuppressor),
    });
  }

  // ── QUARTERLY ──
  const qPersOk = quarterlyPersist >= ruleset.quarterlyAward.persistGate || quarterlySource === 'estimated';

  awards.quarterly_api = makeAward({
    id: 'quarterly_api', name: 'Quarterly API Award', category: 'quarterly',
    eligible: quarterlyAPI >= ruleset.quarterlyAward.api.threshold && qPersOk,
    inContention: quarterlyAPI >= ruleset.quarterlyAward.api.inContention && quarterlyAPI < ruleset.quarterlyAward.api.threshold,
    criteria: [
      criterion('Quarterly Net API', ruleset.quarterlyAward.api.threshold, quarterlyAPI, 'TTD'),
      criterion('Persistency', ruleset.quarterlyAward.persistGate, quarterlyPersist, '%'),
    ],
    prize: quarterPrize(ruleset.quarterlyAward.api.prize),
    dataSource: quarterlySource, progressPercent: (quarterlyAPI / ruleset.quarterlyAward.api.threshold) * 100, note: suppressNote(quarterlyNote, quarterSuppressor),
  });

  awards.quarterly_apps = makeAward({
    id: 'quarterly_apps', name: 'Quarterly Apps Award', category: 'quarterly',
    eligible: quarterlyApps >= ruleset.quarterlyAward.apps.threshold && qPersOk,
    inContention: quarterlyApps >= ruleset.quarterlyAward.apps.inContention && quarterlyApps < ruleset.quarterlyAward.apps.threshold,
    criteria: [
      criterion('Quarterly Apps', ruleset.quarterlyAward.apps.threshold, quarterlyApps, 'apps'),
      criterion('Persistency', ruleset.quarterlyAward.persistGate, quarterlyPersist, '%'),
    ],
    prize: quarterPrize(ruleset.quarterlyAward.apps.prize),
    dataSource: quarterlySource, progressPercent: (quarterlyApps / ruleset.quarterlyAward.apps.threshold) * 100, note: suppressNote(quarterlyNote, quarterSuppressor),
  });

  // ── ANNUAL ──
  awards.persistency_silver = makeAward({
    id: 'persistency_silver', name: 'Persistency Award — Silver', category: 'annual',
    eligible: annualAPI >= ruleset.persistencyAward.silver.apiThreshold && annualApps >= ruleset.persistencyAward.silver.appsThreshold && annualPersist >= ruleset.persistencyAward.silver.persistGate,
    inContention: annualAPI >= ruleset.persistencyAward.silver.apiInContention && annualApps >= ruleset.persistencyAward.silver.appsInContention,
    criteria: [
      criterion('Annual API', ruleset.persistencyAward.silver.apiThreshold, annualAPI, 'TTD'),
      criterion('Annual Apps', ruleset.persistencyAward.silver.appsThreshold, annualApps, 'apps'),
      criterion('Avg Persistency', ruleset.persistencyAward.silver.persistGate, annualPersist, '%'),
    ],
    prize: ruleset.persistencyAward.silver.prize,
    dataSource: annualSource, progressPercent: (annualAPI / ruleset.persistencyAward.silver.apiThreshold) * 100, note: annualNote,
  });

  awards.persistency_gold = makeAward({
    id: 'persistency_gold', name: 'Persistency Award — Gold', category: 'annual',
    eligible: annualAPI >= ruleset.persistencyAward.gold.apiThreshold && annualApps >= ruleset.persistencyAward.gold.appsThreshold && annualPersist >= ruleset.persistencyAward.gold.persistGate,
    inContention: annualAPI >= ruleset.persistencyAward.gold.apiInContention && annualPersist >= ruleset.persistencyAward.gold.persistInContention,
    criteria: [
      criterion('Annual API', ruleset.persistencyAward.gold.apiThreshold, annualAPI, 'TTD'),
      criterion('Annual Apps', ruleset.persistencyAward.gold.appsThreshold, annualApps, 'apps'),
      criterion('Avg Persistency', ruleset.persistencyAward.gold.persistGate, annualPersist, '%'),
    ],
    prize: ruleset.persistencyAward.gold.prize,
    dataSource: annualSource, progressPercent: (annualAPI / ruleset.persistencyAward.gold.apiThreshold) * 100, note: annualNote,
  });

  if (monthsInIndustry <= ruleset.rookieAward.maxMonthsInIndustry || monthsInIndustry === 0) {
    awards.rookie_of_year = makeAward({
      id: 'rookie_of_year', name: 'Rookie of the Year', category: 'annual',
      eligible: annualAPI >= ruleset.rookieAward.apiThreshold && annualApps >= ruleset.rookieAward.appsThreshold && annualPersist >= ruleset.rookieAward.persistGate,
      inContention: annualAPI >= ruleset.rookieAward.apiInContention && annualApps >= ruleset.rookieAward.appsInContention,
      criteria: [
        criterion('Annual API', ruleset.rookieAward.apiThreshold, annualAPI, 'TTD'),
        criterion('Annual Apps', ruleset.rookieAward.appsThreshold, annualApps, 'apps'),
        criterion('Avg Persistency', ruleset.rookieAward.persistGate, annualPersist, '%'),
      ],
      prize: ruleset.rookieAward.prize,
      dataSource: annualSource, progressPercent: (annualAPI / ruleset.rookieAward.apiThreshold) * 100, note: annualNote,
    });
  }

  if (monthsAtTatil <= ruleset.newBsAward.maxMonthsAtTatil || monthsAtTatil === 0) {
    awards.new_bs_award = makeAward({
      id: 'new_bs_award', name: 'New Business Advisor Award', category: 'annual',
      eligible: annualAPI >= ruleset.newBsAward.apiThreshold && annualApps >= ruleset.newBsAward.appsThreshold && annualPersist >= ruleset.newBsAward.persistGate,
      inContention: annualAPI >= ruleset.newBsAward.apiInContention && annualApps >= ruleset.newBsAward.appsInContention,
      criteria: [
        criterion('Annual API', ruleset.newBsAward.apiThreshold, annualAPI, 'TTD'),
        criterion('Annual Apps', ruleset.newBsAward.appsThreshold, annualApps, 'apps'),
        criterion('Avg Persistency', ruleset.newBsAward.persistGate, annualPersist, '%'),
      ],
      prize: ruleset.newBsAward.prize,
      dataSource: annualSource, progressPercent: (annualAPI / ruleset.newBsAward.apiThreshold) * 100, note: annualNote,
    });
  }

  awards.centurion = makeAward({
    id: 'centurion', name: 'Centurion Award', category: 'annual',
    eligible: centurionApps >= ruleset.centurionAward.appsThreshold && annualPersist >= ruleset.centurionAward.persistGate,
    inContention: centurionApps >= ruleset.centurionAward.appsInContention && centurionApps < ruleset.centurionAward.appsThreshold,
    criteria: [
      criterion('Annual Apps', ruleset.centurionAward.appsThreshold, centurionApps, 'apps'),
      criterion('Avg Persistency', ruleset.centurionAward.persistGate, annualPersist, '%'),
    ],
    prize: ruleset.centurionAward.prize,
    dataSource: annualSource, progressPercent: (centurionApps / ruleset.centurionAward.appsThreshold) * 100, note: annualNote,
  });

  // ── CLUB ──
  const clubApps = annualApps >= ruleset.clubAward.appsMin;
  const clubPers = annualPersist >= ruleset.clubAward.persistGate;

  ruleset.clubAward.tiers.forEach((tier) => {
    const { id, name, apiMin, apiMax, apiInContention, prize } = tier;
    const inContentionUpperBound = apiMax !== null ? apiMax : apiMin;
    const bandLabel = apiMax !== null
      ? `Annual API ($${apiMin / 1000}K–$${apiMax / 1000 - 1}K)`
      : `Annual API (≥$${apiMin / 1000}K)`;
    awards[id] = makeAward({
      id, name, category: 'club',
      eligible: annualAPI >= apiMin && (apiMax === null || annualAPI < apiMax) && clubApps && clubPers,
      inContention: annualAPI >= apiInContention && annualAPI < inContentionUpperBound && annualApps >= ruleset.clubAward.appsInContention,
      criteria: [
        criterion(bandLabel, apiMin, annualAPI, 'TTD'),
        criterion('Annual Apps', ruleset.clubAward.appsMin, annualApps, 'apps'),
        criterion('Avg Persistency', ruleset.clubAward.persistGate, annualPersist, '%'),
      ],
      prize,
      dataSource: annualSource, progressPercent: (annualAPI / (apiMax ?? apiMin)) * 100, note: annualNote,
    });
  });

  if (!isBdoDso || !ruleset.agentOfYearAward.excludesBdoDso) {
    awards.agent_of_year = makeAward({
      id: 'agent_of_year', name: 'Agent of the Year', category: 'annual',
      eligible: annualAPI >= ruleset.agentOfYearAward.apiThreshold && annualApps >= ruleset.agentOfYearAward.appsThreshold && annualPersist >= ruleset.agentOfYearAward.persistGate,
      inContention: annualAPI >= ruleset.agentOfYearAward.apiInContention && annualApps >= ruleset.agentOfYearAward.appsInContention,
      criteria: [
        criterion('Annual API', ruleset.agentOfYearAward.apiThreshold, annualAPI, 'TTD'),
        criterion('Annual Apps', ruleset.agentOfYearAward.appsThreshold, annualApps, 'apps'),
        criterion('Avg Persistency', ruleset.agentOfYearAward.persistGate, annualPersist, '%'),
      ],
      prize: ruleset.agentOfYearAward.prize,
      dataSource: annualSource, progressPercent: (annualAPI / ruleset.agentOfYearAward.apiThreshold) * 100, note: annualNote,
    });
  }

  awards.mdrt = makeAward({
    id: 'mdrt', name: 'MDRT', category: 'annual',
    eligible: mdrtAPI >= ruleset.mdrtAward.apiThreshold,
    inContention: mdrtAPI >= ruleset.mdrtAward.apiInContention && mdrtAPI < ruleset.mdrtAward.apiThreshold,
    criteria: [criterion('Annual API', ruleset.mdrtAward.apiThreshold, mdrtAPI, 'TTD')],
    prize: ruleset.mdrtAward.prize,
    dataSource: annualSource, progressPercent: (mdrtAPI / ruleset.mdrtAward.apiThreshold) * 100, note: annualNote,
  });

  return awards;
}

// ──────────────────────────────────────────────────────
// computeManagerAwards
// confirmedData: all settlement docs for agents in scope
// unitAgentIds: array of agent UIDs
// allAgentConfirmed: not used separately (merged into confirmedData)
// recruitData: { newAdvisors: number }
// currentDate: Date
// role: 'unit_manager' | 'branch_manager'
// ruleset: award rules data (defaults to DEFAULT_RULESET_2026)
// ──────────────────────────────────────────────────────
export function computeManagerAwards(confirmedData, unitAgentIds, allAgentConfirmed, recruitData, currentDate, role, ruleset = DEFAULT_RULESET_2026) {
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const curMonthKey = monthKey(year, month);
  const yearKeys = Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));

  const confirmed = confirmedData ?? [];
  const agentIds = unitAgentIds ?? [];
  const agentCount = agentIds.length;
  const newAdvisors = p(recruitData?.newAdvisors);

  // Monthly: avg settled API per advisor
  const monthConf = confirmed.filter((d) => d.periodKey === curMonthKey);
  const monthTotalAPI = monthConf.reduce((s, d) => s + p(d.settledAPI), 0);
  const avgMonthlyAPI = agentCount > 0 ? monthTotalAPI / agentCount : 0;

  const sortedBonusTiers = [...ruleset.managerMonthlyBonus.tiers].sort((a, b) => b.minAvgApi - a.minAvgApi);
  let bonusPct = 0;
  let nextTier = null;
  let matchIdx = -1;

  for (let i = 0; i < sortedBonusTiers.length; i++) {
    if (avgMonthlyAPI >= sortedBonusTiers[i].minAvgApi) {
      bonusPct = sortedBonusTiers[i].bonusPct;
      matchIdx = i;
      break;
    }
  }

  if (matchIdx > 0) {
    nextTier = { threshold: sortedBonusTiers[matchIdx - 1].minAvgApi, pct: sortedBonusTiers[matchIdx - 1].bonusPct };
  } else if (matchIdx === -1) {
    const lowestTier = sortedBonusTiers[sortedBonusTiers.length - 1];
    nextTier = { threshold: lowestTier.minAvgApi, pct: lowestTier.bonusPct };
  }

  const bonusAmount = monthTotalAPI * (bonusPct / 100);

  const awards = {};

  awards.agency_monthly_bonus = {
    id: 'agency_monthly_bonus',
    name: 'Agency Monthly Production Bonus',
    category: 'monthly',
    currentTier: bonusPct,
    bonusPct,
    bonusAmount,
    avgMonthlyAPI,
    nextTier,
    note: monthConf.length === 0 ? 'Estimated from submitted data' : null,
  };

  // Annual aggregation per agent
  const annualConf = confirmed.filter((d) => yearKeys.includes(d.periodKey));
  const agentData = {};
  agentIds.forEach((id) => {
    const docs = annualConf.filter((d) => d.agentId === id);
    agentData[id] = {
      api: docs.reduce((s, d) => s + p(d.settledAPI), 0),
      apps: docs.reduce((s, d) => s + p(d.settledApps), 0),
      persist: avgPersistency(docs),
    };
  });

  const agentVals = Object.values(agentData);
  const totalAPI = agentVals.reduce((s, a) => s + a.api, 0);
  const totalApps = agentVals.reduce((s, a) => s + a.apps, 0);
  const avgAPIPerAdvisor = agentCount > 0 ? totalAPI / agentCount : 0;
  const avgAppsPerAdvisor = agentCount > 0 ? totalApps / agentCount : 0;
  const persistVals = agentVals.map((a) => a.persist).filter((v) => v > 0);
  const avgPersist = persistVals.length > 0 ? persistVals.reduce((s, v) => s + v, 0) / persistVals.length : 0;

  const dataSource = annualConf.length > 0 ? 'confirmed' : 'estimated';
  const note = dataSource === 'estimated' ? 'Estimated — pending confirmation' : null;

  // Recruiting
  ruleset.recruitingAwards.forEach(({ id, name, min, max, prize }) => {
    const eligible = max !== null ? (newAdvisors >= min && newAdvisors <= max) : newAdvisors >= min;
    awards[id] = {
      id, name, category: 'annual', eligible,
      inContention: !eligible && newAdvisors >= Math.ceil(min / 2),
      criteria: [{ label: 'Net New Advisors', target: min, current: newAdvisors, met: newAdvisors >= min, unit: 'advisors' }],
      prize, dataSource, progressPercent: Math.min(100, (newAdvisors / min) * 100), note,
    };
  });

  // Activity
  ruleset.activityAwards.forEach(({ id, name, target, prize }) => {
    const eligible = avgAppsPerAdvisor >= target;
    awards[id] = {
      id, name, category: 'annual', eligible,
      inContention: !eligible && avgAppsPerAdvisor >= target * 0.5,
      criteria: [{ label: 'Avg Apps / Advisor', target, current: Math.round(avgAppsPerAdvisor), met: eligible, unit: 'apps' }],
      prize, dataSource, progressPercent: Math.min(100, (avgAppsPerAdvisor / target) * 100), note,
    };
  });

  // Production
  const prodAPImet = avgAPIPerAdvisor >= ruleset.managerProductionAward.avgApiThreshold;
  const prodPersMet = avgPersist >= ruleset.managerProductionAward.persistGate;
  awards.production_award = {
    id: 'production_award', name: 'Production Award', category: 'annual',
    eligible: prodAPImet && prodPersMet,
    inContention: !prodAPImet || !prodPersMet ? avgAPIPerAdvisor >= ruleset.managerProductionAward.avgApiInContention : false,
    criteria: [
      { label: 'Avg API / Advisor', target: ruleset.managerProductionAward.avgApiThreshold, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: ruleset.managerProductionAward.persistGate, current: Math.round(avgPersist), met: prodPersMet, unit: '%' },
    ],
    prize: ruleset.managerProductionAward.prize, dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / ruleset.managerProductionAward.avgApiThreshold) * 100), note,
  };

  awards.persistency_silver = {
    id: 'persistency_silver', name: 'Agency Persistency — Silver', category: 'annual',
    eligible: prodAPImet && avgPersist >= ruleset.managerPersistencyAward.silver.persistGate,
    inContention: avgAPIPerAdvisor >= ruleset.managerPersistencyAward.silver.avgApiInContention && avgPersist >= ruleset.managerPersistencyAward.silver.persistInContention,
    criteria: [
      { label: 'Avg API / Advisor', target: ruleset.managerProductionAward.avgApiThreshold, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: ruleset.managerPersistencyAward.silver.persistGate, current: Math.round(avgPersist), met: avgPersist >= ruleset.managerPersistencyAward.silver.persistGate, unit: '%' },
    ],
    prize: ruleset.managerPersistencyAward.silver.prize, dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / ruleset.managerProductionAward.avgApiThreshold) * 100), note,
  };

  awards.persistency_gold = {
    id: 'persistency_gold', name: 'Agency Persistency — Gold', category: 'annual',
    eligible: prodAPImet && avgPersist >= ruleset.managerPersistencyAward.gold.persistGate,
    inContention: avgAPIPerAdvisor >= ruleset.managerPersistencyAward.gold.avgApiInContention && avgPersist >= ruleset.managerPersistencyAward.gold.persistInContention,
    criteria: [
      { label: 'Avg API / Advisor', target: ruleset.managerProductionAward.avgApiThreshold, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: ruleset.managerPersistencyAward.gold.persistGate, current: Math.round(avgPersist), met: avgPersist >= ruleset.managerPersistencyAward.gold.persistGate, unit: '%' },
    ],
    prize: ruleset.managerPersistencyAward.gold.prize, dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / ruleset.managerProductionAward.avgApiThreshold) * 100), note,
  };

  if (role === 'unit_manager') {
    const eligible = totalAPI >= ruleset.unitOfYearAward.totalApiThreshold
      && avgAPIPerAdvisor >= ruleset.unitOfYearAward.avgApiThreshold
      && agentCount >= ruleset.unitOfYearAward.agentCountMin
      && newAdvisors >= ruleset.unitOfYearAward.newAdvisorsMin
      && avgPersist >= ruleset.unitOfYearAward.persistGate;
    awards.unit_of_year = {
      id: 'unit_of_year', name: 'Unit of the Year', category: 'annual',
      eligible, inContention: !eligible && totalAPI >= ruleset.unitOfYearAward.totalApiInContention,
      criteria: [
        { label: 'Total Unit API', target: ruleset.unitOfYearAward.totalApiThreshold, current: Math.round(totalAPI), met: totalAPI >= ruleset.unitOfYearAward.totalApiThreshold, unit: 'TTD' },
        { label: 'Avg API / Advisor', target: ruleset.unitOfYearAward.avgApiThreshold, current: Math.round(avgAPIPerAdvisor), met: avgAPIPerAdvisor >= ruleset.unitOfYearAward.avgApiThreshold, unit: 'TTD' },
        { label: 'Advisors', target: ruleset.unitOfYearAward.agentCountMin, current: agentCount, met: agentCount >= ruleset.unitOfYearAward.agentCountMin, unit: 'advisors' },
        { label: 'New Recruits', target: ruleset.unitOfYearAward.newAdvisorsMin, current: newAdvisors, met: newAdvisors >= ruleset.unitOfYearAward.newAdvisorsMin, unit: 'advisors' },
        { label: 'Avg Persistency', target: ruleset.unitOfYearAward.persistGate, current: Math.round(avgPersist), met: avgPersist >= ruleset.unitOfYearAward.persistGate, unit: '%' },
      ],
      prize: ruleset.unitOfYearAward.prize, dataSource, progressPercent: Math.min(100, (totalAPI / ruleset.unitOfYearAward.totalApiThreshold) * 100), note,
    };
  }

  if (role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin') {
    const eligible = totalAPI >= ruleset.agencyOfYearAward.totalApiThreshold
      && avgAPIPerAdvisor >= ruleset.agencyOfYearAward.avgApiThreshold
      && agentCount >= ruleset.agencyOfYearAward.agentCountMin
      && newAdvisors >= ruleset.agencyOfYearAward.newAdvisorsMin
      && avgPersist >= ruleset.agencyOfYearAward.persistGate;
    awards.agency_of_year = {
      id: 'agency_of_year', name: 'Agency of the Year', category: 'annual',
      eligible, inContention: !eligible && totalAPI >= ruleset.agencyOfYearAward.totalApiInContention,
      criteria: [
        { label: 'Total Agency API', target: ruleset.agencyOfYearAward.totalApiThreshold, current: Math.round(totalAPI), met: totalAPI >= ruleset.agencyOfYearAward.totalApiThreshold, unit: 'TTD' },
        { label: 'Avg API / Advisor', target: ruleset.agencyOfYearAward.avgApiThreshold, current: Math.round(avgAPIPerAdvisor), met: avgAPIPerAdvisor >= ruleset.agencyOfYearAward.avgApiThreshold, unit: 'TTD' },
        { label: 'Advisors', target: ruleset.agencyOfYearAward.agentCountMin, current: agentCount, met: agentCount >= ruleset.agencyOfYearAward.agentCountMin, unit: 'advisors' },
        { label: 'New Recruits', target: ruleset.agencyOfYearAward.newAdvisorsMin, current: newAdvisors, met: newAdvisors >= ruleset.agencyOfYearAward.newAdvisorsMin, unit: 'advisors' },
        { label: 'Avg Persistency', target: ruleset.agencyOfYearAward.persistGate, current: Math.round(avgPersist), met: avgPersist >= ruleset.agencyOfYearAward.persistGate, unit: '%' },
      ],
      prize: ruleset.agencyOfYearAward.prize, dataSource, progressPercent: Math.min(100, (totalAPI / ruleset.agencyOfYearAward.totalApiThreshold) * 100), note,
    };
  }

  return awards;
}

// ──────────────────────────────────────────────────────
// computeAtRiskStatus
// award: a single award object from computeAgentAwards (makeAward shape)
// { weeksElapsed, periodWeeks }: period context supplied by the caller
//   - annual:    weeksElapsed = ISO week of year; periodWeeks = 52
//   - monthly:   weeksElapsed = weeks elapsed in month; periodWeeks = daysInMonth / 7
//   - quarterly: weeksElapsed = weeks elapsed in quarter; periodWeeks = 13
// Returns: 'achieved' | 'on_track' | 'at_risk' | 'far_off'
// ──────────────────────────────────────────────────────
export function computeAtRiskStatus(award, { weeksElapsed, periodWeeks }) {
  if (award.eligible) return 'achieved';
  const notMet = (award.criteria ?? []).filter((c) => !c.met);
  const onTrack = weeksElapsed > 0
    && notMet.every((c) => (c.current / weeksElapsed) * periodWeeks >= c.target);
  if (onTrack) return 'on_track';
  return award.inContention ? 'at_risk' : 'far_off';
}

// ──────────────────────────────────────────────────────
// computeAwardPace
// Pace-to-qualify narrative for an award's primary (first) criterion.
//
// Derivation (§2.7 — honesty rule): avg-per-week = criterion.current ÷
// weeksElapsed-in-period, where weeksElapsed is the SAME value getPeriodCtx
// already produces for computeAtRiskStatus above. This is the only rate the
// loaded data honestly supports — submissions are read-light here (the panel
// does not carry a guaranteed per-week breakdown for every award's
// aggregation window, since monthly/quarterly/annual/club windows all
// differ), but "period-total ÷ elapsed-weeks" is always derivable the moment
// weeksElapsed is known. This mirrors YTD-credit ÷ ISO-weeks-elapsed for the
// annual/club case and generalizes to monthly/quarterly via the same
// getPeriodCtx weeksElapsed.
//
// Only meaningful for cumulative (non-ratio) criteria: '%'-unit criteria
// (e.g. persistency) are not a "per-week" quantity — dividing a persistency
// average by elapsed weeks does not describe a real rate — so this returns
// null for those, and callers render no pace narrative.
//
// award: a single award object (makeAward shape, criteria[0] is primary)
// weeksElapsed: number, from getPeriodCtx(award.category, currentDate)
// currentDate: Date (or parseable) — used only to project a qualify date
// Returns null (no primary criterion, or a '%'-unit criterion) or:
//   { avgPerWeek, unit, gap, weeksToQualify, hasPace, projectedDateISO }
//   - weeksToQualify / projectedDateISO are null when avgPerWeek <= 0 (no
//     pace yet) or when gap <= 0 (criterion already met) — callers render an
//     honest "no pace yet" fallback rather than Infinity/NaN in either case.
// ──────────────────────────────────────────────────────
export function computeAwardPace(award, weeksElapsed, currentDate) {
  const prim = award?.criteria?.[0];
  if (!prim || prim.unit === '%') return null;

  const target = p(prim.target);
  const current = p(prim.current);
  const gap = Math.max(0, target - current);
  const avgPerWeek = weeksElapsed > 0 ? current / weeksElapsed : 0;
  const hasPace = avgPerWeek > 0;

  let weeksToQualify = null;
  let projectedDateISO = null;
  if (hasPace && gap > 0) {
    weeksToQualify = Math.max(1, Math.ceil(gap / avgPerWeek));
    const now = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
    const projected = new Date(now.getTime() + weeksToQualify * 7 * 86400000);
    projectedDateISO = projected.toISOString().slice(0, 10);
  }

  return { avgPerWeek, unit: prim.unit, gap, weeksToQualify, hasPace, projectedDateISO };
}

// ──────────────────────────────────────────────────────
// computeRatioTrends
// submissions: array of submission docs
// ──────────────────────────────────────────────────────
export function computeRatioTrends(submissions) {
  const empty = { trailing4w: 0, trailing12w: 0, trend: 'flat' };
  if (!submissions || submissions.length === 0) {
    return { ciToSaleRatio: empty, dialsToCIRatio: empty, avgPolicySize: empty, ffiToDialRatio: empty };
  }

  const sorted = [...submissions]
    .filter((s) => s.status === 'submitted')
    .sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''));

  const last4  = sorted.slice(0, 4);
  const last12 = sorted.slice(0, 12);

  const getApps  = (s) => p(extractFields(s).applicationsSold);
  const getCI    = (s) => p(s.ciConducted);
  const getDials = (s) => p(s.referralCalls) + p(s.followUpCalls) + p(s.coldCalls) + p(s.seminarTradeshowCalls);
  const getAPI   = (s) => extractTotalProductionCredit(s);
  const getFFI   = (s) => p(s.ffiConducted);

  function avgRatio(subs, numFn, denFn) {
    const vals = subs
      .map((s) => { const d = denFn(s); return d > 0 ? numFn(s) / d : null; })
      .filter((v) => v !== null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  function trend(w4, w12) {
    if (w12 === 0) return 'flat';
    const delta = (w4 - w12) / w12;
    if (delta > 0.05) return 'up';
    if (delta < -0.05) return 'down';
    return 'flat';
  }

  const ciSale4   = avgRatio(last4,  getCI,    getApps);
  const ciSale12  = avgRatio(last12, getCI,    getApps);
  const diCI4     = avgRatio(last4,  getDials, getCI);
  const diCI12    = avgRatio(last12, getDials, getCI);
  const ap4       = avgRatio(last4,  getAPI,   getApps);
  const ap12      = avgRatio(last12, getAPI,   getApps);
  const ffi4      = avgRatio(last4,  getFFI,   getDials);
  const ffi12     = avgRatio(last12, getFFI,   getDials);

  const r1 = (v) => Math.round(v * 10) / 10;
  const r0 = (v) => Math.round(v);

  return {
    ciToSaleRatio:  { trailing4w: r1(ciSale4),  trailing12w: r1(ciSale12),  trend: trend(ciSale4,  ciSale12)  },
    dialsToCIRatio: { trailing4w: r1(diCI4),    trailing12w: r1(diCI12),    trend: trend(diCI4,    diCI12)    },
    avgPolicySize:  { trailing4w: r0(ap4),       trailing12w: r0(ap12),      trend: trend(ap4,      ap12)      },
    ffiToDialRatio: { trailing4w: r1(ffi4),      trailing12w: r1(ffi12),     trend: trend(ffi4,     ffi12)     },
  };
}

// ──────────────────────────────────────────────────────
// getPeriodCtx
// Returns { weeksElapsed, periodWeeks } for use with computeAtRiskStatus.
// category: 'monthly' | 'quarterly' | 'annual' | 'club'
// currentDate: Date
// ──────────────────────────────────────────────────────
export function getPeriodCtx(category, currentDate) {
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (category === 'monthly') {
    const daysInMonth = new Date(y, m, 0).getDate();
    return { weeksElapsed: Math.floor((now.getDate() - 1) / 7), periodWeeks: daysInMonth / 7 };
  }
  if (category === 'quarterly') {
    const qStartMonth = Math.floor((m - 1) / 3) * 3;
    const daysElapsed = Math.floor((now - new Date(y, qStartMonth, 1)) / 86400000);
    return { weeksElapsed: Math.floor(daysElapsed / 7), periodWeeks: 13 };
  }
  // annual and club
  const daysElapsed = Math.floor((now - new Date(y, 0, 1)) / 86400000);
  return { weeksElapsed: Math.max(1, Math.floor(daysElapsed / 7)), periodWeeks: 52 };
}

// ──────────────────────────────────────────────────────
// nextTierDistance
// tiers: ruleset.clubAward.tiers (array, any order)
// annualApi: the agent's current annual API (number or parseable)
// Returns { nextTier, distance } for the tier immediately above the agent's
// current standing, or null if already at the top tier (Gold / apiMax === null).
// ──────────────────────────────────────────────────────
export function nextTierDistance(annualApi, tiers) {
  const api = p(annualApi);
  const sorted = [...tiers].sort((a, b) => a.apiMin - b.apiMin);
  // Find the lowest tier whose apiMin > api (i.e. the next tier up)
  const next = sorted.find((t) => api < t.apiMin);
  if (!next) return null; // already at or above the top tier entry
  return { nextTier: next, distance: Math.max(0, next.apiMin - api) };
}

// ──────────────────────────────────────────────────────
// isPersistencyOnlyBlock
// Returns true iff the award has confirmed data AND the persistency criterion
// is the sole unmet criterion (all other criteria are met).
// ──────────────────────────────────────────────────────
export function isPersistencyOnlyBlock(award) {
  if (award.dataSource !== 'confirmed') return false;
  const unmet = (award.criteria ?? []).filter((c) => !c.met);
  if (unmet.length === 0) return false;
  return unmet.every((c) => /persistency/i.test(c.label));
}

// ──────────────────────────────────────────────────────
// Policy Ledger award lens (L1 — docs/briefs/ledger-lens-build.md § L1)
//
// The periods the ledger's "Counts toward" selector offers, built from the SAME
// period arithmetic computeAgentAwards uses (monthKey / getQuarter /
// getQuarterMonths), the MDRT line (mdrtThresholds — the Home hero's source)
// and the ruleset (the BDO/DSO monthly
// exclusion) — never a hard-coded list. Each descriptor is plain data that
// `deriveAwardLens` (src/lib/ledgerProduction.js) reads to classify policies.
//
// Descriptor: {
//   key, kind: 'campaign'|'month'|'quarter'|'annual'|'mdrt',
//   label (selector text), periodName (sentence text), start, end (YYYY-MM-DD),
//   year, closed, ranked, includeFamily, category (getPeriodCtx category),
//   target (MDRT line, else null), campaign (campaign only),
//   suppressor (Rule 10 campaign withholding the cash, or null),
// }
// ──────────────────────────────────────────────────────
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year, month, day) {
  return `${monthKey(year, month)}-${String(day).padStart(2, '0')}`;
}

// The MDRT line the ledger's "MDRT <year>" card measures against — the SAME
// constant the Home hero (homeDerivations / HeroCard) and MdrtTracker read, so
// an agent never sees two MDRT targets (orchestrator ruling, PR #981). Year-
// keyed: a year with no published line gets NO target (the card hides the
// ring) rather than a guess. NOTE: `ruleset.mdrtAward.apiThreshold` (500,000)
// still drives the Awards tab's MDRT award — FOLLOW_UPS § MDRT award line.
const MDRT_LINE_BY_YEAR = Object.freeze({ 2026: MDRT_THRESHOLDS_2026.mdrt });

/** The MDRT API line for `year`, or null when none is published for it. */
export function mdrtLineFor(year) {
  const line = MDRT_LINE_BY_YEAR[year];
  if (line == null && import.meta.env?.DEV) {
    console.warn(`[awardsEngine] no MDRT line configured for ${year} — MDRT card shows no target`);
  }
  return line ?? null;
}

/** The Rule 10 recognition-only prize string, exported so the ledger names it identically. */
export function recognitionOnlyLabel(campaignName) {
  return RECOGNITION_ONLY(campaignName ?? 'the active campaign');
}

/**
 * The flagged campaign withholding award CASH for any of `months` of `year`
 * (Rule 10), or null. The same test computeAgentAwards applies to the
 * Advisor-of-the-Month and quarterly prize strings.
 */
export function awardCashSuppressor(activeCampaigns, year, months) {
  return suppressingCampaign(activeCampaigns, year, months);
}

function monthDescriptor(year, month, today, campaigns) {
  const start = isoDate(year, month, 1);
  const end = isoDate(year, month, lastDayOfMonth(year, month));
  return {
    key: `month:${monthKey(year, month)}`,
    kind: 'month',
    label: `${MONTH_SHORT[month - 1]} ${year}`,
    periodName: `${MONTH_LONG[month - 1]} ${year}`,
    start, end, year,
    closed: end < today,
    ranked: true,
    includeFamily: false,
    category: 'monthly',
    target: null,
    suppressor: suppressingCampaign(campaigns, year, [month]),
  };
}

function quarterDescriptor(year, quarter, today, campaigns) {
  const months = getQuarterMonths(quarter, year).map((k) => Number(k.slice(5, 7)));
  const first = months[0];
  const last = months[months.length - 1];
  const end = isoDate(year, last, lastDayOfMonth(year, last));
  return {
    key: `quarter:${year}-Q${quarter}`,
    kind: 'quarter',
    label: `Q${quarter} ${year}`,
    periodName: `Q${quarter} ${year}`,
    start: isoDate(year, first, 1),
    end, year,
    closed: end < today,
    ranked: true,
    includeFamily: false,
    category: 'quarterly',
    target: null,
    suppressor: suppressingCampaign(campaigns, year, months),
    months,
  };
}

function campaignDescriptor(campaign, today) {
  const start = String(campaign?.startDate ?? '').slice(0, 10);
  const end = String(campaign?.endDate ?? '').slice(0, 10);
  return {
    key: `campaign:${campaign.id}`,
    kind: 'campaign',
    label: `★ ${campaign.shortName ?? campaign.name ?? 'Campaign'}`,
    periodName: campaign.name ?? 'the campaign',
    start, end,
    year: Number(end.slice(0, 4)) || null,
    closed: Boolean(end) && end < today,
    ranked: false,
    includeFamily: false,
    category: 'campaign',
    target: null,
    suppressor: null,
    campaign,
  };
}

/**
 * awardLensPeriods({ today, ruleset, campaigns, agentProfile })
 *
 * @param {object} args
 * @param {string} args.today  YYYY-MM-DD (Trinidad date — the caller owns the clock)
 * @returns {{ current: object[], past: object[] }}
 *   current — active campaign(s) first, then this month, this quarter, this
 *             year's annual awards, MDRT <year>.
 *   past    — closed months and quarters of this year and last year, newest first.
 */
export function awardLensPeriods({ today, ruleset = DEFAULT_RULESET_2026, campaigns = [], agentProfile = {} } = {}) {
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error('awardLensPeriods: today must be YYYY-MM-DD');
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;
  const camps = Array.isArray(campaigns) ? campaigns.filter((c) => c?.id) : [];

  // Advisor of the Month does not apply to BDO/DSO advisors when the ruleset
  // says so — the same gate computeAgentAwards applies.
  const monthlyApplies = !(agentProfile?.isBdoDso && ruleset?.advisorMonth?.excludesBdoDso);

  const mdrtTarget = mdrtLineFor(year);
  const yearStart = isoDate(year, 1, 1);
  const yearEnd = isoDate(year, 12, 31);

  const current = [
    ...camps.map((c) => campaignDescriptor(c, today)),
    ...(monthlyApplies ? [monthDescriptor(year, month, today, camps)] : []),
    quarterDescriptor(year, quarter, today, camps),
    {
      key: `annual:${year}`, kind: 'annual', label: `${year} awards`, periodName: String(year),
      start: yearStart, end: yearEnd, year, closed: false,
      ranked: true, includeFamily: false, category: 'annual', target: null, suppressor: null,
    },
    {
      key: `mdrt:${year}`, kind: 'mdrt', label: `MDRT ${year}`, periodName: `MDRT ${year}`,
      start: yearStart, end: yearEnd, year, closed: false,
      ranked: false, includeFamily: true, category: 'annual',
      target: mdrtTarget,
      suppressor: null,
    },
  ];

  const past = [];
  for (const y of [year, year - 1]) {
    const lastMonth = y === year ? month - 1 : 12;
    const lastQuarter = y === year ? quarter - 1 : 4;
    const rows = [];
    if (monthlyApplies) {
      for (let m = lastMonth; m >= 1; m -= 1) rows.push(monthDescriptor(y, m, today, camps));
    }
    for (let q = lastQuarter; q >= 1; q -= 1) rows.push(quarterDescriptor(y, q, today, camps));
    // Newest first by period end, months before the quarter that ends with them.
    rows.sort((a, b) => b.end.localeCompare(a.end) || (a.kind === 'month' ? -1 : 1));
    past.push(...rows);
  }

  return { current, past };
}

/**
 * Weeks left in an award period, from getPeriodCtx — the same period context
 * computeAtRiskStatus reads. Null when the period has no weeks left.
 */
export function awardWeeksLeft(category, currentDate) {
  const { weeksElapsed, periodWeeks } = getPeriodCtx(category, currentDate);
  const left = periodWeeks - weeksElapsed;
  return left > 0 ? left : null;
}
