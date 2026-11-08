import type { OutlineEntry } from '@v5md/core'

export interface OutlinePanel {
  element: HTMLElement
  update(entries: OutlineEntry[]): void
}

export function createOutline(onJump: (start: number) => void): OutlinePanel {
  const nav = document.createElement('nav')
  nav.className = 'v5-outline'
  nav.contentEditable = 'false'
  nav.setAttribute('aria-label', '大纲')
  const title = document.createElement('p')
  title.textContent = '大纲'
  const list = document.createElement('div')
  nav.append(title, list)
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
  }
}
