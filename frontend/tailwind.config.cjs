module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--theme-bg)',
        foreground: 'var(--theme-fg)',
        primary: {
          DEFAULT: 'var(--theme-primary)',
          foreground: 'var(--theme-primary-fg)',
        },
        accent: {
          DEFAULT: '#C9A84C',
          primary: '#6D071A',
          wine: '#800020',
          gold: '#D4AF37',
          warning: '#D4AF37',
          danger: '#FF3B30',
          success: '#00C853',
        },
        border: {
          DEFAULT: 'var(--theme-border)',
          default: 'var(--theme-border)',
          focus: 'var(--theme-primary)',
        },
        text: {
          primary: 'var(--theme-fg)',
          secondary: 'var(--theme-fg-muted)',
          inverse: '#FFFFFF',
          accent: 'var(--theme-primary)',
        },
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Courier New', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'gold-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.45)', opacity: '1' },
          '50%': { boxShadow: '0 0 0 10px rgba(212,175,55,0)', opacity: '0.9' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'gold-pulse': 'gold-pulse 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
