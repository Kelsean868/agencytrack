import { formatCurrency } from '../../utils/formatters';
import { formatPersistencyPct } from '../persistency/persistencyRounding';
import {
  CAREER_LEVELS, LEVEL_TAGLINES, UNLOCK_COPY, getLevelState, levelCriteria, estimateWeeksToNextLevel,
} from '../career/careerModel';

/**
 * careerViewModel — pure shapers for the FR Career screen (R2-10, canvas
 * D3-Career / M3-Career). Every rule, threshold and verdict comes from
 * src/lib/career/careerModel.js (the Nexus portal's own logic, moved there
 * verbatim); this file only formats and selects. No reads, no writes.
 */

const CRITERION_KEY = {
  '2-yr Avg API': 'api',
  'YTD Applications': 'apps',
  'Persistency rate': 'persistency',
  'Years of service': 'years',
};

/** Same value formats as the level drawer (fmtV). */
export function formatCriterion(v, kind) {
  if (kind === 'currency') return v >= 1000 ? `TTD ${(v / 1000).toFixed(0)}K` : `TTD ${Math.round(v)}`;
  if (kind === 'percent') return formatPersistencyPct(v);
  if (kind === 'years') return `${v.toFixed(1)} yrs`;
  if (kind === 'count') return String(Math.round(v));
  throw new Error(`formatCriterion: unknown kind "${kind}"`);
}

/** The 7 ladder coins: done / you-are-here / locked. */
export function ladderCoins(currentLevel) {
  return CAREER_LEVELS.map((lvl) => {
    const state = getLevelState(lvl.level, currentLevel);
    return {
      level: lvl.level,
      title: lvl.title,
      state,
      sub: state === 'achieved' ? 'Done' : state === 'current' ? 'You are here'
        : lvl.minApi ? `TTD ${(lvl.minApi / 1000).toFixed(0)}K API` : 'Pinnacle',
    };
  });
}

/** Default selected level: the next level, or the top level if you are there. */
export function defaultSelectedLevel(currentLevel) {
  return Math.min(currentLevel + 1, CAREER_LEVELS.length);
}

/**
 * One ring per criterion the level has (Legend has only years): % complete
 * (capped 0–100, rounded as the drawer rounds), cleared at current ≥ target.
 * `stats.avgPersistency` is already the 2-dp value (careerStats), so 89.996
 * clears a 90 level and 89.994 does not.
 */
export function levelRings(level, stats) {
  const lvl = CAREER_LEVELS.find((l) => l.level === level);
  if (!lvl) throw new Error(`levelRings: unknown level ${level}`);
  return levelCriteria(lvl, stats).map((c) => {
    const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;
    const cleared = c.current >= c.target;
    return {
      key: CRITERION_KEY[c.label],
      label: c.label,
      pct,
      cleared,
      value: formatCriterion(c.current, c.fmt),
      target: formatCriterion(c.target, c.fmt),
      current: c.current,
      goal: c.target,
      fmt: c.fmt,
    };
  });
}

/** The selected level's panel: tagline, criteria, unlocks (UNLOCK_COPY verbatim). */
export function levelPanel(level, currentLevel, stats) {
  const lvl = CAREER_LEVELS.find((l) => l.level === level);
  if (!lvl) throw new Error(`levelPanel: unknown level ${level}`);
  const state = getLevelState(level, currentLevel);
  const rings = levelRings(level, stats);
  return {
    level,
    title: lvl.title,
    kicker: level === currentLevel + 1 ? 'Next milestone' : state === 'achieved' ? 'Achieved' : state === 'current' ? 'Your current level' : 'Future level',
    tagline: LEVEL_TAGLINES[level] || '',
    toClear: `${rings.length} to clear`,
    criteria: rings,
    unlocks: UNLOCK_COPY[level] || [],
  };
}

/** Whole weeks left in `today`'s calendar year, at least 1 (so the 31-12 rate never divides by 0). */
export function weeksLeftInYear(today) {
  const end = Date.UTC(today.getFullYear(), 11, 31);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.ceil((end - now) / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * "Biggest gap": the unmet criterion FURTHEST behind (lowest % complete),
 * years of service excluded (it cannot be sped up). Ties go to the earlier
 * criterion in level order (API, applications, persistency). Every
 * production criterion cleared → null (the block hides).
 */
export function biggestGap(level, stats, today = new Date()) {
  const lvl = CAREER_LEVELS.find((l) => l.level === level);
  if (!lvl) return null;
  const open = levelRings(level, stats).filter((r) => r.key !== 'years' && !r.cleared);
  if (!open.length) return null;
  const pick = open.reduce((best, r) => (r.pct < best.pct ? r : best), open[0]);
  const remaining = pick.goal - pick.current;
  if (pick.key === 'apps') {
    const need = Math.ceil(remaining);
    const perWeek = Math.ceil(need / weeksLeftInYear(today));
    return { key: 'apps', label: 'Applications', text: `${need} to go — about ${perWeek} a week to 31-12.` };
  }
  if (pick.key === 'api') return { key: 'api', label: '2-year average API', text: `${formatCurrency(Math.round(remaining))} to go.` };
  return { key: 'persistency', label: 'Persistency', text: `${remaining.toFixed(2)} points to go.` };
}

/** "At your pace": the estimate verbatim, and what it is built from. */
export function paceModel(currentLevel, stats) {
  const next = CAREER_LEVELS.find((l) => l.level === currentLevel + 1) ?? null;
  if (!next) return { top: true };
  const estimate = estimateWeeksToNextLevel(stats.ytdAPI, next.minApi, stats.weeklyPace);
  if (estimate == null) return { top: false, estimate: null, basis: 'Not enough weeks submitted yet to estimate' };
  const still = Math.max(0, (next.minApi ?? 0) - stats.ytdAPI);
  return {
    top: false,
    estimate,
    basis: still > 0
      ? `Your pace is ${formatCurrency(Math.round(stats.weeklyPace))} a week; ${formatCurrency(Math.round(still))} of API still needed this year for ${next.title}.`
      : `Your API this year is already past ${formatCurrency(next.minApi)} for ${next.title}.`,
  };
}
