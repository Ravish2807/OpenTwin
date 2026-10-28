/**
 * OpenTwin: 3D Vehicle Physics Engine
 * Phase 2 — Complete Physics Simulation: Rapier3D WASM, Raycast Suspension,
 * Ackermann Steering, Pacejka 'Magic Formula' Tire Model & Powertrain Dynamics
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.13.1/rapier.es.js';
import { EngineModel, GearboxModel, DifferentialModel } from './drivetrain.js';

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

    // Geometry parameters (Meters)
    this.wheelbase = 2.6;
    this.trackWidth = 1.6;
    this.wheelbaseHalf = this.wheelbase / 2; // 1.3m
    this.trackHalf = this.trackWidth / 2;    // 0.8m
    this.mountY = 0.42;
    this.wheelRadius = 0.34;
    this.suspensionRestLength = 0.48; // meters
    this.springStiffness = 34000;     // N/m
    this.springDamping = 4400;        // N*s/m

    // Steering state (Ackermann)
    this.currentSteer = 0.0;          // radians
    this.maxSteerAngle = 0.56;        // ~32 degrees
    this.steerAngles = { left: 0.0, right: 0.0 };

    // Powertrain & Transmission state
    this.engine = new EngineModel({ idleRpm: 850.0, redlineRpm: 7000.0, maxRpm: 7200.0, peakTorque: 480.0 });
    this.gearbox = new GearboxModel({ gearRatios: [3.80, 2.35, 1.65, 1.22, 0.96, 0.78], reverseRatio: 3.50, finalDrive: 3.42 });
    this.differential = new DifferentialModel({ lockingCoeff: 0.42 });
    this.engineRpm = this.engine.idleRpm;
    this.gear = 1;
    this.forwardSpeedKmh = 0.0;
    this.isReversing = false;

    // Weight Transfer & Kinematic Roll/Pitch Dynamics (Phase 3.3)
    this.cgHeight = 0.48; // Center of gravity height (meters)
    this.prevForwardSpeed = 0.0;
    this.longitudinalAccel = 0.0; // m/s^2
    this.lateralAccel = 0.0;      // m/s^2
    this.chassisPitch = 0.0;      // Radians
    this.chassisRoll = 0.0;       // Radians

    // Pacejka 'Magic Formula' standard tire coefficients (Dry asphalt)
    this.pacejkaB = 10.0;   // Stiffness factor
    this.pacejkaC = 1.65;   // Shape factor
    this.pacejkaD = 1.05;   // Peak friction coefficient (mu)
    this.pacejkaE = -0.5;   // Curvature factor

    // 4 Wheels: FL, FR, RL, RR
    this.wheels = [
      { id: 'FL', isFront: true,  isDriven: false, localPos: new THREE.Vector3(-this.trackHalf, this.mountY, this.wheelbaseHalf), prevComp: 0, comp: 0, normalForce: 0, contact: false, visualY: this.wheelRadius, steerAngle: 0.0 },
      { id: 'FR', isFront: true,  isDriven: false, localPos: new THREE.Vector3(this.trackHalf, this.mountY, this.wheelbaseHalf), prevComp: 0, comp: 0, normalForce: 0, contact: false, visualY: this.wheelRadius, steerAngle: 0.0 },
      { id: 'RL', isFront: false, isDriven: true,  localPos: new THREE.Vector3(-this.trackHalf, this.mountY, -this.wheelbaseHalf), prevComp: 0, comp: 0, normalForce: 0, contact: false, visualY: this.wheelRadius, steerAngle: 0.0 },
      { id: 'RR', isFront: false, isDriven: true,  localPos: new THREE.Vector3(this.trackHalf, this.mountY, -this.wheelbaseHalf), prevComp: 0, comp: 0, normalForce: 0, contact: false, visualY: this.wheelRadius, steerAngle: 0.0 }
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
        .setLinearDamping(0.08)
        .setAngularDamping(0.3)
        .setCcdEnabled(true);
      this.chassisBody = this.world.createRigidBody(chassisBodyDesc);

      // Chassis Main Collider Box
      const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.28, 2.1)
        .setTranslation(0.0, 0.2, 0.0)
        .setMass(this.vehicleMass)
        .setFriction(0.2)
        .setRestitution(0.05);
      this.chassisCollider = this.world.createCollider(chassisColliderDesc, this.chassisBody);

      this.isReady = true;

      // Update badge in UI
      const badge = document.getElementById('sim3d-physics-badge');
      if (badge) {
        badge.innerText = '⚡ RAPIER3D WASM ACTIVE';
        badge.className = 'badge badge-green';
      }

      console.log("[Physics] Rapier3D WASM, raycast suspension, Ackermann & Pacejka tire dynamics ready.");
    } catch (err) {
      console.error("[Physics] Error loading Rapier3D WASM physics:", err);
    }
  }

  resetPosition() {
    if (!this.chassisBody) return;
    this.chassisBody.setTranslation({ x: 0.0, y: this.initialY, z: 0.0 }, true);
    this.chassisBody.setRotation({ x: 0.0, y: 0.0, z: 0.0, w: 1.0 }, true);
    this.chassisBody.setLinvel({ x: 0.0, y: 0.0, z: 0.0 }, true);
    this.chassisBody.setAngvel({ x: 0.0, y: 0.0, z: 0.0 }, true);
    this.setSteering(0.0);
    if (this.engine) {
      this.engine.currentRpm = this.engine.idleRpm;
      this.engine.fuelCut = false;
    }
    if (this.gearbox) {
      this.gearbox.currentGear = 1;
      this.gearbox.isShifting = false;
      this.gearbox.gearMode = 'D';
    }
    this.engineRpm = 850.0;
    this.gear = 1;
    this.isReversing = false;
    this.longitudinalAccel = 0.0;
    this.lateralAccel = 0.0;
    this.chassisPitch = 0.0;
    this.chassisRoll = 0.0;
    if (this.vehicleRig) {
      this.vehicleRig.setBodyPitchRoll(0.0, 0.0);
    }
    console.log("[Physics] Vehicle reset to starting grid.");
  }

  computeAckermann(steerAngle) {
    if (Math.abs(steerAngle) < 0.0005) {
      return { left: 0.0, right: 0.0 };
    }

    const L = this.wheelbase;
    const W = this.trackWidth;
    const absAngle = Math.abs(steerAngle);
    const turningRadius = L / Math.tan(absAngle);

    // Ackermann formula
    const innerAngle = Math.atan(L / (turningRadius - W / 2));
    const outerAngle = Math.atan(L / (turningRadius + W / 2));

    if (steerAngle > 0) {
      return { left: outerAngle, right: innerAngle };
    } else {
      return { left: -innerAngle, right: -outerAngle };
    }
  }

  setSteering(targetAngle) {
    this.currentSteer = THREE.MathUtils.clamp(targetAngle, -this.maxSteerAngle, this.maxSteerAngle);
    this.steerAngles = this.computeAckermann(this.currentSteer);

    this.wheels[0].steerAngle = this.steerAngles.left;
    this.wheels[1].steerAngle = this.steerAngles.right;
    this.wheels[2].steerAngle = 0.0;
    this.wheels[3].steerAngle = 0.0;

    if (this.vehicleRig) {
      this.vehicleRig.setSteering(this.steerAngles.left, this.steerAngles.right);
    }

    const hudSteer = document.getElementById('hud-3d-steer');
    if (hudSteer) {
      const deg = (this.currentSteer * 180 / Math.PI).toFixed(1);
      hudSteer.innerText = `${deg}°`;
    }
  }

  // Pacejka 'Magic Formula': Lateral cornering force from slip angle & normal load
  pacejkaLateralForce(slipAngle, normalForce) {
    if (normalForce <= 0) return 0;
    const B = this.pacejkaB;
    const C = this.pacejkaC;
    const D = this.pacejkaD * normalForce;
    const E = this.pacejkaE;

    // F_y = D * sin(C * atan(B * alpha - E * (B * alpha - atan(B * alpha))))
    const Ba = B * slipAngle;
    const phi = Ba - E * (Ba - Math.atan(Ba));
    return -D * Math.sin(C * Math.atan(phi));
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
      const worldMount = wheel.localPos.clone().applyQuaternion(cQuat).add(cPos);

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

        const forceMag = Math.max(0, this.springStiffness * comp + this.springDamping * springVel);
        wheel.normalForce = forceMag;

        // Apply suspension spring impulse
        const impulse = {
          x: worldUp.x * forceMag * dt,
          y: worldUp.y * forceMag * dt,
          z: worldUp.z * forceMag * dt
        };
        this.chassisBody.applyImpulseAtPoint(impulse, { x: worldMount.x, y: worldMount.y, z: worldMount.z }, true);

        wheel.visualY = wheel.localPos.y - dist + this.wheelRadius;
      } else {
        wheel.prevComp = 0;
        wheel.comp = 0;
        wheel.contact = false;
        wheel.normalForce = 0;
        wheel.visualY = wheel.localPos.y - this.suspensionRestLength + this.wheelRadius;
      }
    }

    if (this.vehicleRig) {
      this.vehicleRig.setSuspensionY(
        this.wheels[0].visualY,
        this.wheels[1].visualY,
        this.wheels[2].visualY,
        this.wheels[3].visualY
      );
    }
  }

  updateTireForcesAndPowertrain(dt, controls) {
    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();
    const linvel = this.chassisBody.linvel();
    const angvel = this.chassisBody.angvel();

    const cPos = new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z);
    const cQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
    const cLinvel = new THREE.Vector3(linvel.x, linvel.y, linvel.z);
    const cAngvel = new THREE.Vector3(angvel.x, angvel.y, angvel.z);

    // Chassis local forward (+Z) and right (+X) vectors
    const chassisFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cQuat);
    const chassisRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cQuat);
    const chassisUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cQuat);

    // Forward speed along heading
    const forwardSpeed = cLinvel.dot(chassisFwd);
    this.forwardSpeedKmh = forwardSpeed * 3.6;

    // 1. Weight Transfer & Acceleration Dynamics (Phase 3.3)
    const rawAx = (forwardSpeed - this.prevForwardSpeed) / Math.max(dt, 0.001);
    this.longitudinalAccel = THREE.MathUtils.lerp(this.longitudinalAccel, rawAx, dt * 8.0);
    this.prevForwardSpeed = forwardSpeed;

    const yawRate = cAngvel.y;
    const rawAy = forwardSpeed * yawRate;
    this.lateralAccel = THREE.MathUtils.lerp(this.lateralAccel, rawAy, dt * 8.0);

    // Delta normal load from longitudinal and lateral weight transfer
    const deltaFzLong = (this.vehicleMass * this.longitudinalAccel * this.cgHeight) / this.wheelbase;
    const deltaFzLat = (this.vehicleMass * this.lateralAccel * this.cgHeight) / this.trackWidth;

    // Kinematic Chassis Pitch (Squat/Dive) and Roll (Lean)
    const targetPitch = THREE.MathUtils.clamp(-this.longitudinalAccel * 0.0035, -0.05, 0.05);
    const targetRoll = THREE.MathUtils.clamp(this.lateralAccel * 0.004, -0.07, 0.07);
    this.chassisPitch = THREE.MathUtils.lerp(this.chassisPitch, targetPitch, dt * 7.0);
    this.chassisRoll = THREE.MathUtils.lerp(this.chassisRoll, targetRoll, dt * 7.0);

    if (this.vehicleRig) {
      this.vehicleRig.setBodyPitchRoll(this.chassisPitch, this.chassisRoll);
    }

    // 2. Automatic Gearbox shifting & dual-clutch state (Phase 3.2)
    const shiftState = this.gearbox.update(dt, this.engineRpm, controls.throttle, controls.brake, forwardSpeed);
    this.gear = this.gearbox.currentGear;
    this.isReversing = (this.gear === -1);
    const totalDriveRatio = this.gearbox.getTotalRatio();

    // 2. Engine RPM & Torque evaluation with dual-clutch factor (Phase 3.1 & 3.2)
    const rearWheelRadS = Math.abs(forwardSpeed) / this.wheelRadius;
    const engineOutput = this.engine.update(
      dt,
      !this.isReversing ? controls.throttle : controls.brake,
      rearWheelRadS,
      totalDriveRatio,
      shiftState.clutchFactor
    );
    this.engineRpm = engineOutput.rpm;

    // 3. Drive force calculation from non-linear engine torque curve
    let driveForceTotal = 0;
    if (!this.isReversing) {
      driveForceTotal = (engineOutput.torque * totalDriveRatio) / this.wheelRadius;
    } else {
      driveForceTotal = -(engineOutput.torque * totalDriveRatio) / this.wheelRadius;
    }

    // 4. Limited-Slip Differential (LSD) Torque Split between rear wheels (Phase 3.2)
    const omegaRL = Math.abs(forwardSpeed) / this.wheelRadius;
    const omegaRR = Math.abs(forwardSpeed) / this.wheelRadius;
    const lsdTorque = this.differential.splitTorque(driveForceTotal, omegaRL, omegaRR);

    const brakeForcePerWheel = (controls.brake * 6500) / 4;

    // Apply Pacejka friction & traction for all 4 wheels
    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];
      if (!wheel.contact || wheel.normalForce <= 0) continue;

      // Contact point in world space
      const worldMount = wheel.localPos.clone().applyQuaternion(cQuat).add(cPos);
      const contactPatch = worldMount.clone().add(new THREE.Vector3(0, -this.suspensionRestLength + wheel.comp, 0));

      // Velocity at contact patch = v_chassis + omega x r
      const r = contactPatch.clone().sub(cPos);
      const patchVel = cLinvel.clone().add(cAngvel.clone().cross(r));

      // Wheel Heading & Lateral vectors (accounting for steering angle)
      const wheelSteerRot = new THREE.Quaternion().setFromAxisAngle(chassisUp, wheel.steerAngle);
      const wheelFwd = chassisFwd.clone().applyQuaternion(wheelSteerRot);
      const wheelLat = chassisRight.clone().applyQuaternion(wheelSteerRot);

      // Velocity components in wheel frame
      const vLong = patchVel.dot(wheelFwd);
      const vLat = patchVel.dot(wheelLat);

      // Slip angle alpha = atan(vLat / (|vLong| + 0.1))
      const slipAngle = Math.atan2(vLat, Math.abs(vLong) + 0.2);

      // Weight transfer dynamic normal load adjustment (Phase 3.3)
      let effNormal = wheel.normalForce;
      if (wheel.id === 'FL') effNormal += (-deltaFzLong * 0.5 - deltaFzLat * 0.5);
      else if (wheel.id === 'FR') effNormal += (-deltaFzLong * 0.5 + deltaFzLat * 0.5);
      else if (wheel.id === 'RL') effNormal += (deltaFzLong * 0.5 - deltaFzLat * 0.5);
      else if (wheel.id === 'RR') effNormal += (deltaFzLong * 0.5 + deltaFzLat * 0.5);
      effNormal = Math.max(120, effNormal);

      // 1. Lateral Force from Pacejka Formula
      let fLat = this.pacejkaLateralForce(slipAngle, effNormal);

      // Handbrake drift multiplier on rear wheels
      if (controls.handbrake && !wheel.isFront) {
        fLat *= 0.35; // Break rear traction into drift
      }

      // 2. Longitudinal Force (Drive / Brake / Rolling resistance)
      let fLong = 0;
      if (wheel.isDriven && !controls.handbrake) {
        fLong += (wheel.id === 'RL') ? lsdTorque.left : lsdTorque.right;
      }

      // Braking opposing velocity
      if (controls.brake > 0.02 && !this.isReversing) {
        fLong -= Math.sign(vLong || 1) * Math.min(brakeForcePerWheel, Math.abs(vLong) * 2000);
      } else if (controls.handbrake && !wheel.isFront) {
        fLong -= Math.sign(vLong || 1) * Math.min(5000, Math.abs(vLong) * 3000);
      } else {
        // Rolling resistance
        fLong -= Math.sign(vLong || 1) * Math.min(60, Math.abs(vLong) * 30);
      }

      // 3. Friction Circle Clamping: sqrt(Fx^2 + Fy^2) <= mu * Fz
      const maxTireGrip = this.pacejkaD * effNormal;
      const totalF = Math.sqrt(fLong * fLong + fLat * fLat);
      if (totalF > maxTireGrip && totalF > 0) {
        const scale = maxTireGrip / totalF;
        fLong *= scale;
        fLat *= scale;
      }

      // World force vector = fLong * wheelFwd + fLat * wheelLat
      const totalWorldForce = wheelFwd.clone().multiplyScalar(fLong).add(wheelLat.clone().multiplyScalar(fLat));

      // Apply impulse to Rapier body at contact patch
      const impulse = {
        x: totalWorldForce.x * dt,
        y: totalWorldForce.y * dt,
        z: totalWorldForce.z * dt
      };
      this.chassisBody.applyImpulseAtPoint(impulse, { x: contactPatch.x, y: contactPatch.y, z: contactPatch.z }, true);
    }

    // Spin visual wheels based on forward motion
    const spinDelta = (forwardSpeed / this.wheelRadius) * dt;
    if (this.vehicleRig) {
      this.vehicleRig.spinWheels(spinDelta);
      this.vehicleRig.setBraking(controls.brake > 0.05 || controls.handbrake);
    }

    // Update Telemetry HUD displays
    this.updateHUD();
  }

  updateHUD() {
    const speedElem = document.getElementById('hud-3d-speed');
    const rpmElem = document.getElementById('hud-3d-rpm');
    const gearElem = document.getElementById('hud-3d-gear');

    if (speedElem) {
      const spd = Math.abs(Math.round(this.forwardSpeedKmh));
      speedElem.innerHTML = `${spd}<span class="unit">KM/H</span>`;
    }
    if (rpmElem) {
      const rpm = Math.round(this.engineRpm);
      rpmElem.innerText = `${rpm}`;
    }
    if (gearElem) {
      gearElem.innerText = this.isReversing ? 'R' : `${this.gear}`;
    }
  }

  step(dt, controls) {
    if (!this.isReady || !this.world || !this.chassisBody) return;

    const clampedDt = Math.min(dt, 0.05);

    // Apply Steering
    if (controls) {
      this.setSteering(controls.steer * this.maxSteerAngle);
    }

    // 1. Suspension forces
    this.updateSuspension(clampedDt);

    // 2. Pacejka tire traction & powertrain forces
    if (controls) {
      this.updateTireForcesAndPowertrain(clampedDt, controls);
    }

    // 3. Step Rapier3D physics world
    this.world.timestep = clampedDt;
    this.world.step();

    // 4. Sync chassis translation & rotation to Three.js vehicleRig root
    const trans = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    this.vehicleRig.root.position.set(trans.x, trans.y, trans.z);
    this.vehicleRig.root.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
}
