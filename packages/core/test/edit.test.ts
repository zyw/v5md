import { describe, expect, it } from 'vitest'
import {
  createState,
  deleteBackward,
  deleteForward,
  editTable,
  findMatch,
  formatBlock,
  insertSoftBreak,
  insertText,
  moveTableCaret,
  parse,
  redo,
  replaceAllText,
  resizeImage,
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

  it('leaves an unordered list when enter is pressed on an empty item', () => {
    let state = createState('* 无效列表1\n* 无效列表2\n* 无效列表3')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('* 无效列表1\n* 无效列表2\n* 无效列表3\n* ')
    state = splitBlock(state)
    expect(state.doc).toBe('* 无效列表1\n* 无效列表2\n* 无效列表3\n\n')
    const blank = parse(state.doc).children.find((node) => node.type === 'paragraph' && node.start === node.end)
    expect(blank).toBeTruthy()
    expect(state.selection.head).toBe(blank?.start)
    state = splitBlock(state)
    const items =
      parse(state.doc)
        .children.find((node) => node.type === 'list')
        ?.children.filter((node) => node.type === 'listItem') ?? []
    expect(items).toHaveLength(3)
    expect(
      parse(state.doc).children.filter((node) => node.type === 'paragraph' && node.start === node.end),
    ).toHaveLength(2)
  })

  it('leaves an ordered list and a dash list the same way', () => {
    for (const initial of ['1. 甲', '- 第一项']) {
      let state = createState(initial)
      state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
      state = splitBlock(splitBlock(state))
      expect(state.doc).toBe(`${initial}\n\n`)
      const blank = parse(state.doc).children.find((node) => node.type === 'paragraph')
      expect(state.selection.head).toBe(blank?.start)
    }
  })

  it('leaves a list from an empty item in the middle of it', () => {
    let state = createState('* a\n* b\n* c')
    const offset = state.doc.indexOf('b') + 1
    state = { ...state, selection: { anchor: offset, head: offset } }
    state = splitBlock(state)
    expect(state.doc).toBe('* a\n* b\n* \n* c')
    state = splitBlock(state)
    // Blank lines cannot split a list into two lists, so the paragraph opens
    // at the end of the list instead of bouncing the caret back to "b".
    expect(state.doc).toBe('* a\n* b\n* c\n\n')
    const blank = parse(state.doc).children.find((node) => node.type === 'paragraph' && node.start === node.end)
    expect(blank).toBeTruthy()
    expect(state.selection.head).toBe(blank?.start)
    const next = splitBlock(state)
    const items = parse(next.doc)
      .children.flatMap((node) => (node.type === 'list' ? node.children : []))
      .filter((node) => node.type === 'listItem')
    expect(items).toHaveLength(3)
  })

  it('leaves an empty middle item before a following paragraph', () => {
    const doc = '* a\n* b\n* c\n\ntail'
    let state = createState(doc)
    const offset = doc.indexOf('b') + 1
    state = { ...state, selection: { anchor: offset, head: offset } }
    state = splitBlock(state)
    expect(state.doc).toBe('* a\n* b\n* \n* c\n\ntail')
    state = splitBlock(state)
    expect(state.doc).toBe('* a\n* b\n* c\n\n\ntail')
    const blank = parse(state.doc).children.find((node) => node.type === 'paragraph' && node.start === node.end)
    expect(blank).toBeTruthy()
    expect(state.selection.head).toBe(blank?.start)
  })

  it('leaves a nested list from its empty final item', () => {
    const doc = '* parent\n  * child1\n  * child2'
    let state = createState(doc)
    state = { ...state, selection: { anchor: doc.length, head: doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('* parent\n  * child1\n  * child2\n* ')
    state = splitBlock(state)
    expect(state.doc).toBe('* parent\n  * child1\n  * child2\n\n')
    const blank = parse(state.doc).children.find((node) => node.type === 'paragraph' && node.start === node.end)
    expect(blank).toBeTruthy()
    expect(state.selection.head).toBe(blank?.start)
  })

  it('inserts a newline inside a code block', () => {
    const doc = '```\nabc\n```'
    let state = createState(doc)
    const inside = doc.indexOf('b') + 1
    state = { ...state, selection: { anchor: inside, head: inside } }
    state = splitBlock(state)
    expect(state.doc).toBe('```\nab\nc\n```')
  })

  it('completes a code fence as soon as the opening fence is typed', () => {
    let state = createState('')
    for (const char of '```') state = insertText(state, char)
    expect(state.doc).toBe('```\n\n```')
    expect(state.selection.head).toBe(3)
    expect(undo(state).doc).toBe('``')
    for (const char of 'java') state = insertText(state, char)
    expect(state.doc).toBe('```java\n\n```')
    state = splitBlock(state)
    expect(state.doc).toBe('```java\n\n```')
    expect(state.selection.head).toBe(8)
    for (const char of 'dabc') state = insertText(state, char)
    expect(state.doc).toBe('```java\ndabc\n```')
  })

  it('completes a tilde fence too', () => {
    let state = createState('')
    for (const char of '~~~') state = insertText(state, char)
    expect(state.doc).toBe('~~~\n\n~~~')
  })

  it('does not complete a fence typed after text on the line', () => {
    let state = createState('ab')
    state = { ...state, selection: { anchor: 2, head: 2 } }
    for (const char of '```') state = insertText(state, char)
    expect(state.doc).toBe('ab```')
  })

  it('keeps a tight closing fence on its own line while typing', () => {
    let state = createState('```java\n```')
    state = { ...state, selection: { anchor: 8, head: 8 } }
    state = insertText(state, 'd')
    expect(state.doc).toBe('```java\nd\n```')
    expect(state.selection.head).toBe(9)
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
    const items = parse(state.doc).children[0]?.children.filter((node) => node.type === 'listItem') ?? []
    expect(items.map((node) => node.checked)).toEqual([true, false])
    expect(items[1]?.children.some((node) => node.type === 'marker' && /\[ \]/.test(node.text ?? ''))).toBe(true)
  })

  it('leaves a task list when enter is pressed on an empty task item', () => {
    let state = createState('- [x] 完成')
    state = { ...state, selection: { anchor: state.doc.length, head: state.doc.length } }
    state = splitBlock(state)
    expect(state.doc).toBe('- [x] 完成\n- [ ] ')
    state = splitBlock(state)
    expect(state.doc).toBe('- [x] 完成\n\n')
    const blank = parse(state.doc).children.find((node) => node.type === 'paragraph' && node.start === node.end)
    expect(blank).toBeTruthy()
    expect(state.selection.head).toBe(blank?.start)
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

  it('leaves the table when enter is pressed in the last cell', () => {
    const doc = '| a | b |\n| --- | --- |\n| c | d |'
    const table = parse(doc).children.find((node) => node.type === 'table')
    const last = table?.children.filter((node) => node.type === 'tableRow').at(-1)
    const cell = last?.children.filter((node) => node.type === 'tableCell').at(-1)
    const offset = cell?.children.find((node) => node.type === 'text')?.end ?? cell?.end ?? 0
    const at = { ...createState(doc), selection: { anchor: offset, head: offset } }
    const state = splitBlock(at)
    // Enter keeps every row and opens a blank paragraph below the table.
    expect(state.doc).toBe('| a | b |\n| --- | --- |\n| c | d |\n\n')
    const children = parse(state.doc).children
    expect(children.map((node) => node.type)).toEqual(['table', 'paragraph'])
    const blank = children[1]
    expect(blank?.start).toBe(blank?.end)
    expect(state.selection.head).toBe(blank?.start)
    // Tab on the very last cell still appends a row.
    const tabbed = moveTableCaret(at, 1)
    expect(
      parse(tabbed?.doc ?? '')
        .children.find((node) => node.type === 'table')
        ?.children.filter((node) => node.type === 'tableRow'),
    ).toHaveLength(3)
  })

  it('writes a soft break inside a table cell as <br>', () => {
    const doc = '| a | b |\n| --- | --- |\n| c | d |'
    const table = parse(doc).children.find((node) => node.type === 'table')
    const last = table?.children.filter((node) => node.type === 'tableRow').at(-1)
    const cell = last?.children.filter((node) => node.type === 'tableCell').at(-1)
    const offset = cell?.children.find((node) => node.type === 'text')?.end ?? cell?.end ?? 0
    const at = { ...createState(doc), selection: { anchor: offset, head: offset } }
    const state = insertSoftBreak(at)
    expect(state.doc).toBe('| a | b |\n| --- | --- |\n| c | d<br> |')
    expect(state.selection.head).toBe(offset + '<br>'.length)
    expect(
      parse(state.doc)
        .children.find((node) => node.type === 'table')
        ?.children.filter((node) => node.type === 'tableRow'),
    ).toHaveLength(2)
  })

  it('removes a whole <br> with one backspace or delete', () => {
    for (const tag of ['<br>', '<br/>', '<br />']) {
      const doc = '| a | b |\n| --- | --- |\n| c | d' + tag + ' |'
      const at = doc.indexOf(tag) + tag.length
      const back = deleteBackward({ ...createState(doc), selection: { anchor: at, head: at } })
      expect(back.doc).toBe('| a | b |\n| --- | --- |\n| c | d |')
      const start = doc.indexOf(tag)
      const forward = deleteForward({ ...createState(doc), selection: { anchor: start, head: start } })
      expect(forward.doc).toBe('| a | b |\n| --- | --- |\n| c | d |')
    }
  })

  it('finds and replaces text', () => {
    expect(findMatch('abc abc', 'abc', 1)).toEqual({ from: 4, to: 7 })
    const replaced = replaceAllText(createState('a a'), 'a', 'b')
    expect(replaced.doc).toBe('b b')
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
    const caretCell = parse(below.doc)
      .children.find((node) => node.type === 'table')
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
    expect(editTable({ ...inside, selection: { anchor: offset, head: offset } }, 'deleteTable').doc).toBe(
      '前文\n\n后文',
    )
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
    expect(
      parse(underlined.doc).children.some(
        (node) => node.type === 'paragraph' && node.children.some((child) => child.type === 'underline'),
      ),
    ).toBe(true)
    expect(toggleUnderline(underlined).doc).toBe('你好')
  })

  it('applies list and quote commands to every line in a multi-line selection', () => {
    const doc = '的\n阿爸\n独挡'
    const all = { ...createState(doc), selection: { anchor: 0, head: doc.length } }
    expect(formatBlock(all, 'orderedList').doc).toBe('1. 的\n1. 阿爸\n1. 独挡')
    expect(formatBlock(all, 'bulletList').doc).toBe('- 的\n- 阿爸\n- 独挡')
    expect(formatBlock(all, 'taskList').doc).toBe('- [ ] 的\n- [ ] 阿爸\n- [ ] 独挡')
    expect(formatBlock(all, 'quote').doc).toBe('> 的\n> 阿爸\n> 独挡')
    for (const command of ['orderedList', 'bulletList', 'taskList', 'quote'] as const) {
      const changed = formatBlock(all, command)
      expect(changed.history.undos).toHaveLength(1)
      expect(undo(changed).doc).toBe(doc)
      const restored = formatBlock({ ...changed, selection: { anchor: 0, head: changed.doc.length } }, command)
      expect(restored.doc).toBe(doc)
    }
    const partial = { ...createState('aa\nbb'), selection: { anchor: 1, head: 4 } }
    expect(formatBlock(partial, 'bulletList').doc).toBe('- aa\n- bb')
  })

  it('restores a coalesced word with redo', () => {
    const typed = type('', 0, 'ab')
    const undone = undo(typed)
    expect(undone.doc).toBe('')
    expect(redo(undone).doc).toBe('ab')
  })

  it('records an image size change as one undo step', () => {
    const initial = createState('![图](a.png "标题")\n')
    const inside = { ...initial, selection: { anchor: 2, head: 3 } }
    const width = resizeImage(inside, 240)
    expect(width.doc).toBe('![图](a.png "标题" =240x)\n')
    const both = resizeImage(width, 240, 160)
    expect(both.doc).toBe('![图](a.png "标题" =240x160)\n')
    expect(undo(both).doc).toBe('![图](a.png "标题" =240x)\n')
    expect(resizeImage(initial, 0).doc).toBe(initial.doc)
    expect(resizeImage({ ...createState('正文'), selection: { anchor: 0, head: 1 } }, 80).doc).toBe('正文')
  })
})
