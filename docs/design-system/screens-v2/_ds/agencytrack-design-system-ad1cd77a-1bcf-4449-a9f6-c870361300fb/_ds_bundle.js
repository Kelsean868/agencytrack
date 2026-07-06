/* @ds-bundle: {"format":4,"namespace":"AgencyTrackDesignSystem_ad1cd7","components":[{"name":"AppShell","sourcePath":"components/app/AppShell.jsx"},{"name":"CommandPalette","sourcePath":"components/app/CommandPalette.jsx"},{"name":"CountUp","sourcePath":"components/app/CountUp.jsx"},{"name":"EmptyState","sourcePath":"components/app/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/app/ErrorState.jsx"},{"name":"GlassCard","sourcePath":"components/app/GlassCard.jsx"},{"name":"MobileCreateSheet","sourcePath":"components/app/MobileCreateSheet.jsx"},{"name":"MobileMore","sourcePath":"components/app/MobileMore.jsx"},{"name":"MobileTab","sourcePath":"components/app/MobileTab.jsx"},{"name":"Money","sourcePath":"components/app/Money.jsx"},{"name":"Scorecard","sourcePath":"components/app/Scorecard.jsx"},{"name":"SideNavSections","sourcePath":"components/app/SideNavSections.jsx"},{"name":"NEXUS_SIDEBAR_W","sourcePath":"components/app/Sidebar.jsx"},{"name":"Sidebar","sourcePath":"components/app/Sidebar.jsx"},{"name":"SkeletonScreen","sourcePath":"components/app/SkeletonScreen.jsx"},{"name":"StateLayer","sourcePath":"components/app/StateLayer.jsx"},{"name":"Topbar","sourcePath":"components/app/Topbar.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Callout","sourcePath":"components/core/Callout.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"AgencyLogo","sourcePath":"components/icons/AgencyLogo.jsx"},{"name":"Icon","sourcePath":"components/icons/Icon.jsx"},{"name":"IconHome","sourcePath":"components/icons/Icon.jsx"},{"name":"IconWizard","sourcePath":"components/icons/Icon.jsx"},{"name":"IconHistory","sourcePath":"components/icons/Icon.jsx"},{"name":"IconChart","sourcePath":"components/icons/Icon.jsx"},{"name":"IconTarget","sourcePath":"components/icons/Icon.jsx"},{"name":"IconWallet","sourcePath":"components/icons/Icon.jsx"},{"name":"IconMedal","sourcePath":"components/icons/Icon.jsx"},{"name":"IconShield","sourcePath":"components/icons/Icon.jsx"},{"name":"IconBolt","sourcePath":"components/icons/Icon.jsx"},{"name":"IconRepeat","sourcePath":"components/icons/Icon.jsx"},{"name":"IconBook","sourcePath":"components/icons/Icon.jsx"},{"name":"IconUsers","sourcePath":"components/icons/Icon.jsx"},{"name":"IconGrid","sourcePath":"components/icons/Icon.jsx"},{"name":"IconSettings","sourcePath":"components/icons/Icon.jsx"},{"name":"IconSearch","sourcePath":"components/icons/Icon.jsx"},{"name":"IconBell","sourcePath":"components/icons/Icon.jsx"},{"name":"IconSun","sourcePath":"components/icons/Icon.jsx"},{"name":"IconMoon","sourcePath":"components/icons/Icon.jsx"},{"name":"IconChevR","sourcePath":"components/icons/Icon.jsx"},{"name":"IconChevD","sourcePath":"components/icons/Icon.jsx"},{"name":"IconArrowR","sourcePath":"components/icons/Icon.jsx"},{"name":"IconCheck","sourcePath":"components/icons/Icon.jsx"},{"name":"IconAlert","sourcePath":"components/icons/Icon.jsx"},{"name":"IconTrophy","sourcePath":"components/icons/Icon.jsx"},{"name":"IconFilter","sourcePath":"components/icons/Icon.jsx"},{"name":"IconDownload","sourcePath":"components/icons/Icon.jsx"},{"name":"IconPlus","sourcePath":"components/icons/Icon.jsx"},{"name":"IconClock","sourcePath":"components/icons/Icon.jsx"}],"sourceHashes":{"components/app/AppShell.jsx":"6f2bbdfadbd4","components/app/CommandPalette.jsx":"a1959595edbe","components/app/CountUp.jsx":"67bd0b0bf2de","components/app/EmptyState.jsx":"1499898a0b65","components/app/ErrorState.jsx":"e17f9505bb1a","components/app/GlassCard.jsx":"494c89515739","components/app/MobileCreateSheet.jsx":"c79736058db8","components/app/MobileMore.jsx":"39e5dc928844","components/app/MobileTab.jsx":"ef0ac8067782","components/app/Money.jsx":"95a4f9e9237d","components/app/Scorecard.jsx":"262a260029dd","components/app/SideNavSections.jsx":"377c6e064081","components/app/Sidebar.jsx":"a4f81abcfaee","components/app/SkeletonScreen.jsx":"475f4087a11c","components/app/StateLayer.jsx":"0769814090ea","components/app/Topbar.jsx":"8b4b35f8d9b6","components/app/nexus-hooks.jsx":"d2f640e440e1","components/core/Avatar.jsx":"e1bb60eaa514","components/core/Button.jsx":"7dfb79dfbfc9","components/core/Callout.jsx":"b12f1664a672","components/core/Card.jsx":"39b9fb4cd3b0","components/core/Eyebrow.jsx":"396a0c846a1c","components/core/Pill.jsx":"3e460bf0932a","components/icons/AgencyLogo.jsx":"aee05bcec6e9","components/icons/Icon.jsx":"47d905cc9491","ui_kits/nexus/screens.jsx":"201cc5ca052a","ui_kits/nexus/shell.jsx":"e609ccc2ca8b"},"inlinedExternals":[],"unexposedExports":[{"name":"useCountUp","sourcePath":"components/app/nexus-hooks.jsx"},{"name":"useFocusTrap","sourcePath":"components/app/nexus-hooks.jsx"},{"name":"usePrefersReducedMotion","sourcePath":"components/app/nexus-hooks.jsx"},{"name":"useStress","sourcePath":"components/app/nexus-hooks.jsx"},{"name":"useTouchReorder","sourcePath":"components/app/nexus-hooks.jsx"}]} */

(() => {

const __ds_ns = (window.AgencyTrackDesignSystem_ad1cd7 = window.AgencyTrackDesignSystem_ad1cd7 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/app/GlassCard.jsx
try { (() => {
// Nexus Glass hero card — the ONE glass card allowed per app screen.
// Physics come from tokens/glass.css (.glass + .teal/.gold, light/dark, AA fallbacks).
function GlassCard({
  tint = 'teal',
  padding = '20px 24px',
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `glass ${tint}`,
    style: {
      padding,
      fontFamily: 'var(--sans)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { GlassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/GlassCard.jsx", error: String((e && e.message) || e) }); }

// components/app/Money.jsx
try { (() => {
// TTD currency — the ttd() rule from reference/app-tokens.jsx as a component.
function Money({
  value,
  mono = true,
  color,
  size,
  style
}) {
  let text;
  if (value >= 1000000) text = `TTD ${(value / 1000000).toFixed(2)}M`;else if (value >= 1000) text = `TTD ${(value / 1000).toFixed(1)}K`;else text = `TTD ${Math.round(value).toLocaleString()}`;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono ? 'var(--mono)' : 'var(--display)',
      fontWeight: mono ? 700 : 800,
      letterSpacing: mono ? 0 : '-.02em',
      color,
      fontSize: size,
      ...style
    }
  }, text);
}
Object.assign(__ds_scope, { Money });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/Money.jsx", error: String((e && e.message) || e) }); }

// components/app/Scorecard.jsx
try { (() => {
// Compact KPI scorecard — app dashboards. Source: reference/app-shell.jsx Scorecard.
// Requires a .nexus (or .nexus.dark) token scope.
function Scorecard({
  eyebrow,
  value,
  sub,
  accent,
  big = false,
  progress,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '14px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: 11,
      fontFamily: 'var(--sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: accent || 'var(--teal)',
      letterSpacing: '0.14em',
      fontFamily: 'var(--mono)',
      textTransform: 'uppercase'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: big ? 28 : 22,
      fontWeight: 700,
      color: 'var(--ink)',
      letterSpacing: '-0.022em',
      fontFamily: 'var(--display)',
      lineHeight: 1,
      marginTop: 8
    }
  }, value), sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--inkMute)',
      marginTop: 5
    }
  }, sub) : null, progress !== undefined ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      height: 4,
      background: 'var(--surfaceMute)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${progress}%`,
      height: 4,
      background: 'linear-gradient(90deg, var(--tealDark), var(--teal))',
      borderRadius: 999
    }
  })) : null);
}
Object.assign(__ds_scope, { Scorecard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/Scorecard.jsx", error: String((e && e.message) || e) }); }

// components/app/SkeletonScreen.jsx
try { (() => {
// SkeletonScreen — loading skeletons that match the final layout so nothing
// shifts when data lands. Four archetypes: cards | table | timeline | detail.
// Fill uses --skeleton; shimmer is reduced-motion gated (nexus-patterns.css).

function Sk({
  w = '100%',
  h = 12,
  r = 6,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "nx-skel",
    style: {
      width: w,
      height: h,
      borderRadius: r,
      ...style
    }
  });
}
function SkeletonScreen({
  kind = 'cards'
}) {
  const R = (n, fn) => Array.from({
    length: n
  }).map((_, i) => fn(i));
  if (kind === 'table') return /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-screen",
    "aria-busy": "true",
    "aria-label": "Loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-toolbar"
  }, /*#__PURE__*/React.createElement(Sk, {
    w: 190,
    h: 30,
    r: 9
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Sk, {
    w: 104,
    h: 30,
    r: 9
  })), /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-table"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-tr nx-skel-th"
  }, R(6, i => /*#__PURE__*/React.createElement(Sk, {
    key: i,
    w: i === 0 ? '24%' : '13%',
    h: 11,
    r: 5
  }))), R(9, r => /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-tr",
    key: r
  }, R(6, i => /*#__PURE__*/React.createElement(Sk, {
    key: i,
    w: i === 0 ? '24%' : '13%',
    h: 12,
    r: 5
  }))))));
  if (kind === 'timeline') return /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-screen",
    "aria-busy": "true",
    "aria-label": "Loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-hero"
  }, /*#__PURE__*/React.createElement(Sk, {
    w: 210,
    h: 22,
    r: 7
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '58%',
    h: 12,
    style: {
      marginTop: 12
    }
  })), R(6, i => /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-row",
    key: i
  }, /*#__PURE__*/React.createElement(Sk, {
    w: 52,
    h: 52,
    r: 13
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Sk, {
    w: `${40 + i * 7 % 30}%`,
    h: 14
  }), /*#__PURE__*/React.createElement(Sk, {
    w: `${24 + i * 5 % 20}%`,
    h: 11,
    style: {
      marginTop: 9
    }
  })), /*#__PURE__*/React.createElement(Sk, {
    w: 58,
    h: 26,
    r: 13
  }))));
  if (kind === 'detail') return /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-screen",
    "aria-busy": "true",
    "aria-label": "Loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-hero"
  }, /*#__PURE__*/React.createElement(Sk, {
    w: 250,
    h: 24,
    r: 7
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '46%',
    h: 12,
    style: {
      marginTop: 12
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-cards"
  }, R(4, i => /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-card",
    key: i
  }, /*#__PURE__*/React.createElement(Sk, {
    w: '55%',
    h: 11,
    r: 5
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '42%',
    h: 26,
    r: 7,
    style: {
      marginTop: 14
    }
  })))), /*#__PURE__*/React.createElement(Sk, {
    w: '100%',
    h: 220,
    r: 14
  }));
  return /*#__PURE__*/ /* cards — dashboard */React.createElement("div", {
    className: "nx-skel-screen",
    "aria-busy": "true",
    "aria-label": "Loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-hero nx-skel-hero--split"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Sk, {
    w: 150,
    h: 12
  }), /*#__PURE__*/React.createElement(Sk, {
    w: 290,
    h: 30,
    r: 8,
    style: {
      marginTop: 13
    }
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '66%',
    h: 12,
    style: {
      marginTop: 13
    }
  })), /*#__PURE__*/React.createElement(Sk, {
    w: 92,
    h: 92,
    r: 46
  })), /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-cards"
  }, R(4, i => /*#__PURE__*/React.createElement("div", {
    className: "nx-skel-card",
    key: i
  }, /*#__PURE__*/React.createElement(Sk, {
    w: '55%',
    h: 11,
    r: 5
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '42%',
    h: 28,
    r: 7,
    style: {
      marginTop: 14
    }
  }), /*#__PURE__*/React.createElement(Sk, {
    w: '100%',
    h: 32,
    r: 6,
    style: {
      marginTop: 16
    }
  })))));
}
Object.assign(__ds_scope, { SkeletonScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/SkeletonScreen.jsx", error: String((e && e.message) || e) }); }

// components/app/nexus-hooks.jsx
try { (() => {
// nexus-hooks.jsx — shared behaviour hooks for the 2026 app patterns + nav.
// Not a component (lowercase exports): bundled and imported by sibling
// components via relative path. Source: nexus-patterns.jsx / nexus-nav.jsx.

const {
  useState,
  useEffect,
  useRef
} = React;

/* motion: respect the OS reduced-motion setting */
function usePrefersReducedMotion() {
  const [r, setR] = useState(() => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener ? m.addEventListener('change', h) : m.addListener(h);
    return () => {
      m.removeEventListener ? m.removeEventListener('change', h) : m.removeListener(h);
    };
  }, []);
  return r;
}

/* count-up: KPI / hero numerals animate 0→target (cubic ease-out).
   Falls back to the final value instantly under reduced-motion. */
function useCountUp(target, {
  active = true,
  dur = 850,
  decimals = 0
} = {}) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(active && !reduced ? 0 : target);
  useEffect(() => {
    if (!active || reduced) {
      setVal(target);
      return;
    }
    let raf,
      start = null;
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
function useFocusTrap(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const prev = document.activeElement;
    const SEL = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const list = () => [...node.querySelectorAll(SEL)].filter(el => el.offsetParent !== null);
    const t = setTimeout(() => {
      const f = list();
      f[0] && f[0].focus();
    }, 40);
    const onKey = e => {
      if (e.key !== 'Tab') return;
      const f = list();
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      node.removeEventListener('keydown', onKey);
      if (prev && prev.focus) try {
        prev.focus();
      } catch (x) {}
    };
  }, [active]);
  return ref;
}

/* stress flag: drives density stress-testing (dev tool) */
function useStress() {
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
function useTouchReorder() {
  const ref = useRef(null);
  useEffect(() => {
    const clearOver = () => document.querySelectorAll('[data-rover]').forEach(el => el.removeAttribute('data-rover'));
    const move = e => {
      const s = ref.current;
      if (!s || !s.dragging) return;
      e.preventDefault();
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = t && t.closest('[data-rid]');
      clearOver();
      if (tgt && tgt.getAttribute('data-rgroup') === s.group && tgt.getAttribute('data-rid') !== s.id) {
        tgt.setAttribute('data-rover', '1');
        s.overId = tgt.getAttribute('data-rid');
      } else s.overId = null;
    };
    const end = () => {
      const s = ref.current;
      if (!s) return;
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
    window.addEventListener('pointermove', move, {
      passive: false
    });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);
  return (id, group, onReorder) => e => {
    if (e.pointerType !== 'touch') return;
    const el = e.currentTarget;
    const timer = setTimeout(() => {
      const s = ref.current;
      if (!s) return;
      s.dragging = true;
      el.setAttribute('data-rdrag', '1');
      try {
        navigator.vibrate && navigator.vibrate(8);
      } catch (x) {}
      document.body.style.userSelect = 'none';
    }, 300);
    ref.current = {
      id,
      group,
      el,
      timer,
      dragging: false,
      onReorder,
      overId: null
    };
  };
}
Object.assign(__ds_scope, { usePrefersReducedMotion, useCountUp, useFocusTrap, useStress, useTouchReorder });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/nexus-hooks.jsx", error: String((e && e.message) || e) }); }

// components/app/CountUp.jsx
try { (() => {
// CountUp — KPI / hero numerals animate 0→target with a cubic ease-out on load.
// Falls back to the final value instantly under prefers-reduced-motion.

function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  active = true
}) {
  const v = __ds_scope.useCountUp(value, {
    active,
    decimals
  });
  return /*#__PURE__*/React.createElement("span", null, prefix, v, suffix);
}
Object.assign(__ds_scope, { CountUp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/CountUp.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
// Initials-tile avatar — the ONLY avatar treatment (never photos/generated faces).
// Circle for people; 12px-radius square tiles for roles. Display font initials.
function Avatar({
  initials,
  size = 34,
  shape = 'circle',
  bg,
  color,
  ring = false,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: shape === 'circle' ? '50%' : Math.round(size * 0.29),
      background: bg || 'var(--tealTint, var(--teal-tint))',
      color: color || (bg ? '#fff' : 'var(--teal)'),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: Math.round(size * 0.38),
      lineHeight: 1,
      letterSpacing: 0,
      boxShadow: ring ? '0 0 0 2px rgba(54,189,185,.5)' : 'none',
      ...style
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
// AgencyTrack Button — solid teal primary or ghost outline. Never gradients.
// Values from marketing/tokens.css .ds-btn / reference index.html .btn.
function Button({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  href,
  onClick,
  disabled,
  style
}) {
  const pad = size === 'sm' ? '10px 14px' : size === 'lg' ? '14px 24px' : '12px 20px';
  const fs = size === 'sm' ? 13 : 14.5;
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--sans)',
    fontWeight: 700,
    fontSize: fs,
    padding: pad,
    borderRadius: 'var(--r-btn, 12px)',
    cursor: disabled ? 'default' : 'pointer',
    border: 0,
    textDecoration: 'none',
    lineHeight: 1.2,
    transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto'
  };
  const variants = {
    primary: {
      background: 'var(--teal)',
      color: '#fff'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink)',
      border: '1.5px solid var(--rule)',
      padding: shrinkPad(pad, 1.5)
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = hover && !disabled ? variant === 'primary' ? {
    transform: 'translateY(-1px)',
    boxShadow: 'var(--sh-cta, 0 8px 20px rgba(1,105,111,.28))'
  } : {
    borderColor: 'var(--ink-faint, var(--inkFaint))'
  } : {};
  const Tag = href ? 'a' : 'button';
  return /*#__PURE__*/React.createElement(Tag, {
    href: href,
    onClick: onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...variants[variant],
      ...hoverStyle,
      ...style
    }
  }, children, icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, icon) : null);
}
function shrinkPad(pad, by) {
  return pad.split(' ').map(p => `${parseFloat(p) - by}px`).join(' ');
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Callout.jsx
try { (() => {
// Gold-tint callout — recognition/attention band. Source: .ds-callout.
function Callout({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-tint, var(--goldTint))',
      border: '1px solid rgba(176,125,26,.25)',
      borderRadius: 14,
      padding: '18px 20px',
      color: '#7A5A16',
      fontFamily: 'var(--sans)',
      fontSize: 14.5,
      lineHeight: 1.55,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Callout.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
// Marketing card — paper surface, 1px rule, 18px radius, optional mono number label.
// Source: .ds-card / .step / .rescard patterns.
function Card({
  num,
  title,
  children,
  hoverLift = false,
  padding = '26px 28px',
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--paper, var(--surface))',
      border: '1px solid var(--rule)',
      borderRadius: 'var(--r-card, 18px)',
      padding,
      transition: 'transform .25s, box-shadow .25s, border-color .25s',
      ...(hoverLift && hover ? {
        transform: 'translateY(-4px)',
        boxShadow: '0 18px 40px rgba(38,35,28,.1)',
        borderColor: 'rgba(1,105,111,.3)'
      } : {}),
      ...style
    }
  }, num ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--teal-bright, var(--tealLight))',
      letterSpacing: '.1em'
    }
  }, num) : null, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      letterSpacing: '-.02em',
      lineHeight: 1.15,
      fontSize: 21,
      margin: num ? '14px 0 10px' : '0 0 10px'
    }
  }, title) : null, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
// Mono uppercase eyebrow — the brand's signature microlabel.
// 12px/700/.22em (marketing) or 10.5-11px/.14-.18em (app density).
// `tone="faint"` renders in --inkFaint (used by app nav/section headers);
// explicit `color` always wins. className="eyebrow" lets nav CSS target it.
function Eyebrow({
  children,
  color,
  tone,
  size = 'md',
  star = false,
  style,
  className
}) {
  const fs = size === 'sm' ? 10.5 : 12;
  const ls = size === 'sm' ? '0.14em' : '0.22em';
  const toneColor = tone === 'faint' ? 'var(--inkFaint)' : undefined;
  return /*#__PURE__*/React.createElement("div", {
    className: ['eyebrow', className].filter(Boolean).join(' '),
    style: {
      fontFamily: 'var(--mono)',
      fontSize: fs,
      fontWeight: 700,
      letterSpacing: ls,
      textTransform: 'uppercase',
      color: color || toneColor || 'var(--teal)',
      ...style
    }
  }, star ? '★ ' : '', children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Pill.jsx
try { (() => {
// Status/label pill — 999px radius, tinted bg + strong ink. Source: app Pill + status bands.
const PILL_TONES = {
  teal: {
    color: 'var(--teal)',
    bg: 'var(--tealTint, var(--teal-tint))'
  },
  gold: {
    color: 'var(--goldInk, var(--gold))',
    bg: 'var(--goldTint, var(--gold-tint))'
  },
  success: {
    color: 'var(--success, #2D7A4F)',
    bg: 'var(--successTint, #E8F5EE)'
  },
  warning: {
    color: 'var(--warning, #B45309)',
    bg: 'var(--warningTint, #FEF3E2)'
  },
  danger: {
    color: 'var(--danger, #C0392B)',
    bg: 'var(--dangerTint, #FDE8E7)'
  },
  neutral: {
    color: 'var(--ink-mute, var(--inkMute))',
    bg: 'var(--rule-soft, var(--surfaceMute))'
  },
  violet: {
    color: 'var(--inkAccent, #5A3FA0)',
    bg: 'var(--inkAccentTint, #F0ECFF)'
  }
};
function Pill({
  tone = 'teal',
  solid = false,
  children,
  style
}) {
  const t = PILL_TONES[tone] || PILL_TONES.teal;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: 'var(--sans)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      color: solid ? '#fff' : t.color,
      background: solid ? t.color : t.bg,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pill.jsx", error: String((e && e.message) || e) }); }

// components/icons/AgencyLogo.jsx
try { (() => {
// AgencyTrack logo mark — teal shield tile + rising activity bars + accent dot.
// Copied verbatim from reference/app-tokens.jsx (source: public/icons.svg in the repo).
function AgencyLogo({
  size = 32,
  radius
}) {
  const rad = radius != null ? radius : Math.round(size * 0.22);
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 200 200",
    "aria-label": "AgencyTrack",
    style: {
      display: 'block',
      borderRadius: rad,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: "200",
    height: "200",
    rx: "44",
    fill: "#014e52"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z",
    fill: "white",
    fillOpacity: "0.12",
    stroke: "white",
    strokeOpacity: "0.55",
    strokeWidth: "2.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "72",
    y: "127",
    width: "11",
    height: "18",
    rx: "2.5",
    fill: "white",
    fillOpacity: "0.30"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "87",
    y: "117",
    width: "11",
    height: "28",
    rx: "2.5",
    fill: "white",
    fillOpacity: "0.50"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "102",
    y: "105",
    width: "11",
    height: "40",
    rx: "2.5",
    fill: "white",
    fillOpacity: "0.75"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "117",
    y: "93",
    width: "11",
    height: "52",
    rx: "2.5",
    fill: "white"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "122.5",
    cy: "86",
    r: "4.5",
    fill: "#4ecdc4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "120,87 122.5,84 125,87",
    fill: "none",
    stroke: "white",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(__ds_scope, { AgencyLogo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/AgencyLogo.jsx", error: String((e && e.message) || e) }); }

// components/icons/Icon.jsx
try { (() => {
// AgencyTrack icon set — inline SVG, 24px viewBox, stroke 1.8, round caps/joins.
// Copied verbatim from reference/app-tokens.jsx (the codebase's own hand-rolled Lucide-style set).
//
// Two APIs:
//   1. children  — <Icon><path d="…"/></Icon> (original)
//   2. name      — <Icon name="bell" /> looks up NAME_PATHS below. Added for the
//                  2026 nav + state patterns (nexus-nav, nexus-patterns) which
//                  address glyphs by name. Names map to the same hand-rolled set.
const NAME_PATHS = {
  home: ['M3 12L12 4l9 8M5 10v10h14V10'],
  wizard: ['M9 21h6M12 17V11M5 8h14M5 8l2-4h10l2 4M5 8v3a7 7 0 0 0 14 0V8'],
  history: ['M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2'],
  chart: ['M3 20h18M5 16V8M11 16V5M17 16v-6'],
  target: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2'],
  wallet: ['M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1 0-4h14V7', 'M17 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2'],
  medal: ['M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12', 'M8 3l2 6M16 3l-2 6'],
  shield: ['M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'],
  repeat: ['M17 2l4 4-4 4M3 12V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 12v4a2 2 0 0 1-2 2H3'],
  book: ['M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z', 'M4 16a4 4 0 0 1 4-4h12'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'M20 20l-4-4'],
  bell: ['M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8', 'M10 21h4'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5'],
  moon: ['M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z'],
  trophy: ['M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z', 'M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4', 'M9 20h6M12 16v4'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v5l4 2'],
  filter: ['M3 4h18l-7 9v7l-4-2v-5z'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
  calendar: ['M7 3v4M17 3v4M3 9h18M4 5h16v16H4z'],
  check: ['M20 6 9 17l-5-5'],
  plus: ['M12 5v14M5 12h14'],
  arrow: ['M5 12h14', 'M12 5l7 7-7 7'],
  pin: ['M9 4h6l-1 6 3 3H7l3-3-1-6z', 'M12 13v7']
};
function Icon({
  children,
  name,
  size = 20,
  color = 'currentColor',
  stroke = 1.8,
  fill = 'none',
  style
}) {
  const paths = name ? NAME_PATHS[name] || NAME_PATHS.grid : null;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    "aria-hidden": name ? 'true' : undefined
  }, paths ? paths.map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: d
  })) : children);
}
const IconHome = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 12L12 4l9 8M5 10v10h14V10"
}));
const IconWizard = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 21h6M12 17V11M5 8h14M5 8l2-4h10l2 4M5 8v3a7 7 0 0 0 14 0V8"
}));
const IconHistory = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"
}));
const IconChart = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 20h18M5 16V8M11 16V5M17 16v-6"
}));
const IconTarget = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "5"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "1.5"
}));
const IconWallet = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1 0-4h14V7"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "17",
  cy: "13",
  r: "1"
}));
const IconMedal = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "15",
  r: "6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 3l2 6M16 3l-2 6"
}));
const IconShield = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"
}));
const IconBolt = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polygon", {
  points: "13 2 4 14 11 14 10 22 19 10 12 10 13 2"
}));
const IconRepeat = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M17 2l4 4-4 4M3 12V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 12v4a2 2 0 0 1-2 2H3"
}));
const IconBook = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M4 16a4 4 0 0 1 4-4h12"
}));
const IconUsers = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "8.5",
  cy: "7",
  r: "4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"
}));
const IconGrid = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
}));
const IconSettings = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"
}));
const IconSearch = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "20",
  y1: "20",
  x2: "16",
  y2: "16"
}));
const IconBell = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10 21h4"
}));
const IconSun = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"
}));
const IconMoon = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10z"
}));
const IconChevR = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "9 6 15 12 9 18"
}));
const IconChevD = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 12 15 18 9"
}));
const IconArrowR = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "12 5 19 12 12 19"
}));
const IconCheck = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polyline", {
  points: "20 6 9 17 4 12"
}));
const IconAlert = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 2l10 18H2L12 2z"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "9",
  x2: "12",
  y2: "14"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "17",
  r: "0.8",
  fill: "currentColor",
  stroke: "none"
}));
const IconTrophy = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9 20h6M12 16v4"
}));
const IconFilter = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("polygon", {
  points: "3 4 21 4 14 13 14 20 10 20 10 13 3 4"
}));
const IconDownload = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("path", {
  d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
}));
const IconPlus = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "5",
  x2: "12",
  y2: "19"
}), /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}));
const IconClock = p => /*#__PURE__*/React.createElement(Icon, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "12 7 12 12 16 14"
}));
Object.assign(__ds_scope, { Icon, IconHome, IconWizard, IconHistory, IconChart, IconTarget, IconWallet, IconMedal, IconShield, IconBolt, IconRepeat, IconBook, IconUsers, IconGrid, IconSettings, IconSearch, IconBell, IconSun, IconMoon, IconChevR, IconChevD, IconArrowR, IconCheck, IconAlert, IconTrophy, IconFilter, IconDownload, IconPlus, IconClock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/Icon.jsx", error: String((e && e.message) || e) }); }

// components/app/CommandPalette.jsx
try { (() => {
// CommandPalette — global search + role-scoped quick create (⌘K / "/"). Search
// jumps to any screen; create mode (or typing) surfaces role-scoped actions.
// Focus-trapped, Escape closes. Pass quickActions as [icon,label,id,roles[]].

const {
  useState,
  useEffect,
  useRef
} = React;
function CommandPalette({
  open,
  mode,
  screens,
  roles,
  onGo,
  onClose,
  quickActions
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const trapRef = __ds_scope.useFocusTrap(open);
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }
  }, [open, mode]);
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const roleSet = roles && roles.length ? roles : ['agent'];
  const quick = (quickActions || []).filter(x => x[3].some(r => roleSet.includes(r)));
  const ql = q.trim().toLowerCase();
  const results = screens.filter(s => s.shell !== 'bare' && s.label.trim().toLowerCase().includes(ql));
  const quickF = quick.filter(x => x[1].toLowerCase().includes(ql));
  const showCreate = mode === 'create' || ql;
  return /*#__PURE__*/React.createElement("div", {
    className: "cmd-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd",
    ref: trapRef,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": mode === 'create' ? 'Quick create' : 'Search and jump to',
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "cmd-input-row"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "target",
    size: 18,
    style: {
      color: 'var(--inkFaint)'
    }
  }), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    className: "cmd-input",
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: mode === 'create' ? 'What do you want to create?' : 'Search screens, agents, policies\u2026'
  }), /*#__PURE__*/React.createElement("kbd", {
    className: "cmd-esc"
  }, "ESC")), /*#__PURE__*/React.createElement("div", {
    className: "cmd-body"
  }, showCreate && quickF.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "cmd-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, "Quick create"), quickF.map(([ic, label, id]) => /*#__PURE__*/React.createElement("button", {
    key: label,
    className: "cmd-item",
    onClick: () => onGo(id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "cmd-ic cmd-ic--create"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 15
  })), /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow",
    size: 14,
    style: {
      marginLeft: 'auto',
      color: 'var(--inkFaint)'
    }
  })))), mode !== 'create' && /*#__PURE__*/React.createElement("div", {
    className: "cmd-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, ql ? 'Screens' : 'Jump to'), results.length ? results.slice(0, 8).map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: "cmd-item",
    onClick: () => onGo(s.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "cmd-ic"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: s.ic,
    size: 15
  })), /*#__PURE__*/React.createElement("span", null, s.label.trim()), /*#__PURE__*/React.createElement("span", {
    className: "cmd-grp"
  }, s.grp))) : /*#__PURE__*/React.createElement("div", {
    className: "cmd-empty"
  }, "No matches for \\u201c", q, "\\u201d"))), /*#__PURE__*/React.createElement("div", {
    className: "cmd-foot"
  }, /*#__PURE__*/React.createElement("span", null, "\\u2191\\u2193 to move"), /*#__PURE__*/React.createElement("span", null, "\\u21b5 to open"), /*#__PURE__*/React.createElement("span", null, "Global search & create \\u2014 from anywhere"))));
}
Object.assign(__ds_scope, { CommandPalette });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/CommandPalette.jsx", error: String((e && e.message) || e) }); }

// components/app/EmptyState.jsx
try { (() => {
// EmptyState — actionable empty state (never "No data"). Names why it's empty
// and gives the next step as a real CTA. Icon + title + optional body + CTA.

function EmptyState({
  icon = 'grid',
  title,
  body,
  cta,
  onCta
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "nx-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-empty-icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "nx-empty-title"
  }, title), body && /*#__PURE__*/React.createElement("div", {
    className: "nx-empty-body"
  }, body), cta && /*#__PURE__*/React.createElement("button", {
    className: "nx-btn nx-btn--primary",
    onClick: onCta
  }, cta));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/app/ErrorState.jsx
try { (() => {
// ErrorState — persistent inline error with Retry (never a toast). A load
// failure stays on screen with a way to recover and reassurance work is safe.

function ErrorState({
  title = 'Couldn\u2019t load this view',
  body = 'Something went wrong fetching this data \u2014 your work is safe. Try again.',
  onRetry,
  retryLabel = 'Retry'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "nx-error",
    role: "alert"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nx-error-icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bell",
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "nx-error-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "nx-error-body"
  }, body), onRetry && /*#__PURE__*/React.createElement("button", {
    className: "nx-btn nx-btn--ghost",
    onClick: onRetry
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "repeat",
    size: 15
  }), " ", retryLabel));
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/app/MobileCreateSheet.jsx
try { (() => {
// MobileCreateSheet — role-scoped quick-create. `actions` are pre-filtered to
// what the current role can create (agent: log activity / new policy / weekly
// report / commission; manager: settlement / meeting; admin: branch / user).
// Focus-trapped dialog; Done is a filled primary at thumb reach.

function MobileCreateSheet({
  open,
  actions,
  onGo,
  onClose
}) {
  const trapRef = __ds_scope.useFocusTrap(open);
  return /*#__PURE__*/React.createElement("div", {
    className: 'm-sheet' + (open ? ' is-open' : ''),
    onClick: onClose,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Create",
    "aria-hidden": !open
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-panel",
    ref: trapRef,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    className: "m-sheet-grip",
    onClick: onClose,
    "aria-label": "Close"
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-head"
  }, /*#__PURE__*/React.createElement("span", null, "Create")), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-create-list"
  }, actions.map(([ic, label, id]) => /*#__PURE__*/React.createElement("button", {
    key: label,
    className: "m-create-item",
    onClick: () => onGo(id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "m-create-ic"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    className: "m-create-lab"
  }, label), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow",
    size: 15,
    style: {
      color: 'var(--inkFaint)'
    }
  }))))), /*#__PURE__*/React.createElement("button", {
    className: "m-sheet-close is-done",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 18
  }), " Done")));
}
Object.assign(__ds_scope, { MobileCreateSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/MobileCreateSheet.jsx", error: String((e && e.message) || e) }); }

// components/app/MobileMore.jsx
try { (() => {
// MobileMore — full navigation sheet: Pinned + Frequent + labelled sections
// (mirror the desktop sidebar grouping, ≤4–5 items each — never one blob).
// Focus-trapped dialog; Done is a filled primary at thumb reach; closed sheets
// leave the tab order. Optional lens switch (My Book / My Team) for dual roles.

function MobileMore({
  open,
  title,
  sections,
  active,
  onNav,
  onClose,
  lens,
  onLens,
  pinnedItems,
  frequentItems,
  pinnedSet,
  onTogglePin
}) {
  const trapRef = __ds_scope.useFocusTrap(open);
  const cell = ([ic, label]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "m-sheet-cell"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'm-sheet-item' + (active === label ? ' is-active' : ''),
    onClick: () => onNav(label),
    "aria-current": active === label ? 'page' : undefined
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 18
  }), /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    className: 'm-sheet-pin' + (pinnedSet && pinnedSet.has(label) ? ' is-pinned' : ''),
    onClick: e => {
      e.stopPropagation();
      onTogglePin && onTogglePin(label);
    },
    "aria-label": pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin',
    title: pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin to top'
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "pin",
    size: 13
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: 'm-sheet' + (open ? ' is-open' : ''),
    onClick: onClose,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title || 'Navigation menu',
    "aria-hidden": !open
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-panel",
    ref: trapRef,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    className: "m-sheet-grip",
    onClick: onClose,
    "aria-label": "Close menu"
  }), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-head"
  }, /*#__PURE__*/React.createElement("span", null, title || 'All screens')), onLens && /*#__PURE__*/React.createElement("div", {
    className: "m-lens m-lens--insheet"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'm-lens-btn' + (lens === 'book' ? ' is-on' : ''),
    onClick: () => onLens('book')
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "home",
    size: 15
  }), " My Book"), /*#__PURE__*/React.createElement("button", {
    className: 'm-lens-btn' + (lens === 'team' ? ' is-on' : ''),
    onClick: () => onLens('team')
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "users",
    size: 15
  }), " My Team")), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-scroll"
  }, pinnedItems && pinnedItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "pin",
    size: 11,
    style: {
      marginRight: 5,
      verticalAlign: '-1px'
    }
  }), "Pinned"), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-grid"
  }, pinnedItems.map(cell))), frequentItems && frequentItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, "Frequent"), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-grid"
  }, frequentItems.map(cell))), sections.map(sec => /*#__PURE__*/React.createElement("div", {
    key: sec.g,
    className: "m-sheet-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, sec.g), /*#__PURE__*/React.createElement("div", {
    className: "m-sheet-grid"
  }, sec.items.map(cell))))), /*#__PURE__*/React.createElement("button", {
    className: "m-sheet-close is-done",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 18
  }), " Done")));
}
Object.assign(__ds_scope, { MobileMore });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/MobileMore.jsx", error: String((e && e.message) || e) }); }

// components/app/MobileTab.jsx
try { (() => {
// MobileTab — fixed 5-slot bottom bar. Slot 5 is ALWAYS More (position never
// moves; carries a ⋮ affordance even when it adaptively shows the current deep
// screen's name). `primary` adds the center raised create FAB. Tabs are
// drag-reorderable when onReorder is supplied. Shows under [data-view="mobile"].

const {
  useState,
  useRef
} = React;
function MobileTab({
  tabs,
  screen,
  go,
  onMore,
  primary,
  onCreate,
  current,
  onReorder
}) {
  const inTabs = tabs.some(t => t[2] === screen);
  const deep = !inTabs;
  const moreItem = {
    more: true,
    on: deep,
    ic: deep && current ? current.ic : 'grid',
    lab: deep && current ? current.label : 'More'
  };
  const items = [...tabs.map(([ic, lab, id]) => ({
    ic,
    lab,
    id,
    on: screen === id
  })), moreItem];
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = __ds_scope.useTouchReorder();
  const btn = it => it.more ? /*#__PURE__*/React.createElement("button", {
    key: "more",
    className: 'mtab mtab-more' + (it.on ? ' is-on' : ''),
    onClick: onMore,
    "aria-current": it.on ? 'page' : undefined,
    "aria-haspopup": "dialog",
    "aria-label": it.on ? it.lab + ' \u2014 open menu' : 'More \u2014 open menu'
  }, /*#__PURE__*/React.createElement("span", {
    className: "mtab-more-ic"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.ic,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    className: "mtab-dots",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null))), /*#__PURE__*/React.createElement("span", null, it.lab)) : /*#__PURE__*/React.createElement("button", {
    key: it.id,
    "data-rid": it.id,
    "data-rgroup": "mtab",
    className: 'mtab' + (it.on ? ' is-on' : '') + (over === it.id ? ' is-drop' : ''),
    "aria-current": it.on ? 'page' : undefined,
    draggable: !!onReorder,
    onPointerDown: onReorder ? onTouch(it.id, 'mtab', (from, to) => onReorder(from, to)) : undefined,
    onDragStart: e => {
      drag.current = it.id;
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', it.id);
      } catch (x) {}
    },
    onDragOver: e => {
      if (drag.current) {
        e.preventDefault();
        if (drag.current !== it.id) setOver(it.id);
      }
    },
    onDragLeave: () => setOver(o => o === it.id ? null : o),
    onDrop: e => {
      e.preventDefault();
      if (drag.current && drag.current !== it.id && onReorder) onReorder(drag.current, it.id);
      drag.current = null;
      setOver(null);
    },
    onDragEnd: () => {
      drag.current = null;
      setOver(null);
    },
    onClick: e => {
      if (drag.current) return;
      const el = e.currentTarget;
      if (el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return;
      go(it.id);
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.ic,
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, it.lab));
  if (!primary) return /*#__PURE__*/React.createElement("nav", {
    className: "mobile-tab",
    "aria-label": "Primary"
  }, items.map(btn));
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid),
    right = items.slice(mid);
  return /*#__PURE__*/React.createElement("nav", {
    className: "mobile-tab has-fab",
    "aria-label": "Primary"
  }, left.map(btn), /*#__PURE__*/React.createElement("button", {
    className: "mtab-fab",
    onClick: onCreate,
    "aria-label": primary.label
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "plus",
    size: 26
  })), right.map(btn), /*#__PURE__*/React.createElement("span", {
    className: "mtab-fab-label"
  }, primary.label));
}
Object.assign(__ds_scope, { MobileTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/MobileTab.jsx", error: String((e && e.message) || e) }); }

// components/app/SideNavSections.jsx
try { (() => {
// SideNavSections — desktop sidebar body: sectioned nav with mono eyebrow
// headers, teal active state, aria-current, and drag-reorder (mouse + long-
// press touch, persisted by the host). Render inside your .side container.

const {
  useState,
  useRef
} = React;
function SideNavSections({
  sections,
  active,
  onNav,
  onReorder
}) {
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = __ds_scope.useTouchReorder();
  const guardClick = (el, fn) => {
    if (el && el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return;
    fn();
  };
  return sections.map(sec => /*#__PURE__*/React.createElement("div", {
    key: sec.g,
    className: "side-sec"
  }, /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: "faint"
  }, sec.g), sec.items.map(([ic, label]) => /*#__PURE__*/React.createElement("button", {
    key: label,
    "data-rid": label,
    "data-rgroup": 'nav-' + sec.g,
    className: 'nav-item' + (active === label ? ' is-active' : '') + (over === sec.g + '|' + label ? ' is-drop' : ''),
    "aria-current": active === label ? 'page' : undefined,
    draggable: !!onReorder,
    onPointerDown: onReorder ? onTouch(label, 'nav-' + sec.g, (from, to) => onReorder(sec.g, sec.items.map(i => i[1]), from, to)) : undefined,
    onDragStart: e => {
      drag.current = {
        g: sec.g,
        label,
        labels: sec.items.map(i => i[1])
      };
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', label);
      } catch (x) {}
    },
    onDragOver: e => {
      const d = drag.current;
      if (d && d.g === sec.g) {
        e.preventDefault();
        if (d.label !== label) setOver(sec.g + '|' + label);
      }
    },
    onDragLeave: () => setOver(o => o === sec.g + '|' + label ? null : o),
    onDrop: e => {
      e.preventDefault();
      const d = drag.current;
      if (d && d.g === sec.g && d.label !== label && onReorder) onReorder(sec.g, d.labels, d.label, label);
      drag.current = null;
      setOver(null);
    },
    onDragEnd: () => {
      drag.current = null;
      setOver(null);
    },
    onClick: e => guardClick(e.currentTarget, () => onNav && onNav(label)),
    title: label
  }, onReorder && /*#__PURE__*/React.createElement("span", {
    className: "nav-grip",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 17
  }), /*#__PURE__*/React.createElement("span", null, label)))));
}
Object.assign(__ds_scope, { SideNavSections });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/SideNavSections.jsx", error: String((e && e.message) || e) }); }

// components/app/Sidebar.jsx
try { (() => {
// Nexus sidebar — 232px, brand block, mono section titles, teal active state.
// Adapted from reference/app-shell.jsx (t-prop palette → CSS vars).

const NEXUS_SIDEBAR_W = 232;
const DEFAULT_SECTIONS = [{
  title: null,
  items: [{
    key: 'home',
    Icon: __ds_scope.IconHome,
    label: 'Dashboard'
  }, {
    key: 'wizard',
    Icon: __ds_scope.IconWizard,
    label: 'Weekly Report'
  }, {
    key: 'history',
    Icon: __ds_scope.IconHistory,
    label: 'History'
  }]
}, {
  title: 'Planning',
  items: [{
    key: 'lookahead',
    Icon: __ds_scope.IconChart,
    label: 'Game Plan',
    badge: 'NEW'
  }, {
    key: 'money',
    Icon: __ds_scope.IconWallet,
    label: 'Money Needs',
    child: true
  }, {
    key: 'goals',
    Icon: __ds_scope.IconTarget,
    label: 'Goals'
  }]
}, {
  title: 'Tools',
  items: [{
    key: 'commission',
    Icon: __ds_scope.IconBolt,
    label: 'Commission'
  }, {
    key: 'persistency',
    Icon: __ds_scope.IconRepeat,
    label: 'Persistency'
  }, {
    key: 'ledger',
    Icon: __ds_scope.IconBook,
    label: 'Policy Ledger'
  }, {
    key: 'prospect',
    Icon: __ds_scope.IconSearch,
    label: 'Prospect Prep'
  }]
}, {
  title: 'Recognition',
  items: [{
    key: 'awards',
    Icon: __ds_scope.IconMedal,
    label: 'Awards'
  }, {
    key: 'career',
    Icon: __ds_scope.IconShield,
    label: 'Career Portal'
  }]
}];
function Sidebar({
  active = 'home',
  sections = DEFAULT_SECTIONS,
  org = 'Tatil Life · South',
  user = {
    initials: 'MS',
    name: 'Marsha Singh',
    role: 'Senior Associate'
  },
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: NEXUS_SIDEBAR_W,
      background: 'var(--surface)',
      borderRight: '1px solid var(--rule)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      flexShrink: 0,
      fontFamily: 'var(--sans)',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 10px 18px',
      borderBottom: '1px solid var(--rule)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AgencyLogo, {
    size: 32
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      letterSpacing: '-0.012em'
    }
  }, "AgencyTrack"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--inkMute)',
      marginTop: 1
    }
  }, org))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, sections.map((s, si) => /*#__PURE__*/React.createElement("div", {
    key: si,
    style: {
      marginBottom: 14
    }
  }, s.title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      color: 'var(--inkFaint)',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding: '10px 12px 6px',
      fontFamily: 'var(--mono)'
    }
  }, s.title) : null, s.items.map(it => {
    const isActive = active === it.key;
    return /*#__PURE__*/React.createElement("div", {
      key: it.key,
      onClick: onNavigate ? () => onNavigate(it.key) : undefined,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: it.child ? 9 : 11,
        padding: it.child ? '7px 12px 7px 32px' : '9px 12px',
        borderRadius: 9,
        background: isActive ? 'var(--tealTint)' : 'transparent',
        color: isActive ? 'var(--teal)' : 'var(--inkMute)',
        transition: 'background-color 180ms ease, color 180ms ease',
        fontSize: it.child ? 12 : 13,
        fontWeight: 600,
        position: 'relative',
        cursor: onNavigate ? 'pointer' : 'default'
      }
    }, isActive ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: 6,
        bottom: 6,
        width: 3,
        background: 'var(--teal)',
        borderRadius: 999
      }
    }) : null, it.child ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 19,
        top: -2,
        width: 10,
        height: 16,
        borderLeft: '1.5px solid var(--rule)',
        borderBottom: '1.5px solid var(--rule)',
        borderBottomLeftRadius: 5,
        pointerEvents: 'none'
      }
    }) : null, /*#__PURE__*/React.createElement(it.Icon, {
      size: it.child ? 15 : 17,
      color: isActive ? 'var(--teal)' : 'var(--inkMute)',
      stroke: 1.8
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, it.label), it.badge ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '1px 6px',
        borderRadius: 999,
        fontSize: 8.5,
        fontWeight: 700,
        background: 'var(--gold)',
        color: 'var(--surface)',
        letterSpacing: '0.06em'
      }
    }, it.badge) : null);
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 10px',
      borderTop: '1px solid var(--rule)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--tealTint)',
      color: 'var(--teal)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      fontFamily: 'var(--display)',
      flexShrink: 0
    }
  }, user.initials), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--inkMute)',
      marginTop: 1
    }
  }, user.role))));
}
Object.assign(__ds_scope, { NEXUS_SIDEBAR_W, Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/app/StateLayer.jsx
try { (() => {
// StateLayer — wrap a data surface and swap in loading / empty / error states.
// Drive `state` from the fetch; default 'ready' shows children. This is the
// single contract every data screen renders through (addendum §1).

function StateLayer({
  state = 'ready',
  kind = 'cards',
  empty,
  error,
  onRetry,
  children
}) {
  if (state === 'loading') return /*#__PURE__*/React.createElement(__ds_scope.SkeletonScreen, {
    kind: kind
  });
  if (state === 'empty') return empty || /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    title: "Nothing here yet",
    body: "Once data comes in, it will appear here."
  });
  if (state === 'error') return error || /*#__PURE__*/React.createElement(__ds_scope.ErrorState, {
    onRetry: onRetry
  });
  return children;
}
Object.assign(__ds_scope, { StateLayer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/StateLayer.jsx", error: String((e && e.message) || e) }); }

// components/app/Topbar.jsx
try { (() => {
// Nexus topbar — 60px, page title, ⌘K search, mode toggle, bell.
// Adapted from reference/app-shell.jsx.

function Topbar({
  title,
  subtitle,
  dark = false,
  onToggleMode
}) {
  const iconBox = {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: 'var(--surface)',
    border: '1px solid var(--rule)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--inkMute)',
    cursor: 'pointer',
    flexShrink: 0
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 60,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--rule)',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexShrink: 0,
      fontFamily: 'var(--sans)',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--ink)',
      letterSpacing: '-0.012em',
      fontFamily: 'var(--display)'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--inkMute)',
      marginTop: 1
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      width: 280,
      padding: '8px 14px',
      background: 'var(--surfaceSoft)',
      borderRadius: 9,
      border: '1px solid var(--rule)',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconSearch, {
    size: 14,
    color: "var(--inkMute)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 12.5,
      color: 'var(--inkFaint)'
    }
  }, "Search agents, policies, weeks\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--inkFaint)',
      padding: '2px 6px',
      background: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: 4,
      fontFamily: 'var(--mono)'
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement("div", {
    style: iconBox,
    onClick: onToggleMode,
    role: "button",
    "aria-label": "Toggle mode"
  }, dark ? /*#__PURE__*/React.createElement(__ds_scope.IconSun, {
    size: 16,
    color: "var(--inkMute)"
  }) : /*#__PURE__*/React.createElement(__ds_scope.IconMoon, {
    size: 16,
    color: "var(--inkMute)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      ...iconBox,
      position: 'relative',
      cursor: 'default'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconBell, {
    size: 16,
    color: "var(--inkMute)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 7,
      right: 7,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--danger)',
      border: '2px solid var(--surface)'
    }
  })));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/Topbar.jsx", error: String((e && e.message) || e) }); }

// components/app/AppShell.jsx
try { (() => {
// Nexus page shell — sidebar + topbar + content, 1280×800 desktop frame.
// Wrap in .nexus / .nexus.dark (or pass dark prop and it sets the classes itself).

function AppShell({
  active,
  title,
  subtitle,
  dark = false,
  onToggleMode,
  onNavigate,
  sections,
  org,
  user,
  width = 1280,
  height = 800,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: dark ? 'nexus dark' : 'nexus',
    style: {
      width,
      height,
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--sans)',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Sidebar, {
    active: active,
    sections: sections,
    org: org,
    user: user,
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Topbar, {
    title: title,
    subtitle: subtitle,
    dark: dark,
    onToggleMode: onToggleMode
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '24px 28px'
    }
  }, children)));
}
Object.assign(__ds_scope, { AppShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/nexus/screens.jsx
try { (() => {
// Nexus app UI kit — screen content components (Dashboard, Policy Ledger, Awards).
// Composes design-system primitives from the bundle; recreation of the portal views
// described in app/README.md + reference/app-shell.jsx.
const {
  Scorecard,
  GlassCard,
  Money,
  Eyebrow,
  Pill,
  Avatar,
  Button,
  IconArrowR,
  IconCheck,
  IconClock,
  IconTrophy,
  IconDownload,
  IconFilter,
  IconPlus
} = window.AgencyTrackDesignSystem_ad1cd7;
const AGENTS = [{
  ini: 'MS',
  name: 'Marsha Singh',
  unit: 'S·02',
  week: 24000,
  status: ['success', 'ON PACE']
}, {
  ini: 'AP',
  name: 'Anand Persad',
  unit: 'S·01',
  week: 19000,
  status: ['success', 'ON PACE']
}, {
  ini: 'SM',
  name: 'Selina Mohammed',
  unit: 'S·03',
  week: 17000,
  status: ['success', 'ON PACE']
}, {
  ini: 'CJ',
  name: 'Carla Joseph',
  unit: 'S·02',
  week: 18000,
  status: ['warning', 'AT FLOOR']
}, {
  ini: 'DL',
  name: 'Devin Lewis',
  unit: 'S·01',
  week: 9000,
  status: ['danger', 'BELOW']
}];
const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--rule)',
  borderRadius: 14,
  padding: '16px 18px'
};
const secTitle = {
  fontFamily: 'var(--display)',
  fontWeight: 700,
  fontSize: 15,
  color: 'var(--ink)',
  letterSpacing: '-.012em'
};
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  padding: '10px 0',
  borderBottom: '1px solid var(--rule)'
};
const monoMeta = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  color: 'var(--inkFaint)'
};
function DashboardScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(GlassCard, {
    tint: "teal",
    padding: "20px 24px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm"
  }, "YTD \xB7 Settled API"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 34,
      letterSpacing: '-.025em',
      color: 'var(--ink)',
      marginTop: 7,
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement(Money, {
    value: 487000,
    mono: false
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--inkMute)',
      marginTop: 6
    }
  }, "81% of TTD 600K \xB7 5 weeks left in the year"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      height: 6,
      background: 'var(--surfaceMute)',
      borderRadius: 999,
      overflow: 'hidden',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '81%',
      height: 6,
      background: 'linear-gradient(90deg, var(--tealDark), var(--teal))',
      borderRadius: 999
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 26,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm",
    color: "var(--success)"
  }, "Persistency"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 24,
      color: 'var(--ink)',
      marginTop: 6
    }
  }, "88%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm"
  }, "Streak"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 24,
      color: 'var(--ink)',
      marginTop: 6
    }
  }, "12 wks")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm",
    color: "var(--gold)"
  }, "Awards"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 24,
      color: 'var(--gold)',
      marginTop: 6
    }
  }, "MDRT"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "THIS WEEK",
    value: /*#__PURE__*/React.createElement(Money, {
      value: 24500,
      mono: false
    }),
    sub: "of TTD 12K floor",
    progress: 100,
    big: true
  }), /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "CALLS MADE",
    value: "92 / 60",
    sub: "\u2713 above the floor",
    accent: "var(--success)"
  }), /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "FACT FINDS",
    value: "14 / 10",
    sub: "\u2713 above the floor",
    accent: "var(--success)"
  }), /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "APPOINTMENTS",
    value: "16 / 20",
    sub: "4 short of plan",
    accent: "var(--warning)",
    progress: 80
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      flex: 1.4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: secTitle
  }, "Policies to deliver"), /*#__PURE__*/React.createElement(Pill, {
    tone: "warning"
  }, "30-day clock"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(IconArrowR, {
      size: 13
    })
  }, "Delivery register"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: rowStyle
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--success)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: 'var(--ink)'
    }
  }, "Anil Boodram"), /*#__PURE__*/React.createElement("div", {
    style: monoMeta
  }, "Platinum Edge \xB7 TL-08661")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 19,
      color: 'var(--success)',
      lineHeight: 1
    }
  }, "26"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...monoMeta,
      fontSize: 8
    }
  }, "DAYS LEFT"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...rowStyle,
      borderBottom: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--warning)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: 'var(--ink)'
    }
  }, "Sara Khan"), /*#__PURE__*/React.createElement("div", {
    style: monoMeta
  }, "Term Life 20 \xB7 TL-08655")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 19,
      color: 'var(--warning)',
      lineHeight: 1
    }
  }, "6"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...monoMeta,
      fontSize: 8
    }
  }, "DAYS LEFT"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: secTitle
  }, "Leaderboard"), /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm",
    color: "var(--gold)",
    star: true
  }, "This week")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, AGENTS.slice(0, 3).map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.ini,
    style: {
      ...rowStyle,
      ...(i === 2 ? {
        borderBottom: 0
      } : {})
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 14,
      width: 13,
      textAlign: 'center',
      color: i === 0 ? 'var(--gold)' : 'var(--inkFaint)'
    }
  }, i + 1), /*#__PURE__*/React.createElement(Avatar, {
    initials: a.ini,
    size: 28,
    ring: i === 0
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--ink)'
    }
  }, a.name), /*#__PURE__*/React.createElement(Money, {
    value: a.week,
    size: 12,
    color: i === 0 ? 'var(--gold)' : 'var(--inkMute)'
  })))))));
}
function LedgerScreen() {
  const rows = [{
    ini: 'KM',
    name: 'Kareem Mohammed',
    meta: 'submitted 32.4K · settled 29.8K',
    tone: 'danger',
    label: '−TTD 2.6K'
  }, {
    ini: 'ML',
    name: 'Marcus Lee',
    meta: 'agent: settled · carrier: NTU',
    tone: 'danger',
    label: 'CONFLICT'
  }, {
    ini: 'AB',
    name: 'Anil Boodram',
    meta: '36K = 36K',
    tone: 'success',
    label: '✓ MATCH'
  }, {
    ini: 'SK',
    name: 'Sara Khan',
    meta: '18.2K = 18.2K',
    tone: 'success',
    label: '✓ MATCH'
  }, {
    ini: 'JK',
    name: 'Jamal Khan',
    meta: 'in carrier file · no agent entry',
    tone: 'warning',
    label: 'UNMATCHED'
  }];
  const toneColor = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "SUBMITTED \xB7 NOV",
    value: /*#__PURE__*/React.createElement(Money, {
      value: 186000,
      mono: false
    }),
    big: true
  }), /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "SETTLED \xB7 CONFIRMED",
    value: /*#__PURE__*/React.createElement(Money, {
      value: 172400,
      mono: false
    }),
    accent: "var(--success)",
    big: true
  }), /*#__PURE__*/React.createElement(Scorecard, {
    eyebrow: "EXCEPTIONS",
    value: "3",
    sub: "2 conflicts \xB7 1 unmatched",
    accent: "var(--danger)",
    big: true
  })), /*#__PURE__*/React.createElement("div", {
    style: cardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: secTitle
  }, "Reconciliation \xB7 South Branch"), /*#__PURE__*/React.createElement(Pill, {
    tone: "teal"
  }, "Nov settlement"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(IconFilter, {
      size: 13
    })
  }, "Filter"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(IconDownload, {
      size: 13
    })
  }, "Export"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: r.ini + i,
    style: {
      ...rowStyle,
      ...(i === rows.length - 1 ? {
        borderBottom: 0
      } : {})
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: r.ini,
    size: 28,
    bg: "#01696F"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: 'var(--ink)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: monoMeta
  }, r.meta)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontWeight: 700,
      fontSize: 12,
      color: toneColor[r.tone]
    }
  }, r.label))))));
}
function AwardsScreen() {
  const gates = [{
    band: '≥90%',
    pay: '100%',
    solid: true
  }, {
    band: '85–89',
    pay: '50%'
  }, {
    band: '80–84',
    pay: '25%'
  }, {
    band: '<80',
    pay: 'DQ',
    danger: true
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(GlassCard, {
    tint: "gold",
    padding: "20px 24px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 13,
      background: 'var(--goldTint)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(IconTrophy, {
    size: 24,
    color: "var(--gold)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm",
    color: "var(--goldInk, var(--gold))",
    star: true
  }, "Christmas campaign \xB7 persistency gate"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 27,
      letterSpacing: '-.022em',
      color: 'var(--ink)',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Money, {
    value: 70000,
    mono: false
  }), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      fontFamily: 'var(--sans)',
      color: 'var(--inkMute)'
    }
  }, "leading \xB7 91% persistency \xB7 full payout"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, gates.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.band,
    style: {
      textAlign: 'center',
      padding: '8px 12px',
      borderRadius: 11,
      background: g.solid ? 'var(--gold)' : g.danger ? 'var(--dangerTint)' : 'var(--goldTint)',
      color: g.solid ? '#fff' : g.danger ? 'var(--danger)' : 'var(--goldInk, var(--gold))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9,
      fontWeight: 700
    }
  }, g.band), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 16
    }
  }, g.pay)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: secTitle
  }, "Campaign standings"), /*#__PURE__*/React.createElement(Eyebrow, {
    size: "sm",
    color: "var(--gold)",
    star: true
  }, "Live")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, AGENTS.slice(0, 4).map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.ini,
    style: {
      ...rowStyle,
      ...(i === 3 ? {
        borderBottom: 0
      } : {})
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 14,
      width: 13,
      textAlign: 'center',
      color: i === 0 ? 'var(--gold)' : 'var(--inkFaint)'
    }
  }, i + 1), /*#__PURE__*/React.createElement(Avatar, {
    initials: a.ini,
    size: 28,
    bg: "#01696F",
    ring: i === 0
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--ink)'
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      ...monoMeta,
      width: 36
    }
  }, a.unit), /*#__PURE__*/React.createElement(Money, {
    value: a.week * 2.9,
    size: 12,
    color: i === 0 ? 'var(--gold)' : 'var(--inkMute)'
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      width: 330,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: secTitle
  }, "Awards watch"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, [['MDRT', 'qualified · 118% of requirement', 'gold', 'QUALIFIED'], ['Eagles Club · Bermuda', 'unlocked at TTD 450K settled', 'gold', 'UNLOCKED'], ['Career: Senior Associate II', 'TTD 113K to next level', 'teal', 'IN REACH']].map(([name, meta, tone, label], i, arr) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      ...rowStyle,
      ...(i === arr.length - 1 ? {
        borderBottom: 0
      } : {})
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--ink)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: monoMeta
  }, meta)), /*#__PURE__*/React.createElement(Pill, {
    tone: tone
  }, label)))))));
}
Object.assign(window, {
  DashboardScreen,
  LedgerScreen,
  AwardsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/nexus/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/nexus/shell.jsx
try { (() => {
// Nexus app UI kit — v2 navigation shell.
// Rebuilds the portal chrome on the 2026 redesign nav components:
//   desktop  → SideNavSections (sectioned, drag-reorder, persisted) + ⌘K CommandPalette
//   mobile   → MobileTab (adaptive More + create FAB) + MobileMore + MobileCreateSheet
// Screen CONTENT comes from screens.jsx (DashboardScreen / LedgerScreen / AwardsScreen).
// Host owns & persists the four bits of per-role state the components expect:
//   sidebar order · mobile-tab order · pinned items · frequent-visit counts (localStorage).
const {
  SideNavSections,
  MobileTab,
  MobileMore,
  MobileCreateSheet,
  CommandPalette,
  EmptyState,
  Icon,
  Avatar
} = window.AgencyTrackDesignSystem_ad1cd7;
const {
  useState,
  useEffect,
  useCallback
} = React;

/* ---- nav model (icon names come from the DS Icon `name=` set) ---- */
const BASE_SECTIONS = [{
  g: 'Overview',
  items: [['home', 'Dashboard'], ['wizard', 'Weekly Report'], ['history', 'History']]
}, {
  g: 'Planning',
  items: [['chart', 'Game Plan'], ['wallet', 'Money Needs'], ['target', 'Goals']]
}, {
  g: 'Tools',
  items: [['bolt', 'Commission'], ['repeat', 'Persistency'], ['book', 'Policy Ledger'], ['search', 'Prospect Prep']]
}, {
  g: 'Recognition',
  items: [['medal', 'Awards'], ['shield', 'Career Portal']]
}];
const BASE_TABS = [['home', 'Home', 'Dashboard'], ['chart', 'Plan', 'Game Plan'], ['wallet', 'Money', 'Money Needs'], ['medal', 'Awards', 'Awards']];
const QUICK_ACTIONS = [['plus', 'Log activity', 'Dashboard', ['agent']], ['book', 'New policy', 'Policy Ledger', ['agent']], ['wizard', 'Weekly report', 'Weekly Report', ['agent']], ['bolt', 'Commission estimate', 'Commission', ['agent']]];
const META = {
  'Dashboard': 'Week 27 · Jun 29 – Jul 5 · Marsha Singh',
  'Policy Ledger': 'Reconciliation · November settlement',
  'Awards': 'Campaigns, awards & career — settled production only'
};
const ALL_ITEMS = BASE_SECTIONS.flatMap(s => s.items);
const iconFor = label => (ALL_ITEMS.find(i => i[1] === label) || ['grid'])[0];

/* ---- localStorage helpers ---- */
const load = (k, fb) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fb;
  } catch (e) {
    return fb;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

/* apply a persisted [g -> label[]] order map onto BASE_SECTIONS */
function orderedSections(orderMap) {
  return BASE_SECTIONS.map(sec => {
    const ord = orderMap[sec.g];
    if (!ord) return sec;
    const byLabel = Object.fromEntries(sec.items.map(i => [i[1], i]));
    const items = ord.map(l => byLabel[l]).filter(Boolean);
    sec.items.forEach(i => {
      if (!items.includes(i)) items.push(i);
    }); // any new items
    return {
      g: sec.g,
      items
    };
  });
}
function orderedTabs(order) {
  if (!order) return BASE_TABS;
  const byId = Object.fromEntries(BASE_TABS.map(t => [t[2], t]));
  const tabs = order.map(id => byId[id]).filter(Boolean);
  BASE_TABS.forEach(t => {
    if (!tabs.includes(t)) tabs.push(t);
  });
  return tabs;
}
/* move `from` to `to`'s position within a label list */
function reorder(list, from, to) {
  const a = [...list];
  const fi = a.indexOf(from),
    ti = a.indexOf(to);
  if (fi < 0 || ti < 0) return a;
  a.splice(ti, 0, a.splice(fi, 1)[0]);
  return a;
}
function ContentArea({
  active,
  nav
}) {
  if (active === 'Dashboard') return /*#__PURE__*/React.createElement(DashboardScreen, null);
  if (active === 'Policy Ledger') return /*#__PURE__*/React.createElement(LedgerScreen, null);
  if (active === 'Awards') return /*#__PURE__*/React.createElement(AwardsScreen, null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: 16
    }
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: iconFor(active),
    title: active,
    body: "This screen isn\u2019t part of the UI-kit sample \u2014 but the sidebar, command palette (\u2318K) and mobile sheets are all fully wired. Try reordering the sidebar or opening \u2318K.",
    cta: "Back to Dashboard",
    onCta: () => nav('Dashboard')
  }));
}
function Header({
  active,
  dark,
  onToggleDark,
  onSearch,
  onCreate,
  view,
  onView
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 24px',
      borderBottom: '1px solid var(--rule)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-.015em',
      color: 'var(--ink)',
      lineHeight: 1.1
    }
  }, active), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--inkMute)',
      marginTop: 2,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, META[active] || 'Nexus agent portal')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onSearch,
    "aria-label": "Search and jump to (Command K)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      height: 38,
      padding: '0 12px',
      minWidth: 210,
      background: 'var(--surfaceMute)',
      border: '1px solid var(--rule)',
      borderRadius: 11,
      color: 'var(--inkFaint)',
      font: '13px var(--sans)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, "Search screens\u2026"), /*#__PURE__*/React.createElement("kbd", {
    style: {
      font: '700 10px var(--mono)',
      letterSpacing: '.05em',
      background: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: 6,
      padding: '2px 6px',
      color: 'var(--inkMute)'
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "tablist",
    "aria-label": "Preview device",
    style: {
      display: 'flex',
      gap: 2,
      background: 'var(--surfaceMute)',
      border: '1px solid var(--rule)',
      borderRadius: 11,
      padding: 3
    }
  }, [['Desktop', 'desktop'], ['Mobile', 'mobile']].map(([lab, v]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    role: "tab",
    "aria-selected": view === v,
    onClick: () => onView(v),
    style: {
      border: 'none',
      background: view === v ? 'var(--surface)' : 'transparent',
      color: view === v ? 'var(--ink)' : 'var(--inkMute)',
      font: '700 12px var(--sans)',
      padding: '6px 11px',
      borderRadius: 8,
      cursor: 'pointer',
      boxShadow: view === v ? '0 1px 2px rgba(0,0,0,.08)' : 'none'
    }
  }, lab))), /*#__PURE__*/React.createElement("button", {
    className: "quick-create",
    onClick: onCreate,
    "aria-label": "Quick create"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleDark,
    "aria-label": dark ? 'Switch to light mode' : 'Switch to dark mode',
    style: {
      width: 38,
      height: 38,
      borderRadius: 11,
      border: '1px solid var(--rule)',
      background: 'var(--surfaceMute)',
      color: 'var(--inkMute)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: dark ? 'sun' : 'moon',
    size: 17
  })), /*#__PURE__*/React.createElement(Avatar, {
    initials: "MS",
    size: 34
  }));
}
function NexusKitShell() {
  const [active, setActive] = useState(() => localStorage.getItem('nexus-kit-active') || 'Dashboard');
  const [dark, setDark] = useState(() => localStorage.getItem('nexus-kit-dark') === '1');
  const [view, setView] = useState('desktop');
  const [collapsed, setCollapsed] = useState(false);
  const [navOrder, setNavOrder] = useState(() => load('nexus-kit-navorder', {}));
  const [tabOrder, setTabOrder] = useState(() => load('nexus-kit-taborder', null));
  const [pins, setPins] = useState(() => load('nexus-kit-pins', ['Policy Ledger']));
  const [visits, setVisits] = useState(() => load('nexus-kit-visits', {
    'Awards': 3,
    'Game Plan': 2,
    'History': 1
  }));
  const [palette, setPalette] = useState({
    open: false,
    mode: 'search'
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const sections = orderedSections(navOrder);
  const tabs = orderedTabs(tabOrder);
  const pinSet = new Set(pins);
  const pinnedItems = pins.map(l => [iconFor(l), l]);
  const frequentItems = Object.entries(visits).filter(([l]) => !pinSet.has(l)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => [iconFor(l), l]);
  const screens = ALL_ITEMS.map(([ic, label]) => ({
    id: label,
    label,
    ic,
    grp: (BASE_SECTIONS.find(s => s.items.some(i => i[1] === label)) || {}).g
  }));
  const nav = useCallback(label => {
    setActive(label);
    localStorage.setItem('nexus-kit-active', label);
    setVisits(v => {
      const nx = {
        ...v,
        [label]: (v[label] || 0) + 1
      };
      save('nexus-kit-visits', nx);
      return nx;
    });
    setMoreOpen(false);
    setCreateOpen(false);
    setPalette({
      open: false,
      mode: 'search'
    });
  }, []);
  const toggleDark = () => setDark(d => {
    const nx = !d;
    localStorage.setItem('nexus-kit-dark', nx ? '1' : '0');
    return nx;
  });
  const onSideReorder = (g, order, from, to) => setNavOrder(m => {
    const nx = {
      ...m,
      [g]: reorder(order, from, to)
    };
    save('nexus-kit-navorder', nx);
    return nx;
  });
  const onTabReorder = (from, to) => setTabOrder(() => {
    const nx = reorder(tabs.map(t => t[2]), from, to);
    save('nexus-kit-taborder', nx);
    return nx;
  });
  const togglePin = label => setPins(p => {
    const nx = p.includes(label) ? p.filter(x => x !== label) : [...p, label];
    save('nexus-kit-pins', nx);
    return nx;
  });
  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(p => ({
          open: !p.open,
          mode: 'search'
        }));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const themeClass = 'nexus' + (dark ? ' dark' : '');
  const deep = !tabs.some(t => t[2] === active);

  /* ---------- MOBILE ---------- */
  if (view === 'mobile') {
    return /*#__PURE__*/React.createElement("div", {
      className: themeClass,
      style: {
        width: 1280,
        height: 800,
        display: 'grid',
        placeItems: 'center',
        background: dark ? '#100D0A' : '#E7E4DC'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 22,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "seg",
      role: "tablist",
      "aria-label": "Preview device",
      style: {
        display: 'flex',
        gap: 2,
        background: 'var(--surface)',
        border: '1px solid var(--ruleStrong)',
        borderRadius: 11,
        padding: 3
      }
    }, [['Desktop', 'desktop'], ['Mobile', 'mobile']].map(([lab, v]) => /*#__PURE__*/React.createElement("button", {
      key: v,
      role: "tab",
      "aria-selected": view === v,
      onClick: () => setView(v),
      style: {
        border: 'none',
        background: view === v ? 'var(--teal)' : 'transparent',
        color: view === v ? '#fff' : 'var(--inkMute)',
        font: '700 12px var(--sans)',
        padding: '7px 14px',
        borderRadius: 8,
        cursor: 'pointer'
      }
    }, lab)))), /*#__PURE__*/React.createElement("div", {
      className: themeClass,
      "data-view": "mobile",
      style: {
        position: 'relative',
        width: 390,
        height: 720,
        borderRadius: 40,
        overflow: 'hidden',
        border: '10px solid #17130F',
        boxShadow: '0 30px 70px -20px rgba(0,0,0,.6)',
        background: 'var(--bg)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        overflowY: 'auto',
        padding: '20px 16px 84px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 30,
        height: 30,
        borderRadius: 9,
        background: 'linear-gradient(150deg,var(--heroA),var(--heroB))',
        color: 'var(--heroInk)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--display)',
        fontWeight: 800
      }
    }, "A"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--display)',
        fontWeight: 800,
        fontSize: 18,
        color: 'var(--ink)',
        letterSpacing: '-.015em'
      }
    }, active), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--inkMute)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, META[active] || 'Nexus agent portal')), /*#__PURE__*/React.createElement("button", {
      onClick: toggleDark,
      "aria-label": dark ? 'Light mode' : 'Dark mode',
      style: {
        width: 36,
        height: 36,
        borderRadius: 10,
        border: '1px solid var(--rule)',
        background: 'var(--surfaceMute)',
        color: 'var(--inkMute)',
        display: 'grid',
        placeItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: dark ? 'sun' : 'moon',
      size: 16
    }))), /*#__PURE__*/React.createElement(ContentArea, {
      active: active,
      nav: nav
    })), /*#__PURE__*/React.createElement(MobileTab, {
      tabs: tabs,
      screen: active,
      go: nav,
      onMore: () => setMoreOpen(true),
      primary: {
        label: 'Log activity'
      },
      onCreate: () => setCreateOpen(true),
      current: deep ? {
        ic: iconFor(active),
        label: active
      } : undefined,
      onReorder: onTabReorder
    }), /*#__PURE__*/React.createElement(MobileMore, {
      open: moreOpen,
      title: "All screens",
      sections: sections,
      active: active,
      onNav: nav,
      onClose: () => setMoreOpen(false),
      pinnedItems: pinnedItems,
      frequentItems: frequentItems,
      pinnedSet: pinSet,
      onTogglePin: togglePin
    }), /*#__PURE__*/React.createElement(MobileCreateSheet, {
      open: createOpen,
      actions: QUICK_ACTIONS.map(a => [a[0], a[1], a[2]]),
      onGo: nav,
      onClose: () => setCreateOpen(false)
    })));
  }

  /* ---------- DESKTOP ---------- */
  return /*#__PURE__*/React.createElement("div", {
    className: themeClass,
    style: {
      width: 1280,
      height: 800,
      overflow: 'hidden',
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "shell",
    style: {
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    className: 'side' + (collapsed ? ' is-collapsed' : ''),
    "aria-label": "Primary"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "side-mark"
  }, "A"), /*#__PURE__*/React.createElement("span", null, "AgencyTrack")), /*#__PURE__*/React.createElement("div", {
    className: "side-role"
  }, "Agent \xB7 My Book"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(SideNavSections, {
    sections: sections,
    active: active,
    onNav: nav,
    onReorder: onSideReorder
  })), /*#__PURE__*/React.createElement("button", {
    className: "side-collapse",
    onClick: () => setCollapsed(c => !c),
    "aria-label": collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: collapsed ? 'arrow' : 'grid',
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, collapsed ? '' : 'Collapse'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Header, {
    active: active,
    dark: dark,
    onToggleDark: toggleDark,
    onSearch: () => setPalette({
      open: true,
      mode: 'search'
    }),
    onCreate: () => setPalette({
      open: true,
      mode: 'create'
    }),
    view: view,
    onView: setView
  }), /*#__PURE__*/React.createElement("main", {
    className: "nx-screen-enter",
    key: active,
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '22px 26px'
    }
  }, /*#__PURE__*/React.createElement(ContentArea, {
    active: active,
    nav: nav
  })))), /*#__PURE__*/React.createElement(CommandPalette, {
    open: palette.open,
    mode: palette.mode,
    screens: screens,
    roles: ['agent'],
    quickActions: QUICK_ACTIONS,
    onGo: nav,
    onClose: () => setPalette({
      open: false,
      mode: 'search'
    })
  }));
}
Object.assign(window, {
  NexusKitShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/nexus/shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AppShell = __ds_scope.AppShell;

__ds_ns.CommandPalette = __ds_scope.CommandPalette;

__ds_ns.CountUp = __ds_scope.CountUp;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.GlassCard = __ds_scope.GlassCard;

__ds_ns.MobileCreateSheet = __ds_scope.MobileCreateSheet;

__ds_ns.MobileMore = __ds_scope.MobileMore;

__ds_ns.MobileTab = __ds_scope.MobileTab;

__ds_ns.Money = __ds_scope.Money;

__ds_ns.Scorecard = __ds_scope.Scorecard;

__ds_ns.SideNavSections = __ds_scope.SideNavSections;

__ds_ns.NEXUS_SIDEBAR_W = __ds_scope.NEXUS_SIDEBAR_W;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.SkeletonScreen = __ds_scope.SkeletonScreen;

__ds_ns.StateLayer = __ds_scope.StateLayer;

__ds_ns.Topbar = __ds_scope.Topbar;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.AgencyLogo = __ds_scope.AgencyLogo;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconHome = __ds_scope.IconHome;

__ds_ns.IconWizard = __ds_scope.IconWizard;

__ds_ns.IconHistory = __ds_scope.IconHistory;

__ds_ns.IconChart = __ds_scope.IconChart;

__ds_ns.IconTarget = __ds_scope.IconTarget;

__ds_ns.IconWallet = __ds_scope.IconWallet;

__ds_ns.IconMedal = __ds_scope.IconMedal;

__ds_ns.IconShield = __ds_scope.IconShield;

__ds_ns.IconBolt = __ds_scope.IconBolt;

__ds_ns.IconRepeat = __ds_scope.IconRepeat;

__ds_ns.IconBook = __ds_scope.IconBook;

__ds_ns.IconUsers = __ds_scope.IconUsers;

__ds_ns.IconGrid = __ds_scope.IconGrid;

__ds_ns.IconSettings = __ds_scope.IconSettings;

__ds_ns.IconSearch = __ds_scope.IconSearch;

__ds_ns.IconBell = __ds_scope.IconBell;

__ds_ns.IconSun = __ds_scope.IconSun;

__ds_ns.IconMoon = __ds_scope.IconMoon;

__ds_ns.IconChevR = __ds_scope.IconChevR;

__ds_ns.IconChevD = __ds_scope.IconChevD;

__ds_ns.IconArrowR = __ds_scope.IconArrowR;

__ds_ns.IconCheck = __ds_scope.IconCheck;

__ds_ns.IconAlert = __ds_scope.IconAlert;

__ds_ns.IconTrophy = __ds_scope.IconTrophy;

__ds_ns.IconFilter = __ds_scope.IconFilter;

__ds_ns.IconDownload = __ds_scope.IconDownload;

__ds_ns.IconPlus = __ds_scope.IconPlus;

__ds_ns.IconClock = __ds_scope.IconClock;

})();
