import { describe, expect, it } from 'vitest'
import { Editor } from '@v5md/view'
import { createTypographyPlugin, type TypographyApi } from '../src/index.ts'

describe('@v5md/plugin-typography', () => {
  it('applies and reads the font size without a toolbar button', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: 'hello',
      plugins: [createTypographyPlugin({ defaultSize: 18 })],
    })
    expect(element.querySelectorAll('.v5-toolbar button')).toHaveLength(21)
    expect(element.style.fontSize).toBe('18px')

    const api = editor.getPlugin<TypographyApi>('typography')!.api
    expect(api.getFontSize()).toBe(18)
    api.setFontSize(22)
    expect(element.style.fontSize).toBe('22px')
    expect(api.getFontSize()).toBe(22)
    api.resetFontSize()
    expect(element.style.fontSize).toBe('')

    editor.destroy()
    element.remove()
  })

  it('restores the original inline font size on dispose', () => {
    const element = document.createElement('div')
    element.style.fontSize = '14px'
    document.body.append(element)
    const editor = new Editor({ element, value: 'hello', plugins: [createTypographyPlugin()] })
    const handle = editor.getPlugin<TypographyApi>('typography')!
    handle.api.setFontSize(20)
    expect(element.style.fontSize).toBe('20px')
    handle.dispose()
    expect(element.style.fontSize).toBe('14px')
    editor.destroy()
    element.remove()
  })

  it('keeps font size state per editor when the same plugin instance is reused', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.append(first, second)
    const plugin = createTypographyPlugin({ defaultSize: 18 })
    const firstEditor = new Editor({ element: first, plugins: [plugin] })
    const secondEditor = new Editor({ element: second, plugins: [plugin] })
    firstEditor.getPlugin<TypographyApi>('typography')!.api.setFontSize(22)
    expect(first.style.fontSize).toBe('22px')
    expect(second.style.fontSize).toBe('18px')
    firstEditor.destroy()
    secondEditor.destroy()
    first.remove()
    second.remove()
  })

  it('validates the font size range', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, plugins: [createTypographyPlugin({ minSize: 12, maxSize: 24 })] })
    const api = editor.getPlugin<TypographyApi>('typography')!.api
    expect(() => api.setFontSize(10)).toThrow(/between 12 and 24/)
    expect(() => api.setFontSize(Number.NaN)).toThrow(/finite/)
    editor.destroy()
    element.remove()
  })
})
