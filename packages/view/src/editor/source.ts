import type { MdNode, NodeType } from '@v5md/core'
import { highlightSpans } from './highlight.js'

/** A styled range of the Markdown source. */
export interface SourceSpan {
  start: number
  end: number
  className: string
}

/** A run of characters that belongs to one visual token of a source line. */
export interface SourceToken {
  start: number
  end: number
  text: string
  className: string
}

/** One logical line of the Markdown source, ready to be painted. */
export interface SourceLine {
  number: number
  start: number
  end: number
  tokens: SourceToken[]
}

/**
 * Classes painted on the content of a node. Markers (the syntax punctuation)
 * are painted separately so they can stay muted.
 */
const CONTENT_CLASS: Partial<Record<NodeType, string>> = {
  heading: 'v5-md-heading',
  strong: 'v5-md-strong',
  emphasis: 'v5-md-em',
  strikethrough: 'v5-md-strike',
  highlight: 'v5-md-highlight',
  underline: 'v5-md-underline',
  link: 'v5-md-link',
  inlineCode: 'v5-md-inline-code',
  math: 'v5-md-math',
  inlineMath: 'v5-md-math',
  yaml: 'v5-md-frontmatter',
  html: 'v5-md-html',
  thematicBreak: 'v5-md-rule',
}

/**
 * Walks the parsed document and returns the styled source ranges. Ranges are
 * sorted, do not overlap, and never leave the document bounds. Characters
 * without a range (blank lines, hard breaks) stay unstyled.
 */
export function markdownSpans(doc: string, tree: MdNode): SourceSpan[] {
  const spans: SourceSpan[] = []
  walk(doc, tree, [], spans)
  return spans
}

function walk(doc: string, node: MdNode, inherited: string[], out: SourceSpan[], parent: NodeType | null = null): void {
  if (node.type === 'marker') {
    pushMarker(out, doc, node, parent)
    return
  }
  if (node.type === 'text') {
    push(out, doc, node.start, node.end, inherited)
    return
  }
  if (node.type === 'code') {
    for (const child of node.children) {
      if (child.type === 'marker') pushMarker(out, doc, child, 'code')
      else if (child.type === 'text') pushCode(out, doc, child, node.lang)
      else walk(doc, child, inherited, out, 'code')
    }
    return
  }
  if (node.type === 'image' && node.children.length === 1 && node.children[0]?.type === 'text') {
    pushImage(out, doc, node)
    return
  }
  const own = CONTENT_CLASS[node.type]
  const next = own ? [...inherited, own] : inherited
  for (const child of node.children) walk(doc, child, next, out, node.type)
}

function pushMarker(out: SourceSpan[], doc: string, node: MdNode, parent: NodeType | null): void {
  if (parent === 'link') {
    // The closing marker of a link is "](url)", so color the destination.
    const raw = doc.slice(node.start, node.end)
    const split = raw.indexOf('](')
    if (split >= 0) {
      push(out, doc, node.start, node.start + split + 2, ['v5-md-marker'])
      push(out, doc, node.start + split + 2, node.end, ['v5-md-url'])
      return
    }
  }
  push(out, doc, node.start, node.end, ['v5-md-marker'])
}

function pushCode(out: SourceSpan[], doc: string, node: MdNode, lang: string | null | undefined): void {
  const text = node.text ?? ''
  const spans = highlightSpans(text, lang)
  if (!spans) {
    push(out, doc, node.start, node.end, ['v5-md-code'])
    return
  }
  let offset = node.start
  for (const span of spans) {
    const end = Math.min(node.end, offset + span.text.length)
    push(out, doc, offset, end, ['v5-md-code', span.className])
    offset = end
  }
  if (offset < node.end) push(out, doc, offset, node.end, ['v5-md-code'])
}

function pushImage(out: SourceSpan[], doc: string, node: MdNode): void {
  const raw = doc.slice(node.start, node.end)
  const match = /^(!\[[^\]]*\])([\s\S]*)$/.exec(raw)
  if (!match || !match[1]) {
    push(out, doc, node.start, node.end, ['v5-md-image'])
    return
  }
  const labelEnd = node.start + match[1].length
  push(out, doc, node.start, labelEnd, ['v5-md-image'])
  push(out, doc, labelEnd, node.end, ['v5-md-url'])
}

function push(out: SourceSpan[], doc: string, start: number, end: number, classes: string[]): void {
  const from = Math.max(0, Math.min(start, doc.length))
  const to = Math.max(from, Math.min(end, doc.length))
  if (to <= from) return
  const className = [...new Set(classes.filter(Boolean))].join(' ')
  if (!className) return
  out.push({ start: from, end: to, className })
}

/**
 * Splits the source into lines. Each line carries exact tokens that cover the
 * line characters; line breaks themselves are not part of any token, so the
 * view can paint block rows without adding characters to the model.
 */
export function sourceLines(doc: string, tree: MdNode): SourceLine[] {
  const spans = markdownSpans(doc, tree)
  const lines: SourceLine[] = []
  const chunks = doc.split('\n')
  let spanIndex = 0
  let start = 0
  for (let index = 0; index < chunks.length; index += 1) {
    const text = chunks[index] ?? ''
    const end = start + text.length
    while (spanIndex < spans.length && spans[spanIndex]!.end <= start) spanIndex += 1
    const tokens: SourceToken[] = []
    let cursor = start
    let scan = spanIndex
    while (scan < spans.length && spans[scan]!.start < end) {
      const span = spans[scan]!
      const from = Math.max(span.start, cursor)
      const to = Math.min(span.end, end)
      if (from > cursor) tokens.push(token(doc, cursor, from, ''))
      if (to > from) tokens.push(token(doc, from, to, span.className))
      cursor = Math.max(cursor, to)
      if (span.end <= end) scan += 1
      else break
    }
    if (cursor < end) tokens.push(token(doc, cursor, end, ''))
    lines.push({ number: index + 1, start, end, tokens: merge(tokens) })
    start = end + 1
  }
  return lines
}

function token(doc: string, start: number, end: number, className: string): SourceToken {
  return { start, end, text: doc.slice(start, end), className }
}

function merge(tokens: SourceToken[]): SourceToken[] {
  const merged: SourceToken[] = []
  for (const current of tokens) {
    if (current.text.length === 0) continue
    const last = merged[merged.length - 1]
    if (last && last.end === current.start && last.className === current.className) {
      last.end = current.end
      last.text += current.text
      continue
    }
    merged.push({ ...current })
  }
  return merged
}
