"""
Retrain XGBoost alert classifier from Render Postgres (sensor_data + ml_features_realtime).
Writes flood_prediction_model.joblib and model_version.json to --output-dir (default data/models).
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from imblearn.over_sampling import SMOTE
from sklearn.metrics import accuracy_score, classification_report, f1_score, recall_score
from sklearn.model_selection import train_test_split

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FEATURE_COLUMNS = [
    "water_level",
    "rise_rate_mps",
    "tide_height_m",
    "qc_rain_mm",
    "qc_lag1",
    "qc_lag2",
    "marulas_rain_mm",
    "mar_lag1",
    "mar_lag2",
    "mar_3hr_sum",
    "mar_6hr_sum",
    "mar_24hr_sum",
    "pressure_hpa",
    "wind_speed",
    "soil_moisture",
]


def _parse_database_url():
    raw = os.getenv("SPRING_DATASOURCE_URL") or os.getenv("DATABASE_URL") or os.getenv("JDBC_DATABASE_URL")
    if not raw:
        return None
    if raw.startswith("jdbc:postgresql:"):
        raw = raw.replace("jdbc:postgresql:", "postgresql:", 1)
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    return raw


def _load_training_frame(conn_url, days=90):
    import sqlalchemy

    engine = sqlalchemy.create_engine(conn_url)
    query = f"""
        SELECT
            s.time AS ts,
            s.water_level,
            s.rise_rate AS rise_rate,
            s.current_alert_level,
            m."Tide_Height_m" AS tide_height_m,
            m."QC_Rain_mm" AS qc_rain_mm,
            m."QC_Rain_Lag1" AS qc_lag1,
            m."QC_Rain_Lag2" AS qc_lag2,
            m."Marulas_Rain_mm" AS marulas_rain_mm,
            m."Mar_Rain_Lag1" AS mar_lag1,
            m."Mar_Rain_Lag2" AS mar_lag2,
            m."Mar_3hr_Sum" AS mar_3hr_sum,
            m."Mar_6hr_Sum" AS mar_6hr_sum,
            m."Mar_24hr_Sum" AS mar_24hr_sum,
            m."Pressure_hPa" AS pressure_hpa,
            m."Wind_Speed" AS wind_speed,
            m."Soil_Moisture" AS soil_moisture
        FROM sensor_data s
        LEFT JOIN LATERAL (
            SELECT *
            FROM ml_features_realtime m
            WHERE m.time <= s.time
            ORDER BY m.time DESC
            LIMIT 1
        ) m ON TRUE
        WHERE s.time >= NOW() - INTERVAL '{int(days)} days'
          AND s.water_level IS NOT NULL
          AND s.water_level >= 0.1
        ORDER BY s.time ASC
    """
    df = pd.read_sql(query, engine)
    engine.dispose()
    return df


def _label_from_level(wl, yellow=3.5, orange=4.5, red=5.5):
    if wl >= red:
        return 3
    if wl >= orange:
        return 2
    if wl >= yellow:
        return 1
    return 0


def train_and_save(df, output_dir, min_rows=80):
    if len(df) < min_rows:
        raise RuntimeError(f"Not enough rows to retrain ({len(df)} < {min_rows})")

    out = pd.DataFrame()
    out["water_level"] = df["water_level"].astype(float)
    out["rise_rate_mps"] = (df["rise_rate"].astype(float) / 3600.0).fillna(0.0)
    out["tide_height_m"] = df["tide_height_m"].fillna(0.0).astype(float)
    out["qc_rain_mm"] = df["qc_rain_mm"].fillna(0.0).astype(float)
    out["qc_lag1"] = df["qc_lag1"].fillna(0.0).astype(float)
    out["qc_lag2"] = df["qc_lag2"].fillna(0.0).astype(float)
    out["marulas_rain_mm"] = df["marulas_rain_mm"].fillna(0.0).astype(float)
    out["mar_lag1"] = df["mar_lag1"].fillna(0.0).astype(float)
    out["mar_lag2"] = df["mar_lag2"].fillna(0.0).astype(float)
    out["mar_3hr_sum"] = df["mar_3hr_sum"].fillna(0.0).astype(float)
    out["mar_6hr_sum"] = df["mar_6hr_sum"].fillna(0.0).astype(float)
    out["mar_24hr_sum"] = df["mar_24hr_sum"].fillna(0.0).astype(float)
    out["pressure_hpa"] = df["pressure_hpa"].fillna(1013.0).astype(float)
    out["wind_speed"] = df["wind_speed"].fillna(0.0).astype(float)
    out["soil_moisture"] = df["soil_moisture"].fillna(0.0).astype(float)

    y = out["water_level"].apply(_label_from_level).astype(int)
    X = out[FEATURE_COLUMNS]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    smote = SMOTE(random_state=42, k_neighbors=min(3, max(1, y_train.value_counts().min() - 1)))
    X_train, y_train = smote.fit_resample(X_train, y_train)

    model = xgb.XGBClassifier(
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        num_class=4,
        random_state=42,
    )
    model.fit(X_train, y_train)

    probs = model.predict_proba(X_test)
    y_pred = np.zeros(len(probs), dtype=int)
    for i, p in enumerate(probs):
        if p[3] > 0.15:
            y_pred[i] = 3
        elif p[2] > 0.02:
            y_pred[i] = 2
        elif p[1] > 0.05:
            y_pred[i] = 1
        else:
            y_pred[i] = 0

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "macro_recall": float(recall_score(y_test, y_pred, average="macro", zero_division=0)),
        "macro_f1": float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        "rows": int(len(df)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    print(classification_report(y_test, y_pred, zero_division=0))

    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, "flood_prediction_model.joblib")
    joblib.dump(model, model_path)

    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    meta_path = os.path.join(output_dir, "model_version.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"version": version, "metrics": metrics}, f, indent=2)

    print(f"Saved model → {model_path} (version {version})")
    return version, metrics


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=os.path.join(os.path.dirname(__file__), "..", "..", "data", "models"))
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--min-rows", type=int, default=80)
    args = parser.parse_args()

    conn = _parse_database_url()
    if not conn:
        print("ERROR: Set DATABASE_URL or SPRING_DATASOURCE_URL")
        sys.exit(1)

    try:
        import sqlalchemy  # noqa: F401
    except ImportError:
        print("ERROR: pip install sqlalchemy psycopg2-binary")
        sys.exit(1)

    df = _load_training_frame(conn, days=args.days)
    train_and_save(df, os.path.abspath(args.output_dir), min_rows=args.min_rows)


if __name__ == "__main__":
    main()
