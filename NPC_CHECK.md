# NPC 行为专项检查报告

> 由 `tools/npc-check.mjs` 生成 · 2026-10-20T18:24:19.047Z
> 独立页面、小步模拟（避免长循环导致 headless 卡顿）

结果：**6 / 6 通过**

| # | 检查项 | 结果 | 详情 |
| --- | --- | --- | --- |
| 1 | 页面加载 | ✅ 通过 | ready=true |
| 2 | 舞龙观众驻足 | ✅ 通过 | {"active":1,"events":1,"off":false} |
| 3 | 灯会 NPC 观灯 | ✅ 通过 | {"active":2,"events":2,"after":0} |
| 4 | 灯会锣鼓队节拍 | ✅ 通过 | {"beats":1} |
| 5 | 放河灯宫女 | ✅ 通过 | {"released":1,"spawned":1} |
| 6 | NPC 猜谜围观 | ✅ 通过 | {"active":1,"events":1,"armR":-1.88} |
