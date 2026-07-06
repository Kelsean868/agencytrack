import * as React from 'react';

/**
 * Actionable empty state — never a "No data" dead end. Names why the surface is
 * empty and gives the next step as a primary CTA. Icon + title + body + CTA.
 */
export interface EmptyStateProps {
  /** Named DS glyph. @default 'grid' */
  icon?: string;
  /** One-line reason it's empty, e.g. "No activity logged yet". */
  title: string;
  /** ≤2-line supporting copy. */
  body?: string;
  /** Primary CTA label, e.g. "Log your first activity". */
  cta?: string;
  /** CTA handler. */
  onCta?: () => void;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
