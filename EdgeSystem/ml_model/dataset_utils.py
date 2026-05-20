"""Load Dataset.csv and build feature matrices for SurgeAlert ML training."""
import os
import numpy as np
import pandas as pd

BASE_FEATURES = [
    "Tide_Height_m",
    "Tide_Trend",
    "Pressure_hPa",
    "Press_Trend",
    "Wind_Speed",
    "Soil_Moisture",
    "QC_Rain_mm",
    "QC_Rain_Lag1",
    "QC_Rain_Lag2",
    "QC_3hr_Sum",
    "QC_6hr_Sum",
    "Marulas_Rain_mm",
    "Mar_Rain_Lag1",
    "Mar_Rain_Lag2",
    "Mar_3hr_Sum",
    "Mar_24hr_Sum",
]

CYCLICAL_FEATURES = ["Hour_sin", "Hour_cos", "Month_sin", "Month_cos"]

INTERACTION_FEATURES = [
    "Tide_x_QC3",
    "Tide_x_Mar3",
    "Wet_index",
    "Upstream_wet",
    "Rain_delta",
]

EXTRA_FEATURES = [
    "Rain_sum_now",
    "Rain_6h_blend",
    "Storm_score",
    "Low_pressure",
    "Wind_rain",
]

REGRESSOR_FEATURE_COLUMNS = (
    BASE_FEATURES + CYCLICAL_FEATURES + INTERACTION_FEATURES + EXTRA_FEATURES
)

# Classifier: weather/tide/rain only. Do NOT add water_level — alert_level is derived
# from water_level in Dataset.csv (100% rule agreement); including it is leakage.
CLASSIFIER_FEATURE_COLUMNS = REGRESSOR_FEATURE_COLUMNS

# Back-compat alias for saved bundles and AlertManager.
FEATURE_COLUMNS = CLASSIFIER_FEATURE_COLUMNS

LABEL_NAMES = {0: "GREEN", 1: "YELLOW", 2: "ORANGE", 3: "RED"}


def adjust_probs(probs, boosts: dict):
    import numpy as np

    adj = np.array(probs, dtype=float, copy=True)
    if adj.ndim == 1:
        adj = adj.reshape(1, -1)
    for idx, mult in boosts.items():
        adj[:, int(idx)] *= float(mult)
    row_sum = adj.sum(axis=1, keepdims=True)
    row_sum[row_sum <= 0] = 1.0
    return adj / row_sum


def predict_alerts_batch(probs: np.ndarray, config: dict) -> np.ndarray:
    """Vectorized threshold decode for (n, 4) probability rows."""
    adj = adjust_probs(probs, config.get("prob_boost", {1: 1.0, 2: 1.0, 3: 1.0}))
    if adj.ndim == 1:
        adj = adj.reshape(1, -1)
    t1 = float(config.get("yellow", 0.20))
    t2 = float(config.get("orange", 0.08))
    t3 = float(config.get("red", 0.03))
    p1, p2, p3 = adj[:, 1], adj[:, 2], adj[:, 3]
    pred = np.zeros(len(adj), dtype=int)
    pred[p3 >= t3] = 3
    open_mask = pred == 0
    pred[open_mask & (p2 >= t2)] = 2
    open_mask = pred == 0
    pred[open_mask & (p1 >= t1)] = 1
    open_mask = pred == 0
    if open_mask.any():
        pred[open_mask] = np.argmax(adj[open_mask], axis=1)
    return pred


def predict_alert_from_probs(probs, config: dict):
    """Apply prob boosts + sequential thresholds (config from training bundle)."""
    arr = np.asarray(probs, dtype=float)
    if arr.ndim == 1:
        return predict_alerts_batch(arr.reshape(1, -1), config)[0]
    return predict_alerts_batch(arr, config)


def default_dataset_path():
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "Dataset.csv",
    )


def add_cyclical_time(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    hour = out["Hour"].astype(float)
    month = out["Month"].astype(float)
    out["Hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    out["Hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    out["Month_sin"] = np.sin(2 * np.pi * (month - 1) / 12.0)
    out["Month_cos"] = np.cos(2 * np.pi * (month - 1) / 12.0)
    return out


def load_training_frame(path: str | None = None) -> pd.DataFrame:
    path = path or default_dataset_path()
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)

    if "alert_level" not in df.columns:
        raise ValueError("Dataset must contain alert_level column")

    if "Target_Alert_Class" in df.columns and "flood_data" not in df.columns:
        df = df.rename(columns={"Target_Alert_Class": "flood_data"})

    df = add_cyclical_time(df)
    df = add_engineered_features(df)
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["Tide_x_QC3"] = out["Tide_Height_m"] * out["QC_3hr_Sum"]
    out["Tide_x_Mar3"] = out["Tide_Height_m"] * out["Mar_3hr_Sum"]
    out["Wet_index"] = (
        out["Mar_3hr_Sum"] + 0.6 * out["QC_3hr_Sum"] + 5.0 * out["Soil_Moisture"]
    )
    out["Upstream_wet"] = out["QC_6hr_Sum"] + 0.5 * out["Mar_24hr_Sum"]
    out["Rain_delta"] = out["Mar_3hr_Sum"] - out["QC_3hr_Sum"]
    out["Rain_sum_now"] = out["QC_Rain_mm"] + out["Marulas_Rain_mm"]
    out["Rain_6h_blend"] = out["QC_6hr_Sum"] + out["Mar_3hr_Sum"]
    out["Storm_score"] = out["Wet_index"] * out["Tide_Height_m"].clip(lower=0)
    out["Low_pressure"] = (1013.0 - out["Pressure_hPa"]).clip(lower=0)
    out["Wind_rain"] = out["Wind_Speed"] * (out["QC_3hr_Sum"] + out["Mar_3hr_Sum"])
    return out


def time_series_split(df: pd.DataFrame, train_ratio: float = 0.8):
    n = len(df)
    split = int(n * train_ratio)
    train = df.iloc[:split].copy()
    test = df.iloc[split:].copy()
    return train, test


def build_xy(
    df: pd.DataFrame,
    target: str,
    feature_cols: list[str] | None = None,
):
    cols = feature_cols or FEATURE_COLUMNS
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")
    X = df[cols].astype(float)
    y = df[target]
    return X, y


def row_to_features(
    *,
    month: int,
    hour: int,
    tide_height_m: float = 0.0,
    tide_trend: float = 0.0,
    pressure_hpa: float = 1013.0,
    press_trend: float = 0.0,
    wind_speed: float = 0.0,
    soil_moisture: float = 0.0,
    qc_rain_mm: float = 0.0,
    qc_rain_lag1: float = 0.0,
    qc_rain_lag2: float = 0.0,
    qc_3hr_sum: float = 0.0,
    qc_6hr_sum: float = 0.0,
    marulas_rain_mm: float = 0.0,
    mar_rain_lag1: float = 0.0,
    mar_rain_lag2: float = 0.0,
    mar_3hr_sum: float = 0.0,
    mar_24hr_sum: float = 0.0,
    feature_columns: list[str] | None = None,
) -> np.ndarray:
    """Single-row feature vector aligned with training feature column order."""
    hour = float(hour)
    month = float(month)
    tide_x_qc3 = tide_height_m * qc_3hr_sum
    tide_x_mar3 = tide_height_m * mar_3hr_sum
    wet_index = mar_3hr_sum + 0.6 * qc_3hr_sum + 5.0 * soil_moisture
    upstream_wet = qc_6hr_sum + 0.5 * mar_24hr_sum
    rain_delta = mar_3hr_sum - qc_3hr_sum
    values = {
        "Tide_Height_m": tide_height_m,
        "Tide_Trend": tide_trend,
        "Pressure_hPa": pressure_hpa,
        "Press_Trend": press_trend,
        "Wind_Speed": wind_speed,
        "Soil_Moisture": soil_moisture,
        "QC_Rain_mm": qc_rain_mm,
        "QC_Rain_Lag1": qc_rain_lag1,
        "QC_Rain_Lag2": qc_rain_lag2,
        "QC_3hr_Sum": qc_3hr_sum,
        "QC_6hr_Sum": qc_6hr_sum,
        "Marulas_Rain_mm": marulas_rain_mm,
        "Mar_Rain_Lag1": mar_rain_lag1,
        "Mar_Rain_Lag2": mar_rain_lag2,
        "Mar_3hr_Sum": mar_3hr_sum,
        "Mar_24hr_Sum": mar_24hr_sum,
        "Hour_sin": np.sin(2 * np.pi * hour / 24.0),
        "Hour_cos": np.cos(2 * np.pi * hour / 24.0),
        "Month_sin": np.sin(2 * np.pi * (month - 1) / 12.0),
        "Month_cos": np.cos(2 * np.pi * (month - 1) / 12.0),
        "Tide_x_QC3": tide_x_qc3,
        "Tide_x_Mar3": tide_x_mar3,
        "Wet_index": wet_index,
        "Upstream_wet": upstream_wet,
        "Rain_delta": rain_delta,
        "Rain_sum_now": qc_rain_mm + marulas_rain_mm,
        "Rain_6h_blend": qc_6hr_sum + mar_3hr_sum,
        "Storm_score": wet_index * max(tide_height_m, 0.0),
        "Low_pressure": max(1013.0 - pressure_hpa, 0.0),
        "Wind_rain": wind_speed * (qc_3hr_sum + mar_3hr_sum),
    }
    cols = feature_columns or FEATURE_COLUMNS
    return np.array([[values[c] for c in cols]], dtype=float)
