import { commissionThisMonth } from '../components/goals/CommissionPlayground/utils/commissionMath';

// dateIssued is stored as TT-local midnight at T04:00:00Z (parseDateOnlyTT convention).
// getUTCFullYear() on that Date gives the correct TT calendar year.
function ttYear(ts) {
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
  return d.getUTCFullYear();
}

// Sunday-week start key for a dateIssued Timestamp.
// Since dateIssued is at T04:00:00Z (TT midnight), getUTCDay() gives the TT day-of-week.
function weekStartMs(ts) {
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
  return d.getTime() - d.getUTCDay() * 86400000;
}

// Sunday-week key for the "today" anchor (uses TT timezone via Intl).
function todayWeekMs(today) {
  const ttDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(today);
  const tt = new Date(`${ttDateStr}T04:00:00Z`);
  return tt.getTime() - tt.getUTCDay() * 86400000;
}

// Σ earnedCommission over own settled policies in the given TT calendar year.
export function ytdEarned(policies, year) {
  return policies
    .filter((p) => p.status === 'settled' && p.dateIssued && ttYear(p.dateIssued) === year)
    .reduce((sum, p) => sum + (parseFloat(p.earnedCommission) || 0), 0);
}

// Trailing run-rate annualized from settled policy commissions.
// Groups by settled week; if >= 8 distinct weeks, uses all of them (isLinear: false).
// Fewer than 8 → linear-YTD fallback (isLinear: true).
// Returns { value, window, isLinear, weekCount }.
export function runRate(policies, today) {
  const maxWK = todayWeekMs(today);

  const settled = policies.filter(
    (p) => p.status === 'settled' && p.dateIssued && p.earnedCommission != null,
  );

  const byWeek = new Map();
  for (const p of settled) {
    const wk = weekStartMs(p.dateIssued);
    if (wk > maxWK) continue;
    byWeek.set(wk, (byWeek.get(wk) || 0) + (parseFloat(p.earnedCommission) || 0));
  }

  if (byWeek.size === 0) {
    return { value: 0, window: 'no data', isLinear: true, weekCount: 0 };
  }

  const weekCount = byWeek.size;
  const total = [...byWeek.values()].reduce((s, v) => s + v, 0);
  const annualized = (total / weekCount) * 52;

  if (weekCount >= 8) {
    return { value: annualized, window: `trailing-${weekCount}wk`, isLinear: false, weekCount };
  }
  return { value: annualized, window: `based on ${weekCount} weeks`, isLinear: true, weekCount };
}

// Convert committedAnnualAPI to its first-year commission equivalent using the
// existing commissionMath forward path, then return { goalAsCommission, gap }.
// gap = runRateValue - goalAsCommission (negative = behind goal).
// Returns null when committedAnnualAPI is absent (no goal set).
const DEFAULT_MODE_MIX = { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 };

export function gapToGoal(committedAnnualAPI, runRateValue, ratios) {
  if (!committedAnnualAPI || committedAnnualAPI <= 0) return null;
  const { modeMix = DEFAULT_MODE_MIX, commissionRate = 35 } = ratios || {};
  const goalAsCommission = commissionThisMonth({ totalApi: committedAnnualAPI, modeMix, commissionRate });
  return { goalAsCommission, gap: runRateValue - goalAsCommission };
}

// Latest persistency % from the agent's E3 history.
// getAgentHistory returns oldest-first; last entry is the most recent.
// Returns { pct, monthKey } or null.
export function latestPersistency(history) {
  if (!history || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
  const last = sorted[0];
  if (last.persistency == null) return null;
  return { pct: last.persistency, monthKey: last.monthKey };
}
