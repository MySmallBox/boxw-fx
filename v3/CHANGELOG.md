# v3 变更（2026-09-26）

- 新增 5 个程序化特效（无状态纹理、无 FBO，仅 drawScene 插槽）：
  - aurora 极光幕帘（背景）：三层 fbm 幕帘 + 条纹噪声，加色叠加
  - grid 合成波网格（背景）：透视霓虹网格 + 地平线辉光，全屏不透明
  - snow 飘雪（粒子）：gl_VertexID 程序化落雪，风力/摆动/闪烁
  - rain 雨丝（粒子）：LINES 两段顶点渐隐拖尾
  - fireflies 萤火虫（粒子）：李萨如漂移 + 呼吸式明灭暖色光点
- 每个特效均带 enabled 开关（关闭零开销），数量随画质档位缩放
- stars/particles/ripple/bloom 渲染代码与 v2 逐字节一致，无功能变更
