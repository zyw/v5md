# @v5md/view

把 `@v5md/core` 的 Markdown 画成可编辑页面。宿主给一个元素，`Editor` 把它变成 `contenteditable`，并在内部挂上工具条、大纲和文档区。

```ts
import { Editor } from '@v5md/view'
import '@v5md/view/theme.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# 标题\n\n正文',
  placeholder: '开始编写…',
  onChange(markdown) {
    // markdown 是当前全文
  },
  onUploadImage(file) {
    return URL.createObjectURL(file)
  },
})
```

主题样式要从 `@v5md/view/theme.css` 单独引入。不引的话只有结构，没有排版。

## 选项

| 字段 | 说明 |
| --- | --- |
| `element` | 挂载点，必填 |
| `value` | 初始 Markdown，默认空字符串 |
| `placeholder` | 文档为空时显示的提示 |
| `toolbar` | 是否显示工具条，默认显示 |
| `outline` | 是否显示大纲，默认显示 |
| `lineNumbers` | 源码模式下是否显示左侧行号，默认显示 |
| `editable` | 是否可编辑，默认 `true`；传 `false` 进入只读预览，此时仍可点击待办复选框 |
| `onChange` | 文档变化时回调全文 |
| `onUploadImage` | 工具条选图或粘贴图片时调用，返回图片地址 |
| `onPickImage` | 点击工具条图片按钮时调用；返回 `false` 则继续弹出系统文件选择框 |
| `onFindRequest` | 按 Mod+F / Mod+H 时收到 `{ kind: 'find' \| 'replace' }`；不传则打开内置查找栏 |
| `plugins` | 插件数组，见下面「插件」章节 |

`onUploadImage` 可以返回字符串或 `Promise<string>`。返回值会写成 `![文件名](地址)`。`onPickImage` 适合接管工具条图片按钮，由宿主自己打开图片选择器，再用 `insertImageUrl` 插入地址。

只读预览会禁用正文编辑，但待办复选框仍可点击；切换会修改 Markdown 并触发 `onChange`。

## 方法

| 方法 | 说明 |
| --- | --- |
| `getMarkdown()` / `setMarkdown(markdown)` | 读取或替换全文。`setMarkdown` 会重置历史 |
| `focus()` / `focusAt(offset)` | 聚焦，或把光标移到某个字符串偏移并滚到可见区域 |
| `getOutline()` | 当前标题列表 |
| `undo()` / `redo()` | 撤销、重做 |
| `format(command)` | 块级命令，类型与 core 的 `FormatCommand` 相同 |
| `toggleBold` / `toggleItalic` / `toggleCode` / `toggleStrikethrough` / `toggleHighlight` / `toggleUnderline` | 行内格式 |
| `insertImageFile(file)` | 走 `onUploadImage` 后插入图片 |
| `insertImageUrl(url, alt?)` | 在光标处插入 `![alt](url)` |
| `openFind()` / `findNext` / `replaceNext` / `replaceAll` | 查找替换 |
| `isSourceMode` / `setSourceMode` / `toggleSourceMode` | 整篇源码模式 |
| `isLineNumbersVisible` / `setLineNumbersVisible` | 源码模式左侧行号的显隐 |
| `setEditable(enabled)` | 切换可编辑与只读预览 |
| `setPlaceholder(placeholder)` | 更新空文档提示 |
| `isToolbarVisible` / `setToolbarVisible` | 显示或隐藏工具条 |
| `isOutlineVisible` / `setOutlineVisible` | 显示或隐藏大纲 |
| `getWechatHtml()` | 当前文档对应的公众号内联样式 HTML |
| `copyForWechat()` | 生成公众号 HTML 并复制为富文本，返回是否成功 |
| `getHostElement()` / `getContentElement()` | 根元素 / 正文元素，供插件和导出使用 |
| `getPluginState()` | 当前插件用状态快照 |
| `insertText` / `replaceSelection` / `wrapSelection` | 插件可用的受控编辑方法 |
| `use()` / `getPlugin()` / `runCommand()` | 安装插件、获取插件 API、执行插件命令 |
| `destroy()` | 卸下监听并清空元素 |

## 插件

插件可以贡献工具条按钮，也可以完全不贡献按钮，只提供外部调用的命令或 API。

```ts
import type { V5mdPlugin } from '@v5md/view'

const exportPlugin: V5mdPlugin<{ exportMarkdown(): string }> = {
  name: 'export',
  api: ({ editor }) => ({
    exportMarkdown: () => editor.getMarkdown(),
  }),
}

const calloutPlugin: V5mdPlugin = {
  name: 'callout',
  commands: {
    'callout.note': {
      run({ wrapSelection, state }) {
        if (!state.editable) return
        wrapSelection('> [!NOTE]\n> ', '\n')
      },
    },
  },
  toolbar: [
    {
      command: 'callout.note',
      label: '提示块',
      icon: '<svg viewBox="0 0 24 24"></svg>',
      group: 'insert',
      order: 40,
    },
  ],
}

const editor = new Editor({
  element,
  plugins: [exportPlugin, calloutPlugin],
})

const exportTools = editor.getPlugin<{ exportMarkdown(): string }>('export')!
exportTools.api.exportMarkdown()
```

运行时安装和卸载：

```ts
const handle = editor.use(calloutPlugin)
await handle.ready
handle.dispose()
```

插件字段：

| 字段 | 说明 |
| --- | --- |
| `name` | 插件唯一名，重复安装不同实例会报错 |
| `apiVersion` | 插件 API 版本，当前为 `1` |
| `requires` | 必装依赖的插件名 |
| `toolbar` | 可选，工具条按钮描述 |
| `commands` | 可选，命令表，key 是命令 id |
| `api` | 可选，插件对外 API 工厂 |
| `setup` | 安装后执行，可返回清理函数 |
| `destroy` | 卸载时执行 |

命令可以被外部调用：

```ts
await editor.runCommand('callout.note')
```

插件按钮会和内置按钮一起排序；`group` 使用内置分组时会插入对应区域，使用新分组时追加到内置区域之后。内置按钮和命令定义在 `packages/view/src/builtins.ts`，和插件命令共用同一个 `runCommand` 分发入口；内置命令 id 不能被插件覆盖。

## 复制到公众号

工具条最右侧的「复制到公众号」按钮和 `Editor#copyForWechat()` 走同一条路径：

1. 用 `parse` 解析当前 Markdown；
2. 生成只带内联样式的 HTML，不输出 class、id，也不依赖 `theme.css`；
3. 通过 Clipboard API 同时写入 `text/html` 和 `text/plain`，旧浏览器回退到 `execCommand('copy')`。

直接调用的例子：

```ts
const html = editor.getWechatHtml()
const copied = await editor.copyForWechat()
```

`copyRichText(html, text)` 也可以单独使用，适合自己做复制入口。

支持的格式：段落、一到六级标题、引用、有序/无序/任务列表、粗体、斜体、下划线、删除线、高亮、行内代码、链接、图片（含替代文字）、代码块语法高亮、表格（含对齐和隔行底色）、分割线。

公众号平台的限制仍然存在：

- 公式和 Mermaid 图表暂时以源码代码块保留，因为公众号会丢掉 KaTeX 和 SVG 依赖的样式；
- 图片使用原始 URL，公众号无法访问的外链图片可能需要重新上传；
- 公众号只对白名单链接保留可点击状态，普通外链可能被去掉。

## 页面结构

`.v5md` 是一行换行的 flex 容器，子元素依次是：

- `.v5-toolbar`：占满编辑区宽度，21 个按钮等宽，按组分隔
- `.v5-outline`：`position: sticky`，页面滚动时停在视口顶部
- `.v5-doc`：正文。渲染只改这里

查找栏在打开时插入 `.v5md` 顶部。表格获得焦点时，`.v5-tablebar` 绝对定位在表格附近，提供插行、插列、对齐和删除整表。

源码模式把正文换成一张 `.v5-source-doc`：每个逻辑行是一个 `.v5-source-line`，行号是行内绝对定位的 `.v5-source-number`，长行换行后缩进仍从正文列开始。行内 token 都带 `data-start` / `data-end`，读取选区时仍按 Markdown 字符串偏移计算，所以源码模式和所见即所得模式共用同一套光标、查找替换与撤销逻辑。语法着色使用 `v5-md-*` 类：`v5-md-heading`、`v5-md-strong`、`v5-md-em`、`v5-md-strike`、`v5-md-highlight`、`v5-md-underline`、`v5-md-inline-code`、`v5-md-code`、`v5-md-link`、`v5-md-url`、`v5-md-image`、`v5-md-math`、`v5-md-frontmatter`、`v5-md-html`、`v5-md-rule` 和 `v5-md-marker`。围栏代码块沿用 lowlight 的 `hljs-*` 类。

光标在当前块或行内格式内时，对应的 `#`、`**`、围栏等标记才出现。图片未聚焦时只显示居中预览；替代文字非空时，预览下方显示这段文字。一、二级标题下方有分隔线。表格数据行白、浅灰交替。

公式用 KaTeX 渲染，Mermaid 代码块离开编辑后渲染成图。两者点进去都是源码。

## 样式隔离

`theme.css` 是给宿主页面直接引入的，所以样式做了两层收口：

- **选择器前缀**：除 `::highlight(v5-find)` 外，每条规则都以编辑器根类 `.v5md` 开头。主题不会作用到编辑器以外的元素；正文规则再收进 `.v5md .v5-doc`，比宿主常见的 `.prose h1`、`.article p` 多一层类名权重。
- **类名前缀**：编辑器产生的类名统一以 `v5` 开头（`.v5-doc`、`.v5-toolbar`、`.v5-active`、`.v5-marker`……）。宿主项目里的 `.is-active`、`.md-marker` 之类通用类名不会命中编辑器内部。
- **外壳直角**：编辑器外沿（工具栏顶部等）不带圆角，方便嵌进任意宿主容器，不会和宿主容器的圆角打架；按钮、菜单、代码块、源码面板等内部元素仍保留圆角。需要整体圆角时由外层容器（可配合 `overflow: hidden`）控制。

正文元素的文字样式（颜色、字体、字号、行高、对齐）显式写在元素上，而不是只靠继承，所以宿主对 `p`、`h1`、`li`、`pre`、`code` 等标签的全局规则也不会覆盖编辑器正文。

需要覆盖主题时，同样从 `.v5md` 开始写选择器：

```css
.v5md .v5-doc h1 { color: #111; }
.v5md .v5-doc p { color: #333; }
.v5md .v5-toolbar { background: #fafafa; }
```

两个例外无法前缀化：

- `::highlight(v5-find)` 是查找命中高亮，自定义高亮名称不受选择器作用域约束；
- 第三方库生成的类名保持原样，包括 lowlight 的 `hljs-*`、KaTeX 的 `katex` 系列和 Mermaid 生成的 SVG 内容。

## 快捷键

`Mod` 在 macOS 上是 ⌘，在其他系统上是 Ctrl。

| 按键 | 作用 |
| --- | --- |
| Mod+B / I / U | 粗体、斜体、下划线 |
| Mod+` | 行内代码 |
| Mod+~ 或 Mod+Shift+X | 删除线 |
| Mod+= 或 Mod+Shift+H | 高亮 |
| Mod+K | 链接 |
| Mod+Shift+K / T | 代码块、表格 |
| Mod+Shift+[ / ] | 有序、无序列表 |
| Mod+Shift+O / Q | 任务列表、引用 |
| Mod+1 / 2 / 3 | 一、二、三级标题 |
| Mod+Z / Shift+Z / Y | 撤销、重做 |
| Mod+F | 查找 |
| Mod+Shift+S | 源码模式 |
| Tab / Shift+Tab | 表格内移动单元格，否则缩进或减少缩进 |

## 单独使用工具条和大纲

`createToolbar(onCommand, onImage)` 和 `createOutline(onJump)` 可以不经过 `Editor` 自己挂载。`Editor` 默认已经创建并管理它们。`htmlToMarkdown` 把粘贴进来的 HTML 转成 Markdown。
