# @v5md/plugin-video

把 ` ```video ` / ` ```audio ` 围栏块渲染成浏览器原生播放器。

Markdown 没有视频语法；v5md 沿用图表插件的围栏块方案：围栏在别的解析器里就是普通代码块，内容不会丢，在 v5md 里是一个可编辑的播放器。

## 安装

```bash
npm install @v5md/plugin-video
```

## 使用

```ts
import { createVideoPlugin, type VideoApi } from '@v5md/plugin-video'

const editor = new Editor({
  element,
  plugins: [createVideoPlugin()],
})

// 工具条「视频」、斜杠菜单或命令
await editor.runCommand('video.insert', 'https://cdn.example.com/clip.mp4')

const api = editor.getPlugin<VideoApi>('video')!.api
api.insert('https://cdn.example.com/clip.mp4', { poster: 'cover.jpg', title: '发布会回放', start: 42 })
api.insert('https://cdn.example.com/intro.mp3', { audio: true })
```

## 围栏写法

围栏正文支持四种写法，按顺序识别：

````md
```video
https://cdn.example.com/clip.mp4
```
````

````md
```video
[发布会回放](https://cdn.example.com/clip.mp4)
```
````

````md
```video
src=https://cdn.example.com/clip.mp4 poster=cover.jpg title="发布会回放" start=42s
```
````

````md
```video
{"src":"https://cdn.example.com/clip.mp4","poster":"cover.jpg","title":"发布会回放","start":42}
```
````

| 字段 | 说明 |
| --- | --- |
| `src` | 视频直链。相对路径（如 `assets/clip.mp4`）按页面地址解析 |
| `poster` | 封面图，播放前和无法播放时显示 |
| `title` | 标题，显示在播放器下方，同时作为 `aria-label` |
| `start` | 起始秒数，写 `42s` 或 `42`；播放器上会出现 `0:42` 角标，点一下从该处播放 |

` ```audio ` 围栏用同一套写法，渲染成 `<audio>`；`audio` 围栏里也可以放视频地址，播放器会按标签决定。

## 选项

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名，默认 `video` |
| `lang` | 匹配的围栏语言，默认 `['video', 'audio']` |
| `toolbar` | 是否显示「视频」「音频」按钮，默认 `true` |
| `mediaAttributes` | 附加到 `<video>` / `<audio>` 的属性，如 `{ muted: '', crossOrigin: 'anonymous' }` |
| `locale` | 按钮与提示文案语言，`zh-CN`（默认）或 `en` |

## 行为

- 播放器就是原生 `<video controls>`：不引入依赖，浏览器自带全屏、倍速、字幕。
- 只改周边文字时播放器不重建：不会重新加载，播放进度保留。
- 能播的格式按扩展名给 `<source type>`：`mp4` / `m4v` / `webm` / `ogv` / `ogg` / `mov`，音频 `mp3` / `m4a` / `aac` / `wav` / `ogg` / `opus` / `flac` / `webm`。
- 不能播的地址不丢内容，显示封面块并说明原因：
  - B 站 / YouTube / 抖音等平台页面：v5md 不嵌 iframe，请换 mp4 直链；
  - 浏览器不支持的格式：换 `mp4` 或 `webm`；
  - 围栏为空：提示填地址。
  封面上的播放按钮直接链接到源地址，新标签页打开。
- 播放中途解码失败时自动换成封面，而不是留一块黑屏。

## 边界

| 场景 | 结果 |
| --- | --- |
| GitHub / GitLab 的 Markdown | 显示成代码块，地址仍在 |
| 复制到公众号 | 公众号只接受微信自家视频，这里不会带过去 |
| 导出 HTML / PDF / 图片 | 导出插件只导出当前 DOM 的文字，视频不会进去 |
| 跨域播放 | 需要源站允许 `Range` 与 CORS；`crossOrigin` 用 `mediaAttributes` 配 |

未安装本插件时，`video` / `audio` 围栏按普通代码块高亮显示。
