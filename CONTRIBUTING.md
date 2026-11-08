# 参与开发

## 本地检查

提交前跑一遍，CI 会做同样的事：

```bash
npm run lint        # eslint
npm run format:check  # prettier
npm run build       # 6 个包依次 tsc
npm test            # vitest，happy-dom 环境
```

格式化用 `npm run format`。仓库不在 git 里跟踪 `dist`，也不要在提交里带上它。

## 目录约定

- `packages/core` 不接触 DOM，依赖方向固定为 `types ← parse ← history ← {find, text, table}`、`text ← format`、`block → {format, history, parse, table, text}`，不允许反向引用或成环。
- `packages/view` 分三层：
  - `editor/` 文档引擎：状态、渲染循环、输入处理、选区、剪贴板
  - `chrome/` 编辑器外壳：工具条、查找栏、斜杠菜单、块手柄、表格工具条、大纲
  - `convert/` 格式互转：公众号 HTML 导出、粘贴 HTML 转 Markdown
- 新功能的落点判断：只跟文档模型有关 → `core`；要操作 DOM 但属于编辑器本体 → `editor/`；是编辑器周围的一块界面 → `chrome/`；是格式转换 → `convert/`。
- 每个包只通过 `src/index.ts` 对外，包内模块之间直接相对导入（带 `.js` 后缀）。

## 代码风格

- 2 空格、单引号、不加分号、行宽 120、trailing comma —— 由 `.prettierrc.json` 固定，不要手写去对齐。
- 函数与变量用完整单词，不用 `data`、`tmp`、`handle2` 这类名字；布尔量以 `is/should/has` 开头，回调以动词开头。
- 拆文件优先按「一个模块一件事」，其次才按行数。模块之间用明确的参数或回调通信，不互相读私有字段。

## 注释

- **代码注释统一英文**，文档（`*.md`）和提交信息用中文。
- 注释只写「为什么」，不复述代码在做什么。比如记录浏览器差异、剪贴板限制、IME 行为这类必须靠注释才留得下来的背景。
- 对外 API 的注释写在类型定义上，用 JSDoc 一句话说明语义与默认值。

## 提交

提交信息用 `type(scope): 中文说明`，与现有历史一致：

```text
feat(editor): 支持自定义图片选择
fix(list): 修复空列表项按回车退出列表的行为
refactor(view): 按职责拆分 editor/chrome/convert 三层
docs: 补充源码结构说明
test(view): 覆盖快捷键映射
chore: 接入 eslint 与 prettier
```

一次提交只做一件事。重构与行为改动分两次提交，方便回滚和审查。
