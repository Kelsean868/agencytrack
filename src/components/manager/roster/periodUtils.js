const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function currentSundayStr(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function isoWeekNum(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOffset = startOfYear.getUTCDay();
  const dayOfYear = Math.floor((d - startOfYear) / 86400000);
  return Math.ceil((dayOfYear + dayOffset + 1) / 7);
}

export function periodLabel(period) {
  if (period.grain === 'year') return period.value;
  if (period.grain === 'month') {
    const [, m] = period.value.split('-');
    return `${MONTH_NAMES[parseInt(m, 10) - 1]} 2026`;
  }
  return `Wk ${isoWeekNum(period.value)} · 2026`;
}

export function defaultPeriodForGrain(grain, now = new Date()) {
  if (grain === 'year') return { grain, value: '2026' };
  if (grain === 'month') {
    return { grain, value: `2026-${String(now.getMonth() + 1).padStart(2, '0')}` };
  }
  return { grain, value: currentSundayStr(now) };
}

export function canStepPrev(period) {
  if (period.grain === 'year') return false;
  if (period.grain === 'month') return period.value > '2026-01';
  return period.value > '2026-01-04';
}

export function canStepNext(period, now = new Date()) {
  if (period.grain === 'year') return false;
  if (period.grain === 'month') {
    const cur = `2026-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return period.value < cur;
  }
  return period.value < currentSundayStr(now);
}

export function stepPrev(period) {
  if (period.grain === 'month') {
    const [y, m] = period.value.split('-').map(Number);
    const nm = m - 1;
    if (nm < 1) return period;
    return { grain: 'month', value: `${y}-${String(nm).padStart(2, '0')}` };
  }
  const d = new Date(period.value + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  if (d.getUTCFullYear() < 2026) return period;
  return { grain: 'week', value: d.toISOString().slice(0, 10) };
}

export function stepNext(period, now = new Date()) {
  if (period.grain === 'month') {
    const [y, m] = period.value.split('-').map(Number);
    const nm = m + 1;
    const curM = now.getMonth() + 1;
    if (nm > curM) return period;
    return { grain: 'month', value: `${y}-${String(nm).padStart(2, '0')}` };
  }
  const d = new Date(period.value + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  const curSun = currentSundayStr(now);
  if (d.toISOString().slice(0, 10) > curSun) return period;
  return { grain: 'week', value: d.toISOString().slice(0, 10) };
}
