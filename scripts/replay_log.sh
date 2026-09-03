#!/usr/bin/env bash
# ==============================================================================
# OpenTwin: CAN Log Replay Script
# Uses canplayer (from can-utils) to inject candump logs into vcan0.
# ==============================================================================

set -e

LOG_FILE="${1:-data_logs/sample_drive.log}"
TARGET_IFACE="${2:-vcan0}"
SOURCE_IFACE="${3:-vcan0}"
LOOP="${4:--l i}" # Infinite loop by default

if [ ! -f "$LOG_FILE" ]; then
  echo "[!] Error: Log file '$LOG_FILE' does not exist."
  exit 1
fi

if ! command -v canplayer &> /dev/null; then
  echo "[!] Error: 'canplayer' not found. Please install can-utils:"
  echo "    sudo apt-get install can-utils"
  exit 1
fi

echo "========================================================"
echo "[OpenTwin] Replaying CAN Log via canplayer"
echo "  File:      $LOG_FILE"
echo "  Target:    $TARGET_IFACE"
echo "  Source:    $SOURCE_IFACE"
echo "  Mode:      Looping ($LOOP)"
echo "========================================================"
echo "[*] Injecting traffic into $TARGET_IFACE (Press Ctrl+C to stop)..."

canplayer $LOOP -I "$LOG_FILE" "${TARGET_IFACE}=${SOURCE_IFACE}"
