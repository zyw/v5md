import { nodeText, parse, pathAt } from './parse.js'
import {
  caret,
  normalizeNewlines,
  sortedRange,
  type Change,
  type EditorState,
  type History,
  type HistoryEntry,
  type MdNode,
  type TextSelection,
} from './types.js'

const HISTORY_LIMIT = 200
const COALESCE_LIMIT = 40

export function createState(markdown = ''): EditorState {
  const doc = normalizeNewlines(markdown)
  return {
    doc,
    selection: caret(0),
    history: { undos: [], redos: [] },
  }
}

export function insertText(state: EditorState, text: string): EditorState {
  const insert = normalizeNewlines(text)
  if (insert === '' && sortedRange(state.selection).from === sortedRange(state.selection).to) return state
  const { from, to } = sortedRange(state.selection)
  return applyEdit(state, { from, to, insert }, caret(from + insert.length))
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

export function splitBlock(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  const base = from === to ? state : applyEdit(state, { from, to, insert: '' }, caret(from))
  const offset = sortedRange(base.selection).from
  const tree = parse(base.doc)
  const path = pathAt(tree, offset, base.doc.length)
  if (path.some((node) => node.type === 'code' || node.type === 'math' || node.type === 'inlineMath' || node.type === 'yaml')) {
    return applyEdit(base, { from: offset, to: offset, insert: '\n' }, caret(offset + 1))
  }
  const tableTarget = tableLocation(tree, offset, base.doc.length)
  if (tableTarget) return moveInTable(base, tableTarget, 1)
  const listItem =
    [...path].reverse().find((node) => node.type === 'listItem') ?? listItemEndingAt(tree, offset)
  if (listItem && listItemPlain(listItem).trim() === '') {
    const marker = listItem.children.find((node) => node.type === 'marker' && node.marker === 'block')
    if (marker) return applyEdit(base, { from: marker.start, to: marker.end, insert: '' }, caret(marker.start))
  }
  if (listItem) {
    const marker = listItem.children.find((node) => node.type === 'marker' && node.marker === 'block')
    const bullet = nextBullet(marker?.text ?? '- ')
    const insert = `\n${bullet}`
    return applyEdit(base, { from: offset, to: offset, insert }, caret(offset + insert.length))
  }
  const insert = enterInsert(base.doc, offset, tree)
  const next = applyEdit(base, { from: offset, to: offset, insert }, caret(offset + insert.length))
  return { ...next, selection: caret(snapCaretToBlank(next.doc, next.selection.head)) }
}

export function insertSoftBreak(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  const base = from === to ? state : applyEdit(state, { from, to, insert: '' }, caret(from))
  const offset = sortedRange(base.selection).from
  const path = pathAt(parse(base.doc), offset, base.doc.length)
  const insert = path.some((node) => node.type === 'code') ? '\n' : '  \n'
  return applyEdit(base, { from: offset, to: offset, insert }, caret(offset + insert.length))
}

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
    if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= marker.length * 2
    ) {
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
    return applyEdit(state, { from, to, insert: `<u>${selected}</u>` }, { anchor: from + 3, head: from + 3 + selected.length })
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

function lineAt(doc: string, offset: number): { from: number; to: number; text: string } {
  const safe = clamp(offset, 0, doc.length)
  const from = doc.lastIndexOf('\n', Math.max(0, safe - 1)) + 1
  const newline = doc.indexOf('\n', safe)
  const to = newline < 0 ? doc.length : newline
  return { from, to, text: doc.slice(from, to) }
}

function linePrefixLength(text: string): number {
  const match = /^(>\s?|#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/.exec(text)
  return match?.[1].length ?? 0
}

export type TableCommand =
  | 'insertRowAbove'
  | 'insertRowBelow'
  | 'deleteRow'
  | 'insertColumnLeft'
  | 'insertColumnRight'
  | 'deleteColumn'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'deleteTable'

export function editTable(state: EditorState, command: TableCommand): EditorState {
  const tree = parse(state.doc)
  const located =
    tableLocation(tree, state.selection.head, state.doc.length) ??
    tableLocation(tree, state.selection.anchor, state.doc.length)
  if (!located) return state
  const rows = located.table.children.filter((node) => node.type === 'tableRow')
  const rowIndex = rows.findIndex((row) => row === located.row)
  const column = located.row.children
    .filter((node) => node.type === 'tableCell')
    .findIndex((cell) => cell === located.cell)
  if (rowIndex < 0 || column < 0) return state
  if (command === 'deleteTable') return removeTable(state, located.table)

  let from = located.table.start
  let to = located.table.end
  let source = state.doc.slice(from, to)
  if (source.endsWith('\n')) {
    source = source.slice(0, -1)
    to -= 1
  }
  const matrix = source.split('\n').map(splitRow)
  const delimiter = matrix.findIndex((cells) => cells.length > 0 && cells.every(isDelimiterCell))
  if (delimiter < 0) return state
  const width = Math.max(...matrix.map((cells) => cells.length), 1)
  matrix.forEach((cells, index) => {
    while (cells.length < width) cells.push(index === delimiter ? '---' : ' ')
  })
  const contentLines = matrix.map((_, index) => index).filter((index) => index !== delimiter)
  const lineIndex = contentLines[rowIndex]
  if (lineIndex == null) return state

  let nextRow = rowIndex
  let nextColumn = column
  if (command === 'insertRowAbove' || command === 'insertRowBelow') {
    const blank = Array.from({ length: width }, () => ' ')
    if (command === 'insertRowAbove' && lineIndex === 0) {
      const header = matrix[0] ?? blank
      matrix[0] = blank
      matrix.splice(delimiter + 1, 0, header)
    } else if (command === 'insertRowBelow' && lineIndex === 0) {
      matrix.splice(delimiter + 1, 0, blank)
      nextRow = 1
    } else if (command === 'insertRowAbove') {
      matrix.splice(lineIndex, 0, blank)
    } else {
      matrix.splice(lineIndex + 1, 0, blank)
      nextRow = rowIndex + 1
    }
  } else if (command === 'deleteRow') {
    if (contentLines.length <= 1) return removeTable(state, located.table)
    if (lineIndex === 0) {
      const promoted = matrix[contentLines[1] ?? 0] ?? []
      matrix.splice(contentLines[1] ?? 0, 1)
      matrix[0] = promoted
    } else {
      matrix.splice(lineIndex, 1)
      nextRow = Math.min(rowIndex, contentLines.length - 2)
    }
  } else if (command === 'insertColumnLeft' || command === 'insertColumnRight') {
    const at = command === 'insertColumnLeft' ? column : column + 1
    matrix.forEach((cells, index) => cells.splice(at, 0, index === delimiter ? '---' : ' '))
    nextColumn = at
  } else if (command === 'deleteColumn') {
    if (width <= 1) return removeTable(state, located.table)
    matrix.forEach((cells) => cells.splice(column, 1))
    nextColumn = Math.min(column, width - 2)
  } else {
    const token = command === 'alignCenter' ? ':---:' : command === 'alignRight' ? '---:' : ':---'
    const divider = matrix[delimiter]
    if (divider) divider[column] = token
  }

  const divider = matrix[delimiter]?.every(isDelimiterCell)
    ? delimiter
    : matrix.findIndex((cells) => cells.every(isDelimiterCell))
  const insert = matrix.map((cells, index) => (index === divider ? joinDelimiter(cells) : joinRow(cells))).join('\n')
  const drafted = applyChange(state.doc, { from, to, insert })
  const caretOffset = caretInTable(drafted, from, nextRow, nextColumn)
  return applyEdit(state, { from, to, insert }, caret(caretOffset))
}

export function moveTableCaret(state: EditorState, direction: 1 | -1): EditorState | null {
  const tree = parse(state.doc)
  const offset = sortedRange(state.selection).from
  const located = tableLocation(tree, offset, state.doc.length)
  if (!located) return null
  return moveInTable(state, located, direction)
}

export function toggleTask(state: EditorState, offset: number): EditorState {
  const tree = parse(state.doc)
  const located = taskItemAt(tree, offset, state.doc.length)
  if (!located) return state
  const marker = located.children.find((node) => node.type === 'marker' && node.marker === 'block')
  if (!marker?.text) return state
  const insert = marker.text.replace(/\[(?: |x|X)\]/, located.checked ? '[ ]' : '[x]')
  if (insert === marker.text) return state
  return applyEdit(state, { from: marker.start, to: marker.end, insert }, state.selection)
}

export function findMatch(doc: string, query: string, from: number): { from: number; to: number } | null {
  if (!query) return null
  const start = clamp(from, 0, doc.length)
  let index = doc.indexOf(query, start)
  if (index < 0 && start > 0) index = doc.indexOf(query)
  if (index < 0) return null
  return { from: index, to: index + query.length }
}

export function replaceAllText(state: EditorState, query: string, replacement: string): EditorState {
  if (!query || !state.doc.includes(query)) return state
  const insert = state.doc.split(query).join(replacement)
  return applyEdit(state, { from: 0, to: state.doc.length, insert }, caret(0))
}

export function indent(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) return insertText(state, '  ')
  const path = pathAt(parse(state.doc), from, state.doc.length)
  if (path.some((node) => node.type === 'code')) return insertText(state, '  ')
  const lineStart = state.doc.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const selection = shift(state.selection, lineStart, 2)
  return applyEdit(state, { from: lineStart, to: lineStart, insert: '  ' }, selection)
}

export function outdent(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  if (from !== to) return state
  const lineStart = state.doc.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  if (state.doc.slice(lineStart, lineStart + 2) !== '  ') return state
  const selection = shift(state.selection, lineStart, -2)
  return applyEdit(state, { from: lineStart, to: lineStart + 2, insert: '' }, selection)
}

export function undo(state: EditorState): EditorState {
  const entry = state.history.undos.at(-1)
  if (!entry) return state
  return {
    doc: applyChange(state.doc, entry.undoChange),
    selection: entry.selectionBefore,
    history: {
      undos: state.history.undos.slice(0, -1),
      redos: [...state.history.redos, entry],
    },
  }
}

export function redo(state: EditorState): EditorState {
  const entry = state.history.redos.at(-1)
  if (!entry) return state
  return {
    doc: applyChange(state.doc, entry.redoChange),
    selection: entry.selectionAfter,
    history: {
      undos: [...state.history.undos, entry],
      redos: state.history.redos.slice(0, -1),
    },
  }
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
  const markers = node.children
    .filter((child) => child.type === 'marker')
    .sort((a, b) => b.start - a.start)
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

function applyEdit(state: EditorState, change: Change, selection: TextSelection): EditorState {
  const doc = applyChange(state.doc, change)
  return {
    doc,
    selection: clampSelection(selection, doc.length),
    history: pushHistory(state.history, state.doc, change, state.selection, clampSelection(selection, doc.length)),
  }
}

function applyChange(doc: string, change: Change): string {
  const from = clamp(change.from, 0, doc.length)
  const to = clamp(change.to, from, doc.length)
  return doc.slice(0, from) + change.insert + doc.slice(to)
}

function pushHistory(
  history: History,
  beforeDoc: string,
  change: Change,
  selectionBefore: TextSelection,
  selectionAfter: TextSelection,
): History {
  const undoChange: Change = {
    from: change.from,
    to: change.from + change.insert.length,
    insert: beforeDoc.slice(change.from, change.to),
  }
  const entry: HistoryEntry = { undoChange, redoChange: change, selectionBefore, selectionAfter }
  const undos = history.undos.slice()
  const previous = undos.at(-1)
  if (previous && canMerge(previous, entry)) undos[undos.length - 1] = merge(previous, entry)
  else undos.push(entry)
  if (undos.length > HISTORY_LIMIT) undos.shift()
  return { undos, redos: [] }
}

function canMerge(previous: HistoryEntry, next: HistoryEntry): boolean {
  const before = previous.redoChange
  const after = next.redoChange
  if (before.from !== before.to || after.from !== after.to) return false
  if (after.insert.length !== 1 || /[\n\t]/.test(after.insert)) return false
  if (before.insert.length >= COALESCE_LIMIT) return false
  if (before.from + before.insert.length !== after.from) return false
  return previous.selectionAfter.anchor === previous.selectionAfter.head && previous.selectionAfter.anchor === after.from
}

function merge(previous: HistoryEntry, next: HistoryEntry): HistoryEntry {
  const insert = previous.redoChange.insert + next.redoChange.insert
  const from = previous.redoChange.from
  return {
    redoChange: { from, to: from, insert },
    undoChange: { from, to: from + insert.length, insert: '' },
    selectionBefore: previous.selectionBefore,
    selectionAfter: next.selectionAfter,
  }
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

function listItemEndingAt(tree: MdNode, offset: number): MdNode | undefined {
  let found: MdNode | undefined
  const visit = (node: MdNode) => {
    if (node.type === 'listItem' && node.end === offset && node.start < node.end) found = node
    node.children.forEach(visit)
  }
  visit(tree)
  return found
}

function snapCaretToBlank(doc: string, offset: number): number {
  const tree = parse(doc)
  const blanks: number[] = []
  const visit = (node: MdNode) => {
    if (node.type === 'paragraph' && node.start === node.end) blanks.push(node.start)
    node.children.forEach(visit)
  }
  visit(tree)
  if (blanks.includes(offset)) return offset
  const path = pathAt(tree, offset, doc.length)
  const leaf = path.at(-1)
  if (leaf?.type === 'text' && offset > leaf.start && offset < leaf.end) return offset
  const nearby = blanks
    .filter((start) => Math.abs(start - offset) <= 2)
    .sort((left, right) => Math.abs(left - offset) - Math.abs(right - offset) || left - right)
  return nearby[0] ?? offset
}

function enterInsert(doc: string, offset: number, tree: MdNode): string {
  if (offset === doc.length) return doc.endsWith('\n') ? '\n' : '\n\n'
  if (doc[offset] === '\n' && blockEndsAt(tree, offset)) {
    let cursor = offset
    while (doc[cursor] === '\n') cursor += 1
    // A single newline before the next block is only a separator. Two more
    // newlines leave a paragraph the caret can sit in.
    if (cursor === offset + 1 && cursor < doc.length) return '\n\n'
    return '\n'
  }
  return '\n\n'
}

function blockEndsAt(tree: MdNode, offset: number): boolean {
  let found = false
  const visit = (node: MdNode) => {
    if (
      (node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'blockquote' ||
        node.type === 'list' ||
        node.type === 'code') &&
      node.end === offset
    ) {
      found = true
    }
    node.children.forEach(visit)
  }
  visit(tree)
  return found
}

function listItemPlain(node: MdNode): string {
  return node.children
    .filter((child) => child.type !== 'marker')
    .map(nodeText)
    .join('')
}

function nextBullet(marker: string): string {
  const text = marker.replace(/^\n+/, '')
  const task = /^((?:[-*+]|\d+\.)\s+)\[[ xX]\](\s*)$/.exec(text)
  if (task) return `${task[1]}[ ]${task[2] ?? ''}`
  const ordered = /^(\d+)\.\s$/.exec(text)
  if (ordered?.[1]) return `${Number(ordered[1]) + 1}. `
  return text || '- '
}

interface TableLocation {
  table: MdNode
  row: MdNode
  cell: MdNode
}

function tableLocation(tree: MdNode, offset: number, docLength: number): TableLocation | null {
  const path = pathAt(tree, offset, docLength)
  const table = [...path].reverse().find((node) => node.type === 'table')
  if (!table) return null
  const directCell = [...path].reverse().find((node) => node.type === 'tableCell')
  const directRow = [...path].reverse().find((node) => node.type === 'tableRow')
  if (directCell && directRow) return { table, row: directRow, cell: directCell }
  for (const row of table.children) {
    if (row.type !== 'tableRow') continue
    for (const cell of row.children) {
      if (cell.type === 'tableCell' && offset >= cell.start && offset <= cell.end) return { table, row, cell }
    }
  }
  return null
}

function moveInTable(state: EditorState, located: TableLocation, direction: 1 | -1): EditorState {
  const rows = located.table.children.filter((node) => node.type === 'tableRow')
  const rowIndex = rows.findIndex((row) => row === located.row)
  const cells = located.row.children.filter((node) => node.type === 'tableCell')
  const cellIndex = cells.findIndex((cell) => cell === located.cell)
  const nextIndex = cellIndex + direction
  if (nextIndex >= 0 && nextIndex < cells.length) {
    const next = cells[nextIndex]
    return next ? { ...state, selection: caret(cellCaret(next)) } : state
  }
  const nextRow = rows[rowIndex + direction]
  if (nextRow) {
    const nextCells = nextRow.children.filter((node) => node.type === 'tableCell')
    const next = direction > 0 ? nextCells[0] : nextCells.at(-1)
    return next ? { ...state, selection: caret(cellCaret(next)) } : state
  }
  if (direction < 0) return state
  return insertTableRow(state, located.table)
}

function insertTableRow(state: EditorState, table: MdNode): EditorState {
  const rows = table.children.filter((node) => node.type === 'tableRow')
  const columns = Math.max(1, ...rows.map((row) => row.children.filter((cell) => cell.type === 'tableCell').length))
  const insert = `\n|${'  |'.repeat(columns)}`
  let at = table.end
  if (at > 0 && state.doc[at - 1] === '\n') at -= 1
  const next = applyEdit(state, { from: at, to: at, insert }, caret(at + 2))
  const updated = findNode(parse(next.doc), (node) => node.type === 'table' && node.start === table.start)
  const last = updated?.children.filter((node) => node.type === 'tableRow').at(-1)
  const cell = last?.children.find((node) => node.type === 'tableCell')
  return cell ? { ...next, selection: caret(cellCaret(cell)) } : next
}

function removeTable(state: EditorState, table: MdNode): EditorState {
  let from = table.start
  let to = table.end
  if (state.doc[to] === '\n') to += 1
  if (from > 0 && state.doc[from - 1] === '\n' && (to === state.doc.length || state.doc[to] === '\n')) {
    if (state.doc[to] === '\n') to += 1
    else from -= 1
  }
  return applyEdit(state, { from, to, insert: '' }, caret(from))
}

function splitRow(line: string): string[] {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (body.endsWith('|')) body = body.slice(0, -1)
  const cells: string[] = []
  let current = ''
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (char === '\\' && body[index + 1] === '|') {
      current += '\\|'
      index += 1
      continue
    }
    if (char === '|') {
      cells.push(current)
      current = ''
      continue
    }
    current += char ?? ''
  }
  cells.push(current)
  return cells.length > 0 ? cells : [' ']
}

function joinRow(cells: string[]): string {
  return `|${cells.map((cell) => {
    const inner = cell.trim()
    return inner ? ` ${inner} ` : '  '
  }).join('|')}|`
}

function joinDelimiter(cells: string[]): string {
  return `|${cells.map((cell) => ` ${(cell.trim() || '---')} `).join('|')}|`
}

function isDelimiterCell(cell: string): boolean {
  return /^\s*:?-{3,}:?\s*$/.test(cell)
}

function caretInTable(doc: string, tableStart: number, rowIndex: number, column: number): number {
  const table = findNode(parse(doc), (node) => node.type === 'table' && node.start === tableStart)
  const rows = table?.children.filter((node) => node.type === 'tableRow') ?? []
  const row = rows[Math.max(0, Math.min(rowIndex, rows.length - 1))]
  const cells = row?.children.filter((node) => node.type === 'tableCell') ?? []
  const cell = cells[Math.max(0, Math.min(column, cells.length - 1))]
  return cell ? cellCaret(cell) : tableStart
}

function cellCaret(cell: MdNode): number {
  const text = cell.children.find((node) => node.type === 'text')
  if (text) return text.start
  // An empty cell is only a hidden marker. Sit one step inside it so the caret
  // does not also belong to the previous cell that ends on the same offset.
  return cell.end > cell.start ? cell.start + 1 : cell.start
}

function taskItemAt(tree: MdNode, offset: number, docLength: number): MdNode | null {
  const path = pathAt(tree, offset, docLength)
  const direct = [...path].reverse().find((node) => node.type === 'listItem' && typeof node.checked === 'boolean')
  if (direct) return direct
  return (
    findNode(
      tree,
      (node) => node.type === 'listItem' && typeof node.checked === 'boolean' && offset >= node.start && offset <= node.end,
    ) ?? null
  )
}

function findNode(node: MdNode, test: (node: MdNode) => boolean): MdNode | undefined {
  if (test(node)) return node
  for (const child of node.children) {
    const found = findNode(child, test)
    if (found) return found
  }
  return undefined
}

function shift(selection: TextSelection, pivot: number, delta: number): TextSelection {
  const move = (offset: number) => (offset >= pivot ? offset + delta : offset)
  return { anchor: move(selection.anchor), head: move(selection.head) }
}

function clampSelection(selection: TextSelection, length: number): TextSelection {
  return {
    anchor: clamp(selection.anchor, 0, length),
    head: clamp(selection.head, 0, length),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
