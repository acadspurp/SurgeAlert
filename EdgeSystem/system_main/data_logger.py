from system_main.database_manager import DatabaseManager
from system_main.edge_sync import ml_features_to_weather_dict
from system_main.edge_time_utils import grid_timestamp_iso


class DataLogger:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def log_cycle(self, reading, ml_features=None, raw_vectors=None, image_base64=None, pred_class=None):
        if not reading.get("timestamp"):
            reading["timestamp"] = grid_timestamp_iso()

        row_id = self.db_manager.log_sensor_data(
            reading=reading,
            raw_vectors=raw_vectors or [],
            image_bytes=image_base64,
        )

        if ml_features:
            weather = ml_features_to_weather_dict(ml_features)
            tide_h = ml_features.get("Tide_Height_m") or ml_features.get("tideHeightM") or 0.0
            tide_trend = ml_features.get("Tide_Trend") or ml_features.get("tideTrend") or 0.0
            self.db_manager.cache_ml_features_row(
                ml_features,
                water_level=reading["water_level"],
                rise_rate_mph=reading["rise_rate"],
                pred_class=pred_class,
            )

        return row_id
