// Pure computation engine — zero Firebase imports, zero side effects
import { extractFields, extractTotalProductionCredit } from './extractFields';
import { DEFAULT_RULESET_2026 } from '../config/awardsRuleset/2026';

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
export function computeAgentAwards(confirmedData, submittedData, agentProfile, currentDate, ruleset = DEFAULT_RULESET_2026) {
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = getQuarter(now);

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
  const subPersistVals = yearSubs.map((s) => p(s.persistencyRate)).filter((v) => v > 0);
  const allPersistVals = [...confPersistVals, ...subPersistVals];
  const annualPersist = allPersistVals.length > 0
    ? allPersistVals.reduce((s, v) => s + v, 0) / allPersistVals.length
    : 0;

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
      prize: ruleset.advisorMonth.api.prize,
      dataSource: monthlySource, progressPercent: (monthlyAPI / ruleset.advisorMonth.api.threshold) * 100, note: monthlyNote,
    });

    awards.advisor_month_apps = makeAward({
      id: 'advisor_month_apps', name: 'Advisor of the Month — Apps', category: 'monthly',
      eligible: monthlyApps >= ruleset.advisorMonth.apps.threshold && mPersOk,
      inContention: monthlyApps >= ruleset.advisorMonth.apps.inContention && monthlyApps < ruleset.advisorMonth.apps.threshold,
      criteria: [
        criterion('Monthly Apps', ruleset.advisorMonth.apps.threshold, monthlyApps, 'apps'),
        criterion('Persistency', ruleset.advisorMonth.persistGate, monthlyPersist, '%'),
      ],
      prize: ruleset.advisorMonth.apps.prize,
      dataSource: monthlySource, progressPercent: (monthlyApps / ruleset.advisorMonth.apps.threshold) * 100, note: monthlyNote,
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
    prize: ruleset.quarterlyAward.api.prize,
    dataSource: quarterlySource, progressPercent: (quarterlyAPI / ruleset.quarterlyAward.api.threshold) * 100, note: quarterlyNote,
  });

  awards.quarterly_apps = makeAward({
    id: 'quarterly_apps', name: 'Quarterly Apps Award', category: 'quarterly',
    eligible: quarterlyApps >= ruleset.quarterlyAward.apps.threshold && qPersOk,
    inContention: quarterlyApps >= ruleset.quarterlyAward.apps.inContention && quarterlyApps < ruleset.quarterlyAward.apps.threshold,
    criteria: [
      criterion('Quarterly Apps', ruleset.quarterlyAward.apps.threshold, quarterlyApps, 'apps'),
      criterion('Persistency', ruleset.quarterlyAward.persistGate, quarterlyPersist, '%'),
    ],
    prize: ruleset.quarterlyAward.apps.prize,
    dataSource: quarterlySource, progressPercent: (quarterlyApps / ruleset.quarterlyAward.apps.threshold) * 100, note: quarterlyNote,
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
    eligible: annualAPI >= ruleset.mdrtAward.apiThreshold,
    inContention: annualAPI >= ruleset.mdrtAward.apiInContention && annualAPI < ruleset.mdrtAward.apiThreshold,
    criteria: [criterion('Annual API', ruleset.mdrtAward.apiThreshold, annualAPI, 'TTD')],
    prize: ruleset.mdrtAward.prize,
    dataSource: annualSource, progressPercent: (annualAPI / ruleset.mdrtAward.apiThreshold) * 100, note: annualNote,
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
