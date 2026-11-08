import { toWechatHtml, type Editor, type V5mdPlugin } from '@v5md/view'

export type ExportImageType = 'png' | 'jpeg'

export interface ExportImageOptions {
  type?: ExportImageType
  scale?: number
}

export interface ExportPdfOptions {
  /** PDF 页边距，单位 pt，默认 24。 */
  margin?: number
  format?: 'a4' | 'letter'
  /** 截图倍率，默认 2。 */
  scale?: number
}

export interface ExportRenderer {
  image(element: HTMLElement, options: Required<Pick<ExportImageOptions, 'type' | 'scale'>>): Promise<Blob>
  pdf(element: HTMLElement, options: Required<ExportPdfOptions>): Promise<Blob>
}

export interface ExportPluginOptions {
  name?: string
  /** 导出 HTML 时使用的标题。 */
  title?: string
  /** 默认文件名前缀，不含扩展名。 */
  fileName?: string
  /** 图片/PDF 截图倍率，默认 2。 */
  imageScale?: number
  /** PDF 页边距，单位 pt，默认 24。 */
  pdfMargin?: number
  /** 替换默认的 html2canvas / jsPDF 实现，便于测试或接入其他渲染器。 */
  renderer?: Partial<ExportRenderer>
}

export interface ExportApi {
  exportMarkdown(): string
  /** 完整 HTML 文档，可直接下载或打开。 */
  exportHtml(): string
  /** 可粘贴的 HTML 片段。 */
  exportHtmlFragment(): string
  exportImage(options?: ExportImageOptions): Promise<Blob>
  exportPdf(options?: ExportPdfOptions): Promise<Blob>
  downloadMarkdown(fileName?: string): void
  downloadHtml(fileName?: string): void
  downloadImage(fileName?: string, options?: ExportImageOptions): Promise<void>
  downloadPdf(fileName?: string, options?: ExportPdfOptions): Promise<void>
}

const DEFAULT_IMAGE_SCALE = 2
const DEFAULT_PDF_MARGIN = 24

export function createExportPlugin(options: ExportPluginOptions = {}): V5mdPlugin<ExportApi> {
  return {
    name: options.name ?? 'export',
    api: (context) => createExportApi(context.editor, context.editor.getContentElement(), options),
  }
}

function createExportApi(editor: Editor, content: HTMLElement, options: ExportPluginOptions): ExportApi {
  const title = options.title ?? 'v5md 文档'
  const baseName = options.fileName ?? 'v5md-document'
  const imageScale = options.imageScale ?? DEFAULT_IMAGE_SCALE
  const pdfMargin = options.pdfMargin ?? DEFAULT_PDF_MARGIN
  const renderImage = options.renderer?.image ?? renderImageWithHtml2Canvas
  const renderPdf = options.renderer?.pdf ?? renderPdfWithJsPdf

  const requireContent = (): HTMLElement => {
    if (!content.isConnected) throw new Error('export plugin is not mounted')
    return content
  }

  const api: ExportApi = {
    exportMarkdown() {
      return editor.getMarkdown()
    },
    exportHtmlFragment() {
      return toWechatHtml(editor.getMarkdown())
    },
    exportHtml() {
      return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:32px;background:#fff;">
${api.exportHtmlFragment()}
</body>
</html>`
    },
    exportImage(imageOptions = {}) {
      return renderImage(requireContent(), {
        type: imageOptions.type ?? 'png',
        scale: imageOptions.scale ?? imageScale,
      })
    },
    exportPdf(pdfOptions = {}) {
      return renderPdf(requireContent(), {
        margin: pdfOptions.margin ?? pdfMargin,
        format: pdfOptions.format ?? 'a4',
        scale: pdfOptions.scale ?? imageScale,
      })
    },
    downloadMarkdown(fileName = `${baseName}.md`) {
      downloadBlob(new Blob([api.exportMarkdown()], { type: 'text/markdown;charset=utf-8' }), fileName)
    },
    downloadHtml(fileName = `${baseName}.html`) {
      downloadBlob(new Blob([api.exportHtml()], { type: 'text/html;charset=utf-8' }), fileName)
    },
    async downloadImage(fileName, imageOptions) {
      const type = imageOptions?.type ?? 'png'
      const blob = await api.exportImage(imageOptions)
      downloadBlob(blob, fileName ?? `${baseName}.${type === 'jpeg' ? 'jpg' : 'png'}`)
    },
    async downloadPdf(fileName = `${baseName}.pdf`, pdfOptions) {
      const blob = await api.exportPdf(pdfOptions)
      downloadBlob(blob, fileName)
    },
  }

  return api
}

async function renderCanvas(element: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') throw new Error('image export requires a browser document')
  const html2canvas = (await import('html2canvas')).default
  return html2canvas(element, {
    backgroundColor: '#ffffff',
    scale,
    useCORS: true,
    logging: false,
  })
}

async function renderImageWithHtml2Canvas(
  element: HTMLElement,
  options: Required<Pick<ExportImageOptions, 'type' | 'scale'>>,
): Promise<Blob> {
  const canvas = await renderCanvas(element, options.scale)
  return canvasToBlob(canvas, options.type)
}

async function renderPdfWithJsPdf(element: HTMLElement, options: Required<ExportPdfOptions>): Promise<Blob> {
  const canvas = await renderCanvas(element, options.scale)
  if (canvas.width === 0 || canvas.height === 0) throw new Error('cannot export an empty document')
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: options.format, orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = options.margin
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const scale = contentWidth / canvas.width
  const pageSliceHeight = Math.max(1, Math.floor(contentHeight / scale))
  const ownerDocument = element.ownerDocument
  let offset = 0
  while (offset < canvas.height) {
    const height = Math.min(pageSliceHeight, canvas.height - offset)
    const pageCanvas = ownerDocument.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = height
    const context = pageCanvas.getContext('2d')
    if (!context) throw new Error('image export requires a 2d canvas context')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height)
    if (offset > 0) pdf.addPage()
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, height * scale)
    offset += height
  }
  return pdf.output('blob')
}

function canvasToBlob(canvas: HTMLCanvasElement, type: ExportImageType): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('failed to create image blob'))
      },
      `image/${type}`,
      0.95,
    )
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('download requires a browser document')
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
