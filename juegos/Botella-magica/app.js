const canvas = document.querySelector('#bottleCanvas');
const context = canvas.getContext('2d', { alpha: false });

const ui = {
  welcome: document.querySelector('#welcome'),
  start: document.querySelector('#startBtn'),
  calibrate: document.querySelector('#calibrateBtn'),
  fullscreen: document.querySelector('#fullscreenBtn'),
  pause: document.querySelector('#pauseBtn'),
  pauseLabel: document.querySelector('#pauseBtn strong'),
  statusText: document.querySelector('#statusText'),
  statusDot: document.querySelector('#statusDot'),
  tiltMarker: document.querySelector('#tiltMarker'),
  guard: document.querySelector('#orientationGuard'),
  guardTitle: document.querySelector('#guardTitle'),
  guardText: document.querySelector('#guardText'),
  toast: document.querySelector('#toast'),
  themes: [...document.querySelectorAll('.theme-button')]
};

const THEMES = {
  ocean: {
    name: 'Océano',
    skyTop: '#061b2a',
    skyBottom: '#0b3545',
    liquidTop: '#69e5e3',
    liquidMid: '#1687a2',
    liquidBottom: '#07425f',
    glow: '#8ff7ee',
    floor: '#0c5670',
    fill: 0.19,
    wave: 4.6,
    drag: 0.958,
    objects: ['fish', 'star', 'seahorse', 'shell', 'fish', 'pearl', 'seahorse', 'bubble']
  },
  beach: {
    name: 'Playa',
    skyTop: '#2a160d',
    skyBottom: '#4d2816',
    liquidTop: '#ffd98c',
    liquidMid: '#e99b54',
    liquidBottom: '#9a5033',
    glow: '#ffe6ad',
    floor: '#c98143',
    fill: 0.2,
    wave: 3.2,
    drag: 0.952,
    objects: ['crab', 'star', 'turtle', 'shell', 'crab', 'pebble', 'turtle', 'glass', 'sandDollar']
  },
  meadow: {
    name: 'Pradera',
    skyTop: '#0b211b',
    skyBottom: '#1c3b26',
    liquidTop: '#b6ea85',
    liquidMid: '#63a85f',
    liquidBottom: '#265b45',
    glow: '#d9f5a3',
    floor: '#315d35',
    fill: 0.2,
    wave: 3.8,
    drag: 0.955,
    objects: ['butterfly', 'flower', 'ladybug', 'leaf', 'bee', 'acorn', 'beetle', 'butterfly']
  }
};

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: 1,
  bottle: null,
  theme: 'ocean',
  objects: [],
  motes: [],
  effects: [],
  ripples: [],
  draggedObject: null,
  dragPointerId: null,
  dragSample: null,
  lastDragEffect: 0,
  touchHintShown: false,
  scareHintShown: false,
  started: false,
  paused: false,
  sensorListening: false,
  sensorSeen: false,
  motionSeen: false,
  lastMotionAt: 0,
  permissionDenied: false,
  lastSensor: null,
  gravity: { x: 0, y: 0 },
  targetGravity: { x: 0, y: 0 },
  liquidGravity: { x: 0, y: 1 },
  targetLiquidGravity: { x: 0, y: 1 },
  pointerDown: false,
  lastTime: performance.now(),
  toastTimer: 0,
  wakeLock: null,
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  lowPower: navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches,
  orientationBlocked: false,
  resizeScheduled: false
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
const hasTouchInput = () => navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;

const OBJECT_NAMES = {
  fish: 'pez',
  seahorse: 'caballito de mar',
  star: 'estrella de mar',
  shell: 'concha',
  pearl: 'perla',
  bubble: 'burbuja',
  pebble: 'piedra',
  glass: 'cristal de mar',
  sandDollar: 'dólar de arena',
  sun: 'sol',
  crab: 'cangrejo',
  turtle: 'tortuga',
  leaf: 'hoja',
  flower: 'flor',
  ladybug: 'chinita',
  acorn: 'bellota',
  butterfly: 'mariposa',
  bee: 'abeja',
  beetle: 'escarabajo'
};

const EFFECT_STYLES = {
  fish: { shape: 'bubble', color: '#a9fff4' },
  seahorse: { shape: 'bubble', color: '#b8e8ff' },
  star: { shape: 'spark', color: '#ffe48b' },
  shell: { shape: 'ring', color: '#ffd0bb' },
  pearl: { shape: 'spark', color: '#e4deff' },
  bubble: { shape: 'bubble', color: '#c1fff7' },
  pebble: { shape: 'sand', color: '#e7b875' },
  glass: { shape: 'spark', color: '#8fe8da' },
  sandDollar: { shape: 'sand', color: '#f0dfbd' },
  sun: { shape: 'spark', color: '#ffd061' },
  crab: { shape: 'sand', color: '#f39a6d' },
  turtle: { shape: 'ring', color: '#9fd28a' },
  leaf: { shape: 'leaf', color: '#bce57b' },
  flower: { shape: 'petal', color: '#f1a7cd' },
  ladybug: { shape: 'spark', color: '#f27c66' },
  acorn: { shape: 'leaf', color: '#bb8756' },
  butterfly: { shape: 'petal', color: '#f0bbdf' },
  bee: { shape: 'spark', color: '#ffd45f' },
  beetle: { shape: 'leaf', color: '#8ccf79' }
};

const SPRITE_ATLASES = {
  ocean: {
    src: './assets/sprites-oceano.png?v=2',
    cells: {
      fish: [[0, 0], [1, 0]],
      seahorse: [[0, 1], [1, 1]]
    },
    image: null,
    ready: false
  },
  beach: {
    src: './assets/sprites-playa.png?v=2',
    cells: {
      crab: [[0, 0], [1, 0]],
      turtle: [[0, 1], [1, 1]]
    },
    image: null,
    ready: false
  },
  meadow: {
    src: './assets/sprites-pradera.png?v=2',
    cells: {
      butterfly: [[0, 0]],
      ladybug: [[1, 0]],
      bee: [[0, 1]],
      beetle: [[1, 1]]
    },
    image: null,
    ready: false
  }
};

const PASSIVE_ATLAS = {
  src: './assets/sprites-objetos.png',
  cells: {
    star: [0, 0],
    shell: [1, 0],
    pearl: [2, 0],
    pebble: [0, 1],
    glass: [1, 1],
    sandDollar: [2, 1],
    leaf: [0, 2],
    flower: [1, 2],
    acorn: [2, 2]
  },
  image: null,
  ready: false
};

const ELONGATED_PASSIVE_SPRITES = new Set(['shell', 'leaf', 'glass', 'acorn']);

function loadThemeAtlas(themeName) {
  const atlas = SPRITE_ATLASES[themeName];
  if (!atlas || atlas.image) return;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => { atlas.ready = true; };
  image.onerror = () => { atlas.ready = false; };
  image.src = atlas.src;
  atlas.image = image;
}

function loadPassiveAtlas() {
  if (PASSIVE_ATLAS.image) return;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => { PASSIVE_ATLAS.ready = true; };
  image.onerror = () => { PASSIVE_ATLAS.ready = false; };
  image.src = PASSIVE_ATLAS.src;
  PASSIVE_ATLAS.image = image;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function scheduleResize() {
  if (state.resizeScheduled) return;
  state.resizeScheduled = true;
  window.requestAnimationFrame(() => {
    state.resizeScheduled = false;
    resizeCanvas();
  });
}

function resizeCanvas() {
  const previousInner = state.bottle?.inner;
  const previousVertical = state.bottle?.vertical;
  const viewport = window.visualViewport;
  state.width = Math.round(viewport ? viewport.width : window.innerWidth);
  state.height = Math.round(viewport ? viewport.height : window.innerHeight);
  const area = state.width * state.height;
  const maximumDpr = state.lowPower
    ? (area > 500_000 ? 1.25 : 1.5)
    : (area > 1_000_000 ? 1.5 : 1.75);
  state.dpr = Math.min(window.devicePixelRatio || 1, maximumDpr);
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const portrait = state.height > state.width;
  const sideControls = state.width <= 760 ? 76 : 116;
  const left = portrait ? Math.max(20, state.width * 0.055) : Math.max(42, state.width * 0.065);
  const top = portrait ? Math.max(70, state.height * 0.085) : Math.max(72, state.height * 0.145);
  const bottom = portrait ? Math.max(188, state.height * 0.22) : Math.max(68, state.height * 0.13);
  const bodyWidth = portrait
    ? Math.max(250, state.width - left * 2)
    : Math.max(300, state.width - left - sideControls - 58);
  const bodyHeight = portrait
    ? Math.max(280, state.height - top - bottom)
    : Math.max(170, state.height - top - bottom);
  const radius = Math.min(bodyHeight * 0.27, 96);

  state.bottle = {
    x: left,
    y: top,
    width: bodyWidth,
    height: bodyHeight,
    radius,
    vertical: portrait,
    neck: Math.min(46, bodyWidth * 0.07),
    inner: {
      x: left + 17,
      y: top + 17,
      width: bodyWidth - 34,
      height: bodyHeight - 34,
      radius: Math.max(18, radius - 15)
    }
  };

  if (previousInner && state.objects.length) {
    const inner = state.bottle.inner;
    for (const object of state.objects) {
      const oldRelativeX = clamp((object.x - previousInner.x) / previousInner.width, 0, 1);
      const oldRelativeY = clamp((object.y - previousInner.y) / previousInner.height, 0, 1);
      let relativeX = oldRelativeX;
      let relativeY = oldRelativeY;
      if (previousVertical !== portrait) {
        relativeX = oldRelativeY;
        relativeY = oldRelativeX;
      }
      object.x = clamp(
        inner.x + clamp(relativeX, 0, 1) * inner.width,
        inner.x + object.radius,
        inner.x + inner.width - object.radius
      );
      object.y = clamp(
        inner.y + clamp(relativeY, 0, 1) * inner.height,
        inner.y + object.radius,
        inner.y + inner.height - object.radius
      );
    }
  } else {
    createWorld();
  }

  updateOrientationGuard();
}

function createWorld() {
  if (!state.bottle) return;
  const theme = THEMES[state.theme];
  const inner = state.bottle.inner;
  const baseSize = clamp(Math.min(inner.width, inner.height) * 0.055, 10, 22);
  const countRange = state.lowPower ? [14, 22] : [20, 34];
  const count = clamp(Math.round(Math.sqrt(inner.width * inner.height) / 22), countRange[0], countRange[1]);

  state.objects = Array.from({ length: count }, (_, index) => {
    const radius = baseSize * randomBetween(0.62, 1.12);
    const kind = theme.objects[index % theme.objects.length];
    const movementMode = ['fish', 'seahorse'].includes(kind)
      ? 'swim'
      : ['crab', 'turtle'].includes(kind)
        ? 'crawl'
        : ['butterfly', 'ladybug', 'bee', 'beetle'].includes(kind)
          ? 'fly'
          : 'passive';
    const autonomous = movementMode !== 'passive';
    const swimAngle = randomBetween(-Math.PI, Math.PI);
    return {
      x: randomBetween(inner.x + radius, inner.x + inner.width - radius),
      y: randomBetween(inner.y + inner.height * 0.25, inner.y + inner.height - radius),
      vx: randomBetween(-0.3, 0.3),
      vy: randomBetween(-0.2, 0.2),
      radius,
      rotation: autonomous ? 0 : randomBetween(0, Math.PI * 2),
      angularVelocity: randomBetween(-0.004, 0.004),
      kind,
      variant: Math.floor(Math.random() * 4),
      mass: randomBetween(0.7, 1.25),
      autonomous,
      movementMode,
      swimAngle,
      facing: Math.cos(swimAngle) >= 0 ? 1 : -1,
      swimPhase: randomBetween(0, Math.PI * 2),
      swimTurn: randomBetween(0.0015, 0.004),
      crawlDirection: Math.random() > 0.5 ? 1 : -1,
      lastCrawlTurn: 0,
      scaredUntil: 0,
      lastScaredAt: 0
    };
  });

  const moteCount = state.reduceMotion ? 22 : (state.lowPower ? 40 : 58);
  state.motes = Array.from({ length: moteCount }, (_, index) => {
    const glitter = index % 5 !== 0;
    return {
      x: Math.random(),
      y: Math.random(),
      size: glitter ? randomBetween(0.6, 1.9) : randomBetween(1.4, 3.4),
      phase: randomBetween(0, Math.PI * 2),
      speed: randomBetween(0.18, 0.55),
      glitter,
      flare: glitter && Math.random() < 0.22,
      twinklePhase: randomBetween(0, Math.PI * 2),
      twinkleSpeed: randomBetween(0.6, 1.6)
    };
  });
  state.effects = [];
  state.ripples = [];
  state.draggedObject = null;
  state.dragPointerId = null;
  state.dragSample = null;
  canvas.classList.remove('grabbing');
}

function setTheme(themeName, announce = true) {
  if (!THEMES[themeName]) return;
  state.theme = themeName;
  loadThemeAtlas(themeName);
  loadPassiveAtlas();
  document.body.dataset.theme = themeName;
  document.querySelector('meta[name="theme-color"]').content = THEMES[themeName].skyTop;
  ui.themes.forEach((button) => {
    const selected = button.dataset.theme === themeName;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  createWorld();
  if (announce) showToast(`${THEMES[themeName].name}: nuevo mundo listo`);
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 2200);
}

function setStatus(message, active = false) {
  ui.statusText.textContent = message;
  ui.statusDot.classList.toggle('active', active);
}

function getScreenAngle() {
  const rawAngle = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((Number(rawAngle) % 360) + 360) % 360;
}

function rotateVectorByRightAngle(vector, angle) {
  if (angle === 90) return { x: -vector.y, y: vector.x };
  if (angle === 270) return { x: vector.y, y: -vector.x };
  if (angle === 180) return { x: -vector.x, y: -vector.y };
  return { x: vector.x, y: vector.y };
}

function rotateNaturalVectorToScreen(vector) {
  return rotateVectorByRightAngle(vector, getScreenAngle());
}

function applySensorGravity(vector, strength = 1) {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 0.055) {
    state.targetGravity.x = 0;
    state.targetGravity.y = 0;
    return;
  }

  const direction = { x: vector.x / magnitude, y: vector.y / magnitude };
  const force = clamp(strength, 0, 1.25);
  state.targetLiquidGravity.x = direction.x;
  state.targetLiquidGravity.y = direction.y;
  state.targetGravity.x = direction.x * force;
  state.targetGravity.y = direction.y * force;
  state.lastSensor = direction;
  state.sensorSeen = true;
  state.permissionDenied = false;
  setStatus('Física 360° activa', true);
}

function handleDeviceOrientation(event) {
  if (event.beta == null || event.gamma == null) return;
  if (state.motionSeen && performance.now() - state.lastMotionAt < 500) return;

  const beta = (Number(event.beta) || 0) * Math.PI / 180;
  const gamma = (Number(event.gamma) || 0) * Math.PI / 180;
  const naturalGravity = {
    x: Math.sin(gamma),
    y: Math.sin(beta) * Math.cos(gamma)
  };
  const screenGravity = rotateNaturalVectorToScreen(naturalGravity);
  applySensorGravity(screenGravity, Math.hypot(screenGravity.x, screenGravity.y));
}

function handleDeviceMotion(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration || acceleration.x == null || acceleration.y == null) return;

  const naturalGravity = {
    x: -(Number(acceleration.x) || 0),
    y: Number(acceleration.y) || 0
  };
  const screenGravity = rotateNaturalVectorToScreen(naturalGravity);
  const projectedStrength = Math.hypot(screenGravity.x, screenGravity.y) / 9.81;
  state.motionSeen = true;
  state.lastMotionAt = performance.now();
  applySensorGravity(screenGravity, projectedStrength);
}

async function enableMotion() {
  const orientationAvailable = 'DeviceOrientationEvent' in window;
  const motionAvailable = 'DeviceMotionEvent' in window;
  if (!orientationAvailable && !motionAvailable) {
    state.permissionDenied = true;
    setStatus('Control táctil', true);
    return false;
  }

  try {
    let orientationAllowed = orientationAvailable;
    let motionAllowed = motionAvailable;
    const permissionRequests = [];

    if (orientationAvailable && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      permissionRequests.push(
        window.DeviceOrientationEvent.requestPermission()
          .then((permission) => { orientationAllowed = permission === 'granted'; })
          .catch(() => { orientationAllowed = false; })
      );
    }

    if (motionAvailable && typeof window.DeviceMotionEvent.requestPermission === 'function') {
      permissionRequests.push(
        window.DeviceMotionEvent.requestPermission()
          .then((permission) => { motionAllowed = permission === 'granted'; })
          .catch(() => { motionAllowed = false; })
      );
    }

    await Promise.all(permissionRequests);
    if (!orientationAllowed && !motionAllowed) throw new Error('permission-denied');

    if (!state.sensorListening) {
      if (orientationAllowed) window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
      if (motionAllowed) window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
      state.sensorListening = true;
    }
    setStatus('Esperando sensor…', true);
    return true;
  } catch {
    state.permissionDenied = true;
    setStatus('Usa el control táctil', true);
    showToast('El sensor no está disponible; puedes arrastrar para inclinar');
    return false;
  }
}

async function requestImmersiveMode() {
  if (!hasTouchInput()) return;

  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // La experiencia sigue funcionando sin pantalla completa.
  }

  await lockOrientationIfPossible();
}

async function requestWakeLock() {
  try {
    const wakeLock = await navigator.wakeLock?.request?.('screen');
    state.wakeLock = wakeLock || null;
    wakeLock?.addEventListener?.('release', () => {
      if (state.wakeLock === wakeLock) state.wakeLock = null;
    });
  } catch {
    state.wakeLock = null;
  }
}

function isHandheldDevice() {
  return state.lowPower && Math.min(state.width, state.height) < 900;
}

function getOrientationType() {
  if (screen.orientation && screen.orientation.type) return screen.orientation.type;
  const angle = Number(window.orientation);
  if (!Number.isNaN(angle)) {
    if (angle === 90) return 'landscape-primary';
    if (angle === -90 || angle === 270) return 'landscape-secondary';
    if (angle === 0) return 'portrait-primary';
    if (angle === 180) return 'portrait-secondary';
  }
  return null;
}

async function lockOrientationIfPossible() {
  if (!screen.orientation || typeof screen.orientation.lock !== 'function') return;
  try {
    await screen.orientation.lock('landscape-primary');
  } catch {
    try {
      // Algunos navegadores no soportan el valor '-primary' pero sí 'landscape' genérico.
      await screen.orientation.lock('landscape');
    } catch {
      // No soportado (p.ej. Safari en iOS): la guía de rotación cubre este caso.
    }
  }
}

function updateOrientationGuard() {
  const portrait = state.width < state.height;
  const wrongSide = getOrientationType() === 'landscape-secondary';
  const shouldBlock = isHandheldDevice() && (portrait || wrongSide);
  state.orientationBlocked = shouldBlock;
  ui.guardTitle.textContent = wrongSide && !portrait ? 'Gira hacia el otro lado' : 'Gira el dispositivo';
  ui.guard.classList.toggle('visible', shouldBlock);
  ui.guard.setAttribute('aria-hidden', String(!shouldBlock));
  if (shouldBlock) releaseDraggedObject();
}

function calibrate() {
  state.liquidGravity.x = state.targetLiquidGravity.x;
  state.liquidGravity.y = state.targetLiquidGravity.y;
  for (const object of state.objects) {
    object.vx *= 0.25;
    object.vy *= 0.25;
    object.angularVelocity *= 0.25;
  }
  showToast('Movimiento estabilizado');
  setStatus(state.sensorSeen ? 'Física 360° activa' : 'Control estabilizado', true);
}

async function startExperience() {
  ui.start.disabled = true;
  ui.start.querySelector('span').textContent = 'Activando…';
  await enableMotion();
  await requestImmersiveMode();
  await requestWakeLock();
  state.started = true;
  ui.welcome.classList.add('hidden');
  ui.start.disabled = false;
  ui.start.querySelector('span').textContent = 'Activar botella';
  updateOrientationGuard();

  if (!state.sensorListening) setStatus('Arrastra para inclinar', true);
}

function applyPointerTilt(event) {
  if (state.sensorSeen && !state.permissionDenied) return;
  const touchInput = event.pointerType === 'touch' || event.pointerType === 'pen';
  if (touchInput && !state.pointerDown) return;
  const normalizedX = (event.clientX / state.width) * 2 - 1;
  const normalizedY = (event.clientY / state.height) * 2 - 1;
  state.targetGravity.x = clamp(normalizedX * 1.15, -1.2, 1.2);
  state.targetGravity.y = clamp(normalizedY * 0.75, -0.8, 0.8);
  const pointerMagnitude = Math.hypot(normalizedX, normalizedY);
  if (pointerMagnitude > 0.12) {
    state.targetLiquidGravity.x = normalizedX / pointerMagnitude;
    state.targetLiquidGravity.y = normalizedY / pointerMagnitude;
  }
  setStatus(touchInput ? 'Control táctil' : 'Control con mouse', true);
}

function pointerPosition(event) {
  return { x: event.clientX, y: event.clientY };
}

function findObjectAt(x, y) {
  for (let index = state.objects.length - 1; index >= 0; index -= 1) {
    const object = state.objects[index];
    const dx = x - object.x;
    const dy = y - object.y;
    const hitRadius = Math.max(22, object.radius * 1.55);
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return object;
  }
  return null;
}

function addRipple(x, y, strength = 1) {
  state.ripples.push({
    x,
    y,
    life: 1,
    strength: strength * (state.reduceMotion ? 0.45 : 1),
    radius: 8
  });
  if (state.ripples.length > 18) state.ripples.splice(0, state.ripples.length - 18);
}

function spawnObjectEffect(object, burst = false) {
  const style = EFFECT_STYLES[object.kind] || EFFECT_STYLES.star;
  const amount = state.reduceMotion ? (burst ? 3 : 1) : (burst ? 9 : 2);

  for (let index = 0; index < amount; index += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = burst ? randomBetween(0.8, 3.2) : randomBetween(0.2, 1.2);
    state.effects.push({
      x: object.x + Math.cos(angle) * object.radius * 0.45,
      y: object.y + Math.sin(angle) * object.radius * 0.45,
      vx: Math.cos(angle) * speed + object.vx * 0.18,
      vy: Math.sin(angle) * speed + object.vy * 0.18 - 0.25,
      life: 1,
      size: randomBetween(2.5, burst ? 7 : 5),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.08, 0.08),
      shape: style.shape,
      color: style.color
    });
  }

  if (state.effects.length > 110) state.effects.splice(0, state.effects.length - 110);
}

function beginObjectDrag(event) {
  if (!state.started || state.paused) return false;
  const point = pointerPosition(event);
  const object = findObjectAt(point.x, point.y);
  if (!object) return false;

  state.draggedObject = object;
  state.dragPointerId = event.pointerId;
  state.dragSample = { x: point.x, y: point.y, time: performance.now() };
  state.lastDragEffect = 0;
  object.vx = 0;
  object.vy = 0;
  canvas.classList.add('grabbing');
  spawnObjectEffect(object, true);
  addRipple(object.x, object.y, 0.7);
  setStatus(`Moviendo ${OBJECT_NAMES[object.kind] || 'objeto'}`, true);

  if (!state.touchHintShown) {
    showToast('Arrastra y suelta para lanzar el objeto');
    state.touchHintShown = true;
  }
  navigator.vibrate?.(10);
  return true;
}

function moveDraggedObject(event) {
  if (!state.draggedObject || event.pointerId !== state.dragPointerId) return false;
  const object = state.draggedObject;
  const point = pointerPosition(event);
  const inner = state.bottle.inner;
  const now = performance.now();
  const elapsed = Math.max(8, now - state.dragSample.time);
  const nextX = clamp(point.x, inner.x + object.radius, inner.x + inner.width - object.radius);
  const nextY = clamp(point.y, inner.y + object.radius, inner.y + inner.height - object.radius);

  object.vx = clamp(((nextX - state.dragSample.x) / elapsed) * 16.667, -6.5, 6.5);
  object.vy = clamp(((nextY - state.dragSample.y) / elapsed) * 16.667, -6.5, 6.5);
  object.x = nextX;
  object.y = nextY;
  object.rotation += object.vx * 0.012;
  state.dragSample = { x: nextX, y: nextY, time: now };

  if (now - state.lastDragEffect > (state.reduceMotion ? 140 : 58)) {
    spawnObjectEffect(object);
    if (now - state.lastDragEffect > 110) addRipple(object.x, object.y, 0.28);
    state.lastDragEffect = now;
  }
  return true;
}

function releaseDraggedObject(event) {
  if (!state.draggedObject || (event && event.pointerId !== state.dragPointerId)) return false;
  const object = state.draggedObject;
  object.vx = clamp(object.vx, -5, 5);
  object.vy = clamp(object.vy, -5, 5);
  if (object.autonomous) object.swimAngle = Math.atan2(object.vy, object.vx);
  else object.angularVelocity = clamp((object.vx - object.vy) * 0.0014, -0.012, 0.012);
  spawnObjectEffect(object, true);
  addRipple(object.x, object.y, 1.25);
  navigator.vibrate?.([8, 20, 8]);
  state.draggedObject = null;
  state.dragPointerId = null;
  state.dragSample = null;
  canvas.classList.remove('grabbing');
  setStatus(state.sensorSeen ? 'Física 360° activa' : 'Movimiento activo', true);
  return true;
}

function updateEffects(delta) {
  if (state.paused) return;

  for (let index = state.effects.length - 1; index >= 0; index -= 1) {
    const effect = state.effects[index];
    effect.x += effect.vx * delta;
    effect.y += effect.vy * delta;
    effect.vx *= Math.pow(0.975, delta);
    effect.vy = effect.vy * Math.pow(0.975, delta) - 0.004 * delta;
    effect.rotation += effect.spin * delta;
    effect.life -= 0.018 * delta;
    if (effect.life <= 0) state.effects.splice(index, 1);
  }

  for (let index = state.ripples.length - 1; index >= 0; index -= 1) {
    const ripple = state.ripples[index];
    ripple.radius += 1 * delta;
    ripple.life -= 0.012 * delta;
    if (ripple.life <= 0) state.ripples.splice(index, 1);
  }
}

function turnToward(current, target, amount) {
  let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * amount;
}

function scareCreature(creature, source) {
  const now = performance.now();
  if (!creature.autonomous || now - creature.lastScaredAt < 520) return;
  let dx = creature.x - source.x;
  let dy = creature.y - source.y;
  let distance = Math.hypot(dx, dy);
  if (distance < 0.01) {
    const randomAngle = randomBetween(0, Math.PI * 2);
    dx = Math.cos(randomAngle);
    dy = Math.sin(randomAngle);
    distance = 1;
  }

  const escapeSpeeds = { swim: 2.9, crawl: 2.2, fly: 2.7 };
  const escapeSpeed = escapeSpeeds[creature.movementMode] || 2.4;

  if (creature.movementMode === 'crawl') {
    const direction = Math.sign(dx) || (Math.random() > 0.5 ? 1 : -1);
    creature.vx = direction * escapeSpeed;
    creature.vy = -randomBetween(0.25, 0.85);
  } else {
    creature.vx = (dx / distance) * escapeSpeed + randomBetween(-0.45, 0.45);
    creature.vy = (dy / distance) * escapeSpeed + randomBetween(-0.45, 0.45);
  }

  creature.swimAngle = Math.atan2(creature.vy, creature.vx);
  creature.scaredUntil = now + randomBetween(850, 1250);
  creature.lastScaredAt = now;
  spawnObjectEffect(creature, true);
  addRipple(creature.x, creature.y, 0.75);

  if (!state.scareHintShown) {
    const creatureName = OBJECT_NAMES[creature.kind] || 'criatura';
    showToast(`¡${creatureName[0].toUpperCase()}${creatureName.slice(1)} se asustó y escapó!`);
    state.scareHintShown = true;
  }
}

function handleDraggedCollisions() {
  const dragged = state.draggedObject;
  if (!dragged) return;
  const impactSpeedSquared = dragged.vx * dragged.vx + dragged.vy * dragged.vy;
  if (impactSpeedSquared < 0.16) return;

  for (const creature of state.objects) {
    if (creature === dragged || !creature.autonomous) continue;
    const dx = creature.x - dragged.x;
    const dy = creature.y - dragged.y;
    const contactDistance = (creature.radius + dragged.radius) * 0.92;
    if (dx * dx + dy * dy <= contactDistance * contactDistance) scareCreature(creature, dragged);
  }
}

function updatePhysics(delta) {
  if (state.paused || !state.started || state.orientationBlocked) return;
  const theme = THEMES[state.theme];
  const inner = state.bottle.inner;
  const motionScale = state.reduceMotion ? 0.48 : 1;
  const now = performance.now();

  state.gravity.x += (state.targetGravity.x - state.gravity.x) * 0.04 * delta;
  state.gravity.y += (state.targetGravity.y - state.gravity.y) * 0.04 * delta;
  state.liquidGravity.x += (state.targetLiquidGravity.x - state.liquidGravity.x) * 0.045 * delta;
  state.liquidGravity.y += (state.targetLiquidGravity.y - state.liquidGravity.y) * 0.045 * delta;
  const liquidMagnitude = Math.hypot(state.liquidGravity.x, state.liquidGravity.y);
  if (liquidMagnitude > 0.001) {
    state.liquidGravity.x /= liquidMagnitude;
    state.liquidGravity.y /= liquidMagnitude;
  }
  const liquidFrame = createGravitySurface(theme.fill);
  ui.tiltMarker.style.left = `${50 + clamp(state.gravity.x, -1, 1) * 42}%`;

  for (const object of state.objects) {
    if (object === state.draggedObject) continue;
    if (object.autonomous) {
      const frightened = now < object.scaredUntil;
      object.swimPhase += (frightened ? 0.22 : object.movementMode === 'crawl' ? 0.055 : 0.07) * delta;

      if (object.movementMode === 'crawl') {
        const down = state.liquidGravity;
        const tangent = { x: down.y, y: -down.x };
        const direction = object.crawlDirection;
        if (!frightened) {
          const crawlForce = object.kind === 'turtle' ? 0.005 : 0.009;
          object.vx += tangent.x * direction * crawlForce * delta * motionScale;
          object.vy += tangent.y * direction * crawlForce * delta * motionScale;
        }
        object.vx += (state.gravity.x * 0.022 + down.x * 0.008) * delta * motionScale;
        object.vy += (state.gravity.y * 0.022 + down.y * 0.008) * delta * motionScale;

        const maximumSpeed = frightened ? 2.6 : (object.kind === 'turtle' ? 0.42 : 0.65);
        const speed = Math.hypot(object.vx, object.vy);
        if (speed > maximumSpeed) {
          object.vx = (object.vx / speed) * maximumSpeed;
          object.vy = (object.vy / speed) * maximumSpeed;
        }
        object.facing = direction;
        object.rotation = turnToward(object.rotation, Math.atan2(tangent.y, tangent.x), frightened ? 0.2 : 0.1);
      } else {
        if (!frightened) {
          const wandering = object.movementMode === 'fly' ? 1.5 : 1;
          object.swimAngle += Math.sin(object.swimPhase * 0.43 + object.variant) * object.swimTurn * 0.6 * wandering * delta;
          const moveForce = object.movementMode === 'fly'
            ? (object.kind === 'bee' ? 0.013 : 0.01)
            : (object.kind === 'seahorse' ? 0.006 : 0.009);
          object.vx += Math.cos(object.swimAngle) * moveForce * delta * motionScale;
          object.vy += Math.sin(object.swimAngle) * moveForce * (object.movementMode === 'fly' ? 0.9 : 0.72) * delta * motionScale;
        }

        const gravityInfluence = object.movementMode === 'fly' ? 0.007 : 0.012;
        object.vx += state.gravity.x * gravityInfluence * delta * motionScale;
        object.vy += state.gravity.y * gravityInfluence * 0.78 * delta * motionScale;

        const edgeMargin = Math.min(inner.width, inner.height) * 0.16;
        if (object.x < inner.x + edgeMargin) object.vx += 0.018 * delta;
        if (object.x > inner.x + inner.width - edgeMargin) object.vx -= 0.018 * delta;
        if (object.y < inner.y + edgeMargin) object.vy += 0.015 * delta;
        if (object.y > inner.y + inner.height - edgeMargin) object.vy -= 0.015 * delta;

        const maximumSpeed = frightened
          ? 3.2
          : object.movementMode === 'fly'
            ? (object.kind === 'bee' ? 0.95 : 0.78)
            : (object.kind === 'seahorse' ? 0.52 : 0.78);
        const speed = Math.hypot(object.vx, object.vy);
        if (speed > maximumSpeed) {
          object.vx = (object.vx / speed) * maximumSpeed;
          object.vy = (object.vy / speed) * maximumSpeed;
        }

        if (Math.hypot(object.vx, object.vy) > 0.04) {
          object.facing = object.vx >= 0 ? 1 : -1;
          const visualAngle = Math.atan2(object.vy * object.facing, Math.abs(object.vx));
          object.rotation = turnToward(object.rotation, visualAngle, frightened ? 0.2 : 0.075);
          object.swimAngle = turnToward(object.swimAngle, Math.atan2(object.vy, object.vx), 0.035);
        }
      }
      object.angularVelocity = 0;
    } else {
      const ambientLift = object.kind === 'bubble' || object.kind === 'butterfly' ? -0.012 : 0.009;
      object.vx += (state.gravity.x * 0.055 * object.mass + state.liquidGravity.x * ambientLift) * delta * motionScale;
      object.vy += (state.gravity.y * 0.05 * object.mass + state.liquidGravity.y * ambientLift) * delta * motionScale;
      object.angularVelocity = clamp(object.angularVelocity * Math.pow(0.972, delta), -0.014, 0.014);
      object.rotation += object.angularVelocity * delta;
    }

    object.vx *= Math.pow(theme.drag, delta);
    object.vy *= Math.pow(theme.drag, delta);
    object.x += object.vx * delta;
    object.y += object.vy * delta;

    const surfaceDepth = (object.x - liquidFrame.surfaceCenter.x) * liquidFrame.down.x
      + (object.y - liquidFrame.surfaceCenter.y) * liquidFrame.down.y;
    const minimumDepth = object.radius * 0.32;
    if (surfaceDepth < minimumDepth) {
      const correction = Math.min(object.radius * 0.45, minimumDepth - surfaceDepth);
      object.x += liquidFrame.down.x * correction;
      object.y += liquidFrame.down.y * correction;
      object.vx += liquidFrame.down.x * 0.035 * delta;
      object.vy += liquidFrame.down.y * 0.035 * delta;
    }

    const left = inner.x + object.radius;
    const right = inner.x + inner.width - object.radius;
    const top = inner.y + object.radius;
    const bottom = inner.y + inner.height - object.radius;

    if (object.x < left) {
      object.x = left;
      object.vx = Math.abs(object.vx) * 0.28;
      if (object.autonomous) object.swimAngle = Math.atan2(object.vy, object.vx);
      else object.angularVelocity += 0.0008;
      if (object.movementMode === 'crawl' && Math.abs(state.liquidGravity.y) > 0.45 && now - object.lastCrawlTurn > 360) {
        object.crawlDirection *= -1;
        object.lastCrawlTurn = now;
      }
    } else if (object.x > right) {
      object.x = right;
      object.vx = -Math.abs(object.vx) * 0.28;
      if (object.autonomous) object.swimAngle = Math.atan2(object.vy, object.vx);
      else object.angularVelocity -= 0.0008;
      if (object.movementMode === 'crawl' && Math.abs(state.liquidGravity.y) > 0.45 && now - object.lastCrawlTurn > 360) {
        object.crawlDirection *= -1;
        object.lastCrawlTurn = now;
      }
    }

    if (object.y < top) {
      object.y = top;
      object.vy = Math.abs(object.vy) * 0.26;
      if (object.movementMode === 'crawl' && Math.abs(state.liquidGravity.x) > 0.45 && now - object.lastCrawlTurn > 360) {
        object.crawlDirection *= -1;
        object.lastCrawlTurn = now;
      }
    } else if (object.y > bottom) {
      object.y = bottom;
      object.vy = -Math.abs(object.vy) * 0.22;
      object.vx *= 0.9;
      if (object.movementMode === 'crawl' && Math.abs(state.liquidGravity.x) > 0.45 && now - object.lastCrawlTurn > 360) {
        object.crawlDirection *= -1;
        object.lastCrawlTurn = now;
      }
    }
  }

  handleDraggedCollisions();
  updateEffects(delta);
}

function clippedProjectionArea(width, height, down, offset) {
  let polygon = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 }
  ];
  const clipped = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentProjection = current.x * down.x + current.y * down.y;
    const previousProjection = previous.x * down.x + previous.y * down.y;
    const currentInside = currentProjection >= offset;
    const previousInside = previousProjection >= offset;

    if (currentInside !== previousInside) {
      const denominator = currentProjection - previousProjection;
      const amount = Math.abs(denominator) < 0.00001 ? 0 : (offset - previousProjection) / denominator;
      clipped.push({
        x: previous.x + (current.x - previous.x) * amount,
        y: previous.y + (current.y - previous.y) * amount
      });
    }
    if (currentInside) clipped.push(current);
  }

  polygon = clipped;
  if (polygon.length < 3) return 0;
  let doubleArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubleArea) / 2;
}

function findGravitySurfaceOffset(inner, down, gapFraction, downExtent) {
  const desiredFilledArea = inner.width * inner.height * (1 - gapFraction);
  let lower = -downExtent;
  let upper = downExtent;

  for (let iteration = 0; iteration < 15; iteration += 1) {
    const middle = (lower + upper) / 2;
    const filledArea = clippedProjectionArea(inner.width, inner.height, down, middle);
    if (filledArea > desiredFilledArea) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function createGravitySurface(gapFraction) {
  const inner = state.bottle.inner;
  const magnitude = Math.hypot(state.liquidGravity.x, state.liquidGravity.y) || 1;
  const down = {
    x: state.liquidGravity.x / magnitude,
    y: state.liquidGravity.y / magnitude
  };
  const tangent = { x: down.y, y: -down.x };
  const center = {
    x: inner.x + inner.width / 2,
    y: inner.y + inner.height / 2
  };
  const downExtent = Math.abs(down.x) * inner.width / 2 + Math.abs(down.y) * inner.height / 2;
  const tangentExtent = Math.abs(tangent.x) * inner.width / 2 + Math.abs(tangent.y) * inner.height / 2;
  const surfaceOffset = findGravitySurfaceOffset(inner, down, gapFraction, downExtent);

  return {
    down,
    tangent,
    center,
    surfaceCenter: {
      x: center.x + down.x * surfaceOffset,
      y: center.y + down.y * surfaceOffset
    },
    downExtent,
    span: tangentExtent + 34,
    depth: Math.hypot(inner.width, inner.height) * 1.7
  };
}

function gravitySurfacePoint(frame, distance, time, waveHeight, includeRipples = false) {
  const waveScale = state.reduceMotion || state.paused ? 0.22 : 1;
  let displacement = Math.sin(distance * 0.024 + time * 0.00065) * waveHeight * waveScale;

  if (includeRipples) {
    for (const ripple of state.ripples) {
      const rippleDistance = (ripple.x - frame.surfaceCenter.x) * frame.tangent.x
        + (ripple.y - frame.surfaceCenter.y) * frame.tangent.y;
      const delta = distance - rippleDistance;
      const envelope = Math.exp(-Math.abs(delta) / 150);
      displacement += Math.sin(delta * 0.04 - (1 - ripple.life) * 8)
        * ripple.strength * ripple.life * 6 * envelope;
    }
  }

  return {
    x: frame.surfaceCenter.x + frame.tangent.x * distance + frame.down.x * displacement,
    y: frame.surfaceCenter.y + frame.tangent.y * distance + frame.down.y * displacement
  };
}

function traceGravitySurface(frame, time, waveHeight, includeRipples, steps = 48) {
  let firstPoint = null;
  let lastPoint = null;
  for (let step = 0; step <= steps; step += 1) {
    const distance = -frame.span + (frame.span * 2 * step) / steps;
    const point = gravitySurfacePoint(frame, distance, time, waveHeight, includeRipples);
    if (step === 0) {
      context.moveTo(point.x, point.y);
      firstPoint = point;
    } else {
      context.lineTo(point.x, point.y);
    }
    lastPoint = point;
  }
  return { firstPoint, lastPoint };
}

function drawBackground(theme) {
  const gradient = context.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(1, theme.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);

  const glow = context.createRadialGradient(
    state.width * 0.54,
    state.height * 0.45,
    0,
    state.width * 0.54,
    state.height * 0.45,
    state.width * 0.58
  );
  glow.addColorStop(0, `${theme.glow}20`);
  glow.addColorStop(1, 'transparent');
  context.fillStyle = glow;
  context.fillRect(0, 0, state.width, state.height);
}

function drawLiquid(theme, time) {
  const frame = createGravitySurface(theme.fill);
  const liquid = context.createLinearGradient(
    frame.center.x - frame.down.x * frame.downExtent,
    frame.center.y - frame.down.y * frame.downExtent,
    frame.center.x + frame.down.x * frame.downExtent,
    frame.center.y + frame.down.y * frame.downExtent
  );
  liquid.addColorStop(0, theme.liquidTop);
  liquid.addColorStop(0.38, theme.liquidMid);
  liquid.addColorStop(1, theme.liquidBottom);

  context.beginPath();
  const edge = traceGravitySurface(frame, time, theme.wave, true);
  context.lineTo(
    edge.lastPoint.x + frame.down.x * frame.depth,
    edge.lastPoint.y + frame.down.y * frame.depth
  );
  context.lineTo(
    edge.firstPoint.x + frame.down.x * frame.depth,
    edge.firstPoint.y + frame.down.y * frame.depth
  );
  context.closePath();
  context.fillStyle = liquid;
  context.fill();

  context.beginPath();
  traceGravitySurface(frame, time, theme.wave, true);
  context.strokeStyle = `${theme.glow}b8`;
  context.lineWidth = 2;
  context.shadowColor = theme.glow;
  context.shadowBlur = 12;
  context.stroke();
  context.shadowBlur = 0;
}

function drawThemeFloor(theme, time) {
  const floorFraction = state.theme === 'ocean' ? 0.11 : 0.17;
  const frame = createGravitySurface(1 - floorFraction);
  const waveHeight = state.theme === 'beach' ? 7 : 4;
  context.beginPath();
  const edge = traceGravitySurface(frame, time * 0.16, waveHeight, false, 36);
  context.lineTo(
    edge.lastPoint.x + frame.down.x * frame.depth,
    edge.lastPoint.y + frame.down.y * frame.depth
  );
  context.lineTo(
    edge.firstPoint.x + frame.down.x * frame.depth,
    edge.firstPoint.y + frame.down.y * frame.depth
  );
  context.closePath();
  context.fillStyle = theme.floor;
  context.globalAlpha = state.theme === 'ocean' ? 0.58 : 0.86;
  context.fill();
  context.globalAlpha = 1;

  if (state.theme === 'meadow') {
    context.strokeStyle = '#9ed36d';
    context.lineWidth = 1.5;
    for (let blade = 0; blade < 38; blade += 1) {
      const distance = -frame.span + (frame.span * 2 * blade) / 37;
      const base = gravitySurfacePoint(frame, distance, time * 0.16, waveHeight, false);
      const height = 5 + (blade % 5) * 2;
      context.beginPath();
      context.moveTo(base.x, base.y);
      context.quadraticCurveTo(
        base.x - frame.down.x * height * 0.5 + frame.tangent.x * Math.sin(blade) * 4,
        base.y - frame.down.y * height * 0.5 + frame.tangent.y * Math.sin(blade) * 4,
        base.x - frame.down.x * height + frame.tangent.x * Math.cos(blade) * 3,
        base.y - frame.down.y * height + frame.tangent.y * Math.cos(blade) * 3
      );
      context.stroke();
    }
  }
}

function drawMotes(time) {
  const inner = state.bottle.inner;
  const theme = THEMES[state.theme];
  const down = state.liquidGravity;
  const tangent = { x: down.y, y: -down.x };
  const speedScale = state.paused || state.reduceMotion ? 0.3 : 1;
  context.save();
  for (const mote of state.motes) {
    const drift = Math.sin(time * 0.00022 * mote.speed * speedScale + mote.phase);
    const rise = (time * 0.0024 * mote.speed * speedScale + mote.phase * 3) % 24;
    const x = inner.x + mote.x * inner.width + tangent.x * drift * 7 - down.x * rise;
    const y = inner.y + mote.y * inner.height + tangent.y * drift * 7 - down.y * rise;

    if (mote.glitter) {
      const twinkle = 0.28 + 0.72 * Math.abs(Math.sin(time * 0.0018 * mote.twinkleSpeed * speedScale + mote.twinklePhase));
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = twinkle;
      context.fillStyle = theme.glow;
      context.shadowColor = theme.glow;
      context.shadowBlur = state.lowPower ? 3 : 6;
      context.beginPath();
      context.arc(x, y, mote.size, 0, Math.PI * 2);
      context.fill();
      if (mote.flare && twinkle > 0.82) {
        context.strokeStyle = theme.glow;
        context.lineWidth = 0.6;
        const arm = mote.size * 2.6;
        context.beginPath();
        context.moveTo(x - arm, y);
        context.lineTo(x + arm, y);
        context.moveTo(x, y - arm);
        context.lineTo(x, y + arm);
        context.stroke();
      }
      context.shadowBlur = 0;
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    } else if (state.theme === 'ocean') {
      context.strokeStyle = `${theme.glow}65`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, mote.size * 1.25, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.fillStyle = state.theme === 'beach' ? '#ffe1a882' : '#efffb585';
      context.beginPath();
      context.arc(x, y, mote.size * 0.62, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawFivePointStar(radius) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const distance = point % 2 === 0 ? radius : radius * 0.45;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawCreatureSprite(object) {
  if (!object.autonomous) return false;
  const atlas = SPRITE_ATLASES[state.theme];
  const cellOptions = atlas?.cells?.[object.kind];
  if (!atlas?.ready || !atlas.image?.naturalWidth || !cellOptions) return false;

  const [column, row] = cellOptions[object.variant % cellOptions.length];
  const sourceWidth = atlas.image.naturalWidth / 2;
  const sourceHeight = atlas.image.naturalHeight / 2;
  const baseScale = object.kind === 'seahorse' ? 5.8 : object.movementMode === 'fly' ? 5.4 : object.movementMode === 'crawl' ? 5.2 : 5.4;
  const destinationSize = object.radius * baseScale;
  const motionPulse = state.paused ? 0 : Math.sin(object.swimPhase);
  const wingBeat = state.paused ? 0.5 : Math.abs(Math.sin(object.swimPhase * 1.9));
  let horizontalScale = 1;
  let verticalScale = 1;
  let bob = 0;

  if (object.movementMode === 'fly') {
    horizontalScale = 0.96 + wingBeat * 0.08;
    verticalScale = 0.84 + wingBeat * 0.18;
    bob = motionPulse * object.radius * 0.1;
  } else if (object.movementMode === 'crawl') {
    horizontalScale = 1 + motionPulse * 0.025;
    verticalScale = 0.98 - Math.abs(motionPulse) * 0.05;
    bob = -Math.abs(motionPulse) * object.radius * 0.12;
  } else {
    horizontalScale = 1 + motionPulse * 0.045;
    verticalScale = 1 - motionPulse * 0.035;
    bob = Math.cos(object.swimPhase * 0.7) * object.radius * 0.06;
  }

  context.save();
  context.translate(0, bob);
  if (object.kind === 'seahorse') {
    context.rotate(motionPulse * 0.085);
    context.transform(1, motionPulse * 0.045, 0, 1, 0, 0);
  } else if (object.movementMode === 'swim') {
    context.rotate(motionPulse * 0.025);
  } else if (object.movementMode === 'fly') {
    context.rotate(motionPulse * 0.045);
  }
  context.scale((object.facing || 1) * horizontalScale, verticalScale);
  context.drawImage(
    atlas.image,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    -destinationSize / 2,
    -destinationSize / 2,
    destinationSize,
    destinationSize
  );
  context.restore();
  return true;
}

function drawPassiveSprite(object) {
  if (object.autonomous || object.kind === 'bubble') return false;
  const cell = PASSIVE_ATLAS.cells[object.kind];
  if (!PASSIVE_ATLAS.ready || !PASSIVE_ATLAS.image?.naturalWidth || !cell) return false;

  const [column, row] = cell;
  const sourceWidth = PASSIVE_ATLAS.image.naturalWidth / 3;
  const sourceHeight = PASSIVE_ATLAS.image.naturalHeight / 3;
  const elongated = ELONGATED_PASSIVE_SPRITES.has(object.kind);
  const destinationSize = object.radius * (elongated ? 3.35 : 3.05);

  context.drawImage(
    PASSIVE_ATLAS.image,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    -destinationSize / 2,
    -destinationSize / 2,
    destinationSize,
    destinationSize
  );
  return true;
}

function drawObject(object) {
  const r = object.radius;
  context.save();
  context.translate(object.x, object.y);
  context.rotate(object.rotation);
  context.shadowColor = 'rgba(0, 0, 0, .22)';
  context.shadowBlur = 7;
  context.shadowOffsetY = 3;

  if (drawCreatureSprite(object)) {
    context.restore();
    return;
  }

  if (drawPassiveSprite(object)) {
    context.restore();
    return;
  }

  if (object.autonomous && object.facing < 0) context.scale(-1, 1);

  switch (object.kind) {
    case 'fish': {
      const tailWave = Math.sin(object.swimPhase) * r * 0.24;
      context.fillStyle = object.variant % 2 ? '#ffc96a' : '#ec7f72';
      context.beginPath();
      context.ellipse(0, 0, r, r * 0.58, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(-r * 0.82, 0);
      context.lineTo(-r * 1.45, -r * 0.64 + tailWave);
      context.lineTo(-r * 1.35, r * 0.64 + tailWave);
      context.closePath();
      context.fill();
      context.globalAlpha = 0.75;
      context.beginPath();
      context.moveTo(-r * 0.12, -r * 0.48);
      context.quadraticCurveTo(-r * 0.2, -r * 0.92, r * 0.28, -r * 0.38);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#102734';
      context.beginPath();
      context.arc(r * 0.48, -r * 0.12, Math.max(1.4, r * 0.1), 0, Math.PI * 2);
      context.fill();
      if (performance.now() < object.scaredUntil) {
        context.strokeStyle = 'rgba(255,255,255,.78)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(r * 0.48, -r * 0.12, Math.max(2.5, r * 0.18), 0, Math.PI * 2);
        context.stroke();
      }
      break;
    }
    case 'seahorse': {
      const sway = Math.sin(object.swimPhase * 0.72) * r * 0.12;
      const bodyColor = object.variant % 2 ? '#f0aa76' : '#a9c8ff';
      context.strokeStyle = bodyColor;
      context.lineWidth = Math.max(4, r * 0.48);
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(r * 0.18, -r * 0.66);
      context.bezierCurveTo(-r * 0.26 + sway, -r * 0.18, r * 0.28 + sway, r * 0.18, -r * 0.08, r * 0.72);
      context.stroke();
      context.lineWidth = Math.max(2, r * 0.18);
      context.beginPath();
      context.arc(-r * 0.08, r * 0.73, r * 0.3, -0.35, Math.PI * 1.65);
      context.stroke();
      context.fillStyle = bodyColor;
      context.beginPath();
      context.ellipse(r * 0.2, -r * 0.78, r * 0.45, r * 0.36, -0.15, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(r * 0.48, -r * 0.86);
      context.lineTo(r * 1.05, -r * 0.72);
      context.lineTo(r * 0.48, -r * 0.62);
      context.closePath();
      context.fill();
      context.globalAlpha = 0.62;
      context.beginPath();
      context.moveTo(-r * 0.14, -r * 0.3);
      context.lineTo(-r * 0.72, -r * 0.02 + sway);
      context.lineTo(-r * 0.18, r * 0.12);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#1a3343';
      context.beginPath();
      context.arc(r * 0.32, -r * 0.86, Math.max(1.3, r * 0.085), 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'star': {
      drawFivePointStar(r);
      context.fillStyle = object.variant % 2 ? '#ffb36e' : '#ffe28a';
      context.fill();
      break;
    }
    case 'shell': {
      context.fillStyle = object.variant % 2 ? '#ffd2bd' : '#f2b8a8';
      context.beginPath();
      context.arc(0, r * 0.16, r, Math.PI, Math.PI * 2);
      context.lineTo(r * 0.74, r * 0.58);
      context.lineTo(-r * 0.74, r * 0.58);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(120, 65, 65, .35)';
      context.lineWidth = Math.max(1, r * 0.06);
      for (let line = -2; line <= 2; line += 1) {
        context.beginPath();
        context.moveTo(0, -r * 0.78);
        context.lineTo((line / 2) * r * 0.62, r * 0.5);
        context.stroke();
      }
      break;
    }
    case 'pearl':
    case 'bubble': {
      const pearl = context.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      pearl.addColorStop(0, '#ffffff');
      pearl.addColorStop(0.35, object.kind === 'bubble' ? '#affff0aa' : '#dbd7ff');
      pearl.addColorStop(1, object.kind === 'bubble' ? '#6ed8e822' : '#8b83bd');
      context.fillStyle = pearl;
      context.beginPath();
      context.arc(0, 0, r * (object.kind === 'bubble' ? 0.72 : 0.8), 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, .55)';
      context.stroke();
      break;
    }
    case 'pebble': {
      context.fillStyle = ['#8e6550', '#d19b68', '#7b756c', '#c47758'][object.variant];
      context.beginPath();
      context.ellipse(0, 0, r, r * 0.7, 0.2, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'glass': {
      context.fillStyle = object.variant % 2 ? '#7de1d1aa' : '#78b8e2aa';
      context.beginPath();
      context.moveTo(0, -r);
      context.lineTo(r * 0.8, -r * 0.18);
      context.lineTo(r * 0.48, r);
      context.lineTo(-r * 0.72, r * 0.52);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.55)';
      context.stroke();
      break;
    }
    case 'sandDollar': {
      context.fillStyle = '#ead8b5';
      context.beginPath();
      context.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(135, 105, 72, .42)';
      context.lineWidth = Math.max(1, r * 0.055);
      for (let petal = 0; petal < 5; petal += 1) {
        context.rotate((Math.PI * 2) / 5);
        context.beginPath();
        context.ellipse(0, -r * 0.32, r * 0.13, r * 0.28, 0, 0, Math.PI * 2);
        context.stroke();
      }
      break;
    }
    case 'sun': {
      context.strokeStyle = '#ffe097';
      context.lineWidth = Math.max(1.5, r * 0.12);
      for (let ray = 0; ray < 8; ray += 1) {
        context.rotate(Math.PI / 4);
        context.beginPath();
        context.moveTo(r * 0.72, 0);
        context.lineTo(r * 1.08, 0);
        context.stroke();
      }
      context.fillStyle = '#ffc65f';
      context.beginPath();
      context.arc(0, 0, r * 0.68, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'crab': {
      const step = Math.sin(object.swimPhase) * r * 0.16;
      context.strokeStyle = '#ef8a62';
      context.lineWidth = Math.max(1.6, r * 0.11);
      context.lineCap = 'round';
      for (const side of [-1, 1]) {
        for (let leg = -1; leg <= 1; leg += 1) {
          context.beginPath();
          context.moveTo(side * r * 0.42, leg * r * 0.23);
          context.lineTo(side * r * (0.88 + Math.abs(leg) * 0.1), leg * r * 0.44 + step * side);
          context.stroke();
        }
        context.beginPath();
        context.moveTo(side * r * 0.62, -r * 0.28);
        context.lineTo(side * r * 1.02, -r * 0.7 + step * 0.35);
        context.stroke();
        context.fillStyle = '#f49a6e';
        context.beginPath();
        context.arc(side * r * 1.08, -r * 0.74 + step * 0.35, r * 0.25, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#e97858';
      context.beginPath();
      context.ellipse(0, 0, r * 0.78, r * 0.52, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff4dc';
      for (const eyeX of [-0.28, 0.28]) {
        context.beginPath();
        context.arc(r * eyeX, -r * 0.48, r * 0.12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#3d2923';
        context.beginPath();
        context.arc(r * eyeX, -r * 0.49, r * 0.055, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff4dc';
      }
      break;
    }
    case 'turtle': {
      const paddle = Math.sin(object.swimPhase) * r * 0.16;
      context.fillStyle = '#7caf6c';
      context.beginPath();
      context.ellipse(r * 0.82, 0, r * 0.32, r * 0.25, 0, 0, Math.PI * 2);
      context.fill();
      for (const [x, y] of [[-.42, -.55], [.42, -.55], [-.42, .55], [.42, .55]]) {
        context.beginPath();
        context.ellipse(r * x, r * y + paddle * Math.sign(y), r * 0.35, r * 0.16, y > 0 ? .45 : -.45, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = object.variant % 2 ? '#88aa62' : '#64975d';
      context.beginPath();
      context.ellipse(0, 0, r * 0.82, r * 0.65, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(44, 84, 48, .7)';
      context.lineWidth = Math.max(1, r * 0.07);
      context.beginPath();
      context.ellipse(0, 0, r * 0.48, r * 0.38, 0, 0, Math.PI * 2);
      context.moveTo(-r * 0.48, 0);
      context.lineTo(r * 0.48, 0);
      context.stroke();
      context.fillStyle = '#183b2b';
      context.beginPath();
      context.arc(r * 0.91, -r * 0.07, Math.max(1.2, r * 0.07), 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'leaf': {
      context.fillStyle = object.variant % 2 ? '#b8df72' : '#66b86e';
      context.beginPath();
      context.moveTo(-r, 0);
      context.quadraticCurveTo(0, -r * 1.05, r, 0);
      context.quadraticCurveTo(0, r * 1.05, -r, 0);
      context.fill();
      context.strokeStyle = 'rgba(31, 91, 52, .7)';
      context.beginPath();
      context.moveTo(-r * 0.72, 0);
      context.lineTo(r * 0.72, 0);
      context.stroke();
      break;
    }
    case 'flower': {
      context.fillStyle = object.variant % 2 ? '#f2a6cf' : '#f6d27d';
      for (let petal = 0; petal < 6; petal += 1) {
        context.rotate(Math.PI / 3);
        context.beginPath();
        context.ellipse(r * 0.52, 0, r * 0.55, r * 0.27, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#ffe49b';
      context.beginPath();
      context.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'ladybug': {
      const wingBeat = Math.abs(Math.sin(object.swimPhase * 1.4));
      context.globalAlpha = 0.34 + wingBeat * 0.25;
      context.fillStyle = '#fff4dc';
      context.beginPath();
      context.ellipse(-r * 0.12, -r * 0.46, r * 0.58, r * (0.18 + wingBeat * 0.18), -0.4, 0, Math.PI * 2);
      context.ellipse(-r * 0.12, r * 0.46, r * 0.58, r * (0.18 + wingBeat * 0.18), 0.4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#e75f52';
      context.beginPath();
      context.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b2725';
      context.fillRect(-r * 0.88, -r * 0.06, r * 1.76, r * 0.12);
      context.beginPath();
      context.arc(r * 0.76, 0, r * 0.34, 0, Math.PI * 2);
      context.fill();
      for (const [x, y] of [[-.2, -.35], [-.15, .35], [.42, -.32], [.45, .34]]) {
        context.beginPath();
        context.arc(r * x, r * y, r * 0.1, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
    case 'acorn': {
      context.fillStyle = '#9e643b';
      context.beginPath();
      context.ellipse(0, r * 0.12, r * 0.65, r * 0.92, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#65442e';
      context.beginPath();
      context.ellipse(0, -r * 0.45, r * 0.75, r * 0.35, 0, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'butterfly': {
      const wingBeat = 0.58 + Math.abs(Math.sin(object.swimPhase * 1.7)) * 0.42;
      context.fillStyle = object.variant % 2 ? '#ef9dc5' : '#f3c46c';
      context.beginPath();
      context.ellipse(-r * 0.12, -r * 0.44, r * 0.74, r * 0.48 * wingBeat, -0.24, 0, Math.PI * 2);
      context.ellipse(-r * 0.12, r * 0.44, r * 0.74, r * 0.48 * wingBeat, 0.24, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4b3930';
      context.beginPath();
      context.ellipse(0, 0, r * 0.7, r * 0.12, 0, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'bee': {
      const wingBeat = 0.5 + Math.abs(Math.sin(object.swimPhase * 2.2)) * 0.5;
      context.globalAlpha = 0.38 + wingBeat * 0.28;
      context.fillStyle = '#e9fbff';
      context.beginPath();
      context.ellipse(-r * 0.12, -r * 0.48, r * 0.5, r * 0.23 * wingBeat, -0.35, 0, Math.PI * 2);
      context.ellipse(-r * 0.12, r * 0.48, r * 0.5, r * 0.23 * wingBeat, 0.35, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#f4c94f';
      context.beginPath();
      context.ellipse(0, 0, r, r * 0.52, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#3c3428';
      context.lineWidth = Math.max(2, r * 0.16);
      for (const stripeX of [-0.35, 0.05, 0.43]) {
        context.beginPath();
        context.moveTo(r * stripeX, -r * 0.46);
        context.lineTo(r * stripeX, r * 0.46);
        context.stroke();
      }
      context.fillStyle = '#2f2b24';
      context.beginPath();
      context.arc(r * 0.77, -r * 0.12, Math.max(1.2, r * 0.075), 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'beetle': {
      const shimmer = 0.72 + Math.sin(object.swimPhase) * 0.12;
      context.fillStyle = `rgba(64, 142, 93, ${shimmer})`;
      context.beginPath();
      context.ellipse(0, 0, r, r * 0.66, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#183f2d';
      context.lineWidth = Math.max(1.4, r * 0.09);
      context.beginPath();
      context.moveTo(-r * 0.78, 0);
      context.lineTo(r * 0.72, 0);
      context.stroke();
      context.fillStyle = '#1c4732';
      context.beginPath();
      context.arc(r * 0.74, 0, r * 0.3, 0, Math.PI * 2);
      context.fill();
      break;
    }
  }

  context.restore();
}

function drawEffects() {
  context.save();
  context.globalCompositeOperation = 'screen';

  for (const ripple of state.ripples) {
    context.globalAlpha = ripple.life * 0.5;
    context.strokeStyle = THEMES[state.theme].glow;
    context.lineWidth = 1.5;
    context.beginPath();
    context.ellipse(ripple.x, ripple.y, ripple.radius * 1.8, ripple.radius * 0.62, 0, 0, Math.PI * 2);
    context.stroke();
  }

  for (const effect of state.effects) {
    context.save();
    context.translate(effect.x, effect.y);
    context.rotate(effect.rotation);
    context.globalAlpha = clamp(effect.life, 0, 1);
    context.strokeStyle = effect.color;
    context.fillStyle = effect.color;
    context.lineWidth = 1.4;
    context.shadowColor = effect.color;
    context.shadowBlur = 7;

    if (effect.shape === 'bubble' || effect.shape === 'ring') {
      context.beginPath();
      context.arc(0, 0, effect.size * (effect.shape === 'ring' ? 1.35 : 1), 0, Math.PI * 2);
      context.stroke();
    } else if (effect.shape === 'sand') {
      context.beginPath();
      context.arc(0, 0, effect.size * 0.48, 0, Math.PI * 2);
      context.fill();
    } else if (effect.shape === 'petal') {
      context.beginPath();
      context.ellipse(0, 0, effect.size, effect.size * 0.42, 0, 0, Math.PI * 2);
      context.fill();
    } else if (effect.shape === 'leaf') {
      context.beginPath();
      context.moveTo(-effect.size, 0);
      context.quadraticCurveTo(0, -effect.size * 0.7, effect.size, 0);
      context.quadraticCurveTo(0, effect.size * 0.7, -effect.size, 0);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(-effect.size, 0);
      context.lineTo(effect.size, 0);
      context.moveTo(0, -effect.size);
      context.lineTo(0, effect.size);
      context.stroke();
    }
    context.restore();
  }

  if (state.draggedObject) {
    const object = state.draggedObject;
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.08;
    context.globalAlpha = 0.72;
    context.strokeStyle = THEMES[state.theme].glow;
    context.lineWidth = 2;
    context.shadowColor = THEMES[state.theme].glow;
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(object.x, object.y, object.radius * 1.55 * pulse, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function drawBottle(time) {
  const bottle = state.bottle;
  const inner = bottle.inner;
  const theme = THEMES[state.theme];

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, .48)';
  context.shadowBlur = 50;
  context.shadowOffsetY = 24;
  roundedRectPath(context, bottle.x, bottle.y, bottle.width, bottle.height, bottle.radius);
  context.fillStyle = 'rgba(3, 10, 15, .45)';
  context.fill();
  context.restore();

  context.save();
  roundedRectPath(context, inner.x, inner.y, inner.width, inner.height, inner.radius);
  context.clip();

  const innerBackground = context.createLinearGradient(0, inner.y, 0, inner.y + inner.height);
  innerBackground.addColorStop(0, `${theme.skyTop}dd`);
  innerBackground.addColorStop(1, `${theme.skyBottom}ee`);
  context.fillStyle = innerBackground;
  context.fillRect(inner.x, inner.y, inner.width, inner.height);

  drawLiquid(theme, time);
  drawThemeFloor(theme, time);
  drawMotes(time);
  state.objects.forEach(drawObject);
  drawEffects();

  const caustic = context.createLinearGradient(inner.x, 0, inner.x + inner.width, 0);
  caustic.addColorStop(0, 'rgba(255,255,255,.02)');
  caustic.addColorStop(.32, 'rgba(255,255,255,.12)');
  caustic.addColorStop(.48, 'rgba(255,255,255,.025)');
  caustic.addColorStop(.76, 'rgba(255,255,255,.09)');
  caustic.addColorStop(1, 'rgba(255,255,255,.015)');
  context.fillStyle = caustic;
  context.fillRect(inner.x, inner.y, inner.width, inner.height);
  context.restore();

  context.save();
  roundedRectPath(context, bottle.x, bottle.y, bottle.width, bottle.height, bottle.radius);
  const glass = context.createLinearGradient(bottle.x, 0, bottle.x + bottle.width, 0);
  glass.addColorStop(0, 'rgba(255,255,255,.48)');
  glass.addColorStop(.08, 'rgba(255,255,255,.12)');
  glass.addColorStop(.48, 'rgba(255,255,255,.04)');
  glass.addColorStop(.91, 'rgba(255,255,255,.16)');
  glass.addColorStop(1, 'rgba(255,255,255,.42)');
  context.strokeStyle = glass;
  context.lineWidth = 8;
  context.stroke();

  roundedRectPath(context, bottle.x + 8, bottle.y + 8, bottle.width - 16, bottle.height - 16, Math.max(12, bottle.radius - 7));
  context.strokeStyle = 'rgba(255,255,255,.18)';
  context.lineWidth = 2;
  context.stroke();

  context.beginPath();
  if (bottle.vertical) {
    context.moveTo(bottle.x + 12, bottle.y + bottle.radius * 0.8);
    context.lineTo(bottle.x + 12, bottle.y + bottle.height * 0.62);
  } else {
    context.moveTo(bottle.x + bottle.radius * 0.8, bottle.y + 12);
    context.lineTo(bottle.x + bottle.width * 0.62, bottle.y + 12);
  }
  context.strokeStyle = 'rgba(255,255,255,.55)';
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.stroke();
  context.restore();

  const capX = bottle.vertical ? bottle.x + bottle.width * 0.34 : bottle.x + bottle.width - 5;
  const capY = bottle.vertical ? bottle.y + bottle.height - 5 : bottle.y + bottle.height * 0.34;
  const capHeight = bottle.vertical ? bottle.neck + 17 : bottle.height * 0.32;
  const capWidth = bottle.vertical ? bottle.width * 0.32 : bottle.neck + 17;
  const capGradient = bottle.vertical
    ? context.createLinearGradient(0, capY, 0, capY + capHeight)
    : context.createLinearGradient(capX, 0, capX + capWidth, 0);
  capGradient.addColorStop(0, '#8d6a3c');
  capGradient.addColorStop(.5, '#d1a75e');
  capGradient.addColorStop(1, '#6e4c2d');
  context.fillStyle = capGradient;
  roundedRectPath(context, capX, capY, capWidth, capHeight, Math.min(13, Math.min(capWidth, capHeight) * 0.22));
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,.24)';
  context.lineWidth = 2;
  context.stroke();

  context.strokeStyle = 'rgba(70, 43, 24, .38)';
  context.lineWidth = 1;
  for (let line = 1; line < 5; line += 1) {
    context.beginPath();
    if (bottle.vertical) {
      const y = capY + (capHeight * line) / 5;
      context.moveTo(capX + 5, y);
      context.lineTo(capX + capWidth - 5, y);
    } else {
      const x = capX + (capWidth * line) / 5;
      context.moveTo(x, capY + 5);
      context.lineTo(x, capY + capHeight - 5);
    }
    context.stroke();
  }
}

function render(time) {
  const delta = clamp((time - state.lastTime) / 16.6667, 0, 2.2);
  state.lastTime = time;
  updatePhysics(delta);
  const theme = THEMES[state.theme];
  drawBackground(theme);
  drawBottle(time);
  window.requestAnimationFrame(render);
}

ui.start.addEventListener('click', startExperience);
ui.calibrate.addEventListener('click', calibrate);

ui.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else showToast('Pantalla completa no disponible');
  } catch {
    showToast('Pantalla completa no disponible');
  }
});

ui.pause.addEventListener('click', () => {
  state.paused = !state.paused;
  if (state.paused) releaseDraggedObject();
  ui.pause.setAttribute('aria-pressed', String(state.paused));
  ui.pause.querySelector('span').textContent = state.paused ? '▶' : 'Ⅱ';
  ui.pauseLabel.textContent = state.paused ? 'Reanudar' : 'Pausar';
  setStatus(state.paused ? 'Movimiento en pausa' : 'Movimiento activo', !state.paused);
});

ui.themes.forEach((button) => {
  button.addEventListener('click', () => setTheme(button.dataset.theme));
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  state.pointerDown = true;
  canvas.setPointerCapture?.(event.pointerId);
  if (!beginObjectDrag(event)) applyPointerTilt(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (!moveDraggedObject(event)) applyPointerTilt(event);
}, { passive: true });
canvas.addEventListener('pointerup', (event) => {
  releaseDraggedObject(event);
  state.pointerDown = false;
  canvas.releasePointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointercancel', (event) => {
  releaseDraggedObject(event);
  state.pointerDown = false;
});
canvas.addEventListener('pointerleave', () => {
  if (!state.sensorSeen && !state.draggedObject) {
    state.targetGravity.x = 0;
    state.targetGravity.y = 0;
  }
});

window.addEventListener('resize', scheduleResize, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(scheduleResize, 120), { passive: true });
window.visualViewport?.addEventListener?.('resize', scheduleResize, { passive: true });
screen.orientation?.addEventListener?.('change', () => {
  window.setTimeout(scheduleResize, 80);
  if (state.started && !state.orientationBlocked) lockOrientationIfPossible();
});

document.addEventListener('visibilitychange', async () => {
  state.lastTime = performance.now();
  if (document.visibilityState === 'visible' && state.started && (!state.wakeLock || state.wakeLock.released)) await requestWakeLock();
});

resizeCanvas();
setTheme('ocean', false);
window.requestAnimationFrame(render);
