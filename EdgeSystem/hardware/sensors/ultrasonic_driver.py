import time
import random
from config.settings import TRIG_PIN, ECHO_PIN

try:
    import RPi.GPIO as GPIO
    IS_PI = True
except (ImportError, RuntimeError):
    IS_PI = False
    print(" [Hardware] RPi.GPIO not found. Using Simulated Distance Data.")

def init_sensor():
    if not IS_PI: return 
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(TRIG_PIN, GPIO.OUT)
        GPIO.setup(ECHO_PIN, GPIO.IN)
        GPIO.output(TRIG_PIN, False)
        time.sleep(0.5) 
        print("JSN-SR04T Initialized.")
    except Exception as e:
        print(f"Error initializing Ultrasonic: {e}")

def get_distance():
    if not IS_PI:
        # Simulates a water distance between 1.5m and 4.0m
        return round(random.uniform(1.5, 4.0), 3)

    try:
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00002) 
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        timeout_start = time.time()

        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - timeout_start > 0.1: return 0.0 

        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - pulse_start > 0.1: return 0.0 

        distance_m = ((pulse_end - pulse_start) * 17150) / 100
        return round(max(0.20, distance_m), 3)
    except:
        return 0.0