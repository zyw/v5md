import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/editor.ts'
import { copyRichText, toWechatHtml } from '../src/wechat.ts'

describe('toWechatHtml', () => {
  it('converts blocks and inline marks to inline-styled html', () => {
    const html = toWechatHtml(
      '# 标题\n\n正文 **加粗** *斜体* [链接](https://example.com)\n\n> 引用\n\n- [x] 完成\n  - 嵌套',
    )
    expect(html).toContain('<section style="font-family:')
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
})

describe('WeChat copy', () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
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
    const editor = new Editor({ element, value: '# 标题' })
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })

    await expect(editor.copyForWechat()).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const button = element.querySelector<HTMLButtonElement>('button[data-command="wechat"]')
    expect(button?.dataset.state).toBe('done')
    expect(button?.dataset.label).toBe('已复制到公众号')

    editor.destroy()
    element.remove()
  })

  it('falls back to execCommand when the clipboard api is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

    await expect(copyRichText('<p>正文</p>', '正文')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
