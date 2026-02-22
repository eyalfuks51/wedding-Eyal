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
        // font-brand  → Polin  (body text, labels, UI copy)
        brand:   ['Polin', 'Heebo', 'sans-serif'],
        // font-danidin → Danidin (bold display headings, KPI numbers)
        danidin: ['Danidin', 'Polin', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
