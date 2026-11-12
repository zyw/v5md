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

/** Opaque markmap tree node; real shape comes from `@markmap/core`. */
export type MindmapNode = unknown

export interface MindmapInstance {
  setTree(root: MindmapNode, options?: object): void
  fit(): void
  destroy(): void
}

export interface MindmapToolkit {
  parse(markdown: string): { root: MindmapNode }
  Markmap: {
    create(svg: SVGSVGElement, root?: MindmapNode, options?: object): MindmapInstance
  }
}

export interface MindmapPluginOptions {
  /** 插件名，默认 mindmap。 */
  name?: string
  /** 匹配的 fenced lang，默认 mindmap；也可传 ['mindmap','markmap']。 */
  lang?: string | string[]
  /** 预览区高度，默认 360。 */
  height?: number | string
  /** 是否在工具条显示「思维导图」按钮，默认 true。 */
  toolbar?: boolean
  /** 插入模板，默认 Markdown 大纲。 */
  template?: string
  /** 传给 Markmap.create / setTree 的选项。 */
  markmapOptions?: object
  /** 替换动态 import，便于测试。 */
  loadMarkmap?: () => Promise<MindmapToolkit>
  /** UI language for toolbar / slash / status text. Defaults to zh-CN. */
  locale?: LocaleCode | string
}

export interface MindmapApi {
  insertTemplate(source?: string): boolean
}

type MindmapCopy = {
  title: string
  drawing: string
  empty: string
  failed: string
  template: string
}

const COPY: Record<LocaleCode, MindmapCopy> = {
  'zh-CN': {
    title: '思维导图',
    drawing: '正在绘制思维导图…',
    empty: '请填写 Markdown 大纲',
    failed: '思维导图无法解析',
    template: `# 中心主题
## 分支 A
### 细节 1
### 细节 2
## 分支 B
## 分支 C`,
  },
  en: {
    title: 'Mind map',
    drawing: 'Drawing mind map…',
    empty: 'Enter a Markdown outline',
    failed: 'Unable to parse mind map',
    template: `# Central topic
## Branch A
### Detail 1
### Detail 2
## Branch B
## Branch C`,
  },
}

const MAP_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="2.6"/><circle cx="5.2" cy="5.8" r="2"/><circle cx="18.8" cy="5.8" r="2"/><circle cx="5.2" cy="18.2" r="2"/><circle cx="18.8" cy="18.2" r="2"/><path d="M10 10.2 6.8 7.2M14 10.2l3.2-3M10 13.8l-3.2 3M14 13.8l3.2 3"/></svg>'

const maps = new WeakMap<HTMLElement, MindmapInstance>()
let toolkitPromise: Promise<MindmapToolkit> | null = null

function heightCss(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height
}

function fenceBlock(lang: string, source: string): string {
  const body = source.replace(/^\n+/, '').replace(/\n+$/, '')
  return `\n\`\`\`${lang}\n${body}\n\`\`\`\n`
}

function previewOf(element: HTMLElement): HTMLElement | null {
  return (
    element.querySelector<HTMLElement>('[data-void="widget"]') ??
    element.querySelector<HTMLElement>('.v5-mindmap-preview')
  )
}

function ensureSvg(preview: HTMLElement): SVGSVGElement {
  let svg = preview.querySelector(':scope > svg') as SVGSVGElement | null
  if (!svg) {
    preview.replaceChildren()
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    preview.append(svg)
  }
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.display = 'block'
  return svg
}

function showMessage(preview: HTMLElement, message: string): void {
  const existing = maps.get(preview)
  if (existing) {
    existing.destroy()
    maps.delete(preview)
  }
  preview.replaceChildren()
  preview.textContent = message
}

async function defaultLoadMarkmap(): Promise<MindmapToolkit> {
  toolkitPromise ??= Promise.all([import('@markmap/parse'), import('@markmap/view')]).then(([parseMod, view]) => ({
    parse: (markdown) => parseMod.parse(markdown),
    Markmap: {
      create(svg, root, options) {
        return view.Markmap.create(svg, root as never, options as never)
      },
    },
  }))
  return toolkitPromise
}

function createRenderer(
  options: Required<Pick<MindmapPluginOptions, 'lang' | 'height'>> &
    Pick<MindmapPluginOptions, 'loadMarkmap' | 'markmapOptions'> & { copy: MindmapCopy },
): V5mdBlockRenderer {
  const langs = Array.isArray(options.lang) ? options.lang : [options.lang]
  const primaryLang = langs[0] ?? 'mindmap'
  const load = options.loadMarkmap ?? defaultLoadMarkmap
  const { copy } = options

  const paint = async (ctx: BlockHydrateContext | BlockUpdateContext, preview: HTMLElement) => {
    preview.style.height = heightCss(options.height)
    preview.style.minHeight = heightCss(options.height)
    const source = ctx.source.trim()
    if (!source) {
      showMessage(preview, copy.empty)
      return
    }
    const toolkit = await load()
    if (!ctx.isCurrent() || ctx.signal.aborted) return
    let root: MindmapNode
    try {
      root = toolkit.parse(source).root
    } catch {
      showMessage(preview, copy.failed)
      return
    }
    if (!ctx.isCurrent() || ctx.signal.aborted) return

    let mm = maps.get(preview)
    if (!mm) {
      const svg = ensureSvg(preview)
      mm = toolkit.Markmap.create(svg, undefined, options.markmapOptions)
      maps.set(preview, mm)
      preview.addEventListener(
        'wheel',
        (event) => {
          event.stopPropagation()
        },
        { passive: true },
      )
    }
    mm.setTree(root, options.markmapOptions)
    if (!ctx.isCurrent() || ctx.signal.aborted) return
    mm.fit()
  }

  return {
    id: 'mindmap',
    lang: langs.length === 1 ? primaryLang : langs,
    render(ctx: BlockRenderContext) {
      const { root, preview } = createFencedWidgetShell(ctx.node, {
        blockClass: 'v5-mindmap',
        previewClass: 'v5-mindmap-preview',
        placeholder: copy.drawing,
      })
      preview.style.height = heightCss(options.height)
      preview.style.minHeight = heightCss(options.height)
      preview.dataset.mindmapSource = ctx.source
      return root
    },
    async hydrate(ctx) {
      const preview = previewOf(ctx.element)
      if (!preview) return
      await paint(ctx, preview)
    },
    async update(ctx) {
      const preview = ctx.previous
      preview.dataset.mindmapSource = ctx.source
      await paint(ctx, preview)
    },
    destroy(ctx: BlockDestroyContext) {
      const preview = previewOf(ctx.element)
      if (!preview) return
      const mm = maps.get(preview)
      if (!mm) return
      mm.destroy()
      maps.delete(preview)
    },
  }
}

export function createMindmapPlugin(options: MindmapPluginOptions = {}): V5mdPlugin<MindmapApi> {
  const name = options.name ?? 'mindmap'
  const lang = options.lang ?? 'mindmap'
  const primaryLang = (Array.isArray(lang) ? lang[0] : lang)?.trim().toLowerCase() || 'mindmap'
  const height = options.height ?? 360
  const copy = COPY[resolveLocale(options.locale)]
  const template = options.template ?? copy.template
  const showToolbar = options.toolbar !== false
  const renderer = createRenderer({
    lang,
    height,
    loadMarkmap: options.loadMarkmap,
    markmapOptions: options.markmapOptions,
    copy,
  })

  return {
    name,
    blocks: [renderer],
    commands: {
      'mindmap.insert': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: ({ insertText }, source?: unknown) => {
          const body = typeof source === 'string' && source.trim() ? source : template
          return insertText(fenceBlock(primaryLang, body))
        },
      },
    },
    slash: [
      {
        id: 'mindmap.insert',
        command: 'mindmap.insert',
        title: copy.title,
        keywords: ['mindmap', 'markmap', '导图', '脑图'],
        order: 75,
      },
    ],
    toolbar: showToolbar
      ? [
          {
            id: 'mindmap.insert',
            command: 'mindmap.insert',
            label: copy.title,
            icon: MAP_ICON,
            group: 'insert',
            order: 58,
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
