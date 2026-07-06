import * as React from 'react';

/**
 * Global command palette (⌘K / "/") — search-and-jump to any screen plus
 * role-scoped quick create. Search mode lists matching screens; create mode (or
 * any typed query) surfaces creates the role can perform. Focus-trapped,
 * Escape closes. Returns null when closed.
 */
export interface CommandScreen {
  id: string;
  /** Display label. */
  label: string;
  /** Icon name. */
  ic: string;
  /** Group label shown at the row's right. */
  grp?: string;
  /** 'bare' screens (auth, kiosk) are excluded from search. */
  shell?: string;
}
export interface CommandPaletteProps {
  open: boolean;
  /** 'search' (default) or 'create'. */
  mode?: 'search' | 'create';
  /** All navigable screens. */
  screens: CommandScreen[];
  /** Active roles, e.g. ['agent'] or ['agent','manager']. @default ['agent'] */
  roles?: string[];
  /** Navigate / run a create by id. */
  onGo: (id: string) => void;
  onClose: () => void;
  /** Quick-create actions as [icon,label,id,roles[]]; filtered by roles. */
  quickActions?: [string, string, string, string[]][];
}
export declare function CommandPalette(props: CommandPaletteProps): JSX.Element;
