// Night arena: the Swift drone replays our Task 2C rosbag and finds the LED clusters.
import * as THREE from 'three';
import { mat, glow, box, floor, gridTexture, quadcopter, tag, dotTexture, damp, TAU } from '../kit.js';

const S = 0.34;            // metres per whycon unit, picked to fit the scene
const CX = 1.1, CY = 0.9;  // centre of the logged flight
const GROUND = 37.55;      // whycon z when the drone sits on the floor
const toLocal = (x, y, z, out = new THREE.Vector3()) => out.set((x - CX) * S, Math.max(0, (GROUND - z) * S * 0.95), (y - CY) * S);
const LEDS = { alien_a: 2, alien_b: 3, alien_c: 4 };

export function build({ data, mobile }) {
  const group = new THREE.Group();
  const mat0 = floor(9, 9, gridTexture({ bg: '#0c1220', line: 'rgba(90,140,255,0.16)', major: 'rgba(90,140,255,0.35)', cells: 4 }), 1);
  mat0.position.y = 0.003;
  group.add(mat0);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9, 0.01, 9)), new THREE.LineBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.6 }));
  edge.position.y = 0.01;
  group.add(edge);

  // flight log
  const raw = data.path;
  let end = raw.length - 1;
  for (let i = 0; i < raw.length; i++) if (raw[i][0] > 30 && raw[i][3] > GROUND - 0.3) { end = i; break; }
  const log = raw.slice(0, end + 1);
  const T = log[log.length - 1][0] + 4;
  const pts = log.map(p => toLocal(p[1], p[2], p[3]));
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#7a8cff', transparent: true, opacity: 0.22 }));
  group.add(trail);
  const done = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.9 }));
  done.geometry.setDrawRange(0, 0);
  group.add(done);

  // landing pads: start and research station
  const padTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = '#ffb547'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.stroke();
    x.fillStyle = '#ffb547'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 64, 68);
    return new THREE.CanvasTexture(c);
  })();
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: padTex, transparent: true }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(p.x, 0.012, p.z);
    group.add(pad);
  }

  // LED cluster boards at the logged positions
  const halo = new THREE.SpriteMaterial({ map: dotTexture('rgba(255,170,230,0.9)', 'rgba(255,90,200,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const clusters = data.bio.map(([t, type, x, y]) => {
    const g = new THREE.Group();
    const c = toLocal(x, y, GROUND);
    g.position.set(c.x, 0, c.z);
    g.add(box(0.36, 0.02, 0.36, mat('#0f5132', { roughness: 0.6 }), 0, 0.01, 0));
    const n = LEDS[type] || 3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + 0.4;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), glow('#ffd1f0', 3));
      led.position.set(Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09);
      g.add(led);
      const h = new THREE.Sprite(halo);
      h.scale.setScalar(0.13);
      h.position.copy(led.position);
      g.add(h);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 48), new THREE.MeshBasicMaterial({ color: '#3dff9e', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    const label = tag(`${type}  (${x.toFixed(2)}, ${y.toFixed(2)})`, { edge: '#3dff9e' });
    label.position.y = 0.35;
    label.visible = false;
    g.add(label);
    group.add(g);
    return { t, type, g, ring, label };
  });

  // overhead whycon camera
  const cam = new THREE.Group();
  cam.add(box(0.3, 0.16, 0.2, mat('#2a3140', { metalness: 0.4 }), 0, 0, 0));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), glow('#4fd1ff', 1.5));
  lens.position.y = -0.1;
  cam.add(lens);
  cam.position.set(0, 5.2, 0);
  group.add(cam);
  const track = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#4fd1ff', dashSize: 0.1, gapSize: 0.1, transparent: true, opacity: 0.35 }));
  track.frustumCulled = false;
  group.add(track);

  const drone = quadcopter({ span: 0.42, frame: '#111418', front: '#2a2f38', back: '#2a2f38', body: '#1a1d22', legs: false });
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), glow('#ff3b5c', 5)), navR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), glow('#3dff9e', 5));
  navL.position.set(0.1, 0.02, -0.17); navR.position.set(0.1, 0.02, 0.17);
  drone.add(navL, navR);
  group.add(drone);

  // downward camera view
  const coneGeo = new THREE.ConeGeometry(0.75, 1, 4, 1, true);
  coneGeo.rotateY(Math.PI / 4);
  coneGeo.translate(0, -0.5, 0);
  const view = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  group.add(view);
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dotTexture('rgba(79,209,255,0.5)', 'rgba(79,209,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spot.rotation.x = -Math.PI / 2;
  group.add(spot);

  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), vel = new THREE.Vector3(), lastVel = new THREE.Vector3();
  const st = { t: 0, found: 0, tilt: new THREE.Vector2() };
  const anchors = { drone: new THREE.Vector3(), centre: new THREE.Vector3(0, 1, 0) };
  let k = 0;

  function sample(t) {
    if (t <= log[0][0]) return toLocal(log[0][1], log[0][2], log[0][3], pos);
    while (k > 0 && log[k][0] > t) k--;
    while (k < log.length - 2 && log[k + 1][0] < t) k++;
    const a = log[k], b = log[Math.min(k + 1, log.length - 1)];
    const f = b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0;
    return toLocal(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, pos);
  }

  function update(dt) {
    st.t = (st.t + dt) % T;
    if (st.t < dt) { k = 0; clusters.forEach(c => { c.label.visible = false; c.ring.material.opacity = 0; }); }
    prev.copy(drone.position);
    sample(st.t);
    drone.position.set(damp(drone.position.x, pos.x, 12, dt), damp(drone.position.y, pos.y + 0.06, 12, dt), damp(drone.position.z, pos.z, 12, dt));
    vel.copy(drone.position).sub(prev).divideScalar(Math.max(dt, 1e-3));
    lastVel.lerp(vel, 0.1);
    st.tilt.x = damp(st.tilt.x, -lastVel.x * 0.25, 5, dt);
    st.tilt.y = damp(st.tilt.y, lastVel.z * 0.25, 5, dt);
    drone.rotation.set(st.tilt.y, 0, st.tilt.x);
    const flying = drone.position.y > 0.15;
    drone.userData.spin(dt, flying ? 70 : 6);

    const h = Math.max(0.05, drone.position.y);
    view.position.copy(drone.position);
    view.scale.set(h * 0.55, h, h * 0.55);
    view.visible = spot.visible = flying;
    spot.position.set(drone.position.x, 0.015, drone.position.z);
    spot.scale.setScalar(h * 0.9 + 0.3);

    const n = Math.max(0, log.findIndex(p => p[0] > st.t));
    done.geometry.setDrawRange(0, n || log.length);

    const tp = track.geometry.attributes.position.array;
    tp[0] = 0; tp[1] = 5.1; tp[2] = 0; tp[3] = drone.position.x; tp[4] = drone.position.y; tp[5] = drone.position.z;
    track.geometry.attributes.position.needsUpdate = true;
    track.computeLineDistances();

    st.found = 0;
    for (const c of clusters) {
      const on = st.t >= c.t;
      if (on) st.found++;
      c.label.visible = on;
      c.ring.material.opacity = on ? 0.9 : 0;
      if (on) c.ring.scale.setScalar(1 + 0.08 * Math.sin(st.t * 6));
    }
    anchors.drone.copy(drone.position);
  }

  const hud = () => [
    ['rosbag', 'LD_3811_biota_detector.bag'],
    ['t', `${st.t.toFixed(1)} s`],
    ['/whycon/poses', `x ${(drone.position.x / S + CX).toFixed(2)}  y ${(drone.position.z / S + CY).toFixed(2)}`],
    ['/astrobiolocation', `${st.found} / ${clusters.length} published`],
    ['controller', 'PID  roll / pitch / throttle'],
  ];
  return { group, update, anchors, hud };
}
