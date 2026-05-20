"""Publish sensor_data telemetry via MQTT (images via HTTPS, not MQTT)."""
import json

from config.settings import USE_HARDWARE


def build_mqtt_payload(reading):
    """Core telemetry only — no env fields, no snapshot base64 on MQTT."""
    return {
        "timestamp": reading.get("timestamp"),
        "water_level": reading["water_level"],
        "sensor_flow_rate": reading["sensor_flow_rate"],
        "image_flow_rate": reading["image_flow_rate"],
        "fused_flow_rate": reading.get("fused_flow_rate"),
        "rise_rate": reading["rise_rate"],
        "rise_rate_mh": reading["rise_rate"],
        "current_alert_level": reading["current_alert_level"],
        "predicted_level": reading["predicted_level"],
        "predicted_alert_level": reading["predicted_alert_level"],
        "is_simulated": not USE_HARDWARE,
    }


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
