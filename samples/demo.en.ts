export const sample = `---
title: v5md handbook and plugin guide
author: playground
version: 0.0.4
tags: [markdown, editor, handbook, plugin]
---

# v5md handbook

This sample document is an editable guide: jump from the outline, try the toolbar and shortcuts. **The Markdown string is the only source of truth**—store it, diff it, or hand it to another renderer.

> Tip: skim **Feature tour** first, then **Getting started**. For toolbar or chart extensions, jump to **Plugin development**.

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

Common marks: **bold**, *italic*, <u>underline</u>, ~~strikethrough~~, ==highlight==, \`inline code\`, and [links](https://v5md.v5ai.xin).

Combined: ***bold italic***, **~~bold strike~~**, \`code\` next to ==emphasis==. Autolink: <https://v5md.v5ai.xin>.

Soft break with \`Shift+Enter\`:\\
same paragraph, second line.

Escapes: \\*not italic\\*, \\\`not code\\\`.

## Headings

\`Mod+1\` / \`Mod+2\` / \`Mod+3\` toggle H1–H3; deeper levels are handwritten \`####\`.

### Heading 3

#### Heading 4

## Lists

- Bullet A
- Bullet B
  - Nested
1. Ordered one
2. Ordered two
- [ ] Todo
- [x] Done

## Quote, rule, code

> Quotes keep nested Markdown.

---

\`\`\`ts
export const greeting = 'hello v5md'
\`\`\`

## Table

| Language | Role |
| --- | --- |
| TypeScript | Editor |
| Markdown | Source of truth |

## Math

Inline $E=mc^2$. Block:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Mermaid / Mindmap / ECharts

\`\`\`mermaid
graph LR
  A[Markdown] --> B[Editor]
  B --> C[Preview]
\`\`\`

\`\`\`mindmap
# Central topic
## Branch A
### Detail 1
## Branch B
\`\`\`

\`\`\`echarts
{
  "title": { "text": "Quarterly revenue", "left": "center" },
  "xAxis": { "type": "category", "data": ["Q1", "Q2", "Q3", "Q4"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [120, 200, 150, 80] }]
}
\`\`\`

---

# Getting started

\`\`\`bash
npm install vue @v5md/vue
npm install react react-dom @v5md/react
npm install @v5md/view
\`\`\`

Import the theme once: \`import '@v5md/view/theme.css'\`.

---

# Editing and views

- Outline jumps to headings.
- Source mode shows the full Markdown with line numbers.
- Find / replace supports regex and whole-word.
- Export plugin can download Markdown, HTML, PDF, or image.

---

# Official plugins

Install separately: \`@v5md/plugin-typography\`, \`@v5md/plugin-export\`, \`@v5md/plugin-mermaid\`, \`@v5md/plugin-mindmap\`, \`@v5md/plugin-echarts\`.

---

# Plugin development

Plugins may contribute toolbar items, slash entries, commands, and fenced-code block renderers. Keep ids unique.

---

# FAQ

**What do I store?** The Markdown string from \`onChange\` / \`v-model\`.

**Read-only?** \`editable: false\`.

**IME?** Composition does not re-render the DOM, so Chinese input stays stable.
`
