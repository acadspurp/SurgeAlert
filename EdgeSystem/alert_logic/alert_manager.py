# EdgeSystem/alert_logic/alert_manager.py
from config.settings import (
    WATER_LEVEL_RED_THRESHOLD, WATER_LEVEL_ORANGE_THRESHOLD, WATER_LEVEL_YELLOW_THRESHOLD,
    FLOW_RATE_RED_THRESHOLD, FLOW_RATE_ORANGE_THRESHOLD, FLOW_RATE_YELLOW_THRESHOLD,
    RISE_RATE_RED_THRESHOLD, RISE_RATE_ORANGE_THRESHOLD, RISE_RATE_YELLOW_THRESHOLD
)

class AlertManager:
    """Determines the flood alert level based on sensor data."""
    def __init__(self):
        print("Initialized Alert Manager.")

    def determine_alert_level(self, water_level_m, flow_rate_mps, rise_rate_mps) -> str:
        """
        Determines the current alert level.
        The logic prioritizes the highest threat level from any metric.
        """
        # Check for RED conditions (highest priority)
        if (water_level_m >= WATER_LEVEL_RED_THRESHOLD or
            flow_rate_mps >= FLOW_RATE_RED_THRESHOLD or
            rise_rate_mps >= RISE_RATE_RED_THRESHOLD):
            return "RED"

        # Check for ORANGE conditions
        if (water_level_m >= WATER_LEVEL_ORANGE_THRESHOLD or
            flow_rate_mps >= FLOW_RATE_ORANGE_THRESHOLD or
            rise_rate_mps >= RISE_RATE_ORANGE_THRESHOLD):
            return "ORANGE"

        # Check for YELLOW conditions
        if (water_level_m >= WATER_LEVEL_YELLOW_THRESHOLD or
            flow_rate_mps >= FLOW_RATE_YELLOW_THRESHOLD or
            rise_rate_mps >= RISE_RATE_YELLOW_THRESHOLD):
            return "YELLOW"

        # If none of the above, conditions are normal
        return "GREEN"


# --- How to Test This Module ---
if __name__ == '__main__':
    manager = AlertManager()
    print("Testing Alert Manager with different scenarios...")

    # Scenario 1: Normal
    level = manager.determine_alert_level(1.0, 0.5, 0.01)
    print(f"Scenario: Normal -> Result: {level}") # Expected: GREEN

    # Scenario 2: Rising water
    level = manager.determine_alert_level(1.6, 0.6, 0.06)
    print(f"Scenario: Rising Water -> Result: {level}") # Expected: YELLOW

    # Scenario 3: High flow rate
    level = manager.determine_alert_level(2.0, 1.6, 0.1)
    print(f"Scenario: High Flow -> Result: {level}") # Expected: ORANGE

    # Scenario 4: Critical water level
    level = manager.determine_alert_level(3.6, 1.0, 0.1)
    print(f"Scenario: Critical Level -> Result: {level}") # Expected: RED
