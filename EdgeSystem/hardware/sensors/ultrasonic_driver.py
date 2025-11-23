import RPi.GPIO as GPIO
import time
from config.settings import TRIG_PIN, ECHO_PIN

def init_sensor():
    """Initializes GPIO pins for the JSN-SR04T."""
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(TRIG_PIN, GPIO.OUT)
        GPIO.setup(ECHO_PIN, GPIO.IN)
        
        # Ensure Trigger is Low to start
        GPIO.output(TRIG_PIN, False)
        time.sleep(0.5) # JSN-SR04T needs longer to settle
        print("JSN-SR04T Waterproof Sensor Initialized.")
    except Exception as e:
        print(f"Error initializing Ultrasonic: {e}")

def get_distance():
    """Reads distance in METERS using JSN-SR04T timing."""
    try:
        # JSN-SR04T requires a slightly longer trigger pulse (at least 10us, doing 20us to be safe)
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00002) # 20 microseconds
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        pulse_end = time.time()
        timeout_start = time.time()

        # Wait for Echo HIGH
        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - timeout_start > 0.1:
                return 0.0 # Timeout (Sensor didn't fire)

        # Wait for Echo LOW
        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - pulse_start > 0.1:
                return 0.0 # Timeout (Object too far)

        pulse_duration = pulse_end - pulse_start

        # Distance calculation (Speed of Sound = 34300 cm/s)
        distance_cm = pulse_duration * 17150
        distance_m = distance_cm / 100

        # FILTER: JSN-SR04T has a minimum distance of ~20cm (0.2m).
        # If reading is less than 0.18m, it's likely noise/blind zone error.
        if distance_m < 0.18:
            # We return 0.0 or the previous known value to avoid false "Flood" alerts
            # For now, return 0.20 to simulate 'sensor is right at the water'
            return 0.20 

        return round(distance_m, 3)

    except Exception as e:
        print(f"Sensor Error: {e}")
        return 0.0
