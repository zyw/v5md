# @v5md/react

`@v5md/view` 的 React 封装。组件名是 `V5Editor`，由 `value` 和 `onChange` 受控。

peer dependency 是 `react` 与 `react-dom` 的 18 或 19。样式从 `@v5md/view/theme.css` 引入，本包不打包主题。

## 用法

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

## 属性

| 属性 | 说明 |
| --- | --- |
| `value` | Markdown 全文 |
| `onChange` | 文档变化时收到新全文 |
| `placeholder` | 空文档提示，变化时同步到编辑器 |
| `className` | 加在宿主元素上，宿主同时有 `v5md-host` |
| `editable` | 是否可编辑，默认 `true`。传 `false` 进入只读预览，变化时调用 `setEditable` |
| `onUploadImage` | `(file: File) => string \| Promise<string>` |
| `onPickImage` | 点击工具条图片按钮时调用；返回 `false` 则继续使用系统文件选择框 |
| `onFindRequest` | `(request: { kind: 'find' \| 'replace' }) => void`。不传时按 Mod+F / Mod+H 打开内置查找栏 |
| `onReady` | 挂载完成后拿到 `Editor` 实例 |

编辑器只在挂载时创建一次。之后 `value` 与内部全文不同时，才调用 `setMarkdown`。`onChange`、`onUploadImage`、`onPickImage`、`onFindRequest`、`onReady` 的后续变化不会重建编辑器；`editable` 和 `placeholder` 会直接同步到实例。

`onReady` 得到的实例可以调用 `undo`、`redo`、`openFind`、`setSourceMode`、`setToolbarVisible`、`setOutlineVisible`。工具条和大纲默认显示。卸载时会 `destroy()`。

## 构建

```bash
npm run build -w @v5md/react
```
