const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatTenureStr(contractDate, now = new Date()) {
  if (!contractDate) return null;
  const d = new Date(contractDate);
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y}y ${m}m`;
}

export function formatContractDateStr(contractDate) {
  if (!contractDate) return null;
  const d = new Date(contractDate);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
