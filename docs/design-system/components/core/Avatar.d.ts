import * as React from 'react';

/**
 * Initials-tile avatar — the brand's only avatar treatment (no photos, no
 * generated faces). Teal-tint circle for people by default; pass a solid teal
 * bg for dark rows; square shape for role tiles.
 */
export interface AvatarProps {
  /** 1–2 uppercase letters, e.g. "MS" */
  initials: string;
  /** px. @default 34 */
  size?: number;
  /** @default 'circle' */
  shape?: 'circle' | 'square';
  /** Solid bg (e.g. '#01696F'); switches text to white */
  bg?: string;
  color?: string;
  /** Teal focus ring (leader rows). @default false */
  ring?: boolean;
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
