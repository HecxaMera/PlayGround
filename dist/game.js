import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'little-tide-save-v1';
const tiers = [
  { name: 'Pebble', base: 15, rate: 1, tint: 0xb88461, accent: 0xf1d6ad },
  { name: 'Moss', base: 80, rate: 6, tint: 0x9b7758, accent: 0xe9c995 },
  { name: 'Bubbles', base: 400, rate: 30, tint: 0x765d51, accent: 0xf0d4b4 },
];
let state = { fish: 0, total: 0, owned: [0, 0, 0], last: Date.now() };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && Array.isArray(saved.owned)) {
    state.fish = Math.max(0, Number(saved.fish) || 0);
    state.total = Math.max(state.fish, Number(saved.total) || 0);
    state.owned = tiers.map((_, i) => Math.max(0, Math.floor(Number(saved.owned[i]) || 0)));
    const away = Math.min(8 * 60 * 60, Math.max(0, (Date.now() - (Number(saved.last) || Date.now())) / 1000));
    state.fish += ratePerSecond() * away;
    state.total += ratePerSecond() * away;
  }
} catch { /* start a fresh tide if local storage is unavailable */ }

function ratePerSecond() { return state.owned.reduce((sum, count, i) => sum + count * tiers[i].rate, 0); }
function costAt(i) { return Math.floor(tiers[i].base * Math.pow(1.16, state.owned[i])); }
function pretty(n) {
  if (n < 1000) return Math.floor(n).toLocaleString('en-US');
  const suffix = n < 1e6 ? 'K' : n < 1e9 ? 'M' : 'B';
  const value = n / (suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : 1e9);
  return `${value.toFixed(value < 10 ? 1 : 0)}${suffix}`;
}
function save() {
  try {
    state.last = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('save-status').textContent = 'saved';
  } catch { $('save-status').textContent = 'autosave off'; }
}

// A tiny polygonal aquarium, built entirely from friendly little shapes.
const canvas = $('ocean');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc5e6da, 0.035);
const camera = new THREE.PerspectiveCamera(37, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, window.innerWidth < 600 ? 4.9 : 4.2, window.innerWidth < 600 ? 18 : 12.6);
camera.lookAt(0, 0.1, 0);
scene.add(new THREE.HemisphereLight(0xeefff0, 0x769c93, 2.0));
const sun = new THREE.DirectionalLight(0xfff0d7, 3.2);
sun.position.set(-4, 8, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8; scene.add(sun);
const fill = new THREE.DirectionalLight(0x86d6cc, 1.6); fill.position.set(6, 2, -4); scene.add(fill);
const mat = (color, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const sphereGeo = new THREE.IcosahedronGeometry(1, 1);
function ico(parent, color, pos, scale, detail = 1) {
  const mesh = new THREE.Mesh(detail === 1 ? sphereGeo : new THREE.IcosahedronGeometry(1, detail), mat(color));
  mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function standardMesh(geometry, color, parent, pos = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .76, flatShading: true, side: options.side ?? THREE.FrontSide }));
  mesh.position.set(...pos); mesh.castShadow = options.shadow !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

// Soft sandy seabed, rock clusters and angular sea grass give the scene depth.
const seabed = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48), mat(0xe4d6aa));
seabed.rotation.x = -Math.PI / 2; seabed.position.set(0, -1.42, -1.5); seabed.scale.set(1.35, 1, .72); seabed.receiveShadow = true; scene.add(seabed);
const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.55, .28, 12, 1), mat(0xd0c397));
platform.position.set(0, -1.35, .15); platform.receiveShadow = true; platform.castShadow = true; scene.add(platform);
const rim = new THREE.Mesh(new THREE.TorusGeometry(3.38, .075, 5, 32), mat(0xf6e9c2)); rim.rotation.x = Math.PI / 2; rim.position.set(0, -1.19, .15); scene.add(rim);
for (let i = 0; i < 32; i++) {
  const a = i / 32 * Math.PI * 2, r = 3.2 + Math.random() * 1.2;
  const rock = ico(scene, [0x9cc8b0, 0xb7d2ab, 0xe0c99d, 0xd5b4a1][i % 4], [Math.cos(a) * r, -1.1 + Math.random() * .24, Math.sin(a) * r - .65], [.18 + Math.random() * .18, .16 + Math.random() * .20, .17 + Math.random() * .17]);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
}
function plant(x, z, height, color, lean) {
  const group = new THREE.Group(); group.position.set(x, -1.1, z); scene.add(group);
  for (let i = 0; i < 3; i++) {
    const h = height * (.68 + Math.random() * .38);
    const points = [new THREE.Vector3(i * .12, 0, 0), new THREE.Vector3(i * .12 + lean * .35, h * .55, 0), new THREE.Vector3(i * .12 + lean, h, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 2 })); group.add(line);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.12, h * .72, 4), mat(color)); leaf.position.set(i * .12 + lean * .52, h * .68, 0); leaf.rotation.z = -lean * .9; group.add(leaf);
  }
  group.userData.sway = Math.random() * 6;
  return group;
}
const plants = [];
[[-4.8, -1.2, 2.25, 0x54a98d, -.3], [-4.1, -2.0, 1.45, 0x78b98e, .35], [4.6, -1.0, 2.5, 0x5cae91, .35], [4.2, -2.2, 1.65, 0x85ba83, -.3], [-3.6, -3.2, 1.25, 0xe6a28d, .24], [3.7, -3.1, 1.4, 0xeca882, -.2]].forEach(p => plants.push(plant(...p)));
// Coral made from faceted little branches.
function coral(x, z, color) {
  const g = new THREE.Group(); g.position.set(x, -1.07, z); scene.add(g);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, .85, 5), mat(color)); trunk.position.y = .42; g.add(trunk);
  for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .46, 5), mat(color)); b.position.set((j - 1) * .22, .61 + (j % 2) * .15, 0); b.rotation.z = (j - 1) * -.55; g.add(b); }
}
coral(-4.3, .1, 0xe79b86); coral(4.5, -.3, 0xdf9c8b);

// Hero fish: low-poly body, fins and bright little face details.
const fish = new THREE.Group(); fish.position.set(-.05, .37, .1); scene.add(fish);
const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat(0xf4a35f)); body.scale.set(1.42, .78, .68); body.castShadow = true; body.receiveShadow = true; fish.add(body);
const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffd69a)); belly.scale.set(.96, .34, .57); belly.position.set(.13, -.39, .13); fish.add(belly);
function triangle(parent, verts, color) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts.flat(), 3)); geo.setIndex([0, 1, 2]); geo.computeVertexNormals();
  return standardMesh(geo, color, parent, [0, 0, 0], { side: THREE.DoubleSide });
}
const tail = new THREE.Group(); tail.position.set(-1.28, 0, 0); fish.add(tail);
triangle(tail, [[0, 0, 0], [-.85, .58, 0], [-.65, 0, .04]], 0xec855b);
triangle(tail, [[-.65, 0, .04], [-.85, -.58, 0], [0, 0, 0]], 0xf19867);
triangle(fish, [[-.18, .53, 0], [.35, 1.08, 0], [.63, .53, 0]], 0xf8bd75);
triangle(fish, [[-.25, -.53, 0], [.4, -.92, 0], [.69, -.48, 0]], 0xe9895c);
const pectoral = triangle(fish, [[-.05, .06, .55], [.68, -.28, .68], [.28, -.52, .66]], 0xe47e59);
const eyeWhite = ico(fish, 0xfff9e9, [.75, .19, .55], [.17, .18, .08]);
ico(fish, 0x29484b, [.80, .19, .615], [.085, .105, .055]);
ico(fish, 0xffffff, [.825, .235, .658], [.029, .033, .018]);
// Gill arc, made from a fine curve on the near side.
const gillPoints = [new THREE.Vector3(.36, .34, .56), new THREE.Vector3(.24, .12, .66), new THREE.Vector3(.31, -.12, .63), new THREE.Vector3(.44, -.25, .56)];
const gillCurve = new THREE.CatmullRomCurve3(gillPoints);
fish.add(new THREE.Mesh(new THREE.TubeGeometry(gillCurve, 9, .018, 4, false), mat(0xc96f50)));
const smile = new THREE.Mesh(new THREE.TorusGeometry(.09, .013, 4, 10, Math.PI * .72), mat(0x9b5b4b)); smile.position.set(1.06, -.06, .51); smile.rotation.z = -.45; fish.add(smile);

// Otter companions are assembled from faceted primitives; they pop into the cove as recruited.
const otters = [];
function makeOtter(tierIndex) {
  const info = tiers[tierIndex], root = new THREE.Group();
  const torso = ico(root, info.tint, [0, 0, 0], [.42, .52, .31], 2); torso.rotation.z = -.24;
  ico(root, info.accent, [.14, .02, .285], [.29, .38, .09], 1).rotation.z = -.22;
  ico(root, info.tint, [.18, .46, .02], [.34, .33, .3], 2);
  ico(root, info.accent, [.24, .39, .286], [.235, .20, .10], 1);
  ico(root, 0x382f2a, [.19, .52, .37], [.038, .05, .025], 1);
  ico(root, 0x382f2a, [.38, .52, .37], [.038, .05, .025], 1);
  ico(root, 0x63433a, [.29, .39, .383], [.052, .04, .025], 1);
  ico(root, info.tint, [-.08, .70, .02], [.11, .12, .12], 1);
  ico(root, info.tint, [.43, .69, .02], [.11, .12, .12], 1);
  ico(root, info.tint, [-.4, -.1, -.02], [.36, .12, .13], 1).rotation.z = -.38;
  const fishy = ico(root, 0xf4a35f, [.34, -.22, .32], [.17, .08, .07], 1); fishy.rotation.z = -.22;
  root.scale.setScalar(.78 + tierIndex * .07);
  root.userData.phase = Math.random() * 8;
  root.userData.tier = tierIndex;
  return root;
}
function syncOtters() {
  otters.forEach(o => scene.remove(o)); otters.length = 0;
  for (let t = 0; t < state.owned.length; t++) for (let n = 0; n < Math.min(state.owned[t], 5); n++) {
    const otter = makeOtter(t); const index = otters.length;
    const x = (index - 2) * .9 + (t - 1) * .2;
    otter.position.set(x, -0.78 + (index % 2) * .08, .85 + Math.abs(index - 2) * .08);
    otter.rotation.y = x < 0 ? .24 : -.24; scene.add(otter); otters.push(otter);
  }
}
syncOtters();

// A school of distant fish and slow bubbles makes the water feel alive.
const school = [];
for (let i = 0; i < 7; i++) {
  const mini = new THREE.Group(); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 1), mat(i % 2 ? 0x8bcfc0 : 0xe9b279)); b.scale.set(1.3, .7, .55); mini.add(b);
  const t = new THREE.Mesh(new THREE.ConeGeometry(.13, .24, 3), mat(i % 2 ? 0x8bcfc0 : 0xe9b279)); t.rotation.z = -Math.PI / 2; t.position.x = -.24; mini.add(t);
  mini.position.set(-5 + Math.random() * 10, .4 + Math.random() * 2.8, -2 - Math.random() * 2); mini.userData.phase = Math.random() * 6; mini.userData.speed = .15 + Math.random() * .25; scene.add(mini); school.push(mini);
}
const bubbles = [];
for (let i = 0; i < 38; i++) {
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(.045 + Math.random() * .055, 1), new THREE.MeshStandardMaterial({ color: 0xe8fff2, roughness: .25, transparent: true, opacity: .48, flatShading: true }));
  bubble.position.set((Math.random() - .5) * 11, -1 + Math.random() * 5, (Math.random() - .5) * 6 - 1); bubble.userData.speed = .12 + Math.random() * .28; bubble.userData.phase = Math.random() * 6; scene.add(bubble); bubbles.push(bubble);
}

function updateUI() {
  $('fish-count').textContent = pretty(state.fish);
  $('catch-total').textContent = pretty(state.total);
  $('rate-label').textContent = pretty(ratePerSecond());
  $('crew-count').textContent = state.owned.reduce((a, b) => a + b, 0);
  $('ocean-level').textContent = `DAY ${String(Math.floor(state.total / 100) + 1).padStart(2, '0')}`;
  const firstLocked = tiers.findIndex((_, i) => state.owned[i] === 0);
  const goalTier = firstLocked < 0 ? 2 : firstLocked;
  const goal = costAt(goalTier);
  const progress = Math.min(100, state.fish / goal * 100);
  $('goal-fill').style.width = `${progress}%`;
  $('catch-total').title = `${Math.floor(state.total).toLocaleString('en-US')} fish caught`;
  $('fish-count').title = `${Math.floor(state.fish).toLocaleString('en-US')} fish in your basket`;
  $('goal-label').textContent = `${pretty(goal)} fish`;
  document.querySelectorAll('.shop-card').forEach((card, i) => {
    const cost = costAt(i); card.querySelector('.buy-cost').textContent = pretty(cost);
    card.querySelector('.owned-count').textContent = state.owned[i];
    card.disabled = state.fish < cost;
    card.classList.toggle('affordable', state.fish >= cost);
  });
  const crew = $('crew-avatars');
  crew.innerHTML = '';
  const totalCrew = state.owned.reduce((a, b) => a + b, 0);
  if (!totalCrew) crew.innerHTML = '<span class="avatar avatar-one">ᵔᴥᵔ</span>';
  else for (let i = 0; i < Math.min(3, totalCrew); i++) { const a = document.createElement('span'); a.className = `avatar avatar-${i}`; a.textContent = 'ᵔᴥᵔ'; a.style.background = ['#f5d69c', '#d2e8b8', '#d9d2ec'][i]; crew.append(a); }
}
updateUI();

function popText(text, x = window.innerWidth * .5, y = window.innerHeight * .42) {
  const node = document.createElement('span'); node.className = 'float-text'; node.textContent = text;
  node.style.left = `${x + (Math.random() - .5) * 70}px`; node.style.top = `${y + (Math.random() - .5) * 24}px`;
  $('float-layer').append(node); window.setTimeout(() => node.remove(), 1000);
}
let audioContext = null, soundOn = true;
function chime() {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(660 + Math.random() * 220, audioContext.currentTime); osc.frequency.exponentialRampToValueAtTime(1040, audioContext.currentTime + .12);
    gain.gain.setValueAtTime(.055, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .18);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .19);
  } catch { /* audio is a gentle enhancement, never required */ }
}
$('fish-click').addEventListener('click', (event) => {
  state.fish += 1; state.total += 1; fish.scale.setScalar(1.06); fish.userData.squish = 1;
  popText('+1 fish', event.clientX, event.clientY); chime(); updateUI(); save();
});
document.querySelectorAll('.shop-card').forEach((card) => card.addEventListener('click', () => {
  const i = Number(card.dataset.tier), cost = costAt(i);
  if (state.fish < cost) return;
  state.fish -= cost; state.owned[i]++; syncOtters(); updateUI(); save(); popText(`${tiers[i].name} joined!`, window.innerWidth * .5, window.innerHeight * .72);
}));
$('sound-button').addEventListener('click', () => { soundOn = !soundOn; $('sound-icon').textContent = soundOn ? '♪' : '×'; $('sound-button').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound'); if (soundOn) chime(); });
window.addEventListener('beforeunload', save);
window.setInterval(() => { const rate = ratePerSecond(); if (rate > 0) { state.fish += rate; state.total += rate; updateUI(); } save(); }, 1000);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  fish.position.y = .37 + Math.sin(t * 1.7) * .09;
  fish.rotation.z = Math.sin(t * 1.1) * .035;
  tail.rotation.y = Math.sin(t * 5.2) * .4;
  if (fish.userData.squish > 0) { fish.userData.squish = Math.max(0, fish.userData.squish - .12); const s = 1 + fish.userData.squish * .08; fish.scale.set(s, 1 - fish.userData.squish * .035, 1); }
  otters.forEach(o => { o.position.y = -.78 + (o.userData.phase % 2) * .04 + Math.sin(t * 1.6 + o.userData.phase) * .045; o.rotation.z = Math.sin(t * 1.2 + o.userData.phase) * .035; });
  plants.forEach(p => { p.rotation.z = Math.sin(t * .75 + p.userData.sway) * .035; });
  school.forEach(f => { f.position.x += f.userData.speed * .003; f.position.y += Math.sin(t + f.userData.phase) * .001; if (f.position.x > 6) f.position.x = -6; });
  bubbles.forEach(b => { b.position.y += b.userData.speed * .008; b.position.x += Math.sin(t + b.userData.phase) * .0015; if (b.position.y > 4) { b.position.y = -1.4; b.position.x = (Math.random() - .5) * 11; } });
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7)); camera.aspect = w / h; camera.position.set(0, w < 600 ? 4.9 : 4.2, w < 600 ? 18 : 12.6); camera.updateProjectionMatrix();
});
