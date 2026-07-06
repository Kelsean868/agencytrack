/* ============================================================================
   nexus-patterns.jsx — reusable app patterns proven in the 2026 redesign
   ----------------------------------------------------------------------------
   Framework: React 18 (hooks). Styling: nexus-patterns.css (load alongside).
   Tokens: canonical `.nexus` set (tokens/app-v2.css). Mount UI inside a
   `.nexus` (light) or `.nexus dark` scope.

   Exports (attach to your module system as needed):
     hooks       usePrefersReducedMotion, useCountUp, useFocusTrap, useStress
     components  CountUp, ErrorState, EmptyState, SkeletonScreen, StateLayer
   These are the source-of-truth implementations behind guidelines/redesign-
   addendum.md §1–§4. Icon(name,size) is your DS <Icon>; swap in the real one.
   ============================================================================ */
const { useState, useEffect, useRef } = React;

/* ---- motion: respect the OS setting ------------------------------------- */
function usePrefersReducedMotion() {
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

/* ---- count-up: KPI / hero numerals animate 0→target (cubic ease-out) ----
   Falls back to the final value instantly under reduced-motion. */
function useCountUp(target, { active = true, dur = 850, decimals = 0 } = {}) {
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
function CountUp({ value, decimals = 0, prefix = '', suffix = '', active = true }) {
  const v = useCountUp(value, { active, decimals });
  return <span>{prefix}{v}{suffix}</span>;
}

/* ---- focus trap: keep Tab inside an open dialog, restore focus on close ---
   Use on every sheet / palette / modal. `active` = is-open. */
function useFocusTrap(active) {
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

/* ---- stress flag: drives density stress-testing (dev tool) --------------- */
function useStress() {
  const [s, setS] = useState(() => !!window.__nxStress);
  useEffect(() => {
    const h = () => setS(!!window.__nxStress);
    window.addEventListener('nx-stress', h);
    return () => window.removeEventListener('nx-stress', h);
  }, []);
  return s;
}

/* ---- ErrorState: persistent inline error with Retry (never a toast) ------ */
function ErrorState({ title = 'Couldn\u2019t load this view', body = 'Something went wrong fetching this data \u2014 your work is safe. Try again.', onRetry, retryLabel = 'Retry' }) {
  return (
    <div className="nx-error" role="alert">
      <div className="nx-error-icon"><Icon name="bell" size={22} /></div>
      <div className="nx-error-title">{title}</div>
      <div className="nx-error-body">{body}</div>
      {onRetry && <button className="nx-btn nx-btn--ghost" onClick={onRetry}><Icon name="repeat" size={15} /> {retryLabel}</button>}
    </div>
  );
}

/* ---- EmptyState: actionable, never "No data" ----------------------------- */
function EmptyState({ icon = 'grid', title, body, cta, onCta }) {
  return (
    <div className="nx-empty">
      <div className="nx-empty-icon"><Icon name={icon} size={22} /></div>
      <div className="nx-empty-title">{title}</div>
      {body && <div className="nx-empty-body">{body}</div>}
      {cta && <button className="nx-btn nx-btn--primary" onClick={onCta}>{cta}</button>}
    </div>
  );
}

/* ---- SkeletonScreen: one template per layout archetype ------------------- */
function Sk({ w = '100%', h = 12, r = 6, style }) {
  return <span className="nx-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}
function SkeletonScreen({ kind = 'cards' }) {
  const R = (n, fn) => Array.from({ length: n }).map((_, i) => fn(i));
  if (kind === 'table') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-toolbar"><Sk w={190} h={30} r={9} /><div style={{ flex: 1 }} /><Sk w={104} h={30} r={9} /></div>
      <div className="nx-skel-table">
        <div className="nx-skel-tr nx-skel-th">{R(6, i => <Sk key={i} w={i === 0 ? '24%' : '13%'} h={11} r={5} />)}</div>
        {R(9, r => <div className="nx-skel-tr" key={r}>{R(6, i => <Sk key={i} w={i === 0 ? '24%' : '13%'} h={12} r={5} />)}</div>)}
      </div>
    </div>
  );
  if (kind === 'timeline') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero"><Sk w={210} h={22} r={7} /><Sk w={'58%'} h={12} style={{ marginTop: 12 }} /></div>
      {R(6, i => <div className="nx-skel-row" key={i}><Sk w={52} h={52} r={13} /><div style={{ flex: 1 }}><Sk w={`${40 + (i * 7) % 30}%`} h={14} /><Sk w={`${24 + (i * 5) % 20}%`} h={11} style={{ marginTop: 9 }} /></div><Sk w={58} h={26} r={13} /></div>)}
    </div>
  );
  if (kind === 'detail') return (
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero"><Sk w={250} h={24} r={7} /><Sk w={'46%'} h={12} style={{ marginTop: 12 }} /></div>
      <div className="nx-skel-cards">{R(4, i => <div className="nx-skel-card" key={i}><Sk w={'55%'} h={11} r={5} /><Sk w={'42%'} h={26} r={7} style={{ marginTop: 14 }} /></div>)}</div>
      <Sk w={'100%'} h={220} r={14} />
    </div>
  );
  return ( /* cards — dashboard */
    <div className="nx-skel-screen" aria-busy="true" aria-label="Loading">
      <div className="nx-skel-hero nx-skel-hero--split"><div style={{ flex: 1 }}><Sk w={150} h={12} /><Sk w={290} h={30} r={8} style={{ marginTop: 13 }} /><Sk w={'66%'} h={12} style={{ marginTop: 13 }} /></div><Sk w={92} h={92} r={46} /></div>
      <div className="nx-skel-cards">{R(4, i => <div className="nx-skel-card" key={i}><Sk w={'55%'} h={11} r={5} /><Sk w={'42%'} h={28} r={7} style={{ marginTop: 14 }} /><Sk w={'100%'} h={32} r={6} style={{ marginTop: 16 }} /></div>)}</div>
    </div>
  );
}

/* ---- StateLayer: swap content for loading / empty / error ---------------- */
function StateLayer({ state = 'ready', kind = 'cards', empty, error, onRetry, children }) {
  if (state === 'loading') return <SkeletonScreen kind={kind} />;
  if (state === 'empty') return empty || <EmptyState title="Nothing here yet" body="Once data comes in, it will appear here." />;
  if (state === 'error') return error || <ErrorState onRetry={onRetry} />;
  return children;
}

/* Consumption hook for non-bundler use (style guide / prototypes). Guarded so a
   real bundler import is unaffected. */
if (typeof window !== 'undefined') {
  Object.assign(window, {
    usePrefersReducedMotion, useCountUp, CountUp, useFocusTrap, useStress,
    ErrorState, EmptyState, SkeletonScreen, StateLayer,
  });
}
