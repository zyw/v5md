# v5md

所见即所得 Markdown 编辑器。Markdown 字符串是唯一数据源：输入、粘贴和工具条命令都改这段字符串，再重新解析并画回页面。光标进入某个块或行内格式时才显示对应标记，离开后只保留排版结果。

同一套编辑器可以嵌进 Vue 和 React。

## 仓库结构

| 目录 | 包名 | 说明 |
| --- | --- | --- |
| [`packages/core`](packages/core/README.md) | `@v5md/core` | 解析与编辑，不接触 DOM |
| [`packages/view`](packages/view/README.md) | `@v5md/view` | `contenteditable` 编辑器、工具条、大纲和主题 |
| [`packages/vue`](packages/vue/README.md) | `@v5md/vue` | Vue 3 组件 `V5Editor` |
| [`packages/react`](packages/react/README.md) | `@v5md/react` | React 组件 `V5Editor` |
| [`playground-vue`](playground-vue/README.md) | `playground-vue` | Vue 示例，端口 5173 |
| [`playground-react`](playground-react/README.md) | `playground-react` | React 示例，端口 5174 |
| `samples/demo.ts` | — | 两个示例页共用的示例文档 |

npm workspaces 包含 `packages/*`、`playground-vue` 和 `playground-react`。

## 脚本

在仓库根目录执行：

```bash
npm install
npm test
npm run build
npm run dev:vue
npm run dev:react
```

- `npm test` 用 Vitest 跑 `packages/*/test/**/*.test.ts`。
- `npm run build` 按 core、view、vue、react 的顺序编译到各自的 `dist`。
- 两个 playground 通过 Vite alias 直接引用各包的 `src`，改源码后刷新即可看到效果。

## 支持的内容

段落、一到六级标题、粗体、斜体、下划线（`<u>`）、行内代码、删除线、`==高亮==`、链接、有序列表、无序列表、任务列表、引用、围栏代码块（语法高亮）、分割线、图片、表格、行内公式与公式块（KaTeX）、Mermaid 图表、文首 YAML。

编辑能力包括撤销重做、查找替换、整篇源码模式、大纲跳转、表格行列与对齐、图片上传，以及中文输入法。

表格数据行按白、浅灰交替。工具条按钮等分整条宽度。大纲在页面滚动时停在视口顶部。
