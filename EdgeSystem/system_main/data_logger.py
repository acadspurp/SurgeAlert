# EdgeSystem/system_main/data_logger.py
from system_main.database_manager import DatabaseManager


class DataLogger:
    def __init__(self, db_manager: DatabaseManager):
        """
        Initializes the DataLogger with a DatabaseManager instance.
        """
        self.db_manager = db_manager
        print("Data Logger initialized.")


    def log_cycle_data(self, water_level, sensor_flow, img_flow, img_rise, alert_level):
        """
        A single entry point for logging all data from a system cycle.
        """
        self.db_manager.log_sensor_data(
            #water_level_m=water_level,
            #sensor_flow_rate_mps=sensor_flow,
            #img_flow_rate_mps=img_flow,
            #img_rise_rate_mps=img_rise,
            #current_alert_level=alert_level
            water_level=water_level,         # Match param name in db_manager
            sensor_flow=sensor_flow,         # Match param name in db_manager
            img_flow=image_flow,             # <--- CORRECTED
            img_rise=image_rise,             # <--- CORRECTED
            pred_level=0.0,                  # Added this (DB expects it now)
            alert_level=alert_level,         # Match param name in db_manager
            raw_vectors=[]                   # Added this (DB expects it now)
        )

