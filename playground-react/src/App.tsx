import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
import { createTypographyPlugin, type TypographyApi } from '@v5md/plugin-typography'
import { detectPlaygroundLocale, playgroundCopy, type PlaygroundLocale } from '@v5md/playground-ui'
import '@v5md/view/theme.css'

const SCROLL_TOP_THRESHOLD = 320

export function App() {
  const [locale, setLocale] = useState<PlaygroundLocale>(() => detectPlaygroundLocale())
  const copy = useMemo(() => playgroundCopy(locale), [locale])
  const [markdown, setMarkdown] = useState(copy.sample)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [typography, setTypography] = useState<TypographyApi | null>(null)
  const [exporter, setExporter] = useState<ExportApi | null>(null)
  const [sourceMode, setSourceMode] = useState(false)
  const [preview, setPreview] = useState(false)
  const [showOutline, setShowOutline] = useState(true)
  const [showToolbar, setShowToolbar] = useState(true)
  const [toolbarSticky, setToolbarSticky] = useState(true)
  const [outlineSticky, setOutlineSticky] = useState(true)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [fontSize, setFontSize] = useState(17)
  const [exportStatus, setExportStatus] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)

  const plugins = useMemo(
    () => [
      createTypographyPlugin({ defaultSize: 17 }),
      createExportPlugin({ title: copy.exportTitle, locale }),
      createMermaidPlugin({ locale }),
      createMindmapPlugin({ locale }),
      createEchartsPlugin({ locale }),
    ],
    [copy.exportTitle, locale],
  )

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function changeLocale(next: PlaygroundLocale) {
    if (next === locale) return
    setLocale(next)
    setMarkdown(playgroundCopy(next).sample)
    setExportStatus('')
  }

  function changeFontSize(next: number) {
    const size = Math.min(28, Math.max(12, next))
    setFontSize(size)
    typography?.setFontSize(size)
  }

  async function exportFile(kind: 'markdown' | 'html' | 'image' | 'pdf') {
    if (!exporter) return
    setExportStatus(copy.exporting)
    try {
      if (kind === 'markdown') exporter.downloadMarkdown(copy.exportFile('md'))
      else if (kind === 'html') await exporter.downloadHtml(copy.exportFile('html'))
      else if (kind === 'image') await exporter.downloadImage(copy.exportFile('png'))
      else await exporter.downloadPdf(copy.exportFile('pdf'))
      setExportStatus(copy.exported)
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : copy.exportFailed)
    }
  }

  const modeLabel = preview ? copy.modePreview : sourceMode ? copy.modeSource : copy.modeWysiwyg

  return (
    <main className="page">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <div className="masthead">
          <div className="brand">
            <img className="brand-lockup" src="/brand/v5md-horizontal-color.svg" alt="v5md" height={44} />
            <p className="tagline">{copy.tagline}</p>
          </div>
          <div className="masthead-side">
            <div className="masthead-meta">
              <span className="playground-badge">{copy.badge('React')}</span>
              <div className="lang-switch" role="group" aria-label={copy.langGroup}>
                <button
                  type="button"
                  className="chip chip-lang"
                  aria-pressed={locale === 'zh-CN'}
                  onClick={() => changeLocale('zh-CN')}
                >
                  {copy.langZh}
                </button>
                <button
                  type="button"
                  className="chip chip-lang"
                  aria-pressed={locale === 'en'}
                  onClick={() => changeLocale('en')}
                >
                  {copy.langEn}
                </button>
              </div>
            </div>
            <p className="status">
              {modeLabel} · {copy.fontSize(fontSize)}
              {exportStatus ? ` · ${exportStatus}` : ''}
            </p>
          </div>
        </div>
        <div className="controls">
          <div className="control-group" role="group" aria-label={copy.view}>
            <button
              type="button"
              className="chip"
              aria-pressed={showOutline}
              onClick={() => {
                const next = !showOutline
                setShowOutline(next)
                editor?.setOutlineVisible(next)
              }}
            >
              {copy.outline}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={showToolbar}
              onClick={() => {
                const next = !showToolbar
                setShowToolbar(next)
                editor?.setToolbarVisible(next)
              }}
            >
              {copy.toolbar}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={preview}
              onClick={() => {
                const next = !preview
                setPreview(next)
                if (next && sourceMode) {
                  setSourceMode(false)
                  editor?.setSourceMode(false)
                }
              }}
            >
              {preview ? copy.edit : copy.preview}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={sourceMode}
              onClick={() => {
                const next = !sourceMode
                setSourceMode(next)
                editor?.setSourceMode(next)
                if (next) setPreview(false)
              }}
            >
              {copy.source}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={showLineNumbers}
              disabled={!sourceMode}
              onClick={() => {
                const next = !showLineNumbers
                setShowLineNumbers(next)
                editor?.setLineNumbersVisible(next)
              }}
            >
              {copy.lineNumbers}
            </button>
          </div>
          <div className="control-group" role="group" aria-label={copy.pin}>
            <button
              type="button"
              className="chip"
              aria-pressed={toolbarSticky}
              disabled={!showToolbar}
              onClick={() => {
                const next = !toolbarSticky
                setToolbarSticky(next)
                editor?.setToolbarSticky(next)
              }}
            >
              {copy.pinToolbar}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={outlineSticky}
              disabled={!showOutline}
              onClick={() => {
                const next = !outlineSticky
                setOutlineSticky(next)
                editor?.setOutlineSticky(next)
              }}
            >
              {copy.pinOutline}
            </button>
          </div>
          <div className="control-group" role="group" aria-label={copy.editGroup}>
            <button type="button" className="chip" onClick={() => editor?.undo()}>
              {copy.undo}
            </button>
            <button type="button" className="chip" onClick={() => editor?.redo()}>
              {copy.redo}
            </button>
            <button type="button" className="chip" onClick={() => editor?.openFind()}>
              {copy.find}
            </button>
          </div>
          <div className="control-group" role="group" aria-label={copy.fontGroup}>
            <button
              type="button"
              className="chip"
              disabled={fontSize <= 12}
              onClick={() => changeFontSize(fontSize - 1)}
            >
              A−
            </button>
            <span className="chip-label">{fontSize}</span>
            <button
              type="button"
              className="chip"
              disabled={fontSize >= 28}
              onClick={() => changeFontSize(fontSize + 1)}
            >
              A+
            </button>
          </div>
          <div className="control-group control-group-export" role="group" aria-label={copy.exportGroup}>
            <button type="button" className="chip" onClick={() => exportFile('markdown')}>
              MD
            </button>
            <button type="button" className="chip" onClick={() => exportFile('html')}>
              HTML
            </button>
            <button type="button" className="chip" onClick={() => exportFile('pdf')}>
              PDF
            </button>
            <button type="button" className="chip" onClick={() => exportFile('image')}>
              {copy.image}
            </button>
          </div>
        </div>
      </header>
      <section className="workspace">
        <V5Editor
          key={locale}
          value={markdown}
          onChange={setMarkdown}
          locale={locale}
          placeholder={copy.placeholder}
          editable={!preview}
          plugins={plugins}
          onReady={(instance) => {
            setEditor(instance)
            setTypography(instance.getPlugin<TypographyApi>('typography')?.api ?? null)
            setExporter(instance.getPlugin<ExportApi>('export')?.api ?? null)
            instance.setToolbarSticky(toolbarSticky)
            instance.setOutlineSticky(outlineSticky)
          }}
          onUploadImage={(file) =>
            new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.readAsDataURL(file)
            })
          }
        />
      </section>
      <button
        type="button"
        className={`scroll-top${showScrollTop ? ' is-visible' : ''}`}
        aria-label={locale === 'en' ? 'Back to top' : '回到顶部'}
        tabIndex={showScrollTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 5.5 5.8 11.7l1.4 1.4L11 9.3V19h2V9.3l3.8 3.8 1.4-1.4z" />
        </svg>
      </button>
    </main>
  )
}
