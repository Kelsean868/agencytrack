import * as React from 'react';

interface SidebarItem {
  key: string;
  Icon: (p: { size?: number; color?: string; stroke?: number }) => JSX.Element;
  label: string;
  /** Gold badge text, e.g. "NEW" */
  badge?: string;
  /** Indented child row with connector elbow */
  child?: boolean;
}
interface SidebarSection { title: string | null; items: SidebarItem[] }

/**
 * Nexus app sidebar — 232px, surface bg, brand block on top, mono uppercase
 * section titles, teal-tint active row with 3px left rail, initials-tile user
 * footer. Defaults to the agent nav (Dashboard/Weekly Report/History,
 * Planning, Tools, Recognition). Requires a .nexus token scope.
 */
export interface SidebarProps {
  /** Active item key. @default 'home' */
  active?: string;
  /** Override the nav structure */
  sections?: SidebarSection[];
  /** Org line under the wordmark. @default 'Tatil Life · South' */
  org?: string;
  user?: { initials: string; name: string; role: string };
  onNavigate?: (key: string) => void;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
