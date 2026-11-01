import {
  applySlashCommand,
  convertTopLevelBlock,
  createState,
  deleteBackward,
  deleteForward,
  findMatch,
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
  replaceAllText,
  sortedRange,
  splitBlock,
  toggleMark,
  toggleTask,
  toggleUnderline,
  undo,
  type EditorState,
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
import { createToolbar, type ToolbarCommand } from './toolbar.js'
import { renderDocument } from './render.js'
import { applyChrome, domPointToOffset, offsetToDomPoint } from './selection.js'

export interface EditorOptions {
  element: HTMLElement
  value?: string
  placeholder?: string
  toolbar?: boolean
  outline?: boolean
  onChange?: (markdown: string) => void
  onUploadImage?: (file: File) => string | Promise<string>
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
  private paintGeneration = 0
  private findBar: HTMLFormElement | null = null
  private tableBar: HTMLElement | null = null
  private toolbar: HTMLElement | null = null
  private outlinePanel: OutlinePanel | null = null
  private toolbarVisible = true
  private outlineVisible = true
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

  constructor(options: EditorOptions) {
    this.options = options
    this.element = options.element
    this.toolbarVisible = options.toolbar !== false
    this.outlineVisible = options.outline !== false
    this.state = createState(options.value ?? '')
    this.prepare()
    this.mountChrome()
    this.render()
    this.listen()
  }

  getMarkdown(): string {
    return this.state.doc
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
    this.element.focus()
    this.restoreSelection()
  }

  focusAt(offset: number): void {
    const clamped = Math.max(0, Math.min(offset, this.state.doc.length))
    this.state = { ...this.state, selection: { anchor: clamped, head: clamped } }
    this.handleSource = null
    this.focused = true
    this.rendering = true
    this.element.focus()
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
    this.element.classList.toggle('is-source-mode', enabled)
    this.render()
  }

  toggleSourceMode(): void {
    this.setSourceMode(!this.sourceMode)
  }

  openFind(): void {
    const bar = this.ensureFindBar()
    bar.hidden = false
    this.attachFindBar()
    this.findQuery?.focus()
    this.findQuery?.select()
  }

  findNext(query = this.findQuery?.value ?? ''): boolean {
    if (!query) return false
    const { from, to } = sortedRange(this.state.selection)
    const selected = this.state.doc.slice(from, to)
    const start = selected === query ? to : from
    const match = findMatch(this.state.doc, query, start)
    if (!match) return false
    this.state = { ...this.state, selection: { anchor: match.from, head: match.to } }
    this.focused = true
    this.element.focus()
    this.render()
    return true
  }

  replaceNext(query = this.findQuery?.value ?? '', replacement = this.replaceQuery?.value ?? ''): void {
    if (!query) return
    const { from, to } = sortedRange(this.state.selection)
    if (this.state.doc.slice(from, to) !== query) {
      this.findNext(query)
      return
    }
    this.commit(insertText(this.state, replacement))
    this.findNext(query)
  }

  replaceAll(query = this.findQuery?.value ?? '', replacement = this.replaceQuery?.value ?? ''): void {
    this.commit(replaceAllText(this.state, query, replacement))
  }

  destroy(): void {
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
    this.element.focus()
    this.commit(formatBlock(this.state, command))
  }

  insertImageFile(file: File): void {
    this.focused = true
    void this.insertImage(file)
  }

  isToolbarVisible(): boolean {
    return this.toolbarVisible
  }

  setToolbarVisible(visible: boolean): void {
    this.toolbarVisible = visible
    if (this.toolbar) this.toolbar.hidden = !visible
  }

  isOutlineVisible(): boolean {
    return this.outlineVisible
  }

  setOutlineVisible(visible: boolean): void {
    this.outlineVisible = visible
    if (this.outlinePanel) this.outlinePanel.element.hidden = !visible
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
    this.element.contentEditable = 'true'
    this.element.spellcheck = false
    this.element.autocapitalize = 'off'
    this.element.setAttribute('role', 'textbox')
    this.element.setAttribute('aria-multiline', 'true')
    this.element.translate = false
  }

  private mountChrome(): void {
    this.toolbar = createToolbar(
      (command) => this.runToolbar(command),
      (file) => this.insertImageFile(file),
    )
    this.outlinePanel = createOutline((start) => this.focusAt(start))
    this.toolbar.hidden = !this.toolbarVisible
    this.outlinePanel.element.hidden = !this.outlineVisible
    const doc = document.createElement('div')
    doc.className = 'v5-doc'
    this.element.append(this.toolbar, this.outlinePanel.element, doc)
  }

  private runToolbar(command: ToolbarCommand): void {
    this.focused = true
    this.element.focus()
    switch (command) {
      case 'code':
      case 'table':
      case 'orderedList':
      case 'bulletList':
      case 'taskList':
      case 'quote':
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'rule':
      case 'link':
      case 'math':
      case 'inlineMath':
        this.format(command)
        return
      case 'bold':
        this.toggleBold()
        return
      case 'italic':
        this.toggleItalic()
        return
      case 'underline':
        this.toggleUnderline()
        return
      case 'inlineCode':
        this.toggleCode()
        return
      case 'strike':
        this.toggleStrikethrough()
        return
      case 'highlight':
        this.toggleHighlight()
        return
      default:
        return
    }
  }

  private syncToolbarState(): void {
    const bar = this.toolbar
    if (!bar) return
    const path = pathAt(parse(this.state.doc), this.state.selection.head, this.state.doc.length)
    const types = new Set(path.map((node) => node.type))
    const heading = [...path].reverse().find((node) => node.type === 'heading')
    const list = [...path].reverse().find((node) => node.type === 'list')
    const item = [...path].reverse().find((node) => node.type === 'listItem')
    const pressed = new Set<string>()
    if (types.has('strong')) pressed.add('bold')
    if (types.has('emphasis')) pressed.add('italic')
    if (types.has('underline')) pressed.add('underline')
    if (types.has('inlineCode')) pressed.add('inlineCode')
    if (types.has('strikethrough')) pressed.add('strike')
    if (types.has('highlight')) pressed.add('highlight')
    if (types.has('blockquote')) pressed.add('quote')
    if (heading?.depth === 1) pressed.add('heading1')
    if (heading?.depth === 2) pressed.add('heading2')
    if (heading?.depth === 3) pressed.add('heading3')
    if (list?.ordered) pressed.add('orderedList')
    if (list && !list.ordered && typeof item?.checked !== 'boolean') pressed.add('bulletList')
    if (typeof item?.checked === 'boolean') pressed.add('taskList')
    bar.querySelectorAll<HTMLButtonElement>('button[data-command]').forEach((button) => {
      const command = button.dataset.command ?? ''
      if (command === 'image') return
      button.setAttribute('aria-pressed', pressed.has(command) ? 'true' : 'false')
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
    this.element.addEventListener('focus', this.onFocus, { signal })
    this.element.addEventListener('blur', this.onBlur, { signal })
    document.addEventListener('selectionchange', this.onSelectionChange, { signal })
    this.element.addEventListener('scroll', () => this.positionTableBar(), { signal })
    document.addEventListener('scroll', () => this.positionTableBar(), { signal, capture: true })
  }

  private commit(next: EditorState): void {
    const changed = next.doc !== this.state.doc
    this.state = next
    this.render()
    if (changed) this.options.onChange?.(this.state.doc)
  }

  private render(): void {
    this.rendering = true
    try {
      this.prepare()
      const active = document.activeElement === this.element
      renderDocument(
        this.element,
        {
          doc: this.state.doc,
          head: this.state.selection.head,
          anchor: this.state.selection.anchor,
          placeholder: this.options.placeholder,
          sourceMode: this.sourceMode,
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
      if (active) this.element.focus()
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
      host?.closest<HTMLElement>('[data-block]')?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
    scroll()
    requestAnimationFrame(scroll)
  }

  private onBeforeInput = (event: InputEvent) => {
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
        options.forEach((option, index) => option.classList.toggle('is-selected', index === this.slashIndex))
        return
      }
      if (event.key === 'Enter' && options.length > 0) {
        event.preventDefault()
        this.executeSlash(options[this.slashIndex].dataset.command as SlashCommand)
        return
      }
    }
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
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
    if (mod && !event.altKey && !event.shiftKey && key === 'f') {
      event.preventDefault()
      this.openFind()
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
    const markdown = html && /<(p|h1|h2|h3|h4|li|blockquote|pre|ul|ol)\b/i.test(html) ? htmlToMarkdown(html) : text
    if (markdown) this.commit(insertText(this.state, markdown))
  }

  private async insertImage(file: File): Promise<void> {
    const upload = this.options.onUploadImage
    if (!upload) return
    const url = await upload(file)
    if (!url || this.abort.signal.aborted) return
    const alt = file.name.replace(/\.[^.]+$/, '')
    this.commit(insertText(this.state, `![${alt}](${url})`))
  }

  private onCopy = (event: ClipboardEvent) => {
    const slice = this.selectedText()
    if (slice == null) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', slice)
  }

  private onCut = (event: ClipboardEvent) => {
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

  private onCompositionStart = () => {
    this.composing = true
    this.hideSlash()
    this.compositionSelection = this.state.selection
  }

  private onCompositionEnd = (event: CompositionEvent) => {
    this.composing = false
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
    if (this.rendering) return
    this.focused = false
    this.hideSlash()
    this.blockMenu?.remove()
    this.clearChrome()
  }

  private syncChrome(): void {
    applyChrome(this.element, this.state.selection.head, this.state.selection.anchor, this.state.doc.length)
    this.syncTableBar()
    this.syncToolbarState()
    this.updateSlash()
    this.positionHandle()
  }

  private clearChrome(): void {
    this.element.querySelectorAll<HTMLElement>('.is-active, .is-source').forEach((element) => {
      element.classList.remove('is-active', 'is-source')
    })
    this.tableBar?.remove()
  }

  private syncTableBar(): void {
    const table = this.element.querySelector('table.v5-table.is-active')
    if (this.sourceMode || !this.focused || !table) {
      this.tableBar?.remove()
      return
    }
    const bar = this.ensureTableBar()
    this.element.append(bar)
    const cell = this.element.querySelector<HTMLElement>('th.is-active, td.is-active')
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
    const table = this.element.querySelector('table.v5-table.is-active')
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

  private onMouseDown = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element) || !this.element.contains(target)) return
    if (target.closest('.v5md-find')) return
    if (target.closest('.v5-toolbar, .v5-outline, .v5-tablebar, .v5-slash-menu, .v5-block-handle, .v5-block-menu')) {
      event.preventDefault()
      return
    }
    const check = target.closest<HTMLElement>('.v5-check')
    if (check) {
      event.preventDefault()
      this.focused = true
      this.element.focus()
      this.commit(toggleTask(this.state, Number(check.dataset.start ?? 0)))
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
      this.element.focus()
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
      this.element.focus()
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
    if (this.rendering || this.composing) return
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
    if (this.focused || document.activeElement === this.element) {
      this.focused = true
      this.syncChrome()
    }
  }

  private updateSlash(): void {
    if (this.composing || this.sourceMode || this.state.selection.anchor !== this.state.selection.head) {
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
      button.className = index === 0 ? 'is-selected' : ''
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
    this.element.focus()
  }

  private hideSlash(): void {
    this.slashMenu?.remove()
    this.slashRange = null
  }

  private onHoverBlock = (event: MouseEvent) => {
    if (this.sourceMode || this.dragSource) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('.v5-block-handle, .v5-block-menu')) return
    const block = target.closest<HTMLElement>('[data-block]')
    if (!block || block.parentElement !== this.element.querySelector('.v5-doc') || block.dataset.block === 'yaml') return
    this.handleSource = Number(block.dataset.start)
    this.positionHandle()
  }

  private positionHandle(): void {
    if (this.sourceMode) return
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
    this.blockMenu?.remove()
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
    this.blockMenu?.remove()
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

  private hideHandle(): void {
    this.handle?.remove()
    this.blockMenu?.remove()
    this.handleSource = null
  }

  private onDragStart = (event: DragEvent) => {
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
      this.element.focus()
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
        this.element.focus()
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
