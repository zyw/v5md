// Tables: locate a table cell from an offset, navigate cells and apply table commands.
import { applyChange, applyEdit } from './history.js'
import { findNode, parse, pathAt } from './parse.js'
import { caret, sortedRange, type EditorState, type MdNode } from './types.js'

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

  const from = located.table.start
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

interface TableLocation {
  table: MdNode
  row: MdNode
  cell: MdNode
}

export function tableLocation(tree: MdNode, offset: number, docLength: number): TableLocation | null {
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

export function moveInTable(state: EditorState, located: TableLocation, direction: 1 | -1): EditorState {
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
  return `|${cells
    .map((cell) => {
      const inner = cell.trim()
      return inner ? ` ${inner} ` : '  '
    })
    .join('|')}|`
}

function joinDelimiter(cells: string[]): string {
  return `|${cells.map((cell) => ` ${cell.trim() || '---'} `).join('|')}|`
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
