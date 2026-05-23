"""
SurgeAlert Edge System — live sensors, fusion, ML, MQTT, offline GSM alerts.

Duty cycle: sleep 4m30s → wake 30s → repeat (5-minute grid timestamps).
"""
import json
import os
import ssl
import sys
import threading
import time
import warnings
from datetime import datetime
from statistics import median

import paho.mqtt.client as mqtt

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    BACKEND_IP,
    CYCLE_INTERVAL_SEC,
    ENVIRONMENT_MODE,
    GATHER_DURATION_SEC,
    FLOW_SCALE_FACTOR,
    GSM_BAUDRATE,
    GSM_PORT,
    RISE_RATE_SCALE_FACTOR,
    WATER_LEVEL_SCALE_FACTOR,
    MQTT_BROKER,
    MQTT_PASSWORD,
    MQTT_PORT,
    MQTT_TOPIC_SENSOR,
    MQTT_USERNAME,
    RISE_RATE_WINDOW_SEC,
    SLEEP_DURATION_SEC,
    USE_HARDWARE,
)
from alert_logic.alert_manager import AlertManager
from hardware.sensors import ultrasonic_driver, radar_driver
from hardware.camera.pi_camera_driver import PiCameraDriver
from ml_model.level_predictor import LevelPredictor
from processing.image_processor import ImageProcessor
from processing.rise_rate_tracker import RiseRateTracker
from processing.sensor_data_processor import (
    calculate_water_level,
    scale_telemetry_for_reporting,
)
from processing.sensor_fusion import build_cycle_reading
from system_main.database_manager import DatabaseManager
from system_main.data_logger import DataLogger
from system_main.edge_sync import (
    download_model_if_updated,
    fetch_offline_bundle,
    ml_features_to_weather_dict,
    resolve_ml_features,
    upload_snapshot,
    upload_telemetry,
)
from system_main.edge_time_utils import grid_timestamp_iso
from system_main.mqtt_publisher import frame_to_base64, publish_sensor_data
from system_main.gsm_outbound import GsmOutboundWorker
from system_main.mqtt_sms_bridge import SMS_OUTBOUND_TOPIC, attach_outbound_sms_handler
from system_main.sms_manager import SMSManager

warnings.filterwarnings("ignore", category=DeprecationWarning, module="paho.mqtt")

_last_sent_alert_level = None

_ALERT_RANK = {"GREEN": 0, "YELLOW": 1, "ORANGE": 2, "RED": 3}


def _create_mqtt_client(client_id="SurgeAlertEdge"):
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    except (AttributeError, TypeError):
        client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
    is_local = "localhost" in MQTT_BROKER or "127.0.0.1" in MQTT_BROKER or BACKEND_IP in MQTT_BROKER
    if not is_local:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    return client


def _median(vals):
    clean = [v for v in vals if v is not None]
    return float(median(clean)) if clean else 0.0


def _gather_burst(camera, image_processor, rise_tracker, duration_sec):
    """Sample during 30s wake window; median CV flow; ultrasonic rise_rate in m/h."""
    t_end = time.time() + duration_sec
    wl_samples, flow_samples, img_flow_samples = [], [], []
    raw_vectors_acc = []
    last_frame = None

    while time.time() < t_end:
        dist = ultrasonic_driver.get_distance()
        wl = calculate_water_level(dist)
        rise_tracker.add_sample(wl)
        sensor_flow = radar_driver.get_flow_rate()

        img_flow = 0.0
        if camera:
            frame = camera.capture_frame()
            last_frame = frame
            img_flow, _, _, vectors = image_processor.process_frame(frame, water_level=wl)
            raw_vectors_acc.extend(vectors or [])

        wl_samples.append(wl)
        flow_samples.append(sensor_flow or 0.0)
        img_flow_samples.append(img_flow or 0.0)
        time.sleep(0.5)

    return {
        "water_level": round(_median(wl_samples), 2),
        "sensor_flow_rate": round(_median(flow_samples), 3),
        "image_flow_rate": round(_median(img_flow_samples), 3),
        "rise_rate_mph": rise_tracker.get_rise_rate_mph(),
        "raw_vectors": raw_vectors_acc[-20:],
        "last_frame": last_frame,
    }


def _print_dashboard(reading, cloud_online, ml_stale):
    env = reading.get("environmental") or {}
    stale_note = " (stale ML features)" if ml_stale else ""
    print("\n" + "=" * 52)
    print(
        f" [EDGE MONITOR] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  "
        f"Cloud: {'ONLINE' if cloud_online else 'OFFLINE'}{stale_note}"
    )
    print("-" * 52)
    print(f"  Grid timestamp   : {reading.get('timestamp')}")
    print(f"  Water Level      : {reading['water_level']:.2f} m")
    print(f"  Sensor Flow      : {reading['sensor_flow_rate']:.3f} m/s  (radar)")
    print(f"  Image Flow (CV)  : {reading['image_flow_rate']:.3f} m/s")
    print(f"  Fused Flow       : {reading.get('fused_flow_rate', 0):.3f} m/s")
    print(f"  Rise Rate        : {reading['rise_rate']:.4f} m/h  (ultrasonic)")
    print(f"  Alert            : {reading['current_alert_level']}")
    print(f"  Predicted (+1h)  : {reading['predicted_level']:.2f} m  →  {reading['predicted_alert_level']}")
    if env:
        print(f"  Tide / Rain      : {env.get('Tide_Height_m', 0):.2f} m / {env.get('QC_Rain_mm', 0):.1f} mm")
    print("=" * 52 + "\n")


def _format_offline_sms(template, reading):
    fused = reading.get("fused_flow_rate", reading.get("sensor_flow_rate", 0))
    if not template:
        return (
            f"SURGE ALERT {reading['current_alert_level']}: "
            f"Water {reading['water_level']:.2f}m, rise {reading['rise_rate']:.2f} m/h. "
            f"Flow {fused:.2f} m/s."
        )
    msg = template.replace("{level}", f"{reading['water_level']:.2f}")
    msg = msg.replace("{alert}", reading["current_alert_level"])
    msg = msg.replace("{flow}", f"{fused:.2f}")
    msg = msg.replace("{rise}", f"{reading['rise_rate']:.2f}")
    return msg


def _alert_rank(level):
    return _ALERT_RANK.get((level or "GREEN").upper(), 0)


def _should_block_sms_by_prediction(current_level, reading):
    """Hold SMS if ML +1h alert is materially lower than current (not used in message body)."""
    pred = (reading.get("predicted_alert_level") or "GREEN").upper()
    if _alert_rank(pred) + 1 < _alert_rank(current_level):
        print(
            f" [SMS] Skipped: predicted alert {pred} vs current {current_level}."
        )
        return True
    return False


def _alert_level_changed(new_level):
    """True when alert level differs from last dispatched SMS level."""
    global _last_sent_alert_level
    level = (new_level or "GREEN").upper()
    if _last_sent_alert_level is None:
        return level in ("YELLOW", "ORANGE", "RED")
    return _last_sent_alert_level != level


def _commit_alert_level_dispatched(new_level):
    global _last_sent_alert_level
    _last_sent_alert_level = (new_level or "GREEN").upper()


def _maybe_send_offline_alerts(sms, db, reading, cloud_online):
    if cloud_online or not sms:
        return
    level = (reading.get("current_alert_level") or "GREEN").upper()
    if not _alert_level_changed(level):
        return
    if _should_block_sms_by_prediction(level, reading):
        return

    template = db.get_template(level) or db.get_template("RED")
    message = _format_offline_sms(template, reading)
    phones = db.get_residents_for_sms()
    if not phones:
        print(" [SMS] Offline alert skipped: no residents in local DB.")
        return

    sent = 0
    for phone in phones:
        if sms.send_gsm_only(phone, message):
            sent += 1
    if sent:
        _commit_alert_level_dispatched(level)
        print(
            f" [SMS] Offline GSM: level change → {level}, sent to {sent} resident(s)."
        )


def _apply_level_scale(burst):
    """Physical pool readings → river-equivalent for alerts/MQTT/DB."""
    wl, rise, sf, imgf = scale_telemetry_for_reporting(
        burst["water_level"],
        burst["rise_rate_mph"],
        burst["sensor_flow_rate"],
        burst["image_flow_rate"],
    )
    return {
        **burst,
        "water_level": wl,
        "rise_rate_mph": rise,
        "sensor_flow_rate": sf,
        "image_flow_rate": imgf,
    }


def main():
    print("--- SURGE ALERT EDGE SYSTEM (LIVE SENSORS) ---")
    print(
        f" Mode: {ENVIRONMENT_MODE}  |  scale wl/rr/flow: "
        f"{WATER_LEVEL_SCALE_FACTOR}/{RISE_RATE_SCALE_FACTOR}/{FLOW_SCALE_FACTOR}"
    )
    print(f" Cycle: sleep {SLEEP_DURATION_SEC}s → gather {GATHER_DURATION_SEC}s (5 min grid)")

    db = DatabaseManager()
    logger = DataLogger(db)
    alert_mgr = AlertManager()
    predictor = LevelPredictor()
    rise_tracker = RiseRateTracker(window_sec=RISE_RATE_WINDOW_SEC)
    image_processor = ImageProcessor()

    sms = None
    gsm_worker = None
    try:
        sms = SMSManager(port=GSM_PORT, baudrate=GSM_BAUDRATE)
        gsm_worker = GsmOutboundWorker(sms)
        threading.Thread(target=sms.probe_module, name="gsm-probe", daemon=True).start()
    except Exception as e:
        print(f"\033[33m [GSM] Init warning (offline SMS may fail): {e}\033[0m")

    mqtt_client = None
    try:
        mqtt_client = _create_mqtt_client()
        attach_outbound_sms_handler(mqtt_client, gsm_worker)
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        print(f" [MQTT] OK: connected to {MQTT_BROKER}:{MQTT_PORT}; publish → {MQTT_TOPIC_SENSOR}")
        print(f" [MQTT] Listening for OTP/alerts on {SMS_OUTBOUND_TOPIC}")
        if not gsm_worker:
            print("\033[33m [SMS] WARNING: GSM worker not started — OTP MQTT messages will be ignored.\033[0m")
    except Exception as e:
        print(
            f" [MQTT] CONNECTION FAILED ({MQTT_BROKER}:{MQTT_PORT}): {e} — "
            "telemetry will queue in SQLite until broker is reachable."
        )
        mqtt_client = None

    ultrasonic_driver.init_sensor()
    radar_driver.init_radar()

    camera = None
    if USE_HARDWARE:
        try:
            camera = PiCameraDriver()
        except Exception as e:
            print(
                f" [Camera] Init failed (CV flow will be 0): {e}"
            )

    cloud_online = fetch_offline_bundle(db)

    try:
        while True:
            cycle_start = time.time()
            cycle_ts = grid_timestamp_iso()

            cloud_online = fetch_offline_bundle(db)
            if cloud_online and download_model_if_updated():
                alert_mgr.reload_model()
                predictor.alert_manager.reload_model()
            ml_features, ml_stale = resolve_ml_features(db)

            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Wake — gathering {GATHER_DURATION_SEC}s...")
            burst = _apply_level_scale(
                _gather_burst(camera, image_processor, rise_tracker, GATHER_DURATION_SEC)
            )

            rise_mph = burst["rise_rate_mph"]
            reading_preview = build_cycle_reading(
                water_level=burst["water_level"],
                sensor_flow=burst["sensor_flow_rate"],
                image_flow=burst["image_flow_rate"],
                rise_rate_mph=rise_mph,
                current_alert="GREEN",
                predicted_level=burst["water_level"],
                predicted_alert="GREEN",
                cycle_timestamp=cycle_ts,
            )
            fused_flow = reading_preview["fused_flow_rate"]

            pred_level, pred_alert = predictor.predict_one_hour(
                burst["water_level"],
                rise_mph,
                ml_features=ml_features,
                features_stale=ml_stale,
                sensor_flow=burst["sensor_flow_rate"],
                image_flow=burst["image_flow_rate"],
                fused_flow=fused_flow,
            )

            current_alert = alert_mgr.determine_alert_level_with_flow(
                burst["water_level"],
                predicted_level=pred_level,
                rise_rate_per_hour=rise_mph,
                fused_flow_mps=fused_flow,
            )

            reading = build_cycle_reading(
                water_level=burst["water_level"],
                sensor_flow=burst["sensor_flow_rate"],
                image_flow=burst["image_flow_rate"],
                rise_rate_mph=rise_mph,
                current_alert=current_alert,
                predicted_level=pred_level,
                predicted_alert=pred_alert,
                cycle_timestamp=cycle_ts,
            )

            weather = ml_features_to_weather_dict(ml_features)
            env = dict(weather)
            if ml_features:
                env["Tide_Height_m"] = ml_features.get("Tide_Height_m") or ml_features.get("tideHeightM") or 0.0
                env["Tide_Trend"] = ml_features.get("Tide_Trend") or ml_features.get("tideTrend") or 0.0
            reading["environmental"] = env
            reading["ml_features_stale"] = ml_stale

            image_b64 = None
            if burst.get("last_frame") is not None:
                image_b64 = frame_to_base64(burst["last_frame"])
                print(f" [{datetime.now().strftime('%H:%M:%S')}] Snapshot captured (5-min cycle).")

            pred_class = {"GREEN": 0, "YELLOW": 1, "ORANGE": 2, "RED": 3}.get(pred_alert, 0)
            row_id = logger.log_cycle(
                reading, ml_features, burst.get("raw_vectors"), image_b64, pred_class
            )

            if mqtt_client:
                publish_sensor_data(mqtt_client, MQTT_TOPIC_SENSOR, reading)
            if cloud_online:
                upload_telemetry(reading)
                if image_b64:
                    time.sleep(3)
                    upload_snapshot(cycle_ts, image_b64)

                unsynced = db.get_unsynced_data(limit=20)
                synced_ids = []
                for row in unsynced:
                    payload = {
                        "timestamp": row["timestamp"],
                        "water_level": row["water_level"],
                        "sensor_flow_rate": row["sensor_flow_rate"],
                        "image_flow_rate": row["image_flow_rate"],
                        "fused_flow_rate": row.get("fused_flow_rate"),
                        "rise_rate": row["rise_rate"],
                        "rise_rate_mh": row["rise_rate"],
                        "current_alert_level": row["current_alert_level"],
                        "predicted_level": row["predicted_level"],
                        "predicted_alert_level": row["predicted_alert_level"],
                        "is_simulated": not USE_HARDWARE,
                    }
                    try:
                        if mqtt_client:
                            mqtt_client.publish(MQTT_TOPIC_SENSOR, json.dumps(payload), qos=1)
                        elif cloud_online:
                            upload_telemetry(row)
                        snap_ok = True
                        if cloud_online and row.get("image_bytes"):
                            snap_ok = upload_snapshot(row["timestamp"], row["image_bytes"])
                        if snap_ok:
                            synced_ids.append(row["id"])
                    except Exception:
                        break
                if synced_ids:
                    db.mark_data_synced(synced_ids)
                    db.purge_old_synced_rows()

            _print_dashboard(reading, cloud_online, ml_stale)
            _maybe_send_offline_alerts(sms, db, reading, cloud_online)

            elapsed = time.time() - cycle_start
            sleep_sec = max(0, CYCLE_INTERVAL_SEC - elapsed)
            print(f" [{datetime.now().strftime('%H:%M:%S')}] Sleep {sleep_sec:.0f}s (sensors/camera idle)...")
            time.sleep(sleep_sec)

    except KeyboardInterrupt:
        print("\nStopping SurgeAlert Edge System...")
    finally:
        if camera:
            camera.close()
        radar_driver.close_radar()
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        print("System offline.")


if __name__ == "__main__":
    main()
