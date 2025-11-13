# EdgeSystem/simulation/sensors/radar_simulator.py
import random
from config.settings import SIM_RADAR_MIN_FLOW, SIM_RADAR_MAX_FLOW

class RadarSimulator:
    """Simulates a radar sensor providing water flow rate."""
    def __init__(self):
        print("Initialized Radar Sensor Simulator.")

    def read_flow_rate(self) -> float:
        """
        Returns a simulated flow rate in meters per second (m/s).
        """
        flow_rate = random.uniform(SIM_RADAR_MIN_FLOW, SIM_RADAR_MAX_FLOW)
        return round(flow_rate, 2)

# --- How to Test This Module ---
if __name__ == '__main__':
    simulator = RadarSimulator()
    print("Testing Radar Simulator...")
    for i in range(5):
        flow = simulator.read_flow_rate()
        print(f"Reading {i+1}: {flow} m/s")
