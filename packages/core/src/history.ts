// Undo history: apply document changes and maintain the undo/redo stacks.
import {
  caret,
  clamp,
  normalizeNewlines,
  type Change,
  type EditorState,
  type History,
  type HistoryEntry,
  type TextSelection,
} from './types.js'

const HISTORY_LIMIT = 200
const COALESCE_LIMIT = 40

/** Creates the initial editor state for a markdown document. */
export function createState(markdown = ''): EditorState {
  const doc = normalizeNewlines(markdown)
  return {
    doc,
    selection: caret(0),
    history: { undos: [], redos: [] },
  }
}

export function applyEdit(state: EditorState, change: Change, selection: TextSelection): EditorState {
  const doc = applyChange(state.doc, change)
  return {
    doc,
    selection: clampSelection(selection, doc.length),
    history: pushHistory(state.history, state.doc, change, state.selection, clampSelection(selection, doc.length)),
  }
}

export function applyChange(doc: string, change: Change): string {
  const from = clamp(change.from, 0, doc.length)
  const to = clamp(change.to, from, doc.length)
  return doc.slice(0, from) + change.insert + doc.slice(to)
}

export function pushHistory(
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
  return (
    previous.selectionAfter.anchor === previous.selectionAfter.head && previous.selectionAfter.anchor === after.from
  )
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

function clampSelection(selection: TextSelection, length: number): TextSelection {
  return {
    anchor: clamp(selection.anchor, 0, length),
    head: clamp(selection.head, 0, length),
  }
}
