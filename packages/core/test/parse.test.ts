import { describe, expect, it } from 'vitest'
import { nodeText, outline, parse, type MdNode } from '../src/index.ts'

function shape(node: MdNode): string {
  const label = `${node.type}${node.marker ? `:${node.marker}` : ''}`
  const body = node.text != null ? JSON.stringify(node.text) : ''
  const children = node.children.map(shape).join('')
  return `${label}(${node.start},${node.end}${body ? `,${body}` : ''})${children ? `[${children}]` : ''}`
}

function collect(node: MdNode, type: MdNode['type']): MdNode[] {
  const found = node.type === type ? [node] : []
  return found.concat(node.children.flatMap((child) => collect(child, type)))
}

function leaves(node: MdNode): MdNode[] {
  if (node.type === 'text' || node.type === 'marker' || node.type === 'hardBreak') return [node]
  return node.children.flatMap(leaves)
}

describe('parse', () => {
  it('gives an empty document a caret paragraph', () => {
    const tree = parse('')
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.type).toBe('paragraph')
    expect(tree.children[0]?.start).toBe(0)
  })

  it('splits heading markers from the title', () => {
    const doc = '# 标题\n'
    const tree = parse(doc)
    expect(shape(tree)).toContain('marker:block')
    expect(shape(tree)).toContain('标题')
    const heading = tree.children[0]
    expect(heading?.type).toBe('heading')
    expect(heading?.depth).toBe(1)
  })

  it('keeps inline markers as separate leaves', () => {
    const tree = parse('支持 **粗体**、*斜体* 和 `代码`')
    const text = shape(tree)
    expect(text).toContain('strong')
    expect(text).toContain('emphasis')
    expect(text).toContain('inlineCode')
    expect(text).toContain('marker:open')
    expect(text).toContain('marker:close')
  })

  it('keeps one bullet marker on each list item', () => {
    const tree = parse('- 第一项\n- 第二项\n  - 嵌套\n')
    const markers: string[] = []
    const visit = (node: MdNode) => {
      if (node.type === 'listItem') {
        markers.push(node.children.find((child) => child.type === 'marker')?.text ?? '')
      }
      node.children.forEach(visit)
    }
    visit(tree)
    expect(markers).toEqual(['- ', '- ', '- '])
  })

  it('parses nested lists and quotes', () => {
    const doc = '- 第一项\n  - 嵌套\n\n> 引用 [链接](https://example.com)\n'
    const tree = parse(doc)
    expect(shape(tree)).toContain('listItem')
    expect(shape(tree)).toContain('blockquote')
    expect(shape(tree)).toContain('link')
  })

  it('keeps unfinished emphasis as plain text', () => {
    const doc = '没有结束 **粗体'
    const tree = parse(doc)
    expect(shape(tree)).not.toContain('strong')
    expect(nodeText(tree)).toContain('**粗体')
  })

  it('does not format markers inside a code fence', () => {
    const doc = '```ts\nconst answer = \'**不是标记**\'\n```\n'
    const tree = parse(doc)
    const code = tree.children.find((node) => node.type === 'code')
    expect(code?.lang).toBe('ts')
    expect(shape(code ?? tree)).not.toContain('strong')
    expect(nodeText(code ?? tree)).toContain('**不是标记**')
  })

  it('keeps a normal blank line between blocks from becoming a paragraph', () => {
    const tree = parse('## 列表示例\n\n- 第一项\n')
    expect(tree.children.map((node) => node.type)).toEqual(['heading', 'list'])
  })

  it('turns an extra blank line between blocks into an empty paragraph', () => {
    const tree = parse('## 列表示例\n\n\n- 第一项\n')
    expect(tree.children.map((node) => node.type)).toEqual(['heading', 'paragraph', 'list'])
    expect(tree.children[1]?.start).toBe(tree.children[1]?.end)
  })

  it('renders trailing blank lines as empty paragraphs and ignores a single trailing newline', () => {
    expect(parse('hello\n').children.map((node) => node.type)).toEqual(['paragraph'])
    const doubled = parse('hello\n\n')
    expect(doubled.children.map((node) => node.type)).toEqual(['paragraph', 'paragraph'])
    expect(doubled.children[1]?.start).toBe('hello\n\n'.length)
  })

  it('gives an empty list item a paragraph the caret can sit in', () => {
    const tree = parse('- 第一项\n- ')
    const items = tree.children[0]?.children.filter((node) => node.type === 'listItem') ?? []
    const second = items[1]
    expect(second?.children.some((node) => node.type === 'paragraph' && node.start === node.end)).toBe(true)
  })

  it('parses task lists, strikethrough, highlight, tables, math and front matter', () => {
    const doc = [
      '---',
      'title: 示例',
      '---',
      '',
      '~~删除~~ 和 ==高亮==',
      '',
      '- [ ] 待办',
      '- [x] 完成',
      '',
      '| 语言 | 用途 |',
      '| --- | --- |',
      '| TypeScript | 编辑器 |',
      '',
      '$E=mc^2$',
      '',
      '$$',
      'a^2',
      '$$',
      '',
    ].join('\n')
    const tree = parse(doc)
    expect(tree.children[0]?.type).toBe('yaml')
    expect(outline(doc).map((item) => item.text)).toEqual([])
    expect(nodeText(tree)).toContain('~~删除~~')
    expect(outline('# 甲\n\n## 乙\n').map((item) => item.text)).toEqual(['甲', '乙'])
    const tasks = collect(tree, 'listItem').map((node) => node.checked)
    expect(tasks).toEqual([false, true])
    const table = collect(tree, 'table')[0]
    expect(table?.children.filter((node) => node.type === 'tableRow')).toHaveLength(2)
    expect(collect(tree, 'inlineMath')[0]?.value).toBe('E=mc^2')
    expect(collect(tree, 'math')[0]?.value).toContain('a^2')
    expect(collect(tree, 'highlight')).toHaveLength(1)
    expect(collect(tree, 'strikethrough')).toHaveLength(1)
    for (const leaf of leaves(tree)) {
      if (leaf.type === 'hardBreak') continue
      expect(doc.slice(leaf.start, leaf.end)).toBe(leaf.text ?? '')
    }
  })

  it('maps every text leaf back onto the source', () => {
    const doc = '# 中英 Title\n\n段落 **bold** 与 `code`。\n\n- 一\n- 二\n'
    const tree = parse(doc)
    for (const leaf of leaves(tree)) {
      if (leaf.type === 'hardBreak') continue
      expect(doc.slice(leaf.start, leaf.end)).toBe(leaf.text ?? '')
    }
  })
})
