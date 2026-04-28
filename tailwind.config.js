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
          DEFAULT: '#01696f',
          dark: '#014e52',
          light: '#018a91',
        },
        surface: {
          DEFAULT: '#f7f6f2',
          raised: '#ffffff',
          muted: '#f0efe9',
        },
        ink: {
          DEFAULT: '#28251d',
          muted: '#6b6560',
          faint: '#a8a39c',
        },
        success: '#2d7a4f',
        warning: '#b45309',
        danger: '#c0392b',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(40,37,29,0.06), 0 1px 2px rgba(40,37,29,0.04)',
        md: '0 4px 12px rgba(40,37,29,0.08), 0 2px 4px rgba(40,37,29,0.04)',
        lg: '0 10px 30px rgba(40,37,29,0.10), 0 4px 8px rgba(40,37,29,0.06)',
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