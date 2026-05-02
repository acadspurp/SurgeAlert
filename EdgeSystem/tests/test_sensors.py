# EdgeSystem/tests/test_sensors.py
from simulation.sensors import ultrasonic_simulator, radar_simulator
from config.settings import SIM_ULTRASONIC_MIN_DIST, SIM_ULTRASONIC_MAX_DIST, SIM_RADAR_MIN_FLOW, SIM_RADAR_MAX_FLOW

def test_ultrasonic_simulator():
    print("Testing ultrasonic simulator...")
    distance = ultrasonic_simulator.get_distance()
    assert SIM_ULTRASONIC_MIN_DIST <= distance <= SIM_ULTRASONIC_MAX_DIST
    print("Ultrasonic simulator test PASSED.")

def test_radar_simulator():
    print("Testing radar simulator...")
    flow = radar_simulator.get_flow_rate()
    assert SIM_RADAR_MIN_FLOW <= flow <= SIM_RADAR_MAX_FLOW
    print("Radar simulator test PASSED.")

if __name__ == "__main__":
    test_ultrasonic_simulator()
    test_radar_simulator()