import React from 'react';
import { FR_ICON_PATHS } from './frNav';

/**
 * FrIcon — the canvas stroke icons (D3-Sidebar / M3-Nav) as one component.
 * Unknown names throw in development (CLAUDE.md v3 rule 11).
 */
export default function FrIcon({ name, size = 18, strokeWidth = 1.9, className = '' }) {
  const d = FR_ICON_PATHS[name];
  if (!d) {
    if (import.meta.env.DEV) throw new Error(`FrIcon: unknown icon "${name}"`);
    return null;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
