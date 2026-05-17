"""Ultrasonic water-level history → rise_rate in meters per hour (m/h)."""
from collections import deque
from datetime import datetime


class RiseRateTracker:
    def __init__(self, window_sec=900):
        self.window_sec = window_sec
        self._samples = deque(maxlen=64)

    def add_sample(self, water_level_m, ts=None):
        if water_level_m is None:
            return
        self._samples.append((ts or datetime.now(), float(water_level_m)))

    def get_rise_rate_mph(self):
        """Rise rate from ultrasonic water_level trend (m/h)."""
        if len(self._samples) < 2:
            return 0.0

        newest_ts, newest_lvl = self._samples[-1]
        target_dt = self.window_sec * 0.5

        for ts, lvl in reversed(list(self._samples)[:-1]):
            dt = (newest_ts - ts).total_seconds()
            if dt >= max(60, target_dt):
                if dt < 1:
                    return 0.0
                mps = (newest_lvl - lvl) / dt
                return round(mps * 3600.0, 4)

        oldest_ts, oldest_lvl = self._samples[0]
        dt = (newest_ts - oldest_ts).total_seconds()
        if dt < 1:
            return 0.0
        mps = (newest_lvl - oldest_lvl) / dt
        return round(mps * 3600.0, 4)
