import { SplatMesh } from '@sparkjsdev/spark';

/**
 * SceneManager — 多展厅高斯资产编排（文档 §6.3 / §8.2 内存治理的 Demo 版）
 * - 场景注册表 + 按需加载
 * - LRU：同时最多 maxResident 个厅的高斯数据驻留，切出后 dispose
 * - 邻厅预热：空闲时对邻厅资产做头部字节预热（正式版为 SOG 分块按需拉取，见 §7.5）
 */
export class SceneManager {
  constructor({ parent, hooks = {}, maxResident = 2 }) {
    this.parent = parent;      // THREE.Scene
    this.hooks = hooks;        // { onLoadProgress(sceneDef, loaded, total) }
    this.maxResident = maxResident;
    this.defs = new Map();     // sceneId -> def
    this.meshes = new Map();   // sceneId -> SplatMesh
    this.lastUsed = new Map();
  }

  setDefs(scenes) {
    for (const s of scenes) this.defs.set(s.sceneId, s);
  }

  async load(id) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`unknown scene ${id}`);
    this.lastUsed.set(id, performance.now());
    if (this.meshes.has(id)) return this.meshes.get(id);

    const mesh = new SplatMesh({
      url: def.splat.url,
      onProgress: (e) => this.hooks.onLoadProgress?.(def, e.loaded ?? 0, e.total ?? 0),
    });
    this.meshes.set(id, mesh);
    this.parent.add(mesh);
    try {
      await mesh.initialized;
    } catch (err) {
      this.parent.remove(mesh);
      this.meshes.delete(id);
      mesh.dispose?.();
      throw err;
    }
    this.lastUsed.set(id, performance.now());
    this.trim([id]);
    return mesh;
  }

  /** 只保留 keepIds 的数据常驻（当前厅 + 目标厅） */
  trim(keepIds) {
    for (const [id, mesh] of this.meshes) {
      if (keepIds.includes(id)) continue;
      this.parent.remove(mesh);
      mesh.dispose?.();
      this.meshes.delete(id);
      this.lastUsed.delete(id);
    }
  }

  get(id) {
    return this.meshes.get(id);
  }

  /** 邻厅资产头部预热（尽力而为，失败静默） */
  prefetch(id) {
    const def = this.defs.get(id);
    if (!def || this.meshes.has(id)) return;
    fetch(def.splat.url, { headers: { Range: 'bytes=0-131071' } }).catch(() => {});
  }
}
