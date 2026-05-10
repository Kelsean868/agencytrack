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
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
          tint: 'var(--color-primary-tint)',
        },
        surface: {
          DEFAULT: 'var(--color-bg)',
          raised: 'var(--color-surface-raised)',
          muted: 'var(--color-surface-muted)',
        },
        card: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          tint: 'var(--color-success-tint)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          tint: 'var(--color-warning-tint)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          tint: 'var(--color-danger-tint)',
        },
        // Presentation surface — theme-independent (defined only in :root,
        // not overridden in .dark). For full-screen overlays that should
        // always render as a dark presentation surface, e.g. MeetingMode.
        presentation: {
          DEFAULT: 'var(--color-presentation)',
          text:   'var(--color-presentation-text)',
          muted:  'var(--color-presentation-muted)',
          accent: 'var(--color-presentation-accent)',
          border: 'var(--color-presentation-border)',
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