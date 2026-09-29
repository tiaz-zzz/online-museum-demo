import { NavApp } from './app.js';

/**
 * nav 入口：URL 参数 → NavApp。
 * 常用参数：
 *   ?file=<泼溅文件URL>        任意格式直连（.ply/.splat/.ksplat/.spz/.sog/.zip/meta.json/.rad）
 *   ?scene=<manifest sceneId>  使用 public/data/manifest.json 中的场景（缺省取第一条）
 *   ?up=±x|±y|±z               覆盖自动推断的 up 轴
 *   ?scale=<米/单位>            覆盖比例尺
 *   ?floor=<原始坐标>           覆盖地面高度（沿 up 轴的坐标分量值）
 *   ?spawn=x,y,z&yaw=度        出生点（原始坐标）与朝向
 *   ?mode=walk|fly             初始模式（默认 walk；推断失败自动兜底 fly）
 *   ?speed=<m/s> ?eye=<m> ?fov=<deg> ?cell=<格宽m> ?samples=<采样上限>
 *   ?map=1                     默认显示可行走区小地图
 *   ?nolock=1                  不请求鼠标锁定（拖拽环顾，便于调试/自动化测试）
 *   ?debug=1                   状态条常显标定 JSON
 */

/** 无 URL 参数时的默认场景（用户提供的展厅 PLY）+ 视觉校准的标定覆盖 */
const DEFAULT_SCENE = {
  file: 'assets/scenes/user-scene.ply',
  up: '+z',    // 视觉校准确认：+z 才是正立方向。-y 的可走面积指标更大但把墙面当了地面
  scale: 0.65, // 自动推断(0.43，按层高3.2m假设)偏大 → 相机悬空；视觉校准取 0.65（人物贴地）
};

/** URL 调试参数 */
const params = Object.fromEntries(new URLSearchParams(location.search));

// 无任何场景参数 → 默认加载 DEFAULT_SCENE 并应用其标定覆盖
// （必须在 NavApp 构造前写入：构造函数会把 params 快照进 _overrides）
if (!params.file && !params.url && !params.scene) {
  params.file = DEFAULT_SCENE.file;
  if (params.scale == null) params.scale = DEFAULT_SCENE.scale;
  if (params.up == null) params.up = DEFAULT_SCENE.up;
}

async function boot() {
  const canvas = document.getElementById('stage');
  const uiRoot = document.getElementById('nav-ui');
  const app = new NavApp({ canvas, uiRoot, params });
  window.__nav = app;

  // Chrome 投机预渲染期间不初始化渲染器（沿用博物馆 demo 约定）
  if (document.prerendering) {
    app.hud.setStatus('等待页面激活…');
    await new Promise((res) => document.addEventListener('prerenderingchange', res, { once: true }));
  }

  try {
    let manifest = null;
    if (!params.file && !params.url) {
      app.hud.setStatus('正在获取场景清单…', 0.04);
      try {
        const res = await fetch(new URL('./data/manifest.json', document.baseURI).href);
        if (res.ok) manifest = await res.json();
      } catch { /* 无 manifest 时必须显式 ?file= */ }
    }
    app.manifest = manifest;
    await app.boot();
  } catch (err) {
    console.error(err);
    app.hud.showError(err?.message || String(err));
  }
}

boot();
