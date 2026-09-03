#!/usr/bin/env bash
# ==============================================================================
# OpenTwin: Start Python Decoder & Telemetry Backend
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "[OpenTwin] Starting Telemetry Backend on vcan0..."
python3 emulator_core/server.py --dbc dbc_definitions/vehicle_base.dbc --channel vcan0 --bustype socketcan --port 8080
