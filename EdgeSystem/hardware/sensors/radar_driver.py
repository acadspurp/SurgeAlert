import RPi.GPIO as GPIO
import time
import random
from config.settings import RADAR_PIN

def init_radar():
    """Initializes the RCWL-0516 Radar pin."""
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(RADAR_PIN, GPIO.IN)
        print(f"Radar Sensor (RCWL-0516) Initialized on GPIO {RADAR_PIN}.")
    except Exception as e:
        print(f"Error initializing Radar: {e}")

def get_flow_rate():
    """
    Reads the RCWL-0516 Doppler Radar.
    RCWL-0516 is a motion sensor, not a speed sensor.
    
    Logic:
    - If HIGH (1): Water surface is turbulent/moving -> Return approx 1.5 m/s
    - If LOW (0): Water is calm -> Return 0.0 m/s
    """
    try:
        if GPIO.input(RADAR_PIN):
            # Motion Detected (Turbulence)
            # Return a random value between 1.2 and 1.8 to simulate flow
            return round(random.uniform(1.2, 1.8), 2)
        else:
            # No Motion (Calm)
            return 0.0
    except Exception as e:
        print(f"Radar Read Error: {e}")
        return 0.0
