import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

// wrap an angle into -pi..pi
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// small seeded random so the scenes look the same on every load
export function rng(seed = 1) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });
}

export function glow(color, strength = 3) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.4 });
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function cyl(rt, rb, h, material, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function shadows(obj, cast = true, receive = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// ROS models are z up and x forward. Put them in a y up group that still faces +x.
export function rosModel(gltfScene) {
  const inner = gltfScene.clone(true);
  inner.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  g.add(inner);
  shadows(g);
  return { group: g, node: name => inner.getObjectByName(name) };
}

// yaw for a group whose forward is local +x
export const yawOf = (dx, dz) => Math.atan2(-dz, dx);

let monoFont = '500 30px "JetBrains Mono", ui-monospace, monospace';

// text tag that keeps the same size on screen
export function tag(text, { color = '#e8f3ff', bg = 'rgba(8,12,20,0.78)', edge = '#4fd1ff', size = 0.032 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  sprite.renderOrder = 10;
  sprite.center.set(0.5, 0);
  let last = null;
  sprite.setText = (t, e = edge) => {
    if (t === last) return;
    last = t;
    ctx.font = monoFont;
    const w = Math.ceil(ctx.measureText(t).width) + 36;
    // GPU texture storage is fixed size, so a new width needs a fresh upload
    if (c.width !== w) tex.dispose();
    c.width = w; c.height = 52;
    ctx.font = monoFont;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(2, 2, w - 4, 48, 8); ctx.fill();
    ctx.strokeStyle = e; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = e; ctx.fillRect(2, 14, 4, 24);
    ctx.fillStyle = color; ctx.textBaseline = 'middle';
    ctx.fillText(t, 18, 27);
    tex.needsUpdate = true;
    sprite.scale.set(size * w / 52, size, 1);
  };
  sprite.setText(text);
  return sprite;
}

// corner brackets around a tracked target
export function bracket(color = '#ffb547', size = 0.07) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = color; ctx.lineWidth = 6;
  const a = 8, b = 120, l = 30;
  for (const [x, y, dx, dy] of [[a, a, 1, 1], [b, a, -1, 1], [a, b, 1, -1], [b, b, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y); ctx.stroke();
  }
  ctx.fillStyle = color; ctx.fillRect(60, 60, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  s.scale.set(size, size, 1);
  s.renderOrder = 9;
  return s;
}

// soft round dot, used for glows and light spots
export function dotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// tiled floor texture drawn on a canvas
export function gridTexture({ bg = '#20262f', line = 'rgba(255,255,255,0.08)', major = 'rgba(255,255,255,0.16)', cells = 4, px = 256, noise = 0, seed = 3 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
  if (noise) {
    const r = rng(seed);
    for (let i = 0; i < px * px * 0.08; i++) {
      const v = r();
      ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${noise * r()})` : `rgba(0,0,0,${noise * 1.6 * r()})`;
      ctx.fillRect(r() * px, r() * px, 1 + r() * 2, 1 + r() * 2);
    }
  }
  const step = px / cells;
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  for (let i = 1; i < cells; i++) {
    ctx.beginPath(); ctx.moveTo(i * step + 0.5, 0); ctx.lineTo(i * step + 0.5, px); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step + 0.5); ctx.lineTo(px, i * step + 0.5); ctx.stroke();
  }
  ctx.strokeStyle = major; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, px - 2, px - 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function floor(w, d, tex, repeat = 1, color = 0xffffff) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / repeat, d / repeat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

export function line(points, color, opacity = 1, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const l = new THREE.Line(g, m);
  if (dashed) l.computeLineDistances();
  return l;
}

// line with a fixed number of points that can be rewritten every frame
export function liveLine(n, color, opacity = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setDrawRange(0, 0);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.frustumCulled = false;
  l.set = pts => {
    const a = g.attributes.position.array;
    const k = Math.min(n, pts.length);
    for (let i = 0; i < k; i++) { a[i * 3] = pts[i].x; a[i * 3 + 1] = pts[i].y; a[i * 3 + 2] = pts[i].z; }
    g.attributes.position.needsUpdate = true;
    g.setDrawRange(0, k);
  };
  return l;
}

// 2D ray against axis aligned boxes {x0,x1,z0,z1}, returns distance
export function rayBoxes(ox, oz, dx, dz, boxes, max) {
  let best = max;
  for (const b of boxes) {
    let t0 = -Infinity, t1 = Infinity;
    if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
    else {
      let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
    else {
      let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (t1 >= t0 && t0 > 0.02 && t0 < best) best = t0;
  }
  return best;
}

// quadcopter built from primitives. Forward is +x.
export function quadcopter({ span = 0.45, frame = '#1b1f26', front = '#e8463a', back = '#f2f2f2', prop = '#9aa4b2', body = '#2a3038', legs = true } = {}) {
  const g = new THREE.Group();
  const arm = span / 2;
  const mf = mat(frame, { roughness: 0.5 });
  g.add(box(span * 0.32, span * 0.06, span * 0.32, mat(body, { roughness: 0.4, metalness: 0.3 }), 0, 0, 0));
  g.add(box(span * 0.26, span * 0.05, span * 0.22, mf, 0, span * 0.06, 0));
  const props = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
    const a = new THREE.Group();
    a.rotation.y = Math.atan2(-sz, sx);
    const len = arm * 1.15;
    a.add(box(len, span * 0.035, span * 0.05, mat(sx > 0 ? front : back, { roughness: 0.5 }), len / 2, 0, 0));
    g.add(a);
    const mx = sx * arm * 0.81, mz = sz * arm * 0.81;
    const motor = cyl(span * 0.045, span * 0.05, span * 0.07, mat('#3b4250', { metalness: 0.6, roughness: 0.3 }), 14);
    motor.position.set(mx, span * 0.04, mz);
    g.add(motor);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(span * 0.24, 28),
      new THREE.MeshBasicMaterial({ color: prop, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(mx, span * 0.085, mz);
    g.add(disc);
    const blade = box(span * 0.44, span * 0.006, span * 0.035, mat('#d6dbe3', { roughness: 0.4 }), 0, 0, 0);
    blade.castShadow = false;
    const hub = new THREE.Group();
    hub.position.set(mx, span * 0.087, mz);
    hub.add(blade);
    hub.userData.dir = i % 3 === 0 ? 1 : -1;
    g.add(hub);
    props.push(hub);
  });
  if (legs) {
    const ml = mat('#d9dde3', { roughness: 0.5 });
    for (const sz of [1, -1]) {
      g.add(box(span * 0.5, span * 0.02, span * 0.025, ml, 0, -span * 0.2, sz * span * 0.17));
      for (const sx of [1, -1]) {
        const leg = box(span * 0.02, span * 0.2, span * 0.02, ml, sx * span * 0.12, -span * 0.1, sz * span * 0.15);
        leg.rotation.x = -sz * 0.25;
        g.add(leg);
      }
    }
  }
  g.userData.spin = (dt, rate = 60) => props.forEach(p => { p.rotation.y += p.userData.dir * rate * dt; });
  return g;
}
