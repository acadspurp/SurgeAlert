# EdgeSystem/config/settings.py
import os
from dotenv import load_dotenv

# Load secrets from .env file
load_dotenv()

# --- SECURITY & NETWORK ---
# If .env is missing, it falls back to the second argument (the default string)
BACKEND_IP = os.getenv("BACKEND_IP", "192.168.1.32")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8080")
BACKEND_API_URL = f"http://{BACKEND_IP}:{BACKEND_PORT}/api"
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "surge-alert-secret-123")

# --- DATABASE ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
DATABASE_NAME = os.getenv("DB_NAME", 'surgealert.db')
DATABASE_PATH = os.path.join(DATABASE_DIR, DATABASE_NAME)

# --- SMS TEMPLATES ---
SMS_TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates', 'sms_alerts')

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
# Set False = Use Simulation Files
USE_HARDWARE = False  # <--- CHANGE TO TRUE ON RASPBERRY PI

# --- DEPLOYMENT ENVIRONMENT ---
# "AQUARIUM" or "RIVER"
ENVIRONMENT_MODE = "AQUARIUM" 

# --- CALIBRATION & THRESHOLDS ---
if ENVIRONMENT_MODE == "AQUARIUM":
    PIXELS_TO_METERS = 0.0005
    SENSOR_HEIGHT_FROM_MUDPLAIN = 0.32
    WATER_LEVEL_YELLOW_THRESHOLD = 0.15
    WATER_LEVEL_ORANGE_THRESHOLD = 0.22
    WATER_LEVEL_RED_THRESHOLD = 0.28
else:
    # RIVER MODE
    PIXELS_TO_METERS = 0.01
    SENSOR_HEIGHT_FROM_MUDPLAIN = 5.0
    WATER_LEVEL_YELLOW_THRESHOLD = 1.5
    WATER_LEVEL_ORANGE_THRESHOLD = 2.5
    WATER_LEVEL_RED_THRESHOLD = 3.5

# --- SIMULATOR SETTINGS ---
SIM_ULTRASONIC_MIN_DIST = 0.5
SIM_ULTRASONIC_MAX_DIST = 3.0
SIM_RADAR_MIN_FLOW = 0.0
SIM_RADAR_MAX_FLOW = 1.8
SIM_CAMERA_SAMPLE_IMAGE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'sample_water.jpg')
SIM_CAMERA_SEQUENCE_PATH = os.path.join(BASE_DIR, 'simulation', 'camera', 'sample_images', 'river_sequence')