import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'

export interface TopBlock {
  start: number
  end: number
  type: string
  childCount: number
  multiLine: boolean
}

export interface BlockChromeOptions {
  host: HTMLElement
  /** The handle and menu only exist while the editor is editable and not in source mode. */
  isEnabled(): boolean
  isFocused(): boolean
  getDoc(): string
  getCaret(): number
  /** Every top level block, including empty ones, in document order. */
  blocks(): TopBlock[]
  onMove(sourceStart: number, targetStart: number, side: 'before' | 'after'): void
  onAction(action: string): void
  messages?: LocaleMessages
}

const BLOCK_ACTION_KEYS = [
  'up',
  'down',
  'before',
  'after',
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'taskList',
  'quote',
  'delete',
] as const satisfies ReadonlyArray<keyof LocaleMessages['block']>

const CONVERT_ACTIONS = new Set([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'taskList',
  'quote',
])

const LIST_ACTIONS = new Set(['bulletList', 'orderedList', 'taskList'])

/** Owns the block handle, the block menu and the drag to reorder blocks. */
export class BlockChrome {
  private handle: HTMLButtonElement | null = null
  private menu: HTMLElement | null = null
  private source: number | null = null
  private drag: { start: number; doc: string } | null = null
  private dropLine: HTMLElement | null = null
  private messages: LocaleMessages

  constructor(private readonly options: BlockChromeOptions) {
    this.messages = options.messages ?? getMessages(DEFAULT_LOCALE)
  }

  setMessages(messages: LocaleMessages): void {
    this.messages = messages
    if (this.handle) this.handle.setAttribute('aria-label', messages.block.handle)
    if (this.menu?.isConnected) this.openMenu()
  }

  /** Start offset of the block the handle points at, if any. */
  currentSource(): number | null {
    return this.source
  }

  /** Forgets the hovered block so the next position call follows the caret. */
  reset(): void {
    this.source = null
  }

  isMenuOpen(): boolean {
    return Boolean(this.menu?.isConnected)
  }

  /** Whether the node belongs to the handle or an open menu. */
  owns(node: Node): boolean {
    return Boolean(this.menu?.contains(node) || this.handle?.contains(node))
  }

  hover(event: MouseEvent): void {
    if (!this.options.isEnabled() || this.drag) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('.v5-block-handle, .v5-block-menu')) return
    const block = target.closest<HTMLElement>('[data-block]')
    if (!block || block.parentElement !== this.documentHost() || block.dataset.block === 'yaml') return
    this.source = Number(block.dataset.start)
    this.position()
  }

  /** Places the handle next to the block holding the caret or the hovered block. */
  position(): void {
    if (!this.options.isEnabled()) {
      this.hide()
      return
    }
    if (this.source === null && this.options.isFocused()) {
      const offset = this.options.getCaret()
      const block = this.options
        .blocks()
        .find((node) => node.end > node.start && node.type !== 'yaml' && node.start <= offset && offset <= node.end)
      this.source = block?.start ?? null
    }
    if (this.source === null) return
    const block = [...this.options.host.querySelectorAll<HTMLElement>('.v5-doc > [data-block]')].find(
      (node) => Number(node.dataset.start) === this.source && node.dataset.block !== 'yaml',
    )
    if (!block) {
      this.hide()
      return
    }
    if (!this.handle) {
      this.handle = document.createElement('button')
      this.handle.type = 'button'
      this.handle.className = 'v5-block-handle'
      this.handle.contentEditable = 'false'
      this.handle.draggable = true
      this.handle.setAttribute('aria-label', this.messages.block.handle)
      this.handle.textContent = '⠿'
      this.handle.addEventListener('click', () => this.openMenu())
    }
    this.options.host.append(this.handle)
    const rect = block.getBoundingClientRect()
    const host = this.options.host.getBoundingClientRect()
    this.handle.style.top = `${rect.top - host.top + this.options.host.scrollTop}px`
    this.handle.style.left = `${rect.left - host.left - 28}px`
  }

  hide(): void {
    this.handle?.remove()
    this.hideMenu()
    this.dragEnd()
    this.source = null
  }

  hideMenu(): void {
    this.menu?.remove()
    this.menu = null
  }

  destroy(): void {
    this.hide()
    this.handle = null
    this.dropLine?.remove()
    this.dropLine = null
  }

  pointerDown(event: PointerEvent): void {
    if (!this.menu?.isConnected) return
    const target = event.target
    if (target instanceof Node && this.owns(target)) return
    this.hideMenu()
  }

  dragStart(event: DragEvent): void {
    if (!this.options.isEnabled()) return
    if (event.target !== this.handle || this.source === null) return
    this.drag = { start: this.source, doc: this.options.getDoc() }
    event.dataTransfer?.setData('text/plain', '')
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  dragOver(event: DragEvent): void {
    const drag = this.drag
    if (!drag || this.options.getDoc() !== drag.doc) return
    const block = this.targetBlock(event)
    if (!block || Number(block.dataset.start) === drag.start) return
    event.preventDefault()
    if (!this.dropLine) {
      this.dropLine = document.createElement('div')
      this.dropLine.className = 'v5-drop-line'
    }
    this.options.host.append(this.dropLine)
    const rect = block.getBoundingClientRect()
    const host = this.options.host.getBoundingClientRect()
    this.dropLine.style.top = `${(event.clientY >= (rect.top + rect.bottom) / 2 ? rect.bottom : rect.top) - host.top}px`
  }

  drop(event: DragEvent): void {
    if (!this.options.isEnabled()) {
      event.preventDefault()
      this.dragEnd()
      return
    }
    const drag = this.drag
    this.dragEnd()
    if (!drag || drag.doc !== this.options.getDoc()) return
    const block = this.targetBlock(event)
    if (!block) return
    event.preventDefault()
    const rect = block.getBoundingClientRect()
    this.options.onMove(
      drag.start,
      Number(block.dataset.start),
      event.clientY >= (rect.top + rect.bottom) / 2 ? 'after' : 'before',
    )
  }

  dragEnd(): void {
    this.drag = null
    this.dropLine?.remove()
    this.dropLine = null
  }

  private openMenu(): void {
    if (this.source === null) return
    const block = this.options.blocks().find((child) => child.start === this.source)
    if (!block) return
    this.hideMenu()
    const menu = document.createElement('div')
    menu.className = 'v5-block-menu'
    menu.contentEditable = 'false'
    for (const action of BLOCK_ACTION_KEYS) {
      if (CONVERT_ACTIONS.has(action)) {
        if (!['paragraph', 'heading', 'blockquote', 'list'].includes(block.type)) continue
        if (block.type === 'list' && (block.childCount !== 1 || block.multiLine) && !LIST_ACTIONS.has(action)) continue
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.blockAction = action
      button.textContent = this.messages.block[action]
      button.addEventListener('click', () => this.options.onAction(action))
      menu.append(button)
    }
    this.menu = menu
    this.options.host.append(menu)
    menu.style.top = `${parseFloat(this.handle?.style.top || '0') + 26}px`
    menu.style.left = `${parseFloat(this.handle?.style.left || '0')}px`
  }

  private targetBlock(event: DragEvent): HTMLElement | null {
    const target = event.target
    const block = target instanceof Element ? target.closest<HTMLElement>('[data-block]') : null
    if (!block || block.parentElement !== this.documentHost() || block.dataset.block === 'yaml') return null
    return block
  }

  private documentHost(): Element | null {
    return this.options.host.querySelector('.v5-doc')
  }
}
