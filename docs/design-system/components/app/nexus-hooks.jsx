// nexus-hooks.jsx — shared behaviour hooks for the 2026 app patterns + nav.
// Not a component (lowercase exports): bundled and imported by sibling
// components via relative path. Source: nexus-patterns.jsx / nexus-nav.jsx.
import * as React from 'react';
const { useState, useEffect, useRef } = React;

/* motion: respect the OS reduced-motion setting */
export function usePrefersReducedMotion() {
  const [r, setR] = useState(() => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener ? m.addEventListener('change', h) : m.addListener(h);
    return () => { m.removeEventListener ? m.removeEventListener('change', h) : m.removeListener(h); };
  }, []);
  return r;
}

/* count-up: KPI / hero numerals animate 0→target (cubic ease-out).
   Falls back to the final value instantly under reduced-motion. */
export function useCountUp(target, { active = true, dur = 850, decimals = 0 } = {}) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(active && !reduced ? 0 : target);
  useEffect(() => {
    if (!active || reduced) { setVal(target); return; }
    let raf, start = null;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const tick = ts => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setVal(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduced, dur]);
  return decimals > 0 ? Number(val).toFixed(decimals) : Math.round(val).toLocaleString('en-US');
}

/* focus trap: keep Tab inside an open dialog, restore focus on close.
   Use on every sheet / palette / modal. `active` = is-open. */
export function useFocusTrap(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const prev = document.activeElement;
    const SEL = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const list = () => [...node.querySelectorAll(SEL)].filter(el => el.offsetParent !== null);
    const t = setTimeout(() => { const f = list(); f[0] && f[0].focus(); }, 40);
    const onKey = e => {
      if (e.key !== 'Tab') return;
      const f = list(); if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); node.removeEventListener('keydown', onKey); if (prev && prev.focus) try { prev.focus(); } catch (x) {} };
  }, [active]);
  return ref;
}

/* stress flag: drives density stress-testing (dev tool) */
export function useStress() {
  const [s, setS] = useState(() => !!window.__nxStress);
  useEffect(() => {
    const h = () => setS(!!window.__nxStress);
    window.addEventListener('nx-stress', h);
    return () => window.removeEventListener('nx-stress', h);
  }, []);
  return s;
}

/* useTouchReorder: long-press pointer-drag fallback for touch reorder.
   Returns a factory: onPointerDown={reorder(id, group, onReorder)}.
   Stamps [data-rdrag] on the dragged node + [data-rover] on the hover target
   (styled in nexus-nav.css) and sets el.__reorderJustDragged to swallow the
   trailing click. onReorder(fromId, toId) is called on drop. */
export function useTouchReorder() {
  const ref = useRef(null);
  useEffect(() => {
    const clearOver = () => document.querySelectorAll('[data-rover]').forEach(el => el.removeAttribute('data-rover'));
    const move = e => {
      const s = ref.current; if (!s || !s.dragging) return;
      e.preventDefault();
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = t && t.closest('[data-rid]');
      clearOver();
      if (tgt && tgt.getAttribute('data-rgroup') === s.group && tgt.getAttribute('data-rid') !== s.id) {
        tgt.setAttribute('data-rover', '1'); s.overId = tgt.getAttribute('data-rid');
      } else s.overId = null;
    };
    const end = () => {
      const s = ref.current; if (!s) return;
      clearTimeout(s.timer);
      if (s.dragging) {
        clearOver();
        document.body.style.userSelect = '';
        if (s.el) s.el.removeAttribute('data-rdrag');
        if (s.overId && s.onReorder) s.onReorder(s.id, s.overId);
        s.el && (s.el.__reorderJustDragged = Date.now());
      }
      ref.current = null;
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, []);
  return (id, group, onReorder) => e => {
    if (e.pointerType !== 'touch') return;
    const el = e.currentTarget;
    const timer = setTimeout(() => {
      const s = ref.current; if (!s) return;
      s.dragging = true; el.setAttribute('data-rdrag', '1');
      try { navigator.vibrate && navigator.vibrate(8); } catch (x) {}
      document.body.style.userSelect = 'none';
    }, 300);
    ref.current = { id, group, el, timer, dragging: false, onReorder, overId: null };
  };
}
