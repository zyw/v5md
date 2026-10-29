# v5md

所见即所得 Markdown 编辑器。Markdown 字符串是唯一数据源：输入、粘贴和工具条命令都改这段字符串，再重新解析并画回页面。光标进入某个块或行内格式时才显示对应标记，离开后只保留排版结果。

同一套编辑器可以嵌进 Vue 3 和 React，也可以直接挂到任意 DOM 元素上。解析与编辑在 `@v5md/core`，不创建 DOM；页面、工具条、大纲和主题在 `@v5md/view`。

当前版本 `0.0.1`。四个可发布包都是 ESM（`"type": "module"`）。

## 功能

正文支持：

- 段落，以及一到六级标题
- 粗体、斜体、下划线（`<u>`）、行内代码、删除线、`==高亮==`、链接
- 有序列表、无序列表、任务列表、引用
- 围栏代码块（[lowlight](https://github.com/wooorm/lowlight) 的 `common` 语言集，并接受 `ts`、`js`、`py`、`sh`、`yml`、`md`、`vue` 等别名）
- 分割线、图片、表格
- 行内公式 `$...$` 与公式块 `$$...$$`（[KaTeX](https://katex.org/)）
- Mermaid 图表（围栏语言写 `mermaid`，离开编辑后渲染成图，点进去仍是源码）
- 文首 YAML frontmatter

编辑能力包括撤销重做、查找替换、整篇源码模式、大纲跳转、表格行列与对齐、图片上传，以及中文输入法。粘贴的 HTML 会先转成 Markdown 再写入文档。

表格数据行按白、浅灰交替。工具条按钮等分整条宽度。大纲在页面滚动时停在视口顶部。一、二级标题下方有分隔线。图片未聚焦时只显示居中预览；替代文字非空时，预览下方显示这段文字。

## 工作方式

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

选区是字符串偏移 `{ anchor, head }`，不是 DOM Range。`marker` 节点对应 `#`、`**`、围栏等源码符号，偏移与原文一致，视图据此决定何时把标记画出来。

在代码块、公式块或 YAML 里，块级命令不生效。在表格里，除链接外的块级命令也不生效。标题、列表和引用会切换当前行的前缀：已经是该格式时再执行一次就去掉。

## 仓库结构

npm workspaces 包含 `packages/*`、`playground-vue` 和 `playground-react`。根目录 `package.json` 是 `"private": true`，不会被发布。playground 也不发布。

| 目录 | 包名 | 说明 |
| --- | --- | --- |
| [`packages/core`](packages/core/README.md) | `@v5md/core` | 解析与编辑，不接触 DOM |
| [`packages/view`](packages/view/README.md) | `@v5md/view` | `contenteditable` 编辑器、工具条、大纲和主题 |
| [`packages/vue`](packages/vue/README.md) | `@v5md/vue` | Vue 3 组件 `V5Editor` |
| [`packages/react`](packages/react/README.md) | `@v5md/react` | React 组件 `V5Editor` |
| [`playground-vue`](playground-vue/README.md) | `playground-vue` | Vue 示例，端口 5173 |
| [`playground-react`](playground-react/README.md) | `playground-react` | React 示例，端口 5174 |
| [`samples/demo.ts`](samples/demo.ts) | — | 两个示例页共用的示例文档 |
| [`发布教程.md`](发布教程.md) | — | 发到 npm 或 OneDev，以及安装已发布包 |

依赖关系：

```text
@v5md/core
    └── @v5md/view
            ├── @v5md/vue
            └── @v5md/react
```

`@v5md/vue` 的 peer dependency 是 `vue@^3.4.0`。`@v5md/react` 的 peer dependency 是 `react` 与 `react-dom` 的 18 或 19。主题不打进框架包，使用时要单独引入 `@v5md/view/theme.css`。

## 本地开发

示例页使用 Vite 7，需要 Node.js `^20.19.0` 或 `>=22.12.0`，以及 npm。

在仓库根目录执行：

```bash
npm install
npm test
npm run build
```

| 命令 | 作用 |
| --- | --- |
| `npm test` | 用 Vitest（happy-dom）跑 `packages/*/test/**/*.test.ts` |
| `npm run build` | 按 core、view、vue、react 的顺序编译到各自的 `dist` |
| `npm run dev:vue` | 启动 Vue 示例，http://localhost:5173 |
| `npm run dev:react` | 启动 React 示例，http://localhost:5174 |
| `npm run publish:packages` | 测试通过后发到 npm 官方仓库 |
| `npm run publish:onedev` | 测试通过后发到 OneDev |

两个 playground 通过 Vite alias 直接引用各包的 `src` 和 `packages/view/src/theme.css`。改源码后刷新即可看到效果，不必先 `npm run build`。示例页左侧是编辑器，右侧是当前 Markdown；顶栏可以隐藏大纲或工具条，也可以撤销、重做、查找，以及切换源码模式。示例正文来自 `samples/demo.ts`。

单独编译某一个包：

```bash
npm run build -w @v5md/core
npm run build -w @v5md/view
npm run build -w @v5md/vue
npm run build -w @v5md/react
```

`@v5md/view` 的构建会把 `src/theme.css` 复制到 `dist/theme.css`。上传内容只有各包的 `package.json`、`README.md` 和 `dist`。每个包的 `prepublishOnly` 会在发布前执行自己的 `build`。

## 安装

业务项目安装已发布的包，不引用本仓库源码。Vue 项目安装 `@v5md/vue`，React 项目安装 `@v5md/react`。这两个包会带上 `@v5md/view` 和 `@v5md/core`。主题要单独引入，否则只有结构，没有排版。

从 npm 官方仓库：

```bash
npm install vue @v5md/vue
```

```bash
npm install react react-dom @v5md/react
```

从 OneDev 安装时，需要先把 `@v5md` 这个 scope 指到 OneDev 的 npm 仓库。令牌、版本号和中断后续发的步骤见 [发布教程](发布教程.md)。

KaTeX、lowlight、mermaid 随 `@v5md/view` 一起安装。编辑器入口会附带引入 `katex/dist/katex.min.css`。

## 在 Vue 3 里用

`V5Editor` 用 `v-model` 绑定 Markdown 全文。

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'

const markdown = ref('# 标题\n')
const editor = shallowRef<Editor | null>(null)

function onUploadImage(file: File) {
  return URL.createObjectURL(file)
}
</script>

<template>
  <V5Editor
    v-model="markdown"
    placeholder="开始编写…"
    :on-upload-image="onUploadImage"
    :on-ready="(instance) => (editor = instance)"
  />
  <button type="button" @click="editor?.undo()">撤销</button>
</template>
```

| 属性 | 作用 |
| --- | --- |
| `v-model` / `modelValue` | Markdown 全文。外部改成与编辑器不同的字符串时，会整篇替换并重置历史 |
| `placeholder` | 文档为空时的提示 |
| `onUploadImage` | 选择或粘贴图片时调用，返回图片地址，可以是 `Promise<string>` |
| `onReady` | 挂载完成后拿到 `Editor` |

组件销毁时会 `destroy()` 编辑器。根元素带 `v5md-host`，传入的 class 和属性会落到这个元素上。工具条和大纲默认显示。更完整的说明见 [`packages/vue/README.md`](packages/vue/README.md)。

## 在 React 里用

`V5Editor` 由 `value` 和 `onChange` 受控。编辑器只在挂载时创建一次。之后 `value` 与内部全文不同时，才调用 `setMarkdown`。`onChange`、`onUploadImage`、`onReady` 的后续变化不会重建编辑器。

```tsx
import { useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import '@v5md/view/theme.css'

export function Page() {
  const [markdown, setMarkdown] = useState('# 标题\n')
  const [editor, setEditor] = useState<Editor | null>(null)

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

| 属性 | 作用 |
| --- | --- |
| `value` / `onChange` | 当前 Markdown，以及文档变化时的回调 |
| `placeholder` | 空文档提示 |
| `className` | 加在宿主元素上，宿主同时有 `v5md-host` |
| `onUploadImage` | 同 Vue，返回图片地址 |
| `onReady` | 拿到 `Editor` 实例 |

卸载时会 `destroy()`。更完整的说明见 [`packages/react/README.md`](packages/react/README.md)。

## 不用 Vue 或 React

页面上放一个空元素，把主题引入一次：

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
    console.log(markdown)
  },
  onUploadImage(file) {
    return URL.createObjectURL(file)
  },
})
```

`toolbar` 和 `outline` 默认都是显示。传 `false` 可以在创建时关掉。页面卸载时调用 `editor.destroy()`。

`onUploadImage` 的返回值会写成 `![文件名](地址)`。返回空字符串时不插入图片。

常用方法：

| 方法 | 说明 |
| --- | --- |
| `getMarkdown()` / `setMarkdown(markdown)` | 读取或替换全文。`setMarkdown` 会重置历史 |
| `focus()` / `focusAt(offset)` | 聚焦，或把光标移到某个字符串偏移并滚到可见区域 |
| `getOutline()` | 当前标题列表，每项是 `{ depth, text, start }` |
| `undo()` / `redo()` | 撤销、重做 |
| `format(command)` | 块级命令，与 core 的 `FormatCommand` 相同 |
| `toggleBold` / `toggleItalic` / `toggleUnderline` / `toggleCode` / `toggleStrikethrough` / `toggleHighlight` | 行内格式 |
| `insertImageFile(file)` | 走 `onUploadImage` 后插入图片 |
| `openFind()` / `findNext` / `replaceNext` / `replaceAll` | 查找替换 |
| `isSourceMode` / `setSourceMode` / `toggleSourceMode` | 整篇源码模式 |
| `isToolbarVisible` / `setToolbarVisible` | 显示或隐藏工具条 |
| `isOutlineVisible` / `setOutlineVisible` | 显示或隐藏大纲 |
| `destroy()` | 卸下监听并清空元素 |

`FormatCommand`：`code`、`table`、`orderedList`、`bulletList`、`taskList`、`quote`、`heading1`、`heading2`、`heading3`、`rule`、`link`、`math`、`inlineMath`。

页面结构：`.v5md` 里依次是 `.v5-toolbar`、`.v5-outline`、`.v5-doc`。查找栏打开时插在 `.v5md` 顶部。表格获得焦点时，`.v5-tablebar` 出现在表格附近，提供插行、插列、对齐和删除整表。选项、快捷键和单独挂载工具条、大纲的方式见 [`packages/view/README.md`](packages/view/README.md)。

## 只做解析

不画页面时安装 `@v5md/core`。这个包不依赖浏览器。

```ts
import { createState, outline, parse } from '@v5md/core'

const tree = parse('# 标题\n\n正文')
const headings = outline('# 标题\n\n## 下一节\n')
const state = createState('# 标题\n')
```

`parse` 用 micromark / mdast 生成带 `start`、`end` 的 `MdNode` 树。启用的扩展包括 GFM 删除线（双波浪线）、表格、任务列表、文首 YAML，以及数学公式。解析之后还会把空行收成空段落，把 `<u>...</u>` 收成 `underline`，把 `==...==` 收成 `highlight`。

编辑函数都是对字符串的一次替换：算出 `from`、`to` 和要插入的文本，写入历史，再由调用方重新 `parse`。函数列表和节点类型见 [`packages/core/README.md`](packages/core/README.md)。

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

## 发布

发布顺序是 `@v5md/core`、`@v5md/view`、`@v5md/vue`、`@v5md/react`。同一个版本不能发第二次。改完代码后，要把四个包自己的 `version`，以及 view 对 core、vue 和 react 对 view 的依赖版本，一起改成新号。

准备令牌、演练上传文件、中断后续发，以及在业务项目里配置 registry，都写在 [发布教程](发布教程.md)。

## 许可

本仓库采用 [MIT License](LICENSE)。版权所有 (c) 2026 zhuyanwei。可以自由使用、修改和再分发，包括商用；再分发时保留版权声明和许可全文。软件按「原样」提供，不附带任何担保。
