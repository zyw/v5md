import type { SlashCommand } from '@v5md/core'
import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'
import type { SlashItemView } from '../plugin.js'

export interface SlashMenuItem {
  id: string
  title: string
  command: string
  source: 'builtin' | 'plugin'
  keywords?: readonly string[]
}

export function createBuiltinSlashItems(messages: LocaleMessages = getMessages(DEFAULT_LOCALE)): SlashMenuItem[] {
  return [
    { id: 'paragraph', title: messages.slash.paragraph, command: 'paragraph', source: 'builtin' },
    { id: 'heading1', title: messages.slash.heading1, command: 'heading1', source: 'builtin' },
    { id: 'heading2', title: messages.slash.heading2, command: 'heading2', source: 'builtin' },
    { id: 'heading3', title: messages.slash.heading3, command: 'heading3', source: 'builtin' },
    { id: 'bulletList', title: messages.slash.bulletList, command: 'bulletList', source: 'builtin' },
    { id: 'orderedList', title: messages.slash.orderedList, command: 'orderedList', source: 'builtin' },
    { id: 'taskList', title: messages.slash.taskList, command: 'taskList', source: 'builtin' },
    { id: 'quote', title: messages.slash.quote, command: 'quote', source: 'builtin' },
    { id: 'code', title: messages.slash.code, command: 'code', source: 'builtin' },
    { id: 'rule', title: messages.slash.rule, command: 'rule', source: 'builtin' },
    { id: 'image', title: messages.slash.image, command: 'image', source: 'builtin' },
  ]
}

function matchesQuery(item: SlashMenuItem, needle: string): boolean {
  if (!needle) return true
  const haystack = [item.id, item.command, item.title, ...(item.keywords ?? [])]
  return haystack.some((part) => {
    const value = part.toLowerCase()
    return value.includes(needle) || value.replace('heading', 'h').includes(needle)
  })
}

/** Ranks built-in and plugin slash commands against what the user typed after `/`. */
export function matchSlashCommands(
  query: string,
  pluginItems: readonly SlashItemView[] = [],
  messages: LocaleMessages = getMessages(DEFAULT_LOCALE),
): SlashMenuItem[] {
  const needle = query.toLowerCase()
  const plugin: SlashMenuItem[] = pluginItems.map((item) => ({
    id: item.id,
    title: item.title,
    command: item.command,
    source: 'plugin' as const,
    keywords: item.keywords,
  }))
  return [...createBuiltinSlashItems(messages), ...plugin].filter((item) => matchesQuery(item, needle))
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
