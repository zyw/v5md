# 参与开发

## 本地检查

提交前跑一遍，CI 会做同样的事：

```bash
npm run typecheck     # tsc -b，按 tsconfig.json 的项目引用编译 6 个包
npm run lint          # eslint
npm run format:check  # prettier
npm run build         # 逐包构建 dist（发布用，含主题内联）
npm test              # vitest，happy-dom 环境
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

## 源码结构

### `@v5md/core`

```text
src/
├── index.ts      公共出口
├── types.ts      模型类型、偏移与换行工具
├── parse.ts      markdown → 自定义 AST
├── history.ts    state 创建、变更应用、undo / redo
├── text.ts       输入、范围替换、删除、光标边界
├── format.ts     行内标记、块级格式命令、图片尺寸
├── table.ts      表格定位、单元格导航、行列增删
├── block.ts      顶层移动、分块、列表与空块、斜杠命令、缩进
└── find.ts       查找替换（含正则、全词、state 级替换）
```

依赖方向：`types ← parse ← history ← {find, text, table}`、`text ← format`、`block → {format, history, parse, table, text}`。

### `@v5md/view`

```text
src/
├── index.ts              公共出口
├── plugin.ts             插件契约与注册表
├── theme/                主题，按组件拆成 10 个文件，构建时内联为 dist/theme.css
├── editor/               文档引擎
│   ├── editor.ts           Editor：状态、渲染循环、输入分发、公共 API
│   ├── keymap.ts           快捷键表与派发
│   ├── plugins.ts          插件激活、句柄与销毁
│   ├── render.ts           AST → DOM
│   ├── source.ts           源码模式的分词与行
│   ├── selection.ts        模型偏移 ↔ DOM 位置、选区装饰、查找高亮
│   ├── highlight.ts        代码高亮
│   ├── clipboard.ts        富文本复制
│   ├── diagram.ts          mermaid 渲染与缓存
│   └── images.ts           图片拖拽缩放
├── chrome/               编辑器外壳
│   ├── toolbar.ts          工具条与溢出菜单
│   ├── toolbar-host.ts     工具条挂载、按钮排序与状态同步
│   ├── builtins.ts         内置按钮与命令
│   ├── find-bar.ts         查找替换栏
│   ├── slash-menu.ts       斜杠命令菜单
│   ├── block-chrome.ts     块手柄、块菜单、拖拽排序
│   ├── table-bar.ts        表格工具条及定位
│   └── outline.ts          大纲
└── convert/              格式互转
    ├── wechat.ts           导出公众号 HTML 与复制
    └── html-to-md.ts       粘贴 HTML → Markdown
```

拆分原则：`editor.ts` 只保留文档状态、渲染循环、输入分发和公共 API；自成一块的界面部件放进 `chrome/`，纯转换放进 `convert/`。

## 代码风格

- 2 空格、单引号、不加分号、行宽 120、trailing comma —— 由 `.prettierrc.json` 固定，不要手写去对齐。
- 函数与变量用完整单词，不用 `data`、`tmp`、`handle2` 这类名字；布尔量以 `is/should/has` 开头，回调以动词开头。
- 拆文件优先按「一个模块一件事」，其次才按行数。模块之间用明确的参数或回调通信，不互相读私有字段。

## 测试

- 测试只从包的公共入口导入（`../src/index.ts`、`../src/index`），这样重构内部文件不会连累测试。
- 确实需要单测内部函数时（渲染、选区装饰、源码分词、快捷键表、工具条控制器），从该包 `test/internals.ts` 转出，不要直接在测试里写 `../src/某个内部文件`。换实现时只改这一个文件。
- 断言行为优先于断言结构：能通过 `Editor` 的公共方法和 DOM 结果验证的，就不要去摸内部状态。

## 主题

`packages/view/src/theme/` 按组件拆分，`index.css` 用 `@import` 声明顺序；`npm run build -w @v5md/view` 会把它们内联成 `dist/theme.css`。新增样式文件时，同步 `index.css` 的顺序（后面的文件覆盖前面的）和 `theme.test.ts`。

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