# EdgeSystem/processing/sensor_data_processor.py
from collections import deque
from statistics import median

from config.settings import (
    FLOW_SCALE_FACTOR,
    MAX_DELTA_M_PER_CYCLE,
    REFERENCE_HEIGHT_M,
    RISE_RATE_SCALE_FACTOR,
    SMOOTHING_WINDOW,
    ULTRASONIC_MIN_VALID_DISTANCE_M,
    WATER_LEVEL_SCALE_FACTOR,
)


def scale_telemetry_for_reporting(
    water_level, rise_rate_mph, sensor_flow_rate, image_flow_rate
):
    """Apply per-field scale factors (POOL → river-equivalent units on MQTT/alerts)."""
    wl_f = float(WATER_LEVEL_SCALE_FACTOR)
    rr_f = float(RISE_RATE_SCALE_FACTOR)
    flow_f = float(FLOW_SCALE_FACTOR)
    return (
        round(float(water_level or 0) * wl_f, 2),
        round(float(rise_rate_mph or 0) * rr_f, 4),
        round(float(sensor_flow_rate or 0) * flow_f, 3),
        round(float(image_flow_rate or 0) * flow_f, 3),
    )

_recent_levels = deque(maxlen=max(3, SMOOTHING_WINDOW))
_last_level = None


def _invalid_distance_reason(distance_from_sensor):
    """Return a short reason string if distance must not be used for level."""
    if distance_from_sensor is None:
        return "no reading (timeout, GPIO error, or driver returned nothing)"
    if distance_from_sensor < 0:
        return f"negative distance ({distance_from_sensor} m)"
    if distance_from_sensor < ULTRASONIC_MIN_VALID_DISTANCE_M:
        return (
            f"distance {distance_from_sensor:.3f} m below sensor minimum "
            f"({ULTRASONIC_MIN_VALID_DISTANCE_M} m) — likely fault, not full tank"
        )
    return None


def calculate_water_level(distance_from_sensor):
    """
    Converts ultrasonic distance (m) to water level from mudplain.
    Invalid reads reuse the last good level so alerts are not spiked to max height.
    """
    global _last_level
    reason = _invalid_distance_reason(distance_from_sensor)
    if reason:
        if _last_level is not None:
            print(
                f" [Ultrasonic] INVALID: {reason} — holding last good level "
                f"{_last_level:.2f} m (ref height {REFERENCE_HEIGHT_M} m)"
            )
            return round(_last_level, 2)
        print(
            f" [Ultrasonic] INVALID: {reason} — no prior good level, using 0.0 m "
            f"(ref height {REFERENCE_HEIGHT_M} m)"
        )
        return 0.0

    water_level = REFERENCE_HEIGHT_M - distance_from_sensor
    water_level = max(0.0, water_level)

    if _last_level is not None and abs(water_level - _last_level) > MAX_DELTA_M_PER_CYCLE:
        print(
            f" [Ultrasonic] SPIKE clamped: jump {abs(water_level - _last_level):.2f} m "
            f"> max {MAX_DELTA_M_PER_CYCLE} m/cycle — holding {_last_level:.2f} m"
        )
        water_level = _last_level

    _last_level = water_level
    _recent_levels.append(water_level)
    if len(_recent_levels) >= 3:
        water_level = float(median(_recent_levels))

    return round(max(0.0, water_level), 2)
