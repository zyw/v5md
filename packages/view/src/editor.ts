import {
  applySlashCommand,
  convertTopLevelBlock,
  createState,
  deleteBackward,
  deleteForward,
  findInState,
  indent,
  insertSoftBreak,
  insertText,
  editTable,
  formatBlock,
  moveTableCaret,
  moveTopLevelBlock,
  outdent,
  outline,
  parse,
  pathAt,
  redo,
  replaceAllMatches as replaceEveryMatch,
  replaceCurrentMatch,
  replaceRange,
  resizeImage,
  sortedRange,
  splitBlock,
  toggleMark,
  toggleTask,
  toggleUnderline,
  undo,
  type EditorState,
  type FindOptions,
  type FindQueryResult,
  type FormatCommand,
  type SlashCommand,
  type BlockType,
  type OutlineEntry,
  type TableCommand,
  type TextSelection,
} from '@v5md/core'
import { htmlToMarkdown } from './html-to-md.js'
import { createOutline, type OutlinePanel } from './outline.js'
import { createTableBar, markTableAlign } from './table-bar.js'
import { BUILTIN_COMMAND_IDS, BUILTIN_COMMANDS, BUILTIN_TOOLBAR_IDS, BUILTIN_TOOLBAR_ITEMS } from './builtins.js'
import { createToolbarController, type ToolbarCommand, type ToolbarController } from './toolbar.js'
import {
  PluginRegistry,
  type PluginRegistration,
  type ToolbarItemView,
  type V5mdCommandContext,
  type V5mdPlugin,
  type V5mdPluginHandle,
  type V5mdPluginState,
} from './plugin.js'
import { renderDocument } from './render.js'
import { applyChrome, domPointToOffset, offsetToDomPoint } from './selection.js'
import { copyRichText, toWechatHtml } from './wechat.js'

const TOOLBAR_GROUP_ORDER: Record<string, number> = {
  block: 10,
  list: 20,
  quote: 30,
  heading: 40,
  insert: 50,
  inline: 60,
  action: 70,
}

export interface FindRequest {
  kind: 'find' | 'replace'
}

export interface EditorOptions {
  element: HTMLElement
  value?: string
  placeholder?: string
  toolbar?: boolean
  outline?: boolean
  /** Shows line numbers next to the source in source mode. Defaults to true. */
  lineNumbers?: boolean
  editable?: boolean
  onChange?: (markdown: string) => void
  onUploadImage?: (file: File) => string | Promise<string>
  /** Handles the image toolbar button. Return false to keep the system file picker. */
  onPickImage?: () => void | false
  onFindRequest?: (request: FindRequest) => void
  plugins?: V5mdPlugin[]
}

export class Editor {
  private readonly element: HTMLElement
  private readonly options: EditorOptions
  private state: EditorState
  private readonly abort = new AbortController()
  private rendering = false
  private focused = false
  private composing = false
  private compositionSelection: TextSelection | null = null
  private ignoreInsert: string | null = null
  private suppressBreak = false
  private sourceMode = false
  private lineNumbers = true
  private paintGeneration = 0
  private findBar: HTMLFormElement | null = null
  private tableBar: HTMLElement | null = null
  private toolbar: HTMLElement | null = null
  private toolbarController: ToolbarController | null = null
  private outlinePanel: OutlinePanel | null = null
  private toolbarVisible = true
  private outlineVisible = true
  private editable = true
  private findQuery: HTMLInputElement | null = null
  private replaceQuery: HTMLInputElement | null = null
  private slashMenu: HTMLElement | null = null
  private slashRange: { from: number; to: number } | null = null
  private slashIndex = 0
  private handle: HTMLButtonElement | null = null
  private handleSource: number | null = null
  private blockMenu: HTMLElement | null = null
  private dragSource: { start: number; doc: string } | null = null
  private dropLine: HTMLElement | null = null
  private imageDrag: { pointerId: number; startX: number; width: number; height: number; keepHeight: boolean; img: HTMLImageElement } | null = null
  private readonly pluginRegistry: PluginRegistry
  private readonly pluginHandles = new Map<string, V5mdPluginHandle<unknown>>()
  private toolbarItems: ToolbarItemView[] = []
  private destroyed = false

  constructor(options: EditorOptions) {
    this.options = options
    this.element = options.element
    this.toolbarVisible = options.toolbar !== false
    this.outlineVisible = options.outline !== false
    this.lineNumbers = options.lineNumbers !== false
    this.editable = options.editable !== false
    this.pluginRegistry = new PluginRegistry(BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS)
    for (const plugin of options.plugins ?? []) this.pluginRegistry.install(plugin)
    this.state = createState(options.value ?? '')
    this.prepare()
    this.mountChrome()
    this.render()
    this.listen()
    for (const registration of this.pluginRegistry.list()) this.activatePlugin(registration)
  }

  getMarkdown(): string {
    return this.state.doc
  }

  getHostElement(): HTMLElement {
    return this.element
  }

  getContentElement(): HTMLElement {
    return this.surface()
  }

  getPluginState(): V5mdPluginState {
    return {
      markdown: this.state.doc,
      selection: { ...this.state.selection },
      path: pathAt(parse(this.state.doc), this.state.selection.head, this.state.doc.length),
      editable: this.editable,
      sourceMode: this.sourceMode,
      findOpen: Boolean(this.findBar && !this.findBar.hidden),
      toolbarVisible: this.toolbarVisible,
      outlineVisible: this.outlineVisible,
    }
  }

  insertText(text: string): boolean {
    if (!this.editable) return false
    const next = insertText(this.state, text)
    if (next === this.state) return false
    this.commit(next)
    return true
  }

  replaceSelection(text: string): boolean {
    if (!this.editable) return false
    const { from, to } = sortedRange(this.state.selection)
    const next = replaceRange(this.state, from, to, text)
    if (next === this.state) return false
    this.commit(next)
    return true
  }

  wrapSelection(before: string, after = before): boolean {
    if (!this.editable) return false
    const { from, to } = sortedRange(this.state.selection)
    const selected = this.state.doc.slice(from, to)
    const next = replaceRange(this.state, from, to, before + selected + after)
    if (next === this.state) return false
    const anchor = from + before.length
    this.commit({ ...next, selection: { anchor, head: anchor + selected.length } })
    return true
  }

  use<T = undefined>(plugin: V5mdPlugin<T>): V5mdPluginHandle<T> {
    if (this.destroyed) throw new Error('v5md editor has been destroyed')
    const existing = this.pluginRegistry.get(plugin.name)
    if (existing) {
      if (existing.plugin !== plugin) {
        throw new Error(`v5md plugin "${plugin.name}" is already installed with a different instance`)
      }
      const handle = this.pluginHandles.get(plugin.name)
      if (handle) return handle as V5mdPluginHandle<T>
    }
    const registration = this.pluginRegistry.install(plugin)
    this.refreshToolbar()
    return this.activatePlugin(registration)
  }

  getPlugin<T = undefined>(name: string): V5mdPluginHandle<T> | undefined {
    return this.pluginHandles.get(name) as V5mdPluginHandle<T> | undefined
  }

  async runCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
    if (this.destroyed) throw new Error('v5md editor has been destroyed')
    const builtin = BUILTIN_COMMANDS[id as ToolbarCommand]
    if (builtin) {
      return (await builtin.run(this.createCommandContext(), ...args)) as T
    }
    const found = this.pluginRegistry.findCommand(id)
    if (!found) throw new Error(`Unknown v5md command: ${id}`)
    const state = this.getPluginState()
    if (found.command.isEnabled && !found.command.isEnabled(state)) return undefined as T
    return (await found.command.run(this.createCommandContext(), ...args)) as T
  }

  setMarkdown(markdown: string): void {
    const next = createState(markdown)
    if (next.doc === this.state.doc) return
    const offset = Math.min(this.state.selection.head, next.doc.length)
    this.state = { doc: next.doc, selection: { anchor: offset, head: offset }, history: next.history }
    this.hideSlash()
    this.hideHandle()
    this.render()
  }

  focus(): void {
    this.clearFindHit()
    this.focusSurface()
    this.restoreSelection()
  }

  focusAt(offset: number): void {
    const clamped = Math.max(0, Math.min(offset, this.state.doc.length))
    this.state = { ...this.state, selection: { anchor: clamped, head: clamped } }
    this.handleSource = null
    this.focused = true
    this.rendering = true
    this.focusSurface()
    this.render()
    this.scrollSelectionIntoView()
  }

  getOutline(): OutlineEntry[] {
    return outline(this.state.doc)
  }

  isSourceMode(): boolean {
    return this.sourceMode
  }

  setSourceMode(enabled: boolean): void {
    if (this.sourceMode === enabled) return
    this.sourceMode = enabled
    this.element.classList.toggle('v5-source-mode', enabled)
    this.render()
  }

  toggleSourceMode(): void {
    this.setSourceMode(!this.sourceMode)
  }

  isLineNumbersVisible(): boolean {
    return this.lineNumbers
  }

  setLineNumbersVisible(visible: boolean): void {
    if (this.lineNumbers === visible) return
    this.lineNumbers = visible
    if (this.sourceMode) this.render()
  }

  openFind(): void {
    const bar = this.ensureFindBar()
    bar.hidden = false
    this.attachFindBar()
    this.findQuery?.focus()
    this.findQuery?.select()
  }

  findNextMatch(query: string, options: FindOptions = {}, direction: 1 | -1 = 1, advance = true): FindQueryResult {
    if (!query) {
      this.clearFindHit()
      return { hit: null, error: null }
    }
    const located = findInState(this.state, query, direction, options, advance)
    if (!located.result.hit) {
      this.clearFindHit()
      return located.result
    }
    this.revealFind(located.state)
    return located.result
  }

  replaceNextMatch(query: string, replacement: string, options: FindOptions = {}): FindQueryResult {
    const replaced = replaceCurrentMatch(this.state, query, replacement, options)
    if (replaced.state === this.state) {
      this.clearFindHit()
      return replaced.result
    }
    this.revealFind(replaced.state)
    return replaced.result
  }

  replaceAllMatches(query: string, replacement: string, options: FindOptions = {}): FindQueryResult {
    const replaced = replaceEveryMatch(this.state, query, replacement, options)
    if (replaced.state === this.state) {
      this.clearFindHit()
      return replaced.result
    }
    this.revealFind(replaced.state)
    return replaced.result
  }

  selectFindMatch(from: number, to: number): void {
    const end = this.state.doc.length
    const start = Math.max(0, Math.min(from, end))
    const stop = Math.max(start, Math.min(to, end))
    this.revealFind({ ...this.state, selection: { anchor: start, head: stop } })
  }

  findNext(query = this.findQuery?.value ?? ''): boolean {
    const result = this.findNextMatch(query)
    if (result.hit) this.focusSurface()
    return result.hit !== null
  }

  replaceNext(query = this.findQuery?.value ?? '', replacement = this.replaceQuery?.value ?? ''): void {
    const result = this.replaceNextMatch(query, replacement)
    if (result.hit) this.focusSurface()
  }

  replaceAll(query = this.findQuery?.value ?? '', replacement = this.replaceQuery?.value ?? ''): void {
    this.replaceAllMatches(query, replacement)
    this.focusSurface()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const registration of [...this.pluginRegistry.list()].reverse()) {
      this.disposePlugin(registration.plugin.name, true)
    }
    this.toolbarController?.destroy()
    this.toolbarController = null
    this.toolbar = null
    this.abort.abort()
    this.hideSlash()
    this.hideHandle()
    this.dropLine?.remove()
    this.findBar?.remove()
    this.findBar = null
    this.element.replaceChildren()
    this.element.contentEditable = 'false'
  }

  toggleBold(): void {
    this.commit(toggleMark(this.state, '**'))
  }

  toggleItalic(): void {
    this.commit(toggleMark(this.state, '*'))
  }

  toggleCode(): void {
    this.commit(toggleMark(this.state, '`'))
  }

  toggleStrikethrough(): void {
    this.commit(toggleMark(this.state, '~~'))
  }

  toggleHighlight(): void {
    this.commit(toggleMark(this.state, '=='))
  }

  toggleUnderline(): void {
    this.commit(toggleUnderline(this.state))
  }

  format(command: FormatCommand): void {
    this.focused = true
    this.focusSurface()
    this.commit(formatBlock(this.state, command))
  }

  insertImageFile(file: File): void {
    this.focused = true
    void this.insertImage(file)
  }

  insertImageUrl(url: string, alt = ''): void {
    const target = url.trim()
    if (!target || this.abort.signal.aborted) return
    this.focused = true
    this.focusSurface()
    const label = alt.replace(/[\[\]\r\n]/g, '').trim()
    this.commit(insertText(this.state, `![${label}](${target})`))
  }

  getWechatHtml(): string {
    return toWechatHtml(this.state.doc)
  }

  async copyForWechat(): Promise<boolean> {
    const html = toWechatHtml(this.state.doc)
    const copied = await copyRichText(html, html)
    this.flashWechatButton(copied)
    return copied
  }

  isToolbarVisible(): boolean {
    return this.toolbarVisible
  }

  setToolbarVisible(visible: boolean): void {
    this.toolbarVisible = visible
    if (this.toolbar) this.toolbar.hidden = !visible
    this.toolbarController?.setHidden(!visible)
  }

  isOutlineVisible(): boolean {
    return this.outlineVisible
  }

  setOutlineVisible(visible: boolean): void {
    this.outlineVisible = visible
    if (this.outlinePanel) this.outlinePanel.element.hidden = !visible
  }

  setEditable(enabled: boolean): void {
    if (this.editable === enabled) return
    this.editable = enabled
    if (!enabled) {
      this.hideSlash()
      this.hideHandle()
      this.dropLine?.remove()
      this.clearChrome()
    }
    this.element.classList.toggle('v5-preview', !enabled)
    this.syncSurface()
  }

  setPlaceholder(placeholder: string): void {
    if ((this.options.placeholder ?? '') === placeholder) return
    this.options.placeholder = placeholder
    const doc = this.element.querySelector<HTMLElement>('.v5-doc')
    if (doc) doc.dataset.placeholder = placeholder
    this.element.dataset.placeholder = placeholder
  }

  undo(): void {
    this.commit(undo(this.state))
  }

  redo(): void {
    this.commit(redo(this.state))
  }

  moveBlock(sourceStart: number, targetStart: number, side: 'before' | 'after'): void {
    this.commit(moveTopLevelBlock(this.state, sourceStart, targetStart, side))
    this.handleSource = null
    this.hideHandle()
  }

  private prepare(): void {
    this.element.classList.add('v5md')
    this.element.classList.toggle('v5-preview', !this.editable)
    // The shell is a row flexbox (toolbar, document, outline). A contenteditable
    // flex container turns IME composition into sibling flex items, so the
    // uncommitted text sits beside the placeholder. Edit the document itself.
    this.element.contentEditable = 'false'
    this.element.translate = false
    this.syncSurface()
  }

  private surface(): HTMLElement {
    const doc = this.element.querySelector('.v5-doc')
    return doc instanceof HTMLElement ? doc : this.element
  }

  private focusSurface(): void {
    this.surface().focus()
  }

  private syncSurface(): void {
    const doc = this.element.querySelector('.v5-doc')
    if (!(doc instanceof HTMLElement)) return
    doc.contentEditable = this.editable ? 'true' : 'false'
    if (this.editable) doc.removeAttribute('tabindex')
    else doc.tabIndex = 0
    doc.spellcheck = false
    doc.autocapitalize = 'off'
    if (this.editable) {
      doc.setAttribute('role', 'textbox')
      doc.setAttribute('aria-multiline', 'true')
      doc.removeAttribute('aria-readonly')
    } else {
      doc.setAttribute('role', 'document')
      doc.removeAttribute('aria-multiline')
      doc.setAttribute('aria-readonly', 'true')
    }
    doc.translate = false
    if (!this.composing) doc.classList.remove('v5-composing')
    this.element.removeAttribute('role')
    this.element.removeAttribute('aria-multiline')
  }

  private mountChrome(): void {
    this.toolbarController = createToolbarController({
      onCommand: (command) => this.onToolbarCommand(command),
      onImage: (file) => this.insertImageFile(file),
      onPickImage: () => {
        const pick = this.options.onPickImage
        if (!pick) return false
        return pick() !== false
      },
    })
    this.toolbar = this.toolbarController.element
    this.outlinePanel = createOutline((start) => this.focusAt(start))
    this.toolbar.hidden = !this.toolbarVisible
    this.outlinePanel.element.hidden = !this.outlineVisible
    const doc = document.createElement('div')
    doc.className = 'v5-doc'
    this.element.append(this.toolbar, this.outlinePanel.element, doc)
    this.toolbarItems = this.buildToolbarItems()
    this.toolbarController.setItems(this.toolbarItems)
    this.toolbarController.setHidden(!this.toolbarVisible)
  }

  private buildToolbarItems(): ToolbarItemView[] {
    const items = [...BUILTIN_TOOLBAR_ITEMS, ...this.pluginRegistry.allToolbarItems()]
    const groupOrder = new Map<string, number>(Object.entries(TOOLBAR_GROUP_ORDER))
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

  private refreshToolbar(): void {
    if (!this.toolbarController) return
    this.toolbarItems = this.buildToolbarItems()
    this.toolbarController.setItems(this.toolbarItems)
    this.toolbarController.setHidden(!this.toolbarVisible)
    this.syncToolbarState()
  }

  private onToolbarCommand(command: string): void {
    if (command === 'image') return
    void this.runCommand(command).catch((error) => {
      console.error(`[v5md] command "${command}" failed`, error)
    })
  }

  private activatePlugin<T>(registration: PluginRegistration<T>): V5mdPluginHandle<T> {
    const plugin = registration.plugin
    const context = this.createCommandContext()
    let api: T
    try {
      api = plugin.api ? plugin.api(context) : (undefined as T)
    } catch (error) {
      this.pluginRegistry.remove(plugin.name)
      if (this.toolbar) this.refreshToolbar()
      throw error
    }
    let resolveReady!: () => void
    let rejectReady!: (error: unknown) => void
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    void ready.catch(() => {})
    const handle: V5mdPluginHandle<T> = {
      name: plugin.name,
      api,
      ready,
      dispose: () => this.disposePlugin(plugin.name),
    }
    this.pluginHandles.set(plugin.name, handle as V5mdPluginHandle<unknown>)
    try {
      const result = plugin.setup?.(context)
      if (result && typeof (result as Promise<void>).then === 'function') {
        void Promise.resolve(result).then(
          () => {
            if (registration.disposed) {
              registration.cleanup?.()
              registration.cleanup = undefined
            }
            resolveReady()
          },
          (error) => {
            console.error(`[v5md] plugin "${plugin.name}" setup failed`, error)
            rejectReady(error)
          },
        )
      } else {
        if (typeof result === 'function') registration.cleanup = result
        if (registration.disposed) {
          registration.cleanup?.()
          registration.cleanup = undefined
        }
        resolveReady()
      }
    } catch (error) {
      console.error(`[v5md] plugin "${plugin.name}" setup failed`, error)
      rejectReady(error)
    }
    return handle
  }

  private disposePlugin(name: string, skipRefresh = false): void {
    const registration = this.pluginRegistry.get(name)
    if (!registration) return
    registration.disposed = true
    this.pluginHandles.delete(name)
    const cleanup = registration.cleanup
    registration.cleanup = undefined
    try {
      cleanup?.()
    } catch (error) {
      console.error(`[v5md] plugin "${name}" cleanup failed`, error)
    }
    try {
      registration.plugin.destroy?.()
    } catch (error) {
      console.error(`[v5md] plugin "${name}" destroy failed`, error)
    }
    this.pluginRegistry.remove(name)
    if (!skipRefresh && this.toolbar) this.refreshToolbar()
  }

  private createCommandContext(): V5mdCommandContext {
    return {
      editor: this,
      host: this.element,
      state: this.getPluginState(),
      insertText: (text) => this.insertText(text),
      replaceSelection: (text) => this.replaceSelection(text),
      wrapSelection: (before, after) => this.wrapSelection(before, after),
      focus: () => this.focus(),
    }
  }

  private syncToolbarState(): void {
    const bar = this.toolbar
    if (!bar) return
    const state = this.getPluginState()
    const itemsById = new Map(this.toolbarItems.map((item) => [item.id, item]))
    bar.querySelectorAll<HTMLButtonElement>('button[data-item-id]').forEach((button) => {
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

  private listen(): void {
    const { signal } = this.abort
    this.element.addEventListener('beforeinput', this.onBeforeInput, { signal })
    this.element.addEventListener('keydown', this.onKeyDown, { signal })
    this.element.addEventListener('paste', this.onPaste, { signal })
    this.element.addEventListener('copy', this.onCopy, { signal })
    this.element.addEventListener('cut', this.onCut, { signal })
    this.element.addEventListener('compositionstart', this.onCompositionStart, { signal })
    this.element.addEventListener('compositionend', this.onCompositionEnd, { signal })
    this.element.addEventListener('mousedown', this.onMouseDown, { signal })
    this.element.addEventListener('mouseover', this.onHoverBlock, { signal })
    this.element.addEventListener('dragstart', this.onDragStart, { signal })
    this.element.addEventListener('dragover', this.onDragOver, { signal })
    this.element.addEventListener('drop', this.onDrop, { signal })
    this.element.addEventListener('dragend', this.onDragEnd, { signal })
    this.element.addEventListener('click', this.onClick, { signal })
    this.element.addEventListener('input', this.onInput, { signal })
    this.surface().addEventListener('focus', this.onFocus, { signal })
    this.surface().addEventListener('blur', this.onBlur, { signal })
    document.addEventListener('selectionchange', this.onSelectionChange, { signal })
    this.element.addEventListener('scroll', () => this.positionTableBar(), { signal })
    document.addEventListener('scroll', () => this.positionTableBar(), { signal, capture: true })
    document.addEventListener('pointerdown', this.onPointerDown, { signal, capture: true })
    this.element.addEventListener('pointerdown', this.onImagePointerDown, { signal })
    document.addEventListener('pointermove', this.onImagePointerMove, { signal })
    document.addEventListener('pointerup', this.onImagePointerUp, { signal })
    document.addEventListener('pointercancel', this.onImagePointerUp, { signal })
  }

  private commit(next: EditorState, allowReadOnly = false): void {
    if (!allowReadOnly && !this.editable && next.doc !== this.state.doc) return
    const changed = next.doc !== this.state.doc
    this.clearFindHit()
    this.state = next
    this.render()
    if (changed) this.options.onChange?.(this.state.doc)
  }

  private flashWechatButton(copied: boolean): void {
    const button = this.toolbar?.querySelector<HTMLButtonElement>('button[data-command="wechat"]')
    if (!button) return
    const label = copied ? '已复制到公众号' : '复制失败'
    button.dataset.state = copied ? 'done' : 'error'
    button.dataset.label = label
    button.setAttribute('aria-label', label)
    setTimeout(() => {
      if (!button.isConnected) return
      delete button.dataset.state
      button.dataset.label = '复制到公众号'
      button.setAttribute('aria-label', '复制到公众号')
    }, 1600)
  }

  private revealFind(next: EditorState): void {
    if (!this.editable && next.doc !== this.state.doc) return
    const previous = document.activeElement
    const changed = next.doc !== this.state.doc
    this.state = next
    this.focused = true
    this.render()
    this.scrollSelectionIntoView()
    this.paintFindHit()
    if (changed) this.options.onChange?.(this.state.doc)
    this.restoreOutsideFocus(previous)
  }

  private restoreOutsideFocus(previous: Element | null): void {
    if (!(previous instanceof HTMLElement)) return
    const surface = this.surface()
    if (previous === surface || surface.contains(previous)) return
    previous.focus({ preventScroll: true })
  }

  private paintFindHit(): void {
    const highlights = globalThis.CSS?.highlights
    if (!highlights || typeof Highlight === 'undefined') return
    const { from, to } = sortedRange(this.state.selection)
    const start = offsetToDomPoint(this.element, from)
    const end = offsetToDomPoint(this.element, to)
    if (!start || !end || from === to) {
      highlights.delete('v5-find')
      return
    }
    const range = document.createRange()
    try {
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset)
      highlights.set('v5-find', new Highlight(range))
    } catch {
      highlights.delete('v5-find')
    }
  }

  private clearFindHit(): void {
    globalThis.CSS?.highlights?.delete('v5-find')
  }

  private render(): void {
    this.rendering = true
    try {
      this.prepare()
      const active = document.activeElement === this.surface()
      renderDocument(
        this.element,
        {
          doc: this.state.doc,
          head: this.state.selection.head,
          anchor: this.state.selection.anchor,
          placeholder: this.options.placeholder,
          sourceMode: this.sourceMode,
          lineNumbers: this.lineNumbers,
        },
        parse(this.state.doc),
      )
      void this.paintDiagrams()
      this.attachFindBar()
      this.outlinePanel?.update(this.getOutline())
      this.syncToolbarState()
      this.updateSlash()
      this.positionHandle()
      if (this.focused || active) this.syncChrome()
      if (active) this.focusSurface()
      this.restoreSelection()
    } finally {
      this.rendering = false
    }
  }

  private restoreSelection(): void {
    const head = offsetToDomPoint(this.element, this.state.selection.head)
    const anchor =
      this.state.selection.anchor === this.state.selection.head
        ? head
        : offsetToDomPoint(this.element, this.state.selection.anchor)
    const selection = document.getSelection()
    if (!head || !anchor || !selection) return
    try {
      selection.setBaseAndExtent(anchor.node, anchor.offset, head.node, head.offset)
    } catch {
      // The browser rejects a caret inside a hidden marker. Chrome stays on the model offset.
    }
  }

  private scrollSelectionIntoView(): void {
    const scroll = () => {
      const point = offsetToDomPoint(this.element, this.state.selection.head)
      const node = point?.node
      const host = node instanceof HTMLElement ? node : node?.parentElement
      host
        ?.closest<HTMLElement>('[data-block], .v5-source-line')
        ?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
    scroll()
    requestAnimationFrame(scroll)
  }

  private onBeforeInput = (event: InputEvent) => {
    if (!this.editable) {
      event.preventDefault()
      return
    }
    if (this.composing || event.isComposing) return
    const type = event.inputType
    if (type === 'insertCompositionText' || type === 'deleteCompositionText' || type === 'deleteByComposition') return
    if (type === 'insertText' && event.data && event.data === this.ignoreInsert) {
      event.preventDefault()
      this.ignoreInsert = null
      return
    }
    if ((type === 'insertParagraph' || type === 'insertLineBreak') && this.suppressBreak) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    if (type === 'insertText') this.commit(insertText(this.state, event.data ?? ''))
    else if (type === 'insertParagraph') this.commit(splitBlock(this.state))
    else if (type === 'insertLineBreak') this.commit(insertSoftBreak(this.state))
    else if (type === 'deleteContentBackward') this.commit(deleteBackward(this.state))
    else if (type === 'deleteContentForward') this.commit(deleteForward(this.state))
    else if (type === 'historyUndo') this.commit(undo(this.state))
    else if (type === 'historyRedo') this.commit(redo(this.state))
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.blockMenu?.isConnected) return
    const target = event.target
    if (target instanceof Node && (this.blockMenu.contains(target) || this.handle?.contains(target))) return
    this.hideBlockMenu()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.composing || event.isComposing) return
    if (this.slashMenu?.isConnected) {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.hideSlash()
        return
      }
      const options = [...this.slashMenu.querySelectorAll<HTMLButtonElement>('button')]
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        this.slashIndex = (this.slashIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        options.forEach((option, index) => option.classList.toggle('v5-selected', index === this.slashIndex))
        return
      }
      if (event.key === 'Enter' && options.length > 0) {
        event.preventDefault()
        this.executeSlash(options[this.slashIndex].dataset.command as SlashCommand)
        return
      }
    }
    if (this.blockMenu?.isConnected && event.key === 'Escape') {
      event.preventDefault()
      this.hideBlockMenu()
      return
    }
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (mod && !event.altKey && !event.shiftKey && (key === 'f' || key === 'h')) {
      event.preventDefault()
      if (this.options.onFindRequest) this.options.onFindRequest({ kind: key === 'h' ? 'replace' : 'find' })
      else this.openFind()
      return
    }
    if (!this.editable) return
    if (mod && !event.altKey && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) this.redo()
      else this.undo()
      return
    }
    if (mod && !event.altKey && key === 'y') {
      event.preventDefault()
      this.redo()
      return
    }
    if (mod && !event.altKey && key === 'b') {
      event.preventDefault()
      this.toggleBold()
      return
    }
    if (mod && !event.altKey && key === 'i') {
      event.preventDefault()
      this.toggleItalic()
      return
    }
    if (mod && !event.altKey && !event.shiftKey && event.key === '`') {
      event.preventDefault()
      this.toggleCode()
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 'x') {
      event.preventDefault()
      this.toggleStrikethrough()
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 'h') {
      event.preventDefault()
      this.toggleHighlight()
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 's') {
      event.preventDefault()
      this.toggleSourceMode()
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 'k') {
      event.preventDefault()
      this.format('code')
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 't') {
      event.preventDefault()
      this.format('table')
      return
    }
    if (mod && event.shiftKey && !event.altKey && event.code === 'BracketLeft') {
      event.preventDefault()
      this.format('orderedList')
      return
    }
    if (mod && event.shiftKey && !event.altKey && event.code === 'BracketRight') {
      event.preventDefault()
      this.format('bulletList')
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 'o') {
      event.preventDefault()
      this.format('taskList')
      return
    }
    if (mod && event.shiftKey && !event.altKey && key === 'q') {
      event.preventDefault()
      this.format('quote')
      return
    }
    if (mod && !event.shiftKey && !event.altKey && event.key === '1') {
      event.preventDefault()
      this.format('heading1')
      return
    }
    if (mod && !event.shiftKey && !event.altKey && event.key === '2') {
      event.preventDefault()
      this.format('heading2')
      return
    }
    if (mod && !event.shiftKey && !event.altKey && event.key === '3') {
      event.preventDefault()
      this.format('heading3')
      return
    }
    if (mod && !event.shiftKey && !event.altKey && key === 'k') {
      event.preventDefault()
      this.format('link')
      return
    }
    if (mod && !event.shiftKey && !event.altKey && key === 'u') {
      event.preventDefault()
      this.toggleUnderline()
      return
    }
    if (mod && !event.altKey && event.key === '~') {
      event.preventDefault()
      this.toggleStrikethrough()
      return
    }
    if (mod && !event.altKey && (event.key === '=' || event.key === '+')) {
      event.preventDefault()
      this.toggleHighlight()
      return
    }
    if (this.sourceMode && event.key === 'Tab') {
      event.preventDefault()
      this.commit(insertText(this.state, '  '))
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const moved = moveTableCaret(this.state, event.shiftKey ? -1 : 1)
      if (moved) this.commit(moved)
      else this.commit(event.shiftKey ? outdent(this.state) : indent(this.state))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      this.suppressBreak = true
      queueMicrotask(() => {
        this.suppressBreak = false
      })
      if (this.sourceMode) this.commit(insertText(this.state, '\n'))
      else this.commit(event.shiftKey ? insertSoftBreak(this.state) : splitBlock(this.state))
    }
  }

  private onPaste = (event: ClipboardEvent) => {
    if (!this.editable) {
      event.preventDefault()
      return
    }
    if (this.composing) return
    event.preventDefault()
    const files = [...(event.clipboardData?.files ?? [])]
    const image = files.find((file) => file.type.startsWith('image/'))
    if (image && this.options.onUploadImage) {
      void this.insertImage(image)
      return
    }
    const html = event.clipboardData?.getData('text/html') ?? ''
    const text = event.clipboardData?.getData('text/plain') ?? ''
    const rich = Boolean(html) && /<(p|h1|h2|h3|h4|li|blockquote|pre|ul|ol)\b/i.test(html)
    // Source mode edits the markdown string itself. Converting the clipboard
    // HTML there would wrap copied markdown in a code fence when the source
    // page put it inside <pre>, so keep the plain text untouched.
    const markdown = rich && !(this.sourceMode && text) ? htmlToMarkdown(html) : text
    if (markdown) this.commit(insertText(this.state, markdown))
  }

  private async insertImage(file: File): Promise<void> {
    const upload = this.options.onUploadImage
    if (!upload) return
    const url = await upload(file)
    if (!url || this.abort.signal.aborted) return
    const alt = file.name.replace(/\.[^.]+$/, '')
    this.insertImageUrl(url, alt)
  }

  private onCopy = (event: ClipboardEvent) => {
    if (!this.sourceMode) {
      this.copySelectionAsRich(event)
      return
    }
    const slice = this.selectedText()
    if (slice == null) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', slice)
  }

  private onCut = (event: ClipboardEvent) => {
    if (!this.editable) {
      this.onCopy(event)
      return
    }
    if (!this.sourceMode) {
      if (!this.copySelectionAsRich(event)) return
      this.commit(insertText(this.state, ''))
      return
    }
    const slice = this.selectedText()
    if (slice == null) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', slice)
    this.commit(insertText(this.state, ''))
  }

  private copySelectionAsRich(event: ClipboardEvent): boolean {
    if (typeof document === 'undefined') return false
    const selection = document.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    if (!this.element.contains(range.commonAncestorContainer)) return false
    const holder = document.createElement('div')
    holder.style.position = 'fixed'
    holder.style.left = '-9999px'
    holder.style.top = '0'
    holder.style.opacity = '0'
    holder.style.pointerEvents = 'none'
    holder.append(range.cloneContents())
    document.body.append(holder)
    this.cleanCopiedFragment(holder)
    const html = holder.innerHTML
    const text = (holder.innerText || holder.textContent || '').replace(/\u00a0/g, ' ').trim() || selection.toString()
    holder.remove()
    if (!html) return false
    event.preventDefault()
    event.clipboardData?.setData('text/html', html)
    if (text) event.clipboardData?.setData('text/plain', text)
    return true
  }

  private cleanCopiedFragment(root: HTMLElement): void {
    root
      .querySelectorAll(
        '.md-marker, .v5-marker, .v5-source, .v5-image-resize, .v5-empty-line, .v5-block-handle, .v5-block-menu, .v5-tablebar, .v5-toolbar, .v5-outline, .v5-find',
      )
      .forEach((element) => element.remove())
    root.querySelectorAll('.v5-mermaid > code').forEach((element) => element.remove())
    root.querySelectorAll<HTMLButtonElement>('button.v5-check').forEach((check) => {
      const label = check.ownerDocument.createElement('span')
      label.textContent = check.dataset.checked === 'true' ? '✓' : '☐'
      check.replaceWith(label)
    })
    for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
      element.removeAttribute('contenteditable')
      element.removeAttribute('spellcheck')
      element.removeAttribute('tabindex')
      element.classList.remove('is-source', 'is-active', 'is-composing')
    }
  }

  private selectedText(): string | null {
    const from = Math.min(this.state.selection.anchor, this.state.selection.head)
    const to = Math.max(this.state.selection.anchor, this.state.selection.head)
    if (from === to) return null
    return this.state.doc.slice(from, to)
  }

  private onCompositionStart = () => {
    if (!this.editable) return
    this.composing = true
    this.hideSlash()
    this.compositionSelection = this.state.selection
    this.surface().classList.add('v5-composing')
  }

  private onCompositionEnd = (event: CompositionEvent) => {
    if (!this.editable) {
      this.composing = false
      return
    }
    this.composing = false
    this.surface().classList.remove('v5-composing')
    const text = event.data ?? ''
    const selection = this.compositionSelection ?? this.state.selection
    this.compositionSelection = null
    this.ignoreInsert = text
    queueMicrotask(() => {
      if (this.ignoreInsert === text) this.ignoreInsert = null
    })
    if (!text) {
      this.render()
      return
    }
    this.commit(insertText({ ...this.state, selection }, text))
  }

  private onInput = (event: Event) => {
    if (this.composing || this.rendering) return
    if (event instanceof InputEvent && event.isComposing) return
    this.render()
  }

  private onFocus = () => {
    this.focused = true
    if (!this.rendering) this.syncChrome()
  }

  private onBlur = () => {
    if (this.rendering || this.imageDrag) return
    this.focused = false
    this.hideSlash()
    this.hideBlockMenu()
    this.clearChrome()
  }

  private syncChrome(): void {
    if (!this.editable) {
      this.clearChrome()
      return
    }
    applyChrome(this.element, this.state.selection.head, this.state.selection.anchor, this.state.doc.length)
    this.syncTableBar()
    this.syncToolbarState()
    this.updateSlash()
    this.positionHandle()
  }

  private clearChrome(): void {
    this.element.querySelectorAll<HTMLElement>('.v5-active, .v5-source-visible').forEach((element) => {
      element.classList.remove('v5-active', 'v5-source-visible')
    })
    this.tableBar?.remove()
  }

  private syncTableBar(): void {
    const table = this.element.querySelector('table.v5-table.v5-active')
    if (this.sourceMode || !this.editable || !this.focused || !table) {
      this.tableBar?.remove()
      return
    }
    const bar = this.ensureTableBar()
    this.element.append(bar)
    const cell = this.element.querySelector<HTMLElement>('th.v5-active, td.v5-active')
    const align = cell?.style.textAlign
    markTableAlign(bar, align === 'center' || align === 'right' ? align : 'left')
    this.positionTableBar()
  }

  private ensureTableBar(): HTMLElement {
    if (this.tableBar) return this.tableBar
    this.tableBar = createTableBar((command: TableCommand) => {
      this.focused = true
      this.commit(editTable(this.state, command))
    })
    return this.tableBar
  }

  private positionTableBar(): void {
    const bar = this.tableBar
    const table = this.element.querySelector('table.v5-table.v5-active')
    if (!bar || !table || !bar.isConnected) return
    const editorRect = this.element.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const height = bar.offsetHeight || 36
    const above = tableRect.top - editorRect.top + this.element.scrollTop - height - 6
    const top = above >= 4 ? above : tableRect.top - editorRect.top + this.element.scrollTop + 4
    const left = Math.max(4, tableRect.left - editorRect.left + this.element.scrollLeft)
    bar.style.top = `${top}px`
    bar.style.left = `${left}px`
  }

  private onImagePointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element) || !this.editable || this.imageDrag) return
    const handle = target.closest('.v5-image-resize')
    if (!handle || !this.element.contains(handle)) return
    const img = handle.closest('.v5-image')?.querySelector('img')
    if (!(img instanceof HTMLImageElement)) return
    const rect = img.getBoundingClientRect()
    const width = Number(img.dataset.width || 0) || rect.width
    const height = Number(img.dataset.height || 0) || rect.height
    if (width < 1) return
    event.preventDefault()
    event.stopPropagation()
    try { handle.setPointerCapture?.(event.pointerId) } catch { /* the document listeners still follow the pointer */ }
    this.imageDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      width,
      height: height || width,
      keepHeight: img.dataset.height != null && img.dataset.height !== '',
      img,
    }
  }

  private onImagePointerMove = (event: PointerEvent) => {
    const drag = this.imageDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const nextWidth = resizedWidth(drag.width, event.clientX - drag.startX)
    drag.img.style.width = `${nextWidth}px`
    drag.img.style.maxWidth = '100%'
    drag.img.style.height = 'auto'
    if (drag.keepHeight) drag.img.style.aspectRatio = `${nextWidth} / ${resizedHeight(drag, nextWidth)}`
  }

  private onImagePointerUp = (event: PointerEvent) => {
    const drag = this.imageDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    this.imageDrag = null
    if (Math.round(event.clientX - drag.startX) === 0) return
    const nextWidth = resizedWidth(drag.width, event.clientX - drag.startX)
    const nextHeight = drag.keepHeight ? resizedHeight(drag, nextWidth) : undefined
    this.focused = true
    this.commit(resizeImage(this.state, nextWidth, nextHeight))
  }

  private onMouseDown = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element) || !this.element.contains(target)) return
    if (target.closest('.v5md-find')) return
    const lineNumber = target.closest<HTMLElement>('.v5-source-number')
    if (lineNumber) {
      event.preventDefault()
      const offset = Number(lineNumber.closest<HTMLElement>('.v5-source-line')?.dataset.start ?? 0)
      this.state = { ...this.state, selection: { anchor: offset, head: offset } }
      this.focused = true
      this.focusSurface()
      this.syncChrome()
      this.restoreSelection()
      return
    }
    if (target.closest('.v5-toolbar, .v5-outline, .v5-tablebar, .v5-slash-menu, .v5-block-handle, .v5-block-menu, .v5-image-resize')) {
      event.preventDefault()
      return
    }
    const check = target.closest<HTMLElement>('.v5-check')
    if (check) {
      event.preventDefault()
      // Toggling a task is the one edit preview mode allows.
      if (this.editable) {
        this.focused = true
        this.focusSurface()
      }
      this.commit(toggleTask(this.state, Number(check.dataset.start ?? 0)), true)
      return
    }
    const voidHost = target.closest<HTMLElement>('[data-void]')
    if (voidHost?.dataset.void === 'image') {
      event.preventDefault()
      const host = voidHost.closest<HTMLElement>('[data-start]')
      if (!host) return
      const start = Number(host.getAttribute('data-start') ?? 0)
      const end = Number(host.getAttribute('data-end') ?? start)
      this.state = { ...this.state, selection: imageAltRange(this.state.doc, start, end) }
      this.focused = true
      this.focusSurface()
      this.syncChrome()
      this.restoreSelection()
      return
    }
    if (voidHost?.dataset.void === 'math' || voidHost?.dataset.void === 'diagram') {
      event.preventDefault()
      const host = voidHost.closest<HTMLElement>('[data-start]')
      if (!host) return
      const offset = atomicCaret(host, voidHost.dataset.void)
      this.state = { ...this.state, selection: { anchor: offset, head: offset } }
      this.focused = true
      this.focusSurface()
      this.syncChrome()
      this.restoreSelection()
      return
    }
    if (!voidHost) return
    const host = voidHost.closest<HTMLElement>('[data-start]')
    if (!host) return
    event.preventDefault()
    const start = Number(host.getAttribute('data-start') ?? 0)
    const end = Number(host.getAttribute('data-end') ?? start)
    this.state = { ...this.state, selection: { anchor: start, head: end } }
    this.focused = true
    this.syncChrome()
    this.restoreSelection()
  }

  private onClick = (event: MouseEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest('a')) event.preventDefault()
  }

  private onSelectionChange = () => {
    if (this.rendering || this.composing || this.imageDrag) return
    const selection = document.getSelection()
    if (!selection?.anchorNode || !this.element.contains(selection.anchorNode)) return
    if (
      this.tableBar?.contains(selection.anchorNode) ||
      this.findBar?.contains(selection.anchorNode) ||
      this.toolbar?.contains(selection.anchorNode) ||
      this.outlinePanel?.element.contains(selection.anchorNode)
      || this.slashMenu?.contains(selection.anchorNode)
      || this.blockMenu?.contains(selection.anchorNode)
      || this.handle?.contains(selection.anchorNode)
    ) {
      return
    }
    const anchor = domPointToOffset(this.element, selection.anchorNode, selection.anchorOffset)
    const head = domPointToOffset(this.element, selection.focusNode, selection.focusOffset)
    if (anchor == null || head == null) return
    if (anchor !== this.state.selection.anchor || head !== this.state.selection.head) {
      this.state = { ...this.state, selection: { anchor, head } }
      this.handleSource = null
    }
    if (this.focused || document.activeElement === this.surface()) {
      this.focused = true
      this.syncChrome()
    }
  }

  private updateSlash(): void {
    if (!this.editable || this.composing || this.sourceMode || this.state.selection.anchor !== this.state.selection.head) {
      this.hideSlash()
      return
    }
    const to = this.state.selection.head
    const from = this.state.doc.lastIndexOf('\n', to - 1) + 1
    const text = this.state.doc.slice(from, to)
    const path = pathAt(parse(this.state.doc), Math.max(from, to - 1), this.state.doc.length)
    if (!/^\/[^\n]*$/.test(text) || path.some(node =>
      ['code', 'yaml', 'math', 'table', 'inlineCode'].includes(node.type))) {
      this.hideSlash()
      return
    }
    const query = text.slice(1).toLowerCase()
    const options = SLASH_COMMANDS.filter(([command, title]) =>
      command.toLowerCase().includes(query) || command.replace('heading', 'h').includes(query) || title.includes(query))
    if (options.length === 0) {
      this.hideSlash()
      return
    }
    this.slashRange = { from, to }
    this.slashIndex = 0
    if (!this.slashMenu) {
      this.slashMenu = document.createElement('div')
      this.slashMenu.className = 'v5-slash-menu'
      this.slashMenu.contentEditable = 'false'
      this.slashMenu.setAttribute('role', 'listbox')
    }
    this.slashMenu.replaceChildren(...options.map(([command, title], index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.command = command
      button.textContent = title
      button.className = index === 0 ? 'v5-selected' : ''
      button.addEventListener('click', () => this.executeSlash(command))
      return button
    }))
    this.element.append(this.slashMenu)
    const point = offsetToDomPoint(this.element, to)
    if (point) {
      const range = document.createRange()
      range.setStart(point.node, point.offset)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      const host = this.element.getBoundingClientRect()
      this.slashMenu.style.left = `${Math.max(0, rect.left - host.left)}px`
      this.slashMenu.style.top = `${Math.max(0, rect.bottom - host.top + 6)}px`
    }
  }

  private executeSlash(command: SlashCommand): void {
    const range = this.slashRange
    if (!range) return
    this.hideSlash()
    this.focused = true
    this.commit(applySlashCommand(this.state, range.from, range.to, command))
    this.focusSurface()
  }

  private hideSlash(): void {
    this.slashMenu?.remove()
    this.slashRange = null
  }

  private onHoverBlock = (event: MouseEvent) => {
    if (!this.editable || this.sourceMode || this.dragSource) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('.v5-block-handle, .v5-block-menu')) return
    const block = target.closest<HTMLElement>('[data-block]')
    if (!block || block.parentElement !== this.element.querySelector('.v5-doc') || block.dataset.block === 'yaml') return
    this.handleSource = Number(block.dataset.start)
    this.positionHandle()
  }

  private positionHandle(): void {
    if (!this.editable || this.sourceMode) {
      this.hideHandle()
      return
    }
    if (this.handleSource === null && this.focused) {
      const offset = this.state.selection.head
      const block = parse(this.state.doc).children.find(node =>
        node.end > node.start && node.type !== 'yaml' && node.start <= offset && offset <= node.end)
      this.handleSource = block?.start ?? null
    }
    if (this.handleSource === null) return
    const block = [...this.element.querySelectorAll<HTMLElement>('.v5-doc > [data-block]')]
      .find(node => Number(node.dataset.start) === this.handleSource && node.dataset.block !== 'yaml')
    if (!block) {
      this.hideHandle()
      return
    }
    if (!this.handle) {
      this.handle = document.createElement('button')
      this.handle.type = 'button'
      this.handle.className = 'v5-block-handle'
      this.handle.contentEditable = 'false'
      this.handle.draggable = true
      this.handle.setAttribute('aria-label', '块操作')
      this.handle.textContent = '⠿'
      this.handle.addEventListener('click', () => this.openBlockMenu())
    }
    this.element.append(this.handle)
    const rect = block.getBoundingClientRect()
    const host = this.element.getBoundingClientRect()
    this.handle.style.top = `${rect.top - host.top + this.element.scrollTop}px`
    this.handle.style.left = `${rect.left - host.left - 28}px`
  }

  private openBlockMenu(): void {
    if (this.handleSource === null) return
    const node = parse(this.state.doc).children.find(child => child.start === this.handleSource)
    if (!node) return
    this.hideBlockMenu()
    const menu = document.createElement('div')
    menu.className = 'v5-block-menu'
    menu.contentEditable = 'false'
    for (const [action, label] of [
      ['up', '上移'], ['down', '下移'], ['before', '上方插入'], ['after', '下方插入'],
      ['paragraph', '正文'], ['heading1', '标题 1'], ['heading2', '标题 2'], ['heading3', '标题 3'],
      ['bulletList', '无序列表'], ['orderedList', '有序列表'], ['taskList', '待办列表'],
      ['quote', '引用'], ['delete', '删除块'],
    ]) {
      if (['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList', 'taskList', 'quote'].includes(action)) {
        if (!['paragraph', 'heading', 'blockquote', 'list'].includes(node.type)) continue
        if (node.type === 'list' && (node.children.length !== 1 || this.state.doc.slice(node.start, node.end).includes('\n'))
          && !['bulletList', 'orderedList', 'taskList'].includes(action)) continue
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.blockAction = action
      button.textContent = label
      button.addEventListener('click', () => this.runBlockAction(action))
      menu.append(button)
    }
    this.blockMenu = menu
    this.element.append(menu)
    menu.style.top = `${parseFloat(this.handle?.style.top || '0') + 26}px`
    menu.style.left = `${parseFloat(this.handle?.style.left || '0')}px`
  }

  private runBlockAction(action: string): void {
    this.hideBlockMenu()
    const blocks = parse(this.state.doc).children.filter(node => node.end > node.start && node.type !== 'yaml')
    const index = blocks.findIndex(node => node.start === this.handleSource)
    if (index < 0) return
    const block = blocks[index]
    if (action === 'up' || action === 'down') {
      const target = blocks[index + (action === 'up' ? -1 : 1)]
      if (target) this.moveBlock(block.start, target.start, action === 'up' ? 'before' : 'after')
      return
    }
    if (action === 'delete') {
      const end = blocks[index + 1]?.start ?? this.state.doc.length
      this.commit(insertText({ ...this.state, selection: { anchor: block.start, head: end } }, ''))
    } else if (action === 'before' || action === 'after') {
      const offset = action === 'before' ? block.start : block.end
      this.commit(insertText({ ...this.state, selection: { anchor: offset, head: offset } }, '\n\n'))
    } else {
      this.commit(convertTopLevelBlock(this.state, block.start, action as BlockType))
    }
    this.hideHandle()
  }

  private hideBlockMenu(): void {
    this.blockMenu?.remove()
    this.blockMenu = null
  }

  private hideHandle(): void {
    this.handle?.remove()
    this.hideBlockMenu()
    this.handleSource = null
  }

  private onDragStart = (event: DragEvent) => {
    if (!this.editable) return
    if (event.target !== this.handle || this.handleSource === null) return
    this.dragSource = { start: this.handleSource, doc: this.state.doc }
    event.dataTransfer?.setData('text/plain', '')
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  private onDragOver = (event: DragEvent) => {
    if (!this.dragSource || this.state.doc !== this.dragSource.doc) return
    const target = event.target
    const block = target instanceof Element ? target.closest<HTMLElement>('[data-block]') : null
    if (!block || block.parentElement !== this.element.querySelector('.v5-doc')
      || block.dataset.block === 'yaml' || Number(block.dataset.start) === this.dragSource.start) return
    event.preventDefault()
    if (!this.dropLine) {
      this.dropLine = document.createElement('div')
      this.dropLine.className = 'v5-drop-line'
    }
    this.element.append(this.dropLine)
    const rect = block.getBoundingClientRect()
    const host = this.element.getBoundingClientRect()
    this.dropLine.style.top = `${(event.clientY >= (rect.top + rect.bottom) / 2 ? rect.bottom : rect.top) - host.top}px`
  }

  private onDrop = (event: DragEvent) => {
    if (!this.editable) {
      event.preventDefault()
      this.onDragEnd()
      return
    }
    const source = this.dragSource
    this.onDragEnd()
    if (!source || source.doc !== this.state.doc) return
    const target = event.target
    const block = target instanceof Element ? target.closest<HTMLElement>('[data-block]') : null
    if (!block || block.parentElement !== this.element.querySelector('.v5-doc') || block.dataset.block === 'yaml') return
    event.preventDefault()
    const rect = block.getBoundingClientRect()
    this.moveBlock(source.start, Number(block.dataset.start),
      event.clientY >= (rect.top + rect.bottom) / 2 ? 'after' : 'before')
  }

  private onDragEnd = () => {
    this.dragSource = null
    this.dropLine?.remove()
  }

  private ensureFindBar(): HTMLFormElement {
    if (this.findBar) return this.findBar
    const bar = document.createElement('form')
    bar.className = 'v5md-find'
    bar.contentEditable = 'false'
    bar.hidden = true
    const find = document.createElement('input')
    find.type = 'search'
    find.placeholder = '查找'
    find.setAttribute('aria-label', '查找')
    const replace = document.createElement('input')
    replace.type = 'text'
    replace.placeholder = '替换为'
    replace.setAttribute('aria-label', '替换为')
    const next = findButton('下一个', () => this.findNext())
    const one = findButton('替换', () => this.replaceNext())
    const all = findButton('全部替换', () => this.replaceAll())
    const close = findButton('关闭', () => {
      bar.hidden = true
      this.focusSurface()
    })
    bar.append(find, replace, next, one, all, close)
    bar.addEventListener('submit', (event) => {
      event.preventDefault()
      this.findNext()
    })
    bar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        bar.hidden = true
        this.focusSurface()
      }
    })
    this.findBar = bar
    this.attachFindBar()
    this.findQuery = find
    this.replaceQuery = replace
    return bar
  }

  private attachFindBar(): void {
    if (!this.findBar || this.findBar.hidden) return
    this.element.prepend(this.findBar)
  }

  private async paintDiagrams(): Promise<void> {
    const generation = ++this.paintGeneration
    const nodes = [...this.element.querySelectorAll<HTMLElement>('.v5-diagram')]
    if (nodes.length === 0) return
    const pending = nodes.filter((node) => !diagramCache.has(node.dataset.diagram ?? ''))
    if (pending.length === 0) {
      for (const node of nodes) node.innerHTML = diagramCache.get(node.dataset.diagram ?? '') ?? ''
      return
    }
    const mermaid = (await import('mermaid')).default
    if (generation !== this.paintGeneration) return
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', fontFamily: 'inherit' })
    for (const node of nodes) {
      if (generation !== this.paintGeneration || !this.element.contains(node)) return
      const source = node.dataset.diagram ?? ''
      const cached = diagramCache.get(source)
      if (cached) {
        node.innerHTML = cached
        continue
      }
      const id = `v5md-${Math.random().toString(36).slice(2)}`
      try {
        const result = await mermaid.render(id, source)
        diagramCache.set(source, result.svg)
        document.getElementById(id)?.remove()
        if (generation === this.paintGeneration && this.element.contains(node)) node.innerHTML = result.svg
      } catch {
        document.getElementById(id)?.remove()
        if (this.element.contains(node)) node.textContent = '图表无法显示'
      }
    }
  }
}

const diagramCache = new Map<string, string>()

const SLASH_COMMANDS: Array<[SlashCommand, string]> = [
  ['paragraph', '正文'], ['heading1', '标题 1'], ['heading2', '标题 2'], ['heading3', '标题 3'],
  ['bulletList', '无序列表'], ['orderedList', '有序列表'], ['taskList', '待办列表'],
  ['quote', '引用'], ['code', '代码块'], ['rule', '分割线'], ['image', '图片'],
]

function resizedWidth(start: number, delta: number): number {
  return Math.min(4096, Math.max(16, Math.round(start + delta)))
}

function resizedHeight(drag: { width: number; height: number }, nextWidth: number): number {
  return Math.min(4096, Math.max(16, Math.round(nextWidth * drag.height / drag.width)))
}

function imageAltRange(doc: string, start: number, end: number): { anchor: number; head: number } {
  const match = /^!\[([^\]]*)\]/.exec(doc.slice(start, end))
  if (!match) return { anchor: start, head: end }
  const from = start + 2
  return { anchor: from, head: from + match[1].length }
}

function atomicCaret(host: HTMLElement, kind: string): number {
  if (kind === 'diagram') {
    const code = host.querySelector('code [data-leaf]')
    if (code) return Number(code.getAttribute('data-start') ?? 0)
  }
  const source = host.querySelector('.v5-source')
  const start = Number(source?.getAttribute('data-start') ?? host.dataset.start ?? 0)
  const end = Number(source?.getAttribute('data-end') ?? host.dataset.end ?? start)
  const jump = host.dataset.block === 'math' ? 2 : 1
  if (end <= start) return start
  return Math.min(start + jump, end - 1)
}

function findButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', (event) => {
    event.preventDefault()
    action()
  })
  return button
}
