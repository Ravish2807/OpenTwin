/**
 * OpenTwin: 3D Vehicle Physics Engine
 * Phase 2.1 & 2.2 — Rapier3D WASM & 4-Wheel Raycast Suspension Dynamics
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
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
    this.initialY = 0.75;    // Initial drop height

    // Suspension specifications
    this.wheelbaseHalf = 1.3;
    this.trackHalf = 0.8;
    this.mountY = 0.42;
    this.wheelRadius = 0.34;
    this.suspensionRestLength = 0.48; // meters
    this.springStiffness = 34000;     // N/m
    this.springDamping = 4400;        // N*s/m

    // 4 Wheels: FL, FR, RL, RR
    this.wheels = [
      { id: 'FL', localPos: new THREE.Vector3(-this.trackHalf, this.mountY, this.wheelbaseHalf), prevComp: 0, comp: 0, contact: false, visualY: this.wheelRadius },
      { id: 'FR', localPos: new THREE.Vector3(this.trackHalf, this.mountY, this.wheelbaseHalf), prevComp: 0, comp: 0, contact: false, visualY: this.wheelRadius },
      { id: 'RL', localPos: new THREE.Vector3(-this.trackHalf, this.mountY, -this.wheelbaseHalf), prevComp: 0, comp: 0, contact: false, visualY: this.wheelRadius },
      { id: 'RR', localPos: new THREE.Vector3(this.trackHalf, this.mountY, -this.wheelbaseHalf), prevComp: 0, comp: 0, contact: false, visualY: this.wheelRadius }
    ];
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
        .setRestitution(0.02);
      this.groundBody = this.world.createCollider(groundDesc);

      // 3. Dynamic Vehicle Chassis RigidBody
      const chassisBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0.0, this.initialY, 0.0)
        .setLinearDamping(0.15)
        .setAngularDamping(0.35)
        .setCcdEnabled(true);
      this.chassisBody = this.world.createRigidBody(chassisBodyDesc);

      // Chassis Main Collider Box (elevated slightly above ground level for suspension clearance)
      const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.28, 2.1)
        .setTranslation(0.0, 0.2, 0.0)
        .setMass(this.vehicleMass)
        .setFriction(0.3)
        .setRestitution(0.05);
      this.chassisCollider = this.world.createCollider(chassisColliderDesc, this.chassisBody);

      this.isReady = true;

      // Update badge if present in DOM
      const badge = document.getElementById('sim3d-physics-badge');
      if (badge) {
        badge.innerText = '⚡ RAPIER3D WASM ACTIVE';
        badge.className = 'badge badge-green';
      }

      console.log("[Physics] Rapier3D WASM physics world & 4-wheel raycast suspension initialized successfully.");
    } catch (err) {
      console.error("[Physics] Error loading Rapier3D WASM physics:", err);
    }
  }

  updateSuspension(dt) {
    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();

    const cPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
    const cQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);

    const worldDown = new THREE.Vector3(0, -1, 0).applyQuaternion(cQuat);
    const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cQuat);

    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];
      // World position of suspension mount
      const worldMount = wheel.localPos.clone().applyQuaternion(cQuat).add(cPos);

      // Cast Ray downwards along chassis down vector
      const ray = new this.RAPIER.Ray(
        { x: worldMount.x, y: worldMount.y, z: worldMount.z },
        { x: worldDown.x, y: worldDown.y, z: worldDown.z }
      );

      const maxRayDist = this.suspensionRestLength + 0.25;
      const hit = this.world.castRay(ray, maxRayDist, true, undefined, undefined, this.chassisCollider);

      if (hit && hit.timeOfImpact < this.suspensionRestLength) {
        const dist = hit.timeOfImpact;
        const comp = this.suspensionRestLength - dist;
        const springVel = (comp - wheel.prevComp) / Math.max(dt, 0.001);
        wheel.prevComp = comp;
        wheel.comp = comp;
        wheel.contact = true;

        // Spring + Damper Force: F = k * x + c * v
        const forceMag = Math.max(0, this.springStiffness * comp + this.springDamping * springVel);

        // Apply impulse to chassis at mount point
        const impulse = {
          x: worldUp.x * forceMag * dt,
          y: worldUp.y * forceMag * dt,
          z: worldUp.z * forceMag * dt
        };
        this.chassisBody.applyImpulseAtPoint(impulse, { x: worldMount.x, y: worldMount.y, z: worldMount.z }, true);

        // Visual wheel height
        wheel.visualY = wheel.localPos.y - dist + this.wheelRadius;
      } else {
        wheel.prevComp = 0;
        wheel.comp = 0;
        wheel.contact = false;
        wheel.visualY = wheel.localPos.y - this.suspensionRestLength + this.wheelRadius;
      }
    }

    // Sync visual suspension displacement to Three.js wheel models
    if (this.vehicleRig) {
      this.vehicleRig.setSuspensionY(
        this.wheels[0].visualY,
        this.wheels[1].visualY,
        this.wheels[2].visualY,
        this.wheels[3].visualY
      );
    }
  }

  step(dt) {
    if (!this.isReady || !this.world || !this.chassisBody) return;

    const clampedDt = Math.min(dt, 0.05);

    // 1. Calculate & apply 4-wheel suspension forces
    this.updateSuspension(clampedDt);

    // 2. Step Rapier3D physics world
    this.world.timestep = clampedDt;
    this.world.step();

    // 3. Sync chassis translation & rotation to Three.js vehicleRig root
    const trans = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    this.vehicleRig.root.position.set(trans.x, trans.y, trans.z);
    this.vehicleRig.root.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
}
