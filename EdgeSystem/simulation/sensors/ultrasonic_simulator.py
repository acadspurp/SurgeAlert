import random
from itertools import cycle
from config.settings import SENSOR_HEIGHT_FROM_MUDPLAIN

class UltrasonicSimulator:
    """Simulates an ultrasonic sensor providing distance measurements."""
    
    def __init__(self):
        print("Initialized Ultrasonic Sensor Simulator.")
        
        # We want the resulting Water Level to be exactly 17.75m
        # The formula used in sensor_data_processor is: 
        # WaterLevel = SensorHeight - Distance
        # Therefore: Distance = SensorHeight - TargetWaterLevel
        
        target_water_level = 17.75
        calculated_dist = SENSOR_HEIGHT_FROM_MUDPLAIN - target_water_level
        
        # Safety check to prevent negative distance if settings aren't updated
        if calculated_dist < 0:
            print(f"Warning: Sensor Height {SENSOR_HEIGHT_FROM_MUDPLAIN}m is too low for target 17.75m.")
            calculated_dist = 0.1

        self.values = cycle([calculated_dist])

    def read_distance(self) -> float:
        """
        Returns a simulated distance reading in meters.
        """
        return next(self.values)

# --- How to Test This Module ---
if __name__ == '__main__':
    simulator = UltrasonicSimulator()
    print("Testing Ultrasonic Simulator...")
    for i in range(5):
        dist = simulator.read_distance()
        print(f"Reading {i+1}: {dist} meters (Resulting WL: {SENSOR_HEIGHT_FROM_MUDPLAIN - dist}m)")