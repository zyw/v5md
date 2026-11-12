export const sample = `---
title: v5md 示例文档
author: playground
tags: [markdown, editor, demo]
---

# 所见即所得

这是一段普通段落，覆盖常见行内格式：**粗体**、*斜体*、<u>下划线</u>、~~删除线~~、==高亮==、\`行内代码\`，以及 [外链](https://v5md.v5ai.xin)。

也可以把格式叠在一起：***粗斜体***、**~~粗体删除线~~**、\`code\` 旁的 ==重点==。

## 二级标题

正文可以继续写。下面用更小的标题展示层级。

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

- [x] 支持 GFM 任务列表
- [x] 预览模式下仍可勾选
- [ ] 写一篇发布说明
- [ ] 整理插件文档

## 引用

> 引用可以嵌套链接与行内格式，例如 **强调** 和 [文档站点](https://v5md.v5ai.xin)。
>
> > 这是嵌套引用，适合标注来源或补充说明。

## 表格

对齐示例（左 / 中 / 右）：

| 语言 | 用途 | 版本 |
| :--- | :---: | ---: |
| TypeScript | 编辑器核心 | 5.9 |
| Markdown | 唯一数据源 | GFM |
| Vue / React | 框架薄壳 | 3 / 18 |

## 分割线

上面是正文，下面换一组媒体与公式。

---

## 图片

![示意图](sample.svg)

图片可拖拽缩放；上传走 \`onUploadImage\`。

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

\`\`\`ts
import { Editor } from '@v5md/view'
import { createMermaidPlugin } from '@v5md/plugin-mermaid'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  value: '# Hello v5md',
  plugins: [createMermaidPlugin()],
})

console.log(editor.getMarkdown())
\`\`\`

\`\`\`bash
npm install @v5md/view @v5md/plugin-mermaid
\`\`\`

## 流程图

\`\`\`mermaid
flowchart TB
  subgraph 输入
    A[粘贴 / 输入 / 工具条]
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

## 时序图

\`\`\`mermaid
sequenceDiagram
  actor U as 用户
  participant E as Editor
  participant P as Plugin
  U->>E: 输入 / 图表
  E->>E: commit + render
  E->>P: hydrate(source)
  P-->>E: SVG / Canvas
  E-->>U: 预览
  U->>E: 点击块进入源码
  E-->>U: 编辑围栏正文
\`\`\`

## 思维导图

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

## 柱状图

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
`
