# @v5md/plugin-mindmap

把 ` ```mindmap ` 围栏块渲染成 [Markmap](https://markmap.js.org/) 思维导图。正文是 Markdown 大纲（标题或缩进列表）。

## 安装

```bash
npm install @v5md/plugin-mindmap
```

## 使用

```ts
import { createMindmapPlugin, type MindmapApi } from '@v5md/plugin-mindmap'

const editor = new Editor({
  element,
  plugins: [createMindmapPlugin()],
})

// 工具条「思维导图」、斜杠「思维导图」或命令
await editor.runCommand('mindmap.insert')

const api = editor.getPlugin<MindmapApi>('mindmap')!.api
api.insertTemplate('# 主题\n## 分支')
```

Markdown 示例：

````md
```mindmap
# 中心主题
## 分支 A
### 细节
## 分支 B
```
````

## 选项

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名，默认 `mindmap` |
| `lang` | 匹配的 fence lang，默认 `mindmap`；可设为 `['mindmap','markmap']` |
| `height` | 预览高度，默认 `360` |
| `toolbar` | 是否显示工具条按钮，默认 `true` |
| `template` | 插入命令默认大纲 |
| `markmapOptions` | 传给 `Markmap.create` 的选项 |
| `loadMarkmap` | 自定义加载器（测试或替换实现） |

## 行为

- 非激活：显示导图预览；激活块：编辑 Markdown 源码
- 源码变更后按块渲染协议 `hydrate` / `update` / `destroy`
- 通过 `slash` 注册斜杠菜单「思维导图」
- Markmap 通过动态 `import('@markmap/parse')` / `import('@markmap/view')` 加载，不进入 `@v5md/view` 主包

未安装本插件时，`mindmap` 围栏会按普通代码块高亮显示。
