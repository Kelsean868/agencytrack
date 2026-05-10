import { useEffect, useRef, useState } from 'react';

/**
 * useCountUp(target, options?)
 *
 * Animates from 0 (or the previous value) to `target` over `duration` ms.
 * Returns the current animated display value as a number.
 *
 * Options:
 *   duration  — animation length in ms (default 1000)
 *   decimals  — decimal places to preserve (default 0)
 */
export function useCountUp(target, { duration = 1000, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      return;
    }

    const from = fromRef.current;
    startRef.current = null;

    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      const factor = Math.pow(10, decimals);
      setDisplay(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration, decimals]);

  return display;
}
