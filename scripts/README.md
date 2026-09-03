# OpenTwin: Scripts & Deployment Guide

This directory contains automation and deployment scripts for initializing the virtual CAN network, injecting telemetry traffic, and launching services.

---

## Available Scripts

| Script | Platform | Description |
| :--- | :--- | :--- |
| `setup_vcan.sh` | Linux / WSL2 | Loads kernel module (`vcan`), creates network device `vcan0`, and brings the interface UP. |
| `replay_log.sh` | Linux / WSL2 | Wraps `canplayer` (from `can-utils`) to broadcast candump log files onto `vcan0`. |
| `start_backend.sh` | Linux / WSL2 | Launches the Python decoder and WebSocket telemetry server on `vcan0`. |
| `run_demo.sh` | Linux / macOS | Standalone one-command launcher with built-in log replayer and web server. |
| `run_demo.bat` | Windows | Standalone batch launcher for Windows environments. |

---

## Deployment Steps (Linux / WSL2)

### 1. Initialize Network Interface
```bash
sudo chmod +x scripts/*.sh
sudo ./scripts/setup_vcan.sh
```

### 2. Launch Backend Telemetry Server
```bash
./scripts/start_backend.sh
```

### 3. Replay CAN Traffic
```bash
# In a separate terminal:
./scripts/replay_log.sh data_logs/sample_drive.log vcan0 vcan0
```

---

## Standalone Quick Start (Any OS)

To run without setting up kernel modules:
```bash
# Windows
scripts\run_demo.bat

# Linux / macOS
./scripts/run_demo.sh
```
