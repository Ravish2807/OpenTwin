# OpenTwin

> **Software-Based Automotive CAN Network Emulator & Telemetry Replay Engine**

[![Tests](https://img.shields.io/badge/Tests-6%20Passed-10b981?style=flat-square&logo=python)](tests/test_pipeline.py)
[![SocketCAN](https://img.shields.io/badge/CAN-SocketCAN%20%2F%20vcan0-0284c7?style=flat-square)](scripts/setup_vcan.sh)
[![Workbench](https://img.shields.io/badge/Workbench-v2.4%20PRO-8b5cf6?style=flat-square)](frontend_dashboard/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](LICENSE)

OpenTwin is a 100% software-based automotive network emulator designed for developing and testing digital instrument clusters, diagnostic routines, and ECU cybersecurity logic without requiring physical vehicle hardware or CAN transceivers.

---

## 1. Project Overview & Node Architecture

OpenTwin operates as a **"Ghost Vehicle"** in RAM. The system is architected as a node-based reactive telemetry pipeline (inspired by node workflows like [xyflow/react-flow](https://github.com/xyflow/xyflow)), connecting input logs, virtual bus transport, DBC decoding, bidirectional WebSocket telemetry, and an interactive multi-view cluster workbench.

### Node-Based System Flowchart & Currently Worked Area

```mermaid
flowchart TD
    %% Node Styling Definitions
    classDef inputNode fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#e0e7ff;
    classDef busNode fill:#0c2a4a,stroke:#38bdf8,stroke-width:2px,color:#e0f2fe;
    classDef coreNode fill:#2e1065,stroke:#c084fc,stroke-width:2px,color:#f5f3ff;
    classDef activeWork fill:#042f2e,stroke:#14b8a6,stroke-width:3px,color:#ccfbf1;
    classDef focusNode fill:#134e4a,stroke:#2dd4bf,stroke-width:2px,color:#f0fdfa,font-weight:bold;

    subgraph INGESTION [" Layer 1: Data Ingestion & Replay "]
        A1["📁 candump Drive Logs<br/><code>data_logs/sample_drive.log</code>"]:::inputNode
        A2["⚙️ Procedural Generator<br/><code>generate_logs.py</code>"]:::inputNode
        A3["🕹️ canplayer / Internal Replayer<br/>(Loop & Speed Controls)"]:::inputNode
        A1 --> A3
        A2 --> A1
    end

    subgraph TRANSPORT [" Layer 2: Transport & Virtual Network "]
        B1["🔌 Linux SocketCAN (vcan0)<br/><code>scripts/setup_vcan.sh</code>"]:::busNode
        B2["🔄 Cross-Platform Virtual Loopback<br/>(Windows & Linux Standalone)"]:::busNode
        A3 --> B1
        A3 --> B2
    end

    subgraph CORE [" Layer 3: Decoder & Telemetry Backend "]
        C1["📖 CAN Database Matrix<br/><code>vehicle_base.dbc</code>"]:::coreNode
        C2["🧠 python-can + cantools Decoder<br/><code>emulator_core/decoder.py</code>"]:::coreNode
        C3["⚡ Async WebSocket Server @ 30Hz<br/><code>emulator_core/server.py</code>"]:::coreNode
        B1 --> C2
        B2 --> C2
        C1 --> C2
        C2 --> C3
    end

    subgraph WORKBENCH [" 🚀 CURRENTLY WORKED AREA: Telemetry Workbench v2.4 PRO "]
        direction TB
        D0["🌐 Web Interface Hub<br/><code>frontend_dashboard/index.html</code>"]:::focusNode
        
        D1["🚀 Cockpit Cluster HUD<br/>• Swept Tachometer & Velocity<br/>• Rotating Wheel Chassis HUD<br/>• 4-Wheel TPMS & Telltales"]:::activeWork
        
        D2["📈 60 FPS Oscilloscope<br/>• Rolling Multi-Signal Waveforms<br/>• Freeze, Time-Window & Zoom<br/>• Peak & Average Stats"]:::activeWork
        
        D3["🔍 CAN Bus Inspector<br/>• Wireshark-Style Byte Highlight<br/>• Real-Time ID & Text Filters<br/>• 💾 CSV Log Export"]:::activeWork
        
        D4["🕹️ ECU Injector & Faults<br/>• Manual Signal Override Sliders<br/>• DTC Fault Triggers (MIL, TPMS)<br/>• Arbitrary Frame Injector"]:::activeWork
        
        D5["🎨 Ambient Drive Themes<br/>COMFORT | SPORT | ECO | CYBER"]:::activeWork

        D0 --> D1
        D0 --> D2
        D0 --> D3
        D0 --> D4
        D0 --> D5
    end

    %% Bidirectional Connection
    C3 <== "ws://localhost:8080/ws (Telemetry Stream & Injection Packets)" ==> D0

    %% Active Workspace Callout Node
    class WORKBENCH activeWork;
```

> **Current Sprint Focus**: Development is focused on the **Frontend Workbench (`frontend_dashboard/`)** with live 60 FPS canvas waveform plotting, interactive chassis steering kinematics, bidirectional frame injection from the browser, and CSV export.

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
