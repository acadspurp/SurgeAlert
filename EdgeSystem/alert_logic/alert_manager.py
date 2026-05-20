import joblib
import os
import sys
from datetime import datetime

import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    MODEL_PATH,
    RISE_RATE_RED_WITH_ORANGE_MPH,
    RISE_RATE_YELLOW_MPH,
    WATER_LEVEL_ORANGE_THRESHOLD,
    WATER_LEVEL_RED_THRESHOLD,
    WATER_LEVEL_YELLOW_THRESHOLD,
)
from ml_model.classifier_wrappers import EnsembleSurgeClassifier, SurgeAlertClassifier  # noqa: F401 — joblib
from alert_logic.flow_alert import apply_flow_escalation
from ml_model.dataset_utils import (
    CLASSIFIER_FEATURE_COLUMNS,
    FEATURE_COLUMNS,
    LABEL_NAMES,
    REGRESSOR_FEATURE_COLUMNS,
    predict_alert_from_probs,
    row_to_features,
)


class AlertManager:
    def __init__(self):
        self.model = None
        self.regressor = None
        self.feature_columns = None
        self.label_names = LABEL_NAMES
        self.probability_thresholds = None
        self.regressor_feature_columns = REGRESSOR_FEATURE_COLUMNS
        self.load_model()

    def reload_model(self):
        self.load_model()

    def load_model(self):
        print(f" [AI] Attempting to load model from: {MODEL_PATH}")
        try:
            if os.path.exists(MODEL_PATH):
                artifact = joblib.load(MODEL_PATH)
                if isinstance(artifact, dict) and "classifier" in artifact:
                    self.model = artifact["classifier"]
                    self.regressor = artifact.get("regressor")
                    self.feature_columns = artifact.get(
                        "feature_columns", CLASSIFIER_FEATURE_COLUMNS
                    )
                    self.regressor_feature_columns = artifact.get(
                        "regressor_feature_columns", REGRESSOR_FEATURE_COLUMNS
                    )
                    self.label_names = artifact.get("label_names", LABEL_NAMES)
                    self.probability_thresholds = artifact.get(
                        "probability_thresholds"
                    )
                    print(" [AI] SUCCESS: Classifier + regressor bundle loaded.")
                else:
                    self.model = artifact
                    print(" [AI] SUCCESS: Legacy classifier loaded.")
            else:
                print(" [AI] WARNING: Model file not found.")
                print("      Run: python -m ml_model.train_model")
                self.model = None
        except Exception as e:
            print(f" [AI] CRITICAL ERROR loading model: {e}")
            self.model = None

    def determine_alert_level(
        self, water_level, predicted_level=None, rise_rate_per_hour=0.0
    ):
        if water_level is None:
            return "GREEN"

        if water_level >= WATER_LEVEL_RED_THRESHOLD:
            return "RED"

        if (
            predicted_level is not None
            and predicted_level >= WATER_LEVEL_RED_THRESHOLD
        ):
            return "RED"

        if (
            rise_rate_per_hour >= RISE_RATE_RED_WITH_ORANGE_MPH
            and water_level >= WATER_LEVEL_ORANGE_THRESHOLD
        ):
            return "RED"

        if water_level >= WATER_LEVEL_ORANGE_THRESHOLD:
            return "ORANGE"

        if (
            water_level >= WATER_LEVEL_YELLOW_THRESHOLD
            or rise_rate_per_hour >= RISE_RATE_YELLOW_MPH
        ):
            return "YELLOW"

        return "GREEN"

    def determine_alert_level_with_flow(
        self,
        water_level,
        predicted_level=None,
        rise_rate_per_hour=0.0,
        fused_flow_mps=0.0,
    ):
        base = self.determine_alert_level(
            water_level,
            predicted_level=predicted_level,
            rise_rate_per_hour=rise_rate_per_hour,
        )
        return apply_flow_escalation(base, water_level, fused_flow_mps)

    @staticmethod
    def _class_index_to_name(index: int) -> str:
        if isinstance(LABEL_NAMES, dict):
            return LABEL_NAMES.get(int(index), "GREEN")
        names = ["GREEN", "YELLOW", "ORANGE", "RED"]
        return names[int(index)] if 0 <= int(index) < 4 else "GREEN"

    def predict_alert_class(
        self,
        water_level,
        rise_rate_mph,
        tide_level,
        qc_rain,
        qc_lag1,
        qc_lag2,
        qc_3hr=None,
        qc_6hr=None,
        mar_rain=None,
        mar_lag1=None,
        mar_lag2=None,
        mar_3h=None,
        mar_6h=None,
        mar_24h=None,
        pressure=None,
        wind=None,
        soil_moisture=None,
        tide_trend=0.0,
        press_trend=0.0,
        month=None,
        hour=None,
    ):
        """Predict alert_level (0-3) from weather/tide/rain (not sensor level — avoids leakage)."""
        if self.model is None:
            return None

        try:
            now = datetime.now()
            features = row_to_features(
                month=month if month is not None else now.month,
                hour=hour if hour is not None else now.hour,
                tide_height_m=float(tide_level or 0.0),
                tide_trend=float(tide_trend or 0.0),
                pressure_hpa=float(pressure or 1013.0),
                press_trend=float(press_trend or 0.0),
                wind_speed=float(wind or 0.0),
                soil_moisture=float(soil_moisture or 0.0),
                qc_rain_mm=float(qc_rain or 0.0),
                qc_rain_lag1=float(qc_lag1 or 0.0),
                qc_rain_lag2=float(qc_lag2 or 0.0),
                qc_3hr_sum=float(qc_3hr or 0.0),
                qc_6hr_sum=float(qc_6hr or 0.0),
                marulas_rain_mm=float(mar_rain or 0.0),
                mar_rain_lag1=float(mar_lag1 or 0.0),
                mar_rain_lag2=float(mar_lag2 or 0.0),
                mar_3hr_sum=float(mar_3h or 0.0),
                mar_24hr_sum=float(mar_24h or 0.0),
                feature_columns=self.feature_columns,
            )
            probs = self.model.predict_proba(features)[0]
            if self.probability_thresholds:
                pred_arr = predict_alert_from_probs(
                    np.array([probs]), self.probability_thresholds
                )
                pred_index = int(pred_arr[0])
            else:
                pred_index = int(self.model.predict(features)[0])
            return self._class_index_to_name(pred_index)
        except Exception as e:
            print(f" [AI] Prediction Error: {e}")
            return None

    def predict_water_level(
        self,
        tide_level,
        qc_rain,
        qc_lag1,
        qc_lag2,
        qc_3hr,
        qc_6hr,
        mar_rain,
        mar_lag1,
        mar_lag2,
        mar_3h,
        mar_24h,
        pressure,
        wind,
        soil_moisture,
        tide_trend=0.0,
        press_trend=0.0,
        month=None,
        hour=None,
    ):
        if self.regressor is None:
            return None
        try:
            now = datetime.now()
            features = row_to_features(
                month=month if month is not None else now.month,
                hour=hour if hour is not None else now.hour,
                tide_height_m=float(tide_level or 0.0),
                tide_trend=float(tide_trend or 0.0),
                pressure_hpa=float(pressure or 1013.0),
                press_trend=float(press_trend or 0.0),
                wind_speed=float(wind or 0.0),
                soil_moisture=float(soil_moisture or 0.0),
                qc_rain_mm=float(qc_rain or 0.0),
                qc_rain_lag1=float(qc_lag1 or 0.0),
                qc_rain_lag2=float(qc_lag2 or 0.0),
                qc_3hr_sum=float(qc_3hr or 0.0),
                qc_6hr_sum=float(qc_6hr or 0.0),
                marulas_rain_mm=float(mar_rain or 0.0),
                mar_rain_lag1=float(mar_lag1 or 0.0),
                mar_rain_lag2=float(mar_lag2 or 0.0),
                mar_3hr_sum=float(mar_3h or 0.0),
                mar_24hr_sum=float(mar_24h or 0.0),
                feature_columns=self.regressor_feature_columns,
            )
            return float(self.regressor.predict(features)[0])
        except Exception as e:
            print(f" [AI] Regressor Error: {e}")
            return None
