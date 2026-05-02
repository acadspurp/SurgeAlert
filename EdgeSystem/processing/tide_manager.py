import pandas as pd
import datetime
import os
from config.settings import BASE_DIR, TIDE_SCALING_FACTOR

class TideManager:
    def __init__(self):
        # Expects a CSV file at EdgeSystem/data/historical_tides.csv
        # Columns: 'datetime', 'height_meters'
        self.csv_path = os.path.join(BASE_DIR, 'data', 'historical_tides.csv')
        self.tide_data = None
        self.load_tides()

    def load_tides(self):
        try:
            if os.path.exists(self.csv_path):
                self.tide_data = pd.read_csv(self.csv_path)
                self.tide_data['datetime'] = pd.to_datetime(self.tide_data['datetime'])
                print(" [Tides] Tide Data Loaded Successfully.")
            else:
                print(" [Tides] WARNING: 'data/historical_tides.csv' NOT FOUND.")
                print(" [Tides] System will assume 0.0 tide height.")
        except Exception as e:
            print(f" [Tides] Error loading CSV: {e}")

    def get_tide_at_time(self, hours_offset=0):
        """
        Returns the SCALED tide height for (Now + hours_offset).
        """
        if self.tide_data is None:
            return 0.0
        
        # 1. Determine Target Time
        target_time = datetime.datetime.now() + datetime.timedelta(hours=hours_offset)
        
        try:
            # 2. Find closest row in CSV
            diffs = (self.tide_data['datetime'] - target_time).abs()
            closest_idx = diffs.idxmin()
            real_tide_height = float(self.tide_data.loc[closest_idx, 'height_meters'])
            
            # 3. Apply Scaling for Aquarium
            # Example: 1.8m (Real) * 0.025 = 0.045m (Aquarium)
            return real_tide_height * TIDE_SCALING_FACTOR
            
        except Exception:
            # Fallback
            return 0.0