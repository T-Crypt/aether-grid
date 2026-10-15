/** @type {import('tailwindcss').Config} */

// Accent colours resolve through CSS custom properties so the seven Aether Grid
// skins (see src/index.css) re-theme the whole console without a rebuild — the
// same contract web/tokens.css uses for the static UI.
const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // deep-space glass base, per the design brief
        space: {
          950: '#04060d',
          900: '#070b16',
          800: '#0b1120',
        },
        acc: rgbVar('--acc'),
        dat: rgbVar('--dat'),
        col: rgbVar('--col'),
        alm: rgbVar('--alm'),
        pan: rgbVar('--pan'),
        bgg: rgbVar('--bgg'),
        ink: {
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
      },
      fontFamily: {
        // Only JetBrains Mono is bundled: the console is monospace end to end.
        // A proportional face would be a second, unused download — the exact
        // dangling `--font-sans: Inter` the static UI already carries.
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.2', letterSpacing: '0.14em' }],
        '3xs': ['9px', { lineHeight: '1.15', letterSpacing: '0.16em' }],
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--acc) / 0.20), 0 0 24px rgb(var(--acc) / 0.10)',
        'glow-strong': '0 0 0 1px rgb(var(--acc) / 0.35), 0 0 32px rgb(var(--acc) / 0.22)',
        panel: '0 1px 0 rgb(var(--acc) / 0.06), 0 18px 48px -24px rgb(0 0 0 / 0.9)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        'flow-sweep': {
          '0%': { backgroundPosition: '-50% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        'flow-sweep': 'flow-sweep 4.5s linear infinite',
        sweep: 'sweep 4.5s linear infinite',
      },
    },
  },
  plugins: [],
}
