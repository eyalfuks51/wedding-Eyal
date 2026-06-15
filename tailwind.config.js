/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  corePlugins: {
    // Disable Tailwind's CSS reset — global.scss already handles base styles
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        brand:   ['Polin', 'Heebo', 'sans-serif'],
        danidin: ['Danidin', 'Polin', 'sans-serif'],
      },
      // Values mirror the CSS vars in src/styles/global.scss (single palette source).
      // Migrated warm → cool lavender/violet/ink. OKLCH strings keep Tailwind utilities
      // in exact lockstep with the :root tokens (no hex-conversion drift).
      colors: {
        paper:    { DEFAULT: 'oklch(97% 0.012 292)', 2: 'oklch(95% 0.02 292)', 3: 'oklch(93% 0.026 292)' },
        // Whitest card face — alpha-aware so `bg-surface/85` yields translucent glass. Mirrors --surface-solid.
        surface:  'oklch(99.7% 0.006 292 / <alpha-value>)',
        ink:      { DEFAULT: 'oklch(22% 0.04 286)', soft: 'oklch(41% 0.035 286)', mute: 'oklch(57% 0.03 286)' },
        line:     'oklch(86% 0.025 292)',
        champagne:{ DEFAULT: 'oklch(80% 0.05 292)', soft: 'oklch(92% 0.04 292)' },
        'rose-gold': { DEFAULT: 'oklch(52% 0.22 292)', soft: 'oklch(92% 0.045 292)' },
        sage:     { DEFAULT: 'oklch(52% 0.13 150)', soft: 'oklch(91% 0.05 150)' },
        apricot:  { DEFAULT: 'oklch(58% 0.12 70)', soft: 'oklch(91% 0.055 75)' },
        clay:     { DEFAULT: 'oklch(55% 0.17 25)', soft: 'oklch(91% 0.06 22)' },
      },
    },
  },
  plugins: [],
};
