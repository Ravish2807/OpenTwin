/**
 * OpenTwin: 3D Vehicle Simulation — Bidirectional CAN Bus Bridge
 * Phase 4.1 & 4.2 — CAN Frame Serialization, 3D Injector & Replay Synchronization
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class CANBridge {
  constructor(simEngine) {
    this.simEngine = simEngine;
    this.ws = null;
    this.injectionMode = true; // true = 3D drives CAN (Simulator), false = CAN drives 3D (Replay)
    this.txRateHz = 25; // 25 Hz CAN injection frequency (40ms interval)
    this.txTimer = 0.0;
    this.txInterval = 1.0 / this.txRateHz;
    this.frameCount = 0;
    this.lastTelemetryTime = performance.now();

    // Status callback
    this.onStatusChange = null;
  }

  setWebSocket(ws) {
    this.ws = ws;
  }

  setInjectionMode(enabled) {
    this.injectionMode = enabled;
    console.log(`[CANBridge] Operating Mode: ${this.injectionMode ? "3D Simulator (TX)" : "Replay Receiver (RX)"}`);
    
    const hudCan = document.getElementById('hud-3d-can-tx');
    const toggleBtn = document.getElementById('btn-toggle-sim-mode');

    if (this.injectionMode) {
      if (hudCan) {
        hudCan.innerText = "TX ACTIVE (25Hz)";
        hudCan.className = "hud-stat-num cyan";
      }
      if (toggleBtn) {
        toggleBtn.innerText = "🎮 Virtual Drive (WASD)";
        toggleBtn.className = "btn btn-sm btn-primary";
      }
    } else {
      if (hudCan) {
        hudCan.innerText = "RX SYNCED (REPLAY)";
        hudCan.className = "hud-stat-num amber";
      }
      if (toggleBtn) {
        toggleBtn.innerText = "📡 CAN Replay Sync Mode";
        toggleBtn.className = "btn btn-sm btn-outline";
      }
    }

    if (this.onStatusChange) {
      this.onStatusChange(this.injectionMode);
    }
  }

  toggleMode() {
    this.setInjectionMode(!this.injectionMode);
  }

  /**
   * Packs 0x100 Engine_Data according to vehicle_base.dbc
   */
  packEngineData(rpm, speedKmh, throttlePct, engineTemp = 92.0, oilBar = 4.2) {
    const rawRpm = Math.floor(Math.max(0, rpm) / 0.25) & 0xFFFF;
    const rawSpeed = Math.floor(Math.max(0, speedKmh) / 0.01) & 0xFFFF;
    const rawThrottle = Math.floor(Math.max(0, Math.min(100, throttlePct)) * 255.0 / 100.0) & 0xFF;
    const rawTemp = Math.floor(engineTemp + 40) & 0xFF;
    const rawOil = Math.floor(oilBar / 0.05) & 0xFF;

    const b0 = rawRpm & 0xFF;
    const b1 = (rawRpm >> 8) & 0xFF;
    const b2 = rawSpeed & 0xFF;
    const b3 = (rawSpeed >> 8) & 0xFF;
    const b4 = rawThrottle;
    const b5 = rawTemp;
    const b6 = rawOil;
    const b7 = 0;

    return [b0, b1, b2, b3, b4, b5, b6, b7]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Packs 0x200 Vehicle_Status according to vehicle_base.dbc
   */
  packVehicleStatus(gearNum, isBraking, steeringAngleDeg, turnSignal = 0, fuelPct = 78.0, battPct = 90.0) {
    const fuelRaw = Math.floor(fuelPct / 0.5) & 0xFF;
    const battRaw = Math.floor(battPct / 0.5) & 0xFF;

    let dbcGear = 3;
    if (gearNum === -1) dbcGear = 1; // Reverse
    else if (gearNum === 0) dbcGear = 0; // Park
    else dbcGear = Math.min(7, gearNum + 2); // D1, D2, ...

    const byte2 = (dbcGear & 0x0F) | ((isBraking ? 1 : 0) << 4) | ((turnSignal & 0x07) << 5);

    const steerRaw = Math.floor(steeringAngleDeg / 0.1);
    const steerBytes = new Int16Array([steerRaw]);
    const u8 = new Uint8Array(steerBytes.buffer);

    const b0 = fuelRaw;
    const b1 = battRaw;
    const b2 = byte2;
    const b3 = u8[0];
    const b4 = u8[1];
    const b5 = 1;
    const b6 = 0;
    const b7 = 0;

    return [b0, b1, b2, b3, b4, b5, b6, b7]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  update(dt) {
    if (!this.injectionMode || !this.simEngine || !this.simEngine.physics || !this.simEngine.controls) {
      return;
    }

    const ws = this.ws || window.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.txTimer += dt;
    if (this.txTimer >= this.txInterval) {
      this.txTimer = 0.0;
      this.frameCount++;

      const phys = this.simEngine.physics;
      const ctrl = this.simEngine.controls;

      const speedKmh = Math.abs(phys.forwardSpeedKmh);
      const rpm = phys.engineRpm;
      const throttlePct = ctrl.throttle * 100.0;
      const isBraking = ctrl.brake > 0.05 || ctrl.handbrake;
      const steerDeg = (phys.currentSteer * 180.0) / Math.PI;
      const gear = phys.gear;

      // 1. Pack & Inject 0x100 Engine_Data
      const hexEngine = this.packEngineData(rpm, speedKmh, throttlePct);
      ws.send(JSON.stringify({
        action: "inject_frame",
        can_id: "0x100",
        hex_data: hexEngine
      }));

      // 2. Pack & Inject 0x200 Vehicle_Status
      const hexStatus = this.packVehicleStatus(gear, isBraking, steerDeg);
      ws.send(JSON.stringify({
        action: "inject_frame",
        can_id: "0x200",
        hex_data: hexStatus
      }));

      const hudCan = document.getElementById('hud-3d-can-tx');
      if (hudCan) {
        hudCan.innerText = `CAN TX: 0x100, 0x200 (#${this.frameCount})`;
        hudCan.className = "hud-stat-num cyan";
      }
    }
  }

  /**
   * Phase 4.2 — Replay Synchronization Mode:
   * Translates incoming CAN telemetry frames into realistic 3D vehicle motion and visuals.
   */
  handleIncomingTelemetry(data) {
    if (this.injectionMode || !this.simEngine || !this.simEngine.vehicleRig) {
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastTelemetryTime) / 1000.0, 0.1);
    this.lastTelemetryTime = now;

    const speedKmh = Number(data.VehicleSpeed || 0);
    const rpm = Number(data.EngineSpeed || 850);
    const steerDeg = Number(data.SteeringAngle || 0);
    const brakeActive = Boolean(data.BrakeActive);
    const gear = data.Gear ?? 'D';

    const speedMs = speedKmh / 3.6;
    const steerRad = (steerDeg * Math.PI) / 180.0;

    // Kinematic bicycle vehicle advance
    const vehicle = this.simEngine.vehicleGroup;
    if (vehicle) {
      const yawRate = (speedMs / 2.6) * Math.tan(steerRad * 0.45);
      vehicle.rotation.y += yawRate * dt;

      const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion);
      vehicle.position.addScaledVector(forwardVec, speedMs * dt);

      // Spin visual wheels and apply steering
      const spinDelta = (speedMs / 0.34) * dt;
      this.simEngine.vehicleRig.spinWheels(spinDelta);
      this.simEngine.vehicleRig.setSteering(steerRad * 0.45, steerRad * 0.45);
      this.simEngine.vehicleRig.setBraking(brakeActive);

      // Pitch & Roll kinematic lean from speed & steering
      const pitch = THREE.MathUtils.clamp((brakeActive ? 0.03 : -0.015 * (speedMs / 40)), -0.05, 0.05);
      const roll = THREE.MathUtils.clamp(steerRad * 0.08 * (speedMs / 25), -0.07, 0.07);
      this.simEngine.vehicleRig.setBodyPitchRoll(pitch, roll);

      // Update 3D HUD telemetry
      const speedElem = document.getElementById('hud-3d-speed');
      const rpmElem = document.getElementById('hud-3d-rpm');
      const gearElem = document.getElementById('hud-3d-gear');
      const steerElem = document.getElementById('hud-3d-steer');
      const hudCan = document.getElementById('hud-3d-can-tx');

      if (speedElem) speedElem.innerHTML = `${Math.round(speedKmh)}<span class="unit">KM/H</span>`;
      if (rpmElem) rpmElem.innerText = `${Math.round(rpm)}`;
      if (gearElem) gearElem.innerText = `${gear}`;
      if (steerElem) steerElem.innerText = `${steerDeg.toFixed(1)}°`;
      if (hudCan) {
        hudCan.innerText = "CAN RX: SYNCED (REPLAY)";
        hudCan.className = "hud-stat-num amber";
      }
    }
  }
}
