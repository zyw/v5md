import type { TableCommand } from '@v5md/core'

const circleMinus = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.2"/><path d="M5.4 8h5.2"/></svg>`

const removeTable = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3.1" y="3.1" width="9.8" height="9.8" rx="2"/><path d="M6.1 6.1 9.9 9.9M9.9 6.1 6.1 9.9"/></svg>`

const COMMANDS: { command: TableCommand; label: string; icon: string; align?: string; gapBefore?: boolean }[] = [
  { command: 'insertRowAbove', label: '上方插入行', icon: arrow('M8 12.5V4.5M5.2 7.2 8 4.4l2.8 2.8') },
  { command: 'insertRowBelow', label: '下方插入行', icon: arrow('M8 3.5v8M5.2 8.8 8 11.6l2.8-2.8') },
  { command: 'deleteRow', label: '删除行', icon: arrow('M3.5 8h9') },
  { command: 'insertColumnLeft', label: '左侧插入列', icon: arrow('M12 3.2v9.6M8.2 8H3.2M5.4 5.6 3.2 8l2.2 2.4'), gapBefore: true },
  { command: 'insertColumnRight', label: '右侧插入列', icon: arrow('M4 3.2v9.6M7.8 8h5M10.6 5.6 12.8 8l-2.2 2.4') },
  { command: 'deleteColumn', label: '删除列', icon: circleMinus },
  { command: 'alignLeft', label: '列左对齐', icon: align('M3 4h10M3 8h6.5M3 12h10'), align: 'left', gapBefore: true },
  { command: 'alignCenter', label: '列居中对齐', icon: align('M3 4h10M4.8 8h6.4M3 12h10'), align: 'center' },
  { command: 'alignRight', label: '列右对齐', icon: align('M3 4h10M6.5 8H13M3 12h10'), align: 'right' },
  { command: 'deleteTable', label: '删除整个表格', icon: removeTable, gapBefore: true },
]

export function createTableBar(onCommand: (command: TableCommand) => void): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'v5-tablebar'
  bar.contentEditable = 'false'
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', '表格')
  for (const item of COMMANDS) {
    if (item.gapBefore) bar.append(gap())
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.command = item.command
    if (item.align) button.dataset.align = item.align
    button.setAttribute('aria-label', item.label)
    button.dataset.label = item.label
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
