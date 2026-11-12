import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@v5md/view'
import { createEchartsPlugin, type EchartsApi, type EchartsLike } from '../src/index.ts'

function mockEcharts(): EchartsLike & { disposed: HTMLElement[] } {
  const disposed: HTMLElement[] = []
  return {
    disposed,
    init(el) {
      el.dataset.chart = '1'
      el.textContent = 'chart-ready'
      return {
        setOption(option) {
          el.dataset.option = JSON.stringify(option)
        },
        resize() {
          el.dataset.resized = '1'
        },
        dispose() {
          disposed.push(el)
          delete el.dataset.chart
          el.textContent = ''
        },
      }
    },
  }
}

describe('@v5md/plugin-echarts', () => {
  it('renders an echarts fence and hydrates with JSON option', async () => {
    const loader = mockEcharts()
    const element = document.createElement('div')
    document.body.append(element)
    const value = '```echarts\n{"title":{"text":"Hi"},"series":[]}\n```\n'
    const editor = new Editor({
      element,
      value,
      toolbar: true,
      outline: false,
      plugins: [createEchartsPlugin({ loadEcharts: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() => expect(element.querySelector('[data-chart="1"]')).not.toBeNull())
    const preview = element.querySelector<HTMLElement>('.v5-echarts-preview')
    expect(preview?.dataset.option).toContain('"Hi"')
    editor.destroy()
    element.remove()
  })

  it('shows a parse error for invalid JSON', async () => {
    const loader = mockEcharts()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '```echarts\n{bad\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createEchartsPlugin({ loadEcharts: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() => expect(element.querySelector('.v5-echarts-preview')?.textContent).toBe('JSON 无法解析'))
    editor.destroy()
    element.remove()
  })

  it('inserts a template via command and api', async () => {
    const loader = mockEcharts()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '',
      outline: false,
      plugins: [createEchartsPlugin({ loadEcharts: async () => loader })],
    })
    expect(element.querySelector('[data-command="echarts.insert"], [aria-label="图表"]')).toBeTruthy()
    await editor.runCommand('echarts.insert')
    expect(editor.getMarkdown()).toContain('```echarts')
    expect(editor.getMarkdown()).toContain('季度营收')
    const api = editor.getPlugin<EchartsApi>('echarts')!.api
    expect(api.insertTemplate({ title: { text: '自定义' }, series: [] })).toBe(true)
    expect(editor.getMarkdown()).toContain('自定义')
    editor.destroy()
    element.remove()
  })

  it('disposes chart instances when the plugin is removed', async () => {
    const loader = mockEcharts()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '```echarts\n{"series":[]}\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createEchartsPlugin({ loadEcharts: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() => expect(element.querySelector('[data-chart="1"]')).not.toBeNull())
    editor.getPlugin('echarts')?.dispose()
    expect(loader.disposed).toHaveLength(1)
    expect(element.querySelector('.v5-echarts')).toBeNull()
    editor.destroy()
    element.remove()
  })
})
