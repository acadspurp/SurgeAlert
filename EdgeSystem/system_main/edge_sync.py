"""Sync ml_features, residents, templates, and model artifacts via backend API."""
import os
import time
from datetime import datetime, timedelta

import requests

from config.settings import (
    BACKEND_API_URL,
    EDGE_API_KEY,
    ML_FEATURES_MAX_AGE_HOURS,
    MODEL_DIR,
    MODEL_PATH,
)

MODEL_VERSION_FILE = os.path.join(MODEL_DIR, "model_version.txt")


def _headers():
    h = {"Content-Type": "application/json"}
    if EDGE_API_KEY:
        h["X-Edge-Key"] = EDGE_API_KEY
    return h


def fetch_ml_features_realtime():
    """Latest row from ml_features_realtime (Render via backend)."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/ml-features"
        r = requests.get(url, headers=_headers(), timeout=12)
        if r.status_code == 200:
            data = r.json()
            return data if data else None
    except Exception as e:
        print(f" [Sync] ml_features_realtime unavailable: {e}")
    return None


def resolve_ml_features(db_manager):
    """
    Online: fetch cloud row and cache locally.
    Offline: use latest SQLite cache.
    Returns (features_dict, is_stale).
    """
    fresh = fetch_ml_features_realtime()
    has_features = bool(fresh) and any(
        fresh.get(k) is not None
        for k in ("Tide_Height_m", "QC_Rain_mm", "Pressure_hPa", "timestamp")
    )
    if fresh and has_features:
        db_manager.cache_ml_features_row(fresh)
        return fresh, False

    cached = db_manager.get_latest_ml_features_cached()
    if not cached:
        return None, True

    ts_str = cached.get("timestamp")
    stale = True
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00").split("+")[0])
            age_h = (datetime.now() - ts).total_seconds() / 3600.0
            stale = age_h > ML_FEATURES_MAX_AGE_HOURS
        except Exception:
            pass
    return cached, stale


def fetch_offline_bundle(db_manager):
    """Residents (with priority), SMS templates, OTP cache."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/all"
        r = requests.get(url, headers=_headers(), timeout=15)
        if r.status_code != 200:
            return False
        data = r.json()
        db_manager.sync_residents(data.get("residents") or [])
        db_manager.sync_templates(data.get("templates") or [])
        db_manager.sync_otps(data.get("otps") or {})
        return True
    except Exception as e:
        print(f" [Sync] Offline bundle fetch failed: {e}")
        return False


def download_model_if_updated():
    """Pull latest server-trained XGBoost when version changes."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/model"
        r = requests.get(url, headers=_headers(), timeout=120)
        if r.status_code != 200:
            return False
        version = (r.headers.get("X-Model-Version") or "").strip() or "unknown"
        if os.path.isfile(MODEL_VERSION_FILE):
            with open(MODEL_VERSION_FILE, encoding="utf-8") as f:
                if f.read().strip() == version:
                    return False
        os.makedirs(MODEL_DIR, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            f.write(r.content)
        with open(MODEL_VERSION_FILE, "w", encoding="utf-8") as f:
            f.write(version)
        print(f" [ML] Downloaded model version {version}")
        return True
    except Exception as e:
        print(f" [ML] Model download failed: {e}")
        return False


def upload_telemetry(reading):
    """HTTPS ingest so sensor_data row exists before snapshot attach (backup to MQTT)."""
    from system_main.mqtt_publisher import build_mqtt_payload

    try:
        url = f"{BACKEND_API_URL}/edge/sync/telemetry"
        payload = build_mqtt_payload(reading)
        r = requests.post(url, headers=_headers(), json=payload, timeout=30)
        if r.status_code == 200:
            return True
        print(f" [Sync] Telemetry upload HTTP {r.status_code}: {r.text[:200]}")
        return False
    except Exception as e:
        print(f" [Sync] Telemetry upload failed: {e}")
        return False


def upload_snapshot(timestamp, image_base64, max_attempts=10, retry_delay_sec=5.0):
    """HTTPS upload for image_bytes (keeps MQTT payloads small). Retries if row not ready yet."""
    if not image_base64:
        return False
    url = f"{BACKEND_API_URL}/edge/sync/snapshot"
    payload = {"timestamp": timestamp, "snapshotBase64": image_base64}
    for attempt in range(1, max_attempts + 1):
        try:
            r = requests.post(
                url,
                headers=_headers(),
                json=payload,
                timeout=30,
            )
            if r.status_code in (200, 201, 204):
                print(f" [Sync] Snapshot uploaded for {timestamp}")
                return True
            if r.status_code == 404 and attempt < max_attempts:
                print(
                    f" [Sync] Snapshot row not ready (404), retry {attempt}/{max_attempts}..."
                )
                time.sleep(retry_delay_sec)
                continue
            print(f" [Sync] Snapshot upload HTTP {r.status_code}")
            return False
        except Exception as e:
            print(f" [Sync] Snapshot upload failed (attempt {attempt}): {e}")
            if attempt < max_attempts:
                time.sleep(retry_delay_sec)
    return False


def ml_features_to_weather_dict(ml):
    if not ml:
        return {
            "QC_Rain_mm": 0.0, "QC_Lag1": 0.0, "QC_Lag2": 0.0,
            "QC_3hr_Sum": 0.0, "QC_6hr_Sum": 0.0,
            "Marulas_Rain_mm": 0.0, "Mar_Lag1": 0.0, "Mar_Lag2": 0.0,
            "Mar_3hr_Sum": 0.0, "Mar_6hr_Sum": 0.0, "Mar_24hr_Sum": 0.0,
            "Pressure_hPa": 1013.0, "Press_Trend": 0.0,
            "Wind_Speed": 0.0, "Wind_Sin": 0.0, "Wind_Cos": 0.0,
            "Soil_Moisture": 0.0,
        }
    return {
        "QC_Rain_mm": ml.get("QC_Rain_mm") or ml.get("qcRainMm") or 0.0,
        "QC_Lag1": ml.get("QC_Lag1") or ml.get("qcLag1") or 0.0,
        "QC_Lag2": ml.get("QC_Lag2") or ml.get("qcLag2") or 0.0,
        "QC_3hr_Sum": ml.get("QC_3hr_Sum") or ml.get("qc3hrSum") or 0.0,
        "QC_6hr_Sum": ml.get("QC_6hr_Sum") or ml.get("qc6hrSum") or 0.0,
        "Marulas_Rain_mm": ml.get("Marulas_Rain_mm") or ml.get("marulasRainMm") or 0.0,
        "Mar_Lag1": ml.get("Mar_Lag1") or ml.get("marLag1") or 0.0,
        "Mar_Lag2": ml.get("Mar_Lag2") or ml.get("marLag2") or 0.0,
        "Mar_3hr_Sum": ml.get("Mar_3hr_Sum") or ml.get("mar3hrSum") or 0.0,
        "Mar_6hr_Sum": ml.get("Mar_6hr_Sum") or ml.get("mar6hrSum") or 0.0,
        "Mar_24hr_Sum": ml.get("Mar_24hr_Sum") or ml.get("mar24hrSum") or 0.0,
        "Pressure_hPa": ml.get("Pressure_hPa") or ml.get("pressureHpa") or 1013.0,
        "Press_Trend": ml.get("Press_Trend") or ml.get("pressTrend") or 0.0,
        "Wind_Speed": ml.get("Wind_Speed") or ml.get("windSpeed") or 0.0,
        "Wind_Sin": ml.get("Wind_Sin") or ml.get("windSin") or 0.0,
        "Wind_Cos": ml.get("Wind_Cos") or ml.get("windCos") or 0.0,
        "Soil_Moisture": ml.get("Soil_Moisture") or ml.get("soilMoisture") or 0.0,
    }
