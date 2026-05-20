"""Predict water level and alert class ~1 hour ahead using ML + hydrology."""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alert_logic.alert_manager import AlertManager


class LevelPredictor:
    def __init__(self):
        self.alert_manager = AlertManager()

    def predict_one_hour(self, water_level, rise_rate_mph, ml_features=None, features_stale=False):
        """
        Returns (predicted_level_m, predicted_alert_level).
        rise_rate_mph: ultrasonic rise in m/h.
        """
        ml = ml_features or {}
        rise_mph = rise_rate_mph or 0.0

        predicted_level = max(0.0, (water_level or 0.0) + rise_mph)
        predicted_level = round(predicted_level, 2)

        predicted_alert = None
        if self.alert_manager.model is not None and ml and not features_stale:
            predicted_alert = self.alert_manager.predict_alert_class(
                water_level=water_level or 0.0,
                rise_rate_mph=rise_mph,
                tide_level=ml.get("Tide_Height_m", 0.0),
                tide_trend=ml.get("Tide_Trend", 0.0),
                qc_rain=ml.get("QC_Rain_mm", 0.0),
                qc_lag1=ml.get("QC_Lag1", 0.0),
                qc_lag2=ml.get("QC_Lag2", 0.0),
                qc_3hr=ml.get("QC_3hr_Sum", 0.0),
                qc_6hr=ml.get("QC_6hr_Sum", 0.0),
                mar_rain=ml.get("Marulas_Rain_mm", 0.0),
                mar_lag1=ml.get("Mar_Lag1", 0.0),
                mar_lag2=ml.get("Mar_Lag2", 0.0),
                mar_3h=ml.get("Mar_3hr_Sum", 0.0),
                mar_6h=ml.get("Mar_6hr_Sum", 0.0),
                mar_24h=ml.get("Mar_24hr_Sum", 0.0),
                pressure=ml.get("Pressure_hPa", 1013.0),
                press_trend=ml.get("Press_Trend", 0.0),
                wind=ml.get("Wind_Speed", 0.0),
                soil_moisture=ml.get("Soil_Moisture", 0.0),
            )

        if predicted_alert is None:
            predicted_alert = self.alert_manager.determine_alert_level(
                predicted_level,
                predicted_level=predicted_level,
                rise_rate_per_hour=rise_mph,
            )

        return predicted_level, predicted_alert
