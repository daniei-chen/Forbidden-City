# 移动端低画质专项检查报告

> 由 `tools/mobile-check.mjs` 生成 · 2026-10-20T12:10:30.038Z
> 设备模拟：390×844 @2x（竖屏）/ 844×390 @2x（横屏），touch 开启，quality=low

结果：**9 / 9 通过**

| # | 检查项 | 结果 | 详情 |
| --- | --- | --- | --- |
| 1 | 移动端页面加载 | ✅ 通过 | ready=true |
| 2 | WebGL 渲染器可用 | ✅ 通过 | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, |
| 3 | 移动端安全区 CSS | ✅ 通过 | safe-area-inset 存在 |
| 4 | 触屏摇杆与按钮 | ✅ 通过 | {"display":"block","opacity":"1","stickW":132,"buttons":5} |
| 5 | HUD 与触控区不重叠 | ✅ 通过 | {"overlaps":[],"walkgame":{"top":497,"bottom":576,"left":10,"right":380}} |
| 6 | 引导卡与触控区不重叠 | ✅ 通过 | {"overlaps":[],"tutorial":{"top":378,"bottom":486,"left":10,"right":380}} |
| 7 | 摇杆驱动移动 | ✅ 通过 | {"touch":{"x":0,"y":1},"moved":2.31} |
| 8 | 移动端低画质帧率 | ✅ 通过 | {"frames":244,"ms":2502,"fps":98} |
| 9 | 竖屏/横屏截图 | ✅ 通过 | portrait=161322B landscape=177441B |

截图：`docs/mobile/portrait.jpg` · `docs/mobile/landscape.jpg`
