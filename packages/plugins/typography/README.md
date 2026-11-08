# @v5md/plugin-typography

v5md 的字号插件。没有工具条按钮，只提供外部 API。

## 安装

```bash
npm install @v5md/plugin-typography
```

## 使用

```ts
import { createTypographyPlugin, type TypographyApi } from '@v5md/plugin-typography'

const editor = new Editor({
  element,
  plugins: [createTypographyPlugin({ defaultSize: 18 })],
})

const typography = editor.getPlugin<TypographyApi>('typography')!
typography.api.setFontSize(20)
console.log(typography.api.getFontSize())
typography.api.resetFontSize()
```

## API

| 方法 | 说明 |
| --- | --- |
| `setFontSize(px)` | 设置编辑器字号，范围默认 10～40 |
| `getFontSize()` | 读取当前计算字号 |
| `resetFontSize()` | 恢复到插件安装前的字号 |
| `getDefaultSize()` | 读取配置的默认字号 |

`destroy` 或 `handle.dispose()` 时会恢复安装前的字号。
