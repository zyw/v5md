import type { FormatCommand } from '@v5md/core'

export type MarkKind = 'bold' | 'italic' | 'code' | 'strikethrough' | 'highlight' | 'underline'

export interface KeymapHost {
  isEditable(): boolean
  isSourceMode(): boolean
  requestFind(kind: 'find' | 'replace'): void
  undo(): void
  redo(): void
  format(command: FormatCommand): void
  toggleMark(mark: MarkKind): void
  toggleSourceMode(): void
  /** Inserts the two spaces source mode treats as an indent. */
  insertSourceIndent(): void
  tab(shift: boolean): void
  enter(shift: boolean): void
}

interface Shortcut {
  match(event: KeyboardEvent, host: KeymapHost): boolean
  /** Rows without this flag are ignored while the document is read only. */
  always?: boolean
  run(host: KeymapHost, event: KeyboardEvent): void
}

const isMod = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey
const keyOf = (event: KeyboardEvent): string => event.key.toLowerCase()

/**
 * Keyboard shortcuts in match order. The first match wins, so wider modifier
 * combinations must sit above the narrower ones they would otherwise shadow.
 */
const SHORTCUTS: readonly Shortcut[] = [
  {
    always: true,
    match: (event) =>
      isMod(event) && !event.altKey && !event.shiftKey && (keyOf(event) === 'f' || keyOf(event) === 'h'),
    run: (host, event) => host.requestFind(keyOf(event) === 'h' ? 'replace' : 'find'),
  },
  {
    match: (event) => isMod(event) && !event.altKey && keyOf(event) === 'z',
    run: (host, event) => (event.shiftKey ? host.redo() : host.undo()),
  },
  { match: (event) => isMod(event) && !event.altKey && keyOf(event) === 'y', run: (host) => host.redo() },
  { match: (event) => isMod(event) && !event.altKey && keyOf(event) === 'b', run: (host) => host.toggleMark('bold') },
  { match: (event) => isMod(event) && !event.altKey && keyOf(event) === 'i', run: (host) => host.toggleMark('italic') },
  {
    match: (event) => isMod(event) && !event.altKey && !event.shiftKey && event.key === '`',
    run: (host) => host.toggleMark('code'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 'x',
    run: (host) => host.toggleMark('strikethrough'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 'h',
    run: (host) => host.toggleMark('highlight'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 's',
    run: (host) => host.toggleSourceMode(),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 'k',
    run: (host) => host.format('code'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 't',
    run: (host) => host.format('table'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && event.code === 'BracketLeft',
    run: (host) => host.format('orderedList'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && event.code === 'BracketRight',
    run: (host) => host.format('bulletList'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 'o',
    run: (host) => host.format('taskList'),
  },
  {
    match: (event) => isMod(event) && event.shiftKey && !event.altKey && keyOf(event) === 'q',
    run: (host) => host.format('quote'),
  },
  {
    match: (event) => isMod(event) && !event.shiftKey && !event.altKey && event.key === '1',
    run: (host) => host.format('heading1'),
  },
  {
    match: (event) => isMod(event) && !event.shiftKey && !event.altKey && event.key === '2',
    run: (host) => host.format('heading2'),
  },
  {
    match: (event) => isMod(event) && !event.shiftKey && !event.altKey && event.key === '3',
    run: (host) => host.format('heading3'),
  },
  {
    match: (event) => isMod(event) && !event.shiftKey && !event.altKey && keyOf(event) === 'k',
    run: (host) => host.format('link'),
  },
  {
    match: (event) => isMod(event) && !event.shiftKey && !event.altKey && keyOf(event) === 'u',
    run: (host) => host.toggleMark('underline'),
  },
  {
    match: (event) => isMod(event) && !event.altKey && event.key === '~',
    run: (host) => host.toggleMark('strikethrough'),
  },
  {
    match: (event) => isMod(event) && !event.altKey && (event.key === '=' || event.key === '+'),
    run: (host) => host.toggleMark('highlight'),
  },
  { match: (event, host) => event.key === 'Tab' && host.isSourceMode(), run: (host) => host.insertSourceIndent() },
  { match: (event) => event.key === 'Tab', run: (host, event) => host.tab(event.shiftKey) },
  { match: (event) => event.key === 'Enter', run: (host, event) => host.enter(event.shiftKey) },
]

/**
 * Runs the shortcut bound to the event. Read only editors only accept the
 * shortcuts marked as always available, and unhandled keys keep their default.
 */
export function runShortcut(event: KeyboardEvent, host: KeymapHost): boolean {
  const shortcut = SHORTCUTS.find((entry) => entry.match(event, host))
  if (!shortcut) return false
  if (shortcut.always !== true && !host.isEditable()) return false
  event.preventDefault()
  shortcut.run(host, event)
  return true
}
