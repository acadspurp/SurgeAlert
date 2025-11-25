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

from config.settings import USE_HARDWARE, BACKEND_API_URL, EDGE_API_KEY
from system_main.database_manager import DatabaseManager
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level
from processing.tide_manager import TideManager

# Import Hardware Drivers or Simulators based on settings
if USE_HARDWARE:
    print(" [System] Loading Hardware Drivers...")
    from hardware.camera.pi_camera_driver import PiCameraDriver
    from hardware.sensors.ultrasonic_driver import get_distance, init_sensor as init_ultrasonic
    
    # Radar Driver (RCWL-0516)
    try:
        from hardware.sensors.radar_driver import get_flow_rate as get_radar_flow, init_radar
    except ImportError:
        print(" [System] Warning: Radar driver not found. Using dummy.")
        def get_radar_flow(): return 0.0
        def init_radar(): pass
else:
    print(" [System] Loading Simulators...")
    from simulation.camera.camera_simulator import CameraSimulator
    from simulation.sensors.ultrasonic_simulator import UltrasonicSimulator
    from simulation.sensors.radar_simulator import RadarSimulator

def send_to_backend(payload):
    """
    Sends JSON payload to Java Backend in a background thread.
    """
    try:
        headers = {'Content-Type': 'application/json', 'X-Edge-ApiKey': EDGE_API_KEY}
        # Post to the Java Controller Endpoint
        response = requests.post(f"{BACKEND_API_URL}/sensor-data", data=json.dumps(payload), headers=headers, timeout=5)
        if response.status_code != 200:
            print(f" [Net] Warning: Backend returned {response.status_code}")
    except Exception as e:
        print(f" [Net] Upload Error: {e}")

def main():
    print("--- STARTING SURGE ALERT EDGE SYSTEM ---")
    
    # 1. Initialize Components
    db = DatabaseManager()
    alerter = AlertManager()
    img_proc = ImageProcessor()
    tide_manager = TideManager()
    
    # 2. Initialize Sensors
    if USE_HARDWARE:
        try:
            # Initialize Camera
            cam = PiCameraDriver()
            
            # Initialize Sensors (GPIO)
            init_ultrasonic()
            init_radar()
        except Exception as e:
            print(f" [FATAL] Hardware Initialization Failed: {e}")
            return
    else:
        cam = CameraSimulator()
        us_sim = UltrasonicSimulator()
        rad_sim = RadarSimulator()

    try:
        while True:
            start_time = time.time()

            # --- A. DATA COLLECTION ---
            # 1. Capture Image
            frame = cam.capture_frame()
            
            # 2. Read Sensors
            if USE_HARDWARE:
                raw_dist = get_distance()
                radar_flow = get_radar_flow() 
            else:
                raw_dist = us_sim.read_distance()
                radar_flow = rad_sim.read_flow_rate()

            # --- B. PROCESSING ---
            # Convert raw distance to water level 
            current_wl = calculate_water_level(raw_dist)
            
            # Computer Vision (Optical Flow & Rise Rate)
            img_flow, img_rise, viz_frame, raw_vectors = img_proc.process_frame(frame)

            # --- C. AI PREDICTION & TIDE LOGIC ---
            
            # 1. Standard AI Prediction (Based on Flow/Rise)
            prediction_input_flow = max(img_flow, radar_flow)
            base_ai_prediction = alerter.predict_future_level(current_wl, prediction_input_flow, img_rise)
            
            # 2. Tide Adjustment Logic
            # Get tide height NOW (scaled for aquarium)
            tide_now = tide_manager.get_tide_at_time(hours_offset=0)
            # Get tide height in 1 HOUR (scaled for aquarium)
            tide_future = tide_manager.get_tide_at_time(hours_offset=1)
            
            # Calculate the physical rise caused by tide
            tide_effect = tide_future - tide_now
            
            # 3. Final Prediction (AI + Tide)
            pred_level = base_ai_prediction + tide_effect
            
            # Safety clamp
            pred_level = max(0.0, pred_level)

            # Determine Alert Levels (Rule Based)
            current_alert = alerter.determine_alert_level(current_wl)
            pred_alert = alerter.determine_alert_level(pred_level)

            # --- D. LOCAL LOGGING ---
            # Log to SQLite on the Pi
            db.log_sensor_data(
                water_level=current_wl,
                sensor_flow=radar_flow,
                img_flow=img_flow,
                img_rise=img_rise,
                pred_level=pred_level,
                alert_level=current_alert,
                pred_alert_level=pred_alert, # <--- PASSING THE PREDICTED ALERT NOW
                raw_vectors=raw_vectors
            )

            # --- E. BACKEND UPLOAD ---
            # Compress Image to Base64 for Dashboard viewing
            b64_img = ""
            if viz_frame is not None:
                # Compress to 50% quality to save bandwidth
                _, buf = cv2.imencode('.jpg', viz_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                b64_img = base64.b64encode(buf).decode('utf-8')

            # Create Payload matching Java SensorDataDTO
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

            # Send non-blocking (don't wait for Java to reply)
            threading.Thread(target=send_to_backend, args=(payload,)).start()

            # --- F. OFFLINE FAILSAFE (Simulated) ---
            if current_alert == "RED":
                recipients = db.get_all_registered_phone_numbers()
                if recipients:
                    # Placeholder for GSM logic
                    pass

            # --- G. VISUALIZATION & OUTPUT ---
            print(f"WL: {current_wl:.2f}m | Tide: {tide_effect:+.3f}m | Pred: {pred_level:.2f}m | P.Alert: {pred_alert}")

            # Control loop speed (approx 10 FPS / 0.1s delay)
            elapsed = time.time() - start_time
            if elapsed < 0.1:
                time.sleep(0.1 - elapsed)

    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        if USE_HARDWARE:
            cam.close()
            # Clean up GPIO
            import RPi.GPIO as GPIO
            GPIO.cleanup()
            print("Hardware Released.")

if __name__ == "__main__":
    main()