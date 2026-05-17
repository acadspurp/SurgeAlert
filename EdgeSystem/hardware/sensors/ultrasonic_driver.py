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

import collections

# Queue for median filtering (size defined in settings)
from config.settings import SMOOTHING_WINDOW
reading_queue = collections.deque(maxlen=SMOOTHING_WINDOW)

def get_distance():
    if not IS_PI:
        # Simulated distance (m) for dev / non-Pi hosts
        import math
        t = time.time()
        sim_dist = 3.5 + 0.15 * math.sin(t / 120.0)
        return _get_smoothed_value(round(sim_dist, 3))

    try:
        # Trigger the sensor
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00001) # JSN-SR04T requires 10us trigger
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        pulse_end = time.time()
        timeout_start = time.time()

        # Wait for ECHO to go high
        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - timeout_start > 0.05: # 50ms timeout
                return _get_smoothed_value(0.0)

        # Wait for ECHO to go low
        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - pulse_start > 0.05: # 50ms timeout
                return _get_smoothed_value(0.0)

        duration = pulse_end - pulse_start
        # distance = (time * speed of sound) / 2
        distance_m = (duration * 343) / 2
        
        # JSN-SR04T min distance is ~20-25cm
        final_val = round(max(0.20, distance_m), 3)
        return _get_smoothed_value(final_val)
    except Exception as e:
        print(f" [Hardware] Ultrasonic Read Error: {e}")
        return _get_smoothed_value(0.0)

def _get_smoothed_value(new_val):
    """Internal helper to apply median filtering to raw readings."""
    if new_val > 0:
        reading_queue.append(new_val)
    
    if not reading_queue:
        return 0.0
        
    # Return median of the last N readings to filter spikes
    sorted_readings = sorted(list(reading_queue))
    return sorted_readings[len(sorted_readings) // 2]