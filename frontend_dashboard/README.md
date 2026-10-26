# OpenTwin: Automotive Telemetry & Digital Twin Workbench

The `frontend_dashboard` is a multi-view automotive engineering workbench built with modern HTML5, CSS3 Glassmorphism, Canvas, and vanilla JavaScript. It delivers real-time 60 FPS telemetry streaming, diagnostic inspection, oscilloscope plotting, and manual CAN packet injection.

---

## 🚀 Workspaces & Features

### 1. 🚀 Cockpit Cluster
- **Tachometer (RPM)**: Radial SVG gauge (0–8,000 RPM) with swept needle, gradient stroke arc, and redline zone.
- **Centerpiece Speedometer HUD**: Giant velocity readout (`km/h`), active drive mode tag, and digital transmission selector (`P`, `R`, `N`, `D`, `1`, `2`, `3`, `S`).
- **Telltale Warning Array**: Check Engine MIL, Battery/Charging alert, Tire Pressure (TPMS), ABS hydraulic warning, Parking Brake, and High Beams.
- **Interactive Chassis HUD**: Top-down vehicle wireframe with 4-wheel TPMS monitoring, headlights beam graphics, and wheels that physically rotate with the live steering angle.
- **Energy & Fluid Levels**: Coolant temperature, oil pressure, fuel tank capacity, and high-voltage battery state of charge (SOC).

### 2. 📈 Signal Grapher (60 FPS Oscilloscope)
- Multi-trace rolling oscilloscope plotting Engine Speed (RPM), Vehicle Speed (km/h), Throttle (%), and Coolant Temp (°C).
- Waveform freeze/resume, time window adjustment (10s, 20s, 40s), trace toggle filters, and peak/average metrics calculation.

### 3. 🔍 CAN Bus Inspector (Wireshark / CANoe Style)
- Real-time tabular stream showing timestamps, arbitration IDs, DLC, message names, and byte-by-byte colored hex payloads (`Byte 0..7`).
- Live search bar and arbitration ID filter (`0x100`, `0x200`, `0x300`).
- **CSV Log Export**: One-click download of captured CAN frames as a standard `.csv` file.
- Network HUD: Bus load estimate (%), packet frequency (fps), and active ID count.

### 4. 🕹️ ECU Injector & Fault Simulation
- Manual signal overrides for Engine Speed, Vehicle Velocity, Throttle Position, and Coolant Temperature with quick preset buttons.
- Direct DTC fault injection triggers: Check Engine MIL, Tire Pressure TPMS, Alternator/Battery, and ABS.
- Arbitrary raw frame injector: Transmit custom CAN IDs and 8-byte hex payloads directly onto the virtual bus.
- Integrated transmission console terminal displaying live frame ACKs.

### 5. 📚 DBC Data Catalog
- Interactive browser displaying messages, sender ECUs, and signals from `vehicle_base.dbc`.
- Signal bit offsets, lengths, scale factors, offsets, min/max limits, units, and enum lookup tables with live search.

---

## 🎨 Ambient Drive Modes (Theme Switcher)

Clicking the drive mode buttons dynamically transforms the color scheme and ambient HUD lighting:
- **COMFORT**: Electric Cyan / Deep Sky glow
- **SPORT**: Hyper Red / Amber glow with redline emphasis
- **ECO**: Neon Emerald / Mint green glow
- **CYBER**: Cyberpunk Violet / Neon Magenta glow
