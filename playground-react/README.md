# playground-react

v5md 的 React 示例页。左侧是编辑器，右侧是当前 Markdown 源码。

## 启动

在仓库根目录：

```bash
npm install
npm run dev:react
```

浏览器打开 http://localhost:5174 。端口由 `--strictPort` 固定为 5174。

## 页面上有什么

顶栏可以分别显示或隐藏大纲和工具条，也可以撤销、重做、打开查找，在所见即所得和源码模式之间切换，以及进入/退出预览模式。源码模式下可以单独开关左侧行号。预览模式会关闭正文编辑，但待办复选框仍可点击切换。字号按钮和导出按钮分别来自 `@v5md/plugin-typography` 和 `@v5md/plugin-export`，演示无工具条插件的纯外部 API 用法。

`V5Editor` 的 `value` / `onChange` 绑定 `samples/demo.ts` 里的示例文档。选择或粘贴图片时，用 `FileReader` 读成 data URL 再插入。

Vite 把 `@v5md/core`、`@v5md/view`、`@v5md/react` 和主题 CSS 指到仓库里的 `src`，把 `@v5md/sample` 指到 `samples/demo.ts`。改这些源文件后，开发服务器会热更新，不必先 `npm run build`。
