import { useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
import { createTypographyPlugin, type TypographyApi } from '@v5md/plugin-typography'
import { sample } from '@v5md/sample'
import '@v5md/view/theme.css'

const plugins = [
  createTypographyPlugin({ defaultSize: 17 }),
  createExportPlugin({ title: 'v5md 示例' }),
  createMermaidPlugin(),
  createMindmapPlugin(),
  createEchartsPlugin(),
]

export function App() {
  const [markdown, setMarkdown] = useState(sample)
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

  function changeFontSize(next: number) {
    const size = Math.min(28, Math.max(12, next))
    setFontSize(size)
    typography?.setFontSize(size)
  }

  async function exportFile(kind: 'markdown' | 'html' | 'image' | 'pdf') {
    if (!exporter) return
    setExportStatus('导出中…')
    try {
      if (kind === 'markdown') exporter.downloadMarkdown('v5md-示例.md')
      else if (kind === 'html') await exporter.downloadHtml('v5md-示例.html')
      else if (kind === 'image') await exporter.downloadImage('v5md-示例.png')
      else await exporter.downloadPdf('v5md-示例.pdf')
      setExportStatus('已导出')
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : '导出失败')
    }
  }

  const modeLabel = preview ? '只读预览' : sourceMode ? '源码模式' : '所见即所得'

  return (
    <main className="page">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Playground · React</p>
          <h1>v5md</h1>
          <p className="tagline">Markdown 即数据 · 所见即所得</p>
        </div>
        <div className="controls">
          <div className="control-group" role="group" aria-label="视图">
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
              大纲
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
              工具条
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
              {preview ? '编辑' : '预览'}
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
              源码
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
              行号
            </button>
          </div>
          <div className="control-group" role="group" aria-label="钉顶">
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
              钉工具条
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
              钉大纲
            </button>
          </div>
          <div className="control-group" role="group" aria-label="编辑">
            <button type="button" className="chip" onClick={() => editor?.undo()}>
              撤销
            </button>
            <button type="button" className="chip" onClick={() => editor?.redo()}>
              重做
            </button>
            <button type="button" className="chip" onClick={() => editor?.openFind()}>
              查找
            </button>
          </div>
          <div className="control-group" role="group" aria-label="字号">
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
          <div className="control-group" role="group" aria-label="导出">
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
              图片
            </button>
          </div>
        </div>
        <p className="status">
          {modeLabel} · 字号 {fontSize}px
          {exportStatus ? ` · ${exportStatus}` : ''}
        </p>
      </header>
      <section className="workspace">
        <V5Editor
          value={markdown}
          onChange={setMarkdown}
          placeholder="开始编写…"
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
    </main>
  )
}
