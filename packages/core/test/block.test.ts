import { describe, expect, it } from 'vitest'
import { applySlashCommand, convertTopLevelBlock, createState, moveTopLevelBlock, parse, redo, undo } from '../src/index.js'

describe('top-level Markdown block moves', () => {
  it('moves an entire list with one undo step and restores the caret', () => {
    const doc = '# Heading\n\n- first\n- second\n\nTail'
    const blocks = parse(doc).children.filter((node) => node.end > node.start)
    const state = createState(doc)
    state.selection = { anchor: blocks[1].start + 3, head: blocks[1].start + 3 }
    const moved = moveTopLevelBlock(state, blocks[1].start, blocks[2].start, 'after')
    expect(moved.doc).toBe('# Heading\n\nTail\n\n- first\n- second')
    expect(moved.doc.slice(moved.selection.head - 3, moved.selection.head + 2)).toBe('- fir')
    expect(moved.history.undos).toHaveLength(1)
    expect(undo(moved).doc).toBe(doc)
    expect(undo(moved).selection).toEqual(state.selection)
    expect(redo(undo(moved)).doc).toBe(moved.doc)
  })

  it('leaves source untouched for self, stale and frontmatter drops', () => {
    const doc = '---\ntitle: X\n---\n\n# One\n\nTwo'
    const blocks = parse(doc).children.filter((node) => node.end > node.start)
    const state = createState(doc)
    expect(moveTopLevelBlock(state, blocks[1].start, blocks[1].start, 'before')).toBe(state)
    expect(moveTopLevelBlock(state, 999, blocks[2].start, 'before')).toBe(state)
    expect(moveTopLevelBlock(state, blocks[0].start, blocks[2].start, 'before')).toBe(state)
    expect(moveTopLevelBlock(state, blocks[1].start, blocks[0].start, 'before')).toBe(state)
  })

  it('preserves untouched separators, code fences, table and normalized CRLF', () => {
    const doc = 'A\r\n\r\n```js\r\nx()\r\n```\r\n\r\n| x | y |\r\n| - | - |\r\n| 1 | 2 |'
    const state = createState(doc)
    const blocks = parse(state.doc).children.filter((node) => node.end > node.start)
    const moved = moveTopLevelBlock(state, blocks[1].start, blocks[2].start, 'after')
    expect(moved.doc).toBe('A\n\n| x | y |\n| - | - |\n| 1 | 2 |\n\n```js\nx()\n```')
  })
})

describe('slash commands', () => {
  it('replaces slash query and formats in a single undo step', () => {
    const state = createState('/h1')
    state.selection = { anchor: 3, head: 3 }
    const next = applySlashCommand(state, 0, 3, 'heading1')
    expect(next.doc).toBe('# ')
    expect(next.selection.head).toBe(2)
    expect(next.history.undos).toHaveLength(1)
    expect(undo(next).doc).toBe('/h1')
  })

  it('does not run inside a code fence', () => {
    const state = createState('```\n/slash\n```')
    state.selection = { anchor: 10, head: 10 }
    expect(applySlashCommand(state, 4, 10, 'heading1')).toBe(state)
  })
})

describe('block type conversions', () => {
  it('converts a heading to plain text while preserving inline Markdown', () => {
    const state = createState('## **Title**\n\nTail')
    const changed = convertTopLevelBlock(state, 0, 'paragraph')
    expect(changed.doc).toBe('**Title**\n\nTail')
    expect(changed.history.undos).toHaveLength(1)
    expect(undo(changed).doc).toBe(state.doc)
  })

  it('converts every item in a top-level list together', () => {
    const state = createState('- first\n- second\n\nTail')
    expect(convertTopLevelBlock(state, 0, 'taskList').doc).toBe('- [ ] first\n- [ ] second\n\nTail')
  })

  it('refuses lossy conversion of a complex list or code block into a heading', () => {
    const list = createState('- first\n- second')
    const code = createState('```js\nx()\n```')
    expect(convertTopLevelBlock(list, 0, 'heading1')).toBe(list)
    expect(convertTopLevelBlock(code, 0, 'heading1')).toBe(code)
  })
})
