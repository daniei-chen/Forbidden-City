# 游戏化联动自动测试报告

> 由 `tools/gameplay-test.mjs` 生成 · 2026-10-20T03:16:54.494Z

结果：**16 / 16 通过**

| # | 检查项 | 结果 | 详情 |
| --- | --- | --- | --- |
| 1 | 新手引导自动弹出 | ✅ 通过 | {"active":true,"step":0,"done":false,"total":4} |
| 2 | 移动手感（2 秒 > 6m） | ✅ 通过 | {"dist":10.29} |
| 3 | 跳跃高度 > 0.9m 且落地 | ✅ 通过 | {"height":1.14,"landed":true} |
| 4 | 宫城探索记录发现 | ✅ 通过 | {"count":"2","hint":"下一处 太和殿 ↑ 357 m · 已发现 2/10"} |
| 5 | 中轴巡礼任务可完成 | ✅ 通过 | {"id":"axis","name":"中轴巡礼","progress":8,"total":8,"done":true,"title":"中轴行者"} |
| 6 | 图鉴可收录 | ✅ 通过 | {"got":3,"total":16} |
| 7 | 成就解锁记录 | ✅ 通过 | {"n":5,"last":{"name":"流连忘返","t":1792466061697}} |
| 8 | 拍照/相册/灯箱 | ✅ 通过 | {"total":1,"lbShown":true,"lbActive":true} |
| 9 | 投壶小游戏可玩 | ✅ 通过 | {"started":true,"score":4} |
| 10 | 宫灯谜题可作答 | ✅ 通过 | {"opened":true,"ok":true} |
| 11 | 许愿/上香/投喂互动 | ✅ 通过 | {"wishes":2,"incense":2} |
| 12 | 彩蛋互动（摸铜狮/喂雀） | ✅ 通过 | {"petLions":2,"feedBirds":2} |
| 13 | 氛围预设切换 | ✅ 通过 | {"theme":"night","weather":"rain","festival":true} |
| 14 | NPC 生态（伞/仪式/生活/寒暄） | ✅ 通过 | {"umb":{"total":16,"shown":16,"rain":0.99},"cyc":1} |
| 15 | 性能 HUD / 设置系统 | ✅ 通过 | {"text":"FPS 60 · Draws 771 · Tris 2.65M\n画质 low ·"} |
| 16 | 无运行时错误 | ✅ 通过 | {"errors":0,"app":true} |
