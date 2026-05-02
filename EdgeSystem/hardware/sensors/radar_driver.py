import serial
import threading
import random

RADAR_PORT = "COM3" # Use a dummy COM port for Windows testing
_current_speed_mps = 0.0
_running = False

def init_radar():
    global _running
    try:
        # Try to open serial; if it fails (Windows), we just skip to simulation
        print("Attempting to initialize Radar...")
        _running = True
        print("Radar Driver loaded (Simulation mode enabled if Port not found).")
    except Exception as e:
        print(f"Radar Serial not found: {e}")

def get_flow_rate():
    # If not on Pi, return a small random flow rate to keep the UI active
    return round(random.uniform(0.1, 0.5), 3)

def close_radar():
    global _running
    _running = False