/**
 * OpenTwin: 3D Vehicle Simulation — Keyboard Driving Controls
 * Phase 2.4 — Input Manager (WASD / Arrows / Space / R)
 */

export class InputController {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false
    };

    this.throttle = 0.0;
    this.brake = 0.0;
    this.steer = 0.0;
    this.handbrake = false;
    this.onReset = null;

    this.steerSpeed = 2.8;     // Steering responsiveness
    this.steerReturn = 3.6;    // Auto-centering speed

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.handbrake = true;
          e.preventDefault();
          break;
        case 'KeyR':
          if (this.onReset) this.onReset();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.handbrake = false;
          break;
      }
    });
  }

  update(dt) {
    // 1. Throttle / Brake
    if (this.keys.forward) {
      this.throttle = Math.min(1.0, this.throttle + dt * 4.0);
      this.brake = 0.0;
    } else {
      this.throttle = Math.max(0.0, this.throttle - dt * 5.0);
    }

    if (this.keys.backward) {
      this.brake = Math.min(1.0, this.brake + dt * 5.0);
    } else {
      this.brake = Math.max(0.0, this.brake - dt * 6.0);
    }

    this.handbrake = this.keys.handbrake;

    // 2. Smooth Steering with progressive centering
    let targetSteer = 0.0;
    if (this.keys.left) targetSteer -= 1.0;
    if (this.keys.right) targetSteer += 1.0;

    if (targetSteer !== 0.0) {
      if (this.steer < targetSteer) {
        this.steer = Math.min(targetSteer, this.steer + this.steerSpeed * dt);
      } else if (this.steer > targetSteer) {
        this.steer = Math.max(targetSteer, this.steer - this.steerSpeed * dt);
      }
    } else {
      // Return to center
      if (this.steer > 0) {
        this.steer = Math.max(0, this.steer - this.steerReturn * dt);
      } else if (this.steer < 0) {
        this.steer = Math.min(0, this.steer + this.steerReturn * dt);
      }
    }
  }
}
