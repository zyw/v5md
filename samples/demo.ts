export const sample = `---
title: v5md 使用手册与插件开发
author: playground
version: 0.0.4
tags: [markdown, editor, handbook, plugin]
---

# v5md 使用手册

这份示例文档本身就是一份可编辑的说明书：左侧大纲可跳转，工具条与快捷键都能直接试。**Markdown 字符串是唯一数据源**——存库、diff、交给别的渲染器，拿到的都是标准 Markdown。

> 建议：先浏览「功能速览」确认能力边界，再按「快速开始」接入；要扩展工具条或图表时，跳到「插件开发」。

## 目录导读

1. [功能速览](#功能速览) — 行内格式、块级结构、公式、图表等全部能力的活样本
2. [快速开始](#快速开始) — 安装与 Vue / React / 原生接入
3. [编辑与视图](#编辑与视图) — 工具条、快捷键、大纲、源码、查找、导出
4. [官方插件](#官方插件) — 字号、导出、Mermaid、Mindmap、ECharts
5. [插件开发](#插件开发) — 命令、工具条、斜杠菜单、块渲染
6. [常见问题](#常见问题)

---

# 功能速览

下面每一段都是真实 Markdown，光标移入时会露出源码标记。

## 段落与行内格式

普通段落可叠加常见行内格式：**粗体**、*斜体*、<u>下划线</u>、~~删除线~~、==高亮==、\`行内代码\`，以及 [外链](https://v5md.v5ai.xin)。

也可以叠在一起：***粗斜体***、**~~粗体删除线~~**、\`code\` 旁的 ==重点==。自动链接写作 <https://v5md.v5ai.xin>。

软换行用 \`Shift+Enter\`：下面两行同属一段，中间是硬换行。\\
同一段落的第二行。

转义示例：\\*不是斜体\\*、\\\`不是代码\\\`。

## 标题层级

\`Mod+1\` / \`Mod+2\` / \`Mod+3\` 可切换一到三级标题；更深层级用手写 \`####\`。

### 三级标题

段落中的关键词可以用 ==高亮== 标出。

#### 四级标题

适合小节说明。

##### 五级标题

再往下一级。

###### 六级标题

最细的标题层级。

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套子项 A
  - 嵌套子项 B
- 第三项

有序列表：

1. 解析 Markdown
2. 渲染 DOM
   1. 应用主题
   2. 挂载插件块
3. 同步光标

## 任务列表

预览模式下复选框仍可勾选。

- [x] 支持 GFM 任务列表
- [x] 预览模式下仍可勾选
- [ ] 写一篇发布说明
- [ ] 整理插件文档

## 引用

> 引用可以嵌套链接与行内格式，例如 **强调** 和 [文档站点](https://v5md.v5ai.xin)。
>
> > 这是嵌套引用，适合标注来源或补充说明。

## 表格

对齐示例（左 / 中 / 右）。选中表格后会出现行列工具条，\`Tab\` / \`Shift+Tab\` 在单元格间移动。

| 语言 | 用途 | 版本 |
| :--- | :---: | ---: |
| TypeScript | 编辑器核心 | 5.9 |
| Markdown | 唯一数据源 | GFM |
| Vue / React | 框架薄壳 | 3 / 18 |

## 分割线

上面是正文，下面换一组媒体与公式。

---

## 图片

默认图片：

![v5md hero](/brand/hero-readme-zh.png)

带尺寸写法（可拖拽缩放；上传走 \`onUploadImage\`）：

![v5md logo](/brand/v5md-horizontal-color-2400.png =480x)

## 公式

行内公式如质能方程 $E=mc^2$，以及勾股定理 $a^2+b^2=c^2$。

独立公式块：

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

## 代码块

围栏代码带语法高亮；点击图表类围栏可进入源码再改回预览。

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

## 流程图（Mermaid）

输入 \`/\` 可打开斜杠菜单，搜索「流程图」插入；或点工具条按钮。

\`\`\`mermaid
flowchart TB
  subgraph 输入
    A[粘贴 / 输入 / 工具条 / 斜杠]
  end
  subgraph 核心
    B[Markdown 字符串]
    C[parse AST]
    D[render DOM]
  end
  subgraph 扩展
    E[Mermaid]
    F[Mindmap]
    G[ECharts]
  end
  A --> B --> C --> D
  D --> E
  D --> F
  D --> G
\`\`\`

## 时序图（Mermaid）

\`\`\`mermaid
sequenceDiagram
  actor U as 用户
  participant E as Editor
  participant P as Plugin
  U->>E: 输入 / 命令 / 斜杠
  E->>E: commit + render
  E->>P: hydrate(source)
  P-->>E: SVG / Canvas
  E-->>U: 预览
  U->>E: 点击块进入源码
  E-->>U: 编辑围栏正文
\`\`\`

## 思维导图（Mindmap）

围栏语言为 \`mindmap\`，正文是 Markdown 标题树。

\`\`\`mindmap
# v5md
## 数据模型
### Markdown 唯一源
### 无私有 JSON
## 编辑体验
### 标记按需显形
### 中文输入法友好
### 粘贴即转换
## 插件生态
### Mermaid 流程图
### Mindmap 导图
### ECharts 图表
### 字号 / 导出
\`\`\`

## 柱状图（ECharts）

围栏正文必须是 **JSON option**（不会执行 JS）。

\`\`\`echarts
{
  "title": { "text": "季度营收对比", "left": "center" },
  "tooltip": { "trigger": "axis" },
  "legend": { "bottom": 0 },
  "grid": { "left": 48, "right": 24, "top": 56, "bottom": 48 },
  "xAxis": {
    "type": "category",
    "data": ["Q1", "Q2", "Q3", "Q4"]
  },
  "yAxis": { "type": "value", "name": "万元" },
  "series": [
    {
      "name": "产品 A",
      "type": "bar",
      "barGap": "20%",
      "data": [126, 208, 164, 192],
      "itemStyle": { "borderRadius": [6, 6, 0, 0], "color": "#0f766e" }
    },
    {
      "name": "产品 B",
      "type": "bar",
      "data": [84, 118, 156, 210],
      "itemStyle": { "borderRadius": [6, 6, 0, 0], "color": "#c2410c" }
    }
  ]
}
\`\`\`

## 折线图

\`\`\`echarts
{
  "title": { "text": "周活用户趋势", "left": "center" },
  "tooltip": { "trigger": "axis" },
  "legend": { "bottom": 0 },
  "grid": { "left": 48, "right": 24, "top": 56, "bottom": 48 },
  "xAxis": {
    "type": "category",
    "boundaryGap": false,
    "data": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  },
  "yAxis": { "type": "value", "name": "人" },
  "series": [
    {
      "name": "桌面端",
      "type": "line",
      "smooth": true,
      "symbol": "circle",
      "symbolSize": 8,
      "areaStyle": { "opacity": 0.12 },
      "data": [820, 932, 901, 1134, 1290, 1330, 1420],
      "itemStyle": { "color": "#0f766e" }
    },
    {
      "name": "移动端",
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

## 饼图

\`\`\`echarts
{
  "title": { "text": "流量来源占比", "left": "center" },
  "tooltip": { "trigger": "item", "formatter": "{b}: {c} ({d}%)" },
  "legend": { "orient": "vertical", "left": "left", "top": "middle" },
  "series": [
    {
      "name": "来源",
      "type": "pie",
      "radius": ["42%", "68%"],
      "center": ["58%", "52%"],
      "avoidLabelOverlap": true,
      "itemStyle": { "borderRadius": 8, "borderColor": "#fff", "borderWidth": 2 },
      "label": { "formatter": "{b}\\n{d}%" },
      "data": [
        { "value": 1048, "name": "搜索引擎", "itemStyle": { "color": "#0f766e" } },
        { "value": 735, "name": "直接访问", "itemStyle": { "color": "#c2410c" } },
        { "value": 580, "name": "邮件营销", "itemStyle": { "color": "#a16207" } },
        { "value": 484, "name": "联盟广告", "itemStyle": { "color": "#1d4ed8" } },
        { "value": 300, "name": "社交媒体", "itemStyle": { "color": "#be123c" } }
      ]
    }
  ]
}
\`\`\`

## 雷达图

\`\`\`echarts
{
  "title": { "text": "编辑器能力雷达", "left": "center" },
  "tooltip": {},
  "legend": { "bottom": 0, "data": ["v5md", "竞品"] },
  "radar": {
    "indicator": [
      { "name": "所见即所得", "max": 100 },
      { "name": "中文输入", "max": 100 },
      { "name": "插件扩展", "max": 100 },
      { "name": "导出能力", "max": 100 },
      { "name": "包体积", "max": 100 },
      { "name": "可嵌入性", "max": 100 }
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
          "name": "竞品",
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

# 快速开始

## 安装

主题要在业务代码里引入一次，否则只有结构没有排版：

\`\`\`ts
import '@v5md/view/theme.css'
\`\`\`

\`\`\`bash
# Vue 3
npm install vue @v5md/vue

# React
npm install react react-dom @v5md/react

# 原生 JS / 其他框架
npm install @v5md/view

# 只解析，不画页面
npm install @v5md/core

# 官方插件按需安装（编辑器不会自带）
npm install @v5md/plugin-typography @v5md/plugin-export \\
  @v5md/plugin-mermaid @v5md/plugin-mindmap @v5md/plugin-echarts
\`\`\`

| 包 | 什么时候装 |
| --- | --- |
| \`@v5md/vue\` | Vue 3 项目 |
| \`@v5md/react\` | React 18 / 19 |
| \`@v5md/view\` | 直接 \`new Editor()\` |
| \`@v5md/core\` | 只要解析 / 大纲，不要 UI |
| \`@v5md/plugin-*\` | 字号、导出、流程图、导图、图表 |

## Vue 3

\`\`\`vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Editor } from '@v5md/view'
import { V5Editor } from '@v5md/vue'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import '@v5md/view/theme.css'

const markdown = ref('# 标题\\n')
const editor = shallowRef<Editor | null>(null)
</script>

<template>
  <V5Editor
    v-model="markdown"
    placeholder="开始编写…"
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
  const [markdown, setMarkdown] = useState('# 标题\\n')
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

## 原生 JS

\`\`\`ts
import { Editor } from '@v5md/view'
import { createExportPlugin } from '@v5md/plugin-export'
import '@v5md/view/theme.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# 标题\\n\\n正文',
  placeholder: '开始编写…',
  toolbar: true,
  outline: true,
  toolbarSticky: true,
  outlineSticky: true,
  plugins: [createExportPlugin({ title: '我的文档' })],
  onChange(markdown) {
    localStorage.setItem('draft', markdown)
  },
})
\`\`\`

---

# 编辑与视图

## 工作方式

\`\`\`text
输入 / 粘贴 / 工具条 / 快捷键 / 斜杠菜单
        │
        ▼
  改 Markdown 字符串（带撤销历史）
        │
        ▼
  micromark / mdast 解析成带偏移的节点树
        │
        ▼
  只重绘文档区，并把光标放回对应偏移
\`\`\`

选区用字符串偏移 \`{ anchor, head }\` 表示，不是 DOM Range。

## 工具条一览

| 分组 | 能力 |
| --- | --- |
| 块 | 代码块、表格、图片 |
| 列表 | 有序 / 无序 / 任务 |
| 引用 | 引用切换 |
| 标题 | H1 / H2 / H3 |
| 插入 | 分割线、链接、公式块；插件可插入流程图 / 导图 / 图表 |
| 行内 | 内联公式、粗体、斜体、下划线、行内代码、删除线、高亮 |
| 操作 | 复制到公众号 |

宽度不够时，按钮会收进右侧「更多」菜单。输入 \`/\` 可打开斜杠菜单（官方图表插件已注册插入项）。

## 快捷键

\`Mod\` 在 macOS 上是 ⌘，其他系统是 Ctrl。

| 按键 | 作用 |
| --- | --- |
| \`Mod+B\` / \`Mod+I\` / \`Mod+U\` | 粗体 / 斜体 / 下划线 |
| \`Mod\` + 反引号 | 行内代码 |
| \`Mod+~\` 或 \`Mod+Shift+X\` | 删除线 |
| \`Mod+=\` 或 \`Mod+Shift+H\` | 高亮 |
| \`Mod+K\` | 链接 |
| \`Mod+Shift+K\` / \`Mod+Shift+T\` | 代码块 / 表格 |
| \`Mod+Shift+[\` / \`Mod+Shift+]\` | 有序 / 无序列表 |
| \`Mod+Shift+O\` / \`Mod+Shift+Q\` | 任务列表 / 引用 |
| \`Mod+1\` / \`Mod+2\` / \`Mod+3\` | 一 / 二 / 三级标题 |
| \`Mod+Z\` / \`Mod+Shift+Z\` / \`Mod+Y\` | 撤销 / 重做 |
| \`Mod+F\` / \`Mod+H\` | 查找 / 替换 |
| \`Mod+Shift+S\` | 源码模式 |
| \`Tab\` / \`Shift+Tab\` | 表格内移动单元格，否则缩进 |
| \`Enter\` / \`Shift+Enter\` | 新块 / 软换行 |

## 视图与状态 API

| 方法 | 说明 |
| --- | --- |
| \`getMarkdown()\` / \`setMarkdown(md)\` | 读写全文 |
| \`undo()\` / \`redo()\` | 撤销重做 |
| \`format(command)\` | 块级格式命令 |
| \`toggleBold()\` 等 | 行内格式切换 |
| \`setSourceMode(bool)\` | 整篇源码模式（带高亮与行号） |
| \`setEditable(bool)\` | 只读预览；待办仍可勾选 |
| \`setToolbarVisible\` / \`setOutlineVisible\` | 显示工具条 / 大纲 |
| \`setToolbarSticky\` / \`setOutlineSticky\` | 滚动钉顶 |
| \`copyForWechat()\` | 一键复制公众号富文本 |
| \`runCommand(id, ...args)\` | 执行内置或插件命令 |
| \`use(plugin)\` / \`getPlugin(name)\` | 安装 / 取插件 API |

## 查找替换与粘贴

- \`Mod+F\` 打开查找，\`Mod+H\` 打开替换；支持正则与全词。
- 从网页、Word、飞书复制的富文本会先转成 Markdown 再写入。
- 图片可拖入或粘贴；没有 \`onUploadImage\` 时可用本地 Object URL。

---

# 官方插件

插件不会随 \`@v5md/view\` 自带，需要单独安装并传入 \`plugins\` 或事后 \`editor.use()\`。

## 字号 · typography

\`\`\`ts
import { createTypographyPlugin } from '@v5md/plugin-typography'

const handle = editor.use(createTypographyPlugin({ defaultSize: 17 }))
handle.api.setFontSize(18)
handle.api.resetFontSize()
\`\`\`

## 导出 · export

\`\`\`ts
import { createExportPlugin } from '@v5md/plugin-export'

const exporter = editor.use(createExportPlugin({ title: '我的文档' }))
exporter.api.downloadMarkdown('note.md')
await exporter.api.downloadHtml('note.html')
await exporter.api.downloadPdf('note.pdf')
await exporter.api.downloadImage('note.png')
exporter.api.print() // 浏览器打印 / 另存 PDF
\`\`\`

## Mermaid / Mindmap / ECharts

| 插件 | 围栏语言 | 工具条 / 斜杠 |
| --- | --- | --- |
| \`@v5md/plugin-mermaid\` | \`mermaid\` | 默认开启，可 \`toolbar: false\` 关掉 |
| \`@v5md/plugin-mindmap\` | \`mindmap\` | 同上 |
| \`@v5md/plugin-echarts\` | \`echarts\` | 同上；正文为 JSON option |

\`\`\`ts
import { createMermaidPlugin } from '@v5md/plugin-mermaid'
import { createMindmapPlugin } from '@v5md/plugin-mindmap'
import { createEchartsPlugin } from '@v5md/plugin-echarts'

const editor = new Editor({
  element,
  plugins: [
    createMermaidPlugin(),
    createMindmapPlugin(),
    createEchartsPlugin({ height: 360 }),
  ],
})

await editor.runCommand('mermaid.insert')
await editor.runCommand('mindmap.insert')
await editor.runCommand('echarts.insert')
\`\`\`

点击预览块可进入源码编辑；再次失焦或切出激活态后回到预览。

---

# 插件开发

插件是可信本地代码：贡献命令、工具条、斜杠项、块渲染器和类型化 API。完整设计见仓库 \`docs/plugin-design.md\` 与 \`docs/plugin-block-render.md\`。

## 最小插件

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

| 字段 | 说明 |
| --- | --- |
| \`name\` | 必填且唯一 |
| \`apiVersion\` | 必须等于 \`PLUGIN_API_VERSION\`（当前 \`1\`） |
| \`requires\` | 必装依赖的插件名 |
| \`commands\` | 命令表 |
| \`toolbar\` | 工具条按钮 |
| \`slash\` | \`/\` 菜单项 |
| \`blocks\` | 自定义围栏渲染器 |
| \`api\` | 对外 API |
| \`setup\` / \`destroy\` | 生命周期 |

## 命令与工具条

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
        label: '引用',
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
        title: '引用',
        keywords: ['quote', '引用'],
      },
    ],
  }
}
\`\`\`

命令 \`context\` 提供：\`editor\`、\`host\`、\`state\`、\`insertText\`、\`replaceSelection\`、\`wrapSelection\`、\`focus\`。\`state.path\` 可判断光标是否在引用 / 列表 / 表格内。

内置分组：\`block\` / \`list\` / \`quote\` / \`heading\` / \`insert\` / \`inline\` / \`action\`。不要覆盖内置命令 id（如 \`bold\`、\`heading1\`、\`wechat\`）。

## 自定义块渲染

用 \`blocks\` 接管指定 \`lang\` 的围栏。宿主按

\`rendererId:lang:hash(source):occurrence\`

复用实例，并调用 \`hydrate\` / \`update\` / \`destroy\`。

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
            placeholder: '绘制中…',
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

约定：

- 预览槽使用 \`data-void="widget"\`，\`contentEditable="false"\`
- 非激活显示预览，激活显示源码（\`createFencedWidgetShell\` 已处理）
- 查找优先级：插件注册表 → 普通代码块
- 异步写 DOM 前必须检查 \`ctx.isCurrent()\`，并响应 \`ctx.signal\`

## 生命周期与约束

\`\`\`text
new Editor({ plugins }) → install（校验 name / apiVersion / requires / id）
editor.use(plugin)      → install → setup
handle.ready            → setup 的 Promise resolve 后可用
handle.dispose()        → cleanup → destroy → 重建工具条
editor.destroy()        → 反序卸载全部插件
\`\`\`

- 插件名、命令 id、工具条 id、块渲染 \`id\` / \`lang\` 都需全局唯一
- \`context.state\` 是快照；长期持有会过期，实时数据用 \`context.editor\`
- \`toolbar.shortcut\` 目前只是元数据，不会注册真实快捷键

## 主题覆盖提示

样式选择器一律从 \`.v5md\` 起写；建议只改颜色、字号、间距。不要改缩进、\`display\`、伪元素 \`content\`，否则光标容易跳位。

\`\`\`css
.v5md .v5-doc {
  font-size: 16px;
  line-height: 1.8;
}

.v5md .v5-toolbar {
  background: #fafafa;
}
\`\`\`

---

# 常见问题

**存什么？** \`onChange\` / \`v-model\` 给的 Markdown 字符串就是全文。

**怎么只读？** \`editable: false\`。公式、图表照常渲染，待办可勾选。

**图片怎么接？** \`onUploadImage(file)\` 返回 URL 或 \`Promise<string>\`；想接管图库用 \`onPickImage\`。

**能自定义工具条吗？** 写只提供 \`toolbar\` 的插件，或 \`setToolbarVisible(false)\` 后自己调用 \`runCommand\`。

**能 SSR 吗？** 可以 import，但编辑器只在浏览器挂载（Vue \`onMounted\` / React \`useEffect\`）。

**内容会被改坏吗？** 只重写实际编辑到的片段；未触碰内容原样保留。

---

到这里，这份手册已经覆盖 v5md 的主要编辑能力、官方插件与扩展点。继续在本文上改写、插入图表或导出，都是在练习同一条数据链路：**改 Markdown → 解析 → 重绘**。
`
