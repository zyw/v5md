/** Copies the current DOM selection as rich HTML, minus the editor's chrome. */
export function copySelectionAsRich(host: HTMLElement, event: ClipboardEvent): boolean {
  if (typeof document === 'undefined') return false
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  if (!host.contains(range.commonAncestorContainer)) return false
  const holder = document.createElement('div')
  holder.style.position = 'fixed'
  holder.style.left = '-9999px'
  holder.style.top = '0'
  holder.style.opacity = '0'
  holder.style.pointerEvents = 'none'
  holder.append(range.cloneContents())
  document.body.append(holder)
  cleanCopiedFragment(holder)
  const html = holder.innerHTML
  const text = (holder.innerText || holder.textContent || '').replace(/\u00a0/g, ' ').trim() || selection.toString()
  holder.remove()
  if (!html) return false
  event.preventDefault()
  event.clipboardData?.setData('text/html', html)
  if (text) event.clipboardData?.setData('text/plain', text)
  return true
}

function cleanCopiedFragment(root: HTMLElement): void {
  root
    .querySelectorAll(
      '.md-marker, .v5-marker, .v5-source, .v5-image-resize, .v5-empty-line, .v5-block-handle, .v5-block-menu, .v5-tablebar, .v5-toolbar, .v5-outline, .v5-find',
    )
    .forEach((element) => element.remove())
  root.querySelectorAll('.v5-mermaid > code').forEach((element) => element.remove())
  root.querySelectorAll<HTMLButtonElement>('button.v5-check').forEach((check) => {
    const label = check.ownerDocument.createElement('span')
    label.textContent = check.dataset.checked === 'true' ? '✓' : '☐'
    check.replaceWith(label)
  })
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    element.removeAttribute('contenteditable')
    element.removeAttribute('spellcheck')
    element.removeAttribute('tabindex')
    element.classList.remove('is-source', 'is-active', 'is-composing')
  }
}
