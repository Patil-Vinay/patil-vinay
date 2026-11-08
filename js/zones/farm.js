// Tomato field: AgriDoc (real URDF meshes) patrols the rows, sprays weeds and logs leaf disease.
import * as THREE from 'three';
import { mat, floor, gridTexture, rosModel, tag, bracket, rng, damp, clamp, yawOf, TAU } from '../kit.js';

const ROWS = [-2, -1, 0, 1, 2];
const X0 = -6, X1 = 6, GAP = 0.45;

export function build({ models, mobile }) {
  const group = new THREE.Group();
  const r = rng(11);
  const soil = floor(20, 9, gridTexture({ bg: '#5a4330', line: 'rgba(0,0,0,0.0)', major: 'rgba(0,0,0,0.0)', cells: 1, noise: 0.25, seed: 5 }), 1.5);
  soil.position.y = 0.003;
  group.add(soil);
  // raised beds under the plant rows
  const bedMat = mat('#4a3626', { roughness: 1 });
  for (const z of ROWS) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 0.8, 0.08, 0.42), bedMat);
    b.position.set(0, 0.04, z);
    b.receiveShadow = true;
    group.add(b);
  }

  // plants as instanced meshes
  const plants = [];
  for (const z of ROWS) for (let x = X0; x <= X1 + 1e-6; x += GAP) plants.push({ x: x + (r() - 0.5) * 0.06, z: z + (r() - 0.5) * 0.05, h: 0.32 + r() * 0.18, sick: r() < 0.09, seen: false });
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.018, 1, 5);
  stemGeo.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(stemGeo, mat('#4c7a2c'), plants.length);
  const leafGeo = new THREE.IcosahedronGeometry(0.075, 1);
  const leaves = new THREE.InstancedMesh(leafGeo, mat('#ffffff', { roughness: 0.85, flatShading: true }), plants.length * 4);
  const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 10, 8), mat('#e2372b', { roughness: 0.35 }), plants.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const green = new THREE.Color(), healthy = ['#3f8f3a', '#4ea345', '#367d33'];
  plants.forEach((pl, i) => {
    m4.compose(p.set(pl.x, 0.06, pl.z), q.identity(), s.set(1, pl.h, 1));
    stems.setMatrixAt(i, m4);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + r();
      e.set(r(), r() * TAU, r());
      m4.compose(p.set(pl.x + Math.cos(a) * 0.06, 0.06 + pl.h * (0.45 + k * 0.17), pl.z + Math.sin(a) * 0.06), q.setFromEuler(e), s.set(1.1, 0.6, 1.1).multiplyScalar(0.8 + r() * 0.5));
      leaves.setMatrixAt(i * 4 + k, m4);
      green.set(pl.sick && k % 2 ? (k === 1 ? '#b5a23a' : '#8a6d2c') : healthy[(i + k) % 3]);
      leaves.setColorAt(i * 4 + k, green);
    }
    for (let k = 0; k < 3; k++) {
      const a = r() * TAU;
      const sc = r() < 0.25 ? 0 : 1;
      m4.compose(p.set(pl.x + Math.cos(a) * 0.08, 0.06 + pl.h * (0.3 + r() * 0.35), pl.z + Math.sin(a) * 0.08), q.identity(), s.setScalar(sc * (0.8 + r() * 0.5)));
      fruit.setMatrixAt(i * 3 + k, m4);
    }
  });
  for (const im of [stems, leaves, fruit]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // weeds sit near the rows on the aisle side
  const weeds = [];
  for (let k = 0; k < 30; k++) {
    const row = ROWS[Math.floor(r() * ROWS.length)];
    const side = row === 2 ? -1 : row === -2 ? 1 : (r() < 0.5 ? -1 : 1);
    weeds.push({ x: X0 + 0.5 + r() * (X1 - X0 - 1), z: row + side * (0.26 + r() * 0.06), life: 1, hit: 0 });
  }
  const weedGeo = new THREE.ConeGeometry(0.07, 0.12, 5);
  weedGeo.translate(0, 0.06, 0);
  const weedMesh = new THREE.InstancedMesh(weedGeo, mat('#7fbf2a', { flatShading: true }), weeds.length);
  weedMesh.castShadow = true;
  group.add(weedMesh);

  // the patrol path: down one aisle, back up the next, then the headland back to the start
  const path = new THREE.Path();
  const A = [-1.5, -0.5, 0.5, 1.5], E = 6.6, W = -6.6;
  path.moveTo(W, A[0]);
  path.lineTo(E, A[0]); path.absarc(E, -1, 0.5, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(W, A[1]); path.absarc(W, 0, 0.5, -Math.PI / 2, -3 * Math.PI / 2, true);
  path.lineTo(E, A[2]); path.absarc(E, 1, 0.5, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(W, A[3]); path.absarc(W, 0, 1.5, Math.PI / 2, 3 * Math.PI / 2, false);
  const pts = path.getSpacedPoints(1600);
  const total = path.getLength();
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(v => new THREE.Vector3(v.x, 0.015, v.y))),
    new THREE.LineDashedMaterial({ color: '#3dff9e', dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.5 }));
  trail.computeLineDistances();
  group.add(trail);
  const at = u => { const f = ((u % 1) + 1) % 1 * (pts.length - 1), i = Math.floor(f), k = f - i, a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)]; return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]; };

  const robot = rosModel(models.agridoc.scene);
  group.add(robot.group);
  const wheels = ['wheel_rl', 'wheel_rr', 'wheel_fl', 'wheel_fr'].map(robot.node);

  // camera footprints like the RViz camera display
  const frust = (color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
    l.frustumCulled = false;
    group.add(l);
    return l;
  };
  const weedCam = frust('#ff3b5c'), leafCam = frust('#ffd23d');
  const setFrust = (l, o, corners) => {
    const a = l.geometry.attributes.position.array;
    let n = 0;
    const put = v => { a[n++] = v.x; a[n++] = v.y; a[n++] = v.z; };
    for (let k = 0; k < 4; k++) { put(o); put(corners[k]); }
    for (let k = 0; k < 4; k++) { put(corners[k]); put(corners[(k + 1) % 4]); }
    l.geometry.attributes.position.needsUpdate = true;
  };

  const weedBox = bracket('#ff3b5c', 0.06), leafBox = bracket('#ffd23d', 0.075);
  const weedTag = tag('weed 0.91', { edge: '#ff3b5c' }), leafTag = tag('leaf mold 0.88', { edge: '#ffd23d' });
  for (const o of [weedBox, leafBox, weedTag, leafTag]) { o.visible = false; group.add(o); }
  const pinGeo = new THREE.ConeGeometry(0.04, 0.12, 8);
  pinGeo.rotateX(Math.PI);
  const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshBasicMaterial({ color: '#ffd23d' }), plants.length);
  pins.count = 0;
  group.add(pins);

  // spray drops
  const NS = mobile ? 60 : 160;
  const spray = Array.from({ length: NS }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, l: 0 }));
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const sprayPts = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: '#9fe8ff', size: 0.025, transparent: true, opacity: 0.85, depthWrite: false }));
  sprayPts.frustumCulled = false;
  group.add(sprayPts);
  let sprayN = 0;

  const st = { u: 0, yaw: 0, weeds: 0, sick: 0, lap: 0, spraying: 0, lastWeed: null, lastLeaf: null, weedT: 0, leafT: 0 };
  const speed = 0.42;
  const anchors = { robot: new THREE.Vector3(), centre: new THREE.Vector3(0, 0.3, 0) };
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const local = (x, y, z, out = new THREE.Vector3()) => out.copy(robot.group.position).addScaledVector(fwd, x).addScaledVector(up, y).addScaledVector(side, z);

  function resetLap() {
    weeds.forEach(w => { w.life = 1; w.hit = 0; });
    plants.forEach(p => { p.seen = false; });
    pins.count = 0;
    st.weeds = 0; st.sick = 0;
  }

  function update(dt, t) {
    const du = speed * dt / total;
    const prev = st.u;
    st.u += du;
    if (Math.floor(st.u) !== Math.floor(prev)) { st.lap++; resetLap(); }
    const [x, z] = at(st.u), [x2, z2] = at(st.u + 0.002);
    const want = yawOf(x2 - x, z2 - z);
    st.yaw = Math.abs(want - st.yaw) > Math.PI ? want : damp(st.yaw, want, 10, dt);
    robot.group.position.set(x, 0, z);
    robot.group.rotation.y = st.yaw;
    for (const w of wheels) w.rotation.y += speed * dt / 0.05;
    fwd.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
    side.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));

    // weed camera looks at the ground ahead of the robot
    const wc = local(0.47, 0.17, 0), wg = local(0.78, 0, 0);
    setFrust(weedCam, wc, [local(0.62, 0.01, -0.2), local(0.62, 0.01, 0.2), local(0.98, 0.01, 0.28), local(0.98, 0.01, -0.28)]);
    const lc = local(0.44, 0.3, 0);
    setFrust(leafCam, lc, [local(1.3, 0.05, -0.75), local(1.3, 0.05, 0.75), local(1.3, 0.8, 0.75), local(1.3, 0.8, -0.75)]);

    st.weedT -= dt; st.leafT -= dt;
    for (const w of weeds) {
      if (w.life < 1 || w.hit) continue;
      if (Math.hypot(w.x - wg.x, w.z - wg.z) < 0.32) { w.hit = 1; st.lastWeed = w; st.weedT = 1.2; st.spraying = 0.9; st.weeds++; }
    }
    for (const w of weeds) if (w.hit && w.life > 0) w.life = Math.max(0, w.life - dt * 0.6);
    weeds.forEach((w, i) => {
      const sc = w.hit ? Math.max(0.001, w.life) : 1;
      m4.compose(p.set(w.x, 0, w.z), q.identity(), s.set(sc, w.hit ? sc * 0.6 : 1, sc));
      weedMesh.setMatrixAt(i, m4);
    });
    weedMesh.instanceMatrix.needsUpdate = true;

    for (const pl of plants) {
      if (!pl.sick || pl.seen) continue;
      const dx = pl.x - robot.group.position.x, dz = pl.z - robot.group.position.z;
      const ahead = dx * fwd.x + dz * fwd.z, lat = Math.abs(dx * side.x + dz * side.z);
      if (ahead > 0.6 && ahead < 1.2 && lat < 0.75) {
        pl.seen = true; st.lastLeaf = pl; st.leafT = 1.6; st.sick++;
        m4.compose(p.set(pl.x, 0.06 + pl.h + 0.45, pl.z), q.identity(), s.setScalar(1));
        pins.setMatrixAt(pins.count++, m4);
        pins.instanceMatrix.needsUpdate = true;
      }
    }
    weedBox.visible = weedTag.visible = st.weedT > 0;
    if (st.lastWeed) { weedBox.position.set(st.lastWeed.x, 0.08, st.lastWeed.z); weedTag.position.set(st.lastWeed.x, 0.25, st.lastWeed.z); }
    leafBox.visible = leafTag.visible = st.leafT > 0;
    if (st.lastLeaf) { leafBox.position.set(st.lastLeaf.x, 0.06 + st.lastLeaf.h * 0.7, st.lastLeaf.z); leafTag.position.set(st.lastLeaf.x, 0.06 + st.lastLeaf.h + 0.2, st.lastLeaf.z); }

    // spray from the nozzle under the front pipe
    st.spraying -= dt;
    const noz = local(0.49, 0.06, 0);
    if (st.spraying > 0) for (let k = 0; k < 6; k++) {
      const d = spray[sprayN++ % NS];
      d.x = noz.x; d.y = noz.y; d.z = noz.z;
      d.vx = fwd.x * 0.5 + (Math.random() - 0.5) * 0.4; d.vz = fwd.z * 0.5 + (Math.random() - 0.5) * 0.4; d.vy = -0.2 - Math.random() * 0.3; d.l = 0.6;
    }
    const sa = sprayGeo.attributes.position.array;
    spray.forEach((d, k) => {
      if (d.l > 0) { d.l -= dt; d.vy -= 9.8 * dt * 0.3; d.x += d.vx * dt; d.y = Math.max(0.005, d.y + d.vy * dt); d.z += d.vz * dt; }
      sa[k * 3] = d.x; sa[k * 3 + 1] = d.l > 0 ? d.y : -9; sa[k * 3 + 2] = d.z;
    });
    sprayGeo.attributes.position.needsUpdate = true;
    trail.material.dashOffset = -t * 0.6;
    anchors.robot.set(x, 0.3, z);
  }

  const hud = () => [
    ['node', '/agridoc/patrol'],
    ['lap', `${st.lap + 1}   ${(((st.u % 1) * 100) | 0)}% of route`],
    ['weeds sprayed', `${st.weeds}`],
    ['leaf disease logged', `${st.sick}`],
    ['detector', 'YOLOv5 + leaf CNN on Jetson'],
  ];
  return { group, update, anchors, hud };
}
