// Kiosk v2 (3.6) — pure celebrations derivation.
//
// Work anniversaries from `contractStartDate` for the CURRENT week window.
// Mirrors the 3.3 Meeting Mode precedent (deriveAnniversaries): there is NO
// DOB field on user docs, so BIRTHDAYS are skip-logged — anniversaries only.
// Kept self-contained (no cross-import from the manager tree) so the kiosk
// bundle stays standalone and the logic is independently testable.

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Parse a YYYY-MM-DD string into a UTC Date (null on anything malformed).
function parseYMD(s) {
  if (typeof s !== 'string') return null;
  const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function initialsOf(name) {
  return (name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * currentWeekSundayYMD(ref?) — the most recent Sunday (start of the display
 * week) as a YYYY-MM-DD string. Uses local calendar components (the wall runs
 * in the branch's local time).
 */
export function currentWeekSundayYMD(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * deriveKioskCelebrations(users, ref?)
 *
 * Returns [{ id, name, initials, years, dateLabel, unit }] for every user whose
 * contractStartDate month/day falls inside the 7-day window starting on the
 * current week's Sunday, with ≥1 completed year. Sorted by years desc.
 */
export function deriveKioskCelebrations(users, ref = new Date()) {
  const sunday = parseYMD(currentWeekSundayYMD(ref));
  if (!sunday) return [];

  const windowDays = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(sunday.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    windowDays.push(`${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  const displayYear = sunday.getUTCFullYear();

  const out = [];
  (users || []).forEach((u) => {
    const csd = u?.contractStartDate;
    const d = parseYMD(csd);
    if (!d) return;
    const md = `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    if (windowDays.indexOf(md) < 0) return;
    const years = displayYear - d.getUTCFullYear();
    if (years < 1) return;
    const name = u.name ?? u.displayName ?? u.email ?? 'Advisor';
    out.push({
      id: u.id,
      name,
      initials: initialsOf(name),
      years,
      dateLabel: csd.slice(5, 10), // MM-DD
      unit: u.unitId ? `Unit ${String(u.unitId).slice(-4)}` : '',
    });
  });

  out.sort((a, b) => b.years - a.years || a.name.localeCompare(b.name));
  return out;
}
