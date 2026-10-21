import { memo, useCallback, useEffect, useRef } from 'react'
import { Editor, type EditorOptions } from '@v5md/view'

export interface V5EditorProps {
  value: string
  onChange?: (markdown: string) => void
  placeholder?: string
  className?: string
  onUploadImage?: EditorOptions['onUploadImage']
  onReady?: (editor: Editor) => void
}

const Frame = memo(function Frame({
  hostRef,
  className,
}: {
  hostRef: (element: HTMLDivElement | null) => void
  className?: string
}) {
  return <div ref={hostRef} className={className} />
})

export function V5Editor({ value, onChange, placeholder, onUploadImage, onReady, className }: V5EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  const uploadRef = useRef(onUploadImage)
  const readyRef = useRef(onReady)
  onChangeRef.current = onChange
  uploadRef.current = onUploadImage
  readyRef.current = onReady
  const setHost = useCallback((element: HTMLDivElement | null) => {
    hostRef.current = element
  }, [])

  useEffect(() => {
    const element = hostRef.current
    if (!element) return
    const editor = new Editor({
      element,
      value,
      placeholder,
      onChange(markdown) {
        onChangeRef.current?.(markdown)
      },
      onUploadImage(file) {
        const upload = uploadRef.current
        return upload ? upload(file) : ''
      },
    })
    editorRef.current = editor
    readyRef.current?.(editor)
    return () => {
      editor.destroy()
      editorRef.current = null
    }
    // The editor owns the DOM after mount. Later value changes go through the effect below.
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (value !== editor.getMarkdown()) editor.setMarkdown(value)
  }, [value])

  return <Frame className={['v5md-host', className].filter(Boolean).join(' ')} hostRef={setHost} />
}
