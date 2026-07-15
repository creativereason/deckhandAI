import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.test.{ts,tsx,mjs}', 'scripts/__tests__/**/*.test.mjs', 'app/api/__tests__/**/*.test.ts'],
  },
})
