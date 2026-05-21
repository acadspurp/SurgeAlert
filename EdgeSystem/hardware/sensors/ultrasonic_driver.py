import collections
import time

from config.settings import (
    ECHO_PIN,
    SIM_ULTRASONIC_AMPLITUDE_M,
    SIM_ULTRASONIC_BASE_M,
    SIM_ULTRASONIC_PERIOD_SEC,
    SMOOTHING_WINDOW,
    TRIG_PIN,
    ULTRASONIC_MIN_VALID_DISTANCE_M,
    USE_HARDWARE,
)

try:
    import RPi.GPIO as GPIO
    IS_PI = True
except (ImportError, RuntimeError):
    IS_PI = False
    print(
        " [Ultrasonic] CONNECTION: RPi.GPIO unavailable on this host — "
        "using simulated distance (install RPi.GPIO on Raspberry Pi)."
    )

reading_queue = collections.deque(maxlen=SMOOTHING_WINDOW)


def init_sensor():
    if not USE_HARDWARE:
        print(" [Ultrasonic] Simulated mode (USE_HARDWARE=false).")
        return
    if not IS_PI:
        return
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(TRIG_PIN, GPIO.OUT)
        GPIO.setup(ECHO_PIN, GPIO.IN)
        GPIO.output(TRIG_PIN, False)
        time.sleep(0.5)
        print(f" [Ultrasonic] OK: JSN-SR04T on TRIG={TRIG_PIN}, ECHO={ECHO_PIN} (BCM).")
    except Exception as e:
        print(
            f" [Ultrasonic] INIT FAILED (GPIO/code): {e} — "
            f"check wiring and pin config in config/settings.py."
        )


def get_distance():
    if not USE_HARDWARE or not IS_PI:
        import math

        t = time.time()
        sim_dist = SIM_ULTRASONIC_BASE_M + SIM_ULTRASONIC_AMPLITUDE_M * math.sin(
            t / SIM_ULTRASONIC_PERIOD_SEC
        )
        return _get_smoothed_value(round(sim_dist, 3))

    try:
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00001)
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        pulse_end = time.time()
        timeout_start = time.time()

        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - timeout_start > 0.05:
                print(
                    " [Ultrasonic] HARDWARE: ECHO never went HIGH (timeout 50ms) — "
                    "check TRIG/ECHO wiring and sensor power."
                )
                return None

        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - pulse_start > 0.05:
                print(
                    " [Ultrasonic] HARDWARE: ECHO stuck HIGH (timeout 50ms) — "
                    "check echo line or interference."
                )
                return None

        duration = pulse_end - pulse_start
        distance_m = (duration * 343) / 2
        final_val = round(distance_m, 3)

        if final_val < ULTRASONIC_MIN_VALID_DISTANCE_M:
            print(
                f" [Ultrasonic] HARDWARE: raw distance {final_val} m below minimum "
                f"{ULTRASONIC_MIN_VALID_DISTANCE_M} m — ignoring sample."
            )
            return None

        return _get_smoothed_value(final_val)
    except Exception as e:
        print(f" [Ultrasonic] READ ERROR (GPIO/code): {e}")
        return None


def _get_smoothed_value(new_val):
    """Median filter; only valid distances enter the queue."""
    if new_val is not None and new_val >= ULTRASONIC_MIN_VALID_DISTANCE_M:
        reading_queue.append(new_val)

    if not reading_queue:
        return None

    sorted_readings = sorted(reading_queue)
    return sorted_readings[len(sorted_readings) // 2]
