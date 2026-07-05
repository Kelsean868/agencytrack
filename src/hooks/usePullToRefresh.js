import { useEffect, useRef, useState } from 'react';

// px downward drag from scroll-top to trigger refresh. Raised 72 → 110 (mobile-nav
// PTR over-trigger fix): 72px fired during ordinary top-of-list touch interactions;
// ~110px (≈1.5×) requires a deliberate sustained pull while staying reachable in a
// single thumb stroke on a 380px-wide viewport.
const PULL_THRESHOLD = 110;

/**
 * Attaches touch-based pull-to-refresh to an element ref.
 *
 * Only activates on touch devices and when the element is scrolled to the top.
 * Uses passive:false on touchmove so we can call preventDefault() to block the
 * browser/PWA's native overscroll — this avoids double-refresh on inner
 * overflow-y:auto containers like .shell-content.
 *
 * @param {React.RefObject} scrollRef - ref attached to the scroll container element
 * @param {(() => void | Promise<void>) | null | undefined} onRefresh - called when pull threshold is met; PTR disabled when falsy
 * @returns {'idle' | 'pulling' | 'refreshing'} current PTR phase
 */
export function usePullToRefresh(scrollRef, onRefresh) {
  const [state, setState] = useState('idle');
  const stateRef = useRef('idle');
  const startY = useRef(null);
  const pullDelta = useRef(0);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || !onRefresh || !('ontouchstart' in window)) return;

    function setPhase(next) {
      stateRef.current = next;
      setState(next);
    }

    function onTouchStart(e) {
      if (el.scrollTop > 0 || stateRef.current === 'refreshing') return;
      startY.current = e.touches[0].clientY;
      pullDelta.current = 0;
    }

    // Disarm mid-gesture: also reset pullDelta + phase so a cancelled pull can
    // never fire on the subsequent touchend (Gemini review, PR #795 — a
    // retained pullDelta >= threshold was itself a spurious-refresh vector).
    function disarm() {
      startY.current = null;
      pullDelta.current = 0;
      if (stateRef.current === 'pulling') setPhase('idle');
    }

    function onTouchMove(e) {
      if (startY.current === null) return;
      if (el.scrollTop > 0) { disarm(); return; }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { disarm(); return; }
      pullDelta.current = delta;
      setPhase(delta >= PULL_THRESHOLD ? 'pulling' : 'idle');
      e.preventDefault();
    }

    function onTouchEnd() {
      if (pullDelta.current >= PULL_THRESHOLD && stateRef.current !== 'refreshing') {
        setPhase('refreshing');
        Promise.resolve(onRefresh()).finally(() => setPhase('idle'));
      } else {
        setPhase('idle');
      }
      startY.current = null;
      pullDelta.current = 0;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [scrollRef, onRefresh]);

  return state;
}
