// agentReportPdfModel — the SINGLE pure derivation for AgentReportDocument.jsx
// (the refined @react-pdf Agent Performance Report). Split into its own module
// so the .jsx file exports ONLY the React component (react-refresh boundary).
//
// Reuses deriveAgentReportModel for EVERY canonical number (hero / windows /
// activity / ratios / trajectory / floor) and derives the extras it does not
// carry (production NB/PPP/LMPS breakdown, award progress, career ladder,
// settled/pending YTD-vs-targets split, settlement history) from the SAME
// sources the in-app surfaces use. There is NO second math path.
import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';
import { computeAgentAwards } from '../../utils/awardsEngine';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { MDRT_THRESHOLDS_2026 } from '../../config/mdrtThresholds/2026';
import { deriveAgentReportModel } from './agentReportModel';

// Career ladder (kept in sync with the app career levels).
export const CAREER_LEVELS = [
  { level: 1, name: 'Salesperson',        minAPI: 0,       minApps: 0   },
  { level: 2, name: 'Senior Salesperson', minAPI: 120000,  minApps: 20  },
  { level: 3, name: 'Associate',          minAPI: 240000,  minApps: 35  },
  { level: 4, name: 'Senior Associate',   minAPI: 360000,  minApps: 50  },
  { level: 5, name: 'Manager',            minAPI: 500000,  minApps: 65  },
  { level: 6, name: 'Senior Manager',     minAPI: 700000,  minApps: 80  },
  { level: 7, name: 'Executive',          minAPI: 1000000, minApps: 100 },
];

export const COMPANY_FLOOR = 250000;

export function weekLabel(weekStarting) {
  if (!weekStarting) return '';
  return formatDateDisplay(weekStarting);
}

export function latestPersistencyPercent(persistencyData) {
  const entries = Array.isArray(persistencyData)
    ? persistencyData
    : (persistencyData && typeof persistencyData === 'object' ? Object.values(persistencyData) : []);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => {
    const ka = `${a.year ?? 0}-${String(a.month ?? 0).padStart(2, '0')}`;
    const kb = `${b.year ?? 0}-${String(b.month ?? 0).padStart(2, '0')}`;
    return kb.localeCompare(ka);
  });
  const v = parseFloat(sorted[0]?.persistency);
  if (!Number.isFinite(v)) return null;
  return v <= 1 ? v * 100 : v;
}

export function periodLabel(periodKey) {
  if (!periodKey) return '—';
  const qm = String(periodKey).match(/^(\d{4})-Q(\d)$/);
  if (qm) return `Q${qm[2]} ${qm[1]}`;
  const mm = String(periodKey).match(/^(\d{4})-(\d{2})$/);
  if (mm) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const idx = parseInt(mm[2], 10) - 1;
    return `${months[idx] ?? mm[2]} ${mm[1]}`;
  }
  return periodKey;
}

export function formatConfirmedDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('en-TT', { year: '2-digit', month: 'short', day: 'numeric' });
}

export function ratioValueStr(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.round(v)}%`;
}

// ── buildAgentReportModel — SINGLE pure derivation for the whole PDF ──────────
export function buildAgentReportModel({
  agentInfo,
  submissions,
  goals,
  weekRange,
  confirmedSettlements,
  agentProfile,
  persistency,
  ruleset,
  now = new Date(),
} = {}) {
  const year = now.getFullYear();

  const model = deriveAgentReportModel({
    submissions: submissions ?? [],
    settlements: confirmedSettlements ?? [],
    goals,
    persistency: persistency ?? [],
    agentProfile,
    period: 'ytd',
    now,
  });

  const allSubmitted = (submissions ?? []).filter((s) => s.status === 'submitted');
  const sorted = [...allSubmitted].sort((a, b) =>
    (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')
  );

  let rangeLabel, selectedSubs;
  if (weekRange === 'year' || weekRange === undefined) {
    selectedSubs = sorted.filter((s) => (s.weekStarting ?? '').startsWith(String(year))).reverse();
    rangeLabel = `Full Year ${year}`;
  } else {
    selectedSubs = sorted.slice(0, Number(weekRange)).reverse();
    rangeLabel = `Last ${weekRange} Weeks`;
  }

  const fieldsList = selectedSubs.map((s) => ({
    ...extractFields(s),
    totalProductionCredit: extractTotalProductionCredit(s),
  }));
  const chartData = selectedSubs.map((s, i) => ({
    week:     weekLabel(s.weekStarting),
    dials:    fieldsList[i].totalTelAttempts,
    contacts: fieldsList[i].telContacts,
    f2f:      fieldsList[i].f2fAttempts,
    apps:     fieldsList[i].applicationsSold,
  }));

  const yearSubs = allSubmitted.filter((s) => (s.weekStarting ?? '').startsWith(String(year)));

  // Effective YTD (settled + non-overlapping submitted) — mirrors awardsEngine.
  const yearKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const annualConf = (confirmedSettlements ?? []).filter((d) => yearKeys.includes(d.periodKey));
  const settledYTD_API  = annualConf.reduce((s, d) => s + (parseFloat(d.settledAPI)  || 0), 0);
  const settledYTD_Apps = annualConf.reduce((s, d) => s + (parseFloat(d.settledApps) || 0), 0);
  const confirmedMonthKeys = new Set(annualConf.map((d) => d.periodKey));

  const subsByMonth = {};
  yearSubs.forEach((s) => {
    const mk = (s.weekStarting ?? '').substring(0, 7);
    if (!mk) return;
    if (!subsByMonth[mk]) subsByMonth[mk] = { api: 0, apps: 0 };
    subsByMonth[mk].api  += extractTotalProductionCredit(s);
    subsByMonth[mk].apps += extractFields(s).applicationsSold || 0;
  });

  let pendingYTD_API = 0;
  let pendingYTD_Apps = 0;
  yearKeys.forEach((mk) => {
    if (!confirmedMonthKeys.has(mk) && subsByMonth[mk]) {
      pendingYTD_API  += subsByMonth[mk].api;
      pendingYTD_Apps += subsByMonth[mk].apps;
    }
  });
  const effectiveYTD_API  = settledYTD_API  + pendingYTD_API;
  const effectiveYTD_Apps = settledYTD_Apps + pendingYTD_Apps;
  const hasSettlementsForYear = annualConf.length > 0;

  // YTD-vs-targets bar geometry.
  const ytdAPIGoal = model.ytdAPIGoal;
  const barMax = Math.max(
    ytdAPIGoal || MDRT_THRESHOLDS_2026.mdrt,
    MDRT_THRESHOLDS_2026.mdrt,
    effectiveYTD_API * 1.05,
    300000,
  );
  const settledFrac = Math.max(0, Math.min(1, settledYTD_API / barMax));
  const pendingFrac = Math.max(0, Math.min(1 - settledFrac, pendingYTD_API / barMax));
  const floorFrac   = COMPANY_FLOOR / barMax;
  const mdrtFrac    = MDRT_THRESHOLDS_2026.mdrt / barMax;
  const goalFrac    = ytdAPIGoal > 0 ? ytdAPIGoal / barMax : null;
  const achievedPct = Math.round(Math.min(100, (effectiveYTD_API / barMax) * 100));

  // Career level (uses effective YTD).
  const qualifiedLevels = CAREER_LEVELS.filter((l) =>
    effectiveYTD_API >= l.minAPI && effectiveYTD_Apps >= l.minApps
  );
  const currentLevel = qualifiedLevels.length > 0 ? qualifiedLevels[qualifiedLevels.length - 1] : CAREER_LEVELS[0];
  const nextLevel    = currentLevel.level < 7 ? CAREER_LEVELS.find((l) => l.level === currentLevel.level + 1) : null;
  const isMaxLevel   = currentLevel.level === 7;
  const levelProgressPct = nextLevel ? Math.min(99, (effectiveYTD_API / nextLevel.minAPI) * 100) : 100;
  const appsNeeded   = nextLevel ? Math.max(0, nextLevel.minApps - effectiveYTD_Apps) : 0;

  // Production breakdown (NB / PPP / LMPS).
  function sumProdBD(subs) {
    return subs.reduce((acc, s) => {
      const nb  = s.newBusiness  ?? {};
      const ppp = s.pppIncreases ?? {};
      const lmp = s.lumpsums     ?? {};
      acc.nbApps  += parseInt(nb.apps, 10)        || 0;
      acc.nbApi   += parseFloat(nb.api)           || 0;
      acc.pppApps += parseInt(ppp.apps, 10)       || 0;
      acc.pppInc  += parseFloat(ppp.apiIncrease)  || 0;
      acc.lmpsCredit += parseFloat(lmp.apiCredit) || 0;
      return acc;
    }, { nbApps: 0, nbApi: 0, pppApps: 0, pppInc: 0, lmpsCredit: 0 });
  }
  const curMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const weeklyBD = sumProdBD(sorted[0] ? [sorted[0]] : []);
  const mtdBD    = sumProdBD(yearSubs.filter((s) => (s.weekStarting ?? '').startsWith(curMonth)));
  const ytdBD    = sumProdBD(yearSubs);
  const bdRows = [
    { label: 'This week',  ...weeklyBD, total: weeklyBD.nbApi + weeklyBD.pppInc + weeklyBD.lmpsCredit },
    { label: 'This month', ...mtdBD,    total: mtdBD.nbApi + mtdBD.pppInc + mtdBD.lmpsCredit },
    { label: 'This year',  ...ytdBD,    total: ytdBD.nbApi + ytdBD.pppInc + ytdBD.lmpsCredit },
  ];
  const hasPppAny  = bdRows.some((r) => r.pppApps > 0 || r.pppInc > 0);
  const hasLmpsAny = bdRows.some((r) => r.lmpsCredit > 0);

  // Focus bullets (coaching cues from the canonical ratios).
  const focusBullets = [];
  const r = model.ratios ?? {};
  if (r.approachRate !== null && r.approachRate !== undefined && r.approachRate < 40)
    focusBullets.push(`Your approach-to-FFI rate is ${ratioValueStr(r.approachRate)} — qualify prospects harder before booking the fact-find.`);
  if (r.ffiConversion !== null && r.ffiConversion !== undefined && r.ffiConversion < 50)
    focusBullets.push(`Only ${ratioValueStr(r.ffiConversion)} of your fact-finds reach a closing interview — tighten the transition to the CI.`);
  if (r.closingRatio !== null && r.closingRatio !== undefined && r.closingRatio < 60)
    focusBullets.push(`You're converting ${ratioValueStr(r.closingRatio)} of CIs to applications — have all paperwork ready before the close.`);
  if (!model.aboveFloor)
    focusBullets.push(`You're at ${model.floorPct}% of your tenure floor — lift dial volume to clear it before year-end.`);
  if (focusBullets.length === 0)
    focusBullets.push('Every ratio is on track. Focus on increasing dial volume to grow production.');
  const displayBullets = focusBullets.slice(0, 3);

  // Awards.
  const awardsObj = computeAgentAwards(
    confirmedSettlements ?? [],
    submissions ?? [],
    agentProfile ?? {},
    now,
    ruleset,
  );
  const awardList = Object.values(awardsObj);
  const inProgressAwards = awardList.filter((a) => (a.progressPercent ?? 0) > 0 && (a.progressPercent ?? 0) < 100);
  const achievedAwards   = awardList.filter((a) => (a.progressPercent ?? 0) >= 100);
  const notStartedAwards = awardList.filter((a) => (a.progressPercent ?? 0) === 0);
  const awardReqStr = (award) => {
    const c = award.criteria?.[0];
    if (!c) return '';
    return `${c.label}: ${c.unit === 'TTD' ? formatCurrency(c.target) : `${c.target} ${c.unit}`}`;
  };

  // Settlement history rows (current year).
  const settlementRows = (confirmedSettlements ?? [])
    .filter((s) => String(s.periodKey ?? '').startsWith(String(year)))
    .sort((a, b) => String(b.periodKey ?? '').localeCompare(String(a.periodKey ?? '')));

  // Cover meta.
  const persPct = latestPersistencyPercent(persistency);
  const monthsInService = (() => {
    const mo = parseFloat(agentProfile?.monthsInIndustry ?? agentProfile?.monthsAtTatil);
    return Number.isFinite(mo) && mo > 0 ? Math.round(mo) : null;
  })();
  const goalPct = ytdAPIGoal > 0 ? Math.round(Math.min(100, (model.heroPrimaryAPI / ytdAPIGoal) * 100)) : null;

  return {
    agentInfo,
    displayName: agentInfo?.displayName ?? 'Agent',
    roleLabel: agentInfo?.role ?? null,
    agentNumber: agentProfile?.agentNumber ?? null,
    monthsInService,
    persPct,
    year,
    rangeLabel,
    rangeLabelTrend: rangeLabel,
    issuedDate: now.toLocaleDateString('en-TT', { year: 'numeric', month: 'long', day: 'numeric' }),
    model,
    ytdAPIGoal,
    goalPct,
    heroPrimaryAPI: model.heroPrimaryAPI,
    heroApps: model.heroApps,
    heroEyebrow: model.heroEyebrow,
    hasSettlements: model.hasSettlements,
    closingRatio: model.closingRatio,
    bdRows, hasPppAny, hasLmpsAny,
    settledYTD_API, pendingYTD_API, effectiveYTD_API, effectiveYTD_Apps,
    settledFrac, pendingFrac, floorFrac, mdrtFrac, goalFrac, achievedPct,
    hasSettlementsForYear,
    mdrtTarget: MDRT_THRESHOLDS_2026.mdrt,
    companyFloor: COMPANY_FLOOR,
    chartData,
    currentLevel, nextLevel, isMaxLevel, levelProgressPct, appsNeeded,
    achievedAwards, inProgressAwards, notStartedAwards, awardList, awardReqStr,
    displayBullets,
    settlementRows,
  };
}
