import requests
import time

class WeatherManager:
    def __init__(self):
        self.qc_coords = (14.6760, 121.0437) # Quezon City (Upstream)
        self.mar_coords = (14.7011, 120.9830) # Marulas, Valenzuela (Site)
        self.base_url = "https://api.open-meteo.com/v1/forecast"

    def get_current_weather(self):
        """
        Fetches real-time and historical rainfall data from Open-Meteo.
        Calculates Lags, Rolling Sums, Trends, and Wind Vectors for the ML model.
        """
        results = {
            "QC_Rain_mm": 0.0, "QC_Lag1": 0.0, "QC_Lag2": 0.0, "QC_3hr_Sum": 0.0, "QC_6hr_Sum": 0.0,
            "Marulas_Rain_mm": 0.0, "Mar_Lag1": 0.0, "Mar_Lag2": 0.0,
            "Mar_3hr_Sum": 0.0, "Mar_6hr_Sum": 0.0, "Mar_24hr_Sum": 0.0,
            "Pressure_hPa": 1013.25, "Press_Trend": 0.0,
            "Wind_Speed": 0.0, "Wind_Sin": 0.0, "Wind_Cos": 1.0,
            "Soil_Moisture_pct": 0.5
        }
        
        try:
            import math
            # 1. QC Weather (Hourly for Lags and Sums)
            qc_params = {
                "latitude": self.qc_coords[0], "longitude": self.qc_coords[1],
                "current": ["precipitation"],
                "hourly": ["precipitation"],
                "timezone": "Asia/Manila", "past_days": 1, "forecast_days": 1
            }
            qc_resp = requests.get(self.base_url, params=qc_params, timeout=5).json()
            results["QC_Rain_mm"] = float(qc_resp.get("current", {}).get("precipitation", 0.0))
            
            qc_hourly = qc_resp.get("hourly", {}).get("precipitation", [])
            if len(qc_hourly) > 24:
                idx = 24
                results["QC_Lag1"] = float(qc_hourly[idx - 1])
                results["QC_Lag2"] = float(qc_hourly[idx - 2])
                results["QC_3hr_Sum"] = sum(qc_hourly[idx-2:idx+1])
                results["QC_6hr_Sum"] = sum(qc_hourly[idx-5:idx+1])

            # 2. Marulas Weather (Current + Hourly + Daily)
            mar_params = {
                "latitude": self.mar_coords[0], "longitude": self.mar_coords[1],
                "current": ["precipitation", "pressure_msl", "wind_speed_10m", "wind_direction_10m", "soil_moisture_0_to_7cm"],
                "hourly": ["precipitation", "pressure_msl"],
                "daily": ["precipitation_sum"],
                "timezone": "Asia/Manila", "past_days": 1, "forecast_days": 1
            }
            mar_resp = requests.get(self.base_url, params=mar_params, timeout=5).json()
            results["Marulas_Rain_mm"] = float(mar_resp.get("current", {}).get("precipitation", 0.0))
            results["Pressure_hPa"] = float(mar_resp.get("current", {}).get("pressure_msl", 1013.25))
            results["Wind_Speed"] = float(mar_resp.get("current", {}).get("wind_speed_10m", 0.0))
            results["Soil_Moisture_pct"] = float(mar_resp.get("current", {}).get("soil_moisture_0_to_7cm", 0.5))
            results["Mar_24hr_Sum"] = float(mar_resp.get("daily", {}).get("precipitation_sum", [0.0])[0])
            
            # Wind Direction to Sin/Cos
            wind_dir = float(mar_resp.get("current", {}).get("wind_direction_10m", 0.0))
            rad = math.radians(wind_dir)
            results["Wind_Sin"] = math.sin(rad)
            results["Wind_Cos"] = math.cos(rad)

            # Lags, Sums, and Pressure Trend for Marulas
            mar_hourly_rain = mar_resp.get("hourly", {}).get("precipitation", [])
            mar_hourly_press = mar_resp.get("hourly", {}).get("pressure_msl", [])
            if len(mar_hourly_rain) > 24:
                idx = 24
                results["Mar_Lag1"] = float(mar_hourly_rain[idx - 1])
                results["Mar_Lag2"] = float(mar_hourly_rain[idx - 2])
                results["Mar_3hr_Sum"] = sum(mar_hourly_rain[idx-2:idx+1])
                results["Mar_6hr_Sum"] = sum(mar_hourly_rain[idx-5:idx+1])
            
            if len(mar_hourly_press) > 24:
                idx = 24
                results["Press_Trend"] = float(mar_hourly_press[idx]) - float(mar_hourly_press[idx-1])
            
            return results
            
        except Exception as e:
            print(f" [Weather] Error fetching dual weather data: {e}")
            return results
