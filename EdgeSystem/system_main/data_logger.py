# EdgeSystem/system_main/data_logger.py
from system_main.database_manager import DatabaseManager

class DataLogger:
    def __init__(self, db_manager: DatabaseManager):
        """
        Initializes the DataLogger with a DatabaseManager instance.
        """
        self.db_manager = db_manager
        print("Data Logger initialized.")

    def log_cycle_data(self, water_level, sensor_flow, image_flow, image_rise, alert_level):
        """
        A single entry point for logging all data from a system cycle.
        """
        self.db_manager.log_sensor_data(
            water_level_m=water_level,
            sensor_flow_rate_mps=sensor_flow,
            image_flow_rate_mps=image_flow,
            image_rise_rate_mps=image_rise,
            current_alert_level=alert_level
        )