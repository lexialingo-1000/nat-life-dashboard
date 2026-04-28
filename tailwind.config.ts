import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        'extra-tight': '-0.04em',
      },
      colors: {
        accent: {
          DEFAULT: '#d97706',
          light: '#fbbf24',
          subtle: '#fef3c7',
        },
        surface: 'var(--bg)',
        ink: 'var(--fg)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          fg: 'var(--sidebar-fg)',
          active: 'var(--sidebar-active)',
        },
      },
      borderRadius: {
        sm: '2px',
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
      },
    },
  },
  plugins: [],
};

export default config;
