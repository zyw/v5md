import {
  createFencedWidgetShell,
  resolveLocale,
  type BlockDestroyContext,
  type BlockHydrateContext,
  type BlockRenderContext,
  type BlockUpdateContext,
  type LocaleCode,
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
  /** UI language for toolbar / slash / status text. Defaults to zh-CN. */
  locale?: LocaleCode | string
}

export interface MermaidApi {
  insertTemplate(source?: string): boolean
}

type MermaidCopy = {
  title: string
  drawing: string
  failed: string
  template: string
}

const COPY: Record<LocaleCode, MermaidCopy> = {
  'zh-CN': {
    title: '流程图',
    drawing: '正在绘制图表',
    failed: '图表无法显示',
    template: `graph LR
  A[Markdown] --> B[编辑器]`,
  },
  en: {
    title: 'Flowchart',
    drawing: 'Drawing diagram…',
    failed: 'Unable to render diagram',
    template: `graph LR
  A[Markdown] --> B[Editor]`,
  },
}

const FLOW_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3.5" y="3.5" width="7.5" height="5.2" rx="1.4"/><rect x="13" y="15.3" width="7.5" height="5.2" rx="1.4"/><path d="M7.2 8.7v3.4A2.8 2.8 0 0 0 10 15h4.2"/><path d="m12.4 13.1 1.9 1.9-1.9 1.9"/></svg>'

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
  options: Required<Pick<MermaidPluginOptions, 'lang'>> &
    Pick<MermaidPluginOptions, 'loadMermaid'> & { copy: MermaidCopy },
): V5mdBlockRenderer {
  const langs = Array.isArray(options.lang) ? options.lang : [options.lang]
  const load = options.loadMermaid ?? defaultLoadMermaid
  const { copy } = options

  const paint = async (ctx: BlockHydrateContext | BlockUpdateContext, preview: HTMLElement) => {
    const source = ctx.source
    preview.dataset.diagram = source
    const cached = svgCache.get(source)
    if (cached) {
      preview.innerHTML = cached
      return
    }
    preview.textContent = copy.drawing
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
      if (ctx.isCurrent() && !ctx.signal.aborted) preview.textContent = copy.failed
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
        placeholder: copy.drawing,
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
  const copy = COPY[resolveLocale(options.locale)]
  const template = options.template ?? copy.template
  const showToolbar = options.toolbar !== false
  const renderer = createRenderer({ lang, loadMermaid: options.loadMermaid, copy })

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
        title: copy.title,
        keywords: ['mermaid', 'diagram', 'flow', '图', 'flowchart'],
        order: 70,
      },
    ],
    toolbar: showToolbar
      ? [
          {
            id: 'mermaid.insert',
            command: 'mermaid.insert',
            label: copy.title,
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
