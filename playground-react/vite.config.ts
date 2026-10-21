import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@v5md/view/theme.css', replacement: path.resolve(__dirname, '../packages/view/src/theme.css') },
      { find: '@v5md/core', replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@v5md/view', replacement: path.resolve(__dirname, '../packages/view/src/index.ts') },
      { find: '@v5md/react', replacement: path.resolve(__dirname, '../packages/react/src/index.tsx') },
      { find: '@v5md/sample', replacement: path.resolve(__dirname, '../samples/demo.ts') },
    ],
  },
})
