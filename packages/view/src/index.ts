import 'katex/dist/katex.min.css'

export { Editor } from './editor/editor.js'
export type { EditorOptions, FindRequest } from './editor/editor.js'
export {
  DEFAULT_LOCALE,
  getMessages,
  normalizeLocale,
  resolveLocale,
} from './i18n/index.js'
export type { LocaleCode, LocaleMessages } from './i18n/index.js'
export { createOutline } from './chrome/outline.js'
export type { OutlinePanel } from './chrome/outline.js'
export { createToolbar, createToolbarFromItems } from './chrome/toolbar.js'
export type { ToolbarCommand } from './chrome/toolbar.js'
export { htmlToMarkdown } from './convert/html-to-md.js'
export { copyRichText, toWechatHtml } from './convert/wechat.js'
export type { WechatHtmlOptions } from './convert/wechat.js'
export { BUILTIN_SLASH_COMMAND_IDS, PLUGIN_API_VERSION, PluginRegistry } from './plugin.js'
export type {
  BlockDestroyContext,
  BlockHydrateContext,
  BlockRenderContext,
  BlockUpdateContext,
  PluginRegistration,
  SlashItemView,
  ToolbarItemView,
  V5mdBlockRenderer,
  V5mdCommand,
  V5mdCommandContext,
  V5mdPlugin,
  V5mdPluginHandle,
  V5mdPluginState,
  V5mdSlashItem,
  V5mdToolbarItem,
} from './plugin.js'
export { blockInstanceKey, hashSource, normalizeBlockLang } from './editor/blocks.js'
export { createFencedWidgetShell } from './editor/render.js'
