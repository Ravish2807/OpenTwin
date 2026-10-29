/**
 * OpenTwin: 3D Vehicle Simulation — Visual Effects
 * Phase 5.3 — Dynamic Tire Smoke Particles & Persistent Asphalt Skidmarks
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class VisualEffectsManager {
  constructor(scene) {
    this.scene = scene;

    // --- 1. Dynamic Smoke Particle System ---
    this.maxParticles = 600;
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleOpacities = new Float32Array(this.maxParticles);
    this.particleSizes = new Float32Array(this.maxParticles);

    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('opacity', new THREE.BufferAttribute(this.particleOpacities, 1));
    this.particleGeo.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));

    // Procedural smoke puff sprite texture
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64;
    smokeCanvas.height = 64;
    const sctx = smokeCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(230, 235, 245, 0.8)');
    grad.addColorStop(0.4, 'rgba(200, 210, 225, 0.4)');
    grad.addColorStop(1, 'rgba(160, 175, 195, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas);

    this.smokeMaterial = new THREE.PointsMaterial({
      size: 1.2,
      map: smokeTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: false,
      color: 0xdde5ee,
      opacity: 0.6
    });

    this.smokePoints = new THREE.Points(this.particleGeo, this.smokeMaterial);
    this.smokePoints.frustumCulled = false;
    this.scene.add(this.smokePoints);

    // Particle pool state
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        age: 0,
        maxAge: 1.0,
        size: 0.8,
        opacity: 0.6
      });
    }

    // --- 2. Persistent Asphalt Skidmark Ribbons ---
    this.maxSkidSegments = 1200;
    this.skidMeshPool = [];
    this.skidGroup = new THREE.Group();
    this.scene.add(this.skidGroup);

    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0
    });

    // Last contact positions for each of the 4 wheels: FL, FR, RL, RR
    this.lastWheelSkidPos = [null, null, null, null];

    this.skidGeom = new THREE.PlaneGeometry(0.24, 0.8);
    this.skidGeom.rotateX(-Math.PI / 2);
  }

  spawnSmoke(x, y, z, vx, vy, vz) {
    const p = this.particles.find(pt => !pt.active);
    if (!p) return;

    p.active = true;
    p.x = x + (Math.random() - 0.5) * 0.2;
    p.y = y + 0.1;
    p.z = z + (Math.random() - 0.5) * 0.2;
    p.vx = vx + (Math.random() - 0.5) * 0.8;
    p.vy = vy + 0.6 + Math.random() * 0.8;
    p.vz = vz + (Math.random() - 0.5) * 0.8;
    p.age = 0;
    p.maxAge = 0.8 + Math.random() * 0.6;
    p.size = 0.9 + Math.random() * 0.5;
    p.opacity = 0.6;
  }

  addSkidmark(wheelIdx, curX, curZ, headingAngle) {
    // Drop a tire rubber mark on the asphalt
    const mark = new THREE.Mesh(this.skidGeom, this.skidMat);
    mark.position.set(curX, 0.016, curZ);
    mark.rotation.y = headingAngle;

    this.skidGroup.add(mark);
    this.skidMeshPool.push(mark);

    // Maintain max pool size by removing oldest
    if (this.skidMeshPool.length > this.maxSkidSegments) {
      const oldest = this.skidMeshPool.shift();
      this.skidGroup.remove(oldest);
      if (oldest.geometry) oldest.geometry.dispose();
    }
  }

  update(dt, physics) {
    if (!physics || !physics.isReady || !physics.chassisBody) return;

    const cPos = physics.vehicleRig.root.position;
    const cRot = physics.vehicleRig.root.quaternion;
    const linvel = physics.chassisBody.linvel();
    const wheels = physics.wheels;

    // 1. Check wheel slip and spawn effects
    for (let i = 0; i < 4; i++) {
      const wheel = wheels[i];
      if (!wheel.contact) {
        this.lastWheelSkidPos[i] = null;
        continue;
      }

      // World contact position
      const worldMount = wheel.localPos.clone().applyQuaternion(cRot).add(cPos);
      const contactX = worldMount.x;
      const contactY = 0.02;
      const contactZ = worldMount.z;

      // Wheel heading orientation
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cRot);
      const headingAngle = Math.atan2(fwd.x, fwd.z);

      // Determine slip intensity: check lateral speed or handbrake / burnout
      const speedKmh = Math.abs(physics.forwardSpeedKmh);
      const isHandbraking = (physics.engine && physics.gearbox && speedKmh > 8 && !wheel.isFront && physics.currentSteer !== 0);
      const isBurnout = (wheel.isDriven && speedKmh < 15 && physics.engineRpm > 4500);
      const isHighSlip = Math.abs(wheel.steerAngle) > 0.25 && speedKmh > 35;

      if (isHandbraking || isBurnout || isHighSlip) {
        // Spawn smoke particles
        this.spawnSmoke(contactX, contactY, contactZ, linvel.x * 0.2, linvel.y, linvel.z * 0.2);

        // Lay skidmark if moved sufficiently
        const lastPos = this.lastWheelSkidPos[i];
        if (!lastPos || Math.hypot(contactX - lastPos.x, contactZ - lastPos.z) > 0.4) {
          this.addSkidmark(i, contactX, contactZ, headingAngle);
          this.lastWheelSkidPos[i] = { x: contactX, z: contactZ };
        }
      } else {
        this.lastWheelSkidPos[i] = null;
      }
    }

    // 2. Update active smoke particles
    const positions = this.particlePositions;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        positions[i * 3 + 1] = -999; // Hide offscreen
        continue;
      }

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        positions[i * 3 + 1] = -999;
        continue;
      }

      // Physics integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += 0.3 * dt; // Slight buoyancy upward
      p.size += dt * 1.5; // Expand size

      const lifeFactor = 1.0 - (p.age / p.maxAge);
      p.opacity = lifeFactor * 0.55;

      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    this.particleGeo.attributes.position.needsUpdate = true;
  }
}
