import joblib
import os
import numpy as np
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    MODEL_PATH, 
    WATER_LEVEL_YELLOW_THRESHOLD, 
    WATER_LEVEL_ORANGE_THRESHOLD, 
    WATER_LEVEL_RED_THRESHOLD
)

class AlertManager:
    def __init__(self):
        """
        Initializes the AlertManager and attempts to load the AI model.
        """
        self.model = None
        self.load_model()

    def reload_model(self):
        """Reload after OTA model download from backend."""
        self.load_model()

    def load_model(self):
        """Loads the .joblib model from the path defined in settings.py."""
        print(f" [AI] Attempting to load model from: {MODEL_PATH}")
        try:
            if os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                print(" [AI] SUCCESS: Flood Prediction Model Loaded.")
            else:
                print(" [AI] WARNING: Model file not found.")
                print("      Please run 'python -m ml_model.train_model' first.")
                self.model = None
        except Exception as e:
            print(f" [AI] CRITICAL ERROR loading model: {e}")
            self.model = None

    def determine_alert_level(self, water_level, predicted_level=None, rise_rate_per_hour=0.0):
        """
        Intelligent Alert Logic:
        1. CRITICAL: Physical overflow OR predicted overflow within 1 hour.
        2. RED: Dangerously high levels (90%+) OR predicted danger + rising tide.
        3. ORANGE: Moderate levels (74%+) OR extremely fast rise rate (Flash Flood).
        """
        if water_level is None:
            return "GREEN"
            
        # --- LEVEL 4: RED ---
        # High Risk stage.
        if water_level >= WATER_LEVEL_RED_THRESHOLD:
            return "RED"
        
        if predicted_level is not None and predicted_level >= WATER_LEVEL_RED_THRESHOLD: 
             return "RED"
        
        # --- FLASH FLOOD & TIDE MOMENTUM ESCALATION ---
        # If water is rising very fast (>0.5m per hour) and we are already at Orange, jump to Red.
        if rise_rate_per_hour >= 0.5 and water_level >= WATER_LEVEL_ORANGE_THRESHOLD:
            return "RED"

        # --- LEVEL 3: ORANGE ---
        if water_level >= WATER_LEVEL_ORANGE_THRESHOLD:
            return "ORANGE"
            
        # --- LEVEL 2: YELLOW ---
        if water_level >= WATER_LEVEL_YELLOW_THRESHOLD or rise_rate_per_hour >= 0.3:
            return "YELLOW"
            
        return "GREEN"

    def predict_alert_class(self, water_level, rise_rate_mph, tide_level,
                           qc_rain, qc_lag1, qc_lag2,
                           mar_rain, mar_lag1, mar_lag2, mar_3h, mar_6h, mar_24h,
                           pressure, wind, soil_moisture):
        """
        AI Logic: 15-feature vector (ultrasonic rise_rate only, in m/s for model input).
        Retrain with train_model.py after changing feature list.
        """
        if self.model is None:
            return None

        try:
            rise_mps = (rise_rate_mph or 0.0) / 3600.0
            features = np.array([[
                water_level, rise_mps, tide_level,
                qc_rain, qc_lag1, qc_lag2,
                mar_rain, mar_lag1, mar_lag2, mar_3h, mar_6h, mar_24h,
                pressure, wind, soil_moisture
            ]])
            
            # Predict (Returns 0, 1, 2, or 3)
            pred_index = int(self.model.predict(features)[0])
            
            # Map index back to String Levels based on user's dataset definition
            mapping = {0: "GREEN", 1: "YELLOW", 2: "ORANGE", 3: "RED"}
            return mapping.get(pred_index, "GREEN")
            
        except Exception as e:
            print(f" [AI] Prediction Error: {e}")
            return None