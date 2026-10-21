# @v5md/vue

`@v5md/view` 的 Vue 3 封装。组件名是 `V5Editor`，用 `v-model` 绑定 Markdown 字符串。

peer dependency 是 `vue@^3.4.0`。样式仍从 `@v5md/view/theme.css` 引入，本包不打包主题。

## 用法

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
</template>
```

## 属性

| 属性 | 说明 |
| --- | --- |
| `v-model` / `modelValue` | Markdown 全文。外部改成与编辑器不同的字符串时，会调用 `setMarkdown` |
| `placeholder` | 空文档提示 |
| `onUploadImage` | `(file: File) => string \| Promise<string>` |
| `onReady` | 挂载完成后拿到 `Editor` 实例 |

`onReady` 里的实例可以调用 `undo`、`redo`、`openFind`、`setSourceMode`、`setToolbarVisible`、`setOutlineVisible` 等视图层方法。工具条和大纲默认显示。

组件销毁时会 `destroy()` 编辑器。根元素带 `v5md-host`，传入的 class 和属性会落到这个元素上。

## 构建

```bash
npm run build -w @v5md/vue
```
