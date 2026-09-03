# OpenTwin: Frontend Dashboard

The `frontend_dashboard` is a real-time web-based automotive digital cluster UI built with HTML5, CSS3, and JavaScript.

---

## Features

- **Tachometer (RPM)**: Radial gauge (0–8,000 RPM) with smooth swept needle, animated stroke arc, and redline zone.
- **Center Telemetry Display**: Bold digital speedometer (km/h), gear selector (`P`, `R`, `N`, `D`, `1`, `2`, `3`, `S`), steering angle indicator, and odometer.
- **Status & Warning Lights**: Blinking turn signal indicators, Check Engine light, Battery alert, Tire Pressure (TPMS), ABS warning, and Headlights.
- **Auxiliary Gauges**: Coolant temperature, oil pressure, fuel percentage, battery state of charge (SOC), and throttle level.
- **Live CAN Frame Inspector**: Real-time table streaming raw hex frames, arbitration IDs, and decoded signals with live filtering (0x100, 0x200, 0x300) and pause/resume controls.

---

## Architecture

- **`index.html`**: Semantic layout and inline SVG gauge components.
- **`style.css`**: Modern dark glassmorphic automotive aesthetic with glowing neon highlights and responsive design.
- **`app.js`**: WebSocket telemetry client with dynamic gauge angle transforms and automatic reconnection.
