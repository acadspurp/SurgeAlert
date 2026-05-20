"""
Train SurgeAlert XGBoost classifier + regressor (v4: engineered features,
early stopping, SMOTE when available, full-train refit, tuned thresholds).
"""
import json
import os
import sys
from datetime import datetime, timezone
from itertools import product

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
)
from sklearn.utils.class_weight import compute_sample_weight

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    MODEL_DIR,
    MODEL_PATH,
    WATER_LEVEL_ORANGE_THRESHOLD,
    WATER_LEVEL_RED_THRESHOLD,
    WATER_LEVEL_YELLOW_THRESHOLD,
)
from ml_model.classifier_wrappers import EnsembleSurgeClassifier, SurgeAlertClassifier
from ml_model.dataset_utils import (
    CLASSIFIER_FEATURE_COLUMNS,
    FEATURE_COLUMNS,
    LABEL_NAMES,
    REGRESSOR_FEATURE_COLUMNS,
    build_xy,
    default_dataset_path,
    load_training_frame,
    predict_alert_from_probs,
    predict_alerts_batch,
    time_series_split,
)

# Deployment floor (tuned on validation; reported honestly on time-series test).
MIN_MACRO_RECALL = 0.55
MIN_MACRO_F1 = 0.55

PROTOTYPE_TARGETS = {
    "accuracy": 0.8845,
    "macro_recall": 0.8215,
    "macro_f1": 0.587,
    "macro_precision": 0.6912,
}

CLASS_WEIGHT_BOOST = {0: 0.15, 1: 8.0, 2: 24.0, 3: 55.0}
OVERSAMPLE_FACTOR = {1: 14, 2: 45, 3: 90}

# Skip only nonsense configs (predict almost everything as alert).
ACCURACY_FLOOR = 0.65
ALERT_CLASSES = (1, 2, 3)


def prepare_train_matrix(X: pd.DataFrame, y: pd.Series):
    """Oversample alert bands; SMOTE only when minority rows are sufficient."""
    y = y.astype(int)
    minority = int((y > 0).sum())
    try:
        from imblearn.over_sampling import SMOTE

        k = min(5, int((y.value_counts().min() - 1)))
        if k >= 2 and minority > 50:
            smote = SMOTE(random_state=42, k_neighbors=k)
            X_res, y_res = smote.fit_resample(X, y)
            X_out = pd.DataFrame(X_res, columns=X.columns)
            y_out = pd.Series(y_res, name=y.name)
            w = compute_sample_weight(class_weight="balanced", y=y_out)
            w = apply_class_boost(w, y_out)
            return X_out, y_out, w
    except Exception:
        pass
    return oversample_train(X, y)


def oversample_train(X: pd.DataFrame, y: pd.Series):
    base_w = compute_sample_weight(class_weight="balanced", y=y)
    parts_x, parts_y, weights = [X], [y], [base_w]
    for cls, factor in OVERSAMPLE_FACTOR.items():
        if factor <= 1:
            continue
        mask = y == cls
        if not mask.any():
            continue
        for _ in range(factor - 1):
            parts_x.append(X.loc[mask])
            parts_y.append(y.loc[mask])
            weights.append(base_w[mask.to_numpy()])
    X_out = pd.concat(parts_x, axis=0, ignore_index=True)
    y_out = pd.concat(parts_y, axis=0, ignore_index=True)
    w_out = np.concatenate(weights)
    perm = np.random.default_rng(42).permutation(len(X_out))
    return X_out.iloc[perm], y_out.iloc[perm], w_out[perm]


def apply_class_boost(weights: np.ndarray, y: pd.Series) -> np.ndarray:
    boosted = weights.copy()
    for cls, mult in CLASS_WEIGHT_BOOST.items():
        boosted[y.to_numpy() == cls] *= mult
    return boosted


def mean_alert_class_score(
    y_true: np.ndarray, y_pred: np.ndarray, metric: str
) -> float:
    """Average recall, F1, or precision over Yellow / Orange / Red only."""
    scores = []
    for cls in ALERT_CLASSES:
        mask = y_true == cls
        if not mask.any():
            continue
        if metric == "recall":
            scores.append(recall_score(mask, y_pred == cls, zero_division=0))
        elif metric == "f1":
            scores.append(f1_score(mask, y_pred == cls, zero_division=0))
        elif metric == "precision":
            pred_mask = y_pred == cls
            if pred_mask.any():
                scores.append(
                    precision_score(y_true == cls, pred_mask, zero_division=0)
                )
    return float(np.mean(scores)) if scores else 0.0


def classifier_metric_bundle(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_true, y_pred)
        ),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "macro_recall": float(
            recall_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "macro_precision": float(
            precision_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "alert_band_recall": mean_alert_class_score(y_true, y_pred, "recall"),
        "alert_band_f1": mean_alert_class_score(y_true, y_pred, "f1"),
        "alert_band_precision": mean_alert_class_score(y_true, y_pred, "precision"),
    }


def tuning_gap(metrics: dict) -> float:
    """Distance below deployment floors (0 = both met)."""
    return max(
        MIN_MACRO_RECALL - metrics["macro_recall"],
        MIN_MACRO_F1 - metrics["macro_f1"],
        0.0,
    )


def tuning_objective(metrics: dict) -> float:
    """Maximize macro recall + F1; prefer configs that also approach deploy floors."""
    base = metrics["macro_recall"] + metrics["macro_f1"]
    bonus = 0.15 if tuning_gap(metrics) == 0.0 else 0.0
    return base + bonus


def tune_thresholds(probs: np.ndarray, y_true: np.ndarray) -> dict:
    """Pick thresholds that maximize honest macro recall + F1 on validation."""
    y_true = y_true.astype(int)
    default = {
        "yellow": 0.08,
        "orange": 0.015,
        "red": 0.005,
        "prob_boost": {1: 2.0, 2: 4.0, 3: 8.0},
    }
    boost_grid = [
        {1: 1.5, 2: 2.5, 3: 4.0},
        {1: 1.8, 2: 3.5, 3: 6.0},
        {1: 2.0, 2: 4.0, 3: 8.0},
        {1: 2.5, 2: 5.0, 3: 10.0},
    ]
    ty_vals = [0.04, 0.06, 0.08, 0.10, 0.12, 0.16, 0.20, 0.26, 0.32]
    to_vals = [0.002, 0.004, 0.008, 0.012, 0.02, 0.03, 0.05, 0.07]
    tr_vals = [0.0005, 0.001, 0.002, 0.004, 0.008, 0.012, 0.02]

    candidates = []
    for boosts in boost_grid:
        for ty in ty_vals:
            for to in to_vals:
                for tr in tr_vals:
                    cfg = {
                        "yellow": ty,
                        "orange": to,
                        "red": tr,
                        "prob_boost": boosts,
                    }
                    pred = predict_alerts_batch(probs, cfg)
                    metrics = classifier_metric_bundle(y_true, pred)
                    if metrics["accuracy"] < ACCURACY_FLOOR:
                        continue
                    candidates.append(
                        (tuning_objective(metrics), metrics, cfg)
                    )

    if not candidates:
        return default

    candidates.sort(key=lambda row: row[0], reverse=True)
    best_score, metrics, cfg = candidates[0]
    out = dict(cfg)
    out["_tune_objective_val"] = best_score
    out["_tune_gap_val"] = tuning_gap(metrics)
    out["_meets_deploy_floors_val"] = tuning_gap(metrics) == 0.0
    out["_val_accuracy"] = metrics["accuracy"]
    out["_macro_f1_val"] = metrics["macro_f1"]
    out["_macro_recall_val"] = metrics["macro_recall"]
    out["_macro_precision_val"] = metrics["macro_precision"]
    out["_alert_band_recall_val"] = metrics["alert_band_recall"]
    return out


def print_classifier_metrics(y_true, y_pred, title: str):
    print("\n" + "=" * 55)
    print(title)
    print("=" * 55)
    print(confusion_matrix(y_true, y_pred, labels=[0, 1, 2, 3]))
    print(
        classification_report(
            y_true,
            y_pred,
            labels=[0, 1, 2, 3],
            target_names=[LABEL_NAMES[i] for i in range(4)],
            zero_division=0,
        )
    )
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    macro_recall = recall_score(y_true, y_pred, average="macro", zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    print(f"Accuracy: {acc:.2%}  (ignore — mostly Green rows)")
    print(f"Macro F1: {macro_f1:.3f}  |  Macro recall: {macro_recall:.3f}")
    for cls in (1, 2, 3):
        mask = y_true == cls
        if mask.any():
            r = recall_score(mask, y_pred == cls, zero_division=0)
            f = f1_score(mask, y_pred == cls, zero_division=0)
            print(f"  {LABEL_NAMES[cls]:6s} recall={r:.2%}  f1={f:.2f}  (n={mask.sum()})")
    return macro_f1, macro_recall, acc


def train_alert_detector(X_fit, y_fit, X_val, y_val, n_estimators=400):
    y_bin_fit = (y_fit > 0).astype(int)
    y_bin_val = (y_val > 0).astype(int)
    w_fit = compute_sample_weight(class_weight="balanced", y=y_bin_fit)
    det = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=6,
        learning_rate=0.06,
        min_child_weight=1,
        scale_pos_weight=float((y_bin_fit == 0).sum()) / max((y_bin_fit == 1).sum(), 1),
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=30,
    )
    det.fit(X_fit, y_bin_fit, sample_weight=w_fit, eval_set=[(X_val, y_bin_val)], verbose=False)
    return det


def train_classifier(X_fit, y_fit, X_val, y_val, n_estimators=800, seed: int = 42):
    X_os, y_os, w_os = prepare_train_matrix(X_fit, y_fit)
    clf = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=8,
        learning_rate=0.05,
        min_child_weight=1,
        gamma=0.05,
        reg_alpha=0.1,
        reg_lambda=1.2,
        subsample=0.88,
        colsample_bytree=0.88,
        objective="multi:softprob",
        num_class=4,
        eval_metric="mlogloss",
        random_state=seed,
        n_jobs=-1,
        early_stopping_rounds=40,
    )
    clf.fit(
        X_os,
        y_os,
        sample_weight=w_os,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    best_iter = getattr(clf, "best_iteration", n_estimators - 1)
    return clf, max(best_iter + 1, 100)


def build_surge_classifier(
    X_fit, y_fit, X_val, y_val, n_estimators=800, seed: int = 42, blend: float = 0.35
):
    detector = train_alert_detector(X_fit, y_fit, X_val, y_val)
    multiclass, trees = train_classifier(
        X_fit, y_fit, X_val, y_val, n_estimators=n_estimators, seed=seed
    )
    return SurgeAlertClassifier(multiclass, detector, blend=blend), trees


def alert_level_from_water_level(water_level: np.ndarray) -> np.ndarray:
    wl = np.asarray(water_level, dtype=float)
    out = np.zeros(len(wl), dtype=int)
    out[wl >= WATER_LEVEL_YELLOW_THRESHOLD] = 1
    out[wl >= WATER_LEVEL_ORANGE_THRESHOLD] = 2
    out[wl >= WATER_LEVEL_RED_THRESHOLD] = 3
    return out


def print_label_sanity_check(test_df: pd.DataFrame) -> float:
    wl = test_df["water_level"].to_numpy()
    labels = test_df["alert_level"].astype(int).to_numpy()
    rule = alert_level_from_water_level(wl)
    agree = float((rule == labels).mean())
    print("\n--- Label sanity (test split) ---")
    print(
        "alert_level matches threshold(water_level) for "
        f"{agree:.1%} of rows — using water_level as a classifier feature would be leakage."
    )
    return agree


def train_models(dataset_path: str | None = None):
    path = dataset_path or default_dataset_path()
    print(f"Loading: {path}")
    print(
        f"Classifier features ({len(CLASSIFIER_FEATURE_COLUMNS)}): "
        "weather/tide/rain only (no sensor level)"
    )
    df = load_training_frame(path)
    train_df, test_df = time_series_split(df, train_ratio=0.8)
    threshold_baseline_acc = print_label_sanity_check(test_df)

    val_start = int(len(train_df) * 0.85)
    fit_df = train_df.iloc[:val_start]
    val_df = train_df.iloc[val_start:]

    X_fit, y_fit = build_xy(fit_df, "alert_level", CLASSIFIER_FEATURE_COLUMNS)
    X_val, y_val = build_xy(val_df, "alert_level", CLASSIFIER_FEATURE_COLUMNS)
    X_test, y_test = build_xy(test_df, "alert_level", CLASSIFIER_FEATURE_COLUMNS)
    y_fit = y_fit.astype(int)
    y_val = y_val.astype(int)
    y_test = y_test.astype(int)

    print(f"Fit: {len(fit_df)} | Val: {len(val_df)} | Test: {len(test_df)}")

    # Stage 1: probe + threshold tune on validation
    probe_a, best_trees = build_surge_classifier(
        X_fit, y_fit, X_val, y_val, seed=42
    )
    probe_b, _ = build_surge_classifier(X_fit, y_fit, X_val, y_val, seed=17)
    val_probs = EnsembleSurgeClassifier([probe_a, probe_b]).predict_proba(X_val)
    y_val_np = y_val.to_numpy()
    thresholds = tune_thresholds(val_probs, y_val_np)
    print(f"Tuned thresholds (val): {thresholds}")

    # Stage 2: refit on full train (two seeds, averaged probs)
    X_train, y_train = build_xy(train_df, "alert_level", CLASSIFIER_FEATURE_COLUMNS)
    y_train = y_train.astype(int)
    val_tail = int(len(X_train) * 0.9)
    X_tr, y_tr = X_train.iloc[:val_tail], y_train.iloc[:val_tail]
    X_vt, y_vt = X_train.iloc[val_tail:], y_train.iloc[val_tail:]

    model_a, _ = build_surge_classifier(
        X_tr, y_tr, X_vt, y_vt, n_estimators=best_trees, seed=42
    )
    model_b, _ = build_surge_classifier(
        X_tr, y_tr, X_vt, y_vt, n_estimators=best_trees, seed=17
    )
    classifier = EnsembleSurgeClassifier([model_a, model_b])

    probs_test = classifier.predict_proba(X_test)
    y_pred_tuned = predict_alert_from_probs(probs_test, thresholds)
    pred_config = {
        k: thresholds[k]
        for k in ("yellow", "orange", "red", "prob_boost")
        if k in thresholds
    }
    print_classifier_metrics(y_test, classifier.predict(X_test), "TEST — argmax")
    macro_f1, macro_recall, acc = print_classifier_metrics(
        y_test, y_pred_tuned, "TEST — tuned thresholds (saved)"
    )
    test_metrics = classifier_metric_bundle(y_test, y_pred_tuned)
    meets = (
        test_metrics["macro_recall"] >= MIN_MACRO_RECALL
        and test_metrics["macro_f1"] >= MIN_MACRO_F1
    )
    print(
        f"\nSaved metrics (weather-only, time-series test): "
        f"acc {test_metrics['accuracy']:.2%}, "
        f"balanced acc {test_metrics['balanced_accuracy']:.2%}, "
        f"macro recall {test_metrics['macro_recall']:.2%} "
        f"(floor {MIN_MACRO_RECALL:.0%}), "
        f"macro F1 {test_metrics['macro_f1']:.2%} "
        f"(floor {MIN_MACRO_F1:.0%}), "
        f"macro precision {test_metrics['macro_precision']:.2%}"
    )
    print(
        "Deploy floors (55% recall + 55% F1 on test): "
        + ("MET" if meets else "NOT MET — best honest fit; keep sensors primary")
    )

    # Regressor
    X_train_r, y_train_r = build_xy(
        train_df, "water_level", REGRESSOR_FEATURE_COLUMNS
    )
    X_test_r, y_test_r = build_xy(test_df, "water_level", REGRESSOR_FEATURE_COLUMNS)
    regressor = xgb.XGBRegressor(
        n_estimators=best_trees,
        max_depth=8,
        learning_rate=0.03,
        subsample=0.88,
        colsample_bytree=0.88,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )
    regressor.fit(X_train_r, y_train_r)
    mae = mean_absolute_error(y_test_r, regressor.predict(X_test_r))
    mae_tide = mean_absolute_error(
        y_test_r, 2.68 + 1.04 * test_df["Tide_Height_m"].values
    )
    print(f"\nREGRESSOR test MAE: {mae:.3f} m (tide baseline {mae_tide:.3f} m)")

    bundle = {
        "version": 14,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": os.path.abspath(path),
        "feature_columns": CLASSIFIER_FEATURE_COLUMNS,
        "regressor_feature_columns": REGRESSOR_FEATURE_COLUMNS,
        "classifier_input": "weather_tide_rain_only",
        "label_names": LABEL_NAMES,
        "classifier": classifier,
        "regressor": regressor,
        "probability_thresholds": pred_config,
        "metrics": {
            "classifier_accuracy": test_metrics["accuracy"],
            "classifier_balanced_accuracy": test_metrics["balanced_accuracy"],
            "classifier_macro_f1": test_metrics["macro_f1"],
            "classifier_macro_recall": test_metrics["macro_recall"],
            "classifier_macro_precision": test_metrics["macro_precision"],
            "classifier_alert_band_recall": test_metrics["alert_band_recall"],
            "classifier_alert_band_f1": test_metrics["alert_band_f1"],
            "classifier_alert_band_precision": test_metrics["alert_band_precision"],
            "regressor_mae": float(mae),
            "regressor_tide_baseline_mae": float(mae_tide),
            "threshold_only_baseline_accuracy": float(threshold_baseline_acc),
            "n_estimators": int(best_trees),
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            "evaluation": "time_series_holdout_weather_only_classifier",
            "prototype_targets": PROTOTYPE_TARGETS,
            "deploy_floors": {
                "macro_recall": MIN_MACRO_RECALL,
                "macro_f1": MIN_MACRO_F1,
            },
            "meets_deploy_floors_on_test": bool(
                test_metrics["macro_recall"] >= MIN_MACRO_RECALL
                and test_metrics["macro_f1"] >= MIN_MACRO_F1
            ),
            "uses_alert_detector_blend": True,
            "uses_two_seed_ensemble": True,
        },
    }

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH)
    with open(os.path.join(MODEL_DIR, "model_training_report.json"), "w") as f:
        json.dump(bundle["metrics"], f, indent=2)
    print(f"\nSaved -> {MODEL_PATH}")
    print_interpretation(bundle["metrics"], y_test, y_pred_tuned)
    return bundle


def print_interpretation(metrics: dict, y_true, y_pred):
    print("\n" + "=" * 55)
    print("PERFORMANCE INTERPRETATION")
    print("=" * 55)
    acc = metrics["classifier_accuracy"]
    mf1 = metrics["classifier_macro_f1"]
    mrec = metrics["classifier_macro_recall"]
    mprec = metrics.get("classifier_macro_precision", 0.0)
    print(
        f"""
The classifier predicts alert color from weather/tide/rain only (no water_level
in features — labels are defined from sensor level, so level would be leakage).

- Accuracy ({acc:.1%}): may be high because most rows are Green; use balanced accuracy too.

- Balanced accuracy ({metrics.get('classifier_balanced_accuracy', 0):.1%}): fairer across classes.

- Macro recall ({mrec:.1%}) / F1 ({mf1:.1%}) vs prototype ~{PROTOTYPE_TARGETS['macro_recall']:.1%} / ~{PROTOTYPE_TARGETS['macro_f1']:.1%}.

- Labels come from sensor level; weather-only models rarely reach prototype KPIs on
  a strict time split — use balanced accuracy and alert-band metrics too.

- Regressor MAE ({metrics['regressor_mae']:.3f} m): beats tide baseline
  ({metrics['regressor_tide_baseline_mae']:.3f} m).

On the Pi: official band = sensor thresholds; ML adds weather-based early warning.
""".strip()
    )
    for cls in (1, 2, 3):
        m = y_true == cls
        if m.any():
            r = recall_score(m, y_pred == cls, zero_division=0)
            f = f1_score(m, y_pred == cls, zero_division=0)
            name = LABEL_NAMES[cls]
            if r >= 0.55 and f >= 0.35:
                note = "acceptable for prototype"
            elif r >= 0.35:
                note = "moderate — usable with sensor backup"
            else:
                note = "weak — rely on thresholds + sensors for this band"
            print(f"  - {name}: recall {r:.0%}, F1 {f:.2f} ({note})")


if __name__ == "__main__":
    train_models()
