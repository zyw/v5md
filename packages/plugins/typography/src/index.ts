import type { Editor, V5mdPlugin } from '@v5md/view'

export interface TypographyPluginOptions {
  /** 插件名，默认 typography。 */
  name?: string
  /** 安装后立即应用的字号，单位 px。 */
  defaultSize?: number
  /** 允许的最小字号，默认 10。 */
  minSize?: number
  /** 允许的最大字号，默认 40。 */
  maxSize?: number
}

export interface TypographyApi {
  setFontSize(px: number): void
  getFontSize(): number
  resetFontSize(): void
  getDefaultSize(): number
}

interface TypographyState {
  host: HTMLElement
  originalStyle: string
  applied: boolean
}

const DEFAULT_SIZE = 16
const DEFAULT_MIN = 10
const DEFAULT_MAX = 40

export function createTypographyPlugin(options: TypographyPluginOptions = {}): V5mdPlugin<TypographyApi> {
  const name = options.name ?? 'typography'
  const minSize = options.minSize ?? DEFAULT_MIN
  const maxSize = options.maxSize ?? DEFAULT_MAX
  const defaultSize = options.defaultSize
  const states = new WeakMap<Editor, TypographyState>()

  const stateFor = (editor: Editor, host: HTMLElement): TypographyState => {
    const existing = states.get(editor)
    if (existing) return existing
    const state: TypographyState = { host, originalStyle: host.style.fontSize, applied: false }
    states.set(editor, state)
    return state
  }

  const applySize = (state: TypographyState, px: number): void => {
    if (!Number.isFinite(px)) throw new TypeError('font size must be a finite number')
    const size = Math.round(px)
    if (size < minSize || size > maxSize) {
      throw new RangeError(`font size must be between ${minSize} and ${maxSize}px`)
    }
    if (!state.applied) {
      state.originalStyle = state.host.style.fontSize
      state.applied = true
    }
    state.host.style.fontSize = `${size}px`
  }

  const readSize = (state: TypographyState): number => {
    const inline = Number.parseFloat(state.host.style.fontSize)
    if (Number.isFinite(inline) && inline > 0) return inline
    const view = state.host.ownerDocument.defaultView
    const computed = view ? Number.parseFloat(view.getComputedStyle(state.host).fontSize) : Number.NaN
    return Number.isFinite(computed) && computed > 0 ? computed : (defaultSize ?? DEFAULT_SIZE)
  }

  const resetSize = (state: TypographyState): void => {
    if (!state.applied) return
    state.host.style.fontSize = state.originalStyle
    state.applied = false
  }

  return {
    name,
    api: (context) => {
      const state = stateFor(context.editor, context.host)
      return {
        setFontSize: (px) => applySize(state, px),
        getFontSize: () => readSize(state),
        resetFontSize: () => resetSize(state),
        getDefaultSize: () => defaultSize ?? DEFAULT_SIZE,
      }
    },
    setup: (context) => {
      const state = stateFor(context.editor, context.host)
      state.originalStyle = context.host.style.fontSize
      state.applied = false
      if (defaultSize != null) applySize(state, defaultSize)
      return () => resetSize(state)
    },
  }
}
