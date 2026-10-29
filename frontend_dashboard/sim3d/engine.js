/**
 * OpenTwin: 3D Vehicle Simulation & Digital Twin Engine
 * Phases 1 & 2 — Viewport, Camera, Environment, PBR Rigged Vehicle,
 * Rapier3D WASM Physics, Raycast Suspension, Ackermann & Pacejka Controls
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EnvironmentManager } from './environment.js';
import { VehicleRig } from './vehicle.js';
import { PhysicsEngine } from './physics.js';
import { InputController } from './controls.js';
import { CANBridge } from './can_bridge.js';
import { VisualEffectsManager } from './effects.js';

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
    this.controls = null;
    this.canBridge = null;
    this.effects = null;
    this.headlightState = 1; // 0=Off, 1=Low Beam, 2=High Beam
    this.cameraMode = 'chase'; // 'chase' | 'orbit' | 'cockpit'

    this.vehicleGroup = new THREE.Group();
    this.clock = new THREE.Clock();
    this.isInitialized = false;

    // Camera targets & smooth follow
    this.chaseOffset = new THREE.Vector3(0, 3.2, -7.5);
    this.chaseLookAtOffset = new THREE.Vector3(0, 1.2, 3.0);
    this.cockpitOffset = new THREE.Vector3(-0.35, 1.15, 0.2); // Left-hand drive driver position
    this.cockpitLookAtOffset = new THREE.Vector3(-0.35, 1.1, 15.0);

    // Callbacks for external telemetry and bus synchronization
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
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
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

    // 7. Keyboard Driving Input Controller (Phase 2.4 & 5.2)
    this.controls = new InputController();
    this.controls.onReset = () => {
      if (this.physics) this.physics.resetPosition();
    };
    this.controls.onToggleLights = () => {
      this.headlightState = (this.headlightState + 1) % 3;
      if (this.vehicleRig) this.vehicleRig.setHeadlights(this.headlightState);
    };
    const envPresets = ['day', 'dusk', 'night'];
    let envPresetIdx = 0;
    this.controls.onToggleNightMode = () => {
      envPresetIdx = (envPresetIdx + 1) % envPresets.length;
      if (this.environment) this.environment.setLightingPreset(envPresets[envPresetIdx]);
    };

    // 8. Rapier3D Physics Engine (Phase 2)
    this.physics = new PhysicsEngine(this.vehicleRig);
    await this.physics.init();

    // 9. Bidirectional CAN Bus Bridge (Phase 4.1)
    this.canBridge = new CANBridge(this);

    // 10. Dynamic Tire Smoke Particles & Persistent Skidmarks (Phase 5.3)
    this.effects = new VisualEffectsManager(this.scene);

    // 11. Handle Viewport Resizing
    this.setupResizeObserver();

    // 12. Start Render Loop
    this.isInitialized = true;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    console.log("[Sim3D] Complete 3D Digital Twin simulation engine initialized successfully.");
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
      const idealPosition = this.chaseOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);
      const idealLookAt = this.chaseLookAtOffset.clone().applyQuaternion(this.vehicleGroup.quaternion).add(this.vehicleGroup.position);

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

    // Update Input State (Phase 2.4)
    if (this.controls) {
      this.controls.update(delta);
    }

    // Step Physics Simulation (Phase 2)
    if (this.physics && this.physics.isReady) {
      this.physics.step(delta, this.controls);
      if (this.vehicleRig) {
        this.vehicleRig.setReverse(this.physics.isReversing);
      }
    }

    // Transmit Live CAN Frames (Phase 4.1)
    if (this.canBridge) {
      this.canBridge.update(delta);
    }

    // Dynamic Tire Smoke & Skidmarks (Phase 5.3)
    if (this.effects) {
      this.effects.update(delta, this.physics);
    }

    // Follow vehicle with directional sun shadow frustum
    if (this.environment && this.vehicleGroup) {
      this.environment.update(this.vehicleGroup.position);
    }

    // Execute user registered update loops (Custom callbacks)
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
