import {
  createFencedWidgetShell,
  type BlockDestroyContext,
  type BlockHydrateContext,
  type BlockRenderContext,
  type BlockUpdateContext,
  type V5mdBlockRenderer,
  type V5mdPlugin,
} from '@v5md/view'

export interface EchartsLike {
  init(el: HTMLElement): EchartsInstance
}

export interface EchartsInstance {
  setOption(option: object, notMerge?: boolean): void
  resize(): void
  dispose(): void
}

export interface EchartsPluginOptions {
  /** 插件名，默认 echarts。 */
  name?: string
  /** 匹配的 fenced lang，默认 echarts。 */
  lang?: string | string[]
  /** 预览区高度，默认 280。 */
  height?: number | string
  /** 是否在工具条显示「图表」插入按钮，默认 true。 */
  toolbar?: boolean
  /** 插入模板时使用的默认 option；默认给一组柱状图。 */
  template?: object
  /** 替换动态 import，便于测试。 */
  loadEcharts?: () => Promise<EchartsLike>
}

export interface EchartsApi {
  /** 在光标处插入一个 echarts 围栏块。 */
  insertTemplate(option?: object): boolean
}

const DEFAULT_TEMPLATE = {
  title: { text: '季度营收', left: 'center' },
  tooltip: { trigger: 'axis' },
  legend: { bottom: 0 },
  grid: { left: 48, right: 24, top: 48, bottom: 48 },
  xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis: { type: 'value', name: '万元' },
  series: [
    { name: '产品 A', type: 'bar', data: [120, 200, 150, 80], itemStyle: { borderRadius: [4, 4, 0, 0] } },
    { name: '产品 B', type: 'bar', data: [60, 90, 130, 170], itemStyle: { borderRadius: [4, 4, 0, 0] } },
  ],
  color: ['#3b82f6', '#10b981'],
}

const CHART_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/></svg>'

const charts = new WeakMap<HTMLElement, EchartsInstance>()

function heightCss(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height
}

function parseOption(source: string): { option: object } | { error: string } {
  const text = source.trim()
  if (!text) return { error: '请填写 JSON 格式的 ECharts option' }
  try {
    const option = JSON.parse(text) as unknown
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      return { error: 'ECharts option 必须是 JSON 对象' }
    }
    return { option }
  } catch {
    return { error: 'JSON 无法解析' }
  }
}

function previewOf(element: HTMLElement): HTMLElement | null {
  return (
    element.querySelector<HTMLElement>('[data-void="widget"]') ??
    element.querySelector<HTMLElement>('.v5-echarts-preview')
  )
}

function fenceBlock(lang: string, option: object): string {
  return `\n\`\`\`${lang}\n${JSON.stringify(option, null, 2)}\n\`\`\`\n`
}

async function defaultLoadEcharts(): Promise<EchartsLike> {
  const mod = await import('echarts')
  return mod as EchartsLike
}

function createRenderer(
  options: Required<Pick<EchartsPluginOptions, 'lang' | 'height'>> & Pick<EchartsPluginOptions, 'loadEcharts'>,
): V5mdBlockRenderer {
  const langs = Array.isArray(options.lang) ? options.lang : [options.lang]
  const primaryLang = langs[0] ?? 'echarts'
  const load = options.loadEcharts ?? defaultLoadEcharts

  const paint = async (ctx: BlockHydrateContext | BlockUpdateContext, preview: HTMLElement) => {
    preview.style.height = heightCss(options.height)
    preview.style.minHeight = heightCss(options.height)
    preview.style.overflow = 'hidden'
    const parsed = parseOption(ctx.source)
    if ('error' in parsed) {
      const existing = charts.get(preview)
      if (existing) {
        existing.dispose()
        charts.delete(preview)
      }
      preview.replaceChildren()
      preview.textContent = parsed.error
      return
    }
    const echarts = await load()
    if (!ctx.isCurrent() || ctx.signal.aborted) return
    let chart = charts.get(preview)
    if (!chart) {
      preview.replaceChildren()
      chart = echarts.init(preview)
      charts.set(preview, chart)
    }
    chart.setOption(parsed.option, true)
    // Layout may not be final on first paint; resize once more on the next frame.
    chart.resize()
    requestAnimationFrame(() => {
      if (!ctx.isCurrent() || ctx.signal.aborted) return
      chart?.resize()
    })
  }

  return {
    id: 'echarts',
    lang: langs.length === 1 ? primaryLang : langs,
    render(ctx: BlockRenderContext) {
      const { root, preview } = createFencedWidgetShell(ctx.node, {
        blockClass: 'v5-echarts',
        previewClass: 'v5-echarts-preview',
        placeholder: '正在绘制图表…',
      })
      preview.style.height = heightCss(options.height)
      preview.style.minHeight = heightCss(options.height)
      preview.dataset.echartsSource = ctx.source
      return root
    },
    async hydrate(ctx) {
      const preview = previewOf(ctx.element)
      if (!preview) return
      await paint(ctx, preview)
    },
    async update(ctx) {
      const preview = ctx.previous
      preview.dataset.echartsSource = ctx.source
      await paint(ctx, preview)
    },
    destroy(ctx: BlockDestroyContext) {
      const preview = previewOf(ctx.element)
      if (!preview) return
      const chart = charts.get(preview)
      if (!chart) return
      chart.dispose()
      charts.delete(preview)
    },
  }
}

export function createEchartsPlugin(options: EchartsPluginOptions = {}): V5mdPlugin<EchartsApi> {
  const name = options.name ?? 'echarts'
  const lang = options.lang ?? 'echarts'
  const primaryLang = (Array.isArray(lang) ? lang[0] : lang)?.trim().toLowerCase() || 'echarts'
  const height = options.height ?? 280
  const template = options.template ?? DEFAULT_TEMPLATE
  const showToolbar = options.toolbar !== false
  const renderer = createRenderer({ lang, height, loadEcharts: options.loadEcharts })

  return {
    name,
    blocks: [renderer],
    commands: {
      'echarts.insert': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: ({ insertText }, option?: unknown) => {
          const body = option && typeof option === 'object' ? option : template
          return insertText(fenceBlock(primaryLang, body as object))
        },
      },
    },
    slash: [
      {
        id: 'echarts.insert',
        command: 'echarts.insert',
        title: '图表',
        keywords: ['echarts', 'chart', '图'],
        order: 80,
      },
    ],
    toolbar: showToolbar
      ? [
          {
            id: 'echarts.insert',
            command: 'echarts.insert',
            label: '图表',
            icon: CHART_ICON,
            group: 'insert',
            order: 60,
          },
        ]
      : undefined,
    api: (context) => ({
      insertTemplate(option) {
        return context.insertText(fenceBlock(primaryLang, option ?? template))
      },
    }),
  }
}
