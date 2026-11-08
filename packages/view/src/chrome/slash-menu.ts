import type { SlashCommand } from '@v5md/core'

const COMMANDS: ReadonlyArray<readonly [SlashCommand, string]> = [
  ['paragraph', '正文'],
  ['heading1', '标题 1'],
  ['heading2', '标题 2'],
  ['heading3', '标题 3'],
  ['bulletList', '无序列表'],
  ['orderedList', '有序列表'],
  ['taskList', '待办列表'],
  ['quote', '引用'],
  ['code', '代码块'],
  ['rule', '分割线'],
  ['image', '图片'],
]

/** Ranks the slash commands against what the user typed after the slash. */
export function matchSlashCommands(query: string): Array<readonly [SlashCommand, string]> {
  const needle = query.toLowerCase()
  return COMMANDS.filter(
    ([command, title]) =>
      command.toLowerCase().includes(needle) ||
      command.replace('heading', 'h').includes(needle) ||
      title.includes(needle),
  )
}

export interface SlashMenuOptions {
  onPick(command: SlashCommand): void
}

export interface SlashMenu {
  readonly element: HTMLElement
  isOpen(): boolean
  /** Renders the matching commands under the caret position. */
  show(
    host: HTMLElement,
    commands: ReadonlyArray<readonly [SlashCommand, string]>,
    caret: { node: Node; offset: number } | null,
  ): void
  /** Moves the keyboard selection by one entry, wrapping around. */
  move(delta: number): void
  selected(): SlashCommand | null
  hide(): void
}

export function createSlashMenu(options: SlashMenuOptions): SlashMenu {
  const element = document.createElement('div')
  element.className = 'v5-slash-menu'
  element.contentEditable = 'false'
  element.setAttribute('role', 'listbox')
  let index = 0
  let commands: SlashCommand[] = []

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
      commands = matches.map(([command]) => command)
      element.replaceChildren(
        ...matches.map(([command, title], position) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.dataset.command = command
          button.textContent = title
          button.className = position === 0 ? 'v5-selected' : ''
          button.addEventListener('click', () => options.onPick(command))
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
