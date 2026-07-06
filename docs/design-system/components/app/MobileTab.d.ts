import * as React from 'react';

/**
 * Mobile bottom tab bar — a fixed 5-slot bar whose slot 5 is ALWAYS "More"
 * (position never moves for muscle memory; keeps a ⋮ affordance even when it
 * adaptively shows the current deep screen). Optional center create FAB.
 * Renders under `.nexus[data-view="mobile"]` (device-frame demo) or your mobile
 * breakpoint in production.
 */
export interface MobileTabPrimary {
  /** Create-action label (FAB aria-label + caption). */
  label: string;
}
export interface MobileTabProps {
  /** Up to 4 primary tabs as [iconName, label, screenId]. Slot 5 is auto More. */
  tabs: [string, string, string][];
  /** Current screen id. */
  screen: string;
  /** Navigate to a screen id. */
  go: (id: string) => void;
  /** Open the More sheet. */
  onMore: () => void;
  /** When set, renders the center create FAB. */
  primary?: MobileTabPrimary;
  /** Create-FAB handler. */
  onCreate?: () => void;
  /** Current deep screen {ic,label} — shown on the More slot when off-tab. */
  current?: { ic: string; label: string };
  /** Reorder handler (fromId, toId); when omitted tabs aren't draggable. */
  onReorder?: (from: string, to: string) => void;
}
export declare function MobileTab(props: MobileTabProps): JSX.Element;
