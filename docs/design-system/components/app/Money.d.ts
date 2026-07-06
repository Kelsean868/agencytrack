import * as React from 'react';

/**
 * TTD currency figure, formatted by the brand rule: ≥1M → "TTD 2.40M",
 * ≥1K → "TTD 24.5K", else "TTD 950". Mono (tables/rows) or display font
 * (KPI numbers). Intentional addition wrapping the codebase's ttd() helper.
 */
export interface MoneyProps {
  /** Raw TTD amount, e.g. 24500 */
  value: number;
  /** Mono (tables) vs display 800 (KPIs). @default true */
  mono?: boolean;
  color?: string;
  /** Font size px */
  size?: number;
  style?: React.CSSProperties;
}
export declare function Money(props: MoneyProps): JSX.Element;
