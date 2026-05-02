import RPi.GPIO as GPIO
import time

# Pin Configuration (Match your wiring!)
TRIG_PIN = 23
ECHO_PIN = 24

def init_sensor():
    """Initializes GPIO pins for the sensor."""
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(TRIG_PIN, GPIO.OUT)
    GPIO.setup(ECHO_PIN, GPIO.IN)
    GPIO.output(TRIG_PIN, False)
    time.sleep(0.3) # Allow sensor to settle

def get_distance():
    """Reads the distance from the ultrasonic sensor in METERS."""
    try:
        # Ensure pins are set up if called repeatedly
        init_sensor() 
        
        # Send 10us pulse
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00001)
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        pulse_end = time.time()
        timeout_start = time.time()

        # Wait for Echo to go HIGH
        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - timeout_start > 0.1: 
                return 0.0 # Timeout

        # Wait for Echo to go LOW
        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - pulse_start > 0.1: 
                return 0.0 # Timeout

        pulse_duration = pulse_end - pulse_start
        
        # Distance = (Time * Speed of Sound) / 2
        # Speed of sound ~ 34300 cm/s
        distance_cm = pulse_duration * 17150
        distance_m = distance_cm / 100

        return round(distance_m, 3)

    except Exception as e:
        print(f"Sensor Error: {e}")
        return 0.0
    finally:
        GPIO.cleanup()