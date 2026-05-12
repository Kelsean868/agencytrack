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
        success: {
          DEFAULT: 'rgb(var(--success-channels) / <alpha-value>)',
          tint:    'var(--color-success-tint)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-channels) / <alpha-value>)',
          tint:    'var(--color-warning-tint)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-channels) / <alpha-value>)',
          tint:    'var(--color-danger-tint)',
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
      // E5/E5.1: kiosk animations
      animation: {
        'kiosk-fade':    'kiosk-fade 0.6s ease-in-out',
        'count-up':      'count-up 600ms ease-out',
        'stagger-in':    'stagger-in 400ms ease-out',
        'progress-fill': 'progress-fill 1500ms ease-out forwards',
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
      },
    },
  },
  plugins: [],
}