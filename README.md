# OpenTwin

> **Software-Based Automotive CAN Network Emulator & Telemetry Replay Engine**

OpenTwin is a 100% software-based automotive network emulator designed for testing digital instrument clusters, diagnostic logic, and cybersecurity applications without requiring physical vehicle hardware or CAN transceivers.

---

## 1. What is OpenTwin ?

OpenTwin acts as a **"Ghost Vehicle"** by taking pre-recorded or synthetic CAN bus traffic logs and injecting them into a virtual Linux network interface (`vcan0`). Downstream applications receive the raw high-frequency hexadecimal frames, decode them using standard CAN Database (`.dbc`) definitions, and visualize live vehicle metrics in real time.

---

## 2. Features of OpenTwin

- **Virtual CAN Transport**: Emulates an automotive CAN bus in RAM via Linux SocketCAN (`vcan0`) or cross-platform loopback.
- **Log Injection Engine**: Replays `.log` and `.asc` vehicle drive cycles at their original recorded timestamps.
- **Real-Time DBC Decoding**: Translates raw hexadecimal payloads into physical engineering metrics (RPM, Speed, Temperature, Gear, Warnings) using `cantools`.
- **Interactive Digital Cluster**: Visualizes telemetry in a responsive, glassmorphic web dashboard with radial gauges, indicator lights, and a raw CAN bus frame inspector.

---

## 3. Overall System Workflow

```
┌────────────────────────┐
│  data_logs/            │
│  sample_drive.log      │
└───────────┬────────────┘
            │ 1. Inject Frames
            ▼
┌────────────────────────┐
│  Layer 1 & 2:          │  ◄── scripts/setup_vcan.sh
│  Virtual SocketCAN     │  ◄── scripts/replay_log.sh (canplayer)
│  Interface (vcan0)     │
└───────────┬────────────┘
            │ 2. Raw Hex (0x100#...)
            ▼
┌────────────────────────┐
│  Layer 3:              │  ◄── dbc_definitions/vehicle_base.dbc
│  Python Decoder Engine │  (Translates bits to physical values)
└───────────┬────────────┘
            │ 3. JSON Telemetry @ 30Hz
            ▼
┌────────────────────────┐
│  Frontend Dashboard    │
│  Digital Cluster UI    │  ◄── http://localhost:8080/
└────────────────────────┘
```

---

## 4. How to Deploy & Run

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

## 5. Repository & Module Documentation

For in-depth technical documentation, refer to the module-specific guides:

- 📂 [**`emulator_core/`**](emulator_core/README.md) — Decoder logic, WebSocket API specification, and backend parameters.
- 📂 [**`frontend_dashboard/`**](frontend_dashboard/README.md) — Cluster UI architecture, gauges, and telemetry subscriptions.
- 📂 [**`scripts/`**](scripts/README.md) — Network setup (`vcan0`), `canplayer` replay, and deployment scripts.
- 📂 [**`tests/`**](tests/README.md) — Automated testing pipeline and verification procedures.
- 📂 [**`dbc_definitions/`**](dbc_definitions/vehicle_base.dbc) — CAN database matrix definition file.
- 📂 [**`data_logs/`**](data_logs/) — Vehicle log files and procedural candump log generator.

---

## 6. Verification
Run the automated test suite to verify end-to-end pipeline integrity:
```bash
python tests/test_pipeline.py
```
