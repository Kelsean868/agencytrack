// Month labels for the persistency outlook. A fixed table, not toLocaleString:
// ICU spells September "Sept" on some runtimes, and a label on a money surface
// must not drift between machines (same reason as ledgerPrefill's MONTH_ABBR).

const MONTH_ABBR = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** `'2026-08'` → `'Aug 2026'`. */
export function outlookMonthLabel(monthKey) {
  if (!MONTH_KEY_RE.test(String(monthKey))) return '—';
  return `${MONTH_ABBR[Number(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}`;
}

/** `'2026-12'` → `'31 Dec'`, the last day of the month. */
export function outlookMonthEndLabel(monthKey) {
  if (!MONTH_KEY_RE.test(String(monthKey))) return '—';
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${lastDay} ${MONTH_ABBR[m - 1]}`;
}

/** `'2026-09-15'` → `'15 Sep 2026'`. */
export function outlookDateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return '—';
  return `${Number(date.slice(8, 10))} ${MONTH_ABBR[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
