/* =============================================================
 *  紫禁城 · 数字复原  —  宫廷人物
 *  静态侍卫（宫门站岗） + 巡游侍卫（沿御道/广场行走）
 * ============================================================= */
const NPC = {
  group: null,
  statics: [],
  patrols: [],
  time: 0,

  _mat: function () {
    if (NPC._mats) return NPC._mats;
    NPC._mats = {
      robe: new THREE.MeshStandardMaterial({ color: 0x2f3f6d, roughness: 0.75 }),
      robeDark: new THREE.MeshStandardMaterial({ color: 0x24304f, roughness: 0.8 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xb8913c, roughness: 0.45, metalness: 0.45 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xe7c49c, roughness: 0.65 }),
      hat: new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8d9199, roughness: 0.35, metalness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x4b2f1c, roughness: 0.85 }),
      red: new THREE.MeshStandardMaterial({ color: 0xa52a1e, roughness: 0.6 })
    };
    return NPC._mats;
  },

  /* 单个侍卫（可动），返回 { group, parts } */
  makeGuard: function (opt) {
    opt = opt || {};
    const M = this._mat();
    const robeMat = opt.robeColor ? new THREE.MeshStandardMaterial({ color: opt.robeColor, roughness: 0.75 }) : M.robe;
    const trimMat = opt.trimColor ? new THREE.MeshStandardMaterial({ color: opt.trimColor, roughness: 0.45, metalness: 0.45 }) : M.trim;
    const g = new THREE.Group();
    const legL = new THREE.Group(); legL.position.set(-0.09, 0.52, 0);
    const legR = new THREE.Group(); legR.position.set(0.09, 0.52, 0);
    for (const leg of [legL, legR]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.3, 7), M.robeDark);
      thigh.position.y = -0.15; leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.24, 7), M.robeDark);
      shin.position.y = -0.4; leg.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.2), M.hat);
      boot.position.set(0, -0.52, 0.04); leg.add(boot);
      g.add(leg);
    }
    /* 身体 */
    const body = new THREE.Group(); body.position.y = 0.52;
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.52, 10), robeMat);
    robe.position.y = 0.26; body.add(robe);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.218, 0.06, 10), trimMat);
    hem.position.y = 0.02; body.add(hem);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.158, 0.06, 10), trimMat);
    belt.position.y = 0.34; body.add(belt);
    g.add(body);
    /* 手臂 */
    const armL = new THREE.Group(); armL.position.set(-0.225, 0.98, 0);
    const armR = new THREE.Group(); armR.position.set(0.225, 0.98, 0);
    for (const arm of [armL, armR]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.24, 6), robeMat);
      upper.position.y = -0.12; arm.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.04, 0.2, 6), robeMat);
      fore.position.y = -0.33; arm.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), M.skin);
      hand.position.y = -0.44; arm.add(hand);
      g.add(arm);
    }
    /* 头 */
    const head = new THREE.Group(); head.position.y = 1.04;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 7), M.skin);
    neck.position.y = 0.01; head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), M.skin);
    skull.position.y = 0.17; head.add(skull);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 10), M.hat);
    hat.position.y = 0.3; head.add(hat);
    const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.red);
    hatTop.position.y = 0.38; head.add(hatTop);
    g.add(head);
    /* 佩刀 / 枪 */
    const spear = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6), M.wood);
    pole.position.y = 0.9; spear.add(pole);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), M.metal);
    tip.position.y = 1.98; spear.add(tip);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.18, 6), M.red);
    tassel.position.y = 1.8; spear.add(tassel);
    if (opt.spear !== false) {
      spear.position.set(0.32, 0, 0.02);
      g.add(spear);
    }

    g.traverse(function (o2) { if (o2.isMesh) { o2.castShadow = true; o2.receiveShadow = true; } });
    return { group: g, parts: { legL: legL, legR: legR, armL: armL, armR: armR, body: body, head: head, spear: spear } };
  },

  /* 静态侍卫：合并为少量网格 */
  makeStaticGuard: function (x, z, ry) {
    const M = this._mat();
    const parts = [];
    const add = function (geo, mat, m4) { parts.push({ geo: geo, mat: mat, m: m4 }); };
    const box = function (w, h, d, mat, px, py, pz) {
      const geo = new THREE.BoxGeometry(w, h, d); geo.translate(px, py, pz); add(geo, mat);
    };
    const cyl = function (rt, rb, h, mat, px, py, pz) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 8); geo.translate(px, py, pz); add(geo, mat);
    };
    cyl(0.07, 0.062, 0.3, M.robeDark, -0.09, 0.37, 0);
    cyl(0.055, 0.05, 0.24, M.robeDark, -0.09, 0.12, 0);
    cyl(0.07, 0.062, 0.3, M.robeDark, 0.09, 0.37, 0);
    cyl(0.055, 0.05, 0.24, M.robeDark, 0.09, 0.12, 0);
    box(0.11, 0.08, 0.2, M.hat, -0.09, 0.02, 0.04);
    box(0.11, 0.08, 0.2, M.hat, 0.09, 0.02, 0.04);
    cyl(0.14, 0.21, 0.52, M.robe, 0, 0.78, 0);
    cyl(0.212, 0.218, 0.06, M.trim, 0, 0.54, 0);
    cyl(0.155, 0.158, 0.06, M.trim, 0, 0.86, 0);
    cyl(0.05, 0.045, 0.24, M.robe, -0.225, 0.86, 0);
    cyl(0.043, 0.04, 0.2, M.robe, -0.225, 0.65, 0);
    cyl(0.05, 0.045, 0.24, M.robe, 0.225, 0.86, 0);
    cyl(0.043, 0.04, 0.2, M.robe, 0.225, 0.65, 0);
    cyl(0.05, 0.055, 0.07, M.skin, 0, 1.05, 0);
    const skull = new THREE.SphereGeometry(0.155, 12, 8); skull.translate(0, 1.22, 0); add(skull, M.skin);
    cyl(0.16, 0.17, 0.1, M.hat, 0, 1.35, 0);
    const top = new THREE.SphereGeometry(0.06, 8, 6); top.translate(0, 1.43, 0); add(top, M.red);
    /* 长枪 */
    cyl(0.022, 0.022, 2.0, M.wood, 0.32, 0.9, 0.02);
    const tip = new THREE.ConeGeometry(0.05, 0.24, 6); tip.translate(0.32, 1.98, 0.02); add(tip, M.metal);
    cyl(0.03, 0.01, 0.18, M.red, 0.32, 1.8, 0.02);

    /* 按材质合并 */
    const byMat = new Map();
    for (const p of parts) {
      if (!byMat.has(p.mat)) byMat.set(p.mat, []);
      byMat.get(p.mat).push(p.geo);
    }
    const g = new THREE.Group();
    byMat.forEach(function (geos, mat) {
      const mesh = new THREE.Mesh(GEOM.merge(geos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    });
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    return g;
  },

  /* 雨伞：细杆 + 伞面（倒锥）+ 小顶珠 */
  umbrellas: [],
  makeUmbrella: function () {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.85 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xb23a2e, roughness: 0.8, side: THREE.DoubleSide });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.95, 5), poleMat);
    pole.position.y = 1.05;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.42, 12, 1, true), clothMat);
    canopy.position.y = 2.02;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), MATS.goldDark || poleMat);
    tip.position.y = 2.26;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6), poleMat);
    base.position.y = 0.05;
    g.add(pole, canopy, tip, base);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    g.userData.isUmbrella = true;
    this.umbrellas.push(g);
    return g;
  },

  build: function (scene) {
    if (this.group) return this.group;
    const g = new THREE.Group();

    /* 八名静态侍卫（宫门/门洞两侧） */
    const statics = [
      [-20, 454, Math.PI], [20, 454, Math.PI],
      [-24, 300, Math.PI], [24, 300, Math.PI],
      [-14, -122, Math.PI], [14, -122, Math.PI],
      [-18, -452, 0], [18, -452, 0],
      [-40, 300, Math.PI], [40, 300, Math.PI],
      [-30, -80, Math.PI], [30, -80, Math.PI],
      [-30, -280, Math.PI], [30, -280, Math.PI],
      [-10, 430, Math.PI], [10, 430, Math.PI]
    ];
    const staticGeos = new Map();
    for (const s of statics) {
      const guard = this.makeStaticGuard(s[0], s[1], s[2]);
      guard.updateMatrixWorld(true);
      guard.traverse(function (m) {
        if (!m.isMesh) return;
        const geo = m.geometry.clone();
        geo.applyMatrix4(m.matrixWorld);
        if (!staticGeos.has(m.material)) staticGeos.set(m.material, []);
        staticGeos.get(m.material).push(geo);
      });
      this.statics.push(guard);
    }
    staticGeos.forEach(function (geos, mat) {
      const mesh = new THREE.Mesh(GEOM.merge(geos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    });

    /* 四名巡游侍卫 */
    const routes = [
      { pts: [[-6.5, 170], [-6.5, 420]], speed: 1.15, phase: 0 },
      { pts: [[6.5, 420], [6.5, 170]], speed: 1.15, phase: 0.5 },
      { pts: [[-70, 150], [70, 150]], speed: 1.0, phase: 0.25 },
      { pts: [[70, 250], [-70, 250]], speed: 1.0, phase: 0.75 },
      { pts: [[-38, -100], [-38, -190]], speed: 1.0, phase: 0.4 },
      { pts: [[38, -190], [38, -100]], speed: 1.0, phase: 0.8 },
      { pts: [[-120, 120], [-120, 260]], speed: 0.95, phase: 0.2 },
      { pts: [[120, 260], [120, 120]], speed: 0.95, phase: 0.7 },
      { pts: [[-26, -146], [26, -146]], speed: 0.85, phase: 0.05 },
      { pts: [[26, -146], [-26, -146]], speed: 0.85, phase: 0.55 }
    ];
    for (const r of routes) {
      const guard = this.makeGuard();
      g.add(guard.group);
      const umb1 = this.makeUmbrella();
      umb1.position.set(0.34, 0, 0.05);
      umb1.visible = false;
      guard.group.add(umb1);
      let len = 0;
      for (let i = 1; i < r.pts.length; i++) {
        len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      }
      this.patrols.push({
        obj: guard, pts: r.pts, len: len, speed: r.speed,
        t: r.phase * len, legPhase: Math.random() * 6.28, alert: 0,
        greetT: 0, greetCd: 0, greetWith: null
      });
    }

    /* 宫女两名（后三宫巡游） */
    const maidRoutes = [
      { pts: [[-9, -130], [-9, -250]], speed: 0.9, phase: 0.3 },
      { pts: [[9, -250], [9, -130]], speed: 0.9, phase: 0.8 },
      { pts: [[-26, -318], [-26, -352], [-6, -352]], speed: 0.8, phase: 0.1 },
      { pts: [[10, -352], [30, -352], [30, -318]], speed: 0.8, phase: 0.6 }
    ];
    this.maids = [];
    for (const r of maidRoutes) {
      const maid = this.makeGuard({ robeColor: 0xc0717c, trimColor: 0xd8b45f, spear: false });
      g.add(maid.group);
      const umb2 = this.makeUmbrella();
      umb2.position.set(0.32, 0, 0.04);
      umb2.visible = false;
      maid.group.add(umb2);
      let len2 = 0;
      for (let i = 1; i < r.pts.length; i++) len2 += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      this.maids.push({ obj: maid, pts: r.pts, len: len2, speed: r.speed, t: r.phase * len2, legPhase: Math.random() * 6.28, alert: 0, greetT: 0, greetCd: 0, greetWith: null, admireT: 0, admireCd: 18 + Math.random() * 25, petalT: 0 });
    }

    /* 御猫三只 */
    const catRoutes = [
      { pts: [[30, -318], [62, -330], [58, -358], [26, -344]], speed: 0.55, phase: 0.1 },
      { pts: [[-40, -300], [-62, -320], [-50, -344]], speed: 0.5, phase: 0.6 },
      { pts: [[40, 200], [60, 218], [38, 236]], speed: 0.6, phase: 0.35 },
      { pts: [[-64, -350], [-46, -368], [-62, -386]], speed: 0.5, phase: 0.2 },
      { pts: [[-18, 262], [16, 262], [2, 276]], speed: 0.55, phase: 0.65 },
      { pts: [[-62, 60], [-40, 82], [-58, 104]], speed: 0.5, phase: 0.3 },
      { pts: [[24, -182], [44, -192], [22, -204]], speed: 0.45, phase: 0.55 }
    ];
    this.cats = [];
    /* ---- 午门换岗仪式侍卫（两名） ---- */
    this.ceremonyGuards = [];
    for (const csx of [-1, 1]) {
      const cgd = this.makeGuard();
      const umb3 = this.makeUmbrella();
      umb3.position.set(0.32, 0, 0.05);
      umb3.visible = false;
      cgd.group.add(umb3);
      cgd.group.position.set(csx * 16, 0, 440);
      cgd.group.rotation.y = csx > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(cgd.group);
      this.ceremonyGuards.push(cgd);
    }
    this.ceremony = { active: false, t: 0, phase: 0, cooldown: 30, cycles: 0 };

    this._pendingSparrows = true;
    for (const r of catRoutes) {
      const cat = this.makeCat();
      g.add(cat.group);
      let len3 = 0;
      for (let i = 1; i < r.pts.length; i++) len3 += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      this.cats.push({ obj: cat, pts: r.pts, len: len3, speed: r.speed, t: r.phase * len3, legPhase: Math.random() * 6.28, flee: 0, look: 0, curious: 0, tBack: -1, speedBoost: 0, feedT: 0, heartT: 0, chaseT: 0, chaseCd: 6 + Math.random() * 8, pounceT: 0, pounceCd: 10 + Math.random() * 18, pounced: false, pounceTx: 0, pounceTz: 0 });
    }

    this.flowerBeds = [[18, -350], [-18, -352], [44, -312], [-44, -314], [0, -396]];
    this.group = g;
    if (this._pendingSparrows) { this._pendingSparrows = false; this.initSparrows(); }
    scene.add(g);
    return g;
  },

  /* 投喂御猫：找最近的猫并进入跟随状态，返回索引 */
  feedCatNear: function (x, z, r) {
    let best = -1, bestD = (r == null ? 3.4 : r);
    for (let i = 0; i < (this.cats || []).length; i++) {
      const cpos = this.cats[i].obj.group.position;
      const d = Math.hypot(cpos.x - x, cpos.z - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      const cat = this.cats[best];
      cat.feedT = 14;
      cat.heartT = 0;
      cat.flee = 0;
      cat.look = 0;
      cat.curious = 0;
    }
    return best;
  },

  /* 逗猫：范围内最多 N 只御猫跑来玩耍（跳跃 + 爱心） */
  playCatNear: function (x, z, r, maxN) {
    const list = [];
    for (let i = 0; i < (this.cats || []).length; i++) {
      const cpos = this.cats[i].obj.group.position;
      const d = Math.hypot(cpos.x - x, cpos.z - z);
      if (d < (r == null ? 20 : r)) list.push({ i: i, d: d });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    const n = Math.min(list.length, maxN == null ? 3 : maxN);
    for (let k = 0; k < n; k++) {
      const cat = this.cats[list[k].i];
      cat.feedT = 10;
      cat.heartT = 0;
      cat.play = 10;
      cat.flee = 0;
      cat.look = 0;
      cat.curious = 0;
      cat.chaseT = 0;
    }
    return n;
  },

  /* ---------------- 广场麻雀（啄食，小人靠近飞走） ---------------- */
  sparrows: null,
  sparrowData: null,
  sparrowTime: 0,
  initSparrows: function () {
    const body = new THREE.SphereGeometry(0.11, 7, 6);
    body.scale(1, 0.85, 1.35);
    body.translate(0, 0.09, 0);
    const head = new THREE.SphereGeometry(0.07, 7, 6);
    head.translate(0, 0.2, 0.11);
    const beak = new THREE.ConeGeometry(0.025, 0.07, 5);
    beak.rotateX(Math.PI / 2);
    beak.translate(0, 0.2, 0.2);
    const tail = new THREE.BoxGeometry(0.06, 0.02, 0.14);
    tail.rotateX(-0.35);
    tail.translate(0, 0.12, -0.16);
    const geo = GEOM.merge([body, head, beak, tail]);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9, metalness: 0.0 });
    const count = 18;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;
    inst.castShadow = false;
    inst.receiveShadow = false;
    this.group.add(inst);
    this.sparrows = inst;
    const anchors = [
      [40, 180], [-40, 182], [26, 250], [-26, 252], [18, -60], [-18, -62],
      [44, -150], [-44, -152], [20, -330], [-20, -332]
    ];
    this.sparrowData = [];
    for (let i = 0; i < count; i++) {
      const a = anchors[i % anchors.length];
      this.sparrowData.push({
        ax: a[0], az: a[1],
        x: a[0] + (Math.random() - 0.5) * 4,
        z: a[1] + (Math.random() - 0.5) * 4,
        yaw: Math.random() * 6.28,
        phase: Math.random() * 6.28,
        state: 'ground',
        flyT: 0,
        dx: 0, dz: 1
      });
    }
  },
  umbrellaInfo: function () {
    const total = (this.umbrellas || []).length;
    let shown = 0;
    for (let i = 0; i < (this.umbrellas || []).length; i++) if (this.umbrellas[i].visible) shown++;
    return { total: total, shown: shown, rain: (typeof EFFECTS !== 'undefined') ? Math.round((EFFECTS.rainAmt || 0) * 100) / 100 : -1 };
  },

  admireStats: function () {
    let active = 0;
    const list = [];
    for (let i = 0; i < this.maids.length; i++) {
      const m = this.maids[i];
      if (m.admireT > 0) { active++; list.push({ i: i, left: Math.round(m.admireT * 100) / 100 }); }
    }
    return { active: active, events: this.admireEvents || 0, list: list };
  },

  greetStats: function () {
    let active = 0;
    const list = [];
    for (let i = 0; i < this.patrols.length; i++) {
      const p = this.patrols[i];
      if (p.greetT > 0) { active++; list.push({ kind: 'guard', i: i, left: Math.round(p.greetT * 100) / 100 }); }
    }
    for (let j = 0; j < this.maids.length; j++) {
      const m = this.maids[j];
      if (m.greetT > 0) { active++; list.push({ kind: 'maid', i: j, left: Math.round(m.greetT * 100) / 100 }); }
    }
    return { active: active, events: this.greetEvents || 0, list: list };
  },

  chaseStats: function () {
    const out = [];
    for (let i = 0; i < (this.cats || []).length; i++) {
      const c = this.cats[i];
      if (c.chaseT > 0) out.push({ i: i, left: Math.round(c.chaseT * 100) / 100 });
    }
    return out;
  },

  scareSparrows: function (x, z, r) {
    const data = this.sparrowData;
    if (!data) return 0;
    let n = 0;
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      if (s.state !== 'ground') continue;
      if (Math.hypot(s.x - x, s.z - z) > (r == null ? 5 : r)) continue;
      s.state = 'fly';
      s.flyT = 0;
      const dx = s.x - x, dz = s.z - z;
      const dl = Math.hypot(dx, dz) || 1;
      s.dx = dx / dl; s.dz = dz / dl;
      n++;
    }
    if (n > 0) this.sparrowScares = (this.sparrowScares || 0) + 1;
    return n;
  },
  pounceStats: function () {
    let active = 0;
    const list = [];
    for (let i = 0; i < (this.cats || []).length; i++) {
      const c = this.cats[i];
      if (c.pounceT > 0) { active++; list.push({ i: i, left: Math.round(c.pounceT * 100) / 100 }); }
    }
    return { active: active, events: this.pounceEvents || 0, scares: this.sparrowScares || 0, list: list };
  },

  updateSparrows: function (dt) {
    const inst = this.sparrows;
    const data = this.sparrowData;
    if (!inst || !data) return;
    this.sparrowTime += dt;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    const walkOn = (typeof WALK !== 'undefined') && WALK.active;
    const ax = walkOn ? WALK.pos.x : 1e9;
    const az = walkOn ? WALK.pos.z : 1e9;
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      if (s.state === 'ground') {
        const d = Math.hypot(ax - s.x, az - s.z);
        if (walkOn && d < 7) {
          s.state = 'fly';
          s.flyT = 0;
          const dx = s.x - ax, dz = s.z - az;
          const dl = Math.hypot(dx, dz) || 1;
          s.dx = dx / dl; s.dz = dz / dl;
        } else {
          const t = this.sparrowTime + s.phase;
          const peck = Math.max(0, Math.sin(t * 2.2)) > 0.82 ? 0.5 : 0;
          s.yaw += Math.sin(t * 0.7 + i) * dt * 0.6;
          pos.set(s.x, 0.09 + Math.abs(Math.sin(t * 5)) * 0.015, s.z);
          e.set(peck, s.yaw, 0);
          q.setFromEuler(e);
          m.compose(pos, q, scl);
          inst.setMatrixAt(i, m);
          continue;
        }
      }
      /* 飞走 → 2.2s 后在其他位置落下 */
      s.flyT += dt;
      s.x += s.dx * dt * 3.2;
      s.z += s.dz * dt * 3.2;
      const h = Math.max(0, 0.4 + s.flyT * 1.6 - s.flyT * s.flyT * 0.45);
      pos.set(s.x, 0.09 + h, s.z);
      e.set(-0.3, Math.atan2(s.dx, s.dz), Math.sin(s.flyT * 20) * 0.5);
      q.setFromEuler(e);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i, m);
      if (s.flyT > 2.2) {
        s.state = 'ground';
        s.ax = s.ax; s.az = s.az;
        s.x = s.ax + (Math.random() - 0.5) * 5;
        s.z = s.az + (Math.random() - 0.5) * 5;
        s.yaw = Math.random() * 6.28;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  },

  /* ---------------- 午门换岗仪式 ---------------- */
  startCeremony: function () {
    if (this.ceremony) { this.ceremony.cooldown = 0; }
  },
  ceremonyStats: function () {
    const c = this.ceremony;
    if (!c) return { active: false };
    return {
      active: c.active, phase: c.phase, t: Math.round(c.t * 100) / 100,
      cycles: c.cycles, cooldown: Math.round(c.cooldown * 10) / 10,
      posA: this.ceremonyGuards ? [Math.round(this.ceremonyGuards[0].group.position.x), Math.round(this.ceremonyGuards[0].group.position.z)] : null,
      posB: this.ceremonyGuards ? [Math.round(this.ceremonyGuards[1].group.position.x), Math.round(this.ceremonyGuards[1].group.position.z)] : null
    };
  },
  updateCeremony: function (dt) {
    const c = this.ceremony;
    if (!c || !this.ceremonyGuards || this.ceremonyGuards.length < 2) return;
    const g1 = this.ceremonyGuards[0], g2 = this.ceremonyGuards[1];
    const self = this;
    function stance(gd, sway) {
      gd.parts.legL.rotation.x = sway;
      gd.parts.legR.rotation.x = -sway;
      gd.parts.armL.rotation.x = -sway * 1.2;
      gd.parts.armR.rotation.x = sway * 1.2;
    }
    if (!c.active) {
      c.cooldown -= dt;
      g1.group.position.set(-16, 0, 440);
      g2.group.position.set(16, 0, 440);
      g1.group.rotation.y = Math.PI / 2;
      g2.group.rotation.y = -Math.PI / 2;
      stance(g1, Math.sin(self.time * 1.4) * 0.02);
      stance(g2, Math.sin(self.time * 1.4 + 1) * 0.02);
      g1.parts.body.position.y = 0.52;
      g2.parts.body.position.y = 0.52;
      if (c.cooldown <= 0) {
        c.active = true;
        c.t = 0;
        c.phase = 0;
        c.cycles = (c.cycles || 0) + 1;
      }
      return;
    }
    c.t += dt;
    const ease = function (k) { return k * k * (3 - 2 * k); };
    if (c.phase === 0) {
      const k = Math.min(1, c.t / 2.2);
      const e = ease(k);
      g1.group.position.set(-16 + 10 * e, 0, 440);
      g2.group.position.set(16 - 10 * e, 0, 440);
      g1.group.rotation.y = Math.PI / 2;
      g2.group.rotation.y = -Math.PI / 2;
      const sw = Math.sin(self.time * 9) * 0.5;
      stance(g1, sw);
      stance(g2, -sw);
      g1.parts.body.position.y = 0.52 + Math.abs(Math.sin(self.time * 9)) * 0.02;
      g2.parts.body.position.y = 0.52 + Math.abs(Math.sin(self.time * 9 + 0.4)) * 0.02;
      if (c.t >= 2.2) { c.t -= 2.2; c.phase = 1; }
    } else if (c.phase === 1) {
      const k = Math.min(1, c.t / 1.7);
      const dip = Math.sin(k * Math.PI) * 0.05;
      g1.parts.body.position.y = 0.52 - dip;
      g2.parts.body.position.y = 0.52 - dip;
      stance(g1, 0.02);
      stance(g2, 0.02);
      if (c.t >= 1.7) { c.t -= 1.7; c.phase = 2; }
    } else {
      const k = Math.min(1, c.t / 2.2);
      const e = ease(k);
      g1.group.position.set(-6 - 10 * e, 0, 440);
      g2.group.position.set(6 + 10 * e, 0, 440);
      g1.group.rotation.y = Math.PI / 2;
      g2.group.rotation.y = -Math.PI / 2;
      const sw = Math.sin(self.time * 9) * 0.5;
      stance(g1, -sw);
      stance(g2, sw);
      g1.parts.body.position.y = 0.52 + Math.abs(Math.sin(self.time * 9)) * 0.02;
      g2.parts.body.position.y = 0.52 + Math.abs(Math.sin(self.time * 9 + 0.4)) * 0.02;
      if (c.t >= 2.2) {
        c.active = false;
        c.t = 0;
        c.phase = 0;
        c.cooldown = 80 + Math.random() * 50;
      }
    }
  },

  /* 折线路径取点 */
  pathPos: function (pts, dist) {
    let d = dist, ax = pts[0][0], az = pts[0][1], bx = pts[1][0], bz = pts[1][1], fx = 0, fz = 1;
    const total = this._pathLenCache || null;
    let remain = d;
    for (let k = 1; k < pts.length; k++) {
      const sx = pts[k][0] - pts[k - 1][0], sz = pts[k][1] - pts[k - 1][1];
      const sl = Math.hypot(sx, sz) || 1;
      if (remain <= sl) {
        ax = pts[k - 1][0]; az = pts[k - 1][1];
        bx = pts[k][0]; bz = pts[k][1];
        fx = sx / sl; fz = sz / sl;
        return { x: ax + fx * remain, z: az + fz * remain, fx: fx, fz: fz };
      }
      remain -= sl;
    }
    return { x: bx, z: bz, fx: fx, fz: fz };
  },

  _player: function () {
    if (typeof WALK !== 'undefined' && WALK.active) return { x: WALK.pos.x, z: WALK.pos.z, moving: WALK.moving };
    return null;
  },

  update: function (dt) {
    if (!this.group) return;
    this.updateSparrows(dt);
    this.time += dt;
    this.updateCeremony(dt);
    /* 雨伞随雨量显隐 */
    if (this.umbrellas && this.umbrellas.length) {
      const rainAmt = (typeof EFFECTS !== 'undefined') ? (EFFECTS.rainAmt || 0) : 0;
      const showUmb = rainAmt > 0.35;
      for (let ui = 0; ui < this.umbrellas.length; ui++) {
        this.umbrellas[ui].visible = showUmb;
      }
      this._umbrellaShown = showUmb;
    }
    const pl = this._player();

    /* ---- 宫女：靠近驻足转身目送 ---- */
    for (let mi = 0; mi < (this.maids || []).length; mi++) {
      const mw = this.maids[mi];
      const cur0 = this.pathPos(mw.pts, mw.t);
      if (mw.admireCd > 0) mw.admireCd -= dt;
      if (mw.admireT > 0) {
        mw.admireT -= dt;
        const curA = this.pathPos(mw.pts, mw.t);
        mw.obj.group.position.set(curA.x, 0, curA.z);
        /* 面向最近的花坛 */
        let bx = 0, bz = -350, bd = 1e9;
        for (let fb = 0; fb < this.flowerBeds.length; fb++) {
          const f = this.flowerBeds[fb];
          const dd = Math.hypot(f[0] - curA.x, f[1] - curA.z);
          if (dd < bd) { bd = dd; bx = f[0]; bz = f[1]; }
        }
        const tya = Math.atan2(bx - curA.x, bz - curA.z);
        let dya = tya - mw.obj.group.rotation.y;
        dya = Math.atan2(Math.sin(dya), Math.cos(dya));
        mw.obj.group.rotation.y += dya * Math.min(1, dt * 4);
        /* 驻足轻晃 */
        mw.legPhase += dt * 2.2;
        const sag = Math.sin(mw.legPhase) * 0.06;
        mw.obj.parts.legL.rotation.x = sag;
        mw.obj.parts.legR.rotation.x = -sag;
        mw.obj.parts.armL.rotation.x = -0.1 + Math.sin(this.time * 1.6) * 0.05;
        mw.obj.parts.armR.rotation.x = 0.1 - Math.sin(this.time * 1.6) * 0.05;
        mw.obj.parts.body.position.y = 0.52 + Math.sin(this.time * 1.8) * 0.006;
        /* 花瓣（复用爱心精灵，粉色） */
        mw.petalT = (mw.petalT || 0) + dt;
        if (mw.petalT > 0.9 && typeof EFFECTS !== 'undefined' && EFFECTS.spawnHeart) {
          mw.petalT = 0;
          EFFECTS.spawnHeart(curA.x + (Math.random() - 0.5) * 1.6, 1.2 + Math.random() * 0.5, curA.z + (Math.random() - 0.5) * 1.6);
        }
        if (mw.admireT <= 0) {
          this.admireEvents = (this.admireEvents || 0) + 1;
          mw.admireCd = 26 + Math.random() * 30;
        }
        continue;
      }
      if (mw.admireCd <= 0 && mw.obj.group.position.z < -280 && mw.alert < 0.2) {
        mw.admireT = 3.6;
        mw.admireCd = 0.1;
      }

      if (mw.greetCd > 0) mw.greetCd -= dt;
      if (mw.greetT > 0) {
        mw.greetT -= dt;
        const curG = this.pathPos(mw.pts, mw.t);
        mw.obj.group.position.set(curG.x, 0, curG.z);
        if (mw.greetWith) {
          const tp = mw.greetWith;
          const tyg = Math.atan2(tp.x - curG.x, tp.z - curG.z);
          let dyg = tyg - mw.obj.group.rotation.y;
          dyg = Math.atan2(Math.sin(dyg), Math.cos(dyg));
          mw.obj.group.rotation.y += dyg * Math.min(1, dt * 7);
        }
        mw.legPhase += dt * 1.4;
        const sgg = Math.sin(mw.legPhase) * 0.08;
        mw.obj.parts.legL.rotation.x = sgg;
        mw.obj.parts.legR.rotation.x = -sgg;
        mw.obj.parts.armL.rotation.x = -0.12;
        mw.obj.parts.armR.rotation.x = 0.12;
        mw.obj.parts.body.position.y = 0.52 - Math.abs(Math.sin(this.time * 2.4)) * 0.02;
        continue;
      }
      let dist = 1e9;
      if (pl) dist = Math.hypot(pl.x - cur0.x, pl.z - cur0.z);
      if (dist < 6.0) mw.alert = Math.min(1, mw.alert + dt * 4.5);
      else if (dist > 8.5) mw.alert = Math.max(0, mw.alert - dt * 1.6);
      const paused = mw.alert > 0.5;
      if (!paused) {
        mw.t += mw.speed * dt;
        if (mw.t > mw.len) mw.t -= mw.len;
      }
      const cur = this.pathPos(mw.pts, mw.t);
      mw.obj.group.position.set(cur.x, 0, cur.z);
      const targetYaw = paused && pl ? Math.atan2(pl.x - cur.x, pl.z - cur.z) : Math.atan2(cur.fx, cur.fz);
      let dy2 = targetYaw - mw.obj.group.rotation.y;
      dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2));
      mw.obj.group.rotation.y += dy2 * Math.min(1, dt * (paused ? 7 : 8));
      const walkK = paused ? 0 : 1;
      mw.legPhase += dt * mw.speed * 6.0 * walkK;
      const sm = Math.sin(mw.legPhase) * walkK;
      mw.obj.parts.legL.rotation.x = sm * 0.5;
      mw.obj.parts.legR.rotation.x = -sm * 0.5;
      mw.obj.parts.armL.rotation.x = -sm * 0.35;
      mw.obj.parts.armR.rotation.x = sm * 0.35;
      /* 驻足时的轻微呼吸 */
      mw.obj.parts.body.position.y = 0.52 + (paused ? Math.sin(this.time * 1.8 + mi) * 0.008 : 0);
    }

    /* ---- 御猫：受惊跑开 / 好奇靠近 / 停下看你 ---- */
    for (let ci = 0; ci < (this.cats || []).length; ci++) {
      const cat = this.cats[ci];
      const cur0 = this.pathPos(cat.pts, cat.t);
      let dist = 1e9;
      if (pl) dist = Math.hypot(pl.x - cur0.x, pl.z - cur0.z);

      /* 追蝴蝶：猫的日常小剧场 */
      if (cat.chaseT > 0) {
        cat.chaseT -= dt;
        const cpos = cat.obj.group.position;
        let bp = null, bd = 1e9;
        if (typeof EFFECTS !== 'undefined' && EFFECTS.butterflyPos) {
          for (let bi = 0; bi < EFFECTS.butterflyPos.length; bi++) {
            const bb = EFFECTS.butterflyPos[bi];
            if (!bb) continue;
            const dd = Math.hypot(bb.x - cpos.x, bb.z - cpos.z);
            if (dd < bd) { bd = dd; bp = bb; }
          }
        }
        if (bp) {
          const dxb = bp.x - cpos.x, dzb = bp.z - cpos.z;
          const dl = Math.hypot(dxb, dzb) || 1;
          if (dl > 1.0) {
            cat.obj.group.position.set(cpos.x + dxb / dl * 3.9 * dt, 0, cpos.z + dzb / dl * 3.9 * dt);
          }
          cat.obj.group.rotation.y = Math.atan2(dxb, dzb);
          cat.legPhase += dt * 15;
          const scb = Math.sin(cat.legPhase);
          cat.obj.parts.legs[0].rotation.x = scb * 1.0;
          cat.obj.parts.legs[1].rotation.x = -scb * 1.0;
          cat.obj.parts.legs[2].rotation.x = -scb * 1.0;
          cat.obj.parts.legs[3].rotation.x = scb * 1.0;
          cat.obj.parts.tail.rotation.z = 0.5 + Math.sin(this.time * 12) * 0.25;
          /* 扑蝶：靠近时跃起 */
          const hop = dl < 1.9 ? Math.abs(Math.sin(this.time * 14)) * 0.28 : Math.abs(scb) * 0.05;
          cat.obj.parts.body.position.y = 0.3 + hop;
        }
        if (cat.chaseT <= 0) {
          /* 回到最近巡逻路径点 */
          let bestT2 = 0, bestD2 = 1e9;
          for (let k2 = 0; k2 <= 12; k2++) {
            const tt2 = (k2 / 12) * cat.len;
            const pp2 = this.pathPos(cat.pts, tt2);
            const dd3 = Math.hypot(pp2.x - cat.obj.group.position.x, pp2.z - cat.obj.group.position.z);
            if (dd3 < bestD2) { bestD2 = dd3; bestT2 = tt2; }
          }
          cat.t = bestT2;
          cat.chaseCd = 14 + Math.random() * 10;
        }
        continue;
      }
      cat.chaseCd = Math.max(0, cat.chaseCd - dt);
      if (cat.chaseCd <= 0 && typeof EFFECTS !== 'undefined' && EFFECTS.butterflyPos && !cat.flee && cat.feedT <= 0) {
        let bp0 = null, bd0 = 1e9;
        const cpNow = cat.obj.group.position;
        for (let bi0 = 0; bi0 < EFFECTS.butterflyPos.length; bi0++) {
          const bb0 = EFFECTS.butterflyPos[bi0];
          if (!bb0) continue;
          const dd0 = Math.hypot(bb0.x - cpNow.x, bb0.z - cpNow.z);
          if (dd0 < bd0) { bd0 = dd0; bp0 = bb0; }
        }
        if (bp0 && bd0 < 16) {
          cat.chaseT = 3.4;
          cat.curious = 0;
          cat.look = 0;
          cat.flee = 0;
        } else {
          cat.chaseCd = 5;
        }
      }

      /* 扑麻雀：猫悄悄接近地面麻雀，麻雀惊飞 */
      if (cat.pounceCd > 0) cat.pounceCd -= dt;
      if (cat.pounceT > 0) {
        cat.pounceT -= dt;
        const cpS = cat.obj.group.position;
        const dxS = cat.pounceTx - cpS.x, dzS = cat.pounceTz - cpS.z;
        const ddS = Math.hypot(dxS, dzS);
        if (ddS > 1.6) {
          cat.obj.group.position.set(cpS.x + dxS / ddS * 5.5 * dt, 0, cpS.z + dzS / ddS * 5.5 * dt);
        }
        cat.obj.group.rotation.y = Math.atan2(dxS, dzS);
        cat.legPhase += dt * 16;
        const scS = Math.sin(cat.legPhase);
        cat.obj.parts.legs[0].rotation.x = scS * 1.0;
        cat.obj.parts.legs[1].rotation.x = -scS * 1.0;
        cat.obj.parts.legs[2].rotation.x = -scS * 1.0;
        cat.obj.parts.legs[3].rotation.x = scS * 1.0;
        cat.obj.parts.tail.rotation.z = 0.55 + Math.sin(this.time * 11) * 0.2;
        /* 扑击瞬间：麻雀惊飞 */
        if (ddS < 3.2 && !cat.pounced) {
          cat.pounced = true;
          this.scareSparrows(cat.obj.group.position.x, cat.obj.group.position.z, 6);
          this.pounceEvents = (this.pounceEvents || 0) + 1;
        }
        cat.obj.parts.body.position.y = 0.3 + (ddS < 3.2 ? Math.abs(Math.sin(this.time * 13)) * 0.24 : Math.abs(scS) * 0.05);
        if (cat.pounceT <= 0) {
          let bestTP = 0, bestDP = 1e9;
          for (let kp = 0; kp <= 12; kp++) {
            const ttP = (kp / 12) * cat.len;
            const ppP = this.pathPos(cat.pts, ttP);
            const ddP = Math.hypot(ppP.x - cat.obj.group.position.x, ppP.z - cat.obj.group.position.z);
            if (ddP < bestDP) { bestDP = ddP; bestTP = ttP; }
          }
          cat.t = bestTP;
          cat.pounceCd = 22 + Math.random() * 20;
          cat.obj.parts.body.position.y = 0.3;
        }
        continue;
      }
      if (cat.pounceCd <= 0 && cat.feedT <= 0 && cat.flee <= 0 && cat.chaseT <= 0 && cat.look <= 0) {
        /* 找附近地面麻雀 */
        let bx = 1e9, bz = 0, bd = 16;
        if (this.sparrowData) {
          for (let si2 = 0; si2 < this.sparrowData.length; si2++) {
            const sp2 = this.sparrowData[si2];
            if (sp2.state !== 'ground') continue;
            const dd2 = Math.hypot(sp2.x - cat.obj.group.position.x, sp2.z - cat.obj.group.position.z);
            if (dd2 < bd) { bd = dd2; bx = sp2.x; bz = sp2.z; }
          }
        }
        if (bd < 16) {
          cat.pounceT = 3.8;
          cat.pounceTx = bx;
          cat.pounceTz = bz;
          cat.pounced = false;
        } else {
          cat.pounceCd = 8;
        }
      }

      /* 投喂跟随：走近玩家身边、冒爱心 */
      if (cat.feedT > 0) {
        cat.feedT -= dt;
        const cp0 = cat.obj.group.position;
        const px0 = pl ? pl.x : cp0.x, pz0 = pl ? pl.z : cp0.z;
        const dx0 = px0 - cp0.x, dz0 = pz0 - cp0.z;
        const dd0 = Math.hypot(dx0, dz0);
        let nx0 = cp0.x, nz0 = cp0.z;
        const yaw0 = Math.atan2(dx0, dz0);
        if (dd0 > 2.1) {
          nx0 += (dx0 / dd0) * 2.7 * dt;
          nz0 += (dz0 / dd0) * 2.7 * dt;
        }
        cat.obj.group.position.set(nx0, 0, nz0);
        let dy0 = yaw0 - cat.obj.group.rotation.y;
        dy0 = Math.atan2(Math.sin(dy0), Math.cos(dy0));
        cat.obj.group.rotation.y += dy0 * Math.min(1, dt * 9);
        cat.legPhase += dt * 7.5;
        const sc0 = Math.sin(cat.legPhase);
        cat.obj.parts.legs[0].rotation.x = sc0 * 0.6;
        cat.obj.parts.legs[1].rotation.x = -sc0 * 0.6;
        cat.obj.parts.legs[2].rotation.x = -sc0 * 0.6;
        cat.obj.parts.legs[3].rotation.x = sc0 * 0.6;
        cat.obj.parts.tail.rotation.z = Math.sin(this.time * 6.5 + ci) * 0.45;
        if (cat.play > 0) {
          cat.play -= dt;
          cat.obj.parts.body.position.y = 0.3 + Math.abs(Math.sin(this.time * 11)) * 0.16;
        }
        cat.heartT = (cat.heartT || 0) + dt;
        if (cat.heartT > 0.42 && typeof EFFECTS !== 'undefined' && EFFECTS.spawnHeart) {
          cat.heartT = 0;
          EFFECTS.spawnHeart(nx0, 0.85, nz0);
        }
        if (cat.feedT <= 0) {
          /* 回到最近的巡逻路径点 */
          let bestT = 0, bestD = 1e9;
          for (let k = 0; k <= 12; k++) {
            const tt = (k / 12) * cat.len;
            const pp = this.pathPos(cat.pts, tt);
            const dd2 = Math.hypot(pp.x - nx0, pp.z - nz0);
            if (dd2 < bestD) { bestD = dd2; bestT = tt; }
          }
          cat.t = bestT;
        }
        continue;
      }

      /* 受惊：快速跑开 */
      if (pl && dist < 3.4 && cat.flee <= 0) {
        cat.flee = 1.6;
        cat.curious = 0;
        cat.look = 0;
        cat.tBack = cat.t;
      }
      if (cat.flee > 0) {
        cat.flee -= dt;
        const ax2 = cur0.x - pl.x, az2 = cur0.z - pl.z;
        const al = Math.hypot(ax2, az2) || 1;
        const nx = cur0.x + (ax2 / al) * 4.4 * dt;
        const nz = cur0.z + (az2 / al) * 4.4 * dt;
        /* 不跑出宫城范围 */
        const limX = Math.abs(nx) < 360 ? nx : cur0.x;
        const limZ = Math.abs(nz) < 460 ? nz : cur0.z;
        cat.obj.group.position.set(limX, 0, limZ);
        cat.obj.group.rotation.y = Math.atan2(ax2 / al, az2 / al);
        cat.legPhase += dt * 14;
        const sc2 = Math.sin(cat.legPhase);
        cat.obj.parts.legs[0].rotation.x = sc2 * 0.9;
        cat.obj.parts.legs[1].rotation.x = -sc2 * 0.9;
        cat.obj.parts.legs[2].rotation.x = -sc2 * 0.9;
        cat.obj.parts.legs[3].rotation.x = sc2 * 0.9;
        cat.obj.parts.tail.rotation.z = 0.6 + Math.sin(this.time * 9) * 0.2;
        cat.obj.parts.body.position.y = 0.32 + Math.abs(sc2) * 0.03;
        /* 把路径进度吸附到跑开后的位置，避免瞬移 */
        let bestT = 0, bestD = 1e9;
        for (let k = 0; k <= 12; k++) {
          const tt = (k / 12) * cat.len;
          const pp = this.pathPos(cat.pts, tt);
          const dd2 = Math.hypot(pp.x - limX, pp.z - limZ);
          if (dd2 < bestD) { bestD = dd2; bestT = tt; }
        }
        cat.t = bestT;
        continue;
      }

      /* 好奇：玩家在附近且静止，猫咪停下来看你 */
      if (pl && dist < 7 && dist > 3.2) {
        if (!pl.moving) cat.curious += dt;
        else cat.curious = Math.max(0, cat.curious - dt * 2);
        if (cat.curious > 1.1 && cat.look <= 0) cat.look = 2.2;
      } else {
        cat.curious = Math.max(0, cat.curious - dt);
      }
      if (cat.look > 0) {
        cat.look -= dt;
        const cur = this.pathPos(cat.pts, cat.t);
        cat.obj.group.position.set(cur.x, 0, cur.z);
        if (pl) cat.obj.group.rotation.y = Math.atan2(pl.x - cur.x, pl.z - cur.z);
        cat.legPhase += dt * 2.0;
        cat.obj.parts.legs[0].rotation.x *= 0.9;
        cat.obj.parts.legs[1].rotation.x *= 0.9;
        cat.obj.parts.legs[2].rotation.x *= 0.9;
        cat.obj.parts.legs[3].rotation.x *= 0.9;
        cat.obj.parts.tail.rotation.z = Math.sin(this.time * 3.4 + ci) * 0.35;
        cat.obj.parts.body.position.y = 0.3 + Math.abs(Math.sin(this.time * 2.2)) * 0.012;
        continue;
      }

      cat.t += cat.speed * dt;
      if (cat.t > cat.len) cat.t -= cat.len;
      const cur = this.pathPos(cat.pts, cat.t);
      cat.obj.group.position.set(cur.x, 0, cur.z);
      cat.obj.group.rotation.y = Math.atan2(cur.fx, cur.fz);
      cat.legPhase += dt * cat.speed * 8.0;
      const sc = Math.sin(cat.legPhase);
      cat.obj.parts.legs[0].rotation.x = sc * 0.55;
      cat.obj.parts.legs[1].rotation.x = -sc * 0.55;
      cat.obj.parts.legs[2].rotation.x = -sc * 0.55;
      cat.obj.parts.legs[3].rotation.x = sc * 0.55;
      cat.obj.parts.tail.rotation.z = Math.sin(this.time * 2.2 + ci) * 0.25;
      cat.obj.parts.body.position.y = 0.3 + Math.abs(sc) * 0.02;
    }

    /* ---- 巡逻侍卫：靠近驻足、转身面向玩家 ---- */
    for (let i = 0; i < this.patrols.length; i++) {
      const p = this.patrols[i];
      const cur0 = this.pathPos(p.pts, p.t);
      if (p.greetCd > 0) p.greetCd -= dt;
      if (p.greetT > 0) {
        p.greetT -= dt;
        const curG = this.pathPos(p.pts, p.t);
        p.obj.group.position.set(curG.x, 0, curG.z);
        if (p.greetWith) {
          const tp = p.greetWith;
          const tyg = Math.atan2(tp.x - curG.x, tp.z - curG.z);
          let dyg = tyg - p.obj.group.rotation.y;
          dyg = Math.atan2(Math.sin(dyg), Math.cos(dyg));
          p.obj.group.rotation.y += dyg * Math.min(1, dt * 7);
        }
        p.legPhase += dt * 1.4;
        const sgg = Math.sin(p.legPhase) * 0.08;
        p.obj.parts.legL.rotation.x = sgg;
        p.obj.parts.legR.rotation.x = -sgg;
        p.obj.parts.armL.rotation.x = -0.12;
        p.obj.parts.armR.rotation.x = 0.12;
        p.obj.parts.body.position.y = 0.52 - Math.abs(Math.sin(this.time * 2.4)) * 0.02;
        continue;
      }
      let dist = 1e9;
      if (pl) dist = Math.hypot(pl.x - cur0.x, pl.z - cur0.z);
      if (dist < 6.5) p.alert = Math.min(1, p.alert + dt * 5);
      else if (dist > 9.0) p.alert = Math.max(0, p.alert - dt * 1.8);
      const paused = p.alert > 0.5;
      if (!paused) {
        p.t += p.speed * dt;
        if (p.t > p.len) p.t -= p.len;
      }
      const cur = this.pathPos(p.pts, p.t);
      p.obj.group.position.set(cur.x, 0, cur.z);
      const targetYaw = (paused && pl)
        ? Math.atan2(pl.x - cur.x, pl.z - cur.z)
        : Math.atan2(cur.fx, cur.fz);
      let dyaw = targetYaw - p.obj.group.rotation.y;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      p.obj.group.rotation.y += dyaw * Math.min(1, dt * (paused ? 6.5 : 8));
      const walkK = paused ? 0 : 1;
      p.legPhase += dt * p.speed * 5.2 * walkK;
      const s = Math.sin(p.legPhase) * walkK;
      p.obj.parts.legL.rotation.x = s * 0.62;
      p.obj.parts.legR.rotation.x = -s * 0.62;
      p.obj.parts.armL.rotation.x = -s * 0.42;
      p.obj.parts.armR.rotation.x = s * 0.3;
      p.obj.parts.body.position.y = 0.52 + (paused ? Math.sin(this.time * 1.6 + i) * 0.008 : Math.abs(Math.sin(p.legPhase)) * 0.025);
    }

    /* ---- 相遇寒暄：两名行走 NPC 靠近时停步对视 2.8 秒 ---- */
    const walkers = [];
    for (let wi = 0; wi < this.patrols.length; wi++) walkers.push(this.patrols[wi]);
    for (let wi2 = 0; wi2 < this.maids.length; wi2++) walkers.push(this.maids[wi2]);
    for (let a = 0; a < walkers.length; a++) {
      for (let b = a + 1; b < walkers.length; b++) {
        const A2 = walkers[a], B2 = walkers[b];
        if (A2.greetT > 0 || B2.greetT > 0 || A2.greetCd > 0 || B2.greetCd > 0) continue;
        const ga = A2.obj.group.position, gb = B2.obj.group.position;
        if (Math.hypot(ga.x - gb.x, ga.z - gb.z) > 2.6) continue;
        if (pl && (Math.hypot(pl.x - ga.x, pl.z - ga.z) < 4.5 || Math.hypot(pl.x - gb.x, pl.z - gb.z) < 4.5)) continue;
        A2.greetT = 2.8; B2.greetT = 2.8;
        A2.greetCd = 9 + Math.random() * 5; B2.greetCd = A2.greetCd;
        A2.greetWith = gb; B2.greetWith = ga;
        this.greetEvents = (this.greetEvents || 0) + 1;
      }
    }
  }
};

/* =============================================================
 *  御猫（程序化四足，可行走）
 * ============================================================= */
NPC.makeCat = function () {
  const M = this._mat();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb07a3c, roughness: 0.9 });
  const furDark = new THREE.MeshStandardMaterial({ color: 0x513a22, roughness: 0.9 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fur);
  body.scale.set(1.5, 0.9, 1.0);
  body.position.set(0, 0.3, 0);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fur);
  head.position.set(0, 0.42, 0.34);
  g.add(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 4), furDark);
    ear.position.set(sx * 0.08, 0.54, 0.34);
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), furDark);
    eye.position.set(sx * 0.055, 0.45, 0.46);
    g.add(eye);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.14, 0.28, sz * 0.3);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.28, 6), fur);
      cyl.position.y = -0.14;
      leg.add(cyl);
      g.add(leg);
      legs.push(leg);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.34, -0.3);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.3, 6), furDark);
  t1.position.y = 0.14; t1.rotation.x = -0.5;
  tail.add(t1);
  const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), furDark);
  t2.position.set(0, 0.32, -0.1);
  tail.add(t2);
  g.add(tail);
  g.traverse(function (o2) { if (o2.isMesh) { o2.castShadow = true; o2.receiveShadow = true; } });
  g.scale.set(1.25, 1.25, 1.25);
  return { group: g, parts: { legs: legs, tail: tail, body: body, head: head } };
};

if (typeof window !== 'undefined') window.__NPC = NPC;
