/* =============================================================
 *  紫禁城 · 数字复原  —  御花园与东西路院落
 *  依据 REFERENCE_MORE.md：钦安殿 / 天一门 / 万春亭 / 千秋亭 /
 *  浮碧亭 / 澄瑞亭 / 堆秀山 + 御景亭；文华殿与武英殿院落
 * ============================================================= */
const GARDEN = {};

GARDEN.buildAll = function () {
  /* ---------------- 天一门 ---------------- */
  BUILD.begin(0, -286, 0);
  BUILD.gateSimple({ w: 10, d: 5, h: 5 });
  BUILD.end();

  /* ---------------- 钦安殿（重檐盝顶近似） ---------------- */
  BUILD.begin(0, -310, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.4, podiumPad: 6, rail: true,
    bodyW: 22, bodyD: 14, bodyH: 7.0, bays: 5,
    facadeMat: MATS.facade5,
    layers: 2,
    eave1: [15.8, 10.4], inner1: [10.8, 7.0], rise1: 2.8,
    upperH: 2.4, eave2: [12.6, 8.2], ridgeHalf: 8.2, rise2: 2.6,
    plaque: '钦安殿', beasts1: 4, beasts2: 4, tile: 1.8
  });
  BUILD.end();

  /* ---------------- 万春亭 · 千秋亭（十字抱厦 · 上圆下方） ---------------- */
  for (const sx of [-1, 1]) {
    BUILD.begin(sx * 34, -338, 0);
    /* 中心方亭身 */
    GEOM.box(8, 4.4, 8, MATS.wall, 0, 2.2 + 0.6, 0);
    /* 四面抱厦 */
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const bx = Math.sin(a), bz = Math.cos(a);
      GEOM.box(3.8, 3.2, 2.6, MATS.wall, bx * 5.2, 2.2, bz * 5.2, a);
    }
    GEOM.band({ w: 12.4, d: 12.4, h: 0.5, y: 5.0, tileU: 1.4 });
    BUILD.gazebo({
      baseY: 0, podiumH: 0.6, size: 8, h: 4.4, conical: true, cross: true
    });
    BUILD.end();
  }

  /* ---------------- 浮碧亭 · 澄瑞亭（跨池石桥） ---------------- */
  for (const sx of [-1, 1]) {
    BUILD.begin(sx * 54, -300, 0);
    /* 水池 */
    GEOM.box(30, 0.28, 16, MATS.water, 0, 0.14, 0);
    /* 池岸 */
    GEOM.box(34, 0.72, 2.0, MATS.marbleRail, 0, 0.36, 9.0);
    GEOM.box(34, 0.72, 2.0, MATS.marbleRail, 0, 0.36, -9.0);
    GEOM.box(2.0, 0.72, 16.0, MATS.marbleRail, 16.0, 0.36, 0);
    GEOM.box(2.0, 0.72, 16.0, MATS.marbleRail, -16.0, 0.36, 0);
    /* 池岸望柱 */
    for (let i = -2; i <= 2; i++) {
      GEOM.box(0.28, 1.0, 0.28, MATS.marbleRail, i * 6.5, 0.5, 9.6);
      GEOM.box(0.28, 1.0, 0.28, MATS.marbleRail, i * 6.5, 0.5, -9.6);
    }
    /* 石桥 */
    GEOM.box(9.0, 0.8, 18.0, MATS.marbleRail, 0, 0.5, 0);
    GEOM.box(9.6, 0.2, 18.6, MATS.path, 0, 0.94, 0);
    BUILD.addCollider(0, 0, 17.0, 9.6);
    BUILD.end();

    /* 亭（置于桥上） */
    BUILD.begin(sx * 54, -300, 0);
    BUILD.gazebo({ baseY: 1.0, podiumH: 0.12, size: 7, h: 3.6, cross: true, rise: 2.8 });
    BUILD.end();
  }

  /* ---------------- 堆秀山 + 御景亭 ---------------- */
  /* ---------------- 石桌石凳（御花园休憩陈设） ---------------- */
  GARDEN.stoneTable = function (x, z) {
    BUILD.begin(x, z, 0);
    BATCH.add(new THREE.CylinderGeometry(1.25, 1.25, 0.16, 16), MATS.marbleRail, GEOM.mat4(0, 0.86, 0));
    BATCH.add(new THREE.CylinderGeometry(0.34, 0.5, 0.78, 10), MATS.marbleRail, GEOM.mat4(0, 0.39, 0));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      BATCH.add(new THREE.CylinderGeometry(0.38, 0.42, 0.46, 10), MATS.marbleRail,
        GEOM.mat4(Math.cos(a) * 2.15, 0.23, Math.sin(a) * 2.15));
    }
    BUILD.addCollider(0, 0, 2.4, 2.4);
    BUILD.end();
  };
  GARDEN.stoneTable(26, -372);
  GARDEN.stoneTable(-26, -372);

  BUILD.begin(64, -352, 0);
  BUILD.rockery({ w: 16, d: 12, h: 9, rocks: 20 });
  BUILD.end();
  BUILD.begin(64, -352, 0);
  BUILD.gazebo({ baseY: 8.55, podiumH: 0.12, size: 5, h: 2.6, rise: 2.4 });
  BUILD.end();
};

/* 文华殿（东）/ 武英殿（西）院落：门—正殿—穿廊—后殿 */
/* 慈宁宫院落：慈宁门 → 慈宁宫（重檐）→ 大佛堂 */
GARDEN.cining = function () {
  BUILD.begin(-226, -146, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.0, podiumPad: 4, rail: true,
    bodyW: 26, bodyD: 10, bodyH: 6.2, bays: 5,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'gable', gd: 6.4, gableBase: 0.2,
    eave1: [16.2, 8.2], ridgeHalf: 14.0, rise1: 3.4,
    plaque: '慈宁门', tile: 1.7, beasts1: 3
  });
  BUILD.end();

  BUILD.begin(-226, -186, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.6, podiumPad: 6, rail: true,
    bodyW: 40, bodyD: 16, bodyH: 8.0, bays: 7,
    facadeMat: MATS.facade5,
    layers: 2,
    eave1: [25.2, 12.2], inner1: [15.4, 9.0], rise1: 3.4,
    upperH: 3.0, eave2: [19.8, 10.0], ridgeHalf: 15.0, rise2: 3.6,
    plaque: '慈宁宫', tile: 1.9, beasts1: 5, beasts2: 5
  });
  BUILD.end();

  BUILD.begin(-226, -216, 0);
  BUILD.hall({
    baseY: 0, podiumH: 1.2, podiumPad: 5, rail: true,
    bodyW: 26, bodyD: 12, bodyH: 6.4, bays: 5,
    facadeMat: MATS.facade5,
    layers: 1, facets: 'gable', gd: 7.0, gableBase: 0.2,
    eave1: [16.6, 8.8], ridgeHalf: 13.6, rise1: 3.6,
    plaque: '大佛堂', tile: 1.7, beasts1: 3
  });
  BUILD.end();

  /* 院落东西围墙 */
  for (const sx of [-1, 1]) {
    BUILD.wallRun({ x1: -226 + sx * 30, z1: -140, x2: -226 + sx * 30, z2: -222, h: 4.6, w: 2.0, merlons: false, innerWall: false });
  }
};

GARDEN.wenhuaWuying = function () {
  for (const sx of [-1, 1]) {
    /* 院门 */
    BUILD.begin(sx * 166, 262, 0);
    BUILD.hall({
      baseY: 0, podiumH: 1.0, podiumPad: 4, rail: true,
      bodyW: 26, bodyD: 10, bodyH: 6.2, bays: 5,
      facadeMat: MATS.facade5,
      layers: 1, facets: 'gable', gd: 6.4, gableBase: 0.2,
      eave1: [16.4, 8.2], ridgeHalf: 14.2, rise1: 3.4,
      plaque: sx > 0 ? '文华门' : '武英门', beasts1: 3, tile: 1.7
    });
    BUILD.end();

    /* 正殿 */
    BUILD.begin(sx * 166, 224, 0);
    BUILD.hall({
      baseY: 0, podiumH: 1.5, podiumPad: 6, rail: true,
      bodyW: 33, bodyD: 13, bodyH: 7.4, bays: 5,
      facadeMat: MATS.facade5,
      layers: 1, facets: 'gable', gd: 8.0, gableBase: 0.2,
      eave1: [20.2, 10.2], ridgeHalf: 17.4, rise1: 4.2,
      plaque: sx > 0 ? '文华殿' : '武英殿', beasts1: 5, tile: 1.9
    });
    BUILD.end();

    /* 穿廊 */
    BUILD.begin(sx * 166, 208, 0);
    GEOM.box(8, 4.2, 6, MATS.wall, 0, 2.1, 0);
    GEOM.roofTier({
      group: BUILD.group, AW: 7.2, AD: 4.8, aw: 2.0, ad: 0.01,
      y0: 4.4, y1: 6.2, ridgeTop: true, ridgeH: 0.4, ridgeW: 0.4,
      ridgeR: 0.14, beasts: 0, tile: 1.3
    });
    BUILD.addCollider(0, 0, 4.6, 3.6);
    BUILD.end();

    /* 后殿 */
    BUILD.begin(sx * 166, 196, 0);
    BUILD.hall({
      baseY: 0, podiumH: 1.2, podiumPad: 5, rail: true,
      bodyW: 24, bodyD: 11, bodyH: 6.6, bays: 5,
      facadeMat: MATS.facade5,
      layers: 1, facets: 'gable', gd: 6.2, gableBase: 0.2,
      eave1: [15.2, 8.6], ridgeHalf: 12.6, rise1: 3.6,
      plaque: sx > 0 ? '主敬殿' : '敬思殿', beasts1: 3, tile: 1.7
    });
    BUILD.end();

    /* 文渊阁（东）/ 浴德堂（西） */
    if (sx > 0) {
      BUILD.begin(166, 172, 0);
      BUILD.hall({
        baseY: 0, podiumH: 1.2, podiumPad: 5, rail: true,
        bodyW: 34, bodyD: 14, bodyH: 8.2, bays: 6,
        facadeMat: MATS.facade5,
        layers: 2,
        eave1: [21.6, 10.6], inner1: [12.6, 7.4], rise1: 3.2,
        upperH: 2.8, eave2: [17.4, 8.9], ridgeHalf: 13.0, rise2: 3.4,
        plaque: '文渊阁', tile: 1.9, roofMat: MATS.roofBlack,
        beasts1: 4, beasts2: 4
      });
      BUILD.end();
    } else {
      BUILD.begin(-166, 172, 0);
      BUILD.hall({
        baseY: 0, podiumH: 1.0, podiumPad: 5, rail: false,
        bodyW: 22, bodyD: 11, bodyH: 5.6, bays: 4,
        facadeMat: MATS.facade5,
        layers: 1, facets: 'gable', gd: 6.0, gableBase: 0.2,
        eave1: [14.6, 8.2], ridgeHalf: 11.2, rise1: 3.0,
        plaque: '浴德堂', tile: 1.6, beasts1: 3
      });
      BUILD.end();
    }

    /* 东西配殿 */
    for (const s2 of [-1, 1]) {
      BUILD.begin(sx * 166 + s2 * 30, 224, s2 * Math.PI / 2);
      BUILD.hall({
        baseY: 0, podiumH: 0.8, podiumPad: 4, rail: false,
        bodyW: 16, bodyD: 8, bodyH: 4.8, bays: 3, batch: true,
        noColumns: true, noFacade: false,
        layers: 1, eave1: [10.4, 6.2], ridgeHalf: 7.0, rise1: 2.8,
        tile: 1.5, beasts1: 2
      });
      BUILD.end();
    }
  }
};
