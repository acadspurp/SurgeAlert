# EdgeSystem/processing/sensor_data_processor.py
from config.settings import SENSOR_HEIGHT_FROM_MUDPLAIN

def calculate_water_level(distance_from_sensor):
    """
    Converts the raw distance reading from the ultrasonic sensor into
    the actual water level height from the riverbed (mudplain).

    Args:
        distance_from_sensor (float): The distance measured by the sensor in meters.

    Returns:
        float: The calculated water level in meters. Returns 0 if the reading is invalid.
    """
    if distance_from_sensor is None or distance_from_sensor < 0:
        return 0.0
    
    # Water Level = Total Height of Sensor - Distance from Sensor to Water
    water_level = SENSOR_HEIGHT_FROM_MUDPLAIN - distance_from_sensor
    
    # Ensure water level doesn't go below zero
    return max(0.0, water_level)

if __name__ == '__main__':
    print("--- Testing Sensor Data Processor ---")
    
    # Test case 1: Water is far away
    distance1 = 4.5 # meters
    level1 = calculate_water_level(distance1)
    print(f"Sensor reads {distance1}m distance => Water Level is {level1:.2f}m")

    # Test case 2: Water is high
    distance2 = 1.2 # meters
    level2 = calculate_water_level(distance2)
    print(f"Sensor reads {distance2}m distance => Water Level is {level2:.2f}m")
    
    # Test case 3: Invalid reading
    distance3 = -1.0 # meters
    level3 = calculate_water_level(distance3)
    print(f"Sensor reads {distance3}m distance => Water Level is {level3:.2f}m")