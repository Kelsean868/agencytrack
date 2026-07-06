// ============================================================
// theme.jsx — Nexus warm design system primitives
// Shared tokens live in the HTML <style>. This file exports
// reusable components + helpers to window for the screen files.
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;

// ---- Date: ONE formatter, DD-MM-YYYY everywhere (fix: format chaos) ----
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function ddmmyyyy(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function ttd(n) {
  return 'TTD ' + Number(n).toLocaleString('en-US');
}

// ---- Icons: minimal Lucide-style single-stroke set (UI chrome only) ----
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  calendar: 'M7 3v4M17 3v4M3 9h18M4 5h16v16H4z',
  doc: 'M6 2h8l4 4v16H6zM14 2v4h4',
  target: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10.5 20a1.5 1.5 0 0 0 3 0',
  sun: 'M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5 19 5M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z',
  flame: 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 4-6 5-11z',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 15h6M8 21h8M12 15v6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  book: 'M4 4h9a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z',
  users: 'M8 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6M2 20c0-3 2.5-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6M22 20c0-2.5-1.5-4-4-4.5',
  refresh: 'M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5',
  present: 'M3 4h18v12H3zM8 20h8M12 16v4',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
  wallet: 'M2 7h18v12H2zM2 7l3-4h11l3 4M16 13h.01',
  coins: 'M9 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M21 12a6 6 0 0 1-6 6M15 6a6 6 0 0 1 0 12',
  calculator: 'M6 2h12v20H6zM9 6h6M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h4',
  medal: 'M7 3l3 6M17 3l-3 6M12 21a6 6 0 1 0 0-12a6 6 0 0 0 0 12M10 14l2 1.5 2-1.5',
  ladder: 'M7 2v20M17 2v20M7 7h10M7 12h10M7 17h10',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  clipboard: 'M9 3h6v3H9zM7 4.5H5v16.5h14V4.5h-2M9 12h6M9 16h6',
  bank: 'M3 10h18M4 10 12 4l8 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18',
  scale: 'M12 3v18M8 21h8M6 6h12M6 6 3 12h6zM3 12a3 3 0 0 0 6 0M18 6l-3 6h6zM15 12a3 3 0 0 0 6 0',
  tv: 'M2 7h20v13H2zM8 3l4 4 4-4',
  gauge: 'M12 13l4-3M12 13a1.6 1.6 0 1 0 0 .01M4 19a9 9 0 1 1 16 0',
  flag: 'M4 21V3M4 4h13l-3 4 3 4H4',
  sliders: 'M4 21v-7M4 10V3M12 21v-11M12 6V3M20 21v-5M20 12V3M2 14h4M10 6h4M18 16h4',
};
function Icon({ name, size = 18, className = '', style }) {
  const d = PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

// ---- Eyebrow: the mono-uppercase signature ----
function Eyebrow({ children, tone = 'faint', style }) {
  return <div className={`eyebrow eyebrow--${tone}`} style={style}>{children}</div>;
}

// ---- Ring: the ONE KPI viz language (fix: mixed mini-vizzes) ----
function Ring({ value, size = 52, stroke = 5, color, track, label, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const off = c * (1 - v / 100);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track || 'var(--line)'} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color || 'var(--primary)'} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} className="ring-fill" />
      </svg>
      {label != null && (
        <div className="ring-center">
          <div className="ring-val">{label}</div>
          {sub && <div className="ring-sub">{sub}</div>}
        </div>
      )}
    </div>
  );
}

// ---- Delta pill: consistent trend indicator ----
function Delta({ dir = 'up', children }) {
  const glyph = dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→';
  return <span className={`delta delta--${dir}`}>{glyph} {children}</span>;
}

// ---- Sparkline: reserved for time-trends only ----
function Sparkline({ points = [], w = 120, h = 34, color }) {
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const rng = max - min || 1;
  const step = w / (points.length - 1 || 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((p - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color || 'var(--primary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Button ----
function Btn({ children, kind = 'primary', size = 'md', icon, iconAfter, onClick, style, type }) {
  return (
    <button type={type || 'button'} className={`btn btn--${kind} btn--${size}`} onClick={onClick} style={style}>
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={size === 'lg' ? 18 : 16} />}
    </button>
  );
}

// ---- Skeleton: the ONE loading language (fix: mixed loading states) ----
function Skeleton({ w = '100%', h = 14, r = 7, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ---- EmptyState: ONE considered component w/ optional ghost preview ----
function EmptyState({ icon = 'doc', title, body, cta, onCta, ghost }) {
  return (
    <div className="empty">
      {ghost && <div className="empty-ghost">{ghost}</div>}
      <div className="empty-core">
        <div className="empty-icon"><Icon name={icon} size={22} /></div>
        <div className="empty-title">{title}</div>
        {body && <div className="empty-body">{body}</div>}
        {cta && <Btn kind="primary" size="sm" onClick={onCta} iconAfter="arrow">{cta}</Btn>}
      </div>
    </div>
  );
}

// ---- useTouchReorder: long-press pointer-drag fallback for touch devices ----
// HTML5 drag-and-drop covers mouse; this adds touch. Returns an onPointerDown factory.
function useTouchReorder() {
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

// ---- SideNavSections: draggable, reorderable desktop nav ----
function SideNavSections({ sections, active, onNav, onReorder }) {
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = useTouchReorder();
  const guardClick = (el, fn) => { if (el && el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return; fn(); };
  return sections.map(sec => (
    <div key={sec.g} className="side-sec">
      <Eyebrow tone="faint">{sec.g}</Eyebrow>
      {sec.items.map(([ic, label]) => (
        <button key={label}
          data-rid={label} data-rgroup={'nav-' + sec.g}
          className={'nav-item' + (active === label ? ' is-active' : '') + (over === sec.g + '|' + label ? ' is-drop' : '')}
          aria-current={active === label ? 'page' : undefined}
          draggable={!!onReorder}
          onPointerDown={onReorder ? onTouch(label, 'nav-' + sec.g, (from, to) => onReorder(sec.g, sec.items.map(i => i[1]), from, to)) : undefined}
          onDragStart={e => { drag.current = { g: sec.g, label, labels: sec.items.map(i => i[1]) }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', label); } catch (x) {} }}
          onDragOver={e => { const d = drag.current; if (d && d.g === sec.g) { e.preventDefault(); if (d.label !== label) setOver(sec.g + '|' + label); } }}
          onDragLeave={() => setOver(o => o === sec.g + '|' + label ? null : o)}
          onDrop={e => { e.preventDefault(); const d = drag.current; if (d && d.g === sec.g && d.label !== label && onReorder) onReorder(sec.g, d.labels, d.label, label); drag.current = null; setOver(null); }}
          onDragEnd={() => { drag.current = null; setOver(null); }}
          onClick={e => guardClick(e.currentTarget, () => onNav && onNav(label))} title={label}>
          {onReorder && <span className="nav-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>}
          <Icon name={ic} size={17} /><span>{label}</span>
        </button>
      ))}
    </div>
  ));
}

// ============================================================
// ErrorState — shared inline error (persistent, not a toast)
// ============================================================
function ErrorState({ title = 'Couldn\u2019t load this view', body = 'Something went wrong fetching this data \u2014 your work is safe. Try again.', onRetry, retryLabel = 'Retry' }) {
  return (
    <div className="errstate" role="alert">
      <div className="errstate-icon"><Icon name="bell" size={22} /></div>
      <div className="errstate-title">{title}</div>
      <div className="errstate-body">{body}</div>
      {onRetry && <div style={{ marginTop: 4 }}><Btn kind="ghost" size="sm" icon="refresh" onClick={onRetry}>{retryLabel}</Btn></div>}
    </div>
  );
}

// ============================================================
// Motion + data helpers
// ============================================================
// useStress — read the dev-rail data-density stress flag, reactively
function useStress() {
  const [s, setS] = useState(() => !!window.__atStress);
  useEffect(() => {
    const h = () => setS(!!window.__atStress);
    window.addEventListener('at-stress', h);
    return () => window.removeEventListener('at-stress', h);
  }, []);
  return s;
}
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
// Animate a number 0→target on mount / when key changes. Returns formatted string.
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

// ============================================================
// useFocusTrap — trap Tab within an open overlay, restore focus on close
// ============================================================
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

// ============================================================
// SkeletonScreen — one loading template per layout archetype
// ============================================================
function SkeletonScreen({ kind = 'cards' }) {
  const R = (n, fn) => Array.from({ length: n }).map((_, i) => fn(i));
  if (kind === 'table') {
    return (
      <div className="skel-screen" aria-busy="true" aria-label="Loading">
        <div className="skel-toolbar"><Skeleton w={190} h={30} r={9} /><div style={{ flex: 1 }} /><Skeleton w={104} h={30} r={9} /><Skeleton w={84} h={30} r={9} /></div>
        <div className="skel-table">
          <div className="skel-tr skel-th">{R(6, i => <Skeleton key={i} w={i === 0 ? '24%' : '13%'} h={11} r={5} />)}</div>
          {R(9, r => <div className="skel-tr" key={r}>{R(6, i => <Skeleton key={i} w={i === 0 ? '24%' : '13%'} h={12} r={5} />)}</div>)}
        </div>
      </div>
    );
  }
  if (kind === 'timeline') {
    return (
      <div className="skel-screen" aria-busy="true" aria-label="Loading">
        <div className="skel-hero"><Skeleton w={210} h={22} r={7} /><Skeleton w={'58%'} h={12} r={6} style={{ marginTop: 12 }} /></div>
        {R(6, i => <div className="skel-row" key={i}><Skeleton w={52} h={52} r={13} /><div style={{ flex: 1 }}><Skeleton w={`${40 + (i * 7) % 30}%`} h={14} r={6} /><Skeleton w={`${24 + (i * 5) % 20}%`} h={11} r={5} style={{ marginTop: 9 }} /></div><Skeleton w={58} h={26} r={13} /></div>)}
      </div>
    );
  }
  if (kind === 'detail') {
    return (
      <div className="skel-screen" aria-busy="true" aria-label="Loading">
        <div className="skel-hero"><Skeleton w={250} h={24} r={7} /><Skeleton w={'46%'} h={12} r={6} style={{ marginTop: 12 }} /></div>
        <div className="skel-cards">{R(4, i => <div className="skel-card" key={i}><Skeleton w={'55%'} h={11} r={5} /><Skeleton w={'42%'} h={26} r={7} style={{ marginTop: 14 }} /></div>)}</div>
        <Skeleton w={'100%'} h={220} r={14} style={{ marginTop: 4 }} />
      </div>
    );
  }
  // cards — dashboard archetype
  return (
    <div className="skel-screen" aria-busy="true" aria-label="Loading">
      <div className="skel-hero skel-hero--split"><div style={{ flex: 1 }}><Skeleton w={150} h={12} r={6} /><Skeleton w={290} h={30} r={8} style={{ marginTop: 13 }} /><Skeleton w={'66%'} h={12} r={6} style={{ marginTop: 13 }} /></div><Skeleton w={92} h={92} r={46} /></div>
      <div className="skel-cards">{R(4, i => <div className="skel-card" key={i}><Skeleton w={'55%'} h={11} r={5} /><Skeleton w={'42%'} h={28} r={7} style={{ marginTop: 14 }} /><Skeleton w={'100%'} h={32} r={6} style={{ marginTop: 16 }} /></div>)}</div>
      <div className="skel-cards skel-cards--2">{R(2, i => <div className="skel-card" key={i} style={{ minHeight: 176 }}><Skeleton w={'38%'} h={12} r={6} /><Skeleton w={'100%'} h={118} r={10} style={{ marginTop: 16 }} /></div>)}</div>
    </div>
  );
}

// ============================================================
// StateLayer — swap content for loading / empty / error
// ============================================================
function StateLayer({ state = 'ready', kind = 'cards', empty, error, onRetry, children }) {
  if (state === 'loading') return <SkeletonScreen kind={kind} />;
  if (state === 'empty') return empty || <EmptyState title="Nothing here yet" body={"Once data comes in, it\u2019ll appear here."} />;
  if (state === 'error') return error || <ErrorState onRetry={onRetry || (() => {})} />;
  return children;
}

Object.assign(window, {
  useState, useEffect, useRef, useMemo,
  WEEKDAYS, ddmmyyyy, ttd,
  Icon, Eyebrow, Ring, Delta, Sparkline, Btn, Skeleton, EmptyState, SideNavSections, useTouchReorder,
  ErrorState, SkeletonScreen, StateLayer, useFocusTrap, useCountUp, CountUp, usePrefersReducedMotion, useStress,
});
