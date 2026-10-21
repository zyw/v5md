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

interface ToolbarItem {
  command: ToolbarCommand | 'image'
  label: string
  icon: string
  gapBefore?: boolean
}

const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${inner}</svg>`

const glyph = (text: string, className = 'v5-svg-text v5-svg-serif') =>
  svg(`<text class="${className}" x="12" y="16.2" text-anchor="middle">${text}</text>`)

const ITEMS: ToolbarItem[] = [
  {
    command: 'code',
    label: '插入代码块',
    icon: svg('<path d="M9 7.2 5.6 12 9 16.8M15 7.2 18.4 12 15 16.8M13.2 6.2 10.8 17.8"/>'),
  },
  {
    command: 'table',
    label: '插入表格',
    icon: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15"/>'),
  },
  {
    command: 'image',
    label: '插入图片文件',
    icon: svg('<rect x="3.5" y="5" width="17" height="14" rx="1.8"/><circle cx="8.2" cy="9.2" r="1.35" fill="currentColor" stroke="none"/><path d="m4 16.2 4.1-3.6 2.5 2.1 2.3-1.9L20 16.6"/>'),
  },
  {
    command: 'orderedList',
    label: '有序列表',
    icon: svg(
      '<text class="v5-svg-index" x="3.2" y="7.4">1</text><text class="v5-svg-index" x="3.2" y="13.2">2</text><text class="v5-svg-index" x="3.2" y="19">3</text><path d="M8.6 6.2h11.2M8.6 12h11.2M8.6 17.8h11.2"/>',
    ),
    gapBefore: true,
  },
  {
    command: 'bulletList',
    label: '无序列表',
    icon: svg(
      '<circle cx="4.6" cy="6.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="17.8" r="1.15" fill="currentColor" stroke="none"/><path d="M8.6 6.2h11.2M8.6 12h11.2M8.6 17.8h11.2"/>',
    ),
  },
  {
    command: 'taskList',
    label: '任务列表',
    icon: svg('<rect x="3.4" y="4.6" width="6.2" height="6.2" rx="1.3"/><path d="m4.7 7.7 1.35 1.35 2.15-2.3"/><path d="M12.2 7.7h8.2"/><rect x="3.4" y="13.2" width="6.2" height="6.2" rx="1.3"/><path d="M12.2 16.3h8.2"/>'),
  },
  {
    command: 'quote',
    label: '引用',
    icon: svg('<text class="v5-svg-quote" x="12" y="18" text-anchor="middle">”</text>'),
  },
  {
    command: 'heading1',
    label: '一级标题',
    icon: svg('<circle cx="12" cy="12" r="7.25"/><text class="v5-svg-num" x="12" y="12.8">1</text>'),
    gapBefore: true,
  },
  {
    command: 'heading2',
    label: '二级标题',
    icon: svg('<circle cx="12" cy="12" r="7.25"/><text class="v5-svg-num" x="12" y="12.8">2</text>'),
  },
  {
    command: 'heading3',
    label: '三级标题',
    icon: svg('<circle cx="12" cy="12" r="7.25"/><text class="v5-svg-num" x="12" y="12.8">3</text>'),
  },
  { command: 'rule', label: '分割线', icon: svg('<path d="M4 12h16"/>') },
  {
    command: 'link',
    label: '超链接',
    icon: svg('<path d="m9.2 14.8 5.6-5.6"/><path d="M10.4 7.6 11.7 6.3a3.1 3.1 0 0 1 4.4 4.4l-1.3 1.3"/><path d="M13.6 16.4 12.3 17.7a3.1 3.1 0 0 1-4.4-4.4l1.3-1.3"/>'),
  },
  { command: 'math', label: '公式块', icon: glyph('Σ') },
  {
    command: 'inlineMath',
    label: '内联公式',
    icon: svg('<text class="v5-svg-x" x="8.2" y="17">x</text><text class="v5-svg-sup" x="16.2" y="9.2">2</text>'),
    gapBefore: true,
  },
  { command: 'bold', label: '加粗', icon: glyph('B') },
  { command: 'italic', label: '斜体', icon: glyph('I', 'v5-svg-text v5-svg-serif v5-svg-italic') },
  {
    command: 'underline',
    label: '下划线',
    icon: svg('<text class="v5-svg-text v5-svg-serif" x="12" y="15.2" text-anchor="middle">U</text><path d="M7.2 18.4h9.6"/>'),
  },
  {
    command: 'inlineCode',
    label: '内联代码',
    icon: svg('<path d="M9.2 8.2 6.4 12l2.8 3.8M14.8 8.2 17.6 12l-2.8 3.8"/>'),
  },
  {
    command: 'strike',
    label: '删除线',
    icon: svg('<text class="v5-svg-text v5-svg-serif" x="12" y="16.4" text-anchor="middle">S</text><path d="M6.2 12h11.6"/>'),
  },
  {
    command: 'highlight',
    label: '高亮',
    icon: svg('<path d="M12 3.2a4.6 4.6 0 0 0-2.55 8.45c.45.35.75.9.75 1.5V14h3.6v-.85c0-.6.3-1.15.75-1.5A4.6 4.6 0 0 0 12 3.2Z"/><path d="M9.6 16.2h4.8M10.2 18.2h3.6"/>'),
  },
]

export function createToolbar(onCommand: (command: ToolbarCommand) => void, onImage: (file: File) => void): HTMLElement {
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
  const sizeGroup = (current: HTMLElement | null) => {
    if (current) current.style.setProperty('--v5-count', String(current.children.length))
  }
  for (const item of ITEMS) {
    if (!group || item.gapBefore) {
      sizeGroup(group)
      group = document.createElement('div')
      group.className = 'v5-toolbar-group'
      bar.append(group)
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.tabIndex = -1
    button.dataset.command = item.command
    button.setAttribute('aria-label', item.label)
    button.dataset.label = item.label
    button.innerHTML = item.icon
    if (item.command === 'image') button.addEventListener('click', () => input.click())
    group.append(button)
  }
  sizeGroup(group)
  bar.append(input)
  bar.addEventListener('mousedown', (event) => event.preventDefault())
  bar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    const command = button?.dataset.command
    if (!command || command === 'image') return
    onCommand(command as ToolbarCommand)
  })
  return bar
}
