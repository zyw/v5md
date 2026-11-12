# v5md 块渲染扩展设计

> 状态：P0–P5 已落地
> 日期：2026-11-12
> 范围：在现有 `@v5md/view` 插件系统上增加 Block Renderer；不改 `@v5md/core` AST
> 前置：[`docs/plugin-design.md`](./plugin-design.md)（工具条 / 命令 / API 已落地）
> 实现：`packages/view/src/editor/blocks.ts`、`render.ts`（`createFencedWidgetShell`）、`editor.ts`、`plugin.ts`（`slash`）；官方插件 `@v5md/plugin-echarts` / `@v5md/plugin-mermaid` / `@v5md/plugin-mindmap`；测试见 `packages/view/test/blocks.test.ts`、`packages/plugins/*/test`

---

## 0. 接口冻结清单

本节是实现前的约定冻结范围：只定 `V5mdBlockRenderer` 字段与实例 `key` 规则。实现时可增内部辅助类型，但**不得擅自改本节已列字段名、语义与匹配优先级**；若必须变更，先改本文并升兼容说明。

### 0.1 插件挂载点

在现有 `V5mdPlugin` 上增加可选字段（`PLUGIN_API_VERSION` 仍为 `1`）：

```ts
blocks?: V5mdBlockRenderer[]
```

规则：

- 缺省 / 空数组：行为与今天完全一致。
- 安装时注册进编辑器实例级 `BlockRendererRegistry`；`dispose()` / `destroy()` 时移除。
- 同一编辑器内，`V5mdBlockRenderer.id` 全局唯一；冲突则安装失败。
- 同一编辑器内，规范化后的 `lang`（小写、trim）全局唯一；冲突则安装失败。
- 查找优先级：**插件注册表 → 默认代码块**（内置不再特殊处理 `mermaid`；需安装 `@v5md/plugin-mermaid`）。

### 0.2 `V5mdBlockRenderer`

```ts
interface V5mdBlockRenderer {
  /** 渲染器唯一 id，建议与插件能力对应，如 'echarts'、'mindmap'。 */
  id: string

  /**
   * 匹配 fenced code 的 lang。
   * 字符串或字符串数组；比较前一律 trim + toLowerCase()。
   */
  lang: string | string[]

  /**
   * 可选自定义匹配。若提供，则在 lang 候选之外仍可命中；
   * 若未提供，仅按 lang 匹配。
   * 一期实现可先只做 lang；保留字段以免二期改签名。
   */
  match?(node: MdNode): boolean

  /**
   * 同步构建 DOM 壳。禁止长时间计算与网络 IO。
   * 返回的根元素必须能挂上节点的 data-start / data-end（由宿主 stamp，或渲染器自行保证）。
   */
  render(ctx: BlockRenderContext): HTMLElement

  /**
   * 异步绘制。可省略（纯同步壳）。
   * 写回 DOM 前必须检查 ctx.isCurrent()；并响应 ctx.signal 中止。
   */
  hydrate?(ctx: BlockHydrateContext): void | Promise<void>

  /**
   * 源码未变、仅需把已有 widget 接到新壳时调用（可选）。
   * 未实现则宿主走 destroy + 重新 hydrate。
   */
  update?(ctx: BlockUpdateContext): void | Promise<void>

  /**
   * 实例不再使用时清理（ECharts.dispose 等）。
   * 插件卸载、节点消失、key 未命中复用时由宿主调用。
   */
  destroy?(ctx: BlockDestroyContext): void
}
```

### 0.3 上下文类型

```ts
interface BlockRenderContext {
  node: MdNode
  /** 整篇 Markdown。 */
  doc: string
  /** fence 正文（不含开头/结尾围栏行）。 */
  source: string
  /** 规范化后的 lang（小写）。 */
  lang: string
  editable: boolean
  sourceMode: boolean
  /** 当前块是否处于源码编辑激活态（对齐 mermaid 的 v5-active）。 */
  active: boolean
  /** 编辑器宿主根（.v5md）。 */
  host: HTMLElement
}

interface BlockHydrateContext extends BlockRenderContext {
  element: HTMLElement
  /** 若已开始新一轮 render，返回 false；过期异步不得写 DOM。 */
  isCurrent(): boolean
  signal: AbortSignal
}

interface BlockUpdateContext extends BlockHydrateContext {
  /** 上一轮保留下来的 widget 根（通常为预览槽内的节点）。 */
  previous: HTMLElement
}

interface BlockDestroyContext {
  element: HTMLElement
  lang: string
  rendererId: string
}
```

### 0.4 匹配规则（冻结）

仅对 `node.type === 'code'` 且带 fenced lang 的节点查表：

1. 计算 `lang = (node.lang ?? '').trim().toLowerCase()`；空 lang → 不走块渲染器。
2. 若某渲染器提供 `match` 且 `match(node) === true` → 命中该渲染器（多命中时：**先安装者优先**，安装期应用 `lang` 唯一约束降低冲突）。
3. 否则按 `lang` 精确匹配已注册表。
4. 未命中 → 默认代码高亮块。

一期实现允许暂时忽略 `match`，但类型与文档保留该字段。

### 0.5 实例 `key` 规则（冻结）

宿主在两次全量 `renderDocument` 之间复用插件块实例时，使用：

```text
key = `${rendererId}:${lang}:${hash(source)}:${occurrence}`
```

| 段 | 含义 |
| --- | --- |
| `rendererId` | `V5mdBlockRenderer.id` |
| `lang` | 规范化 lang |
| `hash(source)` | fence 正文的稳定哈希（实现可选算法，但相同 source 必须相同 hash） |
| `occurrence` | 本文档中**同一 rendererId+lang+source** 的出现序号，从 `0` 起 |

约束：

- **禁止**仅用 `node.start` 作为唯一 key（前文编辑会导致整体漂移）。
- `source` 不变且 `occurrence` 不变 → 应尽量复用实例（调用 `update` 或等效搬迁 DOM）。
- `source` 变 → 旧 key 销毁，新 key hydrate。
- 插件卸载 → 该 `rendererId` 下全部实例 `destroy`。

### 0.6 DOM / 交互约定（与接口一并冻结）

块渲染器产出的壳应遵守（与现有 mermaid 对齐）：

| 约定 | 要求 |
| --- | --- |
| 根 | 块级元素，带节点偏移；建议 class 含 `v5-code` 与插件自有前缀 |
| 预览槽 | `contentEditable="false"`，并设 `data-void`（推荐 `diagram` 或 `widget`） |
| 源码槽 | 保留 fence marker + 正文叶子，供激活态编辑与光标映射 |
| 非 active | 显示预览，隐藏源码槽 |
| active | 显示源码槽，隐藏预览 |
| 点击 void | 由宿主把选区落到该块可编辑偏移（复用现有 atomic caret 思路） |
| 源码模式 | 整篇不走块渲染器 |

### 0.7 明确不在冻结范围

以下可在实现时再定，**改动不视为破坏本次冻结**：

- `hash` 具体算法（FNV / SHA 截断等）
- Registry 类名与文件路径
- 导出快照辅助 API（如 `snapshot()`）
- `update` 未实现时的降级策略细节（只要遵守 destroy + hydrate）

已落地（不再属于冻结外待定项）：

- Mermaid 已迁为 `@v5md/plugin-mermaid`；未安装时按普通代码块显示
- 插件可通过 `V5mdPlugin.slash` 注册斜杠菜单项，选中后清空 `/query` 再 `runCommand`

---

## 1. 背景

当前插件系统（见 `plugin-design.md`）已支持：

- 工具条按钮
- 命令（`runCommand`）
- 对外 `api`
- `setup` / `dispose` 生命周期

**尚未支持**：接管编辑器里某个 Markdown 块的可视化渲染。

早期内置 Mermaid（`render.ts` + `diagram.ts`）走出了预览壳 + 异步绘制路径。思维导图、ECharts 等需求与之同构，已抽成**可注册的块渲染器**；Mermaid 本身也迁到 `@v5md/plugin-mermaid`，不再写死在 `renderCode`。

## 2. 目标

- 插件可通过 `blocks` 声明一个或多个块渲染器。
- 载体为一期仅限 **GFM/CommonMark fenced code**（用 `lang` 区分类型）。
- 支持同步壳 + 可选异步 `hydrate`，并与现有「每次 commit 全量重渲染」共存。
- 可安装 / 卸载；卸载后回退为普通代码块。
- 重依赖留在 `@v5md/plugin-*`，不进入 `@v5md/view` 主包。
- 不传 `blocks` 时除已移除的内置 Mermaid 外，行为与原先一致。

## 3. 非目标（一期）

- 修改 `@v5md/core` 新增 AST 节点类型
- 插件扩展 micromark/mdast 语法
- 任意 HTML / iframe 自由渲染
- 远程插件市场与沙箱
- 增量 DOM diff 引擎（只做块实例级 reuse）
- 立刻将内置 Mermaid 拆成独立插件（二期可选）

## 4. 可行性结论

**可行。**

理由：

1. 数据模型继续用 Markdown 字符串，自定义块用围栏语言标记即可。
2. Mermaid 已验证预览壳、void 点击、active 源码切换。
3. 现有插件注册 / 卸载骨架可复用，只需增加渲染表。
4. 主要风险是全量 `replaceChildren` 毁掉 chart 实例——用冻结的 `key` + `destroy`/`update`/`hydrate` 协议解决，不必重做编辑器内核。

## 5. 总体架构

```text
Markdown ──parse──► MdNode(code, lang=…)
                         │
              renderDocument + BlockRendererRegistry
                         │
         ┌───────────────┴────────────────┐
         ▼                                ▼
   默认 code/math                 插件 mermaid/echarts/…
         │                                │
         └─────── 同步 DOM 壳 ────────────┘
                         │
              reconcile(key) → update | hydrate | destroy
                         │
              ECharts.init / markmap / mermaid.render / …
```

编辑器每次 `commit` → `render()` 仍可全量重建**壳**；插件 widget 实例通过 key 在壳之间搬迁或销毁。

## 6. 与全量重渲染的协作

| 步骤 | 行为 |
| --- | --- |
| render 前 | 收集旧实例表 `key → instance` |
| 同步 render | 对命中的 code 节点调用 `render()` 得到新壳 |
| reconcile | key 命中且 renderer 提供 `update` → 复用；否则旧实例 `destroy`，新实例待 `hydrate` |
| render 后 | 对新增/需刷新项调用 `hydrate`，传入 `isCurrent` + `AbortSignal` |
| 插件卸载 | 该 renderer 全部 `destroy`，后续按默认代码块渲染 |

`source` 哈希不变时禁止无意义的整图重绘；快速输入时过期的 `hydrate` 必须丢弃。

## 7. 编辑 / 预览 / 源码模式

| 模式 | 行为 |
| --- | --- |
| 源码模式 | 不走块渲染器 |
| 预览（只读） | 只显示预览；点击 void 不进入源码编辑（或仅只读交互） |
| 编辑 | 默认预览；块激活后编辑 fence 正文；离开后按新 source 更新 |

插入方式复用现有命令体系，例如 `echarts.insert` / `mermaid.insert` 插入模板围栏；工具条项挂到 `toolbar`；斜杠菜单挂到 `slash`（内置项在前，插件项按 `order` 排在后）。

## 8. 导出

`@v5md/plugin-export` 基于当前渲染 DOM：

- 预览槽在导出前应已有可序列化内容（SVG / 图片 / 静态 markup）。
- Canvas 类渲染器应在 `hydrate`/`update` 后提供可见像素，或导出前生成快照。
- 一期不强制 `snapshot()` API；作为实现期增强。

## 9. 安全与依赖

- 默认只渲染 fenced 正文，不执行任意 Markdown HTML。
- ECharts 等配置建议 **JSON only**；若支持 JS option，必须显式 opt-in，默认关闭。
- 重库使用动态 `import()`，与 mermaid、export 一致。

## 10. 示例插件形态（非冻结，仅指引）

### `@v5md/plugin-echarts`

- 包路径：`packages/plugins/echarts`
- `id: 'echarts'`，`lang: 'echarts'`
- `source`：JSON option（禁止执行 JS）
- `hydrate` / `update`：`echarts.init` / `setOption`；`destroy`：`dispose`
- `commands` / `slash` / 工具条：`echarts.insert`；`api.insertTemplate()`
- playground-vue / playground-react 已接入；示例文档见 `samples/demo.ts`

### `@v5md/plugin-mermaid`

- 包路径：`packages/plugins/mermaid`
- `id: 'mermaid'`，`lang: 'mermaid'`
- 动态 `import('mermaid')`；`hydrate` / `update` 绘制 SVG，共享 source 缓存
- `commands` / `slash` / 工具条：`mermaid.insert`；`api.insertTemplate()`
- 未安装时 `mermaid` 围栏按普通代码块显示

### `@v5md/plugin-mindmap`

- 包路径：`packages/plugins/mindmap`
- `id: 'mindmap'`，`lang: 'mindmap'`（可配置同时匹配 `markmap`）
- `source`：Markdown 大纲（标题或缩进列表）
- 基于 `@markmap/parse` + `@markmap/view`；动态 import；`destroy` 释放实例
- `commands` / `slash` / 工具条：`mindmap.insert`；`api.insertTemplate()`
- 预览交互（缩放等）限于 void 区内；正文编辑仍走激活态源码

## 11. 落地路线

| 阶段 | 内容 | 验收 | 状态 |
| --- | --- | --- | --- |
| P0 | Registry + `renderCode` 查表；仅同步 `render` | 插件 lang 能换壳 | 已完成 |
| P1 | `hydrate` + abort + source 缓存 | 异步绘制正确，过期写回被拒绝 | 已完成 |
| P2 | key reconcile + `destroy` / `update` | 源码不变时复用 widget DOM | 已完成 |
| P3 | void 点击、active 源码、通用 `.v5-widget` 样式 | 行为对齐 mermaid | 已完成 |
| P4 | 官方示例插件 + 文档 / playground | `@v5md/plugin-echarts` + playground | 已完成 |
| P5 | slash 接入、Mermaid 插件化 | `V5mdPlugin.slash` + `@v5md/plugin-mermaid`；view 去掉 mermaid 依赖 | 已完成 |

## 12. 风险

| 风险 | 对策 |
| --- | --- |
| 全量 replaceChildren 毁掉实例 | 强制 key + destroy/update |
| 每次按键都重绘 | source 哈希；仅变更时 hydrate |
| 光标进入 canvas | `data-void` + contentEditable=false |
| 导出空白 | 预览可序列化；必要时导出前等待 hydrate |
| lang 抢注 | 安装期唯一性校验 |
| 主包变重 | 库与渲染器放插件包 |

## 13. 已确认取舍

- **方向**：在现有插件系统上增加 Block Renderer，而不是换编辑器内核。
- **载体**：fenced code `lang`，一期不新增 AST。
- **范式**：泛化 Mermaid（壳 + void 预览 + active 源码 + 异步绘制）。
- **API 版本**：保持 `PLUGIN_API_VERSION = 1`，以可选字段 `blocks` 扩展。
- **接口冻结**：以本文 §0 为准；其余章节为指导，实现期可细化。

## 14. 与相关文档的关系

| 文档 | 职责 |
| --- | --- |
| [`plugin-design.md`](./plugin-design.md) | 工具条、命令、API、生命周期（已落地） |
| `plugin-block-render.md`（本文） | 块可视化渲染扩展（一期接口冻结，P0–P5 已落地） |
| [`plugin-block-render-next.md`](./plugin-block-render-next.md) | 二期及以后开发清单（micromark / match 验收 / snapshot 等） |

应在 `plugin-design.md` 的进度/范围中保持交叉引用，避免两套插件叙事分叉。
