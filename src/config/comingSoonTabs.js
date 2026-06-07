// Tabs visible in the sidebar but gated as "Coming soon" for the Tatil pilot.
// To un-gate a tab: (1) remove its tabId from the set below,
// (2) restore the component import in the dashboard file,
// (3) replace <ComingSoonPanel> with the real component in the tab render block.
export const COMING_SOON_TABS = new Set([
  'money-needs',
  'goals',
  'prospect-info',
]);

// Manager dashboard gated tabs (ManagerDashboard + TenantAdminDashboard).
export const MANAGER_COMING_SOON_TABS = new Set([
  'goals',
]);
