/**
 * OpenTwin: 3D Vehicle Physics Engine
 * Phase 2.1 — Rapier3D WASM Integration, Physics World, and Ground Plane
 */

import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.13.1/rapier.es.js';

export class PhysicsEngine {
  constructor(vehicleRig) {
    this.vehicleRig = vehicleRig;
    this.RAPIER = null;
    this.world = null;
    this.groundBody = null;
    this.chassisBody = null;
    this.chassisCollider = null;
    this.isReady = false;

    // Vehicle physical parameters
    this.vehicleMass = 1450; // kg
    this.initialY = 0.9;     // Start slightly above ground
  }

  async init() {
    try {
      console.log("[Physics] Initializing Rapier3D WASM module...");
      await RAPIER.init();
      this.RAPIER = RAPIER;

      // 1. Create Rapier3D World with Earth Gravity (9.81 m/s²)
      const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
      this.world = new RAPIER.World(gravity);

      // 2. Static Ground Plane Collider (1000m x 1000m x 1m thickness, top surface at y=0)
      const groundDesc = RAPIER.ColliderDesc.cuboid(500.0, 0.5, 500.0)
        .setTranslation(0.0, -0.5, 0.0)
        .setFriction(0.85)
        .setRestitution(0.05);
      this.groundBody = this.world.createCollider(groundDesc);

      // 3. Dynamic Vehicle Chassis RigidBody
      const chassisBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0.0, this.initialY, 0.0)
        .setLinearDamping(0.2)
        .setAngularDamping(0.4)
        .setCcdEnabled(true);
      this.chassisBody = this.world.createRigidBody(chassisBodyDesc);

      // Chassis Main Collider Box (width: 1.82m -> half: 0.91, height: 0.6m -> half: 0.3, length: 4.3m -> half: 2.15)
      const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(0.91, 0.3, 2.15)
        .setMass(this.vehicleMass)
        .setFriction(0.4)
        .setRestitution(0.1);
      this.chassisCollider = this.world.createCollider(chassisColliderDesc, this.chassisBody);

      this.isReady = true;

      // Update badge if present in DOM
      const badge = document.getElementById('sim3d-physics-badge');
      if (badge) {
        badge.innerText = '⚡ RAPIER3D WASM ACTIVE';
        badge.className = 'badge badge-green';
      }

      console.log("[Physics] Rapier3D WASM physics world & vehicle rigid body initialized successfully.");
    } catch (err) {
      console.error("[Physics] Error loading Rapier3D WASM physics:", err);
    }
  }

  step(dt) {
    if (!this.isReady || !this.world || !this.chassisBody) return;

    // Step physics world with clamped timestep
    const clampedDt = Math.min(dt, 0.05);
    this.world.timestep = clampedDt;
    this.world.step();

    // Sync chassis translation & rotation to Three.js vehicleRig root
    const trans = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    this.vehicleRig.root.position.set(trans.x, trans.y, trans.z);
    this.vehicleRig.root.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
}
