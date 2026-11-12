import { describe, expect, it } from 'vitest'
import { Editor } from '../src/index.ts'

describe('locale', () => {
  it('defaults to zh-CN chrome labels', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# 标题\n' })
    expect(editor.getLocale()).toBe('zh-CN')
    expect(element.querySelector('[aria-label="一级标题"]')).not.toBeNull()
    expect(element.querySelector('.v5-outline')?.textContent).toContain('大纲')
    editor.destroy()
    element.remove()
  })

  it('switches built-in chrome to English', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, value: '# Title\n', locale: 'en' })
    expect(editor.getLocale()).toBe('en')
    expect(element.lang).toBe('en')
    expect(element.querySelector('[aria-label="Heading 1"]')).not.toBeNull()
    expect(element.querySelector('[aria-label="Insert image"]')).not.toBeNull()
    expect(element.querySelector('.v5-outline')?.textContent).toContain('Outline')
    expect(element.querySelector('.v5-doc')?.dataset.placeholder).toBe('Start writing…')

    editor.setLocale('zh-CN')
    expect(editor.getLocale()).toBe('zh-CN')
    expect(element.querySelector('[aria-label="一级标题"]')).not.toBeNull()
    expect(element.querySelector('.v5-outline')?.textContent).toContain('大纲')
    expect(element.querySelector('.v5-doc')?.dataset.placeholder).toBe('开始编写…')

    editor.destroy()
    element.remove()
  })
})
