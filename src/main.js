import './style.css';
import { MuseumApp } from './engine/museum.js';
import { UI } from './ui/ui.js';

/** URL 调试参数：?scene=1001&pos=x,y,z&yaw=deg&pitch=deg&fov=&debug=1&calib=1&nolock=1 */
const params = Object.fromEntries(new URLSearchParams(location.search));

async function boot() {
  const status = document.getElementById('splash-status');
  const bar = document.getElementById('splash-bar');
  // Splash 看门狗（文档 §8.1：15s 兜底，启动失败也不得永久遮挡）
  const watchdog = setTimeout(() => {
    document.getElementById('splash')?.remove();
    document.getElementById('loader')?.classList.remove('show');
  }, 15000);

  try {
    if (!('WebGL2RenderingContext' in window) || !document.getElementById('stage').getContext('webgl2')) {
      throw Object.assign(new Error('此浏览器不支持 WebGL2，无法渲染高斯泼溅场景。请使用近两年的 Chrome / Edge / Firefox / Safari。'), { fatal: true });
    }

    // Chrome 投机预渲染期间不初始化渲染器（文档 §8.1）
    if (document.prerendering) {
      status.textContent = '等待页面激活…';
      await new Promise((res) => document.addEventListener('prerenderingchange', res, { once: true }));
    }

    status.textContent = '正在获取展厅清单…';
    bar.style.width = '20%';
    const res = await fetch('./data/manifest.json');
    if (!res.ok) throw new Error(`展厅清单加载失败 (${res.status})`);
    const manifest = await res.json();

    const ui = new UI({ manifest, params });
    const app = new MuseumApp({ canvas: document.getElementById('stage'), manifest, ui, params });
    window.__museum = app;

    // UI ↔ App 接线
    ui._settings = app.settings;
    ui.onSetting = (k, v) => app.setSetting(k, v);
    ui.onSelectHall = (id) => { ui.closeMenu(); app.switchScene(id); };
    ui.onTour = () => app.toggleTour();
    ui.onMenuResume = () => {
      if (!app.controls.touch && !params.nolock) document.getElementById('stage').requestPointerLock();
    };
    ui._visitedFn = () => app.stats.visited();
    ui.onFirstFrame = () => {
      clearTimeout(watchdog);
      ui.handoffSplash();
      ui.showHelp();
      if (app.settings.showPerf === false) document.getElementById('perf').style.visibility = 'hidden';
    };

    status.textContent = '正在启动渲染引擎…';
    bar.style.width = '45%';
    await app.boot();

    wireCalibration(app, ui, params);
  } catch (err) {
    console.error(err);
    clearTimeout(watchdog);
    const splash = document.getElementById('splash');
    if (splash) {
      splash.querySelector('.bar')?.remove();
      status.innerHTML = `<span style="color:#d46a5f">${err.fatal ? '' : '启动失败：'}${err.message}</span>`;
    } else {
      document.body.insertAdjacentHTML('beforeend', `<div class="nogl">${err.message}</div>`);
    }
  }
}

/** ?calib=1 校准面板：把准星指向的位置/出生点追加为 manifest 片段 */
function wireCalibration(app, ui, params) {
  if (!params.calib) return;
  const out = document.getElementById('calib-out');
  const posEl = document.getElementById('calib-pos');
  document.getElementById('calib-spot').addEventListener('click', () => {
    const h = app.calibAim(2.2);
    out.value += JSON.stringify({ icon: '◆', ...h, category: '待定', title: '待命名', desc: '' }, null, 1).replace(/\n\s*/g, ' ') + '\n';
  });
  document.getElementById('calib-spawn').addEventListener('click', () => {
    const s = app.calibSpawn();
    out.value += `"spawn": ${JSON.stringify(s)}  // bounds 后请手动核验\n`;
  });
  document.getElementById('calib-select').addEventListener('click', () => { out.select(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') console.log('[calib] aim', app.calibAim(2.2), 'spawn', app.calibSpawn());
  });
  setInterval(() => {
    const p = app.controls.pos;
    posEl.textContent = `pos ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} · yaw ${(app.controls.yaw * 180 / Math.PI).toFixed(0)}° · pitch ${(app.controls.pitch * 180 / Math.PI).toFixed(0)}°`;
  }, 150);
}

boot();
