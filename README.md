# v5md

[![CI](https://github.com/zyw/v5md/actions/workflows/ci.yml/badge.svg)](https://github.com/zyw/v5md/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@v5md/view?label=%40v5md%2Fview)](https://www.npmjs.com/package/@v5md/view)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

所见即所得 Markdown 编辑器。**Markdown 字符串是唯一数据源**：输入、粘贴和工具条命令都只改这段字符串，再重新解析、重绘页面。光标进入某个块或行内格式时才显示对应 Markdown 标记，离开后只保留排版结果。

同一套编辑器可以嵌进 Vue 3 和 React，也可以直接挂到任意 DOM 元素上。不依赖框架、不接管你的数据流、不生成私有格式——存下来的就是标准 Markdown。

当前版本 `0.0.2`，六个包都已发布在 [npm 官方仓库](https://www.npmjs.com/package/@v5md/view)，并且都是 ESM（`"type": "module"`）。

## 目录

- [为什么用它](#为什么用它)
- [快速开始](#快速开始)
- [常用 API](#常用-api)
- [插件](#插件)
- [插件开发](#插件开发)
- [主题与样式](#主题与样式)
- [快捷键](#快捷键)
- [只做解析](#只做解析)
- [浏览器与依赖](#浏览器与依赖)
- [常见问题](#常见问题)
- [项目与贡献](#项目与贡献)

## 为什么用它

| | |
| --- | --- |
| **数据就是 Markdown** | 没有 HTML 模型和私有 JSON。`getMarkdown()` 拿到的是可以直接入库、走 diff、交给别的 Markdown 渲染器的字符串。 |
| **标记按需显形** | 平时看到的是排版结果；光标落在标题、粗体、代码块上时才露出 `#`、`**`、围栏，改完自动收回去。 |
| **中文输入法友好** | 组合输入期间不重绘 DOM，不会出现候选框错位、拼音上屏丢字。 |
| **粘贴即转换** | 从网页、Word、飞书复制的富文本，先转成 Markdown 再写入文档。 |
| **不锁死框架** | `@v5md/vue`、`@v5md/react` 只是薄壳，核心是 `@v5md/view` 里的 `Editor` 类。 |
| **可插拔** | 工具条按钮、命令、对外 API 都能由插件提供；官方插件目前覆盖字号和导出。 |

支持的内容：段落与一到六级标题、粗体/斜体/下划线/删除线/`==高亮==`/行内代码/链接、有序列表/无序列表/任务列表/引用、围栏代码块（语法高亮）、表格（含对齐）、分割线、图片（可拖拽缩放）、行内公式与公式块（KaTeX）、Mermaid 图表、文首 YAML frontmatter。

编辑能力：撤销重做、查找替换（支持正则与全词）、带语法高亮和行号的整篇源码模式、大纲跳转、表格行列编辑、图片上传、一键复制为公众号富文本、插件扩展。

### 工作方式

```text
输入 / 粘贴 / 工具条 / 快捷键
        │
        ▼
  改 Markdown 字符串（带撤销历史）
        │
        ▼
  micromark / mdast 解析成带偏移的节点树
        │
        ▼
  只重绘文档区，并把光标放回对应偏移
```

选区用字符串偏移 `{ anchor, head }` 表示，不是 DOM Range；`marker` 节点对应 `#`、`**`、围栏这些源码符号，偏移与原文严格一致，视图据此决定何时把标记画出来。

## 快速开始

### 安装

从 npm 官方仓库安装，不需要登录，也不需要配置私有源。按用法选一个装。`pnpm`、`yarn` 换对应的安装命令即可，包名相同。

```bash
# Vue 3。会同时装上 @v5md/view 和 @v5md/core
npm install vue @v5md/vue

# React。同样会带上 view 和 core；react、react-dom 要自己装
npm install react react-dom @v5md/react

# 原生 JS / 其他框架
npm install @v5md/view

# 只解析 Markdown，不画页面
npm install @v5md/core

# 可选。字号、导出都要单独装，编辑器不会自带
npm install @v5md/plugin-typography @v5md/plugin-export
```

| 包 | 什么时候装 |
| --- | --- |
| [`@v5md/vue`](https://www.npmjs.com/package/@v5md/vue) | Vue 3 项目。peer dependency 是 `vue@^3.4` |
| [`@v5md/react`](https://www.npmjs.com/package/@v5md/react) | React 项目。peer dependency 是 `react`、`react-dom` 18 或 19 |
| [`@v5md/view`](https://www.npmjs.com/package/@v5md/view) | 直接 `new Editor()`。框架包依赖它，一般不用再单独声明 |
| [`@v5md/core`](https://www.npmjs.com/package/@v5md/core) | 只要 `parse`、大纲或编辑状态，不创建编辑器 |
| [`@v5md/plugin-typography`](https://www.npmjs.com/package/@v5md/plugin-typography) | 要改正文字号 |
| [`@v5md/plugin-export`](https://www.npmjs.com/package/@v5md/plugin-export) | 要导出 Markdown、HTML、PDF 或图片 |

主题要在业务代码里引入一次，否则只有结构没有排版：

```ts
import '@v5md/view/theme.css'
```

KaTeX、lowlight、mermaid 随 `@v5md/view` 一起安装，不用额外处理；`katex/dist/katex.min.css` 由 `@v5md/view` 入口自动引入。

本机 `~/.npmrc` 里如果写了 `@v5md:registry` 指向公司仓库，上面的安装会走那个地址，而不是 npmjs.org。使用官方仓库时删掉这一行。从公司仓库安装的步骤见 [发布教程](发布教程.md)。

装好之后：

1. 全站引入一次 `@v5md/view/theme.css`。
2. Vue 用下一节的 `V5Editor` 和 `v-model`。React 用 `value` / `onChange`。其他框架用 `new Editor({ element })`。
3. 要用字号或导出时，再安装对应插件，传给 `plugins` 或 `editor.use()`，见[插件](#插件)。

### Vue 3

`V5Editor` 用 `v-model` 双向绑定 Markdown。

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'

const markdown = ref('# 标题\n')
const editor = shallowRef<Editor | null>(null)
</script>

<template>
  <V5Editor
    v-model="markdown"
    placeholder="开始编写…"
    :on-upload-image="(file) => URL.createObjectURL(file)"
    :on-ready="(instance) => (editor = instance)"
  />
  <button type="button" @click="editor?.undo()">撤销</button>
</template>
```

| 属性 | 说明 |
| --- | --- |
| `v-model` / `modelValue` | Markdown 全文。外部改成不同字符串时会整篇替换并重置历史 |
| `placeholder` | 空文档提示 |
| `editable` | 是否可编辑，默认 `true`；`false` 进入只读预览，预览下待办复选框仍可切换 |
| `plugins` | 插件数组，见[插件](#插件) |
| `onUploadImage` | 选择或粘贴图片时调用，返回图片地址或 `Promise<string>` |
| `onPickImage` | 点击工具条图片按钮时调用；返回 `false` 时改用系统文件选择框 |
| `onFindRequest` | 按 Mod+F / Mod+H 时收到查找或替换请求；不传则打开内置查找栏 |
| `onReady` | 挂载完成后拿到 `Editor` 实例 |

组件卸载时会自动 `destroy()`。根元素带 `v5md-host` 类，传入的 `class` 和属性会落到这个元素上。

### React

`V5Editor` 由 `value` 和 `onChange` 受控，编辑器只在挂载时创建一次。

```tsx
import { useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import '@v5md/view/theme.css'

export function Page() {
  const [markdown, setMarkdown] = useState('# 标题\n')
  const [, setEditor] = useState<Editor | null>(null)

  return (
    <V5Editor
      value={markdown}
      onChange={setMarkdown}
      placeholder="开始编写…"
      onReady={setEditor}
      onUploadImage={(file) => URL.createObjectURL(file)}
    />
  )
}
```

| 属性 | 说明 |
| --- | --- |
| `value` / `onChange` | 当前 Markdown 与变更回调 |
| `placeholder` | 空文档提示 |
| `className` | 加在宿主元素上（宿主同时带 `v5md-host`） |
| `editable` | 是否可编辑，默认 `true` |
| `plugins` | 插件数组 |
| `onUploadImage` / `onPickImage` / `onFindRequest` / `onReady` | 同 Vue |

`editable` 和 `placeholder` 的后续变化会同步到实例；其余回调只在创建时读取，改函数体即可（内部用 ref 转发，不会重建编辑器）。

### 原生 JS / 其他框架

页面上放一个空元素，创建 `Editor`：

```ts
import { Editor } from '@v5md/view'
import '@v5md/view/theme.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# 标题\n\n正文',
  placeholder: '开始编写…',
  toolbar: true,
  outline: true,
  onChange(markdown) {
    localStorage.setItem('draft', markdown)
  },
  onUploadImage(file) {
    return URL.createObjectURL(file)
  },
})

// 卸载时
editor.destroy()
```

`toolbar` 和 `outline` 默认都显示，传 `false` 可以关掉；之后也能用 `setToolbarVisible()` / `setOutlineVisible()` 切换。

## 常用 API

### 创建选项 `EditorOptions`

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `element` | `HTMLElement` | 必填 | 承载编辑器的宿主元素 |
| `value` | `string` | `''` | 初始 Markdown |
| `placeholder` | `string` | — | 空文档提示 |
| `toolbar` | `boolean` | `true` | 是否显示工具条 |
| `outline` | `boolean` | `true` | 是否显示大纲 |
| `lineNumbers` | `boolean` | `true` | 源码模式下是否显示行号 |
| `editable` | `boolean` | `true` | `false` 为只读预览 |
| `plugins` | `V5mdPlugin[]` | — | 创建时安装的插件 |
| `onChange` | `(markdown: string) => void` | — | 文档变化回调 |
| `onUploadImage` | `(file: File) => string \| Promise<string>` | — | 图片上传，返回值写成 `![文件名](地址)` |
| `onPickImage` | `() => void \| false` | — | 接管图片按钮；返回 `false` 用系统选择框 |
| `onFindRequest` | `(request: { kind: 'find' \| 'replace' }) => void` | — | 接管 Mod+F / Mod+H |

### 内容读写

| 方法 | 说明 |
| --- | --- |
| `getMarkdown()` | 当前全文 |
| `setMarkdown(markdown)` | 整篇替换并重置撤销历史 |
| `insertText(text)` | 在光标处插入，返回是否真的改动了文档 |
| `replaceSelection(text)` | 替换当前选区 |
| `wrapSelection(before, after?)` | 用前后缀包裹选区，默认前后缀相同 |
| `focus()` / `focusAt(offset)` | 聚焦，或把光标移到某个字符串偏移并滚到可见区域 |

选区一律用字符串偏移 `{ anchor, head }` 表示，不是 DOM Range，可以在任意时刻记录、比较、恢复。

### 格式命令

```ts
editor.format('heading2')   // 切换块级格式
editor.toggleBold()         // 行内格式
```

`format(command)` 接受：`code`、`table`、`orderedList`、`bulletList`、`taskList`、`quote`、`heading1`、`heading2`、`heading3`、`rule`、`link`、`math`、`inlineMath`。标题、列表、引用是切换语义——已经是该格式时再执行一次就还原。

行内方法：`toggleBold()`、`toggleItalic()`、`toggleUnderline()`、`toggleCode()`、`toggleStrikethrough()`、`toggleHighlight()`。

在代码块、公式块、YAML 里，块级命令不生效；表格里除链接外的块级命令也不生效。

### 查找替换

| 方法 | 说明 |
| --- | --- |
| `openFind()` | 打开内置查找栏 |
| `findNextMatch(query, options?, direction?, advance?)` | 查找下一个，返回 `{ hit, error }` |
| `replaceNextMatch(query, replacement, options?)` | 替换当前命中 |
| `replaceAllMatches(query, replacement, options?)` | 全部替换 |
| `selectFindMatch(from, to)` | 选中并滚动到指定区间 |

`FindOptions` 支持 `caseSensitive`、`wholeWord`、`regexp`。查找高亮用 CSS `::highlight()`，浏览器不支持时静默降级。

### 视图与状态

| 方法 | 说明 |
| --- | --- |
| `setSourceMode(on)` / `toggleSourceMode()` / `isSourceMode()` | 整篇源码模式 |
| `setLineNumbersVisible(on)` / `isLineNumbersVisible()` | 源码模式行号 |
| `setToolbarVisible(on)` / `isToolbarVisible()` | 工具条显隐 |
| `setOutlineVisible(on)` / `isOutlineVisible()` | 大纲显隐 |
| `setEditable(on)` | 运行时切换只读预览 |
| `setPlaceholder(text)` | 运行时改提示语 |
| `getOutline()` | 标题列表 `{ depth, text, start }[]` |
| `getPluginState()` | 状态快照：`markdown`、`selection`、`path`、`editable`、`sourceMode`、`findOpen` 等 |
| `getHostElement()` / `getContentElement()` | 宿主元素 / 正文元素 |

### 导出与剪贴板

| 方法 | 说明 |
| --- | --- |
| `getWechatHtml()` | 转成只带内联样式的 HTML，可直接粘贴到公众号 |
| `copyForWechat()` | 生成并写入剪贴板，返回是否成功 |
| `toWechatHtml(markdown, { baseUrl? })` | 同上的纯函数版本 |
| `copyRichText(html, text)` | 把 HTML 和纯文本写进剪贴板 |
| `htmlToMarkdown(html)` | 粘贴用的 HTML 转 Markdown |

普通复制和公众号复制是分开的：所见即所得模式下复制的是渲染后的内容（不含 Markdown 标记），源码模式下复制完整 Markdown 文本。

### 工具条和大纲单独挂载

想把工具条放到编辑器外面（比如页面顶栏），可以单独创建：

```ts
import { createOutline, createToolbar, createToolbarFromItems } from '@v5md/view'

const bar = createToolbar(
  (command) => editor.runCommand(command), // 内置命令 id
  (file) => editor.insertImageFile(file),
)
document.querySelector('#my-toolbar')!.append(bar)

const outline = createOutline((offset) => editor.focusAt(offset))
outline.update(editor.getOutline())
```

`createToolbarFromItems(items, onCommand, onImage, onPickImage?)` 传入自定义按钮列表，元素结构与插件里的 `V5mdToolbarItem` 同形。

## 插件

插件可以贡献三样东西：工具条按钮、供外部调用的命令、以及插件自己的 API。也可以只给其中一部分——比如只提供 API，不显示任何按钮。

### 官方插件

两个插件都要单独安装，编辑器不会自带：

```bash
npm install @v5md/plugin-typography @v5md/plugin-export
```

| 包 | 作用 | 工具条按钮 |
| --- | --- | --- |
| [`@v5md/plugin-typography`](packages/plugins/typography/README.md) | 调整正文字号 | 无 |
| [`@v5md/plugin-export`](packages/plugins/export/README.md) | 导出 Markdown / HTML / PDF / 图片 | 无 |

两个官方插件都只提供 API，不往工具条里塞按钮：按钮放哪儿、长什么样由页面决定，调用 `handle.api` 即可（两个 playground 就是这么接的，见 [`playground-vue/src/App.vue`](playground-vue/src/App.vue)）。

### 字号插件

```ts
import { createTypographyPlugin } from '@v5md/plugin-typography'

const typography = editor.use(createTypographyPlugin({ defaultSize: 16 }))
typography.api.setFontSize(18)   // 超出范围会抛 RangeError
typography.api.resetFontSize()
```

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `defaultSize` | — | 安装后立即应用的字号（px） |
| `minSize` / `maxSize` | `10` / `40` | 允许范围 |
| `name` | `typography` | 插件名，用于 `requires` 和 `getPlugin` |

API：`setFontSize(px)`、`getFontSize()`、`resetFontSize()`、`getDefaultSize()`。

### 导出插件

```ts
import { createExportPlugin } from '@v5md/plugin-export'

const exporter = editor.use(createExportPlugin({ fileName: 'note', title: '我的文档' }))

await exporter.api.downloadPdf('note')        // 下载 PDF
const html = await exporter.api.exportHtml()  // 完整 HTML 文档
exporter.api.downloadMarkdown('note')         // 下载 .md
```

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `fileName` | `v5md-document` | 默认文件名前缀 |
| `title` | `v5md 文档` | 导出 HTML 的标题 |
| `imageScale` | `2` | 截图倍率 |
| `pdfMargin` | `24` | PDF 页边距（pt） |
| `renderer` | — | 替换 html2canvas / jsPDF 实现，便于测试或换渲染器 |

API：`exportMarkdown()`、`exportHtml()`、`exportHtmlFragment()`、`exportImage(options?)`、`exportPdf(options?)`、`print()`、`downloadMarkdown()`、`downloadHtml()`、`downloadImage()`、`downloadPdf()`。

### 安装、调用与卸载

```ts
import { Editor } from '@v5md/view'
import { createExportPlugin } from '@v5md/plugin-export'

// 1) 创建时安装
const editor = new Editor({ element, plugins: [createExportPlugin()] })

// 2) 运行时安装，拿到句柄
const handle = editor.use(createExportPlugin())
await handle.ready              // 异步 setup 完成后 resolve
handle.api.downloadMarkdown()   // 插件 API
handle.dispose()                // 卸载：执行 cleanup 与 destroy

// 3) 按名字取回
editor.getPlugin('export')?.api

// 4) 执行插件命令（也能执行内置命令）
await editor.runCommand('export.downloadMarkdown')
```

`use()` 是幂等的：同名同实例再调一次返回同一个句柄；同名不同实例直接抛错。`editor.destroy()` 会反序卸载所有插件。

## 插件开发

### 插件对象

```ts
import type { V5mdPlugin } from '@v5md/view'

interface WordCountApi {
  count(): number
}

export function createWordCountPlugin(): V5mdPlugin<WordCountApi> {
  return {
    name: 'word-count',
    version: '0.1.0',
    apiVersion: 1,
    api: (context) => ({
      count: () => context.editor.getMarkdown().replace(/\s+/g, '').length,
    }),
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | 必填且唯一，建议直接用 npm 包名 |
| `version` | 插件自身版本，可选 |
| `apiVersion` | 必须等于 `PLUGIN_API_VERSION`（当前 `1`），否则安装报错 |
| `requires` | 必装依赖的插件名，必须已经安装 |
| `optional` | 可选依赖，不校验，插件内部自己 `getPlugin` |
| `commands` | `Record<string, { run, isEnabled? }>` |
| `toolbar` | 工具条按钮定义数组 |
| `api` | 返回给外部使用的 API 对象 |
| `setup` | 挂载后调用，返回的函数作为清理逻辑，也可以返回 Promise |
| `destroy` | 卸载时调用 |

### 命令与状态

`run(context, ...args)` 收到的 context：

| 字段 | 说明 |
| --- | --- |
| `context.editor` | `Editor` 实例；要实时数据就用它 |
| `context.host` | 宿主元素 |
| `context.state` | 命令执行时的状态快照（`markdown`、`selection`、`path`、`editable`、`sourceMode`、`findOpen`、`toolbarVisible`、`outlineVisible`） |
| `context.insertText` / `replaceSelection` / `wrapSelection` | 受控编辑 |
| `context.focus()` | 聚焦正文 |

`path` 是从光标所在叶子节点到根的数组，适合判断「光标在不在引用/列表/表格里」。

```ts
commands: {
  'callout.toggle': {
    isEnabled: (state) => !state.sourceMode,
    run: ({ editor }) => {
      editor.format('quote')
    },
  },
}
```

### 加一个工具条按钮

```ts
import type { V5mdPlugin } from '@v5md/view'

const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M9 12V7M9 17v-5"/></svg>'

export function createQuoteButtonPlugin(): V5mdPlugin {
  return {
    name: 'quote-button',
    commands: {
      'quote.toggle': {
        run: ({ editor }) => editor.format('quote'),
      },
    },
    toolbar: [
      {
        command: 'quote.toggle',
        label: '引用',
        icon: ICON,
        group: 'block',    // 内置分组：block / list / quote / heading / insert / inline / action
        order: 80,         // 同组内越小越靠前
        type: 'toggle',    // toggle 会按 isActive 写 aria-pressed
        isActive: (state) => state.path.some((node) => node.type === 'blockquote'),
        isDisabled: (state) => !state.editable,
      },
    ],
  }
}
```

按钮字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `command` | 是 | 点击时执行的命令 id，必须已经注册 |
| `label` | 是 | 按钮文案，也是收进「更多」菜单后显示的文字 |
| `icon` | 是 | 按钮内容，可信 SVG / HTML 字符串，只放自己的 |
| `id` | 否 | 默认等于 `command`，全局唯一 |
| `group` | 否 | 默认 `plugin:<插件名>`；用内置分组可插进对应区域：`block`、`list`、`quote`、`heading`、`insert`、`inline`、`action` |
| `order` | 否 | 同组内升序，默认按声明顺序 |
| `type` | 否 | `action`（默认）或 `toggle`；`toggle` 会按 `isActive` 写 `aria-pressed` |
| `isActive` / `isDisabled` | 否 | 接收状态快照，决定按钮是否高亮 / 禁用 |
| `shortcut` | 否 | 目前只是元数据，不会注册真实快捷键 |

工具条会按可用宽度把放不下的按钮收进「更多」菜单，插件按钮和内置按钮一起参与排序。

### 生命周期

```text
new Editor({ plugins })  →  install：校验 name / apiVersion / requires / id 冲突
editor.use(plugin)       →  install：先写注册表，再调用 setup
setup(context)           →  返回值（函数）登记为 cleanup
handle.ready             →  setup 返回 Promise 时，resolve 之后才可用
handle.dispose()         →  cleanup() → destroy() → 移出注册表并重建工具条
editor.destroy()         →  反序卸载所有插件
```

### 约束

- 插件名重复（不同实例）直接报错；**内置命令 id 不能被覆盖**：`code`、`table`、`orderedList`、`bulletList`、`taskList`、`quote`、`heading1`、`heading2`、`heading3`、`rule`、`link`、`math`、`inlineMath`、`bold`、`italic`、`underline`、`inlineCode`、`strike`、`highlight`、`wechat`。
- 命令 id 全局唯一，先装先得。
- 工具条 `id`（默认等于 `command`）全局唯一；`command` 必须已存在（内置或其他插件已注册）。
- `requires` 里的插件必须先安装；`setup` 抛错会回滚本次安装并把错误抛给调用方。
- `context.state` 是快照，长期持有会过期；要实时数据用 `context.editor`。
- 工具条项的 `shortcut` 不会注册快捷键；需要新按键组合时改 `editor/keymap.ts`。

完整设计与实现记录见 [`docs/plugin-design.md`](docs/plugin-design.md)。

## 主题与样式

主题是一个独立 CSS 文件：`@v5md/view/theme.css`。整体引入即可，也可以复制进自己的构建流程。

样式约定：

- 所有选择器以 `.v5md` 开头，类名统一用 `v5-` 前缀，正文规则收进 `.v5md .v5-doc`，所以宿主页面的全局样式不会串进编辑器。
- 编辑器外沿不带圆角，嵌进任何容器都不会和容器的圆角冲突。

覆盖样式时同样从 `.v5md` 开始写：

```css
.v5md .v5-doc {
  font-size: 16px;
  line-height: 1.8;
}

.v5md .v5-doc h1 {
  font-size: 28px;
}

.v5md .v5-toolbar {
  background: #fafafa;
}
```

建议只覆盖颜色、字号、间距三类值。缩进、`display`、`content` 伪元素这些布局属性是光标定位的依据，改了容易出现光标跳位。

## 快捷键

`Mod` 在 macOS 上是 ⌘，其他系统是 Ctrl。

| 按键 | 作用 |
| --- | --- |
| `Mod+B` / `Mod+I` / `Mod+U` | 粗体 / 斜体 / 下划线 |
| `Mod` + 反引号键 | 行内代码 |
| `Mod+~` 或 `Mod+Shift+X` | 删除线 |
| `Mod+=` 或 `Mod+Shift+H` | 高亮 |
| `Mod+K` | 链接 |
| `Mod+Shift+K` / `Mod+Shift+T` | 代码块 / 表格 |
| `Mod+Shift+[` / `Mod+Shift+]` | 有序 / 无序列表 |
| `Mod+Shift+O` / `Mod+Shift+Q` | 任务列表 / 引用 |
| `Mod+1` / `Mod+2` / `Mod+3` | 一 / 二 / 三级标题 |
| `Mod+Z` / `Mod+Shift+Z` / `Mod+Y` | 撤销 / 重做 |
| `Mod+F` / `Mod+H` | 查找 / 替换 |
| `Mod+Shift+S` | 源码模式 |
| `Tab` / `Shift+Tab` | 表格内移动单元格，否则缩进 / 减少缩进 |
| `Enter` / `Shift+Enter` | 新块 / 软换行 |

只读预览下只有查找快捷键生效。

## 只做解析

不需要编辑器、只要解析和编辑能力时装 `@v5md/core`。它不依赖 DOM，可以跑在 Node 里。

```ts
import { createState, outline, parse, plainText } from '@v5md/core'

const tree = parse('# 标题\n\n正文')      // 带 start / end 偏移的节点树
const headings = outline('# 标题\n\n## 下一节')
const text = plainText(tree.children[0]!)  // 去掉标记的纯文本
const state = createState('# 标题\n')       // 编辑状态 + 撤销历史
```

解析基于 micromark / mdast，启用 GFM 删除线、表格、任务列表、文首 YAML 和数学公式；解析后会把空行收成空段落、把 `<u>` 收成 `underline`、把 `==...==` 收成 `highlight`。

编辑函数都是纯函数：输入 state，返回新的 state（含新文档、新选区、新历史）。完整清单见 [`packages/core/README.md`](packages/core/README.md)。

## 浏览器与依赖

- 面向现代浏览器（Chrome / Edge / Safari / Firefox 最近两个大版本），依赖 `contenteditable`、`Clipboard API`、`CSS Highlights`。不支持时查找高亮和富文本剪贴板会降级，编辑本身仍可用。
- 所有包都是 ESM，需要能处理 ESM 的打包器（Vite、webpack 5、Rollup、esbuild）或原生 `import`。
- mermaid 体积较大，只有文档里真的出现图表时才动态加载；KaTeX 和 lowlight 随包安装。
- 构建本仓库需要 Node.js `^20.19.0` 或 `>=22.12.0`（Vite 7 的要求），运行时没有 Node 版本要求。

## 常见问题

**存什么？** `onChange` / `v-model` 给的 Markdown 字符串就是全文，直接存库或发接口。

**怎么只读展示？** `editable: false`。仍是同一个编辑器，公式、图表、表格照常渲染，待办可以勾选。

**怎么拿到实例？** Vue / React 用 `onReady`；原生就是 `new Editor()` 的返回值。

**图片上传怎么接？** `onUploadImage(file)` 返回 URL 字符串或 `Promise<string>`，返回空字符串则不插入。想完全接管按钮（比如打开自己的图库）用 `onPickImage`，返回 `false` 表示仍用系统文件选择框。

**能 SSR 吗？** 可以 import，但编辑器只在浏览器挂载：Vue 组件在 `onMounted`、React 在 `useEffect` 里创建，首屏建议先渲染占位。

**能自定义工具条吗？** 三种方式：用 `createToolbarFromItems()` 自己拼按钮列表；写一个只提供 `toolbar` 的插件；或者 `setToolbarVisible(false)` 关掉内置工具条，把按钮放到页面任意位置调用 `editor.runCommand()`。

**内容会被编辑器改坏吗？** 只重写你实际编辑到的那一段，没碰过的内容原样保留。不放心的话可以先用 `parse()` 校验一遍再写入。

## 项目与贡献

| 包 | 说明 |
| --- | --- |
| [`@v5md/core`](packages/core/README.md) | Markdown 解析与编辑，不接触 DOM |
| [`@v5md/view`](packages/view/README.md) | `contenteditable` 编辑器、工具条、大纲、主题 |
| [`@v5md/vue`](packages/vue/README.md) | Vue 3 组件 |
| [`@v5md/react`](packages/react/README.md) | React 组件 |
| [`@v5md/plugin-typography`](packages/plugins/typography/README.md) | 字号插件 |
| [`@v5md/plugin-export`](packages/plugins/export/README.md) | 导出插件 |

依赖方向：`core ← view ← {vue, react, plugin-*}`。

本地开发：

```bash
npm install
npm run typecheck   # tsc -b
npm run lint
npm test
npm run dev:vue     # http://localhost:5173
npm run dev:react   # http://localhost:5174
```

目录分层、命名、注释语言、提交信息等约定写在 [`CONTRIBUTING.md`](CONTRIBUTING.md)；打包与发布流程见 [`发布教程.md`](发布教程.md)；版本说明见 [`CHANGELOG.md`](CHANGELOG.md)。CI 在 GitHub Actions 上跑 lint、format:check、typecheck、build 和 test。

## 许可

[MIT License](LICENSE) © 2026 zhuyanwei。可自由使用、修改、再分发（含商用），再分发时保留版权声明与许可全文。
