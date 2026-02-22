import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Inline PostCSS config so Vite applies it directly, bypassing the
      // postcss-load-config file-resolution step which can silently fail
      // in ESM packages ("type": "module") depending on the installed version.
      plugins: [tailwindcss, autoprefixer],
    },
  },
})
