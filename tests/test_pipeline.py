"""
OpenTwin End-to-End Pipeline Automated Test Suite
Verifies DBC loading, CAN frame encoding/decoding accuracy, candump log integrity,
and WebSocket telemetry broadcasting.
"""

import asyncio
import os
import sys
import unittest
import json
import websockets

# Add emulator_core and data_logs to path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(BASE_DIR, "emulator_core"))
sys.path.insert(0, os.path.join(BASE_DIR, "data_logs"))

from decoder import CANDecoder
from generate_logs import pack_engine_data, pack_vehicle_status, pack_diagnostics
from server import OpenTwinServer

DBC_PATH = os.path.join(BASE_DIR, "dbc_definitions", "vehicle_base.dbc")
LOG_PATH = os.path.join(BASE_DIR, "data_logs", "sample_drive.log")

class TestOpenTwinPipeline(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(DBC_PATH), f"DBC file not found at {DBC_PATH}")
        self.decoder = CANDecoder(DBC_PATH)

    def test_01_dbc_loading(self):
        """Test DBC parsing and message definition presence."""
        msg_names = [msg.name for msg in self.decoder.db.messages]
        self.assertIn("Engine_Data", msg_names)
        self.assertIn("Vehicle_Status", msg_names)
        self.assertIn("Diagnostics_Alerts", msg_names)

        engine_msg = self.decoder.msg_lookup.get(256)
        self.assertIsNotNone(engine_msg)
        sig_names = [s.name for s in engine_msg.signals]
        self.assertIn("EngineSpeed", sig_names)
        self.assertIn("VehicleSpeed", sig_names)
        self.assertIn("ThrottlePosition", sig_names)
        self.assertIn("EngineTemp", sig_names)

    def test_02_engine_data_decoding(self):
        """Test exact packing and decoding of Engine_Data (0x100 / 256)."""
        target_rpm = 3450.0
        target_speed = 88.5
        target_throttle = 42.0
        target_temp = 92.0
        target_oil = 4.2

        raw_hex = pack_engine_data(target_rpm, target_speed, target_throttle, target_temp, target_oil)
        raw_bytes = bytes.fromhex(raw_hex)

        decoded = self.decoder.decode_frame(256, raw_bytes, timestamp=1700000000.123)
        self.assertEqual(decoded["message_name"], "Engine_Data")
        self.assertEqual(decoded["can_id_hex"], "0x100")

        signals = decoded["signals"]
        self.assertAlmostEqual(signals["EngineSpeed"], target_rpm, delta=0.5)
        self.assertAlmostEqual(signals["VehicleSpeed"], target_speed, delta=0.05)
        self.assertAlmostEqual(signals["ThrottlePosition"], target_throttle, delta=0.5)
        self.assertAlmostEqual(signals["EngineTemp"], target_temp, delta=1.0)
        self.assertAlmostEqual(signals["OilPressure"], target_oil, delta=0.1)

    def test_03_vehicle_status_decoding(self):
        """Test exact packing and decoding of Vehicle_Status (0x200 / 512)."""
        target_fuel = 74.0
        target_battery = 82.0
        target_gear = 3 # D
        target_brake = True
        target_turn = 1 # LEFT
        target_steering = -24.5
        target_lights = True

        raw_hex = pack_vehicle_status(target_fuel, target_battery, target_gear, target_brake, target_turn, target_steering, target_lights)
        raw_bytes = bytes.fromhex(raw_hex)

        decoded = self.decoder.decode_frame(512, raw_bytes, timestamp=1700000000.456)
        self.assertEqual(decoded["message_name"], "Vehicle_Status")
        self.assertEqual(decoded["can_id_hex"], "0x200")

        signals = decoded["signals"]
        self.assertAlmostEqual(signals["FuelLevel"], target_fuel, delta=0.5)
        self.assertAlmostEqual(signals["BatterySOC"], target_battery, delta=0.5)
        self.assertEqual(int(signals["Gear"]), target_gear)
        self.assertEqual(int(signals["BrakeActive"]), 1)
        self.assertEqual(int(signals["TurnSignal"]), target_turn)
        self.assertAlmostEqual(signals["SteeringAngle"], target_steering, delta=0.2)
        self.assertEqual(int(signals["HeadlightsActive"]), 1)

    def test_04_diagnostics_decoding(self):
        """Test exact packing and decoding of Diagnostics_Alerts (0x300 / 768)."""
        raw_hex = pack_diagnostics(check_engine=True, battery_warn=False, tpms_warn=True, abs_warn=False, odo_km=14250.4)
        raw_bytes = bytes.fromhex(raw_hex)

        decoded = self.decoder.decode_frame(768, raw_bytes, timestamp=1700000000.789)
        self.assertEqual(decoded["message_name"], "Diagnostics_Alerts")
        signals = decoded["signals"]
        self.assertEqual(int(signals["CheckEngineLight"]), 1)
        self.assertEqual(int(signals["BatteryWarning"]), 0)
        self.assertEqual(int(signals["TirePressureWarning"]), 1)
        self.assertEqual(int(signals["ABSWarning"]), 0)
        self.assertAlmostEqual(signals["Odometer"], 14250.4, delta=0.2)

    def test_05_log_file_integrity(self):
        """Test that all lines in sample_drive.log parse and decode without errors."""
        self.assertTrue(os.path.exists(LOG_PATH), f"Log file not found at {LOG_PATH}")
        valid_frames = 0
        with open(LOG_PATH, "r") as f:
            for line_no, line in enumerate(f, 1):
                line = line.strip()
                if not line or not line.startswith("("):
                    continue
                ts_part, rest = line.split(")", 1)
                timestamp = float(ts_part.replace("(", "").strip())
                tokens = rest.strip().split()
                self.assertGreaterEqual(len(tokens), 2, f"Line {line_no} malformed: {line}")
                can_id_str, hex_payload = tokens[1].split("#")
                arbitration_id = int(can_id_str, 16)
                raw_bytes = bytes.fromhex(hex_payload)

                decoded = self.decoder.decode_frame(arbitration_id, raw_bytes, timestamp)
                self.assertIn("message_name", decoded)
                self.assertIn(decoded["message_name"], ["Engine_Data", "Vehicle_Status", "Diagnostics_Alerts"])
                valid_frames += 1

        self.assertGreater(valid_frames, 1000, f"Expected > 1000 valid frames, got {valid_frames}")

    def test_06_websocket_telemetry_streaming(self):
        """Test full async WebSocket server broadcast loop and client reception."""
        async def run_ws_test():
            server = OpenTwinServer(
                dbc_path=DBC_PATH,
                replay_file=LOG_PATH,
                replay_loop=True,
                replay_speed=10.0, # Fast replay for test
                http_port=8089
            )
            server_task = asyncio.create_task(server.run())

            # Wait for server to bind
            await asyncio.sleep(0.5)

            # Connect WebSocket client
            uri = "ws://localhost:8089/ws"
            async with websockets.connect(uri) as ws:
                # Receive first telemetry frame
                msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                data = json.loads(msg)
                self.assertEqual(data["type"], "telemetry")
                self.assertIn("data", data)
                self.assertIn("EngineSpeed", data["data"])
                self.assertIn("VehicleSpeed", data["data"])

            server_task.cancel()
            try:
                await server_task
            except asyncio.CancelledError:
                pass

        asyncio.run(run_ws_test())

if __name__ == "__main__":
    unittest.main()
