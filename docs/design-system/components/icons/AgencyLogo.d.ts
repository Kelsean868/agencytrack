import * as React from 'react';

/**
 * The AgencyTrack logo mark — deep-teal #014E52 rounded tile, shield outline,
 * rising white activity bars, #4ECDC4 accent dot. Inline SVG (asset version:
 * assets/logo-shield.svg). Pair with "AgencyTrack" in Cabinet Grotesk 700.
 */
export interface AgencyLogoProps {
  /** px. @default 32 */
  size?: number;
  /** Corner radius px; defaults to 22% of size */
  radius?: number;
}
export declare function AgencyLogo(props: AgencyLogoProps): JSX.Element;
