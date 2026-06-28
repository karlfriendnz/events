import { defineConfig } from 'vitest/config'

// Unit tests only — isolated from the Nuxt runtime. Pure logic (preset resolver,
// helpers) lives in composables and is imported directly.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
