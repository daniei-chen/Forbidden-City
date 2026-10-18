/* =============================================================
 *  紫禁城 · 数字复原  —  建筑生成
 *  所有建筑在"局部坐标"中构建，再经组变换放到总平面上；
 *  静态构件统一进 BATCH 合批，纹理面片 / 屋顶等作为独立 mesh。
 * ============================================================= */
const BUILD = { parent: null, group: null, _stack: [], colliders: [] };

BUILD.init = function (parent) {
  BUILD.parent = parent;
  BUILD._stack = [];
  BUILD.group = null;
  BUILD.colliders = [];
};

/* 记录局部矩形（可旋转）到世界 AABB，供漫游碰撞使用 */
BUILD.addCollider = function (lx, lz, hw, hd) {
  const st = BUILD._stack;
  const m = st.length ? st[st.length - 1].m : null;
  const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < 4; i++) {
    let x = lx + pts[i][0], z = lz + pts[i][1];
    if (m) {
      const v = new THREE.Vector3(x, 0, z).applyMatrix4(m);
      x = v.x; z = v.z;
    }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  BUILD.colliders.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ });
};

/* 局部矩形（可旋转）→ 世界 AABB */
BUILD.addColliderRect = function (x1, z1, x2, z2) {
  const st = BUILD._stack;
  const m = st.length ? st[st.length - 1].m : null;
  const pts = [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < 4; i++) {
    let x = pts[i][0], z = pts[i][1];
    if (m) {
      const v = new THREE.Vector3(x, 0, z).applyMatrix4(m);
      x = v.x; z = v.z;
    }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  BUILD.colliders.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ });
};

/* 殿身碰撞环：四周墙体留出正面门洞（可步行入殿） */
BUILD.addRingCollider = function (lx, lz, hw, hd, gapW) {
  const t = 0.8;
  const g = (gapW || 0) / 2;
  if (g > 0.3) {
    BUILD.addColliderRect(lx - hw, lz + hd - t, lx - g, lz + hd + t);
    BUILD.addColliderRect(lx + g, lz + hd - t, lx + hw, lz + hd + t);
  } else {
    BUILD.addColliderRect(lx - hw, lz + hd - t, lx + hw, lz + hd + t);
  }
  BUILD.addColliderRect(lx - hw, lz - hd - t, lx + hw, lz - hd + t);
  BUILD.addColliderRect(lx - hw - t, lz - hd, lx - hw + t, lz + hd);
  BUILD.addColliderRect(lx + hw - t, lz - hd, lx + hw + t, lz + hd);
};

/* 地面 AO 接触阴影贴片 */
BUILD.addAO = function (lx, lz, w, d, y) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  BATCH.add(g, MATS.aoDecal, GEOM.mat4(lx, y, lz), { cast: false });
  g.dispose();
};

BUILD.begin = function (x, z, ry) {
  const st = BUILD._stack;
  const parentGroup = st.length ? st[st.length - 1].g : BUILD.parent;
  const g = new THREE.Group();
  g.position.set(x || 0, 0, z || 0);
  g.rotation.y = ry || 0;
  g.updateMatrix();
  parentGroup.add(g);
  const world = st.length ? st[st.length - 1].m.clone().multiply(g.matrix) : g.matrix.clone();
  st.push({ g: g, m: world });
  BUILD.group = g;
  BATCH.xform = world;
  return g;
};

BUILD.end = function () {
  BUILD._stack.pop();
  const st = BUILD._stack;
  const top = st.length ? st[st.length - 1] : null;
  BUILD.group = top ? top.g : null;
  BATCH.xform = top ? top.m : null;
};

BUILD.mesh = function (geo, mat, x, y, z, ry) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  (BUILD.group || BUILD.parent).add(m);
  return m;
};

/* 复用几何 */
BUILD.colGeo = function () {
  if (!BUILD._col) {
    BUILD._col = new THREE.CylinderGeometry(0.68, 0.74, 1, 12);
  }
  return BUILD._col;
};
BUILD.baseGeo = function () {
  if (!BUILD._base) BUILD._base = new THREE.CylinderGeometry(0.86, 0.92, 0.36, 12);
  return BUILD._base;
};

/* 券门（拱形门洞面片） */
BUILD.archGeo = function (w, h, seg) {
  const s = new THREE.Shape();
  const r = w / 2;
  const straight = Math.max(0.2, h - r);
  s.moveTo(-r, 0);
  s.lineTo(-r, straight);
  s.absarc(0, straight, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, seg || 10);
  return g;
};

/* -------------------------------------------------------------
 *  殿 / 楼（重檐庑殿、单檐庑殿、攒尖）
 *  o.layers: 1|2     o.facets: 'hip' | 'pyramid'
 * ----------------------------------------------------------- */
BUILD.hall = function (o) {
  const g = BUILD.group || BUILD.parent;
  const base = o.baseY || 0;
  const bw = o.bodyW, bd = o.bodyD, bh = o.bodyH;
  const bandH = o.bandH == null ? 0.85 : o.bandH;
  const wallMat = o.wallMat || MATS.wall;
  const layers = o.layers == null ? 1 : o.layers;
  const facMat = o.facadeMat || MATS.facade9;
  const BATCHED = !!o.batch;

  const addPlane = function (geo, mat, x, y, z, ry) {
    if (BATCHED) {
      BATCH.add(geo, mat, GEOM.mat4(x, y, z, 0, ry || 0, 0));
      geo.dispose();
    } else {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = false;
      m.receiveShadow = true;
      g.add(m);
    }
  };

  /* 台基 */
  if (o.podiumH) {
    const pad = o.podiumPad == null ? 4.5 : o.podiumPad;
    GEOM.podium({
      x: 0, z: 0, y: base, w: bw + pad, d: bd + pad, h: o.podiumH,
      rail: o.rail !== false, spacing: o.railSpacing || 2.8, holes: o.podiumHoles
    });
  }
  const y0 = base + (o.podiumH || 0);

  /* 碰撞 + 地面 AO */
  const pad = o.podiumPad == null ? 4.5 : o.podiumPad;
  if (o.enterable) {
    BUILD.addRingCollider(0, 0, (bw + pad) / 2, (bd + pad) / 2, o.doorW || 6.5);
  } else {
    BUILD.addCollider(0, 0, (bw + pad) / 2, (bd + pad) / 2);
  }
  BUILD.addAO(0, 0, bw + pad + 9, bd + pad + 9, base + 0.035);

  /* 殿身 */
  GEOM.box(bw, bh, bd, wallMat, 0, y0 + bh / 2, 0);

  /* 立面 */
  if (!o.noFacade) {
    const fh = Math.min(bh * 0.76, o.facadeH || 6.4);
    addPlane(new THREE.PlaneGeometry(bw - 1.2, fh), facMat, 0, y0 + fh / 2 + 0.35, bd / 2 + 0.05, 0);
    addPlane(new THREE.PlaneGeometry(bw - 1.2, fh), facMat, 0, y0 + fh / 2 + 0.35, -bd / 2 - 0.05, Math.PI);
  }

  /* 柱列 */
  if (!o.noColumns) {
    const bays = o.bays || 9;
    const nCol = bays + 1;
    const span = bw - 2.0;
    const colGeo = BUILD.colGeo(), baseGeo = BUILD.baseGeo();
    const colZ = bd / 2 + 0.55;
    for (let i = 0; i < nCol; i++) {
      const cx = -span / 2 + (span * i) / (nCol - 1);
      for (let s = -1; s <= 1; s += 2) {
        BATCH.add(colGeo, MATS.column, GEOM.mat4(cx, y0 + bh / 2, s * colZ, 0, 0, 0, 1, bh, 1));
        BATCH.add(baseGeo, MATS.marbleRail, GEOM.mat4(cx, y0 + 0.18, s * colZ));
      }
    }
    const sides = o.sideBays || 3;
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < sides; k++) {
        const cz = -bd / 2 + (bd * (k + 1)) / (sides + 1);
        BATCH.add(colGeo, MATS.column, GEOM.mat4(s * (bw / 2 + 0.55), y0 + bh / 2, cz, 0, 0, 0, 1, bh, 1));
        BATCH.add(baseGeo, MATS.marbleRail, GEOM.mat4(s * (bw / 2 + 0.55), y0 + 0.18, cz));
      }
    }
  }

  /* Hero 高精细节：窗框、雀替、门扇（仅主要殿宇开启） */
  if (o.hero && !o.noFacade) {
    const hf = Math.min(bh * 0.76, o.facadeH || 6.4);
    const bays = o.bays || 9;
    const span = bw - 2.0;
    const bayW = span / bays;
    const goldGeos = [];
    const doorGeos = [];
    const studGeos = [];
    const zF = bd / 2 + 0.12;
    const yBase = y0 + 0.5;
    /* 每间竖框 */
    for (let j = 0; j <= bays; j++) {
      const cx = -span / 2 + bayW * j;
      for (const s of [-1, 1]) {
        const bar = new THREE.BoxGeometry(0.16, hf * 0.9, 0.14);
        bar.translate(cx, yBase + hf * 0.46, s * zF);
        goldGeos.push(bar);
      }
    }
    /* 上下槛 */
    for (const s of [-1, 1]) {
      const top = new THREE.BoxGeometry(span + 0.3, 0.18, 0.16);
      top.translate(0, yBase + hf * 0.9, s * zF);
      goldGeos.push(top);
      const sill = new THREE.BoxGeometry(span + 0.3, 0.22, 0.16);
      sill.translate(0, yBase + 0.12, s * zF);
      goldGeos.push(sill);
    }
    /* 明间门扇（可入殿的殿堂保持门洞，不做遮挡） */
    if (!o.enterable) {
      for (const s of [-1, 1]) {
        for (const sd of [-1, 1]) {
          const leaf = new THREE.BoxGeometry(bayW * 0.44, hf * 0.72, 0.1);
          leaf.translate(sd * bayW * 0.24, yBase + hf * 0.4, s * (zF + 0.04));
          doorGeos.push(leaf);
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
              const stud = new THREE.SphereGeometry(0.055, 6, 5);
              stud.translate(sd * bayW * 0.24 + (c - 1) * 0.32, yBase + hf * 0.26 + r * 0.42, s * (zF + 0.1));
              studGeos.push(stud);
            }
          }
        }
      }
    }
    /* 雀替（柱头两侧） */
    const nCol = bays + 1;
    for (let i = 0; i < nCol; i++) {
      const cx = -span / 2 + (span * i) / (nCol - 1);
      for (const s of [-1, 1]) {
        for (const sd of [-1, 1]) {
          const bracket = new THREE.BoxGeometry(0.55, 0.28, 0.34);
          bracket.translate(cx + sd * 0.42, y0 + bh - 1.15, s * (bd / 2 + 0.35));
          goldGeos.push(bracket);
        }
      }
    }
    /* 窗棂 3D：每间做 5 竖 + 4 横细棂条，增强近景窗格层次 */
    const latticeGeos = [];
    const winW = bayW - 0.7;
    const winH = hf * 0.55;
    const wy = yBase + hf * 0.44;
    const nv = 5, nh = 4;
    for (let bi = 0; bi < bays; bi++) {
      const cx = -span / 2 + bayW * (bi + 0.5);
      for (const s of [-1, 1]) {
        const zz = s * (zF + 0.035);
        for (let iv = 0; iv < nv; iv++) {
          const gbar = new THREE.BoxGeometry(0.045, winH, 0.045);
          gbar.translate(cx - winW / 2 + (winW * iv) / (nv - 1), wy, zz);
          latticeGeos.push(gbar);
        }
        for (let ih = 0; ih < nh; ih++) {
          const gbar = new THREE.BoxGeometry(winW, 0.045, 0.045);
          gbar.translate(cx, wy - winH / 2 + (winH * ih) / (nh - 1), zz);
          latticeGeos.push(gbar);
        }
      }
    }
    const addMerged = function (geos, mat) {
      if (!geos.length) return;
      const mesh = new THREE.Mesh(GEOM.merge(geos), mat);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    addMerged(latticeGeos, MATS.mullion);
    addMerged(goldGeos, MATS.goldDark);
    addMerged(doorGeos, MATS.column);
    addMerged(studGeos, MATS.goldDark);
  }

  /* 额枋彩画带 */
  if (o.caihua !== false) {
    const ch = Math.min(1.35, bh * 0.15);
    GEOM.band({ w: bw + 0.75, d: bd + 0.75, h: ch, y: y0 + bh - ch, tileU: 4.4, mat: MATS.caihua });
  }
  /* 斗拱彩画带 */
  GEOM.band({ w: bw + 1.1, d: bd + 1.1, h: bandH, y: y0 + bh, tileU: o.tileU || 2.0 });

  /* 匾额 */
  if (o.plaque) {
    GEOM.plaqueAt(o.plaque, 0, y0 + bh - 1.55, bd / 2 + 0.42, 0, o.plaqueW || 4.4);
  }

  /* 斗拱（近景真实构件） */
  if (!BATCHED && o.dougong !== false) {
    DETAIL.addDougong(g, {
      bw: bw, bd: bd, y: y0 + bh + bandH - 0.32,
      bays: o.bays || 9, scale: o.dgScale || 0.95
    });
  }

  /* 简易室内（侧宫院等合批建筑，外部不可见） */
  if (BATCHED && o.interior !== false) {
    BUILD.addSimpleInterior(y0, bw, bd, bh);
  }

  /* 檐口瓦当 */
  if (!BATCHED && o.wadang !== false) {
    const ww = o.eave1 ? o.eave1[0] : bw / 2 + 3.2;
    const dd = o.eave1 ? o.eave1[1] : bd / 2 + 2.6;
    const yy = (y0 + bh + bandH) - 0.06;
    DETAIL.addEaveTiles(g, { w: ww, d: dd, y: yy, spacing: 0.68, scale: 1.0 });
  }
  /* 檐下椽头 */
  if (!BATCHED && o.rafters !== false) {
    const rw = o.eave1 ? o.eave1[0] : bw / 2 + 3.2;
    const rd = o.eave1 ? o.eave1[1] : bd / 2 + 2.6;
    const ry = (y0 + bh + bandH) - 0.62;
    DETAIL.addRafters(g, { w: rw, d: rd, y: ry, spacing: 0.58, scale: 1.0, inset: 0.6 });
  }

  /* 屋顶 */
  const e1w = o.eave1 ? o.eave1[0] : bw / 2 + 3.2;
  const e1d = o.eave1 ? o.eave1[1] : bd / 2 + 2.6;
  const i1w = o.inner1 ? o.inner1[0] : Math.max(bw / 2 + 0.5, e1w - 8.5);
  const i1d = o.inner1 ? o.inner1[1] : Math.max(bd / 2 + 0.5, e1d - 6.5);
  const yR0 = y0 + bh + bandH;
  const roofOpts = {
    group: g, tile: o.tile || 2.2, curl: o.curl, lift: o.lift,
    ridgeR: o.ridgeR || 0.27, sag: o.sag, batch: BATCHED,
    mat: o.roofMat || MATS.roof
  };

  if (layers === 2) {
    /* 下檐腰檐 */
    const y1 = yR0 + (o.rise1 || 4.4);
    GEOM.roofTier(Object.assign({}, roofOpts, {
      AW: e1w, AD: e1d, aw: i1w, ad: i1d, y0: yR0, y1: y1,
      soffit: [bw / 2 + 0.9, bd / 2 + 0.9],
      beasts1: null, beasts: o.beasts1 == null ? 4 : o.beasts1
    }));

    /* 上层墙身 */
    const uh = o.upperH || 4.0;
    GEOM.box(2 * i1w, uh, 2 * i1d, wallMat, 0, y1 + uh / 2, 0);
    /* 上层窗（正面三扇） */
    for (let k = -1; k <= 1; k++) {
      addPlane(new THREE.PlaneGeometry(i1w * 0.52, uh * 0.62), MATS.lattice,
        k * i1w * 0.62, y1 + uh * 0.52, i1d + 0.06, 0);
      addPlane(new THREE.PlaneGeometry(i1w * 0.52, uh * 0.62), MATS.lattice,
        k * i1w * 0.62, y1 + uh * 0.52, -i1d - 0.06, Math.PI);
    }
    /* 上层侧窗 */
    for (let s = -1; s <= 1; s += 2) {
      addPlane(new THREE.PlaneGeometry(i1d * 0.9, uh * 0.6), MATS.lattice,
        s * (i1w + 0.06), y1 + uh * 0.52, 0, s * Math.PI / 2);
    }
    /* 上层斗拱 */
    GEOM.band({ w: 2 * i1w + 0.9, d: 2 * i1d + 0.9, h: bandH * 0.9, y: y1 + uh, tileU: 1.9 });
    if (!BATCHED && o.dougong !== false) {
      DETAIL.addDougong(g, {
        bw: 2 * i1w, bd: 2 * i1d, y: y1 + uh + bandH * 0.9 - 0.3,
        bays: Math.round((o.bays || 9) * 0.85), scale: (o.dgScale || 0.95) * 0.82
      });
    }

    /* 上檐椽头 */
    if (o.rafters !== false) {
      DETAIL.addRafters(g, {
        w: o.eave2 ? o.eave2[0] : i1w + 2.7,
        d: o.eave2 ? o.eave2[1] : i1d + 2.2,
        y: y1 + uh + bandH * 0.9 - 0.58,
        spacing: 0.56, scale: 0.92, inset: 0.5
      });
    }

    /* 上檐檐口瓦当 */
    if (o.wadang !== false) {
      DETAIL.addEaveTiles(g, {
        w: o.eave2 ? o.eave2[0] : i1w + 2.7,
        d: o.eave2 ? o.eave2[1] : i1d + 2.2,
        y: y1 + uh + bandH * 0.9 - 0.06,
        spacing: 0.64, scale: 0.92
      });
    }

    /* 上檐屋顶：庑殿 / 歇山 */
    const e2w = o.eave2 ? o.eave2[0] : i1w + 2.7;
    const e2d = o.eave2 ? o.eave2[1] : i1d + 2.2;
    const ridgeHalf = o.ridgeHalf == null ? Math.max(e2w - 14, e2w * 0.72) : o.ridgeHalf;
    const y2 = y1 + uh + bandH * 0.9;
    if (BATCHED) {
      if (o.facets === 'gable') {
        GEOM.gableRoof({
          AW: e2w, AD: e2d, rh: ridgeHalf, y0: y2, y1: y2 + (o.rise2 || 5.4),
          gd: o.gd, gableBase: o.gableBase,
          tile: o.tile || 2.2, curl: o.curl, lift: o.lift,
          group: g, batch: true, ridgeR: o.ridgeR || 0.24,
          ridgeH: o.ridgeH, ridgeW: o.ridgeW, chowenScale: o.chowenScale,
          beasts: o.beasts2 == null ? 6 : o.beasts2
        });
      } else {
        GEOM.roofTier(Object.assign({}, roofOpts, {
          AW: e2w, AD: e2d, aw: ridgeHalf, ad: 0.01, y0: y2, y1: y2 + (o.rise2 || 5.4),
          ridgeTop: true, ridgeH: o.ridgeH || 0.95, ridgeW: o.ridgeW || 0.9,
          chowenScale: o.chowenScale || 1.1,
          beasts: o.beasts2 == null ? 6 : o.beasts2
        }));
      }
    } else if (o.facets === 'gable') {
      GEOM.gableRoof({
        AW: e2w, AD: e2d, rh: ridgeHalf, y0: y2, y1: y2 + (o.rise2 || 5.4),
        gd: o.gd, gableBase: o.gableBase,
        tile: o.tile || 2.2, curl: o.curl, lift: o.lift,
        group: g, batch: false, ridgeR: o.ridgeR || 0.24,
        ridgeH: o.ridgeH, ridgeW: o.ridgeW, chowenScale: o.chowenScale,
        beasts: o.beasts2 == null ? 6 : o.beasts2
      });
    } else {
      GEOM.roofTier(Object.assign({}, roofOpts, {
        AW: e2w, AD: e2d, aw: ridgeHalf, ad: 0.01, y0: y2, y1: y2 + (o.rise2 || 5.4),
        soffit: [i1w + 0.8, i1d + 0.8],
        ridgeTop: true, ridgeH: o.ridgeH || 0.95, ridgeW: o.ridgeW || 0.9,
        chowenScale: o.chowenScale || 1.1,
        beasts: o.beasts2 == null ? 6 : o.beasts2
      }));
    }
  } else if (o.facets === 'pyramid') {
    /* 单檐攒尖 */
    GEOM.roofTier(Object.assign({}, roofOpts, {
      AW: e1w, AD: e1d, aw: 0.01, ad: 0.01, y0: yR0, y1: yR0 + (o.rise1 || 6.4),
      soffit: [bw / 2 + 0.9, bd / 2 + 0.9],
      ridgeTop: false, finial: true, finialScale: o.finialScale || 1.0,
      beasts: o.beasts1 == null ? 4 : o.beasts1
    }));
  } else if (o.facets === 'gable') {
    /* 单檐歇山 */
    const ridgeHalf = o.ridgeHalf == null ? e1w * 0.93 : o.ridgeHalf;
    GEOM.gableRoof(Object.assign({}, roofOpts, {
      AW: e1w, AD: e1d, rh: ridgeHalf, y0: yR0, y1: yR0 + (o.rise1 || 5.0),
      gd: o.gd, gableBase: o.gableBase,
      soffit: [bw / 2 + 0.9, bd / 2 + 0.9],
      ridgeH: o.ridgeH || 0.9, ridgeW: o.ridgeW || 0.85,
      chowenScale: o.chowenScale || 1.0,
      beasts: o.beasts1 == null ? 4 : o.beasts1
    }));
  } else {
    /* 单檐庑殿 */
    const ridgeHalf = o.ridgeHalf == null ? Math.max(e1w - 12, e1w * 0.5) : o.ridgeHalf;
    GEOM.roofTier(Object.assign({}, roofOpts, {
      AW: e1w, AD: e1d, aw: ridgeHalf, ad: 0.01, y0: yR0, y1: yR0 + (o.rise1 || 5.0),
      soffit: [bw / 2 + 0.9, bd / 2 + 0.9],
      ridgeTop: true, ridgeH: o.ridgeH || 0.9, ridgeW: o.ridgeW || 0.85,
      chowenScale: o.chowenScale || 1.0,
      beasts: o.beasts1 == null ? 4 : o.beasts1
    }));
  }

  /* 前置踏跺 */
  if (o.stairs) {
    GEOM.stairs({
      x: 0, zTop: bd / 2 + (o.podiumPad == null ? 4.5 : o.podiumPad) / 2,
      w: o.stairs.w || Math.min(18, bw * 0.35),
      yTop: y0, yBottom: base,
      dir: 1, steps: o.stairs.steps || 6,
      run: o.stairs.run || 4.5, dragon: o.stairs.dragon
    });
  }
  return g;
};

/* -------------------------------------------------------------
 *  城台 + 城楼（午门 / 神武门 / 东华门）
 * ----------------------------------------------------------- */
BUILD.gate = function (o) {
  const g = BUILD.group || BUILD.parent;
  const base = o.baseY || 0;
  const W = o.bodyW, D = o.bodyD, H = o.bodyH;
  const mat = o.wallMat || MATS.brick;

  BUILD.addCollider(0, 0, W / 2, D / 2);
  GEOM.box(W, H, D, mat, 0, base + H / 2, 0);
  /* 下碱 */
  GEOM.box(W + 1.0, 1.4, D + 1.0, MATS.marble, 0, base + 0.7, 0);
  /* 台顶压边 */
  GEOM.box(W + 1.6, 0.5, D + 1.6, MATS.marble, 0, base + H + 0.25, 0);

  /* 券门 */
  const arches = o.arches == null ? 3 : o.arches;
  const aw = o.archW || 5.4;
  const ah = o.archH || Math.min(H * 0.75, 9.5);
  for (let side = 0; side < 2; side++) {
    const sz = side === 0 ? 1 : -1;
    for (let i = 0; i < arches; i++) {
      const ax = (i - (arches - 1) / 2) * (o.archGap || aw * 2.1);
      const arch = new THREE.Mesh(BUILD.archGeo(aw, ah), MATS.ironGate);
      arch.position.set(ax, base + 0.6, sz * (D / 2 + 0.07));
      if (sz < 0) arch.rotation.y = Math.PI;
      arch.castShadow = false;
      g.add(arch);
    }
  }

  /* 门钉（鎏金，7×7 阵列，两面） */
  if (o.studs !== false) {
    const studGeos = [];
    const cols = 7, rows = 7;
    const gridW = Math.min(aw * 0.66, 4.4);
    const gridH = Math.min(ah * 0.6, 5.4);
    for (let side = 0; side < 2; side++) {
      const sz = side === 0 ? 1 : -1;
      for (let i = 0; i < arches; i++) {
        const ax = (i - (arches - 1) / 2) * (o.archGap || aw * 2.1);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const g1 = new THREE.SphereGeometry(0.075, 6, 5);
            g1.translate(
              ax + (c - (cols - 1) / 2) * (gridW / cols),
              base + 1.2 + r * (gridH / rows),
              sz * (D / 2 + 0.13)
            );
            studGeos.push(g1);
          }
        }
      }
    }
    const studMesh = new THREE.Mesh(GEOM.merge(studGeos), MATS.goldDark);
    studMesh.castShadow = false;
    studMesh.receiveShadow = true;
    g.add(studMesh);

    /* 铺首衔环（每扇门一处） */
    const puGeos = [];
    for (let side = 0; side < 2; side++) {
      const sz = side === 0 ? 1 : -1;
      for (let i = 0; i < arches; i++) {
        const ax = (i - (arches - 1) / 2) * (o.archGap || aw * 2.1);
        for (const s2 of [-1, 1]) {
          const base2 = new THREE.SphereGeometry(0.1, 7, 6);
          base2.translate(ax + s2 * aw * 0.26, base + 2.55, sz * (D / 2 + 0.15));
          puGeos.push(base2);
          const ring = new THREE.TorusGeometry(0.15, 0.028, 6, 12);
          ring.translate(ax + s2 * aw * 0.26, base + 2.4, sz * (D / 2 + 0.16));
          puGeos.push(ring);
        }
      }
    }
    const puMesh = new THREE.Mesh(GEOM.merge(puGeos), MATS.goldDark);
    puMesh.castShadow = false;
    puMesh.receiveShadow = true;
    g.add(puMesh);
  }

  /* 城楼 */
  if (o.tower) {
    const t = o.tower;
    BUILD.hall({
      baseY: base + H + 0.5,
      bodyW: t.bodyW, bodyD: t.bodyD, bodyH: t.bodyH,
      bays: t.bays || 9, layers: 2,
      podiumH: 0,
      facadeMat: t.facadeMat || MATS.facade9,
      eave1: t.eave1, inner1: t.inner1, rise1: t.rise1,
      upperH: t.upperH, eave2: t.eave2, rise2: t.rise2, ridgeHalf: t.ridgeHalf,
      plaque: t.plaque, plaqueW: t.plaqueW,
      beasts1: 6, beasts2: 6,
      noColumns: t.noColumns
    });
  }
  return g;
};

/* -------------------------------------------------------------
 *  城墙（带收分、宇墙、雉堞、金顶压边）
 * ----------------------------------------------------------- */
BUILD.wallRun = function (o) {
  const x1 = o.x1, z1 = o.z1, x2 = o.x2, z2 = o.z2;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return;
  const h = o.h || 10, w = o.w || 8, base = o.baseY || 0;
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const ry = Math.atan2(-dz, dx);   // 局部 +x 指向墙走向

  /* 碰撞（墙中线 ± 半厚） */
  const nxw = Math.sin(ry), nzw = Math.cos(ry);
  {
    const ax = x1, az = z1;
    const bx = x2, bz = z2;
    BUILD.colliders.push({
      minX: Math.min(ax, bx) - Math.abs(nxw) * w / 2 - 0.2,
      maxX: Math.max(ax, bx) + Math.abs(nxw) * w / 2 + 0.2,
      minZ: Math.min(az, bz) - Math.abs(nzw) * w / 2 - 0.2,
      maxZ: Math.max(az, bz) + Math.abs(nzw) * w / 2 + 0.2
    });
  }

  /* 墙身（主体） */
  const m = GEOM.mat4(mx, base + h / 2, mz, 0, ry, 0, len, h, w);
  BATCH.add(GEOM.boxGeo, o.mat || MATS.wall, m);

  /* 顶部金瓦压边（三角脊） */
  const capShape = new THREE.Shape();
  capShape.moveTo(-(w / 2 + 0.55), 0);
  capShape.lineTo(w / 2 + 0.55, 0);
  capShape.lineTo(0, 1.35);
  capShape.closePath();
  const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: len, bevelEnabled: false });
  capGeo.translate(0, 0, -len / 2);
  const cap = new THREE.Mesh(capGeo, MATS.roof);
  cap.position.set(mx, base + h, mz);
  cap.rotation.y = ry + Math.PI / 2;
  cap.castShadow = true;
  cap.receiveShadow = true;
  (BUILD.group || BUILD.parent).add(cap);

  /* 外侧雉堞 + 内侧宇墙 */
  const nC = Math.max(1, Math.floor(len / 3.2));
  const step = len / nC;
  const ux = dx / len, uz = dz / len;
  const nx = Math.cos(ry), nz = -Math.sin(ry);  // 局部 +z 的世界方向（外侧/内侧）
  for (let i = 0; i < nC; i++) {
    const t = (i + 0.5) / nC;
    const cx = x1 + dx * t, cz = z1 + dz * t;
    if (o.merlons !== false) {
      BATCH.add(GEOM.boxGeo, o.mat || MATS.wall,
        GEOM.mat4(cx + nx * (w / 2 - 0.9), base + h + 0.55, cz + nz * (w / 2 - 0.9), 0, ry, 0, 1.7, 1.1, 1.1));
    }
    if (o.innerWall !== false) {
      BATCH.add(GEOM.boxGeo, o.mat || MATS.wall,
        GEOM.mat4(cx - nx * (w / 2 - 0.6), base + h + 0.35, cz - nz * (w / 2 - 0.6), 0, ry, 0, step * 0.98, 0.75, 0.6));
    }
  }
};

/* -------------------------------------------------------------
 *  角楼（三层檐复合顶）
 * ----------------------------------------------------------- */
BUILD.cornerTower = function (o) {
  const g = BUILD.group || BUILD.parent;
  const base = o.baseY || 0;
  /* 须弥座 */
  BUILD.addCollider(0, 0, 8.0, 8.0);
  GEOM.podium({ x: 0, z: 0, y: base, w: 15.0, d: 15.0, h: 0.9, rail: true, spacing: 2.3 });
  const y0 = base + 0.9;

  /* 一层身 + 四面抱厦 */
  GEOM.box(11.6, 3.2, 11.6, MATS.wall, 0, y0 + 1.6, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const bx = Math.sin(a), bz = Math.cos(a);
    GEOM.box(4.4, 2.6, 2.6, MATS.wall, bx * 6.9, y0 + 1.3, bz * 6.9, a);
    /* 抱厦小披檐 */
    GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
      group: g, AW: 3.0, AD: 2.0, aw: 1.4, ad: 0.01,
      y0: y0 + 2.6, y1: y0 + 3.4, ridgeTop: true, ridgeH: 0.35, ridgeW: 0.35,
      ridgeR: 0.12, beasts: 0, tile: 1.2, curl: 0.5, lift: 0.4,
      batch: true
    });
  }
  /* 一层窗 */
  for (let s = -1; s <= 1; s += 2) {
    for (let k = -1; k <= 1; k++) {
      const wp = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.1), MATS.lattice);
      wp.position.set(k * 3.2, y0 + 1.75, s * (5.8 + 0.06));
      if (s < 0) wp.rotation.y = Math.PI;
      wp.castShadow = false;
      g.add(wp);
      const wp2 = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.1), MATS.lattice);
      wp2.position.set(s * (5.8 + 0.06), y0 + 1.75, k * 3.2);
      wp2.rotation.y = s * Math.PI / 2;
      wp2.castShadow = false;
      g.add(wp2);
    }
  }
  GEOM.band({ w: 12.2, d: 12.2, h: 0.7, y: y0 + 3.2, tileU: 1.6 });

  /* 一层腰檐 */
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: 9.4, AD: 9.4, aw: 5.2, ad: 5.2,
    y0: y0 + 3.9, y1: y0 + 5.5,
    soffit: [6.4, 6.4], ridgeR: 0.22, beasts: 3, tile: 1.8
  });

  /* 二层身 */
  GEOM.box(10.4, 2.1, 10.4, MATS.wall, 0, y0 + 5.5 + 1.05, 0);
  GEOM.band({ w: 11.0, d: 11.0, h: 0.6, y: y0 + 7.6, tileU: 1.5 });

  /* 二层檐 */
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: 7.8, AD: 7.8, aw: 3.9, ad: 3.9,
    y0: y0 + 8.2, y1: y0 + 9.5,
    soffit: [5.3, 5.3], ridgeR: 0.18, beasts: 2, tile: 1.6
  });

  /* 三层身 */
  GEOM.box(7.8, 1.5, 7.8, MATS.wall, 0, y0 + 9.5 + 0.75, 0);
  GEOM.band({ w: 8.3, d: 8.3, h: 0.5, y: y0 + 11.0, tileU: 1.4 });

  /* 顶层攒尖 + 鎏金宝顶 */
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: 5.6, AD: 5.6, aw: 0.01, ad: 0.01,
    y0: y0 + 11.5, y1: y0 + 13.6,
    soffit: [3.6, 3.6], ridgeR: 0.16, ridgeTop: false,
    finial: true, finialScale: 1.1, beasts: 0, tile: 1.4
  });
  return g;
};

/* -------------------------------------------------------------
 *  内金水桥
 * ----------------------------------------------------------- */
BUILD.bridge = function (o) {
  const g = BUILD.group || BUILD.parent;
  const w = o.w || 6, len = o.len || 22;
  /* 桥面（微拱：三块拼） */
  const y = o.y == null ? 0.55 : o.y;
  GEOM.box(w, 0.8, len * 0.5, MATS.marbleRail, 0, y, 0);
  GEOM.box(w, 0.62, len * 0.28, MATS.marbleRail, 0, y + 0.24, 0);
  GEOM.box(w, 0.44, len * 0.12, MATS.marbleRail, 0, y + 0.4, 0);
  /* 桥栏 */
  for (let s = -1; s <= 1; s += 2) {
    const n = Math.max(3, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) {
      const z = -len / 2 + (len * i) / n;
      const px = s * (w / 2 - 0.25);
      BATCH.add(GEOM.postGeo(), MATS.marbleRail, GEOM.mat4(px, y + 0.35, z, 0, 0, 0, 0.75, 0.9, 0.75));
    }
    BATCH.add(GEOM.boxGeo, MATS.marbleRail, GEOM.mat4(s * (w / 2 - 0.25), y + 0.95, 0, 0, 0, 0, 0.22, 0.42, len));
  }
  return g;
};

/* -------------------------------------------------------------
 *  华表
 * ----------------------------------------------------------- */
BUILD.huabiao = function (o) {
  const base = o.baseY || 0;
  GEOM.box(3.2, 0.9, 3.2, MATS.marbleRail, 0, base + 0.45, 0);
  GEOM.box(2.4, 0.55, 2.4, MATS.marbleRail, 0, base + 1.15, 0);
  BATCH.add(new THREE.CylinderGeometry(0.42, 0.62, 12.5, 12), MATS.marbleRail,
    GEOM.mat4(0, base + 7.6, 0));
  /* 云板 */
  BATCH.add(new THREE.BoxGeometry(4.6, 0.42, 0.5), MATS.marbleRail, GEOM.mat4(0, base + 11.4, 0));
  BATCH.add(new THREE.BoxGeometry(0.5, 0.42, 4.6), MATS.marbleRail, GEOM.mat4(0, base + 11.4, 0));
  /* 承露盘 + 蹲兽 */
  BATCH.add(new THREE.CylinderGeometry(1.15, 1.0, 0.45, 12), MATS.marbleRail, GEOM.mat4(0, base + 13.95, 0));
  BATCH.add(new THREE.SphereGeometry(0.5, 8, 6), MATS.marbleRail, GEOM.mat4(0, base + 14.6, 0));
};

/* -------------------------------------------------------------
 *  铜狮（须弥座上）
 * ----------------------------------------------------------- */
BUILD.lion = function (o) {
  const base = o.baseY || 0;
  /* 须弥座 */
  GEOM.box(3.4, 0.55, 2.9, MATS.marbleRail, 0, base + 0.27, 0);
  GEOM.box(3.0, 0.9, 2.5, MATS.marbleRail, 0, base + 0.95, 0);
  const bm = MATS.bronze;
  const y0 = base + 1.4;
  /* 蹲坐的身体 */
  BATCH.add(new THREE.SphereGeometry(0.86, 12, 10), bm,
    GEOM.mat4(0, y0 + 0.95, -0.15, 0, 0, 0, 1.0, 1.05, 1.25));
  /* 前胸与前腿 */
  for (let s = -1; s <= 1; s += 2) {
    BATCH.add(new THREE.CylinderGeometry(0.16, 0.22, 1.15, 8), bm,
      GEOM.mat4(s * 0.34, y0 + 0.58, 0.72));
    BATCH.add(new THREE.CylinderGeometry(0.15, 0.18, 1.35, 8), bm,
      GEOM.mat4(s * 0.5, y0 + 0.68, -0.72));
  }
  /* 头 + 鬃毛 */
  BATCH.add(new THREE.SphereGeometry(0.56, 12, 10), bm,
    GEOM.mat4(0, y0 + 1.95, 0.42, 0, 0, 0, 1.0, 1.0, 1.05));
  BATCH.add(new THREE.TorusGeometry(0.56, 0.2, 8, 16), bm,
    GEOM.mat4(0, y0 + 1.9, 0.3, Math.PI / 2, 0, 0));
  /* 尾巴 */
  BATCH.add(new THREE.ConeGeometry(0.2, 1.0, 8), bm,
    GEOM.mat4(0, y0 + 1.35, -1.2, 0.9, 0, 0));
};

/* -------------------------------------------------------------
 *  铜鼎（三足）
 * ----------------------------------------------------------- */
BUILD.censer = function (o) {
  const base = o.baseY || 0;
  const bm = MATS.bronze;
  BATCH.add(new THREE.CylinderGeometry(0.85, 0.62, 1.15, 12), bm, GEOM.mat4(0, base + 1.5, 0));
  BATCH.add(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 12), bm, GEOM.mat4(0, base + 2.18, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    BATCH.add(new THREE.CylinderGeometry(0.11, 0.14, 1.0, 6), bm,
      GEOM.mat4(Math.cos(a) * 0.5, base + 0.5, Math.sin(a) * 0.5));
  }
  /* 双耳 */
  for (let s = -1; s <= 1; s += 2) {
    BATCH.add(new THREE.TorusGeometry(0.28, 0.07, 6, 10), bm,
      GEOM.mat4(s * 0.78, base + 2.1, 0, 0, 0, s * 0.2));
  }
};

/* -------------------------------------------------------------
 *  树（侧柏）
 * ----------------------------------------------------------- */
BUILD.tree = function (o) {
  DETAIL.tree(o);
};

/* -------------------------------------------------------------
 *  简易室内（合批）：地 / 墙 / 天花 / 梁枋 / 柱列
 * ----------------------------------------------------------- */
BUILD.addSimpleInterior = function (y0, bw, bd, bh) {
  const hw = bw / 2 - 1.5, hd = bd / 2 - 1.5, H = bh - 1.4;
  /* 地面 */
  GEOM.box(hw * 2, 0.1, hd * 2, MATS.innerFloor, 0, y0 + 0.05, 0);
  /* 天花 */
  GEOM.box(hw * 2, 0.22, hd * 2, MATS.coffer, 0, y0 + H, 0);
  /* 四壁 */
  const addWall = function (w, x, z, ry) {
    const geo = new THREE.PlaneGeometry(w, H);
    BATCH.add(geo, MATS.innerWall, GEOM.mat4(x, y0 + H / 2, z, 0, ry, 0));
    geo.dispose();
  };
  addWall(hw * 2, 0, -hd + 0.03, 0);
  addWall(hw * 2, 0, hd - 0.03, Math.PI);
  addWall(hd * 2, hw - 0.03, 0, -Math.PI / 2);
  addWall(hd * 2, -hw + 0.03, 0, Math.PI / 2);
  /* 梁枋 */
  for (const sz of [-1, 1]) {
    GEOM.box(hw * 2, 0.7, 0.45, MATS.caihua, 0, y0 + H - 0.6, sz * hd * 0.45);
  }
  /* 柱列 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      BATCH.add(BUILD.colGeo(), MATS.column,
        GEOM.mat4(sx * (hw - 0.6), y0 + H / 2, sz * (hd - 0.6), 0, 0, 0, 1.1, H, 1.1));
    }
    BATCH.add(BUILD.colGeo(), MATS.column,
      GEOM.mat4(sx * (hw - 0.6), y0 + H / 2, 0, 0, 0, 0, 1.1, H, 1.1));
  }
};

/* -------------------------------------------------------------
 *  廊庑（长条库房/连廊）
 * ----------------------------------------------------------- */
BUILD.corridor = function (o) {
  const len = o.len, dep = o.dep || 10, h = o.h || 6;
  BUILD.addCollider(0, 0, len / 2, dep / 2);
  GEOM.box(len, h, dep, MATS.wall, 0, (o.baseY || 0) + h / 2, 0);
  GEOM.band({ w: len + 0.8, d: dep + 0.8, h: 0.7, y: (o.baseY || 0) + h, tileU: 1.8 });
  /* 檐廊柱 */
  const n = Math.max(2, Math.round(len / 5));
  for (let i = 0; i <= n; i++) {
    const cx = -len / 2 + (len * i) / n;
    BATCH.add(BUILD.colGeo(), MATS.column, GEOM.mat4(cx, (o.baseY || 0) + h / 2, dep / 2 + 0.7, 0, 0, 0, 0.85, h, 0.85));
  }
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: BUILD.group, batch: o.batch,
    AW: len / 2 + 1.6, AD: dep / 2 + 2.6,
    aw: Math.max(len / 2 - 4, 2), ad: 0.01,
    y0: (o.baseY || 0) + h + 0.7, y1: (o.baseY || 0) + h + 0.7 + (o.rise || 3.4),
    soffit: [len / 2 + 0.6, dep / 2 + 0.8],
    ridgeTop: true, ridgeH: 0.6, ridgeW: 0.6,
    ridgeR: 0.18, beasts: 2, tile: 2.0, curl: 1.1, lift: 0.9
  });
};


/* =============================================================
 *  两层楼阁（体仁阁 / 弘义阁）：单檐庑殿 + 腰檐 + 平座
 * ============================================================= */
BUILD.twoStory = function (o) {
  const bw = o.bodyW, bd = o.bodyD;
  const podH = o.podiumH == null ? 0.9 : o.podiumH;
  const base = o.baseY || 0;
  const g = BUILD.group || BUILD.parent;
  GEOM.podium({ x: 0, z: 0, y: base, w: bw + 5, d: bd + 5, h: podH, rail: true, spacing: 2.6 });
  const y0 = base + podH;
  const lowerH = o.lowerH == null ? 8.6 : o.lowerH;
  const mat = o.wallMat || MATS.wall;
  GEOM.box(bw, lowerH, bd, mat, 0, y0 + lowerH / 2, 0);

  /* 下层立面 */
  const fh = Math.min(lowerH * 0.72, 5.6);
  const fac = o.facadeMat || MATS.facade9;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(bw - 2, fh), fac);
  front.position.set(0, y0 + fh / 2 + 0.3, bd / 2 + 0.05);
  front.receiveShadow = true;
  g.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(bw - 2, fh), fac);
  back.rotation.y = Math.PI;
  back.position.set(0, y0 + fh / 2 + 0.3, -bd / 2 - 0.05);
  back.receiveShadow = true;
  g.add(back);

  /* 柱列 */
  const bays = o.bays || 9;
  const nCol = bays + 1;
  const span = bw - 2;
  for (let i = 0; i < nCol; i++) {
    const cx = -span / 2 + span * i / (nCol - 1);
    for (const s of [-1, 1]) {
      BATCH.add(BUILD.colGeo(), MATS.column,
        GEOM.mat4(cx, y0 + lowerH / 2, s * (bd / 2 + 0.5), 0, 0, 0, 1, lowerH, 1));
    }
  }
  GEOM.band({ w: bw + 1, d: bd + 1, h: 0.8, y: y0 + lowerH, tileU: 2.0 });

  /* 腰檐 */
  const y1 = y0 + lowerH + 0.8;
  const rise1 = o.rise1 == null ? 3.2 : o.rise1;
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: bw / 2 + 3.0, AD: bd / 2 + 2.6,
    aw: bw / 2 + 0.6, ad: bd / 2 + 0.4,
    y0: y1, y1: y1 + rise1,
    soffit: [bw / 2 + 0.5, bd / 2 + 0.5],
    ridgeR: 0.24, beasts: 3, tile: o.tile || 2.0
  });

  /* 平座 + 栏杆 */
  const balY = y1 + rise1;
  GEOM.box(bw + 3.4, 0.35, bd + 3.4, MATS.marbleRail, 0, balY + 0.18, 0);
  GEOM.balustrade({ hw: (bw + 3.4) / 2, hd: (bd + 3.4) / 2, y: balY + 0.35, spacing: 2.4, mat: MATS.goldDark });

  /* 上层 */
  const uw = bw - 8, ud = bd - 4;
  const uh = o.upperH == null ? 5.2 : o.upperH;
  const y2 = balY + 0.35;
  GEOM.box(uw, uh, ud, mat, 0, y2 + uh / 2, 0);
  for (const s of [-1, 1]) {
    const wp = new THREE.Mesh(new THREE.PlaneGeometry(uw * 0.86, uh * 0.6), MATS.lattice);
    wp.position.set(0, y2 + uh * 0.55, s * (ud / 2 + 0.05));
    if (s < 0) wp.rotation.y = Math.PI;
    g.add(wp);
  }
  GEOM.band({ w: uw + 0.8, d: ud + 0.8, h: 0.7, y: y2 + uh, tileU: 1.8 });

  /* 顶层单檐庑殿 */
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: uw / 2 + 3.0, AD: ud / 2 + 2.4,
    aw: o.ridgeHalf == null ? uw * 0.36 : o.ridgeHalf, ad: 0.01,
    y0: y2 + uh + 0.7, y1: y2 + uh + 0.7 + (o.rise2 == null ? 4.6 : o.rise2),
    soffit: [uw / 2 + 0.5, ud / 2 + 0.5],
    ridgeTop: true, ridgeH: 0.8, ridgeW: 0.75, ridgeR: 0.22,
    beasts: 4, tile: 1.9
  });
  if (o.plaque) GEOM.plaqueAt(o.plaque, 0, y0 + lowerH - 1.4, bd / 2 + 0.42, 0, 3.4);
  BUILD.addCollider(0, 0, (bw + 5) / 2, (bd + 5) / 2);
  BUILD.addAO(0, 0, bw + 14, bd + 14, base + 0.03);
  return g;
};

/* =============================================================
 *  亭（方形 / 十字抱厦 / 攒尖 / 上圆下方）
 * ============================================================= */
BUILD.gazebo = function (o) {
  const size = o.size || 8;
  const base = o.baseY || 0;
  const podH = o.podiumH == null ? 0.6 : o.podiumH;
  const H = o.h || 3.8;
  const half = size / 2;
  const g = BUILD.group || BUILD.parent;
  const padW = o.cross ? 6.5 : 3;
  GEOM.podium({ x: 0, z: 0, y: base, w: size + padW, d: size + padW, h: podH, rail: false });
  const y0 = base + podH;
  /* 柱与座凳 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      BATCH.add(BUILD.colGeo(), MATS.column,
        GEOM.mat4(sx * (half - 0.25), y0 + H / 2, sz * (half - 0.25), 0, 0, 0, 0.85, H, 0.85));
    }
  }
  GEOM.balustrade({ hw: half - 0.2, hd: half - 0.2, y: y0 + 0.5, spacing: 1.5, mat: MATS.goldDark });
  GEOM.band({ w: size + 0.6, d: size + 0.6, h: 0.5, y: y0 + H, tileU: 1.4 });

  if (o.cross) {
    /* 十字抱厦：只做廊柱，披檐由主腰檐覆盖 */
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const bx = Math.sin(a), bz = Math.cos(a);
      BATCH.add(BUILD.colGeo(), MATS.column,
        GEOM.mat4(bx * (half + 1.9), y0 + H / 2 - 0.2, bz * (half + 1.9), 0, 0, 0, 0.7, H - 0.4, 0.7));
      /* 抱厦矮墙 */
      GEOM.box(3.4, 1.1, 1.0, MATS.wall, bx * (half + 2.2), y0 + 0.55, bz * (half + 2.2), a);
    }
  }

  if (o.conical) {
    /* 上圆下方：下层方檐 + 上层圆攒尖 */
    GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
      group: g, AW: half + 2.6, AD: half + 2.6, aw: half * 0.62, ad: half * 0.62,
      y0: y0 + H + 0.5, y1: y0 + H + 2.0,
      soffit: [half + 0.2, half + 0.2], ridgeR: 0.18, beasts: 0, tile: 1.5
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(half * 0.78, 2.6, 20), (o.roofMat || MATS.roof));
    cone.position.y = y0 + H + 2.0 + 1.3;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
    GEOM.finial(y0 + H + 2.0 + 2.6, 0.75);
  } else {
    GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
      group: g, AW: half + 2.4, AD: half + 2.4, aw: 0.01, ad: 0.01,
      y0: y0 + H + 0.5, y1: y0 + H + 0.5 + (o.rise == null ? 3.2 : o.rise),
      soffit: [half + 0.1, half + 0.1], ridgeTop: false, finial: true, finialScale: 0.8,
      beasts: 0, tile: 1.5, ridgeR: 0.18
    });
  }
  BUILD.addCollider(0, 0, half + 0.8, half + 0.8);
  return g;
};

/* =============================================================
 *  琉璃门（天一门等）
 * ============================================================= */
BUILD.gateSimple = function (o) {
  const w = o.w || 10, d = o.d || 5, h = o.h || 5;
  const base = o.baseY || 0;
  const g = BUILD.group || BUILD.parent;
  GEOM.podium({ x: 0, z: 0, y: base, w: w + 4, d: d + 4, h: 0.5, rail: false });
  GEOM.box(w, h, d, MATS.brick, 0, base + 0.5 + h / 2, 0);
  const arch = new THREE.Mesh(BUILD.archGeo(2.6, 3.4), MATS.ironGate);
  arch.position.set(0, base + 0.55, d / 2 + 0.06);
  g.add(arch);
  GEOM.roofTier({
    mat: (o.roofMat || MATS.roof),
    group: g, AW: w / 2 + 1.4, AD: d / 2 + 1.2, aw: w / 2 - 2.4, ad: 0.01,
    y0: base + 0.5 + h, y1: base + 0.5 + h + 2.2,
    soffit: [w / 2 + 0.2, d / 2 + 0.2], ridgeTop: true, ridgeH: 0.5, ridgeW: 0.5,
    ridgeR: 0.16, beasts: 2, tile: 1.3
  });
  BUILD.addCollider(0, 0, w / 2 + 1.5, d / 2 + 1.5);
  return g;
};

/* =============================================================
 *  假山（堆秀山）
 * ============================================================= */
BUILD.rockery = function (o) {
  const base = o.baseY || 0;
  const W = o.w || 16, D = o.d || 12, H = o.h || 9;
  const n = o.rocks || 18;
  /* 底部大石层 */
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + TEX.rand() * 0.4;
    const rad = 6.0 + TEX.rand() * 2.2;
    const r = 2.2 + TEX.rand() * 1.5;
    BATCH.add(new THREE.DodecahedronGeometry(r, 0), MATS.rock,
      GEOM.mat4(Math.cos(ang) * rad, base + r * 0.55, Math.sin(ang) * rad * 0.8,
        TEX.rand() * 3, TEX.rand() * 3, TEX.rand() * 3, 1.0, 0.7 + TEX.rand() * 0.4, 1.0));
  }
  /* 中层与顶层叠石 */
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const level = Math.floor(t * 3);
    const r = (1.5 - level * 0.32) * (0.8 + TEX.rand() * 0.7);
    const ang = TEX.rand() * Math.PI * 2;
    const rad = (5.2 - level * 1.4) * (0.5 + TEX.rand() * 0.7);
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad * 0.8;
    const y = base + 1.6 + level * (H * 0.26) + TEX.rand() * 1.2;
    BATCH.add(new THREE.DodecahedronGeometry(r, 0), MATS.rock,
      GEOM.mat4(x, y, z, TEX.rand() * 3, TEX.rand() * 3, TEX.rand() * 3,
        1.0, 0.6 + TEX.rand() * 0.5, 1.0));
  }
  /* 山顶平台 */
  BATCH.add(new THREE.CylinderGeometry(W * 0.32, W * 0.4, 0.5, 10), MATS.rock,
    GEOM.mat4(0, base + H * 0.93, 0));
  /* 磴道（正面石阶） */
  for (let s = 0; s < 9; s++) {
    const y = base + 0.35 + s * 0.62;
    const z = -2.6 - s * 0.62;
    BATCH.add(GEOM.boxGeo, MATS.stoneDark,
      GEOM.mat4(2.2, base + (0.35 + s * 0.62) / 2, D * 0.5 - s * 0.7, 0, 0, 0, 2.4, 0.35, 0.85));
  }
  BUILD.addCollider(0, 0, W * 0.52, D * 0.56);
  return null;
};
