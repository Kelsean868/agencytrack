// Track K · K9 — Paydown-arc model (pure module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. The caller (FinancingSelfView / PaydownArcHero)
// already loads the financing ledger via listFinancingMonths and passes the rows
// in; this module turns the running-balance history into the hero's arc geometry
// — an actual paydown polyline + a straight-line projection to zero. It NEVER
// fetches and NEVER writes, and it derives DISPLAY geometry only (no money moves).
//
// Honest math (locked): the projection is a straight line at the CURRENT AVERAGE
// paydown rate (balance decline per calendar month over the entered history).
//   • < 2 balance points  → no rate can be computed → arc renders, NO projection.
//   • rate <= 0 (flat / growing balance) → NO projection, honest copy, never NaN.
//   • latest balance <= 0 (already cleared / surplus) → NO projection needed; the
//     arc dips below the zero baseline (surplus is NOT an error).
// A missing/malformed value never becomes a fabricated point — it is dropped.

import { monthsBetweenKeys } from '../utils/dateInputs';

// SVG coordinate frame (matches the K9 mockup's desktop arc viewBox). The
// component renders <svg viewBox="0 0 560 150" preserveAspectRatio="none"> and
// scales it to the hero width; geometry is computed once here in these units.
export const ARC_VIEW = Object.freeze({
  W: 560,
  H: 150,
  xLeft: 30,
  xRight: 536,
  yBase: 132, // zero-balance baseline
  yTop: 12,   // max-balance ceiling
  yFloor: 146, // clamp for below-baseline (surplus) points
});

const MONTH_KEY_RE = /^\d{4}_\d{2}$/;

function round(n) {
  return Math.round(n * 100) / 100;
}

// Add n whole months to a "YYYY_MM" key (n may be 0+; used for projection).
export function addMonthsToKey(monthKey, n) {
  if (typeof monthKey !== 'string' || !MONTH_KEY_RE.test(monthKey)) return null;
  const [y, m] = monthKey.split('_').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}_${String(nm).padStart(2, '0')}`;
}

// The actual balance series: ledger rows carrying a finite runningBalance, sorted
// ascending by month, as [{ month, balance }]. Malformed rows are dropped.
export function buildBalanceSeries(ledger) {
  return (Array.isArray(ledger) ? ledger : [])
    .filter((r) => typeof r?.month === 'string' && MONTH_KEY_RE.test(r.month))
    .map((r) => ({ month: r.month, balance: typeof r.runningBalance === 'number' ? r.runningBalance : parseFloat(r.runningBalance) }))
    .filter((r) => Number.isFinite(r.balance))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

// Average monthly balance DECLINE across the series (positive = paying down).
// Computed over the calendar-month span (first→last), so month gaps don't inflate
// the rate. Returns null when < 2 points (no trend derivable).
export function computeAveragePaydownRate(series) {
  const list = Array.isArray(series) ? series : [];
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const span = monthsBetweenKeys(first.month, last.month);
  if (!Number.isFinite(span) || span <= 0) return null;
  return (first.balance - last.balance) / span;
}

// Straight-line projection from the latest balance down to zero at `rate` per
// month. Returns null when there is nothing honest to project (no rate, rate<=0,
// or latest balance already <= 0). Otherwise returns the projected points
// (excluding the now-point) ending exactly at 0, plus the clear horizon.
export function projectToZero(series, rate) {
  const list = Array.isArray(series) ? series : [];
  if (list.length === 0) return null;
  const last = list[list.length - 1];
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (!(last.balance > 0)) return null; // already cleared or in surplus
  const clearMonths = Math.max(1, Math.ceil(last.balance / rate));
  const projected = [];
  for (let k = 1; k <= clearMonths; k += 1) {
    const bal = Math.max(0, last.balance - rate * k);
    projected.push({ month: addMonthsToKey(last.month, k), balance: bal });
  }
  // Force the final point to exactly zero (the clear crossing).
  if (projected.length) projected[projected.length - 1].balance = 0;
  return {
    projected,
    clearMonths,
    clearMonthKey: addMonthsToKey(last.month, clearMonths),
  };
}

// Assemble the full arc view-model from a ledger. See the module header for the
// honest-math contract. `points.*` are SVG coordinates in the ARC_VIEW frame.
export function computePaydownArcModel({ ledger } = {}) {
  const series = buildBalanceSeries(ledger);
  const empty = {
    hasData: false,
    series: [],
    rate: null,
    hasProjection: false,
    nowBalance: null,
    isSurplus: false,
    projectedClearMonths: null,
    projectedClearMonthKey: null,
    points: { actual: [], projected: [], area: [], now: null, clear: null },
  };
  if (series.length === 0) return empty;

  const nowBalance = series[series.length - 1].balance;
  const isSurplus = nowBalance < 0;
  const rate = computeAveragePaydownRate(series);
  const projection = projectToZero(series, rate);
  const projected = projection?.projected ?? [];
  const hasProjection = projected.length > 0;

  const { xLeft, xRight, yBase, yTop, yFloor } = ARC_VIEW;

  // Combined timeline: actual months then projected months. x maps by calendar
  // offset from the first actual month; y maps balance vs the max in the frame.
  const firstMonth = series[0].month;
  const allPoints = [...series, ...projected];
  const maxOffset = allPoints.reduce(
    (acc, p) => Math.max(acc, monthsBetweenKeys(firstMonth, p.month) || 0),
    0,
  );
  const maxBalance = allPoints.reduce((acc, p) => Math.max(acc, p.balance), 0);
  const denomBal = maxBalance > 0 ? maxBalance : 1; // avoid /0 for all-surplus books

  const xFor = (month) => {
    if (maxOffset <= 0) return xLeft;
    const off = monthsBetweenKeys(firstMonth, month) || 0;
    return round(xLeft + (off / maxOffset) * (xRight - xLeft));
  };
  const yFor = (balance) => {
    const frac = balance / denomBal;
    const y = yBase - frac * (yBase - yTop);
    return round(Math.min(yFloor, Math.max(yTop - 2, y)));
  };

  const actual = series.map((p) => ({ x: xFor(p.month), y: yFor(p.balance) }));
  const projPts = projected.map((p) => ({ x: xFor(p.month), y: yFor(p.balance) }));
  const now = actual[actual.length - 1];
  const clear = hasProjection ? projPts[projPts.length - 1] : null;

  // Area polygon under the actual line (down to the baseline, back to start).
  const area = actual.length >= 2
    ? [...actual, { x: now.x, y: yBase }, { x: actual[0].x, y: yBase }]
    : [];

  return {
    hasData: true,
    series,
    rate: rate == null ? null : round(rate),
    hasProjection,
    nowBalance,
    isSurplus,
    projectedClearMonths: projection?.clearMonths ?? null,
    projectedClearMonthKey: projection?.clearMonthKey ?? null,
    points: { actual, projected: projPts, area, now, clear },
  };
}
