import * as React from 'react';

/**
 * Role-scoped quick-create sheet raised from the bottom-bar "+" FAB. Show only
 * actions the current role can perform (a selling manager sees both sets).
 * Focus-trapped dialog with a filled Done at thumb reach.
 */
export interface MobileCreateSheetProps {
  open: boolean;
  /** Create rows as [iconName, label, screenId], pre-filtered to the role. */
  actions: [string, string, string][];
  /** Navigate to a create screen id. */
  onGo: (id: string) => void;
  onClose: () => void;
}
export declare function MobileCreateSheet(props: MobileCreateSheetProps): JSX.Element;
