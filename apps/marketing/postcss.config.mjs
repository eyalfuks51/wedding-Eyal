/**
 * PostCSS config for the marketing site.
 *
 * The landing page is plain semantic CSS (BEM-style classes in globals.css) —
 * it does NOT use Tailwind. We declare this config explicitly so Turbopack does
 * not fall back to the repo-root `postcss.config.js`, which loads `tailwindcss`
 * for the Vite app. That root config can't resolve `tailwindcss` from this
 * workspace and breaks `next build`. Empty plugin set = pass CSS through as-is.
 */
const config = {
  plugins: {},
};

export default config;
