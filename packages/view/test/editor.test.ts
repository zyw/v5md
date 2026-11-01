import { describe, expect, it } from 'vitest'
import { parse } from '@v5md/core'
import { applyChrome } from '../src/selection.ts'
import { renderDocument } from '../src/render.ts'
import { Editor } from '../src/editor.ts'
import { htmlToMarkdown } from '../src/html-to-md.ts'

function draw(doc: string, head = 0) {
  const element = document.createElement('div')
  document.body.append(element)
  renderDocument(element, { doc, head, anchor: head, placeholder: '开始编写…' }, parse(doc))
  applyChrome(element, head, head, doc.length)
  return element
}

describe('render', () => {
  it('renders a heading and keeps source offsets on every leaf', () => {
    const doc = '# Title\n\n段落 **粗体**\n'
    const element = draw(doc, 2)
    expect(element.querySelector('h1')?.textContent).toContain('Title')
    expect(element.querySelector('h1')?.classList.contains('is-active')).toBe(true)
    expect(element.querySelector('strong')).not.toBeNull()
    for (const leaf of element.querySelectorAll<HTMLElement>('[data-leaf]')) {
      if (leaf.hasAttribute('data-void')) continue
      const start = Number(leaf.dataset.start)
      const end = Number(leaf.dataset.end)
      const text = leaf.querySelector('br') && leaf.textContent === '' ? '' : (leaf.textContent ?? '')
      expect(doc.slice(start, end)).toBe(text)
    }
  })

  it('shows inline markers only while the caret is inside them', () => {
    const doc = 'keep **bold**'
    const outside = draw(doc, 0)
    expect(outside.querySelector('strong')?.classList.contains('is-source')).toBe(false)
    const inside = doc.indexOf('b')
    const focused = draw(doc, inside)
    expect(focused.querySelector('strong')?.classList.contains('is-source')).toBe(true)
  })

  it('keeps a focused list marker on the same line as the item text', () => {
    const doc = '## 列表示例\n\n- 第一项\n'
    const element = draw(doc, doc.indexOf('第'))
    const item = element.querySelector('li')
    expect(item?.querySelector(':scope > .v5-item-text')?.tagName).toBe('SPAN')
    expect(item?.querySelector(':scope > p')).toBeNull()
    expect(item?.classList.contains('is-active')).toBe(true)
  })

  it('highlights a typescript code block without changing the source text', () => {
    const doc = '```ts\nconst answer = 1\n```\n'
    const element = draw(doc, doc.indexOf('const'))
    const keyword = element.querySelector('.hljs-keyword')
    expect(keyword?.textContent).toBe('const')
    const code = [...element.querySelectorAll('code [data-leaf]')].map((leaf) => leaf.textContent).join('')
    expect(code).toBe('const answer = 1')
  })

  it('renders task checkboxes, tables, highlight and math', () => {
    const doc = '- [ ] 待办\n\n~~删除~~ ==高亮==\n\n| a | b |\n| --- | --- |\n| c | d |\n\n$E=mc^2$\n'
    const element = draw(doc, 0)
    expect(element.querySelector('.v5-check')).not.toBeNull()
    expect(element.querySelector('del')?.textContent).toContain('删除')
    expect(element.querySelector('mark')?.textContent).toContain('高亮')
    expect(element.querySelectorAll('td')).toHaveLength(2)
    expect(element.querySelector('td')?.textContent).toBe('c')
    expect(element.querySelector('.katex')).not.toBeNull()
  })

  it('preserves code markers as text', () => {
    const doc = '```ts\n**nope**\n```\n'
    const element = draw(doc, doc.indexOf('*'))
    expect(element.querySelector('pre')?.textContent).toContain('**nope**')
    expect(element.querySelector('strong')).toBeNull()
  })
})

describe('block chrome', () => {
  it('converts the selected heading to paragraph and an entire list to tasks', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '## Title\n\n- a\n- b' })
    editor.focusAt(4)
    element.querySelector<HTMLButtonElement>('.v5-block-handle')?.click()
    element.querySelector<HTMLButtonElement>('[data-block-action="paragraph"]')?.click()
    expect(editor.getMarkdown()).toBe('Title\n\n- a\n- b')
    editor.focusAt(editor.getMarkdown().indexOf('a'))
    element.querySelector<HTMLButtonElement>('.v5-block-handle')?.click()
    element.querySelector<HTMLButtonElement>('[data-block-action="taskList"]')?.click()
    expect(editor.getMarkdown()).toBe('Title\n\n- [ ] a\n- [ ] b')
    editor.destroy()
  })

  it('shows a keyboard reachable handle for the focused top-level block', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '- a\n- b\n\nTail'
    const editor = new Editor({ element, value: doc })
    editor.focusAt(doc.indexOf('a'))
    expect(element.querySelector('.v5-block-handle')).not.toBeNull()
    editor.destroy()
  })

  it('moves the currently focused block after focus changes', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '- a\n- b\n\nTail'
    const editor = new Editor({ element, value: doc })
    editor.focusAt(doc.indexOf('a'))
    editor.focusAt(doc.indexOf('Tail'))
    element.querySelector<HTMLButtonElement>('.v5-block-handle')?.click()
    element.querySelector<HTMLButtonElement>('[data-block-action="up"]')?.click()
    expect(editor.getMarkdown()).toBe('Tail\n\n- a\n- b')
    editor.destroy()
  })

  it('shows slash commands after line-start input and executes as one undo step', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element })
    for (const char of '/h1') {
      element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true, cancelable: true }))
    }
    expect(element.querySelector('.v5-slash-menu')).not.toBeNull()
    const option = [...element.querySelectorAll<HTMLButtonElement>('.v5-slash-menu button')].find(button => button.textContent?.includes('标题 1'))
    option?.click()
    expect(editor.getMarkdown()).toBe('# ')
    editor.undo()
    expect(editor.getMarkdown()).toBe('/h1')
    editor.destroy()
  })

  it('ignores slash inside a code fence and while composing', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '```\n\n```' })
    editor.focusAt(4)
    element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '/', bubbles: true, cancelable: true }))
    expect(element.querySelector('.v5-slash-menu')).toBeNull()
    editor.setMarkdown('')
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: '/', bubbles: true, cancelable: true }))
    expect(element.querySelector('.v5-slash-menu')).toBeNull()
    const committed = new CompositionEvent('compositionend', { bubbles: true })
    Object.defineProperty(committed, 'data', { value: '/' })
    element.dispatchEvent(committed)
    expect(element.querySelector('.v5-slash-menu')).not.toBeNull()
    editor.destroy()
  })

  it('moves the list as one block from the handle action and supports undo', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '- a\n- b\n\nTail' })
    const list = element.querySelector('.v5-doc > ul')!
    list.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(element.querySelector('.v5-block-handle')).not.toBeNull()
    element.querySelector<HTMLButtonElement>('.v5-block-handle')?.click()
    element.querySelector<HTMLButtonElement>('[data-block-action="down"]')?.click()
    expect(editor.getMarkdown()).toBe('Tail\n\n- a\n- b')
    editor.undo()
    expect(editor.getMarkdown()).toBe('- a\n- b\n\nTail')
    editor.destroy()
  })
})

describe('async uploads', () => {
  it('ignores a completed upload after the editor was destroyed on note switch', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    let finish!: (url: string) => void
    const seen: string[] = []
    const editor = new Editor({
      element, value: 'old note',
      onUploadImage: () => new Promise(resolve => { finish = resolve }),
      onChange: markdown => seen.push(markdown),
    })
    editor.insertImageFile(new File(['a'], 'picture.png', { type: 'image/png' }))
    editor.destroy()
    finish('https://example.test/picture.png')
    await Promise.resolve()
    await Promise.resolve()
    expect(seen).toEqual([])
  })
})

describe('htmlToMarkdown', () => {
  it('converts headings, emphasis, lists and links', () => {
    const markdown = htmlToMarkdown(
      '<h1>标题</h1><p>这是<strong>粗体</strong>和<a href="https://example.com">链接</a></p><ul><li>一</li><li>二</li></ul>',
    )
    expect(markdown).toContain('# 标题')
    expect(markdown).toContain('**粗体**')
    expect(markdown).toContain('[链接](https://example.com)')
    expect(markdown).toContain('- 一')
    expect(markdown).toContain('- 二')
  })
})

describe('Editor', () => {
  it('types through beforeinput and emits markdown', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const seen: string[] = []
    const editor = new Editor({
      element,
      value: 'hello',
      onChange(markdown) {
        seen.push(markdown)
      },
    })
    element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '!' }))
    expect(editor.getMarkdown()).toBe('!hello')
    expect(seen).toEqual(['!hello'])
    editor.destroy()
  })

  it('ignores an echoed external value', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'same' })
    editor.setMarkdown('same')
    expect(editor.getMarkdown()).toBe('same')
    editor.setMarkdown('next')
    expect(editor.getMarkdown()).toBe('next')
    editor.destroy()
  })

  it('shows a new blank line when enter is pressed at the end of a heading', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '## 列表示例\n\n- 第一项\n'
    const editor = new Editor({ element, value: doc })
    const text = [...element.querySelectorAll<HTMLElement>('.v5-text')].find((leaf) => leaf.textContent === '列表示例')
    const selection = document.getSelection()
    if (text?.firstChild && selection) {
      const end = text.firstChild.textContent?.length ?? 0
      selection.setBaseAndExtent(text.firstChild, end, text.firstChild, end)
      document.dispatchEvent(new Event('selectionchange'))
    }
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(editor.getMarkdown()).toBe('## 列表示例\n\n\n- 第一项\n')
    expect(element.querySelectorAll('h2, p, ul').length).toBeGreaterThanOrEqual(3)
    const docRoot = element.querySelector('.v5-doc')
    expect([...(docRoot?.children ?? [])].some((child) => child.tagName === 'P' && child.textContent === '')).toBe(true)
    editor.destroy()
  })

  it('shows a table toolbar and inserts a row below the focused cell', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '| 语言 | 用途 |\n| --- | --- |\n| TypeScript | 编辑器 |\n'
    const editor = new Editor({ element, value: doc })
    expect(element.querySelector('.v5-tablebar')).toBeNull()
    editor.focusAt(doc.indexOf('TypeScript'))
    const bar = element.querySelector('.v5-tablebar')
    expect(bar?.querySelectorAll('button')).toHaveLength(10)
    expect(bar?.querySelector('[aria-label="上方插入行"]')).not.toBeNull()
    bar?.querySelector<HTMLButtonElement>('[data-command="insertRowBelow"]')?.click()
    expect(editor.getMarkdown()).toBe('| 语言 | 用途 |\n| --- | --- |\n| TypeScript | 编辑器 |\n|  |  |\n')
    expect(element.querySelectorAll('tbody td')).toHaveLength(4)
    expect(element.querySelector('td.is-active')?.textContent).toBe('')
    editor.destroy()
  })

  it('selects an image name and keeps the preview when the picture is clicked', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '![示意图](sample.svg)\n'
    const editor = new Editor({ element, value: doc })
    const image = element.querySelector('.v5-image')
    expect(image?.querySelector('.v5-image-caption')?.textContent).toBe('示意图')
    expect(image?.classList.contains('is-source')).toBe(false)
    element.querySelector('img')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(image?.classList.contains('is-source')).toBe(true)
    expect(image?.querySelector('img')).not.toBeNull()
    expect(document.getSelection()?.toString()).toBe('示意图')
    editor.focusAt(doc.indexOf('sample'))
    expect(editor.getMarkdown()).toBe(doc)
    expect(element.querySelector('.v5-image')?.classList.contains('is-source')).toBe(true)
    editor.setMarkdown('![](sample.svg)\n')
    expect(element.querySelector('.v5-image-caption')).toBeNull()
    editor.destroy()
  })

  it('opens the find bar inside the editor', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello' })
    editor.openFind()
    const bar = element.querySelector('.v5md-find')
    expect(bar?.parentElement).toBe(element)
    expect(bar?.hasAttribute('hidden')).toBe(false)
    editor.destroy()
  })

  it('toggles bold from the current selection', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello' })
    const text = element.querySelector('.v5-text')
    const selection = document.getSelection()
    if (text?.firstChild && selection) {
      selection.setBaseAndExtent(text.firstChild, 0, text.firstChild, 5)
      element.dispatchEvent(new Event('selectionchange'))
      document.dispatchEvent(new Event('selectionchange'))
    }
    editor.toggleBold()
    expect(editor.getMarkdown()).toBe('**hello**')
    editor.destroy()
  })

  it('shows the outline and toolbar, and can hide each one', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n正文\n' })
    expect(element.querySelectorAll('.v5-toolbar button')).toHaveLength(20)
    expect(element.querySelector('[aria-label="一级标题"]')).not.toBeNull()
    expect(element.querySelector('[aria-label="插入图片文件"]')).not.toBeNull()
    expect([...element.querySelectorAll('.v5-toolbar button')].some((button) => button.getAttribute('aria-label')?.includes('Ctrl'))).toBe(false)
    expect(element.querySelector('.v5-outline')?.textContent).toContain('标题')
    editor.focusAt(editor.getMarkdown().indexOf('正文'))
    element.querySelector<HTMLButtonElement>('[data-command="heading2"]')?.click()
    expect(editor.getMarkdown()).toBe('# 标题\n\n## 正文\n')
    editor.setToolbarVisible(false)
    editor.setOutlineVisible(false)
    expect(element.querySelector('.v5-toolbar')?.hidden).toBe(true)
    expect(element.querySelector('.v5-outline')?.hidden).toBe(true)
    editor.setToolbarVisible(true)
    editor.setOutlineVisible(true)
    expect(element.querySelector('.v5-toolbar')?.hidden).toBe(false)
    expect(element.querySelector('.v5-outline')?.hidden).toBe(false)
    editor.destroy()
  })

  it('jumps to the heading chosen in the outline', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 甲\n\n段落\n\n## 乙\n\n后文\n' })
    const button = [...element.querySelectorAll<HTMLButtonElement>('.v5-outline button')].find((item) => item.textContent === '乙')
    button?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(element.querySelector('h2')?.classList.contains('is-active')).toBe(true)
    expect(element.querySelector('h1')?.classList.contains('is-active')).toBe(false)
    editor.destroy()
  })
})
