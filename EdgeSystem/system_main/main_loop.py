import time
import cv2
import numpy as np
import json
import requests
import threading
import base64
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import BACKEND_API_URL, EDGE_API_KEY, MQTT_BROKER, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC_SENSOR
import paho.mqtt.client as mqtt
import ssl
from system_main.database_manager import DatabaseManager
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level
from processing.tide_manager import TideManager
from system_main.sms_manager import SMSManager

# --- PURE HARDWARE IMPORTS ---
print(" [System] Loading Hardware Drivers...")
from hardware.camera.pi_camera_driver import PiCameraDriver
from hardware.sensors.ultrasonic_driver import get_distance, init_sensor as init_ultrasonic
from hardware.sensors.radar_driver import get_flow_rate as get_radar_flow, init_radar, close_radar

def send_to_backend(payload, mqtt_client):
    """Sends JSON payload to Java Backend via Secure MQTT."""
    try:
        # Publish to HiveMQ Cloud. payload is converted to JSON.
        result = mqtt_client.publish(MQTT_TOPIC_SENSOR, json.dumps(payload), qos=1)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f" [Net] Data published to MQTT topic: {MQTT_TOPIC_SENSOR}")
            return True
        else:
            print(f" [Net] MQTT Publish queued/failed with rc: {result.rc}")
            return False
    except Exception as e:
        print(f" [Net] MQTT Publish Error: {e}")
        return False

def sync_offline_data(db, mqtt_client):
    """Syncs unsynced data from SQLite to the backend."""
    if not mqtt_client.is_connected():
        return

    unsynced_records = db.get_unsynced_data(limit=10)
    if not unsynced_records:
        return

    synced_ids = []
    print(f" [Sync] Attempting to sync {len(unsynced_records)} offline records...")
    for record in unsynced_records:
        payload = {
            "waterLevelM": round(float(record['water_level_m']), 2),
            "sensorFlowRateMps": round(float(record['sensor_flow_rate_mps']), 2),
            "imageFlowRateMps": round(float(record['image_flow_rate_mps']), 2),
            "imageRiseRateMps": round(float(record['image_rise_rate_mps']), 2),
            "currentAlertLevel": record['current_alert_level'],
            "predictedLevel": round(float(record['predicted_level']), 2),
            "predictedAlertLevel": record['predicted_alert_level'],
            "snapshotBase64": "" # Snapshots aren't saved offline to save space
        }
        
        # Publish synchronously for syncing
        if send_to_backend(payload, mqtt_client):
            synced_ids.append(record['id'])
            
    if synced_ids:
        db.mark_data_synced(synced_ids)
        print(f" [Sync] Successfully synced {len(synced_ids)} records.")

def main():
    print("--- STARTING SURGE ALERT EDGE SYSTEM (DATA COLLECTION MODE) ---")
    
    # 0. Initialize MQTT Client for HiveMQ Cloud (MQTTS)
    mqtt_client = mqtt.Client(client_id="SurgeAlertEdge", protocol=mqtt.MQTTv311)
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    mqtt_client.tls_set(tls_version=ssl.PROTOCOL_TLS) # Enable SSL/TLS for secure connection
    
    try:
        print(f" [Net] Connecting to Secure MQTT Broker at {MQTT_BROKER}...")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start() # Start background thread for MQTT network traffic
        print(" [Net] MQTT Connected Successfully!")
    except Exception as e:
        print(f" [Net] MQTT Connection Failed: {e}")

    # 1. Initialize Components
    db = DatabaseManager()
    alerter = AlertManager()
    img_proc = ImageProcessor()
    tide_manager = TideManager()
    
    # Initialize SMS Manager with fail-safe (Cross-Dependency Check)
    sms = None
    try:
        sms = SMSManager() # GSM Initializer
    except Exception as e:
        print(f" [System] Warning: GSM Module initialization failed. SMS offline. Error: {e}")
    
    # 2. Initialize Sensors (Safe Laptop Initialization)
    cam = None
    try:
        cam = PiCameraDriver()
        init_ultrasonic()
        init_radar()
    except Exception as e:
        # Prevents FATAL crash on laptop while informing the user
        print(f" [System] Running in Simulation Mode (Hardware not found): {e}")

    last_log_time = time.time()
    last_sync_time = time.time()
    last_sms_time = 0
    LOG_INTERVAL = 300.0        # Save and send data every 5 minutes (300 seconds)
    SYNC_INTERVAL = 60.0        # Check for unsynced offline data every 60 seconds

    # --- AGGREGATION BUFFERS ---
    # We will collect readings every 1 second, store them here, and process them every 5 minutes.
    buffer_wl = []
    buffer_radar_flow = []
    buffer_img_flow = []
    buffer_img_rise = []

    try:
        while True:
            start_time = time.time()

            # --- A. DATA COLLECTION (Every 1 Second) ---
            frame = cam.capture_frame() if cam else np.zeros((480, 640, 3), np.uint8)
            raw_dist = get_distance()
            radar_flow = get_radar_flow() 

            # --- B. PROCESSING ---
            current_wl = calculate_water_level(raw_dist)
            img_flow, img_rise, viz_frame, raw_vectors = img_proc.process_frame(frame, water_level=current_wl)

            # Add to buffers
            buffer_wl.append(current_wl)
            buffer_radar_flow.append(radar_flow)
            buffer_img_flow.append(img_flow)
            buffer_img_rise.append(img_rise)

            # --- C. PREDICTION & TIDE LOGIC (AI Muted for Data Collection) ---
            tide_now = tide_manager.get_tide_at_time(hours_offset=0)
            tide_future = tide_manager.get_tide_at_time(hours_offset=1)
            tide_effect = tide_future - tide_now
            
            pred_level = max(0.0, current_wl + tide_effect)
            current_alert = alerter.determine_alert_level(current_wl)
            pred_alert = alerter.determine_alert_level(pred_level)

            # --- D. & E. AGGREGATION, LOGGING AND SENDING (Every 5 Minutes) ---
            current_time = time.time()
            if current_time - last_log_time >= LOG_INTERVAL and len(buffer_wl) > 0:
                
                # --- CALCULATE AGGREGATES (Median to ignore spikes like birds/boats) ---
                import statistics
                agg_wl = statistics.median(buffer_wl)
                agg_radar = statistics.median(buffer_radar_flow)
                agg_img_flow = statistics.median(buffer_img_flow)
                agg_img_rise = statistics.median(buffer_img_rise)
                
                # Recalculate alert based on the stable aggregated level
                agg_alert = alerter.determine_alert_level(agg_wl)
                agg_pred_level = max(0.0, agg_wl + tide_effect)
                agg_pred_alert = alerter.determine_alert_level(agg_pred_level)

                # Clear buffers for the next 5 minutes
                buffer_wl.clear()
                buffer_radar_flow.clear()
                buffer_img_flow.clear()
                buffer_img_rise.clear()

                # 1. Log to Local SQLite (Only 1 entry every 5 minutes)
                record_id = db.log_sensor_data(
                    water_level=agg_wl,
                    sensor_flow=agg_radar,
                    img_flow=agg_img_flow,
                    img_rise=agg_img_rise,
                    pred_level=agg_pred_level,
                    alert_level=agg_alert,
                    pred_alert_level=agg_pred_alert,
                    raw_vectors=raw_vectors
                )

                # 2. Prepare Backend Upload (Send the latest camera frame)
                b64_img = ""
                if viz_frame is not None:
                    _, buf = cv2.imencode('.jpg', viz_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    b64_img = base64.b64encode(buf).decode('utf-8')

                payload = {
                    "waterLevelM": round(float(agg_wl), 2),
                    "sensorFlowRateMps": round(float(agg_radar), 2),
                    "imageFlowRateMps": round(float(agg_img_flow), 2),
                    "imageRiseRateMps": round(float(agg_img_rise), 2),
                    "currentAlertLevel": agg_alert,
                    "predictedLevel": round(float(agg_pred_level), 2),
                    "predictedAlertLevel": agg_pred_alert,
                    "snapshotBase64": b64_img
                }

                # 3. Send to Java Backend via MQTT in Thread
                def send_and_mark():
                    if send_to_backend(payload, mqtt_client) and record_id:
                        db.mark_data_synced([record_id])

                threading.Thread(target=send_and_mark).start()

                # Reset the timer
                last_log_time = current_time 
                
            # --- E.2. BACKGROUND SYNC (Every 60 seconds) ---
            if current_time - last_sync_time >= SYNC_INTERVAL:
                threading.Thread(target=sync_offline_data, args=(db, mqtt_client)).start()
                last_sync_time = current_time

            # --- F. OFFLINE FAILSAFE (SIM7600G-H) - FULLY RESTORED & PROTECTED ---
            if current_alert == "RED":
                print(" [ALERT] RED LEVEL DETECTED! (SMS logic prepared)")
                current_time = time.time()
                if current_time - last_sms_time >= 300: 
                    try:
                        recipients = db.get_all_registered_phone_numbers()
                        if recipients and sms:
                            for number in recipients:
                                msg = (f"SURGE ALERT: CRITICAL! Water level at {current_wl:.2f}m. "
                                       f"Flow: {radar_flow:.2f}mps. Evacuate immediately!")
                                threading.Thread(target=sms.send_sms, args=(number, msg)).start()
                            last_sms_time = current_time
                    except Exception as e:
                        # Cross-Dependency: Catch all errors so SMS failure doesn't stop logging
                        print(f" [SMS] Failed to process emergency alerts (Non-Fatal): {e}")

            # --- G. VISUALIZATION & OUTPUT ---
            print(f"WL: {current_wl:.2f}m | Tide: {tide_effect:+.3f}m | Pred: {pred_level:.2f}m | P.Alert: {pred_alert}")

            # Control loop speed (Maintains 1 sample per second)
            elapsed = time.time() - start_time
            if elapsed < 1.0:
                time.sleep(1.0 - elapsed)

    except KeyboardInterrupt:
        print("\nStopping SurgeAlert...")
    finally:
        print("Releasing Hardware...")
        if cam: cam.close()
        close_radar()
        
        # Only cleanup if GPIO was actually imported
        try:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
            print("GPIO Pins Cleaned Up.")
        except (ImportError, RuntimeError):
            # Skip if on Windows/Laptop
            pass
            
        print("System Offline.")
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()

if __name__ == "__main__":
    main()