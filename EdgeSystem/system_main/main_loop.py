import time
import json
import requests
import base64
import cv2
from datetime import datetime

# Import system components
from system_main.database_manager import DatabaseManager
from system_main.sms_manager import SMSManager
from system_main.data_logger import DataLogger
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level
from config.settings import USE_HARDWARE, BACKEND_API_URL, EDGE_API_KEY

# --- DRIVER IMPORTS ---
if USE_HARDWARE:
    print("LOADING HARDWARE DRIVERS...")
    from hardware.camera.pi_camera_driver import PiCameraDriver
    # UPDATED: Import the functions from the new ultrasonic driver
    from hardware.sensors.ultrasonic_driver import init_sensor, get_distance
    # from hardware.sensors.radar_driver import get_flow_rate # Uncomment when radar is ready
else:
    print("LOADING SIMULATION DRIVERS...")
    from simulation.sensors.ultrasonic_simulator import UltrasonicSimulator
    from simulation.sensors.radar_simulator import RadarSimulator
    from simulation.camera.camera_simulator import CameraSimulator

# --- NETWORK FUNCTION ---
def send_data_to_backend(water_level, sensor_flow, image_flow, image_rise, alert_level, frame=None):
    """
    Sends sensor data and live video frame to Java Backend.
    """
    url = f"{BACKEND_API_URL}/sensor-data"
    
    # 1. Encode Image to Base64 for Live View
    snapshot_base64 = ""
    if frame is not None:
        try:
            # Encode frame to jpg
            retval, buffer = cv2.imencode('.jpg', frame)
            if retval:
                # Convert to base64 string
                snapshot_base64 = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            print(f"Error encoding frame: {e}")

    # Keys MUST match the Java SensorDataDTO exactly
    payload = {
        "waterLevelM": water_level,
        "sensorFlowRateMps": sensor_flow,
        "imageFlowRateMps": image_flow,
        "imageRiseRateMps": image_rise,
        "currentAlertLevel": alert_level,
        "snapshotBase64": snapshot_base64  # Matches Java DTO
    }

    try:
        # 2. Add Security Header
        headers = {
            'Content-Type': 'application/json',
            'X-Edge-ApiKey': EDGE_API_KEY 
        }
        
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=2)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 403:
             print(f" >> AUTH ERROR: Backend rejected API Key.")
             return None
        else:
            print(f" >> Backend returned error: {response.status_code}")
            return None

    except requests.exceptions.ConnectionError:
        # Expected if Java backend is offline or restarting
        return None
    except Exception as e:
        print(f" >> Error sending data: {e}")
        return None

def sync_residents_from_backend(db_manager):
    """
    Fetches active phone numbers from Java Backend and saves to local DB.
    """
    url = f"{BACKEND_API_URL}/residents/active"
    headers = {'X-Edge-ApiKey': EDGE_API_KEY}
    try:
        response = requests.get(url, headers=headers, timeout=3)
        if response.status_code == 200:
            online_numbers = response.json() # Expecting List<String>
            
            # Get local numbers
            local_numbers = db_manager.get_all_registered_phone_numbers()
            
            count = 0
            for num in online_numbers:
                if num not in local_numbers:
                    db_manager.register_resident(num)
                    count += 1
            
            if count > 0:
                print(f" >> SYNC: Downloaded {count} new residents from Cloud.")
    except Exception:
        pass # Fail silently, will try again next cycle

def main():
    """The main entry point and continuous loop for the EdgeSystem."""
    print("--- Initializing SurgeAlert EdgeSystem ---")

    # 1. Initialize all system components
    db_manager = DatabaseManager()
    sms_manager = SMSManager(db_manager)
    data_logger = DataLogger(db_manager)
    alert_manager = AlertManager()
    image_processor = ImageProcessor()

    # 2. Initialize Sensors and Camera
    if USE_HARDWARE:
        print("--- HARDWARE MODE ACTIVE ---")
        try:
            camera = PiCameraDriver()
            
            # UPDATED: Initialize the Ultrasonic Sensor here
            init_sensor() 
            print("Ultrasonic Sensor Initialized.")
            
        except Exception as e:
            print(f"CRITICAL ERROR: Camera/Sensor failed to start: {e}")
            return
    else:
        print("--- SIMULATION MODE ACTIVE ---")
        ultrasonic_sensor = UltrasonicSimulator()
        radar_sensor = RadarSimulator()
        camera = CameraSimulator()

    previous_alert_level = None
    last_sync_time = 0
    SYNC_INTERVAL = 60 # Seconds between resident syncs

    print("\n--- System Initialized. Starting Main Loop (Press Ctrl+C to exit) ---")

    try:
        while True:
            # --- 3. Resident Synchronization (Periodic) ---
            current_time = time.time()
            if current_time - last_sync_time > SYNC_INTERVAL:
                sync_residents_from_backend(db_manager)
                last_sync_time = current_time

            # --- 4. Data Collection ---
            if USE_HARDWARE:
                frame = camera.capture_frame()
                
                # UPDATED: Use the real driver function
                raw_distance_m = get_distance()
                
                # Placeholder for radar flow rate (0.0 until you wire the radar)
                sensor_flow_rate_mps = 0.0 
            else:
                # Use simulators
                raw_distance_m = ultrasonic_sensor.read_distance()
                sensor_flow_rate_mps = radar_sensor.read_flow_rate()
                frame = camera.capture_frame()

            # --- 5. Data Processing ---
            water_level_m = calculate_water_level(raw_distance_m)
            
            # Process Image
            image_flow_rate_mps, image_rise_rate_mps, visualized_frame = image_processor.process_frame(frame)

            combined_flow_rate = (sensor_flow_rate_mps + image_flow_rate_mps) / 2

            # --- 6. Alert Determination ---
            current_alert_level = alert_manager.determine_alert_level(
                water_level_m=water_level_m,
                flow_rate_mps=combined_flow_rate,
                rise_rate_mps=image_rise_rate_mps
            )

            # --- 7. Logging and Transmission ---
            print(f"DATA: WL={water_level_m:.2f}m | Flow={combined_flow_rate:.2f}m/s | Rise={image_rise_rate_mps:.2f}m/s ==> ALERT: {current_alert_level}")

            # A. Log to Local Database
            data_logger.log_cycle_data(
                water_level=water_level_m,
                sensor_flow=sensor_flow_rate_mps,
                image_flow=image_flow_rate_mps,
                image_rise=image_rise_rate_mps,
                alert_level=current_alert_level
            )

            # B. Send to Java Backend & Receive Commands
            backend_response = send_data_to_backend(
                water_level=water_level_m,
                sensor_flow=sensor_flow_rate_mps,
                image_flow=image_flow_rate_mps,
                image_rise=image_rise_rate_mps,
                alert_level=current_alert_level,
                frame=visualized_frame 
            )

            # --- 8. Action Logic (SMS) ---
            sms_sent_this_cycle = False

            # Priority 1: Command from Backend (Server-Controlled)
            if backend_response and backend_response.get("command") == "SEND_SMS":
                print(f" >> BACKEND COMMAND: Sending SMS to residents...")
                backend_message = backend_response.get("message")
                recipients = backend_response.get("recipients") # Get list from server

                if backend_message:
                    # Send to specific list from server (Online Mode)
                    sms_manager.send_alert(current_alert_level, explicit_recipients=recipients)
                else:
                    # Fallback
                    sms_manager.send_alert(current_alert_level)
                sms_sent_this_cycle = True

            # Priority 2: Local Logic (Offline Fallback)
            elif backend_response is None and current_alert_level != previous_alert_level:
                print(f"!!! ALERT LEVEL CHANGE (Offline Mode): {previous_alert_level} -> {current_alert_level} !!!")
                if current_alert_level != "GREEN":
                    sms_manager.send_alert(current_alert_level)
                    sms_sent_this_cycle = True

            # Update previous state
            previous_alert_level = current_alert_level

            # --- 9. Visualization ---
            if visualized_frame is not None:
                cv2.imshow("SurgeAlert Live Feed", visualized_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            
            # Small delay to prevent CPU overloading
            time.sleep(0.1) 

    except KeyboardInterrupt:
        print("\n--- Shutdown signal received. Exiting gracefully. ---")
    finally:
        if USE_HARDWARE and 'camera' in locals() and hasattr(camera, 'close'):
            camera.close()
        cv2.destroyAllWindows()
        print("System shutdown complete.")

if __name__ == "__main__":
    main()