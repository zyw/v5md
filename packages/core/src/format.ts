// Formatting: inline marks, block format commands and image sizing.
import { applyEdit, pushHistory } from './history.js'
import { parse, pathAt, withImageSize } from './parse.js'
import { lineAt } from './text.js'
import { caret, clamp, sortedRange, type Change, type EditorState, type MdNode } from './types.js'

export function toggleMark(state: EditorState, marker: '**' | '*' | '`' | '~~' | '=='): EditorState {
  const { from, to } = sortedRange(state.selection)
  const type =
    marker === '**'
      ? 'strong'
      : marker === '*'
        ? 'emphasis'
        : marker === '`'
          ? 'inlineCode'
          : marker === '~~'
            ? 'strikethrough'
            : 'highlight'
  const existing = findMark(parse(state.doc), from, to, type)
  if (existing) return unwrap(state, existing)
  if (from !== to) {
    const selected = state.doc.slice(from, to)
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      const inner = selected.slice(marker.length, selected.length - marker.length)
      return applyEdit(state, { from, to, insert: inner }, { anchor: from, head: from + inner.length })
    }
    const wrapped = `${marker}${selected}${marker}`
    const anchor = from + marker.length
    return applyEdit(state, { from, to, insert: wrapped }, { anchor, head: anchor + selected.length })
  }
  const insert = `${marker}${marker}`
  return applyEdit(state, { from, to, insert }, caret(from + marker.length))
}

export function toggleUnderline(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  const existing = findMark(parse(state.doc), from, to, 'underline')
  if (existing) return unwrap(state, existing)
  if (from !== to) {
    const selected = state.doc.slice(from, to)
    if (selected.startsWith('<u>') && selected.endsWith('</u>') && selected.length >= 7) {
      const inner = selected.slice(3, -4)
      return applyEdit(state, { from, to, insert: inner }, { anchor: from, head: from + inner.length })
    }
    return applyEdit(
      state,
      { from, to, insert: `<u>${selected}</u>` },
      { anchor: from + 3, head: from + 3 + selected.length },
    )
  }
  return applyEdit(state, { from, to, insert: '<u></u>' }, caret(from + 3))
}

export type FormatCommand =
  | 'code'
  | 'table'
  | 'orderedList'
  | 'bulletList'
  | 'taskList'
  | 'quote'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'rule'
  | 'link'
  | 'math'
  | 'inlineMath'

export function formatBlock(state: EditorState, command: FormatCommand): EditorState {
  const path = pathAt(parse(state.doc), state.selection.head, state.doc.length)
  const locked = path.some((node) => node.type === 'code' || node.type === 'math' || node.type === 'yaml')
  if (command === 'link') return locked ? state : insertLink(state)
  if (command === 'inlineMath') return locked ? state : insertInlineMath(state)
  if (locked || path.some((node) => node.type === 'table')) return state
  switch (command) {
    case 'code':
      return insertCode(state)
    case 'table':
      return insertAfterLine(state, '|  |  |  |\n| --- | --- | --- |\n|  |  |  |', 2)
    case 'rule':
      return insertAfterLine(state, '---', 3)
    case 'math':
      return insertAfterLine(state, '$$\n\n$$', 3)
    case 'orderedList':
    case 'bulletList':
    case 'taskList':
    case 'quote':
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return replaceCurrentLine(state, command)
    default:
      return state
  }
}

function insertLink(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  const label = from === to ? '链接' : state.doc.slice(from, to)
  const url = 'https://'
  const insert = `[${label}](${url})`
  const urlStart = from + label.length + 3
  return applyEdit(state, { from, to, insert }, { anchor: urlStart, head: urlStart + url.length })
}

function insertInlineMath(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) {
    const inner = state.doc.slice(from, to)
    return applyEdit(state, { from, to, insert: `$${inner}$` }, { anchor: from + 1, head: from + 1 + inner.length })
  }
  return applyEdit(state, { from, to, insert: '$$' }, caret(from + 1))
}

function insertCode(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) {
    const inner = state.doc.slice(from, to)
    return applyEdit(state, { from, to, insert: '```\n' + inner + '\n```' }, caret(from + 4))
  }
  const line = lineAt(state.doc, from)
  const insert = line.text.trim() === '' ? '```\n\n```' : '```\n' + line.text + '\n```'
  return applyEdit(state, { from: line.from, to: line.to, insert }, caret(line.from + 4))
}

function insertAfterLine(state: EditorState, block: string, caretOffset: number): EditorState {
  const line = lineAt(state.doc, state.selection.head)
  if (line.text.trim() === '') {
    return applyEdit(state, { from: line.from, to: line.to, insert: block }, caret(line.from + caretOffset))
  }
  const at = line.to
  return applyEdit(state, { from: at, to: at, insert: `\n\n${block}` }, caret(at + 2 + caretOffset))
}

function replaceCurrentLine(state: EditorState, command: FormatCommand): EditorState {
  const line = lineAt(state.doc, state.selection.head)
  const next = transformLine(line.text, command)
  if (next === line.text) return state
  const offsetInLine = clamp(state.selection.head, line.from, line.to) - line.from
  const oldPrefix = linePrefixLength(line.text)
  const nextPrefix = linePrefixLength(next)
  const bodyIndex = Math.max(0, offsetInLine - oldPrefix)
  const caretAt = line.from + nextPrefix + Math.min(bodyIndex, Math.max(0, next.length - nextPrefix))
  return applyEdit(state, { from: line.from, to: line.to, insert: next }, caret(caretAt))
}

function transformLine(text: string, command: FormatCommand): string {
  if (command === 'heading1' || command === 'heading2' || command === 'heading3') {
    const depth = command === 'heading1' ? 1 : command === 'heading2' ? 2 : 3
    const match = /^(#{1,6})\s+/.exec(text)
    const body = text.replace(/^#{1,6}\s+/, '')
    if (match && match[1].length === depth) return body
    return `${'#'.repeat(depth)} ${body}`
  }
  if (command === 'quote') {
    if (/^>\s?/.test(text)) return text.replace(/^>\s?/, '')
    return `> ${text}`
  }
  if (command === 'taskList') {
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(text)) return text.replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
    const body = text.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*+]|\d+\.)\s+/, '')
    return `- [ ] ${body}`
  }
  if (command === 'bulletList') {
    if (/^[-*+]\s+/.test(text) && !/^[-*+]\s+\[[ xX]\]/.test(text)) return text.replace(/^[-*+]\s+/, '')
    const body = text.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '')
    return `- ${body}`
  }
  if (command === 'orderedList') {
    if (/^\d+\.\s+/.test(text)) return text.replace(/^\d+\.\s+/, '')
    const body = text.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '')
    return `1. ${body}`
  }
  return text
}

function linePrefixLength(text: string): number {
  const match = /^(>\s?|#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/.exec(text)
  return match?.[1].length ?? 0
}

function findMark(tree: MdNode, from: number, to: number, type: MdNode['type']): MdNode | null {
  let found: MdNode | null = null
  const visit = (node: MdNode) => {
    if (node.type === type) {
      const content = node.children.filter((child) => child.type !== 'marker')
      const innerFrom = content[0]?.start ?? node.start
      const innerTo = content.at(-1)?.end ?? node.end
      const coversInner = from === innerFrom && to === innerTo
      const coversNode = from === node.start && to === node.end
      const caretInside = from === to && from > node.start && to < node.end
      if (coversInner || coversNode || caretInside) found = node
    }
    node.children.forEach(visit)
  }
  visit(tree)
  return found
}

function unwrap(state: EditorState, node: MdNode): EditorState {
  const markers = node.children.filter((child) => child.type === 'marker').sort((a, b) => b.start - a.start)
  if (markers.length === 0) return state
  let doc = state.doc
  for (const marker of markers) {
    doc = doc.slice(0, marker.start) + doc.slice(marker.end)
  }
  const map = (offset: number) => {
    let next = offset
    for (const marker of markers) {
      const size = marker.end - marker.start
      if (offset >= marker.end) next -= size
      else if (offset > marker.start) next -= offset - marker.start
    }
    return Math.max(0, next)
  }
  const anchor = map(state.selection.anchor)
  const head = map(state.selection.head)
  const removed = markers.reduce((sum, marker) => sum + (marker.end - marker.start), 0)
  const change: Change = {
    from: node.start,
    to: node.end,
    insert: doc.slice(node.start, node.end - removed),
  }
  return {
    doc,
    selection: { anchor, head },
    history: pushHistory(state.history, state.doc, change, state.selection, { anchor, head }),
  }
}

export function resizeImage(state: EditorState, width: number, height?: number): EditorState {
  const nextWidth = Math.round(width)
  const nextHeight = height == null ? undefined : Math.round(height)
  if (!Number.isFinite(nextWidth) || nextWidth < 1 || nextWidth > 4096) return state
  if (nextHeight != null && (!Number.isFinite(nextHeight) || nextHeight < 1 || nextHeight > 4096)) return state
  const image = pathAt(parse(state.doc), state.selection.head, state.doc.length).find((node) => node.type === 'image')
  if (!image) return state
  const raw = state.doc.slice(image.start, image.end)
  const insert = withImageSize(raw, nextWidth, nextHeight)
  if (insert === raw) return state
  return applyEdit(state, { from: image.start, to: image.end, insert }, state.selection)
}
