/**
 * OpenTwin: 3D Vehicle Simulation — Dynamic Scenario Engine
 * Real-Time Proving Ground Scenarios (Sprint, Slalom Agility, Skidpad Drift, Free Roam)
 * and Surface / Weather Dynamics (Dry Asphalt, Wet / Rain, Icy Snow)
 */

export class ScenarioManager {
  constructor(engine) {
    this.engine = engine;
    this.activeScenario = 'sprint'; // 'sprint' | 'slalom' | 'skidpad' | 'freeroam'
    this.weather = 'dry';          // 'dry' | 'rain' | 'ice'

    // Scenario State
    this.state = 'ARMED'; // 'ARMED' | 'RUNNING' | 'COMPLETED'
    this.timer = 0.0;
    this.bestTimes = {
      sprint100: null,
      sprintTrap: null,
      slalomNet: null,
      skidpadScore: 0
    };

    // Sprint Metrics
    this.sprint = {
      split60: null,
      split100: null,
      trapTime: null,
      trapSpeed: null,
      peakGx: 0.0
    };

    // Slalom Metrics
    this.slalom = {
      startTime: 0,
      finishTime: 0,
      conesHit: 0,
      penaltyTime: 0.0,
      netTime: 0.0
    };

    // Skidpad Metrics
    this.skidpad = {
      peakGy: 0.0,
      driftScore: 0,
      driftCombo: 1.0,
      currentAngle: 0.0
    };

    // Free Roam Metrics
    this.freeroam = {
      distanceMeters: 0.0,
      topSpeedKmh: 0.0
    };

    // Spawn coordinate definitions
    this.spawns = {
      sprint:   { x: 0.0,   y: 0.75, z: 0.0,   heading: 0.0 },
      slalom:   { x: -35.0, y: 0.75, z: -80.0, heading: 0.0 },
      skidpad:  { x: 0.0,   y: 0.75, z: -30.0, heading: Math.PI / 2 },
      freeroam: { x: 0.0,   y: 0.75, z: 0.0,   heading: 0.0 }
    };

    this.cacheDomElements();
    this.setScenario('sprint');
  }

  cacheDomElements() {
    this.dom = {
      title: document.getElementById('scenario-title'),
      timer: document.getElementById('scenario-timer'),
      status: document.getElementById('scenario-status'),
      stat1: document.getElementById('scen-stat-1'),
      stat2: document.getElementById('scen-stat-2'),
      stat3: document.getElementById('scen-stat-3'),
      btnRestart: document.getElementById('btn-restart-scenario')
    };

    if (this.dom.btnRestart) {
      this.dom.btnRestart.addEventListener('click', () => this.restartScenario());
    }
  }

  setScenario(name) {
    if (!this.spawns[name]) return;
    this.activeScenario = name;
    this.restartScenario();
    this.updateScenarioLabels();
  }

  restartScenario() {
    const sp = this.spawns[this.activeScenario];
    if (this.engine.physics) {
      this.engine.physics.resetPosition(sp.x, sp.y, sp.z, sp.heading);
    }

    if (this.engine.environment) {
      this.engine.environment.resetCones();
    }

    this.state = 'ARMED';
    this.timer = 0.0;

    // Reset metrics for current scenario
    if (this.activeScenario === 'sprint') {
      this.sprint = { split60: null, split100: null, trapTime: null, trapSpeed: null, peakGx: 0.0 };
    } else if (this.activeScenario === 'slalom') {
      this.slalom = { startTime: 0, finishTime: 0, conesHit: 0, penaltyTime: 0.0, netTime: 0.0 };
    } else if (this.activeScenario === 'skidpad') {
      this.skidpad.driftScore = 0;
      this.skidpad.peakGy = 0.0;
      this.skidpad.driftCombo = 1.0;
    }

    this.renderHUD();
  }

  setWeather(mode) {
    this.weather = mode;
    const physics = this.engine.physics;
    const env = this.engine.environment;
    const effects = this.engine.effects;

    let mu = 1.0;
    if (mode === 'dry') {
      mu = 1.05;
      if (env) {
        env.setLightingPreset('day');
        env.setSurfaceWeather('dry');
      }
      if (effects) effects.setWeatherMode('dry');
    } else if (mode === 'rain') {
      mu = 0.62;
      if (env) {
        env.setLightingPreset('dusk');
        env.setSurfaceWeather('rain');
      }
      if (effects) effects.setWeatherMode('rain');
    } else if (mode === 'ice') {
      mu = 0.22;
      if (env) {
        env.setLightingPreset('night');
        env.setSurfaceWeather('ice');
      }
      if (effects) effects.setWeatherMode('ice');
    }

    if (physics) {
      physics.setSurfaceFriction(mu);
    }
  }

  update(dt) {
    const physics = this.engine.physics;
    if (!physics || !physics.isReady || !physics.chassisBody) return;

    const pos = physics.chassisBody.translation();
    const speed = Math.abs(physics.forwardSpeedKmh);
    const speedMs = speed / 3.6;
    const longG = Math.abs(physics.longitudinalAccel) / 9.81;
    const latG = Math.abs(physics.lateralAccel) / 9.81;

    switch (this.activeScenario) {
      case 'sprint':
        this.updateSprint(dt, pos, speed, longG);
        break;
      case 'slalom':
        this.updateSlalom(dt, pos, speed);
        break;
      case 'skidpad':
        this.updateSkidpad(dt, pos, speed, latG);
        break;
      case 'freeroam':
        this.updateFreeroam(dt, pos, speed, latG);
        break;
    }

    this.renderHUD();
  }

  updateSprint(dt, pos, speed, longG) {
    if (this.state === 'ARMED') {
      // Trigger run start on forward movement
      if (pos.z > 0.5 || speed > 1.2) {
        this.state = 'RUNNING';
        this.timer = 0.0;
      }
    } else if (this.state === 'RUNNING') {
      this.timer += dt;
      this.sprint.peakGx = Math.max(this.sprint.peakGx, longG);

      // 0-60 km/h split
      if (!this.sprint.split60 && speed >= 60.0) {
        this.sprint.split60 = this.timer;
      }

      // 0-100 km/h split
      if (!this.sprint.split100 && speed >= 100.0) {
        this.sprint.split100 = this.timer;
        if (!this.bestTimes.sprint100 || this.timer < this.bestTimes.sprint100) {
          this.bestTimes.sprint100 = this.timer;
        }
      }

      // 200m Finish line trap
      if (pos.z >= 200.0) {
        this.sprint.trapTime = this.timer;
        this.sprint.trapSpeed = speed;
        this.state = 'COMPLETED';
        if (!this.bestTimes.sprintTrap || this.timer < this.bestTimes.sprintTrap) {
          this.bestTimes.sprintTrap = this.timer;
        }
      }
    }
  }

  updateSlalom(dt, pos, speed) {
    if (this.state === 'ARMED') {
      // Slalom course start line is at Z = -60m
      if (pos.z >= -60.0) {
        this.state = 'RUNNING';
        this.timer = 0.0;
      }
    } else if (this.state === 'RUNNING') {
      this.timer += dt;

      // Cone collision detection
      if (this.engine.environment && this.engine.environment.cones) {
        for (const cone of this.engine.environment.cones) {
          if (!cone.userData || cone.userData.knocked) continue;
          const dx = pos.x - cone.position.x;
          const dz = pos.z - cone.position.z;
          const dist = Math.hypot(dx, dz);

          // Proximity collision threshold (vehicle boundary ~1.3m)
          if (dist < 1.35) {
            cone.userData.knocked = true;
            cone.rotation.z = Math.PI / 2.2; // Knock over visually
            cone.position.x += (Math.random() - 0.5) * 0.8;
            this.slalom.conesHit += 1;
            this.slalom.penaltyTime = this.slalom.conesHit * 2.0;
          }
        }
      }

      // Slalom course finish line is at Z = 100m
      if (pos.z >= 100.0) {
        this.state = 'COMPLETED';
        this.slalom.netTime = this.timer + this.slalom.penaltyTime;
        if (!this.bestTimes.slalomNet || this.slalom.netTime < this.bestTimes.slalomNet) {
          this.bestTimes.slalomNet = this.slalom.netTime;
        }
      }
    }
  }

  updateSkidpad(dt, pos, speed, latG) {
    this.timer += dt;
    this.skidpad.peakGy = Math.max(this.skidpad.peakGy, latG);

    // Calculate drift angle (difference between vehicle heading and velocity vector)
    const vRig = this.engine.vehicleRig;
    if (vRig && speed > 15.0) {
      const chassisBody = this.engine.physics.chassisBody;
      const linvel = chassisBody.linvel();
      const moveAngle = Math.atan2(linvel.x, linvel.z);
      const heading = vRig.root.rotation.y;
      let driftAngle = Math.abs(moveAngle - heading);
      if (driftAngle > Math.PI) driftAngle = 2 * Math.PI - driftAngle;
      const driftDeg = (driftAngle * 180 / Math.PI);
      this.skidpad.currentAngle = driftDeg;

      // Accumulate drift points
      if (driftDeg > 14.0) {
        this.state = 'DRIFTING';
        this.skidpad.driftCombo = Math.min(4.0, this.skidpad.driftCombo + dt * 0.5);
        this.skidpad.driftScore += Math.round(driftDeg * (speed / 10.0) * this.skidpad.driftCombo * dt * 8.0);
      } else {
        this.state = 'RUNNING';
        this.skidpad.driftCombo = 1.0;
      }
    }
  }

  updateFreeroam(dt, pos, speed, latG) {
    this.timer += dt;
    const speedMs = speed / 3.6;
    this.freeroam.distanceMeters += speedMs * dt;
    this.freeroam.topSpeedKmh = Math.max(this.freeroam.topSpeedKmh, speed);
  }

  updateScenarioLabels() {
    if (!this.dom.title) return;
    const titles = {
      sprint: '🏁 0–100 SPRINT / 200M TRAP',
      slalom: '⚡ SLALOM AGILITY COURSE',
      skidpad: '⭕ 360° SKIDPAD & DRIFT',
      freeroam: '🛣️ PROVING GROUND FREE ROAM'
    };
    this.dom.title.textContent = titles[this.activeScenario] || 'DYNAMIC SCENARIO';
  }

  formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '--.-- s';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds * 100) % 100);
    return `${m > 0 ? m + ':' : ''}${s < 10 && m > 0 ? '0' : ''}${s}.${ms < 10 ? '0' : ''}${ms} s`;
  }

  renderHUD() {
    if (!this.dom.timer) return;

    // Timer display (mm:ss.cc)
    const m = Math.floor(this.timer / 60);
    const s = Math.floor(this.timer % 60);
    const ms = Math.floor((this.timer * 100) % 100);
    this.dom.timer.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 10 ? '0' : ''}${ms}`;

    // Status pill
    if (this.dom.status) {
      this.dom.status.textContent = this.state;
      this.dom.status.className = 'scenario-status-tag ' + this.state.toLowerCase();
    }

    // Detail rows depending on scenario
    if (this.activeScenario === 'sprint') {
      if (this.dom.stat1) this.dom.stat1.innerHTML = `<span>0–60 km/h:</span> <strong>${this.formatTime(this.sprint.split60)}</strong>`;
      if (this.dom.stat2) this.dom.stat2.innerHTML = `<span>0–100 km/h:</span> <strong>${this.formatTime(this.sprint.split100)}</strong>`;
      if (this.dom.stat3) {
        const trapText = this.sprint.trapTime
          ? `${this.formatTime(this.sprint.trapTime)} @ ${this.sprint.trapSpeed.toFixed(1)} km/h`
          : (this.bestTimes.sprint100 ? `Best 0-100: ${this.formatTime(this.bestTimes.sprint100)}` : `Peak: ${this.sprint.peakGx.toFixed(2)} G`);
        this.dom.stat3.innerHTML = `<span>200m Trap:</span> <strong>${trapText}</strong>`;
      }
    } else if (this.activeScenario === 'slalom') {
      if (this.dom.stat1) this.dom.stat1.innerHTML = `<span>Cones Hit:</span> <strong style="color: ${this.slalom.conesHit > 0 ? '#ef4444' : '#10b981'};">${this.slalom.conesHit} (+${this.slalom.penaltyTime.toFixed(1)}s)</strong>`;
      if (this.dom.stat2) this.dom.stat2.innerHTML = `<span>Course Time:</span> <strong>${this.formatTime(this.timer)}</strong>`;
      if (this.dom.stat3) {
        const net = this.state === 'COMPLETED' ? this.formatTime(this.slalom.netTime) : '--.-- s';
        this.dom.stat3.innerHTML = `<span>Net Agility Time:</span> <strong>${net}</strong>`;
      }
    } else if (this.activeScenario === 'skidpad') {
      if (this.dom.stat1) this.dom.stat1.innerHTML = `<span>Peak Lateral G:</span> <strong>${this.skidpad.peakGy.toFixed(2)} G</strong>`;
      if (this.dom.stat2) this.dom.stat2.innerHTML = `<span>Drift Angle:</span> <strong>${this.skidpad.currentAngle.toFixed(1)}&deg;</strong>`;
      if (this.dom.stat3) this.dom.stat3.innerHTML = `<span>Drift Score:</span> <strong style="color: #00f0ff;">${this.skidpad.driftScore} pts (x${this.skidpad.driftCombo.toFixed(1)})</strong>`;
    } else if (this.activeScenario === 'freeroam') {
      const km = (this.freeroam.distanceMeters / 1000.0).toFixed(2);
      if (this.dom.stat1) this.dom.stat1.innerHTML = `<span>Trip Distance:</span> <strong>${km} km</strong>`;
      if (this.dom.stat2) this.dom.stat2.innerHTML = `<span>Top Speed:</span> <strong>${this.freeroam.topSpeedKmh.toFixed(1)} km/h</strong>`;
      if (this.dom.stat3) this.dom.stat3.innerHTML = `<span>Surface μ:</span> <strong>${(1.05 * this.engine.physics.surfaceFriction).toFixed(2)} (${this.weather.toUpperCase()})</strong>`;
    }
  }
}
