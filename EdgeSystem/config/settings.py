# EdgeSystem/config/settings.py
import os

# --- General System Settings ---
# Set to True when you have actual sensors/camera connected to the Raspberry Pi
USE_HARDWARE = False

# Path to the base directory of the EdgeSystem project
# This helps in creating paths that work regardless of where the script is run from
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- Database Settings (SQLite) ---
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
DATABASE_NAME = 'surgealert.db'
DATABASE_PATH = os.path.join(DATABASE_DIR, DATABASE_NAME)

# --- Sensor Simulation Settings ---
SIM_ULTRASONIC_MIN_DIST = 0.5  # meters
SIM_ULTRASONIC_MAX_DIST = 3.0  # meters
SIM_RADAR_MIN_FLOW = 0.0      # m/s
SIM_RADAR_MAX_FLOW = 1.8      # m/s

# --- Camera Simulation Settings ---
# Path to a sample image that the simulator will "capture" (relative to EdgeSystem root)
# You will need to place a sample_water.jpg in this path for the simulator to work initially
SIM_CAMERA_SAMPLE_IMAGE_PATH = os.path.join('simulation', 'camera', 'sample_images', 'sample_water.jpg')
# Path to a folder containing a sequence of images for flow simulation
SIM_CAMERA_SEQUENCE_PATH = os.path.join('simulation', 'camera', 'sample_images', 'river_sequence')


# --- Image Processing Settings ---
IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480
# Shi-Tomasi parameters (adjust as needed later)
MAX_CORNERS = 100
QUALITY_LEVEL = 0.01
MIN_DISTANCE = 10
# Lucas-Kanade parameters (adjust as needed later)
LK_WINDOW_SIZE = (15, 15)
LK_MAX_LEVEL = 2
LK_CRITERIA = (3, 10, 0.03) # (type, max_iter, epsilon)

# --- Alert Thresholds (for alert_manager.py) ---
# These will be used by the alert_manager to determine alert levels
# You'll refine these significantly during testing
WATER_LEVEL_YELLOW_THRESHOLD = 1.5 # meters
WATER_LEVEL_ORANGE_THRESHOLD = 2.5 # meters
WATER_LEVEL_RED_THRESHOLD = 3.5  # meters

FLOW_RATE_YELLOW_THRESHOLD = 0.8 # m/s
FLOW_RATE_ORANGE_THRESHOLD = 1.5 # m/s
FLOW_RATE_RED_THRESHOLD = 2.5  # m/s

RISE_RATE_YELLOW_THRESHOLD = 0.05 # m/s (e.g., rising 5cm/sec)
RISE_RATE_ORANGE_THRESHOLD = 0.15 # m/s
RISE_RATE_RED_THRESHOLD = 0.3 # m/s

# --- SMS Settings ---
SMS_TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates', 'sms_alerts')
# Placeholder for SMS gateway credentials (e.g., Twilio SID, Auth Token) - DO NOT HARDCODE REAL ONES HERE YET!
TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN = "your_auth_token_xxxxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER = "+1234567890" # Your Twilio phone number
# If not using Twilio, this section will be different for your chosen SMS service/GSM module.

SENSOR_HEIGHT_FROM_MUDPLAIN = 5.0 # meters. IMPORTANT: Calibrate this during deployment!