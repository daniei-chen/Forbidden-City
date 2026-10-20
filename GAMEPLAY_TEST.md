# 游戏化联动自动测试报告

> 由 `tools/gameplay-test.mjs` 生成 · 2026-10-20T10:05:18.538Z

结果：**22 / 22 通过**

| # | 检查项 | 结果 | 详情 |
| --- | --- | --- | --- |
| 1 | 新手引导自动弹出 | ✅ 通过 | {"active":true,"step":0,"done":false,"total":4} |
| 2 | 移动手感（2 秒 > 6m） | ✅ 通过 | {"dist":10.29} |
| 3 | 跳跃高度 > 0.9m 且落地 | ✅ 通过 | {"height":1.14,"landed":true} |
| 4 | 宫城探索记录发现 | ✅ 通过 | {"count":"2","hint":"下一处 太和殿 ↑ 357 m · 已发现 2/10"} |
| 5 | 中轴巡礼任务可完成 | ✅ 通过 | {"id":"axis","name":"中轴巡礼","progress":8,"total":8,"done":true,"title":"中轴行者"} |
| 6 | 图鉴可收录 | ✅ 通过 | {"got":3,"total":16} |
| 7 | 御猫图鉴可收集 | ✅ 通过 | {"got":7,"total":7} |
| 8 | 成就解锁记录 | ✅ 通过 | {"n":7,"last":{"name":"流连忘返","t":1792490549072}} |
| 9 | 拍照/相册/灯箱 | ✅ 通过 | {"total":1,"lbShown":true,"lbActive":true} |
| 10 | 投壶小游戏可玩 | ✅ 通过 | {"started":true,"score":4} |
| 11 | 宫灯谜题可作答 | ✅ 通过 | {"opened":true,"ok":true} |
| 12 | 许愿/上香/投喂互动 | ✅ 通过 | {"wishes":2,"incense":2} |
| 13 | 彩蛋互动（摸铜狮/喂雀） | ✅ 通过 | {"petLions":2,"feedBirds":2} |
| 14 | 氛围预设切换 | ✅ 通过 | {"theme":"night","weather":"rain","festival":true} |
| 15 | NPC 生态（伞/仪式/生活/寒暄） | ✅ 通过 | {"umb":{"total":16,"shown":16,"rain":0.99},"cyc":1} |
| 16 | 舞龙观众驻足 | ✅ 通过 | {"events":2,"maxWatching":1} |
| 17 | 灯会 NPC 观灯 | ✅ 通过 | {"events":18,"maxWatching":2} |
| 18 | 灯会锣鼓队节拍 | ✅ 通过 | {"beats":233} |
| 19 | 灯会夜游导览五站 | ✅ 通过 | {"got":5,"hint":"灯会导览已完成 · 尽情夜游吧"} |
| 20 | 灯会宫灯串 | ✅ 通过 | {"count":40,"firstY":4.06} |
| 21 | 性能 HUD / 设置系统 | ✅ 通过 | {"text":"FPS 60 · 帧时 16.7ms · 1%低帧 60\nDraws 325 ·"} |
| 22 | 无运行时错误 | ✅ 通过 | {"errors":0,"app":true} |
