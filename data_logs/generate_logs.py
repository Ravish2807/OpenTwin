"""
OpenTwin Log Generator
Generates realistic candump-compatible CAN bus log files (.log) based on vehicle_base.dbc.
"""

import math
import struct
import os
import sys

def pack_engine_data(rpm, speed_kmh, throttle_pct, temp_c, oil_bar):
    """Encodes Engine_Data (0x100 / 256) into 8 bytes."""
    raw_rpm = int(rpm / 0.25) & 0xFFFF
    raw_speed = int(speed_kmh / 0.01) & 0xFFFF
    raw_throttle = int(throttle_pct * 255.0 / 100.0) & 0xFF
    raw_temp = int(temp_c + 40) & 0xFF
    raw_oil = int(oil_bar / 0.05) & 0xFF
    # 8 bytes: rpm(2, LE), speed(2, LE), throttle(1), temp(1), oil(1), reserved(1)
    payload = struct.pack("<HHBBBB", raw_rpm, raw_speed, raw_throttle, raw_temp, raw_oil, 0)
    return payload.hex().upper()

def pack_vehicle_status(fuel_pct, battery_soc, gear_val, brake_bool, turn_signal_val, steering_deg, lights_bool):
    """Encodes Vehicle_Status (0x200 / 512) into 8 bytes."""
    raw_fuel = int(fuel_pct * 2) & 0xFF
    raw_battery = int(battery_soc * 2) & 0xFF
    
    # Byte 2: gear(0..3), brake(4), turn_signal(5..7)
    byte2 = (int(gear_val) & 0x0F) | ((1 if brake_bool else 0) << 4) | ((int(turn_signal_val) & 0x07) << 5)
    
    # Bytes 3-4: steering angle (signed 16-bit LE, scale 0.1)
    raw_steering = int(steering_deg / 0.1) & 0xFFFF
    steer_bytes = struct.pack("<h", int(steering_deg / 0.1))
    
    # Byte 5: Headlights
    byte5 = (1 if lights_bool else 0) & 0xFF
    
    payload = struct.pack("<BBB", raw_fuel, raw_battery, byte2) + steer_bytes + struct.pack("<BBB", byte5, 0, 0)
    return payload.hex().upper()

def pack_diagnostics(check_engine, battery_warn, tpms_warn, abs_warn, odo_km):
    """Encodes Diagnostics_Alerts (0x300 / 768) into 8 bytes."""
    flags = (1 if check_engine else 0) | ((1 if battery_warn else 0) << 1) | \
            ((1 if tpms_warn else 0) << 2) | ((1 if abs_warn else 0) << 3)
    raw_odo = int(odo_km * 10) & 0xFFFFFFFF
    payload = struct.pack("<B", flags) + struct.pack("<I", raw_odo) + b"\x00\x00\x00"
    return payload.hex().upper()

def generate_candump_log(output_file, duration_sec=60.0, step_hz=50.0):
    start_time = 1700000000.000000
    total_steps = int(duration_sec * step_hz)
    dt = 1.0 / step_hz

    lines = []
    odo = 14250.4

    for step in range(total_steps):
        t = step * dt
        curr_ts = start_time + t

        # Realistic drive cycle phases
        if t < 5.0: # Startup / Idle
            gear = 0 # P
            speed = 0.0
            rpm = 800.0 + 30.0 * math.sin(t * 4)
            throttle = 0.0
            brake = True
            turn_signal = 0
            steering = 0.0
            temp = 85.0 + (t / 5.0) * 2.0
            oil = 3.5
        elif t < 8.0: # Shift to D, release brake
            gear = 3 # D
            speed = 0.0
            rpm = 750.0 + 20.0 * math.sin(t * 3)
            throttle = 5.0
            brake = False
            turn_signal = 1 # Left signal
            steering = -15.0 * (t - 5.0)
            temp = 87.0
            oil = 3.8
        elif t < 20.0: # Accelerate 0 -> 60 km/h
            p = (t - 8.0) / 12.0
            gear = 3 # D
            speed = 60.0 * (p ** 1.2)
            rpm = 1200.0 + 2800.0 * (math.sin(p * math.pi * 2.5) * 0.4 + p * 0.8)
            rpm = max(1000.0, min(4500.0, rpm))
            throttle = 35.0 + 10.0 * math.sin(t * 2)
            brake = False
            turn_signal = 1 if t < 12.0 else 0
            steering = -25.0 * math.exp(-(t-10)**2 / 4)
            temp = 88.0 + p * 2.0
            oil = 4.2
        elif t < 30.0: # Cruising at 60 km/h
            gear = 3
            speed = 60.0 + 2.0 * math.sin(t)
            rpm = 1800.0 + 50.0 * math.sin(t * 2)
            throttle = 18.0 + 3.0 * math.cos(t)
            brake = False
            turn_signal = 0
            steering = 2.0 * math.sin(t * 0.5)
            temp = 90.0
            oil = 4.0
        elif t < 40.0: # Braking and Right Turn
            p = (t - 30.0) / 10.0
            gear = 3
            speed = max(15.0, 60.0 - 45.0 * (p ** 0.9))
            rpm = max(1100.0, 1800.0 - 600.0 * p + 50.0 * math.sin(t * 4))
            throttle = 0.0
            brake = (p < 0.7)
            turn_signal = 2 # Right turn
            steering = 35.0 * math.sin(p * math.pi)
            temp = 91.0
            oil = 3.7
        elif t < 52.0: # Highway acceleration up to 105 km/h
            p = (t - 40.0) / 12.0
            gear = 3
            speed = 20.0 + 85.0 * (p ** 1.1)
            rpm = 1500.0 + 3200.0 * (p ** 0.8) + 100.0 * math.sin(t * 5)
            rpm = min(5200.0, rpm)
            throttle = 65.0 - 20.0 * p
            brake = False
            turn_signal = 0
            steering = 1.5 * math.cos(t * 0.8)
            temp = 92.5
            oil = 4.6
        else: # Decelerating to halt and shift to P
            p = (t - 52.0) / 8.0
            gear = 3 if p < 0.85 else 0
            speed = max(0.0, 105.0 * ((1.0 - p) ** 1.3))
            rpm = max(800.0, 3000.0 * (1.0 - p) + 800.0)
            throttle = 0.0
            brake = (p > 0.1)
            turn_signal = 3 if p > 0.6 else 0 # Hazard lights on stop
            steering = 0.0
            temp = 90.0
            oil = 3.5

        # Fuel & Battery depletion
        fuel = max(10.0, 78.0 - (t / 60.0) * 0.5)
        battery = max(15.0, 88.0 - (t / 60.0) * 0.3)
        odo += (speed / 3600.0) * dt

        # Warning lights test (simulate brief tire pressure indicator around t=35..38)
        tpms = (35.0 <= t <= 38.0)
        check_engine = False
        battery_warn = False
        abs_active = (brake and speed > 40.0 and (t > 31.0 and t < 33.0))

        # 1. Engine_Data at 50Hz (every step)
        hex_engine = pack_engine_data(rpm, speed, throttle, temp, oil)
        lines.append(f"({curr_ts:.6f}) vcan0 100#{hex_engine}")

        # 2. Vehicle_Status at 25Hz (every 2nd step)
        if step % 2 == 0:
            hex_status = pack_vehicle_status(fuel, battery, gear, brake, turn_signal, steering, lights_bool=True)
            lines.append(f"({curr_ts:.6f}) vcan0 200#{hex_status}")

        # 3. Diagnostics_Alerts at 10Hz (every 5th step)
        if step % 5 == 0:
            hex_diag = pack_diagnostics(check_engine, battery_warn, tpms, abs_active, odo)
            lines.append(f"({curr_ts:.6f}) vcan0 300#{hex_diag}")

    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"[OpenTwin] Successfully generated {len(lines)} CAN frames to {output_file}")

if __name__ == "__main__":
    out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "sample_drive.log")
    generate_candump_log(out_path, duration_sec=60.0, step_hz=50.0)
