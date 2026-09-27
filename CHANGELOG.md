# boxw-fx 变更记录

版本以 git tag 冻结（`vN`），本文件只增不改历史段。v4 起仓库根即最新版本布局
（fx-core.js + effects/ + effects.json），不再使用 vN 目录副本。

## v6（2026-09-27）
- 新增 sakura 樱花飘落：精灵贴图粒子（AI 花瓣图集），局部椭圆发射区 + 寿命淡入淡出 +
  3D 翻面（镜像 UV 假背面 + 宽度下限防边缘细条）+ 风场摆动 + 三层景深（前景失焦 sprite）
- 新增 assets 机制：effects.json 条目可声明 `assets:[{file,sha256}]`，随依赖闭包拉取，
  脚手架生成时拷贝到壁纸根目录（vendor/ 之外）；首个使用者为 sakura
- 素材：assets/sakura/atlas.png（768x768，3x3 单元格，0-5 清晰 / 6-8 失焦）
- 其余 9 个特效与 fx-core.js 逐字节同 v5

## v5（2026-09-27）
- fx-core 修复：场景 pass 每帧 `gl.clear`。此前 sceneFbo 从不清空，加色类特效
  （aurora/snow/rain/fireflies/particles）在未勾选星空/网格等不透明底时，
  逐帧残留叠加数秒内饱和成全白
- 特效模块 9 个与 effects.json 条目内容未变（仅 version/core.sha256 随动）

## v4（2026-09-26）
- 布局迁移：仓库根 = 唯一源码（tag 寻址后 vN 目录退役），v1-v3 仍可通过各自 tag 拉取
- 特效集与 v3 相同（9 个），内容未变

## v3（2026-09-26）
- 新增 5 个程序化特效（无状态纹理、无 FBO，仅 drawScene 插槽）：
  aurora 极光幕帘 / grid 合成波网格 / snow 飘雪 / rain 雨丝 / fireflies 萤火虫
- 每个特效均带 enabled 开关（关闭零开销），数量随画质档位缩放
- stars/particles/ripple/bloom 与 v2 逐字节一致

## v2（2026-09-26）
- effects.json 每个特效新增 category 字段（背景/粒子/交互/后处理），供 BoxW 向导分类展示
- 渲染代码与 v1 一致，无功能变更

## v1（2026-09-26）
- 初版：fx-core.js（注册表/BwFx.create/autoWallpaper 契约胶水）+ stars/particles/ripple/bloom
