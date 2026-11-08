import { createApp, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { V5Editor } from '../src/index'

describe('@v5md/vue preview', () => {
  it('toggles task checkboxes through v-model', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const markdown = ref('- [ ] 待办\n')
    const app = createApp({
      render: () =>
        h(V5Editor, {
          modelValue: markdown.value,
          editable: false,
          'onUpdate:modelValue': (next: string) => {
            markdown.value = next
          },
        }),
    })
    app.mount(host)
    await nextTick()
    expect(host.querySelector<HTMLButtonElement>('.v5-check')?.dataset.checked).toBe('false')

    host
      .querySelector<HTMLButtonElement>('.v5-check')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(markdown.value).toBe('- [x] 待办\n')
    expect(host.querySelector<HTMLButtonElement>('.v5-check')?.dataset.checked).toBe('true')

    app.unmount()
    host.remove()
  })

  it('switches editability through the editable prop', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const markdown = ref('正文\n')
    const editable = ref(false)
    const app = createApp({
      render: () =>
        h(V5Editor, {
          modelValue: markdown.value,
          editable: editable.value,
          'onUpdate:modelValue': (next: string) => {
            markdown.value = next
          },
        }),
    })
    app.mount(host)
    await nextTick()
    const surface = host.querySelector<HTMLElement>('.v5-doc')
    expect(surface?.getAttribute('contenteditable')).toBe('false')
    expect(surface?.getAttribute('aria-readonly')).toBe('true')

    editable.value = true
    await nextTick()
    expect(surface?.getAttribute('contenteditable')).toBe('true')
    expect(surface?.getAttribute('aria-readonly')).toBeNull()

    app.unmount()
    host.remove()
  })
})
