import { parse, type MdNode } from '@v5md/core'
import { highlightSpans } from './highlight.js'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif"
const MONO = "Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
const BODY = `font-family:${SANS};font-size:16px;line-height:1.75;color:#2c2c2c;word-break:break-word;`
const PARAGRAPH = 'margin:0 0 16px;'
const INLINE_CODE =
  `margin:0 2px;padding:2px 5px;border-radius:4px;background:#f3f4f6;font-family:${MONO};font-size:14px;`
const PRE =
  `margin:16px 0;padding:14px 16px;border-radius:6px;background:#f6f8fa;overflow-x:auto;font-family:${MONO};font-size:14px;line-height:1.6;color:#2c2c2c;white-space:pre-wrap;word-break:break-word;`
const CODE = `font-family:${MONO};font-size:14px;line-height:1.6;color:#2c2c2c;`
const LINK = 'color:#1d4ed8;text-decoration:none;'

const HEADING_SIZES: Record<number, string> = {
  1: '24px',
  2: '20px',
  3: '18px',
  4: '16px',
  5: '16px',
  6: '16px',
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  'hljs-keyword': '#d73a49',
  'hljs-selector-tag': '#d73a49',
  'hljs-built_in': '#d73a49',
  'hljs-string': '#032f62',
  'hljs-attr': '#032f62',
  'hljs-symbol': '#032f62',
  'hljs-comment': '#6a737d',
  'hljs-quote': '#6a737d',
  'hljs-number': '#005cc5',
  'hljs-literal': '#005cc5',
  'hljs-bullet': '#005cc5',
  'hljs-title': '#6f42c1',
  'hljs-section': '#6f42c1',
  'hljs-function': '#6f42c1',
  'hljs-type': '#e36209',
  'hljs-params': '#e36209',
  'hljs-name': '#22863a',
  'hljs-tag': '#22863a',
  'hljs-selector-class': '#22863a',
  'hljs-meta': '#6f42c1',
  'hljs-variable': '#6f42c1',
}

/**
 * 把 Markdown 转成公众号编辑器能保留的 HTML。
 *
 * 公众号会丢掉 class、id 和外部样式，所以这里只输出内联样式，并且不依赖主题 CSS。
 * 公式和 Mermaid 暂时以代码块形式保留源码，避免粘贴后变成不可读的空白。
 */
export function toWechatHtml(markdown: string): string {
  const body = parse(markdown)
    .children.map(renderNode)
    .filter(Boolean)
    .join('')
  return `<section style="${BODY}">${body}</section>`
}

export async function copyRichText(html: string, text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return true
    } catch {
      // Clipboard API 在非安全上下文或旧浏览器上不可用，继续走 execCommand。
    }
  }
  return copyWithExecCommand(html)
}

function copyWithExecCommand(html: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const holder = document.createElement('div')
  holder.contentEditable = 'true'
  holder.style.position = 'fixed'
  holder.style.left = '-9999px'
  holder.style.top = '0'
  holder.style.opacity = '0'
  holder.style.pointerEvents = 'none'
  holder.innerHTML = html
  document.body.append(holder)
  const selection = document.getSelection()
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const range = document.createRange()
  range.selectNodeContents(holder)
  selection?.removeAllRanges()
  selection?.addRange(range)
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  selection?.removeAllRanges()
  if (previous) {
    try {
      selection?.addRange(previous)
    } catch {
      // The old range may refer to nodes that were removed while copying.
    }
  }
  holder.remove()
  return copied
}

function renderNode(node: MdNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node)
    case 'heading':
      return renderHeading(node)
    case 'blockquote':
      return renderBlockquote(node)
    case 'list':
      return renderList(node)
    case 'listItem':
      return renderListItem(node)
    case 'code':
      return renderCode(node)
    case 'thematicBreak':
      return '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">'
    case 'html':
      return renderPre(escapeHtml(rawText(node)))
    case 'text':
      return renderText(node)
    case 'strong':
      return `<strong style="font-weight:700;">${renderChildren(node)}</strong>`
    case 'emphasis':
      return `<em style="font-style:italic;">${renderChildren(node)}</em>`
    case 'inlineCode':
      return `<code style="${INLINE_CODE}">${escapeHtml(rawText(node))}</code>`
    case 'strikethrough':
      return `<span style="color:#6b7280;text-decoration:line-through;">${renderChildren(node)}</span>`
    case 'highlight':
      return `<span style="background-color:#fef3c7;padding:0 2px;">${renderChildren(node)}</span>`
    case 'underline':
      return `<span style="text-decoration:underline;text-underline-offset:2px;">${renderChildren(node)}</span>`
    case 'link':
      return renderLink(node)
    case 'image':
      return renderImage(node)
    case 'hardBreak':
      return '<br>'
    case 'table':
      return renderTable(node)
    case 'math':
      return renderMath(node, true)
    case 'inlineMath':
      return renderMath(node, false)
    case 'yaml':
      return ''
    case 'marker':
      return ''
    default:
      return renderChildren(node)
  }
}

function renderBlockquote(node: MdNode): string {
  const inner = node.children
    .map((child) => (child.type === 'paragraph' ? renderChildren(child) : renderNode(child)))
    .filter(Boolean)
    .join('<br>')
  return `<blockquote style="margin:16px 0;padding:4px 0 4px 16px;border-left:4px solid #e5e7eb;color:#4b5563;">${inner}</blockquote>`
}

function renderParagraph(node: MdNode): string {
  const inner = renderChildren(node)
  if (!inner.replace(/<br\s*\/?>/g, '').trim()) return ''
  return `<p style="${PARAGRAPH}">${inner}</p>`
}

function renderHeading(node: MdNode): string {
  const depth = Math.min(Math.max(node.depth ?? 1, 1), 6)
  const border = depth <= 2 ? 'padding-bottom:8px;border-bottom:1px solid #e5e7eb;' : ''
  return `<h${depth} style="margin:32px 0 16px;font-size:${HEADING_SIZES[depth]};font-weight:700;line-height:1.35;color:#1f1f1f;${border}">${renderChildren(node)}</h${depth}>`
}

function renderList(node: MdNode): string {
  const items = node.children.filter((child) => child.type === 'listItem')
  const hasTask = items.some((item) => typeof item.checked === 'boolean')
  const ordered = node.ordered === true
  const tag = ordered ? 'ol' : 'ul'
  const listStyle = ordered ? 'decimal' : hasTask ? 'none' : 'disc'
  const padding = ordered || !hasTask ? 'padding-left:1.5em;' : 'padding-left:0;'
  const body = items.map((item) => renderListItem(item)).join('')
  return `<${tag} style="margin:8px 0;${padding}list-style:${listStyle};">${body}</${tag}>`
}

function renderListItem(node: MdNode): string {
  const task = typeof node.checked === 'boolean'
  const checkbox = task ? renderCheckbox(node.checked === true) : ''
  const body: string[] = []
  for (const child of node.children) {
    if (child.type === 'marker') continue
    if (child.type === 'paragraph') {
      const inner = renderChildren(child)
      if (inner.replace(/<br\s*\/?>/g, '').trim()) body.push(inner)
      continue
    }
    body.push(renderNode(child))
  }
  return `<li style="margin:0 0 6px;${task ? 'list-style:none;' : ''}">${checkbox}${body.join('')}</li>`
}

function renderCheckbox(checked: boolean): string {
  return `<span style="display:inline-block;width:14px;height:14px;margin:0 6px 0 0;border:1px solid #9ca3af;border-radius:3px;background:#fff;color:#1d4ed8;font-family:Arial,sans-serif;font-size:12px;line-height:14px;text-align:center;vertical-align:-2px;">${checked ? '✓' : ''}</span>`
}

function renderCode(node: MdNode): string {
  const code = node.children
    .filter((child) => child.type === 'text')
    .map((child) => child.text ?? '')
    .join('')
  return renderPre(renderHighlighted(code, node.lang))
}

function renderPre(html: string): string {
  return `<pre style="${PRE}"><code style="${CODE}">${html}</code></pre>`
}

function renderHighlighted(code: string, lang: string | null | undefined): string {
  const spans = highlightSpans(code, lang)
  if (!spans) return escapeHtml(code)
  return spans
    .map((span) => {
      const text = escapeHtml(span.text)
      const color = HIGHLIGHT_COLORS[span.className]
      return color ? `<span style="color:${color};">${text}</span>` : text
    })
    .join('')
}

function renderMath(node: MdNode, display: boolean): string {
  const value = node.value ?? rawText(node)
  if (display) return renderPre(escapeHtml(`$$\n${value}\n$$`))
  return `<code style="${INLINE_CODE}">${escapeHtml(`$${value}$`)}</code>`
}

function renderLink(node: MdNode): string {
  const url = (node.url ?? '').trim()
  const inner = renderChildren(node)
  if (!url) return inner
  return `<a href="${escapeHtml(url)}" style="${LINK}">${inner}</a>`
}

function renderImage(node: MdNode): string {
  const url = (node.url ?? '').trim()
  const alt = node.alt ?? ''
  if (!url) return escapeHtml(alt)
  const width = node.width ? `width:${node.width}px;` : ''
  const caption = alt.trim()
    ? `<span style="display:block;margin-top:6px;color:#6b7280;font-size:14px;line-height:1.5;">${escapeHtml(alt)}</span>`
    : ''
  return `<span style="display:block;margin:16px 0;text-align:center;"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;${width}border-radius:6px;">${caption}</span>`
}

function renderTable(node: MdNode): string {
  const rows = node.children.filter((child) => child.type === 'tableRow')
  const align = node.align ?? []
  let head = ''
  let body = ''
  rows.forEach((row, rowIndex) => {
    const cells = row.children.filter((child) => child.type === 'tableCell')
    const cellTag = rowIndex === 0 ? 'th' : 'td'
    const cellHtml = cells
      .map((cell, column) => {
        const placement = align[column]
        const textAlign = placement ? `text-align:${placement};` : ''
        const background = rowIndex === 0 ? 'background-color:#fff;' : rowIndex % 2 === 1 ? 'background-color:#f3f4f6;' : 'background-color:#fff;'
        const weight = cellTag === 'th' ? 'font-weight:700;' : ''
        const inner = renderChildren(cell).trim() || '&nbsp;'
        return `<${cellTag} style="border:1px solid #e5e7eb;padding:8px 12px;vertical-align:top;${textAlign}${background}${weight}">${inner}</${cellTag}>`
      })
      .join('')
    if (rowIndex === 0) head = `<thead><tr>${cellHtml}</tr></thead>`
    else body += `<tr>${cellHtml}</tr>`
  })
  return `<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">${head}<tbody>${body}</tbody></table>`
}

function renderText(node: MdNode): string {
  return escapeHtml(node.text ?? '').replace(/\n/g, '<br>')
}

function renderChildren(node: MdNode): string {
  return node.children.map(renderNode).join('')
}

function rawText(node: MdNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'marker') return ''
  return node.children.map(rawText).join('')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
