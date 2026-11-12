// Test-only surface.
//
// Tests import the public entry (`../src/index.ts`) for anything a consumer can
// reach. A few helpers have no public equivalent but still deserve precise unit
// tests (rendering, selection chrome, source tokens, the shortcut table, the
// toolbar controller). They are re-exported here so that a refactor of the
// internal layout touches this one file instead of every test.
export { applyChrome } from '../src/editor/selection.ts'
export { BlockHost, BlockRendererRegistry, blockInstanceKey, hashSource } from '../src/editor/blocks.ts'
export { createFencedWidgetShell, renderDocument } from '../src/editor/render.ts'
export { markdownSpans, sourceLines } from '../src/editor/source.ts'
export { runShortcut, type KeymapHost } from '../src/editor/keymap.ts'
export { createToolbarController } from '../src/chrome/toolbar.ts'
export { BUILTIN_COMMAND_IDS, BUILTIN_TOOLBAR_IDS, BUILTIN_TOOLBAR_ITEMS } from '../src/chrome/builtins.ts'
