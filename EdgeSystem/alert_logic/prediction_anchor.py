"""
Anchor ML +1h outputs to live sensor ground truth while keeping weather/tide/rain signal.

Used before retrain: regressor/classifier stay weather-only; Pi clamps level and caps alert.
"""

from alert_logic.flow_alert import _rank
from config.settings import (
    FLOW_ESCALATE_ORANGE_MPS,
    PREDICTION_ANCHOR_MIN_UPLIFT_M,
    PREDICTION_ANCHOR_RISE_HEADROOM_FACTOR,
    PREDICTION_ML_BLEND_WEIGHT,
    RISE_RATE_YELLOW_MPH,
)


def sensor_projected_level_1h(water_level, rise_rate_mph, fused_flow_mps=0.0):
    """Same physics as LevelPredictor sensor-only path."""
    wl = max(0.0, float(water_level or 0.0))
    rise = float(rise_rate_mph or 0.0)
    fused = float(fused_flow_mps or 0.0)
    base = max(0.0, wl + rise)
    if fused > 0:
        base += fused * 3600.0 * 0.0001
    return base


def anchor_predicted_level(
    ml_level,
    water_level,
    rise_rate_mph,
    fused_flow_mps=0.0,
    *,
    sensor_projection=None,
):
    """
    Blend ML level with sensor projection, then clamp to a 1h band around the gauge.

    Floor: cannot drop more than observed fall in 1h (rise_rate_mph may be negative).
    Ceiling: current + min uplift, scaled rise headroom, optional flow bump.
    """
    wl = max(0.0, float(water_level or 0.0))
    rise = float(rise_rate_mph or 0.0)
    fused = float(fused_flow_mps or 0.0)
    proj = (
        sensor_projection
        if sensor_projection is not None
        else sensor_projected_level_1h(wl, rise, fused)
    )

    if ml_level is None:
        return round(proj, 2)

    ml = float(ml_level)
    w_ml = float(PREDICTION_ML_BLEND_WEIGHT)
    blended = (w_ml * ml) + ((1.0 - w_ml) * proj)

    floor = max(0.0, wl + min(0.0, rise))
    rise_headroom = max(0.0, rise) * float(PREDICTION_ANCHOR_RISE_HEADROOM_FACTOR)
    uplift = max(float(PREDICTION_ANCHOR_MIN_UPLIFT_M), rise_headroom)
    if rise < RISE_RATE_YELLOW_MPH and fused >= FLOW_ESCALATE_ORANGE_MPS:
        uplift = max(uplift, float(PREDICTION_ANCHOR_MIN_UPLIFT_M) * 2.0)
    ceiling = wl + uplift

    anchored = max(floor, min(ceiling, blended))
    return round(anchored, 2)


def gate_predicted_alert(
    ml_alert,
    alert_manager,
    water_level,
    anchored_level,
    rise_rate_mph,
    fused_flow_mps=0.0,
):
    """
    Predicted classification cannot exceed what sensors + anchored level justify.

    ML may stay lower (less aggressive early warning) but not higher than the cap.
    """
    cap = alert_manager.determine_alert_level_with_flow(
        water_level,
        predicted_level=anchored_level,
        rise_rate_per_hour=rise_rate_mph,
        fused_flow_mps=fused_flow_mps,
    )
    ml = (ml_alert or "GREEN").upper()
    if _rank(ml) > _rank(cap):
        return cap
    return ml
