import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 72; // px downward drag from scroll-top to trigger refresh

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

    function onTouchMove(e) {
      if (startY.current === null) return;
      if (el.scrollTop > 0) { startY.current = null; return; }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { startY.current = null; return; }
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
