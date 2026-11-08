import type { ToolbarItemView } from './plugin.js'
import { BUILTIN_TOOLBAR_ITEMS } from './builtins.js'

export type ToolbarCommand =
  | 'code'
  | 'table'
  | 'orderedList'
  | 'bulletList'
  | 'taskList'
  | 'quote'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'rule'
  | 'link'
  | 'math'
  | 'inlineMath'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'inlineCode'
  | 'strike'
  | 'highlight'
  | 'wechat'

export { BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS, BUILTIN_TOOLBAR_ITEMS } from './builtins.js'

const MIN_ITEM_WIDTH = 30
const OVERFLOW_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>'

export interface ToolbarControllerOptions {
  onCommand: (command: string) => void
  onImage: (file: File) => void
  onPickImage?: () => boolean
}

export interface ToolbarController {
  readonly element: HTMLElement
  setItems(items: readonly ToolbarItemView[]): void
  setHidden(hidden: boolean): void
  refresh(): void
  destroy(): void
}

export function createToolbarController(options: ToolbarControllerOptions): ToolbarController {
  const bar = document.createElement('div')
  bar.className = 'v5-toolbar'
  bar.contentEditable = 'false'
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', '工具条')
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true
  input.tabIndex = -1
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.value = ''
    if (file) options.onImage(file)
  })
  bar.append(input)

  const buttons = new Map<string, HTMLButtonElement>()
  const itemsById = new Map<string, ToolbarItemView>()
  let items: ToolbarItemView[] = []
  let moreGroup: HTMLElement | null = null
  let moreButton: HTMLButtonElement | null = null
  let menu: HTMLElement | null = null
  let scheduled = false

  const activate = (item: ToolbarItemView): void => {
    if (item.command === 'image') {
      if (options.onPickImage?.()) return
      input.click()
      return
    }
    options.onCommand(item.command)
  }

  const activateById = (id: string): void => {
    const item = itemsById.get(id)
    if (item) activate(item)
  }

  const ensureButton = (item: ToolbarItemView): HTMLButtonElement => {
    let button = buttons.get(item.id)
    if (!button) {
      button = document.createElement('button')
      button.type = 'button'
      button.tabIndex = -1
      button.dataset.itemId = item.id
      button.addEventListener('click', () => activateById(item.id))
      buttons.set(item.id, button)
    }
    button.dataset.command = item.command
    button.dataset.label = item.label
    button.setAttribute('aria-label', item.label)
    button.innerHTML = item.icon
    if (item.type === 'toggle') {
      if (!button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', 'false')
    } else {
      button.removeAttribute('aria-pressed')
    }
    return button
  }

  const ensureOverflow = (): void => {
    if (!moreGroup || !menu) {
      moreGroup = document.createElement('div')
      moreGroup.className = 'v5-toolbar-group v5-toolbar-overflow-group'
      moreButton = document.createElement('button')
      moreButton.type = 'button'
      moreButton.tabIndex = -1
      moreButton.dataset.overflow = 'true'
      moreButton.dataset.label = '更多工具'
      moreButton.setAttribute('aria-label', '更多工具')
      moreButton.setAttribute('aria-haspopup', 'menu')
      moreButton.setAttribute('aria-expanded', 'false')
      moreButton.innerHTML = OVERFLOW_ICON
      moreButton.addEventListener('click', () => {
        if (menu?.hidden === false) closeMenu()
        else openMenu()
      })
      moreGroup.append(moreButton)
      bar.insertBefore(moreGroup, input)
      menu = document.createElement('div')
      menu.className = 'v5-toolbar-menu'
      menu.hidden = true
      menu.setAttribute('role', 'menu')
      bar.insertBefore(menu, input)
    }
    moreGroup.hidden = false
  }

  const removeOverflow = (): void => {
    closeMenu()
    moreGroup?.remove()
    menu?.remove()
    moreGroup = null
    moreButton = null
    menu = null
  }

  const buildMenu = (hiddenItems: readonly ToolbarItemView[]): void => {
    if (!menu) return
    menu.replaceChildren()
    for (const item of hiddenItems) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'menuitem')
      button.dataset.itemId = item.id
      button.dataset.command = item.command
      if (item.type === 'toggle') button.setAttribute('aria-pressed', 'false')
      const icon = document.createElement('span')
      icon.className = 'v5-toolbar-menu-icon'
      icon.innerHTML = item.icon
      const label = document.createElement('span')
      label.className = 'v5-toolbar-menu-label'
      label.textContent = item.label
      button.append(icon, label)
      button.addEventListener('click', () => {
        activateById(item.id)
        closeMenu()
      })
      menu.append(button)
    }
  }

  const onDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (target instanceof Node && (menu?.contains(target) || moreButton?.contains(target))) return
    closeMenu()
  }

  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeMenu()
  }

  const openMenu = (): void => {
    if (!menu || !moreButton) return
    const hiddenItems = items.filter((item) => buttons.get(item.id)?.hidden)
    if (hiddenItems.length === 0) return
    buildMenu(hiddenItems)
    menu.hidden = false
    moreButton.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onDocumentKeyDown)
  }

  const closeMenu = (): void => {
    if (!menu) return
    menu.hidden = true
    moreButton?.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    document.removeEventListener('keydown', onDocumentKeyDown)
  }

  const layout = (): void => {
    const width = bar.hidden ? 0 : bar.clientWidth
    let visibleCount = items.length
    let overflow = false
    if (width > 0) {
      const totalSlots = Math.max(1, Math.floor((width - 20) / MIN_ITEM_WIDTH))
      if (items.length > totalSlots) {
        visibleCount = Math.max(1, totalSlots - 1)
        overflow = true
      }
    }
    items.forEach((item, index) => {
      const button = buttons.get(item.id)
      if (button) button.hidden = index >= visibleCount
    })
    for (const group of bar.querySelectorAll<HTMLElement>('.v5-toolbar-group:not(.v5-toolbar-overflow-group)')) {
      const visible = [...group.querySelectorAll('button')].filter((button) => !button.hidden).length
      group.hidden = visible === 0
      group.style.setProperty('--v5-count', String(Math.max(1, visible)))
    }
    if (overflow) ensureOverflow()
    else removeOverflow()
  }

  const scheduleLayout = (): void => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      layout()
    })
  }

  const setItems = (nextItems: readonly ToolbarItemView[]): void => {
    closeMenu()
    items = [...nextItems]
    itemsById.clear()
    for (const item of items) itemsById.set(item.id, item)
    const nextIds = new Set(items.map((item) => item.id))
    for (const [id, button] of buttons) {
      if (nextIds.has(id)) continue
      button.remove()
      buttons.delete(id)
    }
    for (const group of bar.querySelectorAll('.v5-toolbar-group:not(.v5-toolbar-overflow-group)')) group.remove()
    let group: HTMLElement | null = null
    let groupName: string | null = null
    for (const item of items) {
      if (!group || item.group !== groupName) {
        group = document.createElement('div')
        group.className = 'v5-toolbar-group'
        bar.insertBefore(group, moreGroup ?? menu ?? input)
        groupName = item.group
      }
      group.append(ensureButton(item))
    }
    layout()
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scheduleLayout()) : null
  observer?.observe(bar)
  const onWindowResize = () => scheduleLayout()
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindowResize)

  return {
    element: bar,
    setItems,
    setHidden(hidden) {
      bar.hidden = hidden
      if (!hidden) layout()
    },
    refresh: layout,
    destroy() {
      closeMenu()
      observer?.disconnect()
      if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize)
      bar.remove()
    },
  }
}

export function createToolbarFromItems(
  items: readonly ToolbarItemView[],
  onCommand: (command: string) => void,
  onImage: (file: File) => void,
  onPickImage?: () => boolean,
): HTMLElement {
  const controller = createToolbarController({ onCommand, onImage, onPickImage })
  controller.setItems(items)
  return controller.element
}

export function createToolbar(
  onCommand: (command: ToolbarCommand) => void,
  onImage: (file: File) => void,
  onPickImage?: () => boolean,
): HTMLElement {
  return createToolbarFromItems(
    BUILTIN_TOOLBAR_ITEMS,
    (command) => onCommand(command as ToolbarCommand),
    onImage,
    onPickImage,
  )
}
