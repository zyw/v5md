const findButton = (label: string, action: () => void): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', (event) => {
    event.preventDefault()
    action()
  })
  return button
}

export interface FindBarOptions {
  onNext(): void
  onReplace(): void
  onReplaceAll(): void
  /** Runs after the bar hides itself, so the editor can take focus back. */
  onClose(): void
}

export interface FindBar {
  readonly element: HTMLFormElement
  readonly query: HTMLInputElement
  readonly replacement: HTMLInputElement
  isOpen(): boolean
  /** Reveals the bar and prepends it to the editor shell. */
  open(host: HTMLElement): void
  /** Keeps the bar in place after the shell re-renders. */
  attach(host: HTMLElement): void
  hide(): void
  destroy(): void
}

export function createFindBar(options: FindBarOptions): FindBar {
  const form = document.createElement('form')
  form.className = 'v5md-find'
  form.contentEditable = 'false'
  form.hidden = true
  const query = document.createElement('input')
  query.type = 'search'
  query.placeholder = '查找'
  query.setAttribute('aria-label', '查找')
  const replacement = document.createElement('input')
  replacement.type = 'text'
  replacement.placeholder = '替换为'
  replacement.setAttribute('aria-label', '替换为')
  form.append(
    query,
    replacement,
    findButton('下一个', () => options.onNext()),
    findButton('替换', () => options.onReplace()),
    findButton('全部替换', () => options.onReplaceAll()),
    findButton('关闭', () => {
      form.hidden = true
      options.onClose()
    }),
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    options.onNext()
  })
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    form.hidden = true
    options.onClose()
  })

  return {
    element: form,
    query,
    replacement,
    isOpen: () => !form.hidden,
    open(host) {
      form.hidden = false
      this.attach(host)
      query.focus()
      query.select()
    },
    attach(host) {
      if (!form.hidden) host.prepend(form)
    },
    hide() {
      form.hidden = true
    },
    destroy() {
      form.remove()
    },
  }
}
