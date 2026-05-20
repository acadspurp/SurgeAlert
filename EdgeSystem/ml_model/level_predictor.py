"""Predict water level and alert class ~1 hour ahead using ML + sensor fallback."""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alert_logic.alert_manager import AlertManager
from alert_logic.flow_alert import apply_flow_escalation


class LevelPredictor:
    def __init__(self):
        self.alert_manager = AlertManager()

    def predict_one_hour(
        self,
        water_level,
        rise_rate_mph,
        ml_features=None,
        features_stale=False,
        sensor_flow=0.0,
        image_flow=0.0,
        fused_flow=0.0,
    ):
        """
        Returns (predicted_level_m, predicted_alert_level).
        Fresh env: XGBoost regressor + classifier when loaded.
        Stale/missing env: sensor-only fallback (level, rise, flows).
        """
        ml = ml_features or {}
        rise_mph = rise_rate_mph or 0.0
        wl = water_level or 0.0
        fused = fused_flow if fused_flow is not None else 0.0

        use_ml = (
            not features_stale
            and ml
            and self.alert_manager.model is not None
        )

        predicted_level = None
        if use_ml and self.alert_manager.regressor is not None:
            predicted_level = self.alert_manager.predict_water_level(
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

        if predicted_level is None:
            predicted_level = self._predict_level_from_sensor(wl, rise_mph, fused)

        predicted_level = round(max(0.0, float(predicted_level)), 2)

        predicted_alert = None
        if use_ml:
            predicted_alert = self.alert_manager.predict_alert_class(
                water_level=wl,
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
            predicted_alert = self._predict_alert_from_sensor(
                predicted_level, rise_mph, fused
            )

        predicted_alert = apply_flow_escalation(
            predicted_alert, predicted_level, fused
        )
        return predicted_level, predicted_alert

    @staticmethod
    def _predict_level_from_sensor(water_level, rise_rate_mph, fused_flow_mps):
        """Sensor-only +1h level when ML env features are stale."""
        base = max(0.0, (water_level or 0.0) + (rise_rate_mph or 0.0))
        if fused_flow_mps and fused_flow_mps > 0:
            base += fused_flow_mps * 3600.0 * 0.0001
        return base

    def _predict_alert_from_sensor(self, predicted_level, rise_rate_mph, fused_flow_mps):
        alert = self.alert_manager.determine_alert_level(
            predicted_level,
            predicted_level=predicted_level,
            rise_rate_per_hour=rise_rate_mph,
        )
        return apply_flow_escalation(alert, predicted_level, fused_flow_mps)
