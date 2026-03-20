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

from config.settings import BACKEND_API_URL, EDGE_API_KEY
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

def send_to_backend(payload):
    """Sends JSON payload to Java Backend in a background thread."""
    try:
        headers = {'Content-Type': 'application/json', 'X-Edge-ApiKey': EDGE_API_KEY}
        response = requests.post(f"{BACKEND_API_URL}/sensor-data", data=json.dumps(payload), headers=headers, timeout=5)
        if response.status_code != 200:
            print(f" [Net] Warning: Backend returned {response.status_code}")
    except Exception as e:
        # Silenced during local data collection so it doesn't spam the console
        pass

def main():
    print("--- STARTING SURGE ALERT EDGE SYSTEM (DATA COLLECTION MODE) ---")
    
    # 1. Initialize Components
    db = DatabaseManager()
    alerter = AlertManager()
    img_proc = ImageProcessor()
    tide_manager = TideManager()
    # sms = SMSManager() # GSM Initializer (Commented out)
    
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
    last_sms_time = 0
    LOG_INTERVAL = 10.0         # Set this to 10 seconds

    try:
        while True:
            start_time = time.time()

            # --- A. DATA COLLECTION ---
            # Safety check for laptop camera
            frame = cam.capture_frame() if cam else np.zeros((480, 640, 3), np.uint8)
            raw_dist = get_distance()
            radar_flow = get_radar_flow() 

            # --- B. PROCESSING ---
            current_wl = calculate_water_level(raw_dist)
            img_flow, img_rise, viz_frame, raw_vectors = img_proc.process_frame(frame)

            # --- C. PREDICTION & TIDE LOGIC (AI Muted for Data Collection) ---
            tide_now = tide_manager.get_tide_at_time(hours_offset=0)
            tide_future = tide_manager.get_tide_at_time(hours_offset=1)
            tide_effect = tide_future - tide_now
            
            # Temporary Prediction: Just Current Level + Tide Effect (AI bypassed)
            pred_level = max(0.0, current_wl + tide_effect)

            # Determine Alert Levels (Rule Based)
            current_alert = alerter.determine_alert_level(current_wl)
            pred_alert = alerter.determine_alert_level(pred_level)

            # --- D. & E. LOGGING AND SENDING (Only runs every 10 seconds) ---
            current_time = time.time()
            if current_time - last_log_time >= LOG_INTERVAL:
                
                # 1. Log to Local SQLite
                db.log_sensor_data(
                    water_level=current_wl,
                    sensor_flow=radar_flow,
                    img_flow=img_flow,
                    img_rise=img_rise,
                    pred_level=pred_level,
                    alert_level=current_alert,
                    pred_alert_level=pred_alert,
                    raw_vectors=raw_vectors
                )

                # 2. Prepare Backend Upload
                b64_img = ""
                if viz_frame is not None:
                    _, buf = cv2.imencode('.jpg', viz_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    b64_img = base64.b64encode(buf).decode('utf-8')

                payload = {
                    "waterLevelM": round(float(current_wl), 2),
                    "sensorFlowRateMps": round(float(radar_flow), 2),
                    "imageFlowRateMps": round(float(img_flow), 2),
                    "imageRiseRateMps": round(float(img_rise), 2),
                    "currentAlertLevel": current_alert,
                    "predictedLevel": round(float(pred_level), 2),
                    "predictedAlertLevel": pred_alert,
                    "snapshotBase64": b64_img
                }

                # 3. Send to Java Backend via Thread
                threading.Thread(target=send_to_backend, args=(payload,)).start()

                # Reset the timer!
                last_log_time = current_time 

            # --- F. OFFLINE FAILSAFE (SIM7600G-H) - FULLY RESTORED ---
            if current_alert == "RED":
                print(" [ALERT] RED LEVEL DETECTED! (SMS logic prepared)")
                # current_time = time.time()
                # if current_time - last_sms_time >= 300: 
                #     try:
                #         recipients = db.get_all_registered_phone_numbers()
                #         if recipients:
                #             # sms = SMSManager(port=GSM_PORT, baudrate=GSM_BAUDRATE)
                #             for number in recipients:
                #                 msg = (f"SURGE ALERT: CRITICAL! Water level at {current_wl:.2f}m. "
                #                        f"Flow: {radar_flow:.2f}mps. Evacuate immediately!")
                #                 # threading.Thread(target=sms.send_sms, args=(number, msg)).start()
                #             last_sms_time = current_time
                #     except Exception as e:
                #         print(f" [SMS] Failed to process emergency alerts: {e}")

            # --- G. VISUALIZATION & OUTPUT ---
            print(f"WL: {current_wl:.2f}m | Tide: {tide_effect:+.3f}m | Pred: {pred_level:.2f}m | P.Alert: {pred_alert}")

            # Control loop speed (Maintains the 10 FPS)
            elapsed = time.time() - start_time
            if elapsed < 0.1:
                time.sleep(0.1 - elapsed)

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

if __name__ == "__main__":
    main()