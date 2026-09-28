/**
 * FR navigation model (FR-D9, docs/briefs/fr-agent-redesign-program.md).
 *
 * The desktop sidebar is grouped Work · Numbers · Money · Compete · You
 * (canvas D3-Sidebar). Every item maps onto an EXISTING AgentDashboard
 * `activeTab` route or action, so no feature loses its home. Hub items (Money,
 * Numbers) own several existing routes as sub-items; the hub header shows them
 * as chips.
 *
 * `ready` gates items whose FR screen lands in a later slice (Focus, Pipeline,
 * Campaign, Trophies): they are hidden until then, never shown as a stub.
 *
 * Pure data + pure helpers. No React, no Firebase.
 */

export const FR_ICON_PATHS = Object.freeze({
  today: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  focus: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  week: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 9h18M8 2v4M16 2v4',
  pipeline: 'M3 4h18l-7 8v6l-4 2v-8z',
  prep: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  numbers: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  ledger: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
  money: 'M2 6h20v13H2zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  arena: 'M4 20h4v-7H4zM10 20h4V8h-4zM16 20h4v-10h-4z',
  campaign: 'M4 22V4M4 4h13l-2 4 2 4H4',
  awards: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8',
  trophies: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  career: 'M12 2 3 7l9 5 9-5zM3 17l9 5 9-5M3 12l9 5 9-5',
  connections: 'M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  report: 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h5',
  check: 'M20 6 9 17l-5-5',
  log: 'M12 5v14M5 12h14',
  signOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
});

/**
 * Sidebar model. `tabId` = existing AgentDashboard route; `subs` = the routes a
 * hub owns (first sub is the hub's default). `ready: false` hides the item.
 */
export const FR_NAV = Object.freeze([
  { id: 'today', label: 'Today', icon: 'today', tabId: 'dashboard', group: 'Work' },
  { id: 'focus', label: 'Focus', icon: 'focus', tabId: 'focus', group: 'Work' },
  { id: 'week', label: 'Week', icon: 'week', tabId: 'planner', group: 'Work' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', tabId: 'pipeline', group: 'Work' },
  { id: 'prep', label: 'Prospect prep', icon: 'prep', tabId: 'prospect-info', group: 'Work' },
  {
    id: 'numbers', label: 'Numbers', icon: 'numbers', group: 'Numbers',
    subs: [
      { id: 'production', label: 'Production report', tabId: 'production-report' },
      { id: 'report', label: 'Performance report', tabId: 'agent-report' },
      { id: 'history', label: 'History', tabId: 'history' },
    ],
  },
  { id: 'ledger', label: 'Policy ledger', icon: 'ledger', tabId: 'policy-ledger', group: 'Numbers' },
  {
    id: 'money', label: 'Money', icon: 'money', group: 'Money',
    subs: [
      // FR-3: the Money hub's own Overview (new route, FR-D9); the rest are the
      // existing calculator routes, each mounted unchanged under an FR header.
      { id: 'overview', label: 'Overview', tabId: 'money' },
      { id: 'goals', label: 'Goals and MDRT', tabId: 'goals' },
      { id: 'gameplan', label: 'Game plan', tabId: 'game-plan' },
      { id: 'moneyneeds', label: 'Money needs', tabId: 'money-needs' },
      { id: 'commission', label: 'Commission', tabId: 'commission' },
      { id: 'persistency', label: 'Persistency', tabId: 'persistency' },
      { id: 'financing', label: 'Financing', tabId: 'financing' },
    ],
  },
  { id: 'arena', label: 'Leaderboard', icon: 'arena', tabId: 'production-leaderboard', group: 'Compete' },
  { id: 'campaign', label: 'Campaign', icon: 'campaign', tabId: 'campaign', group: 'Compete', ready: false },
  { id: 'awards', label: 'Awards', icon: 'awards', tabId: 'awards', group: 'Compete' },
  { id: 'trophies', label: 'Trophy room', icon: 'trophies', tabId: 'trophies', group: 'Compete', ready: false },
  { id: 'me', label: 'Me', icon: 'me', tabId: 'profile', group: 'You' },
  { id: 'career', label: 'Career', icon: 'career', tabId: 'career', group: 'You' },
  { id: 'connections', label: 'Connections', icon: 'connections', tabId: 'call-sources', group: 'You' },
]);

/** Visible items only (ready !== false). */
export function frNavItems(nav = FR_NAV) {
  return nav.filter((it) => it.ready !== false);
}

/** The item (and sub) that owns a route, or null. */
export function frFindByTab(tabId, nav = FR_NAV) {
  for (const it of nav) {
    if (it.tabId === tabId) return { item: it, sub: null };
    const sub = it.subs?.find((s) => s.tabId === tabId);
    if (sub) return { item: it, sub };
  }
  return null;
}

/** Where a click on an item goes: its own route, or its hub's first sub. */
export function frTargetTab(item) {
  return item.tabId ?? item.subs?.[0]?.tabId ?? null;
}

/** A readable screen title for the top bar. */
export function frTitleFor(tabId, fallback = 'AgencyTrack') {
  if (tabId === 'dashboard') return 'Today';
  if (tabId === 'settings') return 'Settings';
  const hit = frFindByTab(tabId);
  if (!hit) return fallback;
  return hit.item.label;
}

/**
 * Flat items for the EXISTING shell consumers that still run under FR — the
 * mobile More sheet and the Cmd-K palette — in their item shape
 * ({ id, label, tabId, sectionLabel, Icon? }). Hub subs become their own rows
 * so every route stays one search away.
 */
export function frFlatItems(nav = FR_NAV) {
  const out = [];
  let lastGroup = null;
  frNavItems(nav).forEach((it) => {
    const rows = it.subs ? it.subs.map((s) => ({ id: `fr-${it.id}-${s.id}`, label: s.label, tabId: s.tabId })) : [{ id: `fr-${it.id}`, label: it.label, tabId: it.tabId }];
    rows.forEach((row) => {
      out.push({ ...row, sectionLabel: it.group !== lastGroup ? it.group : undefined, frIcon: it.icon });
      lastGroup = it.group;
    });
  });
  return out;
}

/** The phone tab bar (canvas M3-Nav), trimmed to ready routes. */
export const FR_TABBAR = Object.freeze([
  { id: 'today', label: 'Today', frIcon: 'today', tabId: 'dashboard' },
  // FR-4: Pipeline is a ready route now, so it takes its canvas slot (M3-Nav:
  // Today · Pipeline · + · Money · Arena).
  { id: 'pipeline', label: 'Pipeline', frIcon: 'pipeline', tabId: 'pipeline' },
  { id: 'log', label: 'Log', frIcon: 'log', action: 'quick-add', fab: true },
  { id: 'money', label: 'Money', frIcon: 'money', tabId: 'money', matchTabs: ['money', 'goals', 'game-plan', 'money-needs', 'commission', 'persistency', 'financing'] },
  { id: 'arena', label: 'Arena', frIcon: 'arena', tabId: 'production-leaderboard' },
]);
