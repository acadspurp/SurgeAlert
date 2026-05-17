"""5-minute grid timestamps for sensor_data rows (:00, :05, :10, …)."""
from datetime import datetime


def align_to_five_minute_grid(dt=None):
    dt = dt or datetime.now()
    aligned_minute = (dt.minute // 5) * 5
    return dt.replace(minute=aligned_minute, second=0, microsecond=0)


def grid_timestamp_iso(dt=None):
    return align_to_five_minute_grid(dt).isoformat(timespec="seconds")
