import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@v5md/view'
import { createMindmapPlugin, type MindmapApi, type MindmapInstance, type MindmapToolkit } from '../src/index.ts'

function mockToolkit(): MindmapToolkit & { destroyed: MindmapInstance[] } {
  const destroyed: MindmapInstance[] = []
  return {
    destroyed,
    parse(content) {
      if (content.includes('BOOM')) throw new Error('bad')
      return {
        root: {
          content: content.trim().split('\n')[0]?.replace(/^#\s*/, '') || 'root',
          children: [],
        },
      }
    },
    Markmap: {
      create(svg) {
        svg.dataset.markmap = '1'
        const instance: MindmapInstance = {
          setTree(data) {
            const node = data as { content?: string } | null
            svg.dataset.root = String(node?.content ?? '')
          },
          fit() {
            svg.dataset.fit = '1'
          },
          destroy() {
            destroyed.push(instance)
            delete svg.dataset.markmap
            svg.replaceChildren()
          },
        }
        return instance
      },
    },
  }
}

describe('@v5md/plugin-mindmap', () => {
  it('renders a mindmap fence and hydrates with markmap', async () => {
    const loader = mockToolkit()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '```mindmap\n# Hello\n## Child\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createMindmapPlugin({ loadMarkmap: async () => loader, toolbar: false })],
    })
    const svg = await vi.waitFor(() => {
      const node = element.querySelector<SVGSVGElement>('svg[data-markmap="1"]')
      expect(node).not.toBeNull()
      return node!
    })
    await vi.waitFor(() => expect(svg.dataset.root).toBe('Hello'))
    expect(svg.dataset.fit).toBe('1')
    editor.destroy()
    element.remove()
  })

  it('shows a message for empty or invalid source', async () => {
    const loader = mockToolkit()
    const element = document.createElement('div')
    document.body.append(element)
    const empty = new Editor({
      element,
      value: '```mindmap\n\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createMindmapPlugin({ loadMarkmap: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() =>
      expect(element.querySelector('.v5-mindmap-preview')?.textContent).toBe('请填写 Markdown 大纲'),
    )
    empty.destroy()

    const broken = new Editor({
      element,
      value: '```mindmap\nBOOM\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createMindmapPlugin({ loadMarkmap: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() => expect(element.querySelector('.v5-mindmap-preview')?.textContent).toBe('思维导图无法解析'))
    broken.destroy()
    element.remove()
  })

  it('inserts a template via command and api', async () => {
    const loader = mockToolkit()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '',
      outline: false,
      plugins: [createMindmapPlugin({ loadMarkmap: async () => loader })],
    })
    expect(element.querySelector('[aria-label="思维导图"]')).not.toBeNull()
    await editor.runCommand('mindmap.insert')
    expect(editor.getMarkdown()).toContain('```mindmap')
    expect(editor.getMarkdown()).toContain('中心主题')
    const api = editor.getPlugin<MindmapApi>('mindmap')!.api
    expect(api.insertTemplate('# 自定义')).toBe(true)
    expect(editor.getMarkdown()).toContain('自定义')
    editor.destroy()
    element.remove()
  })

  it('destroys markmap instances when the plugin is removed', async () => {
    const loader = mockToolkit()
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '```mindmap\n# Hi\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createMindmapPlugin({ loadMarkmap: async () => loader, toolbar: false })],
    })
    await vi.waitFor(() => expect(element.querySelector('svg[data-markmap="1"]')).not.toBeNull())
    editor.getPlugin('mindmap')?.dispose()
    expect(loader.destroyed).toHaveLength(1)
    expect(element.querySelector('.v5-mindmap')).toBeNull()
    editor.destroy()
    element.remove()
  })
})
