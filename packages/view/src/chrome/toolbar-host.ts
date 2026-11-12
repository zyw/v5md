import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'
import type { ToolbarItemView, V5mdPluginState } from '../plugin.js'
import { createBuiltinToolbarItems } from './builtins.js'
import { createToolbarController, type ToolbarController } from './toolbar.js'

const GROUP_ORDER: Record<string, number> = {
  block: 10,
  list: 20,
  quote: 30,
  heading: 40,
  insert: 50,
  inline: 60,
  action: 70,
}

export interface ToolbarHostOptions {
  /** Plugin toolbar items; the built-in ones are added here. */
  pluginItems(): ToolbarItemView[]
  onCommand(command: string): void
  onImage(file: File): void
  onPickImage(): boolean
  /** State painted onto toggle buttons. */
  state(): V5mdPluginState
  messages?: LocaleMessages
}

const sortItems = (items: ToolbarItemView[]): ToolbarItemView[] => {
  const groupOrder = new Map<string, number>(Object.entries(GROUP_ORDER))
  for (const item of items) {
    if (!groupOrder.has(item.group)) groupOrder.set(item.group, 1000 + groupOrder.size)
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const groupA = groupOrder.get(a.item.group) ?? 1000
      const groupB = groupOrder.get(b.item.group) ?? 1000
      if (groupA !== groupB) return groupA - groupB
      if (a.item.order !== b.item.order) return a.item.order - b.item.order
      return a.index - b.index
    })
    .map((entry) => entry.item)
}

/** Mounts the toolbar and keeps its buttons in sync with the editor state. */
export class ToolbarHost {
  readonly element: HTMLElement
  private readonly controller: ToolbarController
  private items: ToolbarItemView[] = []
  private messages: LocaleMessages

  constructor(private readonly options: ToolbarHostOptions) {
    this.messages = options.messages ?? getMessages(DEFAULT_LOCALE)
    this.controller = createToolbarController({
      onCommand: (command) => options.onCommand(command),
      onImage: (file) => options.onImage(file),
      onPickImage: () => options.onPickImage(),
      messages: this.messages,
    })
    this.element = this.controller.element
  }

  mount(visible: boolean): void {
    this.element.hidden = !visible
    this.controller.setHidden(!visible)
    this.refresh()
  }

  /** Rebuilds the button list, for example after a plugin is added. */
  refresh(): void {
    this.items = sortItems([...createBuiltinToolbarItems(this.messages), ...this.options.pluginItems()])
    this.controller.setItems(this.items)
    this.controller.setHidden(this.element.hidden)
    this.sync()
  }

  setMessages(messages: LocaleMessages): void {
    this.messages = messages
    this.controller.setMessages(messages)
    this.refresh()
  }

  setHidden(hidden: boolean): void {
    this.element.hidden = hidden
    this.controller.setHidden(hidden)
  }

  /** Repaints toggle state and disabled flags. */
  sync(): void {
    const state = this.options.state()
    const itemsById = new Map(this.items.map((item) => [item.id, item]))
    this.element.querySelectorAll<HTMLButtonElement>('button[data-item-id]').forEach((button) => {
      const item = button.dataset.itemId ? itemsById.get(button.dataset.itemId) : undefined
      if (!item) return
      if (item.type === 'toggle') {
        button.setAttribute('aria-pressed', item.isActive?.(state) ? 'true' : 'false')
      } else {
        button.removeAttribute('aria-pressed')
      }
      button.disabled = item.isDisabled?.(state) ?? false
    })
  }

  /** Gives the WeChat button a short success or failure label. */
  flash(copied: boolean): void {
    const button = this.element.querySelector<HTMLButtonElement>('button[data-command="wechat"]')
    if (!button) return
    const label = copied ? this.messages.toolbar.wechatCopied : this.messages.toolbar.wechatFailed
    button.dataset.state = copied ? 'done' : 'error'
    button.dataset.label = label
    button.setAttribute('aria-label', label)
    setTimeout(() => {
      if (!button.isConnected) return
      delete button.dataset.state
      button.dataset.label = this.messages.toolbar.wechat
      button.setAttribute('aria-label', this.messages.toolbar.wechat)
    }, 1600)
  }

  destroy(): void {
    this.controller.destroy()
  }
}
