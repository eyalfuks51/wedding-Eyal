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
      colors: {
        paper:    { DEFAULT: '#FAF7F2', 2: '#F4EFE6', 3: '#EDE6D7' },
        ink:      { DEFAULT: '#2A2520', soft: '#6B635A', mute: '#A89F94' },
        line:     '#E8E1D2',
        champagne:{ DEFAULT: '#E8D5B7', soft: '#F2E5CB' },
        'rose-gold': { DEFAULT: '#B76E79', soft: '#D9A6AD' },
        sage:     { DEFAULT: '#7A8466', soft: '#DCE0D1' },
        apricot:  { DEFAULT: '#C97B4A', soft: '#F2DCC8' },
        clay:     { DEFAULT: '#A85B47', soft: '#EBC9BF' },
      },
    },
  },
  plugins: [],
};
