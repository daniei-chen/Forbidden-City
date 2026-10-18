/* =============================================================
 *  紫禁城 · 数字复原  —  后期处理
 *  场景 → HDR 目标 → 全屏 shader（ACES 色调映射 / 调色 / 暗角 / 颗粒）
 *  低画质档关闭，直接渲染。
 * ============================================================= */
const POST = {
  enabled: false,
  renderer: null,
  rt: null,
  quadScene: null,
  quadCam: null,
  material: null,
  width: 1,
  height: 1,

  init: function (renderer) {
    this.renderer = renderer;
    this.width = Math.max(2, Math.floor(window.innerWidth * renderer.getPixelRatio()));
    this.height = Math.max(2, Math.floor(window.innerHeight * renderer.getPixelRatio()));

    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      encoding: THREE.LinearEncoding,
      stencilBuffer: false,
      depthBuffer: true
    };
    if (renderer.capabilities.isWebGL2) opts.samples = 2;
    this.rt = new THREE.WebGLRenderTarget(this.width, this.height, opts);

    /* SSAO：低分辨率深度目标 + 深度材质 */
    this.ssao = false;
    this.ssaoFrame = 0;
    this.depthScale = 0.45;
    this.depthRT = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(this.width * this.depthScale)),
      Math.max(2, Math.floor(this.height * this.depthScale)),
      {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
        depthBuffer: true, stencilBuffer: false
      }
    );
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

    /* Bloom：1/4 分辨率亮部提取 + 两方向高斯模糊 */
    const bw = Math.max(2, Math.floor(this.width / 4));
    const bh = Math.max(2, Math.floor(this.height / 4));
    const bopts = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      depthBuffer: false, stencilBuffer: false
    };
    this.bloomRT = new THREE.WebGLRenderTarget(bw, bh, bopts);
    this.bloomTmp = new THREE.WebGLRenderTarget(bw, bh, bopts);

    /* 体积光/太阳径向光束：1/6 分辨率径向模糊 */
    const rw6 = Math.max(2, Math.floor(this.width / 6));
    const rh6 = Math.max(2, Math.floor(this.height / 6));
    this.raysRT = new THREE.WebGLRenderTarget(rw6, rh6, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      depthBuffer: false, stencilBuffer: false
    });
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.72 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
        '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
        '  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);',
        '  gl_FragColor = vec4(c * k, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;',
        'void main(){',
        '  vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;',
        '  sum += texture2D(tDiffuse, vUv + uDir * 1.384615).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv - uDir * 1.384615).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv + uDir * 3.230769).rgb * 0.070270;',
        '  sum += texture2D(tDiffuse, vUv - uDir * 3.230769).rgb * 0.070270;',
        '  gl_FragColor = vec4(sum, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uExposure: { value: 1.0 },
        uContrast: { value: 1.02 },
        uSaturation: { value: 1.04 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uLift: { value: new THREE.Vector3(0, 0, 0) },
        uVignette: { value: 0.22 },
        uGrain: { value: 0.012 },
        uTime: { value: 0 },
        uMode: { value: 2 },
        uFilter: { value: 0 },
        tDepth: { value: this.depthRT.texture },
        tBloom: { value: this.bloomRT.texture },
        tRays: { value: this.raysRT.texture },
        uRaysStrength: { value: 0 },
        uBloomStrength: { value: 0.4 },
        uDepthRes: { value: new THREE.Vector2(this.depthRT.width, this.depthRT.height) },
        uNear: { value: 0.8 },
        uFar: { value: 9000 },
        uSSAO: { value: 1.0 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = vec4(position.xy, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <packing>',
        'uniform sampler2D tDiffuse;',
        'uniform float uExposure;',
        'uniform float uContrast;',
        'uniform float uSaturation;',
        'uniform vec3 uTint;',
        'uniform vec3 uLift;',
        'uniform float uVignette;',
        'uniform float uGrain;',
        'uniform float uTime;',
        'uniform float uMode;',
        'uniform float uFilter;',
        'uniform sampler2D tDepth;',
        'uniform sampler2D tBloom;',
        'uniform float uBloomStrength;',
        'uniform sampler2D tRays;',
        'uniform float uRaysStrength;',
        'uniform vec2 uDepthRes;',
        'uniform float uNear;',
        'uniform float uFar;',
        'uniform float uSSAO;',
        'varying vec2 vUv;',
        '',
        'vec3 aces(vec3 x) {',
        '  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
        '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
        '}',
        '',
        'float ioViewDepth(vec4 v) {',
        '  float d = unpackRGBAToDepth(v);',
        '  return -perspectiveDepthToViewZ(d, uNear, uFar);',
        '}',
        '',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
        '}',
        '',
        'void main() {',
        '  vec4 tex = texture2D(tDiffuse, vUv);',
        '  vec3 raw = tex.rgb;',
        '  vec3 col;',
        '  if (uMode < 0.5) {',
        '    col = raw;',
        '  } else if (uMode < 1.5) {',
        '    col = pow(max(raw, 0.0), vec3(0.4545454545));',
        '  } else {',
        '    // 天空与几何体分开处理：天空不含色调映射，直接进入显示空间',
        '    if (tex.a < 0.5) {',
        '      col = max(raw, 0.0);',
        '    } else {',
        '      col = pow(max(raw * uExposure, 0.0), vec3(0.4545454545));',
        '    }',
        '    // 显示空间调色：染色 / 提亮 / 对比 / 饱和',
        '    col = col * uTint + uLift;',
        '    col = (col - 0.5) * uContrast + 0.5;',
        '    vec3 bl = texture2D(tBloom, vUv).rgb;',
        '    col += bl * uBloomStrength;',
        '    col += texture2D(tRays, vUv).rgb * uRaysStrength;',
        '    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
        '    col = mix(vec3(lum), col, uSaturation);',
        '  }',
        '  if (uMode >= 1.5) {',
        '    /* 屏幕空间 AO（深度边缘遮蔽） */',
        '    if (uSSAO > 0.01 && tex.a >= 0.5) {',
        '      float d0 = ioViewDepth(texture2D(tDepth, vUv));',
        '      float fade = 1.0 - smoothstep(160.0, 420.0, d0);',
        '      if (fade > 0.01) {',
        '        float th = 0.03 + d0 * 0.012;',
        '        vec2 o = vec2(1.0) / uDepthRes * (0.9 + min(d0, 220.0) * 0.008);',
        '        float occ = 0.0;',
        '        occ += (1.0 - step(d0 - 0.06, ioViewDepth(texture2D(tDepth, vUv + vec2(1.0, 0.0) * o)))) * 0.11;',
        '        occ += (1.0 - step(d0 - 0.06, ioViewDepth(texture2D(tDepth, vUv + vec2(-1.0, 0.0) * o)))) * 0.11;',
        '        occ += (1.0 - step(d0 - 0.06, ioViewDepth(texture2D(tDepth, vUv + vec2(0.0, 1.0) * o)))) * 0.11;',
        '        occ += (1.0 - step(d0 - 0.06, ioViewDepth(texture2D(tDepth, vUv + vec2(0.0, -1.0) * o)))) * 0.11;',
        '        occ += (1.0 - step(d0 - 0.10, ioViewDepth(texture2D(tDepth, vUv + vec2(1.0, 1.0) * o * 1.6)))) * 0.075;',
        '        occ += (1.0 - step(d0 - 0.10, ioViewDepth(texture2D(tDepth, vUv + vec2(-1.0, 1.0) * o * 1.6)))) * 0.075;',
        '        occ += (1.0 - step(d0 - 0.10, ioViewDepth(texture2D(tDepth, vUv + vec2(1.0, -1.0) * o * 1.6)))) * 0.075;',
        '        occ += (1.0 - step(d0 - 0.10, ioViewDepth(texture2D(tDepth, vUv + vec2(-1.0, -1.0) * o * 1.6)))) * 0.075;',
        '        col *= (1.0 - occ * fade);',
        '      }',
        '    }',
        '    if (uFilter > 0.5 && uFilter < 1.5) {',
        '      col = col * vec3(1.06, 1.0, 0.90) + vec3(0.012, 0.006, -0.004);',
        '    } else if (uFilter > 1.5) {',
        '      float l2 = dot(col, vec3(0.299, 0.587, 0.114));',
        '      col = vec3(l2) * 1.05;',
        '    }',
        '    vec2 q = vUv - 0.5;',
        '    float vig = smoothstep(0.9, 0.25, length(q));',
        '    col *= mix(1.0, vig, uVignette);',
        '    float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;',
        '    col += g * uGrain;',
        '  }',
        '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
        '}'
      ].join('\n'),
      depthTest: false,
      depthWrite: false
    });

    this.raysMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uSun;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 sum = vec3(0.0);',
        '  float wsum = 0.0;',
        '  for (int i = 0; i < 16; i++) {',
        '    float t = float(i) / 15.0;',
        '    vec2 uv = vUv + (uSun - vUv) * t * 0.38;',
        '    float w = pow(1.0 - t, 2.2);',
        '    sum += texture2D(tDiffuse, uv).rgb * w;',
        '    wsum += w;',
        '  }',
        '  gl_FragColor = vec4(sum / max(wsum, 1e-4), 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
    this.quadMesh = quad;
  },

  setSSAO: function (on) {
    this.ssao = !!on;
  },

  setEnabled: function (on) {
    this.enabled = !!on;
    if (!this.renderer) return;
    if (on) {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.outputEncoding = THREE.LinearEncoding;
    } else {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
  },

  setSize: function (w, h, pr) {
    if (!this.rt) return;
    this.width = Math.max(2, Math.floor(w * pr));
    this.height = Math.max(2, Math.floor(h * pr));
    this.rt.setSize(this.width, this.height);
    if (this.depthRT) {
      const dw = Math.max(2, Math.floor(this.width * this.depthScale));
      const dh = Math.max(2, Math.floor(this.height * this.depthScale));
      this.depthRT.setSize(dw, dh);
      this.material.uniforms.uDepthRes.value.set(dw, dh);
    }
    if (this.bloomRT) {
      const bw = Math.max(2, Math.floor(this.width / 4));
      const bh = Math.max(2, Math.floor(this.height / 4));
      this.bloomRT.setSize(bw, bh);
      this.bloomTmp.setSize(bw, bh);
    }
    if (this.raysRT) {
      const rw = Math.max(2, Math.floor(this.width / 6));
      const rh = Math.max(2, Math.floor(this.height / 6));
      this.raysRT.setSize(rw, rh);
    }
    this.material.uniforms.tDiffuse.value = this.rt.texture;
  },

  render: function (scene, camera, params) {
    if (!this.enabled) {
      this.renderer.render(scene, camera);
      return;
    }
    const u = this.material.uniforms;
    u.uExposure.value = params.exposure;
    u.uContrast.value = params.contrast;
    u.uSaturation.value = params.saturation;
    u.uTint.value.set(params.tint[0], params.tint[1], params.tint[2]);
    u.uLift.value.set(params.lift[0], params.lift[1], params.lift[2]);
    u.uVignette.value = params.vignette;
    u.uGrain.value = params.grain;
    u.uTime.value = params.time;
    u.uFilter.value = params.filter || 0;

    /* SSAO 深度 pass（隐藏粒子/精灵，避免异常几何） */
    if (this.ssao) {
      this.ssaoFrame++;
      const hidden = [];
      const camPos = camera.position;
      const tmpV = new THREE.Vector3();
      scene.traverse(function (o) {
        if (!o.visible) return;
        if (o.isPoints || o.isSprite) { hidden.push(o); o.visible = false; return; }
        /* 远处小物体不参与深度 pass：AO 在 420m 外已淡出 */
        if (o.isMesh && o.geometry) {
          const bs = o.geometry.boundingSphere;
          if (bs && bs.radius < 220) {
            o.getWorldPosition(tmpV);
            if (tmpV.distanceTo(camPos) > 420) { hidden.push(o); o.visible = false; }
          }
        }
      });
      const oldShadowAuto = this.renderer.shadowMap.autoUpdate;
      this.renderer.shadowMap.autoUpdate = false;
      scene.overrideMaterial = this.depthMat;
      this.renderer.setRenderTarget(this.depthRT);
      this.renderer.clear();
      this.renderer.render(scene, camera);
      scene.overrideMaterial = null;
      this.renderer.setRenderTarget(null);
      this.renderer.shadowMap.autoUpdate = oldShadowAuto;
      for (let hi = 0; hi < hidden.length; hi++) hidden[hi].visible = true;
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      u.uSSAO.value = 1.0;
    } else {
      u.uSSAO.value = 0.0;
    }

    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.sceneCalls = this.renderer.info.render.calls;
    this.sceneTris = this.renderer.info.render.triangles;

    /* Bloom pass */
    const bloomStrength = params.bloom == null ? 0.4 : params.bloom;
    u.uBloomStrength.value = bloomStrength;
    if (bloomStrength > 0.001) {
      this.brightMat.uniforms.tDiffuse.value = this.rt.texture;
      this.quadMesh.material = this.brightMat;
      this.renderer.setRenderTarget(this.bloomRT);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);

      this.blurMat.uniforms.tDiffuse.value = this.bloomRT.texture;
      this.blurMat.uniforms.uDir.value.set(1 / this.bloomRT.width, 0);
      this.quadMesh.material = this.blurMat;
      this.renderer.setRenderTarget(this.bloomTmp);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);

      this.blurMat.uniforms.tDiffuse.value = this.bloomTmp.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1 / this.bloomTmp.height);
      this.renderer.setRenderTarget(this.bloomRT);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
    }

    /* 太阳径向光束 pass */
    const raysStrength = params.rays == null ? 0 : params.rays;
    u.uRaysStrength.value = raysStrength;
    if (raysStrength > 0.001 && params.sunUv && params.sunUv[0] >= -0.2 && params.sunUv[0] <= 1.2 && params.sunUv[1] >= -0.2 && params.sunUv[1] <= 1.2) {
      this.raysMat.uniforms.tDiffuse.value = this.rt.texture;
      this.raysMat.uniforms.uSun.value.set(params.sunUv[0], params.sunUv[1]);
      this.quadMesh.material = this.raysMat;
      this.renderer.setRenderTarget(this.raysRT);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
    }

    this.quadMesh.material = this.material;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
};
