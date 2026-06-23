// quickAddConfig — role-aware Quick-Add action lists (Nav redesign PR-3).
//
// getQuickAddActions(configKey) → ordered action descriptors for QuickAddMenu.
// Every non-SOON key maps to an existing handler/route in the dashboard
// (confirmed in Phase 0 source audit). No new screens are introduced.
//
// configKey mirrors navConfig.js: 'agent' | 'producingManager' | 'manager'.
// The 'manager' (non-producing: SM/TA/PA) list is assigned here because
// Phase 0 confirmed those roles route through ManagerDashboard.
//
// Action shape: { key, label, Icon, primary?, soon?, group? }
//   • primary  → highlighted top action
//   • soon     → rendered disabled (also checked against COMING_SOON_TABS)
//   • group    → 'team' → rendered under a TEAM divider

import {
  Pencil, FileText, Shield, Target, CalendarCheck,
  UserPlus, Presentation, TrendingUp, CalendarClock, Gift, NotebookPen,
} from 'lucide-react';

const AGENT_ACTIONS = [
  { key: 'log-today',     label: 'Log today',        Icon: Pencil,        primary: true },
  { key: 'submit',        label: 'Weekly report',    Icon: FileText                     },
  { key: 'policy-ledger', label: 'Log a policy',     Icon: Shield                       },
  { key: 'goals',         label: 'New goal',          Icon: Target                       },
  { key: 'planner',       label: 'Book appointment', Icon: CalendarCheck, soon: true    },
];

const PRODUCING_MANAGER_ACTIONS = [
  { key: 'log-today',          label: 'Log today',         Icon: Pencil,        primary: true              },
  { key: 'mp-report',          label: 'Weekly report',     Icon: NotebookPen                               },
  { key: 'mp-policies',        label: 'Log a policy',      Icon: Shield                                    },
  { key: 'monthly-recruiting', label: 'Log recruiting',    Icon: UserPlus,      group: 'team'              },
  { key: 'start-meeting',      label: 'Start a meeting',   Icon: Presentation,  group: 'team'              },
  { key: 'persistency',        label: 'Enter persistency', Icon: TrendingUp,    group: 'team'              },
  { key: 'planner',            label: 'Schedule coaching', Icon: CalendarClock, group: 'team', soon: true  },
];

// Non-producing manager (SM/TA/PA) — TEAM items only.
// Phase 0 confirmed these roles use ManagerDashboard; spec §4 list is in
// dispatcher's hands. This list is inferred from the TEAM section above
// (personal production items excluded — SM/TA/PA have no mp-* screens).
// 'start-meeting' is primary as the most time-sensitive action.
const MANAGER_ACTIONS = [
  { key: 'start-meeting',      label: 'Start a meeting',   Icon: Presentation,  primary: true              },
  { key: 'monthly-recruiting', label: 'Log recruiting',    Icon: UserPlus,      group: 'team'              },
  { key: 'persistency',        label: 'Enter persistency', Icon: TrendingUp,    group: 'team'              },
  { key: 'campaigns',          label: 'View campaigns',    Icon: Gift,          group: 'team'              },
  { key: 'planner',            label: 'Schedule coaching', Icon: CalendarClock, group: 'team', soon: true  },
];

const CONFIGS = {
  agent:            AGENT_ACTIONS,
  producingManager: PRODUCING_MANAGER_ACTIONS,
  manager:          MANAGER_ACTIONS,
};

/**
 * Returns the ordered Quick-Add action list for a config role.
 * @param {'agent'|'producingManager'|'manager'} configKey
 * @returns {Array<{ key, label, Icon, primary?, soon?, group? }>}
 */
export function getQuickAddActions(configKey) {
  return CONFIGS[configKey] ?? [];
}
