export function getMostRecentSunday() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());
  return toDateString(d);
}

export function getLastNSundays(n) {
  const sundays = [];
  const base = new Date();
  base.setDate(base.getDate() - base.getDay());
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i * 7);
    sundays.push(toDateString(d));
  }
  return sundays;
}

function toDateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
