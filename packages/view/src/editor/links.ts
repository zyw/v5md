/** Command the desktop shell must expose so a note link opens in the system browser. */
export const DESKTOP_OPEN_COMMAND = 'open_external_url'

const REPEAT_WINDOW_MS = 400

interface TauriInternals {
  invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>
}

export function isDesktopShell(): boolean {
  return typeof desktopInternals()?.invoke === 'function'
}

function desktopInternals(): TauriInternals | null {
  const host = globalThis as typeof globalThis & { __TAURI_INTERNALS__?: TauriInternals }
  return host.__TAURI_INTERNALS__ ?? null
}

/** http(s) and mailto links that can leave the editor. Relative and script URLs stay inside the note. */
export function externalLinkUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value || [...value].some((char) => char <= ' ' || char === '\u007f')) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol === 'mailto:') {
    if (!url.pathname && !url.search) return null
    return url.href
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  return url.href
}

export function modifierLabel(platform = navigator.platform || ''): string {
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl键'
}

/** Hover text for a link. A plain click never leaves the note. */
export function linkActivationHint(
  _preview: boolean,
  systemBrowser = isDesktopShell(),
  modifier = modifierLabel(),
): string {
  const where = systemBrowser ? '系统默认浏览器打开链接' : '在新标签页打开链接'
  return `鼠标右击 或 ${modifier} + 点击 ${where}`
}

export function linkAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const anchor = target.closest('a.v5-link')
  return anchor instanceof HTMLAnchorElement ? anchor : null
}

let lastOpened = { url: '', at: 0 }

/**
 * Opens a link outside the editor. A browser gets a new tab. The Tauri shell is asked to
 * hand the same URL to the system browser. A right-click and the click it produces count once.
 */
export function openExternalLink(raw: string): void {
  const url = externalLinkUrl(raw)
  if (!url) return
  const now = Date.now()
  if (lastOpened.url === url && now - lastOpened.at < REPEAT_WINDOW_MS) return
  lastOpened = { url, at: now }
  const internals = desktopInternals()
  if (typeof internals?.invoke === 'function') {
    void internals.invoke(DESKTOP_OPEN_COMMAND, { url }).catch((error: unknown) => {
      console.error('[v5md] failed to open link', error)
    })
    return
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}
