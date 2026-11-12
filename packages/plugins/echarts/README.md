# @v5md/plugin-echarts

把 ` ```echarts ` 围栏块渲染成 [ECharts](https://echarts.apache.org/) 图表。正文必须是 **JSON option**（不执行 JS）。

## 安装

```bash
npm install @v5md/plugin-echarts
```

## 使用

```ts
import { createEchartsPlugin, type EchartsApi } from '@v5md/plugin-echarts'

const editor = new Editor({
  element,
  plugins: [createEchartsPlugin()],
})

// 工具条「图表」、斜杠「图表」或命令
await editor.runCommand('echarts.insert')

const api = editor.getPlugin<EchartsApi>('echarts')!.api
api.insertTemplate({
  xAxis: { type: 'category', data: ['A', 'B'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [1, 3] }],
})
```

Markdown 示例：

````md
```echarts
{
  "title": { "text": "销量" },
  "xAxis": { "type": "category", "data": ["甲", "乙", "丙"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [12, 24, 18] }]
}
```
````

## 选项

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名，默认 `echarts` |
| `lang` | 匹配的 fence lang，默认 `echarts` |
| `height` | 预览高度，默认 `280` |
| `toolbar` | 是否显示工具条按钮，默认 `true` |
| `template` | 插入命令使用的默认 option |
| `loadEcharts` | 自定义加载器（测试或替换实现） |

## 行为

- 非激活：显示图表预览；激活块：编辑 JSON 源码（与 Mermaid 插件一致）
- 源码变更后按块渲染协议 `hydrate` / `update` / `destroy`
- 通过 `slash` 注册斜杠菜单「图表」
- ECharts 通过动态 `import('echarts')` 加载，不进入 `@v5md/view` 主包
