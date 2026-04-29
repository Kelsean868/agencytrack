export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  unit_manager: 'Unit Manager',
  agent: 'Agent',
};

export const getRoleLabel = (role) => ROLE_LABELS[role] ?? 'Unknown';

export const formatCurrency = (amount) => {
  const num = parseFloat(amount ?? 0);
  return 'TTD ' + num.toLocaleString('en-TT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatPercent = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;