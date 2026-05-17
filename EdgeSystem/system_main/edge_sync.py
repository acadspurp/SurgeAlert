"""Sync ml_features, residents, templates, and snapshots via backend API."""
from datetime import datetime, timedelta

import requests

from config.settings import (
    BACKEND_API_URL,
    EDGE_API_KEY,
    ML_FEATURES_MAX_AGE_HOURS,
)


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
    has_features = any(
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


def upload_snapshot(timestamp, image_base64):
    """HTTPS upload for image_bytes (keeps MQTT payloads small)."""
    if not image_base64:
        return False
    try:
        url = f"{BACKEND_API_URL}/edge/sync/snapshot"
        r = requests.post(
            url,
            headers=_headers(),
            json={"timestamp": timestamp, "snapshotBase64": image_base64},
            timeout=30,
        )
        return r.status_code in (200, 201, 204)
    except Exception as e:
        print(f" [Sync] Snapshot upload failed: {e}")
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
