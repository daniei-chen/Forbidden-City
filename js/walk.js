/* =============================================================
 *  紫禁城 · 数字复原  —  第三人称漫游（小人）
 *  WASD 移动 / Space 跳跃 / Shift 疾行 / 拖拽环视 / X 切换视角
 *  游戏化手感：加速度/惯性、土狼时间、跳跃缓冲、可变跳高、
 *            落地缓冲、头部摆动、疾行 FOV、相机碰撞收缩
 * ============================================================= */
const WALK = {
  active: false,
  pos: new THREE.Vector3(0, 0, 430),
  yaw: 0,
  pitch: 0.16,
  eye: 1.68,
  keys: {},
  colliders: [],
  radius: 0.42,
  stepDist: 0,
  canvas: null,
  camera: null,
  dragging: false,
  lastX: 0,
  lastY: 0,
  onEnter: null,
  onExit: null,

  /* 第三人称 */
  thirdPerson: true,
  camDist: 4.6,
  avatarYaw: Math.PI,
  vy: 0,
  onGround: true,
  moving: false,
  speed: 0,
  stepSound: 0,

  /* 手感状态 */
  vx: 0,
  vz: 0,
  coyote: 0,
  jumpBuffer: 0,
  landDip: 0,
  bobPhase: 0,
  baseFov: 60,
  fovNow: 60,
  jumpHeld: false,
  pad: null,
  touchMove: null,
  walkSpeed: 5.2,
  runSpeed: 11.5,

  _camPos: new THREE.Vector3(),
  _tmp: new THREE.Vector3(),
  _smoothInit: false,

  init: function (canvasEl, cameraEl) {
    this.canvas = canvasEl;
    this.camera = cameraEl;
    this.baseFov = cameraEl.fov || 60;
    this.fovNow = this.baseFov;
  },

  setColliders: function (list) { this.colliders = list || []; },

  /* ---------------- 地面高度 ---------------- */
  groundAt: function (x, z) {
    /* 殿内 / 台基顶面（含檐廊） */
    if (Math.abs(x) <= 35.5 && z >= 36.5 && z <= 80.5) return 10.63;
    if (Math.abs(x) <= 18 && z >= -14 && z <= 10) return 9.33;
    if (Math.abs(x) <= 30.8 && z >= -69.5 && z <= -43.5) return 9.43;
    /* 月台（太和殿前，9.63） */
    if (Math.abs(x) <= 50.2 && z >= 77 && z <= 112) return 9.63;
    /* 三台台面（8.13） */
    if (Math.abs(x) <= 60.3 && z >= -83 && z <= 112) return 8.13;
    /* 正面三出陛（9.63 → 0） */
    if (Math.abs(x) <= 34 && z > 112 && z <= 146) {
      const t = (z - 112) / 34;
      return 9.63 * (1 - t);
    }
    /* 保和殿后台阶（8.13 → 0） */
    if (Math.abs(x) <= 13 && z >= -107 && z < -83) {
      const t = (-83 - z) / 24;
      return 8.13 * (1 - Math.max(0, Math.min(1, t)));
    }
    /* 御道抬升 */
    if (Math.abs(x) <= 9.2 && z >= 145 && z <= 455) return 0.12;
    if (Math.abs(x) <= 6.2 && z >= -140 && z <= -82) return 0.1;
    if (Math.abs(x) <= 5.2 && z >= -475 && z <= -145) return 0.1;
    return 0;
  },

  insideCollider: function (x, z, pad) {
    const r = pad == null ? this.radius : pad;
    const cols = this.colliders;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  },

  /* 脚下材质：snow / marble（台基殿内）/ grass（御花园）/ stone（石板） */
  surfaceAt: function (x, z) {
    if (typeof EFFECTS !== 'undefined' && EFFECTS.snowAmount > 0.5) return 'snow';
    if (this.groundAt(x, z) > 6) return 'marble';
    if (z < -290 && Math.abs(x) < 140) return 'grass';
    return 'stone';
  },

  /* 区域：广场 / 御花园 / 殿内（驱动环境音） */
  zoneAt: function (x, z) {
    const interior =
      (Math.abs(x) <= 35.5 && z >= 36.5 && z <= 80.5) ||
      (Math.abs(x) <= 18 && z >= -14 && z <= 10) ||
      (Math.abs(x) <= 30.8 && z >= -69.5 && z <= -43.5);
    if (interior) return 'interior';
    if (z < -290 && Math.abs(x) < 140) return 'garden';
    return 'plaza';
  },

  blocked: function (nx, nz) {
    /* 高差过大（仅地面状态；跳跃时允许跨越） */
    if (this.onGround) {
      const dy = this.groundAt(nx, nz) - this.groundAt(this.pos.x, this.pos.z);
      if (dy > 1.35) return true;
    }
    if (this.insideCollider(nx, nz)) return true;
    if (Math.abs(nx) > 370 || nz > 474 || nz < -475) return true;
    return false;
  },

  /* ---------------- 进入 / 退出 ---------------- */
  enter: function () {
    if (this.active) return;
    this.active = true;
    this.keys = {};
    this.pos.set(0, 0, 430);
    this.pos.y = this.groundAt(this.pos.x, this.pos.z);
    this.yaw = 0;
    this.pitch = 0.16;
    this.thirdPerson = true;
    this.camDist = 4.6;
    this.vy = 0;
    this.onGround = true;
    this.avatarYaw = Math.PI;
    this.moving = false;
    this._smoothInit = false;
    this.stepSound = 0;
    this.stepDist = 0;
    this.vx = 0;
    this.vz = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.landDip = 0;
    this.bobPhase = 0;
    this.jumpHeld = false;
    this.baseFov = this.camera ? this.camera.fov : 60;
    this.fovNow = this.baseFov;
    this._zone = 'plaza';
    this._zoneT = 0;
    if (typeof AUDIO !== 'undefined' && AUDIO.setZone) AUDIO.setZone('plaza');
    this.canvas.style.cursor = 'crosshair';
    if (this.onEnter) this.onEnter();
  },

  exit: function () {
    if (!this.active) return;
    this.active = false;
    this.dragging = false;
    this.keys = {};
    this.vy = 0;
    this.vx = 0;
    this.vz = 0;
    this.canvas.style.cursor = 'grab';
    /* 恢复视角 FOV */
    if (this.camera) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
    if (typeof AUDIO !== 'undefined' && AUDIO.setZone) AUDIO.setZone('plaza');
    if (this.onExit) this.onExit();
  },

  look: function (dx, dy) {
    this.yaw -= dx * 0.0032;
    const lo = this.thirdPerson ? -0.25 : -1.1;
    const hi = this.thirdPerson ? 1.15 : 1.1;
    this.pitch = Math.max(lo, Math.min(hi, this.pitch - dy * 0.0028));
  },

  /* 跳跃：土狼时间 + 缓冲 + 可变跳高 */
  _tryJump: function () {
    if (!this.active) return false;
    const canJump = this.onGround || this.coyote > 0;
    if (!canJump) { this.jumpBuffer = 0.16; return false; }
    this.vy = 7.6;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = true;
    if (typeof AUDIO !== 'undefined') AUDIO.jump();
    return true;
  },

  jump: function () {
    this._tryJump();
  },

  /* 松开空格：可变跳高（短按小跳） */
  releaseJump: function () {
    this.jumpHeld = false;
    if (!this.onGround && this.vy > 2.2) this.vy *= 0.55;
  },

  toggleView: function () {
    this.thirdPerson = !this.thirdPerson;
    if (!this.thirdPerson) {
      this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch));
    }
  },

  /* ---------------- 相机：碰撞收缩 + 摆动 + 落地缓冲 + FOV ---------------- */
  updateCamera: function (dt) {
    const cam = this.camera;
    const bobAmp = this.thirdPerson ? 0.018 : 0.042;
    const speedK = Math.min(1, Math.abs(this.speed) / this.runSpeed);
    const bob = this.onGround ? Math.sin(this.bobPhase * 2) * bobAmp * speedK : 0;
    const dip = this.landDip;
    this.landDip *= Math.exp(-9 * (dt || 0.016));

    if (this.thirdPerson) {
      const tx = this.pos.x, ty = this.pos.y + 1.2, tz = this.pos.z;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      let dist = this.camDist;
      /* 相机碰撞：逐步收缩，避免穿墙 */
      for (let k = 0; k < 8; k++) {
        const cxx = tx + sy * cp * dist;
        const czz = tz + cy * cp * dist;
        if (!this.insideCollider(cxx, czz, 0.4)) break;
        dist *= 0.75;
      }
      let targetY = ty + sp * dist + 0.15 + bob - dip;
      const gy = this.groundAt(tx + sy * cp * dist, tz + cy * cp * dist);
      if (targetY < gy + 0.55) targetY = gy + 0.55;
      const desired = this._tmp.set(tx + sy * cp * dist, targetY, tz + cy * cp * dist);
      if (!this._smoothInit) {
        this._camPos.copy(desired);
        this._smoothInit = true;
      } else {
        const k = 1 - Math.exp(-14 * (dt || 0.016));
        this._camPos.lerp(desired, k);
      }
      cam.position.copy(this._camPos);
      cam.lookAt(tx, ty + 0.05, tz);
      cam.rotateZ(Math.sin(this.bobPhase) * 0.0022 * speedK);
    } else {
      const px = this.pos.x + Math.cos(this.bobPhase) * 0.012 * speedK;
      cam.position.set(px, this.pos.y + this.eye + bob - dip, this.pos.z);
      const cp = Math.cos(this.pitch);
      const dir = this._tmp.set(
        -Math.sin(this.yaw) * cp,
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * cp
      );
      cam.lookAt(cam.position.x + dir.x, cam.position.y + dir.y, cam.position.z + dir.z);
      cam.rotateZ(Math.sin(this.bobPhase) * 0.0045 * speedK);
    }

    /* 疾行 FOV 推进 */
    const runFov = (this.moving && this.onGround && this.keys['shift']) ? 5.0 : 0;
    const targetFov = this.baseFov + runFov;
    this.fovNow += (targetFov - this.fovNow) * Math.min(1, (dt || 0.016) * 7);
    if (Math.abs(this.fovNow - cam.fov) > 0.01) {
      cam.fov = this.fovNow;
      cam.updateProjectionMatrix();
    }
  },

  /* ---------------- 主更新 ---------------- */
  update: function (dt) {
    if (!this.active) return;
    const k = this.keys;

    /* 移动输入（相对相机朝向） */
    let fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    let strafe = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    if (this.pad) { fwd += this.pad.y; strafe += this.pad.x; }
    if (this.touchMove) { fwd += this.touchMove.y; strafe += this.touchMove.x; }
    fwd = Math.max(-1, Math.min(1, fwd));
    strafe = Math.max(-1, Math.min(1, strafe));
    const run = !!k['shift'];
    const hasInput = Math.abs(fwd) > 0.01 || Math.abs(strafe) > 0.01;

    let dirX = 0, dirZ = 0;
    if (hasInput) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const fx = -sin, fz = -cos;
      const rx = cos, rz = -sin;
      let dx = fx * fwd + rx * strafe;
      let dz = fz * fwd + rz * strafe;
      const len = Math.hypot(dx, dz) || 1;
      dirX = dx / len;
      dirZ = dz / len;
    }

    /* 加速度 / 惯性 */
    const targetSpeed = hasInput ? (run ? this.runSpeed : this.walkSpeed) : 0;
    const targetVX = dirX * targetSpeed;
    const targetVZ = dirZ * targetSpeed;
    const accel = this.onGround ? (hasInput ? 36 : 28) : (hasInput ? 12 : 6);
    const blend = 1 - Math.exp(-accel * dt);
    this.vx += (targetVX - this.vx) * blend;
    this.vz += (targetVZ - this.vz) * blend;
    if (Math.abs(this.vx) < 0.02) this.vx = 0;
    if (Math.abs(this.vz) < 0.02) this.vz = 0;
    this.speed = Math.hypot(this.vx, this.vz);

    /* 位移：分步 + 轴分离滑墙 */
    const moveX = this.vx * dt, moveZ = this.vz * dt;
    const total = Math.hypot(moveX, moveZ);
    const steps = total > 0.16 ? Math.ceil(total / 0.16) : 1;
    let moved = 0;
    for (let s = 0; s < steps; s++) {
      const sx = moveX / steps, sz = moveZ / steps;
      const px = this.pos.x, pz = this.pos.z;
      if (!this.blocked(px + sx, pz)) this.pos.x += sx; else this.vx = 0;
      if (!this.blocked(this.pos.x, pz + sz)) this.pos.z += sz; else this.vz = 0;
      moved += Math.hypot(this.pos.x - px, this.pos.z - pz);
    }
    this.stepDist += moved;
    this.stepSound += moved;
    this.bobPhase += moved * 2.2;
    if (this.stepSound > 0.66 && this.onGround && typeof AUDIO !== 'undefined') {
      this.stepSound = 0;
      AUDIO.step(this.speed > 8, this.surfaceAt(this.pos.x, this.pos.z));
    }
    this.moving = moved > 1e-4;
    if (this.moving) {
      const targetYaw = Math.atan2(this.vx, this.vz);
      let d = targetYaw - this.avatarYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.avatarYaw += d * Math.min(1, dt * 12);
    }
    if (this.stepDist > 0.78 && typeof EFFECTS !== 'undefined' && EFFECTS.snowAmount > 0.5 && this.onGround) {
      EFFECTS.spawnFootprint(this.pos.x, this.groundAt(this.pos.x, this.pos.z) + 0.05, this.pos.z, this.avatarYaw);
      this.stepDist = 0;
    }

    /* 土狼时间 / 跳跃缓冲 */
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) this._tryJump();

    /* 垂直物理 */
    const gy = this.groundAt(this.pos.x, this.pos.z);
    if (!this.onGround) {
      this.vy -= 24 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) {
        const landSpeed = -this.vy;
        this.pos.y = gy;
        this.vy = 0;
        this.onGround = true;
        this.landDip = Math.min(0.24, Math.max(0, (landSpeed - 5) * 0.022));
        if (typeof AUDIO !== 'undefined') AUDIO.land(this.surfaceAt(this.pos.x, this.pos.z));
      }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.pos.y > gy + 0.06) {
        this.onGround = false;
        this.coyote = 0.14;
        this.vy = 0;
      } else {
        this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 12);
        this.coyote = 0.14;
      }
    }

    /* 区域环境音（0.4s 节流） */
    this._zoneT = (this._zoneT || 0) + dt;
    if (this._zoneT > 0.4) {
      this._zoneT = 0;
      const zone = this.zoneAt(this.pos.x, this.pos.z);
      if (zone !== this._zone) {
        this._zone = zone;
        if (typeof AUDIO !== 'undefined' && AUDIO.setZone) AUDIO.setZone(zone);
      }
    }

    this.updateCamera(dt);
  }
};

if (typeof window !== 'undefined') window.WALK = WALK;
