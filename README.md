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
├─ public/
│  ├─ data/manifest.json       # 场景清单（文档 §7.3 接口形状）
│  └─ assets/scenes/           # 泼溅资产（.splat/.spz/.ply）
├─ src/
│  ├─ main.js                  # 启动编排：预渲染保护/看门狗/校准面板
│  ├─ engine/
│  │  ├─ museum.js             # 核心：渲染循环/切厅/LRU/门洞/动态分辨率
│  │  ├─ walk-controls.js      # 第一人称控制 + AABB 碰撞 + 触屏
│  │  ├─ scene-manager.js      # 资产加载/常驻治理/预热
│  │  ├─ hotspots.js           # 热点与门洞 HTML 覆层
│  │  ├─ minimap.js            # Canvas 小地图
│  │  ├─ tour.js               # 导览巡游
│  │  └─ stats.js              # 埋点桩
│  └─ ui/ui.js                 # 加载/菜单/讲解卡/引导/HUD/设置
└─ tools/analyze-splat.mjs     # 泼溅资产分析（.splat/.spz 坐标分位与聚类）
```
