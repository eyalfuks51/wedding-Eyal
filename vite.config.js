import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "@/…" resolves to "src/…" — matches tsconfig paths below
      '@': path.resolve('./src'),
    },
  },
  css: {
    postcss: {
      // Inline PostCSS config so Vite applies it directly, bypassing the
      // postcss-load-config file-resolution step which can silently fail
      // in ESM packages ("type": "module") depending on the installed version.
      plugins: [tailwindcss, autoprefixer],
    },
  },
})
