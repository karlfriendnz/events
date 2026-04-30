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
        primary: {
          DEFAULT: '#1E2157',
          hover:   '#2a2f6e',
          light:   'rgba(30,33,87,0.06)',
        },
      },
    },
  },
  plugins: [primeui],
} satisfies Config
