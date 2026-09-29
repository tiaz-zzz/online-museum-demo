/**
 * input-guards — CallerStack 式输入守卫（移植 Arrival.Space 的 disableXxx 调用栈设计）
 *
 * 布尔开关在多层 UI 叠加时会互相覆盖（A 关了 B 的开关），计数栈不会：
 * 每个需要压住输入的来源（浮层/弹窗/校准面板…）acquire 一次，关闭时 release，
 * 深度 > 0 即封锁。见《arrival.space场景操作实现解析.md》§9。
 */
export class GuardStack {
  constructor(name = '') {
    this.name = name;
    this._depth = 0;
    this._holders = new Set(); // 便于排查谁没释放
  }

  acquire(holder = 'anon') {
    this._depth++;
    this._holders.add(holder);
    return this._depth;
  }

  release(holder = 'anon') {
    this._holders.delete(holder);
    this._depth = Math.max(0, this._depth - 1);
  }

  /** 深度归零（blur/场景重建等兜底用） */
  reset() {
    this._depth = 0;
    this._holders.clear();
  }

  get blocked() {
    return this._depth > 0;
  }

  get holders() {
    return [...this._holders];
  }
}

/** 标准三件套：键盘移动 / 指针锁定 / 点击行走 */
export function createInputGuards() {
  return {
    keyboard: new GuardStack('keyboard'),
    lock: new GuardStack('lock'),
    clickToGo: new GuardStack('clickToGo'),
  };
}
