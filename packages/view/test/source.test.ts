import { describe, expect, it } from 'vitest'
import { parse } from '@v5md/core'
import { markdownSpans, sourceLines } from './internals.ts'

function spans(doc: string) {
  return markdownSpans(doc, parse(doc))
}

function textOf(doc: string, className: string): string {
  return spans(doc)
    .filter((span) => span.className.split(' ').includes(className))
    .map((span) => doc.slice(span.start, span.end))
    .join('')
}

function expectTokens(doc: string) {
  const lines = sourceLines(doc, parse(doc))
  expect(lines.map((line) => line.tokens.map((token) => token.text).join('')).join('\n')).toBe(doc)
  let offset = 0
  for (const line of lines) {
    expect(line.start).toBe(offset)
    let cursor = line.start
    for (const token of line.tokens) {
      expect(token.start).toBe(cursor)
      expect(token.end).toBe(cursor + token.text.length)
      expect(token.text).toBe(doc.slice(token.start, token.end))
      cursor = token.end
    }
    expect(cursor).toBe(line.end)
    offset = line.end + 1
  }
  return lines
}

const DOCS = [
  '',
  'a',
  'a\n',
  'a\n\nb\n',
  '# Title\n\n段落 **粗体** *斜体* ~~删除~~ ==高亮== `代码`\n',
  '> 引用\n> 第二行\n\n- [x] 完成\n\n1. 有序\n\n---\n',
  '| a | b |\n| --- | --- |\n| c | d |\n',
  '---\ntitle: 示例\n---\n\n```ts\nconst answer = 1\n```\n',
  '![图](sample.svg =200x)\n\n行内 $x^2$\n',
  'a\\\nb\n',
]

describe('source tokens', () => {
  it('covers every character of every document with exact offsets', () => {
    for (const doc of DOCS) expectTokens(doc)
  })

  it('marks block and inline syntax without changing the text', () => {
    const doc = '# 标题\n\n段落 **粗体** *斜体* ~~删除~~ ==高亮== `代码` [链接](https://example.com)\n'
    expect(textOf(doc, 'v5-md-heading')).toBe('标题')
    expect(textOf(doc, 'v5-md-strong')).toBe('粗体')
    expect(textOf(doc, 'v5-md-em')).toBe('斜体')
    expect(textOf(doc, 'v5-md-strike')).toBe('删除')
    expect(textOf(doc, 'v5-md-highlight')).toBe('高亮')
    expect(textOf(doc, 'v5-md-inline-code')).toBe('代码')
    expect(textOf(doc, 'v5-md-link')).toBe('链接')
    expect(textOf(doc, 'v5-md-url')).toBe('https://example.com)')
    const markers = textOf(doc, 'v5-md-marker')
    expect(markers).toContain('# ')
    expect(markers).toContain('**')
    expect(markers).toContain('`')
  })

  it('paints fences and reuses the fence language for the code body', () => {
    const doc = '```ts\nconst answer = 1\n```\n'
    const keyword = spans(doc).find((span) => span.className.includes('hljs-keyword'))
    expect(keyword).toBeDefined()
    expect(doc.slice(keyword?.start ?? 0, keyword?.end ?? 0)).toBe('const')
    expect(textOf(doc, 'v5-md-code')).toBe('const answer = 1')
    expect(textOf(doc, 'v5-md-marker')).toBe('```ts\n\n```')
  })

  it('does not treat markdown punctuation inside a fence as markup', () => {
    const doc = '```\n**nope**\n```\n'
    expect(textOf(doc, 'v5-md-strong')).toBe('')
    expect(textOf(doc, 'v5-md-code')).toBe('**nope**')
    expect(textOf(doc, 'v5-md-marker')).toBe('```\n\n```')
  })

  it('keeps a fence body split across its lines', () => {
    const doc = '```js\nlet a = 1\nlet b = 2\n```'
    const lines = sourceLines(doc, parse(doc))
    expect(lines[1]?.tokens.map((token) => token.text).join('')).toBe('let a = 1')
    expect(lines[2]?.tokens.map((token) => token.text).join('')).toBe('let b = 2')
  })

  it('styles frontmatter, tables, math and image urls', () => {
    const doc = '---\ntitle: 示例\n---\n\n| a | b |\n| --- | --- |\n| c | d |\n\n行内 $x^2$\n\n![图](sample.svg)\n'
    expect(textOf(doc, 'v5-md-frontmatter')).toContain('title: 示例')
    expect(textOf(doc, 'v5-md-marker')).toContain('| --- | --- |')
    expect(textOf(doc, 'v5-md-math')).toBe('$x^2$')
    expect(textOf(doc, 'v5-md-image')).toBe('![图]')
    expect(textOf(doc, 'v5-md-url')).toBe('(sample.svg)')
  })

  it('keeps blank lines and unknown characters as plain tokens', () => {
    const lines = expectTokens('a\n\nb\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]?.tokens).toEqual([])
    expect(lines[0]?.tokens[0]).toMatchObject({ start: 0, end: 1, text: 'a', className: '' })
    const hard = sourceLines('a\\\nb', parse('a\\\nb'))
    expect(hard.map((line) => line.tokens.map((token) => token.text).join('')).join('\n')).toBe('a\\\nb')
  })

  it('reports a line number for every line', () => {
    const lines = sourceLines('a\n\nb', parse('a\n\nb'))
    expect(lines.map((line) => line.number)).toEqual([1, 2, 3])
  })
})
