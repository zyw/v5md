import { Editor, type EditorOptions } from '@v5md/view'
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
    onReady: {
      type: Function as PropType<(editor: Editor) => void>,
      default: undefined,
    },
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
        onUploadImage: props.onUploadImage,
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
      () => props.placeholder,
      (placeholder) => {
        if (host.value) host.value.dataset.placeholder = placeholder
      },
    )

    onBeforeUnmount(() => {
      editor?.destroy()
      editor = null
    })

    return () => h('div', { ...attrs, ref: host, class: ['v5md-host', attrs.class] })
  },
})
