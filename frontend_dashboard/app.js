/**
 * OpenTwin Dashboard Telemetry Client
 * Handles real-time WebSocket communication, gauge SVG transforms,
 * cluster indicator states, and CAN frame stream inspection.
 */

// DOM Elements
const wsDot = document.getElementById('ws-dot');
const wsStatus = document.getElementById('ws-status');
const fpsCounter = document.getElementById('fps-counter');
const totalFramesEl = document.getElementById('total-frames');

// RPM & Speed Gauges
const rpmNeedle = document.getElementById('rpm-needle');
const rpmArc = document.getElementById('rpm-arc');
const rpmDigital = document.getElementById('rpm-digital');
const throttleVal = document.getElementById('throttle-val');
const throttleFill = document.getElementById('throttle-fill');

const speedNeedle = document.getElementById('speed-needle');
const speedArc = document.getElementById('speed-arc');
const speedDigital = document.getElementById('speed-digital');
const speedSubDigital = document.getElementById('speed-sub-digital');

// Center Telemetry & Warnings
const odoVal = document.getElementById('odo-val');
const steeringVal = document.getElementById('steering-val');
const turnLeft = document.getElementById('turn-left');
const turnRight = document.getElementById('turn-right');
const warnEngine = document.getElementById('warn-engine');
const warnBattery = document.getElementById('warn-battery');
const warnTpms = document.getElementById('warn-tpms');
const warnAbs = document.getElementById('warn-abs');
const warnBrake = document.getElementById('warn-brake');
const warnLights = document.getElementById('warn-lights');
const gearItems = document.querySelectorAll('.gear-item');

// Levels Grid
const tempVal = document.getElementById('temp-val');
const tempFill = document.getElementById('temp-fill');
const oilVal = document.getElementById('oil-val');
const oilFill = document.getElementById('oil-fill');
const fuelVal = document.getElementById('fuel-val');
const fuelFill = document.getElementById('fuel-fill');
const batteryVal = document.getElementById('battery-val');
const batteryFill = document.getElementById('battery-fill');

// CAN Inspector
const canTbody = document.getElementById('can-tbody');
const btnPause = document.getElementById('btn-pause');
const btnClear = document.getElementById('btn-clear');
const filterId = document.getElementById('filter-id');

let isPaused = false;
let ws = null;
let maxTableRows = 50;
let tableFrames = [];

// Gauge Constants (Arc length: 2 * PI * 115 ≈ 722, sweep angle: 240 deg => visible dash: 480)
const MAX_RPM = 8000.0;
const MAX_SPEED = 240.0;
const ARC_MAX_OFFSET = 540;
const ARC_MIN_OFFSET = 180; // Swept arc range

function mapRange(val, inMin, inMax, outMin, outMax) {
  return ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function updateRPMGauge(rpm) {
  const clampedRPM = Math.max(0, Math.min(MAX_RPM, rpm));
  // Needle sweep from -120deg to +120deg (240 deg total sweep)
  const angle = mapRange(clampedRPM, 0, MAX_RPM, -120, 120);
  rpmNeedle.style.transform = `rotate(${angle}deg)`;

  // Arc stroke offset
  const offset = mapRange(clampedRPM, 0, MAX_RPM, ARC_MAX_OFFSET, ARC_MIN_OFFSET);
  rpmArc.style.strokeDashoffset = offset;

  rpmDigital.textContent = (clampedRPM / 1000).toFixed(1);
}

function updateSpeedGauge(speed) {
  const clampedSpeed = Math.max(0, Math.min(MAX_SPEED, speed));
  const angle = mapRange(clampedSpeed, 0, MAX_SPEED, -120, 120);
  speedNeedle.style.transform = `rotate(${angle}deg)`;

  const offset = mapRange(clampedSpeed, 0, MAX_SPEED, ARC_MAX_OFFSET, ARC_MIN_OFFSET);
  speedArc.style.strokeDashoffset = offset;

  speedDigital.textContent = Math.round(clampedSpeed);
  speedSubDigital.textContent = Math.round(clampedSpeed);
}

function updateIndicators(data) {
  // Gear
  const currentGear = data.Gear || "P";
  gearItems.forEach(item => {
    if (item.getAttribute('data-gear') === currentGear) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Turn Signals
  const turn = data.TurnSignal || "NONE";
  turnLeft.classList.toggle('blinking', turn === "LEFT" || turn === "HAZARD");
  turnRight.classList.toggle('blinking', turn === "RIGHT" || turn === "HAZARD");

  // Warnings
  warnEngine.classList.toggle('active-red', Boolean(data.CheckEngineLight));
  warnBattery.classList.toggle('active-red', Boolean(data.BatteryWarning));
  warnTpms.classList.toggle('active-amber', Boolean(data.TirePressureWarning));
  warnAbs.classList.toggle('active-amber', Boolean(data.ABSWarning));
  warnBrake.classList.toggle('active-red', Boolean(data.BrakeActive));
  warnLights.classList.toggle('active-blue', Boolean(data.HeadlightsActive));

  // Throttle
  const throttle = Math.max(0, Math.min(100, data.ThrottlePosition || 0));
  throttleVal.textContent = `${Math.round(throttle)}%`;
  throttleFill.style.width = `${throttle}%`;

  // Coolant Temp (-40..150 C, display 50..120 standard)
  const temp = data.EngineTemp || 85;
  tempVal.textContent = `${Math.round(temp)}°C`;
  const tempPct = mapRange(Math.max(40, Math.min(130, temp)), 40, 130, 0, 100);
  tempFill.style.width = `${tempPct}%`;
  tempFill.style.background = temp > 105 ? '#ef4444' : 'linear-gradient(90deg, #3b82f6, #00f0ff)';

  // Oil Pressure
  const oil = data.OilPressure || 3.5;
  oilVal.textContent = `${oil.toFixed(1)} bar`;
  oilFill.style.width = `${mapRange(Math.max(0, Math.min(8, oil)), 0, 8, 0, 100)}%`;

  // Fuel & Battery
  const fuel = data.FuelLevel !== undefined ? data.FuelLevel : 75;
  fuelVal.textContent = `${Math.round(fuel)}%`;
  fuelFill.style.width = `${fuel}%`;

  const battery = data.BatterySOC !== undefined ? data.BatterySOC : 85;
  batteryVal.textContent = `${Math.round(battery)}%`;
  batteryFill.style.width = `${battery}%`;

  // Odometer & Steering
  if (data.Odometer !== undefined) {
    odoVal.textContent = `${data.Odometer.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }
  if (data.SteeringAngle !== undefined) {
    steeringVal.textContent = `${data.SteeringAngle.toFixed(1)}°`;
  }

  // FPS & Total frames
  if (data.FPS !== undefined) fpsCounter.textContent = `${data.FPS} Hz`;
  if (data.TotalFrames !== undefined) totalFramesEl.textContent = data.TotalFrames.toLocaleString();
}

function renderInspectorTable() {
  if (isPaused) return;

  const filter = filterId.value;
  const filtered = tableFrames.filter(frame => {
    if (filter === "ALL") return true;
    return frame.can_id_hex === filter;
  });

  if (filtered.length === 0) {
    canTbody.innerHTML = `<tr class="empty-row"><td colspan="5">Awaiting matching CAN traffic...</td></tr>`;
    return;
  }

  const rows = filtered.slice(-15).reverse().map(frame => {
    let badgeClass = "id-100";
    if (frame.can_id_hex === "0x200") badgeClass = "id-200";
    if (frame.can_id_hex === "0x300") badgeClass = "id-300";

    const sigString = JSON.stringify(frame.signals);
    return `
      <tr>
        <td>${Number(frame.timestamp).toFixed(6)}</td>
        <td><span class="can-id-badge ${badgeClass}">${frame.can_id_hex}</span></td>
        <td>${frame.message_name}</td>
        <td class="raw-hex-text">${frame.raw_hex}</td>
        <td><span class="signals-json" title='${sigString}'>${sigString}</span></td>
      </tr>
    `;
  }).join("");

  canTbody.innerHTML = rows;
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:8080';
  const wsUrl = `${protocol}//${host}/ws`;

  console.log(`[OpenTwin] Connecting to WebSocket: ${wsUrl}`);
  wsStatus.textContent = "Connecting...";
  wsDot.className = "status-dot disconnected";

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[OpenTwin] WebSocket connected successfully");
    wsStatus.textContent = "Streaming Live";
    wsDot.className = "status-dot connected";
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "telemetry") {
        const data = msg.data;
        updateRPMGauge(data.EngineSpeed || 0);
        updateSpeedGauge(data.VehicleSpeed || 0);
        updateIndicators(data);

        if (msg.inspector && msg.inspector.length > 0 && !isPaused) {
          msg.inspector.forEach(f => {
            tableFrames.push(f);
            if (tableFrames.length > maxTableRows) tableFrames.shift();
          });
          renderInspectorTable();
        }
      }
    } catch (e) {
      console.error("[OpenTwin] Error parsing telemetry message:", e);
    }
  };

  ws.onclose = () => {
    console.warn("[OpenTwin] WebSocket disconnected, reconnecting in 2s...");
    wsStatus.textContent = "Offline (Reconnecting)";
    wsDot.className = "status-dot disconnected";
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error("[OpenTwin] WebSocket error:", err);
    ws.close();
  };
}

// Event Listeners
btnPause.addEventListener('click', () => {
  isPaused = !isPaused;
  btnPause.textContent = isPaused ? "RESUME STREAM" : "PAUSE STREAM";
  btnPause.style.background = isPaused ? "#ef4444" : "";
});

btnClear.addEventListener('click', () => {
  tableFrames = [];
  canTbody.innerHTML = `<tr class="empty-row"><td colspan="5">Log cleared. Awaiting new frames...</td></tr>`;
});

filterId.addEventListener('change', () => {
  renderInspectorTable();
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  updateRPMGauge(0);
  updateSpeedGauge(0);
  connectWebSocket();
});
