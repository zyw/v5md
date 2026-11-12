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
const html = await exporter.api.exportHtml()
const png = await exporter.api.exportImage({ type: 'png', scale: 2 })
const pdf = await exporter.api.exportPdf({ format: 'a4', margin: 24 })
```

也可以直接下载：

```ts
exporter.api.downloadMarkdown('article.md')
await exporter.api.downloadHtml('article.html')
await exporter.api.downloadImage('article.png')
await exporter.api.downloadPdf('article.pdf')
await exporter.api.print()
```

## API

| 方法 | 说明 |
| --- | --- |
| `exportMarkdown()` | 返回 Markdown |
| `exportHtmlFragment()` | 返回带内联样式的 HTML 片段 |
| `exportHtml()` | 返回完整 HTML 文档，图片会尽量内联为 data URL |
| `exportImage(options?)` | 返回 PNG / JPEG Blob |
| `exportPdf(options?)` | 返回 PDF Blob |
| `print()` | 打开浏览器打印对话框，可选择「另存为 PDF」 |
| `downloadMarkdown(fileName?)` | 下载 Markdown |
| `downloadHtml(fileName?)` | 下载 HTML |
| `downloadImage(fileName?, options?)` | 下载图片 |
| `downloadPdf(fileName?, options?)` | 下载 PDF |

`exportHtml()` 会导出当前编辑器已经渲染好的内容，因此公式保留 KaTeX 排版、Mermaid 保留渲染后的 SVG，而不是退回源码代码块；ECharts 等 canvas 图表会先快照成图片再写入 HTML；图片会先用 `fetch` 转成 data URL，遇到跨域图片时回退为绝对 URL。`exportHtml()` 和 `downloadHtml()` 都是异步的。`exportHtmlFragment()` 仍然输出适合公众号粘贴的内联样式片段。

PDF 和图片默认使用 `html2canvas` + `jspdf`，这两个依赖在插件包内部按需动态加载。PDF 会按块边界切片分页，尽量避免从列表项、图表、表格中间切开。也可以选择浏览器打印路径：`print()` 会打开打印对话框，由用户在浏览器里选择「另存为 PDF」（矢量文字、系统中文字体）。需要自定义实现时，通过 `renderer` 替换：

```ts
createExportPlugin({
  renderer: {
    image: async (element, options) => myImageRenderer(element, options),
    pdf: async (element, options) => myPdfRenderer(element, options),
  },
})
```

`downloadPdf()` 当前是图片式 PDF（保证中文与图表不丢字）；需要可选中文字时请用 `print()`，或通过自定义 `renderer.pdf` 接入其他方案。
