# OpenTwin: Automated Testing Suite

This directory contains automated unit and integration tests for the OpenTwin pipeline.

---

## Test Coverage

The test suite (`test_pipeline.py`) validates:

1. **DBC Loading & Integrity (`test_01_dbc_loading`)**: Verifies parsing of `vehicle_base.dbc` and message definitions for `Engine_Data` (0x100), `Vehicle_Status` (0x200), and `Diagnostics_Alerts` (0x300).
2. **Engine Data Decoding (`test_02_engine_data_decoding`)**: Asserts bit-packing and decoding accuracy for RPM, vehicle speed, throttle position, coolant temperature, and oil pressure.
3. **Vehicle Status Decoding (`test_03_vehicle_status_decoding`)**: Validates fuel level, battery SOC, transmission gear selection, brake flags, turn signals, and steering angle decoding.
4. **Diagnostic Alerts Decoding (`test_04_diagnostics_decoding`)**: Validates MIL (Check Engine), TPMS, ABS warnings, and odometer calculation.
5. **Log File Parsing (`test_05_log_file_integrity`)**: Iterates through all 5,100+ frames in `sample_drive.log` ensuring zero malformed or invalid packets.
6. **Live WebSocket Streaming (`test_06_websocket_telemetry_streaming`)**: Spawns an async server instance, connects a WebSocket client, and validates telemetry JSON delivery.

---

## Running Tests

```bash
# From the project root:
python tests/test_pipeline.py
```

Expected output:
```
Ran 6 tests in ~2.5s
OK
```
