/* =============================================================
 *  紫禁城 · 数字复原  —  总平面布局
 *  坐标系：x 东西，z 南北（+z 为南，即开场镜头一侧），y 向上，单位：米
 *  中轴：午门 z=480 → 神武门 z=-481（约 961 m）
 * ============================================================= */
const LAYOUT = {};

LAYOUT.LABELS = [
  { text: '午门', x: 0, y: 42, z: 467 },
  { text: '太和门', x: 0, y: 30, z: 280 },
  { text: '太和殿', x: 0, y: 58, z: 58 },
  { text: '中和殿', x: 0, y: 38, z: -2 },
  { text: '保和殿', x: 0, y: 46, z: -56 },
  { text: '乾清门', x: 0, y: 22, z: -140 },
  { text: '神武门', x: 0, y: 40, z: -481 }
];

/* =============================================================
 *  三台（三层汉白玉須弥座）
 * ============================================================= */
LAYOUT.terrace = function (root) {
  const ZC = 14.5;                 // 三台中心 z
  const tiers = [
    { hw: 64.5, hd: 97.5, h: 2.71 },
    { hw: 62.4, hd: 95.4, h: 2.71 },
    { hw: 60.3, hd: 93.3, h: 2.71 }
  ];
  let y = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    GEOM.box(2 * t.hw, t.h, 2 * t.hd, MATS.marble, 0, y + t.h / 2, ZC);
    /* 须弥座束腰阴影线 */
    GEOM.box(2 * t.hw + 0.06, 0.35, 2 * t.hd + 0.06, MATS.stoneDark, 0, y + t.h * 0.5, ZC);
    /* 压边线脚 */
    GEOM.box(2 * t.hw + 0.7, 0.35, 2 * t.hd + 0.7, MATS.marbleRail, 0, y + t.h, ZC);
    /* 层间阴影线 */
    GEOM.box(2 * t.hw + 0.74, 0.1, 2 * t.hd + 0.74, MATS.stoneDark, 0, y + t.h - 0.22, ZC);
    /* 栏板 */
    const holes = [];
    if (i === 0) {
      holes.push({ side: 'S', c: 0, w: 44 });
      holes.push({ side: 'N', c: 0, w: 30 });
    }
    GEOM.balustrade({
      hw: t.hw + 0.15, hd: t.hd + 0.15, y: y + t.h,
      mat: MATS.marbleRail, spacing: 2.7, holes: holes
    });
    y += t.h;
  }

  /* 台面铺地（与栏板形成材质对比） */
  GEOM.box(2 * 60.1, 0.09, 2 * 93.1, MATS.terraceTop, 0, y + 0.045, ZC);
  /* 正面三出陛（丹陛大台阶） */
  const yTop = y;                        // 8.13
  GEOM.stairs({ x: 0, zTop: ZC + 97.5, w: 18, yTop: yTop, yBottom: 0, dir: 1, steps: 38, run: 32, dragon: true });
  GEOM.stairs({ x: -20.5, zTop: ZC + 97.5, w: 12, yTop: yTop, yBottom: 0, dir: 1, steps: 38, run: 32 });
  GEOM.stairs({ x: 20.5, zTop: ZC + 97.5, w: 12, yTop: yTop, yBottom: 0, dir: 1, steps: 38, run: 32 });
  /* 背面台阶 */
  GEOM.stairs({ x: 0, zTop: ZC - 97.5, w: 26, yTop: yTop, yBottom: 0, dir: -1, steps: 38, run: 24, dragon: true });
  return y;
};

/* =============================================================
 *  太和殿 · 月台 + 殿身
 * ============================================================= */
LAYOUT.taiheHall = function () {
  const yTop = 8.13;
  /* 月台 */
  GEOM.box(100, 1.5, 35, MATS.marble, 0, yTop + 0.75, 94.5);
  GEOM.box(101, 0.3, 36, MATS.marbleRail, 0, yTop + 1.5, 94.5);
  GEOM.box(99.6, 0.05, 34.6, MATS.terraceTop, 0, yTop + 1.68, 94.5);
  GEOM.balustrade({
    hw: 50.2, hd: 17.7, y: yTop + 1.5, mat: MATS.marbleRail, spacing: 2.5,
    holes: [
      { side: 'S', c: 0, w: 34 },
      { side: 'N', c: 0, w: 120 }
    ]
  });
  /* 月台三出陛 */
  GEOM.stairs({ x: 0, zTop: 112, w: 18, yTop: yTop + 1.5, yBottom: 0, dir: 1, steps: 40, run: 34, dragon: true });
  GEOM.stairs({ x: -21, zTop: 112, w: 12, yTop: yTop + 1.5, yBottom: 0, dir: 1, steps: 40, run: 34 });
  GEOM.stairs({ x: 21, zTop: 112, w: 12, yTop: yTop + 1.5, yBottom: 0, dir: 1, steps: 40, run: 34 });

  BUILD.begin(0, 58.5, 0);
  BUILD.hall({
    baseY: yTop + 1.5, podiumH: 1.0, podiumPad: 7, rail: true, railSpacing: 2.4,
    enterable: true, doorW: 7.0, hero: true,
    bodyW: 64, bodyD: 37, bodyH: 9.4, bays: 11,
    facadeMat: MATS.facade11,
    layers: 2,
    eave1: [35.6, 21.8], inner1: [25.6, 15.2], rise1: 4.9,
    upperH: 3.6,
    eave2: [28.8, 17.8], ridgeHalf: 19.8, rise2: 7.0,
    plaque: '太和殿', plaqueW: 5.4,
    stairs: { w: 22, steps: 5, run: 4.2, dragon: true },
    beasts1: 10, beasts2: 10, tile: 2.5, ridgeH: 1.0
  });
  BUILD.end();
};

/* =============================================================
 *  中和殿（单檐四角攒尖）+ 保和殿（重檐庑殿）
 * ============================================================= */
LAYOUT.middleHalls = function () {
  BUILD.begin(0, -2, 0);
  BUILD.hall({
    baseY: 8.13, podiumH: 1.2, podiumPad: 6, rail: true,
    enterable: true, doorW: 4.6,
    hero: true, bodyW: 24, bodyD: 24, bodyH: 8.4, bays: 3, sideBays: 3,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'pyramid',
    eave1: [15.8, 15.8], rise1: 7.6,
    finialScale: 1.15, plaque: '中和殿', plaqueW: 3.8,
    stairs: { w: 12, steps: 5, run: 4.2 },
    beasts1: 3, tile: 2.2
  });
  BUILD.end();

  BUILD.begin(0, -56.5, 0);
  BUILD.hall({
    baseY: 8.13, podiumH: 1.3, podiumPad: 6, rail: true,
    enterable: true, doorW: 5.2,
    hero: true, bodyW: 49.7, bodyD: 25, bodyH: 8.8, bays: 9,
    facadeMat: MATS.facade9,
    layers: 2,
    facets: 'gable', gd: 12.6, gableBase: 0.2,
    eave1: [28.6, 15.8], inner1: [21.2, 11.7], rise1: 4.3,
    upperH: 3.4,
    eave2: [24.0, 14.2], ridgeHalf: 22.0, rise2: 5.0,
    plaque: '保和殿', plaqueW: 4.8,
    stairs: { w: 16, steps: 5, run: 4.2 },
    beasts1: 6, beasts2: 7, tile: 2.3
  });
  BUILD.end();

  /* 保和殿后台阶 */
  GEOM.stairs({ x: 0, zTop: -83, w: 24, yTop: 8.13, yBottom: 0, dir: -1, steps: 38, run: 24, dragon: true });
};

/* =============================================================
 *  太和门（重檐）
 * ============================================================= */
LAYOUT.taiheGate = function () {
  BUILD.begin(0, 280, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.8, podiumPad: 6, rail: true,
    bodyW: 34, bodyD: 14, bodyH: 8.6, bays: 9,
    facadeMat: MATS.facade9,
    layers: 2,
    facets: 'gable', gd: 8.2, gableBase: 0.2,
    eave1: [20.6, 10.8], inner1: [14.8, 7.6], rise1: 4.0,
    upperH: 3.2,
    eave2: [17.0, 9.1], ridgeHalf: 15.2, rise2: 4.3,
    hero: true, plaque: '太和门', plaqueW: 4.2,
    stairs: { w: 16, steps: 6, run: 5.0 },
    beasts1: 5, beasts2: 5, tile: 2.0
  });
  BUILD.end();

  /* 昭德门 / 贞度门 */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 54, 258, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    BUILD.hall({
      baseY: 0, podiumH: 1.2, podiumPad: 4, rail: true,
      bodyW: 14, bodyD: 8, bodyH: 5.4, bays: 3, noColumns: true,
      layers: 1, eave1: [9.6, 6.4], ridgeHalf: 7.0, rise1: 3.2,
      plaque: s > 0 ? '昭德门' : '贞度门', plaqueW: 2.6,
      stairs: { w: 8, steps: 5, run: 4.0 }, beasts1: 3, tile: 1.6,
      facadeMat: MATS.facade5
    });
    BUILD.end();
  }
};

/* =============================================================
 *  内金水河 + 五座金水桥
 * ============================================================= */
LAYOUT.river = function (root) {
  const x0 = -112, x1 = 112, segs = 56, width = 13, amp = 14, zBase = 350;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push({ x: x0 + (x1 - x0) * t, z: zBase + amp * Math.sin(Math.PI * t) });
  }
  /* 水面 */
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const p = pts[i];
    const pp = pts[Math.max(0, i - 1)], pn = pts[Math.min(segs, i + 1)];
    const tx = pn.x - pp.x, tz = pn.z - pp.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len, nz = tx / len;
    pos.push(p.x + nx * width / 2, 0.07, p.z + nz * width / 2);
    pos.push(p.x - nx * width / 2, 0.07, p.z - nz * width / 2);
    uv.push((i / segs) * 18, 0);
    uv.push((i / segs) * 18, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const water = new THREE.Mesh(g, MATS.water);
  water.receiveShadow = true;
  root.add(water);

  /* 河帮（与地面齐平的石岸） */
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const dx = p1.x - p0.x, dz = p1.z - p0.z;
      const len = Math.hypot(dx, dz);
      const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
      const nx = -(dz / len), nz = dx / len;
      const ry = Math.atan2(-dz, dx);
      BATCH.add(GEOM.boxGeo, MATS.marbleRail,
        GEOM.mat4(mx + side * nx * (width / 2 + 0.9), 0.03, mz + side * nz * (width / 2 + 0.9), 0, ry, 0, 1.8, 0.09, len + 0.2));
    }
  }

  /* 五座单孔石桥 */
  const bridgeX = [-48, -24, 0, 24, 48];
  for (let i = 0; i < bridgeX.length; i++) {
    const bx = bridgeX[i];
    const t = (bx - x0) / (x1 - x0);
    const bz = zBase + amp * Math.sin(Math.PI * t);
    BUILD.begin(bx, bz, 0);
    BUILD.bridge({ w: i === 2 ? 9 : 6.5, len: 24, y: 0.55 });
    BUILD.end();
  }
};

/* =============================================================
 *  午门（凹字形：墩台 + 正楼 + 雁翅楼 + 方亭）
 * ============================================================= */
LAYOUT.meridianGate = function () {
  BUILD.begin(0, 467.5, 0);
  BUILD.gate({
    baseY: 0, bodyW: 80, bodyD: 30, bodyH: 12,
    arches: 5, archW: 4.8, archH: 9.6, archGap: 8.2,
    wallMat: MATS.brick,
    tower: {
      bodyW: 58, bodyD: 22, bodyH: 9.4, bays: 9,
      eave1: [33.6, 14.8], inner1: [23.6, 9.6], rise1: 4.4,
      upperH: 3.6,
      eave2: [26.8, 11.6], ridgeHalf: 19.0, rise2: 5.4,
      plaque: '午门', plaqueW: 4.8, facadeMat: MATS.facade9
    }
  });
  /* 城台女墙 */
  for (let i = 0; i < 2; i++) {
    const sz = i === 0 ? 1 : -1;
    GEOM.box(80, 1.1, 0.9, MATS.wall, 0, 12.55, sz * 15.6);
    const sx = i === 0 ? 1 : -1;
    GEOM.box(0.9, 1.1, 30, MATS.wall, sx * 40.1, 12.55, 0);
  }
  BUILD.end();

  /* 雁翅楼（东西各 13 间） */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 44, 507, Math.PI / 2);
    BUILD.corridor({ len: 54, dep: 10, h: 9.5, baseY: 0, rise: 2.2 });
    BUILD.end();
    /* 两端方亭（重檐攒尖） */
    BUILD.begin(s * 44, 536, 0);
    BUILD.hall({
      baseY: 9.0, bodyW: 8.5, bodyD: 8.5, bodyH: 3.2, bays: 3, noColumns: true,
      layers: 2, facets: 'pyramid',
      eave1: [6.8, 6.8], rise1: 2.2, upperH: 1.9,
      eave2: [4.4, 4.4], rise2: 1.9, finialScale: 0.7,
      beasts1: 2, beasts2: 2, tile: 1.4
    });
    BUILD.end();
  }
};

/* =============================================================
 *  神武门
 * ============================================================= */
LAYOUT.shenwuGate = function () {
  BUILD.begin(0, -481, 0);
  BUILD.gate({
    baseY: 0, bodyW: 50, bodyD: 20, bodyH: 11,
    arches: 3, archW: 4.6, archH: 8.2, archGap: 8.5,
    wallMat: MATS.brick,
    tower: {
      bodyW: 36, bodyD: 15, bodyH: 7.2, bays: 5,
      eave1: [21.2, 10.8], inner1: [14.2, 7.2], rise1: 3.8,
      upperH: 3.0,
      eave2: [16.6, 8.6], ridgeHalf: 12.2, rise2: 4.6,
      plaque: '神武门', plaqueW: 3.8, facadeMat: MATS.facade5
    }
  });
  BUILD.end();
};

/* =============================================================
 *  城墙 / 角楼 / 东华门 · 西华门
 * ============================================================= */
LAYOUT.cityWalls = function () {
  const W = 376.5, S = 480, N = -481;
  const H = 10, TH = 8;

  BUILD.wallRun({ x1: W, z1: S, x2: W, z2: N, h: H, w: TH });
  BUILD.wallRun({ x1: -W, z1: S, x2: -W, z2: N, h: H, w: TH });
  BUILD.wallRun({ x1: W, z1: N, x2: -W, z2: N, h: H, w: TH });
  BUILD.wallRun({ x1: -W, z1: S, x2: -40, z2: S, h: H, w: TH });
  BUILD.wallRun({ x1: 40, z1: S, x2: W, z2: S, h: H, w: TH });

  /* 四隅角楼 */
  const corners = [[W, S], [-W, S], [W, N], [-W, N]];
  for (let i = 0; i < corners.length; i++) {
    BUILD.begin(corners[i][0], corners[i][1], 0);
    BUILD.cornerTower({ baseY: 10 });
    BUILD.end();
  }

  /* 东华门 / 西华门 */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * W, 0, s * Math.PI / 2);
    BUILD.gate({
      baseY: 0, bodyW: 40, bodyD: 16, bodyH: 10.5,
      arches: 3, archW: 4.2, archH: 7.6, archGap: 7.2,
      wallMat: MATS.brick,
      tower: {
        bodyW: 28, bodyD: 12, bodyH: 6.4, bays: 5,
        eave1: [17.2, 8.8], inner1: [11.6, 6.0], rise1: 3.2,
        upperH: 2.6, eave2: [13.8, 7.2], ridgeHalf: 9.8, rise2: 3.8,
        plaque: s > 0 ? '东华门' : '西华门', plaqueW: 3.2, facadeMat: MATS.facade5
      }
    });
    BUILD.end();

    /* 城台须弥座 */
    BATCH.add(GEOM.boxGeo, MATS.marbleRail,
      GEOM.mat4(s * W, 0.3, 0, 0, 0, 0, 44, 0.6, 20));

    /* 马道：城门内侧漫坡通城顶 */
    const ang = Math.atan2(10.5, 46) * (s > 0 ? 1 : -1);
    BATCH.add(GEOM.boxGeo, MATS.brick,
      GEOM.mat4(s * 345, 5.25, 0, 0, 0, ang, 46, 0.8, 3.6));
    for (const s2 of [-1, 1]) {
      BATCH.add(GEOM.boxGeo, MATS.brick,
        GEOM.mat4(s * 345, 5.7, s2 * 1.9, 0, 0, ang, 46, 1.0, 0.36));
    }
  }
};

/* =============================================================
 *  东西廊庑
 * ============================================================= */
LAYOUT.corridors = function () {
  /* 太和殿广场两侧 */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 108, 14.5, Math.PI / 2);
    BUILD.corridor({ len: 190, dep: 11, h: 6.4, baseY: 0, rise: 3.2, batch: true });
    BUILD.end();
  }
  /* 太和门广场两侧：给体仁阁 / 弘义阁让出位置（z 184..226） */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 108, 148, Math.PI / 2);
    BUILD.corridor({ len: 62, dep: 10, h: 6.0, baseY: 0, rise: 3.0, batch: true });
    BUILD.end();
    BUILD.begin(s * 108, 248, Math.PI / 2);
    BUILD.corridor({ len: 38, dep: 10, h: 6.0, baseY: 0, rise: 3.0, batch: true });
    BUILD.end();
  }
  /* 体仁阁（东）/ 弘义阁（西） */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 98, 205, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    BUILD.twoStory({
      bodyW: 42, bodyD: 14, bays: 9,
      lowerH: 8.6, upperH: 5.2, rise1: 3.2, rise2: 4.6,
      podiumH: 0.9, ridgeHalf: 12.5, tile: 2.0,
      plaque: s > 0 ? '体仁阁' : '弘义阁'
    });
    BUILD.end();
  }
};

/* =============================================================
 *  后三宫（简化）
 * ============================================================= */
LAYOUT.innerCourt = function () {
  /* 乾清门 */
  BUILD.begin(0, -140, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.7, podiumPad: 5, rail: true,
    bodyW: 22, bodyD: 10, bodyH: 6.4, bays: 5,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'gable', gd: 7.0, gableBase: 0.2,
    eave1: [14.2, 8.0], ridgeHalf: 13.2, rise1: 4.4,
    plaque: '乾清门', plaqueW: 3.4,
    stairs: { w: 12, steps: 6, run: 5.0 },
    beasts1: 4, tile: 1.9
  });
  BUILD.end();

  /* 乾清宫 */
  BUILD.begin(0, -196, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.5, podiumPad: 7, rail: true,
    bodyW: 38, bodyD: 18, bodyH: 7.6, bays: 7,
    facadeMat: MATS.facade7,
    layers: 2,
    eave1: [22.8, 12.6], inner1: [16.6, 9.2], rise1: 3.8,
    upperH: 3.0,
    eave2: [18.6, 10.8], ridgeHalf: 12.4, rise2: 4.4,
    hero: true, plaque: '乾清宫', plaqueW: 4.0,
    stairs: { w: 14, steps: 5, run: 4.4 },
    beasts1: 5, beasts2: 5, tile: 2.1
  });
  BUILD.end();

  /* 坤宁宫 */
  BUILD.begin(0, -244, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.3, podiumPad: 6, rail: true,
    bodyW: 30, bodyD: 14, bodyH: 6.8, bays: 5,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'hip',
    eave1: [18.2, 10.0], ridgeHalf: 12.4, rise1: 4.6,
    hero: true, plaque: '坤宁宫', plaqueW: 3.6,
    stairs: { w: 12, steps: 5, run: 4.2 },
    beasts1: 4, tile: 2.0
  });
  BUILD.end();
};

/* =============================================================
 *  侧宫院（文华殿 / 武英殿 / 东西六宫 简化）
 * ============================================================= */
LAYOUT.compound = function (cx, cz) {
  const w = 66, d = 66, hw = w / 2, hd = d / 2;
  BUILD.begin(cx, cz, 0);
  /* 院墙 */
  BUILD.wallRun({ x1: -hw, z1: -hd, x2: hw, z2: -hd, h: 3.8, w: 1.3, merlons: false, innerWall: false });
  BUILD.wallRun({ x1: hw, z1: -hd, x2: hw, z2: hd, h: 3.8, w: 1.3, merlons: false, innerWall: false });
  BUILD.wallRun({ x1: -hw, z1: hd, x2: -hw, z2: -hd, h: 3.8, w: 1.3, merlons: false, innerWall: false });
  BUILD.wallRun({ x1: -hw, z1: hd, x2: -10, z2: hd, h: 3.8, w: 1.3, merlons: false, innerWall: false });
  BUILD.wallRun({ x1: 10, z1: hd, x2: hw, z2: hd, h: 3.8, w: 1.3, merlons: false, innerWall: false });

  /* 院门 */
  BUILD.begin(0, hd + 1.5, 0);
  BUILD.hall({
    baseY: 0, bodyW: 9, bodyD: 5, bodyH: 4.0, bays: 3, batch: true,
    enterable: true, doorW: 6.0,
    noColumns: true, noFacade: true, layers: 1,
    eave1: [6.4, 4.2], ridgeHalf: 4.6, rise1: 2.4, tile: 1.3, beasts1: 2
  });
  BUILD.end();

  /* 主殿 */
  BUILD.begin(0, -hd * 0.32, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.0, podiumPad: 4, rail: false, batch: true,
    bodyW: 26, bodyD: 13, bodyH: 6.2, bays: 5,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'gable', gd: 8.2, gableBase: 0.2,
    eave1: [16.0, 9.4], ridgeHalf: 15.0, rise1: 4.0,
    beasts1: 3, tile: 1.9
  });
  BUILD.end();

  /* 东西配殿 */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 20, hd * 0.12, s * Math.PI / 2);
    BUILD.hall({
      baseY: 0, bodyW: 15, bodyD: 7, bodyH: 4.6, bays: 3, batch: true,
      noColumns: true, layers: 1, eave1: [9.6, 5.4], ridgeHalf: 6.2, rise1: 2.8,
      tile: 1.5, beasts1: 2
    });
    BUILD.end();
  }
  BUILD.end();
};

LAYOUT.sidePalaces = function () {
  const spots = [];
  /* 外朝两翼：文华殿 / 武英殿院落单独建模，这里只留外围院落 */
  for (const sx of [-1, 1]) {
    for (const zc of [148]) {
      spots.push({ x: sx * 166, z: zc });
      spots.push({ x: sx * 260, z: zc });
    }
    spots.push({ x: sx * 280, z: 240 });
  }
  /* 后三宫两翼：东西六宫（西侧中列让给慈宁宫院落） */
  for (const sx of [-1, 1]) {
    for (const zc of [-110, -188, -264]) {
      spots.push({ x: sx * 142, z: zc });
      if (!(sx < 0 && zc !== -264)) spots.push({ x: sx * 226, z: zc });
      spots.push({ x: sx * 310, z: zc });
    }
  }
  for (let i = 0; i < spots.length; i++) LAYOUT.compound(spots[i].x, spots[i].z);

  /* 宫院里的树 */
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    for (let k = 0; k < 3; k++) {
      const tx = p.x + (TEX.rand() - 0.5) * 40;
      const tz = p.z + (TEX.rand() - 0.5) * 40;
      BUILD.begin(tx, tz, 0);
      BUILD.tree({ h: 7 + TEX.rand() * 5 });
      BUILD.end();
    }
  }
};

/* =============================================================
 *  内金水河以外：广场御道 / 陈设
 * ============================================================= */
LAYOUT.pathsAndProps = function () {
  /* 御道 */
  GEOM.box(18, 0.12, 310, MATS.path, 0, 0.06, 300);
  GEOM.box(12, 0.1, 58, MATS.path, 0, 0.05, -111);
  GEOM.box(10, 0.1, 330, MATS.path, 0, 0.05, -310);

  /* 华表（午门内两侧） */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 26, 438, 0);
    BUILD.huabiao({ baseY: 0 });
    BUILD.end();
  }
  /* 铜狮（太和门前） */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 13, 304, 0);
    BUILD.lion({ baseY: 0 });
    BUILD.end();
  }
  /* 月台铜鼎 8 座 */
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 2; k++) {
      const px = s * (20 + k * 15);
      const pz = 100 - k * 9;
      BUILD.begin(px, pz, 0);
      BUILD.censer({ baseY: 9.63 });
      BUILD.end();
    }
  }
  /* 铜龟 / 铜鹤位置改为小型铜鼎点缀三台 */
  for (let s = -1; s <= 1; s += 2) {
    BUILD.begin(s * 52, 104, 0);
    BUILD.censer({ baseY: 8.13 });
    BUILD.end();
  }
};

/* =============================================================
 *  御花园 / 广场树
 * ============================================================= */
LAYOUT.garden = function () {
  /* 御花园：沿东西墙与南侧留树，避开中轴殿宇与亭台 */
  const gardenSpots = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      gardenSpots.push([sx * (96 + (i % 2) * 18), -264 - Math.floor(i / 2) * 22 + TEX.rand() * 8]);
    }
    for (let i = 0; i < 4; i++) {
      gardenSpots.push([sx * (22 + i * 7), -388 - TEX.rand() * 10]);
    }
    for (let i = 0; i < 3; i++) {
      gardenSpots.push([sx * (38 + i * 12), -278 - TEX.rand() * 6]);
    }
  }
  for (let i = 0; i < gardenSpots.length; i++) {
    BUILD.begin(gardenSpots[i][0], gardenSpots[i][1], 0);
    BUILD.tree({ h: 8 + TEX.rand() * 6 });
    BUILD.end();
  }
  /* 乾清宫院内两侧 */
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 3; k++) {
      BUILD.begin(s * (26 + k * 4), -170 - k * 18, 0);
      BUILD.tree({ h: 7 + TEX.rand() * 4 });
      BUILD.end();
    }
  }
  /* 午门内广场两侧少量 */
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 3; k++) {
      BUILD.begin(s * (120 + k * 6), 390 - k * 26, 0);
      BUILD.tree({ h: 7 + TEX.rand() * 4 });
      BUILD.end();
    }
  }
};

/* =============================================================
 *  护城河
 * ============================================================= */
LAYOUT.moat = function () {
  const y = 0.14;
  const w = 52;
  const walls = { x: 376.5, s: 480, n: -481 };
  function waterStrip(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MATS.water);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    BUILD.parent.add(m);
  }
  waterStrip(0, walls.s + 34 + w / 2, 2 * (walls.x + 60), w);
  waterStrip(0, walls.n - 34 - w / 2, 2 * (walls.x + 60), w);
  waterStrip(walls.x + 34 + w / 2, 0, w, 2 * (walls.s - walls.n) + 120);
  waterStrip(-(walls.x + 34 + w / 2), 0, w, 2 * (walls.s - walls.n) + 120);
};

/* =============================================================
 *  神武门内：顺贞门 / 承光门 / 北横街 / 马道
 * ============================================================= */
LAYOUT.northStreet = function () {
  /* 顺贞门（3 座琉璃门） */
  BUILD.begin(0, -404, 0);
  BUILD.gate({
    baseY: 0, bodyW: 30, bodyD: 6, bodyH: 6.2,
    arches: 3, archW: 3.0, archH: 4.6, archGap: 6.4,
    wallMat: MATS.brick
  });
  GEOM.roofTier({
    group: BUILD.group, AW: 17.4, AD: 5.4, aw: 12.2, ad: 0.01,
    y0: 6.2, y1: 8.4, ridgeTop: true, ridgeH: 0.5, ridgeW: 0.5,
    ridgeR: 0.16, beasts: 2, tile: 1.4
  });
  BUILD.end();

  /* 延和门 / 集福门 */
  for (const sx of [-1, 1]) {
    BUILD.begin(sx * 38, -404, 0);
    BUILD.gateSimple({ w: 6, d: 4.2, h: 4.6 });
    BUILD.end();
  }
  /* 连接矮墙 */
  BUILD.wallRun({ x1: -140, z1: -404, x2: -33, z2: -404, h: 4.4, w: 2.4, merlons: false, innerWall: false });
  BUILD.wallRun({ x1: 33, z1: -404, x2: 140, z2: -404, h: 4.4, w: 2.4, merlons: false, innerWall: false });

  /* 承光门（御花园北门） */
  BUILD.begin(0, -392, 0);
  BUILD.gateSimple({ w: 8, d: 4.4, h: 4.4 });
  BUILD.end();

  /* 北横街两侧宫墙 */
  for (const sx of [-1, 1]) {
    BUILD.wallRun({ x1: sx * 64, z1: -472, x2: sx * 64, z2: -406, h: 5.0, w: 2.4, merlons: false, innerWall: false });
  }

  /* 马道：神武门内东西各一，漫坡通向城顶 */
  const len = Math.hypot(56, 9.9);
  const ang = Math.atan2(9.9, 56) * 1.0;
  for (const sx of [-1, 1]) {
    BATCH.add(GEOM.boxGeo, MATS.brick,
      GEOM.mat4(sx * 40, 4.95, -442, ang, 0, 0, 3.4, 0.8, len));
    /* 两侧护墙 */
    for (const s2 of [-1, 1]) {
      BATCH.add(GEOM.boxGeo, MATS.brick,
        GEOM.mat4(sx * 40 + s2 * 1.9, 5.35, -442, ang, 0, 0, 0.38, 1.0, len));
    }
    /* 坡道压边 */
    BATCH.add(GEOM.boxGeo, MATS.marbleRail,
      GEOM.mat4(sx * 40, 9.9, -470, 0, 0, 0, 3.8, 0.25, 2.2));
  }
};

/* =============================================================
 *  墙面风化 / 水渍（随机条带，沿城墙内侧与殿基）
 * ============================================================= */
LAYOUT.weathering = function () {
  const addStain = function (x, y, z, w, h, ry) {
    const geo = new THREE.PlaneGeometry(w, h);
    BATCH.add(geo, MATS.stain, GEOM.mat4(x, y, z, 0, ry, 0), { cast: false });
  };
  /* 城墙内侧 */
  const W = 372.0;
  for (let z = -460; z <= 460; z += 34) {
    if (Math.abs(z) < 60) continue;
    addStain(W, 0.9, z, 7.5, 1.7, -Math.PI / 2);
    addStain(-W, 0.9, z, 7.5, 1.7, Math.PI / 2);
  }
  for (let x = -340; x <= 340; x += 38) {
    if (Math.abs(x) < 70) continue;
    addStain(x, 0.9, -477, 7.5, 1.7, 0);
    addStain(x, 0.9, 476, 7.5, 1.7, Math.PI);
  }
  /* 主要殿基 / 台座阴角 */
  addStain(0, 0.75, 146, 26, 1.5, 0);
  addStain(0, 8.85, 112.5, 30, 1.1, 0);
  addStain(0, 0.7, -107.5, 18, 1.3, Math.PI);
  addStain(0, 0.7, 280.3, 20, 1.2, 0);
  addStain(0, 0.7, -140.3, 14, 1.1, 0);
};

/* =============================================================
 *  生活痕迹：墙根苔藓 + 御道磨损色带
 * ============================================================= */
LAYOUT.wear = function () {
  const moss = function (x, y, z, w, h, ry) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    BATCH.add(geo, MATS.moss, GEOM.mat4(x, y, z, 0, ry || 0, 0), { cast: false });
  };
  /* 城墙根部苔藓（略高于地面，细长条） */
  const W = 371.6;
  for (let z = -450; z <= 450; z += 52) {
    moss(W, 0.05, z, 44, 1.5, -Math.PI / 2);
    moss(-W, 0.05, z, 44, 1.5, Math.PI / 2);
  }
  for (let x = -330; x <= 330; x += 58) {
    moss(x, 0.05, -476.6, 46, 1.5, 0);
    moss(x, 0.05, 475.6, 46, 1.5, Math.PI);
  }
  /* 御道中轴磨损（深色带状） */
  const addWear = function (z, len, w) {
    const geo = new THREE.PlaneGeometry(w, len);
    geo.rotateX(-Math.PI / 2);
    BATCH.add(geo, MATS.stain, GEOM.mat4(0, 0.052, z, 0, 0, 0), { cast: false });
  };
  addWear(330, 90, 7.0);
  addWear(220, 100, 6.2);
  addWear(120, 80, 6.0);
  addWear(20, 90, 5.6);
  addWear(-60, 70, 5.2);
  addWear(-160, 80, 5.0);
  addWear(-260, 90, 4.8);
  addWear(-380, 80, 4.6);
};

/* =============================================================
 *  地面碎石 / 落叶堆积 / 墙面雨痕
 * ============================================================= */
LAYOUT.debris = function () {
  const rnd = TEX.rand;
  const stoneGeos = [];
  const leafA = [], leafB = [];
  const blocked = function (x, z, m) {
    m = m == null ? 1.6 : m;
    const cs = (typeof BUILD !== 'undefined' && BUILD.colliders) ? BUILD.colliders : [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m) return true;
    }
    return false;
  };
  /* 碎石：墙根、院落角落、甬道边 */
  for (let i = 0; i < 170; i++) {
    const r = rnd();
    let x, z;
    if (r < 0.4) {
      x = (rnd() < 0.5 ? -1 : 1) * (300 + rnd() * 66);
      z = -470 + rnd() * 940;
    } else if (r < 0.66) {
      x = -355 + rnd() * 710;
      z = (rnd() < 0.5 ? -1 : 1) * (430 + rnd() * 40);
    } else {
      x = -330 + rnd() * 660;
      z = -460 + rnd() * 920;
    }
    if (blocked(x, z, 1.4)) continue;
    const g = new THREE.IcosahedronGeometry(0.1 + rnd() * 0.26, 0);
    g.scale(1.0, 0.5 + rnd() * 0.4, 1.0);
    g.translate(x, 0.05 + rnd() * 0.05, z);
    stoneGeos.push(g);
  }
  /* 落叶堆：墙根、树池边、角落 */
  for (let i = 0; i < 110; i++) {
    const r = rnd();
    let x, z;
    if (r < 0.5) {
      x = (rnd() < 0.5 ? -1 : 1) * (340 + rnd() * 30);
      z = -460 + rnd() * 920;
    } else {
      x = -340 + rnd() * 680;
      z = (rnd() < 0.5 ? -1 : 1) * (455 + rnd() * 18);
    }
    if (blocked(x, z, 1.2)) continue;
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const g = new THREE.CircleGeometry(0.5 + rnd() * 1.1, 6);
      g.rotateX(-Math.PI / 2);
      g.translate(x + (rnd() - 0.5) * 2.2, 0.04 + k * 0.003, z + (rnd() - 0.5) * 2.2);
      (rnd() < 0.5 ? leafA : leafB).push(g);
    }
  }
  if (stoneGeos.length) {
    const mesh = new THREE.Mesh(GEOM.merge(stoneGeos), MATS.marbleRail);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    BUILD.parent.add(mesh);
  }
  if (leafA.length) { const m = new THREE.Mesh(GEOM.merge(leafA), MATS.fallenLeaf || MATS.leafDark); m.receiveShadow = true; BUILD.parent.add(m); }
  if (leafB.length) { const m = new THREE.Mesh(GEOM.merge(leafB), MATS.fallenLeaf2 || MATS.leafLight); m.receiveShadow = true; BUILD.parent.add(m); }

  /* 墙面雨痕（竖直污渍，较淡） */
  const streak = function (x, y, z, w, h, ry) {
    const g = new THREE.PlaneGeometry(w, h);
    BATCH.add(g, MATS.stain, GEOM.mat4(x, y, z, 0, ry, 0), { cast: false });
  };
  for (let i = 0; i < 22; i++) {
    const z = -440 + rnd() * 880;
    const y = 2.0 + rnd() * 3.4;
    const w = 0.9 + rnd() * 1.6;
    const h = 3.5 + rnd() * 3.5;
    if (rnd() < 0.5) streak(371.5, y, z, w, h, -Math.PI / 2);
    else streak(-371.5, y, z, w, h, Math.PI / 2);
  }
  for (let i = 0; i < 10; i++) {
    streak(-300 + rnd() * 600, 2.0 + rnd() * 3.0, -476.8, 1.0 + rnd() * 1.2, 3.5 + rnd() * 3.0, 0);
    streak(-300 + rnd() * 600, 2.0 + rnd() * 3.0, 475.8, 1.0 + rnd() * 1.2, 3.5 + rnd() * 3.0, Math.PI);
  }
};

/* =============================================================
 *  接地 AO 条带（城墙内侧 + 宫门台基）
 * ============================================================= */
LAYOUT.aoBands = function () {
  const wallGeo = function (len) { return new THREE.PlaneGeometry(len, 2.8); };
  const groundGeo = function (len) { return new THREE.PlaneGeometry(len, 2.0); };
  for (let z = -430; z <= 430; z += 46) {
    if (Math.abs(z) < 90) continue;
    BATCH.add(wallGeo(46), MATS.aoStrip, GEOM.mat4(372.3, 1.35, z, 0, -Math.PI / 2, 0), { cast: false });
    BATCH.add(wallGeo(46), MATS.aoStrip, GEOM.mat4(-372.3, 1.35, z, 0, Math.PI / 2, 0), { cast: false });
    BATCH.add(groundGeo(46), MATS.aoStrip, GEOM.mat4(371.2, 0.07, z, -Math.PI / 2, 0, 0), { cast: false });
    BATCH.add(groundGeo(46), MATS.aoStrip, GEOM.mat4(-371.2, 0.07, z, -Math.PI / 2, 0, 0), { cast: false });
  }
  for (let x = -330; x <= 330; x += 46) {
    if (Math.abs(x) < 90) continue;
    BATCH.add(wallGeo(46), MATS.aoStrip, GEOM.mat4(x, 1.35, -472.5, 0, 0, 0), { cast: false });
    BATCH.add(wallGeo(46), MATS.aoStrip, GEOM.mat4(x, 1.35, 472.5, 0, Math.PI, 0), { cast: false });
  }
};

/* =============================================================
 *  铜缸（太平缸）：御道两侧与内廷陈设
 * ============================================================= */
LAYOUT.vats = function () {
  const spots = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) spots.push([sx * 13.8, 172 + i * 46]);
  }
  for (const sx of [-1, 1]) {
    spots.push([sx * 20, -120]);
    spots.push([sx * 26, -205]);
  }
  const bronzeMat = DETAIL.bronzeMat();
  const body = new THREE.CylinderGeometry(0.5, 0.42, 0.82, 12);
  for (let i = 0; i < spots.length; i++) {
    const x = spots[i][0], z = spots[i][1];
    BATCH.add(body, bronzeMat, GEOM.mat4(x, 0.41, z));
    BATCH.add(new THREE.TorusGeometry(0.5, 0.055, 6, 14), bronzeMat,
      GEOM.mat4(x, 0.82, z, Math.PI / 2, 0, 0));
    BATCH.add(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 8), bronzeMat,
      GEOM.mat4(x, 0.06, z));
    /* 双耳 */
    for (const s2 of [-1, 1]) {
      BATCH.add(new THREE.TorusGeometry(0.16, 0.045, 5, 10), bronzeMat,
        GEOM.mat4(x + s2 * 0.42, 0.92, z, 0, 0, Math.PI / 2));
    }
  }
};

/* =============================================================
 *  螭首（三台与月台边缘的排水兽首，汉白玉，合批）
 * ============================================================= */
LAYOUT.spouts = function () {
  const piece = (function () {
    const parts = [];
    const b = new THREE.BoxGeometry(0.34, 0.34, 0.8);
    b.translate(0, 0, 0.1);
    parts.push(b);
    const sn = new THREE.CylinderGeometry(0.16, 0.1, 0.5, 6);
    sn.rotateX(Math.PI / 2);
    sn.translate(0, 0, -0.45);
    parts.push(sn);
    return GEOM.merge(parts);
  })();
  /* 三台东西边缘 */
  for (const sx of [-1, 1]) {
    for (let z = -74; z <= 104; z += 13) {
      BATCH.add(piece, MATS.marble, GEOM.mat4(sx * 60.7, 8.0, z, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 1.3, 1.3, 1.3));
    }
  }
  /* 月台东西边缘 */
  for (const sx of [-1, 1]) {
    for (let z = 82; z <= 108; z += 9) {
      BATCH.add(piece, MATS.marble, GEOM.mat4(sx * 50.7, 9.5, z, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 1.3, 1.3, 1.3));
    }
  }
};

/* =============================================================
 *  精细陈设：18 座铜鼎 + 铜龟铜鹤
 * ============================================================= */
LAYOUT.detailProps = function () {
  const y = 9.63;
  /* 18 鼎：两侧各五、前沿六、后侧二 */
  const dingPos = [];
  for (let i = 0; i < 5; i++) {
    dingPos.push([-43, 84 + i * 5], [43, 84 + i * 5]);
  }
  for (let i = 0; i < 3; i++) {
    dingPos.push([-32 - i * 10, 108], [32 + i * 10, 108]);
  }
  dingPos.push([-43, 79], [43, 79]);
  for (let i = 0; i < dingPos.length; i++) {
    const d = DETAIL.censer({ scale: 1.0, rot: (dingPos[i][0] > 0 ? Math.PI : 0) + 0.2 });
    d.position.set(dingPos[i][0], y, dingPos[i][1]);
    BUILD.parent.add(d);
  }
  /* 铜龟 · 铜鹤 */
  const sets = [
    { fn: DETAIL.turtle, x: -26, z: 96 },
    { fn: DETAIL.turtle, x: 26, z: 96 },
    { fn: DETAIL.crane, x: -26, z: 90 },
    { fn: DETAIL.crane, x: 26, z: 90 }
  ];
  for (let i = 0; i < sets.length; i++) {
    const obj = sets[i].fn({});
    obj.position.set(sets[i].x, y, sets[i].z);
    BUILD.parent.add(obj);
  }
};

/* =============================================================
 *  宫墙外树带 + 宫内补树（增强城市绿量与大气透视）
 * ============================================================= */
LAYOUT.treeBelts = function () {
  /* 护城河外行道树 */
  for (let x = -380; x <= 380; x += 20) {
    BUILD.begin(x + (TEX.rand() - 0.5) * 8, -624 - TEX.rand() * 42, 0);
    BUILD.tree({ h: 10 + TEX.rand() * 8 });
    BUILD.end();
  }
  for (let x = -380; x <= 380; x += 24) {
    if (Math.abs(x) < 90) continue;
    BUILD.begin(x + (TEX.rand() - 0.5) * 8, 622 + TEX.rand() * 40, 0);
    BUILD.tree({ h: 10 + TEX.rand() * 8 });
    BUILD.end();
  }
  for (let z = -560; z <= 560; z += 20) {
    for (const sx of [-1, 1]) {
      BUILD.begin(sx * (482 + TEX.rand() * 46), z + (TEX.rand() - 0.5) * 8, 0);
      BUILD.tree({ h: 10 + TEX.rand() * 8 });
      BUILD.end();
    }
  }
  /* 宫内树群：廊庑后侧与墙角 */
  for (let z = 120; z >= -80; z -= 22) {
    for (const sx of [-1, 1]) {
      BUILD.begin(sx * (124 + TEX.rand() * 14), z + TEX.rand() * 10, 0);
      BUILD.tree({ h: 8 + TEX.rand() * 6 });
      BUILD.end();
    }
  }
  for (let z = 272; z >= 126; z -= 24) {
    for (const sx of [-1, 1]) {
      BUILD.begin(sx * (132 + TEX.rand() * 16), z, 0);
      BUILD.tree({ h: 8 + TEX.rand() * 6 });
      BUILD.end();
    }
  }
  const cornerGroups = [[-300, -420], [300, -420], [-300, 400], [300, 400], [-300, 60], [300, 60]];
  for (let g = 0; g < cornerGroups.length; g++) {
    for (let k = 0; k < 6; k++) {
      BUILD.begin(cornerGroups[g][0] + (TEX.rand() - 0.5) * 60, cornerGroups[g][1] + (TEX.rand() - 0.5) * 60, 0);
      BUILD.tree({ h: 8 + TEX.rand() * 6 });
      BUILD.end();
    }
  }
};

/* =============================================================
 *  月台陈设：日晷 / 嘉量
 * ============================================================= */
LAYOUT.propsExtra = function () {
  const y = 8.13 + 1.5;
  for (const sx of [-1, 1]) {
    BUILD.begin(sx * 34, 98, 0);
    /* 石座 */
    GEOM.box(2.6, 1.0, 2.6, MATS.marbleRail, 0, y + 0.5, 0);
    GEOM.box(2.2, 0.4, 2.2, MATS.marbleRail, 0, y + 1.2, 0);
    if (sx > 0) {
      /* 日晷：斜置石盘 */
      BATCH.add(new THREE.CylinderGeometry(1.45, 1.45, 0.22, 20), MATS.marbleRail,
        GEOM.mat4(0, y + 2.35, 0, 0.95, 0, 0.5));
      BATCH.add(new THREE.ConeGeometry(0.09, 2.2, 6), MATS.bronze,
        GEOM.mat4(0, y + 2.35, 0, 1.35, 0, 0.5));
    } else {
      /* 嘉量：石亭式座 */
      GEOM.box(1.6, 0.3, 1.6, MATS.marbleRail, 0, y + 1.55, 0);
      BATCH.add(new THREE.CylinderGeometry(0.62, 0.5, 0.95, 12), MATS.bronze,
        GEOM.mat4(0, y + 2.15, 0));
      BATCH.add(new THREE.CylinderGeometry(0.7, 0.7, 0.16, 12), MATS.bronze,
        GEOM.mat4(0, y + 2.7, 0));
    }
    BUILD.end();
  }
};

/* =============================================================
 *  总装
 * ============================================================= */
/* 补种树木 + 落叶堆：沿墙、院落、花园外缘，全部走 BATCH 合并 */
LAYOUT.extraTrees = function () {
  const rnd = TEX.rand;
  const spots = [];
  /* 避开已有建筑/台基碰撞盒 */
  const blocked = function (x, z, m) {
    m = m == null ? 2.6 : m;
    const cs = (typeof BUILD !== 'undefined' && BUILD.colliders) ? BUILD.colliders : [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m) return true;
    }
    return false;
  };
  const push = function (x, z) { if (!blocked(x, z)) spots.push({ x: x, z: z }); };
  /* 外墙内侧 */
  for (const sx of [-1, 1]) {
    for (const z of [-430, -350, -270, 180, 260, 340, 430]) push(sx * 352, z);
  }
  for (const x of [-300, -200, -100, 100, 200, 300]) {
    push(x, 432);
    push(x, -438);
  }
  /* 东六宫 / 西六宫院落空隙 */
  for (const sx of [-1, 1]) {
    for (const z of [-70, -130, -190, -250, -310]) push(sx * (118 + rnd() * 40), z);
  }
  /* 文华殿 / 武英殿前 */
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) push(sx * (205 + rnd() * 35), 225 + k * 22);
  }
  /* 御花园外缘 */
  for (const sx of [-1, 1]) {
    for (const z of [-300, -330, -365, -395]) push(sx * (86 + rnd() * 18), z);
  }
  /* 慈宁宫 / 寿康宫一带 */
  for (const z of [-380, -410, -440]) { push(-205, z); push(205, z); }

  const leafGeosA = [], leafGeosB = [];
  for (let i = 0; i < spots.length; i++) {
    const sp = spots[i];
    BUILD.begin(sp.x, sp.z, rnd() * Math.PI * 2);
    BUILD.tree({ h: 8 + rnd() * 6 });
    BUILD.end();
    /* 树下落叶堆（扁平小面片，合并绘制） */
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const g = new THREE.CircleGeometry(0.8 + rnd() * 1.5, 7);
      g.rotateX(-Math.PI / 2);
      g.translate(sp.x + (rnd() - 0.5) * 5, 0.045 + k * 0.004, sp.z + (rnd() - 0.5) * 5);
      (rnd() < 0.55 ? leafGeosA : leafGeosB).push(g);
    }
  }
  if (leafGeosA.length) {
    const m = new THREE.Mesh(GEOM.merge(leafGeosA), MATS.fallenLeaf || MATS.leafDark);
    m.receiveShadow = true;
    BUILD.parent.add(m);
  }
  if (leafGeosB.length) {
    const m = new THREE.Mesh(GEOM.merge(leafGeosB), MATS.fallenLeaf2 || MATS.leafLight);
    m.receiveShadow = true;
    BUILD.parent.add(m);
  }
};

LAYOUT.build = function (root) {
  BUILD.init(root);

  /* 宫外大地：与宫内金砖区分，突出宫城轮廓 */
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(3800, 3800), MATS.grass);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.18;
  outer.receiveShadow = true;
  root.add(outer);
  /* 宫内金砖地面（753 × 961 m） */
  const innerMat = new THREE.MeshStandardMaterial({
    map: MATS.paving.map.clone(), color: 0xe4e2da, roughness: 0.9
  });
  innerMat.map.repeat.set(59, 75);
  innerMat.map.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(753, 961), innerMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -0.5);
  ground.receiveShadow = true;
  root.add(ground);

  LAYOUT.terrace(root);
  LAYOUT.river(root);
  LAYOUT.taiheHall();
  INTERIOR.taihe(root);
  LAYOUT.middleHalls();
  LAYOUT.taiheGate();
  LAYOUT.meridianGate();
  LAYOUT.shenwuGate();
  LAYOUT.cityWalls();
  LAYOUT.corridors();
  LAYOUT.innerCourt();
  LAYOUT.pathsAndProps();
  LAYOUT.detailProps();
  LAYOUT.vats();
  LAYOUT.spouts();
  LAYOUT.sidePalaces();
  LAYOUT.garden();
  GARDEN.buildAll();
  GARDEN.wenhuaWuying();
  GARDEN.cining();
  LAYOUT.northStreet();
  LAYOUT.weathering();
  LAYOUT.aoBands();
  LAYOUT.treeBelts();
  LAYOUT.extraTrees();
  LAYOUT.wear();
  LAYOUT.debris();
  LAYOUT.propsExtra();
  LAYOUT.moat();

  BATCH.flush(root);
  INTERIOR.buildAll(root);
};
