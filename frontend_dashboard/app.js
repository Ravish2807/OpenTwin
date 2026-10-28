/**
 * OpenTwin: Automotive CAN Network Emulator & Telemetry Workbench Client
 * High-performance telemetry streaming, multi-view cockpit cluster,
 * 60 FPS oscilloscope, Wireshark-style CAN inspector, ECU injector, and DBC explorer.
 */

// Global State
const state = {
  activeTab: 'cockpit',
  driveMode: 'comfort',
  isWsConnected: false,
  isScopePaused: false,
  isInspectorPaused: false,
  scopeTimespanSec: 20,
  filterId: 'ALL',
  inspectorSearch: '',
  maxTableRows: 80,
  inspectorFrames: [],
  dbcMessages: [],
  
  // Waveform buffer for oscilloscope
  scopeBuffer: [],
  maxScopeHistorySec: 60,
  
  // Fault states for injector
  faults: {
    checkEngine: false,
    tpms: false,
    battery: false,
    abs: false
  },

  // Manual injector parameters
  injector: {
    rpm: 2500,
    speed: 60,
    throttle: 25,
    temp: 85,
    gear: 3, // D
    turnSignal: 0 // OFF
  }
};

let ws = null;
let animFrameId = null;

// ================= DOM ELEMENT REFERENCES =================
const elements = {
  // Master Header
  wsDot: document.getElementById('ws-dot'),
  wsStatus: document.getElementById('ws-status'),
  fpsCounter: document.getElementById('fps-counter'),
  ifaceName: document.getElementById('iface-name'),
  btnReplayPause: document.getElementById('btn-replay-pause'),
  btnReplayRestart: document.getElementById('btn-replay-restart'),
  speedBtns: document.querySelectorAll('.speed-btn'),
  modePills: document.querySelectorAll('.mode-pill'),
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),

  // Cockpit Gauges
  rpmNeedle: document.getElementById('rpm-needle'),
  rpmArc: document.getElementById('rpm-arc'),
  rpmDigital: document.getElementById('rpm-digital'),
  speedNeedle: document.getElementById('speed-needle'),
  speedArc: document.getElementById('speed-arc'),
  speedDigital: document.getElementById('speed-digital'),
  speedSubDigital: document.getElementById('speed-sub-digital'),
  currentModeTag: document.getElementById('current-mode-tag'),
  
  // Telltales & Warnings
  turnLeft: document.getElementById('turn-left'),
  turnRight: document.getElementById('turn-right'),
  warnEngine: document.getElementById('warn-engine'),
  warnBattery: document.getElementById('warn-battery'),
  warnTpms: document.getElementById('warn-tpms'),
  warnAbs: document.getElementById('warn-abs'),
  warnBrake: document.getElementById('warn-brake'),
  warnLights: document.getElementById('warn-lights'),
  gearSlots: document.querySelectorAll('.gear-slot'),

  // Chassis HUD
  wheelFl: document.getElementById('wheel-front-left'),
  wheelFr: document.getElementById('wheel-front-right'),
  beamLeft: document.getElementById('beam-left'),
  beamRight: document.getElementById('beam-right'),
  tpmsFlCard: document.querySelector('.tpms-card.fl'),
  tpmsFrCard: document.querySelector('.tpms-card.fr'),
  steeringVal: document.getElementById('steering-val'),
  odoVal: document.getElementById('odo-val'),
  sysTime: document.getElementById('sys-time'),

  // Linear & Resource Meters
  throttleVal: document.getElementById('throttle-val'),
  throttleFill: document.getElementById('throttle-fill'),
  oilVal: document.getElementById('oil-val'),
  oilFill: document.getElementById('oil-fill'),
  tempVal: document.getElementById('temp-val'),
  tempFill: document.getElementById('temp-fill'),
  fuelVal: document.getElementById('fuel-val'),
  fuelFill: document.getElementById('fuel-fill'),
  batteryVal: document.getElementById('battery-val'),
  batteryFill: document.getElementById('battery-fill'),

  // Oscilloscope
  scopeCanvas: document.getElementById('scopeCanvas'),
  scopeTooltip: document.getElementById('scopeTooltip'),
  btnScopePause: document.getElementById('btn-scope-pause'),
  btnScopeClear: document.getElementById('btn-scope-clear'),
  scopeTimespan: document.getElementById('scope-timespan'),
  traceRpmChk: document.getElementById('trace-rpm-chk'),
  traceSpeedChk: document.getElementById('trace-speed-chk'),
  traceThrottleChk: document.getElementById('trace-throttle-chk'),
  traceTempChk: document.getElementById('trace-temp-chk'),
  scopePeakRpm: document.getElementById('scope-peak-rpm'),
  scopeMaxSpeed: document.getElementById('scope-max-speed'),
  scopeAvgThrottle: document.getElementById('scope-avg-throttle'),
  scopePeakTemp: document.getElementById('scope-peak-temp'),

  // CAN Inspector
  canInspectorTbody: document.getElementById('can-inspector-tbody'),
  inspTotalFrames: document.getElementById('insp-total-frames'),
  inspFps: document.getElementById('insp-fps'),
  inspBusLoad: document.getElementById('insp-bus-load'),
  inspActiveIds: document.getElementById('insp-active-ids'),
  inspectorSearch: document.getElementById('inspector-search'),
  filterCanId: document.getElementById('filter-can-id'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnTableClear: document.getElementById('btn-table-clear'),
  btnTablePause: document.getElementById('btn-table-pause'),

  // ECU Injector Controls
  injRpm: document.getElementById('inj-rpm'),
  injRpmDisplay: document.getElementById('inj-rpm-display'),
  injSpeed: document.getElementById('inj-speed'),
  injSpeedDisplay: document.getElementById('inj-speed-display'),
  injThrottle: document.getElementById('inj-throttle'),
  injThrottleDisplay: document.getElementById('inj-throttle-display'),
  injTemp: document.getElementById('inj-temp'),
  injTempDisplay: document.getElementById('inj-temp-display'),
  injGearButtons: document.querySelectorAll('#inj-gear-selector .radio-btn'),
  injTurnButtons: document.querySelectorAll('#inj-turn-selector .radio-btn'),
  btnTransmitPowertrain: document.getElementById('btn-transmit-powertrain'),
  presetButtons: document.querySelectorAll('.preset-btn'),
  
  // Fault buttons
  faultBtnEngine: document.getElementById('fault-btn-check-engine'),
  faultBtnTpms: document.getElementById('fault-btn-tpms'),
  faultBtnBattery: document.getElementById('fault-btn-battery'),
  faultBtnAbs: document.getElementById('fault-btn-abs'),

  // Arbitrary Frame
  rawCanId: document.getElementById('raw-can-id'),
  rawCanPayload: document.getElementById('raw-can-payload'),
  btnSendRawFrame: document.getElementById('btn-send-raw-frame'),
  rawSendStatus: document.getElementById('raw-send-status'),
  terminalLog: document.getElementById('injector-terminal-log'),

  // DBC Explorer
  dbcContainer: document.getElementById('dbc-catalog-container'),
  dbcSearchInput: document.getElementById('dbc-search-input')
};

// ================= UTILITY FUNCTIONS =================
function mapRange(val, inMin, inMax, outMin, outMax) {
  return ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function logToTerminal(msg, type = 'info') {
  if (!elements.terminalLog) return;
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  const now = new Date().toTimeString().split(' ')[0];
  line.textContent = `[${now}] ${msg}`;
  elements.terminalLog.appendChild(line);
  elements.terminalLog.scrollTop = elements.terminalLog.scrollHeight;
}

// ================= GAUGE TRANSFORM CONSTANTS =================
const MAX_RPM = 8000.0;
const MAX_SPEED = 240.0;
const ARC_MAX_OFFSET = 540;
const ARC_MIN_OFFSET = 180;

function updateRPMGauge(rpm) {
  const clampedRPM = Math.max(0, Math.min(MAX_RPM, rpm));
  const angle = mapRange(clampedRPM, 0, MAX_RPM, -120, 120);
  elements.rpmNeedle.style.transform = `rotate(${angle}deg)`;

  const offset = mapRange(clampedRPM, 0, MAX_RPM, ARC_MAX_OFFSET, ARC_MIN_OFFSET);
  elements.rpmArc.style.strokeDashoffset = offset;
  elements.rpmDigital.textContent = (clampedRPM / 1000).toFixed(1);
}

function updateSpeedGauge(speed) {
  const clampedSpeed = Math.max(0, Math.min(MAX_SPEED, speed));
  const angle = mapRange(clampedSpeed, 0, MAX_SPEED, -120, 120);
  elements.speedNeedle.style.transform = `rotate(${angle}deg)`;

  const offset = mapRange(clampedSpeed, 0, MAX_SPEED, ARC_MAX_OFFSET, ARC_MIN_OFFSET);
  elements.speedArc.style.strokeDashoffset = offset;

  const roundSpeed = Math.round(clampedSpeed);
  elements.speedDigital.textContent = roundSpeed;
  elements.speedSubDigital.textContent = roundSpeed;
}

function updateCockpit(data) {
  updateRPMGauge(data.EngineSpeed || 0);
  updateSpeedGauge(data.VehicleSpeed || 0);

  // Transmission Gear
  const currentGear = data.Gear || "P";
  elements.gearSlots.forEach(slot => {
    slot.classList.toggle('active', slot.getAttribute('data-gear') === currentGear);
  });

  // Turn Signals & Hazard
  const turn = data.TurnSignal || "NONE";
  elements.turnLeft.classList.toggle('blinking', turn === "LEFT" || turn === "HAZARD");
  elements.turnRight.classList.toggle('blinking', turn === "RIGHT" || turn === "HAZARD");

  // Warning Lights Array
  elements.warnEngine.classList.toggle('active-red', Boolean(data.CheckEngineLight));
  elements.warnBattery.classList.toggle('active-red', Boolean(data.BatteryWarning));
  elements.warnTpms.classList.toggle('active-amber', Boolean(data.TirePressureWarning));
  elements.warnAbs.classList.toggle('active-amber', Boolean(data.ABSWarning));
  elements.warnBrake.classList.toggle('active-red', Boolean(data.BrakeActive));
  elements.warnLights.classList.toggle('active-blue', Boolean(data.HeadlightsActive));

  // Chassis HUD & Steering Angle
  const steering = data.SteeringAngle || 0;
  elements.steeringVal.textContent = `${steering.toFixed(1)}°`;
  const wheelDeg = Math.max(-35, Math.min(35, steering * 0.7));
  if (elements.wheelFl) elements.wheelFl.style.transform = `rotate(${wheelDeg}deg)`;
  if (elements.wheelFr) elements.wheelFr.style.transform = `rotate(${wheelDeg}deg)`;

  // Headlamps beam effect
  const lightsOn = Boolean(data.HeadlightsActive);
  if (elements.beamLeft) elements.beamLeft.classList.toggle('active', lightsOn);
  if (elements.beamRight) elements.beamRight.classList.toggle('active', lightsOn);

  // TPMS alerts on wheels
  const tpmsAlert = Boolean(data.TirePressureWarning);
  if (elements.tpmsFlCard) elements.tpmsFlCard.classList.toggle('alert', tpmsAlert);
  if (elements.tpmsFrCard) elements.tpmsFrCard.classList.toggle('alert', tpmsAlert);

  // Linear Meters
  const throttle = Math.max(0, Math.min(100, data.ThrottlePosition || 0));
  elements.throttleVal.textContent = `${Math.round(throttle)}%`;
  elements.throttleFill.style.width = `${throttle}%`;

  const oil = data.OilPressure || 3.5;
  elements.oilVal.textContent = `${oil.toFixed(1)} bar`;
  elements.oilFill.style.width = `${mapRange(Math.max(0, Math.min(8, oil)), 0, 8, 0, 100)}%`;

  const temp = data.EngineTemp || 85;
  elements.tempVal.textContent = `${Math.round(temp)}°C`;
  const tempPct = mapRange(Math.max(40, Math.min(130, temp)), 40, 130, 0, 100);
  elements.tempFill.style.width = `${tempPct}%`;
  elements.tempFill.style.background = temp > 105 ? '#ef4444' : 'linear-gradient(90deg, #1d4ed8, #38bdf8)';

  const fuel = data.FuelLevel !== undefined ? data.FuelLevel : 78;
  elements.fuelVal.textContent = `${Math.round(fuel)}%`;
  elements.fuelFill.style.width = `${fuel}%`;

  const battery = data.BatterySOC !== undefined ? data.BatterySOC : 88;
  elements.batteryVal.textContent = `${Math.round(battery)}%`;
  elements.batteryFill.style.width = `${battery}%`;

  if (data.Odometer !== undefined) {
    elements.odoVal.textContent = `${data.Odometer.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }

  // System time
  elements.sysTime.textContent = new Date().toTimeString().split(' ')[0];

  // Rates & Frame counts
  if (data.FPS !== undefined) elements.fpsCounter.textContent = `${data.FPS} Hz`;
  if (data.TotalFrames !== undefined) {
    elements.inspTotalFrames.textContent = data.TotalFrames.toLocaleString();
  }

  // Replay Status synchronization
  if (data.ReplayPaused !== undefined) {
    elements.btnReplayPause.textContent = data.ReplayPaused ? "▶ Resume" : "⏸ Pause";
    elements.btnReplayPause.classList.toggle('active', data.ReplayPaused);
  }
}

// ================= OSCILLOSCOPE ENGINE =================
function initOscilloscope() {
  const canvas = elements.scopeCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 420;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function renderScope() {
    if (!state.isScopePaused) {
      drawScopeFrame(ctx, canvas.width, canvas.height);
    }
    animFrameId = requestAnimationFrame(renderScope);
  }
  animFrameId = requestAnimationFrame(renderScope);
}

function drawScopeFrame(ctx, width, height) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, width, height);

  // Draw Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  const vSteps = 8;
  for (let i = 1; i < vSteps; i++) {
    const y = (height / vSteps) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const hSteps = 10;
  for (let i = 1; i < hSteps; i++) {
    const x = (width / hSteps) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  if (state.scopeBuffer.length < 2) return;

  const now = state.scopeBuffer[state.scopeBuffer.length - 1].time;
  const windowSec = state.scopeTimespanSec;
  const minTime = now - windowSec;

  const visibleData = state.scopeBuffer.filter(pt => pt.time >= minTime);
  if (visibleData.length < 2) return;

  function plotSignal(getter, color, minVal, maxVal) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    let started = false;
    for (const pt of visibleData) {
      const val = getter(pt);
      const x = mapRange(pt.time, minTime, now, 0, width);
      const y = height - mapRange(Math.max(minVal, Math.min(maxVal, val)), minVal, maxVal, 20, height - 20);

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  if (elements.traceRpmChk.checked) {
    plotSignal(pt => pt.rpm, '#00f0ff', 0, 8000);
  }
  if (elements.traceSpeedChk.checked) {
    plotSignal(pt => pt.speed, '#38bdf8', 0, 240);
  }
  if (elements.traceThrottleChk.checked) {
    plotSignal(pt => pt.throttle, '#f97316', 0, 100);
  }
  if (elements.traceTempChk.checked) {
    plotSignal(pt => pt.temp, '#ef4444', 0, 150);
  }
}

function updateScopeSummaryMetrics() {
  if (state.scopeBuffer.length === 0) return;
  const recent = state.scopeBuffer.slice(-300);

  let peakRpm = 0;
  let maxSpeed = 0;
  let sumThrottle = 0;
  let peakTemp = 0;

  recent.forEach(pt => {
    if (pt.rpm > peakRpm) peakRpm = pt.rpm;
    if (pt.speed > maxSpeed) maxSpeed = pt.speed;
    sumThrottle += pt.throttle;
    if (pt.temp > peakTemp) peakTemp = pt.temp;
  });

  elements.scopePeakRpm.textContent = `${Math.round(peakRpm)} RPM`;
  elements.scopeMaxSpeed.textContent = `${Math.round(maxSpeed)} km/h`;
  elements.scopeAvgThrottle.textContent = `${Math.round(sumThrottle / recent.length)}%`;
  elements.scopePeakTemp.textContent = `${Math.round(peakTemp)}°C`;
}

// ================= CAN BUS INSPECTOR =================
function renderInspector() {
  if (state.isInspectorPaused) return;

  const search = state.inspectorSearch.toLowerCase();
  const filter = state.filterId;

  const filtered = state.inspectorFrames.filter(frame => {
    if (filter !== 'ALL' && frame.can_id_hex !== filter) return false;
    if (!search) return true;

    const fullStr = `${frame.can_id_hex} ${frame.message_name} ${frame.raw_hex} ${JSON.stringify(frame.signals)}`.toLowerCase();
    return fullStr.includes(search);
  });

  if (filtered.length === 0) {
    elements.canInspectorTbody.innerHTML = `
      <tr class="empty-feed-row">
        <td colspan="6">No CAN frames matching current search criteria...</td>
      </tr>
    `;
    return;
  }

  // Render recent 25 rows in reverse order
  const rows = filtered.slice(-25).reverse().map(frame => {
    let badgeClass = "badge-id-100";
    if (frame.can_id_hex === "0x200") badgeClass = "badge-id-200";
    if (frame.can_id_hex === "0x300") badgeClass = "badge-id-300";

    // Split raw hex into 2-character byte blocks
    const hex = frame.raw_hex || "";
    const byteBlocks = [];
    for (let i = 0; i < hex.length; i += 2) {
      byteBlocks.push(`<span class="byte-block">${hex.substr(i, 2)}</span>`);
    }

    // Format signals chips
    const sigChips = Object.entries(frame.signals || {}).map(([k, v]) => {
      const displayVal = typeof v === 'number' ? v.toFixed(1) : v;
      return `<span class="sig-chip">${k}: ${displayVal}</span>`;
    }).join("");

    return `
      <tr>
        <td>${Number(frame.timestamp).toFixed(6)}</td>
        <td><span class="can-badge ${badgeClass}">${frame.can_id_hex}</span></td>
        <td><strong>${frame.message_name}</strong></td>
        <td>${Math.floor(hex.length / 2)}</td>
        <td>${byteBlocks.join("")}</td>
        <td><div class="signals-tag-list">${sigChips || '<span class="text-dim">No signals</span>'}</div></td>
      </tr>
    `;
  }).join("");

  elements.canInspectorTbody.innerHTML = rows;

  // Update summary stats
  const uniqueIds = new Set(state.inspectorFrames.map(f => f.can_id_hex)).size;
  elements.inspActiveIds.textContent = `${uniqueIds} IDs`;
  elements.inspFps.textContent = elements.fpsCounter.textContent;
  elements.inspBusLoad.textContent = `${(Math.min(85, (uniqueIds * 6.2) + Math.random() * 2)).toFixed(1)}%`;
}

function exportInspectorToCSV() {
  if (state.inspectorFrames.length === 0) {
    alert("No CAN frames currently logged to export.");
    return;
  }

  const csvRows = [
    ["Timestamp", "CAN_ID_Hex", "Message_Name", "DLC", "Raw_Hex", "Decoded_Signals"]
  ];

  state.inspectorFrames.forEach(f => {
    csvRows.push([
      f.timestamp,
      f.can_id_hex,
      f.message_name,
      Math.floor(f.raw_hex.length / 2),
      f.raw_hex,
      JSON.stringify(f.signals).replace(/"/g, '""')
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `opentwin_can_log_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  logToTerminal("Exported logged CAN frames to CSV file.", "success");
}

// ================= ECU INJECTOR & PACKING =================
function packEngineDataHex(rpm, speed, throttle, temp, oil) {
  const rawRpm = Math.floor(rpm / 0.25) & 0xFFFF;
  const rawSpeed = Math.floor(speed / 0.01) & 0xFFFF;
  const rawThrottle = Math.floor(throttle * 255.0 / 100.0) & 0xFF;
  const rawTemp = Math.floor(temp + 40) & 0xFF;
  const rawOil = Math.floor(oil / 0.05) & 0xFF;

  // Little-endian 16-bit
  const b0 = rawRpm & 0xFF;
  const b1 = (rawRpm >> 8) & 0xFF;
  const b2 = rawSpeed & 0xFF;
  const b3 = (rawSpeed >> 8) & 0xFF;
  const b4 = rawThrottle;
  const b5 = rawTemp;
  const b6 = rawOil;
  const b7 = 0;

  return [b0, b1, b2, b3, b4, b5, b6, b7].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function packVehicleStatusHex(gear, turnSignal, brake, steering) {
  const fuel = 150; // 75%
  const batt = 170; // 85%
  const byte2 = (gear & 0x0F) | ((brake ? 1 : 0) << 4) | ((turnSignal & 0x07) << 5);
  
  // Signed 16-bit steering
  const steerRaw = Math.floor(steering / 0.1);
  const steerBytes = new Int16Array([steerRaw]);
  const u8 = new Uint8Array(steerBytes.buffer);

  const b0 = fuel;
  const b1 = batt;
  const b2 = byte2;
  const b3 = u8[0];
  const b4 = u8[1];
  const b5 = 1; // headlights
  const b6 = 0;
  const b7 = 0;

  return [b0, b1, b2, b3, b4, b5, b6, b7].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function packDiagnosticsHex(checkEngine, batteryWarn, tpmsWarn, absWarn) {
  const flags = (checkEngine ? 1 : 0) | ((batteryWarn ? 1 : 0) << 1) |
                ((tpmsWarn ? 1 : 0) << 2) | ((absWarn ? 1 : 0) << 3);
  
  const odoRaw = Math.floor(14250.4 * 10);
  const odoBytes = new Uint32Array([odoRaw]);
  const u8 = new Uint8Array(odoBytes.buffer);

  return [flags, u8[0], u8[1], u8[2], u8[3], 0, 0, 0].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function transmitOverriddenFrames() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logToTerminal("Cannot inject: WebSocket is offline.", "error");
    return;
  }

  // 1. Send Engine_Data (0x100)
  const hexEngine = packEngineDataHex(
    state.injector.rpm,
    state.injector.speed,
    state.injector.throttle,
    state.injector.temp,
    4.0
  );

  ws.send(JSON.stringify({
    action: "inject_frame",
    can_id: "0x100",
    hex_data: hexEngine
  }));

  // 2. Send Vehicle_Status (0x200)
  const hexStatus = packVehicleStatusHex(
    state.injector.gear,
    state.injector.turnSignal,
    false,
    0.0
  );

  ws.send(JSON.stringify({
    action: "inject_frame",
    can_id: "0x200",
    hex_data: hexStatus
  }));

  logToTerminal(`Transmitted Engine_Data (0x100#${hexEngine}) & Vehicle_Status (0x200#${hexStatus})`, "success");
}

function transmitDiagnostics() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const hexDiag = packDiagnosticsHex(
    state.faults.checkEngine,
    state.faults.battery,
    state.faults.tpms,
    state.faults.abs
  );

  ws.send(JSON.stringify({
    action: "inject_frame",
    can_id: "0x300",
    hex_data: hexDiag
  }));

  logToTerminal(`Injected Diagnostics_Alerts (0x300#${hexDiag}) [MIL:${state.faults.checkEngine}, TPMS:${state.faults.tpms}, BATT:${state.faults.battery}, ABS:${state.faults.abs}]`, "warn");
}

// ================= DBC CATALOG RENDERING =================
function renderDbcCatalog(messages) {
  if (!elements.dbcContainer) return;
  if (!messages || messages.length === 0) {
    elements.dbcContainer.innerHTML = `<div class="dbc-loading-state">No messages defined in database.</div>`;
    return;
  }

  state.dbcMessages = messages;
  const search = (elements.dbcSearchInput.value || "").toLowerCase();

  const html = messages.map(msg => {
    const isMatch = !search || 
      msg.name.toLowerCase().includes(search) || 
      msg.frame_id_hex.toLowerCase().includes(search) ||
      msg.signals.some(s => s.name.toLowerCase().includes(search));

    if (!isMatch) return "";

    const signalRows = msg.signals.map(s => {
      let choiceStr = "";
      if (s.choices) {
        choiceStr = Object.entries(s.choices).map(([k, v]) => `${k}="${v}"`).join(", ");
      }

      return `
        <tr>
          <td class="sig-name-cell">${s.name}</td>
          <td>${s.start}</td>
          <td>${s.length}</td>
          <td>${s.scale}</td>
          <td>${s.offset}</td>
          <td>[${s.minimum} | ${s.maximum}]</td>
          <td>${s.unit ? `<code>${s.unit}</code>` : '-'}</td>
          <td>${choiceStr || '-'}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="dbc-msg-card">
        <div class="dbc-msg-header">
          <div class="dbc-msg-title">
            <span class="dbc-id-pill">${msg.frame_id_hex} (${msg.frame_id})</span>
            <span class="dbc-msg-name">${msg.name}</span>
          </div>
          <div class="dbc-meta-info">
            DLC: <strong>${msg.length} Bytes</strong> | Sender: <strong>${msg.senders.join(", ")}</strong> | Signals: <strong>${msg.signals.length}</strong>
          </div>
        </div>
        <table class="dbc-signals-table">
          <thead>
            <tr>
              <th>SIGNAL NAME</th>
              <th>START BIT</th>
              <th>LENGTH</th>
              <th>SCALE</th>
              <th>OFFSET</th>
              <th>RANGE</th>
              <th>UNIT</th>
              <th>CHOICES / ENUM</th>
            </tr>
          </thead>
          <tbody>
            ${signalRows}
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  elements.dbcContainer.innerHTML = html || `<div class="dbc-loading-state">No matching DBC definitions found.</div>`;
}

// ================= WEBSOCKET STREAMING =================
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:8080';
  const wsUrl = `${protocol}//${host}/ws`;

  elements.wsStatus.textContent = "Connecting...";
  elements.wsDot.className = "hud-dot disconnected";

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    state.isWsConnected = true;
    window.ws = ws;
    if (window.sim3d && window.sim3d.canBridge) window.sim3d.canBridge.setWebSocket(ws);
    elements.wsStatus.textContent = "Streaming Live";
    elements.wsDot.className = "hud-dot connected";
    logToTerminal(`Connected to WebSocket telemetry feed: ${wsUrl}`, "success");

    // Request DBC description
    ws.send(JSON.stringify({ action: "get_dbc" }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "telemetry") {
        const data = msg.data;
        updateCockpit(data);
        if (window.sim3d && window.sim3d.canBridge) window.sim3d.canBridge.handleIncomingTelemetry(data);

        // Append to Oscilloscope rolling buffer
        const nowSec = performance.now() / 1000;
        state.scopeBuffer.push({
          time: nowSec,
          rpm: data.EngineSpeed || 0,
          speed: data.VehicleSpeed || 0,
          throttle: data.ThrottlePosition || 0,
          temp: data.EngineTemp || 85
        });

        // Prune older than 60 seconds
        if (state.scopeBuffer.length > 0 && (nowSec - state.scopeBuffer[0].time > state.maxScopeHistorySec)) {
          state.scopeBuffer.shift();
        }
        updateScopeSummaryMetrics();

        // Append to CAN Inspector buffer
        if (msg.inspector && msg.inspector.length > 0 && !state.isInspectorPaused) {
          msg.inspector.forEach(f => {
            state.inspectorFrames.push(f);
            if (state.inspectorFrames.length > state.maxTableRows) {
              state.inspectorFrames.shift();
            }
          });
          renderInspector();
        }
      } else if (msg.type === "dbc_info") {
        renderDbcCatalog(msg.messages);
      } else if (msg.type === "inject_ack") {
        elements.rawSendStatus.textContent = msg.status === "ok" ? `ACK 0x${msg.can_id.toString(16).toUpperCase()}` : `ERR: ${msg.error}`;
        elements.rawSendStatus.style.color = msg.status === "ok" ? "var(--color-green)" : "var(--color-red)";
      }
    } catch (e) {
      console.error("[OpenTwin] Message parsing error:", e);
    }
  };

  ws.onclose = () => {
    state.isWsConnected = false;
    elements.wsStatus.textContent = "Offline (Reconnecting)";
    elements.wsDot.className = "hud-dot disconnected";
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error("[OpenTwin] WebSocket error:", err);
    ws.close();
  };
}

// ================= EVENT LISTENERS SETUP =================
function setupEventListeners() {
  // 1. Navigation Tabs
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.navTabs.forEach(t => t.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.getAttribute('data-tab')}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
      state.activeTab = tab.getAttribute('data-tab');

      // Trigger redraws if needed
      if (state.activeTab === 'oscilloscope') {
        initOscilloscope();
      } else if (state.activeTab === 'sim3d' && window.sim3d) {
        window.sim3d.resize();
      }
    });
  });

  // 2. Drive Modes / Ambient Theme
  elements.modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const mode = pill.getAttribute('data-mode');
      state.driveMode = mode;
      document.documentElement.setAttribute('data-theme', mode);
      elements.currentModeTag.textContent = `${mode.toUpperCase()} DRIVE`;
      logToTerminal(`Drive Mode switch: ${mode.toUpperCase()}`, "info");
    });
  });

  // 3. Replay Playback & Speed
  elements.btnReplayPause.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: "replay_control", cmd: "toggle" }));
  });

  elements.btnReplayRestart.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: "replay_control", cmd: "restart" }));
    logToTerminal("Requested CAN replay loop restart.", "info");
  });

  elements.speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.getAttribute('data-speed'));
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "replay_control", cmd: "speed", speed: speed }));
        logToTerminal(`Set replay playback rate to ${speed}x`, "info");
      }
    });
  });

  // 4. Oscilloscope Controls
  elements.btnScopePause.addEventListener('click', () => {
    state.isScopePaused = !state.isScopePaused;
    elements.btnScopePause.textContent = state.isScopePaused ? "Resume Waveform" : "Freeze Waveform";
    elements.btnScopePause.classList.toggle('btn-primary', state.isScopePaused);
  });

  elements.btnScopeClear.addEventListener('click', () => {
    state.scopeBuffer = [];
  });

  elements.scopeTimespan.addEventListener('change', (e) => {
    state.scopeTimespanSec = parseInt(e.target.value, 10);
  });

  // 5. Inspector Controls
  elements.btnTablePause.addEventListener('click', () => {
    state.isInspectorPaused = !state.isInspectorPaused;
    elements.btnTablePause.textContent = state.isInspectorPaused ? "▶ Resume Feed" : "⏸ Pause Feed";
  });

  elements.btnTableClear.addEventListener('click', () => {
    state.inspectorFrames = [];
    renderInspector();
  });

  elements.btnExportCsv.addEventListener('click', exportInspectorToCSV);

  elements.filterCanId.addEventListener('change', (e) => {
    state.filterId = e.target.value;
    renderInspector();
  });

  elements.inspectorSearch.addEventListener('input', (e) => {
    state.inspectorSearch = e.target.value;
    renderInspector();
  });

  // 6. ECU Injector Sliders & Presets
  elements.injRpm.addEventListener('input', (e) => {
    state.injector.rpm = parseInt(e.target.value, 10);
    elements.injRpmDisplay.textContent = `${state.injector.rpm} RPM`;
  });

  elements.injSpeed.addEventListener('input', (e) => {
    state.injector.speed = parseInt(e.target.value, 10);
    elements.injSpeedDisplay.textContent = `${state.injector.speed} km/h`;
  });

  elements.injThrottle.addEventListener('input', (e) => {
    state.injector.throttle = parseInt(e.target.value, 10);
    elements.injThrottleDisplay.textContent = `${state.injector.throttle}%`;
  });

  elements.injTemp.addEventListener('input', (e) => {
    state.injector.temp = parseInt(e.target.value, 10);
    elements.injTempDisplay.textContent = `${state.injector.temp}°C`;
  });

  elements.presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.getAttribute('data-input');
      const val = parseInt(btn.getAttribute('data-val'), 10);
      const inputEl = document.getElementById(inputId);
      if (inputEl) {
        inputEl.value = val;
        inputEl.dispatchEvent(new Event('input'));
      }
    });
  });

  // Gear Selector
  elements.injGearButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.injGearButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.injector.gear = parseInt(btn.getAttribute('data-gear-val'), 10);
    });
  });

  // Turn Signal Selector
  elements.injTurnButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.injTurnButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.injector.turnSignal = parseInt(btn.getAttribute('data-turn-val'), 10);
    });
  });

  // Powertrain transmit button
  elements.btnTransmitPowertrain.addEventListener('click', transmitOverriddenFrames);

  // Fault Toggles
  function bindFaultToggle(btn, faultKey) {
    btn.addEventListener('click', () => {
      state.faults[faultKey] = !state.faults[faultKey];
      btn.classList.toggle('active', state.faults[faultKey]);
      const stateLbl = btn.querySelector('.fault-state');
      if (stateLbl) stateLbl.textContent = state.faults[faultKey] ? "ACTIVE (TRIGGERED)" : "INACTIVE";
      transmitDiagnostics();
    });
  }

  bindFaultToggle(elements.faultBtnEngine, 'checkEngine');
  bindFaultToggle(elements.faultBtnTpms, 'tpms');
  bindFaultToggle(elements.faultBtnBattery, 'battery');
  bindFaultToggle(elements.faultBtnAbs, 'abs');

  // Raw Frame Transmitter
  elements.btnSendRawFrame.addEventListener('click', () => {
    const rawId = elements.rawCanId.value.trim();
    const payload = elements.rawCanPayload.value.trim().replace(/\s+/g, '');
    if (!rawId || !payload) {
      alert("Please enter a valid Arbitration CAN ID and Hex Payload.");
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logToTerminal("Cannot transmit: WebSocket connection offline.", "error");
      return;
    }

    elements.rawSendStatus.textContent = "Transmitting...";
    elements.rawSendStatus.style.color = "var(--theme-accent)";

    ws.send(JSON.stringify({
      action: "inject_frame",
      can_id: rawId,
      hex_data: payload
    }));

    logToTerminal(`Transmitted Arbitrary Frame ID ${rawId}#${payload.toUpperCase()}`, "info");
  });

  // DBC Search
  elements.dbcSearchInput.addEventListener('input', () => {
    renderDbcCatalog(state.dbcMessages);
  });
}

// ================= INITIALIZATION =================
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateCockpit({
    EngineSpeed: 0,
    VehicleSpeed: 0,
    Gear: "P",
    ThrottlePosition: 0,
    EngineTemp: 85,
    OilPressure: 3.5,
    FuelLevel: 78,
    BatterySOC: 88,
    Odometer: 14250.4,
    FPS: 0,
    TotalFrames: 0
  });
  initOscilloscope();
  connectWebSocket();
});
