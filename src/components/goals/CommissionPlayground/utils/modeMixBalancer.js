const MODES = ['annual', 'semiAnnual', 'quarterly', 'monthly'];

export const DEFAULT_MODE_MIX = {
  annual:     1.0,
  semiAnnual: 0.0,
  quarterly:  0.0,
  monthly:    0.0,
};

// When a user drags one slider to newFraction, redistribute the remaining
// fraction proportionally across the other three modes so the sum stays 1.0.
// newFraction is 0.0–1.0.
export function rebalance(currentMix, changedMode, newFraction) {
  const clamped = Math.min(1, Math.max(0, newFraction));
  const remaining = 1 - clamped;

  const others = MODES.filter((m) => m !== changedMode);
  const othersSum = others.reduce((sum, m) => sum + (currentMix[m] ?? 0), 0);

  const result = { ...currentMix, [changedMode]: clamped };

  if (othersSum < 1e-9) {
    const perMode = remaining / others.length;
    others.forEach((m) => { result[m] = perMode; });
  } else {
    const scale = remaining / othersSum;
    others.forEach((m) => { result[m] = (currentMix[m] ?? 0) * scale; });
  }

  return result;
}
