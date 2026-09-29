import { toFrame, fromFrame } from '../core/calibrate.js';

/**
 * occupancy — 可行走区域网格（论文路线①：Splat-Nav 的 2D 简化版）
 *
 * 思路：把抽样高斯中心沿"上"方向分层——
 *   地面层（|h| ≤ floorBandM）      → 证明该格可踩
 *   身体层（bodyLoM ~ bodyHiM）     → 该格被占据（桌子/车体/展柜…）
 * 没有地面证据的格子视为未知（保守：不可走），避免玩家走进采集气泡外的失真区。
 * 障碍按玩家半径膨胀，移动查询因此退化为"目标格是否可走"。
 *
 * 复用方式：build() 一次性构建；resolveMove() 供控制器每帧调用；
 * stats()/data 供小地图与调试渲染。不依赖 three 以外的任何模块状态。
 */

const CELL_UNKNOWN = 0;
const CELL_WALK = 1;
const CELL_BLOCK = 2;

const MAX_CELLS = 1.5e6; // 网格内存上限，超出自动放粗格子

export class OccupancyGrid {
  constructor({ minA, minB, cell, cols, rows, data, floorCount }) {
    this.minA = minA;   // 标架坐标（原始单位）
    this.minB = minB;
    this.cell = cell;   // 格边长（原始单位）
    this.cols = cols;
    this.rows = rows;
    this.data = data;         // Uint8Array COLS*ROWS
    this.floorCount = floorCount; // Uint16Array，小地图明暗用
  }

  /** 由采样 + 标定结果构建；无法产出有效网格（如完全没探到地面）时返回 null */
  static build({
    samples, frame,
    cellSizeM = 0.25,
    playerRadiusM = 0.3,
    floorBandM = 0.35,
    bodyLoM = null, // 缺省与地面带对齐，避免地板厚层跨界后被计入身体层
    bodyHiM = 1.9,
    maxSigmaM = 0.75,
    floorBridgeM = 0.5,
  }) {
    const { centers, sigmas, count } = samples;
    if (!count) return null;

    const mPerUnit = frame.mPerUnit;
    const cell0 = cellSizeM / mPerUnit;
    const { minA, maxA, minB, maxB } = frame.bounds2D;
    // 内存守卫：格子太密则放粗
    let cell = cell0;
    let cols = Math.ceil((maxA - minA) / cell) + 1;
    let rows = Math.ceil((maxB - minB) / cell) + 1;
    while (cols * rows > MAX_CELLS) {
      cell *= 2;
      cols = Math.ceil((maxA - minA) / cell) + 1;
      rows = Math.ceil((maxB - minB) / cell) + 1;
    }

    const floorCount = new Uint16Array(cols * rows);
    const bodyCount = new Uint16Array(cols * rows);
    const maxSigmaRaw = maxSigmaM / mPerUnit;
    const floorBandRaw = floorBandM / mPerUnit;
    const bodyLoRaw = (bodyLoM ?? floorBandM) / mPerUnit;
    // 身体层上限优先用标定阶段的天花板自适应值（frame.bodyHiM），防低矮天花板污染
    const bodyHiEff = frame.bodyHiM ?? bodyHiM;
    const bodyHiRaw = bodyHiEff / mPerUnit;
    const t = { a: 0, b: 0, u: 0 };

    for (let i = 0; i < count; i++) {
      const sigma = sigmas[i];
      if (sigma > maxSigmaRaw) continue; // 天空/远景糊团不参与
      const x = centers[i * 3], y = centers[i * 3 + 1], z = centers[i * 3 + 2];
      t.a = x * frame.R0.x + y * frame.R0.y + z * frame.R0.z;
      t.b = x * frame.F0.x + y * frame.F0.y + z * frame.F0.z;
      t.u = x * frame.U.x + y * frame.U.y + z * frame.U.z;
      const col = Math.floor((t.a - minA) / cell);
      const row = Math.floor((t.b - minB) / cell);
      if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
      const h = (t.u - frame.floorU) * mPerUnit; // 离地高度（米）
      const idx = row * cols + col;
      if (h >= -floorBandRaw && h <= floorBandRaw) {
        if (floorCount[idx] < 65535) floorCount[idx]++;
      } else if (h > bodyLoRaw && h < bodyHiRaw) {
        if (bodyCount[idx] < 65535) bodyCount[idx]++;
      }
    }

    // 分类（相对密度规则）：格子内有地面证据、且身体层溅点没有压倒性地多于地面层
    // → 可走；身体层有实质溅点但无地面证据（床底/柜体/墙根）→ 障碍；其余 → 未知（保守不可走）。
    // 早期版本用 bodyCount>=2 的绝对阈值，在采样密集时（每格数百溅点）会把全部格子封死。
    const data = new Uint8Array(cols * rows);
    for (let i = 0; i < data.length; i++) {
      const fc = floorCount[i];
      const bc = bodyCount[i];
      if (fc > 0 && bc <= Math.max(4, fc * 0.5)) data[i] = CELL_WALK;
      else if (bc >= 2) data[i] = CELL_BLOCK;
    }

    // 障碍按玩家半径膨胀（把圆碰撞降维成格子查询；0.8 系数避免贴脸格把窄道堵死）
    const rCells = Math.max(1, Math.round((0.8 * playerRadiusM) / (cell * mPerUnit)));
    dilateInto(data, cols, rows, CELL_BLOCK, rCells);
    // 地面膨胀桥接采样缝隙（只进未知格，不越障碍）：默认 0.5m
    const bridgeCells = Math.max(1, Math.round((floorBridgeM ?? 0.5) / (cell * mPerUnit)));
    dilateInto(data, cols, rows, CELL_WALK, bridgeCells, /* onlyInto */ CELL_UNKNOWN);

    const grid = new OccupancyGrid({ minA, minB, cell, cols, rows, data, floorCount });
    grid.cellM = cell * mPerUnit;
    grid.playerRadiusM = playerRadiusM;
    let walkable = 0;
    for (let i = 0; i < data.length; i++) if (data[i] === CELL_WALK) walkable++;
    grid.walkableCount = walkable;
    return walkable > 0 ? grid : null;
  }

  index(a, b) {
    const col = Math.floor((a - this.minA) / this.cell);
    const row = Math.floor((b - this.minB) / this.cell);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  isWalkableAB(a, b) {
    const i = this.index(a, b);
    return i >= 0 && this.data[i] === CELL_WALK;
  }

  isWalkableRaw(p) {
    const t = toFrameShared(p);
    return this.isWalkableAB(t.a, t.b);
  }

  /**
   * 从 p 出发螺旋搜索最近的可行走格，返回其世界坐标（保持 p 的竖直分量）；找不到返回 null。
   * 用于"清单/URL 给的出生点恰好落在障碍上"时的自动吸附，避免玩家卡死。
   */
  nearestWalkableRaw(p, frame, maxCells = 24) {
    const t = toFrameShared(p);
    const c0 = Math.floor((t.a - this.minA) / this.cell);
    const r0 = Math.floor((t.b - this.minB) / this.cell);
    for (let r = 0; r <= maxCells; r++) {
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue; // 只扫环
          const rr = r0 + dr;
          const cc = c0 + dc;
          if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
          if (this.data[rr * this.cols + cc] !== CELL_WALK) continue;
          const a = this.minA + (cc + 0.5) * this.cell;
          const b = this.minB + (rr + 0.5) * this.cell;
          return fromFrame({ R0: frame.R0, F0: frame.F0, U: frame.U }, a, b, t.u);
        }
      }
    }
    return null;
  }

  /** 标架坐标裁剪到网格内（留半格边距） */
  clampAB(a, b) {
    const half = this.cell / 2;
    return {
      a: Math.min(Math.max(a, this.minA + half), this.minA + this.cols * this.cell - half),
      b: Math.min(Math.max(b, this.minB + half), this.minB + this.rows * this.cell - half),
    };
  }

  /**
   * 轴分离滑动移动：先试整步，再试只走 a 分量 / 只走 b 分量。
   * @param {THREE.Vector3} pos 当前脚点（原始坐标，原地修改并返回）
   * @param {THREE.Vector3} delta 本帧位移（原始坐标）
   * @param {{R0,F0}} frame
   */
  resolveMove(pos, delta, frame) {
    const t = toFrameShared(pos);
    const dA = delta.x * frame.R0.x + delta.y * frame.R0.y + delta.z * frame.R0.z;
    const dB = delta.x * frame.F0.x + delta.y * frame.F0.y + delta.z * frame.F0.z;
    if (this.isWalkableAB(t.a + dA, t.b + dB)) { t.a += dA; t.b += dB; }
    else if (dA !== 0 && this.isWalkableAB(t.a + dA, t.b)) { t.a += dA; }
    else if (dB !== 0 && this.isWalkableAB(t.a, t.b + dB)) { t.b += dB; }
    const c = this.clampAB(t.a, t.b);
    return fromFrame({ R0: frame.R0, F0: frame.F0, U: frame.U }, c.a, c.b, t.u, pos);
  }

  stats() {
    let walk = 0;
    let block = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] === CELL_WALK) walk++;
      else if (this.data[i] === CELL_BLOCK) block++;
    }
    this.walkableCount = walk;
    return { walk, block, unknown: this.data.length - walk - block, cols: this.cols, rows: this.rows, cellM: this.cellM };
  }

  /** 最大连通可走域的格子数（衡量"能走的空间是否连成一片"，供 up 轴回退选优） */
  largestComponent() {
    const seen = new Uint8Array(this.data.length);
    const stack = [];
    let largest = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== CELL_WALK || seen[i]) continue;
      let size = 0;
      stack.push(i);
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop();
        size++;
        const row = (j / this.cols) | 0;
        const col = j - row * this.cols;
        if (row > 0 && !seen[j - this.cols] && this.data[j - this.cols] === CELL_WALK) { seen[j - this.cols] = 1; stack.push(j - this.cols); }
        if (row < this.rows - 1 && !seen[j + this.cols] && this.data[j + this.cols] === CELL_WALK) { seen[j + this.cols] = 1; stack.push(j + this.cols); }
        if (col > 0 && !seen[j - 1] && this.data[j - 1] === CELL_WALK) { seen[j - 1] = 1; stack.push(j - 1); }
        if (col < this.cols - 1 && !seen[j + 1] && this.data[j + 1] === CELL_WALK) { seen[j + 1] = 1; stack.push(j + 1); }
      }
      largest = Math.max(largest, size);
    }
    return largest;
  }
}

// 供 resolveMove/isWalkableRaw 使用的轻量投影（避免依赖 calibrate 实例状态）
let _sharedFrame = null;
/** 控制器设置场景时注入共享标架，供无参查询使用 */
export function setSharedFrame(frame) { _sharedFrame = frame; }
function toFrameShared(p) {
  const f = _sharedFrame;
  return {
    a: p.x * f.R0.x + p.y * f.R0.y + p.z * f.R0.z,
    b: p.x * f.F0.x + p.y * f.F0.y + p.z * f.F0.z,
    u: p.x * f.U.x + p.y * f.U.y + p.z * f.U.z,
  };
}

/**
 * 形态学膨胀：把 src 值为 val 的格子扩 radius 圈。
 * onlyInto 指定时只写入值为 onlyInto 的格子（地面膨胀不覆盖障碍/未知之外的东西）。
 */
function dilateInto(data, cols, rows, val, radius, onlyInto = null) {
  if (radius <= 0) return;
  const seeds = [];
  for (let i = 0; i < data.length; i++) if (data[i] === val) seeds.push(i);
  for (const i of seeds) {
    const row = (i / cols) | 0;
    const col = i - row * cols;
    for (let dr = -radius; dr <= radius; dr++) {
      const r = row + dr;
      if (r < 0 || r >= rows) continue;
      for (let dc = -radius; dc <= radius; dc++) {
        const c = col + dc;
        if (c < 0 || c >= cols) continue;
        const j = r * cols + c;
        if (data[j] === val) continue;
        if (onlyInto == null || data[j] === onlyInto) data[j] = val;
      }
    }
  }
}
