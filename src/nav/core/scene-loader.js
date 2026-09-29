import { SplatLoader, SplatMesh, SplatFileType, getSplatFileType, PackedSplats } from '@sparkjsdev/spark';

/**
 * scene-loader — 场景文件格式适配层（框架的"输入端"）
 *
 * 目标：把"任意常见泼溅格式的一个 URL"变成一个初始化完成的 SplatMesh。
 * 支持格式（由底层 Spark 解码器决定，探测顺序 = 魔数优先、扩展名兜底）：
 *   .ply      3DGS PLY（COLMAP/Postshot/Nerfstudio/混元等导出）
 *   .splat    antimatter15 四元打包格式
 *   .ksplat   markland 打包格式（含 LOD）
 *   .spz      Niantic 压缩格式
 *   .sog/.zip Self-Organizing Gaussians（zip 包 / 解包目录）
 *   meta.json PCSOGS 解包目录（url 指向 meta.json 或其所在目录）
 *   .rad      Radiance Fields 流式格式
 *
 * 设计约束：
 *  - 不依赖 manifest：给 URL 就能加载（?file= 直连）；
 *  - 加载全程有进度回调；失败抛出带"下一步建议"的错误；
 *  - 对 PCSOGS 目录类格式跳过字节预取（多文件，交给 Spark 按 URL 解析）。
 */

/** 扩展名 → SplatFileType 兜底表（无魔数格式 .splat/.ksplat 必须靠它） */
const EXT_FORMATS = {
  ply: SplatFileType.PLY,
  splat: SplatFileType.SPLAT,
  ksplat: SplatFileType.KSPLAT,
  spz: SplatFileType.SPZ,
  sog: SplatFileType.PCSOGSZIP,
  zip: SplatFileType.PCSOGSZIP,
  rad: SplatFileType.RAD,
};

export const SUPPORTED_FORMATS = Object.keys(EXT_FORMATS)
  .concat(['meta.json'])
  .map((e) => `.${e}`)
  .join(' / ');

/** 人工可读的格式徽标文案 */
const FORMAT_LABELS = {
  [SplatFileType.PLY]: '3DGS PLY',
  [SplatFileType.SPLAT]: 'SPLAT',
  [SplatFileType.KSPLAT]: 'KSPLAT',
  [SplatFileType.SPZ]: 'SPZ',
  [SplatFileType.PCSOGS]: 'SOG 目录',
  [SplatFileType.PCSOGSZIP]: 'SOG ZIP',
  [SplatFileType.RAD]: 'RAD 流式',
};

/** 从路径猜格式（仅用于 HUD 徽标预显示，加载时仍会重新探测） */
export function detectFormatFromPath(pathOrUrl) {
  const clean = String(pathOrUrl).split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith('meta.json') || clean.endsWith('/')) return SplatFileType.PCSOGS;
  const dot = clean.lastIndexOf('.');
  const ext = dot > clean.lastIndexOf('/') ? clean.slice(dot + 1) : '';
  return EXT_FORMATS[ext] || null;
}

export function formatLabel(type) {
  return FORMAT_LABELS[type] || '未知格式';
}

/**
 * 高斯数量读取：SplatMesh.numSplats 在首帧渲染前可能是 0（dyno 惰性更新），
 * 真实数量以 packedSplats.numSplats 为准。
 */
export function getNumSplats(mesh) {
  return mesh?.packedSplats?.numSplats || mesh?.numSplats || 0;
}

/**
 * 判断 URL 是否"目录型"（PCSOGS 解包目录）：无法预取单文件字节，直接交给 Spark。
 */
function isDirectoryLike(url) {
  const p = String(url).split(/[?#]/, 1)[0].toLowerCase();
  return p.endsWith('/') || p.endsWith('meta.json');
}

/** 分块拉取字节并回报进度；total 可能为 0（gzip/无 content-length），此时 progress.total=0 */
async function fetchBytes(url, { onProgress, signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer(); // 老浏览器兜底：无流式进度
    onProgress?.(buf.byteLength, buf.byteLength);
    return new Uint8Array(buf);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  for (let i = 0, off = 0; i < chunks.length; i++) {
    out.set(chunks[i], off);
    off += chunks[i].length;
  }
  return out;
}

/**
 * 加载任意泼溅文件 → SplatMesh
 * @param {object} opts
 * @param {string} opts.url            文件/目录 URL（相对页面或绝对）
 * @param {(loaded:number,total:number)=>void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]  取消加载
 * @returns {Promise<{mesh: import('three').Object3D & import('@sparkjsdev/spark').SplatMesh,
 *                     format: SplatFileType, byteSize: number}>}
 */
export async function loadSplatScene({ url, onProgress, signal } = {}) {
  if (!url) throw new Error('缺少场景文件 URL（用 ?file=… 指定，或在 manifest 中配置）');
  const loader = new SplatLoader();
  let fileType = null;
  let fileBytes = null;
  let byteSize = 0;

  if (isDirectoryLike(url)) {
    // SOG 解包目录：元数据是多文件索引，不能整包预取
    fileType = SplatFileType.PCSOGS;
  } else {
    onProgress?.(0, 0);
    fileBytes = await fetchBytes(url, { onProgress, signal });
    byteSize = fileBytes.byteLength;
    if (byteSize < 8) throw new Error('文件为空或过小，不是有效的泼溅资产');
    fileType = getSplatFileType(fileBytes); // 魔数：ply/spz/pcsogszip/rad
    if (!fileType) {
      // 无魔数格式（splat/ksplat 头部就是数据）→ 扩展名兜底
      fileType = detectFormatFromPath(url);
    }
    if (!fileType) {
      throw new Error(
        `无法识别的文件格式（魔数与扩展名均未命中）。支持：${SUPPORTED_FORMATS}。` +
        ` 若该文件是普通三角网格 PLY（顶点+面），它不是泼溅资产，请先转换。`
      );
    }
  }

  // 统一走 Spark 的内部装载（worker 解码）；不传 extSplats 时恒返回 PackedSplats，
  // RAD/SOG 流式需调用方显式传 extSplats 容器才会走 ExtSplats 分支。
  const decoded = await loader.loadInternalAsync({
    url,
    fileBytes: fileBytes || undefined,
    fileType,
    fileName: url,
    onProgress: (e) => onProgress?.(e.loaded ?? 0, e.total ?? byteSize ?? 0),
  });

  const mesh = decoded instanceof PackedSplats
    ? loader.parse(decoded)
    : new SplatMesh({ extSplats: decoded });
  await mesh.initialized; // 等 worker 解码完成（失败会 reject）

  if (!getNumSplats(mesh)) throw new Error('文件解码成功但不含任何高斯基元');
  return { mesh, format: fileType, byteSize };
}
