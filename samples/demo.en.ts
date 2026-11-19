export const sample = `---
title: v5md handbook and plugin guide
author: playground
version: 0.0.7
tags: [markdown, editor, handbook, plugin]
---

# v5md handbook

This sample document is itself an editable guide: jump from the outline, try the toolbar and shortcuts. **The Markdown string is the only source of truth**—store it, diff it, or hand it to another renderer and you always get standard Markdown.

> Tip: skim **Feature tour** first to see what the editor can do, then wire it up with **Getting started**. For toolbar or chart extensions, jump to **Plugin development**.

## Contents

1. [Feature tour](#feature-tour) — live samples of inline marks, blocks, math, and charts
2. [Getting started](#getting-started) — install and wire Vue / React / vanilla
3. [Editing and views](#editing-and-views) — toolbar, shortcuts, outline, source, find, export
4. [Official plugins](#official-plugins) — typography, export, Mermaid, Mindmap, ECharts
5. [Plugin development](#plugin-development) — commands, toolbar, slash menu, block renderers
6. [FAQ](#faq)

---

# Feature tour

Every section below is real Markdown. Markers appear when the caret enters a node.

## Paragraphs and inline marks

Common marks can be layered inside a paragraph: **bold**, *italic*, <u>underline</u>, ~~strikethrough~~, ==highlight==, \`inline code\`, and [links](https://v5md.v5ai.xin).

They can also stack: ***bold italic***, **~~bold strike~~**, \`code\` next to ==emphasis==. Autolinks are written <https://v5md.v5ai.xin>.

Soft break with \`Shift+Enter\`: the two lines below belong to one paragraph, split by a hard break.\\
Second line of the same paragraph.

Escapes: \\*not italic\\*, \`not code\`.

## Headings

\`Mod+1\` / \`Mod+2\` / \`Mod+3\` toggle H1–H3; deeper levels are handwritten \`####\`.

### Heading 3

A keyword inside a paragraph can be marked ==as a highlight==.

#### Heading 4

Good for a subsection note.

##### Heading 5

One level deeper.

###### Heading 6

The finest heading level.

## Lists

Unordered list:

- First item
- Second item
  - Nested item A
  - Nested item B
- Third item

Ordered list:

1. Parse Markdown
2. Render DOM
   1. Apply the theme
   2. Mount plugin blocks
3. Restore the caret

## Task list

Checkboxes stay clickable in preview mode.

- [x] GFM task lists
- [x] Clickable in preview mode
- [ ] Write a release note
- [ ] Tidy the plugin docs

## Quote

> Quotes keep links and inline marks, such as **emphasis** and the [docs site](https://v5md.v5ai.xin).
>
> > Nested quotes work for sources or asides.

## Table

Column alignment (left / center / right). Selecting a table reveals the row and column bar; \`Tab\` / \`Shift+Tab\` move between cells.

| Language | Role | Version |
| :--- | :---: | ---: |
| TypeScript | Editor core | 5.9 |
| Markdown | Only source of truth | GFM |
| Vue / React | Thin framework shell | 3 / 18 |

## Rule

Body text above, media and math below.

---

## Images

Default image:

![v5md hero](/brand/hero-readme-zh.png)

Sized form (drag to resize; uploads go through \`onUploadImage\`):

![v5md logo](/brand/v5md-horizontal-color-2400.png =480x)

## Math

Inline math such as mass–energy equivalence $E=mc^2$ and the Pythagorean theorem $a^2+b^2=c^2$.

Display block:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
=
\\begin{pmatrix}
1 & 0 \\\\
0 & 1
\\end{pmatrix}
$$

## Code blocks

Fenced code is syntax highlighted; click a chart fence to edit its source, then click away to return to the preview.

\`\`\`ts
import { Editor } from '@v5md/view'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import '@v5md/view/theme.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# Hello v5md',
  toolbar: true,
  outline: true,
  plugins: [createMermaidPlugin()],
  onUploadImage: (file) => URL.createObjectURL(file),
})

console.log(editor.getMarkdown())
\`\`\`

\`\`\`bash
npm install @v5md/view @v5md/plugin-mermaid
\`\`\`

\`\`\`json
{
  "name": "v5md-demo",
  "private": true,
  "type": "module"
}
\`\`\`

## Flowchart (Mermaid)

Type \`/\` to open the slash menu and search for “flowchart”, or use the toolbar button.

\`\`\`mermaid
flowchart TB
  subgraph Input
    A[Paste / typing / toolbar / slash]
  end
  subgraph Core
    B[Markdown string]
    C[parse AST]
    D[render DOM]
  end
  subgraph Extensions
    E[Mermaid]
    F[Mindmap]
    G[ECharts]
  end
  A --> B --> C --> D
  D --> E
  D --> F
  D --> G
\`\`\`

## Sequence diagram (Mermaid)

\`\`\`mermaid
sequenceDiagram
  actor U as User
  participant E as Editor
  participant P as Plugin
  U->>E: typing / command / slash
  E->>E: commit + render
  E->>P: hydrate(source)
  P-->>E: SVG / Canvas
  E-->>U: preview
  U->>E: click the block to edit
  E-->>U: edit the fence body
\`\`\`

## Video and audio (Video)

The fence language is \`video\` / \`audio\`; the body is the source address, and the same line can carry title, poster, and start time.

\`\`\`video
src=/samples/v5md-simple.mp4 poster=/samples/v5md-simple.poster.jpg title="v5md handbook · feature demo"
\`\`\`

> \`poster\` only decides the frame shown before playback; pressing play switches to the real mp4. The address is a direct link and the fence syntax stays the same.

## Mindmap

The fence language is \`mindmap\`; the body is a Markdown heading tree.

\`\`\`mindmap
# v5md
## Data model
### Markdown is the only source
### No private JSON
## Editing experience
### Markers appear on demand
### IME-friendly input
### Paste converts first
## Plugin ecosystem
### Mermaid flowcharts
### Mindmap diagrams
### ECharts charts
### Typography / export
\`\`\`

## Bar chart (ECharts)

The fence body must be a **JSON option** (it never executes JS).

\`\`\`echarts
{
  "title": { "text": "Quarterly revenue", "left": "center" },
  "tooltip": { "trigger": "axis" },
  "legend": { "bottom": 0 },
  "grid": { "left": 48, "right": 24, "top": 56, "bottom": 48 },
  "xAxis": {
    "type": "category",
    "data": ["Q1", "Q2", "Q3", "Q4"]
  },
  "yAxis": { "type": "value", "name": "k USD" },
  "series": [
    {
      "name": "Product A",
      "type": "bar",
      "barGap": "20%",
      "data": [126, 208, 164, 192],
      "itemStyle": { "borderRadius": [6, 6, 0, 0], "color": "#0f766e" }
    },
    {
      "name": "Product B",
      "type": "bar",
      "data": [84, 118, 156, 210],
      "itemStyle": { "borderRadius": [6, 6, 0, 0], "color": "#c2410c" }
    }
  ]
}
\`\`\`

## Line chart

\`\`\`echarts
{
  "title": { "text": "Weekly active users", "left": "center" },
  "tooltip": { "trigger": "axis" },
  "legend": { "bottom": 0 },
  "grid": { "left": 48, "right": 24, "top": 56, "bottom": 48 },
  "xAxis": {
    "type": "category",
    "boundaryGap": false,
    "data": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  "yAxis": { "type": "value", "name": "users" },
  "series": [
    {
      "name": "Desktop",
      "type": "line",
      "smooth": true,
      "symbol": "circle",
      "symbolSize": 8,
      "areaStyle": { "opacity": 0.12 },
      "data": [820, 932, 901, 1134, 1290, 1330, 1420],
      "itemStyle": { "color": "#0f766e" }
    },
    {
      "name": "Mobile",
      "type": "line",
      "smooth": true,
      "symbol": "circle",
      "symbolSize": 8,
      "areaStyle": { "opacity": 0.12 },
      "data": [620, 732, 801, 934, 1090, 1230, 1320],
      "itemStyle": { "color": "#c2410c" }
    }
  ]
}
\`\`\`

## Pie chart

\`\`\`echarts
{
  "title": { "text": "Traffic sources", "left": "center" },
  "tooltip": { "trigger": "item", "formatter": "{b}: {c} ({d}%)" },
  "legend": { "orient": "vertical", "left": "left", "top": "middle" },
  "series": [
    {
      "name": "Source",
      "type": "pie",
      "radius": ["42%", "68%"],
      "center": ["58%", "52%"],
      "avoidLabelOverlap": true,
      "itemStyle": { "borderRadius": 8, "borderColor": "#fff", "borderWidth": 2 },
      "label": { "formatter": "{b}\\n{d}%" },
      "data": [
        { "value": 1048, "name": "Search", "itemStyle": { "color": "#0f766e" } },
        { "value": 735, "name": "Direct", "itemStyle": { "color": "#c2410c" } },
        { "value": 580, "name": "Email", "itemStyle": { "color": "#a16207" } },
        { "value": 484, "name": "Affiliates", "itemStyle": { "color": "#1d4ed8" } },
        { "value": 300, "name": "Social", "itemStyle": { "color": "#be123c" } }
      ]
    }
  ]
}
\`\`\`

## Radar chart

\`\`\`echarts
{
  "title": { "text": "Editor capability radar", "left": "center" },
  "tooltip": {},
  "legend": { "bottom": 0, "data": ["v5md", "Others"] },
  "radar": {
    "indicator": [
      { "name": "WYSIWYG", "max": 100 },
      { "name": "CJK input", "max": 100 },
      { "name": "Plugins", "max": 100 },
      { "name": "Export", "max": 100 },
      { "name": "Bundle size", "max": 100 },
      { "name": "Embedding", "max": 100 }
    ],
    "radius": "58%"
  },
  "series": [
    {
      "type": "radar",
      "data": [
        {
          "name": "v5md",
          "value": [92, 95, 88, 86, 78, 90],
          "areaStyle": { "opacity": 0.18 },
          "itemStyle": { "color": "#0f766e" }
        },
        {
          "name": "Others",
          "value": [80, 70, 85, 90, 72, 75],
          "areaStyle": { "opacity": 0.12 },
          "itemStyle": { "color": "#78716c" }
        }
      ]
    }
  ]
}
\`\`\`

---

# Getting started

## Install

Import the theme once in your app, or you get structure without typography:

\`\`\`ts
import '@v5md/view/theme.css'
\`\`\`

\`\`\`bash
# Vue 3
npm install vue @v5md/vue

# React
npm install react react-dom @v5md/react

# Vanilla JS / other frameworks
npm install @v5md/view

# Parse only, no UI
npm install @v5md/core

# Official plugins are opt-in (not bundled with the editor)
npm install @v5md/plugin-typography @v5md/plugin-export \\
  @v5md/plugin-mermaid @v5md/plugin-mindmap @v5md/plugin-echarts @v5md/plugin-video
\`\`\`

| Package | When to install it |
| --- | --- |
| \`@v5md/vue\` | Vue 3 projects |
| \`@v5md/react\` | React 18 / 19 |
| \`@v5md/view\` | Calling \`new Editor()\` directly |
| \`@v5md/core\` | Parsing / outline only, no UI |
| \`@v5md/plugin-*\` | Typography, export, diagrams, charts |

## Vue 3

\`\`\`vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import '@v5md/view/theme.css'

const markdown = ref('# Title\\n')
const editor = shallowRef<Editor | null>(null)
</script>

<template>
  <V5Editor
    v-model="markdown"
    placeholder="Start writing…"
    :plugins="[createMermaidPlugin()]"
    :on-upload-image="(file) => URL.createObjectURL(file)"
    :on-ready="(instance) => (editor = instance)"
  />
</template>
\`\`\`

## React

\`\`\`tsx
import { useState } from 'react'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/react'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import '@v5md/view/theme.css'

export function Page() {
  const [markdown, setMarkdown] = useState('# Title\\n')
  const [, setEditor] = useState<Editor | null>(null)

  return (
    <V5Editor
      value={markdown}
      onChange={setMarkdown}
      plugins={[createEchartsPlugin()]}
      onReady={setEditor}
      onUploadImage={(file) => URL.createObjectURL(file)}
    />
  )
}
\`\`\`

## Vanilla JS

\`\`\`ts
import { Editor } from '@v5md/view'
import { createExportPlugin } from '@v5md/plugin-export'
import '@v5md/view/theme.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# Title\\n\\nBody',
  placeholder: 'Start writing…',
  toolbar: true,
  outline: true,
  toolbarSticky: true,
  outlineSticky: true,
  plugins: [createExportPlugin({ title: 'My document' })],
  onChange(markdown) {
    localStorage.setItem('draft', markdown)
  },
})
\`\`\`

---

# Editing and views

## How it works

\`\`\`text
typing / paste / toolbar / shortcuts / slash menu
        │
        ▼
  change the Markdown string (with undo history)
        │
        ▼
  micromark / mdast parse it into an offset-aware node tree
        │
        ▼
  repaint the document only, then restore the caret offset
\`\`\`

A selection is a pair of string offsets \`{ anchor, head }\`, not a DOM Range.

## Toolbar

| Group | Capability |
| --- | --- |
| Block | Code block, table, image |
| List | Ordered / unordered / task |
| Quote | Toggle quote |
| Heading | H1 / H2 / H3 |
| Insert | Rule, link, math block; plugins add flowchart / mindmap / chart |
| Inline | Inline math, bold, italic, underline, inline code, strikethrough, highlight |
| Action | Copy for WeChat |

When the toolbar is too narrow, buttons collapse into the “more” menu on the right. Type \`/\` to open the slash menu (the official chart plugins register insert items).

## Shortcuts

\`Mod\` is ⌘ on macOS and Ctrl elsewhere.

| Keys | Action |
| --- | --- |
| \`Mod+B\` / \`Mod+I\` / \`Mod+U\` | Bold / italic / underline |
| \`Mod\` + backtick | Inline code |
| \`Mod+~\` or \`Mod+Shift+X\` | Strikethrough |
| \`Mod+=\` or \`Mod+Shift+H\` | Highlight |
| \`Mod+K\` | Link |
| \`Mod+Shift+K\` / \`Mod+Shift+T\` | Code block / table |
| \`Mod+Shift+[\` / \`Mod+Shift+]\` | Ordered / unordered list |
| \`Mod+Shift+O\` / \`Mod+Shift+Q\` | Task list / quote |
| \`Mod+1\` / \`Mod+2\` / \`Mod+3\` | Heading 1 / 2 / 3 |
| \`Mod+Z\` / \`Mod+Shift+Z\` / \`Mod+Y\` | Undo / redo |
| \`Mod+F\` / \`Mod+H\` | Find / replace |
| \`Mod+Shift+S\` | Source mode |
| \`Tab\` / \`Shift+Tab\` | Move between table cells, otherwise indent |
| \`Enter\` / \`Shift+Enter\` | New block / soft break |

## View and state API

| Method | Description |
| --- | --- |
| \`getMarkdown()\` / \`setMarkdown(md)\` | Read / write the whole document |
| \`undo()\` / \`redo()\` | Undo and redo |
| \`format(command)\` | Block-level format commands |
| \`toggleBold()\` and friends | Inline format toggles |
| \`setSourceMode(bool)\` | Whole-document source mode (highlighted, with line numbers) |
| \`setEditable(bool)\` | Read-only preview; tasks stay clickable |
| \`setToolbarVisible\` / \`setOutlineVisible\` | Show / hide the toolbar and outline |
| \`setToolbarSticky\` / \`setOutlineSticky\` | Pin on scroll |
| \`copyForWechat()\` | Copy rich text for WeChat in one call |
| \`runCommand(id, ...args)\` | Run a built-in or plugin command |
| \`use(plugin)\` / \`getPlugin(name)\` | Install a plugin / read its API |

## Find, replace, and paste

- \`Mod+F\` opens find, \`Mod+H\` opens replace; regex and whole-word are supported.
- Rich text copied from a web page, Word, or Feishu is converted to Markdown before it is inserted.
- Images can be dropped or pasted; without \`onUploadImage\` a local Object URL is used.

---

# Official plugins

Plugins are not bundled with \`@v5md/view\`; install them separately and pass them in \`plugins\` or call \`editor.use()\` later.

## Typography

\`\`\`ts
import { createTypographyPlugin } from '@v5md/plugin-typography'

const handle = editor.use(createTypographyPlugin({ defaultSize: 17 }))
handle.api.setFontSize(18)
handle.api.resetFontSize()
\`\`\`

## Export

\`\`\`ts
import { createExportPlugin } from '@v5md/plugin-export'

const exporter = editor.use(createExportPlugin({ title: 'My document' }))
exporter.api.downloadMarkdown('note.md')
await exporter.api.downloadHtml('note.html')
await exporter.api.downloadPdf('note.pdf')
await exporter.api.downloadImage('note.png')
exporter.api.print() // browser print / save as PDF
\`\`\`

## Mermaid / Mindmap / ECharts

| Plugin | Fence language | Toolbar / slash |
| --- | --- | --- |
| \`@v5md/plugin-mermaid\` | \`mermaid\` | On by default; disable with \`toolbar: false\` |
| \`@v5md/plugin-mindmap\` | \`mindmap\` | Same |
| \`@v5md/plugin-echarts\` | \`echarts\` | Same; the body is a JSON option |
| \`@v5md/plugin-video\` | \`video\` / \`audio\` | Same; the body is an address or a \`src=\` line |

\`\`\`ts
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
import { createEchartsPlugin } from '@v5md/plugin-echarts'
import { createVideoPlugin } from '@v5md/plugin-video'

const editor = new Editor({
  element,
  plugins: [
    createMermaidPlugin(),
    createMindmapPlugin(),
    createEchartsPlugin({ height: 360 }),
    createVideoPlugin(),
  ],
})

await editor.runCommand('mermaid.insert')
await editor.runCommand('mindmap.insert')
await editor.runCommand('echarts.insert')
await editor.runCommand('video.insert', 'https://cdn.example.com/clip.mp4')
\`\`\`

Click a preview block to edit its source; blur or leave the active state to return to the preview.

---

# Plugin development

A plugin is trusted local code: it contributes commands, toolbar items, slash entries, block renderers, and a typed API. The full design lives in \`docs/plugin-design.md\` and \`docs/plugin-block-render.md\`.

## Minimal plugin

\`\`\`ts
import type { V5mdPlugin } from '@v5md/view'

interface WordCountApi {
  count(): number
}

export function createWordCountPlugin(): V5mdPlugin<WordCountApi> {
  return {
    name: 'word-count',
    version: '0.1.0',
    apiVersion: 1,
    api: (context) => ({
      count: () => context.editor.getMarkdown().replace(/\\s+/g, '').length,
    }),
  }
}
\`\`\`

| Field | Description |
| --- | --- |
| \`name\` | Required and unique |
| \`apiVersion\` | Must equal \`PLUGIN_API_VERSION\` (currently \`1\`) |
| \`requires\` | Names of plugins this one depends on |
| \`commands\` | Command table |
| \`toolbar\` | Toolbar buttons |
| \`slash\` | \`/\` menu items |
| \`blocks\` | Custom fenced-block renderers |
| \`api\` | Public API |
| \`setup\` / \`destroy\` | Lifecycle |

## Commands and toolbar

\`\`\`ts
import type { V5mdPlugin } from '@v5md/view'

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6.5v11M13 8.5h6.5M13 12h5M13 15.5h6.5"/></svg>'

export function createQuoteButtonPlugin(): V5mdPlugin {
  return {
    name: 'quote-button',
    commands: {
      'quote.toggle': {
        isEnabled: (state) => !state.sourceMode,
        run: ({ editor }) => editor.format('quote'),
      },
    },
    toolbar: [
      {
        command: 'quote.toggle',
        label: 'Quote',
        icon: ICON,
        group: 'quote',
        order: 20,
        type: 'toggle',
        isActive: (state) => state.path.some((node) => node.type === 'blockquote'),
        isDisabled: (state) => !state.editable,
      },
    ],
    slash: [
      {
        id: 'quote.toggle',
        command: 'quote.toggle',
        title: 'Quote',
        keywords: ['quote', '引用'],
      },
    ],
  }
}
\`\`\`

A command \`context\` exposes \`editor\`, \`host\`, \`state\`, \`insertText\`, \`replaceSelection\`, \`wrapSelection\`, and \`focus\`. Use \`state.path\` to tell whether the caret sits inside a quote, list, or table.

Built-in groups: \`block\` / \`list\` / \`quote\` / \`heading\` / \`insert\` / \`inline\` / \`action\`. Do not shadow built-in command ids such as \`bold\`, \`heading1\`, or \`wechat\`.

## Custom block rendering

Use \`blocks\` to take over the fence with a given \`lang\`. The host keys instances by

\`rendererId:lang:hash(source):occurrence\`

and calls \`hydrate\` / \`update\` / \`destroy\`.

\`\`\`ts
import {
  createFencedWidgetShell,
  type V5mdPlugin,
} from '@v5md/view'

export function createDemoBlockPlugin(): V5mdPlugin {
  return {
    name: 'demo-block',
    blocks: [
      {
        id: 'demo',
        lang: 'demo',
        render(ctx) {
          const { root, preview } = createFencedWidgetShell(ctx.node, {
            blockClass: 'v5-demo',
            placeholder: 'Drawing…',
          })
          preview.dataset.source = ctx.source
          return root
        },
        async hydrate(ctx) {
          if (!ctx.isCurrent() || ctx.signal.aborted) return
          const preview = ctx.element.querySelector<HTMLElement>('[data-void="widget"]')
          if (preview) preview.textContent = ctx.source
        },
      },
    ],
  }
}
\`\`\`

Conventions:

- The preview slot uses \`data-void="widget"\` and \`contentEditable="false"\`.
- Inactive blocks show the preview, active blocks show source (\`createFencedWidgetShell\` handles both).
- Lookup order: plugin registry first, then a plain code block.
- Check \`ctx.isCurrent()\` and honour \`ctx.signal\` before any async DOM write.

## Lifecycle and constraints

\`\`\`text
new Editor({ plugins }) → install (validate name / apiVersion / requires / id)
editor.use(plugin)      → install → setup
handle.ready            → available once setup's Promise resolves
handle.dispose()        → cleanup → destroy → rebuild the toolbar
editor.destroy()        → unload every plugin in reverse order
\`\`\`

- Plugin names, command ids, toolbar ids, and block renderer \`id\` / \`lang\` must be globally unique.
- \`context.state\` is a snapshot; holding it long-term goes stale, so read live data from \`context.editor\`.
- \`toolbar.shortcut\` is metadata only for now and does not register a real shortcut.

## Theme overrides

Built-in themes: \`paper\` (default), \`github\`, \`nord\`, \`tokyo-night\`, \`catppuccin\`. Pass \`theme\` at creation or call \`editor.setTheme('nord')\`.

Write every selector from \`.v5md\`; prefer changing CSS variables (such as \`--v5-link\`) for colour. Only change colour, font size, and spacing. Do not touch indentation, \`display\`, or pseudo-element \`content\`, or the caret will drift.

\`\`\`css
.v5md {
  --v5-link: #0f766e;
}

.v5md .v5-doc {
  font-size: 16px;
  line-height: 1.8;
}
\`\`\`

---

# FAQ

**What do I store?** The Markdown string from \`onChange\` / \`v-model\` is the whole document.

**Read-only?** \`editable: false\`. Math and charts still render, and tasks stay clickable.

**How do images attach?** \`onUploadImage(file)\` returns a URL or \`Promise<string>\`; use \`onPickImage\` to take over the library.

**Can I customise the toolbar?** Write a plugin that only supplies \`toolbar\`, or call \`setToolbarVisible(false)\` and drive \`runCommand\` yourself.

**SSR?** The module imports fine, but the editor only mounts in the browser (Vue \`onMounted\` / React \`useEffect\`).

**Can content be corrupted?** Only the fragments you actually edit are rewritten; untouched content is preserved as-is.

---

At this point the handbook has covered v5md's main editing features, official plugins, and extension points. Keep rewriting this document, inserting charts, or exporting it—all three exercise the same data path: **edit Markdown → parse → repaint**.
`
