import type { FormatCommand } from '@v5md/core'
import type { Editor } from '../editor/editor.js'
import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'
import type { ToolbarItemView, V5mdCommand, V5mdPluginState } from '../plugin.js'
import type { ToolbarCommand } from './toolbar.js'

const svg = (inner: string) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${inner}</svg>`

const hasType = (state: V5mdPluginState, type: string) => state.path.some((node) => node.type === type)
const lastType = (state: V5mdPluginState, type: string) => [...state.path].reverse().find((node) => node.type === type)
const headingDepth = (state: V5mdPluginState) => lastType(state, 'heading')?.depth
const activeList = (state: V5mdPluginState) => {
  const list = lastType(state, 'list')
  const item = lastType(state, 'listItem')
  return {
    ordered: list?.ordered === true,
    bullet: list != null && !list.ordered && typeof item?.checked !== 'boolean',
    task: typeof item?.checked === 'boolean',
  }
}

const format = (command: FormatCommand): V5mdCommand => ({
  run: ({ editor }) => editor.format(command),
})

const toggle = (run: (editor: Editor) => void): V5mdCommand => ({
  run: ({ editor }) => {
    editor.getContentElement().focus()
    run(editor)
  },
})

export const BUILTIN_COMMANDS: Record<ToolbarCommand, V5mdCommand> = {
  code: format('code'),
  table: format('table'),
  orderedList: format('orderedList'),
  bulletList: format('bulletList'),
  taskList: format('taskList'),
  quote: format('quote'),
  heading1: format('heading1'),
  heading2: format('heading2'),
  heading3: format('heading3'),
  rule: format('rule'),
  link: format('link'),
  math: format('math'),
  inlineMath: format('inlineMath'),
  bold: toggle((editor) => editor.toggleBold()),
  italic: toggle((editor) => editor.toggleItalic()),
  underline: toggle((editor) => editor.toggleUnderline()),
  inlineCode: toggle((editor) => editor.toggleCode()),
  strike: toggle((editor) => editor.toggleStrikethrough()),
  highlight: toggle((editor) => editor.toggleHighlight()),
  wechat: { run: ({ editor }) => editor.copyForWechat() },
}

export const BUILTIN_COMMAND_IDS: ReadonlySet<ToolbarCommand> = new Set<ToolbarCommand>(
  Object.keys(BUILTIN_COMMANDS) as ToolbarCommand[],
)

export const BUILTIN_TOOLBAR_IDS: ReadonlySet<string> = new Set<string>([...BUILTIN_COMMAND_IDS, 'image'])

export function createBuiltinToolbarItems(messages: LocaleMessages = getMessages(DEFAULT_LOCALE)): ToolbarItemView[] {
  return [
    {
      id: 'code',
      command: 'code',
      label: messages.toolbar.code,
      icon: svg('<path d="M8.5 7.5 4.8 12l3.7 4.5M15.5 7.5 19.2 12l-3.7 4.5"/><path d="m13.4 6.5-2.8 11"/>'),
      group: 'block',
      order: 10,
      type: 'action',
    },
    {
      id: 'table',
      command: 'table',
      label: messages.toolbar.table,
      icon: svg(
        '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.25h17M3.5 14h17M9.5 4.5v15M14.5 4.5v15"/>',
      ),
      group: 'block',
      order: 20,
      type: 'action',
    },
    {
      id: 'image',
      command: 'image',
      label: messages.toolbar.image,
      icon: svg(
        '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle class="v5-svg-fill" cx="8.4" cy="9.4" r="1.4"/><path d="m4.2 16.4 4.2-3.7 2.6 2.2 2.5-2.1 6.3 3.9"/>',
      ),
      group: 'block',
      order: 30,
      type: 'action',
    },
    {
      id: 'orderedList',
      command: 'orderedList',
      label: messages.toolbar.orderedList,
      icon: svg(
        '<path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5"/><path d="M4.2 5.4v4.2M4.2 5.4H6"/><path d="M3.8 14.8c.5-.9 1.4-1.4 2.4-1.4 1.1 0 2 .75 2 1.8 0 1.65-2.5 2.1-2.5 3.7H8.2"/>',
      ),
      group: 'list',
      order: 10,
      type: 'toggle',
      isActive: (state) => activeList(state).ordered,
    },
    {
      id: 'bulletList',
      command: 'bulletList',
      label: messages.toolbar.bulletList,
      icon: svg(
        '<circle class="v5-svg-fill" cx="5" cy="6.5" r="1.25"/><circle class="v5-svg-fill" cx="5" cy="12" r="1.25"/><circle class="v5-svg-fill" cx="5" cy="17.5" r="1.25"/><path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11"/>',
      ),
      group: 'list',
      order: 20,
      type: 'toggle',
      isActive: (state) => activeList(state).bullet,
    },
    {
      id: 'taskList',
      command: 'taskList',
      label: messages.toolbar.taskList,
      icon: svg(
        '<rect x="3.5" y="4.5" width="5.8" height="5.8" rx="1.4"/><path d="m4.7 7.4 1.35 1.35 2.2-2.35"/><path d="M12 7.4h8.5"/><rect x="3.5" y="13.7" width="5.8" height="5.8" rx="1.4"/><path d="M12 16.6h8.5"/>',
      ),
      group: 'list',
      order: 30,
      type: 'toggle',
      isActive: (state) => activeList(state).task,
    },
    {
      id: 'quote',
      command: 'quote',
      label: messages.toolbar.quote,
      icon: svg('<path d="M9 6.5v11"/><path d="M13 8.5h6.5M13 12h5M13 15.5h6.5"/>'),
      group: 'quote',
      order: 10,
      type: 'toggle',
      isActive: (state) => hasType(state, 'blockquote'),
    },
    {
      id: 'heading1',
      command: 'heading1',
      label: messages.toolbar.heading1,
      icon: svg(
        '<path d="M4.5 6.2v11.6M11.2 6.2v11.6M4.5 12h6.7"/><path d="M16.2 10.2v7.6M15.1 11.4c.55-.75 1.25-1.2 2.15-1.2"/>',
      ),
      group: 'heading',
      order: 10,
      type: 'toggle',
      isActive: (state) => headingDepth(state) === 1,
    },
    {
      id: 'heading2',
      command: 'heading2',
      label: messages.toolbar.heading2,
      icon: svg(
        '<path d="M4.2 6.2v11.6M10.6 6.2v11.6M4.2 12h6.4"/><path d="M14.2 10.5c.35-.85 1.15-1.4 2.2-1.4 1.25 0 2.2.85 2.2 2 0 2.35-4.4 2.55-4.4 5.1H19"/>',
      ),
      group: 'heading',
      order: 20,
      type: 'toggle',
      isActive: (state) => headingDepth(state) === 2,
    },
    {
      id: 'heading3',
      command: 'heading3',
      label: messages.toolbar.heading3,
      icon: svg(
        '<path d="M4.2 6.2v11.6M10.6 6.2v11.6M4.2 12h6.4"/><path d="M14.3 10.4c.4-.75 1.15-1.25 2.15-1.25 1.2 0 2.15.8 2.15 1.95 0 .95-.7 1.65-1.7 1.85 1.2.2 2 1 2 2.15 0 1.3-1.05 2.2-2.45 2.2-1.1 0-1.95-.55-2.4-1.35"/>',
      ),
      group: 'heading',
      order: 30,
      type: 'toggle',
      isActive: (state) => headingDepth(state) === 3,
    },
    {
      id: 'rule',
      command: 'rule',
      label: messages.toolbar.rule,
      icon: svg('<path d="M5 12h14"/><path d="M4 10v4M20 10v4"/>'),
      group: 'insert',
      order: 10,
      type: 'action',
    },
    {
      id: 'link',
      command: 'link',
      label: messages.toolbar.link,
      icon: svg(
        '<path d="M9.4 14.6 14.6 9.4"/><path d="M10.2 7.5 11.4 6.3a3.2 3.2 0 0 1 4.5 4.5l-1.2 1.2"/><path d="M13.8 16.5 12.6 17.7a3.2 3.2 0 0 1-4.5-4.5l1.2-1.2"/>',
      ),
      group: 'insert',
      order: 20,
      type: 'action',
    },
    {
      id: 'math',
      command: 'math',
      label: messages.toolbar.math,
      icon: svg('<path d="M5.5 6.5h13L12 12l6.5 5.5h-13"/>'),
      group: 'insert',
      order: 30,
      type: 'action',
    },
    {
      id: 'inlineMath',
      command: 'inlineMath',
      label: messages.toolbar.inlineMath,
      icon: svg(
        '<path d="M5.5 17.2 9.4 6.8h1.4l3.9 10.4"/><path d="M7 13h5.8"/><path d="M16.2 8.6c0-1.15.85-2 2-2s2 .85 2 2c0 .75-.35 1.3-1 1.8l-2.6 2.5H20"/>',
      ),
      group: 'inline',
      order: 10,
      type: 'action',
    },
    {
      id: 'bold',
      command: 'bold',
      label: messages.toolbar.bold,
      icon: svg('<path d="M7 5.5h5.2a3.35 3.35 0 0 1 0 6.7H7z"/><path d="M7 12.2h5.9a3.55 3.55 0 0 1 0 7.1H7z"/>'),
      group: 'inline',
      order: 20,
      type: 'toggle',
      isActive: (state) => hasType(state, 'strong'),
    },
    {
      id: 'italic',
      command: 'italic',
      label: messages.toolbar.italic,
      icon: svg('<path d="M11.2 5.5h7.1M5.7 18.5h7.1M13.6 5.5 10.4 18.5"/>'),
      group: 'inline',
      order: 30,
      type: 'toggle',
      isActive: (state) => hasType(state, 'emphasis'),
    },
    {
      id: 'underline',
      command: 'underline',
      label: messages.toolbar.underline,
      icon: svg('<path d="M7 5.5v7.2c0 2.55 1.95 4.35 5 4.35s5-1.8 5-4.35V5.5"/><path d="M6.2 19.2h11.6"/>'),
      group: 'inline',
      order: 40,
      type: 'toggle',
      isActive: (state) => hasType(state, 'underline'),
    },
    {
      id: 'inlineCode',
      command: 'inlineCode',
      label: messages.toolbar.inlineCode,
      icon: svg('<path d="M9 8.2 5.8 12 9 15.8M15 8.2 18.2 12 15 15.8"/>'),
      group: 'inline',
      order: 50,
      type: 'toggle',
      isActive: (state) => hasType(state, 'inlineCode'),
    },
    {
      id: 'strike',
      command: 'strike',
      label: messages.toolbar.strike,
      icon: svg(
        '<path d="M6.5 12h11"/><path d="M15.8 8.4c-.55-1.55-1.85-2.4-3.8-2.4-2.35 0-3.85 1.3-3.85 3.15 0 3.7 7.7 1.9 7.7 5.6 0 1.95-1.65 3.3-4.05 3.3-2.15 0-3.65-1-4.2-2.55"/>',
      ),
      group: 'inline',
      order: 60,
      type: 'toggle',
      isActive: (state) => hasType(state, 'strikethrough'),
    },
    {
      id: 'highlight',
      command: 'highlight',
      label: messages.toolbar.highlight,
      icon: svg(
        '<path d="m10.2 15.4 7.4-7.4a2.05 2.05 0 0 0-2.9-2.9l-7.4 7.4-1.55 4.45Z"/><path d="M4.8 19.2h7.4"/><path d="m12.4 7.2 4.4 4.4"/>',
      ),
      group: 'inline',
      order: 70,
      type: 'toggle',
      isActive: (state) => hasType(state, 'highlight'),
    },
    {
      id: 'wechat',
      command: 'wechat',
      label: messages.toolbar.wechat,
      icon: svg(
        '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15 8.5V6.7A2.2 2.2 0 0 0 12.8 4.5H6.7A2.2 2.2 0 0 0 4.5 6.7v6.1A2.2 2.2 0 0 0 6.7 15H8.5"/>',
      ),
      group: 'action',
      order: 10,
      type: 'action',
    },
  ]
}

/** @deprecated Prefer createBuiltinToolbarItems(messages). zh-CN snapshot for tests and standalone createToolbar(). */
export const BUILTIN_TOOLBAR_ITEMS: readonly ToolbarItemView[] = createBuiltinToolbarItems()
