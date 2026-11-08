// Fenced field with two plots: CropSentry (real URDF meshes) drives over the strawberry rows at its smallest,
// widens and lifts in the gap, does the taller plot, then shrinks and drives home along the side lane.
import * as THREE from 'three';
import { mat, floor, gridTexture, rosModel, tag, bracket, rng, clamp, smooth, wrap, yawOf, rayBoxes, liveLine, line, TAU } from '../kit.js';

const A_ROWS = [-1.2, -0.4, 0.4, 1.2], A_X0 = -5.0, A_X1 = -1.4, A_STEP = 0.3;
const B_ROWS = [-1.5, -0.5, 0.5, 1.5], B_X0 = 1.3, B_X1 = 5.3, B_STEP = 0.5;
const A_W = -5.8, A_E = -0.7, GAP = 0.1, B_E = 6.0, LANE = 2.5, HOME = -6.4;
const FENCE = { x0: -7.2, x1: 7.2, z0: -2.6, z1: 3.2 };
const MAX = 0.09; // both actuator strokes, metres

export function build({ models, mobile }) {
  const group = new THREE.Group();
  const r = rng(29);

  // grass outside, soil inside the fence
  const grass = floor(26, 16, gridTexture({ bg: '#3d5a2b', line: 'rgba(0,0,0,0)', major: 'rgba(0,0,0,0)', cells: 1, noise: 0.3, seed: 8 }), 1.2);
  grass.position.y = 0.002;
  group.add(grass);
  const soil = floor(FENCE.x1 - FENCE.x0, FENCE.z1 - FENCE.z0, gridTexture({ bg: '#5b4431', line: 'rgba(0,0,0,0)', major: 'rgba(0,0,0,0)', cells: 1, noise: 0.25, seed: 4 }), 1.5);
  soil.position.set((FENCE.x0 + FENCE.x1) / 2, 0.004, (FENCE.z0 + FENCE.z1) / 2);
  group.add(soil);

  // black mulch beds under the strawberries
  const mulch = mat('#1d1d20', { roughness: 0.6 });
  for (const z of A_ROWS) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(A_X1 - A_X0 + 0.4, 0.04, 0.3), mulch);
    b.position.set((A_X0 + A_X1) / 2, 0.02, z);
    b.receiveShadow = true;
    group.add(b);
  }

  // plants: strawberries on the beds, bigger bushes in plot B. Some are sick (yellow and brown leaves).
  const plants = [];
  A_ROWS.forEach((z, row) => { for (let x = A_X0; x <= A_X1 + 1e-6; x += A_STEP) plants.push({ x, z, plot: 'A', row, base: 0.04, h: 0.1, rad: 0.07, sick: r() < 0.1, seen: false }); });
  B_ROWS.forEach((z, row) => { for (let x = B_X0; x <= B_X1 + 1e-6; x += B_STEP) plants.push({ x, z, plot: 'B', row, base: 0, h: 0.22, rad: 0.15, sick: r() < 0.12, seen: false }); });
  const LEAVES = 4;
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#ffffff', { roughness: 0.85, flatShading: true }), plants.length * LEAVES);
  const berries = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat('#e0262b', { roughness: 0.35 }), plants.length * 2);
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 1, 5);
  stemGeo.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(stemGeo, mat('#5b7a2a'), plants.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const greens = ['#2f8a34', '#3f9c3a', '#2a7a30'], sickCols = ['#c9b13a', '#8f5d2a'];
  plants.forEach((pl, i) => {
    m4.compose(p.set(pl.x, pl.base, pl.z), q.identity(), s.set(1, pl.h * 0.6, 1));
    stems.setMatrixAt(i, m4);
    for (let k = 0; k < LEAVES; k++) {
      const a = (k / LEAVES) * TAU + r(), d = pl.rad * 0.45;
      const rr = pl.rad * (0.45 + r() * 0.2);
      e.set(r(), r() * TAU, r());
      m4.compose(p.set(pl.x + Math.cos(a) * d, pl.base + pl.h * (0.45 + 0.15 * (k % 2)), pl.z + Math.sin(a) * d), q.setFromEuler(e), s.set(rr, rr * 0.7, rr));
      leaves.setMatrixAt(i * LEAVES + k, m4);
      leaves.setColorAt(i * LEAVES + k, c.set(pl.sick && k % 2 === 0 ? sickCols[k / 2 % 2] : greens[(i + k) % 3]));
    }
    for (let k = 0; k < 2; k++) {
      const a = r() * TAU, sc = pl.plot === 'A' ? 0.014 : (r() < 0.5 ? 0 : 0.02);
      m4.compose(p.set(pl.x + Math.cos(a) * pl.rad * 0.8, pl.base + pl.h * 0.25, pl.z + Math.sin(a) * pl.rad * 0.8), q.identity(), s.setScalar(sc));
      berries.setMatrixAt(i * 2 + k, m4);
    }
  });
  for (const im of [leaves, berries, stems]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // weeds grow beside the crop, right where the sprayer nozzles pass
  const weeds = [];
  const addWeeds = (rows, x0, x1, off, n) => { for (let k = 0; k < n; k++) weeds.push({ x: x0 + 0.2 + r() * (x1 - x0 - 0.4), z: rows[(r() * rows.length) | 0] + (r() < 0.5 ? -1 : 1) * off, seen: 0, life: 1, hit: 0 }); };
  addWeeds(A_ROWS, A_X0, A_X1, 0.29, 14);
  addWeeds(B_ROWS, B_X0, B_X1, 0.38, 10);
  const weedGeo = new THREE.IcosahedronGeometry(0.045, 0);
  weedGeo.scale(1, 0.55, 1).translate(0, 0.025, 0);
  const weedMesh = new THREE.InstancedMesh(weedGeo, mat('#b9f25c', { flatShading: true, emissive: '#3a5a10', emissiveIntensity: 0.3 }), weeds.length);
  weedMesh.castShadow = true;
  group.add(weedMesh);

  // fence, shed and trees: what the lidar actually sees
  const wood = mat('#8a6a45', { roughness: 0.9 });
  const postGeo = new THREE.BoxGeometry(0.07, 1.0, 0.07);
  const posts = [];
  const sides = [[FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0], [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1], [FENCE.x1, FENCE.z1, FENCE.x0, FENCE.z1], [FENCE.x0, FENCE.z1, FENCE.x0, FENCE.z0]];
  const mesh = new THREE.MeshStandardMaterial({ color: '#b8c0c8', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  for (const [x0, z0, x1, z1] of sides) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.2);
    for (let k = 0; k < n; k++) posts.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), mesh);
    pane.position.set((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
    pane.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    group.add(pane);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), wood);
    rail.position.set((x0 + x1) / 2, 0.98, (z0 + z1) / 2);
    rail.rotation.y = pane.rotation.y;
    rail.castShadow = true;
    group.add(rail);
  }
  const postMesh = new THREE.InstancedMesh(postGeo, wood, posts.length);
  posts.forEach(([x, z], i) => { m4.compose(p.set(x, 0.5, z), q.identity(), s.set(1, 1, 1)); postMesh.setMatrixAt(i, m4); });
  postMesh.castShadow = true;
  group.add(postMesh);

  const shed = new THREE.Group();
  const shedBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 1.6), mat('#7a5236', { roughness: 0.9 }));
  shedBody.position.y = 0.85;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.75, 0.7, 4, 1), mat('#3c4148', { roughness: 0.7, flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.8);
  roof.position.y = 2.05;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.02), mat('#4a3020'));
  door.position.set(0, 0.6, 0.81);
  shed.add(shedBody, roof, door);
  shed.position.set(4.8, 0, -4.3);
  shed.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  group.add(shed);

  const treeAt = [[-9.4, -4.2], [-5.0, -4.9], [0.6, -5.1], [9.6, -1.4], [9.2, 3.8], [-9.6, 2.6], [-6.6, 6.3], [7.0, 6.5]];
  const trunkMat = mat('#5a3d27'), crown = mat('#2f6b34', { flatShading: true, roughness: 0.9 });
  for (const [x, z] of treeAt) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 7), trunkMat);
    t.position.set(x, 0.8, z);
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + r() * 0.5, 0), crown);
    k.position.set(x, 2.1 + r() * 0.4, z);
    k.rotation.set(r(), r(), r());
    for (const o of [t, k]) { o.castShadow = true; group.add(o); }
  }
  const T = 0.05;
  const boxes = [
    { x0: FENCE.x0 - T, x1: FENCE.x1 + T, z0: FENCE.z0 - T, z1: FENCE.z0 + T }, { x0: FENCE.x0 - T, x1: FENCE.x1 + T, z0: FENCE.z1 - T, z1: FENCE.z1 + T },
    { x0: FENCE.x0 - T, x1: FENCE.x0 + T, z0: FENCE.z0, z1: FENCE.z1 }, { x0: FENCE.x1 - T, x1: FENCE.x1 + T, z0: FENCE.z0, z1: FENCE.z1 },
    { x0: 3.7, x1: 5.9, z0: -5.1, z1: -3.5 },
    ...treeAt.map(([x, z]) => ({ x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15 })),
  ];

  // no-go areas over the beds, so Nav2 never plans across a row
  const keep = new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.07, depthWrite: false });
  for (const [x0, x1, z0, z1] of [[A_X0 - 0.25, A_X1 + 0.25, A_ROWS[0] - 0.3, A_ROWS[3] + 0.3], [B_X0 - 0.3, B_X1 + 0.3, B_ROWS[0] - 0.35, B_ROWS[3] + 0.35]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), keep);
    f.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    group.add(f);
    group.add(line([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => new THREE.Vector3(x, 0.014, z)), '#ff3b5c', 0.45, true));
  }

  // the mission as a list of steps: drive, pivot on the spot, resize
  const route = [];
  const P = (x, z, mode, label) => route.push({ x, z, mode, label });
  P(A_W, LANE, 'nav', 'nav2  to plot A'); P(A_W, A_ROWS[0], 'nav', 'nav2  to plot A');
  A_ROWS.forEach((z, i) => { if (i) P(i % 2 ? A_E : A_W, z, 'turn'); P(i % 2 ? A_W : A_E, z, 'row'); });
  P(A_W, LANE, 'nav', 'nav2  side lane to the gap'); P(GAP, LANE, 'nav', 'nav2  side lane to the gap'); P(GAP, B_ROWS[3], 'nav', 'nav2  into the gap'); route.push({ size: 1 });
  [...B_ROWS].reverse().forEach((z, i) => { if (i) P(i % 2 ? B_E : GAP, z, 'turn'); P(i % 2 ? GAP : B_E, z, 'row'); });
  route.push({ size: 0 });
  P(GAP, LANE, 'nav', 'nav2  driving home'); P(HOME, LANE, 'nav', 'nav2  driving home');

  const steps = [];
  let cx = HOME, cz = LANE, cy = 0, cs = 0, t0 = 0, rowN = 0, plot = 'A';
  const push = st => { st.t0 = t0; t0 += st.dur; steps.push(st); };
  for (const w of route) {
    if (w.size !== undefined) { push({ kind: 'size', s0: cs, s1: w.size, dur: 3.2, x: cx, z: cz, yaw: cy }); cs = w.size; plot = w.size ? 'B' : 'home'; rowN = 0; continue; }
    const d = Math.hypot(w.x - cx, w.z - cz);
    if (d < 1e-6) continue;
    const yaw = yawOf(w.x - cx, w.z - cz);
    const dy = wrap(yaw - cy);
    if (Math.abs(dy) > 1e-3) push({ kind: 'pivot', y0: cy, y1: cy + dy, dur: Math.abs(dy) / 1.4 + 0.2, x: cx, z: cz, s: cs });
    cy = cy + dy;
    if (w.mode === 'row') rowN++;
    push({ kind: 'drive', mode: w.mode, x0: cx, z0: cz, x1: w.x, z1: w.z, yaw: cy, s: cs, dur: d / (w.mode === 'row' ? 0.55 : 0.85), row: rowN, plot, label: w.label });
    cx = w.x; cz = w.z;
  }
  const dyHome = wrap(0 - cy);
  if (Math.abs(dyHome) > 1e-3) push({ kind: 'pivot', y0: cy, y1: cy + dyHome, dur: Math.abs(dyHome) / 1.4 + 0.2, x: cx, z: cz, s: 0 });
  const LOOP = t0;

  // the whole route drawn faintly on the ground
  const routePts = [new THREE.Vector3(HOME, 0.016, LANE)];
  for (const st of steps) if (st.kind === 'drive') routePts.push(new THREE.Vector3(st.x1, 0.016, st.z1));
  const trail = line(routePts, '#3dff9e', 0.35, true);
  group.add(trail);
  const plan = liveLine(16, '#3dff9e', 0.95);
  plan.position.y = 0.03;
  group.add(plan);

  const robot = rosModel(models.cropsentry.scene);
  group.add(robot.group);
  // URDF colours are sRGB, the packed model stores them as linear
  const fixed = new Set();
  robot.group.traverse(o => { if (o.isMesh && !fixed.has(o.material)) { fixed.add(o.material); o.material.color.convertSRGBToLinear(); } });
  const N = robot.node;
  const railL = N('rail_l'), railR = N('rail_r'), modL = N('mod_l'), modR = N('mod_r');
  const rail0 = { l: railL.position.y, r: railR.position.y }, mod0 = { l: modL.position.z, r: modR.position.z };
  const sprL = ['spr_fl', 'spr_rl'].map(N).filter(Boolean), sprR = ['spr_fr', 'spr_rr'].map(N).filter(Boolean);

  // camera footprints like the RViz camera display
  const frust = color => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    l.frustumCulled = false;
    group.add(l);
    return l;
  };
  const setFrust = (l, o, corners) => {
    const a = l.geometry.attributes.position.array;
    let n = 0;
    const put = v => { a[n++] = v.x; a[n++] = v.y; a[n++] = v.z; };
    for (let k = 0; k < 4; k++) { put(o); put(corners[k]); }
    for (let k = 0; k < 4; k++) { put(corners[k]); put(corners[(k + 1) % 4]); }
    l.geometry.attributes.position.needsUpdate = true;
  };
  const rowCam = frust('#4fd1ff'), rearCam = frust('#ffd23d'), sprCamL = frust('#ff3b5c'), sprCamR = frust('#ff3b5c');

  // lidar scan
  const RAYS = mobile ? 120 : 240;
  const scanGeo = new THREE.BufferGeometry();
  scanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAYS * 3), 3));
  const scan = new THREE.Points(scanGeo, new THREE.PointsMaterial({ color: '#ff3355', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }));
  scan.frustumCulled = false;
  group.add(scan);

  const weedBox = bracket('#ff3b5c', 0.055), leafBox = bracket('#ffd23d', 0.07);
  const weedTag = tag('weed 0.93', { edge: '#ff3b5c' }), leafTag = tag('leaf spot 0.88', { edge: '#ffd23d' });
  const phaseTag = tag('plot A  row 1 / 4', { edge: '#3dff9e' });
  for (const o of [weedBox, leafBox, weedTag, leafTag]) { o.visible = false; group.add(o); }
  group.add(phaseTag);
  const pinGeo = new THREE.ConeGeometry(0.04, 0.12, 8);
  pinGeo.rotateX(Math.PI);
  const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshBasicMaterial({ color: '#ffd23d' }), plants.length);
  pins.count = 0;
  group.add(pins);

  // spray mist: Gazebo can't show liquid either, so a short blue puff
  const NM = mobile ? 80 : 200;
  const mist = Array.from({ length: NM }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, l: 0 }));
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
  const mistPts = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: '#59b8ff', size: 0.03, transparent: true, opacity: 0.85, depthWrite: false }));
  mistPts.frustumCulled = false;
  group.add(mistPts);
  let mistN = 0;
  const puff = (x, z) => {
    for (let k = 0; k < 26; k++) {
      const d = mist[mistN++ % NM];
      const a = Math.random() * TAU, v = 0.1 + Math.random() * 0.25;
      d.x = x; d.y = 0.16; d.z = z; d.vx = Math.cos(a) * v; d.vz = Math.sin(a) * v; d.vy = -0.15 - Math.random() * 0.2; d.l = 0.7;
    }
  };

  // start near the end of plot A so the resize comes soon after the camera arrives
  const startStep = steps.findIndex(st => st.kind === 'drive' && st.mode === 'row' && st.plot === 'A' && st.row === 4);
  const st = { t: steps[startStep].t0 + steps[startStep].dur * 0.35, loop: 0, weeds: 0, sick: 0, weedT: 0, leafT: 0, lastWeed: null, lastLeaf: null, phase: '', s: 0 };
  const anchors = { robot: new THREE.Vector3(), centre: new THREE.Vector3(0, 0.3, 0) };
  const pos = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const local = (x, y, z, out = new THREE.Vector3()) => out.copy(pos).addScaledVector(fwd, x).addScaledVector(up, y).addScaledVector(side, z);
  let stepIdx = 0;

  function resetLoop() {
    weeds.forEach(w => { w.life = 1; w.hit = 0; w.seen = 0; });
    plants.forEach(pl => { pl.seen = false; });
    pins.count = 0;
    st.weeds = 0; st.sick = 0;
  }

  function update(dt, t) {
    const prevT = st.t;
    st.t += dt;
    if (st.t >= LOOP) { st.t -= LOOP; st.loop++; resetLoop(); stepIdx = 0; }
    if (st.t < prevT) stepIdx = 0;
    while (stepIdx < steps.length - 1 && st.t >= steps[stepIdx].t0 + steps[stepIdx].dur) stepIdx++;
    while (stepIdx > 0 && st.t < steps[stepIdx].t0) stepIdx--;
    const S = steps[stepIdx];
    const u = clamp((st.t - S.t0) / S.dur);
    let x, z, yaw, size, vL = 0, vR = 0, phase;
    if (S.kind === 'drive') {
      const k = S.dur > 3 ? clamp(u * 1.06 - 0.03) * 0.8 + smooth(u) * 0.2 : smooth(u);
      x = S.x0 + (S.x1 - S.x0) * k; z = S.z0 + (S.z1 - S.z0) * k; yaw = S.yaw; size = S.s;
      vL = vR = Math.hypot(S.x1 - S.x0, S.z1 - S.z0) / S.dur;
      phase = S.mode === 'row' ? `plot ${S.plot}  row ${S.row} / 4  following the row` : S.mode === 'turn' ? 'headland  next row' : S.label;
    } else if (S.kind === 'pivot') {
      x = S.x; z = S.z; yaw = S.y0 + (S.y1 - S.y0) * smooth(u); size = S.s;
      const w = (S.y1 - S.y0) / S.dur * 0.35;
      vL = -w; vR = w;
      phase = 'pivot on the bare strip';
    } else {
      x = S.x; z = S.z; yaw = S.yaw; size = S.s0 + (S.s1 - S.s0) * smooth(u);
      phase = S.s1 > S.s0 ? 'widen + lift  0.22 → 0.40 m' : 'shrink  0.40 → 0.22 m';
    }
    if (phase !== st.phase) { st.phase = phase; phaseTag.setText(phase); }
    st.s = size;
    const w = size * MAX, lift = size * MAX;

    pos.set(x, 0, z);
    robot.group.position.set(x, lift, z);
    robot.group.rotation.y = yaw;
    railL.position.y = rail0.l + w; railR.position.y = rail0.r - w;
    modL.position.z = mod0.l - lift; modR.position.z = mod0.r - lift;
    for (const n of sprL) n.rotation.y += vL * dt / 0.045;
    for (const n of sprR) n.rotation.y += vR * dt / 0.045;
    fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
    side.set(Math.sin(yaw), 0, Math.cos(yaw));
    phaseTag.position.set(x, 1.05 + lift, z);
    const rowing = S.kind === 'drive' && S.mode === 'row';

    // front camera only follows the row
    const g = 0.01;
    setFrust(rowCam, local(0.26, 0.33 + lift, 0), [local(0.42, g, -0.16), local(0.42, g, 0.16), local(0.8, g, 0.22), local(0.8, g, -0.22)]);
    // rear camera checks the plants just passed
    setFrust(rearCam, local(-0.26, 0.33 + lift, 0), [local(-0.38, g, -0.22), local(-0.38, g, 0.22), local(-0.85, g, 0.28), local(-0.85, g, -0.28)]);
    // sprayer cameras on the front tubes, tilted about 30 degrees forward
    const ly = 0.275 + w;
    setFrust(sprCamL, local(0.33, 0.24, -ly), [local(0.42, g, -ly - 0.1), local(0.42, g, -ly + 0.1), local(0.78, g, -ly + 0.14), local(0.78, g, -ly - 0.14)]);
    setFrust(sprCamR, local(0.33, 0.24, ly), [local(0.42, g, ly - 0.1), local(0.42, g, ly + 0.1), local(0.78, g, ly + 0.14), local(0.78, g, ly - 0.14)]);

    // weeds: spotted by a sprayer camera, sprayed when the nozzle reaches them
    st.weedT -= dt; st.leafT -= dt;
    for (const wd of weeds) {
      if (wd.hit) { wd.life = Math.max(0, wd.life - dt * 1.4); continue; }
      if (!rowing) continue;
      const dx = wd.x - x, dz = wd.z - z;
      const al = dx * fwd.x + dz * fwd.z, lat = Math.abs(dx * side.x + dz * side.z);
      if (Math.abs(lat - ly) > 0.09) continue;
      if (!wd.seen && al > 0.42 && al < 0.8) { wd.seen = 1; st.lastWeed = wd; st.weedT = 1.4; weedTag.setText(`weed 0.${(86 + ((wd.x * 97) | 0) % 13)}`); }
      if (al < 0.33 && al > 0.2) { wd.hit = 1; st.weeds++; puff(wd.x, wd.z); }
    }
    weeds.forEach((wd, i) => {
      const sc = Math.max(0.001, wd.life);
      m4.compose(p.set(wd.x, 0.003, wd.z), q.identity(), s.set(sc, sc, sc));
      weedMesh.setMatrixAt(i, m4);
    });
    weedMesh.instanceMatrix.needsUpdate = true;

    // disease: rear camera logs each sick plant with its spot on the map
    if (rowing) for (const pl of plants) {
      if (!pl.sick || pl.seen) continue;
      const dx = pl.x - x, dz = pl.z - z;
      const al = dx * fwd.x + dz * fwd.z, lat = Math.abs(dx * side.x + dz * side.z);
      if (al < -0.4 && al > -0.8 && lat < 0.2) {
        pl.seen = true; st.lastLeaf = pl; st.leafT = 1.8; st.sick++;
        leafTag.setText(pl.plot === 'A' ? 'leaf spot 0.88' : 'leaf blight 0.84');
        m4.compose(p.set(pl.x, pl.base + pl.h + 0.3, pl.z), q.identity(), s.setScalar(1));
        pins.setMatrixAt(pins.count++, m4);
        pins.instanceMatrix.needsUpdate = true;
      }
    }
    weedBox.visible = weedTag.visible = st.weedT > 0;
    if (st.lastWeed) { weedBox.position.set(st.lastWeed.x, 0.05, st.lastWeed.z); weedTag.position.set(st.lastWeed.x, 0.16, st.lastWeed.z); }
    leafBox.visible = leafTag.visible = st.leafT > 0;
    if (st.lastLeaf) { const pl = st.lastLeaf; leafBox.position.set(pl.x, pl.base + pl.h * 0.6, pl.z); leafTag.position.set(pl.x, pl.base + pl.h + 0.12, pl.z); }

    const ma = mistGeo.attributes.position.array;
    mist.forEach((d, k) => {
      if (d.l > 0) { d.l -= dt; d.x += d.vx * dt; d.y = Math.max(0.005, d.y + d.vy * dt); d.z += d.vz * dt; }
      ma[k * 3] = d.x; ma[k * 3 + 1] = d.l > 0 ? d.y : -9; ma[k * 3 + 2] = d.z;
    });
    mistGeo.attributes.position.needsUpdate = true;

    // lidar sits above the plants: it only sees the fence, shed and trees
    const lid = local(0.18, 0.64 + lift, 0);
    const sa = scanGeo.attributes.position.array;
    for (let k = 0; k < RAYS; k++) {
      const a = yaw + (k / RAYS) * TAU + t * 0.6, dx = Math.cos(a), dz = -Math.sin(a);
      const d = rayBoxes(lid.x, lid.z, dx, dz, boxes, 12);
      const hit = d < 12;
      sa[k * 3] = hit ? lid.x + dx * d : 0; sa[k * 3 + 1] = hit ? lid.y : -9; sa[k * 3 + 2] = hit ? lid.z + dz * d : 0;
    }
    scanGeo.attributes.position.needsUpdate = true;

    // Nav2 plan: from the robot to the end of this leg of the trip
    const pts = [new THREE.Vector3(x, 0, z)];
    if (S.kind !== 'size') {
      for (let k = stepIdx; k < steps.length && pts.length < 16; k++) {
        const q2 = steps[k];
        if (q2.kind === 'size') break;
        if (q2.kind === 'drive') { if (k > stepIdx && q2.mode === 'row' && S.mode !== 'row') break; pts.push(new THREE.Vector3(q2.x1, 0, q2.z1)); if (q2.mode === 'row') break; }
      }
    }
    plan.set(pts);
    trail.material.dashOffset = -t * 0.5;
    anchors.robot.set(x, 0.3 + lift, z);
  }

  const hud = () => [
    ['node', '/cropsentry/mission'],
    ['phase', st.phase],
    ['gap under body', `${(0.22 + 0.18 * st.s).toFixed(2)} × ${(0.17 + 0.09 * st.s).toFixed(2)} m`],
    ['weeds sprayed', `${st.weeds}`],
    ['disease logged', `${st.sick}`],
    ['odometry', 'encoders + BNO055 (EKF)'],
  ];
  return { group, update, anchors, hud };
}
