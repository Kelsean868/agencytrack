import * as React from 'react';

/**
 * The mobile "More" sheet — every screen for the role, grouped into labelled
 * sections (mirror the sidebar; ≤4–5 items each, never one blob) plus a Pinned
 * row (user pins, persisted) and an auto Frequent row (most-visited).
 * Focus-trapped dialog with a filled Done at thumb reach; closed → out of tab
 * order. Optional lens switch for dual (selling-manager) roles.
 */
export interface MobileMoreSection {
  g: string;
  items: [string, string][];
}
export interface MobileMoreProps {
  open: boolean;
  /** Sheet title. @default 'All screens' */
  title?: string;
  sections: MobileMoreSection[];
  /** Active item label. */
  active?: string;
  onNav: (label: string) => void;
  onClose: () => void;
  /** Current lens; renders the My Book / My Team switch when onLens is set. */
  lens?: 'book' | 'team';
  onLens?: (lens: 'book' | 'team') => void;
  /** Pinned item tuples [icon,label] (host-persisted). */
  pinnedItems?: [string, string][];
  /** Auto most-visited item tuples. */
  frequentItems?: [string, string][];
  /** Set of pinned labels for the pin toggle state. */
  pinnedSet?: Set<string>;
  onTogglePin?: (label: string) => void;
}
export declare function MobileMore(props: MobileMoreProps): JSX.Element;
