// Robocon 2022 Lagori: R1 shoots the pile down, R2 builds it back with its suction cups.
import * as THREE from 'three';
import { mat, floor, gridTexture, tag, rng, smooth, clamp, lerp, shadows } from '../kit.js';

const LOOP = 15;
const DISCS = 7;

// put a CAD model on the floor, centred, facing +x
function place(gltf, { rotX = 0, rotY = 0 } = {}) {
  const inner = gltf.scene.clone(true);
  inner.rotation.set(rotX, rotY, 0);
  const wrap = new THREE.Group();
  wrap.add(inner);
  inner.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(inner);
  const c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b.min.y, -c.z);
  shadows(wrap);
  wrap.userData.size = b.getSize(new THREE.Vector3());
  return wrap;
}

export function build({ models }) {
  const group = new THREE.Group();
  const r = rng(31);
  const base = floor(11, 7, gridTexture({ bg: '#6f7a8a', line: 'rgba(10,20,40,0.12)', major: 'rgba(10,20,40,0.2)', cells: 2, noise: 0.03 }), 1);
  base.position.y = 0.003;
  group.add(base);
  const paint = (w, d, color, x, z, o = 0.9) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: o, roughness: 0.8 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.005, z);
    m.receiveShadow = true;
    group.add(m);
  };
  paint(1.6, 7, '#d6453d', -4.7, 0, 0.85);
  paint(1.6, 7, '#2f5fd0', 4.7, 0, 0.85);
  paint(11, 0.06, '#ffffff', 0, -3.3);
  paint(11, 0.06, '#ffffff', 0, 3.3);
  const circle = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 64), new THREE.MeshBasicMaterial({ color: '#f5c542' }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.006;
  group.add(circle);
  // low arena fence
  const fence = mat('#8a6a48', { roughness: 0.8 });
  for (const [w, d, x, z] of [[11.2, 0.1, 0, -3.55], [11.2, 0.1, 0, 3.55], [0.1, 7.2, -5.55, 0], [0.1, 7.2, 5.55, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), fence);
    f.position.set(x, 0.1, z);
    f.castShadow = f.receiveShadow = true;
    group.add(f);
  }

  const r1 = place(models.r1, { rotX: -Math.PI / 2 });
  r1.position.set(3.1, 0, 0.3);
  group.add(r1);
  const r2 = place(models.r2, { rotX: -Math.PI / 2 });
  group.add(r2);
  const r2Home = new THREE.Vector3(-3.3, 0, -1.4), r2Work = new THREE.Vector3(-1.15, 0, -0.1);

  const shades = ['#f2c14e', '#f78154', '#4d9de0', '#e15554', '#3bb273', '#7768ae', '#f2c14e'];
  const discs = [];
  for (let i = 0; i < DISCS; i++) {
    const rad = 0.26 - i * 0.022, h = 0.065;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 36), mat(shades[i], { roughness: 0.45 }));
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    const slot = new THREE.Vector3(0, h / 2 + i * h, 0);
    discs.push({ m, h, slot, p: slot.clone(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rest: slot.clone(), from: new THREE.Vector3() });
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), mat('#ff3b5c', { roughness: 0.4 }));
  ball.castShadow = true;
  group.add(ball);
  const bv = new THREE.Vector3();
  const trail = [];
  const trailGeo = new THREE.BufferGeometry().setFromPoints(new Array(30).fill(0).map(() => new THREE.Vector3()));
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.6 }));
  trailLine.frustumCulled = false;
  group.add(trailLine);

  const label = tag('R1  shooter', { edge: '#ff3b5c' });
  const label2 = tag('R2  picker', { edge: '#4fd1ff' });
  group.add(label, label2);
  const score = tag('lagori 7 / 7', { edge: '#f5c542', size: 0.036 });
  score.position.set(0, 1.25, 0);
  group.add(score);

  const st = { t: 0, phase: '', hit: false, pile: DISCS };
  const muzzle = new THREE.Vector3(2.65, 0.95, 0.3), aim = new THREE.Vector3(0, 0.32, 0);
  const anchors = { centre: new THREE.Vector3(0, 0.5, 0), r1: new THREE.Vector3(3.1, 0.6, 0.3), r2: new THREE.Vector3() };

  function scatter() {
    discs.forEach((d, i) => {
      d.v.set(-1.2 - r() * 1.6, 1 + r() * 2.2 - i * 0.05, (r() - 0.5) * 2.6);
      d.spin.set((r() - 0.5) * 12, (r() - 0.5) * 8, (r() - 0.5) * 12);
    });
    bv.set(1.6, 1.4, 1.2);
  }

  function physics(o, v, rad, dt, spin, mesh) {
    v.y -= 9.8 * dt;
    o.addScaledVector(v, dt);
    if (o.y < rad) {
      o.y = rad;
      if (v.y < 0) v.y *= -0.3;
      v.x *= 0.82; v.z *= 0.82;
      if (spin) spin.multiplyScalar(0.6);
    }
    for (const lim of ['x', 'z']) {
      const L = lim === 'x' ? 5.4 : 3.4;
      if (Math.abs(o[lim]) > L) { o[lim] = Math.sign(o[lim]) * L; v[lim] *= -0.4; }
    }
    if (mesh && spin) {
      mesh.rotation.x += spin.x * dt; mesh.rotation.y += spin.y * dt; mesh.rotation.z += spin.z * dt;
      if (o.y <= rad + 0.002) { mesh.rotation.x *= 0.85; mesh.rotation.z *= 0.85; }
    }
  }

  function update(dt) {
    const prevT = st.t;
    st.t = (st.t + dt) % LOOP;
    const T = st.t;
    if (T < prevT) {
      st.hit = false;
      discs.forEach(d => { d.p.copy(d.slot); d.m.rotation.set(0, 0, 0); });
      trail.length = 0;
    }
    const sdt = Math.min(dt, 1 / 30);

    // R1 lines up then fires at 2.2 s
    r1.rotation.y = Math.PI + 0.05 * Math.sin(Math.min(T, 2) * 3);
    if (T < 2.2) { ball.position.copy(muzzle); ball.visible = T > 0.6; st.phase = 'R1 aiming'; }
    else if (T < 2.75) {
      const u = (T - 2.2) / 0.55;
      ball.position.lerpVectors(muzzle, aim, u);
      ball.position.y += Math.sin(u * Math.PI) * 0.55;
      st.phase = 'R1 shot';
    } else {
      if (!st.hit) { st.hit = true; scatter(); }
      physics(ball.position, bv, 0.09, sdt);
      st.phase = T < 6 ? 'lagori broken' : T < 13 ? 'R2 piling' : 'pile rebuilt';
    }
    trail.push(ball.position.clone());
    if (trail.length > 30) trail.shift();
    const tp = trailGeo.attributes.position.array;
    for (let k = 0; k < 30; k++) { const v = trail[Math.min(k, trail.length - 1)] || ball.position; tp[k * 3] = v.x; tp[k * 3 + 1] = v.y; tp[k * 3 + 2] = v.z; }
    trailGeo.attributes.position.needsUpdate = true;
    trailLine.visible = T > 2.2 && T < 4;

    // R2 drives in, piles the discs largest first, then backs off
    const go = smooth(clamp((T - 5) / 1.8)) * (1 - smooth(clamp((T - 13.2) / 1.6)));
    r2.position.lerpVectors(r2Home, r2Work, go);
    r2.rotation.y = lerp(0.6, 0, go);
    st.pile = 0;
    discs.forEach((d, i) => {
      const t0 = 7 + i * 0.82;
      if (!st.hit) { d.p.copy(d.slot); }
      else if (T < t0) { physics(d.p, d.v, d.h / 2, sdt, d.spin, d.m); d.from.copy(d.p); }
      else if (T < t0 + 0.8) {
        const u = smooth((T - t0) / 0.8);
        const lift = new THREE.Vector3((d.from.x + d.slot.x) / 2 - 0.4, 0.9, (d.from.z + d.slot.z) / 2);
        d.p.set(
          (1 - u) * (1 - u) * d.from.x + 2 * (1 - u) * u * lift.x + u * u * d.slot.x,
          (1 - u) * (1 - u) * d.from.y + 2 * (1 - u) * u * lift.y + u * u * d.slot.y,
          (1 - u) * (1 - u) * d.from.z + 2 * (1 - u) * u * lift.z + u * u * d.slot.z);
        d.m.rotation.x *= 0.8; d.m.rotation.z *= 0.8;
      } else { d.p.copy(d.slot); d.m.rotation.x = d.m.rotation.z = 0; st.pile++; }
      if (!st.hit) st.pile = DISCS;
      d.m.position.copy(d.p);
    });
    if (T > 13) ball.visible = false;

    label.position.set(r1.position.x, 1.35, r1.position.z);
    label2.position.set(r2.position.x, 1.55, r2.position.z);
    score.setText(`lagori ${st.pile} / ${DISCS}`);
    anchors.r2.copy(r2.position).setY(0.6);
  }

  const hud = () => [
    ['match', 'DD Robocon 2022  Lagori'],
    ['phase', st.phase],
    ['R1', 'mecanum base  pitching-machine shooter'],
    ['R2', 'omni base  vacuum suction cups'],
    ['pile', `${st.pile} / ${DISCS}`],
  ];
  return { group, update, anchors, hud };
}
