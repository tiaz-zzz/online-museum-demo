# Arrival.Space 教堂场景（Pfarrkirche Kefermarkt）操作实现解析

> 分析对象：https://arrival.space/64122763_2334
> 方法：下载并反混淆 `__game-scripts.js`（8.7MB，140 个 PlayCanvas 脚本）+ 浏览器内逐项实测
> 所有标注「✅ 实测」的数据均在浏览器中真实触发并读取引擎状态验证过

---

## 1. 技术栈总览

| 层 | 技术 | 说明 |
|---|---|---|
| 渲染引擎 | **PlayCanvas**（`pc` 全局对象，`playcanvas-stable.min.js`） | 画布 id 固定为 `application-canvas`，fill-mode FILL_WINDOW |
| 场景资产 | **3D Gaussian Splatting**（`gsplat` 资产 ×1，`BackgroundGSplat` 实体） | 教堂本体是高斯泼溅场景，另有 44 个 GLB container、137 材质 |
| 物理 | **Ammo.js**（wasm，`ammo.wasm.js`） | 角色是 dynamic rigidbody + 胶囊碰撞体 |
| UI | **React DOM 覆盖层**（`#reactUiContainer`，ReactUI 模块） | 所有按钮/菜单/弹窗都是 DOM，与 3D 画布分层 |
| 联机 | **socket.io**（mrkorf.arrival.space） | 多人虚拟形象同步、语音聊天（voiceChatClient） |
| 提示 | sweetalert2（toast 弹窗） | 如自由视角开启提示 |

**分层架构（事件驱动）**：

```
输入脚本层 keyboardInput / mouseInput / touchInput / gamePadInput
   │  只做一件事：把原始输入翻译成 app 级事件
   ▼  app.fire("firstperson:forward" | "firstperson:look" | "firstperson:jump" | ...)
视角/状态层 firstPersonView（方位角 azimuth + 仰角 elevation，相机模式机）
   │
   ▼  heading 向量 = forward×前向 + strafe×右向
物理层 characterController（Ammo 刚体：冲量移动、地面射线、跳跃、边界重生）
```

每一层只通过 `app.fire/app.on` 事件通信，输入设备之间完全解耦——这是最值得借鉴的设计。

---

## 2. 键盘操作总表（源码 + 实测）

监听在 `window` 上的 `keydown/keyup`（捕获阶段），按 `keyCode` 分发：

| 按键 | keyCode | 事件 | 作用 | 验证 |
|---|---|---|---|---|
| W / ↑ | 87 / 38 | `firstperson:forward (+1)` | 前进 | ✅ 实测 1.5s 位移 2.26m |
| S / ↓ | 40 / 83 | `firstperson:forward (−1)` | 后退 | ✅ 1.47m |
| A / ← | 37 / 65 | `firstperson:strafe (−1)` | 左移 | ✅ 0.98m（撞到长椅） |
| D / → | 39 / 68 | `firstperson:strafe (+1)` | 右移 | ✅ 2.15m |
| Space | 32 | `firstperson:jump` | 跳跃 | ✅ 峰值 +0.43m 后落地 |
| Shift | 16 | `firstperson:boost (1/0)` | 加速跑 | ✅ 位移 4.29m ≈ 1.9× 常速 |
| V | 86 | `firstperson:cameraSwitch` | 第一/第三人称切换 | ✅ first↔third 往返 |
| F | 70 | `firstperson:cameraSwitchFreeCam` | 自由视角（飞行相机） | ✅ mode→"free" |
| E / Q | 69 / 81 | `firstperson:vertical (+1/−1)` | 自由视角上升/下降 | 源码确认 |
| T | 84 | `firstperson:toggleKey` | 自由视角下隐藏/显示自己的虚拟形象 | 源码确认（仅 freecam 生效） |
| H | 72 | `overlay:toggleUI` | 隐藏/恢复 UI 覆盖层 | ✅ overlay enabled true→false→true |
| 1–4 | 49–52 | `firstperson:signature (n)` | 招牌动作/表情动画 | 源码确认 |
| P | 80 | `firstperson:addCameraPose` | 自由视角录制相机路径（Shift+P 回放，Catmull-Rom 插值） | 源码确认 |

键盘层的三条防呆规则（源码）：
- `e.repeat` 时忽略（按住不放只触发一次 keydown 逻辑，持续移动靠状态位而非连发）；
- `app.disableKeyboardMovement` 守卫栈深度 > 0 时全部吞掉（UI 输入框聚焦时）；
- `blur` / `visibilitychange` 时把所有方向状态清零并补发 `forward(0)/strafe(0)/boost(0)`——防止切标签页后"按键卡死"。

## 3. 鼠标操作总表（源码 + 实测）

| 操作 | 实现 | 验证 |
|---|---|---|
| **右键点击画布**（按下抬起，拖动 ≤6px） | 切换指针锁定 `canvas.requestPointerLock()` / `exitPointerLock()` | ✅ `pointerLockElement = application-canvas` |
| **锁定后移动鼠标** | `mousemove` 读 `movementX/movementY` → `firstperson:look(−mx/5, −my/5)` | ✅ mx=100 → 方位角 −20°；my=−50 → 仰角 +10° |
| **未锁定时按住左键拖拽** | `cameraMoveAllowed && buttons==1` 时同样走 look 分支 | ✅ 拖拽方位角 52.6°→84.5° |
| **第三人称下按住右键上下拖** | `thirdperson:adjustTargetHeight`（调相机目标高度，灵敏度 0.004） | 源码确认 |
| **滚轮（第一人称）** | 累计 deltaY ≥ 120 → 切换到第三人称 | 源码确认 |
| **滚轮（第三人称）** | `thirdperson:zoomDistance`，灵敏度 0.002/像素：下滚拉远、上滚推近；推到最近（0.8m）仍继续 → 弹簧回弹 + `pushInIntent` 累计 ≥1.2 → 切回第一人称 | ✅ 两格滚轮 2.14→2.62（Δ0.48 = 2×120×0.002 精确吻合） |
| **滚轮（自由视角）** | 累计 ≥50 → `freeCam:changeSpeed` 调飞行速度 | 源码确认 |
| 右键菜单 | `contextmenu` 被 `preventDefault()` | 源码确认 |

**指针锁定与视角旋转的核心代码**（反混淆后）：

```js
// mouseInput —— 右键抬起切换指针锁定
mouseup = (i) => {
  if (i.button === 2 && this._rightButtonDown && this._rightDragDistance <= 6) {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    else document.exitPointerLock();
  }
};

// mousemove —— 锁定 或 左键按住拖拽 时旋转视角
if (document.pointerLockElement === canvas || (this.cameraMoveAllowed && i.buttons === 1)) {
  const mx = i.movementX, my = i.movementY;
  app.fire("firstperson:look", -mx / 5, -my / 5);
}

// pointerlockchange → app.fire("isPointerLocked", true/false)，UI 据此显隐提示
```

```js
// firstPersonView —— look 事件的消费端
app.on("firstperson:look", (dAz, dEl) => {
  this.azimuth += dAz;
  this.elevation = pc.math.clamp(this.elevation + dEl, -80, 70);  // 仰角限位 [-80°, 70°]
  this.azimuth = ((this.azimuth % 360) + 360) % 360;
});
// 每帧把角度写回相机枢轴
this.cameraPivotFirst.setEulerAngles(this.elevation, this.azimuth, 0);
```

## 4. WASD 移动的实现链路

```js
// ① keyboardInput：按键状态 → 事件（值是 +1/0/−1，不是布尔）
case 87: this.forw_down = s; app.fire("firstperson:forward", -this.back_down + this.forw_down);

// ② firstPersonView：合成移动方向（相机水平前向 + 右向的加权和）
this.z.copy(camera.forward);  this.z.y = 0;  this.z.normalize();   // 前向（去掉俯仰）
this.x.copy(camera.right);    this.x.y = 0;  this.x.normalize();   // 右向
this.heading = z.scale(forward) + x.scale(strafe);
// 头部朝向用阻尼插值平滑转身（角速度系数 5/s）
this.dampened_mesh_angle = lerpAngle(this.dampened_mesh_angle, target_angle, dt * 5);

// ③ characterController.move(heading, boost, dt)：冲量驱动 Ammo 刚体
const v = heading.normalize().scale(len * this.speed * (1 + boost) * roomSpeed);
// speed 默认 5，roomSpeed 由房间配置覆盖；boost 即 Shift
// 落地时把水平速度投影到地面法线平面（贴坡行走）：
dir.cross(this.groundNormal, t).cross(dir, this.groundNormal);
this.entity.rigidbody.applyImpulse(Δv * mass, 0, Δv * mass);       // 只施加水平冲量，Y 留给重力
```

要点：
- **移动是物理冲量，不是直接改坐标**——天然获得碰撞、上台阶、被推动等物理效果；
- 落地时 `linearDamping=0.99` 快速衰减（松键即停），空中 `friction=0`（保持惯性）；
- 行走动画（ReadyPlayerMe 虚拟形象）速度随摇杆幅度缩放：`anim.speed = 1.4 × lastWalkingSpeed`，Shift 时最高 2。

## 5. 跳跃与角色物理（characterController）

- **碰撞体**：dynamic 刚体 + 「Collision Cyl」+「Collision Cone」两个碰撞组件拼成胶囊；刚体分组 `BODYGROUP_CHARACTERCONTROLLER (256)`。
- **跳跃**：`Space → applyImpulse(0, jumpImpulse(默认400) × 房间jumpHeight系数, 0)`，500ms 内禁止重复起跳；落地判定恢复后才允许再跳。
- **地面检测**：每帧从脚下 `y=−0.5` 到 `y=−0.6` 打射线（`raycastAll`），取最近命中为地面；同时记录 `groundNormal`（行走贴坡）、`groundEntity`。
- **站在移动物体上**：记录动态地面 `_kinematicPosDelta/_kinematicRotDelta`，把位移差和旋转差（含 yaw）"搬运"到角色身上（电梯/旋转平台不掉队）；站在动态物体上时把质量缩放到 0.02，避免压沉载具。
- **坠落兜底**：0.05m 内把角色 `teleport` 回命中点；完全悬空时施加 `9.81×mass` 反重力并视为着地；超出 `outOfBoundsRadius(1000m)` → `firstperson:outofbounds` 事件重生。

## 6. 相机模式系统（firstPersonView）

四种模式，`setCameraMode()` 统一管理，切换会保存到 `gameSettings.camera_view`（刷新记忆）：

| 模式 | 进入方式 | 特性 |
|---|---|---|
| first（第一人称） | 默认 / V / 滚轮推到底 | 相机挂在头部枢轴，虚拟形象只在第三人称渲染 |
| third（第三人称） | V / 第一人称下滚轮 | 距离 0.8–4m 弹簧缩放（回弹冲量 0.9、劲度 70、阻尼 12）；每帧对相机与枢轴连线 `raycastFirst` 防穿墙（命中则把相机拉到命中点）；A/D 横移时相机自动绕角色旋转（`azimuth -= strafe·dt·100`） |
| free（自由视角） | F | 脱离角色飞行：Shift 加速、E/Q 升降、滚轮调速度、T 隐藏形象、P 录制相机路径 |
| orbital（环绕） | UI 菜单指定 | 环绕观察某物体 |

辅助细节：
- FOV 自适应：`camera_fov` 设置在窄屏（竖屏）时按纵横比换算并抬高到 ≥90°；
- 相机目标高度偏移 `cameraTargetHeightOffset ∈ [−0.8, 0.5]`，第三人称右键上下拖调整；
- 虚拟形象身高变化时自动重算相机枢轴高度和第三人称距离上下限。

## 7. 点击地面自动行走（ClickToGo）

这是网页版博物馆场景很关键的交互（源码在 `clickToHighlight` + `characterController.goToPosition`）：

```js
// ① clickToHighlight：左键点击 → 射线检测地面
// 条件：命中面法线 normal.y > 0.7（朝上的平面）、命中点 y < 0.15、disableSceneTouch 深度 0
marker.setPosition(hit.point);            // 显示 ClickToGoMarker 落点标记
app.fire("goToPosition", hit.point);

// ② characterController.goToPosition：自动行走循环
do {
  dir = (target − pos).normalize();
  fpv.forward = cam.forward·dir;  fpv.strafe = cam.right·dir;   // 复用 WASD 通道！
  await sleep(60);                                               // 60ms 步进
} while (距离 > 0.2 && !this.abortGoto);
```

- 自动行走**复用第一人称的 forward/strafe 通道**，所以任何用户输入（`firstperson:forward/strafe/look`、传送）都会触发 `abortGoto` 打断；
- 15 次步进无进展（被卡住）也会自动放弃；
- 点击传送门、标注、展品等也会 `fire("goToPosition")` 走过去（VR 模式则直接 `teleportToPosition`）。

## 8. 触屏与手柄（源码确认）

**touchInput**（虚拟双摇杆）：
- 屏幕左下 1/3 区域按下 → 左摇杆（移动），落点即摇杆中心，半径 50px，死区 0.3；
- 其他区域按下 → 右摇杆（视角，150°/s）；再按下一指 → 双指捏合缩放（×2.5）；
- 右区 300ms 内双击 → 跳跃；摇杆拉出超过 3 倍半径 → 自动 boost 加速跑；
- 虚拟摇杆 UI 由 `virtualJoystick` 脚本按事件显隐（`leftjoystick:enable/move/disable`）。

**gamePadInput**（标准映射）：
- 左摇杆移动、右摇杆视角（90°/s）、A 键跳跃；内外死区各 0.1；每帧轮询 `navigator.getGamepads()`。

## 9. 输入守卫系统（为什么 UI 上滚轮/拖拽"失灵"）

Arrival 用两个 **CallerStack（调用者计数栈）** 做全局输入开关，比布尔开关更稳健（多重 UI 叠加不会互相覆盖）：

- `app.disablePointLock` —— >0 时禁止指针锁定；
- `app.disableSceneTouch` —— >0 时吞掉滚轮/触摸/点击行走；
- `app.disableKeyboardMovement` —— >0 时吞掉 WASD（输入框聚焦时）。

推入守卫的三类来源（实测定位）：
1. **教学引导浮层**（左下角 WASD 操作提示卡，"tutorial-screen-container"）：显示期间压栈 1，滚轮和指针锁定都失效；点 X 关闭后恢复。✅ 实测关闭前后 `disableSceneTouch.depth: 1→0`；
2. **UI 悬停守卫**：React 层在 `pointermove` 上追踪鼠标下的元素，命中 `PAWiGa_pointerOnlyLocker` 类的 UI（工具条、搜索侧栏、Add 按钮等）就压栈锁定场景输入，鼠标移回画布即弹栈。✅ 实测鼠标从 UI 移到画布 `depth: 1→0`；
3. 各类弹窗/菜单/录制条（`PopupScreen`、`alertCustom` 等）开栈关栈。

这就是"指针锁定后点 UI 不转视角、UI 弹窗开着时滚轮不缩放"的实现方式。

## 10. UI 覆盖层（实测截图）

- 左上：作者卡片（头像、昵称、场景名、发布日期）；
- 右上：主菜单（☰）、搜索（🔍）、麦克风开关；主菜单项：**探索 / 私信 / 录制屏幕 / Vibes / 虚拟形象 / 登录 / 语言 / 帮助&法律信息 / 设置**；
- 右侧栏：点赞 49、评论 13、收藏 32、分享；
- 左下：WASD + 鼠标操作提示卡（? 图标可再次呼出）；
- 右下：绿色 **+** 按钮（Add：发布评论/标注等）。

## 11. 与本项目（在线博物馆 Demo）的借鉴清单

| Arrival 的做法 | 移植到 Three.js 的对应实现 |
|---|---|
| 输入脚本只发事件，控制器只收事件 | 自定义 `EventEmitter` 或 `dispatchEvent`：`input → "player:forward/look/jump" → controller`，键盘/触屏/手柄互不知晓 |
| 右键切换指针锁定 + 锁定后 `movementX/Y` | `PointerLockControls`；未锁定时退化为"按住左键拖拽"，两种路径汇入同一个 look 事件 |
| 视角 = azimuth + elevation 两个标量，仰角 clamp [−80°,70°] | 不要直接用四元数累乘（会滚转）；每帧 `camera.rotation.set(el, az, 0, 'YXZ')` |
| 移动方向 = 相机水平前向 × forward + 水平右向 × strafe | `new THREE.Vector3().subVectors(target, camera.position); target.y = camera.position.y` 后归一化，避免低头时移动变慢 |
| 冲量式物理移动 | ` Rapier/Ammo/cannon-es` dynamic capsule + `applyImpulse`；或纯运动学 `characterController.move()` + 地面射线贴地 |
| 点击地面行走（复用移动通道 + 任意输入中断） | 射线取地面点 → 放标记 → 每帧朝目标设置虚拟 forward/strafe → 用户输入或 0.2m 内停止 |
| CallerStack 守卫栈 + UI hover 压栈 | 封装 `inputGuard.acquire()/release()`；UI 容器 `pointerenter/leave` 时压/弹栈，比零散的 `if (uiOpen)` 可靠 |
| 高斯泼溅场景 + GLB 碰撞体 | `@mkkellogg/gaussian-splats-3d` 渲染，另建简化代理网格做物理碰撞（Arrival 的 `GLBColliderEntity` 同思路） |
| 滚轮分级：第一人称→切换、第三人称→距离、自由→速度 | `wheel` 事件按当前相机模式分派到不同处理器，避免滚轮语义混乱 |
| blur/visibilitychange 清零按键状态 | `window.addEventListener('blur', resetKeys)` 防按键卡死 |

---

## 附：验证方法记录

- 源码：`curl https://arrival.space/__game-scripts.js`（8.7MB）→ 按 `pc.createScript("name")` 切块提取 → js-beautify 反混淆后阅读 `keyboardInput / mouseInput / touchInput / gamePadInput / characterController / firstPersonView / freeCamView / clickToHighlight` 等脚本；
- 实测：PlayCanvas 应用暴露 `window.pc.app`，在页面上下文直接读取 `firstPersonView.azimuth/elevation/currentCameraMode`、`characterController` 位置、`disablePointLock/disableSceneTouch` 守卫深度；用合成 `KeyboardEvent`（需 defineProperty 注入 `keyCode`）、`MouseEvent`（注入 `movementX/Y`）、`WheelEvent` 驱动输入层，指针锁定需真实点击提供 user activation 后在 5s 窗口内完成。
