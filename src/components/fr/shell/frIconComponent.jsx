import React from 'react';
import FrIcon from './FrIcon';

/**
 * frIconComponent(name) — an Icon component for the existing shell pieces that
 * expect `item.Icon` (MobileBottomNav, MobileNavDrawer, CommandPalette).
 * Cached so every render hands them the same component identity.
 */
const cache = new Map();
export function frIconComponent(name) {
  if (!cache.has(name)) {
    const C = ({ size = 22 }) => <FrIcon name={name} size={size} />;
    C.displayName = `FrIcon(${name})`;
    cache.set(name, C);
  }
  return cache.get(name);
}
