# OpenTwin

> **Software-Based Automotive CAN Network Emulator & Telemetry Replay Engine**

[![Tests](https://img.shields.io/badge/Tests-6%20Passed-10b981?style=flat-square&logo=python)](tests/test_pipeline.py)
[![SocketCAN](https://img.shields.io/badge/CAN-SocketCAN%20%2F%20vcan0-0284c7?style=flat-square)](scripts/setup_vcan.sh)
[![Workbench](https://img.shields.io/badge/Workbench-v2.4%20PRO-8b5cf6?style=flat-square)](frontend_dashboard/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](LICENSE)

OpenTwin is a 100% software-based automotive network emulator designed for developing and testing digital instrument clusters, diagnostic routines, and ECU cybersecurity logic without physical vehicle hardware or CAN transceivers.

---

## 1. Project Architecture & Codebase Data Flow

The following interactive architecture diagram illustrates the end-to-end data pipeline from log generation and virtual bus transport to backend signal decoding and the **Active Frontend Workbench Suite**.

```mermaid
flowchart LR
    %% =========================================================================
    %% ARCHIFY CODEBASE ARCHITECTURE & DATA FLOW
    %% =========================================================================

    %% Node Styling Definitions
    classDef fileNode fill:#0b1120,stroke:#38bdf8,stroke-width:1.8px,color:#e2e8f0;
    classDef dbcNode fill:#1e1b4b,stroke:#818cf8,stroke-width:1.8px,color:#e0e7ff;
    classDef transportNode fill:#022c22,stroke:#10b981,stroke-width:2px,color:#a7f3d0;
    classDef backendNode fill:#1c1917,stroke:#f59e0b,stroke-width:2px,color:#fef3c7;
    classDef activeWorkspace fill:#042f2e,stroke:#14b8a6,stroke-width:2.5px,color:#ccfbf1;
    classDef testNode fill:#2e1065,stroke:#c084fc,stroke-width:1.8px,color:#f5f3ff;

    %% -------------------------------------------------------------------------
    %% SUBGRAPH 1: DATA SOURCES & NETWORK SCRIPTS
    %% -------------------------------------------------------------------------
    subgraph SOURCES [" 📁 Data Sources & Network Layer "]
        direction TB
        LOG_GEN["🐍 <code>data_logs/generate_logs.py</code><br/>Procedural Drive Cycle Engine"]:::fileNode
        LOG_FILE[("📄 <code>data_logs/sample_drive.log</code><br/>5,100+ Raw candump Frames")]:::fileNode
        VCAN_SCRIPT["📜 <code>scripts/setup_vcan.sh</code><br/>SocketCAN Kernel Setup (vcan0)"]:::fileNode
        REPLAY_SCRIPT["📜 <code>scripts/replay_log.sh</code><br/>canplayer Traffic Injector"]:::fileNode
        
        LOG_GEN -- "Generates timestamped frames" --> LOG_FILE
        VCAN_SCRIPT -- "Initializes interface" --> VCAN_BUS
        LOG_FILE -- "Ingested via canplayer" --> REPLAY_SCRIPT
    end

    %% -------------------------------------------------------------------------
    %% SUBGRAPH 2: TRANSPORT & VIRTUAL CAN BUS
    %% -------------------------------------------------------------------------
    subgraph TRANSPORT [" 🔌 Transport Layer (RAM Loopback) "]
        VCAN_BUS["🌐 <b>Linux SocketCAN (vcan0)</b><br/>Virtual CAN Bus Device in Kernel"]:::transportNode
        REPLAY_SCRIPT == "canplayer -I sample_drive.log vcan0=can0" ==> VCAN_BUS
    end

    %% -------------------------------------------------------------------------
    %% SUBGRAPH 3: BACKEND DECODER & WEBSOCKET ENGINE
    %% -------------------------------------------------------------------------
    subgraph BACKEND [" ⚙️ Layer 3: Backend Decoder & Streamer "]
        direction TB
        DBC_DEF[("📖 <code>dbc_definitions/vehicle_base.dbc</code><br/>CAN Matrix (0x100, 0x200, 0x300)")]:::dbcNode
        PY_DECODER["🧠 <code>emulator_core/decoder.py</code><br/>CANDecoder (cantools unpack)"]:::backendNode
        PY_SERVER["⚡ <code>emulator_core/server.py</code><br/>Async WebSocket & HTTP Server"]:::backendNode

        VCAN_BUS == "Raw Hex CAN Frames (50Hz)" ==> PY_DECODER
        DBC_DEF -. "Loads bit layout, scale & offsets" .-> PY_DECODER
        PY_DECODER -- "Physical metrics: RPM, Speed, Temp" --> PY_SERVER
    end

    %% -------------------------------------------------------------------------
    %% SUBGRAPH 4: ACTIVE WORKSPACE (FRONTEND WORKBENCH)
    %% -------------------------------------------------------------------------
    subgraph FRONTEND [" 🚀 CURRENTLY WORKED AREA: Telemetry Workbench v2.4 PRO "]
        direction TB
        UI_HUB["🌐 <code>frontend_dashboard/index.html</code><br/>Multi-View Glassmorphic Workbench"]:::activeWorkspace
        UI_LOGIC["⚡ <code>frontend_dashboard/app.js</code><br/>WebSocket Client & 60fps Dispatcher"]:::activeWorkspace
        UI_STYLE["🎨 <code>frontend_dashboard/style.css</code><br/>Theme Engine (Comfort, Sport, Eco, Cyber)"]:::activeWorkspace

        W1["🚀 Cockpit Cluster HUD<br/>• Radial Swept Tachometer & Velocity<br/>• Rotating Wheel Chassis HUD<br/>• 4-Wheel TPMS & Alert Rack"]:::activeWorkspace
        W2["📈 60 FPS Signal Oscilloscope<br/>• Multi-Trace Rolling Waveform Plots<br/>• Freeze, Time-Window & Peak Analytics"]:::activeWorkspace
        W3["🔍 CAN Bus Frame Inspector<br/>• Wireshark-Style Byte Highlight<br/>• Live ID Filters & 💾 CSV Export"]:::activeWorkspace
        W4["🕹️ ECU Injector & Fault Panel<br/>• Powertrain Overrides & Presets<br/>• MIL, TPMS, Battery, ABS Faults<br/>• Arbitrary Hex Frame Transmitter"]:::activeWorkspace
        W5["📚 DBC Catalog Browser<br/>• Dynamic Message/Signal Matrix Search"]:::activeWorkspace

        UI_HUB --- UI_LOGIC
        UI_HUB --- UI_STYLE
        UI_LOGIC --> W1
        UI_LOGIC --> W2
        UI_LOGIC --> W3
        UI_LOGIC --> W4
        UI_LOGIC --> W5
    end

    %% Bidirectional Telemetry Stream & Injection Feedback Loop
    PY_SERVER <== "ws://localhost:8080/ws<br/>[JSON Telemetry Broadcast @ 30Hz]" ==> UI_LOGIC
    W4 -. "Bidirectional Injection: 0x100#... / 0x300#...<br/>[inject_frame action]" .-> PY_SERVER
    PY_SERVER -. "Forwards Injected Frames" .-> VCAN_BUS

    %% -------------------------------------------------------------------------
    %% SUBGRAPH 5: AUTOMATED TEST PIPELINE
    %% -------------------------------------------------------------------------
    subgraph TESTS [" 🧪 Continuous Verification "]
        TEST_SUITE["🧪 <code>tests/test_pipeline.py</code><br/>6 Unit & Integration Tests (100% Pass)"]:::testNode
        TEST_SUITE -. "Validates DBC, frames, and WS streaming" .-> BACKEND
    end
```

> ⚡ **Active Workspace Notice**: Current development is focused on the **Frontend Workbench Suite (`frontend_dashboard/`)** featuring real-time 60 FPS hardware-accelerated waveform graphing, interactive vehicle steering kinematics, bidirectional CAN injection, and CSV export.

---

## 2. Core Capabilities

- **Virtual CAN Transport**: Emulates an automotive CAN bus in RAM via Linux SocketCAN (`vcan0`) or cross-platform loopback.
- **Log Injection Engine**: Broadcasts recorded `.log` drive cycles with variable playback speed (0.5x, 1x, 2x, 5x) and looping.
- **Real-Time DBC Decoding**: Translates raw hexadecimal payloads into physical engineering metrics (RPM, Speed, Temperature, Gear, Warnings) using `cantools`.
- **60 FPS Signal Oscilloscope**: Live rolling waveform recorder graphing multi-channel telemetry with peak/average analytics.
- **Bidirectional ECU Injector**: Direct browser-to-bus packet transmission and DTC fault simulation (Check Engine, TPMS, Battery, ABS).
- **Wireshark-Style Inspector**: Live byte-by-byte visual coloring, filtering, bus load estimation, and CSV export.

---

## 3. How to Deploy & Run

### Prerequisites
- Python 3.9+
- Linux / WSL2 with SocketCAN support (or Windows for standalone mode)

```bash
# Clone repository & install dependencies
pip install -r emulator_core/requirements.txt
```

### Option A: Standard Linux / WSL2 Deployment
```bash
# 1. Initialize Virtual CAN interface
sudo ./scripts/setup_vcan.sh

# 2. Start the Decoder & Telemetry Backend
./scripts/start_backend.sh

# 3. In a separate terminal, replay vehicle traffic
./scripts/replay_log.sh data_logs/sample_drive.log

# 4. Open dashboard in your browser
# http://localhost:8080/
```

### Option B: Standalone Quick Start (Any OS)
Run the full system in standalone mode with built-in replayer:
```bash
# Windows
scripts\run_demo.bat

# Linux / macOS
./scripts/run_demo.sh
```

---

## 4. Repository & Module Documentation

For in-depth technical documentation, refer to the module-specific guides:

- 📂 [**`frontend_dashboard/`**](frontend_dashboard/README.md) — Multi-view cluster UI, oscilloscope, ECU injector, and themes.
- 📂 [**`emulator_core/`**](emulator_core/README.md) — Decoder logic, WebSocket API specification, and backend parameters.
- 📂 [**`scripts/`**](scripts/README.md) — Network setup (`vcan0`), `canplayer` replay, and deployment scripts.
- 📂 [**`tests/`**](tests/README.md) — Automated testing pipeline and verification procedures.
- 📂 [**`dbc_definitions/`**](dbc_definitions/vehicle_base.dbc) — CAN database matrix definition file.
- 📂 [**`data_logs/`**](data_logs/) — Vehicle log files and procedural candump log generator.

---

## 5. Verification
Run the automated test suite to verify end-to-end pipeline integrity:
```bash
python tests/test_pipeline.py
```
