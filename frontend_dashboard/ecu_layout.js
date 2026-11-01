/**
 * OpenTwin: ECU Network Layout & Architecture Suite
 * Provides interactive vehicle electronic architecture (E/E) topologies:
 * 1. Distributed CAN 2.0B (Classical Multi-Node)
 * 2. Domain-Controller Architecture
 * 3. Zonal Software-Defined Vehicle (SDV)
 * 4. EV High-Voltage Powertrain Topology
 */

export class EcuLayoutManager {
  constructor() {
    this.activeLayout = 'distributed'; // 'distributed' | 'domain' | 'zonal' | 'ev'
    this.selectedNodeId = 'ECU_ENGINE';
    this.latestTelemetry = {};
    this.packetCounters = {};

    this.topologies = {
      distributed: {
        name: 'Classical Distributed CAN 2.0B',
        badge: '● DISTRIBUTED CAN 2.0B (500 kbps)',
        proto: 'ISO 11898-2 Classical CAN',
        baud: '500 kbps',
        term: '120 Ω (Split Dual End-Points)',
        busLoad: '28.4%',
        nodes: [
          {
            id: 'ECU_ENGINE',
            name: 'ECU_ENGINE (Engine Management)',
            type: 'POWERTRAIN CONTROLLER',
            icon: '⚙️',
            canIdHex: '0x100',
            canIdDec: 256,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 7), CAN_L (Pin 2), KL15 (Ignition), KL30 (Batt+)',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'EngineTemp', 'OilPressure'],
            description: 'Supervises internal combustion powertrain dynamics, fuel injection mapping, throttle drive-by-wire, and lubrication pressure.'
          },
          {
            id: 'ECU_BODY',
            name: 'ECU_BODY (Body Control Module)',
            type: 'CHASSIS & BODY CONTROLLER',
            icon: '💡',
            canIdHex: '0x200',
            canIdDec: 512,
            cycleTime: '20 ms (50 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 7), CAN_L (Pin 2), LIN-Bus Master, KL31 (Ground)',
            signals: ['FuelLevel', 'BatterySOC', 'Gear', 'BrakeActive', 'TurnSignal', 'SteeringAngle', 'HeadlightsActive'],
            description: 'Controls exterior LED projector lighting, turn indicators, transmission gear state, hydraulic braking switch, and steering angle sensors.'
          },
          {
            id: 'ECU_DIAG',
            name: 'ECU_DIAG (OBD-II Diagnostics GW)',
            type: 'DIAGNOSTIC & SAFETY GATEWAY',
            icon: '🛡️',
            canIdHex: '0x300',
            canIdDec: 768,
            cycleTime: '100 ms (10 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 6), CAN_L (Pin 14), K-Line (Pin 7), SAE J1962',
            signals: ['CheckEngineLight', 'BatteryWarning', 'TirePressureWarning', 'ABSWarning', 'Odometer'],
            description: 'Maintains Diagnostic Trouble Codes (DTCs), Malfunction Indicator Lamps (MIL), tire pressure monitoring, ABS fault triggers, and tamper-proof odometer.'
          },
          {
            id: 'ECU_DASHBOARD',
            name: 'ECU_DASHBOARD (Digital Cockpit)',
            type: 'INSTRUMENTATION GATEWAY',
            icon: '🚀',
            canIdHex: '0x400 / RX Hub',
            canIdDec: 1024,
            cycleTime: 'Event-Driven (60 Hz)',
            dlc: 'Multi-Packet',
            payloadType: 'Decoded Physical Telemetry',
            status: 'ONLINE',
            pinout: 'Dual CAN Gateway, LVDS Display SerDes, Ethernet 100Base-T1',
            signals: ['EngineSpeed', 'VehicleSpeed', 'Gear', 'Odometer', 'BatterySOC', 'HeadlightsActive'],
            description: 'Receives and visualizes vehicle telemetry for the driver instrument cluster, HUD displays, signal oscilloscope, and CAN frame stream inspector.'
          }
        ]
      },

      domain: {
        name: 'Domain-Controller E/E Architecture',
        badge: '● DOMAIN CONTROLLER (CAN-FD & ETHERNET)',
        proto: 'ISO 11898-1 CAN-FD & 100Base-T1',
        baud: '2.0 Mbps / 100 Mbps',
        term: '120 Ω Active Termination',
        busLoad: '36.8%',
        nodes: [
          {
            id: 'PT_DOMAIN',
            name: 'PT_DOMAIN (Powertrain Domain)',
            type: 'DOMAIN CONTROLLER',
            icon: '🏎️',
            canIdHex: '0x100, 0x105',
            canIdDec: 256,
            cycleTime: '10 ms (100 Hz)',
            dlc: '16/32 Bytes (CAN-FD)',
            payloadType: 'Domain Synchronous',
            status: 'ONLINE',
            pinout: 'CAN-FD Port A, Gigabit Ethernet TSN, Inter-Domain Bridge',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'EngineTemp', 'OilPressure'],
            description: 'Integrates combustion management, electronic transmission control, differential slip torque, and hybrid e-boost coordination.'
          },
          {
            id: 'CHASSIS_DOMAIN',
            name: 'CHASSIS_DOMAIN (Chassis & Safety)',
            type: 'DOMAIN CONTROLLER',
            icon: '🛑',
            canIdHex: '0x200, 0x210',
            canIdDec: 512,
            cycleTime: '10 ms (100 Hz)',
            dlc: '16/32 Bytes (CAN-FD)',
            payloadType: 'Safety Critical (ASIL-D)',
            status: 'ONLINE',
            pinout: 'Dual Redundant CAN-FD, Active Yaw Sensor, Steering Link',
            signals: ['BrakeActive', 'SteeringAngle', 'ABSWarning', 'TirePressureWarning'],
            description: 'Oversees brake-by-wire hydraulic modulation, torque-vectoring differentials, Pacejka slip control, and steering rack actuation.'
          },
          {
            id: 'BODY_DOMAIN',
            name: 'BODY_DOMAIN (Body & Lighting)',
            type: 'DOMAIN CONTROLLER',
            icon: '💡',
            canIdHex: '0x220, 0x230',
            canIdDec: 544,
            cycleTime: '20 ms (50 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Body Comfort & Lighting',
            status: 'ONLINE',
            pinout: 'LIN Sub-Buses (x4), Smart Power Switches, Exterior Lighting Rail',
            signals: ['HeadlightsActive', 'TurnSignal', 'Gear', 'FuelLevel'],
            description: 'Directs matrix projector headlights, climate control loop, ambient cockpit theme illumination, and door latch telemetry.'
          },
          {
            id: 'TELEMATICS_GW',
            name: 'TELEMATICS_GW (Security Gateway)',
            type: 'SECURITY & DIAGNOSTICS GATEWAY',
            icon: '🔒',
            canIdHex: '0x300, 0x7DF',
            canIdDec: 768,
            cycleTime: '100 ms (10 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Encrypted Cryptographic Stream',
            status: 'ONLINE',
            pinout: '4G/5G Telematics Modem, Hardware Security Module (HSM), OBD-II Port',
            signals: ['Odometer', 'CheckEngineLight', 'BatteryWarning', 'BatterySOC'],
            description: 'Enforces CAN ID hardware firewalling, cryptographic authentication, remote cloud telemetry replay, and OBD-II diagnostics.'
          }
        ]
      },

      zonal: {
        name: 'Zonal Software-Defined Vehicle (SDV)',
        badge: '● ZONAL SDV ARCHITECTURE (ETHERNET TSN)',
        proto: 'IEEE 802.1 TSN Ethernet + Local CAN-FD',
        baud: '1000 Mbps Backbone / 2 Mbps Subnets',
        term: 'Distributed Active Bus Terminator',
        busLoad: '19.2%',
        nodes: [
          {
            id: 'HPC_CENTRAL',
            name: 'HPC_CENTRAL (Central Compute Brain)',
            type: 'HIGH-PERFORMANCE VEHICLE COMPUTER',
            icon: '🧠',
            canIdHex: 'HPC-Central (vcan0)',
            canIdDec: 0,
            cycleTime: '5 ms (200 Hz)',
            dlc: 'Ethernet Frame',
            payloadType: 'TSN Time-Sensitive Telemetry',
            status: 'ONLINE',
            pinout: 'PCIe Gen4, Multi-Gigabit Ethernet SerDes, Dual ASIL-D Lockstep Cores',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'SteeringAngle', 'BatterySOC'],
            description: 'Central autonomous brain executing real-time digital twin physics, trajectory planning, powertrain energy orchestration, and neural inference.'
          },
          {
            id: 'ZONAL_FL',
            name: 'ZONAL_FL (Front-Left Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x110 (Subnet A)',
            canIdDec: 272,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Front-Left Sensor Hub, Steer Actuator Port',
            signals: ['SteeringAngle', 'HeadlightsActive', 'EngineTemp'],
            description: 'Localizes sensor aggregation and actuator drivers for the front-left quadrant: left projector headlight, front steering angle, and wheel sensor.'
          },
          {
            id: 'ZONAL_FR',
            name: 'ZONAL_FR (Front-Right Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x120 (Subnet B)',
            canIdDec: 288,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Front-Right Sensor Hub, Thermal Loop Controller',
            signals: ['EngineSpeed', 'ThrottlePosition', 'OilPressure'],
            description: 'Handles the front-right vehicle quadrant: right projector headlight, powertrain sensors, cooling fan governors, and front-right wheel telemetry.'
          },
          {
            id: 'ZONAL_REAR',
            name: 'ZONAL_REAR (Rear Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x130 (Subnet C)',
            canIdDec: 304,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Rear Brake Actuator, Fuel/Charge Port Driver',
            signals: ['VehicleSpeed', 'BrakeActive', 'FuelLevel', 'Odometer'],
            description: 'Aggregates rear powertrain differential sensors, LED taillight cyber bar, brake calipers, fuel gauge sender, and backup cameras.'
          }
        ]
      },

      ev: {
        name: 'Electric Vehicle High-Voltage Topology',
        badge: '● EV HIGH-VOLTAGE ARCHITECTURE (800V HV)',
        proto: 'ISO 15118 & CAN-FD (1.0 Mbps)',
        baud: '1.0 Mbps High-Speed CAN',
        term: '120 Ω High-Voltage Galvanically Isolated',
        busLoad: '31.5%',
        nodes: [
          {
            id: 'VCU_MASTER',
            name: 'VCU_MASTER (Vehicle Control Unit)',
            type: 'EV POWERTRAIN SUPERVISOR',
            icon: '⚡',
            canIdHex: '0x100 (Drive Demand)',
            canIdDec: 256,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8 Bytes',
            payloadType: 'EV Drive Demand Stream',
            status: 'ONLINE',
            pinout: 'CAN-FD Isolated Channel 1, High-Voltage Interlock Loop (HVIL)',
            signals: ['VehicleSpeed', 'ThrottlePosition', 'Gear', 'BrakeActive'],
            description: 'Master EV supervisor converting accelerator/brake pedal travel into motor torque demand, regenerative braking, and drive mode profiles.'
          },
          {
            id: 'BMS_HV',
            name: 'BMS_HV (Battery Management System)',
            type: 'HIGH-VOLTAGE ENERGY CONTROLLER',
            icon: '🔋',
            canIdHex: '0x200 (HV Pack Data)',
            canIdDec: 512,
            cycleTime: '20 ms (50 Hz)',
            dlc: '8 Bytes',
            payloadType: 'High-Voltage Battery Matrix',
            status: 'ONLINE',
            pinout: 'Isolated CAN Port, Contactor Gate Drivers, 96-Cell Sensor Bus',
            signals: ['BatterySOC', 'BatteryWarning', 'EngineTemp'],
            description: 'Oversees 800V high-voltage lithium battery pack State-of-Charge (SOC), cell voltage balancing, insulation monitoring, and contactors.'
          },
          {
            id: 'MCU_INVERTER',
            name: 'MCU_INVERTER (Traction Motor Inverter)',
            type: 'TRACTION MOTOR CONTROLLER',
            icon: '🌀',
            canIdHex: '0x105 (Stator Dynamics)',
            canIdDec: 261,
            cycleTime: '5 ms (200 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Inverter High-Frequency Stream',
            status: 'ONLINE',
            pinout: 'SiC Gate Drivers, Resolver Interface, Thermal Sensor Array',
            signals: ['EngineSpeed', 'OilPressure'],
            description: 'Drives dual silicon-carbide (SiC) inverters, commanding field-oriented control (FOC) motor RPM, rotor flux, and regenerative current.'
          },
          {
            id: 'OBC_DCDC',
            name: 'OBC_DCDC (Power Electronics Gateway)',
            type: 'POWER DISTRIBUTION & AUX',
            icon: '🔌',
            canIdHex: '0x300 (Aux & Charging)',
            canIdDec: 768,
            cycleTime: '100 ms (10 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Charging & DC-DC Status',
            status: 'ONLINE',
            pinout: 'Type-2/CCS Charging Port, 12V Low-Voltage Bus, OBD-II Link',
            signals: ['Odometer', 'CheckEngineLight', 'TurnSignal', 'HeadlightsActive'],
            description: 'Controls 11kW AC On-Board Charging, 800V-to-12V buck DC-DC conversion for low-voltage electronics, odometer, and diagnostic logs.'
          }
        ]
      }
    };

    // Initialize packet counters
    for (const l in this.topologies) {
      this.topologies[l].nodes.forEach(n => {
        this.packetCounters[n.id] = Math.floor(Math.random() * 80) + 120;
      });
    }

    this.cacheDomElements();
    this.render();
  }

  cacheDomElements() {
    this.dom = {
      badge: document.getElementById('ecu-active-topology-badge'),
      proto: document.getElementById('topo-bus-proto'),
      baud: document.getElementById('topo-baud-rate'),
      activeCount: document.getElementById('topo-active-count'),
      busLoad: document.getElementById('topo-bus-load'),
      term: document.getElementById('topo-term-res'),
      schematic: document.getElementById('ecu-bus-schematic'),
      
      // Node details
      detailType: document.getElementById('detail-node-type'),
      detailName: document.getElementById('detail-node-name'),
      detailId: document.getElementById('detail-node-id'),
      detailFrameId: document.getElementById('detail-frame-id'),
      detailCycle: document.getElementById('detail-cycle-time'),
      detailDlc: document.getElementById('detail-dlc'),
      detailPayload: document.getElementById('detail-payload-type'),
      detailSignalsList: document.getElementById('detail-signals-list'),
      btnToggleNode: document.getElementById('btn-toggle-node-state'),

      btnPingAll: document.getElementById('btn-simulate-all-nodes'),
      btnReset: document.getElementById('btn-reset-ecu-defaults')
    };

    // Bind layout switcher buttons
    const layoutBtns = document.querySelectorAll('.ecu-layout-btn');
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        layoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const layoutKey = btn.getAttribute('data-layout');
        this.setLayout(layoutKey);
      });
    });

    if (this.dom.btnToggleNode) {
      this.dom.btnToggleNode.addEventListener('click', () => this.toggleSelectedNodeState());
    }

    if (this.dom.btnPingAll) {
      this.dom.btnPingAll.addEventListener('click', () => this.pingAllNodes());
    }

    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener('click', () => this.resetDefaults());
    }
  }

  setLayout(layoutKey) {
    if (!this.topologies[layoutKey]) return;
    this.activeLayout = layoutKey;
    const currentNodes = this.topologies[layoutKey].nodes;
    this.selectedNodeId = currentNodes[0].id;
    this.render();
  }

  getCurrentTopology() {
    return this.topologies[this.activeLayout];
  }

  getSelectedNode() {
    const topo = this.getCurrentTopology();
    return topo.nodes.find(n => n.id === this.selectedNodeId) || topo.nodes[0];
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.renderSchematicSelection();
    this.renderNodeDetail();
  }

  toggleSelectedNodeState() {
    const node = this.getSelectedNode();
    if (!node) return;
    node.status = (node.status === 'ONLINE') ? 'OFFLINE' : 'ONLINE';
    this.render();
  }

  pingAllNodes() {
    const topo = this.getCurrentTopology();
    topo.nodes.forEach(n => {
      n.status = 'ONLINE';
      this.packetCounters[n.id] += 10;
    });

    // Animate schematic with pulse
    if (this.dom.schematic) {
      this.dom.schematic.classList.add('pulse-active');
      setTimeout(() => this.dom.schematic.classList.remove('pulse-active'), 800);
    }

    this.render();
  }

  resetDefaults() {
    for (const l in this.topologies) {
      this.topologies[l].nodes.forEach(n => {
        n.status = 'ONLINE';
      });
    }
    this.render();
  }

  updateTelemetry(data) {
    this.latestTelemetry = data;
    const topo = this.getCurrentTopology();

    // Increment packet counts for active nodes
    topo.nodes.forEach(node => {
      if (node.status === 'ONLINE') {
        this.packetCounters[node.id] = (this.packetCounters[node.id] || 0) + 1;
      }
    });

    this.renderNodeTelemetry();
  }

  render() {
    const topo = this.getCurrentTopology();

    if (this.dom.badge) this.dom.badge.textContent = topo.badge;
    if (this.dom.proto) this.dom.proto.textContent = topo.proto;
    if (this.dom.baud) this.dom.baud.textContent = topo.baud;
    if (this.dom.term) this.dom.term.textContent = topo.term;
    if (this.dom.busLoad) this.dom.busLoad.textContent = topo.busLoad;

    const onlineCount = topo.nodes.filter(n => n.status === 'ONLINE').length;
    if (this.dom.activeCount) {
      this.dom.activeCount.textContent = `${onlineCount} / ${topo.nodes.length} ONLINE`;
      this.dom.activeCount.className = `value ${onlineCount === topo.nodes.length ? 'green' : 'amber'}`;
    }

    this.renderSchematic();
    this.renderNodeDetail();
  }

  renderSchematic() {
    if (!this.dom.schematic) return;
    const topo = this.getCurrentTopology();

    let html = `
      <!-- CAN Bus Physical Backbone Wire Line -->
      <div class="can-bus-spine">
        <div class="bus-terminator left"><span class="term-tag">120 Ω</span></div>
        <div class="bus-wires">
          <div class="wire wire-can-h"><span class="wire-label">CAN_H (3.5V DOMINANT)</span></div>
          <div class="wire wire-can-l"><span class="wire-label">CAN_L (1.5V DOMINANT)</span></div>
        </div>
        <div class="bus-terminator right"><span class="term-tag">120 Ω</span></div>
      </div>

      <!-- Node Drop Boxes Grid -->
      <div class="ecu-nodes-row">
    `;

    topo.nodes.forEach(node => {
      const isSelected = (node.id === this.selectedNodeId);
      const isOnline = (node.status === 'ONLINE');
      const pktCount = this.packetCounters[node.id] || 0;

      html += `
        <div class="ecu-node-card ${isSelected ? 'selected' : ''} ${isOnline ? 'online' : 'offline'}" data-node-id="${node.id}">
          <div class="node-drop-line ${isOnline ? 'active' : ''}"></div>
          
          <div class="node-card-top">
            <span class="node-icon">${node.icon}</span>
            <div class="node-title-group">
              <span class="node-name">${node.id}</span>
              <span class="node-id-hex">${node.canIdHex}</span>
            </div>
            <span class="node-status-pill ${isOnline ? 'online' : 'offline'}">${node.status}</span>
          </div>

          <div class="node-card-body">
            <div class="node-meta-item">
              <span class="lbl">TYPE:</span>
              <span class="val">${node.type}</span>
            </div>
            <div class="node-meta-item">
              <span class="lbl">CYCLE:</span>
              <span class="val cyan">${node.cycleTime}</span>
            </div>
            <div class="node-meta-item">
              <span class="lbl">PACKETS:</span>
              <span class="val mono green" id="pkt-${node.id}">${pktCount} frames</span>
            </div>
          </div>

          <div class="node-card-footer" id="live-card-signals-${node.id}">
            <!-- Live mini signal chips -->
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.dom.schematic.innerHTML = html;

    // Attach click listeners to cards
    const cards = this.dom.schematic.querySelectorAll('.ecu-node-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const nodeId = card.getAttribute('data-node-id');
        this.selectNode(nodeId);
      });
    });

    this.renderNodeTelemetry();
  }

  renderSchematicSelection() {
    if (!this.dom.schematic) return;
    const cards = this.dom.schematic.querySelectorAll('.ecu-node-card');
    cards.forEach(card => {
      const id = card.getAttribute('data-node-id');
      if (id === this.selectedNodeId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  renderNodeDetail() {
    const node = this.getSelectedNode();
    if (!node) return;

    if (this.dom.detailType) this.dom.detailType.textContent = node.type;
    if (this.dom.detailName) this.dom.detailName.textContent = node.name;
    if (this.dom.detailId) this.dom.detailId.textContent = node.canIdHex;
    if (this.dom.detailFrameId) this.dom.detailFrameId.textContent = `${node.canIdHex} (${node.canIdDec})`;
    if (this.dom.detailCycle) this.dom.detailCycle.textContent = node.cycleTime;
    if (this.dom.detailDlc) this.dom.detailDlc.textContent = node.dlc;
    if (this.dom.detailPayload) this.dom.detailPayload.textContent = node.payloadType;

    if (this.dom.btnToggleNode) {
      if (node.status === 'ONLINE') {
        this.dom.btnToggleNode.textContent = '⚠️ Drop Node (Offline)';
        this.dom.btnToggleNode.className = 'btn btn-sm btn-danger';
      } else {
        this.dom.btnToggleNode.textContent = '✅ Restore Node (Online)';
        this.dom.btnToggleNode.className = 'btn btn-sm btn-success';
      }
    }

    // Populate signals table
    if (this.dom.detailSignalsList) {
      let tableHtml = `
        <table class="signals-table">
          <thead>
            <tr>
              <th width="35%">SIGNAL IDENTIFIER</th>
              <th width="30%">CURRENT VALUE</th>
              <th width="35%">STATUS &amp; RANGE</th>
            </tr>
          </thead>
          <tbody>
      `;

      node.signals.forEach(sigName => {
        const val = this.latestTelemetry[sigName];
        const displayVal = (val !== undefined && val !== null) ? val : '--';
        tableHtml += `
          <tr>
            <td class="sig-name"><code>${sigName}</code></td>
            <td class="sig-val cyan" id="detail-sig-${sigName}">${displayVal}</td>
            <td class="sig-status"><span class="sig-badge green">ACTIVE (IN-RANGE)</span></td>
          </tr>
        `;
      });

      tableHtml += `</tbody></table>`;
      this.dom.detailSignalsList.innerHTML = tableHtml;
    }

    this.renderNodeTelemetry();
  }

  renderNodeTelemetry() {
    const topo = this.getCurrentTopology();

    // 1. Update mini signals on each node card in schematic
    topo.nodes.forEach(node => {
      const pktElem = document.getElementById(`pkt-${node.id}`);
      if (pktElem) {
        pktElem.textContent = `${this.packetCounters[node.id] || 0} frames`;
      }

      const cardSignalsElem = document.getElementById(`live-card-signals-${node.id}`);
      if (cardSignalsElem) {
        let chips = '';
        node.signals.slice(0, 3).forEach(sig => {
          let val = this.latestTelemetry[sig];
          if (typeof val === 'number') val = val.toFixed(1);
          if (val === undefined || val === null) val = '--';
          chips += `<span class="signal-chip"><strong>${sig.slice(0, 8)}:</strong> ${val}</span>`;
        });
        cardSignalsElem.innerHTML = chips;
      }
    });

    // 2. Update selected node detail signals table
    const selected = this.getSelectedNode();
    if (selected) {
      selected.signals.forEach(sig => {
        const elem = document.getElementById(`detail-sig-${sig}`);
        if (elem) {
          let val = this.latestTelemetry[sig];
          let formatted = val;
          if (sig === 'EngineSpeed') formatted = `${Math.round(val || 0)} RPM`;
          else if (sig === 'VehicleSpeed') formatted = `${(val || 0).toFixed(1)} km/h`;
          else if (sig === 'ThrottlePosition') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'EngineTemp') formatted = `${(val || 0).toFixed(1)} °C`;
          else if (sig === 'OilPressure') formatted = `${(val || 0).toFixed(2)} bar`;
          else if (sig === 'SteeringAngle') formatted = `${(val || 0).toFixed(1)}°`;
          else if (sig === 'FuelLevel') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'BatterySOC') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'Odometer') formatted = `${(val || 0).toFixed(1)} km`;
          else if (sig === 'Gear') formatted = `Gear ${val || 'D'}`;
          else if (typeof val === 'boolean') formatted = val ? 'ACTIVE (TRUE)' : 'INACTIVE (FALSE)';
          elem.textContent = (val !== undefined && val !== null) ? formatted : '--';
        }
      });
    }
  }
}
