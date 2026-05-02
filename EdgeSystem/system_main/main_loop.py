import time
import cv2
import requests # REQUIRED: pip install requests
import json
from config.settings import USE_HARDWARE

# Import system components
from system_main.database_manager import DatabaseManager
# Assuming you renamed sms_sender.py to sms_manager.py or class name match
from system_main.sms_manager import SMSManager 
from system_main.data_logger import DataLogger
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level

# --- DRIVER IMPORTS ---
if USE_HARDWARE:
    print("LOADING HARDWARE DRIVERS...")
    # Import the new Camera Driver
    from hardware.camera.pi_camera_driver import PiCameraDriver
    
    # Note: You still need to implement your Radar/Ultrasonic drivers
    # For now, we will assume they are not ready and define placeholders below
    # from hardware.sensors.ultrasonic_driver import UltrasonicDriver
    # from hardware.sensors.radar_driver import RadarDriver
else:
    print("LOADING SIMULATION DRIVERS...")
    from simulation.sensors.ultrasonic_simulator import UltrasonicSimulator
    from simulation.sensors.radar_simulator import RadarSimulator
    from simulation.camera.camera_simulator import CameraSimulator

# --- NETWORK FUNCTION ---
def send_data_to_backend(water_level, sensor_flow, image_flow, image_rise, alert_level):
    """
    Sends sensor data to the Java Spring Boot Backend.
    Returns the JSON response from the server (containing commands).
    """
    url = "http://localhost:8080/api/sensor-data" # Update IP if not running locally
    
    # Keys MUST match the Java SensorDataDTO exactly
    payload = {
        "waterLevelM": water_level,
        "sensorFlowRateMps": sensor_flow,
        "imageFlowRateMps": image_flow,
        "imageRiseRateMps": image_rise,
        "currentAlertLevel": alert_level
    }
    
    try:
        headers = {'Content-Type': 'application/json'}
        # Timeout set to 2 seconds so we don't block the loop if server is down
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=2)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f" >> Backend returned error: {response.status_code}")
            return None
            
    except requests.exceptions.ConnectionError:
        print(" >> Connection Error: Could not reach Java Backend.")
        return None
    except Exception as e:
        print(f" >> Error sending data: {e}")
        return None


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
            # Initialize the real camera
            camera = PiCameraDriver()
        except Exception as e:
            print(f"CRITICAL ERROR: Camera failed to start: {e}")
            return

        # PLACEHOLDERS for sensors
        print("WARNING: Real sensors not yet implemented. Using 0.0 values.")
        ultrasonic_sensor = None 
        radar_sensor = None
    else:
        print("--- SIMULATION MODE ACTIVE ---")
        ultrasonic_sensor = UltrasonicSimulator()
        radar_sensor = RadarSimulator()
        camera = CameraSimulator()

    previous_alert_level = None 

    print("\n--- System Initialized. Starting Main Loop (Press Ctrl+C to exit) ---")

    try:
        while True:
            # --- 3. Data Collection ---
            if USE_HARDWARE:
                # Use real camera
                frame = camera.capture_frame()
                
                # Placeholder logic for sensors until you write those drivers
                raw_distance_m = 5.0 # Default "safe" distance
                sensor_flow_rate_mps = 0.0
                
                # If you have real sensors later, uncomment this:
                # raw_distance_m = ultrasonic_sensor.get_distance()
                # sensor_flow_rate_mps = radar_sensor.get_flow_rate()
            else:
                # Use simulators
                raw_distance_m = ultrasonic_sensor.read_distance()
                sensor_flow_rate_mps = radar_sensor.read_flow_rate()
                frame = camera.capture_frame()

            # --- 4. Data Processing ---
            water_level_m = calculate_water_level(raw_distance_m)
            
            # Process Image (Works for both Hardware and Simulation frames)
            image_flow_rate_mps, image_rise_rate_mps, visualized_frame = image_processor.process_frame(frame)
            
            combined_flow_rate = (sensor_flow_rate_mps + image_flow_rate_mps) / 2

            # --- 5. Alert Determination ---
            current_alert_level = alert_manager.determine_alert_level(
                water_level=water_level_m,
                flow_rate=combined_flow_rate,
                rise_rate=image_rise_rate_mps
            )

            # --- 6. Logging and Network Transmission ---
            print(f"DATA: WL={water_level_m:.2f}m | Flow={combined_flow_rate:.2f}m/s | Rise={image_rise_rate_mps:.2f}m/s  ==>  ALERT: {current_alert_level}")
           
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
                alert_level=current_alert_level
            )

            # --- 7. Action Logic (SMS) ---
            sms_sent_this_cycle = False

            # Priority 1: Command from Backend (Server-Controlled)
            if backend_response and backend_response.get("command") == "SEND_SMS":
                print(f" >> BACKEND COMMAND: Sending SMS to residents...")
                # Use the message provided by backend, or fallback to local template
                backend_message = backend_response.get("message") 
                if backend_message:
                    # If backend gives text, use a generic send method if available, 
                    # or just trigger the level-based alert
                     sms_manager.send_alert(current_alert_level) 
                else:
                    sms_manager.send_alert(current_alert_level)
                sms_sent_this_cycle = True

            # Priority 2: Local Logic (Offline Fallback)
            # Only run this if backend didn't already trigger it and we are offline/backend failed
            elif backend_response is None and current_alert_level != previous_alert_level:
                print(f"!!! ALERT LEVEL CHANGE (Offline Mode): {previous_alert_level} -> {current_alert_level} !!!")
                if current_alert_level != "GREEN":
                    sms_manager.send_alert(current_alert_level)
                sms_sent_this_cycle = True
            
            # Update previous state
            previous_alert_level = current_alert_level
           
            # --- 8. Visualization ---
            if visualized_frame is not None:
                cv2.imshow("SurgeAlert Live Feed", visualized_frame)
                # Press 'q' to quit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
           
            time.sleep(2)

    except KeyboardInterrupt:
        print("\n--- Shutdown signal received. Exiting gracefully. ---")
    finally:
        # Clean up hardware
        if USE_HARDWARE and 'camera' in locals() and hasattr(camera, 'close'):
            camera.close()
        cv2.destroyAllWindows()
        print("System shutdown complete.")

if __name__ == "__main__":
    main()