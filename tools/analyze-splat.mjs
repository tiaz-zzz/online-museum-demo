#!/usr/bin/env node
/**
 * analyze-splat.mjs — 泼溅资产分析工具（Demo 辅助标定）
 *
 * 解析 .splat（antimatter15 32B/高斯）与 .spz（Niantic，gzip）文件的坐标数据，
 * 输出：
 *   - 每个轴的稳健分位范围（P0.5 / P3 / P50 / P97 / P99.5）——用于界定地面/墙体/楼层
 *   - k-means 聚类中心（子采样）——作为展品热点候选位置
 *   - 高斯总数与建议体量
 *
 * 用法：node tools/analyze-splat.mjs <file.(splat|spz)> [clusterCount]
 * 结果输出为 JSON（stdout）。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const file = process.argv[2];
const k = Number(process.argv[3] || 5);
if (!file) {
  console.error('usage: node tools/analyze-splat.mjs <file.(splat|spz)> [clusterCount]');
  process.exit(1);
}
const buf = readFileSync(file);

let positions; // Float32Array-like: n x 3
if (file.endsWith('.splat')) {
  const n = Math.floor(buf.length / 32);
  positions = new Float32Array(n * 3);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = dv.getFloat32(i * 32, true);
    positions[i * 3 + 1] = dv.getFloat32(i * 32 + 4, true);
    positions[i * 3 + 2] = dv.getFloat32(i * 32 + 8, true);
  }
  var numSplats = n;
} else if (file.endsWith('.spz')) {
  const raw = gunzipSync(buf);
  // header: magic u32 (0x5053474e "NGSP"), version u32, numSplats u32 (doc: 16-byte header)
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x5053474e) throw new Error('not an spz file (bad magic)');
  const version = dv.getUint32(4, true);
  const n = dv.getUint32(8, true);
  // positions: 3 x uint24 (fixed point, scale 1/32), 9 bytes per splat, right after 16-byte header
  const off = 16;
  positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const b = off + i * 9 + c * 3;
      const v = raw[b] | (raw[b + 1] << 8) | (raw[b + 2] << 16); // signed 24-bit LE
      positions[i * 3 + c] = (v << 8) / (32 * 256); // >>8 signed then /32
    }
  }
  var numSplats = n;
  var spzVersion = version;
} else {
  console.error('unsupported file type (expected .splat or .spz; .ply not parsed by this tool)');
  process.exit(1);
}

const n = numSplats;
const axis = (c) => {
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = positions[i * 3 + c];
  v.sort();
  const p = (q) => v[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))];
  return { min: p(0.005), p3: p(0.03), p50: p(0.5), p97: p(0.97), max: p(0.995), extent: p(0.995) - p(0.005) };
};
const axes = [axis(0), axis(1), axis(2)];

// ---- k-means on subsample ----
const SAMPLE = 12000;
const step = Math.max(1, Math.floor(n / SAMPLE));
const pts = [];
for (let i = 0; i < n; i += step) pts.push([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]);
const rand = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const rnd = rand(42);
// init: kmeans++ light — pick random spread points
let centers = Array.from({ length: k }, () => pts[Math.floor(rnd() * pts.length)].slice());
const assign = new Array(pts.length).fill(0);
for (let iter = 0; iter < 24; iter++) {
  for (let i = 0; i < pts.length; i++) {
    let best = 0, bd = Infinity;
    for (let c = 0; c < k; c++) {
      const dx = pts[i][0] - centers[c][0], dy = pts[i][1] - centers[c][1], dz = pts[i][2] - centers[c][2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = c; }
    }
    assign[i] = best;
  }
  const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
  for (let i = 0; i < pts.length; i++) {
    const a = sums[assign[i]];
    a[0] += pts[i][0]; a[1] += pts[i][1]; a[2] += pts[i][2]; a[3]++;
  }
  centers = sums.map((a, c) => (a[3] > 0 ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : centers[c]));
}
const counts = new Array(k).fill(0);
for (const a of assign) counts[a]++;
const clusters = centers.map((c, i) => ({
  center: c.map((v) => +v.toFixed(2)),
  weight: +(counts[i] / pts.length * 100).toFixed(1) + '%',
}));

console.log(JSON.stringify({
  file,
  numSplats: n,
  ...(spzVersion ? { spzVersion } : {}),
  axes: { x: axes[0], y: axes[1], z: axes[2] },
  clusters,
}, null, 2));
