// Tabs visible in the sidebar but gated as "Coming soon" for the Tatil pilot.
// To un-gate a tab: remove its tabId from the appropriate set below.
// All gating logic reads exclusively from these constants.
export const COMING_SOON_TABS = new Set([
  'money-needs',
  'goals',
  'prospect-info',
]);

// Manager dashboard gated tabs (ManagerDashboard + TenantAdminDashboard).
export const MANAGER_COMING_SOON_TABS = new Set([
  'goals',
]);
