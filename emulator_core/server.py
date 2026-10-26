"""
OpenTwin Telemetry & WebSocket Server
Integrates CAN Bus subscriber loop, DBC decoding engine, HTTP static asset hosting,
and real-time WebSocket telemetry broadcasting.
"""

import asyncio
import argparse
import json
import logging
import os
import sys
import time
from aiohttp import web
import can

from decoder import CANDecoder, create_can_bus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("OpenTwin.Server")

# Gear & TurnSignal maps according to DBC definition
GEAR_MAP = {0: "P", 1: "R", 2: "N", 3: "D", 4: "1", 5: "2", 6: "3", 7: "S"}
TURN_MAP = {0: "NONE", 1: "LEFT", 2: "RIGHT", 3: "HAZARD"}

class OpenTwinServer:
    def __init__(self, dbc_path: str, channel: str = "vcan0", bustype: str = "socketcan", 
                 replay_file: str = None, replay_loop: bool = True, replay_speed: float = 1.0,
                 http_port: int = 8080, ws_port: int = 8765):
        self.dbc_path = os.path.abspath(dbc_path)
        self.channel = channel
        self.bustype = bustype
        self.replay_file = os.path.abspath(replay_file) if replay_file else None
        self.replay_loop = replay_loop
        self.replay_speed = replay_speed
        self.replay_paused = False
        self.replay_restart_requested = False
        self.http_port = http_port
        self.ws_port = ws_port

        self.decoder = CANDecoder(self.dbc_path)
        self.ws_clients = set()
        self.bus = None

        # Aggregate vehicle telemetry state
        self.telemetry_state = {
            "EngineSpeed": 0.0,
            "VehicleSpeed": 0.0,
            "ThrottlePosition": 0.0,
            "EngineTemp": 85.0,
            "OilPressure": 3.5,
            "FuelLevel": 100.0,
            "BatterySOC": 100.0,
            "Gear": "P",
            "BrakeActive": False,
            "TurnSignal": "NONE",
            "SteeringAngle": 0.0,
            "HeadlightsActive": False,
            "CheckEngineLight": False,
            "BatteryWarning": False,
            "TirePressureWarning": False,
            "ABSWarning": False,
            "Odometer": 0.0,
            "LastFrameTimestamp": 0.0,
            "FPS": 0,
            "TotalFrames": 0,
            "ReplayPaused": False,
            "ReplaySpeed": self.replay_speed
        }
        self.frame_count = 0
        self.last_fps_calc = time.time()
        self.recent_frames = []

    def get_dbc_summary(self):
        """Returns structured JSON summary of DBC messages & signals."""
        messages_info = []
        for msg in self.decoder.db.messages:
            signals_info = []
            for sig in msg.signals:
                signals_info.append({
                    "name": sig.name,
                    "start": sig.start,
                    "length": sig.length,
                    "byte_order": sig.byte_order,
                    "scale": sig.scale,
                    "offset": sig.offset,
                    "minimum": sig.minimum,
                    "maximum": sig.maximum,
                    "unit": sig.unit or "",
                    "choices": {str(k): str(v) for k, v in sig.choices.items()} if sig.choices else None
                })
            messages_info.append({
                "name": msg.name,
                "frame_id": msg.frame_id,
                "frame_id_hex": f"0x{msg.frame_id:03X}",
                "length": msg.length,
                "senders": msg.senders,
                "signals": signals_info
            })
        return messages_info

    def update_telemetry(self, decoded_frame: dict):
        self.frame_count += 1
        signals = decoded_frame.get("signals", {})
        
        # Engine Data
        if "EngineSpeed" in signals:
            self.telemetry_state["EngineSpeed"] = round(float(signals["EngineSpeed"]), 1)
        if "VehicleSpeed" in signals:
            self.telemetry_state["VehicleSpeed"] = round(float(signals["VehicleSpeed"]), 1)
        if "ThrottlePosition" in signals:
            self.telemetry_state["ThrottlePosition"] = round(float(signals["ThrottlePosition"]), 1)
        if "EngineTemp" in signals:
            self.telemetry_state["EngineTemp"] = round(float(signals["EngineTemp"]), 1)
        if "OilPressure" in signals:
            self.telemetry_state["OilPressure"] = round(float(signals["OilPressure"]), 2)

        # Vehicle Status
        if "FuelLevel" in signals:
            self.telemetry_state["FuelLevel"] = round(float(signals["FuelLevel"]), 1)
        if "BatterySOC" in signals:
            self.telemetry_state["BatterySOC"] = round(float(signals["BatterySOC"]), 1)
        if "Gear" in signals:
            self.telemetry_state["Gear"] = GEAR_MAP.get(int(signals["Gear"]), str(signals["Gear"]))
        if "BrakeActive" in signals:
            self.telemetry_state["BrakeActive"] = bool(signals["BrakeActive"])
        if "TurnSignal" in signals:
            self.telemetry_state["TurnSignal"] = TURN_MAP.get(int(signals["TurnSignal"]), str(signals["TurnSignal"]))
        if "SteeringAngle" in signals:
            self.telemetry_state["SteeringAngle"] = round(float(signals["SteeringAngle"]), 1)
        if "HeadlightsActive" in signals:
            self.telemetry_state["HeadlightsActive"] = bool(signals["HeadlightsActive"])

        # Diagnostics & Alerts
        if "CheckEngineLight" in signals:
            self.telemetry_state["CheckEngineLight"] = bool(signals["CheckEngineLight"])
        if "BatteryWarning" in signals:
            self.telemetry_state["BatteryWarning"] = bool(signals["BatteryWarning"])
        if "TirePressureWarning" in signals:
            self.telemetry_state["TirePressureWarning"] = bool(signals["TirePressureWarning"])
        if "ABSWarning" in signals:
            self.telemetry_state["ABSWarning"] = bool(signals["ABSWarning"])
        if "Odometer" in signals:
            self.telemetry_state["Odometer"] = round(float(signals["Odometer"]), 1)

        self.telemetry_state["LastFrameTimestamp"] = decoded_frame.get("timestamp", time.time())
        self.telemetry_state["TotalFrames"] = self.frame_count

        # Maintain a rolling window of recent raw frames for inspector
        inspector_frame = {
            "timestamp": decoded_frame["timestamp"],
            "can_id_hex": decoded_frame["can_id_hex"],
            "message_name": decoded_frame["message_name"],
            "raw_hex": decoded_frame["raw_hex"],
            "signals": decoded_frame["signals"]
        }
        self.recent_frames.append(inspector_frame)
        if len(self.recent_frames) > 20:
            self.recent_frames.pop(0)

    async def broadcast_telemetry_loop(self):
        """Broadcasts aggregated telemetry at 30Hz to all connected WebSocket clients."""
        while True:
            await asyncio.sleep(1.0 / 30.0) # 30 Hz update rate
            
            # FPS Calculation
            now = time.time()
            if now - self.last_fps_calc >= 1.0:
                self.telemetry_state["FPS"] = int(self.frame_count / (now - self.last_fps_calc))
                self.frame_count = 0
                self.last_fps_calc = now

            if self.ws_clients:
                payload = json.dumps({
                    "type": "telemetry",
                    "data": self.telemetry_state,
                    "inspector": self.recent_frames[-5:] if self.recent_frames else []
                })
                # Broadcast concurrently to all connected sockets
                dead_clients = set()
                for ws in list(self.ws_clients):
                    try:
                        await ws.send_str(payload)
                    except Exception:
                        dead_clients.add(ws)
                self.ws_clients.difference_update(dead_clients)

    async def can_bus_listener_loop(self):
        """Asynchronously listens on the configured CAN Bus interface."""
        logger.info(f"Starting CAN subscriber listener on {self.channel} ({self.bustype})")
        reader = can.AsyncBufferedReader()
        notifier = can.Notifier(self.bus, [reader], loop=asyncio.get_running_loop())
        
        try:
            while True:
                msg = await reader.get_message()
                decoded = self.decoder.decode_frame(msg.arbitration_id, msg.data, msg.timestamp)
                self.update_telemetry(decoded)
        except asyncio.CancelledError:
            logger.info("CAN bus listener loop stopping...")
        finally:
            notifier.stop()

    async def internal_replay_loop(self):
        """Internal candump log file replayer with precise timing."""
        logger.info(f"Starting internal replay of {self.replay_file} (Speed: {self.replay_speed}x, Loop: {self.replay_loop})")
        
        while True:
            if not os.path.exists(self.replay_file):
                logger.error(f"Replay file not found: {self.replay_file}")
                await asyncio.sleep(2.0)
                continue

            with open(self.replay_file, "r") as f:
                lines = f.readlines()

            logger.info(f"Loaded {len(lines)} frames for replay")
            last_ts = None
            self.replay_restart_requested = False

            for line in lines:
                if self.replay_restart_requested:
                    logger.info("Replay restart requested.")
                    break

                while self.replay_paused:
                    self.telemetry_state["ReplayPaused"] = True
                    await asyncio.sleep(0.1)
                    if self.replay_restart_requested:
                        break

                self.telemetry_state["ReplayPaused"] = False
                self.telemetry_state["ReplaySpeed"] = round(self.replay_speed, 2)

                line = line.strip()
                if not line or not line.startswith("("):
                    continue
                try:
                    # Format: (1495188791.945939) vcan0 0DF805A0#002B87A93FFCEDC4
                    ts_part, rest = line.split(")", 1)
                    timestamp = float(ts_part.replace("(", "").strip())
                    tokens = rest.strip().split()
                    if len(tokens) < 2:
                        continue
                    iface = tokens[0]
                    can_data = tokens[1]
                    can_id_str, hex_payload = can_data.split("#")
                    arbitration_id = int(can_id_str, 16)
                    raw_bytes = bytes.fromhex(hex_payload)

                    if last_ts is not None:
                        delay = (timestamp - last_ts) / max(0.1, self.replay_speed)
                        if delay > 0:
                            # Clamp sleep to prevent freezing on large gaps
                            await asyncio.sleep(min(delay, 0.5))
                    last_ts = timestamp

                    # Decode and update
                    decoded = self.decoder.decode_frame(arbitration_id, raw_bytes, timestamp)
                    self.update_telemetry(decoded)

                    # Also forward to bus if active
                    if self.bus is not None:
                        try:
                            msg = can.Message(arbitration_id=arbitration_id, data=raw_bytes, is_extended_id=(arbitration_id > 0x7FF))
                            self.bus.send(msg)
                        except Exception:
                            pass

                except Exception as e:
                    logger.debug(f"Error parsing replay line '{line}': {e}")

            if self.replay_restart_requested:
                continue

            if not self.replay_loop:
                logger.info("Replay completed (non-looping mode).")
                break
            logger.info("Replay cycle finished, looping back to start...")

    async def websocket_handler(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.ws_clients.add(ws)
        logger.info(f"WebSocket client connected from {request.remote}. Active clients: {len(self.ws_clients)}")

        try:
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    action = data.get("action")
                    if action == "ping":
                        await ws.send_str(json.dumps({"type": "pong", "time": time.time()}))
                    elif action == "get_dbc":
                        await ws.send_str(json.dumps({
                            "type": "dbc_info",
                            "messages": self.get_dbc_summary()
                        }))
                    elif action == "replay_control":
                        cmd = data.get("cmd")
                        if cmd == "pause":
                            self.replay_paused = True
                        elif cmd == "resume":
                            self.replay_paused = False
                        elif cmd == "toggle":
                            self.replay_paused = not self.replay_paused
                        elif cmd == "speed":
                            self.replay_speed = max(0.1, min(10.0, float(data.get("speed", 1.0))))
                        elif cmd == "restart":
                            self.replay_restart_requested = True
                            self.replay_paused = False
                        self.telemetry_state["ReplayPaused"] = self.replay_paused
                        self.telemetry_state["ReplaySpeed"] = round(self.replay_speed, 2)
                    elif action == "inject_frame":
                        try:
                            can_id_raw = data.get("can_id")
                            if isinstance(can_id_raw, str):
                                can_id = int(can_id_raw, 16 if "0x" in can_id_raw.lower() else 10)
                            else:
                                can_id = int(can_id_raw)
                            hex_str = data.get("hex_data", "").replace(" ", "")
                            raw_bytes = bytes.fromhex(hex_str)
                            ts = time.time()
                            decoded = self.decoder.decode_frame(can_id, raw_bytes, ts)
                            self.update_telemetry(decoded)
                            if self.bus is not None:
                                msg = can.Message(arbitration_id=can_id, data=raw_bytes, is_extended_id=(can_id > 0x7FF))
                                self.bus.send(msg)
                            await ws.send_str(json.dumps({"type": "inject_ack", "status": "ok", "can_id": can_id}))
                        except Exception as err:
                            await ws.send_str(json.dumps({"type": "inject_ack", "status": "error", "error": str(err)}))
        finally:
            self.ws_clients.discard(ws)
            logger.info(f"WebSocket client disconnected. Active clients: {len(self.ws_clients)}")
        return ws

    async def run(self):
        # Determine operating mode:
        # If replay_file provided, run internal replayer alongside decoder.
        # Otherwise, connect to live CAN interface (socketcan/virtual).
        app = web.Application()
        app.router.add_get("/ws", self.websocket_handler)

        frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend_dashboard"))
        if os.path.exists(frontend_dir):
            app.router.add_static("/static/", path=frontend_dir, name="static")
            
            async def index_redirect(request):
                return web.HTTPFound("/static/index.html")
            app.router.add_get("/", index_redirect)

        # Start HTTP & WS server
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.http_port)
        await site.start()
        logger.info(f"OpenTwin Web Server running at http://localhost:{self.http_port}/ (WebSocket endpoint: ws://localhost:{self.http_port}/ws)")

        # Start broadcast task
        asyncio.create_task(self.broadcast_telemetry_loop())

        # Start data ingestion
        if self.replay_file:
            asyncio.create_task(self.internal_replay_loop())
        else:
            self.bus = create_can_bus(channel=self.channel, bustype=self.bustype)
            asyncio.create_task(self.can_bus_listener_loop())

        # Keep server running
        while True:
            await asyncio.sleep(3600)

def main():
    parser = argparse.ArgumentParser(description="OpenTwin CAN Telemetry & Replay Server")
    parser.add_argument("--dbc", default=os.path.join(os.path.dirname(__file__), "..", "dbc_definitions", "vehicle_base.dbc"), help="Path to DBC file")
    parser.add_argument("--channel", default="vcan0", help="CAN Channel (default: vcan0)")
    parser.add_argument("--bustype", default="socketcan", help="python-can bustype (default: socketcan, or virtual)")
    parser.add_argument("--replay-log", default=None, help="Path to candump log file for built-in replay")
    parser.add_argument("--replay-speed", type=float, default=1.0, help="Replay playback speed factor (e.g. 1.0, 2.0)")
    parser.add_argument("--no-loop", action="store_true", help="Do not loop replay")
    parser.add_argument("--port", type=int, default=8080, help="Web server HTTP & WS port (default: 8080)")
    args = parser.parse_args()

    server = OpenTwinServer(
        dbc_path=args.dbc,
        channel=args.channel,
        bustype=args.bustype,
        replay_file=args.replay_log,
        replay_loop=not args.no_loop,
        replay_speed=args.replay_speed,
        http_port=args.port
    )

    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        logger.info("OpenTwin server shutting down.")

if __name__ == "__main__":
    main()
