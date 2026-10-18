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
    minimap: true, autoCycle: false
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
  const themeFieldsNumber = ['sunInt', 'hemiInt', 'fillInt', 'exposure', 'glowOp', 'cloudOp', 'cloudN', 'snow', 'windowGlow', 'stars', 'lanterns', 'bloom'];

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
    }
    updateEnvironment(name);
    const btns = $('themes').querySelectorAll('button');
    for (let i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-theme') === name);
    }
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

    MATS.setSnow(th.snow);
    MATS.setNightGlow(th.windowGlow);

    if (th.sunPos.distanceToSquared(lastSunPos) > 0.2) {
      lastSunPos.copy(th.sunPos);
      renderer.shadowMap.needsUpdate = true;
    }
    if (!POST.enabled) {
      renderer.toneMappingExposure = th.exposure;
    }
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

  function toggleWalk(force) {
    const on = force == null ? !WALK.active : !!force;
    if (on) {
      if (TOUR.active) TOUR.stop(false);
      WALK.enter(scene);
      document.body.classList.add('walking');
      $('walkhint').classList.add('show');
      $('btnWalk').classList.add('on');
      showToast('漫游模式：WASD 移动 · 空格跳跃 · Shift 疾行 · X 视角 · Esc 退出', 3600);
    } else {
      WALK.exit();
      document.body.classList.remove('walking');
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
        settings.autoCycle = e.target.checked;
        autoCycleT = 0;
        saveSettings();
        showToast(e.target.checked ? '自动昼夜：每 150 秒轮换' : '自动昼夜：关闭');
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
    if (WALK.active) {
      const k2 = (e.key || '').toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k2) >= 0) {
        WALK.keys[k2] = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'Shift') { WALK.keys['shift'] = true; return; }
      if (e.code === 'Space' || k2 === ' ') { WALK.jump(); e.preventDefault(); return; }
      if (k2 === 'x') { WALK.toggleView(); return; }
      if (k2 === 'v' || e.key === 'Escape') { toggleWalk(false); return; }
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
    if (settings.autoCycle) {
      autoCycleT += dt;
      if (autoCycleT > 150) {
        autoCycleT = 0;
        const order = ['day', 'dusk', 'night'];
        const next = order[(order.indexOf(currentTheme) + 1) % order.length];
        setTheme(next);
      }
    }
    if (WALK.active) {
      WALK.update(dt);
      AVATAR.place(WALK.pos, WALK.avatarYaw);
      AVATAR.setVisible(WALK.thirdPerson);
      AVATAR.update(dt, { moving: WALK.moving, speed: WALK.speed, onGround: WALK.onGround });
      $('crosshair').style.display = WALK.thirdPerson ? 'none' : 'block';
    } else {
      AVATAR.setVisible(false);
      if (TOUR.active) TOUR.update(dt);
      else ctrl.update(dt);
    }
    updateTheme(dt);
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 1400) c.position.x = -1400;
    }
    MATS.water.map.offset.x -= dt * 0.004;
    MATS.water.map.offset.y += dt * 0.0022;
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
        NPC.group.visible = ctrl.target.distanceToSquared(new THREE.Vector3(0, 10, 0)) < 520 * 520;
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
