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
  /** 完整 HTML 文档，可直接下载或打开；图片会尽量内联为 data URL。 */
  exportHtml(): Promise<string>
  /** 可粘贴的 HTML 片段。 */
  exportHtmlFragment(): string
  exportImage(options?: ExportImageOptions): Promise<Blob>
  exportPdf(options?: ExportPdfOptions): Promise<Blob>
  /** 打开浏览器打印对话框，可选择“另存为 PDF”。 */
  print(): Promise<void>
  downloadMarkdown(fileName?: string): void
  downloadHtml(fileName?: string): Promise<void>
  downloadImage(fileName?: string, options?: ExportImageOptions): Promise<void>
  downloadPdf(fileName?: string, options?: ExportPdfOptions): Promise<void>
}

const DEFAULT_IMAGE_SCALE = 2
const DEFAULT_PDF_MARGIN = 24

const PRINT_CSS = `@media print {
  body { margin: 0; padding: 0; background: #fff; }
  .v5-block,
  .v5-widget,
  .v5-echarts,
  .v5-mermaid,
  .v5-mindmap,
  .v5-table,
  table,
  pre,
  blockquote,
  li,
  tr,
  .katex-display,
  .v5-echarts-preview,
  .v5-diagram,
  img,
  svg {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
    page-break-after: avoid;
  }
}`

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
      return buildStandaloneHtml(editor, title)
    },
    async print() {
      printHtml(await api.exportHtml())
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
    async downloadHtml(fileName = `${baseName}.html`) {
      downloadBlob(new Blob([await api.exportHtml()], { type: 'text/html;charset=utf-8' }), fileName)
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

async function buildStandaloneHtml(editor: Editor, title: string): Promise<string> {
  const live = editor.getContentElement()
  const clone = live.cloneNode(true)
  if (!(clone instanceof HTMLElement)) throw new Error('editor content is not an element')
  snapshotCanvases(live, clone)
  cleanContent(clone)
  await inlineImages(clone)
  const styles = collectEditorStyles()
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${styles}
${PRINT_CSS}
</style>
</head>
<body style="margin:0;padding:32px;background:#fff;">
<div class="v5md is-preview">${clone.outerHTML}</div>
</body>
</html>`
}

/**
 * `cloneNode` 不会复制 canvas 像素（ECharts 等会变成空白）。
 * 按 DOM 顺序把 live canvas 转成 `<img data URL>` 写进克隆树。
 */
function snapshotCanvases(liveRoot: HTMLElement, cloneRoot: HTMLElement): void {
  const liveCanvases = [...liveRoot.querySelectorAll('canvas')]
  const cloneCanvases = [...cloneRoot.querySelectorAll('canvas')]
  const count = Math.min(liveCanvases.length, cloneCanvases.length)
  for (let index = 0; index < count; index += 1) {
    const live = liveCanvases[index]
    const clone = cloneCanvases[index]
    if (!live || !clone) continue
    let dataUrl = ''
    try {
      dataUrl = live.toDataURL('image/png')
    } catch {
      continue
    }
    if (!dataUrl || dataUrl === 'data:,') continue
    const image = clone.ownerDocument.createElement('img')
    image.setAttribute('src', dataUrl)
    image.setAttribute('alt', '')
    const width = live.clientWidth || live.width
    const height = live.clientHeight || live.height
    if (width) image.style.width = `${width}px`
    if (height) image.style.height = `${height}px`
    image.style.display = 'block'
    image.style.maxWidth = '100%'
    clone.replaceWith(image)
  }
}

function cleanContent(root: HTMLElement): void {
  root
    .querySelectorAll(
      '.md-marker, .v5-source, .v5-image-resize, .v5-empty-line, .v5-block-handle, .v5-block-menu, .v5-tablebar, .v5-toolbar, .v5-outline, .v5-find',
    )
    .forEach((element) => element.remove())
  root.querySelectorAll('.v5-check').forEach((check) => {
    if (check.tagName !== 'BUTTON') return
    const span = root.ownerDocument.createElement('span')
    span.className = 'v5-check'
    span.dataset.checked = check.getAttribute('data-checked') ?? 'false'
    check.replaceWith(span)
  })
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === 'data-checked') continue
      if (
        attribute.name.startsWith('data-') ||
        attribute.name === 'contenteditable' ||
        attribute.name === 'tabindex' ||
        attribute.name === 'spellcheck' ||
        attribute.name === 'autocapitalize' ||
        attribute.name === 'role' ||
        attribute.name.startsWith('aria-')
      ) {
        element.removeAttribute(attribute.name)
      }
    }
    element.classList.remove('is-source', 'is-active', 'is-composing', 'v5-source-mode')
  }
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll<HTMLImageElement>('img')]
  await Promise.all(
    images.map(async (image) => {
      const source = image.getAttribute('src')?.trim()
      if (!source || source.startsWith('data:')) return
      let absolute = source
      if (typeof document !== 'undefined') {
        try {
          absolute = new URL(source, document.baseURI).href
        } catch {
          // Keep the original source when it cannot be resolved.
        }
      }
      if (typeof fetch !== 'function') {
        image.setAttribute('src', absolute)
        return
      }
      try {
        const response = await fetch(absolute, { mode: 'cors' })
        if (!response.ok) throw new Error(`image request failed: ${response.status}`)
        image.setAttribute('src', await blobToDataUrl(await response.blob()))
        image.removeAttribute('srcset')
      } catch {
        image.setAttribute('src', absolute)
      }
    }),
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('failed to read image as data url'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('failed to read image as data url'))
    reader.readAsDataURL(blob)
  })
}

function collectEditorStyles(): string {
  if (typeof document === 'undefined') return ''
  const rules: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(list)) {
      const text = rule.cssText
      if (!text) continue
      if (/\.v5|\.katex|\.hljs|KaTeX|@font-face|::highlight/.test(text)) rules.push(text)
    }
  }
  return rules.join('\n')
}

function printHtml(html: string): void {
  if (typeof document === 'undefined') throw new Error('print requires a browser document')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.srcdoc = html
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 0)
  }
  iframe.addEventListener('load', () => {
    const frameWindow = iframe.contentWindow
    if (!frameWindow) {
      cleanup()
      return
    }
    frameWindow.focus()
    frameWindow.print()
    cleanup()
  })
  document.body.append(iframe)
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

/**
 * 图片式 PDF：用 html2canvas 保留中文与图表，再按块边界切片进页，
 * 尽量避免从列表项 / 表格行 / 图表中间切开。
 * 需要可选中矢量文字时，请走 `print()` 用浏览器「另存为 PDF」。
 */
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
  const breakPoints = collectPdfBreakPoints(element, canvas.height)
  const ownerDocument = element.ownerDocument
  let offset = 0
  while (offset < canvas.height) {
    const height = Math.min(
      choosePdfSliceHeight(offset, canvas.height, pageSliceHeight, breakPoints),
      canvas.height - offset,
    )
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

const PDF_BREAK_SELECTOR = [
  '.v5-block',
  '.v5-widget',
  '.v5-echarts',
  '.v5-mermaid',
  '.v5-mindmap',
  '.v5-table',
  'table',
  'thead',
  'tr',
  'li',
  'p',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '.katex-display',
  '.v5-echarts-preview',
  '.v5-diagram',
  'img',
  'svg',
].join(',')

/** 收集适合作为分页切线的 canvas Y（元素顶/底），单位与截图像素一致。 */
function collectPdfBreakPoints(element: HTMLElement, canvasHeight: number): number[] {
  const sourceHeight = Math.max(element.scrollHeight, element.offsetHeight, 1)
  const ratio = canvasHeight / sourceHeight
  const rootRect = element.getBoundingClientRect()
  const points = new Set<number>([0, canvasHeight])
  for (const node of element.querySelectorAll<HTMLElement>(PDF_BREAK_SELECTOR)) {
    const rect = node.getBoundingClientRect()
    if (rect.height <= 0) continue
    const top = Math.round((rect.top - rootRect.top + element.scrollTop) * ratio)
    const bottom = Math.round((rect.bottom - rootRect.top + element.scrollTop) * ratio)
    if (top > 0 && top < canvasHeight) points.add(top)
    if (bottom > 0 && bottom < canvasHeight) points.add(bottom)
  }
  return [...points].sort((a, b) => a - b)
}

/**
 * 在不超过一页高度的前提下，尽量切在块边界上；
 * 找不到合适边界时退回固定页高，避免死循环。
 */
function choosePdfSliceHeight(
  offset: number,
  canvasHeight: number,
  pageSliceHeight: number,
  breakPoints: number[],
): number {
  const limit = Math.min(offset + pageSliceHeight, canvasHeight)
  if (limit >= canvasHeight) return canvasHeight - offset
  const minKeep = offset + Math.max(48, Math.floor(pageSliceHeight * 0.45))
  let best = limit
  for (const point of breakPoints) {
    if (point <= minKeep) continue
    if (point > limit) break
    best = point
  }
  return Math.max(1, best - offset)
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
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
