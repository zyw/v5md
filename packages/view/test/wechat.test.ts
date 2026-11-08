import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/editor/editor.ts'
import { copyRichText, toWechatHtml } from '../src/convert/wechat.ts'

describe('toWechatHtml', () => {
  it('converts blocks and inline marks to inline-styled html', () => {
    const html = toWechatHtml(
      '# 标题\n\n正文 **加粗** *斜体* [链接](https://example.com)\n\n> 引用\n\n- [x] 完成\n  - 嵌套',
    )
    expect(html).toContain('<section style="font-family:')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('class=')
    expect(html).toContain('<h1')
    expect(html).toContain('font-size:24px')
    expect(html).toContain('<strong style="font-weight:700;">加粗</strong>')
    expect(html).toContain('<em style="font-style:italic;">斜体</em>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('<blockquote')
    expect(html).toContain('✓')
    expect(html).not.toContain('**')
  })

  it('keeps syntax colors and table alignment inline', () => {
    const html = toWechatHtml('```ts\nconst a = 1\n```\n\n| a | b |\n| :- | -: |\n| 1 | 2 |')
    expect(html).toContain('<pre style="')
    expect(html).toContain('color:#d73a49;')
    expect(html).toContain('<table style="')
    expect(html).toContain('text-align:right;')
    expect(html).not.toContain('class="hljs')
  })

  it('escapes raw html and keeps math and mermaid source readable', () => {
    const html = toWechatHtml('<script>alert(1)</script>\n\n$$x^2$$\n\n```mermaid\ngraph TD;\nA-->B;\n```')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('x^2')
    expect(html).toContain('graph TD;')
  })

  it('escapes image urls and keeps image captions', () => {
    const html = toWechatHtml('![照片](https://example.com/a.png?x=1&y=2)')
    expect(html).toContain('src="https://example.com/a.png?x=1&amp;y=2"')
    expect(html).toContain('照片')
    expect(html).toContain('<img')
  })

  it('resolves relative image urls for the WeChat editor', () => {
    const html = toWechatHtml('![图](sample.svg)', { baseUrl: 'https://example.com/post/' })
    expect(html).toContain('src="https://example.com/post/sample.svg"')
  })
})

describe('WeChat copy', () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exposes wechat html and a toolbar button', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题' })
    expect(element.querySelector('button[data-command="wechat"]')).not.toBeNull()
    expect(editor.getWechatHtml()).toContain('<h1')
    editor.destroy()
    element.remove()
  })

  it('copies rich text and shows the button state', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n正文 **加粗**' })
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })

    const captured: Record<string, Blob>[] = []
    class FakeClipboardItem {
      constructor(data: Record<string, Blob>) {
        captured.push(data)
      }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)

    await expect(editor.copyForWechat()).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const html = await captured[0]!['text/html'].text()
    const plain = await captured[0]!['text/plain'].text()
    expect(html).toContain('<strong style="font-weight:700;">加粗</strong>')
    expect(html).toContain('<section style="')
    expect(plain).toContain('加粗')
    expect(plain).toContain('<section style="')
    expect(plain).not.toContain('**')
    const button = element.querySelector<HTMLButtonElement>('button[data-command="wechat"]')
    expect(button?.dataset.state).toBe('done')
    expect(button?.dataset.label).toBe('已复制到公众号')

    editor.destroy()
    element.remove()
  })

  it('copies rendered content instead of markdown in WYSIWYG mode', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n正文 **加粗**' })
    const doc = element.querySelector('.v5-doc')
    expect(doc).not.toBeNull()
    const range = document.createRange()
    range.selectNodeContents(doc!)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const data = new Map<string, string>()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (type: string, value: string) => data.set(type, value) },
    })
    element.dispatchEvent(event)
    expect(data.get('text/html')).toContain('<strong')
    expect(data.get('text/html')).not.toContain('**')
    expect(data.get('text/plain')).not.toContain('**')
    selection?.removeAllRanges()
    editor.destroy()
    element.remove()
  })

  it('copies the full markdown source in source mode', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n\n正文 **加粗**' })
    editor.setSourceMode(true)
    editor.selectFindMatch(0, editor.getMarkdown().length)

    const data = new Map<string, string>()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (type: string, value: string) => data.set(type, value) },
    })
    element.dispatchEvent(event)
    expect(data.get('text/plain')).toContain('# 标题')
    expect(data.get('text/plain')).toContain('**加粗**')
    expect(data.get('text/html')).toBeUndefined()
    editor.destroy()
    element.remove()
  })

  it('copies through the execCommand copy event', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const data = new Map<string, string>()
    const execCommand = vi.fn(() => {
      const event = new Event('copy', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', {
        value: {
          setData: (type: string, value: string) => data.set(type, value),
        },
      })
      document.dispatchEvent(event)
      return true
    })
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

    await expect(copyRichText('<p>正文</p>', '正文')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(data.get('text/html')).toBe('<p>正文</p>')
    expect(data.get('text/plain')).toBe('正文')
  })
})
