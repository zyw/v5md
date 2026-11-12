# @v5md/plugin-mermaid

把 ` ```mermaid ` 围栏块渲染成 [Mermaid](https://mermaid.js.org/) 图。从 `@v5md/view` 拆出后，需要单独安装本插件才会绘制流程图。

## 安装

```bash
npm install @v5md/plugin-mermaid
```

## 使用

```ts
import { createMermaidPlugin, type MermaidApi } from '@v5md/plugin-mermaid'

const editor = new Editor({
  element,
  plugins: [createMermaidPlugin()],
})

await editor.runCommand('mermaid.insert')
// 或输入 /流程图

const api = editor.getPlugin<MermaidApi>('mermaid')!.api
api.insertTemplate('graph TD;A-->B')
```

## 选项

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名，默认 `mermaid` |
| `lang` | 匹配的 fence lang，默认 `mermaid` |
| `toolbar` | 是否显示工具条按钮，默认 `true` |
| `locale` | UI 语言，`zh-CN`（默认）或 `en`；影响工具条 / 斜杠文案与绘制中提示 |
| `template` | 插入命令默认源码 |
| `loadMermaid` | 自定义加载器（测试用） |

未安装本插件时，`mermaid` 围栏会按普通代码块高亮显示。
