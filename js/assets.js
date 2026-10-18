/* =============================================================
 *  紫禁城 · 数字复原  —  真实素材加载（CC0）
 *  - HDRI 环境光（chinese_garden，Poly Haven CC0，转 equirect PNG）
 *  - PBR 材质：琉璃瓦 / 汉白玉 / 金砖 / 宫墙灰泥
 *  - 单文件构建时由 build.mjs 注入 window.__ASSET_DATA__（base64）
 *  - 加载失败（如 file:// 下外部资源不可用）时静默回退到程序化材质
 * ============================================================= */
const ASSETS = {
  bundle: (typeof window !== 'undefined' && window.__ASSET_DATA__) ? window.__ASSET_DATA__ : null,
  base: 'assets/',
  started: false,
  ready: false,
  equirect: null,
  envReady: false,
  tex: {},
  envCache: {},

  url: function (rel) {
    if (this.bundle && this.bundle[rel]) return this.bundle[rel];
    return this.base + rel;
  },

  _loadTexture: function (rel, srgb, cb) {
    const loader = new THREE.TextureLoader();
    try { loader.setCrossOrigin('anonymous'); } catch (e) { /* ignore */ }
    loader.load(
      this.url(rel),
      function (t) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
        t.anisotropy = 8;
        t.needsUpdate = true;
        cb(t);
      },
      undefined,
      function () { cb(null); }
    );
  },

  init: function (onDone) {
    if (this.started || typeof THREE === 'undefined') return;
    this.started = true;
    const self = this;
    let total = 0, finished = 0;
    function task(runner) {
      total++;
      runner(function (v) {
        finished++;
        if (finished === total) self._finish(onDone);
      });
    }

    /* 环境贴图（equirect） */
    task(function (cb) {
      self._loadTexture('hdri/chinese_garden_equirect.png', true, function (t) {
        if (t) {
          t.mapping = THREE.EquirectangularReflectionMapping;
          self.equirect = t.image;
          self.equirectTexture = t;
          self.envReady = true;
        }
        cb(null);
      });
    });

    /* PBR 材质集 */
    const sets = [['roof', 'roof'], ['marble', 'marble'], ['stone', 'stone'], ['plaster', 'plaster']];
    self.tex = {};
    for (let i = 0; i < sets.length; i++) {
      const name = sets[i][0], dir = 'textures/' + sets[i][1];
      self.tex[name] = {};
      (function (name, dir) {
        task(function (cb) {
          self._loadTexture(dir + '/diff.jpg', true, function (t) { if (t) self.tex[name].diff = t; cb(null); });
        });
        task(function (cb) {
          self._loadTexture(dir + '/nor.jpg', false, function (t) { if (t) self.tex[name].nor = t; cb(null); });
        });
        task(function (cb) {
          self._loadTexture(dir + '/rough.jpg', false, function (t) { if (t) self.tex[name].rough = t; cb(null); });
        });
      })(name, dir);
    }
  },

  _finish: function (onDone) {
    this.ready = true;
    if (typeof console !== 'undefined') {
      console.log('[assets] loaded', this.envReady ? 'HDRI' : 'no-HDRI',
        Object.keys(this.tex).filter(function (k) { return this.tex[k].diff; }, this).length + '/4 material sets');
    }
    if (onDone) onDone();
  },

  /* 把 equirect 按主题染色成环境贴图用的 canvas（缓存） */
  tintedEquirect: function (themeName) {
    if (this.envCache[themeName]) return this.envCache[themeName];
    const img = this.equirect;
    if (!img) return null;
    const W = 1024, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, W, H);
    let tint = [1, 1, 1], mul = 1;
    if (themeName === 'dusk') { tint = [1.05, 0.97, 0.88]; mul = 0.9; }
    else if (themeName === 'night') { tint = [0.28, 0.36, 0.55]; mul = 0.32; }
    else if (themeName === 'snow') { tint = [1.0, 1.02, 1.06]; mul = 0.85; }
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(' + Math.round(255 * tint[0] * mul) + ',' +
      Math.round(255 * tint[1] * mul) + ',' + Math.round(255 * tint[2] * mul) + ')';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    this.envCache[themeName] = cv;
    return cv;
  },

  /* 用色彩映射把真实瓦面转成琉璃色（保留明暗/缝隙/法线） */
  _tintTexture: function (img, tintHex, opts) {
    opts = opts || {};
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const bri = opts.brightness == null ? 1.1 : opts.brightness;
    /* 先去色保留明暗/缝隙，再用 color 混合上琉璃色，最后提亮 */
    if (g.filter !== undefined) {
      g.filter = 'grayscale(1) brightness(' + bri + ') contrast(1.06)';
    }
    g.drawImage(img, 0, 0, S, S);
    g.filter = 'none';
    g.globalCompositeOperation = 'color';
    g.fillStyle = tintHex;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = tintHex;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, S, S);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  },

  /* 将素材应用到材质（遍历场景替换被克隆的贴图，保持各材质原有 repeat） */
  applyMaterials: function (scene) {
    if (!this.ready || !scene) return;
    const T = this.tex;
    const swap = function (oldImage, tex, extra) {
      if (!tex) return;
      scene.traverse(function (o) {
        if (!o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < ms.length; i++) {
          const m = ms[i];
          if (!m || !m.map) continue;
          if (!oldImage || m.map.image !== oldImage) continue;
          const rep = m.map.repeat.clone();
          const clone = tex.clone();
          clone.repeat.copy(rep);
          clone.wrapS = THREE.RepeatWrapping;
          clone.wrapT = THREE.RepeatWrapping;
          clone.encoding = THREE.sRGBEncoding;
          clone.anisotropy = 8;
          clone.needsUpdate = true;
          m.map = clone;
          if (extra && extra.nor) { m.normalMap = extra.nor.clone(); m.normalMap.repeat.copy(rep); m.normalMap.needsUpdate = true; m.normalScale = extra.normalScale || new THREE.Vector2(0.6, 0.6); }
          if (extra && extra.rough) { m.roughnessMap = extra.rough.clone(); m.roughnessMap.repeat.copy(rep); m.roughnessMap.needsUpdate = true; }
          m.needsUpdate = true;
        }
      });
    };

    /* 记录替换前的贴图引用 */
    const oldRoof = (MATS.roof && MATS.roof.map) ? MATS.roof.map.image : null;
    const oldWall = (MATS.wall && MATS.wall.map) ? MATS.wall.map.image : null;
    const oldPaving = (MATS.paving && MATS.paving.map) ? MATS.paving.map.image : null;
    const oldMarble = (MATS.marble && MATS.marble.map) ? MATS.marble.map.image : null;

    /* 屋顶：真实瓦垄（去色 → 琉璃金黄），保留真实法线/粗糙度 */
    if (T.roof && T.roof.diff && T.roof.diff.image) {
      const goldMap = this._tintTexture(T.roof.diff.image, '#eec24e', { brightness: 1.05 });
      const blackMap = this._tintTexture(T.roof.diff.image, '#3d454e', { brightness: 0.9 });
      if (MATS.roof) {
        MATS.roof.map = goldMap;
        MATS.roof.map.repeat.set(1, 1);
        MATS.roof.color.setHex(0xffffff);
        MATS.roof.normalMap = T.roof.nor;
        MATS.roof.normalScale.set(0.9, 0.9);
        MATS.roof.roughnessMap = T.roof.rough;
        MATS.roof.roughness = 0.62;
        MATS.roof.metalness = 0.12;
        MATS.roof.needsUpdate = true;
      }
      if (MATS.roofBlack) {
        MATS.roofBlack.map = blackMap;
        MATS.roofBlack.map.repeat.set(1, 1);
        MATS.roofBlack.color.setHex(0xffffff);
        MATS.roofBlack.normalMap = T.roof.nor;
        MATS.roofBlack.normalScale.set(0.9, 0.9);
        MATS.roofBlack.roughnessMap = T.roof.rough;
        MATS.roofBlack.needsUpdate = true;
      }
      /* 其余克隆的屋顶材质（若有）也一并换用琉璃瓦贴图 */
      swap(oldRoof, goldMap, { nor: T.roof.nor, rough: T.roof.rough, normalScale: new THREE.Vector2(0.9, 0.9) });
    }

    /* 宫墙：灰泥法线/粗糙度（保留红色彩图） */
    if (T.plaster && T.plaster.nor) {
      if (MATS.wall) {
        MATS.wall.normalMap = T.plaster.nor;
        MATS.wall.normalScale.set(0.6, 0.6);
        MATS.wall.roughnessMap = T.plaster.rough;
        MATS.wall.needsUpdate = true;
      }
      /* 其余使用同一宫墙图（不应替换颜色，只加法线）——遍历加上 */
      scene.traverse(function (o) {
        if (!o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < ms.length; i++) {
          const m = ms[i];
          if (m && m.map && m.map.image === oldWall) {
            m.normalMap = T.plaster.nor;
            m.normalScale = new THREE.Vector2(0.6, 0.6);
            m.roughnessMap = T.plaster.rough;
            m.needsUpdate = true;
          }
        }
      });
    }

    /* 金砖地面：石砖彩图 + 法线 + 粗糙度 */
    if (T.stone && T.stone.diff) {
      swap(oldPaving, T.stone.diff, { nor: T.stone.nor, rough: T.stone.rough, normalScale: new THREE.Vector2(0.8, 0.8) });
      if (MATS.paving) {
        MATS.paving.color.setHex(0xd6d2c6);
        MATS.paving.normalMap = T.stone.nor;
        MATS.paving.normalScale.set(0.8, 0.8);
        MATS.paving.roughnessMap = T.stone.rough;
        MATS.paving.roughness = 0.95;
        MATS.paving.needsUpdate = true;
      }
    }

    /* 汉白玉：真实石纹 + 法线 + 粗糙度 */
    if (T.marble && T.marble.diff) {
      swap(oldMarble, T.marble.diff, { nor: T.marble.nor, rough: T.marble.rough, normalScale: new THREE.Vector2(0.35, 0.35) });
      if (MATS.marble) {
        MATS.marble.color.setHex(0xffffff);
        MATS.marble.normalMap = T.marble.nor;
        MATS.marble.normalScale.set(0.35, 0.35);
        MATS.marble.roughnessMap = T.marble.rough;
        MATS.marble.roughness = 0.85;
        MATS.marble.needsUpdate = true;
      }
      if (MATS.marbleRail) {
        MATS.marbleRail.normalMap = T.marble.nor;
        MATS.marbleRail.normalScale.set(0.3, 0.3);
        MATS.marbleRail.needsUpdate = true;
      }
    }
  }
};
