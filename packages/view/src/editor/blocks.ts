import type { MdNode } from '@v5md/core'
import type {
  BlockDestroyContext,
  BlockHydrateContext,
  BlockRenderContext,
  BlockUpdateContext,
  V5mdBlockRenderer,
  V5mdPlugin,
} from '../plugin.js'

export interface BlockRenderPass {
  doc: string
  head: number
  editable: boolean
  sourceMode: boolean
  host: HTMLElement
}

interface BlockInstance {
  key: string
  rendererId: string
  lang: string
  source: string
  element: HTMLElement
  widget: HTMLElement | null
  destroy?: V5mdBlockRenderer['destroy']
  update?: V5mdBlockRenderer['update']
  hydrate?: V5mdBlockRenderer['hydrate']
}

interface PendingBlock {
  key: string
  renderer: V5mdBlockRenderer
  lang: string
  source: string
  element: HTMLElement
  ctx: BlockRenderContext
}

/** Stable non-crypto hash for block instance keys. */
export function hashSource(source: string): string {
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function normalizeBlockLang(lang: string | null | undefined): string {
  return (lang ?? '').trim().toLowerCase()
}

export function codeFenceSource(node: MdNode): string {
  return node.children.find((child) => child.type === 'text')?.text ?? ''
}

export function blockInstanceKey(rendererId: string, lang: string, source: string, occurrence: number): string {
  return `${rendererId}:${lang}:${hashSource(source)}:${occurrence}`
}

function langsOf(renderer: V5mdBlockRenderer): string[] {
  const raw = Array.isArray(renderer.lang) ? renderer.lang : [renderer.lang]
  return raw.map((item) => normalizeBlockLang(item)).filter(Boolean)
}

function previewSlot(element: HTMLElement): HTMLElement | null {
  return (
    element.querySelector<HTMLElement>('[data-void="widget"]') ??
    element.querySelector<HTMLElement>('[data-void="diagram"]') ??
    element.querySelector<HTMLElement>('.v5-widget-preview, .v5-diagram')
  )
}

function caretInNode(node: MdNode, offset: number): boolean {
  if (node.start === node.end) return offset === node.start
  if (offset >= node.start && offset < node.end) return true
  return offset === node.end
}

/** Editor-scoped registry of plugin block renderers. */
export class BlockRendererRegistry {
  private readonly byId = new Map<string, { plugin: string; renderer: V5mdBlockRenderer }>()
  private readonly byLang = new Map<string, string>()
  private readonly order: string[] = []

  register(pluginName: string, renderer: V5mdBlockRenderer): void {
    const id = renderer.id?.trim()
    if (!id) throw new Error(`v5md plugin "${pluginName}" block renderer is missing id`)
    if (typeof renderer.render !== 'function') {
      throw new Error(`v5md plugin "${pluginName}" block renderer "${id}" must define render()`)
    }
    if (this.byId.has(id)) {
      throw new Error(`v5md block renderer "${id}" is already registered`)
    }
    const langs = langsOf(renderer)
    if (langs.length === 0 && !renderer.match) {
      throw new Error(`v5md block renderer "${id}" needs lang or match()`)
    }
    for (const lang of langs) {
      if (this.byLang.has(lang)) {
        throw new Error(`v5md block lang "${lang}" is already owned by "${this.byLang.get(lang)}"`)
      }
    }
    this.byId.set(id, { plugin: pluginName, renderer })
    this.order.push(id)
    for (const lang of langs) this.byLang.set(lang, id)
  }

  unregisterPlugin(pluginName: string): string[] {
    const removedIds: string[] = []
    for (const [id, entry] of [...this.byId.entries()]) {
      if (entry.plugin !== pluginName) continue
      removedIds.push(id)
      this.byId.delete(id)
      const index = this.order.indexOf(id)
      if (index >= 0) this.order.splice(index, 1)
      for (const [lang, owner] of [...this.byLang.entries()]) {
        if (owner === id) this.byLang.delete(lang)
      }
    }
    return removedIds
  }

  resolve(node: MdNode): V5mdBlockRenderer | null {
    if (node.type !== 'code') return null
    for (const id of this.order) {
      const entry = this.byId.get(id)
      if (entry?.renderer.match?.(node)) return entry.renderer
    }
    const lang = normalizeBlockLang(node.lang)
    if (!lang) return null
    const id = this.byLang.get(lang)
    return id ? (this.byId.get(id)?.renderer ?? null) : null
  }

  get size(): number {
    return this.byId.size
  }
}

/**
 * Owns block instances across full-document re-renders:
 * resolve → sync shell → reconcile(update|hydrate|destroy).
 */
export class BlockHost {
  private readonly registry = new BlockRendererRegistry()
  private instances = new Map<string, BlockInstance>()
  private pending = new Map<string, PendingBlock>()
  private occurrence = new Map<string, number>()
  private pass: BlockRenderPass | null = null
  private generation = 0
  private hydrateController: AbortController | null = null

  registerPlugin(plugin: V5mdPlugin<unknown>): void {
    for (const renderer of plugin.blocks ?? []) this.registry.register(plugin.name, renderer)
  }

  unregisterPlugin(pluginName: string): void {
    const removedIds = new Set(this.registry.unregisterPlugin(pluginName))
    if (removedIds.size === 0) return
    for (const [key, instance] of [...this.instances.entries()]) {
      if (!removedIds.has(instance.rendererId)) continue
      this.destroyInstance(instance)
      this.instances.delete(key)
    }
  }

  beginRender(pass: BlockRenderPass): void {
    this.pass = pass
    this.pending = new Map()
    this.occurrence = new Map()
  }

  /** Sync shell for a code node, or null to fall back to built-in rendering. */
  render(node: MdNode): HTMLElement | null {
    const pass = this.pass
    if (!pass || pass.sourceMode) return null
    const renderer = this.registry.resolve(node)
    if (!renderer) return null
    const lang = normalizeBlockLang(node.lang)
    const source = codeFenceSource(node)
    const bucket = `${renderer.id}:${lang}:${hashSource(source)}`
    const occurrence = this.occurrence.get(bucket) ?? 0
    this.occurrence.set(bucket, occurrence + 1)
    const key = blockInstanceKey(renderer.id, lang, source, occurrence)
    const ctx: BlockRenderContext = {
      node,
      doc: pass.doc,
      source,
      lang,
      editable: pass.editable,
      sourceMode: pass.sourceMode,
      active: caretInNode(node, pass.head),
      host: pass.host,
    }
    const element = renderer.render(ctx)
    element.classList.add('v5-widget')
    element.dataset.v5BlockKey = key
    element.dataset.v5BlockRenderer = renderer.id
    element.dataset.v5BlockLang = lang
    this.pending.set(key, { key, renderer, lang, source, element, ctx })
    return element
  }

  /** After the document DOM is in place: reuse, hydrate, or destroy instances. */
  afterRender(): void {
    const pass = this.pass
    this.pass = null
    if (!pass || pass.sourceMode) {
      this.destroyAll()
      return
    }
    const generation = ++this.generation
    this.hydrateController?.abort()
    const controller = new AbortController()
    this.hydrateController = controller
    const next = new Map<string, BlockInstance>()

    for (const [key, pending] of this.pending) {
      const previous = this.instances.get(key)
      const slot = previewSlot(pending.element)
      if (previous && pending.renderer.update && slot && previous.widget) {
        // Reattach the previous preview slot (keeps chart/canvas node identity).
        if (previous.widget !== slot) {
          const parent = slot.parentNode
          if (parent) parent.insertBefore(previous.widget, slot)
          slot.remove()
        }
        const liveSlot = previous.widget
        const updateCtx: BlockUpdateContext = {
          ...pending.ctx,
          element: pending.element,
          previous: liveSlot,
          isCurrent: () => generation === this.generation,
          signal: controller.signal,
        }
        try {
          void Promise.resolve(pending.renderer.update(updateCtx)).catch((error) => {
            console.error(`[v5md] block "${pending.renderer.id}" update failed`, error)
          })
        } catch (error) {
          console.error(`[v5md] block "${pending.renderer.id}" update failed`, error)
        }
        next.set(key, {
          key,
          rendererId: pending.renderer.id,
          lang: pending.lang,
          source: pending.source,
          element: pending.element,
          widget: liveSlot,
          destroy: pending.renderer.destroy,
          update: pending.renderer.update,
          hydrate: pending.renderer.hydrate,
        })
        this.instances.delete(key)
        continue
      }

      if (previous) {
        this.destroyInstance(previous)
        this.instances.delete(key)
      }

      next.set(key, {
        key,
        rendererId: pending.renderer.id,
        lang: pending.lang,
        source: pending.source,
        element: pending.element,
        widget: slot,
        destroy: pending.renderer.destroy,
        update: pending.renderer.update,
        hydrate: pending.renderer.hydrate,
      })

      if (pending.renderer.hydrate) {
        const hydrateCtx: BlockHydrateContext = {
          ...pending.ctx,
          element: pending.element,
          isCurrent: () => generation === this.generation && !controller.signal.aborted,
          signal: controller.signal,
        }
        const live = next.get(key)
        const result = pending.renderer.hydrate(hydrateCtx)
        if (live) live.widget = previewSlot(pending.element) ?? live.widget
        void Promise.resolve(result)
          .then(() => {
            if (live && generation === this.generation) {
              live.widget = previewSlot(pending.element) ?? live.widget
            }
          })
          .catch((error) => {
            if (controller.signal.aborted || generation !== this.generation) return
            console.error(`[v5md] block "${pending.renderer.id}" hydrate failed`, error)
          })
      }
    }

    for (const instance of this.instances.values()) this.destroyInstance(instance)
    this.instances = next
    this.pending = new Map()
  }

  destroyAll(): void {
    this.hydrateController?.abort()
    this.hydrateController = null
    for (const instance of this.instances.values()) this.destroyInstance(instance)
    this.instances.clear()
    this.pending = new Map()
  }

  get registrySize(): number {
    return this.registry.size
  }

  private destroyInstance(instance: BlockInstance): void {
    if (!instance.destroy) return
    const ctx: BlockDestroyContext = {
      element: instance.element,
      lang: instance.lang,
      rendererId: instance.rendererId,
    }
    try {
      instance.destroy(ctx)
    } catch (error) {
      console.error(`[v5md] block "${instance.rendererId}" destroy failed`, error)
    }
  }
}
