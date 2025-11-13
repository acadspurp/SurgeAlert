# EdgeSystem/system_main/main_loop.py
import time
import cv2
from config.settings import USE_HARDWARE

# Import system components
from system_main.database_manager import DatabaseManager
from system_main.sms_sender import SMSSender
from system_main.data_logger import DataLogger
from alert_logic.alert_manager import AlertManager
from processing.image_processor import ImageProcessor
from processing.sensor_data_processor import calculate_water_level

# Import simulators or hardware drivers based on settings
if USE_HARDWARE:
    print("Attempting to use HARDWARE drivers (not yet implemented).")
    # from hardware.sensors import ultrasonic_driver, radar_driver
    # from hardware.camera.pi_camera_driver import PiCameraDriver
else:
    print("Using SIMULATION drivers.")
    from simulation.sensors import ultrasonic_simulator, radar_simulator
    from simulation.camera.camera_simulator import CameraSimulator

def main():
    """The main entry point and continuous loop for the EdgeSystem."""
    print("--- Initializing SurgeAlert EdgeSystem ---")

    # 1. Initialize all system components
    db_manager = DatabaseManager()
    sms_sender = SMSSender(db_manager)
    data_logger = DataLogger(db_manager)
    alert_manager = AlertManager()
    image_processor = ImageProcessor()
    
    camera = CameraSimulator() if not USE_HARDWARE else None # Replace with PiCameraDriver later

    if camera is None and USE_HARDWARE:
        print("ERROR: Hardware camera not yet implemented.")
        return

    previous_alert_level = None # Use None to force initial state check

    print("\n--- System Initialized. Starting Main Loop (Press Ctrl+C to exit) ---")

    try:
        while True:
            # --- 2. Data Collection ---
            raw_distance_m = ultrasonic_simulator.get_distance()
            sensor_flow_rate_mps = radar_simulator.get_flow_rate()
            frame = camera.capture_frame()

            # --- 3. Data Processing ---
            water_level_m = calculate_water_level(raw_distance_m)
            image_flow_rate_mps, image_rise_rate_mps, visualized_frame = image_processor.process_frame(frame)
            combined_flow_rate = (sensor_flow_rate_mps + image_flow_rate_mps) / 2

            # --- 4. Alert Determination ---
            current_alert_level = alert_manager.determine_alert_level(
                water_level=water_level_m,
                flow_rate=combined_flow_rate,
                rise_rate=image_rise_rate_mps
            )

            # --- 5. Logging and Action ---
            print(f"DATA: Water Level={water_level_m:.2f}m | Flow={combined_flow_rate:.2f}m/s | Rise={image_rise_rate_mps:.2f}m/s  ==>  ALERT: {current_alert_level}")
            
            data_logger.log_cycle_data(
                water_level=water_level_m,
                sensor_flow=sensor_flow_rate_mps,
                image_flow=image_flow_rate_mps,
                image_rise=image_rise_rate_mps,
                alert_level=current_alert_level
            )

            if current_alert_level != previous_alert_level:
                print(f"!!! ALERT LEVEL CHANGE: {previous_alert_level} -> {current_alert_level} !!!")
                # We don't send SMS for "GREEN"
                if current_alert_level != "GREEN":
                    sms_sender.send_alert(current_alert_level)
                previous_alert_level = current_alert_level
            
            # --- 6. Visualization (for debugging) ---
            if visualized_frame is not None:
                cv2.imshow("Live Feed - SurgeAlert EdgeSystem", visualized_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            
            time.sleep(2)

    except KeyboardInterrupt:
        print("\n--- Shutdown signal received. Exiting gracefully. ---")
    finally:
        cv2.destroyAllWindows()
        print("System shutdown complete.")

if __name__ == "__main__":
    main()