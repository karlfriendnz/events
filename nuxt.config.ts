// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const FMPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef1f8',
      100: '#d4ddf0',
      200: '#aabae1',
      300: '#7f96d2',
      400: '#5573c2',
      500: '#2b50b3',
      600: '#1e3e8f',
      700: '#182e59',
      800: '#131f3a',
      900: '#0d1426',
      950: '#070a13',
    },
  },
})

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },

  vite: {
    server: {
      hmr: {
        overlay: false,
      },
    },
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@primevue/nuxt-module',
    '@nuxtjs/supabase',
  ],

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  primevue: {
    options: {
      theme: {
        preset: FMPreset,
        options: {
          darkModeSelector: '.dark',
          cssLayer: {
            name: 'primevue',
            order: 'tailwind-base, primevue, tailwind-utilities',
          },
        },
      },
      ripple: true,
    },
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    redirect: false,
    types: false,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
    clientOptions: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  },

  css: ['~/assets/css/main.css', 'primeicons/primeicons.css'],

  devServer: {
    port: 3002,
  },

  app: {
    head: {
      title: 'FriendlyManager Events',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },
})
