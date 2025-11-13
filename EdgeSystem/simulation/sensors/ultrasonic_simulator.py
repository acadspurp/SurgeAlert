 # EdgeSystem/simulation/sensors/ultrasonic_simulator.py
import random
from config.settings import SIM_ULTRASONIC_MIN_DIST, SIM_ULTRASONIC_MAX_DIST

class UltrasonicSimulator:
    """Simulates an ultrasonic sensor providing distance measurements."""
    def __init__(self):
        print("Initialized Ultrasonic Sensor Simulator.")

    def read_distance(self) -> float:
        """
        Returns a simulated distance reading in meters.
        """
        # Generate a random float within the configured range
        distance = random.uniform(SIM_ULTRASONIC_MIN_DIST, SIM_ULTRASONIC_MAX_DIST)
        return round(distance, 2)

# --- How to Test This Module ---
# This allows you to run this file directly to see its output.
if __name__ == '__main__':
    simulator = UltrasonicSimulator()
    print("Testing Ultrasonic Simulator...")
    for i in range(5):
        dist = simulator.read_distance()
        print(f"Reading {i+1}: {dist} meters")
