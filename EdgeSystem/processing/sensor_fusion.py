"""Fuses ultrasonic, radar, and CV readings into validated telemetry."""


def fuse_flow_rates(sensor_flow_mps, image_flow_mps):
    """Weighted blend when radar and CV agree; otherwise trust radar."""
    s = sensor_flow_mps or 0.0
    i = image_flow_mps or 0.0
    if s <= 0 and i <= 0:
        return 0.0
    if s <= 0:
        return round(i, 3)
    if i <= 0:
        return round(s, 3)
    if abs(s - i) / max(s, i, 0.01) > 0.5:
        return round(s, 3)
    return round(0.65 * s + 0.35 * i, 3)


def build_cycle_reading(
    water_level,
    sensor_flow,
    image_flow,
    rise_rate_mph,
    current_alert,
    predicted_level,
    predicted_alert,
    cycle_timestamp=None,
):
    """Package one 5-minute cycle (rise_rate from ultrasonic only, m/h)."""
    return {
        "timestamp": cycle_timestamp,
        "water_level": round(float(water_level or 0), 2),
        "sensor_flow_rate_mps": round(float(sensor_flow or 0), 3),
        "image_flow_rate_mps": round(float(image_flow or 0), 3),
        "fused_flow_rate_mps": fuse_flow_rates(sensor_flow, image_flow),
        "rise_rate": round(float(rise_rate_mph or 0), 4),
        "current_alert_level": current_alert or "GREEN",
        "predicted_level": round(float(predicted_level or water_level or 0), 2),
        "predicted_alert_level": predicted_alert or "GREEN",
    }
