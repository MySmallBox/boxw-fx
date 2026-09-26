# boxw-fx — BoxWallpaper 特效库

给 BoxW live 壁纸用的薄 WebGL2 特效库。零依赖、无构建工具：
`fx-core.js`（注册表 / BwFx.create / bw* 契约胶水）+ `effects/<id>.js`（一特效一文件，自注册）。

## 目录结构（v4 起，仓库根 = 最新源码）

```
boxw-fx/
├── fx-core.js          库核心
├── effects/            特效模块（stars/particles/ripple/bloom/aurora/grid/snow/rain/fireflies…）
├── effects.json        注册表（特效 id/参数/依赖/分类，单一事实源）
├── releases.json       版本清单（latest + 各版本 pathPrefix + 文件 sha256，BoxW 的唯一网络入口）
└── CHANGELOG.md
```

历史版本靠 git tag 冻结（v1-v3 的 tag 树仍是 `vN/` 目录布局，releases.json 用 `pathPrefix` 区分）。

## 使用（推荐走 BoxW 向导）

BoxWallpaper「新建特效壁纸 → FX 脚手架」勾选特效即可：向导按依赖闭包只拉
core + 选中特效，生成自包含的 `vendor/` 目录壁纸（运行期永不联网）。

手动等价流程：

1. 壁纸目录放 `fx-core.js` + 需要的 `effects/*.js`（依赖见 effects.json 的 `deps`）
2. `index.html` 按 core 在前、依赖先行的顺序 `<script>` 引入
3. `main.js`：

```js
var fx = BwFx.create(canvas, {
    particles: { quality: 'mid' },
    ripple:    { strength: 1.0 },
    bloom:     true
});
BwFx.autoWallpaper(fx, { hud: 'hud' });  // 自动接 bwStart/bwResize/bwPause/bwResume/
                                         // bwHandleMouseMove/bwHandleClick/bwAudio 等契约
```

4. `wallpaper.json` 按注册表 `requires.capabilities` 声明能力；
   用户调参经 `fx.applyParam(id, value)` 路由（参数 id 形如 `<effect>.<param>`）

## 维护流程

- **加特效**：根 `effects/` 新文件 `BwFx.register(id, {...})` + `effects.json` 加条目（含 category/params/deps）
- **发版**：改根文件 → 脚本重算 `releases.json`（新 version 条目，`pathPrefix:""`，全部文件 sha256）→ commit → `git tag vN` → push main+tag；**tag 一经推送永不改动**
- **废弃特效**：新版本注册表标 `"deprecated": true`，运行时仅告警不崩溃

## 约定

- 输入统一归一化 uv 坐标（0..1，左上原点），`BwFx` 内部处理翻转
- 每个特效带 enabled 开关，关闭时零开销短路（不建纹理/FBO 或跳过 pass）
- 拼接式 GLSL 源码内禁用 `//` 行注释（行间无 `\n`，注释会吞掉后续代码）
- 目标环境：WebView2（Chromium WebGL2）；JavaFX 兜底引擎不支持，
  `BwFx.create` 检测 WebGL2 缺失时返回 null 并告警
