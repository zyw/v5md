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

export function createToolbarFromItems(
  items: readonly ToolbarItemView[],
  onCommand: (command: string) => void,
  onImage: (file: File) => void,
  onPickImage?: () => boolean,
): HTMLElement {
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
    if (file) onImage(file)
  })
  let group: HTMLElement | null = null
  let groupName: string | null = null
  const sizeGroup = (current: HTMLElement | null) => {
    if (current) current.style.setProperty('--v5-count', String(current.children.length))
  }
  for (const item of items) {
    if (!group || item.group !== groupName) {
      sizeGroup(group)
      group = document.createElement('div')
      group.className = 'v5-toolbar-group'
      bar.append(group)
      groupName = item.group
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.tabIndex = -1
    button.dataset.itemId = item.id
    button.dataset.command = item.command
    button.setAttribute('aria-label', item.label)
    button.dataset.label = item.label
    if (item.type === 'toggle') button.setAttribute('aria-pressed', 'false')
    button.innerHTML = item.icon
    if (item.command === 'image') {
      button.addEventListener('click', () => {
        if (onPickImage?.()) return
        input.click()
      })
    }
    group.append(button)
  }
  sizeGroup(group)
  bar.append(input)
  bar.addEventListener('mousedown', (event) => event.preventDefault())
  bar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    const command = button?.dataset.command
    if (!command || command === 'image') return
    onCommand(command)
  })
  return bar
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
