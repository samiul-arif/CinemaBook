/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        primaryLight: 'rgb(var(--color-primary-light) / <alpha-value>)',
        primaryDark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        bg: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceVariant: 'rgb(var(--color-surface-variant) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        textPrimary: 'rgb(var(--color-text-primary) / <alpha-value>)',
        textSecondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        textTertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        borderLight: 'rgb(var(--color-border-light) / <alpha-value>)',
        
        // Semantic helper tokens
        success: 'rgb(var(--color-success) / <alpha-value>)',
        successLight: 'rgb(var(--color-success-light) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        warningLight: 'rgb(var(--color-warning-light) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        errorLight: 'rgb(var(--color-error-light) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Bebas Neue"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'rx-card': '0 1px 2px -1px rgba(31, 71, 54, 0.08), 0 8px 24px -12px rgba(31, 71, 54, 0.12)',
        'rx-hover': '0 12px 28px -12px rgb(var(--color-primary) / 0.28), 0 6px 14px -8px rgba(17, 24, 39, 0.18)',
      },
    },
  },
  plugins: [],
};

