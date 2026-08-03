/* ============================================================
   STACK - 3D logo story experience (Three.js)
   Existing three-bar STACK mark. Soft cursor parallax +
   scroll-driven story poses via setStoryProgress().
   ============================================================ */
/* Relative URL — works on every Safari/iPadOS without import maps. */
import * as THREE from "./vendor/three.module.js";

/* Story logo stays fully interactive even when the OS asks for reduced motion
   (common on iPhone 16). UI chrome elsewhere still respects prefers-reduced-motion. */
const STORY_MOTION = true;

/** True iPad / iPadOS — not iPhone. Large canvas is why Safari chokes here. */
function isIPadDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad/.test(ua)) return true;
  // iPadOS 13+ reports as Mac with touch.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createRoundedBoxGeometry(width, height, depth, radius = 0.055, lite = false) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 0.04,
    bevelEnabled: true,
    bevelSegments: lite ? 1 : 4,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    curveSegments: lite ? 3 : 8,
    steps: 1,
  });
  geometry.center();

  // Normalize after beveling so the original STACK proportions remain exact.
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  geometry.scale(width / size.x, height / size.y, depth / size.z);
  geometry.computeVertexNormals();
  if (geometry.attributes.uv && !geometry.attributes.uv1) {
    geometry.setAttribute("uv1", geometry.attributes.uv.clone());
  }
  return geometry;
}

function drawTrackedText(ctx, text, centerX, baselineY, tracking) {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
  let x = centerX - totalWidth / 2;

  chars.forEach((char, index) => {
    ctx.fillText(char, x, baselineY);
    x += widths[index] + tracking;
  });
}

function createEngravingTexture(text, index) {
  const canvas = document.createElement("canvas");
  const ipad = isIPadDevice();
  canvas.width = ipad ? 1024 : 2048;
  canvas.height = ipad ? 160 : 320;
  const ctx = canvas.getContext("2d");
  const longLine = index === 2;
  const fontSize = ipad
    ? longLine
      ? 28
      : index === 1
        ? 40
        : 48
    : longLine
      ? 48
      : index === 1
        ? 68
        : 82;
  const tracking = longLine ? (ipad ? 3 : 6) : ipad ? 6 : 11;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 ${fontSize}px "General Sans", Arial, sans-serif`;
  ctx.textBaseline = "middle";
  drawTrackedText(ctx, text, canvas.width / 2, canvas.height / 2 + 2, tracking);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = ipad ? 1 : 8;
  texture.needsUpdate = true;
  return texture;
}

function createStudioEnvironment(renderer, { lite = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = lite ? 512 : 1024;
  canvas.height = lite ? 256 : 512;
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#8f969b");
  background.addColorStop(0.2, "#24282b");
  background.addColorStop(0.52, "#070809");
  background.addColorStop(0.82, "#171a1c");
  background.addColorStop(1, "#555c61");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Large studio softboxes become long, controlled reflections in the metal.
  const softbox = ctx.createLinearGradient(0, 0, canvas.width, 0);
  softbox.addColorStop(0, "rgba(255,255,255,0)");
  softbox.addColorStop(0.42, "rgba(255,255,255,0.1)");
  softbox.addColorStop(0.5, "rgba(255,255,255,0.92)");
  softbox.addColorStop(0.58, "rgba(255,255,255,0.1)");
  softbox.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = softbox;
  const bandY = lite ? 17 : 34;
  const bandH = lite ? 37 : 74;
  ctx.fillRect(0, bandY, canvas.width, bandH);
  ctx.fillRect(0, lite ? 202 : 404, canvas.width, lite ? 12 : 24);

  ctx.fillStyle = "rgba(210,225,236,0.7)";
  ctx.fillRect(lite ? 43 : 86, lite ? 68 : 135, lite ? 9 : 18, lite ? 118 : 235);
  ctx.fillStyle = "rgba(255,246,232,0.5)";
  ctx.fillRect(lite ? 425 : 850, lite ? 79 : 158, lite ? 6 : 11, lite ? 92 : 185);

  const source = new THREE.CanvasTexture(canvas);
  source.mapping = THREE.EquirectangularReflectionMapping;
  source.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(source).texture;
  source.dispose();
  pmrem.dispose();
  return environment;
}

function mixPose(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    rz: lerp(a.rz, b.rz, t),
    opacity: lerp(a.opacity, b.opacity, t),
  };
}

const HOME = [
  { x: 0, y: 0.82, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1 },
  { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1 },
  { x: 0, y: -0.82, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1 },
];

const WORLD = [
  { x: 0, y: 1.4, z: 7, rx: 0.05, ry: -Math.PI / 6, rz: 0.025, opacity: 1 },
  { x: 6.06, y: -1.4, z: -3.5, rx: -0.04, ry: Math.PI / 2, rz: -0.025, opacity: 1 },
  { x: -6.06, y: 0, z: -3.5, rx: 0.04, ry: (-Math.PI * 5) / 6, rz: 0.02, opacity: 1 },
];

const CAMERA_HOME = { x: 0, y: 0.35, z: 9.2, tx: 0, ty: 0, tz: 0 };

function cameraAtBar(current, next, framingOffset) {
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const length = Math.hypot(dx, dz) || 1;
  const forwardX = dx / length;
  const forwardZ = dz / length;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const viewingDistance = 6.3;

  return {
    x: current.x - forwardX * viewingDistance,
    y: current.y + 0.25,
    z: current.z - forwardZ * viewingDistance,
    tx: current.x + rightX * framingOffset,
    ty: current.y,
    tz: current.z + rightZ * framingOffset,
  };
}

const CAMERA_TOP = cameraAtBar(WORLD[0], WORLD[1], 0.95);
const CAMERA_LEFT = cameraAtBar(WORLD[1], WORLD[2], -0.95);
const CAMERA_RIGHT = cameraAtBar(WORLD[2], WORLD[0], 0.95);
const CAMERA_TOP_FINAL = cameraAtBar(WORLD[0], WORLD[1], 0);

function mixCamera(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    tx: lerp(a.tx, b.tx, t),
    ty: lerp(a.ty, b.ty, t),
    tz: lerp(a.tz, b.tz, t),
  };
}

function orbitTransition(a, b, t) {
  let angleA = Math.atan2(a.x, a.z);
  let angleB = Math.atan2(b.x, b.z);
  while (angleB <= angleA) angleB += Math.PI * 2;

  const angle = lerp(angleA, angleB, t);
  const radius = lerp(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), t);
  const mixed = mixCamera(a, b, t);
  mixed.x = Math.sin(angle) * radius;
  mixed.z = Math.cos(angle) * radius;
  return mixed;
}

export class StackLogo3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.wrap = canvas.parentElement;

    this.mouse = { x: 0, y: 0 };
    this.mouseTarget = { x: 0, y: 0 };
    this.storyProgress = 0;
    this.storyTarget = 0;
    this.settle = 0;
    this.settleTarget = 0;
    this.cameraCurrent = { ...CAMERA_HOME };
    this.rot = { x: -0.08, y: 0.28 };
    this.rotTarget = { x: -0.08, y: 0.28 };
    this.velocity = { x: 0, y: 0 };
    this.dragging = false;
    this.pendingDrag = false;
    this.activePointerId = null;
    this.lastPointer = { x: 0, y: 0 };
    this.pointerOrigin = { x: 0, y: 0 };
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.running = false;
    this.time = 0;
    this.autoRotation = 0;
    this.isMobile = false;
    this.isTabletPortrait = false;
    this.ipad = false;
    this.barScale = 1;
    this.baseScale = 1;

    this._initScene();
    this._bindEvents();
    this._observeVisibility();
    this.resize();
    this.start();
  }

  _initScene() {
    const rect = this.wrap.getBoundingClientRect();
    const ipad = isIPadDevice();
    this.ipad = ipad;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !ipad,
      powerPreference: ipad ? "default" : "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    // Full CSS size + capped DPR: sharp enough without desktop fill-rate.
    const bufferScale = 1;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, ipad ? 1.5 : 1.85)
    );
    this.renderer.setSize(
      Math.max(1, (rect.width || 1) * bufferScale),
      Math.max(1, (rect.height || 1) * bufferScale),
      false
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !ipad;
    if (!ipad) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000000, 9, 28);
    // Lite PMREM on iPad keeps metal looking like desktop without full studio cost.
    this.environment = createStudioEnvironment(this.renderer, { lite: ipad });
    this.scene.environment = this.environment;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(0, 0.35, 9.2);

    this.scene.add(
      new THREE.HemisphereLight(0xe8eef2, 0x111315, ipad ? 0.72 : 0.58)
    );

    if (ipad) {
      // Directional lights + env map ≈ desktop metal without SpotLight shadows.
      this.key = new THREE.DirectionalLight(0xfffcf6, 2.4);
      this.key.position.set(3.8, 7.5, 5.2);
      this.scene.add(this.key);

      this.fill = new THREE.DirectionalLight(0xc9e4f2, 1.05);
      this.fill.position.set(-6.5, 2.2, 5.8);
      this.scene.add(this.fill);

      this.rim = new THREE.DirectionalLight(0xffffff, 1.55);
      this.rim.position.set(1.5, 3.2, -6);
      this.scene.add(this.rim);

      this.lowerFill = new THREE.PointLight(0xaebcc5, 6, 14, 2);
      this.lowerFill.position.set(0, -3.5, 3);
      this.scene.add(this.lowerFill);
    } else {
      this.key = new THREE.SpotLight(0xfffcf6, 82, 32, Math.PI / 5.5, 0.82, 1.35);
      this.key.position.set(3.8, 7.5, 5.2);
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(1024, 1024);
      this.key.shadow.bias = -0.00035;
      this.key.shadow.normalBias = 0.025;
      this.key.target.position.set(0, 0, 0);
      this.scene.add(this.key, this.key.target);

      this.fill = new THREE.SpotLight(0xc9e4f2, 25, 28, Math.PI / 4, 0.9, 1.5);
      this.fill.position.set(-6.5, 2.2, 5.8);
      this.fill.target.position.set(0, 0, 0);
      this.scene.add(this.fill, this.fill.target);

      this.rim = new THREE.SpotLight(0xffffff, 58, 30, Math.PI / 5, 0.9, 1.25);
      this.rim.position.set(1.5, 3.2, -6);
      this.rim.target.position.set(0, 0, 0);
      this.scene.add(this.rim, this.rim.target);

      this.lowerFill = new THREE.PointLight(0xaebcc5, 4.5, 12, 2);
      this.lowerFill.position.set(0, -3.5, 3);
      this.scene.add(this.lowerFill);
    }

    // These broad lights are reserved for the separated scroll poses.
    // Their intensity stays at zero while the assembled logo is in the hero.
    this.storyKey = new THREE.DirectionalLight(0xfffdf8, 0);
    this.storyKey.position.set(5, 8, 8);
    this.scene.add(this.storyKey);

    this.storyFill = new THREE.DirectionalLight(0xd9edfa, 0);
    this.storyFill.position.set(-7, 3, 6);
    this.scene.add(this.storyFill);

    this.storyRim = new THREE.DirectionalLight(0xffffff, 0);
    this.storyRim.position.set(1, 4, -8);
    this.scene.add(this.storyRim);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const barWidth = 2.7;
    const barHeight = 0.52;
    const barDepth = 0.85;
    const barGeo = createRoundedBoxGeometry(
      barWidth,
      barHeight,
      barDepth,
      0.055,
      ipad
    );

    this.bars = HOME.map((pose, index) => {
      // Standard + lite env on iPad ≈ desktop metal without Physical extras.
      const material = ipad
        ? new THREE.MeshStandardMaterial({
            color: 0xbfc4c7,
            emissive: 0x111315,
            emissiveIntensity: 0.03,
            metalness: 0.94,
            roughness: 0.3,
            envMapIntensity: 1.55,
            transparent: true,
            opacity: 1,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0xbfc4c7,
            emissive: 0x111315,
            emissiveIntensity: 0.03,
            metalness: 0.96,
            roughness: 0.29,
            anisotropy: 0.72,
            anisotropyRotation: Math.PI / 2,
            clearcoat: 0.12,
            clearcoatRoughness: 0.38,
            envMapIntensity: 1.65,
            transparent: true,
            opacity: 1,
          });
      const mesh = new THREE.Mesh(barGeo, material);
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.castShadow = !ipad;
      mesh.receiveShadow = !ipad;

      const inscriptions = [
        "STACK",
        "WEB AGENCY",
        "SANTO DOMINGO • DOMINICAN REPUBLIC",
      ];
      const engravingTexture = createEngravingTexture(inscriptions[index], index);
      const engravingMaterial = ipad
        ? new THREE.MeshStandardMaterial({
            color: 0x0b0c0d,
            emissive: 0xffffff,
            emissiveIntensity: 0,
            map: engravingTexture,
            alphaMap: engravingTexture,
            metalness: 0.78,
            roughness: 0.5,
            transparent: true,
            opacity: index === 2 ? 0.68 : 0.74,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            envMapIntensity: 0.45,
            toneMapped: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0x0b0c0d,
            emissive: 0xffffff,
            emissiveIntensity: 0,
            map: engravingTexture,
            alphaMap: engravingTexture,
            metalness: 0.78,
            roughness: 0.5,
            transparent: true,
            opacity: index === 2 ? 0.68 : 0.74,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            envMapIntensity: 0.45,
            toneMapped: false,
          });
      const engravingGeometry = new THREE.PlaneGeometry(
        barWidth * 0.82,
        barHeight * 0.58
      );
      const engraving = new THREE.Mesh(engravingGeometry, engravingMaterial);
      engraving.position.z = barDepth / 2 + 0.0015;
      engraving.renderOrder = 2;

      const rearEngraving = new THREE.Mesh(engravingGeometry, engravingMaterial);
      rearEngraving.position.z = -barDepth / 2 - 0.0015;
      rearEngraving.rotation.y = Math.PI;
      rearEngraving.renderOrder = 2;
      mesh.add(engraving, rearEngraving);

      this.group.add(mesh);
      return {
        mesh,
        material,
        engraving,
        rearEngraving,
        engravingTexture,
        index,
        current: { ...pose },
      };
    });
  }

  _interactionEnabled() {
    return STORY_MOTION && (this.storyProgress <= 0.035 || this.storyProgress >= 0.975);
  }

  _clearPointerState() {
    this.dragging = false;
    this.pendingDrag = false;
    this.activePointerId = null;
    this.wrap.style.touchAction = "pan-y";
    this.wrap.classList.remove("is-dragging");
    this.wrap.style.cursor = this._interactionEnabled() ? "grab" : "default";
  }

  _beginOrbit(e) {
    this.pendingDrag = false;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.wrap.style.cursor = "grabbing";
    this.wrap.style.touchAction = "none";
    this.wrap.classList.add("is-dragging");
    try {
      this.wrap.setPointerCapture(e.pointerId);
    } catch (_) {
      /* Pointer capture is optional. */
    }
  }

  _hitTest(clientX, clientY) {
    const rect = this.wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.scene.updateMatrixWorld(true);
    return this.raycaster.intersectObjects(
      this.bars.map(({ mesh }) => mesh),
      false
    ).length > 0;
  }

  _bindEvents() {
    this._onPointerMove = (e) => {
      this.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseTarget.y = (e.clientY / window.innerHeight) * 2 - 1;

      // Touch: wait for axis intent so vertical swipes can leave toward Proyectos
      // while horizontal swipes still orbit the logo.
      if (
        this.pendingDrag &&
        e.pointerType === "touch" &&
        e.pointerId === this.activePointerId
      ) {
        const dx = e.clientX - this.pointerOrigin.x;
        const dy = e.clientY - this.pointerOrigin.y;
        if (Math.hypot(dx, dy) < 12) return;

        if (Math.abs(dy) > Math.abs(dx) * 1.1) {
          this._clearPointerState();
          return;
        }

        this._beginOrbit(e);
        e.preventDefault();
        return;
      }

      if (this.dragging && e.pointerId === this.activePointerId) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        const dragStrength = e.pointerType === "touch" ? 0.009 : 0.006;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.rotTarget.y += dx * dragStrength;
        this.rotTarget.x += dy * dragStrength;
        this.velocity.y = dx * 0.0012;
        this.velocity.x = dy * 0.0012;
        e.preventDefault();
        return;
      }

      if (e.pointerType === "touch") return;
      const overLogo = this._interactionEnabled() && this._hitTest(e.clientX, e.clientY);
      this.wrap.style.cursor = overLogo ? "grab" : "default";
    };
    this._onPointerDown = (e) => {
      if (!this._interactionEnabled()) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (!this._hitTest(e.clientX, e.clientY)) return;

      this.activePointerId = e.pointerId;
      this.pointerOrigin = { x: e.clientX, y: e.clientY };
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.velocity.x = 0;
      this.velocity.y = 0;

      if (e.pointerType === "touch") {
        // Defer orbit until we know the gesture is horizontal.
        this.pendingDrag = true;
        this.dragging = false;
        return;
      }

      this._beginOrbit(e);
      e.preventDefault();
    };
    this._onPointerUp = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      if (this.pendingDrag || this.dragging) {
        try {
          this.wrap.releasePointerCapture(e.pointerId);
        } catch (_) {
          /* Pointer may already be released. */
        }
      }
      this._clearPointerState();
    };
    this._onResize = () => {
      window.clearTimeout(this._resizeTimer);
      this._resizeTimer = window.setTimeout(() => this.resize(), 120);
    };

    this.wrap.addEventListener("pointerdown", this._onPointerDown, { passive: false });
    window.addEventListener("pointermove", this._onPointerMove, { passive: false });
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("resize", this._onResize, { passive: true });
  }

  _observeVisibility() {
    this.visible = true;
    this._io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.visible = entry.isIntersecting;
          if (this.visible) {
            // Do not resize here — Safari/iPad IO + pin churn was blanking the canvas.
            this.start();
          } else if (entry.intersectionRatio === 0 && entry.boundingClientRect.bottom < 0) {
            // Only pause once the hero has scrolled fully away.
            this.stop();
          }
        });
      },
      { threshold: [0, 0.02], rootMargin: "20% 0px" }
    );
    this._io.observe(this.wrap);
  }

  setStoryProgress(progress) {
    this.storyTarget = clamp(progress, 0, 1);
  }

  _mobilePoseAt(progress) {
    const p = clamp(progress, 0, 1);
    // iPad landscape: match desktop stack spacing (not the tighter phone squeeze).
    const homeSpread =
      this.ipad && !this.isTabletPortrait ? 1 : this.ipad ? 0.92 : 0.78;
    const home = HOME.map((pose) => ({ ...pose, y: pose.y * homeSpread }));
    const focusTop = [
      { x: 0, y: 0.28, z: 0, rx: 0.02, ry: 0, rz: 0, opacity: 1 },
      { x: 1.55, y: -0.72, z: -3.2, rx: -0.04, ry: 1.08, rz: -0.08, opacity: 0.28 },
      { x: -1.48, y: -0.48, z: -3.7, rx: 0.04, ry: -1.02, rz: 0.08, opacity: 0.2 },
    ];
    const focusMiddle = [
      { x: -1.35, y: 0.95, z: -3.6, rx: 0.04, ry: -0.78, rz: 0.09, opacity: 0.22 },
      { x: 0, y: 0.28, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1 },
      { x: 1.52, y: -0.72, z: -3.25, rx: -0.04, ry: 1.05, rz: -0.08, opacity: 0.28 },
    ];
    const focusBottom = [
      { x: 1.35, y: 0.95, z: -3.6, rx: 0.04, ry: 0.78, rz: -0.09, opacity: 0.22 },
      { x: -1.52, y: -0.72, z: -3.25, rx: -0.04, ry: -1.05, rz: 0.08, opacity: 0.28 },
      { x: 0, y: 0.28, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1 },
    ];

    if (p < 0.1) return home;
    if (p < 0.19) {
      const t = smoothstep(0.1, 0.19, p);
      return home.map((pose, i) => mixPose(pose, focusTop[i], t));
    }
    if (p < 0.34) return focusTop;
    if (p < 0.43) {
      const t = smoothstep(0.34, 0.43, p);
      return focusTop.map((pose, i) => mixPose(pose, focusMiddle[i], t));
    }
    if (p < 0.57) return focusMiddle;
    if (p < 0.66) {
      const t = smoothstep(0.57, 0.66, p);
      return focusMiddle.map((pose, i) => mixPose(pose, focusBottom[i], t));
    }
    if (p < 0.82) return focusBottom;

    const t = smoothstep(0.82, 0.97, p);
    return focusBottom.map((pose, i) => mixPose(pose, home[i], t));
  }

  _poseAt(progress) {
    if (this.isMobile) return this._mobilePoseAt(progress);

    const p = clamp(progress, 0, 1);
    const homePoses = HOME;

    if (p < 0.1) {
      return homePoses.map((pose) => ({ ...pose }));
    }

    if (p < 0.18) {
      const t = smoothstep(0.1, 0.18, p);
      return homePoses.map((pose, i) => mixPose(pose, WORLD[i], t));
    }

    if (p < 0.88) {
      return WORLD.map((pose) => ({ ...pose }));
    }

    const t = smoothstep(0.88, 0.97, p);
    return WORLD.map((pose, i) => mixPose(pose, homePoses[i], t));
  }

  _cameraAt(progress) {
    if (this.isTabletPortrait) {
      return { ...CAMERA_HOME, y: 0.4, z: 8.6, ty: 0.18 };
    }
    if (this.isMobile) {
      return { ...CAMERA_HOME, y: 0.42, ty: 0.2 };
    }

    const p = clamp(progress, 0, 1);

    if (p < 0.1) return { ...CAMERA_HOME };
    if (p < 0.19) {
      return mixCamera(CAMERA_HOME, CAMERA_TOP, smoothstep(0.1, 0.19, p));
    }
    if (p < 0.34) return { ...CAMERA_TOP };
    if (p < 0.43) {
      const t = smoothstep(0.34, 0.43, p);
      return orbitTransition(CAMERA_TOP, CAMERA_LEFT, t);
    }
    if (p < 0.57) return { ...CAMERA_LEFT };
    if (p < 0.66) {
      const t = smoothstep(0.57, 0.66, p);
      return orbitTransition(CAMERA_LEFT, CAMERA_RIGHT, t);
    }
    if (p < 0.8) return { ...CAMERA_RIGHT };
    if (p < 0.88) {
      const t = smoothstep(0.8, 0.88, p);
      return orbitTransition(CAMERA_RIGHT, CAMERA_TOP_FINAL, t);
    }
    if (p < 0.96) {
      return mixCamera(CAMERA_TOP_FINAL, CAMERA_HOME, smoothstep(0.88, 0.96, p));
    }
    return { ...CAMERA_HOME };
  }

  _focusWeights(progress) {
    const windowWeight = (start, end, feather = 0.035) => {
      const enter = smoothstep(start - feather, start, progress);
      const exit = 1 - smoothstep(end, end + feather, progress);
      return enter * exit;
    };

    return [
      windowWeight(0.19, 0.34),
      windowWeight(0.43, 0.57),
      windowWeight(0.66, 0.8),
    ];
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ipad = isIPadDevice();
    const mobile = width <= 1100 || ipad;
    const compactMobile = width <= 600;
    const ipadLandscape = ipad && width > height;
    // iPad / tablet portrait only — phones and landscape stay unchanged.
    const tabletPortrait = ipad
      ? height > width
      : mobile && !compactMobile && height > width;

    this.isMobile = mobile;
    this.isTabletPortrait = tabletPortrait;
    this.ipad = ipad;

    if (ipadLandscape) {
      this.barScale = 1.06;
      this.baseScale = 1.1;
      this.camera.fov = 36;
    } else if (tabletPortrait) {
      this.barScale = 0.95;
      this.baseScale = 1.08;
      this.camera.fov = 40;
    } else if (compactMobile) {
      this.barScale = 0.82;
      this.baseScale = 1;
      this.camera.fov = 42;
    } else if (mobile) {
      this.barScale = 0.88;
      this.baseScale = 1;
      this.camera.fov = 42;
    } else {
      this.barScale = 1;
      this.baseScale = 1;
      this.camera.fov = 34;
    }

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();

    const drawW = Math.max(1, Math.round(rect.width));
    const drawH = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      ipad ? 1.5 : mobile ? 1.5 : 1.85
    );
    // Avoid setSize/setPixelRatio when unchanged — those clear the buffer and flicker on iPad.
    if (this._drawW !== drawW || this._drawH !== drawH || this._pixelRatio !== pixelRatio) {
      this._drawW = drawW;
      this._drawH = drawH;
      this._pixelRatio = pixelRatio;
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(drawW, drawH, false);
    }

    this.bars?.forEach(({ mesh, engraving, rearEngraving }) => {
      mesh.scale.setScalar(this.barScale);
      const engravingScaleY = mobile ? 1.45 : 1;
      const engravingScaleX = mobile ? 1.08 : 1;
      engraving.scale.set(engravingScaleX, engravingScaleY, 1);
      rearEngraving.scale.set(engravingScaleX, engravingScaleY, 1);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _tick() {
    if (!this.running) return;
    this.time += 0.008;

    this.storyProgress = lerp(this.storyProgress, this.storyTarget, 0.11);
    this.mouse.x = lerp(this.mouse.x, this.mouseTarget.x, 0.045);
    this.mouse.y = lerp(this.mouse.y, this.mouseTarget.y, 0.045);

    const nearEnd = this.storyProgress > 0.9;
    this.settleTarget = nearEnd ? 1 : 0;
    this.settle = lerp(this.settle, this.settleTarget, 0.06);

    const interactive = this._interactionEnabled();
    const heroSpinActive = STORY_MOTION && this.storyProgress < 0.055;
    if (heroSpinActive && !this.dragging) {
      // One calm 360-degree revolution approximately every 23 seconds.
      this.autoRotation = (this.autoRotation + 0.0045) % (Math.PI * 2);
    } else if (this.storyProgress > 0.075) {
      const shortestAngle = Math.atan2(
        Math.sin(this.autoRotation),
        Math.cos(this.autoRotation)
      );
      this.autoRotation = lerp(shortestAngle, 0, 0.08);
    }
    const idleStrength =
      1 -
      smoothstep(0.035, 0.12, this.storyProgress) +
      smoothstep(0.94, 0.985, this.storyProgress);
    const idleFloat = Math.sin(this.time * 0.72) * 0.026 * idleStrength;
    const idlePitch = Math.sin(this.time * 0.48 + 0.7) * 0.006 * idleStrength;
    const idleRoll = Math.sin(this.time * 0.58) * 0.0045 * idleStrength;

    if (interactive) {
      if (!this.dragging) {
        this.rotTarget.x += this.velocity.x;
        this.rotTarget.y += this.velocity.y;
        this.velocity.x *= 0.94;
        this.velocity.y *= 0.94;
      }
      this.rot.x = lerp(this.rot.x, this.rotTarget.x, this.dragging ? 0.34 : 0.16);
      this.rot.y = lerp(this.rot.y, this.rotTarget.y, this.dragging ? 0.34 : 0.16);
      this.group.rotation.set(
        this.rot.x - this.mouse.y * 0.012 + idlePitch,
        this.rot.y + this.mouse.x * 0.016 + this.autoRotation,
        idleRoll
      );
    } else {
      if (this.dragging || this.pendingDrag) {
        this._clearPointerState();
      }
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.rotTarget.x = lerp(this.rotTarget.x, 0, 0.14);
      this.rotTarget.y = lerp(this.rotTarget.y, 0, 0.14);
      this.rot.x = lerp(this.rot.x, 0, 0.14);
      this.rot.y = lerp(this.rot.y, 0, 0.14);
      this.group.rotation.set(
        this.rot.x + idlePitch,
        this.rot.y + this.autoRotation,
        idleRoll
      );
    }
    this.group.position.y = idleFloat;

    const cameraTarget = this._cameraAt(this.storyProgress);
    Object.keys(this.cameraCurrent).forEach((key) => {
      this.cameraCurrent[key] = lerp(
        this.cameraCurrent[key],
        cameraTarget[key],
        0.14
      );
    });

    const pointerInfluence = interactive ? 1 : 0;
    this.camera.position.set(
      this.cameraCurrent.x + this.mouse.x * 0.08 * pointerInfluence,
      this.cameraCurrent.y - this.mouse.y * 0.05 * pointerInfluence,
      this.cameraCurrent.z
    );
    this.camera.lookAt(
      this.cameraCurrent.tx + this.mouse.x * 0.04 * pointerInfluence,
      this.cameraCurrent.ty - this.mouse.y * 0.03 * pointerInfluence,
      this.cameraCurrent.tz
    );

    this.rim.position.x = 1.5 + this.mouse.x * 0.7;
    this.rim.position.y = 3.2 - this.mouse.y * 0.45;
    this.fill.position.x = -6.5 + this.mouse.x * 0.3;

    // Keep the assembled hero treatment restrained, then lift only the
    // separated storytelling bars so every piece stays legible on black.
    const storyLighting =
      smoothstep(0.1, 0.18, this.storyProgress) *
      (1 - smoothstep(0.88, 0.97, this.storyProgress));
    if (this.ipad) {
      this.key.intensity = lerp(2.4, 3.2, storyLighting);
      this.fill.intensity = lerp(1.05, 1.6, storyLighting);
      this.rim.intensity = lerp(1.55, 2.2, storyLighting);
      this.lowerFill.intensity = lerp(6, 11, storyLighting);
      this.storyKey.intensity = 0.55 * storyLighting;
      this.storyFill.intensity = 0.32 * storyLighting;
      this.storyRim.intensity = 0.48 * storyLighting;
    } else {
      this.key.intensity = lerp(82, this.isMobile ? 120 : 220, storyLighting);
      this.fill.intensity = lerp(25, this.isMobile ? 48 : 90, storyLighting);
      this.rim.intensity = lerp(58, this.isMobile ? 105 : 180, storyLighting);
      this.lowerFill.intensity = lerp(4.5, this.isMobile ? 12 : 25, storyLighting);
      this.storyKey.intensity = (this.isMobile ? 0.5 : 1.4) * storyLighting;
      this.storyFill.intensity = (this.isMobile ? 0.28 : 0.8) * storyLighting;
      this.storyRim.intensity = (this.isMobile ? 0.46 : 1.2) * storyLighting;
    }

    const poses = this._poseAt(this.storyProgress);
    const focusWeights = this._focusWeights(this.storyProgress);
    const focusStrength = Math.max(...focusWeights);
    this.bars.forEach((bar, i) => {
      const target = poses[i];
      const weight = focusWeights[i];
      const inactive = focusStrength * (1 - weight);
      const dx = this.cameraCurrent.x - target.x;
      const dy = this.cameraCurrent.y - target.y;
      const dz = this.cameraCurrent.z - target.z;
      const distance = Math.hypot(dx, dy, dz) || 1;
      const depthOffset = weight * 0.24 - inactive * 0.18;
      const targetX = target.x + (dx / distance) * depthOffset;
      const targetY = target.y + (dy / distance) * depthOffset;
      const targetZ = target.z + (dz / distance) * depthOffset;

      bar.current.x = lerp(bar.current.x, targetX, 0.12);
      bar.current.y = lerp(bar.current.y, targetY, 0.12);
      bar.current.z = lerp(bar.current.z, targetZ, 0.12);
      bar.current.rx = lerp(bar.current.rx, target.rx, 0.16);
      bar.current.ry = lerp(bar.current.ry, target.ry, 0.16);
      bar.current.rz = lerp(bar.current.rz, target.rz, 0.16);
      const targetOpacity = target.opacity * lerp(1, 0.92, inactive * storyLighting);
      bar.current.opacity = lerp(bar.current.opacity, targetOpacity, 0.1);

      bar.mesh.position.set(bar.current.x, bar.current.y, bar.current.z);
      bar.mesh.rotation.set(bar.current.rx, bar.current.ry, bar.current.rz);
      bar.mesh.material.opacity = bar.current.opacity;
      const storyRed = this.isMobile
        ? lerp(0.24, 0.14, inactive)
        : lerp(0.46, 0.3, inactive);
      const storyGreen = this.isMobile
        ? lerp(0.26, 0.16, inactive)
        : lerp(0.48, 0.32, inactive);
      const storyBlue = this.isMobile
        ? lerp(0.28, 0.18, inactive)
        : lerp(0.5, 0.34, inactive);
      bar.material.color.setRGB(
        lerp(0.75, storyRed, storyLighting),
        lerp(0.77, storyGreen, storyLighting),
        lerp(0.78, storyBlue, storyLighting)
      );
      bar.material.emissiveIntensity = lerp(
        0.03,
        this.isMobile
          ? lerp(0.018, 0.028, inactive)
          : lerp(0.05, 0.08, inactive),
        storyLighting
      );
      bar.material.metalness = lerp(
        this.ipad ? 0.94 : 0.96,
        this.isMobile ? 0.93 : 0.88,
        storyLighting
      );
      bar.material.roughness = lerp(
        this.ipad ? 0.3 : 0.29,
        this.isMobile
          ? lerp(0.32, 0.4, inactive)
          : lerp(0.24, 0.34, inactive),
        storyLighting
      );
      bar.material.envMapIntensity = lerp(
        this.ipad ? 1.55 : 1.65,
        this.isMobile
          ? lerp(1.18, 0.96, inactive)
          : lerp(1.7, 1.45, inactive),
        storyLighting
      );
      const engravingBaseOpacity = i === 2 ? 0.68 : 0.74;
      const engravingStoryOpacity = lerp(1, 0.72, inactive);
      bar.engraving.material.opacity = lerp(
        engravingBaseOpacity,
        engravingStoryOpacity,
        storyLighting
      );
      bar.engraving.material.color.setRGB(
        lerp(0.035, 1, storyLighting),
        lerp(0.04, 1, storyLighting),
        lerp(0.045, 1, storyLighting)
      );
      bar.engraving.material.emissiveIntensity =
        storyLighting *
        (this.isMobile
          ? lerp(2.2, 1.2, inactive)
          : lerp(1.35, 0.85, inactive));
      bar.engraving.material.metalness = lerp(0.78, 0.12, storyLighting);
      bar.engraving.material.roughness = lerp(0.5, 0.3, storyLighting);
    });

    this.group.scale.setScalar(this.baseScale);

    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(() => this._tick());
  }

  dispose() {
    this.stop();
    window.clearTimeout(this._resizeTimer);
    this.wrap.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("resize", this._onResize);
    this._io?.disconnect();
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.alphaMap?.dispose();
      material.dispose();
    });
    this.environment?.dispose();
    this.renderer.dispose();
  }
}

export function initStoryLogo() {
  const canvas = document.getElementById("storyCanvas");
  if (!canvas) return null;

  try {
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      probe.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      console.warn("WebGL unavailable");
      return null;
    }
  } catch (err) {
    console.warn("WebGL probe failed:", err);
    return null;
  }

  try {
    return new StackLogo3D(canvas);
  } catch (err) {
    console.error("WebGL story logo unavailable:", err);
    return null;
  }
}
