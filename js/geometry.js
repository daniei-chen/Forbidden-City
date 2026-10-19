/* =============================================================
 *  紫禁城 · 数字复原  —  几何构建
 *  曲面屋顶（庑殿/攒尖/腰檐）、脊饰走兽、汉白玉栏杆、台阶、合批
 * ============================================================= */
const GEOM = {};
const lerp = function (a, b, t) { return a + (b - a) * t; };
GEOM.lerp = lerp;
GEOM.ease = function (t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
GEOM.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

const YAXIS = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _vec = new THREE.Vector3();
const _scale = new THREE.Vector3();

GEOM.mat4 = function (x, y, z, rx, ry, rz, sx, sy, sz) {
  _euler.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _quat.setFromEuler(_euler);
  _vec.set(x || 0, y || 0, z || 0);
  _scale.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
  return new THREE.Matrix4().compose(_vec, _quat, _scale);
};

/* -------------------------------------------------------------
 *  几何合并（同材质批量成 1 个 mesh，显著降低 draw call）
 * ----------------------------------------------------------- */
GEOM.merge = function (geos) {
  let total = 0;
  const list = [];
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    const n = g.index ? g.toNonIndexed() : g;
    list.push(n);
    total += n.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    const p = g.attributes.position;
    pos.set(p.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
};

const BATCH = {
  buckets: new Map(),
  xform: null,          // 当前建筑组的世界变换（烘焙进合批）
  add: function (geo, mat, matrix, opts) {
    const cast = !(opts && opts.cast === false);
    const key = mat.uuid + (cast ? '' : '|nc');
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat: mat, geos: [], cast: cast };
      this.buckets.set(key, b);
    }
    const g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (this.xform) g.applyMatrix4(this.xform);
    b.geos.push(g);
  },
  flush: function (parent) {
    for (const b of this.buckets.values()) {
      const merged = GEOM.merge(b.geos);
      b.geos.forEach(function (g) { g.dispose(); });
      const m = new THREE.Mesh(merged, b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = true;
      parent.add(m);
    }
    this.buckets.clear();
  }
};

/* 基础几何（复用） */
GEOM.boxGeo = new THREE.BoxGeometry(1, 1, 1);
GEOM.cylGeo = new THREE.CylinderGeometry(0.55, 0.62, 1, 14);

GEOM.box = function (w, h, d, mat, x, y, z, ry, opts) {
  BATCH.add(GEOM.boxGeo, mat, GEOM.mat4(x, y, z, 0, ry || 0, 0, w, h, d), opts);
};

/* -------------------------------------------------------------
 *  屋顶曲面
 *  参数：外檐口 (AW,AD) → 内收口 (aw,ad)，檐口高 y0 → 顶高 y1
 *  反宇曲线：sag < 1（近脊陡、近檐缓），翼角起翘 curl / lift
 * ----------------------------------------------------------- */
GEOM.roofTier = function (o) {
  const AW = o.AW, AD = o.AD, aw = o.aw, ad = o.ad;
  const y0 = o.y0, y1 = o.y1;
  const sag = o.sag == null ? 0.72 : o.sag;
  const curl = o.curl == null ? 1.7 : o.curl;
  const lift = o.lift == null ? 1.5 : o.lift;
  const segU = o.segU || 40, segS = o.segS || 16;
  const tile = o.tile || 2.2;
  const mat = o.mat || MATS.roof;
  const group = o.group || new THREE.Group();
  const _roofMeshes = [];
  const rise = y1 - y0;

  const slopes = [
    { rot: 0, a0: AW, a1: aw, b0: AD, b1: ad },
    { rot: Math.PI, a0: AW, a1: aw, b0: AD, b1: ad },
    { rot: Math.PI / 2, a0: AD, a1: ad, b0: AW, b1: aw },
    { rot: -Math.PI / 2, a0: AD, a1: ad, b0: AW, b1: aw }
  ];

  function surfaceY(s) {
    return y0 + rise * (1 - Math.pow(1 - s, sag));
  }

  function buildSurf(sl) {
    const pos = [], uvs = [], idx = [];
    const cols = segU + 1;
    const uRep = Math.max(1, (2 * Math.max(sl.a0, 0.5)) / tile);
    const vRep = Math.max(1, Math.hypot(Math.max(sl.b0 - sl.b1, 0.5), rise) / tile);
    for (let si = 0; si <= segS; si++) {
      const s = si / segS;
      const yy = surfaceY(s);
      const aa = lerp(sl.a0, sl.a1, s);
      const bb = lerp(sl.b0, sl.b1, s);
      for (let ui = 0; ui <= segU; ui++) {
        const u = ui / segU;
        const ex = Math.abs(u * 2 - 1);
        const ext = curl * Math.pow(ex, 2.6) * Math.pow(1 - s, 2.2);
        const yl = lift * Math.pow(ex, 3.0) * Math.pow(1 - s, 2.6);
        pos.push((u * 2 - 1) * (aa + ext), yy + yl, bb + ext);
        uvs.push(u * uRep, s * vRep);
      }
    }
    for (let si = 0; si < segS; si++) {
      for (let ui = 0; ui < segU; ui++) {
        const a = si * cols + ui, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    let sumY = 0;
    for (let i = 0; i < n.count; i++) sumY += n.getY(i);
    if (sumY < 0) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t;
      }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    return g;
  }

  for (let i = 0; i < slopes.length; i++) {
    const sl = slopes[i];
    const sg = buildSurf(sl);
    if (o.batch) {
      BATCH.add(sg, mat, GEOM.mat4(0, 0, 0, 0, sl.rot, 0));
      sg.dispose();
    } else {
      const mesh = new THREE.Mesh(sg, mat);
      mesh.rotation.y = sl.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      _roofMeshes.push(mesh);
    }
  }

  /* 屋脊曲线（四条垂脊） */
  function edgeCurve(sl, u, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const yy = surfaceY(s);
      const aa = lerp(sl.a0, sl.a1, s);
      const bb = lerp(sl.b0, sl.b1, s);
      const ex = Math.abs(u * 2 - 1);
      const ext = curl * Math.pow(ex, 2.6) * Math.pow(1 - s, 2.2);
      const yl = lift * Math.pow(ex, 3.0) * Math.pow(1 - s, 2.6);
      const v = new THREE.Vector3((u * 2 - 1) * (aa + ext), yy + yl, bb + ext);
      v.applyAxisAngle(YAXIS, sl.rot);
      pts.push(v);
    }
    return pts;
  }

  const ridgeR = o.ridgeR == null ? 0.3 : o.ridgeR;
  const cornerCurves = [
    edgeCurve(slopes[0], 1, 14),
    edgeCurve(slopes[0], 0, 14),
    edgeCurve(slopes[1], 1, 14),
    edgeCurve(slopes[1], 0, 14)
  ];
  const beastGeo = o.beasts === false ? null : GEOM.beastGeo();
  for (let ci = 0; ci < cornerCurves.length; ci++) {
    const curve = new THREE.CatmullRomCurve3(cornerCurves[ci]);
    const tube = new THREE.TubeGeometry(curve, 26, ridgeR, 6, false);
    if (o.batch) {
      BATCH.add(tube, MATS.ridge);
      tube.dispose();
    } else {
      const rm = new THREE.Mesh(tube, MATS.ridge);
      rm.castShadow = true;
      group.add(rm);
      _roofMeshes.push(rm);
    }
    // 走兽：檐角起 5 只
    if (beastGeo) {
      const nB = o.beasts === true ? 5 : (o.beasts || 5);
      for (let k = 0; k < nB; k++) {
        const t = 0.02 + k * 0.028;
        const p = curve.getPointAt(Math.min(t, 0.98));
        const m = new THREE.Matrix4().makeTranslation(p.x, p.y + 0.18, p.z);
        const mm = m.clone().multiply(new THREE.Matrix4().makeScale(0.85, 0.85, 0.85));
        BATCH.add(beastGeo, MATS.goldDark, mm);
      }
    }
  }

  /* 正脊 + 鸱吻（庑殿顶：aw > 0 且非攒尖） */
  if (o.ridgeTop !== false && aw > 0.6) {
    const rw = aw + 0.8;
    GEOM.box(2 * rw, o.ridgeH || 0.9, o.ridgeW || 0.85, MATS.ridge, 0, y1 + 0.3, 0);
    const cw = GEOM.chowenGeo();
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      const sc = (o.chowenScale || 0.95);
      const px = sgn * (rw + 0.15) - sgn * 0.55 * sc;
      const py = y1 + 0.62;
      const pry = side === 0 ? Math.PI : 0;
      if (o.batch) {
        BATCH.add(cw, MATS.ridge, GEOM.mat4(px, py, 0, 0, pry, 0, sc, sc, sc));
      } else {
        const mesh = new THREE.Mesh(cw, MATS.ridge);
        mesh.scale.set(sc, sc, sc);
        mesh.position.set(px, py, 0);
        mesh.rotation.y = pry;
        mesh.castShadow = true;
        group.add(mesh);
        _roofMeshes.push(mesh);
      }
    }
  }

  /* 攒尖宝顶 */
  if (o.finial) {
    GEOM.finial(y1 + (o.ridgeH || 0.9) * 0.4, o.finialScale || 1);
  }

  /* 按材质合并屋顶网格：显著减少 draw call（视觉完全一致） */
  if (!o.batch && _roofMeshes.length > 1) {
    const byMat = new Map();
    for (let mi = 0; mi < _roofMeshes.length; mi++) {
      const m = _roofMeshes[mi];
      m.updateMatrix();
      const geo = m.geometry.clone().applyMatrix4(m.matrix);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(geo);
      group.remove(m);
      m.geometry.dispose();
    }
    byMat.forEach(function (geos, mat2) {
      const merged = GEOM.merge(geos);
      const mm = new THREE.Mesh(merged, mat2);
      mm.castShadow = true;
      mm.receiveShadow = true;
      group.add(mm);
      for (let gi = 0; gi < geos.length; gi++) geos[gi].dispose();
    });
  }

  /* 檐下阴影板（从下往上看不会漏空） */
  if (o.soffit) {
    GEOM.soffit(AW + 0.3, AD + 0.3, o.soffit[0], o.soffit[1], y0 - 0.04, group, o.soffitMat, o.batch);
  }

  if (!o.group) return group;
  return group;
};

/* 鸱吻（二维剪影挤出） */
GEOM.chowenGeo = function () {
  if (GEOM._chowen) return GEOM._chowen;
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(-0.52, 0.72);
  s.bezierCurveTo(-0.46, 1.5, -0.05, 1.98, 0.5, 1.96);
  s.bezierCurveTo(1.1, 1.94, 1.38, 1.5, 1.16, 1.18);
  s.bezierCurveTo(0.98, 0.92, 0.58, 1.02, 0.5, 1.32);
  s.lineTo(0.52, 0.58);
  s.bezierCurveTo(0.62, 0.3, 0.52, 0.05, 0.46, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: false, curveSegments: 9 });
  g.translate(0, 0, -0.21);
  GEOM._chowen = g;
  return g;
};

/* 宝顶 */
GEOM.finial = function (y, sc) {
  sc = sc || 1;
  BATCH.add(new THREE.CylinderGeometry(0.75 * sc, 1.0 * sc, 0.5 * sc, 14), MATS.goldDark, GEOM.mat4(0, y + 0.25 * sc, 0));
  BATCH.add(new THREE.SphereGeometry(0.6 * sc, 16, 12), MATS.gold, GEOM.mat4(0, y + 0.95 * sc, 0));
  BATCH.add(new THREE.CylinderGeometry(0.18 * sc, 0.3 * sc, 0.5 * sc, 10), MATS.gold, GEOM.mat4(0, y + 1.5 * sc, 0));
  BATCH.add(new THREE.SphereGeometry(0.16 * sc, 10, 8), MATS.gold, GEOM.mat4(0, y + 1.82 * sc, 0));
};

/* 走兽 */
GEOM.beastGeo = function () {
  if (GEOM._beast) return GEOM._beast;
  const body = new THREE.SphereGeometry(0.2, 8, 6);
  body.scale(1.0, 1.4, 0.95);
  body.translate(0, 0.3, 0);
  const head = new THREE.SphereGeometry(0.14, 8, 6);
  head.translate(0, 0.66, 0.05);
  const earL = new THREE.ConeGeometry(0.045, 0.16, 5);
  earL.translate(-0.08, 0.8, 0.03);
  const earR = new THREE.ConeGeometry(0.045, 0.16, 5);
  earR.translate(0.08, 0.8, 0.03);
  const tail = new THREE.ConeGeometry(0.06, 0.42, 5);
  tail.rotateZ(-0.85);
  tail.translate(-0.2, 0.4, -0.02);
  GEOM._beast = GEOM.merge([body, head, earL, earR, tail]);
  return GEOM._beast;
};

/* 檐下底板（避免仰视时屋顶/天空漏缝） */
GEOM.soffit = function (AW, AD, iw, id, y, group, mat, batch) {
  const shape = new THREE.Shape();
  shape.moveTo(-AW, -AD);
  shape.lineTo(AW, -AD);
  shape.lineTo(AW, AD);
  shape.lineTo(-AW, AD);
  shape.closePath();
  if (iw > 0.2 && id > 0.2) {
    const hole = new THREE.Path();
    hole.moveTo(-iw, -id);
    hole.lineTo(-iw, id);
    hole.lineTo(iw, id);
    hole.lineTo(iw, -id);
    hole.closePath();
    shape.holes.push(hole);
  }
  const g = new THREE.ShapeGeometry(shape, 2);
  g.rotateX(Math.PI / 2);
  const m2 = mat || MATS.soffit;
  if (batch) {
    BATCH.add(g, m2, GEOM.mat4(0, y, 0));
    g.dispose();
    return;
  }
  const m = new THREE.Mesh(g, m2);
  m.position.y = y;
  m.receiveShadow = true;
  if (group) group.add(m);
};

/* -------------------------------------------------------------
 *  汉白玉栏杆
 * ----------------------------------------------------------- */
GEOM.postGeo = function () {
  if (GEOM._post) return GEOM._post;
  const H = 1.12;
  const col = new THREE.BoxGeometry(0.24, H, 0.24);
  col.translate(0, H / 2, 0);
  const cap = new THREE.BoxGeometry(0.38, 0.16, 0.38);
  cap.translate(0, H + 0.08, 0);
  const top = new THREE.SphereGeometry(0.17, 8, 6);
  top.translate(0, H + 0.27, 0);
  GEOM._post = GEOM.merge([col, cap, top]);
  return GEOM._post;
};

GEOM.panelGeo = function () {
  if (GEOM._panel) return GEOM._panel;
  const g = new THREE.BoxGeometry(1, 0.52, 0.14);
  g.translate(0, 0.44, 0);
  GEOM._panel = g;
  return g;
};

GEOM.balustrade = function (o) {
  const hw = o.hw, hd = o.hd, y = o.y;
  const mat = o.mat || MATS.marbleRail;
  const spacing = o.spacing || 3.2;
  const holes = o.holes || [];
  const postGeo = GEOM.postGeo();
  const panelGeo = GEOM.panelGeo();

  function inHole(side, coord, extra) {
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (h.side !== side) continue;
      if (Math.abs(coord - h.c) < h.w / 2 + (extra || 0)) return true;
    }
    return false;
  }

  function edge(x1, z1, x2, z2, side) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(len / spacing));
    const seg = len / n;
    const ang = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x1 + dx * t, z = z1 + dz * t;
      const coord = (side === 'N' || side === 'S') ? x : z;
      if (!inHole(side, coord, 0)) {
        BATCH.add(postGeo, mat, GEOM.mat4(x, y, z));
      }
      if (i < n) {
        const mx = x1 + dx * (i + 0.5) / n;
        const mz = z1 + dz * (i + 0.5) / n;
        const mc = (side === 'N' || side === 'S') ? mx : mz;
        if (!inHole(side, mc, 0.3)) {
          BATCH.add(panelGeo, mat, GEOM.mat4(mx, y, mz, 0, ang + Math.PI / 2, 0, seg, 1, 1));
        }
      }
    }
  }
  edge(-hw, hd, hw, hd, 'S');
  edge(-hw, -hd, hw, -hd, 'N');
  edge(hw, hd, hw, -hd, 'E');
  edge(-hw, -hd, -hw, hd, 'W');
};

/* -------------------------------------------------------------
 *  斗拱彩画带（四面环带，按面宽设置 UV 重复）
 * ----------------------------------------------------------- */
GEOM.band = function (o) {
  const w = o.w, d = o.d, h = o.h, y = o.y, t = o.tileU || 2.2;
  const mat = o.mat || MATS.dougong;
  function face(pw, px, pz, ry) {
    const g = new THREE.PlaneGeometry(pw, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (pw / t));
    BATCH.add(g, mat, GEOM.mat4(px, y + h / 2, pz, 0, ry, 0));
  }
  face(w, 0, d / 2 + 0.02, 0);
  face(w, 0, -d / 2 - 0.02, Math.PI);
  face(d, w / 2 + 0.02, 0, Math.PI / 2);
  face(d, -w / 2 - 0.02, 0, -Math.PI / 2);
};

/* -------------------------------------------------------------
 *  匾额
 * ----------------------------------------------------------- */
GEOM.plaqueAt = function (text, x, y, z, ry, w) {
  const h = w * 0.34;
  const nx = Math.sin(ry || 0), nz = Math.cos(ry || 0);
  BATCH.add(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.26), MATS.plaqueFrame, GEOM.mat4(x, y, z, 0, ry || 0, 0));
  BATCH.add(new THREE.PlaneGeometry(w, h), MATS.plaque(text), GEOM.mat4(x + nx * 0.15, y, z + nz * 0.15, 0, ry || 0, 0));
};

/* -------------------------------------------------------------
 *  台基 / 须弥座
 * ----------------------------------------------------------- */
GEOM.podium = function (o) {
  const w = o.w, d = o.d, h = o.h, y = o.y;
  const mat = o.mat || MATS.marble;
  // 下枋
  GEOM.box(w + 1.4, h * 0.22, d + 1.4, mat, o.x, y + h * 0.11, o.z);
  // 束腰（略收）
  GEOM.box(w + 0.4, h * 0.5, d + 0.4, mat, o.x, y + h * 0.47, o.z);
  // 上枋
  GEOM.box(w + 1.0, h * 0.28, d + 1.0, mat, o.x, y + h * 0.86, o.z);
  // 栏杆
  if (o.rail !== false) {
    GEOM.balustrade({
      hw: w / 2 + 0.5, hd: d / 2 + 0.5, y: y + h,
      mat: MATS.marbleRail, spacing: o.spacing || 2.6,
      holes: o.holes || []
    });
  }
};

/* -------------------------------------------------------------
 *  台阶（含垂带 + 御路）
 * ----------------------------------------------------------- */
GEOM.stairs = function (o) {
  const x = o.x, zTop = o.zTop, w = o.w;
  const yTop = o.yTop, yBottom = o.yBottom;
  const dir = o.dir == null ? 1 : o.dir;      // 1: 向 +z 下，-1: 向 -z 下
  const mat = o.mat || MATS.marble;
  const steps = o.steps || Math.max(4, Math.round((yTop - yBottom) / 0.23));
  const run = o.run || Math.max(3.0, (yTop - yBottom) * 2.4);
  const rise = (yTop - yBottom) / steps;
  const tread = run / steps;

  for (let i = 0; i < steps; i++) {
    const hTop = yTop - rise * i;              // 本踏步台面标高
    const yy = (yBottom + hTop) / 2;           // 实心：从地面填到台面
    const zz = zTop + dir * tread * (i + 0.5);
    GEOM.box(w, hTop - yBottom, tread, mat, x, yy, zz);
  }

  // 垂带（两侧斜栏）
  const drop = yTop - yBottom;
  const slopeLen = Math.hypot(drop, run);
  const ang = Math.atan2(drop, run) * dir;
  const zMid = zTop + dir * run / 2;
  const yMid = (yTop + yBottom) / 2;
  for (let s = 0; s < 2; s++) {
    const sx = x + (s === 0 ? -1 : 1) * (w / 2 + 0.45);
    const m = GEOM.mat4(sx, yMid + 0.12, zMid, ang, 0, 0, 0.9, 0.32, slopeLen);
    BATCH.add(GEOM.boxGeo, mat, m);
  }
  // 御路（中心雕刻石）
  if (o.dragon) {
    const m = GEOM.mat4(x, yMid + 0.16, zMid, ang, 0, 0, Math.min(3.6, w * 0.22), 0.22, slopeLen * 0.98);
    BATCH.add(GEOM.boxGeo, MATS.dragon, m);
  }
};

/* =============================================================
 *  歇山顶（九脊殿）
 *  前后坡 + 两山撒山坡带 + 垂直山花 + 博风板 + 正脊鸱吻
 *  o: AW, AD（檐口半宽/半深）, rh（正脊半长）, y0, y1,
 *     gd（山花底半宽）, gableBase（山花底线高度比例）, group, batch
 * ============================================================= */
GEOM.gableRoof = function (o) {
  const AW = o.AW, AD = o.AD;
  const rh = o.rh != null ? o.rh : AW - Math.max(2.0, AW * 0.09);
  const y0 = o.y0, y1 = o.y1, rise = y1 - y0;
  const base = o.gableBase != null ? o.gableBase : 0.2;
  const gy = y0 + rise * base;
  const gd = o.gd != null ? o.gd : AD - Math.max(1.2, AD * 0.1);
  const sag = o.sag == null ? 0.72 : o.sag;
  const curl = o.curl == null ? 1.5 : o.curl;
  const lift = o.lift == null ? 1.2 : o.lift;
  const segU = o.segU || 40, segS = o.segS || 14;
  const tile = o.tile || 2.2;
  const mat = o.mat || MATS.roof;
  const group = o.group || new THREE.Group();
  const prof = function (s) { return 1 - Math.pow(1 - s, sag); };

  function finishGeo(pos, uvs, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    let sumY = 0;
    for (let i = 0; i < n.count; i++) sumY += n.getY(i);
    if (sumY < 0) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t;
      }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    return g;
  }

  /* ---------- 前后坡 ---------- */
  function slopeGeo() {
    const pos = [], uvs = [], idx = [], cols = segU + 1;
    const uRep = (2 * AW) / tile, vRep = Math.hypot(AD, rise) / tile;
    for (let si = 0; si <= segS; si++) {
      const s = si / segS;
      const yy = y0 + rise * prof(s);
      const aa = lerp(AW, rh, s), bb = lerp(AD, 0, s);
      for (let ui = 0; ui <= segU; ui++) {
        const u = ui / segU, ex = Math.abs(u * 2 - 1);
        const ext = curl * Math.pow(ex, 2.6) * Math.pow(1 - s, 2.2);
        const yl = lift * Math.pow(ex, 3) * Math.pow(1 - s, 2.6);
        pos.push((u * 2 - 1) * (aa + ext), yy + yl, bb + ext);
        uvs.push(u * uRep, s * vRep);
      }
    }
    for (let si = 0; si < segS; si++) {
      for (let ui = 0; ui < segU; ui++) {
        const a = si * cols + ui, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return finishGeo(pos, uvs, idx);
  }
  for (const rot of [0, Math.PI]) {
    const g = slopeGeo();
    if (o.batch) {
      BATCH.add(g, mat, GEOM.mat4(0, 0, 0, 0, rot, 0));
      g.dispose();
    } else {
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.y = rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  /* ---------- 两山撒山坡带 ---------- */
  function bandGeo(sgnX, sgnZ) {
    const pos = [], uvs = [], idx = [], cols = segU + 1;
    for (let si = 0; si <= segS; si++) {
      const t = si / segS;
      const ext = curl * Math.pow(1 - t, 2.2);
      const yl = lift * Math.pow(1 - t, 2.6);
      const aa = lerp(AW, rh, t), bb = lerp(AD, 0, t);
      const ix = (aa + ext) * sgnX, iy = y0 + rise * prof(t) + yl, iz = (bb + ext) * sgnZ;
      const ox = lerp(AW + curl, rh, t) * sgnX;
      const oz = lerp(AD + curl, gd, t) * sgnZ;
      const oy = lerp(y0 + lift, gy, t);
      for (let ui = 0; ui <= segU; ui++) {
        const u = ui / segU;
        pos.push(lerp(ix, ox, u), lerp(iy, oy, u), lerp(iz, oz, u));
        uvs.push(t * (2 * AD / tile) + 2, u * 3);
      }
    }
    for (let si = 0; si < segS; si++) {
      for (let ui = 0; ui < segU; ui++) {
        const a = si * cols + ui, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return finishGeo(pos, uvs, idx);
  }
  for (const sgnX of [1, -1]) {
    for (const sgnZ of [1, -1]) {
      const g = bandGeo(sgnX, sgnZ);
      if (o.batch) {
        BATCH.add(g, mat);
        g.dispose();
      } else {
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  }

  /* ---------- 山花（垂直三角）+ 博风板 ---------- */
  const panelMat = MATS.gablePanel || MATS.wall;
  for (const sgn of [1, -1]) {
    const x = sgn * rh;
    const pos = [x, y1 - 0.02, 0, x, gy - 0.1, -gd, x, gy - 0.1, gd];
    const uv = [0.5, 1, 0, 0, 1, 0];
    const idx = sgn > 0 ? [0, 2, 1] : [0, 1, 2];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, panelMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material.side = THREE.DoubleSide;
    group.add(mesh);

    /* 博风板：山花两侧斜边 */
    for (const sz of [1, -1]) {
      const z0 = 0, yA = y1;
      const z1 = sz * gd, yB = gy;
      const dz = z1 - z0, dy = yB - yA;
      const len = Math.hypot(dz, dy);
      const ang = Math.atan2(dy, dz);
      const cx = x + sgn * 0.12, cy = (yA + yB) / 2, cz = (z0 + z1) / 2;
      /* 歇山山花被屋面遮住时，博风板会悬空；此处不绘制博风板（由撒山瓦带表现山面边缘） */
    }
    /* 悬鱼：歇山山花不可见时不绘制，避免悬空 */
  }

  /* ---------- 正脊 + 鸱吻 ---------- */
  if (o.ridgeTop !== false) {
    const ridgeH = o.ridgeH || 0.95, ridgeW = o.ridgeW || 0.9;
    GEOM.box(2 * rh + 1.2, ridgeH, ridgeW, MATS.ridge, 0, y1 + ridgeH * 0.33, 0);
    const cw = GEOM.chowenGeo();
    const sc = o.chowenScale || 1.0;
    for (const side of [1, -1]) {
      const px = side * (rh + 0.55) - side * 0.55 * sc;
      const py = y1 + 0.55;
      if (o.batch) {
        BATCH.add(cw, MATS.ridge, GEOM.mat4(px, py, 0, 0, side > 0 ? Math.PI : 0, 0, sc, sc, sc));
      } else {
        const m = new THREE.Mesh(cw, MATS.ridge);
        m.scale.set(sc, sc, sc);
        m.position.set(px, py, 0);
        m.rotation.y = side > 0 ? Math.PI : 0;
        m.castShadow = true;
        group.add(m);
      }
    }
  }

  /* ---------- 垂脊 / 戗脊（沿前坡边缘 + 撒山外缘） ---------- */
  function ridgePts(fn) {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(fn(i / 16));
    return pts;
  }
  for (const sgnX of [1, -1]) {
    for (const sgnZ of [1, -1]) {
      /* 前/后坡角脊：檐角 → 正脊端 */
      const ptsA = ridgePts(function (t) {
        const s = t, ex = 1;
        const ext = curl * Math.pow(1 - s, 2.2);
        const yl = lift * Math.pow(1 - s, 2.6);
        return new THREE.Vector3(
          sgnX * (lerp(AW, rh, s) + ext),
          y0 + rise * prof(s) + yl,
          sgnZ * (lerp(AD, 0, s) + ext)
        );
      });
      const tubeA = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsA), 24, o.ridgeR || 0.24, 6, false);
      if (o.batch) { BATCH.add(tubeA, MATS.ridge); tubeA.dispose(); }
      else { const m = new THREE.Mesh(tubeA, MATS.ridge); m.castShadow = true; group.add(m); }

      /* 撒山外缘：檐角 → 山花底角 */
      const ptsB = ridgePts(function (t) {
        return new THREE.Vector3(
          sgnX * lerp(AW + curl, rh, t),
          lerp(y0 + lift, gy, t),
          sgnZ * lerp(AD + curl, gd, t)
        );
      });
      const tubeB = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsB), 20, (o.ridgeR || 0.24) * 0.8, 6, false);
      if (o.batch) { BATCH.add(tubeB, MATS.ridge); tubeB.dispose(); }
      else { const m = new THREE.Mesh(tubeB, MATS.ridge); m.castShadow = true; group.add(m); }
    }
  }

  /* ---------- 走兽（沿角脊） ---------- */
  if (o.beasts && o.beasts > 0) {
    const beastGeo = GEOM.beastGeo();
    for (const sgnX of [1, -1]) {
      for (const sgnZ of [1, -1]) {
        const curve = new THREE.CatmullRomCurve3(ridgePts(function (t) {
          const s = 1 - t * 0.22;
          const ex = 1;
          const ext = curl * Math.pow(1 - s, 2.2);
          const yl = lift * Math.pow(1 - s, 2.6);
          return new THREE.Vector3(
            sgnX * (lerp(AW, rh, s) + ext),
            y0 + rise * prof(s) + yl,
            sgnZ * (lerp(AD, 0, s) + ext)
          );
        }));
        for (let k = 0; k < o.beasts; k++) {
          const p = curve.getPointAt(k / Math.max(1, o.beasts - 1) * 0.9 + 0.02);
          const m = new THREE.Matrix4().makeTranslation(p.x, p.y + 0.16, p.z);
          BATCH.add(beastGeo, MATS.goldDark, m);
        }
      }
    }
  }

  /* ---------- 檐下阴影板 ---------- */
  if (o.soffit) GEOM.soffit(AW + 0.3, AD + 0.3, o.soffit[0], o.soffit[1], y0 - 0.04, group, o.soffitMat, o.batch);

  return group;
};
