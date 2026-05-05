export const getUnitDisplayName = (unitManagerDoc) => {
  if (!unitManagerDoc) return 'Unknown Unit';
  if (unitManagerDoc.unitName?.trim()) return unitManagerDoc.unitName.trim();
  const name = unitManagerDoc.name || unitManagerDoc.displayName || 'Unit Manager';
  return `${name}'s Unit`;
};

export const ROLE_LABELS = {
  tenant_admin: 'Tenant Admin',
  platform_admin: 'Platform Admin',
  branch_manager: 'Branch Manager',
  unit_manager: 'Unit Manager',
  agent: 'Agent',
};

export const getRoleLabel = (role) => ROLE_LABELS[role] ?? 'Unknown';

export const formatCurrency = (amount) => {
  const num = parseFloat(amount ?? 0);
  return 'TTD ' + num.toLocaleString('en-TT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const formatPercent = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

export const formatDateDisplay = (isoString) => {
  if (!isoString) return '';
  const [yyyy, mm, dd] = isoString.split('-');
  return `${dd}-${mm}-${yyyy}`;
};

export const formatDateFriendly = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString + 'T12:00:00Z').toLocaleDateString('en-TT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
};