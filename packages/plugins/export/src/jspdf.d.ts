declare module 'jspdf' {
  export interface JsPdfOptions {
    unit?: string
    format?: string
    orientation?: 'portrait' | 'landscape'
  }

  export class jsPDF {
    constructor(options?: JsPdfOptions)
    readonly internal: {
      pageSize: {
        getWidth(): number
        getHeight(): number
      }
    }
    addPage(): void
    addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void
    output(type: 'blob'): Blob
  }
}
