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

    def determine_alert_level(self, water_level):
        """
        Rule-Based Logic: Determines the alert level (color) based on strict thresholds.
        Args: water_level (float)
        Returns: str ('GREEN', 'YELLOW', 'ORANGE', 'RED')
        """
        if water_level is None:
            return "GREEN"
            
        if water_level >= WATER_LEVEL_RED_THRESHOLD:
            return "RED"
        elif water_level >= WATER_LEVEL_ORANGE_THRESHOLD:
            return "ORANGE"
        elif water_level >= WATER_LEVEL_YELLOW_THRESHOLD:
            return "YELLOW"
        else:
            return "GREEN"

    def predict_future_level(self, current_level, flow_rate, rise_rate):
        """
        AI Logic: Predicts water level 1 hour into the future.
        Input order must match train_model.py: [water_level, flow_rate, rise_rate]
        """
        # Fallback if model failed to load
        if self.model is None:
            return current_level

        try:
            # Prepare input vector
            features = np.array([[current_level, flow_rate, rise_rate]])
            
            # Predict
            predicted_level = self.model.predict(features)[0]
            
            # Safety clamp: Water level cannot be negative
            return max(0.0, float(predicted_level))
            
        except Exception as e:
            print(f" [AI] Prediction Error: {e}")
            return current_level