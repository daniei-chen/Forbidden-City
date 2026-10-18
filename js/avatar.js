/* =============================================================
 *  紫禁城 · 数字复原  —  可漫游小人
 *  程序化卡通角色：行走 / 奔跑 / 跳跃 动画，第三人称展示
 * ============================================================= */
const AVATAR = {
  group: null,
  parts: {},
  phase: 0,
  idleT: 0,
  built: false,

  build: function () {
    if (this.built) return this.group;
    const g = new THREE.Group();

    const M = {
      robe: new THREE.MeshStandardMaterial({ color: 0x8f231c, roughness: 0.72, metalness: 0.05 }),
      robeDark: new THREE.MeshStandardMaterial({ color: 0x6d1913, roughness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.42, metalness: 0.55 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xe8c49a, roughness: 0.66 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x161312, roughness: 0.55 }),
      boot: new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.8 }),
      belt: new THREE.MeshStandardMaterial({ color: 0xb8913c, roughness: 0.45, metalness: 0.5 })
    };

    /* ---------- 腿 ---------- */
    const makeLeg = function (sx) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.1, 0.44, 0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.24, 8), M.robeDark);
      thigh.position.y = -0.12;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.22, 8), M.robeDark);
      shin.position.y = -0.35;
      leg.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.24), M.boot);
      boot.position.set(0, -0.45, 0.035);
      leg.add(boot);
      g.add(leg);
      return leg;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    /* ---------- 身体（袍） ---------- */
    const torso = new THREE.Group();
    torso.position.y = 0.44;
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.26, 0.6, 12), M.robe);
    robe.position.y = 0.3;
    torso.add(robe);
    /* 下摆金边 */
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.27, 0.05, 12), M.trim);
    hem.position.y = 0.015;
    torso.add(hem);
    /* 腰带 */
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.172, 0.07, 12), M.belt);
    belt.position.y = 0.38;
    torso.add(belt);
    /* 前襟 */
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.02), M.trim);
    front.position.set(0, 0.3, 0.178);
    torso.add(front);
    g.add(torso);

    /* ---------- 手臂 ---------- */
    const makeArm = function (sx) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.26, 0.96, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.2, 8), M.robe);
      upper.position.y = -0.1;
      arm.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.18, 8), M.robe);
      fore.position.y = -0.29;
      arm.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 8), M.trim);
      cuff.position.y = -0.36;
      arm.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), M.skin);
      hand.position.y = -0.41;
      arm.add(hand);
      g.add(arm);
      return arm;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    /* ---------- 头 ---------- */
    const head = new THREE.Group();
    head.position.y = 1.02;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 8), M.skin);
    neck.position.y = 0.02;
    head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 14), M.skin);
    skull.position.y = 0.2;
    skull.scale.set(1, 1.04, 1);
    head.add(skull);
    /* 眼睛 */
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.hair);
      eye.position.set(sx * 0.068, 0.23, 0.163);
      head.add(eye);
    }
    /* 官帽 */
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
    cap.position.y = 0.28;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.035, 16), M.hair);
    brim.position.y = 0.315;
    head.add(brim);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.trim);
    top.position.y = 0.44;
    head.add(top);
    g.add(head);

    g.castShadow = true;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this.group = g;
    this.parts = { group: g, legL: legL, legR: legR, armL: armL, armR: armR, torso: torso, head: head };
    this.built = true;
    g.visible = false;
    return g;
  },

  setVisible: function (v) {
    if (this.group) this.group.visible = !!v;
  },

  place: function (pos, yaw) {
    if (!this.group) return;
    this.group.position.set(pos.x, pos.y, pos.z);
    this.group.rotation.y = yaw;
  },

  update: function (dt, st) {
    if (!this.group || !this.group.visible) return;
    const p = this.parts;
    const moving = st.moving;
    const speed = st.speed || 0;
    const onGround = st.onGround !== false;

    if (!onGround) {
      /* 跳跃姿态 */
      p.legL.rotation.x = -0.55;
      p.legR.rotation.x = -1.0;
      p.armL.rotation.x = -1.9;
      p.armR.rotation.x = -1.9;
      p.armL.rotation.z = 0.25;
      p.armR.rotation.z = -0.25;
      p.torso.rotation.x = -0.1;
      p.head.rotation.x = 0.08;
    } else if (moving) {
      this.phase += dt * (speed > 8 ? 12 : 7.5);
      const s = Math.sin(this.phase);
      p.legL.rotation.x = s * 0.72;
      p.legR.rotation.x = -s * 0.72;
      p.armL.rotation.x = -s * 0.58;
      p.armR.rotation.x = s * 0.58;
      p.armL.rotation.z = 0.08;
      p.armR.rotation.z = -0.08;
      p.torso.position.y = 0.44 + Math.abs(Math.sin(this.phase)) * 0.028;
      p.torso.rotation.y = Math.sin(this.phase) * 0.07;
      p.torso.rotation.x = 0.04;
      p.head.rotation.x = -0.03;
    } else {
      /* 待机呼吸 */
      this.idleT += dt;
      const b = Math.sin(this.idleT * 1.6);
      p.legL.rotation.x = 0;
      p.legR.rotation.x = 0;
      p.armL.rotation.x = 0.04 + b * 0.03;
      p.armR.rotation.x = 0.04 - b * 0.03;
      p.armL.rotation.z = 0.1;
      p.armR.rotation.z = -0.1;
      p.torso.position.y = 0.44 + b * 0.008;
      p.torso.rotation.y = Math.sin(this.idleT * 0.5) * 0.05;
      p.torso.rotation.x = 0;
      p.head.rotation.x = b * 0.025;
      p.head.rotation.y = Math.sin(this.idleT * 0.4) * 0.12;
    }
  }
};
