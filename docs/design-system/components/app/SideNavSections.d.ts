import * as React from 'react';

/**
 * Desktop sidebar body — sectioned nav items with mono eyebrow headers, teal
 * active state, aria-current, and optional drag-reorder (mouse + long-press
 * touch). Emits reorder intents; the host owns & persists the order per role.
 * Place inside your `.side` container (brand block + collapse live there).
 */
export interface SideNavSection {
  /** Section label (mono uppercase eyebrow). */
  g: string;
  /** Items as [iconName, label] tuples. */
  items: [string, string][];
}
export interface SideNavSectionsProps {
  sections: SideNavSection[];
  /** Active item label. */
  active?: string;
  /** Navigate handler, called with the item label. */
  onNav?: (label: string) => void;
  /** Reorder handler; when omitted, items are not draggable.
   *  Called (sectionLabel, currentOrder, fromLabel, toLabel). */
  onReorder?: (g: string, order: string[], from: string, to: string) => void;
}
export declare function SideNavSections(props: SideNavSectionsProps): JSX.Element;
