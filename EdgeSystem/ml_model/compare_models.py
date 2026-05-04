import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import classification_report, f1_score, recall_score
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.model_selection import train_test_split
import os

def run_comparison():
    data_path = r"c:\Surge\SurgeAlert\EdgeSystem\ml_model\flood_dataset.csv"
    df = pd.read_csv(data_path)
    
    # Feature Engineering (Standard)
    if 'Soil_Moisture' not in df.columns: df['Soil_Moisture'] = 0.5
    if 'sensor_rise_rate' not in df.columns: df['sensor_rise_rate'] = 0.0
    if 'water_level' not in df.columns:
        df['water_level'] = (df['QC_Rain_mm'] * 0.3) + (df['QC_6hr_Sum'] * 0.1) + \
                            (df['Mar_24hr_Sum'] * 0.2) + (df['Tide_Height_m'] * 0.4) + \
                            np.random.normal(0, 0.05, len(df))
        df['water_level'] = df['water_level'].clip(lower=0.5, upper=8.0)
        df['rise_rate'] = df['water_level'].diff().fillna(0)
    for col in ['Wind_Sin', 'Wind_Cos', 'Tide_Trend', 'Press_Trend']:
        if col not in df.columns: df[col] = 0.0

    feature_cols = [
        'Month', 'Hour', 'water_level', 'rise_rate', 'sensor_rise_rate',
        'Tide_Height_m', 'Tide_Trend', 'Pressure_hPa', 'Press_Trend',
        'Wind_Speed', 'Wind_Sin', 'Wind_Cos', 'Soil_Moisture',
        'QC_Rain_mm', 'QC_Rain_Lag1', 'QC_Rain_Lag2', 'QC_3hr_Sum', 'QC_6hr_Sum',
        'Marulas_Rain_mm', 'Mar_Rain_Lag1', 'Mar_Rain_Lag2', 'Mar_3hr_Sum', 'Mar_24hr_Sum'
    ]

    X = df[feature_cols]
    y = df['Target_Alert_Class'].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    # Calculate Balanced Weights
    sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)

    # Train Base Model
    model = xgb.XGBClassifier(n_estimators=400, max_depth=7, learning_rate=0.05, objective='multi:softprob', num_class=3, random_state=42)
    model.fit(X_train, y_train, sample_weight=sample_weights)

    # 1. EVALUATE BALANCED MODEL (Standard Predict)
    y_pred_bal = model.predict(X_test)
    
    # 2. EVALUATE SAFETY-FIRST MODEL (Low Thresholds)
    probs = model.predict_proba(X_test)
    y_pred_safe = np.zeros(len(probs), dtype=int)
    for i, p in enumerate(probs):
        if p[2] > 0.0002: y_pred_safe[i] = 2
        elif p[1] > 0.001: y_pred_safe[i] = 1
        else: y_pred_safe[i] = 0

    print("\n" + "="*50)
    print("SURGE-ALERT PERFORMANCE COMPARISON")
    print("="*50)
    
    print("\n[MODEL A] BALANCED CONFIGURATION (Current Model)")
    print(f"Overall Recall (Macro): {recall_score(y_test, y_pred_bal, average='macro'):.2%}")
    print(f"Overall F1-Score (Macro): {f1_score(y_test, y_pred_bal, average='macro'):.2%}")
    print("-" * 30)
    report_bal = classification_report(y_test, y_pred_bal, output_dict=True, zero_division=0)
    print(f"Class 2 (Severe) Recall: {report_bal['2']['recall']:.2%}")
    print(f"Class 2 (Severe) F1-Score: {report_bal['2']['f1-score']:.2%}")

    print("\n[MODEL B] SAFETY-FIRST CONFIGURATION (The 85% Accuracy version)")
    print(f"Overall Recall (Macro): {recall_score(y_test, y_pred_safe, average='macro'):.2%}")
    print(f"Overall F1-Score (Macro): {f1_score(y_test, y_pred_safe, average='macro'):.2%}")
    print("-" * 30)
    report_safe = classification_report(y_test, y_pred_safe, output_dict=True, zero_division=0)
    print(f"Class 2 (Severe) Recall: {report_safe['2']['recall']:.2%}")
    print(f"Class 2 (Severe) F1-Score: {report_safe['2']['f1-score']:.2%}")
    print("="*50)

if __name__ == "__main__":
    run_comparison()
