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


def _load_env_file(env_path):
    """Minimal .env loader so Edge can run without shell-exported variables."""
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


# Load root .env first (shared by backend/frontend/edge), then local Edge override if present.
_load_env_file(os.path.join(BASE_DIR, "..", ".env"))
_load_env_file(os.path.join(BASE_DIR, ".env"))

# --- SECURITY & NETWORK ---
# Update these IPs to match your Java Backend PC's IP
BACKEND_IP = os.getenv("BACKEND_IP", "127.0.0.1")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8080")
BACKEND_API_URL = f"http://{BACKEND_IP}:{BACKEND_PORT}/api"
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "")

# --- HYBRID SMS/OTP DELIVERY ---
SMS_ONLINE_PRIMARY = os.getenv("SMS_ONLINE_PRIMARY", "true").lower() == "true"
SEMAPHORE_ENABLED = os.getenv("SEMAPHORE_ENABLED", "false").lower() == "true"
SEMAPHORE_API_KEY = os.getenv("SEMAPHORE_API_KEY", "")
SEMAPHORE_API_URL = os.getenv("SEMAPHORE_API_URL", "https://api.semaphore.co/api/v4/messages")
SEMAPHORE_SENDER_NAME = os.getenv("SEMAPHORE_SENDER_NAME", "SurgeAlert")

# --- SECURE MQTT SETTINGS (HiveMQ Cloud Serverless) ---
# Replace these with your actual HiveMQ Cloud details
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = 8883 # Port 8883 is required for MQTTS (SSL/TLS)
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_TOPIC_SENSOR = "surgealert/sensor-data"


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
# Set True = Use Real Sensors (Pi Camera, Ultrasonic, HLK Radar)
USE_HARDWARE = True

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

# --- SITE CALIBRATION INPUTS (JSN-SR04T) ---
# reference_height_m = mount height of sensor from riverbed.
REFERENCE_HEIGHT_M = float(os.getenv("REFERENCE_HEIGHT_M", str(SENSOR_HEIGHT_FROM_MUDPLAIN)))
# Median smoothing window for noisy ultrasonic readings.
SMOOTHING_WINDOW = int(os.getenv("SMOOTHING_WINDOW", "5"))
# Maximum plausible water-level jump per cycle in meters.
MAX_DELTA_M_PER_CYCLE = float(os.getenv("MAX_DELTA_M_PER_CYCLE", "0.75"))

# --- HARDWARE PINS & PORTS ---
# Ultrasonic Pins (GPIO)
TRIG_PIN = 23
ECHO_PIN = 24

# Radar Port (HLK-LD2415H uses UART, not GPIO)
RADAR_PORT = "/dev/ttyUSB0" 
RADAR_BAUDRATE = 9600

# GSM Module Port (SIM7600G-H uses UART AT Commands)
GSM_PORT = "/dev/ttyUSB2"
GSM_BAUDRATE = 115200