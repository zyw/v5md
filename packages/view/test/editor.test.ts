import { describe, expect, it } from 'vitest'
import { parse } from '@v5md/core'
import { Editor, htmlToMarkdown } from '../src/index.ts'
import { applyChrome, renderDocument } from './internals.ts'

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
    expect(element.querySelector('h1')?.classList.contains('v5-active')).toBe(true)
    expect(element.querySelector('strong')).not.toBeNull()
    for (const leaf of element.querySelectorAll<HTMLElement>('[data-leaf]')) {
      if (leaf.hasAttribute('data-void')) continue
      const start = Number(leaf.dataset.start)
      const end = Number(leaf.dataset.end)
      const raw = leaf.textContent ?? ''
      const text = leaf.dataset.caret === 'true' || (leaf.querySelector('br') && raw === '') ? '' : raw
      expect(doc.slice(start, end)).toBe(text)
    }
  })

  it('shows inline markers only while the caret is inside them', () => {
    const doc = 'keep **bold**'
    const outside = draw(doc, 0)
    expect(outside.querySelector('strong')?.classList.contains('v5-source-visible')).toBe(false)
    const inside = doc.indexOf('b')
    const focused = draw(doc, inside)
    expect(focused.querySelector('strong')?.classList.contains('v5-source-visible')).toBe(true)
  })

  it('keeps a focused list marker on the same line as the item text', () => {
    const doc = '## 列表示例\n\n- 第一项\n'
    const element = draw(doc, doc.indexOf('第'))
    const item = element.querySelector('li')
    expect(item?.querySelector(':scope > .v5-item-text')?.tagName).toBe('SPAN')
    expect(item?.querySelector(':scope > p')).toBeNull()
    expect(item?.classList.contains('v5-active')).toBe(true)
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

  it('anchors the caret after an empty task checkbox without a line-breaking br', () => {
    const doc = '- [ ] 待办\n- [x] 完成\n- [ ] '
    const element = draw(doc, doc.length)
    const item = [...element.querySelectorAll('li.v5-task')].at(-1)
    const text = item?.querySelector('.v5-item-text .v5-text')
    expect(item?.querySelector('.v5-check')).not.toBeNull()
    expect(text?.dataset.caret).toBe('true')
    expect(text?.querySelector('br')).toBeNull()
    expect(text?.firstChild?.nodeType).toBe(Node.TEXT_NODE)
    expect(text?.textContent).toBe('\u200b')
  })

  it('keeps an empty code block to a single body line', () => {
    const element = draw('```html\n\n```', 8)
    const body = element.querySelector('pre code .v5-text')
    expect(body?.querySelector('.v5-empty-line')).not.toBeNull()
    // A <br> here would add one more line and make the block shrink on input.
    expect(body?.querySelector('br')).toBeNull()
    expect(body?.textContent).toBe('')
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
      element.dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true, cancelable: true }),
      )
    }
    expect(element.querySelector('.v5-slash-menu')).not.toBeNull()
    const option = [...element.querySelectorAll<HTMLButtonElement>('.v5-slash-menu button')].find((button) =>
      button.textContent?.includes('标题 1'),
    )
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
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: '/', bubbles: true, cancelable: true }),
    )
    expect(element.querySelector('.v5-slash-menu')).toBeNull()
    editor.setMarkdown('')
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: '/', bubbles: true, cancelable: true }),
    )
    expect(element.querySelector('.v5-slash-menu')).toBeNull()
    const committed = new CompositionEvent('compositionend', { bubbles: true })
    Object.defineProperty(committed, 'data', { value: '/' })
    element.dispatchEvent(committed)
    expect(element.querySelector('.v5-slash-menu')).not.toBeNull()
    editor.destroy()
  })

  it('closes the block menu from outside or escape and still runs a chosen action', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '## Title\n\nTail' })
    const open = () => {
      editor.focusAt(4)
      element.querySelector<HTMLButtonElement>('.v5-block-handle')?.click()
      expect(element.querySelector('.v5-block-menu')).not.toBeNull()
    }
    open()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(element.querySelector('.v5-block-menu')).toBeNull()
    expect(editor.getMarkdown()).toBe('## Title\n\nTail')

    open()
    element.querySelector('.v5-block-handle')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    element
      .querySelector('[data-block-action="paragraph"]')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(element.querySelector('.v5-block-menu')).not.toBeNull()
    element.querySelector<HTMLButtonElement>('[data-block-action="paragraph"]')?.click()
    expect(editor.getMarkdown()).toBe('Title\n\nTail')

    editor.undo()
    open()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(element.querySelector('.v5-block-menu')).toBeNull()
    expect(editor.getMarkdown()).toBe('## Title\n\nTail')
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

describe('image picking', () => {
  it('opens the file picker when the host does not handle image selection', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'note' })
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!
    let opened = false
    input.addEventListener('click', () => {
      opened = true
    })
    element.querySelector<HTMLButtonElement>('button[data-command="image"]')?.click()
    expect(opened).toBe(true)
    editor.destroy()
  })

  it('asks the host to choose an image instead of opening the file picker', () => {
    const element = document.createElement('div')
    document.body.append(element)
    let picked = 0
    const editor = new Editor({
      element,
      value: 'note',
      onPickImage: () => {
        picked += 1
      },
    })
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!
    let opened = false
    input.addEventListener('click', () => {
      opened = true
    })
    element.querySelector<HTMLButtonElement>('button[data-command="image"]')?.click()
    expect(picked).toBe(1)
    expect(opened).toBe(false)
    editor.destroy()
  })

  it('inserts a chosen image url at the caret', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello' })
    editor.insertImageUrl('https://cdn.example/a.png', '照片')
    expect(editor.getMarkdown()).toContain('![照片](https://cdn.example/a.png)')
    editor.insertImageUrl('   ')
    expect(editor.getMarkdown()).toContain('![照片](https://cdn.example/a.png)')
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
      element,
      value: 'old note',
      onUploadImage: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
      onChange: (markdown) => seen.push(markdown),
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
  it('keeps IME composition inside the document instead of the flex shell', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, placeholder: '开始编写…' })
    const doc = element.querySelector('.v5-doc')
    expect(doc).toBeInstanceOf(HTMLElement)
    expect(element.contentEditable).toBe('false')
    expect(doc?.getAttribute('contenteditable')).toBe('true')
    expect(element.getAttribute('role')).toBeNull()
    expect(doc?.getAttribute('role')).toBe('textbox')
    expect(document.activeElement).not.toBe(element)
    editor.focus()
    expect(document.activeElement).toBe(doc)
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(doc?.classList.contains('v5-composing')).toBe(true)
    const cancelled = new CompositionEvent('compositionend', { bubbles: true })
    Object.defineProperty(cancelled, 'data', { value: '' })
    element.dispatchEvent(cancelled)
    expect(doc?.classList.contains('v5-composing')).toBe(false)
    expect(doc?.getAttribute('data-empty')).toBe('true')
    editor.destroy()
  })

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

  it('writes a complete fenced block and keeps the caret in its body', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element })
    const type = (text: string) => {
      for (const char of text) {
        element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char }))
      }
    }
    type('```')
    expect(editor.getMarkdown()).toBe('```\n\n```')
    expect(element.querySelector('pre code .v5-empty-line')).not.toBeNull()
    type('java')
    expect(editor.getMarkdown()).toBe('```java\n\n```')
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(editor.getMarkdown()).toBe('```java\n\n```')
    type('d')
    expect(editor.getMarkdown()).toBe('```java\nd\n```')
    type('abc')
    expect(editor.getMarkdown()).toBe('```java\ndabc\n```')
    expect(element.querySelector('pre code')?.textContent).toBe('dabc')
    expect(element.querySelector('pre code .v5-empty-line')).toBeNull()
    editor.destroy()
  })

  it('pastes markdown as plain text in source mode', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element })
    editor.setSourceMode(true)
    editor.focusAt(0)
    const html = '<pre>---\ntitle: 示例\n---\n\n# 标题</pre>'
    const text = '---\ntitle: 示例\n---\n\n# 标题'
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [],
        getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? text : ''),
      },
    })
    element.dispatchEvent(event)
    expect(editor.getMarkdown()).toBe(text)
    editor.destroy()
  })

  it('still converts pasted html into markdown outside source mode', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element })
    editor.focusAt(0)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [],
        getData: (type: string) =>
          type === 'text/html' ? '<pre>---\ntitle: 示例\n---</pre>' : '---\ntitle: 示例\n---',
      },
    })
    element.dispatchEvent(event)
    expect(editor.getMarkdown()).toBe('```\n---\ntitle: 示例\n---\n```')
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

  it('leaves a list on the second enter and does not recreate the bullet', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '* 无效列表1\n* 无效列表2\n* 无效列表3'
    const editor = new Editor({ element, value: doc })
    editor.focusAt(doc.length)
    const enter = () =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    enter()
    expect(editor.getMarkdown()).toBe(doc + '\n* ')
    enter()
    expect(editor.getMarkdown()).toBe(doc + '\n\n')
    expect(element.querySelector('li.v5-active')).toBeNull()
    expect(element.querySelector('p.v5-active')).not.toBeNull()
    enter()
    expect(editor.getMarkdown()).toBe(doc + '\n\n\n')
    expect(element.querySelectorAll('li')).toHaveLength(3)
    editor.destroy()
  })

  it('leaves a list from an empty middle item instead of bouncing back', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '* a\n* b\n* c'
    const editor = new Editor({ element, value: doc })
    editor.focusAt(doc.indexOf('b') + 1)
    const enter = () =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    enter()
    expect(editor.getMarkdown()).toBe('* a\n* b\n* \n* c')
    enter()
    expect(editor.getMarkdown()).toBe('* a\n* b\n* c\n\n')
    expect(element.querySelector('li.v5-active')).toBeNull()
    expect(element.querySelector('p.v5-active')).not.toBeNull()
    enter()
    expect(element.querySelectorAll('li')).toHaveLength(3)
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
    expect(element.querySelector('td.v5-active')?.textContent).toBe('')
    editor.destroy()
  })

  it('selects an image name and keeps the preview when the picture is clicked', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '![示意图](sample.svg)\n'
    const editor = new Editor({ element, value: doc })
    const image = element.querySelector('.v5-image')
    expect(image?.querySelector('.v5-image-caption')?.textContent).toBe('示意图')
    expect(image?.classList.contains('v5-source-visible')).toBe(false)
    element.querySelector('img')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(image?.classList.contains('v5-source-visible')).toBe(true)
    expect(image?.querySelector('img')).not.toBeNull()
    expect(document.getSelection()?.toString()).toBe('示意图')
    editor.focusAt(doc.indexOf('sample'))
    expect(editor.getMarkdown()).toBe(doc)
    expect(element.querySelector('.v5-image')?.classList.contains('v5-source-visible')).toBe(true)
    editor.setMarkdown('![](sample.svg)\n')
    expect(element.querySelector('.v5-image-caption')).toBeNull()
    editor.destroy()
  })

  it('shows an image at the size written in its source and updates that size from the corner', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '![示意图](sample.svg =200x100)\n'
    const editor = new Editor({ element, value: doc })
    const image = element.querySelector('img')
    expect(image?.style.width).toBe('200px')
    expect(image?.style.aspectRatio).toBe('200 / 100')
    element.querySelector('img')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    const handle = element.querySelector('.v5-image-resize')
    expect(handle).not.toBeNull()
    handle?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 20, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 70, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 70, pointerId: 1 }))
    expect(editor.getMarkdown()).toBe('![示意图](sample.svg =250x125)\n')
    editor.undo()
    expect(editor.getMarkdown()).toBe(doc)
    editor.destroy()
  })

  it('keeps preview images at their size without accepting a drag', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '![示意图](sample.svg =240x)\n'
    const editor = new Editor({ element, value: doc, editable: false })
    const image = element.querySelector('img')
    expect(image?.style.width).toBe('240px')
    expect(image?.style.height).toBe('auto')
    image?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(element.querySelector('.v5-image')?.classList.contains('v5-source-visible')).toBe(false)
    element
      .querySelector('.v5-image-resize')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, pointerId: 2 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 80, pointerId: 2 }))
    expect(editor.getMarkdown()).toBe(doc)
    editor.destroy()
  })

  it('opens the find bar inside the editor', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello' })
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }))
    const bar = element.querySelector('.v5md-find')
    expect(bar?.parentElement).toBe(element)
    expect(bar?.hasAttribute('hidden')).toBe(false)
    expect(bar?.querySelector('.v5md-find-row')).not.toBeNull()
    expect(element.classList.contains('v5-find-open')).toBe(true)
    expect(element.style.getPropertyValue('--v5-sticky-find-height')).not.toBe('0px')
    editor.destroy()
  })

  it('supports Enter / previous and icon actions in the find bar', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'one two one' })
    editor.openFind()
    const query = element.querySelector<HTMLInputElement>('.v5md-find-query')!
    const status = element.querySelector('.v5md-find-status')
    const previous = element.querySelector<HTMLButtonElement>('.v5md-find-steps .v5md-find-action:first-child')
    const next = element.querySelector<HTMLButtonElement>('.v5md-find-steps .v5md-find-action:last-child')
    const replace = element.querySelectorAll<HTMLButtonElement>('.v5md-find-group:last-of-type .v5md-find-action')
    expect(previous?.querySelector('svg')).not.toBeNull()
    expect(next?.querySelector('svg')).not.toBeNull()
    expect(replace).toHaveLength(2)
    expect(replace[0].querySelector('svg')).not.toBeNull()
    expect(replace[1].querySelector('svg')).not.toBeNull()

    query.value = 'one'
    query.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(status?.textContent).toBe('1/2')
    next?.click()
    expect(status?.textContent).toBe('2/2')
    previous?.click()
    expect(status?.textContent).toBe('1/2')
    query.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    expect(status?.textContent).toBe('2/2')
    editor.destroy()
  })

  it('finds and replaces from a caret inside a match while keeping the find bar focused', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello hello' })
    editor.focusAt(2)
    editor.openFind()
    const query = element.querySelector<HTMLInputElement>('.v5md-find input[type="search"]')
    const replacement = element.querySelectorAll<HTMLInputElement>('.v5md-find input')[1]
    expect(query).toBeTruthy()
    expect(replacement).toBeTruthy()
    query!.value = 'hello'
    replacement!.value = 'hi'
    expect(editor.findNext()).toBe(true)
    expect(document.activeElement).toBe(query)
    editor.replaceNext()
    expect(editor.getMarkdown()).toBe('hi hello')
    expect(document.activeElement).toBe(query)
    editor.destroy()
  })

  it('keeps find-bar typing out of the document', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '---\ntitle: x\n---\n' })
    editor.openFind()
    const query = element.querySelector<HTMLInputElement>('.v5md-find input[type="search"]')
    expect(query).toBeTruthy()
    query!.focus()
    const before = editor.getMarkdown()
    query!.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: 'a',
      }),
    )
    query!.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: 'a' }),
    )
    query!.value = 'a'
    expect(editor.getMarkdown()).toBe(before)
    expect(document.activeElement).toBe(query)
    editor.destroy()
  })

  it('applies case / whole-word / regexp toggles from the find bar', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'Hello hello\n笔记 云笔记' })
    editor.openFind()
    const query = element.querySelector<HTMLInputElement>('.v5md-find-query')!
    const toggles = [...element.querySelectorAll<HTMLButtonElement>('.v5md-find-toggle')]
    const status = element.querySelector('.v5md-find-status')
    expect(toggles).toHaveLength(3)

    query.value = 'hello'
    expect(editor.findNext()).toBe(true)
    expect(status?.textContent).toBe('1/2')

    toggles[0].click() // match case — onOptionsChange re-runs find
    expect(status?.textContent).toBe('1/1')
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true')

    query.value = '笔记'
    toggles[1].click() // whole word
    expect(status?.textContent).toBe('1/1')
    expect(toggles[1].getAttribute('aria-pressed')).toBe('true')

    query.value = 'h\\w+'
    toggles[0].click() // case off
    toggles[1].click() // whole word off
    toggles[2].click() // regexp on
    expect(toggles[2].getAttribute('aria-pressed')).toBe('true')
    expect(status?.textContent).toMatch(/^\d+\/\d+$/)

    query.value = '('
    expect(editor.findNext()).toBe(false)
    expect(status?.textContent).toBe('正则无效')
    editor.destroy()
  })

  it('sends find shortcuts to the host without opening the top bar', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const requests: string[] = []
    const editor = new Editor({
      element,
      value: 'hello',
      onFindRequest(request) {
        requests.push(request.kind)
      },
    })
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true, cancelable: true }))
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'h', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(requests).toEqual(['find', 'replace'])
    expect(element.querySelector('.v5md-find')).toBeNull()
    expect(editor.getMarkdown()).toContain('==')
    editor.destroy()
  })

  it('stays read-only in preview and can return to editing', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const requests: string[] = []
    const editor = new Editor({
      element,
      value: 'hello',
      editable: false,
      onFindRequest(request) {
        requests.push(request.kind)
      },
    })
    const surface = element.querySelector('.v5-doc')
    expect(element.classList.contains('v5-preview')).toBe(true)
    expect(surface?.getAttribute('contenteditable')).toBe('false')
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true, cancelable: true }),
    )
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true, cancelable: true }))
    element.querySelector('[data-block]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(editor.getMarkdown()).toBe('hello')
    expect(element.querySelector('.v5-block-handle')).toBeNull()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }))
    expect(requests).toEqual(['find'])
    editor.setEditable(true)
    expect(surface?.getAttribute('contenteditable')).toBe('true')
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true, cancelable: true }),
    )
    expect(editor.getMarkdown()).toBe('xhello')
    editor.destroy()
  })

  it('toggles task checkboxes while previewing', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const seen: string[] = []
    const editor = new Editor({
      element,
      value: '- [ ] 待办\n- [x] 完成\n',
      editable: false,
      onChange(markdown) {
        seen.push(markdown)
      },
    })
    const toggle = (index: number) => {
      const check = element.querySelectorAll<HTMLButtonElement>('.v5-check')[index]
      check.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    }
    toggle(0)
    expect(editor.getMarkdown()).toBe('- [x] 待办\n- [x] 完成\n')
    expect(seen).toEqual(['- [x] 待办\n- [x] 完成\n'])
    expect(element.querySelectorAll<HTMLButtonElement>('.v5-check')[0].dataset.checked).toBe('true')
    toggle(1)
    expect(editor.getMarkdown()).toBe('- [x] 待办\n- [ ] 完成\n')
    expect(seen).toEqual(['- [x] 待办\n- [x] 完成\n', '- [x] 待办\n- [ ] 完成\n'])
    expect(element.querySelectorAll<HTMLButtonElement>('.v5-check')[1].dataset.checked).toBe('false')
    editor.destroy()
  })

  it('keeps heading marks hidden while previewing', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 一级标题\n', editable: false })
    const heading = element.querySelector('h1')
    const text = heading?.querySelector('.v5-text')
    element.querySelector<HTMLElement>('.v5-doc')?.focus()
    const selection = document.getSelection()
    if (text?.firstChild && selection) {
      selection.setBaseAndExtent(text.firstChild, 0, text.firstChild, 1)
      document.dispatchEvent(new Event('selectionchange'))
    }
    expect(heading?.classList.contains('v5-active')).toBe(false)
    editor.setEditable(true)
    document.dispatchEvent(new Event('selectionchange'))
    expect(heading?.classList.contains('v5-active')).toBe(true)
    editor.destroy()
  })

  it('updates the empty-document placeholder without a rebuild', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, placeholder: '开始编写…' })
    const doc = element.querySelector<HTMLElement>('.v5-doc')
    expect(doc?.dataset.placeholder).toBe('开始编写…')
    editor.setPlaceholder('写点什么')
    expect(doc?.dataset.placeholder).toBe('写点什么')
    expect(element.dataset.placeholder).toBe('写点什么')
    editor.setMarkdown('正文')
    expect(doc?.dataset.placeholder).toBe('写点什么')
    editor.setPlaceholder('')
    expect(doc?.dataset.placeholder).toBe('')
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
    expect(element.querySelectorAll('.v5-toolbar button')).toHaveLength(21)
    expect(element.querySelector('[aria-label="一级标题"]')).not.toBeNull()
    expect(element.querySelector('[aria-label="插入图片文件"]')).not.toBeNull()
    expect(
      [...element.querySelectorAll('.v5-toolbar button')].some((button) =>
        button.getAttribute('aria-label')?.includes('Ctrl'),
      ),
    ).toBe(false)
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

  it('toggles sticky chrome classes for toolbar and outline', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n', toolbarSticky: true })
    expect(element.classList.contains('v5-toolbar-sticky')).toBe(true)
    expect(element.classList.contains('v5-outline-sticky')).toBe(true)
    expect(editor.isToolbarSticky()).toBe(true)
    expect(editor.isOutlineSticky()).toBe(true)
    editor.setToolbarSticky(false)
    editor.setOutlineSticky(false)
    expect(element.classList.contains('v5-toolbar-sticky')).toBe(false)
    expect(element.classList.contains('v5-outline-sticky')).toBe(false)
    editor.setOutlineSticky(true)
    expect(element.classList.contains('v5-outline-sticky')).toBe(true)
    editor.destroy()
  })

  it('jumps to the heading chosen in the outline', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 甲\n\n段落\n\n## 乙\n\n后文\n' })
    const button = [...element.querySelectorAll<HTMLButtonElement>('.v5-outline button')].find(
      (item) => item.textContent === '乙',
    )
    button?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(element.querySelector('h2')?.classList.contains('v5-active')).toBe(true)
    expect(element.querySelector('h1')?.classList.contains('v5-active')).toBe(false)
    editor.destroy()
  })
})

describe('source mode', () => {
  it('paints highlighted lines with line numbers', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc = '# 标题\n\n段落 **粗体** 和 `代码`\n'
    const editor = new Editor({ element, value: doc })
    editor.setSourceMode(true)
    const surface = element.querySelector<HTMLElement>('.v5-source-doc')
    expect(surface?.getAttribute('data-line-numbers')).toBe('true')
    const lines = [...element.querySelectorAll<HTMLElement>('.v5-source-line')]
    expect(lines).toHaveLength(4)
    expect(lines.map((line) => line.dataset.line)).toEqual(['1', '2', '3', '4'])
    expect([...element.querySelectorAll('.v5-source-number')].map((item) => item.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
    expect(element.querySelector('.v5-md-heading')?.textContent).toBe('标题')
    expect(element.querySelector('.v5-md-strong')?.textContent).toBe('粗体')
    expect(element.querySelector('.v5-md-inline-code')?.textContent).toBe('代码')
    expect(element.querySelector('.v5-md-marker')?.textContent).toBe('# ')
    for (const leaf of element.querySelectorAll<HTMLElement>('.v5-source-doc [data-leaf]')) {
      const start = Number(leaf.dataset.start)
      const end = Number(leaf.dataset.end)
      expect(doc.slice(start, end)).toBe(leaf.textContent)
    }
    editor.destroy()
  })

  it('can hide the line numbers column', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'a\nb\n', lineNumbers: false })
    editor.setSourceMode(true)
    expect(element.querySelector('.v5-source-doc')?.getAttribute('data-line-numbers')).toBeNull()
    expect(element.querySelectorAll('.v5-source-number')).toHaveLength(0)
    expect(element.querySelectorAll('.v5-source-line')).toHaveLength(3)
    expect(editor.isLineNumbersVisible()).toBe(false)
    editor.setLineNumbersVisible(true)
    expect(element.querySelectorAll('.v5-source-number')).toHaveLength(3)
    editor.setLineNumbersVisible(false)
    expect(element.querySelectorAll('.v5-source-number')).toHaveLength(0)
    editor.destroy()
  })

  it('moves the caret to a line start when its number is clicked', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n第二行\n' })
    editor.setSourceMode(true)
    editor.focusAt(2)
    element
      .querySelectorAll<HTMLElement>('.v5-source-number')[2]
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'X', bubbles: true, cancelable: true }),
    )
    expect(editor.getMarkdown()).toBe('# 标题\n\nX第二行\n')
    editor.destroy()
  })

  it('maps a caret at the end of a source row back to the newline offset', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'ab\ncd' })
    editor.setSourceMode(true)
    const first = element.querySelector<HTMLElement>('.v5-source-line .v5-text')
    const selection = document.getSelection()
    if (first?.firstChild && selection) {
      selection.setBaseAndExtent(first.firstChild, 2, first.firstChild, 2)
      document.dispatchEvent(new Event('selectionchange'))
    }
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'X', bubbles: true, cancelable: true }),
    )
    expect(editor.getMarkdown()).toBe('abX\ncd')
    editor.destroy()
  })

  it('keeps offsets while typing across source lines', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: 'a\nb' })
    editor.setSourceMode(true)
    editor.focusAt(1)
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(editor.getMarkdown()).toBe('a\n\nb')
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true, cancelable: true }),
    )
    expect(editor.getMarkdown()).toBe('a\nx\nb')
    expect(element.querySelectorAll('.v5-source-line')).toHaveLength(3)
    editor.destroy()
  })

  it('copies the model text without the line numbers', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题' })
    editor.setSourceMode(true)
    editor.selectFindMatch(0, 2)
    let copied = ''
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        setData: (_type: string, value: string) => {
          copied = value
        },
      },
    })
    element.dispatchEvent(event)
    expect(copied).toBe('# ')
    editor.destroy()
  })

  it('restores the rich view when leaving source mode', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n正文\n' })
    editor.setSourceMode(true)
    expect(element.querySelector('.v5-source-doc')).not.toBeNull()
    editor.setSourceMode(false)
    expect(element.querySelector('.v5-source-doc')).toBeNull()
    expect(element.querySelector('.v5-source-line')).toBeNull()
    expect(element.querySelector('h1')?.textContent).toContain('标题')
    editor.destroy()
  })
})

describe('style isolation', () => {
  it('only emits namespaced class names', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const doc =
      '# 标题\n\n段落 **粗体** 和 `代码`\n\n- [x] 待办\n\n> 引用\n\n![图](sample.svg)\n\n```ts\nconst answer = 1\n```\n'
    const editor = new Editor({ element, value: doc })
    editor.focusAt(doc.indexOf('粗体'))
    // hljs- classes come from lowlight; every other class belongs to the v5- namespace.
    const mine = (name: string) => name.startsWith('v5') || name.startsWith('hljs-')
    const rich = [...element.querySelectorAll<HTMLElement>('*')].flatMap((node) => [...node.classList])
    expect(rich.length).toBeGreaterThan(10)
    expect(rich.filter((name) => !mine(name))).toEqual([])
    expect(rich.some((name) => name.startsWith('hljs-'))).toBe(true)
    editor.setSourceMode(true)
    const source = [...element.querySelectorAll<HTMLElement>('*')].flatMap((node) => [...node.classList])
    expect(source.length).toBeGreaterThan(10)
    expect(source.filter((name) => !mine(name))).toEqual([])
    editor.destroy()
  })
})
