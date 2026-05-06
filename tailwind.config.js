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
    },
  },
  plugins: [],
}