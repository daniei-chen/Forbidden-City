/* =============================================================
 *  紫禁城 · 数字复原  —  材质库
 *  额外能力：
 *   · 雪覆盖（onBeforeCompile 注入 uSnow，无需复制几何）
 *   · 夜间窗光（emissiveMap 复用立面/菱花贴图）
 * ============================================================= */
const MATS = {};

MATS.init = function () {
  const S = (p) => new THREE.MeshStandardMaterial(p);

  MATS.snowMats = [];
  MATS.nightMats = [];

  /* ---- 木构 / 墙体 ---- */
  MATS.wall = S({ map: TEX.wall(), color: 0xffffff, roughness: 0.86, metalness: 0.0 });
  MATS.wall.map.repeat.set(3, 2);
  MATS.brick = S({ map: TEX.brick(), color: 0xd9c0b8, roughness: 0.9 });
  MATS.column = S({ color: 0xa83a2c, roughness: 0.52, metalness: 0.05 });
  MATS.columnDark = S({ color: 0x5f170f, roughness: 0.6 });
  MATS.beam = S({ color: 0x1e4a4a, roughness: 0.6, metalness: 0.15 });
  MATS.facade9 = S({ map: TEX.facade(9), roughness: 0.62, metalness: 0.05 });
  MATS.facade = MATS.facade9;
  MATS.facade11 = S({ map: TEX.facade(11), roughness: 0.62, metalness: 0.05 });
  MATS.facade7 = S({ map: TEX.facade(7), roughness: 0.62, metalness: 0.05 });
  MATS.facade5 = S({ map: TEX.facade(5), roughness: 0.62, metalness: 0.05 });
  MATS.lattice = S({ map: TEX.lattice(), roughness: 0.6, metalness: 0.08 });
  MATS.latticeDark = S({ map: TEX.lattice('dark'), roughness: 0.6, metalness: 0.08 });
  MATS.dougong = S({ map: TEX.dougong(), roughness: 0.6, metalness: 0.12 });
  MATS.caihua = S({ map: TEX.caihua(), roughness: 0.55, metalness: 0.2 });

  /* ---- 屋顶 ---- */
  MATS.roof = S({
    map: TEX.roof(), color: 0xfff3d6, roughness: 0.46, metalness: 0.28,
    side: THREE.FrontSide
  });
  MATS.roofBlack = new THREE.MeshStandardMaterial({
    map: TEX.roof(), color: 0x3a4148, roughness: 0.5, metalness: 0.2,
    bumpMap: TEX.bumpRoof(), bumpScale: 0.09
  });
  MATS.rafter = new THREE.MeshStandardMaterial({ color: 0x6b2a22, roughness: 0.85 });
  MATS.ridge = S({ color: 0x6b4513, roughness: 0.5, metalness: 0.3 });
  MATS.gold = S({ color: 0xd9b45a, roughness: 0.28, metalness: 0.9 });
  MATS.goldDark = S({ color: 0xa9853c, roughness: 0.38, metalness: 0.8 });
  MATS.soffit = S({ color: 0x4a2418, roughness: 0.95 });
  MATS.gablePanel = S({ map: TEX.wall(), color: 0xcfb2a4, roughness: 0.82, side: THREE.DoubleSide });
  MATS.plaqueFrame = S({ color: 0xa9853c, roughness: 0.4, metalness: 0.7 });

  /* ---- 石作 ---- */
  MATS.marble = S({ map: TEX.marble(), color: 0xe9e2d2, roughness: 0.76, metalness: 0.02 });
  MATS.marble.map.repeat.set(1, 1);
  MATS.marbleRail = S({ map: TEX.marble(), color: 0xe6dfcf, roughness: 0.9, metalness: 0.0 });
  (function () {
    const pt = TEX.paving().clone();
    pt.repeat.set(2, 26);
    pt.needsUpdate = true;
    MATS.path = S({ map: pt, color: 0xd8d0c0, roughness: 0.95, metalness: 0.0 });
  })();
  MATS.terraceTop = S({ map: TEX.marble(), color: 0xc4baa3, roughness: 0.88 });
  MATS.paving = S({ map: TEX.paving(), color: 0xe4e2da, roughness: 0.9 });
  MATS.paving.map.repeat.set(172, 172);
  MATS.paving.map.anisotropy = 8;
  MATS.dragon = S({ map: TEX.dragon(), color: 0xf4efe2, roughness: 0.8 });
  MATS.stoneDark = S({ color: 0x6e6a60, roughness: 0.95 });
  MATS.rock = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.96, flatShading: true });
  MATS.aoDecal = new THREE.MeshBasicMaterial({
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
    map: TEX.aoBlob(), transparent: true, opacity: 0.32,
    depthWrite: false, color: 0x000000
  });

  /* ---- 金属 / 其他 ---- */
  MATS.bronze = S({ color: 0x6f5f3e, roughness: 0.45, metalness: 0.75 });
  MATS.bronzeGreens = S({ color: 0x5b6b52, roughness: 0.55, metalness: 0.6 });
  MATS.ironGate = S({ color: 0x241510, roughness: 0.85 });

  /* ---- 自然 ---- */
  MATS.trunk = S({ color: 0x584234, roughness: 0.95 });
  MATS.leaf = S({ color: 0x2f4a2c, roughness: 0.92 });
  MATS.leafDark = S({ color: 0x26402a, roughness: 0.94 });
  MATS.leafLight = S({ color: 0x3f5f35, roughness: 0.92 });
  MATS.grass = S({ color: 0x6e7060, roughness: 1.0 });
  MATS.water = S({
    map: TEX.water(), color: 0xb6cdd3, roughness: 0.16, metalness: 0.28
  });
  MATS.water.map.repeat.set(1, 1);

  /* ---- 室内 ---- */
  MATS.coffer = S({ map: TEX.coffer(), color: 0xffffff, roughness: 0.72, emissive: 0x18211f, emissiveIntensity: 0.7 });
  MATS.innerWall = S({ map: TEX.wall(), color: 0xc79380, roughness: 0.86, emissive: 0x2a120c, emissiveIntensity: 0.75 });
  (function () {
    const ip = TEX.paving().clone();
    ip.repeat.set(9, 6);
    ip.needsUpdate = true;
    MATS.innerFloor = S({ map: ip, color: 0xa8a294, roughness: 0.7, emissive: 0x161410, emissiveIntensity: 0.55 });
  })();

  /* ---- 风化污渍 ---- */
  MATS.stain = new THREE.MeshBasicMaterial({
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    map: TEX.stain(), transparent: true, opacity: 0.55,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2
  });

  /* ---- 接地 AO / 云影 ---- */
  MATS.moss = new THREE.MeshStandardMaterial({
    map: TEX.stain(), color: 0x4a5c36, roughness: 1.0, metalness: 0.0,
    transparent: true, opacity: 0.42, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -2
  });
  MATS.leafCard = new THREE.MeshStandardMaterial({
    map: TEX.leafCard(), alphaTest: 0.45, transparent: false,
    side: THREE.DoubleSide, roughness: 0.92, metalness: 0.0, color: 0xffffff
  });
  MATS.fallenLeaf = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1.0, metalness: 0.0 });
  MATS.fallenLeaf2 = new THREE.MeshStandardMaterial({ color: 0xa98a52, roughness: 1.0, metalness: 0.0 });

  MATS.aoStrip = new THREE.MeshBasicMaterial({
    map: TEX.aoStrip(), transparent: true, opacity: 0.5,
    depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8
  });
  MATS.cloudShadow = new THREE.MeshBasicMaterial({
    map: TEX.cloudShadow(), color: 0x000000, transparent: true, opacity: 0.10,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10
  });

  /* ---- 凹凸贴图 ---- */
  (function () {
    const setBump = function (mat, tex, scale) {
      mat.bumpMap = tex;
      mat.bumpScale = scale;
      mat.needsUpdate = true;
    };
    setBump(MATS.roof, TEX.bumpRoof(), 0.09);
    const bp = TEX.bumpPaving().clone();
    bp.repeat.set(172, 172);
    bp.needsUpdate = true;
    setBump(MATS.paving, bp, 0.05);
    const bm = TEX.bumpMarble().clone();
    bm.needsUpdate = true;
    setBump(MATS.marble, bm, 0.02);
    const bm2 = TEX.bumpMarble().clone();
    bm2.needsUpdate = true;
    setBump(MATS.marbleRail, bm2, 0.02);
    setBump(MATS.marbleRail, TEX.bumpRail(), 0.012);
    const bw = TEX.bumpWall().clone();
    bw.repeat.set(3, 2);
    bw.needsUpdate = true;
    setBump(MATS.wall, bw, 0.03);
    const bwood = TEX.bumpWood().clone();
    bwood.repeat.set(2, 6);
    bwood.needsUpdate = true;
    setBump(MATS.column, bwood, 0.015);
  })();

  /* ---- 雪覆盖（强度 / 雪后粗糙度） ---- */
  MATS.addSnow(MATS.roof, 0.82, 0.9);
  MATS.addSnow(MATS.ridge, 0.62, 0.9);
  MATS.addSnow(MATS.paving, 0.58, 0.94);
  MATS.addSnow(MATS.grass, 0.88, 0.96);
  MATS.addSnow(MATS.marble, 0.32, 0.9);
  MATS.addSnow(MATS.marbleRail, 0.36, 0.9);
  MATS.addSnow(MATS.terraceTop, 0.62, 0.92);
  MATS.addSnow(MATS.dragon, 0.5, 0.9);
  MATS.addSnow(MATS.leaf, 0.22, 0.95);
  MATS.addSnow(MATS.leafLight, 0.22, 0.95);
  MATS.addSnow(MATS.trunk, 0.24, 0.95);

  /* ---- 夜间窗光 ---- */
  MATS.addNightGlow(MATS.facade9, 0.95);
  MATS.addNightGlow(MATS.facade11, 0.95);
  MATS.addNightGlow(MATS.facade7, 0.95);
  MATS.addNightGlow(MATS.facade5, 0.95);
  MATS.addNightGlow(MATS.lattice, 0.9);
  MATS.addNightGlow(MATS.latticeDark, 0.8);
  MATS.addNightGlow(MATS.caihua, 0.32);
  MATS.addNightGlow(MATS.dougong, 0.22);
};

/* =============================================================
 *  雪：向标准材质注入 uSnow，按强度把颜色/粗糙度混合到雪白
 * ============================================================ */
MATS.addSnow = function (mat, strength, rough) {
  const s = (strength == null ? 0.8 : strength).toFixed(3);
  const r = (rough == null ? 0.9 : rough).toFixed(3);
  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uSnow = { value: 0 };
    mat.userData.uSnow = shader.uniforms.uSnow;
    shader.fragmentShader = 'uniform float uSnow;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n' +
      '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * ' + s + ');'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n' +
      '  roughnessFactor = mix(roughnessFactor, ' + r + ', uSnow * ' + s + ');'
    );
  };
  mat.customProgramCacheKey = function () { return 'snow_' + s + '_' + r; };
  mat.needsUpdate = true;
  MATS.snowMats.push(mat);
};

MATS.setSnow = function (v) {
  for (let i = 0; i < MATS.snowMats.length; i++) {
    const u = MATS.snowMats[i].userData.uSnow;
    if (u) u.value = v;
  }
};

/* =============================================================
 *  夜间窗光
 * ============================================================ */
MATS.addNightGlow = function (mat, intensity) {
  if (!mat.map) return;
  mat.emissive = new THREE.Color(0xffc98a);
  mat.emissiveMap = mat.map;
  mat.emissiveIntensity = 0;
  mat.userData.glowMax = intensity == null ? 0.9 : intensity;
  MATS.nightMats.push(mat);
};

MATS.setNightGlow = function (v) {
  for (let i = 0; i < MATS.nightMats.length; i++) {
    const m = MATS.nightMats[i];
    m.emissiveIntensity = v * (m.userData.glowMax || 0.9);
  }
};

/* 匾额材质工厂（每个殿不同文字） */
MATS.plaque = function (text) {
  const key = 'plaque_' + text;
  if (!MATS[key]) {
    MATS[key] = new THREE.MeshStandardMaterial({
      map: TEX.plaque(text), roughness: 0.45, metalness: 0.35
    });
  }
  return MATS[key];
};
