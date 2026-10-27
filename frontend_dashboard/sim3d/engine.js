/**
 * OpenTwin: 3D Vehicle Simulation & Digital Twin Engine
 * Phase 1 & Phase 2.1 — Viewport, Camera, Environment, PBR Rigged Vehicle, Rapier3D Physics
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EnvironmentManager } from './environment.js';
import { VehicleRig } from './vehicle.js';
import { PhysicsEngine } from './physics.js';

export class Sim3DEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`[Sim3D] Container #${containerId} not found.`);
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.environment = null;
    this.vehicleRig = null;
    this.physics = null;
    this.cameraMode = 'chase'; // 'chase' | 'orbit' | 'cockpit'

    this.vehicleGroup = new THREE.Group();
    this.clock = new THREE.Clock();
    this.isInitialized = false;

    // Camera targets & smooth follow
    this.chaseOffset = new THREE.Vector3(0, 3.2, -7.5);
    this.chaseLookAtOffset = new THREE.Vector3(0, 1.2, 3.0);
    this.cockpitOffset = new THREE.Vector3(-0.35, 1.15, 0.2); // Left-hand drive driver position
    this.cockpitLookAtOffset = new THREE.Vector3(-0.35, 1.1, 15.0);

    // Callbacks for physics and telemetry
    this.onUpdateCallbacks = [];

    this.init();
  }

  async init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.008);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, -9);

    // 3. Renderer with antialiasing and tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls (Enabled in 'orbit' mode)
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera under floor
    this.orbitControls.minDistance = 3.0;
    this.orbitControls.maxDistance = 60.0;
    this.orbitControls.enabled = (this.cameraMode === 'orbit');

    // 5. Environment & Lighting Rig (Phase 1.2)
    this.environment = new EnvironmentManager(this.scene, this.renderer);

    // 6. Build High-Fidelity Rigged Vehicle (Phase 1.3)
    this.vehicleRig = new VehicleRig(this.scene);
    this.vehicleGroup = this.vehicleRig.root;

    // 7. Rapier3D Physics Engine (Phase 2.1)
    this.physics = new PhysicsEngine(this.vehicleRig);
    await this.physics.init();

    // 8. Handle Viewport Resizing
    this.setupResizeObserver();

    // 9. Start Render Loop
    this.isInitialized = true;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    console.log("[Sim3D] Viewport scaffold, environment, vehicle rig & physics initialized successfully.");
  }

  setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    resizeObserver.observe(this.container);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.renderer || !this.camera || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (this.orbitControls) {
      this.orbitControls.enabled = (mode === 'orbit');
      if (mode === 'orbit') {
        this.orbitControls.target.copy(this.vehicleGroup.position);
      }
    }
    console.log(`[Sim3D] Switched Camera Mode to: ${mode}`);
  }

  updateCamera(delta) {
    if (!this.vehicleGroup) return;

    if (this.cameraMode === 'chase') {
      // Calculate ideal position based on vehicle orientation
      const idealPosition = this.chaseOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);
      const idealLookAt = this.chaseLookAtOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);

      // Smooth camera interpolation
      const t = 1.0 - Math.pow(0.001, delta);
      this.camera.position.lerp(idealPosition, t);
      this.camera.lookAt(idealLookAt);
    } else if (this.cameraMode === 'cockpit') {
      const eyePosition = this.cockpitOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);
      const targetLookAt = this.cockpitLookAtOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);
      this.camera.position.copy(eyePosition);
      this.camera.lookAt(targetLookAt);
    } else if (this.cameraMode === 'orbit') {
      if (this.orbitControls) {
        this.orbitControls.target.lerp(this.vehicleGroup.position, 0.1);
        this.orbitControls.update();
      }
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Step Physics Simulation (Phase 2.1)
    if (this.physics && this.physics.isReady) {
      this.physics.step(delta);
    }

    // Follow vehicle with directional sun shadow frustum
    if (this.environment && this.vehicleGroup) {
      this.environment.update(this.vehicleGroup.position);
    }

    // Execute user registered update loops (Inputs, custom animations)
    for (const cb of this.onUpdateCallbacks) {
      cb(delta);
    }

    // Update Camera
    this.updateCamera(delta);

    // Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onUpdate(callback) {
    this.onUpdateCallbacks.push(callback);
  }
}
