/**
 * OpenTwin: Automotive Drivetrain & Kinematics
 * Phase 3.1 — Engine Torque Curve, RPM Dynamics, Idle Governor & Rev-Limiter
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

    // Idle governor PID terms
    this.idleIntegral = 0.0;
  }

  /**
   * Evaluates the non-linear engine torque curve across the RPM spectrum.
   * Twin-turbo sports car profile with low-end spool, wide torque plateau, and high-RPM taper.
   */
  getTorqueCurve(rpm) {
    if (this.fuelCut || rpm >= this.maxRpm) {
      return 0.0;
    }

    if (rpm < this.idleRpm) {
      // Idle recovery torque
      return 210.0;
    } else if (rpm <= 2400.0) {
      // Turbo boost ramp: 220 Nm -> 480 Nm
      const t = (rpm - this.idleRpm) / (2400.0 - this.idleRpm);
      return 220.0 + (this.peakTorque - 220.0) * Math.sin(t * Math.PI * 0.5);
    } else if (rpm <= 5500.0) {
      // Broad peak torque plateau (480 Nm)
      return this.peakTorque;
    } else if (rpm <= this.redlineRpm) {
      // Natural high-RPM volumetric efficiency roll-off: 480 -> 380 Nm
      const t = (rpm - 5500.0) / (this.redlineRpm - 5500.0);
      return this.peakTorque - (this.peakTorque - 380.0) * t;
    } else if (rpm <= this.maxRpm) {
      // Fuel cutoff taper before hard cut
      const t = (rpm - this.redlineRpm) / (this.maxRpm - this.redlineRpm);
      return Math.max(0.0, 380.0 * (1.0 - t));
    }

    return 0.0;
  }

  /**
   * Updates RPM and output torque given throttle input and transmission coupling.
   */
  update(dt, throttle, driveWheelRadS, totalDriveRatio, clutchEngaged = true) {
    const clampedThrottle = Math.max(0.0, Math.min(1.0, throttle));

    // 1. Rev Limiter bouncing logic (fuel cut oscillation at max RPM)
    if (this.currentRpm >= this.maxRpm) {
      this.fuelCut = true;
      this.revLimiterTimer = 0.06; // 60ms ignition/fuel cut
    }

    if (this.revLimiterTimer > 0) {
      this.revLimiterTimer -= dt;
      if (this.revLimiterTimer <= 0) {
        this.fuelCut = false;
      }
    }

    // 2. Drive shaft coupled RPM vs Free revving
    let coupledRpm = (driveWheelRadS * totalDriveRatio * 60.0) / (2.0 * Math.PI);
    coupledRpm = Math.abs(coupledRpm);

    // 3. Engine RPM integration
    if (clutchEngaged && coupledRpm > this.idleRpm * 0.95) {
      // Driven by wheels with clutch lockup
      this.currentRpm = coupledRpm;
    } else {
      // Slipping clutch / neutral / launch phase
      let revTarget = this.idleRpm;
      if (clampedThrottle > 0.01) {
        // Free revving towards redline under throttle
        revTarget = this.idleRpm + clampedThrottle * (this.maxRpm - this.idleRpm);
      }

      // Smooth flywheel acceleration
      const accelRate = clampedThrottle > 0.05 ? 12.0 : 6.0;
      this.currentRpm += (revTarget - this.currentRpm) * Math.min(1.0, dt * accelRate);
    }

    // 4. Idle governor protection
    if (this.currentRpm < this.idleRpm) {
      this.currentRpm = this.idleRpm;
    }

    // 5. Clamp to max limit
    if (this.currentRpm > this.maxRpm) {
      this.currentRpm = this.maxRpm;
    }

    // 6. Calculate available brake torque
    const baseTorque = this.getTorqueCurve(this.currentRpm);
    this.engineTorque = this.fuelCut ? 0.0 : baseTorque * clampedThrottle;

    return {
      rpm: this.currentRpm,
      torque: this.engineTorque,
      fuelCut: this.fuelCut
    };
  }
}
