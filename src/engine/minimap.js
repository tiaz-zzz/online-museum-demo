/**
 * Minimap — 厅层平面小地图（文档 §5.3 地图/小地图：Canvas 绘制 + 当前位姿标定）
 * 以 manifest bounds 的水平投影为底图，绘制墙体、热点、门洞与玩家朝向。
 */
import * as THREE from 'three';

const AXIS_IDX = { x: 0, y: 1, z: 2 };

export class Minimap {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.def = null;
    this.W = 150; this.H = 104;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = this.W * dpr;
    canvas.height = this.H * dpr;
    canvas.style.width = this.W + 'px';
    canvas.style.height = this.H + 'px';
    this.ctx.scale(dpr, dpr);
  }

  setScene(def) {
    this.def = def;
  }

  /** 每帧（低频调用）：controls 提供脚点位置与地面朝向 */
  update(controls) {
    const def = this.def;
    if (!def) return;
    const ctx = this.ctx, W = this.W, H = this.H;
    const h1 = controls.h1, h2 = controls.h2;
    const i1 = AXIS_IDX[h1], i2 = AXIS_IDX[h2];
    const [mn1, mn2] = def.bounds.min, [mx1, mx2] = def.bounds.max;
    const pad = 10;
    const s = Math.min((W - pad * 2) / Math.max(1e-6, mx1 - mn1), (H - pad * 2) / Math.max(1e-6, mx2 - mn2));
    const ox = pad + ((W - pad * 2) - (mx1 - mn1) * s) / 2;
    const oz = pad + ((H - pad * 2) - (mx2 - mn2) * s) / 2;
    const X = (v) => ox + (v - mn1) * s;
    const Y = (v) => oz + (v - mn2) * s;

    ctx.clearRect(0, 0, W, H);
    // 底图
    ctx.fillStyle = 'rgba(201,168,106,.06)';
    ctx.strokeStyle = 'rgba(201,168,106,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(X(mn1), Y(mn2), (mx1 - mn1) * s, (mx2 - mn2) * s);
    ctx.fill(); ctx.stroke();
    // 墙体
    ctx.fillStyle = 'rgba(232,226,213,.22)';
    for (const w of def.walls || []) {
      ctx.fillRect(X(w.min[0]), Y(w.min[1]), (w.max[0] - w.min[0]) * s, (w.max[1] - w.min[1]) * s);
    }
    // 热点
    ctx.fillStyle = 'rgba(201,168,106,.95)';
    for (const hp of def.hotspots || []) {
      ctx.beginPath();
      ctx.arc(X(hp.pos[i1]), Y(hp.pos[i2]), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 门洞
    ctx.strokeStyle = 'rgba(127,191,127,.9)';
    ctx.lineWidth = 1.4;
    for (const n of def.neighbors || []) {
      ctx.beginPath();
      ctx.arc(X(n.doorPos[i1]), Y(n.doorPos[i2]), 3.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 玩家（三角形 + 朝向）
    const p = controls.pos;
    const f = controls.groundForward(_f);
    const a1 = f[i1], a2 = f[i2];
    const ang = Math.atan2(a2, a1);
    ctx.save();
    ctx.translate(X(p[i1]), Y(p[i2]));
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#e8e2d5';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

const _f = new THREE.Vector3();
