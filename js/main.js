import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smooth, damp, gridTexture, tag, TAU } from './kit.js';
import * as lab from './zones/lab.js';
import * as ward from './zones/ward.js';
import * as farm from './zones/farm.js';
import * as crop from './zones/crop.js';
import * as arena from './zones/arena.js';
import * as forest from './zones/forest.js';
import * as robocon from './zones/robocon.js';
import { boot, initUI } from './ui.js';

const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('world');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const bg = new THREE.Color('#0b0f17');
scene.background = bg;
scene.fog = new THREE.Fog(bg, 20, 80);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 900);

const hemi = new THREE.HemisphereLight('#bcd4ff', '#1a1f29', 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ground for the whole world
const groundTex = gridTexture({ bg: '#ffffff', line: 'rgba(0,0,0,0.07)', major: 'rgba(0,0,0,0.13)', cells: 5, px: 512 });
groundTex.repeat.set(120, 120);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: '#151b25', roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// post: bloom then a lens pass that glitches while the camera travels
let composer = null, fx = null, bloom = null;
const FX = {
  uniforms: { tDiffuse: { value: null }, uWarp: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uWarp, uTime; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; float w = uWarp;
      float band = floor(uv.y * 28.0 + floor(uTime * 9.0));
      float g = step(1.0 - 0.22 * w, hash(vec2(band, floor(uTime * 14.0))));
      uv.x += g * (hash(vec2(band, 7.1)) - 0.5) * 0.09 * w;
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 off = c * (0.0025 + 0.035 * w) * (0.5 + r2 * 2.5);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col *= 1.0 - (0.025 + 0.08 * w) * (0.5 + 0.5 * sin(vUv.y * uRes.y * 1.7));
      col += (hash(vUv * uRes + fract(uTime)) - 0.5) * (0.015 + 0.03 * w);
      col *= 1.0 - smoothstep(0.38, 0.95, length(vUv - 0.5) * 1.25) * 0.6;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.95);
if (!mobile) composer.addPass(bloom);
fx = new ShaderPass(FX);
composer.addPass(fx);
composer.addPass(new OutputPass());

// floating dust that wraps around the camera, gives depth while flying
const DUST = mobile ? 500 : 1400;
const dustPos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST * 3; i++) dustPos[i] = (Math.random() - 0.5) * 60;
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#9fd8ff') }, uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
  vertexShader: `uniform vec3 uCam; uniform float uTime, uPx; varying float vA;
    void main(){
      vec3 p = position + vec3(sin(uTime * 0.1 + position.y) * 0.6, uTime * 0.15, cos(uTime * 0.08 + position.x) * 0.6);
      p = mod(p - uCam + 30.0, 60.0) - 30.0 + uCam;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float d = -mv.z; vA = smoothstep(60.0, 8.0, d) * smoothstep(0.5, 3.0, d);
      gl_PointSize = uPx * 60.0 / d; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; varying float vA;
    void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor, vA * 0.5 * smoothstep(0.5, 0.0, r)); }`,
});
const dust = new THREE.Points(dustGeo, dustMat);
dust.frustumCulled = false;
scene.add(dust);

// zones sit on a ring around a hub
const R = 62;
const ZONES = [
  ['lab', lab, 'TEST RANGE'], ['ward', ward, 'SCOBO'], ['farm', farm, 'AGRIDOC'], ['crop', crop, 'CROPSENTRY'],
  ['arena', arena, 'LUMINOSITY'], ['forest', forest, 'FOREST-COP-TER'], ['robocon', robocon, 'ROBOCON'],
];
const PAL = {
  lab: { bg: '#0b111b', fog: [16, 62], sky: '#a9c8ff', gnd: '#1a1f29', hemi: 0.95, sun: '#ffffff', sunI: 2.4, env: 0.7, ground: '#121822', bloom: 0.55, dust: '#9fd8ff' },
  ward: { bg: '#0d1420', fog: [18, 64], sky: '#dfeaff', gnd: '#2a3340', hemi: 0.55, sun: '#fff6ea', sunI: 1.7, env: 0.3, ground: '#151c27', bloom: 0.3, dust: '#cfe8ff' },
  farm: { bg: '#121a14', fog: [16, 60], sky: '#fff3da', gnd: '#3a2f22', hemi: 1.0, sun: '#ffe2b0', sunI: 2.8, env: 0.55, ground: '#1b1a14', bloom: 0.35, dust: '#ffe6a8' },
  crop: { bg: '#0f1712', fog: [16, 60], sky: '#efffe6', gnd: '#2d3a24', hemi: 0.95, sun: '#fff0d0', sunI: 2.6, env: 0.5, ground: '#15190f', bloom: 0.35, dust: '#e8ffb0' },
  arena: { bg: '#03050a', fog: [14, 50], sky: '#3d4f8f', gnd: '#05070c', hemi: 0.22, sun: '#8ea2ff', sunI: 0.45, env: 0.12, ground: '#06080e', bloom: 0.75, dust: '#b9a6ff' },
  forest: { bg: '#24182a', fog: [12, 46], sky: '#ffb08a', gnd: '#1c2a1d', hemi: 0.75, sun: '#ff9a5c', sunI: 2.3, env: 0.35, ground: '#191d15', bloom: 0.6, dust: '#ffc58a' },
  robocon: { bg: '#0e1424', fog: [16, 60], sky: '#dfe8ff', gnd: '#262c3a', hemi: 0.55, sun: '#ffffff', sunI: 1.9, env: 0.4, ground: '#141a26', bloom: 0.4, dust: '#9fd8ff' },
  overview: { bg: '#070a11', fog: [90, 330], sky: '#9fb8ff', gnd: '#141820', hemi: 0.8, sun: '#ffffff', sunI: 1.8, env: 0.45, ground: '#0e131c', bloom: 0.9, dust: '#9fd8ff' },
};
for (const p of Object.values(PAL)) for (const k of ['bg', 'sky', 'gnd', 'sun', 'ground', 'dust']) p[k] = new THREE.Color(p[k]);

const zones = {};
const nameTags = [];

function buildHub() {
  const hub = new THREE.Group();
  const cyan = new THREE.MeshStandardMaterial({ color: '#4fd1ff', emissive: '#4fd1ff', emissiveIntensity: 2.5 });
  const rings = [];
  [[7, 0.06], [5.2, 0.05], [3.4, 0.04]].forEach(([r, t], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 120), cyan);
    m.position.y = 9;
    m.rotation.x = Math.PI / 2 + i * 0.5;
    hub.add(m); rings.push(m);
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: '#4fd1ff', wireframe: true, transparent: true, opacity: 0.7 }));
  core.position.y = 9;
  hub.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 18, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 9;
  hub.add(beam);
  const pad = new THREE.Mesh(new THREE.RingGeometry(8, 8.3, 128), new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.5 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  hub.add(pad);
  // spokes and the ring road
  const dashMat = new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.35 });
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 0.18).rotateX(-Math.PI / 2), dashMat, 260);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 260; i++) {
    const a = (i / 260) * TAU;
    m4.compose(new THREE.Vector3(Math.sin(a) * R * 0.78, 0.02, Math.cos(a) * R * 0.78), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI / 2), new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(i, m4);
  }
  hub.add(dashes);
  const pulses = [];
  const pulseMat = new THREE.MeshBasicMaterial({ color: '#bff0ff' });
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), pulseMat);
    p.userData.a = (i / 10) * TAU;
    hub.add(p); pulses.push(p);
  }
  for (let i = 0; i < ZONES.length; i++) {
    const a = (i / ZONES.length) * TAU, len = R * 0.78 - 9;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len).rotateX(-Math.PI / 2), dashMat);
    s.position.set(Math.sin(a) * (9 + len / 2), 0.02, Math.cos(a) * (9 + len / 2));
    s.rotation.y = a;
    hub.add(s);
  }
  scene.add(hub);
  hub.userData.update = (t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.2 + i * 0.15) * (i % 2 ? -1 : 1); r.rotation.y = Math.sin(t * 0.3 + i) * 0.3; });
    core.rotation.set(t * 0.2, t * 0.3, 0);
    pulses.forEach(p => { const a = p.userData.a + t * 0.12; p.position.set(Math.sin(a) * R * 0.78, 0.25, Math.cos(a) * R * 0.78); });
  };
  return hub;
}

// shots in each zone's own frame: anchor, camera offset, look offset, screen shift
const SHOTS = {
  hero: { zone: 'lab', anchor: 'turret', off: [6.8, -0.6, 7.6], look: [1.2, 1.0, 0.4], shift: 0.22 },
  aituring: { zone: 'lab', anchor: 'dog', off: [2.4, 1.3, 3.2], look: [0, 0, 0], shift: -0.2 },
  'scobo-a': { zone: 'ward', anchor: 'centre', off: [0.5, 7.2, 9.6], look: [0, -0.6, -1.0], shift: 0.18 },
  'scobo-b': { zone: 'ward', anchor: 'robot', off: [2.2, 1.7, 2.8], look: [0, 0.1, 0], shift: -0.2 },
  'agridoc-a': { zone: 'farm', anchor: 'centre', off: [1.5, 5.2, 7.8], look: [0, -0.3, -0.5], shift: 0.18 },
  'agridoc-b': { zone: 'farm', anchor: 'robot', off: [-1.6, 1.5, 2.1], look: [0.2, 0, 0], shift: -0.2 },
  'crop-a': { zone: 'crop', anchor: 'centre', off: [0.2, 8.2, 11.8], look: [-1.4, -0.6, -0.4], shift: 0.18 },
  'crop-b': { zone: 'crop', anchor: 'robot', off: [1.9, 1.3, 2.3], look: [0, -0.05, 0], shift: -0.2 },
  'ld-a': { zone: 'arena', anchor: 'centre', off: [0.6, 6.0, 7.8], look: [0, -0.8, 0], shift: 0.18 },
  'ld-b': { zone: 'arena', anchor: 'drone', off: [2.0, 1.2, 2.6], look: [0, -0.2, 0], shift: -0.2 },
  'fct-a': { zone: 'forest', anchor: 'clearing', off: [4.2, 3.6, 8.2], look: [-0.4, 1.4, 0], shift: 0.18 },
  'fct-b': { zone: 'forest', anchor: 'drone', off: [2.6, 1.0, 3.4], look: [0, -0.3, 0], shift: -0.2 },
  'robocon-a': { zone: 'robocon', anchor: 'centre', off: [0.6, 4.6, 8.6], look: [0.6, -0.4, 0], shift: 0.16 },
  'robocon-b': { zone: 'robocon', anchor: 'r1', off: [-1.9, 1.5, 3.2], look: [-0.9, -0.1, 0], shift: -0.2 },
  overview: { zone: 'overview', pos: [0, 108, 118], target: [0, 0, 6], shift: 0 },
};

const stops = [];
function measure() {
  const vh = innerHeight;
  stops.length = 0;
  document.querySelectorAll('[data-shot]').forEach(el => {
    const top = el.getBoundingClientRect().top + scrollY;
    const h = el.offsetHeight;
    const name = el.dataset.shot;
    // a tall panel holds its shot for its whole height
    if (h > vh * 1.2) { stops.push({ c: top, name, el }); stops.push({ c: top + h - vh, name, el }); }
    else stops.push({ c: Math.max(0, top + h / 2 - vh / 2), name, el });
  });
}

const anchorSm = {};
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function shotPose(name, outPos, outLook) {
  const s = SHOTS[name];
  if (s.zone === 'overview') { outPos.set(...s.pos); outLook.set(...s.target); return; }
  const z = zones[s.zone];
  const a = anchorSm[name] || (anchorSm[name] = z.anchors[s.anchor].clone());
  // narrow screens see less, so back the camera off
  const k = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 1.1 : 1;
  outPos.set(a.x + s.off[0] * k, a.y + s.off[1] * k, a.z + s.off[2] * k);
  outLook.set(a.x + s.look[0], a.y + s.look[1], a.z + s.look[2]);
  z.group.localToWorld(outPos);
  z.group.localToWorld(outLook);
}

const view = { s: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), shift: 0, warp: 0, k: 0, zone: 'lab', speed: 0 };
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), L0 = new THREE.Vector3(), L1 = new THREE.Vector3();
const pal = {};
function mixPal(a, b, u) {
  for (const k of ['bg', 'sky', 'gnd', 'sun', 'ground', 'dust']) (pal[k] || (pal[k] = new THREE.Color())).lerpColors(a[k], b[k], u);
  for (const k of ['hemi', 'sunI', 'env', 'bloom']) pal[k] = lerp(a[k], b[k], u);
  pal.fog = [lerp(a.fog[0], b.fog[0], u), lerp(a.fog[1], b.fog[1], u)];
}

function followAnchors(dt) {
  for (const [name, s] of Object.entries(SHOTS)) {
    if (s.zone === 'overview') continue;
    const target = zones[s.zone].anchors[s.anchor];
    const a = anchorSm[name] || (anchorSm[name] = target.clone());
    a.x = damp(a.x, target.x, 2.5, dt); a.y = damp(a.y, target.y, 2.5, dt); a.z = damp(a.z, target.z, 2.5, dt);
  }
}

function frameCamera(dt) {
  if (!stops.length) return;
  followAnchors(dt);
  const s = view.s;
  let k = 0;
  while (k < stops.length - 2 && s >= stops[k + 1].c) k++;
  const A = stops[k], B = stops[Math.min(k + 1, stops.length - 1)];
  const span = Math.max(1, B.c - A.c);
  const raw = clamp((s - A.c) / span);
  const u = smooth(clamp((raw - 0.12) / 0.76));
  shotPose(A.name, P0, L0);
  shotPose(B.name, P1, L1);
  const za = SHOTS[A.name].zone, zb = SHOTS[B.name].zone;
  const travel = za !== zb;
  const dist = P0.distanceTo(P1);
  const lift = travel ? 8 + dist * 0.32 : dist * 0.08;
  // quadratic arc that rises between places
  const mid = tmpA.addVectors(P0, P1).multiplyScalar(0.5);
  mid.y = Math.max(P0.y, P1.y) + lift;
  view.pos.set(
    (1 - u) * (1 - u) * P0.x + 2 * (1 - u) * u * mid.x + u * u * P1.x,
    (1 - u) * (1 - u) * P0.y + 2 * (1 - u) * u * mid.y + u * u * P1.y,
    (1 - u) * (1 - u) * P0.z + 2 * (1 - u) * u * mid.z + u * u * P1.z);
  const lm = tmpB.addVectors(L0, L1).multiplyScalar(0.5);
  if (travel) lm.y -= 2;
  view.look.set(
    (1 - u) * (1 - u) * L0.x + 2 * (1 - u) * u * lm.x + u * u * L1.x,
    (1 - u) * (1 - u) * L0.y + 2 * (1 - u) * u * lm.y + u * u * L1.y,
    (1 - u) * (1 - u) * L0.z + 2 * (1 - u) * u * lm.z + u * u * L1.z);
  view.shift = lerp(SHOTS[A.name].shift, SHOTS[B.name].shift, u);
  view.k = u < 0.5 ? k : k + 1;
  view.zone = u < 0.5 ? za : zb;
  view.active = new Set([za, zb]);
  const pa = PAL[za], pb = PAL[zb];
  mixPal(pa, pb, travel ? smooth(clamp((u - 0.25) / 0.5)) : u);
  view.warpTarget = travel ? Math.sin(u * Math.PI) : 0;

  mouse.sx = damp(mouse.sx, mouse.x, 3, dt);
  mouse.sy = damp(mouse.sy, mouse.y, 3, dt);
  const prev = camera.position.clone();
  camera.position.copy(view.pos);
  camera.lookAt(view.look);
  if (!mobile && !reduced) {
    camera.position.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), mouse.sx * 0.5);
    camera.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), -mouse.sy * 0.3);
    camera.lookAt(view.look);
  }
  view.speed = damp(view.speed, prev.distanceTo(camera.position) / Math.max(dt, 1e-3), 6, dt);
  camera.fov = 38 + clamp(view.speed / 40) * 12;
  const W = innerWidth, H = innerHeight;
  if (mobile) camera.setViewOffset(W, H, 0, H * 0.16, W, H);
  else camera.setViewOffset(W, H, -view.shift * W, 0, W, H);
  camera.updateProjectionMatrix();
}

function applyPalette(dt) {
  bg.copy(pal.bg);
  scene.fog.near = pal.fog[0]; scene.fog.far = pal.fog[1];
  hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.gnd); hemi.intensity = pal.hemi;
  sun.color.copy(pal.sun); sun.intensity = pal.sunI;
  scene.environmentIntensity = pal.env;
  groundMat.color.copy(pal.ground);
  bloom.strength = pal.bloom;
  dustMat.uniforms.uColor.value.copy(pal.dust);
  // keep the shadow box around what the camera looks at
  sun.target.position.copy(view.look).setY(0);
  sun.position.copy(view.look).add(new THREE.Vector3(9, 18, 7));
  sun.castShadow = camera.position.y < 30;
  const high = clamp((camera.position.y - 18) / 30);
  nameTags.forEach(t => { t.material.opacity = high; t.visible = high > 0.02; });
}

const hudEl = document.getElementById('hud-rows'), hudZone = document.getElementById('hud-zone');
const radar = document.getElementById('radar');
const rctx = radar ? radar.getContext('2d') : null;
let hudTick = 0;
function drawHud(dt) {
  hudTick += dt;
  if (hudTick > 0.12) {
    hudTick = 0;
    const z = zones[view.zone];
    if (z && hudEl) {
      hudZone.textContent = ZONES.find(q => q[0] === view.zone)[2];
      hudEl.innerHTML = z.hud().map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    } else if (hudEl) {
      hudZone.textContent = 'WORLD';
      hudEl.innerHTML = `<div><span>robots online</span><b>${ZONES.length} / ${ZONES.length}</b></div><div><span>cam</span><b>${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}</b></div>`;
    }
  }
  if (!rctx) return;
  const w = radar.width, c = w / 2, sc = (w * 0.42) / R;
  rctx.clearRect(0, 0, w, w);
  rctx.strokeStyle = 'rgba(79,209,255,0.35)'; rctx.lineWidth = 1;
  rctx.beginPath(); rctx.arc(c, c, R * 0.78 * sc, 0, TAU); rctx.stroke();
  rctx.beginPath(); rctx.arc(c, c, w * 0.48, 0, TAU); rctx.stroke();
  const sweep = (performance.now() / 1000) % TAU;
  rctx.fillStyle = 'rgba(79,209,255,0.12)';
  rctx.beginPath(); rctx.moveTo(c, c); rctx.arc(c, c, w * 0.48, sweep, sweep + 0.5); rctx.fill();
  ZONES.forEach(([id], i) => {
    const a = (i / ZONES.length) * TAU;
    const x = c + Math.sin(a) * R * sc, y = c + Math.cos(a) * R * sc;
    rctx.fillStyle = id === view.zone ? '#ffb547' : 'rgba(79,209,255,0.85)';
    rctx.beginPath(); rctx.arc(x, y, id === view.zone ? 4.5 : 3, 0, TAU); rctx.fill();
  });
  const cx = c + camera.position.x * sc, cy = c + camera.position.z * sc;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const a = Math.atan2(dir.z, dir.x);
  rctx.fillStyle = 'rgba(255,255,255,0.18)';
  rctx.beginPath(); rctx.moveTo(cx, cy); rctx.arc(cx, cy, 26, a - 0.35, a + 0.35); rctx.fill();
  rctx.fillStyle = '#fff';
  rctx.beginPath(); rctx.arc(cx, cy, 3, 0, TAU); rctx.fill();
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  fx.uniforms.uRes.value.set(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  measure();
}
addEventListener('resize', resize);

async function start() {
  const log = boot();
  log('roslaunch vinay portfolio.launch');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const files = { scobo: 'models/scobo.glb', agridoc: 'models/agridoc.glb', cropsentry: 'models/cropsentry.glb', r1: 'models/r1.glb', r2: 'models/r2.glb' };
  const models = {};
  let done = 0;
  const total = Object.keys(files).length + 1;
  const tick = (msg) => { done++; log(msg, done / total); };
  const jobs = Object.entries(files).map(([k, url]) => loader.loadAsync(url).then(g => { models[k] = g; tick(`[INFO] spawn_entity: ${k} (${url.split('/')[1]})`); }));
  const data = fetch('data/ld_flight.json').then(r => r.json()).then(j => { tick('[INFO] rosbag LD_3811_biota_detector.bag  ' + j.path.length + ' poses'); return j; });
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* fonts are optional */ }
  const [flight] = await Promise.all([data, ...jobs]);

  const ctx = { models, data: flight, mobile };
  ZONES.forEach(([id, mod, label], i) => {
    const z = mod.build(ctx);
    const a = (i / ZONES.length) * TAU;
    z.group.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    z.group.rotation.y = a;
    z.group.updateMatrixWorld(true);
    scene.add(z.group);
    zones[id] = z;
    z.sprites = [];
    z.group.traverse(o => { if (o.isSprite) z.sprites.push(o); });
    const t = tag(label, { edge: '#4fd1ff', size: 0.04 });
    t.position.set(z.group.position.x, 9, z.group.position.z);
    t.material.transparent = true;
    scene.add(t);
    nameTags.push(t);
    log(`[INFO] ${id}: ready`);
  });
  const hub = buildHub();
  for (const z of Object.values(zones)) z.update(0.016, 0);

  initUI({ measure });
  measure();
  new ResizeObserver(() => measure()).observe(document.querySelector('main'));
  view.s = scrollY;
  log('[INFO] all nodes up. scroll to drive.', 1, true);
  view.warp = 1;

  const clock = new THREE.Clock();
  let t = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    view.s = damp(view.s, scrollY, reduced ? 20 : 5, dt);
    frameCamera(dt);
    applyPalette(dt);
    const all = view.active.has('overview');
    for (const [id, z] of Object.entries(zones)) {
      // tags inside a zone only make sense up close
      if (all || view.active.has(id)) z.update(dt, t);
      const near = camera.position.distanceTo(z.group.position) < 34;
      if (near && !z.near) z.sprites.forEach(s => { s.visible = true; });
      if (!near) z.sprites.forEach(s => { s.visible = false; });
      z.near = near;
    }
    hub.userData.update(t);
    view.warp = damp(view.warp, Math.max(view.warpTarget, clamp(view.speed / 60) * 0.6), 4, dt);
    fx.uniforms.uWarp.value = reduced ? 0 : view.warp;
    fx.uniforms.uTime.value = t;
    dustMat.uniforms.uCam.value.copy(camera.position);
    dustMat.uniforms.uTime.value = t;
    drawHud(dt);
    document.documentElement.style.setProperty('--warp', view.warp.toFixed(3));
    composer.render();
  });
}

start().catch(err => {
  console.error(err);
  document.body.classList.add('no-webgl');
  const b = document.getElementById('boot');
  if (b) b.classList.add('done');
});
