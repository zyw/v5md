const diagramCache = new Map<string, string>()

/**
 * Renders every mermaid diagram in the host, reusing earlier results.
 * `isCurrent` lets a newer render cancel this one between steps.
 */
export async function paintDiagrams(host: HTMLElement, isCurrent: () => boolean): Promise<void> {
  const nodes = [...host.querySelectorAll<HTMLElement>('.v5-diagram')]
  if (nodes.length === 0) return
  const pending = nodes.filter((node) => !diagramCache.has(node.dataset.diagram ?? ''))
  if (pending.length === 0) {
    for (const node of nodes) node.innerHTML = diagramCache.get(node.dataset.diagram ?? '') ?? ''
    return
  }
  const mermaid = (await import('mermaid')).default
  if (!isCurrent()) return
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', fontFamily: 'inherit' })
  for (const node of nodes) {
    if (!isCurrent() || !host.contains(node)) return
    const source = node.dataset.diagram ?? ''
    const cached = diagramCache.get(source)
    if (cached) {
      node.innerHTML = cached
      continue
    }
    const id = `v5md-${Math.random().toString(36).slice(2)}`
    try {
      const result = await mermaid.render(id, source)
      diagramCache.set(source, result.svg)
      document.getElementById(id)?.remove()
      if (isCurrent() && host.contains(node)) node.innerHTML = result.svg
    } catch {
      document.getElementById(id)?.remove()
      if (host.contains(node)) node.textContent = '图表无法显示'
    }
  }
}
