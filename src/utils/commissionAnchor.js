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
// Arm selected by history SPAN (first settled week to today's week):
//   span >= 8 cal weeks → trailing: Σ(8-calendar-week window, zero-filled) ÷ 8 × 52
//   span <  8 cal weeks → linear-YTD: ytdEarned ÷ elapsedTTYearWeeks × 52
// Returns { value, window, isLinear, weekCount }.
export function runRate(policies, today) {
  const WEEK_MS = 7 * 86400000;
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
  const firstSettledWk = Math.min(...byWeek.keys());
  const spanWeeks = (maxWK - firstSettledWk) / WEEK_MS;

  if (spanWeeks >= 8) {
    let trailing8Total = 0;
    for (let i = 0; i < 8; i++) {
      trailing8Total += byWeek.get(maxWK - i * WEEK_MS) || 0;
    }
    return { value: (trailing8Total / 8) * 52, window: 'trailing-8wk', isLinear: false, weekCount };
  }

  // Linear-YTD: ytdEarned ÷ elapsed TT-year weeks × 52
  const ttDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(today);
  const year = parseInt(ttDateStr.split('-')[0], 10);
  const jan1 = new Date(`${year}-01-01T04:00:00Z`);
  const jan1WkMs = jan1.getTime() - jan1.getUTCDay() * 86400000;
  const elapsedWeeks = (maxWK - jan1WkMs) / WEEK_MS + 1;
  const ytd = [...byWeek.values()].reduce((s, v) => s + v, 0);
  return { value: (ytd / elapsedWeeks) * 52, window: `based on ${elapsedWeeks} weeks`, isLinear: true, weekCount };
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
