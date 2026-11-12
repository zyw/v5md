import { describe, expect, it, vi } from 'vitest'
import { Editor, type V5mdBlockRenderer, type V5mdPlugin } from '../src/index.ts'
import { BlockHost, BlockRendererRegistry, blockInstanceKey, createFencedWidgetShell, hashSource } from './internals.ts'

function demoRenderer(overrides: Partial<V5mdBlockRenderer> = {}): V5mdBlockRenderer {
  return {
    id: 'demo',
    lang: 'demo',
    render(ctx) {
      const { root, preview } = createFencedWidgetShell(ctx.node, {
        blockClass: 'v5-demo',
        placeholder: 'loading',
      })
      preview.dataset.source = ctx.source
      return root
    },
    ...overrides,
  }
}

function demoPlugin(blocks: V5mdBlockRenderer[] = [demoRenderer()]): V5mdPlugin {
  return { name: 'demo-block', blocks }
}

function mount(value: string, plugins: V5mdPlugin[] = [demoPlugin()]) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({ element, value, toolbar: false, outline: false, plugins })
  return { element, editor }
}

describe('BlockRendererRegistry', () => {
  it('rejects duplicate renderer ids and langs', () => {
    const registry = new BlockRendererRegistry()
    registry.register('one', demoRenderer())
    expect(() => registry.register('two', demoRenderer())).toThrow(/already registered/)
    expect(() => registry.register('two', demoRenderer({ id: 'other', lang: 'DEMO' }))).toThrow(
      /lang "demo" is already owned/,
    )
  })

  it('resolves by lang and prefers earlier match()', () => {
    const registry = new BlockRendererRegistry()
    registry.register(
      'first',
      demoRenderer({
        id: 'first',
        lang: 'other',
        match: (node) => (node.lang ?? '') === 'demo',
      }),
    )
    registry.register('second', demoRenderer({ id: 'second', lang: 'demo' }))
    const node = { type: 'code', lang: 'demo', start: 0, end: 1, children: [] } as const
    expect(registry.resolve(node as never)?.id).toBe('first')
  })

  it('builds stable instance keys from source hash and occurrence', () => {
    expect(hashSource('a')).toBe(hashSource('a'))
    expect(hashSource('a')).not.toBe(hashSource('b'))
    expect(blockInstanceKey('demo', 'demo', 'x', 0)).toBe(`demo:demo:${hashSource('x')}:0`)
    expect(blockInstanceKey('demo', 'demo', 'x', 1)).not.toBe(blockInstanceKey('demo', 'demo', 'x', 0))
  })
})

describe('Editor block renderers', () => {
  it('renders a plugin shell for matching fenced lang (P0)', () => {
    const { element, editor } = mount('```demo\nhello\n```\n')
    const widget = element.querySelector('.v5-demo')
    expect(widget).not.toBeNull()
    expect(widget?.classList.contains('v5-widget')).toBe(true)
    expect(widget?.querySelector('[data-void="widget"]')?.textContent).toBe('loading')
    expect(element.querySelector('pre.v5-code:not(.v5-widget)')).toBeNull()
    editor.destroy()
    element.remove()
  })

  it('hydrates asynchronously and ignores stale writes (P1)', async () => {
    let hydrateCount = 0
    const hydrated = vi.fn()
    const plugin = demoPlugin([
      demoRenderer({
        async hydrate(ctx) {
          hydrateCount += 1
          const pass = hydrateCount
          await Promise.resolve()
          if (!ctx.isCurrent() || ctx.signal.aborted) return
          const preview = ctx.element.querySelector<HTMLElement>('[data-void="widget"]')
          if (preview) {
            preview.textContent = `drawn:${ctx.source}:${pass}`
            hydrated()
          }
        },
      }),
    ])
    const { element, editor } = mount('```demo\none\n```\n', [plugin])
    await vi.waitFor(() => expect(element.querySelector('[data-void="widget"]')?.textContent).toBe('drawn:one:1'))
    editor.insertText('!')
    await vi.waitFor(() => expect(hydrated.mock.calls.length).toBeGreaterThanOrEqual(1))
    editor.destroy()
    element.remove()
  })

  it('reuses instances via update when source is unchanged (P2)', async () => {
    const updates: string[] = []
    const destroys: string[] = []
    const widgetState = { value: 'live' }
    const plugin = demoPlugin([
      demoRenderer({
        hydrate(ctx) {
          const preview = ctx.element.querySelector<HTMLElement>('[data-void="widget"]')
          if (!preview) return
          const canvas = document.createElement('div')
          canvas.className = 'demo-canvas'
          canvas.textContent = widgetState.value
          preview.replaceChildren(canvas)
        },
        update(ctx) {
          updates.push(ctx.source)
          const canvas = ctx.previous.querySelector('.demo-canvas')
          if (canvas) canvas.textContent = `${widgetState.value}:updated`
        },
        destroy() {
          destroys.push('demo')
        },
      }),
    ])
    const { element, editor } = mount('# Title\n\n```demo\nchart\n```\n', [plugin])
    await vi.waitFor(() => expect(element.querySelector('.demo-canvas')?.textContent).toBe('live'))
    const before = element.querySelector('.demo-canvas')
    editor.focusAt(2)
    editor.insertText('X')
    expect(editor.getMarkdown().startsWith('# XTitle') || editor.getMarkdown().includes('X')).toBe(true)
    expect(updates.length).toBeGreaterThanOrEqual(1)
    expect(updates.every((item) => item === 'chart')).toBe(true)
    expect(element.querySelector('.demo-canvas')).toBe(before)
    expect(element.querySelector('.demo-canvas')?.textContent).toBe('live:updated')
    editor.getPlugin('demo-block')?.dispose()
    expect(destroys).toEqual(['demo'])
    expect(element.querySelector('.v5-demo')).toBeNull()
    editor.destroy()
    element.remove()
  })

  it('falls back to a normal code block when no plugin claims mermaid', () => {
    const { element, editor } = mount('```mermaid\ngraph TD;A-->B\n```\n', [])
    expect(element.querySelector('.v5-mermaid')).toBeNull()
    expect(element.querySelector('pre.v5-code')).not.toBeNull()
    editor.destroy()
    element.remove()
  })

  it('lets a plugin claim mermaid lang and drops the widget after dispose', () => {
    const plugin = demoPlugin([
      demoRenderer({
        id: 'mermaid-override',
        lang: 'mermaid',
        render(ctx) {
          const { root, preview } = createFencedWidgetShell(ctx.node, {
            blockClass: 'v5-mermaid-plugin',
            placeholder: 'plugin-mermaid',
          })
          preview.dataset.source = ctx.source
          return root
        },
      }),
    ])
    const { element, editor } = mount('```mermaid\ngraph TD;A-->B\n```\n', [plugin])
    expect(element.querySelector('.v5-mermaid-plugin')).not.toBeNull()
    editor.getPlugin('demo-block')?.dispose()
    expect(element.querySelector('.v5-mermaid-plugin')).toBeNull()
    expect(element.querySelector('pre.v5-code')).not.toBeNull()
    editor.destroy()
    element.remove()
  })
})

describe('BlockHost unit', () => {
  it('aborts in-flight hydrate when a newer render starts', async () => {
    const host = new BlockHost()
    let sawAbort = false
    let writes = 0
    host.registerPlugin(
      demoPlugin([
        demoRenderer({
          async hydrate(ctx) {
            await new Promise((resolve) => setTimeout(resolve, 20))
            if (ctx.signal.aborted || !ctx.isCurrent()) {
              sawAbort = true
              return
            }
            writes += 1
            ctx.element.querySelector('[data-void="widget"]')!.textContent = `ok:${writes}`
          },
        }),
      ]),
    )
    const root = document.createElement('div')
    document.body.append(root)
    const { parse } = await import('@v5md/core')
    const doc = '```demo\na\n```\n'
    const { renderDocument } = await import('./internals.ts')
    renderDocument(root, { doc, head: 0, anchor: 0, blocks: host, editable: true }, parse(doc))
    host.afterRender()
    renderDocument(root, { doc, head: 0, anchor: 0, blocks: host, editable: true }, parse(doc))
    host.afterRender()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(sawAbort).toBe(true)
    expect(writes).toBe(1)
    expect(root.querySelector('[data-void="widget"]')?.textContent).toBe('ok:1')
    host.destroyAll()
    root.remove()
  })
})
