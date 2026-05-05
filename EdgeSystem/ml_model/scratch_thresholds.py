import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import recall_score, f1_score
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE
import os

def find_sweet_spot():
    data_path = r"c:\Surge\SurgeAlert\EdgeSystem\ml_model\flood_dataset.csv"
    df = pd.read_csv(data_path)
    
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

    smote = SMOTE(random_state=42, k_neighbors=3)
    X_train_smote, y_train_smote = smote.fit_resample(X_train, y_train)

    model = xgb.XGBClassifier(n_estimators=400, max_depth=7, learning_rate=0.05, objective='multi:softprob', num_class=3, random_state=42)
    model.fit(X_train_smote, y_train_smote)

    probs = model.predict_proba(X_test)

    # Standard prediction (argmax)
    y_pred = model.predict(X_test)
    
    rec = recall_score(y_test, y_pred, average='macro', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='macro', zero_division=0)
    
    print(f"Base SMOTE -> Macro Recall: {rec:.2%}, Macro F1: {f1:.2%}")
    print(classification_report(y_test, y_pred, zero_division=0))

if __name__ == "__main__":
    find_sweet_spot()
