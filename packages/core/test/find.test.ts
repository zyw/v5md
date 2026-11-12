import { describe, expect, it } from 'vitest'
import { listMatches } from '../src/index.ts'
import { runFind } from './internals.ts'
import { createState, findInState, replaceAllMatches, replaceCurrentMatch, undo } from '../src/index.ts'

const caret = { anchor: 0, head: 0 }

describe('find and replace', () => {
  it('matches without case sensitivity unless asked', () => {
    const loose = runFind('Hello hello', caret, 'hello', 1)
    expect(loose.error).toBeNull()
    expect(loose.hit).toEqual({ from: 0, to: 5, index: 1, total: 2 })
    const strict = runFind('Hello hello', caret, 'hello', 1, { caseSensitive: true })
    expect(strict.hit).toEqual({ from: 6, to: 11, index: 1, total: 1 })
  })

  it('treats CJK characters as word characters', () => {
    expect(runFind('云笔记', caret, '笔记', 1, { wholeWord: true }).hit).toBeNull()
    expect(runFind('笔记', caret, '笔记', 1, { wholeWord: true }).hit).toMatchObject({ from: 0, to: 2 })
    expect(runFind('云笔记', caret, '笔记', 1).hit).toMatchObject({ from: 1, to: 3 })
  })

  it('replaces regex groups and leaves a literal dollar sign alone', () => {
    const grouped = replaceAllMatches(createState('a1 a2'), 'a(\\d)', '($1)', { regexp: true })
    expect(grouped.result.error).toBeNull()
    expect(grouped.state.doc).toBe('(1) (2)')
    expect(replaceAllMatches(createState('a'), 'a', '$1').state.doc).toBe('$1')
    expect(replaceAllMatches(createState('a'), '(a)', '[$&]', { regexp: true }).state.doc).toBe('[a]')
  })

  it('rejects an invalid pattern without changing the document', () => {
    const state = createState('abc')
    const found = runFind(state.doc, state.selection, '(', 1, { regexp: true })
    expect(found).toEqual({ hit: null, error: '正则无效' })
    const replaced = replaceAllMatches(state, '(', 'x', { regexp: true })
    expect(replaced.state).toBe(state)
    expect(replaced.result.error).toBe('正则无效')
  })

  it('advances past zero-width matches and skips them when replacing all', () => {
    const found = runFind('ab', caret, 'a*', 1, { regexp: true })
    expect(found.error).toBeNull()
    expect(found.hit?.total).toBeGreaterThan(0)
    const state = createState('ab')
    const replaced = replaceAllMatches(state, 'a*', 'x', { regexp: true })
    expect(replaced.state.doc).toBe('xb')
    const zero = replaceAllMatches(createState('a'), '(?=a)', 'x', { regexp: true })
    expect(zero.state.doc).toBe('a')
    expect(zero.state.history.undos).toHaveLength(0)
  })

  it('records replace-all as one undo step and moves selection without history', () => {
    const state = createState('a a')
    const replaced = replaceAllMatches(state, 'a', 'b')
    expect(replaced.state.doc).toBe('b b')
    expect(replaced.state.history.undos).toHaveLength(1)
    expect(undo(replaced.state).doc).toBe('a a')
    const located = findInState(state, 'a', 1)
    expect(located.state.history).toBe(state.history)
    expect(located.state.selection).toEqual({ anchor: 0, head: 1 })
    const again = replaceCurrentMatch(located.state, 'a', 'c')
    expect(again.state.doc).toBe('c a')
    expect(again.state.history.undos).toHaveLength(1)
    expect(again.result.hit).toEqual({ from: 2, to: 3, index: 1, total: 1 })
  })

  it('lists every match with a stable index', () => {
    const listed = listMatches('Hello hello', 'hello')
    expect(listed.error).toBeNull()
    expect(listed.matches).toEqual([
      { from: 0, to: 5, index: 1, text: 'Hello' },
      { from: 6, to: 11, index: 2, text: 'hello' },
    ])
    expect(listMatches('云笔记', '笔记', { wholeWord: true }).matches).toEqual([])
    expect(listMatches('abc', '(', { regexp: true }).error).toBe('正则无效')
  })

  it('wraps in both directions and stays on the current match when asked', () => {
    const first = runFind('abc abc', caret, 'abc', 1)
    expect(first.hit).toEqual({ from: 0, to: 3, index: 1, total: 2 })
    const second = runFind('abc abc', { anchor: 0, head: 3 }, 'abc', 1)
    expect(second.hit).toEqual({ from: 4, to: 7, index: 2, total: 2 })
    const wrapped = runFind('abc abc', { anchor: 4, head: 7 }, 'abc', 1)
    expect(wrapped.hit).toEqual({ from: 0, to: 3, index: 1, total: 2 })
    const stayed = runFind('abc abc', { anchor: 0, head: 3 }, 'abc', 1, {}, false)
    expect(stayed.hit).toEqual({ from: 0, to: 3, index: 1, total: 2 })
    const previous = runFind('abc abc', { anchor: 4, head: 7 }, 'abc', -1)
    expect(previous.hit).toEqual({ from: 0, to: 3, index: 1, total: 2 })
  })

  it('selects the match under the caret before advancing past it', () => {
    const inside = runFind('hello hello', { anchor: 2, head: 2 }, 'hello', 1)
    expect(inside.hit).toEqual({ from: 0, to: 5, index: 1, total: 2 })
    const partial = runFind('hello hello', { anchor: 1, head: 3 }, 'hello', 1)
    expect(partial.hit).toEqual({ from: 0, to: 5, index: 1, total: 2 })
    const atEnd = runFind('hello hello', { anchor: 5, head: 5 }, 'hello', 1)
    expect(atEnd.hit).toEqual({ from: 6, to: 11, index: 2, total: 2 })
    const backwardInside = runFind('hello hello', { anchor: 8, head: 8 }, 'hello', -1)
    expect(backwardInside.hit).toEqual({ from: 6, to: 11, index: 2, total: 2 })
  })

  it('replaces the match under the caret then advances to the next one', () => {
    const state = { ...createState('hello hello'), selection: { anchor: 2, head: 2 } }
    const replaced = replaceCurrentMatch(state, 'hello', 'hi')
    expect(replaced.state.doc).toBe('hi hello')
    expect(replaced.result.hit).toEqual({ from: 3, to: 8, index: 1, total: 1 })
  })

  it('advances past a no-op replace when the caret sits inside the hit', () => {
    const state = { ...createState('hello hello'), selection: { anchor: 2, head: 2 } }
    const replaced = replaceCurrentMatch(state, 'hello', 'hello')
    expect(replaced.state.doc).toBe('hello hello')
    expect(replaced.result.hit).toEqual({ from: 6, to: 11, index: 2, total: 2 })
  })
})
