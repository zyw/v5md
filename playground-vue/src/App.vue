<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'
import { createTypographyPlugin, type TypographyApi } from '@v5md/plugin-typography'
import { sample } from '@v5md/sample'
import '@v5md/view/theme.css'

const markdown = ref(sample)
const editor = shallowRef<Editor | null>(null)
const typography = shallowRef<TypographyApi | null>(null)
const exporter = shallowRef<ExportApi | null>(null)
const sourceMode = ref(false)
const preview = ref(false)
const showOutline = ref(true)
const showToolbar = ref(true)
const showLineNumbers = ref(true)
const fontSize = ref(17)
const exportStatus = ref('')
const plugins = [createTypographyPlugin({ defaultSize: 17 }), createExportPlugin({ title: 'v5md 示例' })]

function onReady(instance: Editor) {
  editor.value = instance
  typography.value = instance.getPlugin<TypographyApi>('typography')?.api ?? null
  exporter.value = instance.getPlugin<ExportApi>('export')?.api ?? null
}

function changeFontSize(next: number) {
  const size = Math.min(28, Math.max(12, next))
  fontSize.value = size
  typography.value?.setFontSize(size)
}

async function exportFile(kind: 'markdown' | 'html' | 'image' | 'pdf') {
  if (!exporter.value) return
  exportStatus.value = '导出中…'
  try {
    if (kind === 'markdown') exporter.value.downloadMarkdown('v5md-示例.md')
    else if (kind === 'html') await exporter.value.downloadHtml('v5md-示例.html')
    else if (kind === 'image') await exporter.value.downloadImage('v5md-示例.png')
    else await exporter.value.downloadPdf('v5md-示例.pdf')
    exportStatus.value = '已导出'
  } catch (error) {
    exportStatus.value = error instanceof Error ? error.message : '导出失败'
  }
}

function toggleSource() {
  sourceMode.value = !sourceMode.value
  editor.value?.setSourceMode(sourceMode.value)
  if (sourceMode.value) preview.value = false
}

function togglePreview() {
  preview.value = !preview.value
  if (preview.value && sourceMode.value) {
    sourceMode.value = false
    editor.value?.setSourceMode(false)
  }
}

function toggleOutline() {
  showOutline.value = !showOutline.value
  editor.value?.setOutlineVisible(showOutline.value)
}

function toggleToolbar() {
  showToolbar.value = !showToolbar.value
  editor.value?.setToolbarVisible(showToolbar.value)
}

function toggleLineNumbers() {
  showLineNumbers.value = !showLineNumbers.value
  editor.value?.setLineNumbersVisible(showLineNumbers.value)
}

function onUploadImage(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <main class="page">
    <header>
      <div>
        <p class="eyebrow">Vue</p>
        <h1>v5md</h1>
      </div>
      <div class="actions">
        <div class="toolbar">
          <button type="button" :aria-pressed="showOutline" @click="toggleOutline">大纲</button>
          <button type="button" :aria-pressed="showToolbar" @click="toggleToolbar">工具条</button>
          <button type="button" @click="editor?.undo()">撤销</button>
          <button type="button" @click="editor?.redo()">重做</button>
          <button type="button" @click="editor?.openFind()">查找</button>
          <button type="button" @click="toggleSource">{{ sourceMode ? '所见即所得' : '源码模式' }}</button>
          <button type="button" :aria-pressed="showLineNumbers" :disabled="!sourceMode" @click="toggleLineNumbers">
            行号
          </button>
          <button type="button" :aria-pressed="preview" @click="togglePreview">
            {{ preview ? '退出预览' : '预览' }}
          </button>
          <button type="button" :disabled="fontSize <= 12" @click="changeFontSize(fontSize - 1)">A-</button>
          <button type="button" :disabled="fontSize >= 28" @click="changeFontSize(fontSize + 1)">A+</button>
          <button type="button" @click="exportFile('markdown')">导出 MD</button>
          <button type="button" @click="exportFile('html')">导出 HTML</button>
          <button type="button" @click="exportFile('pdf')">导出 PDF</button>
          <button type="button" @click="exportFile('image')">导出图片</button>
        </div>
        <p class="hint">
          工具条和大纲可以分别显示或隐藏。源码模式会给 Markdown
          着色并显示行号。预览模式会关闭正文编辑，但待办复选框仍可切换。 字号和导出按钮由插件提供，当前字号
          {{ fontSize }}px。
          <span v-if="exportStatus"> · {{ exportStatus }}</span>
        </p>
      </div>
    </header>
    <section class="workspace">
      <V5Editor
        v-model="markdown"
        placeholder="开始编写…"
        :editable="!preview"
        :plugins="plugins"
        :on-upload-image="onUploadImage"
        :on-ready="onReady"
      />
      <pre class="source">{{ markdown }}</pre>
    </section>
  </main>
</template>

<style>
:root {
  color: #1f1f1f;
  background: #f5f5f4;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

body {
  margin: 0;
}

.page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}

header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: end;
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

header h1 {
  margin: 0;
  font-size: 28px;
}

.hint {
  margin: 0;
  color: #6b7280;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.toolbar button {
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #fff;
  padding: 6px 10px;
  cursor: pointer;
  font: inherit;
}

.toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, 0.7fr);
  gap: 16px;
  align-items: start;
}

.v5md-host {
  width: 100%;
  min-width: 0;
  min-height: 70vh;
  padding: 0 0 20px;
  border: 1px solid #e7e5e4;
  background: #fff;
  box-shadow: 0 12px 40px rgb(0 0 0 / 4%);
}

.source {
  min-height: 70vh;
  margin: 0;
  padding: 20px;
  overflow: auto;
  border-radius: 16px;
  background: #1c1917;
  color: #f5f5f4;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
