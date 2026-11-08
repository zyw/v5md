import { memo, useCallback, useEffect, useRef } from 'react'
import { Editor, type EditorOptions } from '@v5md/view'

export interface V5EditorProps {
  value: string
  onChange?: (markdown: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
  onUploadImage?: EditorOptions['onUploadImage']
  onPickImage?: EditorOptions['onPickImage']
  onFindRequest?: EditorOptions['onFindRequest']
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

export function V5Editor({
  value,
  onChange,
  placeholder,
  onUploadImage,
  onPickImage,
  onFindRequest,
  onReady,
  editable = true,
  className,
}: V5EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  const uploadRef = useRef(onUploadImage)
  const pickRef = useRef(onPickImage)
  const findRef = useRef(onFindRequest)
  const readyRef = useRef(onReady)
  onChangeRef.current = onChange
  uploadRef.current = onUploadImage
  pickRef.current = onPickImage
  findRef.current = onFindRequest
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
      editable,
      onChange(markdown) {
        onChangeRef.current?.(markdown)
      },
      onUploadImage(file) {
        const upload = uploadRef.current
        return upload ? upload(file) : ''
      },
      onPickImage() {
        const pick = pickRef.current
        if (!pick) return false
        return pick()
      },
      onFindRequest(request) {
        const find = findRef.current
        if (find) find(request)
        else editorRef.current?.openFind()
      },
    })
    editorRef.current = editor
    readyRef.current?.(editor)
    return () => {
      editor.destroy()
      editorRef.current = null
    }
    // The editor owns the DOM after mount. Later prop changes go through the effects below.
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (value !== editor.getMarkdown()) editor.setMarkdown(value)
  }, [value])

  useEffect(() => {
    editorRef.current?.setEditable(editable)
  }, [editable])

  useEffect(() => {
    editorRef.current?.setPlaceholder(placeholder ?? '')
  }, [placeholder])

  return <Frame className={['v5md-host', className].filter(Boolean).join(' ')} hostRef={setHost} />
}
