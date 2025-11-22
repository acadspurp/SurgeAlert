import os

# ========================================================
# SYSTEM CONFIGURATION
# ========================================================

# 1. HARDWARE MODE
# Set True = Use Real Sensors (Pi Camera, Ultrasonic, Radar)
# Set False = Use Simulation Files (Random numbers, Sample images)
USE_HARDWARE = True

# 2. DEPLOYMENT ENVIRONMENT
# Options: "AQUARIUM" or "RIVER"
# Change this ONE setting to switch between testing and real deployment.
ENVIRONMENT_MODE = "AQUARIUM"  # <--- CHANGE THIS TO "RIVER" LATER

# 3. BACKEND CONNECTION
# Your PC's IP Address
BACKEND_IP = "192.168.1.32" 
BACKEND_PORT = "8080"
BACKEND_API_URL = f"http://{BACKEND_IP}:{BACKEND_PORT}/api"
EDGE_API_KEY = "surge-alert-secret-123"

# ========================================================
# THRESHOLD SETTINGS (AUTOMATIC)
# ========================================================

if ENVIRONMENT_MODE == "AQUARIUM":
    print(">>> CONFIG LOADED: AQUARIUM MODE (Small Scale)")
    # Height of sensor from the bottom of the tank
    SENSOR_HEIGHT_FROM_MUDPLAIN = 0.32  # 32 cm (0.32 meters)
    
    # Small tank thresholds (in Meters)
    WATER_LEVEL_YELLOW_THRESHOLD = 0.15 # 15 cm
    WATER_LEVEL_ORANGE_THRESHOLD = 0.22 # 22 cm
    WATER_LEVEL_RED_THRESHOLD    = 0.28 # 28 cm (Critical)

elif ENVIRONMENT_MODE == "RIVER":
    print(">>> CONFIG LOADED: RIVER MODE (Real Deployment)")
    # Height of sensor from the riverbed (Tullahan River estimation)
    SENSOR_HEIGHT_FROM_MUDPLAIN = 5.0   # 5 meters
    
    # Real world thresholds (in Meters)
    WATER_LEVEL_YELLOW_THRESHOLD = 1.5  # 1.5 meters
    WATER_LEVEL_ORANGE_THRESHOLD = 2.5  # 2.5 meters
    WATER_LEVEL_RED_THRESHOLD    = 3.5  # 3.5 meters

else:
    raise ValueError("Invalid ENVIRONMENT_MODE! Choose 'AQUARIUM' or 'RIVER'")

# ========================================================
# HARDWARE / SIMULATION SETTINGS
# ========================================================

# Base Directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Database
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
DATABASE_NAME = 'surgealert.db'
DATABASE_PATH = os.path.join(DATABASE_DIR, DATABASE_NAME)

# SMS Templates
SMS_TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates', 'sms_alerts')

# Camera Settings
CAMERA_INDEX = 0 
IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480

# Image Processing (Computer Vision)
MAX_CORNERS = 100
QUALITY_LEVEL = 0.01
MIN_DISTANCE = 10
LK_WINDOW_SIZE = (15, 15)
LK_MAX_LEVEL = 2
LK_CRITERIA = (3, 10, 0.03)

# Calibration: How many meters does 1 pixel represent?
# Important: You must recalibrate this when moving from Aquarium to River!
if ENVIRONMENT_MODE == "AQUARIUM":
    PIXELS_TO_METERS = 0.0005 # 1 pixel is tiny in an aquarium
else:
    PIXELS_TO_METERS = 0.01   # 1 pixel covers more distance in a wide river

# Simulator Settings (Only used if USE_HARDWARE = False)
SIM_ULTRASONIC_MIN_DIST = 0.5 
SIM_ULTRASONIC_MAX_DIST = 3.0 
SIM_RADAR_MIN_FLOW = 0.0 
SIM_RADAR_MAX_FLOW = 1.8 
SIM_CAMERA_SAMPLE_IMAGE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'sample_water.jpg')
SIM_CAMERA_SEQUENCE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'river_sequence')

