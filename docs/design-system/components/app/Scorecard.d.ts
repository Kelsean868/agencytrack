import * as React from 'react';

/**
 * Compact KPI scorecard for Nexus dashboards: mono eyebrow, display-font
 * number, optional sub-line and thin teal-gradient progress bar. Place in a
 * flex row of 3–4. Requires a .nexus token scope.
 */
export interface ScorecardProps {
  /** Mono uppercase label, e.g. "YTD · SETTLED API" */
  eyebrow: string;
  /** The figure, e.g. "TTD 487K" or "88%" */
  value: React.ReactNode;
  /** Muted sub-line, e.g. "81% of TTD 600K" */
  sub?: React.ReactNode;
  /** Eyebrow color override (gold for recognition, semantic tones) */
  accent?: string;
  /** 28px number instead of 22px. @default false */
  big?: boolean;
  /** 0–100 shows a progress bar */
  progress?: number;
  style?: React.CSSProperties;
}
export declare function Scorecard(props: ScorecardProps): JSX.Element;
