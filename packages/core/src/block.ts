// Blocks: top-level moves, block splitting, list and empty-block handling, slash commands and indentation.
import { formatBlock, type FormatCommand } from './format.js'
import { applyEdit } from './history.js'
import { findNode, nodeText, parse, pathAt } from './parse.js'
import { moveInTable, tableLocation } from './table.js'
import { insertText } from './text.js'
import { caret, sortedRange, type EditorState, type MdNode, type TextSelection } from './types.js'

export function moveTopLevelBlock(
  state: EditorState,
  sourceStart: number,
  targetStart: number,
  side: 'before' | 'after',
): EditorState {
  const blocks = parse(state.doc).children.filter((node) => node.end > node.start)
  const source = blocks.findIndex((node) => node.start === sourceStart)
  const target = blocks.findIndex((node) => node.start === targetStart)
  if (source < 0 || target < 0 || source === target) return state
  if (blocks[source].type === 'yaml' || blocks[target].type === 'yaml') return state
  const order = blocks.map((_, index) => index)
  order.splice(source, 1)
  const insertion = order.indexOf(target) + (side === 'after' ? 1 : 0)
  order.splice(insertion, 0, source)
  if (order.every((value, index) => value === index)) return state

  // Separator slots stay at their original positions; only complete block source ranges move.
  const prefix = state.doc.slice(0, blocks[0].start)
  const separators = blocks.map((node, index) =>
    state.doc.slice(node.end, blocks[index + 1]?.start ?? state.doc.length),
  )
  let doc = prefix
  let movedStart = 0
  for (let index = 0; index < order.length; index += 1) {
    if (order[index] === source) movedStart = doc.length
    const node = blocks[order[index]]
    doc += state.doc.slice(node.start, node.end) + separators[index]
  }
  const sourceNode = blocks[source]
  const map = (offset: number) =>
    offset >= sourceNode.start && offset <= sourceNode.end ? movedStart + offset - sourceNode.start : movedStart
  const selection = { anchor: map(state.selection.anchor), head: map(state.selection.head) }
  return applyEdit(state, { from: 0, to: state.doc.length, insert: doc }, selection)
}

export type SlashCommand = FormatCommand | 'paragraph' | 'image'

export function applySlashCommand(state: EditorState, from: number, to: number, command: SlashCommand): EditorState {
  if (from !== state.doc.lastIndexOf('\n', from - 1) + 1 || to !== state.selection.head) return state
  if (!/^\/[^\n]*$/.test(state.doc.slice(from, to))) return state
  const path = pathAt(parse(state.doc), from + 1, state.doc.length)
  if (path.some((node) => ['code', 'yaml', 'math', 'table', 'inlineCode'].includes(node.type))) return state
  const removed = {
    ...state,
    doc: state.doc.slice(0, from) + state.doc.slice(to),
    selection: caret(from),
  }
  const formatted =
    command === 'paragraph'
      ? removed
      : command === 'image'
        ? insertText(removed, '![]()')
        : formatBlock(removed, command)
  return applyEdit(state, { from: 0, to: state.doc.length, insert: formatted.doc }, formatted.selection)
}

export type BlockType =
  'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bulletList' | 'orderedList' | 'taskList' | 'quote'

export function convertTopLevelBlock(state: EditorState, start: number, type: BlockType): EditorState {
  const node = parse(state.doc).children.find((child) => child.start === start && child.end > child.start)
  if (!node || !['paragraph', 'heading', 'blockquote', 'list'].includes(node.type)) return state
  const raw = state.doc.slice(node.start, node.end)
  let replacement = raw
  if (node.type === 'list' && ['bulletList', 'orderedList', 'taskList'].includes(type)) {
    const edits: Array<{ start: number; end: number; text: string }> = []
    const collect = (list: MdNode) => {
      list.children
        .filter((item) => item.type === 'listItem')
        .forEach((item, index) => {
          const marker = item.children.find((child) => child.type === 'marker' && child.marker === 'block')
          if (marker) {
            const text =
              type === 'orderedList'
                ? `${index + 1}. `
                : type === 'taskList'
                  ? `- [${item.checked ? 'x' : ' '}] `
                  : '- '
            edits.push({ start: marker.start - node.start, end: marker.end - node.start, text })
          }
          item.children.filter((child) => child.type === 'list').forEach(collect)
        })
    }
    collect(node)
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      replacement = replacement.slice(0, edit.start) + edit.text + replacement.slice(edit.end)
    }
  } else {
    if (node.type === 'list' && (node.children.length !== 1 || raw.includes('\n'))) return state
    if (node.type === 'blockquote' && raw.includes('\n')) return state
    const prefix =
      type === 'paragraph'
        ? ''
        : type === 'heading1'
          ? '# '
          : type === 'heading2'
            ? '## '
            : type === 'heading3'
              ? '### '
              : type === 'orderedList'
                ? '1. '
                : type === 'bulletList'
                  ? '- '
                  : type === 'taskList'
                    ? '- [ ] '
                    : '> '
    const listMarker =
      node.type === 'list' ? node.children[0].children.find((child) => child.type === 'marker') : undefined
    if (node.type === 'list' && !listMarker) return state
    const body =
      node.type === 'list'
        ? raw.slice(listMarker!.end - node.start)
        : node.type === 'heading'
          ? raw.replace(/^#{1,6}[ \t]+/, '')
          : node.type === 'blockquote'
            ? raw.replace(/^>[ \t]?/, '')
            : raw
    replacement = prefix + body
  }
  if (replacement === raw) return state
  const caretOffset = Math.min(replacement.length, Math.max(0, state.selection.head - node.start))
  return applyEdit(state, { from: node.start, to: node.end, insert: replacement }, caret(node.start + caretOffset))
}

export function splitBlock(state: EditorState): EditorState {
  const { from, to } = sortedRange(state.selection)
  const base = from === to ? state : applyEdit(state, { from, to, insert: '' }, caret(from))
  const offset = sortedRange(base.selection).from
  const tree = parse(base.doc)
  const path = pathAt(tree, offset, base.doc.length)
  if (
    path.some(
      (node) => node.type === 'code' || node.type === 'math' || node.type === 'inlineMath' || node.type === 'yaml',
    )
  ) {
    const code = path.find((node) => node.type === 'code')
    const openingFence = code?.children.find(
      (node) => node.type === 'marker' && node.marker === 'fence' && node.end === offset + 1,
    )
    // An auto-completed block already has an empty body line below the
    // opening fence; enter should step into it instead of adding a blank one.
    if (openingFence && base.doc[offset + 1] === '\n') {
      return { ...base, selection: caret(offset + 1) }
    }
    return applyEdit(base, { from: offset, to: offset, insert: '\n' }, caret(offset + 1))
  }
  const tableTarget = tableLocation(tree, offset, base.doc.length)
  if (tableTarget) return moveInTable(base, tableTarget, 1)
  const listItem = [...path].reverse().find((node) => node.type === 'listItem') ?? listItemEndingAt(tree, offset)
  if (listItem && listItemPlain(listItem).trim() === '') {
    const marker = listItem.children.find((node) => node.type === 'marker' && node.marker === 'block')
    if (marker) return exitEmptyListItem(base, marker)
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

export function toggleTask(state: EditorState, offset: number): EditorState {
  const tree = parse(state.doc)
  const located = taskItemAt(tree, offset, state.doc.length)
  if (!located) return state
  const marker = located.children.find((node) => node.type === 'marker' && node.marker === 'block')
  if (!marker?.text) return state
  const insert = marker.text.replace(/\[(?:[ xX])?\]/, located.checked ? '[ ]' : '[x]')
  if (insert === marker.text) return state
  return applyEdit(state, { from: marker.start, to: marker.end, insert }, state.selection)
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

function exitEmptyListItem(state: EditorState, marker: MdNode): EditorState {
  // Nested items carry indentation before the marker; remove it with the
  // marker so the now empty line is a real blank line instead of spaces.
  const lineStart = state.doc.lastIndexOf('\n', marker.start - 1) + 1
  const indent = state.doc.slice(lineStart, marker.start)
  const from = /^[ \t]*$/.test(indent) ? lineStart : marker.start
  // Also drop the line break after the marker so the empty line disappears
  // instead of turning into an empty line inside the list.
  const to = state.doc[marker.end] === '\n' ? marker.end + 1 : marker.end
  const cleared = applyEdit(state, { from, to, insert: '' }, caret(from))
  const parked = paragraphOutsideList(cleared.doc, cleared.selection.head)
  if (parked != null) return { ...cleared, selection: caret(parked) }
  const list = pathAt(parse(cleared.doc), cleared.selection.head, cleared.doc.length).find(
    (node) => node.type === 'list',
  )
  const listEnd = list?.end ?? from
  if (list && from < listEnd) {
    // The empty item sat in the middle of the list. Blank lines cannot split
    // the two halves, because markdown reads items separated by blank lines
    // as one loose list, so leave the list at its end where a paragraph can
    // exist. Otherwise the caret snaps back to the previous item and the next
    // enter recreates the bullet.
    const tail = cleared.doc.slice(listEnd)
    if (tail.trim() === '') {
      return applyEdit(cleared, { from: listEnd, to: cleared.doc.length, insert: '\n\n' }, caret(listEnd + 2))
    }
    const missing = Math.max(0, 3 - (/^\n*/.exec(tail)?.[0].length ?? 0))
    const opened =
      missing > 0
        ? applyEdit(cleared, { from: listEnd, to: listEnd, insert: '\n'.repeat(missing) }, caret(listEnd + missing))
        : cleared
    const spot = paragraphOutsideList(opened.doc, listEnd)
    return spot == null ? opened : { ...opened, selection: caret(spot) }
  }
  // Deleting the marker of a final item leaves only the list's trailing
  // newline. The caret then has no paragraph of its own and the view puts it
  // back on the previous item, so the next enter recreates the bullet.
  const at = cleared.selection.head
  const opened = applyEdit(cleared, { from: at, to: at, insert: '\n' }, caret(at + 1))
  const spot = paragraphOutsideList(opened.doc, opened.selection.head)
  return spot == null ? opened : { ...opened, selection: caret(spot) }
}

function paragraphOutsideList(doc: string, offset: number): number | null {
  const blanks: number[] = []
  const visit = (node: MdNode, inList: boolean) => {
    const nested = inList || node.type === 'list' || node.type === 'listItem'
    if (!nested && node.type === 'paragraph' && node.start === node.end) blanks.push(node.start)
    node.children.forEach((child) => visit(child, nested))
  }
  visit(parse(doc), false)
  if (blanks.includes(offset)) return offset
  return (
    blanks
      .filter((start) => Math.abs(start - offset) <= 2)
      .sort((left, right) => Math.abs(left - offset) - Math.abs(right - offset) || left - right)[0] ?? null
  )
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

function taskItemAt(tree: MdNode, offset: number, docLength: number): MdNode | null {
  const path = pathAt(tree, offset, docLength)
  const direct = [...path].reverse().find((node) => node.type === 'listItem' && typeof node.checked === 'boolean')
  if (direct) return direct
  return (
    findNode(
      tree,
      (node) =>
        node.type === 'listItem' && typeof node.checked === 'boolean' && offset >= node.start && offset <= node.end,
    ) ?? null
  )
}

function shift(selection: TextSelection, pivot: number, delta: number): TextSelection {
  const move = (offset: number) => (offset >= pivot ? offset + delta : offset)
  return { anchor: move(selection.anchor), head: move(selection.head) }
}
