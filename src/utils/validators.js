// MUST stay in sync with the matching file at functions/utils/validators.js.
// Email-format spec is locked across client + server defense-in-depth (Track C
// C2, Q6 ratification 2026-05-08). If the regex changes here, update the
// Cloud Function copy in the same PR.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_RE.test(email.trim());
}

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
