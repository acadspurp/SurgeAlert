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
        """Fetches a 3-day tide height forecast from WorldTides API to save tokens."""
        now = datetime.datetime.now()
        
        # Load cache if we haven't already
        if not self.heights:
            self.load_from_cache()

        # Check cache validity
        should_fetch = False
        
        # If we failed recently, enforce a 3-hour cooldown before trying again
        if self.last_failed_attempt and (now - self.last_failed_attempt).total_seconds() < 3 * 3600:
            return self.get_tide_at_time(0)

        # Determine if we need new data
        if not self.last_fetch_time:
            should_fetch = True
        else:
            age_seconds = (now - self.last_fetch_time).total_seconds()
            if age_seconds >= 48 * 3600: # 48 hours cache expiration
                should_fetch = True

        if not should_fetch:
            return self.get_tide_at_time(0)

        try:
            # Request 3 days (72 hours = 259200 seconds)
            start_ts = int(now.timestamp())
            url = f"https://www.worldtides.info/api/v3?heights&lat={self.lat}&lon={self.lon}&key={self.api_key}&start={start_ts}&length=259200&step=1800"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                print(f" [Tides] API Error: HTTP {response.status_code}. Retrying in 3 hours.")
                self.last_failed_attempt = now # Enforce 3-hour retry cooldown
                return self.get_tide_at_time(0)

            data = response.json()
            
            if "heights" in data and len(data["heights"]) > 0:
                self.heights = data["heights"]
                self.last_fetch_time = now
                self.last_failed_attempt = None # Clear failures
                print(f" [Tides] Successfully fetched 72h forecast ({len(self.heights)} points). Cached for 48 hours.")
                
                # Save to cache
                with open(self.cache_file, "w") as f:
                    json.dump({"heights": self.heights, "time": now.isoformat()}, f)
            else:
                self.last_failed_attempt = now
                print(" [Tides] API returned no heights. Retrying in 3 hours.")

        except Exception as e:
            print(f" [Tides] API Error: {e}. Retrying in 3 hours.")
            self.last_failed_attempt = now
            
        return self.get_tide_at_time(0)

    def load_from_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    cache = json.load(f)
                    self.heights = cache.get("heights", [])
                    time_str = cache.get("time")
                    if time_str:
                        self.last_fetch_time = datetime.datetime.fromisoformat(time_str)
                    print(f" [Tides] Loaded forecast from cache (Age: {int((datetime.datetime.now() - self.last_fetch_time).total_seconds()/3600)}h).")
            except:
                self.heights = []

    def get_tide_at_time(self, hours_offset=0):
        """Finds the tide height in the forecast closest to (now + hours_offset)."""
        if not self.heights:
            return 0.0
            
        target_time = int((datetime.datetime.now() + datetime.timedelta(hours=hours_offset)).timestamp())
        
        # Find the entry with the smallest time difference
        best_entry = min(self.heights, key=lambda x: abs(x['dt'] - target_time))
        return float(best_entry['height']) * TIDE_SCALING_FACTOR

    def get_current_tide_summary(self):
        """Returns (current_height, future_height, trend)"""
        # Ensure we have data
        if not self.heights or (self.last_fetch_time and (datetime.datetime.now() - self.last_fetch_time).total_seconds() >= 3600):
            self.fetch_tide_data()
            
        h_now = self.get_tide_at_time(0)
        h_future = self.get_tide_at_time(1)
        trend = h_future - h_now
        return h_now, h_future, trend