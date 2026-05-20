"""Flow-based escalation when water level is already Orange or higher."""

from config.settings import (
    FLOW_ESCALATE_ORANGE_MPS,
    FLOW_ESCALATE_RED_MPS,
    WATER_LEVEL_ORANGE_THRESHOLD,
)

_ALERT_RANK = {"GREEN": 0, "YELLOW": 1, "ORANGE": 2, "RED": 3}


def _rank(level):
    return _ALERT_RANK.get((level or "GREEN").upper(), 0)


def apply_flow_escalation(base_alert, water_level, fused_flow_mps):
    """
    When WL >= Orange, high fused flow (radar+CV blend) can escalate alert severity.
  """
    if water_level is None or water_level < WATER_LEVEL_ORANGE_THRESHOLD:
        return base_alert or "GREEN"

    flow = fused_flow_mps or 0.0
    alert = (base_alert or "GREEN").upper()

    if flow >= FLOW_ESCALATE_RED_MPS and _rank(alert) < _rank("RED"):
        return "RED"
    if flow >= FLOW_ESCALATE_ORANGE_MPS and _rank(alert) < _rank("ORANGE"):
        return "ORANGE"
    return alert
