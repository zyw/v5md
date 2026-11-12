<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import { createExportPlugin, type ExportApi } from '@v5md/plugin-export'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
import { createTypographyPlugin, type TypographyApi } from '@v5md/plugin-typography'
import { detectPlaygroundLocale, playgroundCopy, type PlaygroundLocale } from '@v5md/playground-ui'
import '@v5md/view/theme.css'

const SCROLL_TOP_THRESHOLD = 320

const locale = ref<PlaygroundLocale>(detectPlaygroundLocale())
const copy = computed(() => playgroundCopy(locale.value))
const markdown = ref(copy.value.sample)
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
const showScrollTop = ref(false)

const plugins = computed(() => {
  const lang = locale.value
  return [
    createTypographyPlugin({ defaultSize: 17 }),
    createExportPlugin({ title: copy.value.exportTitle, locale: lang }),
    createMermaidPlugin({ locale: lang }),
    createMindmapPlugin({ locale: lang }),
    createEchartsPlugin({ locale: lang }),
  ]
})

watch(locale, (next) => {
  markdown.value = playgroundCopy(next).sample
  exportStatus.value = ''
})

function setLocale(next: PlaygroundLocale) {
  if (locale.value === next) return
  locale.value = next
}

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
  exportStatus.value = copy.value.exporting
  try {
    if (kind === 'markdown') exporter.value.downloadMarkdown(copy.value.exportFile('md'))
    else if (kind === 'html') await exporter.value.downloadHtml(copy.value.exportFile('html'))
    else if (kind === 'image') await exporter.value.downloadImage(copy.value.exportFile('png'))
    else await exporter.value.downloadPdf(copy.value.exportFile('pdf'))
    exportStatus.value = copy.value.exported
  } catch (error) {
    exportStatus.value = error instanceof Error ? error.message : copy.value.exportFailed
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

function onWindowScroll() {
  showScrollTop.value = window.scrollY > SCROLL_TOP_THRESHOLD
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  onWindowScroll()
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll)
})
</script>

<template>
  <main class="page">
    <div class="atmosphere" aria-hidden="true" />
    <header class="topbar">
      <div class="masthead">
        <div class="brand">
          <img class="brand-lockup" src="/brand/v5md-horizontal-color.svg" alt="v5md" height="44" />
          <p class="tagline">{{ copy.tagline }}</p>
        </div>
        <div class="masthead-side">
          <div class="masthead-meta">
            <span class="playground-badge">{{ copy.badge('Vue') }}</span>
            <div class="lang-switch" role="group" :aria-label="copy.langGroup">
              <button
                type="button"
                class="chip chip-lang"
                :aria-pressed="locale === 'zh-CN'"
                @click="setLocale('zh-CN')"
              >
                {{ copy.langZh }}
              </button>
              <button type="button" class="chip chip-lang" :aria-pressed="locale === 'en'" @click="setLocale('en')">
                {{ copy.langEn }}
              </button>
            </div>
          </div>
          <p class="status">
            {{ preview ? copy.modePreview : sourceMode ? copy.modeSource : copy.modeWysiwyg }}
            · {{ copy.fontSize(fontSize) }}
            <span v-if="exportStatus"> · {{ exportStatus }}</span>
          </p>
        </div>
      </div>
      <div class="controls">
        <div class="control-group" role="group" :aria-label="copy.view">
          <button type="button" class="chip" :aria-pressed="showOutline" @click="toggleOutline">
            {{ copy.outline }}
          </button>
          <button type="button" class="chip" :aria-pressed="showToolbar" @click="toggleToolbar">
            {{ copy.toolbar }}
          </button>
          <button type="button" class="chip" :aria-pressed="preview" @click="togglePreview">
            {{ preview ? copy.edit : copy.preview }}
          </button>
          <button type="button" class="chip" :aria-pressed="sourceMode" @click="toggleSource">
            {{ copy.source }}
          </button>
          <button
            type="button"
            class="chip"
            :aria-pressed="showLineNumbers"
            :disabled="!sourceMode"
            @click="toggleLineNumbers"
          >
            {{ copy.lineNumbers }}
          </button>
        </div>
        <div class="control-group" role="group" :aria-label="copy.pin">
          <button
            type="button"
            class="chip"
            :aria-pressed="toolbarSticky"
            :disabled="!showToolbar"
            @click="toggleToolbarSticky"
          >
            {{ copy.pinToolbar }}
          </button>
          <button
            type="button"
            class="chip"
            :aria-pressed="outlineSticky"
            :disabled="!showOutline"
            @click="toggleOutlineSticky"
          >
            {{ copy.pinOutline }}
          </button>
        </div>
        <div class="control-group" role="group" :aria-label="copy.editGroup">
          <button type="button" class="chip" @click="editor?.undo()">{{ copy.undo }}</button>
          <button type="button" class="chip" @click="editor?.redo()">{{ copy.redo }}</button>
          <button type="button" class="chip" @click="editor?.openFind()">{{ copy.find }}</button>
        </div>
        <div class="control-group" role="group" :aria-label="copy.fontGroup">
          <button type="button" class="chip" :disabled="fontSize <= 12" @click="changeFontSize(fontSize - 1)">
            A−
          </button>
          <span class="chip-label">{{ fontSize }}</span>
          <button type="button" class="chip" :disabled="fontSize >= 28" @click="changeFontSize(fontSize + 1)">
            A+
          </button>
        </div>
        <div class="control-group control-group-export" role="group" :aria-label="copy.exportGroup">
          <button type="button" class="chip" @click="exportFile('markdown')">MD</button>
          <button type="button" class="chip" @click="exportFile('html')">HTML</button>
          <button type="button" class="chip" @click="exportFile('pdf')">PDF</button>
          <button type="button" class="chip" @click="exportFile('image')">{{ copy.image }}</button>
        </div>
      </div>
    </header>
    <section class="workspace">
      <V5Editor
        :key="locale"
        v-model="markdown"
        :locale="locale"
        :placeholder="copy.placeholder"
        :editable="!preview"
        :plugins="plugins"
        :on-upload-image="onUploadImage"
        :on-ready="onReady"
      />
    </section>
    <button
      type="button"
      class="scroll-top"
      :class="{ 'is-visible': showScrollTop }"
      :aria-label="locale === 'en' ? 'Back to top' : '回到顶部'"
      :tabindex="showScrollTop ? 0 : -1"
      @click="scrollToTop"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M12 5.5 5.8 11.7l1.4 1.4L11 9.3V19h2V9.3l3.8 3.8 1.4-1.4z" />
      </svg>
    </button>
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

:root {
  --ink: #0b1220;
  --muted: #5b6b64;
  --line: #d7e0db;
  --panel: rgba(255, 255, 255, 0.78);
  --panel-solid: #fbfdfb;
  --accent: #0f766e;
  --accent-soft: #d8eee9;
  --mist: #f0fdfa;
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
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.atmosphere {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(900px 480px at 8% -10%, #cfe8e0 0%, transparent 55%),
    radial-gradient(700px 420px at 100% 0%, #99f6e4 0%, transparent 48%),
    linear-gradient(180deg, #f0fdfa 0%, #e8efeb 100%);
}

.topbar {
  display: grid;
  gap: 14px;
  margin-bottom: 18px;
  padding: 18px 18px 16px;
  border: 1px solid rgb(15 118 110 / 12%);
  border-radius: 20px;
  background: linear-gradient(
    135deg,
    rgb(240 253 250 / 92%) 0%,
    rgb(255 255 255 / 88%) 48%,
    rgb(255 255 255 / 78%) 100%
  );
  backdrop-filter: blur(16px);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 90%) inset,
    var(--shadow);
}

.masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  flex-wrap: wrap;
}

.brand {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.brand-lockup {
  display: block;
  height: 44px;
  width: auto;
  max-width: min(280px, 72vw);
}

.tagline {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.masthead-side {
  display: grid;
  gap: 8px;
  justify-items: end;
  text-align: right;
}

.masthead-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.playground-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border: 1px solid rgb(15 118 110 / 22%);
  border-radius: 999px;
  background: rgb(15 118 110 / 8%);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgb(20 32 28 / 8%);
  border-radius: 999px;
  background: linear-gradient(180deg, rgb(255 255 255 / 92%), rgb(255 255 255 / 72%));
}

.status {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.controls {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 2px;
  border-top: 1px solid rgb(15 118 110 / 10%);
  overflow: hidden;
}

.control-group {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
  padding: 4px;
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
  padding: 7px 10px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
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

.chip-lang {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
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

.control-group-export .chip {
  color: var(--ink);
}

.control-group-export .chip:hover:not(:disabled) {
  background: rgb(194 65 12 / 8%);
  color: #9a3412;
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

.scroll-top {
  appearance: none;
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 1px solid rgb(11 84 78 / 28%);
  border-radius: 14px;
  background: linear-gradient(180deg, #178378, #0f766e);
  color: #fff;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 22%) inset,
    0 12px 28px rgb(15 118 110 / 28%);
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.scroll-top.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.scroll-top:hover {
  background: linear-gradient(180deg, #1a9184, #11857c);
}

.scroll-top:focus-visible {
  outline: 2px solid rgb(15 118 110 / 45%);
  outline-offset: 3px;
}

@media (max-width: 720px) {
  .page {
    padding: 20px 14px 36px;
  }

  .topbar {
    padding: 14px;
    border-radius: 16px;
  }

  .masthead {
    align-items: flex-start;
  }

  .masthead-side {
    justify-items: start;
    text-align: left;
    width: 100%;
  }

  .masthead-meta {
    justify-content: flex-start;
  }

  .brand-lockup {
    height: 38px;
  }

  .controls {
    flex-wrap: nowrap;
  }

  .control-group {
    flex-wrap: nowrap;
  }
}
</style>
