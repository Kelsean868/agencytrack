// Pure computation engine — zero Firebase imports, zero side effects

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
// ──────────────────────────────────────────────────────
export function computeAgentAwards(confirmedData, submittedData, agentProfile, currentDate) {
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
    monthlyAPI = mSubs.reduce((s, sub) => s + p(sub.apiSold), 0);
    monthlyApps = mSubs.reduce((s, sub) => s + p(sub.applicationsSold), 0);
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
    quarterlyAPI = qSubs.reduce((s, sub) => s + p(sub.apiSold), 0);
    quarterlyApps = qSubs.reduce((s, sub) => s + p(sub.applicationsSold), 0);
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
    if (!subsByMonth[mk]) subsByMonth[mk] = { api: 0, apps: 0 };
    subsByMonth[mk].api += p(s.apiSold);
    subsByMonth[mk].apps += p(s.applicationsSold);
  });

  let annualSource = 'confirmed';
  yearKeys.forEach((mk) => {
    if (!confirmedMonthKeys.has(mk) && subsByMonth[mk]) {
      annualAPI += subsByMonth[mk].api;
      annualApps += subsByMonth[mk].apps;
      annualSource = 'estimated';
    }
  });

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
  if (!isBdoDso) {
    const mPersOk = monthlyPersist >= 90 || monthlySource === 'estimated';

    awards.advisor_month_api = makeAward({
      id: 'advisor_month_api', name: 'Advisor of the Month — API', category: 'monthly',
      eligible: monthlyAPI >= 50000 && mPersOk,
      inContention: monthlyAPI >= 25000 && monthlyAPI < 50000,
      criteria: [
        criterion('Monthly API', 50000, monthlyAPI, 'TTD'),
        criterion('Persistency', 90, monthlyPersist, '%'),
      ],
      prize: 'Recognition + Gift',
      dataSource: monthlySource, progressPercent: (monthlyAPI / 50000) * 100, note: monthlyNote,
    });

    awards.advisor_month_apps = makeAward({
      id: 'advisor_month_apps', name: 'Advisor of the Month — Apps', category: 'monthly',
      eligible: monthlyApps >= 15 && mPersOk,
      inContention: monthlyApps >= 8 && monthlyApps < 15,
      criteria: [
        criterion('Monthly Apps', 15, monthlyApps, 'apps'),
        criterion('Persistency', 90, monthlyPersist, '%'),
      ],
      prize: 'Recognition + Gift',
      dataSource: monthlySource, progressPercent: (monthlyApps / 15) * 100, note: monthlyNote,
    });
  }

  // ── QUARTERLY ──
  const qPersOk = quarterlyPersist >= 90 || quarterlySource === 'estimated';

  awards.quarterly_api = makeAward({
    id: 'quarterly_api', name: 'Quarterly API Award', category: 'quarterly',
    eligible: quarterlyAPI >= 125000 && qPersOk,
    inContention: quarterlyAPI >= 62500 && quarterlyAPI < 125000,
    criteria: [
      criterion('Quarterly Net API', 125000, quarterlyAPI, 'TTD'),
      criterion('Persistency', 90, quarterlyPersist, '%'),
    ],
    prize: 'Quarterly Bonus',
    dataSource: quarterlySource, progressPercent: (quarterlyAPI / 125000) * 100, note: quarterlyNote,
  });

  awards.quarterly_apps = makeAward({
    id: 'quarterly_apps', name: 'Quarterly Apps Award', category: 'quarterly',
    eligible: quarterlyApps >= 45 && qPersOk,
    inContention: quarterlyApps >= 22 && quarterlyApps < 45,
    criteria: [
      criterion('Quarterly Apps', 45, quarterlyApps, 'apps'),
      criterion('Persistency', 90, quarterlyPersist, '%'),
    ],
    prize: 'Quarterly Bonus',
    dataSource: quarterlySource, progressPercent: (quarterlyApps / 45) * 100, note: quarterlyNote,
  });

  // ── ANNUAL ──
  awards.persistency_silver = makeAward({
    id: 'persistency_silver', name: 'Persistency Award — Silver', category: 'annual',
    eligible: annualAPI >= 250000 && annualApps >= 45 && annualPersist >= 92,
    inContention: annualAPI >= 125000 && annualApps >= 22,
    criteria: [
      criterion('Annual API', 250000, annualAPI, 'TTD'),
      criterion('Annual Apps', 45, annualApps, 'apps'),
      criterion('Avg Persistency', 92, annualPersist, '%'),
    ],
    prize: 'Silver Trophy + Bonus',
    dataSource: annualSource, progressPercent: (annualAPI / 250000) * 100, note: annualNote,
  });

  awards.persistency_gold = makeAward({
    id: 'persistency_gold', name: 'Persistency Award — Gold', category: 'annual',
    eligible: annualAPI >= 250000 && annualApps >= 45 && annualPersist >= 95,
    inContention: annualAPI >= 125000 && annualPersist >= 90,
    criteria: [
      criterion('Annual API', 250000, annualAPI, 'TTD'),
      criterion('Annual Apps', 45, annualApps, 'apps'),
      criterion('Avg Persistency', 95, annualPersist, '%'),
    ],
    prize: 'Gold Trophy + Premium Bonus',
    dataSource: annualSource, progressPercent: (annualAPI / 250000) * 100, note: annualNote,
  });

  if (monthsInIndustry <= 18 || monthsInIndustry === 0) {
    awards.rookie_of_year = makeAward({
      id: 'rookie_of_year', name: 'Rookie of the Year', category: 'annual',
      eligible: annualAPI >= 325000 && annualApps >= 52 && annualPersist >= 95,
      inContention: annualAPI >= 162500 && annualApps >= 26,
      criteria: [
        criterion('Annual API', 325000, annualAPI, 'TTD'),
        criterion('Annual Apps', 52, annualApps, 'apps'),
        criterion('Avg Persistency', 95, annualPersist, '%'),
      ],
      prize: 'Rookie Trophy + Premium Recognition',
      dataSource: annualSource, progressPercent: (annualAPI / 325000) * 100, note: annualNote,
    });
  }

  if (monthsAtTatil <= 18 || monthsAtTatil === 0) {
    awards.new_bs_award = makeAward({
      id: 'new_bs_award', name: 'New Business Advisor Award', category: 'annual',
      eligible: annualAPI >= 250000 && annualApps >= 52 && annualPersist >= 95,
      inContention: annualAPI >= 125000 && annualApps >= 26,
      criteria: [
        criterion('Annual API', 250000, annualAPI, 'TTD'),
        criterion('Annual Apps', 52, annualApps, 'apps'),
        criterion('Avg Persistency', 95, annualPersist, '%'),
      ],
      prize: 'New Advisor Trophy + Bonus',
      dataSource: annualSource, progressPercent: (annualAPI / 250000) * 100, note: annualNote,
    });
  }

  awards.centurion = makeAward({
    id: 'centurion', name: 'Centurion Award', category: 'annual',
    eligible: annualApps >= 100 && annualPersist >= 90,
    inContention: annualApps >= 50 && annualApps < 100,
    criteria: [
      criterion('Annual Apps', 100, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Centurion Trophy',
    dataSource: annualSource, progressPercent: (annualApps / 100) * 100, note: annualNote,
  });

  // ── CLUB ──
  const clubApps = annualApps >= 50;
  const clubPers = annualPersist >= 90;

  awards.bronze_club_l3 = makeAward({
    id: 'bronze_club_l3', name: 'Bronze Club — Level 3', category: 'club',
    eligible: annualAPI >= 250000 && annualAPI < 350000 && clubApps && clubPers,
    inContention: annualAPI >= 125000 && annualAPI < 350000 && annualApps >= 25,
    criteria: [
      criterion('Annual API ($250K–$349K)', 250000, annualAPI, 'TTD'),
      criterion('Annual Apps', 50, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Bronze Club Membership',
    dataSource: annualSource, progressPercent: (annualAPI / 350000) * 100, note: annualNote,
  });

  awards.bronze_club_l2 = makeAward({
    id: 'bronze_club_l2', name: 'Bronze Club — Level 2', category: 'club',
    eligible: annualAPI >= 350000 && annualAPI < 450000 && clubApps && clubPers,
    inContention: annualAPI >= 175000 && annualAPI < 450000 && annualApps >= 25,
    criteria: [
      criterion('Annual API ($350K–$449K)', 350000, annualAPI, 'TTD'),
      criterion('Annual Apps', 50, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Bronze Club Membership + Bonus',
    dataSource: annualSource, progressPercent: (annualAPI / 450000) * 100, note: annualNote,
  });

  awards.bronze_club_l1 = makeAward({
    id: 'bronze_club_l1', name: 'Bronze Club — Level 1', category: 'club',
    eligible: annualAPI >= 450000 && annualAPI < 550000 && clubApps && clubPers,
    inContention: annualAPI >= 225000 && annualAPI < 550000 && annualApps >= 25,
    criteria: [
      criterion('Annual API ($450K–$549K)', 450000, annualAPI, 'TTD'),
      criterion('Annual Apps', 50, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Bronze Club Level 1 + Trip',
    dataSource: annualSource, progressPercent: (annualAPI / 550000) * 100, note: annualNote,
  });

  awards.silver_club = makeAward({
    id: 'silver_club', name: 'Silver Club', category: 'club',
    eligible: annualAPI >= 550000 && annualAPI < 650000 && clubApps && clubPers,
    inContention: annualAPI >= 275000 && annualAPI < 650000 && annualApps >= 25,
    criteria: [
      criterion('Annual API ($550K–$649K)', 550000, annualAPI, 'TTD'),
      criterion('Annual Apps', 50, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Silver Club + Premium Trip',
    dataSource: annualSource, progressPercent: (annualAPI / 650000) * 100, note: annualNote,
  });

  awards.gold_club = makeAward({
    id: 'gold_club', name: 'Gold Club', category: 'club',
    eligible: annualAPI >= 650000 && clubApps && clubPers,
    inContention: annualAPI >= 325000 && annualAPI < 650000 && annualApps >= 25,
    criteria: [
      criterion('Annual API (≥$650K)', 650000, annualAPI, 'TTD'),
      criterion('Annual Apps', 50, annualApps, 'apps'),
      criterion('Avg Persistency', 90, annualPersist, '%'),
    ],
    prize: 'Gold Club + Luxury Trip',
    dataSource: annualSource, progressPercent: (annualAPI / 650000) * 100, note: annualNote,
  });

  if (!isBdoDso) {
    awards.agent_of_year = makeAward({
      id: 'agent_of_year', name: 'Agent of the Year', category: 'annual',
      eligible: annualAPI >= 1000000 && annualApps >= 50 && annualPersist >= 90,
      inContention: annualAPI >= 500000 && annualApps >= 25,
      criteria: [
        criterion('Annual API', 1000000, annualAPI, 'TTD'),
        criterion('Annual Apps', 50, annualApps, 'apps'),
        criterion('Avg Persistency', 90, annualPersist, '%'),
      ],
      prize: 'Agent of the Year Trophy + Grand Prize',
      dataSource: annualSource, progressPercent: (annualAPI / 1000000) * 100, note: annualNote,
    });
  }

  awards.mdrt = makeAward({
    id: 'mdrt', name: 'MDRT', category: 'annual',
    eligible: annualAPI >= 500000,
    inContention: annualAPI >= 250000 && annualAPI < 500000,
    criteria: [criterion('Annual API', 500000, annualAPI, 'TTD')],
    prize: 'MDRT Membership + Recognition',
    dataSource: annualSource, progressPercent: (annualAPI / 500000) * 100, note: annualNote,
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
// ──────────────────────────────────────────────────────
export function computeManagerAwards(confirmedData, unitAgentIds, allAgentConfirmed, recruitData, currentDate, role) {
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

  let bonusPct = 0;
  let nextTier = null;
  if (avgMonthlyAPI >= 30000) {
    bonusPct = 1.5;
  } else if (avgMonthlyAPI >= 20000) {
    bonusPct = 1.0;
    nextTier = { threshold: 30000, pct: 1.5 };
  } else if (avgMonthlyAPI >= 15000) {
    bonusPct = 0.75;
    nextTier = { threshold: 20000, pct: 1.0 };
  } else {
    nextTier = { threshold: 15000, pct: 0.75 };
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
  [
    { id: 'recruiting_bronze', name: 'Recruiting Award — Bronze', min: 3, max: 4,  prize: 'Bronze Recruiting Award' },
    { id: 'recruiting_silver', name: 'Recruiting Award — Silver', min: 5, max: 6,  prize: 'Silver Recruiting Award' },
    { id: 'recruiting_gold',   name: 'Recruiting Award — Gold',   min: 7, max: null, prize: 'Gold Recruiting Award'  },
  ].forEach(({ id, name, min, max, prize }) => {
    const eligible = max !== null ? (newAdvisors >= min && newAdvisors <= max) : newAdvisors >= min;
    awards[id] = {
      id, name, category: 'annual', eligible,
      inContention: !eligible && newAdvisors >= Math.ceil(min / 2),
      criteria: [{ label: 'Net New Advisors', target: min, current: newAdvisors, met: newAdvisors >= min, unit: 'advisors' }],
      prize, dataSource, progressPercent: Math.min(100, (newAdvisors / min) * 100), note,
    };
  });

  // Activity
  [
    { id: 'activity_bronze',   name: 'Activity Award — Bronze',   target: 40, prize: 'Bronze Activity Award'  },
    { id: 'activity_silver',   name: 'Activity Award — Silver',   target: 50, prize: 'Silver Activity Award'  },
    { id: 'activity_gold',     name: 'Activity Award — Gold',     target: 60, prize: 'Gold Activity Award'    },
    { id: 'highest_activity',  name: 'Highest Activity Award',    target: 61, prize: 'Highest Activity Trophy' },
  ].forEach(({ id, name, target, prize }) => {
    const eligible = avgAppsPerAdvisor >= target;
    awards[id] = {
      id, name, category: 'annual', eligible,
      inContention: !eligible && avgAppsPerAdvisor >= target * 0.5,
      criteria: [{ label: 'Avg Apps / Advisor', target, current: Math.round(avgAppsPerAdvisor), met: eligible, unit: 'apps' }],
      prize, dataSource, progressPercent: Math.min(100, (avgAppsPerAdvisor / target) * 100), note,
    };
  });

  // Production
  const prodAPImet = avgAPIPerAdvisor >= 250000;
  const prodPersMet = avgPersist >= 90;
  awards.production_award = {
    id: 'production_award', name: 'Production Award', category: 'annual',
    eligible: prodAPImet && prodPersMet,
    inContention: !prodAPImet || !prodPersMet ? avgAPIPerAdvisor >= 125000 : false,
    criteria: [
      { label: 'Avg API / Advisor', target: 250000, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: 90, current: Math.round(avgPersist), met: prodPersMet, unit: '%' },
    ],
    prize: 'Production Award + Bonus', dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / 250000) * 100), note,
  };

  awards.persistency_silver = {
    id: 'persistency_silver', name: 'Agency Persistency — Silver', category: 'annual',
    eligible: prodAPImet && avgPersist >= 92,
    inContention: avgAPIPerAdvisor >= 125000 && avgPersist >= 85,
    criteria: [
      { label: 'Avg API / Advisor', target: 250000, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: 92, current: Math.round(avgPersist), met: avgPersist >= 92, unit: '%' },
    ],
    prize: 'Persistency Silver Trophy', dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / 250000) * 100), note,
  };

  awards.persistency_gold = {
    id: 'persistency_gold', name: 'Agency Persistency — Gold', category: 'annual',
    eligible: prodAPImet && avgPersist >= 95,
    inContention: avgAPIPerAdvisor >= 125000 && avgPersist >= 90,
    criteria: [
      { label: 'Avg API / Advisor', target: 250000, current: Math.round(avgAPIPerAdvisor), met: prodAPImet, unit: 'TTD' },
      { label: 'Avg Persistency', target: 95, current: Math.round(avgPersist), met: avgPersist >= 95, unit: '%' },
    ],
    prize: 'Persistency Gold Trophy', dataSource, progressPercent: Math.min(100, (avgAPIPerAdvisor / 250000) * 100), note,
  };

  if (role === 'unit_manager') {
    const eligible = totalAPI >= 2000000 && avgAPIPerAdvisor >= 250000 && agentCount >= 5 && newAdvisors >= 2 && avgPersist >= 90;
    awards.unit_of_year = {
      id: 'unit_of_year', name: 'Unit of the Year', category: 'annual',
      eligible, inContention: !eligible && totalAPI >= 1000000,
      criteria: [
        { label: 'Total Unit API', target: 2000000, current: Math.round(totalAPI), met: totalAPI >= 2000000, unit: 'TTD' },
        { label: 'Avg API / Advisor', target: 250000, current: Math.round(avgAPIPerAdvisor), met: avgAPIPerAdvisor >= 250000, unit: 'TTD' },
        { label: 'Advisors', target: 5, current: agentCount, met: agentCount >= 5, unit: 'advisors' },
        { label: 'New Recruits', target: 2, current: newAdvisors, met: newAdvisors >= 2, unit: 'advisors' },
        { label: 'Avg Persistency', target: 90, current: Math.round(avgPersist), met: avgPersist >= 90, unit: '%' },
      ],
      prize: 'Unit of the Year Trophy + Grand Prize', dataSource, progressPercent: Math.min(100, (totalAPI / 2000000) * 100), note,
    };
  }

  if (role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin') {
    const eligible = totalAPI >= 5000000 && avgAPIPerAdvisor >= 250000 && agentCount >= 15 && newAdvisors >= 3 && avgPersist >= 90;
    awards.agency_of_year = {
      id: 'agency_of_year', name: 'Agency of the Year', category: 'annual',
      eligible, inContention: !eligible && totalAPI >= 2500000,
      criteria: [
        { label: 'Total Agency API', target: 5000000, current: Math.round(totalAPI), met: totalAPI >= 5000000, unit: 'TTD' },
        { label: 'Avg API / Advisor', target: 250000, current: Math.round(avgAPIPerAdvisor), met: avgAPIPerAdvisor >= 250000, unit: 'TTD' },
        { label: 'Advisors', target: 15, current: agentCount, met: agentCount >= 15, unit: 'advisors' },
        { label: 'New Recruits', target: 3, current: newAdvisors, met: newAdvisors >= 3, unit: 'advisors' },
        { label: 'Avg Persistency', target: 90, current: Math.round(avgPersist), met: avgPersist >= 90, unit: '%' },
      ],
      prize: 'Agency of the Year Trophy + Grand Prize', dataSource, progressPercent: Math.min(100, (totalAPI / 5000000) * 100), note,
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

  const getApps  = (s) => p(s.applicationsSold) || p(s.appsSold);
  const getCI    = (s) => p(s.ciConducted);
  const getDials = (s) => p(s.referralCalls) + p(s.followUpCalls) + p(s.coldCalls) + p(s.seminarTradeshowCalls);
  const getAPI   = (s) => p(s.apiSold) || p(s.api) || p(s.annualPremium);
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
