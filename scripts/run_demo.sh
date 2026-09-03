#!/usr/bin/env bash
# ==============================================================================
# OpenTwin: Standalone Demo Launcher
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=============================================================================="
echo " OpenTwin: Software-Based CAN Emulator & Replay Engine"
echo "=============================================================================="
echo "[*] Starting Python Decoder Server with built-in CAN log replay..."
echo "[*] Open your browser at: http://localhost:8080/"

python3 emulator_core/server.py --dbc dbc_definitions/vehicle_base.dbc --replay-log data_logs/sample_drive.log --port 8080
