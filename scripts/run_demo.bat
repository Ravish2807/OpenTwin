@echo off
REM ==============================================================================
REM OpenTwin: Standalone Demo Launcher (Cross-Platform Replay & Dashboard)
REM ==============================================================================

echo ==============================================================================
echo  OpenTwin: Software-Based CAN Emulator ^& Replay Engine
echo ==============================================================================
echo [*] Starting Python Decoder Server with built-in CAN log replay...
echo [*] Web Dashboard will be available at: http://localhost:8080/

start http://localhost:8080/
python emulator_core\server.py --dbc dbc_definitions\vehicle_base.dbc --replay-log data_logs\sample_drive.log --port 8080

pause
