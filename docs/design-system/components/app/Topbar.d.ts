import * as React from 'react';

/**
 * Nexus app topbar — 60px: display-font page title + subtitle, ⌘K search
 * field, sun/moon mode toggle, bell with danger dot. Requires a .nexus scope.
 */
export interface TopbarProps {
  title: string;
  subtitle?: string;
  /** Shows sun icon when true. @default false */
  dark?: boolean;
  onToggleMode?: () => void;
}
export declare function Topbar(props: TopbarProps): JSX.Element;
