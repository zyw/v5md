import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { V5mdPlugin } from '@v5md/view'
import { V5Editor } from '../src/index'

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const plugin: V5mdPlugin = {
  name: 'react-playground-plugin',
  commands: {
    'react-playground.insert': {
      run: ({ insertText }) => insertText('!'),
    },
  },
  toolbar: [
    {
      id: 'react-playground.insert',
      command: 'react-playground.insert',
      label: '插件按钮',
      icon: '<svg></svg>',
      group: 'inline',
      order: 25,
    },
  ],
}

describe('@v5md/react plugins', () => {
  it('passes plugins through to the editor', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const changes: string[] = []

    function Harness() {
      const [value, setValue] = useState('hi')
      return createElement(V5Editor, {
        value,
        plugins: [plugin],
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
    const button = host.querySelector<HTMLButtonElement>('button[data-item-id="react-playground.insert"]')
    expect(button).not.toBeNull()

    await act(async () => {
      button?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(changes).toEqual(['!hi'])

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
