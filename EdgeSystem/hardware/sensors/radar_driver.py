import serial
import threading
import time
import random
from config.settings import (
    RADAR_BAUDRATE,
    RADAR_PORT,
    SIM_RADAR_FLOW_AMPLITUDE_MPS,
    SIM_RADAR_FLOW_BASE_MPS,
    SIM_RADAR_PERIOD_SEC,
    USE_HARDWARE,
)

_current_speed_mps = 0.0
_running = False
_serial_conn = None

def init_radar():
    global _running, _serial_conn
    try:
        print(f" [Hardware] Initializing HLK-LD2415H Radar on {RADAR_PORT}...")
        
        # Check if we have the correct 'serial' module (pyserial)
        if not hasattr(serial, 'Serial'):
            raise AttributeError("module 'serial' has no attribute 'Serial'. Ensure 'pyserial' is installed, not 'serial'.")
            
        _serial_conn = serial.Serial(RADAR_PORT, RADAR_BAUDRATE, timeout=1)
        _running = True
        # Start background thread to read from Serial
        threading.Thread(target=_read_serial_loop, daemon=True).start()
        print(" [Hardware] Radar Serial Connection Established.")
    except Exception as e:
        print(f" [Hardware] Radar Hardware not found (Simulation mode active): {e}")
        _running = False

def _read_serial_loop():
    global _current_speed_mps, _running
    while _running and _serial_conn and _serial_conn.is_open:
        try:
            line = _serial_conn.readline().decode('utf-8', errors='ignore').strip()
            # HLK-LD2415H typically outputs speed in its data string. 
            # This is a simplified parser; adjust based on specific firmware output.
            if "speed:" in line.lower():
                parts = line.split(":")
                if len(parts) > 1:
                    # Expecting format like "Speed: 1.23"
                    _current_speed_mps = float(parts[1].strip().split()[0])
        except:
            time.sleep(0.1)

def get_flow_rate():
    if not USE_HARDWARE or not _running:
        import math
        t = time.time()
        return round(
            SIM_RADAR_FLOW_BASE_MPS
            + SIM_RADAR_FLOW_AMPLITUDE_MPS * abs(math.sin(t / SIM_RADAR_PERIOD_SEC)),
            3,
        )
    return _current_speed_mps

def close_radar():
    global _running
    _running = False
    if _serial_conn:
        _serial_conn.close()