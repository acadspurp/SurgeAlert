import os

from config.deployment_profiles import PROFILES

# --- PATHS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
DATABASE_NAME = os.getenv("DB_NAME", 'surgealert.db')
DATABASE_PATH = os.path.join(DATABASE_DIR, DATABASE_NAME)

# ML Model Paths
MODEL_DIR = os.path.join(BASE_DIR, 'ml_model', 'trained_models')
MODEL_PATH = os.path.join(MODEL_DIR, 'flood_prediction_model.joblib')


def _load_env_file(env_path, override=False):
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
            if not key:
                continue
            if override or key not in os.environ:
                os.environ[key] = value


# Root shared defaults, then EdgeSystem/.env wins on Pi (BACKEND_IP, MQTT_BROKER, etc.).
_load_env_file(os.path.join(BASE_DIR, "..", ".env"), override=False)
_load_env_file(os.path.join(BASE_DIR, ".env"), override=True)

# --- SECURITY & NETWORK ---
BACKEND_IP = os.getenv("BACKEND_IP", "127.0.0.1")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8080")

if "render.com" in BACKEND_IP or "https://" in BACKEND_IP or "http://" in BACKEND_IP:
    clean_ip = BACKEND_IP.rstrip("/")
    if "://" in clean_ip:
        BACKEND_API_URL = f"{clean_ip}/api"
    else:
        BACKEND_API_URL = f"https://{clean_ip}/api"
else:
    BACKEND_API_URL = f"http://{BACKEND_IP}:{BACKEND_PORT}/api"
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "")

# --- HYBRID SMS/OTP DELIVERY ---
SMS_ONLINE_PRIMARY = os.getenv("SMS_ONLINE_PRIMARY", "true").lower() == "true"
SEMAPHORE_ENABLED = os.getenv("SEMAPHORE_ENABLED", "false").lower() == "true"
SEMAPHORE_API_KEY = os.getenv("SEMAPHORE_API_KEY", "")
SEMAPHORE_API_URL = os.getenv("SEMAPHORE_API_URL", "https://api.semaphore.co/api/v4/messages")
SEMAPHORE_SENDER_NAME = os.getenv("SEMAPHORE_SENDER_NAME", "SurgeAlert")

# --- SECURE MQTT SETTINGS ---
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = 8883
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_TOPIC_SENSOR = os.getenv("MQTT_TOPIC_SENSOR", "sensor/data")

# --- TIDES API ---
WORLDTIDES_API_KEY = os.getenv("WORLDTIDES_API_KEY", "")

# --- CAMERA ---
CAMERA_INDEX = 0
IMAGE_WIDTH = 640
IMAGE_HEIGHT = 480

# --- COMPUTER VISION (algorithm params; scale from profile) ---
MAX_CORNERS = 100
QUALITY_LEVEL = 0.01
MIN_DISTANCE = 10
LK_WINDOW_SIZE = (15, 15)
LK_MAX_LEVEL = 2
LK_CRITERIA = (3, 10, 0.03)

# --- SYSTEM CONFIGURATION ---
USE_HARDWARE = os.getenv("USE_HARDWARE", "true").lower() == "true"

# --- DEPLOYMENT PROFILE (see config/deployment_profiles.py) ---
# Switch here: "RIVER" (Tullahan) or "POOL" (tank test, ×6 telemetry)
ENVIRONMENT_MODE = "POOL"
if ENVIRONMENT_MODE not in PROFILES:
    print(f" [Config] Unknown ENVIRONMENT_MODE={ENVIRONMENT_MODE!r}; using RIVER.")
    ENVIRONMENT_MODE = "RIVER"

_profile = PROFILES[ENVIRONMENT_MODE]

WATER_LEVEL_SCALE_FACTOR = float(_profile["water_level_scale_factor"])
RISE_RATE_SCALE_FACTOR = float(_profile["rise_rate_scale_factor"])
FLOW_SCALE_FACTOR = float(_profile["flow_scale_factor"])
SENSOR_HEIGHT_FROM_MUDPLAIN = float(_profile["sensor_height_m"])
SMOOTHING_WINDOW = int(_profile["smoothing_window"])
MAX_DELTA_M_PER_CYCLE = float(_profile["max_delta_m_per_cycle"])

WATER_LEVEL_YELLOW_THRESHOLD = float(_profile["water_level_yellow_threshold"])
WATER_LEVEL_ORANGE_THRESHOLD = float(_profile["water_level_orange_threshold"])
WATER_LEVEL_RED_THRESHOLD = float(_profile["water_level_red_threshold"])

RISE_RATE_YELLOW_MPH = float(_profile["rise_rate_yellow_mph"])
RISE_RATE_RED_WITH_ORANGE_MPH = float(_profile["rise_rate_red_with_orange_mph"])

FLOW_ESCALATE_ORANGE_MPS = float(_profile["flow_escalate_orange_mps"])
FLOW_ESCALATE_RED_MPS = float(_profile["flow_escalate_red_mps"])

PIXELS_TO_METERS = float(_profile["pixels_to_meters"])
CV_MIN_DIST_TO_WATER_M = float(_profile["cv_min_dist_to_water_m"])
TIDE_SCALING_FACTOR = float(_profile["tide_scaling_factor"])

SLEEP_DURATION_SEC = int(_profile["sleep_duration_sec"])
GATHER_DURATION_SEC = int(_profile["gather_duration_sec"])
CYCLE_INTERVAL_SEC = SLEEP_DURATION_SEC + GATHER_DURATION_SEC
SNAPSHOT_INTERVAL_SEC = CYCLE_INTERVAL_SEC
RISE_RATE_WINDOW_SEC = int(_profile["rise_rate_window_sec"])
ML_FEATURES_MAX_AGE_HOURS = int(_profile["ml_features_max_age_hours"])
LOCAL_SYNCED_RETAIN_DAYS = 7

SIM_ULTRASONIC_BASE_M = float(_profile["sim_ultrasonic_base_m"])
SIM_ULTRASONIC_AMPLITUDE_M = float(_profile["sim_ultrasonic_amplitude_m"])
SIM_ULTRASONIC_PERIOD_SEC = float(_profile["sim_ultrasonic_period_sec"])
SIM_RADAR_FLOW_BASE_MPS = float(_profile["sim_radar_flow_base_mps"])
SIM_RADAR_FLOW_AMPLITUDE_MPS = float(_profile["sim_radar_flow_amplitude_mps"])
SIM_RADAR_PERIOD_SEC = float(_profile["sim_radar_period_sec"])

FUSION_RADAR_WEIGHT = float(_profile["fusion_radar_weight"])
FUSION_CV_WEIGHT = float(_profile["fusion_cv_weight"])
FUSION_DISAGREE_RATIO = float(_profile["fusion_disagree_ratio"])

# Calibration (depth, thresholds, flow, timing): deployment_profiles.py only — not .env
REFERENCE_HEIGHT_M = SENSOR_HEIGHT_FROM_MUDPLAIN

# --- HARDWARE PINS & PORTS ---
TRIG_PIN = 23
ECHO_PIN = 24
RADAR_PORT = "/dev/ttyUSB0"
RADAR_BAUDRATE = 9600
GSM_PORT = "/dev/ttyUSB2"
GSM_BAUDRATE = 115200
