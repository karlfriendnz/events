import type { Config } from 'tailwindcss'
import primeui from 'tailwindcss-primeui'

export default <Config>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './node_modules/primevue/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand-themeable primary. Driven by CSS variables (see assets/css/main.css
        // :root + useBrandTheme()) so a club's connected brand re-themes the whole
        // app at runtime. Defaults to FriendlyManager navy when no brand is set.
        primary: {
          DEFAULT: 'var(--brand-primary)',
          hover:   'var(--brand-primary-hover)',
          light:   'var(--brand-primary-light)',
        },
      },
    },
  },
  plugins: [primeui],
} satisfies Config
