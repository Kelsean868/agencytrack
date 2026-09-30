import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '!./src/**/__tests__/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Token-driven (FR-D2): :root holds Satoshi / Cabinet Grotesk; the FR
        // look re-points these under html[data-look="fr"].
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      // Colors use functional notation `rgb(var(--X-channels) / <alpha-value>)`
      // so opacity modifiers (bg-primary/30, ring-success/40, etc.) resolve
      // to real alpha-modulated colors. The --X-channels CSS vars are defined
      // in src/index.css alongside derived --color-X aliases — see PR-C-FU3.
      // -tint and presentation-muted/border entries keep their bare var()
      // form because they are pre-baked rgba designed values, not opacity
      // modulations of a base color.
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--primary-channels) / <alpha-value>)',
          dark:    'rgb(var(--primary-dark-channels) / <alpha-value>)',
          light:   'rgb(var(--primary-light-channels) / <alpha-value>)',
          tint:    'var(--color-primary-tint)',
        },
        surface: {
          DEFAULT: 'rgb(var(--bg-channels) / <alpha-value>)',
          raised:  'rgb(var(--surface-raised-channels) / <alpha-value>)',
          muted:   'rgb(var(--surface-muted-channels) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--surface-channels) / <alpha-value>)',
          raised:  'rgb(var(--surface-raised-channels) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--text-channels) / <alpha-value>)',
          muted:   'rgb(var(--text-muted-channels) / <alpha-value>)',
          faint:   'rgb(var(--text-faint-channels) / <alpha-value>)',
          // Nexus v2 --inkDim (non-text: dividers, disabled glyphs). The
          // consumable half of the faint AA split — use border-ink-dim /
          // bg-ink-dim, never text on it (redesign-addendum §4). JIT emits
          // this only when a class references it, so it is a no-op until used.
          dim:     'rgb(var(--ink-dim-channels) / <alpha-value>)',
        },
        border: 'rgb(var(--border-channels) / <alpha-value>)',
        gold: {
          DEFAULT: 'rgb(var(--gold-channels) / <alpha-value>)',
          tint:    'var(--color-gold-tint)',
          // Gold split: --color-gold is now VIVID #B07D1A (decoration + AA-large
          // display text only). gold.ink (#8a6011 light / #E0AA3E dark) is the
          // AA-safe token for all other gold TEXT — use text-gold-ink.
          ink:     'rgb(var(--gold-ink-channels) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success-channels) / <alpha-value>)',
          tint:    'var(--color-success-tint)',
          ink:     'rgb(var(--success-ink-channels) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-channels) / <alpha-value>)',
          tint:    'var(--color-warning-tint)',
          ink:     'rgb(var(--warning-ink-channels) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-channels) / <alpha-value>)',
          tint:    'var(--color-danger-tint)',
          ink:     'rgb(var(--danger-ink-channels) / <alpha-value>)',
        },
        // FR look (docs/briefs/fr-agent-redesign-program.md). These tokens exist
        // only under html[data-look="fr"] (src/styles/fr-look.css); FR components
        // render only there. Chart series are fixed-order, never cycled.
        fr: {
          accent:        'rgb(var(--fr-accent-channels) / <alpha-value>)',
          'on-accent':   'rgb(var(--fr-on-accent-channels) / <alpha-value>)',
          'accent-tint': 'rgb(var(--fr-accent-tint-channels) / <alpha-value>)',
          ghost:         'rgb(var(--fr-ghost-channels) / <alpha-value>)',
          sunk:          'rgb(var(--fr-sunk-channels) / <alpha-value>)',
          side:          'rgb(var(--fr-side-channels) / <alpha-value>)',
          pane:          'rgb(var(--fr-pane-channels) / <alpha-value>)',
          warm:          'rgb(var(--fr-warm-channels) / <alpha-value>)',
          'warm-tint':   'rgb(var(--fr-warm-tint-channels) / <alpha-value>)',
          gold:          'rgb(var(--fr-gold-channels) / <alpha-value>)',
          'gold-tint':   'rgb(var(--fr-gold-tint-channels) / <alpha-value>)',
          'gold-on-ink': 'rgb(var(--fr-gold-on-ink-channels) / <alpha-value>)',
        },
        chart: {
          1: 'rgb(var(--chart-1-channels) / <alpha-value>)',
          2: 'rgb(var(--chart-2-channels) / <alpha-value>)',
          3: 'rgb(var(--chart-3-channels) / <alpha-value>)',
          4: 'rgb(var(--chart-4-channels) / <alpha-value>)',
          5: 'rgb(var(--chart-5-channels) / <alpha-value>)',
        },
        // Presentation surface — theme-independent (defined only in :root,
        // not overridden in .dark). For full-screen overlays that should
        // always render as a dark presentation surface, e.g. MeetingMode.
        // muted + border keep static rgba — no opacity-modifier consumers.
        presentation: {
          DEFAULT: 'rgb(var(--presentation-channels) / <alpha-value>)',
          text:    'rgb(var(--presentation-text-channels) / <alpha-value>)',
          muted:   'var(--color-presentation-muted)',
          accent:  'rgb(var(--presentation-accent-channels) / <alpha-value>)',
          border:  'var(--color-presentation-border)',
          // Track J Kiosk v2 — gold + hot accents for v2 halo/pulse animations.
          gold:    'rgb(var(--presentation-gold-channels) / <alpha-value>)',
          hot:     'rgb(var(--presentation-hot-channels) / <alpha-value>)',
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      // E5/E5.1 + Track J Kiosk v2: kiosk animations
      animation: {
        'kiosk-fade':       'kiosk-fade 0.6s ease-in-out',
        'count-up':         'count-up 600ms ease-out',
        'stagger-in':       'stagger-in 400ms ease-out',
        'progress-fill':    'progress-fill 1500ms ease-out forwards',
        // Track J Kiosk v2 — gentle ambient polish on the presentation surface.
        'kiosk-pulse-dot':  'kiosk-pulse-dot 1.8s ease-in-out infinite',
        'kiosk-breathe':    'kiosk-breathe 3.2s ease-in-out infinite',
        'kiosk-halo-gold':  'kiosk-halo-gold 2.8s ease-out infinite',
        'kiosk-halo-teal':  'kiosk-halo-teal 2.8s ease-out infinite',
        'kiosk-halo-hot':   'kiosk-halo-hot 2.4s ease-out infinite',
        'kiosk-sparkle':    'kiosk-sparkle 2.2s ease-in-out infinite',
        // Track J System Screens v2 — login pattern drift. Per-row duration
        // is overridden inline (see LoginScreen.jsx) so the rows don't beat
        // in lockstep; the base utility lives here for tree-shaking.
        'login-drift-l':    'login-drift-l 30s linear infinite',
        'login-drift-r':    'login-drift-r 30s linear infinite',
        // Track J Wizard v2 PR3 confetti + sparkle keyframes are defined in
        // src/index.css (not here) so inline-style consumers in
        // Celebration.jsx can reference them by name with per-particle
        // delay/duration overrides. Tailwind doesn't emit @keyframes for
        // inline animation references; index.css does.
      },
      keyframes: {
        'kiosk-fade': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'count-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stagger-in': {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'progress-fill': {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--progress-target, 100%)' },
        },
        // Track J Kiosk v2 — ambient + accent animations.
        'kiosk-pulse-dot': {
          '0%, 100%': { opacity: '1',    transform: 'scale(1)' },
          '50%':      { opacity: '0.42', transform: 'scale(0.78)' },
        },
        'kiosk-breathe': {
          '0%, 100%': { opacity: '0.55' },
          '50%':      { opacity: '1' },
        },
        'kiosk-halo-gold': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(var(--presentation-gold-channels), 0.55), inset 0 0 0 2px rgb(var(--presentation-gold-channels))',
          },
          '50%': {
            boxShadow: '0 0 0 14px rgba(var(--presentation-gold-channels), 0), inset 0 0 0 2px rgb(var(--presentation-gold-channels))',
          },
        },
        'kiosk-halo-teal': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(var(--presentation-accent-channels), 0.5), inset 0 0 0 2px rgb(var(--presentation-accent-channels))',
          },
          '50%': {
            boxShadow: '0 0 0 12px rgba(var(--presentation-accent-channels), 0), inset 0 0 0 2px rgb(var(--presentation-accent-channels))',
          },
        },
        'kiosk-halo-hot': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(var(--presentation-hot-channels), 0.5), inset 0 0 0 2px rgb(var(--presentation-hot-channels))',
          },
          '50%': {
            boxShadow: '0 0 0 12px rgba(var(--presentation-hot-channels), 0), inset 0 0 0 2px rgb(var(--presentation-hot-channels))',
          },
        },
        'kiosk-sparkle': {
          '0%, 100%': { transform: 'scale(0.6)', opacity: '0.2' },
          '50%':      { transform: 'scale(1)',   opacity: '1' },
        },
        // Track J System Screens v2 — login-pattern drift.
        'login-drift-l': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-140px)' },
        },
        'login-drift-r': {
          from: { transform: 'translateX(-140px)' },
          to:   { transform: 'translateX(0)' },
        },
      },
    },
  },
  // fr-fit-any-width: `@container` / `@[..]:` variants — page regions lay out
  // by the width they actually have (beside the sidebar), not by the window.
  plugins: [containerQueries],
}