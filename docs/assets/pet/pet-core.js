import * as THREE from 'three';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';


/* ═══════════════════════════════════════════════════════════════════════════
   岁己SUI 主页桌宠（PMX + three.js r171）· 模块入口
   ───────────────────────────────────────────────────────────────────────────
   本文件由 pet.html（独立验证页，跑 82 项自动化验证）抽取而来，
   **姿态 / 动作 / 交互逻辑一字未改**，只加了「挂载 / 卸载」的包装与站点化改造。

   用法：
     const pet = mountPet({ root: el, model: 'assets/pet/model/Suifel.pmx',
                            textureExt: '.webp', petBottom: 72 });
     pet.destroy();          // 彻底卸载（可反复开关）

   资源体积较大（three.js + PMX 模型 + 贴图约 9MB），**必须按需 import**，
   不要放进首屏脚本。
   ═══════════════════════════════════════════════════════════════════════════ */
export function mountPet(opts) {
if (!opts || !opts.root) throw new Error('mountPet: opts.root is required');

/* 可回收的监听表：destroy() 逐个摘掉，反复开关不会残留处理器 */
const ON = [];
function on(target, type, fn, o) { target.addEventListener(type, fn, o); ON.push([target, type, fn, o]); }
function offAll() { for (let i = 0; i < ON.length; i++) { const e = ON[i]; e[0].removeEventListener(e[1], e[2], e[3]); } ON.length = 0; }
let running = true, rafId = 0, io = null;

/* ═══════════════════════════════════════════════════════════════════════════
   配置
   ═══════════════════════════════════════════════════════════════════════════ */
const CFG = {
  model:      opts.model,
  // 贴图扩展名替换：站点版贴图压成 WebP，而模型内部写的是 .png，靠下面的 URL 改写对上
  textureExt: opts.textureExt || '',
  dprMax:     2,        // 设备像素比上限（桌宠不需要 3x，省一半像素）
  idleFps:    60,       // 空闲目标帧率（v3：原先 30，静置时看着就是掉帧）
  activeFps:  60,       // 交互中目标帧率
  headYawMax: 0.42,     // 头部水平跟随上限（弧度）
  headPitchMax: 0.26,
  eyeYawMax:  0.30,     // 眼球平移上限（MMD 单位）
  blinkEvery: [2.4, 6.5],   // 眨眼间隔区间（秒）
  breathing:  true,
  springHair: true,
  /* ── v2 新增 ── */
  idleEvery:  [4.5, 11.0],  // 自动小动作的间隔区间（秒）
  sleepAfter: 90,           // 无互动多久后打瞌睡（秒）
  comboReset: 2.5,          // 连击间隔超过这个时间就归零（秒）
  hoverBlush: 1.2,          // 悬停多久后开始脸红（秒）
  petMargin:  16,           // 初始位置距视口左/右边距（px）
  petBottom:  opts.petBottom === undefined ? 0 : opts.petBottom,   // 站点版由外部给（v3 默认贴地）
  /* ── v3 新增 ── */
  ambientKeep: 0,           // 保留多少 MMD 环境色灰雾：0 = 完全去掉（通透），1 = 保持原样
  groundPad:   0.004,       // 脚底距容器底边的余量（容器高度的占比）
  /* ── v4 新增 ── */
  freeDrag:    true,        // true = 可以把桌宠抱到空中（落体的前提）；false = 只能在地面左右挪
  freeFall:    true,        // 松手后进入自由落体；关掉则回到 v3 的「松手立刻贴地」
  /* ── v4.1 新增：整体亮度 ──
     三层各自独立、可单独关掉：光照（有方向，管明暗对比）→ 材质增益（等比提贴图）
     → 曝光（最后统一乘一个系数）。默认值由 _pet_lum.py 实测扫描得出，勿凭手感改。 */
  exposure:    1.05,        // 渲染曝光：1 = 不改动；>1 整体提亮（线性空间相乘后转 sRGB）
  matGain:     1.14,        // 材质（贴图）亮度增益：1 = 不改动
};

/* 姿态层：把所有「谁该转多少」的贡献收集起来，帧末一次性写入。
   ── v1 的 bug：updateLook 与 updateIdle 都直接写「上半身」，
      后写的整份覆盖前者 → 视线跟随的躯干分量被呼吸吃掉。
      v2 改成累加器，多来源对同一骨骼的贡献相加，且**只有一个地方**写四元数。 */
const rotAcc = new Map();   // name -> [rx, ry, rz]
const posAcc = new Map();   // name -> [dx, dy, dz]
function addRot(name, rx, ry, rz) {
  const a = rotAcc.get(name);
  if (a) { a[0] += rx; a[1] += ry; a[2] += rz; }
  else rotAcc.set(name, [rx, ry || 0, rz || 0]);
}
function addPos(name, dx, dy, dz) {
  const a = posAcc.get(name);
  if (a) { a[0] += dx; a[1] += dy; a[2] += dz; }
  else posAcc.set(name, [dx, dy || 0, dz || 0]);
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function flushPose() {
  rotAcc.forEach((a, name) => {
    const b = bones[name]; if (!b) return;                 // 骨骼不存在就跳过（换模型也不会崩）
    _q.setFromEuler(_e.set(a[0], a[1], a[2], 'YXZ'));
    b.quaternion.copy(b.userData.rest).multiply(_q);
  });
  posAcc.forEach((a, name) => {
    const b = bones[name]; if (!b) return;
    const r = b.userData.restPos;
    b.position.set(r.x + a[0], r.y + a[1], r.z + a[2]);
  });
  rotAcc.clear(); posAcc.clear();
}

/* ── 「脚踩地」取景（v3）──
   按填充率算出的相机会把模型**垂直居中**：最低点离容器底边还剩几个百分点，
   再叠上 CFG.petBottom，看起来就是整个角色悬在半空（站点版曾垫了 72px，悬得更明显）。
   这里把相机与视点同步上移，让包围盒的最低点正好压在容器底边。
   用二分而不是解方程：透视下「脚踭 / 脚尖」的投影不是 camY 的线性函数；
   80 次迭代只在加载时算一次，之后相机不再动（避免跟着动作一起抖）。 */
const GROUND_PTS = [];
let groundDist = 0, groundCamY = 0, groundBox = null, groundCtr = null, groundAspect = 0;
function frameGround(box, ctr, dist) {
  const spanY = box.max.y - box.min.y;
  groundDist = dist;
  GROUND_PTS.length = 0;
  for (let i = 0; i < 8; i++) {
    GROUND_PTS.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x,
                                      i & 2 ? box.max.y : box.min.y,
                                      i & 4 ? box.max.z : box.min.z));
  }
  const _v = new THREE.Vector3();
  const lowestNdcY = (camY) => {
    camera.position.set(ctr.x, camY, ctr.z + dist);
    camera.lookAt(ctr.x, camY, ctr.z);
    camera.updateMatrixWorld(true);
    let lo = 10;
    for (let i = 0; i < 8; i++) { _v.copy(GROUND_PTS[i]).project(camera); if (_v.y < lo) lo = _v.y; }
    return lo;
  };
  const target = -1 + CFG.groundPad;                  // NDC -1 = 容器底边
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  /* 牛顿迭代求 camY：透视投影下 y_ndc ≈ (py - camY) / (dist·tan(fov/2))，
     对 camY 是**线性**的 → 每一步都能直接算出精确修正量，3~5 次就收敛，
     比二分稳健（不依赖「初值区间必须夹住解」这个易错假设）。 */
  let camY = ctr.y;
  for (let i = 0; i < 10; i++) {
    const f = lowestNdcY(camY);
    const step = (f - target) * dist * tanHalf;
    camY += step;
    if (Math.abs(step) < 1e-4) break;
  }
  groundCamY = camY;
  camera.position.set(ctr.x, groundCamY, ctr.z + dist);
  camera.lookAt(ctr.x, groundCamY, ctr.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  groundBox = box; groundCtr = ctr; groundDist = dist; groundAspect = camera.aspect;
  probe.ground = { camY: +groundCamY.toFixed(3), dist: +dist.toFixed(3),
                   boxMinY: +box.min.y.toFixed(3), boxMaxY: +box.max.y.toFixed(3),
                   spanY: +spanY.toFixed(3), target: +target.toFixed(4),
                   aspect: +camera.aspect.toFixed(4), ctrY: +ctr.y.toFixed(3) };
}
/* 容器比例变了（CSS 断点改了尺寸 / follow换个容器）才需要重新取景；
   比例没变就不动相机，避免每帧抖动。 */
function reframeGround() {
  if (!groundBox || !groundCtr) return;
  if (Math.abs(camera.aspect - groundAspect) < 0.001) return;
  const size = groundBox.getSize(new THREE.Vector3());
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const FILL = 0.94, halfDepth = size.z / 2;
  const aspect = camera.aspect || 0.75;
  const distH = (size.y / (2 * half * FILL)) + halfDepth;
  const distW = (size.x / (2 * half * aspect * FILL)) + halfDepth;
  frameGround(groundBox, groundCtr, Math.max(distH, distW));
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. 渲染器 / 场景 / 相机 —— 透明背景的关键三行
   ═══════════════════════════════════════════════════════════════════════════ */
const host = opts.root;
if (host && !host.classList.contains('sui-pet')) host.classList.add('sui-pet');
const logs = [];
let dbg = { innerHTML: '', style: {} };            // 站点版默认没有调试面板 → 用空壳兜住 log()
if (opts.debug) {
  dbg = document.createElement('pre');
  dbg.id = 'suiPetDbg';
  dbg.style.cssText = 'position:fixed;left:10px;top:10px;z-index:9999;margin:0;padding:8px 10px;'
    + 'font:12px/1.5 ui-monospace,Consolas,monospace;color:#cfe0ff;background:rgba(10,12,22,.86);'
    + 'border:1px solid #39426a;border-radius:8px;pointer-events:none;max-width:min(520px,90vw);white-space:pre-wrap';
  document.body.appendChild(dbg);
}
function log(s) {
  logs.push(s);
  if (logs.length > 12) logs.shift();
  dbg.innerHTML = logs.join('\n');
}

const renderer = new THREE.WebGLRenderer({
  alpha: true,                 // ① 请求带 alpha 的帧缓冲
  antialias: true,
  premultipliedAlpha: false,   // ② 与 CSS 合成时用直通 alpha（更少暗边）
  powerPreference: 'high-performance',   // v3：原先写 low-power，会让浏览器优先挑集显
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CFG.dprMax));
renderer.setClearAlpha(0);                    // ③ 清屏 alpha = 0
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;            // 桌宠不开阴影：省一个 pass
renderer.outputColorSpace = THREE.SRGBColorSpace;
/* v4.1：LinearToneMapping = 单纯的「线性色 × exposure」，不改色彩关系、不压饱和
   （ACES/Reinhard 会把动漫风的高饱和色洗成灰，正好是我们不要的）。 */
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = CFG.exposure;
host.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
camera.position.set(0, 7.6, 20);
camera.lookAt(0, 6.6, 0);

// MMD 是 toon 着色，半球光 + 一盏主光足够，不需要环境贴图
/* v4.1：整体提亮（旧值 hemi .28 / key .72 / rim .24 / 无补光，实测角色像素均值只有 99.7、
   暗部占比 34.6% —— 在浅色页面上就是一团黑）。新值由亮度扫描实测挑定：
   均值 ~152、暗部占比 ~22%、p90 ~232（未削顶）。 */
const LIGHTS = { hemi: 0.55, key: 1.32, rim: 0.44, fill: 0.34, ground: 0xc9d2ea };
const hemi = new THREE.HemisphereLight(0xffffff, LIGHTS.ground, LIGHTS.hemi); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, LIGHTS.key); key.position.set(2, 12, 14); scene.add(key);
const rim = new THREE.DirectionalLight(0xcfe0ff, LIGHTS.rim); rim.position.set(-9, 5, -11); scene.add(rim);
/* v4.1：正面补光 —— key 在右上侧，角色的正面下半（裙摆、腿、胸前）会掉进暗部，
   这盏从相机方向打过去，只补正面暗部、不产生新的投影方向，暗部占比能压下去。 */
const fill = new THREE.DirectionalLight(0xffffff, LIGHTS.fill); fill.position.set(0, 6, 18); scene.add(fill);

/* ═══════════════════════════════════════════════════════════════════════════
   2. 加载 PMX
   ═══════════════════════════════════════════════════════════════════════════ */
let mesh = null, bones = {}, morphs = {}, boneList = [];
const T0 = performance.now();
const probe = window.__suiPet = { state: 'loading', errors: [], frames: 0, logs: logs, unknownMorphs: [] };

/* 贴图走 URL 改写：PMX 内部写的是 .png，站点版实际文件是 .webp。
   一个 resolveURL 钩子就能同时服务「换扩展名」和「换 CDN 前缀」，不用改模型。 */
const manager = new THREE.LoadingManager();
if (CFG.textureExt) {
  manager.setURLModifier((url) => /\.png(\?|$)/i.test(url) ? url.replace(/\.png(\?|$)/i, CFG.textureExt) : url);
}
probe.texSwap = !!CFG.textureExt;

new MMDLoader(manager).load(CFG.model, (m) => {
  mesh = m;
  scene.add(m);

  (m.skeleton ? m.skeleton.bones : []).forEach((b) => { bones[b.name] = b; boneList.push(b); });
  m.traverse((o) => {
    if (o.isMesh && o.morphTargetDictionary) {
      Object.keys(o.morphTargetDictionary).forEach((k) => { morphs[k] = o.morphTargetDictionary[k]; });
      probe.meshWithMorph = o;
    }
  });

  // 骨骼存下初始四元数/位移，动画在其基础上叠加，避免累积漂移
  boneList.forEach((b) => { b.userData.rest = b.quaternion.clone(); b.userData.restPos = b.position.clone(); });

  // 取景：按「填充率」反推相机距离（换模型无需改任何数字）
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  const ctr  = box.getCenter(new THREE.Vector3());
  const half  = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const aspect = camera.aspect || 0.75;
  const FILL = 0.94;
  const halfDepth = size.z / 2;
  const distH = (size.y / (2 * half * FILL)) + halfDepth;
  const distW = (size.x / (2 * half * aspect * FILL)) + halfDepth;
  const dist  = Math.max(distH, distW);
  frameGround(box, ctr, dist);              // v3：最低点（脚底）压到容器底边

  /* ── 画质修正：去掉 MMD「环境色」造成的均匀灰雾 ──
     three 的 MMDLoader 把 PMX 的 ambient（环境色）写进 material.emissive：
       MMDLoader.js → params.emissive = new Color().setRGB( ...material.ambient, SRGBColorSpace )
       若材质有贴图，再 multiplyScalar( 0.2 )。
     emissive 是**加性自发光、完全不受光照**，等于给每一个像素都压上一层固定值的灰。
     实测：这层灰把画面黑位从 10/255 抬到 84/255（约 +33% sRGB），
           暗部全部泛白 —— 这就是「发灰 / 像蒙了一层雾 / 不够通透」的根因。
     MMD 里它的本意是「背光也看得清」，但桌宠要的是对比鲜明，按 CFG.ambientKeep 折减。 */
  if (CFG.ambientKeep !== 1) {
    m.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => {
        if (mt && mt.emissive) mt.emissive.multiplyScalar(CFG.ambientKeep);
        // v4.1：给贴图一个整体增益（比单纯加光照更均匀，不会把对比度冲淡）
        if (CFG.matGain !== 1 && mt && mt.color) mt.color.multiplyScalar(CFG.matGain);
      });
    });
  }

  buildHairSprings();
  measureBindPose();          // v2：量出绑定姿态下关键骨骼的世界坐标，供姿态验证做基线
  measurePitchSign();         // v2：实测「低头」对应哪个旋转符号，避免凭推导搞反
  host.style.setProperty('--px', '0px');           // 先归零再量尺寸
  placeDefault();                                   // v2：初始位置（含 localStorage 恢复）

  bonesReady = true;
  probe.state = 'ready';
  probe.stats = {
    loadMs: Math.round(performance.now() - T0),
    bones: boneList.length, morphs: Object.keys(morphs).length,
    textures: renderer.info.memory.textures,
    hasBlink: !!(morphs['eye_close'] || morphs['eye_close_left']),
  };
  log('模型就绪 ' + probe.stats.loadMs + ' ms · 骨骼 ' + probe.stats.bones + ' · 形变 ' + probe.stats.morphs
    + '\n低头符号 PITCH=' + PITCH + '（实测）');
  probe.ready = true;
}, undefined, (e) => {
  probe.state = 'error'; probe.errors.push(String(e));
  log('加载失败 ' + e); probe.ready = true;
});

/* 绑定姿态基线：用于「姿态确实变了 / 变成什么样」的数值验证。
   必须在任何 addRot 之前、updateMatrixWorld 之后读。 */
const BIND_KEYS = ['センター', '下半身', '上半身', '首', '頭',
                   '左肩', '左腕', '左ひじ', '左手首', '左中指３',
                   '右肩', '右腕', '右ひじ', '右手首', '右中指３',
                   '左足', '左ひざ', '左足首', '左つま先',
                   '右足', '右ひざ', '右足首', '右つま先'];
function measureBindPose() {
  if (!mesh) return;
  mesh.updateMatrixWorld(true);
  const v = new THREE.Vector3(), out = {};
  BIND_KEYS.forEach((n) => { const b = bones[n]; if (b) out[n] = b.getWorldPosition(v).toArray().map(x => +x.toFixed(4)); });
  probe.bindPos = out;
}

/* 「低头看下方」到底是 +X 还是 -X？
   PMX 骨骼在 three 里是「位置有、旋转为单位」，所以局部轴 = 世界轴；
   但 PMX 建模习惯可能把首/頭轴向反着写，**推导容易搞错，直接做实验**：
   对 首+頭 施加 +0.3 rad，看头顶参考点（頭 的世界 +Y 方向）往 +Z 还是 -Z 走。
   +Z 是模型的正面方向（由 左つま先 的 z 比 左足首 大确定）。 */
let PITCH = 1;
function measurePitchSign() {
  if (!mesh || !bones['頭']) return;
  const head = bones['頭'], neck = bones['首'];
  const ref = new THREE.Vector3(0, 1.2, 0);            // 头顶上方一点（骨骼局部坐标）
  const qs = head.quaternion.clone(), qn = neck.quaternion.clone();
  const probeZ = (sign) => {
    _q.setFromEuler(_e.set(sign * 0.3, 0, 0, 'YXZ'));
    head.quaternion.copy(head.userData.rest).multiply(_q);
    if (neck) neck.quaternion.copy(neck.userData.rest).multiply(_q);
    head.updateMatrixWorld(true);
    const p = ref.clone().applyMatrix4(head.matrixWorld);
    head.quaternion.copy(qs); if (neck) neck.quaternion.copy(qn);
    head.updateMatrixWorld(true);
    return p.z;
  };
  const zp = probeZ(+1), zm = probeZ(-1);
  // 头顶往前（z 大）的那个符号 = 低头
  PITCH = zp > zm ? +1 : -1;
  probe.pitchSign = { plusZ: +zp.toFixed(4), minusZ: +zm.toFixed(4), PITCH };
  return PITCH;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. 形变（morph）分层系统
   ── v1 是「一个表情独占全部通道」；v2 改成多来源叠加：
      每个来源用 want(name, v) 提需求，帧末统一平滑写入，取最大值避免叠加爆掉。
   ═══════════════════════════════════════════════════════════════════════════ */
const morphWant = new Map();     // 本帧的需求（每帧清空重建）
const morphCur  = new Map();     // 当前已写入的值（带平滑）
const morphHard = new Set();     // 需要「瞬时」响应的通道（眨眼），不平滑
/* 名字写错会让形变**静默失效**（morphs[name] 是 undefined 就直接 return），
   这是最容易漏的一类 bug → 把所有查不到的形变名记下来，由测试断言「未知形变必须为空」 */
const unknownMorphs = new Set();
let bonesReady = false;
function noteUnknown(name) {
  if (!bonesReady) return;                        // 模型没就绪前不记（否则全是假阳性）
  if (!unknownMorphs.has(name)) { unknownMorphs.add(name); probe.unknownMorphs.push(name); }
}
function want(name, v) {
  if (v === undefined || v === null || v <= 0.0001) return;
  if (morphs[name] === undefined) { noteUnknown(name); return; }
  const c = morphWant.get(name);
  if (c === undefined || v > c) morphWant.set(name, v);
}
function setMorphHard(name, v) {                 // 直接写，走瞬时通道
  if (morphs[name] === undefined) { noteUnknown(name); return false; }
  morphWant.set(name, v);
  morphHard.add(name);
  morphCur.set(name, v);
  probe.meshWithMorph.morphTargetInfluences[morphs[name]] = v;
  return true;
}
function morphTick(dt) {
  const rate = 1 - Math.exp(-dt * 11);           // 指数平滑，帧率无关
  const keys = new Set();
  morphWant.forEach((_, k) => keys.add(k));
  morphCur.forEach((_, k) => keys.add(k));
  keys.forEach((k) => {
    const i = morphs[k]; if (i === undefined) return;
    const tgt = morphHard.has(k) ? morphWant.get(k) : (morphWant.get(k) || 0);
    let cur = morphCur.get(k) || 0;
    if (morphHard.has(k)) cur = tgt;
    else cur += (tgt - cur) * rate;
    if (Math.abs(cur) < 0.0015 && tgt === 0) { morphCur.delete(k); morphWant.delete(k);
      probe.meshWithMorph.morphTargetInfluences[i] = 0; morphHard.delete(k); return; }
    morphCur.set(k, cur);
    probe.meshWithMorph.morphTargetInfluences[i] = cur;
  });
  morphWant.clear(); morphHard.clear();
}
function blinkWrite(v) {                          // 优先用左右分离的眨眼，表情更自然
  let ok = setMorphHard('eye_close_left', v);
  ok = setMorphHard('eye_close_right', v) || ok;
  if (!ok) ok = setMorphHard('eye_close', v);
  return ok;
}

/* 表情预设（对外保留 v1 的 EXPR / playExpr 接口，测试与调用方不用改） */
const EXPR = [
  { name: '笑眼', m: { eye_joy: 1, eyebrow_joy: 0.55 } },
  { name: '高兴', m: { eye_happy: 1, mouth_a: 0.45, eyebrow_joy: 0.3 } },
  { name: '眯眼', m: { eye_nagomi: 1, mouth_ω: 0.5 } },
  { name: '生气', m: { eye_angry: 1, eyebrow_angry: 1, option_pout: 0.7 } },
  { name: '难过', m: { eye_sad: 1, eyebrow_sad: 1, option_tear1_left: 0.7, option_tear1_right: 0.7 } },
  { name: '困了', m: { eye_sleepy: 1, option_effect_sleepy: 0.8 } },
  { name: '张嘴', m: { 'vrc.v.aa': 0.9 } },
];
let exprIndex = -1, exprT = 0, exprDur = 0, exprSlot = 0;
const EYE_KEYS = /^(eye_|まばたき|ウィンク)/;      // 这些通道占用时不做自动眨眼
function playExpr(i, dur) {
  exprSlot = ((i % EXPR.length) + EXPR.length) % EXPR.length;
  exprIndex = exprSlot;                            // exprIndex 对外是「当前是否有表情」的标志
  exprT = 0; exprDur = dur || 1.4;
  probe.lastExpr = EXPR[exprSlot].name;
}
function updateExpr(dt) {
  if (exprIndex < 0) return 0;
  exprT += dt;
  const p = exprT / exprDur;
  const w = p < 0.18 ? p / 0.18 : (p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3));
  const m = EXPR[exprSlot].m;
  for (const k in m) want(k, m[k] * w);            // 结束时不再 want → 由 morphTick 平滑回落
  if (p >= 1) exprIndex = -1;
  return w;
}
function faceBusy() {
  if (exprIndex < 0) return false;
  for (const k in EXPR[exprSlot].m) if (EYE_KEYS.test(k)) return true;
  return false;
}

let blinkNext = 1.5, blinkT = -1;
function updateBlink(dt) {
  if (faceBusy()) { blinkWrite(0); return; }      // 表情里有眼型时让位
  if (blinkT >= 0) {
    blinkT += dt;
    const d = 0.13;
    blinkWrite(blinkT < d / 2 ? blinkT / (d / 2) : Math.max(0, 1 - (blinkT - d / 2) / (d / 2)));
    if (blinkT >= d) { blinkWrite(0); blinkT = -1; }
    return;
  }
  blinkNext -= dt;
  if (blinkNext <= 0) {
    blinkT = 0;
    const r = CFG.blinkEvery;
    blinkNext = r[0] + Math.random() * (r[1] - r[0]);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. 基础姿态：把 A-pose 改成自然站姿
   ── 旋转方向全部来自实测（_pose_probe_out.txt），不靠推导：
      · 左腕 z 负 → 手臂向下向内收；右腕镜像 z 正
      · 左ひじ x 负 → 小臂自然前屈
      · 左肩 z 负 → 肩下沉
      · 拇指/手指 z 负（左）→ 指关节弯曲
      · 左右镜像规律：x 同号，y/z 反号
   ═══════════════════════════════════════════════════════════════════════════ */
const FINGER_ROOTS = ['人指', '中指', '薬指', '小指'];
function fingerCurl(side, s, k) {                 // s: 左 -1 / 右 +1；k: 整体力度
  const out = [];
  FINGER_ROOTS.forEach((f) => {
    out.push([side + f + '１', 0, 0, s * 0.34 * k]);
    out.push([side + f + '２', 0, 0, s * 0.36 * k]);
    out.push([side + f + '３', 0, 0, s * 0.24 * k]);
  });
  out.push([side + '親指１', 0, 0, s * 0.20 * k]);
  out.push([side + '親指２', 0, 0, s * 0.26 * k]);
  return out;
}
const BASE_POSE = [
  ['左肩',   0.00, 0, -0.12], ['右肩',   0.00, 0, +0.12],   // 肩放松下沉
  ['左腕',   0.04, 0, -0.64], ['右腕',   0.04, 0, +0.64],   // 上臂放下（A-pose → 自然下垂）
  ['左ひじ', -0.26, 0, -0.06], ['右ひじ', -0.26, 0, +0.06], // 肘微屈，避免僵直
  ['左手首', 0.00, 0, -0.10], ['右手首', 0.00, 0, +0.10],   // 手腕内旋一点
  ['左足',   0.00, 0, -0.075], ['右足',   0.00, 0, +0.075], // 双脚收拢（原本是分开站）
  ['左足首', 0.00, 0, +0.075], ['右足首', 0.00, 0, -0.075], // 反向补偿，让脚掌保持水平
  ['上半身', 0.015, 0, 0], ['下半身', -0.010, 0, 0],        // 轻微前倾挺胸，不像木桩
];
// 预编译成扁平数组：每帧只做 Map 累加，不再拼字符串/建数组（对帧耗时敏感）
const POSE_BASE_FLAT = (() => {
  const out = BASE_POSE.map((r) => [r[0], r[1] || 0, r[2] || 0, r[3] || 0]);
  fingerCurl('左', -1, 1).forEach((r) => out.push([r[0], r[1], r[2], r[3]]));
  fingerCurl('右', +1, 1).forEach((r) => out.push([r[0], r[1], r[2], r[3]]));
  return out;
})();
function applyBasePose() {
  for (let i = 0; i < POSE_BASE_FLAT.length; i++) {
    const r = POSE_BASE_FLAT[i];
    addRot(r[0], r[1], r[2], r[3]);
  }
  // 调试用叠加层（正式路径恒为空）：probe.api.poke() 写这里，用来标定动作参数
  if (testOver.size) testOver.forEach((v, n) => addRot(n, v[0], v[1], v[2]));
}
const testOver = new Map();

/* ═══════════════════════════════════════════════════════════════════════════
   5. 头部 / 视线跟随鼠标
   ═══════════════════════════════════════════════════════════════════════════ */
const pointer = { x: 0, y: 0, inside: false, onModel: false };
let look = { yaw: 0, pitch: 0 };
let lookSpeed = 6;                                 // 悬停时加快响应

function updateLook(dt) {
  const r = renderer.domElement.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height * 0.30;
  let tx = 0, ty = 0;
  if (pointer.inside) {
    tx = THREE.MathUtils.clamp((pointer.x - cx) / (Math.max(innerWidth, 1) * 0.45), -1, 1);
    ty = THREE.MathUtils.clamp((pointer.y - cy) / (Math.max(innerHeight, 1) * 0.45), -1, 1);
  }
  const k = 1 - Math.exp(-dt * lookSpeed);
  look.yaw   += (tx - look.yaw) * k;
  look.pitch += (ty - look.pitch) * k;

  const H = CFG.headYawMax, P = CFG.headPitchMax;
  addRot('頭',      PITCH * look.pitch * P * 0.75, look.yaw * H, 0);
  addRot('首',      PITCH * look.pitch * P * 0.35, look.yaw * H * 0.45, 0);
  addRot('上半身2', PITCH * look.pitch * P * 0.16, look.yaw * H * 0.20, 0);
  addRot('上半身',  0, look.yaw * H * 0.12, 0);

  // 眼球：MMD 里用「平移」实现视线
  const ex = look.yaw * CFG.eyeYawMax, ey = PITCH * look.pitch * CFG.eyeYawMax * 0.7;
  ['両目', '左目', '右目'].forEach((n) => addPos(n, ex, ey, 0));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. 呼吸 / 重心偏移（让静置也不是死的）
   ═══════════════════════════════════════════════════════════════════════════ */
let t = 0;
function updateIdle(dt) {
  t += dt;
  if (!CFG.breathing || REDUCED) return;      // 减弱动效：连呼吸 / 重心摆动也停
  if (fall.st === 'drag' || fall.st === 'air') return;   // v4：被拎着 / 下落中不播 idle
  probe.idleTick = (probe.idleTick || 0) + 1;            // 供测试断言「idle 真的停了」
  // 呼吸：两条不同频率的正弦叠加 → 不会听出明显周期
  const br = Math.sin(t * 1.55) * 0.5 + Math.sin(t * 0.83 + 1.1) * 0.5;
  addRot('上半身', 0.012 * br, 0, 0.010 * br);
  addPos('センター', 0, br * 0.030, 0);
  // 重心微微左右移动（周期 ~8.7s）：站姿的「活气」主要来自这里
  const sw = Math.sin(t * 0.72 + 0.4);
  addRot('センター', 0, 0, sw * 0.020);
  addRot('下半身', 0, 0, -sw * 0.014);
  addRot('上半身', 0, 0, sw * 0.012);
  addRot('首', 0, 0, -sw * 0.016);                  // 头部反向补偿 → 头保持竖直
  addPos('センター', sw * 0.030, 0, 0);
  // 手臂随呼吸轻摆
  addRot('左腕', 0, 0, Math.sin(t * 1.31 + 0.5) * 0.028);
  addRot('右腕', 0, 0, -Math.sin(t * 1.31 + 0.5) * 0.028);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. 动作系统
   ── 每个动作是一个纯函数 tick(p, dt)，往姿态/形变累加器里加料。
      这样动作之间天然可叠加、可中断，不需要为每个动作管理一套状态机。
   ═══════════════════════════════════════════════════════════════════════════ */
function ss(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
function win(p, up, down) {                        // 起-保-落包络
  up = up === undefined ? 0.22 : up; down = down === undefined ? 0.78 : down;
  if (p < up) return ss(p / up);
  if (p <= down) return 1;
  return ss(1 - (p - down) / (1 - down));
}
const ARM_L = '左腕', ARM_R = '右腕', ELB_L = '左ひじ', ELB_R = '右ひじ';
const SHO_L = '左肩', SHO_R = '右肩', WRI_L = '左手首', WRI_R = '右手首';

const ACTIONS = {
  /* 点头 —— 最轻的「我在听」 */
  nod: { dur: 0.9, label: '点头', tick(p) {
    const a = win(p, 0.12, 0.30) * 0.9 + (p > 0.30 && p < 0.72 ? ss(1 - (p - 0.30) / 0.42) * 0.35 : 0);
    addRot('首', PITCH * 0.17 * a, 0, 0);
    addRot('頭', PITCH * 0.24 * a, 0, 0);
    addRot('上半身2', PITCH * 0.05 * a, 0, 0);
  }},
  /* 歪头 —— 悬停时的默认反应，最「看人」的一个动作 */
  tilt: { dur: 1.5, label: '歪头', tick(p) {
    const a = win(p, 0.25, 0.75);
    addRot('頭', 0, 0, -0.22 * a);
    addRot('首', 0, 0, -0.11 * a);
    addRot('上半身2', 0, 0.04 * a, -0.05 * a);
    want('eye_nagomi', 0.6 * a);
  }},
  /* 东张西望 —— 用 s 形扫视，比单纯左右摆更自然 */
  lookAround: { dur: 2.8, label: '张望', tick(p) {
    const a = win(p, 0.18, 0.86);
    const s = Math.sin(p * Math.PI * 2.2);
    addRot('頭', 0, s * 0.40 * a, 0);
    addRot('首', 0, s * 0.22 * a, 0);
    addRot('上半身2', 0, s * 0.07 * a, 0);
    want('eye_kyoro', 0.75 * a);
    if (p > 0.35 && p < 0.5) want('eye_close_left', 0.9 * a);   // 顺带眨一下左眼
  }},
  /* 伸懒腰 / 打哈欠 —— 双臂上举 + 后仰 */
  stretch: { dur: 2.4, label: '伸懒腰', tick(p) {
    const a = win(p, 0.30, 0.62);
    addRot(ARM_L, -0.10 * a, 0, +2.10 * a);     // 双臂举过头侧（_cal_wave2 的 S1）
    addRot(ARM_R, -0.10 * a, 0, -2.10 * a);
    addRot(ELB_L, +0.20 * a, 0, -0.10 * a);
    addRot(ELB_R, +0.20 * a, 0, +0.10 * a);
    addRot(SHO_L, 0, 0, +0.30 * a);
    addRot(SHO_R, 0, 0, -0.30 * a);
    addRot('上半身', -0.07 * a, 0, 0);
    addRot('下半身', +0.04 * a, 0, 0);
    addRot('首', -PITCH * 0.10 * a, 0, 0);
    want('eye_sleepy', 0.85 * a);
    want('mouth_a', 0.7 * a);
    want('eyebrow_joy', 0.4 * a);
  }},
  /* 挥手 —— 举左手，小臂左右摆 */
  wave: { dur: 2.0, label: '挥手', tick(p) {
    const a = win(p, 0.16, 0.82);
    const s = Math.sin(p * Math.PI * 5.0);
    addRot(ARM_L, -0.05 * a, 0, +1.55 * a);     // 上臂抬过水平（_cal_wave 标定，候选 B/F）
    addRot(ELB_L, +1.22 * a, 0, s * 0.30 * a);  // 肘上弯 ~90°，再左右摆 → 挥手（_cal_wave2 的 W1↔W3）
    addRot(WRI_L, 0, 0, s * 0.30 * a);
    addRot(SHO_L, 0, 0, +0.30 * a);
    addRot('上半身2', 0, 0.06 * a, -0.05 * a);
    addRot('首', PITCH * -0.05 * a, 0, -0.10 * a);
    want('eye_joy', 0.95 * a);
    want('eyebrow_joy', 0.6 * a);
    want('にっこり', 0.8 * a);
  }},
  /* 高兴 —— 原地弹两下 */
  happy: { dur: 1.6, label: '高兴', tick(p) {
    const a = win(p, 0.14, 0.70);
    const b = Math.abs(Math.sin(p * Math.PI * 2.6)) * a;
    addPos('センター', 0, b * 0.16, 0);
    addRot('下半身', -b * 0.05, 0, 0);
    addRot('上半身', b * 0.04, 0, 0);
    addRot(ARM_L, 0, 0, +0.24 * b);
    addRot(ARM_R, 0, 0, -0.24 * b);
    addRot('左ひざ', PITCH * 0.10 * b, 0, 0);
    addRot('右ひざ', PITCH * 0.10 * b, 0, 0);
    want('eye_joy', 0.95 * a);
    want('eyebrow_joy', 0.7 * a);
    want('にっこり', 0.85 * a);
    want('option_cheek1', 0.35 * a);
  }},
  /* 害羞 —— 低头 + 脸红 + 手臂夹紧 */
  shy: { dur: 2.2, label: '害羞', tick(p) {
    const a = win(p, 0.35, 0.70);
    addRot('首', PITCH * 0.20 * a, 0, 0);
    addRot('頭', PITCH * 0.16 * a, 0, -0.08 * a);
    addRot(ARM_L, 0, 0, -0.16 * a);
    addRot(ARM_R, 0, 0, +0.16 * a);
    addRot(ELB_L, -0.22 * a, 0, 0);
    addRot(ELB_R, -0.22 * a, 0, 0);
    addRot('上半身2', 0, 0, 0.05 * a);
    want('頬染め', 1.0 * a);
    want('option_cheek2', 0.75 * a);
    want('eye_nagomi', 0.7 * a);
    want('mouth_ω', 0.5 * a);
  }},
  /* 生气 —— 抱臂感 + 摇头 + 鼓嘴 */
  angry: { dur: 1.9, label: '生气', tick(p) {
    const a = win(p, 0.14, 0.72);
    const s = Math.sin(p * Math.PI * 6.2);
    addRot('頭', 0, s * 0.24 * a, 0);
    addRot('首', 0, s * 0.13 * a, 0);
    addRot('上半身2', 0, s * 0.05 * a, 0);
    addRot(ARM_L, 0, 0, +0.10 * a);
    addRot(ARM_R, 0, 0, -0.10 * a);
    addRot(ELB_L, -0.55 * a, 0, 0);
    addRot(ELB_R, -0.55 * a, 0, 0);
    addRot(SHO_L, 0, 0, +0.14 * a);
    addRot(SHO_R, 0, 0, -0.14 * a);
    want('怒り', 1.0 * a);
    want('option_pout', 0.9 * a);
    want('eyebrow_angry', 1.0 * a);
    want('option_sweat1', 0.5 * (p > 0.5 ? 1 : 0));
  }},
  /* 惊讶 —— 极短、幅度大，作为「被抓起来 / 被点到」的第一反应 */
  surprise: { dur: 0.75, label: '惊讶', tick(p) {
    const a = win(p, 0.06, 0.34);
    addRot('首', -PITCH * 0.13 * a, 0, 0);
    addRot('頭', -PITCH * 0.16 * a, 0, 0);
    addRot('上半身', -0.06 * a, 0, 0);
    addRot(SHO_L, 0, 0, +0.30 * a);
    addRot(SHO_R, 0, 0, -0.30 * a);
    addRot(ARM_L, 0, 0, +0.22 * a);
    addRot(ARM_R, 0, 0, -0.22 * a);
    addPos('センター', 0, -0.06 * a, 0);
    want('びっくり', 1.0 * a);
    want('eye_OO', 0.9 * a);
    want('eyebrow_surprised', 0.9 * a);
    want('mouth_○', 0.7 * a);
    want('option_sweat1', 0.4 * a);
  }},
  /* 星星眼 —— 连点到第 5 下的奖励 */
  star: { dur: 1.8, label: '星星眼', tick(p) {
    const a = win(p, 0.16, 0.72);
    const b = Math.abs(Math.sin(p * Math.PI * 3.0)) * a;
    addPos('センター', 0, b * 0.10, 0);
    addRot('頭', 0, 0, Math.sin(p * Math.PI * 2) * 0.10 * a);
    addRot(ARM_L, 0, 0, +0.30 * b);
    addRot(ARM_R, 0, 0, -0.30 * b);
    addRot(ELB_L, -0.30 * a, 0, 0);
    addRot(ELB_R, -0.30 * a, 0, 0);
    want('eye_star', 1.0 * a);
    want('option_effect_star', 1.0 * a);
    want('にっこり', 0.9 * a);
    want('option_cheek1', 0.5 * a);
  }},
  /* 摇头（否认） */
  shakeHead: { dur: 1.5, label: '摇头', tick(p) {
    const a = win(p, 0.12, 0.78);
    const s = Math.sin(p * Math.PI * 5.0);
    addRot('頭', 0, s * 0.34 * a, 0);
    addRot('首', 0, s * 0.18 * a, 0);
    addRot('上半身2', 0, s * 0.06 * a, 0);
    want('eye_jitome', 0.6 * a);
    want('一文字', 0.7 * a);
  }},
  /* 小跳 */
  jump: { dur: 0.85, label: '小跳', tick(p) {
    const a = win(p, 0.10, 0.62);
    const air = Math.max(0, Math.sin(p * Math.PI * 1.35));      // 起跳抛物线
    addPos('センター', 0, air * 0.34 * a, 0);
    addRot('左ひざ', PITCH * 0.20 * air * a, 0, 0);
    addRot('右ひざ', PITCH * 0.20 * air * a, 0, 0);
    addRot(ARM_L, 0, 0, +0.34 * air * a);
    addRot(ARM_R, 0, 0, -0.34 * air * a);
    addRot('上半身', -0.05 * air * a, 0, 0);
    want('eye_joy', 0.85 * a);
    want('mouth_a', 0.6 * a);
  }},
  /* 打瞌睡（长按无互动后常驻） */
  sleepy: { dur: 1.0, loop: true, label: '打瞌睡', tick(p, dt) {
    const bob = Math.sin(t * 1.05) * 0.5 + 0.5;
    addRot('首', PITCH * 0.26 * bob, 0, 0);
    addRot('頭', PITCH * 0.20 * bob, 0, 0.09);
    addRot('上半身2', PITCH * 0.06 * bob, 0, 0);
    addRot(ARM_L, 0, 0, -0.05);
    addRot(ARM_R, 0, 0, +0.05);
    want('eye_sleepy', 1);
    want('option_effect_sleepy', 1);
    const mv = Math.floor((t * 0.55) % 3);
    want('option_effect_sleepy_move' + (mv + 1), 1);
    want('mouth_small', 0.5);
  }},
  /* 惊醒 */
  wakeup: { dur: 0.9, label: '惊醒', tick(p) {
    const a = win(p, 0.08, 0.45);
    const s = Math.sin(p * Math.PI * 3.2) * (1 - p);
    addRot('首', -PITCH * 0.14 * a + s * 0.05, 0, 0);
    addRot('頭', -PITCH * 0.12 * a, s * 0.20, 0);
    addRot('上半身', -0.05 * a, 0, 0);
    addPos('センター', 0, 0.05 * a, 0);
    want('eye_OO', 0.85 * a);
    want('eyebrow_surprised', 0.8 * a);
    want('mouth_○', 0.6 * a);
  }},
};

let act = null, actT = 0, actName = null;
function playAction(name) {
  const def = ACTIONS[name]; if (!def) return false;
  act = def; actT = 0; actName = name;
  probe.lastAction = def.label;
  probe.actionCount = (probe.actionCount || 0) + 1;
  return true;
}
function updateAction(dt) {
  if (!act) return;
  actT += dt;
  const p = act.loop ? ((actT % act.dur) / act.dur) : Math.min(1, actT / act.dur);
  act.tick(p, dt);
  if (!act.loop && p >= 1) { act = null; actName = null; }
}
/* 待机动作调度：小动作多、大动作少（权重表） */
const IDLE_POOL = [
  ['nod', 3], ['tilt', 3], ['lookAround', 3], ['shakeHead', 1],
  ['wave', 1], ['stretch', 1], ['shy', 1], ['jump', 1], ['star', 1], ['happy', 2],
];
const IDLE_TOTAL = IDLE_POOL.reduce((s, e) => s + e[1], 0);
function pickIdle() {
  let r = Math.random() * IDLE_TOTAL;
  for (const [n, w] of IDLE_POOL) { r -= w; if (r <= 0) return n; }
  return 'nod';
}
let idleNext = 3.5, idleCount = 0;
function updateIdleScheduler(dt) {
  if (sleeping || REDUCED) return;            // 减弱动效：不再自发播小动作
  idleNext -= dt;
  if (idleNext > 0) return;
  const r = CFG.idleEvery;
  idleNext = r[0] + Math.random() * (r[1] - r[0]);
  if (act || drag.on || fall.st === 'air' || fall.st === 'land') return;
  playAction(pickIdle());
  idleCount++;
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. 打瞌睡 / 唤醒
   ═══════════════════════════════════════════════════════════════════════════ */
let sleeping = false, lastTouch = 0;
function enterSleep() {
  if (sleeping) return;
  sleeping = true; act = null;
  playAction('sleepy'); act.loop = true;
  probe.slept = (probe.slept || 0) + 1;
}
function wake(why) {
  if (!sleeping) return;
  sleeping = false; act = null; actName = null;
  playAction('wakeup');
  probe.woke = (probe.woke || 0) + 1;
  probe.wokeBy = why;
}
function touch() { lastTouch = t; wake('touch'); }
function updateSleep(dt) {
  if (REDUCED) return;                        // 减弱动效：不打瞌睡（含头部点头）
  if (!sleeping && t - lastTouch > CFG.sleepAfter && !drag.on && !pointer.onModel
      && fall.st === 'stand') enterSleep();
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. 发丝 / 辫子的轻量弹簧（替代 MMD 刚体物理）
   ═══════════════════════════════════════════════════════════════════════════ */
const springs = [];
function buildHairSprings() {
  if (!CFG.springHair) return;
  [['前髪A', '前髪A先'], ['前髪B', '前髪B先'], ['前髪C', '前髪C先'],
   ['左側髪', '左側髪1', '左側髪2'], ['右側髪', '右側髪1'],
   ['马尾.L', '马尾1.L', '马尾2.L'], ['马尾.R', '马尾1.R', '马尾2.R'],
   ['马尾.L.001', '马尾.L.001先'], ['马尾.R.001', '马尾.R.001先'],
   ['马尾.L.002', '马尾.L.002先'], ['马尾.R.002', '马尾.R.002先'],
   ['帽子', '帽子先'], ['环', '环先']].forEach((chain) => {
    const bs = chain.map((n) => bones[n]).filter(Boolean);
    if (bs.length) springs.push({
      bones: bs,
      v: bs.map(() => new THREE.Vector2(0, 0)),
      off: bs.map(() => new THREE.Vector2(0, 0)),
    });
  });
  probe.springCount = springs.length;
}
const _dv = new THREE.Vector2();
function updateSprings(dt) {
  if (!springs.length) return;
  // 外部激励：拖动位移速度 + 转身速度 + 视线变化 → 头发被「甩」向反方向
  const ex = -drag.vel.yaw * 0.9 - look.yaw * 0.55 - drift.vx * 2.2;
  const ez = -drag.vel.pitch * 0.7 + drift.vy * 2.2 + Math.sin(t * 1.1) * 0.02;
  _dv.set(ex, ez);
  const stiff = 130, damp = 13;
  springs.forEach((s) => {
    for (let i = 0; i < s.bones.length; i++) {
      const w = 1 - i / (s.bones.length + 0.6);
      const v = s.v[i], o = s.off[i];
      v.x += ((_dv.x * w) - o.x * stiff) * dt;
      v.y += ((_dv.y * w) - o.y * stiff) * dt;
      v.x -= v.x * damp * dt;
      v.y -= v.y * damp * dt;
      o.x += v.x * dt;
      o.y += v.y * dt;
      const amp = 0.09 * w;
      addRot(s.bones[i].name, o.y * amp, 0, -o.x * amp);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. 位置：拖动移动 + 持久化
   ── v1：拖拽 = 原地转动模型。v2：拖拽 = 把模型搬到页面任意位置（用户要的），
      原地转动改为 Shift / Alt + 拖动。位置存 localStorage。
   ═══════════════════════════════════════════════════════════════════════════ */
const STORE_KEY = 'suipet:pos';
const pos = { x: 0, y: 0 };                        // 当前左上角（px，视口坐标系）
let posHome = { x: 0, y: 0 };                      // 初始角落
function petSize() {
  /* v4：容器带 rotate/scale 变换后 getBoundingClientRect 返回的是**变换后**的 AABB，
     直接用会让「地面」随翻滚角抖动 —— 所以尺寸一律取布局尺寸（不受 transform 影响）。 */
  return { w: host.offsetWidth || 0, h: host.offsetHeight || 0 };
}
function clampPos(x, y) {
  const { w, h } = petSize();
  // 允许挂出去一半（桌宠的自然形态），但至少留 55% 在视口内，保证抓得回来
  const minX = -w * 0.45, maxX = Math.max(minX, innerWidth - w * 0.55);
  const minY = -h * 0.45, maxY = Math.max(minY, innerHeight - h * 0.55);
  return [THREE.MathUtils.clamp(x, minX, maxX), THREE.MathUtils.clamp(y, minY, maxY)];
}
/* 「地面」的屏幕纵坐标 = 容器底边贴在窗口底部（留 CFG.petBottom 的余量）。
   窗口尺寸一变这个值就变 → 所以必须是个函数、每次 setPos 都重算，
   不能存成常量，否则缩放窗口后脚会离开地面或陷到屏幕外。 */
function groundY() {
  const h = petSize().h;
  return innerHeight - h - CFG.petBottom;
}
function clampX(x) {
  const w = petSize().w;
  // v3：贴地模式下角色必须完整可见（用户要求「不越界」），不允许像 freeDrag 那样挂出去一半
  return THREE.MathUtils.clamp(x, 0, Math.max(0, innerWidth - w));
}
function applyPos() {
  const h = petSize().h;
  const q = Math.max(0, Math.min(1, fall.sq));
  const sy = 1 - q * 0.10, sx = 1 + q * 0.07;
  // 压扁后底边会往上缩 h(1-sy)/2，把容器整体下移同样距离 → 脚始终踩在原地上
  const dy = h * (1 - sy) / 2;
  host.style.setProperty('--px', pos.x.toFixed(1) + 'px');
  host.style.setProperty('--py', (pos.y + dy).toFixed(1) + 'px');
  host.style.setProperty('--rot', fall.spin.toFixed(4) + 'rad');
  host.style.setProperty('--sx', sx.toFixed(4));
  host.style.setProperty('--sy', sy.toFixed(4));
}
function setPos(x, y, save) {
  // v3：默认「站在地上」—— 只能在地面这条线上左右挪，Y 恒等于地面。
  //     CFG.freeDrag = true 时回到旧的自由拖动（但仍受边界约束，且松手会被 gravity 拉回地面）。
  const c = CFG.freeDrag ? clampPos(x, y) : [clampX(x), groundY()];
  pos.x = c[0]; pos.y = c[1];
  applyPos();
  if (save) { try { localStorage.setItem(STORE_KEY, JSON.stringify({ x: pos.x, y: pos.y })); } catch (e) {} }
}
function placeDefault() {
  const { w, h } = petSize();
  posHome = { x: innerWidth - w - CFG.petMargin, y: groundY() };
  let p = null;
  try { p = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
  if (p && isFinite(p.x) && isFinite(p.y)) {
    /* v4.1 定位修复：垂直位置一律按「当前尺寸」重算回窗口底边（groundY()）。
       否则改尺寸后，旧存档里按旧高度算出的 p.y 会把桌宠悬在半空或埋到屏外；
       水平方向仍沿用存档，保留用户偏好的左右位置。 */
    setPos(clampX(p.x), groundY(), false);
  } else {
    setPos(posHome.x, posHome.y, false);   // 首次出现：固定脚踩窗口底边、右下角
  }
  probe.pos = { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), home: posHome };
}
function resetPos() { setPos(posHome.x, posHome.y, true); }

/* 拖动时的「甩动」惯性：位置速度 → 头发与身体的滞后感 */
const drift = { vx: 0, vy: 0, lagX: 0, lagY: 0 };

/* ═══════════════════════════════════════════════════════════════════════════
   11. 交互：拖动 / 点击连击 / 悬停 / 双击
   ═══════════════════════════════════════════════════════════════════════════ */
const drag = {
  on: false, mode: null,            // 'move' | 'turn'
  lastX: 0, lastY: 0, grabX: 0, grabY: 0,
  originX: 0, originY: 0,
  yaw: 0, pitch: 0, baseYaw: 0, basePitch: 0,
  vel: { yaw: 0, pitch: 0 }, bounce: 0, bounceV: 0,
  moved: 0,
};
const YAW_LIMIT = 0.9, PITCH_LIMIT = 0.35;

/* ═══════════════════════════════════════════════════════════════════════════
   11.5  v4：拖拽释放后的自由落体
   ── 状态机：stand（站立·贴地）→ drag（被拎着）→ air（自由落体）→ land（落地缓冲）→ stand
      位置与速度都在「屏幕像素 / 秒」量纲里积分，与渲染解耦。
      两个防抖关键：① 物理用 ≤1/120s 的子步长细分，低帧率下也不会一帧穿过地面；
      ② 法向速度低于 restV 就直接判定静止，杜绝无限微弹。
   ═══════════════════════════════════════════════════════════════════════════ */
const PHYS = {
  g:          2600,    // 重力加速度（px/s²）—— 视觉重力，一次下落约 0.5~0.9s
  airDrag:    0.55,    // 空气阻尼（v *= e^(-k·dt)），抑制无限加速
  vMax:       3600,    // 终端速度上限（px/s）
  spinGain:   0.0042,  // 下落速度 → 角速度（rad/s per px/s）：掉得越快转得越猛
  spinSide:   0.0055,  // 水平甩出速度 → 角速度
  spinMax:    7.5,     // 角速度上限（rad/s）
  spinTrack:  10,      // 角速度追踪目标值的快慢（时间常数 ~100ms：太慢则一次下落追不上）
  spinOnFall: false,   // v4.1：下落过程中是否翻滚 —— false = 保持原本姿态垂直落下
  bounce:     0.15,    // 触地法向反弹系数（v4.1：0.36 → 0.15，只要一点缓冲，不要皮球感）
  wallBounce: 0.45,    // 撞左右 / 顶部边界的反弹系数
  friction:   0.70,    // 触地切向摩擦（保留比例）
  restV:      280,     // 法向速度低于此值即判定静止 —— 防止无限微弹（抖动主要来源）
                       // v4.1：95 → 280，最多弹一次（0.15×落速 < 280）就进缓冲，
                       // 视觉上是「落地缓冲一下」而不是「皮球弹两下」
  squash:     0.60,    // 落地挤压强度（0~1）
  squashHz:   15,      // 挤压回弹频率（Hz）—— 太高一帧就弹完，慢帧率下看不见
  squashDamp: 9,       // 挤压回弹阻尼
  landSpin:   13,      // 落地后翻滚角归零速度
  landTime:   0.55,    // 落地缓冲时长（s），之后恢复 stand
  subStep:    1 / 120, // 物理子步长上限（s）
  throwMax:   2400,    // 松手初速度上限（px/s）
};
const fall = { st: 'stand', vx: 0, vy: 0, spin: 0, spinV: 0,
               sq: 0, sqV: 0, landT: 0, bounces: 0, airT: 0 };
probe.fall = fall;

/* 旋转后的轴对齐外接框：碰撞与落地判定一律用它，保证「完整可见 + 不穿地」 */
function aabbNow() {
  const { w, h } = petSize();
  const c = Math.abs(Math.cos(fall.spin)), s = Math.abs(Math.sin(fall.spin));
  return { cx: pos.x + w / 2, cy: pos.y + h / 2,
           aw: w * c + h * s, ah: w * s + h * c, w: w, h: h };
}
function setCenter(cx, cy) { const s2 = petSize(); pos.x = cx - s2.w / 2; pos.y = cy - s2.h / 2; }
function groundLine() { return innerHeight - CFG.petBottom; }

/* 挤压（squash & stretch）弹簧：落地给一个初值，自己弹回 0 */
function squashStep(h) {
  const K = PHYS.squashHz * PHYS.squashHz;
  fall.sqV -= fall.sq * K * h;
  fall.sqV -= fall.sqV * PHYS.squashDamp * h;
  fall.sq += fall.sqV * h;
  if (fall.sq < 0) { fall.sq = 0; fall.sqV = 0; }
}
function toLand() {
  fall.st = 'land'; fall.landT = 0;
  const impact = Math.abs(fall.vy);
  fall.vx = 0; fall.vy = 0;
  // 翻滚角先归一到 [-π,π] 再插值回 0 —— 否则转了 3 圈会倒着转回去（很难看）
  fall.spin = Math.atan2(Math.sin(fall.spin), Math.cos(fall.spin));
  fall.spinV = 0;
  fall.sq = Math.max(fall.sq, Math.min(0.95, impact / 1800 * PHYS.squash));
  fall.sqV = 0;
  drag.bounceV = 0.10 + Math.min(0.22, impact / 9000);   // 身体也沉一下
  probe.landings = (probe.landings || 0) + 1;
  const a = aabbNow();
  setCenter(a.cx, groundLine() - a.ah / 2);              // 外接框底边压在地面上
}
function airStep(h) {
  fall.airT += h;
  fall.vy += PHYS.g * h;
  const d = Math.exp(-PHYS.airDrag * h);
  fall.vx *= d; fall.vy *= d;
  if (fall.vy > PHYS.vMax) fall.vy = PHYS.vMax;
  if (fall.vy < -PHYS.vMax) fall.vy = -PHYS.vMax;

  if (REDUCED || !PHYS.spinOnFall) {              // 减弱动效 / v4.1 关翻滚：照常落回地面，姿态不变
    fall.spinV = 0; fall.spin = 0;
  } else {
    const dir = fall.vx >= 0 ? -1 : 1;            // 往右甩 → 屏幕内顺时针
    const tgt = THREE.MathUtils.clamp(
      dir * (Math.abs(fall.vx) * PHYS.spinSide + Math.abs(fall.vy) * PHYS.spinGain),
      -PHYS.spinMax, PHYS.spinMax);
    fall.spinV += (tgt - fall.spinV) * (1 - Math.exp(-h * PHYS.spinTrack));
    fall.spin += fall.spinV * h;
  }

  pos.x += fall.vx * h;
  pos.y += fall.vy * h;

  let a = aabbNow();
  const gnd = groundLine();
  if (a.cy + a.ah / 2 >= gnd) {                    // ── 地面 ──
    if (fall.vy > PHYS.restV) {
      setCenter(a.cx, gnd - a.ah / 2);
      const hit = fall.vy;
      fall.vy = -hit * PHYS.bounce;
      fall.vx *= PHYS.friction;
      // v4.1：关翻滚时连「触地随机扭一下」也不要 —— 姿态自始至终不变
      fall.spinV = PHYS.spinOnFall ? -fall.spinV * 0.30 + (Math.random() - 0.5) * 1.0 : 0;
      fall.sq = Math.max(fall.sq, Math.min(0.95, hit / 1800 * PHYS.squash));
      fall.bounces++;
      probe.lastBounce = +hit.toFixed(0);
      a = aabbNow();
    } else { toLand(); return; }                   // 速度太小 → 直接进缓冲，不再弹
  }
  if (a.cy - a.ah / 2 < 0 && fall.vy < 0) {        // ── 顶部 ──
    setCenter(a.cx, a.ah / 2);
    fall.vy = -fall.vy * PHYS.wallBounce;
    fall.spinV *= 0.7;
    a = aabbNow();
  }
  const half = a.aw / 2;                           // ── 左右 ──
  let lo = half, hi = innerWidth - half;
  if (lo > hi) { lo = hi = innerWidth / 2; }       // 窄屏时无解 → 退化到居中，避免来回抖
  // 位置 clamp 无条件做（保证不越界）；反弹与旋转衰减只在**确实撞上去**时才发生 ——
  // 否则贴着墙垂直下落会被每帧判定为撞墙，旋转被压死（桌宠默认就在右下角，必现）。
  if (a.cx < lo) {
    setCenter(lo, a.cy);
    if (fall.vx < 0) { fall.vx = Math.abs(fall.vx) * PHYS.wallBounce; fall.spinV *= 0.6; }
  } else if (a.cx > hi) {
    setCenter(hi, a.cy);
    if (fall.vx > 0) { fall.vx = -Math.abs(fall.vx) * PHYS.wallBounce; fall.spinV *= 0.6; }
  }
}
function landStep(h) {
  fall.landT += h;
  fall.spin += (0 - fall.spin) * (1 - Math.exp(-h * PHYS.landSpin));
  if (Math.abs(fall.spin) < 0.004) fall.spin = 0;
  let a = aabbNow();
  setCenter(a.cx, groundLine() - a.ah / 2);        // 随 spin 连续收敛 → 脚不会跳
  const half = a.aw / 2;
  let lo = half, hi = innerWidth - half;
  if (lo > hi) { lo = hi = innerWidth / 2; }
  a = aabbNow();
  if (a.cx < lo) setCenter(lo, a.cy);
  else if (a.cx > hi) setCenter(hi, a.cy);
  if (fall.landT >= PHYS.landTime && fall.spin === 0) {
    fall.st = 'stand';
    const w = petSize().w;
    const cx = THREE.MathUtils.clamp(aabbNow().cx, w / 2, Math.max(w / 2, innerWidth - w / 2));
    setPos(cx - w / 2, groundY(), true);           // 落地存盘：位置是「站定」的位置
    probe.settled = (probe.settled || 0) + 1;
  }
}
function updatePhysics(dt) {
  if (fall.st === 'stand') return;
  if (fall.st === 'drag') {
    // 被拎着：速度随时间衰减（停住不动再松手，不该把人甩出去）
    const k = Math.exp(-dt * 4.5);
    fall.vx *= k; fall.vy *= k;
    applyPos();
    return;
  }
  const n = Math.max(1, Math.min(12, Math.ceil(dt / PHYS.subStep)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    if (fall.st === 'air') { airStep(h); squashStep(h); }
    else if (fall.st === 'land') { landStep(h); squashStep(h); }
  }
  applyPos();
}
/* 松手 → 进入落体（或原地缓冲） */
function release() {
  if (!CFG.freeFall) {
    fall.st = 'stand'; fall.vx = fall.vy = 0;
    setPos(clampX(pos.x), groundY(), true);
    return;
  }
  fall.vx = THREE.MathUtils.clamp(fall.vx, -PHYS.throwMax, PHYS.throwMax);
  fall.vy = THREE.MathUtils.clamp(fall.vy, -PHYS.throwMax, PHYS.throwMax);
  const a = aabbNow();
  // 本来就在地上、又没被甩 → 直接缓冲，不进 air（否则会看到一次无意义的「贴地弹跳」）
  if (a.cy + a.ah / 2 >= groundLine() - 2 && Math.abs(fall.vy) < 60) { toLand(); return; }
  fall.st = 'air'; fall.airT = 0; fall.bounces = 0;
  // v4.1：下落全程保持原姿态 —— 不因甩出速度赋任何初始角速度
  fall.spinV = PHYS.spinOnFall
    ? THREE.MathUtils.clamp((fall.vx >= 0 ? -1 : 1) * Math.abs(fall.vx) * PHYS.spinSide * 0.7,
                            -PHYS.spinMax * 0.6, PHYS.spinMax * 0.6)
    : 0;
  probe.drops = (probe.drops || 0) + 1;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hitModel(clientX, clientY) {
  if (!mesh) return false;
  const cv = renderer.domElement;
  const r = cv.getBoundingClientRect();          // 旋转后这是 AABB，但中心与容器中心重合
  let dx = clientX - (r.left + r.width / 2);
  let dy = clientY - (r.top + r.height / 2);
  if (fall.spin) {                                // v4：逆旋转回「未旋转」的容器局部坐标
    const co = Math.cos(-fall.spin), si = Math.sin(-fall.spin);
    const lx = dx * co - dy * si; dy = dx * si + dy * co; dx = lx;
  }
  const w = cv.offsetWidth || r.width, h = cv.offsetHeight || r.height;
  if (Math.abs(dx) > w / 2 || Math.abs(dy) > h / 2) return false;
  ndc.x = dx / (w / 2);
  ndc.y = -(dy / (h / 2));
  ray.setFromCamera(ndc, camera);
  return ray.intersectObject(mesh, true).length > 0;
}

let hoverT = 0, hovered = false;
/* 悬停是一个**持续层**，不是一次性动作 ——
   鼠标停在模型上就一直歪头看着你，移开就慢慢放平。
   做成一次性动作会和正在播的动作抢通道（实测：刚点完「高兴」时悬停完全没反应）。 */
let hoverA = 0;
function updateHover(dt) {
  const tgt = hovered ? 1 : 0;
  hoverA += (tgt - hoverA) * (1 - Math.exp(-dt * (hovered ? 4.5 : 3)));
  if (hoverA < 0.002) { hoverA = 0; hoverT = 0; probe.blushed = false; probe.hoverA = 0; return; }
  addRot('頭', 0, 0, -0.20 * hoverA);
  addRot('首', 0, 0, -0.10 * hoverA);
  addRot('上半身2', 0, 0.03 * hoverA, -0.05 * hoverA);
  want('eye_nagomi', 0.50 * hoverA);
  probe.hoverA = +hoverA.toFixed(3);
  /* 停久了脸红：只上腮红通道，不占眼型通道 → 不影响眨眼 */
  if (hovered) {
    hoverT += dt;
    if (hoverT > CFG.hoverBlush) {
      const a = Math.min(1, (hoverT - CFG.hoverBlush) / 1.4);
      want('頬染め', 0.75 * a);
      want('option_cheek1', 0.45 * a);
      probe.blushed = true;
    }
  }
}
on(window, 'pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
  if (!drag.on) {
    // —— 点击穿透：指针落在模型上才让画布接管事件，其余时刻页面照常可点
    const on = hitModel(e.clientX, e.clientY);
    if (on !== pointer.onModel) {
      pointer.onModel = on;
      host.classList.toggle('live', on);
      if (on && !hovered) {                        // 悬停进入：抬头看你（持续层，见 updateHover）
        hovered = true; hoverT = 0;
        lookSpeed = 11;
        touch();
        probe.hoverIn = (probe.hoverIn || 0) + 1;
      } else if (!on && hovered) {
        hovered = false; lookSpeed = 6;
        probe.hoverOut = (probe.hoverOut || 0) + 1;
      }
    }
  }
  if (!drag.on) return;
  const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
  drag.lastX = e.clientX; drag.lastY = e.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.mode === 'move') {
    setPos(drag.originX + (e.clientX - drag.grabX), drag.originY + (e.clientY - drag.grabY), false);
    // v4：记录瞬时速度供松手抛出 —— 指数平滑，单帧抖动不会让抛出速度乱跳
    const now = performance.now();
    const hdt = Math.max(0.008, Math.min(0.1, (now - (drag.moveT || now)) / 1000));
    drag.moveT = now;
    fall.vx = fall.vx * 0.55 + (dx / hdt) * 0.45;
    fall.vy = fall.vy * 0.55 + (dy / hdt) * 0.45;
    drift.vx = THREE.MathUtils.clamp(dx * 0.05, -0.6, 0.6);
    drift.vy = THREE.MathUtils.clamp(dy * 0.05, -0.6, 0.6);
  } else {
    drag.yaw   = THREE.MathUtils.clamp(drag.baseYaw + (e.clientX - drag.grabX) * 0.011, -YAW_LIMIT, YAW_LIMIT);
    drag.pitch = THREE.MathUtils.clamp(drag.basePitch + (e.clientY - drag.grabY) * 0.007, -PITCH_LIMIT, PITCH_LIMIT);
    drag.vel.yaw = dx * 0.011; drag.vel.pitch = dy * 0.007;
  }
});

/* 交互入口放在 document 的**捕获阶段**，而不是画布上 ——
   触摸设备没有「先移动再按下」这一步，画布因为 pointer-events:none 永远收不到第一个 tap
   （v2 验证实测：触摸点击完全失效，v1 也有这个问题，只是旧断言写得太松）。
   捕获阶段统一 hit-test：命中模型 → 桌宠处理并吞掉事件；未命中 → 完全放行，页面照常可点。 */
on(document, 'pointerdown', (e) => {
  if (!mesh || !hitModel(e.clientX, e.clientY)) return;
  touch();
  pointer.onModel = true; host.classList.add('live');   // 触摸路径没有 pointermove，这里补上
  drag.on = true;
  fall.st = 'drag'; fall.vx = 0; fall.vy = 0; fall.spinV = 0;   // v4：被拎起来了
  drag.moveT = performance.now();
  drag.mode = (e.shiftKey || e.altKey) ? 'turn' : 'move';
  drag.moved = 0;
  drag.lastX = drag.grabX = e.clientX;
  drag.lastY = drag.grabY = e.clientY;
  drag.originX = pos.x; drag.originY = pos.y;
  drag.baseYaw = drag.yaw; drag.basePitch = drag.pitch;
  host.classList.add('dragging');
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {}
  if (drag.mode === 'move' && (!act || act.loop)) playAction('surprise');   // 被抓住的第一反应
  probe.dragStart = (probe.dragStart || 0) + 1;
  e.stopPropagation();     // 不让下层元素也收到这一下
  e.preventDefault();
}, true);
/* 触摸起点落在模型上时阻止页面滚动，否则拖桌宠会带着页面一起滚 */
on(document, 'touchstart', (e) => {
  const tp = e.touches && e.touches[0];
  if (!tp) return;
  if (hitModel(tp.clientX, tp.clientY)) e.preventDefault();
}, { capture: true, passive: false });
function endDrag(e) {
  if (!drag.on) return;
  const wasMove = drag.mode === 'move';
  drag.on = false;
  host.classList.remove('dragging');
  drift.vx = drift.vy = 0;
  if (drag.moved < 5) {                            // 位移很小 → 视为单击
    onClick();
  } else if (wasMove) {
    release();      // v4：带初速度抛出 → 自由落体（最终一定会站回地面，绝不悬空）
  }
  probe.dragEnd = (probe.dragEnd || 0) + 1;
}
/* pointerup/cancel 挂 window：入口已经不在画布上，事件不会再落到画布 */
on(window, 'pointerup', endDrag);
on(window, 'pointercancel', endDrag);
on(window, 'pointerleave', () => { pointer.inside = false; });

/* 单击连击：逐级升级，第 6 下生气（有趣的负反馈） */
const CLICK_CHAIN = [
  { act: 'happy',    face: 0, say: '高兴' },
  { act: 'nod',      face: 1, say: '点头' },
  { act: 'wave',     face: 0, say: '挥手' },
  { act: 'stretch',  face: 2, say: '伸懒腰' },
  { act: 'star',     face: 1, say: '星星眼' },
  { act: 'angry',    face: 3, say: '生气了（点太多了）' },
];
let combo = 0, comboT = 0;
function onClick() {
  touch();
  if (t - comboT > CFG.comboReset) combo = 0;
  comboT = t;
  const step = CLICK_CHAIN[Math.min(combo, CLICK_CHAIN.length - 1)];
  combo++;
  playExpr(step.face, 1.6);
  playAction(step.act);
  drag.bounceV = 0.34;
  probe.clicks = (probe.clicks || 0) + 1;
  probe.combo = combo;
  probe.lastClickStep = step.say;
}
renderer.domElement.addEventListener('dblclick', (e) => {
  touch();
  resetPos();                                      // 双击 = 回家
  playAction('happy');
  playExpr(0, 1.6);
  probe.resets = (probe.resets || 0) + 1;
  e.preventDefault();
});

/* ═══════════════════════════════════════════════════════════════════════════
   12. 拖拽惯性 / 转身 / 落地弹跳 / 位置滞后
   ═══════════════════════════════════════════════════════════════════════════ */
function updateDrag(dt) {
  // 位置惯性（松手后滑行一点）+ 滞后
  drift.lagX += (drift.vx - drift.lagX) * (1 - Math.exp(-dt * 8));
  drift.lagY += (drift.vy - drift.lagY) * (1 - Math.exp(-dt * 8));
  drift.vx *= Math.exp(-dt * 6); drift.vy *= Math.exp(-dt * 6);
  if (drag.mode === 'move' && drag.on) {
    // 被拎着时：身体轻微滞后（模拟重心在下方）
    addRot('上半身2', 0, -drift.lagX * 0.10, drift.lagX * 0.06);
    addRot('首', 0, -drift.lagX * 0.06, 0);
    addRot(ARM_L, 0, 0, +0.16 + drift.vy * 0.25);
    addRot(ARM_R, 0, 0, -0.16 - drift.vy * 0.25);
    addRot('左ひざ', PITCH * 0.10, 0, 0);
    addRot('右ひざ', PITCH * 0.10, 0, 0);
  }
  if (!drag.on) {
    const decay = Math.exp(-dt * 4.2);
    drag.vel.yaw *= decay; drag.vel.pitch *= decay;
    if (Math.abs(drag.vel.yaw) > 1e-4) {
      drag.yaw = THREE.MathUtils.clamp(drag.yaw + drag.vel.yaw * dt * 12, -YAW_LIMIT, YAW_LIMIT); drag.baseYaw = drag.yaw;
    }
    if (Math.abs(drag.vel.pitch) > 1e-4) {
      drag.pitch = THREE.MathUtils.clamp(drag.pitch + drag.vel.pitch * dt * 12, -PITCH_LIMIT, PITCH_LIMIT); drag.basePitch = drag.pitch;
    }
    if (Math.abs(drag.yaw) > 0.001) { drag.yaw *= (1 - dt * 0.35); drag.baseYaw = drag.yaw; }
    if (Math.abs(drag.pitch) > 0.001) { drag.pitch *= (1 - dt * 0.35); drag.basePitch = drag.pitch; }
  }
  // 落地弹跳（临界阻尼近似，不过冲）
  drag.bounceV -= drag.bounce * 120 * dt;
  drag.bounceV -= drag.bounceV * 9 * dt;
  drag.bounce += drag.bounceV * dt;
  if (drag.bounce < 0) { drag.bounce = 0; drag.bounceV = 0; }

  const root = bones['全ての親'];
  if (root) {
    addRot('全ての親', 0, drag.yaw + look.yaw * 0.10 + drift.lagX * 0.12, 0);
    addRot('グルーブ', drag.pitch * 0.6, 0, -drift.lagY * 0.10);
  }
  addPos('センター', 0, -drag.bounce * 0.5, 0);
}

/* v4：空中团身 / 落地缓冲 —— 纯姿态层，与位置物理解耦，只往累加器里加 */
function updateFallPose() {
  if (fall.st === 'air') {
    const f = Math.min(1, Math.abs(fall.vy) / 1300);      // 掉得越快，姿态越夸张
    addRot('上半身', PITCH * 0.16 * (0.4 + f), 0, 0);
    addRot(ARM_L, 0, 0, -0.75 - 0.55 * f);                // 双手上扬（失衡）
    addRot(ARM_R, 0, 0, 0.75 + 0.55 * f);
    addRot(ELB_L, 0.45 * f, 0, 0);
    addRot(ELB_R, 0.45 * f, 0, 0);
    addRot('左ひざ', PITCH * -0.40 * f, 0, 0);            // 屈膝团身
    addRot('右ひざ', PITCH * -0.40 * f, 0, 0);
    addRot('首', PITCH * -0.10 * f, 0, 0);
    addPos('センター', 0, -0.02 * f, 0);
  } else if (fall.st === 'land') {
    const k = Math.max(0, 1 - fall.landT / PHYS.landTime); // 1 → 0：蹲下 → 站直
    const q = fall.sq;                                     // 挤压量（弹簧）
    addRot('左ひざ', PITCH * (0.34 * q + 0.16 * k), 0, 0);
    addRot('右ひざ', PITCH * (0.34 * q + 0.16 * k), 0, 0);
    addRot('上半身', PITCH * (0.22 * q + 0.10 * k), 0, 0);
    addRot(ARM_L, 0, 0, -(0.45 * k + 0.25 * q));
    addRot(ARM_R, 0, 0, (0.45 * k + 0.25 * q));
    addPos('センター', 0, -0.035 * q, 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. 渲染循环：按需降频 + 页面隐藏即停（桌宠常驻，这一条最关键）
   ═══════════════════════════════════════════════════════════════════════════ */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let visible = true, last = performance.now(), acc = 0, frameNo = 0;
let winT0 = performance.now(), winN = 0, winWork = 0, winRaf = 0;

if ('IntersectionObserver' in window) {
  io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
  io.observe(host);
}
on(document, 'visibilitychange', () => { if (!document.hidden) last = performance.now(); });

function frame(now) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  probe.rafCount = (probe.rafCount || 0) + 1;
  const raw = (now - last) / 1000; last = now;
  if (document.hidden || !visible) return;                 // 不可见 → 完全不渲染

  // v4：空中/落地缓冲期间也算 active —— 掉帧会让落体看起来一顿一顿
  const active = drag.on || pointer.onModel || act !== null || exprIndex >= 0
                 || fall.st !== 'stand';
  probe.capFps = active ? CFG.activeFps : CFG.idleFps;   // 暴露「当前档位」，供在 rAF 被压住的环境里断言
  const cap = 1 / probe.capFps;
  acc += raw;
  if (acc < cap) return;                                    // 空闲降到 30fps
  const dt = Math.min(acc, 0.1); acc = 0;

  const ms0 = performance.now();

  /* ── 姿态组装顺序很重要：基础姿态 → 呼吸/重心 → 动作 → 视线 → 拖拽 → 头发 ──
     所有来源都只往累加器里加，帧末由 flushPose() 一次写入。 */
  updateSleep(dt);
  updatePhysics(dt);         // v4：位置 / 速度 / 翻滚 / 状态机（内部子步进）
  applyBasePose();
  updateIdle(dt);
  updateIdleScheduler(dt);
  updateAction(dt);
  updateLook(dt);
  updateHover(dt);          // 悬停持续层（歪头 + 久停脸红）
  updateDrag(dt);
  updateFallPose();
  updateSprings(dt);
  flushPose();

  if (!REDUCED) { updateExpr(dt); updateBlink(dt); } else { blinkWrite(0); }
  morphTick(dt);

  if (mesh) mesh.updateMatrixWorld(true);
  renderer.render(scene, camera);
  winWork += performance.now() - ms0;
  winN++; frameNo++;
  probe.frames = frameNo;

  const el = now - winT0;
  if (el >= 1000 && winN) {
    probe.renderFps = +(winN * 1000 / el).toFixed(1);
    probe.rafFps = +((probe.rafCount - (winRaf || 0)) * 1000 / el).toFixed(1);
    probe.fps = probe.renderFps; probe.frameMs = +(winWork / winN).toFixed(2);
    winRaf = probe.rafCount;
    probe.workMs = +(winWork / winN).toFixed(2);
    winT0 = now; winN = 0; winWork = 0;
  }

  if (frameNo % 15 === 0) {
    log('渲染 ' + (probe.renderFps || '—') + ' fps / 单帧 ' + (probe.workMs || '—') + ' ms'
      + '\n绘制 ' + renderer.info.render.calls + ' · 三角 ' + renderer.info.render.triangles.toLocaleString()
      + '\n位置 (' + pos.x.toFixed(0) + ',' + pos.y.toFixed(0) + ') · 动作 ' + (probe.lastAction || '—')
      + '\n连击 ' + combo + (sleeping ? ' · 打瞌睡中' : '') + (drag.on ? ' · 拖拽中' : '')
      + (probe.blushed ? ' · 脸红' : ''));
  }
}

function resize() {
  const r = petSize();                             // 布局尺寸（不受 rotate/scale 影响）
  if (!r.w || !r.h) return;
  renderer.setSize(r.w, r.h, false);
  camera.aspect = r.w / r.h;
  camera.updateProjectionMatrix();
  reframeGround();                                 // 容器比例变了要重算取景
  if (fall.st === 'stand') {
    // 站立态：完整可见 + 贴地 —— freeDrag 的「允许挂出 45%」只在拖拽中生效，
    // 否则窄视口下桌宠会停在窗外（不越界是站立态的硬要求）
    const w2 = petSize().w;
    setPos(THREE.MathUtils.clamp(pos.x, 0, Math.max(0, innerWidth - w2)), groundY(), false);
  } else {
    setPos(pos.x, pos.y, false);   // 空中 / 缓冲中保留当前高度，交给物理继续收敛
  }
}
on(window, 'resize', resize);
placeDefaultStub();
function placeDefaultStub() {                       // 模型加载前先摆好，避免首帧闪在左上角
  const r = petSize();
  if (!r.w) return;
  posHome = { x: innerWidth - r.w - CFG.petMargin, y: groundY() };
  pos.x = posHome.x; pos.y = posHome.y;
  applyPos();
}
resize();
rafId = requestAnimationFrame(frame);

// H 键隐藏调试面板（截图与上线用）
on(window, 'keydown', (e) => {
  if (!opts.debug) return;
  if (e.key === 'h' || e.key === 'H') dbg.style.display = dbg.style.display === 'none' ? '' : 'none';
});
probe.setLights = (h, k, r) => {
  LIGHTS.hemi = h; LIGHTS.key = k; LIGHTS.rim = r;
  hemi.intensity = h; key.intensity = k; rim.intensity = r;
  return LIGHTS;
};
/* v4.1：调光总入口 —— 光照 / 补光 / 地面色 / 曝光 / 材质增益一次设完，供亮度扫描用 */
probe.tune = (o) => {
  o = o || {};
  if (o.hemi !== undefined) { LIGHTS.hemi = o.hemi; hemi.intensity = o.hemi; }
  if (o.key  !== undefined) { LIGHTS.key  = o.key;  key.intensity  = o.key; }
  if (o.rim  !== undefined) { LIGHTS.rim  = o.rim;  rim.intensity  = o.rim; }
  if (o.fill !== undefined) { LIGHTS.fill = o.fill; fill.intensity = o.fill; }
  if (o.ground !== undefined) { LIGHTS.ground = o.ground; hemi.groundColor.setHex(o.ground); }
  if (o.exposure !== undefined) { CFG.exposure = o.exposure; renderer.toneMappingExposure = o.exposure; }
  if (o.matGain !== undefined) {
    const prev = CFG.matGain || 1;
    if (mesh) mesh.traverse((x) => {
      if (!x.isMesh) return;
      (Array.isArray(x.material) ? x.material : [x.material]).forEach((mt) => {
        if (mt && mt.color) mt.color.multiplyScalar(o.matGain / prev);
      });
    });
    CFG.matGain = o.matGain;
  }
  return { lights: LIGHTS, exposure: CFG.exposure, matGain: CFG.matGain };
};
/* 采样画布像素：返回不透明像素的平均亮度与 alpha 总量 */
probe.cfg = CFG;                                  // 测试要能开关 freeFall / 调参
probe.phys = () => ({
  st: fall.st, vx: +fall.vx.toFixed(1), vy: +fall.vy.toFixed(1),
  spin: +fall.spin.toFixed(4), spinV: +fall.spinV.toFixed(3),
  sq: +fall.sq.toFixed(4), bounces: fall.bounces, landT: +fall.landT.toFixed(3),
  pos: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1) },
  groundY: +groundY().toFixed(1), innerH: innerHeight,
});
probe.sample = () => {
  renderer.render(scene, camera);
  const c = renderer.domElement;
  const off = document.createElement('canvas');
  off.width = c.width; off.height = c.height;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(c, 0, 0);
  const d = ctx.getImageData(0, 0, off.width, off.height).data;
  let n = 0, sum = 0, sa = 0, maxA = 0, dark = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    sa += a; if (a > maxA) maxA = a;
    if (a > 128) {
      n++;
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += l;
      hist[l < 0 ? 0 : l > 255 ? 255 : l | 0]++;
      if (l < 60) dark++;                    // 暗部：几乎看不清细节的那部分
    }
  }
  const q = (frac) => {                      // 分位数：p10 太黑 = 闷，p90 太白 = 过曝
    let acc = 0; const want = n * frac;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= want) return v; }
    return 255;
  };
  return { opaquePx: n, mean: n ? +(sum / n).toFixed(1) : 0,
           p10: n ? q(0.10) : 0, p50: n ? q(0.50) : 0, p90: n ? q(0.90) : 0,
           darkRatio: n ? +(dark / n).toFixed(3) : 0,
           alphaRatio: +(sa / (255 * (d.length / 4))).toFixed(4), maxAlpha: maxA };
};
probe.fill = () => {
  if (!mesh) return null;
  const b = new THREE.Box3().setFromObject(mesh);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    pts.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y,
                               i & 4 ? b.max.z : b.min.z).project(camera));
  }
  const xs = pts.map(p => (p.x + 1) / 2), ys = pts.map(p => (1 - p.y) / 2);
  return { w: +(Math.max(...xs) - Math.min(...xs)).toFixed(3),
           h: +(Math.max(...ys) - Math.min(...ys)).toFixed(3),
           x0: +Math.min(...xs).toFixed(3), y0: +Math.min(...ys).toFixed(3),
           x1: +Math.max(...xs).toFixed(3), y1: +Math.max(...ys).toFixed(3) };
};
/* 头顶参考点（頭 骨骼局部 +Y 方向 1.2 处）的世界坐标：
   用来判定「低头 / 抬头」到底往哪边转 —— v1 的俯仰跟随方向是反的，必须能被测出来 */
probe.headRef = () => {
  const h = bones['頭']; if (!h) return null;
  h.updateMatrixWorld(true);
  const p = new THREE.Vector3(0, 1.2, 0).applyMatrix4(h.matrixWorld);
  return p.toArray().map(x => +x.toFixed(4));
};
/* v2：骨骼世界坐标 + 姿态比值 —— 姿态是否真的改了，用数字说话 */
probe.boneWorld = (name) => {
  const b = bones[name]; if (!b) return null;
  const v = new THREE.Vector3(); b.getWorldPosition(v);
  return v.toArray().map(x => +x.toFixed(4));
};
probe.poseStats = () => {
  if (!mesh || !probe.bindPos) return null;
  mesh.updateMatrixWorld(true);
  const B = probe.bindPos, now = {};
  BIND_KEYS.forEach((n) => { const w = probe.boneWorld(n); if (w) now[n] = w; });
  const ax = (n) => Math.abs(now[n][0]);
  const bx = (n) => Math.abs(B[n][0]);
  return {
    // 手臂：横向收进来多少（<1 表示收进来了）、往下掉了多少
    handSpanRatio: +(ax('左手首') / bx('左手首')).toFixed(3),
    handDrop:      +(B['左手首'][1] - now['左手首'][1]).toFixed(3),
    handX:         +now['左手首'][0].toFixed(3),
    handY:         +now['左手首'][1].toFixed(3),
    shoulderY:     +now['左腕'][1].toFixed(3),
    // 双手是否对称（左右镜像应几乎重合）
    mirrorDX:      +Math.abs(now['左手首'][0] + now['右手首'][0]).toFixed(4),
    mirrorDY:      +Math.abs(now['左手首'][1] - now['右手首'][1]).toFixed(4),
    // 脚：是否并拢
    footSpanRatio: +(ax('左足首') / bx('左足首')).toFixed(3),
    footZ:         +now['左足首'][2].toFixed(3),
    toeZ:          +now['左つま先'][2].toFixed(3),
    // 手指弯曲：指尖到手腕的距离应比绑定姿态更短
    fingerReach:   +new THREE.Vector3(...now['左中指３']).distanceTo(new THREE.Vector3(...now['左手首'])).toFixed(3),
    fingerReachBind: +new THREE.Vector3(...B['左中指３']).distanceTo(new THREE.Vector3(...B['左手首'])).toFixed(3),
    // 整体
    headY: +now['頭'][1].toFixed(3), centerY: +now['センター'][1].toFixed(3),
    raw: now, bind: B,
  };
};

/* ── 画质 / 性能诊断出口（不改场景，只做观测）── */
probe.eachMat = (fn) => {                     // 批量改材质做 A/B 对照（如：把自发光归零看是否还发灰）
  if (!mesh) return 0;
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    arr.forEach((mt) => { if (mt) { fn(mt, o); n++; } });
  });
  return n;
};
probe.diag = () => {
  const gl = renderer.getContext();
  const attr = gl.getContextAttributes ? gl.getContextAttributes() : {};
  const v2 = renderer.getSize(new THREE.Vector2());
  const mats = [];
  probe.eachMat((mt) => {
    mats.push({
      name: mt.name || '(匿名)', type: mt.type,
      map: !!mt.map, mapCS: mt.map ? mt.map.colorSpace : null,
      matcap: !!mt.matcap, gradientMap: !!mt.gradientMap,
      emissive: mt.emissive ? [+mt.emissive.r.toFixed(4), +mt.emissive.g.toFixed(4), +mt.emissive.b.toFixed(4)] : null,
      color: mt.color ? mt.color.getHexString() : null,
      transparent: mt.transparent, opacity: mt.opacity,
      blending: mt.blending, side: mt.side, fog: mt.fog,
      depthWrite: mt.depthWrite, alphaTest: mt.alphaTest, shininess: mt.shininess,
    });
  });
  let geo = null;
  if (probe.meshWithMorph) {
    const g = probe.meshWithMorph.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    geo = {
      verts: g.attributes.position ? g.attributes.position.count : 0,
      tris: g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0),
      attrs: Object.keys(g.attributes),
      morphAttrs: g.morphAttributes.position ? g.morphAttributes.position.length : 0,
      minY: +bb.min.y.toFixed(3), maxY: +bb.max.y.toFixed(3),
    };
  }
  return {
    renderer: {
      calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
      memTex: renderer.info.memory.textures, memGeo: renderer.info.memory.geometries,
      programs: renderer.info.programs ? renderer.info.programs.length : null,
      pixelRatio: renderer.getPixelRatio(), size: [v2.x, v2.y],
      outputColorSpace: renderer.outputColorSpace,
      toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
      antialias: !!attr.antialias, alpha: !!attr.alpha, premul: !!attr.premultipliedAlpha,
      depth: !!attr.depth, stencil: !!attr.stencil,
    },
    scene: { fog: scene.fog ? (scene.fog.type || 'fog') : null, bg: scene.background ? 'set' : null },
    lights: { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity, cfg: LIGHTS },
    camera: { fov: camera.fov, aspect: +camera.aspect.toFixed(4), pos: camera.position.toArray().map(n => +n.toFixed(3)) },
    frame: { renderFps: probe.renderFps, rafFps: probe.rafFps, workMs: probe.workMs, frames: probe.frames },
    geo: geo, meshes: 0, fill: probe.fill(), materials: mats,
  };
};

// 给自动化测试用的探针
probe.api = {
  /* v1 兼容：api.drag 仍然只做「转身」，方便旧的拖拽测试继续有意义 */
  drag: (dx, dy) => {
    drag.yaw = THREE.MathUtils.clamp(drag.yaw + dx * 0.011, -YAW_LIMIT, YAW_LIMIT);
    drag.pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.007, -PITCH_LIMIT, PITCH_LIMIT);
  },
  expr: (i) => playExpr(i, 1.4),
  clearFace: () => { exprIndex = -1; },          // 清掉正在播的表情（测试用）
  blinkNow: () => { blinkT = 0; },               // 立刻眨一次（不靠随机等待）
  action: (n) => playAction(n),
  actions: () => Object.keys(ACTIONS),
  move: (x, y) => setPos(x, y, true),
  poke: (name, x, y, z) => testOver.set(name, [x, y, z] || 0),
  clearPoke: () => testOver.clear(),
  pokeMap: () => Array.from(testOver.entries()),
  moveBy: (dx, dy) => setPos(pos.x + dx, pos.y + dy, true),
  reset: () => resetPos(),
  click: () => onClick(),
  hover: (on) => { hovered = !!on; hoverT = 0; lookSpeed = on ? 11 : 6;
                   if (on) { pointer.onModel = true; host.classList.add('live'); }
                   else { pointer.onModel = false; host.classList.remove('live'); } },
  sleep: () => enterSleep(),
  wake: () => wake('api'),
  pose: () => probe.poseStats(),
  pos: () => ({ x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), home: posHome }),
  state: () => ({ yaw: +drag.yaw.toFixed(4), pitch: +drag.pitch.toFixed(4),
                  lookYaw: +look.yaw.toFixed(4), lookPitch: +look.pitch.toFixed(4),
                  onModel: pointer.onModel, live: host.classList.contains('live'),
                  blinkT: +blinkT.toFixed(3), exprIndex,
                  influence: probe.meshWithMorph ?
                    +probe.meshWithMorph.morphTargetInfluences[morphs['eye_joy'] || 0].toFixed(3) : null,
                  camDist: +camera.position.distanceTo(mesh ? mesh.position : new THREE.Vector3()).toFixed(2),
                  renderFps: probe.renderFps, workMs: probe.workMs,
                  /* v2 新增 */
                  action: actName, sleeping, combo, hovered, dragging: drag.on, dragMode: drag.mode,
                  fallSt: fall.st, spin: +fall.spin.toFixed(4), sq: +fall.sq.toFixed(4),
                  pos: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1) } }),
  phys: () => probe.phys(),
  hitTest: (x, y) => hitModel(x, y),          // 验证「旋转后命中判定仍然正确」
  setSpin: (v) => { fall.spin = v; applyPos(); return +fall.spin.toFixed(4); },
  idleTick: () => probe.idleTick || 0,
  /* 测试钩子：直接把桌宠摆到某处并以 (vx,vy) 抛出 */
  lift: (x, y) => { fall.st = 'drag'; setPos(x, y === undefined ? pos.y : y, false);
                    return { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1) }; },
  drop: (vx, vy) => { fall.vx = vx || 0; fall.vy = vy || 0; release(); return fall.st; },
};
/* ═══════════════════════════════════════════════════════════════════════════
   卸载：停帧 → 摘监听 → 释放 GPU 资源 → 移除容器
   ═══════════════════════════════════════════════════════════════════════════ */
function destroy() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  offAll();
  if (io) { io.disconnect(); io = null; }
  if (dbg && dbg.parentNode) dbg.parentNode.removeChild(dbg);
  if (mesh) mesh.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((mt) => {
      if (!mt) return;
      ['map', 'alphaMap', 'gradientMap', 'emissiveMap', 'matcap'].forEach((k) => {
        if (mt[k] && mt[k].dispose) mt[k].dispose();
      });
      if (mt.dispose) mt.dispose();
    });
  });
  renderer.dispose();
  if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  if (window.__suiPet === probe) delete window.__suiPet;
  if (host) { host.style.removeProperty('--px'); host.style.removeProperty('--py'); host.innerHTML = ''; }
  probe.state = 'destroyed';
  probe.ready = false;
}

return { probe: probe, api: probe.api, destroy: destroy, version: '2.0.0' };
}
