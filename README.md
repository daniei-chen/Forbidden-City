# 紫禁城 · 数字复原

以 **Three.js 程序化建模** 从零复刻的紫禁城中轴线三维场景。双击单个 HTML 即可在浏览器中游览，无服务器、无外部图片、无网络依赖。

[![Release](https://img.shields.io/github/v/release/daniei-chen/Forbidden-City?label=release)](https://github.com/daniei-chen/Forbidden-City/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r149-black.svg)](https://threejs.org)
[![Single File](https://img.shields.io/badge/single--file-HTML-gold.svg)](dist/forbidden-city.html)

- **在线体验**：<https://daniei-chen.github.io/Forbidden-City/>
- **单文件下载**：见 [Releases](https://github.com/daniei-chen/Forbidden-City/releases)（`forbidden-city.html`，双击即玩）

> **免责声明**：本项目为个人技术演示与数字文化遗产可视化尝试，与故宫博物院无隶属或合作关系；
> 模型由程序按公开尺寸资料生成，属于**接近一比一的程序化复原**，并非测绘级实景扫描。

![全景](shots/theme-day.webp)

## 渲染截图

| 白天 | 黄昏 |
| --- | --- |
| ![](shots/theme-day.webp) | ![](shots/theme-dusk.webp) |

| 夜景 | 雪景 |
| --- | --- |
| ![](shots/theme-night.webp) | ![](shots/theme-snow.webp) |

| 歇山顶（保和殿） | 太和殿室内 |
| --- | --- |
| ![](shots/xieshan.webp) | ![](shots/interior.webp) |

| 第一人称漫游 · 雪地脚印 | 午门 |
| --- | --- |
| ![](shots/walk-snow.webp) | ![](shots/hero-meridian.webp) |

| 月台铜鼎 | 檐下斗拱 |
| --- | --- |
| ![](shots/props-ding.webp) | ![](shots/dougong.webp) |

| 保和殿室内 | 乾清宫室内 |
| --- | --- |
| ![](shots/interior-baohe.webp) | ![](shots/interior-qianqing.webp) |

| 可漫游小人（第三人称） | 雪中漫游 |
| --- | --- |
| ![](shots/avatar-walk.webp) | ![](shots/avatar-snow.webp) |

| 御花园 | 体仁阁 |
| --- | --- |
| ![](shots/garden.webp) | ![](shots/tirenge.webp) |

| 文华殿院落 | 角楼 |
| --- | --- |
| ![](shots/wenhua.webp) | ![](shots/hero-meridian.webp) |

| 神武门内 · 顺贞门与马道 | 檐口瓦当与斗拱 |
| --- | --- |
| ![](shots/north.webp) | ![](shots/eave.webp) |

| 夜景宫灯 | 御花园（场景生机） |
| --- | --- |
| ![](shots/lanterns.webp) | ![](shots/garden.webp) |

| 太和门侍卫 | 御道巡游 |
| --- | --- |
| ![](shots/guards.webp) | ![](shots/walk.webp) |

| 城墙接地 AO | 移动云影 |
| --- | --- |
| ![](shots/wall-ao.webp) | ![](shots/cloud-shadow.webp) |

| 宫城小地图 | 文渊阁（黑琉璃瓦） |
| --- | --- |
| ![](shots/minimap.webp) | ![](shots/wenyuange.webp) |

| 檐下椽头 | 御猫 |
| --- | --- |
| ![](shots/rafters.webp) | ![](shots/cats.webp) |

| 御花园水池石桥 | 午门门钉 |
| --- | --- |
| ![](shots/garden-pool.webp) | ![](shots/gate-studs.webp) |

| 屏幕空间 AO（太和殿） | 堆秀山 · 御景亭 |
| --- | --- |
| ![](shots/ao.webp) | ![](shots/rockery.webp) |

| 慈宁宫院落 | 午门铺首门钉 |
| --- | --- |
| ![](shots/cining.webp) | ![](shots/pushou.webp) |

| 御道铜缸 | 三台螭首 |
| --- | --- |
| ![](shots/vats.webp) | ![](shots/spouts.webp) |

## 快速开始

| 方式 | 说明 |
| --- | --- |
| 在线体验 | <https://daniei-chen.github.io/Forbidden-City/>（GitHub Pages） |
| 单文件（推荐） | 从 [Releases](https://github.com/daniei-chen/Forbidden-City/releases) 下载 `forbidden-city.html`，或双击 `dist/forbidden-city.html`（约 10.4 MB，代码 + CC0 素材已内联） |
| 开发入口 | 双击 `index.html`（从 `js/` 加载模块，便于修改调试） |

若浏览器对本地文件有限制，也可在项目目录起静态服务器：

```bash
python -m http.server 8080    # 打开 http://localhost:8080
```

## 功能

- **瓦作与细部**：檐口瓦当 + 滴水（实例化）、栏板云纹浮雕、宫墙/木柱/金砖/汉白玉程序化凹凸贴图
- **补建建筑群**：体仁阁 / 弘义阁（两层、单檐庑殿 + 腰檐 + 平座）、文华殿 / 武英殿（门—正殿—穿廊—后殿院落）、御花园（钦安殿 / 天一门 / 万春亭 / 千秋亭（上圆下方）/ 浮碧亭 / 澄瑞亭 / 堆秀山 + 御景亭）
- **神武门内**：顺贞门（三座琉璃门）、延和门 / 集福门、承光门、北横街宫墙、东西马道漫坡
- **可漫游小人**：程序化卡通角色（官帽 / 朱袍 / 金边），第三人称相机，行走 / 奔跑 / 跳跃物理与肢体动画；可第一/第三人称切换（X），与建筑碰撞、可跳上矮台、可进三殿
- **真实 CC0 素材**：Poly Haven `chinese_garden` HDRI 作为环境光（按主题染色），`clay_roof_tiles_02` / `marble_01` / `stone_tiles_02` / `grey_plaster` 提供瓦面、汉白玉、金砖、宫墙的 PBR 法线与粗糙度；瓦面经"去色→琉璃金黄着色"保留真实瓦垄光影（清单见 [ASSETS.md](ASSETS.md)）`n- **性能/LOD（P5）**：屋顶构件按材质合并（每座屋顶 ~10 个网格 → 2–3 个）、远景剔除瓦当/椽头实例、NPC 远景隐藏；meshes 2453→2006，全景 draw calls 1759→1520（-14%）
- **性能优化**：高画质像素比 2→1.5、阴影按需更新（静止 8 帧 / 行走 3 帧）、SSAO 深度 pass 分辨率 0.6→0.45 且剔除远处小物体、MSAA 4→2、室内点光 3→1
- **新增细部**：铜缸（太平缸）12 座、三台/月台螭首排水兽首、屋顶瓦面纹理升级 512（6 垄/幅）
- **稳定性修复**：SSAO 深度解码修正（解决远景发灰/画面不稳定）、纹理各向异性抑制远景闪烁、自动降级改为一次性、透明贴地贴片偏移修正、相机远平面收紧提升深度精度
- **地面细节（P4/P3）**：墙根碎石与落叶堆积、墙面雨痕；Hero 金色窗框/门扇推广到太和门、乾清宫、坤宁宫、钦安殿、慈宁宫、文渊阁\n- **生活痕迹（P4）**：墙根苔藓条带、御道中轴磨损色带、树下落叶堆；侍卫巡逻增至 6 条路线、御猫 5 只、宫女 2 名\n- **内容密度（P4）**：补种 56 株树（外墙内侧/六宫院落/文华武英/御花园外缘）、树下落叶堆、御花园石桌石凳；Hero 细节推广到中和殿/保和殿
- **太和殿 Hero 高精试点（P3）**：立面每间金色窗框 + 上下槛、明间门扇（可入殿殿宇保留门洞）、柱头雀替、脊兽 10 只；所有新增构件合并绘制
- **渲染物理化（P2）**：Bloom 亮部泛光（白昼高光/夜景灯笼与窗光）、指数大气雾（FogExp2）、VSM 软阴影（柔和投影）；四时段独立 bloom 强度
- **环境声**：首次交互后开启风声/鸟鸣/脚步/跳跃声（N 键静音，WebAudio 合成无外部资源）
- **院落补建**：慈宁宫院落（慈宁门 → 重檐慈宁宫 → 大佛堂 + 院墙）；大门铺首衔环与鎏金门钉阵列
- **真实 SSAO**：后处理管线新增深度 pass（隔帧复用），深度边缘遮蔽让檐下、柱根、台阶、假山缝隙产生接触阴影；高画质生效，设置可关
- **近景细部**：大门鎏金门钉阵列（每门 7×7、两面）；御花园浮碧亭/澄瑞亭跨池石桥与水池栏杆
- **近景细部（续）**：檐下露明椽头（实例化）、文渊阁黑琉璃瓦顶、浴德堂；宫女 2 名、御猫 3 只
- **小地图 / 自动昼夜**：右上角宫城平面图（建筑、中轴、当前位置与朝向，M 键开关）；设置中可开启每 150 秒自动昼夜轮转
- **光影细节**：接地 AO 条带（城墙/台基阴影渐变）、移动云影、拍照滤镜（原色 / 暖金 / 黑白）
- **宫廷人物**：8 名宫门侍卫（站岗）+ 4 名巡游侍卫（沿御道/广场行走，带步行动画），共 12 人
- **拍照模式**：P 键或设置内按钮，隐藏界面并导出当前画面 PNG
- **环境生机**：飘落叶片（风场驱动、五色随机）、宫灯灯柱（12 座，随风轻摆、夜间自发光）、墙面风化水渍
- **飞鸟群**：22 只实例化飞鸟沿不同半径盘旋，随时间起伏与振翅
- **精细构件建模**：斗拱（实例化真实构件，檐下成排）、三足双耳带盖铜鼎（太和殿月台 18 座）、铜龟铜鹤、日晷嘉量
- **多树种树木**：枝干分段 + 树冠多球层，侧柏 / 古松 / 槐树三类形态，含树底 AO
- **殿内系统**：七座主要殿宇生成完整室内（地/墙/天花/梁枋/柱列/屏风/宝座/藻井/匾额/红毯），侧宫院等合批建筑自动生成简易室内
- **可入殿漫游**：太和殿 / 中和殿 / 保和殿 留出门洞，可沿台阶走入殿内（碰撞环 + 室内地面高度 + 最近殿内自动显示）
- **真正的歇山顶**：正脊 / 垂脊 / 戗脊、两山撒山坡带、垂直山花与博风板（保和殿、太和门、乾清门等）
- **太和殿室内**：金砖地面、六根缠龙金柱、髹金宝座与五扇屏风、蟠龙藻井、井口天花、和玺彩画、室内暖光
- **第一人称漫游**：WASD 移动、拖拽视角、Shift 疾行；建筑 / 城墙 AABB 碰撞、台阶与台基高度采样，可沿丹陛登上三台
- **环境遮蔽与雪地脚印**：建筑落地接触阴影（AO 贴片）；雪景漫游时生成渐隐脚印
- **四个时段**：白天 / 黄昏 / 夜景 / 雪景，颜色、光照、天空、材质 uniform 全部插值过渡
  - 夜景：星空、月光、宫灯点光、窗棂暖光（`emissiveMap`）、彩画微光
  - 雪景：屋面与地面雪覆盖（`onBeforeCompile` 注入 `uSnow`，不复制几何）、飘雪粒子
- **中轴巡礼**：沿中轴样条飞行的电影镜头，附带纪录片式字幕；可暂停 / 退出，拖动即接管
- **沉浸模式**：隐藏界面，自动巡礼 + 字幕，接近参考影片的观影体验
- **十个机位**：全景 / 太和殿 / 三台 / 中和殿 / 保和殿 / 太和门 / 午门 / 角楼 / 御花园 / 殿内
- **场景**：午门（凹字形·雁翅楼·五门洞）→ 内金水河五桥 → 太和门 → 三台 → 前三殿 → 后三宫 → 御花园 → 神武门；城墙、四隅角楼、东西华门、26 组侧宫院、护城河、宫墙外树带
- **交互**：鼠标拖拽 / 滚轮 / 右键平移；触屏单指旋转、双指缩放与平移；双击复位
- **工程能力**：
  - 画质档位（自动 / 高 / 中 / 低）：像素比、阴影贴图、云量、雪量、后期处理分级
  - 性能自适应：自动档持续低帧时自动降低渲染分辨率；可显示 FPS / draw call / 三角形数
  - 健壮性：WebGL 不可用提示、运行错误覆盖层、WebGL 上下文丢失提示、`prefers-reduced-motion` 适配、页面隐藏时暂停渲染
  - 设置持久化（localStorage）

## 操作

| 操作 | 说明 |
| --- | --- |
| 左键拖拽 / 单指拖动 | 环绕观察 |
| 滚轮 / 双指捏合 | 缩放 |
| 右键拖拽 / Shift + 拖拽 / 双指平移 | 平移 |
| `1`–`9` | 切换机位 |
| `0` | 太和殿室内 |
| `V` | 进入 / 退出漫游模式（第三人称小人） |
| `空格` | 漫游时跳跃 |
| `X` | 漫游时切换第一 / 第三人称 |
| `T` | 循环切换时段 |
| `L` | 标注开关 |
| `F` | 帧率显示 |
| `C` | 沉浸模式 |
| `空格` | 巡礼开始 / 暂停 |
| `Esc` | 关闭抽屉 / 帮助，退出巡礼与沉浸 |

截图参数：`?still=1&view=1&theme=night&labels=1&quality=high`（`theme`: day/dusk/night/snow）。

## 工程结构

```
forbidden-city/
├─ index.html            入口（UI / 样式 / 加载顺序）
├─ three.min.js          three.js r149（本地，MIT）
├─ js/
│  ├─ config.js          版本、画质档位、四套时段主题（含调色参数）
│  ├─ textures.js        纯 Canvas 程序化贴图（瓦/斗拱/彩画/门窗/石材/水/雪点/星点/匾额…）
│  ├─ materials.js       材质库 + 雪覆盖 shader 注入 + 夜间窗光
│  ├─ geometry.js        参数化凹曲屋顶 / 翼角 / 脊饰 / 栏杆 / 台阶 / 静态合批
│  ├─ buildings.js       殿宇 / 城门 / 角楼 / 城墙 / 桥 / 华表 / 铜狮 / 树
│  ├─ layout.js          总平面装配（中轴、三台、金水河、侧宫院、树带、陈设）
│  ├─ garden.js          御花园建筑群 + 文华殿 / 武英殿院落
│  ├─ interior.js        太和殿室内（宝座 / 金柱 / 藻井 / 天花 / 暖光）
│  ├─ walk.js            第一人称漫游（碰撞 / 台阶高度 / 脚印触发）
│  ├─ details.js         精细构件：铜鼎 / 树木 / 斗拱 / 铜龟铜鹤
│  ├─ avatar.js          可漫游小人（模型 / 动画 / 第三人称）
│  ├─ npc.js             宫廷人物（侍卫站岗 / 巡游）
│  ├─ effects.js         雪粒子 / 星空 / 宫灯 / 雪地脚印（各 1 个 draw call）`n│  ├─ assets.js          真实素材加载（HDRI / PBR，失败回退程序化）
│  ├─ post.js            后期：HDR 目标 → 显示空间调色 / 暗角 / 颗粒（天空单独处理）
│  └─ main.js            渲染器、主题系统、轨道相机、巡礼、画质、输入、UI
├─ tools/
│  ├─ build.mjs          单文件构建（内联 + 版本号 + 桌面副本）
│  ├─ check.mjs          静态检查（语法 / 引用 / 文件 / 产物）
│  ├─ smoke.mjs          无头浏览器冒烟测试（启动 / 四时段 / 标注 / 巡礼 / 画质）
│  └─ shots.mjs          多机位截图
├─ dist/                 构建产物（单文件 HTML + build-info.json）
├─ shots/                渲染截图
├─ REFERENCE.md          建筑尺寸 / 形制 / 配色参考资料
└─ CHANGELOG.md
```

### 脚本

```bash
npm run check     # 静态检查：语法、引用、产物
npm run build     # 构建单文件（并复制到桌面）
npm run smoke     # 无头 Chrome 冒烟测试（需要本机 Chrome/Edge）
npm run shots     # 批量渲染机位截图
```

> 冒烟测试会启动无头 Chrome（`CHROME_PATH` 可指定浏览器路径），输出 `shots/smoke-*.png`。

## 技术要点

**歇山顶**：前后坡 + 两山撒山坡带 + 垂直山花（三角墙）+ 博风板 + 正脊鸱吻，与庑殿顶共用同一套凹曲/起翘参数。

**精细构件**：斗拱采用 InstancedMesh 逐朵布置（含坐斗、横拱、升、昂、耍头），铜鼎为旋转体 + 管状三足 + 双耳盖钮，树木为分段枝干 + 多球冠层。

**屋顶**：屋面为参数化曲面，高度按 `y(s) = y₀ + (y₁−y₀)(1 − (1−s)^0.72)` 变化（近脊陡、近檐缓，即"举折/反宇"），再叠加翼角起翘与冲出；垂脊由同一方程采样放样成管，与屋面严格贴合；正脊、鸱吻、走兽、宝顶为程序化脊饰。

**材质**：全部贴图由 Canvas 生成（固定随机种子，每次加载一致）；雪覆盖通过向 `MeshStandardMaterial` 注入 `uSnow` uniform 实时混色与粗糙度，无需复制或替换几何；夜间窗光复用立面贴图作为 `emissiveMap`。

**后期**：场景渲染到 HalfFloat HDR 目标（WebGL2 下带 4×MSAA），全屏 shader 做显示空间调色（染色 / 提亮 / 对比 / 饱和 / 暗角 / 颗粒）。天空通过 alpha 掩码单独处理，避免被色调映射二次提亮。低画质档自动回退为直接渲染。

**性能**：静态构件按材质合批（几千构件 → 数百 draw call）；阴影贴图仅按需刷新（静态场景只烘一次，光照变化时更新）；粒子各 1 个 draw call；画质分级 + 自适应像素比。

**颜色**：启用 three.js 现代颜色管理（sRGB 纹理解码、线性光计算）+ ACES 色调映射 + sRGB 输出。

## 尺寸依据

主要数据取自故宫博物院官网与公开测绘资料（前三殿区 234×353 m、三台 129×195 m、太和殿 63.96×37 m / 通高 35.05 m 等），详见 [REFERENCE.md](REFERENCE.md)。

## 已知简化

- 保和殿、太和门、东华门原为**重檐歇山**，本作统一按**重檐庑殿**曲面屋顶简化；
- 角楼按"三层檐 + 四面抱厦"近似，未完全还原十字歇山的复杂脊线；
- 午门五凤楼、后三宫为体量简化；侧宫院为程序化意象院落（非真实院落布局）；
- 尺寸为公开数据 + 比例校准的近似值，非测绘级复原。

## 验收与已知限制

逐条验收见 **[ACCEPTANCE.md](ACCEPTANCE.md)**（16 条：达成 13 条、基本达成 1 条、近似达成 1 条、环境受限未实测 1 条 —— 未达成项均为"程序化建模无法达到测绘级/真实 GPU 未实测"的客观限制，已在验收矩阵中如实标注）。

主要已知简化：

- 程序化建模，尺度与形制按公开数据接近，但非测绘级"一比一"复原
- 曲屋面/瓦件为参数化近似；室内陈设为程序化比例近似
- 人物与侍卫为卡通风格；未实现真实 SSAO / 体积光
- 性能未在真实 GPU 实测（无头环境为软件渲染），已内置 FPS 监控与自动降级
## 版本

见 [CHANGELOG.md](CHANGELOG.md)。当前 **v5.11.0**。

## 自动化评测（harness）

固定机位 × 四时段截图矩阵 + 硬指标 + 感知对比（SSIM / MAE / 亮度 / 直方图）+ HTML 报告，用于量化每次修改。

```bash
npm run harness:baseline   # 建立/更新基线（24 张：6 机位 × 4 时段）
npm run harness            # 与基线对比，输出报告并在超阈值时退出码 1
node tools/harness.mjs --no-compare   # CI：只渲染与出报告（不与本地基线比）
```

- 评测通过 `?static=1` 冻结动态元素、暂停 rAF 后用页面内 canvas 捕获，软件渲染下可复现；
- 阈值在 `harness/thresholds.json`（SSIM / MAE / 性能回退），矩阵在 `harness/matrix.json`；
- 报告：`harness/out/report.html`（当前 vs 基线并排 + 指标）；基线与截图存 `harness/baselines/`；
- 当前基线（v5.4.0）：24 张，重复运行 **SSIM≈0.996、MAE≈0.25%，判定 PASS**；
- GitHub Actions：示例见 `docs/ci-harness.yml.example`。复制到 `.github/workflows/harness.yml` 并给 token 授予 `workflow` scope（或网页端手动创建）即可启用，手动/推送触发并上传 report 工件。

## 外部素材（CC0）`n`n本项目使用 [Poly Haven](https://polyhaven.com) 的 CC0 素材（HDRI 与 PBR 贴图），完整来源、ID 与授权见 **[ASSETS.md](ASSETS.md)**。开发模式从 `assets/` 读取；单文件构建时由 `tools/build.mjs` 自动内联为 base64。`n`n## 许可与致谢

- 本项目代码以 **MIT License** 发布（见 [LICENSE](LICENSE)）。
- 捆绑的 `three.min.js` 为 [three.js](https://threejs.org) r149，MIT License，© mrdoob and three.js authors，其版权头保留在文件中。
- 除 three.js 外，所有模型、几何、程序化贴图、场景与截图均由本项目代码生成。
- 本项目为个人技术演示，与故宫博物院无隶属或合作关系。
