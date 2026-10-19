/* =============================================================
 *  紫禁城 · 数字复原  —  环境特效
 *  雪粒子 / 星空 / 宫灯点光（全部单 draw call）
 * ============================================================= */
const EFFECTS = {
  snow: null,
  stars: null,
  lanterns: null,
  _snowData: null,
  _time: 0,

  rand: (function () {
    let s = 987654321;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })(),

  init: function (scene) {
    this.scene = scene;
    /* ---------------- 雪 ---------------- */
    const N = CONFIG.quality.high.snow;
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    const drift = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (EFFECTS.rand() - 0.5) * 1900;
      pos[i * 3 + 1] = EFFECTS.rand() * 520;
      pos[i * 3 + 2] = (EFFECTS.rand() - 0.5) * 1800 - 20;
      spd[i] = 8 + EFFECTS.rand() * 16;
      drift[i] = 0.4 + EFFECTS.rand() * 1.6;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sm = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.15, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true, fog: false
    });
    this.snow = new THREE.Points(sg, sm);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);
    this._snowData = { pos: pos, spd: spd, drift: drift, n: N, geo: sg };

    /* ---------------- 星空 ---------------- */
    const SN = 1400;
    const spos = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const u = EFFECTS.rand();
      const v = EFFECTS.rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(0.06 + v * 0.94);
      const r = 3200;
      spos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      spos[i * 3 + 1] = r * Math.cos(phi) + 60;
      spos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const stg = new THREE.BufferGeometry();
    stg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const stm = new THREE.PointsMaterial({
      color: 0xdfe9ff, size: 46, map: TEX.dot(), transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true, fog: false
    });
    this.stars = new THREE.Points(stg, stm);
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    scene.add(this.stars);

    /* ---------------- 宫灯 ---------------- */
    const lampPts = [];
    for (let z = 440; z >= -470; z -= 38) {
      lampPts.push([-9.5, 9.5, z], [9.5, 9.5, z]);
    }
    for (let z = 100; z >= -80; z -= 42) {
      lampPts.push([-52, 11.5, z], [52, 11.5, z]);
    }
    const gates = [
      [-22, 13, 470], [22, 13, 470], [-14, 11, 296], [14, 11, 296],
      [-12, 10, -136], [12, 10, -136], [-16, 14, -476], [16, 14, -476]
    ];
    for (let i = 0; i < gates.length; i++) lampPts.push(gates[i]);

    const lp = new Float32Array(lampPts.length * 3);
    for (let i = 0; i < lampPts.length; i++) {
      lp[i * 3] = lampPts[i][0];
      lp[i * 3 + 1] = lampPts[i][1];
      lp[i * 3 + 2] = lampPts[i][2];
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const nm = new THREE.PointsMaterial({
      color: 0xff9a4a, size: 9, map: TEX.cloud(), transparent: true,
      opacity: 0, depthWrite: false, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, fog: false
    });
    this.lanterns = new THREE.Points(ng, nm);
    this.lanterns.frustumCulled = false;
    this.lanterns.visible = false;
    scene.add(this.lanterns);

    this._lampGeom = ng;
    this.initFootprints(scene);
    this.initBirds(scene);
    this.initButterflies(scene);
    this.initLeaves(scene);
    this.initLanterns(scene);
    this.initCloudShadows(scene);
  },

  /* ---------------- 云影（地面移动阴影） ---------------- */
  cloudShadows: [],
  cloudTime: 0,
  initCloudShadows: function (scene) {
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 105), MATS.cloudShadow);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((Math.random() - 0.5) * 640, 0.3, (Math.random() - 0.5) * 640);
      mesh.renderOrder = 1;
      mesh.receiveShadow = false;
      scene.add(mesh);
      this.cloudShadows.push({ mesh: mesh, vx: 2.2 + Math.random() * 2.4, vz: (Math.random() - 0.5) * 1.6 });
    }
  },
  updateCloudShadows: function (dt, st) {
    const show = st.stars < 0.45 && st.snow < 0.4;
    this.cloudTime += dt;
    for (let i = 0; i < this.cloudShadows.length; i++) {
      const c = this.cloudShadows[i];
      c.mesh.visible = show;
      if (!show) continue;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.z += c.vz * dt;
      if (c.mesh.position.x > 520) c.mesh.position.x = -520;
      if (c.mesh.position.z > 520) c.mesh.position.z = -520;
      if (c.mesh.position.z < -520) c.mesh.position.z = 520;
    }
  },

  updateLanternGlow: function (st) {
    if (!this.lanternGlows) return;
    const k = (st && st.lanterns != null) ? Math.max(0, Math.min(1, st.lanterns)) : 0;
    for (let i = 0; i < this.lanternGlows.length; i++) {
      this.lanternGlows[i].material.opacity = k * 0.5;
    }
    if (this.lanternGroundMat) this.lanternGroundMat.opacity = k * 0.32;
  },
  /* ---------------- 飘叶 ---------------- */
  leaves: null,
  leafData: null,
  leafTime: 0,
  LEAF_REGIONS: [
    { x: 0, z: -330, w: 220, d: 120 },   /* 御花园 */
    { x: 0, z: 195, w: 200, d: 130 },    /* 太和殿广场 */
    { x: 0, z: -190, w: 150, d: 80 }     /* 后三宫 */
  ],
  initLeaves: function (scene) {
    const N = 200;
    const g = new THREE.BufferGeometry();
    /* 一片叶子：两段折面 */
    const verts = new Float32Array([
      0, 0, 0, -0.16, 0, 0.24, 0.16, 0, 0.24,
      0, 0, 0, 0.03, 0.04, -0.22, -0.03, 0.04, -0.22
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide
    });
    const inst = new THREE.InstancedMesh(g, mat, N);
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.visible = false;
    scene.add(inst);
    this.leaves = inst;
    const data = [];
    const cols = [0xc9a24a, 0xb07a2e, 0x8f9a4a, 0xa8893a, 0x6f8a3e];
    for (let i = 0; i < N; i++) {
      const reg = this.LEAF_REGIONS[Math.floor(Math.random() * this.LEAF_REGIONS.length)];
      data.push({
        x: reg.x + (Math.random() - 0.5) * reg.w,
        y: 1.6 + Math.random() * 13,
        z: reg.z + (Math.random() - 0.5) * reg.d,
        reg: reg,
        spd: 0.5 + Math.random() * 1.1,
        sway: 0.6 + Math.random() * 1.4,
        phase: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 2.5,
        size: 0.9 + Math.random() * 0.8
      });
      inst.setColorAt(i, new THREE.Color(cols[Math.floor(Math.random() * cols.length)]));
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.leafData = data;
  },
  updateLeaves: function (dt, st) {
    if (!this.leaves) return;
    const show = st.stars < 0.55 && st.snow < 0.35;
    this.leaves.visible = show;
    if (!show) return;
    this.leafTime += dt;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < this.leafData.length; i++) {
      const L = this.leafData[i];
      L.y -= L.spd * dt;
      L.x += Math.sin(this.leafTime * 1.3 + L.phase) * L.sway * dt;
      L.z += Math.cos(this.leafTime * 1.1 + L.phase) * L.sway * 0.6 * dt;
      if (L.y < 0.15) {
        const reg = this.LEAF_REGIONS[Math.floor(Math.random() * this.LEAF_REGIONS.length)];
        L.reg = reg;
        L.x = reg.x + (Math.random() - 0.5) * reg.w;
        L.z = reg.z + (Math.random() - 0.5) * reg.d;
        L.y = 3 + Math.random() * 14;
      }
      p.set(L.x, L.y, L.z);
      e.set(
        this.leafTime * L.spin + L.phase,
        this.leafTime * L.spin * 0.7,
        Math.sin(this.leafTime * 2 + L.phase) * 0.9
      );
      q.setFromEuler(e);
      s.set(L.size, L.size, L.size);
      m.compose(p, q, s);
      this.leaves.setMatrixAt(i, m);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
  },

  /* ---------------- 宫灯（灯柱 + 悬挂灯笼，随风轻摆） ---------------- */
  lanternPosts: null,
  lanternBodies: null,
  lanternData: null,
  lanternTime: 0,
  initLanterns: function (scene) {
    const spots = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        spots.push([sx * 12.5, 168 + i * 46]);
      }
    }
    /* 灯柱（静态合批） */
    const posts = [];
    for (let i = 0; i < spots.length; i++) {
      const post = new THREE.CylinderGeometry(0.075, 0.095, 3.1, 7);
      post.translate(spots[i][0], 1.55, spots[i][1]);
      posts.push(post);
      const base = new THREE.BoxGeometry(0.42, 0.22, 0.42);
      base.translate(spots[i][0], 0.11, spots[i][1]);
      posts.push(base);
      const arm = new THREE.BoxGeometry(0.5, 0.07, 0.07);
      arm.translate(spots[i][0], 3.12, spots[i][1]);
      posts.push(arm);
    }
    const postMesh = new THREE.Mesh(GEOM.merge(posts), MATS.column);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    scene.add(postMesh);
    this.lanternPosts = postMesh;

    /* 灯笼体（实例化，悬于灯柱下，可摆动） */
    const bodyGeo = new THREE.SphereGeometry(0.24, 10, 8);
    bodyGeo.scale(1, 1.18, 1);
    bodyGeo.translate(0, -0.72, 0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xb3281e, roughness: 0.55, metalness: 0.05,
      emissive: 0x5a0f0a, emissiveIntensity: 1.0
    });
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, spots.length);
    bodies.frustumCulled = false;
    scene.add(bodies);
    this.lanternBodies = bodies;

    /* 金盖 + 流苏（实例化） */
    const capParts = [];
    const cap = new THREE.CylinderGeometry(0.1, 0.14, 0.09, 8);
    cap.translate(0, -0.36, 0);
    capParts.push(cap);
    const cap2 = new THREE.CylinderGeometry(0.14, 0.1, 0.09, 8);
    cap2.translate(0, -1.04, 0);
    capParts.push(cap2);
    const tassel = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5);
    tassel.translate(0, -1.2, 0);
    capParts.push(tassel);
    const capGeo = GEOM.merge(capParts);
    const caps = new THREE.InstancedMesh(capGeo, MATS.goldDark, spots.length);
    caps.frustumCulled = false;
    scene.add(caps);
    this.lanternCaps = caps;

    /* 宫灯光晕（加法精灵）+ 地面光斑 */
    this.lanternGlows = [];
    for (let i = 0; i < spots.length; i++) {
      const m = new THREE.SpriteMaterial({
        map: TEX.dot(), color: 0xffb060, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const sp = new THREE.Sprite(m);
      sp.position.set(spots[i][0], 2.42, spots[i][1]);
      sp.scale.set(4.6, 4.6, 1);
      scene.add(sp);
      this.lanternGlows.push(sp);
    }
    const groundGeos = [];
    for (let i = 0; i < spots.length; i++) {
      const g = new THREE.PlaneGeometry(7.5, 7.5);
      g.rotateX(-Math.PI / 2);
      g.translate(spots[i][0], 0.07, spots[i][1]);
      groundGeos.push(g);
    }
    this.lanternGroundMat = new THREE.MeshBasicMaterial({
      map: TEX.dot(), color: 0xffa860, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const groundMesh = new THREE.Mesh(GEOM.merge(groundGeos), this.lanternGroundMat);
    groundMesh.renderOrder = 2;
    scene.add(groundMesh);
    this.lanternGround = groundMesh;
    this.lanternData = spots.map(function (p) {
      return { x: p[0], y: 3.14, z: p[1], phase: Math.random() * 6.28 };
    });
  },
  updateLanterns: function (dt) {
    if (!this.lanternBodies) return;
    this.lanternTime += dt;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < this.lanternData.length; i++) {
      const L = this.lanternData[i];
      p.set(L.x, L.y, L.z);
      e.set(
        Math.sin(this.lanternTime * 1.2 + L.phase) * 0.045,
        0,
        Math.cos(this.lanternTime * 0.9 + L.phase) * 0.055
      );
      q.setFromEuler(e);
      m.compose(p, q, s);
      this.lanternBodies.setMatrixAt(i, m);
      this.lanternCaps.setMatrixAt(i, m);
    }
    this.lanternBodies.instanceMatrix.needsUpdate = true;
    this.lanternCaps.instanceMatrix.needsUpdate = true;
  },

  /* ---------------- 蝴蝶（花园） ---------------- */
  butterflies: null,
  butterflyAnchors: null,
  butterflyTime: 0,
  initButterflies: function (scene) {
    const spots = [[18, -350], [-18, -352], [44, -312], [-44, -314], [0, -396], [-60, -300], [60, -300]];
    const geo = new THREE.PlaneGeometry(0.22, 0.16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcf6e, side: THREE.DoubleSide });
    const inst = new THREE.InstancedMesh(geo, mat, 10);
    inst.frustumCulled = false;
    scene.add(inst);
    this.butterflies = inst;
    this.butterflyAnchors = [];
    for (let i = 0; i < 10; i++) {
      const a = spots[i % spots.length];
      this.butterflyAnchors.push({
        ax: a[0], az: a[1],
        phase: Math.random() * 6.28,
        r: 2 + TEX.rand() * 3,
        sp: 0.4 + Math.random() * 0.5
      });
    }
  },
  updateButterflies: function (dt, st) {
    const b = this.butterflies;
    if (!b) return;
    const show = st ? st.snow < 0.6 : true;
    b.visible = show;
    if (!show) return;
    this.butterflyTime += dt;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < this.butterflyAnchors.length; i++) {
      const a = this.butterflyAnchors[i];
      const t = this.butterflyTime * a.sp + a.phase;
      p.set(
        a.ax + Math.cos(t) * a.r,
        0.9 + Math.sin(t * 1.7) * 0.35 + Math.abs(Math.sin(t * 3)) * 0.3,
        a.az + Math.sin(t * 0.8) * a.r
      );
      e.set(0, t * 2.0, Math.sin(t * 14) * 0.6);
      q.setFromEuler(e);
      s.set(1, Math.abs(Math.sin(t * 14)) * 0.7 + 0.4, 1);
      m.compose(p, q, s);
      b.setMatrixAt(i, m);
    }
    b.instanceMatrix.needsUpdate = true;
  },

  /* ---------------- 飞鸟群 ---------------- */
  birds: null,
  birdData: null,
  birdTime: 0,
  initBirds: function (scene) {
    const N = 22;
    const g = new THREE.BufferGeometry();
    /* 简化的 V 形飞鸟（左右翼 + 身体） */
    const verts = new Float32Array([
      0, 0, 0.12, -0.75, 0.1, -0.15, -0.28, 0.02, -0.32,
      0, 0, 0.12, 0.75, 0.1, -0.15, 0.28, 0.02, -0.32,
      0, 0.02, 0.2, -0.05, 0, -0.45, 0.05, 0, -0.45
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e2b28, roughness: 0.85, side: THREE.DoubleSide
    });
    const inst = new THREE.InstancedMesh(g, mat, N);
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.visible = false;
    scene.add(inst);
    this.birds = inst;
    const data = [];
    for (let i = 0; i < N; i++) {
      data.push({
        radius: 150 + Math.random() * 190,
        height: 55 + Math.random() * 80,
        speed: 0.045 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
        flap: 1.6 + Math.random() * 1.4,
        cx: (Math.random() - 0.5) * 160,
        cz: (Math.random() - 0.5) * 160,
        scale: 0.8 + Math.random() * 0.8
      });
    }
    this.birdData = data;
  },
  updateBirds: function (dt, st) {
    if (!this.birds) return;
    const show = st.stars < 0.35;
    this.birds.visible = show;
    if (!show) return;
    this.birdTime += dt;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < this.birdData.length; i++) {
      const b = this.birdData[i];
      const a = this.birdTime * b.speed + b.phase;
      p.set(
        b.cx + Math.cos(a) * b.radius,
        b.height + Math.sin(a * 2.1 + i) * 6,
        b.cz + Math.sin(a) * b.radius
      );
      e.set(Math.sin(a * 2) * 0.2, -a + Math.PI / 2, Math.sin(this.birdTime * b.flap + i) * 0.5);
      q.setFromEuler(e);
      s.set(b.scale, b.scale, b.scale);
      m.compose(p, q, s);
      this.birds.setMatrixAt(i, m);
    }
    this.birds.instanceMatrix.needsUpdate = true;
  },

  /* 画质切换时调整雪花数量 */
  setQuality: function (q) {
    if (!this.snow) return;
    const count = Math.min(q.snow, this._snowData.n);
    this._snowData.geo.setDrawRange(0, count);
  },

  /* ---------------- 雪地脚印 ---------------- */
  footprints: [],
  fpIndex: 0,
  fpSide: 1,
  snowAmount: 0,
  initFootprints: function (scene) {
    const N = 96;
    const mat = new THREE.MeshBasicMaterial({
      map: TEX.footprint(), transparent: true, opacity: 0,
      color: 0x6b7886, depthWrite: false
    });
    const geo = new THREE.PlaneGeometry(0.52, 0.92);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.footprints.push({ mesh: m, life: 0 });
    }
  },
  spawnFootprint: function (x, y, z, yaw) {
    if (!this.footprints.length) return;
    const f = this.footprints[this.fpIndex % this.footprints.length];
    this.fpIndex++;
    this.fpSide = -this.fpSide;
    const rx = Math.cos(yaw) * 0.2 * this.fpSide;
    const rz = -Math.sin(yaw) * 0.2 * this.fpSide;
    f.mesh.position.set(x + rx, y + 0.03, z + rz);
    f.mesh.rotation.y = yaw + (this.fpSide > 0 ? 0.04 : -0.04);
    f.mesh.visible = true;
    f.mesh.material.opacity = 0.55;
    f.life = 1;
  },
  updateFootprints: function (dt) {
    for (let i = 0; i < this.footprints.length; i++) {
      const f = this.footprints[i];
      if (!f.mesh.visible) continue;
      f.life -= dt * 0.012;
      if (f.life <= 0) {
        f.life = 0;
        f.mesh.visible = false;
        continue;
      }
      f.mesh.material.opacity = 0.55 * Math.min(1, f.life * 2.2);
    }
  },

  /* ---------------- 爱心粒子（投喂御猫） ---------------- */
  _heartTex: null,
  _hearts: null,
  initHearts: function () {
    if (this._hearts) return;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#ff8aa6';
    g.beginPath();
    g.moveTo(32, 56);
    g.bezierCurveTo(4, 34, 10, 10, 32, 22);
    g.bezierCurveTo(54, 10, 60, 34, 32, 56);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(22, 24, 5, 7, -0.5, 0, 6.28);
    g.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    this._heartTex = tex;
    const pool = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.35, 0.35, 1);
      sp.visible = false;
      (this.scene || this.root).add(sp);
      pool.push({ sp: sp, life: 0, ttl: 1, vx: 0, vy: 0, vz: 0 });
    }
    this._hearts = pool;
  },
  spawnHeart: function (x, y, z) {
    this.initHearts();
    const pool = this._hearts;
    for (let i = 0; i < pool.length; i++) {
      const h = pool[i];
      if (h.life > 0) continue;
      h.life = h.ttl = 1.5 + Math.random() * 0.5;
      h.sp.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
      h.sp.material.opacity = 0.95;
      h.sp.visible = true;
      h.vx = (Math.random() - 0.5) * 0.35;
      h.vy = 0.7 + Math.random() * 0.35;
      h.vz = (Math.random() - 0.5) * 0.35;
      return;
    }
  },
  updateHearts: function (dt) {
    const pool = this._hearts;
    if (!pool) return;
    for (let i = 0; i < pool.length; i++) {
      const h = pool[i];
      if (h.life <= 0) continue;
      h.life -= dt;
      if (h.life <= 0) { h.sp.visible = false; h.sp.material.opacity = 0; continue; }
      h.sp.position.x += h.vx * dt;
      h.sp.position.y += h.vy * dt;
      h.sp.position.z += h.vz * dt;
      h.vy *= 0.985;
      const k = h.life / h.ttl;
      h.sp.material.opacity = Math.min(1, k * 1.8);
      const s = 0.35 + (1 - k) * 0.22;
      h.sp.scale.set(s, s, 1);
    }
  },

  update: function (dt, st) {
    this._time += dt;
    /* 静态评测：隐藏全部动态元素并跳过更新（截图可复现） */
    if (this.staticMode) {
      if (this.snow) this.snow.visible = false;
      if (this.stars) this.stars.visible = false;
      if (this.leaves) this.leaves.visible = false;
      if (this.birds) this.birds.visible = false;
      if (this.lanternBodies) this.lanternBodies.visible = false;
      if (this.butterflies) this.butterflies.visible = false;
      if (this.lanternCaps) this.lanternCaps.visible = false;
      if (this.lanternPosts) this.lanternPosts.visible = false;
      if (this.cloudShadows) {
        for (let i = 0; i < this.cloudShadows.length; i++) this.cloudShadows[i].mesh.visible = false;
      }
      for (let i = 0; i < this.footprints.length; i++) this.footprints[i].mesh.visible = false;
      return;
    }
    this.snowAmount = st.snow;
    this.updateBirds(dt, st);
    this.updateLeaves(dt, st);
    this.updateLanterns(dt);
    this.updateLanternGlow(st);
    this.updateButterflies(dt, st);
    this.updateCloudShadows(dt, st);
    if (st.snow < 0.2) {
      for (let i = 0; i < this.footprints.length; i++) {
        if (this.footprints[i].mesh.visible) {
          this.footprints[i].mesh.visible = false;
          this.footprints[i].life = 0;
        }
      }
    } else {
      this.updateFootprints(dt);
    }

    /* 雪 */
    const snowOn = st.snow > 0.015;
    this.snow.visible = snowOn;
    if (snowOn) {
      const m = this.snow.material;
      m.opacity = st.snow * 0.95;
      const d = this._snowData;
      const arr = d.pos;
      const count = this._snowData.geo.drawRange.count === Infinity
        ? d.n : Math.min(this._snowData.geo.drawRange.count, d.n);
      for (let i = 0; i < count; i++) {
        let y = arr[i * 3 + 1] - d.spd[i] * dt;
        if (y < 0) y += 520;
        arr[i * 3 + 1] = y;
        arr[i * 3] += Math.sin(this._time * 0.7 + i) * d.drift[i] * dt;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    /* 星空 */
    const starsOn = st.stars > 0.01;
    this.stars.visible = starsOn;
    if (starsOn) {
      this.stars.material.opacity = st.stars * (0.72 + 0.28 * Math.sin(this._time * 0.6));
    }

    /* 宫灯 */
    const lampOn = st.lanterns > 0.01;
    this.lanterns.visible = lampOn;
    if (lampOn) {
      this.lanterns.material.opacity = st.lanterns * (0.85 + 0.15 * Math.sin(this._time * 2.4));
    }
  }
};
