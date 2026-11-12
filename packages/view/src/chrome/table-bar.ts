import type { TableCommand } from '@v5md/core'
import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'

const circleMinus = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.2"/><path d="M5.4 8h5.2"/></svg>`

const removeTable = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3.1" y="3.1" width="9.8" height="9.8" rx="2"/><path d="M6.1 6.1 9.9 9.9M9.9 6.1 6.1 9.9"/></svg>`

type TableCommandDef = {
  command: TableCommand
  labelKey: keyof LocaleMessages['table']
  icon: string
  align?: string
  gapBefore?: boolean
}

const COMMANDS: TableCommandDef[] = [
  { command: 'insertRowAbove', labelKey: 'insertRowAbove', icon: arrow('M8 12.5V4.5M5.2 7.2 8 4.4l2.8 2.8') },
  { command: 'insertRowBelow', labelKey: 'insertRowBelow', icon: arrow('M8 3.5v8M5.2 8.8 8 11.6l2.8-2.8') },
  { command: 'deleteRow', labelKey: 'deleteRow', icon: arrow('M3.5 8h9') },
  {
    command: 'insertColumnLeft',
    labelKey: 'insertColumnLeft',
    icon: arrow('M12 3.2v9.6M8.2 8H3.2M5.4 5.6 3.2 8l2.2 2.4'),
    gapBefore: true,
  },
  {
    command: 'insertColumnRight',
    labelKey: 'insertColumnRight',
    icon: arrow('M4 3.2v9.6M7.8 8h5M10.6 5.6 12.8 8l-2.2 2.4'),
  },
  { command: 'deleteColumn', labelKey: 'deleteColumn', icon: circleMinus },
  {
    command: 'alignLeft',
    labelKey: 'alignLeft',
    icon: align('M3 4h10M3 8h6.5M3 12h10'),
    align: 'left',
    gapBefore: true,
  },
  {
    command: 'alignCenter',
    labelKey: 'alignCenter',
    icon: align('M3 4h10M4.8 8h6.4M3 12h10'),
    align: 'center',
  },
  {
    command: 'alignRight',
    labelKey: 'alignRight',
    icon: align('M3 4h10M6.5 8H13M3 12h10'),
    align: 'right',
  },
  { command: 'deleteTable', labelKey: 'deleteTable', icon: removeTable, gapBefore: true },
]

export function createTableBar(
  onCommand: (command: TableCommand) => void,
  messages: LocaleMessages = getMessages(DEFAULT_LOCALE),
): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'v5-tablebar'
  bar.contentEditable = 'false'
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', messages.table.aria)
  for (const item of COMMANDS) {
    if (item.gapBefore) bar.append(gap())
    const label = messages.table[item.labelKey]
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.command = item.command
    if (item.align) button.dataset.align = item.align
    button.setAttribute('aria-label', label)
    button.dataset.label = label
    button.innerHTML = item.icon
    bar.append(button)
  }
  bar.addEventListener('mousedown', (event) => event.preventDefault())
  bar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    const command = button?.dataset.command
    if (!command) return
    event.preventDefault()
    onCommand(command as TableCommand)
  })
  return bar
}

export function markTableAlign(bar: HTMLElement, align: string): void {
  bar.querySelectorAll<HTMLButtonElement>('[data-align]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.align === align))
  })
}

function gap(): HTMLElement {
  const divider = document.createElement('span')
  divider.className = 'v5-tablebar-gap'
  return divider
}

function arrow(path: string): string {
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"/></svg>`
}

function align(path: string): string {
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"/></svg>`
}

/** Places the bar above the table, or just below its top edge when the table starts at the top. */
export function positionTableBar(bar: HTMLElement, table: Element, host: HTMLElement): void {
  const hostRect = host.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  const height = bar.offsetHeight || 36
  const above = tableRect.top - hostRect.top + host.scrollTop - height - 6
  const top = above >= 4 ? above : tableRect.top - hostRect.top + host.scrollTop + 4
  const left = Math.max(4, tableRect.left - hostRect.left + host.scrollLeft)
  bar.style.top = `${top}px`
  bar.style.left = `${left}px`
}
