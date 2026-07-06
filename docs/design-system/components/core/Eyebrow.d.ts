import * as React from 'react';

/**
 * Mono uppercase eyebrow microlabel — the brand signature. Teal by default;
 * gold for recognition content; often numbered ("01 · PLAN").
 */
export interface EyebrowProps {
  /** Override color, e.g. 'var(--gold)' for recognition. Wins over `tone`. @default 'var(--teal)' */
  color?: string;
  /** Semantic tone. 'faint' → --inkFaint (app nav / section headers). */
  tone?: 'faint';
  /** 'md' = marketing 12px/.22em, 'sm' = app 10.5px/.14em. @default 'md' */
  size?: 'md' | 'sm';
  /** Prefix with the ★ live/recognition glyph. @default false */
  star?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}
export declare function Eyebrow(props: EyebrowProps): JSX.Element;
