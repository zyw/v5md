import type { FindOptions } from '@v5md/core'
import { DEFAULT_LOCALE, getMessages, type LocaleMessages } from '../i18n/index.js'

const findButton = (className: string, action: () => void): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.addEventListener('click', (event) => {
    event.preventDefault()
    action()
  })
  return button
}

const icon = (path: string): string =>
  `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const ICON_PREVIOUS = icon('M4.5 9.75 8 6.25l3.5 3.5')
const ICON_NEXT = icon('M4.5 6.25 8 9.75l3.5-3.5')
const ICON_REPLACE =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h6.2a2.6 2.6 0 1 1 0 5.2H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.6 7.4 4.4 9.5 6.6 11.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 13.5h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_REPLACE_ALL =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.8h6.2a2.6 2.6 0 1 1 0 5.2H5" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/><path d="M6.6 6.7 4.4 8.8 6.6 10.9" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 12.2h9M3.5 14.4h9" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/></svg>'

export interface FindBarOptions {
  onNext(): void
  onPrevious(): void
  onReplace(): void
  onReplaceAll(): void
  /** Runs after the bar hides itself, so the editor can take focus back. */
  onClose(): void
  /** Called when Aa / whole-word / regexp toggles change. */
  onOptionsChange?(): void
  messages?: LocaleMessages
}

export interface FindBar {
  readonly element: HTMLFormElement
  readonly query: HTMLInputElement
  readonly replacement: HTMLInputElement
  isOpen(): boolean
  getOptions(): FindOptions
  setStatus(text: string): void
  /** Reveals the bar and prepends it to the editor shell. */
  open(host: HTMLElement): void
  /** Keeps the bar in place after the shell re-renders. */
  attach(host: HTMLElement): void
  setMessages(messages: LocaleMessages): void
  hide(): void
  destroy(): void
}

export function createFindBar(options: FindBarOptions): FindBar {
  let messages = options.messages ?? getMessages(DEFAULT_LOCALE)
  let caseSensitive = false
  let wholeWord = false
  let regexp = false

  const form = document.createElement('form')
  form.className = 'v5md-find'
  form.contentEditable = 'false'
  form.hidden = true

  const row = document.createElement('div')
  row.className = 'v5md-find-row'

  const findGroup = document.createElement('div')
  findGroup.className = 'v5md-find-group'
  const findField = document.createElement('div')
  findField.className = 'v5md-find-field'
  const query = document.createElement('input')
  query.type = 'search'
  query.className = 'v5md-find-query'
  query.autocomplete = 'off'
  query.spellcheck = false

  const status = document.createElement('span')
  status.className = 'v5md-find-status'
  status.setAttribute('aria-live', 'polite')

  const toggles = document.createElement('div')
  toggles.className = 'v5md-find-toggles'
  const caseToggle = findButton('v5md-find-toggle', () => {
    caseSensitive = !caseSensitive
    syncToggles()
    options.onOptionsChange?.()
  })
  caseToggle.textContent = 'Aa'
  const wordToggle = findButton('v5md-find-toggle', () => {
    wholeWord = !wholeWord
    syncToggles()
    options.onOptionsChange?.()
  })
  wordToggle.textContent = 'ab'
  const regexpToggle = findButton('v5md-find-toggle', () => {
    regexp = !regexp
    syncToggles()
    options.onOptionsChange?.()
  })
  regexpToggle.textContent = '.*'
  toggles.append(caseToggle, wordToggle, regexpToggle)
  findField.append(query, status, toggles)

  const steps = document.createElement('div')
  steps.className = 'v5md-find-steps'
  const previous = findButton('v5md-find-action', () => options.onPrevious())
  previous.innerHTML = ICON_PREVIOUS
  const next = findButton('v5md-find-action', () => options.onNext())
  next.innerHTML = ICON_NEXT
  steps.append(previous, next)
  findGroup.append(findField, steps)

  const replaceGroup = document.createElement('div')
  replaceGroup.className = 'v5md-find-group'
  const replaceField = document.createElement('div')
  replaceField.className = 'v5md-find-field'
  const replacement = document.createElement('input')
  replacement.type = 'text'
  replacement.className = 'v5md-find-replacement'
  replacement.autocomplete = 'off'
  replacement.spellcheck = false
  replaceField.append(replacement)
  const replace = findButton('v5md-find-action', () => options.onReplace())
  replace.innerHTML = ICON_REPLACE
  const replaceAll = findButton('v5md-find-action', () => options.onReplaceAll())
  replaceAll.innerHTML = ICON_REPLACE_ALL
  replaceGroup.append(replaceField, replace, replaceAll)

  const close = findButton('v5md-find-close', () => {
    form.hidden = true
    options.onClose()
  })
  close.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4L4 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>'

  const syncToggles = (): void => {
    caseToggle.classList.toggle('is-on', caseSensitive)
    caseToggle.setAttribute('aria-pressed', String(caseSensitive))
    wordToggle.classList.toggle('is-on', wholeWord)
    wordToggle.setAttribute('aria-pressed', String(wholeWord))
    regexpToggle.classList.toggle('is-on', regexp)
    regexpToggle.setAttribute('aria-pressed', String(regexp))
  }

  const labelAction = (button: HTMLButtonElement, label: string): void => {
    button.title = label
    button.setAttribute('aria-label', label)
  }

  const applyMessages = (): void => {
    form.setAttribute('aria-label', messages.find.query)
    query.placeholder = messages.find.query
    query.setAttribute('aria-label', messages.find.query)
    replacement.placeholder = messages.find.replacement
    replacement.setAttribute('aria-label', messages.find.replacement)
    labelAction(previous, messages.find.previous)
    labelAction(next, messages.find.next)
    labelAction(replace, messages.find.replace)
    labelAction(replaceAll, messages.find.replaceAll)
    labelAction(close, messages.find.close)
    caseToggle.title = messages.find.matchCase
    caseToggle.setAttribute('aria-label', messages.find.matchCase)
    wordToggle.title = messages.find.wholeWord
    wordToggle.setAttribute('aria-label', messages.find.wholeWord)
    regexpToggle.title = messages.find.regexp
    regexpToggle.setAttribute('aria-label', messages.find.regexp)
  }
  applyMessages()
  syncToggles()

  row.append(findGroup, replaceGroup, close)
  form.append(row)

  // Keep typing / paste inside the bar from bubbling into the editor host listeners.
  for (const type of ['beforeinput', 'input', 'keydown', 'paste', 'compositionstart', 'compositionend'] as const) {
    form.addEventListener(type, (event) => event.stopPropagation())
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    options.onNext()
  })
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.target === replacement) {
        options.onReplace()
        return
      }
      if (event.shiftKey) options.onPrevious()
      else options.onNext()
      return
    }
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
    getOptions: () => ({ caseSensitive, wholeWord, regexp }),
    setStatus(text) {
      status.textContent = text
    },
    open(host) {
      form.hidden = false
      this.attach(host)
      query.focus()
      query.select()
    },
    attach(host) {
      if (!form.hidden) host.prepend(form)
    },
    setMessages(nextMessages) {
      messages = nextMessages
      applyMessages()
    },
    hide() {
      form.hidden = true
    },
    destroy() {
      form.remove()
    },
  }
}
