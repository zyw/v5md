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
  commands?: Record<string, V5mdCommand>
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

export interface PluginRegistration<TApi = undefined> {
  plugin: V5mdPlugin<TApi>
  commands: ReadonlyMap<string, V5mdCommand>
  toolbar: readonly ToolbarItemView[]
  cleanup?: () => void
  disposed: boolean
}

export class PluginRegistry {
  private readonly entries = new Map<string, PluginRegistration<unknown>>()
  private readonly commandOwners = new Map<string, string>()
  private readonly toolbarIds = new Set<string>()

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

    for (const id of commands.keys()) this.commandOwners.set(id, name)
    for (const id of toolbarIds) this.toolbarIds.add(id)
    const registration: PluginRegistration<TApi> = { plugin, commands, toolbar, disposed: false }
    this.entries.set(name, registration as PluginRegistration<unknown>)
    return registration
  }

  remove(name: string): PluginRegistration<undefined> | undefined {
    const registration = this.entries.get(name)
    if (!registration) return undefined
    this.entries.delete(name)
    for (const id of registration.commands.keys()) this.commandOwners.delete(id)
    for (const item of registration.toolbar) this.toolbarIds.delete(item.id)
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

  get size(): number {
    return this.entries.size
  }
}
