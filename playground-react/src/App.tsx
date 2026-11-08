import { useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import { sample } from '@v5md/sample'
import '@v5md/view/theme.css'

export function App() {
  const [markdown, setMarkdown] = useState(sample)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [sourceMode, setSourceMode] = useState(false)
  const [preview, setPreview] = useState(false)
  const [showOutline, setShowOutline] = useState(true)
  const [showToolbar, setShowToolbar] = useState(true)
  const [showLineNumbers, setShowLineNumbers] = useState(true)

  return (
    <main className="page">
      <header>
        <div>
          <p className="eyebrow">React</p>
          <h1>v5md</h1>
        </div>
        <div className="actions">
          <div className="toolbar">
            <button
              type="button"
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
              aria-pressed={showToolbar}
              onClick={() => {
                const next = !showToolbar
                setShowToolbar(next)
                editor?.setToolbarVisible(next)
              }}
            >
              工具条
            </button>
            <button type="button" onClick={() => editor?.undo()}>
              撤销
            </button>
            <button type="button" onClick={() => editor?.redo()}>
              重做
            </button>
            <button type="button" onClick={() => editor?.openFind()}>
              查找
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !sourceMode
                setSourceMode(next)
                editor?.setSourceMode(next)
                if (next) setPreview(false)
              }}
            >
              {sourceMode ? '所见即所得' : '源码模式'}
            </button>
            <button
              type="button"
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
            <button
              type="button"
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
              {preview ? '退出预览' : '预览'}
            </button>
          </div>
          <p className="hint">工具条和大纲可以分别显示或隐藏。源码模式会给 Markdown 着色并显示行号。预览模式会关闭正文编辑，但待办复选框仍可切换。</p>
        </div>
      </header>
      <section className="workspace">
        <V5Editor
          value={markdown}
          onChange={setMarkdown}
          placeholder="开始编写…"
          editable={!preview}
          onReady={setEditor}
          onUploadImage={(file) =>
            new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.readAsDataURL(file)
            })
          }
        />
        <pre className="source">{markdown}</pre>
      </section>
    </main>
  )
}
