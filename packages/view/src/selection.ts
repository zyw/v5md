const BLOCKS = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'code',
  'thematicBreak',
  'html',
  'table',
  'tableRow',
  'tableCell',
  'math',
  'yaml',
])

const INLINES = new Set(['strong', 'emphasis', 'inlineCode', 'strikethrough', 'highlight', 'underline', 'link', 'image', 'inlineMath'])

export function domPointToOffset(root: HTMLElement, node: Node | null, point: number): number | null {
  if (!node || !root.contains(node)) return null
  const leaf = nearestLeaf(node)
  if (leaf) {
    const start = readOffset(leaf, 'data-start')
    const end = readOffset(leaf, 'data-end')
    if (node.nodeType === Node.TEXT_NODE && leaf.contains(node)) {
      return clamp(start + point, start, end)
    }
    if (node === leaf) return point === 0 ? start : end
    if (leaf.contains(node)) return start
  }

  if (node instanceof HTMLElement) {
    if (point <= 0) {
      const own = node.closest('[data-start]')
      return own ? readOffset(own, 'data-start') : 0
    }
    const before = node.childNodes[point - 1]
    const positioned = elementOf(before)?.closest<HTMLElement>('[data-end]')
    if (positioned) return readOffset(positioned, 'data-end')
  }
  return null
}

export function offsetToDomPoint(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  const leaves = [...root.querySelectorAll<HTMLElement>('[data-leaf]')].filter(isLeafVisible)
  for (const leaf of leaves) {
    const start = readOffset(leaf, 'data-start')
    const end = readOffset(leaf, 'data-end')
    if (offset >= start && offset < end) return pointInLeaf(leaf, offset - start)
    if (offset === end && offset === start) return pointInLeaf(leaf, 0)
  }
  for (let index = leaves.length - 1; index >= 0; index -= 1) {
    const leaf = leaves[index]
    if (!leaf) continue
    const end = readOffset(leaf, 'data-end')
    if (offset >= end) return pointInLeaf(leaf, end - readOffset(leaf, 'data-start'))
  }
  const first = leaves[0]
  return first ? pointInLeaf(first, 0) : null
}

export function isLeafVisible(leaf: HTMLElement): boolean {
  if (leaf.classList.contains('v5-source')) {
    const host = leaf.closest('.v5-math, .v5-image, .v5-hr')
    return Boolean(host?.classList.contains('is-source') || host?.classList.contains('is-active'))
  }
  if (leaf.classList.contains('md-marker')) {
    if (leaf.closest('.v5-table')) return false
    const inline = leaf.closest('[data-inline]')
    if (inline) return inline.classList.contains('is-source')
    return Boolean(leaf.closest('[data-block]')?.classList.contains('is-active'))
  }
  return true
}

export function applyChrome(root: HTMLElement, head: number, anchor: number, docLength: number): void {
  root.querySelectorAll<HTMLElement>('[data-block]').forEach((element) => {
    element.classList.toggle('is-active', elementHoldsCaret(element, head, docLength))
  })
  root.querySelectorAll<HTMLElement>('[data-inline]').forEach((element) => {
    const start = readOffset(element, 'data-start')
    const end = readOffset(element, 'data-end')
    const image = element.dataset.inline === 'image'
    const inside = image ? head >= start && head <= end : head > start && head < end
    const covered =
      anchor !== head &&
      Math.min(anchor, head) < end &&
      Math.max(anchor, head) > start &&
      (image || element.dataset.inline === 'thematicBreak')
    element.classList.toggle('is-source', inside || covered)
  })
}

function elementHoldsCaret(element: HTMLElement, offset: number, _docLength: number): boolean {
  const start = readOffset(element, 'data-start')
  const end = readOffset(element, 'data-end')
  if (start === end) return offset === start
  if (offset >= start && offset < end) return true
  return offset === end
}

function pointInLeaf(leaf: HTMLElement, offset: number): { node: Node; offset: number } {
  const text = [...leaf.childNodes].find((child) => child.nodeType === Node.TEXT_NODE)
  if (text) return { node: text, offset: Math.min(offset, text.textContent?.length ?? 0) }
  return { node: leaf, offset: 0 }
}

function nearestLeaf(node: Node): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node.parentElement
  return element?.closest<HTMLElement>('[data-leaf]') ?? null
}

function elementOf(node: Node | undefined): HTMLElement | null {
  if (!node) return null
  return node instanceof HTMLElement ? node : node.parentElement
}

function readOffset(element: Element, name: string): number {
  return Number(element.getAttribute(name) ?? 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isBlockType(type: string): boolean {
  return BLOCKS.has(type)
}

export function isInlineType(type: string): boolean {
  return INLINES.has(type)
}
