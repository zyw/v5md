import { describe, expect, it } from 'vitest'
import {
  createState,
  deleteBackward,
  editTable,
  findMatch,
  formatBlock,
  insertText,
  moveTableCaret,
  parse,
  redo,
  replaceAllText,
  splitBlock,
  toggleMark,
  toggleTask,
  toggleUnderline,
  undo,
} from '../src/index.ts'

function type(initial: string, offset: number, text: string) {
  let state = createState(initial)
  state = { ...state, selection: { anchor: offset, head: offset } }
  for (const char of text) state = insertText(state, char)
  return state
}

describe('edit', () => {
  it('inserts text at the caret and records one undo step for a word', () => {
    const state = type('你好', 2, '世界')
    expect(state.doc).toBe('你好世界')
    expect(state.selection.head).toBe(4)
    expect(state.history.undos).toHaveLength(1)
    expect(undo(state).doc).toBe('你好')
  })

  it('splits a paragraph on enter', () => {
    let state = createState('hello')
    state = { ...state, selection: { anchor: 3, head: 3 } }
    state = splitBlock(state)
    expect(state.doc).toBe('hel\n\nlo')
    expect(state.selection.head).toBe(5)
  })

  it('opens a visible blank line when enter is pressed at the end of a block', () => {
    const doc = '## 列表示例\n\n- 第一项\n'
    let state = createState(doc)
    const end = doc.indexOf('\n')
    state = { ...state, selection: { anchor: end, head: end } }
    state = splitBlock(state)
    const types = parse(state.doc).children.map((node) => node.type)
    expect(types).toEqual(['heading', 'paragraph', 'list'])
    const blank = parse(state.doc).children[1]
    expect(blank?.start).toBe(blank?.end)
    expect(state.selection.head).toBe(blank?.start)
  })

  it('opens a paragraph after a third-level heading that is followed by text', () => {
    const doc = '### 图片\n正文\n'
    let state = createState(doc)
    const end = doc.indexOf('\n')
    state = { ...state, selection: { anchor: end, head: end } }
    state = splitBlock(state)
    expect(state.doc).toBe('### 图片\n\n\n正文\n')
    const children = parse(state.doc).children
    expect(children.map((node) => node.type)).toEqual(['heading', 'paragraph', 'paragraph'])
    expect(children[1]?.start).toBe(children[1]?.end)
    expect(state.selection.head).toBe(children[1]?.start)
  })

  it('adds one trailing paragraph per enter at the end of the document', () => {
    let state = createState('hello')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('hello\n\n')
    expect(parse(state.doc).children).toHaveLength(2)
    expect(state.selection.head).toBe(state.doc.length)
    state = splitBlock(state)
    expect(parse(state.doc).children.filter((node) => node.type === 'paragraph')).toHaveLength(3)
    expect(state.selection.head).toBe(state.doc.length)
  })

  it('continues a list item when the caret is on the item boundary', () => {
    const doc = '- 第一项\n- 第二项\n'
    const item = parse(doc).children[0]?.children.find((node) => node.type === 'listItem')
    let state = createState(doc)
    const offset = item?.end ?? 0
    state = { ...state, selection: { anchor: offset, head: offset } }
    state = splitBlock(state)
    expect(state.doc).toBe('- 第一项\n- \n- 第二项\n')
    const items = parse(state.doc).children[0]?.children.filter((node) => node.type === 'listItem') ?? []
    expect(items).toHaveLength(3)
    const blank = items[1]?.children.find((node) => node.type === 'paragraph')
    expect(state.selection.head).toBe(blank?.start)
  })

  it('continues a list item', () => {
    let state = createState('- 第一项')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('- 第一项\n- ')
  })

  it('inserts a newline inside a code block', () => {
    const doc = '```\nabc\n```'
    let state = createState(doc)
    const inside = doc.indexOf('b') + 1
    state = { ...state, selection: { anchor: inside, head: inside } }
    state = splitBlock(state)
    expect(state.doc).toBe('```\nab\nc\n```')
  })

  it('wraps and unwraps bold', () => {
    let state = createState('hello')
    state = { ...state, selection: { anchor: 0, head: 5 } }
    state = toggleMark(state, '**')
    expect(state.doc).toBe('**hello**')
    state = toggleMark(state, '**')
    expect(state.doc).toBe('hello')
  })

  it('deletes a selected range and a single code point', () => {
    let state = createState('你好')
    state = { ...state, selection: { anchor: 0, head: 1 } }
    state = deleteBackward(state)
    expect(state.doc).toBe('好')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = deleteBackward(state)
    expect(state.doc).toBe('')
  })

  it('continues a task item unchecked', () => {
    let state = createState('- [x] 完成')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('- [x] 完成\n- [ ] ')
  })

  it('toggles a task checkbox and wraps strikethrough', () => {
    let state = createState('- [ ] 待办')
    state = toggleTask(state, 0)
    expect(state.doc).toBe('- [x] 待办')
    state = createState('hello')
    state = { ...state, selection: { anchor: 0, head: 5 } }
    state = toggleMark(state, '~~')
    expect(state.doc).toBe('~~hello~~')
    state = toggleMark(state, '==')
    expect(state.doc).toContain('==')
  })

  it('adds a table row when enter is pressed in the last cell', () => {
    const doc = '| a | b |\n| --- | --- |\n| c | d |'
    const table = parse(doc).children.find((node) => node.type === 'table')
    const last = table?.children.filter((node) => node.type === 'tableRow').at(-1)
    const cell = last?.children.filter((node) => node.type === 'tableCell').at(-1)
    let state = createState(doc)
    const offset = cell?.children.find((node) => node.type === 'text')?.end ?? cell?.end ?? 0
    state = { ...state, selection: { anchor: offset, head: offset } }
    state = splitBlock(state)
    const rows = parse(state.doc).children.find((node) => node.type === 'table')?.children.filter((node) => node.type === 'tableRow')
    expect(rows).toHaveLength(3)
    expect(findMatch('abc abc', 'abc', 1)).toEqual({ from: 4, to: 7 })
    const replaced = replaceAllText(createState('a a'), 'a', 'b')
    expect(replaced.doc).toBe('b b')
    const moved = moveTableCaret(createState(doc), 1)
    expect(moved?.selection.head).not.toBe(0)
  })

  it('edits the focused table from the toolbar commands', () => {
    const doc = '| a | b |\n| --- | --- |\n| c | d |'
    const at = (needle: string) => {
      const state = createState(doc)
      const offset = doc.indexOf(needle)
      return { ...state, selection: { anchor: offset, head: offset } }
    }
    expect(editTable(at('a'), 'insertRowBelow').doc).toBe('| a | b |\n| --- | --- |\n|  |  |\n| c | d |')
    expect(editTable(at('a'), 'insertRowAbove').doc).toBe('|  |  |\n| --- | --- |\n| a | b |\n| c | d |')
    const below = editTable(at('c'), 'insertRowBelow')
    expect(below.doc).toBe('| a | b |\n| --- | --- |\n| c | d |\n|  |  |')
    const caretCell = parse(below.doc).children
      .find((node) => node.type === 'table')
      ?.children.filter((node) => node.type === 'tableRow')
      .at(-1)
      ?.children.find((node) => node.type === 'tableCell')
    expect(below.selection.head).toBe((caretCell?.start ?? 0) + 1)
    expect(editTable(at('c'), 'insertRowAbove').doc).toBe('| a | b |\n| --- | --- |\n|  |  |\n| c | d |')
    const deleted = editTable(at('c'), 'deleteRow')
    expect(deleted.doc).toBe('| a | b |\n| --- | --- |')
    expect(undo(deleted).doc).toBe(doc)
    expect(editTable(at('b'), 'insertColumnRight').doc).toBe('| a | b |  |\n| --- | --- | --- |\n| c | d |  |')
    expect(editTable(at('b'), 'insertColumnLeft').doc).toBe('| a |  | b |\n| --- | --- | --- |\n| c |  | d |')
    expect(editTable(at('b'), 'deleteColumn').doc).toBe('| a |\n| --- |\n| c |')
    const aligned = editTable(at('b'), 'alignCenter')
    expect(aligned.doc).toBe('| a | b |\n| --- | :---: |\n| c | d |')
    expect(parse(aligned.doc).children.find((node) => node.type === 'table')?.align?.[1]).toBe('center')
    expect(editTable(at('b'), 'alignRight').doc).toContain('---:')
    expect(editTable(at('a'), 'deleteTable').doc).toBe('')
    const wrapped = '前文\n\n' + doc + '\n\n后文'
    const inside = createState(wrapped)
    const offset = wrapped.indexOf('a')
    expect(editTable({ ...inside, selection: { anchor: offset, head: offset } }, 'deleteTable').doc).toBe('前文\n\n后文')
  })

  it('formats the current line and wraps inline marks', () => {
    const paragraph = createState('正文')
    expect(formatBlock(paragraph, 'heading1').doc).toBe('# 正文')
    expect(formatBlock(formatBlock(paragraph, 'heading3'), 'heading3').doc).toBe('正文')
    expect(formatBlock(paragraph, 'bulletList').doc).toBe('- 正文')
    expect(formatBlock(paragraph, 'orderedList').doc).toBe('1. 正文')
    expect(formatBlock(paragraph, 'taskList').doc).toBe('- [ ] 正文')
    expect(formatBlock(paragraph, 'quote').doc).toBe('> 正文')
    expect(formatBlock(paragraph, 'code').doc).toBe('```\n正文\n```')
    expect(formatBlock(paragraph, 'rule').doc).toBe('正文\n\n---')
    expect(formatBlock(createState(''), 'table').doc).toBe('|  |  |  |\n| --- | --- | --- |\n|  |  |  |')
    expect(formatBlock(createState(''), 'math').doc).toBe('$$\n\n$$')
    const linked = formatBlock({ ...createState('官网'), selection: { anchor: 0, head: 2 } }, 'link')
    expect(linked.doc).toBe('[官网](https://)')
    expect(linked.selection).toEqual({ anchor: 5, head: 13 })
    const underlined = toggleUnderline({ ...createState('你好'), selection: { anchor: 0, head: 2 } })
    expect(underlined.doc).toBe('<u>你好</u>')
    expect(parse(underlined.doc).children.some((node) => node.type === 'paragraph' && node.children.some((child) => child.type === 'underline'))).toBe(true)
    expect(toggleUnderline(underlined).doc).toBe('你好')
  })

  it('restores a coalesced word with redo', () => {
    const typed = type('', 0, 'ab')
    const undone = undo(typed)
    expect(undone.doc).toBe('')
    expect(redo(undone).doc).toBe('ab')
  })
})
