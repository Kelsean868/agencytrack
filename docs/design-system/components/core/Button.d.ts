import * as React from 'react';

/**
 * Brand button. Solid teal primary or 1.5px-rule ghost. Hover lifts −1px with a
 * teal-tinted shadow (primary) or darkens the border (ghost). Never gradients.
 */
export interface ButtonProps {
  /** Visual style. @default 'primary' */
  variant?: 'primary' | 'ghost';
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Optional trailing glyph, e.g. "→" or an icon element */
  icon?: React.ReactNode;
  /** Renders an <a> instead of <button> */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
