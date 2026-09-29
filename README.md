# 云游博物馆 · 3DGS 高斯泼溅步入式漫游 Demo

按《在线博物馆-高斯泼溅技术选型与系统架构》（`../docs/在线博物馆-高斯泼溅技术选型与系统架构.md`）实现的 **M0+M1 里程碑演示**：three.js + Spark（高斯泼溅渲染层）+ Vite，覆盖步入式漫游、展品热点讲解、多展厅门洞切换、导览巡游与加载体验工程。

![技术栈](https://img.shields.io/badge/three.js-r186-blue) ![Spark](https://img.shields.io/badge/Spark-2.2-gold) ![Vite](https://img.shields.io/badge/Vite-7-green)

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
```

要求：Node ≥ 20、WebGL2 浏览器（近两年 Chrome/Edge/Firefox/Safari）。首次进入每个展厅需下载对应泼溅资产（31~78MB，本地静态文件）。

## 操作

| 桌面 | 移动端 |
| --- | --- |
| 点击画面锁定鼠标，`W A S D` 行走，`Shift` 疾走，鼠标环顾 | 左侧摇杆行走，右半屏拖动环顾 |
| `E` 查看近处展品，点击金色标记打开讲解卡 | 点击金色标记 |
| 走进绿色传送门切换展厅；`Esc` 呼出菜单 | 点击传送门；`☰` 呼出菜单 |

URL 调试参数：`?scene=1001&pos=x,y,z&yaw=度&debug=1`（定位/朝向）、`&calib=1`（校准面板）、`&noauto=1`（禁用门洞自动传送）、`&fov=`。

---

## 具身导航框架雏形（nav.html）

按《高斯泼溅场景具身导航论文整理.md》搭建的**第二入口**：一个可复用的 3DGS 具身导航框架骨架，演示"任意常见格式的泼溅场景 → 自动标定 → 泼溅推断可行走区 → 步入式漫游"的完整链路（博物馆 demo 的操控/碰撞随后可迁移到该框架上）。

```bash
npm run dev
# http://localhost:5173/online-museum-demo/nav.html                    # 默认场景 = assets/scenes/user-scene.ply（全自动标定）
# http://localhost:5173/online-museum-demo/nav.html?scene=1002         # manifest 场景
# http://localhost:5173/online-museum-demo/nav.html?file=任意.ply      # 任意格式直连
```

默认场景为 `public/assets/scenes/user-scene.ply`（用户采集的展厅门厅，63.2 万高斯）：无参数打开即按**视觉校准过的标定**（up=+z、scale=0.65m/单位）加载——自动推断的比例尺（0.43，按层高 3.2m 假设）会让相机悬空，故对默认场景显式固定；该场景也已登记为 manifest `sceneId 1005`。

### 场景格式适配（src/nav/core/scene-loader.js）

魔数探测优先、扩展名兜底，统一走 Spark worker 解码：

| 格式 | 说明 | 探测方式 |
| --- | --- | --- |
| `.ply` | 3DGS PLY（COLMAP/Postshot/混元等导出） | 魔数 `ply` |
| `.splat` | antimatter15 打包 | 扩展名（无魔数） |
| `.ksplat` | markwell 打包（含 LOD） | 扩展名（无魔数） |
| `.spz` | Niantic 压缩 | gzip 内魔数 |
| `.sog` / `.zip` | SOG（Self-Organizing Gaussians） | ZIP 魔数 + meta 探测 |
| `…/meta.json` 或目录 URL | SOG 解包目录 | 路径形态 |
| `.rad` | Radiance Fields 流式 | 魔数 |

> 注意：普通三角网格 PLY（顶点+面）不是泼溅资产，会被拒绝并提示。

### 自动标定与可行走区（core/calibrate.js + nav/occupancy.js）

- **up 轴推断**：六带符号轴打分（底部高密度薄层=地面），可 `?up=` 覆盖；
- **地面/天花板**：沿 up 轴直方图找底部/顶部密度峰（σ 倒数加权细化）；低矮房间的天花板会自动把障碍层上限收到天花板下方，防止顶面把全屋判成障碍；
- **自动整平**：对地板带采样点做平面拟合（PCA + 内点重拟合），拟合法向即真实"上"方向——手持采集的小倾角（实测该场景 4.5°）被自动归零，墙面/门框恢复竖直，无需手动旋转模型（博物馆 demo 的 UP_TABLE 为纯轴对齐，暂不享受整平，画面可能残留轻微倾斜）；
- **比例尺**：`?scale=` 优先，缺省按"地面→场景顶 ≈ 3.2m"反推（校准面板可微调）；
- **可行走网格**（论文路线① Splat-Nav 的 2D 简化版）：把抽样高斯按离地高度分带——地面带（|h|≤0.35m）证明可踩、身体带（0.35m~障碍上限）高密度判障碍；障碍按玩家半径膨胀、地面膨胀桥接缝隙；未知格保守不可走；
- **包围盒**：由地面层溅点分布决定（避免远景把场地撑大数倍）；
- 出生点：网格质心择优；清单/URL 出生点落在障碍上时自动吸附最近可行走格。

实测：`hunyuan.ply` 无任何人工配置直连，自动推断 up=+z（与人工校准一致），可行走网格恰好是展厅中轴通道。

> 已知边界：up 轴自动推断 + 六轴"最大连通可走域"回退是启发式——对盒子形房间，旋转 90° 的错误解释也可能自洽（把墙面当地面），此时可走面积指标反而更大。默认场景的 up/scale 已按视觉校准固定；其他场景可用 `?up=`/`?scale=` 或 C 校准面板覆盖。

### 操控（control/first-person.js，按键语义对齐 arrival.space 实测解析）

| 输入 | 行为 |
| --- | --- |
| **右键**点击画面 | 锁定 / 解锁鼠标（按下抬起 ≤6px；锁定后移动鼠标环顾） |
| `W A S D` / 方向键 | 行走（水平面前向移动，低头不减速；指数阻尼起停） |
| `Space` | 跳跃（行走模式；峰值 ≈0.43m，0.5s 防连跳，重力 9.81） |
| `V` | **第一 ⇄ 第三人称**（§6）：胶囊人物标记 + 0.8–4m 弹簧相机；第三人称下滚轮调距离，相机沿视线步进查网格防穿墙 |
| **左键**点击地面 | **点击自动行走**（§7）：射线取地面点 → 可行走才放置金色落点标记 → 复用移动通道走过去；任意输入/模式切换中断，0.6s 无进展自动放弃（直线寻路，被挡即停） |
| 未锁定时左键拖拽 | 环顾 |
| `Shift` | 疾行（飞行 ×3） |
| 滚轮 | 分级（§3）：行走第一人称/飞行=调速度；第三人称=调相机距离 |
| `F` | 行走 ⇄ 飞行（飞行沿视线移动、穿墙，便于检查场景） |
| `Q` / `E`（飞行） | 下降 / 上升（`Space` = 上升） |
| `H` | **隐藏 / 恢复 UI 覆盖层**（§2 overlay:toggleUI，纯净截图） |
| 手柄 | 左摇杆移动 · 右摇杆视角（≤100°/s）· A 跳跃（标准映射，死区 0.12） |
| 触屏 | 左半屏移动 · 右半屏环顾 · 右区 300ms 双击=跳跃 · 双指捏合调速度 · 摇杆拉出 3× 半径自动疾跑（§8） |
| `G` / `C` / `?` | 可行走区小地图 / 校准面板 / 帮助 |

工程细节（对齐 Arrival 解析文档）：仰角限位 **[−80°, +70°]**；`e.repeat` 忽略、blur/页面隐藏清零按键状态防卡死；UI 浮层与**鼠标悬停在小地图/面板上**都会通过 **CallerStack 计数守卫**（`core/input-guards.js`）压住场景输入（锁定/键盘/点击行走），多重叠加不互踩；竖屏时 FOV 自动抬升 ≥90°。

校准面板（C）可实时切换 up 轴、微调地面与比例尺、改出生点，并输出 manifest 兼容的 JSON 片段；每次修改即时重建可行走网格。

### 与论文的对应

| 论文路线 | 雏形实现 |
| --- | --- |
| ① Splat-Nav：从高斯解析自由空间 | occupancy.js：高斯分带投影 → 2D 占据/可行走网格 + 半径膨胀 |
| ⑤ ActiveSplat：Voronoi 骨架路点图 | 未含；可行走网格是其现成输入，后续可抽骨架 |
| ② GaussNav / ④ LangSplat：语义地图与语言接地 | 未含；manifest 热点表 + 网格是挂载点 |

### URL 参数

`?file=`（任意格式直连）、`?scene=`（manifest 条目）、`?up=±x|±y|±z`、`?scale=`（米/单位）、`?floor=`（沿 up 轴原始坐标）、`?rot=`（水平旋转度数）、`?spawn=x,y,z&yaw=度`、`?mode=walk|fly`、`?speed=`、`?eye=`、`?fov=`、`?cell=`（格宽米）、`?samples=`（采样上限）、`?map=1`、`?nolock=1`、`?debug=1`。

---

## 展厅与资产来源

| 展厅 | 资产 | 来源 | 体积 |
| --- | --- | --- | --- |
| 铁道藏品区 · 西部太平洋713号机车 | `train.splat` | Tanks & Temples 数据集（antimatter15 转换分发） | 31MB / 103万高斯 |
| 复原陈列厅 · 民居卧室 | `painted_bedroom.spz` | World Labs Marble 示例场景 | 7.5MB / 50万高斯 |
| 露天展区 · 馆藏老爷车 | `truck.splat` | Tanks & Temples 数据集（同上） | 78MB / 254万高斯 |
| 青铜器馆 · 混元生成展厅 | `hunyuan.ply` | **用户自备**：腾讯混元 3D 生成（3DGS PLY，52.8万高斯，up=+z） | 28MB |

> 以上公开资产仅作技术演示占位。正式版按文档 §4 管线（COLMAP → Nerfstudio/Postshot → SuperSplat 清理 → SOG 压缩）生产自有展厅资产。画面中的白色/蓝色漂浮伪影来自原始采集数据，正式流程中由 SuperSplat 清理阶段去除。

## 与技术方案文档的对应关系

| 文档条目 | Demo 实现 |
| --- | --- |
| F1 步入式漫游（§6.1/6.2） | PointerLock + WASD + 触屏摇杆；碰撞为**外边界 + 墙体 AABB 简化**（正式版：SuGaR 代理网格 + BVH 胶囊体） |
| F2 多展厅切换（§6.3） | 场景清单 manifest + 门洞（`doorPos/radiusM/entry`）近距自动传送 + 淡入淡出；**LRU 常驻 ≤2 厅**，邻厅头部字节预热 |
| F3 展品热点（§6.4） | HTML 覆层标记（CSS2D 方案）+ 距离衰减 + `E` 键互动 + 讲解卡（含 Web Speech 语音讲解；3D 特写为 M3 占位） |
| F4 导览巡游 | manifest `tour.waypoints` 相机路径回放，任意用户输入退出 |
| F7 访问统计 | `src/engine/stats.js` 埋点桩：进厅/热点点击/性能样本写入 localStorage，可配 `museum.statsUrl` 上报 |
| §7.3 manifest 接口 | `public/data/manifest.json` 完全沿用文档字段（sceneId/splat/spawn/bounds/neighbors/doorPos），Demo 仅扩展 `up/scale/walls/hotspots/tour` |
| §8.1 加载工程 | HTML 直出品牌 Splash + 看门狗 15s + `document.prerendering` 保护 + 分级进度文本（"正在加载 xx厅 64.1/77.6MB · 83%"） |
| §8.2 运行时性能 | Spark Worker 排序；动态渲染倍率（auto 档按 FPS 55~57 区间升降 0.6~1.0）；省电模式限帧 30；FPS/内存/高斯量 HUD |

未包含（按路线图属 M2/M3）：管理端（RuoYi）、SOG 分块流式、SSR/SEO 落地页、多人同游、WebXR、代理网格物理。

## 如何接入你自己的 PLY（如混元 3D 导出的泼溅）

Spark 原生支持 **3DGS 格式的 `.ply`**（含 `scale/rot/opacity/f_dc/f_rest` 高斯属性的顶点格式），接入步骤：

1. 把文件放到 `public/assets/scenes/你的场景.ply`；
2. 在 `public/data/manifest.json` 的 `scenes` 里加一条（复制现有条目改 `sceneId/name/splat.url`，`format: "ply"`）；
3. **校准坐标系**（三种格式坐标约定不同，必须做）：
   ```bash
   node tools/analyze-splat.mjs public/assets/scenes/你的场景.ply 5   # 输出分位数包围盒 + 聚类热点候选
   ```
   然后以 `?debug=1&noauto=1&scene=你的ID&calib=1` 进入校准模式：试出正确的 `up`（`+y`/`-y`，COLMAP 系通常是 `-y`）、`floorY`（数据里的地面值）、`scale`（米/单位，用已知尺寸物体反推）、出生点与热点（校准面板按钮会把坐标片段吐到文本框）；
4. 配好 `bounds`（把玩家限制在采集气泡内，出气泡会看到大片失焦高斯）与 `neighbors` 门洞即可。

注意事项：

- **只有"高斯泼溅 PLY"可以直接接入**。如果混元导出的是普通三角网格 PLY（顶点+面），那是网格资产不是泼溅，需走 three.js 普通 Mesh 渲染或转换为高斯表示；
- 单厅建议 ≤100MB、≤300 万高斯（文档 §2.2）；大文件先用 [SuperSplat](https://superspl.at) 清理（删浮点/裁剪）并导出 `.spz`（约 10× 压缩）或 SOG；
- `.spz` 经 Spark 内部处理后的坐标与原始解码值不同，**以 `mesh.getBoundingBox()` 返回值为准**标定（`.splat/.ply` 则与原始坐标一致）。

## 目录结构

```
├─ index.html                  # 直出 Splash + SEO/JSON-LD + 无 JS 降级
├─ nav.html                    # 具身导航框架雏形入口（?file= 任意格式直连）
├─ public/
│  ├─ data/manifest.json       # 场景清单（文档 §7.3 接口形状）
│  └─ assets/scenes/           # 泼溅资产（.splat/.spz/.ply）
├─ src/
│  ├─ main.js                  # 启动编排：预渲染保护/看门狗/校准面板
│  ├─ engine/                  # 博物馆 demo 引擎
│  │  ├─ museum.js             # 核心：渲染循环/切厅/LRU/门洞/动态分辨率
│  │  ├─ walk-controls.js      # 第一人称控制 + AABB 碰撞 + 触屏
│  │  ├─ scene-manager.js      # 资产加载/常驻治理/预热
│  │  ├─ hotspots.js           # 热点与门洞 HTML 覆层
│  │  ├─ minimap.js            # Canvas 小地图
│  │  ├─ tour.js               # 导览巡游
│  │  └─ stats.js              # 埋点桩
│  ├─ ui/ui.js                 # 加载/菜单/讲解卡/引导/HUD/设置
│  └─ nav/                     # ★ 具身导航框架雏形（可复用模块）
│     ├─ main.js / app.js      # 参数解析 + NavApp 编排（加载→标定→网格→循环）
│     ├─ core/scene-loader.js  # 多格式探测与加载适配层（.ply/.splat/.ksplat/.spz/.sog/.rad）
│     ├─ core/calibrate.js     # 自动标定：up 轴/地面/天花板/比例尺/包围盒 + 高斯抽样
│     ├─ nav/occupancy.js      # 可行走区域网格（Splat-Nav 简化版）+ 最近可行走点吸附
│     ├─ control/first-person.js # 方向键/WASD+鼠标锁定+拖拽兜底+触屏+滚轮调速+飞行
│     └─ ui/hud.js / nav.css   # 准星/帮助/校准面板/可行走区小地图/toast
└─ tools/analyze-splat.mjs     # 泼溅资产分析（.splat/.spz 坐标分位与聚类）
```
