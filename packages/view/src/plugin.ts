import type { MdNode, TextSelection } from '@v5md/core'
import type { Editor } from './editor/editor.js'

export const PLUGIN_API_VERSION = 1

export interface V5mdPluginState {
  markdown: string
  selection: TextSelection
  path: MdNode[]
  editable: boolean
  sourceMode: boolean
  findOpen: boolean
  toolbarVisible: boolean
  outlineVisible: boolean
}

/** Context passed to a block renderer's synchronous `render()`. */
export interface BlockRenderContext {
  node: MdNode
  /** Full Markdown document. */
  doc: string
  /** Fence body without opening/closing fence lines. */
  source: string
  /** Normalized lang (lowercase). */
  lang: string
  editable: boolean
  sourceMode: boolean
  /** Whether this block is the active source-editing block. */
  active: boolean
  /** Editor host root (`.v5md`). */
  host: HTMLElement
}

export interface BlockHydrateContext extends BlockRenderContext {
  element: HTMLElement
  /** False once a newer render pass has started; stale async work must not write. */
  isCurrent(): boolean
  signal: AbortSignal
}

export interface BlockUpdateContext extends BlockHydrateContext {
  /** Widget root retained from the previous render pass. */
  previous: HTMLElement
}

export interface BlockDestroyContext {
  element: HTMLElement
  lang: string
  rendererId: string
}

/**
 * Custom fenced-code block renderer.
 * See `docs/plugin-block-render.md` §0 for the frozen contract.
 */
export interface V5mdBlockRenderer {
  /** Unique renderer id, e.g. `echarts` or `mindmap`. */
  id: string
  /** Fenced lang or langs; compared after trim + toLowerCase(). */
  lang: string | string[]
  /** Optional matcher beyond lang. First installed match wins. */
  match?(node: MdNode): boolean
  /** Synchronous shell only — no heavy IO. */
  render(ctx: BlockRenderContext): HTMLElement
  /** Optional async paint; must honor `isCurrent` and `signal`. */
  hydrate?(ctx: BlockHydrateContext): void | Promise<void>
  /** Optional reuse when source/key is unchanged. */
  update?(ctx: BlockUpdateContext): void | Promise<void>
  /** Cleanup when the instance is dropped or the plugin unloads. */
  destroy?(ctx: BlockDestroyContext): void
}

export interface V5mdCommandContext {
  editor: Editor
  host: HTMLElement
  state: V5mdPluginState
  insertText(text: string): boolean
  replaceSelection(text: string): boolean
  wrapSelection(before: string, after?: string): boolean
  focus(): void
}

export interface V5mdCommand<T = unknown> {
  run(context: V5mdCommandContext, ...args: unknown[]): T | Promise<T>
  isEnabled?(state: V5mdPluginState): boolean
}

export interface V5mdToolbarItem {
  /** 按钮唯一 id，默认等于 command。 */
  id?: string
  command: string
  label: string
  /** 可信的 SVG/HTML 字符串，和内置按钮一样插入。 */
  icon: string
  /** 分组名。使用内置分组可插入内置区域，否则追加新分组。 */
  group?: string
  /** 同组内排序，数字越小越靠前。 */
  order?: number
  /** action 只执行命令；toggle 会读取 isActive 写 aria-pressed。 */
  type?: 'action' | 'toggle'
  shortcut?: string
  isActive?(state: V5mdPluginState): boolean
  isDisabled?(state: V5mdPluginState): boolean
}

/** Slash menu contribution from a plugin. */
export interface V5mdSlashItem {
  /** Unique slash entry id; defaults to command. */
  id?: string
  /** Display title in the slash menu. */
  title: string
  /** Plugin command id (or a built-in slash command id). */
  command: string
  /** Extra filter needles besides id/title/command. */
  keywords?: string[]
  /** Sort key among plugin slash items; lower first. Defaults by declaration order. */
  order?: number
}

export interface V5mdPlugin<TApi = undefined> {
  /** 插件唯一名，建议使用 npm 包名或短横线命名。 */
  name: string
  version?: string
  apiVersion?: number
  /** 必装依赖的插件名，未安装时 use 直接报错。 */
  requires?: string[]
  /** 可选依赖，不校验，插件内部自行 getPlugin。 */
  optional?: string[]

  toolbar?: V5mdToolbarItem[]
  /** Slash (`/`) menu entries contributed by this plugin. */
  slash?: V5mdSlashItem[]
  commands?: Record<string, V5mdCommand>
  /** Custom fenced-code block renderers for this editor instance. */
  blocks?: V5mdBlockRenderer[]
  api?: (context: V5mdCommandContext) => TApi
  setup?(context: V5mdCommandContext): void | (() => void) | Promise<void>
  destroy?(): void
}

export interface V5mdPluginHandle<TApi = undefined> {
  readonly name: string
  readonly api: TApi
  readonly ready: Promise<void>
  dispose(): void
}

export interface ToolbarItemView {
  id: string
  command: string
  label: string
  icon: string
  group: string
  order: number
  type: 'action' | 'toggle'
  shortcut?: string
  isActive?(state: V5mdPluginState): boolean
  isDisabled?(state: V5mdPluginState): boolean
}

export interface SlashItemView {
  id: string
  title: string
  command: string
  keywords: readonly string[]
  order: number
  source: 'plugin'
}

export interface PluginRegistration<TApi = undefined> {
  plugin: V5mdPlugin<TApi>
  commands: ReadonlyMap<string, V5mdCommand>
  toolbar: readonly ToolbarItemView[]
  slash: readonly SlashItemView[]
  cleanup?: () => void
  disposed: boolean
}

/** Built-in `/` commands handled by `applySlashCommand`. */
export const BUILTIN_SLASH_COMMAND_IDS: ReadonlySet<string> = new Set([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'taskList',
  'quote',
  'code',
  'table',
  'rule',
  'link',
  'math',
  'inlineMath',
  'image',
])

export class PluginRegistry {
  private readonly entries = new Map<string, PluginRegistration<unknown>>()
  private readonly commandOwners = new Map<string, string>()
  private readonly toolbarIds = new Set<string>()
  private readonly slashIds = new Set<string>()

  constructor(
    private readonly builtinCommands: ReadonlySet<string>,
    private readonly builtinToolbarIds: ReadonlySet<string>,
  ) {}

  install<TApi = undefined>(plugin: V5mdPlugin<TApi>): PluginRegistration<TApi> {
    const name = plugin.name?.trim()
    if (!name) throw new Error('v5md plugin name is required')
    const existing = this.entries.get(name)
    if (existing) {
      if (existing.plugin === plugin) return existing as PluginRegistration<TApi>
      throw new Error(`v5md plugin "${name}" is already installed with a different instance`)
    }
    if ((plugin.apiVersion ?? PLUGIN_API_VERSION) !== PLUGIN_API_VERSION) {
      throw new Error(`v5md plugin "${name}" requires API version ${plugin.apiVersion}, expected ${PLUGIN_API_VERSION}`)
    }
    for (const required of plugin.requires ?? []) {
      if (!required) continue
      if (!this.entries.has(required)) {
        throw new Error(`v5md plugin "${name}" requires plugin "${required}" to be installed first`)
      }
    }

    const commands = new Map<string, V5mdCommand>()
    for (const [id, command] of Object.entries(plugin.commands ?? {})) {
      if (!id) throw new Error(`v5md plugin "${name}" has a command without an id`)
      if (!command || typeof command.run !== 'function') {
        throw new Error(`v5md plugin "${name}" command "${id}" must define run()`)
      }
      if (this.builtinCommands.has(id)) {
        throw new Error(`v5md plugin "${name}" cannot override built-in command "${id}"`)
      }
      if (this.commandOwners.has(id)) {
        throw new Error(`v5md plugin "${name}" command "${id}" is already owned by "${this.commandOwners.get(id)}"`)
      }
      commands.set(id, command as V5mdCommand)
    }

    const knownCommands = new Set([
      ...this.builtinCommands,
      ...this.builtinToolbarIds,
      ...this.commandOwners.keys(),
      ...commands.keys(),
    ])
    const toolbar: ToolbarItemView[] = []
    const toolbarIds = new Set<string>()
    for (const [index, item] of (plugin.toolbar ?? []).entries()) {
      const id = item.id ?? item.command
      if (!id) throw new Error(`v5md plugin "${name}" has a toolbar item without an id`)
      if (!item.command || !item.label || !item.icon) {
        throw new Error(`v5md plugin "${name}" toolbar item "${id}" needs command, label and icon`)
      }
      if (this.builtinToolbarIds.has(id) || this.toolbarIds.has(id) || toolbarIds.has(id)) {
        throw new Error(`v5md plugin "${name}" toolbar id "${id}" is already used`)
      }
      if (!knownCommands.has(item.command)) {
        throw new Error(`v5md plugin "${name}" toolbar item "${id}" references unknown command "${item.command}"`)
      }
      toolbarIds.add(id)
      toolbar.push({
        id,
        command: item.command,
        label: item.label,
        icon: item.icon,
        group: item.group ?? `plugin:${name}`,
        order: item.order ?? 1000 + index,
        type: item.type ?? 'action',
        shortcut: item.shortcut,
        isActive: item.isActive,
        isDisabled: item.isDisabled,
      })
    }

    const slash: SlashItemView[] = []
    const slashIds = new Set<string>()
    for (const [index, item] of (plugin.slash ?? []).entries()) {
      const id = item.id ?? item.command
      if (!id) throw new Error(`v5md plugin "${name}" has a slash item without an id`)
      if (!item.command || !item.title) {
        throw new Error(`v5md plugin "${name}" slash item "${id}" needs command and title`)
      }
      if (BUILTIN_SLASH_COMMAND_IDS.has(id) || this.slashIds.has(id) || slashIds.has(id)) {
        throw new Error(`v5md plugin "${name}" slash id "${id}" is already used`)
      }
      if (!knownCommands.has(item.command) && !BUILTIN_SLASH_COMMAND_IDS.has(item.command)) {
        throw new Error(`v5md plugin "${name}" slash item "${id}" references unknown command "${item.command}"`)
      }
      slashIds.add(id)
      slash.push({
        id,
        title: item.title,
        command: item.command,
        keywords: item.keywords ?? [],
        order: item.order ?? 1000 + index,
        source: 'plugin',
      })
    }

    for (const id of commands.keys()) this.commandOwners.set(id, name)
    for (const id of toolbarIds) this.toolbarIds.add(id)
    for (const id of slashIds) this.slashIds.add(id)
    const registration: PluginRegistration<TApi> = { plugin, commands, toolbar, slash, disposed: false }
    this.entries.set(name, registration as PluginRegistration<unknown>)
    return registration
  }

  remove(name: string): PluginRegistration<undefined> | undefined {
    const registration = this.entries.get(name)
    if (!registration) return undefined
    this.entries.delete(name)
    for (const id of registration.commands.keys()) this.commandOwners.delete(id)
    for (const item of registration.toolbar) this.toolbarIds.delete(item.id)
    for (const item of registration.slash) this.slashIds.delete(item.id)
    return registration as PluginRegistration<undefined>
  }

  get<TApi = undefined>(name: string): PluginRegistration<TApi> | undefined {
    return this.entries.get(name) as PluginRegistration<TApi> | undefined
  }

  list(): PluginRegistration<unknown>[] {
    return [...this.entries.values()]
  }

  findCommand(id: string): { plugin: string; command: V5mdCommand } | undefined {
    const owner = this.commandOwners.get(id)
    if (!owner) return undefined
    const registration = this.entries.get(owner)
    const command = registration?.commands.get(id)
    return registration && command ? { plugin: owner, command } : undefined
  }

  allToolbarItems(): ToolbarItemView[] {
    return this.list().flatMap((registration) => [...registration.toolbar])
  }

  allSlashItems(): SlashItemView[] {
    return this.list()
      .flatMap((registration) => [...registration.slash])
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  }

  get size(): number {
    return this.entries.size
  }
}
