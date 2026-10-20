/* =============================================================
 *  紫禁城 · 数字复原  v2  —  渲染 / 交互 / 主题 / 巡礼
 * ============================================================= */
(function () {
  'use strict';

  if (THREE.ColorManagement && THREE.ColorManagement.legacyMode !== undefined) {
    THREE.ColorManagement.legacyMode = false;
  }

  const $ = function (id) { return document.getElementById(id); };
  const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  const errors = [];
  window.__errors = errors;

  window.addEventListener('error', function (e) {
    window.__err = (e.message || 'error') + ' @' + (e.filename || '') + ':' + (e.lineno || '');
    errors.push(window.__err);
    const ld = $('loader');
    if (ld) {
      ld.classList.remove('hide');
      ld.innerHTML = '<div class="ls" style="letter-spacing:2px;color:#e8a">运 行 错 误</div>' +
        '<pre style="max-width:78vw;max-height:60vh;overflow:auto;white-space:pre-wrap;color:#f99;font-size:12px;text-align:left">' +
        window.__err + '</pre>';
    }
  });

  function fatal(msg) {
    const ld = $('loader');
    if (ld) {
      ld.classList.remove('hide');
      ld.innerHTML = '<div class="ls" style="letter-spacing:4px;color:#e8a">无 法 启 动</div>' +
        '<div style="font-size:12px;color:#b9b2a2;max-width:80vw;text-align:center;line-height:2">' + msg + '</div>';
    }
  }

  /* =========================================================
   *  设置（localStorage 持久化）
   * ======================================================= */
  const DEFAULTS = {
    quality: 'auto', fps: false, shadows: true, clouds: true,
    cinema: false, labels: false, theme: 'day', photoFilter: 0, ssao: true,
    minimap: true, autoCycle: false, objective: true, perfhud: false, audio: true, moveSens: 1, lookSens: 1, festival: false
  };
  function loadSettings() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function saveSettings() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  const settings = loadSettings();
  /* 允许 URL 强制画质（截图/调试用，如 ?quality=high） */
  const urlQuality = new URLSearchParams(location.search).get('quality');
  if (new URLSearchParams(location.search).get('ssao') === '0') settings.ssao = false;
  if (urlQuality && CONFIG.quality[urlQuality]) settings.quality = urlQuality;

  /* =========================================================
   *  渲染器
   * ======================================================= */
  const canvas = $('c');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    fatal('当前浏览器或设备不支持 WebGL。请使用新版 Chrome / Edge / Safari，并开启硬件加速。');
    return;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.93;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.8, 6500);

  WALK.init(canvas, camera);

  /* 首次交互后启动环境声 */
  let audioBooted = false;
  function ensureAudio() {
    if (audioBooted) return;
    audioBooted = true;
    if (typeof AUDIO !== 'undefined') AUDIO.init();
  }
  window.addEventListener('pointerdown', ensureAudio, { once: true, passive: true });
  window.addEventListener('keydown', ensureAudio, { once: true });

  MATS.init();

  /* 统一开启各向异性过滤：显著抑制地面/屋面远景闪烁 */
  (function () {
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
    const seen = new Set();
    scene.traverse(function (o) {
      if (!o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (!m || seen.has(m)) continue;
        seen.add(m);
        ['map', 'bumpMap', 'emissiveMap'].forEach(function (k) {
          const tex = m[k];
          if (tex && tex.isTexture && tex.anisotropy !== maxAniso) {
            tex.anisotropy = maxAniso;
            tex.needsUpdate = true;
          }
        });
      }
    });
  })();

  /* ---------------- 环境反射（PMREM） ---------------- */
  let pmrem = null, envRT = null;
  const envRTs = {};
  function updateEnvironment(themeName) {
    const th = CONFIG.themes[themeName] || CONFIG.themes.day;
    const envKey = themeName + '|' + ((typeof ASSETS !== 'undefined' && ASSETS.envReady) ? 'hdr' : 'proc');
    if (envRTs[envKey]) { scene.environment = envRTs[envKey].texture; return; }
    let envCanvas = null;
    /* 优先使用真实 HDRI（CC0，按主题染色）；不可用时回退程序化天空 */
    if (typeof ASSETS !== 'undefined' && ASSETS.envReady) {
      envCanvas = ASSETS.tintedEquirect(themeName);
    }
    if (!envCanvas) {
      const W = 256, H = 128;
      envCanvas = document.createElement('canvas');
      envCanvas.width = W; envCanvas.height = H;
      const g = envCanvas.getContext('2d');
      const topCol = '#' + new THREE.Color(th.skyTop).getHexString();
      const botCol = '#' + new THREE.Color(th.skyBottom).getHexString();
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, topCol);
      grd.addColorStop(0.55, botCol);
      grd.addColorStop(0.60, '#b9ab93');
      grd.addColorStop(1, '#585048');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      const sun = new THREE.Vector3(th.sunPos[0], th.sunPos[1], th.sunPos[2]).normalize();
      const su = (Math.atan2(sun.x, sun.z) / (Math.PI * 2) + 0.5) * W;
      const sv = (0.5 - Math.asin(sun.y) / Math.PI) * H;
      const sg = g.createRadialGradient(su, sv, 0, su, sv, 22);
      sg.addColorStop(0, 'rgba(255,244,214,0.95)');
      sg.addColorStop(0.4, 'rgba(255,232,180,0.35)');
      sg.addColorStop(1, 'rgba(255,232,180,0)');
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
    }
    const tex = new THREE.CanvasTexture(envCanvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromEquirectangular(tex);
    envRTs[envKey] = envRT;
    scene.environment = envRT.texture;
    tex.dispose();
  }

  /* =========================================================
   *  天空穹顶
   * ======================================================= */
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x4b83c0) },
    bottomColor: { value: new THREE.Color(0xd6e2ec) },
    offset: { value: 0.0 },
    exponent: { value: 0.72 }
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NoBlending,
    transparent: false,
    vertexShader: [
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorldPosition = wp.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor;',
      'uniform vec3 bottomColor;',
      'uniform float offset;',
      'uniform float exponent;',
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vec3 dir = normalize(vWorldPosition + vec3(0.0, offset, 0.0));',
      '  float h = pow(max(dir.y, 0.0), exponent);',
      '  gl_FragColor = vec4(mix(bottomColor, topColor, h), 0.0);',
      '}'
    ].join('\n')
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 20), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  /* =========================================================
   *  光照
   * ======================================================= */
  const hemi = new THREE.HemisphereLight(0xa7c1dc, 0x6d5c47, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2da, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -470;
  sun.shadow.camera.right = 470;
  sun.shadow.camera.top = 470;
  sun.shadow.camera.bottom = -470;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3.0;
  sun.shadow.blurSamples = 8;
  sun.target.position.set(0, 0, 30);
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x9db7d6, 0.22);
  fill.position.set(-220, 140, -260);
  scene.add(fill);

  const fog = new THREE.FogExp2(0xc6d4df, 0.00032);
  scene.fog = fog;

  /* =========================================================
   *  太阳光晕 + 云
   * ======================================================= */
  const glowMat = new THREE.SpriteMaterial({
    map: TEX.cloud(), color: 0xfff0cc, transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  });
  const sunGlow = new THREE.Sprite(glowMat);
  sunGlow.scale.set(320, 320, 1);
  scene.add(sunGlow);

  /* 太阳圆盘 */
  const sunDiskMat = new THREE.SpriteMaterial({
    map: TEX.dot(), color: 0xfff6dc, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sunDisk = new THREE.Sprite(sunDiskMat);
  sunDisk.scale.set(46, 46, 1);
  scene.add(sunDisk);

  /* 月亮 + 月晕 */
  const moonMat = new THREE.SpriteMaterial({
    map: TEX.dot(), color: 0xe8f1ff, transparent: true, opacity: 0, depthWrite: false
  });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.set(86, 86, 1);
  moon.position.set(120, 300, -2100);
  scene.add(moon);
  const moonGlowMat = new THREE.SpriteMaterial({
    map: TEX.dot(), color: 0x8fa8d8, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const moonGlow = new THREE.Sprite(moonGlowMat);
  moonGlow.scale.set(420, 420, 1);
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  const clouds = [];
  for (let i = 0; i < 24; i++) {
    const cirrus = i >= 16;
    const base = cirrus ? (0.5 + TEX.rand() * 0.5) : (0.6 + TEX.rand() * 0.4);
    const m = new THREE.SpriteMaterial({
      map: TEX.cloud(), color: 0xffffff, transparent: true,
      opacity: cirrus ? base * 0.13 : base * 0.26, depthWrite: false
    });
    const sp = new THREE.Sprite(m);
    const px = (TEX.rand() - 0.5) * 3400;
    const py = cirrus ? (860 + TEX.rand() * 420) : (480 + TEX.rand() * 380);
    const pz = (TEX.rand() - 0.5) * 3200 - 150;
    sp.position.set(px, py, pz);
    if (cirrus) {
      const sc = 620 + TEX.rand() * 460;
      sp.scale.set(sc, 70 + TEX.rand() * 70, 1);
    } else {
      const sc = 220 + TEX.rand() * 320;
      sp.scale.set(sc, sc * 0.38, 1);
    }
    sp.userData.speed = cirrus ? (0.5 + TEX.rand() * 1.2) : (1.6 + TEX.rand() * 2.4);
    sp.userData.base = base;
    cloudGroup.add(sp);
    clouds.push(sp);
  }

  /* =========================================================
   *  场景 / 标注 / 特效
   * ======================================================= */
  const root = new THREE.Group();
  scene.add(root);

  const labelGroup = new THREE.Group();
  labelGroup.visible = false;
  scene.add(labelGroup);

  EFFECTS.init(scene);

  const TOAST = { timer: null };
  function snapshot() {
    try {
      document.body.classList.add('photo');
      const c = renderer.domElement;
      draw();
      const restore = function () { document.body.classList.remove('photo'); };
      if (c.toBlob) {
        c.toBlob(function (blob) {
          if (blob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '紫禁城-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
          }
          setTimeout(restore, 260);
          showToast('已导出当前画面', 1800);
        }, 'image/png');
      } else {
        setTimeout(restore, 200);
      }
    } catch (err) {
      document.body.classList.remove('photo');
      console.warn(err);
    }
  }

  function showToast(text, ms) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(TOAST.timer);
    TOAST.timer = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }

  /* =========================================================
   *  机位
   * ======================================================= */
  const VIEWS = [
    {
      key: 'overview', name: '全景', en: 'Panorama',
      pos: [150, 302, 918], target: [0, 26, 18],
      meta: [['宫城', '南北 961 m × 东西 753 m'], ['中轴', '午门 → 神武门']],
      desc: '紫禁城沿中轴次第展开：午门、太和门、前三殿、后三宫，直至神武门。'
    },
    {
      key: 'taihe', name: '太和殿', en: 'Hall of Supreme Harmony',
      pos: [26, 30, 170], target: [0, 28, 66],
      meta: [['面阔', '11 间 · 63.96 m'], ['进深', '5 间 · 37 m'], ['通高', '35.05 m（含三台 8.13 m）'], ['屋顶', '重檐庑殿顶']],
      desc: '现存中国最大木结构殿宇，五脊四坡、重檐庑殿，檐角走兽十只，为古建孤例。'
    },
    {
      key: 'terrace', name: '三台', en: 'Three-Tier Terrace',
      pos: [168, 132, 196], target: [0, 16, 6],
      meta: [['三台', '129 m × 195 m'], ['台高', '8.13 m'], ['形制', '三层汉白玉须弥座']],
      desc: '太和殿、中和殿、保和殿共踞三层汉白玉台基，周圈栏板望柱，螭首排水，雨时千龙吐水。'
    },
    {
      key: 'zhonghe', name: '中和殿', en: 'Hall of Central Harmony',
      pos: [62, 40, 10], target: [0, 24, -2],
      meta: [['平面', '正方形 · 每面约 24.1 m'], ['屋顶', '单檐四角攒尖顶'], ['宝顶', '铜胎鎏金宝顶']],
      desc: '方形殿身，四角攒尖，鎏金宝顶居中，是皇帝赴太和殿大典前的憩息之所。'
    },
    {
      key: 'baohe', name: '保和殿', en: 'Hall of Preserving Harmony',
      pos: [66, 38, -14], target: [0, 24, -56],
      meta: [['面阔', '9 间'], ['进深', '5 间'], ['通高', '约 29.5 m'], ['屋顶', '重檐歇山顶']],
      desc: '重檐歇山，殿试之所。上层檐九踩斗拱，金线大点金旋子彩画。'
    },
    {
      key: 'taihemen', name: '太和门', en: 'Gate of Supreme Harmony',
      pos: [0, 24, 368], target: [0, 20, 292],
      meta: [['面阔', '9 间'], ['通高', '23.8 m'], ['屋顶', '重檐歇山顶']],
      desc: '紫禁城最大的宫门，门前铜狮一对。明代皇帝曾在此御门听政。'
    },
    {
      key: 'meridian', name: '午门', en: 'Meridian Gate',
      pos: [0, 60, 636], target: [0, 34, 484],
      meta: [['正楼', '9 间 · 60.05 m'], ['墩台高', '12 m'], ['通高', '37.95 m'], ['屋顶', '重檐庑殿顶']],
      desc: '平面呈凹字形，两翼雁翅楼各 13 间，合称五凤楼。中门唯皇帝可通行。'
    },
    {
      key: 'corner', name: '角楼', en: 'Corner Tower',
      pos: [302, 46, -392], target: [371, 27, -472],
      meta: [['平面', '十字形复合平面'], ['通高', '27.5 m'], ['屋顶', '三重檐复合歇山顶']],
      desc: '城墙四隅各一，纵横交错的歇山顶与鎏金宝顶相叠，是紫禁城角部的视觉锚点。'
    },
    {
      key: 'garden', name: '御花园', en: 'Imperial Garden',
      pos: [0, 30, -258], target: [0, 14, -340],
      meta: [['位置', '坤宁宫之北、神武门之内'], ['古树', '古柏藤萝、四季花木']],
      desc: '后三宫之后的皇家园林，古柏森森，与中轴严整的殿宇形成收束。'
    },
    {
      key: 'interior', name: '殿内', en: 'Throne Hall Interior',
      pos: [0, 13.0, 64], target: [0, 11.8, 47],
      meta: [['金柱', '六根缠龙金柱'], ['宝座', '髹金漆云龙纹宝座'], ['天花', '井口天花 · 蟠龙藻井']],
      desc: '太和殿内：金砖墁地，六根缠龙金柱环列，宝座居中，屏风之后是蟠龙藻井与和玺彩画。'
    }
  ];

  /* 巡礼字幕（纪录片式） */
  const TOUR_CAPTIONS = [
    {
      t: 0.0, name: '午门', en: 'Meridian Gate',
      meta: [['正楼', '9 间 · 60.05 m'], ['通高', '37.95 m']],
      desc: '自午门入宫。凹字形城台与两翼雁翅楼合称五凤楼，中门唯皇帝可通行。'
    },
    {
      t: 0.16, name: '内金水河', en: 'Inner Golden Water River',
      meta: [['桥', '五座单孔石桥'], ['形制', '弓形河道 · 汉白玉栏杆']],
      desc: '内金水河横贯太和门广场，五座石桥并列，中为皇帝专用的御路桥。'
    },
    {
      t: 0.34, name: '太和门', en: 'Gate of Supreme Harmony',
      meta: [['面阔', '9 间'], ['通高', '23.8 m']],
      desc: '紫禁城最大的宫门，门前铜狮一对，明代皇帝曾在此御门听政。'
    },
    {
      t: 0.5, name: '太和殿', en: 'Hall of Supreme Harmony',
      meta: [['面阔', '11 间 · 63.96 m'], ['通高', '35.05 m']],
      desc: '现存中国最大木结构殿宇。三台之上，重檐庑殿，是明清两代的皇权中心。'
    },
    {
      t: 0.68, name: '中和殿 · 保和殿', en: 'Central & Preserving Harmony',
      meta: [['中和殿', '四角攒尖 · 鎏金宝顶'], ['保和殿', '重檐歇山 · 殿试之所']],
      desc: '三台之上三殿相连：大典前憩息于中和殿，殿试则于保和殿举行。'
    },
    {
      t: 0.84, name: '后三宫 · 御花园', en: 'Inner Court & Imperial Garden',
      meta: [['后三宫', '乾清宫 · 交泰殿 · 坤宁宫'], ['御花园', '古柏藤萝']],
      desc: '越过乾清门进入内廷，后三宫与御花园在森严的中轴尽端收束为园林。'
    },
    {
      t: 0.95, name: '神武门', en: 'Gate of Divine Prowess',
      meta: [['城楼', '5 间，重檐庑殿顶'], ['总高', '31 m']],
      desc: '紫禁城北门。出此门，中轴线的九重宫阙便告一段落。'
    }
  ];

  /* =========================================================
   *  轨道相机
   * ======================================================= */
  const ctrl = {
    target: new THREE.Vector3(0, 30, 34),
    tTarget: new THREE.Vector3(0, 30, 34),
    r: 900, theta: 0.2, phi: 0.95,
    tr: 900, ttheta: 0.2, tphi: 0.95,
    dragging: false, isPan: false, px: 0, py: 0,
    _v: new THREE.Vector3(),
    setView: function (v, instant) {
      const p = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
      const t = new THREE.Vector3(v.target[0], v.target[1], v.target[2]);
      const off = p.clone().sub(t);
      const r = off.length();
      const theta = Math.atan2(off.x, off.z);
      const phi = Math.acos(clamp(off.y / r, -1, 1));
      this.tTarget.copy(t);
      this.tr = r; this.ttheta = theta; this.tphi = phi;
      if (instant) {
        this.target.copy(t);
        this.r = r; this.theta = theta; this.phi = phi;
      }
    },
    snapTo: function (posArr, targetArr) {
      const p = new THREE.Vector3(posArr[0], posArr[1], posArr[2]);
      const t = new THREE.Vector3(targetArr[0], targetArr[1], targetArr[2]);
      const off = p.clone().sub(t);
      const r = off.length();
      this.target.copy(t); this.tTarget.copy(t);
      this.r = this.tr = r;
      this.theta = this.ttheta = Math.atan2(off.x, off.z);
      this.phi = this.tphi = Math.acos(clamp(off.y / r, -1, 1));
      camera.position.copy(p);
      camera.lookAt(t);
    },
    syncFromCamera: function () {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      this.target.copy(camera.position).addScaledVector(dir, 90);
      this.tTarget.copy(this.target);
      const off = camera.position.clone().sub(this.target);
      const r = Math.max(30, off.length());
      this.r = this.tr = r;
      this.theta = this.ttheta = Math.atan2(off.x, off.z);
      this.phi = this.tphi = Math.acos(clamp(off.y / r, -1, 1));
    },
    update: function (dt) {
      const k = 1 - Math.exp(-5.5 * dt);
      this.r += (this.tr - this.r) * k;
      let dth = this.ttheta - this.theta;
      dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      this.theta += dth * k;
      this.phi += (this.tphi - this.phi) * k;
      this.target.lerp(this.tTarget, k);
      const sp = this._v.set(
        Math.sin(this.phi) * Math.sin(this.theta),
        Math.cos(this.phi),
        Math.sin(this.phi) * Math.cos(this.theta)
      ).multiplyScalar(this.r);
      camera.position.copy(this.target).add(sp);
      camera.lookAt(this.target);
    },
    pan: function (dx, dy) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const s = this.r * 0.0011;
      this.tTarget.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      this.tTarget.y = clamp(this.tTarget.y, 2, 240);
    }
  };

  /* =========================================================
   *  主题（颜色 / 光强 / 材质 uniform 插值）
   * ======================================================= */
  const themeFieldsColor = ['skyTop', 'skyBottom', 'sunColor', 'hemiSky', 'hemiGround', 'fillColor', 'fog', 'glow', 'cloud'];
  const themeFieldsNumber = ['sunInt', 'hemiInt', 'fillInt', 'exposure', 'glowOp', 'cloudOp', 'cloudN', 'snow', 'windowGlow', 'stars', 'lanterns', 'bloom', 'rays'];

  const th = { sunPos: new THREE.Vector3(), grade: { tint: [1, 1, 1], lift: [0, 0, 0], sat: 1, contrast: 1, vignette: 0.2, grain: 0.01 } };
  const thT = { sunPos: new THREE.Vector3(), grade: { tint: [1, 1, 1], lift: [0, 0, 0], sat: 1, contrast: 1, vignette: 0.2, grain: 0.01 } };
  themeFieldsColor.forEach(function (k) { th[k] = new THREE.Color(); thT[k] = new THREE.Color(); });
  themeFieldsNumber.forEach(function (k) { th[k] = 0; thT[k] = 0; });

  let currentTheme = 'day';

  function setTheme(name, instant) {
    const t = CONFIG.themes[name] || CONFIG.themes.day;
    currentTheme = name;
    settings.theme = name;
    themeFieldsColor.forEach(function (k) { thT[k].setHex(t[k]); });
    themeFieldsNumber.forEach(function (k) { thT[k] = t[k]; });
    thT.sunPos.set(t.sunPos[0], t.sunPos[1], t.sunPos[2]);
    thT.grade.sat = t.grade.sat;
    thT.grade.contrast = t.grade.contrast;
    thT.grade.vignette = t.grade.vignette;
    thT.grade.grain = t.grade.grain;
    thT.grade.tint = t.grade.tint.slice();
    thT.grade.lift = t.grade.lift.slice();
    if (instant) {
      themeFieldsColor.forEach(function (k) { th[k].copy(thT[k]); });
      themeFieldsNumber.forEach(function (k) { th[k] = thT[k]; });
      th.sunPos.copy(thT.sunPos);
      th.grade.sat = thT.grade.sat;
      th.grade.contrast = thT.grade.contrast;
      th.grade.vignette = thT.grade.vignette;
      th.grade.grain = thT.grade.grain;
      th.grade.tint = thT.grade.tint.slice();
      th.grade.lift = thT.grade.lift.slice();
      /* 即时切换时同步材质 uniform（积雪/窗光/灯笼等），保证评测截图与真实主题一致 */
      updateTheme(1);
    }
    updateEnvironment(name);
    const btns = $('themes').querySelectorAll('button');
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-theme') === name);
    }
  }

  /* =========================================================
   *  日照流转（连续时间变化，约 4 分钟一昼夜）
   * ======================================================= */
  const DAY_CYCLE_SECONDS = 240;
  let dayPhase = 0.08;
  let daySavedTheme = 'day';
  let dayEnvName = 'day';
  const _cyA = new THREE.Color(), _cyB = new THREE.Color();
  const DAY_KEYS = [
    { t: 0.00, name: 'day' },
    { t: 0.30, name: 'dusk' },
    { t: 0.50, name: 'night' },
    { t: 0.72, name: 'dusk' },
    { t: 0.88, name: 'day' },
    { t: 1.00, name: 'day' }
  ];
  function dayCycleBlend(phase) {
    let i = 0;
    for (; i < DAY_KEYS.length - 1; i++) {
      if (phase >= DAY_KEYS[i].t && phase <= DAY_KEYS[i + 1].t) break;
    }
    if (i >= DAY_KEYS.length - 1) i = DAY_KEYS.length - 2;
    const k0 = DAY_KEYS[i], k1 = DAY_KEYS[i + 1];
    const a = (phase - k0.t) / Math.max(1e-6, k1.t - k0.t);
    const A = CONFIG.themes[k0.name] || CONFIG.themes.day;
    const B = CONFIG.themes[k1.name] || CONFIG.themes.day;
    for (let ci = 0; ci < themeFieldsColor.length; ci++) {
      const key = themeFieldsColor[ci];
      _cyA.setHex(A[key]); _cyB.setHex(B[key]);
      thT[key].copy(_cyA).lerp(_cyB, a);
    }
    for (let ni = 0; ni < themeFieldsNumber.length; ni++) {
      const key = themeFieldsNumber[ni];
      thT[key] = (A[key] == null ? 0 : A[key]) + ((B[key] == null ? 0 : B[key]) - (A[key] == null ? 0 : A[key])) * a;
    }
    thT.sunPos.set(
      A.sunPos[0] + (B.sunPos[0] - A.sunPos[0]) * a,
      A.sunPos[1] + (B.sunPos[1] - A.sunPos[1]) * a,
      A.sunPos[2] + (B.sunPos[2] - A.sunPos[2]) * a
    );
    thT.grade.sat = A.grade.sat + (B.grade.sat - A.grade.sat) * a;
    thT.grade.contrast = A.grade.contrast + (B.grade.contrast - A.grade.contrast) * a;
    thT.grade.vignette = A.grade.vignette + (B.grade.vignette - A.grade.vignette) * a;
    thT.grade.grain = A.grade.grain + (B.grade.grain - A.grade.grain) * a;
    for (let gi = 0; gi < 3; gi++) {
      thT.grade.tint[gi] = A.grade.tint[gi] + (B.grade.tint[gi] - A.grade.tint[gi]) * a;
      thT.grade.lift[gi] = A.grade.lift[gi] + (B.grade.lift[gi] - A.grade.lift[gi]) * a;
    }
    /* 环境贴图跟随最近的预设切换 */
    const nearest = a < 0.5 ? k0.name : k1.name;
    if (nearest !== dayEnvName) {
      dayEnvName = nearest;
      updateEnvironment(nearest);
    }
  }
  function updateDayCycle(dt) {
    if (!settings.autoCycle) return;
    dayPhase += dt / DAY_CYCLE_SECONDS;
    if (dayPhase >= 1) dayPhase -= 1;
    dayCycleBlend(dayPhase);
  }
  function setDayCycle(on) {
    settings.autoCycle = !!on;
    const oc = $('optAutoCycle');
    if (oc) oc.checked = settings.autoCycle;
    if (settings.autoCycle) {
      daySavedTheme = currentTheme;
      dayPhase = 0.08;
      dayEnvName = currentTheme;
      showToast('日照流转：开启（约 4 分钟一昼夜）', 3000);
    } else {
      setTheme(daySavedTheme || 'day');
      showToast('日照流转：关闭', 2200);
    }
    saveSettings();
  }

  const lastSunPos = new THREE.Vector3(1e9, 1e9, 1e9);
  function updateTheme(dt) {
    const k = 1 - Math.exp(-6.0 * dt);
    themeFieldsColor.forEach(function (key) { th[key].lerp(thT[key], k); });
    themeFieldsNumber.forEach(function (key) { th[key] += (thT[key] - th[key]) * k; });
    th.sunPos.lerp(thT.sunPos, k);
    th.grade.sat += (thT.grade.sat - th.grade.sat) * k;
    th.grade.contrast += (thT.grade.contrast - th.grade.contrast) * k;
    th.grade.vignette += (thT.grade.vignette - th.grade.vignette) * k;
    th.grade.grain += (thT.grade.grain - th.grade.grain) * k;
    for (let i = 0; i < 3; i++) {
      th.grade.tint[i] += (thT.grade.tint[i] - th.grade.tint[i]) * k;
      th.grade.lift[i] += (thT.grade.lift[i] - th.grade.lift[i]) * k;
    }

    skyUniforms.topColor.value.copy(th.skyTop);
    skyUniforms.bottomColor.value.copy(th.skyBottom);
    sun.color.copy(th.sunColor);
    sun.intensity = th.sunInt;
    hemi.color.copy(th.hemiSky);
    hemi.groundColor.copy(th.hemiGround);
    hemi.intensity = th.hemiInt;
    fill.color.copy(th.fillColor);
    fill.intensity = th.fillInt;
    fog.color.copy(th.fog);
    glowMat.color.copy(th.glow);
    glowMat.opacity = th.glowOp;
    sunGlow.visible = th.glowOp > 0.02;

    for (let i = 0; i < clouds.length; i++) {
      clouds[i].material.color.copy(th.cloud);
      clouds[i].material.opacity = th.cloudN * clouds[i].userData.base;
    }
    sun.position.copy(th.sunPos);
    sunGlow.position.copy(th.sunPos.clone().normalize().multiplyScalar(2600));
    sunDisk.position.copy(sunGlow.position);
    sunDiskMat.opacity = (1 - Math.min(1, Math.max(0, th.stars))) * 0.92;
    moonMat.opacity = Math.min(1, Math.max(0, th.stars)) * 0.95;
    moonGlowMat.opacity = Math.min(1, Math.max(0, th.stars)) * 0.16;

    MATS.setSnow(th.snow);
    MATS.setNightGlow(th.windowGlow);

    if (th.sunPos.distanceToSquared(lastSunPos) > 0.2) {
      lastSunPos.copy(th.sunPos);
      renderer.shadowMap.needsUpdate = true;
    }
    if (!POST.enabled) {
      renderer.toneMappingExposure = th.exposure;
    }
    applyWeatherToScene();
  }

  /* =========================================================
   *  中轴巡礼
   * ======================================================= */
  const TOUR = {
    active: false,
    paused: false,
    t: 0,
    duration: 82,
    captionIndex: -1,
    curve: new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 96, 700),
      new THREE.Vector3(0, 78, 560),
      new THREE.Vector3(0, 62, 430),
      new THREE.Vector3(0, 48, 310),
      new THREE.Vector3(0, 40, 220),
      new THREE.Vector3(0, 42, 140),
      new THREE.Vector3(0, 50, 76),
      new THREE.Vector3(0, 56, 10),
      new THREE.Vector3(0, 54, -70),
      new THREE.Vector3(0, 60, -150),
      new THREE.Vector3(0, 72, -260),
      new THREE.Vector3(0, 88, -390),
      new THREE.Vector3(0, 104, -540)
    ]),
    start: function () {
      if (this.active) return;
      this.active = true;
      this.paused = false;
      this.t = 0;
      this.captionIndex = -1;
      $('tourbar').classList.add('show');
      $('btnTour').classList.add('on');
      $('btnTourPause').textContent = '暂停';
      showToast('中轴巡礼开始 · 拖动画面可随时退出');
    },
    stop: function (restore) {
      if (!this.active) return;
      this.active = false;
      this.paused = false;
      $('tourbar').classList.remove('show');
      $('btnTour').classList.remove('on');
      const nb = $('npcBubble'); if (nb) nb.classList.remove('show');
      stopMinigame(true);
      closeRiddle();
      const om = $('objMarker'), oa = $('objArrow');
      if (om) om.classList.remove('show');
      if (oa) oa.classList.remove('show');
      ctrl.syncFromCamera();
      if (restore !== false) ctrl.setView(VIEWS[currentView], false);
    },
    togglePause: function () {
      this.paused = !this.paused;
      $('btnTourPause').textContent = this.paused ? '继续' : '暂停';
    },
    update: function (dt) {
      if (this.paused) return;
      this.t += dt / this.duration;
      const t = clamp(this.t, 0, 1);
      $('tourProgress').style.width = (t * 100).toFixed(1) + '%';
      const p = this.curve.getPointAt(t);
      const p2 = this.curve.getPointAt(Math.min(1, t + 0.012));
      camera.position.copy(p);
      const look = p2.clone();
      look.y -= 7;
      camera.lookAt(look);
      let idx = 0;
      for (let i = 0; i < TOUR_CAPTIONS.length; i++) {
        if (t >= TOUR_CAPTIONS[i].t) idx = i;
      }
      if (idx !== this.captionIndex) {
        this.captionIndex = idx;
        showCaption(TOUR_CAPTIONS[idx]);
      }
      if (this.t >= 1) this.stop(true);
    }
  };

  function showCaption(c) {
    $('pvName').textContent = c.name;
    $('pvEn').textContent = c.en;
    let html = '';
    for (let i = 0; i < c.meta.length; i++) {
      html += '<div class="row"><dt>' + c.meta[i][0] + '</dt><dd>' + c.meta[i][1] + '</dd></div>';
    }
    $('pvMeta').innerHTML = html;
    $('pvDesc').textContent = c.desc;
    const panel = $('panel');
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
  }

  /* =========================================================
   *  画质
   * ======================================================= */
  let resolvedQuality = 'high';
  let postOverride = null;
  function detectQuality() {
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua);
    const mem = navigator.deviceMemory || 4;
    const dpr = window.devicePixelRatio || 1;
    if (mobile) return mem >= 6 ? 'medium' : 'low';
    if (mem < 4 || dpr > 2.6) return 'medium';
    return 'high';
  }
  function resolveQuality() {
    return settings.quality === 'auto' ? detectQuality() : settings.quality;
  }
  function applyQuality() {
    resolvedQuality = resolveQuality();
    const q = CONFIG.quality[resolvedQuality] || CONFIG.quality.high;
    const pr = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = q.shadows && settings.shadows;
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true;

    for (let i = 0; i < clouds.length; i++) {
      clouds[i].visible = settings.clouds && i < q.clouds;
    }
    EFFECTS.setQuality(q);

    const wantPost = postOverride != null ? postOverride : resolvedQuality !== 'low';
    if (wantPost && !POST.rt) POST.init(renderer);
    if (POST.material) POST.material.uniforms.uMode.value = (typeof postMode === 'number' && !isNaN(postMode)) ? postMode : 2;
    POST.setEnabled(wantPost);
    if (POST.setSSAO) POST.setSSAO(settings.ssao !== false && wantPost && resolvedQuality === 'high');
    if (typeof DETAIL !== 'undefined' && DETAIL.setDetailLevel) DETAIL.setDetailLevel(resolvedQuality);
    if (wantPost) POST.setSize(window.innerWidth, window.innerHeight, pr);

    /* 输出编码 / 色调映射切换后需要重编译材质 */
    scene.traverse(function (o) {
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < ms.length; i++) ms[i].needsUpdate = true;
      }
    });

    const segBtns = $('qualitySeg').querySelectorAll('button');
    for (let i = 0; i < segBtns.length; i++) {
      segBtns[i].classList.toggle('on', segBtns[i].getAttribute('data-quality') === settings.quality);
    }
    $('perfText').textContent = q.label + '画质 · ' + (renderer.info ? renderer.info.render.calls : 0) + ' draws';
    saveSettings();
  }

  /* =========================================================
   *  标注
   * ======================================================= */
  const LABELS = [
    { text: '午门', x: 0, y: 42, z: 467 },
    { text: '太和门', x: 0, y: 30, z: 280 },
    { text: '太和殿', x: 0, y: 58, z: 58 },
    { text: '中和殿', x: 0, y: 38, z: -2 },
    { text: '保和殿', x: 0, y: 46, z: -56 },
    { text: '乾清门', x: 0, y: 22, z: -140 },
    { text: '慈宁宫', x: -226, y: 26, z: -186 },
    { text: '慈宁门', x: -226, y: 12, z: -146 },
    { text: '体仁阁', x: 98, y: 30, z: 205 },
    { text: '弘义阁', x: -98, y: 30, z: 205 },
    { text: '文华殿', x: 166, y: 24, z: 224 },
    { text: '武英殿', x: -166, y: 24, z: 224 },
    { text: '钦安殿', x: 0, y: 24, z: -310 },
    { text: '万春亭', x: 34, y: 16, z: -338 },
    { text: '千秋亭', x: -34, y: 16, z: -338 },
    { text: '御景亭', x: 64, y: 22, z: -352 },
    { text: '神武门', x: 0, y: 40, z: -481 }
  ];
  function buildLabels() {
    for (let i = 0; i < LABELS.length; i++) {
      const l = LABELS[i];
      const mat = new THREE.SpriteMaterial({
        map: TEX.label(l.text), transparent: true, depthWrite: false, opacity: 0.92
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(l.x, l.y, l.z);
      sp.scale.set(26, 26 / 3.2, 1);
      labelGroup.add(sp);
    }
    labelGroup.visible = !!settings.labels;
    $('btnLabels').classList.toggle('on', !!settings.labels);
  }
  function toggleLabels(force) {
    const on = force == null ? !labelGroup.visible : !!force;
    labelGroup.visible = on;
    settings.labels = on;
    $('btnLabels').classList.toggle('on', on);
    saveSettings();
  }

  /* =========================================================
   *  UI / 视图
   * ======================================================= */
  let currentView = 0;
  const nav = $('views');

  function buildNav() {
    for (let i = 0; i < VIEWS.length; i++) {
      const b = document.createElement('button');
      b.textContent = VIEWS[i].name;
      b.addEventListener('click', function () { stopTourIfActive(); showView(i); });
      nav.appendChild(b);
    }
  }
  function showView(i, instant) {
    currentView = i;
    const v = VIEWS[i];
    if (!TOUR.active) ctrl.setView(v, instant);
    showCaption(v);
    for (let k = 0; k < nav.children.length; k++) {
      nav.children[k].classList.toggle('on', k === i);
    }
  }
  function stopTourIfActive() {
    if (TOUR.active) TOUR.stop(false);
  }

  function setCinema(on) {
    settings.cinema = !!on;
    document.body.classList.toggle('cinema', !!on);
    $('btnCinema').classList.toggle('on', !!on);
    $('optCinema').checked = !!on;
    saveSettings();
    if (on) {
      if (!TOUR.active) TOUR.start();
    } else if (TOUR.active) {
      TOUR.stop(true);
    }
  }
  function toggleCinema() { setCinema(!settings.cinema); }

  /* =========================================================
   *  宫城探索（游戏化目标：发现 10 处地标）
   * ======================================================= */
  const DISCOVERIES = [
    { x: 0, z: 452, r: 46, name: '午门', desc: '紫禁城正门 · 五凤楼与雁翅楼' },
    { x: 0, z: 300, r: 34, name: '太和门', desc: '外朝正门 · 门前铜狮与金水桥' },
    { x: 0, z: 95, r: 60, name: '太和殿', desc: '金銮宝殿 · 重檐庑殿、脊兽十只' },
    { x: 0, z: 5, r: 30, name: '中和殿', desc: '方形攒尖顶 · 大典前休憩之所' },
    { x: 0, z: -50, r: 34, name: '保和殿', desc: '重檐歇山 · 殿试之地' },
    { x: 0, z: -196, r: 42, name: '乾清宫', desc: '内廷正殿 · 正大光明匾' },
    { x: 0, z: -244, r: 34, name: '坤宁宫', desc: '皇后中宫 · 位正坤元' },
    { x: 34, z: -338, r: 28, name: '万春亭', desc: '御花园东 · 重檐圆攒尖亭' },
    { x: -34, z: -338, r: 28, name: '千秋亭', desc: '御花园西 · 与万春亭对称' },
    { x: 0, z: -470, r: 40, name: '神武门', desc: '紫禁城北门 · 宫城终点' }
  ];
  const DISC_KEY = 'forbidden-city-discoveries-v1';
  let discSet = {};
  try {
    const saved = JSON.parse(localStorage.getItem(DISC_KEY) || '[]');
    if (Array.isArray(saved)) saved.forEach(function (i) { if (i >= 0 && i < DISCOVERIES.length) discSet[i] = true; });
  } catch (e) {}
  function discCount() { return Object.keys(discSet).length; }
  function saveDisc() {
    try { localStorage.setItem(DISC_KEY, JSON.stringify(Object.keys(discSet).map(Number))); } catch (e) {}
  }
  function bearingArrow(d, yaw) {
    const dx = d.x - WALK.pos.x, dz = d.z - WALK.pos.z;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rel = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz);
    const a = Math.abs(rel);
    if (a > Math.PI * 0.875) return '↓';
    if (a > Math.PI * 0.625) return rel > 0 ? '↙' : '↘';
    if (a > Math.PI * 0.375) return rel > 0 ? '←' : '→';
    if (a > Math.PI * 0.125) return rel > 0 ? '↖' : '↗';
    return '↑';
  }
  function refreshWalkGame() {
    const n = discCount();
    const c = $('wgCount'); if (c) c.textContent = String(n);
    const bar = $('wgBar'); if (bar) bar.style.width = (n / DISCOVERIES.length * 100).toFixed(1) + '%';
    updateWalkGameHint();
  }
  function updateWalkGameHint() {
    const hint = $('wgHint');
    if (!hint) return;
    const n = discCount();
    if (n >= DISCOVERIES.length) { hint.innerHTML = '全部 ' + DISCOVERIES.length + ' 处已发现 · <b>宫城探索完成</b>'; return; }
    let best = null, bestD = 1e9;
    for (let i = 0; i < DISCOVERIES.length; i++) {
      if (discSet[i]) continue;
      const d = DISCOVERIES[i];
      const dist = Math.hypot(d.x - WALK.pos.x, d.z - WALK.pos.z);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    if (best) hint.innerHTML = '下一处 <b>' + best.name + '</b> ' + bearingArrow(best, WALK.yaw) + ' ' + Math.round(bestD) + ' m · 已发现 ' + n + '/' + DISCOVERIES.length;
  }
  function updateWalkGame() {
    if (!WALK.active) return;
    for (let i = 0; i < DISCOVERIES.length; i++) {
      if (discSet[i]) continue;
      const d = DISCOVERIES[i];
      if (Math.hypot(d.x - WALK.pos.x, d.z - WALK.pos.z) < d.r) {
        discSet[i] = true;
        saveDisc();
        refreshWalkGame();
        const n = discCount();
        showToast('发现 · ' + d.name + '（' + n + '/' + DISCOVERIES.length + '）' + (d.desc ? ' — ' + d.desc : ''), 3400);
        if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
        if (n === DISCOVERIES.length) {
          setTimeout(function () { showToast('宫城探索完成：10 处全部发现！', 5200); }, 3600);
        }
        break;
      }
    }
    updateWalkGameHint();
  }

  /* =========================================================
   *  场景互动（E 键查看：铜缸/日晷/嘉量/铜狮/华表/石桌等）
   * ======================================================= */
  const INTERACTIVES = [
    { x: 13.8, z: 172, r: 3.4, title: '太平缸', wish: true, text: '铜缸储水以防火，冬日缸下燃炭防冻，故称"太平缸"。' },
    { x: -13.8, z: 172, r: 3.4, title: '太平缸', wish: true, text: '铜缸储水以防火，冬日缸下燃炭防冻，故称"太平缸"。' },
    { x: 20, z: -120, r: 3.2, title: '太平缸', wish: true, text: '内廷同样陈设太平缸，取"天一生水"之意。' },
    { x: -20, z: -120, r: 3.2, title: '太平缸', wish: true, text: '内廷同样陈设太平缸，取"天一生水"之意。' },
    { x: 34, z: 98, r: 4.2, title: '日晷', text: '以日影计时的石盘，明清宫廷重要陈设，象征皇权授时。' },
    { x: -34, z: 98, r: 4.2, title: '嘉量', text: '石亭式铜量器，象征国家统一与量衡标准。' },
    { x: 13, z: 304, r: 3.6, title: '铜狮', pet: true, text: '太和门前镇守铜狮，雄狮踏绣球、雌狮抚幼狮。' },
    { x: -13, z: 304, r: 3.6, title: '铜狮', pet: true, text: '太和门前镇守铜狮，雄狮踏绣球、雌抚幼狮。' },
    { x: 26, z: 438, r: 4.0, title: '华表', text: '宫门前的望柱，柱顶承露盘与蹲兽，兼具礼制与标识。' },
    { x: -26, z: 438, r: 4.0, title: '华表', text: '宫门前的望柱，柱顶承露盘与蹲兽，兼具礼制与标识。' },
    { x: 26, z: -372, r: 2.8, title: '石桌石凳', text: '御花园中的石桌石凳，供帝王后妃游憩小坐。' },
    { x: -26, z: -372, r: 2.8, title: '石桌石凳', text: '御花园中的石桌石凳，供帝王后妃游憩小坐。' },
    { x: 7.5, z: 176, r: 2.6, title: '品级山', text: '大朝时文武百官按品级立于山形石标之后，故称品级山。' },
    { x: 20, z: 100, r: 3.2, title: '月台铜鼎', incense: true, text: '太和殿月台陈设铜鼎，象征江山永固。' },
    { x: 30, z: 370, r: 4.6, title: '内金水河', lantern: true, text: '内金水河自西北蜿蜒而来，五座金水桥并列其上；灯会时河面漂满莲花灯。' },
    { x: -30, z: 370, r: 4.6, title: '内金水河', lantern: true, text: '内金水河自西北蜿蜒而来，五座金水桥并列其上；灯会时河面漂满莲花灯。' }
  ];
  let nearInteractive = null;
  let lastInteractT = 0;
  let lastWishT = 0;
  let lastIncenseT = 0;
  function nearestInteractive() {
    if (!WALK.active) return null;
    let best = null, bestD = 1e9;
    for (let i = 0; i < INTERACTIVES.length; i++) {
      const it = INTERACTIVES[i];
      const d = Math.hypot(it.x - WALK.pos.x, it.z - WALK.pos.z);
      if (d < it.r + 2.6 && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }
  function updateInteractPrompt() {
    const el = $('interact');
    const lab = $('interactLabel');
    if (!el) return;
    if (!WALK.active) { el.classList.remove('show'); nearInteractive = null; return; }
    if (nearCatNest()) {
      el.classList.add('show');
      if (lab) lab.textContent = '逗猫棒 · 玩耍';
      nearInteractive = null;
      return;
    }
    if (nearPot()) {
      el.classList.add('show');
      if (lab) lab.textContent = '投壶 · 开始';
      nearInteractive = null;
      return;
    }
    const rs = nearRiddle();
    if (rs) {
      el.classList.add('show');
      if (lab) lab.textContent = '猜灯谜';
      nearInteractive = null;
      return;
    }
    const catIdx = nearestCat();
    if (catIdx != null) {
      el.classList.add('show');
      if (lab) lab.textContent = '投喂御猫';
      nearInteractive = null;
      return;
    }
    const wkp = nearestWalkNpc();
    if (wkp && !nearestInteractive()) {
      el.classList.add('show');
      if (lab) lab.textContent = '问路 · ' + wkp.name;
      return;
    }
    const flk = nearestSparrowFlocks();
    if (flk && !nearestInteractive()) {
      el.classList.add('show');
      if (lab) lab.textContent = '撒米喂雀';
      nearInteractive = null;
      return;
    }
    const it = nearestInteractive();
    nearInteractive = it;
    if (it) {
      el.classList.add('show');
      if (lab) lab.textContent = (it.wish ? '投币许愿 · ' : (it.incense ? '上香祈福 · ' : (it.pet ? '摸摸铜狮 · ' : (it.lantern ? '放河灯 · ' : '查看 · ')))) + it.title;
    } else {
      el.classList.remove('show');
    }
  }
  const ACH_KEY = 'forbidden-city-achievements-v1';
  let achievements = { catFeeds: 0, photos: 0 };
  try {
    const savedA = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
    if (savedA && typeof savedA === 'object') {
      achievements.catFeeds = savedA.catFeeds || 0;
      achievements.photos = savedA.photos || 0;
      achievements.potBest = savedA.potBest || 0;
      achievements.potGames = savedA.potGames || 0;
      achievements.riddles = Array.isArray(savedA.riddles) ? savedA.riddles : [];
      achievements.catPlays = savedA.catPlays || 0;
      achievements.wishes = savedA.wishes || 0;
      achievements.incense = savedA.incense || 0;
      achievements.log = Array.isArray(savedA.log) ? savedA.log : [];
      achievements.codex = Array.isArray(savedA.codex) ? savedA.codex : [];
      achievements.petLions = savedA.petLions || 0;
      achievements.lanterns = savedA.lanterns || 0;
      achievements.asks = savedA.asks || 0;
      achievements.feedBirds = savedA.feedBirds || 0;
    }
  } catch (e) {}
  function achievementsSave() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(achievements)); } catch (e) {}
  }
  function nearestCat() {
    if (!WALK.active || typeof NPC === 'undefined' || !NPC.cats) return null;
    let best = null, bestD = 3.6;
    for (let i = 0; i < NPC.cats.length; i++) {
      const p0 = NPC.cats[i].obj.group.position;
      const d = Math.hypot(p0.x - WALK.pos.x, p0.z - WALK.pos.z);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  const WISHES = ['愿风调雨顺', '愿家国安泰', '愿岁岁平安', '愿所求皆如愿', '愿山河无恙'];
  function tossWish(it) {
    const px = WALK.pos.x, pz = WALK.pos.z;
    const y = WALK.pos.y + 1.35;
    const ex = it.x, ez = it.z;
    if (typeof EFFECTS !== 'undefined' && EFFECTS.spawnCoin) EFFECTS.spawnCoin(px, y, pz, ex, ez);
    achievements.wishes = (achievements.wishes || 0) + 1;
    achievementsSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    const wish = WISHES[Math.floor(Math.random() * WISHES.length)];
    showToast('投币许愿 · ' + wish + '（许愿 ' + achievements.wishes + ' 次）', 3800);
    if (achievements.wishes >= 3) {
      setTimeout(function () { showToast('称号达成 · 心愿达成（许愿 3 次）', 4600); }, 3900);
    }
    return achievements.wishes;
  }

  const INCENSE_TEXT = ['一炷清香，愿山河安定', '香火不绝，愿岁月静好', '青烟起处，愿所念皆安'];
  function burnIncense(it) {
    const y = WALK.groundAt(it.x, it.z) + 1.35;
    if (typeof EFFECTS !== 'undefined' && EFFECTS.spawnIncense) EFFECTS.spawnIncense(it.x, y, it.z, 8);
    achievements.incense = (achievements.incense || 0) + 1;
    achievementsSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    showToast('上香祈福 · ' + INCENSE_TEXT[Math.floor(Math.random() * INCENSE_TEXT.length)] + '（上香 ' + achievements.incense + ' 次）', 3800);
    if (achievements.incense >= 3) {
      setTimeout(function () { showToast('称号达成 · 心香一瓣（上香 3 次）', 4600); }, 3900);
    }
    return achievements.incense;
  }

  /* 互动彩蛋：摸铜狮 / 撒米喂雀 */
  function nearestSparrowFlocks() {
    if (!WALK.active || typeof NPC === 'undefined' || !NPC.sparrowData) return null;
    let best = null, bestD = 9;
    for (let i = 0; i < NPC.sparrowData.length; i++) {
      const s = NPC.sparrowData[i];
      if (s.state !== 'ground') continue;
      const d = Math.hypot(s.x - WALK.pos.x, s.z - WALK.pos.z);
      if (d < bestD) { bestD = d; best = { x: s.x, z: s.z, d: d }; }
    }
    return best;
  }
  function petLion(it) {
    achievements.petLions = (achievements.petLions || 0) + 1;
    achievementsSave();
    if (typeof EFFECTS !== 'undefined' && EFFECTS.spawnHeart) {
      EFFECTS.spawnHeart(it.x + (Math.random() - 0.5) * 0.6, 1.6, it.z + (Math.random() - 0.5) * 0.6);
    }
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    showToast('摸摸铜狮的头，沾沾福气（摸狮 ' + achievements.petLions + ' 次）', 3200);
    if (achievements.petLions >= 3) {
      setTimeout(function () { showToast('称号达成 · 摸狮得福（摸铜狮 3 次）', 4400); }, 3300);
    }
  }
  function feedSparrows(fl) {
    achievements.feedBirds = (achievements.feedBirds || 0) + 1;
    achievementsSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chirp) AUDIO.chirp();
    /* 麻雀围过来：把附近地面麻雀向玩家方向聚拢 */
    let n = 0;
    if (typeof NPC !== 'undefined' && NPC.sparrowData) {
      for (let i = 0; i < NPC.sparrowData.length; i++) {
        const s = NPC.sparrowData[i];
        if (s.state !== 'ground') continue;
        const d = Math.hypot(s.x - WALK.pos.x, s.z - WALK.pos.z);
        if (d < 9) {
          s.x += (WALK.pos.x - s.x) * 0.18;
          s.z += (WALK.pos.z - s.z) * 0.18;
          s.fedT = 6;
          n++;
        }
      }
    }
    showToast('撒了一把小米，' + n + ' 只麻雀围了过来（喂雀 ' + achievements.feedBirds + ' 次）', 3400);
    if (achievements.feedBirds >= 3) {
      setTimeout(function () { showToast('称号达成 · 雀跃（喂麻雀 3 次）', 4400); }, 3500);
    }
  }

  const LANTERN_TEXT = ['一盏河灯，愿顺水平安', '灯随水去，愿心事皆成', '莲灯入河，愿岁月从容'];
  function releaseLantern(it) {
    const x = WALK.pos.x + (WALK.pos.x > it.x ? -1 : 1) * 2.0;
    const t2 = Math.max(0, Math.min(1, (x + 112) / 224));
    const z = 350 + 14 * Math.sin(Math.PI * t2);
    let ok = false;
    if (typeof EFFECTS !== 'undefined' && EFFECTS.spawnRiverLantern) ok = EFFECTS.spawnRiverLantern(x, z);
    achievements.lanterns = (achievements.lanterns || 0) + 1;
    achievementsSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    showToast('放河灯 · ' + LANTERN_TEXT[Math.floor(Math.random() * LANTERN_TEXT.length)] + '（河灯 ' + achievements.lanterns + ' 盏）', 3600);
    if (achievements.lanterns >= 3) {
      setTimeout(function () { showToast('称号达成 · 河灯祈愿（放河灯 3 盏）', 4600); }, 3700);
    }
    return ok;
  }

  /* 问路：最近的行走 NPC */
  function nearestWalkNpc() {
    if (!WALK.active || typeof NPC === 'undefined') return null;
    let best = null, bestD = 4.2;
    if (NPC.patrols) {
      for (let i = 0; i < NPC.patrols.length; i++) {
        const o = NPC.patrols[i].obj.group;
        const d = Math.hypot(o.position.x - WALK.pos.x, o.position.z - WALK.pos.z);
        if (d < bestD) { bestD = d; best = { kind: 'guard', name: '侍卫', obj: NPC.patrols[i], dist: d }; }
      }
    }
    if (NPC.maids) {
      for (let i = 0; i < NPC.maids.length; i++) {
        const o = NPC.maids[i].obj.group;
        const d = Math.hypot(o.position.x - WALK.pos.x, o.position.z - WALK.pos.z);
        if (d < bestD) { bestD = d; best = { kind: 'maid', name: '宫女', obj: NPC.maids[i], dist: d }; }
      }
    }
    return best;
  }
  function dirWord(dx, dz) {
    const ang = Math.atan2(dx, dz);
    const deg = (ang * 180 / Math.PI + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) return '向南';
    if (deg < 67.5) return '向东南';
    if (deg < 112.5) return '向东';
    if (deg < 157.5) return '向东北';
    if (deg < 202.5) return '向北';
    if (deg < 247.5) return '向西北';
    if (deg < 292.5) return '向西';
    return '向西南';
  }
  const NPC_TALK_LINES = {
    maid: [
      '御花园的海棠开得正好，往北再走几步便是。',
      '前面亭子里有石桌石凳，走累了可歇一歇。',
      '仔细听，风过檐铃，是宫城在说话呢。'
    ]
  };
  function talkToNpc(wk) {
    let text = '';
    if (wk.kind === 'guard') {
      /* 指向最近的未发现地标 */
      let best = null, bestD = 1e9;
      for (let i = 0; i < DISCOVERIES.length; i++) {
        const d = DISCOVERIES[i];
        if (discSet[d.name]) continue;
        const dd = Math.hypot(d.x - WALK.pos.x, d.z - WALK.pos.z);
        if (dd < bestD) { bestD = dd; best = d; }
      }
      if (best) {
        text = dirWord(best.x - WALK.pos.x, best.z - WALK.pos.z) + '走约 ' + Math.round(bestD / 2) + ' 步，便是' + best.name + '。';
      } else {
        text = '十处景致您都走遍了，真是有心人。';
      }
    } else {
      text = NPC_TALK_LINES.maid[Math.floor(Math.random() * NPC_TALK_LINES.maid.length)];
    }
    window.__npcTalk = { who: wk.name, text: text, t: 6 };
    if (wk.obj) wk.obj.greetT = 3.4;
    achievements.asks = (achievements.asks || 0) + 1;
    achievementsSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    if (achievements.asks >= 5) {
      setTimeout(function () { showToast('称号达成 · 宫中熟人（问路 5 次）', 4400); }, 1500);
    }
    return text;
  }

  function doInteract() {
    if (!WALK.active) return;
    achievements.interacts = (achievements.interacts || 0) + 1;
    if (nearCatNest()) { playWithCats(); return; }
    if (nearPot()) { startMinigame(); return; }
    if (nearRiddle()) { openRiddle(); return; }
    const ci = nearestCat();
    if (ci != null && typeof NPC !== 'undefined' && NPC.feedCatNear) {
      const fed = NPC.feedCatNear(WALK.pos.x, WALK.pos.z, 3.6);
      if (fed >= 0) {
        achievements.catFeeds++;
        achievementsSave();
        showToast('投喂御猫 · 好感 +1（累计 ' + achievements.catFeeds + ' 次）— 它会跟着你走一段', 4200);
        if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
        return;
      }
    }
    const wk = nearestWalkNpc();
    if (wk && !nearestInteractive()) {
      const nowT = performance.now();
      if (nowT - (window.__lastTalkT || 0) < 700) return;
      window.__lastTalkT = nowT;
      talkToNpc(wk);
      return;
    }
    const fl = nearestSparrowFlocks();
    if (fl && (!nearestInteractive())) {
      const nowF = performance.now();
      if (nowF - (window.__lastFeedT || 0) < 900) return;
      window.__lastFeedT = nowF;
      feedSparrows(fl);
      return;
    }
    const it = nearestInteractive();
    if (!it) return;
    if (it.pet) {
      const nowP = performance.now();
      if (nowP - (window.__lastPetT || 0) < 800) return;
      window.__lastPetT = nowP;
      petLion(it);
      return;
    }
    if (it.lantern) {
      const nowL = performance.now();
      if (nowL - (window.__lastLanternT || 0) < 900) return;
      window.__lastLanternT = nowL;
      releaseLantern(it);
      return;
    }
    if (it.wish) {
      const nowW = performance.now();
      if (nowW - lastWishT < 800) return;
      lastWishT = nowW;
      tossWish(it);
      return;
    }
    if (it.incense) {
      const nowI = performance.now();
      if (nowI - lastIncenseT < 900) return;
      lastIncenseT = nowI;
      burnIncense(it);
      return;
    }
    const now = performance.now();
    if (now - lastInteractT < 700) return;
    lastInteractT = now;
    showToast(it.title + ' — ' + it.text, 4600);
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
  }

  /* =========================================================
   *  任务线（中轴巡礼 / 御花园寻芳 / 宫城寻猫）
   * ======================================================= */
  const QUESTS = [
    {
      id: 'axis', name: '中轴巡礼', title: '中轴行者',
      steps: [
        { t: 'lm', i: 0, label: '午门' }, { t: 'lm', i: 1, label: '太和门' },
        { t: 'lm', i: 2, label: '太和殿' }, { t: 'lm', i: 3, label: '中和殿' },
        { t: 'lm', i: 4, label: '保和殿' }, { t: 'lm', i: 5, label: '乾清宫' },
        { t: 'lm', i: 6, label: '坤宁宫' }, { t: 'lm', i: 9, label: '神武门' }
      ],
      progress: 0, done: false
    },
    {
      id: 'garden', name: '御花园寻芳', title: '寻芳客',
      steps: [
        { t: 'pos', x: 0, z: -310, r: 18, label: '钦安殿' },
        { t: 'pos', x: 34, z: -338, r: 12, label: '万春亭' },
        { t: 'pos', x: -34, z: -338, r: 12, label: '千秋亭' },
        { t: 'pos', x: 64, z: -352, r: 14, label: '堆秀山' },
        { t: 'pos', x: 18, z: -350, r: 8, label: '东花坛' },
        { t: 'pos', x: -18, z: -352, r: 8, label: '西花坛' }
      ],
      progress: 0, done: false
    },
    {
      id: 'cats', name: '宫城寻猫', title: '御猫之友',
      steps: [
        { t: 'cat', i: 0, label: '御猫' }, { t: 'cat', i: 1, label: '御猫' },
        { t: 'cat', i: 2, label: '御猫' }, { t: 'cat', i: 3, label: '御猫' },
        { t: 'cat', i: 4, label: '御猫' }, { t: 'cat', i: 5, label: '御猫' },
        { t: 'cat', i: 6, label: '御猫' }
      ],
      progress: 0, done: false
    }
  ];
  const QUEST_KEY = 'forbidden-city-quests-v1';
  try {
    const savedQ = JSON.parse(localStorage.getItem(QUEST_KEY) || '{}');
    for (let qi = 0; qi < QUESTS.length; qi++) {
      const q = QUESTS[qi];
      const st = savedQ[q.id];
      if (st) {
        q.progress = Math.max(0, Math.min(q.steps.length, st.p || 0));
        q.done = !!st.done || q.progress >= q.steps.length;
      }
    }
  } catch (e) {}
  function questsSave() {
    const out = {};
    for (let i = 0; i < QUESTS.length; i++) out[QUESTS[i].id] = { p: QUESTS[i].progress, done: QUESTS[i].done };
    try { localStorage.setItem(QUEST_KEY, JSON.stringify(out)); } catch (e) {}
  }
  function questsReset() {
    for (let i = 0; i < QUESTS.length; i++) { QUESTS[i].progress = 0; QUESTS[i].done = false; }
    questsSave();
    buildQuestHud();
  }
  function buildQuestHud() {
    const box = $('wgQuests');
    if (!box) return;
    let html = '';
    for (let i = 0; i < QUESTS.length; i++) {
      const q = QUESTS[i];
      const cls = q.done ? 'wg-quest done' : 'wg-quest';
      const val = q.done ? '✓' : q.progress + '/' + q.steps.length;
      html += '<div class="' + cls + '"><span>' + q.name + '</span><b>' + val + '</b></div>';
    }
    box.innerHTML = html;
  }
  function questStepDone(step) {
    if (step.t === 'lm') return !!discSet[step.i];
    if (step.t === 'pos') return Math.hypot(step.x - WALK.pos.x, step.z - WALK.pos.z) < step.r;
    if (step.t === 'cat') {
      if (typeof NPC === 'undefined' || !NPC.cats || !NPC.cats[step.i]) return false;
      const cpos = NPC.cats[step.i].obj.group.position;
      return Math.hypot(cpos.x - WALK.pos.x, cpos.z - WALK.pos.z) < 5.2;
    }
    return false;
  }
  function updateQuests() {
    if (!WALK.active) return;
    let changed = false;
    for (let qi = 0; qi < QUESTS.length; qi++) {
      const q = QUESTS[qi];
      if (q.done) continue;
      let advanced = false;
      while (q.progress < q.steps.length) {
        const step = q.steps[q.progress];
        if (!questStepDone(step)) break;
        q.progress++;
        advanced = true;
        if (q.progress >= q.steps.length) {
          q.done = true;
          showToast('任务完成 · ' + q.name + ' — 获得称号「' + q.title + '」', 5200);
          if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
        } else {
          showToast('任务 · ' + q.name + ' ' + q.progress + '/' + q.steps.length + '（' + step.label + '）', 2400);
          if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
        }
      }
      if (advanced) { changed = true; }
    }
    if (changed) { questsSave(); buildQuestHud(); }
  }

  /* =========================================================
   *  手柄输入（Gamepad API）
   * ======================================================= */
  const PAD = { jumpHeld: false, bHeld: false, b3Held: false, b8Held: false, connected: false };
  function pollGamepad(dt) {
    if (!navigator.getGamepads) { WALK.pad = null; return; }
    let gp = null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
    if (!gp) { WALK.pad = null; PAD.connected = false; return; }
    if (!PAD.connected) { PAD.connected = true; showToast('手柄已连接：左摇杆移动 · A 跳跃 · RB 疾行 · B 视角 · Y 互动', 4200); }
    const dz = function (v) { return Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82; };
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    WALK.pad = {
      x: dz(ax), y: -dz(ay),
      lookX: dz(rx), lookY: dz(ry),
      sprint: !!(gp.buttons[5] && gp.buttons[5].pressed),
      jump: !!(gp.buttons[0] && gp.buttons[0].pressed)
    };
    if (!WALK.active) return;
    if (Math.abs(WALK.pad.lookX) > 0.01 || Math.abs(WALK.pad.lookY) > 0.01) {
      WALK.look(WALK.pad.lookX * 260 * (dt || 0.016), WALK.pad.lookY * 200 * (dt || 0.016));
    }
    if (WALK.pad.jump && !PAD.jumpHeld) {
      if (minigame.active) throwArrow(); else WALK.jump();
    }
    if (!WALK.pad.jump && PAD.jumpHeld) WALK.releaseJump();
    PAD.jumpHeld = WALK.pad.jump;
    WALK.keys['shift'] = !!WALK.pad.sprint;
    const bB = gp.buttons[1] && gp.buttons[1].pressed;
    if (bB && !PAD.bHeld) WALK.toggleView();
    PAD.bHeld = bB;
    const bY = gp.buttons[3] && gp.buttons[3].pressed;
    if (bY && !PAD.b3Held) doInteract();
    PAD.b3Held = bY;
    const bStart = gp.buttons[8] && gp.buttons[8].pressed;
    if (bStart && !PAD.b8Held) toggleWalk(false);
    PAD.b8Held = bStart;
  }

  /* =========================================================
   *  触屏控制（移动端）
   * ======================================================= */
  const touchEnabled = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
    new URLSearchParams(location.search).get('touch') === '1';
  if (touchEnabled) document.body.classList.add('touch');
  function initTouch() {
    const stick = $('stick'), knob = $('knob');
    if (!stick) return;
    let padId = null;
    const setKnob = function (dx, dy) { if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
    const endStick = function () {
      padId = null;
      WALK.touchMove = null;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      padId = e.pointerId;
      try { stick.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stick.addEventListener('pointermove', function (e) {
      if (padId !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const lim = r.width * 0.34;
      const len = Math.hypot(dx, dy);
      if (len > lim) { dx = dx / len * lim; dy = dy / len * lim; }
      setKnob(dx, dy);
      WALK.touchMove = { x: dx / lim, y: -dy / lim };
    });
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    stick.addEventListener('lostpointercapture', endStick);

    const bindBtn = function (id, onDown, onUp) {
      const el = $(id);
      if (!el) return;
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        el.classList.add('on');
        if (onDown) onDown();
      });
      const up = function (e) { e.preventDefault(); el.classList.remove('on'); if (onUp) onUp(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    };
    bindBtn('tbJump', function () { if (minigame.active) throwArrow(); else WALK.jump(); });
    bindBtn('tbRun', function () { WALK.keys['shift'] = true; }, function () { WALK.keys['shift'] = false; });
    bindBtn('tbView', function () { WALK.toggleView(); });
    bindBtn('tbInteract', function () { doInteract(); });
    bindBtn('tbPhoto', function () { takePhoto(); });
  }

  /* =========================================================
   *  拍照 / 相册（P 拍照 · G 相册 · 10 处地标打卡）
   * ======================================================= */
  const PHOTO_KEY = 'forbidden-city-photos-v1';
  const album = [];
  const photoSpots = {};   /* DISCOVERIES 索引 -> 已打卡 */
  try {
    const savedP = JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}');
    if (savedP && typeof savedP === 'object') {
      if (Array.isArray(savedP.spots)) savedP.spots.forEach(function (i) { photoSpots[i] = true; });
      if (typeof savedP.count === 'number') achievements.photos = savedP.count;
    }
  } catch (e) {}
  function photoSave() {
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify({ count: achievements.photos, spots: Object.keys(photoSpots).map(Number) }));
    } catch (e) {}
  }
  function photoSpotAt() {
    for (let i = 0; i < DISCOVERIES.length; i++) {
      const d = DISCOVERIES[i];
      if (Math.hypot(d.x - WALK.pos.x, d.z - WALK.pos.z) < Math.max(28, d.r + 6)) return i;
    }
    return -1;
  }
  function takePhoto() {
    if (!WALK.active) return null;
    const fl = $('photoFlash');
    if (fl) { fl.classList.add('on'); setTimeout(function () { fl.classList.remove('on'); }, 130); }
    /* 抓取当前画面（后处理已绘制到主 canvas） */
    let full = '';
    try {
      if (typeof draw === 'function') draw(); else renderer.render(scene, camera);
      full = renderer.domElement.toDataURL('image/jpeg', 0.92);
    } catch (e) { full = ''; }
    /* 缩略图（相册用，降低内存） */
    let thumb = full;
    try {
      const cv = document.createElement('canvas');
      cv.width = 480; cv.height = 270;
      const g2 = cv.getContext('2d');
      g2.drawImage(renderer.domElement, 0, 0, 480, 270);
      thumb = cv.toDataURL('image/jpeg', 0.8);
    } catch (e) {}
    const spot = photoSpotAt();
    let spotName = '宫城随拍';
    let isNewSpot = false;
    if (spot >= 0) {
      spotName = DISCOVERIES[spot].name;
      if (!photoSpots[spot]) { photoSpots[spot] = true; isNewSpot = true; }
    }
    achievements.photos++;
    album.push({ url: full, thumb: thumb, name: spotName, spot: spot, t: Date.now() });
    if (album.length > 24) album.shift();
    photoSave();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    const done = Object.keys(photoSpots).length;
    let msg = '拍照成功 · 已收藏 ' + achievements.photos + ' 张';
    if (isNewSpot) msg += ' · 打卡「' + spotName + '」' + done + '/' + DISCOVERIES.length;
    if (done >= DISCOVERIES.length && !photoAllDone) {
      photoAllDone = true;
      showToast('称号达成 · 御用摄影师（10 处地标全部打卡）', 5200);
      if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
      setTimeout(function () { showToast(msg, 3000); }, 5400);
    } else {
      showToast(msg, 2800);
    }
    return { name: spotName, isNewSpot: isNewSpot, done: done, total: DISCOVERIES.length, count: achievements.photos };
  }
  let photoAllDone = Object.keys(photoSpots).length >= DISCOVERIES.length;
  let albumFilter = 'all';
  function albumFilterOk(ph) {
    if (albumFilter === 'all') return true;
    return ph.spot === albumFilter;
  }
  function buildAlbumFilter() {
    const box = $('albumFilter');
    if (!box) return;
    const counts = {};
    for (let i = 0; i < album.length; i++) {
      const sp = album[i].spot;
      if (sp == null || sp < 0) continue;
      counts[sp] = (counts[sp] || 0) + 1;
    }
    let html = '<span class="fchip' + (albumFilter === 'all' ? ' on' : '') + '" data-f="all">全部 ' + album.length + '</span>';
    const keys = Object.keys(counts);
    for (let i = 0; i < keys.length; i++) {
      const idx = Number(keys[i]);
      const d = DISCOVERIES[idx];
      if (!d) continue;
      html += '<span class="fchip' + (albumFilter === idx ? ' on' : '') + '" data-f="' + idx + '">' + d.name + ' ' + counts[idx] + '</span>';
    }
    box.innerHTML = html;
    const chips = box.querySelectorAll('.fchip');
    for (let c = 0; c < chips.length; c++) {
      chips[c].addEventListener('click', function () {
        const f = this.getAttribute('data-f');
        albumFilter = f === 'all' ? 'all' : Number(f);
        refreshAlbum();
      });
    }
  }
  function refreshAlbum() {
    const grid = $('albumGrid');
    const spots = $('albumSpots');
    const sub = $('albumSub');
    if (!grid) return;
    buildAlbumFilter();
    const list = [];
    for (let i = album.length - 1; i >= 0; i--) {
      if (albumFilterOk(album[i])) list.push({ i: i, ph: album[i] });
    }
    let html = '';
    for (let k = 0; k < list.length; k++) {
      const ph = list[k].ph;
      html += '<div class="ph" data-i="' + list[k].i + '"><img src="' + (ph.thumb || ph.url) + '"><span>' + ph.name + '</span></div>';
    }
    if (!list.length) html = '<div class="empty">' + (album.length ? '当前筛选没有照片' : '还没有照片，进入漫游后按 P 拍照') + '</div>';
    grid.innerHTML = html;
    if (spots) {
      let sh = '';
      for (let i = 0; i < DISCOVERIES.length; i++) {
        sh += '<span class="spot' + (photoSpots[i] ? ' on' : '') + '">' + (photoSpots[i] ? '✓ ' : '○ ') + DISCOVERIES[i].name + '</span>';
      }
      spots.innerHTML = sh;
    }
    if (sub) sub.textContent = '显示 ' + list.length + ' / ' + album.length + ' 张 · 地标打卡 ' + Object.keys(photoSpots).length + '/' + DISCOVERIES.length + ' · 点击照片下载原图 · P 拍照 · G / Esc 关闭';
  }
  function setAlbumFilter(f) {
    albumFilter = f === 'all' || f == null ? 'all' : Number(f);
    refreshAlbum();
    return albumFilter;
  }
  function albumInfoEx() {
    const bySpot = {};
    for (let i = 0; i < album.length; i++) {
      const s2 = album[i].spot == null ? -1 : album[i].spot;
      bySpot[s2] = (bySpot[s2] || 0) + 1;
    }
    return { total: album.length, filter: albumFilter, bySpot: bySpot, shown: album.filter(albumFilterOk).length };
  }

    /* 相册灯箱：全屏浏览 */
  const lightbox = { active: false, idx: 0 };
  function renderLightbox() {
    const lb = $('lightbox'), img = $('lbImg'), cap = $('lbCap');
    if (!lb || !img) return;
    const ordered = [];
    for (let i = 0; i < album.length; i++) ordered.push(i);
    if (!ordered.length || lightbox.idx < 0 || lightbox.idx >= ordered.length) { closeLightbox(); return; }
    const ph = album[ordered[lightbox.idx]];
    img.src = ph.url;
    if (cap) {
      const dt = new Date(ph.t);
      cap.innerHTML = (ph.name || '宫城随拍') + '<small>' + dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2) + ' ' + ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2) + ' · ' + (lightbox.idx + 1) + ' / ' + ordered.length + '</small>';
    }
  }
  function openLightbox(albumIndex) {
    if (!album.length) return false;
    lightbox.active = true;
    const ordered = album.map(function (x, i) { return i; });
    lightbox.idx = Math.max(0, ordered.indexOf(albumIndex));
    const lb = $('lightbox');
    if (lb) lb.classList.add('show');
    renderLightbox();
    return true;
  }
  function closeLightbox() {
    lightbox.active = false;
    const lb = $('lightbox');
    if (lb) lb.classList.remove('show');
  }
  function lightboxNav(dir) {
    if (!lightbox.active || !album.length) return;
    lightbox.idx = (lightbox.idx + dir + album.length) % album.length;
    renderLightbox();
  }

  function downloadPhoto(i) {
    const ph = album[i];
    if (!ph) return;
    try {
      const a = document.createElement('a');
      a.href = ph.url;
      a.download = '紫禁城-' + (ph.name || '照片') + '-' + new Date(ph.t).toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {}
  }
  function openAlbum(force) {
    const el = $('album');
    if (!el) return;
    const on = force == null ? !el.classList.contains('show') : !!force;
    if (on) { refreshAlbum(); el.classList.add('show'); }
    else { closeLightbox(); el.classList.remove('show'); }
  }

  /* =========================================================
   *  行程总览（H）：探索 / 任务 / 收藏 / 称号
   * ======================================================= */
  /* =========================================================
   *  宫中物件图鉴
   * ======================================================= */
  const CODEX_DATA = [
    { id: 'vat', name: '太平缸', how: 'interact', title: '太平缸' },
    { id: 'sundial', name: '日晷', how: 'interact', title: '日晷' },
    { id: 'jialiang', name: '嘉量', how: 'interact', title: '嘉量' },
    { id: 'lion', name: '铜狮', how: 'interact', title: '铜狮' },
    { id: 'huabiao', name: '华表', how: 'interact', title: '华表' },
    { id: 'table', name: '石桌石凳', how: 'interact', title: '石桌石凳' },
    { id: 'rank', name: '品级山', how: 'interact', title: '品级山' },
    { id: 'ding', name: '月台铜鼎', how: 'interact', title: '月台铜鼎' },
    { id: 'wanchun', name: '万春亭', how: 'zone', x: 34, z: -338, r: 22 },
    { id: 'qianqiu', name: '千秋亭', how: 'zone', x: -34, z: -338, r: 22 },
    { id: 'duixiu', name: '堆秀山', how: 'zone', x: 64, z: -352, r: 24 },
    { id: 'corner', name: '角楼', how: 'zone', x: 376, z: 480, r: 46 },
    { id: 'cat', name: '御猫', how: 'cat', r: 6 },
    { id: 'sparrow', name: '麻雀', how: 'sparrow', r: 9 },
    { id: 'censer', name: '铜鼎香炉', how: 'zone', x: 0, z: 58, r: 40 },
    { id: 'pavement', name: '金砖御道', how: 'zone', x: 0, z: 300, r: 60 }
  ];
  function codexHas(id) {
    if (!Array.isArray(achievements.codex)) achievements.codex = [];
    return achievements.codex.indexOf(id) >= 0;
  }
  function codexUnlock(id) {
    if (!Array.isArray(achievements.codex)) achievements.codex = [];
    if (achievements.codex.indexOf(id) >= 0) return false;
    const item = CODEX_DATA.filter(function (c) { return c.id === id; })[0];
    if (!item) return false;
    achievements.codex.push(id);
    achievementsSave();
    if (item) {
      showToast('图鉴收录 · ' + item.name + '（' + achievements.codex.length + '/' + CODEX_DATA.length + '）', 3000);
      if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    }
    return true;
  }
  let codexT = 0;
  function updateCodex(dt) {
    if (!WALK.active) return;
    codexT += dt;
    if (codexT < 0.8) return;
    codexT = 0;
    /* 互动类：靠近陈设即可收录（与互动提示一致） */
    const it = nearestInteractive();
    if (it) {
      for (let i = 0; i < CODEX_DATA.length; i++) {
        const c = CODEX_DATA[i];
        if (c.how === 'interact' && c.title === it.title && !codexHas(c.id)) codexUnlock(c.id);
      }
    }
    /* 区域类 */
    for (let i = 0; i < CODEX_DATA.length; i++) {
      const c = CODEX_DATA[i];
      if (c.how !== 'zone' || codexHas(c.id)) continue;
      if (Math.hypot(WALK.pos.x - c.x, WALK.pos.z - c.z) < c.r) codexUnlock(c.id);
    }
    /* 御猫 */
    if (!codexHas('cat') && typeof NPC !== 'undefined' && NPC.cats) {
      for (let ci = 0; ci < NPC.cats.length; ci++) {
        const cp = NPC.cats[ci].obj.group.position;
        if (Math.hypot(cp.x - WALK.pos.x, cp.z - WALK.pos.z) < 6) { codexUnlock('cat'); break; }
      }
    }
    /* 麻雀 */
    if (!codexHas('sparrow') && typeof NPC !== 'undefined' && NPC.sparrowData) {
      for (let si = 0; si < NPC.sparrowData.length; si++) {
        const sp = NPC.sparrowData[si];
        if (Math.hypot(sp.x - WALK.pos.x, sp.z - WALK.pos.z) < 9) { codexUnlock('sparrow'); break; }
      }
    }
  }
  function codexInfo() {
    const got = Array.isArray(achievements.codex) ? achievements.codex.slice() : [];
    return {
      total: CODEX_DATA.length, got: got.length,
      names: CODEX_DATA.filter(function (c) { return got.indexOf(c.id) >= 0; }).map(function (c) { return c.name; }),
      missing: CODEX_DATA.filter(function (c) { return got.indexOf(c.id) < 0; }).map(function (c) { return c.name; })
    };
  }

  function syncAchievementLog(notify) {
    if (!Array.isArray(achievements.log)) achievements.log = [];
    let changed = false;
    const titles = [
      { name: '中轴行者', ok: QUESTS[0].done },
      { name: '寻芳客', ok: QUESTS[1].done },
      { name: '御猫之友', ok: QUESTS[2].done },
      { name: '御用摄影师', ok: Object.keys(photoSpots).length >= DISCOVERIES.length },
      { name: '猫薄荷', ok: (achievements.catFeeds || 0) >= 5 },
      { name: '投壶高手', ok: (achievements.potBest || 0) >= 5 },
      { name: '灯谜雅士', ok: (achievements.riddles || []).length >= 3 },
      { name: '御猫团宠', ok: (achievements.catPlays || 0) >= 3 },
      { name: '摸狮得福', ok: (achievements.petLions || 0) >= 3 },
      { name: '河灯祈愿', ok: (achievements.lanterns || 0) >= 3 },
      { name: '宫中熟人', ok: (achievements.asks || 0) >= 5 },
      { name: '雀跃', ok: (achievements.feedBirds || 0) >= 3 },
      { name: '心愿达成', ok: (achievements.wishes || 0) >= 3 },
      { name: '心香一瓣', ok: (achievements.incense || 0) >= 3 },
      { name: '图鉴收藏家', ok: (achievements.codex || []).length >= 16 },
      { name: '千里之行', ok: travel.dist >= 1000 },
      { name: '宫城常客', ok: travel.dist >= 5000 },
      { name: '身轻如燕', ok: travel.jumps >= 50 },
      { name: '流连忘返', ok: travel.time >= 600 },
      { name: '紫禁城居民', ok: Object.keys(discSet).length >= 10 && QUESTS.every(function (q) { return q.done; }) && Object.keys(photoSpots).length >= 10 }
    ];
    for (let i = 0; i < titles.length; i++) {
      const ti = titles[i];
      if (!ti.ok) continue;
      let has = false;
      for (let j = 0; j < achievements.log.length; j++) {
        if (achievements.log[j].name === ti.name) { has = true; break; }
      }
      if (has) continue;
      achievements.log.push({ name: ti.name, t: Date.now() });
      changed = true;
      if (notify) {
        showToast('称号解锁 · ' + ti.name, 3600);
        if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
      }
    }
    if (achievements.log.length > 60) achievements.log = achievements.log.slice(-60);
    if (changed) achievementsSave();
    return achievements.log.length;
  }

  function achvData() {
    const disc = Object.keys(discSet).length;
    const questsDone = QUESTS.filter(function (q) { return q.done; }).length;
    const spots = Object.keys(photoSpots).length;
    const feeds = achievements.catFeeds;
    const plays = achievements.catPlays || 0;
    const potBest = achievements.potBest || 0;
    const riddleN = (achievements.riddles || []).length;
    const titles = [
      { name: '中轴行者', cat: '任务', ok: QUESTS[0].done },
      { name: '寻芳客', cat: '任务', ok: QUESTS[1].done },
      { name: '御猫之友', cat: '任务', ok: QUESTS[2].done },
      { name: '御用摄影师', cat: '探索', ok: spots >= DISCOVERIES.length },
      { name: '猫薄荷', cat: '趣味', ok: feeds >= 5 },
      { name: '投壶高手', cat: '趣味', ok: potBest >= 5 },
      { name: '灯谜雅士', cat: '趣味', ok: riddleN >= 3 },
      { name: '御猫团宠', cat: '趣味', ok: plays >= 3 },
      { name: '摸狮得福', cat: '趣味', ok: (achievements.petLions || 0) >= 3 },
      { name: '河灯祈愿', cat: '趣味', ok: (achievements.lanterns || 0) >= 3 },
      { name: '宫中熟人', cat: '探索', ok: (achievements.asks || 0) >= 5 },
      { name: '雀跃', cat: '趣味', ok: (achievements.feedBirds || 0) >= 3 },
      { name: '心愿达成', cat: '趣味', ok: (achievements.wishes || 0) >= 3 },
      { name: '心香一瓣', cat: '趣味', ok: (achievements.incense || 0) >= 3 },
      { name: '图鉴收藏家', cat: '综合', ok: (achievements.codex || []).length >= 16 },
      { name: '千里之行', cat: '里程碑', ok: travel.dist >= 1000 },
      { name: '宫城常客', cat: '里程碑', ok: travel.dist >= 5000 },
      { name: '身轻如燕', cat: '里程碑', ok: travel.jumps >= 50 },
      { name: '流连忘返', cat: '里程碑', ok: travel.time >= 600 },
      { name: '紫禁城居民', cat: '综合', ok: disc >= 10 && questsDone >= 3 && spots >= 10 }
    ];
    const titleDone = titles.filter(function (x) { return x.ok; }).length;
    const rows = [
      { nm: '宫城探索', v: disc, max: DISCOVERIES.length },
      { nm: '任务完成', v: questsDone, max: QUESTS.length },
      { nm: '地标打卡', v: spots, max: DISCOVERIES.length },
      { nm: '拍下照片', v: achievements.photos, max: 20 },
      { nm: '投喂御猫', v: feeds, max: 5 },
      { nm: '逗猫玩耍', v: plays, max: 3 },
      { nm: '投壶最佳', v: Math.min(potBest, 6), max: 6 },
      { nm: '灯谜解谜', v: riddleN, max: 3 },
      { nm: '称号收集', v: titleDone, max: titles.length }
    ];
    let pctSum = 0;
    for (let i = 0; i < rows.length; i++) pctSum += Math.min(1, rows[i].v / rows[i].max);
    const pct = Math.round(pctSum / rows.length * 100);
    const groups = [];
    const groupOrder = ['任务', '探索', '趣味', '里程碑', '综合'];
    for (let gi = 0; gi < groupOrder.length; gi++) {
      const gname = groupOrder[gi];
      const arr = titles.filter(function (x) { return x.cat === gname; });
      if (arr.length) groups.push({ name: gname, items: arr });
    }
    return { rows: rows, titles: titles, groups: groups, titleDone: titleDone, titleTotal: titles.length, pct: pct, log: (achievements.log || []).slice() };
  }
  function refreshAchievements() {
    const d = achvData();
    const rowsEl = $('achvRows');
    if (rowsEl) {
      let html = '';
      for (let i = 0; i < d.rows.length; i++) {
        const r = d.rows[i];
        const p = Math.min(100, r.v / r.max * 100);
        html += '<div class="row"><span class="nm">' + r.nm + '</span><span class="bar"><i style="width:' + p + '%"></i></span><span class="val">' + r.v + ' / ' + r.max + '</span></div>';
      }
      rowsEl.innerHTML = html;
    }
    const tt = $('achvTitles');
    if (tt) {
      let html = '';
      html += '<div style="width:100%;display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-size:11px;letter-spacing:1px;color:rgba(230,224,208,.55)">称号收集</span><b style="color:var(--gold);font-weight:400;font-size:12px">' + d.titleDone + ' / ' + d.titleTotal + '</b></div>';
      for (let gi = 0; gi < d.groups.length; gi++) {
        const g = d.groups[gi];
        html += '<div style="width:100%;font-size:10px;letter-spacing:2px;color:rgba(230,224,208,.38);margin:8px 0 4px">' + g.name + '</div>';
        for (let i = 0; i < g.items.length; i++) {
          const it = g.items[i];
          html += '<span class="tt' + (it.ok ? '' : ' off') + '">' + (it.ok ? '★ ' : '☆ ') + it.name + '</span>';
        }
      }
      /* 图鉴 */
      html += '<div class="loglist" style="width:100%"><div class="lbl">宫中图鉴 · ' + ((achievements.codex || []).length) + ' / ' + CODEX_DATA.length + '</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (let ci = 0; ci < CODEX_DATA.length; ci++) {
        const c = CODEX_DATA[ci];
        const got = (achievements.codex || []).indexOf(c.id) >= 0;
        html += '<span class="tt' + (got ? '' : ' off') + '">' + (got ? '★ ' + c.name : '☆ ？？？') + '</span>';
      }
      html += '</div></div>';

      /* 最近解锁 */
      const recent = (d.log || []).slice(-8).reverse();
      if (recent.length) {
        html += '<div class="loglist" style="width:100%"><div class="lbl">最近解锁</div>';
        for (let li = 0; li < recent.length; li++) {
          const dtl = new Date(recent[li].t);
          const ds = (dtl.getMonth() + 1) + '月' + dtl.getDate() + '日 ' + ('0' + dtl.getHours()).slice(-2) + ':' + ('0' + dtl.getMinutes()).slice(-2);
          html += '<div class="li"><b>' + recent[li].name + '</b><span>' + ds + '</span></div>';
        }
        html += '</div>';
      }
      tt.innerHTML = html;
    }
    const tot = $('achvTotal');
    if (tot) {
      let th = '<div style="margin-bottom:10px;color:rgba(230,224,208,.55);font-size:11px;letter-spacing:1px">旅行日志</div>';
      const rowsT = travelStatsRows();
      for (let ti = 0; ti < rowsT.length; ti++) {
        th += '<div style="display:flex;justify-content:space-between;gap:16px;font-size:11.5px;letter-spacing:.5px;color:rgba(230,224,208,.75);margin:4px 0"><span>' + rowsT[ti][0] + '</span><b style="color:var(--gold);font-weight:400">' + rowsT[ti][1] + '</b></div>';
      }
      th += '<div style="margin-top:12px">行程完成度<b>' + d.pct + '%</b> · 称号 <b>' + d.titleDone + '/' + d.titleTotal + '</b> · 按 H 或 Esc 关闭</div>';
      tot.innerHTML = th;
    }
    return d;
  }
  function openAchievements(force) {
    const el = $('achv');
    if (!el) return null;
    const on = force == null ? !el.classList.contains('show') : !!force;
    if (!on) { el.classList.remove('show'); return null; }
    syncAchievementLog(false);
    const d = refreshAchievements();
    el.classList.add('show');
    return d;
  }

  /* =========================================================
   *  NPC 对话气泡（靠近侍卫/宫女触发，按宫区讲典故）
   * ======================================================= */
  const NPC_LINES = {
    gate: [
      '午门是紫禁城正门，五凤楼与雁翅楼东西相拥。',
      '过午门，前方就是太和门广场。',
      '宫中出入皆由午门，礼制森严。'
    ],
    taihe: [
      '太和殿俗称金銮殿，是大朝典礼之所。',
      '殿顶重檐庑殿，檐角走兽有十只，天下无双。',
      '丹陛上的日晷与嘉量，象征授时与统一。'
    ],
    backpalace: [
      '乾清宫是内廷正殿，殿内高悬「正大光明」匾。',
      '坤宁宫为皇后中宫，位正坤元。',
      '后三宫是帝后起居之处，闲人免进。'
    ],
    garden: [
      '御花园里有万春亭、千秋亭，四季皆有景致。',
      '堆秀山上御景亭，是重阳登高的地方。',
      '园中古柏奇石，都是几百年光景。'
    ],
    wall: [
      '角楼九梁十八柱七十二条脊，是宫城最精巧的楼。',
      '城墙高十米，护城河环绕宫城一周。',
      '马道可登城巡视，寻常人不可上。'
    ],
    maids: [
      '御花园的花开了，我带你去看看吧。',
      '宫里规矩多，走路要轻些。',
      '听说今晚宫灯会亮起来。'
    ],
    guards: [
      '宫中重地，请勿喧哗。',
      '这位客人，前面是太和殿广场。',
      '天色不早了，早些出宫吧。'
    ]
  };
  const bubbleEl = function () { return $('npcBubble'); };
  let bubbleLineIdx = 0;
  let bubbleTimer = 0;
  let bubbleNpcIdx = -1;
  function npcZoneKey() {
    const z = WALK.pos.z;
    if (z < -290) return 'garden';
    if (z < -110) return 'backpalace';
    if (z < 120) return 'taihe';
    if (Math.abs(WALK.pos.x) > 120) return 'wall';
    return 'gate';
  }
  function updateNpcBubble(dt) {
    const el = bubbleEl();
    if (!el) return;
    if (!WALK.active || typeof NPC === 'undefined') { el.classList.remove('show'); bubbleNpcIdx = -1; return; }
    /* 找最近的侍卫/宫女（巡逻 + 宫女） */
    let best = null, bestD = 7.5, bestName = '侍卫', bestId = -1;
    for (let i = 0; i < NPC.patrols.length; i++) {
      const o = NPC.patrols[i].obj.group;
      const d = Math.hypot(o.position.x - WALK.pos.x, o.position.z - WALK.pos.z);
      if (d < bestD) { bestD = d; best = NPC.patrols[i]; bestName = '侍卫'; bestId = i; }
    }
    for (let i = 0; i < NPC.maids.length; i++) {
      const o = NPC.maids[i].obj.group;
      const d = Math.hypot(o.position.x - WALK.pos.x, o.position.z - WALK.pos.z);
      if (d < bestD) { bestD = d; best = NPC.maids[i]; bestName = '宫女'; bestId = 100 + i; }
    }
    if (!best) { el.classList.remove('show'); bubbleNpcIdx = -1; bubbleTimer = 0; return; }
    /* 问路/对话覆盖台词 */
    if (window.__npcTalk && window.__npcTalk.t > 0) {
      window.__npcTalk.t -= dt;
      const whoT = $('npcWho'), lineT = $('npcLine');
      if (whoT) whoT.textContent = window.__npcTalk.who;
      if (lineT) lineT.textContent = window.__npcTalk.text;
      const p4 = new THREE.Vector3(best.obj.group.position.x, 2.25, best.obj.group.position.z).project(camera);
      el.style.left = ((p4.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      el.style.top = ((-p4.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      el.classList.add('show');
      if (window.__npcTalk.t <= 0) window.__npcTalk = null;
      return;
    }
    /* 换 NPC 立即换台词；同一 NPC 每 7 秒换一句 */
    if (bestId !== bubbleNpcIdx) { bubbleNpcIdx = bestId; bubbleTimer = 0; }
    bubbleTimer -= dt;
    if (bubbleTimer <= 0) {
      bubbleTimer = 7;
      let pool;
      if (bestName === '宫女') pool = NPC_LINES.maids;
      else {
        const zoneKey = npcZoneKey();
        pool = NPC_LINES.guards.slice(0);
        const zl = NPC_LINES[zoneKey];
        if (zl) pool = zl.concat(pool);
      }
      bubbleLineIdx = (bubbleLineIdx + 1 + Math.floor(Math.random() * 2)) % pool.length;
      const who = $('npcWho'), line = $('npcLine');
      if (who) who.textContent = bestName;
      if (line) line.textContent = pool[bubbleLineIdx];
    }
    /* 3D 头顶投影到屏幕 */
    const p3 = new THREE.Vector3(
      best.obj.group.position.x,
      2.25,
      best.obj.group.position.z
    ).project(camera);
    if (p3.z > 1 || p3.z < -1) { el.classList.remove('show'); return; }
    const sx = (p3.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-p3.y * 0.5 + 0.5) * window.innerHeight;
    if (sx < -80 || sx > window.innerWidth + 80 || sy < -40 || sy > window.innerHeight + 40) {
      el.classList.remove('show');
      return;
    }
    el.style.left = sx.toFixed(1) + 'px';
    el.style.top = (sy - 26).toFixed(1) + 'px';
    el.classList.add('show');
  }

  /* =========================================================
   *  天气系统（晴 / 阴 / 小雨）
   * ======================================================= */
  const WEATHER_MODES = {
    clear: { name: '晴', rain: 0, cloud: 0 },
    cloudy: { name: '阴', rain: 0.05, cloud: 0.85 },
    rain: { name: '小雨', rain: 1, cloud: 1 }
  };
  const weather = { mode: 'clear', rain: 0, cloud: 0, timer: 0, changedAt: 0 };
  function setWeather(mode, silent) {
    const w = WEATHER_MODES[mode] ? mode : 'clear';
    weather.mode = w;
    weather.timer = 0;
    if (typeof settings !== 'undefined') settings.weather = w;
    if (!silent) showToast('天气：' + WEATHER_MODES[w].name, 2400);
    saveSettings();
  }
  function updateWeather(dt) {
    const target = WEATHER_MODES[weather.mode] || WEATHER_MODES.clear;
    const k = 1 - Math.exp(-0.7 * (dt || 0.016));
    weather.rain += (target.rain - weather.rain) * k;
    weather.cloud += (target.cloud - weather.cloud) * k;
    weather.changedAt += dt;
    /* 自动天气变化 */
    if (settings.weatherAuto) {
      weather.timer += dt;
      if (weather.timer > 95) {
        weather.timer = 0;
        const order = ['clear', 'cloudy', 'rain'];
        const next = order[(order.indexOf(weather.mode) + 1) % order.length];
        setWeather(next);
      }
    }
    if (typeof EFFECTS !== 'undefined' && EFFECTS.setRain) EFFECTS.setRain(weather.rain);
    if (typeof MATS !== 'undefined') applyWetMaterials(weather.rain);
    if (typeof AUDIO !== 'undefined' && AUDIO.setRain) AUDIO.setRain(weather.rain);
    return weather;
  }
  /* 雨天湿润：地面材质变暗、粗糙度降低、反射增强 */
  const WET_MATS = ['paving', 'marble', 'marbleRail', 'stoneDark', 'terraceTop', 'brick', 'path', 'groundMottle'];
  const WET_COLOR = new THREE.Color(0x6d6a63);
  function applyWetMaterials(rain) {
    for (let i = 0; i < WET_MATS.length; i++) {
      const m = MATS[WET_MATS[i]];
      if (!m) continue;
      if (m.__wetRough == null) {
        m.__wetRough = (m.roughness == null ? 1 : m.roughness);
        m.__wetEnv = (m.envMapIntensity == null ? 1 : m.envMapIntensity);
        m.__wetColor = m.color ? m.color.clone() : null;
      }
      if (m.roughness != null) m.roughness = m.__wetRough * (1 - rain * 0.45) + 0.12 * rain;
      m.envMapIntensity = m.__wetEnv + (1.5 - m.__wetEnv) * rain;
      if (m.__wetColor && m.color) {
        m.color.copy(m.__wetColor).lerp(WET_COLOR, rain * 0.35);
      }
      m.needsUpdate = false;
    }
  }
  /* 天气对光照/天空/雾的叠加（在主题更新后调用） */
  const WEATHER_GREY = new THREE.Color(0x9aa4ac);
  function applyWeatherToScene() {
    const cloud = weather.cloud;
    const rain = weather.rain;
    const overcast = Math.max(cloud, rain * 0.7);
    if (overcast < 0.01) return;
    if (skyUniforms) {
      skyUniforms.topColor.value.lerp(WEATHER_GREY, overcast * 0.65);
      skyUniforms.bottomColor.value.lerp(WEATHER_GREY, overcast * 0.7);
    }
    if (fog) fog.color.lerp(WEATHER_GREY, overcast * 0.55);
    if (typeof fog !== 'undefined' && fog) {
      fog.density = (fog.__baseDensity || 0.00032) * (1 + overcast * 1.6);
    }
    if (typeof sun !== 'undefined' && sun) {
      sun.intensity *= 1 - overcast * 0.55;
      hemi.intensity *= 1 - overcast * 0.25;
      fill.intensity *= 1 - overcast * 0.2;
    }
  }

  /* =========================================================
   *  投壶小游戏（御花园 · 3 投时机判定）
   * ======================================================= */
  const POT_POS = { x: 18, z: -382, r: 3.4 };
  const minigame = { active: false, power: 0, dir: 1, throws: 0, score: 0, finished: false };
  let potGroup = null;
  function buildPot() {
    if (potGroup) return;
    const g = new THREE.Group();
    const bronze = MATS.bronze || MATS.goldDark;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.78, 14), bronze);
    body.position.y = 0.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 12), bronze);
    neck.position.y = 0.94;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 16), bronze);
    rim.position.y = 1.11; rim.rotation.x = Math.PI / 2;
    g.add(body, neck, rim);
    const arrowMat = MATS.rafter || MATS.wood || bronze;
    for (let i = 0; i < 3; i++) {
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 5), arrowMat);
      arrow.position.set(-0.55 - i * 0.16, 0.32, 0.18 * (i - 1));
      arrow.rotation.z = 0.5;
      arrow.rotation.x = 0.25;
      g.add(arrow);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.16, 16), MATS.marbleRail);
    base.position.y = 0.07;
    g.add(base);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(POT_POS.x, 0, POT_POS.z);
    scene.add(g);
    potGroup = g;
  }
  function nearPot() {
    if (!WALK.active) return false;
    return Math.hypot(WALK.pos.x - POT_POS.x, WALK.pos.z - POT_POS.z) < POT_POS.r;
  }
  function minigameHud() {
    const el = $('minigame');
    const sc = $('mgScore');
    const pw = $('mgPower');
    if (el) el.classList.toggle('show', minigame.active);
    if (sc && minigame.active) {
      sc.textContent = '第 ' + Math.min(3, minigame.finished ? 3 : minigame.throws + 1) + ' / 3 投 · 当前 ' + minigame.score + ' 分';
    }
    if (pw) pw.style.width = (minigame.power * 100).toFixed(1) + '%';
  }
  function startMinigame() {
    if (!WALK.active) return false;
    if (minigame.active) return true;
    minigame.active = true;
    minigame.power = 0;
    minigame.dir = 1;
    minigame.throws = 0;
    minigame.score = 0;
    minigame.finished = false;
    buildPot();
  buildCatNest();
    minigameHud();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    showToast('投壶开始：力度条来回摆动，在中间标记处按空格投出（3 投）', 4200);
    return true;
  }
  function stopMinigame(silent) {
    if (!minigame.active) return;
    minigame.active = false;
    minigameHud();
    if (!silent) showToast('已退出投壶', 2000);
  }
  function throwArrow() {
    if (!minigame.active || minigame.finished) return null;
    const off = Math.abs(minigame.power - 0.5);
    let pts = 0, msg = '';
    if (off < 0.06) { pts = 2; msg = '投中！+2'; }
    else if (off < 0.17) { pts = 1; msg = '擦壶而过 +1'; }
    else { pts = 0; msg = '未中'; }
    minigame.score += pts;
    minigame.throws++;
    if (typeof AUDIO !== 'undefined') {
      if (pts > 0 && AUDIO.discover) AUDIO.discover();
      else if (AUDIO.chime) AUDIO.chime();
    }
    showToast('第 ' + minigame.throws + ' 投：' + msg + '（总分 ' + minigame.score + '）', 2600);
    if (minigame.throws >= 3) {
      minigame.finished = true;
      achievements.potGames = (achievements.potGames || 0) + 1;
      if (!achievements.potBest || minigame.score > achievements.potBest) achievements.potBest = minigame.score;
      achievementsSave();
      setTimeout(function () {
        minigame.active = false;
        minigameHud();
        showToast('投壶结束：' + minigame.score + ' 分' + (minigame.score >= 5 ? ' · 称号「投壶高手」' : ' · 再来一次？'), 5200);
        if (minigame.score >= 5 && typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
      }, 1200);
    }
    minigameHud();
    return { pts: pts, score: minigame.score, throws: minigame.throws };
  }
  function updateMinigame(dt) {
    if (!minigame.active || minigame.finished) { minigameHud(); return; }
    const speed = 0.85 + Math.min(0.7, minigame.throws * 0.22);
    minigame.power += minigame.dir * speed * dt;
    if (minigame.power >= 1) { minigame.power = 1; minigame.dir = -1; }
    if (minigame.power <= 0) { minigame.power = 0; minigame.dir = 1; }
    minigameHud();
  }

  /* =========================================================
   *  猜灯谜（宫灯互动）
   * ======================================================= */
  const RIDDLE_SPOTS = [
    { x: 0, z: -160, r: 3.6, idx: 0 },
    { x: 0, z: -320, r: 3.8, idx: 1 },
    { x: 0, z: 240, r: 3.6, idx: 2 }
  ];
  const RIDDLES = [
    {
      q: '千条线，万条线，掉到水里看不见。（打一自然现象）',
      opts: ['雨', '风', '雪'],
      ans: 0
    },
    {
      q: '五个兄弟，住在一起，名字不同，高矮不齐。（打一身体部位）',
      opts: ['牙齿', '手指', '脚趾'],
      ans: 1
    },
    {
      q: '有面没有口，有脚没有手，虽有四只脚，自己不会走。（打一物）',
      opts: ['椅子', '桌子', '铜缸'],
      ans: 1
    }
  ];
  const riddle = { active: false, spot: -1, riddleIdx: -1 };
  function solvedRiddles() {
    if (!Array.isArray(achievements.riddles)) achievements.riddles = achievements.riddles || [];
    return achievements.riddles;
  }
  function nearRiddle() {
    if (!WALK.active) return null;
    for (let i = 0; i < RIDDLE_SPOTS.length; i++) {
      const s = RIDDLE_SPOTS[i];
      if (Math.hypot(WALK.pos.x - s.x, WALK.pos.z - s.z) < s.r) return s;
    }
    return null;
  }
  function renderRiddle() {
    const el = $('riddle');
    if (!el) return;
    if (!riddle.active) { el.classList.remove('show'); return; }
    const r = RIDDLES[riddle.riddleIdx];
    if (!r) { el.classList.remove('show'); return; }
    const q = $('rdQ'), opts = $('rdOpts'), head = $('rdHead');
    if (head) head.textContent = '宫灯 · 灯谜（' + (solvedRiddles().length) + '/3 已解）';
    if (q) q.textContent = r.q;
    if (opts) {
      let html = '';
      for (let i = 0; i < r.opts.length; i++) {
        html += '<div class="rd-opt" data-i="' + i + '"><b>' + (i + 1) + '</b><span>' + r.opts[i] + '</span></div>';
      }
      opts.innerHTML = html;
      const items = opts.querySelectorAll('.rd-opt');
      for (let k = 0; k < items.length; k++) {
        items[k].addEventListener('click', function () {
          answerRiddle(parseInt(this.getAttribute('data-i'), 10));
        });
      }
    }
    el.classList.add('show');
  }
  function openRiddle() {
    const s = nearRiddle();
    if (!s) return false;
    const solved = solvedRiddles();
    if (solved.indexOf(s.idx) >= 0) {
      showToast('这盏宫灯的谜题已经解开了（' + solved.length + '/3）', 2600);
      return false;
    }
    riddle.active = true;
    riddle.spot = s.idx;
    riddle.riddleIdx = s.idx;
    renderRiddle();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    return true;
  }
  function closeRiddle() {
    riddle.active = false;
    const el = $('riddle');
    if (el) el.classList.remove('show');
  }
  function answerRiddle(i) {
    if (!riddle.active) return null;
    const r = RIDDLES[riddle.riddleIdx];
    if (!r) return null;
    const solved = solvedRiddles();
    let ok = false;
    if (i === r.ans) {
      ok = true;
      if (solved.indexOf(riddle.riddleIdx) < 0) solved.push(riddle.riddleIdx);
      achievementsSave();
      showToast('答对了！' + (i === r.ans ? '' : '') + '（已解 ' + solved.length + '/3）', 3000);
      if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
      if (solved.length >= 3) {
        setTimeout(function () { showToast('称号达成 · 灯谜雅士（三盏宫灯谜题全解）', 5200); }, 3200);
      }
      closeRiddle();
    } else {
      showToast('不对，再想想（提示：' + r.opts.join(' / ') + '）', 3200);
      if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
    }
    return { ok: ok, solved: solved.length };
  }

  /* =========================================================
   *  环境音调度：钟声 / 鸽哨 / 猫叫 / 雨停滴水
   * ======================================================= */
  const AMBIENT = {
    bell: { t: 40 + Math.random() * 60, n: 0 },
    pigeon: { t: 18 + Math.random() * 30, n: 0 },
    meow: { t: 15 + Math.random() * 20, n: 0 },
    drip: { t: 1, n: 0 },
    windchime: { t: 12 + Math.random() * 18, n: 0 },
    patter: { t: 4 + Math.random() * 5, n: 0 },
    cricket: { t: 6 + Math.random() * 8, n: 0 }
  };
  function updateAmbientAudio(dt) {
    if (typeof AUDIO === 'undefined' || !AUDIO.ready) return;
    if (!WALK.active) return;
    const zone = WALK._zone || 'plaza';
    const rain = (typeof weather !== 'undefined') ? weather.rain : 0;

    AMBIENT.bell.t -= dt;
    if (AMBIENT.bell.t <= 0) {
      AMBIENT.bell.t = 75 + Math.random() * 70;
      AMBIENT.bell.n++;
      if (AUDIO.bell) AUDIO.bell();
    }

    AMBIENT.pigeon.t -= dt;
    if (AMBIENT.pigeon.t <= 0) {
      AMBIENT.pigeon.t = 22 + Math.random() * 38;
      if (rain < 0.4 && zone !== 'interior') {
        AMBIENT.pigeon.n++;
        if (AUDIO.pigeon) AUDIO.pigeon();
      }
    }

    AMBIENT.meow.t -= dt;
    if (AMBIENT.meow.t <= 0) {
      AMBIENT.meow.t = 18 + Math.random() * 30;
      let near = 1e9;
      if (typeof NPC !== 'undefined' && NPC.cats) {
        for (let i = 0; i < NPC.cats.length; i++) {
          const cp = NPC.cats[i].obj.group.position;
          const d = Math.hypot(cp.x - WALK.pos.x, cp.z - WALK.pos.z);
          if (d < near) near = d;
        }
      }
      if (near < 12) {
        AMBIENT.meow.n++;
        if (AUDIO.meow) AUDIO.meow();
      }
    }

    AMBIENT.cricket.t -= dt;
    if (AMBIENT.cricket.t <= 0) {
      AMBIENT.cricket.t = 4 + Math.random() * 7;
      if (currentTheme === 'night' && zone !== 'interior' && rain < 0.5) {
        AMBIENT.cricket.n++;
        if (AUDIO.cricket) AUDIO.cricket();
      }
    }

    AMBIENT.patter.t -= dt;
    if (AMBIENT.patter.t <= 0) {
      AMBIENT.patter.t = 4 + Math.random() * 5;
      let nearUmb = false;
      if (rain > 0.45 && typeof NPC !== 'undefined') {
        const groups = [];
        if (NPC.patrols) for (let i = 0; i < NPC.patrols.length; i++) groups.push(NPC.patrols[i].obj.group);
        if (NPC.maids) for (let i = 0; i < NPC.maids.length; i++) groups.push(NPC.maids[i].obj.group);
        for (let i = 0; i < groups.length; i++) {
          if (Math.hypot(groups[i].position.x - WALK.pos.x, groups[i].position.z - WALK.pos.z) < 13) { nearUmb = true; break; }
        }
      }
      if (nearUmb) { AMBIENT.patter.n++; if (AUDIO.umbrellaPatter) AUDIO.umbrellaPatter(); }
    }

    AMBIENT.windchime.t -= dt;
    if (AMBIENT.windchime.t <= 0) {
      AMBIENT.windchime.t = 16 + Math.random() * 26;
      if (zone !== 'interior' && rain < 0.4) {
        AMBIENT.windchime.n++;
        if (AUDIO.windchime) AUDIO.windchime();
      }
    }

    AMBIENT.drip.t -= dt;
    if (AMBIENT.drip.t <= 0) {
      AMBIENT.drip.t = 0.6 + Math.random() * 2.2;
      if (rain > 0.03 && rain < 0.3) {
        AMBIENT.drip.n++;
        if (AUDIO.drip) AUDIO.drip();
      }
    }
  }

  /* =========================================================
   *  旅行日志：行走距离 / 游览时长 / 跳跃次数 / 里程碑
   * ======================================================= */
  const TRAVEL_KEY = 'forbidden-city-travel-v1';
  const travel = { dist: 0, time: 0, jumps: 0, miles: {} };
  try {
    const savedTr = JSON.parse(localStorage.getItem(TRAVEL_KEY) || '{}');
    if (savedTr && typeof savedTr === 'object') {
      travel.dist = Number(savedTr.dist) || 0;
      travel.time = Number(savedTr.time) || 0;
      travel.jumps = Number(savedTr.jumps) || 0;
      travel.miles = savedTr.miles && typeof savedTr.miles === 'object' ? savedTr.miles : {};
    }
  } catch (e) {}
  function travelSave() {
    try {
      localStorage.setItem(TRAVEL_KEY, JSON.stringify({
        dist: Math.round(travel.dist), time: Math.round(travel.time), jumps: travel.jumps, miles: travel.miles
      }));
    } catch (e) {}
  }
  const TRAVEL_MILESTONES = [
    { id: 'walk500', test: function () { return travel.dist >= 500; }, text: '已步行 500 米' },
    { id: 'walk1000', test: function () { return travel.dist >= 1000; }, text: '里程碑：千里之行（步行 1 公里）', title: '千里之行' },
    { id: 'walk5000', test: function () { return travel.dist >= 5000; }, text: '里程碑：宫城常客（步行 5 公里）', title: '宫城常客' },
    { id: 'time600', test: function () { return travel.time >= 600; }, text: '已游览 10 分钟', title: '流连忘返' },
    { id: 'jump50', test: function () { return travel.jumps >= 50; }, text: '已跳跃 50 次', title: '身轻如燕' }
  ];
  function checkTravelMilestones() {
    for (let i = 0; i < TRAVEL_MILESTONES.length; i++) {
      const m = TRAVEL_MILESTONES[i];
      if (travel.miles[m.id]) continue;
      if (!m.test()) continue;
      travel.miles[m.id] = true;
      travelSave();
      showToast('旅行日志 · ' + m.text, 3200);
      if (m.title && typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
    }
  }
  let lastTravelPos = null;
  function updateTravel(dt) {
    if (!WALK.active) { lastTravelPos = null; return; }
    travel.time += dt;
    if (lastTravelPos) {
      travel.dist += lastTravelPos.distanceTo(WALK.pos);
    }
    lastTravelPos = WALK.pos.clone();
    travel.jumps = WALK.jumps || travel.jumps;
    checkTravelMilestones();
  }
  function travelStatsRows() {
    const towns = travel.dist >= 1000 ? (travel.dist / 1000).toFixed(2) + ' km' : Math.round(travel.dist) + ' m';
    const mins = Math.floor(travel.time / 60);
    const secs = Math.floor(travel.time % 60);
    return [
      ['行走距离', towns],
      ['游览时长', mins + ' 分 ' + secs + ' 秒'],
      ['跳跃次数', String(travel.jumps)],
      ['相册照片', String(achievements.photos || 0)]
    ];
  }

  /* =========================================================
   *  世界任务指引（目标标记 + 屏幕边缘箭头）
   * ======================================================= */
  function getObjectiveTarget() {
    /* 优先：未完成任务线的下一步 → 其次：未发现地标 */
    for (let qi = 0; qi < QUESTS.length; qi++) {
      const q = QUESTS[qi];
      if (q.done || q.progress >= q.steps.length) continue;
      const st = q.steps[q.progress];
      if (st.t === 'lm') {
        const d = DISCOVERIES[st.i];
        if (d) return { x: d.x, z: d.z, label: q.name + ' · ' + d.name };
      } else if (st.t === 'pos') {
        return { x: st.x, z: st.z, label: q.name + ' · ' + st.label };
      } else if (st.t === 'cat') {
        if (typeof NPC !== 'undefined' && NPC.cats && NPC.cats[st.i]) {
          const cp = NPC.cats[st.i].obj.group.position;
          return { x: cp.x, z: cp.z, label: q.name + ' · 找到御猫' };
        }
      }
    }
    let best = null, bestD = 1e9;
    for (let i = 0; i < DISCOVERIES.length; i++) {
      if (discSet[i]) continue;
      const d = DISCOVERIES[i];
      const dd = Math.hypot(d.x - WALK.pos.x, d.z - WALK.pos.z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    if (best) return { x: best.x, z: best.z, label: '探索 · ' + best.name };
    return null;
  }
  function updateObjectiveGuide() {
    const mk = $('objMarker'), ar = $('objArrow'), lb = $('objLabel');
    if (!mk || !ar) return;
    if (!WALK.active || settings.objective === false) {
      mk.classList.remove('show'); ar.classList.remove('show');
      return;
    }
    const target = getObjectiveTarget();
    if (!target) { mk.classList.remove('show'); ar.classList.remove('show'); return; }
    const dx = target.x - camera.position.x;
    const dz = target.z - camera.position.z;
    const dist = Math.hypot(target.x - WALK.pos.x, target.z - WALK.pos.z);
    const v = new THREE.Vector3(target.x, 2.2, target.z).project(camera);
    const W2 = window.innerWidth, H2 = window.innerHeight;
    const behind = (v.z > 1) || (v.z < -1);
    const sx = (v.x * 0.5 + 0.5) * W2;
    const sy = (-v.y * 0.5 + 0.5) * H2;
    const margin = 60;
    const onScreen = !behind && sx > margin && sx < W2 - margin && sy > margin && sy < H2 - margin;
    if (onScreen) {
      ar.classList.remove('show');
      mk.classList.add('show');
      mk.style.left = sx.toFixed(1) + 'px';
      mk.style.top = sy.toFixed(1) + 'px';
      if (lb) lb.textContent = target.label + ' · ' + Math.round(dist) + 'm';
    } else {
      mk.classList.remove('show');
      ar.classList.add('show');
      /* 计算屏幕中心指向目标的方向（处理在身后时翻转） */
      let ax = sx - W2 / 2;
      let ay = sy - H2 / 2;
      if (behind) { ax = -ax; ay = -ay; }
      const ang = Math.atan2(ay, ax);
      const R = Math.min(W2, H2) * 0.36;
      const ex = W2 / 2 + Math.cos(ang) * R;
      const ey = H2 / 2 + Math.sin(ang) * R;
      ar.style.left = (ex - 17).toFixed(1) + 'px';
      ar.style.top = (ey - 17).toFixed(1) + 'px';
      ar.style.transform = 'rotate(' + ang + 'rad)';
      ar.title = target.label;
      ar.setAttribute('aria-label', target.label + ' ' + Math.round(dist) + 'm');
    }
  }

  /* =========================================================
   *  节庆灯会：主轴上挂红灯笼与幡旗（可开关）
   * ======================================================= */
  let festivalGroup = null;
  let festivalRefs = null;
  let festivalCount = 0;
  function buildFestival() {
    if (festivalGroup) return;
    const g = new THREE.Group();
    g.name = 'festival';
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.9 });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xc8322a, roughness: 0.55, metalness: 0.05,
      emissive: 0xff3a22, emissiveIntensity: 0.55
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd8b45f, roughness: 0.5, metalness: 0.5 });
    const spots = [];
    /* 外朝：御道两侧（午门 → 太和门） */
    for (let z = 300; z <= 450; z += 9) {
      spots.push([-7.6, z]); spots.push([7.6, z]);
    }
    /* 内廷：乾清门 → 坤宁宫 */
    for (let z = -260; z <= -130; z += 9) {
      spots.push([-6.2, z]); spots.push([6.2, z]);
    }
    /* 御花园入口 */
    for (let x = -30; x <= 30; x += 10) spots.push([x, -300]);
    festivalCount = spots.length;
    const poleGeo = new THREE.CylinderGeometry(0.055, 0.07, 2.7, 6);
    const bodyGeo = new THREE.SphereGeometry(0.26, 10, 8);
    bodyGeo.scale(1, 1.15, 1);
    const capGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.08, 8);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, spots.length);
    const caps = new THREE.InstancedMesh(capGeo, capMat, spots.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < spots.length; i++) {
      const x = spots[i][0], z = spots[i][1];
      m4.makeTranslation(x, 1.35, z);
      poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, 2.85, z);
      bodies.setMatrixAt(i, m4);
      m4.makeTranslation(x, 3.14, z);
      caps.setMatrixAt(i, m4);
    }
    poles.castShadow = true;
    bodies.castShadow = false;
    poles.instanceMatrix.needsUpdate = true;
    bodies.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    g.add(poles, bodies, caps);
    /* 幡旗：沿御道交叉悬挂（简化为扁平长条） */
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xb3271f, roughness: 0.8, side: THREE.DoubleSide });
    const flagGeo = new THREE.PlaneGeometry(0.5, 1.1);
    const flags = new THREE.InstancedMesh(flagGeo, flagMat, 12);
    const e = new THREE.Euler(0, 0, 0.12);
    const q = new THREE.Quaternion().setFromEuler(e);
    const s = new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      v.set((i % 2 === 0 ? -7.6 : 7.6), 2.2, 310 + Math.floor(i / 2) * 24);
      m4.compose(v, q, s);
      flags.setMatrixAt(i, m4);
    }
    flags.instanceMatrix.needsUpdate = true;
    g.add(flags);
    g.visible = !!settings.festival;
    festivalRefs = { bodies: bodies, caps: caps, flags: flags, spots: spots, m4: m4, q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), v: new THREE.Vector3() };
    scene.add(g);
    festivalGroup = g;
  }
  function updateFestivalSway() {
    const r = festivalRefs;
    if (!r || !festivalGroup || !festivalGroup.visible) return;
    const tt = performance.now() * 0.001;
    for (let i = 0; i < r.spots.length; i++) {
      const x = r.spots[i][0], z = r.spots[i][1];
      const ph = i * 1.7;
      const sway = Math.sin(tt * 1.1 + ph) * 0.045;
      const sway2 = Math.cos(tt * 0.9 + ph * 0.7) * 0.04;
      r.e.set(sway2, 0, sway);
      r.q.setFromEuler(r.e);
      r.v.set(x, 2.85, z);
      r.m4.compose(r.v, r.q, r.s);
      r.bodies.setMatrixAt(i, r.m4);
      r.v.set(x + sway * 0.6, 3.14, z + sway2 * 0.6);
      r.m4.compose(r.v, r.q, r.s);
      r.caps.setMatrixAt(i, r.m4);
    }
    r.bodies.instanceMatrix.needsUpdate = true;
    r.caps.instanceMatrix.needsUpdate = true;
    /* 幡旗飘动 */
    const fq = new THREE.Quaternion();
    const fe = new THREE.Euler(0, 0, 0);
    for (let f = 0; f < 12; f++) {
      fe.set(Math.sin(tt * 2.2 + f) * 0.10, Math.sin(tt * 1.4 + f) * 0.25, 0.12 + Math.sin(tt * 2.6 + f) * 0.06);
      fq.setFromEuler(fe);
      r.v.set((f % 2 === 0 ? -7.6 : 7.6), 2.2, 310 + Math.floor(f / 2) * 24);
      r.m4.compose(r.v, fq, r.s);
      r.flags.setMatrixAt(f, r.m4);
    }
    r.flags.instanceMatrix.needsUpdate = true;
  }
  function setFestival(on, silent) {
    settings.festival = !!on;
    buildFestival();
    festivalGroup.visible = !!settings.festival;
    const cb = $('optFestival');
    if (cb) cb.checked = !!settings.festival;
    saveSettings();
    if (!silent) showToast(settings.festival ? '节庆灯会：开启（主轴红灯笼）' : '节庆灯会：关闭', 2600);
  }

  /* =========================================================
   *  御猫小窝 + 逗猫棒（御花园）
   * ======================================================= */
  const CAT_NEST = { x: 58, z: -330, r: 4.2 };
  let catNestGroup = null;
  function buildCatNest() {
    if (catNestGroup) return;
    const g = new THREE.Group();
    const wicker = new THREE.MeshStandardMaterial({ color: 0x9a7440, roughness: 0.9 });
    const cushion = new THREE.MeshStandardMaterial({ color: 0x8d2f2a, roughness: 0.95 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 0.34, 16), wicker);
    bowl.position.y = 0.17;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 16), cushion);
    pad.position.y = 0.36;
    g.add(bowl, pad);
    /* 逗猫棒：斜靠木杆 + 羽毛 */
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6), MATS.rafter || wicker);
    stick.position.set(1.2, 0.8, 0.5);
    stick.rotation.z = 0.55;
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 6), MATS.goldDark || wicker);
    feather.position.set(1.66, 1.5, 0.5);
    feather.rotation.z = -0.4;
    g.add(stick, feather);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(CAT_NEST.x, 0, CAT_NEST.z);
    scene.add(g);
    catNestGroup = g;
  }
  function nearCatNest() {
    if (!WALK.active) return false;
    return Math.hypot(WALK.pos.x - CAT_NEST.x, WALK.pos.z - CAT_NEST.z) < CAT_NEST.r;
  }
  function playWithCats() {
    if (!nearCatNest()) return 0;
    buildCatNest();
    let n = 0;
    if (typeof NPC !== 'undefined' && NPC.playCatNear) n = NPC.playCatNear(WALK.pos.x, WALK.pos.z, 26, 3);
    achievements.catPlays = (achievements.catPlays || 0) + 1;
    achievementsSave();
    if (n > 0) {
      showToast('逗猫棒 · ' + n + ' 只御猫跑来了（玩耍 ' + achievements.catPlays + ' 次）', 3600);
      if (typeof AUDIO !== 'undefined' && AUDIO.meow) AUDIO.meow();
    } else {
      showToast('附近没有御猫，去御花园找找吧', 2600);
    }
    return n;
  }

  /* =========================================================
   *  漫游性能 HUD（FPS / draw calls / 三角面 / 画质 / 区域）
   * ======================================================= */
  const ZONE_LABELS = { plaza: '广场', garden: '御花园', interior: '殿内' };
  let perfAcc = 0, perfFps = 0, perfTimer = 0;
  /* =========================================================
   *  性能守护：持续低帧时自动降低粒子密度
   * ======================================================= */
  const perfGovernor = { t: 0, sum: 0, n: 0, lowT: 0, highT: 0, downgraded: false, lastAvgFps: 60 };
  function updatePerfGovernor(dt) {
    if (!WALK.active || dt <= 0) return;
    const fps = 1 / Math.max(dt, 0.0001);
    perfGovernor.sum += Math.min(fps, 240);
    perfGovernor.n++;
    perfGovernor.t += dt;
    if (perfGovernor.t < 2) return;
    const avg = perfGovernor.sum / Math.max(1, perfGovernor.n);
    perfGovernor.lastAvgFps = Math.round(avg);
    perfGovernor.t = 0; perfGovernor.sum = 0; perfGovernor.n = 0;
    if (avg < 38) {
      perfGovernor.lowT += 2;
      perfGovernor.highT = 0;
    } else if (avg > 55) {
      perfGovernor.highT += 2;
      perfGovernor.lowT = 0;
    } else {
      perfGovernor.lowT = 0;
      perfGovernor.highT = 0;
    }
    if (perfGovernor.lowT >= 6 && !perfGovernor.downgraded) {
      perfGovernor.downgraded = true;
      if (typeof EFFECTS !== 'undefined' && EFFECTS.setLod) EFFECTS.setLod(0.45);
      showToast('帧率偏低 · 已自动降低粒子密度（性能守护）', 3600);
    } else if (perfGovernor.highT >= 8 && perfGovernor.downgraded) {
      perfGovernor.downgraded = false;
      if (typeof EFFECTS !== 'undefined' && EFFECTS.setLod) EFFECTS.setLod(1);
      showToast('帧率恢复 · 粒子密度已还原', 3000);
    }
  }

  function updatePerfHud(dt) {
    const el = $('perfhud');
    if (!el) return;
    const on = !!settings.perfhud;
    document.body.classList.toggle('perfshow', on);
    if (!on || !WALK.active) return;
    if (dt > 0) {
      const fps = 1 / Math.max(1e-4, dt);
      perfFps = perfFps ? perfFps * 0.9 + fps * 0.1 : fps;
    }
    perfTimer += dt;
    if (perfTimer < 0.2) return;
    perfTimer = 0;
    const info = (renderer && renderer.info) ? renderer.info.render : { calls: 0, triangles: 0 };
    const zone = (WALK.zoneAt && WALK.zoneAt(WALK.pos.x, WALK.pos.z)) || 'plaza';
    el.innerHTML =
      '<div>FPS <b>' + Math.round(perfFps) + '</b> · Draws <b>' + info.calls + '</b> · Tris <b>' + (info.triangles ? (info.triangles / 1e6).toFixed(2) + 'M' : '0') + '</b></div>' +
      '<div>画质 <b>' + (settings.quality || 'auto') + '</b> · 区域 <b>' + (ZONE_LABELS[zone] || zone) + '</b> · 位置 <b>' + Math.round(WALK.pos.x) + ', ' + Math.round(WALK.pos.z) + '</b></div>';
  }
  function togglePerfHud() {
    settings.perfhud = !settings.perfhud;
    saveSettings();
    if (!settings.perfhud) document.body.classList.remove('perfshow');
    showToast(settings.perfhud ? '性能 HUD：开（F 键切换）' : '性能 HUD：关', 1800);
    return settings.perfhud;
  }

  /* =========================================================
   *  新手引导（首次漫游分步教学）
   * ======================================================= */
  const TUTORIAL_KEY = 'forbidden-city-tutorial-v1';
  const TUTORIAL_STEPS = [
    { text: '用 <b>W A S D</b> 在宫中走动，视角可用鼠标拖拽环视。', hint: '走两步试试' },
    { text: '按 <b>空格</b> 跳跃；按住 <b>Shift</b> 可疾行。', hint: '跳一下' },
    { text: '走近陈设或御猫，按 <b>E</b> 互动（查看/投喂/逗猫）。', hint: '找最近的互动点' },
    { text: '按 <b>P</b> 拍照留念，<b>G</b> 打开相册。', hint: '拍一张照片' }
  ];
  const tutorial = {
    active: false, step: 0, done: false,
    baseDist: 0, baseJumps: 0, basePhotos: 0
  };
  try { tutorial.done = localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (e) {}
  function tutorialSave() {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
  }
  function tutorialShow() {
    const el = $('tutorial');
    if (!el || tutorial.done) return;
    tutorial.active = true;
    tutorial.step = 0;
    tutorial.baseDist = travel.dist;
    tutorial.baseJumps = WALK.jumps || 0;
    tutorial.basePhotos = achievements.photos || 0;
    el.classList.add('show');
    tutorialRender();
  }
  function tutorialHide(skipped) {
    tutorial.active = false;
    const el = $('tutorial');
    if (el) el.classList.remove('show');
    if (skipped) { tutorial.done = true; tutorialSave(); showToast('已跳过新手引导（可在设置中重新体验）', 2600); }
  }
  function tutorialRender() {
    const text = $('tuText'), dots = $('tuDots'), stepEl = $('tuStep');
    if (!text) return;
    text.innerHTML = TUTORIAL_STEPS[tutorial.step].text;
    if (dots) {
      let html = '';
      for (let i = 0; i < TUTORIAL_STEPS.length; i++) html += '<i class="' + (i <= tutorial.step ? 'on' : '') + '"></i>';
      dots.innerHTML = html;
    }
    if (stepEl) stepEl.textContent = (tutorial.step + 1) + ' / ' + TUTORIAL_STEPS.length;
  }
  function tutorialCompleteStep() {
    if (!tutorial.active) return;
    tutorial.step++;
    if (tutorial.step >= TUTORIAL_STEPS.length) {
      tutorial.active = false;
      tutorial.done = true;
      tutorialSave();
      const el = $('tutorial');
      if (el) el.classList.remove('show');
      showToast('新手引导完成 · 开始你的紫禁城之旅！', 3600);
      if (typeof AUDIO !== 'undefined' && AUDIO.discover) AUDIO.discover();
      return;
    }
    tutorialRender();
    if (typeof AUDIO !== 'undefined' && AUDIO.chime) AUDIO.chime();
  }
  function updateTutorial(dt) {
    if (!tutorial.active || !WALK.active) return;
    if (tutorial.step === 0) {
      if (travel.dist - tutorial.baseDist > 2.2) tutorialCompleteStep();
    } else if (tutorial.step === 1) {
      if ((WALK.jumps || 0) - tutorial.baseJumps >= 1) tutorialCompleteStep();
    } else if (tutorial.step === 2) {
      if (achievements.interacts && achievements.interacts > 0) tutorialCompleteStep();
    } else if (tutorial.step === 3) {
      if ((achievements.photos || 0) - tutorial.basePhotos >= 1) tutorialCompleteStep();
    }
  }
  function tutorialReset() {
    tutorial.done = false;
    try { localStorage.removeItem(TUTORIAL_KEY); } catch (e) {}
    tutorialShow();
    return tutorial.step;
  }

  /* =========================================================
   *  氛围预设（时段 + 天气 + 灯会组合）
   * ======================================================= */
  const SCENE_PRESETS = {
    day_clear: { name: '晴日宫城', theme: 'day', weather: 'clear', festival: false, label: '晴日宫城' },
    dusk_festival: { name: '黄昏灯会', theme: 'dusk', weather: 'clear', festival: true, label: '黄昏灯会' },
    night_rain: { name: '夜雨灯会', theme: 'night', weather: 'rain', festival: true, label: '夜雨灯会' },
    snow_night: { name: '雪夜宫灯', theme: 'snow', weather: 'clear', festival: true, label: '雪夜宫灯' }
  };
  function applyScenePreset(id) {
    const pr = SCENE_PRESETS[id];
    if (!pr) return null;
    if (settings.autoCycle) { settings.autoCycle = false; const oc = $('optAutoCycle'); if (oc) oc.checked = false; saveSettings(); }
    setTheme(pr.theme);
    setWeather(pr.weather, true);
    setFestival(pr.festival, true);
    const btns = document.querySelectorAll('#presets button');
    for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-preset') === id);
    showToast('氛围预设 · ' + pr.label, 2800);
    return { id: id, theme: pr.theme, weather: pr.weather, festival: pr.festival };
  }

  function toggleWalk(force) {
    const on = force == null ? !WALK.active : !!force;
    if (on) {
      if (TOUR.active) TOUR.stop(false);
      WALK.enter(scene);
      document.body.classList.add('walking');
      $('walkhint').classList.add('show');
      $('btnWalk').classList.add('on');
      refreshWalkGame();
      buildQuestHud();
      tutorialShow();
      showToast('漫游模式：WASD 移动 · 空格跳跃 · Shift 疾行 · X 视角 · H 总览 · P 拍照 · Esc 退出', 4200);
    } else {
      WALK.exit();
      document.body.classList.remove('walking');
      document.body.classList.remove('perfshow');
      $('walkhint').classList.remove('show');
      $('btnWalk').classList.remove('on');
      ctrl.syncFromCamera();
      ctrl.setView(VIEWS[currentView], false);
    }
  }

  function bindUI() {
    const themeBtns = $('themes').querySelectorAll('button');
    for (let i = 0; i < themeBtns.length; i++) {
      themeBtns[i].addEventListener('click', function () {
        const name = this.getAttribute('data-theme');
        if (settings.autoCycle) {
          settings.autoCycle = false;
        settings.festival = false;
        if (festivalGroup) festivalGroup.visible = false;
        weather.rain = 0; weather.cloud = 0; weather.mode = 'clear'; settings.weatherAuto = false;
          const oc = $('optAutoCycle');
          if (oc) oc.checked = false;
          saveSettings();
        }
        setTheme(name);
        showToast('时段：' + CONFIG.themes[name].label);
      });
    }
    $('btnLabels').addEventListener('click', function () { toggleLabels(); });
    $('btnTour').addEventListener('click', function () {
      if (TOUR.active) TOUR.stop(true); else TOUR.start();
    });
    $('btnTourPause').addEventListener('click', function () { TOUR.togglePause(); });
    $('btnTourExit').addEventListener('click', function () { TOUR.stop(true); });
    $('btnCinema').addEventListener('click', function () { toggleCinema(); });
    $('btnWalk').addEventListener('click', function () { toggleWalk(); });
    $('btnSettings').addEventListener('click', function () { $('drawer').classList.toggle('open'); });
    $('btnCloseDrawer').addEventListener('click', function () { $('drawer').classList.remove('open'); });
  const btnPhoto = $('btnPhoto');
  if (btnPhoto) btnPhoto.addEventListener('click', function () { snapshot(); });

  const filterSeg = $('photoFilterSeg');
  function syncFilterUI() {
    if (!filterSeg) return;
    const fb = filterSeg.querySelectorAll('button');
    for (let i = 0; i < fb.length; i++) {
      fb[i].classList.toggle('on', parseInt(fb[i].getAttribute('data-filter'), 10) === (settings.photoFilter || 0));
    }
  }
  if (filterSeg) {
    const fb = filterSeg.querySelectorAll('button');
    for (let i = 0; i < fb.length; i++) {
      fb[i].addEventListener('click', function () {
        settings.photoFilter = parseInt(this.getAttribute('data-filter'), 10) || 0;
        saveSettings();
        syncFilterUI();
        showToast('画面滤镜：' + this.textContent);
      });
    }
  }
  syncFilterUI();
    $('btnHelp').addEventListener('click', function () { $('help').classList.add('open'); });
    $('btnHelpClose').addEventListener('click', function () { $('help').classList.remove('open'); });
    $('help').addEventListener('click', function (e) { if (e.target === $('help')) $('help').classList.remove('open'); });

    const qBtns = $('qualitySeg').querySelectorAll('button');
    for (let i = 0; i < qBtns.length; i++) {
      qBtns[i].addEventListener('click', function () {
        settings.quality = this.getAttribute('data-quality');
        applyQuality();
        showToast('画质：' + this.textContent);
      });
    }
    $('optFps').addEventListener('change', function (e) {
      settings.fps = e.target.checked;
      $('fps').classList.toggle('show', settings.fps);
      saveSettings();
    });
    const optSSAO = $('optSSAO');
    if (optSSAO) {
      optSSAO.checked = settings.ssao !== false;
      optSSAO.addEventListener('change', function (e) {
        settings.ssao = e.target.checked;
        applyQuality();
        saveSettings();
        showToast(e.target.checked ? '环境光遮蔽：开（高画质生效）' : '环境光遮蔽：关');
      });
    }
    $('optShadow').addEventListener('change', function (e) {
      settings.shadows = e.target.checked;
      applyQuality();
    });
    const optMinimap = $('optMinimap');
    if (optMinimap) {
      optMinimap.checked = settings.minimap !== false;
      optMinimap.addEventListener('change', function (e) {
        settings.minimap = e.target.checked;
        if (mmCanvas) mmCanvas.classList.toggle('hide', !settings.minimap);
        saveSettings();
        drawMinimap();
      });
    }
    const optAutoCycle = $('optAutoCycle');
    if (optAutoCycle) {
      optAutoCycle.checked = !!settings.autoCycle;
      optAutoCycle.addEventListener('change', function (e) {
        setDayCycle(e.target.checked);
      });
    }
    const replayBtn = $('btnReplayTutorial');
    if (replayBtn) replayBtn.addEventListener('click', function () {
      tutorialReset();
      showToast('新手引导已重新开启', 2400);
    });
    const presetBox = $('presets');
    if (presetBox) {
      const pbtns = presetBox.querySelectorAll('button');
      for (let pi = 0; pi < pbtns.length; pi++) {
        pbtns[pi].addEventListener('click', function () {
          applyScenePreset(this.getAttribute('data-preset'));
        });
      }
    }
    const optObjective = $('optObjective');
    if (optObjective) {
      optObjective.checked = settings.objective !== false;
      optObjective.addEventListener('change', function (e) {
        settings.objective = !!e.target.checked;
        saveSettings();
        showToast(settings.objective ? '任务指引：开' : '任务指引：关', 1800);
        if (!settings.objective) {
          const om = $('objMarker'), oa = $('objArrow');
          if (om) om.classList.remove('show');
          if (oa) oa.classList.remove('show');
        }
      });
    }
    const optPerfHud = $('optPerfHud');
    if (optPerfHud) {
      optPerfHud.checked = !!settings.perfhud;
      optPerfHud.addEventListener('change', function (e) {
        settings.perfhud = !!e.target.checked;
        saveSettings();
        document.body.classList.toggle('perfshow', settings.perfhud);
        showToast(settings.perfhud ? '性能 HUD：开' : '性能 HUD：关', 1800);
      });
    }
    function applySensitivity() {
      const ms = Number(settings.moveSens == null ? 1 : settings.moveSens);
      const ls = Number(settings.lookSens == null ? 1 : settings.lookSens);
      if (WALK) { WALK.touchMoveScale = ms; WALK.lookScale = ls; }
      const mv = $('optMoveSens'), lv = $('optLookSens');
      if (mv) mv.value = String(ms);
      if (lv) lv.value = String(ls);
    }
    const optMoveSens = $('optMoveSens');
    if (optMoveSens) {
      optMoveSens.addEventListener('input', function (e) {
        settings.moveSens = Number(e.target.value) || 1;
        applySensitivity();
        saveSettings();
      });
    }
    const optLookSens = $('optLookSens');
    if (optLookSens) {
      optLookSens.addEventListener('input', function (e) {
        settings.lookSens = Number(e.target.value) || 1;
        applySensitivity();
        saveSettings();
      });
    }
    applySensitivity();
    const optAudioEl = $('optAudio');
    if (optAudioEl) {
      optAudioEl.checked = settings.audio !== false;
      optAudioEl.addEventListener('change', function (e) {
        settings.audio = !!e.target.checked;
        saveSettings();
        if (typeof AUDIO !== 'undefined') {
          if (settings.audio) { AUDIO.setMuted(false); } else { AUDIO.setMuted(true); }
        }
        showToast(settings.audio ? '环境音效：开' : '环境音效：关', 1800);
      });
    }
    const optFestival = $('optFestival');
    if (optFestival) {
      optFestival.checked = !!settings.festival;
      optFestival.addEventListener('change', function (e) {
        setFestival(e.target.checked);
      });
    }
    const optWeather = $('optWeather');
    if (optWeather) {
      optWeather.checked = !!settings.weatherAuto;
      optWeather.addEventListener('change', function (e) {
        settings.weatherAuto = e.target.checked;
        if (settings.weatherAuto) {
          weather.timer = 0;
          showToast('天气变化：开启（晴 / 阴 / 雨 自动切换）', 3000);
        } else {
          setWeather('clear', true);
          showToast('天气变化：关闭', 2200);
        }
        saveSettings();
      });
    }
    $('optCloud').addEventListener('change', function (e) {
      settings.clouds = e.target.checked;
      applyQuality();
    });
    $('optCinema').addEventListener('change', function (e) {
      setCinema(e.target.checked);
    });

    $('optFps').checked = !!settings.fps;
    $('fps').classList.toggle('show', !!settings.fps);
    $('optShadow').checked = !!settings.shadows;
    $('optCloud').checked = !!settings.clouds;
    $('optCinema').checked = !!settings.cinema;
    if (settings.cinema) setCinema(true);
  }

  /* =========================================================
   *  输入
   * ======================================================= */
  const pointers = new Map();
  let pinchDist = 0;
  let pinchMid = { x: 0, y: 0 };

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    if (WALK.active) {
      WALK.dragging = true;
      WALK.lastX = e.clientX; WALK.lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      return;
    }
    if (TOUR.active) TOUR.stop(false);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size === 1) {
      ctrl.dragging = true;
      ctrl.isPan = (e.button === 2) || e.shiftKey;
      ctrl.px = e.clientX; ctrl.py = e.clientY;
    } else if (pointers.size === 2) {
      ctrl.dragging = false;
      const pts = Array.from(pointers.values());
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
  });
  window.addEventListener('pointermove', function (e) {
    if (WALK.active) {
      if (!WALK.dragging) return;
      const dx = e.clientX - WALK.lastX, dy = e.clientY - WALK.lastY;
      WALK.lastX = e.clientX; WALK.lastY = e.clientY;
      WALK.look(dx, dy);
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && ctrl.dragging) {
      const dx = e.clientX - ctrl.px, dy = e.clientY - ctrl.py;
      ctrl.px = e.clientX; ctrl.py = e.clientY;
      if (ctrl.isPan) {
        ctrl.pan(dx, dy);
      } else {
        ctrl.ttheta -= dx * 0.0038;
        ctrl.tphi = clamp(ctrl.tphi - dy * 0.0032, 0.1, 1.52);
      }
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (pinchDist > 0) {
        ctrl.tr = clamp(ctrl.tr / (d / pinchDist), 22, 1900);
      }
      ctrl.pan(mid.x - pinchMid.x, mid.y - pinchMid.y);
      pinchDist = d;
      pinchMid = mid;
    }
  });
  window.addEventListener('pointerup', function (e) {
    if (WALK.active) { WALK.dragging = false; return; }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      ctrl.px = p.x; ctrl.py = p.y;
      ctrl.dragging = true;
    }
    if (pointers.size === 0) ctrl.dragging = false;
  });
  window.addEventListener('pointercancel', function (e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) ctrl.dragging = false;
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (WALK.active) {
      WALK.camDist = clamp(WALK.camDist * Math.exp(e.deltaY * 0.0009), 2.0, 14);
      return;
    }
    ctrl.tr = clamp(ctrl.tr * Math.exp(e.deltaY * 0.0009), 22, 1900);
  }, { passive: false });
  canvas.addEventListener('dblclick', function () { showView(currentView); });

  window.addEventListener('keydown', function (e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (riddle.active) {
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        answerRiddle(parseInt(e.key, 10) - 1);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') { closeRiddle(); e.preventDefault(); return; }
    }
    if (lightbox.active) {
      if (e.key === 'Escape') { closeLightbox(); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft') { lightboxNav(-1); e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { lightboxNav(1); e.preventDefault(); return; }
      if ((e.key || '').toLowerCase() === 'd') { downloadPhoto(lightbox.idx); return; }
    }
    if (WALK.active) {
      const k2 = (e.key || '').toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k2) >= 0) {
        WALK.keys[k2] = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'Shift') { WALK.keys['shift'] = true; return; }
      if (e.code === 'Space' || k2 === ' ') {
        if (minigame.active) { throwArrow(); e.preventDefault(); return; }
        WALK.jump(); e.preventDefault(); return;
      }
      if (k2 === 'e') { if (!e.repeat) doInteract(); return; }
      if (k2 === 'p') { if (!e.repeat) takePhoto(); return; }
      if (k2 === 'g') { if (!e.repeat) openAlbum(); return; }
      if (k2 === 'h') { if (!e.repeat) openAchievements(); return; }
      if (k2 === 'o') { if (!e.repeat) { settings.objective = settings.objective === false ? true : false; saveSettings(); showToast(settings.objective === false ? '任务指引：关' : '任务指引：开', 1800); } return; }
      if (k2 === 'f') { if (!e.repeat) togglePerfHud(); return; }
      if (k2 === 'x') { WALK.toggleView(); return; }
      if (k2 === 'r') {
        discSet = {}; saveDisc(); refreshWalkGame();
        questsReset();
        showToast('探索与任务进度已重置', 2400);
        return;
      }
      if (e.key === 'Escape') {
        if (lightbox.active) { closeLightbox(); return; }
        if (tutorial.active) { tutorialHide(true); return; }
        if (minigame.active) { stopMinigame(); return; }
        const ab = document.getElementById('album');
        if (ab && ab.classList.contains('show')) { openAlbum(false); return; }
        const av = document.getElementById('achv');
        if (av && av.classList.contains('show')) { openAchievements(false); return; }
        toggleWalk(false); return;
      }
      if (k2 === 'v') { toggleWalk(false); return; }
    }
    const key = e.key;
    if (key === '0') {
      stopTourIfActive();
      showView(VIEWS.length - 1);
      return;
    }
    if (key >= '1' && key <= '9') {
      const n = parseInt(key, 10);
      if (n <= VIEWS.length) { stopTourIfActive(); showView(n - 1); }
      return;
    }
    if (key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (TOUR.active) TOUR.togglePause(); else TOUR.start();
      return;
    }
    const lower = (key || '').toLowerCase();
    if (lower === 't') {
      const order = CONFIG.themeOrder;
      const next = order[(order.indexOf(currentTheme) + 1) % order.length];
      setTheme(next);
      showToast('时段：' + CONFIG.themes[next].label);
    } else if (lower === 'l') {
      toggleLabels();
    } else if (lower === 'f') {
      settings.fps = !settings.fps;
      $('optFps').checked = settings.fps;
      $('fps').classList.toggle('show', settings.fps);
      saveSettings();
    } else if (lower === 'c') {
      toggleCinema();
    } else if (lower === 'p') {
      snapshot();
    } else if (lower === 'n') {
      if (typeof AUDIO !== 'undefined' && AUDIO.ready) {
        const muted = AUDIO.toggleMute();
        showToast(muted ? '环境声：已静音' : '环境声：开启');
      } else {
        showToast('环境声将在首次交互后开启');
      }
    } else if (lower === 'm') {
      settings.minimap = !settings.minimap;
      if (mmCanvas) mmCanvas.classList.toggle('hide', !settings.minimap);
      const om = $('optMinimap');
      if (om) om.checked = settings.minimap;
      saveSettings();
      drawMinimap();
      showToast(settings.minimap ? '小地图：开' : '小地图：关');
    } else if (key === 'Escape') {
      $('drawer').classList.remove('open');
      $('help').classList.remove('open');
      if (TOUR.active) TOUR.stop(true);
      if (settings.cinema) setCinema(false);
    }
  });

  window.addEventListener('keyup', function (e) {
    if (!WALK.active) return;
    const k2 = (e.key || '').toLowerCase();
    WALK.keys[k2] = false;
    if (e.key === 'Shift') WALK.keys['shift'] = false;
    if (e.code === 'Space' || k2 === ' ') WALK.releaseJump();
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (POST.enabled) POST.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
  });

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    showToast('渲染上下文丢失，正在尝试恢复…', 5000);
  });
  canvas.addEventListener('webglcontextrestored', function () {
    renderer.shadowMap.needsUpdate = true;
    showToast('渲染上下文已恢复');
  });

  /* =========================================================
   *  性能统计 / 自适应
   * ======================================================= */
  const perf = { fps: 0, frames: 0, acc: 0, lowStreak: 0, draws: 0, triangles: 0 };
  function updatePerf(dt) {
    perf.acc += dt;
    perf.frames++;
    if (perf.acc >= 0.5) {
      perf.fps = Math.round(perf.frames / perf.acc);
      perf.frames = 0;
      perf.acc = 0;
      perf.draws = POST.enabled ? POST.sceneCalls : renderer.info.render.calls;
      perf.triangles = POST.enabled ? POST.sceneTris : renderer.info.render.triangles;
      if (settings.fps) {
        $('fps').innerHTML = '<b>' + perf.fps + '</b> FPS · ' + perf.draws + ' draws';
      }
      if (settings.quality === 'auto' && perf.fps > 0 && perf.fps < 24 && !document.hidden && !perf.degraded) {
        perf.lowStreak += 1;
        if (perf.lowStreak >= 10) {
          perf.degraded = true;
          const pr = Math.max(1, renderer.getPixelRatio() * 0.9);
          renderer.setPixelRatio(pr);
          renderer.setSize(window.innerWidth, window.innerHeight);
          if (POST.enabled) POST.setSize(window.innerWidth, window.innerHeight, pr);
          showToast('帧率偏低，已降低一次渲染分辨率（可在设置中手动调整画质）', 4200);
        }
      } else {
        perf.lowStreak = 0;
      }
      $('perfText').textContent = resolvedQuality + ' · ' + perf.draws + ' draws · ' + (perf.triangles / 1000).toFixed(0) + 'k tris';
    }
  }

  /* =========================================================
   *  小地图
   * ======================================================= */
  const MM_PLAN = [
    { x: 0, z: 58.5, w: 66, d: 40, c: '#c9a24a' },
    { x: 0, z: -2, w: 25, d: 25, c: '#c9a24a' },
    { x: 0, z: -56.5, w: 52, d: 26, c: '#c9a24a' },
    { x: 0, z: 280, w: 62, d: 20, c: '#b48a44' },
    { x: 0, z: 467, w: 90, d: 34, c: '#b48a44' },
    { x: 0, z: -140, w: 24, d: 12, c: '#b48a44' },
    { x: 0, z: -196, w: 36, d: 18, c: '#c9a24a' },
    { x: 0, z: -244, w: 30, d: 14, c: '#c9a24a' },
    { x: 0, z: -481, w: 52, d: 24, c: '#b48a44' },
    { x: 98, z: 205, w: 18, d: 44, c: '#8f7a46' },
    { x: -98, z: 205, w: 18, d: 44, c: '#8f7a46' },
    { x: 166, z: 224, w: 36, d: 16, c: '#8f7a46' },
    { x: -166, z: 224, w: 36, d: 16, c: '#8f7a46' },
    { x: 0, z: -330, w: 130, d: 90, c: '#2c4030' }
  ];
  const mmCanvas = $('minimap');
  const mmCtx = mmCanvas ? mmCanvas.getContext('2d') : null;
  if (mmCanvas && settings.minimap === false) mmCanvas.classList.add('hide');
  if (mmCanvas && new URLSearchParams(location.search).get('nomap') === '1') mmCanvas.classList.add('hide');
  function drawMinimap() {
    if (!mmCtx || !settings.minimap) return;
    const W = mmCanvas.width, H = mmCanvas.height;
    const px = function (x) { return (x + 405) / 810 * W; };
    const pz = function (z) { return (z + 500) / 1000 * H; };
    const sx = W / 810, sz = H / 1000;
    mmCtx.clearRect(0, 0, W, H);
    mmCtx.fillStyle = 'rgba(8,11,15,0.96)';
    mmCtx.fillRect(0, 0, W, H);
    /* 宫城轮廓 */
    mmCtx.strokeStyle = 'rgba(216,180,95,0.75)';
    mmCtx.lineWidth = 2;
    mmCtx.strokeRect(px(-376), pz(-481), 753 * sx, 961 * sz);
    mmCtx.fillStyle = 'rgba(90,74,44,0.15)';
    mmCtx.fillRect(px(-376), pz(-481), 753 * sx, 961 * sz);
    /* 中轴 */
    mmCtx.strokeStyle = 'rgba(216,180,95,0.35)';
    mmCtx.lineWidth = 1;
    mmCtx.setLineDash([6, 6]);
    mmCtx.beginPath();
    mmCtx.moveTo(px(0), pz(-481));
    mmCtx.lineTo(px(0), pz(481));
    mmCtx.stroke();
    mmCtx.setLineDash([]);
    /* 建筑 */
    for (let i = 0; i < MM_PLAN.length; i++) {
      const b = MM_PLAN[i];
      mmCtx.fillStyle = b.c;
      mmCtx.globalAlpha = 0.82;
      mmCtx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * sx, Math.max(2, b.d * sz));
      mmCtx.globalAlpha = 1;
    }
    /* 已发现地标 + 下一目标 */
    for (let di = 0; di < DISCOVERIES.length; di++) {
      const d = DISCOVERIES[di];
      const dx = px(d.x), dz = pz(d.z);
      if (discSet[di]) {
        mmCtx.fillStyle = 'rgba(216,180,95,0.95)';
        mmCtx.beginPath(); mmCtx.arc(dx, dz, 4.2, 0, 6.283); mmCtx.fill();
        mmCtx.strokeStyle = 'rgba(216,180,95,0.4)';
        mmCtx.lineWidth = 1.4;
        mmCtx.beginPath(); mmCtx.arc(dx, dz, 7.5, 0, 6.283); mmCtx.stroke();
      } else {
        mmCtx.strokeStyle = 'rgba(216,180,95,0.28)';
        mmCtx.lineWidth = 1;
        mmCtx.beginPath(); mmCtx.arc(dx, dz, 3.2, 0, 6.283); mmCtx.stroke();
      }
    }
    /* 下一目标高亮 */
    (function () {
      let best = -1, bestD = 1e9;
      for (let i = 0; i < DISCOVERIES.length; i++) {
        if (discSet[i]) continue;
        const dd = Math.hypot(DISCOVERIES[i].x - WALK.pos.x, DISCOVERIES[i].z - WALK.pos.z);
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (best >= 0) {
        const d = DISCOVERIES[best];
        mmCtx.strokeStyle = 'rgba(255,240,200,0.95)';
        mmCtx.lineWidth = 1.6;
        mmCtx.beginPath(); mmCtx.arc(px(d.x), pz(d.z), 8.5, 0, 6.283); mmCtx.stroke();
      }
    })();
    /* 小地图：NPC 与任务目标 */
    if (typeof NPC !== 'undefined' && NPC.patrols) {
      mmCtx.fillStyle = 'rgba(216,180,95,0.85)';
      for (let pi = 0; pi < NPC.patrols.length; pi++) {
        const pp = NPC.patrols[pi].obj.group.position;
        mmCtx.beginPath(); mmCtx.arc(px(pp.x), pz(pp.z), 1.8, 0, 6.283); mmCtx.fill();
      }
      mmCtx.fillStyle = 'rgba(192,113,124,0.9)';
      for (let mi2 = 0; mi2 < NPC.maids.length; mi2++) {
        const mp2 = NPC.maids[mi2].obj.group.position;
        mmCtx.beginPath(); mmCtx.arc(px(mp2.x), pz(mp2.z), 1.8, 0, 6.283); mmCtx.fill();
      }
      mmCtx.fillStyle = 'rgba(255,154,90,0.95)';
      for (let ci2 = 0; ci2 < NPC.cats.length; ci2++) {
        const cp2 = NPC.cats[ci2].obj.group.position;
        mmCtx.beginPath(); mmCtx.arc(px(cp2.x), pz(cp2.z), 1.5, 0, 6.283); mmCtx.fill();
      }
    }
    /* 任务目标：呼吸光环 + 标签 */
    if (WALK.active && typeof getObjectiveTarget === 'function') {
      const tgObj = getObjectiveTarget();
      if (tgObj) {
        const tpx = px(tgObj.x), tpz = pz(tgObj.z);
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
        mmCtx.strokeStyle = 'rgba(255,240,200,' + (0.55 + pulse * 0.4) + ')';
        mmCtx.lineWidth = 1.6;
        mmCtx.beginPath(); mmCtx.arc(tpx, tpz, 7 + pulse * 2.5, 0, 6.283); mmCtx.stroke();
        mmCtx.fillStyle = 'rgba(255,240,200,0.95)';
        mmCtx.beginPath(); mmCtx.arc(tpx, tpz, 2.2, 0, 6.283); mmCtx.fill();
        mmCtx.fillStyle = 'rgba(255,240,200,0.85)';
        mmCtx.font = '9px sans-serif';
        mmCtx.textAlign = 'center';
        const lbl = tgObj.label || '目标';
        mmCtx.fillText(lbl.replace(/^.*·\s*/, ''), tpx, tpz - 12);
      }
    }

    /* 当前位置与朝向 */
    let ax, az, ayaw;
    if (WALK.active) { ax = WALK.pos.x; az = WALK.pos.z; ayaw = WALK.yaw; }
    else { ax = ctrl.target.x; az = ctrl.target.z; ayaw = ctrl.theta + Math.PI; }
    const cx = px(ax), cz = pz(az);
    mmCtx.save();
    mmCtx.translate(cx, cz);
    mmCtx.rotate(-ayaw);
    mmCtx.fillStyle = '#f2e6c8';
    mmCtx.beginPath();
    mmCtx.moveTo(0, -8);
    mmCtx.lineTo(5.5, 6);
    mmCtx.lineTo(0, 3);
    mmCtx.lineTo(-5.5, 6);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.restore();
    /* 指北 */
    mmCtx.fillStyle = 'rgba(216,180,95,0.9)';
    mmCtx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    mmCtx.fillText('N', 8, 26);
  }

  /* =========================================================
   *  渲染
   * ======================================================= */
  const clock = new THREE.Clock();
  let running = false;
  let staticMode = false;
  let shadowFrame = 0;
  let lodFrame = 0;
  const lodTmp = new THREE.Vector3();
  let autoCycleT = 0;

  function draw() {
    if (POST.enabled) {
      POST.render(scene, camera, {
        exposure: th.exposure,
        contrast: th.grade.contrast,
        saturation: th.grade.sat,
        tint: th.grade.tint,
        lift: th.grade.lift,
        vignette: th.grade.vignette,
        grain: th.grade.grain * 0.5,
        bloom: th.bloom || 0,
        rays: th.rays || 0,
        sunUv: (function () {
          const v = sunGlow.position.clone().project(camera);
          if (v.z > 1) return [-1, -1];
          return [v.x * 0.5 + 0.5, v.y * 0.5 + 0.5];
        })(),
        filter: settings.photoFilter || 0,
        time: performance.now() * 0.001
      });
    } else {
      renderer.render(scene, camera);
    }
  }

  /* 同步基准测试：连续渲染 n 帧，返回平均毫秒与场景统计 */
  function bench(n) {
    n = n || 20;
    const params = {
      exposure: th.exposure,
      contrast: th.grade.contrast,
      saturation: th.grade.sat,
      tint: th.grade.tint,
      lift: th.grade.lift,
      vignette: th.grade.vignette,
      grain: th.grade.grain,
      filter: settings.photoFilter || 0,
      time: performance.now() * 0.001
    };
    if (POST.enabled) POST.render(scene, camera, params);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      if (POST.enabled) POST.render(scene, camera, params);
      else renderer.render(scene, camera);
    }
    const ms = (performance.now() - t0) / n;
    return {
      msPerFrame: +ms.toFixed(2),
      fps: +(1000 / ms).toFixed(1),
      draws: POST.enabled ? POST.sceneCalls : renderer.info.render.calls,
      tris: POST.enabled ? POST.sceneTris : renderer.info.render.triangles
    };
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    pollGamepad(dt);
    updateDayCycle(dt);
    if (WALK.active) {
      WALK.update(dt);
      AVATAR.place(WALK.pos, WALK.avatarYaw);
      AVATAR.setVisible(WALK.thirdPerson);
      AVATAR.update(dt, { moving: WALK.moving, speed: WALK.speed, onGround: WALK.onGround });
      updateWalkGame();
      updateInteractPrompt();
      updateQuests();
      updateNpcBubble(dt);
      updateMinigame(dt);
      updateObjectiveGuide();
      $('crosshair').style.display = WALK.thirdPerson ? 'none' : 'block';
    } else {
      AVATAR.setVisible(false);
      if (TOUR.active) TOUR.update(dt);
      else ctrl.update(dt);
    }
    updateWeather(dt);
    updateAmbientAudio(dt);
    updateTravel(dt);
    updateTutorial(dt);
    updateCodex(dt);
    if (!window.__achvSyncT) window.__achvSyncT = 0;
    window.__achvSyncT += dt;
    if (window.__achvSyncT > 3) { window.__achvSyncT = 0; syncAchievementLog(true); }
    updatePerfHud(dt);
    updatePerfGovernor(dt);
    updateFestivalSway();
    if (typeof EFFECTS !== 'undefined' && EFFECTS.meteorSpawns) {
      if (window.__lastMeteorSpawns == null) window.__lastMeteorSpawns = EFFECTS.meteorSpawns;
      if (EFFECTS.meteorSpawns !== window.__lastMeteorSpawns) {
        window.__lastMeteorSpawns = EFFECTS.meteorSpawns;
        if (AUDIO.meteorWhoosh) AUDIO.meteorWhoosh();
      }
    }
    updateTheme(dt);
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 1400) c.position.x = -1400;
    }
    MATS.water.map.offset.x -= dt * 0.004;
    MATS.water.map.offset.y += dt * 0.0022;
    if (!staticMode) MATS.updateSway(performance.now() * 0.001);
    EFFECTS.update(dt, th);
    if (!staticMode) NPC.update(dt);

    /* LOD：远景剔除瓦当/椽头等小构件实例；NPC 远景隐藏 */
    lodFrame = (lodFrame + 1) % 15;
    if (lodFrame === 0) {
      const detailAllowed = resolvedQuality !== 'low';
      const detailMeshes = (typeof DETAIL !== 'undefined' && DETAIL.detailMeshes) ? DETAIL.detailMeshes : [];
      for (let di = 0; di < detailMeshes.length; di++) {
        const dm = detailMeshes[di];
        if (!dm || !dm.parent) continue;
        dm.getWorldPosition(lodTmp);
        dm.visible = detailAllowed && lodTmp.distanceToSquared(camera.position) < 260 * 260;
      }
      if (NPC.group && !WALK.active) {
        NPC.group.visible = ctrl.target.distanceToSquared(new THREE.Vector3(0, 10, 0)) < 280 * 280;
      } else if (NPC.group && WALK.active) {
        NPC.group.visible = true;
      }
    }
    INTERIOR.updateVisibility(camera);
    if (labelGroup.visible) {
      for (let i = 0; i < labelGroup.children.length; i++) {
        const sp = labelGroup.children[i];
        const d = camera.position.distanceTo(sp.position);
        const s = Math.max(8, Math.min(64, d * 0.065));
        sp.scale.set(s, s / 3.2, 1);
      }
    }
    /* 阴影按需更新：行走时每 3 帧、静止时每 8 帧 */
    shadowFrame = (shadowFrame + 1) % (WALK.active ? 3 : 8);
    if (shadowFrame === 0) renderer.shadowMap.needsUpdate = true;

    draw();
    drawMinimap();
    updatePerf(dt);
  }

  /* =========================================================
   *  启动
   * ======================================================= */
  const params = new URLSearchParams(location.search);
  const still = params.get('still');
  const viewParam = params.get('view');
  const themeParam = params.get('theme');
  const qualityParam = params.get('quality');
  postOverride = params.get('post') === '0' ? false : (params.get('post') === '1' ? true : null);
  const postMode = params.get('postmode') != null ? parseInt(params.get('postmode'), 10) : 2;

  function start() {
    const t0 = performance.now();
    try {
      LAYOUT.build(root);
      WALK.setColliders(BUILD.colliders);
      if (typeof DETAIL !== 'undefined' && DETAIL.setDetailLevel) DETAIL.setDetailLevel(resolvedQuality);
      AVATAR.build();
      scene.add(AVATAR.group);
      NPC.build(scene);

      /* 评测静态模式（harness）：固定镜头/主题，隐藏动态元素，保证截图可复现 */
      staticMode = new URLSearchParams(location.search).get('static') === '1';
      if (staticMode) {
        if (typeof EFFECTS !== 'undefined') EFFECTS.staticMode = true;
        settings.autoCycle = false;
        if (typeof MATS !== 'undefined' && MATS.setSwayStatic) MATS.setSwayStatic();
        if (typeof AVATAR !== 'undefined') AVATAR.setVisible(false);
        if (typeof NPC !== 'undefined' && NPC.group) NPC.group.visible = false;
      }

      /* 真实素材（CC0）：HDRI 环境光 + PBR 材质；失败自动回退程序化 */
      if (typeof ASSETS !== 'undefined' && resolvedQuality !== 'low' &&
          new URLSearchParams(location.search).get('noassets') !== '1') {
        ASSETS.init(function () {
          try {
            ASSETS.applyMaterials(scene);
            updateEnvironment(currentTheme);
            scene.traverse(function (o) {
              if (o.material) {
                const ms = Array.isArray(o.material) ? o.material : [o.material];
                for (let mi = 0; mi < ms.length; mi++) ms[mi].needsUpdate = true;
              }
            });
          } catch (err) {
            console.warn('[assets] apply failed, keep procedural:', err);
          }
        });
      }
      /* 环境反射强度统一（避免白天过曝） */
      scene.traverse(function (m) {
        if (!m.material) return;
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        for (let mi = 0; mi < ms.length; mi++) {
          if (ms[mi] && ms[mi].isMeshStandardMaterial) ms[mi].envMapIntensity = 0.6;
        }
      });
      buildLabels();
      buildNav();

      const initialTheme = CONFIG.themes[themeParam] ? themeParam : (CONFIG.themes[settings.theme] ? settings.theme : 'day');
      setTheme(initialTheme, true);

      if (qualityParam && CONFIG.quality[qualityParam]) settings.quality = qualityParam;
      applyQuality();

      let idx = 0;
      if (viewParam != null) {
        const n = parseInt(viewParam, 10);
        if (!isNaN(n) && n >= 0 && n < VIEWS.length) idx = n;
      }
      bindUI();
  if (settings.audio === false && typeof AUDIO !== 'undefined') AUDIO.setMuted(true);
  const tuSkip = $('tuSkip');
  if (tuSkip) tuSkip.addEventListener('click', function () { tutorialHide(true); });
  initTouch();
  buildPot();
  (function bindAlbum() {
    const closeBtn = $('albumClose');
    if (closeBtn) closeBtn.addEventListener('click', function () { openAlbum(false); });
    const grid = $('albumGrid');
    if (grid) grid.addEventListener('click', function (e) {
      let el = e.target;
      while (el && el !== grid && !(el.getAttribute && el.getAttribute('data-i'))) el = el.parentNode;
      if (!el || el === grid) return;
      const i = parseInt(el.getAttribute('data-i'), 10);
      if (!isNaN(i)) openLightbox(i);
    });
    const lbClose = $('lbClose');
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    const lbPrev = $('lbPrev');
    if (lbPrev) lbPrev.addEventListener('click', function () { lightboxNav(-1); });
    const lbNext = $('lbNext');
    if (lbNext) lbNext.addEventListener('click', function () { lightboxNav(1); });
    const lbDown = $('lbDownload');
    if (lbDown) lbDown.addEventListener('click', function () { downloadPhoto(lightbox.idx); });
    const lbEl = $('lightbox');
    if (lbEl) lbEl.addEventListener('click', function (e) { if (e.target === lbEl) closeLightbox(); });
    const ab = $('album');
    if (ab) ab.addEventListener('click', function (e) { if (e.target === ab) openAlbum(false); });
    const ac = $('achvClose');
    if (ac) ac.addEventListener('click', function () { openAchievements(false); });
    const acv = $('achv');
    if (acv) acv.addEventListener('click', function (e) { if (e.target === acv) openAchievements(false); });
  })();
      if (params.get('labels') === '1') toggleLabels(true);
      if (params.get('cinema') === '1') setCinema(true);
      const camParam = params.get('cam');
      const lookParam = params.get('look');
      if (camParam && lookParam) {
        const ca = camParam.split(',').map(Number);
        const la = lookParam.split(',').map(Number);
        if (ca.length === 3 && la.length === 3 && ca.every(function (v) { return !isNaN(v); })) {
          ctrl.snapTo(ca, la);
        }
      }
      if (params.get('daycycle') === '1') setDayCycle(true);
  if (params.get('weather')) setWeather(params.get('weather'), true);
  else if (settings.weather && WEATHER_MODES[settings.weather]) { weather.mode = settings.weather; }
  if (params.get('festival') === '1') setFestival(true, true);
  else buildFestival();
  weather.rain = WEATHER_MODES[weather.mode].rain * 0.001;
  weather.cloud = WEATHER_MODES[weather.mode].cloud * 0.001;
  if (params.get('walk') === '1') toggleWalk(true);
      if (params.get('walkdemo') === '1') {
        toggleWalk(true);
        setTimeout(function () {
          /* 雪地脚印演示：沿御道生成一串脚印，并把相机移到可观察位置 */
          for (let z = 436; z >= 408; z -= 0.92) {
            EFFECTS.spawnFootprint(0, WALK.groundAt(0, z) + 0.05, z, 0);
          }
          WALK.pos.set(0, WALK.groundAt(0, 444), 444);
          WALK.yaw = 0;
          WALK.pitch = -0.06;
          WALK.update(0.016);
        }, 2600);
      }

      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const intro = still !== '1' && viewParam == null && !reduced && !settings.cinema;
      if (intro) {
        ctrl.target.set(0, 40, 30);
        ctrl.tTarget.set(0, 30, 34);
        ctrl.r = 1450; ctrl.theta = -0.62; ctrl.phi = 0.63;
        ctrl.tr = 1450; ctrl.ttheta = -0.62; ctrl.tphi = 0.63;
        ctrl.update(0.016);
        showView(idx, false);
      } else {
        showView(idx, true);
        ctrl.update(0.016);
      }

      renderer.shadowMap.needsUpdate = true;
      updateTheme(0.016);
      /* 截图/调试机位（须在 showView 之后应用） */
      if (camParam && lookParam) {
        const ca2 = camParam.split(',').map(Number);
        const la2 = lookParam.split(',').map(Number);
        if (ca2.length === 3 && la2.length === 3 && ca2.every(function (v) { return !isNaN(v); })) {
          ctrl.snapTo(ca2, la2);
        }
      }
      draw();

      const ld = $('loader');
      if (ld) {
        ld.classList.add('hide');
        setTimeout(function () { ld.style.display = 'none'; }, 900);
      }

      window.__buildMs = Math.round(performance.now() - t0);
      let objCount = 0;
      scene.traverse(function (o) { if (o.isMesh || o.isSprite) objCount++; });
      window.__sceneInfo = {
        meshes: objCount,
        drawCalls: renderer.info.render.calls,
        quality: resolvedQuality,
        theme: currentTheme
      };

      running = true;
      clock.getDelta();
      animate();

      $('verText').textContent = 'v' + CONFIG.version;
      $('buildText').textContent = (window.__BUILD__ && window.__BUILD__.version) || 'dev';

      window.__app = {
        ready: true,
        version: CONFIG.version,
        build: (window.__BUILD__ && window.__BUILD__.version) || 'dev',
        state: {
          get theme() { return currentTheme; },
          get quality() { return resolvedQuality; },
          get view() { return currentView; },
          get tour() { return TOUR.active; },
          get labels() { return labelGroup.visible; },
          get cinema() { return settings.cinema; },
          get walking() { return WALK.active; },
          get thirdPerson() { return WALK.thirdPerson; },
          get jumping() { return !WALK.onGround; },
          snapshot: snapshot
        },
        perf: perf,
        snapshot: snapshot,
        scene: scene,
        renderer: renderer,
        camera: camera,
        pause: function (on) { running = !on; if (!on) { clock.getDelta(); requestAnimationFrame(animate); } },
        drawOnce: function () { try { draw(); } catch (e) {} },
        capture: function () { try { draw(); return renderer.domElement.toDataURL('image/jpeg', 0.9); } catch (e) { console.warn('capture failed', e); return null; } },
        bench: bench,
        setTheme: function (n) { setTheme(n); },
        snapTheme: function (n) { setTheme(n, true); },
        showView: function (i, instant) { stopTourIfActive(); showView(i, instant === true); if (instant === true && !WALK.active && !TOUR.active) { try { ctrl.update(0.016); } catch (e) {} } },
        startTour: function () { TOUR.start(); },
        stopTour: function () { TOUR.stop(true); },
        setQuality: function (q) { settings.quality = q; applyQuality(); },
        setCinema: setCinema,
        toggleLabels: function () { toggleLabels(); },
        startWalk: function () { toggleWalk(true); },
    setDayCycle: setDayCycle,
    setWeather: function (m) { setWeather(m); return weather; },
    ambientInfo: function () { return { bell: AMBIENT.bell.n, pigeon: AMBIENT.pigeon.n, meow: AMBIENT.meow.n, drip: AMBIENT.drip.n, windchime: AMBIENT.windchime.n, patter: AMBIENT.patter.n, cricket: AMBIENT.cricket.n, audioReady: !!(AUDIO && AUDIO.ready) }; },
    travelInfo: function () { return { dist: Math.round(travel.dist), time: Math.round(travel.time), jumps: travel.jumps, miles: Object.keys(travel.miles) }; },
    playCats: function () { return playWithCats(); },
    syncAchievementLog: function (n) { return syncAchievementLog(!!n); },
    codexInfo: codexInfo,
    meteorSoundTest: function () { if (AUDIO.meteorWhoosh) AUDIO.meteorWhoosh(); return true; },
    talkInfo: function () { return { asks: achievements.asks || 0, active: window.__npcTalk || null }; },
    nearestWalkNpc: function () { const wk = nearestWalkNpc(); return wk ? { kind: wk.kind, dist: Math.round(wk.dist * 10) / 10 } : null; },
    lanternInfo: function () { return { released: achievements.lanterns || 0, floating: (typeof EFFECTS !== 'undefined' && EFFECTS.riverLanternPool) ? EFFECTS.riverLanternPool.filter(function (l) { return l.life > 0; }).length : -1, spawns: (typeof EFFECTS !== 'undefined' && EFFECTS.riverLanternSpawns) || 0 }; },
    petInfo: function () { return { petLions: achievements.petLions || 0, feedBirds: achievements.feedBirds || 0 }; },
    unlockCodex: function (id) { return codexUnlock(id); },
    achievementLog: function () { return (achievements.log || []).slice(-20); },
    tutorialInfo: function () { return { active: tutorial.active, step: tutorial.step, done: tutorial.done, total: TUTORIAL_STEPS.length }; },
    tutorialReset: tutorialReset,
    tutorialTick: function (dt) { updateTutorial(dt || 0.016); },
    incenseInfo: function () { return { count: achievements.incense || 0, smokeActive: (typeof EFFECTS !== 'undefined' && EFFECTS.incensePool) ? EFFECTS.incensePool.filter(function (s) { return s.life > 0; }).length : -1 }; },
    wishInfo: function () { return { wishes: achievements.wishes || 0, coinsActive: (typeof EFFECTS !== 'undefined' && EFFECTS.coinPool) ? EFFECTS.coinPool.filter(function (c) { return c.life > 0; }).length : -1 }; },
    perfGovernorTick: function (dt) { updatePerfGovernor(dt || 0.016); },
    perfGovernorSet: function (v) { perfGovernor.downgraded = !!v; if (typeof EFFECTS !== 'undefined' && EFFECTS.setLod) EFFECTS.setLod(v ? 0.45 : 1); },
    perfGovernor: function () { return { avgFps: perfGovernor.lastAvgFps, downgraded: perfGovernor.downgraded, lod: (typeof EFFECTS !== 'undefined' && EFFECTS.lodScale) || 1 }; },
    perfHud: function () { return { enabled: !!settings.perfhud, text: ($('perfhud') || {}).innerText || '' }; },
    settingsInfo: function () { return { objective: settings.objective !== false, perfhud: !!settings.perfhud, minimap: settings.minimap !== false, audio: settings.audio !== false, festival: !!settings.festival, weatherAuto: !!settings.weatherAuto, dayCycle: !!settings.autoCycle, moveSens: settings.moveSens == null ? 1 : settings.moveSens, lookSens: settings.lookSens == null ? 1 : settings.lookSens }; },
    togglePerfHud: togglePerfHud,
    perfHudTick: function (dt) { updatePerfHud(dt || 0.016); },
    catNestInfo: function () { return { near: nearCatNest(), plays: achievements.catPlays || 0, built: !!catNestGroup }; },
    preset: function (id) { return applyScenePreset(id); },
    presetInfo: function () { return Array.prototype.slice.call(document.querySelectorAll('#presets button')).map(function (b) { return { id: b.getAttribute('data-preset'), on: b.classList.contains('on') }; }); },
    festivalSwayTick: function () { updateFestivalSway(); },
    festivalSwayInfo: function () {
      if (!festivalRefs) return null;
      const m = new THREE.Matrix4();
      festivalRefs.bodies.getMatrixAt(0, m);
      const e2 = m.elements;
      return { tilts: [Math.round(e2[1] * 1000) / 1000, Math.round(e2[2] * 1000) / 1000], visible: !!(festivalGroup && festivalGroup.visible) };
    },
    setFestival: function (on) { setFestival(on); return { enabled: !!settings.festival, count: festivalCount, visible: !!(festivalGroup && festivalGroup.visible) }; },
    festivalInfo: function () { return { enabled: !!settings.festival, count: festivalCount, visible: !!(festivalGroup && festivalGroup.visible) }; },
    objectiveInfo: function () { const tg = getObjectiveTarget(); const mk = $('objMarker'), ar = $('objArrow'); return { target: tg, markerShown: !!(mk && mk.classList.contains('show')), arrowShown: !!(ar && ar.classList.contains('show')), label: ($('objLabel') || {}).textContent, arrowTransform: ar ? ar.style.transform : null, enabled: settings.objective !== false }; },
    objectiveTick: function () { updateObjectiveGuide(); },
    setTravel: function (d, t2, j) { travel.dist = d; travel.time = t2; travel.jumps = j == null ? travel.jumps : j; checkTravelMilestones(); },
    travelTick: function (dt) { updateTravel(dt || 0.016); },
    ambientTick: function (dt) { updateAmbientAudio(dt || 0.016); },
    minigameInfo: function () { return { active: minigame.active, power: Math.round(minigame.power * 100) / 100, throws: minigame.throws, score: minigame.score, finished: minigame.finished, best: achievements.potBest || 0 }; },
    riddleInfo: function () { return { active: riddle.active, idx: riddle.riddleIdx, solved: (achievements.riddles || []).slice(), near: !!nearRiddle() }; },
    openRiddle: function () { return openRiddle(); },
    answerRiddle: function (i) { return answerRiddle(i); },
    startMinigame: function () { return startMinigame(); },
    setMinigamePower: function (v) { minigame.power = Math.max(0, Math.min(1, v)); },
    minigameThrow: function () { return throwArrow(); },
    weatherInfo: function () { return { mode: weather.mode, rain: Math.round(weather.rain * 100) / 100, cloud: Math.round(weather.cloud * 100) / 100, auto: !!settings.weatherAuto }; },
    weatherTick: function (dt) { updateWeather(dt || 0.016); updateTheme(dt || 0.016); draw(); },
    dayCycleInfo: function () { return { on: !!settings.autoCycle, phase: Math.round(dayPhase * 1000) / 1000, theme: currentTheme }; },
    setDayPhase: function (v) { dayPhase = Math.max(0, Math.min(0.9999, v)); },
    dayCycleTick: function (dt) { updateDayCycle(dt || 0.016); updateTheme(dt || 0.016); draw(); },
    pollGamepad: pollGamepad,
    touchEnabled: function () { return touchEnabled; },
    interact: doInteract,
    interactInfo: function () { const it = nearestInteractive(); return it ? { title: it.title, text: it.text } : null; },
    achievements: function () { return { catFeeds: achievements.catFeeds, photos: achievements.photos }; },
    takePhoto: takePhoto,
    albumInfo: function () { return { photos: album.length, spots: Object.keys(photoSpots).length, allDone: photoAllDone, names: album.map(function (a) { return a.name; }) }; },
    openAlbum: openAlbum,
    setAlbumFilter: setAlbumFilter,
    openLightbox: openLightbox,
    lightboxInfo: function () { const lb = $('lightbox'), img = $('lbImg'); return { active: lightbox.active, idx: lightbox.idx, shown: !!(lb && lb.classList.contains('show')), srcLen: img && img.src ? img.src.length : 0, cap: ($('lbCap') || {}).innerText || '' }; },
    lightboxNav: lightboxNav,
    closeLightbox: closeLightbox,
    albumFilterInfo: albumInfoEx,
    openAchievements: openAchievements,
    achievementsPanel: function () { return achvData(); },
    npcBubbleTick: function (dt) { updateNpcBubble(dt || 0.016); },
    npcBubbleInfo: function () { const el = $('npcBubble'); return el && el.classList.contains('show') ? { who: $('npcWho').textContent, line: $('npcLine').textContent, left: el.style.left, top: el.style.top } : null; },
    questsInfo: function () { return QUESTS.map(function (q) { return { id: q.id, name: q.name, progress: q.progress, total: q.steps.length, done: q.done, title: q.title }; }); },
    questTick: updateQuests,
    walkGameTick: updateWalkGame,
    promptTick: updateInteractPrompt,
    questsReset: questsReset,
        stopWalk: function () { toggleWalk(false); }
      };
    } catch (err) {
      window.__err = (err && (err.stack || err.message)) || String(err);
      errors.push(window.__err);
      const ld = $('loader');
      if (ld) {
        ld.classList.remove('hide');
        ld.innerHTML = '<div class="ls" style="letter-spacing:2px;color:#e8a">构 建 失 败</div>' +
          '<pre style="max-width:78vw;max-height:60vh;overflow:auto;white-space:pre-wrap;color:#f99;font-size:12px;text-align:left">' +
          window.__err + '</pre>';
      }
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestAnimationFrame(function () { requestAnimationFrame(start); });
  } else {
    window.addEventListener('load', function () {
      requestAnimationFrame(function () { requestAnimationFrame(start); });
    });
  }
})();
