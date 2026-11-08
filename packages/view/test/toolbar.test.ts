import { describe, expect, it, vi } from 'vitest'
import type { ToolbarItemView } from '../src/plugin.ts'
import { BUILTIN_TOOLBAR_ITEMS, createToolbarController } from '../src/chrome/toolbar.ts'

function controller() {
  const onCommand = vi.fn()
  const onImage = vi.fn()
  const view = createToolbarController({ onCommand, onImage })
  document.body.append(view.element)
  return { view, onCommand, onImage }
}

describe('toolbar controller', () => {
  it('shows all buttons when there is no overflow', () => {
    const { view } = controller()
    view.setItems(BUILTIN_TOOLBAR_ITEMS)
    expect(view.element.querySelector('button[data-overflow]')).toBeNull()
    expect(view.element.querySelectorAll('.v5-toolbar button')).toHaveLength(21)
    view.destroy()
  })

  it('moves extra buttons into the overflow menu', () => {
    const { view, onCommand } = controller()
    Object.defineProperty(view.element, 'clientWidth', { value: 160, configurable: true })
    view.setItems(BUILTIN_TOOLBAR_ITEMS)
    const more = view.element.querySelector<HTMLButtonElement>('button[data-overflow]')
    const menu = view.element.querySelector<HTMLElement>('.v5-toolbar-menu')
    expect(more).not.toBeNull()
    expect(menu).not.toBeNull()
    expect(view.element.querySelectorAll('.v5-toolbar button[data-item-id]:not([hidden])').length).toBeLessThan(21)

    more?.click()
    expect(menu?.hidden).toBe(false)
    const menuButtons = menu?.querySelectorAll<HTMLButtonElement>('button') ?? []
    expect(menuButtons.length).toBeGreaterThan(0)
    menuButtons[0]?.click()
    expect(onCommand).toHaveBeenCalledTimes(1)
    expect(menu?.hidden).toBe(true)

    view.destroy()
  })

  it('updates items incrementally and preserves existing buttons', () => {
    const { view } = controller()
    view.setItems(BUILTIN_TOOLBAR_ITEMS)
    const toolbar = view.element
    const bold = toolbar.querySelector('button[data-item-id="bold"]')
    const extra: ToolbarItemView = {
      id: 'extra.action',
      command: 'extra.action',
      label: '额外按钮',
      icon: '<svg></svg>',
      group: 'inline',
      order: 25,
      type: 'action',
    }

    view.setItems([...BUILTIN_TOOLBAR_ITEMS, extra])
    expect(view.element).toBe(toolbar)
    expect(toolbar.querySelector('button[data-item-id="bold"]')).toBe(bold)
    expect(toolbar.querySelector('button[data-item-id="extra.action"]')).not.toBeNull()

    view.setItems(BUILTIN_TOOLBAR_ITEMS)
    expect(toolbar.querySelector('button[data-item-id="extra.action"]')).toBeNull()
    expect(toolbar.querySelector('button[data-item-id="bold"]')).toBe(bold)

    view.destroy()
  })
})
