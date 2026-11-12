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
import { htmlToMarkdown } from '../convert/html-to-md.js'
import { createOutline, type OutlinePanel } from '../chrome/outline.js'
import { createTableBar, markTableAlign, positionTableBar } from '../chrome/table-bar.js'
import { BUILTIN_COMMAND_IDS, BUILTIN_COMMANDS, BUILTIN_TOOLBAR_IDS } from '../chrome/builtins.js'
import type { ToolbarCommand } from '../chrome/toolbar.js'
import { ToolbarHost } from '../chrome/toolbar-host.js'
import { createFindBar, type FindBar } from '../chrome/find-bar.js'
import { createSlashMenu, matchSlashCommands, type SlashMenu, type SlashMenuItem } from '../chrome/slash-menu.js'
import { BlockChrome, type TopBlock } from '../chrome/block-chrome.js'
import {
  DEFAULT_LOCALE,
  getMessages,
  resolveLocale,
  type LocaleCode,
  type LocaleMessages,
} from '../i18n/index.js'
import { BlockHost } from './blocks.js'
import { copySelectionAsRich } from './clipboard.js'
import { linkActivationHint, linkAnchor, openExternalLink } from './links.js'
import { ImageResize } from './images.js'
import { runShortcut, type KeymapHost } from './keymap.js'
import { PluginHost } from './plugins.js'
import {
  PluginRegistry,
  type V5mdCommandContext,
  type V5mdPlugin,
  type V5mdPluginHandle,
  type V5mdPluginState,
} from '../plugin.js'
import { renderDocument } from './render.js'
import { applyChrome, clearFindHighlight, domPointToOffset, offsetToDomPoint, paintFindHighlight } from './selection.js'
import { copyRichText, toWechatHtml, type WechatHtmlOptions } from '../convert/wechat.js'

export interface FindRequest {
  kind: 'find' | 'replace'
}

export interface EditorOptions {
  element: HTMLElement
  value?: string
  placeholder?: string
  /** UI language. Defaults to `zh-CN`. */
  locale?: LocaleCode | string
  toolbar?: boolean
  outline?: boolean
  /** Pin the toolbar to the top while scrolling. Defaults to false. */
  toolbarSticky?: boolean
  /** Pin the outline while scrolling. Defaults to true. */
  outlineSticky?: boolean
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
  private findBar: FindBar | null = null
  private tableBar: HTMLElement | null = null
  private readonly toolbarHost: ToolbarHost
  private outlinePanel: OutlinePanel | null = null
  private toolbarVisible = true
  private outlineVisible = true
  private toolbarSticky = false
  private outlineSticky = true
  private editable = true
  private slash: SlashMenu | null = null
  private slashRange: { from: number; to: number } | null = null
  private readonly blockChrome: BlockChrome
  private readonly imageResize: ImageResize
  private readonly pluginRegistry: PluginRegistry
  private readonly plugins: PluginHost
  private readonly blockHost = new BlockHost()
  private readonly keymap: KeymapHost
  private destroyed = false
  private locale: LocaleCode = DEFAULT_LOCALE
  private messages: LocaleMessages = getMessages(DEFAULT_LOCALE)

  constructor(options: EditorOptions) {
    this.options = options
    this.element = options.element
    this.locale = resolveLocale(options.locale)
    this.messages = getMessages(this.locale)
    if (options.placeholder === undefined) this.options.placeholder = this.messages.placeholder
    this.toolbarVisible = options.toolbar !== false
    this.outlineVisible = options.outline !== false
    this.toolbarSticky = options.toolbarSticky === true
    this.outlineSticky = options.outlineSticky !== false
    this.lineNumbers = options.lineNumbers !== false
    this.editable = options.editable !== false
    this.pluginRegistry = new PluginRegistry(BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS)
    this.plugins = new PluginHost(this.pluginRegistry, {
      context: () => this.createCommandContext(),
      changed: () => this.toolbarHost.refresh(),
      hasToolbar: () => this.toolbarHost.element.isConnected,
      onActivate: (plugin) => this.blockHost.registerPlugin(plugin),
      onDispose: (name) => {
        this.blockHost.unregisterPlugin(name)
        if (!this.destroyed) this.render()
      },
    })
    this.toolbarHost = new ToolbarHost({
      pluginItems: () => this.pluginRegistry.allToolbarItems(),
      onCommand: (command) => this.onToolbarCommand(command),
      onImage: (file) => this.insertImageFile(file),
      onPickImage: () => {
        const pick = this.options.onPickImage
        if (!pick) return false
        return pick() !== false
      },
      state: () => this.getPluginState(),
      messages: this.messages,
    })
    for (const plugin of options.plugins ?? []) this.pluginRegistry.install(plugin)
    this.state = createState(options.value ?? '')
    this.blockChrome = new BlockChrome({
      host: this.element,
      isEnabled: () => this.editable && !this.sourceMode,
      isFocused: () => this.focused,
      getDoc: () => this.state.doc,
      getCaret: () => this.state.selection.head,
      blocks: () => this.topBlocks(),
      onMove: (source, target, side) => this.moveBlock(source, target, side),
      onAction: (action) => this.runBlockAction(action),
      messages: this.messages,
    })
    this.imageResize = new ImageResize({
      host: this.element,
      isEnabled: () => this.editable,
      onResize: (width, height) => {
        this.focused = true
        this.commit(resizeImage(this.state, width, height))
      },
    })
    this.keymap = {
      isEditable: () => this.editable,
      isSourceMode: () => this.sourceMode,
      requestFind: (kind) => {
        if (this.options.onFindRequest) this.options.onFindRequest({ kind })
        else this.openFind()
      },
      undo: () => this.undo(),
      redo: () => this.redo(),
      format: (command) => this.format(command),
      toggleMark: (mark) => {
        if (mark === 'bold') this.toggleBold()
        else if (mark === 'italic') this.toggleItalic()
        else if (mark === 'code') this.toggleCode()
        else if (mark === 'strikethrough') this.toggleStrikethrough()
        else if (mark === 'highlight') this.toggleHighlight()
        else this.toggleUnderline()
      },
      toggleSourceMode: () => this.toggleSourceMode(),
      insertSourceIndent: () => this.commit(insertText(this.state, '  ')),
      tab: (shift) => {
        const moved = moveTableCaret(this.state, shift ? -1 : 1)
        if (moved) this.commit(moved)
        else this.commit(shift ? outdent(this.state) : indent(this.state))
      },
      enter: (shift) => {
        this.suppressBreak = true
        queueMicrotask(() => {
          this.suppressBreak = false
        })
        if (this.sourceMode) this.commit(insertText(this.state, '\n'))
        else this.commit(shift ? insertSoftBreak(this.state) : splitBlock(this.state))
      },
    }
    this.prepare()
    this.mountChrome()
    this.syncStickyChrome()
    for (const registration of this.pluginRegistry.list()) this.plugins.activate(registration)
    this.render()
    this.listen()
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
      findOpen: this.findBar?.isOpen() ?? false,
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
      const handle = this.plugins.handle<T>(plugin.name)
      if (handle) return handle
    }
    const registration = this.pluginRegistry.install(plugin)
    try {
      const handle = this.plugins.activate(registration)
      this.toolbarHost.refresh()
      this.render()
      return handle
    } catch (error) {
      this.pluginRegistry.remove(plugin.name)
      throw error
    }
  }

  getPlugin<T = undefined>(name: string): V5mdPluginHandle<T> | undefined {
    return this.plugins.handle<T>(name)
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
    this.blockChrome.hide()
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
    this.blockChrome.reset()
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
    if (!this.findBar) {
      this.findBar = createFindBar({
        onNext: () => this.findNext(),
        onPrevious: () => this.findPrevious(),
        onReplace: () => this.replaceNext(),
        onReplaceAll: () => this.replaceAll(),
        onOptionsChange: () => this.findNext(this.findBar?.query.value ?? '', false),
        onClose: () => {
          this.syncStickyChrome()
          this.focusSurface()
        },
        messages: this.messages,
      })
    }
    this.findBar.open(this.element)
    this.syncStickyChrome()
  }

  getLocale(): LocaleCode {
    return this.locale
  }

  /** Switches built-in chrome strings. Plugin labels keep whatever they registered with. */
  setLocale(locale: LocaleCode | string): void {
    const next = resolveLocale(locale)
    if (next === this.locale) return
    this.locale = next
    this.messages = getMessages(next)
    this.options.locale = next
    this.element.lang = next
    this.toolbarHost.setMessages(this.messages)
    this.findBar?.setMessages(this.messages)
    this.outlinePanel?.setMessages(this.messages)
    this.blockChrome.setMessages(this.messages)
    this.tableBar?.remove()
    this.tableBar = null
    if (this.options.placeholder === undefined || this.isDefaultPlaceholder(this.options.placeholder)) {
      this.options.placeholder = this.messages.placeholder
    }
    this.refreshLinkHints()
    this.render()
  }

  private isDefaultPlaceholder(value: string): boolean {
    return value === getMessages('zh-CN').placeholder || value === getMessages('en').placeholder
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

  findNext(query = this.findBar?.query.value ?? '', advance = true): boolean {
    // Keep focus in the find bar when it drove the search; revealFind restores outside focus.
    const result = this.findNextMatch(query, this.findBarOptions(), 1, advance)
    this.reportFindStatus(query, result)
    return result.hit !== null
  }

  findPrevious(query = this.findBar?.query.value ?? '', advance = true): boolean {
    const result = this.findNextMatch(query, this.findBarOptions(), -1, advance)
    this.reportFindStatus(query, result)
    return result.hit !== null
  }

  replaceNext(query = this.findBar?.query.value ?? '', replacement = this.findBar?.replacement.value ?? ''): void {
    const result = this.replaceNextMatch(query, replacement, this.findBarOptions())
    this.reportFindStatus(query, result)
  }

  replaceAll(query = this.findBar?.query.value ?? '', replacement = this.findBar?.replacement.value ?? ''): void {
    const result = this.replaceAllMatches(query, replacement, this.findBarOptions())
    this.reportFindStatus(query, result)
  }

  private findBarOptions(): FindOptions {
    return this.findBar?.getOptions() ?? {}
  }

  private reportFindStatus(query: string, result: FindQueryResult): void {
    if (!this.findBar) return
    if (!query) {
      this.findBar.setStatus('')
      return
    }
    if (result.error) {
      this.findBar.setStatus(result.error)
      return
    }
    if (!result.hit) {
      this.findBar.setStatus(this.messages.find.noResults)
      return
    }
    this.findBar.setStatus(`${result.hit.index}/${result.hit.total}`)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const registration of [...this.pluginRegistry.list()].reverse()) {
      this.plugins.dispose(registration.plugin.name, true)
    }
    this.blockHost.destroyAll()
    this.toolbarHost.destroy()
    this.abort.abort()
    this.hideSlash()
    this.blockChrome.destroy()
    this.findBar?.destroy()
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
    const label = alt.replace(/[[\]\r\n]/g, '').trim()
    this.commit(insertText(this.state, `![${label}](${target})`))
  }

  getWechatHtml(options?: WechatHtmlOptions): string {
    return toWechatHtml(this.state.doc, options)
  }

  async copyForWechat(): Promise<boolean> {
    const html = toWechatHtml(this.state.doc)
    const copied = await copyRichText(html, html)
    this.toolbarHost.flash(copied)
    return copied
  }

  isToolbarVisible(): boolean {
    return this.toolbarVisible
  }

  setToolbarVisible(visible: boolean): void {
    this.toolbarVisible = visible
    this.toolbarHost.setHidden(!visible)
  }

  isOutlineVisible(): boolean {
    return this.outlineVisible
  }

  setOutlineVisible(visible: boolean): void {
    this.outlineVisible = visible
    if (this.outlinePanel) this.outlinePanel.element.hidden = !visible
  }

  isToolbarSticky(): boolean {
    return this.toolbarSticky
  }

  setToolbarSticky(sticky: boolean): void {
    this.toolbarSticky = sticky
    this.syncStickyChrome()
  }

  isOutlineSticky(): boolean {
    return this.outlineSticky
  }

  setOutlineSticky(sticky: boolean): void {
    this.outlineSticky = sticky
    this.syncStickyChrome()
  }

  setEditable(enabled: boolean): void {
    if (this.editable === enabled) return
    this.editable = enabled
    if (!enabled) {
      this.hideSlash()
      this.blockChrome.hide()
      this.clearChrome()
    }
    this.element.classList.toggle('v5-preview', !enabled)
    this.syncSurface()
    this.refreshLinkHints()
  }

  private refreshLinkHints(): void {
    const next = linkActivationHint(!this.editable, undefined, undefined, this.messages)
    const previous = linkActivationHint(this.editable, undefined, undefined, this.messages)
    const suffix = ` — ${previous}`
    for (const anchor of this.element.querySelectorAll<HTMLAnchorElement>('a.v5-link[href]')) {
      if (anchor.title === previous) anchor.title = next
      else if (anchor.title.endsWith(suffix)) anchor.title = `${anchor.title.slice(0, -suffix.length)} — ${next}`
    }
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
    this.blockChrome.hide()
  }

  private prepare(): void {
    this.element.classList.add('v5md')
    this.element.lang = this.locale
    this.element.classList.toggle('v5-preview', !this.editable)
    // The shell is a row flexbox (toolbar, document, outline). A contenteditable
    // flex container turns IME composition into sibling flex items, so the
    // uncommitted text sits beside the placeholder. Edit the document itself.
    this.element.contentEditable = 'false'
    this.element.translate = false
    this.syncStickyChrome()
    this.syncSurface()
  }

  private syncStickyChrome(): void {
    this.element.classList.toggle('v5-toolbar-sticky', this.toolbarSticky)
    this.element.classList.toggle('v5-outline-sticky', this.outlineSticky)
    const findOpen = this.findBar?.isOpen() ?? false
    this.element.classList.toggle('v5-find-open', findOpen)
    const findHeight = findOpen && this.findBar ? this.findBar.element.offsetHeight || 46 : 0
    this.element.style.setProperty('--v5-sticky-find-height', `${findHeight}px`)
    const toolbar = this.toolbarHost.element
    if (this.toolbarSticky && toolbar.isConnected) {
      this.element.style.setProperty('--v5-sticky-toolbar-height', `${toolbar.offsetHeight || 43}px`)
    } else {
      this.element.style.removeProperty('--v5-sticky-toolbar-height')
    }
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
    this.outlinePanel = createOutline((start) => this.focusAt(start), this.messages)
    this.outlinePanel.element.hidden = !this.outlineVisible
    const doc = document.createElement('div')
    doc.className = 'v5-doc'
    this.element.append(this.toolbarHost.element, this.outlinePanel.element, doc)
    this.toolbarHost.mount(this.toolbarVisible)
  }

  private onToolbarCommand(command: string): void {
    if (command === 'image') return
    void this.runCommand(command).catch((error) => {
      console.error(`[v5md] command "${command}" failed`, error)
    })
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
    this.element.addEventListener('contextmenu', this.onContextMenu, { signal })
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
    const { from, to } = sortedRange(this.state.selection)
    paintFindHighlight(this.element, from, to)
  }

  private clearFindHit(): void {
    clearFindHighlight()
  }

  private render(): void {
    this.rendering = true
    try {
      this.prepare()
      const active = document.activeElement === this.surface()
      const chromeFocused = this.isChromeTarget(document.activeElement)
      renderDocument(
        this.element,
        {
          doc: this.state.doc,
          head: this.state.selection.head,
          anchor: this.state.selection.anchor,
          placeholder: this.options.placeholder,
          sourceMode: this.sourceMode,
          lineNumbers: this.lineNumbers,
          linkHint: linkActivationHint(!this.editable, undefined, undefined, this.messages),
          editable: this.editable,
          blocks: this.blockHost,
          messages: this.messages,
        },
        parse(this.state.doc),
      )
      this.blockHost.afterRender()
      this.findBar?.attach(this.element)
      this.syncStickyChrome()
      this.outlinePanel?.update(this.getOutline())
      this.toolbarHost.sync()
      this.updateSlash()
      this.blockChrome.position()
      if (this.focused || active) this.syncChrome()
      if (active) this.focusSurface()
      // Restoring the model selection into the surface steals focus from the find bar / toolbar.
      if (!chromeFocused) this.restoreSelection()
    } finally {
      this.rendering = false
    }
  }

  /** True when the event / focus lives in chrome mounted inside `.v5md` (find bar, toolbar, …). */
  private isChromeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false
    if (this.findBar?.element.contains(target)) return true
    if (this.toolbarHost.element.contains(target)) return true
    if (this.outlinePanel?.element.contains(target)) return true
    if (this.tableBar?.contains(target)) return true
    if (this.slash?.element.contains(target)) return true
    if (this.blockChrome.owns(target)) return true
    return false
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
    // Find bar / toolbar inputs sit inside `.v5md`; their beforeinput must not edit the doc.
    if (this.isChromeTarget(event.target)) return
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
    this.blockChrome.pointerDown(event)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.isChromeTarget(event.target)) return
    if (this.composing || event.isComposing) return
    if (this.handleSlashKeys(event)) return
    if (this.blockChrome.isMenuOpen() && event.key === 'Escape') {
      event.preventDefault()
      this.blockChrome.hideMenu()
      return
    }
    runShortcut(event, this.keymap)
  }

  /** While the slash menu is open, arrows, enter and escape drive it. */
  private handleSlashKeys(event: KeyboardEvent): boolean {
    if (!this.slash?.isOpen()) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      this.hideSlash()
      return true
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.slash.move(event.key === 'ArrowDown' ? 1 : -1)
      return true
    }
    if (event.key !== 'Enter') return false
    const command = this.slash.selected()
    if (!command) return false
    event.preventDefault()
    this.executeSlash(command)
    return true
  }

  private onPaste = (event: ClipboardEvent) => {
    if (this.isChromeTarget(event.target)) return
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
    if (this.isChromeTarget(event.target)) return
    if (!this.sourceMode) {
      copySelectionAsRich(this.element, event)
      return
    }
    const slice = this.selectedText()
    if (slice == null) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', slice)
  }

  private onCut = (event: ClipboardEvent) => {
    if (this.isChromeTarget(event.target)) return
    if (!this.editable) {
      this.onCopy(event)
      return
    }
    if (!this.sourceMode) {
      if (!copySelectionAsRich(this.element, event)) return
      this.commit(insertText(this.state, ''))
      return
    }
    const slice = this.selectedText()
    if (slice == null) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', slice)
    this.commit(insertText(this.state, ''))
  }

  private selectedText(): string | null {
    const from = Math.min(this.state.selection.anchor, this.state.selection.head)
    const to = Math.max(this.state.selection.anchor, this.state.selection.head)
    if (from === to) return null
    return this.state.doc.slice(from, to)
  }

  private onCompositionStart = (event: CompositionEvent) => {
    if (this.isChromeTarget(event.target)) return
    if (!this.editable) return
    this.composing = true
    this.hideSlash()
    this.compositionSelection = this.state.selection
    this.surface().classList.add('v5-composing')
  }

  private onCompositionEnd = (event: CompositionEvent) => {
    if (this.isChromeTarget(event.target)) return
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
    if (this.isChromeTarget(event.target)) return
    if (this.composing || this.rendering) return
    if (event instanceof InputEvent && event.isComposing) return
    this.render()
  }

  private onFocus = () => {
    this.focused = true
    if (!this.rendering) this.syncChrome()
  }

  private onBlur = () => {
    if (this.rendering || this.imageResize.active) return
    this.focused = false
    this.hideSlash()
    this.blockChrome.hideMenu()
    this.clearChrome()
  }

  private syncChrome(): void {
    if (!this.editable) {
      this.clearChrome()
      return
    }
    applyChrome(this.element, this.state.selection.head, this.state.selection.anchor, this.state.doc.length)
    this.syncTableBar()
    this.toolbarHost.sync()
    this.updateSlash()
    this.blockChrome.position()
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
    }, this.messages)
    return this.tableBar
  }

  private positionTableBar(): void {
    const bar = this.tableBar
    const table = this.element.querySelector('table.v5-table.v5-active')
    if (!bar || !table || !bar.isConnected) return
    positionTableBar(bar, table, this.element)
  }

  private onImagePointerDown = (event: PointerEvent) => {
    this.imageResize.pointerDown(event)
  }

  private onImagePointerMove = (event: PointerEvent) => {
    this.imageResize.pointerMove(event)
  }

  private onImagePointerUp = (event: PointerEvent) => {
    this.imageResize.pointerUp(event)
  }

  private onMouseDown = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element) || !this.element.contains(target)) return
    if (target.closest('.v5md-find')) return
    const link = linkAnchor(target)
    if (link && this.opensLink(event)) {
      event.preventDefault()
      return
    }
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
    if (
      target.closest(
        '.v5-toolbar, .v5-outline, .v5-tablebar, .v5-slash-menu, .v5-block-handle, .v5-block-menu, .v5-image-resize',
      )
    ) {
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
    if (
      voidHost?.dataset.void === 'math' ||
      voidHost?.dataset.void === 'diagram' ||
      voidHost?.dataset.void === 'widget'
    ) {
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

  private opensLink(event: MouseEvent): boolean {
    if (event.button !== 0 || event.altKey || event.shiftKey) return false
    return event.metaKey || event.ctrlKey
  }

  private onClick = (event: MouseEvent) => {
    const link = linkAnchor(event.target)
    if (!link || !this.element.contains(link)) return
    event.preventDefault()
    if (!this.opensLink(event)) return
    openExternalLink(link.getAttribute('href') ?? '')
  }

  private onContextMenu = (event: MouseEvent) => {
    const link = linkAnchor(event.target)
    if (!link || !this.element.contains(link)) return
    event.preventDefault()
    // A Ctrl+click also dispatches click. That click opens the link; opening here as well makes two tabs.
    if (event.ctrlKey || event.metaKey) return
    openExternalLink(link.getAttribute('href') ?? '')
  }

  private onSelectionChange = () => {
    if (this.rendering || this.composing || this.imageResize.active) return
    const selection = document.getSelection()
    if (!selection?.anchorNode || !this.element.contains(selection.anchorNode)) return
    if (this.isChromeTarget(selection.anchorNode)) return
    const anchor = domPointToOffset(this.element, selection.anchorNode, selection.anchorOffset)
    const head = domPointToOffset(this.element, selection.focusNode, selection.focusOffset)
    if (anchor == null || head == null) return
    if (anchor !== this.state.selection.anchor || head !== this.state.selection.head) {
      this.state = { ...this.state, selection: { anchor, head } }
      this.blockChrome.reset()
    }
    if (this.focused || document.activeElement === this.surface()) {
      this.focused = true
      this.syncChrome()
    }
  }

  private updateSlash(): void {
    if (
      !this.editable ||
      this.composing ||
      this.sourceMode ||
      this.state.selection.anchor !== this.state.selection.head
    ) {
      this.hideSlash()
      return
    }
    const to = this.state.selection.head
    const from = this.state.doc.lastIndexOf('\n', to - 1) + 1
    const text = this.state.doc.slice(from, to)
    const path = pathAt(parse(this.state.doc), Math.max(from, to - 1), this.state.doc.length)
    if (
      !/^\/[^\n]*$/.test(text) ||
      path.some((node) => ['code', 'yaml', 'math', 'table', 'inlineCode'].includes(node.type))
    ) {
      this.hideSlash()
      return
    }
    const options = matchSlashCommands(text.slice(1), this.pluginRegistry.allSlashItems(), this.messages)
    if (options.length === 0) {
      this.hideSlash()
      return
    }
    this.slashRange = { from, to }
    this.slash ??= createSlashMenu({ onPick: (item) => void this.executeSlash(item) })
    this.slash.show(this.element, options, offsetToDomPoint(this.element, to))
  }

  private async executeSlash(item: SlashMenuItem): Promise<void> {
    const range = this.slashRange
    if (!range) return
    this.hideSlash()
    this.focused = true
    if (item.source === 'builtin') {
      this.commit(applySlashCommand(this.state, range.from, range.to, item.command as SlashCommand))
    } else {
      this.commit(replaceRange(this.state, range.from, range.to, ''))
      await this.runCommand(item.command)
    }
    this.focusSurface()
  }

  private hideSlash(): void {
    this.slash?.hide()
    this.slashRange = null
  }

  private onHoverBlock = (event: MouseEvent) => {
    this.blockChrome.hover(event)
  }

  private runBlockAction(action: string): void {
    this.blockChrome.hideMenu()
    const blocks = this.topBlocks().filter((block) => block.end > block.start && block.type !== 'yaml')
    const index = blocks.findIndex((block) => block.start === this.blockChrome.currentSource())
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
    this.blockChrome.hide()
  }

  private topBlocks(): TopBlock[] {
    const doc = this.state.doc
    return parse(doc).children.map((node) => ({
      start: node.start,
      end: node.end,
      type: node.type,
      childCount: node.children.length,
      multiLine: doc.slice(node.start, node.end).includes('\n'),
    }))
  }

  private onDragStart = (event: DragEvent) => {
    this.blockChrome.dragStart(event)
  }

  private onDragOver = (event: DragEvent) => {
    this.blockChrome.dragOver(event)
  }

  private onDrop = (event: DragEvent) => {
    this.blockChrome.drop(event)
  }

  private onDragEnd = () => {
    this.blockChrome.dragEnd()
  }
}

function imageAltRange(doc: string, start: number, end: number): { anchor: number; head: number } {
  const match = /^!\[([^\]]*)\]/.exec(doc.slice(start, end))
  if (!match) return { anchor: start, head: end }
  const from = start + 2
  return { anchor: from, head: from + match[1].length }
}

function atomicCaret(host: HTMLElement, kind: string): number {
  if (kind === 'diagram' || kind === 'widget') {
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
