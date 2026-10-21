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
| `onChange` | 文档变化时回调全文 |
| `onUploadImage` | 工具条选图或粘贴图片时调用，返回图片地址 |

`onUploadImage` 可以返回字符串或 `Promise<string>`。返回值会写成 `![文件名](地址)`。

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
| `openFind()` / `findNext` / `replaceNext` / `replaceAll` | 查找替换 |
| `isSourceMode` / `setSourceMode` / `toggleSourceMode` | 整篇源码模式 |
| `isToolbarVisible` / `setToolbarVisible` | 显示或隐藏工具条 |
| `isOutlineVisible` / `setOutlineVisible` | 显示或隐藏大纲 |
| `destroy()` | 卸下监听并清空元素 |

## 页面结构

`.v5md` 是一行换行的 flex 容器，子元素依次是：

- `.v5-toolbar`：占满编辑区宽度，20 个按钮等宽，按组分隔
- `.v5-outline`：`position: sticky`，页面滚动时停在视口顶部
- `.v5-doc`：正文。渲染只改这里

查找栏在打开时插入 `.v5md` 顶部。表格获得焦点时，`.v5-tablebar` 绝对定位在表格附近，提供插行、插列、对齐和删除整表。

光标在当前块或行内格式内时，对应的 `#`、`**`、围栏等标记才出现。图片未聚焦时只显示居中预览；替代文字非空时，预览下方显示这段文字。一、二级标题下方有分隔线。表格数据行白、浅灰交替。

公式用 KaTeX 渲染，Mermaid 代码块离开编辑后渲染成图。两者点进去都是源码。

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
