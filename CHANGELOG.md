# 更新日志

## Unreleased

## 0.0.4 — 2026-11-12

### 中文

九个包统一升至 `0.0.4`：`core` / `view` / `vue` / `react`，以及 `plugin-typography` / `plugin-export` / `plugin-mermaid` / `plugin-mindmap` / `plugin-echarts`。主页 [https://v5md.v5ai.xin](https://v5md.v5ai.xin)，仓库 [https://github.com/zyw/v5md](https://github.com/zyw/v5md)。英文 README 见 [`README.en.md`](README.en.md)。

**迁移说明（相对 0.0.3）**

` ```mermaid ` 不再由 `@v5md/view` 内置渲染。需要流程图时请安装并注册 `@v5md/plugin-mermaid`，否则围栏会按普通代码块高亮显示。Mindmap / ECharts 同理，按需安装对应官方插件。

```bash
npm install @v5md/plugin-mermaid
```

```ts
import { createMermaidPlugin } from '@v5md/plugin-mermaid'

new Editor({
  element,
  plugins: [createMermaidPlugin()],
})
```

**块渲染与官方图表插件**

插件可通过 `blocks` 接管围栏代码块的渲染、更新与销毁。斜杠菜单与块渲染器均可由插件注册。官方新增三个块插件：

| 包 | 围栏语言 | 作用 |
| --- | --- | --- |
| `@v5md/plugin-mermaid` | `mermaid` | 流程图（从 view 迁出） |
| `@v5md/plugin-mindmap` | `mindmap` | 思维导图 |
| `@v5md/plugin-echarts` | `echarts` | ECharts 图表（JSON 配置） |

**国际化**

内置界面支持 `zh-CN`（默认）与 `en`：`locale` / `setLocale()` / `getLocale()` 覆盖工具条、斜杠菜单、查找栏、大纲、表格条、块菜单等。Vue / React 组件增加 `locale` 属性；官方插件也可传同一 `locale`。

```ts
new Editor({ element, locale: 'en' })
editor.setLocale('zh-CN')
```

**工具条钉顶**

新增 `toolbarSticky` 选项与运行时切换，滚动时可将工具条钉在编辑器顶部。

```ts
new Editor({ element, toolbarSticky: true })
editor.setToolbarSticky(true)
```

**导出增强**

- HTML 导出会把 ECharts 等 canvas 快照成图片，避免克隆后空白。
- PDF 按块边界智能分页，减少列表项 / 图表被拦腰截断；`downloadPdf()` 仍为图片式 PDF 以保证中文不乱码，需要可选中矢量文字请用 `print()`。

**品牌与演示**

补充品牌资产（logo / favicon / 宣传图），playground 接入品牌资源与中英示例内容。

### English

All nine packages are now `0.0.4`: `core` / `view` / `vue` / `react`, plus `plugin-typography` / `plugin-export` / `plugin-mermaid` / `plugin-mindmap` / `plugin-echarts`. Homepage: [https://v5md.v5ai.xin](https://v5md.v5ai.xin). Repository: [https://github.com/zyw/v5md](https://github.com/zyw/v5md). English docs: [`README.en.md`](README.en.md).

**Migration from 0.0.3**

` ```mermaid ` fences are no longer rendered by `@v5md/view`. Install and register `@v5md/plugin-mermaid` for diagrams; otherwise the fence highlights as a normal code block. Mindmap and ECharts follow the same opt-in plugin model.

```bash
npm install @v5md/plugin-mermaid
```

```ts
import { createMermaidPlugin } from '@v5md/plugin-mermaid'

new Editor({
  element,
  plugins: [createMermaidPlugin()],
})
```

**Block rendering and official chart plugins**

Plugins can take over fenced code blocks via `blocks` (render / update / destroy). Slash-menu items and block renderers are both plugin extension points. Three official block plugins ship in this release:

| Package | Fence lang | Role |
| --- | --- | --- |
| `@v5md/plugin-mermaid` | `mermaid` | Flowcharts (moved out of view) |
| `@v5md/plugin-mindmap` | `mindmap` | Mind maps |
| `@v5md/plugin-echarts` | `echarts` | ECharts charts (JSON config) |

**Localization**

Built-in UI supports `zh-CN` (default) and `en` through `locale` / `setLocale()` / `getLocale()` — toolbar, slash menu, find bar, outline, table bar, block menus, and more. Vue / React components accept a `locale` prop; official plugins accept the same option.

```ts
new Editor({ element, locale: 'en' })
editor.setLocale('zh-CN')
```

**Sticky toolbar**

New `toolbarSticky` option and runtime toggle pin the toolbar to the top of the editor while scrolling.

```ts
new Editor({ element, toolbarSticky: true })
editor.setToolbarSticky(true)
```

**Export improvements**

- HTML export snapshots ECharts (and similar) canvases to images so clones are not blank.
- PDF paginates on block boundaries to avoid cutting through list items or charts. `downloadPdf()` remains image-based PDF for reliable CJK glyphs; use `print()` when you need selectable vector text.

**Brand and playground**

Brand assets (logo / favicon / promo art) are included; playgrounds use the brand kit and bilingual sample content.

## 0.0.3 — 2026-11-10

### 中文

相对 `0.0.2` 没有破坏性改动。六个包的版本号一起改为 `0.0.3`，npm 页面上的主页是 [https://v5md.v5ai.xin](https://v5md.v5ai.xin)，仓库地址是 [https://github.com/zyw/v5md](https://github.com/zyw/v5md)。

**链接**

普通点击链接留在编辑器里，不再直接跳走。打开外部链接用右键，或在 macOS 上用 ⌘ + 点击，其他系统用 Ctrl + 点击。只放行 `http`、`https` 和 `mailto`。相对地址和其他协议留在文档内。浏览器里会用新标签页打开，并带上 `noopener noreferrer`。桌面壳（Tauri）里改为调用 `open_external_url`，交给系统浏览器。链接显示下划线，鼠标为指针，悬停提示写在 `title` 上。

**公众号 HTML**

`getWechatHtml({ baseUrl })` 会把相对图片地址解析成绝对地址。不传 `baseUrl` 时，在浏览器里用当前页面的 `document.baseURI`。已经是绝对地址或 `//` 开头的图片地址保持不变。工具条上的「复制到公众号」仍不接收这个参数。

```ts
editor.getWechatHtml({ baseUrl: 'https://example.com/notes/' })
```

### English

No breaking changes from `0.0.2`. All six packages are now `0.0.3`. On npm, the homepage is [https://v5md.v5ai.xin](https://v5md.v5ai.xin) and the repository is [https://github.com/zyw/v5md](https://github.com/zyw/v5md).

**Links**

A plain click stays in the editor. Open an external link with a right-click, or with ⌘+click on macOS and Ctrl+click elsewhere. Only `http`, `https`, and `mailto` leave the document. Relative URLs and other protocols stay inside the note. In a browser the link opens in a new tab with `noopener noreferrer`. In a Tauri shell it calls `open_external_url` so the system browser opens it. Links are underlined, use a pointer cursor, and put the activation hint in `title`.

**WeChat HTML**

`getWechatHtml({ baseUrl })` resolves relative image URLs to absolute ones. When `baseUrl` is omitted, a browser uses the current page's `document.baseURI`. Image URLs that are already absolute, or that start with `//`, are left unchanged. The toolbar action that copies HTML for WeChat does not take this option.

```ts
editor.getWechatHtml({ baseUrl: 'https://example.com/notes/' })
```

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
