# 更新日志

## 0.0.2 — 2026-11-09

首次发布。六个包都在 npm 官方仓库，许可为 MIT。主页：[https://v5md.v5ai.xin](https://v5md.v5ai.xin)。源码：[https://github.com/zyw/v5md](https://github.com/zyw/v5md)。

这是一个所见即所得 Markdown 编辑器。文档只有一份 Markdown 字符串：输入、粘贴和工具条都改这段字符串，再重新解析、重绘。光标进入标题、粗体、代码块时才露出对应标记，离开后只保留排版。存下来的就是标准 Markdown，没有私有 JSON。

### 安装

```bash
npm install vue @v5md/vue
npm install react react-dom @v5md/react
npm install @v5md/view
npm install @v5md/core
npm install @v5md/plugin-typography @v5md/plugin-export
```

`@v5md/vue` 需要 `vue@^3.4`。`@v5md/react` 需要 `react` / `react-dom` 18 或 19。主题单独引入一次：`import '@v5md/view/theme.css'`。

### 包

| 包 | 作用 |
| --- | --- |
| `@v5md/core` | 解析和编辑 Markdown，不依赖 DOM，可在 Node 里用 |
| `@v5md/view` | `contenteditable` 编辑器、工具条、大纲、主题 |
| `@v5md/vue` | Vue 3 组件 `V5Editor`，`v-model` 绑定全文 |
| `@v5md/react` | React 组件 `V5Editor`，`value` / `onChange` 受控 |
| `@v5md/plugin-typography` | 正文字号 |
| `@v5md/plugin-export` | 导出 Markdown、HTML、PDF、图片 |

六个包都是 ESM（`"type": "module"`）。`view` 依赖 `core`；`vue`、`react` 和两个插件依赖 `view`。

### 编辑

- 撤销、重做。选区用字符串偏移表示，和原文对齐。
- 查找、替换，支持正则和全词匹配。
- 整篇源码模式，带语法高亮和行号。所见即所得模式下复制的是渲染结果，源码模式下复制完整 Markdown。
- 只读预览。公式、图表、表格照常渲染，待办复选框仍可切换。
- 中文输入法组合期间不重绘，避免候选框错位和丢字。
- 从网页、Word、飞书粘贴富文本时，先转成 Markdown 再写入。
- 行首输入 `/` 打开斜杠命令。块左侧有操作手柄，可转换块类型、上下移动和删除。
- 空列表项按回车退出列表。空代码块会补上围栏。
- 图片可上传，也可按 Markdown 里的尺寸拖拽缩放。
- 工具条放不下的按钮收进「更多」菜单。
- 一键复制为只带内联样式的 HTML，可粘贴到公众号。
- 大纲按标题跳转。表格可增删行列、设置对齐。

### 能写的内容

段落，一到六级标题，粗体、斜体、下划线、删除线、`==高亮==`、行内代码、链接，有序列表、无序列表、任务列表、引用，围栏代码块（语法高亮），表格（含对齐），分割线，图片，`$...$` 行内公式和 `$$...$$` 公式块（KaTeX），Mermaid 图表，文首 YAML frontmatter。

解析在 `@v5md/core`，基于 micromark / mdast。空行会收成空段落，`<u>` 收成下划线，`==...==` 收成高亮。

### 插件

插件可以提供工具条按钮、命令和自己的 API。官方插件不往工具条里放按钮，由页面调用：

- 字号：`setFontSize`、`getFontSize`、`resetFontSize`。默认允许 10–40px。
- 导出：Markdown、带内联样式的 HTML 片段、完整 HTML 文档、PNG / JPEG、PDF，以及浏览器打印。公式保留 KaTeX 排版，Mermaid 保留渲染后的 SVG。PDF 和图片依赖在调用时才加载。

### 运行环境

面向 Chrome、Edge、Safari、Firefox 最近两个大版本，使用 `contenteditable`、Clipboard API 和 CSS Highlights。查找高亮或富文本剪贴板不可用时会降级，编辑本身仍可用。业务项目需要能处理 ESM 的打包器，例如 Vite、webpack 5、Rollup、esbuild。

### 这个版本的限制

- PDF 默认是图片式 PDF，文字不能选中。需要可选中文字时，用导出插件的 `renderer.pdf` 换实现，或走 `print()` 用浏览器的「另存为 PDF」。
- Mermaid 体积较大，文档里出现图表时才加载。
- 工具条按钮上的 `shortcut` 字段只作说明，不会注册快捷键。
