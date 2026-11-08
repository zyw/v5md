import { Editor, type EditorOptions, type FindRequest } from '@v5md/view'
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'

export const V5Editor = defineComponent({
  name: 'V5Editor',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    onUploadImage: {
      type: Function as PropType<EditorOptions['onUploadImage']>,
      default: undefined,
    },
    onPickImage: {
      type: Function as PropType<EditorOptions['onPickImage']>,
      default: undefined,
    },
    onReady: {
      type: Function as PropType<(editor: Editor) => void>,
      default: undefined,
    },
    onFindRequest: {
      type: Function as PropType<(request: FindRequest) => void>,
      default: undefined,
    },
    editable: { type: Boolean, default: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, attrs }) {
    const host = ref<HTMLElement | null>(null)
    let editor: Editor | null = null

    onMounted(() => {
      if (!host.value) return
      editor = new Editor({
        element: host.value,
        value: props.modelValue,
        placeholder: props.placeholder,
        onUploadImage: (file) => {
          const upload = props.onUploadImage
          return upload ? upload(file) : ''
        },
        onPickImage: () => {
          const pick = props.onPickImage
          return pick ? pick() : false
        },
        onFindRequest: (request) => {
          const find = props.onFindRequest
          if (find) find(request)
          else editor?.openFind()
        },
        editable: props.editable,
        onChange(markdown) {
          emit('update:modelValue', markdown)
        },
      })
      props.onReady?.(editor)
    })

    watch(
      () => props.modelValue,
      (value) => {
        if (editor && value !== editor.getMarkdown()) editor.setMarkdown(value)
      },
    )

    watch(
      () => props.editable,
      (editable) => editor?.setEditable(editable),
    )

    watch(
      () => props.placeholder,
      (placeholder) => editor?.setPlaceholder(placeholder),
    )

    onBeforeUnmount(() => {
      editor?.destroy()
      editor = null
    })

    return () => h('div', { ...attrs, ref: host, class: ['v5md-host', attrs.class] })
  },
})
