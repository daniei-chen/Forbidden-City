/* =============================================================
 *  紫禁城 · 数字复原  —  全局配置
 *  质量档位 / 时段主题 / 版本信息
 * ============================================================= */
const CONFIG = {
  version: '6.33.0',
  storageKey: 'forbidden-city-settings-v2',

  /* ---------------- 画质档位 ---------------- */
  quality: {
    high: {
      label: '高',
      pixelRatio: 1.5,
      shadowSize: 4096,
      shadows: true,
      clouds: 24,
      snow: 2600,
      stars: true
    },
    medium: {
      label: '中',
      pixelRatio: 1.2,
      shadowSize: 2048,
      shadows: true,
      clouds: 14,
      snow: 1500,
      stars: true
    },
    low: {
      label: '低',
      pixelRatio: 1,
      shadowSize: 1024,
      shadows: false,
      clouds: 4,
      snow: 700,
      stars: false
    }
  },

  /* ---------------- 时段主题 ----------------
   * 画面通过插值过渡：颜色 / 强度 / 材质 uniform
   * snow: 屋面与地面雪覆盖强度, windowGlow: 夜间窗光, stars / lanterns: 星空与宫灯
   */
  themes: {
    day: {
      label: '白天', en: 'Day',
      skyTop: 0x4b83c0, skyBottom: 0xd6e2ec,
      sunColor: 0xfff2da, sunInt: 3.1, sunPos: [250, 330, 185],
      hemiSky: 0xa7c1dc, hemiGround: 0x6d5c47, hemiInt: 0.55,
      fillColor: 0x9db7d6, fillInt: 0.22,
      fog: 0xc6d4df, exposure: 0.93, bloom: 0.42, rays: 0.14,
      glow: 0xfff0cc, glowOp: 0.32,
      cloud: 0xffffff, cloudOp: 1.0,
      cloudN: 0.55,
      snow: 0, windowGlow: 0, stars: 0, lanterns: 0,
      grade: { sat: 1.06, contrast: 1.02, tint: [1, 1, 1], lift: [0.004, 0.004, 0.006], vignette: 0.2, grain: 0.010 }
    },
    dusk: {
      label: '黄昏', en: 'Dusk',
      skyTop: 0x2c3f66, skyBottom: 0xf0b48e,
      sunColor: 0xffd0a6, sunInt: 2.15, sunPos: [-280, 220, 140],
      hemiSky: 0xa4b4d4, hemiGround: 0x4a4238, hemiInt: 0.62,
      fillColor: 0x7d8fc4, fillInt: 0.3,
      fog: 0xc4b0a6, exposure: 1.0, bloom: 0.55, rays: 0.52,
      glow: 0xffc290, glowOp: 0.5,
      cloud: 0xffd9b8, cloudOp: 1.0,
      cloudN: 0.6,
      snow: 0, windowGlow: 0.35, stars: 0, lanterns: 0.5,
      grade: { sat: 1.12, contrast: 1.03, tint: [1.06, 0.99, 0.92], lift: [0.008, 0.004, 0.0], vignette: 0.3, grain: 0.013 }
    },
    night: {
      label: '夜景', en: 'Night',
      skyTop: 0x050a17, skyBottom: 0x16233a,
      sunColor: 0xa8bfe0, sunInt: 0.95, sunPos: [-220, 300, -160],
      hemiSky: 0x2f4260, hemiGround: 0x11151c, hemiInt: 0.46,
      fillColor: 0x3a4c6a, fillInt: 0.22,
      fog: 0x101c2e, exposure: 1.32, bloom: 0.85, rays: 0.0,
      glow: 0xaac4ea, glowOp: 0.22,
      cloud: 0x3a4860, cloudOp: 0.4,
      cloudN: 0.3,
      snow: 0, windowGlow: 1.0, stars: 1, lanterns: 1,
      grade: { sat: 1.04, contrast: 1.06, tint: [0.94, 0.99, 1.10], lift: [0.0, 0.004, 0.010], vignette: 0.36, grain: 0.018 }
    },
    snow: {
      label: '雪景', en: 'Snow',
      skyTop: 0x9db0c4, skyBottom: 0xe2e9ef,
      sunColor: 0xeaf2ff, sunInt: 2.3, sunPos: [180, 300, 160],
      hemiSky: 0xd6e0ec, hemiGround: 0x93999e, hemiInt: 0.85,
      fillColor: 0xc9d6e4, fillInt: 0.3,
      fog: 0xdfe6ec, exposure: 0.95, bloom: 0.35, rays: 0.10,
      glow: 0xeaf2ff, glowOp: 0.16,
      cloud: 0xf2f6fa, cloudOp: 0.9,
      cloudN: 0.6,
      snow: 1, windowGlow: 0.15, stars: 0, lanterns: 0.08,
      grade: { sat: 0.94, contrast: 0.99, tint: [1.0, 1.01, 1.04], lift: [0.010, 0.012, 0.014], vignette: 0.22, grain: 0.012 }
    }
  },

  themeOrder: ['day', 'dusk', 'night', 'snow']
};
