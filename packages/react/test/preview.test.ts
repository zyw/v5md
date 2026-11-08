import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { V5Editor } from '../src/index'

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

describe('@v5md/react preview', () => {
  it('toggles task checkboxes through the controlled value', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const changes: string[] = []

    function Harness() {
      const [value, setValue] = useState('- [ ] 待办\n')
      return createElement(V5Editor, {
        value,
        editable: false,
        onChange(next: string) {
          changes.push(next)
          setValue(next)
        },
      })
    }

    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(Harness))
    })
    expect(host.querySelector<HTMLButtonElement>('.v5-check')?.dataset.checked).toBe('false')

    await act(async () => {
      host.querySelector<HTMLButtonElement>('.v5-check')?.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      )
    })
    expect(changes).toEqual(['- [x] 待办\n'])
    expect(host.querySelector<HTMLButtonElement>('.v5-check')?.dataset.checked).toBe('true')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('switches editability through the editable prop', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(createElement(V5Editor, { value: '正文\n', editable: false, onChange: () => {} }))
    })
    const surface = host.querySelector<HTMLElement>('.v5-doc')
    expect(surface?.getAttribute('contenteditable')).toBe('false')
    expect(surface?.getAttribute('aria-readonly')).toBe('true')

    await act(async () => {
      root.render(createElement(V5Editor, { value: '正文\n', editable: true, onChange: () => {} }))
    })
    expect(surface?.getAttribute('contenteditable')).toBe('true')
    expect(surface?.getAttribute('aria-readonly')).toBeNull()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})