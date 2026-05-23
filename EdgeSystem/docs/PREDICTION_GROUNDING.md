# Prediction grounding: sensor truth + ML features

## What we do now (no retrain) — implemented on the Pi

**File:** `alert_logic/prediction_anchor.py`, wired in `ml_model/level_predictor.py`

1. **Anchor +1h level**
   - Compute sensor projection: `current_level + rise_rate (1h) + small flow term`.
   - Blend with ML regressor output (default **35% ML / 65% sensor**).
   - Clamp to a band: floor = current + negative rise; ceiling = current + max(min uplift, rise × headroom).
   - Weather cannot jump the gauge to RED height when rise/flow are calm.

2. **Gate predicted classification**
   - ML classifier output is capped at the alert band justified by **current level, anchored +1h level, rise, and flow** (same rules as official alerts).
   - ML may stay **lower** than the cap (less aggressive); it cannot be **higher**.

3. **Official current alert** (unchanged)
   - Still driven by live ultrasonic level, rise, flow, and **anchored** predicted level for the “predicted ≥ RED” rule.

**Tune in** `config/deployment_profiles.py`:
- `prediction_anchor_min_uplift_m` (default 0.20)
- `prediction_anchor_rise_headroom_factor` (default 1.25)
- `prediction_ml_blend_weight` (default 0.35)

---

## Retraining plan (later)

**Goal:** Model learns +1h ahead with **lagged sensor + weather** features; labels remain sensor-derived without leakage.

### 1. Dataset / labels

- Build rows with **timestamp-aligned** features at `t` and target at `t + 1h`:
  - `y_level` = water_level at t+1h (from sensor_data or Dataset.csv shift).
  - `y_alert` = alert band from **that** future level (rule thresholds), not same-row level.
- Features at `t`:
  - **Sensor (ground truth):** `water_level`, `rise_rate`, `sensor_flow`, `fused_flow`, optional lags (t−5m, t−15m).
  - **Environment:** existing tide/rain/pressure/wind + engineered columns.
- **Do not** use `water_level` at t+1h as an input.

### 2. Training (`ml_model/train_model.py`)

- Regressor: minimize MAE on `y_level` with sensor + weather columns.
- Classifier: predict `y_alert` with same features; keep probability thresholds / class weights for rare RED.
- Time-series split (no random shuffle); report MAE and per-class recall on held-out weeks.
- Save bundle version bump + `regressor_feature_columns` / `classifier` columns list including sensor fields.

### 3. Edge deploy

- Remove or relax hard anchor/gate once offline eval shows anchored metrics meet floors.
- Keep anchor as safety cap (optional) with higher ML blend weight.

### 4. Validation before deploy

- Scenarios: GREEN + low rise + dry weather → predicted level/class stay GREEN/YELLOW.
- ORANGE current + high rain → ML may lift to RED only if rise/flow or future level support it.
- Compare Pi logs: `predicted_level`, `predicted_alert`, `current_alert` for 24h field test.

### 5. Frontend / API

- No schema change; same `predicted_level` / `predicted_alert_level` fields.
- UI note: “Forecast uses sensors + weather” after retrain.

---

## Summary

| Phase | Work | Retrain? |
|-------|------|----------|
| **Now** | Anchor level + gate ML alert on Pi | No |
| **Next** | New dataset with +1h targets + sensor features | Yes |
| **Then** | Retrain bundle, evaluate, ship to Pi | Yes |
