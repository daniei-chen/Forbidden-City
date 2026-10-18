/* =============================================================
 *  紫禁城 · 数字复原  —  第三人称漫游（小人）
 *  WASD 移动 / Space 跳跃 / Shift 疾行 / 拖拽环视 / X 切换视角
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
  _camPos: new THREE.Vector3(),
  _tmp: new THREE.Vector3(),
  _smoothInit: false,

  init: function (canvasEl, cameraEl) {
    this.canvas = canvasEl;
    this.camera = cameraEl;
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
    this.canvas.style.cursor = 'crosshair';
    if (this.onEnter) this.onEnter();
  },

  exit: function () {
    if (!this.active) return;
    this.active = false;
    this.dragging = false;
    this.keys = {};
    this.vy = 0;
    this.canvas.style.cursor = 'grab';
    if (this.onExit) this.onExit();
  },

  look: function (dx, dy) {
    this.yaw -= dx * 0.0032;
    const lo = this.thirdPerson ? -0.25 : -1.1;
    const hi = this.thirdPerson ? 1.15 : 1.1;
    this.pitch = Math.max(lo, Math.min(hi, this.pitch - dy * 0.0028));
  },

  jump: function () {
    if (!this.active || !this.onGround) return;
    this.vy = 7.3;
    this.onGround = false;
    if (typeof AUDIO !== 'undefined') AUDIO.jump();
  },

  toggleView: function () {
    this.thirdPerson = !this.thirdPerson;
    if (!this.thirdPerson) {
      this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch));
    }
  },

  /* ---------------- 第三人称相机（简单遮挡收缩） ---------------- */
  updateCamera: function (dt) {
    const cam = this.camera;
    if (this.thirdPerson) {
      const tx = this.pos.x, ty = this.pos.y + 1.2, tz = this.pos.z;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      let dist = this.camDist;
      for (let k = 0; k < 6; k++) {
        const cx = tx + Math.sin(this.yaw) * cp * dist;
        const cz = tz + Math.cos(this.yaw) * cp * dist;
        if (!this.insideCollider(cx, cz, 0.35)) break;
        dist *= 0.72;
      }
      let cy = ty + sp * dist + 0.15;
      const gy = this.groundAt(tx + Math.sin(this.yaw) * cp * dist, tz + Math.cos(this.yaw) * cp * dist);
      if (cy < gy + 0.5) cy = gy + 0.5;
      const desired = this._tmp.set(
        tx + Math.sin(this.yaw) * cp * dist,
        cy,
        tz + Math.cos(this.yaw) * cp * dist
      );
      if (!this._smoothInit) {
        this._camPos.copy(desired);
        this._smoothInit = true;
      } else {
        const k = 1 - Math.exp(-14 * (dt || 0.016));
        this._camPos.lerp(desired, k);
      }
      cam.position.copy(this._camPos);
      cam.lookAt(tx, ty + 0.05, tz);
    } else {
      cam.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
      const cp = Math.cos(this.pitch);
      const dir = new THREE.Vector3(
        -Math.sin(this.yaw) * cp,
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * cp
      );
      cam.lookAt(cam.position.clone().add(dir));
    }
  },

  /* ---------------- 主更新 ---------------- */
  update: function (dt) {
    if (!this.active) return;
    const k = this.keys;

    /* 移动输入（相对相机朝向） */
    const fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
    const strafe = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
    const run = !!k['shift'];
    this.speed = run ? 11.5 : 5.2;
    if (fwd !== 0 || strafe !== 0) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const fx = -sin, fz = -cos;
      const rx = cos, rz = -sin;
      let dx = fx * fwd + rx * strafe;
      let dz = fz * fwd + rz * strafe;
      const len = Math.hypot(dx, dz) || 1;
      dx = dx / len * this.speed * dt;
      dz = dz / len * this.speed * dt;
      const px = this.pos.x, pz = this.pos.z;
      if (!this.blocked(px + dx, pz)) this.pos.x += dx;
      if (!this.blocked(this.pos.x, pz + dz)) this.pos.z += dz;
      const moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
      this.stepDist += moved;
      this.stepSound += moved;
      if (this.stepSound > 0.66 && this.onGround && typeof AUDIO !== 'undefined') {
        this.stepSound = 0;
        AUDIO.step(this.speed > 8);
      }
      this.moving = moved > 1e-4;
      if (this.moving) {
        const targetYaw = Math.atan2(this.pos.x - px, this.pos.z - pz);
        let d = targetYaw - this.avatarYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.avatarYaw += d * Math.min(1, dt * 12);
      }
      if (this.stepDist > 0.78 && typeof EFFECTS !== 'undefined' && EFFECTS.snowAmount > 0.5 && this.onGround) {
        EFFECTS.spawnFootprint(this.pos.x, this.groundAt(this.pos.x, this.pos.z) + 0.05, this.pos.z, this.avatarYaw);
        this.stepDist = 0;
      }
    } else {
      this.moving = false;
    }

    /* 垂直物理 */
    const gy = this.groundAt(this.pos.x, this.pos.z);
    if (!this.onGround) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) {
        this.pos.y = gy;
        this.vy = 0;
        this.onGround = true;
        if (typeof AUDIO !== 'undefined') AUDIO.land();
      }
    } else {
      if (this.pos.y > gy + 0.06) {
        /* 走出台沿，转为下落 */
        this.onGround = false;
        this.vy = 0;
      } else {
        this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 12);
      }
    }

    this.updateCamera(dt);
  }
};
