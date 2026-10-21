# @v5md/core

Markdown 的解析和编辑。这个包不创建 DOM，也不依赖浏览器。`@v5md/view` 在它上面画编辑器。

每次编辑都是对 Markdown 字符串的一次替换：算出 `from`、`to` 和要插入的文本，写入历史，再交给调用方重新 `parse`。

## 构建

```bash
npm run build -w @v5md/core
```

产物在 `dist/`，入口是 `dist/index.js`，类型是 `dist/index.d.ts`。

## 解析

`parse(markdown)` 用 micromark / mdast 生成带 `start`、`end` 的 `MdNode` 树。启用的扩展：

- GFM 删除线（双波浪线）、表格、任务列表
- 文首 YAML frontmatter
- `$...$` 行内公式和 `$$...$$` 公式块

解析之后还会补上这些节点：

- 空行变成空段落，方便光标落在块与块之间
- `<u>...</u>` 收成 `underline`
- `==...==` 收成 `highlight`

`outline(markdown)` 返回标题列表，每项是 `{ depth, text, start }`。`start` 指向标题正文，供大纲点击后把光标放进去。

`pathAt(tree, offset, docLength)` 返回包含该偏移的节点路径，工具条用它判断当前是粗体、标题还是列表。

## 编辑

`createState(markdown)` 得到 `{ doc, selection, history }`。选区是字符串偏移 `{ anchor, head }`。

常用函数：

| 函数 | 作用 |
| --- | --- |
| `insertText` / `deleteBackward` / `deleteForward` | 输入和删除 |
| `splitBlock` / `insertSoftBreak` | 分段、段内换行 |
| `toggleMark` | `**`、`*`、`` ` ``、`~~`、`==` |
| `toggleUnderline` | `<u>` |
| `formatBlock` | 块级命令，见下方 `FormatCommand` |
| `editTable` | 表格行列、对齐、删除整表 |
| `moveTableCaret` | Tab 在单元格之间移动 |
| `toggleTask` | 切换任务勾选 |
| `findMatch` / `replaceAllText` | 查找与全部替换 |
| `indent` / `outdent` | 列表缩进 |
| `undo` / `redo` | 按历史记录回放 |

`FormatCommand`：`code`、`table`、`orderedList`、`bulletList`、`taskList`、`quote`、`heading1`、`heading2`、`heading3`、`rule`、`link`、`math`、`inlineMath`。

在代码块、公式块或 YAML 里，块级命令不生效。在表格里，除链接外的块级命令也不生效。标题、列表和引用会切换当前行的前缀：已经是该格式时再执行一次就去掉。

`TableCommand`：`insertRowAbove`、`insertRowBelow`、`deleteRow`、`insertColumnLeft`、`insertColumnRight`、`deleteColumn`、`alignLeft`、`alignCenter`、`alignRight`、`deleteTable`。

## 类型

`MdNode.type` 包括 `paragraph`、`heading`、`blockquote`、`list`、`listItem`、`code`、`thematicBreak`、`strong`、`emphasis`、`inlineCode`、`strikethrough`、`highlight`、`underline`、`link`、`image`、`table`、`tableRow`、`tableCell`、`math`、`inlineMath`、`yaml`，以及 `text`、`marker`、`html`、`hardBreak`。

`marker` 节点对应 `#`、`**`、围栏等源码符号，偏移和原文一致，视图层据此决定何时把标记画出来。
