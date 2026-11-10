import { describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/index.ts'
import { DESKTOP_OPEN_COMMAND, externalLinkUrl, linkActivationHint, openExternalLink } from '../src/editor/links.ts'

describe('external links', () => {
  it('keeps only absolute web and mail addresses', () => {
    expect(externalLinkUrl(' https://example.com/docs ')).toBe('https://example.com/docs')
    expect(externalLinkUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(externalLinkUrl('javascript:alert(1)')).toBeNull()
    expect(externalLinkUrl('./readme.md')).toBeNull()
    expect(externalLinkUrl('#section')).toBeNull()
    expect(externalLinkUrl('file:///tmp/note.md')).toBeNull()
  })

  it('describes the right-click or modifier-click gesture', () => {
    expect(linkActivationHint(false, true, 'Ctrl键')).toBe('鼠标右击 或 Ctrl键 + 点击 系统默认浏览器打开链接')
    expect(linkActivationHint(true, true, 'Ctrl键')).toBe('鼠标右击 或 Ctrl键 + 点击 系统默认浏览器打开链接')
    expect(linkActivationHint(false, false, '⌘')).toBe('鼠标右击 或 ⌘ + 点击 在新标签页打开链接')
  })

  it('opens a browser link in a new tab and ignores a second event from the same click', () => {
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
    try {
      openExternalLink('https://example.com/once')
      openExternalLink('https://example.com/once')
      expect(opened).toEqual(['https://example.com/once'])
    } finally {
      window.open = original
    }
  })

  it('opens a link only from a modifier click, including in preview', async () => {
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '[官网](https://example.com/preview)\n', editable: false })
    try {
      const preview = element.querySelector('a')
      expect(preview?.target).toBe('_blank')
      expect(preview?.rel).toContain('noopener')
      expect(preview?.title).toMatch(/^鼠标右击 或 (⌘|Ctrl键) \+ 点击 在新标签页打开链接$/)
      const previewClick = new MouseEvent('click', { bubbles: true, cancelable: true })
      preview?.dispatchEvent(previewClick)
      expect(previewClick.defaultPrevented).toBe(true)
      expect(opened).toEqual([])

      editor.setEditable(true)
      const editing = element.querySelector('a')
      expect(editing?.title).toMatch(/^鼠标右击 或 (⌘|Ctrl键) \+ 点击 在新标签页打开链接$/)
      const plain = new MouseEvent('click', { bubbles: true, cancelable: true })
      editing?.dispatchEvent(plain)
      expect(plain.defaultPrevented).toBe(true)
      expect(opened).toEqual([])
      await new Promise((resolve) => setTimeout(resolve, 60))
      editing?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
      expect(opened).toEqual(['https://example.com/preview'])
    } finally {
      editor.destroy()
      window.open = original
    }
  })

  it('asks the desktop shell to open a ctrl-click once', async () => {
    const calls: Array<{ command: string; url: unknown }> = []
    const host = globalThis as typeof globalThis & {
      __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }
    }
    host.__TAURI_INTERNALS__ = {
      invoke: (command, args) => {
        calls.push({ command, url: args?.url })
        return Promise.resolve()
      },
    }
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '[官网](https://example.com/app)\n' })
    try {
      const link = element.querySelector('a')
      expect(link?.title).toMatch(/系统默认浏览器打开链接$/)
      const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: true })
      link?.dispatchEvent(menu)
      await new Promise((resolve) => setTimeout(resolve, 80))
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
      expect(menu.defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(calls).toEqual([{ command: DESKTOP_OPEN_COMMAND, url: 'https://example.com/app' }]))
      expect(opened).toEqual([])
    } finally {
      editor.destroy()
      delete host.__TAURI_INTERNALS__
      window.open = original
    }
  })

  it('still opens a right-click that is not a ctrl-click', async () => {
    const calls: string[] = []
    const host = globalThis as typeof globalThis & {
      __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }
    }
    host.__TAURI_INTERNALS__ = {
      invoke: (_command, args) => {
        calls.push(String(args?.url))
        return Promise.resolve()
      },
    }
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '[官网](https://example.com/right)\n' })
    try {
      element
        .querySelector('a')
        ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
      await vi.waitFor(() => expect(calls).toEqual(['https://example.com/right']))
    } finally {
      editor.destroy()
      delete host.__TAURI_INTERNALS__
    }
  })

  it('does not follow a script or relative link', () => {
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '[脚本](javascript:alert(1)) [相对](./readme.md)\n',
      editable: false,
    })
    try {
      const anchors = [...element.querySelectorAll('a')]
      expect(anchors.every((anchor) => !anchor.hasAttribute('href'))).toBe(true)
      for (const anchor of anchors) {
        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
      expect(opened).toEqual([])
    } finally {
      editor.destroy()
      window.open = original
    }
  })
})
