import type { OutlineEntry } from '@v5md/core'
import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'

export interface OutlinePanel {
  element: HTMLElement
  update(entries: OutlineEntry[]): void
  setMessages(messages: LocaleMessages): void
}

export function createOutline(
  onJump: (start: number) => void,
  messages: LocaleMessages = getMessages(DEFAULT_LOCALE),
): OutlinePanel {
  let current = messages
  const nav = document.createElement('nav')
  nav.className = 'v5-outline'
  nav.contentEditable = 'false'
  const title = document.createElement('p')
  const list = document.createElement('div')
  nav.append(title, list)

  const applyMessages = (): void => {
    nav.setAttribute('aria-label', current.outline.title)
    title.textContent = current.outline.title
  }
  applyMessages()

  return {
    element: nav,
    update(entries) {
      list.replaceChildren()
      for (const item of entries) {
        const button = document.createElement('button')
        button.type = 'button'
        button.tabIndex = -1
        button.dataset.start = String(item.start)
        button.textContent = item.text
        button.style.paddingLeft = `${(item.depth - 1) * 12 + 8}px`
        button.addEventListener('mousedown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          onJump(item.start)
        })
        list.append(button)
      }
    },
    setMessages(next) {
      current = next
      applyMessages()
    },
  }
}
