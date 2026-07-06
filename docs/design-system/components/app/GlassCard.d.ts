import * as React from 'react';

/**
 * Nexus Glass hero card — the ONE glass surface allowed per app screen (the
 * top-of-screen summary). Teal tint default; gold tint for recognition heroes.
 * Light/dark physics + reduced-transparency opaque fallbacks come from
 * tokens/glass.css. Never use for regular cards, tables, lists or nav.
 */
export interface GlassCardProps {
  /** @default 'teal' */
  tint?: 'teal' | 'gold';
  /** @default '20px 24px' */
  padding?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function GlassCard(props: GlassCardProps): JSX.Element;
