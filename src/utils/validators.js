export function validateSundayDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

export function getRecentSundays(count = 8) {
  const sundays = [];
  const today = new Date();
  const mostRecentSunday = new Date(today);
  mostRecentSunday.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < count; i++) {
    const d = new Date(mostRecentSunday);
    d.setDate(mostRecentSunday.getDate() - i * 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    sundays.push(`${yyyy}-${mm}-${dd}`);
  }
  return sundays;
}

export function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-TT', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
