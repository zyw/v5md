import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@v5md/view'
import { createMermaidPlugin, type MermaidApi, type MermaidLike } from '../src/index.ts'

function mockMermaid(): MermaidLike {
  return {
    initialize() {},
    async render(_id, source) {
      return { svg: `<svg data-source="${source.trim()}"></svg>` }
    },
  }
}

describe('@v5md/plugin-mermaid', () => {
  it('renders mermaid fences through the block host', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '```mermaid\ngraph TD;A-->B\n```\n',
      toolbar: false,
      outline: false,
      plugins: [createMermaidPlugin({ loadMermaid: async () => mockMermaid(), toolbar: false })],
    })
    expect(element.querySelector('.v5-mermaid.v5-widget')).not.toBeNull()
    await vi.waitFor(() => expect(element.querySelector('svg[data-source]')).not.toBeNull())
    editor.destroy()
    element.remove()
  })

  it('inserts a template via command, api and slash registry', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      value: '',
      outline: false,
      plugins: [createMermaidPlugin({ loadMermaid: async () => mockMermaid() })],
    })
    expect(element.querySelector('[aria-label="流程图"]')).not.toBeNull()
    await editor.runCommand('mermaid.insert')
    expect(editor.getMarkdown()).toContain('```mermaid')
    const api = editor.getPlugin<MermaidApi>('mermaid')!.api
    expect(api.insertTemplate('graph TD;X-->Y')).toBe(true)
    expect(editor.getMarkdown()).toContain('X-->Y')
    editor.destroy()
    element.remove()
  })
})
