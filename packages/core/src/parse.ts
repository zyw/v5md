import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatter } from 'micromark-extension-frontmatter'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item'
import { math } from 'micromark-extension-math'
import { mathFromMarkdown } from 'mdast-util-math'
import type { Break, Code, Html, Image, InlineCode, ListItem, Nodes, Parents, Table, Text } from 'mdast'
import { normalizeNewlines, type MarkerKind, type MdNode, type NodeType } from './types.js'

interface Positioned {
  position?: {
    start: { offset?: number }
    end: { offset?: number }
  }
}

const EDGE_MARKER_PARENTS = new Set<NodeType>([
  'heading',
  'strong',
  'emphasis',
  'link',
  'strikethrough',
])

export interface OutlineEntry {
  depth: number
  text: string
  start: number
}

export function parse(markdown: string): MdNode {
  const doc = normalizeNewlines(markdown)
  const tree = fromMarkdown(doc, {
    extensions: [gfmStrikethrough({ singleTilde: false }), gfmTable(), gfmTaskListItem(), frontmatter(), math()],
    mdastExtensions: [
      gfmStrikethroughFromMarkdown(),
      gfmTableFromMarkdown(),
      gfmTaskListItemFromMarkdown(),
      frontmatterFromMarkdown(),
      mathFromMarkdown(),
    ],
  })
  const root = convertParent(tree, doc, 'root')
  root.start = 0
  root.end = doc.length
  fillBlankLines(root, doc)
  ensureListItemCaret(root)
  applyUnderline(root)
  applyHighlight(root)
  if (root.children.length === 0) root.children.push(emptyParagraph(0))
  return root
}

export function outline(markdown: string): OutlineEntry[] {
  const items: OutlineEntry[] = []
  const visit = (node: MdNode) => {
    if (node.type === 'heading') {
      const text = node.children.find((child) => child.type === 'text')
      items.push({
        depth: node.depth ?? 1,
        text: plainText(node),
        start: text?.start ?? node.start,
      })
    }
    if (node.type !== 'code' && node.type !== 'yaml' && node.type !== 'math') node.children.forEach(visit)
  }
  visit(parse(markdown))
  return items
}

export function plainText(node: MdNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'marker') return ''
  if (node.type === 'hardBreak') return '\n'
  return node.children.map(plainText).join('')
}

function fillBlankLines(node: MdNode, doc: string): void {
  node.children.forEach((child) => fillBlankLines(child, doc))
  if (node.type !== 'root' && node.type !== 'blockquote') return
  const limit = node.type === 'root' ? doc.length : node.end
  const next: MdNode[] = []
  let cursor = node.type === 'root' ? 0 : node.start
  for (const child of node.children) {
    if (child.start > cursor) next.push(...blankParagraphs(doc, cursor, child.start, 'between'))
    next.push(child)
    cursor = Math.max(cursor, child.end)
  }
  if (limit > cursor) next.push(...blankParagraphs(doc, cursor, limit, 'trailing'))
  node.children = next
}

function blankParagraphs(
  doc: string,
  start: number,
  end: number,
  edge: 'between' | 'trailing',
): MdNode[] {
  const raw = doc.slice(start, end)
  if (!/^\n+$/.test(raw)) return []
  const count = edge === 'trailing' ? Math.max(0, raw.length - 1) : Math.max(0, raw.length - 2)
  const nodes: MdNode[] = []
  for (let index = 0; index < count; index += 1) {
    const offset = edge === 'trailing' && index === count - 1 ? end : start + 1 + index
    nodes.push(emptyParagraph(offset))
  }
  return nodes
}

function ensureListItemCaret(node: MdNode): void {
  if (node.type === 'listItem' && !node.children.some((child) => child.type !== 'marker')) {
    const marker = [...node.children].reverse().find((child) => child.type === 'marker')
    node.children.push(emptyParagraph(marker?.end ?? node.end))
  }
  node.children.forEach(ensureListItemCaret)
}

export function emptyParagraph(offset: number): MdNode {
  return {
    type: 'paragraph',
    start: offset,
    end: offset,
    children: [textNode(offset, offset, '')],
  }
}

export function pathAt(tree: MdNode, offset: number, docLength: number): MdNode[] {
  const path: MdNode[] = []
  let current: MdNode | undefined = tree
  while (current) {
    path.push(current)
    current = childContaining(current, offset, docLength)
  }
  return path
}

export function containsOffset(node: MdNode, offset: number, docLength: number): boolean {
  if (node.start === node.end) return offset === node.start
  if (offset >= node.start && offset < node.end) return true
  return offset === node.end && offset === docLength && node.type !== 'root'
}

function childContaining(node: MdNode, offset: number, docLength: number): MdNode | undefined {
  const matches = node.children.filter((child) => containsOffset(child, offset, docLength))
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  return (
    matches.find((child) => offset < child.end || child.start === child.end) ??
    matches[matches.length - 1]
  )
}

function convertNode(node: Nodes, doc: string): MdNode {
  switch (node.type) {
    case 'root':
      return convertParent(node, doc, 'root')
    case 'paragraph':
      return convertParent(node, doc, 'paragraph')
    case 'heading':
      return convertParent(node, doc, 'heading', { depth: node.depth })
    case 'blockquote':
      return convertQuote(node, doc)
    case 'list':
      return convertParent(node, doc, 'list', { ordered: Boolean(node.ordered) })
    case 'listItem':
      return convertParent(node, doc, 'listItem', { checked: taskChecked(node) })
    case 'strong':
      return convertParent(node, doc, 'strong')
    case 'emphasis':
      return convertParent(node, doc, 'emphasis')
    case 'delete':
      return convertParent(node, doc, 'strikethrough')
    case 'table':
      return convertParent(node, doc, 'table', { align: tableAlign(node) })
    case 'tableRow':
      return convertParent(node, doc, 'tableRow')
    case 'tableCell':
      return convertParent(node, doc, 'tableCell')
    case 'math':
      return literal(node, doc, 'math')
    case 'inlineMath':
      return literal(node, doc, 'inlineMath')
    case 'yaml':
      return literal(node, doc, 'yaml')
    case 'link':
      return convertParent(node, doc, 'link', { url: node.url, title: node.title })
    case 'inlineCode':
      return convertInlineCode(node, doc)
    case 'code':
      return convertCode(node, doc)
    case 'text':
      return convertText(node, doc)
    case 'image':
      return convertImage(node, doc)
    case 'thematicBreak':
      return convertWhole(node, doc, 'thematicBreak')
    case 'html':
      return convertHtml(node, doc)
    case 'break':
      return convertBreak(node, doc)
    case 'definition':
    case 'footnoteDefinition':
    case 'footnoteReference':
    case 'linkReference':
    case 'imageReference':
      return convertOpaque(node, doc)
    default:
      return convertOpaque(node, doc)
  }
}

function convertParent(
  node: Parents,
  doc: string,
  type: NodeType,
  extra: Partial<MdNode> = {},
): MdNode {
  const { start, end } = offsets(node)
  const parent: MdNode = { type, start, end, children: [], ...extra }
  let cursor = start
  node.children.forEach((child, index) => {
    const childPos = offsets(child)
    if (childPos.start > cursor) {
      parent.children.push(...gapNodes(type, doc, cursor, childPos.start, index === 0))
    }
    parent.children.push(convertNode(child, doc))
    cursor = Math.max(cursor, childPos.end)
  })
  if (cursor < end) {
    parent.children.push(...gapNodes(type, doc, cursor, end, node.children.length === 0))
  }
  return parent
}

function convertQuote(node: Parents, doc: string): MdNode {
  const { start, end } = offsets(node)
  const children: MdNode[] = []
  let cursor = start
  for (const child of node.children) {
    const childPos = offsets(child)
    if (childPos.start > cursor) children.push(...quoteGap(doc.slice(cursor, childPos.start), cursor))
    const converted = convertNode(child, doc)
    children.push(...liftQuotePrefixes(converted, doc))
    cursor = Math.max(cursor, childPos.end)
  }
  if (cursor < end) children.push(...quoteGap(doc.slice(cursor, end), cursor))
  return { type: 'blockquote', start, end, children }
}

function liftQuotePrefixes(node: MdNode, doc: string): MdNode[] {
  if (node.type !== 'paragraph' && node.type !== 'heading') return [node]
  const children: MdNode[] = []
  for (const child of node.children) {
    const raw = child.type === 'text' ? doc.slice(child.start, child.end) : ''
    if (child.type === 'text' && /(^|\n)>/.test(raw)) children.push(...quoteGap(raw, child.start))
    else children.push(child)
  }
  return [{ ...node, children }]
}

function quoteGap(raw: string, start: number): MdNode[] {
  const nodes: MdNode[] = []
  let index = 0
  let lineStart = true
  while (index < raw.length) {
    const char = raw[index]
    if (char === '\n') {
      nodes.push(textNode(start + index, start + index + 1, '\n'))
      index += 1
      lineStart = true
      continue
    }
    if (lineStart && char === '>') {
      let end = index + 1
      if (raw[end] === ' ') end += 1
      nodes.push(markerNode('block', start + index, start + end, raw.slice(index, end)))
      index = end
      lineStart = false
      continue
    }
    let end = index + 1
    while (end < raw.length && raw[end] !== '\n') end += 1
    nodes.push(textNode(start + index, start + end, raw.slice(index, end)))
    index = end
    lineStart = false
  }
  return nodes
}

function gapNodes(
  parentType: NodeType,
  doc: string,
  start: number,
  end: number,
  atStart: boolean,
): MdNode[] {
  const raw = doc.slice(start, end)
  if (raw.length === 0) return []
  if (parentType === 'root' || parentType === 'list') return []
  if (parentType === 'table' || parentType === 'tableRow') return [markerNode('block', start, end, raw)]
  if (parentType === 'tableCell' && /^[|\s]*$/.test(raw)) return [markerNode('block', start, end, raw)]
  if (/^\n+$/.test(raw) && (parentType === 'heading' || parentType === 'listItem' || parentType === 'paragraph')) {
    return []
  }
  if (parentType === 'listItem') {
    if (!atStart || /^\s*$/.test(raw)) return []
    return [markerNode('block', start, end, raw)]
  }
  if (EDGE_MARKER_PARENTS.has(parentType)) {
    const kind: MarkerKind = parentType === 'heading' ? 'block' : atStart ? 'open' : 'close'
    return [markerNode(kind, start, end, raw)]
  }
  if (/^\n+$/.test(raw)) return []
  return [textNode(start, end, raw)]
}

function convertText(node: Text, doc: string): MdNode {
  const { start, end } = offsets(node)
  return textNode(start, end, doc.slice(start, end))
}

function convertInlineCode(node: InlineCode, doc: string): MdNode {
  const { start, end } = offsets(node)
  const raw = doc.slice(start, end)
  const open = /^(?<ticks>`+)/.exec(raw)
  const close = /(?<ticks>`+)$/.exec(raw)
  const openLength = open?.groups?.ticks.length ?? 1
  const closeLength = close?.groups?.ticks.length ?? openLength
  const contentStart = start + openLength
  const contentEnd = Math.max(contentStart, end - closeLength)
  return {
    type: 'inlineCode',
    start,
    end,
    children: [
      markerNode('open', start, contentStart, doc.slice(start, contentStart)),
      textNode(contentStart, contentEnd, doc.slice(contentStart, contentEnd)),
      markerNode('close', contentEnd, end, doc.slice(contentEnd, end)),
    ],
  }
}

function convertCode(node: Code, doc: string): MdNode {
  const { start, end } = offsets(node)
  const raw = doc.slice(start, end)
  const open = /^([`~]{3,})([^\n]*)(?:\n|$)/.exec(raw)
  if (!open) {
    return {
      type: 'code',
      start,
      end,
      lang: node.lang ?? null,
      children: [textNode(start, end, raw)],
    }
  }
  const openLength = open[0].length
  const close = /\n?([`~]{3,})[ \t]*$/.exec(raw)
  const closeLength = close ? close[0].length : 0
  const contentStart = start + openLength
  const contentEnd = Math.max(contentStart, end - closeLength)
  return {
    type: 'code',
    start,
    end,
    lang: node.lang ?? null,
    children: [
      markerNode('fence', start, contentStart, doc.slice(start, contentStart)),
      textNode(contentStart, contentEnd, doc.slice(contentStart, contentEnd)),
      markerNode('fence', contentEnd, end, doc.slice(contentEnd, end)),
    ],
  }
}

function convertImage(node: Image, doc: string): MdNode {
  const whole = convertWhole(node, doc, 'image')
  return { ...whole, url: node.url, alt: node.alt ?? '', title: node.title }
}

function convertHtml(node: Html, doc: string): MdNode {
  return convertWhole(node, doc, 'html')
}

function convertBreak(node: Break, doc: string): MdNode {
  const { start, end } = offsets(node)
  return { type: 'hardBreak', start, end, children: [], text: doc.slice(start, end) }
}

function convertWhole(node: Positioned & { type: string }, doc: string, type: NodeType): MdNode {
  const { start, end } = offsets(node)
  return {
    type,
    start,
    end,
    children: [textNode(start, end, doc.slice(start, end))],
  }
}

function convertOpaque(node: Nodes, doc: string): MdNode {
  const { start, end } = offsets(node)
  return {
    type: 'html',
    start,
    end,
    children: [textNode(start, end, doc.slice(start, end))],
  }
}

function textNode(start: number, end: number, text: string): MdNode {
  return { type: 'text', start, end, text, children: [] }
}

function markerNode(marker: MarkerKind, start: number, end: number, text: string): MdNode {
  return { type: 'marker', marker, start, end, text, children: [] }
}

function offsets(node: Positioned): { start: number; end: number } {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start == null || end == null) {
    throw new Error('Markdown node is missing source offsets')
  }
  return { start, end }
}

function taskChecked(node: ListItem): boolean | null {
  return node.checked === true || node.checked === false ? node.checked : null
}

function tableAlign(node: Table): MdNode['align'] {
  return node.align ?? null
}

function literal(node: Extract<Nodes, { value?: string }>, doc: string, type: NodeType): MdNode {
  return { ...convertWhole(node, doc, type), value: node.value }
}

function applyUnderline(node: MdNode): void {
  if (
    node.type === 'code' ||
    node.type === 'inlineCode' ||
    node.type === 'math' ||
    node.type === 'inlineMath' ||
    node.type === 'yaml' ||
    node.type === 'html' ||
    node.type === 'underline'
  ) {
    return
  }
  const expanded = node.children.flatMap((child) => {
    if (child.type === 'text') return splitUnderline(child)
    const whole = underlineFromHtml(child)
    return whole ? [whole] : [child]
  })
  node.children = mergeUnderlineSiblings(expanded)
  node.children.forEach(applyUnderline)
}

function splitUnderline(node: MdNode): MdNode[] {
  const text = node.text ?? ''
  if (!text.includes('<u>')) return [node]
  const parts: MdNode[] = []
  const pattern = /<u>([^<\n]*)<\/u>/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push(textNode(node.start + last, node.start + index, text.slice(last, index)))
    parts.push(underlineNode(node.start + index, node.start + index + match[0].length, match[1] ?? ''))
    last = index + match[0].length
  }
  if (parts.length === 0) return [node]
  if (last < text.length) parts.push(textNode(node.start + last, node.end, text.slice(last)))
  return parts
}

function underlineFromHtml(node: MdNode): MdNode | null {
  if (node.type !== 'html') return null
  const text = nodeText(node)
  const match = /^<u>([^<\n]*)<\/u>$/.exec(text)
  if (!match) return null
  return underlineNode(node.start, node.end, match[1] ?? '')
}

function underlineNode(start: number, end: number, inner: string): MdNode {
  const openEnd = start + 3
  const closeStart = end - 4
  return {
    type: 'underline',
    start,
    end,
    children: [
      markerNode('open', start, openEnd, '<u>'),
      textNode(openEnd, closeStart, inner),
      markerNode('close', closeStart, end, '</u>'),
    ],
  }
}

function mergeUnderlineSiblings(children: MdNode[]): MdNode[] {
  const next: MdNode[] = []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (child && nodeText(child).trim().toLowerCase() === '<u>') {
      let close = -1
      for (let cursor = index + 1; cursor < children.length; cursor += 1) {
        const candidate = children[cursor]
        if (!candidate) break
        if (nodeText(candidate).trim().toLowerCase() === '<u>') break
        if (nodeText(candidate).trim().toLowerCase() === '</u>') {
          close = cursor
          break
        }
      }
      const closing = children[close]
      if (closing && close > index) {
        next.push({
          type: 'underline',
          start: child.start,
          end: closing.end,
          children: [
            markerNode('open', child.start, child.end, nodeText(child)),
            ...children.slice(index + 1, close),
            markerNode('close', closing.start, closing.end, nodeText(closing)),
          ],
        })
        index = close
        continue
      }
    }
    if (child) next.push(child)
  }
  return next
}

function applyHighlight(node: MdNode): void {
  if (
    node.type === 'code' ||
    node.type === 'inlineCode' ||
    node.type === 'math' ||
    node.type === 'inlineMath' ||
    node.type === 'yaml' ||
    node.type === 'highlight'
  ) {
    return
  }
  node.children = node.children.flatMap((child) => (child.type === 'text' ? splitHighlight(child) : [child]))
  node.children.forEach(applyHighlight)
}

function splitHighlight(node: MdNode): MdNode[] {
  const text = node.text ?? ''
  if (!text.includes('==')) return [node]
  const parts: MdNode[] = []
  const pattern = /==([^=\n]+)==/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push(textNode(node.start + last, node.start + index, text.slice(last, index)))
    const from = node.start + index
    const to = from + match[0].length
    const inner = match[1] ?? ''
    parts.push({
      type: 'highlight',
      start: from,
      end: to,
      children: [
        markerNode('open', from, from + 2, '=='),
        textNode(from + 2, to - 2, inner),
        markerNode('close', to - 2, to, '=='),
      ],
    })
    last = index + match[0].length
  }
  if (parts.length === 0) return [node]
  if (last < text.length) parts.push(textNode(node.start + last, node.end, text.slice(last)))
  return parts
}

export function nodeText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'marker') return node.text ?? ''
  return node.children.map(nodeText).join('')
}
