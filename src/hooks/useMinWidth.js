import { useEffect, useState } from 'react';

/**
 * useMinWidth(px) — true while the viewport is at least `px` wide.
 *
 * Unlike useIsDesktop (which starts `false` and corrects after mount), the
 * initial state is read SYNCHRONOUSLY from matchMedia, so a wide screen never
 * renders the narrow layout for a frame first. A `change` listener keeps it
 * current across resizes. Where matchMedia is absent (jsdom, SSR) it is
 * `false` — tests that want the wide layout stub matchMedia or pass the flag.
 *
 * @param {number} px  minimum width in CSS px
 * @returns {boolean}
 */
function query(px) {
  return `(min-width: ${px}px)`;
}

function readNow(px) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query(px)).matches;
}

export default function useMinWidth(px) {
  const [matches, setMatches] = useState(() => readNow(px));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query(px));
    setMatches(mql.matches); // px may have changed since the initial read
    const onChange = (e) => setMatches(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange); // older Safari
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [px]);

  return matches;
}
