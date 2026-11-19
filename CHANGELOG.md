# 更新日志

## 0.0.8 — 2026-11-19

### 中文

十个包统一升至 `0.0.8`。本次更新聚焦主题与示例，并首发视频插件。

**新增**

- 新增 Catppuccin Latte 与 Rosé Pine Dawn 两套内置浅色主题，内置主题增至十一套。两套主题覆盖全部 `--v5-*` 变量，浅色主题由此前的三套增加到五套。
- 两个 playground 的主题菜单按「浅色 / 深色」分组，每个选项前的圆点直接标出主题明暗。
- 英文示例文档补齐到与中文示例逐节对应：表格、任务列表、公式、代码块、Mermaid 流程图与时序图、视频、思维导图与全部 ECharts 图表都已加入，两份示例的章节、代码块与表格一一对齐。
- `@v5md/plugin-video`：把 ` ``video ` / ` ``audio ` 围栏块渲染成浏览器原生播放器，不引入任何第三方依赖。围栏正文支持直接写地址、Markdown 链接、`src=... poster=... title=... start=42s` 参数行或 JSON。
- 标题随播放器显示并作为 `aria-label`；`start` 在播放器上以 `0:42` 角标出现，点一下从该处播放；播放中只改周边文字不会重新加载视频。
- 不能内嵌的地址（B 站 / YouTube 等分享页）和浏览器不支持的格式显示成带封面的块：说明原因、保留地址，播放按钮直接打开源地址。播放中途解码失败同样回退到封面。
- 工具条「视频」「音频」、斜杠菜单与命令 `video.insert`、API `insert(src, options)`；两个 playground 与示例文档已接入。
- `packages/view/src/theme/` 增加 `video.css`，随 `theme.css` 一起下发，各内置主题自动跟随。

### English

All ten packages are now on `0.0.8`. This release focuses on themes and samples, and ships the video plugin.

**Features**

- Added two built-in light themes, Catppuccin Latte and Rosé Pine Dawn, bringing the built-in count to eleven. Both cover every `--v5-*` variable, taking the light set from three themes to five.
- The theme menu in both playgrounds is grouped into Light and Dark, with a swatch that shows each theme's scheme at a glance.
- The English sample document now mirrors the Chinese one section by section: tables, task lists, math, code blocks, Mermaid flowcharts and sequence diagrams, video, mindmap and every ECharts chart are included, with headings, code fences and tables matching one to one.
- `@v5md/plugin-video` renders ` ``video ` / ` ``audio ` fences as native players with no third-party dependency. A fence body can be a bare URL, a Markdown link, a `src=... poster=... title=... start=42s` option line, or JSON.
- The title renders under the player and doubles as its `aria-label`; `start` shows as a `0:42` chip that seeks and plays; editing nearby text never reloads the video.
- Sources that cannot be embedded (Bilibili / YouTube share pages) and unsupported formats render as a cover that states why, keeps the URL, and links the play button to the source. A decode failure mid-playback falls back to the same cover.
- “Video” / “Audio” toolbar items, slash entries, the `video.insert` command and the `insert(src, options)` API; both playgrounds and the sample documents are wired up.
- New `packages/view/src/theme/video.css` ships inside `theme.css` and follows every built-in theme.

## 0.0.7 — 2026-11-18

### 中文

九个包统一升至 `0.0.7`。本次更新聚焦列表 / 引用的批量行操作与任务列表对齐。

**新增**

- 列表与引用命令支持多行选区：选中多行后执行有序列表、无序列表、任务列表或引用，选区覆盖的每一行都会被一次性转换，合并为单次编辑，撤销一步即可还原。
- 部分选中的行（选区起点或终点落在行中间）同样按整行处理，符合「选中几段就转换几段」的直觉。

**修复**

- 修复选中多行后执行列表 / 引用命令只作用于光标所在行、其余行没有变化的问题。
- 修复任务列表项的复选框比相邻的无序列表、有序列表缩进更深、三种列表左边缘对不齐的问题：复选框现在放入列表标记槽位，三种列表的文字起点一致。

### English

All nine packages are now on `0.0.7`. This release focuses on multi-line list / quote commands and task-list alignment.

**Features**

- List and quote commands now handle multi-line selections: with several lines selected, the ordered list, bullet list, task list and quote commands convert every touched line in a single edit, so one undo restores the original document.
- Partially selected lines (a selection starting or ending mid-line) are treated as whole lines, matching the "convert whatever you selected" expectation.

**Fixes**

- Fixed list / quote commands applying only to the caret line when multiple lines were selected, leaving the rest of the selection untouched.
- Fixed task-list checkboxes being indented deeper than neighbouring bullet and ordered lists, so the three list kinds did not line up: the checkbox now sits in the list-marker slot and all three start their text at the same offset.

## 0.0.6 — 2026-11-17

### 中文

九个包统一升至 `0.0.6`。本次更新聚焦表格编辑体验与默认排版。

**修复**

- 修复表格内按 `Shift + 回车` 会把一行拆成两行、破坏表格结构的问题：现在改为以标准 `<br>` 写入单元格并在渲染时显示为真实换行，表格结构保持不变。
- 修复表格单元格内 `Shift + 回车` 后光标没有立即换行、连按两次行数错位的问题。
- 修复退格 / Delete 逐字符删除 `<br>`、露出 `<br` / `<br/>` 残片的问题：现在把 `<br>`（含 `<br/>`、`<br />`）作为一个整体一次删除。
- 修复新建空表格时单元格行高过矮的问题：空单元格改用与有内容单元格一致的 `<br>` 占位。

**新增与变更**

- 默认正文字号由 `17px` 调整为 `15px`（库默认样式与 Vue / React playground 同步）。
- 表格行高略微调小（下调纵向内边距与行高），更紧凑。
- 表格单元格支持 `Shift + 回车` 软换行。
- 调整表格内回车行为：在单元格间移动，在右下角最后一个单元格按回车会跳出表格、在表格下方新建空文本行（与正文回车一致）；`Tab` 在末格仍按惯例新增一行。

### English

All nine packages are now on `0.0.6`. This release focuses on table editing and default typography.

**Fixes**

- Fixed `Shift + Enter` inside a table cell splitting the row in two and breaking the table structure: the break is now written as a standard `<br>` and rendered as a real line break while the table stays intact.
- Fixed the caret not moving to a new line immediately after `Shift + Enter` in a cell, and the wrong line count when pressing it twice.
- Fixed Backspace / Delete removing `<br>` character by character and leaving `<br` / `<br/>` fragments: a `<br>` (including `<br/>` and `<br />`) is now removed as one atomic unit.
- Fixed the too-short cell height of a freshly inserted empty table: empty cells now use a `<br>` placeholder that matches the height of cells with content.

**Features & Changes**

- Lowered the default body font size from `17px` to `15px` (library default styles plus both the Vue and React playgrounds).
- Slightly tightened table row height (reduced vertical padding and line height) for a more compact layout.
- Table cells now support soft line breaks with `Shift + Enter`.
- Adjusted Enter inside tables: it moves between cells, and on the bottom-right last cell it leaves the table and opens a new empty text line below (the same as pressing Enter after body text); `Tab` on the last cell still appends a row as before.

## 0.0.5 — 2026-11-16

### 中文

九个包统一升至 `0.0.5`。本次更新聚焦主题体系：

- 重做 GitHub / Nord / Tokyo Night / Catppuccin 四套内置主题，对齐各自经典的背景、正文与强调色，并让标题使用主题强调色。
- 新增 One Dark、Dracula、Solarized Light、Solarized Dark 四套主题，内置主题增至九套。
- 支持传入任意非空 `theme` id 使用宿主自定义 CSS 主题（新增 `resolveTheme`），并提供完整的《自定义主题》开发文档与变量表。
- 新增 `--v5-heading-fg` 与 `--v5-quote-border` 变量，主题可独立控制标题与引用边框颜色。
- 新增可直接运行的示例主题 [`samples/theme-sunset.css`](samples/theme-sunset.css)。
- 修复两个 Playground 在深色主题下编辑区背景仍为浅色、正文几乎不可读的问题。

### English

All nine packages are now on `0.0.5`. This release focuses on the theming system:

- Reworked the GitHub / Nord / Tokyo Night / Catppuccin themes to match their classic palettes, with accent-colored headings.
- Added One Dark, Dracula, Solarized Light and Solarized Dark, bringing the built-in count to nine.
- `theme` now accepts any non-empty custom id (new `resolveTheme`), backed by the new “Custom themes” guide and full variable reference in the README.
- Added `--v5-heading-fg` and `--v5-quote-border` so themes can control heading color and blockquote border independently.
- Added a ready-to-run sample theme at [`samples/theme-sunset.css`](samples/theme-sunset.css).
- Fixed both playgrounds so dark themes use the theme background instead of a light host panel, which previously made body text nearly unreadable.

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
