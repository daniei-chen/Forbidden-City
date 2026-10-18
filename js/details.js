/* =============================================================
 *  紫禁城 · 数字复原  —  精细构件库
 *  铜鼎 / 树木（多树种）/ 斗拱（实例化）/ 铜龟铜鹤 / 日晷嘉量
 * ============================================================= */
const DETAIL = {};

/* ---------- 工具：两点之间的锥形圆柱（用于枝干、鼎足） ---------- */
DETAIL._unitCyl = null;
DETAIL.matrixSeg = function (from, to, radius) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 1e-4) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(radius, len, radius));
};

/* =============================================================
 *  青铜材质（带铜绿）
 * ============================================================ */
DETAIL.bronzeMat = function () {
  if (DETAIL._bronzeMat) return DETAIL._bronzeMat;
  const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
  g.fillStyle = '#6d5f42'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = TEX.rand() * S, y = TEX.rand() * S, r = 2 + TEX.rand() * 16;
    g.fillStyle = TEX.rand() < 0.55
      ? 'rgba(74,108,82,' + (0.05 + TEX.rand() * 0.16).toFixed(3) + ')'
      : 'rgba(150,124,68,' + (0.04 + TEX.rand() * 0.12).toFixed(3) + ')';
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = TEX.rand() < 0.5 ? 'rgba(30,26,18,0.10)' : 'rgba(210,190,140,0.06)';
    g.fillRect(TEX.rand() * S, TEX.rand() * S, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
  }
  DETAIL._bronzeMat = new THREE.MeshStandardMaterial({
    map: TEX.tex(cv, 1, 1), color: 0xc9b688, roughness: 0.48, metalness: 0.45
  });
  return DETAIL._bronzeMat;
};

/* =============================================================
 *  铜鼎（三足双耳带盖，仿故宫陈设鼎）
 *  返回 Group；o.scale 缩放，o.rot 朝向
 * ============================================================ */
DETAIL.censer = function (o) {
  o = o || {};
  const s = o.scale || 1.0;
  const mat = DETAIL.bronzeMat();
  const goldMat = MATS.goldDark;
  const g = new THREE.Group();

  /* 三足（外撇） */
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const ax = Math.cos(a), az = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ax * 0.52, 1.05, az * 0.52),
      new THREE.Vector3(ax * 0.72, 0.62, az * 0.72),
      new THREE.Vector3(ax * 0.78, 0.28, az * 0.78),
      new THREE.Vector3(ax * 0.66, 0.0, az * 0.66)
    ]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.115, 7, false), mat);
    leg.castShadow = true;
    g.add(leg);
    /* 足端兽爪 */
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat);
    paw.position.set(ax * 0.66, 0.06, az * 0.66);
    g.add(paw);
  }

  /* 鼎身（旋成面） */
  const pts = [
    new THREE.Vector2(0.02, 0.0),
    new THREE.Vector2(0.56, 0.02),
    new THREE.Vector2(0.72, 0.16),
    new THREE.Vector2(0.93, 0.5),
    new THREE.Vector2(1.0, 0.8),
    new THREE.Vector2(0.96, 1.02),
    new THREE.Vector2(0.82, 1.16),
    new THREE.Vector2(0.84, 1.28)
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat);
  body.position.y = 0.03;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  /* 弦纹 */
  for (const y of [0.42, 0.72, 1.02]) {
    const rr = y < 0.5 ? 0.9 : (y < 0.8 ? 1.0 : 0.97);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.022, 6, 28), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  /* 双耳 */
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 16, Math.PI), mat);
    ear.position.set(sx * 0.76, 1.3, 0);
    ear.rotation.z = Math.PI / 2;
    ear.rotation.y = sx > 0 ? 0 : Math.PI;
    g.add(ear);
  }

  /* 鼎盖 + 盖钮 */
  const lidPts = [
    new THREE.Vector2(0.86, 0),
    new THREE.Vector2(0.72, 0.1),
    new THREE.Vector2(0.5, 0.24),
    new THREE.Vector2(0.24, 0.34),
    new THREE.Vector2(0.1, 0.38)
  ];
  const lid = new THREE.Mesh(new THREE.LatheGeometry(lidPts, 24), mat);
  lid.position.y = 1.3;
  lid.castShadow = true;
  g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
  knob.position.y = 1.74;
  g.add(knob);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const nub = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), goldMat);
    nub.position.set(Math.cos(a) * 0.45, 1.62, Math.sin(a) * 0.45);
    g.add(nub);
  }

  g.scale.set(s, s, s);
  if (o.rot) g.rotation.y = o.rot;
  return g;
};

/* =============================================================
 *  树木：多树种精细建模（枝干分段 + 冠层多球）
 *  o: {h, species: 'cypress'|'pine'|'broadleaf', leafMat}
 * ============================================================ */
DETAIL.tree = function (o) {
  o = o || {};
  const h = o.h || 10;
  const rnd = TEX.rand;
  const species = o.species || (rnd() < 0.4 ? 'cypress' : (rnd() < 0.6 ? 'pine' : 'broadleaf'));
  const leafMats = [MATS.leaf, MATS.leafLight, MATS.leafDark || MATS.leaf];
  const leafMat = o.leafMat || leafMats[Math.floor(rnd() * leafMats.length)];

  const trunkR = 0.16 + h * 0.013;
  const trunkH = species === 'cypress' ? h * 0.62 : h * 0.5;

  const Y = new THREE.Vector3(0, 1, 0);
  const addSeg = function (from, to, r) {
    const m = DETAIL.matrixSeg(from, to, r);
    if (m) BATCH.add(DETAIL._cyl(), MATS.trunk, m);
  };

  /* 主干 */
  addSeg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, trunkH, 0), trunkR);
  /* 根部隆起 */
  BATCH.add(new THREE.CylinderGeometry(trunkR * 1.5, trunkR * 2.1, 0.35, 7), MATS.trunk,
    GEOM.mat4(0, 0.17, 0));

  /* 枝干 */
  const branchN = species === 'cypress' ? 2 : 3 + Math.floor(rnd() * 2);
  const branchTips = [];
  for (let i = 0; i < branchN; i++) {
    const a = (i / branchN) * Math.PI * 2 + rnd() * 0.8;
    const y0 = trunkH * (0.62 + rnd() * 0.22);
    const spread = h * (0.12 + rnd() * 0.1);
    const tip = new THREE.Vector3(
      Math.cos(a) * spread,
      y0 + h * (0.14 + rnd() * 0.1),
      Math.sin(a) * spread
    );
    addSeg(new THREE.Vector3(0, y0, 0), tip, trunkR * 0.42);
    branchTips.push(tip);
  }

  /* 冠层 */
  const lobeGeo = new THREE.IcosahedronGeometry(1, 1);
  const addLobe = function (x, y, z, rx, ry, rz, mat) {
    BATCH.add(lobeGeo, mat || leafMat, GEOM.mat4(x, y, z, rnd() * 3, rnd() * 3, rnd() * 3, rx, ry, rz));
  };

  if (species === 'cypress') {
    /* 侧柏：柱状层叠 */
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const y = trunkH * 0.78 + t * h * 0.4;
      const r = h * 0.17 * (1 - t * 0.62);
      addLobe((rnd() - 0.5) * 0.3, y, (rnd() - 0.5) * 0.3, r, r * 0.95, r);
    }
    addLobe(0, trunkH * 0.78 + h * 0.42, 0, h * 0.07, h * 0.09, h * 0.07);
  } else if (species === 'pine') {
    /* 古松：平展层片 */
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const y = trunkH * 0.82 + t * h * 0.34;
      const r = h * 0.26 * (1 - t * 0.5);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rnd() * 0.9;
        addLobe(Math.cos(a) * r * 0.5, y + (rnd() - 0.5) * 0.4, Math.sin(a) * r * 0.5,
          r * (0.55 + rnd() * 0.25), r * 0.32, r * (0.55 + rnd() * 0.25));
      }
    }
    addLobe(0, trunkH * 0.82 + h * 0.36, 0, h * 0.14, h * 0.12, h * 0.14);
  } else {
    /* 槐 / 银杏：团状树冠 */
    const crownY = trunkH * 0.92 + h * 0.22;
    const crownR = h * 0.26;
    addLobe(0, crownY + crownR * 0.25, 0, crownR * 0.9, crownR * 0.8, crownR * 0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
      const rr = crownR * (0.55 + rnd() * 0.25);
      addLobe(
        Math.cos(a) * crownR * 0.62,
        crownY + (rnd() - 0.4) * crownR * 0.5,
        Math.sin(a) * crownR * 0.62,
        rr, rr * 0.82, rr
      );
    }
  }

  /* 树冠叶片卡片：打散球簇轮廓，近景更自然 */
  let crownY2 = trunkH * 0.9 + h * 0.2;
  let crownR2 = h * 0.26;
  if (species === 'cypress') { crownY2 = trunkH * 0.8 + h * 0.22; crownR2 = h * 0.18; }
  const cardN = 9;
  for (let ci = 0; ci < cardN; ci++) {
    const a = TEX.rand() * Math.PI * 2;
    const rr = crownR2 * (0.1 + TEX.rand() * 0.85);
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const cy = crownY2 + (TEX.rand() - 0.32) * crownR2 * 1.1;
    const sz = h * (0.22 + TEX.rand() * 0.2);
    const gcard = new THREE.PlaneGeometry(sz, sz * 0.82);
    gcard.rotateY(TEX.rand() * Math.PI);
    gcard.rotateZ((TEX.rand() - 0.5) * 0.35);
    gcard.translate(cx, cy, cz);
    BATCH.add(gcard, MATS.leafCard, GEOM.mat4(0, 0, 0), { cast: false });
    gcard.dispose();
  }

  /* 树底 AO */
  BATCH.add(DETAIL._aoPlane(), MATS.aoDecal,
    GEOM.mat4(0, 0.02, 0, 0, 0, 0, h * 0.5, 1, h * 0.42), { cast: false });
};

DETAIL._cyl = function () {
  if (!DETAIL._cylGeo) DETAIL._cylGeo = new THREE.CylinderGeometry(0.62, 1, 1, 6, 1, true);
  return DETAIL._cylGeo;
};
DETAIL._aoPlane = function () {
  if (!DETAIL._aoGeo) {
    DETAIL._aoGeo = new THREE.PlaneGeometry(1, 1);
    DETAIL._aoGeo.rotateX(-Math.PI / 2);
  }
  return DETAIL._aoGeo;
};

/* =============================================================
 *  斗拱（实例化）
 * ============================================================ */
DETAIL.dougongGeo = function () {
  if (DETAIL._dgGeo) return DETAIL._dgGeo;
  const parts = [];
  const box = function (w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(0.36, 0.24, 0.36, 0, 0.12, 0);        // 坐斗
  box(1.15, 0.16, 0.24, 0, 0.32, 0);         // 横拱
  box(0.18, 0.16, 0.18, -0.46, 0.46, 0);     // 升
  box(0.18, 0.16, 0.18, 0, 0.46, 0);
  box(0.18, 0.16, 0.18, 0.46, 0.46, 0);
  box(0.20, 0.18, 0.78, 0, 0.32, 0.3);       // 昂
  box(0.8, 0.14, 0.18, 0, 0.52, 0.14);       // 耍头
  DETAIL._dgGeo = GEOM.merge(parts);
  return DETAIL._dgGeo;
};

DETAIL.dougongMat = null;
DETAIL.dougongMaterial = function () {
  if (!DETAIL.dougongMat) {
    DETAIL.dougongMat = new THREE.MeshStandardMaterial({
      color: 0x2f5d58, roughness: 0.62, metalness: 0.12
    });
  }
  return DETAIL.dougongMat;
};

/* 沿建筑四面檐下布置两排斗拱 */
DETAIL.addDougong = function (parent, o) {
  const geo = DETAIL.dougongGeo();
  const mat = DETAIL.dougongMaterial();
  const bw = o.bw, bd = o.bd, y = o.y;
  const bays = o.bays || 9;
  const scale = o.scale || 1.0;
  const positions = [];

  const addRow = function (len, axis, offset, rotY) {
    const n = Math.max(4, Math.round(len / (1.7 * scale)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
      const p = axis === 'x'
        ? new THREE.Vector3(t * len, y, offset)
        : new THREE.Vector3(offset, y, t * len);
      m.compose(p, q, new THREE.Vector3(scale, scale, scale));
      positions.push(m);
    }
  };
  addRow(bw + 1.2, 'x', bd / 2 + 0.7, 0);
  addRow(bw + 1.2, 'x', -bd / 2 - 0.7, Math.PI);
  addRow(bd + 1.2, 'z', bw / 2 + 0.7, Math.PI / 2);
  addRow(bd + 1.2, 'z', -bw / 2 - 0.7, -Math.PI / 2);

  const inst = new THREE.InstancedMesh(geo, mat, positions.length);
  for (let i = 0; i < positions.length; i++) inst.setMatrixAt(i, positions[i]);
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  parent.add(inst);
  return inst;
};

/* =============================================================
 *  铜龟 / 铜鹤（太和殿月台陈设）
 * ============================================================ */
DETAIL.turtle = function (o) {
  const mat = DETAIL.bronzeMat();
  const g = new THREE.Group();
  /* 龟座 */
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.7), MATS.marbleRail);
  base.position.y = 0.25;
  g.add(base);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), mat);
  body.scale.set(1.25, 0.55, 0.95);
  body.position.y = 0.72;
  g.add(body);
  /* 龟甲纹 */
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.76, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  shell.scale.set(1.2, 0.5, 0.92);
  shell.position.y = 0.74;
  g.add(shell);
  /* 头 */
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat);
  head.scale.set(1.3, 0.9, 0.9);
  head.position.set(0, 0.72, 0.86);
  g.add(head);
  /* 四足 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.45, 8), mat);
      leg.position.set(sx * 0.55, 0.42, sz * 0.5);
      g.add(leg);
    }
  }
  g.castShadow = true;
  return g;
};

DETAIL.crane = function (o) {
  const mat = DETAIL.bronzeMat();
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 12), MATS.marbleRail);
  base.position.y = 0.25;
  g.add(base);
  /* 腿 */
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.5, 6), mat);
    leg.position.set(sx * 0.18, 1.1, 0);
    g.add(leg);
  }
  /* 身 */
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), mat);
  body.scale.set(1.0, 0.78, 1.5);
  body.position.set(0, 2.0, 0.12);
  g.add(body);
  /* 颈 */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 8), mat);
  neck.position.set(0, 2.6, 0.75);
  neck.rotation.x = 0.5;
  g.add(neck);
  /* 头 + 喙 */
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
  head.position.set(0, 3.12, 1.06);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), mat);
  beak.position.set(0, 3.08, 1.24);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  /* 翅 */
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat);
    wing.scale.set(0.35, 0.8, 1.25);
    wing.position.set(sx * 0.42, 2.05, -0.1);
    g.add(wing);
  }
  /* 尾 */
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), mat);
  tail.rotation.x = -Math.PI / 2.6;
  tail.position.set(0, 2.02, -1.0);
  g.add(tail);
  g.castShadow = true;
  return g;
};

/* =============================================================
 *  瓦当 · 滴水（檐口实例化瓦件）
 * ============================================================= */
DETAIL.wadangGeo = function () {
  if (DETAIL._wdGeo) return DETAIL._wdGeo;
  const parts = [];
  const disc = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, 0);
  parts.push(disc);
  const drop = new THREE.BoxGeometry(0.2, 0.16, 0.05);
  drop.translate(0, -0.14, 0);
  parts.push(drop);
  DETAIL._wdGeo = GEOM.merge(parts);
  return DETAIL._wdGeo;
};

DETAIL.addEaveTiles = function (parent, o) {
  const geo = DETAIL.wadangGeo();
  const w = o.w, d = o.d, y = o.y;
  const spacing = o.spacing || 0.66;
  const scale = o.scale || 1.0;
  const mats = MATS.goldDark;
  const positions = [];

  const addLine = function (len, axis, offset, rotY) {
    const n = Math.max(6, Math.round(len / spacing));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
      const p = axis === 'x'
        ? new THREE.Vector3(t * len, y, offset)
        : new THREE.Vector3(offset, y, t * len);
      m.compose(p, q, new THREE.Vector3(scale, scale, scale));
      positions.push(m);
    }
  };
  addLine(w * 2, 'x', d, 0);
  addLine(w * 2, 'x', -d, Math.PI);
  addLine(d * 2, 'z', w, Math.PI / 2);
  addLine(d * 2, 'z', -w, -Math.PI / 2);

  const inst = new THREE.InstancedMesh(geo, mats, positions.length);
  (DETAIL.detailMeshes = DETAIL.detailMeshes || []).push(inst);
  for (let i = 0; i < positions.length; i++) inst.setMatrixAt(i, positions[i]);
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  parent.add(inst);
  return inst;
};

/* =============================================================
 *  椽头（檐下露明椽头，实例化）
 * ============================================================= */
DETAIL.rafterGeo = function () {
  if (DETAIL._rfGeo) return DETAIL._rfGeo;
  const parts = [];
  const g1 = new THREE.BoxGeometry(0.12, 0.11, 0.6);
  g1.translate(0, 0, -0.3);
  parts.push(g1);
  const g2 = new THREE.BoxGeometry(0.16, 0.15, 0.06);
  g2.translate(0, 0, -0.62);
  parts.push(g2);
  DETAIL._rfGeo = GEOM.merge(parts);
  return DETAIL._rfGeo;
};

DETAIL.addRafters = function (parent, o) {
  const geo = DETAIL.rafterGeo();
  const w = o.w, d = o.d, y = o.y;
  const spacing = o.spacing || 0.58;
  const scale = o.scale || 1.0;
  const inset = o.inset == null ? 0.55 : o.inset;
  const positions = [];
  const addLine = function (len, axis, offset, rotY) {
    const n = Math.max(8, Math.round(len / spacing));
    for (let i = 0; i < n; i++) {
      const t2 = (i + 0.5) / n - 0.5;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
      const p = axis === 'x'
        ? new THREE.Vector3(t2 * len, y, offset)
        : new THREE.Vector3(offset, y, t2 * len);
      m.compose(p, q, new THREE.Vector3(scale, scale, scale));
      positions.push(m);
    }
  };
  addLine(w * 2, 'x', d - inset, 0);
  addLine(w * 2, 'x', -(d - inset), Math.PI);
  addLine(d * 2, 'z', w - inset, Math.PI / 2);
  addLine(d * 2, 'z', -(w - inset), -Math.PI / 2);
  const inst = new THREE.InstancedMesh(geo, MATS.rafter, positions.length);
  (DETAIL.detailMeshes = DETAIL.detailMeshes || []).push(inst);
  for (let i = 0; i < positions.length; i++) inst.setMatrixAt(i, positions[i]);
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  parent.add(inst);
  return inst;
};
