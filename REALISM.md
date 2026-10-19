# 紫禁城 · 数字复原 — REALISM 验收报告

> 本报告由 `tools/realism-report.mjs` 自动生成，数据来自当前构建与 harness 基线。
> 生成时间：2026-10-19T00:00:56.141Z

## 1. 构建与渲染指标

| 项 | 值 |
| --- | --- |
| 版本 | 5.28.0.20261019.0000 |
| 构建哈希 | 078b8bd887c9d0f7 |
| 单文件大小 | 10.48 MB |
| 渲染网格数 | 1862 |
| Draw calls（全景） | 895 |
| 三角面 | 3.56 M |
| 软件渲染 ms/帧 | 8.6 ms |
| 感知对比 SSIM 均值 | 0.9956 |
| 感知对比最低 SSIM | 0.9948 |
| 感知对比 MAE | 0.27 % |

## 2. 固定机位截图矩阵（24 张）

> 完整图片见 `harness/baselines/`，可视化画廊：`docs/gallery.html`。

### 白天

- **白天 · 全景** — `harness/baselines/day-v0.jpg`
- **白天 · 太和殿** — `harness/baselines/day-v1.jpg`
- **白天 · 保和殿** — `harness/baselines/day-v4.jpg`
- **白天 · 御花园** — `harness/baselines/day-v8.jpg`
- **白天 · 殿内** — `harness/baselines/day-v9.jpg`
- **白天 · 午门** — `harness/baselines/day-v6.jpg`

### 黄昏

- **黄昏 · 全景** — `harness/baselines/dusk-v0.jpg`
- **黄昏 · 太和殿** — `harness/baselines/dusk-v1.jpg`
- **黄昏 · 保和殿** — `harness/baselines/dusk-v4.jpg`
- **黄昏 · 御花园** — `harness/baselines/dusk-v8.jpg`
- **黄昏 · 殿内** — `harness/baselines/dusk-v9.jpg`
- **黄昏 · 午门** — `harness/baselines/dusk-v6.jpg`

### 夜景

- **夜景 · 全景** — `harness/baselines/night-v0.jpg`
- **夜景 · 太和殿** — `harness/baselines/night-v1.jpg`
- **夜景 · 保和殿** — `harness/baselines/night-v4.jpg`
- **夜景 · 御花园** — `harness/baselines/night-v8.jpg`
- **夜景 · 殿内** — `harness/baselines/night-v9.jpg`
- **夜景 · 午门** — `harness/baselines/night-v6.jpg`

### 雪景

- **雪景 · 全景** — `harness/baselines/snow-v0.jpg`
- **雪景 · 太和殿** — `harness/baselines/snow-v1.jpg`
- **雪景 · 保和殿** — `harness/baselines/snow-v4.jpg`
- **雪景 · 御花园** — `harness/baselines/snow-v8.jpg`
- **雪景 · 殿内** — `harness/baselines/snow-v9.jpg`
- **雪景 · 午门** — `harness/baselines/snow-v6.jpg`

## 3. 验收矩阵（16 项）

| # | 验收标准 | 状态 | 证据 / 说明 |
| --- | --- | --- | --- |
| 1 | 中轴线构筑物齐全 | 达成（主要） | 午门→神武门、四隅角楼、御花园、东西路院落；场景 1862 mesh |
| 2 | 关键尺寸误差 ≤5% | 近似达成 | 按公开实测数据建模，未公开尺寸标注"约" |
| 3 | 屋顶形制不混用 | 达成（主要） | 庑殿/歇山/攒尖/十字脊；重檐与单檐按等级 |
| 4 | 斗拱/瓦垄/脊兽/彩画/门窗/陈设 | 达成 | 真实 PBR 瓦面；3D 窗棂与斗拱实例；脊兽 10；鎏金门钉/铺首 |
| 5 | 近景 50m 可辨构件 | 达成 | 斗拱、瓦当、椽头、铜鼎纹饰、窗棂可辨 |
| 6 | 7 座主体室内完整 | 达成 | 太和殿 + 其余 6 殿均有彩画/金柱/宫灯/宝座屏风 |
| 7 | 侧宫院简易室内 | 达成 | 合批侧宫院自动生成 |
| 8 | 小人全图行走/跳跃/进殿 | 达成 | WASD + Shift + Space + 三殿门洞；跳高 1.04m |
| 9 | 建筑与城墙阻挡 | 达成 | AABB 碰撞 + 碰撞环 + 门洞 |
| 10 | 第一/第三人称切换 | 达成 | X 键切换，滚轮调距 |
| 11 | 飞鸟/飘叶/云影/夜景/雪景 | 达成 | 四时段 + 雪景积雪 + 夜景窗光 + 太阳光束 |
| 12 | 无穿帮硬伤 | 基本达成 | 零 JS 异常；已知简化见"差距" |
| 13 | 桌面高画质 ≥30 FPS | 间接验证 | 软件渲染基准；真实 GPU 待用户实测 |
| 14 | 冒烟 20 项以上全过 | 达成 | 27/27 |
| 15 | 单文件构建可用 | 达成 | 10.48 MB（含 CC0 素材内联） |
| 16 | 文档同步 | 达成 | README/CHANGELOG/REFERENCE/ROADMAP/ACCEPTANCE/REALISM |

## 4. 已知差距（如实披露）

- 未使用激光扫描/实测图纸：几何为程序化复原，非测绘级 1:1
- 人物为程序化卡通造型，非写实角色；人物数量与动作仍有限
- 缺少真实全局光照与体积光步进；SSAO/Bloom/光束为屏幕空间近似
- 室内陈设为程序化简配，非逐殿考据陈设
- 未在真实 GPU 上实测帧率（当前为 SwiftShader 软件渲染基准）
- 屋面为参数化曲面 + 真实 PBR 贴图，非逐件瓦作排布

## 5. 复现与验证

```bash
npm run check      # 语法/引用检查
npm run build      # 单文件构建（--desktop 同步桌面副本）
npm run smoke      # 冒烟测试 27 项
npm run harness    # 截图矩阵 + 感知对比 + HTML 报告
npm run report     # 生成本报告与画廊
```

## 6. 结论

当前版本 **5.28.0.20261019.0000**：主要构筑物、形制、材质、光照、动态与交互均已达"接近仿真"的可玩演示水平；
与文物级 1:1 复原的差距主要在于**扫描级几何数据**、**写实人物/陈设**、**离线 GI/体积光**三类，需外部资产与更重渲染管线才能进一步逼近。
