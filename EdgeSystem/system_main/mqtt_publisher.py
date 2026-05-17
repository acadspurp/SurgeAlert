"""Publish sensor_data telemetry via MQTT (images via HTTPS, not MQTT)."""
import json


def build_mqtt_payload(reading):
    """Core telemetry only — no snapshot base64 on MQTT."""
    payload = {
        "timestamp": reading.get("timestamp"),
        "water_level": reading["water_level"],
        "sensor_flow_rate_mps": reading["sensor_flow_rate_mps"],
        "image_flow_rate_mps": reading["image_flow_rate_mps"],
        "rise_rate": reading["rise_rate"],
        "current_alert_level": reading["current_alert_level"],
        "predicted_level": reading["predicted_level"],
        "predicted_alert_level": reading["predicted_alert_level"],
        "is_simulated": False,
    }
    env = reading.get("environmental") or {}
    for key in (
        "Tide_Height_m", "Tide_Trend", "QC_Rain_mm", "QC_Lag1", "QC_Lag2",
        "QC_3hr_Sum", "QC_6hr_Sum", "Marulas_Rain_mm", "Mar_Lag1", "Mar_Lag2",
        "Mar_3hr_Sum", "Mar_6hr_Sum", "Mar_24hr_Sum", "Pressure_hPa",
        "Press_Trend", "Wind_Speed", "Wind_Sin", "Wind_Cos", "Soil_Moisture",
    ):
        if key in env and env[key] is not None:
            payload[key] = env[key]
    if reading.get("ml_features_stale"):
        payload["ml_features_stale"] = True
    return payload


def publish_sensor_data(mqtt_client, topic, reading):
    if not mqtt_client:
        return False
    try:
        payload = build_mqtt_payload(reading)
        mqtt_client.publish(topic, json.dumps(payload), qos=1)
        return True
    except Exception as e:
        print(f" [MQTT] Publish failed: {e}")
        return False


def frame_to_base64(frame):
    import cv2
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
    if not ok:
        return None
    import base64
    return base64.b64encode(buf).decode("ascii")
