# v5md 微信公众号发布包

给 v5md 写公众号推文要用的全部素材：文案、标题摘要、封面图、上线检查清单。所有内容以仓库当前状态为准（版本 `0.0.4`，2026-11-12）。

| 文件 | 说明 |
| --- | --- |
| [`v5md-公众号文案.md`](v5md-公众号文案.md) | 标题备选、摘要、可直接粘贴的正文 |
| [`images/cover-235x1-dark@2x.png`](images/cover-235x1-dark@2x.png) | 主封面 1800×766（2.35:1，上传用） |
| [`images/cover-235x1-dark.png`](images/cover-235x1-dark.png) | 主封面 900×383（预览用） |
| [`images/cover-1x1-dark@2x.png`](images/cover-1x1-dark@2x.png) | 分享封面 766×766（1:1，上传用） |
| [`images/cover-235x1-light@2x.png`](images/cover-235x1-light@2x.png) | 浅色备选封面（Mist 底） |
| [`images/`](images/) | 全部封面的 SVG 源文件（改字改色请改 SVG 再重新导出） |
| [`screenshots/`](screenshots/) | 6 张 Demo 实拍配图，已裁到 1080px 宽 |
| [`preview.html`](preview.html) | 公众号排版预览（手机框，浏览器打开） |
| [`发布清单.md`](发布清单.md) | 上传步骤与发布前检查 |

## 三步发布

1. **选标题和摘要**：从文案顶部「发布信息」里挑一个，摘要控制在 120 字内。
2. **传封面**：主封面用 `cover-235x1-dark@2x.png`（2.35:1），分享封面用 `cover-1x1-dark@2x.png`（1:1）。想换浅色风格就用 `cover-235x1-light@2x.png`。
3. **贴正文**：打开 `v5md-公众号文案.md`，复制 `<!-- 正文开始 -->` 之后的内容到公众号编辑器，按文中 4 处「配图建议」从 `screenshots/` 里插图，插完把这 4 行提示删掉。

## 封面说明

- **主封面**：深色渐变底上，一块薄荷高亮压住「按需显形」；右侧倾斜的白底编辑窗露出 `##` 和 `**`——左边是排版结果，右边是源码，正好演一遍「标记按需显形」。
- **浅色备选**：Mist 底 + 墨色大字，编辑窗反转为深色，适合浅色风格的账号。
- **1:1 分享图**：重排成上下结构，右上角 `##` 加光标，缩到 100×100 也能读清主标题。

## 链接

- GitHub：<https://github.com/zyw/v5md>
- Demo：<https://v5md-demo.v5ai.xin>
- 主页：<https://v5md.v5ai.xin>

> 公众号正文里的外部链接默认点不动。GitHub / Demo 请放到「阅读原文」、自动回复或公众号菜单，正文里保留纯文本地址方便读者手输。

## 改封面

封面是 SVG 源文件 + `rsvg-convert` 导出的 PNG，品牌色与字标规则见 [`brand/guidelines.md`](../../brand/guidelines.md)。改完重新导出：

```bash
cd docs/weixin/images
rsvg-convert -w 1800 -h 766 cover-235x1-dark.svg -o cover-235x1-dark@2x.png
rsvg-convert -w 900  -h 383 cover-235x1-dark.svg -o cover-235x1-dark.png
```
