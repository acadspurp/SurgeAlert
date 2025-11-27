import os

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
DATABASE_NAME = os.getenv("DB_NAME", 'surgealert.db')
DATABASE_PATH = os.path.join(DATABASE_DIR, DATABASE_NAME)

# ML Model Paths
MODEL_DIR = os.path.join(BASE_DIR, 'ml_model', 'trained_models')
MODEL_PATH = os.path.join(MODEL_DIR, 'flood_prediction_model.joblib')

# SMS Templates
SMS_TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates', 'sms_alerts')

# --- SECURITY & NETWORK ---
# Update these IPs to match your Java Backend PC's IP
BACKEND_IP = os.getenv("BACKEND_IP", "192.168.100.1") 
BACKEND_PORT = os.getenv("BACKEND_PORT", "8080")
BACKEND_API_URL = f"http://{BACKEND_IP}:{BACKEND_PORT}/api"
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "surge-alert-secret-123")

# --- CAMERA ---
CAMERA_INDEX = 0
IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480

# --- COMPUTER VISION ---
MAX_CORNERS = 100
QUALITY_LEVEL = 0.01
MIN_DISTANCE = 10
LK_WINDOW_SIZE = (15, 15)
LK_MAX_LEVEL = 2
LK_CRITERIA = (3, 10, 0.03)

# --- SYSTEM CONFIGURATION ---
# Set True = Use Real Sensors (Pi Camera, Ultrasonic)
# Set False = Use Simulation Files (FORCE SIMULATION)
USE_HARDWARE = False

# --- DEPLOYMENT ENVIRONMENT ---
# Set to "RIVER" to support high water levels (like 17.75m)
ENVIRONMENT_MODE = "RIVER"

# --- CALIBRATION & THRESHOLDS ---
if ENVIRONMENT_MODE == "AQUARIUM":
    # --- AQUARIUM MODE (31 CM TANK) ---
    PIXELS_TO_METERS = 0.001
    SENSOR_HEIGHT_FROM_MUDPLAIN = 0.31 # 31 cm total height

    # Thresholds (Meters)
    WATER_LEVEL_YELLOW_THRESHOLD = 0.15
    WATER_LEVEL_ORANGE_THRESHOLD = 0.22
    WATER_LEVEL_RED_THRESHOLD = 0.27

    # Tide Scaling (Demo)
    TIDE_SCALING_FACTOR = 0.025

    # Simulator Ranges
    SIM_ULTRASONIC_MIN_DIST = 0.02
    SIM_ULTRASONIC_MAX_DIST = 0.30

else:
    # --- RIVER MODE (20 METER DEPTH CONFIG) ---
    PIXELS_TO_METERS = 0.01
    
    # UPDATED: Set to 20.0m to allow for a 17.75m reading (20 - 2.25 = 17.75)
    SENSOR_HEIGHT_FROM_MUDPLAIN = 20.0 

    # Thresholds (Meters) - Adjusted for River scale
    WATER_LEVEL_YELLOW_THRESHOLD = 6.0
    WATER_LEVEL_ORANGE_THRESHOLD = 8.0
    WATER_LEVEL_RED_THRESHOLD = 9.0

    # Real river uses real tide height (1:1 ratio)
    TIDE_SCALING_FACTOR = 1.0

    # Simulator Ranges
    SIM_ULTRASONIC_MIN_DIST = 0.5
    SIM_ULTRASONIC_MAX_DIST = 9.5

# Common Simulator Settings
SIM_RADAR_MIN_FLOW = 0.0
SIM_RADAR_MAX_FLOW = 1.8
SIM_CAMERA_SAMPLE_IMAGE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'sample_water.jpg')
SIM_CAMERA_SEQUENCE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'river_sequence')

# Hardware Pins
RADAR_PIN = 17
TRIG_PIN = 23
ECHO_PIN = 24