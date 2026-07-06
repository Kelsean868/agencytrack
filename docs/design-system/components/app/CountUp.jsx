// CountUp — KPI / hero numerals animate 0→target with a cubic ease-out on load.
// Falls back to the final value instantly under prefers-reduced-motion.
import * as React from 'react';
import { useCountUp } from './nexus-hooks.jsx';

export function CountUp({ value, decimals = 0, prefix = '', suffix = '', active = true }) {
  const v = useCountUp(value, { active, decimals });
  return <span>{prefix}{v}{suffix}</span>;
}
