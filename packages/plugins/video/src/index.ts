import {
  createFencedWidgetShell,
  resolveLocale,
  type BlockDestroyContext,
  type BlockRenderContext,
  type BlockUpdateContext,
  type LocaleCode,
  type V5mdBlockRenderer,
  type V5mdPlugin,
} from '@v5md/view'

export type VideoKind = 'video' | 'audio'

/** Inline formats the browser can play directly, mapped to the `<source type>` MIME. */
const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
}

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

export type VideoUnplayableReason = 'missing-src' | 'platform-url' | 'unsupported' | 'decode-failed'

export interface VideoBlock {
  kind: VideoKind
  src: string
  poster?: string
  title?: string
  /** Playback starts around this second; survives render → edit → render. */
  start: number
  /** `false` when no URL was found and the block can only show a prompt. */
  hasSource: boolean
  /** Set when the block is present but the browser cannot play it inline. */
  reason?: VideoUnplayableReason
}

export interface VideoBlockOptions {
  poster?: string
  title?: string
  /** Seconds. */
  start?: number
  /** Render inside an ` ```audio ` fence. */
  audio?: boolean
}

export interface VideoPluginOptions {
  /** 插件名，默认 video。 */
  name?: string
  /** 匹配的 fenced lang，默认 ['video','audio']。 */
  lang?: string | string[]
  /** 是否在工具条显示插入按钮，默认 true。 */
  toolbar?: boolean
  /** `<video>` / `<audio>` 附加属性，如 crossOrigin、muted。 */
  mediaAttributes?: Record<string, string>
  /** UI language for toolbar icon labels. Defaults to zh-CN. */
  locale?: LocaleCode | string
}

export interface VideoApi {
  /** 在光标处插入视频块；返回是否已写入。 */
  insert(src: string, options?: VideoBlockOptions): boolean
}

type VideoCopy = {
  title: string
  audioTitle: string
  missingSrc: string
  platformUrl: string
  unsupported: string
  decodeFailed: string
  openSource: string
  play: string
  caption: string
}

const COPY: Record<LocaleCode, VideoCopy> = {
  'zh-CN': {
    title: '视频',
    audioTitle: '音频',
    missingSrc: '在围栏里填写视频地址',
    platformUrl: '平台页面无法直接播放，请换用 mp4 直链',
    unsupported: '浏览器不支持该格式',
    decodeFailed: '视频编码无法解码',
    openSource: '打开视频源',
    play: '从 {time} 开始播放',
    caption: '视频',
  },
  en: {
    title: 'Video',
    audioTitle: 'Audio',
    missingSrc: 'Add a video URL inside the fence',
    platformUrl: 'Platform pages cannot play inline; use a direct mp4 link',
    unsupported: 'Browser cannot play this format',
    decodeFailed: 'Video cannot be decoded',
    openSource: 'Open video source',
    play: 'Play from {time}',
    caption: 'Video',
  },
}

const VIDEO_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="m16 12 5-3.2v6.4L16 12Z"/></svg>'
const AUDIO_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 17.5V6.5l10-2v11"/><circle cx="6.8" cy="17.5" r="2.4"/><circle cx="16.8" cy="15.5" r="2.4"/></svg>'
const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8.5 5.6v12.8L18.8 12 8.5 5.6Z" fill="currentColor" stroke="none"/></svg>'

function fenceBlock(lang: string, source: string): string {
  const body = source.replace(/^\n+/, '').replace(/\n+$/, '')
  return `\n\`\`\`${lang}\n${body}\n\`\`\`\n`
}

function previewOf(element: HTMLElement): HTMLElement | null {
  return (
    element.querySelector<HTMLElement>('.v5-video-preview') ??
    element.querySelector<HTMLElement>('[data-void="widget"]')
  )
}

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut >= 0 ? url.slice(0, cut) : url
}

/** Lowercase extension of a URL path, or '' when there is none. */
export function extensionOf(url: string): string {
  const path = stripQuery(url.replace(/\\/g, '/')).split('/').pop() ?? ''
  const dot = path.lastIndexOf('.')
  return dot > 0 && dot < path.length - 1 ? path.slice(dot + 1).toLowerCase() : ''
}

/** MIME type written to `<source type>`, or null when the format is not natively playable. */
export function videoTypeFor(url: string): string | null {
  const extension = extensionOf(url)
  return extension ? (VIDEO_TYPES[extension] ?? AUDIO_TYPES[extension] ?? null) : null
}

const PLATFORM_HOST =
  /^(?:(?:www|m|player|music)\.)?(youtube\.com|youtu\.be|bilibili\.com|b23\.tv|vimeo\.com|douyin\.com|iesdouyin\.com|ixigua\.com|youku\.com|v\.qq\.com|xiaohongshu\.com|xhslink\.com)$/i
const SHORT_LINK_HOSTS = new Set(['youtu.be', 'b23.tv'])
const PLATFORM_PAGE_PATH = /^\/(watch|shorts|embed|player|status|video)(\/|$)/i
const PLATFORM_PAGE_QUERY = /[?&](v|bvid|aid|vid|vid_)=/i

/** A share page that needs an iframe (which v5md does not embed) instead of a media file. */
export function isPlatformPageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!PLATFORM_HOST.test(parsed.hostname)) return false
  // Short links (youtu.be/ID, b23.tv/ID) carry the video id in the path itself.
  if (parsed.pathname.split('/').filter(Boolean).length === 1) {
    if (SHORT_LINK_HOSTS.has(parsed.hostname.toLowerCase())) return true
  }
  return PLATFORM_PAGE_PATH.test(parsed.pathname) || PLATFORM_PAGE_QUERY.test(parsed.search)
}

function attribute(body: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s"']+))`).exec(body)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function secondsOf(value: unknown): number {
  const text = typeof value === 'number' ? String(value) : (value ?? '').toString().replace(/s$/i, '')
  const number = Number(text)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/**
 * Fence body → block model. Accepts, in this order:
 *
 * ```
 * clip.mp4                                      a bare URL
 * [Title](clip.mp4)                             a Markdown link
 * src=clip.mp4 poster=cover.jpg start=12s       key=value options on one line
 * {"src":"clip.mp4","poster":"cover.jpg","start":12}   JSON
 * ```
 */
export function parseVideoBlock(source: string, kind: VideoKind = 'video'): VideoBlock {
  const body = source.trim()
  const settle = (src: string, extra: { poster?: string; title?: string; start?: number } = {}): VideoBlock => {
    const block: VideoBlock = {
      kind,
      src: src.trim(),
      poster: extra.poster?.trim() || undefined,
      title: extra.title?.trim() || undefined,
      start: extra.start && extra.start > 0 ? extra.start : 0,
      hasSource: Boolean(src.trim()),
    }
    if (!block.hasSource) return { ...block, reason: 'missing-src' }
    if (/^(https?:)?\/\//i.test(block.src) && isPlatformPageUrl(block.src)) return { ...block, reason: 'platform-url' }
    if (extensionOf(block.src) && !videoTypeFor(block.src)) return { ...block, reason: 'unsupported' }
    return block
  }

  if (!body) return settle('')

  if (body.startsWith('{')) {
    let data: unknown
    try {
      data = JSON.parse(body)
    } catch {
      return settle('')
    }
    if (!data || typeof data !== 'object') return settle('')
    const record = data as Record<string, unknown>
    const text = (key: string): string | undefined =>
      typeof record[key] === 'string' && (record[key] as string).trim() ? (record[key] as string) : undefined
    return settle(text('src') ?? '', { poster: text('poster'), title: text('title'), start: secondsOf(record.start) })
  }

  const firstLine =
    body
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? ''
  const link = /^\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)$/.exec(firstLine)
  if (link) return settle(link[2] ?? '', { title: link[1] || undefined })

  if (/^[\w-]+\s*=/.test(firstLine)) {
    return settle(attribute(body, 'src') ?? '', {
      poster: attribute(body, 'poster'),
      title: attribute(body, 'title'),
      start: secondsOf(attribute(body, 'start')),
    })
  }

  return settle(firstLine)
}

/** Writes options back as one `key=value` line; quotes values that contain spaces. */
export function serializeVideoBlock(src: string, options: VideoBlockOptions = {}): string {
  const quote = (value: string): string => (/\s/.test(value) ? `"${value}"` : value)
  const parts = [`src=${quote(src.trim())}`]
  if (options.poster?.trim()) parts.push(`poster=${quote(options.poster.trim())}`)
  if (options.title?.trim()) parts.push(`title=${quote(options.title.trim())}`)
  if (options.start && options.start > 0) parts.push(`start=${Math.round(options.start)}s`)
  return parts.join(' ')
}

function formatTime(total: number): string {
  const value = Math.max(0, Math.round(total))
  const minutes = Math.floor(value / 60)
  const rest = value % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function reasonText(copy: VideoCopy, reason: VideoUnplayableReason | undefined): string {
  if (reason === 'platform-url') return copy.platformUrl
  if (reason === 'unsupported') return copy.unsupported
  if (reason === 'decode-failed') return copy.decodeFailed
  return copy.missingSrc
}

/**
 * Cover for blocks that cannot play inline: poster, play glyph, why it is not
 * playing, and a way through to the source. The glyph links straight to the
 * URL so a platform page still opens in a new tab instead of sitting dead.
 */
function coverElement(block: VideoBlock, copy: VideoCopy): HTMLElement {
  const cover = document.createElement('div')
  cover.className = 'v5-video-cover'
  cover.dataset.kind = block.kind
  if (block.poster) {
    const poster = document.createElement('img')
    poster.className = 'v5-video-poster'
    poster.alt = ''
    poster.src = block.poster
    cover.append(poster)
  }
  const body = document.createElement('div')
  body.className = 'v5-video-cover-body'
  const glyph = document.createElement(block.hasSource ? 'a' : 'span')
  glyph.className = 'v5-video-glyph'
  glyph.innerHTML = PLAY_ICON
  if (block.hasSource && glyph instanceof HTMLAnchorElement) {
    glyph.href = block.src
    glyph.target = '_blank'
    glyph.rel = 'noopener noreferrer'
    glyph.setAttribute('aria-label', copy.openSource)
  }
  const reason = document.createElement('p')
  reason.className = 'v5-video-reason'
  reason.textContent = reasonText(copy, block.reason)
  body.append(glyph, reason)
  cover.append(body)
  if (block.hasSource) {
    const url = document.createElement('p')
    url.className = 'v5-video-url'
    url.textContent = block.src
    cover.append(url)
  }
  return cover
}

function playerOf(preview: HTMLElement): HTMLMediaElement | null {
  return preview.querySelector<HTMLMediaElement>(':scope > .v5-video-media')
}

function sameMedia(element: HTMLMediaElement, block: VideoBlock): boolean {
  if (element.tagName.toLowerCase() !== block.kind) return false
  const source = element.querySelector('source')
  return source?.getAttribute('src') === block.src && source?.getAttribute('type') === (videoTypeFor(block.src) ?? null)
}

/**
 * Applies a block to its preview. The player is only rebuilt when the file
 * changes or a cover replaces it, so editing nearby text never reloads the
 * video and a running player keeps its position.
 */
function paint(preview: HTMLElement, block: VideoBlock, copy: VideoCopy, attributes?: Record<string, string>): void {
  preview.dataset.videoSrc = block.src
  preview.dataset.videoKind = block.kind
  const current = playerOf(preview)
  if (block.reason || (current && !sameMedia(current, block))) {
    if (current && !current.paused) current.pause()
    if (block.reason) {
      preview.replaceChildren(coverElement(block, copy))
      return
    }
    const next = createPlayer(block, copy, attributes)
    preview.replaceChildren(next)
    syncCaption(preview, block)
    refreshStartChip(preview, block, copy, next)
    return
  }

  if (current) {
    applyMediaAttributes(current, block, copy, attributes)
    syncCaption(preview, block)
    refreshStartChip(preview, block, copy, current)
    return
  }

  const next = createPlayer(block, copy, attributes)
  preview.replaceChildren(next)
  syncCaption(preview, block)
  refreshStartChip(preview, block, copy, next)
}

function createPlayer(block: VideoBlock, copy: VideoCopy, attributes?: Record<string, string>): HTMLMediaElement {
  const element = document.createElement(block.kind)
  element.className = 'v5-video-media'
  element.setAttribute('controls', '')
  element.setAttribute('preload', 'metadata')
  element.setAttribute('playsinline', '')
  const source = document.createElement('source')
  source.src = block.src
  const type = videoTypeFor(block.src)
  if (type) source.setAttribute('type', type)
  element.append(source)
  applyMediaAttributes(element, block, copy, attributes)
  if (block.start > 0) seekTo(element, block.start)
  // A block that fails to decode falls back to its cover instead of an empty player.
  element.addEventListener('error', () => {
    const preview = element.parentElement
    if (preview) preview.replaceChildren(coverElement({ ...block, reason: 'decode-failed' }, copy))
  })
  return element
}

function applyMediaAttributes(
  element: HTMLMediaElement,
  block: VideoBlock,
  copy: VideoCopy,
  attributes?: Record<string, string>,
): void {
  element.setAttribute('aria-label', block.title ?? (block.kind === 'audio' ? copy.audioTitle : copy.caption))
  if (block.poster) element.setAttribute('poster', block.poster)
  else element.removeAttribute('poster')
  for (const [name, value] of Object.entries(attributes ?? {})) element.setAttribute(name, value)
}

/** Seeks once metadata is in; before that a seek would be dropped. */
function seekTo(element: HTMLMediaElement, second: number): void {
  if (element.readyState >= 1) {
    element.currentTime = second
    return
  }
  element.addEventListener(
    'loadedmetadata',
    () => {
      element.currentTime = second
    },
    { once: true },
  )
}

function syncCaption(preview: HTMLElement, block: VideoBlock): void {
  const existing = preview.querySelector<HTMLElement>(':scope > .v5-video-caption')
  if (!block.title) {
    existing?.remove()
    return
  }
  if (existing) {
    existing.textContent = block.title
    return
  }
  const caption = document.createElement('p')
  caption.className = 'v5-video-caption'
  caption.textContent = block.title
  playerOf(preview)?.after(caption)
}

function refreshStartChip(preview: HTMLElement, block: VideoBlock, copy: VideoCopy, media: HTMLMediaElement): void {
  const existing = preview.querySelector<HTMLButtonElement>(':scope > .v5-video-start')
  if (block.start <= 0) {
    existing?.remove()
    return
  }
  const chip = existing ?? document.createElement('button')
  chip.type = 'button'
  chip.className = 'v5-video-start'
  chip.tabIndex = -1
  const label = copy.play.replace('{time}', formatTime(block.start))
  chip.textContent = formatTime(block.start)
  chip.setAttribute('aria-label', label)
  if (!existing) {
    chip.addEventListener('mousedown', (event) => event.preventDefault())
    chip.addEventListener('click', () => {
      media.currentTime = block.start
      void media.play().catch(() => undefined)
    })
    preview.append(chip)
  }
}

function createRenderer(options: {
  langs: string[]
  copy: VideoCopy
  attributes?: Record<string, string>
}): V5mdBlockRenderer {
  const { copy } = options
  const kindOf = (lang: string): VideoKind => (lang === 'audio' ? 'audio' : 'video')
  return {
    id: 'video',
    lang: options.langs,
    render(ctx: BlockRenderContext) {
      const block = parseVideoBlock(ctx.source, kindOf(ctx.lang))
      const { root, preview } = createFencedWidgetShell(ctx.node, {
        blockClass: `v5-video v5-video-${block.kind}`,
        previewClass: `v5-video-preview v5-video-preview-${block.kind}`,
      })
      paint(preview, block, copy, options.attributes)
      return root
    },
    update(ctx: BlockUpdateContext) {
      paint(ctx.previous, parseVideoBlock(ctx.source, kindOf(ctx.lang)), copy, options.attributes)
    },
    destroy(ctx: BlockDestroyContext) {
      const preview = previewOf(ctx.element)
      const media = preview?.querySelector<HTMLMediaElement>(':scope > .v5-video-media')
      if (media && !media.paused) media.pause()
    },
  }
}

export function createVideoPlugin(options: VideoPluginOptions = {}): V5mdPlugin<VideoApi> {
  const name = options.name ?? 'video'
  const raw = options.lang ?? ['video', 'audio']
  const langs = (Array.isArray(raw) ? raw : [raw]).map((item) => item.trim().toLowerCase()).filter(Boolean)
  const videoLang = langs.find((item) => item !== 'audio') ?? langs[0] ?? 'video'
  const audioLang = langs.find((item) => item === 'audio')
  const copy = COPY[resolveLocale(options.locale)]
  const showToolbar = options.toolbar !== false
  const renderer = createRenderer({ langs, copy, attributes: options.mediaAttributes })

  const fenceFor = (audio: boolean, src: string, blockOptions: VideoBlockOptions): string =>
    fenceBlock(audio && audioLang ? audioLang : videoLang, serializeVideoBlock(src, blockOptions))

  return {
    name,
    blocks: [renderer],
    commands: {
      // `run(src?, options?)`: no src opens an empty fence for typing.
      'video.insert': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: ({ insertText }, src?: unknown, blockOptions?: unknown) => {
          const block = picked(blockOptions)
          return src === undefined || src === null || typeof src === 'string'
            ? insertText(fenceFor(Boolean(block.audio), typeof src === 'string' ? src : '', block))
            : false
        },
      },
    },
    slash: langs.map((item, index) => ({
      id: `video.insert.${item}`,
      command: 'video.insert',
      title: item === 'audio' ? copy.audioTitle : copy.title,
      keywords: item === 'audio' ? ['audio', '音频', '音乐', 'mp3', item] : ['video', '视频', 'mp4', '影片', item],
      order: 65 + index,
    })),
    toolbar: showToolbar
      ? [
          {
            id: 'video.insert',
            command: 'video.insert',
            label: copy.title,
            icon: VIDEO_ICON,
            group: 'insert',
            order: 56,
          },
          ...(audioLang
            ? [
                {
                  id: 'video.insert.audio',
                  command: 'video.insert',
                  label: copy.audioTitle,
                  icon: AUDIO_ICON,
                  group: 'insert',
                  order: 57,
                },
              ]
            : []),
        ]
      : undefined,
    api: (context) => ({
      insert(src, blockOptions = {}) {
        if (!src.trim()) return false
        return context.insertText(fenceFor(Boolean(blockOptions.audio), src, blockOptions))
      },
    }),
  }
}

function picked(value: unknown): VideoBlockOptions {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    poster: typeof record.poster === 'string' ? record.poster : undefined,
    title: typeof record.title === 'string' ? record.title : undefined,
    start: typeof record.start === 'number' ? record.start : undefined,
    audio: record.audio === true,
  }
}
