# boxw-fx 变更记录

版本以 git tag 冻结（`vN`），本文件只增不改历史段。v4 起仓库根即最新版本布局
（fx-core.js + effects/ + effects.json），不再使用 vN 目录副本。

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
