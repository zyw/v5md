import { createApp, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { Editor, V5mdPlugin } from '@v5md/view'
import { V5Editor } from '../src/index'

const plugin: V5mdPlugin = {
  name: 'vue-playground-plugin',
  commands: {
    'vue-playground.insert': {
      run: ({ insertText }) => insertText('!'),
    },
  },
  toolbar: [
    {
      id: 'vue-playground.insert',
      command: 'vue-playground.insert',
      label: '插件按钮',
      icon: '<svg></svg>',
      group: 'inline',
      order: 25,
    },
  ],
}

describe('@v5md/vue plugins', () => {
  it('passes plugins through to the editor', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const markdown = ref('hi')
    let editor: Editor | null = null
    const app = createApp({
      render: () =>
        h(V5Editor, {
          modelValue: markdown.value,
          plugins: [plugin],
          'onUpdate:modelValue': (next: string) => {
            markdown.value = next
          },
          onReady: (instance: Editor) => {
            editor = instance
          },
        }),
    })
    app.mount(host)
    await nextTick()
    const button = host.querySelector<HTMLButtonElement>('button[data-item-id="vue-playground.insert"]')
    expect(button).not.toBeNull()
    expect(editor?.getPlugin('vue-playground-plugin')).toBeDefined()

    button?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()
    expect(markdown.value).toBe('!hi')

    app.unmount()
    host.remove()
  })
})
