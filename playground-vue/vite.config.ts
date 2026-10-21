import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@v5md/view/theme.css', replacement: path.resolve(__dirname, '../packages/view/src/theme.css') },
      { find: '@v5md/core', replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@v5md/view', replacement: path.resolve(__dirname, '../packages/view/src/index.ts') },
      { find: '@v5md/vue', replacement: path.resolve(__dirname, '../packages/vue/src/index.ts') },
      { find: '@v5md/sample', replacement: path.resolve(__dirname, '../samples/demo.ts') },
    ],
  },
})
