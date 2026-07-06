import * as React from 'react';

/**
 * Brand card: paper/surface bg, 1px rule border, 18px radius, 26–28px padding.
 * Optional mono number label ("01 · PLAN") and display-font title. Shadowless
 * at rest; optional hover lift (−4px + soft shadow + teal-ish border).
 */
export interface CardProps {
  /** Mono number/eyebrow label, e.g. "01 · THE OBJECTION" */
  num?: string;
  /** Display-font h3 */
  title?: React.ReactNode;
  /** Lift + shadow on hover (link/feature cards). @default false */
  hoverLift?: boolean;
  /** @default '26px 28px' */
  padding?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
