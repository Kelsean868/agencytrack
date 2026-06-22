// Tabs visible in the sidebar but gated as "Coming soon" for the Tatil pilot.
// To un-gate a tab: (1) remove its tabId from the set below,
// (2) restore the component import in the dashboard file,
// (3) replace <ComingSoonPanel> with the real component in the tab render block.
export const COMING_SOON_TABS = new Set([
  'prospect-info',
  // Planner — nav redesign PR-1 SOON stub (agent + producing-manager nav).
  // No render-switch case: disabled items are non-navigable, so 'planner' is
  // never set as activeTab. Un-gate when the Planner surface ships.
  'planner',
]);

// Manager dashboard gated tabs (ManagerDashboard + TenantAdminDashboard).
export const MANAGER_COMING_SOON_TABS = new Set([
]);
