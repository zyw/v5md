# playground-vue

v5md 的 Vue 3 示例页。左侧是编辑器，右侧是当前 Markdown 源码。

## 启动

在仓库根目录：

```bash
npm install
npm run dev:vue
```

浏览器打开 http://localhost:5173 。端口由 `--strictPort` 固定为 5173。

## 页面上有什么

顶栏可以分别显示或隐藏大纲和工具条，也可以撤销、重做、打开查找，以及在所见即所得和源码模式之间切换。

编辑器通过 `v-model` 绑定 `samples/demo.ts` 里的示例文档。选择或粘贴图片时，用 `FileReader` 读成 data URL 再插入。

Vite 把 `@v5md/core`、`@v5md/view`、`@v5md/vue` 和主题 CSS 指到仓库里的 `src`，把 `@v5md/sample` 指到 `samples/demo.ts`。改这些源文件后，开发服务器会热更新，不必先 `npm run build`。
