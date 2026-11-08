# v5md 插件系统设计

> 状态：设计已落地
> 日期：2026-11-08
> 范围：`@v5md/view`、`@v5md/vue`、`@v5md/react`，以及后续的 `@v5md/plugin-*` 包

## 1. 背景

目前 `@v5md/view` 的工具条是固定实现：按钮列表写死在 `packages/view/src/toolbar.ts`，按钮对应的状态和动作写在 `packages/view/src/editor.ts`。这带来两个限制：

1. 新增一个工具条按钮必须改 `@v5md/view` 本体；
2. 导出 HTML、导出 PDF、导出图片、设置字号这类能力不一定需要按钮，但需要能被外部调用。

因此需要一套插件机制，让“工具条按钮”和“编辑器扩展能力”都可以由插件提供，并且支持按需安装、按需加载和卸载。

## 2. 目标

插件系统需要满足：

- **工具条扩展**：插件可以贡献一个或多个工具条按钮，指定图标、标签、分组、顺序、激活状态和禁用状态。
- **外部可调用**：插件可以不提供工具条按钮，只提供命令或 API，外部通过 `editor.runCommand()` / `handle.api` 调用。
- **返回值和异步**：导出 Markdown、HTML、PDF、图片等命令必须能返回字符串、Blob 或 Promise。
- **按需安装**：插件可以只在某个编辑器实例上安装，不影响其他实例。
- **按需加载**：插件可以拆成独立包或子路径，通过动态 `import()` 在需要时加载。
- **可卸载**：`handle.dispose()` 能移除工具条项、命令和事件监听，并执行清理。
- **编辑与状态访问**：插件可以读取 Markdown、选区、路径、只读/源码模式等状态，并通过受控 API 修改文档。
- **向后兼容**：不传 `plugins` 时，现有工具条、命令和公开 API 行为不变。
- **框架无关**：Vue / React 封装只需要透传 `plugins`，插件逻辑本身在 `@v5md/view`。

典型场景：

- 工具条插件：提示块、目录、字数统计、AI 改写。
- 非工具条插件：导出 Markdown / HTML / PDF / 图片、设置字号、切换主题。
- 混合插件：默认不在工具条显示，但调用方可以选择把某个命令挂到工具条。

## 3. 非目标

第一阶段不做：

- 远程插件市场和动态下载执行；
- 插件沙箱和权限隔离；
- 自动安装插件依赖；
- 插件热更新；
- 把所有内置按钮一次性迁移为插件。

插件代码按可信本地代码处理。

## 4. 现状与改造点

### 4.1 工具条

- `packages/view/src/toolbar.ts` 的 `ITEMS` 是固定数组；
- `ToolbarCommand` 是固定联合类型；
- `createToolbar(onCommand, onImage, onPickImage)` 创建固定按钮；
- `packages/view/src/editor.ts` 的 `mountChrome()` 创建工具条；
- `runToolbar(command)` 用 switch 分发内置命令；
- `syncToolbarState()` 用硬编码逻辑计算按钮的 `aria-pressed`。

### 4.2 编辑器

- `EditorOptions` 没有插件入口；
- `Editor` 的 `state`、`element`、`commit` 是私有的；
- 需要新增受控的编辑 API，避免插件直接改私有字段。

### 4.3 封装

- Vue / React 目前只透传部分 `EditorOptions`；
- 需要新增 `plugins` prop，并在创建 `Editor` 时传入。

### 4.4 公开 API 兼容性

`createToolbar` 目前是公开导出的，文档也允许单独挂载工具条。重构时必须保留旧签名，不能直接改掉。

## 5. 总体设计

~~~text
EditorOptions.plugins / editor.use(plugin)
                 │
                 ▼
          PluginRegistry
   ┌─────────────┼─────────────┐
   │             │             │
 commands      toolbar        api / setup / destroy
   │             │             │
   ▼             ▼             ▼
runCommand   合并内置项     PluginHandle
   │         和插件项          │
   ▼             │             ▼
编辑器动作    ToolbarView    外部调用 handle.api
~~~

核心概念：

1. **命令（command）**：有 id、可执行、可带参数和返回值，供工具条、快捷键、外部代码调用。
2. **工具条项（toolbar item）**：只是命令的 UI 描述，可选。没有工具条项的命令仍然可以被调用。
3. **插件 API（api）**：插件对外暴露的类型化对象，适合导出、字号设置这类需要返回值的场景。
4. **插件句柄（handle）**：`use()` 返回的安装结果，包含 `api`、`ready` 和 `dispose()`。

## 6. 公共 API

### 6.1 类型定义

建议新增 `packages/view/src/plugin.ts`：

~~~ts
import type { MdNode, TextSelection } from '@v5md/core'
import type { Editor } from './editor.js'

export type PluginApiVersion = 1

export interface V5mdPluginState {
  markdown: string
  selection: TextSelection
  path: MdNode[]
  editable: boolean
  sourceMode: boolean
  findOpen: boolean
  toolbarVisible: boolean
  outlineVisible: boolean
}

export interface V5mdCommandContext {
  editor: Editor
  host: HTMLElement
  state: V5mdPluginState
  insertText(text: string): boolean
  replaceSelection(text: string): boolean
  wrapSelection(before: string, after?: string): boolean
  focus(): void
}

export interface V5mdCommand<T = unknown> {
  run(context: V5mdCommandContext, ...args: unknown[]): T | Promise<T>
  isEnabled?(state: V5mdPluginState): boolean
}

export interface V5mdToolbarItem {
  /** 按钮唯一 id，默认等于 command */
  id?: string
  command: string
  label: string
  /** 可信的 SVG/HTML 字符串，和内置按钮一样插入 */
  icon: string
  /** 分组名。使用内置分组可插入内置区域，否则追加新分组 */
  group?: string
  /** 同组内排序，数字越小越靠前 */
  order?: number
  /** action 只执行命令；toggle 会读取 isActive 写 aria-pressed */
  type?: 'action' | 'toggle'
  shortcut?: string
  isActive?(state: V5mdPluginState): boolean
  isDisabled?(state: V5mdPluginState): boolean
}

export interface V5mdPlugin<TApi = undefined> {
  /** 插件唯一名，建议使用 npm 包名或短横线命名 */
  name: string
  version?: string
  /** 编辑器加载时校验，默认 1 */
  apiVersion?: PluginApiVersion
  /** 必装依赖的插件名，未安装时 use 直接报错 */
  requires?: string[]
  /** 可选依赖，不校验，插件内部自行 getPlugin */
  optional?: string[]

  /** 可选：工具条贡献。没有它插件仍然能被外部调用 */
  toolbar?: V5mdToolbarItem[]

  /** 可选：命令表，key 是命令 id */
  commands?: Record<string, V5mdCommand>

  /** 可选：插件对外 API 工厂 */
  api?: (context: V5mdCommandContext) => TApi

  /** 编辑器挂载或插件安装后执行；返回清理函数 */
  setup?(context: V5mdCommandContext): void | (() => void) | Promise<void>

  /** 卸载时调用 */
  destroy?(): void
}

export interface V5mdPluginHandle<TApi = undefined> {
  readonly name: string
  readonly api: TApi
  readonly ready: Promise<void>
  dispose(): void
}
~~~

### 6.2 EditorOptions

~~~ts
export interface EditorOptions {
  // ...现有字段
  plugins?: V5mdPlugin[]
}
~~~

### 6.3 Editor 新增方法

~~~ts
export class Editor {
  use<T = undefined>(plugin: V5mdPlugin<T>): V5mdPluginHandle<T>
  getPlugin<T = undefined>(name: string): V5mdPluginHandle<T> | undefined
  runCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>
  getHostElement(): HTMLElement
  getContentElement(): HTMLElement
}
~~~

说明：

- `use()` 在编辑器销毁后调用会抛错。
- `getPlugin()` 用于获取通过 `EditorOptions.plugins` 安装的插件。
- `runCommand()` 内置命令保留当前 `ToolbarCommand` 的 id，插件命令必须使用未占用的 id。
- `getHostElement()` 返回 `.v5md` 根元素，`getContentElement()` 返回 `.v5-doc` 文档元素，供导出和样式插件使用。

## 7. 工具条重构

### 7.1 描述式按钮

把工具条项统一成描述对象，内置按钮迁移为 `builtinToolbarItems`：

~~~ts
export interface ToolbarItemView {
  id: string
  command: string
  label: string
  icon: string
  group: string
  order: number
  type: 'action' | 'toggle'
  isActive?(state: V5mdPluginState): boolean
  isDisabled?(state: V5mdPluginState): boolean
}
~~~

内置分组保持现有顺序，例如：

- `block`：代码块、表格、图片
- `list`：有序、无序、任务列表
- `quote`：引用
- `heading`：一到三级标题
- `insert`：分割线、链接、公式
- `inline`：行内公式、粗体、斜体、下划线、行内代码、删除线、高亮
- `action`：公众号复制

插件使用内置分组时插入对应区域，使用新分组时追加到内置区域之后。

### 7.2 合并逻辑

~~~ts
const items = [
  ...builtinToolbarItems,
  ...plugins.flatMap((plugin) => plugin.toolbar ?? []),
]
~~~

排序规则：

1. 内置分组按内置顺序；
2. 插件新分组按插件安装顺序；
3. 同组内按 `order` 升序；
4. `order` 相同按注册顺序。

### 7.3 状态同步

`syncToolbarState()` 改成通用逻辑：

~~~ts
const state = this.getPluginState()
for (const item of this.toolbarItems) {
  const button = ...
  if (item.type === 'toggle') {
    button.setAttribute('aria-pressed', String(item.isActive?.(state) ?? false))
  }
  button.disabled = item.isDisabled?.(state) ?? false
}
~~~

内置按钮的 pressed 判断从 `syncToolbarState()` 迁移到各自的 `isActive`，例如：

- bold：路径里包含 `strong`
- heading1：最近的 heading 深度为 1
- orderedList：最近 list 的 `ordered === true`
- taskList：最近 listItem 的 `checked` 是布尔值

### 7.4 兼容旧 createToolbar

保留现有：

~~~ts
createToolbar(onCommand, onImage, onPickImage?)
~~~

新增内部/新导出：

~~~ts
createToolbarFromItems(items, host, options?)
~~~

旧函数内部用内置 items 调新函数，避免破坏现有使用方。

## 8. 命令与 API

### 8.1 命令表

`commands` 使用对象而不是数组，key 就是命令 id：

~~~ts
commands: {
  'callout.note': {
    run({ wrapSelection, state }) {
      if (!state.editable) return
      wrapSelection('> [!NOTE]\n> ', '\n')
    },
  },
}
~~~

### 8.2 runCommand

~~~ts
await editor.runCommand('export.pdf')
await editor.runCommand('export.image', { scale: 2, type: 'png' })
~~~

规则：

- 内置命令和插件命令走同一个入口；
- 内置命令 id 保留，插件不能覆盖；
- 重复命令 id 在安装时报错并跳过；
- 同步命令和异步命令统一返回 `Promise<T>`；
- 工具条点击不等待返回值，使用 `void editor.runCommand(id)`；
- 命令抛错时 `runCommand` 打印错误并 reject，编辑器自身不受影响。

### 8.3 编辑 API

插件不能直接改 `EditorState` 或 `this.element.innerHTML`。通过以下受控方法：

~~~ts
insertText(text: string): boolean
replaceSelection(text: string): boolean
wrapSelection(before: string, after?: string): boolean
focus(): void
~~~

要求：

- 只读预览模式下默认返回 `false`，除非命令显式处理只读；
- 所有修改走 `Editor.commit()`，保证撤销历史、`onChange`、重新渲染一致；
- `wrapSelection` 无选区时可在光标处插入成对标记，具体行为与现有格式命令一致。

### 8.4 状态快照

`V5mdPluginState.path` 来自 `pathAt(parse(markdown), selection.head, length)`。

状态在以下时机刷新：

- 文档变化；
- 选区变化；
- 切换只读/源码模式；
- 工具条显示/隐藏；
- 查找栏打开/关闭。

`isActive` / `isDisabled` 使用快照；`run` 里的 `context.state` 是调用瞬间的快照，异步命令如果需要最新状态，应重新调用 `editor.getPluginState()`（建议同时公开这个方法）。

## 9. 生命周期与按需安装

### 9.1 构造时安装

~~~ts
const editor = new Editor({
  element,
  plugins: [exportPlugin, typographyPlugin],
})
~~~

构造流程：

1. 创建插件注册表，校验名称、命令 id、工具条 id、`apiVersion`、`requires`；
2. 收集内置工具条项 + 插件工具条项；
3. 挂载工具条、大纲、文档；
4. 执行各插件的 `setup`；
5. 记录清理函数。

### 9.2 运行时安装

~~~ts
const handle = editor.use(exportPlugin)
await handle.ready
const pdf = await handle.api.exportPdf()
~~~

`use()` 行为：

1. 编辑器已销毁则报错；
2. 同名插件已安装：
   - 同一个实例返回已有 handle；
   - 不同实例抛错；
3. 校验 `apiVersion` 和 `requires`；
4. 注册命令、收集工具条项；
5. 重建工具条；
6. 调用 `api` 工厂创建 `api`；
7. 执行 `setup`，完成后 resolve `ready`；
8. 返回 handle。

### 9.3 按需卸载

~~~ts
handle.dispose()
~~~

`dispose()` 行为：

1. 标记插件已卸载；
2. 注销命令和工具条项；
3. 执行 `setup` 返回的清理函数；
4. 调用 `plugin.destroy()`；
5. 重建工具条，保留显示/隐藏状态；
6. 重复调用无副作用。

### 9.4 销毁

`Editor.destroy()` 中按插件安装的逆序调用 `dispose()`，然后执行现有 DOM 清理和事件解绑。

### 9.5 异步 setup

`setup` 允许返回 Promise。`handle.ready` 在 setup 完成后 resolve；setup 失败时 reject 并打印错误，但编辑器继续可用。

如果 `dispose()` 发生在 setup 完成前，应等待 setup 结束后执行清理，或将插件标记为取消，避免清理函数丢失。

### 9.6 依赖

- `requires` 中的插件必须在当前编辑器已安装；
- 不自动安装依赖，缺失时直接报错并说明缺失的插件名；
- `optional` 不校验，插件内部用 `editor.getPlugin(name)` 判断；
- 安装顺序由调用方保证，依赖插件先安装。

## 10. 打包与按需加载

建议插件独立成包，避免 `@v5md/view` 引入导出相关的重依赖：

~~~text
packages/plugins/export/       -> @v5md/plugin-export
packages/plugins/typography/   -> @v5md/plugin-typography
packages/plugins/ai/           -> @v5md/plugin-ai
~~~

`@v5md/plugin-export` 可继续拆子路径：

~~~json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./pdf": {
      "types": "./dist/pdf.d.ts",
      "import": "./dist/pdf.js"
    },
    "./image": {
      "types": "./dist/image.d.ts",
      "import": "./dist/image.js"
    }
  }
}
~~~

- 重依赖（如 `jspdf`、`html2canvas`）只在对应子路径或函数内部动态加载；
- 不安装插件包，就不会进入业务产物；
- 插件模块顶层不能访问 `document` / `window`，只在 `setup`、`api`、命令执行时使用，避免 SSR / Node 环境 import 报错。

动态加载示例：

~~~ts
async function enableExport(editor: Editor) {
  const { createExportPlugin } = await import('@v5md/plugin-export')
  const handle = editor.use(createExportPlugin({ imageScale: 2 }))
  await handle.ready
  return handle
}

const exportHandle = await enableExport(editor)
const pdf = await exportHandle.api.exportPdf()
~~~

## 11. 使用示例

### 11.1 只有外部 API、没有工具条按钮

~~~ts
interface ExportApi {
  exportMarkdown(): string
  exportHtml(): Promise<string>
  exportPdf(): Promise<Blob>
  exportImage(type?: 'png' | 'jpeg'): Promise<Blob>
}

const exportPlugin: V5mdPlugin<ExportApi> = {
  name: 'export',
  api: ({ editor, host }) => ({
    exportMarkdown() {
      return editor.getMarkdown()
    },
    async exportHtml() {
      return renderStandaloneHtml(editor.getMarkdown())
    },
    async exportPdf() {
      return renderPdfFromElement(host)
    },
    async exportImage(type = 'png') {
      return renderImageFromElement(host, type)
    },
  }),
}

const editor = new Editor({ element, plugins: [exportPlugin] })
const exportTools = editor.getPlugin<ExportApi>('export')!

const markdown = exportTools.api.exportMarkdown()
const pdf = await exportTools.api.exportPdf()
~~~

### 11.2 同一个插件增加工具条按钮

~~~ts
const exportPlugin: V5mdPlugin<ExportApi> = {
  name: 'export',
  api: /* 同上 */,
  commands: {
    'export.pdf': {
      run: ({ editor }) => editor.getPlugin<ExportApi>('export')!.api.exportPdf(),
    },
  },
  toolbar: [
    {
      id: 'export.pdf',
      command: 'export.pdf',
      label: '导出 PDF',
      icon: '<svg viewBox="0 0 24 24">...</svg>',
      group: 'export',
      order: 10,
    },
  ],
}
~~~

### 11.3 字号插件

~~~ts
interface TypographyApi {
  setFontSize(px: number): void
  getFontSize(): string
}

const typographyPlugin: V5mdPlugin<TypographyApi> = {
  name: 'typography',
  api: ({ host }) => ({
    setFontSize(px) {
      host.style.fontSize = px + 'px'
    },
    getFontSize() {
      return getComputedStyle(host).fontSize
    },
  }),
}

const typography = editor.getPlugin<TypographyApi>('typography')!
typography.api.setFontSize(18)
~~~

`destroy()` 中应恢复原始字号。

## 12. 兼容性与安全

- `plugins` 是可选字段，默认不加载任何插件；
- 不传插件时，工具条按钮数量、顺序、快捷键、`aria-pressed` 必须与现状一致；
- 旧 `createToolbar` 签名保留；
- `ToolbarCommand` 联合类型保留，插件命令使用普通字符串；
- 插件 `icon` 是可信 HTML，文档需标注；如果将来支持不可信插件，再增加 sanitize / iframe 隔离；
- 插件 `apiVersion` 不匹配时拒绝安装并给出明确错误；
- 插件名、命令 id、工具条 id 都要求全局唯一；
- 插件只影响当前 `Editor` 实例，不能使用全局单例保存状态。

## 13. 测试计划

### 13.1 单元测试

- 插件注册、名称重复、命令 id 重复、工具条 id 重复；
- `apiVersion` 不匹配；
- `requires` 缺失；
- 工具条顺序、分组、`order`；
- `isActive` / `isDisabled` 随选区、只读、源码模式更新；
- `runCommand` 同步/异步返回值；
- `use()` / `getPlugin()` / `dispose()`；
- 重复 `dispose()` 无副作用；
- 异步 `setup` 的 `ready` 和提前 `dispose()`；
- 插件异常隔离；
- `insertText` / `wrapSelection` 在只读模式下拒绝。

### 13.2 回归测试

- 不传插件时，现有工具条按钮数量和顺序不变；
- 所有内置工具条命令仍可执行；
- 只读预览、源码模式、查找、公众号复制不受影响；
- `createToolbar` 旧用法仍然可用。

### 13.3 封装测试

- Vue 传入 `plugins`，工具条出现插件按钮；
- React 传入 `plugins`，工具条出现插件按钮；
- `onReady` 调用 `editor.use()` 后按钮更新；
- `dispose()` 后按钮移除。

### 13.4 构建测试

- `npm test`
- `npm run build`
- playground-vue / playground-react 构建
- 插件独立包构建和 tree-shaking 检查（插件未安装时主包不包含重依赖）

## 14. 实现步骤

### 第 1 步：插件类型与注册表

文件：

- 新增 `packages/view/src/plugin.ts`；
- 新增 `packages/view/test/plugin.test.ts`；
- `packages/view/src/index.ts` 导出插件相关类型。

内容：

- 定义 `V5mdPlugin`、`V5mdPluginState`、`V5mdCommand`、`V5mdToolbarItem`、`V5mdCommandContext`、`V5mdPluginHandle`；
- 实现 `PluginRegistry`：注册、去重、依赖校验、`apiVersion` 校验、`use` / `dispose` 状态；
- 先不接入 Editor，只做纯逻辑测试。

验收：

- 重复插件名、重复命令 id 报错；
- 依赖缺失报错；
- 重复安装同一实例幂等。

### 第 2 步：工具条描述化

文件：

- 修改 `packages/view/src/toolbar.ts`；
- 修改 `packages/view/src/editor.ts`；
- 修改 `packages/view/test/editor.test.ts`。

内容：

- 把固定 `ITEMS` 改成 `builtinToolbarItems`，每个按钮带 `group`、`order`、`type`、`isActive`；
- 新增 `createToolbarFromItems(items, onCommand, ...)`；
- 旧 `createToolbar` 保留，内部调用新函数；
- `syncToolbarState` 改为遍历 items，调用 `isActive` / `isDisabled`；
- 保持现有 21 个按钮顺序、图标、label、aria-pressed 行为一致。

验收：

- 现有工具条测试全部通过；
- `createToolbar` 旧签名仍可编译和运行；
- 按钮数量与顺序不变。

### 第 3 步：Editor 接入插件

文件：

- 修改 `packages/view/src/editor.ts`；
- 修改 `packages/view/src/index.ts`；
- 新增编辑器插件测试。

内容：

- `EditorOptions.plugins`；
- 构造时收集插件工具条项并合并；
- 新增 `use()`、`getPlugin()`、`runCommand()`；
- 新增 `getHostElement()`、`getContentElement()`、`getPluginState()`；
- 新增 `insertText()`、`replaceSelection()`、`wrapSelection()`；
- 命令分发内置命令和插件命令。

验收：

- 不传插件时行为不变；
- 插件命令可同步/异步执行并返回结果；
- 插件只注册命令、不提供 toolbars 时也能调用。

### 第 4 步：生命周期与卸载

文件：

- 修改 `packages/view/src/plugin.ts`；
- 修改 `packages/view/src/editor.ts`；
- 补充测试。

内容：

- `use()` 安装流程：校验、注册、重建工具条、执行 `setup`、创建 `api`、resolve `ready`；
- `dispose()`：注销命令、移除工具条项、执行清理、调用 `destroy`、重建工具条；
- `Editor.destroy()` 逆序卸载插件；
- 异步 setup 与提前 dispose 的处理；
- 异常隔离。

验收：

- 安装后按钮出现；
- 卸载后按钮和命令消失；
- 卸载后可重新安装；
- 插件清理函数只执行一次。

### 第 5 步：Vue / React 封装

文件：

- 修改 `packages/vue/src/index.ts`；
- 修改 `packages/react/src/index.tsx`；
- 修改封装测试。

内容：

- 两个封装增加 `plugins?: EditorOptions['plugins']` prop；
- 创建 Editor 时透传；
- 文档说明插件在挂载时创建，动态安装通过 `onReady` 调 `editor.use()`。

验收：

- Vue / React playground 可以用插件增加一个测试按钮；
- 点击按钮执行插件命令。

### 第 6 步：导出与字号插件

文件：

- 新增 `packages/plugins/export/`；
- 新增 `packages/plugins/typography/`；
- 视需要给 `@v5md/view` 增加 `renderToHtml()` 或导出渲染工具。

内容：

- `@v5md/plugin-export`：Markdown、HTML、PDF、图片导出；
- `@v5md/plugin-typography`：字号读写；
- 重依赖使用动态 import；
- 插件都不强制提供工具条按钮。

验收：

- 不安装插件包时主包体积不变；
- 安装后可通过 `handle.api` 导出；
- 导出图片/PDF 不破坏编辑器状态。

### 第 7 步：内置按钮插件化

文件：

- `packages/view/src/toolbar.ts`；
- `packages/view/src/editor.ts`；
- 相关测试。

内容：

- 把内置按钮迁移成内置插件描述；
- 内置命令通过同一 `runCommand` 路径执行；
- 保持快捷键、aria 状态和视觉不变。

验收：

- 工具条行为与第 2 步完全一致；
- 内置功能和第三方插件使用同一套实现。

### 第 8 步：文档与示例

- `packages/view/README.md` 增加插件章节；
- `packages/vue/README.md`、`packages/react/README.md` 增加 `plugins` 说明；
- playground 增加一个本地插件示例（例如插入提示块或导出 Markdown）；
- 新增 `docs/plugin-design.md` 本文件作为长期设计文档。

## 15. 实现进度

截至本次提交：

- 第 1 步：已完成，新增 `plugin.ts`、`packages/view/test/plugin.test.ts`；
- 第 2 步：已完成，工具条改为描述式 items，保留旧 `createToolbar`；
- 第 3 步：已完成，`EditorOptions.plugins`、`use`、`getPlugin`、`runCommand`、受控编辑 API 已接入；
- 第 4 步：已完成，插件安装、卸载、`ready`、清理和销毁已接入；
- 第 5 步：已完成，Vue / React 增加 `plugins` prop 并有封装测试；
- 第 6 步：已完成，新增 `@v5md/plugin-typography`、`@v5md/plugin-export` 独立包；
- 第 7 步：已完成，内置按钮和命令迁移到 `packages/view/src/builtins.ts`，与插件命令共用 `runCommand`；
- 第 8 步：已完成，README 和两个 playground 都加入了插件示例。

## 16. 风险与备选方案

### 风险

- **工具条重建导致闪烁**：第一版 `use` / `dispose` 重建整个工具条，后续可改为增量插入/移除。
- **插件 API 版本漂移**：通过 `apiVersion` 和独立包版本控制。
- **导出依赖过重**：使用独立包和子路径，重依赖动态加载。
- **插件破坏 DOM**：文档要求使用受控 API；必要时后续增加只读视图或事件隔离。
- **内置迁移风险**：分阶段进行，第 2 步先保持行为不变，第 7 步再迁移。

### 备选方案

- **只做 `toolbar: ToolbarItem[]` 配置**：实现简单，但没有命令返回值、生命周期和外部 API，不满足导出场景。
- **插件通过全局事件总线通信**：难以类型化和清理，不采用。
- **所有插件放 `@v5md/view` 子路径**：可以减少包数量，但会让主包或构建产物带上重依赖，按需加载不彻底。

## 17. 待确认问题

- 导出 HTML 需要“独立完整 HTML 文档”还是“可粘贴 HTML 片段”？建议两者都提供：`exportHtml()` 返回片段，`exportDocument()` 返回完整文档。
- PDF / 图片导出使用哪个实现（`html2canvas` + `jspdf`，还是浏览器打印）？建议插件内部可替换，不绑死。
- 插件是否需要在工具条溢出时自动收纳到“更多”菜单？建议后续版本处理。
