import requests
import datetime
import os
import json
from config.settings import WORLDTIDES_API_KEY, TIDE_SCALING_FACTOR

class TideManager:
    def __init__(self):
        self.api_key = WORLDTIDES_API_KEY
        self.lat = 14.7011  # Valenzuela
        self.lon = 120.9830 # Marulas area
        self.cache_file = os.path.join(os.path.dirname(__file__), "..", "data", "tide_cache.json")
        self.heights = [] # Store hourly forecast
        self.last_fetch_time = None
        self.last_failed_attempt = None
        
        # Ensure data dir exists
        os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)

    def fetch_tide_data(self):
        """Fetches a 3-day tide height forecast. Tries WorldTides first, then falls back to Open-Meteo."""
        now = datetime.datetime.now()
        
        if not self.heights:
            self.load_from_cache()

        should_fetch = False
        if self.last_failed_attempt and (now - self.last_failed_attempt).total_seconds() < 1 * 3600:
            return self.get_tide_at_time(0)

        if not self.last_fetch_time:
            should_fetch = True
        else:
            age_seconds = (now - self.last_fetch_time).total_seconds()
            if age_seconds >= 24 * 3600: 
                should_fetch = True

        if not should_fetch:
            return self.get_tide_at_time(0)

        # 1. Try WorldTides
        if self.api_key:
            try:
                start_ts = int(now.timestamp())
                url = f"https://www.worldtides.info/api/v3?heights&lat={self.lat}&lon={self.lon}&key={self.api_key}&start={start_ts}&length=259200&step=1800"
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if "heights" in data and len(data["heights"]) > 0:
                        self._update_data(data["heights"], now)
                        return self.get_tide_at_time(0)
            except Exception as e:
                print(f" [Tides] WorldTides failed: {e}")

        # 2. Fallback to Open-Meteo Marine Model (No API key needed)
        try:
            print(" [Tides] Fetching from Open-Meteo Marine fallback...")
            url = f"https://marine-api.open-meteo.com/v1/marine?latitude={self.lat}&longitude={self.lon}&hourly=sea_level_height_msl&forecast_days=3&timezone=Asia/Manila"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "hourly" in data and "sea_level_height_msl" in data["hourly"]:
                    heights = []
                    times = data["hourly"]["time"]
                    vals = data["hourly"]["sea_level_height_msl"]
                    for t_str, val in zip(times, vals):
                        # Convert ISO format to timestamp
                        dt = datetime.datetime.fromisoformat(t_str)
                        heights.append({"dt": int(dt.timestamp()), "height": val})
                    
                    if heights:
                        self._update_data(heights, now)
                        return self.get_tide_at_time(0)
        except Exception as e:
            print(f" [Tides] Marine fallback failed: {e}")

        self.last_failed_attempt = now
        return self.get_tide_at_time(0)

    def _update_data(self, heights, now):
        self.heights = heights
        self.last_fetch_time = now
        self.last_failed_attempt = None
        print(f" [Tides] Successfully fetched forecast ({len(self.heights)} points).")
        with open(self.cache_file, "w") as f:
            json.dump({"heights": self.heights, "time": now.isoformat()}, f)

    def load_from_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    cache = json.load(f)
                    self.heights = cache.get("heights", [])
                    time_str = cache.get("time")
                    if time_str:
                        self.last_fetch_time = datetime.datetime.fromisoformat(time_str)
                    print(f" [Tides] Loaded forecast from cache.")
            except:
                self.heights = []

    def get_tide_at_time(self, hours_offset=0):
        """Finds the tide height in the forecast closest to (now + hours_offset)."""
        if not self.heights:
            return 0.0
            
        target_time = int((datetime.datetime.now() + datetime.timedelta(hours=hours_offset)).timestamp())
        
        # Find the entry with the smallest time difference
        # This handles the "Database is hourly but we need every 5 mins" issue by picking the nearest point
        best_entry = min(self.heights, key=lambda x: abs(x['dt'] - target_time))
        return float(best_entry['height']) * TIDE_SCALING_FACTOR

    def get_current_tide_summary(self):
        """Returns (current_height, future_height, trend)"""
        # Periodic refresh check
        if not self.heights or (self.last_fetch_time and (datetime.datetime.now() - self.last_fetch_time).total_seconds() >= 3600):
            self.fetch_tide_data()
            
        h_now = self.get_tide_at_time(0)
        h_future = self.get_tide_at_time(1) # Predict trend 1 hour ahead
        trend = h_future - h_now
        return h_now, h_future, trend