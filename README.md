# boxw-fx — BoxWallpaper 特效库

给 BoxW live 壁纸用的薄 WebGL2 特效库。单文件、零依赖、无构建工具：
开发者把某个版本的 `boxw-fx.js` 拷进自己壁纸目录即完成"安装"并锁定版本。

## 目录结构

```
boxw-fx/
├── v1/
│   ├── boxw-fx.js      特效实现 + 内嵌注册表（BwFx.VERSION = '1'）
│   ├── effects.json    注册表镜像（供工具/应用读取，与内嵌部分同源）
│   └── CHANGELOG.md
└── demos/              每个特效一个完整可运行的演示壁纸
```

## 开发者：查询可用特效

看 `v1/effects.json`，每个条目含：显示名、参数（类型/默认值/范围）、
依赖的 capabilities、最低引擎要求。效果长什么样直接跑 `demos/` 对应壁纸。

## 开发者：使用（完整流程）

1. 新建壁纸目录，拷贝 `v1/boxw-fx.js` 进去（此后官方升级不影响你）
2. `index.html`：`<script src="boxw-fx.js"></script>`
3. `main.js`：

```js
var fx = BwFx.create(canvas, {
    particles: { quality: 'mid' },
    ripple:    { strength: 1.0 },
    bloom:     true
});
BwFx.autoWallpaper(fx);   // 自动接 bwStart/bwResize/bwPause/bwResume/
                          // bwHandleMouseMove/bwHandleClick/bwAudio
```

4. `wallpaper.json` 按注册表 `requires.capabilities` 声明能力；
   需要给用户调参就把注册表 params 抄进 `params`，转发 `fx.applyParam(id, value)`

## 官方：维护流程

- **加特效**：`boxw-fx.js` 中 `register(id, {...})` + 注册表加条目 + 写演示壁纸
- **发版**：`v1/` 完整复制为 `v2/`，改版本号，打 git tag；**旧版本目录永不修改**
- **废弃特效**：新版本注册表标 `"deprecated": true`，运行时仅告警不崩溃；
  强制下线走 BoxW 的 effect-blocklist 机制（预留，未实现）

## 约定

- 输入统一归一化 uv 坐标（0..1，左上原点），`BwFx` 内部处理翻转
- 每个特效的参数关闭时必须零开销短路（不建纹理/FBO 或跳过 pass）
- 目标环境：WebView2（Chromium WebGL2）；JavaFX 兜底引擎不支持，
  `BwFx.create` 检测 WebGL2 缺失时返回 null 并告警
