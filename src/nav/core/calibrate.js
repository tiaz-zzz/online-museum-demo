import * as THREE from 'three';

/**
 * calibrate — 场景自动标定（框架的"坐标系端"）
 *
 * 论文对应（见《高斯泼溅场景具身导航论文整理.md》路线① Splat-Nav）：
 * 泼溅没有 mesh/解析几何，导航要做的第一件事就是从高斯基元推断场景结构。
 * 本模块做最小可用的三件事：
 *   1. 抽样高斯中心/尺度/不透明度（SplatMesh.forEachSplat，隔步采样控制开销）
 *   2. 自动推断"上"方向与地面高度（底部高密度薄层 = 地面；六个带符号轴打分）
 *   3. 估计比例尺（米/单位，无先验时按"室内层高≈assumedHeightM"反推）与 percentile 包围盒
 * 所有结论都允许 URL 参数 / 校准面板覆盖（自动值永远展示，可解释、可修正）。
 */

export const UP_CHOICES = ['+y', '-y', '+z', '-z', '+x', '-x'];

const AXIS_VEC = {
  '+y': new THREE.Vector3(0, 1, 0),
  '-y': new THREE.Vector3(0, -1, 0),
  '+z': new THREE.Vector3(0, 0, 1),
  '-z': new THREE.Vector3(0, 0, -1),
  '+x': new THREE.Vector3(1, 0, 0),
  '-x': new THREE.Vector3(-1, 0, 0),
};

/** 泼溅采样结果（原始泼溅坐标） */
export class SplatSamples {
  constructor({ maxSamples = 250000 } = {}) {
    this.maxSamples = maxSamples;
    this.count = 0;          // 实际采到的高斯数
    this.total = 0;          // 场景高斯总数
    this.centers = null;     // Float32Array count*3
    this.sigmas = null;      // Float32Array count（最大 σ，原始单位）
  }
}

/**
 * 从初始化完成的 SplatMesh 抽样。
 * 注意：SplatMesh.forEachSplat 依赖 pager（首帧渲染后才就绪），
 * 这里直接遍历 packedSplats（worker 解码完即可用），数量以 packedSplats.numSplats 为准。
 * 低不透明度（浮点伪影/半透明背景）与超大 σ（天空/远景糊团）的高斯不参与，
 * 避免污染地面/障碍统计。
 */
export function sampleSplats(mesh, { maxSamples = 250000, minOpacity = 0.12 } = {}) {
  const s = new SplatSamples({ maxSamples });
  const source = mesh.packedSplats || mesh;
  s.total = source.numSplats || 0;
  const stride = Math.max(1, Math.floor(s.total / maxSamples));
  const cap = Math.max(1, Math.ceil(s.total / stride));
  s.centers = new Float32Array(cap * 3);
  s.sigmas = new Float32Array(cap);
  const c = new THREE.Vector3();
  const sc = new THREE.Vector3();
  source.forEachSplat((i, center, scales, _quat, opacity) => {
    if (i % stride !== 0 || opacity < minOpacity) return;
    if (s.count >= cap) return;
    c.copy(center);
    const sig = Math.max(Math.abs(scales.x), Math.abs(scales.y), Math.abs(scales.z));
    s.centers[s.count * 3] = c.x;
    s.centers[s.count * 3 + 1] = c.y;
    s.centers[s.count * 3 + 2] = c.z;
    s.sigmas[s.count] = sig;
    s.count++;
  });
  return s;
}

function percentileSorted(values, p) {
  const idx = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * p)));
  return values[idx];
}

/** 对一个带符号轴打分：底部 30% 分位区间内最密的直方图峰（地面=底部高密度薄层） */
function floorScoreFor(centers, count, axis /* 0=x 1=y 2=z */, sign, bins = 96) {
  const vals = new Float32Array(count);
  for (let i = 0; i < count; i++) vals[i] = centers[i * 3 + axis] * sign;
  vals.sort();
  const lo = percentileSorted(vals, 0.01);
  const hi = percentileSorted(vals, 0.99);
  const range = hi - lo;
  if (!(range > 1e-6)) return { score: 0, peakU: lo };
  const hist = new Float32Array(bins);
  for (let i = 0; i < count; i++) {
    const b = Math.floor(((vals[i] - lo) / range) * bins);
    if (b >= 0 && b < bins) hist[b]++;
  }
  let mean = 0;
  for (let b = 0; b < bins; b++) mean += hist[b];
  mean /= bins;
  const bottomBins = Math.max(1, Math.floor(bins * 0.3));
  let peak = 0;
  for (let b = 0; b < bottomBins; b++) peak = Math.max(peak, hist[b]);
  // 底部薄层越尖（peak/mean 越大）越像地面；再乘以"底部确有质量"的覆盖项防全空轴
  const coverage = Math.min(1, (mean * bottomBins) / (count * 0.05) + 0.05);
  return { score: (peak / (mean + 1e-9)) * coverage, peakU: lo };
}

/**
 * 推断 up 轴。upHint（如 '-y'）直接采用；否则六轴打分取最高。
 * 返回 { up, scores: {axis: score} }（scores 供校准面板展示，可解释）。
 */
export function detectUpAxis(samples, upHint) {
  if (upHint && AXIS_VEC[upHint]) return { up: upHint, scores: null };
  const { centers, count } = samples;
  if (!count) return { up: '+y', scores: null };
  const scores = {};
  let best = '+y';
  let bestScore = -1;
  for (const axis of ['y', 'z', 'x']) {
    const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    for (const sign of [1, -1]) {
      const key = (sign > 0 ? '+' : '-') + axis;
      const { score } = floorScoreFor(centers, count, ai, sign);
      scores[key] = score;
      if (score > bestScore) { bestScore = score; best = key; }
    }
  }
  return { up: best, scores };
}

function axisIndex(up) {
  return up.includes('y') ? 1 : up.includes('z') ? 2 : 0;
}

/**
 * 地面高度：沿 up 轴（带符号，u = p·U），在范围底部 30% 内找密度峰，
 * 用峰邻域样本的加权均值细化。floorU 是"沿 U 方向的高度坐标值"（p·U）。
 */
export function detectFloor(samples, up, hintU = null) {
  if (hintU != null) return hintU;
  const U = AXIS_VEC[up];
  const ai = axisIndex(up);
  const sign = U.getComponent(ai); // ±1：up 与该坐标轴同向/反向
  const { centers, sigmas, count } = samples;
  if (!count) return 0;
  const bins = 128;
  const vals = new Float32Array(count);
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = centers[i * 3 + ai] * sign; // 统一成"向上为正"
    vals[i] = v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  vals.sort();
  const lo = percentileSorted(vals, 0.01);
  const hi = percentileSorted(vals, 0.99);
  const range = Math.max(hi - lo, 1e-6);
  const hist = new Float64Array(bins);
  for (let i = 0; i < count; i++) {
    const b = Math.floor(((vals[i] - lo) / range) * bins);
    if (b >= 0 && b < bins) hist[b]++;
  }
  const bottomBins = Math.max(1, Math.floor(bins * 0.3));
  let peakB = 0;
  let peak = 0;
  for (let b = 0; b < bottomBins; b++) if (hist[b] > peak) { peak = hist[b]; peakB = b; }
  // 峰 ±1 bin 邻域内的样本加权均值（用 σ 倒数加权：小高斯更可信）
  const binW = range / bins;
  const u0 = lo + (peakB - 1) * binW;
  const u1 = lo + (peakB + 2) * binW;
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < count; i++) {
    const v = vals[i];
    if (v < u0 || v >= u1) continue;
    const w = 1 / (sigmas[i] + 1e-6);
    sum += v * w;
    wsum += w;
  }
  const floorU = wsum > 0 ? sum / wsum : lo;
  return floorU; // p·U 语义（"向上为正"）；调用方如需原始坐标分量再乘 axisSign
}

/**
 * 3×3 对称协方差 PCA：返回最小特征值对应的特征向量（点集拟合平面的法向）。
 * Jacobi 特征分解，pts 为 Float32Array(n*3)。
 */
function planeNormalFromPCA(pts, n) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - cx, dy = pts[i * 3 + 1] - cy, dz = pts[i * 3 + 2] - cz;
    A[0][0] += dx * dx; A[0][1] += dx * dy; A[0][2] += dx * dz;
    A[1][1] += dy * dy; A[1][2] += dy * dz;
    A[2][2] += dz * dz;
  }
  A[1][0] = A[0][1]; A[2][0] = A[0][2]; A[2][1] = A[1][2];
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let p = 0, q = 1;
    let off = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > off) { p = 0; q = 2; off = Math.abs(A[0][2]); }
    if (Math.abs(A[1][2]) > off) { p = 1; q = 2; off = Math.abs(A[1][2]); }
    if (off < 1e-12) break;
    const apq = A[p][q];
    const theta = 0.5 * Math.atan2(2 * apq, A[q][q] - A[p][p]);
    const c = Math.cos(theta), s = Math.sin(theta);
    for (let i = 0; i < 3; i++) { // A ← JᵀAJ（两侧旋转）
      const aip = A[i][p], aiq = A[i][q];
      A[i][p] = c * aip - s * aiq;
      A[i][q] = s * aip + c * aiq;
    }
    for (let i = 0; i < 3; i++) {
      const api = A[p][i], aqi = A[q][i];
      A[p][i] = c * api - s * aqi;
      A[q][i] = s * api + c * aqi;
    }
    for (let i = 0; i < 3; i++) { // V ← VJ（列 = 特征向量）
      const vip = V[i][p], viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }
  let best = 0;
  if (A[1][1] < A[best][best]) best = 1;
  if (A[2][2] < A[best][best]) best = 2;
  return { normal: new THREE.Vector3(V[0][best], V[1][best], V[2][best]).normalize(), centroid: new THREE.Vector3(cx, cy, cz) };
}

/**
 * 自动整平：对地板带内的采样点做平面拟合（一次拟合 + 内点重拟合），
 * 把拟合法向作为真正的"上"方向——采集时的小倾角被自动归零，墙面恢复竖直。
 * 返回 { U, floorU, tiltDeg } 或 null（点太少/倾角过大事故不校正）。
 */
function autoLevel(samples, U0, floorU, bandRaw) {
  const { centers, count } = samples;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const v = centers[i * 3] * U0.x + centers[i * 3 + 1] * U0.y + centers[i * 3 + 2] * U0.z;
    if (Math.abs(v - floorU) > bandRaw) continue;
    pts.push(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
  }
  const n = pts.length / 3;
  if (n < 800) return null;
  let fit = planeNormalFromPCA(pts, n);
  // 内点重拟合：剔除离平面 >0.15m 的点（踢脚线/家具底），锐化估计
  const inl = [];
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - fit.centroid.x, dy = pts[i * 3 + 1] - fit.centroid.y, dz = pts[i * 3 + 2] - fit.centroid.z;
    const d = Math.abs(dx * fit.normal.x + dy * fit.normal.y + dz * fit.normal.z);
    if (d <= 0.15) inl.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  }
  if (inl.length / 3 >= 800) fit = planeNormalFromPCA(inl, inl.length / 3);
  const normal = fit.normal.clone();
  if (normal.dot(U0) < 0) normal.negate();
  const ang = Math.acos(Math.min(1, Math.max(-1, normal.dot(U0)))) * (180 / Math.PI);
  if (!(ang > 0.4 && ang < 15)) return null; // 几乎水平或离谱（选错轴）都不动
  return { U: normal, floorU: fit.centroid.dot(normal), tiltDeg: ang };
}

/**
 * 天花板检测（地面检测的镜像）：沿 up 方向在范围顶部 30% 内找密度峰。
 * 低矮房间（层高 ≤ bodyHiM）的天花板是巨大水平面，若不剔除会整体落进
 * "身体层"区间，把全房间格判成障碍。找不到显著峰（露天场景）返回 null。
 */
export function detectCeiling(samples, U, floorU) {
  const { centers, sigmas, count } = samples;
  if (!count) return null;
  const bins = 128;
  const vals = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    vals[i] = centers[i * 3] * U.x + centers[i * 3 + 1] * U.y + centers[i * 3 + 2] * U.z;
  }
  vals.sort();
  const lo = percentileSorted(vals, 0.01);
  const hi = percentileSorted(vals, 0.99);
  const range = Math.max(hi - lo, 1e-6);
  if (range <= (floorU - lo) + 1e-6) return null;
  const hist = new Float64Array(bins);
  for (let i = 0; i < count; i++) {
    const b = Math.floor(((vals[i] - lo) / range) * bins);
    if (b >= 0 && b < bins) hist[b]++;
  }
  const topBins = Math.max(1, Math.floor(bins * 0.3));
  let mean = 0;
  for (let b = 0; b < bins; b++) mean += hist[b];
  mean /= bins;
  let peakB = -1;
  let peak = 0;
  for (let b = bins - topBins; b < bins; b++) {
    if (hist[b] > peak) { peak = hist[b]; peakB = b; }
  }
  // 显著性：峰至少是均值的 4 倍且含 ≥3% 样本，才认为是天花板而非露天散点
  if (peakB < 0 || peak < mean * 4 || peak < count * 0.03) return null;
  const binW = range / bins;
  const u0 = lo + (peakB - 1) * binW;
  const u1 = lo + (peakB + 2) * binW;
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < count; i++) {
    const v = vals[i];
    if (v < u0 || v >= u1) continue;
    const w = 1 / (sigmas[i] + 1e-6);
    sum += v * w;
    wsum += w;
  }
  const ceilU = wsum > 0 ? sum / wsum : lo + (peakB + 0.5) * binW;
  if (ceilU <= floorU + 0.5) return null; // 与地面贴太近，不像天花板
  return ceilU;
}

/**
 * 汇总标定结果 → SceneFrame（导航与控制共用的坐标抽象）。
 * @param {object} opts
 * @param {SplatSamples} opts.samples
 * @param {string}  [opts.up]        覆盖 up（'+y'…）
 * @param {number}  [opts.floorRaw]  覆盖地面：沿 up 轴的原始坐标分量值（如 up='-y' 时为 y 坐标）
 * @param {number}  [opts.mPerUnit]  覆盖比例尺（米/单位）
 * @param {number}  [opts.assumedHeightM] 无比例尺先验时假设的"地面→场景顶"高度（默认 3.2m）
 */
export function calibrateScene(samples, opts = {}) {
  const { up: upDetected, scores } = detectUpAxis(samples, opts.up);
  const up = upDetected;
  const U = AXIS_VEC[up].clone();
  const ai = axisIndex(up);
  const axisSign = U.getComponent(ai); // up 轴方向的坐标分量符号
  const { centers, count } = samples;

  // 地面：detectFloor 返回 p·U 语义；URL/校准给的 floorRaw 是"原始坐标分量"，需换算
  let floorU;
  if (opts.floorRaw != null && Number.isFinite(opts.floorRaw)) floorU = opts.floorRaw * axisSign;
  else floorU = detectFloor(samples, up);

  // 临时竖直分位与比例尺（定义地板带宽度用；整平后再精化）
  const Vs0 = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    Vs0[i] = centers[i * 3] * U.x + centers[i * 3 + 1] * U.y + centers[i * 3 + 2] * U.z;
  }
  Vs0.sort();
  const heightUnits0 = Math.max(percentileSorted(Vs0, 0.99) - floorU, 1e-6);
  const mPerUnit0 = opts.mPerUnit > 0 ? opts.mPerUnit : (opts.assumedHeightM ?? 3.2) / heightUnits0;

  // —— 自动整平（水平倾角归零）：对地板带做平面拟合，法向即真实"上"方向。
  // 采集时手持设备的小倾角会让墙面/门框在画面里歪斜；整平后无需手动旋转模型。
  let tiltDeg = 0;
  const lev = autoLevel(samples, U, floorU, 0.35 / mPerUnit0);
  if (lev) {
    U.copy(lev.U);
    floorU = lev.floorU;
    tiltDeg = lev.tiltDeg;
  }

  // 水平基：优先保留世界 -Z 的水平投影（历史行为）；整平后 U 若与 -Z 近平行，
  // 投影会退化（模长 sin(夹角) 过小），此时换用与 U 夹角最大的世界轴。
  const F0 = new THREE.Vector3(0, 0, -1);
  F0.addScaledVector(U, -F0.dot(U));
  if (F0.lengthSq() < 0.0625) { // 水平分量 < 0.25 → 退化
    let best = new THREE.Vector3(1, 0, 0);
    let bestSin = 2;
    for (const a of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)]) {
      const s = Math.abs(a.dot(U));
      if (s < bestSin) { bestSin = s; best.copy(a); }
    }
    F0.copy(best).addScaledVector(U, -best.dot(U));
  }
  F0.normalize();
  const R0 = new THREE.Vector3().crossVectors(F0, U).normalize();

  // 水平旋转（rotDeg）：采集场景常带小偏角，把"模型"绕 up 轴整体转过该角度
  // （等价于标定基反向旋转：F0' = F0·cos + R0·sin，R0' = R0·cos − F0·sin）。
  // 必须在水平包围盒/可行走网格投影之前生效。
  const rotDeg = opts.rotDeg || 0;
  if (rotDeg) {
    const rad = (rotDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const F0n = F0.clone().multiplyScalar(c).addScaledVector(R0, s).normalize();
    const R0n = R0.clone().multiplyScalar(c).addScaledVector(F0, -s).normalize();
    F0.copy(F0n);
    R0.copy(R0n);
  }

  // 投影到 (R0, F0, U) 标架，算 percentile 包围盒
  const A = new Float32Array(count);
  const B = new Float32Array(count);
  const Vs = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = centers[i * 3], y = centers[i * 3 + 1], z = centers[i * 3 + 2];
    A[i] = x * R0.x + y * R0.y + z * R0.z;
    B[i] = x * F0.x + y * F0.y + z * F0.z;
    Vs[i] = x * U.x + y * U.y + z * U.z;
  }
  A.sort(); B.sort(); Vs.sort();
  const q = (arr, p) => percentileSorted(arr, p);
  const vLo = q(Vs, 0.01);
  const vHi = q(Vs, 0.99);

  // 比例尺：米/单位。无先验时假设 (vHi - floorU) ≈ assumedHeightM
  const heightUnits = Math.max(vHi - floorU, 1e-6);
  const mPerUnit = opts.mPerUnit && opts.mPerUnit > 0
    ? opts.mPerUnit
    : (opts.assumedHeightM ?? 3.2) / heightUnits;

  // 水平包围盒：优先用"地面层溅点"（离地 ≤ floorBandM）的 2%~98% 分位 + 1.5m 余量。
  // 全体溅点的分位会被远景建筑/天空撑大数倍，导致网格稀疏、可行走区碎岛化。
  const floorBandRaw = 0.35 / mPerUnit;
  const fa = [];
  const fb = [];
  for (let i = 0; i < count; i++) {
    const x = centers[i * 3], y = centers[i * 3 + 1], z = centers[i * 3 + 2];
    const u = x * U.x + y * U.y + z * U.z;
    if (Math.abs(u - floorU) > floorBandRaw) continue;
    fa.push(x * R0.x + y * R0.y + z * R0.z);
    fb.push(x * F0.x + y * F0.y + z * F0.z);
  }
  const useFloorBounds = fa.length >= Math.max(50, count * 0.02);
  const sa = useFloorBounds ? Float32Array.from(fa).sort() : A;
  const sb = useFloorBounds ? Float32Array.from(fb).sort() : B;
  const margin = 1.5 / mPerUnit;
  const bounds2D = {
    minA: q(sa, 0.02) - margin,
    maxA: q(sa, 0.98) + margin,
    minB: q(sb, 0.02) - margin,
    maxB: q(sb, 0.98) + margin,
  };

  // 天花板 → 身体层上限自适应：低矮房间的天花板（及其下的墙顶/画框带等密面）
  // 若落进身体层，会把整个房间判成障碍。余量随层高缩放（低房多让），夹在 [1.0, bodyHiM]。
  const ceilingU = detectCeiling(samples, U, floorU);
  const ceilingHm = ceilingU != null ? (ceilingU - floorU) * mPerUnit : null;
  const bodyHiDefault = opts.bodyHiM ?? 1.9;
  const bodyHiM = ceilingHm != null
    ? Math.max(1.0, Math.min(bodyHiDefault, ceilingHm - Math.max(0.35, 0.25 * ceilingHm)))
    : bodyHiDefault;

  return {
    up, scores, U, F0, R0,
    floorU,            // p·U 语义的地面高度（导航内部用）
    floorRaw: floorU * axisSign, // 原始坐标分量语义（供校准面板/manifest 复用）
    axisSign, ai,
    mPerUnit,
    mPerUnitAuto: !(opts.mPerUnit > 0),
    bounds2D,
    vLo, vHi,
    topU: vHi,
    ceilingU,
    ceilingHm,
    bodyHiM,
    rotDeg,
    tiltDeg, // 自动整平校正的倾角（度）；0 = 本来就水平
    axisLabel: up,
    sampleCount: count,
  };
}

/** 把 R0/F0/U 标架下的 (a,b,u) 坐标转回原始泼溅坐标 */
export function fromFrame(frame, a, b, u, out = new THREE.Vector3()) {
  return out.set(0, 0, 0)
    .addScaledVector(frame.R0, a)
    .addScaledVector(frame.F0, b)
    .addScaledVector(frame.U, u);
}

/** 原始泼溅坐标 → (a, b, u) 标架坐标，写入 out {a,b,u} */
export function toFrame(frame, p, out = { a: 0, b: 0, u: 0 }) {
  out.a = p.x * frame.R0.x + p.y * frame.R0.y + p.z * frame.R0.z;
  out.b = p.x * frame.F0.x + p.y * frame.F0.y + p.z * frame.F0.z;
  out.u = p.x * frame.U.x + p.y * frame.U.y + p.z * frame.U.z;
  return out;
}
