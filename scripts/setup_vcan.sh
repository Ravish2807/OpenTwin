#!/usr/bin/env bash
# ==============================================================================
# OpenTwin: Virtual CAN (vcan0) Network Interface Initialization Script
# Loads the SocketCAN virtual CAN kernel module and brings up the vcan0 device.
# ==============================================================================

set -e

IFACE="vcan0"

echo "[OpenTwin] Initializing Virtual CAN Network Interface: ${IFACE}..."

# Check root privileges
if [ "$EUID" -ne 0 ]; then
  echo "[!] Please run with sudo privileges: sudo ./setup_vcan.sh"
  exit 1
fi

# Step 1: Load the virtual CAN kernel module
echo "[*] Loading 'vcan' kernel module..."
modprobe vcan

# Step 2: Check if interface already exists, if so reset it
if ip link show "${IFACE}" >/dev/null 2>&1; then
  echo "[*] Interface ${IFACE} already exists. Bringing down to reconfigure..."
  ip link set down "${IFACE}" || true
  ip link delete "${IFACE}" type vcan || true
fi

# Step 3: Add the vcan0 interface
echo "[*] Adding network device '${IFACE}' (type: vcan)..."
ip link add dev "${IFACE}" type vcan

# Step 4: Bring the interface UP
echo "[*] Bringing up ${IFACE}..."
ip link set up "${IFACE}"

# Step 5: Verification
echo "========================================================"
echo "[+] SUCCESS: ${IFACE} is live and ready for CAN traffic!"
echo "========================================================"
ip -details link show "${IFACE}"
