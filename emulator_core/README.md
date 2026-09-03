# OpenTwin: Emulator Core & Decoder Backend

The `emulator_core` module handles CAN frame subscription, DBC signal translation, and real-time WebSocket broadcasting.

---

## Core Modules

- **`decoder.py`**:
  - Encapsulates `cantools` and `python-can`.
  - Maps arbitration IDs to message definitions and decodes bitfields into physical engineering units.
  - Automatically handles fallbacks for cross-platform virtual bus environments.
- **`server.py`**:
  - Asynchronous event loop (`asyncio`, `aiohttp`).
  - Broadcasts decoded telemetry JSON objects to all connected frontend clients at 30Hz.
  - Hosts frontend static dashboard assets on HTTP port 8080.
  - Includes a built-in candump log file replayer (`--replay-log`).

---

## CLI Options

```bash
python emulator_core/server.py [OPTIONS]

Options:
  --dbc PATH           Path to DBC database (default: dbc_definitions/vehicle_base.dbc)
  --channel NAME       CAN Channel name (default: vcan0)
  --bustype TYPE       python-can bustype (default: socketcan, or virtual)
  --replay-log PATH    Directly replay a candump log file
  --replay-speed FLOAT Playback speed multiplier (default: 1.0)
  --no-loop            Do not loop the replay
  --port INT           HTTP & WebSocket server port (default: 8080)
```

---

## WebSocket API Schema

### Telemetry Packet (`ws://localhost:8080/ws`)
```json
{
  "type": "telemetry",
  "data": {
    "EngineSpeed": 3450.0,
    "VehicleSpeed": 88.5,
    "ThrottlePosition": 42.0,
    "EngineTemp": 92.0,
    "OilPressure": 4.2,
    "FuelLevel": 74.0,
    "BatterySOC": 82.0,
    "Gear": "D",
    "BrakeActive": false,
    "TurnSignal": "LEFT",
    "SteeringAngle": -24.5,
    "HeadlightsActive": true,
    "CheckEngineLight": false,
    "BatteryWarning": false,
    "TirePressureWarning": false,
    "ABSWarning": false,
    "Odometer": 14250.4,
    "FPS": 30,
    "TotalFrames": 5100
  },
  "inspector": [
    {
      "timestamp": 1700000010.5,
      "can_id_hex": "0x100",
      "message_name": "Engine_Data",
      "raw_hex": "12B00E582A5C5400",
      "signals": {"EngineSpeed": 3450.0, "VehicleSpeed": 88.5}
    }
  ]
}
```
