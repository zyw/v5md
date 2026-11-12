import {
  createFencedWidgetShell,
  type BlockDestroyContext,
  type BlockHydrateContext,
  type BlockRenderContext,
  type BlockUpdateContext,
  type V5mdBlockRenderer,
  type V5mdPlugin,
} from '@v5md/view'

export interface MermaidLike {
  initialize(config: object): void
  render(id: string, source: string): Promise<{ svg: string }>
}

export interface MermaidPluginOptions {
  /** 插件名，默认 mermaid。 */
  name?: string
  /** 匹配的 fenced lang，默认 mermaid。 */
  lang?: string | string[]
  /** 是否在工具条显示「流程图」按钮，默认 true。 */
  toolbar?: boolean
  /** 插入模板，默认简单 flowchart。 */
  template?: string
  /** 替换动态 import，便于测试。 */
  loadMermaid?: () => Promise<MermaidLike>
}

export interface MermaidApi {
  insertTemplate(source?: string): boolean
}

const DEFAULT_TEMPLATE = `graph LR
  A[Markdown] --> B[编辑器]`

const FLOW_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v4.5A2.5 2.5 0 0 0 9 15h5.5"/><path d="m12.5 13 2 2-2 2"/></svg>'

const svgCache = new Map<string, string>()

function fenceBlock(lang: string, source: string): string {
  const body = source.replace(/^\n+/, '').replace(/\n+$/, '')
  return `\n\`\`\`${lang}\n${body}\n\`\`\`\n`
}

function previewOf(element: HTMLElement): HTMLElement | null {
  return (
    element.querySelector<HTMLElement>('[data-void="diagram"]') ?? element.querySelector<HTMLElement>('.v5-diagram')
  )
}

async function defaultLoadMermaid(): Promise<MermaidLike> {
  const mod = await import('mermaid')
  return (mod.default ?? mod) as MermaidLike
}

function createRenderer(
  options: Required<Pick<MermaidPluginOptions, 'lang'>> & Pick<MermaidPluginOptions, 'loadMermaid'>,
): V5mdBlockRenderer {
  const langs = Array.isArray(options.lang) ? options.lang : [options.lang]
  const load = options.loadMermaid ?? defaultLoadMermaid

  const paint = async (ctx: BlockHydrateContext | BlockUpdateContext, preview: HTMLElement) => {
    const source = ctx.source
    preview.dataset.diagram = source
    const cached = svgCache.get(source)
    if (cached) {
      preview.innerHTML = cached
      return
    }
    preview.textContent = '正在绘制图表'
    const mermaid = await load()
    if (!ctx.isCurrent() || ctx.signal.aborted) return
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', fontFamily: 'inherit' })
    const id = `v5md-mermaid-${Math.random().toString(36).slice(2)}`
    try {
      const result = await mermaid.render(id, source)
      svgCache.set(source, result.svg)
      document.getElementById(id)?.remove()
      if (!ctx.isCurrent() || ctx.signal.aborted) return
      preview.innerHTML = result.svg
    } catch {
      document.getElementById(id)?.remove()
      if (ctx.isCurrent() && !ctx.signal.aborted) preview.textContent = '图表无法显示'
    }
  }

  return {
    id: 'mermaid',
    lang: langs.length === 1 ? (langs[0] ?? 'mermaid') : langs,
    render(ctx: BlockRenderContext) {
      const { root, preview } = createFencedWidgetShell(ctx.node, {
        blockClass: 'v5-mermaid',
        previewClass: 'v5-diagram',
        voidKind: 'diagram',
        placeholder: '正在绘制图表',
      })
      preview.dataset.diagram = ctx.source
      return root
    },
    async hydrate(ctx) {
      const preview = previewOf(ctx.element)
      if (!preview) return
      await paint(ctx, preview)
    },
    async update(ctx) {
      await paint(ctx, ctx.previous)
    },
    destroy(_ctx: BlockDestroyContext) {
      // SVG cache is shared by source text; keep it for reuse across remounts.
    },
  }
}

export function createMermaidPlugin(options: MermaidPluginOptions = {}): V5mdPlugin<MermaidApi> {
  const name = options.name ?? 'mermaid'
  const lang = options.lang ?? 'mermaid'
  const primaryLang = (Array.isArray(lang) ? lang[0] : lang)?.trim().toLowerCase() || 'mermaid'
  const template = options.template ?? DEFAULT_TEMPLATE
  const showToolbar = options.toolbar !== false
  const renderer = createRenderer({ lang, loadMermaid: options.loadMermaid })

  return {
    name,
    blocks: [renderer],
    commands: {
      'mermaid.insert': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: ({ insertText }, source?: unknown) => {
          const body = typeof source === 'string' && source.trim() ? source : template
          return insertText(fenceBlock(primaryLang, body))
        },
      },
    },
    slash: [
      {
        id: 'mermaid.insert',
        command: 'mermaid.insert',
        title: '流程图',
        keywords: ['mermaid', 'diagram', 'flow', '图'],
        order: 70,
      },
    ],
    toolbar: showToolbar
      ? [
          {
            id: 'mermaid.insert',
            command: 'mermaid.insert',
            label: '流程图',
            icon: FLOW_ICON,
            group: 'insert',
            order: 55,
          },
        ]
      : undefined,
    api: (context) => ({
      insertTemplate(source) {
        return context.insertText(fenceBlock(primaryLang, source ?? template))
      },
    }),
  }
}
