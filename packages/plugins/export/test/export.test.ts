import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@v5md/view'
import { createExportPlugin, type ExportApi } from '../src/index.ts'

describe('@v5md/plugin-export', () => {
  it('exports markdown, html fragments and full documents', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '# 标题\n\n正文 **加粗**',
      plugins: [createExportPlugin({ title: '测试文章' })],
    })
    const api = editor.getPlugin<ExportApi>('export')!.api

    expect(api.exportMarkdown()).toContain('# 标题')
    const fragment = api.exportHtmlFragment()
    expect(fragment).toContain('<h1')
    expect(fragment).toContain('font-size:24px')
    expect(fragment).toContain('<strong')
    const html = api.exportHtml()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>测试文章</title>')
    expect(html).toContain(fragment)

    editor.destroy()
    element.remove()
  })

  it('delegates image and pdf rendering and merges defaults', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const image = vi.fn(async () => new Blob(['image'], { type: 'image/png' }))
    const pdf = vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' }))
    const editor = new Editor({
      element,
      value: 'hello',
      plugins: [
        createExportPlugin({
          imageScale: 3,
          pdfMargin: 18,
          renderer: { image, pdf },
        }),
      ],
    })
    const api = editor.getPlugin<ExportApi>('export')!.api
    const content = editor.getContentElement()

    const imageBlob = await api.exportImage({ type: 'jpeg', scale: 2 })
    expect(imageBlob.type).toBe('image/png')
    expect(image).toHaveBeenCalledWith(content, { type: 'jpeg', scale: 2 })

    const pdfBlob = await api.exportPdf({ format: 'letter' })
    expect(pdfBlob.type).toBe('application/pdf')
    expect(pdf).toHaveBeenCalledWith(content, { margin: 18, format: 'letter', scale: 3 })

    editor.destroy()
    element.remove()
  })

  it('does not provide toolbar buttons by default', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, plugins: [createExportPlugin()] })
    expect(element.querySelectorAll('.v5-toolbar button')).toHaveLength(21)
    const exporter = editor.getPlugin<ExportApi>('export')!
    expect(exporter.api.exportMarkdown()).toBe('')
    editor.destroy()
    element.remove()
  })
})
