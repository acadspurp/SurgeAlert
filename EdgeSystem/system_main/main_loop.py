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
import warnings

# Suppress paho-mqtt deprecation warning for cleaner logs
warnings.filterwarnings("ignore", category=DeprecationWarning, module="paho.mqtt")

from system_main.database_manager import DatabaseManager
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level
from processing.tide_manager import TideManager
from processing.weather_manager import WeatherManager
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

def sync_system_config(db, mode="all"):
    """Fetches all residents, templates, and OTPs from the backend to ensure offline reliability."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/all"
        headers = {"X-Edge-Key": EDGE_API_KEY}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Mode-based Syncing
            if mode == "all":
                if "residents" in data: db.sync_residents(data["residents"])
                if "templates" in data: db.sync_templates(data["templates"])
                if "otps" in data: db.sync_otps(data["otps"])
                print(" [Sync] Full system configuration updated.")
            elif mode == "otp":
                if "otps" in data: db.sync_otps(data["otps"])
                # We don't log the silent OTP sync to keep logs clean
            
            return True
        else:
            print(f" [Sync] Failed to sync config ({mode}). HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f" [Sync] Config sync error ({mode}): {e}")
        return False

def cleanup_expired_otps_task(db):
    """Simple task to clean up old OTPs every 10 minutes."""
    while True:
        db.cleanup_expired_otps()
        time.sleep(600) # 10 Minutes

def sync_environmental_data():
    """Fetches pre-calculated ML features from the backend (every 30 mins)."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/environmental"
        headers = {"X-Edge-Key": EDGE_API_KEY}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f" [Sync] Environmental fetch error: {e}")
    return None

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
            "water_level": round(float(record.get('water_level', 0.0)), 2),
            "sensorFlowRateMps": round(float(record.get('sensor_flow_rate_mps', 0.0)), 2),
            "imageFlowRateMps": round(float(record.get('image_flow_rate_mps', 0.0)), 2),
            "rise_rate": round(float(record.get('rise_rate', 0.0)), 2),
            "sensor_rise_rate": round(float(record.get('sensor_rise_rate', 0.0)), 2),
            "currentAlertLevel": record['current_alert_level'],
            "predictedLevel": round(float(record['predicted_level']), 2),
            "predictedAlertLevel": record['predicted_alert_level'],
            "Tide_Height_m": round(float(record.get('Tide_Height_m', 0.0)), 2),
            "Tide_Trend": round(float(record.get('Tide_Trend', 0.0)), 3),
            "QC_Rain_mm": round(float(record.get('QC_Rain_mm', 0.0)), 2),
            "QC_Lag1": round(float(record.get('QC_Lag1', 0.0)), 2),
            "QC_Lag2": round(float(record.get('QC_Lag2', 0.0)), 2),
            "QC_3hr_Sum": round(float(record.get('QC_3hr_Sum', 0.0)), 2),
            "QC_6hr_Sum": round(float(record.get('QC_6hr_Sum', 0.0)), 2),
            "Marulas_Rain_mm": round(float(record.get('Marulas_Rain_mm', 0.0)), 2),
            "Mar_Lag1": round(float(record.get('Mar_Lag1', 0.0)), 2),
            "Mar_Lag2": round(float(record.get('Mar_Lag2', 0.0)), 2),
            "Mar_3hr_Sum": round(float(record.get('Mar_3hr_Sum', 0.0)), 2),
            "Mar_6hr_Sum": round(float(record.get('Mar_6hr_Sum', 0.0)), 2),
            "Mar_24hr_Sum": round(float(record.get('Mar_24hr_Sum', 0.0)), 2),
            "Pressure_hPa": round(float(record.get('Pressure_hPa', 0.0)), 2),
            "Press_Trend": round(float(record.get('Press_Trend', 0.0)), 3),
            "Wind_Speed": round(float(record.get('Wind_Speed', 0.0)), 2),
            "Wind_Sin": round(float(record.get('Wind_Sin', 0.0)), 4),
            "Wind_Cos": round(float(record.get('Wind_Cos', 1.0)), 4),
            "Soil_Moisture": round(float(record.get('Soil_Moisture', 0.5)), 2),
            "predicted_alert_class": record.get('predicted_alert_class', 0),
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
    # CallbackAPIVersion is required for paho-mqtt 2.x
    try:
        mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id="SurgeAlertEdge", protocol=mqtt.MQTTv311)
    except AttributeError:
        # Fallback for paho-mqtt 1.x
        mqtt_client = mqtt.Client(client_id="SurgeAlertEdge", protocol=mqtt.MQTTv311)
    
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    mqtt_client.tls_set(tls_version=ssl.PROTOCOL_TLS) # Enable SSL/TLS for secure connection
    
    try:
        print(f" [Net] Connecting to Secure MQTT Broker at {MQTT_BROKER}...")
        
        # Define callback for outbound SMS (Backend asking Pi to send SMS)
        def on_message(client, userdata, msg):
            if msg.topic == "surgealert/outbound/sms":
                try:
                    data = json.loads(msg.payload.decode())
                    num = data.get("number")
                    txt = data.get("message")
                    if num and txt and sms:
                        print(f" [SMS] Received Outbound Request for {num}")
                        sms.send_sms(num, txt)
                except Exception as e:
                    print(f" [SMS] Failed to process outbound MQTT SMS: {e}")

        mqtt_client.on_message = on_message
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.subscribe("surgealert/outbound/sms")
        mqtt_client.loop_start() # Start background thread for MQTT network traffic
        print(" [Net] MQTT Connected & Subscribed to Outbound SMS!")
    except Exception as e:
        print(f" [Net] MQTT Connection Failed: {e}")

    # 1. Initialize Components
    db = DatabaseManager()
    alerter = AlertManager()
    img_proc = ImageProcessor()
    tide_manager = TideManager()
    weather_manager = WeatherManager()
    
    # State variables for periodic weather updates
    current_rain_mm = 0.0
    rain_24h_mm = 0.0
    last_weather_update = 0
    WEATHER_UPDATE_INTERVAL = 900 # 15 Minutes
    
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

    last_log_time = 0           # Force immediate first save
    last_sync_time = time.time()
    last_config_sync = 0
    last_otp_sync = 0
    last_env_sync = 0
    last_sms_time = 0
    last_tide_update = 0
    TIDE_UPDATE_INTERVAL = 1800 # 30 Minutes
    last_weather_update = 0
    WEATHER_UPDATE_INTERVAL = 3600 # 1 Hour (API Data)
    LOG_INTERVAL = 300.0        # Save and send data every 5 minutes
    SYNC_INTERVAL = 60.0        # Check for unsynced data every 60 seconds
    CONFIG_SYNC_INTERVAL = 300.0 # Fetch new residents/templates every 5 mins
    OTP_SYNC_INTERVAL = 60.0     # Fetch new OTPs every 1 min
    ENV_SYNC_INTERVAL = 1800.0   # Fetch ML Features from Backend every 30 mins

    # Local Cache for environmental features
    env_data = {}

    # Start background cleanup task (Every 10 mins to match OTP expiry)
    threading.Thread(target=cleanup_expired_otps_task, args=(db,), daemon=True).start()

    # --- AGGREGATION BUFFERS ---
    # We will collect readings every 1 second, store them here, and process them every 5 minutes.
    buffer_wl = []
    buffer_radar_flow = []
    buffer_img_flow = []
    buffer_img_rise = []
    buffer_sensor_rise = []
    
    prev_wl = None

    try:
        while True:
            start_time = time.time()

            # --- A. DATA GATHERING (Every 5 Seconds for Power Saving) ---
            frame = cam.capture_frame() if cam else np.zeros((480, 640, 3), np.uint8)
            raw_dist = get_distance()
            radar_flow = get_radar_flow() 

            # --- B. PROCESSING ---
            current_wl = calculate_water_level(raw_dist)
            img_flow, img_rise, viz_frame, raw_vectors = img_proc.process_frame(frame, water_level=current_wl)

            # Calculate Sensor-based Rise Rate (m/s)
            sensor_rise = 0.0
            if prev_wl is not None:
                sensor_rise = (current_wl - prev_wl) / 5.0
            prev_wl = current_wl

            # Add to buffers
            buffer_wl.append(current_wl)
            buffer_radar_flow.append(radar_flow)
            buffer_img_flow.append(img_flow)
            buffer_img_rise.append(img_rise)
            buffer_sensor_rise.append(sensor_rise)

            # --- C. PREDICTION & TIDE LOGIC ---
            # Tide and Weather are now FETCHED from the Backend periodically.
            # We use the cached 'env_data' pulled in the sync step E.5.
            tide_future = env_data.get("tide_height", 0.0)
            tide_effect = env_data.get("tide_trend", 0.0)
            
            # Composite Prediction (Current + Rise in 1h + Tide change in 1h)
            rise_rate_h = img_rise * 3600
            pred_level = max(0.0, current_wl + rise_rate_h + tide_effect)
            
            # Intelligent Alert Decision
            current_alert = alerter.determine_alert_level(current_wl, predicted_level=pred_level, rise_rate_per_hour=rise_rate_h)
            pred_alert = alerter.determine_alert_level(pred_level, rise_rate_per_hour=rise_rate_h)

            # --- D. & E. AGGREGATION, LOGGING AND SENDING (Every 5 Minutes) ---
            current_time = time.time()
            if current_time - last_log_time >= LOG_INTERVAL and len(buffer_wl) > 0:
                
                # --- CALCULATE AGGREGATES ---
                import statistics
                agg_wl = statistics.median(buffer_wl)
                agg_radar = statistics.median(buffer_radar_flow)
                agg_img_flow = statistics.median(buffer_img_flow)
                agg_img_rise = statistics.median(buffer_img_rise)
                agg_sensor_rise = statistics.median(buffer_sensor_rise)
                
                # Recalculate alerts based on stable aggregates
                agg_rise_h = agg_img_rise * 3600
                agg_pred_level = max(0.0, agg_wl + agg_rise_h + tide_effect)
                
                agg_alert = alerter.determine_alert_level(agg_wl, predicted_level=agg_pred_level, rise_rate_per_hour=agg_rise_h)
                
                # Weather Data is now pulled from 'env_data'
                weather_payload = {
                    "QC_Rain_mm": env_data.get("qc_rain", 0.0),
                    "QC_Lag1": env_data.get("qc_lag1", 0.0),
                    "QC_Lag2": env_data.get("qc_lag2", 0.0),
                    "QC_3hr_Sum": env_data.get("qc_3h", 0.0),
                    "QC_6hr_Sum": env_data.get("qc_6h", 0.0),
                    "Marulas_Rain_mm": env_data.get("mar_rain", 0.0),
                    "Mar_Lag1": env_data.get("mar_lag1", 0.0),
                    "Mar_Lag2": env_data.get("mar_lag2", 0.0),
                    "Mar_3hr_Sum": env_data.get("mar_3h", 0.0),
                    "Mar_6hr_Sum": env_data.get("mar_6h", 0.0),
                    "Mar_24hr_Sum": env_data.get("mar_24h", 0.0), 
                    "Pressure_hPa": env_data.get("pressure", 1013.25),
                    "Press_Trend": env_data.get("press_trend", 0.0),
                    "Wind_Speed": env_data.get("wind_speed", 0.0),
                    "Wind_Sin": env_data.get("wind_sin", 0.0),
                    "Wind_Cos": env_data.get("wind_cos", 1.0), 
                    "Soil_Moisture_pct": env_data.get("soil_moisture", 0.5)
                }

                # Enforce 5-minute local logging for ALL metrics to strictly match cloud DB sync
                db.log_tide_metrics(tide_now)
                db.log_weather_metrics(weather_data)
                
                # 2. AI-based Alert Prediction (Using Backend Environmental Sync)
                ai_pred_alert = None
                if env_data: 
                    ai_pred_alert = alerter.predict_alert_class(
                        agg_wl, agg_img_rise, agg_sensor_rise, 
                        env_data.get("tide_height", 0.0),
                        env_data.get("qc_rain", 0.0),
                        env_data.get("qc_lag1", 0.0),
                        env_data.get("qc_lag2", 0.0),
                        env_data.get("mar_rain", 0.0),
                        env_data.get("mar_lag1", 0.0),
                        env_data.get("mar_lag2", 0.0),
                        env_data.get("mar_3h", 0.0),
                        env_data.get("mar_6h", 0.0),
                        env_data.get("mar_24h", 0.0),
                        env_data.get("pressure", 1013.25),
                        env_data.get("wind_speed", 0.0),
                        env_data.get("soil_moisture", 0.5)
                    )
                
                if ai_pred_alert:
                    agg_pred_alert = ai_pred_alert
                else:
                    print(" [AI] Environmental Data missing. Skipping ML classification.")
                    agg_pred_alert = agg_alert 
                    pred_class = None 

                # 3. Log ML Features Realtime
                alert_map = {"GREEN": 0, "YELLOW": 1, "ORANGE": 2, "RED": 3, "CRITICAL": 3}
                pred_class = alert_map.get(agg_pred_alert, 0)
                db.log_ml_features(agg_wl, agg_img_rise, agg_sensor_rise, tide_future, tide_effect, weather_payload, pred_class)

                # Clear buffers
                buffer_wl.clear()
                buffer_radar_flow.clear()
                buffer_img_flow.clear()
                buffer_img_rise.clear()
                buffer_sensor_rise.clear()

                # 4. Log to Local SQLite (Strictly skip sensor_data if simulated)
                record_id = None
                if cam is not None:
                    record_id = db.log_sensor_data(
                        water_level=agg_wl,
                        sensor_flow=agg_radar,
                        img_flow=agg_img_flow,
                        img_rise=agg_img_rise,
                        sensor_rise=agg_sensor_rise,
                        pred_level=agg_pred_level,
                        alert_level=agg_alert,
                        pred_alert_level=agg_pred_alert,
                        tide_future=tide_future,
                        tide_trend=tide_effect,
                        weather_data=weather_payload,
                        pred_class=pred_class,
                        raw_vectors=raw_vectors
                    )

                # 5. Prepare Backend Upload & Log Snapshot
                b64_img = ""
                if viz_frame is not None:
                    _, buf = cv2.imencode('.jpg', viz_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    b64_img = base64.b64encode(buf).decode('utf-8')
                    if record_id:
                        db.log_snapshot(record_id, b64_img)

                payload = {
                    "water_level": round(float(agg_wl), 2),
                    "sensorFlowRateMps": round(float(agg_radar), 2),
                    "imageFlowRateMps": round(float(agg_img_flow), 2),
                    "rise_rate": round(float(agg_img_rise), 2),
                    "sensor_rise_rate": round(float(agg_sensor_rise), 2),
                    "currentAlertLevel": agg_alert,
                    "predictedLevel": round(float(agg_pred_level), 2),
                    "predictedAlertLevel": agg_pred_alert,
                    "Tide_Height_m": round(float(tide_future), 2),
                    "Tide_Trend": round(float(tide_effect), 3),
                    "QC_Rain_mm": round(float(weather_payload["QC_Rain_mm"]), 2),
                    "QC_Lag1": round(float(weather_payload["QC_Lag1"]), 2),
                    "QC_Lag2": round(float(weather_payload["QC_Lag2"]), 2),
                    "QC_3hr_Sum": round(float(weather_payload["QC_3hr_Sum"]), 2),
                    "QC_6hr_Sum": round(float(weather_payload["QC_6hr_Sum"]), 2),
                    "Marulas_Rain_mm": round(float(weather_payload["Marulas_Rain_mm"]), 2),
                    "Mar_Lag1": round(float(weather_payload["Mar_Lag1"]), 2),
                    "Mar_Lag2": round(float(weather_payload["Mar_Lag2"]), 2),
                    "Mar_3hr_Sum": round(float(weather_payload["Mar_3hr_Sum"]), 2),
                    "Mar_6hr_Sum": round(float(weather_payload["Mar_6hr_Sum"]), 2),
                    "Mar_24hr_Sum": round(float(weather_payload["Mar_24hr_Sum"]), 2),
                    "Pressure_hPa": round(float(weather_payload["Pressure_hPa"]), 2),
                    "Press_Trend": round(float(weather_payload["Press_Trend"]), 3),
                    "Wind_Speed": round(float(weather_payload["Wind_Speed"]), 2),
                    "Wind_Sin": round(float(weather_payload["Wind_Sin"]), 4),
                    "Wind_Cos": round(float(weather_payload["Wind_Cos"]), 4),
                    "predicted_alert_class": pred_class,
                    "Soil_Moisture": round(float(weather_payload["Soil_Moisture_pct"]), 2),
                    "is_simulated": cam is None,
                    "snapshotBase64": b64_img
                }

                # 6. Send to Java Backend via MQTT in Thread
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

            # --- E.3. SYSTEM CONFIG SYNC (Residents/Templates - Every 5 mins) ---
            if current_time - last_config_sync >= CONFIG_SYNC_INTERVAL:
                threading.Thread(target=sync_system_config, args=(db, "all")).start()
                last_config_sync = current_time

            # --- E.4. OTP FAST SYNC (Every 1 min) ---
            if current_time - last_otp_sync >= OTP_SYNC_INTERVAL:
                threading.Thread(target=sync_system_config, args=(db, "otp")).start()
                last_otp_sync = current_time

            # --- E.5. ENVIRONMENTAL SYNC (Every 30 mins) ---
            if current_time - last_env_sync >= ENV_SYNC_INTERVAL:
                def fetch_and_set():
                    nonlocal env_data
                    res = sync_environmental_data()
                    if res: env_data = res
                threading.Thread(target=fetch_and_set).start()
                last_env_sync = current_time

            # --- F. EMERGENCY SMS ALERTING (Using Local Templates) ---
            if current_alert in ["ORANGE", "RED"]:
                print(f" [ALERT] {current_alert} LEVEL DETECTED! (SMS processing...)")
                current_time = time.time()
                # Rate limit SMS to every 5 minutes per alert state
                if current_time - last_sms_time >= 300: 
                    try:
                        recipients = db.get_all_registered_phone_numbers()
                        template = db.get_template(current_alert)
                        
                        if recipients and sms:
                            # Fallback if no template synced yet
                            msg = template if template else f"SURGE ALERT: {current_alert}! Water level at {current_wl:.2f}m. Evacuate if necessary."
                            # Replace placeholders if they exist in template
                            msg = msg.replace("{{level}}", f"{current_wl:.2f}m")
                            msg = msg.replace("{{alert}}", current_alert)

                            for number in recipients:
                                threading.Thread(target=sms.send_sms, args=(number, msg)).start()
                            last_sms_time = current_time
                    except Exception as e:
                        print(f" [SMS] Failed to process emergency alerts: {e}")

            # --- G. VISUALIZATION & OUTPUT ---
            print(f"WL: {current_wl:.2f}m | Tide: {tide_effect:+.3f}m | Pred: {pred_level:.2f}m | P.Alert: {pred_alert}", flush=True)

            # Control loop speed (Maintains 1 sample every 5 seconds for power saving)
            elapsed = time.time() - start_time
            if elapsed < 5.0:
                time.sleep(5.0 - elapsed)

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