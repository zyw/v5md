import type { SlashCommand } from '@v5md/core'
import type { SlashItemView } from '../plugin.js'

export interface SlashMenuItem {
  id: string
  title: string
  command: string
  source: 'builtin' | 'plugin'
  keywords?: readonly string[]
}

const BUILTIN: readonly SlashMenuItem[] = [
  { id: 'paragraph', title: '正文', command: 'paragraph', source: 'builtin' },
  { id: 'heading1', title: '标题 1', command: 'heading1', source: 'builtin' },
  { id: 'heading2', title: '标题 2', command: 'heading2', source: 'builtin' },
  { id: 'heading3', title: '标题 3', command: 'heading3', source: 'builtin' },
  { id: 'bulletList', title: '无序列表', command: 'bulletList', source: 'builtin' },
  { id: 'orderedList', title: '有序列表', command: 'orderedList', source: 'builtin' },
  { id: 'taskList', title: '待办列表', command: 'taskList', source: 'builtin' },
  { id: 'quote', title: '引用', command: 'quote', source: 'builtin' },
  { id: 'code', title: '代码块', command: 'code', source: 'builtin' },
  { id: 'rule', title: '分割线', command: 'rule', source: 'builtin' },
  { id: 'image', title: '图片', command: 'image', source: 'builtin' },
]

function matchesQuery(item: SlashMenuItem, needle: string): boolean {
  if (!needle) return true
  const haystack = [item.id, item.command, item.title, ...(item.keywords ?? [])]
  return haystack.some((part) => {
    const value = part.toLowerCase()
    return value.includes(needle) || value.replace('heading', 'h').includes(needle)
  })
}

/** Ranks built-in and plugin slash commands against what the user typed after `/`. */
export function matchSlashCommands(query: string, pluginItems: readonly SlashItemView[] = []): SlashMenuItem[] {
  const needle = query.toLowerCase()
  const plugin: SlashMenuItem[] = pluginItems.map((item) => ({
    id: item.id,
    title: item.title,
    command: item.command,
    source: 'plugin' as const,
    keywords: item.keywords,
  }))
  return [...BUILTIN, ...plugin].filter((item) => matchesQuery(item, needle))
}

export interface SlashMenuOptions {
  onPick(item: SlashMenuItem): void
}

export interface SlashMenu {
  readonly element: HTMLElement
  isOpen(): boolean
  /** Renders the matching commands under the caret position. */
  show(host: HTMLElement, commands: readonly SlashMenuItem[], caret: { node: Node; offset: number } | null): void
  /** Moves the keyboard selection by one entry, wrapping around. */
  move(delta: number): void
  selected(): SlashMenuItem | null
  hide(): void
}

export function createSlashMenu(options: SlashMenuOptions): SlashMenu {
  const element = document.createElement('div')
  element.className = 'v5-slash-menu'
  element.contentEditable = 'false'
  element.setAttribute('role', 'listbox')
  let index = 0
  let commands: SlashMenuItem[] = []

  const paintSelection = (): void => {
    element.querySelectorAll<HTMLButtonElement>('button').forEach((option, position) => {
      option.classList.toggle('v5-selected', position === index)
    })
  }

  return {
    element,
    isOpen: () => element.isConnected,
    show(host, matches, caret) {
      index = 0
      commands = [...matches]
      element.replaceChildren(
        ...matches.map((item, position) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.dataset.command = item.command
          button.dataset.slashId = item.id
          button.dataset.source = item.source
          button.textContent = item.title
          button.className = position === 0 ? 'v5-selected' : ''
          button.addEventListener('click', () => options.onPick(item))
          return button
        }),
      )
      host.append(element)
      if (!caret) return
      const range = document.createRange()
      range.setStart(caret.node, caret.offset)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      const hostRect = host.getBoundingClientRect()
      element.style.left = `${Math.max(0, rect.left - hostRect.left)}px`
      element.style.top = `${Math.max(0, rect.bottom - hostRect.top + 6)}px`
    },
    move(delta) {
      if (commands.length === 0) return
      index = (index + delta + commands.length) % commands.length
      paintSelection()
    },
    selected: () => commands[index] ?? null,
    hide() {
      element.remove()
    },
  }
}

/** @deprecated Prefer SlashMenuItem; kept for typed built-in picks. */
export type { SlashCommand }
