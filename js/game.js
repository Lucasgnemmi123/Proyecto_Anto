import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { AudioController } from './audio.js';
import { SCENARIOS, SETTINGS } from './config.js';

(() => {
  'use strict';

  if (!window.Matter) {
    document.getElementById('webglError').style.display = 'grid';
    return;
  }

  const { Engine, Bodies, Body, Composite, Events } = window.Matter;
  const stage = document.getElementById('stage');
  const intro = document.getElementById('intro');
  const startBtn = document.getElementById('startBtn');
  const scoreValue = document.getElementById('scoreValue');
  const roundLabel = document.getElementById('roundLabel');
  const ballCountValue = document.getElementById('ballCountValue');
  const addBallBtn = document.getElementById('addBallBtn');
  const removeBallBtn = document.getElementById('removeBallBtn');
  const pocketCountValue = document.getElementById('pocketCountValue');
  const addPocketBtn = document.getElementById('addPocketBtn');
  const removePocketBtn = document.getElementById('removePocketBtn');
  const controlStatus = document.getElementById('controlStatus');
  const statusText = document.getElementById('statusText');
  const steeringIndicator = document.getElementById('steeringIndicator');
  const steeringMarker = document.getElementById('steeringMarker');
  const calibrateBtn = document.getElementById('calibrateBtn');
  const soundBtn = document.getElementById('soundBtn');
  const orientationBtn = document.getElementById('orientationBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const resultCallout = document.getElementById('resultCallout');
  const resultText = document.getElementById('resultText');
  const orientationGuard = document.getElementById('orientationGuard');
  const orientationGuardTitle = document.getElementById('orientationGuardTitle');
  const orientationGuardText = document.getElementById('orientationGuardText');
  const orientationOptions = [...document.querySelectorAll('.orientation-option')];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const audio = new AudioController();
  const mobileOptimized = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
  const renderPixelRatio = mobileOptimized ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const geometryDetail = mobileOptimized
    ? { sphereWidth: 24, sphereHeight: 16, cylinder: 24, torusTube: 8, torusRadial: 32, ring: 32, shape: 16 }
    : { sphereWidth: 40, sphereHeight: 28, cylinder: 48, torusTube: 12, torusRadial: 64, ring: 64, shape: 32 };

  const RESPONSIVE_REFERENCE_SIDE = 700;
  const MINIMUM_GAME_SCALE = .55;
  const responsiveScaleFor = (width, height) => Math.max(
    MINIMUM_GAME_SCALE,
    Math.min(1, Math.min(width, height) / RESPONSIVE_REFERENCE_SIDE)
  );

  let W = Math.max(320, window.innerWidth);
  let H = Math.max(320, window.innerHeight);
  let gameScale = responsiveScaleFor(W, H);
  let ballRadius = SETTINGS.ballRadius * gameScale;
  let goalRadius = SETTINGS.goalRadius * gameScale;
  let wallThickness = SETTINGS.wallThickness * gameScale;
  let pocketAssistRadius = SETTINGS.pocketAssistRadius * gameScale;
  let autoSpeed = SETTINGS.autoSpeed * gameScale;
  let maxSpeed = SETTINGS.maxSpeed * gameScale;
  let steeringForce = SETTINGS.tiltSteeringForce * gameScale;
  let pocketAssistForce = SETTINGS.pocketAssistForce * gameScale;
  let worldW = 14;
  let worldD = worldW * H / W;
  let ballWorldRadius = ballRadius * worldW / W;
  let goalWorldRadius = goalRadius * worldW / W;
  let currentScenario = 'pool';
  let score = 0;
  let round = 1;
  let selectedBallCount = 1;
  let selectedPocketCount = 1;
  let orientationMismatch = false;
  let started = false;
  let captures = [];
  let lastFrame = performance.now();
  let sensorSeen = false;
  let motionSeen = false;
  let steeringReferenceAngle = null;
  let steeringTiltDegrees = 0;
  let steeringDirectionStatus = 'center';
  let displayedSteeringPercent = 0;
  let gravityFilterReady = false;
  let rawGravityX = 0;
  let rawGravityY = 0;
  let filteredGravityX = 0;
  let filteredGravityY = 0;
  let lastMotionAt = 0;
  let smoothSteering = 0;
  let keyboardX = 0;
  let pointerActive = false;
  let sensorEnabled = false;
  let orientationLockPending = false;
  let wakeLock = null;
  let wakeLockRequestPending = false;
  let feltMesh = null;
  let feltMaterial = null;
  let activeEffect = null;
  let resizeTimer = 0;
  let resizeNeedsCalibration = false;
  const balls = [];
  const pockets = [];
  const ballByBodyId = new Map();

  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  engine.gravity.scale = 0;

  const initialPocketBody = Bodies.circle(W * .78, H * .34, goalRadius, {
    label: 'goal',
    isStatic: true,
    isSensor: true,
    collisionFilter: { mask: 0 }
  });

  pockets.push({ index: 0, body: initialPocketBody, root: null, pulse: null });
  Composite.add(engine.world, initialPocketBody);
  let walls = [];

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 160);
  const renderer = new THREE.WebGLRenderer({
    antialias: !mobileOptimized,
    alpha: false,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = !mobileOptimized;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  stage.appendChild(renderer.domElement);

  const environmentRoot = new THREE.Group();
  const tableRoot = new THREE.Group();
  const lightsRoot = new THREE.Group();
  const pocketRoot = new THREE.Group();
  const ballsRoot = new THREE.Group();
  const effectsRoot = new THREE.Group();
  scene.add(environmentRoot, tableRoot, lightsRoot, pocketRoot, ballsRoot, effectsRoot);
  const ballRotationAxis = new THREE.Vector3();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;

  function initIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
  }

  function disposeMaterial(material) {
    if (!material) return;
    Object.keys(material).forEach(key => {
      const value = material[key];
      if (value && value.isTexture) value.dispose();
    });
    material.dispose();
  }

  function clearGroup(group) {
    const children = [...group.children];
    children.forEach(child => {
      child.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
        else if (object.material) disposeMaterial(object.material);
      });
      group.remove(child);
    });
  }

  function makeNoiseTexture(base, fleck) {
    const canvas = document.createElement('canvas');
    const textureSize = mobileOptimized ? 128 : 256;
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, textureSize, textureSize);
    ctx.globalAlpha = .12;
    ctx.fillStyle = fleck;
    const lightFlecks = mobileOptimized ? 900 : 3200;
    for (let i = 0; i < lightFlecks; i++) {
      const size = Math.random() > .92 ? 2 : 1;
      ctx.fillRect(Math.random() * textureSize, Math.random() * textureSize, size, size);
    }
    ctx.globalAlpha = .055;
    ctx.fillStyle = '#000000';
    const darkFlecks = mobileOptimized ? 420 : 1500;
    for (let i = 0; i < darkFlecks; i++) ctx.fillRect(Math.random() * textureSize, Math.random() * textureSize, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 3.5);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(mobileOptimized ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function makeWoodTexture(base, lineColor) {
    const canvas = document.createElement('canvas');
    const textureWidth = mobileOptimized ? 256 : 512;
    const textureHeight = mobileOptimized ? 64 : 128;
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = .18;
    for (let y = 7; y < textureHeight; y += 8 + Math.random() * 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= textureWidth; x += 18) ctx.lineTo(x, y + Math.sin(x * .035 + y) * 2.3);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeBallTexture(primary, band, number) {
    const canvas = document.createElement('canvas');
    const textureWidth = mobileOptimized ? 256 : 512;
    const textureHeight = textureWidth / 2;
    const textureScale = textureWidth / 512;
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, textureWidth, textureHeight);
    ctx.fillStyle = band;
    ctx.fillRect(0, 90 * textureScale, textureWidth, 76 * textureScale);
    ctx.beginPath();
    ctx.arc(256 * textureScale, 128 * textureScale, 29 * textureScale, 0, Math.PI * 2);
    ctx.fillStyle = '#f8f5ec';
    ctx.fill();
    ctx.fillStyle = '#171819';
    ctx.font = `700 ${34 * textureScale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 256 * textureScale, 129 * textureScale);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(mobileOptimized ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function addMesh(root, geometry, material, options = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    if (options.position) mesh.position.set(...options.position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    if (options.scale) mesh.scale.set(...options.scale);
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = Boolean(options.receiveShadow);
    root.add(mesh);
    return mesh;
  }

  function physicsToWorld(x, y) {
    return {
      x: (x / W - .5) * worldW,
      z: (y / H - .5) * worldD
    };
  }

  function updateWorldMetrics() {
    gameScale = responsiveScaleFor(W, H);
    ballRadius = SETTINGS.ballRadius * gameScale;
    goalRadius = SETTINGS.goalRadius * gameScale;
    wallThickness = SETTINGS.wallThickness * gameScale;
    pocketAssistRadius = SETTINGS.pocketAssistRadius * gameScale;
    autoSpeed = SETTINGS.autoSpeed * gameScale;
    maxSpeed = SETTINGS.maxSpeed * gameScale;
    steeringForce = SETTINGS.tiltSteeringForce * gameScale;
    pocketAssistForce = SETTINGS.pocketAssistForce * gameScale;
    worldW = 14;
    worldD = worldW * H / W;
    ballWorldRadius = ballRadius * worldW / W;
    goalWorldRadius = goalRadius * worldW / W;
  }

  function updateCamera() {
    const aspect = W / H;
    const margin = Math.max(1.8, ballWorldRadius * 2.2);
    const visibleHeight = Math.max(worldD + margin, (worldW + margin) / aspect);
    camera.left = -visibleHeight * aspect * .5;
    camera.right = visibleHeight * aspect * .5;
    camera.top = visibleHeight * .5;
    camera.bottom = -visibleHeight * .5;
    camera.near = .1;
    camera.far = 160;
    const span = Math.max(worldW, worldD);
    camera.position.set(0, span * 1.8, span * .42);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function makeWalls() {
    walls.forEach(wall => Composite.remove(engine.world, wall));
    const t = wallThickness;
    const wallOptions = {
      isStatic: true,
      restitution: SETTINGS.wallRestitution,
      friction: 0
    };
    walls = [
      Bodies.rectangle(W / 2, -t / 2, W + t * 2, t, { ...wallOptions, label: 'wall-top' }),
      Bodies.rectangle(W / 2, H + t / 2, W + t * 2, t, { ...wallOptions, label: 'wall-bottom' }),
      Bodies.rectangle(-t / 2, H / 2, t, H + t * 2, { ...wallOptions, label: 'wall-left' }),
      Bodies.rectangle(W + t / 2, H / 2, t, H + t * 2, { ...wallOptions, label: 'wall-right' })
    ];
    Composite.add(engine.world, walls);
  }

  function buildLights(config) {
    clearGroup(lightsRoot);
    const hemisphere = new THREE.HemisphereLight(config.ambient, config.base, currentScenario === 'arcade' ? 1.35 : 1.65);
    lightsRoot.add(hemisphere);

    const key = new THREE.DirectionalLight(config.key, currentScenario === 'rooftop' ? 3.2 : 2.8);
    key.position.set(-8, 16, 7);
    key.castShadow = renderer.shadowMap.enabled;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    key.shadow.bias = -.0006;
    lightsRoot.add(key);

    if (!mobileOptimized) {
      const fill = new THREE.PointLight(config.secondary, currentScenario === 'arcade' ? 28 : 14, 26, 2);
      fill.position.set(7, 5, -5);
      lightsRoot.add(fill);
    }
  }

  function buildEnvironment(config) {
    clearGroup(environmentRoot);
    scene.background = new THREE.Color(config.background);
    const span = Math.max(worldW, worldD);
    scene.fog = new THREE.Fog(
      config.background,
      Math.max(config.fog * .45, span * .9),
      Math.max(config.fog, span * 3.2)
    );
    renderer.setClearColor(config.background, 1);

    const floorSize = Math.max(56, worldD * 2.4);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: config.floor, roughness: .91, metalness: .02 });
    addMesh(environmentRoot, new THREE.PlaneGeometry(floorSize, floorSize), floorMaterial, {
      position: [0, -.52, 0],
      rotation: [-Math.PI / 2, 0, 0],
      receiveShadow: true
    });

    if (currentScenario === 'pool') buildPoolDecor(config);
    if (currentScenario === 'rooftop') buildRooftopDecor(config);
    if (currentScenario === 'arcade') buildArcadeDecor(config, floorSize);
  }

  function buildPoolDecor(config) {
    const metal = new THREE.MeshStandardMaterial({ color: config.railEdge, roughness: .28, metalness: .78 });
    const positions = [
      [-worldW / 2 - .54, -worldD / 2 - .54],
      [worldW / 2 + .54, -worldD / 2 - .54],
      [-worldW / 2 - .54, worldD / 2 + .54],
      [worldW / 2 + .54, worldD / 2 + .54]
    ];
    positions.forEach(([x, z]) => {
      addMesh(environmentRoot, new THREE.CylinderGeometry(.16, .2, .72, 16), metal, {
        position: [x, -.18, z],
        castShadow: true
      });
    });
  }

  function buildRooftopDecor(config) {
    const planterMaterial = new THREE.MeshStandardMaterial({ color: '#665d55', roughness: .84 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#315c42', roughness: .88 });
    const zPositions = [-worldD * .28, worldD * .28];
    zPositions.forEach(z => {
      [-1, 1].forEach(side => {
        const x = side * (worldW / 2 + 1.15);
        addMesh(environmentRoot, new THREE.BoxGeometry(.9, .54, 1.3), planterMaterial, {
          position: [x, -.23, z],
          castShadow: true,
          receiveShadow: true
        });
        for (let i = 0; i < 3; i++) {
          addMesh(environmentRoot, new THREE.IcosahedronGeometry(.38 + i * .025, 1), leafMaterial, {
            position: [x + (i - 1) * .22, .18 + (i % 2) * .12, z + (i - 1) * .18],
            castShadow: true
          });
        }
      });
    });
  }

  function buildArcadeDecor(config, floorSize) {
    const grid = new THREE.GridHelper(floorSize, 32, config.accent, config.secondary);
    grid.position.y = -.49;
    grid.material.transparent = true;
    grid.material.opacity = .19;
    environmentRoot.add(grid);

    const neonA = new THREE.MeshBasicMaterial({ color: config.accent });
    const neonB = new THREE.MeshBasicMaterial({ color: config.secondary });
    [-1, 1].forEach(side => {
      addMesh(environmentRoot, new THREE.BoxGeometry(.055, .055, worldD * .78), side > 0 ? neonA : neonB, {
        position: [side * (worldW / 2 + .9), -.36, 0]
      });
    });
  }

  function buildTable(config) {
    clearGroup(tableRoot);
    feltMesh = null;
    feltMaterial = new THREE.MeshStandardMaterial({
      map: makeNoiseTexture(config.surface, config.surfaceFleck),
      color: '#ffffff',
      roughness: .96,
      metalness: 0,
      side: THREE.DoubleSide
    });

    const baseMaterial = new THREE.MeshStandardMaterial({ color: config.base, roughness: .58, metalness: .14 });
    addMesh(tableRoot, new THREE.BoxGeometry(worldW + 1.18, .48, worldD + 1.18), baseMaterial, {
      position: [0, -.18, 0],
      castShadow: true,
      receiveShadow: true
    });

    const railWidth = Math.max(.44, ballWorldRadius * .42);
    const railHeight = Math.max(.38, ballWorldRadius * .48);
    const woodMap = makeWoodTexture(config.rail, config.railEdge);
    const railMaterial = mobileOptimized
      ? new THREE.MeshStandardMaterial({ map: woodMap, color: '#ffffff', roughness: .48, metalness: .06 })
      : new THREE.MeshPhysicalMaterial({
        map: woodMap,
        color: '#ffffff',
        roughness: .42,
        metalness: .08,
        clearcoat: currentScenario === 'pool' ? .68 : .22,
        clearcoatRoughness: .24
      });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: config.railEdge,
      roughness: currentScenario === 'arcade' ? .2 : .34,
      metalness: currentScenario === 'arcade' ? .4 : .7,
      emissive: currentScenario === 'arcade' ? config.railEdge : '#000000',
      emissiveIntensity: currentScenario === 'arcade' ? 1.7 : 0
    });

    const railY = .11 + railHeight / 2;
    addMesh(tableRoot, new THREE.BoxGeometry(worldW + railWidth * 2, railHeight, railWidth), railMaterial, {
      position: [0, railY, -worldD / 2 - railWidth / 2],
      castShadow: true,
      receiveShadow: true
    });
    addMesh(tableRoot, new THREE.BoxGeometry(worldW + railWidth * 2, railHeight, railWidth), railMaterial, {
      position: [0, railY, worldD / 2 + railWidth / 2],
      castShadow: true,
      receiveShadow: true
    });
    addMesh(tableRoot, new THREE.BoxGeometry(railWidth, railHeight, worldD), railMaterial, {
      position: [-worldW / 2 - railWidth / 2, railY, 0],
      castShadow: true,
      receiveShadow: true
    });
    addMesh(tableRoot, new THREE.BoxGeometry(railWidth, railHeight, worldD), railMaterial, {
      position: [worldW / 2 + railWidth / 2, railY, 0],
      castShadow: true,
      receiveShadow: true
    });

    const strip = .055;
    const stripY = railY + railHeight / 2 + .012;
    addMesh(tableRoot, new THREE.BoxGeometry(worldW, .025, strip), edgeMaterial, {
      position: [0, stripY, -worldD / 2 - .06]
    });
    addMesh(tableRoot, new THREE.BoxGeometry(worldW, .025, strip), edgeMaterial, {
      position: [0, stripY, worldD / 2 + .06]
    });
    addMesh(tableRoot, new THREE.BoxGeometry(strip, .025, worldD), edgeMaterial, {
      position: [-worldW / 2 - .06, stripY, 0]
    });
    addMesh(tableRoot, new THREE.BoxGeometry(strip, .025, worldD), edgeMaterial, {
      position: [worldW / 2 + .06, stripY, 0]
    });

    rebuildSurface();
  }

  function rebuildSurface() {
    if (feltMesh) {
      feltMesh.geometry.dispose();
      tableRoot.remove(feltMesh);
    }
    const shape = new THREE.Shape();
    shape.moveTo(-worldW / 2, -worldD / 2);
    shape.lineTo(worldW / 2, -worldD / 2);
    shape.lineTo(worldW / 2, worldD / 2);
    shape.lineTo(-worldW / 2, worldD / 2);
    shape.closePath();

    pockets.forEach(pocket => {
      const position = physicsToWorld(pocket.body.position.x, pocket.body.position.y);
      const hole = new THREE.Path();
      hole.absarc(position.x, -position.z, goalWorldRadius * .84, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    });

    feltMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, geometryDetail.shape), feltMaterial);
    feltMesh.rotation.x = -Math.PI / 2;
    feltMesh.position.y = .08;
    feltMesh.receiveShadow = true;
    tableRoot.add(feltMesh);
  }

  function buildPockets(config) {
    clearGroup(pocketRoot);
    pockets.forEach(pocket => {
      const root = new THREE.Group();
      const innerMaterial = new THREE.MeshStandardMaterial({ color: '#020303', roughness: .94, metalness: 0 });
      const rimMaterial = mobileOptimized
        ? new THREE.MeshStandardMaterial({
          color: config.railEdge,
          roughness: .34,
          metalness: .62,
          emissive: currentScenario === 'arcade' ? config.accent : '#000000',
          emissiveIntensity: currentScenario === 'arcade' ? .8 : 0
        })
        : new THREE.MeshPhysicalMaterial({
          color: config.railEdge,
          roughness: .3,
          metalness: .72,
          clearcoat: .42,
          emissive: currentScenario === 'arcade' ? config.accent : '#000000',
          emissiveIntensity: currentScenario === 'arcade' ? 1.2 : 0
        });

      addMesh(root, new THREE.CylinderGeometry(goalWorldRadius * .84, goalWorldRadius * .72, .55, geometryDetail.cylinder), innerMaterial, {
        position: [0, -.19, 0],
        receiveShadow: true
      });
      addMesh(root, new THREE.TorusGeometry(goalWorldRadius * .86, Math.max(.035, goalWorldRadius * .055), geometryDetail.torusTube, geometryDetail.torusRadial), rimMaterial, {
        position: [0, .105, 0],
        rotation: [Math.PI / 2, 0, 0],
        castShadow: true
      });

      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: config.accent,
        transparent: true,
        opacity: .35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      pocket.pulse = addMesh(root, new THREE.RingGeometry(goalWorldRadius * .93, goalWorldRadius * 1.02, geometryDetail.ring), pulseMaterial, {
        position: [0, .095, 0],
        rotation: [-Math.PI / 2, 0, 0]
      });

      if (!mobileOptimized) {
        const glow = new THREE.PointLight(config.accent, currentScenario === 'arcade' ? 6 : 2.2, goalWorldRadius * 5, 2);
        glow.position.set(0, .58, 0);
        root.add(glow);
      }
      pocketRoot.add(root);
      pocket.root = root;
    });
    updatePocketVisuals();
  }

  function buildBalls(config) {
    clearGroup(ballsRoot);
    balls.forEach((ball, index) => {
      const root = new THREE.Group();
      const ballMap = makeBallTexture(config.ballColors[index % config.ballColors.length], config.ballBand, index + 1);
      const material = mobileOptimized
        ? new THREE.MeshStandardMaterial({ map: ballMap, color: '#ffffff', roughness: .24, metalness: .02 })
        : new THREE.MeshPhysicalMaterial({
          map: ballMap,
          color: '#ffffff',
          roughness: .18,
          metalness: .02,
          clearcoat: 1,
          clearcoatRoughness: .08
        });
      const mesh = addMesh(root, new THREE.SphereGeometry(ballWorldRadius, geometryDetail.sphereWidth, geometryDetail.sphereHeight), material, {
        castShadow: true,
        receiveShadow: true
      });
      mesh.rotation.y = -.9 + index * .34;
      mesh.rotation.z = .18;
      ballsRoot.add(root);
      ball.root = root;
      ball.mesh = mesh;
      root.visible = ball.state !== 'pocketed';
      root.scale.setScalar(1);
      updateBallVisual(ball);
    });
  }

  function updatePocketVisuals() {
    pockets.forEach(pocket => {
      if (!pocket.root) return;
      const position = physicsToWorld(pocket.body.position.x, pocket.body.position.y);
      pocket.root.position.set(position.x, 0, position.z);
    });
    rebuildSurface();
  }

  function updateBallVisual(ball) {
    if (!ball.mesh || ball.state !== 'active') return;
    const position = physicsToWorld(ball.body.position.x, ball.body.position.y);
    ball.root.position.set(position.x, .08 + ballWorldRadius, position.z);
  }

  function updateBallVisuals() {
    balls.forEach(updateBallVisual);
  }

  function updateScenarioUi(config) {
    document.documentElement.style.setProperty('--accent', config.accent);
    document.documentElement.style.setProperty('--accent-rgb', config.accentRgb);
    themeMeta.setAttribute('content', config.background);
    document.querySelectorAll('.scene-tab').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.scene === currentScenario));
    });
  }

  function buildScenario(sceneId) {
    currentScenario = sceneId;
    const config = SCENARIOS[currentScenario];
    updateScenarioUi(config);
    buildLights(config);
    buildEnvironment(config);
    buildTable(config);
    buildPockets(config);
    buildBalls(config);
  }

  function makePocketPositions(count, previousPositions = []) {
    const positions = [];
    const margin = goalRadius + 14 * gameScale;
    const spanX = Math.max(1, W - margin * 2);
    const spanY = Math.max(1, H - margin * 2);
    const preferredGap = goalRadius * 2.12;
    const minimumGap = goalRadius * 1.68;
    const movementGap = goalRadius * 1.25;

    for (let index = 0; index < count; index++) {
      let candidate = null;
      let bestCandidate = null;
      let bestClearance = -Infinity;

      for (let tries = 0; tries < 520; tries++) {
        const test = {
          x: margin + Math.random() * spanX,
          y: margin + Math.random() * spanY
        };
        const clearance = positions.length
          ? Math.min(...positions.map(position => Math.hypot(test.x - position.x, test.y - position.y)))
          : Infinity;
        if (clearance > bestClearance) {
          bestClearance = clearance;
          bestCandidate = test;
        }

        const relaxedGap = lerp(preferredGap, minimumGap, clamp((tries - 220) / 300, 0, 1));
        const clearOfPockets = positions.every(position => (
          Math.hypot(test.x - position.x, test.y - position.y) >= relaxedGap
        ));
        const movedFromPrevious = tries > 360 || previousPositions.every(position => (
          Math.hypot(test.x - position.x, test.y - position.y) >= movementGap
        ));
        if (clearOfPockets && movedFromPrevious) {
          candidate = test;
          break;
        }
      }

      positions.push(candidate || bestCandidate || { x: W / 2, y: H / 2 });
    }
    return positions;
  }

  function createPocketBodies(count) {
    const previousPositions = pockets.map(pocket => ({ ...pocket.body.position }));
    pockets.forEach(pocket => Composite.remove(engine.world, pocket.body));
    pockets.length = 0;
    const positions = makePocketPositions(count, previousPositions);

    positions.forEach((position, index) => {
      const body = Bodies.circle(position.x, position.y, goalRadius, {
        label: 'goal',
        isStatic: true,
        isSensor: true,
        collisionFilter: { mask: 0 }
      });
      pockets.push({ index, body, root: null, pulse: null });
      Composite.add(engine.world, body);
    });
  }

  function chooseNextPockets() {
    const previousPositions = pockets.map(pocket => ({ ...pocket.body.position }));
    const positions = makePocketPositions(pockets.length, previousPositions);
    pockets.forEach((pocket, index) => Body.setPosition(pocket.body, positions[index]));
    updatePocketVisuals();
  }

  function createBallBodies(count) {
    balls.forEach(ball => Composite.remove(engine.world, ball.body));
    balls.length = 0;
    ballByBodyId.clear();

    for (let index = 0; index < count; index++) {
      const body = Bodies.circle(W * .25, H * .5, ballRadius, {
        label: 'ball',
        restitution: SETTINGS.restitution,
        friction: .018,
        frictionAir: SETTINGS.frictionAir,
        density: .0025
      });
      const ball = { index, body, root: null, mesh: null, state: 'active', scored: false, heading: 0 };
      balls.push(ball);
      ballByBodyId.set(body.id, ball);
      Composite.add(engine.world, body);
    }
    resetBalls();
  }

  function makeSpawnPositions(count) {
    const positions = [];
    const margin = ballRadius + 18 * gameScale;
    const minimumGap = ballRadius * 2.25;
    const minimumGoalGap = goalRadius + ballRadius + 24 * gameScale;
    const pocketCenterX = pockets.reduce((total, pocket) => total + pocket.body.position.x, 0) / Math.max(1, pockets.length);
    const pocketsOnRight = pocketCenterX >= W / 2;

    for (let index = 0; index < count; index++) {
      let candidate = null;
      for (let tries = 0; tries < 140; tries++) {
        const preferOppositeSide = tries < 95;
        const minX = pocketsOnRight || !preferOppositeSide ? margin : W * .52;
        const maxX = pocketsOnRight && preferOppositeSide ? W * .48 : W - margin;
        const safeMinX = Math.min(minX, maxX - 1);
        const safeMaxX = Math.max(maxX, safeMinX + 1);
        const test = {
          x: safeMinX + Math.random() * (safeMaxX - safeMinX),
          y: margin + Math.random() * Math.max(1, H - margin * 2)
        };
        const clearOfPockets = pockets.every(pocket => (
          Math.hypot(test.x - pocket.body.position.x, test.y - pocket.body.position.y) >= minimumGoalGap
        ));
        const clearOfBalls = positions.every(position => Math.hypot(test.x - position.x, test.y - position.y) >= minimumGap);
        if (clearOfPockets && clearOfBalls) {
          candidate = test;
          break;
        }
      }

      if (!candidate) {
        const angle = index / Math.max(1, count) * Math.PI * 2;
        const centerX = pocketsOnRight ? W * .28 : W * .72;
        candidate = {
          x: clamp(centerX + Math.cos(angle) * minimumGap, margin, W - margin),
          y: clamp(H * .5 + Math.sin(angle) * minimumGap, margin, H - margin)
        };
      }
      positions.push(candidate);
    }
    return positions;
  }

  function resetBalls() {
    captures = [];
    const positions = makeSpawnPositions(balls.length);
    balls.forEach((ball, index) => {
      ball.state = 'active';
      ball.scored = false;
      ball.body.collisionFilter.mask = 0xFFFFFFFF;
      Body.setStatic(ball.body, false);
      Body.setPosition(ball.body, positions[index]);
      Body.setVelocity(ball.body, { x: 0, y: 0 });
      Body.setAngularVelocity(ball.body, 0);
      const targetPocket = pockets[index % Math.max(1, pockets.length)];
      const targetPosition = targetPocket ? targetPocket.body.position : { x: W / 2, y: H / 2 };
      ball.heading = Math.atan2(targetPosition.y - positions[index].y, targetPosition.x - positions[index].x)
        + (Math.random() - .5) * 1.1;
      if (ball.root) {
        ball.root.rotation.set(0, 0, 0);
        ball.root.scale.setScalar(1);
        ball.root.visible = true;
      }
      updateBallVisual(ball);
    });
  }

  function updateBallCountUi() {
    ballCountValue.textContent = String(selectedBallCount);
    removeBallBtn.disabled = selectedBallCount <= 1;
    addBallBtn.disabled = selectedBallCount >= SETTINGS.maxBalls;
    roundLabel.textContent = `RONDA ${String(round).padStart(2, '0')}`;
  }

  function updatePocketCountUi() {
    pocketCountValue.textContent = String(selectedPocketCount);
    removePocketBtn.disabled = selectedPocketCount <= 1;
    addPocketBtn.disabled = selectedPocketCount >= SETTINGS.maxPockets;
  }

  function setBallCount(count) {
    const nextCount = clamp(count, 1, SETTINGS.maxBalls);
    if (nextCount === selectedBallCount) return;
    selectedBallCount = nextCount;
    captures = [];
    createBallBodies(selectedBallCount);
    buildBalls(SCENARIOS[currentScenario]);
    updateBallCountUi();
    const noun = selectedBallCount === 1 ? 'PELOTA' : 'PELOTAS';
    setStatus(`${selectedBallCount} ${noun} EN ESTA RONDA`, sensorSeen);
  }

  function setPocketCount(count) {
    const nextCount = clamp(count, 1, SETTINGS.maxPockets);
    if (nextCount === selectedPocketCount) return;
    selectedPocketCount = nextCount;
    captures = [];
    createPocketBodies(selectedPocketCount);
    resetBalls();
    buildPockets(SCENARIOS[currentScenario]);
    updatePocketCountUi();
    const noun = selectedPocketCount === 1 ? 'TRONERA' : 'TRONERAS';
    setStatus(`${selectedPocketCount} ${noun} EN ZONAS ALEATORIAS`, sensorSeen);
  }

  function desiredOrientationType() {
    return 'landscape-primary';
  }

  function currentScreenOrientationType() {
    const type = screen.orientation && screen.orientation.type;
    if (typeof type === 'string' && /^(portrait|landscape)-(primary|secondary)$/.test(type)) return type;

    const mode = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (typeof window.orientation !== 'number') return `${mode}-primary`;
    const angle = ((window.orientation % 360) + 360) % 360;
    if (mode === 'portrait') return angle === 180 ? 'portrait-secondary' : 'portrait-primary';
    return angle === 180 || angle === 270 ? 'landscape-secondary' : 'landscape-primary';
  }

  function setStatus(text, active) {
    if (statusText.textContent !== text) statusText.textContent = text;
    const shouldBeActive = Boolean(active);
    if (controlStatus.classList.contains('active') !== shouldBeActive) {
      controlStatus.classList.toggle('active', shouldBeActive);
    }
  }

  function updateOrientationUi() {
    orientationOptions.forEach(option => {
      option.setAttribute('aria-pressed', String(option.dataset.orientation === 'landscape'));
    });
    orientationBtn.dataset.tooltip = 'Horizontal fija';
    orientationBtn.setAttribute('aria-label', 'Orientacion horizontal fija, siempre del mismo lado');
    orientationBtn.innerHTML = '<i data-lucide="rectangle-horizontal"></i>';
    orientationGuardText.textContent = 'Usa el dispositivo en horizontal y siempre del lado principal.';
    document.documentElement.dataset.gameOrientation = 'landscape';
    initIcons();
  }

  function updateOrientationState() {
    const wasMismatched = orientationMismatch;
    const currentType = currentScreenOrientationType();
    const sameMode = currentType.startsWith('landscape');
    orientationMismatch = started && currentType !== desiredOrientationType();
    orientationGuard.classList.toggle('visible', orientationMismatch);
    orientationGuard.setAttribute('aria-hidden', String(!orientationMismatch));
    orientationGuardTitle.textContent = sameMode ? 'NO INVIERTAS EL DISPOSITIVO' : 'GIRA TU DISPOSITIVO';
    orientationGuardText.textContent = sameMode
      ? 'Vuelve al lado principal de la orientación horizontal.'
      : 'Este juego está fijado únicamente en horizontal.';

    if (orientationMismatch && !wasMismatched) {
      setStatus(sameMode ? 'NO INVIERTAS EL DISPOSITIVO' : 'GIRA A HORIZONTAL', false);
    } else if (!orientationMismatch && wasMismatched) {
      calibrate();
    }
  }

  function isTouchDevice() {
    return navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
  }

  async function lockSelectedOrientation({ enterFullscreen = true } = {}) {
    if (!screen.orientation || typeof screen.orientation.lock !== 'function') {
      updateOrientationState();
      return false;
    }
    if (orientationLockPending) return false;

    orientationLockPending = true;
    try {
      if (enterFullscreen && isTouchDevice() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      await screen.orientation.lock(desiredOrientationType());
      updateOrientationState();
      return true;
    } catch (error) {
      console.info('Bloqueo de orientacion no disponible; se usara el aviso para girar:', error);
      updateOrientationState();
      return false;
    } finally {
      orientationLockPending = false;
    }
  }

  async function requestWakeLock() {
    if (!started || document.visibilityState !== 'visible' || wakeLock || wakeLockRequestPending) return false;
    if (!('wakeLock' in navigator)) {
      console.info('Bloqueo de reposo no disponible en este navegador.');
      return false;
    }

    wakeLockRequestPending = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!started || document.visibilityState !== 'visible') {
        await sentinel.release();
        return false;
      }
      wakeLock = sentinel;
      sentinel.addEventListener('release', () => {
        if (wakeLock === sentinel) wakeLock = null;
      }, { once: true });
      return true;
    } catch (error) {
      console.info('No fue posible mantener la pantalla activa:', error);
      return false;
    } finally {
      wakeLockRequestPending = false;
    }
  }

  async function releaseWakeLock() {
    const activeWakeLock = wakeLock;
    wakeLock = null;
    if (!activeWakeLock || activeWakeLock.released) return;
    try {
      await activeWakeLock.release();
    } catch (error) {
      console.info('No fue posible liberar el bloqueo de reposo:', error);
    }
  }

  function onMotion(event) {
    const now = performance.now();
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration || typeof acceleration.x !== 'number' || typeof acceleration.y !== 'number') return;

    rawGravityX = acceleration.x;
    rawGravityY = acceleration.y;
    lastMotionAt = now;
    motionSeen = true;
    sensorSeen = true;

    if (!gravityFilterReady) {
      filteredGravityX = rawGravityX;
      filteredGravityY = rawGravityY;
      gravityFilterReady = true;
    } else {
      filteredGravityX += (rawGravityX - filteredGravityX) * SETTINGS.gravityFilter;
      filteredGravityY += (rawGravityY - filteredGravityY) * SETTINGS.gravityFilter;
    }

    const gravityMagnitude = Math.hypot(filteredGravityX, filteredGravityY);
    if (gravityMagnitude >= SETTINGS.gravityPlaneMinimum) {
      const gravityAngle = Math.atan2(filteredGravityY, filteredGravityX);
      if (steeringReferenceAngle === null) {
        steeringReferenceAngle = gravityAngle;
        steeringTiltDegrees = 0;
        setStatus('INCLINA A UN LADO PARA DOBLAR', true);
      } else {
        steeringTiltDegrees = normalizeAngle(gravityAngle - steeringReferenceAngle) * 180 / Math.PI;
      }
    }
  }

  function onOrientation(event) {
    if (typeof event.beta !== 'number' || typeof event.gamma !== 'number') return;
    if (!sensorSeen) {
      sensorSeen = true;
      setStatus('ESPERANDO GIRO DEL DISPOSITIVO', false);
    }
  }

  function calibrate() {
    smoothSteering = 0;
    steeringReferenceAngle = null;
    steeringTiltDegrees = 0;
    steeringDirectionStatus = 'center';
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    updateSteeringIndicator(0);

    if (motionSeen && gravityFilterReady) {
      filteredGravityX = rawGravityX;
      filteredGravityY = rawGravityY;
      if (Math.hypot(filteredGravityX, filteredGravityY) >= SETTINGS.gravityPlaneMinimum) {
        steeringReferenceAngle = Math.atan2(filteredGravityY, filteredGravityX);
      }
    }

    setStatus(sensorSeen ? 'CONTROL RECALIBRADO' : 'CONTROL LISTO', sensorSeen);
  }

  async function enableSensor() {
    const motionSupported = typeof DeviceMotionEvent !== 'undefined';
    const orientationSupported = typeof DeviceOrientationEvent !== 'undefined';
    if (!motionSupported && !orientationSupported) return false;
    if (sensorEnabled) return true;

    try {
      const motionPermissionRequest = motionSupported && typeof DeviceMotionEvent.requestPermission === 'function'
        ? DeviceMotionEvent.requestPermission()
        : Promise.resolve(motionSupported ? 'granted' : 'unavailable');
      const orientationPermissionRequest = orientationSupported && typeof DeviceOrientationEvent.requestPermission === 'function'
        ? DeviceOrientationEvent.requestPermission()
        : Promise.resolve(orientationSupported ? 'granted' : 'unavailable');
      const [motionPermission, orientationPermission] = await Promise.allSettled([
        motionPermissionRequest,
        orientationPermissionRequest
      ]);
      const motionAllowed = motionPermission.status === 'fulfilled' && motionPermission.value === 'granted';
      const orientationAllowed = orientationPermission.status === 'fulfilled' && orientationPermission.value === 'granted';
      if (!motionAllowed && !orientationAllowed) {
        setStatus('SENSOR NO AUTORIZADO', false);
        return false;
      }

      if (motionAllowed) window.addEventListener('devicemotion', onMotion, true);
      if (orientationAllowed) window.addEventListener('deviceorientation', onOrientation, true);
      sensorEnabled = true;
      setStatus('BUSCANDO SENSOR DE MOVIMIENTO', false);
      window.setTimeout(() => {
        if (!sensorSeen) setStatus('CONTROL LISTO', false);
      }, 1600);
      return true;
    } catch (error) {
      console.warn('Sensor no disponible:', error);
      setStatus('CONTROL LISTO', false);
      return false;
    }
  }

  function triggerEffect(pocket, now) {
    if (activeEffect) {
      effectsRoot.remove(activeEffect.points, activeEffect.ring);
      activeEffect.points.geometry.dispose();
      activeEffect.points.material.dispose();
      activeEffect.ring.geometry.dispose();
      activeEffect.ring.material.dispose();
    }

    const config = SCENARIOS[currentScenario];
    const pocketPosition = physicsToWorld(pocket.body.position.x, pocket.body.position.y);
    const count = mobileOptimized ? 20 : 34;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pocketPosition.x;
      positions[i * 3 + 1] = .18;
      positions[i * 3 + 2] = pocketPosition.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = .9 + Math.random() * 2;
      velocities.push(new THREE.Vector3(Math.cos(angle) * speed, 1.4 + Math.random() * 2.4, Math.sin(angle) * speed));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: config.accent,
      size: Math.max(.075, ballWorldRadius * .16),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    effectsRoot.add(points);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: config.secondary,
      transparent: true,
      opacity: .72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const ring = addMesh(effectsRoot, new THREE.RingGeometry(goalWorldRadius * .72, goalWorldRadius * .82, geometryDetail.ring), ringMaterial, {
      position: [pocketPosition.x, .13, pocketPosition.z],
      rotation: [-Math.PI / 2, 0, 0]
    });
    activeEffect = { points, ring, velocities, start: now };
  }

  function updateEffect(now) {
    if (!activeEffect) return;
    const elapsed = (now - activeEffect.start) / 1000;
    const positions = activeEffect.points.geometry.attributes.position.array;
    activeEffect.velocities.forEach((velocity, i) => {
      positions[i * 3] += velocity.x * .016;
      positions[i * 3 + 1] += velocity.y * .016;
      positions[i * 3 + 2] += velocity.z * .016;
      velocity.y -= 4.8 * .016;
    });
    activeEffect.points.geometry.attributes.position.needsUpdate = true;
    activeEffect.points.material.opacity = clamp(1 - elapsed / .86, 0, 1);
    const ringScale = 1 + easeOutCubic(clamp(elapsed / .7, 0, 1)) * 2.1;
    activeEffect.ring.scale.setScalar(ringScale);
    activeEffect.ring.material.opacity = clamp(.72 * (1 - elapsed / .72), 0, .72);
    if (elapsed > .9) {
      effectsRoot.remove(activeEffect.points, activeEffect.ring);
      activeEffect.points.geometry.dispose();
      activeEffect.points.material.dispose();
      activeEffect.ring.geometry.dispose();
      activeEffect.ring.material.dispose();
      activeEffect = null;
    }
  }

  function showResult() {
    resultCallout.classList.remove('show');
    void resultCallout.offsetWidth;
    resultCallout.classList.add('show');
  }

  function commitScore(capture, now) {
    if (capture.scored) return;
    capture.scored = true;
    capture.ball.scored = true;
    score += 1;
    scoreValue.textContent = String(score).padStart(2, '0');
    const remaining = balls.filter(ball => !ball.scored).length;
    resultText.textContent = remaining === 0
      ? 'RONDA COMPLETA'
      : `EMBOCADA - QUEDAN ${remaining}`;
    showResult();
    triggerEffect(capture.pocket, now);
    audio.playPocket();
    if (navigator.vibrate) navigator.vibrate([32, 24, 48]);
  }

  function beginCapture(ball, pocket, now) {
    if (ball.state !== 'active') return;
    ball.state = 'capturing';
    const capture = {
      ball,
      pocket,
      start: now,
      scored: false,
      from: physicsToWorld(ball.body.position.x, ball.body.position.y)
    };
    captures.push(capture);
    Body.setVelocity(ball.body, { x: 0, y: 0 });
    Body.setAngularVelocity(ball.body, 0);
    Body.setStatic(ball.body, true);
    ball.body.collisionFilter.mask = 0;
  }

  function updateCaptures(now) {
    if (!captures.length) return;
    const completed = [];

    captures.forEach(capture => {
      const pocket = physicsToWorld(capture.pocket.body.position.x, capture.pocket.body.position.y);
      const elapsed = now - capture.start;
      const pull = easeOutCubic(clamp(elapsed / 310, 0, 1));
      const drop = easeInCubic(clamp((elapsed - 210) / 610, 0, 1));
      const { ball } = capture;
      ball.root.position.x = lerp(capture.from.x, pocket.x, pull);
      ball.root.position.z = lerp(capture.from.z, pocket.z, pull);
      ball.root.position.y = .08 + ballWorldRadius - drop * (ballWorldRadius * 2.65 + .26);
      const scale = 1 - drop * .62;
      ball.root.scale.setScalar(Math.max(.28, scale));
      ball.root.rotation.y += .055;
      ball.root.rotation.x += .03;

      if (elapsed > 390) commitScore(capture, now);
      if (elapsed >= SETTINGS.captureDuration) {
        ball.state = 'pocketed';
        ball.root.visible = false;
        completed.push(capture);
      }
    });

    if (completed.length) {
      captures = captures.filter(capture => !completed.includes(capture));
    }
    if (balls.length && balls.every(ball => ball.state === 'pocketed')) {
      round += 1;
      chooseNextPockets();
      resetBalls();
      updateBallCountUi();
    }
  }

  function normalizeAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function steeringAfterDeadZone(tiltDegrees) {
    const magnitude = Math.abs(tiltDegrees);
    if (magnitude <= SETTINGS.tiltDeadZone) return 0;
    const usableRange = Math.max(1, SETTINGS.tiltMaximum - SETTINGS.tiltDeadZone);
    return Math.sign(tiltDegrees) * clamp(
      (magnitude - SETTINGS.tiltDeadZone) / usableRange,
      0,
      1
    );
  }

  function updateSteeringIndicator(value) {
    const percent = Math.round(clamp(value, -1, 1) * 100);
    if (percent === displayedSteeringPercent) return;
    displayedSteeringPercent = percent;
    const direction = percent < -8 ? 'left' : percent > 8 ? 'right' : 'center';
    const valueText = direction === 'center'
      ? 'Rumbo recto'
      : `Doblando ${Math.abs(percent)}% hacia la ${direction === 'left' ? 'izquierda' : 'derecha'}`;
    steeringMarker.style.left = `${50 + percent * .42}%`;
    steeringIndicator.dataset.direction = direction;
    steeringIndicator.setAttribute('aria-valuenow', String(percent));
    steeringIndicator.setAttribute('aria-valuetext', valueText);
    steeringIndicator.title = valueText;
  }

  Events.on(engine, 'beforeUpdate', event => {
    if (!started) return;
    const now = performance.now();
    const tiltFresh = motionSeen
      && steeringReferenceAngle !== null
      && now - lastMotionAt < 350;
    const sensorSteering = tiltFresh && !orientationMismatch
      ? steeringAfterDeadZone(steeringTiltDegrees)
      : 0;
    const targetSteering = mobileOptimized ? sensorSteering : keyboardX;

    const frameScale = clamp((event.delta || 16.67) / 16.67, .5, 2);
    const steeringResponse = Math.abs(targetSteering) < .001
      ? SETTINGS.steeringRelease
      : SETTINGS.steeringSmoothing;
    const steeringBlend = 1 - Math.pow(1 - steeringResponse, frameScale);
    smoothSteering += (clamp(targetSteering, -1, 1) - smoothSteering) * steeringBlend;
    updateSteeringIndicator(smoothSteering);

    const nextSteeringDirection = smoothSteering < -.08
      ? 'left'
      : smoothSteering > .08 ? 'right' : 'center';
    if (nextSteeringDirection !== steeringDirectionStatus) {
      steeringDirectionStatus = nextSteeringDirection;
      setStatus(
        nextSteeringDirection === 'left'
          ? 'DOBLANDO A LA IZQUIERDA'
          : nextSteeringDirection === 'right'
            ? 'DOBLANDO A LA DERECHA'
            : 'RUMBO RECTO',
        true
      );
    }

    balls.forEach(ball => {
      if (ball.state !== 'active') return;
      const currentVelocity = ball.body.velocity;
      const speed = Math.hypot(currentVelocity.x, currentVelocity.y);
      const currentHeading = speed > .01
        ? Math.atan2(currentVelocity.y, currentVelocity.x)
        : ball.heading;
      ball.heading = currentHeading;

      const accelerationBlend = 1 - Math.pow(1 - SETTINGS.autoAcceleration, frameScale);
      const nextSpeed = clamp(lerp(speed, autoSpeed, accelerationBlend), 0, maxSpeed);
      Body.setVelocity(ball.body, {
        x: Math.cos(currentHeading) * nextSpeed,
        y: Math.sin(currentHeading) * nextSpeed
      });

      if (Math.abs(smoothSteering) > .001) {
        Body.applyForce(ball.body, ball.body.position, {
          x: -Math.sin(currentHeading) * ball.body.mass * steeringForce * smoothSteering,
          y: Math.cos(currentHeading) * ball.body.mass * steeringForce * smoothSteering
        });
      }

      let assistedPocket = null;
      let assistedDistance = pocketAssistRadius;
      pockets.forEach(pocket => {
        const distance = Math.hypot(
          pocket.body.position.x - ball.body.position.x,
          pocket.body.position.y - ball.body.position.y
        );
        if (distance < assistedDistance) {
          assistedPocket = pocket;
          assistedDistance = distance;
        }
      });
      if (assistedPocket && assistedDistance > .001) {
        const assistX = (assistedPocket.body.position.x - ball.body.position.x) / assistedDistance;
        const assistY = (assistedPocket.body.position.y - ball.body.position.y) / assistedDistance;
        const forwardAlignment = Math.cos(currentHeading) * assistX + Math.sin(currentHeading) * assistY;
        if (forwardAlignment > .15) {
          const assistRange = Math.max(1, pocketAssistRadius - goalRadius);
          const proximity = 1 - clamp((assistedDistance - goalRadius) / assistRange, 0, 1);
          const assistForce = ball.body.mass * pocketAssistForce * proximity;
          Body.applyForce(ball.body, ball.body.position, {
            x: assistX * assistForce,
            y: assistY * assistForce
          });
        }
      }

      const captureDistance = goalRadius - ballRadius * .46;
      const targetPocket = pockets.find(pocket => (
        Math.hypot(ball.body.position.x - pocket.body.position.x, ball.body.position.y - pocket.body.position.y) < captureDistance
      ));
      if (targetPocket) beginCapture(ball, targetPocket, performance.now());
    });
  });

  Events.on(engine, 'collisionStart', event => {
    event.pairs.forEach(pair => {
      const firstBall = ballByBodyId.get(pair.bodyA.id);
      const secondBall = ballByBodyId.get(pair.bodyB.id);
      if (firstBall?.state === 'active' && secondBall?.state === 'active') {
        const relativeSpeed = Math.hypot(
          pair.bodyA.velocity.x - pair.bodyB.velocity.x,
          pair.bodyA.velocity.y - pair.bodyB.velocity.y
        );
        audio.playCollision(relativeSpeed / maxSpeed);
      }

      const wall = pair.bodyA.label.startsWith('wall-') ? pair.bodyA
        : pair.bodyB.label.startsWith('wall-') ? pair.bodyB
          : null;
      const body = pair.bodyA.label === 'ball' ? pair.bodyA
        : pair.bodyB.label === 'ball' ? pair.bodyB
          : null;
      const ball = body ? ballByBodyId.get(body.id) : null;
      if (!wall || !ball || ball.state !== 'active') return;

      const velocity = { x: body.velocity.x, y: body.velocity.y };
      if (wall.label === 'wall-top' || wall.label === 'wall-bottom') {
        velocity.y *= SETTINGS.wallBounceMultiplier;
      } else {
        velocity.x *= SETTINGS.wallBounceMultiplier;
      }
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > maxSpeed) {
        const factor = maxSpeed / speed;
        velocity.x *= factor;
        velocity.y *= factor;
      }
      Body.setVelocity(body, velocity);
    });
  });

  function rotateBall(ball, deltaSeconds) {
    if (!ball.mesh || ball.state !== 'active') return;
    const vx = ball.body.velocity.x * worldW / W;
    const vz = ball.body.velocity.y * worldD / H;
    const speed = Math.hypot(vx, vz);
    if (speed < .0001) return;
    ballRotationAxis.set(vz, 0, -vx).normalize();
    const angle = speed * deltaSeconds * 62 / Math.max(ballWorldRadius, .001);
    ball.mesh.rotateOnWorldAxis(ballRotationAxis, angle);
  }

  function animate(now) {
    const delta = Math.min(32, Math.max(0, now - lastFrame));
    lastFrame = now;
    if (!orientationMismatch) {
      if (started) Engine.update(engine, delta || 16.67);
      updateBallVisuals();
      balls.forEach(ball => rotateBall(ball, delta / 1000));
      updateCaptures(now);
      updateEffect(now);

      const pulseWave = Math.sin(now * .0035);
      pockets.forEach(pocket => {
        if (!pocket.pulse) return;
        pocket.pulse.scale.setScalar(1 + pulseWave * .055);
        pocket.pulse.material.opacity = .23 + pulseWave * .09;
      });

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }

  function resolveCaptures() {
    captures.forEach(capture => {
      const { ball } = capture;
      if (capture.scored) {
        ball.state = 'pocketed';
        if (ball.root) ball.root.visible = false;
        return;
      }
      ball.state = 'active';
      ball.body.collisionFilter.mask = 0xFFFFFFFF;
      Body.setStatic(ball.body, false);
      if (ball.root) {
        ball.root.rotation.set(0, 0, 0);
        ball.root.scale.setScalar(1);
      }
      updateBallVisual(ball);
    });
    captures = [];
    if (balls.length && balls.every(ball => ball.state === 'pocketed')) {
      round += 1;
      chooseNextPockets();
      resetBalls();
      updateBallCountUi();
    }
  }

  function resize() {
    const previousW = W;
    const previousH = H;
    const previousBallRadius = ballRadius;
    const previousGoalRadius = goalRadius;
    const nextW = Math.max(320, stage.clientWidth || window.innerWidth);
    const nextH = Math.max(320, stage.clientHeight || window.innerHeight);
    if (nextW === previousW && nextH === previousH) return;
    resolveCaptures();
    const ballRatios = balls.map(ball => ({
      x: ball.body.position.x / previousW,
      y: ball.body.position.y / previousH
    }));
    const pocketRatios = pockets.map(pocket => ({
      x: pocket.body.position.x / previousW,
      y: pocket.body.position.y / previousH
    }));
    W = nextW;
    H = nextH;
    renderer.setSize(W, H, false);
    updateWorldMetrics();
    const ballBodyScale = ballRadius / previousBallRadius;
    const pocketBodyScale = goalRadius / previousGoalRadius;
    balls.forEach(ball => Body.scale(ball.body, ballBodyScale, ballBodyScale));
    pockets.forEach(pocket => Body.scale(pocket.body, pocketBodyScale, pocketBodyScale));
    updateCamera();
    makeWalls();

    balls.forEach((ball, index) => Body.setPosition(ball.body, {
      x: clamp(ballRatios[index].x * W, ballRadius + 3, W - ballRadius - 3),
      y: clamp(ballRatios[index].y * H, ballRadius + 3, H - ballRadius - 3)
    }));
    pockets.forEach((pocket, index) => Body.setPosition(pocket.body, {
      x: clamp(pocketRatios[index].x * W, goalRadius + 8 * gameScale, W - goalRadius - 8 * gameScale),
      y: clamp(pocketRatios[index].y * H, goalRadius + 8 * gameScale, H - goalRadius - 8 * gameScale)
    }));
    buildScenario(currentScenario);
  }

  function scheduleResize(delay = 140, recalibrate = false) {
    resizeNeedsCalibration = resizeNeedsCalibration || recalibrate;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      updateOrientationState();
      if (resizeNeedsCalibration) calibrate();
      resizeNeedsCalibration = false;
    }, delay);
  }

  const keys = new Set();
  function updateKeyboard() {
    keyboardX = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  }

  window.addEventListener('keydown', event => {
    if (mobileOptimized) return;
    if (!['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) return;
    keys.add(event.code);
    updateKeyboard();
    event.preventDefault();
  });
  window.addEventListener('keyup', event => {
    if (mobileOptimized) return;
    if (!['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) return;
    keys.delete(event.code);
    updateKeyboard();
  });

  function activeBallCenterX() {
    const activeBalls = balls.filter(ball => ball.state === 'active');
    if (!activeBalls.length) return W / 2;
    return activeBalls.reduce((center, ball) => center + ball.body.position.x / activeBalls.length, 0);
  }

  stage.addEventListener('pointerdown', event => {
    if (mobileOptimized || !started || sensorSeen || !balls.some(ball => ball.state === 'active')) return;
    pointerActive = true;
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (!pointerActive || sensorSeen) return;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    keyboardX = clamp((x - activeBallCenterX()) / (170 * gameScale), -1, 1);
  });
  stage.addEventListener('pointerup', () => {
    pointerActive = false;
    if (!keys.size) {
      keyboardX = 0;
    }
  });
  stage.addEventListener('pointercancel', () => {
    pointerActive = false;
    if (!keys.size) {
      keyboardX = 0;
    }
  });

  document.querySelectorAll('.scene-tab').forEach(button => {
    button.addEventListener('click', () => {
      const sceneId = button.dataset.scene;
      if (!SCENARIOS[sceneId] || sceneId === currentScenario) return;
      resolveCaptures();
      buildScenario(sceneId);
    });
  });

  removeBallBtn.addEventListener('click', () => setBallCount(selectedBallCount - 1));
  addBallBtn.addEventListener('click', () => setBallCount(selectedBallCount + 1));
  removePocketBtn.addEventListener('click', () => setPocketCount(selectedPocketCount - 1));
  addPocketBtn.addEventListener('click', () => setPocketCount(selectedPocketCount + 1));
  calibrateBtn.addEventListener('click', calibrate);
  orientationBtn.addEventListener('click', () => {
    setStatus('HORIZONTAL FIJA · LADO PRINCIPAL', sensorSeen);
    void lockSelectedOrientation();
  });
  soundBtn.addEventListener('click', () => {
    const soundEnabled = audio.setEnabled(!audio.enabled);
    soundBtn.dataset.tooltip = soundEnabled ? 'Desactivar sonido' : 'Activar sonido';
    soundBtn.setAttribute('aria-label', soundBtn.dataset.tooltip);
    soundBtn.innerHTML = `<i data-lucide="${soundEnabled ? 'volume-2' : 'volume-x'}"></i>`;
    initIcons();
  });
  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        await lockSelectedOrientation({ enterFullscreen: false });
      }
      else await document.exitFullscreen();
    } catch (error) {
      console.warn('Pantalla completa no disponible:', error);
    }
  });

  startBtn.addEventListener('click', () => {
    started = true;
    intro.classList.add('hidden');
    audio.ensureContext();
    updateOrientationState();
    void enableSensor();
    void lockSelectedOrientation();
    void requestWakeLock();
  });

  window.addEventListener('resize', () => {
    updateOrientationState();
    scheduleResize();
  });
  window.addEventListener('orientationchange', () => {
    updateOrientationState();
    scheduleResize(280, true);
  });
  document.addEventListener('fullscreenchange', () => {
    updateOrientationState();
    scheduleResize(180, true);
    if (started && document.fullscreenElement && !orientationLockPending) {
      void lockSelectedOrientation({ enterFullscreen: false });
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void requestWakeLock();
    else void releaseWakeLock();
  });
  window.addEventListener('pagehide', () => void releaseWakeLock());

  updateWorldMetrics();
  updateCamera();
  makeWalls();
  createBallBodies(selectedBallCount);
  buildScenario(currentScenario);
  updateBallCountUi();
  updatePocketCountUi();
  updateOrientationUi();
  initIcons();
  requestAnimationFrame(animate);
})();
