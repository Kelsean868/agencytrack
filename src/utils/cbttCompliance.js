export function isProvisional(user) {
  return user?.licenseStatus === 'provisional';
}

// Adds N calendar months to a Date, clamping day to end-of-month if needed.
function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // If day overflowed (e.g. Jan 31 + 1 month → Mar 3), clamp to last day of intended month
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

export function cbttEffectiveDeadline(user) {
  if (!user?.contractStartDate) return null;
  // Parse YYYY-MM-DD at noon local to avoid UTC-offset midnight-rollback
  const start = new Date(user.contractStartDate + 'T12:00:00');
  if (isNaN(start.getTime())) return null;
  return addMonths(start, user.cbttExtensionGranted ? 24 : 12);
}

export function cbttComplianceFlag(user, today = new Date()) {
  if (!isProvisional(user)) return null;
  const deadline = cbttEffectiveDeadline(user);
  if (!deadline) return null;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / MS_PER_DAY);
  return {
    deadline,
    daysRemaining,
    atRisk: daysRemaining <= 90,
    extended: !!user.cbttExtensionGranted,
  };
}
