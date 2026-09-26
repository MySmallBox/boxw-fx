# boxw-fx 更新日志

## v1（2026-09-26）

首个版本。从 fx-lab 验证壁纸拆分而来，已在 WebView2 引擎下实机验收。

- `fx-core.js`：GL 工具、四阶段管线调度（sim → drawScene → post → composite）、
  特效注册表（`BwFx.register`）、门面（`BwFx.create`）、宿主契约胶水（`BwFx.autoWallpaper`）
- 特效模块：`stars`（背景星空）、`particles`（GPU 粒子场）、`ripple`（水面涟漪）、`bloom`（泛光）
- `effects.json`：机器可读注册表（参数、依赖、运行要求、文件哈希）
- 已知限制：
  - 特效关闭不释放显存（零绘制开销，v1 简化）
  - distort/additive 合成槽位各只有一个，多特效争同一槽位时注册序靠后的生效
  - `quality` 预设只覆盖 particles 与整体渲染缩放
