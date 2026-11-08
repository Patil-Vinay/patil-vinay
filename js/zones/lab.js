// Test range: a pan-tilt head tracks a drone while a quadruped walks its patrol loop.
import * as THREE from 'three';
import { mat, box, cyl, quadcopter, tag, bracket, floor, gridTexture, damp, clamp, wrap, yawOf, TAU, shadows } from '../kit.js';

function quadruped() {
  const g = new THREE.Group();
  const shell = mat('#d7dbe0', { roughness: 0.45, metalness: 0.2 });
  const dark = mat('#252a33', { roughness: 0.6 });
  const accent = mat('#ffb547', { roughness: 0.5 });
  const body = new THREE.Group();
  g.add(body);
  body.add(box(0.62, 0.14, 0.24, shell, 0, 0, 0));
  body.add(box(0.5, 0.05, 0.2, dark, 0, 0.09, 0));
  body.add(box(0.08, 0.1, 0.2, dark, 0.33, 0, 0));
  body.add(box(0.02, 0.03, 0.14, mat('#4fd1ff', { emissive: '#4fd1ff', emissiveIntensity: 2 }), 0.372, 0.01, 0));
  body.add(box(0.2, 0.015, 0.25, accent, -0.12, 0.075, 0));
  const lidar = cyl(0.05, 0.05, 0.06, dark, 18);
  lidar.position.set(0.12, 0.14, 0);
  body.add(lidar);
  const legs = [];
  const L1 = 0.21, L2 = 0.21;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.24, -0.03, sz * 0.15);
    body.add(hip);
    const thigh = new THREE.Group();
    hip.add(thigh);
    thigh.add(box(0.06, L1, 0.06, dark, 0, -L1 / 2, 0));
    const knee = new THREE.Group();
    knee.position.y = -L1;
    thigh.add(knee);
    knee.add(box(0.04, L2, 0.04, shell, 0, -L2 / 2, 0));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), dark);
    foot.position.y = -L2;
    foot.castShadow = true;
    knee.add(foot);
    legs.push({ thigh, knee, phase: sx * sz > 0 ? 0 : 0.5 });
  }
  const stand = 0.36;
  g.userData.step = (t, speed) => {
    const T = 0.56, S = speed * T * 0.5, lift = 0.07;
    body.position.y = stand + 0.012 * Math.sin(t * TAU * 2 / T);
    lidar.rotation.y = t * 9;
    for (const leg of legs) {
      const p = ((t / T + leg.phase) % 1 + 1) % 1;
      let fx, fy = -stand + 0.03;
      if (p < 0.5) fx = S / 2 - S * (p / 0.5);
      else { const q = (p - 0.5) / 0.5; fx = -S / 2 + S * q; fy += lift * Math.sin(Math.PI * q); }
      fy -= 0.012 * Math.sin(t * TAU * 2 / T);
      const d = Math.min(Math.hypot(fx, fy), L1 + L2 - 1e-3);
      const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
      const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      leg.thigh.rotation.z = Math.atan2(fx, -fy) - a;
      leg.knee.rotation.z = knee;
    }
  };
  shadows(g);
  return g;
}

function panTilt() {
  const g = new THREE.Group();
  const grey = mat('#3a414c', { roughness: 0.5, metalness: 0.4 });
  const sand = mat('#c9c2ad', { roughness: 0.55, metalness: 0.15 });
  const black = mat('#101318', { roughness: 0.3, metalness: 0.5 });
  const mast = cyl(0.07, 0.09, 2.2, grey, 16);
  mast.position.y = 1.1;
  g.add(mast);
  const foot = cyl(0.45, 0.5, 0.08, grey, 6);
  foot.position.y = 0.04;
  g.add(foot);
  const head = cyl(0.17, 0.19, 0.12, black, 24);
  head.position.y = 2.26;
  g.add(head);
  const yaw = new THREE.Group();
  yaw.position.y = 2.32;
  g.add(yaw);
  yaw.add(box(0.2, 0.05, 0.62, sand, 0, 0.025, 0));
  yaw.add(box(0.16, 0.42, 0.05, sand, 0, 0.23, 0.29));
  yaw.add(box(0.16, 0.42, 0.05, sand, 0, 0.23, -0.29));
  const pitch = new THREE.Group();
  pitch.position.y = 0.32;
  yaw.add(pitch);
  pitch.add(box(0.46, 0.26, 0.48, sand, 0.02, 0, 0));
  pitch.add(box(0.3, 0.04, 0.4, black, -0.02, 0.15, 0));
  const lensBig = cyl(0.1, 0.1, 0.14, black, 28);
  lensBig.rotation.z = Math.PI / 2;
  lensBig.position.set(0.31, 0, 0.1);
  pitch.add(lensBig);
  const glassA = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), mat('#2b6cff', { metalness: 0.9, roughness: 0.05, emissive: '#0a1b4a', emissiveIntensity: 1 }));
  glassA.rotation.y = Math.PI / 2;
  glassA.position.set(0.381, 0, 0.1);
  pitch.add(glassA);
  const lensSmall = cyl(0.055, 0.055, 0.1, black, 22);
  lensSmall.rotation.z = Math.PI / 2;
  lensSmall.position.set(0.29, 0, -0.13);
  pitch.add(lensSmall);
  const glassB = new THREE.Mesh(new THREE.CircleGeometry(0.045, 22), mat('#ff8a3d', { metalness: 0.9, roughness: 0.05, emissive: '#3a1400', emissiveIntensity: 1 }));
  glassB.rotation.y = Math.PI / 2;
  glassB.position.set(0.341, 0, -0.13);
  pitch.add(glassB);
  pitch.add(box(0.14, 0.06, 0.08, black, 0.2, 0.16, -0.12));
  shadows(g);
  return { g, yaw, pitch, muzzle: lensBig };
}

export function build() {
  const group = new THREE.Group();
  const pad = floor(26, 26, gridTexture({ bg: '#1d232c', line: 'rgba(120,200,255,0.07)', major: 'rgba(120,200,255,0.18)', cells: 4, noise: 0.05 }), 2);
  pad.position.y = 0.002;
  group.add(pad);
  // painted circle the quadruped follows
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.95, 4.05, 96), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.35 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  group.add(ring);
  const markMat = new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.25 });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), markMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (i / 8) * TAU;
    m.position.set(Math.cos(i / 8 * TAU) * 6, 0.006, Math.sin(i / 8 * TAU) * 6);
    group.add(m);
  }
  // a few crates for the lidar and for scale
  const crate = mat('#4b5563', { roughness: 0.8 });
  [[-6, 3, 0.4], [-6.6, 2.2, 0.3], [5.5, -5, 0.5], [7, 4.8, 0.35]].forEach(([x, z, s]) => {
    const c = box(s * 2, s * 2, s * 2, crate, x, s, z);
    c.rotation.y = x;
    group.add(c);
  });

  const pt = panTilt();
  pt.g.position.set(-1.2, 0, -1);
  group.add(pt.g);

  const drone = quadcopter({ span: 0.42, front: '#ff4d4d', back: '#2a2f38', legs: false });
  group.add(drone);
  const lock = bracket('#ffb547', 0.08);
  group.add(lock);
  const label = tag('UAV  track 01', { edge: '#ffb547' });
  group.add(label);

  const losGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const los = new THREE.Line(losGeo, new THREE.LineDashedMaterial({ color: '#ffb547', dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.8 }));
  los.frustumCulled = false;
  group.add(los);

  const dog = quadruped();
  group.add(dog);

  const s = { yaw: 0, yawV: 0, pitch: 0, pitchV: 0, err: 0 };
  const tmp = new THREE.Vector3(), eye = new THREE.Vector3();
  const anchors = {
    turret: new THREE.Vector3(-1.2, 2.2, -1),
    dog: new THREE.Vector3(),
    drone: new THREE.Vector3(),
    centre: new THREE.Vector3(0, 1, 0),
  };

  function update(dt, t) {
    // drone flies a slow figure of eight around the mast
    const dx = -1.2 + 6.2 * Math.sin(t * 0.23), dz = -1 + 4.2 * Math.sin(t * 0.46), dy = 3.4 + 0.9 * Math.sin(t * 0.37);
    const vx = 6.2 * 0.23 * Math.cos(t * 0.23), vz = 4.2 * 0.46 * Math.cos(t * 0.46);
    drone.position.set(dx, dy, dz);
    drone.rotation.set(vz * 0.08, yawOf(vx, vz), -Math.hypot(vx, vz) * 0.06, 'YXZ');
    drone.userData.spin(dt);
    lock.position.copy(drone.position);
    label.position.set(dx, dy + 0.35, dz);

    // pan-tilt follows with a spring so it lags a little like a real servo loop
    pt.yaw.getWorldPosition(eye);
    group.worldToLocal(eye);
    tmp.copy(drone.position).sub(eye).sub(new THREE.Vector3(0, 0.32, 0));
    const wantYaw = yawOf(tmp.x, tmp.z);
    const wantPitch = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
    const k = 28, c = 2 * Math.sqrt(k) * 0.8;
    const ey = wrap(wantYaw - s.yaw);
    s.yawV += (k * ey - c * s.yawV) * dt; s.yaw += s.yawV * dt;
    s.pitchV += (k * (wantPitch - s.pitch) - c * s.pitchV) * dt; s.pitch += s.pitchV * dt;
    pt.yaw.rotation.y = s.yaw;
    pt.pitch.rotation.z = s.pitch;
    s.err = damp(s.err, Math.abs(ey) * 1000, 4, dt);

    pt.muzzle.getWorldPosition(eye);
    group.worldToLocal(eye);
    const pos = losGeo.attributes.position.array;
    pos[0] = eye.x; pos[1] = eye.y; pos[2] = eye.z;
    pos[3] = dx; pos[4] = dy; pos[5] = dz;
    losGeo.attributes.position.needsUpdate = true;
    los.computeLineDistances();
    los.material.dashOffset = -t * 1.5;

    // quadruped walks the painted ring
    const speed = 0.55, r = 4, a = t * speed / r;
    dog.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dog.rotation.y = yawOf(-Math.sin(a), Math.cos(a));
    dog.userData.step(t, speed);

    anchors.dog.copy(dog.position).setY(0.4);
    anchors.drone.copy(drone.position);
    
  }

  const hud = () => [
    ['node', '/pan_tilt/track'],
    ['pan', `${(s.yaw * 180 / Math.PI).toFixed(1)} deg`],
    ['tilt', `${(s.pitch * 180 / Math.PI).toFixed(1)} deg`],
    ['bus', 'CANopen'],
    ['track err', `${s.err.toFixed(1)} mrad (sim)`],
    ['quadruped', 'trot  0.55 m/s'],
  ];

  return { group, update, anchors, hud };
}
