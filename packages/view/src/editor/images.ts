interface ImageDragState {
  pointerId: number
  startX: number
  width: number
  height: number
  keepHeight: boolean
  img: HTMLImageElement
}

export interface ImageResizeOptions {
  host: HTMLElement
  isEnabled(): boolean
  onResize(width: number, height: number | undefined): void
}

/** Drags the corner handle of an image and commits the new width when released. */
export class ImageResize {
  private drag: ImageDragState | null = null

  constructor(private readonly options: ImageResizeOptions) {}

  get active(): boolean {
    return this.drag !== null
  }

  pointerDown(event: PointerEvent): void {
    const target = event.target
    if (!(target instanceof Element) || !this.options.isEnabled() || this.drag) return
    const handle = target.closest('.v5-image-resize')
    if (!handle || !this.options.host.contains(handle)) return
    const img = handle.closest('.v5-image')?.querySelector('img')
    if (!(img instanceof HTMLImageElement)) return
    const rect = img.getBoundingClientRect()
    const width = Number(img.dataset.width || 0) || rect.width
    const height = Number(img.dataset.height || 0) || rect.height
    if (width < 1) return
    event.preventDefault()
    event.stopPropagation()
    try {
      handle.setPointerCapture?.(event.pointerId)
    } catch {
      // The document listeners still follow the pointer.
    }
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      width,
      height: height || width,
      keepHeight: img.dataset.height != null && img.dataset.height !== '',
      img,
    }
  }

  pointerMove(event: PointerEvent): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const nextWidth = resizedWidth(drag.width, event.clientX - drag.startX)
    drag.img.style.width = `${nextWidth}px`
    drag.img.style.maxWidth = '100%'
    drag.img.style.height = 'auto'
    if (drag.keepHeight) drag.img.style.aspectRatio = `${nextWidth} / ${resizedHeight(drag, nextWidth)}`
  }

  pointerUp(event: PointerEvent): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    this.drag = null
    if (Math.round(event.clientX - drag.startX) === 0) return
    const nextWidth = resizedWidth(drag.width, event.clientX - drag.startX)
    const nextHeight = drag.keepHeight ? resizedHeight(drag, nextWidth) : undefined
    this.options.onResize(nextWidth, nextHeight)
  }
}

function resizedWidth(start: number, delta: number): number {
  return Math.min(4096, Math.max(16, Math.round(start + delta)))
}

function resizedHeight(drag: { width: number; height: number }, nextWidth: number): number {
  return Math.min(4096, Math.max(16, Math.round((nextWidth * drag.height) / drag.width)))
}
