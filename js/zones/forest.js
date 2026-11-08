// Forest at dusk: Forest-cop-ter patrols, finds a lost hiker, lands, opens the first aid box and takes a call.
import * as THREE from 'three';
import { mat, box, cyl, floor, gridTexture, quadcopter, tag, rng, smooth, clamp, damp, yawOf, TAU, shadows } from '../kit.js';

const LAND = new THREE.Vector3(1.9, 0, 0.9);
const HIKER = new THREE.Vector3(0.6, 0, 1.2);
const LOOP = 30;

export function build({ mobile }) {
  const group = new THREE.Group();
  const r = rng(23);
  const grass = floor(34, 34, gridTexture({ bg: '#34432b', line: 'rgba(0,0,0,0)', major: 'rgba(0,0,0,0)', cells: 1, noise: 0.22, seed: 9 }), 2);
  grass.position.y = 0.003;
  group.add(grass);
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), mat('#5d6b3a', { roughness: 1 }));
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.set(1.2, 0.006, 1);
  clearing.receiveShadow = true;
  group.add(clearing);

  // trees
  const n = mobile ? 140 : 260;
  const spots = [];
  while (spots.length < n) {
    const a = r() * TAU, d = 3.4 + Math.sqrt(r()) * 13;
    const x = 1.2 + Math.cos(a) * d, z = 1 + Math.sin(a) * d;
    if (Math.abs(x) > 16.5 || Math.abs(z) > 16.5) continue;
    spots.push([x, z, 0.8 + r() * 0.7]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 1, 6).translate(0, 0.5, 0), mat('#4a3424'), n);
  const tiers = [];
  const shades = ['#1f4a2e', '#2a5a35', '#1a3f2a', '#2f6b3c'];
  for (let k = 0; k < 3; k++) tiers.push(new THREE.InstancedMesh(new THREE.ConeGeometry(0.9 - k * 0.22, 1.3, 7).translate(0, 0.65, 0), mat('#ffffff', { flatShading: true, roughness: 0.9 }), n));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  spots.forEach(([x, z, sc], i) => {
    m4.compose(p.set(x, 0, z), q.identity(), s.set(sc, sc * 1.2, sc));
    trunks.setMatrixAt(i, m4);
    tiers.forEach((t, k) => {
      m4.compose(p.set(x, sc * (0.9 + k * 0.75), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU), s.setScalar(sc));
      t.setMatrixAt(i, m4);
      t.setColorAt(i, col.set(shades[(i + k) % 4]));
    });
  });
  for (const im of [trunks, ...tiers]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // hiker waving
  const hiker = new THREE.Group();
  const jacket = mat('#ff7a1a', { roughness: 0.7 });
  const legsM = mat('#2b3442');
  hiker.add(box(0.12, 0.42, 0.1, legsM, -0.06, 0.21, 0), box(0.12, 0.42, 0.1, legsM, 0.06, 0.21, 0));
  hiker.add(box(0.34, 0.45, 0.2, jacket, 0, 0.66, 0));
  hiker.add(box(0.26, 0.34, 0.12, mat('#3c5a8a'), 0, 0.68, -0.15));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), mat('#c68d6a'));
  head.position.y = 0.99;
  hiker.add(head);
  hiker.add(box(0.09, 0.4, 0.09, jacket, -0.22, 0.66, 0));
  const arm = new THREE.Group();
  arm.position.set(0.21, 0.86, 0);
  arm.add(box(0.09, 0.4, 0.09, jacket, 0, 0.18, 0));
  hiker.add(arm);
  hiker.position.copy(HIKER);
  hiker.rotation.y = -0.8;
  group.add(shadows(hiker));

  // F450 with the payload box
  const drone = quadcopter({ span: 0.62, front: '#e8463a', back: '#f2f2f2', frame: '#1b1f26' });
  const kit = new THREE.Group();
  kit.add(box(0.2, 0.13, 0.16, mat('#f4f4f4', { roughness: 0.5 }), 0, 0, 0));
  kit.add(box(0.12, 0.035, 0.005, mat('#e02424'), 0, 0, 0.081), box(0.035, 0.1, 0.005, mat('#e02424'), 0, 0, 0.081));
  const lid = new THREE.Group();
  lid.position.set(-0.1, 0.065, 0);
  lid.add(box(0.2, 0.015, 0.16, mat('#e9e9e9'), 0.1, 0.007, 0));
  kit.add(lid);
  kit.position.y = -0.2;
  drone.add(kit);
  const piCam = box(0.04, 0.03, 0.04, mat('#111'), 0.1, -0.04, 0);
  drone.add(piCam);
  group.add(shadows(drone));

  const scan = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1, 32, 1, true).translate(0, -0.5, 0),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  group.add(scan);
  const status = tag('fire watch', { edge: '#ffb547' });
  group.add(status);
  const gsm = tag('GSM call  connected', { edge: '#3dff9e' });
  gsm.visible = false;
  group.add(gsm);

  const patrol = (t, out) => {
    const a = (t / 11) * TAU * 0.8 + 0.6;
    return out.set(1.2 + Math.cos(a) * 6.5, 4.6 + 0.4 * Math.sin(t * 0.9), 1 + Math.sin(a) * 5.2);
  };
  const bez = (a, b, c, u, out) => out.set(
    (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * b.x + u * u * c.x,
    (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * b.y + u * u * c.y,
    (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * b.z + u * u * c.z);

  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), prev = new THREE.Vector3();
  const above = LAND.clone().setY(3.4);
  const landed = LAND.clone().setY(0.33);
  const st = { t: 0, yaw: 0, phase: 'fire watch', temp: 29.3, rh: 58 };
  const anchors = { drone: new THREE.Vector3(), clearing: new THREE.Vector3(1.2, 0.6, 1) };

  function update(dt, t) {
    st.t = (st.t + dt) % LOOP;
    const T = st.t;
    prev.copy(drone.position);
    let lidOpen = 0;
    if (T < 11) { patrol(T, P); st.phase = 'fire watch'; }
    else if (T < 15) { patrol(11, A); bez(A, above, landed, smooth((T - 11) / 4), P); st.phase = 'reaching the hiker'; }
    else if (T < 23) { P.copy(landed); lidOpen = clamp((T - 15.5) * 2) * (1 - clamp((T - 22) * 2)); st.phase = 'landed  first aid box open'; }
    else { patrol(0, B); bez(landed, above, B, smooth((T - 23) / (LOOP - 23)), P); st.phase = 'back to fire watch'; }
    drone.position.copy(P);
    const v = P.clone().sub(prev);
    if (v.x * v.x + v.z * v.z > 1e-8) {
      const want = yawOf(v.x, v.z);
      st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * (1 - Math.exp(-3 * dt));
    }
    const speed = v.length() / Math.max(dt, 1e-3);
    drone.rotation.set(0, st.yaw, -clamp(speed * 0.08, 0, 0.3), 'YXZ');
    const flying = T < 14.6 || T > 23.4;
    drone.userData.spin(dt, flying ? 80 : 4);
    lid.rotation.z = lidOpen * 1.9;

    scan.visible = T < 11;
    scan.position.copy(P);
    scan.scale.set(1, P.y, 1);
    arm.rotation.z = (T > 9 && T < 16 ? 1 : 0.15) * (2.4 + 0.5 * Math.sin(t * 8));
    status.position.set(P.x, P.y + 0.45, P.z);
    status.setText(st.phase);
    gsm.visible = T > 16 && T < 22.5;
    gsm.position.set(HIKER.x, 1.45, HIKER.z);

    st.temp = 29.3 + 0.3 * Math.sin(t * 0.2);
    st.rh = 58 + 1.2 * Math.sin(t * 0.13);
    anchors.drone.copy(P);
  }

  const hud = () => [
    ['node', 'forest-copter.py'],
    ['state', st.phase],
    ['DHT11', `${st.temp.toFixed(1)} C   RH ${st.rh.toFixed(0)}%`],
    ['fire model', 'ANN  temp + humidity'],
    ['GPS', 'Neo-6M fix'],
  ];
  return { group, update, anchors, hud };
}
