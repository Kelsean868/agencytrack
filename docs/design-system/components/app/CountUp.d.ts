import * as React from 'react';

/**
 * KPI / hero numeral that counts 0→value with a cubic ease-out on mount.
 * Locale-formats with thousands separators; degrades to the final value
 * instantly under prefers-reduced-motion. Wrap with your own "TTD" / "%".
 */
export interface CountUpProps {
  /** Target number. */
  value: number;
  /** Decimal places (fixed). @default 0 */
  decimals?: number;
  /** Text before the number, e.g. 'TTD '. */
  prefix?: string;
  /** Text after the number, e.g. '%'. */
  suffix?: string;
  /** Run the animation. Set false to render the final value statically. @default true */
  active?: boolean;
}
export declare function CountUp(props: CountUpProps): JSX.Element;
