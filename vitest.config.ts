import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['packages/*/test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@v5md/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@v5md/view': path.resolve(__dirname, 'packages/view/src/index.ts'),
    },
  },
})
