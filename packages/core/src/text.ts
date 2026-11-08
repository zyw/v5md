// Text input: typing, range replacement, deletion and caret boundaries.
import { applyEdit } from './history.js'
import { parse, pathAt } from './parse.js'
import { caret, clamp, normalizeNewlines, sortedRange, type EditorState, type MdNode } from './types.js'

const FENCE_LINE = /^(`{3,}|~{3,})$/

export function insertText(state: EditorState, text: string): EditorState {
  const insert = normalizeNewlines(text)
  const { from, to } = sortedRange(state.selection)
  if (insert === '' && from === to) return state
  const next = applyEdit(state, { from, to, insert }, caret(from + insert.length))
  return closeFenceAfterTyping(state, next, insert, from, to) ?? splitTightFence(state, next, insert, from, to) ?? next
}

export function replaceRange(state: EditorState, from: number, to: number, text: string): EditorState {
  const start = Math.max(0, Math.min(from, state.doc.length))
  const end = Math.max(start, Math.min(to, state.doc.length))
  const insert = normalizeNewlines(text)
  if (start === end && insert === '') return state
  return applyEdit(state, { from: start, to: end, insert }, caret(start + insert.length))
}

function closeFenceAfterTyping(
  before: EditorState,
  next: EditorState,
  insert: string,
  from: number,
  to: number,
): EditorState | null {
  if ((insert !== '`' && insert !== '~') || before.selection.anchor !== before.selection.head) return null
  const beforePath = pathAt(parse(before.doc), before.selection.head, before.doc.length)
  if (beforePath.some((node) => node.type === 'code' || node.type === 'math' || node.type === 'yaml')) return null
  const line = lineAt(next.doc, next.selection.head)
  if (line.to !== next.selection.head || !FENCE_LINE.test(line.text)) return null
  // Complete the pair right after the opening fence; the caret stays on the
  // opening line so the language can be typed, and enter moves into the body.
  return applyEdit(before, { from, to, insert: `${insert}\n\n${line.text}` }, caret(from + insert.length))
}

function splitTightFence(
  before: EditorState,
  next: EditorState,
  insert: string,
  from: number,
  to: number,
): EditorState | null {
  if (insert === '' || insert.includes('\n')) return null
  const at = next.selection.head
  const code = pathAt(parse(next.doc), at, next.doc.length).find((node) => node.type === 'code')
  if (!code) return null
  const close = code.children.find(
    (node) => node.type === 'marker' && node.marker === 'fence' && node.start === at && node.end > node.start,
  )
  if (!close || next.doc.slice(close.start, close.end).startsWith('\n')) return null
  // A closing fence typed on the content line is not a real fenced block.
  // Keep what was just typed in the body and push the fence to its own line.
  return applyEdit(before, { from, to, insert: `${insert}\n` }, caret(at))
}

export function deleteBackward(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) return applyEdit(state, { from, to, insert: '' }, caret(from))
  if (from === 0) return state
  const tree = parse(state.doc)
  const atomic = atomicTouch(tree, previousBoundary(state.doc, from), from)
  if (atomic) return applyEdit(state, { from: atomic.start, to: atomic.end, insert: '' }, caret(atomic.start))
  const marker = blockMarkerEndingAt(tree, from)
  if (marker) return applyEdit(state, { from: marker.start, to: marker.end, insert: '' }, caret(marker.start))
  const start = previousBoundary(state.doc, from)
  return applyEdit(state, { from: start, to: from, insert: '' }, caret(start))
}

export function deleteForward(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) return applyEdit(state, { from, to, insert: '' }, caret(from))
  if (from >= state.doc.length) return state
  const tree = parse(state.doc)
  const next = nextBoundary(state.doc, from)
  const atomic = atomicTouch(tree, from, next)
  if (atomic) return applyEdit(state, { from: atomic.start, to: atomic.end, insert: '' }, caret(atomic.start))
  return applyEdit(state, { from, to: next, insert: '' }, caret(from))
}

function atomicTouch(tree: MdNode, from: number, to: number): MdNode | null {
  let found: MdNode | null = null
  const visit = (node: MdNode) => {
    if (node.end <= from || node.start >= to) {
      node.children.forEach(visit)
      return
    }
    if ((node.type === 'thematicBreak' || node.type === 'hardBreak') && from < node.end && to > node.start) {
      found = node
    }
    node.children.forEach(visit)
  }
  visit(tree)
  return found
}

function blockMarkerEndingAt(tree: MdNode, offset: number): MdNode | null {
  let found: MdNode | null = null
  const visit = (node: MdNode) => {
    if (node.type === 'marker' && node.marker === 'block' && node.end === offset && node.start < node.end) found = node
    node.children.forEach(visit)
  }
  visit(tree)
  return found
}

export function previousBoundary(text: string, index: number): number {
  if (index <= 0) return 0
  const trail = text.charCodeAt(index - 1)
  if (trail >= 0xdc00 && trail <= 0xdfff && index >= 2) {
    const lead = text.charCodeAt(index - 2)
    if (lead >= 0xd800 && lead <= 0xdbff) return index - 2
  }
  return index - 1
}

export function nextBoundary(text: string, index: number): number {
  if (index >= text.length) return text.length
  const lead = text.charCodeAt(index)
  if (lead >= 0xd800 && lead <= 0xdbff && index + 1 < text.length) {
    const trail = text.charCodeAt(index + 1)
    if (trail >= 0xdc00 && trail <= 0xdfff) return index + 2
  }
  return index + 1
}
export function lineAt(doc: string, offset: number): { from: number; to: number; text: string } {
  const safe = clamp(offset, 0, doc.length)
  const from = doc.lastIndexOf('\n', Math.max(0, safe - 1)) + 1
  const newline = doc.indexOf('\n', safe)
  const to = newline < 0 ? doc.length : newline
  return { from, to, text: doc.slice(from, to) }
}
