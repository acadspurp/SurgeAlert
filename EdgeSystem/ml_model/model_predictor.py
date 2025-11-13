# EdgeSystem/ml_model/model_predictor.py
import joblib
import os
from config.settings import BASE_DIR

class ModelPredictor:
    def __init__(self):
        self.model = None
        model_path = os.path.join(BASE_DIR, 'ml_model', 'trained_models', 'flood_alert_model.joblib')
        
        try:
            self.model = joblib.load(model_path)
            print("AI model loaded successfully.")
        except FileNotFoundError:
            print(f"WARNING: AI model not found at {model_path}. Predictor will return default values.")
        except Exception as e:
            print(f"Error loading AI model: {e}")

    def predict(self, water_level, flow_rate, rise_rate):
        """
        Predicts the alert level using the trained AI model.
        Returns a default value if the model is not loaded.
        """
        if self.model is None:
            # If no model, we don't make a prediction.
            # The alert_manager will rely solely on its threshold logic.
            return None

        try:
            # The input should be a 2D array, so we wrap our data in a list
            # The order of features MUST match the order used during training!
            features = [[water_level, flow_rate, rise_rate]]
            
            # prediction = self.model.predict(features)
            # return prediction[0] # Return the single prediction
            
            # Placeholder until a real model is trained
            print("AI model is loaded but prediction is currently a placeholder.")
            return None

        except Exception as e:
            print(f"Error during model prediction: {e}")
            return None