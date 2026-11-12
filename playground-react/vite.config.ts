import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@v5md/view/theme.css', replacement: path.resolve(__dirname, '../packages/view/src/theme/index.css') },
      { find: '@v5md/core', replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@v5md/view', replacement: path.resolve(__dirname, '../packages/view/src/index.ts') },
      { find: '@v5md/react', replacement: path.resolve(__dirname, '../packages/react/src/index.tsx') },
      { find: '@v5md/plugin-export', replacement: path.resolve(__dirname, '../packages/plugins/export/src/index.ts') },
      {
        find: '@v5md/plugin-typography',
        replacement: path.resolve(__dirname, '../packages/plugins/typography/src/index.ts'),
      },
      {
        find: '@v5md/plugin-echarts',
        replacement: path.resolve(__dirname, '../packages/plugins/echarts/src/index.ts'),
      },
      {
        find: '@v5md/plugin-mermaid',
        replacement: path.resolve(__dirname, '../packages/plugins/mermaid/src/index.ts'),
      },
      {
        find: '@v5md/plugin-mindmap',
        replacement: path.resolve(__dirname, '../packages/plugins/mindmap/src/index.ts'),
      },
      { find: '@v5md/sample', replacement: path.resolve(__dirname, '../samples/demo.ts') },
      { find: '@v5md/playground-ui', replacement: path.resolve(__dirname, '../samples/playground-ui.ts') },
    ],
  },
})
