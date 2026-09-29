// ======== characterController ========
pc.createScript("characterController");
CharacterController.attributes.add("speed", {
    type: "number",
    default: 5
}), CharacterController.attributes.add("jumpImpulse", {
    type: "number",
    default: 400
}), CharacterController.attributes.add("groundCheckStart", {
    type: "number",
    default: -.5
}), CharacterController.attributes.add("groundCheckEnd", {
    type: "number",
    default: -.6
}), CharacterController.attributes.add("dynamicGroundMassScale", {
    type: "number",
    default: .02,
    description: "Scales character mass while standing on a dynamic rigidbody"
}), CharacterController.attributes.add("outOfBoundsRadius", {
    type: "number",
    default: 1e3,
    description: "If farer away than this value, respawn get triggered"
}), CharacterController.prototype.initialize = function() {
    this.groundCheckRayStart = new pc.Vec3(0, this.groundCheckStart, 0), this.groundCheckRayEnd = new pc.Vec3(0, this.groundCheckEnd, 0), this.rayStart = new pc.Vec3, this.rayEnd = new pc.Vec3, this.groundNormal = new pc.Vec3, this.groundLinearVelocity = new pc.Vec3, this.groundAngularVelocity = new pc.Vec3, this.groundSupportVelocity = new pc.Vec3, this.groundContactOffset = new pc.Vec3, this.groundVisualYawDelta = 0, this.lastGroundVisualRotation = new pc.Quat, this.hasLastGroundVisualRotation = !1, this.groundVisualDeltaRotation = new pc.Quat, this.lastGroundVisualEntity = null, this.onGround = !0, this.jumping = !1, this._velocityTakeoff = !1, this.groundEntity = null, this.groundIsDynamic = !1, this.baseMass = this.entity.rigidbody.mass, this.currentMassScale = 1, this.lastStandingEventEntity = null, this.suspend = !0, this.lastGroundHit = null, this.readyPlayerMe = this.entity.findByName("ReadyPlayerMe"), this.app.characterControllerInitialized && console.error("ERROR: multiple character controllers, bad scene inint??"), this.app.characterControllerInitialized = !0, this.goToPositionCB = this.goToPosition.bind(this), this.teleportToPositionCB = this.teleportToPosition.bind(this);
    const onEnable = () => {
            CoreLib.Logger.debug("debug-camera", "Character is enabled.")
        },
        onDisable = () => {
            CoreLib.Logger.debug("debug-camera", "Character is disabled.")
        };
    this.app.on("goToPosition", this.goToPositionCB), this.app.on("teleportToPosition", this.teleportToPositionCB), this.on("enable", onEnable), this.on("disable", onDisable);
    const onUnloadSpace = () => {
            this.suspend = !0, this._velocityTakeoff = !1
        },
        onReady = () => {
            this.suspend = !1, this._velocityTakeoff = !1, this.lastGroundHit = null, this.groundEntity = null, this.groundIsDynamic = !1, this.groundLinearVelocity.set(0, 0, 0), this.groundAngularVelocity.set(0, 0, 0), this.groundSupportVelocity.set(0, 0, 0), this.groundContactOffset.set(0, 0, 0), this.groundVisualYawDelta = 0, this.hasLastGroundVisualRotation = !1, this.lastGroundVisualEntity = null, this.lastStandingEventEntity = null, this.app.customTravelCenter && (this.app.customTravelCenter.lastGroundHit = null)
        };
    this.app.on("space:unload", onUnloadSpace, this), this.app.on("character:ready", onReady, this), this.on("destroy", (() => {
        this.app.characterControllerInitialized = null, this.app.off("goToPosition", this.goToPositionCB), this.app.off("teleportToPosition", this.teleportToPositionCB), this.app.off("space:unload", onUnloadSpace, this), this.app.off("character:ready", onReady, this), this.off("enable", onEnable), this.off("disable", onDisable)
    }), this), pc.BODYGROUP_CHARACTERCONTROLLER = 256, this.entity.rigidbody.group = pc.BODYGROUP_CHARACTERCONTROLLER
};
const IMPULSE_GAIN_60HZ = .3;
CharacterController.prototype.move = function(t, i, o) {
    this.entity.rigidbody.friction = 0, this.entity.rigidbody.linearDamping = 0;
    let e = 1;
    this.app.customTravelCenter?.roomData?.moveSpeed && (e = this.app.customTravelCenter.roomData.moveSpeed);
    const s = t.length();
    let n = 0,
        a = 0;
    if (!this.onGround || this.jumping || this._velocityTakeoff) {
        if (s > 0) {
            this.entity.rigidbody.friction = 0;
            const o = t.clone();
            o.normalize().scale(s * this.speed * (1 + i) * e), n = o.x, a = o.z
        }
    } else if (s > 0) {
        const o = new pc.Vec3;
        o.cross(this.groundNormal, t).cross(o, this.groundNormal), o.normalize().scale(s * this.speed * (1 + i) * e), n = o.x, a = o.z, this.entity.rigidbody.linearDamping = this.groundIsDynamic ? 0 : .99
    } else this.entity.rigidbody.friction = this.groundIsDynamic ? 0 : .9, this.entity.rigidbody.linearDamping = this.groundIsDynamic ? 0 : .9999;
    if (this.groundSupportVelocity.lengthSq() > .001) {
        const t = this.entity.rigidbody.linearVelocity;
        t.x = this.groundSupportVelocity.x, t.z = this.groundSupportVelocity.z, this.entity.rigidbody.linearVelocity = t
    }
    const r = Math.min(o || 1 / 60, .1),
        h = this.entity.rigidbody.linearDamping,
        l = Math.pow(1 - h, 1 / 60),
        d = .7 * l,
        c = .3 * l / (1 - d),
        u = Math.pow(d, 60 * r),
        y = Math.pow(1 - h, r),
        p = this.entity.rigidbody.linearVelocity,
        g = p.x - this.groundSupportVelocity.x,
        f = p.z - this.groundSupportVelocity.z,
        m = (u * g + (1 - u) * c * n) / y - g,
        b = (u * f + (1 - u) * c * a) / y - f;
    if (m * m + b * b > 1e-8) {
        const t = this.entity.rigidbody.mass;
        this.entity.rigidbody.applyImpulse(m * t, 0, b * t)
    }
}, CharacterController.prototype.setMassScale = function(t) {
    const i = Math.max(.01, t || 1);
    Math.abs(this.currentMassScale - i) < .001 || (this.currentMassScale = i, this.entity.rigidbody.mass = this.baseMass * i)
}, CharacterController.prototype.notifyStandingObjectChanged = function() {
    const t = this.groundEntity || null;
    if (this.lastStandingEventEntity === t) return;
    const i = this.lastStandingEventEntity;
    this.lastStandingEventEntity = t, this.entity.fire("firstperson:standingObjectChanged", t, i), this.app.fire("firstperson:standingObjectChanged", t, i)
}, CharacterController.prototype.applyGroundYawCarry = function(t) {
    if (this.groundVisualYawDelta = 0, !this.groundIsDynamic || this.jumping || !t || this.app.xr.active || !this.groundEntity) return this.hasLastGroundVisualRotation = !1, void(this.lastGroundVisualEntity = null);
    const i = this.groundEntity.getRotation();
    if (!(Number.isFinite(i.x) && Number.isFinite(i.y) && Number.isFinite(i.z) && Number.isFinite(i.w))) return this.hasLastGroundVisualRotation = !1, void(this.lastGroundVisualEntity = null);
    if (this.lastGroundVisualEntity !== this.groundEntity || !this.hasLastGroundVisualRotation) return this.lastGroundVisualEntity = this.groundEntity, this.lastGroundVisualRotation.copy(i), void(this.hasLastGroundVisualRotation = !0);
    this.groundVisualDeltaRotation.copy(this.lastGroundVisualRotation).invert(), this.groundVisualDeltaRotation.mul2(i, this.groundVisualDeltaRotation);
    let o = 2 * Math.atan2(this.groundVisualDeltaRotation.y, this.groundVisualDeltaRotation.w) * pc.math.RAD_TO_DEG;
    for (; o > 180;) o -= 360;
    for (; o < -180;) o += 360;
    this.groundVisualYawDelta = o, this.lastGroundVisualRotation.copy(i)
}, CharacterController.prototype.jump = function() {
    !0 !== this.app.sequenceEditorActive && (!this.onGround || this.jumping || this._velocityTakeoff || (this.setMassScale(1), this.entity.rigidbody.applyImpulse(0, this.jumpImpulse * (this.app.customTravelCenter?.roomData?.jumpHeight ?? 1), 0), this.onGround = !1, this.jumping = !0, setTimeout((() => {
        this.jumping = !1
    }), 500)))
}, CharacterController.prototype.setVelocity = function(t) {
    if (!t || "object" != typeof t) return !1;
    const i = ["x", "y", "z"].filter((i => void 0 !== t[i]));
    if (!i.length || i.some((i => !Number.isFinite(t[i])))) return !1;
    const o = this.entity.rigidbody;
    if (!this.enabled || this.suspend || !this.entity.enabled || !o?.enabled || !o.body || "dynamic" !== o.type || !this.entity.collision?.enabled || !0 === this.app.sequenceEditorActive || this.app.timeScale <= 0) return !1;
    const e = o.linearVelocity.clone();
    for (const o of i) e[o] = t[o];
    return this._velocityTakeoff = e.y > 0, this._velocityTakeoff && (this.setMassScale(1), this.onGround = !1, this.groundEntity = null, this.groundIsDynamic = !1, this.groundSupportVelocity.set(0, 0, 0)), o.linearDamping = 0, o.friction = 0, o.linearVelocity = e, o.activate(), !0
}, CharacterController.prototype.teleportToPosition = async function(t, i, o) {
    if (this._velocityTakeoff = !1, CoreLib.Logger.debug("debug-camera", "Teloporting player to:", {
            pos: t,
            forward: i,
            azimuth: o
        }), this.entity.rigidbody.teleport(t), i && !this.app.xr.active) {
        const t = this.entity.script.firstPersonView;
        i.y = 0, i.normalize(), t.azimuth = Math.atan2(-i.x, -i.z) * (180 / Math.PI), t.azimuthTarget = null
    }
    if ("number" == typeof o && !this.app.xr.active) {
        const t = this.entity.script.firstPersonView;
        t.azimuth = o, t.azimuthTarget = null
    }
    0 == this.app.timeScale && (this.app.timeScale = 1, setTimeout((() => {
        this.app.timeScale = 0
    }), 1))
}, CharacterController.prototype.goToPosition = async function(t, i) {
    const o = this.app.root.findByName("Camera"),
        e = this.app.root.findByName("ClickToGoMarker"),
        s = e.enabled,
        n = this.entity.script.firstPersonView;
    this.abortGoto = !0, await this.gotoPromise, this.abortGoto = !1, s && (e.enabled = !0), this.gotoPromise = new Promise((async e => {
        const abort = t => {
            0 != t && (this.abortGoto = !0)
        };
        this.app.on("firstperson:forward", abort), this.app.on("firstperson:strafe", abort), this.app.on("firstperson:look", abort), this.app.on("teleportToPosition", abort), this.app.on("firstperson:abortGoto", abort), this.app.on("space:unload", abort);
        const s = t.clone().sub(this.entity.getPosition());
        s.y = 0, s.normalize(), this.app.xr.active || (n.azimuthTarget = Math.atan2(-s.x, -s.z) * (180 / Math.PI), i && (n.azimuth = n.azimuthTarget, n.azimuthTarget = null));
        let a = (new pc.Vec3).sub2(t, this.entity.position);
        t.y = this.entity.position.y;
        let r = 0,
            h = a.length(),
            l = h;
        do {
            const i = a.clone().normalize();
            let e = o.forward.dot(i),
                s = o.right.dot(i);
            const d = Math.sqrt(e * e + s * s);
            d > .01 && (e /= d, s /= d), n.forward = e, n.strafe = s, await new Promise((t => {
                setTimeout(t, 60)
            })), t.y = this.entity.position.y, a = (new pc.Vec3).sub2(t, this.entity.position), h = a.length(), l - h <= .01 ? r++ : r = 0, r > 15 && (this.abortGoto = !0), l = h
        } while (h > .2 && !this.abortGoto);
        this.app.off("firstperson:forward", abort), this.app.off("firstperson:strafe", abort), this.app.off("firstperson:look", abort), this.app.off("teleportToPosition", abort), this.app.off("firstperson:abortGoto", abort), this.app.off("space:unload", abort), e(!this.abortGoto)
    })), await this.gotoPromise, this.entity.script.firstPersonView.forward = 0, this.entity.script.firstPersonView.strafe = 0, e.enabled = !1
}, CharacterController.prototype.clampBetweenWalls = function() {
    const t = this.entity.getPosition(),
        i = Math.sqrt(t.x * t.x + t.z * t.z);
    if (i > 10) {
        const o = 10 / i;
        t.x *= o, t.z *= o
    }
    t.y = Math.max(0, Math.min(5, t.y)), this.entity.rigidbody.teleport(t)
}, CharacterController.prototype.postUpdate = function(t) {
    if (this.suspend) return;
    this._velocityTakeoff && this.entity.rigidbody.linearVelocity.y <= 0 && (this._velocityTakeoff = !1);
    const i = this.entity.getPosition();
    this.rayStart.add2(i, this.groundCheckRayStart), this.rayEnd.add2(i, this.groundCheckRayEnd);
    const o = this.app.systems.rigidbody.raycastAll(this.rayStart, this.rayEnd);
    let e = null,
        s = 1 / 0;
    for (const t of o) {
        if (!t.entity.rigidbody) continue;
        if (t.entity === this.entity) continue;
        const i = t.point.distance(this.rayStart);
        i < s && (s = i, e = t)
    }
    const n = this._velocityTakeoff ? null : e;
    if (this.onGround = !!n, n) {
        n.point.y > i.y + .05 && (this.entity.rigidbody.teleport(n.point), 0 == t && 0 == this.app.timeScale && (this.app.timeScale = 1, setTimeout((() => {
            this.app.timeScale = 0
        }), 1))), this.groundNormal.copy(n.normal), this.groundEntity = n.entity, this.groundIsDynamic = "dynamic" === n.entity.rigidbody?.type || "kinematic" === n.entity.rigidbody?.type, this.groundContactOffset.copy(n.point).sub(n.entity.getPosition());
        const o = n.entity._kinematicPosDelta,
            e = n.entity._kinematicRotDelta;
        if (o) {
            const t = this.entity.getPosition();
            if (this.entity.rigidbody.teleport(t.x + o.x, t.y + o.y, t.z + o.z), e) {
                if (Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z) > 1e-4) {
                    const t = this.groundContactOffset.clone();
                    e.transformVector(t, t);
                    const i = t.sub(this.groundContactOffset),
                        o = this.entity.getPosition();
                    this.entity.rigidbody.teleport(o.x + i.x, o.y + i.y, o.z + i.z)
                }
            }
            this.groundLinearVelocity.set(0, 0, 0), this.groundAngularVelocity.set(0, 0, 0), this.groundSupportVelocity.set(0, 0, 0)
        } else if (this.groundLinearVelocity.copy(n.entity.rigidbody?.linearVelocity || pc.Vec3.ZERO), this.groundAngularVelocity.copy(n.entity.rigidbody?.angularVelocity || pc.Vec3.ZERO), this.groundSupportVelocity.copy(this.groundLinearVelocity), this.groundAngularVelocity.lengthSq() > 1e-6) {
            const t = new pc.Vec3;
            t.cross(this.groundAngularVelocity, this.groundContactOffset), this.groundSupportVelocity.add(t)
        }
        this.notifyStandingObjectChanged(), this.lastGroundHit = this.entity.getPosition().clone(), this.app.customTravelCenter.lastGroundHit = this.lastGroundHit, this.groundIsDynamic && !this.jumping ? this.setMassScale(this.dynamicGroundMassScale) : this.setMassScale(1), this.applyGroundYawCarry(t)
    } else {
        this.groundEntity = null, this.groundIsDynamic = !1, this.groundLinearVelocity.set(0, 0, 0), this.groundAngularVelocity.set(0, 0, 0), this.groundSupportVelocity.set(0, 0, 0), this.groundContactOffset.set(0, 0, 0), this.groundVisualYawDelta = 0, this.hasLastGroundVisualRotation = !1, this.lastGroundVisualEntity = null, this.notifyStandingObjectChanged(), this.applyGroundYawCarry(0), this.setMassScale(1), this.rayStart.add2(i, new pc.Vec3(0, 0, 0)), this.rayEnd.add2(i, new pc.Vec3(0, -100, 0));
        const t = this.app.systems.rigidbody.raycastAll(this.rayStart, this.rayEnd);
        if (this.lastGroundHit || (this.lastGroundHit = this.entity.getPosition().clone()), 0 === t.length) {
            this.groundNormal = new pc.Vec3(0, 1, 0);
            const t = this.entity.getPosition().clone();
            if (t.y <= this.lastGroundHit.y) {
                t.y < this.lastGroundHit.y - .01 && (t.y = this.lastGroundHit.y, this.entity.rigidbody.teleport(t));
                const i = this.entity.rigidbody.linearVelocity.clone();
                i.y < 0 && (i.y = 0, this.entity.rigidbody.linearVelocity = i);
                const o = 9.81 * this.entity.rigidbody.mass;
                this.entity.rigidbody.applyForce(0, o, 0), this.onGround = !0
            } else t.y - this.lastGroundHit.y < .03 && (this.onGround = !0)
        }
    }
    this._velocityTakeoff && (this.onGround = !1), i.y < -this.outOfBoundsRadius && this.app.fire("firstperson:outofbounds")
}, CharacterController.prototype.setMouth = function(t) {
    this.readyPlayerMe.findComponents("render").forEach((function(i) {
        i.meshInstances.forEach((function(i) {
            i.morphInstance && i.morphInstance.setWeight(0, t)
        }))
    }))
};
const FirstPersonView =

    // ======== firstPersonView ========
    pc.createScript("firstPersonView"),
    CAMERA_TARGET_HEIGHT_OFFSET_MIN = -.8,
    CAMERA_TARGET_HEIGHT_OFFSET_MAX = .5,
    CAMERA_TARGET_PIVOT_MIN_Y = .3,
    CAMERA_TARGET_HEIGHT_DRAG_SENSITIVITY = .004,
    CAMERA_TARGET_HEIGHT_DRAG_THRESHOLD = 6;
FirstPersonView.attributes.add("cameraPivotFirst", {
    title: "Camera Pivot First",
    description: "The camera controlled by this first person view. It should be a child of the entity to which this script is assigned.",
    type: "entity"
}), FirstPersonView.attributes.add("cameraPivotThird", {
    title: "Camera Pivot Third",
    description: "Third person camera",
    type: "entity"
}), FirstPersonView.attributes.add("cameraObject", {
    title: "Camera Object",
    description: "",
    type: "entity"
}), FirstPersonView.attributes.add("cameraTargetHeightOffset", {
    title: "Camera Target Height Offset",
    description: "Shared vertical target offset for first and third person camera pivots.",
    type: "number",
    default: 0
}), FirstPersonView.attributes.add("playerMesh", {
    title: "Player Mesh",
    description: "The player mesh that represents the body (ReadyPlayerMe)",
    type: "entity"
}), FirstPersonView.attributes.add("detachedCameraEntity", {
    title: "Free Camera Entity",
    description: "The Free Cam Entity",
    type: "entity"
}), FirstPersonView.attributes.add("orbitalCamera", {
    title: "Orbital Camera",
    description: "The Orbital Camera",
    type: "entity"
}), FirstPersonView.prototype.initialize = function() {
    const e = this.app;
    if (!this.cameraPivotFirst) return void console.error("no camera set");
    this.x = new pc.Vec3, this.z = new pc.Vec3, this.heading = new pc.Vec3, this.magnitude = new pc.Vec2, this.azimuth = 0, this.elevation = 0;
    const t = this.cameraPivotFirst.forward.clone();
    t.y = 0, t.normalize(), this.azimuth = Math.atan2(-t.x, -t.z) * (180 / Math.PI);
    (new pc.Mat4).setFromAxisAngle(pc.Vec3.UP, -this.azimuth).transformVector(this.cameraPivotFirst.forward, t), this.elevation = Math.atan(t.y, t.z) * (180 / Math.PI), this.forward = 0, this.strafe = 0, this.jump = !1, this.cnt = 0, this.boost = 0, this.groundMeshYawOffset = 0, this.lastActiveAnimState = null, this.cameraPivotFirst.enabled = !1, this.cameraPivotThird.enabled = !0, this.baseFirstPivotLocalPos = this.cameraPivotFirst.getLocalPosition().clone(), this.baseThirdPivotLocalPos = this.cameraPivotThird.getLocalPosition().clone(), this.applyCameraTargetHeightOffset(this.cameraTargetHeightOffset), this.localThirdOffset = this.cameraPivotThird.children[0].getLocalPosition().clone(), this.localThirdDirection = this.localThirdOffset.clone(), this.localThirdDirection.length() <= 1e-4 ? this.localThirdDirection.set(0, 0, 1) : this.localThirdDirection.normalize(), this.thirdPersonDistanceMin = .8, this.thirdPersonDistanceMax = 4, this.thirdPersonZoomSensitivity = .002, this.thirdPersonDistanceCurrent = pc.math.clamp(this.localThirdOffset.length(), this.thirdPersonDistanceMin, this.thirdPersonDistanceMax), this.thirdPersonDistanceTarget = this.thirdPersonDistanceCurrent, this.thirdPersonBounceOffset = 0, this.thirdPersonBounceVelocity = 0, this.thirdPersonBounceImpulse = .9, this.thirdPersonBounceSpring = 70, this.thirdPersonBounceDamping = 12, this.thirdPersonBounceMax = .5, this.thirdPersonPushInIntent = 0, this.thirdPersonPushInSwitchThreshold = 1.2, this.localThirdOffset.copy(this.localThirdDirection).mulScalar(this.thirdPersonDistanceCurrent), this._baseThirdDistanceMin = this.thirdPersonDistanceMin, this._baseThirdDistanceMax = this.thirdPersonDistanceMax, this._avatarHeightDelta = 0, this.cameraModes = {
        first: {
            enable: this.enableFirstPersonCamera.bind(this),
            disable: this.disableFirstPersonCamera.bind(this)
        },
        third: {
            enable: this.enableThirdPersonCamera.bind(this),
            disable: this.disableThirdPersonCamera.bind(this)
        },
        free: {
            enable: this.enableFreeCamera.bind(this),
            disable: this.disableFreeCamera.bind(this)
        },
        orbital: {
            enable: this.enableOrbitalCamera.bind(this),
            disable: this.disableOrbitalCamera.bind(this)
        }
    }, this.currentCameraMode = null, this.on("attr:cameraTargetHeightOffset", (function(e) {
        this.applyCameraTargetHeightOffset(e)
    }), this);
    const updateFov = () => {
            this.app.gameSettings.camera_fov && this.adjustCameraFOV(this.app.gameSettings.camera_fov)
        },
        i = [];
    i.push(e.on("camera:adjustFOV", (e => {
        this.adjustCameraFOV(e)
    }))), i.push(e.on("firstperson:forward", (function(e, t) {
        this.forward = e, this.forwardNoDamp = t, this.azimuthTarget = null
    }), this)), i.push(e.on("firstperson:strafe", (function(e) {
        this.strafe = e, this.azimuthTarget = null
    }), this)), i.push(e.on("firstperson:lookAtWhileStill", this.handleLookAtWhileStill, this)), i.push(e.on("firstperson:lookAt", this.handleLookAt, this)), i.push(e.on("firstperson:lookAtPosition", this.handleLookAtPosition, this)), i.push(e.on("firstperson:setCameraOffset", (e => {
        this.applyCameraTargetHeightOffset(e)
    }), this)), i.push(e.on("glbEntity:loaded", (e => {
        e && e.entity === this.playerMesh && (this._reframeRequested = !0)
    }), this)), this._reframeRequested = !0, i.push(e.on("firstperson:look", (function(e, t) {
        CoreLib.Logger.debug("debug-camera", "firstperson:look", {
            azimuthDelta: e,
            elevationDelta: t
        }), Number.isNaN(e) || Number.isNaN(t) ? console.error("firstperson:look NaN", e, t) : (this.azimuth += e, this.elevation += t, this.elevation = pc.math.clamp(this.elevation, -80, 70), this.azimuth > 360 && (this.azimuth -= 360), this.azimuth < 0 && (this.azimuth += 360), this.azimuthTarget = null, this.disableAutoLook = !0)
    }), this)), i.push(e.on("firstperson:lookEnd", (function() {
        this.disableAutoLook = !1
    }), this)), i.push(e.on("thirdperson:zoomDistance", (function(e) {
        if ("third" !== this.currentCameraMode || !Number.isFinite(e)) return;
        let t = this.thirdPersonDistanceTarget + e * this.thirdPersonZoomSensitivity;
        if (t < this.thirdPersonDistanceMin) {
            const e = t - this.thirdPersonDistanceMin;
            if (t = this.thirdPersonDistanceMin, this.thirdPersonBounceVelocity += e * this.thirdPersonBounceImpulse, this.thirdPersonPushInIntent += Math.abs(e), this.thirdPersonPushInIntent >= this.thirdPersonPushInSwitchThreshold) return this.thirdPersonPushInIntent = 0, void this.setCameraMode("first")
        } else if (t > this.thirdPersonDistanceMax) {
            const e = t - this.thirdPersonDistanceMax;
            t = this.thirdPersonDistanceMax, this.thirdPersonBounceVelocity += e * this.thirdPersonBounceImpulse, this.thirdPersonPushInIntent = 0
        } else this.thirdPersonPushInIntent *= .5;
        this.thirdPersonBounceVelocity = pc.math.clamp(this.thirdPersonBounceVelocity, -6, 6), this.thirdPersonDistanceTarget = t, this.app.needsRedraw = !0
    }), this)), i.push(e.on("thirdperson:adjustTargetHeight", (function(e) {
        if ("third" !== this.currentCameraMode || !Number.isFinite(e)) return;
        const t = (this.baseThirdPivotLocalPos && this.baseThirdPivotLocalPos.y || 0) + (this._avatarHeightDelta || 0),
            i = Math.min(0, Math.max(-.8, .3 - t)),
            s = Number(this.cameraTargetHeightOffset) || 0,
            a = pc.math.clamp(s + e, i, .5);
        a !== s && (this.cameraTargetHeightOffset = a, this.applyCameraTargetHeightOffset(a), this.app.needsRedraw = !0)
    }), this)), i.push(e.on("firstperson:jump", (function() {
        this.jump = !0
    }), this)), i.push(e.on("firstperson:boost", (function(e) {
        this.boost = e
    }), this)), i.push(e.on("firstperson:signature", (function(e, t) {
        e ? (this.signatureReset = !0, this.signature = t) : this.signature = 0
    }), this)), i.push(e.on(ReactUI.EVENT.CAMERA_SET_POV, (() => {
        this.setCameraMode("third")
    }))), i.push(e.on(ReactUI.EVENT.CAMERA_SET_FREE, (() => {
        this.setCameraMode("free")
    }))), i.push(e.on(ReactUI.EVENT.CAMERA_SET_ORBITAL, (() => {
        this.setCameraMode("orbital")
    }))), i.push(e.on("firstperson:cameraSwitch", (function(e, t, i) {
        if (this.app.xr.active && "first" != i) CoreLib.Logger.debug("debug-camera", "firstperson:cameraSwitch skip for active VR session");
        else if (e) {
            if (t && (this.elevation = 0), !i)
                if ("first" === this.currentCameraMode) i = "third";
                else if ("third" === this.currentCameraMode) i = "first";
            else {
                if (this.currentCameraMode) return void console.log("Not switching camera mode");
                i = "first"
            }
            CoreLib.Logger.debug("debug-camera", "firstperson:cameraSwitch:", i), this.setCameraMode(i)
        }
    }), this)), i.push(e.on("firstperson:cameraSwitchFreeCam", (e => {
        e && this.toggleFreecam()
    }))), i.push(e.on("firstperson:addCameraPose", (function(e, t) {
        this.addCameraPose(e, t)
    }), this)), i.push(e.on("teleport:turn", (function(e) {
        console.log("teleport:turn", e), this.azimuth += -45 * e, this.azimuthTarget = null
    }), this)), i.push(e.on("teleport:to", (function(e) {
        this.playerEntity.rigidbody.teleport(e)
    }), this)), i.push(e.on("character:ready", (() => {
        this.boost = 0
    }))), this.on("destroy", (() => {
        i.forEach((e => e.off())), window.removeEventListener("resize", updateFov, !1)
    }), this);
    const s = this.app.game.getGameSettings();
    this.app.numSessionLoads <= 1 && s.camera_view && (s.camera_view = null, this.app.game.saveGameSettings(s));
    const a = new URLSearchParams(location.search).get("camera_mode");
    let r = null;
    ["free", "third", "first"].includes(a) && (r = a), r = r || s.camera_view, r && this.setCameraMode(r), this.app.natsHostCaptureMode || window.addEventListener("resize", updateFov, !1)
};
const dampAngle = (e, t, i, s) => pc.math.lerpAngle(e, t, s * i);
FirstPersonView.prototype.handleLookAtWhileStill = function(e, t, i = !1) {
    0 == this.forward && this.handleLookAt(e, t, i)
}, FirstPersonView.prototype.handleLookAt = function(e, t, i = !1) {
    const s = e.clone().sub(this.playerMesh.getPosition());
    s.y = 0, s.normalize(), this.azimuth = Math.atan2(-s.x, -s.z) * (180 / Math.PI), this.azimuthTarget = null, CoreLib.Logger.debug("debug-camera", "firstperson:lookAt", {
        azimuth: this.azimuth
    }), t && (this.elevation = pc.math.clamp(t, -80, 70)), this.dampened_mesh_angle = this.azimuth + 180, this.target_angle = this.dampened_mesh_angle, i && this.update(0)
}, FirstPersonView.prototype.handleLookAtPosition = function(e) {
    const t = e.clone().sub(this.playerMesh.getPosition()),
        i = t.clone();
    i.y = 0, i.normalize(), this.azimuth = Math.atan2(-i.x, -i.z) * (180 / Math.PI), this.azimuthTarget = null;
    const s = Math.sqrt(t.x * t.x + t.z * t.z),
        a = Math.atan2(t.y, s) * (180 / Math.PI);
    this.elevation = pc.math.clamp(a, -80, 70), CoreLib.Logger.debug("debug-camera", "firstperson:lookAtPosition", {
        azimuth: this.azimuth,
        elevation: this.elevation,
        position: e.toString()
    }), this.dampened_mesh_angle = this.azimuth + 180, this.target_angle = this.dampened_mesh_angle
}, FirstPersonView.prototype.setCameraMode = function(e) {
    if (this.currentCameraMode !== e) {
        if (this.currentCameraMode && (CoreLib.Logger.debug("debug-camera", "setCameraMode disabling:", this.currentCameraMode), this.cameraModes[this.currentCameraMode].disable()), this.cameraModes[e]) {
            CoreLib.Logger.debug("debug-camera", "setCameraMode enabling:", e), this.cameraModes[e].enable(), this.currentCameraMode = e;
            const t = this.app.game.getGameSettings();
            t.camera_view = e, this.app.game.setGameSettings(t)
        } else console.warn("Invalid camera mode:", e);
        this.app.needsRedraw = !0
    }
}, FirstPersonView.prototype.addCameraPose = function(e, t) {
    if (this.cameraPoses || (this.cameraPoses = [], this.isPlayingPath = !1), "p" === t.key && e) {
        const e = this.cameraObject.getPosition().clone(),
            t = this.cameraObject.getRotation().clone();
        this.cameraPoses.push({
            position: e,
            rotation: t,
            azimuth: this.azimuth,
            elevation: this.elevation
        }), console.log(`Camera Pose ${this.cameraPoses.length} recorded:`, e.toString())
    } else if ("P" === t.key && e) {
        if (this.cameraPoses.length < 2) return void console.log("Need at least 2 poses to play a path");
        if (this.isPlayingPath) return console.log("Stopping camera path playback"), void(this.isPlayingPath = !1);
        console.log("Playing camera path with", this.cameraPoses.length, "poses"), this.playCameraPath()
    }
}, FirstPersonView.prototype.catmullRom = function(e, t, i, s, a) {
    const r = a * a,
        n = r * a;
    return new pc.Vec3(.5 * (2 * t.x + (-e.x + i.x) * a + (2 * e.x - 5 * t.x + 4 * i.x - s.x) * r + (-e.x + 3 * t.x - 3 * i.x + s.x) * n), .5 * (2 * t.y + (-e.y + i.y) * a + (2 * e.y - 5 * t.y + 4 * i.y - s.y) * r + (-e.y + 3 * t.y - 3 * i.y + s.y) * n), .5 * (2 * t.z + (-e.z + i.z) * a + (2 * e.z - 5 * t.z + 4 * i.z - s.z) * r + (-e.z + 3 * t.z - 3 * i.z + s.z) * n))
}, FirstPersonView.prototype.playCameraPath = function() {
    if (!this.cameraPoses || this.cameraPoses.length < 2) return;
    this.isPlayingPath = !0;
    const e = this.currentCameraMode;
    this.setCameraMode("free");
    const t = this.cameraPoses,
        i = t.length - 1,
        s = 2 * i,
        a = Date.now(),
        animate = () => {
            if (!this.isPlayingPath) return void(e && "free" !== e && this.setCameraMode(e));
            const r = (Date.now() - a) / 1e3;
            if (r >= s) return console.log("Camera path playback complete"), void(this.isPlayingPath = !1);
            const n = r / s * i,
                o = Math.floor(n),
                h = n - o,
                c = h * h * (3 - 2 * h);
            let d, l;
            if (t.length >= 2) {
                const e = Math.max(0, o - 1),
                    i = o,
                    s = Math.min(t.length - 1, o + 1),
                    a = Math.min(t.length - 1, o + 2),
                    r = t[e].position,
                    n = t[i].position,
                    p = t[s].position,
                    m = t[a].position;
                d = this.catmullRom(r, n, p, m, h);
                const u = t[i].rotation,
                    f = t[s].rotation;
                l = (new pc.Quat).slerp(u, f, c)
            } else {
                const e = t[o],
                    i = t[Math.min(o + 1, t.length - 1)];
                d = (new pc.Vec3).lerp(e.position, i.position, c), l = (new pc.Quat).slerp(e.rotation, i.rotation, c)
            }
            this.cameraObject.setPosition(d), this.cameraObject.setRotation(l), this.app.needsRedraw = !0, requestAnimationFrame(animate)
        };
    requestAnimationFrame(animate)
}, FirstPersonView.prototype.clearCameraPoses = function() {
    this.cameraPoses = [], this.isPlayingPath = !1, console.log("Camera poses cleared")
}, FirstPersonView.prototype.enableFirstPersonCamera = function() {
    this.cameraPivotFirst.enabled = !0, this.cameraPivotFirst.children[0].addChild(this.cameraObject)
}, FirstPersonView.prototype.disableFirstPersonCamera = function() {
    this.cameraPivotFirst.children[0].removeChild(this.cameraObject), this.cameraPivotFirst.enabled = !1
}, FirstPersonView.prototype.enableThirdPersonCamera = function() {
    this.app.xr.active && console.error("enableThirdPersonCamera called on active XR session"), this.cameraPivotThird.enabled = !0, this.cameraPivotThird.children[0].addChild(this.cameraObject)
}, FirstPersonView.prototype.disableThirdPersonCamera = function() {
    this.cameraPivotThird.children[0].removeChild(this.cameraObject), this.cameraPivotThird.enabled = !1
}, FirstPersonView.prototype.enableFreeCamera = function() {
    this.enableCharacter(!1, !0);
    const e = this.cameraObject.getPosition().clone(),
        t = this.cameraObject.getRotation().clone();
    CoreLib.Logger.debug("debug-camera", "Getting info for freecam.", {
        currentCameraMode: this.currentCameraMode,
        cameraObject: this.cameraObject
    }), CoreLib.Logger.debug("debug-camera", "Enabling free cam.", {
        initialPosition: e.toString(),
        initialRotation: t.getEulerAngles().toString()
    }), this.detachedCameraEntity.enabled = !0, this.detachedCameraEntity.children[0].addChild(this.cameraObject), this.detachedCameraEntity.script.freeCamView.enableFreecam(e, t)
}, FirstPersonView.prototype.adjustCameraFOV = function(e, t) {
    this.app.gameSettings.camera_fov = e;
    const i = window.innerWidth / window.innerHeight;
    let s;
    if (i > 1) s = e;
    else {
        const t = pc.math.DEG_TO_RAD * e;
        s = 2 * Math.atan(Math.tan(.5 * t) / i) / pc.math.DEG_TO_RAD, s = Math.min(Math.max(e, 90), s)
    }
    this.cameraObject.camera.fov = s, this.cameraObject.script.applyOutline.changeFOV(s), this.detachedCameraEntity.script.freeCamView.fov = s, t && this.app.game.setGameSettings(this.app.gameSettings)
}, FirstPersonView.prototype.disableFreeCamera = function() {
    this.enableCharacter(!0, !0);
    const e = this.app.root.findByName("GateServer")?.script?.gateServer,
        t = e?.entityInfos?.filter((e => "SpawnPoint" === e.type)).map((e => JSON.parse(e.data))).find((e => e.alwaysSnapBack));
    if (t) {
        const e = new pc.Vec3(t.position.x, t.position.y, t.position.z),
            i = this.app.game.computeLookAtFromAzimuth(e, t.rotation.y);
        this.app.game.spawnOnPosition(e, i)
    }
    this.detachedCameraEntity.script.freeCamView.disableFreecam(), this.detachedCameraEntity.children[0].removeChild(this.cameraObject), this.detachedCameraEntity.enabled = !1, this.adjustCameraFOV(this.app.gameSettings.camera_fov)
}, FirstPersonView.prototype.isCharacterEnabled = function() {
    const e = this.entity.findByName("ReadyPlayerMe");
    return e && e.enabled
}, FirstPersonView.prototype.enableCharacter = function(e, t = !1) {
    t || (this.entity.script.mouseInput.enabled = e, this.entity.script.touchInput.enabled = e);
    const i = this.entity.findComponents("rigidbody");
    for (const t of i) t.enabled = e;
    const s = this.entity.findByName("ReadyPlayerMe"),
        a = this.entity.findByName("Collision Cyl"),
        r = this.entity.findByName("Collision Cone");
    a.enabled = e, r.enabled = e, s.enabled = e, this.entity.script.characterController.enabled = e
}, FirstPersonView.prototype.enableOrbitalCamera = function() {
    this.enableCharacter(!1), this.orbitalCamera.children[0].addChild(this.cameraObject), this.orbitalCamera.enabled = !0
}, FirstPersonView.prototype.disableOrbitalCamera = function() {
    this.enableCharacter(!0), this.orbitalCamera.children[0].removeChild(this.cameraObject), this.orbitalCamera.enabled = !1
}, FirstPersonView.prototype.isInFreeCam = function() {
    return "free" === this.currentCameraMode
}, FirstPersonView.prototype.isInOrbitalCam = function() {
    return "orbital" === this.currentCameraMode
}, FirstPersonView.prototype.toggleFreecam = function() {
    const e = "free" === this.currentCameraMode;
    if (this.setCameraMode(e ? "third" : "free"), !e) {
        const e = this.app.customTravelCenter?.roomData;
        let t = "<b>[F]</b> to toggle Free Cam </br> <b>[Shift-Key]</b> to accelerate </br> <b>Mouse-Wheel</b> to change speed. </br> <b>[T]</b> to toggle avatar";
        e?.hideArchitecture && this.app.root.findByName("GLBColliderEntity") && (t += " </br> <i>Splat collision disabled for review - enables on reload.</i>");
        const i = {
            position: "top-end",
            icon: "info",
            title: "Free Cam Mode activated",
            backdrop: void 0,
            toast: !0,
            html: t,
            timer: 7e3
        };
        this.app.natsHostCaptureMode || this.app.userProfileData.viewOnlyMode() || ui_utils.alertCustom(i, !1)
    }
}, FirstPersonView.prototype.setIsWalking = function(e) {
    this.playerMesh.anim.setBoolean("isWalking", e)
}, FirstPersonView.prototype.applyCameraTargetHeightOffset = function(e) {
    if (!this.baseFirstPivotLocalPos || !this.baseThirdPivotLocalPos) return;
    const t = Number.isFinite(e) ? e : 0,
        i = this._avatarHeightDelta || 0;
    this.cameraPivotFirst.setLocalPosition(this.baseFirstPivotLocalPos.x, this.baseFirstPivotLocalPos.y + t + i, this.baseFirstPivotLocalPos.z), this.cameraPivotThird.setLocalPosition(this.baseThirdPivotLocalPos.x, this.baseThirdPivotLocalPos.y + t + i, this.baseThirdPivotLocalPos.z), this.cameraPivotFirst.script?.entityParentSmoother?.reset(), this.cameraPivotThird.script?.entityParentSmoother?.reset()
}, FirstPersonView.prototype.measurePlayerHeadLocalY = function() {
    const e = this.playerMesh;
    if (!e) return null;
    const t = e.script && e.script.glbEntity && e.script.glbEntity.renderRootEntity || e,
        i = ["Head", "J_Bip_C_Head"];
    let s = null,
        a = null;
    const visit = e => {
        if (!s) {
            if (e.name) {
                if (i.indexOf(e.name) >= 0) return void(s = e);
                a || e.render || !/head$/i.test(e.name) || (a = e)
            }
            for (const t of e.children) visit(t)
        }
    };
    visit(t);
    const r = s || a;
    if (!r) return null;
    const n = r.getPosition().y - this.entity.getPosition().y;
    return Number.isFinite(n) && n > .1 ? n : null
}, FirstPersonView.prototype.refreshAvatarCameraFraming = function() {
    const e = this.measurePlayerHeadLocalY(),
        t = this.baseThirdPivotLocalPos && this.baseThirdPivotLocalPos.y || 0;
    if (null == e || t <= 0 || e >= t - .04) this._avatarHeightDelta = 0, this.thirdPersonDistanceMin = this._baseThirdDistanceMin, this.thirdPersonDistanceMax = this._baseThirdDistanceMax;
    else {
        this._avatarHeightDelta = e - t;
        const i = pc.math.clamp(e / t, .4, 1);
        this.thirdPersonDistanceMin = this._baseThirdDistanceMin * i, this.thirdPersonDistanceMax = this._baseThirdDistanceMax * i, this.thirdPersonDistanceTarget = pc.math.clamp(this.thirdPersonDistanceTarget, this.thirdPersonDistanceMin, this.thirdPersonDistanceMax), this.thirdPersonDistanceCurrent = pc.math.clamp(this.thirdPersonDistanceCurrent, this.thirdPersonDistanceMin, this.thirdPersonDistanceMax)
    }
    this.applyCameraTargetHeightOffset(this.cameraTargetHeightOffset)
}, FirstPersonView.prototype.updateThirdPersonDistance = function(e) {
    this.thirdPersonPushInIntent *= Math.exp(6 * -e);
    const t = Math.min(1, Math.max(0, 12 * e));
    this.thirdPersonDistanceCurrent = pc.math.lerp(this.thirdPersonDistanceCurrent, this.thirdPersonDistanceTarget, t);
    const i = -this.thirdPersonBounceOffset * this.thirdPersonBounceSpring,
        s = -this.thirdPersonBounceVelocity * this.thirdPersonBounceDamping;
    this.thirdPersonBounceVelocity += (i + s) * e, this.thirdPersonBounceOffset += this.thirdPersonBounceVelocity * e, this.thirdPersonBounceOffset = pc.math.clamp(this.thirdPersonBounceOffset, -this.thirdPersonBounceMax, this.thirdPersonBounceMax), Math.abs(this.thirdPersonBounceOffset) < 5e-4 && Math.abs(this.thirdPersonBounceVelocity) < .005 && (this.thirdPersonBounceOffset = 0, this.thirdPersonBounceVelocity = 0);
    const a = Math.max(.1, this.thirdPersonDistanceCurrent + this.thirdPersonBounceOffset);
    this.localThirdOffset.copy(this.localThirdDirection).mulScalar(a)
}, FirstPersonView.prototype.update = function(e) {
    if (this._reframeRequested && (this._reframeRequested = !1, this.refreshAvatarCameraFraming()), this.isInFreeCam() || this.isInOrbitalCam() || this.app.disableCameraMovement) this.forward = 0, this.strafe = 0;
    else {
        if (this.azimuthTarget && (this.azimuth = dampAngle(this.azimuth, this.azimuthTarget, 5, e)), this.cameraPivotFirst.setEulerAngles(this.elevation, this.azimuth, 0), this.cameraPivotThird.setEulerAngles(this.elevation, this.azimuth, 0), this.cameraPivotThird.enabled) {
            this.updateThirdPersonDistance(e), this.cameraPivotThird.children[0].setLocalPosition(this.localThirdOffset.clone());
            const t = this.cameraPivotFirst.children[0].getPosition(),
                i = this.cameraPivotThird.children[0].getPosition(),
                s = this.app.systems.rigidbody.raycastFirst(t, i, {
                    filterCallback: e => !e.tags.has("noCameraBlock") && !(!e.rigidbody && !e.tags.has("triggerBlockCamera"))
                });
            s && this.cameraPivotThird.children[0].setPosition(s.point), this.disableAutoLook || this.app.xr.active || "first" === !this.currentCameraMode || (this.forward, this.azimuth -= this.strafe * e * 100, this.azimuth < 0 && (this.azimuth += 360), this.azimuth > 360 && (this.azimuth -= 360));
            const a = Math.atan2(this.heading.x, this.heading.z) * (180 / Math.PI);
            for (null != this.target_angle && 0 == this.forward && 0 == this.strafe || (this.target_angle = a); this.target_angle > 360;) this.target_angle -= 360;
            for (void 0 === this.dampened_mesh_angle || this.forwardNoDamp ? this.dampened_mesh_angle = this.target_angle : this.dampened_mesh_angle = dampAngle(this.dampened_mesh_angle, this.target_angle, 5, e); this.dampened_mesh_angle > 360;) this.dampened_mesh_angle -= 360;
            for (; this.dampened_mesh_angle < 0;) this.dampened_mesh_angle += 360
        } else {
            const e = this.cameraObject.forward.clone();
            e.y = 0, e.normalize();
            const t = Math.atan2(-e.x, -e.z) * (180 / Math.PI);
            this.dampened_mesh_angle = t + 180, this.target_angle = this.dampened_mesh_angle
        }
        const t = this.entity.script?.characterController?.groundVisualYawDelta || 0;
        0 !== this.forward ? this.groundMeshYawOffset = 0 : Math.abs(t) > 1e-4 ? this.groundMeshYawOffset += t : (this.groundMeshYawOffset *= Math.max(0, 1 - 8 * e), Math.abs(this.groundMeshYawOffset) < .001 && (this.groundMeshYawOffset = 0));
        let i = this.dampened_mesh_angle + this.groundMeshYawOffset;
        for (; i > 360;) i -= 360;
        for (; i < 0;) i += 360;
        this.playerMesh.setEulerAngles(0, i, 0), this.z.copy(this.cameraObject.forward), this.z.y = 0, this.z.normalize(), this.x.copy(this.cameraObject.right), this.x.y = 0, this.x.normalize(), this.heading.set(0, 0, 0), 0 !== this.forward && (this.app.needsRedraw = !0, this.z.scale(this.forward), this.heading.add(this.z), this.setIsWalking(!0))
    }
    0 !== this.strafe && (this.app.needsRedraw = !0, this.x.scale(this.strafe), this.heading.add(this.x), this.setIsWalking(!0)), 0 == this.strafe && 0 == this.forward && this.setIsWalking(!1);
    const t = this.app.customTravelCenter?.roomData?._animSpeedOverrides;
    let i = !1;
    const s = this.app.pluginAttachments;
    if (s?.size)
        for (const [, e] of s)
            if (e?._isLocal) {
                i = !0;
                break
            } if (this.entity.script.characterController.onGround || i) {
        this.playerMesh.anim.setBoolean("isJumping", !1), this.jumpingSince = null;
        const e = this.app.customTravelCenter?.roomData?.moveSpeed || .8,
            i = t?.Forward,
            s = void 0 !== i ? 1 : e;
        if (this.boost > 0) this.playerMesh.anim.speed = Math.min(2, 2.8 * s * (1 / .7)), void 0 !== i && (this.playerMesh.anim.speed *= i);
        else {
            const e = Math.max(Math.abs(this.strafe), Math.abs(this.forward));
            e > 0 ? (void 0 === this.lastWalkingSpeed ? this.lastWalkingSpeed = e : this.lastWalkingSpeed = .9 * this.lastWalkingSpeed + .1 * e, this.playerMesh.anim.speed = Math.min(1.4, 1.4 * this.lastWalkingSpeed * s * (1 / .7)), void 0 !== i && (this.playerMesh.anim.speed *= i)) : (this.lastWalkingSpeed = 0, this.playerMesh.anim.speed = 1, void 0 !== t?.Idle && (this.playerMesh.anim.speed *= t.Idle))
        }
    } else {
        this.jumpingSince || (this.jumpingSince = new Date);
        const e = new Date - this.jumpingSince;
        e > 100 && e < 1e3 ? this.playerMesh.anim.setBoolean("isJumping", !0) : this.playerMesh.anim.setBoolean("isJumping", !1), this.playerMesh.anim.speed = 1, void 0 !== t?.Jumping && (this.playerMesh.anim.speed *= t.Jumping)
    }
    0 == this.strafe && 0 == this.forward && (this.signatureReset ? (this.app.needsRedraw = 5e3, this.playerMesh.anim.setInteger("signatureNumber", -1), this.signatureReset = !1) : this.playerMesh.anim.setInteger("signatureNumber", this.signature || 0)), this.heading.length() > 1e-4 && (this.magnitude.set(this.forward, this.strafe), this.heading.normalize().scale(this.magnitude.length())), this.jump ? (this.app.needsRedraw = !0, this.entity.script.characterController.jump(), this.jump = !1, this.jumped = !0) : this.jumped = !1, this.entity.script.characterController.move(this.heading, this.boost, e), this.cameraObject.lockPosition && this.cameraObject.setPosition(this.cameraObject.lockPosition);
    const a = this.cameraObject.getEulerAngles().y;
    (void 0 === this.app.cameraRotationY || Math.abs(a - this.app.cameraRotationY) > .001) && (this.app.cameraRotationY = a, this.app.fire("camera:rotationY", a));
    const r = this.playerMesh?.anim?.baseLayer,
        n = r?._controller,
        o = r?.activeStateName || r?.activeState || null;
    if (o !== this.lastActiveAnimState) {
        const e = n?._states?.[o],
            t = e?._arrivalStartTime;
        "number" == typeof t && r && (r.activeStateCurrentTime = t), this.lastActiveAnimState = o
    }
};
const KeyboardInput =

    // ======== freeCamView ========
    pc.createScript("freeCamView");

function normalizeAngle(t) {
    return (t %= 360) > 180 ? t -= 360 : t <= -180 && (t += 360), t
}
FreeCamView.attributes.add("speed", {
    type: "number",
    default: 4,
    title: "Movement Speed"
}), FreeCamView.attributes.add("zoomSpeed", {
    type: "number",
    default: .025,
    title: "Zoom Speed"
}), FreeCamView.attributes.add("maxSpeed", {
    type: "number",
    default: 50,
    title: "Max Movement Speed"
}), FreeCamView.attributes.add("acceleration", {
    type: "number",
    default: 2,
    title: "Acceleration"
}), FreeCamView.attributes.add("boostMultiplier", {
    type: "number",
    default: .5,
    title: "Boost Multiplier"
}), FreeCamView.attributes.add("lookSensitivity", {
    type: "number",
    default: 1,
    title: "Look Sensitivity"
}), FreeCamView.attributes.add("cameraPivot", {
    title: "Camera Pivot",
    description: "The camera controlled by this first person view. It should be a child of the entity to which this script is assigned.",
    type: "entity"
}), FreeCamView.prototype.initialize = function() {
    this.rigidbody = this.entity.rigidbody, this.controlsLocked = !1, this.camera = this.app.root.findByName("Camera"), this.reset(), this.app.on("firstperson:forward", this.handleForwardMovement, this), this.app.on("firstperson:strafe", this.handleStrafeMovement, this), this.app.on("firstperson:lookAt", this.handleLookAt, this), this.app.on("firstperson:look", this.handleLook, this), this.app.on("firstperson:vertical", this.handleVerticalMovement, this), this.app.on("freeCam:changeFOV", this.changeFOV, this), this.app.on("freeCam:setFOV", this.setFOV, this), this.app.on("freeCam:changeSpeed", this.changeSpeed, this), this.app.on("firstperson:boost", this.boostMovement, this), this.app.on("firstperson:toggleKey", this.toggleAvatar, this), this._sessionStoreUnsub = ReactUI.currentSessionStore.subscribe(((t, e) => {
        t.isEditingSpace !== e.isEditingSpace && this.entity.enabled && this.updateFreeCamCollision()
    })), this.entity.once("destroy", this.destroy, this)
}, FreeCamView.prototype.reset = function() {
    CoreLib.Logger.debug("debug-camera", "Resetting free cam to initial state."), this.fov = this.app.gameSettings.camera_fov, this.pitch = this.cameraPivot.getLocalEulerAngles().x, this.yaw = this.cameraPivot.getLocalEulerAngles().y, this.roll = this.cameraPivot.getLocalEulerAngles().z, this.currentVelocity = new pc.Vec3, this.targetVelocity = new pc.Vec3, this.forwardValue = 0, this.sidewardValue = 0, this.upwardValue = 0
}, FreeCamView.prototype.update = function(t) {
    if (this.app.disableCameraMovement) return;
    if (this.controlsLocked) {
        this.yaw = this.yawTarget, this.pitch = this.pitchTarget, this.currentVelocity.set(0, 0, 0), this.targetVelocity.set(0, 0, 0);
        const t = this.cameraPivot.getLocalEulerAngles();
        return t.x = this.pitch, t.y = this.yaw, t.z = this.roll, void this.cameraPivot.setLocalEulerAngles(t)
    }
    let e = this.speed;
    this.boostActive && (e *= this.boostMultiplier);
    const i = this.cameraPivot.forward.clone().scale(this.forwardValue * e),
        s = this.cameraPivot.right.clone().scale(this.sidewardValue * e),
        a = this.cameraPivot.up.clone().scale(this.upwardValue * e);
    if (this.targetVelocity.copy(i).add(s).add(a), this.currentVelocity.lerp(this.currentVelocity, this.targetVelocity, t * this.acceleration), this.currentVelocity.length() > .001 && (this.app.needsRedraw = !0), this.rigidbody) {
        this.rigidbody.linearVelocity = this.currentVelocity;
        const t = new pc.Vec3(0, 9.81, 0);
        this.rigidbody.applyForce(t)
    } else {
        const e = this.entity.getPosition().clone().add(this.currentVelocity.clone().scale(t));
        this.entity.setPosition(e)
    }
    void 0 === this.yawTarget && (this.yawTarget = this.yaw), void 0 === this.pitchTarget && (this.pitchTarget = this.pitch), this.yaw = pc.math.lerp(this.yaw, this.yawTarget, 4 * t), this.pitch = pc.math.lerpAngle(this.pitch, this.pitchTarget, 4 * t), (Math.abs(this.yaw - this.yawTarget) > .5 || Math.abs(this.pitch - this.pitchTarget) > .5) && (this.app.needsRedraw = !0);
    const o = this.cameraPivot.getLocalEulerAngles();
    o.x = this.pitch, o.y = this.yaw, o.z = this.roll, this.cameraPivot.setLocalEulerAngles(o)
}, FreeCamView.prototype.addFreeCamRigidbody = function() {
    this.entity.rigidbody || this.entity.addComponent("rigidbody", {
        type: "dynamic",
        mass: 1,
        linearDamping: 0,
        angularDamping: 0,
        friction: 0,
        restitution: 0
    }), this.rigidbody = this.entity.rigidbody
}, FreeCamView.prototype.removeFreeCamRigidbody = function() {
    this.entity.rigidbody && this.entity.removeComponent("rigidbody"), this.rigidbody = null
}, FreeCamView.prototype.updateFreeCamCollision = function() {
    const t = this.app.customTravelCenter.roomData;
    if (!t || !t.hideArchitecture) return void this.addFreeCamRigidbody();
    const e = ReactUI.currentSessionStore.getState().isEditingSpace,
        i = !!this.app.root.findByName("GLBColliderEntity");
    this.enteredAsDefault && i && !e ? this.addFreeCamRigidbody() : this.removeFreeCamRigidbody()
}, FreeCamView.prototype.setControlsLocked = function(t) {
    this.controlsLocked = t
}, FreeCamView.prototype.enableFreecam = function(t, e) {
    this.camera = this.entity.findByName("Camera"), this.applyOutline = this.camera.script.applyOutline, this.fov && (this.camera.fov = this.fov, this.camera.camera.fov = this.fov), this.setInitPosition(t), this.setInitRotation(e), this.isInitialized = !0, this.app.disableClickToWalk && this.app.disableClickToWalk.push(this), this.avatarVisible && (this.avatarVisible = !1, this.toggleAvatar(!0)), this.updateFreeCamCollision()
}, FreeCamView.prototype.disableFreecam = function() {
    this.enteredAsDefault = !1, this.currentVelocity = new pc.Vec3, this.targetVelocity = new pc.Vec3, this.forwardValue = 0, this.sidewardValue = 0, this.upwardValue = 0, this.app.disableClickToWalk && this.app.disableClickToWalk.pop(this)
}, FreeCamView.prototype.setInitPosition = function(t) {
    this.entity.setPosition(t), this.rigidbody && this.rigidbody.syncEntityToBody()
}, FreeCamView.prototype.setInitRotation = function(t) {
    const e = t.getEulerAngles(),
        i = t.transformVector(pc.Vec3.FORWARD),
        s = i.y > 0;
    i.z < 0 ? (this.yaw = 180 + e.y, this.pitch = e.x) : s ? (this.yaw = -e.y, this.pitch = 180 + e.x) : (this.yaw = -e.y, this.pitch = e.x - 180), this.roll = 0, this.pitchTarget = this.pitch, this.yawTarget = this.yaw
}, FreeCamView.prototype.applyRotation = function() {
    const t = this.cameraPivot.getLocalEulerAngles();
    t.x = this.pitch, t.y = this.yaw, t.z = this.roll, this.cameraPivot.setLocalEulerAngles(t)
}, FreeCamView.prototype.setRotationFromQuat = function(t) {
    const e = 180 / Math.PI,
        i = t.transformVector(pc.Vec3.FORWARD),
        s = Math.asin(pc.math.clamp(i.y, -1, 1));
    this.pitch = s * e;
    Math.cos(s) > .001 && (this.yaw = Math.atan2(i.x, i.z) * e), this.roll = 0, this.pitchTarget = this.pitch, this.yawTarget = this.yaw
}, FreeCamView.prototype.handleVerticalMovement = function(t) {
    this.entity.enabled && !this.controlsLocked && (this.upwardValue = t)
}, FreeCamView.prototype.handleForwardMovement = function(t) {
    this.entity.enabled && !this.controlsLocked && (this.forwardValue = t)
}, FreeCamView.prototype.boostMovement = function(t) {
    this.entity.enabled && !this.controlsLocked && (this.boostActive = t > 0)
}, FreeCamView.prototype.handleStrafeMovement = function(t) {
    this.entity.enabled && !this.controlsLocked && (this.sidewardValue = t)
}, FreeCamView.prototype.handleLookAt = function(t, e) {
    if (!this.entity.enabled || this.controlsLocked) return;
    const i = t.clone().sub(this.entity.getPosition());
    i.y = 0, i.normalize(), this.yawTarget = Math.atan2(-i.x, -i.z) * (180 / Math.PI), void 0 !== e && (this.pitchTarget = pc.math.clamp(e, -80, 70))
}, FreeCamView.prototype.toggleAvatar = function(t) {
    if (!t) return;
    if (console.log("FreeCamView toggleAvatar"), !this.entity.enabled || this.controlsLocked) return;
    this.avatarVisible = !this.avatarVisible;
    const e = this.app.root.findByName("CharacterController");
    if (e) {
        e.script.firstPersonView.enableCharacter(this.avatarVisible, !0)
    }
}, FreeCamView.prototype.changeSpeed = function(t) {
    const e = Math.abs(t),
        i = 1 + (1.15 - 1) * Math.min(e / 100, 3);
    t < 0 ? this.speed *= i : t > 0 && (this.speed /= i), this.speed = pc.math.clamp(this.speed, .1, this.maxSpeed || 50)
}, FreeCamView.prototype.changeFOV = function(t) {
    this.entity.enabled && !this.controlsLocked && (this.camera || (this.camera = this.entity.findByName("Camera")), this.fov -= t * this.zoomSpeed, this.fov = pc.math.clamp(this.fov, 20, 100), this.camera && this.camera.camera && (this.camera.camera.fov = this.fov), this.applyOutline && this.applyOutline.changeFOV(this.fov))
}, FreeCamView.prototype.setFOV = function(t) {
    this.fov = t, this.entity.enabled && !this.controlsLocked && (this.camera || (this.camera = this.entity.findByName("Camera")), this.camera && this.camera.camera && (this.camera.camera.fov = this.fov), this.applyOutline && this.applyOutline.changeFOV(this.fov))
}, FreeCamView.prototype.handleLook = function(t, e) {
    if (!this.entity.enabled || this.controlsLocked) return;
    const i = this.lookSensitivity;
    void 0 === this.yawTarget && (this.yawTarget = this.yaw), void 0 === this.pitchTarget && (this.pitchTarget = this.pitch), this.yawTarget = this.yawTarget + t * i, this.pitchTarget = this.pitchTarget + e * i, this.pitchTarget = pc.math.clamp(this.pitchTarget, -80, 70)
}, FreeCamView.prototype.destroy = function() {
    this._sessionStoreUnsub && this._sessionStoreUnsub(), this.app.off("firstperson:forward", this.handleForwardMovement, this), this.app.off("firstperson:strafe", this.handleStrafeMovement, this), this.app.off("firstperson:lookAt", this.handleLookAt, this), this.app.off("firstperson:look", this.handleLook, this), this.app.off("firstperson:vertical", this.handleVerticalMovement, this), this.app.off("firstperson:boost", this.boostMovement, this), this.app.off("freeCam:changeFOV", this.changeFOV, this), this.app.off("freeCam:setFOV", this.setFOV, this), this.app.off("freeCam:changeSpeed", this.changeSpeed, this), this.app.off("firstperson:toggleKey", this.toggleAvatar, this)
};
class FetchKeyError extends Error {}
class NoPasswordError extends Error {}
class KeyStore {
    constructor(e) {
        this.#e = e, this.userServerURL = e.userServerURL
    }
    #e;
    #t = {};
    #r = {};
    async uploadKey(e) {
        e.name || (console.warn("Using default name for new key.", e.hash), e.name = e.hash);
        const t = JSON.stringify(e),
            r = `${this.userServerURL}/keys/store/${this.#e.userID}/${this.#e.logonCertificate}`;
        if (!(await fetch(r, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: t
            })).ok) throw new Error("Unable to upload key")
    }
    async updateKey(e) {
        const t = JSON.stringify(e),
            r = `${this.userServerURL}/keys/update/${this.#e.userID}/${this.#e.logonCertificate}`;
        if (!(await fetch(r, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: t
            })).ok) throw new Error("Unable to update key")
    }
    async getKeyName(e) {
        const t = `${this.userServerURL}/keys/name/${this.#e.userID}/${this.#e.logonCertificate}/${e}`,
            r = await fetch(t);
        if (!r.ok) throw new Error(`The key ${e} probably doesn't exist.`);
        return (await r.json()).name
    }
    async #a(e, t) {
        if ("string" != typeof e) throw new Error("Invalid hash, expected a string.");
        if (!this.#t[e]) {
            const r = await this.getKeyName(e);
            let a = t,
                s = null;
            if (!a) {
                const t = document.createElement("a");
                t.innerText = "Use recovery key file.", t.href = "#", t.addEventListener("click", (async () => {
                    this.#s(e, (e => {
                        s = e, Swal.close(), a = null
                    }), (e => {
                        Swal.close(), a = null, ui_utils.alertError("Error", e)
                    }))
                }));
                const n = a = await ui_utils.password("Type key password", `Please type password for key: "${r}"`, t);
                a = n.value
            }
            if (s) await this.#n(s, e);
            else {
                if (!a) throw new NoPasswordError("No password provided");
                s = await this.#o(a, e), await this.#n(s, e)
            }
        }
        return this.#t[e]
    }
    requestKey = preventConcurrentPromises(this.#a.bind(this));
    #s(e, t, r) {
        const a = document.createElement("input");
        a.type = "file", a.accept = ".jwk", a.addEventListener("change", (async () => {
            const s = a.files[0];
            s || r("No file selected");
            const n = new FileReader;
            n.onload = async () => {
                const a = JSON.parse(n.result),
                    s = await crypto.subtle.importKey("jwk", a, {
                        name: "AES-GCM"
                    }, !0, ["encrypt", "decrypt"]),
                    o = await crypto.subtle.exportKey("raw", s),
                    i = new Uint8Array(o);
                await this.#i(i) !== e && r("Key hash mismatch"), t(i)
            }, n.readAsText(s)
        })), a.click()
    }
    setRoomKey(e, t) {
        this.#r[e] && this.#r[e] !== t && console.warn("[KeyStore] Setting a new key for room: ", e, "Old hash:", this.#r[e], "New hash: ", t), this.#r[e] = t
    }
    getRoomKey(e) {
        return this.#r[e]
    }
    async #n(e, t) {
        const r = await crypto.subtle.importKey("raw", e, {
            name: "AES-GCM"
        }, !0, ["encrypt", "decrypt"]);
        this.#t[t] = r
    }
    async #o(e, t) {
        const r = `${this.userServerURL}/keys/get/${this.#e.userID}/${this.#e.logonCertificate}/${t}`,
            a = await fetch(r, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    password: e
                })
            });
        if (a.ok) {
            const e = (await a.json())?.data?.key;
            if (!e) throw new Error("No key data");
            return new Uint8Array(e)
        }
        throw new FetchKeyError("Unable to fetch key")
    }
    async #y(e) {
        const t = new TextEncoder;
        return crypto.subtle.importKey("raw", t.encode(e), "PBKDF2", !1, ["deriveKey"])
    }
    async #c(e, t) {
        return crypto.subtle.deriveKey({
            name: "PBKDF2",
            salt: t,
            iterations: 1e5,
            hash: "SHA-256"
        }, e, {
            name: "AES-GCM",
            length: 256
        }, !0, ["encrypt", "decrypt"])
    }
    async encryptKey(e, t) {
        const r = crypto.getRandomValues(new Uint8Array(16)),
            a = await this.#y(t),
            s = await this.#c(a, r),
            n = await crypto.subtle.exportKey("raw", e),
            o = crypto.getRandomValues(new Uint8Array(12)),
            i = await crypto.subtle.encrypt({
                name: "AES-GCM",
                iv: o
            }, s, n),
            y = await this.#i(new Uint8Array(n));
        return {
            iv: Array.from(o),
            salt: Array.from(r),
            encryptedKey: Array.from(new Uint8Array(i)),
            hash: y,
            name: null
        }
    }
    async #i(e) {
        const t = await window.crypto.subtle.digest("SHA-256", e);
        return Array.from(new Uint8Array(t)).map((e => e.toString(16).padStart(2, "0"))).join("")
    }
    async generateKey(e) {
        try {
            const t = await crypto.subtle.generateKey({
                name: "AES-GCM",
                length: 256
            }, !0, ["encrypt", "decrypt"]);
            return await this.encryptKey(t, e)
        } catch (e) {
            return console.error("Unable to create key", e), null
        }
    }
    async encryptData(e, t) {
        const r = crypto.getRandomValues(new Uint8Array(12)),
            a = await crypto.subtle.encrypt({
                name: "AES-GCM",
                iv: r
            }, t, e);
        return {
            iv: Array.from(r),
            data: new Uint8Array(a)
        }
    }
    async decryptData(e, t) {
        const r = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data),
            a = await crypto.subtle.decrypt({
                name: "AES-GCM",
                iv: new Uint8Array(e.iv)
            }, t, r);
        return new Uint8Array(a)
    }
}
class CKEditorWrapper {
    constructor(t, e = !1, r = "Placeholder") {
        this.containerId = t, this.isMinimalEditor = e, this.placeholder = r, this.editor = null, this.container = null
    }
    async init() {
        if (this.editor) return console.info(`Editor for ${this.containerId} already initialized.`), this.editor;
        await CKEditorWrapper.loadCKEditor(), this.container = document.getElementById(this.containerId), this.isMinimalEditor ? await this.initMinimalEditor() : await this.initClassicEditor()
    }
    static async loadCKEditor() {
        return CKEditorWrapper.ckeLibraryLoading || (CKEditorWrapper.ckeLibraryLoading = (async () => {
            if (CKEditorWrapper.ckeLibrary = await import("https://mrkorf.arrival.space/app_data/scripts/ckeditor5-42.0.0.js"), !CKEditorWrapper.ckeCssLoaded) {
                const t = new Promise(((t, e) => {
                    const r = document.createElement("link");
                    r.rel = "stylesheet", r.href = "https://mrkorf.arrival.space/app_data/scripts/ckeditor5-42.0.0.css", r.onload = () => {
                        console.info("CKEditor CSS loaded successfully."), t()
                    }, r.onerror = () => {
                        e(new Error("Failed to load CKEditor CSS!"))
                    }, document.head.appendChild(r)
                }));
                await t;
                const e = "\n\t\t\t\t\t:root {\n\t\t\t\t\t\t--ck-border-radius: 10px;\n\t\t\t\t\t\t--ck-color-focus-border: hsl(0, 0%, 100%);\n\t\t\t\t\t\t--ck-focus-ring: none;\n\t\t\t\t\t}\n\n\t\t\t\t\t.ck-editor__main .ck-editor__editable {\n\t\t\t\t\t\tborder-top-left-radius: var(--ck-border-radius) !important;\n\t\t\t\t\t\tborder-top-right-radius: var(--ck-border-radius) !important;\n\t\t\t\t\t\tborder-radius: var(--ck-border-radius);\n\t\t\t\t\t\tcursor: text;\n\t\t\t\t\t}\n\n\t\t\t\t\t.ck-rounded-corners .ck.ck-editor__top .ck-sticky-panel .ck-sticky-panel__content,\n\t\t\t\t\t.ck.ck-editor__top .ck-sticky-panel .ck-sticky-panel__content.ck-rounded-corners {\n\t\t\t\t\t\tborder-radius: var(--ck-border-radius);\n\t\t\t\t\t}\n\n\t\t\t\t\t.ck-rounded-corners .ck-source-editing-area textarea,\n\t\t\t\t\t.ck-source-editing-area textarea.ck-rounded-corners {\n\t\t\t\t\t\tborder-radius: var(--ck-border-radius);\n\t\t\t\t\t}\n\n\t\t\t\t\t.ck-source-editing-button > .ck.ck-button__label {\n\t\t\t\t\t\tdisplay: none!important;\n\t\t\t\t\t}\n\n\t\t\t\t\t.ck-powered-by {\n\t\t\t\t\t\tdisplay: none;\n\t\t\t\t\t}\n\t\t\t\t",
                    r = document.createElement("style");
                r.textContent = e, document.head.appendChild(r), CKEditorWrapper.ckeCssLoaded = !0, console.log("CKEditor and custom CSS loaded successfully.")
            }
        })()), CKEditorWrapper.ckeLibraryLoading
    }
    initClassicEditor() {
        const t = {
            toolbar: {
                items: ["undo", "redo", "|", "sourceEditing", "|", "bold", "italic", "underline", "strikethrough", "|", "heading", "|", "fontSize", "fontFamily", "fontColor", "fontBackgroundColor", "|", "horizontalLine", "blockQuote", "bulletedList", "numberedList"]
            },
            plugins: [CKEditorWrapper.ckeLibrary.Autosave, CKEditorWrapper.ckeLibrary.BalloonToolbar, CKEditorWrapper.ckeLibrary.BlockQuote, CKEditorWrapper.ckeLibrary.Bold, CKEditorWrapper.ckeLibrary.Essentials, CKEditorWrapper.ckeLibrary.FontBackgroundColor, CKEditorWrapper.ckeLibrary.FontColor, CKEditorWrapper.ckeLibrary.FontFamily, CKEditorWrapper.ckeLibrary.FontSize, CKEditorWrapper.ckeLibrary.Heading, CKEditorWrapper.ckeLibrary.HorizontalLine, CKEditorWrapper.ckeLibrary.Italic, CKEditorWrapper.ckeLibrary.List, CKEditorWrapper.ckeLibrary.SourceEditing, CKEditorWrapper.ckeLibrary.Paragraph, CKEditorWrapper.ckeLibrary.GeneralHtmlSupport, RenderStyleElements, CKEditorWrapper.ckeLibrary.Strikethrough, CKEditorWrapper.ckeLibrary.TextTransformation, CKEditorWrapper.ckeLibrary.Underline, CKEditorWrapper.ckeLibrary.Undo],
            balloonToolbar: ["bold", "italic", "|", "bulletedList", "numberedList"],
            fontFamily: {
                supportAllValues: !0
            },
            fontSize: {
                options: [10, 12, 14, "default", 18, 20, 22],
                supportAllValues: !0
            },
            enterMode: 2,
            heading: {
                options: [{
                    model: "paragraph",
                    title: "Paragraph",
                    class: "ck-heading_paragraph"
                }, {
                    model: "heading1",
                    view: "h1",
                    title: "Heading 1",
                    class: "ck-heading_heading1"
                }, {
                    model: "heading2",
                    view: "h2",
                    title: "Heading 2",
                    class: "ck-heading_heading2"
                }, {
                    model: "heading3",
                    view: "h3",
                    title: "Heading 3",
                    class: "ck-heading_heading3"
                }, {
                    model: "heading4",
                    view: "h4",
                    title: "Heading 4",
                    class: "ck-heading_heading4"
                }, {
                    model: "heading5",
                    view: "h5",
                    title: "Heading 5",
                    class: "ck-heading_heading5"
                }, {
                    model: "heading6",
                    view: "h6",
                    title: "Heading 6",
                    class: "ck-heading_heading6"
                }]
            },
            htmlSupport: {
                allow: [{
                    name: /.*/,
                    attributes: !0,
                    classes: !0,
                    styles: !0
                }]
            },
            placeholder: this.placeholder
        };
        return CKEditorWrapper.ckeLibrary.ClassicEditor.create(this.container, t).then((t => {
            this.editor = t, this.editor.plugins.get("SourceEditing").isSourceEditingMode = !1;
            const e = this.editor.ui.view.editable.element,
                r = this.editor.ui.view.toolbar.element;
            this.editor.editing.view.document.on("change:isFocused", ((t, i, o) => {
                o ? this.classicEditorInFocus(r, e) : setTimeout((() => {
                    e.contains(document.activeElement) || r.contains(document.activeElement) || 0 != this.editor.plugins.get("SourceEditing").isSourceEditingMode || this.classicEditorOutOfFocus(r, e)
                }), 50)
            })), r.parentElement.addEventListener("mousedown", (t => {
                t.preventDefault()
            })), r.addEventListener("mousedown", (t => {
                t.preventDefault()
            })), console.info(`Editor initialized for ${this.containerId}`)
        })).catch((t => {
            console.error(`Error creating ClassicEditor for ${this.containerId}: ${t.stack}`)
        }))
    }
    initMinimalEditor() {
        const t = {
            toolbar: {
                items: ["undo", "redo", "|", "selectAll", "|", "bold", "italic", "|", "accessibilityHelp"],
                shouldNotGroupWhenFull: !1
            },
            plugins: [CKEditorWrapper.ckeLibrary.AccessibilityHelp, CKEditorWrapper.ckeLibrary.Autosave, CKEditorWrapper.ckeLibrary.Bold, CKEditorWrapper.ckeLibrary.Essentials, CKEditorWrapper.ckeLibrary.Italic, CKEditorWrapper.ckeLibrary.Paragraph, CKEditorWrapper.ckeLibrary.SelectAll, CKEditorWrapper.ckeLibrary.Undo],
            placeholder: this.placeholder
        };
        return CKEditorWrapper.ckeLibrary.BalloonEditor.create(document.getElementById(this.containerId), t).then((t => {
            this.editor = t;
            const e = this.editor.ui.view.editable.element;
            this.minimalEditorOutOfFocus(e?.parentElement?.parentElement?.parentElement), this.editor.editing.view.document.on("change:isFocused", ((t, r, i) => {
                i ? this.minimalEditorInFocus(e?.parentElement?.parentElement?.parentElement) : this.minimalEditorOutOfFocus(e?.parentElement?.parentElement?.parentElement)
            }))
        })).catch((t => {
            console.error(`Error creating BalloonEditor for ${this.containerId}: ${t.stack}`)
        }))
    }
    destroyEditor() {
        this.editor.destroy().then((() => {
            console.info(`Editor destroyed for ${this.containerId}`), this.editor = null
        })).catch((t => {
            console.error(`Error destroying editor for ${this.containerId}: ${t}`)
        }))
    }
    minimalEditorInFocus(t) {
        t.style.background = "#fff", t.style.transition = "background 0.3s", t.style.boxShadow = "none"
    }
    minimalEditorOutOfFocus(t) {
        t.style.background = "#fff", t.style.transition = "background 0.3s", t.style.boxShadow = "none"
    }
    classicEditorInFocus(t, e) {
        t.style.opacity = 1, t.style.pointerEvents = "auto", t.parentElement.style.opacity = 1, t.parentElement.style.pointerEvents = "auto", t.parentElement.style.transition = "opacity 0.3s", e.style.background = "#fff", e.style.transition = "background 0.3s"
    }
    classicEditorOutOfFocus(t, e) {
        t.style.pointerEvents = "none", t.parentElement.style.opacity = 0, t.parentElement.style.pointerEvents = "none", t.parentElement.style.transition = "opacity 0.3s", e.style.background = "#fff", e.style.transition = "background 0.3s", e.style.boxShadow = "none"
    }
    getData() {
        return this.editor ? this.editor.getData() : (console.error("CKEditor not initialized:", this.containerId), "")
    }
    setData(t) {
        this.editor ? this.editor.setData(t) : console.error("CKEditor is not initialized for:", this.containerId)
    }
}

function RenderStyleElements(t) {
    const e = t.editing.view.domConverter.unsafeElements,
        r = e.indexOf("style");
    r > -1 && e.splice(r, 1)
}
class DragManager {
    constructor() {}
    static dragElement(e, t) {
        let n = 0,
            o = 0,
            r = 0,
            l = 0;

        function elementDrag(t) {
            t.preventDefault(), n = r - t.clientX, o = l - t.clientY, r = t.clientX, l = t.clientY;
            let i = e.offsetTop - o,
                s = e.offsetLeft - n;
            const a = window.innerWidth,
                p = window.innerHeight,
                c = e.offsetWidth,
                f = e.offsetHeight;
            i < 0 ? i = 0 : i + f > p && (i = p - f), s < 0 ? s = 0 : s + c > a && (s = a - c), e.style.top = `${i}px`, e.style.left = `${s}px`, e.style.right = "auto"
        }

        function closeDragElement() {
            document.removeEventListener("pointerup", closeDragElement), document.removeEventListener("pointermove", elementDrag)
        }
        e.style.position = "absolute", t && t.addEventListener("pointerdown", (function dragPointerDown(e) {
            e.preventDefault(), r = e.clientX, l = e.clientY, document.addEventListener("pointerup", closeDragElement), document.addEventListener("pointermove", elementDrag)
        }))
    }
    static resetDragElement(e, {
        top: t,
        left: n,
        right: o,
        bottom: r
    }) {
        "number" == typeof t ? e.style.top = `${t}px` : "number" == typeof r && (e.style.bottom = `${r}px`), "number" == typeof n ? (e.style.left = `${n}px`, e.style.right = "auto") : "number" == typeof o && (e.style.right = `${o}px`, e.style.left = "auto")
    }
}
const UiLoader =

    // ======== touchInput ========
    pc.createScript("touchInput");
TouchInput.attributes.add("deadZone", {
    title: "Dead Zone",
    description: "Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.",
    type: "number",
    min: 0,
    max: .4,
    default: .3
}), TouchInput.attributes.add("turnSpeed", {
    title: "Turn Speed",
    description: "Maximum turn speed in degrees per second",
    type: "number",
    default: 150
}), TouchInput.attributes.add("radius", {
    title: "Radius",
    description: "The radius of the virtual joystick in CSS pixels.",
    type: "number",
    default: 50
}), TouchInput.attributes.add("doubleTapInterval", {
    title: "Double Tap Interval",
    description: "The time in milliseconds between two taps of the right virtual joystick for a double tap to register. A double tap will trigger a jump.",
    type: "number",
    default: 300
}), TouchInput.prototype.initialize = function() {
    const e = this.app,
        t = e.graphicsDevice.canvas;
    e._stickInput || (e._stickInput = {
        left: {
            x: 0,
            y: 0
        },
        right: {
            x: 0,
            y: 0
        }
    }), this.remappedPos = new pc.Vec2, this.lastRightPos = null, this.leftStick = {
        identifier: -1,
        center: new pc.Vec2,
        pos: new pc.Vec2
    }, this.rightStick = {
        identifier: -1,
        center: new pc.Vec2,
        pos: new pc.Vec2
    }, this.pinch = {
        secondId: -1,
        primaryPage: new pc.Vec2,
        secondPage: new pc.Vec2,
        lastDistance: 0
    }, this.pinchZoomScale = 2.5, this.isVRHeadset = this.app.game.isVRHeadset(), this.lastRightTap = 0, this.touchAreaEntity = this.app.root.findByName("TouchInfoScreen").findByName("LeftTouchArea"), this.touchHitDebug = this.app.root.findByName("TouchInfoScreen").findByName("TouchHitDebug");
    const touchStart = i => {
            if (this.everTouched = !0, this.app.disableSceneTouch.depth > 0 && -1 === this.leftStick.identifier) return void console.log("touchStart ignore due to disableSceneTouch", this.app.disableSceneTouch);
            const s = i.changedTouches;
            for (let i = 0; i < s.length; i++) {
                const a = s[i];
                console.log("touchStart", a.identifier, a.pageX, a.pageY);
                let r = a.pageX <= t.clientWidth / 3 && a.pageY >= t.clientHeight / 2;
                if (this.touchAreaEntity.enabled) {
                    const e = new pc.Vec3(a.pageX / t.clientWidth * 2 - 1, a.pageY / t.clientHeight * -2 + 1, 0),
                        i = this.touchAreaEntity.element.width / t.clientHeight;
                    this.touchHitDebug.setPosition(e.x, e.y, 0);
                    const s = e.sub(this.touchAreaEntity.getPosition());
                    s.x *= t.clientWidth / t.clientHeight;
                    r = s.length() < 1.2 * i
                }
                if (r && -1 === this.leftStick.identifier) this.leftStick.identifier = a.identifier, this.leftStick.center.set(a.pageX, a.pageY), this.leftStick.pos.set(0, 0), e.fire("leftjoystick:enable", a.pageX, a.pageY);
                else if (r || -1 !== this.rightStick.identifier) r || -1 !== this.pinch.secondId || (this.pinch.secondId = a.identifier, this.pinch.secondPage.set(a.pageX, a.pageY), this.pinch.lastDistance = this.pinch.primaryPage.distance(this.pinch.secondPage));
                else {
                    this.rightStick.identifier = a.identifier, this.rightStick.center.set(a.pageX, a.pageY), this.rightStick.pos.set(0, 0), this.pinch.primaryPage.set(a.pageX, a.pageY), e.fire("rightjoystick:enable", a.pageX, a.pageY);
                    const t = Date.now();
                    t - this.lastRightTap < this.doubleTapInterval && e.fire("firstperson:jump"), this.lastRightTap = t, this.lastRightPos = null
                }
            }
            this.app.needsRedraw = 10
        },
        touchMove = t => {
            const i = t.changedTouches;
            let s = !1;
            for (let t = 0; t < i.length; t++) {
                const a = i[t];
                a.identifier === this.leftStick.identifier ? (this.leftStick.pos.set(a.pageX, a.pageY), this.leftStick.pos.sub(this.leftStick.center), this.leftStick.pos.scale(1 / this.radius), e.fire("leftjoystick:move", a.pageX, a.pageY)) : a.identifier === this.rightStick.identifier ? (this.rightStick.pos.set(a.pageX, a.pageY), this.rightStick.pos.sub(this.rightStick.center), this.rightStick.pos.scale(1 / this.radius), this.pinch.primaryPage.set(a.pageX, a.pageY), e.fire("rightjoystick:move", a.pageX, a.pageY), -1 !== this.pinch.secondId && (s = !0)) : a.identifier === this.pinch.secondId && (this.pinch.secondPage.set(a.pageX, a.pageY), s = !0)
            }
            if (s) {
                const t = this.pinch.primaryPage.distance(this.pinch.secondPage),
                    i = t - this.pinch.lastDistance;
                this.pinch.lastDistance = t, 0 !== i && e.fire("camera:pinchZoom", -i * this.pinchZoomScale)
            }
            this.app.needsRedraw = !0
        },
        handleKeyDown = e => {
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(e.key) && (this.everTouched = !1)
        },
        touchEnd = t => {
            const i = t.changedTouches;
            for (let s = 0; s < i.length; s++) {
                const a = i[s];
                if (console.log("touchEnd", a.identifier), a.identifier === this.leftStick.identifier) {
                    this.leftStick.identifier = -1, e._stickInput && (e._stickInput.left.x = 0, e._stickInput.left.y = 0);
                    e.disableKeyboardMovement && e.disableKeyboardMovement.depth > 0 || (e.fire("firstperson:forward", 0), e.fire("firstperson:strafe", 0)), e.fire("leftjoystick:disable"), t.preventDefault(), t.stopPropagation()
                } else a.identifier === this.rightStick.identifier ? (this.rightStick.identifier = -1, this.pinch.secondId = -1, e.isCameraDragging = !1, e.fire("rightjoystick:disable"), e.fire("firstperson:lookEnd"), console.log("rightjoystick:disable")) : a.identifier === this.pinch.secondId && (this.pinch.secondId = -1, this.lastRightPos = this.rightStick.pos.clone())
            }
            this.app.needsRedraw = !0
        },
        touchCancel = t => {
            e.isCameraDragging = !1, touchEnd(t)
        },
        i = {},
        addEventListeners = function() {
            window.addEventListener("touchstart", touchStart, i), window.addEventListener("touchmove", touchMove, i), window.addEventListener("touchend", touchEnd, i), window.addEventListener("touchcancel", touchCancel, i), window.addEventListener("keydown", handleKeyDown, i)
        };
    this.on("enable", addEventListeners), this.on("disable", (function() {
        e.fire("leftjoystick:disable"), this.leftStick.identifier = -1, window.removeEventListener("touchstart", touchStart, i), window.removeEventListener("touchmove", touchMove, i), window.removeEventListener("touchend", touchEnd, i), window.removeEventListener("touchcancel", touchCancel, i), window.removeEventListener("keydown", handleKeyDown, i)
    })), addEventListeners(), this.touchInfoUI = this.app.root.findByName("TouchInfoScreen"), this.overlayUI = this.app.root.findByName("UI Game Overlay")
}, TouchInput.prototype.update = function(e) {
    if (this.app.disablePointLock.depth > 0) return void(this.touchInfoUI.enabled = !1);
    if (0 == e || !this.app.touch) return void(this.touchInfoUI.enabled = !1);
    if (this.app.userProfileData.viewOnlyMode(), this.app.xr.active) return void(this.touchInfoUI.enabled = !1);
    if (!this.everTouched) return void(this.touchInfoUI.enabled = !1);
    this.touchInfoUI.enabled = !0, this.overlayUI.enabled || this.app.keepTouchOverlayVisible || this.app.customTravelCenter?.roomData?.hideUI || (this.touchInfoUI.enabled = !1);
    const t = this.app,
        i = t.disableKeyboardMovement && t.disableKeyboardMovement.depth > 0;
    if (-1 !== this.leftStick.identifier) {
        this.app.needsRedraw = !0, applyRadialDeadZoneMin(this.leftStick.pos, this.remappedPos, this.deadZone, 0);
        const e = this.remappedPos.x,
            s = -this.remappedPos.y;
        t._stickInput && (t._stickInput.left.x = e, t._stickInput.left.y = s), i || (this.lastStrafe !== e && (t.fire("firstperson:strafe", e), this.lastStrafe = e, this.leftStick.pos.length() > 3 ? t.fire("firstperson:boost", 1) : t.fire("firstperson:boost", 0)), this.lastForward !== s && (t.fire("firstperson:forward", s), this.lastForward = s, this.leftStick.pos.length() > 3 ? t.fire("firstperson:boost", 1) : t.fire("firstperson:boost", 0)))
    } else t._stickInput && (t._stickInput.left.x = 0, t._stickInput.left.y = 0);
    if (-1 !== this.rightStick.identifier) {
        if (this.app.needsRedraw = 10, t._stickInput && (t._stickInput.right.x = this.rightStick.pos.x, t._stickInput.right.y = this.rightStick.pos.y), this.lastRightPos)
            if (-1 !== this.pinch.secondId) this.lastRightPos = this.rightStick.pos.clone();
            else {
                const i = this.lastRightPos.clone().sub(this.rightStick.pos);
                this.lastRightPos = this.rightStick.pos.clone();
                const s = i.length();
                let a = e > 0 ? 8 + s / e : 0,
                    r = .75;
                this.isVRHeadset && (r = -.3, a = 12);
                const n = i.x * r * a,
                    o = i.y * r * 12;
                s > .01 && (t.isCameraDragging = !0), t.fire("firstperson:look", n, o)
            }
        else this.lastRightPos = this.rightStick.pos.clone();
        (this.lastStrafe || this.lastForward) && this.touchInfoUI.script.fadeoutElements && this.touchInfoUI.script.fadeoutElements.fadeOut()
    } else t._stickInput && (t._stickInput.right.x = 0, t._stickInput.right.y = 0)
};
const GamePadInput =

    // ======== virtualJoystick ========
    pc.createScript("virtualJoystick");
VirtualJoystick.attributes.add("stick", {
    type: "entity"
}), VirtualJoystick.attributes.add("enableEvent", {
    type: "string"
}), VirtualJoystick.attributes.add("moveEvent", {
    type: "string"
}), VirtualJoystick.attributes.add("disableEvent", {
    type: "string"
}), VirtualJoystick.prototype.initialize = function() {
    const t = this.app;
    t.on(this.enableEvent, (function(t, i) {
        this.entity.setLocalPosition(t, -i, 0), this.stick.setLocalPosition(t, -i, 0), this.entity.element.enabled = !0, this.stick.element.enabled = !0
    }), this), t.on(this.moveEvent, (function(t, i) {
        this.stick.setLocalPosition(t, -i, 0)
    }), this), t.on(this.disableEvent, (function() {
        this.entity.element.enabled = !1, this.stick.element.enabled = !1
    }), this)
};
! function(t) {
    var r = {};

    function n(i) {
        if (r[i]) return r[i].exports;
        var o = r[i] = {
            i: i,
            l: !1,
            exports: {}
        };
        return t[i].call(o.exports, o, o.exports, n), o.l = !0, o.exports
    }
    n.m = t, n.c = r, n.d = function(t, r, i) {
        n.o(t, r) || Object.defineProperty(t, r, {
            enumerable: !0,
            get: i
        })
    }, n.r = function(t) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(t, "__esModule", {
            value: !0
        })
    }, n.t = function(t, r) {
        if (1 & r && (t = n(t)), 8 & r) return t;
        if (4 & r && "object" == typeof t && t && t.__esModule) return t;
        var i = Object.create(null);
        if (n.r(i), Object.defineProperty(i, "default", {
                enumerable: !0,
                value: t
            }), 2 & r && "string" != typeof t)
            for (var o in t) n.d(i, o, function(r) {
                return t[r]
            }.bind(null, o));
        return i
    }, n.n = function(t) {
        var r = t && t.__esModule ? function() {
            return t.default
        } : function() {
            return t
        };
        return n.d(r, "a", r), r
    }, n.o = function(t, r) {
        return Object.prototype.hasOwnProperty.call(t, r)
    }, n.p = "", n(n.s = 0)
}([function(t, r, i) {
    "use strict";
    var o = this && this.__importDefault || function(t) {
        return t && t.__esModule ? t : {
            default: t
        }
    };
    Object.defineProperty(r, "__esModule", {
        value: !0
    });
    var c = o(i(1));
    if (window.Uranus || (window.Uranus = {
            Editor: c.default
        }), !0 === c.default.inEditor() && (Uranus.Editor = new c.default, editor && Uranus && Uranus.Editor)) {
        var u = [{
            moduleName: "Ammo",
            glueUrl: "ammo.wasm.js",
            wasmUrl: "ammo.wasm.wasm",
            fallbackUrl: "ammo.js",
            loaded: !1
        }];
        Uranus.Editor.loadModules(u).then((function() {
            Uranus.Editor.startAppLoop(!0, !0 === u[0].loaded), Uranus.Editor.batchExecuteScripts(!0)
        }))
    }
}, function(t, r, i) {
    "use strict";
    var o = this && this.__createBinding || (Object.create ? function(t, r, i, o) {
            void 0 === o && (o = i), Object.defineProperty(t, o, {
                enumerable: !0,
                get: function() {
                    return r[i]
                }
            })
        } : function(t, r, i, o) {
            void 0 === o && (o = i), t[o] = r[i]
        }),
        c = this && this.__setModuleDefault || (Object.create ? function(t, r) {
            Object.defineProperty(t, "default", {
                enumerable: !0,
                value: r
            })
        } : function(t, r) {
            t.default = r
        }),
        u = this && this.__importStar || function(t) {
            if (t && t.__esModule) return t;
            var r = {};
            if (null != t)
                for (var i in t) "default" !== i && Object.hasOwnProperty.call(t, i) && o(r, t, i);
            return c(r, t), r
        },
        d = this && this.__importDefault || function(t) {
            return t && t.__esModule ? t : {
                default: t
            }
        };
    Object.defineProperty(r, "__esModule", {
        value: !0
    });
    var p = u(i(2)),
        f = u(i(3)),
        h = u(i(4)),
        v = u(i(5)),
        b = u(i(6)),
        y = d(i(7)),
        m = function() {
            function e() {
                this.renderOutline = !0, this.selectionOutline = {}, this.loadScriptAsync = p.loadScriptAsync.bind(this), this.loadWasmModuleAsync = p.loadWasmModuleAsync.bind(this), this.wasmSupported = p.wasmSupported.bind(this), this.loadModules = p.loadModules.bind(this), this.batchPreloadAssets = f.batchPreloadAssets.bind(this), this.loadEditorScriptAssets = f.loadEditorScriptAssets.bind(this), this.batchExecuteScripts = h.batchExecuteScripts.bind(this), this.prepareEditorScriptAttributes = h.prepareEditorScriptAttributes.bind(this), this.setEntityModelOutline = v.setEntityModelOutline.bind(this), this.duplicateEntity = v.duplicateEntity.bind(this), this.duplicateEntities = v.duplicateEntities.bind(this), this.editorPickerState = b.editorPickerState.bind(this), this.runBatcher = b.runBatcher.bind(this), this.inEditor = e.inEditor, this.app = editor ? editor.call("viewport:app") : void 0, this.setupOutline(this.app), this.interface = new y.default, window.setEntityModelOutline = v.setEntityModelOutline.bind(this), window.Uranus = {
                    Editor: this
                }, this.interface.boot()
            }
            return e.inEditor = function() {
                return void 0 !== window.editor && -1 === window.location.href.indexOf("launch.playcanvas.com")
            }, e.prototype.startAppLoop = function(t, r) {
                var i = this;
                if (editor) {
                    if (r) {
                        this.app.systems.rigidbody.onLibraryLoaded();
                        for (var o = 0, c = this.app.root.findComponents("rigidbody"); o < c.length; o++) {
                            var u = c[o];
                            if (!0 === u.entity.enabled && u.type === pc.BODYTYPE_STATIC && u.entity.collision) {
                                pc.RigidBodyComponent.prototype.constructor.call(u, u.system, u.entity);
                                var d = u.entity.collision;
                                d.system.recreatePhysicalShapes(d), u.enabled = !1, u.enabled = !0
                            }
                        }
                    }
                    this.appRunning = t, this.interface.addUIButton("Parse Scripts", "button", this.appRunning, (function() {
                        i.batchExecuteScripts(!1)
                    })), this.interface.addUIButton("Update() Running", "checkbox", this.appRunning, (function(t) {
                        i.appRunning = t, !0 === t && s()
                    }));
                    var s = function() {
                        if (!1 !== i.appRunning) {
                            var t = i.app;
                            pc.app = t;
                            var o = pc.now(),
                                c = (o - (t._time || o)) / 1e3;
                            c = pc.math.clamp(c, 0, t.maxDeltaTime), c *= t.timeScale, t._time = o, window.requestAnimationFrame(s), editor.call("viewport:render"),
                                function(t) {
                                    var r = i.app;
                                    r.frame++, r.systems.fire("update", t), r.systems.fire("animationUpdate", t), r.systems.fire("postUpdate", t), r.fire("update", t)
                                }(c), !0 === r && i.app.systems.rigidbody.onUpdate(c)
                        }
                    };
                    s(), this.interface.logMessage("Started pc.App update loop")
                }
            }, e.prototype.setupOutline = function(t) {
                var r, i = this,
                    o = t.renderer.device,
                    c = (t.scene, []),
                    u = [],
                    d = ("outline-tex", 255, 255, 255, 255, (r = new pc.Texture(t.graphicsDevice, {
                        width: 1,
                        height: 1,
                        format: pc.PIXELFORMAT_R8_G8_B8_A8
                    })).name = "outline-tex", r.lock().set(new Uint8Array([255, 255, 255, 255])), r.unlock(), r),
                    p = pc.shaderChunks,
                    f = p.createShaderFromCode(o, p.fullscreenQuadVS, p.outputTex2DPS, "outputTex2D"),
                    h = "         precision " + o.precision + " float;\n         varying vec2 vUv0;\n         uniform float uOffset;\n         uniform sampler2D source;\n         void main(void)\n         {\n             float diff = 0.0;\n             vec4 pixel;\n             vec4 texel = texture2D(source, vUv0);\n             vec4 firstTexel = texel;\n             \n             pixel = texture2D(source, vUv0 + vec2(uOffset * -2.0, 0.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(uOffset * -1.0, 0.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(uOffset * +1.0, 0.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(uOffset * +2.0, 0.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             gl_FragColor = vec4(texel.rgb, min(diff, 1.0));\n         }\n",
                    v = p.createShaderFromCode(o, p.fullscreenQuadVS, h, "editorOutlineH"),
                    b = "         precision " + o.precision + " float;\n         varying vec2 vUv0;\n         uniform float uOffset;\n         uniform sampler2D source;\n         void main(void)\n         {\n             vec4 pixel;\n             vec4 texel = texture2D(source, vUv0);\n             vec4 firstTexel = texel;\n             float diff = texel.a;\n             \n             pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * -2.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * -1.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * +1.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * +2.0));\n             texel = max(texel, pixel);\n             diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n             \n             gl_FragColor = vec4(texel.rgb, min(diff, 1.0));\n         }\n",
                    y = p.createShaderFromCode(o, p.fullscreenQuadVS, b, "editorOutlineV");
                t.scene.layers.getLayerByName("UI").onPostRender = function() {
                    o.scope.resolve("source").setValue(u[0]), o.setBlending(!0), o.setBlendFunction(pc.BLENDMODE_SRC_ALPHA, pc.BLENDMODE_ONE_MINUS_SRC_ALPHA), pc.drawQuadWithShader(o, null, f, null, null, !0)
                };
                var m = new pc.Layer({
                        name: "Outline",
                        opaqueSortMode: pc.SORTMODE_NONE,
                        passThrough: !0,
                        overrideClear: !0,
                        clearColorBuffer: !0,
                        clearDepthBuffer: !0,
                        clearColor: new pc.Color(0, 0, 0, 0),
                        shaderPass: 24,
                        onPostRender: function() {
                            var t = o.scope.resolve("uOffset"),
                                r = o.scope.resolve("source");
                            t.setValue(1 / o.width / 2), r.setValue(u[0]), pc.drawQuadWithShader(o, c[1], v), t.setValue(1 / o.height / 2), r.setValue(u[1]), pc.drawQuadWithShader(o, c[0], y)
                        }
                    }),
                    g = new pc.LayerComposition;
                g.pushOpaque(m);
                var x = function(t) {
                    return 24 !== t.pass ? t : {
                        opacityMap: t.opacityMap,
                        opacityMapUv: t.opacityMapUv,
                        opacityMapChannel: t.opacityMapChannel,
                        opacityMapTransform: t.opacityMapTransform,
                        opacityVertexColor: t.opacityVertexColor,
                        opacityVertexColorChannel: t.opacityVertexColorChannel,
                        vertexColors: t.vertexColors,
                        alphaTest: t.alphaTest,
                        skin: t.skin
                    }
                };
                t.on("update", (function(r) {
                    if (c[0] && (c[0].width !== o.width || c[1].height !== o.height)) {
                        for (var p = 0; p < 2; p++) c[p].destroy(), u[p].destroy();
                        c = [], u = []
                    }
                    if (!c[0])
                        for (p = 0; p < 2; p++) u[p] = new pc.Texture(o, {
                            format: pc.PIXELFORMAT_R8_G8_B8_A8,
                            width: o.width,
                            height: o.height
                        }), u[p].minFilter = pc.FILTER_NEAREST, u[p].magFilter = pc.FILTER_NEAREST, u[p].addressU = pc.ADDRESS_CLAMP_TO_EDGE, u[p].addressV = pc.ADDRESS_CLAMP_TO_EDGE, c[p] = new pc.RenderTarget(o, u[p]);
                    var f = editor.call("camera:current").camera;
                    if (i.renderOutline) {
                        m.renderTarget = c[0], m.clearMeshInstances(), m.cameras[0] !== f && (m.clearCameras(), m.addCamera(f));
                        var h = m.opaqueMeshInstances;
                        for (var v in i.selectionOutline)
                            if (i.selectionOutline[v]) {
                                var b = i.selectionOutline[v],
                                    y = b.entity.model;
                                if (y && y.model)
                                    for (var w = y.meshInstances, _ = 0; _ < w.length; _++) {
                                        var E = w[_];
                                        !E.command && E.material && (E.onUpdateShader = x, E.setParameter("material_emissive", b.color, 1 << 24), E.setParameter("texture_emissiveMap", d, 1 << 24), h.push(E))
                                    }
                            } t.renderer.renderComposition(g)
                    }
                }))
            }, e
        }();
    r.default = m
}, function(t, r, i) {
    "use strict";
    var o = this && this.__awaiter || function(t, r, i, o) {
            return new(i || (i = Promise))((function(c, u) {
                function a(t) {
                    try {
                        l(o.next(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function s(t) {
                    try {
                        l(o.throw(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function l(t) {
                    var r;
                    t.done ? c(t.value) : (r = t.value, r instanceof i ? r : new i((function(t) {
                        t(r)
                    }))).then(a, s)
                }
                l((o = o.apply(t, r || [])).next())
            }))
        },
        c = this && this.__generator || function(t, r) {
            var i, o, c, u, d = {
                label: 0,
                sent: function() {
                    if (1 & c[0]) throw c[1];
                    return c[1]
                },
                trys: [],
                ops: []
            };
            return u = {
                next: s(0),
                throw: s(1),
                return: s(2)
            }, "function" == typeof Symbol && (u[Symbol.iterator] = function() {
                return this
            }), u;

            function s(u) {
                return function(p) {
                    return function(u) {
                        if (i) throw new TypeError("Generator is already executing.");
                        for (; d;) try {
                            if (i = 1, o && (c = 2 & u[0] ? o.return : u[0] ? o.throw || ((c = o.return) && c.call(o), 0) : o.next) && !(c = c.call(o, u[1])).done) return c;
                            switch (o = 0, c && (u = [2 & u[0], c.value]), u[0]) {
                                case 0:
                                case 1:
                                    c = u;
                                    break;
                                case 4:
                                    return d.label++, {
                                        value: u[1],
                                        done: !1
                                    };
                                case 5:
                                    d.label++, o = u[1], u = [0];
                                    continue;
                                case 7:
                                    u = d.ops.pop(), d.trys.pop();
                                    continue;
                                default:
                                    if (!((c = (c = d.trys).length > 0 && c[c.length - 1]) || 6 !== u[0] && 2 !== u[0])) {
                                        d = 0;
                                        continue
                                    }
                                    if (3 === u[0] && (!c || u[1] > c[0] && u[1] < c[3])) {
                                        d.label = u[1];
                                        break
                                    }
                                    if (6 === u[0] && d.label < c[1]) {
                                        d.label = c[1], c = u;
                                        break
                                    }
                                    if (c && d.label < c[2]) {
                                        d.label = c[2], d.ops.push(u);
                                        break
                                    }
                                    c[2] && d.ops.pop(), d.trys.pop();
                                    continue
                            }
                            u = r.call(t, d)
                        } catch (t) {
                            u = [6, t], o = 0
                        } finally {
                            i = c = 0
                        }
                        if (5 & u[0]) throw u[1];
                        return {
                            value: u[0] ? u[1] : void 0,
                            done: !0
                        }
                    }([u, p])
                }
            }
        };
    Object.defineProperty(r, "__esModule", {
        value: !0
    }), r.loadModules = r.wasmSupported = r.loadWasmModuleAsync = r.loadScriptAsync = void 0, r.loadScriptAsync = function(t) {
        return new Promise((function(r) {
            var i = document.createElement("script");
            i.onload = function() {
                r()
            }, i.onerror = function() {
                throw new Error("failed to load " + t)
            }, i.async = !0, i.src = t, document.head.appendChild(i)
        }))
    }, r.loadWasmModuleAsync = function(t, r, i) {
        var o = this;
        return new Promise((function(c) {
            o.loadScriptAsync(r).then((function() {
                var r = window[t];
                window[t + "Lib"] = r, r({
                    locateFile: function() {
                        return i
                    }
                }).then((function(r) {
                    window[t] = r, c()
                }))
            }))
        }))
    }, r.wasmSupported = function() {
        try {
            if ("object" == typeof WebAssembly && "function" == typeof WebAssembly.instantiate) {
                var t = new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0));
                if (t instanceof WebAssembly.Module) return new WebAssembly.Instance(t) instanceof WebAssembly.Instance
            }
        } catch (t) {}
        return !1
    }, r.loadModules = function(t) {
        return o(this, void 0, void 0, (function() {
            var r, i, o, u, d, p, f, h;
            return c(this, (function(c) {
                switch (c.label) {
                    case 0:
                        r = "", i = this.wasmSupported(), o = 0, u = t, c.label = 1;
                    case 1:
                        return o < u.length ? (d = u[o], p = this.app.assets.find(d.glueUrl), f = this.app.assets.find(d.wasmUrl), h = this.app.assets.find(d.fallbackUrl), p && f && h ? (d.glueUrl = p.getFileUrl(), d.wasmUrl = f.getFileUrl(), d.fallbackUrl = h.getFileUrl(), i ? [4, this.loadWasmModuleAsync(d.moduleName, r + d.glueUrl, r + d.wasmUrl)] : [3, 3]) : [3, 6]) : [3, 7];
                    case 2:
                        return c.sent(), [3, 5];
                    case 3:
                        return [4, this.loadWasmModuleAsync(d.moduleName, r + d.fallbackUrl, "")];
                    case 4:
                        c.sent(), c.label = 5;
                    case 5:
                        d.loaded = !0, c.label = 6;
                    case 6:
                        return o++, [3, 1];
                    case 7:
                        return [2]
                }
            }))
        }))
    }
}, function(t, r, i) {
    "use strict";
    var o = this && this.__awaiter || function(t, r, i, o) {
            return new(i || (i = Promise))((function(c, u) {
                function a(t) {
                    try {
                        l(o.next(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function s(t) {
                    try {
                        l(o.throw(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function l(t) {
                    var r;
                    t.done ? c(t.value) : (r = t.value, r instanceof i ? r : new i((function(t) {
                        t(r)
                    }))).then(a, s)
                }
                l((o = o.apply(t, r || [])).next())
            }))
        },
        c = this && this.__generator || function(t, r) {
            var i, o, c, u, d = {
                label: 0,
                sent: function() {
                    if (1 & c[0]) throw c[1];
                    return c[1]
                },
                trys: [],
                ops: []
            };
            return u = {
                next: s(0),
                throw: s(1),
                return: s(2)
            }, "function" == typeof Symbol && (u[Symbol.iterator] = function() {
                return this
            }), u;

            function s(u) {
                return function(p) {
                    return function(u) {
                        if (i) throw new TypeError("Generator is already executing.");
                        for (; d;) try {
                            if (i = 1, o && (c = 2 & u[0] ? o.return : u[0] ? o.throw || ((c = o.return) && c.call(o), 0) : o.next) && !(c = c.call(o, u[1])).done) return c;
                            switch (o = 0, c && (u = [2 & u[0], c.value]), u[0]) {
                                case 0:
                                case 1:
                                    c = u;
                                    break;
                                case 4:
                                    return d.label++, {
                                        value: u[1],
                                        done: !1
                                    };
                                case 5:
                                    d.label++, o = u[1], u = [0];
                                    continue;
                                case 7:
                                    u = d.ops.pop(), d.trys.pop();
                                    continue;
                                default:
                                    if (!((c = (c = d.trys).length > 0 && c[c.length - 1]) || 6 !== u[0] && 2 !== u[0])) {
                                        d = 0;
                                        continue
                                    }
                                    if (3 === u[0] && (!c || u[1] > c[0] && u[1] < c[3])) {
                                        d.label = u[1];
                                        break
                                    }
                                    if (6 === u[0] && d.label < c[1]) {
                                        d.label = c[1], c = u;
                                        break
                                    }
                                    if (c && d.label < c[2]) {
                                        d.label = c[2], d.ops.push(u);
                                        break
                                    }
                                    c[2] && d.ops.pop(), d.trys.pop();
                                    continue
                            }
                            u = r.call(t, d)
                        } catch (t) {
                            u = [6, t], o = 0
                        } finally {
                            i = c = 0
                        }
                        if (5 & u[0]) throw u[1];
                        return {
                            value: u[0] ? u[1] : void 0,
                            done: !0
                        }
                    }([u, p])
                }
            }
        };
    Object.defineProperty(r, "__esModule", {
        value: !0
    }), r.loadEditorScriptAssets = r.batchPreloadAssets = void 0, r.batchPreloadAssets = function(t) {
        return o(this, void 0, void 0, (function() {
            var r, i, o = this;
            return c(this, (function(c) {
                switch (c.label) {
                    case 0:
                        return r = editor.call("assets:find", (function(r) {
                            var i = r.get("type");
                            return !1 !== r.get("preload") && !(t && (!t.exclude || -1 !== t.exclude.indexOf(i)))
                        })), i = [], r.forEach((function(t) {
                            var r = t[1],
                                c = o.app.assets.get(r.get("id"));
                            if (!c || !0 === c.loaded) return !0;
                            var u = new Promise((function(t, r) {
                                c.ready(t), c.on("error", r), o.app.assets.load(c)
                            }));
                            i.push(u)
                        })), [4, Promise.all(i)];
                    case 1:
                        return c.sent(), [2]
                }
            }))
        }))
    }, r.loadEditorScriptAssets = function(t) {
        return o(this, void 0, void 0, (function() {
            var r, i, o, u, d, p, f = this;
            return c(this, (function(c) {
                switch (c.label) {
                    case 0:
                        if (!editor) return [2];
                        for (r = [], i = function(t) {
                                var i = editor.call("assets:scripts:assetByScript", t);
                                if (null === i) return console.warn("No item found for scriptType: " + t), "continue";
                                var c = o.app.assets.get(i.get("id"));
                                c.unload();
                                var u = new Promise((function(t) {
                                    c.ready(t), f.app.assets.load(c)
                                }));
                                r.push(u)
                            }, o = this, u = 0, d = t; u < d.length; u++) p = d[u], i(p);
                        return [4, Promise.all(r)];
                    case 1:
                        return c.sent(), [2]
                }
            }))
        }))
    }
}, function(t, r, i) {
    "use strict";
    var o = this && this.__awaiter || function(t, r, i, o) {
            return new(i || (i = Promise))((function(c, u) {
                function a(t) {
                    try {
                        l(o.next(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function s(t) {
                    try {
                        l(o.throw(t))
                    } catch (t) {
                        u(t)
                    }
                }

                function l(t) {
                    var r;
                    t.done ? c(t.value) : (r = t.value, r instanceof i ? r : new i((function(t) {
                        t(r)
                    }))).then(a, s)
                }
                l((o = o.apply(t, r || [])).next())
            }))
        },
        c = this && this.__generator || function(t, r) {
            var i, o, c, u, d = {
                label: 0,
                sent: function() {
                    if (1 & c[0]) throw c[1];
                    return c[1]
                },
                trys: [],
                ops: []
            };
            return u = {
                next: s(0),
                throw: s(1),
                return: s(2)
            }, "function" == typeof Symbol && (u[Symbol.iterator] = function() {
                return this
            }), u;

            function s(u) {
                return function(p) {
                    return function(u) {
                        if (i) throw new TypeError("Generator is already executing.");
                        for (; d;) try {
                            if (i = 1, o && (c = 2 & u[0] ? o.return : u[0] ? o.throw || ((c = o.return) && c.call(o), 0) : o.next) && !(c = c.call(o, u[1])).done) return c;
                            switch (o = 0, c && (u = [2 & u[0], c.value]), u[0]) {
                                case 0:
                                case 1:
                                    c = u;
                                    break;
                                case 4:
                                    return d.label++, {
                                        value: u[1],
                                        done: !1
                                    };
                                case 5:
                                    d.label++, o = u[1], u = [0];
                                    continue;
                                case 7:
                                    u = d.ops.pop(), d.trys.pop();
                                    continue;
                                default:
                                    if (!((c = (c = d.trys).length > 0 && c[c.length - 1]) || 6 !== u[0] && 2 !== u[0])) {
                                        d = 0;
                                        continue
                                    }
                                    if (3 === u[0] && (!c || u[1] > c[0] && u[1] < c[3])) {
                                        d.label = u[1];
                                        break
                                    }
                                    if (6 === u[0] && d.label < c[1]) {
                                        d.label = c[1], c = u;
                                        break
                                    }
                                    if (c && d.label < c[2]) {
                                        d.label = c[2], d.ops.push(u);
                                        break
                                    }
                                    c[2] && d.ops.pop(), d.trys.pop();
                                    continue
                            }
                            u = r.call(t, d)
                        } catch (t) {
                            u = [6, t], o = 0
                        } finally {
                            i = c = 0
                        }
                        if (5 & u[0]) throw u[1];
                        return {
                            value: u[0] ? u[1] : void 0,
                            done: !0
                        }
                    }([u, p])
                }
            }
        };
    Object.defineProperty(r, "__esModule", {
        value: !0
    }), r.prepareEditorScriptAttributes = r.batchExecuteScripts = void 0, r.batchExecuteScripts = function(t) {
        return o(this, void 0, void 0, (function() {
            var r, i, o, u, d, p, f, h, v, b, y, m, g, w;
            return c(this, (function(c) {
                switch (c.label) {
                    case 0:
                        return editor ? (r = editor.call("assets:scripts:list"), [4, this.loadEditorScriptAssets(r)]) : [2];
                    case 1:
                        return c.sent(), [4, this.batchPreloadAssets({
                            exclude: ["script", "wasm"]
                        })];
                    case 2:
                        for (c.sent(), i = editor.call("entities:list"), o = {}, this.interface.logMessage("Starting script execution"), u = editor.entities.root.listByTag("uranus-scripts-enable-all").length > 0, d = 0, p = i; d < p.length; d++)
                            if (f = p[d], h = f.get("components.script.scripts"))
                                for (v in h) b = void 0, (u || null !== (b = f.get("components.script.scripts." + v + ".attributes.inEditor"))) && ((y = f.entity).script || y.addComponent("script"), y.script[v] && y.script.destroy(v), w = y.script.create(v, {
                                    enabled: !1
                                }), this.prepareEditorScriptAttributes(w), w.enabled = u ? f.get("components.script.scripts." + v + ".enabled") : b, this.interface.logMessage('Added scriptType <strong style="color: lightgreen;">' + v + '</strong> on entity <strong style="color: cyan;">"' + y.name + '"</strong>'), "function" == typeof w.editorInitialize && w.editorInitialize(), (m = o[f.get("resource_id")]) ? (m.instances.push(w), m.scriptTypes.push(v)) : o[f.get("resource_id")] = {
                                    instances: [w],
                                    scriptTypes: [v]
                                });
                        if (t) {
                            for (g in o) w = o[g][0], u && "function" == typeof w.initialize && w.initialize();
                            editor.on("attributes:inspect[entity]", (function(t) {
                                var r = t[0].get("resource_id");
                                if (o[r]) {
                                    var i = o[r],
                                        c = editor.call("attributes:entity.panelComponents");
                                    i.scriptTypes.forEach((function(t, r) {
                                        var o = Array.from(c.dom.querySelectorAll(".pcui-panel-header-title")).find((function(r) {
                                            return r.textContent === t
                                        }));
                                        if (o) try {
                                            if (o = o.parentElement.parentElement.parentElement) {
                                                var u = i.instances[r];
                                                "function" == typeof u.editorScriptPanelRender && u.editorScriptPanelRender(o)
                                            }
                                        } catch (t) {}
                                    }))
                                }
                            }))
                        }
                        return [2]
                }
            }))
        }))
    }, r.prepareEditorScriptAttributes = function(t) {
        if (editor && t) {
            var r = editor.call("entities:get", t.entity._guid),
                i = editor.call("viewport:app"),
                o = "components.script.scripts." + t.__scriptType.__name + ".attributes",
                c = r.get(o),
                u = [];
            for (var d in c) t[d] = c[d], u.push(d);
            u.forEach(function(c) {
                var u = r.getRaw(o + "." + c),
                    d = 0,
                    p = Array.isArray(u);
                p ? d += u.length : d = 1;
                for (var l = function(u) {
                        var d = o + "." + c + (p ? "." + u : "") + ":set";
                        r.on(d, function(r, o) {
                            if (p) {
                                var d = t[c];
                                if (Array.isArray(d)) {
                                    0 === u && (t[c] = [], d = t[c]);
                                    var f = editor.call("entities:get", r);
                                    d[u] = f ? f.entity : i.assets.get(r)
                                } else {
                                    var h = void 0;
                                    !1 === isNaN(d.x) ? h = ["x", "y", "z", "w"] : !1 === isNaN(d.r) && (h = ["r", "g", "b", "a"]), d[h[u]] = r
                                }
                            } else t[c] = r;
                            t.fire("attr:" + c, t[c], o), "function" == typeof t.editorAttrChange && t.editorAttrChange(c, t[c], o)
                        }.bind(t))
                    }, f = 0; f < d; f++) l(f)
            }.bind(t))
        }
    }
}, function(t, r, i) {
    "use strict";
    Object.defineProperty(r, "__esModule", {
        value: !0
    }), r.duplicateEntities = r.duplicateEntity = r.setEntityModelOutline = void 0, r.setEntityModelOutline = function(t, r, i) {
        r ? this.selectionOutline[t._guid] = {
            entity: t,
            color: i || [1, 1, 1]
        } : this.selectionOutline[t._guid] && delete this.selectionOutline[t._guid]
    }, r.duplicateEntity = function(t, r, i, o) {
        var c = this,
            u = t.get("resource_id"),
            d = t.json(),
            p = d.children;
        return d.children = [], d.resource_id = pc.guid.create(), d.parent = r.get("resource_id"), t = new Observer(d), editor.call("entities:updateChildToParentIndex", t.get("resource_id"), r.get("resource_id")), o && (o[u] = t.get("resource_id")), editor.call("entities:add", t), editor.call("realtime:scene:op", {
            p: ["entities", t.get("resource_id")],
            oi: t.json()
        }), r.history.enabled = !1, r.insert("children", t.get("resource_id"), i), r.history.enabled = !0, p.forEach((function(r) {
            c.duplicateEntity(editor.call("entities:get", r), t, void 0, o)
        })), t
    }, r.duplicateEntities = function(t, r) {
        var i, o, c, u = editor.call("entities:root"),
            d = t.slice(0),
            p = [],
            f = [],
            h = {},
            v = {};
        if (-1 === d.indexOf(u)) {
            for (i = 0; i < d.length; i++) o = d[i].get("resource_id"), v[o] = {
                id: o,
                entity: d[i],
                parentId: editor.call("entities:getParentResourceId", o),
                ind: editor.call("entities:get", editor.call("entities:getParentResourceId", o)).get("children").indexOf(o)
            };
            for (i = d.length; i--;)
                for (var b = (c = v[d[i].get("resource_id")]).parentId; b && b !== u.get("resource_id");) {
                    if (v[b]) {
                        d.splice(i, 1), delete v[c.id];
                        break
                    }
                    b = editor.call("entities:getParentResourceId", b)
                }
            d.sort((function(t, r) {
                return v[r.get("resource_id")].ind - v[t.get("resource_id")].ind
            }));
            var y = editor.call("selector:type"),
                m = editor.call("selector:items");
            for (i = 0; i < m.length; i++) c = m[i], "entity" === y ? m[i] = {
                type: "entity",
                id: c.get("resource_id")
            } : "asset" === y && (m[i] = {}, "script" === m[i].get("type") ? (m[i].type = "script", m[i].id = c.get("filename")) : (m[i].type = "asset", m[i].id = c.get("id")));
            for (i = 0; i < d.length; i++) {
                var g = d[i];
                o = g.get("resource_id");
                var w = this.duplicateEntity(g, r, v[o].ind + 1, {});
                p.push(w), f.push(w.json()), h[w.get("resource_id")] = {
                    parentId: editor.call("entities:getParentResourceId", o),
                    ind: v[o].ind
                }
            }
            return editor.call("history:add", {
                name: "duplicate entities",
                undo: function() {
                    var t;
                    for (t = 0; t < f.length; t++) {
                        var r = editor.call("entities:get", f[t].resource_id);
                        r && editor.call("entities:removeEntity", r)
                    }
                },
                redo: function() {
                    for (var t = [], r = 0; r < f.length; r++) {
                        var i = f[r].resource_id,
                            o = h[i];
                        if (o) {
                            var c = editor.call("entities:get", o.parentId);
                            if (c) {
                                var u = new Observer(f[r]);
                                editor.call("entities:addEntity", u, c, !0, o.ind + 1), t.push(u)
                            }
                        }
                    }
                }
            }), p
        }
    }
}, function(t, r, i) {
    "use strict";
    Object.defineProperty(r, "__esModule", {
        value: !0
    }), r.runBatcher = r.editorPickerState = void 0, r.editorPickerState = function(t) {
        this.pickerRef || (this.pickerRef = editor._hooks["viewport:pick"]), editor._hooks["viewport:pick"] = t ? this.pickerRef : function() {}
    }, r.runBatcher = function(t) {
        var r = this,
            i = editor.call("settings:project").get("batchGroups");
        for (var o in i) {
            var c = i[o];
            this.app.batcher.addGroup(c.name, c.dynamic, c.maxAabbSize, c.id, c.layers)
        }
        var u = [];
        if (t) {
            t.forEach((function(t) {
                t.findComponents("model").forEach((function(i) {
                    t.parent && i && i.batchGroupId > -1 && (r.app.batcher.insert("model", i.batchGroupId, t), -1 === u.indexOf(i.batchGroupId) && u.push(i.batchGroupId))
                }))
            }));
            var d = performance.now();
            this.app.batcher.generate(u);
            var p = performance.now();
            return this.interface.logMessage("Batcher executed in " + (p - d).toFixed(0) + "ms"), u
        }
    }
}, function(t, r, i) {
    "use strict";
    var o = this && this.__importDefault || function(t) {
        return t && t.__esModule ? t : {
            default: t
        }
    };
    Object.defineProperty(r, "__esModule", {
        value: !0
    });
    var c = o(i(8)),
        u = function() {
            function e() {}
            return e.prototype.addStyles = function(t) {
                var r = document.createElement("style");
                r.type = "text/css", r.appendChild(document.createTextNode(t)), document.head.appendChild(r)
            }, e.prototype.boot = function() {
                var t = this,
                    r = document.getElementById("layout-viewport").querySelector(".viewport-camera");
                this.toolbar = r.cloneNode(!0), this.toolbar.id = "uranus-toolbar", this.toolbar.classList.add("uranus-toolbar"), this.toolbar.style.top = "40px", this.toolbar.style.left = "4px", this.toolbar.querySelectorAll("*").forEach((function(t) {
                    return t.remove()
                }));
                var i = document.createElement("div");
                i.classList.add("value"), i.innerHTML = "Uranus Editor", this.toolbar.appendChild(i), i.onclick = function() {
                    t.toolbar.classList.contains("active") ? t.toolbar.classList.remove("active") : t.toolbar.classList.add("active")
                }, this.list = document.createElement("ul"), this.list.classList.add("uranus-list"), this.list.style.position = "absolute", this.list.style.top = "32px", this.toolbar.appendChild(this.list), this.addMessagesOutput(), r.after(this.toolbar), this.addStyles(c.default.getOverrides())
            }, e.prototype.addMessagesOutput = function() {
                this.messages = document.createElement("div"), this.messages.classList.add("uranus-messages"), this.toolbar.appendChild(this.messages)
            }, e.prototype.logMessage = function(t) {
                var r = document.createElement("div");
                r.innerHTML = t, this.messages.appendChild(r), window.setTimeout((function() {
                    r.remove()
                }), 3e3)
            }, e.prototype.addUIButton = function(t, r, i, o) {
                var c = document.createElement("li");
                c.innerHTML = t, c.classList.add("uranus-list-item"), this.list.appendChild(c);
                var u = c;
                switch (r) {
                    case "checkbox":
                        (u = document.createElement("input")).setAttribute("type", "checkbox"), u.checked = i, u.classList.add("uranus-checkbox"), c.appendChild(u), u.addEventListener("change", (function(t) {
                            o(t.target.checked)
                        }));
                        break;
                    case "button":
                        u.classList.add("uranus-button"), u.addEventListener("click", (function(t) {
                            o()
                        }))
                }
            }, e
        }();
    r.default = u
}, function(t, r, i) {
    "use strict";
    Object.defineProperty(r, "__esModule", {
        value: !0
    });
    var o = function() {
        function e() {}
        return e.getOverrides = function() {
            return "\n        .uranus-toolbar.active{\n            color: #b1b8ba;\n            background-color: #20292b;\n            box-shadow: 0 0 8px rgba(0,0,0,0.5);\n        }\n        .uranus-list{\n            box-shadow: none !important;\n            width: 140px !important;\n        }\n        .uranus-list-item{\n            cursor: default;\n        }\n        .uranus-checkbox{\n            float: right;\n            margin-top: 9px;\n            line-height: 33px !important;\n        }\n        .uranus-button{\n            cursor: pointer;\n        }\n        .uranus-messages{\n            position: absolute;\n            top: 0px;\n            left: 110%;\n            width: max-content;\n            color: rgba(255,255,255,0.75);\n            text-shadow: 0px 0px 1px rgba(0,0,0,0.3);        \n        }\n        "
        }, e
    }();
    r.default = o
}]);
var Trigger =

    // ======== gamePadInput ========
    pc.createScript("gamePadInput");
GamePadInput.attributes.add("deadZoneLow", {
    title: "Low Dead Zone",
    description: "Radial thickness of inner dead zone of pad's joysticks. This dead zone ensures that all pads report a value of 0 for each joystick axis when untouched.",
    type: "number",
    min: 0,
    max: .4,
    default: .1
}), GamePadInput.attributes.add("deadZoneHigh", {
    title: "High Dead Zone",
    description: "Radial thickness of outer dead zone of pad's joysticks. This dead zone ensures that all pads can reach the -1 and 1 limits of each joystick axis.",
    type: "number",
    min: 0,
    max: .4,
    default: .1
}), GamePadInput.attributes.add("turnSpeed", {
    title: "Turn Speed",
    description: "Maximum turn speed in degrees per second",
    type: "number",
    default: 90
}), GamePadInput.prototype.initialize = function() {
    this.app;
    this.lastStrafe = 0, this.lastForward = 0, this.lastJump = !1, this.remappedPos = new pc.Vec2, this.leftStick = {
        center: new pc.Vec2,
        pos: new pc.Vec2
    }, this.rightStick = {
        center: new pc.Vec2,
        pos: new pc.Vec2
    };
    const addEventListeners = function() {
        window.addEventListener("gamepadconnected", (function(e) {})), window.addEventListener("gamepaddisconnected", (function(e) {}))
    };
    this.on("enable", addEventListeners), this.on("disable", (function() {
        window.removeEventListener("gamepadconnected", (function(e) {})), window.removeEventListener("gamepaddisconnected", (function(e) {}))
    })), addEventListeners()
}, GamePadInput.prototype.update = function(e) {
    const t = this.app,
        i = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let s = 0; s < i.length; s++) {
        const a = i[s];
        if (a && "standard" === a.mapping && a.axes.length >= 4) {
            this.leftStick.pos.set(a.axes[0], a.axes[1]), applyRadialDeadZone(this.leftStick.pos, this.remappedPos, this.deadZoneLow, this.deadZoneHigh);
            const i = this.remappedPos.x;
            this.lastStrafe !== i && (t.fire("firstperson:strafe", i), this.lastStrafe = i);
            const s = -this.remappedPos.y;
            this.lastForward !== s && (t.fire("firstperson:forward", s), this.lastForward = s), this.rightStick.pos.set(a.axes[2], a.axes[3]), applyRadialDeadZone(this.rightStick.pos, this.remappedPos, this.deadZoneLow, this.deadZoneHigh);
            const r = -this.remappedPos.x * this.turnSpeed * e,
                n = -this.remappedPos.y * this.turnSpeed * e;
            t.fire("firstperson:look", r, n), a.buttons[0].pressed && !this.lastJump && t.fire("firstperson:jump"), this.lastJump = a.buttons[0].pressed
        }
    }
};
var VirtualJoystick =

    // ======== waypointScript ========
    pc.createScript("waypointScript");
WaypointScript.attributes.add("behaviour", {
    type: "number",
    enum: [{
        Walk: 0
    }, {
        Idle: 1
    }, {
        Wait: 2
    }, {
        Disappear: 3
    }],
    title: "Behaviour",
    default: 0
}), WaypointScript.attributes.add("approachRadius", {
    type: "number",
    title: "NPC Approach Radius",
    description: "The radius in which the NPC approaches the waypoint and therefore selects the next waypoint according to the behaviour",
    default: .1
}), WaypointScript.attributes.add("waitingRadius", {
    type: "number",
    title: "Player Waiting Radius",
    description: "The radius in which the Player triggers the waypoint according to the behaviour",
    default: 2
}), WaypointScript.attributes.add("npcSpeech", {
    title: "NPC Speech",
    type: "asset",
    assetType: "audio",
    description: "Audio that is played when this waypoint gets approached"
}), WaypointScript.attributes.add("entityToEnable", {
    title: "Enable Entity",
    type: "entity",
    description: "an entity that will get enabled when this waypoint gets approached"
}), WaypointScript.attributes.add("nextWaypoint", {
    type: "entity",
    title: "Next Waypoint",
    description: "Waypoint to approach after this waypoint has been reached"
}), WaypointScript.attributes.add("setUserDataState", {
    type: "json",
    title: "Set User State",
    description: "",
    schema: [{
        name: "stateName",
        title: "State",
        type: "string"
    }, {
        name: "stateValue",
        title: "Value",
        type: "string"
    }]
}), WaypointScript.prototype.getBehaviour = function() {
    return Object.keys(WaypointScript.attributes.index.behaviour.enum[this.behaviour])[0]
}, WaypointScript.prototype.initialize = function() {};
const CharacterController =

    // ======== trigger ========
    pc.createScript("trigger");
Trigger.attributes.add("triggerEntity", {
    type: "entity",
    title: "Trigger Entity",
    description: "The entity that triggers the event",
    array: !0
}), Trigger.attributes.add("loadScene", {
    type: "string",
    title: "Load Scene",
    description: "if set, the trigger loads this scene"
}), Trigger.attributes.add("loadUrl", {
    type: "string",
    title: "Load URL",
    description: "if set, the url is loaded on trigger"
}), Trigger.attributes.add("switchEntity", {
    type: "entity",
    title: "Switch Entity",
    description: "The entity that will get switched on"
}), Trigger.prototype.initialize = function() {
    this.entity.collision.on("triggerenter", this.triggerEntered, this), this.entity.collision.on("triggerleave", this.triggerLeft, this), this.isTriggered = !1
}, Trigger.prototype.doesEntityTrigger = function(t) {
    if (0 == this.triggerEntity.length) return !0;
    for (let i = 0; i < this.triggerEntity.length; i++)
        if (this.triggerEntity[i].name == t.name) return !0;
    return !1
}, Trigger.prototype.triggerEntered = function(t) {
    this.doesEntityTrigger(t) && (console.log("trigger entered " + t.name), this.isTriggered = !0, "" != this.loadScene && loadScene(this.loadScene, {
        hierarchy: !0,
        settings: !1
    }), this.switchEntity && (this.switchEntity.enabled = !0), "" != this.loadUrl && (window.location.href = this.loadUrl))
}, Trigger.prototype.triggerLeft = function(t) {
    this.doesEntityTrigger(t) && (console.log("trigger left " + t.name), this.switchEntity && (this.switchEntity.enabled = !1), this.isTriggered = !1)
}, Trigger.prototype.update = function(t) {
    this.isTriggered
};

function loadScene(e, n, c, s) {
    const o = pc.Application.getApplication(),
        a = o.scenes.find(e);
    if (a) {
        const e = a.loaded;
        o.scenes.loadSceneData(a, (function(a, l) {
            if (a) c && c.call(s, a);
            else {
                let a = null;
                const r = o.root.children;
                for (; r.length > 0;) r[0].destroy();
                o.assets._assets.forEach((function(e) {
                    e.unloadOnSceneChange && (e.keepInSceneCache || (e.unload(), o.assets.remove(e)))
                })), o.css3Renderer && (o.css3Renderer.destroy(), delete o.css3Renderer, o.css3Renderer = null);
                const t = pc.app.systems.collision.physicsWorld;
                t && t._triMeshCache && (t._triMeshCache.forEach((e => Ammo.destroy(e))), t._triMeshCache.clear()), n.settings && o.scenes.loadSceneSettings(l, (function(e) {
                    e && c && c.call(s, e)
                })), n.hierarchy && o.scenes.loadSceneHierarchy(l, (function(e, n) {
                    e ? c && c.call(s, e) : a = n
                })), e || o.scenes.unloadSceneData(l), c && c.call(s, null, a)
            }
        }))
    } else c && c.call(s, "Scene not found: " + e)
}
let scene_async_loading = !1;

function loadSceneAsync(e, n) {
    if (!scene_async_loading) return scene_async_loading = !0, new Promise((c => {
        loadScene(e, n, ((s, o) => {
            s ? (scene_async_loading = !1, console.error("loadScene Error:", e, n, s), c(!1)) : (scene_async_loading = !1, c(!0))
        }), this)
    }));
    console.error("loadSceneAsync already loading")
}
const AS_SOCKET_SERVER_API = "4",
    NetworkManagerSocketIO =

    // ======== clickToHighlight ========
    pc.createScript("clickToHighlight");
ClickToHighlight.attributes.add("playerEntity", {
    type: "entity",
    title: "PlayerEntity",
    description: "Entity from which the raycast is started, set to avoid clicking on own avatar"
}), ClickToHighlight.attributes.add("clickToGoMarker", {
    type: "entity",
    title: "Click to Go Marker",
    description: ""
}), ClickToHighlight.attributes.add("clickToGoCursor", {
    type: "entity",
    title: "Click to Go Cursor",
    description: ""
}), ClickToHighlight.prototype.initialize = function() {
    this.previous = void 0, this.app.touch && (this.app.touch.on(pc.EVENT_TOUCHSTART, this.touchStart, this), this.app.touch.on(pc.EVENT_TOUCHEND, this.touchEnd, this), this.app.touch.on(pc.EVENT_TOUCHMOVE, this.touchMove, this)), this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.mouseMove, this), this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.mouseDown, this), this.app.mouse.on(pc.EVENT_MOUSEUP, this.mouseUp, this), this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.mouseWheel, this), this.app.disableClickToWalk = new CallerStack;
    const onDrop = t => {
            this.app.disableSceneTouch.depth > 0 && !this.clickToPlayScreenShowing() || t.dataTransfer.types.includes("application/x-arrival-vibe") || (t.preventDefault(), this.downEntity && this.downEntity == this.doRaycastScreen(t) ? this.doRaycastScreen(t, {
                isDrop: !0
            }) : (ReactUI.updateCurrentSessionStore({
                isPlusMenuOpen: !1
            }), this.app.fire("overlay:pressed:uploadContent", t.dataTransfer.files[0], t.clientX, t.clientY), this.downEntity = null))
        },
        onDragOver = t => {
            this.app.disableSceneTouch.depth > 0 && !this.clickToPlayScreenShowing() || (t.preventDefault(), this.downEntity = this.doRaycastScreen(t), this.lastMouseMove = t, this.app.needsRedraw = !0)
        };
    document.addEventListener("drop", onDrop), document.addEventListener("dragover", onDragOver), this.app.on("overlay:clearHighlights", this.clearHighlight, this);
    const t = this;
    this.on("destroy", (() => {
        document.body.style.cursor = "auto", this.walkableHitListeners = void 0, t.app.touch && (t.app.touch.off(pc.EVENT_TOUCHSTART, t.touchStart, this), t.app.touch.off(pc.EVENT_TOUCHEND, t.touchEnd, this), t.app.touch.off(pc.EVENT_TOUCHMOVE, t.touchMove, this)), t.app.mouse.off(pc.EVENT_MOUSEMOVE, t.mouseMove, this), t.app.mouse.off(pc.EVENT_MOUSEDOWN, t.mouseDown, this), t.app.mouse.off(pc.EVENT_MOUSEUP, t.mouseUp, this), t.app.mouse.off(pc.EVENT_MOUSEWHEEL, t.mouseWheel, this), document.removeEventListener("drop", onDrop), document.removeEventListener("dragover", onDragOver), this.app.off("overlay:clearHighlights", this.clearHighlight, this)
    })), this.lastPlayerPos = this.playerEntity.getPosition().clone()
}, ClickToHighlight.prototype.clickToPlayScreenShowing = function() {
    return this._clickToPlayScreen || (this._clickToPlayScreen = this.app.root.findByName("ClicktToPlayScreen")), !!this._clickToPlayScreen?.enabled
}, ClickToHighlight.prototype.inputLocked = function() {
    return !this.app.loadTracker || !!this.app.loadTracker.loadingSpace
}, ClickToHighlight.prototype.setClickToGoCursor = function(t, i, e) {
    if (t && i) {
        const s = this.app.customTravelCenter.roomData.hideArchitecture ? 1e4 : 11;
        getXZDist(i) >= s && (t = !1, i = null, e = null)
    }
    if (this.walkableHoverListeners && this.walkableHoverListeners.length > 0) {
        this.walkableHoverListeners.some((s => s(t, i, e))) && (t = !1)
    }
    this.clickToGoCursor.enabled = t, i && this.clickToGoCursor.setPosition(i), e && this.clickToGoCursor.setLocalRotation(e)
}, ClickToHighlight.prototype.xrPointerMove = function(t, i, e) {
    if (!this.inputLocked()) {
        if (this.downEntity = this.doRaycastRay(t, i, e), this.downEntity || !this.lastHit || this.mouseIsDown || 0 != this.app.disableSceneTouch.depth) this.walkableHit = null;
        else if (this.walkableHit = this.app.systems.rigidbody.raycastFirst(t, i, {
                filterTags: ["walkable"]
            }), this.walkableHit && this.walkableHit.normal.y > .7 && 0 == this.app.disableClickToWalk.depth) {
            const t = (new pc.Vec3).cross(pc.Vec3.FORWARD, this.walkableHit.normal),
                i = (new pc.Mat4).setLookAt(new pc.Vec3, t, this.walkableHit.normal),
                e = new pc.Quat;
            e.setFromMat4(i), this.setClickToGoCursor(!0, this.walkableHit.point, e)
        } else this.walkableHit = null;
        return this.walkableHit || this.setClickToGoCursor(!1), this.downEntity
    }
}, ClickToHighlight.prototype.mouseMove = function(t) {
    if (this.walkableHit = null, !this.inputLocked())
        if (this.app.isPointerLocked) this.setClickToGoCursor(!1);
        else {
            if (!this.downEntity && this.mouseIsDown) return this.setClickToGoCursor(!1), void(this.mouseDownMoved = !0);
            if (this.downEntity?.script?.clickableRender?.draggable && this.mouseIsDown) this.downEntity.script.clickableRender.onDrag();
            else {
                if (this.pickerClaimsHover(t)) return this.downEntity = null, this.clearHighlight(), this.setClickToGoCursor(!1), void(this.lastMouseMove = t);
                if (this.downEntity = this.doRaycastScreen(t), this.lastMouseMove = t, this.downEntity || this.mouseIsDown || 0 != this.app.disableSceneTouch.depth) this.mouseIsDown || this.setClickToGoCursor(!1);
                else {
                    const i = this.entity.getPosition(),
                        e = this.entity.camera.screenToWorld(t.x, t.y, this.entity.camera.farClip);
                    if (this.walkableHit = this.app.systems.rigidbody.raycastFirst(i, e, {
                            filterTags: ["walkable"]
                        }), this.walkableHit && this.walkableHit.normal.y > .7 && 0 == this.app.disableClickToWalk.depth) {
                        const t = (new pc.Vec3).cross(pc.Vec3.FORWARD, this.walkableHit.normal),
                            i = (new pc.Mat4).setLookAt(new pc.Vec3, t, this.walkableHit.normal),
                            e = new pc.Quat;
                        e.setFromMat4(i), this.setClickToGoCursor(!0, this.walkableHit.point, e)
                    } else {
                        this.walkableHit = null;
                        const t = this._intersectWithVirtualPlane(i, e);
                        if (t) {
                            const i = pc.Quat.IDENTITY;
                            this.setClickToGoCursor(!0, t, i)
                        } else this.setClickToGoCursor(!1)
                    }
                }
            }
        }
}, ClickToHighlight.prototype.mouseDown = function(t) {
    this.inputLocked() || t.button == pc.MOUSEBUTTON_LEFT && (this.downEntity = this.pickerClaimsHover(t) ? null : this.doRaycastScreen(t, {
        isMouseDown: !0
    }), this.mouseIsDown = !0, this.mouseDownMoved = !1, this.mouseDownDisabledTouch = this.app.disableSceneTouch.depth > 0, this.mouseDownTime = new Date, this.mouseDownPos = {
        x: t.x,
        y: t.y
    })
};
const getXZDist = function(t) {
    return Math.sqrt(t.x * t.x + t.z * t.z)
};
ClickToHighlight.prototype.goToPosition = function(t, i) {
    if (this.walkableHitListeners && this.walkableHitListeners.length > 0) {
        if (this.walkableHitListeners.some((e => e(t, i)))) return void console.log("Walkable hit listener handled by listener, not moving player.")
    }
    this.clickToGoMarker.enabled = !0, this.clickToGoMarker.setPosition(t), i && this.clickToGoMarker.setRotation(i), this.app.fire("goToPosition", t), this.setClickToGoCursor(!1)
}, ClickToHighlight.prototype._intersectWithVirtualPlane = function(t, i) {
    if (this.app.customTravelCenter.groundCollision || !this.app.customTravelCenter.roomData.hideArchitecture) return null;
    const e = i.clone().sub(t).normalize(),
        s = this.app.customTravelCenter.lastGroundHit?.y ?? 0,
        o = e.y;
    if (Math.abs(o) > 1e-4) {
        const i = (s - t.y) / o;
        if (i > 0) {
            const s = t.clone().add(e.scale(i));
            if (getXZDist(s) < 1e4 && 0 == this.app.disableClickToWalk.depth) return s
        }
    }
    return null
}, ClickToHighlight.prototype.pickerClaimsClick = function(t) {
    const i = this.getPicker();
    return !!i?.claimClick && i.claimClick(t)
}, ClickToHighlight.prototype.getPicker = function() {
    return this.entity?.script?.pickerFramebuffer || this.app.root.findByName("Camera")?.script?.pickerFramebuffer
}, ClickToHighlight.prototype.pickerClaimsTouch = function(t) {
    const i = this.getPicker();
    return !!i?.claimTouchClick && i.claimTouchClick(t)
}, ClickToHighlight.prototype.pickerClaimsHover = function(t) {
    const i = this.getPicker();
    return !!i?.claimsHover && i.claimsHover(t)
}, ClickToHighlight.prototype.mouseUp = function(t) {
    if (this.inputLocked()) return;
    if (!this.app.customTravelCenter.roomData) return void console.error("!this.app.customTravelCenter.roomData");
    const i = this.app.customTravelCenter.roomData.hideArchitecture ? 1e4 : 11;
    if (this.downEntity && t.button === pc.MOUSEBUTTON_RIGHT && this.downEntity.script.clickableRender.onRightClick(), t.button == pc.MOUSEBUTTON_LEFT) {
        if (this.pickerClaimsClick(t)) this.downEntity = null, this.clearHighlight();
        else if (this.downEntity && this.downEntity == this.doRaycastScreen(t, {
                isMouseUp: !0
            })) this.doRaycastScreen(t, {
            isClick: !0
        });
        else if (this.mouseDownTime) {
            const e = (new Date).getTime() - this.mouseDownTime.getTime(),
                s = Math.abs(this.mouseDownPos.x - t.x) + Math.abs(this.mouseDownPos.y - t.y),
                o = e < 500 && s < 4;
            if (0 == this.app.disableSceneTouch.depth && o && !this.mouseDownDisabledTouch) {
                const e = this.entity.getPosition(),
                    s = this.entity.camera.screenToWorld(t.x, t.y, this.entity.camera.farClip);
                if (this.walkableHit = this.app.systems.rigidbody.raycastFirst(e, s, {
                        filterTags: ["walkable"]
                    }), this.walkableHit) {
                    if (getXZDist(this.walkableHit.point) < i && 0 == this.app.disableClickToWalk.depth) {
                        const t = this.walkableHit.point.clone(),
                            i = this.clickToGoCursor.getRotation();
                        this.goToPosition(t, i)
                    }
                } else {
                    const t = this._intersectWithVirtualPlane(e, s);
                    if (t) {
                        const i = pc.Quat.IDENTITY;
                        this.goToPosition(t, i)
                    }
                }
            }
            this.downEntity = null
        }
        this.mouseIsDown = !1, this.mouseDownMoved = !1
    }
}, ClickToHighlight.prototype.mouseWheel = function(t) {
    this.inputLocked() || (this.downEntity = this.doRaycastScreen(t, {
        isWheel: !0
    }))
}, ClickToHighlight.prototype.touchStart = function(t) {
    this.inputLocked() || t.touches.length > 1 || (this.touchStartTime = new Date, this.touchStartTouch = t.touches[0], this.doRaycastScreen(t.touches[0]))
}, ClickToHighlight.prototype.touchMove = function(t) {
    this.inputLocked() || t.touches.length > 1 || (this.touchStartTouch = null, this.clearHighlight())
}, ClickToHighlight.prototype.touchEnd = function(t) {
    if (this.inputLocked()) return;
    if (InputLocker.isPointerLocked()) return;
    if (t.touches.length > 0) return;
    if (!this.touchStartTouch) return void this.clearHighlight();
    if (new Date - this.touchStartTime > 200) return void this.clearHighlight();
    if (this.pickerClaimsTouch(this.touchStartTouch)) return t.event.preventDefault(), void this.clearHighlight();
    const i = this.doRaycastScreen(this.touchStartTouch, {
        isClick: !0
    });
    t.event.preventDefault(), !i && this.lastHit && this.lastHit.normal.y > .7 && 0 == this.app.disableSceneTouch.depth && this.lastHit.point.y < .15 && this.goToPosition(this.lastHit.point.clone())
}, ClickToHighlight.prototype.clearHighlight = function() {
    this.previous?.hitEntity && (this.previous.hitEntity.script?.clickableRender && this.previous.hitEntity.script.clickableRender.onTouchEnd(), this.app.fire("Ermis:objectOutline:remove", this.previous.highlightEntity), this.previous = void 0, document.body.style.cursor = "auto")
}, ClickToHighlight.prototype.doRaycastScreen = function(t, i, e) {
    if (this.app.disableSceneTouch.depth > 0) return this.previous && this.clearHighlight(), null;
    if (!this.entity.camera) return console.error("ClickToHighlight no camera set"), null;
    let s = null,
        o = null;
    this.app.isPointerLocked ? (o = this.playerEntity.getPosition().clone().add(this.entity.forward.clone().normalize().mulScalar(100)), o.y = this.playerEntity.getPosition().y, s = this.playerEntity.getPosition()) : (s = this.entity.getPosition(), o = this.entity.camera.screenToWorld(t.x, t.y, this.entity.camera.farClip));
    let l = o.clone().sub(s).normalize();
    return s = s.clone().add(l.clone().mulScalar(.3)), i?.isClick && t.event && t.event.preventDefault(), this.doRaycastRay(s, o, i, e, t)
}, ClickToHighlight.prototype._raycastBest = function(t, i, e) {
    const s = this.app.gizmo?.raycastRotateRings(t, i),
        o = this.app.systems.rigidbody.raycastAll(t, i, {
            sort: !0
        })?.filter((t => !t.entity.tags.has("click-through")));
    if (!o || 0 === o.length) return s ?? null;
    const l = ["gizmo-handle", "floating-button"];
    for (const i of l) {
        const e = o.find((t => t.entity.tags.has(i)));
        if (e) return s && ("gizmo-handle" !== i || s.distance < t.distance(e.point)) ? s : e
    }
    if (s) return s;
    if (e && e.length > 0) {
        const t = o.find((t => t.entity.tags.has(...e)));
        if (t) return t
    }
    return o[0]
}, ClickToHighlight.prototype.doRaycastRay = function(t, i, e, s, o) {
    this.lastHit = null;
    let l = this._raycastBest(t, i, s);
    if (!l) return this.clearHighlight(), null;
    let n = 1;
    for (; this.playerEntity && l.entity == this.playerEntity;) {
        const e = l.point.clone().add(i.clone().sub(t).normalize().mulScalar(.1));
        if (l = this.app.systems.rigidbody.raycastFirst(e, i), !l) return this.clearHighlight(), null;
        if (n++, n > 10) {
            console.warn("raycasts exceeded");
            break
        }
    }
    if (this.lastHit = l, !l.entity?.script?.clickableRender || !l.entity?.script?.clickableRender.enabled) return this.clearHighlight(), null;
    const a = l.point.distance(this.playerEntity.getPosition());
    if (this.app.isPointerLocked && a > l.entity.script.clickableRender.maxDistance) return this.clearHighlight(), null;
    if (l.entity.script.clickableRender.isDisabled()) return this.clearHighlight(), null;
    if (e?.isDrop) l.entity.script.clickableRender.onDrop(o);
    else if (e?.isClick) l.entity.script.clickableRender.onClick(l, o);
    else if (e?.isMouseDown) l.entity.script.clickableRender.onMouseDown(l, o);
    else if (e?.isMouseUp) l.entity.script.clickableRender.onMouseUp(l, o);
    else if (e?.isWheel) {
        const t = e.wheelDeltaY ?? o.event.deltaY;
        l.entity.script.clickableRender.onWheel({
            deltaY: t
        }, l)
    } else {
        const t = l.entity.script.clickableRender.onTouch(o, l);
        document.body.style.cursor = !1 !== t ? "pointer" : "auto"
    }
    let h = l.entity;
    return l.entity.script.clickableRender.highlightRender && (h = l.entity.script.clickableRender.highlightRender), l.entity.script.clickableRender.highlightOnTouch && this.app.fire("Ermis:objectOutline:add", h), this.previous?.hitEntity && this.previous.hitEntity.getGuid() !== l.entity.getGuid() && this.clearHighlight(), this.previous = {
        hitEntity: l.entity,
        highlightEntity: h
    }, l.entity
}, ClickToHighlight.prototype.addWalkableHitListener = function(t) {
    this.walkableHitListeners || (this.walkableHitListeners = []), this.walkableHitListeners.push(t)
}, ClickToHighlight.prototype.removeWalkableHitListener = function(t) {
    this.walkableHitListeners ? this.walkableHitListeners = this.walkableHitListeners.filter((i => i !== t)) : console.warn("No walkable hit listeners to remove")
}, ClickToHighlight.prototype.addWalkableHoverListener = function(t) {
    this.walkableHoverListeners || (this.walkableHoverListeners = []), this.walkableHoverListeners.push(t)
}, ClickToHighlight.prototype.removeWalkableHoverListener = function(t) {
    this.walkableHoverListeners ? this.walkableHoverListeners = this.walkableHoverListeners.filter((i => i !== t)) : console.warn("No walkable hit listeners to remove")
}, ClickToHighlight.prototype.update = function(t) {
    this.lastMouseMove && this.playerEntity.getPosition().distance(this.lastPlayerPos) > .1 && (this.doRaycastScreen(this.lastMouseMove), this.lastPlayerPos = this.playerEntity.getPosition().clone())
};
const collectRenders = (e, t = []) => {
    if (!e || !e.enabled) return t;
    "Hips" !== e.name && e.render && t.push(e.render);
    for (const i of e.children) collectRenders(i, t);
    return t
};
class ApplyOutline extends pc.ScriptType {
    initialize() {
        if (!this.entity.camera) return void console.error("ApplyOutline script must be attached to an Entity with a Camera component.");
        this.mainCameraComponent = this.entity.camera, this.num_objects_outlined = 0, this.outline_effect_active = !1;
        const e = "__outlineActive",
            getCameraFrameOutline = () => this.app.customTravelCenter?.cameraFrame?.outline ?? null,
            attachOutline = () => {
                const e = getCameraFrameOutline();
                if (e) e.maskTexture = this.texture, e.outlineColor.copy(this.color), e.thickness = this.thickness, e.enabled = !0;
                else if (this.outline) {
                    const e = this.mainCameraComponent.postEffects,
                        t = e.effects?.some((e => e.effect === this.outline));
                    t || e.addEffect(this.outline)
                } else console.warn("[outline-hdr] attachOutline: neither HDR pass nor LDR effect available");
                this.outline_effect_active = !0, this.outlineCamera && (this.outlineCamera.enabled = !0)
            },
            detachOutline = () => {
                const e = getCameraFrameOutline();
                if (e && (e.enabled = !1), this.outline) {
                    const e = this.mainCameraComponent.postEffects;
                    for (; e.effects?.some((e => e.effect === this.outline));) e.removeEffect(this.outline)
                }
                this.outline_effect_active = !1
            };
        this._getCameraFrameOutline = getCameraFrameOutline, this._attachOutline = attachOutline, this._detachOutline = detachOutline;
        const highlightElement = e => {
                e?.color && (e.preHighlightColor || (e.preHighlightColor = e.color.clone()), e.color = new pc.Color(e.preHighlightColor.r + .2, e.preHighlightColor.g + .2, e.preHighlightColor.b + .2, e.preHighlightColor.a))
            },
            unhighlightElement = e => {
                e.preHighlightColor && (e.color = e.preHighlightColor, e.preHighlightColor = null)
            };
        this.app.on("Ermis:objectOutline:add", (t => {
            if (!t) return;
            if (this.outlineCamera || this.prepare(), t.element && highlightElement(t.element), this.app.xr.active) return void(t.render ? (e => {
                if (!e.render) return;
                const setChildHighlight = e => {
                    if (e) {
                        for (const t of e.children) setChildHighlight(t);
                        if (e.element && highlightElement(e.element), e.render)
                            for (const t of e.render.meshInstances) {
                                if (t.highlightedMaterial) {
                                    t.material = t.highlightedMaterial;
                                    continue
                                }
                                t.originalMat = t.material;
                                const e = t.material.clone();
                                t.highlightedMaterial = e, e.emissive.r += .4, e.emissive.g += .4, e.emissive.b += 1, e.update(), t.material = e
                            }
                    }
                };
                setChildHighlight(e)
            })(t) : t.element || (t.preSelectScale || (t.preSelectScale = t.getLocalScale().clone()), t.setLocalScale(t.preSelectScale.clone().mulScalar(1.1))));
            if (t[e]) return;
            const i = collectRenders(t);
            if (i.length) {
                for (const e of i)
                    if (-1 === e.layers.indexOf(this.outlineLayer.id)) {
                        if (e.meshInstances.every((e => e.material))) {
                            const t = e.layers.slice();
                            t.push(this.outlineLayer.id), e.layers = t
                        } else console.warn("Skipping entity with missing materials:", t.name)
                    } this.num_objects_outlined++, t[e] = !0, this.outline_effect_active, attachOutline()
            }
        }), this), this.app.on("Ermis:objectOutline:disable", (() => {
            this.entity && this.outline_effect_active && (detachOutline(), this.app.needsRedraw = !0)
        }), this), this.app.on("Ermis:objectOutline:remove", (t => {
            if (!t) return;
            if (t.element && unhighlightElement(t.element), this.app.xr.active) return void(t.render ? (e => {
                if (!e.render) return;
                const setChildUnHighlight = e => {
                    if (e) {
                        for (const t of e.children) setChildUnHighlight(t);
                        if (e.element && unhighlightElement(e.element), e.render)
                            for (const t of e.render.meshInstances) t.originalMat && (t.material = t.originalMat)
                    }
                };
                setChildUnHighlight(e)
            })(t) : t.preSelectScale && (t.setLocalScale(t.preSelectScale), t.preSelectScale = null));
            if (!t[e]) return;
            const i = collectRenders(t);
            for (const e of i) {
                const t = e.layers.indexOf(this.outlineLayer.id);
                if (t > -1) {
                    const i = e.layers.slice();
                    i.splice(t, 1);
                    try {
                        e.layers = i
                    } catch (e) {
                        console.error("Failed to update layers:", e)
                    }
                }
            }
            this.num_objects_outlined--, t[e] = !1, this.num_objects_outlined <= 0 && this.outline_effect_active && (detachOutline(), this.num_objects_outlined = 0, this.releaseResources())
        }), this), this.on("destroy", (() => {
            this.app.off("Ermis:objectOutline:add"), this.app.off("Ermis:objectOutline:remove"), this.app.off("Ermis:objectOutline:disable"), window.removeEventListener("resize", this.onResize), window.removeEventListener("mouseout", this.onMouseLeave), window.removeEventListener("mouseover", this.onMouseEnter), this.releaseResources()
        }), this), this.onResize = this.onResize.bind(this), this.onMouseLeave = this.onMouseLeave.bind(this), this.onMouseEnter = this.onMouseEnter.bind(this), window.addEventListener("resize", this.onResize), window.addEventListener("mouseout", this.onMouseLeave), window.addEventListener("mouseover", this.onMouseEnter)
    }
    changeFOV(e) {
        this.outlineCamera && (this.outlineCamera.camera.fov = e)
    }
    releaseResources() {
        const e = this._getCameraFrameOutline?.();
        e && (e.enabled = !1, e.maskTexture = null), this.texture && (this.texture.destroy(), this.texture = null), this.renderTarget && (this.renderTarget.destroy(), this.renderTarget = null), this.outlineCamera && (this.outlineCamera.destroy(), this.outlineCamera = null, this.outlineCameraComponent = null), this.outlineLayer && (this.app.scene.layers?.remove(this.outlineLayer), this.app.scene.layerComposition?.remove(this.outlineLayer), this.outlineLayer = null), this.outline = null
    }
    prepare() {
        this.outlineLayer = new pc.Layer({
            name: "OutlineLayer"
        }), this.app.scene.layers.insert(this.outlineLayer, 0), this.outlineCamera = new pc.Entity("OutlineCamera"), this.outlineCamera.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0, 0),
            layers: [this.outlineLayer.id],
            priority: -1,
            fov: this.entity.camera.fov
        }), this.outlineCameraComponent = this.outlineCamera.camera, this.app.root.addChild(this.outlineCamera), this.outline = new OutlineEffect(this.app.graphicsDevice, this.thickness), this.outline.color.copy(this.color), this.onResize()
    }
    onMouseEnter(e) {
        e.relatedTarget && "IFRAME" !== e.relatedTarget.tagName || !this.outline_effect_active && this.num_objects_outlined > 0 && this.disabledDueToMouseLeave && (this.outlineCamera || this.prepare(), this._attachOutline(), this.disabledDueToMouseLeave = !1)
    }
    onMouseLeave(e) {
        const t = e.relatedTarget;
        t && "IFRAME" !== t.tagName || (this.app.fire("Ermis:objectOutline:disable"), this.disabledDueToMouseLeave = !0)
    }
    onResize() {
        if (!this.outlineCamera) return;
        this.texture && this.texture.destroy(), this.renderTarget && this.renderTarget.destroy(), this.texture = new pc.Texture(this.app.graphicsDevice, {
            width: this.app.graphicsDevice.width,
            height: this.app.graphicsDevice.height,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: !1,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            name: "outline-effect-texture"
        }), this.renderTarget = new pc.RenderTarget({
            colorBuffer: this.texture,
            depth: !0
        }), this.outlineCameraComponent && (this.outlineCameraComponent.renderTarget = this.renderTarget), this.outline && (this.outline.texture = this.texture);
        const e = this._getCameraFrameOutline?.();
        e && (e.maskTexture = this.texture)
    }
    postUpdate(e) {
        this.mainCameraComponent.enabled && this.outlineCamera && (this.outlineCamera.setPosition(this.entity.getPosition()), this.outlineCamera.setRotation(this.entity.getRotation()), this.outlineCameraComponent.projection = this.mainCameraComponent.projection, this.outlineCameraComponent.fov = this.mainCameraComponent.fov, this.outlineCameraComponent.orthoHeight = this.mainCameraComponent.orthoHeight, this.outlineCameraComponent.nearClip = this.mainCameraComponent.nearClip, this.outlineCameraComponent.farClip = this.mainCameraComponent.farClip)
    }
}
pc.registerScript(ApplyOutline, "applyOutline"), ApplyOutline.attributes.add("color", {
    type: "rgba"
}), ApplyOutline.attributes.add("thickness", {
    type: "number",
    default: 1,
    min: 1,
    max: 10,
    precision: 0,
    title: "Thickness"
});
class OutlineEffect extends pc.PostEffect {
    constructor(e, t) {
        super(e);
        const n = ["precision " + e.precision + " float;", "", `#define THICKNESS ${t.toFixed(0)}`, "uniform float uWidth;", "uniform float uHeight;", "uniform vec4 uOutlineCol;", "uniform sampler2D uColorBuffer;", "uniform sampler2D uOutlineTex;", "", "varying vec2 vUv0;", "", "void main(void)", "{", "    vec4 texel1 = texture2D(uColorBuffer, vUv0);", "    float sample0 = texture2D(uOutlineTex, vUv0).r > 0.0 ? 1.0 : 0.0;", "    float outline = 0.0;", "", "    // This loop checks if a pixel is on the border between object and background.", "    for (int x = -THICKNESS; x <= THICKNESS; x++)", "    {", "        for (int y = -THICKNESS; y <= THICKNESS; y++)", "        {", "            float neighborSample = texture2D(uOutlineTex, vUv0+vec2(float(x)/uWidth, float(y)/uHeight)).r > 0.0 ? 1.0 : 0.0;", "            if (neighborSample != sample0)", "            {", "                outline += 0.05 * 4.0 / float(THICKNESS);", "            }", "        }", "    }", "    outline += sample0 * 0.075; // Inner pixels get a boost so the fill is visible at low thickness", "", "    gl_FragColor = mix(texel1, uOutlineCol, min(1.0, outline) * uOutlineCol.a);", "}"].join("\n");
        if ("function" != typeof pc?.ShaderUtils?.createShader) return;
        const o = `\n            varying vUv0: vec2f;\n\n            uniform uWidth: f32;\n            uniform uHeight: f32;\n            uniform uOutlineCol: vec4f;\n\n            var uColorBuffer: texture_2d<f32>;\n            var uColorBufferSampler: sampler;\n            var uOutlineTex: texture_2d<f32>;\n            var uOutlineTexSampler: sampler;\n\n            @fragment\n            fn fragmentMain(input: FragmentInput) -> FragmentOutput {\n                var output: FragmentOutput;\n                let texel1 = textureSampleLevel(uColorBuffer, uColorBufferSampler, input.vUv0, 0.0);\n                let sample0: f32 = select(0.0, 1.0, textureSampleLevel(uOutlineTex, uOutlineTexSampler, input.vUv0, 0.0).r > 0.0);\n                var outline: f32 = 0.0;\n\n                // This loop checks if a pixel is on the border between object and background.\n                for (var x: i32 = -${t.toFixed(0)}; x <= ${t.toFixed(0)}; x = x + 1) {\n                    for (var y: i32 = -${t.toFixed(0)}; y <= ${t.toFixed(0)}; y = y + 1) {\n                        let uv = input.vUv0 + vec2f(f32(x) / uniform.uWidth, f32(y) / uniform.uHeight);\n                        let n: f32 = select(0.0, 1.0, textureSampleLevel(uOutlineTex, uOutlineTexSampler, uv, 0.0).r > 0.0);\n                        if (n != sample0) {\n                            outline = outline + 0.05 * 4.0 / f32(${t.toFixed(0)});\n                        }\n                    }\n                }\n                outline = outline + sample0 * 0.075; // Inner pixels get a boost so the fill is visible at low thickness\n\n                output.color = mix(texel1, uniform.uOutlineCol, min(1.0, outline) * uniform.uOutlineCol.a);\n                return output;\n            }\n        `;
        this.shader = pc.ShaderUtils.createShader(e, {
            uniqueName: "OutlineShader",
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
            },
            vertexGLSL: pc.PostEffect.quadVertexShader,
            vertexWGSL: "\n            attribute aPosition: vec2f;\n            varying vUv0: vec2f;\n\n            @vertex\n            fn vertexMain(input: VertexInput) -> VertexOutput {\n                var output: VertexOutput;\n                output.position = vec4f(input.aPosition, 0.0, 1.0);\n                let uv = (input.aPosition + vec2f(1.0)) * 0.5;\n                output.vUv0 = vec2f(uv.x, 1.0 - uv.y);\n                return output;\n            }\n        ",
            fragmentGLSL: n,
            fragmentWGSL: o
        }), this.color = new pc.Color(1, 1, 1, 1), this.texture = null, this._colorData = new Float32Array(4)
    }
    render(e, t, n) {
        if (!this.shader) return;
        const o = this.device.scope;
        o.resolve("uWidth").setValue(e.width), o.resolve("uHeight").setValue(e.height), this._colorData[0] = this.color.r, this._colorData[1] = this.color.g, this._colorData[2] = this.color.b, this._colorData[3] = this.color.a, o.resolve("uOutlineCol").setValue(this._colorData), o.resolve("uColorBuffer").setValue(e.colorBuffer), o.resolve("uOutlineTex").setValue(this.texture), t && !t.colorBuffer && (console.error("OutlineEffect: No output target color buffer available."), t = null), this.drawQuad(t, this.shader, n)
    }
}
const ClickableRender =

    // ======== clickableRender ========
    pc.createScript("clickableRender");
ClickableRender.attributes.add("maxDistance", {
    type: "number",
    default: 2,
    min: 0,
    title: "Max Distance (Avatar)"
}), ClickableRender.attributes.add("maxDistanceCursor", {
    type: "number",
    default: 1e5,
    min: 0,
    title: "Max Distance (Cursor)"
}), ClickableRender.attributes.add("highlightRender", {
    type: "entity",
    min: 0,
    title: "Render To Highlight"
}), ClickableRender.attributes.add("enableEntity", {
    type: "entity",
    min: 0,
    title: "Entity To Enable"
}), ClickableRender.attributes.add("highlightOnTouch", {
    type: "boolean",
    default: !0,
    title: "Highlight on Touch"
}), ClickableRender.attributes.add("capturesWheel", {
    type: "boolean",
    default: !1,
    title: "Captures Wheel"
}), ClickableRender.attributes.add("clickEventName", {
    type: "string",
    title: "On Click Event"
}), ClickableRender.attributes.add("doubleClickEventName", {
    type: "string",
    title: "On Double-Click Event"
}), ClickableRender.attributes.add("rightClickEventName", {
    type: "string",
    title: "On Right-Click Event"
}), ClickableRender.attributes.add("dragEventName", {
    type: "string",
    title: "On Drag Event"
}), ClickableRender.attributes.add("disabled", {
    type: "boolean",
    default: !1,
    title: "Disabled"
}), ClickableRender.attributes.add("enabledInXR", {
    type: "boolean",
    default: !1,
    title: "Enable in XR",
    description: "True if item should also be clickable in XR Mode"
}), ClickableRender.attributes.add("hideRenderNoOver", {
    type: "boolean",
    default: !1,
    title: "Hide Render No Over",
    description: "Hide Render when mouse is not over"
}), ClickableRender.attributes.add("draggable", {
    type: "boolean",
    default: !1,
    title: "Draggable",
    description: "Keeps the render highlighted when dragged, fires drag event"
}), ClickableRender.prototype.initialize = function() {
    this.hideRenderNoOver && (this.highlightRender.render.enabled = !1), this.on("enable", (() => {
        this.hideRenderNoOver && (this.highlightRender.render.enabled = !1)
    })), this.camera = this.app.root.findByName("Camera")
}, ClickableRender.prototype.update = function(e) {}, ClickableRender.prototype.isDisabled = function() {
    return !!this.disabled || !(!this.app.xr.active || this.enabledInXR)
}, ClickableRender.prototype.onDrag = function() {
    if (this.isDisabled()) return !1;
    this.dragEventName && this.app.fire(this.dragEventName)
}, ClickableRender.prototype.onClick = function(e, t) {
    if (this.isDisabled()) return !1;
    const i = t?.event?.detail;
    (this.doubleClickEventName || this.entity.onDoubleClickDelegate) && 2 === i ? (this.doubleClickEventName && this.app.fire(this.doubleClickEventName, this.entity), this.entity.onDoubleClickDelegate && this.entity.onDoubleClickDelegate(this.entity, e)) : (this.clickEventName && this.app.fire(this.clickEventName, this.entity), this.entity.onClickDelegate && this.entity.onClickDelegate(this.entity, e))
}, ClickableRender.prototype.onRightClick = function(e) {
    if (this.isDisabled()) return !1;
    this.rightClickEventName && this.app.fire(this.rightClickEventName, this.entity), this.entity.onRightClickDelegate && this.entity.onRightClickDelegate(this.entity)
}, ClickableRender.prototype.onDrop = function(e) {
    if (this.isDisabled()) return !1;
    this.entity.onDropDelegate && this.entity.onDropDelegate(this.entity, e)
}, ClickableRender.prototype.onTouch = function(e, t) {
    if (this.isDisabled()) return !1;
    let i = !0;
    if (this.entity.onTouchDelegate) {
        !1 === this.entity.onTouchDelegate(this.entity, e, t) && (i = !1)
    }
    return this.hideRenderNoOver && (this.highlightRender.render.enabled = !0), this.enableEntity && (this.enableEntity.enabled = !0), this.highlightOnTouch && this.camera.script.pickerFramebuffer.blockStackPush(this, !0), i
}, ClickableRender.prototype.onTouchEnd = function() {
    return !this.isDisabled() && (this.entity.onTouchEndDelegate && this.entity.onTouchEndDelegate(this.entity), this.hideRenderNoOver && (this.highlightRender.render.enabled = !1), this.enableEntity && (this.enableEntity.enabled = !1), this.highlightOnTouch && this.camera.script.pickerFramebuffer.blockStackPop(this), !0)
}, ClickableRender.prototype.onWheel = function(e, t) {
    if (this.isDisabled()) return !1;
    this.entity.onWheelDelegate && this.entity.onWheelDelegate(this.entity, e, t)
}, ClickableRender.prototype.onMouseDown = function(e, t) {
    if (this.isDisabled()) return !1;
    this.entity.onMouseDownDelegate && this.entity.onMouseDownDelegate(this.entity, e, t)
}, ClickableRender.prototype.onMouseUp = function(e, t) {
    if (this.isDisabled()) return !1;
    this.entity.onMouseUpDelegate && this.entity.onMouseUpDelegate(this.entity, e, t)
};
var Portal =

    // ======== annotationEntity ========
    pc.createScript("annotationEntity");
AnnotationEntity.ICON_BASE_SIZE_PX = 60, AnnotationEntity.ICON_REF_SIZE = DEFAULT_DISTANCE_SCALES[0][1], AnnotationEntity.prototype.onIntroCutsceneStarted = function({
    mode: t
}) {
    "playback" === t && (this.updateVisibility(!1), this.isIntroCutsceneActive = !0)
}, AnnotationEntity.prototype.onIntroCutsceneCompleted = function() {
    this.isIntroCutsceneActive = !1, this.updateVisibility()
}, AnnotationEntity.prototype.initialize = function() {
    this.entity.tags.add("floating-button"), this.isIntroCutsceneActive = !1, this.entity.onServerDataLoaded = this.onServerDataLoaded.bind(this), this.entity.on(ReactUI.EVENT.ENTITY_SET_VISIBILITY, this.setVisibility, this), this._onFolderVisibilityChanged = () => this.updateVisibility(), this.app.on(ReactUI.EVENT.FOLDER_VISIBILITY_CHANGED, this._onFolderVisibilityChanged, this), this.entity.on(ReactUI.EVENT.ENTITY_REMOVE_FROM_SCENE, this.onDelete, this), this.entity.on(ReactUI.EVENT.ENTITY_DUPLICATE, this.duplicate, this), this.app.on(ReactUI.EVENT.INTRO_CUTSCENE_STARTED, this.onIntroCutsceneStarted, this), this.app.on(ReactUI.EVENT.INTRO_CUTSCENE_COMPLETED, this.onIntroCutsceneCompleted, this), this.isEditing = null;
    const t = ReactUI.currentSessionStore.subscribe(((t, i) => {
            t.isEditingSpace !== i.isEditingSpace && (this.editing = t.isEditingSpace)
        })),
        i = ReactUI.useGizmoStore.subscribe(((t, i) => {
            t.isVisible !== i.isVisible && (this.gizmoActive = t.isVisible), t.target !== i.target && (this.gizmoTarget = t.target)
        })),
        e = ReactUI.useNavigationStore.subscribe(((t, i) => {
            const e = t.currentState.annotationEditorScreen?.script.id;
            null == e ? this.isEditing = null : e === this.id ? this.isEditing = !0 : this.isEditing = !1
        }));
    this.isEditable = this.app.userProfileData.isSpaceEditable(), this.model = this.entity.findByName("Model"), this.coreRender = this.model.findByName("Core"), this.markerVisualParts = this.model.findComponents("render").map((t => t.entity)).filter((t => t !== this.model)).map((t => ({
        entity: t,
        originalScale: t.getLocalScale().clone()
    })));
    const onDoubleClick = () => {
        this.isEditable && (this.onEditClicked(), this.app.fire(ReactUI.EVENT.ENTITY_SELECT, this.id))
    };
    this.model.onClickDelegate = () => {
        ReactUI.useNavigationStore.getState().currentState.annotationEditorScreen?.isOpen ?? !1 ? onDoubleClick() : this.uiHandle?.toggleOpen?.()
    }, this.model.onDoubleClickDelegate = onDoubleClick, this.model.onTouchDelegate = () => {
        this.app.isCameraDragging || this.uiHandle?.onMouseOverBubble?.()
    }, this.model.onTouchEndDelegate = () => {
        this.uiHandle?.onBubbleLeft?.()
    }, this.on("destroy", (() => {
        this.entity.off(ReactUI.EVENT.ENTITY_SET_VISIBILITY, this.setVisibility, this), this._onFolderVisibilityChanged && this.app.off(ReactUI.EVENT.FOLDER_VISIBILITY_CHANGED, this._onFolderVisibilityChanged, this), this.entity.off(ReactUI.EVENT.ENTITY_REMOVE_FROM_SCENE, this.onDelete, this), this.entity.off(ReactUI.EVENT.ENTITY_DUPLICATE, this.duplicate, this), this.app.off(ReactUI.EVENT.INTRO_CUTSCENE_STARTED, this.onIntroCutsceneStarted, this), this.app.off(ReactUI.EVENT.INTRO_CUTSCENE_COMPLETED, this.onIntroCutsceneCompleted, this);
        const n = ReactUI.currentSessionStore.getState();
        n.update({
            annotationScripts: n.annotationScripts.filter((t => t !== this))
        }), t(), i(), e(), this.movementController.destroy()
    })), this.originalCollisionRadius = this.model.collision.radius, this.camera = this.app.root.findByName("Camera").camera, this.playerEntity = this.app.root.findByName("CharacterController"), this.selecteMaterial = this.app.assets.find("AnnotationMaterial"), this.unselecteMaterial = this.app.assets.find("AnnotationMaterialUnselected")
}, AnnotationEntity.prototype.onEditClicked = function(t) {
    this.uiHandle?.toggleEdit?.(t), console.log("fire ENTITY_SELECT", this.id), this.onMoveButtonClicked()
}, AnnotationEntity.prototype.register = function(t) {
    this.uiHandle = t
}, AnnotationEntity.prototype.unregister = function(t) {
    this.uiHandle = null
}, AnnotationEntity.prototype.postInitialize = function() {
    const t = this.app.root.findByName("GizmoController").editManager,
        i = {
            target: this.entity,
            disableRotate: !0
        };
    this.movementController = new MovementController(this.entity, this, t, i, this, this);
    const e = ReactUI.currentSessionStore.getState(),
        n = ReactUI.useGizmoStore.getState();
    this.editing = e.isEditingSpace, this.gizmoActive = n.isVisible, this.gizmoTarget = n.target
}, AnnotationEntity.prototype.onServerDataLoaded = async function({
    id: t,
    data: i,
    state: e,
    type: n,
    room: o
}) {
    try {
        if (this.id || (this.id = t), this.id !== t) throw new Error("What!?!?! Different id? Impossible.");
        if ("AnnotationEntity" !== n) throw new Error("Type must be 'AnnotationEntity'.");
        this.roomName = o, await this.loadData(JSON.parse(i))
    } finally {
        this.app.loadTracker.onEntityLoaded(this.id, o)
    }
}, AnnotationEntity.prototype.loadData = async function(t) {
    this.data = t, this.entity.entityName = ui_utils.extractTextFromHtml(t?.htmlString || "") || "Annotation";
    let i = new pc.Vec3;
    t.position ? i = new pc.Vec3(t.position.x ?? 0, t.position.y ?? 0, t.position.z ?? 0) : console.warn("No position info for AnnotationEntity", t), this.app.sequenceEditor?.isDriving(this.id, "position") || this.entity.setPosition(i);
    const e = ReactUI.currentSessionStore.getState(),
        n = e.annotationScripts;
    Array.isArray(n) && !n.includes(this) ? e.update({
        annotationScripts: n.concat(this)
    }) : console.warn("Already loaded!", this), this.updateVisibility()
}, AnnotationEntity.prototype.onDelete = async function(t) {
    if (!t && !await ui_utils.confirm(ui_utils.t("overlay.edit-asset.delete-confirm-title"), ui_utils.t("overlay.annotation-entity.delete-annotation"), "warning", !1, "", ui_utils.t("overlay.userProfile.delete"), ui_utils.t("overlay.userProfile.cancel"), "top", !1)) return !1;
    const i = this.app.root.findByName("GateServer").script.gateServer;
    return i.deleteEntity(i.getRoomName(), this.id), this.movementController.isMoving() && this.movementController.finishMove(), this.entity.destroy(), !0
}, AnnotationEntity.prototype.onMoveStart = function(t, i) {
    this.movementController.isMoving() ? this.movementController.finishMove() : this.movementController.startMove()
}, AnnotationEntity.prototype.enablePhysics = function() {
    this.model.collision.enabled = !0
}, AnnotationEntity.prototype.disablePhysics = function() {
    this.model.collision.enabled = !1
}, AnnotationEntity.prototype._setPointerEvents = function(t) {
    if (!this.uiHandle) return;
    const {
        container: i
    } = this.uiHandle;
    i instanceof HTMLDivElement && (i.style.pointerEvents = t)
}, AnnotationEntity.prototype.enableInteraction = function() {
    this._setPointerEvents("auto")
}, AnnotationEntity.prototype.disableInteraction = function() {
    this._setPointerEvents("none")
}, AnnotationEntity.prototype.onMoveButtonClicked = function() {
    this.movementController.isMoving() ? this.movementController.finishMove() : this.movementController.startMove()
}, AnnotationEntity.prototype.moveFinished = function(t, i) {
    this.data.position = t, this.data.rotation = i, this.upload()
}, AnnotationEntity.prototype.debounceUpload = function(t) {
    this._debounceUploadTimeout && clearTimeout(this._debounceUploadTimeout), this._debounceUploadTimeout = setTimeout((async () => {
        await this.upload(), this._debounceUploadTimeout = null, console.log("Uploaded annotation entity"), t?.()
    }), 500)
}, AnnotationEntity.prototype.setVisibility = async function(t) {
    this.data.hidden = !t, this.updateVisibility(), this.debounceUpload()
}, AnnotationEntity.prototype.updateVisibility = function() {
    const t = this.app.customTravelCenter?.isAnyAncestorFolderHidden?.(this.data.folderId),
        i = !this.data.hidden && !t;
    this.isIntroCutsceneActive || (this.model && (i ? this._hiddenScale && (this.model.setLocalScale(this._hiddenScale), this._hiddenScale = null) : (this._hiddenScale || (this._hiddenScale = this.model.getLocalScale().clone()), this.model.setLocalScale(0, 0, 0))), this.uiHandle && this.uiHandle.container instanceof HTMLDivElement && (this.uiHandle.container.style.display = i ? "block" : "none"))
}, AnnotationEntity.prototype.save = async function(t, i) {
    return this.data.htmlString = t, this.data.editState = i, this.entity.entityName = ui_utils.extractTextFromHtml(t || "") || "Annotation", this.app.fire("reactui:updateHeaderTitle"), await this.upload()
}, AnnotationEntity.prototype.duplicate = async function() {
    let t = {
        ...this.data
    };
    t.position && delete t.position, t.id = Math.random().toString(36).substring(2, 15);
    const i = this.entity.getPosition().clone();
    return i.z += 1, await AnnotationEntity.create(this.app, i, t, this.entity.getParent())
}, AnnotationEntity.prototype.upload = async function() {
    try {
        const t = this.data || {},
            i = this.id,
            e = "AnnotationEntity",
            n = this.app.root.findByName("GateServer").script.gateServer;
        if (!await n.uploadEntityData(this.roomName, i, e, t, !0)) return !1;
        const o = this.entity;
        return n.entityIDs.has(i) ? console.assert(n.entityIDs.get(i) === o, "AnnotationEntity upload: id already exists but is not the same gate") : n.entityIDs.set(i, o), this.app.userProfileData.logEvent("uploadAnnotationEntity", JSON.stringify({
            room: this.app.loadSceneParameter.room,
            entityId: i
        })), !0
    } catch (t) {
        return console.error(t), ui_utils.alertError("Error", "Failed to upload annotation entity data."), !1
    }
}, AnnotationEntity.prototype.previewGlobalSizeFar = function(t, i) {
    this.app.customTravelCenter.roomData.annotationScales = [
        [0, t],
        [i, 0]
    ]
}, AnnotationEntity.prototype.setGlobalSizeFar = function(t, i) {
    this.app.fire("centerasset:editRoomData", {
        annotationScales: [
            [0, t],
            [i, 0]
        ]
    })
}, AnnotationEntity.prototype.setInstanceSettings = function(t) {
    this.data = {
        ...this.data,
        ...t
    }, t.uiAnchor && this.fire("annotation:update"), ("openByDistance" in t || "triggerDistance" in t) && (this._wasInRange = !1), this.fire("annotation:settings-update"), this.upload()
}, AnnotationEntity.prototype.getScales = function() {
    const t = this.app.customTravelCenter?.roomData?.annotationScales || DEFAULT_DISTANCE_SCALES;
    return t.length < 2 ? DEFAULT_DISTANCE_SCALES : t
}, AnnotationEntity.prototype.getSimplifiedScales = function() {
    const t = this.getScales();
    return {
        size: t[0][1],
        far: t[t.length - 1][0]
    }
}, AnnotationEntity.prototype.update = function(t) {
    const i = this.app.customTravelCenter?.isAnyAncestorFolderHidden?.(this.data?.folderId);
    if (!(!this.data?.hidden && !i && !this.isIntroCutsceneActive)) return this.model && this.model.setLocalScale(0, 0, 0), void(this.uiHandle?.container instanceof HTMLDivElement && (this.uiHandle.container.style.display = "none"));
    const e = this.entity.getPosition(),
        n = e.distance(this.camera.entity.getPosition()),
        o = this.data?.fixedScreenSize ? this.getFixedScreenScale(n) : getSizeByDistance(this.getScales(), n),
        a = !!this.data?.hideButton;
    if (a ? this.model.setLocalScale(0, 0, 0) : this.updateModel(o), this.animateCore(t), !a) {
        const t = !!this.data?.icon;
        for (const {
                entity: i,
                originalScale: e
            }
            of this.markerVisualParts) t ? i.setLocalScale(0, 0, 0) : i !== this.coreRender && i.setLocalScale(e)
    }
    this.updateHtml(this.camera, e, o, n);
    const s = this.playerEntity ? e.distance(this.playerEntity.getPosition()) : n;
    this.updateAutoOpen(s), this.drawTriggerRadius()
}, AnnotationEntity.prototype.drawTriggerRadius = function() {
    if (!0 !== this.isEditing || !this.data?.openByDistance) return;
    const t = this.data.triggerDistance ?? AnnotationEntity.DEFAULT_TRIGGER_DISTANCE,
        i = 360 / Math.min(40, Math.round(t * Math.PI * 6)),
        e = [],
        n = this.entity.getPosition();
    for (let o = 0; o < 360; o += i) {
        const a = pc.math.DEG_TO_RAD * o,
            s = pc.math.DEG_TO_RAD * (o + i);
        e.push(n.x + t * Math.cos(a), n.y, n.z + t * Math.sin(a)), e.push(n.x + t * Math.cos(s), n.y, n.z + t * Math.sin(s))
    }
    this.app.drawLineArrays(e, new pc.Color(.5, .8, 1), !1)
}, AnnotationEntity.FIXED_SCREEN_REF_DISTANCE = 5, AnnotationEntity.prototype.getFixedScreenScale = function(t) {
    const {
        size: i
    } = this.getSimplifiedScales();
    return i * (t / AnnotationEntity.FIXED_SCREEN_REF_DISTANCE)
}, AnnotationEntity.DEFAULT_TRIGGER_DISTANCE = 5, AnnotationEntity.prototype.updateAutoOpen = function(t) {
    if (!this.data?.openByDistance) return void(this._wasInRange && (this._wasInRange = !1, this.uiHandle?.setAutoOpen?.(!1)));
    const i = t <= (this.data.triggerDistance ?? AnnotationEntity.DEFAULT_TRIGGER_DISTANCE);
    i !== this._wasInRange && (this._wasInRange = i, this.uiHandle?.setAutoOpen?.(i))
}, AnnotationEntity.prototype.updateModel = function(t) {
    const i = new pc.Vec3;
    i.x = .25 * t / 4, i.y = .06 * t / 4, i.z = .25 * t / 4, this.model.collision.radius = this.originalCollisionRadius * t / 4, this.model.setLocalScale(i)
}, AnnotationEntity.CLOSED_CORE_SCALE = .7, AnnotationEntity.OPEN_CORE_SCALE = .9, AnnotationEntity.ANIM_SPEED = 2, AnnotationEntity.prototype.animateCore = function(t) {
    const i = this.uiHandle?.isLockedOpen;
    this._coreScale || (this._coreScale = i ? AnnotationEntity.OPEN_CORE_SCALE : AnnotationEntity.CLOSED_CORE_SCALE);
    const e = i ? 1 : -1,
        n = AnnotationEntity.ANIM_SPEED * t * e,
        o = this._coreScale + n;
    if (this._coreScale = Math.max(AnnotationEntity.CLOSED_CORE_SCALE, Math.min(AnnotationEntity.OPEN_CORE_SCALE, o)), this.coreRender.setLocalScale(this._coreScale, 1, this._coreScale), i && this.coreMaterial !== this.selecteMaterial) {
        for (const t of this.coreRender.render.meshInstances) t.material = this.selecteMaterial.resource;
        this.coreMaterial = this.selecteMaterial
    } else if (!i && this.coreMaterial !== this.unselecteMaterial) {
        for (const t of this.coreRender.render.meshInstances) t.material = this.unselecteMaterial.resource;
        this.coreMaterial = this.unselecteMaterial
    }
}, AnnotationEntity.prototype.updateHtml = function(t, i, e, n) {
    if (!this.uiHandle) return;
    const {
        container: o,
        bubble: a,
        icon: s,
        onUpdate: r,
        content: l
    } = this.uiHandle;
    if (o instanceof HTMLDivElement) {
        if (t.viewMatrix.transformPoint(i).z > 0) return void(o.style.display = "none");
        if (!(this.uiHandle?.isOpen && this.uiHandle?.isEditing) && e < 1e-4) return void(o.style.display = "none");
        o.style.display = "block";
        const c = t.worldToScreen(i),
            h = !this.data?.hideButton && !!this.data?.icon,
            d = this.data?.fixedScreenSize ? this.getSimplifiedScales().size / AnnotationEntity.ICON_REF_SIZE : e / AnnotationEntity.ICON_REF_SIZE;
        s instanceof HTMLDivElement && (s.style.left = `${c.x}px`, s.style.top = `${c.y}px`, s.style.transform = `translate(-50%, -50%) scale(${d})`);
        let p = Math.min(1e3, Math.ceil(1 / n * 100));
        switch (this.isEditing) {
            case !0:
                p = 1;
                break;
            case !1:
                p = 0
        }
        if (a instanceof HTMLDivElement) {
            a.style.zIndex = p;
            const i = this.data.uiAnchor || "bottom";
            let e;
            if (h) {
                const t = AnnotationEntity.ICON_BASE_SIZE_PX / 2 * d;
                switch (e = {
                        x: c.x,
                        y: c.y
                    }, i) {
                    case "top":
                        e.y -= t;
                        break;
                    case "left":
                        e.x -= t;
                        break;
                    case "right":
                        e.x += t;
                        break;
                    default:
                        e.y += t
                }
            } else {
                let n = "UIAnchorBottom";
                switch (i) {
                    case "top":
                        n = "UIAnchorTop";
                        break;
                    case "left":
                        n = "UIAnchorLeft";
                        break;
                    case "right":
                        n = "UIAnchorRight";
                        break;
                    default:
                        n = "UIAnchorBottom"
                }
                const o = this.entity.findByName(n).getPosition();
                e = t.worldToScreen(o)
            }
            a.style.transform = `translate(${e.x}px, ${e.y}px)`
        }
        l instanceof HTMLDivElement && (l.style.zIndex = p + 1e3), r && r()
    }
}, AnnotationEntity.create = async function(t, i, e = {}, n) {
    const o = t.root.findByName("GateServer").script.gateServer.entityTemplates.get("AnnotationEntity").clone();
    o.enabled = !0;
    const a = o.script.annotationEntity;
    a.id = Math.random().toString(36).substring(2, 15), n ? n.addChild(o) : t.root.addChild(o);
    const s = {
        position: {
            x: i.x,
            y: i.y,
            z: i.z
        },
        ...e
    };
    return a.data = s, await a.upload(), await a.loadData(a.data), o
};
const AS_SESSION = "session_" + new Date(Date.now()).toISOString().split("T")[0] + "_" + Math.random().toString(24).substring(3);
class LoadingStateTracker {
    constructor(e) {
        this.app = e, this.data = new Map, this.loadSeq = 0
    }
    initialize(e, t) {
        this.#e("Initializing for room: ", e), this.data.set(e, {
            entitiesLoaded: !1,
            entitiesCreated: !1,
            sceneCollisionLoading: new Set,
            spaceLoaded: !1,
            entities: new Map,
            loaded: new Set,
            startTime: Date.now(),
            loadInfo: new Map,
            entityWeights: new Map,
            loadReason: t,
            completed: !1
        })
    }
    #t(e) {
        if (!this.app.agentInspect) return;
        const t = "agent-inspect-load-marker";
        if (document.getElementById(t)?.remove(), !e) return;
        const a = document.createElement("div");
        a.id = t, a.textContent = "arrival-space-load-done", a.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;", document.body.appendChild(a)
    }
    #e(...e) {
        CoreLib.Logger.log("loading-state", ...e)
    }
    #a() {
        return "load_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
    }
    #o(e, t, a) {
        try {
            if (this.app.userProfileData.isIncognito()) return;
            this.app.userProfileData.logEvent(e, JSON.stringify({
                room: t,
                ...a
            }))
        } catch (e) {}
    }
    #i() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || null
        } catch (e) {
            return null
        }
    }
    #n() {
        try {
            return {
                ua: navigator.userAgent,
                gpu: this.app.graphicsDevice?.unmaskedRenderer ?? null,
                screenW: window.screen?.width ?? null,
                screenH: window.screen?.height ?? null,
                dpr: window.devicePixelRatio ?? null,
                touch: !!this.app.touch,
                xr: !!this.app.xr?.supported,
                embedded: window !== window.parent
            }
        } catch (e) {
            return null
        }
    }
    #s() {
        try {
            const e = performance.memory;
            return {
                usedJSHeapSize: e?.usedJSHeapSize ?? null,
                totalJSHeapSize: e?.totalJSHeapSize ?? null,
                jsHeapSizeLimit: e?.jsHeapSizeLimit ?? null,
                deviceMemory: navigator.deviceMemory ?? null
            }
        } catch (e) {
            return null
        }
    }
    #r(e, t) {
        try {
            if (this.app.natsHostCaptureMode) return;
            const a = 1500,
                o = performance.now();
            let i = o,
                n = 0,
                s = 0;
            const tick = () => {
                const r = performance.now(),
                    d = r - i;
                if (d > s && (s = d), i = r, n++, r - o < a) return void requestAnimationFrame(tick);
                const l = r - o;
                this.#o("space_load_fps", e, {
                    loadId: t.loadId,
                    fps: l > 0 ? Math.round(n / l * 1e3) : null,
                    minFps: s > 0 ? Math.round(1e3 / s) : null,
                    sampleMs: Math.round(l),
                    frames: n
                })
            };
            requestAnimationFrame(tick)
        } catch (e) {}
    }
    #d(e) {
        let t = null;
        try {
            const e = this.app.root.findByName("ScreenshotEntity")?.script?.screenshotEntity;
            t = e?.getGSplatPendingCount?.() ?? null
        } catch (e) {
            t = null
        }
        return {
            entitiesCreated: !!e.entitiesCreated,
            entitiesLoaded: !!e.entitiesLoaded,
            spaceLoaded: !!e.spaceLoaded,
            loaded: e.loaded?.size ?? 0,
            total: e.entities?.size ?? 0,
            collisionPending: e.sceneCollisionLoading?.size ?? 0,
            gsplatPending: t,
            progress: this.progress ?? null
        }
    }
    #l(e, t, a) {
        try {
            if (this.data.get(t) !== a) return;
            const o = Date.now() - a.startTime;
            let i = window.__arrivalReady;
            i || (i = {
                loaded: !1,
                interactive: !1
            }, window.__arrivalReady = i), i.loadId = a.loadId ?? null, i.room = t, i.loadReason = a.loadReason ?? null, i.sessionLoad = this.app.numSessionLoads ?? null, i.at = Date.now(), "interactive" === e ? (i.interactive = !0, i.interactiveMs = o) : (i.loaded = !0, i.durationMs = o, i.sinceNavigationMs = performance.now());
            try {
                performance.mark("arrival:scene-" + e), "loaded" === e && performance.measure("arrival:space-load", {
                    start: a.startTime - performance.timeOrigin,
                    end: "arrival:scene-loaded"
                })
            } catch (e) {}
            window.dispatchEvent(new CustomEvent("arrival:scene-" + e, {
                detail: {
                    ...i
                }
            }))
        } catch (e) {}
    }
    #c(e, t) {
        try {
            const a = {
                loaded: !1,
                interactive: !1
            };
            a.loadId = t.loadId ?? null, a.room = e, a.loadReason = t.loadReason ?? null, a.sessionLoad = this.app.numSessionLoads ?? null, a.durationMs = null, a.interactiveMs = null, a.sinceNavigationMs = null, a.at = Date.now(), window.__arrivalReady = a
        } catch (e) {}
    }
    async #p(e) {
        let t;
        const a = 81920;
        try {
            t = JSON.parse(e.data)
        } catch (e) {
            return a
        }
        let o, i;
        switch (e.type) {
            case "UserModelEntity":
                o = t.glbUrl;
                break;
            case "CustomSoundEntity":
            case "RecordedAvatar":
                o = t.audioUrl;
                break;
            default:
                o = null
        }
        if (!o) return a;
        try {
            i = await net_utils.fetchFileSize(o)
        } catch (e) {
            return a
        }
        return i ? Number(i) : a
    }
    async #g(e, t) {
        let a = 0;
        for (const [o, i] of e.entities) {
            if (JSON.parse(i.data).hidden) continue;
            let e = 0;
            t.has(o) ? e = t.get(o) : (e = await this.#p(i), t.set(o, e)), a += e
        }
        for (const [o, i] of t) {
            const t = a > 0 ? i / a : 1 / e.entities.size;
            e.entityWeights.set(o, t)
        }
        this.#e("Calculated entity weights for", e.entities.size, "entities with total size", Math.round(a / 1024), "KB")
    }
    setLoadingState() {
        if (this.#e("Show space loading screen"), this.loadScreenVisible) return void CoreLib.Logger.warn("loading-state", "Hmm?? already loading...");
        this.loadScreenVisible = !0;
        const e = document.createElement("div");
        e.style.position = "absolute", e.style.inset = "0", e.style.whiteSpace = "pre-wrap", this._loadingDisplayDiv = e, document.body.append(e);
        !this.app.numSessionLoads || this.app?.crossSpaceLoader?.showLoader(), this.app.root.findByName("UI Game Overlay").enabled = !1, this.app.gameSettings && (this.app.gameSettings.gfx_suspend_rendering = !1), ReactUI.spaceOverlayManager.hide()
    }
    unsetLoadingState(e) {
        this.#e("Unset loading state for room", e), this.loadScreenVisible ? (this.loadScreenVisible = !1, this._loadingDisplayDiv.remove(), this.app.root.findByName("GateLoadingScreen").enabled = !1, this.app.root.findByName("GateLoadingScreenSmall").enabled = !1, this.app.root.findByName("UI Game Overlay").enabled = !0, ReactUI.spaceOverlayManager.show(), this.#e("Loading state unset.")) : CoreLib.Logger.warn("loading-state", "Hmm??, wasn't loading... ")
    }
    async #h() {
        const e = this.app.root.findByName("ScreenshotEntity");
        if (e?.script?.screenshotEntity) try {
            const t = e.script.screenshotEntity;
            await new Promise((e => setTimeout(e, 0)));
            const a = t.getGSplatPendingCount();
            if (a > 0) {
                let e = a,
                    o = a,
                    i = 0;
                const n = Math.min(70, this.progress),
                    s = 100 - n,
                    r = setInterval((() => {
                        const a = t.getGSplatPendingCount(),
                            r = Math.max(0, o - a);
                        i += r, o = a, a + i > e && (e = a + i);
                        const d = Math.min(1, Math.max(0, i / e)),
                            l = n + d * s;
                        this.#u({
                            gsplatLoading: !0,
                            progress: l,
                            pending: a,
                            loaded: i
                        })
                    }), 150);
                await t.waitForGSplatLoaded(!this.app.natsHostCaptureMode), clearInterval(r)
            } else await t.waitForGSplatLoaded(!this.app.natsHostCaptureMode);
            this.#u({
                gsplatLoading: !0,
                progress: 100,
                pending: 0
            })
        } catch (e) {
            console.error("=== Error waiting for gsplats:", e)
        } else console.log("=== No ScreenshotEntity found, skipping LOD wait")
    }
    async #m(e) {
        const t = this.data.get(e);
        if (this.loadingSpace !== e || !t || t.completed) return;
        const a = this.loadSeq;
        if (this.loadingSpace = !1, CoreLib.Logger.debug("loading-state", "load-tracker:complete"), this.app.fire("load-tracker:complete"), t) {
            for (const e of t.loadInfo) {
                const a = e[0],
                    o = e[1].finishedTime ? e[1].finishedTime - t.startTime : null,
                    i = t.entities.get(a);
                o && this.#e("Entity load duration: ", Math.round(o / 100) / 10, "seconds", i.type, a)
            }
            const o = Date.now() - t.startTime;
            this.#e("Total load duration: ", Math.round(o / 100) / 10, "seconds.");
            if (!1 !== this.app.customTravelCenter?.roomData?.waitForLODLoaded) {
                t.inLodWait = !0;
                try {
                    await this.#h()
                } finally {
                    t.inLodWait = !1
                }
            }
            if (clearTimeout(t.watchdog), t.completed = !0, this.#o("space_load_complete", e, {
                    loadId: t.loadId,
                    durationMs: Date.now() - t.startTime,
                    interactiveMs: t.interactiveMs ?? null,
                    sinceNavigationMs: Math.round(performance.now()),
                    interactiveSinceNavigationMs: t.interactiveSinceNavMs ?? null,
                    preBootMs: Math.round(t.startTime - performance.timeOrigin),
                    memory: this.#s(),
                    entities: t.entities.size
                }), a !== this.loadSeq) return void this.#e("Load of", e, "superseded during LOD wait; not hiding the loader.");
            this.#l("loaded", e, t), this.#t(!0), this.app?.crossSpaceLoader?.hideLoader(), this.app.fire("hideLoadingScreen"), this.#r(e, t)
        } else console.error("#onSpaceReady no track data. Room name: ", e)
    }
    #f(e) {
        const t = this.data.get(e);
        if (!t) throw new Error("[#onSpaceReady] This room wasn't tracked: " + e);
        if (t.ready) return;
        t.ready = !0, t.interactiveMs = Date.now() - t.startTime, t.interactiveSinceNavMs = Math.round(performance.now()), CoreLib.Logger.debug("loading-state", "load-tracker:ready"), this.app.fire("load-tracker:ready"), this.#l("interactive", e, t), this.app.game.setupGame(), this.unsetLoadingState(e), this.app.customTravelCenter.updateUIVisibility(this.app.customTravelCenter.roomData), this.app.customTravelCenter.onSpaceReady(), this.app.root.findByName("NetworkManager").script.networkManagerSocketIO.connectToServer(), this.app.agentInspect || this.app.loadSceneParameter?.skipVisitLog || this.#L(e, t);
        let a = this.app.userProfileData.serverConfig?.showAlertUIText;
        if (a || !window.location.hostname.startsWith("staging.") || this.app.natsHostCaptureMode || this.app.userProfileData.viewOnlyMode() || (a = "PRE-RELEASE - STAGING"), a && !document.querySelector("[data-staging-banner]")) {
            const e = document.createElement("div");
            e.setAttribute("data-staging-banner", "true"), e.style.position = "absolute", e.style.top = "8px", e.style.left = "50%", e.style.transform = "translateX(-50%)", e.style.padding = "10px 10px", e.style.backgroundColor = "rgba(255, 0, 0, 0.2)", e.style.color = "white", e.style.fontSize = "14px", e.style.lineHeight = "1.4", e.style.textAlign = "center", e.style.zIndex = "1000", e.style.borderRadius = "32px", e.style.boxSizing = "border-box", e.style.width = "fit-content", e.style.maxWidth = "calc(100vw - 32px)", e.style.whiteSpace = "normal", e.style.overflowWrap = "anywhere", e.innerHTML = a + ' <span style="margin-left:8px; cursor:pointer;">✖</span>', document.body.appendChild(e), e.querySelector("span").addEventListener("click", (t => {
                t.stopPropagation(), t.preventDefault(), e.remove()
            }))
        }
    }
    #L(e, t) {
        if (this.app.userProfileData.isIncognito()) return;
        const a = this.app.game.getGameSettings();
        a.numTotalLoads ? a.numTotalLoads++ : a.numTotalLoads = 1, this.app.game.setGameSettings(a), this.app.userProfileData.visitSpace(this.app.loadSceneParameter.room);
        const o = {
            user: this.app.userProfileData.userID,
            loadReason: t.loadReason
        };
        if (this.app.userProfileData.logEventID("room_visit", this.app.loadSceneParameter.room, JSON.stringify(o), !0).then((async e => {
                this.app.networkManager.sendDirectMessage(this.app.customTravelCenter.owner.id, "Notification:Visit", o)
            })), 1 == this.app.numSessionLoads) {
            o.isRegistered = this.app.userProfileData.isRegistered(), o.appVersion = this.app.appVersionBuildString, o.appUrl = encodeURIComponent(window.location.origin + window.location.pathname + document.location.search), o.isEmbedded = !!window.frameElement || window !== window.parent, o.hasTouchDevice = !!this.app.touch, o.userAgent = encodeURIComponent(navigator.userAgent), o.clientWidth = document.documentElement.clientWidth, o.clientHeight = document.documentElement.clientHeight, o.xrSupported = this.app.xr?.supported, o.xrActive = this.app.xr?.active, o.devicePixelRatio = window.devicePixelRatio, o.screenWidth = window.screen.width, o.screenHeight = window.screen.height, o.graphicsDeviceName = pc.app.graphicsDevice.unmaskedRenderer, o.vram = pc.app.graphicsDevice._vram;
            const e = this.app.game.getGameSettings();
            o.gfx_posteffects = e.gfx_posteffects, o.gfx_shadows = e.gfx_shadows, o.gfx_antialiasing = e.gfx_antialiasing, o.gfx_retina = e.gfx_retina, o.camera_view = e.camera_view, o.micEnabled = e.audio_mic_enabled, o.numTotalLoads = e.numTotalLoads, o.browserLanguage = navigator.language, o.referrer = document.referrer, o.userLanguages = navigator.languages?.join(","), o.timeZone = (() => {
                try {
                    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
                } catch (e) {
                    return null
                }
            })(), this.app.userProfileData.logEventID("room_visit_initial", this.app.loadSceneParameter.room, JSON.stringify(o), !0).then((e => {
                this.app.sessionEventID = e
            }))
        }
        if (!0 === window.arrivalGoogleAnalyticsEnabled && "function" == typeof window.gtag) {
            const t = {
                page_location: window.location.href,
                page_path: pc.app.loadSceneParameter.room,
                page_title: e,
                user_id: this.app.userProfileData.userID
            };
            console.log("gtag", t), window.gtag("event", "page_view", t)
        }
    }
    trackEntity(e, t, a) {
        this.#e("Tracking entity", t, "for room", e);
        const o = this.data.get(e);
        if (!o) throw new Error("[loading-state-tracker] trackEntity could not find data! room: " + e);
        o.entities.has(t) && CoreLib.Logger.error("loading-state", "Entity with id", t, "already exists."), o.entities.set(t, a)
    }
    async setEntitiesCreated(e) {
        this.#e("Created entities for room, ", e);
        const t = this.data.get(e),
            a = this.app.customTravelCenter.roomInfo,
            o = JSON.parse(a?.state),
            i = new Map(Object.entries(o.entitySizes || {}));
        if (!t) throw new Error("[loading-state-tracker] setEntitiesCreated could not find data! room: " + e);
        t.entitiesCreated = !0, await this.#g(t, i), this.app.fire("scene:entitiesCreated"), this.onLoadStateChange(e)
    }
    setEntitiesLoaded(e) {
        this.#e("All entities loaded! Room: ", e);
        const t = this.data.get(e);
        if (!t) throw new Error("[loading-state-tracker] setEntitiesLoaded could not find data! room: " + e);
        if (t.entitiesLoaded = !0, t.loaded.size !== t.entities.size) {
            CoreLib.Logger.warn("loading-state", "Mismatch in loaded count! Maybe some loading failed or the entity type doesn't report loading status correctly!", t.loaded.size, "/", t.entities.size);
            for (const e of t.entities) {
                const a = e[0];
                t.loaded.has(a) || this.#e(e)
            }
        }
        this.app.fire("scene:entitiesLoaded"), this.onLoadStateChange(e)
    }
    onEntityLoaded(e, t) {
        this.#e("Entity", e, "from room", t, "reports finished loading.");
        const a = this.data.get(t);
        if (!a) throw new Error("[loading-state-tracker] onEntityLoaded could not find data! room: " + t);
        if (a.loaded?.has(e)) CoreLib.Logger.warn("loading-state", "onEntityLoaded was called more than once by: ", e);
        else if (a?.entitiesLoaded && CoreLib.Logger.warn("loading-state", "Entity reported being loaded after the global load event was fired", e), a.entities?.has(e)) {
            a.loaded.add(e), this.#e("Loaded entities: ", a.loaded.size, "/", a.entities.size, a.entities.get(e).type);
            const t = a.loadInfo.get(e) ?? {};
            t.finishedTime = Date.now(), t.progress = 1, a.loadInfo.set(e, t), this.#u(a)
        } else CoreLib.Logger.error("loading-state", "Loaded entity ", e, " that wasn't registered!")
    }
    pushSceneCollisionLoading(e, t) {
        const a = this.data.get(e);
        if (!a) throw new Error("[loading-state-tracker] sceneCollisionLoading could not find data! room: " + e);
        if (!t) throw new Error("Invalid id: " + t);
        this.#e("pushSceneCollisionLoading", t), a.sceneCollisionLoading.add(t), this.onLoadStateChange(e)
    }
    popSceneCollisionLoading(e, t) {
        const a = this.data.get(e);
        if (!a) throw new Error("[loading-state-tracker] sceneCollisionLoading could not find data! room: " + e);
        this.#e("popSceneCollisionLoading", t);
        a.sceneCollisionLoading.delete(t) || CoreLib.Logger.warn("loading-state", "popSceneCollisionLoading, id was never pushed!", t);
        this.onLoadStateChange(e)
    }
    onEntityProgress(e, t) {
        if (this.#e("onEntityProgress", e, t), !this.loadingSpace) return void CoreLib.Logger.debug("loading-state", "Received onEntityProgress but loadingSpace is false...");
        const a = this.data.get(this.loadingSpace);
        if (!a) return void CoreLib.Logger.error("loading-state", "Received onEntityProgress the space", this.loadingSpace, "has no loading state data.");
        if (!a.entities?.has(e)) return void CoreLib.Logger.warn("loading-state", "Entity", e, "reported loading progress but wasn't registered!");
        if (t < 0 || t > 1) return void CoreLib.Logger.warn("loading-state", "Invalid progress value from", e);
        const o = a.loadInfo.get(e) ?? {};
        o.progress = t, a.loadInfo.set(e, o), this.#u(a)
    }
    #u(e) {
        let t = "";
        if (e.gsplatLoading) this.progress = Math.round(e.progress), this.app.crossSpaceLoader && this.app.crossSpaceLoader.updateProps({
            progress: this.progress
        }), t = `Loading LOD tiles... (${e.loaded} loaded, ${e.pending} pending)`;
        else if (e.waitinAssets) t = "Waiting for asset to load:\n" + e.asset.name;
        else {
            const a = e.entities.size,
                o = e.loaded.size,
                i = [];
            let n = 0,
                s = 0;
            for (const [t, a] of e.entities) {
                const a = e.entityWeights.get(t) || 0,
                    o = e.loadInfo.get(t),
                    r = e.loaded.has(t) || o && o.finishedTime;
                n += (r ? 1 : o && "number" == typeof o.progress ? o.progress : 0) * a, s += a, !r && o && o.progress && !e.loaded.has(t) && i.push([t, o])
            }
            const r = s > 0 ? n / s : 0;
            this.progress = Math.round(100 * r), this.app.crossSpaceLoader && this.app.crossSpaceLoader.updateProps({
                progress: Math.round(100 * r)
            }), t = `Loading entities... (${o}/${a})${i.map((([t,a])=>`${e.entities.get(t).type}: ${Math.round(100*a.progress)}%`)).join("\n")}`
        }
        this._loadingDisplayDiv ? this._loadingDisplayDiv.textContent = t : console.warn("loading html element not found")
    }
    onSpaceLoadStarts(e) {
        if (CoreLib.Logger.debug("loading-state", "Space started loading"), this.#e("Space started loading:", e), this.loadingSpace) throw new Error("Space is loading: " + this.loadingSpace);
        this.loadingSpace = e || !0, this.#t(!1), this.loadSeq++, this.app.numSessionLoads ? this.app.numSessionLoads++ : this.app.numSessionLoads = 1;
        const t = this.data.get(e);
        if (t) {
            t.loadId = this.#a(), this.#c(e, t), this.#o("space_load_start", e, {
                loadId: t.loadId,
                loadReason: t.loadReason ?? null,
                sessionLoad: this.app.numSessionLoads,
                cold: 1 === this.app.numSessionLoads,
                url: location.href,
                device: this.#n(),
                timeZone: this.#i(),
                utcOffsetMin: -(new Date).getTimezoneOffset(),
                locale: navigator.language || null
            });
            const a = this.app.spaceLoadTimeoutMs ?? 15e4;
            t.watchdog = setTimeout((() => {
                t.completed || (this.loadingSpace === e || t.inLodWait) && this.#o("space_load_timeout", e, {
                    loadId: t.loadId,
                    durationMs: Date.now() - t.startTime,
                    stall: this.#d(t)
                })
            }), a)
        }
    }
    onSpaceLoadEnds(e) {
        this.#e("Space finished loading: ", e);
        const t = this.data.get(e);
        if (!t) throw new Error("[loading-state-tracker] onSpaceLoadEnds could not find data! room: " + e);
        t.spaceLoaded = !0, this.onLoadStateChange(e)
    }
    onSpaceLoadError(e) {
        this.#e("Space could not load: ", e);
        const t = this.data.get(e);
        t ? (t.loadError = !0, t.completed || (clearTimeout(t.watchdog), t.completed = !0, this.#t(!0), this.#o("space_load_failed", e, {
            loadId: t.loadId ?? null,
            durationMs: Date.now() - t.startTime,
            stall: this.#d(t)
        })), this.onLoadStateChange(e)) : (CoreLib.Logger.error("loading-state", "onSpaceLoadEnds could not find data! room: " + e), this.loadingSpace = !1, this.#t(!0))
    }
    #w(e) {
        const t = this.app.assets._assets;
        for (const a of t)
            if (a.loading) return a.once("load", (() => {
                CoreLib.Logger.log("loading-state", "Asset", a.name, "is done loading."), this.onLoadStateChange(e)
            })), a.once("error", (() => {
                CoreLib.Logger.error("loading-state", "Error while loading asset:", a.name), this.onLoadStateChange(e)
            })), this.#u({
                waitinAssets: !0,
                asset: a
            }), CoreLib.Logger.log("loading-state", "Asset", a.name, "is being loaded."), !0;
        return CoreLib.Logger.log("loading-state", "No assets are being loaded"), !1
    }
    onLoadStateChange(e) {
        const t = this.data.get(e);
        if (!t) throw new Error("[loading-state-tracker] onLoadStateChange could not find data! room: " + e);
        const a = t.sceneCollisionLoading.size > 0,
            o = t.entitiesCreated && t.entitiesLoaded && t.spaceLoaded && !a && !this.#w(e);
        o && (this.#f(e), this.app.fire("load-tracker:ready")), o && this.#m(e);
        t.loadError && (this.loadingSpace = !1)
    }
    async waitSpaceLoaded(e = 300) {
        return this.loadingSpace ? (this.#e("waitSpaceLoaded: IS LOADING.", this.loadingSpace), await new Promise(((t, a) => {
            let o = 0;
            const check = () => {
                o++, this.loadingSpace ? o > e ? a("Timeout waiting for space to finish loading.") : setTimeout(check, 100) : (this.#e("Space finished loading after", o, "checks."), t(!0))
            };
            check()
        }))) : (this.#e("waitSpaceLoaded: Not loading."), !0)
    }
}
const GLUR = (() => {
    var r, n, a, o, e, t;

    function convolveRGBA(r, n, a, o, e, t) {
        var f, v, u, A, c, l, i, h, G, R, w, x, y, B, M, p, s, U, b, g, F, m, C, L, d, j, k, q, z, D;
        for (d = 0; d < t; d++) {
            for (C = d, L = 0, u = (f = r[m = d * e]) >> 8 & 255, A = f >> 16 & 255, c = f >> 24 & 255, B = U = (v = 255 & f) * o[6], M = b = u * o[6], p = g = A * o[6], s = F = c * o[6], k = o[0], q = o[1], z = o[4], D = o[5], j = 0; j < e; j++) R = (l = 255 & (f = r[m])) * k + v * q + B * z + U * D, w = (i = f >> 8 & 255) * k + u * q + M * z + b * D, x = (h = f >> 16 & 255) * k + A * q + p * z + g * D, y = (G = f >> 24 & 255) * k + c * q + s * z + F * D, U = B, b = M, g = p, F = s, B = R, M = w, p = x, s = y, v = l, u = i, A = h, c = G, a[L] = B, a[L + 1] = M, a[L + 2] = p, a[L + 3] = s, L += 4, m++;
            for (L -= 4, C += t * (e - 1), u = (f = r[--m]) >> 8 & 255, A = f >> 16 & 255, c = f >> 24 & 255, B = U = (v = 255 & f) * o[7], M = b = u * o[7], p = g = A * o[7], s = F = c * o[7], l = v, i = u, h = A, G = c, k = o[2], q = o[3], j = e - 1; j >= 0; j--) R = l * k + v * q + B * z + U * D, w = i * k + u * q + M * z + b * D, x = h * k + A * q + p * z + g * D, y = G * k + c * q + s * z + F * D, U = B, b = M, g = p, F = s, B = R, M = w, p = x, s = y, v = l, u = i, A = h, c = G, l = 255 & (f = r[m]), i = f >> 8 & 255, h = f >> 16 & 255, G = f >> 24 & 255, f = (a[L] + B << 0) + (a[L + 1] + M << 8) + (a[L + 2] + p << 16) + (a[L + 3] + s << 24), n[C] = f, m--, L -= 4, C -= t
        }
    }
    return function blurRGBA(f, v, u, A) {
        if (A) {
            var c = new Uint32Array(f.buffer),
                l = new Uint32Array(c.length),
                i = new Float32Array(4 * Math.max(v, u)),
                h = function gaussCoef(f) {
                    f < .5 && (f = .5);
                    var v = Math.exp(.527076) / f,
                        u = Math.exp(-v),
                        A = Math.exp(-2 * v),
                        c = (1 - u) * (1 - u) / (1 + 2 * v * u - A);
                    return r = c, n = c * (v - 1) * u, a = c * (v + 1) * u, o = -c * A, e = 2 * u, t = -A, new Float32Array([r, n, a, o, e, t, (r + n) / (1 - e - t), (a + o) / (1 - e - t)])
                }(A);
            convolveRGBA(c, l, i, h, v, u), convolveRGBA(l, c, i, h, u, v)
        }
    }
})();
const CustomSoundEntity =

    // ======== sceneConfig ========
    pc.createScript("sceneConfig");
SceneConfig.attributes.add("sceneName", {
    type: "string",
    title: "Scene Name",
    default: "unkown",
    description: "The name of the scene, usually the name from playcanavs scebe"
}), SceneConfig.attributes.add("initialGameState", {
    type: "entity",
    title: "Initial GameState",
    description: ""
}), SceneConfig.prototype.initialize = function() {
    this.app.sceneconfig = {}, this.app.sceneconfig.sceneName = this.sceneName, this.app.sceneconfig.initialGameState = this.initialGameState
}, SceneConfig.prototype.update = function(e) {};
var DisableIngame =

    // ======== spawnPointEntity ========
    pc.createScript("spawnPointEntity");
SpawnPointEntity.prototype.initialize = function() {
    this.entity.onServerDataLoaded = this.onServerDataLoaded.bind(this), this.entity.on(ReactUI.EVENT.ENTITY_REMOVE_FROM_SCENE, this.onDelete, this), this.entity.on(ReactUI.EVENT.ENTITY_SET_VISIBILITY, this.setVisibility, this), this.isEditable = this.app.userProfileData.isSpaceEditable(), this.model = this.entity.findByName("Model");
    const onDoubleClick = () => {
        this.isEditable && this.onEditButtonClicked()
    };
    this.model && (this.model.onDoubleClickDelegate = onDoubleClick), this.createDirectionArrow(), this.createEditButton(), this.isEditingSpace = ReactUI.currentSessionStore.getState().isEditingSpace, this.updateEditModeIndicators();
    const t = ReactUI.currentSessionStore.subscribe(((t, i) => {
        t.isEditingSpace !== i.isEditingSpace && (this.isEditingSpace = t.isEditingSpace, this.updateEditModeIndicators())
    }));
    this.on("destroy", (() => {
        this.entity.off(ReactUI.EVENT.ENTITY_REMOVE_FROM_SCENE, this.onDelete, this), this.entity.off(ReactUI.EVENT.ENTITY_SET_VISIBILITY, this.setVisibility, this), this.movementController?.destroy(), t()
    }))
}, SpawnPointEntity.prototype.createEditButton = function() {
    const t = new pc.Entity("EditButton");
    t.tags.add("floating-button"), t.addComponent("collision", {
        type: "sphere",
        radius: .25
    }), t.addComponent("script"), t.script.create("clickableRender", {
        attributes: {
            maxDistance: 1e5,
            maxDistanceCursor: 1e5
        }
    }), t.onClickDelegate = this.onEditButtonClicked.bind(this);
    const i = new pc.StandardMaterial;
    i.diffuse = new pc.Color(1, .85, 0), i.emissive = new pc.Color(1, .85, 0), i.update();
    const e = new pc.Entity("Visual");
    e.addComponent("render", {
        type: "sphere",
        material: i
    }), e.setLocalScale(.2, .2, .2), t.addChild(e), t.enabled = !1, this.entity.addChild(t), this.editButton = t
}, SpawnPointEntity.prototype.updateEditModeIndicators = function() {
    const t = !!this.isEditable && !!this.isEditingSpace && !this.data?.hidden;
    this.editButton && (this.editButton.enabled = t), this.directionArrow && (this.directionArrow.enabled = t)
}, SpawnPointEntity.prototype.createDirectionArrow = function() {
    const t = new pc.StandardMaterial;
    t.diffuse = new pc.Color(1, .85, 0), t.emissive = new pc.Color(1, .85, 0), t.update();
    const i = new pc.Entity("DirectionArrow");
    i.enabled = !1;
    const e = new pc.Entity("Shaft");
    e.addComponent("render", {
        type: "cylinder",
        material: t
    }), e.setLocalPosition(0, 0, -.2), e.setLocalEulerAngles(-90, 0, 0), e.setLocalScale(.04, .4, .04), i.addChild(e);
    const n = new pc.Entity("Head");
    n.addComponent("render", {
        type: "cone",
        material: t
    }), n.setLocalPosition(0, 0, -.45), n.setLocalEulerAngles(-90, 0, 0), n.setLocalScale(.12, .18, .12), i.addChild(n), this.entity.addChild(i), this.directionArrow = i
}, SpawnPointEntity.prototype.enablePhysics = function() {}, SpawnPointEntity.prototype.disablePhysics = function() {}, SpawnPointEntity.prototype.postInitialize = function() {
    const t = this.app.root.findByName("GizmoController").editManager,
        i = {
            target: this.entity
        };
    this.movementController = new MovementController(this.entity, this, t, i, this, this)
}, SpawnPointEntity.prototype.onServerDataLoaded = async function({
    id: t,
    data: i,
    type: e,
    room: n
}) {
    try {
        if (this.id || (this.id = t), this.id !== t) throw new Error("What!?!?! Different id? Impossible.");
        if ("SpawnPoint" !== e) throw new Error("Type must be 'SpawnPoint'.");
        this.roomName = n, await this.loadData(JSON.parse(i))
    } finally {
        this.app.loadTracker.onEntityLoaded(this.id, n)
    }
}, SpawnPointEntity.prototype.loadData = async function(t) {
    this.data = t, this.entity.entityName = t.displayName || "Spawn Point";
    const i = t.position ? new pc.Vec3(t.position.x ?? 0, t.position.y ?? 0, t.position.z ?? 0) : new pc.Vec3;
    this.entity.setPosition(i);
    const e = t.rotation || {
        x: 0,
        y: 180,
        z: 0
    };
    this.entity.setEulerAngles(e.x ?? 0, e.y ?? 180, e.z ?? 0), this.updateVisibility()
}, SpawnPointEntity.prototype.setVisibility = async function(t) {
    this.data.hidden = !t, this.updateVisibility(), await this.upload()
}, SpawnPointEntity.prototype.updateVisibility = function() {
    const t = this.isEditable && !this.data?.hidden;
    this.model && (t ? this._hiddenScale && (this.model.setLocalScale(this._hiddenScale), this._hiddenScale = null) : (this._hiddenScale || (this._hiddenScale = this.model.getLocalScale().clone()), this.model.setLocalScale(0, 0, 0))), this.updateEditModeIndicators()
}, SpawnPointEntity.prototype.onEditButtonClicked = function() {
    ReactUI.updateCurrentSessionStore({
        editModeCurrentTab: "Content"
    });
    const t = !!ReactUI.useNavigationStore.getState().currentState?.creatorBadge?.contentSubmenu,
        i = {
            isOpen: !0,
            screen: "editSpace",
            entityType: ReactUI.IconType.SpawnPoint,
            contentSubmenu: "spawn-point",
            spawnPointEntity: this
        };
    t ? ReactUI.updateReactNavigationState({
        creatorBadge: i
    }) : ReactUI.pushReactNavigationState({
        creatorBadge: i
    }), this.movementController.isMoving() || this.movementController.startMove()
}, SpawnPointEntity.prototype.onMoveButtonClicked = function() {
    this.movementController.isMoving() ? this.movementController.finishMove() : this.movementController.startMove()
}, SpawnPointEntity.prototype.moveFinished = function(t, i) {
    this.data.position = {
        x: t.x,
        y: t.y,
        z: t.z
    };
    const e = this.entity.forward.clone(),
        n = Math.asin(pc.math.clamp(e.y, -1, 1)) * (180 / Math.PI),
        o = e.clone();
    o.y = 0;
    let a = this.data.rotation?.y ?? 180;
    o.lengthSq() > 1e-6 && (o.normalize(), a = Math.atan2(-o.x, -o.z) * (180 / Math.PI)), this.data.rotation = {
        x: n,
        y: a,
        z: 0
    }, this.upload()
}, SpawnPointEntity.prototype.enableInteraction = function() {}, SpawnPointEntity.prototype.disableInteraction = function() {}, SpawnPointEntity.prototype.updateData = async function(t) {
    if (this.data = {
            ...this.data,
            ...t
        }, t.position || t.rotation) {
        const t = new pc.Vec3(this.data.position.x, this.data.position.y, this.data.position.z);
        this.entity.setPosition(t), this.entity.setEulerAngles(this.data.rotation.x ?? 0, this.data.rotation.y ?? 180, this.data.rotation.z ?? 0);
        this.app.root.findByName("GateServer").script.gateServer._resyncActiveGizmo()
    }
    void 0 !== t.displayName && (this.entity.entityName = t.displayName || "Spawn Point", this.app.fire("reactui:updateHeaderTitle")), await this.upload()
}, SpawnPointEntity.prototype.spawnNow = function() {
    const t = new pc.Vec3(this.data.position.x, this.data.position.y, this.data.position.z),
        i = this.app.game.computeLookAtFromAzimuth(t, this.data.rotation.y);
    this.app.fire("firstperson:cameraSwitch", !0, !0, "third"), this.app.game.spawnOnPosition(t, i)
}, SpawnPointEntity.prototype.duplicate = async function() {
    const t = structuredClone(this.data);
    t.position.z += 1, delete t.isDefaultThirdPerson, delete t.isDefaultFreeCam;
    const i = await SpawnPointEntity.create(this.app, t.position, t, this.entity.getParent());
    return i.script.spawnPointEntity.onEditButtonClicked(), i
}, SpawnPointEntity.prototype.upload = async function() {
    try {
        const t = this.data || {},
            i = this.id,
            e = "SpawnPoint",
            n = this.app.root.findByName("GateServer").script.gateServer;
        if (!await n.uploadEntityData(this.roomName, i, e, t, !0)) return !1;
        const o = this.entity;
        return n.entityIDs.has(i) ? console.assert(n.entityIDs.get(i) === o, "SpawnPointEntity upload: id already exists but is not the same entity") : n.entityIDs.set(i, o), !0
    } catch (t) {
        return console.error(t), ui_utils.alertError("Error", "Failed to upload spawn point entity data."), !1
    }
}, SpawnPointEntity.prototype.onDelete = async function(t) {
    if (!t && !await ui_utils.confirm(ui_utils.t("overlay.edit-asset.delete-confirm-title"), ui_utils.t("overlay.spawn-point-entity.delete-spawn-point"), "warning", !1, "", ui_utils.t("overlay.userProfile.delete"), ui_utils.t("overlay.userProfile.cancel"), "top", !1)) return !1;
    const i = this.app.root.findByName("GateServer").script.gateServer;
    i.deleteEntity(i.getRoomName(), this.id);
    return ReactUI.useNavigationStore.getState().currentState.creatorBadge?.spawnPointEntity === this && ReactUI.popReactNavigationState(), this.movementController.isMoving() && this.movementController.finishMove(), this.entity.destroy(), !0
}, SpawnPointEntity.create = async function(t, i, e = {}, n) {
    const o = t.root.findByName("GateServer").script.gateServer,
        a = o.entityTemplates.get("SpawnPoint").clone();
    a.enabled = !0;
    const s = a.script.spawnPointEntity;
    s.id = Math.random().toString(36).substring(2, 15), n ? n.addChild(a) : t.root.addChild(a);
    const r = o.entityInfos.filter((t => "SpawnPoint" === t.type && t.id !== s.id)).map((t => JSON.parse(t.data))),
        d = {
            position: {
                x: i.x,
                y: i.y,
                z: i.z
            },
            rotation: {
                x: 0,
                y: 180,
                z: 0
            },
            isDefaultThirdPerson: !r.some((t => t.isDefaultThirdPerson)),
            isDefaultFreeCam: !r.some((t => t.isDefaultFreeCam)),
            alwaysSnapBack: !1,
            ...e
        };
    return s.data = d, await s.upload(), await s.loadData(s.data), a
};
var utils = window.utils || {};
{
    function readLine(t, e) {
        let n = "";
        for (; e.value < t.byteLength;) {
            const r = String.fromCharCode(t.getUint8(e.value++));
            if ("\n" === r) break;
            n += r
        }
        return n.endsWith("\r") && (n = n.slice(0, -1)), n
    }

    function parseRadianceHeader(t) {
        const e = {
                value: 0
            },
            n = readLine(t, e);
        if (!n.startsWith("#?RADIANCE") && !n.startsWith("#?RGBE")) return null;
        let r = !1;
        for (; e.value < t.byteLength;) {
            const n = readLine(t, e);
            if (0 === n.length) break;
            "FORMAT" === n.split("=")[0] && (r = !0)
        }
        if (!r) return null;
        const a = readLine(t, e).split(" ");
        if (4 !== a.length) return null;
        const i = "-Y" === a[0],
            l = parseInt(a[1], 10),
            o = parseInt(a[3], 10);
        return o && l ? {
            width: o,
            height: l,
            flipY: i,
            pixelOffset: e.value
        } : null
    }

    function readPixelsFlat(t, e, n, r) {
        return t.byteLength - e.value !== n * r * 4 ? null : new Uint8Array(t.buffer, t.byteOffset + e.value, n * r * 4).slice()
    }

    function readPixelsRLE(t, e, n, r, a) {
        if (n < 8 || n > 32767) return readPixelsFlat(t, e, n, r);
        const i = [t.getUint8(e.value), t.getUint8(e.value + 1), t.getUint8(e.value + 2), t.getUint8(e.value + 3)];
        if (2 !== i[0] || 2 !== i[1] || 0 != (128 & i[2])) return readPixelsFlat(t, e, n, r);
        const l = new Uint8Array(n * r * 4);
        let o = a ? 0 : 4 * n * (r - 1);
        const u = [0, 0, 0, 0];
        for (let h = 0; h < r; ++h) {
            if (0 === h ? (u[0] = i[0], u[1] = i[1], u[2] = i[2], u[3] = i[3], e.value += 4) : (u[0] = t.getUint8(e.value++), u[1] = t.getUint8(e.value++), u[2] = t.getUint8(e.value++), u[3] = t.getUint8(e.value++)), (u[2] << 8) + u[3] !== n) return null;
            for (let r = 0; r < 4; ++r) {
                let a = 0;
                for (; a < n;) {
                    const i = t.getUint8(e.value++);
                    if (i > 128) {
                        const u = i - 128;
                        if (a + u > n) return null;
                        const h = t.getUint8(e.value++);
                        for (let t = 0; t < u; ++t) l[o + r + 4 * a++] = h
                    } else {
                        if (0 === i || a + i > n) return null;
                        for (let n = 0; n < i; ++n) l[o + r + 4 * a++] = t.getUint8(e.value++)
                    }
                }
            }
            o += 4 * n * (a ? 1 : -1)
        }
        return l
    }

    function decodeRadianceHdr(t) {
        const e = new DataView(t),
            n = parseRadianceHeader(e);
        if (!n) return null;
        const r = readPixelsRLE(e, {
            value: n.pixelOffset
        }, n.width, n.height, n.flipY);
        return r ? {
            width: n.width,
            height: n.height,
            rgbe: r
        } : null
    }

    function rgbeToLinear(t, e, n) {
        const r = t[e + 3];
        if (0 === r) return void(n[0] = n[1] = n[2] = 0);
        const a = Math.pow(2, r - 128 - 8);
        n[0] = t[e] * a, n[1] = t[e + 1] * a, n[2] = t[e + 2] * a
    }

    function linearToRgbe(t, e, n, r, a) {
        const i = Math.max(t, e, n);
        if (i < 1e-32) return void(r[a] = r[a + 1] = r[a + 2] = r[a + 3] = 0);
        const l = Math.floor(Math.log2(i)) + 1,
            o = Math.pow(2, 8 - l);
        r[a] = Math.min(255, Math.round(t * o)), r[a + 1] = Math.min(255, Math.round(e * o)), r[a + 2] = Math.min(255, Math.round(n * o)), r[a + 3] = l + 128
    }

    function boxDownsampleLinear(t, e, n, r) {
        const a = r / Math.max(e, n),
            i = Math.max(1, Math.round(e * a)),
            l = Math.max(1, Math.round(n * a)),
            o = new Uint8Array(i * l * 4),
            u = [0, 0, 0];
        for (let r = 0; r < l; ++r) {
            const a = Math.floor(r * n / l),
                h = Math.max(a + 1, Math.floor((r + 1) * n / l));
            for (let n = 0; n < i; ++n) {
                const l = Math.floor(n * e / i),
                    s = Math.max(l + 1, Math.floor((n + 1) * e / i));
                let c = 0,
                    d = 0,
                    f = 0,
                    g = 0;
                for (let n = a; n < h; ++n)
                    for (let r = l; r < s; ++r) rgbeToLinear(t, 4 * (n * e + r), u), c += u[0], d += u[1], f += u[2], g++;
                linearToRgbe(c / g, d / g, f / g, o, 4 * (r * i + n))
            }
        }
        return {
            width: i,
            height: l,
            rgbe: o
        }
    }

    function encodeRadianceHdr(t, e, n) {
        const r = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${e} +X ${t}\n`,
            a = (new TextEncoder).encode(r),
            i = new Uint8Array(a.length + n.length);
        return i.set(a, 0), i.set(n, a.length), i
    }
    utils.isRadianceHdrFile = async function(t) {
        if (/\.hdr$/i.test(t.name)) return !0;
        try {
            const e = await t.slice(0, 11).text();
            return e.startsWith("#?RADIANCE") || e.startsWith("#?RGBE")
        } catch (t) {
            return !1
        }
    }, utils.getRadianceHdrDimensions = async function(t) {
        try {
            const e = await t.slice(0, 512).arrayBuffer(),
                n = parseRadianceHeader(new DataView(e));
            return n ? {
                width: n.width,
                height: n.height
            } : null
        } catch (t) {
            return null
        }
    }, utils.resizeRadianceHdr = async function(t, e) {
        const n = await t.arrayBuffer();
        let r;
        try {
            r = decodeRadianceHdr(n)
        } catch (e) {
            return t
        }
        if (!r) return t;
        if (Math.max(r.width, r.height) <= e) return t;
        const a = boxDownsampleLinear(r.rgbe, r.width, r.height, e),
            i = encodeRadianceHdr(a.width, a.height, a.rgbe);
        return new File([i], t.name, {
            type: t.type || "image/vnd.radiance"
        })
    }, utils.prepareHdrUpload = async function(t, e = {}) {
        const n = e.warnThreshold ?? 4096,
            r = e.hardCap ?? 8192,
            a = await utils.getRadianceHdrDimensions(t);
        if (!a) return t;
        const i = Math.max(a.width, a.height);
        if (i <= n) return t;
        const l = await ReactUI.showHdriResizeDialog({
            width: a.width,
            height: a.height,
            warnThreshold: n,
            hardCap: r,
            fileName: t.name
        });
        if (!l || !l.confirmed) return null;
        const o = l.targetMax;
        return o >= i ? t : await utils.resizeRadianceHdr(t, o)
    }
}! function() {
    if (!window.pc) return;
    if (window.__gsplatDetachedPlacementPatched) return;
    window.__gsplatDetachedPlacementPatched = !0;
    let t = !1;
    const installGuard = t => {
            if (!t || t.__detachedPlacementGuarded) return;
            const e = t._updateWorldState;
            "function" == typeof e ? (t.__detachedPlacementGuarded = !0, t._updateWorldState = function() {
                const t = this._layerPlacements;
                if (Array.isArray(t))
                    for (let e = t.length - 1; e >= 0; e--) {
                        const a = t[e];
                        a && !a.resource && (t.splice(e, 1), this._layerPlacementsDirty = !0)
                    }
                return e.apply(this, arguments)
            }, console.log("gsplat-detached-placement-patch installed")) : console.log("gsplat-detached-placement-patch: GSplatWorld._updateWorldState not found; not installed")
        },
        tryInstall = () => {
            if (t) return !0;
            const e = (() => {
                const t = pc.Application.getApplication(),
                    e = t && t.renderer && t.renderer.gsplatDirector;
                if (!e || !e.camerasMap) return null;
                for (const [, t] of e.camerasMap)
                    if (t && t.layersMap)
                        for (const [, e] of t.layersMap) {
                            if (!e) continue;
                            const t = e.gsplatManager && e.gsplatManager.world || e.gsplatManagerShadow && e.gsplatManagerShadow.world;
                            if (t) return t
                        }
                return null
            })();
            return !!e && (installGuard(Object.getPrototypeOf(e)), t = !0, !0)
        },
        start = () => {
            const t = pc.Application.getApplication();
            if (!t) return void setTimeout(start, 100);
            if (tryInstall()) return;
            const onUpdate = () => {
                tryInstall() && t.off("update", onUpdate)
            };
            t.on("update", onUpdate)
        };
    start()
}();
const SPLAT_SKIN_TEX_WIDTH = 1024,
    SPLAT_SKIN_CHUNK_GLSL = "\nuniform highp sampler2D uSkinIdx;   // per-splat joint indices (RGBA32F)\nuniform highp sampler2D uSkinWgt;   // per-splat weights, sum=1 (RGBA32F)\nuniform highp sampler2D uSkinNrm;   // per-splat fit-pose surface normal (RGBA32F, xyz)\nuniform highp sampler2D uBoneTex;   // 4 x numBones texels: columns of bone mat4\nuniform float uSkinOn;\nuniform float uTintBones;\n// relighting (SBA1 v3 sidecars only; 0 = off, which is the default)\nuniform float uRelight;\nuniform float uBrightness;          // scan exposure correction from the rigger, 1 = untouched\nuniform vec4 uNrmRot;               // avatar -> world rotation quat (x,y,z,w)\nuniform vec3 uLightDir;             // world-space direction TOWARD the key light\nuniform vec3 uLightColor;\nuniform vec3 uLight2Dir;            // ...and toward the fill\nuniform vec3 uLight2Color;\nuniform vec3 uLightAmbient;         // flat fallback when the space has no env map\n// image-based ambient from the room's own HDR: custom-travel-center.js runs the\n// skybox image through EnvLighting.generateAtlas and leaves it on scene.envAtlas\nuniform sampler2D uEnvAtlas;\nuniform float uEnvOn;               // 0 = flat uLightAmbient, 1 = sample the atlas\nuniform float uEnvEncoding;         // 0 linear, 1 srgb, 2 rgbm, 3 rgbp, 4 rgbe\nuniform float uEnvIntensity;        // scene.skyboxIntensity\nuniform mat3 uEnvRotation;          // scene skybox rotation\n\nuniform vec3 uSkinCamPos;           // active camera, world (SH re-evaluation)\nuniform vec4 uSkinModelRot;         // splat wrapper world rotation quat (x,y,z,w)\nmat4 gSkinMat = mat4(1.0);\nvec3 gOrigCenter = vec3(0.0);       // world centre BEFORE skinning (the SH fix below needs it)\nfloat gDomBone = 0.0;\nvec3 gNormal = vec3(0.0);           // deformed world normal, zero when unavailable\n\nvec3 skinQuatRotate(vec4 q, vec3 v) {\n    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);\n}\n\nmat4 skinReadBone(int b) {\n    return mat4(\n        texelFetch(uBoneTex, ivec2(0, b), 0),\n        texelFetch(uBoneTex, ivec2(1, b), 0),\n        texelFetch(uBoneTex, ivec2(2, b), 0),\n        texelFetch(uBoneTex, ivec2(3, b), 0));\n}\n\nvec4 skinQuatMul(vec4 a, vec4 b) {\n    return vec4(\n        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,\n        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,\n        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,\n        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z);\n}\n\nvec4 skinQuatFromMat3(mat3 m) {\n    float t = m[0][0] + m[1][1] + m[2][2];\n    vec4 q;\n    if (t > 0.0) {\n        float s = sqrt(t + 1.0) * 2.0;\n        q = vec4((m[1][2] - m[2][1]) / s, (m[2][0] - m[0][2]) / s, (m[0][1] - m[1][0]) / s, 0.25 * s);\n    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {\n        float s = sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2.0;\n        q = vec4(0.25 * s, (m[1][0] + m[0][1]) / s, (m[2][0] + m[0][2]) / s, (m[1][2] - m[2][1]) / s);\n    } else if (m[1][1] > m[2][2]) {\n        float s = sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2.0;\n        q = vec4((m[1][0] + m[0][1]) / s, 0.25 * s, (m[2][1] + m[1][2]) / s, (m[2][0] - m[0][2]) / s);\n    } else {\n        float s = sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2.0;\n        q = vec4((m[2][0] + m[0][2]) / s, (m[2][1] + m[1][2]) / s, 0.25 * s, (m[0][1] - m[1][0]) / s);\n    }\n    return q;\n}\n\nvec3 skinHue(float i) {\n    float h = fract(i * 0.61803398875);\n    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);\n}\n\n// the engine's decode table (chunk-utils.js), as a uniform switch because the\n// atlas encoding is only known once a space's skybox has loaded\nvec3 skinEnvDecode(vec4 raw) {\n    if (uEnvEncoding < 0.5) return raw.rgb;                    // linear\n    if (uEnvEncoding < 1.5) return pow(raw.rgb, vec3(2.2));    // srgb\n    if (uEnvEncoding < 2.5) { vec3 c = (8.0 * raw.a) * raw.rgb; return c * c; }        // rgbm\n    if (uEnvEncoding < 3.5) { vec3 c = raw.rgb * (-raw.a * 7.0 + 8.0); return c * c; } // rgbp\n    return raw.a == 0.0 ? vec3(0.0) : raw.rgb * pow(2.0, raw.a * 255.0 - 128.0);       // rgbe\n}\n\n// Diffuse irradiance for a world normal, from the prefiltered env atlas. Same\n// rect, equirect mapping and vec3(-1,1,1) flip as the engine's own\n// lit/frag/ambient.js, so the splat picks up the ambient every other surface in\n// the room does.\nvec3 skinEnvAmbient(vec3 n) {\n    const float atlasSize = 512.0;\n    const float seamSize = 1.0 / atlasSize;\n    const float PI = 3.141592653589793;\n    vec3 dir = normalize((n * uEnvRotation) * vec3(-1.0, 1.0, 1.0));\n    vec2 sph = vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));\n    vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;\n    uv = vec2(uv.x, 1.0 - uv.y);\n    vec4 rect = vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize;\n    vec2 auv = vec2(mix(rect.x + seamSize, rect.x + rect.z - seamSize, uv.x),\n                    mix(rect.y + seamSize, rect.y + rect.w - seamSize, uv.y));\n    return skinEnvDecode(texture2D(uEnvAtlas, auv)) * uEnvIntensity;\n}\n\nvoid modifySplatCenter(inout vec3 center) {\n    if (uSkinOn < 0.5) { gSkinMat = mat4(1.0); return; }\n    ivec2 uv = ivec2(int(splat.index) % 1024, int(splat.index) / 1024);\n    vec4 fi = texelFetch(uSkinIdx, uv, 0);\n    vec4 w  = texelFetch(uSkinWgt, uv, 0);\n    gDomBone = fi.x;\n    gSkinMat = w.x * skinReadBone(int(fi.x + 0.5))\n             + w.y * skinReadBone(int(fi.y + 0.5))\n             + w.z * skinReadBone(int(fi.z + 0.5))\n             + w.w * skinReadBone(int(fi.w + 0.5));\n    // Relighting normal. Stored in AVATAR space, but the unified hook's bone\n    // matrices are world->world (B = R*D*inv(R)), so the stored vector has to be\n    // rotated into world by R first — that is what uNrmRot carries. Skinning is a\n    // blend of rigid transforms, so rotate-and-renormalize is exact enough.\n    // Zero length means \"no normal\" (v2 sidecar) and relighting is skipped.\n    if (uRelight > 0.0) {\n        vec3 n0 = texelFetch(uSkinNrm, uv, 0).xyz;\n        gNormal = dot(n0, n0) > 0.25\n            ? normalize(mat3(gSkinMat) * skinQuatRotate(uNrmRot, n0))\n            : vec3(0.0);\n    }\n    gOrigCenter = center;\n    center = (gSkinMat * vec4(center, 1.0)).xyz;\n}\n\nvoid modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {\n    if (uSkinOn < 0.5) return;\n    mat3 r = mat3(gSkinMat);\n    r[0] = normalize(r[0]);\n    r[1] = normalize(r[1] - dot(r[1], r[0]) * r[0]);\n    r[2] = cross(r[0], r[1]);\n    rotation = skinQuatMul(skinQuatFromMat3(r), rotation);\n    // work-buffer formats reconstruct w via sqrt and require w >= 0\n    if (rotation.w < 0.0) rotation = -rotation;\n}\n\nvoid modifySplatColor(vec3 center, inout vec4 color) {\n// GSPLAT_CENTER_NOPROJ is #defined ONLY by gsplatCopyToWorkbuffer, which is also the\n// only shader that includes \"gsplatModifyVS\" AFTER gsplatEvalSHVS / gsplatReadVS — so\n// it is the one path where SH_COEFFS, readSHData() and evalSH() below are already\n// declared. The legacy material path (gsplatCommon vert) inlines this chunk BEFORE\n// them, and there the same code is a use-before-declaration that fails to compile the\n// whole splat shader, silently. Same reason the uniforms above are driver-owned: this\n// chunk is compiled into more than one shader and may only lean on what all of them\n// declare. Skinning on the legacy path stays unrelit, as it already is (see the\n// uNrmRot note in _trySetupSkinning).\n#if defined(GSPLAT_CENTER_NOPROJ) && SH_BANDS > 0\n    // The engine evaluated the spherical harmonics BEFORE the bone transform, for\n    // the unskinned splat's view direction (copy-to-workbuffer: dir =\n    // center.view * mat3(center.modelView), i.e. camera->splat in model space).\n    // A skinned splat sits somewhere else and is rotated by its bones, so on a\n    // strongly view-dependent scan that direction is off by tens of degrees and\n    // every splat shows a colour meant for another angle — the face smeared in\n    // the app while the same file rendered sharp with skinning off (2026-09-12).\n    // Re-evaluate for the skinned splat: the world view vector from the skinned\n    // centre, brought back through the skin rotation and the model rotation into\n    // the splat's own frame; swap the engine's term for that one.\n    // (uSkinCamPos / uSkinModelRot are the driver's own uniforms — the engine's\n    // uCameraPosition / model_rotation are not declared on every path this\n    // chunk is compiled into.)\n    if (uSkinOn > 0.5) {\n        vec3 sh[SH_COEFFS];\n        float shScale;\n        readSHData(sh, shScale);\n        vec4 invModel = vec4(-uSkinModelRot.xyz, uSkinModelRot.w);\n        vec3 dirEngine = normalize(skinQuatRotate(invModel, gOrigCenter - uSkinCamPos));\n        mat3 r = mat3(gSkinMat);\n        r[0] = normalize(r[0]);\n        r[1] = normalize(r[1] - dot(r[1], r[0]) * r[0]);\n        r[2] = cross(r[0], r[1]);\n        vec3 dirSkinned = normalize(skinQuatRotate(invModel, transpose(r) * (center - uSkinCamPos)));\n        color.xyz += (evalSH(sh, dirSkinned) - evalSH(sh, dirEngine)) * shScale;\n    }\n#endif\n    // The scan is treated as ALBEDO: a true lambert term, so a surface facing\n    // away from the key really does fall to ambient. That is what gives form —\n    // and the visible win is that the shading MOVES with the body.\n    if (uRelight > 0.0 && dot(gNormal, gNormal) > 0.25) {\n        float ndl = dot(gNormal, uLightDir);\n        float ndf = dot(gNormal, uLight2Dir);\n        float shade = max(ndl, 0.0);\n        float shade2 = max(ndf, 0.0);\n        // ambient goes directional once it comes from the room's HDR — sky above,\n        // floor bounce below — which is most of what grounds the scan in a space\n        vec3 amb = uEnvOn > 0.5 ? skinEnvAmbient(gNormal) : uLightAmbient;\n        vec3 lit = amb + uLightColor * shade + uLight2Color * shade2;\n        // Apply in the colour space the splat is actually in. color here is\n        // GAMMA-encoded (the engine's own helper for it is literally called\n        // prepareOutputFromGamma), while lit is linear — the env tile decodes\n        // to linear radiance and N.L is linear. A straight multiply would land\n        // downstream as albedo * lit^2.2 once the engine decodes: contrast\n        // steepened by lit^1.2, so a half-lit surface comes out ~2.3x too dark\n        // and a 2x-lit one ~2.3x too bright, and every per-channel tint roughly\n        // doubles in strength — harsh, oversaturated, and nothing like the way\n        // the rest of the room responds to the same light. Pre-warping by 1/2.2\n        // makes the gamma-space multiply land as a true linear scale. Costs one\n        // pow instead of decoding and re-encoding the albedo. Clamped because\n        // pow() of a negative base is undefined.\n        color.rgb *= mix(vec3(1.0), pow(max(lit, vec3(0.0)), vec3(1.0 / 2.2)), uRelight);\n    }\n    if (uTintBones > 0.5) {\n        color.rgb = mix(color.rgb, skinHue(gDomBone), 0.75);\n    }\n    // Exposure correction the user set in the rigger, applied last so it lifts\n    // the lit and unlit paths alike. Gamma-space multiply on purpose: this is a\n    // perceptual \"make it brighter\" knob, not a physical light. Some scans come\n    // out of capture simply too dark to use.\n    color.rgb *= uBrightness;\n}\n",
    SPLAT_SKIN_CHUNK_WGSL = "\nvar uSkinIdx: texture_2d<uff>;\nvar uSkinWgt: texture_2d<uff>;\nvar uSkinNrm: texture_2d<uff>;\nvar uBoneTex: texture_2d<uff>;\nuniform uSkinOn: f32;\nuniform uTintBones: f32;\nuniform uRelight: f32;\nuniform uBrightness: f32;\nuniform uNrmRot: vec4f;\nuniform uLightDir: vec3f;\nuniform uLightColor: vec3f;\nuniform uLight2Dir: vec3f;\nuniform uLight2Color: vec3f;\nuniform uLightAmbient: vec3f;\nvar uEnvAtlas: texture_2d<uff>;\nuniform uEnvOn: f32;\nuniform uEnvEncoding: f32;\nuniform uEnvIntensity: f32;\nuniform uEnvRotation: mat3x3f;\n\nuniform uSkinCamPos: vec3f;\nuniform uSkinModelRot: vec4f;\nvar<private> gSkinMat: mat4x4f = mat4x4f(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);\nvar<private> gOrigCenter: vec3f = vec3f(0.0);\nvar<private> gDomBone: f32 = 0.0;\nvar<private> gNormal: vec3f = vec3f(0.0);\n\nfn skinQuatRotate(q: vec4f, v: vec3f) -> vec3f {\n    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);\n}\n\nfn skinReadBone(b: i32) -> mat4x4f {\n    return mat4x4f(\n        textureLoad(uBoneTex, vec2i(0, b), 0),\n        textureLoad(uBoneTex, vec2i(1, b), 0),\n        textureLoad(uBoneTex, vec2i(2, b), 0),\n        textureLoad(uBoneTex, vec2i(3, b), 0));\n}\n\nfn skinQuatMul(a: vec4f, b: vec4f) -> vec4f {\n    return vec4f(\n        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,\n        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,\n        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,\n        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z);\n}\n\nfn skinQuatFromMat3(m: mat3x3f) -> vec4f {\n    let t = m[0][0] + m[1][1] + m[2][2];\n    if (t > 0.0) {\n        let s = sqrt(t + 1.0) * 2.0;\n        return vec4f((m[1][2] - m[2][1]) / s, (m[2][0] - m[0][2]) / s, (m[0][1] - m[1][0]) / s, 0.25 * s);\n    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {\n        let s = sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2.0;\n        return vec4f(0.25 * s, (m[1][0] + m[0][1]) / s, (m[2][0] + m[0][2]) / s, (m[1][2] - m[2][1]) / s);\n    } else if (m[1][1] > m[2][2]) {\n        let s = sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2.0;\n        return vec4f((m[1][0] + m[0][1]) / s, 0.25 * s, (m[2][1] + m[1][2]) / s, (m[2][0] - m[0][2]) / s);\n    }\n    let s = sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2.0;\n    return vec4f((m[2][0] + m[0][2]) / s, (m[2][1] + m[1][2]) / s, 0.25 * s, (m[0][1] - m[1][0]) / s);\n}\n\nfn skinRot3(m: mat4x4f) -> mat3x3f {\n    return mat3x3f(m[0].xyz, m[1].xyz, m[2].xyz);\n}\n\nfn skinOrtho(m: mat4x4f) -> mat3x3f {\n    let c0 = normalize(m[0].xyz);\n    let c1 = normalize(m[1].xyz - dot(m[1].xyz, c0) * c0);\n    return mat3x3f(c0, c1, cross(c0, c1));\n}\n\nfn skinHue(i: f32) -> vec3f {\n    let h = fract(i * 0.61803398875);\n    let x = h * 6.0 + vec3f(0.0, 4.0, 2.0);\n    return clamp(abs(x - 6.0 * floor(x / 6.0) - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));\n}\n\nfn skinEnvDecode(raw: vec4f) -> vec3f {\n    if (uniform.uEnvEncoding < 0.5) { return raw.rgb; }\n    if (uniform.uEnvEncoding < 1.5) { return pow(raw.rgb, vec3f(2.2)); }\n    if (uniform.uEnvEncoding < 2.5) { let c = (8.0 * raw.a) * raw.rgb; return c * c; }\n    if (uniform.uEnvEncoding < 3.5) { let c = raw.rgb * (-raw.a * 7.0 + 8.0); return c * c; }\n    if (raw.a == 0.0) { return vec3f(0.0); }\n    return raw.rgb * pow(2.0, raw.a * 255.0 - 128.0);\n}\n\nfn skinEnvAmbient(n: vec3f) -> vec3f {\n    let atlasSize = 512.0;\n    let seamSize = 1.0 / atlasSize;\n    let PI = 3.141592653589793;\n    let dir = normalize((n * uniform.uEnvRotation) * vec3f(-1.0, 1.0, 1.0));\n    let sph = vec2f(select(atan2(dir.x, dir.z), 0.0, all(dir.xz == vec2f(0.0))), asin(dir.y));\n    var uv = sph / vec2f(PI * 2.0, PI) + 0.5;\n    uv = vec2f(uv.x, 1.0 - uv.y);\n    let rect = vec4f(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize;\n    let auv = vec2f(mix(rect.x + seamSize, rect.x + rect.z - seamSize, uv.x),\n                    mix(rect.y + seamSize, rect.y + rect.w - seamSize, uv.y));\n    let dims = vec2f(textureDimensions(uEnvAtlas, 0));\n    let texel = clamp(vec2i(auv * dims), vec2i(0), vec2i(dims) - 1);\n    return skinEnvDecode(textureLoad(uEnvAtlas, texel, 0)) * uniform.uEnvIntensity;\n}\n\nfn modifySplatCenter(center: ptr<function, vec3f>) {\n    if (uniform.uSkinOn < 0.5) { gSkinMat = mat4x4f(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0); return; }\n    let uv = vec2i(i32(splat.index % 1024u), i32(splat.index / 1024u));\n    let fi = textureLoad(uSkinIdx, uv, 0);\n    let w = textureLoad(uSkinWgt, uv, 0);\n    gDomBone = fi.x;\n    gSkinMat = w.x * skinReadBone(i32(fi.x + 0.5))\n             + w.y * skinReadBone(i32(fi.y + 0.5))\n             + w.z * skinReadBone(i32(fi.z + 0.5))\n             + w.w * skinReadBone(i32(fi.w + 0.5));\n    if (uniform.uRelight > 0.0) {\n        let n0 = textureLoad(uSkinNrm, uv, 0).xyz;\n        gNormal = select(vec3f(0.0), normalize(skinRot3(gSkinMat) * skinQuatRotate(uniform.uNrmRot, n0)), dot(n0, n0) > 0.25);\n    }\n    gOrigCenter = *center;\n    *center = (gSkinMat * vec4f(*center, 1.0)).xyz;\n}\n\nfn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {\n    if (uniform.uSkinOn < 0.5) { return; }\n    *rotation = skinQuatMul(skinQuatFromMat3(skinOrtho(gSkinMat)), *rotation);\n    if ((*rotation).w < 0.0) { *rotation = -*rotation; }\n}\n\nfn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {\n#if defined(GSPLAT_CENTER_NOPROJ) && SH_BANDS > 0\n    if (uniform.uSkinOn > 0.5) {\n        var sh: array<half3, SH_COEFFS>;\n        var shScale: f32;\n        readSHData(&sh, &shScale);\n        let invModel = vec4f(-uniform.uSkinModelRot.xyz, uniform.uSkinModelRot.w);\n        let dirEngine = normalize(skinQuatRotate(invModel, gOrigCenter - uniform.uSkinCamPos));\n        let dirSkinned = normalize(skinQuatRotate(invModel, transpose(skinOrtho(gSkinMat)) * (center - uniform.uSkinCamPos)));\n        let shDelta = vec3f(evalSH(&sh, dirSkinned) - evalSH(&sh, dirEngine)) * shScale;\n        *color = vec4f((*color).xyz + shDelta, (*color).w);\n    }\n#endif\n    var rgb = (*color).rgb;\n    if (uniform.uRelight > 0.0 && dot(gNormal, gNormal) > 0.25) {\n        let shade = max(dot(gNormal, uniform.uLightDir), 0.0);\n        let shade2 = max(dot(gNormal, uniform.uLight2Dir), 0.0);\n        var amb = uniform.uLightAmbient;\n        if (uniform.uEnvOn > 0.5) { amb = skinEnvAmbient(gNormal); }\n        let lit = amb + uniform.uLightColor * shade + uniform.uLight2Color * shade2;\n        rgb *= mix(vec3f(1.0), pow(max(lit, vec3f(0.0)), vec3f(1.0 / 2.2)), uniform.uRelight);\n    }\n    if (uniform.uTintBones > 0.5) {\n        rgb = mix(rgb, skinHue(gDomBone), vec3f(0.75));\n    }\n    rgb *= uniform.uBrightness;\n    *color = vec4f(rgb, (*color).w);\n}\n";
class SplatAvatarDriver {
    constructor(e, t, n) {
        this.app = e, this.rpm = t, this.splatUrl = n.splatUrl, this.bindingUrl = n.bindingUrl, this.doHideAvatar = !1 !== n.hideAvatar, this.tintBones = !0 === n.tintBones, this.yawOffset = n.yawOffset || 0, this.yOffset = n.yOffset || 0, this.sortInterval = n.sortInterval ?? 5, this._binding = null, this._splatWrapper = null, this._gsplat = null, this._mat = null, this._mode = null, this._meshRoot = null, this._boneEntities = null, this._stretchBones = null, this._texBones = null, this._boneData = null, this._setupTries = 0, this._destroyed = !1, this._tmp = {
            refInv: new pc.Mat4,
            rel: new pc.Mat4,
            d: new pc.Mat4,
            R: new pc.Mat4,
            Rinv: new pc.Mat4,
            b: new pc.Mat4,
            yawM: new pc.Mat4,
            qF: (new pc.Quat).setFromEulerAngles(180, 0, 0),
            qYaw: new pc.Quat,
            qOut: new pc.Quat,
            scale: new pc.Vec3,
            qRot: new pc.Quat,
            qRY: new pc.Quat,
            vOff: new pc.Vec3,
            vLight: new pc.Vec3,
            Mfit: null,
            MfitInv: null,
            mSort: new pc.Mat4
        }, this._onAppUpdate = () => {
            try {
                this._drive()
            } catch (e) {
                this._errOnce(e)
            }
        }, this._onRpmDestroy = () => this.destroy(), t.once("destroy", this._onRpmDestroy)
    }
    async start() {
        this.doHideAvatar && SplatAvatarDriver.hideRig(this.rpm), this.app.on("update", this._onAppUpdate);
        try {
            await this._loadBinding(), await this._loadSplat()
        } catch (e) {
            throw console.error("SplatAvatarDriver init failed:", e?.message || e), e
        }
    }
    _errOnce(e) {
        this._erred || (this._erred = !0, console.error("SplatAvatarDriver drive error:", e?.stack || e))
    }
    async _loadBinding() {
        const e = await fetch(this.bindingUrl);
        if (!e.ok) throw new Error("binding fetch " + e.status);
        const t = await e.arrayBuffer(),
            n = new Uint8Array(t);
        if (83 !== n[0] || 66 !== n[1] || 65 !== n[2] || 49 !== n[3]) throw new Error("bad binding magic (expected SBA1)");
        const i = new DataView(t).getUint32(4, !0),
            r = JSON.parse((new TextDecoder).decode(n.subarray(8, 8 + i)).replace(/\0+$/, "").trim());
        let a = 8 + i;
        const s = new Float32Array(t.slice(a, a + 16 * r.numBones * 4));
        a += 16 * r.numBones * 4;
        const o = n.subarray(a, a + 4 * r.numSplats);
        a += 4 * r.numSplats;
        const l = n.subarray(a, a + 4 * r.numSplats);
        a += 4 * r.numSplats;
        const c = r.version >= 2 ? new Float32Array(t.slice(a, a + 3 * r.numSplats * 4)) : null;
        c && (a += 3 * r.numSplats * 4);
        const u = r.version >= 3 ? new Int8Array(t.slice(a, a + 3 * r.numSplats)) : null;
        if (this._binding = {
                numSplats: r.numSplats,
                numBones: r.numBones,
                jointNames: r.jointNames,
                parentJoint: r.parentJoint || r.jointNames.map((() => -1)),
                fit: r.fit || null,
                invFit: s,
                idx: o,
                wgt: l,
                centers: c,
                nrm: u
            }, this._binding.fit) {
            const {
                scale: e,
                position: t,
                rotation: n
            } = this._binding.fit, i = (new pc.Mat4).setScale(1 / e, 1 / e, 1 / e), r = (new pc.Mat4).setTranslate(-t[0], -t[1], -t[2]), a = (new pc.Mat4).setFromEulerAngles(180, 0, 0);
            let s = a;
            if (n) {
                this._tmp.qRot.setFromEulerAngles(n[0], n[1], n[2]);
                const e = (new pc.Mat4).setFromEulerAngles(n[0], n[1], n[2]);
                s = (new pc.Mat4).copy(e).mul(a)
            }
            this._tmp.Mfit = (new pc.Mat4).copy(i).mul(r).mul(s), this._tmp.MfitInv = (new pc.Mat4).copy(this._tmp.Mfit).invert()
        }
        this._boneData = new Float32Array(16 * r.numBones);
        for (let e = 0; e < r.numBones; e++) this._boneData[16 * e] = 1, this._boneData[16 * e + 5] = 1, this._boneData[16 * e + 10] = 1, this._boneData[16 * e + 15] = 1;
        this._texBones = this._makeTexture("splatSkinBones", 4, r.numBones, this._boneData), console.log(`SplatAvatarDriver: binding loaded (${r.numSplats} splats, ${r.numBones} bones)`)
    }
    _makeTexture(e, t, n, i) {
        const r = new pc.Texture(this.app.graphicsDevice, {
            name: e,
            width: t,
            height: n,
            format: pc.PIXELFORMAT_RGBA32F,
            mipmaps: !1,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
        return r.lock().set(i), r.unlock(), r
    }
    async _loadSplat() {
        const {
            entity: e
        } = await ArrivalSpace.loadSplat(this.splatUrl, {
            name: "SplatAvatar"
        });
        if (this._destroyed) return void e.destroy();
        e.enabled = !1, this._splatWrapper = e;
        const t = e.children[0];
        if (t && (t.setLocalPosition(0, 0, 0), t.setLocalEulerAngles(0, 0, 0), t.setLocalScale(1, 1, 1)), this._gsplat = t?.gsplat || e.gsplat || null, !this._gsplat) throw new Error("no gsplat component on loaded splat");
        this._setupTries = 0, this._trySetupSkinning()
    }
    _buildOrderRemap(e, t) {
        const n = this._binding;
        if (!n.centers) return null;
        const i = .01,
            r = new Map;
        for (let e = 0; e < n.numSplats; e++) {
            const t = (a = n.centers[3 * e], s = n.centers[3 * e + 1], o = n.centers[3 * e + 2], Math.round(a / i) + "," + Math.round(s / i) + "," + Math.round(o / i));
            let l = r.get(t);
            l || (l = [], r.set(t, l)), l.push(e)
        }
        var a, s, o;
        const l = new Uint32Array(t);
        let c = 0;
        for (let a = 0; a < t; a++) {
            const t = e[3 * a],
                s = e[3 * a + 1],
                o = e[3 * a + 2],
                u = Math.round(t / i),
                m = Math.round(s / i),
                h = Math.round(o / i);
            let d = -1,
                f = 1 / 0;
            for (let e = -1; e <= 1; e++)
                for (let i = -1; i <= 1; i++)
                    for (let a = -1; a <= 1; a++) {
                        const l = r.get(u + e + "," + (m + i) + "," + (h + a));
                        if (l)
                            for (const e of l) {
                                const i = n.centers[3 * e] - t,
                                    r = n.centers[3 * e + 1] - s,
                                    a = n.centers[3 * e + 2] - o,
                                    l = i * i + r * r + a * a;
                                l < f && (f = l, d = e)
                            }
                    }
            d < 0 && (d = 0, c++), l[a] = d
        }
        return c && console.log(`SplatAvatarDriver: order remap built (${c} unmatched of ${t})`), l
    }
    _buildSkinTextures() {
        const e = this._binding,
            t = this._gsplat.resource,
            n = t ? t.numSplats : e.numSplats,
            i = t ? t.centers : null,
            r = i ? this._buildOrderRemap(i, n) : null,
            a = Math.ceil(n / 1024),
            s = new Float32Array(1024 * a * 4),
            o = new Float32Array(1024 * a * 4),
            l = e.nrm ? new Float32Array(1024 * a * 4) : null;
        for (let t = 0; t < n; t++) {
            const n = r ? r[t] : t,
                i = e.wgt[4 * n] + e.wgt[4 * n + 1] + e.wgt[4 * n + 2] + e.wgt[4 * n + 3] || 1;
            for (let r = 0; r < 4; r++) s[4 * t + r] = e.idx[4 * n + r], o[4 * t + r] = e.wgt[4 * n + r] / i;
            l && (l[4 * t] = e.nrm[3 * n] / 127, l[4 * t + 1] = e.nrm[3 * n + 1] / 127, l[4 * t + 2] = e.nrm[3 * n + 2] / 127)
        }
        e.texIdx = this._makeTexture("splatSkinIdx", 1024, a, s), e.texWgt = this._makeTexture("splatSkinWgt", 1024, a, o), e.texNrm = this._makeTexture("splatSkinNrm", 1024, a, l || new Float32Array(1024 * a * 4)), e.orderIdx = new Uint8Array(4 * n), e.orderWgt = new Float32Array(4 * n);
        for (let t = 0; t < 4 * n; t++) e.orderIdx[t] = s[t], e.orderWgt[t] = o[t];
        e.resCenters = new Float32Array(i.subarray(0, 3 * n)), this._sortCenters = new Float32Array(3 * n), this._boneSortData = new Float32Array(16 * e.numBones), this._sortFactor = n > 75e4 ? 3 : 1
    }
    _trySetupSkinning() {
        if (this._destroyed) return;
        const e = this._gsplat;
        if (!e || !this._binding) return;
        if (!e.resource || !e.resource.centers) return void(this._setupTries++ < 300 ? this.app.once("frameend", (() => this._trySetupSkinning())) : (console.error("SplatAvatarDriver: splat resource never became available"), this._giveUp()));
        if (this._binding.texIdx || this._buildSkinTextures(), e.customAabb = this._deformedAabb(e.resource), e.unified && "function" == typeof e.setWorkBufferModifier) return e.setWorkBufferModifier({
            glsl: SPLAT_SKIN_CHUNK_GLSL,
            wgsl: SPLAT_SKIN_CHUNK_WGSL
        }), e.setParameter("uSkinIdx", this._binding.texIdx), e.setParameter("uSkinWgt", this._binding.texWgt), e.setParameter("uSkinNrm", this._binding.texNrm), e.setParameter("uBoneTex", this._texBones), e.setParameter("uSkinOn", 1), e.setParameter("uTintBones", this.tintBones ? 1 : 0), e.setParameter("uNrmRot", [0, 0, 0, 1]), e.setParameter("uLightDir", [0, .6, .8]), e.setParameter("uRelight", 0), e.setParameter("uBrightness", this.brightness), this._applyLightDefaults(e), e.workBufferUpdate = "number" == typeof pc.WORKBUFFER_UPDATE_ALWAYS ? pc.WORKBUFFER_UPDATE_ALWAYS : 2, this._mode = "unified", this._applyRelight(), void console.log("SplatAvatarDriver: skinning installed (unified work-buffer path)");
        const t = e.material;
        if (t) {
            const n = t.clone();
            return n.getShaderChunks("glsl").set("gsplatModifyVS", SPLAT_SKIN_CHUNK_GLSL), n.setParameter("uSkinIdx", this._binding.texIdx), n.setParameter("uSkinWgt", this._binding.texWgt), n.setParameter("uSkinNrm", this._binding.texNrm), n.setParameter("uBoneTex", this._texBones), n.setParameter("uSkinOn", 1), n.setParameter("uTintBones", this.tintBones ? 1 : 0), n.setParameter("uNrmRot", [0, 0, 0, 1]), n.setParameter("uLightDir", [0, .6, .8]), n.setParameter("uRelight", 0), n.setParameter("uBrightness", this.brightness), this._applyLightDefaults(n), n.update(), e.material = n, this._mat = n, this._mode = "legacy", void console.log("SplatAvatarDriver: skinning installed (legacy material path)")
        }
        this._setupTries++ < 300 ? this.app.once("frameend", (() => this._trySetupSkinning())) : (console.error("SplatAvatarDriver: no usable gsplat hook (engine " + (pc.version || "?") + " — needs unified setWorkBufferModifier or legacy gsplat.material)"), this._giveUp())
    }
    _giveUp() {
        this._restoreAvatarMeshes()
    }
    _setParam(e, t) {
        "unified" === this._mode && this._gsplat ? this._gsplat.setParameter(e, t) : "legacy" === this._mode && this._mat && this._mat.setParameter(e, t)
    }
    _deformedAabb(e) {
        const t = e?.centers,
            n = t ? Math.min(e.numSplats || 0, t.length / 3) : 0;
        let i = 1 / 0,
            r = 1 / 0,
            a = 1 / 0,
            s = -1 / 0,
            o = -1 / 0,
            l = -1 / 0;
        for (let e = 0; e < n; e++) {
            const n = t[3 * e],
                c = t[3 * e + 1],
                u = t[3 * e + 2];
            n < i && (i = n), n > s && (s = n), c < r && (r = c), c > o && (o = c), u < a && (a = u), u > l && (l = u)
        }
        if (!Number.isFinite(i)) return new pc.BoundingBox(new pc.Vec3(0, -.9, 0), new pc.Vec3(3, 3, 3));
        const c = (s - i) / 2,
            u = (o - r) / 2,
            m = (l - a) / 2,
            h = Math.max(c, u, m);
        return new pc.BoundingBox(new pc.Vec3((i + s) / 2, (r + o) / 2, (a + l) / 2), new pc.Vec3(c + h, u + h, m + h))
    }
    set relight(e) {
        this._relight = Math.max(0, Math.min(1, Number(e) || 0)), this._applyRelight()
    }
    get relight() {
        return this._relight || 0
    }
    get canRelight() {
        return "unified" === this._mode && !!this._binding?.nrm
    }
    _applyRelight() {
        this._setParam("uRelight", this.canRelight && this._relight || 0)
    }
    set brightness(e) {
        const t = Number(e);
        this._brightness = Number.isFinite(t) && t > 0 ? t : 1, this._setParam("uBrightness", this._brightness)
    }
    get brightness() {
        return this._brightness ?? 1
    }
    _applyLightDefaults(e) {
        const t = this.app.scene.ambientLight;
        e.setParameter("uLightAmbient", [.6 * t.r, .6 * t.g, .6 * t.b]), e.setParameter("uLightColor", [0, 0, 0]), e.setParameter("uLight2Dir", [0, .3, -.95]), e.setParameter("uLight2Color", [0, 0, 0]), this._envDummy || (this._envDummy = this._makeTexture("splatEnvNone", 1, 1, new Float32Array([0, 0, 0, 1]))), e.setParameter("uEnvAtlas", this._envDummy), e.setParameter("uEnvOn", 0), e.setParameter("uEnvEncoding", 2), e.setParameter("uEnvIntensity", 1), e.setParameter("uEnvRotation", new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]))
    }
    _pushEnv() {
        const e = this.app.scene,
            t = e.envAtlas || null;
        if (this._setParam("uEnvAtlas", t || this._envDummy), this._setParam("uEnvOn", t ? 1 : 0), !t) return;
        this._setParam("uEnvEncoding", {
            linear: 0,
            srgb: 1,
            rgbm: 2,
            rgbp: 3,
            rgbe: 4
        } [t.encoding] ?? 2), this._setParam("uEnvIntensity", e.skyboxIntensity ?? 1);
        const n = e._skyboxRotationMat3?.data;
        n && this._setParam("uEnvRotation", n)
    }
    _sceneLights() {
        const live = e => e && !e._destroyed && e.enabled && e.light && e.light.enabled;
        if (this._lights && this._lights.length && this._lights.every(live)) return this._lights;
        const e = this.app.customTravelCenter?.getPrimaryLightEntity?.();
        return this._lights = live(e) ? [e] : [], this._lights
    }
    _intensityGain(e) {
        return Math.min(Math.max(0, e ?? 2.2) / 2.2, 2)
    }
    _lightDir(e, t, n) {
        if ("directional" === e.light.type) {
            const t = e.up;
            return n.set(t.x, t.y, t.z)
        }
        return n.copy(e.getPosition()).sub(t).normalize()
    }
    _bindAvatar(e) {
        this._restoreAvatarMeshes(), this._restoreBoneStretch(), this._meshRoot = e;
        const t = e.script?.glbEntity,
            n = t?.renderRootEntity || e,
            i = this._binding.jointNames,
            r = this._binding.parentJoint,
            a = i.map((e => n.findByName(e) || null)),
            resolve = (e, t) => {
                if (a[e] || t > 8) return a[e];
                const n = r[e];
                return n < 0 ? null : resolve(n, t + 1)
            };
        let s = 0;
        this._boneEntities = i.map(((e, t) => (a[t] || s++, a[t] || resolve(t, 0))));
        const o = this._binding.fit?.lengths;
        o && (this._stretchBones = [], i.forEach(((e, t) => {
            const n = o[e],
                i = a[t];
            if (!n || !i) return;
            const r = i.getLocalPosition();
            this._stretchBones.push({
                ent: i,
                ox: r.x,
                oy: r.y,
                oz: r.z,
                x: r.x * n,
                y: r.y * n,
                z: r.z * n
            })
        }))), this.doHideAvatar && this._hideAvatarMeshes(), console.log(`SplatAvatarDriver: bound to skeleton (${s} bones via fallback)`)
    }
    static hideRig(e) {
        if (!e || e._destroyed) return;
        const t = e.script?.glbEntity?.renderRootEntity || e,
            n = 1 << ("number" == typeof pc.SHADER_SHADOW ? pc.SHADER_SHADOW : 2),
            i = e._splatRigHidden || (e._splatRigHidden = []);
        for (const e of t.findComponents("render"))
            if (e) {
                e.castShadows = !0;
                for (const t of e.meshInstances || []) t && t.shaderPassMask !== n && (i.push({
                    mi: t,
                    mask: t.shaderPassMask
                }), t.castShadow = !0, t.shaderPassMask = n)
            }
    }
    static restoreRig(e) {
        if (e) {
            for (const {
                    mi: t,
                    mask: n
                }
                of e._splatRigHidden || []) t && (t.shaderPassMask = n);
            e._splatRigHidden = null
        }
    }
    _hideAvatarMeshes() {
        SplatAvatarDriver.hideRig(this._meshRoot || this.rpm)
    }
    _restoreBoneStretch() {
        if (this._stretchBones) {
            for (const e of this._stretchBones) e.ent && !e.ent._destroyed && e.ent.setLocalPosition(e.ox, e.oy, e.oz);
            this._stretchBones = null
        }
    }
    _restoreAvatarMeshes() {
        SplatAvatarDriver.restoreRig(this._meshRoot || this.rpm)
    }
    _drive() {
        if (!this._binding || !this._splatWrapper || !this._mode) return;
        const e = this.rpm;
        if (!e || e._destroyed) return;
        if (!e.enabled) return void(this._splatWrapper._enabled && (this._splatWrapper.enabled = !1));
        if (e !== this._meshRoot && this._bindAvatar(e), !this._boneEntities) return;
        if (this._stretchBones)
            for (const e of this._stretchBones) e.ent._destroyed || e.ent.setLocalPosition(e.x, e.y, e.z);
        const t = this._tmp,
            n = e.getWorldTransform();
        if (t.qYaw.setFromEulerAngles(0, this.yawOffset, 0), t.yawM.setTRS(pc.Vec3.ZERO, t.qYaw, pc.Vec3.ONE), t.R.mul2(n, t.yawM), t.refInv.copy(t.R).invert(), "unified" === this._mode && t.Rinv.copy(t.refInv), this._relight > 0 && this.canRelight) {
            t.qRY.copy(e.getRotation()).mul(t.qYaw), this._setParam("uNrmRot", [t.qRY.x, t.qRY.y, t.qRY.z, t.qRY.w]);
            const n = this._sceneLights(),
                i = e.getPosition(),
                r = [.9, .6],
                a = ["uLightDir", "uLight2Dir"],
                s = ["uLightColor", "uLight2Color"];
            for (let e = 0; e < a.length; e++) {
                const o = n[e];
                if (!o) {
                    this._setParam(s[e], [0, 0, 0]);
                    continue
                }
                const l = this._lightDir(o, i, t.vLight),
                    c = o.light.color,
                    u = r[e] * this._intensityGain(o.light.intensity);
                this._setParam(a[e], [l.x, l.y, l.z]), this._setParam(s[e], [c.r * u, c.g * u, c.b * u])
            }
            this._pushEnv()
        }
        const i = this._binding.numBones,
            r = this._binding.invFit,
            a = this._boneData;
        for (let e = 0; e < i; e++) {
            const n = this._boneEntities[e],
                i = 16 * e,
                s = this._boneSortData;
            if (!n || n._destroyed) {
                a.fill(0, i, i + 16), a[i] = 1, a[i + 5] = 1, a[i + 10] = 1, a[i + 15] = 1, s && (s.fill(0, i, i + 16), s[i] = 1, s[i + 5] = 1, s[i + 10] = 1, s[i + 15] = 1);
                continue
            }
            t.rel.mul2(t.refInv, n.getWorldTransform()), this._mulInvFit(t.rel.data, r, i, t.d.data);
            const o = t.d.data;
            s && t.Mfit ? (t.mSort.mul2(t.MfitInv, t.d).mul(t.Mfit), s.set(t.mSort.data, i)) : s && (s[i] = o[0], s[i + 1] = -o[1], s[i + 2] = -o[2], s[i + 3] = 0, s[i + 4] = -o[4], s[i + 5] = o[5], s[i + 6] = o[6], s[i + 7] = 0, s[i + 8] = -o[8], s[i + 9] = o[9], s[i + 10] = o[10], s[i + 11] = 0, s[i + 12] = o[12], s[i + 13] = -o[13], s[i + 14] = -o[14], s[i + 15] = 1), "unified" === this._mode ? (t.b.mul2(t.R, t.d).mul(t.Rinv), a.set(t.b.data, i)) : s && a.set(s.subarray(i, i + 16), i)
        }
        this._texBones.lock().set(a), this._texBones.unlock(), this._frameNo = (this._frameNo || 0) + 1, this.sortInterval > 0 && this._sortCenters && this._frameNo % (Math.max(1, Math.round(this.sortInterval)) * (this._sortFactor || 1)) == 0 && this._updateSortCenters();
        const s = e.getPosition();
        n.getScale(t.scale), t.qOut.copy(e.getRotation()).mul(t.qYaw).mul(t.qRot).mul(t.qF);
        const o = this._binding.fit,
            l = o ? o.scale : 1;
        let c = s.x,
            u = s.y + this.yOffset,
            m = s.z;
        o && (t.qRY.copy(e.getRotation()).mul(t.qYaw), t.vOff.set(-o.position[0], -o.position[1], -o.position[2]).mulScalar(t.scale.x / l), t.qRY.transformVector(t.vOff, t.vOff), c += t.vOff.x, u += t.vOff.y, m += t.vOff.z), this._splatWrapper.setPosition(c, u, m), this._splatWrapper.setRotation(t.qOut), this._setParam("uSkinModelRot", [t.qOut.x, t.qOut.y, t.qOut.z, t.qOut.w]);
        const h = this.app.scene.layers.getLayerByName("World")?.cameras?.[0]?.entity || this.app.systems.camera.cameras[0]?.entity;
        if (h) {
            const e = h.getPosition();
            this._setParam("uSkinCamPos", [e.x, e.y, e.z])
        }
        this._splatWrapper.setLocalScale(t.scale.x / l, t.scale.y / l, t.scale.z / l), this._splatWrapper._enabled || (this._splatWrapper.enabled = !0)
    }
    _updateSortCenters() {
        const e = this._binding,
            t = this._gsplat?.resource;
        if (!e || !e.orderIdx || !t) return;
        const n = this._boneSortData,
            i = e.resCenters,
            r = this._sortCenters,
            a = e.orderIdx,
            s = e.orderWgt,
            o = a.length / 4;
        for (let e = 0; e < o; e++) {
            const t = i[3 * e],
                o = i[3 * e + 1],
                l = i[3 * e + 2];
            let c = 0,
                u = 0,
                m = 0;
            for (let i = 0; i < 4; i++) {
                const r = s[4 * e + i];
                if (0 === r) continue;
                const h = 16 * a[4 * e + i];
                c += r * (n[h] * t + n[h + 4] * o + n[h + 8] * l + n[h + 12]), u += r * (n[h + 1] * t + n[h + 5] * o + n[h + 9] * l + n[h + 13]), m += r * (n[h + 2] * t + n[h + 6] * o + n[h + 10] * l + n[h + 14])
            }
            r[3 * e] = c, r[3 * e + 1] = u, r[3 * e + 2] = m
        }
        const l = this.app.renderer?.gsplatDirector;
        if (l?.camerasMap)
            for (const e of l.camerasMap.values())
                if (e.layersMap)
                    for (const n of e.layersMap.values()) {
                        const e = n.gsplatManager?.cpuSorter;
                        e?.centersSet?.has(t.id) && (e.setCenters(t.id, null), e.setCenters(t.id, r))
                    }
    }
    _mulInvFit(e, t, n, i) {
        for (let r = 0; r < 4; r++) {
            const a = t[n + 4 * r],
                s = t[n + 4 * r + 1],
                o = t[n + 4 * r + 2],
                l = t[n + 4 * r + 3];
            i[4 * r] = e[0] * a + e[4] * s + e[8] * o + e[12] * l, i[4 * r + 1] = e[1] * a + e[5] * s + e[9] * o + e[13] * l, i[4 * r + 2] = e[2] * a + e[6] * s + e[10] * o + e[14] * l, i[4 * r + 3] = e[3] * a + e[7] * s + e[11] * o + e[15] * l
        }
    }
    destroy() {
        this._destroyed || (this._destroyed = !0, this.app.off("update", this._onAppUpdate), this.rpm?.off("destroy", this._onRpmDestroy), this._restoreAvatarMeshes(), this._restoreBoneStretch(), this._splatWrapper && !this._splatWrapper._destroyed && this._splatWrapper.destroy(), this._splatWrapper = null, this._gsplat = null, this._mat = null, this._mode = null, this._binding?.texIdx?.destroy(), this._binding?.texWgt?.destroy(), this._binding?.texNrm?.destroy(), this._envDummy?.destroy(), this._envDummy = null, this._texBones?.destroy(), this._binding = null, this._texBones = null, this._meshRoot = null, this._boneEntities = null)
    }
}
"undefined" != typeof window && (window.SplatAvatarDriver = SplatAvatarDriver);
! function() {
    if (!window.pc) return;
    if (window.__spzParserInstalled) return;
    window.__spzParserInstalled = !0;
    const e = window.utils = window.utils || {},
        {
            GSplatFormat: t,
            GSplatResourceBase: n,
            Http: s,
            PIXELFORMAT_RGBA8: o,
            PIXELFORMAT_RGBA32U: r,
            Vec3: a,
            WasmModule: i
        } = pc,
        c = [0, 3, 8, 15, 24];
    class SpzGSplatData {
        numSplats;
        fractionalBits;
        shBands;
        shDim;
        antialiased;
        positions;
        alphas;
        colors;
        scales;
        rotations;
        sh;
        constructor(e, t) {
            this.numSplats = e.numPoints, this.fractionalBits = e.fractionalBits, this.antialiased = e.antialiased, this.shDim = c[e.shDegree], this.shBands = Math.min(e.shDegree, 3), this.positions = t.positions, this.alphas = t.alphas, this.colors = t.colors, this.scales = t.scales, this.rotations = t.rotations, this.sh = t.sh ?? null
        }
        getCenters() {
            const {
                numSplats: e,
                positions: t
            } = this, n = 1 / (1 << this.fractionalBits), s = new Float32Array(3 * e);
            for (let o = 0; o < 3 * e; o++) {
                const e = 3 * o;
                let r = t[e] | t[e + 1] << 8 | t[e + 2] << 16;
                r = r << 8 >> 8, s[o] = r * n
            }
            return s
        }
        calcAabb(e) {
            const {
                numSplats: t,
                positions: n
            } = this, s = 1 / (1 << this.fractionalBits), o = new a(1 / 0, 1 / 0, 1 / 0), r = new a(-1 / 0, -1 / 0, -1 / 0);
            for (let e = 0; e < t; e++)
                for (let t = 0; t < 3; t++) {
                    const a = 3 * (3 * e + t);
                    let i = n[a] | n[a + 1] << 8 | n[a + 2] << 16;
                    i = i << 8 >> 8;
                    const c = i * s,
                        l = 0 === t ? "x" : 1 === t ? "y" : "z";
                    o[l] = Math.min(o[l], c), r[l] = Math.max(r[l], c)
                }
            e.setMinMax(o, r)
        }
    }
    class GSplatSpzResource extends n {
        constructor(e, n, s = {}) {
            super(e, n, s);
            const {
                numSplats: a,
                shBands: i
            } = n, l = [{
                name: "packedTexture",
                format: r
            }, {
                name: "colorTexture",
                format: o
            }], d = i > 0 ? Math.ceil(3 * c[i] / 16) : 0;
            for (let e = 0; e < d; e++) l.push({
                name: `shTexture${e}`,
                format: r
            });
            this._format = new t(e, l, {
                readGLSL: "\nuniform float spzPositionScale;\n\n// work values\nuvec4 packedData;   // xyz: 24-bit position + 8-bit scale per component, w: rotation bits\n\nvec3 getCenter() {\n    packedData = loadPackedTexture();\n\n    // sign-extend the 24-bit fixed point position\n    ivec3 p = ivec3(packedData.xyz << 8u) >> 8;\n    return vec3(p) * spzPositionScale;\n}\n\nvec4 getColor() {\n    vec4 c = loadColorTexture();\n\n    // rgb stores SH DC coefficients as c * 0.15 + 0.5, convert to color as 0.5 + SH_C0 * dc,\n    // alpha is stored with sigmoid already applied\n    const float scale = 0.28209479177387814 / 0.15;\n    return vec4((c.rgb - 0.5) * scale + 0.5, c.a);\n}\n\nvec4 getRotation() {\n    // smallest-three encoding: bits 30-31 store the index of the largest component, the\n    // remaining three components are stored as 9-bit magnitude + sign bit, 10 bits each,\n    // starting from the lowest bits for the highest component index\n    uint comp = packedData.w;\n    uint largest = comp >> 30u;\n    float q[4];\n    float sumSquares = 0.0;\n    for (int i = 3; i >= 0; i--) {\n        if (uint(i) != largest) {\n            float v = float(comp & 0x1ffu) * (0.7071067811865476 / 511.0);\n            if ((comp & 0x200u) != 0u) v = -v;\n            comp = comp >> 10u;\n            q[i] = v;\n            sumSquares += v * v;\n        }\n    }\n    q[largest] = sqrt(max(0.0, 1.0 - sumSquares));\n\n    // spz stores the quaternion as (x, y, z, w), the engine expects (w, x, y, z)\n    return vec4(q[3], q[0], q[1], q[2]);\n}\n\nvec3 getScale() {\n    // 8-bit log encoded scale in the top byte of each position word\n    vec3 s = vec3(packedData.xyz >> 24u);\n    return exp(s / 16.0 - 10.0);\n}\n\n#if SH_BANDS > 0\n\n// quantized SH bytes of the current splat, packed 4 to a word\nuint shWords[12];\n\nfloat unpackSH(int i) {\n    uint b = (shWords[i >> 2] >> uint(8 * (i & 3))) & 0xffu;\n    return (float(b) - 128.0) / 128.0;\n}\n\nvoid readSHData(out vec3 sh[SH_COEFFS], out float scale) {\n    uvec4 d0 = loadShTexture0();\n    shWords[0] = d0.x; shWords[1] = d0.y; shWords[2] = d0.z; shWords[3] = d0.w;\n    #if SH_BANDS > 1\n        uvec4 d1 = loadShTexture1();\n        shWords[4] = d1.x; shWords[5] = d1.y; shWords[6] = d1.z; shWords[7] = d1.w;\n    #endif\n    #if SH_BANDS > 2\n        uvec4 d2 = loadShTexture2();\n        shWords[8] = d2.x; shWords[9] = d2.y; shWords[10] = d2.z; shWords[11] = d2.w;\n    #endif\n\n    for (int i = 0; i < SH_COEFFS; i++) {\n        sh[i] = vec3(unpackSH(i * 3), unpackSH(i * 3 + 1), unpackSH(i * 3 + 2));\n    }\n\n    scale = 1.0;\n}\n\n#endif\n",
                readWGSL: "\nuniform spzPositionScale: f32;\n\n// work values\nvar<private> packedData: vec4u;    // xyz: 24-bit position + 8-bit scale per component, w: rotation bits\n\nfn getCenter() -> vec3f {\n    packedData = loadPackedTexture();\n\n    // sign-extend the 24-bit fixed point position\n    let p = bitcast<vec3i>(packedData.xyz << vec3u(8u)) >> vec3u(8u);\n    return vec3f(p) * uniform.spzPositionScale;\n}\n\nfn getColor() -> vec4f {\n    let c = loadColorTexture();\n\n    // rgb stores SH DC coefficients as c * 0.15 + 0.5, convert to color as 0.5 + SH_C0 * dc,\n    // alpha is stored with sigmoid already applied\n    const scale: f32 = 0.28209479177387814 / 0.15;\n    return vec4f((c.rgb - 0.5) * scale + 0.5, c.a);\n}\n\nfn getRotation() -> vec4f {\n    // smallest-three encoding: bits 30-31 store the index of the largest component, the\n    // remaining three components are stored as 9-bit magnitude + sign bit, 10 bits each,\n    // starting from the lowest bits for the highest component index\n    var comp: u32 = packedData.w;\n    let largest: u32 = comp >> 30u;\n    var q = array<f32, 4>(0.0, 0.0, 0.0, 0.0);\n    var sumSquares: f32 = 0.0;\n    for (var i: i32 = 3; i >= 0; i--) {\n        if (u32(i) != largest) {\n            var v: f32 = f32(comp & 0x1ffu) * (0.7071067811865476 / 511.0);\n            if ((comp & 0x200u) != 0u) { v = -v; }\n            comp = comp >> 10u;\n            q[i] = v;\n            sumSquares += v * v;\n        }\n    }\n    q[largest] = sqrt(max(0.0, 1.0 - sumSquares));\n\n    // spz stores the quaternion as (x, y, z, w), the engine expects (w, x, y, z)\n    return vec4f(q[3], q[0], q[1], q[2]);\n}\n\nfn getScale() -> vec3f {\n    // 8-bit log encoded scale in the top byte of each position word\n    let s = vec3f(packedData.xyz >> vec3u(24u));\n    return exp(s / 16.0 - 10.0);\n}\n\n#if SH_BANDS > 0\n\n// quantized SH bytes of the current splat, packed 4 to a word\nvar<private> shWords: array<u32, 12>;\n\nfn unpackSH(i: i32) -> f32 {\n    let b = (shWords[i >> 2] >> u32(8 * (i & 3))) & 0xffu;\n    return (f32(b) - 128.0) / 128.0;\n}\n\nfn readSHData(sh: ptr<function, array<half3, SH_COEFFS>>, scale: ptr<function, f32>) {\n    let d0 = loadShTexture0();\n    shWords[0] = d0.x; shWords[1] = d0.y; shWords[2] = d0.z; shWords[3] = d0.w;\n    #if SH_BANDS > 1\n        let d1 = loadShTexture1();\n        shWords[4] = d1.x; shWords[5] = d1.y; shWords[6] = d1.z; shWords[7] = d1.w;\n    #endif\n    #if SH_BANDS > 2\n        let d2 = loadShTexture2();\n        shWords[8] = d2.x; shWords[9] = d2.y; shWords[10] = d2.z; shWords[11] = d2.w;\n    #endif\n\n    for (var i: i32 = 0; i < SH_COEFFS; i++) {\n        sh[i] = half3(vec3f(unpackSH(i * 3), unpackSH(i * 3 + 1), unpackSH(i * 3 + 2)));\n    }\n\n    *scale = 1.0;\n}\n\n#endif\n"
            }), this.streams.init(this.format, a), this.parameters.set("spzPositionScale", 1 / (1 << n.fractionalBits));
            const {
                positions: p,
                scales: f,
                rotations: u,
                colors: h,
                alphas: g
            } = n, m = this.streams.getTexture("packedTexture"), S = m.lock();
            for (let e = 0; e < a; e++) {
                const t = 9 * e,
                    n = 3 * e,
                    s = 4 * e;
                S[4 * e + 0] = p[t + 0] | p[t + 1] << 8 | p[t + 2] << 16 | f[n + 0] << 24, S[4 * e + 1] = p[t + 3] | p[t + 4] << 8 | p[t + 5] << 16 | f[n + 1] << 24, S[4 * e + 2] = p[t + 6] | p[t + 7] << 8 | p[t + 8] << 16 | f[n + 2] << 24, S[4 * e + 3] = u[s + 0] | u[s + 1] << 8 | u[s + 2] << 16 | u[s + 3] << 24
            }
            m.unlock();
            const v = this.streams.getTexture("colorTexture"),
                w = v.lock();
            for (let e = 0; e < a; e++) w[4 * e + 0] = h[3 * e + 0], w[4 * e + 1] = h[3 * e + 1], w[4 * e + 2] = h[3 * e + 2], w[4 * e + 3] = g[e];
            if (v.unlock(), i > 0) {
                const e = n.sh,
                    t = 3 * n.shDim,
                    s = 3 * c[i];
                for (let n = 0; n < d; n++) {
                    const o = this.streams.getTexture(`shTexture${n}`),
                        r = o.lock();
                    for (let o = 0; o < a; o++) {
                        const a = o * t + 16 * n;
                        for (let t = 0; t < 4; t++) {
                            let i = 0;
                            for (let o = 0; o < 4; o++) {
                                i |= (16 * n + 4 * t + o < s ? e[a + 4 * t + o] : 128) << 8 * o
                            }
                            r[4 * o + t] = i
                        }
                    }
                    o.unlock()
                }
            }
        }
        configureMaterialDefines(e) {
            e.set("SH_BANDS", this.gsplatData.shBands)
        }
    }
    class SpzParser {
        app;
        constructor(e) {
            this.app = e
        }
        canParse(e) {
            return "spz" === e.ext
        }
        load(e, t, n) {
            i.getConfig("ZstdDecoderModule") ? this.handler.fetch(e, s.ResponseType.ARRAY_BUFFER, ((e, n) => {
                e ? t(e) : i.getInstance("ZstdDecoderModule", (e => {
                    try {
                        const s = ((e, t) => {
                                const n = new DataView(e);
                                if (n.byteLength < 32) throw new Error("Invalid spz file: too small");
                                const s = n.getUint32(0, !0),
                                    o = n.getUint32(4, !0);
                                if (1347635022 !== s) {
                                    if (31 === n.getUint8(0) && 139 === n.getUint8(1)) throw new Error("Unsupported spz file: legacy gzip based version, only version 4 is supported");
                                    throw new Error(`Invalid spz file: unexpected magic number 0x${s.toString(16)}`)
                                }
                                if (4 !== o) throw new Error(`Unsupported spz version ${o}, only version 4 is supported`);
                                const r = {
                                    numPoints: n.getUint32(8, !0),
                                    shDegree: n.getUint8(12),
                                    fractionalBits: n.getUint8(13),
                                    flags: n.getUint8(14),
                                    numStreams: n.getUint8(15),
                                    tocByteOffset: n.getUint32(16, !0),
                                    antialiased: !1
                                };
                                if (r.antialiased = 0 != (1 & r.flags), r.shDegree >= c.length) throw new Error(`Invalid spz file: unsupported SH degree ${r.shDegree}`);
                                0 != (2 & r.flags) && console.log("SpzParser: file contains extensions which are not supported and will be ignored");
                                const a = r.numPoints,
                                    i = ["positions", "alphas", "colors", "scales", "rotations", "sh"],
                                    l = [9 * a, a, 3 * a, 3 * a, 4 * a, a * c[r.shDegree] * 3].filter((e => e > 0));
                                if (r.numStreams !== l.length) throw new Error(`Invalid spz file: expected ${l.length} streams, found ${r.numStreams}`);
                                const d = 16 * r.numStreams;
                                if (r.tocByteOffset < 32 || r.tocByteOffset + d > n.byteLength) throw new Error("Invalid spz file: table of contents out of bounds");
                                const p = {};
                                let f = r.tocByteOffset + d;
                                for (let s = 0; s < r.numStreams; s++) {
                                    const o = Number(n.getBigUint64(r.tocByteOffset + 16 * s, !0)),
                                        a = Number(n.getBigUint64(r.tocByteOffset + 16 * s + 8, !0));
                                    if (a !== l[s]) throw new Error(`Invalid spz file: unexpected size of the ${i[s]} stream`);
                                    if (f + o > n.byteLength) throw new Error("Invalid spz file: stream extends past the end of the file");
                                    const c = new Uint8Array(e, f, o);
                                    p[i[s]] = t.decompress(c, a), f += o
                                }
                                return new SpzGSplatData(r, p)
                            })(n, e),
                            o = !1 !== this.app.scene?.gsplatCentersEnabled,
                            r = new GSplatSpzResource(this.app.graphicsDevice, s, {
                                prepareCenters: o
                            });
                        t(null, r)
                    } catch (e) {
                        t(e)
                    }
                }))
            }), n) : t("SpzParser: ZSTD decoder module is not registered. Use WasmModule.setConfig('ZstdDecoderModule', { glueUrl, wasmUrl }) before loading spz files.")
        }
        open(e, t) {
            return t
        }
    }
    e.isNativeSpz = e => {
        try {
            const t = ArrayBuffer.isView(e) ? new DataView(e.buffer, e.byteOffset, e.byteLength) : new DataView(e);
            return t.byteLength >= 32 && 1347635022 === t.getUint32(0, !0) && 4 === t.getUint32(4, !0)
        } catch {
            return !1
        }
    };
    const start = () => {
        const e = pc.Application.getApplication();
        e ? (e => {
            const t = e.loader.getHandler("gsplat");
            t && "function" == typeof t.addParser ? (i.getConfig("ZstdDecoderModule") || i.setConfig("ZstdDecoderModule", {
                glueUrl: "https://mrkorf.arrival.space/app_data/scripts/zstd-2.21.4.wasm.js",
                wasmUrl: "https://mrkorf.arrival.space/app_data/scripts/zstd-2.21.4.wasm.wasm"
            }), t.addParser(new SpzParser(e)), console.log("spz-parser: SPZ v4 parser registered with the gsplat handler")) : console.error("spz-parser: the gsplat handler has no addParser(); engine too old?")
        })(e) : setTimeout(start, 100)
    };
    start()
}();
const NavigationPortalEntity =