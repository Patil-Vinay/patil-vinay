// Hospital ward: SCOBO (real URDF meshes) does a round, scans each patient and hands out pills.
import * as THREE from 'three';
import { mat, box, cyl, floor, gridTexture, rosModel, tag, liveLine, rayBoxes, damp, clamp, wrap, yawOf, TAU, shadows } from '../kit.js';

const BEDS_X = [-4, 0, 4];

function bed(skin, blanket) {
  const g = new THREE.Group();
  const metal = mat('#e6e9ee', { metalness: 0.5, roughness: 0.35 });
  g.add(box(0.9, 0.08, 2.0, metal, 0, 0.42, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, 0.42, 0.05, metal, sx * 0.42, 0.21, sz * 0.95));
  g.add(box(0.9, 0.55, 0.05, metal, 0, 0.7, -1.0));
  g.add(box(0.9, 0.3, 0.05, metal, 0, 0.55, 1.0));
  g.add(box(0.84, 0.14, 1.94, mat('#cfe3f2', { roughness: 0.9 }), 0, 0.53, 0));
  g.add(box(0.5, 0.08, 0.32, mat('#ffffff', { roughness: 0.95 }), 0, 0.64, -0.75));
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.95, 6, 12), blanket);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.25, 1, 0.55);
  body.position.set(0, 0.66, 0.15);
  g.add(body);
  g.add(box(0.86, 0.04, 1.3, blanket, 0, 0.61, 0.3));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  head.position.set(0, 0.76, -0.72);
  g.add(head);
  shadows(g);
  return g;
}

export function build({ models }) {
  const group = new THREE.Group();
  const tiles = gridTexture({ bg: '#8f9bab', line: 'rgba(20,30,50,0.18)', major: 'rgba(40,60,90,0.22)', cells: 2, noise: 0.05, seed: 7 });
  const fl = floor(13, 9, tiles, 1.2);
  fl.position.y = 0.003;
  group.add(fl);

  const wall = mat('#b9c2ce', { roughness: 0.9 });
  const trim = mat('#5b8bd9', { roughness: 0.6 });
  group.add(box(12.4, 1.4, 0.2, wall, 0, 0.7, -4.2));
  group.add(box(12.4, 0.08, 0.22, trim, 0, 0.9, -4.2));
  group.add(box(0.2, 1.0, 8.6, wall, -6.2, 0.5, 0));
  group.add(box(0.2, 1.0, 8.6, wall, 6.2, 0.5, 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(12.4, 1.0, 0.04),
    new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.12, roughness: 0.05 }));
  glass.position.set(0, 0.5, 4.2);
  group.add(glass);
  // soft window light along the back wall
  for (const x of [-4, 0, 4]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.35), new THREE.MeshBasicMaterial({ color: '#bfe6ff' }));
    w.position.set(x + 2, 1.15, -4.09);
    group.add(w);
  }

  const skins = ['#c68d6a', '#8d5a3b', '#e0ac85', '#a86f4c', '#d49c76', '#7a4a2e'].map(c => mat(c, { roughness: 0.8 }));
  const blankets = ['#3aa39a', '#5b7fd1', '#3aa39a', '#7a68c9', '#3aa39a', '#5b7fd1'].map(c => mat(c, { roughness: 0.95 }));
  const boxes = [
    { x0: -6.3, x1: 6.3, z0: -4.35, z1: -4.1 }, { x0: -6.3, x1: -6.1, z0: -4.3, z1: 4.3 },
    { x0: 6.1, x1: 6.3, z0: -4.3, z1: 4.3 }, { x0: -6.3, x1: 6.3, z0: 4.18, z1: 4.22 },
  ];
  const heads = [];
  const locker = mat('#b9a37d', { roughness: 0.7 });
  BEDS_X.forEach((x, i) => {
    const n = bed(skins[i], blankets[i]);
    n.position.set(x, 0, -3.0);
    group.add(n);
    heads.push(new THREE.Vector3(x, 0.78, -3.72));
    const s = bed(skins[i + 3], blankets[i + 3]);
    s.position.set(x, 0, 3.0);
    s.rotation.y = Math.PI;
    group.add(s);
    heads.push(new THREE.Vector3(x, 0.78, 3.72));
    boxes.push({ x0: x - 0.45, x1: x + 0.45, z0: -4, z1: -2 }, { x0: x - 0.45, x1: x + 0.45, z0: 2, z1: 4 });
    group.add(box(0.45, 0.75, 0.45, locker, x - 0.85, 0.375, -3.75));
    group.add(box(0.45, 0.75, 0.45, locker, x - 0.85, 0.375, 3.75));
    boxes.push({ x0: x - 1.08, x1: x - 0.62, z0: -3.98, z1: -3.52 }, { x0: x - 1.08, x1: x - 0.62, z0: 3.52, z1: 3.98 });
  });
  // trolley in the aisle so the lidar has something to see
  const trolley = new THREE.Group();
  trolley.add(box(0.5, 0.04, 0.8, mat('#dde3ea', { metalness: 0.5 }), 0, 0.8, 0));
  trolley.add(box(0.5, 0.04, 0.8, mat('#dde3ea', { metalness: 0.5 }), 0, 0.35, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) trolley.add(box(0.03, 0.8, 0.03, mat('#9aa5b1'), sx * 0.22, 0.4, sz * 0.37));
  trolley.position.set(2, 0, 1.7);
  group.add(shadows(trolley));
  boxes.push({ x0: 1.75, x1: 2.25, z0: 1.3, z1: 2.1 });

  // robot
  const robot = rosModel(models.scobo.scene);
  group.add(robot.group);
  const wheels = ['wheel_fl', 'wheel_rl', 'wheel_fr', 'wheel_rr'].map(robot.node);
  const pan = robot.node('pan'), tilt = robot.node('tilt');
  const R = 0.0482, TRACK = 0.2838;

  // lidar points and fan
  const N = 240, MAX = 6;
  const hitPos = new Float32Array(N * 3), fanPos = new Float32Array(N * 6);
  const hitGeo = new THREE.BufferGeometry();
  hitGeo.setAttribute('position', new THREE.BufferAttribute(hitPos, 3));
  const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: '#ff3b5c', size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }));
  hits.frustumCulled = false;
  group.add(hits);
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  const fan = new THREE.LineSegments(fanGeo, new THREE.LineBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.08, depthWrite: false }));
  fan.frustumCulled = false;
  group.add(fan);

  const plan = liveLine(64, '#3dff9e', 0.9);
  group.add(plan);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const goalRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 40), ringMat);
  goalRing.rotation.x = -Math.PI / 2;
  goalRing.position.y = 0.012;
  group.add(goalRing);

  const coneGeo = new THREE.ConeGeometry(0.22, 1, 32, 1, true);
  coneGeo.translate(0, -0.5, 0);
  coneGeo.rotateX(Math.PI);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  group.add(cone);
  const status = tag('bed 1', { edge: '#3dff9e' });
  group.add(status);

  // round: N1, N2, S2, N3, home
  const route = [];
  const visit = (i, south) => {
    const x = BEDS_X[i] + 0.95;
    route.push({ x, z: 0 }, { x, z: south ? 2.95 : -2.95, face: Math.PI, wait: 7, head: heads[i * 2 + (south ? 1 : 0)], bed: south ? i + 4 : i + 1 }, { x, z: 0 });
  };
  route.push({ x: -5.2, z: 0, face: 0, wait: 2.5 });
  visit(0); visit(1); visit(1, true); visit(2);

  const st = { x: -5.2, z: 0, yaw: 0, i: 1, mode: 'turn', wait: 0, scanT: 0, beds: 0, v: 0, w: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const anchors = { robot: new THREE.Vector3(), centre: new THREE.Vector3(0, 0.6, 0) };
  let lidarTick = 0;

  function step(dt) {
    const g = route[st.i];
    const dx = g.x - st.x, dz = g.z - st.z, dist = Math.hypot(dx, dz);
    st.v = 0; st.w = 0;
    if (st.mode === 'turn') {
      const want = dist > 0.02 ? yawOf(dx, dz) : st.yaw;
      const e = wrap(want - st.yaw);
      st.w = clamp(e * 3, -1.3, 1.3);
      if (Math.abs(e) < 0.01) st.mode = dist > 0.02 ? 'drive' : 'arrive';
    } else if (st.mode === 'drive') {
      const e = wrap(yawOf(dx, dz) - st.yaw);
      st.v = Math.min(0.5, dist * 1.4 + 0.05);
      st.w = e * 2;
      if (dist < 0.03) st.mode = 'arrive';
    } else if (st.mode === 'arrive') {
      if (g.face !== undefined) {
        const e = wrap(g.face - st.yaw);
        st.w = clamp(e * 3, -1.3, 1.3);
        if (Math.abs(e) < 0.01) { st.mode = 'wait'; st.wait = g.wait || 0; st.scanT = 0; }
      } else { st.mode = 'next'; }
    } else if (st.mode === 'wait') {
      st.wait -= dt; st.scanT += dt;
      if (st.wait <= 0) { if (g.bed) st.beds++; st.mode = 'next'; }
    }
    if (st.mode === 'next') { st.i = (st.i + 1) % route.length; if (st.i === 1) st.beds = 0; st.mode = 'turn'; }
    st.yaw += st.w * dt;
    st.x += Math.cos(st.yaw) * st.v * dt;
    st.z -= Math.sin(st.yaw) * st.v * dt;
    const left = (st.v - st.w * TRACK / 2) * dt / R, right = (st.v + st.w * TRACK / 2) * dt / R;
    wheels[0].rotation.y += left; wheels[1].rotation.y += left;
    wheels[2].rotation.y += right; wheels[3].rotation.y += right;
  }

  function update(dt, t) {
    step(Math.min(dt, 0.05));
    robot.group.position.set(st.x, 0, st.z);
    robot.group.rotation.y = st.yaw;
    const g = route[st.i];
    const scanning = st.mode === 'wait' && g.head;

    // display turns to the patient while scanning
    let wantPan = 0, wantTilt = 0;
    if (scanning) {
      const rel = wrap(yawOf(g.head.x - st.x, g.head.z - st.z) - st.yaw);
      wantPan = clamp(rel, -1.4, 1.4); wantTilt = -0.12;
    }
    pan.rotation.z = damp(pan.rotation.z, wantPan, 3, dt);
    tilt.rotation.y = damp(tilt.rotation.y, wantTilt, 3, dt);

    // lidar at about 15 Hz
    lidarTick += dt;
    if (lidarTick > 1 / 15) {
      lidarTick = 0;
      const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
      const ox = st.x + c * 0.3028, oz = st.z - s * 0.3028, oy = 0.641;
      for (let k = 0; k < N; k++) {
        const a = st.yaw + (k / N) * TAU + t * 0.7;
        const dx = Math.cos(a), dz = -Math.sin(a);
        const d = rayBoxes(ox, oz, dx, dz, boxes, MAX);
        const hx = ox + dx * d, hz = oz + dz * d, ok = d < MAX;
        hitPos[k * 3] = hx; hitPos[k * 3 + 1] = ok ? oy : -10; hitPos[k * 3 + 2] = hz;
        fanPos[k * 6] = ox; fanPos[k * 6 + 1] = oy; fanPos[k * 6 + 2] = oz;
        fanPos[k * 6 + 3] = hx; fanPos[k * 6 + 4] = oy; fanPos[k * 6 + 5] = hz;
      }
      hitGeo.attributes.position.needsUpdate = true;
      fanGeo.attributes.position.needsUpdate = true;
    }

    // planned path through the next waypoints
    const pts = [new THREE.Vector3(st.x, 0.02, st.z)];
    for (let k = 0; k < 4; k++) {
      const w = route[(st.i + k) % route.length];
      pts.push(new THREE.Vector3(w.x, 0.02, w.z));
      if (w.wait) break;
    }
    plan.set(pts);
    const last = pts[pts.length - 1];
    goalRing.position.x = last.x; goalRing.position.z = last.z;
    ringMat.opacity = 0.35 + 0.25 * Math.sin(t * 5);

    // thermal cone and the bedside status
    cone.visible = !!scanning && st.scanT < 3;
    status.visible = !!scanning;
    if (scanning) {
      tmp.set(-0.1778, 1.0775, -0.002).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw).add(robot.group.position);
      tmp2.copy(g.head).sub(tmp);
      const len = tmp2.length();
      cone.position.copy(tmp);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp2.normalize());
      cone.scale.set(len * 0.9, len, len * 0.9);
      cone.material.opacity = 0.18 + 0.12 * Math.sin(st.scanT * 12);
      const T = st.scanT;
      const txt = T < 2.5 ? `bed ${g.bed}  thermal scan...` : T < 4.8 ? `bed ${g.bed}  temp ok  pulse + SpO2...` : `bed ${g.bed}  temp ok  SpO2 ok  pills given`;
      status.setText(txt);
      status.position.set(g.head.x, 1.45, g.head.z);
    }
    anchors.robot.set(st.x, 0.6, st.z);
  }

  const hud = () => [
    ['node', '/scobo/ward_round'],
    ['nav2', st.mode === 'wait' ? 'at goal' : st.mode === 'drive' ? 'following path' : 'rotating'],
    ['pose', `x ${st.x.toFixed(2)}  y ${(-st.z).toFixed(2)}  th ${(st.yaw * 57.3).toFixed(0)}`],
    ['cmd_vel', `v ${st.v.toFixed(2)}  w ${st.w.toFixed(2)}`],
    ['beds done', `${st.beds} / 4`],
  ];
  return { group, update, anchors, hud };
}
