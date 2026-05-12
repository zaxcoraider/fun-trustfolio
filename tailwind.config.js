/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#0f0f1a',
          card: '#12121f',
          hover: '#1a1a2e',
        },
        neon: {
          purple: '#a855f7',
          'purple-dim': '#7c3aed',
          cyan: '#06b6d4',
          'cyan-dim': '#0891b2',
          pink: '#ec4899',
          'pink-dim': '#db2777',
          green: '#22c55e',
          yellow: '#eab308',
        },
        border: {
          glow: 'rgba(168,85,247,0.4)',
          subtle: 'rgba(168,85,247,0.15)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-purple': '0 0 20px rgba(168,85,247,0.4), 0 0 40px rgba(168,85,247,0.2)',
        'neon-cyan': '0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.2)',
        'neon-pink': '0 0 20px rgba(236,72,153,0.4), 0 0 40px rgba(236,72,153,0.2)',
        'neon-green': '0 0 20px rgba(34,197,94,0.4), 0 0 40px rgba(34,197,94,0.2)',
        'neon-subtle': '0 0 10px rgba(168,85,247,0.2)',
        'card-glow': '0 4px 32px rgba(168,85,247,0.12), inset 0 1px 0 rgba(168,85,247,0.1)',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(168,85,247,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,85,247,0.05) 1px, transparent 1px)`,
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(168,85,247,0.2) 0%, transparent 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(6,182,212,0.04) 100%)',
        'purple-glow': 'radial-gradient(circle at center, rgba(168,85,247,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': {
            textShadow: '0 0 10px #a855f7, 0 0 20px #a855f7, 0 0 40px #a855f7',
            filter: 'brightness(1)',
          },
          '50%': {
            textShadow: '0 0 20px #a855f7, 0 0 40px #a855f7, 0 0 80px #a855f7',
            filter: 'brightness(1.2)',
          },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(168,85,247,0.4)' },
          '50%': { borderColor: 'rgba(6,182,212,0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'border-glow': 'border-glow 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'ticker': 'ticker 20s linear infinite',
      },
    },
  },
  plugins: [],
};
