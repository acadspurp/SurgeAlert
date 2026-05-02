import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
import os
import sys

# Add parent directory to path to verify paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import MODEL_PATH, MODEL_DIR

def generate_synthetic_data(n_samples=5000):
    """
    Generates synthetic training data based on river physics.
    Features: Water Level, Flow Rate, Rise Rate.
    Target: Water Level in 1 Hour.
    """
    print("--- Generating Synthetic Data ---")
    np.random.seed(42)
    
    # 1. INPUTS (Features)
    # Current Water Level (0 to 8 meters)
    water_levels = np.random.uniform(0.0, 8.0, n_samples) 
    
    # Flow Rate (0 to 5 m/s). Higher water usually means faster flow.
    flow_rates = (water_levels * 0.5) + np.random.normal(0, 0.5, n_samples)
    flow_rates = np.clip(flow_rates, 0.0, 6.0) 
    
    # Rise Rate (-0.5 m/s to +0.5 m/s). 
    rise_rates = np.random.uniform(-0.2, 0.4, n_samples)

    # 2. TARGET (Label)
    # Physics Logic: Future Level = Current + (RiseRate * Time) + (FlowSurgeFactor)
    # We predict for 1 Hour (3600 seconds) into the future.
    time_interval = 3600 
    
    # We dampen the rise_rate effect (0.8) because rise rate rarely stays constant for an hour.
    future_levels = water_levels + (rise_rates * time_interval * 0.8) + (flow_rates * 0.05)
    
    # Clamp values (Water can't be negative, assuming max river height is 12m)
    future_levels = np.clip(future_levels, 0.0, 12.0)

    # Create DataFrame
    df = pd.DataFrame({
        'water_level': water_levels,
        'flow_rate': flow_rates,
        'rise_rate': rise_rates,
        'future_level': future_levels # TARGET
    })
    
    print(f"Generated {n_samples} samples.")
    return df

def train_and_save_model():
    # 1. Get Data
    df = generate_synthetic_data()
    
    # 2. Split Features (X) and Target (y)
    # IMPORTANT: These column names must match the input in alert_manager.py
    feature_cols = ['water_level', 'flow_rate', 'rise_rate']
    X = df[feature_cols]
    y = df['future_level']
    
    # 3. Split into Train and Test sets (80% train, 20% test)
    print("--- Training Random Forest Regressor ---")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 4. Initialize and Train Model
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # 5. Evaluate
    accuracy = model.score(X_test, y_test)
    print(f"Model Accuracy (R^2 Score): {accuracy:.4f}")
    
    # 6. Save Model
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        print(f"Created directory: {MODEL_DIR}")
        
    joblib.dump(model, MODEL_PATH)
    print(f"SUCCESS: Model saved to {MODEL_PATH}")

if __name__ == "__main__":
    train_and_save_model()