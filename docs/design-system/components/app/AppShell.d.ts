import * as React from 'react';

/**
 * Nexus page shell: sidebar + topbar + scrollable content in the standard
 * 1280×800 desktop frame. Sets the .nexus / .nexus.dark token scope itself
 * via the dark prop.
 */
export interface AppShellProps {
  /** Active sidebar key. @default 'home' */
  active?: string;
  title: string;
  subtitle?: string;
  /** Dark mode (warm dark palette). @default false */
  dark?: boolean;
  onToggleMode?: () => void;
  /** Sidebar item click handler */
  onNavigate?: (key: string) => void;
  /** Sidebar nav override (see SidebarProps) */
  sections?: unknown[];
  org?: string;
  user?: { initials: string; name: string; role: string };
  /** @default 1280 */
  width?: number;
  /** @default 800 */
  height?: number;
  children?: React.ReactNode;
}
export declare function AppShell(props: AppShellProps): JSX.Element;
