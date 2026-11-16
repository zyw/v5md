import { sample as sampleZh } from './demo.ts'
import { sample as sampleEn } from './demo.en.ts'

export type PlaygroundLocale = 'zh-CN' | 'en'

export type PlaygroundThemeId = 'paper' | 'github' | 'nord' | 'tokyo-night' | 'catppuccin'

export const PLAYGROUND_THEMES: { id: PlaygroundThemeId; labelZh: string; labelEn: string }[] = [
  { id: 'paper', labelZh: 'Paper', labelEn: 'Paper' },
  { id: 'github', labelZh: 'GitHub', labelEn: 'GitHub' },
  { id: 'nord', labelZh: 'Nord', labelEn: 'Nord' },
  { id: 'tokyo-night', labelZh: 'Tokyo Night', labelEn: 'Tokyo Night' },
  { id: 'catppuccin', labelZh: 'Catppuccin', labelEn: 'Catppuccin' },
]

export interface PlaygroundCopy {
  tagline: string
  badge: (framework: 'Vue' | 'React') => string
  modeWysiwyg: string
  modeSource: string
  modePreview: string
  fontSize: (size: number) => string
  themeLabel: (id: PlaygroundThemeId) => string
  view: string
  outline: string
  toolbar: string
  preview: string
  edit: string
  source: string
  lineNumbers: string
  pin: string
  pinToolbar: string
  pinOutline: string
  editGroup: string
  undo: string
  redo: string
  find: string
  fontGroup: string
  themeGroup: string
  exportGroup: string
  image: string
  exporting: string
  exported: string
  exportFailed: string
  exportTitle: string
  exportFile: (ext: string) => string
  placeholder: string
  langGroup: string
  langZh: string
  langEn: string
  sample: string
}

const zh: PlaygroundCopy = {
  tagline: 'Markdown 即数据 · 所见即所得',
  badge: (framework) => `Playground · ${framework}`,
  modeWysiwyg: '所见即所得',
  modeSource: '源码模式',
  modePreview: '只读预览',
  fontSize: (size) => `字号 ${size}px`,
  themeLabel: (id) => PLAYGROUND_THEMES.find((theme) => theme.id === id)?.labelZh ?? id,
  view: '视图',
  outline: '大纲',
  toolbar: '工具条',
  preview: '预览',
  edit: '编辑',
  source: '源码',
  lineNumbers: '行号',
  pin: '钉顶',
  pinToolbar: '钉工具条',
  pinOutline: '钉大纲',
  editGroup: '编辑',
  undo: '撤销',
  redo: '重做',
  find: '查找',
  fontGroup: '字号',
  themeGroup: '主题',
  exportGroup: '导出',
  image: '图片',
  exporting: '导出中…',
  exported: '已导出',
  exportFailed: '导出失败',
  exportTitle: 'v5md 示例',
  exportFile: (ext) => `v5md-示例.${ext}`,
  placeholder: '开始编写…',
  langGroup: '语言',
  langZh: '中文',
  langEn: 'EN',
  sample: sampleZh,
}

const en: PlaygroundCopy = {
  tagline: 'Markdown as data · WYSIWYG',
  badge: (framework) => `Playground · ${framework}`,
  modeWysiwyg: 'WYSIWYG',
  modeSource: 'Source mode',
  modePreview: 'Read-only',
  fontSize: (size) => `Font ${size}px`,
  themeLabel: (id) => PLAYGROUND_THEMES.find((theme) => theme.id === id)?.labelEn ?? id,
  view: 'View',
  outline: 'Outline',
  toolbar: 'Toolbar',
  preview: 'Preview',
  edit: 'Edit',
  source: 'Source',
  lineNumbers: 'Lines',
  pin: 'Pin',
  pinToolbar: 'Pin bar',
  pinOutline: 'Pin nav',
  editGroup: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  find: 'Find',
  fontGroup: 'Font size',
  themeGroup: 'Theme',
  exportGroup: 'Export',
  image: 'Image',
  exporting: 'Exporting…',
  exported: 'Exported',
  exportFailed: 'Export failed',
  exportTitle: 'v5md sample',
  exportFile: (ext) => `v5md-sample.${ext}`,
  placeholder: 'Start writing…',
  langGroup: 'Language',
  langZh: '中文',
  langEn: 'EN',
  sample: sampleEn,
}

export function playgroundCopy(locale: PlaygroundLocale): PlaygroundCopy {
  return locale === 'en' ? en : zh
}

export function detectPlaygroundLocale(): PlaygroundLocale {
  if (typeof navigator === 'undefined') return 'zh-CN'
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('en') ? 'en' : 'zh-CN'
}
