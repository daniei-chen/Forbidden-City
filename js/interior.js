/* =============================================================
 *  紫禁城 · 数字复原  —  建筑内部
 *  太和殿室内：金砖地面 / 缠龙金柱 / 宝座屏风 / 藻井天花 / 和玺彩画
 * ============================================================= */
const INTERIOR = {};

INTERIOR.taihe = function (root) {
  const cx = 0, cz = 58.5;
  const floorY = 10.63;              // 月台 9.63 + 殿身台基 1.0
  const ix = 29.4, iz = 16.2;        // 室内半宽 / 半深
  const ceilY = 19.5;
  const g = new THREE.Group();
  root.add(g);

  /* ---------------- 地面：金砖 ---------------- */
  const floorMat = new THREE.MeshStandardMaterial({
    map: MATS.paving.map.clone(), color: 0x9c988c, roughness: 0.72, metalness: 0.04
  });
  floorMat.map.repeat.set(10, 6);
  floorMat.map.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ix * 2, 0.14, iz * 2), floorMat);
  floor.position.set(cx, floorY - 0.07, cz);
  floor.receiveShadow = true;
  g.add(floor);

  /* ---------------- 四壁 ---------------- */
  const wallMat = new THREE.MeshStandardMaterial({
    map: TEX.wall(), color: 0xb98f7c, roughness: 0.85
  });
  const wallH = ceilY - floorY;
  const addWall = function (w, x, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), wallMat);
    m.position.set(x, floorY + wallH / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
  };
  addWall(ix * 2, cx, cz - iz, 0);                 // 北墙（面向南）
  addWall(ix * 2, cx, cz + iz, Math.PI);           // 南墙
  addWall(iz * 2, cx + ix, cz, -Math.PI / 2);      // 东墙
  addWall(iz * 2, cx - ix, cz, Math.PI / 2);       // 西墙

  /* 南墙内侧的门（隔扇） */
  const doorMat = new THREE.MeshStandardMaterial({ map: TEX.facade(11), roughness: 0.62 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(ix * 1.7, wallH * 0.72), doorMat);
  door.position.set(cx, floorY + wallH * 0.42, cz + iz - 0.05);
  door.rotation.y = Math.PI;
  g.add(door);

  /* ---------------- 额枋彩画（四面环带） ---------------- */
  const caihuaMat = MATS.caihua;
  const bandH = 1.5, bandY = floorY + wallH - bandH - 0.1;
  const addBand = function (w, x, z, ry) {
    const geo = new THREE.PlaneGeometry(w, bandH);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 4.2));
    const m = new THREE.Mesh(geo, caihuaMat);
    m.position.set(x, bandY + bandH / 2, z);
    m.rotation.y = ry;
    g.add(m);
  };
  addBand(ix * 2, cx, cz - iz + 0.06, 0);
  addBand(ix * 2, cx, cz + iz - 0.06, Math.PI);
  addBand(iz * 2, cx + ix - 0.06, cz, -Math.PI / 2);
  addBand(iz * 2, cx - ix + 0.06, cz, Math.PI / 2);

  /* ---------------- 天花 ---------------- */
  const cofferMat = new THREE.MeshStandardMaterial({ map: TEX.coffer(), roughness: 0.7 });
  cofferMat.map.repeat.set(8, 5);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(ix * 2, 0.3, iz * 2), cofferMat);
  ceil.position.set(cx, ceilY + 0.15, cz);
  g.add(ceil);

  /* 梁（东西向） */
  const beamMat = MATS.caihua;
  for (let k = -2; k <= 2; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ix * 2, 1.0, 0.7), beamMat);
    m.position.set(cx, ceilY - 0.55, cz + k * 6.2);
    g.add(m);
  }

  /* ---------------- 藻井（宝座上方） ---------------- */
  const zaoy = floorY + 8.7;
  const rings = [
    { w: 9.0, h: 0.55, y: 0.0 },
    { w: 7.4, h: 0.55, y: 0.55 },
    { w: 5.9, h: 0.55, y: 1.1 },
    { w: 4.5, h: 0.55, y: 1.65 }
  ];
  for (const r of rings) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.w), MATS.goldDark);
    box.position.set(cx, zaoy + r.y, cz - 8.0);
    g.add(box);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(r.w - 0.9, r.h + 0.1, r.w - 0.9), cofferMat);
    inner.position.set(cx, zaoy + r.y + 0.02, cz - 8.0);
    g.add(inner);
  }
  const medallionMat = new THREE.MeshStandardMaterial({ map: TEX.dragon(), color: 0xc9a54a, roughness: 0.45, metalness: 0.5 });
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), medallionMat);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(cx, zaoy + 2.25, cz - 8.0);
  g.add(medallion);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), MATS.gold);
  boss.position.set(cx, zaoy + 2.0, cz - 8.0);
  g.add(boss);

  /* ---------------- 缠龙金柱（六根） ---------------- */
  const goldColMat = new THREE.MeshStandardMaterial({
    color: 0xb58a36, roughness: 0.42, metalness: 0.72
  });
  const colH = ceilY - floorY - 0.2;
  for (const sx of [-1, 1]) {
    for (const k of [5.5, 11.5, 17.5]) {
      const x = sx * k, z = cz - 4.5;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, colH, 16), goldColMat);
      col.position.set(cx + x, floorY + colH / 2, z);
      col.castShadow = true;
      g.add(col);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.45, 16), MATS.marbleRail);
      drum.position.set(cx + x, floorY + 0.22, z);
      g.add(drum);
    }
  }
  /* 两侧朱红柱列 */
  for (let k = -2; k <= 2; k++) {
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, colH, 12), MATS.column);
      col.position.set(cx + sx * 26.5, floorY + colH / 2, cz + k * 6.2);
      g.add(col);
    }
  }

  /* ---------------- 宝座台基 ---------------- */
  const platY = floorY + 0.65;
  const platMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.6, metalness: 0.05 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.2, 5.6), platMat);
  plat.position.set(cx, platY, cz - 10.8);
  const platTrim = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.16, 5.9), MATS.goldDark);
  platTrim.position.set(cx, platY + 0.62, cz - 10.8);
  g.add(platTrim);
  plat.castShadow = true; plat.receiveShadow = true;
  g.add(plat);
  /* 台阶 */
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.26, 0.6), MATS.marbleRail);
    st.position.set(cx, floorY + 0.12 + i * 0.24, cz - 7.6 - i * 0.55);
    g.add(st);
  }

  /* 红毯 */
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x6e1a14, roughness: 0.9 });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 21), carpetMat);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(cx, floorY + 0.02, cz - 1.5);
  g.add(carpet);
  const carpetTrim = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 21.3), MATS.goldDark);
  carpetTrim.rotation.x = -Math.PI / 2;
  carpetTrim.position.set(cx, floorY + 0.015, cz - 1.5);
  g.add(carpetTrim);

  /* ---------------- 宝座 ---------------- */
  const throne = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xb08430, roughness: 0.35, metalness: 0.7 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x7c1d15, roughness: 0.6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.0), seatMat);
  seat.position.set(0, 1.55, 0);
  throne.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.4, 0.28), seatMat);
  back.position.set(0, 2.85, -0.86);
  throne.add(back);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 1.9), seatMat);
    arm.position.set(sx * 1.25, 2.05, -0.05);
    throne.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), redMat);
    leg.position.set(sx * 1.05, 0.95, 0.7);
    throne.add(leg);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), redMat);
    leg2.position.set(sx * 1.05, 0.95, -0.7);
    throne.add(leg2);
  }
  /* 靠背龙纹 */
  const backDeco = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7), new THREE.MeshStandardMaterial({
    map: TEX.dragon(), color: 0xbfa05a, roughness: 0.5, metalness: 0.35
  }));
  backDeco.position.set(0, 2.9, -0.7);
  throne.add(backDeco);
  throne.position.set(cx, floorY + 1.2, cz - 10.8);
  throne.scale.set(0.92, 0.92, 0.92);
  g.add(throne);

  /* ---------------- 屏风（五扇） ---------------- */
  const screenMat = new THREE.MeshStandardMaterial({
    map: TEX.lattice('dark'), color: 0x9a6a3a, roughness: 0.5, metalness: 0.25
  });
  for (let i = -2; i <= 2; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.35, 3.6, 0.14), screenMat);
    panel.position.set(cx + i * 1.42, floorY + 2.0, cz - 14.2);
    panel.rotation.y = -i * 0.06;
    g.add(panel);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.2), MATS.goldDark);
    trim.position.set(cx + i * 1.42, floorY + 3.85, cz - 14.2);
    g.add(trim);
  }

  /* ---------------- 匾额 ---------------- */
  const plaqueMat = new THREE.MeshStandardMaterial({ map: TEX.plaque('建极绥猷'), roughness: 0.72, metalness: 0.1 });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2), plaqueMat);
  plaque.position.set(cx, floorY + 6.4, cz - iz + 0.22);
  g.add(plaque);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.6, 0.2), MATS.plaqueFrame);
  frame.position.set(cx, floorY + 6.4, cz - iz + 0.05);
  g.add(frame);

  /* ---------------- 香炉（一对） ---------------- */
  for (const sx of [-1, 1]) {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.75, 12), MATS.bronze);
    body.position.y = 1.0;
    c.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 12), MATS.bronze);
    lid.position.y = 1.45;
    c.add(lid);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), MATS.bronze);
      leg.position.set(Math.cos(a) * 0.32, 0.35, Math.sin(a) * 0.32);
      c.add(leg);
    }
    c.position.set(cx + sx * 5.4, floorY + 1.3, cz - 8.2);
    g.add(c);
  }

  /* ---------------- 室内暖光 ---------------- */
  const warm = new THREE.PointLight(0xffd3a0, 0.75, 62, 1.6);
  warm.position.set(cx, ceilY - 1.2, cz - 6);
  g.add(warm);


  INTERIOR.register(g, cx, cz, 78);
  BUILD.addColliderRect(-4.4, 44.9, 4.4, 50.5);
  return g;
};

/* =============================================================
 *  通用殿内（中和殿 / 保和殿 / 太和门 / 乾清门 / 乾清宫 / 坤宁宫）
 * ============================================================= */
INTERIOR.registry = INTERIOR.registry || [];

INTERIOR.register = function (group, cx, cz, radius) {
  group.visible = false;
  INTERIOR.registry.push({ group: group, x: cx, z: cz, r: radius });
};

INTERIOR.updateVisibility = function (camera) {
  const list = INTERIOR.registry;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const dx = camera.position.x - e.x, dz = camera.position.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    e.group.visible = d < e.r;
  }
};

INTERIOR.hall = function (o) {
  const rootRef = BUILD.parent;
  const cx = o.x, cz = o.z, fy = o.floorY;
  const bw = o.bw, bd = o.bd, H = o.bodyH;
  const hw = bw / 2 - 1.6, hd = bd / 2 - 1.6;
  const g = new THREE.Group();
  rootRef.add(g);

  /* 地面 */
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.12, hd * 2), MATS.innerFloor);
  floor.position.set(cx, fy - 0.06, cz);
  floor.receiveShadow = true;
  g.add(floor);

  /* 四壁 */
  const wallH = H - 1.5;
  const addWall = function (w, wx, wz, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), MATS.innerWall);
    m.position.set(wx, fy + wallH / 2, wz);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
  };
  addWall(hw * 2, cx, cz - hd, 0);
  addWall(hw * 2, cx, cz + hd, Math.PI);
  addWall(hd * 2, cx + hw, cz, -Math.PI / 2);
  addWall(hd * 2, cx - hw, cz, Math.PI / 2);

  /* 天花 + 梁枋 */
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.25, hd * 2), MATS.coffer);
  ceil.position.set(cx, fy + H - 1.2, cz);
  g.add(ceil);
  for (let k = -1; k <= 1; k++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.8, 0.5), MATS.caihua);
    beam.position.set(cx, fy + H - 1.75, cz + k * hd * 0.5);
    g.add(beam);
  }

  /* 额枋彩画带（四面） */
  const bandH2 = 0.95;
  const bandY2 = fy + H - 2.15;
  const addBand2 = function (w, wx, wz, ry) {
    const geo = new THREE.PlaneGeometry(w, bandH2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 4.2));
    const m = new THREE.Mesh(geo, MATS.caihua);
    m.position.set(wx, bandY2, wz);
    m.rotation.y = ry;
    g.add(m);
  };
  addBand2(hw * 2, cx, cz - hd + 0.07, 0);
  addBand2(hw * 2, cx, cz + hd - 0.07, Math.PI);
  addBand2(hd * 2, cx + hw - 0.07, cz, -Math.PI / 2);
  addBand2(hd * 2, cx - hw + 0.07, cz, Math.PI / 2);

  /* 柱列 */
  const colH = H - 1.6;
  const nCol = Math.max(4, Math.round(bw / 6));
  for (let i = 0; i < nCol; i++) {
    const x = cx - hw + (hw * 2) * (i + 0.5) / nCol;
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, colH, 12), MATS.column);
      col.position.set(x, fy + colH / 2, cz + sz * (hd - 0.8));
      g.add(col);
    }
  }

  /* 缠龙金柱（等级 ≥2）：宝座两侧四根 */
  if (o.rank >= 2) {
    const goldColMat = new THREE.MeshStandardMaterial({ color: 0xb58a36, roughness: 0.42, metalness: 0.7 });
    const gcH = H - 2.0;
    for (const sx of [-1, 1]) {
      for (const k of [-1, 0]) {
        const x = cx + sx * hw * 0.55;
        const z = cz + k * hd * 0.35 - hd * 0.1;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, gcH, 14), goldColMat);
        col.position.set(x, fy + gcH / 2, z);
        g.add(col);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.64, 0.35, 14), MATS.marbleRail);
        drum.position.set(x, fy + 0.17, z);
        g.add(drum);
      }
    }
  }

  /* 宫灯（悬挂，金属+暖光） */
  for (const sx of [-1, 1]) {
    const lx = cx + sx * hw * 0.45;
    const lz = cz + hd * 0.18;
    const ly = fy + H - 2.2;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), MATS.trunk);
    cord.position.set(lx, ly + 1.1, lz);
    g.add(cord);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xc9a24a, roughness: 0.4, metalness: 0.4,
      emissive: 0xffc46a, emissiveIntensity: 0.55
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), lampMat);
    lamp.position.set(lx, ly, lz);
    g.add(lamp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.16, 10), MATS.goldDark);
    cap.position.set(lx, ly + 0.45, lz);
    g.add(cap);
  }

  /* 铜香炉一对（等级 ≥2） */
  if (o.rank >= 2) {
    const bronze = MATS.bronze || MATS.goldDark;
    for (const sx of [-1, 1]) {
      const bx = cx + sx * hw * 0.72;
      const bz = cz - hd * 0.35;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.42, 12), bronze);
      body.position.set(bx, fy + 0.21, bz);
      g.add(body);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.12, 12), bronze);
      foot.position.set(bx, fy + 0.06, bz);
      g.add(foot);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), bronze);
      lid.position.set(bx, fy + 0.52, bz);
      g.add(lid);
    }
  }

  /* 屏风（等级 ≥2） */
  if (o.rank >= 2) {
    const screenMat = new THREE.MeshStandardMaterial({
      map: TEX.lattice('dark'), color: 0x8a5a34, roughness: 0.55, metalness: 0.2
    });
    for (let i = -2; i <= 2; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.2, 0.12), screenMat);
      p.position.set(cx + i * 1.38, fy + 1.8, cz - hd + 1.2);
      g.add(p);
    }
  }

  /* 宝座 + 台基（等级 ≥2） */
  if (o.rank >= 2) {
    const platMat = new THREE.MeshStandardMaterial({ color: 0x7f2a1e, roughness: 0.62 });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.0, 4.2), platMat);
    plat.position.set(cx, fy + 0.5, cz - hd * 0.42);
    g.add(plat);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.45, metalness: 0.5 });
    const platTop = fy + 1.0;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.7), seatMat);
    seat.position.set(cx, platTop + 0.25, cz - hd * 0.42);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.7, 0.22), seatMat);
    back.position.set(cx, platTop + 1.35, cz - hd * 0.42 - 0.78);
    g.add(back);
    /* 靠背团龙 */
    const medMat = new THREE.MeshStandardMaterial({
      map: TEX.dragon(), color: 0xc9a54a, roughness: 0.5, metalness: 0.35
    });
    const med = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), medMat);
    med.position.set(cx, platTop + 1.4, cz - hd * 0.42 - 0.66);
    g.add(med);
    /* 扶手 */
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 1.5), seatMat);
      arm.position.set(cx + sx * 1.06, platTop + 0.72, cz - hd * 0.42);
      g.add(arm);
    }
    /* 金边 */
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.9), MATS.goldDark);
    trim.position.set(cx, platTop + 0.02, cz - hd * 0.42);
    g.add(trim);
    /* 台阶 */
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.55), MATS.marbleRail);
      st.position.set(cx, fy + 0.15 + i * 0.3, cz - hd * 0.42 + 2.1 + (2 - i) * 0.55);
      g.add(st);
    }
    BUILD.addColliderRect(cx - 3.4, cz - hd * 0.42 - 2.5, cx + 3.4, cz - hd * 0.42 + 2.5);
  }

  /* 藻井（等级 ≥2） */
  if (o.rank >= 2) {
    const y0 = fy + H - 1.2;
    for (let i = 0; i < 3; i++) {
      const w = 5.4 - i * 1.3;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, w), MATS.goldDark);
      ring.position.set(cx, y0 + 0.25 + i * 0.5, cz - hd * 0.42);
      g.add(ring);
    }
    const medal = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshStandardMaterial({
      map: TEX.dragon(), color: 0xc9a54a, roughness: 0.5, metalness: 0.4
    }));
    medal.rotation.x = Math.PI / 2;
    medal.position.set(cx, y0 + 1.85, cz - hd * 0.42);
    g.add(medal);
  }

  /* 匾额 */
  if (o.plaque) {
    const plaqueMat = new THREE.MeshStandardMaterial({ map: TEX.plaque(o.inscription || o.plaque), roughness: 0.7, metalness: 0.12 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), plaqueMat);
    pl.position.set(cx, fy + wallH - 1.1, cz - hd + 0.17);
    g.add(pl);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.45, 0.14), MATS.plaqueFrame);
    fr.position.set(cx, fy + wallH - 1.1, cz - hd + 0.04);
    g.add(fr);
  }

  /* 红毯 */
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, hd * 1.5), new THREE.MeshStandardMaterial({
    color: 0x6b1a13, roughness: 0.92, emissive: 0x140805, emissiveIntensity: 0.6
  }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(cx, fy + 0.02, cz + hd * 0.15);
  g.add(carpet);

  INTERIOR.register(g, cx, cz, Math.max(bw, bd) * 0.9 + 30);
  return g;
};

INTERIOR.buildAll = function (root) {
  const list = [
    { x: 0, z: -2, floorY: 9.33, bw: 24, bd: 24, bodyH: 8.4, name: '中和殿', plaque: '中和殿', inscription: '允执厥中', rank: 2 },
    { x: 0, z: -56.5, floorY: 9.43, bw: 49.7, bd: 25, bodyH: 8.8, name: '保和殿', plaque: '保和殿', inscription: '皇建有极', rank: 3 },
    { x: 0, z: 280, floorY: 1.8, bw: 34, bd: 14, bodyH: 8.6, name: '太和门', plaque: '太和门', inscription: '太和门', rank: 2 },
    { x: 0, z: -140, floorY: 1.7, bw: 22, bd: 10, bodyH: 6.4, name: '乾清门', plaque: '乾清门', inscription: '乾清门', rank: 1 },
    { x: 0, z: -196, floorY: 1.5, bw: 38, bd: 18, bodyH: 7.6, name: '乾清宫', plaque: '乾清宫', inscription: '正大光明', rank: 3 },
    { x: 0, z: -244, floorY: 1.3, bw: 30, bd: 14, bodyH: 6.8, name: '坤宁宫', plaque: '坤宁宫', inscription: '位正坤元', rank: 2 }
  ];
  for (let i = 0; i < list.length; i++) INTERIOR.hall(list[i]);
};

if (typeof window !== 'undefined') window.__INTERIOR = INTERIOR;
