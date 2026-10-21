export interface TextSelection {
  anchor: number
  head: number
}

export interface Change {
  from: number
  to: number
  insert: string
}

export interface HistoryEntry {
  undoChange: Change
  redoChange: Change
  selectionBefore: TextSelection
  selectionAfter: TextSelection
}

export interface History {
  undos: HistoryEntry[]
  redos: HistoryEntry[]
}

export interface EditorState {
  doc: string
  selection: TextSelection
  history: History
}

export type MarkerKind = 'block' | 'open' | 'close' | 'fence'

export type NodeType =
  | 'root'
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'list'
  | 'listItem'
  | 'code'
  | 'thematicBreak'
  | 'html'
  | 'text'
  | 'strong'
  | 'emphasis'
  | 'inlineCode'
  | 'strikethrough'
  | 'highlight'
  | 'underline'
  | 'link'
  | 'image'
  | 'hardBreak'
  | 'marker'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'math'
  | 'inlineMath'
  | 'yaml'

export type Align = 'left' | 'right' | 'center' | null

export interface MdNode {
  type: NodeType
  start: number
  end: number
  children: MdNode[]
  text?: string
  marker?: MarkerKind
  depth?: number
  ordered?: boolean
  lang?: string | null
  url?: string
  alt?: string
  title?: string | null
  checked?: boolean | null
  align?: Align[] | null
  value?: string
}

export function caret(offset: number): TextSelection {
  return { anchor: offset, head: offset }
}

export function sortedRange(selection: TextSelection): { from: number; to: number } {
  return selection.anchor <= selection.head
    ? { from: selection.anchor, to: selection.head }
    : { from: selection.head, to: selection.anchor }
}

export function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}
