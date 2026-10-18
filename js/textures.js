/* =============================================================
 *  紫禁城 · 数字复原  —  程序化贴图
 *  所有贴图均由 Canvas 实时绘制，不依赖任何外部图片资源。
 * ============================================================= */
const TEX = {};

/* 固定种子随机数：保证每次打开纹理一致 */
TEX.rand = (function () {
  let s = 20261017;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

TEX.canvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

TEX.tex = function (cv, rx, ry, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.anisotropy = 8;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
};

TEX._cache = {};
TEX.once = function (name, fn) {
  if (!TEX._cache[name]) TEX._cache[name] = fn();
  return TEX._cache[name];
};

/* -------------------------------------------------------------
 * 1. 琉璃瓦面：竖向筒瓦 + 横向瓦垄
 *    一张贴图覆盖约 2.2m × 2.2m（4 条筒瓦、4 排瓦）
 * ----------------------------------------------------------- */
/* 叶片簇卡片（透明，用于树冠细节） */
TEX.leafCard = function () {
  if (TEX._leafCard) return TEX._leafCard;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const cols = ['#4c6b33', '#5d7d3e', '#3f5c2b', '#6b8a4a', '#7d8c42', '#556d33'];
  for (let i = 0; i < 130; i++) {
    const a = TEX.rand() * Math.PI * 2;
    const r = Math.pow(TEX.rand(), 0.55) * S * 0.42;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r * 0.92;
    const sz = 6 + TEX.rand() * 12;
    g.save();
    g.translate(x, y);
    g.rotate(TEX.rand() * Math.PI);
    g.fillStyle = cols[Math.floor(TEX.rand() * cols.length)];
    g.globalAlpha = 0.8 + TEX.rand() * 0.2;
    g.beginPath();
    g.ellipse(0, 0, sz, sz * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.16, S / 2, S / 2, S * 0.5);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.72, 'rgba(0,0,0,0.92)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  TEX._leafCard = tex;
  return tex;
};
TEX.roof = function () {
  return TEX.once('roof', function () {
    const W = 512, H = 512, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    const N = 6, w = W / N;
    for (let i = 0; i < N; i++) {
      const x0 = i * w;
      const grad = g.createLinearGradient(x0, 0, x0 + w, 0);
      grad.addColorStop(0.00, '#6d490d');
      grad.addColorStop(0.09, '#a5731a');
      grad.addColorStop(0.32, '#e5b34b');
      grad.addColorStop(0.50, '#f7d478');
      grad.addColorStop(0.68, '#e5b34b');
      grad.addColorStop(0.91, '#a5731a');
      grad.addColorStop(1.00, '#6d490d');
      g.fillStyle = grad;
      g.fillRect(x0, 0, w, H);
    }
    // 横向瓦垄接缝
    for (let j = 0; j < N; j++) {
      const y = j * (H / N);
      g.fillStyle = 'rgba(70,46,8,0.45)';
      g.fillRect(0, y, W, 2.5);
      g.fillStyle = 'rgba(255,236,180,0.18)';
      g.fillRect(0, y + 2.5, W, 3);
    }
    // 岁月痕迹
    for (let k = 0; k < 6000; k++) {
      const x = TEX.rand() * W, y = TEX.rand() * H, r = 0.5 + TEX.rand() * 2.4;
      g.fillStyle = TEX.rand() < 0.5
        ? 'rgba(70,46,8,' + (0.03 + TEX.rand() * 0.07).toFixed(3) + ')'
        : 'rgba(255,240,200,' + (0.02 + TEX.rand() * 0.06).toFixed(3) + ')';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 2. 斗拱彩画带（青绿点金）
 * ----------------------------------------------------------- */
TEX.dougong = function () {
  return TEX.once('dougong', function () {
    const W = 512, H = 128, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#193433');
    bg.addColorStop(0.45, '#265049');
    bg.addColorStop(1, '#122a29');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // 上下金线
    g.fillStyle = '#c9a54a';
    g.fillRect(0, 2, W, 5); g.fillRect(0, H - 8, W, 5);
    g.fillStyle = 'rgba(60,40,10,0.55)';
    g.fillRect(0, 7, W, 2); g.fillRect(0, H - 10, W, 2);

    for (let i = 0; i < W / 64; i++) {
      const x = i * 64;
      // 拱臂
      g.fillStyle = '#c9a54a';
      g.fillRect(x + 9, 28, 46, 6);
      g.fillRect(x + 9, 94, 46, 6);
      // 斗
      g.fillStyle = '#35625b';
      g.fillRect(x + 20, 42, 24, 16);
      g.fillRect(x + 20, 70, 24, 16);
      g.fillStyle = 'rgba(214,178,90,0.85)';
      g.fillRect(x + 24, 45, 16, 4);
      g.fillRect(x + 24, 73, 16, 4);
      // 昂嘴
      g.fillStyle = '#8d3728';
      g.fillRect(x + 30, 34, 4, 10);
      g.fillRect(x + 30, 84, 4, 10);
      // 点金
      g.fillStyle = '#e2c063';
      for (let d = 0; d < 2; d++) {
        g.beginPath(); g.arc(x + 16 + d * 32, 63, 3, 0, 6.283); g.fill();
      }
      // 蓝色的垫板
      g.fillStyle = 'rgba(40,86,110,0.65)';
      g.fillRect(x + 4, 18, 56, 8);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 3. 和玺彩画额枋带（青绿底 + 沥粉贴金）
 * ----------------------------------------------------------- */
TEX.caihua = function () {
  return TEX.once('caihua', function () {
    const W = 512, H = 96, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#173c40'; g.fillRect(0, 0, W, H);
    // 上下金线
    g.fillStyle = '#c9a54a'; g.fillRect(0, 3, W, 4); g.fillRect(0, H - 7, W, 4);
    // 分段：箍头-藻头-枋心-藻头-箍头
    const segs = [
      { w: 40, c: '#1d4f7d' },   // 箍头
      { w: 110, c: '#2a6b52' },  // 藻头
      { w: 212, c: '#1d4f7d' },  // 枋心
      { w: 110, c: '#2a6b52' },
      { w: 40, c: '#1d4f7d' }
    ];
    let x = 0;
    for (let i = 0; i < segs.length; i++) {
      g.fillStyle = segs[i].c;
      g.fillRect(x, 9, segs[i].w, H - 18);
      g.strokeStyle = '#c9a54a'; g.lineWidth = 2;
      g.strokeRect(x + 1, 10, segs[i].w - 2, H - 20);
      x += segs[i].w;
    }
    // 藻头旋纹
    for (let i = 0; i < 4; i++) {
      const bx = 40 + 110 * (i < 2 ? i % 2 : 3) + (i > 1 ? 212 : 0);
      g.strokeStyle = 'rgba(201,165,74,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.arc(bx + 30, H / 2, 16, 0.6, 5.4); g.stroke();
      g.beginPath(); g.arc(bx + 55, H / 2, 12, 3.4, 6.1); g.stroke();
    }
    // 枋心团龙（简化云纹）
    g.strokeStyle = 'rgba(216,180,95,0.75)'; g.lineWidth = 2.4;
    const cx = 40 + 110 + 212 / 2, cy = H / 2;
    g.beginPath(); g.arc(cx, cy, 20, 0.4, 5.9); g.stroke();
    g.beginPath(); g.arc(cx - 6, cy, 10, 2.2, 6.2); g.stroke();
    g.beginPath(); g.arc(cx + 9, cy - 5, 7, 1.0, 5.2); g.stroke();
    // 金点
    g.fillStyle = '#e2c063';
    for (let k = 0; k < 14; k++) {
      g.beginPath(); g.arc(26 + k * 34, H * 0.22, 2.2, 0, 6.283); g.fill();
      g.beginPath(); g.arc(26 + k * 34, H * 0.78, 2.2, 0, 6.283); g.fill();
    }
    return TEX.tex(cv, 1, 1);
  });
};
/* -------------------------------------------------------------
 * 3. 殿身立面：朱红隔扇门 + 菱花格心 + 金钉
 *    bays: 开间数
 * ----------------------------------------------------------- */
TEX.facade = function (bays) {
  return TEX.once('facade' + bays, function () {
    const bw = 128;
    const W = bw * bays, H = 384;
    const cv = TEX.canvas(W, H), g = cv.getContext('2d');

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#5f1810');
    bg.addColorStop(0.4, '#71201a');
    bg.addColorStop(1, '#3c0d08');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    for (let i = 0; i < bays; i++) {
      const x0 = i * bw;
      // 槛墙
      g.fillStyle = '#7d2218';
      g.fillRect(x0 + 5, H - 92, bw - 10, 88);
      // 隔扇
      const dx = x0 + 13, dw = bw - 26;
      const dy = 26, dh = H - 158;
      g.strokeStyle = '#c9a24a'; g.lineWidth = 5;
      g.strokeRect(dx, dy, dw, dh);
      // 格心
      const gy = dy + 6, gh = dh * 0.6;
      g.fillStyle = '#2b0906';
      g.fillRect(dx + 5, gy, dw - 10, gh);
      g.save();
      g.beginPath(); g.rect(dx + 5, gy, dw - 10, gh); g.clip();
      for (let k = -gh; k < dw + gh; k += 13) {
        g.strokeStyle = 'rgba(214,170,86,0.55)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(dx + k, gy); g.lineTo(dx + k + gh, gy + gh); g.stroke();
        g.beginPath(); g.moveTo(dx + k, gy + gh); g.lineTo(dx + k + gh, gy); g.stroke();
      }
      g.restore();
      // 裙板 + 金钉
      const py = gy + gh + 8, ph = dh * 0.32;
      g.fillStyle = '#5c150e'; g.fillRect(dx + 8, py, dw - 16, ph);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          g.fillStyle = '#d3ab55';
          g.beginPath();
          g.arc(dx + 22 + c * ((dw - 44) / 4), py + 16 + r * ((ph - 32) / 2), 3.6, 0, 6.283);
          g.fill();
        }
      }
      // 铺首
      g.strokeStyle = '#d8b35c'; g.lineWidth = 3;
      g.beginPath(); g.arc(x0 + bw / 2, py + ph / 2, 8.5, 0, 6.283); g.stroke();
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 4. 菱花窗（上层檐 / 侧墙）
 * ----------------------------------------------------------- */
TEX.lattice = function (tone) {
  return TEX.once('lattice' + (tone || ''), function () {
    const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    const base = tone === 'dark' ? '#2c0a07' : '#3a0e09';
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    // 边框
    g.strokeStyle = '#b8913f'; g.lineWidth = 9;
    g.strokeRect(6, 6, S - 12, S - 12);
    g.strokeStyle = 'rgba(70,46,12,0.8)'; g.lineWidth = 2;
    g.strokeRect(13, 13, S - 26, S - 26);
    // 菱花格
    g.save();
    g.beginPath(); g.rect(16, 16, S - 32, S - 32); g.clip();
    for (let k = -S; k < S * 2; k += 22) {
      g.strokeStyle = 'rgba(206,164,78,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke();
      g.beginPath(); g.moveTo(k, S); g.lineTo(k + S, 0); g.stroke();
    }
    // 团花
    g.fillStyle = 'rgba(206,164,78,0.75)';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const cx = 48 + i * 61, cy = 48 + j * 61;
        g.beginPath(); g.arc(cx, cy, 5, 0, 6.283); g.fill();
      }
    }
    g.restore();
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 5. 宫墙：暗红 + 细微竖向肌理
 * ----------------------------------------------------------- */
TEX.wall = function () {
  return TEX.once('wall', function () {
    const S = 512, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#9c2f28'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 32) {
      g.fillStyle = 'rgba(60,14,10,0.18)'; g.fillRect(i, 0, 1.5, S);
      g.fillStyle = 'rgba(255,190,150,0.05)'; g.fillRect(i + 2, 0, 1, S);
    }
    for (let k = 0; k < 10000; k++) {
      const x = TEX.rand() * S, y = TEX.rand() * S;
      g.fillStyle = TEX.rand() < 0.55
        ? 'rgba(50,10,8,' + (0.02 + TEX.rand() * 0.06).toFixed(3) + ')'
        : 'rgba(255,205,170,' + (0.015 + TEX.rand() * 0.035).toFixed(3) + ')';
      g.fillRect(x, y, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 6. 城砖 / 门洞侧壁
 * ----------------------------------------------------------- */
TEX.brick = function () {
  return TEX.once('brick', function () {
    const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#7a3026'; g.fillRect(0, 0, S, S);
    const rowH = 32;
    for (let r = 0; r < S / rowH; r++) {
      const y = r * rowH;
      g.fillStyle = 'rgba(40,12,8,0.5)'; g.fillRect(0, y, S, 2);
      const off = (r % 2) * 32;
      for (let x = off; x < S + 64; x += 64) {
        g.fillStyle = 'rgba(40,12,8,0.35)'; g.fillRect(x, y, 1.6, rowH);
      }
    }
    for (let k = 0; k < 2200; k++) {
      const x = TEX.rand() * S, y = TEX.rand() * S;
      g.fillStyle = 'rgba(255,190,160,' + (0.01 + TEX.rand() * 0.03).toFixed(3) + ')';
      g.fillRect(x, y, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 7. 汉白玉
 * ----------------------------------------------------------- */
TEX.marble = function () {
  return TEX.once('marble', function () {
    const S = 512, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#efeade'); bg.addColorStop(0.5, '#e6e0d2'); bg.addColorStop(1, '#eee9dd');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    // 石纹
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = 'rgba(150,145,130,' + (0.05 + TEX.rand() * 0.1).toFixed(3) + ')';
      g.lineWidth = 0.8 + TEX.rand() * 1.6;
      g.beginPath();
      let x = TEX.rand() * S, y = TEX.rand() * S;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (TEX.rand() - 0.5) * 90;
        y += (TEX.rand() - 0.5) * 60;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let k = 0; k < 12000; k++) {
      const x = TEX.rand() * S, y = TEX.rand() * S;
      g.fillStyle = TEX.rand() < 0.5
        ? 'rgba(120,115,100,' + (0.02 + TEX.rand() * 0.05).toFixed(3) + ')'
        : 'rgba(255,255,250,' + (0.02 + TEX.rand() * 0.05).toFixed(3) + ')';
      g.fillRect(x, y, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 8. 地面金砖
 * ----------------------------------------------------------- */
TEX.paving = function () {
  return TEX.once('paving', function () {
    const S = 512, N = 8, cell = S / N;
    const cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#8d8d88'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = 0.95 + TEX.rand() * 0.10;
        g.fillStyle = 'rgb(' + Math.round(148 * v) + ',' + Math.round(147 * v) + ',' + Math.round(141 * v) + ')';
        g.fillRect(i * cell + 1.2, j * cell + 1.2, cell - 2.4, cell - 2.4);
        for (let k = 0; k < 24; k++) {
          const x = i * cell + 2 + TEX.rand() * (cell - 4);
          const y = j * cell + 2 + TEX.rand() * (cell - 4);
          g.fillStyle = TEX.rand() < 0.5 ? 'rgba(70,70,66,0.06)' : 'rgba(228,228,222,0.06)';
          g.fillRect(x, y, 1 + TEX.rand() * 3, 1 + TEX.rand() * 3);
        }
      }
    }
    g.strokeStyle = 'rgba(76,76,72,0.5)'; g.lineWidth = 1.6;
    for (let i = 0; i <= N; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(S, i * cell); g.stroke();
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 9. 御路浮雕（云龙）
 * ----------------------------------------------------------- */
TEX.dragon = function () {
  return TEX.once('dragon', function () {
    const W = 512, H = 512, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#e3ddcf'; g.fillRect(0, 0, W, H);
    // 回纹边框
    g.strokeStyle = 'rgba(120,112,95,0.55)'; g.lineWidth = 3;
    g.strokeRect(16, 16, W - 32, H - 32);
    // 云纹
    const cloud = function (cx, cy, r, a) {
      g.strokeStyle = 'rgba(118,110,92,' + a + ')';
      g.lineWidth = 2.6;
      g.beginPath(); g.arc(cx, cy, r, 0.4, 5.4); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.62, 1.2, 5.9); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.3, 2.0, 6.2); g.stroke();
    };
    for (let i = 0; i < 9; i++) {
      cloud(70 + TEX.rand() * 370, 60 + TEX.rand() * 390, 12 + TEX.rand() * 26, 0.22 + TEX.rand() * 0.2);
    }
    // 龙身：S 形
    g.strokeStyle = 'rgba(105,98,82,0.55)'; g.lineWidth = 26;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(120, 400);
    g.bezierCurveTo(190, 300, 300, 340, 300, 250);
    g.bezierCurveTo(300, 160, 380, 150, 400, 110);
    g.stroke();
    // 鳞片
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      // 粗略沿线采样
      const p = [
        120 + (400 - 120) * t + Math.sin(t * 6.0) * 60,
        400 - 300 * t + Math.sin(t * 3.0) * 20
      ];
      g.strokeStyle = 'rgba(110,102,86,0.4)'; g.lineWidth = 2;
      g.beginPath(); g.arc(p[0], p[1], 9, 3.6, 6.0); g.stroke();
    }
    // 龙头
    g.fillStyle = 'rgba(108,100,84,0.6)';
    g.beginPath(); g.ellipse(414, 100, 26, 18, -0.4, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(108,100,84,0.6)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(432, 88); g.lineTo(452, 74); g.stroke();
    g.beginPath(); g.moveTo(432, 96); g.lineTo(454, 92); g.stroke();
    // 四爪
    g.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const x = 200 + i * 55, y = 330 - i * 45;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 20, y + 24); g.stroke();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y + 20); g.stroke();
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 10. 水面
 * ----------------------------------------------------------- */
TEX.water = function () {
  return TEX.once('water', function () {
    const W = 256, H = 256, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#35505c'); bg.addColorStop(0.5, '#27414e'); bg.addColorStop(1, '#314a56');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 波纹光带
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = 'rgba(190,225,235,' + (0.03 + TEX.rand() * 0.08).toFixed(3) + ')';
      g.lineWidth = 1 + TEX.rand() * 2.5;
      g.beginPath();
      const y = TEX.rand() * H;
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) {
        g.lineTo(x, y + Math.sin((x / W) * 6.28 + TEX.rand() * 0.6) * 3);
      }
      g.stroke();
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 11. 云朵（Sprite 用，带透明度）
 * ----------------------------------------------------------- */
TEX.cloud = function () {
  return TEX.once('cloud', function () {
    const S = 512, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    const blob = function (cx, cy, rx, ry, a) {
      g.save();
      g.translate(cx, cy);
      g.scale(1, ry / rx);
      const grd = g.createRadialGradient(0, 0, rx * 0.12, 0, 0, rx);
      grd.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      grd.addColorStop(0.5, 'rgba(255,255,255,' + (a * 0.62) + ')');
      grd.addColorStop(0.82, 'rgba(255,255,255,' + (a * 0.2) + ')');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, rx, 0, 6.283); g.fill();
      g.restore();
    };
    /* 横向云带：多次叠加，形成卷积云轮廓 */
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const cx = S * (0.14 + 0.72 * t + (TEX.rand() - 0.5) * 0.08);
      const cy = S * (0.56 + (TEX.rand() - 0.5) * 0.14 - Math.sin(t * Math.PI) * 0.06);
      const rx = S * (0.055 + TEX.rand() * 0.13) * (0.55 + 0.7 * Math.sin(t * Math.PI));
      blob(cx, cy, rx, rx * (0.5 + TEX.rand() * 0.35), 0.08 + TEX.rand() * 0.14);
    }
    /* 核心体量 */
    blob(S * 0.44, S * 0.55, S * 0.24, S * 0.1, 0.42);
    blob(S * 0.58, S * 0.53, S * 0.2, S * 0.09, 0.38);
    blob(S * 0.5, S * 0.47, S * 0.16, S * 0.07, 0.3);
    /* 边缘侵蚀：更碎更透气 */
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 80; i++) {
      const x = S * TEX.rand();
      const y = S * (0.3 + TEX.rand() * 0.42);
      g.globalAlpha = 0.04 + TEX.rand() * 0.14;
      g.beginPath(); g.arc(x, y, 2 + TEX.rand() * 12, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 12. 匾额（金底/蓝底 + 楷体文字）
 * ----------------------------------------------------------- */
TEX.plaque = function (text) {
  return TEX.once('plaque' + text, function () {
    const W = 512, H = 160, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#173a54');
    bg.addColorStop(0.5, '#0f2b42');
    bg.addColorStop(1, '#173a54');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 双层金边
    g.strokeStyle = '#c9a24a'; g.lineWidth = 8;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.strokeStyle = 'rgba(201,162,74,0.55)'; g.lineWidth = 2;
    g.strokeRect(18, 18, W - 36, H - 36);
    // 文字
    g.fillStyle = '#e8c877';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold ' + (H * 0.52) + 'px "KaiTi","STKaiti","SimSun",serif';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 6;
    g.fillText(text, W / 2, H / 2 + 4);
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 13. 崖/檐下阴影带（瓦口、椽头）
 * ----------------------------------------------------------- */
TEX.rafter = function () {
  return TEX.once('rafter', function () {
    const W = 256, H = 64, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#3d1b12'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      g.fillStyle = '#5c2a1c'; g.fillRect(x, 0, 9, H);
      g.fillStyle = 'rgba(190,140,60,0.5)'; g.fillRect(x + 9, H * 0.35, 3, H * 0.5);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 13.5 圆形光点（星星 / 粒子）
 * ----------------------------------------------------------- */
TEX.dot = function () {
  return TEX.once('dot', function () {
    const S = 64, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 13.6 井口天花（金点网格）
 * ----------------------------------------------------------- */
TEX.coffer = function () {
  return TEX.once('coffer', function () {
    const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#1c3a3c'; g.fillRect(0, 0, S, S);
    const cell = S / 2;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = '#234649';
        g.fillRect(i * cell + 6, j * cell + 6, cell - 12, cell - 12);
        g.strokeStyle = 'rgba(201,165,74,0.85)'; g.lineWidth = 3;
        g.strokeRect(i * cell + 6, j * cell + 6, cell - 12, cell - 12);
        g.fillStyle = '#c9a54a';
        g.beginPath(); g.arc(i * cell + cell / 2, j * cell + cell / 2, 10, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(201,165,74,0.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(i * cell + cell / 2, j * cell + cell / 2, 22, 0.4, 4.2); g.stroke();
      }
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 13.7 AO 接触阴影（径向渐变）
 * ----------------------------------------------------------- */
TEX.aoBlob = function () {
  return TEX.once('aoblob', function () {
    const S = 128, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.42)');
    grd.addColorStop(0.75, 'rgba(0,0,0,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 13.8 脚印（雪地）
 * ----------------------------------------------------------- */
TEX.footprint = function () {
  return TEX.once('footprint', function () {
    const W = 64, H = 128, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    /* 鞋底 */
    g.beginPath();
    g.ellipse(W / 2, H * 0.36, W * 0.3, H * 0.24, 0, 0, 6.283);
    g.fill();
    g.beginPath();
    g.ellipse(W / 2, H * 0.74, W * 0.26, H * 0.2, 0, 0, 6.283);
    g.fill();
    /* 纹路 */
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 6; i++) {
      g.fillRect(W * 0.22, H * 0.24 + i * H * 0.045, W * 0.56, H * 0.012);
    }
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 14. 文字 Sprite 贴图（标注）
 * ----------------------------------------------------------- */
TEX.label = function (text, color) {
  return TEX.once('label' + text + (color || ''), function () {
    const W = 512, H = 160, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    // 底衬
    g.fillStyle = 'rgba(12,16,20,0.55)';
    const r = 28, x = 40, y = 34, w = W - 80, h = H - 68;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(201,162,74,0.75)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = color || '#f0d79a';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 66px "KaiTi","STKaiti","SimSun",serif';
    g.fillText(text, W / 2, H / 2 + 3);
    return TEX.tex(cv, 1, 1);
  });
};


/* -------------------------------------------------------------
 * 15. 凹凸贴图（灰度）：琉璃瓦 / 金砖 / 汉白玉 / 宫墙 / 木纹 / 栏板
 * ----------------------------------------------------------- */
TEX.bumpRoof = function () {
  return TEX.once('bumpRoof', function () {
    const W = 256, H = 256, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const x0 = i * W / 4, w = W / 4;
      const grd = g.createLinearGradient(x0, 0, x0 + w, 0);
      grd.addColorStop(0, '#4a4a4a'); grd.addColorStop(0.5, '#e8e8e8'); grd.addColorStop(1, '#4a4a4a');
      g.fillStyle = grd; g.fillRect(x0, 0, w, H);
    }
    for (let j = 0; j < 4; j++) {
      const y = j * H / 4;
      g.fillStyle = '#333333'; g.fillRect(0, y, W, 3);
    }
    for (let k = 0; k < 1400; k++) {
      g.fillStyle = 'rgba(120,120,120,' + (0.05 + TEX.rand() * 0.15).toFixed(3) + ')';
      g.fillRect(TEX.rand() * W, TEX.rand() * H, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
    }
    return TEX.tex(cv, 1, 1, false);
  });
};
TEX.bumpPaving = function () {
  return TEX.once('bumpPaving', function () {
    const S = 256, N = 8, cell = S / N, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        g.fillStyle = 'rgb(' + Math.round(120 + TEX.rand() * 30) + ',' + Math.round(120 + TEX.rand() * 30) + ',' + Math.round(120 + TEX.rand() * 30) + ')';
        g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
      }
    }
    return TEX.tex(cv, 1, 1, false);
  });
};
TEX.bumpMarble = function () {
  return TEX.once('bumpMarble', function () {
    const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = 'rgba(60,60,60,' + (0.2 + TEX.rand() * 0.25).toFixed(3) + ')';
      g.lineWidth = 0.8 + TEX.rand() * 1.6;
      g.beginPath();
      let x = TEX.rand() * S, y = TEX.rand() * S;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (TEX.rand() - 0.5) * 80;
        y += (TEX.rand() - 0.5) * 60;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return TEX.tex(cv, 1, 1, false);
  });
};
TEX.bumpWall = function () {
  return TEX.once('bumpWall', function () {
    const S = 256, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#888888'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = 'rgba(' + Math.round(90 + TEX.rand() * 100) + ',' + Math.round(90 + TEX.rand() * 100) + ',' + Math.round(90 + TEX.rand() * 100) + ',0.25)';
      g.fillRect(TEX.rand() * S, TEX.rand() * S, 1 + TEX.rand() * 2, 1 + TEX.rand() * 2);
    }
    for (let i = 0; i < S; i += 32) {
      g.fillStyle = 'rgba(50,50,50,0.35)';
      g.fillRect(i, 0, 2, S);
    }
    return TEX.tex(cv, 1, 1, false);
  });
};
TEX.bumpWood = function () {
  return TEX.once('bumpWood', function () {
    const S = 128, cv = TEX.canvas(S, S), g = cv.getContext('2d');
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const y = TEX.rand() * S;
      g.strokeStyle = 'rgba(60,60,60,' + (0.15 + TEX.rand() * 0.3).toFixed(3) + ')';
      g.lineWidth = 0.6 + TEX.rand() * 1.4;
      g.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const yy = y + Math.sin((x / S) * 6.283 + TEX.rand() * 2) * 2;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    return TEX.tex(cv, 1, 1, false);
  });
};
TEX.bumpRail = function () {
  return TEX.once('bumpRail', function () {
    const W = 128, H = 128, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#909090'; g.fillRect(0, 0, W, H);
    /* 云纹浮雕 */
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const cx = 32 + i * 64, cy = 32 + j * 64;
        g.strokeStyle = 'rgba(50,50,50,0.75)'; g.lineWidth = 3;
        g.beginPath(); g.arc(cx, cy, 22, 0.5, 5.8); g.stroke();
        g.beginPath(); g.arc(cx, cy, 13, 2.0, 6.2); g.stroke();
        g.fillStyle = 'rgba(210,210,210,0.7)';
        g.beginPath(); g.arc(cx, cy, 6, 0, 6.283); g.fill();
      }
    }
    return TEX.tex(cv, 1, 1, false);
  });
};

/* -------------------------------------------------------------
 * 16. 水渍 / 风化污痕（用于墙基与石作）
 * ----------------------------------------------------------- */
TEX.stain = function () {
  return TEX.once('stain', function () {
    const W = 256, H = 128, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = TEX.rand() * W, y = H * 0.2 + TEX.rand() * H * 0.8;
      const r = 6 + TEX.rand() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(30,24,18,' + (0.05 + TEX.rand() * 0.16).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(30,24,18,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    /* 底部积尘 */
    const grd2 = g.createLinearGradient(0, H * 0.55, 0, H);
    grd2.addColorStop(0, 'rgba(26,20,14,0)');
    grd2.addColorStop(1, 'rgba(26,20,14,0.35)');
    g.fillStyle = grd2;
    g.fillRect(0, H * 0.55, W, H * 0.45);
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 17. 接地 AO 条带（墙基/台基阴影渐变）
 * ----------------------------------------------------------- */
TEX.aoStrip = function () {
  return TEX.once('aoStrip', function () {
    const W = 64, H = 128, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const grd = g.createLinearGradient(0, H, 0, H * 0.25);
    grd.addColorStop(0, 'rgba(0,0,0,0.62)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    return TEX.tex(cv, 1, 1);
  });
};

/* -------------------------------------------------------------
 * 18. 云影（地面移动的云层阴影）
 * ----------------------------------------------------------- */
TEX.cloudShadow = function () {
  return TEX.once('cloudShadow', function () {
    const W = 256, H = 160, cv = TEX.canvas(W, H), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = TEX.rand() * W, y = TEX.rand() * H, r = 18 + TEX.rand() * 52;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,' + (0.16 + TEX.rand() * 0.2).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    return TEX.tex(cv, 1, 1);
  });
};
