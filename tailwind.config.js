/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        display: ['Cabinet Grotesk', 'system-ui', 'sans-serif'],
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
        },
        border: 'rgb(var(--border-channels) / <alpha-value>)',
        gold: {
          DEFAULT: 'rgb(var(--gold-channels) / <alpha-value>)',
          tint:    'var(--color-gold-tint)',
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
  plugins: [],
}