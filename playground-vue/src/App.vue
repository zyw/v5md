<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
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
const toolbarSticky = ref(true)
const outlineSticky = ref(true)
const showLineNumbers = ref(true)
const fontSize = ref(17)
const exportStatus = ref('')
const plugins = [
  createTypographyPlugin({ defaultSize: 17 }),
  createExportPlugin({ title: 'v5md 示例' }),
  createMermaidPlugin(),
  createMindmapPlugin(),
  createEchartsPlugin(),
]

function onReady(instance: Editor) {
  editor.value = instance
  typography.value = instance.getPlugin<TypographyApi>('typography')?.api ?? null
  exporter.value = instance.getPlugin<ExportApi>('export')?.api ?? null
  instance.setToolbarSticky(toolbarSticky.value)
  instance.setOutlineSticky(outlineSticky.value)
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

function toggleToolbarSticky() {
  toolbarSticky.value = !toolbarSticky.value
  editor.value?.setToolbarSticky(toolbarSticky.value)
}

function toggleOutlineSticky() {
  outlineSticky.value = !outlineSticky.value
  editor.value?.setOutlineSticky(outlineSticky.value)
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
    <div class="atmosphere" aria-hidden="true" />
    <header class="topbar">
      <div class="brand">
        <p class="eyebrow">Playground · Vue</p>
        <h1>v5md</h1>
        <p class="tagline">Markdown 即数据 · 所见即所得</p>
      </div>
      <div class="controls">
        <div class="control-group" role="group" aria-label="视图">
          <button type="button" class="chip" :aria-pressed="showOutline" @click="toggleOutline">大纲</button>
          <button type="button" class="chip" :aria-pressed="showToolbar" @click="toggleToolbar">工具条</button>
          <button type="button" class="chip" :aria-pressed="preview" @click="togglePreview">
            {{ preview ? '编辑' : '预览' }}
          </button>
          <button type="button" class="chip" :aria-pressed="sourceMode" @click="toggleSource">源码</button>
          <button
            type="button"
            class="chip"
            :aria-pressed="showLineNumbers"
            :disabled="!sourceMode"
            @click="toggleLineNumbers"
          >
            行号
          </button>
        </div>
        <div class="control-group" role="group" aria-label="钉顶">
          <button
            type="button"
            class="chip"
            :aria-pressed="toolbarSticky"
            :disabled="!showToolbar"
            @click="toggleToolbarSticky"
          >
            钉工具条
          </button>
          <button
            type="button"
            class="chip"
            :aria-pressed="outlineSticky"
            :disabled="!showOutline"
            @click="toggleOutlineSticky"
          >
            钉大纲
          </button>
        </div>
        <div class="control-group" role="group" aria-label="编辑">
          <button type="button" class="chip" @click="editor?.undo()">撤销</button>
          <button type="button" class="chip" @click="editor?.redo()">重做</button>
          <button type="button" class="chip" @click="editor?.openFind()">查找</button>
        </div>
        <div class="control-group" role="group" aria-label="字号">
          <button type="button" class="chip" :disabled="fontSize <= 12" @click="changeFontSize(fontSize - 1)">
            A−
          </button>
          <span class="chip-label">{{ fontSize }}</span>
          <button type="button" class="chip" :disabled="fontSize >= 28" @click="changeFontSize(fontSize + 1)">
            A+
          </button>
        </div>
        <div class="control-group" role="group" aria-label="导出">
          <button type="button" class="chip" @click="exportFile('markdown')">MD</button>
          <button type="button" class="chip" @click="exportFile('html')">HTML</button>
          <button type="button" class="chip" @click="exportFile('pdf')">PDF</button>
          <button type="button" class="chip" @click="exportFile('image')">图片</button>
        </div>
      </div>
      <p class="status">
        {{ preview ? '只读预览' : sourceMode ? '源码模式' : '所见即所得' }}
        · 字号 {{ fontSize }}px
        <span v-if="exportStatus"> · {{ exportStatus }}</span>
      </p>
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
    </section>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap');

:root {
  --ink: #14201c;
  --muted: #5b6b64;
  --line: #d7e0db;
  --panel: rgba(255, 255, 255, 0.78);
  --panel-solid: #fbfdfb;
  --accent: #0f766e;
  --accent-soft: #d8eee9;
  --shadow: 0 18px 50px rgb(20 32 28 / 8%);
  color: var(--ink);
  background: #eef3f0;
  font-family: 'Plus Jakarta Sans', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

* {
  box-sizing: border-box;
}

html {
  overflow-x: clip;
}

body {
  margin: 0;
  min-height: 100vh;
  overflow-x: clip;
}

.page {
  position: relative;
  isolation: isolate;
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.atmosphere {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(900px 480px at 8% -10%, #cfe8e0 0%, transparent 55%),
    radial-gradient(700px 420px at 100% 0%, #f3e7d7 0%, transparent 50%),
    linear-gradient(180deg, #f4f7f5 0%, #e8efeb 100%);
}

.topbar {
  display: grid;
  gap: 16px;
  margin-bottom: 18px;
}

.brand {
  display: grid;
  gap: 4px;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.brand h1 {
  margin: 0;
  font-family: 'Source Serif 4', 'Songti SC', serif;
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
}

.tagline {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.control-group {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px;
  border: 1px solid rgb(20 32 28 / 8%);
  border-radius: 14px;
  background: linear-gradient(180deg, rgb(255 255 255 / 92%), rgb(255 255 255 / 72%));
  backdrop-filter: blur(14px);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 90%) inset,
    0 8px 20px rgb(20 32 28 / 5%);
}

.chip {
  appearance: none;
  position: relative;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  padding: 8px 13px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.chip:hover:not(:disabled) {
  color: var(--ink);
  background: rgb(15 118 110 / 7%);
}

.chip:active:not(:disabled) {
  transform: translateY(1px);
}

.chip[aria-pressed='true'] {
  color: #fff;
  background: linear-gradient(180deg, #178378, #0f766e);
  border-color: rgb(11 84 78 / 35%);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 22%) inset,
    0 6px 14px rgb(15 118 110 / 28%);
}

.chip[aria-pressed='true']:hover:not(:disabled) {
  color: #fff;
  background: linear-gradient(180deg, #1a9184, #11857c);
}

.chip:disabled,
.chip[aria-pressed='true']:disabled {
  cursor: not-allowed;
  color: rgb(91 107 100 / 45%);
  background: rgb(20 32 28 / 4%);
  border-color: transparent;
  box-shadow: none;
  opacity: 1;
}

.chip:focus-visible {
  outline: 2px solid rgb(15 118 110 / 45%);
  outline-offset: 2px;
}

.chip-label {
  min-width: 2.4ch;
  margin: 0 2px;
  padding: 5px 8px;
  border-radius: 7px;
  background: rgb(15 118 110 / 8%);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.control-group[aria-label='导出'] .chip {
  color: var(--ink);
}

.control-group[aria-label='导出'] .chip:hover:not(:disabled) {
  background: rgb(194 65 12 / 8%);
  color: #9a3412;
}

.status {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.workspace {
  min-width: 0;
}

.v5md-host {
  width: 100%;
  min-width: 0;
  min-height: 70vh;
  /* clip rounds the square toolbar corners without creating a scrollport,
     so toolbar/outline sticky can still pin to the page scroll. */
  overflow: clip;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel-solid);
  box-shadow: var(--shadow);
}

.v5md-host > .v5md {
  border-radius: 18px;
}

@media (max-width: 720px) {
  .page {
    padding: 20px 14px 36px;
  }

  .brand h1 {
    font-size: 2.2rem;
  }

  .control-group {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
