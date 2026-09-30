import { compute2YearAverageAPI } from '../../utils/careerLevelHelpers';
import { aggregatePersistency } from '../persistency/calculations';
import { roundPersistencyPct } from '../persistency/persistencyRounding';

/**
 * careerModel — the Career portal's levels, copy and pure derivations (R2-10).
 * Moved VERBATIM out of src/components/profile/CareerPortal.jsx so the Nexus
 * portal and the FR Career screen compute the level, the estimate and the
 * stats from one place. Pinned by
 * src/components/profile/__tests__/CareerPortal.characterization.test.jsx.
 * Level thresholds, the verdict logic and the estimate maths are unchanged.
 */

export const CAREER_LEVELS = [
  { level: 1, title: 'Salesperson',    minApi: 200000, minApps: 42, minPersistency: 90, minYears: 0  },
  { level: 2, title: 'Advisor II',     minApi: 250000, minApps: 42, minPersistency: 90, minYears: 2  },
  { level: 3, title: 'Advisor III',    minApi: 350000, minApps: 48, minPersistency: 90, minYears: 3  },
  { level: 4, title: 'Advisor IV',     minApi: 450000, minApps: 48, minPersistency: 90, minYears: 4  },
  { level: 5, title: 'Senior Advisor', minApi: 600000, minApps: 52, minPersistency: 90, minYears: 5  },
  { level: 6, title: 'Elite Advisor',  minApi: 800000, minApps: 52, minPersistency: 90, minYears: 6  },
  { level: 7, title: 'Legend',         minApi: null,   minApps: null, minPersistency: null, minYears: 10 },
];

export const LEVEL_TAGLINES = {
  1: 'Where every journey starts.',
  2: 'Earned consistency — the first tier reward.',
  3: 'Repeatable production — referrals open up.',
  4: 'Senior tier of the producing ranks.',
  5: 'Industry recognition — advisor seniority.',
  6: 'Elite producer — top-tier rewards.',
  7: "Chairman's recognition — the pinnacle.",
};

export const UNLOCK_COPY = {
  2: [{ label: 'Higher commission rate',   detail: 'Tier 2 schedule' },
      { label: '"Advisor II" title',        detail: 'Official designation' },
      { label: 'Advanced training modules', detail: 'Onboarded access' }],
  3: [{ label: 'Elevated commission tier',   detail: 'Tier 3 schedule' },
      { label: '"Advisor III" designation',  detail: 'Official designation' },
      { label: 'Priority client referrals',  detail: 'Branch-routed leads' }],
  4: [{ label: 'Senior commission tier',   detail: 'Tier 4 schedule' },
      { label: '"Advisor IV" + cards',      detail: 'Title + business cards' },
      { label: 'Mentorship eligibility',    detail: 'Bring on a junior' }],
  5: [{ label: 'Senior Advisor recognition', detail: 'Industry standing' },
      { label: 'Dedicated branch support',   detail: 'Direct BM channel' },
      { label: 'Quarterly bonus eligibility',detail: 'TTD 8K–25K per quarter' },
      { label: 'Conference seat',            detail: 'Annual leadership event' }],
  6: [{ label: '"Elite Advisor" title',   detail: 'Top of the producing ranks' },
      { label: 'Top-tier commission',      detail: 'Maximum schedule' },
      { label: 'Conference + retreat',     detail: 'Annual incentive trip' }],
  7: [{ label: '"Legend" designation',    detail: "Chairman's recognition" },
      { label: 'Lifetime acknowledgement', detail: 'Hall of fame' },
      { label: 'Legacy portfolio',         detail: 'Senior advisor lineage' }],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
export function getLevelState(level, currentLevel) {
  if (level < currentLevel) return 'achieved';
  if (level === currentLevel) return 'current';
  return 'locked';
}

export function computeQuarterlyAPI(submissions) {
  // Returns up to 8 quarterly API totals (oldest first)
  const byQuarterKey = {};
  for (const s of (submissions ?? [])) {
    if (s.status !== 'submitted' || !s.weekStarting) continue;
    const d = new Date(s.weekStarting + 'T12:00:00Z');
    const y = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3);
    const key = `${y}-Q${q}`;
    byQuarterKey[key] = (byQuarterKey[key] || 0) + (parseFloat(s.apiSold) || 0);
  }
  const sorted = Object.entries(byQuarterKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([, v]) => Math.round(v / 1000)); // TTD thousands
  // Pad to 8 if fewer
  while (sorted.length < 8) sorted.unshift(0);
  return sorted;
}

export function weeksSubmittedThisYear(submissions, year) {
  return (submissions ?? []).filter(
    s => s.status === 'submitted' && s.weekStarting?.startsWith(String(year))
  ).length;
}

export function estimateWeeksToNextLevel(ytdAPI, nextLevelApi, weeklyPace) {
  if (!nextLevelApi) return null;
  if (ytdAPI >= nextLevelApi) return 'You qualify!';
  if (!weeklyPace || weeklyPace <= 0) return null;
  const remaining = nextLevelApi - ytdAPI;
  const weeks = Math.ceil(remaining / weeklyPace);
  if (weeks <= 4) return `about ${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.round(weeks / 4.33);
  return `about ${months} month${months === 1 ? '' : 's'}`;
}

/**
 * The portal's stats for `thisYear` (was CareerPortal's useMemo, verbatim).
 * @returns {{ ytdAPI:number, ytdApps:number, avgPersistency:number|null,
 *             yearsOfService:number|null, trailing2YrAPI:number, weeklyPace:number }}
 */
export function careerStats(submissions, persistencyData, user, thisYear) {
  const ytdSubs = (submissions ?? []).filter(
    s => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
  );
  const ytdAPI  = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold) || 0), 0);
  const ytdApps = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);

  const persArr = Array.isArray(persistencyData) ? persistencyData : [];
  const ytdPers = persArr.filter(p => p.year === thisYear);
  // 2 decimals, half up (ruling R-a): the level check and the drawer judge
  // the same value the drawer prints.
  const avgPersistency = ytdPers.length > 0
    ? roundPersistencyPct(aggregatePersistency(ytdPers).aggregatedPersistency * 100)
    : null;

  let yearsOfService = null;
  if (user?.startDate) {
    const start = new Date(user.startDate);
    if (!isNaN(start)) yearsOfService = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }

  const trailing2YrAPI = compute2YearAverageAPI(submissions, thisYear);
  const weeksCount = weeksSubmittedThisYear(submissions, thisYear);
  const weeklyPace = weeksCount > 0 ? ytdAPI / weeksCount : 0;

  return { ytdAPI, ytdApps, avgPersistency, yearsOfService, trailing2YrAPI, weeklyPace };
}

/** The highest level whose every criterion is met, in order (was a useMemo, verbatim). */
export function currentLevel({ trailing2YrAPI, ytdApps, avgPersistency, yearsOfService }) {
  let highest = CAREER_LEVELS[0];
  for (const lvl of CAREER_LEVELS) {
    const apiOk   = lvl.minApi === null   || trailing2YrAPI >= lvl.minApi;
    const appsOk  = lvl.minApps === null  || ytdApps >= lvl.minApps;
    const persOk  = lvl.minPersistency === null || (avgPersistency !== null && avgPersistency >= lvl.minPersistency);
    const yearsOk = lvl.minYears === 0 || (yearsOfService !== null && yearsOfService >= lvl.minYears);
    if (apiOk && appsOk && persOk && yearsOk) highest = lvl;
    else break;
  }
  return highest;
}

/** A level's criteria against the stats, as the level drawer lists them (moved verbatim). */
export function levelCriteria(lvl, { ytdApps, avgPersistency, yearsOfService, trailing2YrAPI }) {
  const criteria = [];
  if (lvl.minApi !== null)          criteria.push({ label: '2-yr Avg API', current: trailing2YrAPI, target: lvl.minApi, fmt: 'currency' });
  if (lvl.minApps !== null)         criteria.push({ label: 'YTD Applications', current: ytdApps, target: lvl.minApps, fmt: 'count' });
  if (lvl.minPersistency !== null)  criteria.push({ label: 'Persistency rate', current: avgPersistency ?? 0, target: lvl.minPersistency, fmt: 'percent' });
  if (lvl.minYears > 0)             criteria.push({ label: 'Years of service', current: yearsOfService ?? 0, target: lvl.minYears, fmt: 'years' });
  return criteria;
}

/**
 * The same 8 quarters as computeQuarterlyAPI (same filter, same grouping,
 * same rounding), with their keys, so a chart can label them. Padding quarters
 * (fewer than 8 on file) have key null. R2-10; pinned equal to
 * computeQuarterlyAPI by careerModel.test.js.
 */
export function quarterlyAPISeries(submissions) {
  const byQuarterKey = {};
  for (const s of (submissions ?? [])) {
    if (s.status !== 'submitted' || !s.weekStarting) continue;
    const d = new Date(s.weekStarting + 'T12:00:00Z');
    const key = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3)}`;
    byQuarterKey[key] = (byQuarterKey[key] || 0) + (parseFloat(s.apiSold) || 0);
  }
  const series = Object.entries(byQuarterKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, v]) => ({ key, value: Math.round(v / 1000) }));
  while (series.length < 8) series.unshift({ key: null, value: 0 });
  return series;
}
