# @v5md/plugin-export

v5md 的导出插件：Markdown、HTML、PDF 和图片。没有工具条按钮，全部通过外部 API 调用。

## 安装

```bash
npm install @v5md/plugin-export
```

## 使用

```ts
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'

const editor = new Editor({
  element,
  plugins: [createExportPlugin({ title: '我的文章' })],
})

const exporter = editor.getPlugin<ExportApi>('export')!

const markdown = exporter.api.exportMarkdown()
const html = exporter.api.exportHtml()
const png = await exporter.api.exportImage({ type: 'png', scale: 2 })
const pdf = await exporter.api.exportPdf({ format: 'a4', margin: 24 })
```

也可以直接下载：

```ts
exporter.api.downloadMarkdown('article.md')
exporter.api.downloadHtml('article.html')
await exporter.api.downloadImage('article.png')
await exporter.api.downloadPdf('article.pdf')
```

## API

| 方法 | 说明 |
| --- | --- |
| `exportMarkdown()` | 返回 Markdown |
| `exportHtmlFragment()` | 返回带内联样式的 HTML 片段 |
| `exportHtml()` | 返回完整 HTML 文档 |
| `exportImage(options?)` | 返回 PNG / JPEG Blob |
| `exportPdf(options?)` | 返回 PDF Blob |
| `downloadMarkdown(fileName?)` | 下载 Markdown |
| `downloadHtml(fileName?)` | 下载 HTML |
| `downloadImage(fileName?, options?)` | 下载图片 |
| `downloadPdf(fileName?, options?)` | 下载 PDF |

PDF 和图片默认使用 `html2canvas` + `jspdf`，这两个依赖在插件包内部按需动态加载。也可以通过 `renderer` 选项替换成自己的实现：

```ts
createExportPlugin({
  renderer: {
    image: async (element, options) => myImageRenderer(element, options),
    pdf: async (element, options) => myPdfRenderer(element, options),
  },
})
```

PDF 当前是图片式 PDF（文字不可选中）；需要可选中文字时，可以通过自定义 `renderer.pdf` 接入其他方案。
