import type { PluginRegistration, PluginRegistry, V5mdCommandContext, V5mdPluginHandle } from '../plugin.js'

export interface PluginHostOptions {
  /** Context handed to plugin lifecycle hooks and commands. */
  context(): V5mdCommandContext
  /** Called whenever the installed plugin set changes. */
  changed(): void
  /** Whether a toolbar is mounted, so a failed install can restore it. */
  hasToolbar(): boolean
}

/** Owns plugin activation, the handle map and teardown. */
export class PluginHost {
  private readonly handles = new Map<string, V5mdPluginHandle<unknown>>()

  constructor(
    private readonly registry: PluginRegistry,
    private readonly options: PluginHostOptions,
  ) {}

  handle<T = undefined>(name: string): V5mdPluginHandle<T> | undefined {
    return this.handles.get(name) as V5mdPluginHandle<T> | undefined
  }

  activate<T>(registration: PluginRegistration<T>): V5mdPluginHandle<T> {
    const plugin = registration.plugin
    const context = this.options.context()
    let api: T
    try {
      api = plugin.api ? plugin.api(context) : (undefined as T)
    } catch (error) {
      this.registry.remove(plugin.name)
      if (this.options.hasToolbar()) this.options.changed()
      throw error
    }
    let resolveReady!: () => void
    let rejectReady!: (error: unknown) => void
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    void ready.catch(() => {})
    const handle: V5mdPluginHandle<T> = {
      name: plugin.name,
      api,
      ready,
      dispose: () => this.dispose(plugin.name),
    }
    this.handles.set(plugin.name, handle as V5mdPluginHandle<unknown>)
    try {
      const result = plugin.setup?.(context)
      if (result && typeof (result as Promise<void>).then === 'function') {
        void Promise.resolve(result).then(
          () => {
            if (registration.disposed) {
              registration.cleanup?.()
              registration.cleanup = undefined
            }
            resolveReady()
          },
          (error) => {
            console.error(`[v5md] plugin "${plugin.name}" setup failed`, error)
            rejectReady(error)
          },
        )
      } else {
        if (typeof result === 'function') registration.cleanup = result
        if (registration.disposed) {
          registration.cleanup?.()
          registration.cleanup = undefined
        }
        resolveReady()
      }
    } catch (error) {
      console.error(`[v5md] plugin "${plugin.name}" setup failed`, error)
      rejectReady(error)
    }
    return handle
  }

  dispose(name: string, skipRefresh = false): void {
    const registration = this.registry.get(name)
    if (!registration) return
    registration.disposed = true
    this.handles.delete(name)
    const cleanup = registration.cleanup
    registration.cleanup = undefined
    try {
      cleanup?.()
    } catch (error) {
      console.error(`[v5md] plugin "${name}" cleanup failed`, error)
    }
    try {
      registration.plugin.destroy?.()
    } catch (error) {
      console.error(`[v5md] plugin "${name}" destroy failed`, error)
    }
    this.registry.remove(name)
    if (!skipRefresh && this.options.hasToolbar()) this.options.changed()
  }
}
