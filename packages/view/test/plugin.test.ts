import { describe, expect, it } from 'vitest'
import { Editor } from '../src/editor.ts'
import { PluginRegistry } from '../src/plugin.ts'
import { BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS } from '../src/toolbar.ts'

function registry() {
  return new PluginRegistry(BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS)
}

function editorWith(options: ConstructorParameters<typeof Editor>[0] = { element: document.createElement('div') }) {
  const element = options.element
  document.body.append(element)
  const editor = new Editor({ value: 'hello', ...options, element })
  return { element, editor }
}

describe('PluginRegistry', () => {
  it('rejects built-in command overrides and duplicate command ids', () => {
    const target = registry()
    expect(() =>
      target.install({ name: 'attack', commands: { bold: { run() {} } } }),
    ).toThrow(/built-in command "bold"/)

    target.install({ name: 'first', commands: { 'demo.action': { run() {} } } })
    expect(() =>
      target.install({ name: 'second', commands: { 'demo.action': { run() {} } } }),
    ).toThrow(/already owned/)
  })

  it('validates api version, dependencies and toolbar references', () => {
    const target = registry()
    expect(() => target.install({ name: 'old', apiVersion: 2 })).toThrow(/requires API version 2/)
    expect(() => target.install({ name: 'needs', requires: ['missing'] })).toThrow(/requires plugin "missing"/)
    expect(() =>
      target.install({ name: 'bad-toolbar', toolbar: [{ command: 'nope', label: 'x', icon: '<svg/>' }] }),
    ).toThrow(/unknown command "nope"/)
    expect(() =>
      target.install({ name: 'bad-id', toolbar: [{ id: 'image', command: 'bold', label: 'x', icon: '<svg/>' }] }),
    ).toThrow(/toolbar id "image" is already used/)
  })

  it('is idempotent for the same plugin instance', () => {
    const target = registry()
    const plugin = { name: 'same' }
    const first = target.install(plugin)
    expect(target.install(plugin)).toBe(first)
    expect(() => target.install({ name: 'same' })).toThrow(/different instance/)
  })

  it('releases command and toolbar ids when removed', () => {
    const target = registry()
    const plugin = {
      name: 'one',
      commands: { 'one.action': { run() {} } },
      toolbar: [{ id: 'one.action', command: 'one.action', label: 'One', icon: '<svg/>' }],
    }
    target.install(plugin)
    target.remove('one')
    expect(() =>
      target.install({
        name: 'two',
        commands: { 'one.action': { run() {} } },
        toolbar: [{ id: 'one.action', command: 'one.action', label: 'Two', icon: '<svg/>' }],
      }),
    ).not.toThrow()
  })
})

describe('Editor plugins', () => {
  it('exposes an API without adding a toolbar button', async () => {
    const plugin = {
      name: 'api-only',
      api: ({ editor }: { editor: Editor }) => ({ getMarkdown: () => editor.getMarkdown() }),
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    expect(element.querySelectorAll('.v5-toolbar button')).toHaveLength(21)
    expect(editor.getPlugin<{ getMarkdown(): string }>('api-only')?.api.getMarkdown()).toBe('hello')
    await expect(editor.runCommand('missing')).rejects.toThrow(/Unknown v5md command/)
    editor.destroy()
    element.remove()
  })

  it('runs plugin commands and returns their result', async () => {
    const plugin = {
      name: 'value',
      commands: {
        'value.upper': { run: ({ editor }: { editor: Editor }) => editor.getMarkdown().toUpperCase() },
      },
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    await expect(editor.runCommand<string>('value.upper')).resolves.toBe('HELLO')
    editor.destroy()
    element.remove()
  })

  it('renders plugin toolbar items and runs them on click', async () => {
    const plugin = {
      name: 'demo',
      commands: {
        'demo.insert': { run: ({ insertText }: { insertText(text: string): boolean }) => insertText('!') },
      },
      toolbar: [
        {
          id: 'demo.insert',
          command: 'demo.insert',
          label: '插入感叹号',
          icon: '<svg></svg>',
          group: 'inline',
          order: 25,
        },
      ],
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    const button = element.querySelector<HTMLButtonElement>('button[data-item-id="demo.insert"]')
    expect(button?.dataset.label).toBe('插入感叹号')
    expect(button?.getAttribute('aria-pressed')).toBeNull()
    editor.focusAt(0)
    button?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(editor.getMarkdown()).toBe('!hello')
    editor.destroy()
    element.remove()
  })

  it('orders plugin items inside built-in groups and cleans up on dispose', async () => {
    const plugin = {
      name: 'cleanup',
      commands: {
        'cleanup.action': { run: ({ insertText }: { insertText(text: string): boolean }) => insertText('x') },
      },
      toolbar: [
        {
          id: 'cleanup.action',
          command: 'cleanup.action',
          label: '清理测试',
          icon: '<svg></svg>',
          group: 'inline',
          order: 25,
        },
      ],
      setup: () => () => {},
    }
    const { element, editor } = editorWith({ element: document.createElement('div') })
    const handle = editor.use(plugin)
    await handle.ready
    const labels = [...element.querySelectorAll<HTMLButtonElement>('.v5-toolbar button')].map((button) => button.dataset.label)
    expect(labels.indexOf('清理测试')).toBeGreaterThan(labels.indexOf('加粗'))
    expect(labels.indexOf('清理测试')).toBeLessThan(labels.indexOf('斜体'))

    let cleaned = 0
    const withCleanup = {
      name: 'with-cleanup',
      setup: () => () => {
        cleaned += 1
      },
    }
    const cleanupHandle = editor.use(withCleanup)
    await cleanupHandle.ready
    cleanupHandle.dispose()
    expect(cleaned).toBe(1)
    expect(editor.getPlugin('with-cleanup')).toBeUndefined()
    handle.dispose()
    await expect(editor.runCommand('cleanup.action')).rejects.toThrow()
    expect(element.querySelector('button[data-item-id="cleanup.action"]')).toBeNull()
    editor.destroy()
    element.remove()
  })

  it('applies toggle state and disabled state from plugin definitions', () => {
    const plugin = {
      name: 'state',
      commands: { 'state.toggle': { run() {} } },
      toolbar: [
        {
          id: 'state.toggle',
          command: 'state.toggle',
          label: '状态',
          icon: '<svg></svg>',
          type: 'toggle' as const,
          isActive: () => true,
          isDisabled: () => true,
        },
      ],
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    const button = element.querySelector<HTMLButtonElement>('button[data-item-id="state.toggle"]')
    expect(button?.getAttribute('aria-pressed')).toBe('true')
    expect(button?.disabled).toBe(true)
    editor.destroy()
    element.remove()
  })

  it('runs built-in toolbar commands through the unified runCommand path', async () => {
    const { element, editor } = editorWith({ element: document.createElement('div') })
    editor.selectFindMatch(0, 5)
    await editor.runCommand('bold')
    expect(editor.getMarkdown()).toBe('**hello**')
    editor.destroy()
    element.remove()
  })

  it('wraps selected text through the command context', () => {
    const plugin = {
      name: 'wrap',
      commands: {
        'wrap.bold': { run: ({ editor }: { editor: Editor }) => editor.wrapSelection('**') },
      },
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    editor.selectFindMatch(0, 5)
    expect(editor.wrapSelection('**')).toBe(true)
    expect(editor.getMarkdown()).toBe('**hello**')
    editor.destroy()
    element.remove()
  })

  it('cleans up plugins when the editor is destroyed', () => {
    let destroyed = 0
    const plugin = {
      name: 'destroy',
      destroy: () => {
        destroyed += 1
      },
    }
    const { element, editor } = editorWith({ element: document.createElement('div'), plugins: [plugin] })
    editor.destroy()
    expect(destroyed).toBe(1)
    editor.destroy()
    expect(destroyed).toBe(1)
    element.remove()
  })
})
