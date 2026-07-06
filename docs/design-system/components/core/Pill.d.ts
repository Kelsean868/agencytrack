import * as React from 'react';

/**
 * Status/label pill — tiny uppercase 999px-radius chip. Semantic tones map to
 * app statuses: success = ON PACE / MATCH, warning = AT FLOOR / delivery clock,
 * danger = BELOW / CONFLICT / clawback, gold = recognition (NEW badge, awards),
 * violet = list-variety accent only.
 */
export interface PillProps {
  /** @default 'teal' */
  tone?: 'teal' | 'gold' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet';
  /** Solid fill with white text (e.g. gold NEW badge). @default false */
  solid?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Pill(props: PillProps): JSX.Element;
