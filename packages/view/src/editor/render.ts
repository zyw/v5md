import type { MdNode } from '@v5md/core'
import katex from 'katex'
import { highlightSpans } from './highlight.js'
import { externalLinkUrl, linkActivationHint } from './links.js'
import { sourceLines, type SourceLine, type SourceToken } from './source.js'

export interface RenderOptions {
  doc: string
  head: number
  anchor: number
  placeholder?: string
  sourceMode?: boolean
  /** Show the line numbers column next to the source. Defaults to true. */
  lineNumbers?: boolean
  /** Hover hint for links. Defaults from the host's preview class and runtime. */
  linkHint?: string
}

/** Rendering is synchronous, so this stays stable for the whole renderDocument call. */
let activeLinkHint = ''

export function renderDocument(container: HTMLElement, options: RenderOptions, tree: MdNode): void {
  activeLinkHint = options.linkHint ?? linkActivationHint(container.classList.contains('v5-preview'))
  const fragment = document.createDocumentFragment()
  if (options.sourceMode) fragment.append(renderSourceDocument(options.doc, tree, options.lineNumbers !== false))
  else for (const child of tree.children) fragment.append(renderNode(child))
  const doc = documentHost(container)
  doc.replaceChildren(fragment)
  const empty = options.doc.length === 0 ? 'true' : 'false'
  doc.dataset.empty = empty
  container.dataset.empty = empty
  if (options.placeholder) {
    doc.dataset.placeholder = options.placeholder
    container.dataset.placeholder = options.placeholder
  }
}

function documentHost(container: HTMLElement): HTMLElement {
  const existing = container.querySelector('.v5-doc')
  if (existing instanceof HTMLElement) return existing
  const doc = document.createElement('div')
  doc.className = 'v5-doc'
  container.append(doc)
  return doc
}

function renderNode(node: MdNode): Node {
  switch (node.type) {
    case 'paragraph':
      return block('p', node, node.children.map(renderNode))
    case 'heading':
      return block(`h${clampDepth(node.depth)}`, node, node.children.map(renderNode))
    case 'blockquote':
      return block('blockquote', node, node.children.map(renderNode), 'v5-quote')
    case 'list':
      return block(node.ordered ? 'ol' : 'ul', node, node.children.map(renderNode), 'v5-list')
    case 'listItem':
      return renderListItem(node)
    case 'code':
      return renderCode(node)
    case 'strikethrough':
      return inline('del', node)
    case 'highlight':
      return inline('mark', node)
    case 'underline':
      return inline('u', node)
    case 'table':
      return renderTable(node)
    case 'math':
      return renderMath(node, true)
    case 'inlineMath':
      return renderMath(node, false)
    case 'yaml':
      return block('pre', node, node.children.map(renderNode), 'v5-frontmatter')
    case 'thematicBreak':
      return renderVoid(node, 'hr', 'v5-hr')
    case 'html':
      return block('pre', node, node.children.map(renderNode), 'v5-html')
    case 'strong':
      return inline('strong', node)
    case 'emphasis':
      return inline('em', node)
    case 'inlineCode':
      return inline('code', node, 'v5-inlinecode')
    case 'link':
      return renderLink(node)
    case 'image':
      return renderImage(node)
    case 'hardBreak':
      return renderBreak(node)
    case 'marker':
      return leaf('span', node, 'v5-marker', node.text ?? '')
    case 'text':
      return renderText(node)
    default:
      return block('div', node, node.children.map(renderNode))
  }
}

function renderListItem(node: MdNode): HTMLElement {
  let firstParagraph = true
  const children: Node[] = []
  if (typeof node.checked === 'boolean') children.push(taskCheckbox(node))
  for (const child of node.children) {
    if (child.type === 'paragraph' && firstParagraph) {
      firstParagraph = false
      children.push(block('span', child, child.children.map(renderItemText), 'v5-item-text'))
    } else {
      children.push(renderNode(child))
    }
  }
  const task = typeof node.checked === 'boolean'
  return block('li', node, children, task ? 'v5-listitem v5-task' : 'v5-listitem')
}

/** Empty item bodies need a text node so the caret sits after the checkbox, not on a `<br>`. */
function renderItemText(node: MdNode): Node {
  if (node.type === 'text' && (node.text ?? '') === '') return caretLeaf(node)
  return renderNode(node)
}

function caretLeaf(node: MdNode): HTMLElement {
  const element = document.createElement('span')
  element.className = 'v5-text'
  stamp(element, node)
  element.setAttribute('data-leaf', 'true')
  element.setAttribute('data-caret', 'true')
  element.append(document.createTextNode('\u200b'))
  return element
}

function taskCheckbox(node: MdNode): HTMLButtonElement {
  const check = document.createElement('button')
  check.type = 'button'
  check.className = 'v5-check'
  check.contentEditable = 'false'
  check.dataset.start = String(node.start)
  check.dataset.checked = node.checked ? 'true' : 'false'
  check.setAttribute('aria-label', node.checked ? '已完成' : '未完成')
  check.setAttribute('aria-pressed', node.checked ? 'true' : 'false')
  return check
}

function renderCode(node: MdNode): HTMLElement {
  if ((node.lang ?? '').trim().toLowerCase() === 'mermaid') return renderMermaid(node)
  const pre = block('pre', node, [], 'v5-code')
  const code = document.createElement('code')
  if (node.lang) code.className = `v5-language-${node.lang}`
  for (const child of node.children) {
    if (child.type === 'marker') pre.append(renderNode(child))
    else if (child.type === 'text') appendHighlighted(code, child, node.lang)
    else code.append(renderNode(child))
  }
  const fence = [...pre.querySelectorAll('.v5-marker')]
  const close = fence.at(-1)
  if (close && code.childNodes.length > 0) pre.insertBefore(code, close)
  else pre.append(code)
  return pre
}

function appendHighlighted(code: HTMLElement, node: MdNode, lang: string | null | undefined): void {
  const text = node.text ?? ''
  const spans = highlightSpans(text, lang)
  if (!spans) {
    code.append(renderText(node, false))
    return
  }
  let offset = node.start
  for (const span of spans) {
    if (span.text.length === 0) continue
    const end = offset + span.text.length
    const piece: MdNode = { type: 'text', start: offset, end, text: span.text, children: [] }
    const className = ['v5-text', span.className].filter(Boolean).join(' ')
    code.append(leaf('span', piece, className, span.text))
    offset = end
  }
}

function renderMermaid(node: MdNode): HTMLElement {
  const pre = block('pre', node, [], 'v5-code v5-mermaid')
  const preview = document.createElement('div')
  preview.className = 'v5-diagram'
  preview.setAttribute('data-void', 'diagram')
  const source = node.children.find((child) => child.type === 'text')?.text ?? ''
  preview.dataset.diagram = source
  preview.textContent = '正在绘制图表'
  pre.append(preview)
  const code = document.createElement('code')
  for (const child of node.children) {
    if (child.type === 'marker') pre.append(renderNode(child))
    else code.append(renderNode(child))
  }
  const fence = [...pre.querySelectorAll('.v5-marker')]
  const close = fence.at(-1)
  if (close && code.childNodes.length > 0) pre.insertBefore(code, close)
  else pre.append(code)
  return pre
}

function renderTable(node: MdNode): HTMLElement {
  const table = block('table', node, [], 'v5-table')
  const rows = node.children.filter((child) => child.type === 'tableRow')
  const head = document.createElement('thead')
  const body = document.createElement('tbody')
  rows.forEach((row, index) => {
    const rendered = renderRow(row, index === 0 ? 'th' : 'td', node.align)
    if (index === 0) head.append(rendered)
    else body.append(rendered)
  })
  if (head.childNodes.length > 0) table.append(head)
  if (body.childNodes.length > 0) table.append(body)
  return table
}

function renderRow(node: MdNode, tag: 'th' | 'td', align: MdNode['align']): HTMLElement {
  const row = block('tr', node, [])
  let column = 0
  for (const child of node.children) {
    if (child.type !== 'tableCell') continue
    const visible = child.children.filter((part) => part.type !== 'marker')
    const cell = block(tag, child, visible.map(renderNode))
    const placement = align?.[column]
    if (placement) cell.style.textAlign = placement
    if (cell.querySelector('[data-leaf]') == null) {
      const spot = visible[0]?.start ?? (child.end > child.start ? child.start + 1 : child.start)
      cell.append(leaf('span', { type: 'text', start: spot, end: spot, text: '', children: [] }, 'v5-text', ''))
    }
    row.append(cell)
    column += 1
  }
  return row
}

function renderMath(node: MdNode, display: boolean): HTMLElement {
  const host = display ? block('div', node, [], 'v5-math') : inline('span', node, 'v5-math')
  const preview = document.createElement(display ? 'div' : 'span')
  preview.className = 'v5-math-preview'
  preview.setAttribute('data-void', 'math')
  try {
    preview.innerHTML = katex.renderToString(node.value ?? '', { throwOnError: false, displayMode: display })
  } catch {
    preview.textContent = node.value ?? ''
  }
  const sourceNode = node.children.find((child) => child.type === 'text') ?? node
  const source = leaf('span', sourceNode, 'v5-source', sourceNode.text ?? '')
  host.replaceChildren(preview, source)
  return host
}

function renderSourceDocument(doc: string, tree: MdNode, lineNumbers: boolean): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'v5-source-doc'
  const lines = sourceLines(doc, tree)
  pre.dataset.lines = String(lines.length)
  if (lineNumbers) pre.dataset.lineNumbers = 'true'
  pre.style.setProperty('--v5-source-line-digits', String(String(lines.length).length))
  pre.append(...lines.map((line) => renderSourceLine(line, lineNumbers)))
  return pre
}

function renderSourceLine(line: SourceLine, lineNumbers: boolean): HTMLElement {
  const row = document.createElement('span')
  row.className = 'v5-source-line'
  row.dataset.line = String(line.number)
  row.dataset.start = String(line.start)
  if (lineNumbers) {
    const number = document.createElement('span')
    number.className = 'v5-source-number'
    number.contentEditable = 'false'
    number.setAttribute('aria-hidden', 'true')
    number.textContent = String(line.number)
    row.append(number)
  }
  if (line.tokens.length === 0) {
    row.append(leaf('span', textNode(line.start, line.start, ''), 'v5-text', ''))
    return row
  }
  for (const item of line.tokens) row.append(renderSourceToken(item))
  return row
}

function renderSourceToken(item: SourceToken): HTMLElement {
  const node = textNode(item.start, item.end, item.text)
  const className = ['v5-text', item.className].filter(Boolean).join(' ')
  return leaf('span', node, className, item.text)
}

function textNode(start: number, end: number, text: string): MdNode {
  return { type: 'text', start, end, text, children: [] }
}

function renderLink(node: MdNode): HTMLElement {
  const anchor = inline('a', node, 'v5-link') as HTMLAnchorElement
  const url = externalLinkUrl(node.url ?? '')
  const note = node.title?.trim()
  if (url) {
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.title = note ? `${note} — ${activeLinkHint}` : activeLinkHint
  } else if (note) {
    anchor.title = note
  }
  return anchor
}

function renderImage(node: MdNode): HTMLElement {
  const host = inline('span', node, 'v5-image')
  host.replaceChildren()
  const frame = document.createElement('span')
  frame.className = 'v5-image-frame'
  frame.contentEditable = 'false'
  const image = document.createElement('img')
  image.className = 'v5-image-preview'
  image.alt = node.alt ?? ''
  image.src = node.url ?? ''
  image.setAttribute('data-void', 'image')
  if (node.width) {
    image.dataset.width = String(node.width)
    image.style.width = `${node.width}px`
    image.style.maxWidth = '100%'
    image.style.height = 'auto'
  }
  if (node.width && node.height) {
    image.dataset.height = String(node.height)
    image.style.aspectRatio = `${node.width} / ${node.height}`
  }
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'v5-image-resize'
  handle.tabIndex = -1
  handle.contentEditable = 'false'
  handle.setAttribute('aria-label', '调整图片大小')
  frame.append(image, handle)
  const source = leaf('span', node, 'v5-source', node.children.map((child) => child.text ?? '').join(''))
  host.append(source, frame)
  const caption = node.alt?.trim()
  if (caption) {
    const label = document.createElement('span')
    label.className = 'v5-image-caption'
    label.contentEditable = 'false'
    label.setAttribute('data-void', 'image')
    label.textContent = caption
    host.append(label)
  }
  return host
}

function renderVoid(node: MdNode, tag: 'hr', className: string): HTMLElement {
  const host = block('div', node, [], className)
  host.setAttribute('data-inline', 'thematicBreak')
  const rule = document.createElement(tag)
  rule.setAttribute('data-void', 'hr')
  const source = leaf('span', node, 'v5-source', node.children.map((child) => child.text ?? '').join(''))
  host.append(rule, source)
  return host
}

function renderBreak(node: MdNode): HTMLElement {
  const line = document.createElement('br')
  stamp(line, node)
  line.setAttribute('data-leaf', 'true')
  line.setAttribute('data-void', 'break')
  line.className = 'v5-br'
  return line
}

function renderText(node: MdNode, breakOnEmpty = true): HTMLElement {
  return leaf('span', node, 'v5-text', node.text ?? '', breakOnEmpty)
}

function block(tag: string, node: MdNode, children: Node[], className?: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = ['v5-block', className].filter(Boolean).join(' ')
  stamp(element, node)
  element.setAttribute('data-block', node.type)
  element.append(...children)
  return element
}

function inline(tag: string, node: MdNode, className?: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = ['v5-inline', className].filter(Boolean).join(' ')
  stamp(element, node)
  element.setAttribute('data-inline', node.type)
  element.append(...node.children.map(renderNode))
  return element
}

function leaf(tag: string, node: MdNode, className: string, text: string, breakOnEmpty = true): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  stamp(element, node)
  element.setAttribute('data-leaf', 'true')
  if (node.marker) element.setAttribute('data-marker', node.marker)
  if (text.length === 0) {
    if (breakOnEmpty) element.append(document.createElement('br'))
    else {
      const placeholder = document.createElement('span')
      placeholder.className = 'v5-empty-line'
      element.append(placeholder)
    }
  } else {
    element.textContent = text
  }
  return element
}

function stamp(element: HTMLElement, node: MdNode): void {
  element.setAttribute('data-start', String(node.start))
  element.setAttribute('data-end', String(node.end))
  element.setAttribute('data-type', node.type)
}

function clampDepth(depth: number | undefined): number {
  if (!depth || depth < 1) return 1
  if (depth > 6) return 6
  return depth
}
