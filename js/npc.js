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

  build: function (scene) {
    if (this.group) return this.group;
    const g = new THREE.Group();

    /* 八名静态侍卫（宫门/门洞两侧） */
    const statics = [
      [-20, 454, Math.PI], [20, 454, Math.PI],
      [-24, 300, Math.PI], [24, 300, Math.PI],
      [-14, -122, Math.PI], [14, -122, Math.PI],
      [-18, -452, 0], [18, -452, 0]
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
      { pts: [[38, -190], [38, -100]], speed: 1.0, phase: 0.8 }
    ];
    for (const r of routes) {
      const guard = this.makeGuard();
      g.add(guard.group);
      let len = 0;
      for (let i = 1; i < r.pts.length; i++) {
        len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      }
      this.patrols.push({
        obj: guard, pts: r.pts, len: len, speed: r.speed,
        t: r.phase * len, legPhase: Math.random() * 6.28
      });
    }

    /* 宫女两名（后三宫巡游） */
    const maidRoutes = [
      { pts: [[-9, -130], [-9, -250]], speed: 0.9, phase: 0.3 },
      { pts: [[9, -250], [9, -130]], speed: 0.9, phase: 0.8 }
    ];
    this.maids = [];
    for (const r of maidRoutes) {
      const maid = this.makeGuard({ robeColor: 0xc0717c, trimColor: 0xd8b45f, spear: false });
      g.add(maid.group);
      let len2 = 0;
      for (let i = 1; i < r.pts.length; i++) len2 += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      this.maids.push({ obj: maid, pts: r.pts, len: len2, speed: r.speed, t: r.phase * len2, legPhase: Math.random() * 6.28 });
    }

    /* 御猫三只 */
    const catRoutes = [
      { pts: [[30, -318], [62, -330], [58, -358], [26, -344]], speed: 0.55, phase: 0.1 },
      { pts: [[-40, -300], [-62, -320], [-50, -344]], speed: 0.5, phase: 0.6 },
      { pts: [[40, 200], [60, 218], [38, 236]], speed: 0.6, phase: 0.35 },
      { pts: [[-64, -350], [-46, -368], [-62, -386]], speed: 0.5, phase: 0.2 },
      { pts: [[-18, 262], [16, 262], [2, 276]], speed: 0.55, phase: 0.65 }
    ];
    this.cats = [];
    for (const r of catRoutes) {
      const cat = this.makeCat();
      g.add(cat.group);
      let len3 = 0;
      for (let i = 1; i < r.pts.length; i++) len3 += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      this.cats.push({ obj: cat, pts: r.pts, len: len3, speed: r.speed, t: r.phase * len3, legPhase: Math.random() * 6.28 });
    }

    this.group = g;
    scene.add(g);
    return g;
  },

  update: function (dt) {
    if (!this.group) return;
    this.time += dt;
    for (let mi = 0; mi < (this.maids || []).length; mi++) {
      const mw = this.maids[mi];
      mw.t += mw.speed * dt;
      if (mw.t > mw.len) mw.t -= mw.len;
      const p0 = mw.pts[0], p1 = mw.pts[1];
      const sl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const fx = (p1[0] - p0[0]) / sl, fz = (p1[1] - p0[1]) / sl;
      mw.obj.group.position.set(p0[0] + fx * mw.t, 0, p0[1] + fz * mw.t);
      mw.obj.group.rotation.y = Math.atan2(fx, fz);
      mw.legPhase += dt * mw.speed * 6.0;
      const sm = Math.sin(mw.legPhase);
      mw.obj.parts.legL.rotation.x = sm * 0.5;
      mw.obj.parts.legR.rotation.x = -sm * 0.5;
      mw.obj.parts.armL.rotation.x = -sm * 0.35;
      mw.obj.parts.armR.rotation.x = sm * 0.35;
    }
    for (let ci = 0; ci < (this.cats || []).length; ci++) {
      const cat = this.cats[ci];
      cat.t += cat.speed * dt;
      if (cat.t > cat.len) cat.t -= cat.len;
      let d2 = cat.t, ax2 = cat.pts[0][0], az2 = cat.pts[0][1], bx2 = cat.pts[1][0], bz2 = cat.pts[1][1], fxx = 0, fzz = 1;
      for (let k = 1; k < cat.pts.length; k++) {
        const sxx = cat.pts[k][0] - cat.pts[k - 1][0], szz = cat.pts[k][1] - cat.pts[k - 1][1];
        const sll = Math.hypot(sxx, szz);
        if (d2 <= sll) {
          ax2 = cat.pts[k - 1][0]; az2 = cat.pts[k - 1][1];
          bx2 = cat.pts[k][0]; bz2 = cat.pts[k][1];
          fxx = sxx / sll; fzz = szz / sll;
          break;
        }
        d2 -= sll;
      }
      const cx2 = ax2 + fxx * d2, cz2 = az2 + fzz * d2;
      cat.obj.group.position.set(cx2, 0, cz2);
      cat.obj.group.rotation.y = Math.atan2(fxx, fzz);
      cat.legPhase += dt * cat.speed * 8.0;
      const sc = Math.sin(cat.legPhase);
      cat.obj.parts.legs[0].rotation.x = sc * 0.55;
      cat.obj.parts.legs[1].rotation.x = -sc * 0.55;
      cat.obj.parts.legs[2].rotation.x = -sc * 0.55;
      cat.obj.parts.legs[3].rotation.x = sc * 0.55;
      cat.obj.parts.tail.rotation.z = Math.sin(this.time * 2.2 + ci) * 0.25;
      cat.obj.parts.body.position.y = 0.3 + Math.abs(sc) * 0.02;
    }
    for (let i = 0; i < this.patrols.length; i++) {
      const p = this.patrols[i];
      p.t += p.speed * dt;
      if (p.t > p.len) p.t -= p.len;
      /* 沿折线取位置 */
      let d = p.t, ax = p.pts[0][0], az = p.pts[0][1], bx = p.pts[1][0], bz = p.pts[1][1];
      const segLen = Math.hypot(bx - ax, bz - az);
      let fx = 0, fz = 1;
      if (p.pts.length > 2) {
        for (let k = 1; k < p.pts.length; k++) {
          const sx = p.pts[k][0] - p.pts[k - 1][0], sz = p.pts[k][1] - p.pts[k - 1][1];
          const sl = Math.hypot(sx, sz);
          if (d <= sl) {
            ax = p.pts[k - 1][0]; az = p.pts[k - 1][1];
            bx = p.pts[k][0]; bz = p.pts[k][1];
            fx = sx / sl; fz = sz / sl;
            break;
          }
          d -= sl;
        }
      } else {
        fx = (bx - ax) / segLen; fz = (bz - az) / segLen;
      }
      const px = ax + fx * d, pz = az + fz * d;
      p.obj.group.position.set(px, 0, pz);
      const targetYaw = Math.atan2(fx, fz);
      let dyaw = targetYaw - p.obj.group.rotation.y;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      p.obj.group.rotation.y += dyaw * Math.min(1, dt * 8);
      p.legPhase += dt * p.speed * 5.2;
      const s = Math.sin(p.legPhase);
      p.obj.parts.legL.rotation.x = s * 0.62;
      p.obj.parts.legR.rotation.x = -s * 0.62;
      p.obj.parts.armL.rotation.x = -s * 0.42;
      p.obj.parts.armR.rotation.x = s * 0.3;
      p.obj.parts.body.position.y = 0.52 + Math.abs(Math.sin(p.legPhase)) * 0.025;
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
