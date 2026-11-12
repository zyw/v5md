import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@v5md/view'
import { createExportPlugin, type ExportApi } from '../src/index.ts'

describe('@v5md/plugin-export', () => {
  it('exports markdown, html fragments and full documents', async () => {
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
    const html = await api.exportHtml()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>测试文章</title>')
    expect(html).toContain('<h1')
    expect(html).toContain('<style>')
    expect(html).toContain('class="v5md is-preview"')

    editor.destroy()
    element.remove()
  })

  it('keeps rendered math in the exported document', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '$x^2$',
      plugins: [createExportPlugin()],
    })
    const html = await editor.getPlugin<ExportApi>('export')!.api.exportHtml()
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('class="v5-source"')
    editor.destroy()
    element.remove()
  })

  it('inlines exported images as data urls', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'
    const fetchMock = vi.fn(async () => new Response(new Blob([svg], { type: 'image/svg+xml' })))
    vi.stubGlobal('fetch', fetchMock)
    const editor = new Editor({
      element,
      value: '![示意图](sample.svg)',
      plugins: [createExportPlugin()],
    })
    const html = await editor.getPlugin<ExportApi>('export')!.api.exportHtml()
    expect(fetchMock).toHaveBeenCalled()
    expect(html).toContain('src="data:image/svg+xml')
    vi.unstubAllGlobals()
    editor.destroy()
    element.remove()
  })

  it('snapshots canvas widgets into images in the exported html', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '图表',
      plugins: [createExportPlugin()],
    })
    const content = editor.getContentElement()
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    canvas.toDataURL = () => 'data:image/png;base64,canvas-snapshot'
    content.append(canvas)

    const html = await editor.getPlugin<ExportApi>('export')!.api.exportHtml()
    expect(html).toContain('src="data:image/png;base64,canvas-snapshot"')
    expect(html).not.toContain('<canvas')

    editor.destroy()
    element.remove()
  })

  it('exposes a browser print entry', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({ element, plugins: [createExportPlugin()] })
    const api = editor.getPlugin<ExportApi>('export')!.api
    expect(typeof api.print).toBe('function')
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
