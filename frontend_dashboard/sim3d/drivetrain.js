/**
 * OpenTwin: Automotive Drivetrain & Kinematics
 * Phase 3.1 & 3.2 — Engine Torque Curve, RPM Dynamics,
 * Automatic 6-Speed Dual-Clutch Gearbox & Limited-Slip Differential (LSD)
 */

export class EngineModel {
  constructor(options = {}) {
    this.idleRpm = options.idleRpm || 850.0;
    this.redlineRpm = options.redlineRpm || 7000.0;
    this.maxRpm = options.maxRpm || 7200.0;
    this.peakTorque = options.peakTorque || 480.0; // Nm

    // Dynamic state
    this.currentRpm = this.idleRpm;
    this.targetRpm = this.idleRpm;
    this.engineTorque = 0.0;
    this.fuelCut = false;
    this.revLimiterTimer = 0.0;
    this.inertia = 0.22; // kg*m^2 flywheel rotational inertia
  }

  getTorqueCurve(rpm) {
    if (this.fuelCut || rpm >= this.maxRpm) {
      return 0.0;
    }

    if (rpm < this.idleRpm) {
      return 210.0;
    } else if (rpm <= 2400.0) {
      const t = (rpm - this.idleRpm) / (2400.0 - this.idleRpm);
      return 220.0 + (this.peakTorque - 220.0) * Math.sin(t * Math.PI * 0.5);
    } else if (rpm <= 5500.0) {
      return this.peakTorque;
    } else if (rpm <= this.redlineRpm) {
      const t = (rpm - 5500.0) / (this.redlineRpm - 5500.0);
      return this.peakTorque - (this.peakTorque - 380.0) * t;
    } else if (rpm <= this.maxRpm) {
      const t = (rpm - this.redlineRpm) / (this.maxRpm - this.redlineRpm);
      return Math.max(0.0, 380.0 * (1.0 - t));
    }

    return 0.0;
  }

  update(dt, throttle, driveWheelRadS, totalDriveRatio, clutchFactor = 1.0) {
    const clampedThrottle = Math.max(0.0, Math.min(1.0, throttle));

    // Rev Limiter bouncing logic
    if (this.currentRpm >= this.maxRpm) {
      this.fuelCut = true;
      this.revLimiterTimer = 0.06;
    }

    if (this.revLimiterTimer > 0) {
      this.revLimiterTimer -= dt;
      if (this.revLimiterTimer <= 0) {
        this.fuelCut = false;
      }
    }

    let coupledRpm = (driveWheelRadS * totalDriveRatio * 60.0) / (2.0 * Math.PI);
    coupledRpm = Math.abs(coupledRpm);

    if (clutchFactor > 0.8 && coupledRpm > this.idleRpm * 0.95) {
      this.currentRpm = coupledRpm;
    } else {
      let revTarget = this.idleRpm;
      if (clampedThrottle > 0.01) {
        revTarget = this.idleRpm + clampedThrottle * (this.maxRpm - this.idleRpm);
      }
      const accelRate = clampedThrottle > 0.05 ? 12.0 : 6.0;
      this.currentRpm += (revTarget - this.currentRpm) * Math.min(1.0, dt * accelRate);
    }

    if (this.currentRpm < this.idleRpm) {
      this.currentRpm = this.idleRpm;
    }
    if (this.currentRpm > this.maxRpm) {
      this.currentRpm = this.maxRpm;
    }

    const baseTorque = this.getTorqueCurve(this.currentRpm);
    this.engineTorque = (this.fuelCut ? 0.0 : baseTorque * clampedThrottle) * clutchFactor;

    return {
      rpm: this.currentRpm,
      torque: this.engineTorque,
      fuelCut: this.fuelCut
    };
  }
}

export class GearboxModel {
  constructor(options = {}) {
    this.gearRatios = options.gearRatios || [3.80, 2.35, 1.65, 1.22, 0.96, 0.78];
    this.reverseRatio = options.reverseRatio || 3.50;
    this.finalDrive = options.finalDrive || 3.42;

    this.currentGear = 1; // 1..6 or -1 for Reverse
    this.isShifting = false;
    this.shiftTimer = 0.0;
    this.shiftDuration = 0.16; // 160ms dual-clutch shift
    this.targetGear = 1;
    this.gearMode = 'D'; // 'D' or 'R'
  }

  getRatio() {
    if (this.currentGear === -1) return this.reverseRatio;
    return this.gearRatios[this.currentGear - 1] || 1.0;
  }

  getTotalRatio() {
    return this.getRatio() * this.finalDrive;
  }

  update(dt, rpm, throttle, brake, forwardSpeed) {
    if (this.isShifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.currentGear = this.targetGear;
        this.isShifting = false;
      }
      return { gear: this.currentGear, inShift: true, clutchFactor: 0.18 };
    }

    // Direction shift (Drive <-> Reverse)
    if (brake > 0.15 && forwardSpeed < 0.2 && this.currentGear !== -1) {
      this.currentGear = -1;
      this.gearMode = 'R';
      return { gear: -1, inShift: false, clutchFactor: 1.0 };
    } else if (throttle > 0.15 && forwardSpeed > -0.2 && this.currentGear === -1) {
      this.currentGear = 1;
      this.gearMode = 'D';
      return { gear: 1, inShift: false, clutchFactor: 1.0 };
    }

    if (this.currentGear > 0) {
      this.gearMode = 'D';
      // Throttle-dependent shift points (Eco 2600 RPM vs Sport 6300 RPM)
      const upshiftRpm = 2600 + throttle * 3700;
      const downshiftRpm = 1600 + throttle * 1100;

      if (rpm > upshiftRpm && this.currentGear < this.gearRatios.length) {
        this.targetGear = this.currentGear + 1;
        this.isShifting = true;
        this.shiftTimer = this.shiftDuration;
      } else if (rpm < downshiftRpm && this.currentGear > 1) {
        this.targetGear = this.currentGear - 1;
        this.isShifting = true;
        this.shiftTimer = this.shiftDuration;
      }
    }

    return { gear: this.currentGear, inShift: false, clutchFactor: 1.0 };
  }
}

export class DifferentialModel {
  constructor(options = {}) {
    this.lockingCoeff = options.lockingCoeff || 0.42; // LSD locking factor
  }

  /**
   * Splits drive torque between left and right wheels using Limited-Slip Differential logic.
   */
  splitTorque(totalDriveTorque, leftWheelRadS, rightWheelRadS) {
    const deltaOmega = leftWheelRadS - rightWheelRadS;
    const transfer = this.lockingCoeff * Math.abs(totalDriveTorque) * Math.tanh(deltaOmega * 1.5);

    const half = totalDriveTorque * 0.5;
    return {
      left: Math.max(0, half - transfer),
      right: Math.max(0, half + transfer)
    };
  }
}
